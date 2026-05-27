# 🔬 JavaScript 深度专项 — 第五轮：闭包/原型/异步/事件循环（综合实战版）

**时间：** 2026-04-30 01:00  
**前置轮次：** 4/25 → 4/27 → 4/28 → 4/29  
**定位：** 第五轮 — 聚焦「跨主题综合应用 + 底层机制深挖 + 真实场景陷阱」

---

## 一、闭包 × 原型链：综合应用

### 1.1 闭包 + 原型组合：工厂函数创建原型链对象

传统构造函数 + 原型模式 vs 闭包工厂 + 原型链：

```javascript
// 传统方式：构造函数 + 原型
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return `${this.name} makes a sound`;
};

// 闭包工厂 + 原型链：私有状态 + 共享方法
const createAnimal = (function () {
  // 闭包：共享的私有数据存储
  const registry = new WeakMap(); // 用 WeakMap 避免内存泄漏

  const AnimalProto = {
    speak() {
      const data = registry.get(this);
      return `${data.name} makes a sound`;
    },
    getName() {
      return registry.get(this).name;
    },
  };

  return function (name) {
    const obj = Object.create(AnimalProto);
    registry.set(obj, { name, createdAt: Date.now() });
    return obj;
  };
})();

const cat = createAnimal("Kitty");
console.log(cat.speak()); // "Kitty makes a sound"
console.log(cat.getName()); // "Kitty"
// cat.name → undefined（真正的私有！）
```

**关键洞察：**

- WeakMap 作为闭包内的私有存储，对象被 GC 时自动清理
- 原型链共享方法，闭包管理私有状态
- 比 `#privateField` 兼容性更好（ES2022 vs ES6）

### 1.2 闭包 + 原型链：实现可组合的装饰器模式

```javascript
// 闭包创建装饰器工厂，原型链实现方法委托
function createDecoratedObject(baseObj, ...decorators) {
  const originalMethods = new Map();

  // 保存原始方法
  for (const key of Object.getOwnPropertyNames(baseObj)) {
    if (typeof baseObj[key] === "function") {
      originalMethods.set(key, baseObj[key]);
    }
  }

  const DecoratedProto = {
    __proto__: baseObj.__proto__ || Object.prototype,
  };

  // 为每个方法应用装饰器
  for (const [key, originalFn] of originalMethods) {
    DecoratedProto[key] = function (...args) {
      let result = originalFn.apply(this, args);
      // 从内到外应用装饰器
      for (const decorator of decorators) {
        result = decorator(key, result, args, this);
      }
      return result;
    };
  }

  return Object.create(DecoratedProto);
}

// 使用示例
const loggerDecorator = (method, result, args, ctx) => {
  console.log(`[LOG] ${method}(${args.join(",")}) → ${result}`);
  return result;
};

const timerDecorator = (method, result, args, ctx) => {
  const start = performance.now();
  const res =
    result instanceof Promise
      ? result.then((r) => {
          console.log(`[${method}] ${performance.now() - start}ms`);
          return r;
        })
      : (console.log(`[${method}] ${performance.now() - start}ms`), result);
  return res;
};

const calculator = {
  add(a, b) {
    return a + b;
  },
  multiply(a, b) {
    return a * b;
  },
};

const decoratedCalc = createDecoratedObject(
  calculator,
  loggerDecorator,
  timerDecorator,
);
decoratedCalc.add(2, 3); // [LOG] add(2,3) → 5 / [add] 0.12ms
```

---

## 二、原型链深度：ES6+ 陷阱与边界

### 2.1 Symbol.species：控制构造函数派生行为

```javascript
class MyArray extends Array {
  // 默认情况下，map/filter/slice 返回 MyArray 实例
  // 用 Symbol.species 控制返回类型

  static get [Symbol.species]() {
    return Array; // 让 map/filter 返回原生 Array
  }
}

const arr = new MyArray(1, 2, 3);
const mapped = arr.map((x) => x * 2);
console.log(mapped instanceof MyArray); // false（返回原生 Array）
console.log(mapped instanceof Array); // true

// 对比：不定义 Symbol.species
class MyArray2 extends Array {}
const arr2 = new MyArray2(1, 2, 3);
console.log(arr2.map((x) => x * 2) instanceof MyArray2); // true
```

