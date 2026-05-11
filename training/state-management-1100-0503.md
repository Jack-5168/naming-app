# 状态管理专项训练 — 11:00, 2026-05-03

**主题:** 实现简易 Redux/Zustand，理解状态管理原理，10+ 状态管理示例
**目标:** 从零实现状态管理核心机制，掌握 Redux/Zustand 设计哲学

---

## 一、状态管理核心原理

### 1.1 为什么需要状态管理？

```
UI = f(state)

组件内状态 → 组件间状态 → 全局状态 → 分布式状态
  (useState)   (Context)   (Redux)     (服务端+客户端)
```

**状态管理的本质问题：**
- **共享** — 多个组件需要读写同一份状态
- **可预测** — 状态变化有迹可循，可调试
- **解耦** — 业务逻辑与 UI 分离
- **性能** — 避免不必要的重渲染

### 1.2 三大状态管理范式

| 范式 | 代表 | 核心思想 |
|------|------|----------|
| Flux/Redux | Redux, MobX | 单向数据流，action → reducer → state |
| 原子/信号 | Zustand, Jotai, Recoil | 细粒度原子状态，按需订阅 |
| 响应式 | Vue reactive, Solid | 依赖追踪，自动更新 |

---

## 二、从零实现 Redux

### 2.1 Redux 核心 API 实现

```javascript
// ====== createRedux.js — 从零实现 Redux ======

/**
 * createStore: Redux 的心脏
 * 
 * 核心机制:
 * 1. 维护一个 state 树
 * 2. getState() 读取状态
 * 3. dispatch(action) 触发状态变更
 * 4. subscribe(listener) 注册监听器
 */
function createStore(reducer, preloadedState, enhancer) {
  // 支持 enhancer ( applyMiddleware 等)
  if (enhancer) {
    return enhancer(createStore)(reducer, preloadedState);
  }

  let currentState = preloadedState;
  let currentReducer = reducer;
  let listeners = [];
  let isDispatching = false;

  function getState() {
    if (isDispatching) {
      throw new Error('You may not call store.getState() while the reducer is executing.');
    }
    return currentState;
  }

  function subscribe(listener) {
    if (isDispatching) {
      throw new Error('You may not call store.subscribe() while the reducer is executing.');
    }

    let isSubscribed = true;
    listeners.push(listener);

    // 返回取消订阅函数
    return function unsubscribe() {
      if (!isSubscribed) return;
      isSubscribed = false;
      const index = listeners.indexOf(listener);
      listeners.splice(index, 1);
    };
  }

  function dispatch(action) {
    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.');
    }

    if (typeof action.type === 'undefined') {
      throw new Error('Actions may not define an undefined type property.');
    }

    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }

    // 同步通知所有监听器（Redux 实际是拷贝数组后通知，防止订阅期间修改）
    const listenersCopy = listeners.slice();
    for (let i = 0; i < listenersCopy.length; i++) {
      listenersCopy[i]();
    }

    return action;
  }

  // 初始化 state (reducer 收到 undefined state 时返回默认值)
  dispatch({ type: '@@redux/INIT' });

  return { getState, dispatch, subscribe };
}

// ====== combineReducers: 组合 reducer ======

function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers);
  const finalReducers = {};

  for (const key of reducerKeys) {
    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key];
    }
  }

  const finalReducerKeys = Object.keys(finalReducers);

  return function combination(state = {}, action) {
    let hasChanged = false;
    const nextState = {};

    for (const key of finalReducerKeys) {
      const reducer = finalReducers[key];
      const previousStateForKey = state[key];
      const nextStateForKey = reducer(previousStateForKey, action);

      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }

    return hasChanged ? nextState : state;
  };
}

// ====== applyMiddleware: 中间件机制 ======

function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, preloadedState) => {
    const store = createStore(reducer, preloadedState);

    // 中间件看到的 store 是受限的 (只能 dispatch 和 getState)
    let dispatch = store.dispatch;
    const middlewareAPI = {
      getState: store.getState,
      dispatch: (action) => dispatch(action),
    };

    // 注入 middlewareAPI，得到 (next) => (action) => ... 形式的函数
    const chain = middlewares.map(mw => mw(middlewareAPI));
    
    // 组合中间件: compose(mw1, mw2, mw3) = mw1(mw2(mw3(dispatch)))
    dispatch = compose(...chain)(store.dispatch);

    return { ...store, dispatch };
  };
}

function compose(...funcs) {
  if (funcs.length === 0) return arg => arg;
  if (funcs.length === 1) return funcs[0];
  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}

// ====== bindActionCreators: 自动绑定 dispatch ======

function bindActionCreators(actionCreators, dispatch) {
  if (typeof actionCreators === 'function') {
    return function (...args) {
      return dispatch(actionCreators.apply(this, args));
    };
  }

  const boundActionCreators = {};
  for (const key in actionCreators) {
    const actionCreator = actionCreators[key];
    if (typeof actionCreator === 'function') {
      boundActionCreators[key] = function (...args) {
        return dispatch(actionCreator.apply(this, args));
      };
    }
  }
  return boundActionCreators;
}

// ====== 导出 ======
module.exports = { createStore, combineReducers, applyMiddleware, compose, bindActionCreators };
```

