# 函数式编程进阶训练 - 06:00

**日期:** 2026 年 4 月 26 日 星期日  
**主题:** FP 进阶模式 — Point-Free / Functor / Applicative / Monad / 类型安全 / 实战架构  
**前置:** 已掌握纯函数、不可变性、compose/pipe、柯里化 (04/23, 04/24 基础训练)

---

## 一、Point-Free 风格 (无参数风格)

Point-Free 的核心：通过函数组合和柯里化，让函数定义中**不出现参数**。

### 示例 1: 从普通到 Point-Free
```javascript
// 普通风格 — 有参数
const getFirstLetter = (str) => str.charAt(0).toUpperCase();

// Point-Free — 无参数
const charAt = (n) => (str) => str.charAt(n);
const toUpper = (str) => str.toUpperCase();
const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);

const getFirstLetterFP = pipe(charAt(0), toUpper);

getFirstLetterFP("hello"); // "H"
getFirstLetterFP("world"); // "W"
```

### 示例 2: 复杂 Point-Free 管道
```javascript
// 工具函数集
const map = (fn) => (arr) => arr.map(fn);
const filter = (fn) => (arr) => arr.filter(fn);
const reduce = (fn) => (init) => (arr) => arr.reduce(fn, init);
const prop = (key) => (obj) => obj[key];
const gt = (n) => (x) => x > n;
const add = (a) => (b) => a + b;

// 数据
const scores = [
  { name: "Alice", score: 92 },
  { name: "Bob", score: 78 },
  { name: "Charlie", score: 85 },
  { name: "Dave", score: 60 },
  { name: "Eve", score: 95 }
];

// Point-Free 管道：筛选 >80 分 → 取分数 → 求平均
const average = (arr) =>
  arr.reduce((sum, x, i, a) => sum + x / a.length, 0);

const highScoreAvg = pipe(
  filter(gt(80)),
  map(prop("score")),
  average
);

highScoreAvg(scores); // (92 + 85 + 95) / 3 = 90.67

// 纯 Point-Free 版本（完全无参数）
const sumScores = pipe(
  filter(gt(80)),
  map(prop("score")),
  reduce(add(0))(0)
);

sumScores(scores); // 272
```

### 示例 3: Point-Free 在验证中的应用
```javascript
const isString = (x) => typeof x === "string";
const isNonEmpty = (s) => s.length > 0;
const trim = (s) => s.trim();
const minLength = (n) => (s) => s.length >= n;
const matches = (regex) => (s) => regex.test(s);

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Point-Free 验证组合
const isValidEmail = pipe(
  isString,
  // 注意：这里需要特殊处理，因为 isString 返回 boolean 而非 string
  // 实际中常用 Either/Result 类型来处理
);

// 更实用的 Point-Free 验证管道（使用 Result 模式）
const Result = {
  ok: (v) => ({ value: v, error: null, isOk: true }),
  err: (e) => ({ value: null, error: e, isOk: false }),
  map: (fn) => (r) => r.isOk ? Result.ok(fn(r.value)) : r,
  chain: (fn) => (r) => r.isOk ? fn(r.value) : r,
};

const validateString = (input) =>
  isString(input)
    ? Result.ok(input)
    : Result.err("Input must be a string");

const validateNotEmpty = (input) =>
  isNonEmpty(input)
    ? Result.ok(input)
    : Result.err("Input must not be empty");

const validateMinLength = (n) => (input) =>
  minLength(n)(input)
    ? Result.ok(input)
    : Result.err(`Input must be at least ${n} characters`);

const validateEmail = (input) =>
  matches(emailRegex)(input)
    ? Result.ok(input)
    : Result.err("Invalid email format");

// 组合验证管道
const validateEmailPipeline = (input) =>
  pipe(
    validateString,
    (r) => Result.chain(validateNotEmpty)(r),
    (r) => Result.chain(validateMinLength(5))(r),
    (r) => Result.chain(validateEmail)(r)
  )(Result.ok(input));

validateEmailPipeline("test@example.com");
// { value: "test@example.com", error: null, isOk: true }

validateEmailPipeline("ab");
// { value: null, error: "Input must be at least 5 characters", isOk: false }
```

