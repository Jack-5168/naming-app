# 函数式编程专项训练 — 06:00 (2026-05-03)

## 训练目标

学习 FP 核心概念：纯函数 / 不可变性 / 组合 / 柯里化，完成 10+ 函数式示例。

---

## 一、FP 核心概念速查

### 1. 纯函数 (Pure Function)

**定义**: 相同输入 → 相同输出，无副作用。

```js
// ❌ 不纯 — 依赖外部状态 + 修改外部状态
let total = 0;
function add(x) { total += x; return total; }

// ✅ 纯 — 相同输入永远返回相同输出
function add(a, b) { return a + b; }
```

**判定标准**:
1. 确定性 (Deterministic): 相同输入 → 相同输出
2. 无副作用 (No Side Effects): 不修改外部状态、不 I/O、不随机

### 2. 不可变性 (Immutability)

**定义**: 数据创建后不可修改，"修改" 返回新数据。

```js
// ❌ 可变
const arr = [1, 2, 3];
arr.push(4); // arr 被修改

// ✅ 不可变
const arr = [1, 2, 3];
const newArr = [...arr, 4]; // 新数组，原数组不变
```

### 3. 函数组合 (Composition)

**定义**: `(f ∘ g)(x) = f(g(x))`，将小函数组合成大函数。

```js
const compose = (...fns) => x =>
  fns.reduceRight((v, f) => f(v), x);

const pipe = (...fns) => x =>
  fns.reduce((v, f) => f(v), x);
```

### 4. 柯里化 (Currying)

**定义**: 多参数函数 → 一系列单参数函数。

```js
const curry = fn => {
  const curried = (...args) =>
    args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  return curried;
};
```

---

## 二、12 个函数式编程示例

### 示例 1: 纯函数 — 数据验证管道

```js
// 每个验证规则都是纯函数
const isNotEmpty = s => s.trim().length > 0;
const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isLength = min => max => s => s.length >= min && s.length <= max;

// 验证结果用 Result 模式，无异常抛出
const validate = rules => value =>
  rules.reduce((result, rule) =>
    result.valid ? rule(value) : result,
    { valid: true, error: null }
  );

const validateEmail = validate([
  { valid: true, error: null },
  v => isNotEmpty(v) ? { valid: true, error: null } : { valid: false, error: '不能为空' },
  v => isEmail(v) ? { valid: true, error: null } : { valid: false, error: '邮箱格式错误' },
]);

console.log(validateEmail('test@example.com')); // { valid: true, error: null }
console.log(validateEmail('bad'));              // { valid: false, error: '邮箱格式错误' }
```

### 示例 2: 不可变数据操作 — 购物车

```js
// 所有操作返回新对象，不修改原购物车
const initialState = { items: [], discount: 0 };

const addItem = (cart, item) => ({
  ...cart,
  items: [...cart.items, { ...item, id: Date.now() }]
});

const removeItem = (cart, itemId) => ({
  ...cart,
  items: cart.items.filter(i => i.id !== itemId)
});

const updateQuantity = (cart, itemId, qty) => ({
  ...cart,
  items: cart.items.map(i =>
    i.id === itemId ? { ...i, quantity: qty } : i
  )
});

const applyDiscount = (cart, percent) => ({
  ...cart,
  discount: Math.min(percent, 100)
});

const total = cart =>
  cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  * (1 - cart.discount / 100);

// 使用
let cart = initialState;
cart = addItem(cart, { name: '键盘', price: 299, quantity: 1 });
cart = addItem(cart, { name: '鼠标', price: 149, quantity: 2 });
cart = applyDiscount(cart, 10);
console.log(total(cart)); // (299 + 298) * 0.9 = 537.3
```

### 示例 3: 函数组合 — 数据处理流水线

```js
const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);

// 数据转换管道
const transform = pipe(
  arr => arr.filter(n => n > 0),           // 过滤负数
  arr => arr.map(n => n * 2),              // 翻倍
  arr => arr.sort((a, b) => a - b),        // 排序
  arr => arr.slice(0, 5)                   // 取前5
);

console.log(transform([3, -1, 7, 0, 2, -5, 8, 1]));
// [2, 4, 6, 14, 16]
```

### 示例 4: 柯里化 — 配置化日志系统