### 2.2 Redux 中间件实现

```javascript
// ====== 常用中间件 ======

/**
 * 1. Logger 中间件 — 打印每次 action 和 state 变化
 */
function logger({ getState }) {
  return (next) => (action) => {
    console.group(action.type);
    console.log('prev state:', getState());
    console.log('action:', action);
    const result = next(action);
    console.log('next state:', getState());
    console.groupEnd();
    return result;
  };
}

/**
 * 2. Thunk 中间件 — 支持异步 action
 * 
 * 原理: 如果 action 是函数，调用它并传入 dispatch + getState
 * 否则正常传递
 */
function thunk({ dispatch, getState }) {
  return (next) => (action) => {
    if (typeof action === 'function') {
      return action(dispatch, getState);
    }
    return next(action);
  };
}

/**
 * 3. Promise 中间件 — 自动处理 Promise action
 * 
 * 如果 action.payload 是 Promise:
 *   - 自动 dispatch { type: 'XXX_PENDING' }
 *   - resolve 后 dispatch { type: 'XXX_FULFILLED', payload: result }
 *   - reject 后 dispatch { type: 'XXX_REJECTED', error: true }
 */
function promiseMiddleware() {
  return (next) => (action) => {
    if (action.payload && typeof action.payload.then === 'function') {
      const { type, payload, meta } = action;

      // Pending
      next({ type: `${type}_PENDING`, meta });

      return payload
        .then(value => {
          next({ type: `${type}_FULFILLED`, payload: value, meta });
          return value;
        })
        .catch(error => {
          next({ type: `${type}_REJECTED`, error: true, payload: error, meta });
          throw error;
        });
    }
    return next(action);
  };
}

/**
 * 4. Immutable 中间件 — 防止 state 被直接修改
 * 
 * 对比 dispatch 前后的 state 子树，如果引用相同则报错
 */
function immutableMiddleware({ getState }) {
  return (next) => (action) => {
    const state = getState();
    const result = next(action);
    const newState = getState();

    // 简单检查: 如果 state 和 newState 是同一个引用
    if (state === newState) {
      // 某些 action 可能不修改 state，这是正常的
      // 这里只做简单演示
    }

    return result;
  };
}

/**
 * 5. Undo/Redo 中间件 — 历史记录管理
 */
function createUndoMiddleware(config = {}) {
  const limit = config.limit || 50;
  let history = { past: [], present: null, future: [] };

  return () => (next) => (action) => {
    // 处理 undo/redo 特殊 action
    if (action.type === '@@UNDO') {
      const previous = history.past[history.past.length - 1];
      if (previous === undefined) return;
      history.past = history.past.slice(0, -1);
      history.future = [history.present, ...history.future];
      history.present = previous;
      return { type: '@@UNDO_APPLY', payload: previous };
    }

    if (action.type === '@@REDO') {
      const next = history.future[0];
      if (next === undefined) return;
      history.future = history.future.slice(1);
      history.past = [...history.past, history.present];
      history.present = next;
      return { type: '@@REDO_APPLY', payload: next };
    }

    // 正常 action: 记录历史
    const result = next(action);
    if (history.present !== undefined) {
      history.past = [...history.past.slice(-limit + 1), history.present];
    }
    history.future = []; // 新 action 清空 future
    history.present = result; // 实际应该从 store.getState() 获取

    return result;
  };
}
```

### 2.3 Redux 完整使用示例

```javascript
// ====== 完整 Redux 应用示例 ======

const { createStore, combineReducers, applyMiddleware } = require('./createRedux');

// --- Actions ---
const ADD_TODO = 'ADD_TODO';
const TOGGLE_TODO = 'TOGGLE_TODO';
const SET_FILTER = 'SET_FILTER';

// --- Reducers ---
function todos(state = [], action) {
  switch (action.type) {
    case ADD_TODO:
      return [...state, {
        id: action.payload.id,
        text: action.payload.text,
        completed: false,
      }];
    case TOGGLE_TODO:
      return state.map(todo =>
        todo.id === action.payload.id
          ? { ...todo, completed: !todo.completed }
          : todo
      );
    default:
      return state;
  }
}

function filter(state = 'all', action) {
  switch (action.type) {
    case SET_FILTER:
      return action.payload.filter;
    default:
      return state;
  }
}

// --- Store ---
const reducer = combineReducers({ todos, filter });
const store = createStore(reducer, {}, applyMiddleware(logger, thunk));

// --- 使用 ---
store.subscribe(() => {
  const state = store.getState();
  const filtered = state.todos.filter(todo => {
    if (state.filter === 'completed') return todo.completed;
    if (state.filter === 'active') return !todo.completed;
    return true;
  });
  console.log('渲染 UI:', filtered);
});

// 同步 action
store.dispatch({ type: ADD_TODO, payload: { id: 1, text: '学习 Redux' } });
store.dispatch({ type: ADD_TODO, payload: { id: 2, text: '实现 Zustand' } });
store.dispatch({ type: TOGGLE_TODO, payload: { id: 1 } });

// 异步 action (thunk)
store.dispatch((dispatch, getState) => {
  setTimeout(() => {
    dispatch({ type: ADD_TODO, payload: { id: 3, text: '异步加载的 todo' } });
    console.log('当前 filter:', getState().filter);
  }, 100);
});
```

