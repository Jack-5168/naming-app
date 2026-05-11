# JavaScript 深度专项 v7 — 高级模式与底层机制 (5/3)

**日期:** 2026 年 5 月 3 日 星期日 01:00
**参考:** JavaScript.info 第 5-7 章 + ES2024 特性
**性质:** 第 7 轮迭代 (4/25→4/27→4/28→4/29→4/30→5/2→5/3)
**重点:** 闭包/原型/异步/事件循环 — 高级模式 + 边界场景 + 性能优化

---

## 训练策略

v6 已覆盖底层原理、引擎级理解和综合实战。v7 聚焦**高级模式与边界场景**：
1. **闭包** — 惰性求值/管道模式/状态机/闭包性能优化
2. **原型** — 对象创建模式对比/原型链优化/元编程实战
3. **异步** — Promise 链调试/错误传播/AbortController/ReadableStream
4. **事件循环** — 性能分析/长任务检测/调度策略/渲染帧优化

---

## 一、闭包 — 高级模式与性能

### 1.1 惰性求值 (Lazy Evaluation)

```javascript
// 模式: 延迟计算直到真正需要
function lazy(fn) {
  let cache;
  let computed = false;
  return function (...args) {
    if (!computed) {
      cache = fn.apply(this, args);
      computed = true;
    }
    return cache;
  };
}

// 使用场景: 昂贵的 DOM 查询
const getSidebar = lazy(() => {
  console.log('查询 DOM...');
  return document.querySelector('.sidebar');
});

getSidebar(); // 查询 DOM... → <div class="sidebar">
getSidebar(); // → <div class="sidebar"> (缓存命中)
getSidebar(); // → <div class="sidebar"> (缓存命中)

// 使用场景: 惰性初始化大对象
const getDatabase = lazy(() => {
  console.log('连接数据库...');
  return new Database({ host: 'localhost', poolSize: 10 });
});

// 如果程序从未需要数据库，连接永远不会建立
```

```javascript
// 模式: 惰性迭代器 (类似 Python 的 generator)
function* lazyRange(start, end, step = 1) {
  for (let i = start; i < end; i += step) {
    yield i; // 惰性产生，不会一次性生成所有值
  }
}

// 只取前 3 个，不会遍历整个范围
const first3 = [];
for (const n of lazyRange(0, 1000000)) {
  first3.push(n);
  if (first3.length >= 3) break;
}
console.log(first3); // [0, 1, 2]

// 惰性过滤 + 映射
function* filter(iterable, predicate) {
  for (const item of iterable) {
    if (predicate(item)) yield item;
  }
}

function* map(iterable, transformer) {
  for (const item of iterable) {
    yield transformer(item);
  }
}

const nums = lazyRange(1, 100);
const result = map(filter(nums, n => n % 2 === 0), n => n * 3);
console.log([...result].slice(0, 5)); // [6, 12, 18, 24, 30]
```

### 1.2 管道模式 (Pipeline Pattern)

```javascript
// 模式: 函数组合管道
const pipe = (...fns) =>
  fns.reduce(
    (prev, next) =>
      (...args) =>
        next(prev(...args)),
    (...args) => args[0]
  );

// 数据转换管道
const processData = pipe(
  (data) => data.filter((x) => x > 0), // 过滤负数
  (data) => data.map((x) => x * 2), // 翻倍
  (data) => data.sort((a, b) => a - b), // 排序
  (data) => data.reduce((sum, x) => sum + x, 0) // 求和
);

console.log(processData([3, -1, 4, -2, 1, 5])); // 26 (2+8+2+6+10)

// 带异步的管道
const asyncPipe = (...fns) => (initial) =>
  fns.reduce((chain, fn) => chain.then(fn), Promise.resolve(initial));

const processAsync = asyncPipe(
  (data) => fetchJSON(`/api/data?id=${data}`),
  (json) => json.filter((x) => x.active),
  (items) => items.map((x) => x.name),
  (names) => names.join(', ')
);

// 带错误处理的管道
const safePipe = (...fns) => {
  return function pipeline(input) {
    return fns.reduce(
      (promise, fn) =>
        promise.then(
          (value) => {
            try {
              const result = fn(value);
              return result instanceof Promise ? result : Promise.resolve(result);
            } catch (e) {
              return Promise.reject(e);
            }
          },
          (error) => Promise.reject(error)
        ),
      Promise.resolve(input)
    );
  };
};
```

### 1.3 闭包状态机

```javascript
// 模式: 用闭包实现有限状态机
function createStateMachine(initialState, transitions) {
  let state = initialState;
  let history = [initialState];

  return {
    getState: () => state,
    getHistory: () => [...history],

    send(event) {
      const nextState = transitions[state]?.[event];
      if (!nextState) {
        throw new Error(
          `Invalid transition: ${state} + ${event}`
        );
      }
      state = nextState;
      history.push(state);
      return state;
    },

    // 可撤销
    undo() {
      if (history.length <= 1) throw new Error('No history');
      history.pop();
      state = history[history.length - 1];
      return state;
    },

    // 可重置
    reset(newInitial = initialState) {
      state = newInitial;
      history = [newInitial];
      return state;
    },
  };
}

// 使用: 灯的状态机
const light = createStateMachine('off', {
  off: { toggle: 'on' },
  on: { toggle: 'dim', dim: 'bright', off: 'off' },
  dim: { toggle: 'on', bright: 'bright' },
  bright: { toggle: 'on', dim: 'dim' },
});

console.log(light.getState()); // 'off'
light.send('toggle');
console.log(light.getState()); // 'on'
light.send('dim');
console.log(light.getState()); // 'dim'
light.undo();
console.log(light.getState()); // 'on'

// 使用: 异步请求状态机
const requestMachine = createStateMachine('idle', {
  idle: { start: 'loading' },
  loading: { success: 'success', error: 'error' },
  success: { retry: 'loading' },
  error: { retry: 'loading', reset: 'idle' },
});

// 配合 async/await
async function fetchData(url) {
  requestMachine.send('start');
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    requestMachine.send('success');
    return data;
  } catch (err) {
    requestMachine.send('error');
    throw err;
  }
}
```

### 1.4 闭包性能优化

