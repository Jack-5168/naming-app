# JavaScript 深度专项 — 复习巩固 (4/28)

**日期:** 2026 年 4 月 28 日 星期二 01:00  
**参考:** JavaScript.info 第 5-7 章  
**性质:** 复习巩固 (4/27 完整体系回顾 + 查漏补缺)  
**原始文件:** `training/javascript-deep-dive-0100.md` (~45KB, 1,694 行)

---

## 复习策略

4/27 已完成的原始训练覆盖四大主题:
1. **闭包** — LexicalEnvironment / 五大模式 / 三大陷阱 / Event Bus 实战
2. **原型** — 原型链 / new 机制 / 继承 / Symbol & 迭代器 / Mixin
3. **异步** — Promise 状态机 / 五大组合器 / 并发控制 / 错误处理 / 异步迭代器
4. **事件循环** — 运行时模型 / 宏任务 vs 微任务 / Node.js 差异 / 优先级调度

本次复习聚焦: **核心概念速查 + 易错点强化 + 面试高频题自测**

---

## 一、闭包 — 核心速查

### 本质
```
闭包 = 函数 + 创建时的词法环境引用 [[Environment]]
```

### 五大模式 (能默写吗?)
| 模式 | 用途 | 关键代码 |
|------|------|----------|
| 工厂函数+私有状态 | 封装 | `function factory() { let priv; return { access: () => priv } }` |
| 模块模式 | 命名空间 | `(function() { let priv; return { public } })()` |
| 柯里化 | 参数复用 | `const curry = fn => a => b => fn(a, b)` |
| 记忆化 | 缓存结果 | `const memo = fn => { const cache = {}; return arg => cache[arg] ??= fn(arg) }` |
| 防抖/节流 | 频率控制 | `debounce(fn, ms)` / `throttle(fn, ms)` |

### 三大陷阱 (面试必问)
1. **循环变量共享** — `for(var i=0;i<3;i++) setTimeout(()=>console.log(i),0)` → 输出 3,3,3 (用 let 解决)
2. **内存泄漏** — 闭包持有大对象引用不释放 → 手动 null 或 WeakMap
3. **this 丢失** — 回调函数中 this 指向 window → 箭头函数或 .bind(this)

### 自测题
```javascript
// Q1: 输出什么?
function makeAdder(x) {
  return function(y) { return x + y; };
}
const add5 = makeAdder(5);
console.log(add5(3)); // ?

// Q2: 输出什么?
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// ?

// Q3: 实现 once 函数
function once(fn) { /* ??? */ }
const logOnce = once(console.log);
logOnce("hello"); // hello
logOnce("world"); // (无输出)
```

<details>
<summary>答案</summary>

Q1: 8 (闭包捕获 x=5)
Q2: 3, 3, 3 (var 函数作用域, 循环结束时 i=3)
Q3: 
```javascript
function once(fn) {
  let called = false;
  return function(...args) {
    if (!called) { called = true; return fn.apply(this, args); }
  };
}
```
</details>

---

## 二、原型 — 核心速查

### 原型链查找规则
```
obj.prop → obj.__proto__.prop → obj.__proto__.__proto__.prop → ... → null
```

### new 操作符四步
1. 创建空对象 `Object.create(Constructor.prototype)`
2. 绑定 this → 新对象
3. 执行构造函数
4. 返回新对象 (除非构造函数返回对象)

### ES5 vs ES6 继承对比
```javascript
// ES5 原型链继承
function Animal(name) { this.name = name; }
Animal.prototype.speak = function() { console.log(this.name); };
function Dog(name) { Animal.call(this, name); }
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;

// ES6 Class
class Animal {
  constructor(name) { this.name = name; }
  speak() { console.log(this.name); }
}
class Dog extends Animal {
  constructor(name) { super(name); }
}
```

### 关键 API
| API | 用途 |
|-----|------|
| `Object.create(proto)` | 以 proto 为原型创建对象 |
| `Object.setPrototypeOf(obj, proto)` | 设置原型 (性能差, 不推荐) |
| `Object.getPrototypeOf(obj)` | 获取原型 |
| `obj.isPrototypeOf(target)` | target 的原型链是否包含 obj |
| `obj.hasOwnProperty(key)` | 自身属性 (不含原型链) |
| `key in obj` | 自身 + 原型链 |