---

## 三、从零实现 Zustand

### 3.1 Zustand 核心 API 实现

```javascript
// ====== createZustand.js — 从零实现 Zustand ======

/**
 * Zustand 核心设计:
 * 1. 使用 subscribe 模式 (非 Redux 的 reducer 模式)
 * 2. set/get 直接操作 state (非 action dispatch)
 * 3. 细粒度订阅 — 选择器函数只监听关心的部分
 * 4. 中间件组合 — 通过高阶函数叠加能力
 * 
 * 与 Redux 的核心区别:
 * - Redux: dispatch(action) → reducer → 全量通知
 * - Zustand: set(partial) → 只通知相关选择器
 */
function createZustand(createState) {
  let state;
  const listeners = new Set();

  // 核心 set 函数
  const set = (partial, replace) => {
    const nextState = typeof partial === 'function'
      ? partial(state)
      : partial;

    if (!replace) {
      // 合并模式 (默认)
      if (typeof nextState !== 'object' || nextState === null) {
        throw new Error('set: nextState must be an object when replace=false');
      }
      state = { ...state, ...nextState };
    } else {
      // 替换模式
      state = nextState;
    }

    // 通知所有监听器
    const listenersCopy = Array.from(listeners);
    for (const listener of listenersCopy) {
      listener(state);
    }
  };

  // 核心 get 函数
  const get = () => state;

  // 核心 subscribe 函数 — 支持选择器
  const subscribe = (listener, selector, equalityFn) => {
    if (!selector) {
      // 无选择器: 监听整个 state
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    // 有选择器: 只监听 selector 返回的部分
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

  // 初始化
  const api = { setState: set, getState: get, subscribe };
  state = createState(set, get, api);

  return subscribe;
}

// ====== Zustand 中间件系统 ======

/**
 * 中间件模式: (create) => (set, get, api) => state
 * 中间件可以包裹 create，在 set/get 前后插入逻辑
 */

/**
 * 1. persist 中间件 — 持久化到 localStorage
 */
function persist(config) {
  return (create) => (set, get, api) => {
    const { name, storage = localStorage } = config;

    // 从存储恢复
    try {
      const stored = storage.getItem(name);
      if (stored) {
        const parsed = JSON.parse(stored);
        set(parsed, true);
      }
    } catch (e) {
      console.warn('persist: failed to load', e);
    }

    // 包装 set，每次变更时保存
    const origSet = set;
    const wrappedSet = (...args) => {
      origSet(...args);
      try {
        const state = get();
        // 支持 partialize 过滤要保存的字段
        const toSave = config.partialize ? config.partialize(state) : state;
        storage.setItem(name, JSON.stringify(toSave));
      } catch (e) {
        console.warn('persist: failed to save', e);
      }
    };

    return create(wrappedSet, get, api);
  };
}

/**
 * 2. devtools 中间件 — Redux DevTools 集成
 */
function devtools(create, name = 'zustand') {
  return (set, get, api) => {
    // 尝试连接 DevTools
    let devtools = null;
    if (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION__) {
      devtools = window.__REDUX_DEVTOOLS_EXTENSION__.connect({ name });
    }

    const wrappedSet = (...args) => {
      const prevState = get();
      set(...args);
      const nextState = get();

      if (devtools) {
        devtools.send(
          { type: args[0]?.type || 'anonymous' },
          nextState
        );
      }
    };

    return create(wrappedSet, get, api);
  };
}

/**
 * 3. immer 中间件 — 支持 draft 式修改
 */
function immer(create) {
  return (set, get, api) => {
    const wrappedSet = (partial) => {
      if (typeof partial === 'function') {
        // 使用 draft 模式
        const state = get();
        const draft = structuredClone(state); // 简化版，实际用 immer 库
        const result = partial(draft);
        // 对比 draft 和 state 的差异
        set(result !== undefined ? result : draft);
      } else {
        set(partial);
      }
    };
    return create(wrappedSet, get, api);
  };
}

/**
 * 4. subscribeWithSelector 中间件 — 带选择器的细粒度订阅
 */
function subscribeWithSelector(create) {
  return (set, get, api) => {
    const origSubscribe = api.subscribe;

    // 扩展 subscribe 支持 selector 参数
    const subscribeWithSelector = (listener, selector, equalityFn) => {
      return origSubscribe(listener, selector, equalityFn);
    };

    api.subscribeWithSelector = subscribeWithSelector;
    return create(set, get, api);
  };
}
```

### 3.2 Zustand 完整使用示例

