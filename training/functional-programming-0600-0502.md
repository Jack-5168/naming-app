# 函数式编程 v8 — 高级模式与真实世界管道

> 日期: 2026-05-02 06:00
> 前置: 基础(4/23) → 巩固(4/24) → 进阶(4/26) → 实战(4/27) → 示例(4/29) → 核心(4/30)
> 本次主题: **FP 高级模式** — 类型安全管道 / 错误处理 Monad / 数据流变换 / 响应式 FP / 性能优化
> 目标: 12+ 高级示例，覆盖真实业务场景

---

## 一、纯函数进阶 — 确定性 & 引用透明

### 示例 1: 引用透明性验证框架

```typescript
/**
 * 引用透明 = 表达式可被其值替换而不改变程序行为。
 * 这是纯函数的核心属性，让我们构建一个验证工具。
 */

// 纯函数：引用透明
const pureAdd = (a: number, b: number): number => a + b;

// 不纯函数：非引用透明（依赖 Date.now）
const impureTimestamp = (): string => new Date().toISOString();

// 不纯函数：非引用透明（依赖 Math.random）
const impureId = (): string => Math.random().toString(36).slice(2);

// 引用透明验证器：多次调用相同输入，验证输出一致性
const verifyReferentialTransparency = <T, R>(
  fn: (...args: T[]) => R,
  testInputs: T[][],
  label: string
): { passed: number; failed: number; results: R[] } => {
  const results = testInputs.map(args => fn(...args));
  const first = results[0];
  const passed = results.filter(r => JSON.stringify(r) === JSON.stringify(first)).length;
  const failed = results.length - passed;

  console.log(`\n🔍 [${label}] 透明性验证:`);
  console.log(`  通过: ${passed}/${results.length}`);
  if (failed > 0) {
    console.log(`  ❌ 非引用透明 — 相同输入产生不同输出`);
    console.log(`  结果:`, results);
  }
  return { passed, failed, results };
};

// 验证纯函数
const pureResult = verifyReferentialTransparency(
  pureAdd,
  [[3, 4], [3, 4], [3, 4]],
  'pureAdd'
); // ✅ 3/3 通过

// 验证不纯函数
const impureResult = verifyReferentialTransparency(
  impureTimestamp,
  [[], [], []],
  'impureTimestamp'
); // ❌ 0/3 通过

// 将不纯函数"纯化" — 注入时间源
const pureTimestamp = (now: Date): string => now.toISOString();
const fixedDate = new Date('2026-05-02T06:00:00Z');
verifyReferentialTransparency(
  pureTimestamp,
  [[fixedDate], [fixedDate], [fixedDate]],
  'pureTimestamp'
); // ✅ 3/3 通过

console.log('\n✅ 示例1: 引用透明性验证完成');
```

### 示例 2: 纯函数组合 — 数据清洗管道

```typescript
/**
 * 真实场景：从外部 API 获取的脏数据 → 清洗 → 标准化 → 验证
 * 每个步骤都是纯函数，组合后形成可测试的管道
 */

// 原始脏数据
interface RawUser {
  name?: string | null;
  email?: string;
  age?: string | number | null;
  role?: string;
  tags?: string | string[];
}

interface CleanUser {
  name: string;
  email: string;
  age: number;
  role: 'admin' | 'user' | 'guest';
  tags: string[];
}

// 纯函数：每个转换步骤
const trim = (s: string): string => s.trim();
const lower = (s: string): string => s.toLowerCase();
const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const sanitizeName = (raw: string | null | undefined): string => {
  if (!raw) return 'Anonymous';
  return capitalize(trim(raw)).slice(0, 50);
};

const sanitizeEmail = (raw?: string): string => {
  if (!raw) return '';
  return lower(trim(raw)).replace(/[^\w@.+%-]/g, '');
};

const sanitizeAge = (raw?: string | number | null): number => {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : (raw ?? 0);
  return isNaN(n) || n < 0 || n > 150 ? 0 : n;
};

const sanitizeRole = (raw?: string): CleanUser['role'] => {
  const r = (raw || 'user').toLowerCase();
  return r === 'admin' ? 'admin' : r === 'guest' ? 'guest' : 'user';
};

const sanitizeTags = (raw?: string | string[]): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(trim).filter(Boolean);
  return raw.split(',').map(trim).filter(Boolean);
};

// 组合函数 — 通用 compose
const compose = <T>(...fns: Array<(x: any) => any>) =>
  (initial: T): any =>
    fns.reduceRight((acc, fn) => fn(acc), initial);

const pipe = <T>(...fns: Array<(x: any) => any>) =>
  (initial: T): any =>
    fns.reduce((acc, fn) => fn(acc), initial);

// 构建数据清洗管道
const cleanUser = (raw: RawUser): CleanUser => ({
  name: sanitizeName(raw.name),
  email: sanitizeEmail(raw.email),
  age: sanitizeAge(raw.age),
  role: sanitizeRole(raw.role),
  tags: sanitizeTags(raw.tags),
});

// 验证管道
const dirtyData: RawUser[] = [
  { name: '  john doe  ', email: 'JOHN@Example.COM', age: '25', role: 'Admin', tags: 'js,react' },
  { name: null, email: 'bad-email!', age: null, role: 'unknown', tags: undefined },
  { name: 'alice', email: 'alice@test.com', age: '200', role: 'guest', tags: ['python', 'ml'] },
];

const cleanUsers = dirtyData.map(cleanUser);
console.log('\n📊 示例2 - 数据清洗管道:');
cleanUsers.forEach((u, i) => console.log(`  ${i + 1}.`, u));
// 1. { name: 'John Doe', email: 'john@example.com', age: 25, role: 'admin', tags: ['js','react'] }
// 2. { name: 'Anonymous', email: 'bademail', age: 0, role: 'user', tags: [] }
// 3. { name: 'Alice', email: 'alice@test.com', age: 0, role: 'guest', tags: ['python','ml'] }

console.log('✅ 示例2: 数据清洗管道完成');
```

