# JavaScript 深度专项 v8 — 内存管理、引擎优化与高级模式 (5/4)

**日期:** 2026 年 5 月 4 日 星期一 01:00
**参考:** JavaScript.info 第 5-7 章 + V8 引擎机制 + ES2024
**性质:** 第 8 轮迭代 (4/25→4/27→4/28→4/29→4/30→5/2→5/3→5/4)
**重点:** 闭包/原型/异步/事件循环 — 内存管理 + V8 引擎优化 + 高级模式组合

---

## 训练策略

前 7 轮已覆盖四大主题的完整知识体系和实战技巧。v8 聚焦：
1. **闭包** — WeakRef/FinalizationRegistry/memoization/模块模式
2. **原型** — 私有字段/装饰器进阶/Symbol 模式/Reflect API
3. **异步** — AsyncGenerator/Backpressure/Structured Concurrency/Temporal
4. **事件循环** — V8 引擎内部/Hidden Class/Inline Cache/内存分配

---

## 一、闭包 — 内存管理与高级模式

### 1.1 WeakRef 与 FinalizationRegistry

```javascript
// WeakRef: 弱引用对象，不阻止 GC
// 场景: 缓存大对象但不阻止回收

class WeakCache {
  constructor() {
    this._cache = new Map();
  }

  set(key, value) {
    // 用 WeakRef 包装值，不阻止 GC
    this._cache.set(key, new WeakRef(value));
  }

  get(key) {
    const ref = this._cache.get(key);
    if (!ref) return undefined;
    return ref.deref(); // 如果对象已被 GC，返回 undefined
  }

  has(key) {
    const ref = this._cache.get(key);
    return ref ? ref.deref() !== undefined : false;
  }

  delete(key) {
    return this._cache.delete(key);
  }

  // 清理已被 GC 的条目
  cleanup() {
    for (const [key, ref] of this._cache) {
      if (ref.deref() === undefined) {
        this._cache.delete(key);
      }
    }
  }
}

// 使用: DOM 元素缓存
const domCache = new WeakCache();

function getExpensiveElement(id) {
  let el = domCache.get(id);
  if (!el) {
    el = document.createElement('div');
    el.innerHTML = generateComplexContent(id); // 昂贵操作
    domCache.set(id, el);
  }
  return el;
}

// 当 DOM 元素从文档中移除且无其他引用时，GC 可回收它
// WeakCache 不会阻止回收
```

```javascript
// FinalizationRegistry: 对象被 GC 时的回调
// 场景: 清理关联资源

class ResourceTracker {
  constructor() {
    this._registry = new FinalizationRegistry((heldValue) => {
      console.log(`资源 ${heldValue} 已被 GC，清理关联数据`);
      // 清理关联的网络连接、文件描述符等
      this._cleanup(heldValue);
    });
    this._resources = new Map();
  }

  register(obj, resourceId) {
    this._resources.set(resourceId, { created: Date.now() });
    this._registry.register(obj, resourceId);
  }

  unregister(resourceId) {
    this._resources.delete(resourceId);
    // 注意: FinalizationRegistry 没有 unregister 方法
    // 只能通过让对象被 GC 来触发回调
  }

  _cleanup(resourceId) {
    // 执行清理逻辑
    this._resources.delete(resourceId);
  }

  get stats() {
    return {
      tracked: this._resources.size,
    };
  }
}

// 使用: 跟踪 WebSocket 连接
const tracker = new ResourceTracker();

function createTrackedWebSocket(url) {
  const ws = new WebSocket(url);
  const resourceId = `ws-${url}`;
  tracker.register(ws, resourceId);
  return ws;
}

// 当 WebSocket 对象被 GC 时，自动触发清理
```

```javascript
// 组合使用: WeakRef + FinalizationRegistry 实现智能缓存
class SmartCache {
  constructor(maxSize = 100) {
    this._maxSize = maxSize;
    this._cache = new Map(); // key → { ref: WeakRef, key for cleanup }
    this._order = []; // LRU 顺序 (存 key)

    this._registry = new FinalizationRegistry((key) => {
      // 对象被 GC 后的清理
      this._cache.delete(key);
      const idx = this._order.indexOf(key);
      if (idx !== -1) this._order.splice(idx, 1);
      console.log(`缓存条目 ${key} 已被 GC`);
    });
  }

  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return undefined;

    const value = entry.ref.deref();
    if (value === undefined) {
      // 对象已被 GC
      this._cache.delete(key);
      const idx = this._order.indexOf(key);
      if (idx !== -1) this._order.splice(idx, 1);
      return undefined;
    }

    // LRU: 移到末尾
    const idx = this._order.indexOf(key);
    if (idx !== -1) {
      this._order.splice(idx, 1);
      this._order.push(key);
    }

    return value;
  }

  set(key, value) {
    // 如果已存在，先注销旧的 registry
    const oldEntry = this._cache.get(key);
    if (oldEntry) {
      // 无法从 registry 注销，但旧对象会被 GC
    }

    // 如果超出大小，淘汰最旧的
    while (this._order.length >= this._maxSize) {
      const oldestKey = this._order.shift();
      this._cache.delete(oldestKey);
    }

    this._cache.set(key, { ref: new WeakRef(value) });
    this._order.push(key);
    this._registry.register(value, key);
  }

  get size() {
    return this._order.length;
  }
}
```

### 1.2 Memoization 高级模式

```javascript
// 基础 memoize
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

// 进阶: 带 LRU 淘汰的 memoize
function memoizeLRU(fn, maxSize = 128) {
  const cache = new Map();
  return function (...args) {
    const key = args.length === 1 ? args[0] : JSON.stringify(args);

    if (cache.has(key)) {
      // LRU: 移到末尾
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    }

    const result = fn.apply(this, args);
    cache.set(key, result);

    // 淘汰最旧的
    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return result;
  };
}

// 进阶: 异步 memoize (防瀑布式重复请求)
function memoizeAsync(fn) {
  const cache = new Map();
  const inFlight = new Map(); // 防止并发重复请求

  return async function (...args) {
    const key = JSON.stringify(args);

    // 缓存命中
    if (cache.has(key)) {
      return cache.get(key);
    }

    // 已有进行中的请求，复用
    if (inFlight.has(key)) {
      return inFlight.get(key);
    }

    // 发起新请求
    const promise = fn.apply(this, args).finally(() => {
      inFlight.delete(key);
    });

    inFlight.set(key, promise);

    // 等待完成后缓存结果
    const result = await promise;
    cache.set(key, result);
    return result;
  };
}

// 使用: 防瀑布式 API 请求
const fetchUser = memoizeAsync(async (userId) => {
  const res = await fetch(`/api/users/${userId}`);
  return res.json();
});

// 即使同时调用 10 次，也只发 1 个请求
Promise.all([
  fetchUser(1),
  fetchUser(1),
  fetchUser(1),
]).then((results) => {
  console.log(results[0] === results[1]); // true (同一引用)
});

// 进阶: 带 TTL 的异步 memoize
function memoizeAsyncTTL(fn, ttlMs = 60000) {
  const cache = new Map();
  const inFlight = new Map();

  return async function (...args) {
    const key = JSON.stringify(args);
    const now = Date.now();

    // 检查缓存是否过期
    const cached = cache.get(key);
    if (cached && now - cached.timestamp < ttlMs) {
      return cached.value;
    }

    // 复用进行中的请求
    if (inFlight.has(key)) {
      return inFlight.get(key);
    }

    const promise = fn.apply(this, args).finally(() => {
      inFlight.delete(key);
    });

    inFlight.set(key, promise);
    const result = await promise;

    cache.set(key, { value: result, timestamp: now });
    return result;
  };
}
```

### 1.3 模块模式进阶

