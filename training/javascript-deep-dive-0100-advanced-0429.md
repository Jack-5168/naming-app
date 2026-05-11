# JavaScript 深度专项 — 高级实战 (4/29)

**日期:** 2026 年 4 月 29 日 星期三 01:00
**参考:** JavaScript.info 第 5-7 章
**性质:** 高级实战 (4/27 基础体系 + 4/28 复习巩固 → 4/29 高级实战)
**重点:** 闭包/原型/异步/事件循环 — 高阶题目 + 边界场景 + 面试压轴题

---

## 训练策略

前两轮已覆盖四大主题的完整知识体系，本次聚焦：
1. **闭包** — 8 道高阶题（内存泄漏检测、WeakRef 实战、闭包链追踪）
2. **原型** — 6 道高阶题（原型链断裂、Symbol 陷阱、继承边界）
3. **异步** — 8 道高阶题（竞态处理、Promise 实现、并发极限）
4. **事件循环** — 6 道高阶题（微任务饥饿、Node.js 差异、调度精析）
5. **综合压轴** — 3 道跨主题综合题

---

## 一、闭包 — 高阶实战

### 题 1: 闭包链追踪（面试压轴）

```javascript
// 预测输出，并画出闭包链
function a(x) {
  let y = x;
  return function b(z) {
    return function c(w) {
      return x + y + z + w;
    };
  };
}

const fn1 = a(1);
const fn2 = fn1(2);
const result = fn2(3);
console.log(result); // ?

// 闭包链:
// c.[[Environment]] → b 的 LexicalEnvironment { z: 3 }
// b.[[Environment]] → a 的 LexicalEnvironment { x: 1, y: 1 }
// a.[[Environment]] → GlobalEnvironment
// c 能访问: x(来自a), y(来自a), z(来自b), w(自身参数)
// 答案: 1 + 1 + 2 + 3 = 7
```

### 题 2: 闭包 + this 的终极陷阱

```javascript
const obj = {
  name: 'Alice',
  friends: ['Bob', 'Charlie', 'David'],
  showFriends() {
    // 问题: 输出什么? 为什么?
    this.friends.forEach(function (friend) {
      console.log(this.name + ' knows ' + friend);
    });
  },
};

obj.showFriends();
// 输出:
// "undefined knows Bob"
// "undefined knows Charlie"
// "undefined knows David"
// 原因: forEach 回调中的 this 指向全局 (非严格模式) 或 undefined (严格模式)
// 不是 obj!

// ✅ 修复方案 (5 种)
// 方案 1: 箭头函数
showFriends1() {
  this.friends.forEach(f => console.log(this.name + ' knows ' + f));
}

// 方案 2: bind
showFriends2() {
  this.friends.forEach(function(f) {
    console.log(this.name + ' knows ' + f);
  }.bind(this));
}

// 方案 3: that = this (闭包捕获)
showFriends3() {
  const that = this;
  this.friends.forEach(function(f) {
    console.log(that.name + ' knows ' + f);
  });
}

// 方案 4: forEach 第二个参数
showFriends4() {
  this.friends.forEach(function(f) {
    console.log(this.name + ' knows ' + f);
  }, this);
}

// 方案 5: for...of
showFriends5() {
  for (const f of this.friends) {
    console.log(this.name + ' knows ' + f);
  }
}
```

### 题 3: 内存泄漏检测与修复

```javascript
// ❌ 场景 1: 闭包持有 DOM 引用
function setupHandler() {
  const element = document.getElementById('btn');
  element.addEventListener('click', function handler() {
    console.log('clicked');
  });
  // element 被闭包持有，即使 DOM 移除也不会 GC
}

// ✅ 修复
function setupHandlerFixed() {
  const element = document.getElementById('btn');
  function handler() {
    console.log('clicked');
    element.removeEventListener('click', handler); // 自清理
  }
  element.addEventListener('click', handler);
}

// ❌ 场景 2: 缓存无限增长
function createExpensiveCache() {
  const cache = {}; // 闭包持有，永不释放
  return function compute(key) {
    if (cache[key]) return cache[key];
    // 模拟昂贵计算
    const result = key.split('').reverse().join('');
    cache[key] = result;
    return result;
  };
}

// ✅ 修复: LRU Cache (有限容量)
function createLRUCache(maxSize) {
  const cache = new Map(); // Map 保持插入顺序

  return function compute(key) {
    if (cache.has(key)) {
      // 命中: 移到末尾 (最近使用)
      const val = cache.get(key);
      cache.delete(key);
      cache.set(key, val);
      return val;
    }
    // 未命中: 计算并插入
    const result = key.split('').reverse().join('');
    if (cache.size >= maxSize) {
      // 删除最旧的 (Map 迭代顺序 = 插入顺序)
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
    cache.set(key, result);
    return result;
  };
}

// 测试
const lru = createLRUCache(3);
lru('a'); lru('b'); lru('c'); // cache: [a, b, c]
lru('d'); // cache 满，淘汰 a → [b, c, d]
lru('a'); // 未命中，淘汰 b → [c, d, a]
```

### 题 4: WeakRef 实战 — 自动清理缓存

```javascript
// WeakRef: 不阻止 GC 的弱引用
class WeakCache {
  constructor() {
    this.cache = new Map(); // key → { ref: WeakRef, data: value }
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    const obj = entry.ref.deref(); // 尝试获取引用
    if (!obj) {
      // 对象已被 GC，清理 entry
      this.cache.delete(key);
      return undefined;
    }
    return obj;
  }

  set(key, obj) {
    this.cache.set(key, { ref: new WeakRef(obj) });
  }

  has(key) {
    return this.get(key) !== undefined; // get 会自动清理过期 entry
  }

  cleanup() {
    // 主动清理所有已 GC 的 entry
    for (const [key, entry] of this.cache) {
      if (!entry.ref.deref()) {
        this.cache.delete(key);
      }
    }
  }
}

// 使用
const cache = new WeakCache();
let bigObj = { name: 'huge data', size: '10MB' };
cache.set('obj1', bigObj);
cache.get('obj1'); // { name: 'huge data', size: '10MB' }

bigObj = null; // 原始引用断开
// GC 后: cache.get('obj1') → undefined (自动清理)
```