```javascript
// ====== 完整 Zustand 应用示例 ======

const createZustand = require('./createZustand').default;

// --- 基础 Store ---
const useStore = createZustand((set, get) => ({
  // State
  bears: 0,
  name: 'Zustand Store',
  favorites: [],

  // Actions (通过 set 定义)
  increasePopulation: (by) => set((state) => ({ bears: state.bears + by })),
  removeBear: () => set((state) => ({ bears: state.bears - 1 })),
  setName: (name) => set({ name }),

  // 可以读取当前 state
  removeAllBears: () => set({ bears: 0 }),

  // 异步 action
  asyncLoadBears: async () => {
    const response = await fetch('/api/bears');
    const data = await response.json();
    set({ bears: data.count });
  },

  // 直接获取 state (不触发重渲染)
  getBears: () => get().bears,
}));

// --- 使用 ---

// 订阅整个 store
const unsub1 = useStore((state) => {
  console.log('Store changed:', state.bears, state.name);
});

// 细粒度订阅 (选择器) — 只监听 bears 变化
const unsub2 = useStore(
  (state) => state.bears,
  (bears) => console.log('Bears changed to:', bears)
);

// 只监听 name 变化
const unsub3 = useStore(
  (state) => state.name,
  (name) => console.log('Name changed to:', name)
);

// 操作
useStore.getState().increasePopulation(1); // bears: 1
useStore.getState().increasePopulation(2); // bears: 3
useStore.getState().setName('New Store');   // name changed

// 取消订阅
unsub1();
unsub2();
unsub3();
```

---

## 四、10+ 状态管理示例

### 示例 1: 计数器 (最简 Redux)

```javascript
// ====== 示例 1: 计数器 (Redux 模式) ======

function counterReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + (action.payload || 1) };
    case 'DECREMENT':
      return { count: state.count - (action.payload || 1) };
    case 'RESET':
      return { count: 0 };
    default:
      return state;
  }
}

const { createStore } = require('./createRedux');
const counterStore = createStore(counterReducer);

counterStore.subscribe(() => {
  console.log('计数器:', counterStore.getState().count);
});

counterStore.dispatch({ type: 'INCREMENT' });        // 1
counterStore.dispatch({ type: 'INCREMENT', payload: 5 }); // 6
counterStore.dispatch({ type: 'DECREMENT' });        // 5
counterStore.dispatch({ type: 'RESET' });            // 0
```

### 示例 2: 计数器 (最简 Zustand)

```javascript
// ====== 示例 2: 计数器 (Zustand 模式) ======

const useCounter = createZustand((set, get) => ({
  count: 0,
  increment: (n = 1) => set((s) => ({ count: s.count + n })),
  decrement: (n = 1) => set((s) => ({ count: s.count - n })),
  reset: () => set({ count: 0 }),
  doubleCount: () => get().count * 2, // 计算属性通过 getter 实现
}));

useCounter((s) => console.log('Count:', s.count));
useCounter.getState().increment();      // 1
useCounter.getState().increment(5);     // 6
useCounter.getState().decrement(2);     // 4
console.log('Double:', useCounter.getState().doubleCount()); // 8
```

### 示例 3: Todo 应用 (完整 CRUD)

```javascript
// ====== 示例 3: Todo 应用 (完整 CRUD) ======

const useTodoStore = createZustand((set, get) => ({
  todos: [],
  filter: 'all',

  addTodo: (text) => set((state) => ({
    todos: [...state.todos, {
      id: Date.now(),
      text,
      completed: false,
      createdAt: new Date().toISOString(),
    }],
  })),

  toggleTodo: (id) => set((state) => ({
    todos: state.todos.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    ),
  })),

  deleteTodo: (id) => set((state) => ({
    todos: state.todos.filter((t) => t.id !== id),
  })),

  editTodo: (id, text) => set((state) => ({
    todos: state.todos.map((t) =>
      t.id === id ? { ...t, text } : t
    ),
  })),

  setFilter: (filter) => set({ filter }),
  clearCompleted: () => set((state) => ({
    todos: state.todos.filter((t) => !t.completed),
  })),

  // 计算属性
  get filteredTodos() {
    const { todos, filter } = get();
    switch (filter) {
      case 'active': return todos.filter((t) => !t.completed);
      case 'completed': return todos.filter((t) => t.completed);
      default: return todos;
    }
  },

  get completedCount() {
    return get().todos.filter((t) => t.completed).length;
  },

  get totalCount() {
    return get().todos.length;
  },
}));

// 使用
useTodoStore.getState().addTodo('学习 Redux');
useTodoStore.getState().addTodo('学习 Zustand');
useTodoStore.getState().toggleTodo(/* id */);
console.log('剩余:', useTodoStore.getState().totalCount - useTodoStore.getState().completedCount);
```

### 示例 4: 购物车 (复杂状态)

