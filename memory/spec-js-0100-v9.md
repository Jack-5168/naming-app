# 📖 专项训练 01:00 — JavaScript 深度（第 9 轮）

**日期：** 2026-05-11  
**主题：** 闭包进阶 / 原型链深度 / 异步模式 / 事件循环 V8 实现  
**覆盖章节：** JavaScript.info 第 5-7 章 + 进阶主题  
**与往期区别：** 往期（5/10）覆盖基础概念，本次聚焦**进阶深度**——闭包内存管理、原型链性能、异步并发控制、V8 任务调度细节

---

## 一、闭包进阶深度

### 1.1 闭包的内存泄漏模式

```js
// 模式 1：循环引用导致闭包无法 GC
function createLeak() {
  const largeArray = new Array(1000000).fill("x");
  const callback = () => console.log("done");
  // callback 持有 largeArray 的引用（即使没用到）
  // 因为它们在同一个词法环境中
  return callback;
}
const fn = createLeak();
// largeArray 无法被 GC，即使 callback 根本不用它

// 模式 2：DOM 引用 + 闭包
function setupButton() {
  const button = document.getElementById("btn");
  const hugeData = fetchLargeData(); // 10MB
  button.addEventListener("click", () => {
    console.log("clicked"); // 只用了 button，但 hugeData 也被闭包持有
  });
  // button 被 DOM 引用，hugeData 被闭包持有 → 内存泄漏
}

// 模式 3：缓存无限增长
function memoize(fn) {
  const cache = new Map(); // 无界缓存
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
// 修复：使用 WeakMap 或 LRU 限制缓存大小
```

### 1.2 闭包的词法环境内部结构（V8 实现）

```js
// V8 中，每个函数调用创建一个 Execution Context
// 包含：VariableEnvironment + LexicalEnvironment + ThisBinding

function outer() {
  let a = 1; // 存储在栈帧的局部变量区
  let b = 2; // 如果内部函数引用了 b → 提升到堆（closure 对象）

  function inner() {
    console.log(b); // 只引用了 b，a 仍可在栈上
  }

  return inner;
}

// V8 优化：
// - 未被内部函数引用的变量 → 保留在栈帧，函数返回后自动回收
// - 被引用的变量 → 提升到堆上的 "context" 对象（闭包）
// - 这就是为什么不是所有闭包都导致内存泄漏
```

### 1.3 闭包的实际应用模式

```js
// 模式 1：模块模式（私有状态）
const EventBus = (() => {
  const listeners = new Map(); // 完全私有，外部无法访问
  return {
    on(event, cb) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(cb);
    },
    emit(event, ...args) {
      listeners.get(event)?.forEach((cb) => cb(...args));
    },
    off(event, cb) {
      const cbs = listeners.get(event);
      if (cbs)
        listeners.set(
          event,
          cbs.filter((c) => c !== cb),
        );
    },
  };
})();

// 模式 2：工厂函数 + 闭包
function createValidator(rules) {
  return (data) => {
    const errors = {};
    for (const [field, rule] of Object.entries(rules)) {
      const result = rule(data[field]);
      if (result) errors[field] = result;
    }
    return { valid: Object.keys(errors).length === 0, errors };
  };
}

const validateUser = createValidator({
  name: (v) => (!v ? "Name is required" : null),
  age: (v) => (v < 0 || v > 150 ? "Invalid age" : null),
  email: (v) => (!v.includes("@") ? "Invalid email" : null),
});

console.log(validateUser({ name: "Alice", age: 25, email: "alice@test.com" }));
// { valid: true, errors: {} }

// 模式 3：函数柯里化 + 闭包
function curry(fn, arity = fn.length, ...args) {
  return args.length >= arity
    ? fn(...args)
    : (...more) => curry(fn, arity, ...args, ...more);
}

const add = (a, b, c) => a + b + c;
const curriedAdd = curry(add);
curriedAdd(1)(2)(3); // 6
curriedAdd(1, 2)(3); // 6
```

---

## 二、原型链深度

### 2.1 原型链查找的性能分析