### 题 5: 实现一个带过期时间的闭包缓存

```javascript
function createTimedCache(defaultTTL = 60000) {
  const entries = new Map(); // key → { value, expiry }

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiry) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set(key, value, ttl = defaultTTL) {
      entries.set(key, { value, expiry: Date.now() + ttl });
    },

    delete(key) {
      return entries.delete(key);
    },

    clear() {
      entries.clear();
    },

    // 定期清理过期 entry (防止内存泄漏)
    startCleanup(interval = 30000) {
      const timer = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of entries) {
          if (now > entry.expiry) entries.delete(key);
        }
      }, interval);
      // 返回停止方法
      return () => clearInterval(timer);
    },

    get size() {
      return entries.size;
    },
  };
}

// 测试
const cache = createTimedCache(1000);
cache.set('token', 'abc123');
cache.get('token'); // 'abc123'
setTimeout(() => console.log(cache.get('token')), 1500); // undefined (过期)
```

### 题 6: 闭包实现事件订阅发布 (进阶版)

```javascript
function createEventEmitter() {
  const listeners = new Map(); // event → Set of handlers
  const onceListeners = new Map();
  const errorCount = new Map(); // 错误计数

  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      // 返回取消订阅函数 (闭包)
      return () => {
        const handlers = listeners.get(event);
        if (handlers) handlers.delete(handler);
      };
    },

    once(event, handler) {
      const wrapped = (...args) => {
        handler(...args);
        listeners.get(event)?.delete(wrapped);
        onceListeners.delete(event);
      };
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(wrapped);
      onceListeners.set(event, wrapped);
      return () => listeners.get(event)?.delete(wrapped);
    },

    emit(event, ...args) {
      const handlers = listeners.get(event);
      if (!handlers) return false;
      for (const h of handlers) {
        try {
          h(...args);
        } catch (e) {
          errorCount.set(event, (errorCount.get(event) || 0) + 1);
          console.error(`Error in listener for "${event}":`, e);
        }
      }
      return true;
    },

    off(event, handler) {
      if (!handler) {
        listeners.delete(event);
        onceListeners.delete(event);
      } else {
        listeners.get(event)?.delete(handler);
        onceListeners.delete(event);
      }
    },

    listenerCount(event) {
      return listeners.get(event)?.size || 0;
    },

    // 错误统计
    errorStats() {
      return Object.fromEntries(errorCount);
    },
  };
}

// 测试
const emitter = createEventEmitter();

// on 返回取消函数
const unsub = emitter.on('data', (d) => console.log('got:', d));
emitter.emit('data', 42); // got: 42
unsub();
emitter.emit('data', 42); // (无输出)

// once 自动移除
emitter.once('login', (user) => console.log('welcome', user));
emitter.emit('login', 'Alice'); // welcome Alice
emitter.emit('login', 'Bob');   // (无输出)
```

### 题 7: 闭包实现函数组合 (Function Composition)

```javascript
// compose: 从右到左组合函数
function compose(...fns) {
  return function composed(value) {
    return fns.reduceRight((acc, fn) => fn(acc), value);
  };
}

// pipe: 从左到右组合函数
function pipe(...fns) {
  return function piped(value) {
    return fns.reduce((acc, fn) => fn(acc), value);
  };
}

// 实际场景: 数据处理管道
const toUpperCase = (str) => str.toUpperCase();
const addExclamation = (str) => str + '!';
const wrapInBrackets = (str) => `[${str}]`;

// compose: 从右到左 → wrapInBrackets(addExclamation(toUpperCase("hello")))
const process1 = compose(wrapInBrackets, addExclamation, toUpperCase);
console.log(process1('hello')); // [HELLO!]

// pipe: 从左到右 → wrapInBrackets(addExclamation(toUpperCase("hello")))
const process2 = pipe(toUpperCase, addExclamation, wrapInBrackets);
console.log(process2('hello')); // [HELLO!]

// 数据验证管道
const isString = (v) => typeof v === v ? v : String(v); // 修正
const trim = (v) => v.trim();
const validateEmail = (v) => /^[^@]+@[^@]+\.[^@]+$/.test(v) ? v : null;
const toLower = (v) => v.toLowerCase();

const processEmail = pipe(trim, toLower, validateEmail);
console.log(processEmail('  TEST@EXAMPLE.COM  ')); // test@example.com
console.log(processEmail('  bad-email  '));         // null
```

### 题 8: 闭包实现状态机

```javascript
function createStateMachine(initialState, transitions) {
  let currentState = initialState;
  let history = [initialState];

  return {
    get state() { return currentState; },
    get history() { return [...history]; },

    canTransition(action) {
      return transitions[currentState]?.has(action) || false;
    },

    transition(action, payload) {
      const allowed = transitions[currentState]?.has(action);
      if (!allowed) {
        throw new Error(
          `Invalid transition: "${action}" from state "${currentState}"`
        );
      }
      const nextState = transitions[currentState].get(action)(payload);
      currentState = nextState;
      history.push(nextState);
      return this;
    },

    reset() {
      currentState = initialState;
      history = [initialState];
      return this;
    },
  };
}

// 使用: 登录状态机
const authMachine = createStateMachine('idle', {
  idle: new Map([
    ['LOGIN', (credentials) => ({ status: 'loading', credentials })],
  ]),
  loading: new Map([
    ['SUCCESS', (_, payload) => ({ status: 'authenticated', user: payload.user })],
    ['FAILURE', (_, payload) => ({ status: 'error', error: payload.error })],
    ['CANCEL', () => ({ status: 'idle' })],
  ]),
  authenticated: new Map([
    ['LOGOUT', () => ({ status: 'idle' })],
    ['REFRESH', () => ({ status: 'loading', credentials: null })],
  ]),
  error: new Map([
    ['RETRY', () => ({ status: 'loading', credentials: null })],
    ['RESET', () => ({ status: 'idle' })],
  ]),
});

authMachine.state; // { status: 'idle' }
authMachine.canTransition('LOGIN'); // true
authMachine.transition('LOGIN', { user: 'alice', pass: '123' });
authMachine.state; // { status: 'loading', credentials: {...} }
authMachine.transition('SUCCESS', { user: { name: 'Alice' } });
authMachine.state; // { status: 'authenticated', user: { name: 'Alice' } }
authMachine.history; // [{status:'idle'}, {status:'loading'}, {status:'authenticated'}]
```

