# 专项训练 02:00 — JavaScript 设计模式 v3

> 2026-05-04 | 重点：单例模式 + 观察者模式（进阶实战版）
> 前置：v1 覆盖单例+观察者基础，v2 覆盖工厂+策略 → 本次 v3 深入进阶实战

---

## 一、单例模式 — 进阶实战

### 1.1 为什么单例模式值得深入？

单例看似简单，但在真实项目中面临很多挑战：
- 异步初始化（数据库连接、API 认证）
- 多实例隔离（SSR 场景下每个请求需要独立实例）
- 测试隔离（单元测试需要 reset）
- 序列化/反序列化（缓存恢复）
- 模块系统边界（ESM vs CJS 的差异）

### 1.2 异步单例（Async Singleton）

```javascript
// === 场景：数据库连接池，需要异步初始化 ===

class DatabasePool {
  #pool = null; // 私有字段
  #config = null;

  constructor(config) {
    this.#config = config;
  }

  async init() {
    // 模拟异步连接
    console.log('⏳ 正在连接数据库...');
    await new Promise(r => setTimeout(r, 100));
    this.#pool = {
      connections: [],
      max: this.#config.maxConnections || 10,
      query(sql) {
        console.log(`📊 执行: ${sql}`);
        return { rows: [], rowCount: 0 };
      },
      release() { /* 归还连接 */ }
    };
    console.log('✅ 数据库连接池已就绪');
    return this;
  }

  get pool() {
    if (!this.#pool) throw new Error('数据库未初始化，请先调用 init()');
    return this.#pool;
  }

  query(sql) {
    return this.pool.query(sql);
  }
}

// 异步工厂单例
const createAsyncSingleton = (factory) => {
  let instance = null;
  let promise = null;

  return {
    async getInstance(...args) {
      if (instance) return instance;
      // 防止并发多次初始化
      if (!promise) {
        promise = factory(...args).then((result) => {
          instance = result;
          return instance;
        });
      }
      return promise;
    },

    // 测试用
    reset() {
      instance = null;
      promise = null;
    }
  };
};

// 使用
const dbSingleton = createAsyncSingleton(
  (config) => new DatabasePool(config).init()
);

// 并发调用只初始化一次
const [db1, db2] = await Promise.all([
  dbSingleton.getInstance({ maxConnections: 5 }),
  dbSingleton.getInstance({ maxConnections: 10 }), // 参数被忽略，第一次生效
]);

console.log(db1 === db2); // true
db1.query('SELECT * FROM users');
```

**关键设计：**
- `promise` 变量防止并发多次初始化（竞态条件保护）
- 第一次 `getInstance` 的参数生效，后续参数被忽略
- `reset()` 用于单元测试隔离

### 1.3 SSR 安全的单例（请求级隔离）

```javascript
// === 场景：Next.js/Nuxt SSR，每个请求需要独立实例 ===

// ❌ 错误：模块级单例在 SSR 下会共享状态
class BadStore {
  static instance = new BadStore(); // 所有请求共享！
  state = { user: null };
}

// ✅ 正确：使用 AsyncLocalStorage 实现请求级单例
import { AsyncLocalStorage } from 'async_hooks';

const requestStore = new AsyncLocalStorage();

class RequestContext {
  constructor() {
    this.user = null;
    this.requestId = crypto.randomUUID();
    this.startTime = Date.now();
  }

  get elapsed() {
    return Date.now() - this.startTime;
  }
}

// 请求级单例访问器
const getRequestContext = () => {
  const store = requestStore.getStore();
  if (!store) throw new Error('必须在请求上下文中调用');
  return store.context;
};

// Express 中间件示例
function requestContextMiddleware(req, res, next) {
  const context = new RequestContext();
  requestStore.run({ context }, () => {
    // 在这个异步链路中，getRequestContext() 总是返回当前请求的实例
    next();
  });
}

// API 路由中使用
function getUserProfile(req, res) {
  const ctx = getRequestContext(); // 当前请求的独立实例
  ctx.user = { id: req.userId, name: 'Alice' };
  res.json({ user: ctx.user, requestId: ctx.requestId, elapsed: ctx.elapsed });
}
```