---

## 二、不可变性 — 结构共享与持久化数据结构

### 示例 3: 不可变更新工具集

```typescript
/**
 * 不可变性 ≠ 每次都深拷贝整个对象。
 * 结构共享 (structural sharing) 让不可变更新高效。
 */

// 不可变 set — 只创建受影响的路径
const immutableSet = <T extends object>(
  obj: T,
  path: string[],
  value: any
): T => {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  return {
    ...obj,
    [key]: rest.length === 0
      ? value
      : immutableSet((obj as any)[key] ?? {}, rest, value),
  };
};

// 不可变 delete
const immutableDelete = <T extends object>(obj: T, path: string[]): T => {
  if (path.length === 0) return obj;
  const [key, ...rest] = path;
  if (rest.length === 0) {
    const { [key]: _, ...restObj } = obj as any;
    return restObj;
  }
  return {
    ...obj,
    [key]: immutableDelete((obj as any)[key] ?? {}, rest),
  };
};

// 不可变 update (对指定路径的值应用函数)
const immutableUpdate = <T extends object>(
  obj: T,
  path: string[],
  fn: (val: any) => any
): T => {
  const current = path.reduce((o, k) => o?.[k], obj as any);
  return immutableSet(obj, path, fn(current));
};

// 使用示例
interface AppState {
  user: { name: string; settings: { theme: string; lang: string } };
  todos: { id: number; text: string; done: boolean }[];
  meta: { loading: boolean; page: number };
}

const state: AppState = {
  user: { name: 'Alice', settings: { theme: 'dark', lang: 'zh' } },
  todos: [{ id: 1, text: 'Learn FP', done: false }],
  meta: { loading: false, page: 1 },
};

// 只创建受影响的路径节点
const state2 = immutableSet(state, ['user', 'settings', 'theme'], 'light');
const state3 = immutableUpdate(state2, ['todos', 0, 'done'], (v: boolean) => !v);
const state4 = immutableDelete(state3, ['user', 'settings', 'lang']);

// 结构共享验证：未修改的引用相同
console.log('\n🔗 示例3 - 结构共享:');
console.log('  state.todos === state2.todos:', state.todos === state2.todos); // true
console.log('  state.meta === state2.meta:', state.meta === state2.meta);     // true
console.log('  state.user !== state2.user:', state.user !== state2.user);     // true (theme 变了)
console.log('  state2.todos !== state3.todos:', state2.todos !== state3.todos); // true (done 变了)
console.log('✅ 示例3: 不可变更新完成');
```

### 示例 4: 持久化列表 — 不可变队列

```typescript
/**
 * 持久化数据结构：每次"修改"返回新版本，旧版本仍然可用。
 * 这是不可变性的终极体现。
 */

// 不可变队列 — 双栈实现 (入队栈 + 出队栈)
interface FQueue<T> {
  readonly inStack: T[];
  readonly outStack: T[];
}

const emptyQueue = <T>(): FQueue<T> => ({ inStack: [], outStack: [] });

// 平衡：出队栈空时，将入队栈反转移入
const balance = <T>(q: FQueue<T>): FQueue<T> =>
  q.outStack.length === 0
    ? { inStack: [], outStack: [...q.inStack].reverse() }
    : q;

const enqueue = <T>(q: FQueue<T>, item: T): FQueue<T> =>
  balance({ ...q, inStack: [...q.inStack, item] });

const dequeue = <T>(q: FQueue<T>): { value?: T; queue: FQueue<T> } => {
  if (q.outStack.length === 0 && q.inStack.length === 0) {
    return { queue: q };
  }
  const balanced = balance(q);
  const [value, ...rest] = balanced.outStack;
  return { value, queue: { ...balanced, outStack: rest } };
};

const toArray = <T>(q: FQueue<T>): T[] =>
  [...q.outStack, ...[...q.inStack].reverse()];

// 使用：版本化操作
const q0 = emptyQueue<number>();
const q1 = enqueue(q0, 1);
const q2 = enqueue(q1, 2);
const q3 = enqueue(q2, 3);

// q0, q1, q2 仍然可用！
console.log('\n📦 示例4 - 持久化队列:');
console.log('  q0:', toArray(q0)); // []
console.log('  q1:', toArray(q1)); // [1]
console.log('  q2:', toArray(q2)); // [1, 2]
console.log('  q3:', toArray(q3)); // [1, 2, 3]

const { value: v1, queue: q4 } = dequeue(q3);
console.log('  dequeue q3 → value:', v1, 'q4:', toArray(q4)); // 1, [2, 3]
console.log('  q3 仍然可用:', toArray(q3)); // [1, 2, 3] — 旧版本不变！
console.log('✅ 示例4: 持久化队列完成');
```

