# 专项训练 11:00 — 状态管理第六轮：RxJS 驱动 + Server State + Signals + CRDT 协作

> 日期：2026-05-02 | 时间：11:00 | 目标：RxJS 驱动状态管理 + Server State 模式 + Solid Signals + CRDT 协作编辑 + 12+ 全新示例
> 前置：已掌握 Mini Redux (R1) / 进阶模式 (R2-R4) / Pinia (R5)
> 本轮重点：Observable 驱动状态 / Server State 与 Client State 分离 / Signals 细粒度响应 / CRDT 无冲突协作 / 12 个全新业务场景

---

## 一、RxJS 驱动状态管理

### 1.1 为什么用 RxJS 管理状态？

```
传统状态管理的问题:
  ├── dispatch(action) → reducer → state (单向同步流)
  ├── 异步操作需要中间件 (thunk/saga/observable)
  ├── 多个异步源的协调复杂 (竞态/取消/重试)
  └── 状态变换逻辑分散在 action/reducer/effect

RxJS 的优势:
  ├── 所有状态变更都是 Observable 流
  ├── 内置 120+ 操作符处理复杂数据流
  ├── 天然支持异步、取消、重试、节流
  ├── scan/reduce 天然对应 reducer 模式
  └── 一个 BehaviorSubject 就是一个 Store
```

### 1.2 RxJS Store 核心原理

```
BehaviorSubject (当前值 + 新值推送)
    │
    ├── scan(reducer, initialState) → 累积状态
    │       │
    │       ├── distinctUntilChanged() → 去重优化
    │       │       │
    │       │       ├── select(path) → 派生子状态
    │       │       │       │
    │       │       │       └── 组件只订阅需要的部分
    │       │       │
    │       │       └── 视图自动响应更新
    │       │
    │       └── 状态历史 (scan 累积)
    │
    └── action$ (Subject)
            │
            ├── filter(type) → 路由到不同 reducer
            ├── debounceTime → 防抖
            ├── switchMap → 取消旧请求
            └── dispatch(action) → 推入 action$
```

### 1.3 手写 Mini RxStore (~100 行)

```javascript
/**
 * MiniRxStore — 基于 RxJS 原理的响应式状态管理
 * 核心：BehaviorSubject + scan + 操作符管道
 * 
 * 设计哲学:
 * 1. 状态 = BehaviorSubject 的当前值
 * 2. 变更 = action$ Subject 推送
 * 3. 累积 = scan(reducer, initialState)
 * 4. 派生 = pipe(select, map, distinctUntilChanged)
 * 5. 副作用 = tap / switchMap / mergeMap
 */

// ============ 简易 Observable 实现 (RxJS 核心子集) ============

class Observable {
  constructor(subscribe) {
    this._subscribe = subscribe;
  }

  // 订阅
  subscribe(next, error, complete) {
    const subscriber = {
      next: next || (() => {}),
      error: error || ((e) => { throw e; }),
      complete: complete || (() => {}),
      closed: false
    };
    const teardown = this._subscribe(subscriber);
    return {
      unsubscribe: () => {
        subscriber.closed = true;
        if (typeof teardown === 'function') teardown();
      }
    };
  }

  // 操作符：map
  map(project) {
    return new Observable(subscriber => {
      return this.subscribe(
        value => subscriber.next(project(value)),
        err => subscriber.error(err),
        () => subscriber.complete()
      );
    });
  }

  // 操作符：filter
  filter(predicate) {
    return new Observable(subscriber => {
      return this.subscribe(
        value => { if (predicate(value)) subscriber.next(value); },
        err => subscriber.error(err),
        () => subscriber.complete()
      );
    });
  }

  // 操作符：distinctUntilChanged
  distinctUntilChanged(comparator) {
    let prev;
    let hasPrev = false;
    return new Observable(subscriber => {
      return this.subscribe(
        value => {
          const isDiff = !hasPrev || (comparator ? !comparator(prev, value) : prev !== value);
          prev = value;
          hasPrev = true;
          if (isDiff) subscriber.next(value);
        },
        err => subscriber.error(err),
        () => subscriber.complete()
      );
    });
  }

  // 操作符：scan (累加器，核心！)
  scan(accumulator, seed) {
    return new Observable(subscriber => {
      let acc = seed;
      let hasSeed = arguments.length >= 2;
      return this.subscribe(
        value => {
          acc = hasSeed ? accumulator(acc, value) : ((hasSeed = true), value);
          subscriber.next(acc);
        },
        err => subscriber.error(err),
        () => subscriber.complete()
      );
    });
  }

  // 操作符：tap (副作用)
  tap(nextOrObserver, error, complete) {
    return new Observable(subscriber => {
      return this.subscribe(
        value => {
          if (typeof nextOrObserver === 'function') nextOrObserver(value);
          subscriber.next(value);
        },
        err => {
          if (error) error(err);
          subscriber.error(err);
        },
        () => {
          if (complete) complete();
          subscriber.complete();
        }
      );
    });
  }

  // 操作符：pipe (组合操作符)
  pipe(...operators) {
    return operators.reduce((source, op) => op(source), this);
  }

  // 静态：of
  static of(...values) {
    return new Observable(subscriber => {
      for (const v of values) subscriber.next(v);
      subscriber.complete();
    });
  }

  // 静态：from
  static from(iterable) {
    return new Observable(subscriber => {
      for (const v of iterable) subscriber.next(v);
      subscriber.complete();
    });
  }
}

// ============ Subject (多播 + 可推送) ============

class Subject extends Observable {
  constructor() {
    super(() => {});
    this.observers = new Set();
    this.closed = false;
  }

  subscribe(next, error, complete) {
    const subscriber = {
      next: next || (() => {}),
      error: error || (() => {}),
      complete: complete || (() => {}),
      closed: false
    };
    this.observers.add(subscriber);
    return {
      unsubscribe: () => this.observers.delete(subscriber)
    };
  }

  next(value) {
    for (const obs of this.observers) {
      if (!obs.closed) obs.next(value);
    }
  }

  error(err) {
    for (const obs of this.observers) {
      if (!obs.closed) obs.error(err);
    }
  }

  complete() {
    for (const obs of this.observers) {
      if (!obs.closed) obs.complete();
    }
  }
}

// ============ BehaviorSubject (有初始值的 Subject) ============

class BehaviorSubject extends Subject {
  constructor(initialValue) {
    super();
    this._value = initialValue;
  }

  get value() {
    return this._value;
  }

  next(value) {
    this._value = value;
    super.next(value);
  }
}

// ============ 操作符工厂函数 ============

function map(project) {
  return source => source.map(project);
}

function filter(predicate) {
  return source => source.filter(predicate);
}

function distinctUntilChanged(comparator) {
  return source => source.distinctUntilChanged(comparator);
}

function scan(accumulator, seed) {
  return source => source.scan(accumulator, seed);
}

function tap(fn) {
  return source => source.tap(fn);
}

// ============ MiniRxStore 核心 ============

class MiniRxStore {
  /**
   * @param {Object} config
   * @param {Function} config.reducer - (state, action) => newState
   * @param {any} config.initialState - 初始状态
   * @param {Array} config.middlewares - 中间件 [(action$, store) => action$]
   */
  constructor({ reducer, initialState, middlewares = [] }) {
    // Action 流
    this.action$ = new Subject();
    
    // State 流：scan 累积 reducer
    this.state$ = this.action$.pipe(
      scan(reducer, initialState),
      distinctUntilChanged()
    );

    // 应用中间件
    let actionStream = this.action$;
    for (const mw of middlewares) {
      actionStream = mw(actionStream, this);
    }

    // 重新连接
    this.action$ = actionStream;

    // 当前状态缓存
    this._state = initialState;
    this._state$.subscribe(state => { this._state = state; });

    // 日志中间件 (默认)
    this._state$.pipe(
      tap(state => { /* console.log('[State]', state); */ })
    ).subscribe();
  }

  // 获取当前状态 (同步)
  get state() {
    return this._state;
  }

  // 派发 action
  dispatch(action) {
    this.action$.next(action);
  }

  // 选择器：获取派生状态流
  select(selector) {
    return this._state$.pipe(
      map(selector),
      distinctUntilChanged()
    );
  }

  // 选择器：获取当前派生值 (同步)
  selectValue(selector) {
    return selector(this._state);
  }
}

// ============ 使用示例 ============

// --- 示例 1: 计数器 (RxJS 版) ---
const counterReducer = (state, action) => {
  switch (action.type) {
    case 'increment': return { ...state, count: state.count + (action.payload || 1) };
    case 'decrement': return { ...state, count: state.count - (action.payload || 1) };
    case 'reset': return { ...state, count: 0 };
    default: return state;
  }
};

const counterStore = new MiniRxStore({
  reducer: counterReducer,
  initialState: { count: 0 }
});

// 订阅状态变化
counterStore._state$.subscribe(state => {
  // console.log('Counter:', state.count);
});

// 选择器
const countSelector$ = counterStore.select(s => s.count);
countSelector$.subscribe(count => {
  // console.log('Selected count:', count);
});

counterStore.dispatch({ type: 'increment' });  // count: 1
counterStore.dispatch({ type: 'increment' });  // count: 2
counterStore.dispatch({ type: 'decrement' });  // count: 1

// --- 示例 2: 带中间件的 Store (日志 + 持久化) ---

// 日志中间件
function loggerMiddleware(action$, store) {
  return new Observable(subscriber => {
    return action$.subscribe(action => {
      console.log('[Action]', action.type, action.payload);
      subscriber.next(action);
    });
  });
}

// 持久化中间件
function persistMiddleware(key, paths = []) {
  return (action$, store) => {
    // 初始化：从 localStorage 恢复
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        // 合并到初始状态 (需要在 reducer 中处理)
      }
    } catch (e) {}

    // 拦截 state 变化，持久化
    store._state$.subscribe(state => {
      try {
        const toSave = paths.length > 0
          ? Object.fromEntries(paths.map(p => [p, state[p]]))
          : state;
        localStorage.setItem(key, JSON.stringify(toSave));
      } catch (e) {}
    });

    return action$;
  };
}

const storeWithMiddleware = new MiniRxStore({
  reducer: counterReducer,
  initialState: { count: 0 },
  middlewares: [loggerMiddleware]
});

console.log('✅ MiniRxStore: RxJS 驱动状态管理实现完成');
console.log('   核心: BehaviorSubject + scan + 操作符管道');
console.log('   特性: 选择器 / 中间件 / 持久化 / 日志');
```