```js
// 原型链深度 vs 查找性能
class Level1 {}
class Level2 extends Level1 {}
class Level3 extends Level2 {}
class Level4 extends Level3 {}
class Level5 extends Level4 {}
class Level6 extends Level5 {}
class Level7 extends Level6 {}

const obj = new Level7();

// 查找 obj.toString（在 Object.prototype 上，深度 7）
// V8 会沿原型链逐层查找，每层一次指针解引用
// 深度 > 3 时性能显著下降，建议控制继承深度

// 优化：将常用方法提升到更接近的层级
// 或使用 Mixin 模式替代深层继承
```

### 2.2 原型链的边界情况

```js
// 情况 1：Object.create(null) — 无原型链的对象
const dict = Object.create(null);
dict.name = "test";
console.log(dict.toString); // undefined（没有 Object.prototype）
console.log(dict.hasOwnProperty); // undefined
// 适合做纯字典/哈希表，不会有原型链污染

// 情况 2：原型链被意外修改
const obj = { a: 1 };
obj.__proto__ = null; // 断开原型链
console.log(obj.valueOf()); // TypeError: obj.valueOf is not a function

// 情况 3：Symbol.toStringTag 自定义
const myObj = {
  [Symbol.toStringTag]: "CustomObject",
};
console.log(Object.prototype.toString.call(myObj)); // [object CustomObject]

// 情况 4：Proxy 拦截原型链操作
const target = { a: 1 };
const proxy = new Proxy(target, {
  getPrototypeOf(t) {
    console.log("getPrototypeOf intercepted");
    return Object.getPrototypeOf(t);
  },
  setPrototypeOf(t, proto) {
    console.log("setPrototypeOf intercepted");
    return Object.setPrototypeOf(t, proto);
  },
});
Object.getPrototypeOf(proxy); // 触发拦截
```

### 2.3 ES6 Class 的原型链细节

```js
class Animal {
  static count = 0; // 静态属性（在 Animal 上，不在原型上）
  constructor(name) {
    this.name = name; // 实例属性
    Animal.count++;
  }
  speak() {
    return `${this.name} speaks`;
  } // 在 Animal.prototype 上
  static create(name) {
    // 静态方法
    return new Animal(name);
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name); // 调用 Animal constructor
    this.breed = breed;
  }
  speak() {
    // 覆盖父类方法
    return super.speak() + " woof"; // super.speak() 调用 Animal.prototype.speak
  }
}

// 原型链关系：
// Dog.prototype.__proto__ === Animal.prototype  ✅
// Dog.__proto__ === Animal                     ✅（类的继承是构造函数的继承）
// Dog.prototype.constructor === Dog            ✅
// new Dog().__proto__ === Dog.prototype        ✅
```

---

## 三、异步模式进阶

### 3.1 异步并发控制

```js
// 模式 1：并发限制的异步队列
class AsyncQueue {
  constructor(maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
    this.running = 0;
    this.queue = [];
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this._run();
    });
  }

  _run() {
    while (this.running < this.maxConcurrency && this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift();
      this.running++;

      Promise.resolve(task())
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this._run();
        });
    }
  }

  get pending() {
    return this.queue.length;
  }
  get active() {
    return this.running;
  }
}

// 使用
const queue = new AsyncQueue(3);
const urls = ["/api/1", "/api/2", "/api/3", "/api/4", "/api/5"];

urls.forEach((url) => {
  queue.add(() => fetch(url).then((r) => r.json()));
});

// 模式 2：Promise.allSettled 的增强版
async function fetchAllWithRetry(urls, maxRetries = 3) {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await fetch(url);
        } catch (e) {
          if (i === maxRetries - 1) throw e;
          await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        }
      }
    }),
  );

  return results.map((r, i) => ({
    url: urls[i],
    status: r.status,
    value: r.status === "fulfilled" ? r.value : r.reason,
  }));
}

// 模式 3：异步迭代器（处理流式数据）
async function* readChunks(stream, chunkSize = 1024) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

// 使用
for await (const chunk of readChunks(response.body)) {
  console.log(`Received ${chunk.length} bytes`);
}
```

### 3.2 async/await 的底层实现