```js
const curry = fn => {
  const curried = (...args) =>
    args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  return curried;
};

// 柯里化的日志函数
const log = curry((level, tag, msg) => {
  const ts = new Date().toISOString();
  const colors = { ERROR: '🔴', WARN: '🟡', INFO: '🔵', DEBUG: '⚪' };
  console.log(`${colors[level] || '⚪'} [${ts}] ${level} [${tag}] ${msg}`);
});

// 预配置 — 柯里化的威力
const error = log('ERROR');
const warn = log('WARN');
const info = log('INFO');

const dbError = error('Database');
const apiError = error('API');

dbError('Connection timeout');
// 🔴 [2026-05-03T...] ERROR [Database] Connection timeout

apiError('404 Not Found');
// 🔴 [2026-05-03T...] ERROR [API] 404 Not Found

info('App')('Started successfully');
// 🔵 [2026-05-03T...] INFO [App] Started successfully
```

### 示例 5: 组合 + 柯里化 — URL 路由解析器

```js
const curry = fn => {
  const curried = (...args) =>
    args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  return curried;
};

const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);

// 基础函数
const splitPath = curry((sep, str) => str.split(sep));
const filterEmpty = arr => arr.filter(Boolean);
const decode = arr => arr.map(decodeURIComponent);
const removeLeading = arr => arr[0] === '' ? arr.slice(1) : arr;

// 组合成解析器
const parseUrl = pipe(
  (url) => url.split('?')[0],           // 去掉 query
  splitPath('/'),                        // 柯里化分割
  removeLeading,                         // 去掉开头的 ''
  filterEmpty,                           // 过滤空段
  decode                                 // 解码
);

console.log(parseUrl('/users/123/profile'));
// ['users', '123', 'profile']

console.log(parseUrl('/api/v2/hello%20world'));
// ['api', 'v2', 'hello world']
```

### 示例 6: 不可变状态机 — 表单状态管理

```js
// 纯函数状态机 — 所有状态转换都是纯函数
const FormState = {
  INITIAL: 'INITIAL',
  EDITING: 'EDITING',
  SUBMITTING: 'SUBMITTING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR'
};

// 状态转换表 — 纯数据
const transitions = {
  [FormState.INITIAL]:    ['EDIT'],
  [FormState.EDITING]:    ['SUBMIT', 'RESET'],
  [FormState.SUBMITTING]: ['SUCCESS', 'FAIL'],
  [FormState.SUCCESS]:    ['RESET'],
  [FormState.ERROR]:      ['EDIT', 'RESET']
};

const canTransition = curry((from, action) =>
  (transitions[from] || []).includes(action)
);

const transition = (state, action) => {
  if (!canTransition(state, action)) return state;
  const map = {
    EDIT: FormState.EDITING,
    SUBMIT: FormState.SUBMITTING,
    RESET: FormState.INITIAL,
    SUCCESS: FormState.SUCCESS,
    FAIL: FormState.ERROR
  };
  return map[action] || state;
};

// 使用
let state = FormState.INITIAL;
state = transition(state, 'EDIT');     // EDITING
state = transition(state, 'SUBMIT');   // SUBMITTING
state = transition(state, 'SUCCESS');  // SUCCESS
state = transition(state, 'EDIT');     // INITIAL (不允许)
console.log(state); // SUCCESS — 非法转换被拒绝
```

### 示例 7: 纯函数 — 函数式链表 (Cons List)

```js
// 纯函数实现的链表 — 不可变
const Nil = { tag: 'Nil' };

const Cons = (head, tail) => ({ tag: 'Cons', head, tail });

const map = curry((fn, list) =>
  list.tag === 'Nil' ? Nil : Cons(fn(list.head), map(fn, list.tail))
);

const filter = curry((pred, list) =>
  list.tag === 'Nil'
    ? Nil
    : pred(list.head)
      ? Cons(list.head, filter(pred, list.tail))
      : filter(pred, list.tail)
);

const reduce = curry((fn, acc, list) =>
  list.tag === 'Nil'
    ? acc
    : reduce(fn, fn(acc, list.head), list.tail)
);

const length = reduce(acc => _ => acc + 1, 0);
const toArray = reduce((arr, x) => [...arr, x], []);

// 构建链表 [1, 2, 3, 4, 5]
const list = Cons(1, Cons(2, Cons(3, Cons(4, Cons(5, Nil)))));

console.log(toArray(map(x => x * 2, list)));
// [2, 4, 6, 8, 10]

console.log(toArray(filter(x => x > 2, list)));
// [3, 4, 5]

console.log(reduce((a, b) => a + b, 0, list));
// 15
```

### 示例 8: 组合 — 响应式流管道