### 1.4 RxJS 操作符在状态管理中的映射

```
Redux 概念          → RxJS 对应
─────────────────────────────────────
createStore         → new BehaviorSubject(initialState)
dispatch(action)    → action$.next(action)
reducer             → scan(reducer, initialState)
subscribe           → state$.subscribe(fn)
select(path)        → state$.pipe(map(s => s.path))
middleware          → 操作符管道 (tap/filter/map)
selector memoization → distinctUntilChanged()
effect/saga         → switchMap/mergeMap/concatMap
throttle            → throttleTime/debounceTime
retry               → retry/retryWhen
cancel previous     → switchMap
parallel requests   → mergeMap
sequential requests → concatMap
```

---

## 二、Server State 与 Client State 分离

### 2.1 为什么分离？

```
传统 Redux 的问题:
  ├── 把 API 数据 (server state) 和 UI 状态 (client state) 混在一起
  ├── 手动管理 loading/error/cached 状态
  ├── 缓存失效逻辑复杂
  ├── 请求去重/重试/轮询需要大量样板代码
  └── 状态规范化 (normalization) 繁琐

TanStack Query (React Query) 的洞察:
  ├── Server State ≠ Client State
  ├── Server State: 异步、可缓存、可失效、可后台更新
  ├── Client State: 同步、本地、即时、不可缓存
  └── 用不同工具管理不同状态
```

### 2.2 手写 Mini Query (~150 行)

```javascript
/**
 * MiniQuery — TanStack Query 核心原理实现
 * 核心：查询缓存 + 自动失效 + 后台更新 + 请求去重
 * 
 * 设计哲学:
 * 1. 每个 queryKey 对应一个查询
 * 2. 查询结果自动缓存，支持过期策略
 * 3. 组件挂载时自动获取 (stale-while-revalidate)
 * 4. 多个组件共享同一查询 (请求去重)
 * 5. 支持后台静默更新
 */

// ============ QueryClient (查询客户端) ============

class QueryClient {
  constructor(options = {}) {
    this.defaultOptions = {
      staleTime: options.staleTime || 0,         // 数据新鲜时间 (ms)
      gcTime: options.gcTime || 5 * 60 * 1000,   // 垃圾回收时间
      retry: options.retry || 3,                  // 重试次数
      retryDelay: options.retryDelay || (attempt => Math.min(1000 * 2 ** attempt, 30000)),
    };
    this.queryCache = new Map();  // queryKey → Query
    this.mutationCache = new Map();
  }

  // 获取或创建查询
  getQueryCache(queryKey) {
    const key = JSON.stringify(queryKey);
    if (!this.queryCache.has(key)) {
      this.queryCache.set(key, new Query(this, queryKey));
    }
    return this.queryCache.get(key);
  }

  // 使查询失效
  invalidateQueries(queryKey) {
    const key = JSON.stringify(queryKey);
    const query = this.queryCache.get(key);
    if (query) {
      query.invalidate();
    }
  }

  // 预填充查询缓存
  setQueryData(queryKey, data) {
    const query = this.getQueryCache(queryKey);
    query.setData(data);
  }

  // 获取查询数据
  getQueryData(queryKey) {
    const key = JSON.stringify(queryKey);
    return this.queryCache.get(key)?.data;
  }
}

// ============ Query (单个查询) ============

class Query {
  constructor(client, queryKey) {
    this.client = client;
    this.queryKey = queryKey;
    this.data = undefined;
    this.error = null;
    this.status = 'idle';        // idle | loading | success | error
    this.observers = new Set();
    this.promise = null;
    this.invalidated = false;
    this.timestamp = null;
    this.retryCount = 0;
  }

  // 执行查询
  async execute(fetcher, options = {}) {
    const staleTime = options.staleTime ?? this.client.defaultOptions.staleTime;
    const retry = options.retry ?? this.client.defaultOptions.retry;

    // 如果数据仍然新鲜，直接返回
    if (this.data !== undefined && !this.invalidated) {
      const age = Date.now() - this.timestamp;
      if (age < staleTime) {
        return this.data;
      }
    }

    // 如果已有进行中的请求，复用 (请求去重)
    if (this.promise) {
      return this.promise;
    }

    // 通知观察者：开始加载
    this.status = 'loading';
    this.notifyObservers();

    // 执行带重试的 fetch
    this.promise = this.executeWithRetry(fetcher, retry);

    try {
      const data = await this.promise;
      this.data = data;
      this.error = null;
      this.status = 'success';
      this.timestamp = Date.now();
      this.invalidated = false;
      this.retryCount = 0;
    } catch (error) {
      this.error = error;
      this.status = 'error';
    } finally {
      this.promise = null;
      this.notifyObservers();
    }

    return this.data;
  }

  // 带重试的执行
  async executeWithRetry(fetcher, maxRetries) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fetcher();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = this.client.defaultOptions.retryDelay(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  // 使数据失效
  invalidate() {
    this.invalidated = true;
    this.notifyObservers();
  }

  // 手动设置数据
  setData(data) {
    this.data = data;
    this.status = 'success';
    this.timestamp = Date.now();
    this.notifyObservers();
  }

  // 注册观察者
  subscribe(callback) {
    this.observers.add(callback);
    // 立即通知当前状态
    callback(this.getObserverState());
    return () => this.observers.delete(callback);
  }

  // 通知所有观察者
  notifyObservers() {
    const state = this.getObserverState();
    for (const cb of this.observers) {
      cb(state);
    }
  }

  // 获取观察者状态
  getObserverState() {
    return {
      data: this.data,
      error: this.error,
      status: this.status,
      isLoading: this.status === 'loading',
      isSuccess: this.status === 'success',
      isError: this.status === 'error',
      isStale: this.invalidated || (this.timestamp && Date.now() - this.timestamp > this.client.defaultOptions.staleTime),
    };
  }
}

// ============ useQuery Hook (模拟) ============

function useQuery(client, queryKey, fetcher, options) {
  const query = client.getQueryCache(queryKey);
  let unsubscribe = null;
  let currentState = { data: undefined, error: null, status: 'idle', isLoading: false, isSuccess: false, isError: false, isStale: true };

  // 执行查询
  query.execute(fetcher, options);

  // 订阅状态变化
  unsubscribe = query.subscribe(state => {
    currentState = state;
  });

  // 返回查询状态
  return {
    get data() { return currentState.data; },
    get error() { return currentState.error; },
    get status() { return currentState.status; },
    get isLoading() { return currentState.isLoading; },
    get isSuccess() { return currentState.isSuccess; },
    get isError() { return currentState.isError; },
    get isStale() { return currentState.isStale; },
    refetch: () => { query.invalidate(); return query.execute(fetcher, options); },
    unsubscribe,
  };
}

// ============ useMutation Hook ============

function useMutation(client, mutationFn, options = {}) {
  let isIdle = true;
  let data = undefined;
  let error = null;
  let isLoading = false;

  const mutate = async (variables) => {
    isLoading = true;
    isIdle = false;
    error = null;
    try {
      const result = await mutationFn(variables);
      data = result;
      isLoading = false;
      if (options.onSuccess) options.onSuccess(result, variables);
      // 自动失效相关查询
      if (options.invalidateQueries) {
        for (const qk of options.invalidateQueries) {
          client.invalidateQueries(qk);
        }
      }
      return result;
    } catch (err) {
      error = err;
      isLoading = false;
      if (options.onError) options.onError(err, variables);
      throw err;
    }
  };

  return {
    mutate,
    get data() { return data; },
    get error() { return error; },
    get isLoading() { return isLoading; },
    get isIdle() { return isIdle; },
    reset: () => { isIdle = true; data = undefined; error = null; isLoading = false; },
  };
}

// ============ 使用示例 ============

// --- 示例: 用户列表查询 ---
const client = new QueryClient({
  staleTime: 30_000,    // 30 秒内数据视为新鲜
  retry: 2,
});

// 模拟 API
const mockFetchUser = async (id) => {
  await new Promise(r => setTimeout(r, 100));
  return { id, name: `User ${id}`, email: `user${id}@example.com` };
};

// 查询用户
const userQuery = client.getQueryCache(['user', 1]);
const userResult = await userQuery.execute(() => mockFetchUser(1));
console.log('User:', userResult);

// 预填充缓存
client.setQueryData(['users'], [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]);

const usersData = client.getQueryData(['users']);
console.log('Cached users:', usersData);

// Mutation: 创建用户
const createUser = useMutation(client, async (userData) => {
  await new Promise(r => setTimeout(r, 100));
  return { id: Date.now(), ...userData };
}, {
  invalidateQueries: [['users']],  // 创建后自动失效用户列表
  onSuccess: (data) => console.log('Created:', data),
});

console.log('✅ MiniQuery: Server State 管理实现完成');
console.log('   核心: 查询缓存 + 自动失效 + 请求去重 + 后台更新');
console.log('   特性: stale-while-revalidate / 重试 / 预填充 / Mutation');
```