```js
// async/await 本质是 Generator + Promise 的自动执行器
// Babel 转换后的代码大致如下：

function _asyncToGenerator(fn) {
  return function () {
    const gen = fn.apply(this, arguments);
    return new Promise((resolve, reject) => {
      function step(key, arg) {
        let result;
        try {
          result = gen[key](arg);
        } catch (e) {
          reject(e);
          return;
        }
        const { value, done } = result;
        if (done) {
          resolve(value);
        } else {
          Promise.resolve(value).then(
            (val) => step("next", val),
            (err) => step("throw", err),
          );
        }
      }
      return step("next");
    });
  };
}

// 使用示例
const myAsyncFn = _asyncToGenerator(function* () {
  const a = yield Promise.resolve(1);
  const b = yield Promise.resolve(2);
  return a + b;
});

myAsyncFn().then(console.log); // 3

// ⚠️ async/await 的陷阱
async function trap() {
  const promises = [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)];

  // 错误：串行执行（每个 await 等待前一个完成）
  for (const p of promises) {
    console.log(await p); // 3 次 await，串行
  }

  // 正确：并行执行
  const results = await Promise.all(promises);
  console.log(results); // 并行，一次拿到所有结果
}
```

### 3.3 错误处理的最佳实践

```js
// 模式 1：Result/Either 模式（避免 try-catch 嵌套）
function wrapAsync(fn) {
  return async (...args) => {
    try {
      const data = await fn(...args);
      return [null, data];
    } catch (error) {
      return [error, null];
    }
  };
}

const [err, user] = await wrapAsync(fetchUser)(123);
if (err) {
  /* 处理错误 */
} else {
  /* 使用 user */
}

// 模式 2：自定义错误类型
class AppError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, fields) {
    super(message, "VALIDATION_ERROR", 400);
    this.fields = fields;
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, "NOT_FOUND", 404);
  }
}

// 模式 3：全局错误处理（Node.js）
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // 在生产环境中应该上报监控
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // 优雅关闭
  server.close(() => process.exit(1));
});
```

---

## 四、事件循环 V8 实现深度

### 4.1 Node.js 事件循环的 6 个阶段

```
   ┌───────────────────────────┐
┌─>│           timers          │  setTimeout / setInterval 回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │  系统操作回调（如 TCP error）
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │  内部使用
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │  I/O 回调，最重要的阶段
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           check           │  setImmediate 回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──│      close callbacks      │  socket.on('close') 等
   └───────────────────────────┘
```

```js
// 各阶段执行顺序验证
setTimeout(() => console.log("timeout"), 0);
setImmediate(() => console.log("immediate"));
Promise.resolve().then(() => console.log("promise"));
process.nextTick(() => console.log("nextTick"));
console.log("sync");

// 输出（在主模块中）：
// sync
// nextTick          ← nextTick 队列在每个阶段后优先清空
// promise           ← microtask 队列
// timeout           ← timers 阶段（0ms 延迟不保证立即执行）
// immediate         ← check 阶段

// ⚠️ setTimeout vs setImmediate 的顺序不确定
// 取决于事件循环进入 timers 阶段时是否已过 0ms
```

### 4.2 nextTick vs Promise.then 的优先级

```js
// Node.js 中 nextTick 优先级高于 Promise.then
// 每个阶段结束后，先清空 nextTick 队列，再清空 microtask 队列

process.nextTick(() => console.log("nextTick-1"));
Promise.resolve().then(() => console.log("promise-1"));
process.nextTick(() => console.log("nextTick-2"));
Promise.resolve().then(() => console.log("promise-2"));

// 输出：
// nextTick-1
// nextTick-2
// promise-1
// promise-2

// ⚠️ 递归 nextTick 会阻塞事件循环
function blockEventLoop() {
  process.nextTick(blockEventLoop);
  // 事件循环永远无法进入下一个阶段
  // 这就是为什么 nextTick 不适合做递归操作
}
```

### 4.3 浏览器 vs Node.js 事件循环差异

```js
// 浏览器事件循环：
// 1. 执行一个宏任务（script/setTimeout/setInterval）
// 2. 清空微任务队列（Promise.then/MutationObserver/queueMicrotask）
// 3. 更新渲染（如果需要）
// 4. 回到步骤 1

// Node.js 事件循环：
// 1. 进入对应阶段（timers/pending/poll/check/close）
// 2. 执行该阶段的回调
// 3. 清空 nextTick 队列
// 4. 清空 microtask 队列
// 5. 进入下一阶段

// 关键差异：
// - Node.js 有 nextTick 队列（优先级最高）
// - Node.js 有明确的 6 阶段模型
// - 浏览器有 requestAnimationFrame（在微任务后、渲染前）
// - 浏览器有 requestIdleCallback（空闲时执行）

// 跨平台兼容的异步调度
const scheduler =
  typeof process !== "undefined" && process.nextTick
    ? process.nextTick.bind(process) // Node.js
    : typeof MutationObserver !== "undefined"
      ? (cb) => {
          // 浏览器（微任务）
          const observer = new MutationObserver(cb);
          const node = document.createTextNode("");
          observer.observe(node, { characterData: true });
          node.data = "x";
        }
      : (cb) => setTimeout(cb, 0); // 降级
```