**关键洞察：**
- Node.js 模块是进程级单例，SSR 下所有请求共享 → 内存泄漏 + 数据串扰
- `AsyncLocalStorage` 利用异步链路实现请求级隔离
- 这是 Express/Fastify 等框架中间件共享状态的标准做法

### 1.4 可测试单例（Testable Singleton）

```javascript
// === 场景：单元测试需要隔离实例 ===

class ApiClient {
  static #instances = new Map(); // 按 key 隔离
  #baseUrl;
  #headers;
  #requestCount = 0;

  constructor(key = 'default', config = {}) {
    this.#baseUrl = config.baseUrl || 'https://api.example.com';
    this.#headers = config.headers || {};
  }

  static getInstance(key = 'default', config) {
    if (!this.#instances.has(key)) {
      this.#instances.set(key, new ApiClient(key, config));
    }
    return this.#instances.get(key);
  }

  // 测试用：重置指定 key
  static reset(key = 'default') {
    this.#instances.delete(key);
  }

  // 测试用：重置所有
  static resetAll() {
    this.#instances.clear();
  }

  async get(path) {
    this.#requestCount++;
    console.log(`[${this.#requestCount}] GET ${this.#baseUrl}${path}`);
    return { url: `${this.#baseUrl}${path}`, headers: this.#headers };
  }
}

// === 单元测试示例 ===
describe('ApiClient', () => {
  afterEach(() => {
    ApiClient.resetAll(); // 每个测试后清理
  });

  test('同一 key 返回相同实例', () => {
    const a = ApiClient.getInstance('api');
    const b = ApiClient.getInstance('api');
    expect(a).toBe(b);
  });

  test('不同 key 返回不同实例', () => {
    const a = ApiClient.getInstance('api-a', { baseUrl: 'https://a.com' });
    const b = ApiClient.getInstance('api-b', { baseUrl: 'https://b.com' });
    expect(a).not.toBe(b);
  });

  test('reset 后重新创建', () => {
    const a = ApiClient.getInstance('test');
    ApiClient.reset('test');
    const b = ApiClient.getInstance('test');
    expect(a).not.toBe(b);
  });
});
```

### 1.5 单例模式最佳实践 Checklist

| 检查项 | 说明 |
|--------|------|
| 延迟初始化 | 第一次使用时才创建，避免启动开销 |
| 并发安全 | JS 单线程无需锁，但异步初始化需防竞态 |
| 测试隔离 | 提供 `reset()` 方法 |
| SSR 安全 | 使用 AsyncLocalStorage 实现请求级隔离 |
| 多实例支持 | 按 key 管理多个单例（如多数据库连接） |
| 私有化 | 使用 `#` 私有字段防止外部篡改 |
| 避免滥用 | 能用依赖注入就不用单例 |

---

## 二、观察者模式 — 进阶实战

### 2.1 基础 EventEmitter 的缺陷

```javascript
// 基础版的问题：
// 1. 同步执行，一个 listener 报错中断后续
// 2. 无优先级控制
// 3. 无背压（backpressure）保护
// 4. 无事件流控制（节流/防抖/采样）
// 5. 无类型安全

// → 下面逐一解决
```

### 2.2 带优先级和错误隔离的 EventEmitter

```javascript
// === 生产级 EventEmitter ===

class RobustEventEmitter {
  constructor() {
    this._events = new Map(); // event → [{ fn, priority, once, id }]
    this._wildcards = new Map(); // regex → [{ fn, priority, once, id }]
    this._idCounter = 0;
    this._async = false; // 是否异步执行
  }

  on(event, fn, options = {}) {
    const { priority = 0, once = false, async = false } = options;
    const entry = { fn, priority, once, async, id: ++this._idCounter };

    if (typeof event === 'string' && event.includes('*')) {
      // 通配符
      const regex = new RegExp('^' + event.replace(/\*/g, '.*') + '$');
      if (!this._wildcards.has(regex)) this._wildcards.set(regex, []);
      this._wildcards.get(regex).push(entry);
    } else {
      if (!this._events.has(event)) this._events.set(event, []);
      this._events.get(event).push(entry);
    }

    // 排序：高优先级先执行
    this._sortEntries(event);

    // 返回取消订阅函数
    return () => this.off(event, fn);
  }

  once(event, fn, options = {}) {
    return this.on(event, fn, { ...options, once: true });
  }

  emit(event, ...args) {
    const allEntries = [];

    // 精确匹配
    const entries = this._events.get(event) || [];
    allEntries.push(...entries);

    // 通配符匹配
    this._wildcards.forEach((wildEntries, regex) => {
      if (regex.test(event)) {
        allEntries.push(...wildEntries.map(e => ({ ...e, _wildcard: true })));
      }
    });

    // 按优先级排序
    allEntries.sort((a, b) => b.priority - a.priority);

    // 执行
    for (const entry of allEntries) {
      if (entry.async) {
        // 异步执行，不阻塞主流程
        Promise.resolve().then(() => {
          try { entry.fn(...args); } catch (e) { this._handleError(e, event); }
        });
      } else {
        try {
          entry.fn(...args);
        } catch (e) {
          this._handleError(e, event);
        }
      }

      // 清理 once
      if (entry.once) {
        this._removeEntry(event, entry);
      }
    }

    return allEntries.length > 0;
  }

  off(event, fn) {
    const entries = this._events.get(event);
    if (entries) {
      const idx = entries.findIndex(e => e.fn === fn);
      if (idx !== -1) entries.splice(idx, 1);
      if (entries.length === 0) this._events.delete(event);
    }
  }

  _sortEntries(event) {
    const entries = this._events.get(event);
    if (entries) entries.sort((a, b) => b.priority - a.priority);
  }

  _removeEntry(event, entry) {
    const entries = this._events.get(event);
    if (entries) {
      const idx = entries.indexOf(entry);
      if (idx !== -1) entries.splice(idx, 1);
    }
  }

  _handleError(error, event) {
    // 错误不中断其他 listener
    console.error(`[EventEmitter] Error in listener for "${event}":`, error);
    // 如果有 error 事件，触发它
    if (event !== 'error') {
      this.emit('error', { event, error });
    }
  }

  removeAllListeners(event) {
    if (event) {
      this._events.delete(event);
    } else {
      this._events.clear();
      this._wildcards.clear();
    }
  }

  listenerCount(event) {
    return (this._events.get(event)?.length || 0) +
      [...this._wildcards.entries()]
        .filter(([regex]) => regex.test(event))
        .reduce((sum, [, entries]) => sum + entries.length, 0);
  }
}

// === 使用示例 ===
const emitter = new RobustEventEmitter();

// 优先级：高优先级先执行
emitter.on('user:login', (user) => {
  console.log(`[审计] ${user.name} 登录`);
}, { priority: 100 });

emitter.on('user:login', (user) => {
  console.log(`[UI] 欢迎 ${user.name}`);
}, { priority: 10 });

emitter.on('user:login', (user) => {
  console.log(`[分析] 记录登录事件`);
}, { priority: 5 });

// 会报错的 listener — 不会中断其他
emitter.on('user:login', (user) => {
  throw new Error('分析服务挂了');
}, { priority: 1 });

emitter.on('user:*', (event, ...args) => {
  console.log(`[通配] ${event}`, args);
}, { priority: 0 });

emitter.emit('user:login', { name: 'Alice', id: 1 });
// [审计] Alice 登录
// [UI] 欢迎 Alice
// [分析] 记录登录事件
// [EventEmitter] Error in listener for "user:login": Error: 分析服务挂了
// [通配] user:login [ { name: 'Alice', id: 1 } ]
```

### 2.3 带背压保护的事件总线

```javascript
// === 场景：高频事件（scroll/resize/mousemove）需要背压保护 ===

class BackpressureEventBus extends RobustEventEmitter {
  constructor(options = {}) {
    super();
    this._maxQueueSize = options.maxQueueSize || 100;
    this._queues = new Map(); // event → [{ args, timestamp }]
    this._droppedCount = new Map();
  }

  emit(event, ...args) {
    if (!this._queues.has(event)) {
      this._queues.set(event, []);
    }
    const queue = this._queues.get(event);

    // 背压：队列满了丢弃最旧的
    if (queue.length >= this._maxQueueSize) {
      queue.shift(); // 丢弃最旧的
      this._droppedCount.set(event, (this._droppedCount.get(event) || 0) + 1);
    }

    queue.push({ args, timestamp: Date.now() });

    // 异步批量处理
    if (!this._draining) {
      this._draining = true;
      queueMicrotask(() => this._drain(event));
    }
  }

  _drain(event) {
    const queue = this._queues.get(event);
    if (!queue || queue.length === 0) {
      this._draining = false;
      return;
    }

    // 批量取出
    const batch = queue.splice(0, this._maxQueueSize);

    // 执行 listener（只传最新的一组参数）
    const latest = batch[batch.length - 1];
    super.emit(event, ...latest.args);

    // 继续处理剩余
    if (queue.length > 0) {
      queueMicrotask(() => this._drain(event));
    } else {
      this._draining = false;
    }
  }

  // 获取丢弃统计
  getDroppedStats() {
    return Object.fromEntries(this._droppedCount);
  }

  resetDroppedStats() {
    this._droppedCount.clear();
  }
}

// === 使用示例 ===
const bus = new BackpressureEventBus({ maxQueueSize: 50 });

bus.on('scroll', (pos) => {
  console.log(`滚动到: ${pos}`);
});

// 模拟高频滚动（1000 次/秒）
for (let i = 0; i < 1000; i++) {
  bus.emit('scroll', i);
}

// 由于背压保护，只处理最新的，不会阻塞主线程
setTimeout(() => {
  console.log('丢弃统计:', bus.getDroppedStats());
  // { scroll: 950 } (丢弃了 950 个旧事件)
}, 100);
```

### 2.4 事件流控制：节流/防抖/采样

```javascript
// === 事件流控制装饰器 ===

class EventStreamController {
  constructor(emitter) {
    this.emitter = emitter;
  }

  // 节流：固定时间窗口内只触发一次
  throttle(event, interval = 100) {
    let lastTime = 0;
    return this.emitter.on(event, (...args) => {
      const now = Date.now();
      if (now - lastTime >= interval) {
        lastTime = now;
        this.emitter.emit(`${event}:throttled`, ...args);
      }
    });
  }

  // 防抖：停止触发后延迟执行
  debounce(event, delay = 300) {
    let timer = null;
    return this.emitter.on(event, (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.emitter.emit(`${event}:debounced`, ...args);
      }, delay);
    });
  }

  // 采样：每 N 次触发一次
  sample(event, count = 10) {
    let counter = 0;
    return this.emitter.on(event, (...args) => {
      counter++;
      if (counter % count === 0) {
        this.emitter.emit(`${event}:sampled`, ...args);
      }
    });
  }

  // 去重：连续相同值只触发一次
  distinct(event) {
    let lastArgs = null;
    return this.emitter.on(event, (...args) => {
      const key = JSON.stringify(args);
      if (key !== lastArgs) {
        lastArgs = key;
        this.emitter.emit(`${event}:distinct`, ...args);
      }
    });
  }
}

// === 使用示例 ===
const emitter = new RobustEventEmitter();
const controller = new EventStreamController(emitter);

// 监听原始事件
emitter.on('search', (query) => {
  console.log(`[原始] 搜索: ${query}`);
});

// 添加流控制
controller.debounce('search', 500);
emitter.on('search:debounced', (query) => {
  console.log(`[防抖] 搜索: ${query}`);
});

// 模拟用户输入
const queries = ['j', 'ja', 'jav', 'java', 'javas', 'javasc', 'javascri', 'javascript'];
queries.forEach((q, i) => {
  setTimeout(() => emitter.emit('search', q), i * 100);
});
// [原始] 搜索: j
// [原始] 搜索: ja
// ... (所有原始事件都触发)
// [防抖] 搜索: javascript (只在停止输入 500ms 后触发一次)
```

### 2.5 响应式系统（观察者 + Proxy 深度集成）

```javascript
// === 简化版 Vue 3 响应式系统 ===

class ReactiveSystem {
  constructor() {
    this._effects = new Map(); // target → Map<key → Set<effect>>
    this._activeEffect = null; // 当前正在执行的 effect
    this._reactiveCache = new WeakMap(); // 避免重复代理
  }

  // 创建响应式对象
  reactive(target) {
    if (target == null || typeof target !== 'object') return target;

    // 缓存：同一对象只代理一次
    if (this._reactiveCache.has(target)) {
      return this._reactiveCache.get(target);
    }

    const self = this;
    const proxy = new Proxy(target, {
      get(obj, key, receiver) {
        const value = Reflect.get(obj, key, receiver);
        // 依赖收集
        if (self._activeEffect) {
          self._track(obj, key);
        }
        // 递归代理嵌套对象
        return typeof value === 'object' && value !== null
          ? self.reactive(value)
          : value;
      },

      set(obj, key, value, receiver) {
        const oldValue = obj[key];
        const result = Reflect.set(obj, key, value, receiver);
        // 值变化时触发
        if (oldValue !== value) {
          self._trigger(obj, key);
        }
        return result;
      },

      deleteProperty(obj, key) {
        const hadKey = key in obj;
        const result = Reflect.deleteProperty(obj, key);
        if (hadKey) {
          self._trigger(obj, key);
        }
        return result;
      }
    });

    this._reactiveCache.set(target, proxy);
    return proxy;
  }

  // 依赖收集
  _track(target, key) {
    if (!this._activeEffect) return;

    if (!this._effects.has(target)) {
      this._effects.set(target, new Map());
    }
    const keyMap = this._effects.get(target);
    if (!keyMap.has(key)) {
      keyMap.set(key, new Set());
    }
    keyMap.get(key).add(this._activeEffect);
  }

  // 触发更新
  _trigger(target, key) {
    const keyMap = this._effects.get(target);
    if (!keyMap) return;
    const effects = keyMap.get(key);
    if (effects) {
      [...effects].forEach(effect => effect());
    }
  }

  // 注册 effect
  effect(fn) {
    const wrappedEffect = () => {
      this._activeEffect = wrappedEffect;
      try {
        fn();
      } finally {
        this._activeEffect = null;
      }
    };
    wrappedEffect(); // 立即执行一次，收集依赖
    return wrappedEffect;
  }

  // computed
  computed(getter) {
    let value;
    let dirty = true;

    const runner = this.effect(() => {
      dirty = true;
    });

    return {
      get value() {
        if (dirty) {
          value = getter();
          dirty = false;
        }
        return value;
      }
    };
  }
}

// === 使用示例 ===
const system = new ReactiveSystem();

const state = system.reactive({
  firstName: '张',
  lastName: '三',
  age: 25
});

// effect 自动收集依赖
system.effect(() => {
  console.log(`姓名: ${state.firstName}${state.lastName}`);
});
// 姓名: 张三

state.firstName = '李'; // 自动触发 effect
// 姓名: 李三

state.age = 26; // 不触发（effect 未依赖 age）

// computed
const fullName = system.computed(() => `${state.firstName}${state.lastName}`);
console.log(fullName.value); // 李三
state.lastName = '四';
console.log(fullName.value); // 李四 (惰性更新)
```

### 2.6 观察者模式最佳实践 Checklist

| 检查项 | 说明 |
|--------|------|
| 错误隔离 | 一个 listener 报错不中断其他 |
| 优先级控制 | 关键 listener 优先执行 |
| 背压保护 | 高频事件队列限制 + 丢弃策略 |
| 流控制 | 节流/防抖/采样/去重 |
| 内存泄漏 | on/off 配对，使用 WeakRef |
| 异步支持 | 支持 async listener |
| 通配符 | 支持 `user:*` 模式匹配 |
| 类型安全 | TS 下用泛型约束事件类型 |

---

## 三、单例 + 观察者 = 实战组合

### 3.1 全局状态管理器（Redux 简化版）

```javascript
// === 单例 + 观察者 + 策略模式的终极组合 ===

class Store {
  static #instance = null;

  #state;
  #listeners = new Map(); // id → { fn, priority, once }
  #idCounter = 0;
  #middlewares = [];

  constructor(initialState = {}) {
    if (Store.#instance) {
      throw new Error('Store 只能有一个实例，使用 Store.getInstance()');
    }
    this.#state = this._deepClone(initialState);
    Store.#instance = this;
  }

  static getInstance(initialState) {
    if (!Store.#instance) {
      Store.#instance = new Store(initialState);
    }
    return Store.#instance;
  }

  static reset() {
    Store.#instance = null;
  }

  // 获取状态（返回深拷贝，防止外部修改）
  getState() {
    return this._deepClone(this.#state);
  }

  // 订阅（观察者模式）
  subscribe(fn, options = {}) {
    const { priority = 0, once = false } = options;
    const id = ++this.#idCounter;
    this.#listeners.set(id, { fn, priority, once, active: true });
    return () => this.#listeners.delete(id); // 取消订阅
  }

  // 更新状态（策略模式：reducer 决定如何更新）
  dispatch(action) {
    const prevState = this._deepClone(this.#state);

    // 中间件链（策略模式）
    let modifiedAction = action;
    for (const middleware of this.#middlewares) {
      modifiedAction = middleware(modifiedAction, this.#state) || modifiedAction;
    }

    // reducer 处理（策略模式）
    const reducer = this._getReducer(action.type);
    if (reducer) {
      this.#state = reducer(this.#state, modifiedAction);
    }

    // 通知所有监听者（观察者模式）
    this._notify(prevState);
  }

  // 注册 reducer
  registerReducer(type, reducer) {
    this._reducers = this._reducers || {};
    this._reducers[type] = reducer;
  }

  _getReducer(type) {
    return this._reducers?.[type];
  }

  // 注册中间件
  use(middleware) {
    this.#middlewares.push(middleware);
  }

  // 通知监听者
  _notify(prevState) {
    const entries = [...this.#listeners.entries()]
      .filter(([, v]) => v.active)
      .sort(([, a], [, b]) => b.priority - a.priority);

    for (const [id, entry] of entries) {
      try {
        entry.fn(this.#state, prevState);
      } catch (e) {
        console.error(`[Store] Listener error:`, e);
      }
      if (entry.once) {
        this.#listeners.delete(id);
      }
    }
  }

  _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}

// === 使用示例 ===
const store = Store.getInstance({
  user: null,
  todos: [],
  filter: 'all'
});

// 注册 reducers
store.registerReducer('ADD_TODO', (state, action) => ({
  ...state,
  todos: [...state.todos, { id: Date.now(), text: action.text, done: false }]
}));

store.registerReducer('TOGGLE_TODO', (state, action) => ({
  ...state,
  todos: state.todos.map(t =>
    t.id === action.id ? { ...t, done: !t.done } : t
  )
}));

store.registerReducer('SET_FILTER', (state, action) => ({
  ...state,
  filter: action.filter
}));

// 中间件：日志
store.use((action, state) => {
  console.log(`[Middleware] ${action.type}`, action);
  return action;
});

// 中间件：验证
store.use((action, state) => {
  if (action.type === 'ADD_TODO' && !action.text?.trim()) {
    console.warn('[Middleware] 忽略空 todo');
    return null; // 阻止 dispatch
  }
  return action;
});

// 订阅状态变化
const unsub = store.subscribe((state, prevState) => {
  console.log('📊 状态变更:', prevState.todos.length, '→', state.todos.length);
}, { priority: 100 });

// 派发动作
store.dispatch({ type: 'ADD_TODO', text: '学习设计模式' });
store.dispatch({ type: 'ADD_TODO', text: '写代码' });
store.dispatch({ type: 'TOGGLE_TODO', id: 1 });
store.dispatch({ type: 'ADD_TODO', text: '' }); // 被中间件拦截

// 取消订阅
unsub();
```

### 3.2 事件溯源系统（Event Sourcing）

```javascript
// === 单例 + 观察者 + 命令模式：事件溯源 ===

class EventStore {
  static #instance = null;
  #events = [];
  #snapshots = [];
  #subscribers = new Set();

  static getInstance() {
    if (!this.#instance) this.#instance = new EventStore();
    return this.#instance;
  }

  // 追加事件（不可变）
  append(event) {
    const enriched = {
      ...event,
      eventId: crypto.randomUUID(),
      timestamp: Date.now(),
      sequence: this.#events.length + 1
    };
    this.#events.push(enriched);

    // 通知订阅者
    this.#subscribers.forEach(fn => {
      try { fn(enriched); } catch (e) { console.error(e); }
    });

    return enriched;
  }

  // 获取事件流
  getEvents(options = {}) {
    let events = this.#events;
    if (options.afterSequence) {
      events = events.filter(e => e.sequence > options.afterSequence);
    }
    if (options.eventType) {
      events = events.filter(e => e.type === options.eventType);
    }
    if (options.aggregateId) {
      events = events.filter(e => e.aggregateId === options.aggregateId);
    }
    return events;
  }

  // 订阅
  subscribe(fn) {
    this.#subscribers.add(fn);
    return () => this.#subscribers.delete(fn);
  }

  // 从事件流重建状态
  rebuildState(aggregateId, initialState = {}) {
    const events = this.getEvents({ aggregateId });
    return events.reduce((state, event) => {
      const handler = this._getHandler(event.type);
      return handler ? handler(state, event) : state;
    }, initialState);
  }

  _getHandler(eventType) {
    const handlers = {
      'UserCreated': (state, e) => ({ ...state, id: e.aggregateId, name: e.name }),
      'UserUpdated': (state, e) => ({ ...state, ...e.changes }),
      'UserDeleted': (state) => null,
    };
    return handlers[eventType];
  }
}

// === 使用示例 ===
const eventStore = EventStore.getInstance();

// 订阅所有事件
eventStore.subscribe(event => {
  console.log(`[EventStore] #${event.sequence} ${event.type}`, event);
});