```javascript
// 模式: 自包含模块 (IIFE + 闭包)
const EventBus = (() => {
  // 私有状态
  const listeners = new Map();
  const onceListeners = new Map();
  const wildcardListeners = new Set();

  // 私有方法
  function emitToMap(map, event, args) {
    const fns = map.get(event);
    if (fns) {
      for (const fn of fns) {
        fn(...args);
      }
    }
  }

  return Object.freeze({
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => this.off(event, fn); // 返回取消订阅函数
    },

    once(event, fn) {
      const wrapper = (...args) => {
        fn(...args);
        this.off(event, wrapper);
      };
      return this.on(event, wrapper);
    },

    off(event, fn) {
      const fns = listeners.get(event);
      if (fns) fns.delete(fn);
    },

    emit(event, ...args) {
      emitToMap(listeners, event, args);
      emitToMap(onceListeners, event, args);
      for (const fn of wildcardListeners) {
        fn(event, ...args);
      }
    },

    onWildcard(fn) {
      wildcardListeners.add(fn);
      return () => wildcardListeners.delete(fn);
    },

    // 调试: 查看所有监听器
    debug() {
      return {
        listeners: Object.fromEntries(
          [...listeners].map(([k, v]) => [k, v.size])
        ),
        wildcards: wildcardListeners.size,
      };
    },
  });
})();

// 使用
const unsub = EventBus.on('user:login', (user) => {
  console.log(`${user.name} logged in`);
});

EventBus.emit('user:login', { name: '娄总' });
unsub(); // 取消订阅

// 通配符监听
EventBus.onWildcard((event, ...args) => {
  console.log(`[ALL] ${event}`, args);
});
```

```javascript
// 模式: 可组合的模块 (依赖注入)
function createModule(deps) {
  // deps: 依赖的其他模块
  const state = { initialized: false };

  async function init() {
    if (state.initialized) return;
    // 确保依赖先初始化
    for (const dep of Object.values(deps)) {
      if (dep.init) await dep.init();
    }
    state.initialized = true;
  }

  return { init, deps: Object.freeze(deps) };
}

// 模式: 命名空间隔离
const App = (() => {
  // 私有: 不会被外部访问
  let _config = null;
  let _instances = new Map();

  return {
    configure(options) {
      _config = Object.freeze({ ...options });
    },

    get config() {
      return _config;
    },

    register(name, instance) {
      _instances.set(name, instance);
    },

    resolve(name) {
      return _instances.get(name);
    },

    // 子模块
    utils: (() => {
      // 私有工具函数
      function deepClone(obj) {
        return structuredClone(obj);
      }

      return Object.freeze({
        deepClone,
        debounce(fn, ms) {
          let timer;
          return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
          };
        },
      });
    })(),
  };
})();
```

### 1.4 闭包陷阱与调试

```javascript
// 陷阱 1: 循环中的闭包 (经典问题)
// ❌ 错误: 所有函数引用同一个 i
const badFunctions = [];
for (var i = 0; i < 3; i++) {
  badFunctions.push(() => console.log(i));
}
badFunctions.forEach((fn) => fn()); // 输出: 3, 3, 3

// ✅ 修复 1: let 块级作用域
const goodFunctions = [];
for (let i = 0; i < 3; i++) {
  goodFunctions.push(() => console.log(i));
}
goodFunctions.forEach((fn) => fn()); // 输出: 0, 1, 2

// ✅ 修复 2: IIFE 捕获
const fixedFunctions = [];
for (var i = 0; i < 3; i++) {
  (function (capturedI) {
    fixedFunctions.push(() => console.log(capturedI));
  })(i);
}
fixedFunctions.forEach((fn) => fn()); // 输出: 0, 1, 2

// 陷阱 2: 闭包持有不必要的引用
function createHandler(element) {
  const largeBuffer = new ArrayBuffer(1024 * 1024); // 1MB
  const smallId = element.id;

  // ❌ 闭包持有整个词法环境，包括 largeBuffer
  element.addEventListener('click', function () {
    console.log(smallId); // 只用了 smallId
  });
  // largeBuffer 永远不会被 GC!

  // ✅ 修复: 缩小闭包范围
  function handleClick() {
    console.log(smallId);
  }
  // 或者将 largeBuffer 设为 null
  // largeBuffer = null;
}

// 陷阱 3: 递归闭包中的 this
const obj = {
  name: 'test',
  method() {
    setTimeout(function () {
      console.log(this.name); // undefined (this 丢失)
    }, 100);

    setTimeout(() => {
      console.log(this.name); // 'test' (箭头函数捕获 this)
    }, 100);
  },
};
```

---

## 二、原型 — 私有字段、装饰器与元编程

### 2.1 私有字段与私有方法 (ES2022)

```javascript
// 私有字段: # 前缀
class BankAccount {
  #balance; // 真正的私有字段
  #owner;
  #transactions = []; // 私有字段初始化
  static #nextId = 1; // 私有静态字段
  #id;

  constructor(owner, initialBalance = 0) {
    this.#owner = owner;
    this.#balance = initialBalance;
    this.#id = BankAccount.#nextId++;
  }

  // 私有方法
  #addTransaction(type, amount) {
    this.#transactions.push({
      type,
      amount,
      timestamp: Date.now(),
      id: this.#id,
    });
  }

  #validateAmount(amount) {
    if (amount <= 0) throw new Error('金额必须大于 0');
    if (!Number.isFinite(amount)) throw new Error('金额必须是有限数');
  }

  // 公共方法
  deposit(amount) {
    this.#validateAmount(amount);
    this.#balance += amount;
    this.#addTransaction('deposit', amount);
    return this.#balance;
  }

  withdraw(amount) {
    this.#validateAmount(amount);
    if (amount > this.#balance) {
      throw new Error('余额不足');
    }
    this.#balance -= amount;
    this.#addTransaction('withdraw', amount);
    return this.#balance;
  }

  get balance() {
    return this.#balance; // getter 访问私有字段
  }

  // 静态私有方法
  static #generateStatement(account) {
    return `Account #${account.#id}: ${account.#owner} - $${account.#balance}`;
  }

  static getStatement(account) {
    return BankAccount.#generateStatement(account);
  }
}

// 使用
const account = new BankAccount('娄总', 1000);
account.deposit(500);
account.withdraw(200);
console.log(account.balance); // 1300

// ❌ 无法从外部访问私有字段
// console.log(account.#balance); // SyntaxError
// account.#balance = 0; // SyntaxError

// 私有方法只能在类内部调用
// account.#addTransaction(); // SyntaxError

// 静态私有字段
console.log(BankAccount.getStatement(account));
```

```javascript
// 私有字段与继承
class PremiumAccount extends BankAccount {
  #creditLimit;
  #isPremium;

  constructor(owner, initialBalance, creditLimit) {
    super(owner, initialBalance);
    this.#creditLimit = creditLimit;
    this.#isPremium = true;
  }

  // 覆盖: 可以使用 creditLimit
  withdraw(amount) {
    this.#validateAmount(amount); // ❌ 无法访问父类私有方法!
    // 必须通过公共方法或 protected 模式

    // 使用 credit limit
    if (this.balance - amount < -this.#creditLimit) {
      throw new Error('超出信用额度');
    }

    // 调用父类方法
    return super.withdraw(amount);
  }

  // 私有 getter
  get availableCredit() {
    return this.balance + this.#creditLimit;
  }
}

// 重要: 私有字段不继承
// 子类无法访问父类的私有字段/方法
// 这是 JavaScript 的设计选择，与 Java/C++ 不同
```

### 2.2 装饰器进阶 (Stage 3)

```javascript
// 装饰器工厂
function log(label) {
  return function (target, propertyKey, descriptor) {
    const original = descriptor.value;
    descriptor.value = function (...args) {
      const start = performance.now();
      try {
        const result = original.apply(this, args);
        console.log(`[${label}] ${propertyKey} 成功: ${args.join(', ')}`);
        return result;
      } catch (e) {
        console.error(`[${label}] ${propertyKey} 失败:`, e.message);
        throw e;
      } finally {
        const elapsed = performance.now() - start;
        console.log(`[${label}] ${propertyKey} 耗时: ${elapsed.toFixed(2)}ms`);
      }
    };
    return descriptor;
  };
}