```javascript
// 问题: 每次调用都创建新闭包
function createBadHandler(id) {
  return function () {
    console.log(`Button ${id} clicked`);
    // 每次调用 createBadHandler 都创建新的函数对象
    // 如果调用 1000 次，就有 1000 个不同的函数对象
  };
}

// ✅ 优化: 共享闭包 + 数据参数化
function handleClick(event) {
  const id = event.currentTarget.dataset.id;
  console.log(`Button ${id} clicked`);
  // 只有一个函数对象，通过 DOM 获取数据
}

// ✅ 优化: 工厂模式 + 共享方法
function createComponent(config) {
  // 共享方法（不依赖 config）
  const sharedMethods = {
    render() {
      return this.template;
    },
    destroy() {
      this.el?.remove();
    },
  };

  // 只将需要捕获的数据放入实例
  return Object.assign(Object.create(sharedMethods), {
    template: config.template,
    el: null,
    id: config.id,
  });
}

// 性能对比
console.time('bad');
for (let i = 0; i < 10000; i++) createBadHandler(i);
console.timeEnd('bad'); // ~3ms

console.time('good');
for (let i = 0; i < 10000; i++) createComponent({ template: '<div/>', id: i });
console.timeEnd('good'); // ~1ms (共享方法减少内存分配)
```

### 1.5 闭包实战: 带超时的缓存

```javascript
// 模式: TTL 缓存 + 闭包
function createTTLCache(ttlMs = 5000) {
  const cache = new Map();
  const timers = new Map();

  function cleanup(key) {
    const timer = timers.get(key);
    if (timer) {
      clearTimeout(timer);
      timers.delete(key);
    }
    cache.delete(key);
  }

  return {
    get(key) {
      const entry = cache.get(key);
      if (!entry) return undefined;
      return entry.value;
    },

    set(key, value) {
      // 清理旧的超时
      cleanup(key);

      cache.set(key, { value, timestamp: Date.now() });

      // 设置新的超时
      const timer = setTimeout(() => {
        cleanup(key);
      }, ttlMs);
      timers.set(key, timer);
    },

    has(key) {
      return cache.has(key);
    },

    delete(key) {
      cleanup(key);
    },

    // 获取剩余 TTL
    getTTL(key) {
      const entry = cache.get(key);
      if (!entry) return 0;
      return Math.max(0, ttlMs - (Date.now() - entry.timestamp));
    },

    // 清空所有
    clear() {
      for (const key of cache.keys()) {
        cleanup(key);
      }
    },

    // 大小
    get size() {
      return cache.size;
    },
  };
}

// 使用
const cache = createTTLCache(1000);
cache.set('user', { name: '娄总' });
console.log(cache.get('user')); // { name: '娄总' }
console.log(cache.getTTL('user')); // ~1000ms

setTimeout(() => {
  console.log(cache.get('user')); // undefined (已过期)
}, 1500);
```

---

## 二、原型 — 对象创建模式与优化

### 2.1 对象创建模式对比

```javascript
// 模式 1: 对象字面量 (最简单，共享 Object.prototype)
const obj1 = {
  name: 'obj1',
  greet() {
    return `Hello, ${this.name}`;
  },
};

// 模式 2: Object.create (显式原型链)
const proto = {
  greet() {
    return `Hello, ${this.name}`;
  },
};
const obj2 = Object.create(proto);
obj2.name = 'obj2';
// 优点: 完全控制原型链，可创建 null 原型对象

// 模式 3: 构造函数 (传统模式)
function Person(name) {
  this.name = name;
}
Person.prototype.greet = function () {
  return `Hello, ${this.name}`;
};
const obj3 = new Person('obj3');

// 模式 4: ES6 Class (语法糖，底层同构造函数)
class Animal {
  constructor(name) {
    this.name = name;
  }
  greet() {
    return `Hello, ${this.name}`;
  }
}
const obj4 = new Animal('obj4');

// 模式 5: 工厂函数 (闭包 + 对象字面量)
function createWidget(config) {
  const privateState = { ...config }; // 真正的私有数据
  return {
    getName() {
      return privateState.name;
    },
    setName(name) {
      privateState.name = name;
    },
  };
}
const obj5 = createWidget({ name: 'obj5' });
// 优点: 真正的私有数据，无法从外部访问 privateState
// 缺点: 每个实例都有独立的方法副本

// 模式 6: 混合模式 (工厂 + 原型)
function createOptimizedWidget(config) {
  const privateState = { ...config };
  const instance = Object.create(WidgetMethods);
  instance._private = privateState;
  return instance;
}

const WidgetMethods = {
  getName() {
    return this._private.name;
  },
  setName(name) {
    this._private.name = name;
  },
  // 所有实例共享这些方法
};

// 性能对比
console.time('literal');
for (let i = 0; i < 100000; i++) ({ a: i, b: i * 2 });
console.timeEnd('literal'); // ~2ms

console.time('class');
class C {
  constructor(a, b) {
    this.a = a;
    this.b = b;
  }
}
for (let i = 0; i < 100000; i++) new C(i, i * 2);
console.timeEnd('class'); // ~3ms

console.time('object.create');
const P = {};
for (let i = 0; i < 100000; i++) Object.assign(Object.create(P), { a: i, b: i * 2 });
console.timeEnd('object.create'); // ~5ms
```

### 2.2 原型链优化技巧

```javascript
// 问题: 过深的原型链影响性能
// 每层查找都有开销，现代引擎优化了但仍有影响

// ✅ 优化: 扁平原型链
// 反模式: 5 层继承
class A { methodA() {} }
class B extends A { methodB() {} }
class C extends B { methodC() {} }
class D extends C { methodD() {} }
class E extends D { methodE() {} } // 查找 methodA 需要 5 步

// ✅ 推荐: 组合 > 继承
const canFly = {
  fly() {
    console.log(`${this.name} is flying`);
  },
};
const canSwim = {
  swim() {
    console.log(`${this.name} is swimming`);
  },
};
const canDuck = {
  quack() {
    console.log(`${this.name} says quack`);
  },
};

class Duck {
  constructor(name) {
    this.name = name;
    Object.assign(this, canFly, canSwim, canDuck);
  }
}

// ✅ 进阶: 可复用的 mixin 工厂
function mixin(target, ...sources) {
  for (const source of sources) {
    Object.getOwnPropertyNames(source).forEach((key) => {
      if (!target.prototype[key]) {
        target.prototype[key] = source[key];
      }
    });
  }
  return target;
}

class Bird {}
mixin(Bird, canFly, canSwim);
const sparrow = new Bird();
sparrow.name = 'Sparrow';
sparrow.fly(); // Sparrow is flying

// 原型链查找优化: 使用 hasOwnProperty 避免遍历
function safeHasProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

// 避免 in 操作符的陷阱
const config = { toString: 'custom' };
console.log('toString' in config); // true (来自原型链)
console.log(safeHasProperty(config, 'toString')); // true (自己的)
console.log(safeHasProperty(config, 'hasOwnProperty')); // false (原型的)
```