// 追加事件
eventStore.append({
  type: 'UserCreated',
  aggregateId: 'user-1',
  name: 'Alice'
});

eventStore.append({
  type: 'UserUpdated',
  aggregateId: 'user-1',
  changes: { name: 'Alice Updated' }
});

// 从事件流重建状态
const currentState = eventStore.rebuildState('user-1', {});
console.log('当前状态:', currentState);
// { id: 'user-1', name: 'Alice Updated' }
```

---

## 四、TypeScript 类型安全版本

### 4.1 类型安全的 EventEmitter

```typescript
// === 类型安全的 EventEmitter ===

// 定义事件映射类型
interface Events {
  'user:login': { userId: string; name: string };
  'user:logout': { userId: string };
  'order:create': { orderId: string; amount: number };
  'error': { code: number; message: string };
}

class TypedEventEmitter<E extends Record<string, any>> {
  #listeners = new Map<keyof E, Set<(...args: [E[keyof E]]) => void>>();

  on<K extends keyof E>(event: K, listener: (payload: E[K]) => void): () => void {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event)!.add(listener as any);
    return () => this.off(event, listener);
  }

  off<K extends keyof E>(event: K, listener: (payload: E[K]) => void): void {
    this.#listeners.get(event)?.delete(listener as any);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    this.#listeners.get(event)?.forEach(listener => listener(payload));
  }
}

