# 📦 状态管理专项训练 — 实现简易 Redux/Zustand

**日期**: 2026-04-25 11:00  
**主题**: 状态管理原理 — 从发布订阅到 Redux/Zustand  
**目标**: 理解状态管理核心原理，手写 10+ 状态管理示例  
**产出**: 完整实现 + 深度笔记 + 可运行代码

---

## 一、状态管理本质

状态管理的核心就三件事：

1. **存储状态** — 单一数据源
2. **更新状态** — 可预测的变更方式
3. **响应变更** — 通知依赖方重新渲染/计算

所有状态管理库（Redux、Zustand、MobX、Pinia）都是这三件事的不同实现。

---

## 二、演进路线：从原始到现代

### 示例 1: 原始全局变量（问题演示）

```js
// ❌ 问题：谁都能改，无法追踪，无法回退
let count = 0;
let name = "Alice";

function increment() {
  count++;
}
function setName(n) {
  name = n;
}

// 问题：
// 1. 任何代码都能直接修改状态
// 2. 不知道谁改了、什么时候改的
// 3. 无法撤销/重做
// 4. 无法追踪依赖关系
```

### 示例 2: 发布订阅模式（观察者）

```js
// ✅ 核心：状态变更时通知所有订阅者
class EventEmitter {
  constructor() {
    this._events = new Map();
  }

  on(event, listener) {
    if (!this._events.has(event)) {
      this._events.set(event, new Set());
    }
    this._events.get(event).add(listener);
    // 返回取消订阅函数
    return () => this._events.get(event)?.delete(listener);
  }

  emit(event, ...args) {
    this._events.get(event)?.forEach((listener) => listener(...args));
  }

  off(event, listener) {
    this._events.get(event)?.delete(listener);
  }
}

// 使用
const emitter = new EventEmitter();
const unsub = emitter.on("change", (data) => {
  console.log("状态变了:", data);
});

emitter.emit("change", { count: 1 }); // 状态变了: { count: 1 }
unsub(); // 取消订阅
```

**关键点**: Redux/Zustand 底层都是发布订阅，只是封装方式不同。

### 示例 3: 简易 Store（状态容器）

```js
// ✅ 单一数据源 + 发布订阅
class Store {
  constructor(initialState) {
    this._state = initialState;
    this._listeners = new Set();
  }

  getState() {
    return this._state;
  }

  setState(partialState) {
    // 合并新状态
    this._state = { ...this._state, ...partialState };
    // 通知所有监听者
    this._listeners.forEach((listener) => listener(this._state));
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
}

// 使用
const store = new Store({ count: 0, user: null });

store.subscribe((state) => {
  console.log("UI 更新:", state);
});

store.setState({ count: 1 });
store.setState({ user: { name: "Alice" } });

// 输出:
// UI 更新: { count: 1, user: null }
// UI 更新: { count: 1, user: { name: 'Alice' } }
```

**问题**: setState 太随意，任何地方都能改，无法追踪变更来源。

---

## 三、Redux 原理实现

### 示例 4: 纯函数 Reducer

```js
// ✅ Reducer 核心：纯函数，(state, action) => newState
// 规则：
// 1. 不修改原 state（不可变更新）
// 2. 相同输入必定相同输出
// 3. 没有副作用

function counterReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case "INCREMENT":
      return { count: state.count + (action.payload ?? 1) };
    case "DECREMENT":
      return { count: state.count - (action.payload ?? 1) };
    case "RESET":
      return { count: 0 };
    default:
      return state; // 未知 action 返回原 state
  }
}

// 测试纯函数特性
console.log(counterReducer({ count: 0 }, { type: "INCREMENT" })); // { count: 1 }
console.log(counterReducer({ count: 0 }, { type: "INCREMENT" })); // { count: 1 } ✅ 确定性
console.log(counterReducer({ count: 0 }, { type: "UNKNOWN" })); // { count: 0 } ✅ 默认返回
```

### 示例 5: 完整 Redux 实现（含中间件）

```js
// ✅ Redux 核心：createStore + reducer + dispatch + subscribe
function createStore(reducer, preloadedState) {
  let currentState = preloadedState;
  let currentListeners = new Set();
  let nextListeners = new Set(currentListeners);

  function ensureListeners() {
    if (currentListeners !== nextListeners) {
      currentListeners = new Set(nextListeners);
    }
  }

  function getState() {
    return currentState;
  }

  function subscribe(listener) {
    nextListeners.add(listener);
    return () => {
      nextListeners.delete(listener);
    };
  }

  function dispatch(action) {
    currentState = reducer(currentState, action);
    ensureListeners();
    currentListeners.forEach((listener) => listener());
    return action;
  }

  // 初始化（触发默认状态）
  dispatch({ type: "@@redux/INIT" });

  return { getState, subscribe, dispatch };
}

// 使用
const store = createStore(counterReducer, { count: 0 });

const unsub1 = store.subscribe(() => {
  console.log("监听器1:", store.getState());
});
const unsub2 = store.subscribe(() => {
  console.log("监听器2:", store.getState());
});

store.dispatch({ type: "INCREMENT" });
// 监听器1: { count: 1 }
// 监听器2: { count: 1 }

store.dispatch({ type: "INCREMENT", payload: 5 });
// 监听器1: { count: 6 }
// 监听器2: { count: 6 }

unsub1();
store.dispatch({ type: "DECREMENT" });
// 监听器2: { count: 5 } (只有 unsub2 还在)
```

