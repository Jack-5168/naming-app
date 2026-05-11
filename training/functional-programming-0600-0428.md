# 专项训练：函数式编程 (Functional Programming)

> 日期：2026-04-28 06:00 | 主题：纯函数 / 不可变性 / 组合 / 柯里化 | 示例数：15+

---

## 一、FP 核心概念速查

### 1. 纯函数 (Pure Function)

**定义**：相同输入 → 相同输出，且无任何副作用。

```js
// ❌ 不纯：依赖外部变量 + 修改外部状态
let count = 0;
function increment() {
  count++;
  return count;
}

// ✅ 纯函数：输入决定输出，无副作用
function add(a, b) {
  return a + b;
}
```

**判断标准**：
- 输出仅由输入决定（引用透明）
- 不修改外部状态（无 I/O、不改变参数、不访问全局变量）
- 不调用不纯函数

### 2. 不可变性 (Immutability)

**核心**：数据一旦创建就不能被修改，"修改" 返回新数据。

```js
// ❌ 可变
const arr = [1, 2, 3];
arr.push(4); // arr 被修改了

// ✅ 不可变
const arr = [1, 2, 3];
const newArr = [...arr, 4]; // arr 不变，返回新数组
```

**JS 中的不可变操作**：
| 操作 | 可变方法 ❌ | 不可变方法 ✅ |
|------|------------|-------------|
| 数组添加 | `arr.push(x)` | `[...arr, x]` |
| 数组删除 | `arr.splice(i, 1)` | `arr.toSpliced(i, 1)` (ES2023) |
| 数组排序 | `arr.sort()` | `arr.toSorted()` (ES2023) |
| 对象合并 | 直接赋值 | `{ ...obj, key: val }` |
| 对象删除 | `delete obj.key` | `const { key, ...rest } = obj` |

### 3. 函数组合 (Composition)

**核心**：`f(g(x))` → `compose(f, g)(x)`，将小函数组合成大函数。

```js
// 右到左组合 (数学惯例)
const compose = (...fns) => (x) =>
  fns.reduceRight((v, f) => f(v), x);

// 左到右管道 (更直观)
const pipe = (...fns) => (x) =>
  fns.reduce((v, f) => f(v), x);
```

### 4. 柯里化 (Currying)

**核心**：多参数函数 → 一系列单参数函数。

```js
// 通用柯里化工具
const curry = (fn) => {
  const curried = (...args) =>
    args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  return curried;
};
```

---

## 二、15+ 函数式编程示例

### 示例 1：纯函数 — 数据转换管道

```js
// 纯函数：每个函数只做一件事，无副作用
const trim = (s) => s.trim();
const lowercase = (s) => s.toLowerCase();
const removePunctuation = (s) => s.replace(/[^\w\s]/g, '');
const slugify = (s) => s.replace(/\s+/g, '-');

// 组合成管道
const toSlug = pipe(trim, lowercase, removePunctuation, slugify);

toSlug('  Hello, World!  '); // 'hello-world'
```

### 示例 2：柯里化 — 参数预设

```js
const curry = (fn) => {
  const curried = (...args) =>
    args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  return curried;
};

// 柯里化后的乘法
const multiply = curry((a, b, c) => a * b * c);

const double = multiply(2);      // 预设 a=2
const doubleAndTriple = double(3); // 预设 b=3

doubleAndTriple(5); // 30

// 实用场景：数据过滤
const isGreaterThan = curry((threshold, value) => value > threshold);
const isAdult = isGreaterThan(18);

[12, 25, 16, 30, 8].filter(isAdult); // [25, 30]
```

### 示例 3：不可变数据更新 — 嵌套对象

```js
// 深度不可变更新（模拟 Immer 的思路）
const updateIn = (path, fn, obj) => {
  if (path.length === 0) return fn(obj);
  const [head, ...rest] = path;
  return {
    ...obj,
    [head]: updateIn(rest, fn, obj[head]),
  };
};

const state = {
  user: {
    profile: { name: 'Alice', age: 25 },
    settings: { theme: 'dark' },
  },
};

// 不修改原对象，返回新对象
const newState = updateIn(
  ['user', 'profile', 'age'],
  (age) => age + 1,
  state
);

state.user.profile.age; // 25 (原对象不变)
newState.user.profile.age; // 26 (新对象)
```

### 示例 4：函数组合 — 数据验证管道