---

## 二、函子 (Functor) 深入

函子：实现 `map` 方法的容器，满足恒等律和组合律。

### 示例 4: Identity 函子
```javascript
class Identity {
  constructor(value) {
    this.value = value;
  }

  static of(value) {
    return new Identity(value);
  }

  map(fn) {
    return Identity.of(fn(this.value));
  }

  toString() {
    return `Identity(${this.value})`;
  }
}

// 恒等律: map(identity) === identity
const identity = (x) => x;
Identity.of(5).map(identity).toString(); // "Identity(5)"

// 组合律: map(f).map(g) === map(g ∘ f)
const double = (x) => x * 2;
const add1 = (x) => x + 1;

Identity.of(5)
  .map(double)
  .map(add1)
  .toString(); // "Identity(11)"

Identity.of(5)
  .map((x) => add1(double(x)))
  .toString(); // "Identity(11)" — 相同结果
```

### 示例 5: Task 函子 — 异步函数式编程
```javascript
class Task {
  constructor(run) {
    this.run = run;
  }

  static of(value) {
    return new Task((resolve) => resolve(value));
  }

  map(fn) {
    return new Task((resolve) =>
      this.run((value) => resolve(fn(value)))
    );
  }

  chain(fn) {
    return new Task((resolve) =>
      this.run((value) => fn(value).run(resolve))
    );
  }
}

// 模拟异步操作
const fetchUser = (id) =>
  new Task((resolve) =>
    setTimeout(() => resolve({ id, name: `User${id}`, email: `user${id}@example.com` }), 100)
  );

const fetchPosts = (user) =>
  new Task((resolve) =>
    setTimeout(() => resolve([
      { id: 1, title: `${user.name}'s Post 1` },
      { id: 2, title: `${user.name}'s Post 2` }
    ]), 100)
  );

const formatPosts = (posts) =>
  posts.map((p) => `📝 ${p.title}`).join("\n");

// 异步管道：获取用户 → 获取帖子 → 格式化
const getUserPosts = (id) =>
  fetchUser(id)
    .chain(fetchPosts)
    .map(formatPosts);

// 执行
getUserPosts(42).run((result) => {
  console.log(result);
  // 📝 User42's Post 1
  // 📝 User42's Post 2
});
```

### 示例 6: IO 函子 — 延迟副作用
```javascript
class IO {
  constructor(fn) {
    this.value = fn;
  }

  static of(value) {
    return new IO(() => value);
  }

  map(fn) {
    return new IO(() => fn(this.value()));
  }
}

// 纯函数式地描述副作用，但不执行
const getLine = (prompt) =>
  new IO(() => {
    // 实际环境中会调用 readline
    console.log(prompt);
    return "user input";
  });

const log = (msg) =>
  new IO(() => {
    console.log(msg);
    return msg;
  });

// 组合 IO 操作 — 纯描述，不执行
const program = getLine("Enter your name:")
  .map((name) => name.trim().toUpperCase())
  .map((name) => `Hello, ${name}!`)
  .chain((greeting) => log(greeting));

// 只有调用 value() 才真正执行副作用
// program.value();
```

---

## 三、Applicative Functor

Applicative 函子允许将**包裹在容器中的函数**应用到**包裹在容器中的值**。

### 示例 7: Maybe 的 Applicative 实现
```javascript
class Maybe {
  constructor(value) {
    this.value = value;
  }

  static of(value) {
    return new Maybe(value);
  }

  static none() {
    return new Maybe(null);
  }

  isNone() {
    return this.value === null || this.value === undefined;
  }

  map(fn) {
    return this.isNone() ? Maybe.none() : Maybe.of(fn(this.value));
  }

  // Applicative: ap
  ap(maybeFn) {
    return this.isNone() || maybeFn.isNone()
      ? Maybe.none()
      : Maybe.of(maybeFn.value(this.value));
  }

