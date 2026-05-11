// ====== Test: 验证 Redux 和 Zustand 实现 ======

// --- Redux 实现 ---
function createStore(reducer, preloadedState, enhancer) {
  if (enhancer) return enhancer(createStore)(reducer, preloadedState);
  let currentState = preloadedState;
  const currentReducer = reducer;
  const listeners = [];
  let isDispatching = false;

  function getState() {
    if (isDispatching) throw new Error('Cannot getState during dispatch');
    return currentState;
  }

  function subscribe(listener) {
    if (isDispatching) throw new Error('Cannot subscribe during dispatch');
    let isSubscribed = true;
    listeners.push(listener);
    return function unsubscribe() {
      if (!isSubscribed) return;
      isSubscribed = false;
      const index = listeners.indexOf(listener);
      listeners.splice(index, 1);
    };
  }

  function dispatch(action) {
    if (isDispatching) throw new Error('Cannot dispatch during dispatch');
    if (typeof action.type === 'undefined') throw new Error('Action must have type');
    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }
    const listenersCopy = listeners.slice();
    for (let i = 0; i < listenersCopy.length; i += 1) listenersCopy[i]();
    return action;
  }

  dispatch({ type: '@@redux/INIT' });
  return { getState, dispatch, subscribe };
}

function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers);
  return function combination(state, action) {
    const s = state || {};
    let hasChanged = false;
    const nextState = {};
    for (const key of reducerKeys) {
      const r = reducers[key];
      const previousStateForKey = s[key];
      const nextStateForKey = r(previousStateForKey, action);
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    return hasChanged ? nextState : s;
  };
}

function applyMiddleware(...middlewares) {
  return (createStoreFn) => (reducer, preloadedState) => {
    const store = createStoreFn(reducer, preloadedState);
    let dispatch = store.dispatch;
    const { getState: storeGetState } = store;
    const middlewareAPI = { getState: storeGetState, dispatch: (action) => dispatch(action) }; // eslint-disable-line no-use-before-define
    const chain = middlewares.map((mw) => mw(middlewareAPI));
    dispatch = compose(...chain)(store.dispatch);
    return { ...store, dispatch };
  };
}

function compose(...funcs) {
  if (funcs.length === 0) return (arg) => arg;
  if (funcs.length === 1) return funcs[0];
  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}

// --- Zustand 实现 ---
function createZustand(createState) {
  let state;
  const listeners = new Set();

  const set = (partial, replace) => {
    const nextState = typeof partial === 'function' ? partial(state) : partial;
    if (!replace) {
      if (typeof nextState !== 'object' || nextState === null) {
        throw new Error('set: nextState must be an object');
      }
      state = { ...state, ...nextState };
    } else {
      state = nextState;
    }
    const listenersCopy = Array.from(listeners);
    for (const listener of listenersCopy) listener(state);
  };

  const get = () => state;

  const subscribe = (listener, selector, equalityFn) => {
    if (!selector) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
    let currentSlice = selector(state);
    const subscriber = (newState) => {
      const nextSlice = selector(newState);
      if (equalityFn ? !equalityFn(currentSlice, nextSlice) : currentSlice !== nextSlice) {
        currentSlice = nextSlice;
        listener(currentSlice);
      }
    };
    listeners.add(subscriber);
    return () => listeners.delete(subscriber);
  };

  const api = { setState: set, getState: get, subscribe };
  state = createState(set, get, api);

  // Zustand 风格: subscribe 函数上挂载 getState/setState
  subscribe.getState = get;
  subscribe.setState = set;

  return subscribe;
}