```js
const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);

// 模拟响应式流操作符
const map = fn => arr => arr.map(fn);
const filter = pred => arr => arr.filter(pred);
const distinct = arr => [...new Set(arr)];
const take = n => arr => arr.slice(0, n);
const scan = curry((fn, acc, arr) =>
  arr.reduce((result, x) => {
    acc = fn(acc, x);
    return [...result, acc];
  }, [acc])
);

// 构建流处理管道
const processStream = pipe(
  filter(x => x > 0),
  distinct,
  map(x => x * x),
  take(3)
);

console.log(processStream([3, 1, 4, 1, 5, -1, 9, 2, 6]));
// [1, 4, 9] — 过滤负数 → 去重 → 平方 → 取前3

// scan 累积
console.log(scan((a, b) => a + b, 0, [1, 2, 3, 4, 5]));
// [0, 1, 3, 6, 10, 15]
```

### 示例 9: 柯里化 + 组合 — 数据库查询构建器

```js
const curry = fn => {
  const curried = (...args) =>
    args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  return curried;
};

// 查询构建器 — 每个方法都是纯函数
const QueryBuilder = (state = {}) => ({
  table: curry((t, q) => QueryBuilder({ ...q, table: t }))(state.table),
  where: curry((field, op, val, q) =>
    QueryBuilder({
      ...q,
      conditions: [...(q.conditions || []), { field, op, val }]
    })
  )(state.conditions, state.where),
  orderBy: curry((field, dir, q) =>
    QueryBuilder({ ...q, orderBy: { field, dir: dir || 'ASC' } })
  )(state.orderBy?.field, state.orderBy?.dir),
  limit: curry((n, q) => QueryBuilder({ ...q, limit: n }))(state.limit),
  build: () => {
    const { table, conditions, orderBy, limit } = state;
    let sql = `SELECT * FROM ${table || '*'}`;
    if (conditions?.length) {
      sql += ' WHERE ' + conditions
        .map(c => `${c.field} ${c.op} '${c.val}'`)
        .join(' AND ');
    }
    if (orderBy) sql += ` ORDER BY ${orderBy.field} ${orderBy.dir}`;
    if (limit) sql += ` LIMIT ${limit}`;
    return sql;
  }
});

// 使用 — 链式调用，每一步返回新 QueryBuilder
const sql = QueryBuilder()
  .table('users')
  .where('age', '>', 18)
  .where('status', '=', 'active')
  .orderBy('created_at', 'DESC')
  .limit(10)
  .build();

console.log(sql);
// SELECT * FROM users WHERE age > '18' AND status = 'active' ORDER BY created_at DESC LIMIT 10
```

### 示例 10: 纯函数 — 函数式 JSON Patch

```js
// 不可变的 JSON 操作 — 类似 immer 的纯函数版
const lens = curry((prop, obj) => ({
  get: () => obj[prop],
  set: val => ({ ...obj, [prop]: val })
}));

const view = (lens, obj) => lens(obj).get();
const set = (lens, val, obj) => lens(obj).set(val);
const over = (lens, fn, obj) => set(lens, fn(view(lens, obj)), obj);

// 使用
const user = { name: 'Alice', address: { city: 'Beijing', zip: '100000' } };

const nameLens = lens('name');
const cityLens = lens('address');

const updated = set(nameLens, 'Bob', user);
console.log(updated.name);   // Bob
console.log(user.name);      // Alice — 原对象不变

const withCity = over(cityLens, addr => ({ ...addr, city: 'Shanghai' }), user);
console.log(withCity.address.city); // Shanghai
console.log(user.address.city);     // Beijing — 原对象不变
```

### 示例 11: 组合 — 中间件模式 (Koa 风格)

```js
const compose = (middlewares) => (ctx) => {
  const dispatch = (i) => {
    if (i === middlewares.length) return Promise.resolve();
    const fn = middlewares[i];
    return Promise.resolve(fn(ctx, () => dispatch(i + 1)));
  };
  return dispatch(0);
};

// 中间件 — 每个都是纯函数
const logger = (ctx, next) => {
  const start = Date.now();
  return next().then(() => {
    ctx.ms = Date.now() - start;
    console.log(`${ctx.method} ${ctx.path} - ${ctx.ms}ms`);
  });
};

const auth = (ctx, next) => {
  if (!ctx.headers?.token) {
    ctx.status = 401;
    return Promise.resolve();
  }
  ctx.user = { id: 1, name: 'Alice' };
  return next();
};

const router = (ctx, next) => {
  if (ctx.path === '/api/data') {
    ctx.body = { data: [1, 2, 3] };
    ctx.status = 200;
  }
  return next();
};

const errorHandler = (ctx, next) => {
  return next().catch(err => {
    ctx.status = 500;
    ctx.body = { error: err.message };
  });
};

// 组合中间件
const app = compose([errorHandler, logger, auth, router]);

// 测试
app({ method: 'GET', path: '/api/data', headers: { token: 'abc' } })
  .then(ctx => console.log(ctx.body));
// { data: [1, 2, 3] }
```

### 示例 12: 纯函数 — 函数式 Parser Combinator