  toString() {
    return this.isNone() ? "None" : `Just(${this.value})`;
  }
}

// 使用 ap 组合多个 Maybe
const add = (a) => (b) => a + b;

const maybeAdd = Maybe.of(add);
const maybe3 = Maybe.of(3);
const maybe5 = Maybe.of(5);

// Maybe.of(add).ap(Maybe.of(3)).ap(Maybe.of(5))
const result = maybeAdd.ap(maybe3).ap(maybe5);
result.toString(); // "Just(8)"

// 其中一个是 None
const maybeNull = Maybe.none();
Maybe.of(add).ap(maybeNull).ap(maybe5).toString(); // "None"
```

### 示例 8: Either 的 Applicative
```javascript
class Either {
  static left(value) { return new Left(value); }
  static right(value) { return new Right(value); }
}

class Left {
  constructor(value) { this.value = value; }
  map() { return this; }
  ap(other) { return this; }
  isLeft() { return true; }
  isRight() { return false; }
  toString() { return `Left(${this.value})`; }
}

class Right {
  constructor(value) { this.value = value; }
  map(fn) { return Either.right(fn(this.value)); }
  ap(other) {
    return other.isRight()
      ? Either.right(other.value(this.value))
      : other;
  }
  isLeft() { return false; }
  isRight() { return true; }
  toString() { return `Right(${this.value})`; }
}

// 验证用户名和邮箱，收集所有错误
const validateName = (name) =>
  name.length >= 2 ? Either.right(name) : Either.left("Name too short");

const validateEmail2 = (email) =>
  email.includes("@") ? Either.right(email) : Either.left("Invalid email");

// 用 Applicative 组合验证
const createUser = (name) => (email) => ({ name, email });

const result1 = Either.right(createUser)
  .ap(validateName("Alice"))
  .ap(validateEmail2("alice@example.com"));
result1.toString(); // 'Right({ name: "Alice", email: "alice@example.com" })'

const result2 = Either.right(createUser)
  .ap(validateName("A"))
  .ap(validateEmail2("invalid"));
result2.toString(); // "Left(Name too short)" — 短路
```

---

## 四、Monad 深入

Monad = Applicative + chain (flatMap)，解决嵌套容器问题。

### 示例 9: Reader Monad — 依赖注入
```javascript
class Reader {
  constructor(run) {
    this.run = run;
  }

  static of(value) {
    return new Reader(() => value);
  }

  map(fn) {
    return new Reader((env) => fn(this.run(env)));
  }

  chain(fn) {
    return new Reader((env) => fn(this.run(env)).run(env));
  }
}

// 依赖注入：所有函数依赖 env，但不直接引用它
const getConfig = (key) =>
  new Reader((env) => env[key]);

const getDbUrl = () =>
  getConfig("databaseUrl");

const connect = (dbUrl) =>
  Reader.of({ connected: true, url: dbUrl });

const query = (connection) => (sql) =>
  Reader.of({ sql, rows: [{ id: 1, name: "Alice" }] });

// 组合数据库操作
const getUserById = (id) =>
  getDbUrl()
    .chain(connect)
    .chain((conn) => query(conn)(`SELECT * FROM users WHERE id = ${id}`));

// 运行时注入环境
const env = {
  databaseUrl: "postgres://localhost:5432/mydb",
  apiKey: "secret-key-123",
  debug: false
};

const result = getUserById(42).run(env);
console.log(result);
// { sql: "SELECT * FROM users WHERE id = 42", rows: [...] }
```

### 示例 10: State Monad — 纯函数式状态管理
```javascript
class State {
  constructor(run) {
    this.run = run;
  }

  static of(value) {
    return new State((state) => [value, state]);
  }

  map(fn) {
    return new State((state) => {
      const [value, newState] = this.run(state);
      return [fn(value), newState];
    });
  }

  chain(fn) {
    return new State((state) => {
      const [value, newState] = this.run(state);
      return fn(value).run(newState);
    });
  }