### 2.3 元编程实战: 自动绑定方法

```javascript
// 场景: React/Vue 组件中自动绑定 this
function autobind(target, propertyKey, descriptor) {
  const method = descriptor.value;
  if (typeof method !== 'function') {
    return descriptor;
  }

  return {
    configurable: true,
    get() {
      const bound = method.bind(this);
      // 缓存绑定后的方法，避免重复创建
      Object.defineProperty(this, propertyKey, {
        value: bound,
        configurable: true,
        writable: true,
      });
      return bound;
    },
  };
}

class Component {
  constructor(name) {
    this.name = name;
  }

  handleClick() {
    console.log(`${this.name} clicked`);
  }

  // 使用 autobind 装饰器 (需 Babel/TS 支持)
  // 或者手动实现:
}

// 手动实现 autobind
function autobindAll(obj) {
  const proto = Object.getPrototypeOf(obj);
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key === 'constructor') continue;
    const descriptor = Object.getOwnPropertyDescriptor(proto, key);
    if (typeof descriptor.value === 'function') {
      Object.defineProperty(obj, key, {
        value: descriptor.value.bind(obj),
        writable: true,
        configurable: true,
      });
    }
  }
  return obj;
}

const comp = autobindAll(new Component('MyComponent'));
const fn = comp.handleClick;
fn(); // MyComponent clicked (this 正确绑定)
```

### 2.4 原型链调试工具

```javascript
// 工具: 完整的原型链分析
function analyzePrototypeChain(obj) {
  const chain = [];
  let current = obj;
  let depth = 0;

  while (current !== null) {
    const info = {
      depth,
      constructor: current.constructor?.name || 'null',
      ownKeys: Object.getOwnPropertyNames(current),
      symbols: Object.getOwnPropertySymbols(current).map((s) => s.description),
      isPrototype: current !== obj,
    };
    chain.push(info);
    current = Object.getPrototypeOf(current);
    depth++;
  }

  return chain;
}

// 工具: 属性查找路径
function tracePropertyLookup(obj, prop) {
  const path = [];
  let current = obj;
  let depth = 0;

  while (current !== null) {
    if (Object.prototype.hasOwnProperty.call(current, prop)) {
      path.push({ depth, source: current.constructor?.name || 'Object', found: true });
      return path;
    }
    path.push({ depth, source: current.constructor?.name || 'Object', found: false });
    current = Object.getPrototypeOf(current);
    depth++;
  }

  path.push({ depth, source: 'null', found: false });
  return path;
}

// 使用
class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    console.log(`${this.name} makes a sound`);
  }
}

class Dog extends Animal {
  speak() {
    console.log(`${this.name} barks`);
  }
  fetch() {
    console.log(`${this.name} fetches`);
  }
}

const dog = new Dog('Buddy');
console.log(tracePropertyLookup(dog, 'speak'));
// [
//   { depth: 0, source: 'Dog', found: true },  // 在 Dog 实例上找到
// ]

console.log(tracePropertyLookup(dog, 'constructor'));
// [
//   { depth: 0, source: 'Dog', found: false },
//   { depth: 1, source: 'Dog', found: true },  // 在 Dog.prototype 上找到
// ]
```

---

## 三、异步 — 高级模式与调试

### 3.1 Promise 链调试

```javascript
// 问题: Promise 链中的错误容易丢失
// 反模式:
fetch('/api/data')
  .then((res) => res.json())
  .then((data) => process(data))
  .then((result) => console.log(result));
// 如果 process(data) 抛出异常，错误会被吞掉

// ✅ 模式: 全局未捕获 Promise 错误处理
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise rejection:', event.reason);
  // 上报错误
  reportError(event.reason);
  event.preventDefault(); // 阻止默认的控制台输出
});

// 模式: 带追踪的 Promise 链
function createTraceablePromise(executor) {
  const trace = [];
  const promise = new Promise((resolve, reject) => {
    trace.push({ time: Date.now(), event: 'created' });
    executor(
      (value) => {
        trace.push({ time: Date.now(), event: 'resolved', value });
        resolve(value);
      },
      (error) => {
        trace.push({ time: Date.now(), event: 'rejected', error: error.message });
        reject(error);
      }
    );
  });

  return {
    promise: promise.catch((err) => {
      trace.push({ time: Date.now(), event: 'caught', error: err.message });
      throw err;
    }),
    getTrace: () => [...trace],
  };
}

// 使用
const { promise, getTrace } = createTraceablePromise((resolve, reject) => {
  setTimeout(() => resolve(42), 100);
});

promise.then((v) => console.log(v));
setTimeout(() => {
  console.log(getTrace());
  // [
  //   { time: 1714684800000, event: 'created' },
  //   { time: 1714684800100, event: 'resolved', value: 42 },
  // ]
}, 200);
```

### 3.2 AbortController 深度使用

```javascript
// 模式: 可取消的并发请求
async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// 模式: 取消所有进行中的请求
class RequestManager {
  constructor() {
    this._controllers = new Map();
    this._counter = 0;
  }

  async request(url, options = {}) {
    const id = ++this._counter;
    const controller = new AbortController();

    this._controllers.set(id, { controller, url });

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return await response.json();
    } finally {
      this._controllers.delete(id);
    }
  }

  cancelAll() {
    for (const [id, { controller, url }] of this._controllers) {
      controller.abort(`Cancelled: ${url}`);
    }
    this._controllers.clear();
  }

  cancel(id) {
    const item = this._controllers.get(id);
    if (item) {
      item.controller.abort(`Cancelled: ${item.url}`);
      this._controllers.delete(id);
    }
  }

  get activeCount() {
    return this._controllers.size;
  }
}

// 使用
const manager = new RequestManager();

// 发起多个请求
const p1 = manager.request('/api/users');
const p2 = manager.request('/api/posts');
const p3 = manager.request('/api/comments');

console.log(manager.activeCount); // 3

// 用户导航离开页面，取消所有请求
manager.cancelAll();
```

