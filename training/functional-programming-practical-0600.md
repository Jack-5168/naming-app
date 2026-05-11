# 函数式编程实战应用 — 真实场景 FP 模式

> 日期: 2026-04-27 06:00
> 前置: 基础版 (4/23) + 巩固版 (4/24) + 进阶版 (4/26)
> 目标: 10+ 实战示例，覆盖真实开发场景

---

## 一、数据处理管道 (Data Processing Pipeline)

### 示例 1: 用户数据清洗管道

```typescript
// 纯函数组合：数据清洗 → 转换 → 聚合
type User = {
  id: number;
  name: string;
  email: string;
  age: number | null;
  role: string;
  status: 'active' | 'inactive' | 'banned';
};

type CleanUser = {
  id: number;
  name: string;
  email: string;
  age: number;
  role: string;
};

// 1. 纯函数：过滤
const filterActive = (users: User[]): User[] =>
  users.filter(u => u.status === 'active');

// 2. 纯函数：过滤有年龄的
const filterWithAge = (users: User[]): User[] =>
  users.filter(u => u.age !== null);

// 3. 纯函数：数据清洗
const sanitizeName = (name: string): string =>
  name.trim().replace(/[<>]/g, '');

const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

const cleanUser = (user: User): CleanUser => ({
  id: user.id,
  name: sanitizeName(user.name),
  email: normalizeEmail(user.email),
  age: user.age!,
  role: user.role.toLowerCase(),
});

// 4. 纯函数：排序
const sortByAge = (users: CleanUser[]): CleanUser[] =>
  [...users].sort((a, b) => a.age - b.age);

// 5. 组合管道
const pipe =
  <T>(...fns: ((arg: T) => any)[]) =>
  (initial: T) =>
    fns.reduce((acc, fn) => fn(acc), initial);

const processUsers = pipe(
  filterActive,
  filterWithAge,
  users => users.map(cleanUser),
  sortByAge
);

// 使用
const rawUsers: User[] = [
  { id: 1, name: ' Alice ', email: 'ALICE@X.COM', age: 28, role: 'Admin', status: 'active' },
  { id: 2, name: 'Bob', email: 'bob@test.com', age: null, role: 'User', status: 'inactive' },
  { id: 3, name: '<Charlie>', email: 'CHARLIE@X.COM', age: 35, role: 'User', status: 'active' },
];

const result = processUsers(rawUsers);
// [{ id: 1, name: 'Alice', email: 'alice@x.com', age: 28, role: 'admin' },
//  { id: 3, name: 'Charlie', email: 'charlie@x.com', age: 35, role: 'user' }]
```

**关键 FP 概念:**
- 每个步骤都是**纯函数**（相同输入 → 相同输出，无副作用）
- **不可变性**（filter 返回新数组，sort 用 `[...users]` 拷贝）
- **组合**（pipe 将 4 个函数串联成一条管道）

### 示例 2: 通用数据管道工厂

```typescript
// 柯里化管道工厂
const createPipeline = <T>() => ({
  then: <R>(fn: (arg: T) => R) =>
    createPipeline<R>()
      .then((next: (r: R) => any) => (input: T) => next(fn(input))),
  run: (value: T) => value,
});

// 更实用的版本：带类型推导的管道
const createDataPipeline = <Input>(input: Input) => {
  let current: any = input;
  return {
    pipe: <Output>(fn: (arg: typeof current) => Output) => {
      current = fn(current);
      return createDataPipeline<Output>(current as Output);
    },
    value: () => current,
  };
};

// 使用
const stats = createDataPipeline(rawUsers)
  .pipe(filterActive)
  .pipe(filterWithAge)
  .pipe(users => users.map(cleanUser))
  .pipe(users => ({
    count: users.length,
    avgAge: users.reduce((s, u) => s + u.age, 0) / users.length,
    roles: [...new Set(users.map(u => u.role))],
  }))
  .value();

// { count: 2, avgAge: 31.5, roles: ['admin', 'user'] }
```

---

## 二、不可变状态管理 (Immutable State)

### 示例 3: 不可变 Todo 状态机

```typescript
// 状态定义（不可变）
type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  tags: string[];
};

type TodoState = {
  todos: Todo[];
  filter: 'all' | 'active' | 'completed';
  search: string;
};

// 纯函数：每个操作返回新状态
const ADD_TODO = (state: TodoState, text: string): TodoState => ({
  ...state,
  todos: [
    ...state.todos,
    {
      id: crypto.randomUUID(),
      text: text.trim(),
      completed: false,
      createdAt: Date.now(),
      tags: [],
    },
  ],
});

const TOGGLE_TODO = (state: TodoState, id: string): TodoState => ({
  ...state,
  todos: state.todos.map(todo =>
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  ),
});

const DELETE_TODO = (state: TodoState, id: string): TodoState => ({
  ...state,
  todos: state.todos.filter(todo => todo.id !== id),
});

const SET_FILTER = (state: TodoState, filter: TodoState['filter']): TodoState => ({
  ...state,
  filter,
});

const SET_SEARCH = (state: TodoState, search: string): TodoState => ({
  ...state,
  search: search.toLowerCase(),
});

const ADD_TAG = (state: TodoState, todoId: string, tag: string): TodoState => ({
  ...state,
  todos: state.todos.map(todo =>
    todo.id === todoId
      ? { ...todo, tags: [...new Set([...todo.tags, tag.toLowerCase()])] }
      : todo
  ),
});

// 纯函数查询（不修改状态）
const getFilteredTodos = (state: TodoState): Todo[] => {
  const filteredByStatus =
    state.filter === 'all'
      ? state.todos
      : state.filter === 'active'
      ? state.todos.filter(t => !t.completed)
      : state.todos.filter(t => t.completed);

  return state.search
    ? filteredByStatus.filter(t =>
        t.text.toLowerCase().includes(state.search) ||
        t.tags.some(tag => tag.includes(state.search))
      )
    : filteredByStatus;
};

const getStats = (state: TodoState) => ({
  total: state.todos.length,
  active: state.todos.filter(t => !t.completed).length,
  completed: state.todos.filter(t => t.completed).length,
  uniqueTags: [...new Set(state.todos.flatMap(t => t.tags))],
});

// 使用
let state: TodoState = { todos: [], filter: 'all', search: '' };
state = ADD_TODO(state, '学习 FP');
state = ADD_TAG(state, state.todos[0].id, '学习');
state = ADD_TODO(state, '写代码');
state = TOGGLE_TODO(state, state.todos[0].id);
state = SET_FILTER(state, 'active');

console.log(getFilteredTodos(state)); // [{ id: 'xxx', text: '写代码', completed: false, ... }]
console.log(getStats(state)); // { total: 2, active: 1, completed: 1, uniqueTags: ['学习'] }
```

