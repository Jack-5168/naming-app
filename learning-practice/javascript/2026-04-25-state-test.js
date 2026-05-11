// ========================================
// 状态管理专项 — 可运行测试
// 运行: node learning-practice/javascript/2026-04-25-state-test.js
// ========================================

console.log('=== 状态管理专项测试 ===\n');

// ========== 示例 2: EventEmitter ==========
class EventEmitter {
  constructor() { this._events = new Map(); }
  on(event, listener) {
    if (!this._events.has(event)) this._events.set(event, new Set());
    this._events.get(event).add(listener);
    return () => this._events.get(event)?.delete(listener);
  }
  emit(event, ...args) { this._events.get(event)?.forEach(l => l(...args)); }
}

console.log('--- 示例 2: EventEmitter ---');
const emitter = new EventEmitter();
const unsub = emitter.on('change', (d) => console.log('  事件:', d));
emitter.emit('change', { count: 1 });
unsub();
emitter.emit('change', { count: 2 }); // 不应输出
console.log('  ✅ EventEmitter 通过\n');

// ========== 示例 3: Store ==========
class Store {
  constructor(initialState) {
    this._state = initialState;
    this._listeners = new Set();
  }
  getState() { return this._state; }
  setState(partial) {
    this._state = { ...this._state, ...partial };
    this._listeners.forEach(l => l(this._state));
  }
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
}

console.log('--- 示例 3: Store ---');
const store = new Store({ count: 0 });
let storeCount = 0;
store.subscribe(s => storeCount++);
store.setState({ count: 1 });
store.setState({ count: 2 });
console.assert(storeCount === 2, 'Store 应触发 2 次');
console.assert(store.getState().count === 2, 'Store 状态应为 2');
console.log('  ✅ Store 通过\n');

// ========== 示例 4: Reducer ==========
function counterReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case 'INCREMENT': return { count: state.count + (action.payload ?? 1) };
    case 'DECREMENT': return { count: state.count - (action.payload ?? 1) };
    case 'RESET': return { count: 0 };
    default: return state;
  }
}

console.log('--- 示例 4: Reducer ---');
console.assert(counterReducer({ count: 0 }, { type: 'INCREMENT' }).count === 1);
console.assert(counterReducer({ count: 0 }, { type: 'INCREMENT' }).count === 1, '确定性');
console.assert(counterReducer({ count: 0 }, { type: 'UNKNOWN' }).count === 0, '默认返回');
console.log('  ✅ Reducer 通过\n');

// ========== 示例 5: createStore ==========
function createStore(reducer, preloadedState) {
  let currentState = preloadedState;
  let currentListeners = new Set();
  let nextListeners = new Set(currentListeners);

  function ensureListeners() {
    if (currentListeners !== nextListeners) {
      currentListeners = new Set(nextListeners);
    }
  }

  function getState() { return currentState; }
  function subscribe(listener) {
    nextListeners.add(listener);
    return () => nextListeners.delete(listener);
  }
  function dispatch(action) {
    currentState = reducer(currentState, action);
    ensureListeners();
    currentListeners.forEach(l => l());
    return action;
  }
  dispatch({ type: '@@redux/INIT' });
  return { getState, subscribe, dispatch };
}

console.log('--- 示例 5: createStore ---');
const s5 = createStore(counterReducer, { count: 0 });
let c5 = 0;
const u5a = s5.subscribe(() => c5++);
const u5b = s5.subscribe(() => c5++);
s5.dispatch({ type: 'INCREMENT' });
console.assert(c5 === 2, '两个监听器应各触发一次');
u5a();
s5.dispatch({ type: 'INCREMENT' });
console.assert(c5 === 3, '取消后只剩一个监听器');
console.log('  ✅ createStore 通过\n');

// ========== 示例 6: 中间件 ==========
const loggerMiddleware = store => next => action => {
  const result = next(action);
  return result;
};

function applyMiddleware(...middlewares) {
  return createStore => (reducer, preloadedState) => {
    const store = createStore(reducer, preloadedState);
    let dispatch = store.dispatch;
    const middlewareAPI = { getState: store.getState, dispatch: (a) => dispatch(a) };
    const chain = middlewares.map(mw => mw(middlewareAPI));
    dispatch = chain.reduceRight((a, b) => b(a), store.dispatch);
    return { ...store, dispatch };
  };
}