// 重试装饰器
function retry(maxAttempts = 3, delayMs = 1000) {
  return function (target, propertyKey, descriptor) {
    const original = descriptor.value;
    descriptor.value = async function (...args) {
      let lastError;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await original.apply(this, args);
        } catch (e) {
          lastError = e;
          console.warn(`[重试] ${propertyKey} 第 ${attempt}/${maxAttempts} 次失败`);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, delayMs * attempt));
          }
        }
      }
      throw lastError;
    };
    return descriptor;
  };
}

// 缓存装饰器
function cache(ttlMs = 300000) {
  const store = new Map();
  return function (target, propertyKey, descriptor) {
    const original = descriptor.value;
    descriptor.value = async function (...args) {
      const key = JSON.stringify(args);
      const entry = store.get(key);
      const now = Date.now();

      if (entry && now - entry.timestamp < ttlMs) {
        return entry.value;
      }

      const result = await original.apply(this, args);
      store.set(key, { value: result, timestamp: now });
      return result;
    };
    return descriptor;
  };
}

// 使用: 组合装饰器
class ApiService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  @log('API')
  @retry(3, 500)
  @cache(60000)
  async getUser(id) {
    const res = await fetch(`${this.baseUrl}/users/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  @log('API')
  @retry(2)
  async searchUsers(query) {
    const res = await fetch(`${this.baseUrl}/users?q=${query}`);
    return res.json();
  }
}
```

```javascript
// 类级别装饰器
function sealed(target) {
  return Object.freeze(target);
}

function observable(target) {
  const observers = new Set();

  target.prototype.subscribe = function (fn) {
    observers.add(fn);
    return () => observers.delete(fn);
  };

  target.prototype.notify = function (data) {
    for (const fn of observers) {
      fn(data);
    }
  };

  return target;
}

// 访问器装饰器
function readonly(target, propertyKey, descriptor) {
  descriptor.writable = false;
  return descriptor;
}

function validate(schema) {
  return function (target, propertyKey, descriptor) {
    const original = descriptor.value;
    descriptor.value = function (...args) {
      // 简化版验证
      for (let i = 0; i < args.length; i++) {
        if (schema[i] && typeof args[i] !== schema[i]) {
          throw new TypeError(
            `参数 ${i} 类型错误: 期望 ${schema[i]}，得到 ${typeof args[i]}`
          );
        }
      }
      return original.apply(this, args);
    };
    return descriptor;
  };
}

// 使用
@sealed
@observable
class UserStore {
  constructor() {
    this.users = new Map();
  }

  @validate(['string', 'object'])
  addUser(id, data) {
    this.users.set(id, data);
    this.notify({ type: 'add', id, data });
  }

  @readonly
  get count() {
    return this.users.size;
  }
}
```

### 2.3 Symbol 高级模式

```javascript
// Symbol: 唯一标识符，用于元编程

// 1. Symbol.iterator: 自定义迭代行为
class Matrix {
  constructor(rows, cols, data = []) {
    this.rows = rows;
    this.cols = cols;
    this.data = data.length ? data : new Array(rows * cols).fill(0);
  }

  // 使 Matrix 可迭代
  *[Symbol.iterator]() {
    for (let i = 0; i < this.rows; i++) {
      const row = [];
      for (let j = 0; j < this.cols; j++) {
        row.push(this.data[i * this.cols + j]);
      }
      yield row;
    }
  }

  // 自定义异步迭代
  async *[Symbol.asyncIterator]() {
    for (let i = 0; i < this.rows; i++) {
      const row = [];
      for (let j = 0; j < this.cols; j++) {
        row.push(this.data[i * this.cols + j]);
      }
      yield row;
      await new Promise((r) => setTimeout(r, 0)); // 让出控制权
    }
  }

  // Symbol.toStringTag: 自定义 toString 输出
  get [Symbol.toStringTag]() {
    return `Matrix(${this.rows}x${this.cols})`;
  }

  // Symbol.hasInstance: 自定义 instanceof 行为
  static [Symbol.hasInstance](obj) {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      'rows' in obj &&
      'cols' in obj &&
      'data' in obj
    );
  }

  // 矩阵运算
  multiply(other) {
    if (this.cols !== other.rows) {
      throw new Error('矩阵维度不匹配');
    }
    const result = new Matrix(this.rows, other.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < other.cols; j++) {
        let sum = 0;
        for (let k = 0; k < this.cols; k++) {
          sum += this.data[i * this.cols + k] * other.data[k * other.cols + j];
        }
        result.data[i * other.cols + j] = sum;
      }
    }
    return result;
  }
}

// 使用
const m = new Matrix(2, 3, [1, 2, 3, 4, 5, 6]);
console.log(m.toString()); // [object Matrix(2x3)]

for (const row of m) {
  console.log(row); // [1, 2, 3] \n [4, 5, 6]
}

console.log(m instanceof Matrix); // true (使用自定义 hasInstance)

// 2. Symbol.for / Symbol.keyFor: 全局 Symbol 注册表
const ID = Symbol.for('app.uniqueId');
const obj1 = { [ID]: 1 };
const obj2 = { [ID]: 2 };

// 不同文件/模块可以使用同一个 Symbol
const retrieved = Symbol.for('app.uniqueId');
console.log(ID === retrieved); // true

// 3. Symbol.dispose (ES2024 提案): 资源管理
// using 关键字 (提案中)
// {
//   using resource = new DisposableResource();
//   // 块结束时自动调用 resource[Symbol.dispose]()
// }

class DisposableResource {
  constructor(name) {
    this.name = name;
    console.log(`资源 ${name} 已创建`);
  }

  [Symbol.dispose]() {
    console.log(`资源 ${this.name} 已释放`);
  }
}

// 4. Symbol.match / Symbol.replace / Symbol.search
class Pattern {
  constructor(regex) {
    this.regex = new RegExp(regex);
  }

  [Symbol.match](text) {
    return this.regex.exec(text);
  }

  [Symbol.replace](text, replacement) {
    return text.replace(this.regex, replacement);
  }
}

const emailPattern = new Pattern('[\\w.]+@[\\w.]+');
console.log('test@example.com'.match(emailPattern)); // 匹配成功
console.log('contact test@example.com here'.replace(emailPattern, '***'));
```

### 2.4 Reflect API 深度使用

```javascript
// Reflect: 与 Object 操作对应的函数式 API
// 优势: 返回值一致、可拦截、无副作用

// 1. Reflect.construct: 等价于 new，但可用数组展开参数
function createWithArgs(Constructor, args) {
  return Reflect.construct(Constructor, args);
}

class User {
  constructor(name, age, email) {
    this.name = name;
    this.age = age;
    this.email = email;
  }
}

const user = createWithArgs(User, ['娄总', 25, 'lou@example.com']);
console.log(user instanceof User); // true

// 2. Reflect.apply: 等价于 Function.prototype.apply
function applyFn(fn, thisArg, args) {
  return Reflect.apply(fn, thisArg, args);
}

const max = Reflect.apply(Math.max, null, [1, 5, 3, 9, 2]);
console.log(max); // 9

// 3. Reflect 在 Proxy 中的使用
function createReactiveObject(target) {
  return new Proxy(target, {
    set(target, property, value, receiver) {
      const oldValue = target[property];
      const result = Reflect.set(target, property, value, receiver);
      if (oldValue !== value) {
        console.log(`属性 ${String(property)} 变化: ${oldValue} → ${value}`);
      }
      return result;
    },

    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      console.log(`访问属性: ${String(property)}`);
      // 如果值是对象，递归代理
      if (value && typeof value === 'object') {
        return createReactiveObject(value);
      }
      return value;
    },

    deleteProperty(target, property) {
      const result = Reflect.deleteProperty(target, property);
      if (result) {
        console.log(`删除属性: ${String(property)}`);
      }
      return result;
    },

    // 拦截 has 操作符 (in)
    has(target, property) {
      console.log(`检查属性存在: ${String(property)}`);
      return Reflect.has(target, property);
    },

    // 拦截 Object.keys / for...in
    ownKeys(target) {
      return Reflect.ownKeys(target).filter(
        (key) => typeof key !== 'symbol' || key.description !== 'private'
      );
    },
  });
}

// 使用
const state = createReactiveObject({
  count: 0,
  user: { name: '娄总' },
});

state.count = 1; // 属性 count 变化: 0 → 1
console.log(state.count); // 访问属性: count → 1

delete state.count; // 删除属性: count
```

---

## 三、异步 — AsyncGenerator、Backpressure 与结构化并发

### 3.1 AsyncGenerator 深度模式

```javascript
// AsyncGenerator: 异步迭代器 + 生成器
// 场景: 流式数据处理、WebSocket、分页加载

// 模式 1: 分页加载
async function* paginate(url, pageSize = 20) {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(`${url}?page=${page}&size=${pageSize}`);
    const data = await res.json();

    yield data.items;

    hasMore = data.items.length === pageSize;
    page++;

    // 防止过快请求
    await new Promise((r) => setTimeout(r, 100));
  }
}

// 使用: 遍历所有分页数据
async function getAllUsers() {
  const allUsers = [];
  for await (const users of paginate('/api/users')) {
    allUsers.push(...users);
    console.log(`已加载 ${allUsers.length} 个用户`);
  }
  return allUsers;
}

// 模式 2: WebSocket 流
async function* websocketStream(url) {
  const ws = new WebSocket(url);

  const messageQueue = [];
  let resolve = null;

  ws.onmessage = (event) => {
    if (resolve) {
      const r = resolve;
      resolve = null;
      r(event.data);
    } else {
      messageQueue.push(event.data);
    }
  };

  ws.onerror = (error) => {
    if (resolve) {
      const r = resolve;
      resolve = null;
      r(Promise.reject(error));
    }
  };

  ws.onclose = () => {
    if (resolve) {
      const r = resolve;
      resolve = null;
      r({ done: true });
    }
  };

  try {
    while (ws.readyState === WebSocket.OPEN) {
      if (messageQueue.length > 0) {
        yield messageQueue.shift();
      } else {
        const data = await new Promise((r) => {
          resolve = r;
        });
        if (data && typeof data === 'object' && data.done) break;
        yield data;
      }
    }
  } finally {
    ws.close();
  }
}

// 模式 3: 带取消的异步生成器
async function* cancellableAsyncGen(asyncIterable, signal) {
  const iterator = asyncIterable[Symbol.asyncIterator]();

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const { value, done } = await Promise.race([
        iterator.next(),
        new Promise((_, reject) => {
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
          }
        }),
      ]);

      if (done) break;
      yield value;
    }
  } finally {
    await iterator.return?.();
  }
}
```

### 3.2 Backpressure 处理

```javascript
// Backpressure: 消费者跟不上生产者时的处理策略

// 策略 1: 缓冲 + 限流
class BackpressureBuffer {
  constructor(maxSize = 100, onFlush) {
    this._buffer = [];
    this._maxSize = maxSize;
    this._onFlush = onFlush;
    this._flushing = false;
  }

  push(item) {
    this._buffer.push(item);

    if (this._buffer.length >= this._maxSize) {
      this._flush();
    }
  }

  async _flush() {
    if (this._flushing || this._buffer.length === 0) return;
    this._flushing = true;

    const batch = this._buffer.splice(0, this._maxSize);
    try {
      await this._onFlush(batch);
    } catch (e) {
      // 失败时放回缓冲区
      this._buffer.unshift(...batch);
      console.error('Flush failed, items returned to buffer');
    } finally {
      this._flushing = false;
      // 如果还有数据，继续 flush
      if (this._buffer.length > 0) {
        this._flush();
      }
    }
  }

  async flush() {
    await this._flush();
  }

  get pending() {
    return this._buffer.length;
  }
}

// 使用: 日志批量上报
const logger = new BackpressureBuffer(50, async (batch) => {
  await fetch('/api/logs', {
    method: 'POST',
    body: JSON.stringify(batch),
  });
});

function log(message) {
  logger.push({ message, timestamp: Date.now() });
}

// 页面卸载时 flush
window.addEventListener('beforeunload', () => {
  logger.flush();
});

// 策略 2: 滑动窗口限流
class SlidingWindowLimiter {
  constructor(maxConcurrent, windowMs = 1000) {
    this._maxConcurrent = maxConcurrent;
    this._windowMs = windowMs;
    this._timestamps = [];
    this._queue = [];
    this._running = 0;
  }

  async submit(fn) {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      this._process();
    });
  }

  _process() {
    while (this._canExecute()) {
      const item = this._queue.shift();
      if (!item) break;

      this._running++;
      this._timestamps.push(Date.now());

      item.fn()
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this._running--;
          this._process();
        });
    }
  }

  _canExecute() {
    if (this._queue.length === 0) return false;
    if (this._running >= this._maxConcurrent) return false;

    // 清理过期时间戳
    const now = Date.now();
    this._timestamps = this._timestamps.filter(
      (t) => now - t < this._windowMs
    );

    return true;
  }

  get stats() {
    return {
      queued: this._queue.length,
      running: this._running,
    };
  }
}

// 使用: 限制并发请求数
const limiter = new SlidingWindowLimiter(5, 1000); // 最多 5 个并发

async function fetchWithLimit(url) {
  return limiter.submit(() => fetch(url).then((r) => r.json()));
}

// 即使同时发起 100 个请求，最多只有 5 个并发
const urls = Array.from({ length: 100 }, (_, i) => `/api/data/${i}`);
const results = await Promise.all(urls.map(fetchWithLimit));
```

### 3.3 Structured Concurrency (结构化并发)

```javascript
// 结构化并发: 子任务的生命周期受父任务管理
// 模式: 父任务取消时，所有子任务自动取消

class TaskGroup {
  constructor() {
    this._controller = new AbortController();
    this._tasks = [];
    this._results = [];
    this._errors = [];
    this._finished = false;
  }

  get signal() {
    return this._controller.signal;
  }

  async spawn(fn) {
    if (this._finished) {
      throw new Error('TaskGroup already finished');
    }

    const task = fn(this._controller.signal);
    this._tasks.push(task);

    return task
      .then((result) => {
        this._results.push(result);
        return result;
      })
      .catch((error) => {
        this._errors.push(error);
        // 一个任务失败，取消所有其他任务
        this.cancel(`Task failed: ${error.message}`);
        throw error;
      });
  }

  cancel(reason = 'Cancelled') {
    if (!this._controller.signal.aborted) {
      this._controller.abort(reason);
    }
  }

  async allSettled() {
    this._finished = true;
    const results = await Promise.allSettled(this._tasks);
    return results;
  }

  async all() {
    this._finished = true;
    return Promise.all(this._tasks);
  }

  get stats() {
    return {
      total: this._tasks.length,
      completed: this._results.length,
      failed: this._errors.length,
      cancelled: this._controller.signal.aborted,
    };
  }
}

// 使用: 并行加载多个资源，一个失败则全部取消
async function loadDashboard() {
  const group = new TaskGroup();

  try {
    // 并行加载
    const userPromise = group.spawn(async (signal) => {
      const res = await fetch('/api/user', { signal });
      return res.json();
    });

    const postsPromise = group.spawn(async (signal) => {
      const res = await fetch('/api/posts', { signal });
      return res.json();
    });

    const statsPromise = group.spawn(async (signal) => {
      const res = await fetch('/api/stats', { signal });
      return res.json();
    });

    // 等待所有完成
    const [user, posts, stats] = await group.all();
    return { user, posts, stats };
  } catch (error) {
    console.error('加载失败:', error.message);
    // 所有进行中的请求已被取消
    throw error;
  }
}

// 使用: 超时控制
async function loadWithTimeout(timeoutMs = 5000) {
  const group = new TaskGroup();

  // 超时任务
  const timeoutPromise = group.spawn(async (signal) => {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, timeoutMs);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
    throw new Error(`Timeout after ${timeoutMs}ms`);
  });

  // 实际数据加载
  const dataPromise = group.spawn(async (signal) => {
    const res = await fetch('/api/data', { signal });
    return res.json();
  });

  // 哪个先完成就用哪个
  const result = await Promise.race([timeoutPromise, dataPromise]);
  group.cancel(); // 取消另一个
  return result;
}
```

### 3.4 Promise 组合高级模式

```javascript
// 模式: Promise.withResolvers (ES2024)
// 创建可外部 resolve/reject 的 Promise

// 传统方式 (反模式)
let resolve, reject;
const promise = new Promise((res, rej) => {
  resolve = res;
  reject = rej;
});

// ES2024 方式
const { promise: p2, resolve: res2, reject: rej2 } = Promise.withResolvers?.() || {
  promise: null, resolve: null, reject: null
};
// 注意: Promise.withResolvers 是 ES2024 提案，可能需要 polyfill

// 模式: 带优先级的 Promise 队列
class PriorityPromiseQueue {
  constructor(concurrency = 3) {
    this._concurrency = concurrency;
    this._running = 0;
    this._queue = []; // { fn, priority, resolve, reject }
  }

  add(fn, priority = 0) {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, priority, resolve, reject });
      this._queue.sort((a, b) => b.priority - a.priority);
      this._process();
    });
  }

  _process() {
    while (this._running < this._concurrency && this._queue.length > 0) {
      const { fn, resolve, reject } = this._queue.shift();
      this._running++;

      Promise.resolve()
        .then(fn)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this._running--;
          this._process();
        });
    }
  }

  get pending() {
    return this._queue.length;
  }

  get active() {
    return this._running;
  }
}

// 使用
const queue = new PriorityPromiseQueue(2);

// 低优先级
queue.add(() => fetch('/api/background').then(r => r.json()), 0);

// 高优先级
queue.add(() => fetch('/api/urgent').then(r => r.json()), 10);

// 中等优先级
queue.add(() => fetch('/api/normal').then(r => r.json()), 5);

// 模式: Promise 超时包装
function withTimeout(promise, ms, message = 'Timeout') {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]);
}

// 模式: Promise 重试 (指数退避)
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = baseDelay * Math.pow(2, attempt) * (0.5 + Math.random());
      console.warn(`重试第 ${attempt + 1} 次，延迟 ${delay.toFixed(0)}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// 模式: Promise 限流 (令牌桶)
class TokenBucket {
  constructor(tokensPerSecond, maxTokens) {
    this._maxTokens = maxTokens;
    this._tokens = maxTokens;
    this._rate = tokensPerSecond;
    this._lastRefill = Date.now();
    this._queue = [];
  }

  _refill() {
    const now = Date.now();
    const elapsed = (now - this._lastRefill) / 1000;
    this._tokens = Math.min(
      this._maxTokens,
      this._tokens + elapsed * this._rate
    );
    this._lastRefill = now;
  }

  async acquire() {
    this._refill();

    if (this._tokens >= 1) {
      this._tokens -= 1;
      return;
    }

    // 等待令牌
    return new Promise((resolve) => {
      this._queue.push(resolve);
      this._scheduleRefill();
    });
  }

  _scheduleRefill() {
    if (this._queue.length === 0) return;

    const waitTime = ((1 - this._tokens) / this._rate) * 1000;
    setTimeout(() => {
      this._refill();
      while (this._tokens >= 1 && this._queue.length > 0) {
        this._tokens -= 1;
        const resolve = this._queue.shift();
        resolve();
      }
      if (this._queue.length > 0) {
        this._scheduleRefill();
      }
    }, Math.max(0, waitTime));
  }
}

// 使用: API 限流
const bucket = new TokenBucket(10, 20); // 每秒 10 个请求，最多 20 个突发

async function rateLimitedFetch(url) {
  await bucket.acquire();
  return fetch(url);
}
```

---

## 四、事件循环 — V8 引擎内部机制

### 4.1 V8 执行模型深度

```javascript
// V8 执行流程: 源码 → AST → Ignition 字节码 → TurboFan 优化代码

// 阶段 1: 解析 (Parsing)
// V8 将 JS 源码解析为 AST (抽象语法树)
// 这是一个 CPU 密集型操作，发生在主线程

// 阶段 2: 编译 (Compilation)
// Ignition: 解释器，快速将 AST 编译为字节码
// TurboFan: 优化编译器，将热点代码编译为机器码

// 阶段 3: 优化 (Optimization)
// TurboFan 基于类型反馈进行优化
// 如果类型变化，会 deoptimization (去优化)

// 示例: 类型反馈影响优化
function add(a, b) {
  return a + b;
}

// 调用 1: 数字 + 数字 → V8 记录类型反馈 (Number, Number) → 优化为机器码
add(1, 2); // 快速路径: 直接机器码加法

// 调用 2: 字符串 + 字符串 → 类型反馈一致 → 仍使用优化代码
add('a', 'b'); // 快速路径: 直接字符串拼接

// 调用 3: 数字 + 字符串 → 类型反馈不一致 → Deoptimization!
add(1, 'a'); // 回退到字节码解释执行，重新收集类型反馈

// 调用 4: 对象 + 数字 → 再次 Deoptimization
add({ valueOf: () => 1 }, 2); // 再次回退

// 结论: 保持函数参数类型一致，有助于 V8 优化
function addNumbers(a, b) {
  return a + b; // 始终接收数字
}

function addStrings(a, b) {
  return a + b; // 始终接收字符串
}
```

### 4.2 Hidden Class (隐藏类) 与内联缓存

```javascript
// Hidden Class: V8 动态创建的内部类结构
// 用于快速属性访问

// 示例: 相同结构的对象共享 Hidden Class
function createUser(name, age) {
  // ✅ 正确: 相同的属性初始化顺序 → 共享 Hidden Class
  return { name: name, age: age };
}

const user1 = createUser('Alice', 25);
const user2 = createUser('Bob', 30);
// user1 和 user2 共享同一个 Hidden Class
// 属性访问: 内联缓存命中 → 极快

// ❌ 错误: 动态添加属性 → 创建新 Hidden Class
const user3 = {};
user3.name = 'Charlie';
user3.age = 35;
// user3 有独立的 Hidden Class
// 属性访问: 内联缓存未命中 → 较慢

// ❌ 更差: 删除属性 → Hidden Class 退化
const user4 = { name: 'Dave', age: 40 };
delete user4.age;
// Hidden Class 变为 "字典模式"
// 属性访问: 哈希表查找 → 更慢

// 性能测试
function testHiddenClass() {
  // 测试 1: 共享 Hidden Class
  console.time('shared');
  const objects1 = [];
  for (let i = 0; i < 1000000; i++) {
    objects1.push({ x: i, y: i * 2 });
  }
  let sum1 = 0;
  for (const obj of objects1) {
    sum1 += obj.x + obj.y;
  }
  console.timeEnd('shared'); // ~15ms

  // 测试 2: 不同 Hidden Class
  console.time('different');
  const objects2 = [];
  for (let i = 0; i < 1000000; i++) {
    const obj = {};
    obj.x = i;
    obj.y = i * 2;
    objects2.push(obj);
  }
  let sum2 = 0;
  for (const obj of objects2) {
    sum2 += obj.x + obj.y;
  }
  console.timeEnd('different'); // ~25ms (慢 60%)

  // 测试 3: 字典模式
  console.time('dictionary');
  const objects3 = [];
  for (let i = 0; i < 1000000; i++) {
    const obj = { x: i, y: i * 2 };
    delete obj.y;
    obj.y = i * 2;
    objects3.push(obj);
  }
  let sum3 = 0;
  for (const obj of objects3) {
    sum3 += obj.x + obj.y;
  }
  console.timeEnd('dictionary'); // ~40ms (慢 160%)
}

// 最佳实践:
// 1. 构造函数中初始化所有属性
// 2. 保持属性初始化顺序一致
// 3. 避免 delete 操作 (设为 undefined 代替)
// 4. 避免动态添加属性
```

### 4.3 内存分配与 GC 机制

```javascript
// V8 内存分代:
// - Young Generation (新生代): 快速分配/回收，Survival Space + Allocation Space
// - Old Generation (老生代): 长期存活对象，Mark-Sweep + Mark-Compact

// 新生代 GC (Scavenge): 快速，通常 < 5ms
// 老生代 GC (Mark-Sweep/Mark-Compact): 较慢，可能 > 50ms

// 内存泄漏检测工具
function detectMemoryLeaks() {
  if (typeof performance.memory === 'undefined') {
    console.log('performance.memory 不可用 (仅 Chrome/Edge)');
    return;
  }

  const report = () => {
    const mem = performance.memory;
    console.log({
      usedMB: (mem.usedJSHeapSize / 1048576).toFixed(2),
      totalMB: (mem.totalJSHeapSize / 1048576).toFixed(2),
      limitMB: (mem.jsHeapSizeLimit / 1048576).toFixed(0),
    });
  };

  return { report };
}

// 常见内存泄漏模式
class MemoryLeakPatterns {
  // 模式 1: 意外全局变量
  leak1() {
    // ❌ 未声明的变量成为全局属性
    leakedVar = 'this leaks memory';
    // ✅ 修复: 使用 'use strict' 或在构造函数中声明
  }

  // 模式 2: 未清理的定时器
  leak2() {
    // ❌ 定时器持有外部引用
    this._timer = setInterval(() => {
      // 即使组件已卸载，定时器仍在运行
      console.log('leaking...');
    }, 1000);
    // ✅ 修复: 在组件卸载时 clearInterval
  }

  // 模式 3: 闭包持有大对象
  leak3() {
    const largeData = new Array(1000000).fill('x');
    this._handler = () => {
      // 即使这里没用到 largeData
      // 闭包仍持有整个词法环境
      console.log('clicked');
    };
    // ✅ 修复: 将 largeData 设为 null
  }

  // 模式 4: DOM 引用未清理
  leak4() {
    // ❌ 保存 DOM 引用但元素已从文档移除
    this._savedElement = document.getElementById('dynamic-element');
    document.getElementById('dynamic-element')?.remove();
    // 元素无法被 GC，因为 _savedElement 仍持有引用
    // ✅ 修复: this._savedElement = null;
  }

  // 模式 5: 事件监听器未移除
  leak5(element) {
    // ❌ 添加监听器但未保存引用，无法移除
    element.addEventListener('click', function handler() {
      console.log('clicked');
    });
    // ✅ 修复: 保存引用并移除
    const handler = () => console.log('clicked');
    element.addEventListener('click', handler);
    // element.removeEventListener('click', handler);
  }

  // 清理方法
  cleanup() {
    if (this._timer) clearInterval(this._timer);
    this._savedElement = null;
    this._handler = null;
  }
}

// 使用 WeakRef 避免内存泄漏
class SafeCache {
  constructor() {
    this._cache = new Map();
  }

  set(key, value) {
    // 使用 WeakRef 不阻止 GC
    this._cache.set(key, new WeakRef(value));
  }

  get(key) {
    const ref = this._cache.get(key);
    return ref?.deref(); // 如果已被 GC，返回 undefined
  }

  // 定期清理死引用
  sweep() {
    for (const [key, ref] of this._cache) {
      if (ref.deref() === undefined) {
        this._cache.delete(key);
      }
    }
  }
}
```

### 4.4 事件循环完整剖析

```javascript
// 浏览器事件循环:
// 1. 执行调用栈中的同步代码
// 2. 执行所有微任务 (Promise.then, queueMicrotask, MutationObserver)
// 3. 渲染 (如果必要)
// 4. 执行一个宏任务 (setTimeout, setInterval, I/O, UI 事件)
// 5. 重复 2-4

// 宏任务 vs 微任务:
// 宏任务: setTimeout, setInterval, setImmediate (Node.js), I/O, UI 渲染
// 微任务: Promise.then/catch/finally, queueMicrotask, MutationObserver,
//         Object.observe (已废弃), process.nextTick (Node.js)

// 关键规则:
// 1. 微任务在当前宏任务结束后、下一个宏任务前全部执行
// 2. 微任务中可以添加新的微任务，会继续执行直到清空
// 3. 宏任务之间可能有渲染

// 示例: 执行顺序
console.log('1. 同步代码开始');

Promise.resolve().then(() => console.log('2. 微任务 1'));

setTimeout(() => console.log('3. 宏任务 1 (setTimeout)'), 0);

queueMicrotask(() => console.log('4. 微任务 2 (queueMicrotask)'));

Promise.resolve().then(() => {
  console.log('5. 微任务 3');
  // 微任务中添加微任务
  queueMicrotask(() => console.log('6. 微任务 3.1 (嵌套)'));
});

console.log('7. 同步代码结束');

// 输出顺序:
// 1. 同步代码开始
// 7. 同步代码结束
// 2. 微任务 1
// 4. 微任务 2 (queueMicrotask)
// 5. 微任务 3
// 6. 微任务 3.1 (嵌套)
// 3. 宏任务 1 (setTimeout)

// 示例: 微任务风暴 (危险!)
function microtaskStorm() {
  let count = 0;
  function schedule() {
    queueMicrotask(() => {
      count++;
      if (count < 1000000) {
        schedule(); // 无限递归微任务!
      } else {
        console.log(`执行了 ${count} 个微任务`);
      }
    });
  }
  schedule();
  // 这会导致主线程被微任务长时间占用
  // 浏览器 UI 完全无响应
}

// 示例: 渲染时机
function renderTimingDemo() {
  const el = document.getElementById('test');

  // 同步修改
  el.style.color = 'red';
  el.style.fontSize = '20px';
  // 浏览器不会立即渲染，会等到微任务清空后

  // Promise.then 中的修改
  Promise.resolve().then(() => {
    el.style.color = 'blue';
    // 浏览器仍不会立即渲染
  });

  // setTimeout 中的修改
  setTimeout(() => {
    el.style.color = 'green';
    // 此时浏览器可能已经渲染了之前的修改
  }, 0);

  // requestAnimationFrame 中的修改
  requestAnimationFrame(() => {
    el.style.color = 'yellow';
    // 在渲染前执行
  });
}

// 示例: Node.js 事件循环 (与浏览器不同)
// Node.js 事件循环阶段:
// 1. timers: setTimeout/setInterval 回调
// 2. pending callbacks: 系统操作回调
// 3. idle, prepare: 内部使用
// 4. poll: I/O 回调，最重要的阶段
// 5. check: setImmediate 回调
// 6. close callbacks: 关闭回调

// 在 Node.js 中:
// setTimeout(() => console.log('timeout'), 0);
// setImmediate(() => console.log('immediate'));
// 输出顺序不确定! 取决于事件循环的当前阶段

// process.nextTick 在所有阶段之后执行 (优先级最高)
// setTimeout(() => console.log('timeout'), 0);
// process.nextTick(() => console.log('nextTick'));
// 输出: nextTick → timeout (nextTick 优先级更高)
```

### 4.5 性能分析与调试工具

```javascript
// 工具 1: Performance API 深度分析
class PerformanceAnalyzer {
  constructor() {
    this._marks = new Map();
  }

  // 标记开始
  start(label) {
    performance.mark(`${label}-start`);
    this._marks.set(label, performance.now());
  }

  // 标记结束并输出
  end(label) {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);

    const duration = performance.now() - this._marks.get(label);
    console.log(`[${label}] ${duration.toFixed(3)}ms`);

    // 清理
    performance.clearMarks(`${label}-start`);
    performance.clearMarks(`${label}-end`);
    this._marks.delete(label);
  }

  // 获取所有性能条目
  getEntries(type = 'measure') {
    return performance.getEntriesByType(type);
  }

  // 分析长任务
  observeLongTasks(callback) {
    if (typeof PerformanceObserver !== 'undefined') {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          callback({
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name,
          });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
      return observer;
    }
  }

  // 分析 FPS
  observeFPS(callback) {
    let frames = 0;
    let lastTime = performance.now();

    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        callback(frames);
        frames = 0;
        lastTime = now;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// 工具 2: 内存快照对比
function takeMemorySnapshot() {
  if (typeof performance.memory === 'undefined') {
    return null;
  }
  return {
    usedJSHeapSize: performance.memory.usedJSHeapSize,
    totalJSHeapSize: performance.memory.totalJSHeapSize,
    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
    timestamp: Date.now(),
  };
}

// 使用: 对比操作前后的内存变化
const before = takeMemorySnapshot();
// ... 执行操作 ...
const after = takeMemorySnapshot();

if (before && after) {
  const diff = after.usedJSHeapSize - before.usedJSHeapSize;
  console.log(`内存变化: ${(diff / 1024 / 1024).toFixed(2)} MB`);
  if (diff > 10 * 1024 * 1024) {
    console.warn('⚠️ 内存增长超过 10MB，可能存在泄漏');
  }
}

// 工具 3: 调用栈分析
function analyzeCallStack() {
  const error = new Error();
  const stack = error.stack.split('\n').slice(2); // 去掉 Error 和 analyzeCallStack
  return stack.map((line) => line.trim());
}

// 工具 4: 异步调用栈追踪 (Async Stack Traces)
// V8 默认保留异步调用栈 (Chrome/Node.js)
async function traceAsyncStack() {
  try {
    await level1();
  } catch (e) {
    console.log(e.stack);
    // 输出包含完整的异步调用链:
    // Error: something went wrong
    //     at level3 (...)
    //     at async level2 (...)
    //     at async level1 (...)
  }
}

async function level1() {
  await level2();
}

async function level2() {
  await level3();
}

async function level3() {
  throw new Error('something went wrong');
}
```

---

## 五、综合实战 — 四大主题组合

### 5.1 响应式状态管理系统 (闭包 + 原型 + 异步 + 事件循环)

```javascript
// 完整的响应式状态管理系统
// 融合: 闭包(私有状态) + 原型(继承) + 异步(批量更新) + 事件循环(调度)

class ReactiveState {
  #subscriptions = new Map(); // 闭包私有字段
  #batchQueue = []; // 批量更新队列
  #batchScheduled = false; // 事件循环调度标记
  #version = 0; // 版本号 (用于调试)

  constructor(initialState = {}) {
    // 使用 Proxy 实现响应式
    this._state = this._createProxy(initialState);
  }

  // 私有方法: 创建嵌套 Proxy
  #createProxy(target, path = '') {
    return new Proxy(target, {
      set: (obj, prop, value, receiver) => {
        const fullPath = path ? `${path}.${String(prop)}` : String(prop);
        const oldValue = obj[prop];

        if (oldValue === value) return true;

        const result = Reflect.set(obj, prop, value, receiver);
        if (result) {
          this.#notify(fullPath, value, oldValue);
        }
        return result;
      },

      get: (obj, prop) => {
        const value = Reflect.get(obj, prop);
        // 嵌套对象也代理
        if (value && typeof value === 'object') {
          return this.#createProxy(value, path ? `${path}.${String(prop)}` : String(prop));
        }
        return value;
      },
    });
  }

  // 通知订阅者 (批量调度)
  #notify(path, newValue, oldValue) {
    this.#batchQueue.push({ path, newValue, oldValue, version: ++this.#version });

    if (!this.#batchScheduled) {
      this.#batchScheduled = true;
      // 使用 queueMicrotask 批量处理 (微任务阶段)
      queueMicrotask(() => {
        this.#flushBatch();
      });
    }
  }

  // 批量执行通知
  #flushBatch() {
    const batch = this.#batchQueue.splice(0);
    this.#batchScheduled = false;

    // 合并同一路径的多次更新
    const merged = new Map();
    for (const item of batch) {
      if (!merged.has(item.path)) {
        merged.set(item.path, item);
      } else {
        const existing = merged.get(item.path);
        existing.newValue = item.newValue; // 保留最新值
        existing.version = item.version;
      }
    }

    // 通知订阅者
    for (const [path, change] of merged) {
      const subs = this.#subscriptions.get(path);
      if (subs) {
        for (const sub of subs) {
          try {
            sub(change.newValue, change.oldValue, change);
          } catch (e) {
            console.error(`Subscription error at ${path}:`, e);
          }
        }
      }

      // 通知通配符订阅
      const wildcardSubs = this.#subscriptions.get('*');
      if (wildcardSubs) {
        for (const sub of wildcardSubs) {
          try {
            sub(change.newValue, change.oldValue, change);
          } catch (e) {
            console.error(`Wildcard subscription error:`, e);
          }
        }
      }
    }
  }

  // 公共 API
  get state() {
    return this._state;
  }

  subscribe(path, callback) {
    if (!this.#subscriptions.has(path)) {
      this.#subscriptions.set(path, new Set());
    }
    this.#subscriptions.get(path).add(callback);

    // 返回取消订阅函数 (闭包)
    return () => {
      const subs = this.#subscriptions.get(path);
      if (subs) subs.delete(callback);
    };
  }

  // 批量更新 (单次通知)
  batch(updateFn) {
    // 临时禁用自动通知
    const originalNotify = this.#notify.bind(this);
    let pendingChanges = [];

    this.#notify = (path, newValue, oldValue) => {
      pendingChanges.push({ path, newValue, oldValue });
    };

    try {
      updateFn(this._state);
    } finally {
      this.#notify = originalNotify;
      // 批量通知
      for (const change of pendingChanges) {
        this.#notify(change.path, change.newValue, change.oldValue);
      }
    }
  }

  // 计算属性
  computed(getter, dependencies = []) {
    let value = getter();
    const unsubscribes = [];

    for (const path of dependencies) {
      const unsub = this.subscribe(path, () => {
        value = getter();
      });
      unsubscribes.push(unsub);
    }

    return {
      get value() {
        return value;
      },
      dispose() {
        unsubscribes.forEach((unsub) => unsub());
      },
    };
  }

  // 调试
  debug() {
    return {
      subscriptions: Object.fromEntries(
        [...this.#subscriptions].map(([k, v]) => [k, v.size])
      ),
      pendingBatch: this.#batchQueue.length,
      version: this.#version,
    };
  }
}