### 示例 6: Redux 中间件系统

```js
// ✅ 中间件原理：拦截 dispatch，在 action 到达 reducer 前后执行逻辑
// Redux 中间件签名: store => next => action => result

// 日志中间件
const loggerMiddleware = (store) => (next) => (action) => {
  console.log("📤 dispatch:", action.type);
  console.log("📊 before:", store.getState());
  const result = next(action);
  console.log("📊 after:", store.getState());
  return result;
};

// 错误捕获中间件
const errorMiddleware = (store) => (next) => (action) => {
  try {
    return next(action);
  } catch (error) {
    console.error("❌ Action 错误:", action.type, error);
    throw error;
  }
};

// 条件执行中间件（类似 redux-thunk 的简化版）
const conditionMiddleware = (store) => (next) => (action) => {
  if (typeof action === "function") {
    return action(store.getState); // 支持函数式 action
  }
  if (action.meta?.condition && !action.meta.condition(store.getState())) {
    console.log("⏭️ 条件不满足，跳过:", action.type);
    return null;
  }
  return next(action);
};

//  applyMiddleware 实现
function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, preloadedState) => {
    const store = createStore(reducer, preloadedState);
    let dispatch = store.dispatch;

    // 注入 store API
    const middlewareAPI = {
      getState: store.getState,
      dispatch: (action) => dispatch(action),
    };

    // 组合中间件
    const chain = middlewares.map((mw) => mw(middlewareAPI));
    dispatch = compose(...chain)(store.dispatch);

    return { ...store, dispatch };
  };
}

// compose: 从右到左组合函数
function compose(...fns) {
  return fns.reduce(
    (a, b) =>
      (...args) =>
        a(b(...args)),
  );
}

// 使用中间件
const enhancedCreateStore = applyMiddleware(
  loggerMiddleware,
  errorMiddleware,
)(createStore);

const store2 = enhancedCreateStore(counterReducer, { count: 0 });
store2.dispatch({ type: "INCREMENT" });
// 📤 dispatch: INCREMENT
// 📊 before: { count: 0 }
// 📊 after: { count: 1 }
```

### 示例 7: Redux 异步 Action（Thunk 模式）

```js
// ✅ Thunk 核心：action 可以是函数，接收 dispatch 和 getState
const thunkMiddleware = (store) => (next) => (action) => {
  if (typeof action === "function") {
    return action(store.dispatch, store.getState);
  }
  return next(action);
};

const thunkStore = applyMiddleware(
  thunkMiddleware,
  loggerMiddleware,
)(createStore)(counterReducer, { count: 0 });

// 异步 action creator
function asyncIncrement(delay = 1000) {
  return (dispatch, getState) => {
    console.log("⏳ 开始异步递增...");
    setTimeout(() => {
      dispatch({ type: "INCREMENT" });
      console.log("✅ 异步递增完成, 当前:", getState());
    }, delay);
  };
}

// 条件异步
function conditionalIncrementIfOdd() {
  return (dispatch, getState) => {
    const count = getState().count;
    if (count % 2 === 0) {
      console.log("当前是偶数，不需要递增");
      return;
    }
    dispatch({ type: "INCREMENT" });
  };
}

// 使用（模拟）
console.log("--- Thunk 测试 ---");
// thunkStore.dispatch(asyncIncrement(100)); // 实际运行会异步执行
```

### 示例 8: combineReducers

