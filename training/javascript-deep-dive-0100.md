# JavaScript 深度专项训练 — 闭包 / 原型 / 异步 / 事件循环

**日期:** 2026 年 4 月 27 日 星期一 01:00  
**参考:** JavaScript.info 第 5-7 章  
**重点:** Closures · Prototypes · Async · Event Loop

---

## 一、闭包 (Closures) — JavaScript.info Ch.5

### 1.1 闭包的核心定义

> **闭包 = 函数 + 词法环境的引用**

一个函数能够"记住"并访问它被创建时所在的词法作用域，即使该函数在其原始作用域之外执行。

```javascript
function createCounter() {
  let count = 0; // 词法环境中的变量
  return {
    increment: () => ++count,
    decrement: () => --count,
    getCount: () => count,
  };
}

const counter = createCounter();
counter.increment(); // 1
counter.increment(); // 2
counter.decrement(); // 1
counter.getCount();  // 1
// count 变量被闭包"捕获"，不会随 createCounter 返回而销毁
```

### 1.2 闭包的底层机制 — LexicalEnvironment 对象

每个函数执行时都有一个内部 `[[Environment]]` 属性，指向创建时的词法环境：

```
createCounter 执行时:
┌─────────────────────────────────┐
│ LexicalEnvironment              │
│  EnvironmentRecord: { count: 0 }│
│  outer: GlobalEnvironment        │
└─────────────────────────────────┘
         ↑ 被 increment/decrement/getCount 的 [[Environment]] 引用
```

```javascript
// 手动模拟闭包环境链
function outer() {
  let a = 1;
  function middle() {
    let b = 2;
    function inner() {
      let c = 3;
      console.log(a, b, c); // 1, 2, 3 — 向上查找三层环境
    }
    return inner;
  }
  return middle;
}
outer()()(); // 1, 2,3
```

### 1.3 闭包的经典模式

#### 模式 1: 工厂函数 + 私有状态

```javascript
// 私有状态 — 外部无法直接访问
function createBankAccount(initialBalance) {
  let balance = initialBalance;
  const transactions = [];

  return {
    deposit(amount) {
      if (amount <= 0) throw new Error('Amount must be positive');
      balance += amount;
      transactions.push({ type: 'deposit', amount, balance, time: Date.now() });
      return this; // 链式调用
    },
    withdraw(amount) {
      if (amount > balance) throw new Error('Insufficient funds');
      balance -= amount;
      transactions.push({ type: 'withdraw', amount, balance, time: Date.now() });
      return this;
    },
    getBalance() { return balance; },
    getTransactions() { return [...transactions]; }, // 返回副本
  };
}

const account = createBankAccount(1000);
account.deposit(500).withdraw(200);
account.getBalance(); // 1300
// balance 和 transactions 完全私有
```

#### 模式 2: 模块模式 (Module Pattern)

```javascript
const TodoModule = (function () {
  const todos = []; // 私有
  let idCounter = 0; // 私有

  function generateId() { return ++idCounter; } // 私有方法

  return {
    add(text) {
      const todo = { id: generateId(), text, completed: false, createdAt: new Date() };
      todos.push(todo);
      return todo;
    },
    complete(id) {
      const todo = todos.find(t => t.id === id);
      if (todo) todo.completed = true;
      return todo;
    },
    list(filter = 'all') {
      if (filter === 'completed') return todos.filter(t => t.completed);
      if (filter === 'active') return todos.filter(t => !t.completed);
      return [...todos];
    },
    count() { return todos.length; },
    clear() { todos.length = 0; },
  };
})();

TodoModule.add('Learn closures');
TodoModule.add('Master prototypes');
TodoModule.complete(1);
TodoModule.list('completed'); // [{ id: 1, text: 'Learn closures', completed: true }]
```

#### 模式 3: 柯里化 (Currying) — 闭包的应用

```javascript
// 通用 curry 实现
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function (...moreArgs) {
      return curried.apply(this, [...args, ...moreArgs]);
    };
  };
}

// 使用
const add = (a, b, c) => a + b + c;
const curriedAdd = curry(add);

curriedAdd(1)(2)(3);   // 6
curriedAdd(1, 2)(3);   // 6
curriedAdd(1)(2, 3);   // 6

// 实际场景: 配置化函数
const validate = curry((rules, value) =>
  rules.every(rule => rule(value))
);

const isEmail = validate([
  v => v.includes('@'),
  v => v.length > 5,
  v => /^[^@]+@[^@]+\.[^@]+$/.test(v),
]);

isEmail('test@example.com'); // true
isEmail('bad');              // false
```

#### 模式 4: 记忆化 (Memoization)

```javascript
function memoize(fn) {
  const cache = new Map(); // 闭包捕获

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

// 斐波那契 — 指数级 → 线性级
const fibonacci = memoize((n) => {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
});

console.time('fib(40)');
console.log(fibonacci(40)); // 102334155 — 瞬间完成
console.timeEnd('fib(40)'); // ~1ms (vs ~500ms 无 memoize)
```

#### 模式 5: 防抖/节流 — 闭包经典应用