// 使用示例
const store = new ReactiveState({
  user: { name: '娄总', age: 25 },
  settings: { theme: 'dark', lang: 'zh' },
});

// 订阅
const unsub1 = store.subscribe('user.name', (newVal, oldVal) => {
  console.log(`用户名变化: ${oldVal} → ${newVal}`);
});

const unsub2 = store.subscribe('user.age', (newVal) => {
  console.log(`年龄更新: ${newVal}`);
});

// 通配符订阅
const unsub3 = store.subscribe('*', (newVal, oldVal, change) => {
  console.log(`[${change.path}] ${change.oldValue} → ${change.newValue}`);
});

// 修改状态
store.state.user.name = '娄总 Pro'; // 触发通知
store.state.user.age = 26; // 触发通知

// 批量更新 (只触发一次通知)
store.batch((state) => {
  state.user.name = '娄总 Ultra';
  state.user.age = 27;
  state.settings.theme = 'light';
});

// 计算属性
const displayName = store.computed(
  () => `${store.state.user.name} (${store.state.user.age}岁)`,
  ['user.name', 'user.age']
);
console.log(displayName.value); // "娄总 Ultra (27岁)"

// 清理
unsub1();
unsub2();
unsub3();
displayName.dispose();
console.log(store.debug());
```

### 5.2 异步任务调度器 (事件循环 + 异步 + 闭包)

```javascript
// 高级异步任务调度器
// 融合: 事件循环调度 + 异步控制流 + 闭包状态管理