  static get = new State((state) => [state, state]);

  static put = (newState) =>
    new State(() => [undefined, newState]);

  static modify(fn) {
    return new State((state) => [undefined, fn(state)]);
  }
}

// 状态操作
const increment = (by = 1) =>
  State.modify((state) => ({ ...state, count: state.count + by }));

const setName = (name) =>
  State.modify((state) => ({ ...state, name }));

const getCount = () =>
  State.get.map((state) => state.count);

// 组合状态操作
const program = increment(5)
  .chain(() => setName("Alice"))
  .chain(() => getCount());

// 执行 — 纯函数，无副作用
const initialState = { count: 0, name: "Bob" };
const [result, finalState] = program.run(initialState);

console.log(result);     // 5 (count)
console.log(finalState); // { count: 5, name: "Alice" }
console.log(initialState); // { count: 0, name: "Bob" } — 原状态不变！
```

### 示例 11: Writer Monad — 日志记录
```javascript
class Writer {
  constructor(value, log = []) {
    this.value = value;
    this.log = log;
  }

  static of(value) {
    return new Writer(value);
  }

  map(fn) {
    return new Writer(fn(this.value), this.log);
  }

  chain(fn) {
    const next = fn(this.value);
    return new Writer(next.value, [...this.log, ...next.log]);
  }

  toString() {
    return `Writer(value: ${this.value}, log: [${this.log.join(", ")}])`;
  }
}

// 带日志的纯函数
const addWithLog = (a, b) =>
  new Writer(a + b, [`Adding ${a} + ${b}`]);

const multiplyWithLog = (a, b) =>
  new Writer(a * b, [`Multiplying ${a} × ${b}`]);

// 组合带日志的计算
const calculate = (x, y, z) =>
  addWithLog(x, y)
    .chain((sum) => multiplyWithLog(sum, z));

const result = calculate(3, 4, 5);
console.log(result.toString());
// Writer(value: 35, log: [Adding 3 + 4, Multiplying 7 × 5])
```

---

## 五、函数式数据结构

### 示例 12: 不可变链表
```javascript
// 不可变链表 — 纯函数式数据结构
class LinkedList {
  constructor(head, tail = null) {
    this.head = head;
    this.tail = tail;
  }

  static empty = new (class extends LinkedList {
    constructor() { super(null, null); }
    get isEmpty() { return true; }
    map() { return this; }
    filter() { return this; }
    reduce(init) { return init; }
    toString() { return "Nil"; }
  })();

  static of(...items) {
    return items.reduceRight(
      (acc, item) => new LinkedList(item, acc),
      LinkedList.empty
    );
  }

  get isEmpty() { return false; }

  map(fn) {
    return new LinkedList(
      fn(this.head),
      this.tail.map(fn)
    );
  }

  filter(fn) {
    return fn(this.head)
      ? new LinkedList(this.head, this.tail.filter(fn))
      : this.tail.filter(fn);
  }

  reduce(fn, init) {
    return this.tail.reduce(fn, fn(init, this.head));
  }

  toString() {
    return `${this.head} → ${this.tail.toString()}`;
  }

  toArray() {
    return this.reduce((acc, x) => [...acc, x], []);
  }
}

// 使用
const list = LinkedList.of(1, 2, 3, 4, 5);
console.log(list.toString()); // "1 → 2 → 3 → 4 → 5 → Nil"

const doubled = list.map((x) => x * 2);
console.log(doubled.toString()); // "2 → 4 → 6 → 8 → 10 → Nil"
console.log(list.toString());    // 原链表不变！

const evens = list.filter((x) => x % 2 === 0);
console.log(evens.toArray()); // [2, 4]

const sum = list.reduce((acc, x) => acc + x, 0);
console.log(sum); // 15
```

### 示例 13: 不可变二叉搜索树
```javascript
class BST {
  static empty = new (class extends BST {
    constructor() { super(null, null, null); }
    get isEmpty() { return true; }
    insert(v) { return new BST(v, BST.empty, BST.empty); }
    contains(v) { return false; }
    toArray() { return []; }
    map(fn) { return this; }
  })();