```javascript
// 防抖 (Debounce) — 最后一次触发后执行
function debounce(fn, delay) {
  let timer = null; // 闭包状态
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 节流 (Throttle) — 固定间隔内只执行一次
function throttle(fn, interval) {
  let lastTime = 0; // 闭包状态
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

// 使用
const handleScroll = throttle(() => {
  console.log('Scroll position:', window.scrollY);
}, 100);

const searchInput = debounce((query) => {
  console.log('Searching:', query);
}, 300);
```

### 1.4 闭包的陷阱与最佳实践

#### 陷阱 1: 循环中的闭包 (经典面试题)

```javascript
// ❌ 错误: 所有函数共享同一个 i
const funcs = [];
for (var i = 0; i < 3; i++) {
  funcs.push(() => i);
}
funcs.map(f => f()); // [3, 3, 3] — 全是 3!

// ✅ 修复 1: let 块级作用域
const funcs2 = [];
for (let j = 0; j < 3; j++) {
  funcs2.push(() => j);
}
funcs2.map(f => f()); // [0, 1, 2]

// ✅ 修复 2: IIFE 捕获
const funcs3 = [];
for (var k = 0; k < 3; k++) {
  funcs3.push(((captured) => () => captured)(k));
}
funcs3.map(f => f()); // [0, 1, 2]
```

#### 陷阱 2: 内存泄漏

```javascript
// ❌ 闭包持有大对象引用导致内存泄漏
function processLargeData() {
  const largeArray = new Array(1000000).fill('data'); // 大数组
  const result = largeArray.map(item => item.toUpperCase());

  return function getResult() { // 闭包持有 largeArray 引用!
    return result; // 只需要 result, 但 largeArray 也被保留
  };
}

// ✅ 修复: 断开大对象引用
function processLargeDataFixed() {
  const largeArray = new Array(1000000).fill('data');
  const result = largeArray.map(item => item.toUpperCase());
  largeArray.length = 0; // 释放

  return function getResult() {
    return result;
  };
}
```

#### 陷阱 3: this 丢失

```javascript
const obj = {
  name: 'Alice',
  greet() {
    setTimeout(function () {
      console.log(this.name); // undefined — this 指向全局
    }, 100);
  },
};

// ✅ 修复 1: 箭头函数 (词法 this)
const obj2 = {
  name: 'Bob',
  greet() {
    setTimeout(() => {
      console.log(this.name); // 'Bob'
    }, 100);
  },
};

// ✅ 修复 2: 保存 this 引用
const obj3 = {
  name: 'Charlie',
  greet() {
    const self = this; // 闭包捕获
    setTimeout(function () {
      console.log(self.name); // 'Charlie'
    }, 100);
  },
};
```

### 1.5 闭包实战: 事件总线 (Event Bus)

```javascript
function createEventBus() {
  const listeners = new Map(); // 闭包私有
  const onceListeners = new Map();

  return {
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
      onceListeners.set(fn, wrapper);
      return this.on(event, wrapper);
    },

    off(event, fn) {
      const set = listeners.get(event);
      if (set) {
        const wrapper = onceListeners.get(fn);
        set.delete(wrapper || fn);
      }
    },

    emit(event, ...args) {
      const set = listeners.get(event);
      if (set) set.forEach(fn => fn(...args));
    },

    listenerCount(event) {
      return (listeners.get(event)?.size || 0);
    },
  };
}

// 使用
const bus = createEventBus();
const unsub = bus.on('user:login', (user) => console.log(`${user} logged in`));
bus.emit('user:login', 'Alice'); // 'Alice logged in'
unsub(); // 取消订阅
bus.emit('user:login', 'Bob');   // 无输出
```

---

## 二、原型 (Prototypes) — JavaScript.info Ch.6

### 2.1 原型链的本质

```
每个对象都有 [[Prototype]] 属性 (通过 __proto__ 或 Object.getPrototypeOf 访问)
查找属性时: 自身 → __proto__ → __proto__.__proto__ → ... → null
```

```javascript
// 原型链可视化
const obj = { name: 'test' };

// obj.__proto__ === Object.prototype
// Object.prototype.__proto__ === null

// 原型链: obj → Object.prototype → null
console.log(obj.toString()); // 在 Object.prototype 上找到
```

### 2.2 构造函数 + new 的原型链

```javascript
function Person(name, age) {
  this.name = name;
  this.age = age;
}

Person.prototype.greet = function () {
  return `Hi, I'm ${this.name}, ${this.age} years old`;
};

Person.prototype.walk = function () {
  return `${this.name} is walking`;
};

const alice = new Person('Alice', 30);

// new 做了什么:
// 1. 创建空对象 {}
// 2. 设置 [[Prototype]]: {}.__proto__ = Person.prototype
// 3. 执行 Person.call({}, 'Alice', 30) — 绑定 this
// 4. 返回 this (新对象)

// 原型链: alice → Person.prototype → Object.prototype → null
console.log(alice.greet()); // 'Hi, I'm Alice, 30 years old'
console.log(alice.__proto__ === Person.prototype); // true
console.log(Person.prototype.__proto__ === Object.prototype); // true

// 属性查找过程:
// alice.greet → 自身没有 → Person.prototype.greet ✅ 找到
// alice.toString → 自身没有 → Person.prototype 没有 → Object.prototype.toString ✅
// alice.nonexistent → 自身没有 → Person.prototype 没有 → Object.prototype 没有 → null ❌ undefined
```

### 2.3 原型链继承 (ES5 风格)

```javascript
// 基类
function Animal(name) {
  this.name = name;
  this.energy = 100;
}