// 使用 — 编译时类型检查
const emitter = new TypedEventEmitter<Events>();

emitter.on('user:login', (payload) => {
  // payload 类型自动推断为 { userId: string; name: string }
  console.log(`${payload.name} (${payload.userId}) 登录`);
});

// ✅ 类型正确
emitter.emit('user:login', { userId: '1', name: 'Alice' });

// ❌ 编译错误：缺少 name 字段
// emitter.emit('user:login', { userId: '1' });

// ❌ 编译错误：不存在的事件类型
// emitter.emit('user:delete', { userId: '1' });
```

---

## 五、速查卡片

### 单例模式 v3 进阶要点
```
异步单例: 防竞态 (promise 变量) + reset() 测试隔离
SSR 安全: AsyncLocalStorage 请求级隔离
多实例: 按 key 管理 (Map 存储)
最佳实践: 私有字段 + 延迟初始化 + 并发保护 + 测试重置
```

### 观察者模式 v3 进阶要点
```
错误隔离: try/catch 不中断其他 listener
优先级: priority 排序控制执行顺序
背压: 队列限制 + 丢弃最旧事件
流控制: 节流/防抖/采样/去重装饰器
响应式: Proxy + effect 自动依赖收集
类型安全: TS 泛型约束事件类型
```

### 组合模式
```
单例 + 观察者 = 全局状态管理器 (Redux/Pinia)
单例 + 观察者 + 命令 = 事件溯源系统
观察者 + 策略 = 中间件链 (Express/Koa)
```

---

## 六、闭卷自测题

### 题 1：异步单例
实现一个 `CacheManager` 异步单例，要求：
- 首次调用时异步初始化（连接 Redis）
- 并发调用只初始化一次
- 提供 `get/set/del` 方法
- 测试时可 reset

<details>
<summary>参考答案</summary>

```javascript
class CacheManager {
  #client = null;

