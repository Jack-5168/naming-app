# 专项训练 06:00 — 函数式编程 (Functional Programming)

**日期**: 2026-05-10
**主题**: 纯函数 / 不可变性 / 函数组合 / 柯里化 / 高阶函数 / Functor / Monad
**文件**: `memory/spec-func-0600.md`

---

## 一、核心概念速览

### 1. 纯函数 (Pure Function)

**定义**: 给定相同输入，永远返回相同输出；没有任何副作用。

```
f(x) → y    // 无副作用，无外部状态依赖
```

**判断标准**:
- ✅ 不读取/修改外部变量
- ✅ 不调用 API / 不读写文件 / 不打印日志
- ✅ 不依赖 Math.random() / Date.now()
- ✅ 引用透明：可以用返回值直接替换函数调用

**反例**:
```typescript
let counter = 0;
function increment() { return ++counter; }  // ❌ 依赖外部状态
function randomId() { return Math.random(); }  // ❌ 不纯
function logAndReturn(x: number) { console.log(x); return x; }  // ❌ 有副作用
```

**正例**:
```typescript
function add(a: number, b: number): number { return a + b; }  // ✅ 纯函数
function toUpperCase(str: string): string { return str.toUpperCase(); }  // ✅ 纯函数
```

### 2. 不可变性 (Immutability)

**定义**: 数据创建后不可修改。需要"修改"时，返回新数据。

```typescript
// ❌ 可变方式
const arr = [1, 2, 3];
arr.push(4);  // 修改了原数组

// ✅ 不可变方式
const arr = [1, 2, 3];
const newArr = [...arr, 4];  // 返回新数组，原数组不变
```

**JavaScript 中的不可变工具**:
- `Object.freeze()` — 浅冻结
- `structuredClone()` — 深拷贝
- 数组方法：`map`, `filter`, `slice`, `concat`, `spread`
- 对象展开：`{ ...obj, newKey: value }`

### 3. 函数组合 (Function Composition)

**定义**: 将多个函数串联，上一个的输出是下一个的输入。

```
compose(f, g)(x) = f(g(x))
pipe(f, g)(x) = g(f(x))    // 从左到右，更符合直觉
```

```typescript
// 从右到左组合
function compose<T>(...fns: Function[]): (x: T) => T {
  return (x: T) => fns.reduceRight((acc, fn) => fn(acc), x);
}

// 从左到右管道
function pipe<T>(...fns: Function[]): (x: T) => T {
  return (x: T) => fns.reduce((acc, fn) => fn(acc), x);
}
```

### 4. 柯里化 (Currying)

**定义**: 将多参数函数转换为一系列单参数函数。

```typescript
function curry<T, R>(fn: Function): Function {
  return function curried(...args: any[]): any {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return (...moreArgs: any[]) => curried(...args, ...moreArgs);
  };
}

// 使用
const add = (a: number, b: number, c: number) => a + b + c;
const curriedAdd = curry(add);

curriedAdd(1)(2)(3);       // 6
curriedAdd(1)(2, 3);       // 6
const add5 = curriedAdd(1, 4);  // (c) => 5 + c
add5(10);                  // 15
```

### 5. 高阶函数 (Higher-Order Function)

**定义**: 接收函数作为参数，或返回函数的函数。

JavaScript 中到处都是：`map`, `filter`, `reduce`, `sort`, `setTimeout`, `Promise.then`...

---

## 二、12 个函数式编程示例

### 示例 1: 纯函数 — 用户数据处理流水线

```typescript
// ❌ 非纯：修改原对象
function badProcessUser(user: any) {
  user.name = user.name.trim();
  user.email = user.email.toLowerCase();
  user.createdAt = new Date();  // 不纯！
  return user;
}

// ✅ 纯函数：每次返回新对象
interface User {
  name: string;
  email: string;
  age: number;
}

const trimName = (user: User): User => ({ ...user, name: user.name.trim() });
const lowerEmail = (user: User): User => ({ ...user, email: user.email.toLowerCase() });
const validateAge = (user: User): User => ({
  ...user,
  age: Math.max(0, Math.min(150, user.age))
});

// 组合使用
const processUser = pipe(trimName, lowerEmail, validateAge);

const rawUser = { name: "  Alice  ", email: "ALICE@EXAMPLE.COM", age: 200 };
const cleanUser = processUser(rawUser);
// { name: "Alice", email: "alice@example.com", age: 150 }
// rawUser 不变！
```