---

## 三、柯里化 — 函数工厂与部分应用

### 示例 5: 通用柯里化 & 自动柯里化

```typescript
/**
 * 柯里化 (Currying): 将多参数函数转换为一系列单参数函数。
 * 部分应用 (Partial Application): 预先绑定部分参数，返回新函数。
 */

// 通用 curry — 支持任意 arity
function curry<T extends any[], R>(fn: (...args: T) => R): any {
  const curried = (...provided: any[]) =>
    provided.length >= fn.length
      ? fn(...provided)
      : (...more: any[]) => curried(...provided, ...more);
  return curried;
}

// 基础柯里化示例
const add = curry((a: number, b: number, c: number) => a + b + c);
console.log('\n🔧 示例5 - 柯里化:');
console.log('  add(1)(2)(3):', add(1)(2)(3)); // 6
console.log('  add(1, 2)(3):', add(1, 2)(3)); // 6
console.log('  add(1)(2, 3):', add(1)(2, 3)); // 6

// 部分应用：创建专用函数
const multiply = curry((a: number, b: number) => a * b);
const double = multiply(2);
const triple = multiply(3);

console.log('  double(7):', double(7));  // 14
console.log('  triple(7):', triple(7));  // 21

// 真实场景：HTTP 请求工厂
const createRequest = curry(
  (baseUrl: string, method: string, endpoint: string, body?: any) => ({
    url: `${baseUrl}${endpoint}`,
    method,
    body,
    headers: { 'Content-Type': 'application/json' },
  })
);

const apiGet = createRequest('https://api.example.com')('GET');
const apiPost = createRequest('https://api.example.com')('POST');
const getUsers = apiGet('/users');
const createUser = apiPost('/users');

console.log('  getUsers:', getUsers);
console.log('  createUser({name:"Bob"}):', createUser({ name: 'Bob' }));
console.log('✅ 示例5: 柯里化完成');
```

### 示例 6: 柯里化在数据转换中的威力

```typescript
/**
 * 柯里化让数据转换函数变成可复用的"转换器工厂"。
 */

// 数字格式化工厂
const formatNumber = curry((decimals: number, separator: string, locale: string, num: number): string =>
  num.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).replace(',', separator)
);

const formatCNMoney = formatNumber(2)('')('zh-CN');
const formatUSMoney = formatNumber(2)('.')('en-US');

console.log('\n💰 示例6 - 柯里化数据转换:');
console.log('  1234.5 → CN:', formatCNMoney(1234.5));   // "1234.50"
console.log('  1234.5 → US:', formatUSMoney(1234.5));   // "1,234.50"

// 字符串处理工厂
const transform = curry(
  (transformers: Array<(s: string) => string>, s: string): string =>
    transformers.reduce((acc, fn) => fn(acc), s)
);

const slugify = transform([
  (s) => s.toLowerCase(),
  (s) => s.trim(),
  (s) => s.replace(/[^\w\s-]/g, ''),
  (s) => s.replace(/\s+/g, '-'),
]);

const camelToKebab = transform([
  (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase(),
  (s) => s.startsWith('-') ? s.slice(1) : s,
]);

console.log('  slugify("Hello World! 2026"):', slugify('Hello World! 2026'));
// "hello-world-2026"
console.log('  camelToKebab("backgroundColor"):', camelToKebab('backgroundColor'));
// "background-color"

// 日期格式化工厂
const formatDate = curry(
  (fmt: string, locale: string, date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return fmt
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', h)
      .replace('mm', m);
  }
);

const formatShort = formatDate('YYYY-MM-DD')('zh-CN');
const formatFull = formatDate('YYYY/MM/DD HH:mm')('zh-CN');

console.log('  formatShort(new Date()):', formatShort(new Date()));
console.log('  formatFull(new Date()):', formatFull(new Date()));
console.log('✅ 示例6: 柯里化数据转换完成');
```

---

## 四、函数组合 — 管道与数据流

### 示例 7: 类型安全管道 (TypeScript)