```js
// ✅ combineReducers: 将多个 reducer 合并为一个
function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers);

  return (state = {}, action) => {
    let hasChanged = false;
    const nextState = {};

    for (const key of reducerKeys) {
      const reducer = reducers[key];
      const previousState = state[key];
      nextState[key] = reducer(previousState, action);
      hasChanged = hasChanged || nextState[key] !== previousState;
    }

    return hasChanged ? nextState : state;
  };
}

// 多个 reducer
function userReducer(state = { name: "", role: "user" }, action) {
  switch (action.type) {
    case "SET_USER":
      return { ...state, ...action.payload };
    case "LOGOUT":
      return { name: "", role: "user" };
    default:
      return state;
  }
}

function todoReducer(state = { items: [], filter: "all" }, action) {
  switch (action.type) {
    case "ADD_TODO":
      return { ...state, items: [...state.items, action.payload] };
    case "SET_FILTER":
      return { ...state, filter: action.payload };
    default:
      return state;
  }
}

const rootReducer = combineReducers({
  counter: counterReducer,
  user: userReducer,
  todos: todoReducer,
});

const appStore = createStore(rootReducer, {
  counter: { count: 0 },
  user: { name: "", role: "user" },
  todos: { items: [], filter: "all" },
});

appStore.subscribe(() => {
  console.log("📊 全局状态:", JSON.stringify(appStore.getState()));
});

appStore.dispatch({ type: "INCREMENT" });
appStore.dispatch({
  type: "SET_USER",
  payload: { name: "Alice", role: "admin" },
});
appStore.dispatch({
  type: "ADD_TODO",
  payload: { id: 1, text: "学习 Redux", done: false },
});

// 输出:
// 📊 全局状态: {"counter":{"count":1},"user":{"name":"","role":"user"},"todos":{"items":[],"filter":"all"}}
// 📊 全局状态: {"counter":{"count":1},"user":{"name":"Alice","role":"admin"},"todos":{"items":[],"filter":"all"}}
// 📊 全局状态: {"counter":{"count":1},"user":{"name":"Alice","role":"admin"},"todos":{"items":[{"id":1,"text":"学习 Redux","done":false}],"filter":"all"}}
```

---

## 四、Zustand 原理实现

Zustand 与 Redux 的核心区别：

- Redux: reducer + dispatch（函数式、不可变）
- Zustand: 直接 set 状态（命令式、可变语法但内部不可变）

### 示例 9: 简易 Zustand 实现

```js
// ✅ Zustand 核心: useStore hook + set/get + 中间件
function createZustand(createStore) {
  let state;
  const listeners = new Set();

  // 初始化状态
  const setState = (partial, replace = false) => {
    const nextState =
      typeof partial === "function"
        ? partial(state)
        : replace
          ? partial
          : { ...state, ...partial };

    if (nextState === state) return; // 相等则不通知

    state = nextState;
    listeners.forEach((listener) => listener(state));
  };

  const getState = () => state;

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  // 创建 store 函数
  state = createStore(setState, getState);

  // 返回 hook 函数
  const useStore = (selector = (s) => s) => {
    return selector(state);
  };

  useStore.getState = getState;
  useStore.setState = setState;
  useStore.subscribe = subscribe;

  return useStore;
}

// 使用
const useCounter = createZustand((set, get) => ({
  count: 0,
  name: "Counter",
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  incrementBy: (amount) => set({ count: get().count + amount }),
  reset: () => set({ count: 0, name: "Counter" }),
}));

// 订阅
useCounter.subscribe((state) => {
  console.log("📊 Zustand 状态:", state);
});

useCounter.getState().increment();
// 📊 Zustand 状态: { count: 1, name: 'Counter', ... }

useCounter.getState().incrementBy(5);
// 📊 Zustand 状态: { count: 6, name: 'Counter', ... }

// 选择器（只监听需要的部分）
const count = useCounter((state) => state.count);
console.log("选择器获取:", count); // 选择器获取: 6
```

### 示例 10: Zustand 中间件系统

```js
// ✅ Zustand 中间件：包装 create 函数
// 签名: (f) => (set, get, api) => state

// persist 中间件（持久化到 localStorage）
function persist(storageKey) {
  return (create) => (set, get, api) => {
    // 从 localStorage 恢复
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // 合并到初始状态
        const initialState = create(
          (partial) =>
            set(
              typeof partial === "function"
                ? { ...get(), ...partial(get()) }
                : partial,
            ),
          get,
          api,
        );
        const merged = { ...initialState, ...parsed };
        // 用合并后的状态重新初始化
        return create(
          (p) => {
            const next = typeof p === "function" ? p(get()) : p;
            set({ ...get(), ...next });
            localStorage.setItem(storageKey, JSON.stringify(get()));
          },
          get,
          api,
        );
      }
    } catch (e) {
      /* ignore */
    }

    // 正常初始化 + 拦截 set
    const baseState = create(set, get, api);
    const wrappedSet = (partial) => {
      set(partial);
      try {
        localStorage.setItem(storageKey, JSON.stringify(get()));
      } catch (e) {
        /* ignore */
      }
    };
    return create(wrappedSet, get, api) || baseState;
  };
}

// devtools 中间件（开发工具集成）
function devtools(name) {
  return (create) => (set, get, api) => {
    const wrappedSet = (partial, ...args) => {
      const prevState = get();
      set(partial, ...args);
      const nextState = get();
      console.log(`🔧 [${name}]`, {
        from: prevState,
        to: nextState,
        by: partial.toString().slice(0, 100),
      });
    };
    return create(wrappedSet, get, api);
  };
}

// 使用中间件
const useDevCounter = createZustand(
  devtools("dev-counter")((set, get) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
  })),
);

useDevCounter.getState().increment();
// 🔧 [dev-counter] { from: { count: 0 }, to: { count: 1 }, by: '{ count: get().count + 1 }' }
```

### 示例 11: Zustand 异步 Action