### 示例 4: 不可变更新工具库 (Lenses 简化版)

```typescript
// 通用不可变更新：path-based setter
const setPath = <T extends object>(obj: T, path: string[], value: any): T => {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  return {
    ...obj,
    [key]: rest.length > 0
      ? setPath((obj as any)[key] ?? {}, rest, value)
      : value,
  };
};

// 通用不可变更新：path-based getter
const getPath = <T>(obj: any, path: string[], defaultValue?: T): T => {
  let current = obj;
  for (const key of path) {
    if (current == null) return defaultValue as T;
    current = current[key];
  }
  return current as T;
};

// 柯里化版本
const setPathCurried = (path: string[]) => (value: any) => <T extends object>(obj: T): T =>
  setPath(obj, path, value);

const getPathCurried = (path: string[]) => <T>(obj: any): T =>
  getPath(obj, path);

// 使用
const user = {
  profile: { name: 'Alice', address: { city: 'Beijing', zip: '100000' } },
  settings: { theme: 'dark', notifications: true },
};

const updated = setPathCurried(['profile', 'address', 'city'])('Shanghai')(user);
// { profile: { name: 'Alice', address: { city: 'Shanghai', zip: '100000' } }, settings: { ... } }

const city = getPathCurried<string>(['profile', 'address', 'city'])(updated);
// 'Shanghai'

// 组合更新
const updateProfile = pipe(
  setPathCurried(['profile', 'name'])('Bob'),
  setPathCurried(['settings', 'theme'])('light'),
  setPathCurried(['settings', 'notifications'])(false)
);

const final = updateProfile(user);
```

---

## 三、柯里化实战 (Currying in Practice)

### 示例 5: 表单验证器工厂

```typescript
// 柯里化验证器
const minLength = (min: number) => (value: string): string | null =>
  value.length >= min ? null : `至少 ${min} 个字符`;

const maxLength = (max: number) => (value: string): string | null =>
  value.length <= max ? null : `最多 ${max} 个字符`;

const matchPattern = (regex: RegExp, message: string) => (value: string): string | null =>
  regex.test(value) ? null : message;

const isEmail = matchPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, '邮箱格式不正确');
const isPhone = matchPattern(/^1[3-9]\d{9}$/, '手机号格式不正确');
const isStrongPassword = (value: string): string | null => {
  const errors = [
    minLength(8)(value),
    matchPattern(/[A-Z]/, '需包含大写字母')(value),
    matchPattern(/[0-9]/, '需包含数字')(value),
  ].filter(Boolean);
  return errors.length === 0 ? null : errors.join('; ');
};

// 组合验证器
const composeValidators =
  (...validators: Array<(value: string) => string | null>) =>
  (value: string): string[] =>
    validators.map(v => v(value)).filter((r): r is string => r !== null);

const validateUsername = composeValidators(
  minLength(2),
  maxLength(20),
  matchPattern(/^[a-zA-Z0-9_]+$/, '只能包含字母/数字/下划线')
);

const validateEmail = composeValidators(minLength(1), isEmail);
const validatePassword = composeValidators(minLength(8), isStrongPassword);

// 表单验证管道
type FieldValidator = {
  validate: (value: string) => string[];
  required?: boolean;
};

type FormSchema = Record<string, FieldValidator>;

const validateForm =
  (schema: FormSchema) =>
  (data: Record<string, string>): Record<string, string[]> => {
    const errors: Record<string, string[]> = {};
    for (const [field, config] of Object.entries(schema)) {
      const value = data[field] ?? '';
      if (config.required && !value) {
        errors[field] = ['必填'];
      } else if (value) {
        const fieldErrors = config.validate(value);
        if (fieldErrors.length > 0) errors[field] = fieldErrors;
      }
    }
    return errors;
  };

// 使用
const userSchema: FormSchema = {
  username: { validate: validateUsername, required: true },
  email: { validate: validateEmail, required: true },
  password: { validate: validatePassword, required: true },
};

const validateUserForm = validateForm(userSchema);
const errors = validateUserForm({
  username: 'a',
  email: 'not-an-email',
  password: '123',
});
// { username: ['至少 2 个字符'], email: ['邮箱格式不正确'], password: ['至少 8 个字符', '需包含大写字母'] }
```

### 示例 6: 数据库查询构建器（函数式 DSL）