---

## 五、深度题目

### 题目 1：闭包与内存管理（★★★★）

```js
// 问题：以下代码有什么内存问题？如何修复？

function createImageLoader() {
  const cache = {};

  return {
    load(url) {
      if (cache[url]) return cache[url];
      const img = new Image();
      img.src = url;
      img.onload = () => {
        cache[url] = img; // 问题：缓存无限增长，图片无法 GC
      };
      return img;
    },
    clear() {
      // 问题：只清空了引用，但 img.onload 闭包仍持有 cache 引用
      for (const key in cache) delete cache[key];
    },
  };
}

// 修复方案：使用 WeakMap + LRU 限制
function createImageLoaderV2(maxSize = 100) {
  const cache = new Map();

  function evict() {
    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
  }

  return {
    load(url) {
      if (cache.has(url)) {
        // LRU：移到末尾
        const img = cache.get(url);
        cache.delete(url);
        cache.set(url, img);
        return img;
      }
      const img = new Image();
      img.src = url;
      img.onload = () => {
        cache.set(url, img);
        evict();
      };
      return img;
    },
    clear() {
      cache.clear();
    },
  };
}
```

### 题目 2：原型链与性能（★★★★）

```js
// 问题：以下代码的性能瓶颈在哪？如何优化？

class EventEmitter {
  constructor() {
    this._events = Object.create(null);
  }

  on(event, listener) {
    (this._events[event] = this._events[event] || []).push(listener);
    return this;
  }

  emit(event, ...args) {
    const listeners = this._events[event];
    if (listeners) {
      listeners.forEach((l) => l.apply(this, args));
    }
    return this;
  }
}

// 子类：频繁创建实例
class MyComponent extends EventEmitter {
  constructor(id) {
    super();
    this.id = id;
    this.data = {};
    this.state = {};
    this.props = {};
    // ... 大量实例属性
  }

  render() {
    /* ... */
  }
  update(data) {
    /* ... */
  }
  destroy() {
    /* ... */
  }
}

// 性能分析：
// 1. 每次 new MyComponent() 都会创建新的 _events 对象
// 2. 原型链查找：emit → EventEmitter.prototype.emit → Object.prototype
// 3. 如果创建 10000 个实例，内存开销 = 10000 * (实例属性 + _events)

// 优化方案：
// 1. 将 _events 延迟初始化（只在第一次 on/emit 时创建）
// 2. 使用 Object.create(null) 避免原型链查找
// 3. 对象池复用实例

class EventEmitterOptimized {
  constructor() {
    this._events = null; // 延迟初始化
  }

  on(event, listener) {
    if (!this._events) this._events = Object.create(null);
    (this._events[event] || (this._events[event] = [])).push(listener);
    return this;
  }

  emit(event, ...args) {
    const listeners = this._events?.[event];
    if (listeners) {
      for (let i = 0; i < listeners.length; i++) {
        listeners[i].apply(this, args);
      }
    }
    return this;
  }
}
```

### 题目 3：事件循环综合题（★★★★★）

```js
// 问题：输出什么？为什么？

async function async1() {
  console.log("async1 start");
  await async2();
  console.log("async1 end");
}

async function async2() {
  console.log("async2");
}

console.log("script start");

setTimeout(async () => {
  console.log("setTimeout");
  await async1();
  console.log("setTimeout end");
}, 0);

new Promise((resolve) => {
  console.log("promise1");
  resolve();
}).then(() => {
  console.log("promise2");
});

async1();

console.log("script end");

// 输出：
// script start
// async1 start
// async2
// promise1
// script end
// async1 end       ← await 后的代码是微任务
// promise2         ← Promise.then 是微任务
// setTimeout       ← 宏任务
// async1 start     ← setTimeout 内的 async1()
// async2
// async1 end       ← await 后的代码
// setTimeout end

// 解析：
// 1. 同步：script start → async1 start → async2 → promise1 → script end
// 2. 微任务：async1 end → promise2
// 3. 宏任务：setTimeout
// 4. setTimeout 内的 async1：同步执行 async1 start → async2
// 5. setTimeout 内的微任务：async1 end
// 6. setTimeout 继续：setTimeout end
```