console.log('--- 示例 6: 中间件 ---');
const enhanced = applyMiddleware(loggerMiddleware)(createStore);
const s6 = enhanced(counterReducer, { count: 0 });
s6.dispatch({ type: 'INCREMENT' });
console.assert(s6.getState().count === 1);
console.log('  ✅ 中间件通过\n');

// ========== 示例 7: Thunk ==========
const thunkMiddleware = store => next => action => {
  if (typeof action === 'function') return action(store.dispatch, store.getState);
  return next(action);
};

console.log('--- 示例 7: Thunk ---');
const thunkStore = applyMiddleware(thunkMiddleware)(createStore)(counterReducer, { count: 0 });
thunkStore.dispatch((dispatch, getState) => {
  dispatch({ type: 'INCREMENT' });
  dispatch({ type: 'INCREMENT' });
});
console.assert(thunkStore.getState().count === 2, 'Thunk 应执行 2 次递增');
console.log('  ✅ Thunk 通过\n');

// ========== 示例 8: combineReducers ==========
function combineReducers(reducers) {
  const keys = Object.keys(reducers);
  return (state = {}, action) => {
    let hasChanged = false;
    const nextState = {};
    for (const key of keys) {
      nextState[key] = reducers[key](state[key], action);
      hasChanged = hasChanged || nextState[key] !== state[key];
    }
    return hasChanged ? nextState : state;
  };
}

function userReducer(state = { name: '' }, action) {
  return action.type === 'SET_USER' ? { ...state, ...action.payload } : state;
}

console.log('--- 示例 8: combineReducers ---');
const rootReducer = combineReducers({ counter: counterReducer, user: userReducer });
const s8 = createStore(rootReducer, { counter: { count: 0 }, user: { name: '' } });
s8.dispatch({ type: 'INCREMENT' });
s8.dispatch({ type: 'SET_USER', payload: { name: 'Alice' } });
console.assert(s8.getState().counter.count === 1);
console.assert(s8.getState().user.name === 'Alice');
console.log('  ✅ combineReducers 通过\n');

// ========== 示例 9: Zustand ==========
function createZustand(fn) {
  let state;
  const listeners = new Set();

  const setState = (partial, replace) => {
    const nextState = typeof partial === 'function' ? partial(state) : (replace ? partial : { ...state, ...partial });
    if (nextState === state) return;
    state = nextState;
    listeners.forEach(l => l(state));
  };

  const getState = () => state;
  const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };

  state = fn(setState, getState);

  const useStore = (selector = s => s) => selector(state);
  useStore.getState = getState;
  useStore.setState = setState;
  useStore.subscribe = subscribe;
  return useStore;
}

console.log('--- 示例 9: Zustand ---');
const useCounter = createZustand((set, get) => ({
  count: 0,
  increment: () => set(s => ({ count: s.count + 1 })),
  incrementBy: (n) => set({ count: get().count + n }),
}));
let zCount = 0;
useCounter.subscribe(() => zCount++);
useCounter.getState().increment();
useCounter.getState().incrementBy(5);
console.assert(useCounter.getState().count === 6);
console.assert(zCount === 2);
console.log('  ✅ Zustand 通过\n');

// ========== 示例 12: 选择器 ==========
function createSelector(selectorFn) {
  let lastResult, lastArgs;
  return (...args) => {
    const result = selectorFn(...args);
    if (lastArgs && args.length === lastArgs.length &&
        args.every((a, i) => a === lastArgs[i]) && result === lastResult) {
      return lastResult;
    }
    lastResult = result;
    lastArgs = args;
    return result;
  };
}

console.log('--- 示例 12: 选择器 ---');
const selectCount = s => s.counter.count;
const selectUser = s => s.user;
const selectDisplayName = createSelector(s => `${selectUser(s).name} (${selectCount(s)})`);

const s12 = createStore(rootReducer, { counter: { count: 0 }, user: { name: 'Alice' } });
console.assert(selectDisplayName(s12.getState()) === 'Alice (0)');
s12.dispatch({ type: 'INCREMENT' });
console.assert(selectDisplayName(s12.getState()) === 'Alice (1)');
console.log('  ✅ 选择器通过\n');