```typescript
type QueryBuilder = {
  table: string;
  conditions: string[];
  limit: number | null;
  offset: number | null;
  orderBy: { field: string; direction: 'ASC' | 'DESC' } | null;
};

const createQuery = (table: string): QueryBuilder => ({
  table,
  conditions: [],
  limit: null,
  offset: null,
  orderBy: null,
});

// 柯里化查询方法
const where = (field: string, operator: string, value: any) => (q: QueryBuilder): QueryBuilder => ({
  ...q,
  conditions: [...q.conditions, `${field} ${operator} $${q.conditions.length + 1}`],
  params: [...(q as any).params ?? [], value],
});

const whereIn = (field: string, values: any[]) => (q: QueryBuilder): QueryBuilder => ({
  ...q,
  conditions: [
    ...q.conditions,
    `${field} IN (${values.map((_, i) => `$${q.conditions.length + i + 1}`).join(', ')})`,
  ],
  params: [...(q as any).params ?? [], ...values],
});

const limit = (n: number) => (q: QueryBuilder): QueryBuilder => ({ ...q, limit: n });
const offset = (n: number) => (q: QueryBuilder): QueryBuilder => ({ ...q, offset: n });
const orderBy = (field: string, direction: 'ASC' | 'DESC' = 'ASC') => (q: QueryBuilder): QueryBuilder => ({
  ...q,
  orderBy: { field, direction },
});

// 编译查询
const compileQuery = (q: QueryBuilder): { sql: string; params: any[] } => {
  let sql = `SELECT * FROM ${q.table}`;
  const params = (q as any).params ?? [];

  if (q.conditions.length > 0) {
    sql += ` WHERE ${q.conditions.join(' AND ')}`;
  }
  if (q.orderBy) {
    sql += ` ORDER BY ${q.orderBy.field} ${q.orderBy.direction}`;
  }
  if (q.limit != null) {
    sql += ` LIMIT ${q.limit}`;
  }
  if (q.offset != null) {
    sql += ` OFFSET ${q.offset}`;
  }

  return { sql, params };
};

// 使用 — 函数式管道构建 SQL
const buildUserQuery = pipe(
  createQuery('users'),
  where('age', '>=', 18),
  whereIn('role', ['admin', 'editor']),
  where('status', '=', 'active'),
  orderBy('created_at', 'DESC'),
  limit(10),
  offset(0),
  compileQuery
);

const result = buildUserQuery('users');
// { sql: 'SELECT * FROM users WHERE age >= $1 AND role IN ($2, $3) AND status = $4 ORDER BY created_at DESC LIMIT 10 OFFSET 0',
//   params: [18, 'admin', 'editor', 'active'] }
```

---

## 四、组合模式实战 (Composition Patterns)

### 示例 7: 中间件系统（Express/Koa 风格）

```typescript
type Context = {
  request: { url: string; method: string; headers: Record<string, string>; body?: any };
  response: { status: number; body: any; headers: Record<string, string> };
  state: Record<string, any>;
};

type Middleware = (ctx: Context, next: () => Promise<void>) => Promise<void>;

// 中间件组合（Koa-style）
const compose = (middlewares: Middleware[]) => async (ctx: Context): Promise<void> => {
  const dispatch = async (i: number): Promise<void> => {
    if (i === middlewares.length) return;
    const middleware = middlewares[i];
    await middleware(ctx, () => dispatch(i + 1));
  };
  await dispatch(0);
};

// 纯函数中间件工厂
const loggerMiddleware: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.state.logger = `${ctx.request.method} ${ctx.request.url} - ${ms}ms`;
};

const authMiddleware = (secret: string): Middleware => async (ctx, next) => {
  const token = ctx.request.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    ctx.response.status = 401;
    ctx.response.body = { error: 'Unauthorized' };
    return;
  }
  ctx.state.user = { token, authenticated: true };
  await next();
};

const corsMiddleware: Middleware = async (ctx, next) => {
  ctx.response.headers['Access-Control-Allow-Origin'] = '*';
  ctx.response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE';
  await next();
};

const errorHandlerMiddleware: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.response.status = 500;
    ctx.response.body = { error: 'Internal Server Error' };
  }
};

const jsonMiddleware: Middleware = async (ctx, next) => {
  ctx.response.headers['Content-Type'] = 'application/json';
  await next();
  if (typeof ctx.response.body !== 'string') {
    ctx.response.body = JSON.stringify(ctx.response.body);
  }
};

// 使用
const app = compose([
  errorHandlerMiddleware,
  corsMiddleware,
  loggerMiddleware,
  jsonMiddleware,
  authMiddleware('my-secret'),
]);

// 模拟请求
const ctx: Context = {
  request: { url: '/api/users', method: 'GET', headers: { authorization: 'Bearer token123' } },
  response: { status: 200, body: { users: [] }, headers: {} },
  state: {},
};

await app(ctx);
// ctx.state.logger = 'GET /api/users - Xms'
// ctx.response.headers['Content-Type'] = 'application/json'
```

### 示例 8: 函数式事件系统

```typescript
type EventHandler<T> = (event: T) => void;
type EventSubscription = () => void;

class FunctionalEventBus<T extends string> {
  private listeners = new Map<T, Set<EventHandler<any>>>();

  // 纯函数：订阅返回取消函数
  on = <K extends T>(event: K, handler: EventHandler<Parameters<EventHandler<K>>[0]>): EventSubscription => {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  };

  // 纯函数：触发
  emit = <K extends T>(event: K, data: Parameters<EventHandler<K>>[0]): void => {
    this.listeners.get(event)?.forEach(handler => handler(data));
  };

  // 纯函数：once
  once = <K extends T>(event: K, handler: EventHandler<Parameters<EventHandler<K>>[0]>): EventSubscription => {
    const unsubscribe = this.on(event, (data: any) => {
      handler(data);
      unsubscribe();
    });
    return unsubscribe;
  };
}

// 柯里化事件处理器
const createLogger = (prefix: string) => (event: string, data: any): void => {
  console.log(`[${prefix}] ${event}:`, JSON.stringify(data));
};

const createMetricsTracker = () => {
  const metrics = new Map<string, number>();
  return (event: string): void => {
    metrics.set(event, (metrics.get(event) ?? 0) + 1);
  };
};

// 使用
type AppEvents = 'user:login' | 'user:logout' | 'page:view' | 'error:caught';
const bus = new FunctionalEventBus<AppEvents>();

const log = createLogger('APP');
const track = createMetricsTracker();

bus.on('user:login', (data) => log('user:login', data));
bus.on('page:view', (data) => log('page:view', data));
bus.once('error:caught', (data) => console.error('Fatal:', data));

bus.emit('user:login', { userId: 1, timestamp: Date.now() });
bus.emit('page:view', { path: '/dashboard' });
bus.emit('page:view', { path: '/settings' });
```