Animal.prototype.eat = function (food) {
  this.energy += 20;
  return `${this.name} eats ${food} (+20 energy)`;
};

Animal.prototype.sleep = function () {
  this.energy += 50;
  return `${this.name} sleeps (+50 energy)`;
};

// 子类
function Dog(name, breed) {
  Animal.call(this, name); // 调用父类构造函数
  this.breed = breed;
  this.tricks = [];
}

// 设置原型链
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog; // 修复 constructor 指向

Dog.prototype.bark = function () {
  return `${this.name} says: Woof!`;
};

Dog.prototype.learnTrick = function (trick) {
  this.tricks.push(trick);
  this.energy -= 10;
  return `${this.name} learned: ${trick}`;
};

// 使用
const dog = new Dog('Rex', 'German Shepherd');
console.log(dog.bark());         // 'Rex says: Woof!'
console.log(dog.eat('bone'));    // 'Rex eats bone (+20 energy)'
console.log(dog.learnTrick('roll over')); // 'Rex learned: roll over'
console.log(dog.energy);         // 60 (100 - 10 learn + 20 eat - 50... wait)

// 原型链: dog → Dog.prototype → Animal.prototype → Object.prototype → null
console.log(dog instanceof Dog);     // true
console.log(dog instanceof Animal);  // true
console.log(dog instanceof Object);  // true
```

### 2.4 ES6 Class 语法 (语法糖)

```javascript
class Animal {
  static speciesCount = 0; // 静态属性
  #privateField = 'hidden'; // 私有字段

  constructor(name, energy = 100) {
    this.name = name;
    this.energy = energy;
    Animal.speciesCount++;
  }

  // 实例方法 (自动添加到 prototype)
  eat(food) {
    this.energy += 20;
    return `${this.name} eats ${food}`;
  }

  sleep() {
    this.energy += 50;
    return `${this.name} sleeps`;
  }

  // Getter/Setter
  get status() {
    if (this.energy > 80) return 'energetic';
    if (this.energy > 40) return 'normal';
    return 'tired';
  }

  set status(value) {
    throw new Error('Cannot set status directly');
  }

  // 静态方法
  static getSpeciesCount() {
    return Animal.speciesCount;
  }

  // 私有方法
  #internalCheck() {
    return this.energy > 0;
  }
}

class Dog extends Animal {
  #tricks = []; // 私有字段

  constructor(name, breed) {
    super(name); // 调用父类构造函数
    this.breed = breed;
  }

  bark() {
    return `${this.name} says: Woof!`;
  }

  learnTrick(trick) {
    this.#tricks.push(trick);
    this.energy -= 10;
    return `${this.name} learned: ${trick}`;
  }

  get trickCount() {
    return this.#tricks.length;
  }

  // 重写父类方法
  eat(food) {
    const result = super.eat(food); // 调用父类方法
    return `${result} 🐕`;
  }
}

const dog = new Dog('Rex', 'GSD');
console.log(dog.eat('bone'));      // 'Rex eats bone 🐕'
console.log(dog.learnTrick('sit')); // 'Rex learned: sit'
console.log(dog.trickCount);       // 1
console.log(dog.status);           // 'normal'
console.log(Animal.getSpeciesCount()); // 1
```

### 2.5 原型链的底层 API

```javascript
// 1. Object.create — 创建指定原型的对象
const proto = { greet() { return 'hello'; } };
const obj = Object.create(proto);
console.log(obj.greet()); // 'hello'
console.log(Object.getPrototypeOf(obj) === proto); // true

// 2. Object.setPrototypeOf — 修改原型 (性能差，不推荐)
const a = {};
const b = { x: 1 };
Object.setPrototypeOf(a, b);
console.log(a.x); // 1

// 3. Object.isPrototypeOf — 检查原型关系
console.log(proto.isPrototypeOf(obj)); // true
console.log(Object.prototype.isPrototypeOf({})); // true

// 4. hasOwnProperty — 检查自身属性 (不含原型链)
function Foo() { this.own = 1; }
Foo.prototype.inherited = 2;
const foo = new Foo();
console.log(foo.hasOwnProperty('own'));       // true
console.log(foo.hasOwnProperty('inherited')); // false
console.log('inherited' in foo);              // true (包含原型链)

// 5. Object.keys / for...in 区别
console.log(Object.keys(foo)); // ['own'] — 只自身可枚举
for (const key in foo) { console.log(key); }  // 'own', 'inherited' — 含原型链
```

### 2.6 原型链实战: 可组合的 Mixin

```javascript
// Mixin: 可复用的行为组合
const Serializable = {
  toJSON() {
    const obj = {};
    for (const key of Object.keys(this)) {
      obj[key] = this[key];
    }
    return obj;
  },
  toString() {
    return JSON.stringify(this.toJSON());
  },
};

const Observable = {
  _listeners: new Map(),
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event)?.delete(fn);
  },
  emit(event, data) {
    this._listeners.get(event)?.forEach(fn => fn(data));
  },
};

const Validatable = {
  _validators: new Map(),
  validate(field, rule) {
    if (!this._validators.has(field)) this._validators.set(field, []);
    this._validators.get(field).push(rule);
  },
  isValid(field) {
    const rules = this._validators.get(field) || [];
    return rules.every(rule => rule(this[field]));
  },
};