```typescript
/**
 * 管道 (Pipeline) = 从左到右组合函数。
 * 类型安全管道确保每一步的输出类型匹配下一步的输入类型。
 */

// 类型安全的 pipe — 使用 TypeScript 类型推断
type Unary<T, U> = (value: T) => U;

// 2-arg pipe
function pipe2<A, B, C>(f1: Unary<A, B>, f2: Unary<B, C>): Unary<A, C> {
  return (a: A) => f2(f1(a));
}

// 3-arg pipe
function pipe3<A, B, C, D>(
  f1: Unary<A, B>, f2: Unary<B, C>, f3: Unary<C, D>
): Unary<A, D> {
  return (a: A) => f3(f2(f1(a)));
}

// 通用 pipe (运行时)
const pipe = <T>(...fns: Array<(x: any) => any>) =>
  (initial: T) => fns.reduce((acc, fn) => fn(acc), initial);

// 真实场景：日志处理管道
interface LogEntry {
  level: string;
  message: string;
  timestamp: number;
  meta?: Record<string, any>;
}

interface FormattedLog {
  timestamp: string;
  level: string;
  message: string;
  color: string;
}

const levelColors: Record<string, string> = {
  error: '🔴', warn: '🟡', info: '🔵', debug: '⚪',
};

const rawLogs: LogEntry[] = [
  { level: 'error', message: 'Database connection failed', timestamp: Date.now() - 5000 },
  { level: 'warn', message: 'High memory usage', timestamp: Date.now() - 3000 },
  { level: 'info', message: 'Server started on port 3000', timestamp: Date.now() - 1000 },
];

// 管道步骤
const toUpperCase = (s: string) => s.toUpperCase();
const truncate = (max: number) => (s: string) =>
  s.length > max ? s.slice(0, max) + '...' : s;
const formatTime = (ts: number) => new Date(ts).toISOString().slice(11, 19);
const addColor = (level: string) => (msg: string) =>
  `${levelColors[level] || '⚪'} ${msg}`;

// 构建管道
const formatLog = pipe(
  (entry: LogEntry) => ({
    ...entry,
    level: toUpperCase(entry.level),
    message: truncate(30)(entry.message),
  }),
  (entry: LogEntry) => ({
    timestamp: formatTime(entry.timestamp),
    level: entry.level,
    message: entry.message,
    color: levelColors[entry.level.toLowerCase()] || '⚪',
  })
);

console.log('\n📋 示例7 - 类型安全管道:');
rawLogs.forEach(log => {
  const formatted = formatLog(log);
  console.log(`  [${formatted.timestamp}] ${formatted.color} ${formatted.level}: ${formatted.message}`);
});
console.log('✅ 示例7: 管道完成');
```

### 示例 8: 组合子模式 — 表达式树

```typescript
/**
 * 组合子 (Combinator) = 只通过组合其他组合子来构建值的函数。
 * 表达式树是组合子的经典应用。
 */

// 表达式类型
type Expr =
  | { type: 'literal'; value: number }
  | { type: 'variable'; name: string }
  | { type: 'add'; left: Expr; right: Expr }
  | { type: 'mul'; left: Expr; right: Expr }
  | { type: 'neg'; expr: Expr }
  | { type: 'call'; fn: string; args: Expr[] };

// 组合子工厂
const lit = (n: number): Expr => ({ type: 'literal', value: n });
const var_ = (name: string): Expr => ({ type: 'variable', name });
const add = (l: Expr, r: Expr): Expr => ({ type: 'add', left: l, right: r });
const mul = (l: Expr, r: Expr): Expr => ({ type: 'mul', left: l, right: r });
const neg = (e: Expr): Expr => ({ type: 'neg', expr: e });

// 表达式求值器 (纯函数)
const evaluate = (env: Record<string, number>) => (expr: Expr): number => {
  switch (expr.type) {
    case 'literal': return expr.value;
    case 'variable': return env[expr.name] ?? 0;
    case 'add': return evaluate(env)(expr.left) + evaluate(env)(expr.right);
    case 'mul': return evaluate(env)(expr.left) * evaluate(env)(expr.right);
    case 'neg': return -evaluate(env)(expr.expr);
    case 'call': {
      const vals = expr.args.map(a => evaluate(env)(a));
      const fns: Record<string, (args: number[]) => number> = {
        pow: ([a, b]) => Math.pow(a, b),
        max: (args) => Math.max(...args),
        abs: ([a]) => Math.abs(a),
      };
      return (fns[expr.fn] ?? (() => 0))(vals);
    }
  }
};

// 表达式 → 字符串
const toString = (expr: Expr): string => {
  switch (expr.type) {
    case 'literal': return String(expr.value);
    case 'variable': return expr.name;
    case 'add': return `(${toString(expr.left)} + ${toString(expr.right)})`;
    case 'mul': return `(${toString(expr.left)} × ${toString(expr.right)})`;
    case 'neg': return `(-${toString(expr.expr)})`;
    case 'call': return `${expr.fn}(${expr.args.map(toString).join(', ')})`;
  }
};

// 构建表达式: (x * 3) + (-y) + pow(2, 4)
const expr = add(
  add(mul(var_('x'), lit(3)), neg(var_('y'))),
  { type: 'call', fn: 'pow', args: [lit(2), lit(4)] }
);

console.log('\n🌳 示例8 - 表达式树:');
console.log('  表达式:', toString(expr));
console.log('  env={x:5, y:2} →', evaluate({ x: 5, y: 2 })(expr)); // (5*3) + (-2) + 16 = 31
console.log('  env={x:0, y:0} →', evaluate({ x: 0, y: 0 })(expr)); // 0 + 0 + 16 = 16
console.log('✅ 示例8: 表达式树完成');
```

---

## 五、函子 (Functor) & Monad — 错误处理

### 示例 9: Maybe / Option 函子