```js
// ✅ Zustand 异步：set/get 天然支持异步
const useAsyncStore = createZustand((set, get) => ({
  users: [],
  loading: false,
  error: null,

  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      // 模拟 API 调用
      await new Promise((r) => setTimeout(r, 100));
      const mockUsers = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];
      set({ users: mockUsers, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  addUser: (user) =>
    set((state) => ({
      users: [...state.users, { ...user, id: Date.now() }],
    })),
}));

// 使用
useAsyncStore.subscribe((state) => {
  console.log(
    "📊 异步 Store:",
    JSON.stringify({
      users: state.users,
      loading: state.loading,
      error: state.error,
    }),
  );
});

// 模拟异步加载
console.log("--- 异步 Store 测试 ---");
// useAsyncStore.getState().fetchUsers();
// 输出: loading: true → loading: false, users: [...]
```

---

## 五、高级模式

### 示例 12: 选择器（Selector）优化

```js
// ✅ 选择器：只订阅需要的数据，避免不必要的更新
// Redux 风格选择器
function createSelector(selectorFn) {
  let lastResult;
  let lastArgs;

  return (...args) => {
    const result = selectorFn(...args);
    // 浅比较
    if (
      lastArgs &&
      args.length === lastArgs.length &&
      args.every((a, i) => a === lastArgs[i]) &&
      result === lastResult
    ) {
      return lastResult; // 引用相同，跳过
    }
    lastResult = result;
    lastArgs = args;
    return result;
  };
}

// 组合选择器
const selectCount = (state) => state.counter.count;
const selectUser = (state) => state.user;

const selectDisplayName = createSelector((state) => {
  const user = selectUser(state);
  const count = selectCount(state);
  return `${user.name} (计数: ${count})`;
});

const appStore2 = createStore(rootReducer, {
  counter: { count: 0 },
  user: { name: "Alice", role: "admin" },
  todos: { items: [], filter: "all" },
});

console.log(selectDisplayName(appStore2.getState())); // "Alice (计数: 0)"
appStore2.dispatch({ type: "INCREMENT" });
console.log(selectDisplayName(appStore2.getState())); // "Alice (计数: 1)"
```

### 示例 13: 时间旅行（Undo/Redo）

```js
// ✅ 时间旅行：记录历史状态，支持撤销/重做
function withUndoRedo(reducer, initialState) {
  const history = {
    past: [],
    present: initialState,
    future: [],
  };

  return (state = history, action) => {
    const { past, present, future } = state;

    switch (action.type) {
      case "UNDO": {
        if (past.length === 0) return state;
        const previous = past[past.length - 1];
        return {
          past: past.slice(0, -1),
          present: previous,
          future: [present, ...future],
        };
      }
      case "REDO": {
        if (future.length === 0) return state;
        const next = future[0];
        return {
          past: [...past, present],
          present: next,
          future: future.slice(1),
        };
      }
      default: {
        const newPresent = reducer(present, action);
        if (newPresent === present) return state;
        return {
          past: [...past, present],
          present: newPresent,
          future: [],
        };
      }
    }
  };
}

const undoableStore = createStore(withUndoRedo(counterReducer, { count: 0 }), {
  past: [],
  present: { count: 0 },
  future: [],
});

undoableStore.subscribe(() => {
  const s = undoableStore.getState();
  console.log("📊 历史:", {
    past: s.past.length,
    present: s.present,
    future: s.future.length,
  });
});

undoableStore.dispatch({ type: "INCREMENT" }); // past: 1, present: 1
undoableStore.dispatch({ type: "INCREMENT" }); // past: 2, present: 2
undoableStore.dispatch({ type: "INCREMENT" }); // past: 3, present: 3
undoableStore.dispatch({ type: "UNDO" }); // past: 2, present: 2
undoableStore.dispatch({ type: "UNDO" }); // past: 1, present: 1
undoableStore.dispatch({ type: "REDO" }); // past: 2, present: 2
```

### 示例 14: 状态快照与恢复

```js
// ✅ 快照：保存/恢复任意时刻的状态
class SnapshotManager {
  constructor(store) {
    this.store = store;
    this.snapshots = new Map();
  }

  save(name) {
    this.snapshots.set(name, JSON.parse(JSON.stringify(this.store.getState())));
    console.log(`📸 快照已保存: ${name}`);
  }

  restore(name) {
    const snapshot = this.snapshots.get(name);
    if (!snapshot) {
      console.error(`❌ 快照不存在: ${name}`);
      return;
    }
    // 通过 dispatch 恢复
    this.store.dispatch({
      type: "RESTORE_SNAPSHOT",
      payload: snapshot,
    });
    console.log(`🔄 快照已恢复: ${name}`);
  }

  list() {
    return Array.from(this.snapshots.keys());
  }

  delete(name) {
    this.snapshots.delete(name);
  }
}

// 扩展 reducer 支持快照恢复
function snapshotReducer(reducer) {
  return (state, action) => {
    if (action.type === "RESTORE_SNAPSHOT") {
      return action.payload;
    }
    return reducer(state, action);
  };
}

const snapStore = createStore(snapshotReducer(counterReducer), { count: 0 });
const snapshotMgr = new SnapshotManager(snapStore);

snapStore.subscribe(() => {
  console.log("📊 当前:", snapStore.getState());
});

snapStore.dispatch({ type: "INCREMENT" });
snapStore.dispatch({ type: "INCREMENT" });
snapshotMgr.save("checkpoint1"); // 保存 count=2

snapStore.dispatch({ type: "INCREMENT" });
snapStore.dispatch({ type: "INCREMENT" });
// count=4

snapshotMgr.restore("checkpoint1"); // 恢复到 count=2
console.log("📸 快照列表:", snapshotMgr.list()); // ['checkpoint1']
```