// 应用 Mixin
function User(name, email) {
  this.name = name;
  this.email = email;
}

Object.assign(User.prototype, Serializable, Observable, Validatable);

// 使用
const user = new User('Alice', 'alice@example.com');
user.validate('email', v => v.includes('@'));
user.validate('email', v => v.includes('.'));
console.log(user.isValid('email')); // true
console.log(user.toString());       // '{"name":"Alice","email":"alice@example.com"}'

const unsub = user.on('update', (data) => console.log('Updated:', data));
user.emit('update', { name: 'Bob' }); // 'Updated: { name: 'Bob' }'
```

### 2.7 Symbol 与原型

```javascript
// Symbol 作为唯一键
const sym = Symbol('description');
const obj = { [sym]: 'value' };
console.log(obj[sym]); // 'value'
console.log(Object.keys(obj)); // [] — Symbol 不可枚举
console.log(Object.getOwnPropertySymbols(obj)); // [Symbol(description)]

// Symbol.iterator — 自定义迭代
class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const end = this.end;
    return {
      next() {
        if (current <= end) {
          return { value: current++, done: false };
        }
        return { done: true };
      },
    };
  }
}

const range = new Range(1, 5);
for (const n of range) console.log(n); // 1, 2, 3, 4, 5
console.log([...range]); // [1, 2, 3, 4, 5]
console.log(Array.from(range)); // [1, 2, 3, 4, 5]
```

---

## 三、异步编程 (Async) — JavaScript.info Ch.7

### 3.1 回调地狱与解决方案演进

```javascript
// ❌ 回调地狱 (Callback Hell)
function loadUser(userId, callback) {
  setTimeout(() => callback({ id: userId, name: 'Alice' }), 100);
}
function loadPosts(user, callback) {
  setTimeout(() => callback([{ id: 1, title: 'Post 1' }]), 100);
}
function loadComments(post, callback) {
  setTimeout(() => callback([{ id: 1, text: 'Nice!' }]), 100);
}

// 嵌套回调 — 难以维护
loadUser(1, (user) => {
  loadPosts(user, (posts) => {
    loadComments(posts[0], (comments) => {
      console.log(comments);
    });
  });
});

// ✅ Promise 链
function loadUserP(userId) {
  return new Promise(resolve =>
    setTimeout(() => resolve({ id: userId, name: 'Alice' }), 100)
  );
}
function loadPostsP(user) {
  return new Promise(resolve =>
    setTimeout(() => resolve([{ id: 1, title: 'Post 1' }]), 100)
  );
}
function loadCommentsP(post) {
  return new Promise(resolve =>
    setTimeout(() => resolve([{ id: 1, text: 'Nice!' }]), 100)
  );
}

loadUserP(1)
  .then(loadPostsP)
  .then(posts => loadCommentsP(posts[0]))
  .then(console.log);

// ✅ async/await — 最清晰
async function loadData() {
  const user = await loadUserP(1);
  const posts = await loadPostsP(user);
  const comments = await loadCommentsP(posts[0]);
  return comments;
}
loadData().then(console.log);
```

### 3.2 Promise 状态机

```javascript
// Promise 三种状态: pending → fulfilled | rejected
// 状态一旦改变，不可逆

const p1 = new Promise((resolve, reject) => {
  resolve('success');
  reject('ignored'); // 被忽略 — 状态已锁定
});
p1.then(console.log); // 'success'

// Promise 链式调用 — 每个 then 返回新 Promise
Promise.resolve(1)
  .then(v => v + 1)           // 2
  .then(v => { throw new Error('Oops'); }) // 抛出异常
  .catch(e => e.message)       // 'Oops'
  .then(v => v + '!')          // 'Oops!'
  .then(console.log)           // 'Oops!'
  .finally(() => console.log('done')); // 'done'
```

### 3.3 Promise 组合器

```javascript
// 1. Promise.all — 全部成功才成功，一个失败就失败
Promise.all([
  Promise.resolve(1),
  Promise.resolve(2),
  Promise.resolve(3),
]).then(console.log); // [1, 2, 3]

// 2. Promise.allSettled — 等全部完成 (不管成功失败)
Promise.allSettled([
  Promise.resolve(1),
  Promise.reject(new Error('fail')),
  Promise.resolve(3),
]).then(console.log);
// [
//   { status: 'fulfilled', value: 1 },
//   { status: 'rejected', reason: Error: fail },
//   { status: 'fulfilled', value: 3 }
// ]

// 3. Promise.race — 第一个完成的胜出
Promise.race([
  new Promise(resolve => setTimeout(() => resolve('slow'), 1000)),
  new Promise(resolve => setTimeout(() => resolve('fast'), 100)),
]).then(console.log); // 'fast'

// 4. Promise.any — 第一个成功的胜出 (忽略拒绝)
Promise.any([
  Promise.reject(new Error('fail1')),
  Promise.resolve('success'),
  Promise.reject(new Error('fail2')),
]).then(console.log); // 'success'

// 5. Promise.resolve / Promise.reject
Promise.resolve(42).then(console.log); // 42
Promise.reject(new Error('bad')).catch(console.error); // Error: bad
```

### 3.4 并发控制 — 限制同时进行的异步任务

```javascript
// 并发限制的 Promise 调度器
class AsyncPool {
  constructor(maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
    this.running = 0;
    this.queue = [];
  }

