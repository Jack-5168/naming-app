# 专项训练 02:00 — JavaScript 设计模式

> 重点：单例模式 + 观察者模式（2 个核心模式，含完整实现 + 实战 + 面试）

---

## 一、单例模式 (Singleton Pattern)

### 1.1 核心概念

**定义：** 确保一个类只有一个实例，并提供全局访问点。

**本质：** 不是"能不能创建多个"，而是"愿不愿意创建多个"——单例是一种约定，不是强制。

### 1.2 为什么需要单例？

| 场景 | 为什么用单例 |
|------|-------------|
| 全局配置管理 | 配置只应有一份，多处修改会冲突 |
| 数据库连接池 | 连接是昂贵资源，统一管理 |
| 全局状态管理 | Redux store / Pinia store 只有一个 |
| 日志系统 | 日志写入同一个文件/流 |
| 事件总线 | 全局事件通信需要一个中心 |

### 1.3 实现方式演进

#### 方式 1：基础版（模块内变量）

```javascript
// config.js
class Config {
  constructor() {
    this.settings = {
      apiUrl: 'https://api.example.com',
      timeout: 5000,
      retries: 3
    };
  }

  get(key) { return this.settings[key]; }
  set(key, value) { this.settings[key] = value; }
}

// 模块内私有变量 + 导出唯一实例
const instance = new Config();
export default instance;

// 使用
import config from './config.js';
config.set('timeout', 10000);
```

> **点评：** 最简单，ES Module 天然单例（模块只执行一次）。但无法延迟初始化。

#### 方式 2：惰性单例（Lazy Singleton）

```javascript
class Database {
  constructor() {
    this.connection = this._connect();
  }

  _connect() {
    console.log('🔌 数据库连接已建立');
    return { connected: true, pool: [] };
  }

  query(sql) {
    return this.connection.pool.push(sql);
  }

  // 静态方法：全局访问点
  static getInstance() {
    if (!Database._instance) {
      Database._instance = new Database();
    }
    return Database._instance;
  }
}

// 使用
const db1 = Database.getInstance(); // 🔌 数据库连接已建立
const db2 = Database.getInstance(); // (无输出，复用已有实例)
console.log(db1 === db2); // true
```

> **点评：** 延迟初始化，第一次使用时才创建。经典实现。

#### 方式 3：闭包 + 立即执行（隐藏 _instance）

```javascript
const Database = (function () {
  let _instance = null; // 闭包隐藏，外部无法直接访问

  function Database() {
    if (_instance) {
      throw new Error('请使用 Database.getInstance() 获取实例');
    }
    this.connection = this._connect();
  }

  Database.prototype._connect = function () {
    return { connected: true };
  };

  Database.prototype.query = function (sql) {
    return `执行: ${sql}`;
  };

  Database.getInstance = function () {
    if (!_instance) {
      _instance = new Database();
    }
    return _instance;
  };

  return Database;
})();

// 使用
const db = Database.getInstance();
console.log(db.query('SELECT * FROM users')); // 执行: SELECT * FROM users
```

> **点评：** 最安全的传统实现，_instance 被闭包保护，无法从外部篡改。

#### 方式 4：ES6 Class + Proxy（现代版）

```javascript
class Logger {
  constructor() {
    this.logs = [];
  }

  log(message) {
    const entry = `[${new Date().toISOString()}] ${message}`;
    this.logs.push(entry);
    console.log(entry);
  }

  getLogs() { return [...this.logs]; }
}

// 用 Proxy 拦截 new 操作
const SingletonLogger = new Proxy(Logger, {
  construct(target, args) {
    if (!SingletonLogger._instance) {
      SingletonLogger._instance = new target(...args);
    }
    return SingletonLogger._instance;
  }
});

// 使用 — 直接 new，无需 getInstance()
const logger1 = new SingletonLogger();
const logger2 = new SingletonLogger();
console.log(logger1 === logger2); // true
logger1.log('系统启动');
logger2.log('用户登录');
console.log(logger1.getLogs());
// [
//   '[2026-04-27T02:00:00.000Z] 系统启动',
//   '[2026-04-27T02:00:00.001Z] 用户登录'
// ]
```