---

## 五、函子与 Monad 实用模式

### 示例 9: Result 模式（替代 try/catch）

```typescript
// Result<T, E> — 函数式错误处理
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const Err = <E = Error>(error: E): Result<never, E> => ({ ok: false, error });

// 纯函数：map
const resultMap =
  <T, R>(fn: (value: T) => R) =>
  <E>(result: Result<T, E>): Result<R, E> =>
    result.ok ? Ok(fn(result.value)) : result;

// 纯函数：flatMap / chain
const resultChain =
  <T, R, E>(fn: (value: T) => Result<R, E>) =>
  (result: Result<T, E>): Result<R, E> =>
    result.ok ? fn(result.value) : result;

// 纯函数：orElse / recover
const resultOrElse =
  <T>(defaultValue: T) =>
  <E>(result: Result<T, E>): T =>
    result.ok ? result.value : defaultValue;

// 安全函数包装器
const attempt = <T, E = Error>(fn: () => T): Result<T, E> => {
  try {
    return Ok(fn());
  } catch (err) {
    return Err(err as E);
  }
};

// 异步安全函数包装器
const attemptAsync = async <T, E = Error>(fn: () => Promise<T>): Promise<Result<T, E>> => {
  try {
    return Ok(await fn());
  } catch (err) {
    return Err(err as E);
  }
};

// 使用：管道式错误处理
const parseJSON = (str: string): Result<any, SyntaxError> =>
  attempt(() => JSON.parse(str));

const getUser = (id: number): Result<{ name: string; email: string }, Error> =>
  id > 0 ? Ok({ name: `User ${id}`, email: `user${id}@test.com` }) : Err(new Error('Invalid ID'));

const sendEmail = (email: string): Result<boolean, Error> =>
  email.includes('@') ? Ok(true) : Err(new Error('Invalid email'));

// 组合管道
const processUser = pipe(
  (id: number) => getUser(id),
  resultChain(user => sendEmail(user.email)),
  resultOrElse(false)
);

console.log(processUser(1)); // true
console.log(processUser(-1)); // false

// 使用 Result 替代 try/catch
const safeParse = pipe(
  parseJSON,
  resultMap((data: any) => data.users?.length ?? 0),
  resultOrElse(0)
);

console.log(safeParse('{"users": [1,2,3]}')); // 3
console.log(safeParse('invalid json')); // 0
```

### 示例 10: Maybe 模式（替代 null 检查）

```typescript
// Maybe<T>
type Maybe<T> = {
  isSome: boolean;
  map: <R>(fn: (value: T) => R) => Maybe<R>;
  flatMap: <R>(fn: (value: T) => Maybe<R>) => Maybe<R>;
  orElse: (defaultValue: T) => T;
  fold: <R>(onNone: () => R, onSome: (value: T) => R) => R;
  toArray: () => T[];
};

const Some = <T>(value: T): Maybe<T> => ({
  isSome: true,
  map: fn => Some(fn(value)),
  flatMap: fn => fn(value),
  orElse: () => value,
  fold: (_, onSome) => onSome(value),
  toArray: () => [value],
});

const None = <T = never>(): Maybe<T> => ({
  isSome: false,
  map: () => None(),
  flatMap: () => None(),
  orElse: defaultValue => defaultValue,
  fold: (onNone) => onNone(),
  toArray: () => [],
});

const Maybe = <T>(value: T | null | undefined): Maybe<T> =>
  value == null ? None() : Some(value);

// 柯里化 Maybe 工具
const maybeMap = <T, R>(fn: (value: T) => R) => (m: Maybe<T>): Maybe<R> => m.map(fn);
const maybeFlatMap = <T, R>(fn: (value: T) => Maybe<R>) => (m: Maybe<T>): Maybe<R> => m.flatMap(fn);
const maybeOrElse = <T>(defaultValue: T) => (m: Maybe<T>): T => m.orElse(defaultValue);

// 使用：深层属性访问
type UserConfig = {
  settings?: {
    theme?: {
      primary?: string;
      secondary?: string;
    };
    language?: string;
  };
};

const getTheme = pipe(
  (config: UserConfig) => Maybe(config.settings),
  maybeFlatMap(settings => Maybe(settings.theme)),
  maybeMap(theme => theme.primary ?? '#000'),
  maybeOrElse('#fff')
);

const config1: UserConfig = { settings: { theme: { primary: 'blue' } } };
const config2: UserConfig = { settings: {} };
const config3: UserConfig = {};

console.log(getTheme(config1)); // 'blue'
console.log(getTheme(config2)); // '#fff'
console.log(getTheme(config3)); // '#fff'
```

### 示例 11: Either 模式（业务错误 vs 系统错误）