### 示例 2: 柯里化 — 数据验证器工厂

```typescript
// 柯里化的验证器
const validate = (rule: (val: any) => boolean, message: string) =>
  (value: any) => rule(value) ? { valid: true } : { valid: false, message };

// 预配置验证器（部分应用）
const required = validate((v: any) => v != null && v !== '', '此字段必填');
const isEmail = validate(
  (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  '请输入有效邮箱'
);
const minLength = (min: number) =>
  validate((v: string) => v.length >= min, `最少 ${min} 个字符`);
const isNumber = validate((v: any) => typeof v === 'number' && !isNaN(v), '请输入数字');
const range = (min: number, max: number) =>
  validate((v: number) => v >= min && v <= max, `范围 ${min}-${max}`);

// 验证管道
const validateField = (validators: ReturnType<typeof validate>[]) =>
  (value: any) => validators.reduce(
    (result, v) => result.valid ? v(value) : result,
    { valid: true } as { valid: boolean; message?: string }
  );

// 使用
const userValidator = validateField([required, isEmail]);
userValidator('test@example.com');  // { valid: true }
userValidator('');                   // { valid: false, message: '此字段必填' }

const ageValidator = validateField([required, isNumber, range(18, 120)]);
ageValidator(15);  // { valid: false, message: '范围 18-120' }
```

### 示例 3: 不可变数据 — Todo List 的函数式操作

```typescript
interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

// 所有操作都返回新数组/新对象
const addTodo = (todos: Todo[], text: string, id: number): Todo[] =>
  [...todos, { id, text, completed: false }];

const removeTodo = (todos: Todo[], id: number): Todo[] =>
  todos.filter(t => t.id !== id);

const toggleTodo = (todos: Todo[], id: number): Todo[] =>
  todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);

const updateTodoText = (todos: Todo[], id: number, text: string): Todo[] =>
  todos.map(t => t.id === id ? { ...t, text } : t);

// 查询也是纯函数
const getCompleted = (todos: Todo[]): Todo[] =>
  todos.filter(t => t.completed);

const getPending = (todos: Todo[]): Todo[] =>
  todos.filter(t => !t.completed);

const countByStatus = (todos: Todo[]) => ({
  total: todos.length,
  completed: todos.filter(t => t.completed).length,
  pending: todos.filter(t => !t.completed).length
});

// 使用
let todos: Todo[] = [];
todos = addTodo(todos, '学习 FP', 1);
todos = addTodo(todos, '写示例', 2);
todos = toggleTodo(todos, 1);
todos = addTodo(todos, '复习柯里化', 3);

console.log(countByStatus(todos));
// { total: 3, completed: 1, pending: 2 }
```

### 示例 4: 函数组合 — 字符串处理管道

```typescript
// 基础函数
const trim = (s: string) => s.trim();
const lower = (s: string) => s.toLowerCase();
const truncate = (max: number) => (s: string) =>
  s.length > max ? s.slice(0, max) + '...' : s;
const removeExtraSpaces = (s: string) => s.replace(/\s+/g, ' ');
const wrapInQuotes = (s: string) => `"${s}"`;
const capitalize = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

// 组合不同管道
const formatTitle = pipe(
  trim,
  removeExtraSpaces,
  capitalize,
  truncate(50)
);

const formatSearchQuery = pipe(
  trim,
  lower,
  removeExtraSpaces
);

const formatDisplay = pipe(
  trim,
  removeExtraSpaces,
  capitalize,
  truncate(30),
  wrapInQuotes
);

console.log(formatTitle('  hello   WORLD  programming  '));
// "Hello World Programming"

console.log(formatSearchQuery('  Hello   WORLD  '));
// "hello world"

console.log(formatDisplay('  this is a very long title that needs truncation  '));
// '"This Is A Very Long Title..."'
```

### 示例 5: 函子 (Functor) — Maybe 模式处理空值