---

## 二、原型 — 高阶实战

### 题 1: 原型链断裂检测

```javascript
// 场景: 什么情况下原型链会"断裂"?

// 场景 1: 直接赋值原型 (断裂)
function A() {}
A.prototype.sayHi = function() { console.log('hi'); };

function B() {}
B.prototype = { name: 'B' }; // ❌ 断裂! 丢失了 constructor 和 A 的继承

// 场景 2: Object.create(null) — 无原型链
const noProto = Object.create(null);
console.log(noProto.toString); // undefined (没有 Object.prototype)
console.log(noProto instanceof Object); // false

// 场景 3: 手动修改 __proto__ (不推荐)
const obj = {};
obj.__proto__ = null; // 原型链断裂
console.log(obj.hasOwnProperty); // undefined

// ✅ 检测原型链是否完整
function hasCompletePrototypeChain(obj) {
  try {
    return typeof obj.toString === 'function' &&
           typeof obj.hasOwnProperty === 'function' &&
           Object.getPrototypeOf(obj) !== null;
  } catch {
    return false;
  }
}

// ✅ 正确继承
function B() {}
B.prototype = Object.create(A.prototype); // 保持原型链
B.prototype.constructor = B; // 修复 constructor
```

### 题 2: Symbol 在原型链中的行为

```javascript
// Symbol 不会出现在 for...in / Object.keys / JSON.stringify 中
const sym = Symbol('private');

function Person(name) {
  this.name = name;
  this[sym] = 'secret'; // Symbol 属性
}

Person.prototype[sym] = 'prototype secret';

const p = new Person('Alice');

console.log(Object.keys(p));          // ['name'] — Symbol 不出现
console.log(Object.getOwnPropertySymbols(p)); // [Symbol(private)]
console.log(Reflect.ownKeys(p));      // ['name', Symbol(private)]
console.log(JSON.stringify(p));       // {"name":"Alice"} — Symbol 被忽略

// Symbol.iterator — 让对象可迭代
class Range {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  [Symbol.iterator]() {
    let current = this.from;
    const to = this.to;
    return {
      next() {
        if (current <= to) {
          return { value: current++, done: false };
        }
        return { done: true };
      },
    };
  }
}

const range = new Range(1, 5);
for (const n of range) console.log(n); // 1 2 3 4 5
[...range]; // [1, 2, 3, 4, 5]
```

### 题 3: 多重继承的边界情况

```javascript
// JS 不支持多重继承，但可以用 Mixin 模拟

// Mixin 工厂
function mixin(target, ...sources) {
  for (const source of sources) {
    // 复制所有自有属性 (包括 Symbol)
    const descriptors = Object.getOwnPropertyDescriptors(source);
    for (const key of Reflect.ownKeys(descriptors)) {
      Object.defineProperty(target, key, descriptors[key]);
    }
  }
  return target;
}

// 能力定义
const CanFly = {
  fly() { console.log(`${this.name} is flying!`); },
  land() { console.log(`${this.name} landed.`); },
};

const CanSwim = {
  swim() { console.log(`${this.name} is swimming!`); },
  dive() { console.log(`${this.name} dove.`); },
};

const CanSpeak = {
  speak(lang) { console.log(`${this.name} speaks ${lang}.`); },
};

// 类定义
class Duck {
  constructor(name) { this.name = name; }
  quack() { console.log('quack!'); }
}

// 混入能力
mixin(Duck.prototype, CanFly, CanSwim, CanSpeak);

const donald = new Duck('Donald');
donald.quack();   // quack!
donald.fly();     // Donald is flying!
donald.swim();    // Donald is swimming!
donald.speak('quack'); // Donald speaks quack.

// ⚠️ 冲突处理: 后混入的覆盖先混入的
const CanFly = { move: () => console.log('flying') };
const CanSwim = { move: () => console.log('swimming') };

class Animal {}
mixin(Animal.prototype, CanFly, CanSwim);
// Animal.prototype.move === CanSwim.move (后者覆盖前者)
```

### 题 4: new 操作符的手动实现

```javascript
function myNew(Constructor, ...args) {
  // 1. 创建空对象，原型指向 Constructor.prototype
  const obj = Object.create(Constructor.prototype);

  // 2. 执行构造函数，this 指向新对象
  const result = Constructor.apply(obj, args);

  // 3. 如果构造函数返回对象，则返回该对象；否则返回新对象
  if (result !== null && (typeof result === 'object' || typeof result === 'function')) {
    return result;
  }
  return obj;
}

// 测试
function Person(name, age) {
  this.name = name;
  this.age = age;
}
Person.prototype.greet = function() {
  return `Hi, I'm ${this.name}, ${this.age} years old.`;
};

const p = myNew(Person, 'Alice', 25);
console.log(p.name); // Alice
console.log(p.greet()); // Hi, I'm Alice, 25 years old.
console.log(p instanceof Person); // true