### 自测题
```javascript
// Q1: 输出什么?
function A() {}
A.prototype.x = 1;
const a = new A();
console.log(a.x);       // ?
delete a.x;
console.log(a.x);       // ?
a.x = 2;
console.log(a.x);       // ?
console.log(A.prototype.x); // ?

// Q2: 实现 Object.create 的 polyfill
function myCreate(proto) { /* ??? */ }
```

<details>
<summary>答案</summary>

Q1: 1 (原型链查找) → 1 (a.x 不存在, 原型链查找) → 2 (自身属性) → 1 (原型未变)
Q2:
```javascript
function myCreate(proto) {
  function F() {}
  F.prototype = proto;
  return new F();
}
```
</details>

---

## 三、异步编程 — 核心速查

### Promise 状态机
```
Pending → Fulfilled (resolve) / Rejected (reject)
状态一旦改变不可逆
```

### 五大组合器
| 方法 | 行为 | 失败策略 |
|------|------|----------|
| `Promise.all` | 全部成功才成功 | 一个失败立即 reject |
| `Promise.allSettled` | 等全部完成 | 不失败, 返回结果数组 |
| `Promise.race` | 第一个完成的 | 第一个 settle 就返回 |
| `Promise.any` | 第一个成功的 | 忽略失败, 全部失败才 reject |
| `Promise.resolve/reject` | 快速创建 | — |

### 并发控制 (AsyncPool)
```javascript
async function asyncPool(concurrency, items, fn) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}
```

### 错误处理四策略
1. **重试** — 指数退避 (fixed → exponential → adaptive)
2. **超时** — `Promise.race([promise, timeout(ms)])`
3. **降级** — catch 返回默认值
4. **批量收集** — `allSettled` 收集所有结果

### 自测题
```javascript
// Q1: 输出顺序?
async function main() {
  console.log(1);
  await Promise.resolve();
  console.log(2);
  setTimeout(() => console.log(3), 0);
  console.log(4);
}
main();
// ?

// Q2: 实现带超时的 fetch
async function fetchWithTimeout(url, timeout) { /* ??? */ }

// Q3: 实现 retry 函数
async function retry(fn, maxRetries, delay) { /* ??? */ }
```

<details>
<summary>答案</summary>

Q1: 1 → 2 → 4 → 3 (await 是微任务, setTimeout 是宏任务)
Q2:
```javascript
async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}
```
Q3:
```javascript
async function retry(fn, maxRetries, delay = 1000) {
  for (let i = 0; i <= maxRetries; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === maxRetries) throw e;
      await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
    }
  }
}
```
</details>

---

## 四、事件循环 — 核心速查

### 运行时模型
```
┌─────────────────────────────────────────┐
│              Call Stack                  │
│  (同步代码执行, 函数调用入栈/出栈)         │
└─────────────────────────────────────────┘
         ↓ 遇到异步操作
┌─────────────────────────────────────────┐
│         Web APIs / Node APIs             │
│  (setTimeout, fetch, DOM 事件, I/O)      │
└─────────────────────────────────────────┘
         ↓ 完成回调
┌─────────────────────────────────────────┐
│  Microtask Queue (微任务)                 │
│  Promise.then / queueMicrotask /        │
│  MutationObserver / process.nextTick    │
│  ⚠️ 每个宏任务后清空全部微任务              │
└─────────────────────────────────────────┘
         ↓ 微任务清空后
┌─────────────────────────────────────────┐
│  Macrotask Queue (宏任务)                 │
│  setTimeout / setInterval / I/O /       │
│  UI rendering / requestAnimationFrame   │
└─────────────────────────────────────────┘
         ↑ 事件循环持续检查
```

### 宏任务 vs 微任务
| 特性 | 宏任务 | 微任务 |
|------|--------|--------|
| 来源 | setTimeout/setInterval/I/O/UI | Promise.then/queueMicrotask/MutationObserver |
| 执行时机 | 每轮事件循环取一个 | 当前宏任务执行完后清空全部 |
| 优先级 | 低 | 高 |
| Node.js | 同浏览器 | nextTick > Promise.then |

### 经典面试题
```javascript
// 题1: 输出顺序?
console.log('sync1');
setTimeout(() => console.log('timeout'), 0);
Promise.resolve().then(() => console.log('promise'));
console.log('sync2');
// sync1 → sync2 → promise → timeout

// 题2: async/await 微任务调度?
async function a() {
  console.log('a1');
  await Promise.resolve();
  console.log('a2');
}
a();
Promise.resolve().then(() => console.log('p1'));
console.log('sync');
// a1 → sync → a2 → p1 (await 后的代码在微任务队列, p1 也在微任务队列, 顺序取决于注册顺序)

// 题3: 混合宏微任务?
console.log(1);
setTimeout(() => console.log(2), 0);
new Promise(resolve => {
  console.log(3);
  resolve();
  console.log(4);
}).then(() => console.log(5));
console.log(6);
// 1 → 3 → 4 → 6 → 5 → 2
```