  add(taskFactory) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFactory, resolve, reject });
      this._process();
    });
  }

  _process() {
    while (this.running < this.maxConcurrency && this.queue.length > 0) {
      const { taskFactory, resolve, reject } = this.queue.shift();
      this.running++;

      taskFactory()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this._process();
        });
    }
  }

  get pending() { return this.queue.length; }
  get active() { return this.running; }
}

// 使用: 限制最多 3 个并发请求
const pool = new AsyncPool(3);

const urls = Array.from({ length: 10 }, (_, i) => `https://api.example.com/data/${i}`);

const results = await Promise.all(
  urls.map(url => pool.add(() => fetch(url).then(r => r.json())))
);
```

### 3.5 错误处理策略

```javascript
// 策略 1: 重试 (Retry)
async function fetchWithRetry(url, options = {}) {
  const { maxRetries = 3, delay = 1000, backoff = 2 } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const waitTime = delay * Math.pow(backoff, attempt - 1);
      console.log(`Attempt ${attempt} failed, retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// 策略 2: 超时控制 (Timeout)
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// 策略 3: 降级 (Fallback)
async function getDataWithFallback() {
  try {
    return await withTimeout(fetch('/api/data').then(r => r.json()), 3000);
  } catch {
    console.warn('Primary source failed, using cache');
    try {
      return await fetch('/api/data/cache').then(r => r.json());
    } catch {
      console.warn('Cache also failed, using default');
      return { items: [], timestamp: Date.now() };
    }
  }
}

// 策略 4: 批量错误收集
async function fetchAllWithErrors(urls) {
  const results = await Promise.allSettled(
    urls.map(url => fetch(url).then(r => r.json()))
  );

  const successes = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  const failures = results
    .filter(r => r.status === 'rejected')
    .map(r => r.reason.message);

  return { data: successes, errors: failures };
}
```

### 3.6 Async/Await 深入

```javascript
// 1. 并行 vs 串行
// ❌ 串行 (慢)
async function serial() {
  const a = await fetchA(); // 等 100ms
  const b = await fetchB(); // 再等 100ms
  const c = await fetchC(); // 再等 100ms
  return [a, b, c]; // 总耗时 ~300ms
}

// ✅ 并行 (快)
async function parallel() {
  const [a, b, c] = await Promise.all([
    fetchA(), // 同时发起
    fetchB(), // 同时发起
    fetchC(), // 同时发起
  ]);
  return [a, b, c]; // 总耗时 ~100ms
}

// 2. 错误处理 — try/catch vs .catch
async function handleError() {
  try {
    const data = await fetchData();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 或者
const result = await fetchData().catch(e => ({ error: e.message }));

// 3. 顶层 await (ES2022)
// 在模块顶层可以直接使用 await
// const config = await loadConfig();

// 4. 错误边界模式
function tryCatch(fn) {
  return async function (...args) {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`Error in ${fn.name}:`, error);
      throw error; // 或返回默认值
    }
  };
}

const safeFetch = tryCatch(async (url) => {
  const res = await fetch(url);
  return res.json();
});
```

### 3.7 异步迭代器 (Async Iterator)

```javascript
// 异步生成器
async function* readChunks(stream) {
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

// 使用 for-await-of
async function processStream(url) {
  const response = await fetch(url);
  let totalBytes = 0;

  for await (const chunk of readChunks(response.body)) {
    totalBytes += chunk.length;
    console.log(`Received ${chunk.length} bytes (total: ${totalBytes})`);
  }

  return totalBytes;
}

// 自定义异步迭代器
class AsyncCounter {
  constructor(max) {
    this.max = max;
    this.current = 0;
  }

  async *[Symbol.asyncIterator]() {
    for (let i = 0; i < this.max; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      yield i;
    }
  }
}

async function demo() {
  for await (const n of new AsyncCounter(5)) {
    console.log(n); // 0, 1, 2, 3, 4 (每个间隔 100ms)
  }
}
```

---

## 四、事件循环 (Event Loop) — 核心机制

### 4.1 JavaScript 运行时模型

```
┌─────────────────────────────────────────────────┐
│                  JavaScript Engine               │
│  ┌─────────────┐  ┌───────────────────────────┐ │
│  │   Call      │  │      Web APIs / C APIs     │ │
│  │   Stack     │  │  (setTimeout, fetch, DOM,   │ │
│  │  (LIFO)     │  │   HTTP, File System)       │ │
│  └──────┬──────┘  └──────────┬────────────────┘ │
│         │                    │                   │
│         ▼                    ▼                   │
│  ┌─────────────────────────────────────────────┐ │
│  │           Callback Queue (Macrotask)         │ │
│  │  [setTimeout] [setInterval] [I/O] [UI render]│ │
│  └────────────────────┬────────────────────────┘ │
│                       │                          │
│  ┌─────────────────────────────────────────────┐ │
│  │          Microtask Queue                     │ │
│  │  [Promise.then] [queueMicrotask] [MutationObserver]│ │
│  └────────────────────┬────────────────────────┘ │
│                       │                          │
│  ┌────────────────────▼────────────────────────┐ │
│  │           Event Loop                         │ │
│  │  1. 执行调用栈                               │ │
│  │  2. 清空微任务队列 (全部!)                    │ │
│  │  3. 渲染 (浏览器)                            │ │
│  │  4. 取一个宏任务执行                          │ │
│  │  5. 回到步骤 2                               │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 4.2 宏任务 vs 微任务

```javascript
// 宏任务 (Macrotask): setTimeout, setInterval, setImmediate (Node.js), I/O, UI rendering
// 微任务 (Microtask): Promise.then/catch/finally, queueMicrotask, MutationObserver

console.log('1. Sync start');

setTimeout(() => console.log('2. setTimeout (macrotask)'), 0);

Promise.resolve().then(() => console.log('3. Promise (microtask)'));

queueMicrotask(() => console.log('4. queueMicrotask (microtask)'));

console.log('5. Sync end');

// 输出顺序:
// 1. Sync start
// 5. Sync end
// 3. Promise (microtask)
// 4. queueMicrotask (microtask)
// 2. setTimeout (macrotask)
```

### 4.3 经典面试题解析

```javascript
// 题目 1: 经典顺序
console.log('1');

setTimeout(() => console.log('2'), 0);

Promise.resolve().then(() => {
  console.log('3');
  return Promise.resolve('4');
}).then(data => console.log('Data:', data));

console.log('5');

// 输出: 1 → 5 → 3 → Data: 4 → 2
// 解析:
// 同步: 1, 5
// 微任务: 3, Data: 4 (第二个 then 也在微任务队列)
// 宏任务: 2

// 题目 2: async/await 与微任务
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
  console.log('promise executor');
  resolve();
}).then(() => console.log('promise then'));
console.log('script end');