> **点评：** 最优雅的现代写法，调用方无感知。Proxy 拦截 `new` 操作。

#### 方式 5：TypeScript 版（类型安全）

```typescript
class EventBus {
  private static _instance: EventBus;
  private listeners: Map<string, Set<Function>> = new Map();

  private constructor() {} // private 构造器

  static getInstance(): EventBus {
    if (!EventBus._instance) {
      EventBus._instance = new EventBus();
    }
    return EventBus._instance;
  }

  on(event: string, fn: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(fn => fn(...args));
  }

  off(event: string, fn: Function): void {
    this.listeners.get(event)?.delete(fn);
  }
}

// 使用
const bus = EventBus.getInstance();
bus.on('user:login', (name: string) => console.log(`${name} 登录`));
bus.emit('user:login', 'Alice'); // Alice 登录
```

### 1.4 实战：全局状态管理器（单例 + 响应式）

```javascript
class Store {
  constructor(initialState = {}) {
    if (Store._instance) {
      throw new Error('Store 只能有一个实例');
    }
    this._state = { ...initialState };
    this._listeners = new Set();
    Store._instance = this;
  }

  getState() { return { ...this._state }; }

  setState(partial) {
    const prevState = { ...this._state };
    Object.assign(this._state, partial);
    // 通知所有监听者
    this._listeners.forEach(fn => fn(this._state, prevState));
  }

  subscribe(fn) {
    this._listeners.add(fn);
    // 返回取消订阅函数
    return () => this._listeners.delete(fn);
  }
}

// 创建全局 Store
const store = new Store({ user: null, theme: 'light', count: 0 });

// 监听状态变化
const unsubscribe = store.subscribe((state, prevState) => {
  console.log('状态变更:', prevState, '→', state);
});

store.setState({ count: 1 }); // 状态变更: {count:0} → {count:1}
store.setState({ theme: 'dark' }); // 状态变更: {count:1} → {theme:dark,count:1}

unsubscribe(); // 取消监听
```

### 1.5 单例模式要点总结

| 要点 | 说明 |
|------|------|
| 核心 | 全局唯一实例 + 全局访问点 |
| 关键 | 控制构造器（私有/拦截/约定） |
| 延迟初始化 | 第一次使用时才创建（懒加载） |
| 线程安全 | JS 单线程，无需考虑并发问题 |
| 测试友好 | 提供 resetInstance() 方便单元测试 |
| 反模式 | 不要把单例当全局变量滥用 |

### 1.6 面试高频题

**Q1: 如何实现一个线程安全的单例？**
A: JS 是单线程，不存在多线程并发创建的问题。但在 Node.js 多进程场景下，每个进程有独立内存，单例只在进程内有效。

**Q2: ES Module 天然单例，为什么还要学单例模式？**
A: ES Module 是编译时确定的，无法延迟初始化。单例模式支持懒加载、参数化初始化、运行时控制等更灵活的场景。

**Q3: 单例模式的缺点？**
A: 全局状态导致测试困难、隐藏依赖关系、违反单一职责原则。现代开发中更推荐使用依赖注入。

---

## 二、观察者模式 (Observer Pattern)

### 2.1 核心概念

**定义：** 定义对象间的一对多依赖关系，当一个对象状态改变时，所有依赖它的对象都会收到通知并自动更新。

**别名：** 发布-订阅模式 (Publish-Subscribe)、事件系统 (Event System)

**核心角色：**
- **Subject（被观察者）：** 维护观察者列表，状态变化时通知
- **Observer（观察者）：** 接收通知并执行回调
- **通知机制：** push 模式（主动推送）或 pull 模式（主动拉取）

### 2.2 经典实现