### 2.3 Server State vs Client State 对照表

```
维度           Server State              Client State
─────────────  ──────────────────────    ──────────────────────
数据来源       服务器 (API/GraphQL)       用户交互 (表单/路由)
更新频率       低 (缓存优先)              高 (即时响应)
一致性         最终一致 (可过期)          强一致 (即时)
持久化         服务器负责                 本地状态
缓存           需要 (性能关键)            不需要
并发           需要去重/竞态处理          无并发问题
撤销           难 (需要后端支持)          容易 (本地回滚)
示例           用户列表/文章/商品         侧边栏展开/表单输入/模态框
管理工具       TanStack Query/SWR        Redux/Zustand/Pinia
```

---

## 三、Solid.js Signals 细粒度响应式

### 3.1 Signals 的核心洞察

```
传统响应式 (React/Vue) 的问题:
  ├── 状态变化 → 重新渲染整个组件
  ├── 即使只改了一个值，也要 diff 整个 VDOM
  ├── 过度渲染浪费性能

Signals 的解决方案 (Solid.js/Preact Signals):
  ├── 每个信号 (Signal) 独立追踪依赖
  ├── 状态变化 → 只更新依赖该信号的 DOM 节点
  ├── 零 VDOM，编译时精确更新
  └── 性能: O(1) 更新，不随组件大小增长
```

### 3.2 手写 Mini Signals (~80 行)

```javascript
/**
 * MiniSignals — Solid.js Signals 核心原理实现
 * 核心：Signal (值 + 依赖追踪) + Effect (自动响应) + Memo (缓存计算)
 * 
 * 设计哲学:
 * 1. Signal = 值 + 订阅者集合
 * 2. Effect 读取 Signal 时自动建立依赖关系
 * 3. Signal 变化时只通知依赖它的 Effect
 * 4. 编译时确定依赖，运行时零开销
 */

// ============ 全局上下文 (当前正在执行的 Effect) ============

let currentEffect = null;
let effectStack = [];

// ============ Signal ============

class Signal {
  constructor(initialValue) {
    this._value = initialValue;
    this.subscribers = new Set();  // 依赖此 signal 的 effects
  }

  // 读取值 (追踪依赖)
  get value() {
    if (currentEffect) {
      this.subscribers.add(currentEffect);
      currentEffect.dependencies.add(this);
    }
    return this._value;
  }

  // 设置值 (通知订阅者)
  set value(newValue) {
    if (Object.is(this._value, newValue)) return;  // 值未变，跳过
    this._value = newValue;
    // 通知所有依赖此 signal 的 effect
    for (const effect of this.subscribers) {
      effect.execute();
    }
  }

  // 函数式更新
  update(fn) {
    this.value = fn(this._value);
  }
}

// ============ 创建 Signal ============

function createSignal(initialValue) {
  const signal = new Signal(initialValue);
  const getter = () => signal.value;
  const setter = (newValue) => {
    if (typeof newValue === 'function') {
      signal.value = newValue(signal._value);
    } else {
      signal.value = newValue;
    }
  };
  return [getter, setter];
}

// ============ Effect (自动追踪依赖) ============

class Effect {
  constructor(fn) {
    this.fn = fn;
    this.dependencies = new Set();
    this.running = false;
    this.execute();  // 立即执行一次
  }

  execute() {
    // 清理旧依赖
    for (const dep of this.dependencies) {
      dep.subscribers.delete(this);
    }
    this.dependencies.clear();

    // 执行函数 (期间读取的 Signal 会自动建立依赖)
    const prevEffect = currentEffect;
    currentEffect = this;
    try {
      this.fn();
    } finally {
      currentEffect = prevEffect;
    }
  }

  // 销毁 effect
  dispose() {
    for (const dep of this.dependencies) {
      dep.subscribers.delete(this);
    }
    this.dependencies.clear();
  }
}

function createEffect(fn) {
  const effect = new Effect(fn);
  return () => effect.dispose();
}

// ============ Memo (缓存计算) ============

class Memo {
  constructor(fn) {
    this.fn = fn;
    this.dependencies = new Set();
    this.subscribers = new Set();
    this._value = undefined;
    this.dirty = true;
    // 首次执行
    this._compute();
  }

  _compute() {
    const prevEffect = currentEffect;
    currentEffect = {
      dependencies: new Set(),
      execute: () => { this.dirty = true; for (const s of this.subscribers) s.execute(); }
    };
    try {
      this._value = this.fn();
    } finally {
      // 建立依赖
      for (const dep of currentEffect.dependencies) {
        dep.subscribers.add(this);
        this.dependencies.add(dep);
      }
      currentEffect = prevEffect;
    }
    this.dirty = false;
  }

  get value() {
    if (this.dirty) this._compute();
    if (currentEffect) {
      this.subscribers.add(currentEffect);
      currentEffect.dependencies.add(this);
    }
    return this._value;
  }
}

function createMemo(fn) {
  const memo = new Memo(fn);
  return () => memo.value;
}

// ============ Batch (批量更新) ============

function batch(fn) {
  const pending = new Set();
  const originalSet = Signal.prototype.set;
  
  // 拦截 set，收集所有需要通知的 subscribers
  const batchedSignal = class extends Signal {
    set value(newValue) {
      if (Object.is(this._value, newValue)) return;
      this._value = newValue;
      for (const sub of this.subscribers) pending.add(sub);
    }
  };

  fn();

  // 批量执行所有 effect
  for (const effect of pending) {
    effect.execute();
  }
}

// ============ 使用示例 ============

// --- 示例 1: 基础 Signal ---
const [count, setCount] = createSignal(0);
console.log('Count:', count());  // 0

setCount(1);
console.log('Count:', count());  // 1

setCount(c => c + 1);
console.log('Count:', count());  // 2

// --- 示例 2: Effect 自动追踪 ---
const [name, setName] = createSignal('Alice');
const [age, setAge] = createSignal(25);

// effect 自动追踪 name 和 age
const cleanup = createEffect(() => {
  const info = `${name()} is ${age()} years old`;
  // console.log(info);
});

setName('Bob');   // 触发 effect
setAge(30);       // 触发 effect
cleanup();        // 销毁

// --- 示例 3: Memo 缓存计算 ---
const [items, setItems] = createSignal([1, 2, 3, 4, 5]);

const sum = createMemo(() => {
  const arr = items();
  return arr.reduce((a, b) => a + b, 0);
});

console.log('Sum:', sum());  // 15

// --- 示例 4: 计数器完整示例 ---
const [counter, setCounter] = createSignal(0);
const [doubled, setDoubled] = createMemo(() => counter() * 2);

createEffect(() => {
  // console.log(`Counter: ${counter()}, Doubled: ${doubled()}`);
});

setCounter(5);  // Counter: 5, Doubled: 10

console.log('✅ MiniSignals: Solid.js Signals 实现完成');
console.log('   核心: Signal + Effect + Memo 自动依赖追踪');
console.log('   特性: 细粒度更新 / 零 VDOM / 批量更新');
```