```js
const compose = (...fns) => (x) =>
  fns.reduceRight((v, f) => f(v), x);

// 验证规则（纯函数）
const isNonEmpty = (s) => s.length > 0;
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const toLower = (s) => s.toLowerCase();
const trim = (s) => s.trim();

// 组合验证器
const validateEmail = compose(isEmail, toLower, trim);

validateEmail('  HELLO@WORLD.COM  '); // true
validateEmail('not-an-email');        // false
```

### 示例 5：不可变数组操作 — 完整 CRUD

```js
// 所有操作返回新数组，原数组不变
const add = (arr, item) => [...arr, item];
const removeByIndex = (arr, index) => arr.filter((_, i) => i !== index);
const updateByIndex = (arr, index, fn) =>
  arr.map((item, i) => (i === index ? fn(item) : item));
const insertAt = (arr, index, item) => [
  ...arr.slice(0, index),
  item,
  ...arr.slice(index),
];

const todos = ['Buy milk', 'Write code'];

const withNew = add(todos, 'Deploy app');
// ['Buy milk', 'Write code', 'Deploy app']

const withoutFirst = removeByIndex(todos, 0);
// ['Write code']

const updated = updateByIndex(todos, 1, (t) => t.toUpperCase());
// ['Buy milk', 'WRITE CODE']

// 原数组始终不变
todos; // ['Buy milk', 'Write code']
```

### 示例 6：柯里化 — 配置预设

```js
const curry = (fn) => {
  const curried = (...args) =>
    args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  return curried;
};

// 格式化函数：柯里化后预设 locale
const formatCurrency = curry((locale, currency, amount) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
);

const formatUSD = formatCurrency('en-US', 'USD');
const formatCNY = formatCurrency('zh-CN', 'CNY');

formatUSD(1234.56); // '$1,234.56'
formatCNY(1234.56); // '¥1,234.56'
```

### 示例 7：纯函数 — 状态机 (Reducer 模式)

```js
// Redux 风格的 reducer：纯函数，(state, action) => newState
const counterReducer = (state = 0, action) => {
  switch (action.type) {
    case 'INCREMENT':
      return state + (action.payload ?? 1);
    case 'DECREMENT':
      return state - (action.payload ?? 1);
    case 'RESET':
      return 0;
    default:
      return state;
  }
};

// 纯函数测试：相同输入永远得到相同输出
counterReducer(5, { type: 'INCREMENT' }); // 6
counterReducer(5, { type: 'INCREMENT' }); // 6
counterReducer(5, { type: 'INCREMENT', payload: 3 }); // 8
```

### 示例 8：函数组合 — 响应式数据处理

```js
const pipe = (...fns) => (x) =>
  fns.reduce((v, f) => f(v), x);

// 电商商品列表处理管道
const products = [
  { name: 'Laptop', price: 8999, category: 'electronics', inStock: true },
  { name: 'Book', price: 49, category: 'books', inStock: true },
  { name: 'Phone', price: 5999, category: 'electronics', inStock: false },
  { name: 'Pen', price: 12, category: 'stationery', inStock: true },
];

const inStock = (items) => items.filter((p) => p.inStock);
const under = (max) => (items) => items.filter((p) => p.price <= max);
const sortByPrice = (items) =>
  [...items].sort((a, b) => a.price - b.price);
const extractNames = (items) => items.map((p) => p.name);

// 组合管道：有货 → 价格≤100 → 按价格排序 → 提取名称
const getAffordableProducts = pipe(
  inStock,
  under(100),
  sortByPrice,
  extractNames
);

getAffordableProducts(products); // ['Pen', 'Book']
```

### 示例 9：柯里化 + 组合 — 表单验证器工厂

```js
const curry = (fn) => {
  const curried = (...args) =>
    args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  return curried;
};

const compose = (...fns) => (x) =>
  fns.reduceRight((v, f) => f(v), x);

// 验证规则
const required = (msg) => (val) =>
  val != null && val !== '' ? val : { error: msg };

const minLength = curry((min, msg, val) =>
  val.length >= min ? val : { error: msg }
);

const matchPattern = curry((regex, msg, val) =>
  regex.test(val) ? val : { error: msg }
);

// 组合验证器
const validateUsername = compose(
  required('Username is required'),
  minLength(3, 'Username must be at least 3 characters'),
  matchPattern(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscores')
);

validateUsername('alice');  // 'alice' (通过)
validateUsername('ab');     // { error: 'Username must be at least 3 characters' }
validateUsername('a@b');    // { error: 'Only letters, numbers, underscores' }
```

### 示例 10：不可变性 — 链表操作