#### 基础版：自定义 EventEmitter

```javascript
class EventEmitter {
  constructor() {
    this._events = new Map(); // event → Set<listener>
  }

  // 订阅
  on(event, listener) {
    if (!this._events.has(event)) {
      this._events.set(event, new Set());
    }
    this._events.get(event).add(listener);
    // 返回取消订阅函数（链式调用友好）
    return () => this.off(event, listener);
  }

  // 一次性订阅
  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    wrapper._original = listener; // 保留引用用于 off
    return this.on(event, wrapper);
  }

  // 发布
  emit(event, ...args) {
    const listeners = this._events.get(event);
    if (!listeners) return false;
    // 用 [...listeners] 避免 listener 中修改集合导致的问题
    [...listeners].forEach(listener => listener(...args));
    return true;
  }

  // 取消订阅
  off(event, listener) {
    const listeners = this._events.get(event);
    if (!listeners) return;
    // 处理 once 注册的包装函数
    listeners.delete(listener);
    listeners.forEach(l => {
      if (l._original === listener) listeners.delete(l);
    });
    if (listeners.size === 0) {
      this._events.delete(event);
    }
  }

  // 移除所有监听
  removeAllListeners(event) {
    if (event) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
  }

  // 获取监听者数量
  listenerCount(event) {
    return this._events.get(event)?.size || 0;
  }
}

// === 使用示例 ===
const emitter = new EventEmitter();

// 基础订阅
emitter.on('data', (msg) => console.log('收到:', msg));
emitter.on('data', (msg) => console.log('也收到:', msg));

emitter.emit('data', 'Hello!');
// 收到: Hello!
// 也收到: Hello!

// 一次性订阅
emitter.once('login', (user) => console.log(`${user} 登录了`));
emitter.emit('login', 'Alice'); // Alice 登录了
emitter.emit('login', 'Bob');   // (无输出，已自动移除)

// 取消订阅
const unsub = emitter.on('update', (v) => console.log('更新:', v));
emitter.emit('update', 42); // 更新: 42
unsub();
emitter.emit('update', 99); // (无输出)

console.log('data 监听者数量:', emitter.listenerCount('data')); // 2
```

### 2.3 进阶：带命名空间的 EventEmitter

```javascript
class NamespacedEmitter extends EventEmitter {
  // 支持命名空间: 'user:login', 'user:logout', 'order:create'
  on(namespace, listener) {
    return super.on(namespace, listener);
  }

  // 支持通配符订阅
  onWildcard(pattern, listener) {
    // 将通配符转为正则: 'user:*' → /^user:.*$/
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    if (!this._wildcards) this._wildcards = new Map();
    if (!this._wildcards.has(regex)) {
      this._wildcards.set(regex, new Set());
    }
    this._wildcards.get(regex).add(listener);
    return () => this._wildcards.get(regex)?.delete(listener);
  }

  emit(event, ...args) {
    // 先触发精确匹配
    super.emit(event, ...args);
    // 再触发通配符匹配
    if (this._wildcards) {
      this._wildcards.forEach((listeners, regex) => {
        if (regex.test(event)) {
          [...listeners].forEach(fn => fn(event, ...args));
        }
      });
    }
  }
}

// 使用
const bus = new NamespacedEmitter();

bus.on('user:login', (name) => console.log(`用户登录: ${name}`));
bus.onWildcard('user:*', (event, ...args) => console.log(`[通配] ${event}`, args));

bus.emit('user:login', 'Alice');
// 用户登录: Alice
// [通配] user:login [ 'Alice' ]

bus.emit('user:logout', 'Bob');
// [通配] user:logout [ 'Bob' ]
```

### 2.4 实战：响应式数据绑定（简化版 Vue）