```typescript
// Maybe 函子：安全处理可能为 null/undefined 的值
class Maybe<T> {
  private constructor(private readonly value: T | null | undefined) {}

  static of<U>(value: U): Maybe<U> {
    return new Maybe(value);
  }

  // map: 如果值存在则应用函数，否则返回空 Maybe
  map<U>(fn: (value: T) => U): Maybe<U> {
    if (this.value == null) return Maybe.of<U>(undefined);
    return Maybe.of(fn(this.value));
  }

  // chain: 扁平化嵌套 Maybe（类似 flatMap）
  chain<U>(fn: (value: T) => Maybe<U>): Maybe<U> {
    if (this.value == null) return Maybe.of<U>(undefined);
    return fn(this.value);
  }

  // 获取值，提供默认值
  getOrElse<U>(defaultValue: U): T | U {
    return this.value == null ? defaultValue : this.value;
  }

  // 判断是否有值
  isNothing(): boolean {
    return this.value == null;
  }
}

// 使用 Maybe 安全处理嵌套数据
interface UserProfile {
  settings?: {
    preferences?: {
      theme?: string;
      language?: string;
    };
  };
}

const getUserTheme = (profile: Maybe<UserProfile>): Maybe<string> =>
  profile
    .chain(p => Maybe.of(p.settings))
    .chain(s => Maybe.of(s?.preferences))
    .chain(p => Maybe.of(p?.theme));

const profile1 = Maybe.of<UserProfile>({
  settings: { preferences: { theme: 'dark', language: 'zh' } }
});
console.log(getUserTheme(profile1).getOrElse('light'));  // "dark"

const profile2 = Maybe.of<UserProfile>({});
console.log(getUserTheme(profile2).getOrElse('light'));  // "light"

const profile3 = Maybe.of<UserProfile>(null as any);
console.log(getUserTheme(profile3).getOrElse('light'));  // "light"
```

### 示例 6: 函子 — Result/Either 模式处理错误

```typescript
// Result 类型：成功或失败
type Result<T, E = Error> = Success<T> | Failure<E>;

class Success<T, E = Error> {
  readonly isSuccess = true;
  readonly isFailure = false;
  constructor(private readonly value: T) {}

  map<U>(fn: (value: T) => U): Result<U, E> {
    return new Success(fn(this.value));
  }

  chain<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  mapError<U>(_fn: (e: E) => U): Result<T, E> {
    return this;
  }

  getOrElse(_default: T): T {
    return this.value;
  }

  match<U>(handlers: { success: (v: T) => U; failure: (e: E) => U }): U {
    return handlers.success(this.value);
  }
}

class Failure<T, E = Error> {
  readonly isSuccess = false;
  readonly isFailure = true;
  constructor(private readonly error: E) {}

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return this as any;
  }

  chain<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return this as any;
  }

  mapError<U>(fn: (e: E) => U): Result<T, U> {
    return new Failure(fn(this.error));
  }

  getOrElse(defaultValue: T): T {
    return defaultValue;
  }

  match<U>(handlers: { success: (v: T) => U; failure: (e: E) => U }): U {
    return handlers.failure(this.error);
  }
}

const Ok = <T>(v: T): Result<T> => new Success(v);
const Err = <E = Error>(e: E): Result<never, E> => new Failure(e);

// 使用：安全的 JSON 解析
const parseJSON = (str: string): Result<any, Error> => {
  try {
    return Ok(JSON.parse(str));
  } catch (e) {
    return Err(e as Error);
  }
};

// 使用：安全的除法
const safeDivide = (a: number, b: number): Result<number, string> =>
  b === 0 ? Err('除数不能为 0') : Ok(a / b);

// 组合使用
const calculateRatio = (a: number, b: number): Result<number, string> =>
  safeDivide(a, b)
    .map(r => r * 100)
    .map(r => Math.round(r * 100) / 100);

calculateRatio(3, 4).match({
  success: v => console.log(`比率: ${v}%`),      // 75%
  failure: e => console.error(`错误: ${e}`)
});

calculateRatio(3, 0).match({
  success: v => console.log(`比率: ${v}%`),
  failure: e => console.error(`错误: ${e}`)      // 错误: 除数不能为 0
});

// 管道式错误处理
const processApiResponse = (raw: string): Result<any, string> =>
  parseJSON(raw)
    .mapError(e => `JSON解析失败: ${e.message}`)
    .chain(data =>
      data.status === 'ok'
        ? Ok(data.payload)
        : Err(`API错误: ${data.message || '未知错误'}`)
    );
```

### 示例 7: 柯里化 + 组合 — 数据库查询构建器