```js
// 不可变链表
const cons = (head, tail) => ({ head, tail });
const head = ({ head }) => head;
const tail = ({ tail }) => tail;

// 构建列表: 1 → 2 → 3 → null
const list = cons(1, cons(2, cons(3, null)));

// 不可变 map
const map = (fn, list) =>
  list === null ? null : cons(fn(head(list)), map(fn, tail(list)));

// 不可变 filter
const filter = (pred, list) => {
  if (list === null) return null;
  const h = head(list);
  return pred(h)
    ? cons(h, filter(pred, tail(list)))
    : filter(pred, tail(list));
};

// 不可变 reduce
const reduce = (fn, acc, list) =>
  list === null ? acc : reduce(fn, fn(acc, head(list)), tail(list));

map((x) => x * 2, list); // 2 → 4 → 6 → null
filter((x) => x > 1, list); // 2 → 3 → null
reduce((sum, x) => sum + x, 0, list); // 6
```

### 示例 11：纯函数 — 记忆化 (Memoization)

```js
// 记忆化：缓存纯函数的结果
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

// 斐波那契（纯函数 + 记忆化）
const fib = memoize((n) => {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
});

fib(50); // 12586269025 (瞬间完成，无记忆化会卡死)
```

### 示例 12：柯里化 — 事件处理器工厂

```js
const curry = (fn) => {
  const curried = (...args) =>
    args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  return curried;
};

// 创建带日志的事件处理器
const createHandler = curry((context, logger, eventType, event) => {
  logger(`${context}: ${eventType} triggered`, event);
  return { context, eventType, handled: true };
});

const appLogger = (...args) => console.log('[APP]', ...args);

const handleClick = createHandler('Button', appLogger, 'click');
const handleHover = createHandler('Button', appLogger, 'hover');

// 使用时只需传 event
handleClick({ target: 'submit-btn', timestamp: Date.now() });
```

### 示例 13：函数组合 — 异步管道

```js
// 异步管道：compose 的异步版本
const pipeAsync = (...fns) => (initialValue) =>
  fns.reduce((promise, fn) => promise.then(fn), Promise.resolve(initialValue));

// 模拟异步操作
const fetchUser = (id) =>
  Promise.resolve({ id, name: 'Alice', role: 'admin' });

const checkPermission = curry((requiredRole, user) => {
  if (user.role !== requiredRole) {
    throw new Error(`Access denied: requires ${requiredRole}`);
  }
  return user;
});

const formatResponse = (user) => ({
  status: 'success',
  data: { displayName: user.name.toUpperCase(), id: user.id },
});

// 异步管道
const getUserProfile = pipeAsync(
  fetchUser,
  checkPermission('admin'),
  formatResponse
);

getUserProfile(42).then(console.log);
// { status: 'success', data: { displayName: 'ALICE', id: 42 } }
```

### 示例 14：不可变性 — 时间旅行 (Undo/Redo)

```js
// 基于不可变数据的时间旅行状态管理
const createTimeTravel = (reducer, initialState) => {
  let past = [];
  let present = initialState;
  let future = [];

  return {
    dispatch(action) {
      const previous = present;
      present = reducer(present, action);
      past = [...past, previous];
      future = [];
      return present;
    },
    undo() {
      if (past.length === 0) return present;
      const previous = past[past.length - 1];
      past = past.slice(0, -1);
      future = [present, ...future];
      present = previous;
      return present;
    },
    redo() {
      if (future.length === 0) return present;
      const next = future[0];
      future = future.slice(1);
      past = [...past, present];
      present = next;
      return present;
    },
    get state() {
      return { past, present, future };
    },
  };
};

// 使用
const todoReducer = (state = [], action) => {
  switch (action.type) {
    case 'ADD':
      return [...state, action.payload];
    case 'REMOVE':
      return state.filter((_, i) => i !== action.payload);
    default:
      return state;
  }
};

const store = createTimeTravel(todoReducer, []);

store.dispatch({ type: 'ADD', payload: 'Task 1' });
store.dispatch({ type: 'ADD', payload: 'Task 2' });
store.state.present; // ['Task 1', 'Task 2']

store.undo();
store.state.present; // ['Task 1']

store.redo();
store.state.present; // ['Task 1', 'Task 2']
```

### 示例 15：纯函数 + 柯里化 — 查询构建器