class AsyncTaskScheduler {
  #tasks = new Map(); // taskId → task info
  #running = new Set(); // 正在运行的 task ids
  #counter = 0;
  #concurrency;
  #priorityQueue = [];
  #idleResolve = null;

  constructor(options = {}) {
    this.#concurrency = options.concurrency || 3;
    this.#maxRetries = options.maxRetries || 0;
    this.#timeout = options.timeout || 30000;
    this.#onError = options.onError || console.error;
  }

  // 提交任务
  submit(fn, options = {}) {
    const id = ++this.#counter;
    const priority = options.priority || 0;
    const retries = options.retries ?? this.#maxRetries;

    const task = {
      id,
      fn,
      priority,
      retries,
      attempts: 0,
      status: 'pending',
      result: null,
      error: null,
      startTime: null,
      endTime: null,
      controller: new AbortController(),
    };

    this.#tasks.set(id, task);
    this.#priorityQueue.push(task);
    this.#priorityQueue.sort((a, b) => b.priority - a.priority);

    this.#schedule();

    return {
      id,
      promise: this.#waitForTask(id),
      cancel: () => this.cancel(id),
      get status: () => task.status,
    };
  }

  // 调度执行
  #schedule() {
    while (
      this.#running.size < this.#concurrency &&
      this.#priorityQueue.length > 0
    ) {
      const task = this.#priorityQueue.shift();
      if (!task || task.status === 'cancelled') continue;

      this.#running.add(task.id);
      task.status = 'running';
      task.startTime = performance.now();

      this.#execute(task);
    }

