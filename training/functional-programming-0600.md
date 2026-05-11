# 函数式编程专项训练 - 06:00

**日期:** 2026 年 4 月 24 日 星期五  
**主题:** 函数式编程核心概念与实战示例

---

## 一、纯函数 (Pure Functions)

纯函数的定义：给定相同的输入，永远返回相同的输出，且不产生任何副作用。

### 示例 1: 纯函数 - 加法
```javascript
// ✅ 纯函数
const add = (a, b) => a + b;
add(2, 3); // 永远是 5
```

### 示例 2: 纯函数 - 字符串处理
```javascript
// ✅ 纯函数
const toUpperCase = (str) => str.toUpperCase();
toUpperCase("hello"); // 永远是 "HELLO"
```

### 示例 3: 非纯函数对比
```javascript
// ❌ 非纯函数 - 依赖外部状态
let counter = 0;
const increment = () => ++counter; // 每次调用结果不同

// ❌ 非纯函数 - 产生副作用
const logAndReturn = (x) => {
  console.log(x); // 副作用
  return x * 2;
};
```

---

## 二、不可变性 (Immutability)

不可变性：数据一旦创建就不能被修改，任何"修改"都返回新数据。

### 示例 4: 数组不可变操作
```javascript
const original = [1, 2, 3];

// ❌ 可变操作
original.push(4); // 修改了原数组

// ✅ 不可变操作
const newArray = [...original, 4]; // [1, 2, 3, 4]
// original 保持不变
```

### 示例 5: 对象不可变更新
```javascript
const user = { name: "Alice", age: 25 };

// ❌ 可变操作
user.age = 26;

// ✅ 不可变操作
const updatedUser = { ...user, age: 26 };
// user 保持不变
```

### 示例 6: 使用 Object.freeze
```javascript
const config = Object.freeze({
  apiUrl: "https://api.example.com",
  timeout: 5000
});

// 尝试修改会失败（严格模式下抛出错误）
config.timeout = 10000; // ❌
```

---

## 三、函数组合 (Function Composition)

函数组合：将多个函数组合成一个新函数，数据像管道一样流动。

### 示例 7: 基础组合
```javascript
const compose = (...fns) => (x) =>
  fns.reduceRight((acc, fn) => fn(acc), x);

const add1 = (x) => x + 1;
const double = (x) => x * 2;
const square = (x) => x * x;

// compose(square, double, add1)(5) = square(double(add1(5)))
// = square(double(6)) = square(12) = 144
const transform = compose(square, double, add1);
transform(5); // 144
```

### 示例 8: 管道组合 (pipe)
```javascript
const pipe = (...fns) => (x) =>
  fns.reduce((acc, fn) => fn(acc), x);

const trim = (s) => s.trim();
const lower = (s) => s.toLowerCase();
const removeSpaces = (s) => s.replace(/\s+/g, '');

// pipe(trim, lower, removeSpaces)("  Hello World  ")
// = "helloworld"
const normalize = pipe(trim, lower, removeSpaces);
normalize("  Hello World  "); // "helloworld"
```

### 示例 9: 实际应用场景 - 数据处理管道
```javascript
const users = [
  { name: "alice", age: 25, active: true },
  { name: "bob", age: 17, active: true },
  { name: "charlie", age: 30, active: false }
];

const filterActive = (arr) => arr.filter(u => u.active);
const filterAdults = (arr) => arr.filter(u => u.age >= 18);
const getNames = (arr) => arr.map(u => u.name.toUpperCase());

const getActiveAdultNames = pipe(
  filterActive,
  filterAdults,
  getNames
);

getActiveAdultNames(users); // ["ALICE"]
```

---

## 四、柯里化 (Currying)

柯里化：将多参数函数转换为一系列单参数函数。

### 示例 10: 基础柯里化
```javascript
// 普通函数
const add = (a, b, c) => a + b + c;
add(1, 2, 3); // 6

// 柯里化版本
const curriedAdd = (a) => (b) => (c) => a + b + c;
curriedAdd(1)(2)(3); // 6
curriedAdd(1)(2);    // 返回函数等待 c
```

