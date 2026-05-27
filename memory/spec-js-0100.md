# 📖 专项训练 01:00 — JavaScript 深度

**日期：** 2026-05-10  
**主题：** 闭包 / 原型 / 异步 / 事件循环  
**覆盖章节：** JavaScript.info 第 4-5-6-8-9 章（对象、原型、错误、异步、事件循环）

---

## 一、核心概念速查

### 1. 闭包 (Closure)

- 函数 + 其词法环境的引用
- 内部函数可以访问外部函数的变量，即使外部函数已返回
- 经典陷阱：循环中创建函数时变量共享

```js
// 闭包正确用法
function createCounter() {
  let count = 0;
  return {
    increment: () => ++count,
    getCount: () => count,
  };
}

const c = createCounter();
c.increment(); // 1
c.increment(); // 2
c.getCount(); // 2
// count 被闭包保护，外部无法直接访问
```

### 2. 原型链 (Prototype Chain)

- 每个对象都有 `[[Prototype]]`（通过 `__proto__` 或 `Object.getPrototypeOf` 访问）
- 属性查找沿原型链向上，直到 `null`
- `constructor.prototype` 决定 `new` 出来的对象的 `__proto__`

```js
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  console.log(`${this.name} makes a sound`);
};

const dog = new Animal("Dog");
// dog.__proto__ === Animal.prototype
// Animal.prototype.__proto__ === Object.prototype
// Object.prototype.__proto__ === null
```

### 3. 异步与事件循环

- 调用栈 → 任务队列（macrotask）→ 微任务队列（microtask）
- 微任务优先级高于宏任务：`Promise.then` / `queueMicrotask` / `MutationObserver`
- 宏任务：`setTimeout` / `setInterval` / `setImmediate` / I/O

```js
console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve().then(() => console.log("3"));
console.log("4");
// 输出: 1 → 4 → 3 → 2
// 同步 → 微任务 → 宏任务
```

---

## 二、深度题目

### 题目 1：闭包陷阱（★★★）

```js
// 问题：以下代码输出什么？如何修复？
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}

// 修复方案 A：let 替代 var
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}

// 修复方案 B：闭包捕获
for (var i = 0; i < 3; i++) {
  ((j) => {
    setTimeout(() => console.log(j), 100);
  })(i);
}

// 修复方案 C：setTimeout 第三个参数
for (var i = 0; i < 3; i++) {
  setTimeout((n) => console.log(n), 100, i);
}
```

**答案：** 原始代码输出 `3 3 3`（var 无块级作用域，setTimeout 回调执行时 i 已是 3）

---

### 题目 2：原型链查找（★★★）

```js
function A() {
  this.a = 1;
}
A.prototype.b = 2;

function B() {
  this.c = 3;
}
B.prototype = new A();
B.prototype.d = 4;

const obj = new B();

// 问题：
// 1. obj.a, obj.b, obj.c, obj.d 分别是？
// 2. obj.__proto__ 指向谁？
// 3. obj.__proto__.__proto__ 指向谁？
// 4. 'a' in obj 和 obj.hasOwnProperty('a') 分别返回什么？
// 5. 如果 B.prototype = Object.create(A.prototype) 代替 new A()，区别是什么？
```

**答案：**

1. `1, 2, 3, 4` — 全部可访问
2. `B.prototype`（即 `new A()` 实例）
3. `A.prototype`
4. `'a' in obj` → `true`（原型链上有），`obj.hasOwnProperty('a')` → `true`（自身属性）
5. `Object.create` 不执行 A 的构造函数，不会在 B.prototype 上创建 `this.a` 实例属性，更干净

---

### 题目 3：事件循环排序（★★★★）

```js
console.log("sync-1");

setTimeout(() => console.log("timeout-1"), 0);

Promise.resolve()
  .then(() => {
    console.log("promise-1");
    return Promise.resolve("promise-2");
  })
  .then((val) => console.log(val));

Promise.resolve().then(() => console.log("promise-3"));

queueMicrotask(() => console.log("microtask-1"));

console.log("sync-2");
```

**输出顺序：**

```
sync-1
sync-2
microtask-1
promise-1
promise-3
promise-2
timeout-1
```

**解析：**

1. 同步代码先执行：`sync-1`, `sync-2`
2. 微任务队列（按入队顺序）：`microtask-1` → `promise-1` → `promise-3`
3. `promise-1` 的 `.then` 返回新 Promise，其 `.then`（输出 `promise-2`）加入微任务队列末尾
4. 宏任务最后：`timeout-1`

---

### 题目 4：实现一个防抖 + 闭包（★★★★）