// 输出:
// script start
// async1 start
// async2
// promise executor
// script end
// async1 end  ← await 后面的代码是微任务
// promise then
// setTimeout

// 题目 3: Promise 链中的微任务调度
Promise.resolve()
  .then(() => console.log('1'))
  .then(() => console.log('2'));

Promise.resolve()
  .then(() => console.log('3'))
  .then(() => console.log('4'));

// 输出: 1 → 3 → 2 → 4
// 解析: 第一个 Promise 链的 then 1 和第二个 Promise 链的 then 3 先入队
// 然后 then 2 和 then 4 入队 (因为 then 1/3 执行后才创建新的 then)
```

### 4.4 Node.js 事件循环 (与浏览器不同)

```
Node.js 事件循环阶段:
┌─────────────────────────────────────┐
│         Timers                      │ ← setTimeout/setInterval callbacks
│         ↓                           │
│         Pending Callbacks           │ ← system operations
│         ↓                           │
│         Idle, Prepare               │ (内部使用)
│         ↓                           │
│         Poll                        │ ← I/O callbacks, 最重要的阶段
│         ↓                           │
│         Check                       │ ← setImmediate callbacks
│         ↓                           │
│         Close Callbacks             │ ← socket.on('close')
└─────────────────────────────────────┘

每个阶段之后: 清空微任务队列 (包括 process.nextTick)
```

```javascript
// Node.js 特有 API
// process.nextTick — 优先级最高，在当前操作完成后立即执行
// setImmediate — Poll 阶段后执行 (Check 阶段)
// setTimeout(fn, 0) — Timers 阶段执行

console.log('1');

setImmediate(() => console.log('setImmediate'));
setTimeout(() => console.log('setTimeout'), 0);
process.nextTick(() => console.log('nextTick'));

Promise.resolve().then(() => console.log('Promise'));

console.log('2');

// 输出: 1 → 2 → nextTick → Promise → setTimeout → setImmediate
// (setTimeout 和 setImmediate 的顺序取决于事件循环状态，可能互换)
```

### 4.5 事件循环实战: 任务优先级管理

```javascript
// 实现一个带优先级的任务调度器
class TaskScheduler {
  constructor() {
    this.microtasks = [];
    this.macrotasks = [];
    this.isProcessing = false;
  }

  // 添加微任务级别任务 (高优先级)
  scheduleMicrotask(fn) {
    this.microtasks.push(fn);
    this._scheduleDrain();
  }

  // 添加宏任务级别任务 (低优先级)
  scheduleMacrotask(fn) {
    this.macrotasks.push(fn);
    this._scheduleDrain();
  }

  _scheduleDrain() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // 使用 queueMicrotask 来调度我们的微任务
    queueMicrotask(() => this._drain());
  }

  _drain() {
    // 先处理所有微任务
    while (this.microtasks.length > 0) {
      const task = this.microtasks.shift();
      try { task(); } catch (e) { console.error(e); }
    }

    // 再处理一个宏任务
    if (this.macrotasks.length > 0) {
      const task = this.macrotasks.shift();
      try { task(); } catch (e) { console.error(e); }

      // 还有宏任务，继续调度
      if (this.macrotasks.length > 0) {
        setTimeout(() => this._drain(), 0);
      } else {
        this.isProcessing = false;
      }
    } else {
      this.isProcessing = false;
    }
  }
}