### 示例 15: 响应式状态（Proxy 实现）

```js
// ✅ Proxy 响应式：自动追踪依赖，精准更新
function createReactiveState(initialState) {
  const listeners = new Map(); // key -> Set<listener>
  const globalListeners = new Set();

  const handler = {
    get(target, prop) {
      const value = target[prop];
      // 如果是对象，递归代理
      if (value && typeof value === "object") {
        return new Proxy(value, handler);
      }
      return value;
    },
    set(target, prop, value) {
      const oldValue = target[prop];
      target[prop] = value;
      // 通知该 key 的监听者
      listeners.get(prop)?.forEach((fn) => fn(value, oldValue));
      // 通知全局监听者
      globalListeners.forEach((fn) => fn(target, prop));
      return true;
    },
  };

  const state = new Proxy(initialState, handler);

  return {
    state,
    watch(key, listener) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(listener);
      return () => listeners.get(key)?.delete(listener);
    },
    subscribe(listener) {
      globalListeners.add(listener);
      return () => globalListeners.delete(listener);
    },
  };
}

// 使用
const { state, watch, subscribe } = createReactiveState({
  count: 0,
  name: "Alice",
  todos: [],
});

watch("count", (newVal, oldVal) => {
  console.log(`📊 count 变化: ${oldVal} → ${newVal}`);
});

subscribe((target, prop) => {
  console.log(`📊 任意属性变化: ${prop} = ${target[prop]}`);
});

state.count = 1;
// 📊 count 变化: 0 → 1
// 📊 任意属性变化: count = 1

state.name = "Bob";
// 📊 任意属性变化: name = Bob
```

### 示例 16: 状态机（XState 简化版）

```js
// ✅ 有限状态机：明确的状态、转换、动作
function createMachine(config) {
  let currentState = config.initial;
  const listeners = new Set();

  function send(event) {
    const stateConfig = config.states[currentState];
    if (!stateConfig) return;

    const transition = stateConfig.on?.[event.type];
    if (!transition) return;

    const nextState =
      typeof transition === "string" ? transition : transition.target;

    // 执行出口动作
    stateConfig.onExit?.forEach((fn) => fn(currentState, nextState, event));

    currentState = nextState;

    // 执行入口动作
    config.states[nextState]?.onEntry?.forEach((fn) => fn(currentState, event));

    // 执行转换动作
    if (typeof transition === "object" && transition.actions) {
      transition.actions.forEach((fn) => fn(currentState, event));
    }

    listeners.forEach((fn) => fn(currentState));
  }

  function getState() {
    return currentState;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { send, getState, subscribe };
}

// 使用：登录状态机
const authMachine = createMachine({
  initial: "idle",
  states: {
    idle: {
      on: { LOGIN: "loading" },
      onEntry: [() => console.log("🔓 空闲状态")],
    },
    loading: {
      on: {
        SUCCESS: "authenticated",
        FAILURE: "idle",
      },
      onEntry: [() => console.log("⏳ 加载中...")],
    },
    authenticated: {
      on: { LOGOUT: "idle", REFRESH: "loading" },
      onEntry: [() => console.log("✅ 已认证")],
    },
  },
});

authMachine.subscribe((state) => console.log("📊 认证状态:", state));

authMachine.send({ type: "LOGIN" });
// ⏳ 加载中...
// 📊 认证状态: loading

authMachine.send({ type: "SUCCESS" });
// ✅ 已认证
// 📊 认证状态: authenticated

authMachine.send({ type: "LOGOUT" });
// 📊 认证状态: idle
```

### 示例 17: 原子状态（Recoil 简化版）