### 示例 11: 通用柯里化工具
```javascript
const curry = (fn) => {
  const curried = (...args) => {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...more) => curried(...args, ...more);
  };
  return curried;
};

const multiply = (a, b, c) => a * b * c;
const curriedMultiply = curry(multiply);

curriedMultiply(2)(3)(4);  // 24
curriedMultiply(2, 3)(4);  // 24
curriedMultiply(2)(3, 4);  // 24
```

### 示例 12: 柯里化的实际应用 - 配置化函数
```javascript
// 柯里化的 API 请求工厂
const createApiClient = (baseUrl) => (endpoint) => (params) =>
  `${baseUrl}/${endpoint}?${new URLSearchParams(params)}`;

const api = createApiClient("https://api.example.com");
const usersApi = api("users");

usersApi({ page: 1, limit: 10 });
// "https://api.example.com/users?page=1&limit=10"

const productsApi = api("products");
productsApi({ category: "electronics" });
// "https://api.example.com/products?category=electronics"
```

---

## 五、综合实战示例

### 示例 13: 函数式数据处理
```javascript
// 纯函数 + 不可变 + 组合
const R = {
  map: (fn, arr) => arr.map(fn),
  filter: (fn, arr) => arr.filter(fn),
  reduce: (fn, init, arr) => arr.reduce(fn, init),
  compose: (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x)
};

const transactions = [
  { amount: 100, type: "income" },
  { amount: 50, type: "expense" },
  { amount: 200, type: "income" },
  { amount: 30, type: "expense" }
];

const isIncomes = (t) => t.type === "income";
const getAmount = (t) => t.amount;
const sum = (a, b) => a + b;

const totalIncome = R.compose(
  (amounts) => R.reduce(sum, 0, amounts),
  (arr) => R.map(getAmount, arr),
  (arr) => R.filter(isIncomes, arr)
);

totalIncome(transactions); // 300
```

### 示例 14: 柯里化 + 组合 - 验证管道
```javascript
const isNotEmpty = (s) => s.length > 0;
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isLongEnough = (min) => (s) => s.length >= min;

const validate = curry((minLength, email) =>
  pipe(
    (e) => isNotEmpty(e) && isEmail(e) && isLongEnough(minLength)(e),
    (valid) => valid ? { ok: true, value: email } : { ok: false, error: "Invalid" }
  )(email)
);

const validateEmail = validate(5);
validateEmail("test@example.com"); // { ok: true, value: "test@example.com" }
validateEmail("ab");               // { ok: false, error: "Invalid" }
```

### 示例 15: 不可变状态管理
```javascript
// 简单的不可变状态管理器
const createState = (initial) => {
  let state = initial;
  return {
    getState: () => state,
    setState: (newState) => {
      state = { ...state, ...newState }; // 不可变更新
      return state;
    }
  };
};

const store = createState({ count: 0, user: null });
store.setState({ count: 1 });
store.setState({ user: { name: "Alice" } });
// 每次返回新对象
```

---

## 六、核心概念总结

| 概念 | 核心思想 | 好处 |
|------|----------|------|
| 纯函数 | 同输入=同输出，无副作用 | 可预测、易测试、可缓存 |
| 不可变性 | 数据创建后不可修改 | 避免意外变更、线程安全 |
| 函数组合 | 小函数组合成大功能 | 代码复用、清晰管道 |
| 柯里化 | 多参转单参链式调用 | 部分应用、函数复用 |

---

## 七、练习建议

1. **日常重构**: 将现有代码中的可变操作改为不可变
2. **工具函数**: 用纯函数重写常用工具函数
3. **管道思维**: 用 compose/pipe 重构嵌套调用
4. **柯里化实践**: 将配置参数柯里化，创建专用函数

---

**训练完成时间:** 06:00  
**示例数量:** 15 个 (超额完成 10+ 目标)  
**下次训练:** 明日 06:00