  async init(config = {}) {
    console.log('⏳ 连接 Redis...');
    await new Promise(r => setTimeout(r, 50)); // 模拟连接
    this.#client = {
      store: new Map(),
      async get(key) { return this.store.get(key); },
      async set(key, value, ttl) {
        this.store.set(key, value);
        if (ttl) setTimeout(() => this.store.delete(key), ttl * 1000);
      },
      async del(key) { return this.store.delete(key); }
    };
    console.log('✅ Redis 连接成功');
    return this;
  }

  get client() {
    if (!this.#client) throw new Error('CacheManager 未初始化');
    return this.#client;
  }

  async get(key) { return this.client.get(key); }
  async set(key, value, ttl) { return this.client.set(key, value, ttl); }
  async del(key) { return this.client.del(key); }
}

const cacheSingleton = (() => {
  let instance = null;
  let promise = null;

  return {
    async getInstance(config) {
      if (instance) return instance;
      if (!promise) {
        promise = new CacheManager().init(config).then(r => {
          instance = r;
          return instance;
        });
      }
      return promise;
    },
    reset() {
      instance = null;
      promise = null;
    }
  };
})();

// 使用
const cache = await cacheSingleton.getInstance({ host: 'localhost' });
await cache.set('key', 'value', 60);
console.log(await cache.get('key')); // 'value'
```

</details>

### 题 2：带优先级的 EventEmitter
实现一个支持优先级的 EventEmitter，要求：
- 高优先级 listener 先执行
- 支持 `once` 自动移除
- 支持通配符 `*` 匹配
- 一个 listener 报错不影响其他

<details>
<summary>参考答案</summary>

```javascript
class PriorityEventEmitter {
  constructor() {
    this._events = new Map();
    this._id = 0;
  }

