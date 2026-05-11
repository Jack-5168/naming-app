# 函数式编程 (Functional Programming) — 核心概念与 14 个示例

> 专项训练 06:00 · 2026-05-08

---

## 一、纯函数 (Pure Functions)

**定义：** 给定相同输入，永远返回相同输出；不产生任何副作用（不修改外部状态、不读写文件、不发起网络请求）。

### 示例 1：纯函数 vs 不纯函数

```js
// ❌ 不纯：依赖外部变量 + 修改外部状态
let taxRate = 0.1;
let totalOrders = 0;

function calculateTotal(price) {
  totalOrders++; // 副作用：修改外部变量
  return price * (1 + taxRate); // 副作用：依赖外部变量
}

// ✅ 纯函数：输入→输出，无副作用
function calculateTotalPure(price, taxRate) {
  return price * (1 + taxRate);
}

console.log(calculateTotalPure(100, 0.1)); // 110
console.log(calculateTotalPure(100, 0.1)); // 110 — 永远一致
```

### 示例 2：纯函数的可测试性

```js
// 纯函数 = 单元测试极其简单
function isValidEmail(email) {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

// 无需 mock，无需 setup，直接断言
console.assert(isValidEmail("a@b.com") === true);
console.assert(isValidEmail("invalid") === false);
console.assert(isValidEmail("") === false);
```

### 示例 3：纯函数 + 缓存 (Memoization)

```js
// 纯函数天然支持缓存
function memoize(fn) {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

// 斐波那契 — 纯函数
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const memoFib = memoize(fibonacci);
console.log(memoFib(40)); // 102334155 — 首次计算
console.log(memoFib(40)); // 102334155 — 缓存命中，O(1)
```

---

## 二、不可变性 (Immutability)

**定义：** 数据一旦创建就不能被修改。"修改"操作返回新数据，原数据保持不变。

### 示例 4：不可变数据操作

```js
// ❌ 可变：直接修改原数组
const nums = [1, 2, 3];
nums.push(4); // 原数组被修改
nums[0] = 99; // 原数组被修改

// ✅ 不可变：每次操作返回新数组
const nums2 = [1, 2, 3];
const nums3 = [...nums2, 4];        // [1, 2, 3, 4] — 新数组
const nums4 = nums3.map((n, i) => i === 0 ? 99 : n); // [99, 2, 3, 4]
console.log(nums2); // [1, 2, 3] — 原数组不变！

// 不可变对象更新
const user = { name: "Alice", age: 25, address: { city: "Beijing" } };

// 浅拷贝 — 只改顶层
const user2 = { ...user, age: 26 };

// 深拷贝更新 — 嵌套对象
const user3 = {
  ...user,
  address: { ...user.address, city: "Shanghai" }
};

console.log(user);       // age: 25, city: Beijing — 不变
console.log(user2);      // age: 26, city: Beijing
console.log(user3);      // age: 25, city: Shanghai
```

### 示例 5：不可变数组操作工具集

```js
const Immutable = {
  // 添加（不修改原数组）
  add: (arr, item) => [...arr, item],

  // 删除（按索引）
  remove: (arr, index) => arr.filter((_, i) => i !== index),

  // 更新（按索引）
  update: (arr, index, fn) =>
    arr.map((item, i) => (i === index ? fn(item) : item)),

  // 插入（指定位置）
  insert: (arr, index, item) => [
    ...arr.slice(0, index),
    item,
    ...arr.slice(index)
  ]
};

const list = ["a", "b", "c"];
console.log(Immutable.add(list, "d"));     // ["a","b","c","d"]
console.log(Immutable.remove(list, 1));    // ["a","c"]
console.log(Immutable.update(list, 0, x => x.toUpperCase())); // ["A","b","c"]
console.log(Immutable.insert(list, 1, "x")); // ["a","x","b","c"]
console.log(list); // ["a","b","c"] — 原数组永远不变
```

---

## 三、函数组合 (Function Composition)

**定义：** 将多个函数组合成新函数，数据像流水线一样依次经过每个函数。`(f ∘ g)(x) = f(g(x))`

### 示例 6：compose 与 pipe

```js
// compose: 从右到左执行 — f(g(h(x)))
const compose = (...fns) => (x) =>
  fns.reduceRight((val, fn) => fn(val), x);

// pipe: 从左到右执行 — h(g(f(x)))
const pipe = (...fns) => (x) =>
  fns.reduce((val, fn) => fn(val), x);

// 基础函数
const trim = s => s.trim();
const lower = s => s.toLowerCase();
const removeVowels = s => s.replace(/[aeiou]/g, "");
const wrapInBrackets = s => `[${s}]`;

// 组合 — 从右到左
const process1 = compose(wrapInBrackets, removeVowels, lower, trim);
console.log(process1("  Hello World  ")); // "[hllwrld]"

// 组合 — 从左到右（更直观）
const process2 = pipe(trim, lower, removeVowels, wrapInBrackets);
console.log(process2("  Hello World  ")); // "[hllwrld]"
```

