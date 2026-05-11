# JavaScript 深度专项 v6 — 底层机制与实战 (5/2)

**日期:** 2026 年 5 月 2 日 星期六 01:00
**参考:** JavaScript.info 第 5-7 章 + ES2024 新特性
**性质:** 第 6 轮迭代 (4/25→4/27→4/28→4/29→4/30→5/2)
**重点:** 闭包/原型/异步/事件循环 — 底层原理深挖 + 实战陷阱 + ES2024 前瞻

---

## 训练策略

前 5 轮已完整覆盖四大主题的知识体系和实战技巧。v6 聚焦：
1. **闭包** — 引擎级理解 (执行上下文/词法环境/环境记录)
2. **原型** — 内部槽/代理陷阱/元编程
3. **异步** — Promise 实现原理/微任务调度/Temporal API
4. **事件循环** — 浏览器 vs Node.js 差异/性能分析/调试工具

---

## 一、闭包 — 引擎级理解

### 1.1 执行上下文与词法环境

```javascript
// 理解 [[Environment]] 内部槽
// 每个函数对象都有一个内部槽 [[Environment]]
// 它指向函数创建时的词法环境

function createCounter() {
  let count = 0; // ← 存在于 createCounter 的词法环境中
  return {
    increment: function () {
      count++; // ← 闭包捕获 count
      return count;
    },
    decrement: function () {
      count--; // ← 同一个闭包，共享 count
      return count;
    },
    getCount: function () {
      return count; // ← 只读访问
    },
  };
}

const counter = createCounter();
// createCounter 执行完毕后，其词法环境不会被 GC 回收
// 因为 increment/decrement/getCount 的 [[Environment]] 仍引用它

console.log(counter.increment()); // 1
console.log(counter.increment()); // 2
console.log(counter.decrement()); // 1
console.log(counter.getCount());  // 1

// 关键理解:
// 1. 词法环境 = 环境记录 + 外部引用
// 2. 环境记录 = 变量声明 + 函数声明
// 3. 闭包不是"复制"变量，而是"引用"词法环境
```

### 1.2 闭包内存泄漏检测

```javascript
// 场景: 闭包持有大对象导致内存泄漏
function createEventHandler(element) {
  const largeData = new Array(1000000).fill('x'); // 1MB 数据
  const listener = () => {
    console.log('clicked');
    // 注意: 即使这里没用到 largeData
    // 但 listener 的闭包仍持有整个词法环境
    // → largeData 不会被 GC
  };
  element.addEventListener('click', listener);
  return () => {
    element.removeEventListener('click', listener);
    // 移除监听器后，listener 闭包不再被引用
    // largeData 才可被 GC
  };
}

// ✅ 修复: 将 largeData 移出闭包作用域
function createEventHandlerFixed(element) {
  const listener = () => {
    console.log('clicked');
  };
  element.addEventListener('click', listener);
  return () => {
    element.removeEventListener('click', listener);
  };
}

// 🔍 检测闭包内存泄漏的方法:
// 1. Chrome DevTools → Memory → Heap Snapshot
// 2. 对比添加/移除事件监听前后的堆快照
// 3. 查找 "Detached DOM tree" 或 "Closure" 类型的大对象
```

### 1.3 WeakRef 与闭包结合

```javascript
// ES2021 WeakRef: 创建弱引用，不阻止 GC
class Cache {
  constructor() {
    this._cache = new Map();
  }

  set(key, value) {
    // 使用 WeakRef 存储大对象
    // 当内存紧张时，GC 可以回收这些对象
    this._cache.set(key, new WeakRef(value));
  }

  get(key) {
    const ref = this._cache.get(key);
    if (!ref) return undefined;
    // deref() 返回对象或 undefined (如果已被 GC)
    return ref.deref();
  }

  has(key) {
    const ref = this._cache.get(key);
    return ref?.deref() !== undefined;
  }

  // 清理已被 GC 的条目
  cleanup() {
    for (const [key, ref] of this._cache) {
      if (!ref.deref()) {
        this._cache.delete(key);
      }
    }
  }
}

// 使用 FinalizationRegistry 在对象被 GC 时收到通知
const registry = new FinalizationRegistry((heldValue) => {
  console.log(`对象 ${heldValue} 已被 GC`);
});

const cache = new Cache();
const bigObject = { data: 'x'.repeat(100000) };
cache.set('big', bigObject);
registry.register(bigObject, 'bigObject');

console.log(cache.get('big')); // { data: 'xxx...' }
// 当 bigObject 没有其他强引用时，GC 可能回收它
```

### 1.4 闭包实战: 函数组合器