```typescript
// Either<L, R> — 区分错误类型
type Either<L, R> =
  | { tag: 'left'; left: L }
  | { tag: 'right'; right: R };

const Left = <L>(left: L): Either<L, never> => ({ tag: 'left', left });
const Right = <R>(right: R): Either<never, R> => ({ tag: 'right', right });

// 纯函数
const eitherMap =
  <R, R2>(fn: (right: R) => R2) =>
  <L>(either: Either<L, R>): Either<L, R2> =>
    either.tag === 'right' ? Right(fn(either.right)) : either;

const eitherChain =
  <L, R, R2>(fn: (right: R) => Either<L, R2>) =>
  (either: Either<L, R>): Either<L, R2> =>
    either.tag === 'right' ? fn(either.right) : either;

const eitherMapLeft =
  <L, L2>(fn: (left: L) => L2) =>
  <R>(either: Either<L, R>): Either<L2, R> =>
    either.tag === 'left' ? Left(fn(either.left)) : either;

const eitherFold =
  <L, R, T>(onLeft: (left: L) => T, onRight: (right: R) => T) =>
  (either: Either<L, R>): T =>
    either.tag === 'left' ? onLeft(either.left) : onRight(either.right);

// 使用：业务错误分类
type BusinessError =
  | { type: 'ValidationError'; field: string; message: string }
  | { type: 'NotFoundError'; resource: string; id: string }
  | { type: 'UnauthorizedError'; reason: string };

type UserInput = { name: string; email: string; age: number };

const validateUser = (input: UserInput): Either<BusinessError, UserInput> => {
  if (!input.name || input.name.length < 2)
    return Left({ type: 'ValidationError', field: 'name', message: 'Name too short' });
  if (!input.email.includes('@'))
    return Left({ type: 'ValidationError', field: 'email', message: 'Invalid email' });
  if (input.age < 18)
    return Left({ type: 'ValidationError', field: 'age', message: 'Must be 18+' });
  return Right(input);
};

const saveUser = (user: UserInput): Either<BusinessError, { id: string }> => {
  // 模拟数据库操作
  const id = `user_${Date.now()}`;
  return Right({ id });
};

const sendWelcomeEmail = (email: string): Either<BusinessError, boolean> => {
  return Right(true);
};

// 管道式用户注册
const registerUser = pipe(
  validateUser,
  eitherChain(saveUser),
  eitherMap(result => result.id)
);

const result1 = registerUser({ name: 'Alice', email: 'alice@test.com', age: 25 });
const result2 = registerUser({ name: 'B', email: 'bad-email', age: 16 });

eitherFold(
  (err) => console.log('Error:', err.type, err),
  (id) => console.log('Registered:', id)
)(result1); // Registered: user_xxx

eitherFold(
  (err) => console.log('Error:', err.type, err.field, err.message),
  (id) => console.log('Registered:', id)
)(result2); // Error: ValidationError name Name too short
```

---

## 六、函数式数据结构

### 示例 12: 不可变队列

```typescript
// 不可变队列（双栈实现，O(1) 入队/出队）
type ImmutableQueue<T> = {
  readonly enqueue: (item: T) => ImmutableQueue<T>;
  readonly dequeue: () => { value: T; queue: ImmutableQueue<T> } | null;
  readonly peek: () => T | null;
  readonly size: number;
  readonly isEmpty: boolean;
  readonly toArray: () => T[];
};

const createQueue = <T>(inStack: T[] = [], outStack: T[] = []): ImmutableQueue<T> => ({
  get enqueue(): (item: T) => ImmutableQueue<T> {
    return (item: T) => createQueue([item, ...inStack], outStack);
  },
  get dequeue(): () => { value: T; queue: ImmutableQueue<T> } | null {
    return () => {
      const stack = outStack.length > 0 ? outStack : inStack.reverse();
      if (stack.length === 0) return null;
      const [value, ...rest] = stack;
      return { value, queue: createQueue([], rest) };
    };
  },
  get peek(): () => T | null {
    return () => {
      const stack = outStack.length > 0 ? outStack : inStack.reverse();
      return stack.length > 0 ? stack[0] : null;
    };
  },
  get size(): number {
    return inStack.length + outStack.length;
  },
  get isEmpty(): boolean {
    return inStack.length === 0 && outStack.length === 0;
  },
  get toArray(): () => T[] {
    return () => {
      const stack = outStack.length > 0 ? outStack : inStack.reverse();
      return [...stack, ...inStack];
    };
  },
});

// 使用
const q = createQueue<number>();
const q1 = q.enqueue(1).enqueue(2).enqueue(3);
const d1 = q1.dequeue();
// d1 = { value: 1, queue: ... }
// q1 不变（不可变性）
```

### 示例 13: 不可变 Map（持久化数据结构）

```typescript
// 不可变 Map（基于路径拷贝）
type ImmutableMap<K extends string | number, V> = {
  get: (key: K) => V | undefined;
  set: (key: K, value: V) => ImmutableMap<K, V>;
  delete: (key: K) => ImmutableMap<K, V>;
  has: (key: K) => boolean;
  keys: () => K[];
  values: () => V[];
  entries: () => [K, V][];
  size: number;
  toObject: () => Record<string, V>;
};

const createMap = <K extends string | number, V>(data: Record<string, V> = {}): ImmutableMap<K, V> => ({
  get: (key: K) => data[key as string],
  set: (key: K, value: V) => createMap<K, V>({ ...data, [key as string]: value }),
  delete: (key: K) => {
    const next = { ...data };
    delete next[key as string];
    return createMap<K, V>(next);
  },
  has: (key: K) => key in data,
  keys: () => Object.keys(data) as K[],
  values: () => Object.values(data),
  entries: () => Object.entries(data) as [K, V][],
  get size() {
    return Object.keys(data).length;
  },
  toObject: () => ({ ...data }),
});

// 使用
const m1 = createMap<string, number>();
const m2 = m1.set('a', 1).set('b', 2).set('c', 3);
const m3 = m2.set('b', 20); // m2 不变
const m4 = m3.delete('c');

console.log(m2.get('b')); // 2 (不变)
console.log(m3.get('b')); // 20
console.log(m4.size); // 2
```

---

## 七、函数式工具函数库

### 示例 14: 函数式工具函数集合