```javascript
class ReactiveSystem {
  constructor() {
    this._watchers = new Map(); // property → Set<watcher>
  }

  // 创建响应式对象
  reactive(target) {
    const self = this;

    return new Proxy(target, {
      get(obj, key) {
        const value = obj[key];
        // 如果是对象，递归代理
        return typeof value === 'object' && value !== null
          ? self.reactive(value)
          : value;
      },

      set(obj, key, value) {
        const oldValue = obj[key];
        if (oldValue === value) return true;

        obj[key] = value;
        // 通知所有监听该属性的 watcher
        const watchers = self._watchers.get(key);
        if (watchers) {
          [...watchers].forEach(fn => fn(value, oldValue));
        }
        return true;
      }
    });
  }

  // 监听属性变化
  watch(property, callback) {
    if (!this._watchers.has(property)) {
      this._watchers.set(property, new Set());
    }
    this._watchers.get(property).add(callback);
    return () => this._watchers.get(property)?.delete(callback);
  }
}

// === 使用 ===
const system = new ReactiveSystem();
const state = system.reactive({ count: 0, name: 'Alice' });

// 监听 count 变化
system.watch('count', (newVal, oldVal) => {
  console.log(`count: ${oldVal} → ${newVal}`);
});

// 监听 name 变化
system.watch('name', (newVal) => {
  console.log(`name 变为: ${newVal}`);
});

state.count = 1;  // count: 0 → 1
state.count = 2;  // count: 1 → 2
state.name = 'Bob'; // name 变为: Bob
```

### 2.5 实战：DOM 事件代理（观察者 + 委托）

```javascript
class DOMEventBus {
  constructor(root = document) {
    this._root = root;
    this._handlers = new Map(); // eventType → Map<selector → Set<fn>>
  }

  // 事件委托绑定
  delegate(eventType, selector, handler) {
    if (!this._handlers.has(eventType)) {
      this._handlers.set(eventType, new Map());
    }
    const selectorMap = this._handlers.get(eventType);

    if (!selectorMap.has(selector)) {
      selectorMap.set(selector, new Set());
      // 在根元素上绑定一次事件委托
      this._root.addEventListener(eventType, (e) => {
        const handlers = selectorMap.get(selector);
        if (!handlers) return;
        // 检查事件目标是否匹配选择器
        if (e.target.matches(selector)) {
          handlers.forEach(fn => fn.call(e.target, e));
        }
      });
    }

    selectorMap.get(selector).add(handler);
    return () => this.undelegate(eventType, selector, handler);
  }

  undelegate(eventType, selector, handler) {
    this._handlers.get(eventType)?.get(selector)?.delete(handler);
  }

  // 批量绑定
  bindAll(rules) {
    const unsubs = rules.map(({ type, selector, handler }) =>
      this.delegate(type, selector, handler)
    );
    return () => unsubs.forEach(fn => fn());
  }
}

// 使用
const bus = new DOMEventBus(document.querySelector('#app'));

// 委托点击事件
bus.delegate('click', '.btn-delete', function (e) {
  console.log('删除按钮被点击:', this.dataset.id);
});

bus.delegate('click', '.btn-edit', function (e) {
  console.log('编辑按钮被点击:', this.dataset.id);
});
```

### 2.6 观察者 vs 发布-订阅

| 维度 | 观察者模式 | 发布-订阅模式 |
|------|-----------|-------------|
| 耦合度 | 观察者直接订阅 Subject | 通过 Event Channel 解耦 |
| 通信方式 | Subject 直接调用 Observer | Publisher → Channel → Subscriber |
| 典型实现 | Java Observer 接口 | Node.js EventEmitter |
| 适用场景 | 紧密耦合的对象关系 | 松耦合的跨模块通信 |

> **结论：** JS 中的 EventEmitter 本质是发布-订阅模式，但通常被称作观察者模式。两者核心思想一致。

### 2.7 观察者模式要点总结

| 要点 | 说明 |
|------|------|
| 核心 | 一对多依赖 + 自动通知 |
| 关键 API | on/once/off/emit |
| 内存泄漏 | 忘记 off 会导致监听器堆积 |
| 循环引用 | 避免 A 监听 B、B 监听 A 的死循环 |
| 执行顺序 | 同步执行，一个 listener 报错会中断后续 |
| 异步版本 | 可用 setTimeout/queueMicrotask 异步化 |