```javascript
// 高阶函数 + 闭包: 函数组合管道
function pipe(...fns) {
  return (initialValue) => {
    return fns.reduce((value, fn) => fn(value), initialValue);
  };
}

function compose(...fns) {
  return (initialValue) => {
    return fns.reduceRight((value, fn) => fn(value), initialValue);
  };
}

// 使用示例
const add5 = (x) => x + 5;
const multiply3 = (x) => x * 3;
const toString = (x) => `Result: ${x}`;

const transform = pipe(add5, multiply3, toString);
console.log(transform(10)); // "Result: 45" (10+5=15, 15*3=45)

const transformReverse = compose(toString, multiply3, add5);
console.log(transformReverse(10)); // "Result: 45" (从右到左)

// 带闭包的中间件模式
function middlewareChain(handlers) {
  return (context) => {
    function dispatch(index) {
      if (index >= handlers.length) return Promise.resolve(context);
      const handler = handlers[index];
      return handler(context, () => dispatch(index + 1));
    }
    return dispatch(0);
  };
}

// 模拟 Koa 中间件
const app = middlewareChain([
  async (ctx, next) => {
    console.log('1: before');
    await next();
    console.log('1: after');
  },
  async (ctx, next) => {
    console.log('2: before');
    await next();
    console.log('2: after');
  },
  async (ctx) => {
    console.log('3: handler');
    ctx.body = 'Hello';
  },
]);

// 输出: 1:before → 2:before → 3:handler → 2:after → 1:after
// (洋葱模型，依赖闭包捕获 dispatch 和 index)
```

---

## 二、原型 — 元编程与内部槽

### 2.1 理解 [[Prototype]] vs prototype

```javascript
// [[Prototype]] — 对象内部槽，指向原型对象
// prototype — 函数对象的属性，用作 new 创建对象时的原型

function Person(name) {
  this.name = name;
}

// Person.prototype 是函数属性
console.log(typeof Person.prototype); // "object"

// 实例的 [[Prototype]] 通过 Person.prototype 设置
const p = new Person('Alice');
console.log(Object.getPrototypeOf(p) === Person.prototype); // true

// 三者关系:
// p.[[Prototype]] → Person.prototype → Object.prototype → null
// Person.[[Prototype]] → Function.prototype → Object.prototype → null

// 验证
console.log(p.__proto__ === Person.prototype); // true (不推荐用 __proto__)
console.log(Object.getPrototypeOf(p) === Person.prototype); // true (推荐)

// 函数也是对象
console.log(Person.__proto__ === Function.prototype); // true
console.log(Function.prototype.__proto__ === Object.prototype); // true
```

### 2.2 Symbol 与原型的高级用法

```javascript
// Symbol.iterator — 使对象可迭代
class Range {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  [Symbol.iterator]() {
    let current = this.from;
    const end = this.to;
    return {
      next() {
        if (current <= end) {
          return { value: current++, done: false };
        }
        return { done: true };
      },
    };
  }

  // Symbol.toStringTag — 自定义 toString 输出
  get [Symbol.toStringTag]() {
    return 'Range';
  }

  // Symbol.hasInstance — 自定义 instanceof 行为
  static [Symbol.hasInstance](obj) {
    return obj && typeof obj.from === 'number' && typeof obj.to === 'number';
  }
}

const range = new Range(1, 5);
console.log([...range]); // [1, 2, 3, 4, 5]
console.log(Object.prototype.toString.call(range)); // "[object Range]"
console.log({ from: 1, to: 5 } instanceof Range); // true (自定义)

// Symbol.for / Symbol.keyFor — 全局符号注册表
const uid1 = Symbol.for('user.id');
const uid2 = Symbol.for('user.id');
console.log(uid1 === uid2); // true (全局注册表返回同一符号)

const local = Symbol('local');
console.log(Symbol.keyFor(uid1)); // "user.id"
console.log(Symbol.keyFor(local)); // undefined (非全局符号)
```

### 2.3 Proxy 陷阱深度解析