```typescript
// 1. tap — 管道中执行副作用（调试/日志）
const tap =
  <T>(fn: (value: T) => void) =>
  (value: T): T => {
    fn(value);
    return value;
  };

// 2. identity — 恒等函数
const identity = <T>(x: T): T => x;

// 3. constant — 常量函数
const constant = <T>(value: T) => (): T => value;

// 4. prop — 属性访问器（柯里化）
const prop =
  <K extends string>(key: K) =>
  <T extends Record<K, any>>(obj: T): T[K] =>
    obj[key];

// 5. props — 多属性选择器
const props =
  <K extends string>(keys: K[]) =>
  <T extends Record<string, any>>(obj: T): Partial<Record<K, T[K]>> =>
    Object.fromEntries(keys.map(k => [k, obj[k]])) as any;

// 6. negate — 取反谓词
const negate =
  <T>(fn: (value: T) => boolean) =>
  (value: T): boolean =>
    !fn(value);

// 7. both — 两个谓词都满足
const both =
  <T>(f: (value: T) => boolean, g: (value: T) => boolean) =>
  (value: T): boolean =>
    f(value) && g(value);

// 8. either — 任一谓词满足
const eitherPred =
  <T>(f: (value: T) => boolean, g: (value: T) => boolean) =>
  (value: T): boolean =>
    f(value) || g(value);

// 9. uniqBy — 去重（自定义比较）
const uniqBy =
  <T>(fn: (value: T) => any) =>
  (arr: T[]): T[] => {
    const seen = new Set();
    return arr.filter(item => {
      const key = fn(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

// 10. groupBy — 分组
const groupBy =
  <T>(fn: (value: T) => string) =>
  (arr: T[]): Record<string, T[]> =>
    arr.reduce((groups, item) => {
      const key = fn(item);
      return { ...groups, [key]: [...(groups[key] ?? []), item] };
    }, {} as Record<string, T[]>);

// 11. partition — 分割（满足/不满足）
const partition =
  <T>(predicate: (value: T) => boolean) =>
  (arr: T[]): [T[], T[]] =>
    arr.reduce(
      ([pass, fail], item) =>
        predicate(item) ? [[...pass, item], fail] : [pass, [...fail, item]],
      [[], []] as [T[], T[]]
    );

// 12. zip — 配对
const zip = <A, B>(a: A[], b: B[]): [A, B][] =>
  a.map((item, i) => [item, b[i]] as [A, B]).filter(([, b]) => b !== undefined);

// 使用示例
const users = [
  { name: 'Alice', age: 28, role: 'admin' },
  { name: 'Bob', age: 35, role: 'user' },
  { name: 'Charlie', age: 28, role: 'user' },
];

// groupBy + pipe
const byAge = pipe(
  groupBy(prop('age')),
  tap(groups => console.log('Groups by age:', Object.keys(groups)))
)(users);

// partition
const [adults, minors] = partition((u: typeof users[0]) => u.age >= 30)(users);

// uniqBy
const uniqueAges = pipe(
  users.map(prop('age')),
  uniqBy(identity)
);
```

---

## 八、综合实战

### 示例 15: 函数式电商订单处理系统

```typescript
// ===== 类型定义 =====
type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type Order = {
  id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: number;
};

type OrderResult = Either<BusinessError, Order>;

type BusinessError =
  | { type: 'OutOfStock'; productId: string }
  | { type: 'InvalidQuantity'; message: string }
  | { type: 'EmptyCart' };

// ===== 纯函数 =====

// 1. 验证商品库存
const validateStock = (product: Product, quantity: number): OrderResult => {
  if (!product.inStock) return Left({ type: 'OutOfStock', productId: product.id });
  if (quantity < 1) return Left({ type: 'InvalidQuantity', message: 'Quantity must be >= 1' });
  if (quantity > 99) return Left({ type: 'InvalidQuantity', message: 'Max 99 per item' });
  return Right({ product, quantity });
};

// 2. 计算小计
const calculateSubtotal = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

// 3. 计算折扣（柯里化策略）
const createDiscountStrategy = (type: 'percentage' | 'fixed', value: number) => (subtotal: number): number => {
  switch (type) {
    case 'percentage': return Math.round(subtotal * value / 100 * 100) / 100;
    case 'fixed': return Math.min(value, subtotal);
  }
};

const percentageDiscount = createDiscountStrategy('percentage');
const fixedDiscount = createDiscountStrategy('fixed');

// 4. 计算税费
const calculateTax = (rate: number) => (subtotal: number, discount: number): number =>
  Math.round((subtotal - discount) * rate * 100) / 100;

const standardTax = calculateTax(0.13); // 13% VAT

// 5. 构建订单
const buildOrder = (items: CartItem[]): OrderResult => {
  if (items.length === 0) return Left({ type: 'EmptyCart' });

  const subtotal = calculateSubtotal(items);
  const discount = percentageDiscount(10)(subtotal); // 10% off
  const tax = standardTax(subtotal, discount);
  const total = Math.round((subtotal - discount + tax) * 100) / 100;

  return Right({
    id: `order_${Date.now()}`,
    items,
    subtotal,
    discount,
    tax,
    total,
    status: 'pending',
    createdAt: Date.now(),
  });
};

// 6. 订单状态转换（纯函数状态机）
const transitionOrder = (order: Order, action: string): OrderResult => {
  const transitions: Record<string, string[]> = {
    confirm: ['pending'],
    ship: ['confirmed'],
    deliver: ['shipped'],
    cancel: ['pending', 'confirmed'],
  };

  const allowed = transitions[action];
  if (!allowed) return Left({ type: 'InvalidQuantity', message: `Unknown action: ${action}` });
  if (!allowed.includes(order.status)) {
    return Left({ type: 'InvalidQuantity', message: `Cannot ${action} from ${order.status}` });
  }

  const statusMap: Record<string, Order['status']> = {
    confirm: 'confirmed',
    ship: 'shipped',
    deliver: 'delivered',
    cancel: 'cancelled',
  };

  return Right({ ...order, status: statusMap[action] });
};

// 7. 订单报告（纯函数查询）
const createOrderReport = (orders: Order[]) => ({
  totalOrders: orders.length,
  byStatus: groupBy(prop('status'))(orders),
  totalRevenue: orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0),
  avgOrderValue: orders.length > 0
    ? orders.reduce((sum, o) => sum + o.total, 0) / orders.length
    : 0,
  topCategories: pipe(
    orders.flatMap(o => o.items.map(i => i.product.category)),
    groupBy(identity),
    Object.entries,
    entries => entries.map(([cat, items]) => ({ category: cat, count: items.length })),
    entries => [...entries].sort((a, b) => b.count - a.count)
  ),
});

// ===== 使用 =====

const products: Product[] = [
  { id: 'p1', name: 'Laptop', price: 999.99, category: 'electronics', inStock: true },
  { id: 'p2', name: 'Book', price: 29.99, category: 'books', inStock: true },
  { id: 'p3', name: 'Headphones', price: 149.99, category: 'electronics', inStock: false },
];

// 创建订单
const cart: CartItem[] = [
  { product: products[0], quantity: 1 },
  { product: products[1], quantity: 2 },
];

const orderResult = buildOrder(cart);

eitherFold(
  (err) => console.log('Order failed:', err),
  (order) => {
    console.log('Order created:', order.id, 'Total:', order.total);
    // 确认订单
    const confirmed = transitionOrder(order, 'confirm');
    eitherFold(
      (err) => console.log('Transition failed:', err),
      (confirmedOrder) => console.log('Order confirmed:', confirmedOrder.status)
    )(confirmed);
  }
)(orderResult);

// 生成报告
const report = createOrderReport([
  { ...orderResult, status: 'confirmed' } as any,
]);
```