  constructor(value, left, right) {
    this.value = value;
    this.left = left;
    this.right = right;
  }

  get isEmpty() { return false; }

  insert(value) {
    if (value < this.value) {
      return new BST(this.value, this.left.insert(value), this.right);
    }
    if (value > this.value) {
      return new BST(this.value, this.left, this.right.insert(value));
    }
    return this; // 重复值，返回原树
  }

  contains(value) {
    if (value === this.value) return true;
    return value < this.value
      ? this.left.contains(value)
      : this.right.contains(value);
  }

  // 中序遍历 — 返回排序数组
  toArray() {
    return [
      ...this.left.toArray(),
      this.value,
      ...this.right.toArray()
    ];
  }

  map(fn) {
    return new BST(
      fn(this.value),
      this.left.map(fn),
      this.right.map(fn)
    );
  }
}

// 使用
const tree = [5, 3, 7, 1, 4, 6, 8].reduce(
  (acc, v) => acc.insert(v),
  BST.empty
);

console.log(tree.toArray()); // [1, 2, 3, 4, 5, 6, 7, 8]
console.log(tree.contains(4)); // true
console.log(tree.contains(9)); // false

// 不可变 — 插入后原树不变
const tree2 = tree.insert(2);
console.log(tree.toArray());  // [1, 3, 4, 5, 6, 7, 8] — 原树不变
console.log(tree2.toArray()); // [1, 2, 3, 4, 5, 6, 7, 8] — 新树包含 2
```

---

## 六、函数式架构模式

### 示例 14: Railway-Oriented Programming (管道式错误处理)
```javascript
// Result 类型：成功或失败
const Result = {
  ok: (v) => ({
    isOk: true,
    map: (fn) => Result.ok(fn(v)),
    chain: (fn) => fn(v),
    mapError: () => Result.ok(v),
    recover: () => Result.ok(v),
    fold: (onErr, onSuccess) => onSuccess(v),
    toString: () => `Ok(${v})`
  }),
  err: (e) => ({
    isOk: false,
    map: () => Result.err(e),
    chain: () => Result.err(e),
    mapError: (fn) => Result.err(fn(e)),
    recover: (fn) => Result.ok(fn(e)),
    fold: (onErr) => onErr(e),
    toString: () => `Err(${e})`
  })
};

// 管道式验证
const parseJSON = (str) => {
  try {
    return Result.ok(JSON.parse(str));
  } catch (e) {
    return Result.err(`JSON parse error: ${e.message}`);
  }
};

const hasField = (field) => (obj) =>
  field in obj
    ? Result.ok(obj)
    : Result.err(`Missing field: ${field}`);

const validateAge = (obj) =>
  typeof obj.age === "number" && obj.age > 0 && obj.age < 150
    ? Result.ok(obj)
    : Result.err("Invalid age");

// 组合管道
const processUser = (input) =>
  parseJSON(input)
    .chain(hasField("name"))
    .chain(hasField("age"))
    .chain(validateAge)
    .map((user) => ({ ...user, createdAt: new Date().toISOString() }));

// 成功路径
const result1 = processUser('{"name": "Alice", "age": 25}');
result1.fold(
  (err) => console.error("Error:", err),
  (user) => console.log("User created:", user)
);
// User created: { name: "Alice", age: 25, createdAt: "..." }

// 失败路径 — 错误自动传递，无需 try-catch
const result2 = processUser('{"name": "Bob"}');
result2.fold(
  (err) => console.error("Error:", err),
  (user) => console.log("User created:", user)
);
// Error: Missing field: age

// 失败路径 — JSON 错误
const result3 = processUser("not json");
result3.fold(
  (err) => console.error("Error:", err),
  (user) => console.log("User created:", user)
);
// Error: JSON parse error: ...
```

### 示例 15: 函数式事件系统
```javascript
// 纯函数式事件流
class EventStream {
  constructor(subscribe) {
    this.subscribe = subscribe;
  }