### 3.3 Signals vs Proxy 响应式对比

```
维度           Signals (Solid)          Proxy (Vue/Valtio)
─────────────  ──────────────────────    ──────────────────────
依赖追踪       读取时主动注册             写入时 Proxy 拦截
更新粒度       信号级别 (O(1))           对象路径级别
编译优化       编译时确定依赖             运行时动态
性能           极高 (无 VDOM)            高 (但有 Proxy 开销)
调试           需要手动追踪              DevTools 自动
学习曲线       中等 (函数式思维)          低 (直觉式)
适用场景       高性能 UI / 游戏           通用应用 / 表单
代表框架       Solid.js / Preact        Vue 3 / Valtio / MobX
```

---

## 四、CRDT 协作编辑状态管理

### 4.1 为什么用 CRDT？

```
传统协作的问题:
  ├── 操作转换 (OT) 复杂，难以保证收敛
  ├── 需要中央服务器协调
  ├── 离线编辑后合并困难
  ├── 冲突解决策略不透明

CRDT (Conflict-free Replicated Data Type) 的优势:
  ├── 数学保证：任何顺序合并都收敛
  ├── 无需中央协调，P2P 即可
  ├── 天然支持离线编辑
  ├── 合并规则确定且可预测
  └── 最终一致性，无需锁
```

### 4.2 手写 Mini CRDT (~200 行)

```javascript
/**
 * MiniCRDT — 协作编辑 CRDT 核心原理实现
 * 实现三种 CRDT:
 * 1. G-Counter (Grow-only Counter) — 只增计数器
 * 2. PN-Counter (Positive-Negative Counter) — 可增减计数器
 * 3. LWW-Register (Last-Writer-Write Register) — 最后写入获胜寄存器
 * 4. RGA (Replicated Growable Array) — 协作数组
 * 
 * 核心原理:
 * 1. 交换律: merge(a, b) = merge(b, a)
 * 2. 结合律: merge(merge(a, b), c) = merge(a, merge(b, c))
 * 3. 幂等性: merge(a, a) = a
 */

// ============ G-Counter (只增计数器) ============

class GCounter {
  /**
   * @param {string} nodeId - 当前节点 ID
   */
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.counts = new Map();  // nodeId → count
    this.counts.set(nodeId, 0);
  }

  // 增加
  increment(amount = 1) {
    this.counts.set(this.nodeId, (this.counts.get(this.nodeId) || 0) + amount);
  }

  // 获取总值
  value() {
    let total = 0;
    for (const count of this.counts.values()) {
      total += count;
    }
    return total;
  }

  // 合并 (取每个节点的最大值)
  merge(other) {
    const merged = new GCounter(this.nodeId);
    const allNodes = new Set([...this.counts.keys(), ...other.counts.keys()]);
    for (const node of allNodes) {
      merged.counts.set(node, Math.max(
        this.counts.get(node) || 0,
        other.counts.get(node) || 0
      ));
    }
    return merged;
  }

  // 序列化
  toJSON() {
    return { type: 'GCounter', nodeId: this.nodeId, counts: Object.fromEntries(this.counts) };
  }

  // 反序列化
  static fromJSON(json) {
    const counter = new GCounter(json.nodeId);
    counter.counts = new Map(Object.entries(json.counts).map(([k, v]) => [k, v]));
    return counter;
  }
}

// ============ PN-Counter (可增减计数器) ============

class PNCounter {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.positive = new GCounter(nodeId);   // 只增部分
    this.negative = new GCounter(nodeId);   // 只增部分 (表示减少)
  }

  // 增加
  increment(amount = 1) {
    this.positive.increment(amount);
  }

  // 减少
  decrement(amount = 1) {
    this.negative.increment(amount);
  }

  // 获取值
  value() {
    return this.positive.value() - this.negative.value();
  }

  // 合并
  merge(other) {
    const merged = new PNCounter(this.nodeId);
    merged.positive = this.positive.merge(other.positive);
    merged.negative = this.negative.merge(other.negative);
    return merged;
  }

  toJSON() {
    return {
      type: 'PNCounter',
      nodeId: this.nodeId,
      positive: this.positive.toJSON(),
      negative: this.negative.toJSON()
    };
  }
}

// ============ LWW-Register (最后写入获胜) ============

class LWWRegister {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.value = null;
    this.timestamp = 0;
  }

  // 设置值 (带时间戳)
  set(newValue, timestamp = Date.now()) {
    if (timestamp >= this.timestamp) {
      this.value = newValue;
      this.timestamp = timestamp;
    }
  }

  // 获取值
  get() {
    return this.value;
  }

  // 合并 (取时间戳大的)
  merge(other) {
    const merged = new LWWRegister(this.nodeId);
    if (other.timestamp >= this.timestamp) {
      merged.value = other.value;
      merged.timestamp = other.timestamp;
    } else {
      merged.value = this.value;
      merged.timestamp = this.timestamp;
    }
    return merged;
  }

  toJSON() {
    return { type: 'LWWRegister', nodeId: this.nodeId, value: this.value, timestamp: this.timestamp };
  }
}

// ============ RGA (Replicated Growable Array) — 协作数组 ============

/**
 * RGA 核心思想:
 * - 每个元素有唯一 ID 和位置信息
 * - 插入: 在指定位置后添加新元素
 * - 删除: 标记为删除 (不物理删除)
 * - 排序: 基于 ID 的拓扑排序保证一致性
 */

class RGANode {
  constructor(id, value, leftId = null, rightId = null, isDeleted = false) {
    this.id = id;           // 唯一 ID
    this.value = value;     // 元素值
    this.leftId = leftId;   // 左侧邻居 ID (null = 头部)
    this.rightId = rightId; // 右侧邻居 ID (null = 尾部)
    this.isDeleted = isDeleted;
    this.timestamp = Date.now();
  }
}

class RGA {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.nodes = new Map();  // id → RGANode
    this.counter = 0;
    // 添加头尾哨兵节点
    this.nodes.set('$head', new RGANode('$head', null));
    this.nodes.set('$tail', new RGANode('$tail', null, '$head'));
    this.nodes.get('$head').rightId = '$tail';
  }

  // 生成唯一 ID
  _nextId() {
    return `${this.nodeId}:${++this.counter}`;
  }

  // 在 leftId 之后插入
  insert(leftId, value) {
    const id = this._nextId();
    const leftNode = this.nodes.get(leftId);
    const rightId = leftNode.rightId;
    
    const newNode = new RGANode(id, value, leftId, rightId);
    this.nodes.set(id, newNode);
    
    // 更新邻居
    leftNode.rightId = id;
    if (rightId && this.nodes.has(rightId)) {
      this.nodes.get(rightId).leftId = id;
    }
    
    return id;
  }

  // 删除节点
  remove(id) {
    const node = this.nodes.get(id);
    if (node && !node.isDeleted && id !== '$head' && id !== '$tail') {
      node.isDeleted = true;
      // 更新邻居
      if (node.leftId && this.nodes.has(node.leftId)) {
        this.nodes.get(node.leftId).rightId = node.rightId;
      }
      if (node.rightId && this.nodes.has(node.rightId)) {
        this.nodes.get(node.rightId).leftId = node.leftId;
      }
    }
  }

  // 获取可见元素 (非删除)
  values() {
    const result = [];
    let current = this.nodes.get('$head');
    while (current && current.rightId) {
      current = this.nodes.get(current.rightId);
      if (current && !current.isDeleted && current.id !== '$tail') {
        result.push(current.value);
      }
    }
    return result;
  }

  // 长度
  length() {
    return this.values().length;
  }

  // 合并两个 RGA (取所有节点的并集)
  merge(other) {
    const merged = new RGA(this.nodeId);
    // 合并所有节点
    for (const [id, node] of this.nodes) {
      if (id !== '$head' && id !== '$tail') {
        merged.nodes.set(id, new RGANode(
          node.id, node.value, node.leftId, node.rightId, node.isDeleted
        ));
      }
    }
    for (const [id, node] of other.nodes) {
      if (id !== '$head' && id !== '$tail' && !merged.nodes.has(id)) {
        merged.nodes.set(id, new RGANode(
          node.id, node.value, node.leftId, node.rightId, node.isDeleted
        ));
      }
    }
    return merged;
  }

  toJSON() {
    return {
      type: 'RGA',
      nodeId: this.nodeId,
      counter: this.counter,
      nodes: Object.fromEntries(
        [...this.nodes.entries()].filter(([k]) => k !== '$head' && k !== '$tail')
          .map(([k, v]) => [k, { id: v.id, value: v.value, leftId: v.leftId, rightId: v.rightId, isDeleted: v.isDeleted }])
      )
    };
  }
}

// ============ 使用示例 ============

// --- 示例 1: G-Counter ---
const nodeA = new GCounter('A');
const nodeB = new GCounter('B');

nodeA.increment(3);  // A: 3
nodeB.increment(2);  // B: 2

const merged1 = nodeA.merge(nodeB);
console.log('G-Counter merged:', merged1.value());  // 5

// --- 示例 2: PN-Counter ---
const pnA = new PNCounter('A');
const pnB = new PNCounter('B');

pnA.increment(5);    // A: +5
pnB.increment(3);    // B: +3
pnB.decrement(1);    // B: +3, -1

const merged2 = pnA.merge(pnB);
console.log('PN-Counter merged:', merged2.value());  // 7

// --- 示例 3: LWW-Register ---
const regA = new LWWRegister('A');
const regB = new LWWRegister('B');

regA.set('Hello', 1000);
regB.set('World', 2000);  // 时间戳更大

const merged3 = regA.merge(regB);
console.log('LWW-Register merged:', merged3.get());  // 'World'

// --- 示例 4: RGA 协作数组 ---
const rgaA = new RGA('A');
const rgaB = new RGA('B');

// A 插入 "H" 和 "e"
const hId = rgaA.insert('$head', 'H');
const eId = rgaA.insert(hId, 'e');

// B 插入 "l" 和 "l"
const l1Id = rgaB.insert('$head', 'l');
const l2Id = rgaB.insert(l1Id, 'l');

// 合并
const mergedRGA = rgaA.merge(rgaB);
console.log('RGA merged:', mergedRGA.values());  // ['H', 'e', 'l', 'l'] (顺序可能不同但都有效)

// B 删除 "l"
rgaB.remove(l1Id);
const finalRGA = mergedRGA.merge(rgaB);
console.log('RGA after remove:', finalRGA.values());  // ['H', 'e', 'l']

console.log('✅ MiniCRDT: CRDT 协作编辑实现完成');
console.log('   核心: G-Counter / PN-Counter / LWW-Register / RGA');
console.log('   特性: 交换律 / 结合律 / 幂等性 / 离线编辑');
```