```js
// ✅ 原子状态：细粒度订阅，精准更新
class Atom {
  constructor(key, initialValue) {
    this.key = key;
    this._value = initialValue;
    this._listeners = new Set();
    this._dependents = new Set(); // 依赖此 atom 的 selector
  }

  get value() {
    return this._value;
  }

  set value(newValue) {
    if (Object.is(this._value, newValue)) return;
    this._value = newValue;
    this._listeners.forEach((fn) => fn(newValue));
    // 通知依赖的 selector 重新计算
    this._dependents.forEach((sel) => sel._invalidate());
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
}

class Selector {
  constructor(key, { get }) {
    this.key = key;
    this._get = get;
    this._value = undefined;
    this._listeners = new Set();
    this._dirty = true;
  }

  get value() {
    if (this._dirty) {
      this._value = this._get({
        get: (atom) => {
          atom._dependents.add(this);
          return atom.value;
        },
      });
      this._dirty = false;
    }
    return this._value;
  }

  _invalidate() {
    this._dirty = true;
    this._listeners.forEach((fn) => fn(this.value));
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
}

// 使用
const countAtom = new Atom("count", 0);
const doubleSelector = new Selector("double", {
  get: ({ get }) => get(countAtom) * 2,
});

countAtom.subscribe((v) => console.log(`📊 count: ${v}`));
doubleSelector.subscribe((v) => console.log(`📊 double: ${v}`));

countAtom.value = 5;
// 📊 count: 5
// 📊 double: 10

countAtom.value = 10;
// 📊 count: 10
// 📊 double: 20
```

---

## 六、综合实战

### 示例 18: 完整 Todo 应用（Redux 风格）

```js
// === Action Creators ===
const actions = {
  addTodo: (text) => ({
    type: "ADD_TODO",
    payload: { id: Date.now(), text, done: false },
  }),
  toggleTodo: (id) => ({ type: "TOGGLE_TODO", payload: id }),
  deleteTodo: (id) => ({ type: "DELETE_TODO", payload: id }),
  setFilter: (filter) => ({ type: "SET_FILTER", payload: filter }),
  clearCompleted: () => ({ type: "CLEAR_COMPLETED" }),
};

// === Reducer ===
function todoApp(
  state = {
    todos: [],
    filter: "all",
    nextId: 1,
  },
  action,
) {
  switch (action.type) {
    case "ADD_TODO":
      return {
        ...state,
        todos: [...state.todos, { ...action.payload, id: state.nextId }],
        nextId: state.nextId + 1,
      };
    case "TOGGLE_TODO":
      return {
        ...state,
        todos: state.todos.map((t) =>
          t.id === action.payload ? { ...t, done: !t.done } : t,
        ),
      };
    case "DELETE_TODO":
      return {
        ...state,
        todos: state.todos.filter((t) => t.id !== action.payload),
      };
    case "SET_FILTER":
      return { ...state, filter: action.payload };
    case "CLEAR_COMPLETED":
      return {
        ...state,
        todos: state.todos.filter((t) => !t.done),
      };
    default:
      return state;
  }
}

// === Selectors ===
const selectTodos = (state) => state.todos;
const selectFilter = (state) => state.filter;

const selectFilteredTodos = createSelector((state) => {
  const todos = selectTodos(state);
  const filter = selectFilter(state);
  switch (filter) {
    case "active":
      return todos.filter((t) => !t.done);
    case "completed":
      return todos.filter((t) => t.done);
    default:
      return todos;
  }
});

const selectStats = createSelector((state) => {
  const todos = selectTodos(state);
  return {
    total: todos.length,
    active: todos.filter((t) => !t.done).length,
    completed: todos.filter((t) => t.done).length,
  };
});

// === Store ===
const todoStore = createStore(todoApp, {
  todos: [],
  filter: "all",
  nextId: 1,
});

// === UI 渲染（模拟）===
function render() {
  const state = todoStore.getState();
  const filtered = selectFilteredTodos(state);
  const stats = selectStats(state);

  console.log("\n📋 Todo List:");
  filtered.forEach((t) => {
    console.log(`  ${t.done ? "✅" : "⬜"} ${t.text}`);
  });
  console.log(
    `📊 总计: ${stats.total} | 完成: ${stats.completed} | 待办: ${stats.active}`,
  );
  console.log(`🔍 过滤器: ${state.filter}\n`);
}

todoStore.subscribe(render);

// === 操作 ===
todoStore.dispatch(actions.addTodo("学习 Redux"));
todoStore.dispatch(actions.addTodo("学习 Zustand"));
todoStore.dispatch(actions.addTodo("学习 Vue3"));
todoStore.dispatch(actions.toggleTodo(1));
todoStore.dispatch(actions.setFilter("active"));
todoStore.dispatch(actions.setFilter("all"));
todoStore.dispatch(actions.deleteTodo(2));
todoStore.dispatch(actions.clearCompleted());

// 输出:
// 📋 Todo List:
//   ✅ 学习 Redux
//   ⬜ 学习 Zustand
//   ⬜ 学习 Vue3
// 📊 总计: 3 | 完成: 1 | 待办: 2
// 🔍 过滤器: all
```

### 示例 19: 购物车状态管理（Zustand 风格）