```typescript
// 柯里化的查询条件
const where = (field: string, operator: string, value: any) =>
  (query: string) => `${query} WHERE ${field} ${operator} '${value}'`;

const and = (field: string, operator: string, value: any) =>
  (query: string) => `${query} AND ${field} ${operator} '${value}'`;

const orderBy = (field: string, direction: 'ASC' | 'DESC' = 'ASC') =>
  (query: string) => `${query} ORDER BY ${field} ${direction}`;

const limit = (n: number) =>
  (query: string) => `${query} LIMIT ${n}`;

const select = (fields: string) => (table: string) =>
  `SELECT ${fields} FROM ${table}`;

// 组合查询
const buildUserQuery = pipe(
  select('id, name, email')('users'),
  where('age', '>=', 18),
  and('status', '=', 'active'),
  orderBy('created_at', 'DESC'),
  limit(10)
);

console.log(buildUserQuery);
// SELECT id, name, email FROM users WHERE age >= '18' AND status = 'active' ORDER BY created_at DESC LIMIT 10

// 更灵活的查询构建器（使用 reduce）
const buildQuery = (base: string, clauses: Function[]) =>
  clauses.reduce((q, clause) => clause(q), base);

const activeAdultUsers = buildQuery(
  'SELECT * FROM users',
  [
    where('age', '>=', 18),
    where('status', '=', 'active'),
    orderBy('name', 'ASC'),
    limit(20)
  ]
);
```

### 示例 8: 高阶函数 — 函数记忆化 (Memoization)

```typescript
// 通用记忆化装饰器
function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();

  const memoized = function (...args: Parameters<T>): ReturnType<T> {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  } as T;

  // 暴露缓存统计
  memoized.cacheSize = () => cache.size;
  memoized.clearCache = () => cache.clear();

  return memoized;
}

// 斐波那契（展示性能差异）
const fib = (n: number): number =>
  n <= 1 ? n : fib(n - 1) + fib(n - 2);

const memoizedFib = memoize(fib);

console.time('raw fib');
console.log(fib(35));  // 9227465 — 慢
console.timeEnd('raw fib');

console.time('memoized fib');
console.log(memoizedFib(35));  // 9227465 — 快
console.timeEnd('memoized fib');

// 实际应用：API 响应缓存
const cacheApi = memoize(async (endpoint: string, params: Record<string, any>) => {
  const response = await fetch(`${endpoint}?${new URLSearchParams(params)}`);
  return response.json();
});

// 相同参数只请求一次
// const data1 = await cacheApi('/api/users', { page: 1 });  // 真实请求
// const data2 = await cacheApi('/api/users', { page: 1 });  // 缓存命中
```

### 示例 9: 纯函数 — 状态机（Redux 风格的 Reducer）

```typescript
// 纯函数 Reducer — Redux 的核心
type Action =
  | { type: 'ADD_ITEM'; payload: string }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'TOGGLE_ITEM'; payload: number }
  | { type: 'FILTER'; payload: 'all' | 'active' | 'completed' }
  | { type: 'CLEAR_COMPLETED' };

interface State {
  items: Array<{ id: number; text: string; completed: boolean }>;
  filter: 'all' | 'active' | 'completed';
  nextId: number;
}

const initialState: State = {
  items: [],
  filter: 'all',
  nextId: 1
};

// 纯函数：相同 state + action → 相同新 state
const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_ITEM':
      return {
        ...state,
        items: [...state.items, {
          id: state.nextId,
          text: action.payload,
          completed: false
        }],
        nextId: state.nextId + 1
      };

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload)
      };

    case 'TOGGLE_ITEM':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload
            ? { ...item, completed: !item.completed }
            : item
        )
      };

    case 'FILTER':
      return { ...state, filter: action.payload };

    case 'CLEAR_COMPLETED':
      return {
        ...state,
        items: state.items.filter(item => !item.completed)
      };

    default:
      return state;
  }
};

// 使用 — 纯函数意味着可预测、可测试、可回溯
let state = initialState;
state = reducer(state, { type: 'ADD_ITEM', payload: '学习 FP' });
state = reducer(state, { type: 'ADD_ITEM', payload: '写代码' });
state = reducer(state, { type: 'TOGGLE_ITEM', payload: 1 });
state = reducer(state, { type: 'FILTER', payload: 'active' });

// 纯函数 = 时间旅行调试
const history = [initialState];
let currentState = initialState;
const dispatch = (action: Action) => {
  currentState = reducer(currentState, action);
  history.push(currentState);
};

dispatch({ type: 'ADD_ITEM', payload: '学习 FP' });
dispatch({ type: 'ADD_ITEM', payload: '写代码' });
dispatch({ type: 'TOGGLE_ITEM', payload: 1 });
// history[0] → history[3] 可以回溯到任何状态
```