### 示例 16: 函数式配置系统

```typescript
// 不可变配置树 + 函数式覆盖
type Config = Record<string, any>;

// 深合并（不可变）
const deepMerge = <T extends Config>(base: T, override: Partial<T>): T => {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overrideVal = (override as any)[key];
    if (
      baseVal != null &&
      overrideVal != null &&
      typeof baseVal === 'object' &&
      typeof overrideVal === 'object' &&
      !Array.isArray(baseVal) &&
      !Array.isArray(overrideVal)
    ) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else {
      result[key] = overrideVal;
    }
  }
  return result;
};

// 配置工厂（柯里化）
const createConfig = (defaults: Config) => ({
  // 合并环境配置
  withEnv: (env: Config) => createConfig(deepMerge(defaults, env)),
  // 合并用户配置
  withUser: (user: Config) => createConfig(deepMerge(defaults, user)),
  // 读取值
  get: <T>(path: string, defaultValue?: T): T => getPath(defaults, path.split('.'), defaultValue),
  // 获取完整配置
  value: () => ({ ...defaults }),
});

// 使用
const defaultConfig = createConfig({
  server: { port: 3000, host: 'localhost', ssl: false },
  database: { host: 'localhost', port: 5432, name: 'myapp' },
  features: { darkMode: false, notifications: true },
});

const envConfig = defaultConfig.withEnv({
  server: { port: 8080, ssl: true },
  database: { host: 'db.production.com' },
});

const userConfig = envConfig.withUser({
  features: { darkMode: true },
});

console.log(userConfig.get('server.port')); // 8080
console.log(userConfig.get('server.ssl')); // true
console.log(userConfig.get('database.name')); // 'myapp' (继承默认值)
console.log(userConfig.get('features.darkMode')); // true

// 配置验证管道
const validateConfig = pipe(
  (config: Config) => Either.Right(config),
  eitherChain((config: Config) =>
    config.server?.port > 0 ? Either.Right(config) : Left({ type: 'ValidationError', field: 'server.port', message: 'Invalid port' })
  ),
  eitherChain((config: Config) =>
    config.database?.host ? Either.Right(config) : Left({ type: 'ValidationError', field: 'database.host', message: 'Required' })
  )
);
```

### 示例 17: 函数式动画/过渡系统

```typescript
// 纯函数缓动函数
const easeFunctions = {
  linear: (t: number): number => t,
  easeIn: (t: number): number => t * t,
  easeOut: (t: number): number => t * (2 - t),
  easeInOut: (t: number): number => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInElastic: (t: number): number => {
    if (t === 0 || t === 1) return t;
    return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
  },
  easeOutBounce: (t: number): number => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
};

// 动画配置（不可变）
type AnimationConfig = {
  from: number;
  to: number;
  duration: number;
  easing: (t: number) => number;
  onComplete?: () => void;
};

// 纯函数：计算当前帧值
const interpolate = (config: AnimationConfig, elapsed: number): number => {
  const progress = Math.min(elapsed / config.duration, 1);
  const easedProgress = config.easing(progress);
  return config.from + (config.to - config.from) * easedProgress;
};

// 组合动画（纯函数）
const composeAnimations =
  (...configs: AnimationConfig[]) =>
  (elapsed: number): number[] =>
    configs.map(config => interpolate(config, elapsed));

// 关键帧动画（纯函数管道）
type Keyframe = { time: number; value: number; easing?: (t: number) => number };

const createKeyframeAnimation = (keyframes: Keyframe[]) => (elapsed: number): number => {
  if (elapsed <= keyframes[0].time) return keyframes[0].value;
  if (elapsed >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const current = keyframes[i];
    const next = keyframes[i + 1];
    if (elapsed >= current.time && elapsed <= next.time) {
      const localElapsed = elapsed - current.time;
      const duration = next.time - current.time;
      const easing = next.easing || easeFunctions.linear;
      const progress = localElapsed / duration;
      return current.value + (next.value - current.value) * easing(progress);
    }
  }
  return keyframes[keyframes.length - 1].value;
};

// 使用
const fadeIn = createKeyframeAnimation([
  { time: 0, value: 0, easing: easeFunctions.easeOut },
  { time: 300, value: 1, easing: easeFunctions.easeOut },
]);

const slideIn = createKeyframeAnimation([
  { time: 0, value: -100, easing: easeFunctions.easeOutBounce },
  { time: 500, value: 0 },
]);

const combined = composeAnimations(
  { from: 0, to: 1, duration: 300, easing: easeFunctions.easeOut },
  { from: -100, to: 0, duration: 500, easing: easeFunctions.easeOutBounce }
);

console.log(interpolate({ from: 0, to: 100, duration: 1000, easing: easeFunctions.easeInOut }, 500)); // 50
console.log(combined(200)); // [0.31, -60.9]
```