**实际应用场景：**

- 自定义集合类，但希望 `filter` 返回普通数组避免继承副作用
- 框架中控制派生类的实例化行为（如 Vue 的 ReactiveArray）

### 2.2 原型链查找的性能陷阱

```javascript
// 陷阱：过深的原型链 + 大量属性查找
function DeepChain(depth) {
  let obj = { value: "root" };
  for (let i = 0; i < depth; i++) {
    obj = Object.create(obj);
  }
  return obj;
}

const deep = DeepChain(1000);

// 查找不存在的属性会遍历整条原型链
console.time("deep-lookup");
for (let i = 0; i < 1_000_000; i++) {
  void deep.nonExistent; // 每次遍历 1000 层
}
console.timeEnd("deep-lookup"); // ~200ms

const shallow = Object.create({ value: "root" });
console.time("shallow-lookup");
for (let i = 0; i < 1_000_000; i++) {
  void shallow.nonExistent; // 只遍历 1 层
}
console.timeEnd("shallow-lookup"); // ~10ms

// V8 优化：原型链深度 > 100 时，IC (Inline Cache) 失效
// 解决方案：限制原型链深度 ≤ 3 层，或使用组合代替继承
```

### 2.3 Object.create(null) vs {}：无原型对象的威力

```javascript
// {} 继承 Object.prototype，有潜在冲突
const dict1 = {};
dict1["hasOwnProperty"] = "my value"; // 覆盖原型方法！
dict1.hasOwnProperty("key"); // TypeError: not a function

// Object.create(null) 创建"纯字典"，零原型污染
const dict2 = Object.create(null);
dict2["hasOwnProperty"] = "my value"; // 安全，没有原型方法可覆盖
dict2["toString"] = "custom";
dict2["__proto__"] = "safe"; // 不会设置原型！

// 实际场景：频率统计 / 缓存 / 配置映射
function wordFrequency(text) {
  const freq = Object.create(null); // 纯字典
  for (const word of text.toLowerCase().split(/\s+/)) {
    freq[word] = (freq[word] || 0) + 1;
  }
  return freq;
}

const freq = wordFrequency("the cat and the dog and the cat");
console.log(freq["the"]); // 3
console.log(freq["and"]); // 2
console.log(Object.keys(freq)); // ['the', 'cat', 'and', 'dog']
```

---

## 三、异步编程：事件循环深度机制

### 3.1 Microtask vs Macrotask：精确调度控制

```javascript
// 事件循环的完整执行顺序（Node.js 和浏览器有差异）

console.log("1. sync start");

setTimeout(() => {
  console.log("4. setTimeout (macrotask)");
}, 0);

Promise.resolve()
  .then(() => {
    console.log("3. Promise.then (microtask)");
    // microtask 中再推 microtask，会在同一轮执行
    return Promise.resolve().then(() => {
      console.log("3.1. nested microtask");
    });
  })
  .then(() => {
    console.log("3.2. chained microtask");
  });

queueMicrotask(() => {
  console.log("3.3. queueMicrotask");
});

console.log("2. sync end");

// 输出顺序：
// 1. sync start
// 2. sync end
// 3. Promise.then (microtask)
// 3.1. nested microtask
// 3.2. chained microtask
// 3.3. queueMicrotask
// 4. setTimeout (macrotask)

// 关键规则：
// 1. 同步代码 → 全部执行完
// 2. 清空 microtask 队列（包括新推入的 microtask）
// 3. 渲染（浏览器）/ I/O 回调（Node.js）
// 4. 执行一个 macrotask
// 5. 回到步骤 2
```

### 3.2 Node.js 事件循环六阶段详解