  static of(value) {
    return new EventStream((observer) => {
      observer.next(value);
      observer.complete?.();
      return () => {};
    });
  }

  static fromEvent(target, eventName) {
    return new EventStream((observer) => {
      const handler = (event) => observer.next(event);
      target.addEventListener(eventName, handler);
      return () => target.removeEventListener(eventName, handler);
    });
  }

  map(fn) {
    return new EventStream((observer) =>
      this.subscribe({
        next: (value) => observer.next(fn(value)),
        error: observer.error,
        complete: observer.complete
      })
    );
  }

  filter(fn) {
    return new EventStream((observer) =>
      this.subscribe({
        next: (value) => fn(value) && observer.next(value),
        error: observer.error,
        complete: observer.complete
      })
    );
  }

  scan(fn, initial) {
    return new EventStream((observer) => {
      let acc = initial;
      return this.subscribe({
        next: (value) => {
          acc = fn(acc, value);
          observer.next(acc);
        },
        error: observer.error,
        complete: observer.complete
      });
    });
  }

  take(n) {
    return new EventStream((observer) => {
      let count = 0;
      return this.subscribe({
        next: (value) => {
          if (count++ < n) observer.next(value);
          else observer.complete?.();
        },
        error: observer.error,
        complete: observer.complete
      });
    });
  }

  subscribe(observer) {
    return this.subscribe(observer);
  }
}

// 使用示例：计数器
const counter$ = EventStream.of(0)
  .scan((acc) => acc + 1, 0)
  .filter((n) => n % 2 === 0)
  .take(5);

const unsubscribe = counter$.subscribe({
  next: (n) => console.log("Even number:", n),
  complete: () => console.log("Stream complete!")
});
```

### 示例 16: 函数式命令模式
```javascript
// 纯函数式命令 — 每个命令是可组合的、可撤销的
class Command {
  constructor(execute, undo) {
    this.execute = execute;
    this.undo = undo;
  }

  static of(execute, undo) {
    return new Command(execute, undo);
  }

  // 命令组合
  andThen(other) {
    return new Command(
      () => { this.execute(); other.execute(); },
      () => { other.undo(); this.undo(); }
    );
  }

  // 命令映射
  map(fn) {
    return new Command(
      () => fn(this.execute()),
      () => this.undo()
    );
  }
}

// 具体命令
const createCommand = (text) => {
  let previous = null;
  return {
    command: Command.of(
      () => { previous = text; console.log(`Created: "${text}"`); },
      () => { console.log(`Undo create: "${previous}"`); }
    ),
    getPrevious: () => previous
  };
};

const updateCommand = (oldText, newText) =>
  Command.of(
    () => console.log(`Updated: "${oldText}" → "${newText}"`),
    () => console.log(`Reverted: "${newText}" → "${oldText}"`)
  );

const deleteCommand = (text) =>
  Command.of(
    () => console.log(`Deleted: "${text}"`),
    () => console.log(`Restored: "${text}"`)
  );

// 组合命令
const macro = updateCommand("draft", "final")
  .andThen(deleteCommand("final"));

macro.execute();
// Updated: "draft" → "final"
// Deleted: "final"

macro.undo();
// Restored: "final"
// Reverted: "final" → "draft"
```

---

## 七、函数式与 TypeScript 类型安全

### 示例 17: 类型安全的函数组合
```typescript
// 类型安全的 compose
type Fn<A, B> = (a: A) => B;

// compose 类型推导：
// compose(f: (b: B) => C, g: (a: A) => B): (a: A) => C
function compose<A, B, C>(g: Fn<B, C>, f: Fn<A, B>): Fn<A, C> {
  return (a: A) => g(f(a));
}

// 类型安全的 pipe
function pipe<A, B, C>(f: Fn<A, B>, g: Fn<B, C>): Fn<A, C> {
  return (a: A) => g(f(a));
}