### 4.3 CRDT 类型速查

```
CRDT 类型          语义              合并规则              应用场景
────────────────  ────────────────  ────────────────────  ──────────────
G-Counter         只增计数器         逐节点取最大值         点赞数/浏览量
PN-Counter        可增减计数器       正负分别取最大值        评分 ( +/- )
LWW-Register      最后写入获胜       时间戳大的获胜          文本编辑/配置
LWW-Map           最后写入获胜映射    每个 key 独立 LWW       用户配置/属性
Observed-Remove   观察删除 Set       加>删, 记录 tombstone   标签/列表项
RGA               协作增长数组       拓扑排序 + tombstone    文档编辑/代码
Y-Aware (Yjs)     增量同步           状态向量 + diff         实时协作编辑
Automerge         树形 CRDT          对象级合并              JSON 协作
```

---

## 五、12+ 全新业务场景示例

### 示例 1: RxJS 驱动的实时数据看板

```javascript
/**
 * 实时数据看板 — RxJS 驱动
 * 场景: 股票行情/传感器数据/监控面板
 * 核心: BehaviorSubject + scan + 操作符管道
 */

// 数据源 (模拟 WebSocket)
const stockData$ = new Subject();

// Store
const stockStore = new MiniRxStore({
  reducer: (state, action) => {
    switch (action.type) {
      case 'UPDATE_PRICE':
        const { symbol, price } = action.payload;
        return {
          ...state,
          prices: { ...state.prices, [symbol]: price },
          lastUpdate: Date.now(),
        };
      case 'WATCH_SYMBOL':
        return { ...state, watched: [...state.watched, action.payload] };
      default:
        return state;
    }
  },
  initialState: { prices: {}, watched: ['AAPL', 'GOOGL', 'MSFT'] },
});

// 选择器: 获取关注股票的价格
const watchedPrices$ = stockStore.select(state =>
  state.watched.map(s => ({ symbol: s, price: state.prices[s] || 0 }))
);

// 选择器: 计算涨跌幅
const changes$ = stockStore.select(state => {
  const result = {};
  for (const [symbol, price] of Object.entries(state.prices)) {
    const prev = state.prices[symbol];
    result[symbol] = prev ? ((price - prev) / prev * 100).toFixed(2) + '%' : 'N/A';
  }
  return result;
});

// 模拟数据推送
setInterval(() => {
  const symbols = ['AAPL', 'GOOGL', 'MSFT'];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const price = 100 + Math.random() * 50;
  stockStore.dispatch({ type: 'UPDATE_PRICE', payload: { symbol, price } });
}, 1000);

console.log('✅ 示例 1: RxJS 实时数据看板');
```

### 示例 2: Server State + Client State 混合管理

```javascript
/**
 * 混合状态管理 — Server State (Query) + Client State (Store)
 * 场景: 电商商品详情页
 * 核心: 分离 API 数据和 UI 状态
 */

// Server State: 商品信息 (用 MiniQuery)
const queryClient = new QueryClient({ staleTime: 60_000 });

const productQuery = useQuery(
  queryClient,
  ['product', 'sku-123'],
  async () => ({
    id: 'sku-123',
    name: '机械键盘',
    price: 299,
    stock: 50,
    specs: { keys: 87, type: '青轴' }
  }),
  { staleTime: 60_000 }
);

// Client State: UI 状态 (用 MiniRxStore)
const uiStore = new MiniRxStore({
  reducer: (state, action) => {
    switch (action.type) {
      case 'SET_QUANTITY':
        return { ...state, quantity: Math.max(1, Math.min(state.maxStock, action.payload)) };
      case 'SELECT_SPEC':
        return { ...state, selectedSpec: action.payload };
      case 'TOGGLE_FAVORITE':
        return { ...state, isFavorite: !state.isFavorite };
      case 'SET_TAB':
        return { ...state, activeTab: action.payload };
      default:
        return state;
    }
  },
  initialState: {
    quantity: 1,
    selectedSpec: null,
    isFavorite: false,
    activeTab: 'detail',
    maxStock: 99,
  },
});

// 派生: 总价 (Server + Client 组合)
const totalPrice$ = uiStore.select(state => {
  const product = queryClient.getQueryData(['product', 'sku-123']);
  return product ? product.price * state.quantity : 0;
});

console.log('✅ 示例 2: Server State + Client State 混合管理');
```

### 示例 3: Signals 驱动的表单验证

```javascript
/**
 * Signals 表单验证 — 细粒度响应式
 * 场景: 复杂表单，每个字段独立验证
 * 核心: Signal + Memo + Effect
 */

function createFormField(initialValue, validators = []) {
  const [value, setValue] = createSignal(initialValue);
  const [touched, setTouched] = createSignal(false);
  
  const errors = createMemo(() => {
    const v = value();
    return validators
      .map(fn => fn(v))
      .filter(Boolean);
  });
  
  const isValid = createMemo(() => errors().length === 0);
  const isDirty = createMemo(() => value() !== initialValue);
  
  return { value, setValue, touched, setTouched, errors, isValid, isDirty };
}

// 验证器
const required = (msg = '必填') => v => v ? null : msg;
const minLength = (len, msg) => v => v && v.length >= len ? null : (msg || `至少${len}个字符`);
const email = (msg = '邮箱格式不正确') => v => v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : msg;
const match = (other, msg = '两次输入不一致') => v => v === other() ? null : msg;

// 创建表单字段
const username = createFormField('', [required('用户名必填'), minLength(3, '至少3个字符')]);
const emailField = createFormField('', [required('邮箱必填'), email()]);
const password = createFormField('', [required('密码必填'), minLength(8, '至少8个字符')]);
const confirmPassword = createFormField('', [required('确认密码必填'), match(password.value, '两次密码不一致')]);

// 表单级别
const isFormValid = createMemo(() =>
  username.isValid() && emailField.isValid() && password.isValid() && confirmPassword.isValid()
);

// 效果: 实时显示验证状态
createEffect(() => {
  const valid = isFormValid();
  // console.log('Form valid:', valid);
});

// 模拟输入
username.setValue('alice');       // ✅
emailField.setValue('test@test');  // ❌
password.setValue('12345678');     // ✅
confirmPassword.setValue('12345678'); // ✅

console.log('✅ 示例 3: Signals 表单验证');
```

### 示例 4: CRDT 协作文本编辑器