### 示例 7：数据管道 — 真实场景

```js
const users = [
  { name: "Alice", age: 28, role: "admin", active: true },
  { name: "bob", age: 17, role: "user", active: false },
  { name: "Charlie", age: 35, role: "admin", active: true },
  { name: "diana", age: 22, role: "user", active: true },
  { name: "Eve", age: 31, role: "user", active: true }
];

// 管道：过滤 → 排序 → 映射 → 格式化
const getActiveAdminNames = pipe(
  // 1. 过滤：活跃用户 + admin
  users => users.filter(u => u.active && u.role === "admin"),
  // 2. 按年龄排序
  users => [...users].sort((a, b) => a.age - b.age),
  // 3. 提取名字并大写
  users => users.map(u => u.name.toUpperCase()),
  // 4. 格式化输出
  names => `Active admins: ${names.join(", ")}`
);

console.log(getActiveAdminNames(users));
// "Active admins: ALICE, CHARLIE"
```

### 示例 8：链式管道构建器

```js
// 可链式调用的 Pipeline
class Pipeline {
  constructor(value) {
    this._value = value;
    this._steps = [];
  }

  use(fn) {
    this._steps.push(fn);
    return this; // 返回 this 实现链式
  }

  run() {
    return this._steps.reduce((val, fn) => fn(val), this._value);
  }
}

// 使用
const result = new Pipeline([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  .use(arr => arr.filter(n => n % 2 === 0))      // [2,4,6,8,10]
  .use(arr => arr.map(n => n * n))               // [4,16,36,64,100]
  .use(arr => arr.reduce((sum, n) => sum + n, 0)) // 220
  .run();

console.log(result); // 220
```

---

## 四、柯里化 (Currying)

**定义：** 将接受多个参数的函数转换为一系列只接受一个参数的函数。`f(a, b, c) → f(a)(b)(c)`

### 示例 9：柯里化基础

```js
// 通用柯里化工具
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return (...moreArgs) => curried.apply(this, [...args, ...moreArgs]);
  };
}

// 普通函数
function add(a, b, c) {
  return a + b + c;
}

// 柯里化后
const curriedAdd = curry(add);

console.log(curriedAdd(1)(2)(3));    // 6
console.log(curriedAdd(1, 2)(3));    // 6
console.log(curriedAdd(1)(2, 3));    // 6
console.log(curriedAdd(1, 2, 3));    // 6

// 柯里化的威力：部分应用
const add10 = curriedAdd(10);
const add10And5 = curriedAdd(10)(5);

console.log(add10(20));      // 30
console.log(add10And5(7));   // 22
```

### 示例 10：柯里化实战 — 正则验证器

```js
const curry = fn => (...args) =>
  args.length >= fn.length
    ? fn(...args)
    : (...more) => curry(fn)(...args, ...more);

// 柯里化的正则匹配
const matches = curry((pattern, str) => pattern.test(str));

// 预配置验证器
const isEmail = matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
const isPhone = matches(/^\d{11}$/);
const isUrl = matches(/^https?:\/\/.+/);

console.log(isEmail("test@example.com")); // true
console.log(isPhone("13812345678"));      // true
console.log(isUrl("not-a-url"));          // false

// 结合 filter 使用
const emails = ["a@b.com", "invalid", "c@d.org", "xxx"];
console.log(emails.filter(isEmail)); // ["a@b.com", "c@d.org"]
```

### 示例 11：柯里化实战 — 数据查询构建器

```js
// 柯里化查询器
const where = curry((field, value, arr) =>
  arr.filter(item => item[field] === value)
);

const select = curry((fields, arr) =>
  arr.map(item => {
    const picked = {};
    fields.forEach(f => picked[f] = item[f]);
    return picked;
  })
);

const orderBy = curry((field, arr) =>
  [...arr].sort((a, b) => (a[field] > b[field] ? 1 : -1))
);

const data = [
  { name: "Alice", dept: "eng", salary: 80 },
  { name: "Bob", dept: "sales", salary: 60 },
  { name: "Charlie", dept: "eng", salary: 90 },
  { name: "Diana", dept: "eng", salary: 85 }
];

// 部分应用创建专用查询
const getEng = where("dept", "eng");
const getNameAndSalary = select(["name", "salary"]);
const bySalary = orderBy("salary");

// 组合使用
const result = pipe(getEng, bySalary, getNameAndSalary)(data);
console.log(result);
// [{ name: "Alice", salary: 80 }, { name: "Diana", salary: 85 }, { name: "Charlie", salary: 90 }]
```