```typescript
/**
 * Maybe 函子: 封装"可能为空"的值，用纯函数处理 null/undefined。
 * 替代 if/else 的空值检查链。
 */

// Maybe 类型
type Maybe<T> =
  | { type: 'Just'; value: T }
  | { type: 'Nothing' };

const just = <T>(value: T): Maybe<T> => ({ type: 'Just', value });
const nothing = <T>(): Maybe<T> => ({ type: 'Nothing' });

const fromNullable = <T>(value: T | null | undefined): Maybe<T> =>
  value == null ? nothing<T>() : just(value);

// fmap: 对 Maybe 内的值应用函数
const fmap = <T, U>(fn: (a: T) => U) => (m: Maybe<T>): Maybe<U> =>
  m.type === 'Just' ? just(fn(m.value)) : nothing<U>();

// chain (flatMap): 处理返回 Maybe 的函数
const chain = <T, U>(fn: (a: T) => Maybe<U>) => (m: Maybe<T>): Maybe<U> =>
  m.type === 'Just' ? fn(m.value) : nothing<U>();

// 提取值
const withDefault = <T>(defaultValue: T) => (m: Maybe<T>): T =>
  m.type === 'Just' ? m.value : defaultValue;

// 真实场景：用户配置读取
interface Config {
  database?: { host?: string; port?: number };
  features?: { darkMode?: boolean };
}

const getConfig = (): Config => ({
  database: { host: 'localhost' },
  // features 缺失
});

const getHost = pipe(
  fromNullable<Config>,
  chain(getConfig),
  chain(c => fromNullable(c.database)),
  chain(d => fromNullable(d.host)),
  withDefault('127.0.0.1')
);

console.log('\n📦 示例9 - Maybe 函子:');
console.log('  host:', getHost(null)); // "localhost"

// 链式安全访问
const safeProp = <T extends object, K extends keyof T>(key: K) =>
  (obj: T | null | undefined): Maybe<T[K]> =>
    fromNullable(obj)?.[key] != null ? just(obj![key]) : nothing<T[K]>();

interface User {
  profile?: { address?: { city?: string } };
}

const user: User = { profile: { address: { city: 'Shanghai' } } };

const getCity = pipe(
  (u: User) => fromNullable(u.profile),
  chain(p => fromNullable(p.address)),
  chain(a => fromNullable(a.city)),
  withDefault('Unknown')
);

console.log('  city:', getCity(user));      // "Shanghai"
console.log('  city:', getCity({} as User)); // "Unknown"
console.log('✅ 示例9: Maybe 函子完成');
```

### 示例 10: Either / Result Monad — 错误处理

```typescript
/**
 * Either 类型: 表示两种可能的值 (Left=错误, Right=成功)。
 * 替代 try/catch，让错误处理成为类型系统的一部分。
 */

type Either<E, T> =
  | { type: 'Left'; error: E }
  | { type: 'Right'; value: T };

const left = <E, T = never>(error: E): Either<E, T> => ({ type: 'Left', error });
const right = <T, E = never>(value: T): Either<E, T> => ({ type: 'Right', value });

const isLeft = <E, T>(e: Either<E, T>): e is { type: 'Left'; error: E } =>
  e.type === 'Left';

// fmap
const mapEither = <E, T, U>(fn: (a: T) => U) =>
  (e: Either<E, T>): Either<E, U> =>
    isLeft(e) ? e : right(fn(e.value));

// chain
const chainEither = <E, T, U>(fn: (a: T) => Either<E, U>) =>
  (e: Either<E, T>): Either<E, U> =>
    isLeft(e) ? e : fn(e.value);

// 真实场景：安全的 JSON 解析 + 数据验证
const parseJSON = <T>(input: string): Either<string, T> => {
  try {
    return right(JSON.parse(input) as T);
  } catch (e) {
    return left(`JSON parse error: ${(e as Error).message}`);
  }
};

// 验证函数
const validateUser = (data: any): Either<string, { name: string; age: number }> => {
  if (typeof data.name !== 'string') return left('name must be a string');
  if (typeof data.age !== 'number' || data.age < 0) return left('age must be a positive number');
  return right({ name: data.name, age: data.age });
};

// 管道：解析 → 验证 → 转换
const processUser = (input: string): Either<string, string> =>
  pipe(
    parseJSON<any>,
    chainEither(validateUser),
    mapEither(u => `${u.name} (${u.age} years old)`)
  )(input);

console.log('\n🔀 示例10 - Either Monad:');
console.log('  valid:', processUser('{"name":"Alice","age":25}'));
// Right { value: "Alice (25 years old)" }
console.log('  bad json:', processUser('{bad}'));
// Left { error: "JSON parse error: ..." }
console.log('  invalid:', processUser('{"name":123,"age":-1}'));
// Left { error: "name must be a string" }

// 收集所有错误
const validateAll = (data: any): Either<string[], { name: string; age: number }> => {
  const errors: string[] = [];
  if (typeof data.name !== 'string') errors.push('name must be a string');
  if (typeof data.age !== 'number' || data.age < 0) errors.push('age must be a positive number');
  return errors.length > 0 ? left(errors) : right({ name: data.name, age: data.age });
};

console.log('  all errors:', validateAll({ name: 123, age: -1 }));
// Left { error: ["name must be a string", "age must be a positive number"] }
console.log('✅ 示例10: Either Monad 完成');
```

---

## 六、真实世界 FP 模式

### 示例 11: 响应式 FP — 状态流