### 示例 10: 函数组合 — 中间件模式（Koa 风格）

```typescript
// Koa 风格的中间件组合（洋葱模型）
type Context = Record<string, any>;
type Middleware = (ctx: Context, next: () => Promise<void>) => Promise<void>;

// 组合中间件
const compose = (middlewares: Middleware[]) =>
  async (ctx: Context): Promise<void> => {
    const dispatch = (i: number): Promise<void> => {
      if (i === middlewares.length) return Promise.resolve();
      const middleware = middlewares[i];
      return middleware(ctx, () => dispatch(i + 1));
    };
    return dispatch(0);
  };

// 中间件示例
const logger: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method || 'GET'} ${ctx.path || '/'} - ${ms}ms`);
};

const auth: Middleware = async (ctx, next) => {
  if (ctx.token && ctx.token.length > 0) {
    ctx.user = { id: 1, name: 'Alice' };  // 注入用户信息
    await next();
  } else {
    ctx.status = 401;
    ctx.body = { error: 'Unauthorized' };
  }
};

const rateLimit: Middleware = async (ctx, next) => {
  const key = ctx.ip || 'unknown';
  if (!ctx._requests) ctx._requests = new Map();
  const count = (ctx._requests.get(key) || 0) + 1;
  ctx._requests.set(key, count);

  if (count > 100) {
    ctx.status = 429;
    ctx.body = { error: 'Too Many Requests' };
    return;
  }
  await next();
};

const handler: Middleware = async (ctx, next) => {
  await next();
  if (!ctx.body) {
    ctx.body = { message: 'Hello, World!', user: ctx.user };
  }
};

// 组合所有中间件
const app = compose([logger, auth, rateLimit, handler]);

// 模拟请求
app({ method: 'GET', path: '/api', token: 'abc123', ip: '127.0.0.1' })
  .then(() => console.log('Response:', ctx => ctx.body));

// 无 token 请求
app({ method: 'GET', path: '/api', ip: '127.0.0.1' })
  .then(() => console.log('Response:', ctx => ctx.body));
```

### 示例 11: 不可变更新 — 深层嵌套对象更新

```typescript
// 问题：深层嵌套对象的不可变更新
interface Company {
  departments: Array<{
    name: string;
    employees: Array<{
      id: number;
      name: string;
      salary: number;
    }>;
  }>;
}

// ❌ 不纯的方式
function badRaiseSalary(company: Company, empId: number, amount: number) {
  for (const dept of company.departments) {
    for (const emp of dept.employees) {
      if (emp.id === empId) {
        emp.salary += amount;  // 直接修改！
      }
    }
  }
}

// ✅ 纯函数方式 — 使用路径式更新
type Path = (string | number)[];

const updateIn = <T extends object>(
  obj: T,
  path: Path,
  transformer: (value: any) => any
): T => {
  if (path.length === 0) return transformer(obj);

  const [key, ...rest] = path;
  const keyStr = String(key);

  if (Array.isArray(obj)) {
    const index = Number(key);
    return [
      ...obj.slice(0, index),
      updateIn(obj[index], rest, transformer),
      ...obj.slice(index + 1)
    ] as any;
  }

  return {
    ...obj,
    [keyStr]: updateIn((obj as any)[keyStr], rest, transformer)
  };
};

// 使用
const company: Company = {
  departments: [
    {
      name: 'Engineering',
      employees: [
        { id: 1, name: 'Alice', salary: 10000 },
        { id: 2, name: 'Bob', salary: 12000 }
      ]
    },
    {
      name: 'Marketing',
      employees: [
        { id: 3, name: 'Charlie', salary: 9000 }
      ]
    }
  ]
};

// 给 Alice 加薪 2000
const newCompany = updateIn(
  company,
  ['departments', 0, 'employees', 0, 'salary'],
  (salary: number) => salary + 2000
);

console.log(company.departments[0].employees[0].salary);   // 10000 (不变)
console.log(newCompany.departments[0].employees[0].salary); // 12000 (新值)

// 通用深层读取
const getIn = <T>(obj: any, path: Path): T | undefined =>
  path.reduce((acc, key) => acc?.[key], obj);