// 测试: 构造函数返回对象
function Factory(name) {
  this.name = name;
  return { custom: true, name }; // 返回对象
}
const f = myNew(Factory, 'test');
console.log(f); // { custom: true, name: 'test' } (返回构造函数的返回值)
```

### 题 5: instanceof 的手动实现

```javascript
function myInstanceof(obj, Constructor) {
  if (obj === null || typeof obj !== 'object') return false;

  let proto = Object.getPrototypeOf(obj);
  const prototype = Constructor.prototype;

  while (proto !== null) {
    if (proto === prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}

// 测试
console.log(myInstanceof([], Array));      // true
console.log(myInstanceof({}, Object));     // true
console.log(myInstanceof('str', String));  // false (原始类型)
console.log(myInstanceof(new String('s'), String)); // true

// Symbol.hasInstance — 自定义 instanceof 行为
class MyArray {
  static [Symbol.hasInstance](obj) {
    return Array.isArray(obj);
  }
}

console.log([] instanceof MyArray); // true (自定义行为)
```

### 题 6: 原型链上的属性查找性能分析

```javascript
// 原型链越深，查找越慢
// 实测: 100 万次查找

function createDeepChain(depth) {
  let obj = { value: 'base' };
  for (let i = 0; i < depth; i++) {
    const parent = { value: `level-${i}` };
    Object.setPrototypeOf(parent, obj);
    obj = parent;
  }
  return obj;
}

// 性能对比
const shallow = { value: 'shallow' };
const deep = createDeepChain(100);

console.time('shallow lookup');
for (let i = 0; i < 1000000; i++) { shallow.value; }
console.timeEnd('shallow lookup'); // ~5ms

console.time('deep lookup');
for (let i = 0; i < 1000000; i++) { deep.value; }
console.timeEnd('deep lookup'); // ~30ms (6 倍慢)

// 结论: 原型链深度建议 ≤ 3 层
// V8 优化: 频繁访问的属性会被 inline cache 缓存，实际差距没这么大
// 但深层原型链仍会影响首次访问和 IC miss 场景
```

---

## 三、异步 — 高阶实战

### 题 1: Promise 的手动实现 (Promises/A+ 标准)

```javascript
class MyPromise {
  constructor(executor) {
    this.state = 'pending'; // pending | fulfilled | rejected
    this.value = undefined;
    this.reason = undefined;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    const resolve = (value) => {
      if (this.state !== 'pending') return;
      this.state = 'fulfilled';
      this.value = value;
      this.onFulfilledCallbacks.forEach(cb => cb(this.value));
    };

    const reject = (reason) => {
      if (this.state !== 'pending') return;
      this.state = 'rejected';
      this.reason = reason;
      this.onRejectedCallbacks.forEach(cb => cb(this.reason));
    };

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  then(onFulfilled, onRejected) {
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : v => v;
    onRejected = typeof onRejected === 'function' ? onRejected : r => { throw r; };

    return new MyPromise((resolve, reject) => {
      const handle = (callback) => {
        try {
          const result = callback(this.state === 'fulfilled' ? this.value : this.reason);
          // 如果返回 Promise，等待其完成
          if (result instanceof MyPromise) {
            result.then(resolve, reject);
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(e);
        }
      };

      if (this.state === 'pending') {
        this.onFulfilledCallbacks.push(() => handle(onFulfilled));
        this.onRejectedCallbacks.push(() => handle(onRejected));
      } else if (this.state === 'fulfilled') {
        // 微任务调度
        queueMicrotask(() => handle(onFulfilled));
      } else {
        queueMicrotask(() => handle(onRejected));
      }
    });
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(onFinally) {
    return this.then(
      v => MyPromise.resolve(onFinally()).then(() => v),
      r => MyPromise.resolve(onFinally()).then(() => { throw r; })
    );
  }

  static resolve(value) {
    return value instanceof MyPromise ? value : new MyPromise(r => r(value));
  }

  static reject(reason) {
    return new MyPromise((_, rej) => rej(reason));
  }

  static all(promises) {
    return new MyPromise((resolve, reject) => {
      const results = [];
      let completed = 0;

      if (promises.length === 0) return resolve([]);

      promises.forEach((p, i) => {
        MyPromise.resolve(p).then(
          v => { results[i] = v; if (++completed === promises.length) resolve(results); },
          reject
        );
      });
    });
  }

  static race(promises) {
    return new MyPromise((resolve, reject) => {
      for (const p of promises) {
        MyPromise.resolve(p).then(resolve, reject);
      }
    });
  }

  static allSettled(promises) {
    return new MyPromise((resolve) => {
      const results = [];
      let completed = 0;

      if (promises.length === 0) return resolve([]);

      promises.forEach((p, i) => {
        MyPromise.resolve(p).then(
          v => { results[i] = { status: 'fulfilled', value: v }; if (++completed === promises.length) resolve(results); },
          r => { results[i] = { status: 'rejected', reason: r }; if (++completed === promises.length) resolve(results); }
        );
      });
    });
  }
}

// 测试
const p = new MyPromise((resolve) => setTimeout(() => resolve(42), 100));
p.then(v => console.log(v)); // 42

// 链式调用
MyPromise.resolve(1)
  .then(v => v + 1)
  .then(v => v * 2)
  .then(v => console.log(v)); // 4
```

### 题 2: 并发控制器 (并发限制)

```javascript
class ConcurrencyController {
  constructor(maxConcurrency) {
    this.max = maxConcurrency;
    this.running = 0;
    this.queue = [];
  }

  add(taskFactory) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFactory, resolve, reject });
      this._run();
    });
  }

  _run() {
    while (this.running < this.max && this.queue.length > 0) {
      const { taskFactory, resolve, reject } = this.queue.shift();
      this.running++;

      Promise.resolve(taskFactory())
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this._run(); // 触发下一个
        });
    }
  }

  get pending() { return this.queue.length; }
  get active() { return this.running; }
}

// 使用: 限制同时下载 3 个文件
const controller = new ConcurrencyController(3);

const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/file${i}.jpg`);

const download = (url) => {
  console.log(`[开始] ${url} (活跃: ${controller.active})`);
  return new Promise(resolve => {
    setTimeout(() => {
      console.log(`[完成] ${url}`);
      resolve(url);
    }, Math.random() * 1000 + 500);
  });
};

const promises = urls.map(url => controller.add(() => download(url)));
Promise.all(promises).then(results => console.log('全部完成:', results.length));
// 始终只有 3 个并发
```

### 题 3: 竞态处理 — 搜索框最佳实践