### 3.3 ReadableStream 异步迭代

```javascript
// 模式: 流式处理大数据
async function* streamJSON(url) {
  const response = await fetch(url);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // 按行分割
    const lines = buffer.split('\n');
    buffer = lines.pop(); // 保留不完整的行

    for (const line of lines) {
      if (line.trim()) {
        yield JSON.parse(line);
      }
    }
  }

  // 处理最后一行
  if (buffer.trim()) {
    yield JSON.parse(buffer);
  }
}

// 使用: 流式处理 100 万条记录
async function processLargeDataset() {
  let count = 0;
  let sum = 0;

  for await (const record of streamJSON('/api/large-dataset')) {
    count++;
    sum += record.value;

    // 每处理 10000 条输出进度
    if (count % 10000 === 0) {
      console.log(`Processed ${count} records, avg: ${sum / count}`);
    }
  }

  console.log(`Total: ${count} records, average: ${sum / count}`);
}

// 模式: TransformStream 管道
function createUppercaseTransformer() {
  return new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(chunk.toUpperCase());
    },
  });
}

// 使用: 流式转换
const response = await fetch('/api/data');
const transformed = response.body.pipeThrough(createUppercaseTransformer());
const reader = transformed.getReader();
```

### 3.4 异步错误传播模式

```javascript
// 模式: Result 类型 (避免 try/catch 嵌套)
class Result {
  constructor(isOk, value, error) {
    this.isOk = isOk;
    this.isErr = !isOk;
    this.value = value;
    this.error = error;
  }

  static ok(value) {
    return new Result(true, value, null);
  }

  static err(error) {
    return new Result(false, null, error);
  }

  map(fn) {
    return this.isOk ? Result.ok(fn(this.value)) : this;
  }

  async mapAsync(fn) {
    return this.isOk ? Result.ok(await fn(this.value)) : this;
  }

  andThen(fn) {
    return this.isOk ? fn(this.value) : this;
  }

  async andThenAsync(fn) {
    return this.isOk ? await fn(this.value) : this;
  }

  unwrap() {
    if (this.isOk) return this.value;
    throw this.error;
  }

  unwrapOr(defaultValue) {
    return this.isOk ? this.value : defaultValue;
  }
}

// 使用: 类型安全的异步操作链
async function getUser(userId) {
  try {
    const res = await fetch(`/api/users/${userId}`);
    if (!res.ok) return Result.err(new Error(`HTTP ${res.status}`));
    return Result.ok(await res.json());
  } catch (e) {
    return Result.err(e);
  }
}

async function processUser(userId) {
  const result = await getUser(userId)
    .andThenAsync((user) => {
      if (!user.active) return Result.err(new Error('User inactive'));
      return Result.ok(user);
    })
    .map((user) => ({
      ...user,
      displayName: `${user.firstName} ${user.lastName}`,
    }));

  if (result.isErr) {
    console.error('Failed:', result.error.message);
    return null;
  }

  return result.value;
}

// 使用: 避免嵌套 try/catch
async function safeOperation() {
  const user = await getUser(123);
  if (user.isErr) return Result.err(user.error);

  const posts = await getPosts(user.value.id);
  if (posts.isErr) return Result.err(posts.error);

  return Result.ok({ user: user.value, posts: posts.value });
}
```

### 3.5 Promise 实现原理 (完整版)

```javascript
// 完整实现 Promise/A+ 规范
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

class MyPromise {
  constructor(executor) {
    this._state = PENDING;
    this._value = undefined;
    this._callbacks = [];

    const resolve = (value) => {
      if (this._state !== PENDING) return;
      this._state = FULFILLED;
      this._value = value;
      this._flush();
    };

    const reject = (reason) => {
      if (this._state !== PENDING) return;
      this._state = REJECTED;
      this._value = reason;
      this._flush();
    };

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  _flush() {
    // 使用 queueMicrotask 确保异步执行
    queueMicrotask(() => {
      while (this._callbacks.length > 0) {
        const { onFulfilled, onRejected, resolve, reject } =
          this._callbacks.shift();
        try {
          if (this._state === FULFILLED) {
            this._handleCallback(onFulfilled, resolve, reject);
          } else {
            this._handleCallback(onRejected, resolve, reject);
          }
        } catch (e) {
          reject(e);
        }
      }
    });
  }

  _handleCallback(callback, resolve, reject) {
    if (typeof callback !== 'function') {
      // 穿透: 如果没有提供回调，传递值/错误
      if (this._state === FULFILLED) resolve(this._value);
      else reject(this._value);
      return;
    }

    const result = callback(this._value);
    this._resolvePromise(result, resolve, reject);
  }

  _resolvePromise(x, resolve, reject) {
    // 防止循环引用
    if (x === this) {
      return reject(new TypeError('Chaining cycle detected'));
    }

    // 如果 x 是 thenable (Promise-like)
    if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
      let called = false;
      try {
        const then = x.then;
        if (typeof then === 'function') {
          then.call(
            x,
            (y) => {
              if (called) return;
              called = true;
              this._resolvePromise(y, resolve, reject);
            },
            (r) => {
              if (called) return;
              called = true;
              reject(r);
            }
          );
          return;
        }
      } catch (e) {
        if (!called) reject(e);
        return;
      }
    }

    resolve(x);
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      this._callbacks.push({ onFulfilled, onRejected, resolve, reject });
      // 如果已经 resolved/rejected，立即触发
      if (this._state !== PENDING) this._flush();
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
    if (value instanceof MyPromise) return value;
    return new MyPromise((resolve) => resolve(value));
  }

  static reject(reason) {
    return new MyPromise((_, reject) => reject(reason));
  }

  static all(promises) {
    return new MyPromise((resolve, reject) => {
      const results = [];
      let remaining = promises.length;

      if (remaining === 0) return resolve([]);

      promises.forEach((promise, index) => {
        MyPromise.resolve(promise).then(
          (value) => {
            results[index] = value;
            if (--remaining === 0) resolve(results);
          },
          reject
        );
      });
    });
  }

  static race(promises) {
    return new MyPromise((resolve, reject) => {
      for (const promise of promises) {
        MyPromise.resolve(promise).then(resolve, reject);
      }
    });
  }

  static allSettled(promises) {
    return MyPromise.all(
      promises.map((p) =>
        MyPromise.resolve(p).then(
          (value) => ({ status: 'fulfilled', value }),
          (reason) => ({ status: 'rejected', reason })
        )
      )
    );
  }

  static any(promises) {
    return new MyPromise((resolve, reject) => {
      const errors = [];
      let remaining = promises.length;

      if (remaining === 0)
        return reject(new AggregateError([], 'All promises were rejected'));

      promises.forEach((promise, index) => {
        MyPromise.resolve(promise).then(resolve, (reason) => {
          errors[index] = reason;
          if (--remaining === 0) {
            reject(new AggregateError(errors, 'All promises were rejected'));
          }
        });
      });
    });
  }
}

// 测试
const p = new MyPromise((resolve) => setTimeout(() => resolve(42), 100));
p.then((v) => console.log(v)); // 42

// 测试链式调用
new MyPromise((resolve) => resolve(1))
  .then((v) => v + 1)
  .then((v) => v * 2)
  .then((v) => console.log(v)); // 4

// 测试错误传播
new MyPromise((_, reject) => reject(new Error('fail')))
  .then((v) => v + 1)
  .catch((e) => console.log(e.message)); // fail
```