### 题目 4：实现 Promise.all（★★★★★）

```js
// 手写 Promise.all，要求：
// 1. 全部成功时返回结果数组
// 2. 一个失败时立即 reject
// 3. 传入空数组时 resolve([])
// 4. 非 Promise 元素自动包装

Promise.myAll = function (promises) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(promises)) {
      return reject(new TypeError("Argument must be an array"));
    }

    const results = [];
    let completed = 0;
    const total = promises.length;

    if (total === 0) {
      resolve(results);
      return;
    }

    promises.forEach((p, index) => {
      Promise.resolve(p).then(
        (value) => {
          results[index] = value; // 保持顺序
          completed++;
          if (completed === total) {
            resolve(results);
          }
        },
        (reason) => reject(reason), // 立即失败
      );
    });
  });
};

// 测试
Promise.myAll([Promise.resolve(1), 2, Promise.resolve(3)]).then(console.log); // [1, 2, 3]

// 失败测试
Promise.myAll([
  Promise.resolve(1),
  Promise.reject(new Error("fail")),
  Promise.resolve(3),
]).catch((e) => console.log(e.message)); // 'fail'
```

### 题目 5：实现 Event Emitter（★★★★★）

```js
// 实现一个完整的 Event Emitter，要求：
// 1. on / off / emit / once
// 2. 支持通配符事件（'*' 匹配所有）
// 3. 支持错误事件（'error' 未监听时抛出）
// 4. 支持链式调用
// 5. 支持移除所有监听

class EventEmitter {
  constructor() {
    this._events = Object.create(null);
    this._wildcard = [];
    this._maxListeners = 10;
  }

  setMaxListeners(n) {
    this._maxListeners = n;
    return this;
  }

  on(event, listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Listener must be a function");
    }

    if (event === "*") {
      this._wildcard.push(listener);
    } else {
      const events = this._events[event] || (this._events[event] = []);

      if (events.length >= this._maxListeners) {
        console.warn(
          `Possible memory leak: ${this._maxListeners} listeners on "${event}"`,
        );
      }

      events.push(listener);
    }

    return this;
  }

  once(event, listener) {
    const onceListener = (...args) => {
      listener.apply(this, args);
      this.off(event, onceListener);
    };
    onceListener._original = listener;
    return this.on(event, onceListener);
  }

  off(event, listener) {
    if (event === "*") {
      this._wildcard = [];
      return this;
    }

    const events = this._events[event];
    if (!events) return this;

    this._events[event] = events.filter(
      (l) => l !== listener && l._original !== listener,
    );

    return this;
  }

  emit(event, ...args) {
    // 触发通配符监听器
    for (const listener of this._wildcard) {
      listener.call(this, event, ...args);
    }

    const events = this._events[event];
    if (!events || events.length === 0) {
      // error 事件未监听时抛出
      if (event === "error" && args.length > 0) {
        throw args[0];
      }
      return false;
    }

    // 复制数组防止监听器修改原数组
    const listeners = events.slice();
    for (const listener of listeners) {
      listener.apply(this, args);
    }

    return true;
  }

  removeAllListeners(event) {
    if (event) {
      delete this._events[event];
    } else {
      this._events = Object.create(null);
      this._wildcard = [];
    }
    return this;
  }

  listenerCount(event) {
    if (event === "*") return this._wildcard.length;
    return this._events[event]?.length || 0;
  }
}

// 使用示例
const ee = new EventEmitter();

ee.on("data", (val) => console.log("data:", val));
ee.on("*", (event, ...args) => console.log("wildcard:", event, args));
ee.once("once", () => console.log("only once"));

ee.emit("data", 1);
// data: 1
// wildcard: data [1]

ee.emit("once");
// only once

ee.emit("once"); // 无输出（once 已移除）
```

### 题目 6：V8 引擎优化技巧（★★★★★）