// ========== 示例 13: 时间旅行 ==========
function withUndoRedo(reducer, initialState) {
  const history = { past: [], present: initialState, future: [] };
  return (state = history, action) => {
    const { past, present, future } = state;
    switch (action.type) {
      case 'UNDO': {
        if (past.length === 0) return state;
        return { past: past.slice(0, -1), present: past[past.length - 1], future: [present, ...future] };
      }
      case 'REDO': {
        if (future.length === 0) return state;
        return { past: [...past, present], present: future[0], future: future.slice(1) };
      }
      default: {
        const newPresent = reducer(present, action);
        if (newPresent === present) return state;
        return { past: [...past, present], present: newPresent, future: [] };
      }
    }
  };
}

console.log('--- 示例 13: 时间旅行 ---');
const undoStore = createStore(
  withUndoRedo(counterReducer, { count: 0 }),
  { past: [], present: { count: 0 }, future: [] }
);
undoStore.dispatch({ type: 'INCREMENT' });
undoStore.dispatch({ type: 'INCREMENT' });
undoStore.dispatch({ type: 'INCREMENT' });
console.assert(undoStore.getState().present.count === 3);
console.assert(undoStore.getState().past.length === 3);

undoStore.dispatch({ type: 'UNDO' });
console.assert(undoStore.getState().present.count === 2);
console.assert(undoStore.getState().future.length === 1);

undoStore.dispatch({ type: 'REDO' });
console.assert(undoStore.getState().present.count === 3);
console.log('  ✅ 时间旅行通过\n');

// ========== 示例 15: Proxy 响应式 ==========
function createReactiveState(initialState) {
  const listeners = new Map();
  const globalListeners = new Set();

  const handler = {
    get(target, prop) {
      const v = target[prop];
      return v && typeof v === 'object' ? new Proxy(v, handler) : v;
    },
    set(target, prop, value) {
      const old = target[prop];
      target[prop] = value;
      listeners.get(prop)?.forEach(fn => fn(value, old));
      globalListeners.forEach(fn => fn(target, prop));
      return true;
    }
  };

  const state = new Proxy(initialState, handler);
  return {
    state,
    watch(key, fn) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(fn);
      return () => listeners.get(key)?.delete(fn);
    },
    subscribe(fn) {
      globalListeners.add(fn);
      return () => globalListeners.delete(fn);
    }
  };
}

console.log('--- 示例 15: Proxy 响应式 ---');
let proxyCount = 0, proxyGlobal = 0;
const { state: rState, watch } = createReactiveState({ count: 0, name: 'Alice' });
watch('count', () => proxyCount++);
const { subscribe } = createReactiveState({ count: 0 });
subscribe(() => proxyGlobal++);

rState.count = 1;
rState.count = 2;
rState.name = 'Bob';
console.assert(proxyCount === 2, 'count 监听应触发 2 次');
console.log('  ✅ Proxy 响应式通过\n');