    // 如果没有任务了，resolve idle promise
    if (this.#priorityQueue.length === 0 && this.#running.size === 0) {
      if (this.#idleResolve) {
        const resolve = this.#idleResolve;
        this.#idleResolve = null;
        resolve();
      }
    }
  }

  // 执行单个任务 (带重试和超时)
  async #execute(task) {
    try {
      // 超时控制
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          task.controller.abort();
          reject(new Error(`Task ${task.id} timeout after ${this.#timeout}ms`));
        }, this.#timeout);
      });

      const result = await Promise.race([
        task.fn(task.controller.signal),
        timeoutPromise,
      ]);

      task.status = 'completed';
      task.result = result;
      task.endTime = performance.now();
    } catch (error) {
      task.attempts++;

      if (task.attempts <= task.retries && !task.controller.signal.aborted) {
        // 重试
        task.status = 'pending';
        this.#priorityQueue.push(task);
        this.#priorityQueue.sort((a, b) => b.priority - a.priority);
        console.warn(`Task ${task.id} 重试 ${task.attempts}/${task.retries}`);
      } else {
        task.status = 'failed';
        task.error = error;
        task.endTime = performance.now();
        this.#onError(error, task);
      }
    } finally {
      this.#running.delete(task.id);
      this.#schedule();
    }
  }

  // 等待任务完成
  #waitForTask(id) {
    return new Promise((resolve, reject) => {
      const check = () => {
        const task = this.#tasks.get(id);
        if (!task) return reject(new Error(`Task ${id} not found`));

        if (task.status === 'completed') return resolve(task.result);
        if (task.status === 'failed') return reject(task.error);
        if (task.status === 'cancelled') return reject(new Error('Cancelled'));

        // 继续等待 (使用 microtask 检查)
        queueMicrotask(check);
      };
      queueMicrotask(check);
    });
  }

  // 取消任务
  cancel(id) {
    const task = this.#tasks.get(id);
    if (!task) return false;

    if (task.status === 'pending') {
      const idx = this.#priorityQueue.indexOf(task);
      if (idx !== -1) this.#priorityQueue.splice(idx, 1);
    }

    task.status = 'cancelled';
    task.controller.abort();
    return true;
  }

  // 等待所有任务完成
  async idle() {
    if (this.#priorityQueue.length === 0 && this.#running.size === 0) {
      return;
    }
    return new Promise((resolve) => {
      this.#idleResolve = resolve;
    });
  }

  // 统计
  get stats() {
    const tasks = [...this.#tasks.values()];
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      running: tasks.filter((t) => t.status === 'running').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      cancelled: tasks.filter((t) => t.status === 'cancelled').length,
      queueLength: this.#priorityQueue.length,
    };
  }

  // 平均执行时间
  get avgDuration() {
    const completed = [...this.#tasks.values()].filter(
      (t) => t.status === 'completed' && t.startTime && t.endTime
    );
    if (completed.length === 0) return 0;
    const total = completed.reduce(
      (sum, t) => sum + (t.endTime - t.startTime),
      0
    );
    return total / completed.length;
  }
}