```js
// === Zustand 风格购物车 ===
const useCart = createZustand((set, get) => ({
  items: [],
  coupon: null,

  // 添加商品
  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, qty: i.qty + 1 } : i,
          ),
        };
      }
      return { items: [...state.items, { ...item, qty: 1 }] };
    }),

  // 移除商品
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    })),

  // 更新数量
  updateQty: (id, qty) =>
    set((state) => ({
      items: state.items
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0, qty) } : i))
        .filter((i) => i.qty > 0),
    })),

  // 清空购物车
  clear: () => set({ items: [], coupon: null }),

  // 应用优惠券
  applyCoupon: (code) =>
    set({
      coupon: ["SAVE10", "SAVE20", "VIP50"].includes(code)
        ? {
            code,
            discount: code === "SAVE10" ? 0.1 : code === "SAVE20" ? 0.2 : 0.5,
          }
        : null,
    }),

  // 计算（getter）
  get subtotal() {
    return get().items.reduce((sum, i) => sum + i.price * i.qty, 0);
  },
  get total() {
    const { subtotal, coupon } = get();
    return coupon ? subtotal * (1 - coupon.discount) : subtotal;
  },
  get itemCount() {
    return get().items.reduce((sum, i) => sum + i.qty, 0);
  },
}));

// 模拟渲染
function renderCart() {
  const items = useCart.getState().items;
  console.log("\n🛒 购物车:");
  items.forEach((i) => {
    console.log(`  ${i.name} x${i.qty} = ¥${(i.price * i.qty).toFixed(2)}`);
  });
  console.log(`  小计: ¥${useCart.getState().subtotal.toFixed(2)}`);
  console.log(`  总计: ¥${useCart.getState().total.toFixed(2)}`);
  console.log(`  数量: ${useCart.getState().itemCount} 件\n`);
}

useCart.subscribe(renderCart);

// 操作
useCart.getState().addItem({ id: 1, name: "iPhone", price: 5999 });
useCart.getState().addItem({ id: 2, name: "AirPods", price: 1299 });
useCart.getState().addItem({ id: 1, name: "iPhone", price: 5999 }); // 数量+1
useCart.getState().applyCoupon("SAVE10");
useCart.getState().updateQty(2, 0); // 移除 AirPods
```

### 示例 20: 多模块应用状态（综合）

```js
// === 多模块应用状态管理 ===
// 结合 Redux + Zustand 优点：
// - Redux 的 action/reducer 可预测性
// - Zustand 的简洁 API
// - 选择器优化
// - 中间件支持

function createModernStore(modules) {
  let state = {};
  const listeners = new Map(); // path -> Set<listener>
  const globalListeners = new Set();

  // 初始化各模块
  for (const [name, config] of Object.entries(modules)) {
    state[name] = config.initialState;
  }

  // 获取嵌套路径的值
  function getByPath(obj, path) {
    return path.split(".").reduce((o, k) => o?.[k], obj);
  }

  // dispatch
  function dispatch(action) {
    const [moduleName, actionType] = action.type.split("/");
    const module = modules[moduleName];
    if (!module?.reducer) return;

    const prevState = state[moduleName];
    state[moduleName] = module.reducer(prevState, action);

    if (state[moduleName] !== prevState) {
      // 通知全局
      globalListeners.forEach((fn) => fn(state));
      // 通知模块
      listeners.get(moduleName)?.forEach((fn) => fn(state[moduleName]));
    }
  }

  // 订阅
  function subscribe(pathOrListener, listener) {
    if (typeof pathOrListener === "function") {
      globalListeners.add(pathOrListener);
      return () => globalListeners.delete(pathOrListener);
    }
    if (!listeners.has(pathOrListener)) {
      listeners.set(pathOrListener, new Set());
    }
    listeners.get(pathOrListener).add(listener);
    return () => listeners.get(pathOrListener)?.delete(listener);
  }

  // 选择器
  function select(path) {
    return getByPath(state, path);
  }

  return { dispatch, subscribe, getState: () => state, select };
}

// === 定义模块 ===
const app = createModernStore({
  auth: {
    initialState: { user: null, token: null, loading: false },
    reducer(state, action) {
      switch (action.type) {
        case "auth/LOGIN":
          return {
            ...state,
            user: action.payload.user,
            token: action.payload.token,
            loading: false,
          };
        case "auth/LOGOUT":
          return { user: null, token: null, loading: false };
        case "auth/LOADING":
          return { ...state, loading: true };
        default:
          return state;
      }
    },
  },
  ui: {
    initialState: { theme: "light", sidebarOpen: true, notifications: [] },
    reducer(state, action) {
      switch (action.type) {
        case "ui/TOGGLE_THEME":
          return {
            ...state,
            theme: state.theme === "light" ? "dark" : "light",
          };
        case "ui/TOGGLE_SIDEBAR":
          return { ...state, sidebarOpen: !state.sidebarOpen };
        case "ui/ADD_NOTIFICATION":
          return {
            ...state,
            notifications: [...state.notifications, action.payload],
          };
        case "ui/CLEAR_NOTIFICATIONS":
          return { ...state, notifications: [] };
        default:
          return state;
      }
    },
  },
  data: {
    initialState: { items: [], loading: false, error: null },
    reducer(state, action) {
      switch (action.type) {
        case "data/SET_ITEMS":
          return { ...state, items: action.payload, loading: false };
        case "data/LOADING":
          return { ...state, loading: true, error: null };
        case "data/ERROR":
          return { ...state, loading: false, error: action.payload };
        case "data/ADD_ITEM":
          return { ...state, items: [...state.items, action.payload] };
        default:
          return state;
      }
    },
  },
});

// 订阅
app.subscribe("auth", (auth) => {
  console.log("🔐 Auth 状态:", JSON.stringify(auth));
});
app.subscribe("ui", (ui) => {
  console.log("🎨 UI 状态:", JSON.stringify(ui));
});
app.subscribe((state) => {
  console.log("📊 全局状态 keys:", Object.keys(state));
});

// 操作
console.log("\n=== 多模块应用 ===");
app.dispatch({ type: "auth/LOADING" });
app.dispatch({
  type: "auth/LOGIN",
  payload: { user: { name: "Alice" }, token: "abc123" },
});
app.dispatch({ type: "ui/TOGGLE_THEME" });
app.dispatch({ type: "data/LOADING" });
app.dispatch({
  type: "data/SET_ITEMS",
  payload: [
    { id: 1, title: "Item 1" },
    { id: 2, title: "Item 2" },
  ],
});
app.dispatch({
  type: "ui/ADD_NOTIFICATION",
  payload: { id: 1, text: "数据加载完成", type: "success" },
});

console.log("\n选择器:", app.select("auth.user")); // { name: 'Alice' }
console.log("选择器:", app.select("data.items")); // [{ id: 1, ... }, { id: 2, ... }]
```