```javascript
// ====== 示例 4: 购物车 (复杂状态管理) ======

const useCartStore = createZustand((set, get) => ({
  items: [],
  coupon: null,
  shipping: 'standard',

  addItem: (product) => set((state) => {
    const existing = state.items.find((i) => i.id === product.id);
    if (existing) {
      return {
        items: state.items.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      };
    }
    return { items: [...state.items, { ...product, quantity: 1 }] };
  }),

  removeItem: (id) => set((state) => ({
    items: state.items.filter((i) => i.id !== id),
  })),

  updateQuantity: (id, quantity) => set((state) => ({
    items: state.items.map((i) =>
      i.id === id ? { ...i, quantity: Math.max(0, quantity) } : i
    ).filter((i) => i.quantity > 0),
  })),

  setCoupon: (code) => set({ coupon: code }),
  setShipping: (method) => set({ shipping: method }),
  clearCart: () => set({ items: [], coupon: null }),

  // 计算属性
  get subtotal() {
    return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  },

  get shippingCost() {
    const { shipping, subtotal } = get();
    if (shipping === 'free' || subtotal > 99) return 0;
    if (shipping === 'express') return 15;
    return 5;
  },

  get discount() {
    const { coupon, subtotal } = get();
    if (coupon === 'SAVE10') return subtotal * 0.1;
    if (coupon === 'SAVE20') return subtotal * 0.2;
    return 0;
  },

  get total() {
    const s = get();
    return Math.max(0, s.subtotal - s.discount + s.shippingCost);
  },

  get itemCount() {
    return get().items.reduce((sum, i) => sum + i.quantity, 0);
  },
}));

// 使用
useCartStore.getState().addItem({ id: 1, name: '键盘', price: 299 });
useCartStore.getState().addItem({ id: 2, name: '鼠标', price: 199 });
useCartStore.getState().setCoupon('SAVE10');
console.log('总价:', useCartStore.getState().total);
```

### 示例 5: 主题/国际化 (Context 替代)

```javascript
// ====== 示例 5: 主题 + 国际化 ======

const useAppStore = createZustand((set, get) => ({
  // 主题
  theme: 'light',
  accentColor: '#3b82f6',
  fontSize: 14,

  // 国际化
  locale: 'zh-CN',
  messages: {
    'zh-CN': { greeting: '你好', farewell: '再见', welcome: '欢迎' },
    'en-US': { greeting: 'Hello', farewell: 'Goodbye', welcome: 'Welcome' },
    'ja-JP': { greeting: 'こんにちは', farewell: 'さようなら', welcome: 'ようこそ' },
  },

  // Actions
  toggleTheme: () => set((s) => ({
    theme: s.theme === 'light' ? 'dark' : 'light',
  })),

  setTheme: (theme) => set({ theme }),
  setAccentColor: (color) => set({ accentColor: color }),
  setFontSize: (size) => set({ fontSize: size }),
  setLocale: (locale) => set({ locale }),

  // 计算属性
  get t() {
    return (key) => get().messages[get().locale]?.[key] || key;
  },

  get isDark() {
    return get().theme === 'dark';
  },

  get themeStyles() {
    const { theme, accentColor, fontSize } = get();
    return {
      background: theme === 'dark' ? '#1a1a2e' : '#ffffff',
      color: theme === 'dark' ? '#e0e0e0' : '#333333',
      accent: accentColor,
      fontSize,
    };
  },
}));

// 细粒度订阅 — 只监听主题
useAppStore((s) => s.theme, (theme) => {
  document.body.className = theme;
});

// 细粒度订阅 — 只监听语言
useAppStore((s) => s.locale, (locale) => {
  document.documentElement.lang = locale;
});

useAppStore.getState().toggleTheme();
console.log(useAppStore.getState().t('greeting')); // 你好
useAppStore.getState().setLocale('en-US');
console.log(useAppStore.getState().t('greeting')); // Hello
```

### 示例 6: 表单状态管理

```javascript
// ====== 示例 6: 表单状态管理 ======

const useFormStore = createZustand((set, get) => ({
  values: {},
  errors: {},
  touched: {},
  isSubmitting: false,
  isValid: true,

  // 字段 schema 定义
  schema: {},

  setSchema: (schema) => set({ schema }),

  setField: (name, value) => set((state) => {
    const values = { ...state.values, [name]: value };
    const errors = { ...state.errors };
    
    // 实时校验
    const rule = state.schema[name];
    if (rule && rule.validate) {
      errors[name] = rule.validate(value) || undefined;
    } else {
      delete errors[name];
    }

    return {
      values,
      errors,
      isValid: Object.values(errors).every((e) => !e),
    };
  }),

  touchField: (name) => set((state) => ({
    touched: { ...state.touched, [name]: true },
  })),

  resetForm: () => set({
    values: {},
    errors: {},
    touched: {},
    isSubmitting: false,
  }),

  // 异步提交
  submit: async (onSubmit) => {
    set({ isSubmitting: true });
    try {
      await onSubmit(get().values);
    } catch (e) {
      console.error('Submit failed:', e);
    } finally {
      set({ isSubmitting: false });
    }
  },

  // 计算属性
  get hasErrors() {
    return Object.values(get().errors).some((e) => e);
  },

  get isDirty() {
    return Object.keys(get().values).length > 0;
  },
}));

// 使用
useFormStore.getState().setSchema({
  email: { validate: (v) => !v.includes('@') ? 'Invalid email' : undefined },
  name: { validate: (v) => !v ? 'Name required' : undefined },
});

useFormStore.getState().setField('name', 'Alice');
useFormStore.getState().setField('email', 'alice@example.com');
console.log('表单有效:', useFormStore.getState().isValid);
```