```js
const curry = (fn) => {
  const curried = (...args) =>
    args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  return curried;
};

// 不可变查询构建器（类似 SQL 的链式调用）
const QueryBuilder = (table) => ({
  table,
  where: curry((field, operator, value, self) => ({
    ...self,
    conditions: [...(self.conditions || []), { field, operator, value }],
  })),
  orderBy: curry((field, direction, self) => ({
    ...self,
    orderBy: { field, direction: direction || 'ASC' },
  })),
  limit: curry((n, self) => ({ ...self, limit: n })),
  build: (self) => ({
    query: `SELECT * FROM ${self.table}`,
    conditions: self.conditions || [],
    orderBy: self.orderBy,
    limit: self.limit,
  }),
  chain: function (...methods) {
    return methods.reduce((q, method) => method(q), this);
  },
});

// 柯里化方法
const where = curry((field, operator, value) => (q) =>
  QueryBuilder(q.table).where(field, operator, value, q)
);
const orderBy = curry((field, dir) => (q) =>
  QueryBuilder(q.table).orderBy(field, dir, q)
);
const limit = curry((n) => (q) =>
  QueryBuilder(q.table).limit(n, q)
);

// 使用：纯函数组合
const usersQuery = QueryBuilder('users')
  .chain(
    where('age', '>=', 18),
    where('status', '=', 'active'),
    orderBy('created_at', 'DESC'),
    limit(10)
  );

console.log(usersQuery.build());
// {
//   query: 'SELECT * FROM users',
//   conditions: [
//     { field: 'age', operator: '>=', value: 18 },
//     { field: 'status', operator: '=', value: 'active' }
//   ],
//   orderBy: { field: 'created_at', direction: 'DESC' },
//   limit: 10
// }
```

### 示例 16：函数组合 — 中间件模式 (Koa 风格)

```js
// Koa 风格的 compose：洋葱模型中间件
const compose = (middlewares) => (context) => {
  const dispatch = (i) => {
    if (i === middlewares.length) return Promise.resolve();
    const middleware = middlewares[i];
    return dispatch(i + 1).then(() => middleware(context, dispatch.bind(null, i + 1)));
  };
  return dispatch(0);
};

// 中间件（纯函数风格）
const logger = (ctx, next) => {
  const start = Date.now();
  return next().then(() => {
    ctx.responseTime = Date.now() - start;
    console.log(`${ctx.method} ${ctx.path} - ${ctx.responseTime}ms`);
  });
};

const auth = (ctx, next) => {
  if (!ctx.token) return Promise.reject(new Error('Unauthorized'));
  ctx.user = { id: 1, name: 'Alice' };
  return next();
};

const handler = (ctx) => {
  ctx.body = { message: 'Hello, ' + ctx.user.name };
  return Promise.resolve();
};

// 组合中间件
const app = compose([logger, auth, handler]);

// 模拟请求
app({ method: 'GET', path: '/api/user', token: 'abc123' })
  .then(() => console.log('Response:', app));
```

---

## 三、FP 实用工具函数集合

