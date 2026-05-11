# 专项训练 06:00 — 函数式编程 (2026-05-05)

## 一、核心概念速览

### 1. 纯函数 (Pure Function)
- **相同输入 → 相同输出**，无任何副作用
- 不读写外部状态，不修改参数，不 I/O
- 可缓存、可并行、可测试

### 2. 不可变性 (Immutability)
- 数据创建后永不修改，"修改" 返回新副本
- JS 中用 `Object.freeze`、展开运算符、`structuredClone`

### 3. 函数组合 (Composition)
- `f ∘ g`：先 g 后 f，`compose(f, g)(x) = f(g(x))`
- 管道 `pipe`：先 f 后 g，更直觉

### 4. 柯里化 (Currying)
- 多参数函数 → 一元函数链：`f(a,b,c) → f(a)(b)(c)`
- 天然支持偏函数应用 (partial application)

---

## 二、12 个函数式示例

### 示例 1：纯函数 — 数据转换
```js
// ❌ 不纯：修改了外部状态
let total = 0;
function add(x) { total += x; return total; }

// ✅ 纯函数：相同输入 → 相同输出，无副作用
const add = (a, b) => a + b;
const multiply = (a, b) => a * b;

add(2, 3); // 5 — 永远 5
```

### 示例 2：不可变性 — 数组操作
```js
// ❌ 可变：push/sort 修改原数组
const nums = [3, 1, 2];
nums.push(4); // 原数组变了

// ✅ 不可变：返回新数组
const nums = [3, 1, 2];
const sorted = [...nums].sort((a, b) => a - b); // [1, 2, 3]，原数组不变
const withFour = [...sorted, 4]; // [1, 2, 3, 4]
```

### 示例 3：柯里化 — 参数固定
```js
// 手动柯里化
const curry = (fn) =>
  function curried(...args) {
    if (args.length >= fn.length) return fn(...args);
    return (...more) => curried(...args, ...more);
  };

const multiply = (a, b, c) => a * b * c;
const curriedMul = curry(multiply);

curriedMul(2)(3)(4);    // 24
curriedMul(2)(3, 4);    // 24
const double = curriedMul(2);  // 偏函数：乘以 2
double(5)(6);           // 60
```

### 示例 4：函数组合 — compose & pipe
```js
// compose: 从右到左
const compose = (...fns) => (x) =>
  fns.reduceRight((v, fn) => fn(v), x);

// pipe: 从左到右（更直觉）
const pipe = (...fns) => (x) =>
  fns.reduce((v, fn) => fn(v), x);

const toLower = (s) => s.toLowerCase();
const removeSpace = (s) => s.trim();
const addPrefix = (s) => `>> ${s}`;

// 组合：先 trim → 小写 → 加前缀
const process = pipe(removeSpace, toLower, addPrefix);
process("  Hello World  "); // ">> hello world"
```

### 示例 5：高阶函数 — map/filter/reduce
```js
const users = [
  { name: "Alice", age: 28, active: true },
  { name: "Bob", age: 35, active: false },
  { name: "Charlie", age: 22, active: true },
  { name: "Diana", age: 31, active: true },
];

// 纯函数组合：活跃用户 → 按年龄排序 → 提取名字
const getActiveNames = pipe(
  (arr) => arr.filter((u) => u.active),
  (arr) => [...arr].sort((a, b) => a.age - b.age),
  (arr) => arr.map((u) => u.name)
);

getActiveNames(users); // ["Charlie", "Alice", "Diana"]
```

### 示例 6：不可变对象更新
```js
// 使用展开运算符做不可变更新
const update = (obj, path, value) => {
  const keys = path.split(".");
  const updateNested = (o, [k, ...rest]) => {
    if (rest.length === 0) return { ...o, [k]: value };
    return { ...o, [k]: updateNested(o[k], rest) };
  };
  return updateNested(obj, keys);
};

const state = { user: { profile: { name: "Alice", age: 28 } } };
const newState = update(state, "user.profile.age", 29);

state.user.profile.age;        // 28 — 原对象不变
newState.user.profile.age;     // 29 — 新对象
```

### 示例 7：柯里化 — 验证管道
```js
const validate = (rule, value) => rule(value);
const curryValidate = curry(validate);

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const minLength = (min) => (v) => v.length >= min;
const notEmpty = (v) => v.trim().length > 0;

// 柯里化后方便组合
const validateEmail = pipe(
  curryValidate(notEmpty),
  curryValidate(minLength(5)),
  curryValidate(isEmail)
);

// 更好的方式：柯里化验证函数
const validateField = (rule) => (value) => rule(value);
const hasRule = (rule) => (value) => rule(value);

// 构建验证器
const createValidator = (...rules) => (value) =>
  rules.every((rule) => rule(value));

const emailValidator = createValidator(notEmpty, minLength(5), isEmail);
emailValidator("test@example.com"); // true
emailValidator("bad");              // false
```

### 示例 8：纯函数 — 错误处理 (Either/Result 模式)
```js
// 用 Result 模式替代 try/catch
const Result = {
  Ok: (value) => ({ isOk: true, value, map: (fn) => Result.Ok(fn(value)), flatMap: (fn) => fn(value) }),
  Err: (error) => ({ isOk: false, error, map: () => Result.Err(error), flatMap: () => Result.Err(error) }),
};

// 纯函数：解析 JSON
const parseJSON = (str) => {
  try { return Result.Ok(JSON.parse(str)); }
  catch (e) { return Result.Err(e.message); }
};

// 纯函数：安全获取属性
const getProp = (key) => (obj) =>
  obj && typeof obj === "object" && key in obj
    ? Result.Ok(obj[key])
    : Result.Err(`Property "${key}" not found`);

// 组合：解析 → 获取属性
const getName = (str) =>
  parseJSON(str).flatMap(getProp("name"));

getName('{"name": "Alice"}'); // { isOk: true, value: "Alice" }
getName('{"age": 28}');       // { isOk: false, error: 'Property "name" not found' }
getName("not json");          // { isOk: false, error: '...' }
```