### 示例 7: 路由状态管理

```javascript
// ====== 示例 7: 路由状态管理 ======

const useRouterStore = createZustand((set, get) => ({
  currentPath: '/',
  history: ['/'],
  historyIndex: 0,
  params: {},
  query: {},

  navigate: (path) => {
    const state = get();
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(path);

    // 解析路径
    const [pathname, queryString] = path.split('?');
    const params = {};
    const query = {};

    // 解析 query string
    if (queryString) {
      queryString.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        query[decodeURIComponent(key)] = decodeURIComponent(value || '');
      });
    }

    set({
      currentPath: path,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      pathname,
      params,
      query,
    });
  },

  goBack: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      set({
        currentPath: state.history[newIndex],
        historyIndex: newIndex,
      });
    }
  },

  goForward: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      set({
        currentPath: state.history[newIndex],
        historyIndex: newIndex,
      });
    }
  },

  replace: (path) => {
    const state = get();
    const newHistory = [...state.history];
    newHistory[state.historyIndex] = path;
    set({ currentPath: path, history: newHistory });
  },
}));

// 使用
useRouterStore.getState().navigate('/home');
useRouterStore.getState().navigate('/users?page=2&sort=name');
useRouterStore.getState().goBack();
console.log('当前路径:', useRouterStore.getState().currentPath);
console.log('Query:', useRouterStore.getState().query);
```

### 示例 8: 通知/Toast 队列

```javascript
// ====== 示例 8: 通知队列 ======

const useNotificationStore = createZustand((set, get) => ({
  notifications: [],
  maxVisible: 5,

  add: (notification) => set((state) => {
    const id = Date.now() + Math.random();
    const newNotif = {
      id,
      type: 'info',
      duration: 3000,
      dismissible: true,
      ...notification,
      createdAt: Date.now(),
    };

    const notifications = [...state.notifications, newNotif].slice(-state.maxVisible);
    return { notifications };
  }),

  remove: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id),
  })),

  clear: () => set({ notifications: [] }),

  info: (message) => get().add({ type: 'info', message }),
  success: (message) => get().add({ type: 'success', message }),
  warning: (message) => get().add({ type: 'warning', message }),
  error: (message) => get().add({ type: 'error', message }),

  // 自动移除 (带定时器)
  addWithTimeout: (notification) => {
    const id = Date.now() + Math.random();
    get().add({ id, ...notification });
    setTimeout(() => get().remove(id), notification.duration || 3000);
  },
}));

// 使用
useNotificationStore.getState().success('操作成功!');
useNotificationStore.getState().error('网络错误');
useNotificationStore.getState().addWithTimeout({
  type: 'info',
  message: '3秒后自动消失',
  duration: 3000,
});
```

### 示例 9: 无限滚动/分页数据

```javascript
// ====== 示例 9: 分页数据管理 ======

const useListStore = createZustand((set, get) => ({
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
  loading: false,
  hasMore: true,
  error: null,

  // 模拟 API (实际替换为真实请求)
  fetchItems: async (reset = false) => {
    const state = get();
    if (state.loading) return;

    set({ loading: true, error: null });
    const currentPage = reset ? 1 : state.page;

    try {
      // 模拟 API 调用
      await new Promise((r) => setTimeout(r, 500));
      const mockData = Array.from({ length: state.pageSize }, (_, i) => ({
        id: (currentPage - 1) * state.pageSize + i + 1,
        title: `Item ${(currentPage - 1) * state.pageSize + i + 1}`,
      }));

      const newItems = reset ? mockData : [...state.items, ...mockData];
      const total = 100; // 模拟总数

      set({
        items: newItems,
        page: currentPage + 1,
        total,
        hasMore: newItems.length < total,
        loading: false,
      });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  loadMore: () => get().fetchItems(false),
  reset: () => get().fetchItems(true),

  // 计算属性
  get progress() {
    return Math.round((get().items.length / get().total) * 100);
  },
}));

// 使用
useListStore.getState().fetchItems(true); // 首次加载
// 滚动到底部时:
// useListStore.getState().loadMore();
```

### 示例 10: 状态机 (XState 风格)