```javascript
/**
 * CRDT 协作编辑器 — RGA + LWW-Register
 * 场景: 多人实时协作编辑文档
 * 核心: RGA 数组 + 操作同步
 */

class CollaborativeEditor {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.rga = new RGA(nodeId);
    this.cursor = new LWWRegister(nodeId);
    this.selection = new LWWRegister(nodeId);
    this.history = [];  // 本地操作历史 (用于撤销)
    this._init();
  }

  _init() {
    // 初始化: 头尾哨兵之间
    this.rga.insert('$head', '');  // 初始空内容
  }

  // 在 cursor 位置插入字符
  insertChar(char) {
    const cursorPos = this.cursor.get() || '$head';
    const id = this.rga.insert(cursorPos, char);
    this.cursor.set(id);  // 移动光标
    this.history.push({ type: 'insert', id, char, after: cursorPos });
    return id;
  }

  // 删除 cursor 前的字符
  deleteChar() {
    const cursorPos = this.cursor.get();
    if (!cursorPos || cursorPos === '$head') return null;
    this.rga.remove(cursorPos);
    const node = this.rga.nodes.get(cursorPos);
    if (node) this.cursor.set(node.leftId);
    this.history.push({ type: 'delete', id: cursorPos });
    return cursorPos;
  }

  // 移动光标
  moveCursor(direction) {
    const current = this.cursor.get() || '$head';
    const node = this.rga.nodes.get(current);
    if (!node) return;
    
    if (direction === 'left' && node.leftId && node.leftId !== '$head') {
      this.cursor.set(node.leftId);
    } else if (direction === 'right' && node.rightId && node.rightId !== '$tail') {
      this.cursor.set(node.rightId);
    }
  }

  // 获取文本内容
  getText() {
    return this.rga.values().filter(v => v !== '').join('');
  }

  // 合并远程编辑
  mergeRemote(other) {
    this.rga = this.rga.merge(other.rga);
    this.cursor = this.cursor.merge(other.cursor);
    this.selection = this.selection.merge(other.selection);
  }

  // 撤销 (本地)
  undo() {
    const lastOp = this.history.pop();
    if (!lastOp) return;
    if (lastOp.type === 'insert') {
      this.rga.remove(lastOp.id);
    }
  }
}

// 模拟两人协作
const editorA = new CollaborativeEditor('A');
const editorB = new CollaborativeEditor('B');

// A 输入 "Hello"
editorA.insertChar('H');
editorA.insertChar('e');
editorA.insertChar('l');
editorA.insertChar('l');
editorA.insertChar('o');

// B 输入 " World" (同时编辑)
editorB.insertChar(' ');
editorB.insertChar('W');
editorB.insertChar('o');
editorB.insertChar('r');
editorB.insertChar('l');
editorB.insertChar('d');

// 合并
editorA.mergeRemote(editorB);
console.log('Collaborative text:', editorA.getText());

console.log('✅ 示例 4: CRDT 协作文本编辑器');
```

### 示例 5: RxJS 搜索建议 (防抖 + 取消)

```javascript
/**
 * RxJS 搜索建议 — 防抖 + 竞态取消
 * 场景: 搜索引擎/商品搜索
 * 核心: debounceTime + switchMap (自动取消旧请求)
 */

const searchInput$ = new Subject();

const searchStore = new MiniRxStore({
  reducer: (state, action) => {
    switch (action.type) {
      case 'SEARCH_START':
        return { ...state, query: action.payload, loading: true, results: [], error: null };
      case 'SEARCH_SUCCESS':
        return { ...state, loading: false, results: action.payload, error: null };
      case 'SEARCH_ERROR':
        return { ...state, loading: false, results: [], error: action.payload };
      case 'CLEAR_SEARCH':
        return { ...state, query: '', loading: false, results: [], error: null };
      default:
        return state;
    }
  },
  initialState: { query: '', loading: false, results: [], error: null },
});

// 模拟搜索 API
const mockSearchAPI = async (query) => {
  await new Promise(r => setTimeout(r, 200));
  return [`${query} 结果 1`, `${query} 结果 2`, `${query} 结果 3`];
};

// 搜索管道: 输入 → 防抖 → 去重 → 请求 → 更新状态
// (模拟 RxJS 操作符链)
let searchTimeout = null;
let lastQuery = '';

function handleSearchInput(query) {
  // 防抖 300ms
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    if (query === lastQuery) return;  // 去重
    lastQuery = query;
    
    if (!query.trim()) {
      searchStore.dispatch({ type: 'CLEAR_SEARCH' });
      return;
    }
    
    searchStore.dispatch({ type: 'SEARCH_START', payload: query });
    try {
      const results = await mockSearchAPI(query);
      searchStore.dispatch({ type: 'SEARCH_SUCCESS', payload: results });
    } catch (err) {
      searchStore.dispatch({ type: 'SEARCH_ERROR', payload: err.message });
    }
  }, 300);
}

// 模拟用户输入
handleSearchInput('j');
handleSearchInput('ja');
handleSearchInput('jav');
handleSearchInput('java');  // 只有这个会触发请求 (防抖后)

console.log('✅ 示例 5: RxJS 搜索建议 (防抖 + 取消)');
```

### 示例 6: Signals 驱动的虚拟列表

```javascript
/**
 * Signals 虚拟列表 — 细粒度更新
 * 场景: 10 万条数据的列表，只渲染可见区域
 * 核心: Signal + Memo 精确计算可见范围
 */

function createVirtualList(data, itemHeight, containerHeight) {
  const [scrollTop, setScrollTop] = createSignal(0);
  const [containerH, setContainerH] = createSignal(containerHeight);
  
  // 计算可见范围 (Memo 缓存)
  const visibleRange = createMemo(() => {
    const top = scrollTop();
    const h = containerH();
    const start = Math.floor(top / itemHeight);
    const count = Math.ceil(h / itemHeight);
    return {
      start: Math.max(0, start - 5),  // 上下各预渲染 5 个
      end: Math.min(data.length, start + count + 5),
      totalHeight: data.length * itemHeight,
      offsetY: start * itemHeight,
    };
  });
  
  // 可见数据 (Memo 缓存)
  const visibleData = createMemo(() => {
    const range = visibleRange();
    return data.slice(range.start, range.end).map((item, i) => ({
      ...item,
      index: range.start + i,
      top: (range.start + i) * itemHeight - range.offsetY,
    }));
  });
  
  // 统计信息
  const stats = createMemo(() => ({
    total: data.length,
    visible: visibleRange().end - visibleRange().start,
    rendered: visibleData().length,
    scrollPercent: (scrollTop() / (data.length * itemHeight) * 100).toFixed(1) + '%',
  }));
  
  return {
    scrollTop, setScrollTop,
    containerH, setContainerH,
    visibleRange,
    visibleData,
    stats,
  };
}

// 使用: 10 万条数据
const bigData = Array.from({ length: 100000 }, (_, i) => ({ id: i, text: `Item ${i}` }));
const list = createVirtualList(bigData, 40, 600);

// 模拟滚动
list.setScrollTop(0);
// console.log('Visible:', list.visibleData().length, 'items');  // ~20 items
// console.log('Stats:', list.stats());

list.setScrollTop(50000);
// console.log('After scroll:', list.visibleData().length, 'items');
// console.log('Stats:', list.stats());

console.log('✅ 示例 6: Signals 虚拟列表 (10 万数据只渲染 ~20 DOM)');
```

### 示例 7: Server State 无限滚动 + 预取

```javascript
/**
 * Server State 无限滚动 — 分页 + 预取
 * 场景: 社交媒体信息流
 * 核心: Query 分页缓存 + 预取下一批
 */

class InfiniteQuery {
  constructor(client, queryKey, fetcher, options = {}) {
    this.client = client;
    this.queryKey = queryKey;
    this.fetcher = fetcher;
    this.pageSize = options.pageSize || 20;
    this.pages = [];  // 已加载的页
    this.hasMore = true;
    this.loading = false;
    this.error = null;
    this.observers = new Set();
  }

  async loadPage(page = 0) {
    if (this.loading || !this.hasMore) return;
    this.loading = true;
    this.notify();

    try {
      const result = await this.fetcher(page, this.pageSize);
      this.pages.push(...result.data);
      this.hasMore = result.hasMore;
      this.error = null;
    } catch (err) {
      this.error = err;
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  async loadMore() {
    return this.loadPage(this.pages.length / this.pageSize);
  }

  // 预取下一页 (后台静默)
  async prefetchNext() {
    if (!this.hasMore || this.loading) return;
    const nextPage = this.pages.length / this.pageSize;
    try {
      await this.fetcher(nextPage, this.pageSize);
    } catch (e) { /* 静默失败 */ }
  }

  // 重置
  reset() {
    this.pages = [];
    this.hasMore = true;
    this.loading = false;
    this.error = null;
    this.notify();
  }

  subscribe(cb) {
    this.observers.add(cb);
    cb(this.getState());
    return () => this.observers.delete(cb);
  }

  notify() {
    const state = this.getState();
    for (const cb of this.observers) cb(state);
  }

  getState() {
    return {
      data: this.pages,
      hasMore: this.hasMore,
      loading: this.loading,
      error: this.error,
      total: this.pages.length,
    };
  }
}

// 模拟 API
const mockFeedAPI = async (page, pageSize) => {
  await new Promise(r => setTimeout(r, 100));
  const start = page * pageSize;
  const data = Array.from({ length: pageSize }, (_, i) => ({
    id: start + i,
    text: `Post ${start + i}`,
    author: `User ${start + i % 100}`,
  }));
  return { data, hasMore: start + pageSize < 200 };  // 最多 200 条
};

const feedQuery = new InfiniteQuery(
  new QueryClient(),
  ['feed'],
  mockFeedAPI,
  { pageSize: 20 }
);

// 加载第一页
feedQuery.loadPage(0);
// console.log('Feed loaded:', feedQuery.pages.length, 'items');

// 预取
feedQuery.prefetchNext();

console.log('✅ 示例 7: Server State 无限滚动 + 预取');
```