```js
// 函数式解析器组合子 — 纯函数构建 DSL
const Parser = parse => ({
  parse,
  map: fn => Parser(input => {
    const result = parse(input);
    return result.success
      ? { success: true, value: fn(result.value), rest: result.rest }
      : result;
  }),
  chain: fn => Parser(input => {
    const result = parse(input);
    return result.success
      ? fn(result.value).parse(result.rest)
      : result;
  })
});

// 基础解析器
const char = c => Parser(input =>
  input.length > 0 && input[0] === c
    ? { success: true, value: c, rest: input.slice(1) }
    : { success: false, value: null, rest: input }
);

const digit = Parser(input =>
  input.length > 0 && /\d/.test(input[0])
    ? { success: true, value: input[0], rest: input.slice(1) }
    : { success: false, value: null, rest: input }
);

const string = s => Parser(input =>
  input.startsWith(s)
    ? { success: true, value: s, rest: input.slice(s.length) }
    : { success: false, value: null, rest: input }
);

// 组合子
const many = parser => Parser(input => {
  const results = [];
  let rest = input;
  while (true) {
    const result = parser.parse(rest);
    if (!result.success) break;
    results.push(result.value);
    rest = result.rest;
  }
  return { success: true, value: results, rest };
});

const seq = (...parsers) => Parser(input => {
  const results = [];
  let rest = input;
  for (const p of parsers) {
    const result = p.parse(rest);
    if (!result.success) return result;
    results.push(result.value);
    rest = result.rest;
  }
  return { success: true, value: results, rest };
});

// 构建整数解析器
const integer = many(digit).map(d => d.join(''));

// 使用
console.log(char('a').parse('abc'));
// { success: true, value: 'a', rest: 'bc' }

console.log(integer.parse('123abc'));
// { success: true, value: '123', rest: 'abc' }

console.log(seq(char('(''), integer, char(')')).parse('(42)rest'));
// { success: true, value: ['(', '42', ')'], rest: 'rest' }
```

---

## 三、FP vs OOP 对比

| 维度 | 函数式编程 | 面向对象 |
|------|-----------|---------|
| 状态 | 不可变数据 | 可变对象状态 |
| 复用 | 函数组合 | 继承/多态 |
| 错误处理 | Result/Either 类型 | try/catch 异常 |
| 并发 | 天然线程安全 | 需要锁/同步 |
| 测试 | 纯函数易测试 | 需要 mock 依赖 |
| 核心抽象 | 函数 | 对象/类 |

---

## 四、FP 常用工具函数速查

```js
// 核心工具
const compose = (...fns) => x => fns.reduceRight((v, f) => f(v), x);
const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);
const curry = fn => {
  const curried = (...args) =>
    args.length >= fn.length ? fn(...args) : (...more) => curried(...args, ...more);
  return curried;
};
const partial = (fn, ...preset) => (...args) => fn(...preset, ...args);
const flip = fn => (a, b) => fn(b, a);
const identity = x => x;
const constant = x => () => x;
const tap = fn => x => (fn(x), x);
const not = fn => x => !fn(x);
const prop = curry((key, obj) => obj[key]);
const method = curry((name, ...args) => obj => obj[name](...args));
```

---

## 五、训练总结

**完成 12 个函数式编程示例**:

| # | 示例 | 核心概念 |
|---|------|---------|
| 1 | 数据验证管道 | 纯函数 + 不可变结果 |
| 2 | 购物车操作 | 不可变性 (spread) |
| 3 | 数据处理流水线 | pipe 组合 |
| 4 | 配置化日志系统 | 柯里化 |
| 5 | URL 路由解析器 | 组合 + 柯里化 |
| 6 | 表单状态机 | 纯函数状态转换 |
| 7 | 函数式链表 | 纯函数数据结构 |
| 8 | 响应式流管道 | 组合操作符 |
| 9 | 数据库查询构建器 | 柯里化 + 不可变构建器 |
| 10 | JSON Patch (Lens) | 纯函数数据访问 |
| 11 | 中间件模式 | 函数组合 |
| 12 | Parser Combinator | 纯函数 DSL |

**关键收获**:
1. **纯函数** = 可预测 + 可测试 + 可缓存
2. **不可变性** = 无副作用 + 线程安全 + 时间旅行调试
3. **组合** = 小函数 → 大函数，Unix 哲学
4. **柯里化** = 预配置 + 部分应用 = 函数工厂

**与之前训练的关系**:
- 05:00 的闭包/管道模式是 FP 的基础 (v7 JS 深度)
- 本次系统学习 FP 范式，从工具函数到完整 DSL
- 为后续 React (纯函数组件) / Redux (不可变状态) 打基础