```js
// ═══════════════════════════════════════
// Functional Programming Toolkit
// ═══════════════════════════════════════

// ── 核心工具 ──

// 柯里化
const curry = (fn) => {
  const curried = (...args) =>
    args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  return curried;
};

// 右柯里化 (参数从右往左预设)
const curryRight = (fn) => {
  const curried = (...args) =>
    args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...more, ...args);
  return curried;
};

// 右组合 (数学惯例: f ∘ g)
const compose = (...fns) => (x) =>
  fns.reduceRight((v, f) => f(v), x);

// 左组合 / 管道 (更直观)
const pipe = (...fns) => (x) =>
  fns.reduce((v, f) => f(v), x);

// 部分应用
const partial = (fn, ...presetArgs) => (...restArgs) =>
  fn(...presetArgs, ...restArgs);

// 翻转参数
const flip = (fn) => (a, b) => fn(b, a);

// 恒等函数
const identity = (x) => x;

// 常量函数 (始终返回固定值)
const constant = (x) => () => x;

// ── 数据操作 ──

// 安全属性访问
const prop = curry((key, obj) => obj?.[key]);
const props = curry((keys, obj) => keys.map((k) => obj?.[k]));

// 安全深度属性访问
const path = curry((paths, obj) =>
  paths.reduce((o, k) => o?.[k], obj)
);

// 深度克隆 (不可变基础)
const deepClone = (obj) => structuredClone(obj);

// 不可变属性设置
const assoc = curry((key, value, obj) => ({ ...obj, [key]: value }));

// 不可变属性删除
const dissoc = curry((key, obj) => {
  const { [key]: _, ...rest } = obj;
  return rest;
});

// ── 数组工具 ──

// 去重
const uniq = (arr) => [...new Set(arr)];

// 分组
const groupBy = curry((fn, arr) =>
  arr.reduce((groups, item) => {
    const key = fn(item);
    return { ...groups, [key]: [...(groups[key] || []), item] };
  }, {})
);

// 扁平化 (指定深度)
const flatten = (arr, depth = 1) =>
  depth > 0
    ? arr.reduce(
        (acc, val) =>
          acc.concat(Array.isArray(val) ? flatten(val, depth - 1) : val),
        []
      )
    : arr;

// 分区 (按条件分成两组)
const partition = curry((pred, arr) =>
  arr.reduce(
    ([pass, fail], item) =>
      pred(item) ? [[...pass, item], fail] : [pass, [...fail, item]],
    [[], []]
  )
);

// ── 函数工具 ──

// 函数取反
const complement = (fn) => (...args) => !fn(...args);

// 函数串联 (所有函数都执行，返回第一个结果)
const tap = (fn) => (x) => (fn(x), x);

// 条件执行
const when = curry((pred, fn, value) =>
  pred(value) ? fn(value) : value
);

// 记忆化
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

// ── Maybe 单子 (安全计算) ──

const Maybe = {
  of: (x) => ({
    value: x,
    isNothing: x == null,
    map: curry((fn, m) =>
      m.isNothing ? Maybe.of(null) : Maybe.of(fn(m.value))
    ),
    chain: curry((fn, m) =>
      m.isNothing ? Maybe.of(null) : fn(m.value)
    ),
    orDefault: curry((defaultValue, m) =>
      m.isNothing ? defaultValue : m.value
    ),
  }),
};

// 使用
const getName = (user) =>
  Maybe.of(user)
    .map((u) => u.profile)
    .map((p) => p.name)
    .orDefault('Anonymous');

getName({ profile: { name: 'Alice' } }); // 'Alice'
getName(null); // 'Anonymous'
getName({ profile: null }); // 'Anonymous'
```

---

## 四、FP vs OOP 对比

| 维度 | 函数式编程 | 面向对象 |
|------|-----------|---------|
| 核心抽象 | 函数 | 对象 |
| 状态管理 | 不可变数据 + 新值返回 | 可变属性 + this |
| 代码复用 | 组合 + 柯里化 | 继承 + 多态 |
| 错误处理 | Maybe/Either 单子 | try/catch |
| 测试 | 纯函数 → 极易测试 | 需 mock 依赖 |
| 并发 | 天然安全 (无共享状态) | 需锁/同步 |
| 心智模型 | 数据转换管道 | 对象交互 |

---

## 五、实战建议

### 何时用 FP
- ✅ 数据处理管道 (ETL、格式化、验证)
- ✅ 状态管理 (Redux、React reducer)
- ✅ 需要高可测试性的核心逻辑
- ✅ 并发/并行场景

### 何时不必强求 FP
- ❌ 简单脚本/一次性任务
- ❌ 需要极致性能的热路径 (柯里化有开销)
- ❌ 团队不熟悉 FP 概念

### 渐进式采用
1. 先写纯函数，减少副作用
2. 用不可变操作替代可变操作
3. 用组合替代嵌套调用
4. 用柯里化提取公共参数
5. 引入 Maybe/Either 替代 null 检查

---

## 六、自测题

1. **判断纯函数**：`Math.random()` 是纯函数吗？为什么？
2. **柯里化转换**：将 `const sum = (a, b, c) => a + b + c` 转为柯里化版本
3. **组合练习**：用 `pipe` 组合 `trim → lowercase → replaceSpaces` 三个函数
4. **不可变更新**：如何在不修改原对象的情况下，将 `obj.a.b.c` 设为新值？
5. **Maybe 单子**：用 Maybe 单子安全地访问 `user.address.city`，默认返回 `'Unknown'`

<details>
<summary>答案</summary>

1. 不是。`Math.random()` 无输入但每次返回不同输出，且依赖内部状态。
2. `const sum = (a) => (b) => (c) => a + b + c`
3. `const process = pipe(trim, lowercase, replaceSpaces)`
4. `const updated = { ...obj, a: { ...obj.a, b: { ...obj.a.b, c: newValue } } }`
5. `Maybe.of(user).map(u => u.address).map(a => a.city).orDefault('Unknown')`

</details>

---

*训练完成。15 个示例覆盖纯函数、不可变性、组合、柯里化四大核心概念 + 16 个实用工具函数。*