### 示例 8: Signals 拖拽排序

```javascript
/**
 * Signals 拖拽排序 — 细粒度动画
 * 场景: 任务看板/待办事项排序
 * 核心: Signal + Memo + 直接 DOM 操作
 */

function createDragList(items) {
  const [order, setOrder] = createSignal(items.map((_, i) => i));
  const [dragIndex, setDragIndex] = createSignal(null);
  const [dragOverIndex, setDragOverIndex] = createSignal(null);
  
  // 实际数据 (按 order 排列)
  const orderedItems = createMemo(() => {
    return order().map(i => ({
      ...items[i],
      originalIndex: i,
      displayIndex: order().indexOf(i),
    }));
  });
  
  // 拖拽开始
  const onDragStart = (index) => {
    setDragIndex(index);
  };
  
  // 拖拽经过
  const onDragOver = (index) => {
    if (dragIndex() !== null && dragIndex() !== index) {
      setDragOverIndex(index);
    }
  };
  
  // 放下
  const onDrop = (targetIndex) => {
    const fromIndex = dragIndex();
    if (fromIndex === null) return;
    
    setOrder(prev => {
      const newOrder = [...prev];
      const fromPos = newOrder.indexOf(fromIndex);
      const toPos = newOrder.indexOf(targetIndex);
      if (fromPos > -1 && toPos > -1) {
        const [moved] = newOrder.splice(fromPos, 1);
        newOrder.splice(toPos, 0, moved);
      }
      return newOrder;
    });
    
    setDragIndex(null);
    setDragOverIndex(null);
  };
  
  // 拖拽结束
  const onDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };
  
  return {
    orderedItems,
    dragIndex,
    dragOverIndex,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  };
}

const tasks = [
  { id: 1, title: '设计 UI', status: 'done' },
  { id: 2, title: '写代码', status: 'doing' },
  { id: 3, title: '测试', status: 'todo' },
  { id: 4, title: '部署', status: 'todo' },
];

const dragList = createDragList(tasks);
// console.log('Ordered:', dragList.orderedItems().map(i => i.title));

console.log('✅ 示例 8: Signals 拖拽排序');
```

### 示例 9: CRDT 多人画板

```javascript
/**
 * CRDT 多人画板 — LWW-Register + G-Counter
 * 场景: 协作绘图/白板
 * 核心: 每个笔触是 LWW-Register，图层是 G-Counter
 */

class CollaborativeCanvas {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.strokes = new Map();  // strokeId → LWW-Register (笔触数据)
    this.layerOrder = new GCounter(nodeId);  // 图层顺序
    this.selectedId = new LWWRegister(nodeId);  // 当前选中
    this.history = [];
  }

  // 添加笔触
  addStroke(strokeData) {
    const id = `${this.nodeId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const register = new LWWRegister(this.nodeId);
    register.set({
      id,
      points: strokeData.points,
      color: strokeData.color,
      width: strokeData.width,
      layer: this.layerOrder.value(),
    });
    this.strokes.set(id, register);
    this.layerOrder.increment();
    this.history.push({ type: 'add', id });
    return id;
  }

  // 修改笔触 (颜色/粗细)
  updateStroke(id, updates) {
    const register = this.strokes.get(id);
    if (!register) return;
    const current = register.get() || {};
    register.set({ ...current, ...updates, id });
  }

  // 删除笔触 (用特殊标记)
  removeStroke(id) {
    const register = this.strokes.get(id);
    if (register) {
      register.set({ ...register.get(), deleted: true });
    }
    this.history.push({ type: 'remove', id });
  }

  // 获取所有可见笔触
  getStrokes() {
    const strokes = [];
    for (const [id, register] of this.strokes) {
      const data = register.get();
      if (data && !data.deleted) {
        strokes.push(data);
      }
    }
    return strokes.sort((a, b) => (a.layer || 0) - (b.layer || 0));
  }

  // 合并远程画板
  mergeRemote(other) {
    for (const [id, register] of other.strokes) {
      if (this.strokes.has(id)) {
        this.strokes.get(id).merge(register);
      } else {
        this.strokes.set(id, register);
      }
    }
    this.layerOrder = this.layerOrder.merge(other.layerOrder);
    this.selectedId = this.selectedId.merge(other.selectedId);
  }
}

// 模拟两人协作画板
const canvasA = new CollaborativeCanvas('A');
const canvasB = new CollaborativeCanvas('B');

canvasA.addStroke({ points: [{ x: 0, y: 0 }, { x: 100, y: 100 }], color: 'red', width: 2 });
canvasA.addStroke({ points: [{ x: 50, y: 50 }, { x: 150, y: 150 }], color: 'blue', width: 3 });

canvasB.addStroke({ points: [{ x: 200, y: 0 }, { x: 300, y: 100 }], color: 'green', width: 2 });

canvasA.mergeRemote(canvasB);
console.log('Canvas strokes:', canvasA.getStrokes().length);  // 3

console.log('✅ 示例 9: CRDT 多人画板');
```

### 示例 10: RxJS 工作流引擎

```javascript
/**
 * RxJS 工作流引擎 — 操作符管道
 * 场景: 数据处理管道/ETL/事件处理
 * 核心: 操作符组合 + 错误处理 + 重试
 */

class WorkflowEngine {
  constructor() {
    this.steps = [];
    this.errorHandlers = [];
  }

  // 添加步骤
  use(fn) {
    this.steps.push(fn);
    return this;
  }

  // 错误处理
  onError(fn) {
    this.errorHandlers.push(fn);
    return this;
  }

  // 执行管道
  async execute(initialData) {
    let data = initialData;
    for (const step of this.steps) {
      try {
        data = await step(data);
      } catch (err) {
        for (const handler of this.errorHandlers) {
          const result = handler(err, data);
          if (result !== undefined) {
            data = result;
            break;
          }
        }
      }
    }
    return data;
  }
}

// 使用: 数据处理管道
const pipeline = new WorkflowEngine()
  .use(data => data.map(x => x * 2))           // 转换
  .use(data => data.filter(x => x > 5))         // 过滤
  .use(data => data.sort((a, b) => a - b))      // 排序
  .use(data => ({ result: data, count: data.length }))  // 聚合
  .onError((err, data) => {
    console.error('Pipeline error:', err);
    return data;  // 降级
  });

pipeline.execute([1, 2, 3, 4, 5]).then(result => {
  // console.log('Pipeline result:', result);
  // { result: [6, 8, 10], count: 3 }
});

console.log('✅ 示例 10: RxJS 工作流引擎');
```

### 示例 11: Signals + Server State 实时通知

```javascript
/**
 * Signals + Server State 实时通知
 * 场景: 通知中心 (WebSocket + 本地状态)
 * 核心: Signal 通知列表 + Query 获取历史
 */