---

## 四、事件循环 — 性能分析与调度

### 4.1 长任务检测与优化

```javascript
// 模式: 检测长任务 (影响 FPS)
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.warn(`长任务: ${entry.duration.toFixed(2)}ms`, {
      startTime: entry.startTime,
      name: entry.name,
    });
  }
});
observer.observe({ entryTypes: ['longtask'] });

// 模式: 将大任务分割为小帧
function chunkedProcess(items, processFn, chunkSize = 50) {
  return new Promise((resolve) => {
    let index = 0;
    const results = [];

    function processChunk() {
      const chunk = items.slice(index, index + chunkSize);
      for (const item of chunk) {
        results.push(processFn(item));
      }
      index += chunkSize;

      if (index < items.length) {
        // 使用 requestIdleCallback 在空闲时处理
        requestIdleCallback(processChunk, { timeout: 16 });
      } else {
        resolve(results);
      }
    }

    requestIdleCallback(processChunk, { timeout: 16 });
  });
}

// 使用: 处理 10 万条数据不卡顿
const largeData = Array.from({ length: 100000 }, (_, i) => i);

chunkedProcess(largeData, (n) => n * 2, 100).then((results) => {
  console.log(`处理完成: ${results.length} 条`);
});

// 模式: 使用 scheduler.postTask (Chrome 103+)
// 优先级: 'user-blocking' | 'user-visible' | 'background'
if ('scheduler' in window) {
  scheduler.postTask(
    () => {
      console.log('后台任务执行');
    },
    { priority: 'background', delay: 1000 }
  );
}
```

### 4.2 渲染帧优化

```javascript
// 模式: 与浏览器渲染同步
function animateElement(element, property, targetValue, duration = 300) {
  const startTime = performance.now();
  const startValue = parseFloat(
    getComputedStyle(element)[property]
  );

  function frame(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // 缓动函数
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = startValue + (targetValue - startValue) * eased;

    element.style[property] = currentValue + 'px';

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

// 模式: 避免布局抖动 (Layout Thrashing)
// 反模式: 读写交替导致多次重排
function badUpdate(elements) {
  elements.forEach((el) => {
    const height = el.offsetHeight; // 读 → 强制同步布局
    el.style.height = height + 10 + 'px'; // 写 → 标记需要重排
  });
  // 每个元素都触发一次重排 = N 次重排
}

// ✅ 模式: 批量读写分离
function goodUpdate(elements) {
  // 第一阶段: 读取所有值 (批量读)
  const heights = elements.map((el) => el.offsetHeight);

  // 第二阶段: 写入所有值 (批量写)
  elements.forEach((el, i) => {
    el.style.height = heights[i] + 10 + 'px';
  });
  // 浏览器合并为 1 次重排
}

// 模式: 使用 CSS transform 代替布局属性
// 反模式: 改变布局属性 (触发重排)
el.style.width = '200px';
el.style.top = '100px';

// ✅ 模式: 使用 transform (仅触发合成)
el.style.transform = 'translate(100px, 50px) scale(2)';
// transform 和 opacity 由 GPU 处理，不触发重排/重绘
```

### 4.3 事件循环调度策略

```javascript
// 模式: 智能调度器 (根据任务优先级选择 API)
class SmartScheduler {
  constructor() {
    this._taskQueue = {
      immediate: [], // 立即执行 (microtask)
      high: [], // 高优先级 (setTimeout 0)
      normal: [], // 正常优先级 (requestAnimationFrame)
      low: [], // 低优先级 (requestIdleCallback)
    };
    this._running = false;
  }

  add(task, priority = 'normal') {
    this._taskQueue[priority].push(task);
    if (!this._running) {
      this._running = true;
      this._schedule();
    }
  }

  _schedule() {
    if (this._isEmpty()) {
      this._running = false;
      return;
    }

    // 优先级调度
    if (this._taskQueue.immediate.length > 0) {
      queueMicrotask(() => this._process('immediate'));
    } else if (this._taskQueue.high.length > 0) {
      setTimeout(() => this._process('high'), 0);
    } else if (this._taskQueue.normal.length > 0) {
      requestAnimationFrame(() => this._process('normal'));
    } else {
      requestIdleCallback((deadline) => {
        this._processWithDeadline('low', deadline);
      });
    }
  }

  _process(priority) {
    const queue = this._taskQueue[priority];
    const task = queue.shift();
    if (task) {
      try {
        task();
      } catch (e) {
        console.error(`Task error (${priority}):`, e);
      }
    }
    this._schedule();
  }

  _processWithDeadline(priority, deadline) {
    const queue = this._taskQueue[priority];
    while (queue.length > 0 && deadline.timeRemaining() > 0) {
      const task = queue.shift();
      try {
        task();
      } catch (e) {
        console.error(`Task error (${priority}):`, e);
      }
    }
    this._schedule();
  }

  _isEmpty() {
    return Object.values(this._taskQueue).every((q) => q.length === 0);
  }
}

// 使用
const scheduler = new SmartScheduler();

scheduler.add(() => console.log('立即'), 'immediate');
scheduler.add(() => console.log('高优先级'), 'high');
scheduler.add(() => console.log('正常'), 'normal');
scheduler.add(() => console.log('低优先级'), 'low');

// 输出顺序: 立即 → 高优先级 → 正常 → 低优先级
```