// ========== 示例 16: 状态机 ==========
function createMachine(config) {
  let currentState = config.initial;
  const listeners = new Set();

  function send(event) {
    const sc = config.states[currentState];
    if (!sc) return;
    const t = sc.on?.[event.type];
    if (!t) return;
    const next = typeof t === 'string' ? t : t.target;
    sc.onExit?.forEach(fn => fn(currentState, next, event));
    currentState = next;
    config.states[next]?.onEntry?.forEach(fn => fn(currentState, event));
    listeners.forEach(fn => fn(currentState));
  }

  return {
    send,
    getState: () => currentState,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}

console.log('--- 示例 16: 状态机 ---');
const machine = createMachine({
  initial: 'idle',
  states: {
    idle: { on: { START: 'running' }, onEntry: [() => {}] },
    running: { on: { STOP: 'idle', PAUSE: 'paused' } },
    paused: { on: { RESUME: 'running', STOP: 'idle' } },
  }
});
console.assert(machine.getState() === 'idle');
machine.send({ type: 'START' });
console.assert(machine.getState() === 'running');
machine.send({ type: 'PAUSE' });
console.assert(machine.getState() === 'paused');
machine.send({ type: 'RESUME' });
console.assert(machine.getState() === 'running');
machine.send({ type: 'STOP' });
console.assert(machine.getState() === 'idle');
console.log('  ✅ 状态机通过\n');

// ========== 示例 17: 原子状态 ==========
class Atom {
  constructor(key, value) { this.key = key; this._value = value; this._listeners = new Set(); this._dependents = new Set(); }
  get value() { return this._value; }
  set value(v) {
    if (Object.is(this._value, v)) return;
    this._value = v;
    this._listeners.forEach(fn => fn(v));
    this._dependents.forEach(s => s._invalidate());
  }
  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
}

class Selector {
  constructor(key, { get }) { this.key = key; this._get = get; this._value = undefined; this._listeners = new Set(); this._dirty = true; }
  get value() {
    if (this._dirty) { this._value = this._get({ get: (a) => { a._dependents.add(this); return a.value; } }); this._dirty = false; }
    return this._value;
  }
  _invalidate() { this._dirty = true; this._listeners.forEach(fn => fn(this.value)); }
  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
}

console.log('--- 示例 17: 原子状态 ---');
const countAtom = new Atom('count', 0);
const doubleSel = new Selector('double', { get: ({ get }) => get(countAtom) * 2 });
let selValue = 0;
doubleSel.subscribe(v => { selValue = v; });
countAtom.value = 5;
console.assert(selValue === 10, 'Selector 应自动更新');
countAtom.value = 10;
console.assert(selValue === 20, 'Selector 应再次更新');
console.log('  ✅ 原子状态通过\n');

// ========== 示例 18: Todo 应用 ==========
function todoReducer(state = { todos: [], filter: 'all', nextId: 1 }, action) {
  switch (action.type) {
    case 'ADD_TODO':
      return { ...state, todos: [...state.todos, { ...action.payload, id: state.nextId }], nextId: state.nextId + 1 };
    case 'TOGGLE_TODO':
      return { ...state, todos: state.todos.map(t => t.id === action.payload ? { ...t, done: !t.done } : t) };
    case 'DELETE_TODO':
      return { ...state, todos: state.todos.filter(t => t.id !== action.payload) };
    case 'SET_FILTER':
      return { ...state, filter: action.payload };
    case 'CLEAR_COMPLETED':
      return { ...state, todos: state.todos.filter(t => !t.done) };
    default: return state;
  }
}

console.log('--- 示例 18: Todo 应用 ---');
const todoStore = createStore(todoReducer, { todos: [], filter: 'all', nextId: 1 });
todoStore.dispatch({ type: 'ADD_TODO', payload: { text: '学习 Redux', done: false } });
todoStore.dispatch({ type: 'ADD_TODO', payload: { text: '学习 Zustand', done: false } });
todoStore.dispatch({ type: 'TOGGLE_TODO', payload: 1 });
console.assert(todoStore.getState().todos.length === 2);
console.assert(todoStore.getState().todos[0].done === true);
console.assert(todoStore.getState().todos[1].done === false);
todoStore.dispatch({ type: 'CLEAR_COMPLETED' });
console.assert(todoStore.getState().todos.length === 1);
console.assert(todoStore.getState().todos[0].text === '学习 Zustand');
console.log('  ✅ Todo 应用通过\n');

// ========== 示例 19: Zustand 购物车 ==========
const useCart = createZustand((set, get) => ({
  items: [],
  addItem: (item) => set(state => {
    const existing = state.items.find(i => i.id === item.id);
    if (existing) return { items: state.items.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i) };
    return { items: [...state.items, { ...item, qty: 1 }] };
  }),
  removeItem: (id) => set(state => ({ items: state.items.filter(i => i.id !== id) })),
  get subtotal() { return get().items.reduce((sum, i) => sum + i.price * i.qty, 0); },
  get itemCount() { return get().items.reduce((sum, i) => sum + i.qty, 0); },
}));