// 使用
const scheduler = new TaskScheduler();
scheduler.scheduleMacrotask(() => console.log('macro 1'));
scheduler.scheduleMicrotask(() => console.log('micro 1'));
scheduler.scheduleMicrotask(() => console.log('micro 2'));
scheduler.scheduleMacrotask(() => console.log('macro 2'));
// 输出: micro 1 → micro 2 → macro 1 → macro 2
```

### 4.6 长任务与渲染阻塞

```javascript
// ❌ 长任务阻塞事件循环
function processLargeDataset(data) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    // 同步处理 100 万条数据 — 阻塞 UI
    result.push(data[i] * 2);
  }
  return result;
}

// ✅ 方案 1: 分块处理 (Chunking)
function processInChunks(data, chunkSize = 1000, onProgress) {
  return new Promise(resolve => {
    let index = 0;
    const result = [];

    function processChunk() {
      const end = Math.min(index + chunkSize, data.length);
      for (let i = index; i < end; i++) {
        result.push(data[i] * 2);
      }
      index = end;

      if (onProgress) onProgress(index / data.length);

      if (index < data.length) {
        // 让出控制权，允许渲染和其他任务
        setTimeout(processChunk, 0);
      } else {
        resolve(result);
      }
    }

    processChunk();
  });
}

// ✅ 方案 2: requestIdleCallback (浏览器空闲时执行)
function processDuringIdle(data, onProgress) {
  return new Promise(resolve => {
    let index = 0;
    const result = [];
    const chunkSize = 1000;

    function idleCallback(deadline) {
      while (deadline.timeRemaining() > 0 && index < data.length) {
        const end = Math.min(index + chunkSize, data.length);
        for (let i = index; i < end; i++) {
          result.push(data[i] * 2);
        }
        index = end;
      }

      if (onProgress) onProgress(index / data.length);

      if (index < data.length) {
        requestIdleCallback(idleCallback);
      } else {
        resolve(result);
      }
    }

    requestIdleCallback(idleCallback);
  });
}

// ✅ 方案 3: Web Worker (完全异步)
// worker.js
// self.onmessage = (e) => {
//   const result = e.data.map(x => x * 2);
//   self.postMessage(result);
// };
//
// main.js:
// const worker = new Worker('worker.js');
// worker.postMessage(largeData);
// worker.onmessage = (e) => console.log(e.data);
```

### 4.7 性能监控: Performance Observer

```javascript
// 监控长任务
const longTaskObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.warn(`长任务: ${entry.duration}ms at ${entry.startTime}`);
  }
});
longTaskObserver.observe({ entryTypes: ['longtask'] });

// 监控 FCP (First Contentful Paint)
const paintObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.startTime}ms`);
  }
});
paintObserver.observe({ entryTypes: ['paint'] });

// 手动标记性能点
performance.mark('start-processing');
// ... do work ...
performance.mark('end-processing');
performance.measure('processing-time', 'start-processing', 'end-processing');

const measure = performance.getEntriesByName('processing-time')[0];
console.log(`Processing took: ${measure.duration}ms`);
```

---

## 五、综合实战

### 5.1 实战: 异步任务队列 (支持优先级/重试/超时)

```javascript
class AsyncTaskQueue {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 3;
    this.maxRetries = options.maxRetries || 2;
    this.timeout = options.timeout || 5000;
    this.running = 0;
    this.queue = [];
    this.results = [];
    this.onProgress = options.onProgress || null;
  }

  add(task, priority = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, priority, resolve, reject, attempts: 0 });
      this.queue.sort((a, b) => b.priority - a.priority);
      this._process();
    });
  }

  async _process() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const { task, resolve, reject, attempts } = this.queue.shift();
      this.running++;

      this._execute(task, attempts)
        .then(result => {
          this.results.push({ status: 'fulfilled', value: result });
          resolve(result);
        })
        .catch(error => {
          this.results.push({ status: 'rejected', reason: error });
          reject(error);
        })
        .finally(() => {
          this.running--;
          this.onProgress?.(this.results.length);
          this._process();
        });
    }
  }

  async _execute(task, attempts) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Task timeout')), this.timeout)
    );

    try {
      const result = await Promise.race([task(), timeoutPromise]);
      return result;
    } catch (error) {
      if (attempts < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempts + 1)));
        return this._execute(task, attempts + 1);
      }
      throw error;
    }
  }

  get status() {
    return {
      pending: this.queue.length,
      running: this.running,
      completed: this.results.length,
    };
  }
}

// 使用
const queue = new AsyncTaskQueue({
  concurrency: 2,
  maxRetries: 2,
  timeout: 3000,
  onProgress: (done) => console.log(`Progress: ${done} tasks done`),
});

// 添加任务
const task1 = queue.add(async () => {
  await new Promise(r => setTimeout(r, 500));
  return 'task1 result';
}, 1); // 高优先级

const task2 = queue.add(async () => {
  await new Promise(r => setTimeout(r, 300));
  return 'task2 result';
}, 0);

const task3 = queue.add(async () => {
  await new Promise(r => setTimeout(r, 800));
  return 'task3 result';
}, 2); // 最高优先级

const results = await Promise.all([task1, task2, task3]);
console.log(results); // ['task3 result', 'task2 result', 'task1 result'] (按优先级)
```

### 5.2 实战: 响应式系统 (闭包 + 代理)