// 使用示例
const scheduler = new AsyncTaskScheduler({
  concurrency: 3,
  maxRetries: 2,
  timeout: 10000,
});

// 提交任务
const task1 = scheduler.submit(
  async (signal) => {
    const res = await fetch('/api/data', { signal });
    return res.json();
  },
  { priority: 10 }
);

const task2 = scheduler.submit(
  async (signal) => {
    await new Promise((r) => setTimeout(r, 2000));
    return 'done';
  },
  { priority: 5 }
);

const task3 = scheduler.submit(
  async (signal) => {
    throw new Error('intentional failure');
  },
  { priority: 1, retries: 3 }
);

// 等待所有完成
await scheduler.idle();
console.log(scheduler.stats);
console.log(`平均执行时间: ${scheduler.avgDuration.toFixed(2)}ms`);
```

---

## 六、核心要点总结

### 闭包 (Closure)
1. **WeakRef/FinalizationRegistry** — 不阻止 GC 的引用 + GC 回调
2. **Memoization** — 同步/异步/LRU/TTL 多种缓存策略
3. **模块模式** — IIFE 私有状态 + 依赖注入 + 命名空间隔离
4. **陷阱** — 循环变量共享/闭包持有不必要引用/this 丢失

### 原型 (Prototype)
1. **私有字段/方法** — `#` 前缀，真正的私有，不继承
2. **装饰器** — 方法/类/访问器装饰器，可组合
3. **Symbol** — 唯一标识符，自定义迭代/类型检查/全局注册表
4. **Reflect** — 函数式对象操作，与 Proxy 配合

### 异步 (Async)
1. **AsyncGenerator** — 异步迭代，流式处理，分页/WebSocket
2. **Backpressure** — 缓冲限流/滑动窗口/令牌桶
3. **Structured Concurrency** — 任务组，父任务管理子任务生命周期
4. **Promise 组合** — 优先级队列/超时/重试/限流

### 事件循环 (Event Loop)
1. **V8 引擎** — 解析→字节码→优化→去优化，类型反馈
2. **Hidden Class** — 相同结构共享，保持属性顺序一致
3. **内存管理** — 分代 GC，避免泄漏模式，WeakRef 缓存
4. **调度** — 宏任务/微任务/渲染帧，Performance API 分析

---

**v8 完成。** 第 8 轮迭代覆盖：内存管理、V8 引擎内部、装饰器、私有字段、AsyncGenerator、Backpressure、Structured Concurrency。