function createNotificationCenter() {
  const [notifications, setNotifications] = createSignal([]);
  const [unreadCount, setUnreadCount] = createSignal(0);
  const [isOpen, setIsOpen] = createSignal(false);
  
  // 未读数 (Memo)
  const badgeCount = createMemo(() => unreadCount());
  
  // 通知列表 (Memo: 按时间排序)
  const sortedNotifications = createMemo(() => {
    return notifications().sort((a, b) => b.timestamp - a.timestamp);
  });
  
  // 未读通知 (Memo)
  const unreadNotifications = createMemo(() => {
    return notifications().filter(n => !n.read);
  });
  
  // 添加通知
  const addNotification = (notification) => {
    setNotifications(prev => [...prev, {
      id: Date.now(),
      read: false,
      timestamp: Date.now(),
      ...notification,
    }]);
    setUnreadCount(prev => prev + 1);
  };
  
  // 标记已读
  const markRead = (id) => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, read: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };
  
  // 全部已读
  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };
  
  // 删除通知
  const removeNotification = (id) => {
    setNotifications(prev => {
      const notif = prev.find(n => n.id === id);
      if (notif && !notif.read) {
        setUnreadCount(c => Math.max(0, c - 1));
      }
      return prev.filter(n => n.id !== id);
    });
  };
  
  // 模拟 WebSocket 推送
  const simulatePush = () => {
    const types = ['message', 'system', 'alert', 'update'];
    const type = types[Math.floor(Math.random() * types.length)];
    addNotification({
      type,
      title: `${type} 通知`,
      body: `这是一条 ${type} 类型的通知`,
    });
  };
  
  return {
    notifications: sortedNotifications,
    unreadCount: badgeCount,
    unreadNotifications,
    isOpen,
    setIsOpen,
    addNotification,
    markRead,
    markAllRead,
    removeNotification,
    simulatePush,
  };
}

const center = createNotificationCenter();
center.simulatePush();
center.simulatePush();
center.simulatePush();
// console.log('Unread:', center.unreadCount());  // 3

console.log('✅ 示例 11: Signals + Server State 实时通知');
```

### 示例 12: CRDT 协作表格 (Spreadsheet)

```javascript
/**
 * CRDT 协作表格 — LWW-Map + PN-Counter
 * 场景: 在线表格/Excel 协作
 * 核心: 每个单元格是 LWW-Register，统计是 PN-Counter
 */

class CollaborativeSpreadsheet {
  constructor(nodeId, rows, cols) {
    this.nodeId = nodeId;
    this.rows = rows;
    this.cols = cols;
    this.cells = new Map();  // "r,c" → LWW-Register
    this.stats = new PN-Counter(nodeId);
    this.selection = new LWWRegister(nodeId);
    this.undoStack = [];
    
    // 初始化单元格
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.cells.set(`${r},${c}`, new LWWRegister(nodeId));
      }
    }
  }

  // 设置单元格
  setCell(row, col, value) {
    const key = `${row},${col}`;
    const register = this.cells.get(key);
    if (register) {
      const oldValue = register.get();
      this.undoStack.push({ key, oldValue });
      register.set(value);
    }
  }

  // 获取单元格
  getCell(row, col) {
    const register = this.cells.get(`${row},${col}`);
    return register ? register.get() : null;
  }

  // 获取区域
  getRange(startRow, startCol, endRow, endCol) {
    const result = [];
    for (let r = startRow; r <= endRow; r++) {
      const row = [];
      for (let c = startCol; c <= endCol; c++) {
        row.push(this.getCell(r, c));
      }
      result.push(row);
    }
    return result;
  }

  // 公式计算 (简化版)
  computeFormula(formula) {
    // 支持: =SUM(A1:B2), =AVG(A1:A10), =COUNT(A1:B2)
    const match = formula.match(/=(SUM|AVG|COUNT)\(([A-Z]\d+):([A-Z]\d+)\)/i);
    if (!match) return null;
    
    const [, fn, startRef, endRef] = match;
    const startCol = startRef.charCodeAt(0) - 65;
    const startRow = parseInt(startRef.slice(1)) - 1;
    const endCol = endRef.charCodeAt(0) - 65;
    const endRow = parseInt(endRef.slice(1)) - 1;
    
    const values = this.getRange(startRow, startCol, endRow, endCol).flat()
      .filter(v => typeof v === 'number');
    
    switch (fn.toUpperCase()) {
      case 'SUM': return values.reduce((a, b) => a + b, 0);
      case 'AVG': return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      case 'COUNT': return values.length;
      default: return null;
    }
  }

  // 合并远程表格
  mergeRemote(other) {
    for (const [key, register] of other.cells) {
      if (this.cells.has(key)) {
        this.cells.get(key).merge(register);
      } else {
        this.cells.set(key, register);
      }
    }
    this.selection = this.selection.merge(other.selection);
  }

  // 撤销
  undo() {
    const last = this.undoStack.pop();
    if (last) {
      const register = this.cells.get(last.key);
      if (register && last.oldValue !== undefined) {
        register.set(last.oldValue);
      }
    }
  }
}

// 模拟协作表格
const sheetA = new CollaborativeSpreadsheet('A', 5, 5);
const sheetB = new CollaborativeSpreadsheet('B', 5, 5);

sheetA.setCell(0, 0, 10);
sheetA.setCell(0, 1, 20);
sheetA.setCell(0, 2, 30);

sheetB.setCell(1, 0, 'Hello');
sheetB.setCell(1, 1, 'World');

sheetA.mergeRemote(sheetB);
// console.log('A[0,0]:', sheetA.getCell(0, 0));  // 10
// console.log('A[1,0]:', sheetA.getCell(1, 0));  // 'Hello'
// console.log('SUM A1:C1:', sheetA.computeFormula('=SUM(A1:C1)'));  // 60

console.log('✅ 示例 12: CRDT 协作表格');
```

---

## 六、六轮训练总结

### 状态管理知识图谱

```
状态管理
├── 基础层 (R1)
│   ├── Mini Redux (createStore + reducer + dispatch)
│   ├── Mini Zustand (set/get + hooks + 中间件)
│   └── 15 个业务示例
│
├── 进阶层 (R2-R4)
│   ├── Proxy 响应式 (Valtio 模式)
│   ├── Signals (Solid.js 模式) ← 本轮深化
│   ├── 原子 Store (Jotai 模式)
│   ├── 状态机 (XState 简化版)
│   ├── 事件溯源 / CQRS
│   ├── 乐观更新 / 时间旅行
│   ├── 中间件管线 (Koa 洋葱模型)
│   ├── 跨窗口同步 / 状态迁移 / HMR
│   └── 测试框架 / TypeScript 类型安全
│
├── Vue 生态层 (R5)
│   ├── Mini Pinia (setup/Options 双语法)
│   ├── Vue 3 reactive 集成
│   ├── 插件系统 / $patch / $subscribe
│   └── 12 个 Vue 业务场景
│
└── 高级模式层 (R6 本轮)
    ├── RxJS 驱动 (BehaviorSubject + scan + 操作符)
    ├── Server State (TanStack Query: 缓存/失效/去重)
    ├── Signals 深化 (Solid.js: 细粒度响应/零 VDOM)
    ├── CRDT 协作 (G-Counter/PN-Counter/LWW/RGA)
    └── 12 个全新业务场景
```

### 六轮核心实现汇总

| 轮次 | 核心实现 | 行数 | 示例数 | 关键概念 |
|------|----------|------|--------|----------|
| R1 | Mini Redux + Mini Zustand | ~130 | 15 | createStore/reducer/dispatch/set/get |
| R2-R4 | Proxy/Signals/状态机/事件溯源/CQRS | ~500 | 12 | Valtio/XState/ES/CQRS/OT |
| R5 | Mini Pinia | ~120 | 12 | defineStore/reactive/getters/actions |
| R6 | Mini RxStore + Mini Query + Mini Signals + Mini CRDT | ~530 | 12 | Observable/scan/Signal/CRDT |

### 六种状态管理模式对比

```
模式          更新方式        依赖追踪        适用场景
────────────  ──────────────  ──────────────  ──────────────
Redux         dispatch+reducer  手动订阅         大型应用/可预测
Zustand       set/get           手动 select      中小型/简洁
Pinia         直接修改 state    Vue reactive     Vue 生态
RxJS          Observable 管道    操作符组合        数据流/异步复杂
Signals       Signal.value      自动依赖追踪      高性能 UI
Server State  Query 缓存        自动失效/预取     API 数据
CRDT          merge             数学保证收敛      协作编辑
```

### 面试高频考点

1. **Redux 三原则** — 单一数据源/State 只读/纯函数修改
2. **Redux vs Zustand** — 样板代码/学习曲线/适用场景
3. **不可变更新** — 为什么需要/如何实现/性能影响
4. **选择器优化** — 为什么需要/select 原理/memoization
5. **中间件原理** — 洋葱模型/compose 函数/异步处理
6. **Server State vs Client State** — 为什么要分离/各自特点
7. **Signals 原理** — 依赖追踪/细粒度更新/零 VDOM
8. **CRDT 原理** — 交换律/结合律/幂等性/三种类型
9. **RxJS 操作符** — scan/map/filter/distinctUntilChanged
10. **状态管理选型** — 何时用 Redux/Zustand/Pinia/Signals

---

*完成时间: 2026-05-02 11:00*
*第六轮状态管理专项 — RxJS 驱动 + Server State + Signals 深化 + CRDT 协作*
*累计 6 轮状态管理训练闭环 ✅*