```javascript
function createSearchController() {
  let requestId = 0; // 请求 ID 计数器

  return {
    async search(query) {
      const currentId = ++requestId; // 捕获当前 ID

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        // 关键: 检查是否仍是最新请求
        if (currentId !== requestId) {
          console.log(`[取消] 请求 #${currentId} 被新请求 #${requestId} 覆盖`);
          return null; // 丢弃旧结果
        }

        return data;
      } catch (error) {
        if (currentId !== requestId) return null;
        throw error;
      }
    },

    // 使用 AbortController 真正取消请求
    async searchWithAbort(query) {
      const currentId = ++requestId;
      const controller = new AbortController();

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (currentId !== requestId) {
          controller.abort(); // 取消后续请求
          return null;
        }
        return data;
      } catch (error) {
        if (error.name === 'AbortError') return null;
        if (currentId !== requestId) return null;
        throw error;
      }
    },
  };
}

// 使用: 配合防抖
const searchCtrl = createSearchController();

const debouncedSearch = debounce(async (query) => {
  if (!query.trim()) return;
  const result = await searchCtrl.search(query);
  if (result) renderResults(result);
}, 300);

// 用户输入: "j" → "ja" → "jav" → "java"
// 只有 "java" 的请求结果会被渲染，前面的被自动丢弃
```

### 题 4: Promise 串行执行器

```javascript
function runSerial(tasks, concurrency = 1) {
  const results = [];
  let index = 0;

  function runNext() {
    if (index >= tasks.length) return results;
    const i = index++;
    return tasks[i]().then(result => {
      results[i] = result;
      if (index < tasks.length) return runNext();
      return results;
    });
  }

  // 支持并发
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, runNext);
  return Promise.all(workers).then(() => results);
}

// 测试: 串行执行
const tasks = [
  () => new Promise(r => setTimeout(() => { console.log('task 1'); r(1); }, 300)),
  () => new Promise(r => setTimeout(() => { console.log('task 2'); r(2); }, 200)),
  () => new Promise(r => setTimeout(() => { console.log('task 3'); r(3); }, 100)),
];

// 串行: 总耗时 600ms (300+200+100)
runSerial(tasks).then(r => console.log('串行结果:', r)); // [1, 2, 3]

// 并发 2: 总耗时 ~400ms
runSerial(tasks, 2).then(r => console.log('并发2结果:', r)); // [1, 2, 3]
```

### 题 5: 异步迭代器 (AsyncIterator)

```javascript
// 逐行读取大文件 (模拟)
async function* readLines(filePath) {
  const chunkSize = 1024;
  let offset = 0;

  while (offset < fileSize) {
    const chunk = await fetchChunk(filePath, offset, chunkSize);
    const lines = chunk.split('\n');

    for (const line of lines) {
      yield line; // 每次 yield 暂停，调用者 next() 时恢复
    }
    offset += chunkSize;
  }
}

// 使用
async function processLargeFile() {
  let count = 0;
  for await (const line of readLines('/big-file.csv')) {
    if (line.includes('error')) {
      console.log('Found error:', line);
    }
    count++;
    if (count > 10000) break; // 随时可以中断，不会浪费资源
  }
}

// 异步迭代器 + 管道
async function* filterAsync(iterable, predicate) {
  for await (const item of iterable) {
    if (await predicate(item)) yield item;
  }
}

async function* mapAsync(iterable, mapper) {
  for await (const item of iterable) {
    yield await mapper(item);
  }
}

// 使用: 异步管道
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const asyncIterable = {
  async *[Symbol.asyncIterator]() {
    for (const n of numbers) {
      await new Promise(r => setTimeout(r, 50)); // 模拟异步
      yield n;
    }
  },
};