---

## 九、TypeScript 类型安全增强

### 示例 18: 类型安全的函数组合

```typescript
// 类型安全的 compose
type Func<A, B> = (a: A) => B;

// 2 函数组合
const compose2 = <A, B, C>(f: Func<B, C>, g: Func<A, B>): Func<A, C> =>
  (a: A) => f(g(a));

// 3 函数组合
const compose3 = <A, B, C, D>(f: Func<C, D>, g: Func<B, C>, h: Func<A, B>): Func<A, D> =>
  (a: A) => f(g(h(a)));

// 类型安全的 pipe
const pipe2 = <A, B, C>(g: Func<A, B>, f: Func<B, C>): Func<A, C> =>
  (a: A) => f(g(a));

// 类型安全的 curry
const curry2 = <A, B, C>(fn: (a: A, b: B) => C): ((a: A) => (b: B) => C) =>
  (a: A) => (b: B) => fn(a, b);

const curry3 = <A, B, C, D>(fn: (a: A, b: B, c: C) => D): ((a: A) => (b: B) => (c: C) => D) =>
  (a: A) => (b: B) => (c: C) => fn(a, b, c);

// 使用
const add = (a: number, b: number): number => a + b;
const multiply = (a: number, b: number): number => a * b;
const toString = (n: number): string => n.toString();

const addCurried = curry2(add); // (a: number) => (b: number) => number
const multiplyCurried = curry2(multiply);

const add5 = addCurried(5); // (b: number) => number
const double = multiplyCurried(2); // (b: number) => number

// 类型安全管道
const pipeline = pipe2(
  add5,       // number → number
  double,     // number → number
  toString    // number → string
);

console.log(pipeline(10)); // '30'
```

---

## 速查表

### FP 核心概念

| 概念 | 定义 | 示例 |
|------|------|------|
| 纯函数 | 相同输入→相同输出，无副作用 | `map`, `filter`, `reduce` |
| 不可变性 | 数据不修改，返回新值 | `{...obj, key: value}` |
| 组合 | 小函数组合成大函数 | `pipe(f, g, h)` |
| 柯里化 | 多参数→单参数链 | `f(a)(b)(c)` |
| Point-Free | 不显式写参数 | `map(prop('name'))` |
| 函子 | 有 map 的容器 | `Maybe`, `Either`, `Result` |
| Monad | 有 flatMap 的容器 | `Result.chain` |

### 18 个示例清单

| # | 名称 | 场景 | 核心 FP 概念 |
|---|------|------|-------------|
| 1 | 用户数据清洗管道 | 数据 ETL | 纯函数 + 组合 + 不可变 |
| 2 | 通用管道工厂 | 可复用管道 | 柯里化 + 链式调用 |
| 3 | 不可变 Todo 状态机 | 状态管理 | 不可变 + 纯函数查询 |
| 4 | 不可变更新工具 | 深层更新 | 柯里化 + 路径操作 |
| 5 | 表单验证器工厂 | 表单验证 | 柯里化 + 组合 |
| 6 | SQL 查询构建器 | 数据库 DSL | 柯里化 + 管道 |
| 7 | 中间件系统 | Web 框架 | 组合 + 柯里化 |
| 8 | 函数式事件系统 | 事件驱动 | 柯里化 + 纯函数 |
| 9 | Result 模式 | 错误处理 | 函子 + Monad |
| 10 | Maybe 模式 | null 安全 | 函子 + 柯里化 |
| 11 | Either 模式 | 错误分类 | 函子 + 组合 |
| 12 | 不可变队列 | 数据结构 | 不可变性 |
| 13 | 不可变 Map | 数据结构 | 不可变性 + 柯里化 |
| 14 | 函数式工具集 | 通用工具 | 柯里化 + 组合 |
| 15 | 电商订单系统 | 业务逻辑 | 全部 FP 概念 |
| 16 | 配置系统 | 配置管理 | 不可变 + 柯里化 |
| 17 | 动画系统 | UI 动画 | 纯函数 + 组合 |
| 18 | 类型安全组合 | TypeScript | 类型推导 + 组合 |

---

## 总结

本次训练从 **18 个实战示例** 覆盖了函数式编程在真实开发中的核心模式：

1. **纯函数** — 所有示例的核心，确保可测试性和可组合性
2. **不可变性** — 状态管理/数据结构的基石
3. **组合** — pipe/compose 串联复杂逻辑
4. **柯里化** — 工厂函数/配置/策略模式的基础
5. **函子/Monad** — Result/Maybe/Either 替代 try/catch 和 null 检查

累计 FP 训练：
- 4/23 基础版 (纯函数/高阶函数/柯里化/组合/不可变性)
- 4/24 巩固版 (纯函数/不可变性/组合/柯里化/综合实战)
- 4/26 进阶版 (Point-Free/Functor/Applicative/Monad/数据结构/架构)
- 4/27 实战版 (18 个真实场景示例) = 完整闭环 ✅