console.log(getIn<number>(company, ['departments', 1, 'name']));  // "Marketing"
```

### 示例 12: 纯函数 — 数据转换 ETL 管道

```typescript
// ETL (Extract → Transform → Load) 纯函数管道

interface RawRecord {
  id: string;
  fields: Record<string, string>;
  timestamp: string;
}

interface CleanRecord {
  id: number;
  data: Record<string, any>;
  createdAt: Date;
  validated: boolean;
}

// Extract: 从原始数据中提取
const extractFields = (required: string[]) =>
  (record: RawRecord): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const key of required) {
      result[key] = record.fields[key] || '';
    }
    return result;
  };

// Transform: 类型转换
const transformTypes = (schema: Record<string, (v: string) => any>) =>
  (fields: Record<string, string>): Record<string, any> => {
    const result: Record<string, any> = {};
    for (const [key, converter] of Object.entries(schema)) {
      result[key] = converter(fields[key] || '');
    }
    return result;
  };

// Transform: 数据清洗
const trimAll = (obj: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = typeof value === 'string' ? value.trim() : value;
  }
  return result;
};

const normalizeEmail = (obj: Record<string, any>): Record<string, any> =>
  obj.email ? { ...obj, email: obj.email.toLowerCase() } : obj;

// Validate: 验证规则组合
type Validator = (data: Record<string, any>) => string[];

const required = (fields: string[]): Validator =>
  (data) => fields.filter(f => !data[f]).map(f => `${f} 是必填项`);

const emailFormat: Validator = (data) =>
  data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
    ? ['邮箱格式不正确']
    : [];

const numberRange = (field: string, min: number, max: number): Validator =>
  (data) => {
    const val = data[field];
    return (typeof val === 'number' && (val < min || val > max))
      ? [`${field} 必须在 ${min}-${max} 之间`]
      : [];
  };

const validate = (validators: Validator[]) =>
  (data: Record<string, any>): { valid: boolean; errors: string[] } => {
    const errors = validators.flatMap(v => v(data));
    return { valid: errors.length === 0, errors };
  };

// Load: 组装最终记录
const buildRecord = (raw: RawRecord, data: Record<string, any>, valid: boolean): CleanRecord => ({
  id: parseInt(raw.id, 10),
  data,
  createdAt: new Date(raw.timestamp),
  validated: valid
});

// 完整 ETL 管道
const etlPipeline = (raw: RawRecord): CleanRecord => {
  const requiredFields = ['name', 'email', 'age'];
  const typeSchema = {
    name: (v: string) => v,
    email: (v: string) => v,
    age: (v: string) => parseInt(v, 10) || 0
  };
  const validators = [
    required(requiredFields),
    emailFormat,
    numberRange('age', 0, 150)
  ];

  const fields = extractFields(requiredFields)(raw);
  const typed = transformTypes(typeSchema)(fields);
  const cleaned = normalizeEmail(trimAll(typed));
  const { valid } = validate(validators)(cleaned);

  return buildRecord(raw, cleaned, valid);
};

// 使用
const rawData: RawRecord = {
  id: '42',
  fields: { name: '  Alice  ', email: 'ALICE@EXAMPLE.COM', age: '25' },
  timestamp: '2026-05-10T06:00:00Z'
};

const result = etlPipeline(rawData);
console.log(result);
// {
//   id: 42,
//   data: { name: 'Alice', email: 'alice@example.com', age: 25 },
//   createdAt: 2026-05-10T06:00:00.000Z,
//   validated: true
// }

// 批量处理
const batch = [rawData, /* ...更多数据 */];
const results = batch.map(etlPipeline);
const validResults = results.filter(r => r.validated);
```

---

## 三、函数式编程 vs 命令式编程对照表

| 概念 | 命令式 | 函数式 |
|------|--------|--------|
| 状态 | 可变变量 | 不可变数据 |
| 循环 | `for` / `while` | `map` / `filter` / `reduce` |
| 条件 | `if/else` | 模式匹配 / Maybe / Either |
| 错误 | `try/catch` | Result/Either 类型 |
| 空值 | `null` / `undefined` | Maybe / Option 类型 |
| 组合 | 方法链 | 函数组合 `compose` / `pipe` |
| 复用 | 继承 / 混入 | 柯里化 / 高阶函数 |
| 测试 | 需要 mock 外部状态 | 纯函数直接测试 |

---

## 四、JavaScript 函数式编程最佳实践

### ✅ 推荐做法

```typescript
// 1. 优先使用数组高阶方法
const adults = users.filter(u => u.age >= 18);
const names = users.map(u => u.name);
const total = users.reduce((sum, u) => sum + u.age, 0);