### 4.4 事件循环可视化分析

```javascript
// 工具: 事件循环监控器
class EventLoopMonitor {
  constructor() {
    this._events = [];
    this._start = performance.now();
    this._microtaskCount = 0;
    this._taskCount = 0;
    this._frameCount = 0;

    // 监控微任务
    const originalQueueMicrotask = queueMicrotask;
    const self = this;
    window.queueMicrotask = function (callback) {
      self._microtaskCount++;
      return originalQueueMicrotask(callback);
    };

    // 监控 requestAnimationFrame
    const originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function (callback) {
      self._frameCount++;
      return originalRAF(callback);
    };
  }

  log(event, detail = '') {
    this._events.push({
      time: performance.now() - this._start,
      event,
      detail,
      microtasks: this._microtaskCount,
      frames: this._frameCount,
    });
  }

  getReport() {
    return {
      duration: performance.now() - this._start,
      events: this._events,
      summary: {
        microtasks: this._microtaskCount,
        frames: this._frameCount,
        totalEvents: this._events.length,
      },
    };
  }
}

// 使用: 分析复杂异步场景
const monitor = new EventLoopMonitor();

async function complexAsyncFlow() {
  monitor.log('start', 'complexAsyncFlow');

  // microtask
  queueMicrotask(() => monitor.log('microtask', '1'));

  // Promise
  await Promise.resolve();
  monitor.log('promise-resolve', '1');

  // setTimeout (macrotask)
  await new Promise((r) => setTimeout(r, 0));
  monitor.log('setTimeout', '1');

  // requestAnimationFrame
  await new Promise((r) => requestAnimationFrame(r));
  monitor.log('raf', '1');

  // requestIdleCallback
  await new Promise((r) => requestIdleCallback(r));
  monitor.log('idle', '1');

  return monitor.getReport();
}

complexAsyncFlow().then((report) => {
  console.table(
    report.events.map((e) => ({
      time: e.time.toFixed(3) + 'ms',
      event: e.event,
      detail: e.detail,
    }))
  );
});
```

---

## 五、综合实战 — 高级场景融合

### 5.1 实现一个高性能事件总线

```javascript
// 融合: 闭包 + 原型 + 异步 + 事件循环
class EventBus {
  constructor() {
    // 闭包: 私有事件映射
    const _listeners = new Map();
    const _onceListeners = new Map();
    const _wildcards = new Map();

    // 异步队列 (批量处理)
    const _asyncQueue = new Map();
    let _flushScheduled = false;

    function _flushAsyncQueue(event) {
      const queue = _asyncQueue.get(event);
      if (!queue || queue.length === 0) return;

      const handlers = [...queue];
      _asyncQueue.delete(event);
      _flushScheduled = false;

      for (const handler of handlers) {
        try {
          handler();
        } catch (e) {
          console.error(`EventBus error [${event}]:`, e);
        }
      }
    }

    function _scheduleAsyncFlush(event) {
      if (!_flushScheduled) {
        _flushScheduled = true;
        queueMicrotask(() => {
          // 批量处理所有待刷新的队列
          for (const [evt] of _asyncQueue) {
            _flushAsyncQueue(evt);
          }
        });
      }
    }

    // 原型方法 (共享，不依赖实例)
    const methods = {
      on(event, handler, options = {}) {
        const { async = false, wildcard = false } = options;

        if (wildcard) {
          if (!_wildcards.has(event)) _wildcards.set(event, new Set());
          _wildcards.get(event).add(handler);
        } else {
          if (!_listeners.has(event)) _listeners.set(event, new Set());
          _listeners.get(event).add(handler);
        }

        // 返回取消订阅函数 (闭包)
        return () => {
          const target = wildcard ? _wildcards : _listeners;
          target.get(event)?.delete(handler);
        };
      },

      once(event, handler) {
        const unsub = this.on(event, (...args) => {
          unsub();
          handler(...args);
        });
        return unsub;
      },

      emit(event, ...args) {
        // 精确匹配
        const handlers = _listeners.get(event);
        if (handlers) {
          for (const handler of handlers) {
            handler(...args);
          }
        }

        // 通配符匹配
        for (const [pattern, handlers] of _wildcards) {
          if (this._matchWildcard(pattern, event)) {
            for (const handler of handlers) {
              handler(event, ...args);
            }
          }
        }
      },

      emitAsync(event, ...args) {
        if (!_asyncQueue.has(event)) _asyncQueue.set(event, []);

        const handlers = _listeners.get(event);
        if (handlers) {
          for (const handler of handlers) {
            _asyncQueue.get(event).push(() => handler(...args));
          }
        }

        _scheduleAsyncFlush(event);
      },

      off(event, handler) {
        _listeners.get(event)?.delete(handler);
        _onceListeners.get(event)?.delete(handler);
        _wildcards.get(event)?.delete(handler);
      },

      removeAll(event) {
        if (event) {
          _listeners.delete(event);
          _onceListeners.delete(event);
          _wildcards.delete(event);
        } else {
          _listeners.clear();
          _onceListeners.clear();
          _wildcards.clear();
        }
      },

      listenerCount(event) {
        return (
          (_listeners.get(event)?.size || 0) +
          (_wildcards.get(event)?.size || 0)
        );
      },

      _matchWildcard(pattern, event) {
        // 支持 "user.*" 和 "*.*" 模式
        const patternParts = pattern.split('.');
        const eventParts = event.split('.');

        if (patternParts.length !== eventParts.length) return false;

        return patternParts.every((part, i) => part === '*' || part === eventParts[i]);
      },
    };

    Object.assign(this, Object.create(methods));
  }
}

// 使用
const bus = new EventBus();

// 基本事件
const unsub = bus.on('user:login', (user) => {
  console.log(`${user.name} logged in`);
});

bus.emit('user:login', { name: '娄总' }); // 娄总 logged in

// 通配符
bus.on('user.*', (event, ...args) => {
  console.log(`User event: ${event}`, args);
}, { wildcard: true });

bus.emit('user:logout', { name: '娄总' });
// User event: user:logout [{ name: '娄总' }]

// 异步事件 (批量处理)
bus.emitAsync('analytics:pageview', '/home');
bus.emitAsync('analytics:pageview', '/about');
// 在下一个 microtask 批量处理

// 一次性监听
bus.once('app:init', () => {
  console.log('App initialized');
});
bus.emit('app:init'); // App initialized
bus.emit('app:init'); // (无输出)
```