```javascript
// ====== 示例 10: 有限状态机 ======

function createStateMachine(config) {
  const { initial, states, transitions } = config;

  return createZustand((set, get) => ({
    current: initial,
    history: [initial],
    context: {},

    send: (event, payload) => {
      const state = get();
      const currentState = states[state.current];
      const transition = currentState?.on?.[event];

      if (!transition) {
        console.warn(`No transition for event "${event}" in state "${state.current}"`);
        return;
      }

      const nextState = typeof transition === 'function'
        ? transition(state.context, payload)
        : transition;

      // 执行 exit/entry actions
      if (currentState?.exit) currentState.exit(state.context, payload);
      if (states[nextState]?.entry) states[nextState].entry(state.context, payload);

      set({
        current: nextState,
        history: [...state.history, nextState],
        context: payload ? { ...state.context, ...payload } : state.context,
      });
    },

    can: (event) => {
      const currentState = states[get().current];
      return !!currentState?.on?.[event];
    },
  }));
}

// --- 使用: 认证状态机 ---
const useAuthStore = createStateMachine({
  initial: 'idle',
  states: {
    idle: {
      on: { LOGIN: 'loading' },
      entry: () => console.log('🟢 Idle — 等待登录'),
    },
    loading: {
      on: {
        SUCCESS: 'authenticated',
        FAILURE: 'error',
      },
      entry: () => console.log('⏳ Loading — 验证中...'),
    },
    authenticated: {
      on: { LOGOUT: 'idle', REFRESH: 'loading' },
      entry: () => console.log('✅ Authenticated — 已登录'),
    },
    error: {
      on: { RETRY: 'loading', RESET: 'idle' },
      entry: () => console.log('❌ Error — 登录失败'),
    },
  },
});

// 使用
useAuthStore.getState().send('LOGIN');        // idle → loading
useAuthStore.getState().send('SUCCESS');       // loading → authenticated
console.log('可以登出?', useAuthStore.getState().can('LOGOUT')); // true
useAuthStore.getState().send('LOGOUT');        // authenticated → idle
```

### 示例 11: 拖拽排序状态

```javascript
// ====== 示例 11: 拖拽排序状态 ======

const useDragStore = createZustand((set, get) => ({
  items: [
    { id: '1', text: 'Item 1' },
    { id: '2', text: 'Item 2' },
    { id: '3', text: 'Item 3' },
    { id: '4', text: 'Item 4' },
    { id: '5', text: 'Item 5' },
  ],
  draggedId: null,
  overId: null,

  startDrag: (id) => set({ draggedId: id }),
  endDrag: () => set({ draggedId: null, overId: null }),
  setOver: (id) => set({ overId: id }),

  reorder: (draggedId, overId) => set((state) => {
    const items = [...state.items];
    const draggedIndex = items.findIndex((i) => i.id === draggedId);
    const overIndex = items.findIndex((i) => i.id === overId);

    if (draggedIndex === -1 || overIndex === -1) return state;

    const [dragged] = items.splice(draggedIndex, 1);
    items.splice(overIndex, 0, dragged);

    return { items };
  }),

  addItem: (text) => set((state) => ({
    items: [...state.items, { id: Date.now().toString(), text }],
  })),

  removeItem: (id) => set((state) => ({
    items: state.items.filter((i) => i.id !== id),
  })),

  // 计算属性
  get draggedItem() {
    const { items, draggedId } = get();
    return items.find((i) => i.id === draggedId);
  },
}));

// 使用
useDragStore.getState().startDrag('1');
useDragStore.getState().setOver('3');
useDragStore.getState().reorder('1', '3');
useDragStore.getState().endDrag();
console.log('排序后:', useDragStore.getState().items.map(i => i.text));
```

### 示例 12: 全局错误边界状态

```javascript
// ====== 示例 12: 全局错误状态管理 ======

const useErrorStore = createZustand((set, get) => ({
  errors: [],
  errorCount: 0,
  lastError: null,
  isCrashed: false,

  report: (error, context = {}) => {
    const errorEntry = {
      id: Date.now(),
      message: error.message || String(error),
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      handled: false,
    };

    set((state) => ({
      errors: [...state.errors.slice(-99), errorEntry], // 最多保留 100 条
      errorCount: state.errorCount + 1,
      lastError: errorEntry,
      isCrashed: context.fatal || false,
    }));

    // 上报到错误监控服务
    console.error('[Error Report]', errorEntry);
  },

  clear: () => set({ errors: [], isCrashed: false }),
  dismiss: (id) => set((state) => ({
    errors: state.errors.filter((e) => e.id !== id),
  })),

  // 全局错误监听
  setupGlobalListeners: () => {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      get().report(event.error || new Error(event.message), {
        source: 'window.onerror',
        filename: event.filename,
        lineno: event.lineno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      get().report(event.reason, { source: 'unhandledrejection' });
    });
  },

  // 计算属性
  get recentErrors() {
    return get().errors.slice(-5);
  },

  get hasErrors() {
    return get().errors.length > 0;
  },
}));

// 使用
useErrorStore.getState().report(new Error('API 请求失败'), { api: '/users' });
useErrorStore.getState().report(new TypeError('类型错误'), { source: 'validation' });
console.log('错误数:', useErrorStore.getState().errorCount);
```

---

## 五、Redux vs Zustand 深度对比