### 2.8 面试高频题

**Q1: 如何实现一个支持错误处理的 EventEmitter？**
```javascript
class SafeEventEmitter extends EventEmitter {
  emit(event, ...args) {
    const listeners = this._events.get(event);
    if (!listeners) return false;
    [...listeners].forEach(listener => {
      try {
        listener(...args);
      } catch (err) {
        console.error(`Listener error on "${event}":`, err);
      }
    });
    return true;
  }
}
```

**Q2: 观察者模式在 Vue/React 中是怎么应用的？**
- Vue 2: Object.defineProperty 实现响应式 + Watcher 观察者
- Vue 3: Proxy 代理 + Effect 追踪
- React: 不是观察者模式，是单向数据流 + setState 触发重新渲染

**Q3: 观察者模式会导致内存泄漏吗？**
会。如果观察者被销毁但忘记取消订阅，Subject 仍持有观察者引用，导致无法被 GC 回收。解决方案：使用 WeakMap 存储观察者引用，或确保 on/off 配对使用。

---

## 三、两个模式的对比与融合

### 3.1 单例 + 观察者 = 全局事件总线

```javascript
// 最经典的组合：全局唯一的事件总线
class EventBus {
  constructor() {
    if (EventBus._instance) return EventBus._instance;
    this._events = new Map();
    EventBus._instance = this;
  }

  on(event, listener) {
    if (!this._events.has(event)) this._events.set(event, new Set());
    this._events.get(event).add(listener);
    return () => this.off(event, listener);
  }

  once(event, listener) {
    const wrapper = (...args) => { listener(...args); this.off(event, wrapper); };
    return this.on(event, wrapper);
  }

  emit(event, ...args) {
    this._events.get(event)?.forEach(fn => fn(...args));
  }

  off(event, listener) {
    this._events.get(event)?.delete(listener);
  }
}

// 全局唯一，任何模块 import 都是同一个实例
export default new EventBus();
```

### 3.2 何时用哪个？

| 需求 | 推荐模式 |
|------|---------|
| 全局唯一资源 | 单例模式 |
| 一对多通知 | 观察者模式 |
| 全局事件通信 | 单例 + 观察者 |
| 配置管理 | 单例模式 |
| 状态变更通知 | 观察者模式 |

---

## 四、速查表

### 单例模式 Checklist
- [ ] 全局唯一实例
- [ ] 全局访问点（静态方法/模块导出）
- [ ] 延迟初始化（可选）
- [ ] 防止外部 new（私有构造器/Proxy 拦截）
- [ ] 测试时能 reset

### 观察者模式 Checklist
- [ ] on/once 订阅
- [ ] off 取消订阅
- [ ] emit 发布通知
- [ ] 支持多个监听者
- [ ] 防止内存泄漏（off 配对）
- [ ] 错误处理（listener 不中断 others）

---

## 五、代码模板速记

```javascript
// 单例模板
class Singleton {
  static _instance = null;
  constructor() {
    if (Singleton._instance) throw new Error('Use Singleton.getInstance()');
    // init
  }
  static getInstance() {
    if (!Singleton._instance) Singleton._instance = new Singleton();
    return Singleton._instance;
  }
}

// 观察者模板
class EventEmitter {
  constructor() { this._events = new Map(); }
  on(e, fn) { (this._events.get(e) || this._events.set(e, new Set()).get(e)).add(fn); }
  emit(e, ...a) { this._events.get(e)?.forEach(fn => fn(...a)); }
  off(e, fn) { this._events.get(e)?.delete(fn); }
}
```

---

> 📝 本次训练完成。两个模式：单例 + 观察者。覆盖 5 种单例实现 + 3 种观察者实战 + 融合模式。