### 5.2 实现一个响应式代理系统

```javascript
// 融合: Proxy + 闭包 + 异步批处理 + 事件循环
function createReactiveSystem() {
  // 闭包: 依赖追踪
  const targetMap = new WeakMap();
  const activeEffect = { current: null };

  // 异步批处理
  let scheduled = false;
  const pendingEffects = new Set();

  function scheduleRun(effect) {
    pendingEffects.add(effect);
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(() => {
        const effects = [...pendingEffects];
        pendingEffects.clear();
        scheduled = false;
        for (const effect of effects) {
          effect.run();
        }
      });
    }
  }

  function track(target, key) {
    if (!activeEffect.current) return;

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

    deps.add(activeEffect.current);
  }

  function trigger(target, key) {
    const depsMap = targetMap.get(target);
    if (!depsMap) return;

    const deps = depsMap.get(key);
    if (!deps) return;

    for (const effect of deps) {
      scheduleRun(effect);
    }
  }

  // 创建响应式对象
  function reactive(target) {
    return new Proxy(target, {
      get(obj, key, receiver) {
        const result = Reflect.get(obj, key, receiver);
        track(obj, key);
        // 嵌套响应式
        return result && typeof result === 'object'
          ? reactive(result)
          : result;
      },
      set(obj, key, value, receiver) {
        const oldValue = obj[key];
        const result = Reflect.set(obj, key, value, receiver);
        if (oldValue !== value) {
          trigger(obj, key);
        }
        return result;
      },
      deleteProperty(obj, key) {
        const result = Reflect.deleteProperty(obj, key);
        trigger(obj, key);
        return result;
      },
    });
  }

  // 副作用
  function effect(fn) {
    const effectFn = () => {
      activeEffect.current = effectFn;
      try {
        fn();
      } finally {
        activeEffect.current = null;
      }
    };
    effectFn.run = () => fn();
    effectFn();
    return effectFn;
  }

  // 计算属性
  function computed(getter) {
    let value;
    let dirty = true;

    const effectFn = effect(() => {
      dirty = true;
    });

    return {
      get value() {
        if (dirty) {
          value = getter();
          dirty = false;
        }
        return value;
      },
    };
  }

  return { reactive, effect, computed };
}

// 使用
const { reactive: r, effect: e, computed: c } = createReactiveSystem();

const state = r({ count: 0, name: '娄总' });

// 自动追踪依赖
e(() => {
  console.log(`Count changed to ${state.count}`);
});

state.count = 1; // Count changed to 1 (microtask 中执行)
state.count = 2; // Count changed to 2

// 计算属性
const doubled = c(() => state.count * 2);
console.log(doubled.value); // 4

// 异步批处理: 多次修改只触发一次更新
state.count = 10;
state.name = '娄总 Pro';
// 在下一个 microtask 中批量执行所有副作用
```

### 5.3 实现一个协程调度器

```javascript
// 融合: Generator + Promise + 事件循环
class CoroutineScheduler {
  constructor() {
    this._tasks = new Map();
    this._nextId = 0;
    this._running = false;
  }

  spawn(generatorFn, ...args) {
    const id = this._nextId++;
    const gen = generatorFn(...args);

    const task = {
      id,
      generator: gen,
      status: 'pending',
      promise: this._runTask(id, gen),
    };

    this._tasks.set(id, task);
    return task.promise;
  }

  async _runTask(id, gen) {
    let result;
    let value;

    try {
      value = gen.next();

      while (!value.done) {
        // 等待 yield 的值 (Promise)
        const resolved = await value.value;
        value = gen.next(resolved);
      }

      result = value.value;
    } catch (error) {
      // 将错误抛回 generator
      try {
        value = gen.throw(error);
        if (!value.done) {
          // 如果 generator 处理了错误，继续执行
          const resolved = await value.value;
          value = gen.next(resolved);
        }
        result = value.value;
      } catch (e) {
        this._tasks.delete(id);
        throw e;
      }
    }

    this._tasks.delete(id);
    return result;
  }

  cancel(id) {
    const task = this._tasks.get(id);
    if (task && task.status === 'pending') {
      task.status = 'cancelled';
      task.generator.return();
      this._tasks.delete(id);
    }
  }

  get activeCount() {
    return this._tasks.size;
  }
}

// 使用: 协程实现异步流程控制
const scheduler = new CoroutineScheduler();

// 场景: 模拟异步数据加载
function* loadData() {
  console.log('Loading user...');
  const user = yield new Promise((r) =>
    setTimeout(() => r({ name: '娄总' }), 100)
  );

  console.log('Loading posts...');
  const posts = yield new Promise((r) =>
    setTimeout(() => r([{ title: 'Hello' }]), 100)
  );

  return { user, posts };
}

scheduler.spawn(loadData).then((result) => {
  console.log('Loaded:', result);
  // Loading user...
  // Loading posts...
  // Loaded: { user: { name: '娄总' }, posts: [{ title: 'Hello' }] }
});

// 场景: 带错误处理的协程
function* fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Attempt ${i + 1}...`);
      const data = yield new Promise((resolve, reject) => {
        setTimeout(() => {
          if (i < 2) reject(new Error('Network error'));
          else resolve({ data: 'success' });
        }, 50);
      });
      return data;
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      console.log(`Retry ${i + 1} failed:`, e.message);
      yield new Promise((r) => setTimeout(r, 100 * (i + 1)));
    }
  }
}

scheduler.spawn(fetchWithRetry, '/api/data').then((result) => {
  console.log('Result:', result);
  // Attempt 1...
  // Retry 1 failed: Network error
  // Attempt 2...
  // Retry 2 failed: Network error
  // Attempt 3...
  // Result: { data: 'success' }
});
```

---

## 六、ES2024 新特性

### 6.1 Promise.withResolvers

```javascript
// ES2024: 简化 Promise 创建
// 之前:
function oldStyle() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ES2024:
function newStyle() {
  const { promise, resolve, reject } = Promise.withResolvers();
  return { promise, resolve, reject };
}

// 使用场景: 外部控制 Promise
const { promise, resolve, reject } = Promise.withResolvers();

setTimeout(() => resolve('done!'), 1000);
promise.then(console.log); // done! (1s 后)