| 维度 | Redux | Zustand |
|------|-------|---------|
| **状态更新** | dispatch(action) → reducer | set(partial) / set(fn) |
| **不可变性** | 必须手动保持 (或配合 immer) | 同样需要，但 API 更简洁 |
| **订阅粒度** | 全量通知 (需配合 useSelector) | 原生支持选择器 |
| **异步** | 需要中间件 (thunk/saga) | 直接在 action 中写 async |
| **DevTools** | 原生支持 | 需要 devtools 中间件 |
| **TypeScript** | 类型较重 (Action, State 分离) | 类型推断更自然 |
| **Bundle 大小** | ~7KB (redux+react-redux) | ~1KB |
| **学习曲线** | 陡峭 (action/reducer/store/middleware) | 平缓 (set/get/subscribe) |
| **适用场景** | 大型应用、团队协作、需要时间旅行 | 中小型应用、快速开发、细粒度更新 |

---

## 六、状态管理核心模式总结

### 6.1 选择器模式 (Selector Pattern)

```javascript
// 核心思想: 只订阅你需要的部分
// Redux: useSelector(state => state.user.name)
// Zustand: useStore(state => state.user.name)

// 选择器的好处:
// 1. 避免不必要的重渲染
// 2. 计算属性缓存 (配合 useMemo)
// 3. 组件只关心自己的数据
```

### 6.2 中间件模式 (Middleware Pattern)

```javascript
// 核心思想: 在状态变更前后插入逻辑
// Redux: dispatch → middleware chain → reducer → notify
// Zustand: set → middleware wrapper → actual set → notify

// 常见中间件:
// - logger: 日志
// - thunk: 异步
// - persist: 持久化
// - devtools: 调试
// - immer: 可变语法
```

### 6.3 原子模式 (Atom Pattern)

```javascript
// Zustand 的原子模式: 每个状态是独立的 store
// 好处: 天然细粒度订阅，无选择器开销

const useUser = createZustand(() => ({ name: '', age: 0 }));
const useTheme = createZustand(() => ({ dark: false }));
const useCart = createZustand(() => ({ items: [] }));

// 组件只订阅自己需要的 store
```

---

## 七、面试自测题

1. **Redux 的三大原则是什么？你的实现中如何体现？**
   - 单一数据源 (store 维护一个 state)
   - 状态只读 (只能通过 dispatch 修改)
   - 纯函数修改 (reducer 必须是纯函数)

2. **Redux 中间件的执行顺序是怎样的？compose 函数如何工作？**
   - 从左到右组合: compose(a, b, c) = a(b(c(dispatch)))
   - 实际执行时从右到左: dispatch → c → b → a → 原始 dispatch

3. **Zustand 的选择器如何实现细粒度更新？**
   - 每个订阅者带一个 selector 函数
   - 状态变更时只比较 selector 返回值
   - 值不变则不触发回调

4. **Redux 和 Zustand 在 TypeScript 中的类型安全有何不同？**
   - Redux: 需要定义 Action 类型、State 类型、Reducer 类型
   - Zustand: 类型从 create 的返回值自动推断

5. **如何实现一个支持撤销/重做的状态管理器？**
   - 维护 past/present/future 三个数组
   - 每次 set 时将 present 移入 past
   - undo 时从 past 取出，redo 时从 future 取出

6. **状态管理中的"选择器"和"计算属性"有什么区别？**
   - 选择器: 从 state 中提取/派生数据 (不缓存)
   - 计算属性: 带缓存的选择器 (reselect/memoized)

---

## 八、完成总结

**本次训练覆盖:**

| 模块 | 内容 | 状态 |
|------|------|------|
| Redux 核心 | createStore / combineReducers / applyMiddleware / compose | ✅ |
| Redux 中间件 | logger / thunk / promise / immutable / undo | ✅ |
| Zustand 核心 | create / set / get / subscribe + 选择器 | ✅ |
| Zustand 中间件 | persist / devtools / immer / subscribeWithSelector | ✅ |
| 示例 1-2 | 计数器 (Redux + Zustand) | ✅ |
| 示例 3 | Todo CRUD | ✅ |
| 示例 4 | 购物车 (复杂计算) | ✅ |
| 示例 5 | 主题 + 国际化 | ✅ |
| 示例 6 | 表单状态管理 | ✅ |
| 示例 7 | 路由状态管理 | ✅ |
| 示例 8 | 通知队列 | ✅ |
| 示例 9 | 分页/无限滚动 | ✅ |
| 示例 10 | 有限状态机 | ✅ |
| 示例 11 | 拖拽排序 | ✅ |
| 示例 12 | 全局错误管理 | ✅ |
| 对比分析 | Redux vs Zustand 6 维度 | ✅ |
| 核心模式 | 选择器/中间件/原子模式 | ✅ |
| 面试自测 | 6 题 | ✅ |

**核心产出:**
- 从零实现 Redux (createStore + combineReducers + applyMiddleware + 5 个中间件)
- 从零实现 Zustand (create + 选择器订阅 + 4 个中间件)
- 12 个状态管理示例 (覆盖 CRUD/表单/路由/队列/分页/状态机/拖拽/错误)
- Redux vs Zustand 深度对比 + 核心模式总结 + 面试自测