### 示例 9：记忆化 — 纯函数的缓存优化
```js
const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

// 斐波那契（纯函数）
const fib = memoize((n) => {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
});

fib(50); // 12586269025 — 瞬间完成（缓存生效）
```

### 示例 10：不可变集合操作
```js
// 纯函数集合操作
const SetOps = {
  union: (a, b) => new Set([...a, ...b]),
  intersect: (a, b) => new Set([...a].filter((x) => b.has(x))),
  diff: (a, b) => new Set([...a].filter((x) => !b.has(x))),
  map: (fn) => (set) => new Set([...set].map(fn)),
  filter: (fn) => (set) => new Set([...set].filter(fn)),
};

const nums = new Set([1, 2, 3, 4, 5]);
const evens = new Set([2, 4, 6, 8]);

SetOps.union(nums, evens);       // {1,2,3,4,5,6,8}
SetOps.intersect(nums, evens);   // {2,4}
SetOps.diff(nums, evens);        // {1,3,5}

const doubled = SetOps.map((x) => x * 2)(nums); // {2,4,6,8,10}
```

### 示例 11：管道 — 数据处理流水线
```js
// 真实场景：处理订单数据
const orders = [
  { id: 1, items: [{ price: 100, qty: 2 }, { price: 50, qty: 1 }], status: "paid" },
  { id: 2, items: [{ price: 200, qty: 1 }], status: "pending" },
  { id: 3, items: [{ price: 75, qty: 3 }, { price: 25, qty: 2 }], status: "paid" },
];

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const total = (items) => sum(items.map((i) => i.price * i.qty));

const processOrders = pipe(
  // 1. 只保留已支付订单
  (orders) => orders.filter((o) => o.status === "paid"),
  // 2. 计算每个订单总额
  (orders) => orders.map((o) => ({ ...o, total: total(o.items) })),
  // 3. 按总额排序
  (orders) => [...orders].sort((a, b) => b.total - a.total),
  // 4. 格式化输出
  (orders) => orders.map((o) => `#${o.id}: ¥${o.total}`)
);

processOrders(orders); // ["#3: ¥275", "#1: ¥250"]
// Order 1: 100*2 + 50*1 = 250
// Order 3: 75*3 + 25*2 = 275
// 降序: #3: ¥275, #1: ¥250
```

### 示例 12：组合子模式 — 查询构建器
```js
// 纯函数查询构建器（不可变链式调用）
const Query = {
  create: (data) => ({ data: [...data] }),

  where: (predicate) => (query) =>
    Query.create(query.data.filter(predicate)),

  select: (mapper) => (query) =>
    Query.create(query.data.map(mapper)),

  orderBy: (key, asc = true) => (query) => ({
    ...query,
    data: [...query.data].sort((a, b) =>
      asc ? (a[key] > b[key] ? 1 : -1) : (a[key] < b[key] ? 1 : -1)
    ),
  }),

  limit: (n) => (query) =>
    Query.create(query.data.slice(0, n)),

  run: (query) => query.data,
};

const products = [
  { name: "Laptop", price: 8000, category: "electronics" },
  { name: "Book", price: 50, category: "education" },
  { name: "Phone", price: 5000, category: "electronics" },
  { name: "Pen", price: 10, category: "education" },
  { name: "Tablet", price: 3000, category: "electronics" },
];

// 纯函数式查询：电子产品 → 按价格升序 → 取前2 → 只保留名字和价格
const result = pipe(
  Query.create,
  Query.where((p) => p.category === "electronics"),
  Query.orderBy("price", true),
  Query.limit(2),
  Query.select((p) => ({ name: p.name, price: p.price })),
  Query.run
)(products);

// [{ name: "Tablet", price: 3000 }, { name: "Phone", price: 5000 }]
```

---

## 三、核心要点总结

| 概念 | 核心思想 | JS 中的实践 |
|------|---------|------------|
| **纯函数** | 无副作用，确定性输出 | 不修改入参，不读全局变量 |
| **不可变性** | 数据永不修改 | 展开运算符 `[...arr]`、`{...obj}` |
| **组合** | 小函数 → 大函数 | `compose` / `pipe` |
| **柯里化** | 多参 → 一元链 | `f(a)(b)(c)`，偏函数应用 |
| **高阶函数** | 函数是一等公民 | `map`/`filter`/`reduce` |
| **声明式** | 描述"做什么"而非"怎么做" | 数据流管道代替 for 循环 |

### 函数式 vs 命令式对比

```js
// 命令式
let result = [];
for (let i = 0; i < users.length; i++) {
  if (users[i].active) {
    result.push(users[i].name.toUpperCase());
  }
}

// 函数式
const result = pipe(
  (arr) => arr.filter((u) => u.active),
  (arr) => arr.map((u) => u.name.toUpperCase())
)(users);
```

### 何时用函数式
- ✅ 数据转换/处理管道
- ✅ 状态管理（Redux 就是 FP 思想）
- ✅ 需要测试/缓存/并行的场景
- ⚠️ 不需要过度抽象——简单 for 循环能解决的就别绕

---

_训练完成：12 个示例覆盖纯函数、不可变性、组合、柯里化、高阶函数、错误处理、记忆化、集合操作、数据管道、查询构建器。_