// 2. 使用对象展开替代 Object.assign
const updated = { ...user, name: 'New Name' };

// 3. 使用可选链和空值合并
const theme = user?.settings?.theme ?? 'light';

// 4. 提取纯函数，隔离副作用
// 好：纯逻辑 + 副作用分离
const calculate = (a: number, b: number) => a + b;  // 纯
const display = (result: number) => console.log(result);  // 副作用
display(calculate(1, 2));  // 组合
```

### ❌ 避免的做法

```typescript
// 1. 不要在循环中修改外部状态
let total = 0;
for (const item of items) { total += item.price; }  // ❌

// ✅ 改用 reduce
const total = items.reduce((sum, item) => sum + item.price, 0);

// 2. 不要直接修改参数
function badSort(arr: number[]) { arr.sort(); return arr; }  // ❌
function goodSort(arr: number[]) { return [...arr].sort(); }  // ✅

// 3. 避免过深的嵌套
if (a) { if (b) { if (c) { ... } } }  // ❌ 回调地狱
// ✅ 使用 guard clauses 或 Maybe
```

---

## 五、实用函数式工具库

```typescript
// 迷你函数式工具集（可复用到项目中）
const F = {
  // 组合（从右到左）
  compose: <T>(...fns: ((x: any) => any)[]) =>
    (x: T) => fns.reduceRight((v, f) => f(v), x),

  // 管道（从左到右）
  pipe: <T>(...fns: ((x: any) => any)[]) =>
    (x: T) => fns.reduce((v, f) => f(v), x),

  // 柯里化
  curry<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) =>
      args.length >= fn.length
        ? fn(...args)
        : F.curry(fn.bind(null, ...args))
    ) as T;
  },

  // 偏应用
  partial<T extends (...args: any[]) => any>(fn: T, ...presetArgs: any[]): T {
    return ((...args: any[]) => fn(...presetArgs, ...args)) as T;
  },

  // 取反
  not: <T>(fn: (x: T) => boolean) =>
    (x: T) => !fn(x),

  // 条件执行
  when: <T>(predicate: (x: T) => boolean, fn: (x: T) => T) =>
    (x: T) => predicate(x) ? fn(x) : x,

  // 恒等函数
  identity: <T>(x: T): T => x,

  // 常量函数
  constant: <T>(x: T) => () => x,

  // 点射（Prop getter）
  prop: <T, K extends keyof T>(key: K) =>
    (obj: T): T[K] => obj[key],

  // 方法调用
  method: (name: string, ...args: any[]) =>
    (obj: any) => obj[name](...args),
};

// 使用示例
const getAdultNames = F.pipe(
  (users: any[]) => users.filter(u => u.age >= 18),
  (users: any[]) => users.map(u => u.name.toUpperCase())
);

const isEven = (n: number) => n % 2 === 0;
const isOdd = F.not(isEven);

const doubleIfEven = F.when(isEven, (n: number) => n * 2);
```

---

## 六、总结

| 概念 | 核心思想 | JS 中的体现 |
|------|----------|-------------|
| 纯函数 | 相同输入 → 相同输出，无副作用 | `map`, `filter`, 数学函数 |
| 不可变性 | 数据不修改，返回新数据 | `...spread`, `Object.freeze` |
| 函数组合 | 小函数 → 大功能 | `compose`, `pipe` |
| 柯里化 | 多参数 → 单参数链 | `curry`, `bind` |
| 高阶函数 | 函数是一等公民 | 所有数组方法 |
| Functor | 可映射的容器 | `Maybe`, `Result`, `Array` |
| Monad | 可链式组合的容器 | `Promise`, `Result.chain` |

**函数式编程在真实项目中的应用**:
- Redux reducer → 纯函数状态管理
- React 函数组件 → 纯函数 UI
- RxJS → 函数式响应式编程
- Ramda / lodash/fp → 函数式工具库
- 数据处理管道 → ETL / 数据清洗
- 中间件模式 → Koa / Express

---

*专项训练完成。12 个示例覆盖：纯函数(1,9)、不可变性(3,11)、函数组合(4,7,10)、柯里化(2,7)、高阶函数(8,12)、Functor/Monad(5,6)、ETL 管道(12)。*