```typescript
/**
 * 用纯函数构建简单的响应式状态流。
 * 每个状态变更都是纯函数，所有变更可追溯、可回放。
 */

// 状态流
interface StateStream<S, A> {
  getState(): S;
  dispatch(action: A): void;
  subscribe(listener: (state: S, action: A) => void): () => void;
  getHistory(): Array<{ state: S; action: A }>;
  undo(): void;
  redo(): void;
}

const createStateStream = <S, A>(
  initialState: S,
  reducer: (state: S, action: A) => S
): StateStream<S, A> => {
  let currentState = initialState;
  let listeners = new Set<(state: S, action: A) => void>();
  const history: Array<{ state: S; action: A }> = [];
  let historyIndex = -1;

  return {
    getState: () => currentState,
    dispatch(action: A) {
      currentState = reducer(currentState, action);
      historyIndex++;
      history[historyIndex] = { state: currentState, action };
      history.splice(historyIndex + 1); // 截断未来
      listeners.forEach(l => l(currentState, action));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getHistory: () => [...history],
    undo() {
      if (historyIndex > 0) {
        historyIndex--;
        currentState = history[historyIndex].state;
        listeners.forEach(l => l(currentState, history[historyIndex].action));
      }
    },
    redo() {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        currentState = history[historyIndex].state;
        listeners.forEach(l => l(currentState, history[historyIndex].action));
      }
    },
  };
};

// 使用：Todo 应用
type Todo = { id: number; text: string; done: boolean };
type TodoAction =
  | { type: 'ADD'; text: string }
  | { type: 'TOGGLE'; id: number }
  | { type: 'REMOVE'; id: number };

const todoReducer = (state: Todo[], action: TodoAction): Todo[] => {
  switch (action.type) {
    case 'ADD':
      return [...state, { id: Date.now(), text: action.text, done: false }];
    case 'TOGGLE':
      return state.map(t =>
        t.id === action.id ? { ...t, done: !t.done } : t
      );
    case 'REMOVE':
      return state.filter(t => t.id !== action.id);
  }
};

const store = createStateStream<Todo[], TodoAction>([], todoReducer);
let changeCount = 0;
store.subscribe((state, action) => {
  changeCount++;
  console.log(`  📝 [${changeCount}] ${action.type} → ${state.length} items`);
});

console.log('\n🔄 示例11 - 响应式状态流:');
store.dispatch({ type: 'ADD', text: 'Learn FP' });
store.dispatch({ type: 'ADD', text: 'Build app' });
store.dispatch({ type: 'TOGGLE', id: store.getState()[0].id });
store.dispatch({ type: 'REMOVE', id: store.getState()[1].id });

console.log('  Current:', store.getState().map(t => `${t.done ? '✓' : '○'} ${t.text}`).join(', '));
console.log('  History length:', store.getHistory().length);

store.undo();
console.log('  After undo:', store.getState().map(t => `${t.done ? '✓' : '○'} ${t.text}`).join(', '));
store.redo();
console.log('  After redo:', store.getState().map(t => `${t.done ? '✓' : '○'} ${t.text}`).join(', '));
console.log('✅ 示例11: 响应式状态流完成');
```

### 示例 12: Transducer — 高效数据变换

```typescript
/**
 * Transducer (变换器): 组合多个数据变换步骤，只遍历一次数组。
 * 传统 chain: [1,2,3].map(f).filter(g).map(h) → 3 次遍历
 * Transducer: 1 次遍历完成所有变换
 */

// Transducer 类型
type Transducer<T, R> = <A>(
  reducer: (acc: A[], item: T) => A[]
) => (acc: A[], item: R) => A[];

// 构建 transducer
const mapping = <T, R>(fn: (item: T) => R): Transducer<T, R> =>
  <A>(reducer: (acc: A[], item: R) => A[]) =>
    (acc: A[], item: T) => reducer(acc, fn(item));

const filtering = <T>(pred: (item: T) => boolean): Transducer<T, T> =>
  <A>(reducer: (acc: A[], item: T) => A[]) =>
    (acc: A[], item: T) => pred(item) ? reducer(acc, item) : acc;

// 组合 transducers
const composeTransducers = <T>(...transducers: Transducer<T, T>[]): Transducer<T, T> => {
  return (reducer) =>
    transducers.reduceRight((nextReducer, xf) => xf(nextReducer), reducer);
};

// 执行 transducer
const transduce = <T, R>(
  xf: Transducer<T, R>,
  reducer: (acc: R[], item: R) => R[],
  initial: R[],
  input: T[]
): R[] => {
  const combined = xf(reducer);
  return input.reduce(combined, initial);
};

// 基础 reducer
const append = <T>(acc: T[], item: T): T[] => {
  acc.push(item);
  return acc;
};

// 使用：map → filter → map，只遍历一次
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const double = (n: number) => n * 2;
const isEven = (n: number) => n % 2 === 0;
const toStr = (n: number) => `#${n}`;

// 传统方式：3 次遍历
const traditional = numbers.map(double).filter(isEven).map(toStr);
console.log('\n⚡ 示例12 - Transducer:');
console.log('  Traditional:', traditional);

// Transducer 方式：1 次遍历
const xf = composeTransducers<number>(
  mapping(double),
  filtering(isEven),
  mapping(toStr)
);
const transduced = transduce(xf, append, [], numbers);
console.log('  Transduced:', transduced);