---

## 五、综合进阶

### 示例 12：Point-Free 风格

```js
// Point-Free = 不显式提及数据参数，只组合函数
const pointFree = {
  map: fn => arr => arr.map(fn),
  filter: fn => arr => arr.filter(fn),
  reduce: (fn, init) => arr => arr.reduce(fn, init),
  compose: (...fns) => x => fns.reduceRight((v, f) => f(v), x)
};

const { map, filter, reduce, compose } = pointFree;

// 组合成纯数据变换管道
const sumOfSquaresOfEvens = compose(
  reduce((sum, n) => sum + n, 0),
  map(n => n * n),
  filter(n => n % 2 === 0)
);

console.log(sumOfSquaresOfEvens([1, 2, 3, 4, 5, 6]));
// 2² + 4² + 6² = 4 + 16 + 36 = 56
```

### 示例 13：Functor 与 Maybe

```js
// Functor: 可映射的容器
class Functor {
  constructor(value) { this.value = value; }
  map(fn) { return new Functor(fn(this.value)); }
}

// Maybe: 处理 null/undefined 的安全容器
class Maybe {
  static of(value) { return new Maybe(value); }
  constructor(value) { this.value = value; }

  isNothing() { return this.value === null || this.value === undefined; }

  map(fn) {
    return this.isNothing() ? new Maybe(null) : new Maybe(fn(this.value));
  }

  getOrElse(defaultVal) {
    return this.isNothing() ? defaultVal : this.value;
  }
}

// 使用 Maybe 安全地处理嵌套属性
const user = { profile: { settings: { theme: "dark" } } };

const getTheme = Maybe.of(user)
  .map(u => u.profile)
  .map(p => p.settings)
  .map(s => s.theme)
  .getOrElse("light");

console.log(getTheme); // "dark"

// null 安全
const getThemeNull = Maybe.of(null)
  .map(u => u.profile)
  .map(p => p.settings)
  .map(s => s.theme)
  .getOrElse("light");

console.log(getThemeNull); // "light" — 不会报错！
```

### 示例 14：函数式状态管理

```js
// 纯函数状态机 — 所有状态变更通过 reducer (纯函数)
const createStore = (reducer, initialState) => {
  let state = initialState;
  const listeners = [];

  return {
    getState: () => state, // 返回副本，保持不可变
    dispatch: (action) => {
      state = reducer(state, action);
      listeners.forEach(fn => fn(state));
    },
    subscribe: (fn) => {
      listeners.push(fn);
      return () => listeners.splice(listeners.indexOf(fn), 1);
    }
  };
};

// Reducer: (state, action) => newState — 纯函数
function todoReducer(state, action) {
  switch (action.type) {
    case "ADD":
      return [...state, {
        id: Date.now(),
        text: action.text,
        done: false
      }];
    case "TOGGLE":
      return state.map(todo =>
        todo.id === action.id
          ? { ...todo, done: !todo.done }
          : todo
      );
    case "REMOVE":
      return state.filter(todo => todo.id !== action.id);
    default:
      return state;
  }
}

const store = createStore(todoReducer, []);

store.subscribe(state => {
  console.log("State:", JSON.stringify(state));
});

store.dispatch({ type: "ADD", text: "Learn FP" });
store.dispatch({ type: "ADD", text: "Practice currying" });
store.dispatch({ type: "TOGGLE", id: store.getState()[0].id });
store.dispatch({ type: "REMOVE", id: store.getState()[1].id });

// 最终状态: [{ id: ..., text: "Learn FP", done: true }]
```

---

## 核心概念速查表

| 概念 | 一句话 | 关键工具 |
|------|--------|----------|
| **纯函数** | 相同输入→相同输出，无副作用 | 无全局变量、无 I/O |
| **不可变性** | 数据创建后不可修改，"改"即创建新的 | spread `...`, `Object.assign`, `map/filter` |
| **组合** | 小函数拼成大函数，数据流经管道 | `compose`, `pipe` |
| **柯里化** | 多参函数→单参函数链，支持部分应用 | `curry`, 闭包 |
| **Point-Free** | 不写参数名，只组合函数 | 组合 + 柯里化 |
| **Functor** | 可映射的容器，封装值 | `map` 方法 |
| **Maybe** | 安全处理 null/undefined | `map` + `getOrElse` |

## 函数式编程思维转换

```
命令式思维：                    函数式思维：
"先做A，再做B，最后做C"         "把A、B、C组合成一个新函数"
"修改这个变量"                  "基于原值创建新值"
"如果...就...否则..."           "用高阶函数表达意图"
"写一个循环"                    "用 map/filter/reduce"
"这个函数做很多事"              "每个函数只做一件事"
```