// 柯里化类型
function curry2<A, B, C>(fn: (a: A, b: B) => C): (a: A) => (b: B) => C {
  return (a: A) => (b: B) => fn(a, b);
}

// 使用
const add = (a: number, b: number): number => a + b;
const curriedAdd = curry2(add);

const add5 = curriedAdd(5);
const result: number = add5(3); // 8

// 类型安全的 map
function fmap<A, B>(fn: Fn<A, B>): Fn<A[], B[]> {
  return (arr: A[]) => arr.map(fn);
}

const lengths: Fn<string[], number[]> = fmap((s: string) => s.length);
lengths(["hello", "world"]); // [5, 5]
```

---

## 八、综合实战：函数式 Todo 应用

### 示例 18: 纯函数式 Todo 系统
```javascript
// === 数据模型 (不可变) ===
const Todo = {
  create: (text) => ({
    id: Date.now() + Math.random(),
    text,
    completed: false,
    createdAt: new Date().toISOString()
  })
};

// === 纯函数操作 ===
const TodoStore = {
  // 添加 todo
  add: (state, text) => ({
    ...state,
    todos: [...state.todos, Todo.create(text)],
    nextId: state.nextId + 1
  }),

  // 切换完成状态
  toggle: (state, id) => ({
    ...state,
    todos: state.todos.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    )
  }),

  // 删除 todo
  remove: (state, id) => ({
    ...state,
    todos: state.todos.filter((t) => t.id !== id)
  }),

  // 清除已完成
  clearCompleted: (state) => ({
    ...state,
    todos: state.todos.filter((t) => !t.completed)
  }),

  // 设置过滤器
  setFilter: (state, filter) => ({
    ...state,
    filter
  })
};

// === 纯函数查询 ===
const TodoQuery = {
  all: (todos) => todos,

  active: (todos) => todos.filter((t) => !t.completed),

  completed: (todos) => todos.filter((t) => t.completed),

  stats: (todos) => ({
    total: todos.length,
    active: todos.filter((t) => !t.completed).length,
    completed: todos.filter((t) => t.completed).length
  }),

  // Point-Free 风格
  getActiveCount: pipe(
    (todos) => todos.filter((t) => !t.completed),
    (arr) => arr.length
  )
};

// === 初始状态 ===
const initialState = {
  todos: [],
  filter: "all", // "all" | "active" | "completed"
  nextId: 1
};

// === 使用 ===
let state = initialState;

// 添加 todos
state = TodoStore.add(state, "Learn FP");
state = TodoStore.add(state, "Practice compose");
state = TodoStore.add(state, "Build something");

console.log(TodoQuery.stats(state.todos));
// { total: 3, active: 3, completed: 0 }

// 切换
state = TodoStore.toggle(state, state.todos[0].id);
console.log(TodoQuery.stats(state.todos));
// { total: 3, active: 2, completed: 1 }

// 过滤
const filtered = state.filter === "all"
  ? TodoQuery.all(state.todos)
  : state.filter === "active"
    ? TodoQuery.active(state.todos)
    : TodoQuery.completed(state.todos);

// 清除已完成
state = TodoStore.clearCompleted(state);
console.log(TodoQuery.stats(state.todos));
// { total: 2, active: 2, completed: 0 }

// 原始状态从未被修改 — 所有操作返回新状态
```

---

## 九、性能考量与最佳实践

### 示例 19: Memoization — 纯函数的缓存优化
```javascript
// 通用 memoize
const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

// 斐波那契 — 纯函数天然适合缓存
const fib = memoize((n) => {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
});

console.log(fib(50)); // 12586269025 — 瞬间完成！
console.log(fib(50)); // 缓存命中 — O(1)

// 不可变数据的结构共享优化
// 使用持久化数据结构（如 Immutable.js）避免全量复制
```

### 示例 20: Lazy Evaluation — 惰性求值
```javascript
// 惰性列表 (Lazy List / Stream)
class LazyList {
  constructor(headThunk, tailThunk) {
    this.headThunk = headThunk;
    this.tailThunk = tailThunk;
  }