// ====== 测试 ======

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${msg}`);
  } else {
    failed += 1;
    console.error(`  ❌ ${msg}`);
  }
}

console.log('\n=== Redux 测试 ===');

// Test 1: createStore + dispatch
{
  const counter = (state = 0, action) => {
    switch (action.type) {
      case 'INC': return state + 1;
      case 'DEC': return state - 1;
      default: return state;
    }
  };
  const store = createStore(counter);
  assert(store.getState() === 0, '初始 state = 0');
  store.dispatch({ type: 'INC' });
  assert(store.getState() === 1, 'dispatch INC → state = 1');
  store.dispatch({ type: 'INC' });
  assert(store.getState() === 2, 'dispatch INC → state = 2');
  store.dispatch({ type: 'DEC' });
  assert(store.getState() === 1, 'dispatch DEC → state = 1');
}

// Test 2: subscribe
{
  const counter = (state, action) => {
    const s = state ?? 0;
    return action.type === 'INC' ? s + 1 : s;
  };
  const store = createStore(counter);
  let notified = false;
  store.subscribe(() => { notified = true; });
  store.dispatch({ type: 'INC' });
  assert(notified, 'subscribe 收到通知');
}

// Test 3: unsubscribe
{
  const counter = (state, action) => {
    const s = state ?? 0;
    return action.type === 'INC' ? s + 1 : s;
  };
  const store = createStore(counter);
  let count = 0;
  const unsub = store.subscribe(() => { count += 1; });
  store.dispatch({ type: 'INC' });
  unsub();
  store.dispatch({ type: 'INC' });
  assert(count === 1, 'unsubscribe 后不再通知');
}

// Test 4: combineReducers
{
  const a = (state, action) => {
    const s = state ?? 1;
    return action.type === 'ADD_A' ? s + 1 : s;
  };
  const b = (state, action) => {
    const s = state ?? 10;
    return action.type === 'ADD_B' ? s + 1 : s;
  };
  const store = createStore(combineReducers({ a, b }));
  assert(store.getState().a === 1 && store.getState().b === 10, 'combineReducers 初始值');
  store.dispatch({ type: 'ADD_A' });
  assert(store.getState().a === 2 && store.getState().b === 10, 'combineReducers 只更新 a');
}

// Test 5: applyMiddleware + logger
{
  const counter = (state, action) => {
    const s = state ?? 0;
    return action.type === 'INC' ? s + 1 : s;
  };
  let loggerCalled = false;
  const logger = ({ getState }) => {
    const nextWrapper = (next) => (action) => {
      loggerCalled = true;
      void getState;
      return next(action);
    };
    return nextWrapper;
  };
  const store = createStore(counter, {}, applyMiddleware(logger));
  store.dispatch({ type: 'INC' });
  assert(store.getState() === 1 && loggerCalled, 'applyMiddleware 正常工作');
}

// Test 6: thunk middleware
{
  const counter = (state, action) => {
    const s = state ?? { value: 0, loaded: false };
    switch (action.type) {
      case 'INC': return { ...s, value: s.value + 1 };
      case 'SET_LOADED': return { ...s, loaded: true };
      default: return s;
    }
  };
  const thunk = ({ dispatch: d, getState: g }) => {
    const nextWrapper = (next) => (action) => {
      if (typeof action === 'function') return action(d, g);
      return next(action);
    };
    return nextWrapper;
  };
  const store = createStore(counter, {}, applyMiddleware(thunk));
  let asyncResult = null;
  store.dispatch((dispatch, getState) => {
    setTimeout(() => {
      dispatch({ type: 'INC' });
      dispatch({ type: 'SET_LOADED' });
      asyncResult = getState();
    }, 50);
  });
  // 等待异步完成
  setTimeout(() => {
    assert(asyncResult && asyncResult.value === 1 && asyncResult.loaded === true, 'thunk 异步 dispatch 正常');

    console.log('\n=== Zustand 测试 ===');

    // Test 7: create + set + get
    {
      const useStore = createZustand((set, get) => ({
        count: 0,
        name: 'test',
        increment: () => set((s) => ({ count: s.count + 1 })),
        getName: () => get().name,
      }));

      let renderedCount = 0;
      useStore((s) => { renderedCount = s.count; });

      useStore.getState().increment();
      assert(renderedCount === 1, 'Zustand increment → count = 1');
      useStore.getState().increment();
      assert(renderedCount === 2, 'Zustand increment → count = 2');
      assert(useStore.getState().getName() === 'test', 'Zustand get() 正常');
    }

    // Test 8: selector subscription
    {
      const useStore = createZustand((set) => ({
        count: 0,
        name: 'test',
        inc: () => set((s) => ({ count: s.count + 1 })),
        setName: (n) => set({ name: n }),
      }));

      let countChanged = 0;
      let nameChanged = 0;

      useStore(() => { countChanged += 1; }, (s) => s.count);
      useStore(() => { nameChanged += 1; }, (s) => s.name);

      useStore.getState().inc();
      assert(countChanged === 2, 'selector: count 变化触发 (初始1 + inc1)');
      assert(nameChanged === 1, 'selector: name 未变化不触发');

      useStore.getState().setName('new');
      assert(countChanged === 2, 'selector: name 变化不触发 count');
      assert(nameChanged === 2, 'selector: name 变化触发 (初始1 + setName1)');
    }

    // Test 9: unsubscribe
    {
      const useStore = createZustand((set) => ({
        count: 0,
        inc: () => set((s) => ({ count: s.count + 1 })),
      }));

      let count = 0;
      const unsub = useStore((s) => { count = s.count; });
      useStore.getState().inc();
      assert(count === 1, 'unsubscribe 前正常');
      unsub();
      useStore.getState().inc();
      assert(count === 1, 'unsubscribe 后不更新');
    }

    // Test 10: replace mode
    {
      const useStore = createZustand((set) => ({
        a: 1,
        b: 2,
        replaceAll: (obj) => set(obj, true),
      }));
      useStore.getState().replaceAll({ x: 100 });
      assert(useStore.getState().x === 100 && useStore.getState().a === undefined, 'replace 模式替换整个 state');
    }

    // Test 11: equality function
    {
      const useStore = createZustand((set) => ({
        items: [1, 2, 3],
        add: (n) => set((s) => ({ items: [...s.items, n] })),
      }));

      let changed = 0;
      useStore(() => { changed += 1; }, (s) => s.items.length, (a, b) => a === b);

      useStore.getState().add(4);
      assert(changed === 2, 'equalityFn: length 变化触发');
      useStore.getState().add(5);
      assert(changed === 3, 'equalityFn: length 再次变化触发');
    }

    // Test 12: 购物车计算属性
    {
      const useCart = createZustand((set, get) => ({
        items: [{ id: 1, price: 100, qty: 2 }, { id: 2, price: 50, qty: 3 }],
        get subtotal() {
          return get().items.reduce((sum, item) => sum + item.price * item.qty, 0);
        },
      }));
      assert(useCart.getState().subtotal === 350, '购物车 subtotal = 100*2 + 50*3 = 350');
    }

    // 总结
    console.log('\n=== 测试结果 ===');
    console.log(`✅ 通过: ${passed}`);
    console.log(`❌ 失败: ${failed}`);
    console.log(`📊 总计: ${passed + failed}`);
    if (failed === 0) console.log('🎉 全部通过!');
  }, 100);
}