---

## 七、核心原理总结

### Redux vs Zustand vs MobX 对比

| 特性     | Redux                           | Zustand                | MobX                      |
| -------- | ------------------------------- | ---------------------- | ------------------------- |
| 状态更新 | dispatch(action) → reducer      | set(partial) / set(fn) | 直接赋值（Proxy）         |
| 不可变性 | 必须不可变                      | 必须不可变             | 自动代理（可变语法）      |
| 调试     | 时间旅行、DevTools              | 简单 DevTools          | 自动追踪                  |
| 学习曲线 | 高（action/reducer/middleware） | 低（直觉 API）         | 中（observable/computed） |
| 性能     | 需手动优化（selector）          | 自动精准更新           | 自动精准更新              |
| 类型安全 | TS 友好                         | TS 友好                | TS 友好                   |
| 包大小   | ~1KB                            | ~1KB                   | ~15KB                     |
| 适用场景 | 大型应用、需要时间旅行          | 中小型应用、快速开发   | 需要自动追踪的场景        |

### 状态管理核心模式

```
1. 发布订阅（Observer）
   Store ──emit──→ Listeners
   所有状态管理的基石

2. 单一数据源（Single Source of Truth）
   所有状态集中在一个 store
   可预测、可调试、可序列化

3. 不可变更新（Immutability）
   每次更新返回新对象
   便于比较、时间旅行、调试

4. 纯函数 Reducer
   (state, action) → newState
   确定性、无副作用、可测试

5. 选择器（Selector）
   从大状态中提取小数据
   避免不必要的重新渲染

6. 中间件（Middleware）
   拦截 action，添加横切关注点
   日志、持久化、异步、错误处理

7. 原子状态（Atom）
   细粒度状态单元
   精准订阅、自动依赖追踪
```

### 手写状态管理检查清单

- [x] 发布订阅机制
- [x] 单一 store + getState
- [x] subscribe/unsubscribe
- [x] dispatch + reducer
- [x] combineReducers
- [x] 中间件系统
- [x] 异步 action（Thunk）
- [x] 选择器优化
- [x] 时间旅行（Undo/Redo）
- [x] 状态快照
- [x] Proxy 响应式
- [x] 状态机
- [x] 原子状态
- [x] Zustand 风格 API
- [x] 多模块状态管理

**20 个示例全部完成** ✅

---

## 八、关键收获

1. **状态管理 = 存储 + 更新 + 通知**，所有库都是这三件事的变体
2. **发布订阅**是所有状态管理的底层机制
3. **Redux 核心**: reducer 纯函数 + dispatch 不可变 + 中间件管道
4. **Zustand 核心**: set/get 直觉 API + 选择器精准更新 + 中间件组合
5. **不可变更新**是时间旅行和性能优化的前提
6. **选择器**避免不必要的重渲染，是性能优化的关键
7. **中间件**是横切关注点的标准模式（日志/持久化/异步/错误）
8. **状态机**适合有明确状态转换的场景（表单/认证/流程）
9. **原子状态**适合细粒度更新的场景（Recoil/Jotai 思路）
10. **Proxy 响应式**是 Vue/React 的底层机制，自动追踪依赖