  static empty = {
    isEmpty: true,
    head: null,
    tail: null,
    take() { return LazyList.empty; },
    map() { return LazyList.empty; },
    filter() { return LazyList.empty; },
    toArray() { return []; }
  };

  static of(...items) {
    if (items.length === 0) return LazyList.empty;
    return new LazyList(
      () => items[0],
      () => LazyList.of(...items.slice(1))
    );
  }

  static infinite(fn, start = 0) {
    return new LazyList(
      () => fn(start),
      () => LazyList.infinite(fn, start + 1)
    );
  }

  get isEmpty() { return false; }
  get head() { return this.headThunk(); }
  get tail() { return this.tailThunk(); }

  take(n) {
    if (n <= 0 || this.isEmpty) return LazyList.empty;
    return new LazyList(
      () => this.head,
      () => this.tail.take(n - 1)
    );
  }

  map(fn) {
    if (this.isEmpty) return LazyList.empty;
    return new LazyList(
      () => fn(this.head),
      () => this.tail.map(fn)
    );
  }

  filter(fn) {
    if (this.isEmpty) return LazyList.empty;
    return fn(this.head)
      ? new LazyList(
          () => this.head,
          () => this.tail.filter(fn)
        )
      : this.tail.filter(fn);
  }

  toArray() {
    const result = [];
    let current = this;
    while (!current.isEmpty) {
      result.push(current.head);
      current = current.tail;
    }
    return result;
  }
}

// 无限自然数序列
const naturals = LazyList.infinite((n) => n, 1);

// 惰性求值 — 只计算需要的部分
const evenSquares = naturals
  .filter((n) => n % 2 === 0)
  .map((n) => n * n)
  .take(5);

console.log(evenSquares.toArray()); // [4, 16, 36, 64, 100]

// 斐波那契无限序列
const fibs = (() => {
  const generate = (a, b) =>
    new LazyList(
      () => a,
      () => generate(b, a + b)
    );
  return generate(0, 1);
})();

console.log(fibs.take(10).toArray()); // [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

---

## 十、核心概念速查表

| 概念 | 定义 | 核心方法 | 应用场景 |
|------|------|----------|----------|
| Functor | 可映射的容器 | `map` | 值在容器中变换 |
| Applicative | 可应用函数的容器 | `ap`, `of` | 多容器值组合 |
| Monad | 可链式操作的容器 | `chain`/`flatMap` | 嵌套容器展平 |
| Reader | 依赖环境的计算 | `run(env)` | 依赖注入 |
| State | 状态传递计算 | `run(state)` | 纯函数式状态 |
| Writer | 带日志的计算 | `log` | 审计/日志 |
| Either | 成功或失败 | `left`/`right` | 错误处理 |
| Maybe | 有值或无值 | `Just`/`None` | 空值安全 |
| Task | 异步计算 | `run(callback)` | 异步函数式 |
| IO | 延迟副作用 | `value()` | 副作用隔离 |

---

## 十一、学习路径建议

```
基础 (已完成)
  ├── 纯函数 ✅
  ├── 不可变性 ✅
  ├── 函数组合 (compose/pipe) ✅
  └── 柯里化 ✅

进阶 (本次训练)
  ├── Point-Free 风格 ✅
  ├── Functor (Identity/Task/IO) ✅
  ├── Applicative (Maybe/Either) ✅
  ├── Monad (Reader/State/Writer) ✅
  ├── 函数式数据结构 ✅
  ├── Railway-Oriented Programming ✅
  └── 惰性求值 ✅

高阶 (后续)
  ├── 类型系统 (HKT, 类型类)
  ├── 代数数据类型 (ADT)
  ├── 函数式 React (React.FC 纯函数组件)
  ├── fp-ts / sanctuary 实战
  └── 函数式前端架构
```

---

**训练完成时间:** 06:00  
**示例数量:** 20 个 (超额完成 10+ 目标)  
**难度:** 进阶  
**下次训练:** 明日 06:00 — 函数式前端架构实战