### Node.js vs 浏览器差异
- **Node.js**: nextTick > Promise.then > setImmediate > setTimeout (分阶段执行)
- **浏览器**: 统一微任务队列, 无 nextTick/setImmediate

### 自测题
```javascript
// Q: 输出顺序? (经典混合题)
async function async1() {
  console.log('async1 start');
  await async2();
  console.log('async1 end');
}
async function async2() {
  console.log('async2');
}
console.log('script start');
setTimeout(() => console.log('setTimeout'), 0);
async1();
new Promise(resolve => {
  console.log('promise1');
  resolve();
}).then(() => console.log('promise2'));
console.log('script end');
```

<details>
<summary>答案</summary>

```
script start
async1 start
async2
promise1
script end
async1 end
promise2
setTimeout
```

解析:
1. 同步: script start → async1 start → async2 → promise1 → script end
2. 微任务: async1 end (await 后) → promise2
3. 宏任务: setTimeout
</details>

---

## 五、跨主题综合题

### 综合题 1: 闭包 + 异步
```javascript
// 输出什么? 如何修复?
const tasks = [];
for (var i = 0; i < 3; i++) {
  tasks.push(() => setTimeout(() => console.log(i), 0));
}
tasks.forEach(t => t());
// 输出: 3, 3, 3
// 修复: 用 let / 立即执行函数 / bind
```

### 综合题 2: 原型 + this
```javascript
// 输出什么?
const obj = {
  name: 'obj',
  getName: function() { return this.name; }
};
const fn = obj.getName;
console.log(fn()); // ? (undefined, this 丢失)
console.log(obj.getName()); // ? ('obj')
```

### 综合题 3: 事件循环 + Promise 链
```javascript
// 输出顺序?
Promise.resolve()
  .then(() => console.log(1))
  .then(() => console.log(2));
setTimeout(() => console.log(3), 0);
Promise.resolve().then(() => {
  console.log(4);
  return Promise.resolve();
}).then(() => console.log(5));
// 1 → 2 → 4 → 5 → 3
```

---

## 六、知识体系完整性检查

### 闭包 ✅
- [x] LexicalEnvironment 机制
- [x] 五大模式 (工厂/模块/柯里化/记忆化/防抖节流)
- [x] 三大陷阱 (循环变量/内存泄漏/this 丢失)
- [x] 实战: Event Bus

### 原型 ✅
- [x] 原型链查找规则
- [x] new 操作符四步
- [x] ES5 vs ES6 继承
- [x] 关键 API (create/setPrototypeOf/isPrototypeOf/hasOwnProperty)
- [x] 实战: Mixin 模式
- [x] Symbol & 迭代器

### 异步 ✅
- [x] Promise 状态机
- [x] 五大组合器
- [x] 并发控制 (AsyncPool)
- [x] 错误处理 (重试/超时/降级/批量收集)
- [x] 异步迭代器

### 事件循环 ✅
- [x] 运行时模型全景
- [x] 宏任务 vs 微任务
- [x] 经典面试题
- [x] Node.js 差异
- [x] 实战: 优先级调度器

---

## 七、复习总结

### 本次复习覆盖
- 四大主题核心概念速查表
- 每个主题 3 道自测题 (共 12 题)
- 3 道跨主题综合题
- 知识体系完整性检查清单

### 与 4/27 原始训练的关系
| 维度 | 4/27 原始训练 | 4/28 复习巩固 |
|------|--------------|--------------|
| 代码示例 | 25+ 完整示例 | 12 道自测题 + 3 道综合题 |
| 深度 | 原理 + 模式 + 实战 | 速查 + 自测 + 查漏 |
| 用途 | 首次学习 | 巩固记忆 + 面试准备 |
| 文件 | ~45KB | ~15KB (精简版) |

### 建议
- 自测题全部答对 → 闭包/原型/异步/事件循环已牢固掌握 ✅
- 有答错的 → 回到 `javascript-deep-dive-0100.md` 对应章节复习
- 面试前重点看: 自测题 + 综合题 + 速查表