```js
// 实现 debounce，要求：
// 1. 支持 leading/trailing 选项
// 2. 支持取消方法
// 3. 支持 flush 立即执行
// 4. 正确传递 this 和 arguments

function debounce(fn, wait, options = {}) {
  let timerId = null;
  let lastArgs = null;
  let lastThis = null;
  let result;
  let leadingCalled = false;

  const { leading = false, trailing = true } = options;

  function invoke() {
    result = fn.apply(lastThis, lastArgs);
    lastArgs = lastThis = null;
    return result;
  }

  function debounced(...args) {
    lastThis = this;
    lastArgs = args;

    if (timerId === null) {
      // 首次调用
      if (leading) {
        leadingCalled = true;
        return invoke();
      }
    } else {
      clearTimeout(timerId);
    }

    timerId = setTimeout(() => {
      timerId = null;
      if (trailing && lastArgs) {
        invoke();
      }
    }, wait);

    return result;
  }

  debounced.cancel = () => {
    clearTimeout(timerId);
    timerId = null;
    lastArgs = lastThis = null;
    leadingCalled = false;
  };

  debounced.flush = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
      if (lastArgs) return invoke();
    }
    return result;
  };

  return debounced;
}

// 测试
const log = debounce(console.log, 1000, { leading: true, trailing: true });
log("a"); // 立即输出 'a'（leading）
log("b"); // 1s 后输出 'b'（trailing）
log("c"); // 1s 后输出 'c'（trailing）
```

---

### 题目 5：async/await 与事件循环（★★★★★）

```js
async function async1() {
  console.log("async1 start");
  await async2();
  console.log("async1 end");
}

async function async2() {
  console.log("async2");
}

console.log("script start");

setTimeout(() => console.log("setTimeout"), 0);

async1();

new Promise((resolve) => {
  console.log("promise1");
  resolve();
}).then(() => console.log("promise2"));

console.log("script end");
```

**输出顺序：**

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

**解析：**

- `async1()` 中 `await async2()` 会先执行 `async2()`（同步），然后 `await` 后面的代码变成微任务
- `new Promise` 的 executor 是同步执行的
- `async1 end` 在 `promise2` 之前是因为 V8 对 `await` 的微任务调度优化

> ⚠️ 注意：不同 Node.js / 浏览器版本可能有细微差异。Node 10+ 和现代浏览器中 `async1 end` 在 `promise2` 之前。

---

### 题目 6：原型继承实现（★★★★★）

```js
// 实现一个完整的继承体系：
// 1. 类式继承（ES5 风格）
// 2. ES6 class 继承
// 3. 验证 instanceof / isPrototypeOf / Object.prototype.isPrototypeOf

// ES5 寄生组合继承（最佳实践）
function inheritES5(Child, Parent) {
  const F = function () {};
  F.prototype = Parent.prototype;
  Child.prototype = new F();
  Child.prototype.constructor = Child;
  Child.__super__ = Parent.prototype;
}

function Person(name) {
  this.name = name;
}
Person.prototype.greet = function () {
  return `Hi, I'm ${this.name}`;
};

function Student(name, grade) {
  Person.call(this, name); // 调用父类构造函数
  this.grade = grade;
}
inheritES5(Student, Person);

Student.prototype.study = function () {
  return `${this.name} is studying in grade ${this.grade}`;
};

// ES6 class 等价实现
class Person6 {
  constructor(name) {
    this.name = name;
  }
  greet() {
    return `Hi, I'm ${this.name}`;
  }
}

class Student6 extends Person6 {
  constructor(name, grade) {
    super(name); // 调用父类构造函数
    this.grade = grade;
  }
  study() {
    return `${this.name} is studying in grade ${this.grade}`;
  }
}

// 验证
const s = new Student("Alice", 5);
console.log(s.greet()); // "Hi, I'm Alice"（继承自 Person）
console.log(s.study()); // "Alice is studying in grade 5"
console.log(s instanceof Student); // true
console.log(s instanceof Person); // true
console.log(s instanceof Object); // true
```

---

## 三、常见面试题速答

| 问题                                    | 答案                                                             |
| --------------------------------------- | ---------------------------------------------------------------- |
| `this` 绑定规则？                       | 默认绑定 → 隐式绑定 → 显式绑定(new/apply/call/bind) → 箭头函数   |
| 箭头函数的 this？                       | 词法绑定，继承外层作用域的 this，无法被 call/apply/bind 改变     |
| `null` vs `undefined`？                 | `undefined` = 未赋值，`null` = 有意为空                          |
| `==` vs `===`？                         | `==` 类型转换后比较，`===` 严格比较（推荐）                      |
| 事件冒泡 vs 捕获？                      | 捕获（外→内）→ 目标 → 冒泡（内→外），`addEventListener` 默认冒泡 |
| `Promise.all` vs `Promise.allSettled`？ | `all` 一个失败全失败，`allSettled` 等全部完成                    |
| `Generator` 是什么？                    | 可暂停/恢复的函数，用 `yield` 产出值，`next()` 驱动              |
| 内存泄漏常见原因？                      | 未清理定时器/事件监听、闭包持有大对象、全局变量污染              |

---

## 四、今日总结

**重点回顾：**

1. **闭包** = 函数 + 词法环境，是 JS 最核心的模式之一（模块化、防抖节流、私有变量都靠它）
2. **原型链** = JS 继承的底层机制，`__proto__` 指向构造函数的 `prototype`
3. **事件循环** = 同步 → 微任务 → 宏任务，`await` 后面的代码是微任务
4. **async/await** 本质是 Generator + Promise 的语法糖

**易错点：**

- `var` 在循环中创建闭包 → 用 `let` 或 IIFE
- `new` 操作符会执行构造函数并创建新对象 → 原型继承时用 `Object.create` 避免副作用
- `await` 不是阻塞整个线程，只是暂停当前 async 函数，其余代码继续执行