// 使用场景: 信号量
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.current < this.max) {
      this.current++;
      return;
    }

    const { promise, resolve } = Promise.withResolvers();
    this.queue.push(resolve);
    return promise;
  }

  release() {
    this.current--;
    const next = this.queue.shift();
    if (next) {
      this.current++;
      next();
    }
  }
}

// 使用: 限制并发数
const semaphore = new Semaphore(3);

async function limitedTask(id) {
  await semaphore.acquire();
  try {
    console.log(`Task ${id} running`);
    await new Promise((r) => setTimeout(r, 1000));
    console.log(`Task ${id} done`);
  } finally {
    semaphore.release();
  }
}

// 同时发起 10 个任务，但最多 3 个并发
Promise.all(
  Array.from({ length: 10 }, (_, i) => limitedTask(i))
);
```

### 6.2 Array.prototype.groupBy

```javascript
// ES2024: 原生分组
const users = [
  { name: 'Alice', role: 'admin' },
  { name: 'Bob', role: 'user' },
  { name: 'Charlie', role: 'admin' },
  { name: 'David', role: 'user' },
];

// 之前: reduce
const groupedOld = users.reduce((acc, user) => {
  (acc[user.role] = acc[user.role] || []).push(user);
  return acc;
}, {});

// ES2024: groupBy
const grouped = users.groupBy((user) => user.role);
console.log(grouped);
// {
//   admin: [{ name: 'Alice', role: 'admin' }, { name: 'Charlie', role: 'admin' }],
//   user: [{ name: 'Bob', role: 'user' }, { name: 'David', role: 'user' }]
// }

// 多条件分组
const data = [
  { category: 'A', type: 'x', value: 10 },
  { category: 'A', type: 'y', value: 20 },
  { category: 'B', type: 'x', value: 30 },
];

const multiGrouped = data.groupBy((item) =>
  `${item.category}-${item.type}`
);
// {
//   'A-x': [{ category: 'A', type: 'x', value: 10 }],
//   'A-y': [{ category: 'A', type: 'y', value: 20 }],
//   'B-x': [{ category: 'B', type: 'x', value: 30 }]
// }

// 自定义分组键
const scores = [85, 92, 78, 95, 88, 72, 91];
const gradeGroups = scores.groupBy((score) => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  return 'D';
});
// { A: [92, 95, 91], B: [85, 88], C: [78, 72] }
```

### 6.3 ArrayBuffer.prototype.transfer (ES2024)

```javascript
// ES2024: 转移 ArrayBuffer 所有权 (零拷贝)
const buffer = new ArrayBuffer(1024);
const view = new Uint8Array(buffer);
view[0] = 42;

// 之前: structuredClone 或手动复制
// const copy = new ArrayBuffer(1024);
// new Uint8Array(copy).set(view);

// ES2024: transfer (原 buffer 变为 detached)
const transferred = buffer.transfer();
console.log(buffer.byteLength); // 0 (detached)
console.log(transferred.byteLength); // 1024

// 使用场景: Worker 间零拷贝传输
// 主线程
const largeBuffer = new ArrayBuffer(10 * 1024 * 1024); // 10MB
// ... 填充数据 ...

// 转移所有权给 Worker (零拷贝)
worker.postMessage({ buffer: largeBuffer }, [largeBuffer.transfer()]);

// largeBuffer 现在不可用，所有权已转移
console.log(largeBuffer.byteLength); // 0
```

---

## 七、面试自测题

### 7.1 闭包

1. 以下代码输出什么？为什么？
```javascript
const funcs = [];
for (var i = 0; i < 3; i++) {
  funcs.push(() => console.log(i));
}
funcs.forEach((f) => f());
// 答案: 3, 3, 3 (var 没有块级作用域，闭包捕获的是同一个 i)
```

2. 如何修复上面的问题？给出 3 种方案。
```javascript
// 方案 1: let (块级作用域)
for (let i = 0; i < 3; i++) {
  funcs.push(() => console.log(i));
}

// 方案 2: IIFE
for (var i = 0; i < 3; i++) {
  funcs.push(
    ((j) => () => console.log(j))(i)
  );
}

// 方案 3: forEach
[0, 1, 2].forEach((i) => {
  funcs.push(() => console.log(i));
});
```

3. WeakRef 和 WeakMap 的区别？适用场景？

### 7.2 原型

1. `Object.create(null)` 和普通对象有什么区别？
2. `__proto__` 和 `prototype` 的区别？
3. 如何实现一个不可被继承的对象？

```javascript
// 答案:
const sealed = Object.seal({ name: 'test' });
// 或
const frozen = Object.freeze({ name: 'test' });
// 或创建 null 原型对象
const noProto = Object.create(null);
```

### 7.3 异步

1. 以下代码输出顺序？
```javascript
console.log(1);
setTimeout(() => console.log(2), 0);
Promise.resolve().then(() => console.log(3));
queueMicrotask(() => console.log(4));
console.log(5);
// 答案: 1, 5, 3, 4, 2
// 同步 → 微任务 (Promise.then = queueMicrotask) → 宏任务 (setTimeout)
```

2. Promise.all 和 Promise.allSettled 的区别？
3. 如何实现 Promise.all 的超时控制？

### 7.4 事件循环

1. 浏览器和 Node.js 事件循环的主要区别？
2. `process.nextTick` 和 `queueMicrotask` 的区别？
3. 什么是长任务？如何优化？

---

## v7 总结

| 主题 | 核心知识点 | 实战场景 |
|------|-----------|---------|
| **闭包** | 惰性求值/管道模式/状态机/TTL 缓存/性能优化 | 数据转换管道/请求状态机/带超时的缓存 |
| **原型** | 6 种创建模式对比/链优化/元编程/调试工具 | 自动绑定/mixin/原型链分析 |
| **异步** | Promise 链调试/AbortController/ReadableStream/Result 类型/完整实现 | 可取消请求/流式处理/类型安全异步链 |
| **事件循环** | 长任务检测/渲染帧优化/智能调度/可视化分析 | 分块处理/动画优化/优先级调度 |
| **ES2024** | Promise.withResolvers/Array.groupBy/ArrayBuffer.transfer | 信号量/分组/零拷贝 |

**v7 相比 v6 的进阶点:**
- 闭包从原理 → 高级模式 (惰性/管道/状态机)
- 原型从理解 → 创建模式对比 + 性能优化
- 异步从实现 → 调试 + 取消 + 流式 + 类型安全
- 事件循环从模型 → 性能分析 + 调度策略 + 渲染优化