// 过滤偶数 → 平方 → 收集
const result = [];
for await (const n of filterAsync(asyncIterable, n => n % 2 === 0)) {
  for await (const sq of mapAsync([n], n => n * n)) {
    result.push(sq);
  }
}
console.log(result); // [4, 16, 36, 64, 100]
```

### 题 6: 重试机制 (指数退避 + 抖动)

```javascript
async function retry(fn, { maxRetries = 3, baseDelay = 1000, maxDelay = 30000, jitter = true } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // 指数退避
      let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

      // 随机抖动 (±25%)
      if (jitter) {
        delay *= (0.75 + Math.random() * 0.5);
      }

      console.log(`Attempt ${attempt + 1} failed. Retrying in ${Math.round(delay)}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// 使用
const result = await retry(
  () => fetch('/api/unstable').then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }),
  { maxRetries: 5, baseDelay: 500, maxDelay: 10000 }
);
// 重试间隔: ~500ms → ~1000ms → ~2000ms → ~4000ms → ~8000ms (带抖动)
```

### 题 7: Promise.allSettled 的手动实现

```javascript
function myAllSettled(promises) {
  return new Promise((resolve) => {
    const results = [];
    let settled = 0;

    if (promises.length === 0) {
      resolve([]);
      return;
    }

    promises.forEach((p, i) => {
      Promise.resolve(p)
        .then(value => {
          results[i] = { status: 'fulfilled', value };
        })
        .catch(reason => {
          results[i] = { status: 'rejected', reason };
        })
        .finally(() => {
          if (++settled === promises.length) resolve(results);
        });
    });
  });
}

// 测试
const results = await myAllSettled([
  Promise.resolve(1),
  Promise.reject(new Error('fail')),
  Promise.resolve(3),
]);
console.log(results);
// [
//   { status: 'fulfilled', value: 1 },
//   { status: 'rejected', reason: Error: fail },
//   { status: 'fulfilled', value: 3 }
// ]
```

### 题 8: async/await 的底层实现 (Generator + 自动执行器)

```javascript
// async/await 的本质: Generator + 自动执行器

// 手写自动执行器 (co 库的核心原理)
function spawn(genFn) {
  const gen = genFn.apply(this, arguments);
  return new Promise((resolve, reject) => {
    function step(key, arg) {
      let result;
      try {
        result = gen[key](arg);
      } catch (e) {
        return reject(e);
      }

      const { value, done } = result;

      if (done) {
        return resolve(value);
      }

      // 等待 Promise 完成
      return Promise.resolve(value).then(
        v => step('next', v),
        e => step('throw', e)
      );
    }
    step('next', undefined);
  });
}

// 使用: 用 Generator 模拟 async/await
function* fetchData() {
  const user = yield fetch('/api/user').then(r => r.json());
  const posts = yield fetch(`/api/posts/${user.id}`).then(r => r.json());
  return { user, posts };
}

// spawn 自动执行 Generator
spawn(fetchData).then(data => console.log(data));

// 对比: 等价的 async/await
async function fetchDataAsync() {
  const user = await fetch('/api/user').then(r => r.json());
  const posts = await fetch(`/api/posts/${user.id}`).then(r => r.json());
  return { user, posts };
}

// 结论: async/await = Generator + Promise + 自动执行器 (语法糖)
```

---

## 四、事件循环 — 高阶实战

### 题 1: 经典输出题 (微任务 vs 宏任务)

```javascript
// 预测输出顺序
console.log('1'); // 同步 → 宏任务

setTimeout(() => {
  console.log('2'); // 宏任务 (setTimeout)
}, 0);

Promise.resolve().then(() => {
  console.log('3'); // 微任务
}).then(() => {
  console.log('4'); // 微任务 (链式)
});

async function asyncFn() {
  console.log('5'); // 同步 (async 函数体内部同步执行)
  await Promise.resolve();
  console.log('6'); // 微任务 (await 之后)
}
asyncFn();

console.log('7'); // 同步

// 输出:
// 1 (同步)
// 5 (同步, async 函数体)
// 7 (同步)
// 3 (微任务, Promise.then)
// 4 (微任务, Promise.then 链式)
// 6 (微任务, await 之后)
// 2 (宏任务, setTimeout)
```

### 题 2: 微任务饥饿 (Microtask Starvation)

```javascript
// 问题: 微任务无限递归会怎样?

function microtaskStarvation() {
  Promise.resolve().then(() => {
    console.log('microtask');
    microtaskStarvation(); // 无限递归!
  });
}

// 微任务星亡: 微任务队列永远不为空
// 宏任务 (setTimeout/render/用户交互) 永远得不到执行
// 页面卡死!

// ✅ 解决方案: 限制微任务批次
let batchCount = 0;
const MAX_BATCH = 100;

function safeMicrotask(fn) {
  if (batchCount >= MAX_BATCH) {
    // 让出控制权给宏任务
    setTimeout(() => {
      batchCount = 0;
      fn();
    }, 0);
    return;
  }
  batchCount++;
  Promise.resolve().then(fn);
}

// 实际应用: 虚拟滚动中的批量更新
function batchUpdate(items) {
  let batch = [];
  const MAX_PER_BATCH = 50;

  function processBatch() {
    const chunk = batch.splice(0, MAX_PER_BATCH);
    chunk.forEach(item => render(item));

    if (batch.length > 0) {
      safeMicrotask(processBatch); // 安全地继续
    }
  }

  batch = [...items];
  safeMicrotask(processBatch);
}
```

### 题 3: Node.js 事件循环的特殊性

```javascript
// Node.js 事件循环阶段:
// ┌───────────────────────────┐
// │ timers (setTimeout/setInterval) │
// └─────────────┬─────────────┘
// ┌─────────────▼─────────────┐
// │ pending callbacks         │
// └─────────────┬─────────────┘
// ┌─────────────▼─────────────┐
// │ idle, prepare (内部)      │
// └─────────────┬─────────────┘
// ┌─────────────▼─────────────┐
// │ poll (I/O callbacks)      │
// └─────────────┬─────────────┘
// ┌─────────────▼─────────────┐
// │ check (setImmediate)      │
// └─────────────┬─────────────┘
// ┌─────────────▼─────────────┐
// │ close callbacks           │
// └───────────────────────────┘

// 关键区别:
// 1. setImmediate > setTimeout(fn, 0) 在 poll 阶段为空时
// 2. process.nextTick > Promise.then (微任务优先级不同)
// 3. Node.js 中 process.nextTick 在每个阶段之后执行

// 测试: setImmediate vs setTimeout
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
// 输出不确定! 取决于事件循环进入 poll 阶段的时间
// 但在 I/O callback 中: setImmediate 一定先于 setTimeout

// 测试: process.nextTick vs Promise
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
console.log('sync');
// 输出:
// sync
// nextTick (process.nextTick 优先级最高)
// promise (Promise.then 是标准微任务)
```

### 题 4: 手写事件循环调度器

```javascript
class Scheduler {
  constructor() {
    this.macroQueue = [];
    this.microQueue = [];
    this.running = false;
  }

  // 添加宏任务
  addMacroTask(task) {
    this.macroQueue.push(task);
    this._start();
  }

  // 添加微任务
  addMicroTask(task) {
    this.microQueue.push(task);
    this._start();
  }

  _start() {
    if (this.running) return;
    this.running = true;

    // 使用 setTimeout 模拟宏任务调度
    setTimeout(() => this._tick(), 0);
  }

  _tick() {
    // 1. 执行一个宏任务
    if (this.macroQueue.length > 0) {
      const task = this.macroQueue.shift();
      try { task(); } catch (e) { console.error(e); }
    }

    // 2. 清空所有微任务
    while (this.microQueue.length > 0) {
      const task = this.microQueue.shift();
      try { task(); } catch (e) { console.error(e); }
    }

    // 3. 如果还有任务，继续
    if (this.macroQueue.length > 0 || this.microQueue.length > 0) {
      this._tick();
    } else {
      this.running = false;
    }
  }
}

// 使用
const scheduler = new Scheduler();
scheduler.addMacroTask(() => console.log('macro 1'));
scheduler.addMicroTask(() => console.log('micro 1'));
scheduler.addMacroTask(() => console.log('macro 2'));
scheduler.addMicroTask(() => console.log('micro 2'));
// 输出: macro 1 → micro 1 → micro 2 → macro 2
```

### 题 5: requestAnimationFrame 与事件循环

```javascript
// rAF 在浏览器渲染前执行 (在 microtask 之后, 渲染之前)
// 执行顺序: 同步 → 微任务 → rAF → 渲染 → repaint

function animate() {
  let pos = 0;
  const element = document.getElementById('box');

  function step() {
    pos += 2;
    element.style.transform = `translateX(${pos}px)`;

    if (pos < 500) {
      requestAnimationFrame(step); // 下一帧继续
    }
  }

  requestAnimationFrame(step);
}

// rAF vs setTimeout:
// setTimeout: 不保证在渲染前执行，可能与渲染不同步 → 卡顿
// rAF: 保证在渲染前执行，与刷新率同步 (60fps) → 流畅

// 批量 DOM 读写 (避免 Layout Thrashing)
function batchDOMUpdates() {
  // 先读
  requestAnimationFrame(() => {
    const heights = items.map(item => item.offsetHeight); // 读

    // 后写 (在同一帧中)
    items.forEach((item, i) => {
      item.style.height = `${heights[i] * 1.1}px`; // 写
    });
  });
}
```

### 题 6: 输出题 (综合)

```javascript
// 综合题: 预测完整输出

console.log('A'); // 同步

setTimeout(() => {
  console.log('B'); // 宏任务 (setTimeout)
  Promise.resolve().then(() => console.log('C')); // 微任务
}, 0);

Promise.resolve().then(() => {
  console.log('D'); // 微任务
  setTimeout(() => console.log('E'), 0); // 宏任务
});

console.log('F'); // 同步

// 执行顺序:
// 1. 同步阶段: A → F
// 2. 微任务队列: D (Promise.then)
// 3. 宏任务队列: B (setTimeout), E (setTimeout)
// 4. B 执行后产生微任务: C
//
// 输出: A → F → D → B → C → E
```

---

## 五、综合压轴题

### 压轴题 1: 实现一个完整的 Promise Pool (并发控制 + 进度回调 + 取消)

```javascript
class PromisePool {
  constructor(maxConcurrency) {
    this.max = maxConcurrency;
    this.running = 0;
    this.queue = [];
    this.results = [];
    this._cancelled = false;
    this._onProgress = null;
    this._completed = 0;
    this._total = 0;
  }

  onProgress(callback) {
    this._onProgress = callback;
    return this;
  }

  add(taskFactory) {
    this._total++;
    const task = new Promise((resolve, reject) => {
      this.queue.push({
        taskFactory,
        resolve: (result) => {
          this.results.push(result);
          this._completed++;
          if (this._onProgress) {
            this._onProgress({
              completed: this._completed,
              total: this._total,
              progress: this._completed / this._total,
            });
          }
          resolve(result);
        },
        reject,
      });
    });
    this._run();
    return task;
  }

  async all() {
    const promises = this.queue.map(({ resolve, reject, taskFactory }) => {
      // 重新包装，确保结果正确收集
      return taskFactory().then(resolve).catch(reject);
    });
    return Promise.all(promises).then(() => this.results);
  }

  cancel() {
    this._cancelled = true;
    this.queue = [];
    this.results = [];
  }

  _run() {
    if (this._cancelled) return;

    while (this.running < this.max && this.queue.length > 0) {
      const { taskFactory, resolve, reject } = this.queue.shift();
      this.running++;

      Promise.resolve(taskFactory())
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this._run();
        });
    }
  }

  get stats() {
    return {
      total: this._total,
      completed: this._completed,
      pending: this.queue.length,
      running: this.running,
      progress: this._total > 0 ? this._completed / this._total : 0,
    };
  }
}

// 使用: 并发下载 + 进度回调
const pool = new PromisePool(3);

pool.onProgress(({ completed, total, progress }) => {
  console.log(`进度: ${completed}/${total} (${(progress * 100).toFixed(1)}%)`);
});

const urls = Array.from({ length: 10 }, (_, i) => `file-${i}.jpg`);
const tasks = urls.map(url => () => downloadFile(url));

tasks.forEach(task => pool.add(task));

pool.all().then(results => {
  console.log('全部完成:', results);
  console.log('统计:', pool.stats);
});
```

### 压轴题 2: 实现一个支持撤销/重做的命令模式 (闭包 + 原型 + 异步)

```javascript
class CommandHistory {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this._listeners = new Set();
  }

  execute(command) {
    // 执行命令
    const result = command.execute();

    // 推入撤销栈
    this.undoStack.push(command);
    this.redoStack = []; // 清空重做栈

    this._notify('execute', command);
    return result;
  }

  async undo() {
    if (this.undoStack.length === 0) return null;
    const command = this.undoStack.pop();

    // 异步撤销
    await command.undo();

    this.redoStack.push(command);
    this._notify('undo', command);
    return command;
  }

  async redo() {
    if (this.redoStack.length === 0) return null;
    const command = this.redoStack.pop();

    await command.execute();

    this.undoStack.push(command);
    this._notify('redo', command);
    return command;
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  on(event, listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notify(event, command) {
    this._listeners.forEach(fn => fn(event, command));
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

// 命令工厂 (闭包捕获状态)
function createCommand(name, executeFn, undoFn) {
  let executed = false;
  let prevState = null;

  return {
    name,
    async execute() {
      if (executed) return;
      prevState = await executeFn();
      executed = true;
      return prevState;
    },
    async undo() {
      if (!executed) return;
      await undoFn(prevState);
      executed = false;
    },
    get canUndo() { return executed; },
  };
}

// 使用: 文档编辑器
const history = new CommandHistory();

// 监听变化
history.on('execute', (event, cmd) => console.log(`执行: ${cmd.name}`));
history.on('undo', (event, cmd) => console.log(`撤销: ${cmd.name}`));
history.on('redo', (event, cmd) => console.log(`重做: ${cmd.name}`));

// 创建命令
const typeCommand = createCommand(
  'type',
  async () => {
    const before = document.textContent;
    document.textContent += 'H';
    return before;
  },
  async (prevState) => {
    document.textContent = prevState;
  }
);

history.execute(typeCommand); // 执行: type
await history.undo();         // 撤销: type
await history.redo();         // 重做: type
```

### 压轴题 3: 实现一个响应式系统 (Proxy + 依赖收集 + 异步更新)

```javascript
class ReactiveSystem {
  constructor() {
    this.effects = new Map(); // key → Set of effects
    this._pending = new Set();
    this._flushScheduled = false;
  }

  // 创建响应式对象
  reactive(target) {
    const system = this;

    return new Proxy(target, {
      get(obj, key) {
        const value = obj[key];
        // 依赖收集
        const currentEffect = system._activeEffect;
        if (currentEffect) {
          if (!system.effects.has(key)) {
            system.effects.set(key, new Set());
          }
          system.effects.get(key).add(currentEffect);
          currentEffect._deps.add(key);
        }
        return value;
      },

      set(obj, key, value) {
        const oldValue = obj[key];
        obj[key] = value;

        if (oldValue !== value) {
          // 触发更新 (异步批量)
          system._schedule(key);
        }
        return true;
      },

      deleteProperty(obj, key) {
        const result = delete obj[key];
        system._schedule(key);
        return result;
      },
    });
  }

  // 注册副作用
  effect(fn) {
    const effect = function (...args) {
      return fn(...args);
    };
    effect._deps = new Set();
    effect._run = () => {
      this._activeEffect = effect;
      try {
        fn();
      } finally {
        this._activeEffect = null;
      }
    };
    effect._run(); // 立即执行一次，收集依赖
    return effect;
  }

  // 异步批量更新
  _schedule(key) {
    this._pending.add(key);

    if (!this._flushScheduled) {
      this._flushScheduled = true;
      queueMicrotask(() => this._flush());
    }
  }

  _flush() {
    this._flushScheduled = false;

    for (const key of this._pending) {
      const effects = this.effects.get(key);
      if (effects) {
        for (const effect of effects) {
          effect._run();
        }
      }
    }
    this._pending.clear();
  }

  // 清理依赖
  stop(effect) {
    for (const key of effect._deps) {
      this.effects.get(key)?.delete(effect);
    }
    effect._deps.clear();
  }
}

// 使用
const system = new ReactiveSystem();

const state = system.reactive({
  count: 0,
  name: 'Alice',
});

// 副作用: 自动追踪依赖
system.effect(() => {
  console.log(`${state.name} has ${state.count} items`);
});
// 输出: "Alice has 0 items"

state.count = 1; // 异步批量更新
state.count = 2; // 合并到同一批次
// 输出: "Alice has 2 items" (只触发一次!)

state.name = 'Bob';
// 输出: "Bob has 2 items"
```

---

## 六、面试高频压轴题速查

### 闭包
1. 闭包导致内存泄漏的场景？如何检测和修复？
2. 箭头函数有没有自己的闭包？和 function 的区别？
3. 如何实现一个只能调用一次的函数 (once)？
4. 闭包 + this 的经典陷阱？
5. WeakRef 的实际应用场景？

### 原型
1. `Object.create(null)` vs `{}` 的区别？
2. `instanceof` 的底层实现原理？
3. `__proto__` vs `prototype` 的区别？
4. Symbol 在原型链中的行为？
5. 如何实现安全的深拷贝 (考虑原型链)？

### 异步
1. Promise/A+ 规范的核心要求？
2. `Promise.all` vs `Promise.allSettled` vs `Promise.any` vs `Promise.race` 的区别？
3. async/await 的错误处理最佳实践？
4. 如何实现并发控制？
5. 异步迭代器的应用场景？

### 事件循环
1. 宏任务 vs 微任务的区别和执行顺序？
2. Node.js 和浏览器的 Event Loop 差异？
3. `process.nextTick` 为什么比 `Promise.then` 优先级高？
4. 微任务饥饿问题如何解决？
5. `requestAnimationFrame` 的执行时机？

---

## 七、自测题 (闭卷)

### 题 1
```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 输出: ?
```

### 题 2
```javascript
const obj = Object.create(null);
obj.toString(); // ?
```

### 题 3
```javascript
Promise.resolve()
  .then(() => console.log(1))
  .then(() => console.log(2));

setTimeout(() => console.log(3), 0);

console.log(4);
// 输出顺序: ?
```

### 题 4
```javascript
function A() {}
function B() {}
B.prototype = A;
const b = new B();
console.log(b instanceof A); // ?
console.log(b instanceof B); // ?
```

### 题 5
```javascript
async function f() {
  return 1;
}
f().then(console.log);
console.log(2);
// 输出: ?
```

<details>
<summary>答案</summary>

**题 1:** 3, 3, 3 (var 函数作用域，闭包共享同一个 i)
**题 2:** TypeError (Object.create(null) 没有原型链)
**题 3:** 4 → 1 → 2 → 3 (同步 → 微任务 → 宏任务)
**题 4:** false, true (B.prototype = A 是函数引用，不是原型对象)
**题 5:** 2 → 1 (async 函数返回值自动包装为 Promise，then 是微任务)
</details>

---

## 总结

本次高级实战覆盖:
- **闭包:** 8 题 (链追踪 / this 陷阱 / 内存泄漏 / WeakRef / 定时缓存 / EventBus / 函数组合 / 状态机)
- **原型:** 6 题 (链断裂 / Symbol / 多重继承 / new 实现 / instanceof 实现 / 性能分析)
- **异步:** 8 题 (Promise 实现 / 并发控制 / 竞态处理 / 串行执行 / 异步迭代器 / 重试机制 / allSettled / async/await 底层)
- **事件循环:** 6 题 (经典输出 / 微任务饥饿 / Node.js 差异 / 调度器 / rAF / 综合输出)
- **综合压轴:** 3 题 (Promise Pool / 命令模式 / 响应式系统)

**累计 JS 深度训练:** 4/27 基础版 (1,694 行) → 4/28 复习巩固 (483 行) → 4/29 高级实战 = 完整闭环 ✅