// 性能对比
const largeArray = Array.from({ length: 100000 }, (_, i) => i);

const t0 = performance.now();
largeArray.map(double).filter(isEven).map(toStr);
const t1 = performance.now();
transduce(xf, append, [], largeArray);
const t2 = performance.now();

console.log(`  传统: ${(t1 - t0).toFixed(2)}ms | Transducer: ${(t2 - t1).toFixed(2)}ms`);
console.log('✅ 示例12: Transducer 完成');
```

### 示例 13: Lens — 不可变数据聚焦

```typescript
/**
 * Lens (透镜): 聚焦到数据结构中的某个字段，提供 get/set 的纯函数接口。
 * 深层嵌套对象的不可变更新变得优雅。
 */

interface Lens<S, A> {
  get: (s: S) => A;
  set: (a: A, s: S) => S;
  over: (fn: (a: A) => A, s: S) => S;
}

const lens = <S, A>(getter: (s: S) => A, setter: (a: A, s: S) => S): Lens<S, A> => ({
  get: getter,
  set: setter,
  over: (fn, s) => setter(fn(getter(s)), s),
});

const prop = <S, K extends keyof S>(key: K): Lens<S, S[K]> =>
  lens<S, S[K]>(
    (s) => s[key],
    (val, s) => ({ ...s, [key]: val })
  );

const index = <T>(i: number): Lens<T[], T | undefined> =>
  lens<T[], T | undefined>(
    (arr) => arr[i],
    (val, arr) => {
      const copy = [...arr];
      copy[i] = val as T;
      return copy;
    }
  );

// 组合 lens
const composeLens = <S, M, A>(outer: Lens<S, M>, inner: Lens<M, A>): Lens<S, A> =>
  lens<S, A>(
    (s) => inner.get(outer.get(s)),
    (a, s) => outer.set(inner.set(a, outer.get(s)), s)
  );

// 使用
interface Company {
  name: string;
  departments: {
    name: string;
    employees: { name: string; salary: number }[];
  }[];
}

const company: Company = {
  name: 'TechCorp',
  departments: [
    {
      name: 'Engineering',
      employees: [
        { name: 'Alice', salary: 100 },
        { name: 'Bob', salary: 80 },
      ],
    },
  ],
};

// 聚焦到第一个部门的第一个员工
const firstDept = prop<Company, 'departments'>('departments').over(
  (depts) => depts,
  company
);

const deptLens = prop<Company, 'departments'>('departments');
const empLens = composeLens(
  lens<Company, Company['departments'][0]>(
    (c) => c.departments[0],
    (d, c) => ({ ...c, departments: [d, ...c.departments.slice(1)] })
  ),
  prop<Company['departments'][0], 'employees'>('employees')
);

const firstEmpLens = composeLens(
  empLens,
  lens<Company['departments'][0]['employees'], Company['departments'][0]['employees'][0]>(
    (emps) => emps[0],
    (emp, emps) => [emp, ...emps.slice(1)]
  )
);

const updated = firstEmpLens.over(
  (emp) => ({ ...emp, salary: emp.salary * 1.1 }),
  company
);

console.log('\n🔍 示例13 - Lens:');
console.log('  Original salary:', company.departments[0].employees[0].salary); // 100
console.log('  Updated salary:', updated.departments[0].employees[0].salary);   // 110
console.log('  Original unchanged:', company.departments[0].employees[0].salary); // 100 (immutable!)
console.log('✅ 示例13: Lens 完成');
```

### 示例 14: FP 在 React 组件中的模式

```typescript
/**
 * React 组件本质上是纯函数: props → UI
 * 用 FP 模式构建可组合的 UI 组件逻辑。
 */

// 组件逻辑组合器
type ComponentLogic<P, S, A> = {
  initialState: (props: P) => S;
  reducer: (state: S, action: A) => S;
  deriveProps: (state: S, props: P) => Record<string, any>;
};

// 组合多个组件逻辑
const composeLogic = <P, S, A>(
  ...logics: ComponentLogic<P, S, A>[]
): ComponentLogic<P, S, A> => ({
  initialState: (props) => {
    return logics.reduce(
      (acc, logic) => ({ ...acc, ...logic.initialState(props) }),
      {} as S
    );
  },
  reducer: (state, action) => {
    return logics.reduce(
      (acc, logic) => logic.reducer(acc, action),
      state
    );
  },
  deriveProps: (state, props) => {
    return logics.reduce(
      (acc, logic) => ({ ...acc, ...logic.deriveProps(state, props) }),
      {}
    );
  },
});

// 具体逻辑模块
const toggleLogic: ComponentLogic<{}, { open: boolean }, { type: 'TOGGLE' }> = {
  initialState: () => ({ open: false }),
  reducer: (state, action) =>
    action.type === 'TOGGLE' ? { ...state, open: !state.open } : state,
  deriveProps: (state) => ({ isOpen: state.open, onToggle: () => ({ type: 'TOGGLE' as const }) }),
};

const searchLogic: ComponentLogic<
  { items: string[] },
  { query: string; results: string[] },
  { type: 'SEARCH'; query: string }