```javascript
// 简化版 Vue 3 响应式系统
function reactive(target) {
  const depsMap = new Map(); // key → Set<Effect>
  let activeEffect = null;

  const handler = {
    get(obj, key, receiver) {
      const result = Reflect.get(obj, key, receiver);
      if (activeEffect) {
        if (!depsMap.has(key)) depsMap.set(key, new Set());
        depsMap.get(key).add(activeEffect);
      }
      return result;
    },
    set(obj, key, value, receiver) {
      const oldValue = obj[key];
      const result = Reflect.set(obj, key, value, receiver);
      if (oldValue !== value && depsMap.has(key)) {
        depsMap.get(key).forEach(effect => effect());
      }
      return result;
    },
  };

  const proxy = new Proxy(target, handler);

  // effect 函数 (闭包捕获 depsMap)
  proxy.effect = (fn) => {
    const effect = () => {
      activeEffect = effect;
      fn();
      activeEffect = null;
    };
    effect();
  };

  return proxy;
}

// 使用
const state = reactive({ count: 0, name: 'Alice' });

state.effect(() => {
  console.log(`Count is now: ${state.count}`);
});

state.count = 1; // 触发 effect → 'Count is now: 1'
state.count = 2; // 触发 effect → 'Count is now: 2'
state.name = 'Bob'; // 不触发 (count 的依赖)
```

### 5.3 实战: 微任务优先级调度

```javascript
// 实现一个基于微任务的调度系统
class MicrotaskScheduler {
  constructor() {
    this.highPriority = [];
    this.normalPriority = [];
    this.scheduled = false;
  }

  schedule(fn, priority = 'normal') {
    if (priority === 'high') {
      this.highPriority.push(fn);
    } else {
      this.normalPriority.push(fn);
    }
    this._scheduleFlush();
  }

  _scheduleFlush() {
    if (this.scheduled) return;
    this.scheduled = true;

    queueMicrotask(() => this._flush());
  }

  _flush() {
    // 先处理高优先级
    while (this.highPriority.length > 0) {
      const fn = this.highPriority.shift();
      try { fn(); } catch (e) { console.error(e); }
    }

    // 再处理普通优先级
    while (this.normalPriority.length > 0) {
      const fn = this.normalPriority.shift();
      try { fn(); } catch (e) { console.error(e); }
    }

    this.scheduled = false;
  }
}

// 使用
const scheduler = new MicrotaskScheduler();
scheduler.schedule(() => console.log('normal 1'));
scheduler.schedule(() => console.log('high 1'), 'high');
scheduler.schedule(() => console.log('normal 2'));
scheduler.schedule(() => console.log('high 2'), 'high');
// 输出: high 1 → high 2 → normal 1 → normal 2
```

---

## 六、核心知识点速查表

### 闭包
| 概念 | 说明 |
|------|------|
| 定义 | 函数 + 词法环境引用 |
| 用途 | 数据私有化、工厂函数、柯里化、记忆化 |
| 陷阱 | 循环变量共享、内存泄漏、this 丢失 |
| 修复 | let 块级作用域、断开大对象引用、箭头函数 |

### 原型
| 概念 | 说明 |
|------|------|
| 原型链 | 对象 → __proto__ → ... → null |
| 继承 | Object.create / class extends |
| 属性查找 | 自身 → 原型链 → undefined |
| 关键 API | Object.create / getPrototypeOf / isPrototypeOf |
| Mixin | Object.assign 组合行为 |

### 异步
| 概念 | 说明 |
|------|------|
| Promise 状态 | pending → fulfilled / rejected (不可逆) |
| 组合器 | all / allSettled / race / any |
| 错误处理 | try/catch / .catch / 重试 / 超时 / 降级 |
| 并发控制 | AsyncPool / Promise.all + 分片 |

### 事件循环
| 概念 | 说明 |
|------|------|
| 宏任务 | setTimeout / setInterval / I/O / UI render |
| 微任务 | Promise.then / queueMicrotask / MutationObserver |
| 执行顺序 | 同步 → 微任务(全部) → 渲染 → 宏任务(一个) |
| Node.js | Timers → Pending → Poll → Check → Close + 微任务 |

---

## 七、面试高频题

### 题 1: 输出什么?
```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 1);
}
// 输出: 3, 3, 3 (var 没有块级作用域)
```

### 题 2: 输出什么?
```javascript
async function f() {
  console.log(1);
  await Promise.resolve();
  console.log(2);
}
f();
console.log(3);
// 输出: 1 → 3 → 2 (await 后是微任务)
```

### 题 3: 输出什么?
```javascript
Promise.resolve()
  .then(() => console.log(1))
  .then(() => console.log(2));

setTimeout(() => console.log(3), 0);

Promise.resolve()
  .then(() => console.log(4));
// 输出: 1 → 4 → 2 → 3
```

### 题 4: 实现一个 once 函数
```javascript
function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}

const init = once(() => { console.log('initialized'); return 42; });
init(); // 'initialized', 42
init(); // 42 (不执行)
```

### 题 5: 原型链查找
```javascript
function A() {}
A.prototype.x = 1;
function B() {}
B.prototype = Object.create(A.prototype);
B.prototype.y = 2;
const b = new B();
console.log(b.x, b.y); // 1, 2
console.log(b.__proto__.__proto__.x); // 1
```

---

*专项训练完成 — JavaScript 深度 (闭包/原型/异步/事件循环)*
*覆盖 JavaScript.info 第 5-7 章核心内容*
*25+ 代码示例，覆盖所有高频面试场景*