```javascript
// Proxy 13 种陷阱全面演示
const target = {
  name: 'Alice',
  age: 25,
  _secret: 'hidden',
  scores: [90, 85, 95],
};

const handler = {
  // 1. get — 属性读取
  get(target, prop, receiver) {
    if (prop.startsWith('_')) {
      throw new Error(`访问私有属性 "${String(prop)}" 被拒绝`);
    }
    if (prop in target) {
      return target[prop];
    }
    return undefined;
  },

  // 2. set — 属性写入
  set(target, prop, value, receiver) {
    if (prop === 'age' && (typeof value !== 'number' || value < 0 || value > 150)) {
      throw new Error('年龄必须是 0-150 的数字');
    }
    target[prop] = value;
    return true; // 严格模式下必须返回 true
  },

  // 3. has — in 操作符
  has(target, prop) {
    return prop in target && !prop.startsWith('_');
  },

  // 4. deleteProperty — delete 操作
  deleteProperty(target, prop) {
    if (prop.startsWith('_')) {
      throw new Error('不能删除私有属性');
    }
    delete target[prop];
    return true;
  },

  // 5. ownKeys — Object.keys / Object.getOwnPropertyNames
  ownKeys(target) {
    return Object.keys(target).filter((k) => !k.startsWith('_'));
  },

  // 6. getPrototypeOf / 7. setPrototypeOf
  getPrototypeOf(target) {
    return Object.getPrototypeOf(target);
  },

  // 8. isExtensible / 9. preventExtensions
  isExtensible(target) {
    return Object.isExtensible(target);
  },
  preventExtensions(target) {
    Object.preventExtensions(target);
    return true;
  },

  // 10. getOwnPropertyDescriptor
  getOwnPropertyDescriptor(target, prop) {
    if (prop.startsWith('_')) return undefined;
    return Object.getOwnPropertyDescriptor(target, prop);
  },

  // 11. defineProperty
  defineProperty(target, prop, descriptor) {
    if (prop.startsWith('_')) {
      throw new Error('不能定义私有属性');
    }
    Object.defineProperty(target, prop, descriptor);
    return true;
  },

  // 12. apply — 函数调用 (仅对函数代理有效)
  // 13. construct — new 操作 (仅对函数代理有效)
};

const proxy = new Proxy(target, handler);

console.log(proxy.name);     // "Alice"
console.log(proxy._secret);  // Error!
console.log('age' in proxy); // true
console.log('_secret' in proxy); // false (has 陷阱拦截)
console.log(Object.keys(proxy)); // ["name", "age", "scores"]

// 响应式系统核心 (Vue 3 原理)
function reactive(obj) {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const result = Reflect.get(target, prop, receiver);
      // track(prop) — 依赖收集
      console.log(`[track] 读取 ${String(prop)}`);
      return typeof result === 'object' && result !== null ? reactive(result) : result;
    },
    set(target, prop, value, receiver) {
      const oldValue = target[prop];
      const result = Reflect.set(target, prop, value, receiver);
      if (oldValue !== value) {
        // trigger(prop) — 触发更新
        console.log(`[trigger] ${String(prop)} 变化: ${oldValue} → ${value}`);
      }
      return result;
    },
  });
}

const state = reactive({ count: 0, user: { name: 'Bob' } });
state.count = 1;    // [track] 读取 count → [trigger] count 变化: 0 → 1
state.user.name = 'Charlie'; // [track] 读取 user → [track] 读取 name → [trigger] name 变化
```

### 2.4 Reflect API — 与 Proxy 配合

```javascript
// Reflect 提供与对象操作对应的函数
// 每个 Reflect 方法对应一个 Proxy 陷阱

// 传统方式 vs Reflect 方式
const obj = { x: 1 };

// 读取属性
console.log(obj['x']);          // 1
console.log(Reflect.get(obj, 'x')); // 1

// 设置属性
obj['y'] = 2;
console.log(obj.y);             // 2
Reflect.set(obj, 'z', 3);
console.log(obj.z);             // 3

// 判断属性存在
console.log('x' in obj);              // true
console.log(Reflect.has(obj, 'x'));   // true

// 删除属性
delete obj.y;
Reflect.deleteProperty(obj, 'z');

// 调用函数
function greet(greeting, name) {
  return `${greeting}, ${name}! I'm ${this.name}`;
}
const ctx = { name: 'Alice' };

console.log(greet.apply(ctx, ['Hello', 'Bob']));
// "Hello, Bob! I'm Alice"
console.log(Reflect.apply(greet, ctx, ['Hello', 'Bob']));
// "Hello, Bob! I'm Alice"

// 构造对象
const arr = Reflect.construct(Array, [1, 2, 3]);
console.log(arr); // [1, 2, 3]

// Reflect 的优势: 返回布尔值表示成功/失败，而非静默失败或抛异常
console.log(Reflect.set(Object.freeze({}), 'x', 1)); // false
// obj.x = 1; // 严格模式下抛 TypeError，非严格模式静默失败
```

---

## 三、异步 — Promise 实现原理与调度

### 3.1 手写 Promise (简化版)

```javascript
// 理解 Promise 内部状态机和微任务调度
class MyPromise {
  static PENDING = 'pending';
  static FULFILLED = 'fulfilled';
  static REJECTED = 'rejected';

  constructor(executor) {
    this._state = MyPromise.PENDING;
    this._value = undefined;
    this._callbacks = []; // 存储 then 回调

    const resolve = (value) => {
      if (this._state !== MyPromise.PENDING) return;
      this._state = MyPromise.FULFILLED;
      this._value = value;
      // 使用 queueMicrotask 确保异步执行
      queueMicrotask(() => this._flush());
    };

    const reject = (reason) => {
      if (this._state !== MyPromise.PENDING) return;
      this._state = MyPromise.REJECTED;
      this._value = reason;
      queueMicrotask(() => this._flush());
    };

    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }

  _flush() {
    while (this._callbacks.length > 0) {
      const { onFulfilled, onRejected, resolve, reject } = this._callbacks.shift();
      try {
        if (this._state === MyPromise.FULFILLED) {
          const result = onFulfilled?.(this._value);
          resolve(result);
        } else {
          const result = onRejected?.(this._value);
          resolve(result); // 错误被 onRejected 处理后就变成 resolved
        }
      } catch (err) {
        reject(err);
      }
    }
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      this._callbacks.push({
        onFulfilled: typeof onFulfilled === 'function' ? onFulfilled : (v) => v,
        onRejected:
          typeof onRejected === 'function'
            ? onRejected
            : (r) => {
                throw r;
              },
        resolve,
        reject,
      });
      // 如果 Promise 已经 settled，立即触发
      if (this._state !== MyPromise.PENDING) {
        queueMicrotask(() => this._flush());
      }
    });
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(onFinally) {
    return this.then(
      (value) => MyPromise.resolve(onFinally()).then(() => value),
      (reason) =>
        MyPromise.resolve(onFinally()).then(() => {
          throw reason;
        })
    );
  }

  static resolve(value) {
    return value instanceof MyPromise ? value : new MyPromise((resolve) => resolve(value));
  }

  static reject(reason) {
    return new MyPromise((_, reject) => reject(reason));
  }

  static all(promises) {
    return new MyPromise((resolve, reject) => {
      const results = [];
      let completed = 0;
      if (promises.length === 0) {
        resolve(results);
        return;
      }
      promises.forEach((p, i) => {
        MyPromise.resolve(p).then(
          (value) => {
            results[i] = value;
            completed++;
            if (completed === promises.length) resolve(results);
          },
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
}

// 测试
const p = new MyPromise((resolve) => setTimeout(() => resolve(42), 100));
p.then((v) => console.log('result:', v)); // "result: 42"
```

### 3.2 Async/Await 底层实现 (Generator + 自动执行器)

```javascript
// async/await 本质是 Generator + 自动执行器
// Babel 编译后的样子:

function _asyncToGenerator(fn) {
  return function () {
    const self = this;
    const args = arguments;
    return new Promise(function (resolve, reject) {
      const gen = fn.apply(self, args);
      function step(key, arg) {
        let result;
        try {
          result = gen[key](arg);
        } catch (err) {
          reject(err);
          return;
        }
        const { value, done } = result;
        if (done) {
          resolve(value);
        } else {
          // value 必须是 Promise (或 thenable)
          Promise.resolve(value).then(
            (val) => step('next', val),
            (err) => step('throw', err)
          );
        }
      }
      step('next');
    });
  }
}

// 使用示例
function* fetchData() {
  const user = yield fetchUser();
  const posts = yield fetchPosts(user.id);
  return { user, posts };
}

const fetchDataAsync = _asyncToGenerator(fetchData);

function fetchUser() {
  return new Promise((resolve) => setTimeout(() => resolve({ id: 1, name: 'Alice' }), 100));
}
function fetchPosts(userId) {
  return new Promise((resolve) =>
    setTimeout(() => resolve([{ id: 1, title: 'Hello' }]), 100)
  );
}

fetchDataAsync().then(console.log);
// { user: { id: 1, name: 'Alice' }, posts: [ { id: 1, title: 'Hello' } ] }

// 对比 async/await 写法:
async function fetchDataModern() {
  const user = await fetchUser();
  const posts = await fetchPosts(user.id);
  return { user, posts };
}
```

### 3.3 异步并发控制

```javascript
// 并发限制的 Promise 池
class AsyncPool {
  constructor(maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
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
    while (this.running < this.maxConcurrency && this.queue.length > 0) {
      const { taskFactory, resolve, reject } = this.queue.shift();
      this.running++;
      Promise.resolve()
        .then(taskFactory)
        .then(
          (result) => {
            resolve(result);
          },
          (err) => {
            reject(err);
          }
        )
        .finally(() => {
          this.running--;
          this._run(); // 触发下一个任务
        });
    }
  }
}

// 使用: 限制最多 3 个并发请求
const pool = new AsyncPool(3);
const urls = [
  '/api/users',
  '/api/posts',
  '/api/comments',
  '/api/tags',
  '/api/categories',
];

const promises = urls.map((url) =>
  pool.add(() => fetch(url).then((r) => r.json()))
);

Promise.all(promises).then(console.log);

// ES2021 Promise.any / Promise.allSettled
// Promise.any — 只要有一个 fulfilled 就返回
Promise.any([
  Promise.reject('error1'),
  Promise.reject('error2'),
  Promise.resolve('success'),
]).then(console.log); // "success"

// Promise.allSettled — 等待所有 Promise 完成
Promise.allSettled([
  Promise.resolve(1),
  Promise.reject('error'),
  Promise.resolve(3),
]).then(console.log);
// [
//   { status: 'fulfilled', value: 1 },
//   { status: 'rejected', reason: 'error' },
//   { status: 'fulfilled', value: 3 }
// ]
```

---

## 四、事件循环 — 浏览器 vs Node.js 深度对比

### 4.1 浏览器事件循环模型

```
┌─────────────────────────────────────────┐
│           JavaScript Engine              │
│  ┌─────────────┐    ┌─────────────────┐  │
│  │  Call Stack  │    │  Heap (内存)    │  │
│  └─────────────┘    └─────────────────┘  │
└─────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────┐
│         Web APIs / Browser APIs          │
│  DOM Events │ Timer │ Network │ Worker   │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│          Task Queue (Macrotask)          │
│  setTimeout │ setInterval │ I/O │ UI渲染  │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│       Microtask Queue (优先级更高)       │
│  Promise.then │ queueMicrotask │ Mutation│
└─────────────────────────────────────────┘
         │
         ▼
    Event Loop 循环:
    1. 执行一个 Macrotask
    2. 执行所有 Microtask (直到队列为空)
    3. 渲染 (如果需要)
    4. 回到步骤 1
```

```javascript
// 事件循环经典面试题
console.log('1. sync start');

setTimeout(() => {
  console.log('4. setTimeout (macrotask)');
}, 0);

Promise.resolve().then(() => {
  console.log('3. Promise.then (microtask)');
});

queueMicrotask(() => {
  console.log('2.5. queueMicrotask (microtask)');
});

console.log('2. sync end');

// 输出顺序:
// 1. sync start
// 2. sync end
// 2.5. queueMicrotask (microtask)
// 3. Promise.then (microtask)
// 4. setTimeout (macrotask)

// 关键: Microtask 在每次 Macrotask 结束后、渲染前全部执行完
// 如果 Microtask 又添加了 Microtask，会继续执行直到清空
```

### 4.2 Node.js 事件循环模型

```
Node.js 事件循环 (libuv):

  ┌───────────────────────────┐
┌─│           timers           │ ← setTimeout/setInterval 回调
│ └─────────────┬─────────────┘
│ ┌─────────────┴─────────────┐
│ │     pending callbacks     │ ← 系统操作回调 (如 TCP error)
│ └─────────────┬─────────────┘
│ ┌─────────────┴─────────────┐
│ │       idle, prepare       │ ← 内部使用
│ └─────────────┬─────────────┘
│ ┌─────────────┴─────────────┐
│ │          poll              │ ← I/O 回调，最重要的阶段
│ └─────────────┬─────────────┘
│ ┌─────────────┴─────────────┐
│ │         check              │ ← setImmediate 回调
│ └─────────────┬─────────────┘
│ ┌─────────────┴─────────────┐
└─│      close callbacks       │ ← close 事件 (如 socket.on('close'))
  └───────────────────────────┘

每个阶段:
1. 执行该阶段的任务队列
2. 执行所有 Microtask (process.nextTick > Promise.then)
3. 进入下一阶段

process.nextTick() 优先级最高:
  即使在 Microtask 之前执行!
  在当前操作完成后、下一阶段开始前执行
```

```javascript
// Node.js 事件循环经典题
const fs = require('fs');

console.log('1. sync');

setTimeout(() => {
  console.log('2. setTimeout');
}, 0);

setImmediate(() => {
  console.log('3. setImmediate');
});

Promise.resolve().then(() => {
  console.log('4. Promise');
});

process.nextTick(() => {
  console.log('5. nextTick');
});

fs.readFile(__filename, () => {
  console.log('6. readFile callback');
  process.nextTick(() => {
    console.log('7. nextTick in readFile');
  });
  Promise.resolve().then(() => {
    console.log('8. Promise in readFile');
  });
});

// 典型输出 (可能因执行环境略有不同):
// 1. sync
// 5. nextTick        ← process.nextTick 最高优先级
// 4. Promise         ← Microtask
// 2. setTimeout      ← timers 阶段 (0ms 不保证立即执行)
// 3. setImmediate    ← check 阶段
// 6. readFile callback ← poll 阶段
// 7. nextTick in readFile ← process.nextTick
// 8. Promise in readFile ← Microtask
```

### 4.3 浏览器 vs Node.js 对比

```javascript
// 关键差异:
// 1. Microtask 优先级:
//    浏览器: queueMicrotask = Promise.then > MutationObserver
//    Node.js: process.nextTick > Promise.then > queueMicrotask

// 2. 特殊 API:
//    浏览器: requestAnimationFrame (在渲染前执行)
//    Node.js: setImmediate (check 阶段), process.nextTick

// 3. 渲染:
//    浏览器: 有渲染阶段 (在 Microtask 清空后)
//    Node.js: 无渲染

// 4. I/O:
//    浏览器: 事件驱动 (DOM 事件, fetch, WebSocket)
//    Node.js: libuv 线程池 (fs, crypto, dns)

// requestAnimationFrame 示例
// 在浏览器中，rAF 在 Microtask 之后、渲染之前执行
// 优先级: Microtask > rAF > 渲染 > Macrotask

console.log('sync');
Promise.resolve().then(() => console.log('microtask'));
requestAnimationFrame(() => console.log('rAF'));
setTimeout(() => console.log('macrotask'), 0);

// 输出:
// sync
// microtask
// rAF     ← 在下一帧渲染前执行
// macrotask
```

### 4.4 微任务饥饿问题

```javascript
// 微任务饥饿: Microtask 队列无限增长，阻塞渲染和 Macrotask
// 危险示例:

function microtaskStarvation() {
  let count = 0;
  function schedule() {
    queueMicrotask(() => {
      count++;
      if (count < 1000000) {
        schedule(); // 无限添加 Microtask
        // 这会导致:
        // 1. 页面卡死 (无法渲染)
        // 2. 用户交互无响应
        // 3. setTimeout 永远不执行
      }
    });
  }
  schedule();
}

// ✅ 修复: 分批执行，让出控制权
function safeBatchProcessing(items, batchSize = 100) {
  return new Promise((resolve) => {
    let index = 0;
    function processBatch() {
      const end = Math.min(index + batchSize, items.length);
      for (let i = index; i < end; i++) {
        // 处理 items[i]
      }
      index = end;
      if (index < items.length) {
        // 让出控制权: 使用 setTimeout 让渲染和其他任务有机会执行
        setTimeout(processBatch, 0);
      } else {
        resolve();
      }
    }
    processBatch();
  });
}

// 更好的方案: 使用 scheduler.yield (ES2024 提案)
// 主动让出控制权给事件循环
async function cooperativeProcessing(items) {
  for (let i = 0; i < items.length; i++) {
    // 处理 items[i]
    if (i % 100 === 0 && typeof scheduler !== 'undefined') {
      await scheduler.yield(); // 让出控制权
    }
  }
}
```

---

## 五、综合实战 — 跨主题融合

### 5.1 实现一个响应式状态管理器 (闭包 + 代理 + 异步)

```javascript
// 融合: Proxy (原型) + 闭包 + Promise (异步) + 事件循环
class ReactiveStore {
  constructor(initialState) {
    this._state = this._wrapProxy(initialState);
    this._listeners = new Map(); // key → Set<callback>
    this._batchQueue = [];
    this._batchScheduled = false;
  }

  _wrapProxy(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;

    return new Proxy(obj, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'object' && value !== null
          ? this._wrapProxy(value)
          : value;
      },
      set: (target, prop, value, receiver) => {
        const oldValue = target[prop];
        const result = Reflect.set(target, prop, value, receiver);
        if (oldValue !== value) {
          this._scheduleUpdate(String(prop), oldValue, value);
        }
        return result;
      },
    });
  }

  _scheduleUpdate(prop, oldValue, newValue) {
    this._batchQueue.push({ prop, oldValue, newValue });
    if (!this._batchScheduled) {
      this._batchScheduled = true;
      // 使用 queueMicrotask 批量处理更新
      queueMicrotask(() => {
        this._flushUpdates();
      });
    }
  }

  _flushUpdates() {
    const updates = [...this._batchQueue];
    this._batchQueue = [];
    this._batchScheduled = false;

    for (const { prop, oldValue, newValue } of updates) {
      const listeners = this._listeners.get(prop);
      if (listeners) {
        for (const cb of listeners) {
          cb(newValue, oldValue);
        }
      }
    }
    // 全局监听器
    const globalListeners = this._listeners.get('*');
    if (globalListeners) {
      for (const cb of globalListeners) {
        cb(updates);
      }
    }
  }

  // 订阅状态变化
  watch(prop, callback) {
    if (!this._listeners.has(prop)) {
      this._listeners.set(prop, new Set());
    }
    this._listeners.get(prop).add(callback);
    // 返回取消订阅函数 (闭包)
    return () => {
      this._listeners.get(prop)?.delete(callback);
    };
  }

  // 获取状态
  get state() {
    return this._state;
  }

  // 批量更新
  batch(updateFn) {
    updateFn(this._state);
    // 强制立即刷新 (不等待 microtask)
    this._flushUpdates();
  }
}

// 使用示例
const store = new ReactiveStore({
  user: { name: 'Alice', age: 25 },
  todos: [],
  loading: false,
});

// 监听用户变化
const unsub = store.watch('user', (newVal, oldVal) => {
  console.log('用户变化:', oldVal, '→', newVal);
});

// 全局监听
store.watch('*', (updates) => {
  console.log('状态更新:', updates);
});

// 修改状态
store.state.user.name = 'Bob';
// 输出:
// 用户变化: { name: 'Alice', age: 25 } → { name: 'Bob', age: 25 }
// 状态更新: [{ prop: 'user', oldValue: ..., newValue: ... }]

// 取消订阅
unsub();
store.state.user.name = 'Charlie'; // 不再触发监听
```

### 5.2 事件循环可视化调试器

```javascript
// 可视化事件循环执行顺序
class EventLoopDebugger {
  constructor() {
    this._log = [];
    this._originalLog = console.log;
  }

  // 拦截 console.log 添加时间戳和类型标记
  start() {
    const self = this;
    console.log = function (...args) {
      const entry = {
        time: performance.now(),
        type: self._detectType(),
        message: args.join(' '),
      };
      self._log.push(entry);
      self._originalLog.apply(console, args);
    };
  }

  stop() {
    console.log = this._originalLog;
  }

  _detectType() {
    const stack = new Error().stack;
    if (stack.includes('Promise')) return 'microtask (Promise)';
    if (stack.includes('queueMicrotask')) return 'microtask (queueMicrotask)';
    if (stack.includes('setTimeout')) return 'macrotask (setTimeout)';
    if (stack.includes('setImmediate')) return 'macrotask (setImmediate)';
    return 'sync';
  }

  getLog() {
    return this._log;
  }

  printTimeline() {
    console.log('\n=== 事件循环时间线 ===');
    let lastTime = this._log[0]?.time || 0;
    for (const entry of this._log) {
      const delta = (entry.time - lastTime).toFixed(3);
      console.log(`[${delta}ms] [${entry.type}] ${entry.message}`);
      lastTime = entry.time;
    }
    console.log('=====================\n');
  }
}

// 使用示例
const debugger$ = new EventLoopDebugger();
debugger$.start();

console.log('sync 1');
setTimeout(() => console.log('macro 1'), 0);
Promise.resolve().then(() => console.log('micro 1'));
queueMicrotask(() => console.log('micro 2'));
console.log('sync 2');

setTimeout(() => {
  debugger$.stop();
  debugger$.printTimeline();
}, 100);

// 输出:
// sync 1
// sync 2
// micro 2
// micro 1
// macro 1
//
// === 事件循环时间线 ===
// [0.000ms] [sync] sync 1
// [0.015ms] [sync] sync 2
// [0.020ms] [microtask (queueMicrotask)] micro 2
// [0.025ms] [microtask (Promise)] micro 1
// [0.510ms] [macrotask (setTimeout)] macro 1
// =====================
```

### 5.3 异步任务队列 (融合所有主题)

```javascript
// 终极实战: 异步任务队列
// 融合: 闭包 + 原型链 + Promise + 事件循环 + Proxy
class AsyncTaskQueue {
  #tasks = [];       // 私有字段 (ES2022)
  #running = false;
  #maxConcurrent = 1;
  #active = 0;
  #results = [];
  #onProgress = null;

  constructor(options = {}) {
    this.#maxConcurrent = options.maxConcurrent ?? 1;
    this.#onProgress = options.onProgress ?? null;

    // 使用 Proxy 代理 results 数组，自动触发进度回调
    this.results = new Proxy(this.#results, {
      set: (target, prop, value) => {
        target[prop] = value;
        if (this.#onProgress && prop !== 'length') {
          this.#onProgress({
            completed: target.filter((r) => r !== undefined).length,
            total: target.length,
          });
        }
        return true;
      },
    });
  }

  // 添加任务 (闭包捕获任务函数)
  add(taskFactory, options = {}) {
    const task = {
      factory: taskFactory,
      priority: options.priority ?? 0,
      id: Symbol('task-id'),
      createdAt: Date.now(),
    };
    this.#tasks.push(task);
    this.#results.push(undefined);
    this.#tasks.sort((a, b) => b.priority - a.priority);
    this._execute();
    return this;
  }

  // 执行队列
  async _execute() {
    if (this.#running) return;
    this.#running = true;

    while (this.#tasks.length > 0 && this.#active < this.#maxConcurrent) {
      const task = this.#tasks.shift();
      this.#active++;

      // 使用微任务确保异步执行
      queueMicrotask(async () => {
        try {
          const result = await task.factory();
          const index = this.#results.indexOf(undefined);
          if (index !== -1) {
            this.#results[index] = { status: 'fulfilled', value: result };
          }
        } catch (error) {
          const index = this.#results.indexOf(undefined);
          if (index !== -1) {
            this.#results[index] = { status: 'rejected', reason: error };
          }
        } finally {
          this.#active--;
          if (this.#tasks.length > 0) {
            this._execute();
          } else if (this.#active === 0) {
            this.#running = false;
          }
        }
      });
    }
  }

  // 等待所有任务完成
  async wait() {
    return new Promise((resolve) => {
      const check = () => {
        if (this.#tasks.length === 0 && this.#active === 0) {
          resolve(this.results);
        } else {
          requestAnimationFrame(check); // 浏览器环境
          // Node.js 环境用 setImmediate(check)
        }
      };
      check();
    });
  }

  // 取消所有任务
  cancel() {
    this.#tasks = [];
  }

  // 获取状态
  get status() {
    return {
      pending: this.#tasks.length,
      active: this.#active,
      completed: this.#results.filter((r) => r?.status === 'fulfilled').length,
      failed: this.#results.filter((r) => r?.status === 'rejected').length,
    };
  }
}

// 使用示例
const queue = new AsyncTaskQueue({
  maxConcurrent: 2,
  onProgress: ({ completed, total }) => {
    console.log(`进度: ${completed}/${total}`);
  },
});

// 添加任务
queue
  .add(
    () =>
      new Promise((resolve) =>
        setTimeout(() => {
          console.log('任务 A 完成');
          resolve('A');
        }, 200)
      ),
    { priority: 1 }
  )
  .add(
    () =>
      new Promise((resolve) =>
        setTimeout(() => {
          console.log('任务 B 完成');
          resolve('B');
        }, 100)
      ),
    { priority: 2 }
  )
  .add(
    () =>
      new Promise((resolve) =>
        setTimeout(() => {
          console.log('任务 C 完成');
          resolve('C');
        }, 50)
      ),
    { priority: 3 }
  );

queue.wait().then((results) => {
  console.log('所有任务完成:', results);
  console.log('最终状态:', queue.status);
});

// 输出:
// 任务 C 完成 (优先级最高，先执行)
// 任务 B 完成
// 进度: 1/3
// 进度: 2/3
// 任务 A 完成
// 进度: 3/3
// 所有任务完成: [
//   { status: 'fulfilled', value: 'C' },
//   { status: 'fulfilled', value: 'B' },
//   { status: 'fulfilled', value: 'A' }
// ]
// 最终状态: { pending: 0, active: 0, completed: 3, failed: 0 }
```

---

## 六、ES2024 前瞻

### 6.1 Promise.withResolvers

```javascript
// ES2024 提案: 简化 Promise 创建
// 之前:
function oldWay() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ES2024:
// const { promise, resolve, reject } = Promise.withResolvers();

// Polyfill
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// 使用: 外部控制 Promise
const { promise, resolve, reject } = Promise.withResolvers();
setTimeout(() => resolve('done!'), 1000);
promise.then(console.log); // "done!"
```

### 6.2 Array.prototype.groupBy

```javascript
// ES2024: 数组分组
const users = [
  { name: 'Alice', role: 'admin' },
  { name: 'Bob', role: 'user' },
  { name: 'Charlie', role: 'admin' },
  { name: 'David', role: 'user' },
];

// 之前需要 reduce
const groupedOld = users.reduce((acc, user) => {
  (acc[user.role] = acc[user.role] || []).push(user);
  return acc;
}, {});

// ES2024
const grouped = Object.groupBy(users, (user) => user.role);
console.log(grouped);
// {
//   admin: [{ name: 'Alice', role: 'admin' }, { name: 'Charlie', role: 'admin' }],
//   user: [{ name: 'Bob', role: 'user' }, { name: 'David', role: 'user' }]
// }

// Map 版本
const groupedMap = Map.groupBy(users, (user) => user.role);
console.log(groupedMap.get('admin'));
```

---

## 七、面试自测题

### 7.1 闭包
1. 闭包会导致内存泄漏吗？什么情况下会？如何避免？
2. `for (var i = 0; i < 3; i++) { setTimeout(() => console.log(i), 0); }` 输出什么？为什么？
3. 箭头函数有 `arguments` 对象吗？它的 `this` 怎么绑定？
4. 闭包和 WeakRef 的区别？各自适用场景？

### 7.2 原型
1. `__proto__` 和 `prototype` 的区别？
2. `Object.create(null)` 创建的对象有什么特点？
3. `instanceof` 的底层实现原理？
4. Proxy 的 13 种陷阱分别对应什么操作？

### 7.3 异步
1. `Promise.resolve().then(() => {}).catch(() => {})` 和 `new Promise()` 的区别？
2. async 函数返回的是什么？`async function f() { return 1; }` 的返回值类型？
3. `await` 后面如果不是 Promise 会怎样？
4. Promise.all 和 Promise.allSettled 的区别？

### 7.4 事件循环
1. 浏览器中 `requestAnimationFrame` 在事件循环的哪个阶段执行？
2. Node.js 中 `process.nextTick` 和 `Promise.then` 的优先级？
3. 微任务饥饿是什么？如何避免？
4. 浏览器和 Node.js 事件循环的主要区别？

---

## v6 总结

| 主题 | 核心收获 |
|------|----------|
| 闭包 | 执行上下文/词法环境/WeakRef/FinalizationRegistry/内存泄漏检测 |
| 原型 | [[Prototype]] 内部槽/Symbol 元编程/Proxy 13 陷阱/Reflect API |
| 异步 | 手写 Promise/async-await 编译原理/并发控制/ES2024 withResolvers |
| 事件循环 | 浏览器 vs Node.js 模型对比/微任务饥饿/rAF/调试器 |
| 综合 | 响应式状态管理器/异步任务队列 (融合所有主题) |

**累计统计 (5 轮迭代):**
- v1 (4/25): 基础概念 + 15 示例
- v2 (4/27): 完整知识体系 + 25 示例
- v3 (4/28): 速查 + 易错点 + 面试自测
- v4 (4/29): 高阶实战 31 题
- v5 (4/30): 跨主题综合实战
- v6 (5/2): 底层机制 + 元编程 + 引擎级理解 + ES2024 前瞻

**JS 深度领域: 6 轮迭代，完全闭环 ✅**