```js
// V8 使用隐藏类（Hidden Classes）优化对象属性访问
// 理解隐藏类可以写出更快的 JS 代码

// ❌ 反模式：动态添加属性（破坏隐藏类）
function BadPoint(x, y) {
  this.x = x;
  this.y = y;
}
const p1 = new BadPoint(1, 2);
const p2 = new BadPoint(3, 4);
p1.z = 5; // 创建新的隐藏类，p1 和 p2 不再共享

// ✅ 正模式：构造函数中声明所有属性
function GoodPoint(x, y, z = 0) {
  this.x = x;
  this.y = y;
  this.z = z;
}
const p3 = new GoodPoint(1, 2, 3);
const p4 = new GoodPoint(4, 5, 6);
// p3 和 p4 共享同一个隐藏类 → 更快的属性访问

// V8 优化技巧：
// 1. 对象形状一致（相同属性名和顺序）
// 2. 避免 delete（破坏隐藏类）→ 用 null 替代
// 3. 构造函数中初始化所有属性
// 4. 按相同顺序赋值属性
// 5. 避免使用非整数索引（V8 会切换到字典模式）

// delete 的反模式
const obj = { a: 1, b: 2, c: 3 };
delete obj.b; // 破坏隐藏类，切换到字典模式
obj.b = undefined; // ✅ 更好：保持隐藏类

// 元素类型一致性
const arr1 = [1, 2, 3]; // PACKED_SMI_ELEMENTS（小整数）
arr1.push(4.5); // 升级为 PACKED_DOUBLE_ELEMENTS
arr1.push("hello"); // 升级为 PACKED_ELEMENTS（通用）
// 类型升级不可逆，混合类型会降低性能

// 预分配数组大小
const arr2 = new Array(1000); // 预分配，避免扩容
for (let i = 0; i < 1000; i++) {
  arr2[i] = i;
}
```

---

## 六、深度面试题速答

| 问题                                            | 答案                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| 闭包一定会导致内存泄漏吗？                      | 不会。只有闭包持有大对象且外部仍有引用时才会泄漏。V8 会优化未被引用的变量          |
| `__proto__` 和 `prototype` 的区别？             | `__proto__` 是实例指向原型对象的属性；`prototype` 是构造函数用于创建实例原型的属性 |
| `Object.create(null)` 和普通对象的区别？        | 无原型链，无 `toString`/`hasOwnProperty` 等方法，适合做纯字典                      |
| `async/await` 和 `Promise.then` 的优先级？      | 在同一微任务批次中，`await` 后的代码和 `Promise.then` 按注册顺序执行               |
| `setTimeout(fn, 0)` 真的立即执行吗？            | 不。HTML5 规范要求至少 4ms，Node.js 中受事件循环阶段影响                           |
| `process.nextTick` 为什么比 `Promise.then` 快？ | Node.js 在每个阶段结束后先清空 nextTick 队列，再清空 microtask 队列                |
| V8 隐藏类是什么？                               | V8 为相同结构的对象创建共享的"隐藏类"，加速属性查找。动态添加属性会破坏隐藏类      |
| 如何避免事件循环阻塞？                          | 避免同步大计算、使用 `setImmediate`/`setTimeout` 分片、Worker 线程                 |

---

## 七、今日总结

**重点回顾：**

1. **闭包进阶** = 词法环境内部结构 + 内存管理 + 实际应用模式（模块/工厂/柯里化）
2. **原型链深度** = 性能分析 + 边界情况 + ES6 Class 细节 + Proxy 拦截
3. **异步模式** = 并发控制 + async/await 底层 + 错误处理最佳实践
4. **事件循环 V8** = 6 阶段模型 + nextTick 优先级 + 浏览器 vs Node.js 差异

**易错点：**

- 闭包持有未使用的变量 → V8 会优化，但大对象仍需手动清理
- 原型链深度 > 3 时性能下降 → 控制继承深度
- `setTimeout(fn, 0)` 不保证立即执行 → 受事件循环阶段影响
- `delete` 破坏 V8 隐藏类 → 用 `obj.prop = undefined` 替代
- `async/await` 循环中串行执行 → 用 `Promise.all` 并行

**进阶方向：**

- V8 源码阅读（turbofan 优化编译器）
- Node.js libuv 事件循环实现
- Web Workers 与 SharedArrayBuffer
- 性能 profiling（Chrome DevTools / Node --inspect）