```javascript
// Node.js 事件循环的 6 个阶段（每轮都执行）：
//
//  ┌───────────────────────────┐
//  │         timers            │  ← setTimeout/setInterval 回调
//  ├───────────────────────────┤
//  │     pending callbacks     │  ← 系统操作回调
//  ├───────────────────────────┤
//  │       idle, prepare       │  ← 内部使用
//  ├───────────────────────────┤
//  │           poll            │  ← I/O 回调，最重要的阶段
//  ├───────────────────────────┤
//  │          check            │  ← setImmediate 回调
//  ├───────────────────────────┤
//  │      close callbacks      │  ← socket.on('close')
//  └───────────────────────────┘

// 实战：理解 timer vs setImmediate 的顺序
// 在脚本顶层（main module），顺序是不确定的：
setTimeout(() => console.log("timeout"), 0);
setImmediate(() => console.log("immediate"));
// 可能输出: timeout → immediate  或  immediate → timeout

// 但在 I/O 回调中，setImmediate 一定在 setTimeout 之前：
const fs = require("fs");
fs.readFile(__filename, () => {
  setTimeout(() => console.log("timeout in I/O"));
  setImmediate(() => console.log("immediate in I/O"));
});
// 一定输出: immediate in I/O → timeout in I/O
// 原因：I/O 回调在 poll 阶段执行完后，进入 check 阶段（setImmediate），
//       然后下一轮才到 timers 阶段（setTimeout）
```

### 3.3 手写事件循环模拟器

```javascript
// 模拟浏览器事件循环，理解 microtask/macrotask 调度
class EventLoopSimulator {
  constructor() {
    this.microtasks = [];
    this.macrotasks = [];
    this.running = false;
  }

  // 推入 microtask（Promise.then, queueMicrotask, MutationObserver）
  queueMicrotask(fn) {
    this.microtasks.push(fn);
  }

  // 推入 macrotask（setTimeout, setInterval, setImmediate, I/O）
  queueMacrotask(fn, delay = 0) {
    this.macrotasks.push({ fn, delay, readyAt: Date.now() + delay });
  }

  // 运行事件循环
  run() {
    this.running = true;
    while (
      this.running &&
      (this.microtasks.length > 0 || this.macrotasks.length > 0)
    ) {
      // 1. 执行所有 microtasks（包括新推入的）
      while (this.microtasks.length > 0) {
        const task = this.microtasks.shift();
        try {
          task();
        } catch (e) {
          console.error("Microtask error:", e);
        }
      }

      // 2. 执行一个就绪的 macrotask
      const now = Date.now();
      const ready = this.macrotasks.find((t) => t.readyAt <= now);
      if (ready) {
        this.macrotasks = this.macrotasks.filter((t) => t !== ready);
        try {
          ready.fn();
        } catch (e) {
          console.error("Macrotask error:", e);
        }
      } else if (this.macrotasks.length > 0) {
        // 没有就绪的 macrotask，等待（简化处理）
        break;
      }
    }
  }

  stop() {
    this.running = false;
  }
}

// 测试
const loop = new EventLoopSimulator();

loop.queueMacrotask(() => console.log("A: setTimeout"));
loop.queueMicrotask(() => console.log("B: microtask 1"));
loop.queueMicrotask(() => {
  console.log("C: microtask 2");
  loop.queueMicrotask(() => console.log("D: nested microtask"));
});

loop.run();
// 输出: B → C → D → A
// microtask 队列清空后才执行 macrotask
```

### 3.4 异步控制流：高级模式

```javascript
// 模式 1：异步串行管道（数据流经多个异步处理步骤）
async function asyncPipeline(initialValue, ...steps) {
  let result = initialValue;
  for (const step of steps) {
    result = await step(result);
  }
  return result;
}

// 示例：数据处理管道
const processData = asyncPipeline(
  { raw: "  Hello World 123  " },
  async (data) => ({ ...data, trimmed: data.raw.trim() }),
  async (data) => ({ ...data, lower: data.trimmed.toLowerCase() }),
  async (data) => ({ ...data, cleaned: data.lower.replace(/\d+/g, "") }),
  async (data) => ({
    ...data,
    words: data.cleaned.split(/\s+/).filter(Boolean),
  }),
);
// → { raw: '...', trimmed: 'Hello World 123', lower: 'hello world 123',
//     cleaned: 'hello world ', words: ['hello', 'world'] }

// 模式 2：异步并发控制器（限制并发数）
class AsyncPool {
  constructor(maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
    this.running = 0;
    this.queue = [];
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._run();
    });
  }

  _run() {
    while (this.running < this.maxConcurrency && this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();
      this.running++;

      Promise.resolve(fn())
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this._run(); // 触发下一个
        });
    }
  }
}

// 使用：限制 3 个并发请求
const pool = new AsyncPool(3);
const urls = Array.from(
  { length: 10 },
  (_, i) => `https://api.example.com/item/${i}`,
);