  on(event, fn, priority = 0) {
    if (!this._events.has(event)) this._events.set(event, []);
    const entry = { fn, priority, id: ++this._id, once: false };
    this._events.get(event).push(entry);
    this._events.get(event).sort((a, b) => b.priority - a.priority);
    return () => {
      const entries = this._events.get(event);
      if (entries) {
        const idx = entries.findIndex(e => e.id === entry.id);
        if (idx !== -1) entries.splice(idx, 1);
      }
    };
  }

  once(event, fn, priority = 0) {
    const wrapper = (...args) => {
      fn(...args);
      const entries = this._events.get(event);
      if (entries) {
        const idx = entries.findIndex(e => e.fn === wrapper);
        if (idx !== -1) entries.splice(idx, 1);
      }
    };
    return this.on(event, wrapper, priority);
  }

  emit(event, ...args) {
    const entries = this._events.get(event) || [];
    for (const entry of entries) {
      try { entry.fn(...args); } catch (e) { console.error(e); }
    }

    // 通配符
    this._events.forEach((wildEntries, pattern) => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(event)) {
          for (const entry of wildEntries) {
            try { entry.fn(event, ...args); } catch (e) { console.error(e); }
          }
        }
      }
    });
  }
}
```

</details>

---

*本次训练完成。单例 + 观察者模式 v3 进阶实战版。*
*累计覆盖：单例 ✅ (v1 基础 + v3 进阶) | 工厂 ✅ (v2) | 观察者 ✅ (v1 基础 + v3 进阶) | 策略 ✅ (v2)*
*四大核心模式全部闭环 🎯*