> = {
  initialState: () => ({ query: '', results: [] }),
  reducer: (state, action) => {
    if (action.type === 'SEARCH') {
      const results = state.query === ''
        ? []
        : state.results.filter(item =>
            item.toLowerCase().includes(state.query.toLowerCase())
          );
      return { ...state, query: action.query, results };
    }
    return state;
  },
  deriveProps: (state) => ({
    query: state.query,
    results: state.results,
    onSearch: (q: string) => ({ type: 'SEARCH' as const, query: q }),
  }),
};

// 组合逻辑
const dropdownLogic = composeLogic(toggleLogic, searchLogic);

// 模拟使用
const props = { items: ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'] };
const state = dropdownLogic.initialState(props);
console.log('\n🧩 示例14 - React FP 模式:');
console.log('  Initial state:', state);

const derived = dropdownLogic.deriveProps(state, props);
console.log('  Derived props:', derived);
console.log('✅ 示例14: React FP 模式完成');
```

### 示例 15: 纯函数测试框架

```typescript
/**
 * 纯函数的最大优势：极易测试。
 * 构建一个轻量级测试框架来验证纯函数。
 */

interface TestResult {
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
}

const test = <T, R>(
  name: string,
  fn: (input: T) => R,
  inputs: T[],
  expected: R[]
): TestResult[] => {
  return inputs.map((input, i) => {
    const actual = fn(input);
    const passed = JSON.stringify(actual) === JSON.stringify(expected[i]);
    return { name, passed, expected: expected[i], actual };
  });
};

const report = (results: TestResult[]) => {
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\n🧪 测试结果: ${passed}/${total} 通过`);
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}: expected=${JSON.stringify(r.expected)}, actual=${JSON.stringify(r.actual)}`);
  });
  return passed === total;
};

// 测试前面的纯函数
const results: TestResult[] = [];

// 测试 sanitizeName
results.push(...test(
  'sanitizeName',
  sanitizeName,
  ['  john doe  ', null, 'alice', 'BOB'],
  ['John Doe', 'Anonymous', 'Alice', 'Bob']
));

// 测试 compose
const add1 = (x: number) => x + 1;
const mul2 = (x: number) => x * 2;
results.push(...test(
  'compose(add1, mul2)',
  compose(add1, mul2),
  [1, 2, 3, 4, 5],
  [3, 5, 7, 9, 11]
));

// 测试 pipe
results.push(...test(
  'pipe(mul2, add1)',
  pipe(mul2, add1),
  [1, 2, 3, 4, 5],
  [3, 5, 7, 9, 11]
));

// 测试 immutableSet
const obj = { a: { b: { c: 1 } } };
const result = immutableSet(obj, ['a', 'b', 'c'], 42);
results.push({
  name: 'immutableSet',
  passed: result.a.b.c === 42 && obj.a.b.c === 1,
  expected: { new: 42, old: 1 },
  actual: { new: result.a.b.c, old: obj.a.b.c },
});

report(results);
console.log('✅ 示例15: 纯函数测试框架完成');
```

---

## 七、总结 — FP 核心概念速查

```
┌─────────────────────────────────────────────────────────────┐
│  函数式编程 v8 — 高级模式速查表                              │
├──────────────┬──────────────────────────────────────────────┤
│  纯函数      │  相同输入→相同输出 + 无副作用                │
│  引用透明    │  表达式可被其值替换而不改变行为                │
│  不可变性    │  数据创建后不可修改，通过结构共享高效更新      │
│  柯里化      │  多参函数→单参函数链，创建专用函数工厂         │
│  部分应用    │  预绑定部分参数，返回新函数                    │
│  组合        │  compose(f,g)(x) = f(g(x))                   │
│  管道        │  pipe(f,g)(x) = g(f(x))                      │
│  Functor     │  fmap: 对容器内的值应用函数                    │
│  Monad       │  chain: 处理返回容器的函数                     │
│  Maybe       │  封装可能为空的值，替代 null 检查              │
│  Either      │  封装成功/失败，替代 try/catch                 │
│  Transducer  │  组合变换，只遍历一次数据                      │
│  Lens        │  聚焦到嵌套数据，优雅地 get/set                │
│  状态流      │  纯函数 reducer + 可追溯历史                   │
├──────────────┴──────────────────────────────────────────────┤
│  核心原则:                                                   │
│  1. 数据不可变 → 可预测、可调试、可并发                      │
│  2. 函数纯 → 可测试、可缓存、可并行                          │
│  3. 组合 > 继承 → 小而专的函数组合成复杂逻辑                 │
│  4. 声明式 > 命令式 → 描述"做什么"而非"怎么做"               │
└─────────────────────────────────────────────────────────────┘
```

---

**本次训练产出**: 15 个高级示例，覆盖引用透明验证、不可变数据结构、柯里化工厂、类型安全管道、表达式树、Maybe/Either Monad、响应式状态流、Transducer、Lens、React FP 模式、测试框架。

**与之前版本的差异**:
- v1-v4: 基础概念 + 简单示例
- v5-v7: 实战场景 + 工具函数
- v8 (本次): 高级模式 + 真实世界管道 + 性能优化

**累计 FP 训练**: 8 轮 (4/23 → 5/02) 🎉