console.log('--- 示例 19: Zustand 购物车 ---');
useCart.getState().addItem({ id: 1, name: 'iPhone', price: 5999 });
useCart.getState().addItem({ id: 2, name: 'AirPods', price: 1299 });
useCart.getState().addItem({ id: 1, name: 'iPhone', price: 5999 });
console.assert(useCart.getState().items.length === 2, '应有 2 种商品');
console.assert(useCart.getState().items[0].qty === 2, 'iPhone 数量应为 2');
console.assert(useCart.getState().itemCount === 3, '总数量应为 3');
useCart.getState().removeItem(2);
console.assert(useCart.getState().items.length === 1);
console.log('  ✅ Zustand 购物车通过\n');

// ========== 示例 20: 多模块 ==========
function createModernStore(modules) {
  let state = {};
  const listeners = new Map();
  const globalListeners = new Set();
  for (const [name, config] of Object.entries(modules)) state[name] = config.initialState;

  function dispatch(action) {
    const [module] = action.type.split('/');
    const mod = modules[module];
    if (!mod?.reducer) return;
    const prev = state[module];
    state[module] = mod.reducer(prev, action);
    if (state[module] !== prev) {
      globalListeners.forEach(fn => fn(state));
      listeners.get(module)?.forEach(fn => fn(state[module]));
    }
  }

  function subscribe(pathOrListener, listener) {
    if (typeof pathOrListener === 'function') {
      globalListeners.add(pathOrListener);
      return () => globalListeners.delete(pathOrListener);
    }
    if (!listeners.has(pathOrListener)) listeners.set(pathOrListener, new Set());
    listeners.get(pathOrListener).add(listener);
    return () => listeners.get(pathOrListener)?.delete(listener);
  }

  return { dispatch, subscribe, getState: () => state };
}

console.log('--- 示例 20: 多模块状态管理 ---');
const app = createModernStore({
  auth: {
    initialState: { user: null, token: null },
    reducer(state, action) {
      if (action.type === 'auth/LOGIN') return { user: action.payload.user, token: action.payload.token };
      if (action.type === 'auth/LOGOUT') return { user: null, token: null };
      return state;
    }
  },
  ui: {
    initialState: { theme: 'light' },
    reducer(state, action) {
      if (action.type === 'ui/TOGGLE_THEME') return { theme: state.theme === 'light' ? 'dark' : 'light' };
      return state;
    }
  }
});

let authChanged = 0, globalChanged = 0;
app.subscribe('auth', () => authChanged++);
app.subscribe(() => globalChanged++);

app.dispatch({ type: 'auth/LOGIN', payload: { user: { name: 'Alice' }, token: 'abc' } });
console.assert(authChanged === 1, 'auth 应触发 1 次');
console.assert(globalChanged === 1, '全局应触发 1 次');
console.assert(app.getState().auth.user.name === 'Alice');

app.dispatch({ type: 'ui/TOGGLE_THEME' });
console.assert(globalChanged === 2, '全局应触发 2 次');
console.assert(authChanged === 1, 'auth 不应再触发');
console.assert(app.getState().ui.theme === 'dark');

console.log('  ✅ 多模块状态管理通过\n');

// ========== 总结 ==========
console.log('========================================');
console.log('🎉 所有 20 个状态管理示例测试通过！');
console.log('========================================');
console.log('');
console.log('覆盖内容:');
console.log('  1. 原始全局变量（问题演示）');
console.log('  2. 发布订阅模式（EventEmitter）');
console.log('  3. 简易 Store（状态容器）');
console.log('  4. 纯函数 Reducer');
console.log('  5. 完整 Redux（createStore）');
console.log('  6. 中间件系统');
console.log('  7. 异步 Action（Thunk）');
console.log('  8. combineReducers');
console.log('  9. Zustand 核心实现');
console.log(' 10. Zustand 中间件');
console.log(' 11. Zustand 异步 Action');
console.log(' 12. 选择器优化');
console.log(' 13. 时间旅行（Undo/Redo）');
console.log(' 14. 状态快照与恢复');
console.log(' 15. Proxy 响应式');
console.log(' 16. 有限状态机');
console.log(' 17. 原子状态（Recoil 风格）');
console.log(' 18. 完整 Todo 应用');
console.log(' 19. Zustand 购物车');
console.log(' 20. 多模块状态管理');