const results = await Promise.all(
  urls.map((url) =>
    pool.add(async () => {
      const res = await fetch(url);
      return res.json();
    }),
  ),
);

// 模式 3：异步重试 + 退避策略
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      // 指数退避 + 随机抖动
      const delay = baseDelay * Math.pow(2, attempt) * (0.5 + Math.random());
      console.log(
        `Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// 使用
const result = await retryWithBackoff(
  () =>
    fetch("https://api.example.com/data").then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
  5, // 最多重试 5 次
  1000, // 基础延迟 1 秒
);
```

---

## 四、综合实战：从零构建响应式系统

### 4.1 闭包 + 代理 + 事件循环：实现 Vue 3 风格响应式

```javascript
// 简化版 Vue 3 响应式系统（展示闭包/原型/异步的综合应用）
const createReactive = (function () {
  // 闭包：全局的 WeakMap 注册表
  const reactiveMap = new WeakMap();
  const targetMap = new WeakMap(); // target → key → deps Set

  // 当前活跃的 effect（闭包变量，类似 Vue 的 activeEffect）
  let activeEffect = null;

  // 依赖收集
  function track(target, key) {
    if (!activeEffect) return;

    let depsMap = targetMap.get(target);
    if (!depsMap) {
      depsMap = new Map();
      targetMap.set(target, depsMap);
    }

    let deps = depsMap.get(key);
    if (!deps) {
      deps = new Set();
      depsMap.set(key, deps);
    }

    deps.add(activeEffect);
  }

  // 触发更新
  function trigger(target, key) {
    const depsMap = targetMap.get(target);
    if (!depsMap) return;

    const deps = depsMap.get(key);
    if (!deps) return;

    // 使用 queueMicrotask 批量更新（避免重复触发）
    queueMicrotask(() => {
      deps.forEach((effect) => effect());
    });
  }

  // 创建响应式对象
  function createProxy(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (reactiveMap.has(obj)) return reactiveMap.get(obj);

    const proxy = new Proxy(obj, {
      get(target, key, receiver) {
        const result = Reflect.get(target, key, receiver);
        track(target, key);
        // 嵌套对象也变成响应式
        return typeof result === "object" && result !== null
          ? createProxy(result)
          : result;
      },
      set(target, key, value, receiver) {
        const oldValue = target[key];
        const result = Reflect.set(target, key, value, receiver);
        if (oldValue !== value) {
          trigger(target, key);
        }
        return result;
      },
      deleteProperty(target, key) {
        const result = Reflect.deleteProperty(target, key);
        trigger(target, key);
        return result;
      },
    });

    reactiveMap.set(obj, proxy);
    return proxy;
  }

  // effect 函数
  function effect(fn) {
    const reactiveEffect = () => {
      const prevEffect = activeEffect;
      activeEffect = reactiveEffect;
      try {
        fn();
      } finally {
        activeEffect = prevEffect;
      }
    };
    reactiveEffect();
    return reactiveEffect;
  }

  return { createProxy, effect };
})();

// 使用示例
const { createProxy: reactive, effect } = createReactive;

const state = reactive({
  count: 0,
  user: { name: "Alice", age: 25 },
});

// 自动收集依赖
effect(() => {
  console.log(`Count changed to: ${state.count}`);
});

effect(() => {
  console.log(`User: ${state.user.name}, Age: ${state.user.age}`);
});

state.count++; // 触发 microtask → "Count changed to: 1"
state.user.age = 26; // 触发 microtask → "User: Alice, Age: 26"
```

### 4.2 事件循环 + 异步：实现微任务调度器

```javascript
// 实现类似 React Scheduler 的微任务优先级调度器
class Scheduler {
  constructor() {
    this.immediateQueue = []; // 立即执行（当前 microtask 批次）
    this.normalQueue = []; // 正常优先级
    this.lowQueue = []; // 低优先级
    this.scheduled = false;
  }

  schedule(task, priority = "normal") {
    const queue =
      priority === "immediate"
        ? this.immediateQueue
        : priority === "low"
          ? this.lowQueue
          : this.normalQueue;
    queue.push(task);
    this._flush();
  }

  _flush() {
    if (this.scheduled) return;
    this.scheduled = true;

    queueMicrotask(() => {
      this.scheduled = false;
      this._executeBatch();
    });
  }

  _executeBatch() {
    // 优先级：immediate > normal > low
    while (this.immediateQueue.length > 0) {
      this.immediateQueue.shift()();
    }
    while (this.normalQueue.length > 0) {
      this.normalQueue.shift()();
    }
    while (this.lowQueue.length > 0) {
      this.lowQueue.shift()();
    }
  }
}

// 使用：UI 渲染调度
const scheduler = new Scheduler();

// 高优先级：用户交互反馈
scheduler.schedule(() => {
  console.log("🔴 高优先级：按钮点击反馈");
}, "immediate");

// 正常优先级：数据更新
scheduler.schedule(() => {
  console.log("🟡 正常优先级：列表数据更新");
}, "normal");

// 低优先级：日志/分析
scheduler.schedule(() => {
  console.log("🟢 低优先级：发送分析数据");
}, "low");

// 输出顺序：🔴 → 🟡 → 🟢
```

---

## 五、面试高频陷阱题（第五轮精选）

### 5.1 闭包 + 循环 + 异步组合

```javascript
// 陷阱 1：经典 for 循环 + setTimeout + 闭包
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 输出: 3, 3, 3（var 没有块级作用域）

// 修复 1：let 块级作用域
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 输出: 0, 1, 2（每轮迭代创建新的词法环境）

// 修复 2：闭包捕获
for (var i = 0; i < 3; i++) {
  ((j) => {
    setTimeout(() => console.log(j), 0);
  })(i);
}
// 输出: 0, 1, 2

// 陷阱 2：Promise + setTimeout 混合
console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve()
  .then(() => {
    console.log("3");
    setTimeout(() => console.log("4"), 0);
  })
  .then(() => console.log("5"));
console.log("6");
// 输出: 1 → 6 → 3 → 5 → 2 → 4
// 同步 → microtask → macrotask（setTimeout 在下一轮）

// 陷阱 3：async/await + Promise 链
async function f() {
  console.log("A");
  await Promise.resolve();
  console.log("B");
}

Promise.resolve().then(() => console.log("C"));
f();
console.log("D");
// 输出: A → D → B → C
// await 后的代码是 microtask，与 Promise.then 同级，按注册顺序执行
```

### 5.2 原型链 + this 指向

```javascript
// 陷阱：原型方法中的 this 指向
const obj = {
  name: "obj",
  getName() {
    return this.name;
  },
};

const proto = { name: "proto" };
Object.setPrototypeOf(obj, proto);

console.log(obj.getName()); // 'obj'（this 指向 obj）

const extracted = obj.getName;
console.log(extracted()); // undefined（this 指向全局/undefined）

// 修复：bind
const bound = obj.getName.bind(obj);
console.log(bound()); // 'obj'

// 陷阱：箭头函数没有自己的 this
const animal = {
  name: "cat",
  sounds: ["meow", "purr"],
  logSounds() {
    // 箭头函数的 this 继承自外层（logSounds 方法）
    this.sounds.forEach((sound) => {
      console.log(`${this.name}: ${sound}`);
    });
  },
};

animal.logSounds(); // "cat: meow" / "cat: purr"

// 如果用普通函数会怎样？
const animal2 = {
  name: "cat",
  sounds: ["meow", "purr"],
  logSounds() {
    this.sounds.forEach(function (sound) {
      console.log(`${this.name}: ${sound}`); // this 丢失！
    });
  },
};

animal2.logSounds(); // "undefined: meow" / "undefined: purr"（严格模式下 this=undefined）
```

### 5.3 事件循环 + 错误处理

```javascript
// 陷阱：Promise 中的错误 vs async 中的错误
// 1. Promise 中的同步错误
new Promise((resolve) => {
  throw new Error("sync error in Promise"); // 被 Promise 捕获
}).catch((e) => console.log("Caught:", e.message));
// Caught: sync error in Promise

// 2. async 函数中的错误
async function risky() {
  throw new Error("error in async");
}
risky().catch((e) => console.log("Caught:", e.message));
// Caught: error in async

// 3. 未 await 的 async 错误（静默失败！）
async function silentError() {
  throw new Error("this will be unhandled");
}
silentError(); // 不会抛出！返回 rejected Promise
// → UnhandledPromiseRejection

// 4. try/catch 不能捕获 Promise 错误
try {
  Promise.reject(new Error("promise reject"));
} catch (e) {
  console.log("caught"); // 不会执行！
}

// 5. 正确的错误处理模式
async function safeAsync() {
  try {
    const result = await riskyOperation();
    return result;
  } catch (error) {
    // 只捕获 await 的错误
    console.error("Handled:", error.message);
    return null;
  }
}

// 6. Promise.all vs Promise.allSettled
const promises = [
  Promise.resolve(1),
  Promise.reject(new Error("fail")),
  Promise.resolve(3),
];

// Promise.all: 一个失败全部失败
try {
  await Promise.all(promises); // 抛出 "fail"
} catch (e) {
  console.log("all failed:", e.message);
}

// Promise.allSettled: 等待所有完成
const results = await Promise.allSettled(promises);
console.log(results);
// [
//   { status: 'fulfilled', value: 1 },
//   { status: 'rejected', reason: Error: fail },
//   { status: 'fulfilled', value: 3 }
// ]
```

---

## 六、第五轮总结：核心收获

### 跨主题综合

| 主题组合        | 应用场景        | 关键模式                |
| --------------- | --------------- | ----------------------- |
| 闭包 + WeakMap  | 私有状态管理    | 工厂函数 + 外部存储     |
| 闭包 + 原型链   | 装饰器/代理模式 | 方法拦截 + 状态隔离     |
| 原型链 + Proxy  | 响应式系统      | 属性拦截 + 依赖追踪     |
| 异步 + 事件循环 | 调度器/批处理   | microtask 批量 + 优先级 |
| 异步 + 闭包     | 状态机/计数器   | 持久化状态 + 异步更新   |

### 底层机制要点

1. **V8 闭包裁剪**：闭包捕获整个 EnvironmentRecord，不是单个变量
2. **原型链深度限制**：>100 层时 Inline Cache 失效，查找性能暴跌
3. **microtask 优先级**：同一轮事件循环中，microtask 永远先于 macrotask
4. **Node.js 事件循环**：timer → pending → idle → poll → check → close
5. **await 本质**：await 后的代码被包装为 `.then()` 回调，进入 microtask

### 实战模式库

- ✅ 工厂函数 + WeakMap 实现真正的私有状态
- ✅ Symbol.species 控制派生类实例化行为
- ✅ Object.create(null) 创建零污染的纯字典
- ✅ 异步管道 / 并发池 / 指数退避重试
- ✅ 响应式系统：Proxy + 依赖收集 + microtask 批量更新
- ✅ 优先级调度器：immediate / normal / low 三级队列

---

**第五轮完成度：** ✅ 完整闭环  
**累计迭代：** 4/25 → 4/27 → 4/28 → 4/29 → 4/30（5 轮）  
**JavaScript 深度领域状态：** 🟢 完全掌握

---

_2026-04-30 01:00 | JavaScript.info 第 5-7 章深度专项_
