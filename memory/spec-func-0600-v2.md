# 专项训练 06:00 — 函数式编程 进阶篇 (Functional Programming Advanced)

**日期**: 2026-05-11
**主题**: Point-Free / Transducer / Lens / Reader Pattern / 函数组合子 / 递归数据结构 / 类型编程
**前置**: v1 已覆盖纯函数/不可变性/组合/柯里化/Functor/Monad (2026-05-10)
**文件**: `memory/spec-func-0600-v2.md`

---

## 一、进阶概念速览

### 1. Point-Free 风格 (无点风格)

**定义**: 定义函数时不显式提及参数，通过函数组合表达逻辑。

```typescript
// ❌ 非 Point-Free — 显式提及 x
const doubleAll = (xs: number[]) => xs.map(x => x * 2);

// ✅ Point-Free — 不提及参数
const doubleAll = (xs: number[]) => xs.map(multiply(2));

// 更彻底的 Point-Free
const doubleAll = map(multiply(2));  // 完全不需要提及 xs
```

**核心技巧**:
- 柯里化 + 组合 = Point-Free 的基础
- `flip` 交换参数顺序
- `unary` 限制参数数量

### 2. Transducer (转换器)

**定义**: 与数据源无关的转换逻辑。组合多个 map/filter/reduce 为单次遍历。

```
传统: arr.map(f).filter(g).reduce(h, init)  →  3 次遍历
Transducer: transduce(compose(tMap(f), tFilter(g)), h, init, arr)  →  1 次遍历
```

### 3. Lens (透镜)

**定义**: 一对 get/set 函数，提供不可变数据的聚焦读写。可组合。

```typescript
// lens: 聚焦到对象的某个属性
const nameLens = lensProp('name');
nameLens.get(user);        // 读取
nameLens.set('Alice', user);  // 不可变更新
nameLens.modify(upper, user);  // 转换
```

### 4. Reader Pattern (读取器模式)

**定义**: 将依赖注入封装为函数，延迟环境传递。

```typescript
// Reader<A, R> = (env: R) => A
// 组合多个依赖读取，最后统一注入环境
```

### 5. 函数组合子 (Function Combinators)

**定义**: 接收函数返回新函数的高阶模式。`I`, `K`, `B`, `C`, `S` 等组合子。

### 6. 递归数据结构

**定义**: 自引用的数据结构，用递归函数处理。

```typescript
// 树、链表、JSON 等天然递归结构
interface Tree<T> {
  value: T;
  children: Tree<T>[];
}
```

---

## 二、12 个进阶函数式编程示例

### 示例 1: Point-Free 风格 — 用户查询管道

```typescript
// ===== 基础工具 =====
const prop = <T, K extends keyof T>(key: K) => (obj: T): T[K] => obj[key];
const method = (name: string, ...args: any[]) =>
  (obj: any) => obj[name](...args);
const multiply = (a: number) => (b: number) => a * b;
const filter = <T>(pred: (x: T) => boolean) => (xs: T[]) => xs.filter(pred);
const map = <T, U>(fn: (x: T) => U) => (xs: T[]) => xs.map(fn);
const sort = <T>(compare: (a: T, b: T) => number) => (xs: T[]) =>
  [...xs].sort(compare);
const pipe = <T>(...fns: ((x: any) => any)[]) =>
  (x: T) => fns.reduce((v, f) => f(v), x);
const compose = <T>(...fns: ((x: any) => any)[]) =>
  (x: T) => fns.reduceRight((v, f) => f(v), x);

// ===== 非 Point-Free vs Point-Free 对比 =====

// ❌ 非 Point-Free — 每个函数都显式提及参数
const getActiveUserNames = (users: any[]) =>
  users
    .filter(u => u.active === true)
    .map(u => u.name.toUpperCase())
    .sort();

// ✅ Point-Free — 通过组合表达，不提及 users
const getActive = filter((u: any) => u.active);
const getNames = map(prop('name'));
const toUpperNames = map(method('toUpperCase'));
const sorted = sort((a: string, b: string) => a.localeCompare(b));

const getActiveUserNamesPF = pipe(
  getActive,
  getNames,
  toUpperNames,
  sorted
);

// 使用 — 完全相同的逻辑，但定义时不提及数据
const users = [
  { name: 'charlie', active: false },
  { name: 'alice', active: true },
  { name: 'bob', active: true },
];

console.log(getActiveUserNamesPF(users));
// ['ALICE', 'BOB']

// ===== 更复杂的 Point-Free 组合 =====

// 计算活跃用户的平均年龄
const average = (nums: number[]) =>
  nums.reduce((sum, n) => sum + n, 0) / nums.length;

const getAges = map(prop('age'));
const getActiveAges = pipe(
  getActive,
  getAges
);
const avgActiveAge = compose(average, getActiveAges);

console.log(avgActiveAge(users));  // 需要添加 age 字段

// ===== Point-Free 的 flip 技巧 =====

// flip: 交换二元函数的参数顺序
const flip = <T, U, R>(fn: (a: T, b: U) => R) =>
  (b: U) => (a: T) => fn(a, b);

const includes = flip((arr: any[], val: any) => arr.includes(val));
const roles = ['admin', 'editor', 'viewer'];
const isAdmin = includes(roles);

const user1 = { name: 'Alice', role: 'admin' };
const user2 = { name: 'Bob', role: 'viewer' };

console.log(isAdmin(user1.role));  // true
console.log(isAdmin(user2.role));  // false

// ===== Point-Free 的 unary 技巧 =====

// unary: 只取第一个参数（解决 map 传递 index 导致的问题）
const unary = <T, R>(fn: (x: T) => R) =>
  (x: T) => fn(x);

const parseIntSafe = unary(Number.parseInt);
// ['1', '2', '3'].map(parseIntSafe) → [1, 2, 3] ✅
// ['1', '2', '3'].map(Number.parseInt) → [1, NaN, NaN] ❌ (parseInt 接收第二个参数 radix)
```

### 示例 2: Transducer (转换器) — 高效数据管道

```typescript
// ===== Transducer 核心实现 =====

// Transducer 是一个转换函数：(reducer) => (acc, value) => acc
type Reducer<T, U> = (acc: U, value: T) => U;
type Transducer<T, U> = <V>(reducer: Reducer<T, V>) => Reducer<U, V>;

// map transducer
const tMap = <T, U>(fn: (x: T) => U): Transducer<T, U> =>
  <V>(reducer: Reducer<T, V>) =>
    (acc: V, value: U) => reducer(acc, fn(value));

// filter transducer
const tFilter = <T>(pred: (x: T) => boolean): Transducer<T, T> =>
  <V>(reducer: Reducer<T, V>) =>
    (acc: V, value: T) => pred(value) ? reducer(acc, value) : acc;

// transduce: 单次遍历执行所有转换
const transduce = <T, U, V>(
  transducer: Transducer<T, U>,
  reducer: Reducer<T, V>,
  init: V,
  data: U[]
): V => {
  const combined = transducer(reducer);
  let acc = init;
  for (const item of data) {
    acc = combined(acc, item);
  }
  return acc;
};

// ===== 对比：传统 vs Transducer =====

interface Order {
  id: number;
  amount: number;
  status: string;
  region: string;
}

const orders: Order[] = [
  { id: 1, amount: 100, status: 'completed', region: 'CN' },
  { id: 2, amount: 200, status: 'pending', region: 'US' },
  { id: 3, amount: 150, status: 'completed', region: 'CN' },
  { id: 4, amount: 300, status: 'completed', region: 'EU' },
  { id: 5, amount: 50, status: 'completed', region: 'CN' },
];

// ❌ 传统方式 — 3 次遍历，创建 2 个中间数组
const traditional = (orders: Order[]) =>
  orders
    .filter(o => o.status === 'completed')
    .filter(o => o.region === 'CN')
    .reduce((sum, o) => sum + o.amount, 0);

// ✅ Transducer 方式 — 1 次遍历，零中间数组
const completedCN = tFilter((o: Order) => o.status === 'completed');
const cnRegion = tFilter((o: Order) => o.region === 'CN');
const sumAmount = (acc: number, o: Order) => acc + o.amount;

// 组合 transducer (先 filter completed，再 filter CN)
const composeTransducers = <T>(...transducers: Transducer<T, T>[]) =>
  <V>(reducer: Reducer<T, V>) =>
    transducers.reduceRight((r, t) => t(r), reducer);

const transduced = transduce(
  composeTransducers(completedCN, cnRegion),
  sumAmount,
  0,
  orders
);

console.log(traditional(orders));  // 250
console.log(transduced);            // 250

// ===== Transducer 含 map 的完整管道 =====

// 计算 CN 已完成订单的税额 (假设税率 13%)
const taxRate = 0.13;

const tMapAmount = tMap((o: Order) => o.amount);
const tMapTax = tMap((amount: number) => Math.round(amount * taxRate * 100) / 100);

const totalTax = transduce(
  (reducer: Reducer<number, number>) =>
    (acc: number, o: Order) =>
      o.status === 'completed' && o.region === 'CN'
        ? reducer(acc, Math.round(o.amount * taxRate * 100) / 100)
        : acc,
  (acc: number, tax: number) => acc + tax,
  0,
  orders
);

console.log(totalTax);  // 32.5

// ===== Transducer 的提前终止 (Reduc / Reduced) =====

// 有些 transducer 库支持提前终止（如找到前 N 个元素）
interface Reduced<T> {
  _reduced: true;
  value: T;
}

const reduced = <T>(value: T): Reduced<T> => ({ _reduced: true, value });
const isReduced = <T>(x: Reduced<T> | T): x is Reduced<T> =>
  (x as any)?._reduced === true;
const deref = <T>(x: Reduced<T> | T): T =>
  isReduced(x) ? x.value : x;

// take transducer — 取前 N 个元素后提前终止
const tTake = <T>(n: number): Transducer<T, T> =>
  <V>(reducer: Reducer<T, V>) => {
    let remaining = n;
    return (acc: V, value: T) => {
      if (remaining <= 0) return reduced(acc);
      remaining--;
      const result = reducer(acc, value);
      return isReduced(result) ? result : result;
    };
  };

// 只取前 2 个 CN 已完成订单
const take2 = tTake(2);
const first2Amounts: number[] = transduce(
  (reducer: Reducer<number, number[]>) =>
    (acc: number[], o: Order) =>
      o.status === 'completed' && o.region === 'CN'
        ? reducer(acc, o.amount)
        : acc,
  (acc: number[], amount: number) => [...acc, amount],
  [],
  orders
);

// 手动实现 take 2 的效果
const first2 = transduce(
  (reducer: Reducer<Order, Order[]>) =>
    (acc: Order[], o: Order) =>
      o.status === 'completed' && o.region === 'CN' && acc.length < 2
        ? reducer(acc, o)
        : acc.length >= 2 ? reduced(acc) : acc,
  (acc: Order[], o: Order) => [...acc, o],
  [],
  orders
);

console.log(first2.map(o => o.id));  // [1, 3]
```

### 示例 3: Lens (透镜) — 可组合的聚焦读写

```typescript
// ===== Lens 核心实现 =====

// Lens s a = Lens (s → a) (a → s → s)
interface Lens<S, A> {
  get: (s: S) => A;
  set: (a: A, s: S) => S;
  modify: (fn: (a: A) => A, s: S) => S;
}

const lens = <S, A>(
  getter: (s: S) => A,
  setter: (a: A, s: S) => S
): Lens<S, A> => ({
  get: getter,
  set: (a: A, s: S) => setter(a, s),
  modify: (fn: (a: A) => A, s: S) => setter(fn(getter(s)), s),
});

// 属性透镜
const lensProp = <S, K extends keyof S>(key: K): Lens<S, S[K]> =>
  lens(
    (s: S) => s[key],
    (val: S[K], s: S) => ({ ...s, [key]: val })
  );

// 索引透镜 (数组)
const lensIdx = <T>(index: number): Lens<T[], T | undefined>: Lens<T[], T | undefined> =>
  lens(
    (arr: T[]) => arr[index],
    (val: T | undefined, arr: T[]) => {
      const newArr = [...arr];
      newArr[index] = val as T;
      return newArr;
    }
  );

// 组合透镜
const composeLens = <S, A, B>(outer: Lens<S, A>, inner: Lens<A, B>): Lens<S, B> =>
  lens(
    (s: S) => inner.get(outer.get(s)),
    (b: B, s: S) => outer.set(inner.set(b, outer.get(s)), s)
  );

// 可选透镜 (处理可能不存在的值)
const lensOptional = <S, A>(lens: Lens<S, A | undefined | null>): Lens<S, A | undefined> =>
  lens;

// ===== 使用场景：深层嵌套对象 =====

interface AppState {
  user: {
    profile: {
      name: string;
      address: {
        city: string;
        zip: string;
      };
    };
    settings: {
      theme: string;
      notifications: boolean;
    };
  };
  cart: Array<{
    id: number;
    name: string;
    quantity: number;
    price: number;
  }>;
}

// 定义透镜
const userLens = lensProp<AppState, 'user'>('user');
const profileLens = lensProp<AppState['user'], 'profile'>('profile');
const addressLens = lensProp<AppState['user']['profile'], 'address'>('address');
const cityLens = lensProp<AppState['user']['profile']['address'], 'city'>('city');

// 组合透镜：聚焦到 user.profile.address.city
const cityFullLens = composeLens(
  composeLens(composeLens(userLens, profileLens), addressLens),
  cityLens
);

const state: AppState = {
  user: {
    profile: {
      name: 'Alice',
      address: { city: 'Beijing', zip: '100000' }
    },
    settings: { theme: 'dark', notifications: true }
  },
  cart: [
    { id: 1, name: 'Book', quantity: 2, price: 29.9 },
    { id: 2, name: 'Pen', quantity: 5, price: 5.5 }
  ]
};

// 读取
console.log(cityFullLens.get(state));  // "Beijing"

// 不可变更新
const newState = cityFullLens.set('Shanghai', state);
console.log(newState.user.profile.address.city);  // "Shanghai"
console.log(state.user.profile.address.city);     // "Beijing" (不变)

// 转换
const upperState = cityFullLens.modify((c: string) => c.toUpperCase(), state);
console.log(upperState.user.profile.address.city);  // "BEIJING"

// ===== 使用场景：购物车操作 =====

const cartLens = lensProp<AppState, 'cart'>('cart');
const itemLens = (index: number) => composeLens(cartLens, lensIdx(index));
const quantityLens = (index: number) =>
  composeLens(itemLens(index), lensProp('quantity'));
const priceLens = (index: number) =>
  composeLens(itemLens(index), lensProp('price'));

// 增加第一个商品数量
const updatedState = quantityLens(0).modify(q => q + 3, state);
console.log(updatedState.cart[0].quantity);  // 5
console.log(state.cart[0].quantity);         // 2 (不变)

// 计算购物车总价 (纯函数，不修改状态)
const cartTotal = (s: AppState) =>
  s.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

console.log(cartTotal(state));           // 87.3
console.log(cartTotal(updatedState));    // 177.0

// ===== 使用场景：表单字段透镜 =====

interface FormState {
  fields: Record<string, { value: string; error?: string }>;
}

const fieldLens = (fieldName: string): Lens<FormState, { value: string; error?: string }> =>
  lens(
    (form: FormState) => form.fields[fieldName] || { value: '', error: undefined },
    (field: { value: string; error?: string }, form: FormState) => ({
      ...form,
      fields: { ...form.fields, [fieldName]: field }
    })
  );

const valueLens = (fieldName: string): Lens<FormState, string> =>
  composeLens(fieldLens(fieldName), lensProp('value'));

const errorLens = (fieldName: string): Lens<FormState, string | undefined> =>
  composeLens(fieldLens(fieldName), lensProp('error'));

const form: FormState = {
  fields: {
    email: { value: 'test@example.com', error: undefined },
    name: { value: '', error: 'Name is required' }
  }
};

// 更新 email 值
const updatedForm = valueLens('email').set('new@example.com', form);
console.log(updatedForm.fields.email.value);  // "new@example.com"
console.log(form.fields.email.value);         // "test@example.com" (不变)

// 设置错误
const formWithError = errorLens('email').set('Invalid email', form);
console.log(formWithError.fields.email.error);  // "Invalid email"
```

### 示例 4: Reader Pattern — 依赖注入

```typescript
// ===== Reader 核心实现 =====

// Reader<R, A> = (env: R) => A
type Reader<R, A> = (env: R) => A;

// of: 提升值到 Reader
const readerOf = <R, A>(value: A): Reader<R, A> =>
  (_env: R) => value;

// map: 转换 Reader 的输出
const readerMap = <R, A, B>(fn: (a: A) => B) =>
  (reader: Reader<R, A>): Reader<R, B> =>
    (env: R) => fn(reader(env));

// chain: 链式组合 Reader (flatMap)
const readerChain = <R, A, B>(fn: (a: A) => Reader<R, B>) =>
  (reader: Reader<R, A>): Reader<R, B> =>
    (env: R) => fn(reader(env))(env);

// ask: 读取整个环境
const ask = <R>(): Reader<R, R> =>
  (env: R) => env;

// asks: 读取环境的某个属性
const asks = <R, K extends keyof R>(key: K): Reader<R, R[K]> =>
  (env: R) => env[key];

// ===== 使用场景：配置驱动的服务层 =====

// 定义环境
interface AppEnv {
  db: {
    query: (sql: string) => Promise<any[]>;
    execute: (sql: string, params: any[]) => Promise<number>;
  };
  cache: {
    get: <T>(key: string) => Promise<T | null>;
    set: <T>(key: string, value: T, ttl: number) => Promise<void>;
  };
  logger: {
    info: (msg: string) => void;
    error: (msg: string) => void;
  };
  config: {
    maxPageSize: number;
    defaultTTL: number;
  };
}

// ===== 纯函数服务（通过 Reader 注入依赖） =====

// 获取用户 — 先查缓存，未命中查数据库
const getUser = (userId: number): Reader<AppEnv, Promise<any>> =>
  readerChain((cache: AppEnv['cache']) =>
    readerChain((db: AppEnv['db']) =>
      readerChain((logger: AppEnv['logger']) =>
        readerChain((config: AppEnv['config']) =>
          readerOf(
            (async () => {
              const cached = await cache.get(`user:${userId}`);
              if (cached) {
                logger.info(`Cache hit: user:${userId}`);
                return cached;
              }
              logger.info(`Cache miss: user:${userId}, querying DB`);
              const results = await db.query(`SELECT * FROM users WHERE id = ${userId}`);
              const user = results[0];
              if (user) {
                await cache.set(`user:${userId}`, user, config.defaultTTL);
              }
              return user;
            })()
          )
        )(logger)
      )(db)
    )(cache)
  )(ask());

// 简化版：使用 helper
const withDeps = <R, A>(
  deps: (env: R) => any,
  fn: (deps: any) => Promise<A>
): Reader<R, Promise<A>> =>
  (env: R) => fn(deps(env));

const getUserSimple = (userId: number): Reader<AppEnv, Promise<any>> =>
  withDeps(
    (env: AppEnv) => ({ cache: env.cache, db: env.db, logger: env.logger, config: env.config }),
    async ({ cache, db, logger, config }) => {
      const cached = await cache.get(`user:${userId}`);
      if (cached) return cached;
      const results = await db.query(`SELECT * FROM users WHERE id = ${userId}`);
      const user = results[0];
      if (user) await cache.set(`user:${userId}`, user, config.defaultTTL);
      return user;
    }
  );

// ===== 使用场景：分页查询 =====

const getPaginatedUsers = (page: number, pageSize: number): Reader<AppEnv, Promise<any[]>> =>
  withDeps(
    (env: AppEnv) => ({ db: env.db, config: env.config, logger: env.logger }),
    async ({ db, config, logger }) => {
      const effectivePageSize = Math.min(pageSize, config.maxPageSize);
      const offset = (page - 1) * effectivePageSize;
      logger.info(`Fetching users page=${page}, size=${effectivePageSize}`);
      return db.query(
        `SELECT * FROM users ORDER BY id LIMIT ${effectivePageSize} OFFSET ${offset}`
      );
    }
  );

// ===== 使用场景：事务操作 =====

const transferMoney = (
  fromId: number,
  toId: number,
  amount: number
): Reader<AppEnv, Promise<void>> =>
  withDeps(
    (env: AppEnv) => ({ db: env.db, logger: env.logger }),
    async ({ db, logger }) => {
      logger.info(`Transfer ${amount} from ${fromId} to ${toId}`);
      // 实际项目中这里会用真正的数据库事务
      await db.execute(`UPDATE accounts SET balance = balance - ${amount} WHERE id = ${fromId}`, []);
      await db.execute(`UPDATE accounts SET balance = balance + ${amount} WHERE id = ${toId}`, []);
      logger.info(`Transfer complete: ${fromId} → ${toId}, amount: ${amount}`);
    }
  );

// ===== 运行 Reader：注入环境 =====

// 模拟环境
const mockEnv: AppEnv = {
  db: {
    query: async (sql: string) => {
      console.log(`[DB] ${sql}`);
      return [{ id: 1, name: 'Alice', email: 'alice@example.com' }];
    },
    execute: async (sql: string, _params: any[]) => {
      console.log(`[DB EXEC] ${sql}`);
      return 1;
    }
  },
  cache: {
    get: async (_key: string) => null,
    set: async (_key: string, _value: any, _ttl: number) => {}
  },
  logger: {
    info: (msg: string) => console.log(`[INFO] ${msg}`),
    error: (msg: string) => console.error(`[ERROR] ${msg}`)
  },
  config: {
    maxPageSize: 50,
    defaultTTL: 3600
  }
};

// 运行 — 注入环境
// const user = await getUserSimple(1)(mockEnv);
// const users = await getPaginatedUsers(1, 10)(mockEnv);
// await transferMoney(1, 2, 100)(mockEnv);

console.log('Reader pattern defined — inject env at runtime boundary');

// ===== Reader 组合：管道式依赖 =====

// 组合多个 Reader 操作
const pipeline = <R, A>(
  readers: Reader<R, A>[]
): Reader<R, A[]> =>
  (env: R) => readers.map(r => r(env));

// 并行读取多个资源
const loadDashboard = (userId: number): Reader<AppEnv, Promise<any>> =>
  withDeps(
    (env: AppEnv) => ({ cache: env.cache, db: env.db, logger: env.logger }),
    async ({ cache, db, logger }) => {
      logger.info(`Loading dashboard for user ${userId}`);
      const [user, recentOrders] = await Promise.all([
        cache.get(`user:${userId}`) ?? db.query(`SELECT * FROM users WHERE id = ${userId}`).then(r => r[0]),
        db.query(`SELECT * FROM orders WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 5`)
      ]);
      return { user, recentOrders };
    }
  );
```

### 示例 5: 函数组合子 — 组合子代数

```typescript
// ===== 经典组合子 (Combinator Calculus) =====

// I — 恒等组合子 (Identity)
// I x = x
const I = <T>(x: T): T => x;

// K — 常量组合子 (Kestrel / Const)
// K x y = x
const K = <T>(x: T) => <U>(_y: U): T => x;

// B — 组合组合子 (Bluebird / Composition)
// B f g x = f (g x)
const B = <T, U, V>(f: (y: U) => V) =>
  (g: (x: T) => U) =>
    (x: T): V => f(g(x));

// C — 翻转组合子 (Cardinal / Flip)
// C f x y = f y x
const C = <T, U, R>(f: (x: T, y: U) => R) =>
  (y: U) =>
    (x: T): R => f(x, y);

// S — 应用组合子 (Starling)
// S f g x = f x (g x)
const S = <T, U, R>(f: (x: T, y: U) => R) =>
  (g: (x: T) => U) =>
    (x: T): R => f(x, g(x));

// ===== 组合子的实际应用 =====

// 用组合子构建实用函数

// const 函数 — 返回常量
const alwaysTrue = K(true);
const alwaysFalse = K(false);
const zero = K(0);

console.log(alwaysTrue('anything'));   // true
console.log(alwaysFalse('anything'));  // false

// 用 B (compose) 构建管道
const add1 = (x: number) => x + 1;
const double = (x: number) => x * 2;
const toString = (x: number) => String(x);

// B(toString)(B(double)(add1))(5) = toString(double(add1(5))) = "12"
const pipeline = B(toString)(B(double)(add1));
console.log(pipeline(5));  // "12"

// 用 C (flip) 交换参数
const divide = (a: number, b: number) => a / b;
const flippedDivide = C(divide);

console.log(divide(10, 2));       // 5
console.log(flippedDivide(2)(10)); // 5 (10 / 2)

// 用 S 构建自应用
// S(K)(K) x = K x (K x) = x
const identityViaSK = S(K)(K);
console.log(identityViaSK(42));  // 42

// ===== 实用组合子库 =====

const Combinators = {
  // I: 恒等
  I: <T>(x: T): T => x,

  // K: 常量
  K: <T>(x: T) => <U>(): T => x,

  // KI: 常量返回第二个参数 (Thrush)
  KI: <T, U>(_x: T, y: U): U => y,

  // B: 组合
  B: <T, U, V>(f: (y: U) => V) =>
    (g: (x: T) => U) =>
      (x: T): V => f(g(x)),

  // C: 翻转
  C: <T, U, R>(f: (x: T, y: U) => R) =>
    (y: U) =>
      (x: T): R => f(x, y),

  // S: 应用
  S: <T, U, R>(f: (x: T, y: U) => R) =>
    (g: (x: T) => U) =>
      (x: T): R => f(x, g(x)),

  // M: 自应用 (Mockingbird)
  M: <T, R>(f: (x: T) => R) => (x: T): R => f(x),

  // T: 逆翻转 (Thrush)
  T: <T, U>(x: T) =>
    <R>(f: (x: T) => R): R => f(x),

  // W: 复制 (Warbler)
  W: <T, R>(f: (x: T, y: T) => R) =>
    (x: T): R => f(x, x),

  // L: 左组合
  L: <T, U, V, R>(f: (x: T, y: U) => R) =>
    (g: (x: T) => V) =>
      (x: T, y: U): R => f(g(x), y),
};

// ===== 组合子实战：数据转换 =====

// 场景：提取并转换嵌套数据
interface Person {
  name: string;
  address: { city: string; country: string };
  scores: number[];
}

const persons: Person[] = [
  { name: 'Alice', address: { city: 'Beijing', country: 'CN' }, scores: [90, 85, 95] },
  { name: 'Bob', address: { city: 'New York', country: 'US' }, scores: [70, 80, 75] },
  { name: 'Charlie', address: { city: 'London', country: 'UK' }, scores: [88, 92, 85] },
];

// 用组合子构建查询
const getCity = (p: Person) => p.address.city;
const getAvgScore = (p: Person) =>
  p.scores.reduce((sum, s) => sum + s, 0) / p.scores.length;

// B: 组合 getCity 和 upper
const getCityUpper = B((s: string) => s.toUpperCase())(getCity);

console.log(persons.map(getCityUpper));
// ['BEIJING', 'NEW YORK', 'LONDON']

// S: 同时获取城市和平均分
const getCityAndAvg = S(
  (city: string, avg: number) => ({ city, avg })
)(getCity)(getAvgScore);

console.log(persons.map(getCityAndAvg));
// [{ city: 'Beijing', avg: 90 }, { city: 'New York', avg: 75 }, { city: 'London', avg: 85 }]

// T (Thrush): 管道风格的数据流
const result = Combinators.T(persons)(
  B(persons => persons.filter(p => getAvgScore(p) >= 85))(
    persons => persons.filter(p => p.scores.length >= 3)
  )
);
console.log(result.map(p => p.name));
// ['Alice', 'Charlie']
```

### 示例 6: 递归数据结构 — 树操作

```typescript
// ===== 二叉树 =====

interface BinaryTree<T> {
  value: T;
  left: BinaryTree<T> | null;
  right: BinaryTree<T> | null;
}

const leaf = <T>(value: T): BinaryTree<T> => ({
  value, left: null, right: null
});

const node = <T>(
  value: T,
  left: BinaryTree<T> | null,
  right: BinaryTree<T> | null
): BinaryTree<T> => ({ value, left, right });

// 构建树
const tree = node(1,
  node(2, leaf(4), leaf(5)),
  node(3, leaf(6), leaf(7))
);

// ===== 纯函数树操作 =====

// 前序遍历
const preOrder = <T>(tree: BinaryTree<T>): T[] => {
  if (!tree) return [];
  return [tree.value, ...preOrder(tree.left), ...preOrder(tree.right)];
};

// 中序遍历
const inOrder = <T>(tree: BinaryTree<T>): T[] => {
  if (!tree) return [];
  return [...inOrder(tree.left), tree.value, ...inOrder(tree.right)];
};

// 后序遍历
const postOrder = <T>(tree: BinaryTree<T>): T[] => {
  if (!tree) return [];
  return [...postOrder(tree.left), ...postOrder(tree.right), tree.value];
};

// 层序遍历 (BFS)
const levelOrder = <T>(tree: BinaryTree<T>): T[] => {
  if (!tree) return [];
  const result: T[] = [];
  const queue = [tree];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current.value);
    if (current.left) queue.push(current.left);
    if (current.right) queue.push(current.right);
  }
  return result;
};

// 树高
const height = <T>(tree: BinaryTree<T> | null): number => {
  if (!tree) return 0;
  return 1 + Math.max(height(tree.left), height(tree.right));
};

// 节点数
const size = <T>(tree: BinaryTree<T> | null): number => {
  if (!tree) return 0;
  return 1 + size(tree.left) + size(tree.right);
};

// 叶节点数
const leafCount = <T>(tree: BinaryTree<T> | null): number => {
  if (!tree) return 0;
  if (!tree.left && !tree.right) return 1;
  return leafCount(tree.left) + leafCount(tree.right);
};

console.log('Pre-order:', preOrder(tree));       // [1, 2, 4, 5, 3, 6, 7]
console.log('In-order:', inOrder(tree));         // [4, 2, 5, 1, 6, 3, 7]
console.log('Post-order:', postOrder(tree));     // [4, 5, 2, 6, 7, 3, 1]
console.log('Level-order:', levelOrder(tree));   // [1, 2, 3, 4, 5, 6, 7]
console.log('Height:', height(tree));            // 3
console.log('Size:', size(tree));                // 7
console.log('Leaf count:', leafCount(tree));     // 4

// ===== 树的 map (Functor 实现) =====

const treeMap = <T, U>(fn: (value: T) => U) =>
  (tree: BinaryTree<T>): BinaryTree<U> => ({
    value: fn(tree.value),
    left: tree.left ? treeMap(fn)(tree.left) : null,
    right: tree.right ? treeMap(fn)(tree.right) : null
  });

// 所有值翻倍
const doubled = treeMap((x: number) => x * 2)(tree);
console.log('Doubled in-order:', inOrder(doubled));  // [8, 4, 10, 2, 12, 6, 14]

// ===== 树的折叠 (catamorphism) =====

const treeFold = <T, R>(
  leafFn: (value: T) => R,
  nodeFn: (value: T, left: R, right: R) => R
) => (tree: BinaryTree<T>): R => {
  if (!tree.left && !tree.right) return leafFn(tree.value);
  return nodeFn(
    tree.value,
    tree.left ? treeFold(leafFn, nodeFn)(tree.left) : leafFn(tree.value),
    tree.right ? treeFold(leafFn, nodeFn)(tree.right) : leafFn(tree.value)
  );
};

// 用 fold 重新实现
const sizeFold = treeFold(
  () => 1,
  (_v, l, r) => 1 + l + r
);

const sumFold = treeFold(
  (v: number) => v,
  (v, l, r) => v + l + r
);

const maxFold = treeFold(
  (v: number) => v,
  (v, l, r) => Math.max(v, l, r)
);

console.log('Size (fold):', sizeFold(tree));    // 7
console.log('Sum (fold):', sumFold(tree));      // 28
console.log('Max (fold):', maxFold(tree));      // 7

// ===== 多叉树 =====

interface MultiTree<T> {
  value: T;
  children: MultiTree<T>[];
}

const multiLeaf = <T>(value: T): MultiTree<T> => ({ value, children: [] });

const multiNode = <T>(value: T, children: MultiTree<T>[]): MultiTree<T> => ({
  value, children
});

// 多叉树的 map
const multiMap = <T, U>(fn: (value: T) => U) =>
  (tree: MultiTree<T>): MultiTree<U> => ({
    value: fn(tree.value),
    children: tree.children.map(multiMap(fn))
  });

// 多叉树的折叠
const multiFold = <T, R>(
  fn: (value: T, children: R[]) => R
) => (tree: MultiTree<T>): R =>
  fn(tree.value, tree.children.map(multiFold(fn)));

// 扁平化多叉树
const multiFlatten = <T>(tree: MultiTree<T>): T[] =>
  multiFold((value, children) => [value, ...children.flat()])(tree);

// 查找
const multiFind = <T>(pred: (value: T) => boolean) =>
  (tree: MultiTree<T>): T | null => {
    if (pred(tree.value)) return tree.value;
    for (const child of tree.children) {
      const found = multiFind(pred)(child);
      if (found !== null) return found;
    }
    return null;
  };

// 构建树形菜单
const menuTree = multiNode('Root', [
  multiNode('File', [
    multiLeaf('New'),
    multiLeaf('Open'),
    multiNode('Recent', [
      multiLeaf('file1.txt'),
      multiLeaf('file2.txt')
    ])
  ]),
  multiNode('Edit', [
    multiLeaf('Cut'),
    multiLeaf('Copy'),
    multiLeaf('Paste')
  ]),
  multiNode('View', [
    multiLeaf('Zoom In'),
    multiLeaf('Zoom Out')
  ])
});

console.log('Menu items:', multiFlatten(menuTree));
// ['Root', 'File', 'New', 'Open', 'Recent', 'file1.txt', 'file2.txt', 'Edit', 'Cut', 'Copy', 'Paste', 'View', 'Zoom In', 'Zoom Out']

console.log('Find "Copy":', multiFind(v => v === 'Copy')(menuTree));  // "Copy"
console.log('Find "Delete":', multiFind(v => v === 'Delete')(menuTree));  // null
```

### 示例 7: 递归数据结构 — 链表

```typescript
// ===== 不可变链表 =====

type List<T> = Nil | Cons<T>;

interface Nil {
  readonly tag: 'Nil';
}

interface Cons<T> {
  readonly tag: 'Cons';
  readonly head: T;
  readonly tail: List<T>;
}

const nil = { tag: 'Nil' as const };

const cons = <T>(head: T, tail: List<T>): Cons<T> => ({
  tag: 'Cons', head, tail
});

// ===== 链表操作 (全部纯函数) =====

// 从数组创建链表
const fromArray = <T>(arr: T[]): List<T> =>
  arr.reduceRight<List<T>>((acc, item) => cons(item, acc), nil);

// 链表转数组
const toArray = <T>(list: List<T>): T[] => {
  const result: T[] = [];
  let current = list;
  while (current.tag === 'Cons') {
    result.push(current.head);
    current = current.tail;
  }
  return result;
};

// map
const listMap = <T, U>(fn: (x: T) => U) =>
  (list: List<T>): List<U> =>
    list.tag === 'Nil' ? nil : cons(fn(list.head), listMap(fn)(list.tail));

// filter
const listFilter = <T>(pred: (x: T) => boolean) =>
  (list: List<T>): List<T> =>
    list.tag === 'Nil' ? nil :
    pred(list.head) ? cons(list.head, listFilter(pred)(list.tail)) :
    listFilter(pred)(list.tail);

// reduce
const listReduce = <T, U>(fn: (acc: U, x: T) => U, init: U) =>
  (list: List<T>): U => {
    let acc = init;
    let current = list;
    while (current.tag === 'Cons') {
      acc = fn(acc, current.head);
      current = current.tail;
    }
    return acc;
  };

// take
const listTake = <T>(n: number) =>
  (list: List<T>): List<T> =>
    n <= 0 || list.tag === 'Nil' ? nil :
    cons(list.head, listTake(n - 1)(list.tail));

// drop
const listDrop = <T>(n: number) =>
  (list: List<T>): List<T> =>
    n <= 0 ? list :
    list.tag === 'Nil' ? nil :
    listDrop(n - 1)(list.tail);

// length
const listLength = listReduce<number | any, number>((acc, _x) => acc + 1, 0);

// append
const listAppend = <T>(a: List<T>, b: List<T>): List<T> =>
  a.tag === 'Nil' ? b : cons(a.head, listAppend(a.tail, b));

// reverse
const listReverse = <T>(list: List<T>): List<T> =>
  listReduce<T, List<T>>((acc, x) => cons(x, acc), nil)(list);

// ===== 使用示例 =====

const nums = fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

console.log('Original:', toArray(nums));
// [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const doubledList = listMap((x: number) => x * 2)(nums);
console.log('Doubled:', toArray(doubledList));
// [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]

const evens = listFilter((x: number) => x % 2 === 0)(nums);
console.log('Evens:', toArray(evens));
// [2, 4, 6, 8, 10]

const sum = listReduce((acc: number, x: number) => acc + x, 0)(nums);
console.log('Sum:', sum);  // 55

const first3 = toArray(listTake(3)(nums));
console.log('First 3:', first3);  // [1, 2, 3]

const drop3 = toArray(listDrop(3)(nums));
console.log('Drop 3:', drop3);  // [4, 5, 6, 7, 8, 9, 10]

const reversed = toArray(listReverse(nums));
console.log('Reversed:', reversed);
// [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]

// ===== 链式操作 (管道风格) =====

const pipeline = <T>(list: List<T>) => ({
  map: <U>(fn: (x: T) => U) => pipeline(listMap(fn)(list)),
  filter: (pred: (x: T) => boolean) => pipeline(listFilter(pred)(list)),
  take: (n: number) => pipeline(listTake(n)(list)),
  reduce: <U>(fn: (acc: U, x: T) => U, init: U) => listReduce(fn, init)(list),
  toArray: () => toArray(list),
  length: () => listLength(list),
});

// 复杂查询：取偶数 → 翻倍 → 取前 3 个 → 求和
const result = pipeline(nums)
  .filter(x => x % 2 === 0)
  .map(x => x * 2)
  .take(3)
  .reduce((acc: number, x: number) => acc + x, 0);

console.log('Pipeline result:', result);  // 2*2 + 4*2 + 6*2 = 4 + 8 + 12 = 24

// ===== 惰性链表 (Stream) =====

interface Stream<T> {
  head: T;
  tail: () => Stream<T>;
}

// 自然数流
const naturals = (n: number): Stream<number> => ({
  head: n,
  tail: () => naturals(n + 1)
});

// 流的 map
const streamMap = <T, U>(fn: (x: T) => U) =>
  (stream: Stream<T>): Stream<U> => ({
    head: fn(stream.head),
    tail: () => streamMap(fn)(stream.tail())
  });

// 流取前 N 个
const streamTake = <T>(n: number) =>
  (stream: Stream<T>): T[] => {
    if (n <= 0) return [];
    return [stream.head, ...streamTake(n - 1)(stream.tail())];
  };

// 流 filter
const streamFilter = <T>(pred: (x: T) => boolean) =>
  (stream: Stream<T>): Stream<T> => {
    if (pred(stream.head)) {
      return {
        head: stream.head,
        tail: () => streamFilter(pred)(stream.tail())
      };
    }
    return streamFilter(pred)(stream.tail());
  };

// 斐波那契流
const fibStream = (a: number, b: number): Stream<number> => ({
  head: a,
  tail: () => fibStream(b, a + b)
});

console.log('First 10 naturals:', streamTake(10)(naturals(0)));
// [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

console.log('First 10 fibs:', streamTake(10)(fibStream(0, 1)));
// [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

console.log('First 5 even naturals:', streamTake(5)(streamFilter((n: number) => n % 2 === 0)(naturals(0))));
// [0, 2, 4, 6, 8]
```

### 示例 8: Reader + Either 组合 — 完整业务流

```typescript
// ===== 组合 Reader 和 Either =====

// Either 类型 (复用 v1 的 Success/Failure)
type Result<T, E = Error> = Success<T, E> | Failure<T, E>;

class Success<T, E> {
  readonly isSuccess = true as const;
  constructor(private readonly value: T) {}
  map<U>(fn: (v: T) => U): Result<U, E> { return new Success(fn(this.value)); }
  chain<U>(fn: (v: T) => Result<U, E>): Result<U, E> { return fn(this.value); }
  getOrElse(defaultValue: T): T { return this.value; }
  match<U>(handlers: { success: (v: T) => U; failure: (e: E) => U }): U {
    return handlers.success(this.value);
  }
}

class Failure<T, E> {
  readonly isSuccess = false as const;
  constructor(private readonly error: E) {}
  map<U>(_fn: (v: T) => U): Result<U, E> { return this as any; }
  chain<U>(_fn: (v: T) => Result<U, E>): Result<U, E> { return this as any; }
  getOrElse(defaultValue: T): T { return defaultValue; }
  match<U>(handlers: { success: (v: T) => U; failure: (e: E) => U }): U {
    return handlers.failure(this.error);
  }
}

const Ok = <T, E = Error>(v: T): Result<T, E> => new Success(v);
const Err = <E = Error>(e: E): Result<never, E> => new Failure(e);

// ===== ReaderEither: 需要环境且可能失败的计算 =====

type ReaderEither<R, T, E = Error> = (env: R) => Result<T, E>;

const reOf = <R, T, E>(value: T): ReaderEither<R, T, E> =>
  () => Ok(value);

const reMap = <R, T, U, E>(fn: (v: T) => U) =>
  (re: ReaderEither<R, T, E>): ReaderEither<R, U, E> =>
    (env: R) => re(env).map(fn);

const reChain = <R, T, U, E>(fn: (v: T) => ReaderEither<R, U, E>) =>
  (re: ReaderEither<R, T, E>): ReaderEither<R, U, E> =>
    (env: R) => re(env).match({
      success: (v) => fn(v)(env),
      failure: (e) => Err(e)
    });

const reFromResult = <R, T, E>(result: Result<T, E>): ReaderEither<R, T, E> =>
  () => result;

// ===== 业务场景：用户注册流程 =====

interface RegisterEnv {
  db: {
    findUserByEmail: (email: string) => Promise<any | null>;
    createUser: (data: any) => Promise<any>;
  };
  emailService: {
    sendWelcome: (email: string, name: string) => Promise<void>;
  };
  config: {
    minPasswordLength: number;
    maxUsers: number;
  };
  logger: {
    info: (msg: string) => void;
    error: (msg: string) => void;
  };
}

type RegisterError =
  | { type: 'INVALID_INPUT'; message: string }
  | { type: 'EMAIL_TAKEN'; email: string }
  | { type: 'SERVER_ERROR'; message: string };

// 验证输入
const validateInput = (email: string, name: string, password: string): Result<void, RegisterError> => {
  if (!email || !email.includes('@')) {
    return Err({ type: 'INVALID_INPUT', message: 'Invalid email' });
  }
  if (!name || name.length < 2) {
    return Err({ type: 'INVALID_INPUT', message: 'Name too short' });
  }
  if (!password || password.length < 8) {
    return Err({ type: 'INVALID_INPUT', message: 'Password too short' });
  }
  return Ok(undefined);
};

// 完整的注册流程
const registerUser = (
  email: string,
  name: string,
  password: string
): ReaderEither<RegisterEnv, { userId: number }, RegisterError> =>
  reChain(() => reFromResult(validateInput(email, name, password)))
    (() => reChain((env: RegisterEnv) =>
      reFromResult(
        // 同步检查，实际应为 async
        Ok({ email, name, password, env })
      )
    ))
    ({
      chain: (re) => async (env: RegisterEnv) => {
        const result = re(env);
        if (!result.isSuccess) return result as any;

        try {
          const existing = await env.db.findUserByEmail(email);
          if (existing) {
            return Err({ type: 'EMAIL_TAKEN', email });
          }

          const user = await env.db.createUser({ email, name, password });
          await env.emailService.sendWelcome(email, name);
          env.logger.info(`User registered: ${email}`);

          return Ok({ userId: user.id });
        } catch (e) {
          env.logger.error(`Registration failed: ${e}`);
          return Err({ type: 'SERVER_ERROR', message: String(e) });
        }
      } as any
    });

// ===== 简化版：同步注册流程 =====

const registerUserSync = (
  email: string,
  name: string,
  password: string
): ReaderEither<RegisterEnv, { userId: number }, RegisterError> =>
  reChain(() => reFromResult(validateInput(email, name, password)))
    (() => reChain((env: RegisterEnv) => {
      // 检查邮箱是否已存在
      const existing = env.db.findUserByEmail(email);
      // 模拟：返回 null 表示不存在
      if (existing !== null) {
        return reFromResult(Err<RegisterError>({ type: 'EMAIL_TAKEN', email }));
      }
      return reOf({ userId: Math.floor(Math.random() * 10000) });
    }));

// ===== 使用示例 =====

const mockRegisterEnv: RegisterEnv = {
  db: {
    findUserByEmail: async (email: string) => {
      console.log(`[DB] Checking email: ${email}`);
      return null;
    },
    createUser: async (data: any) => {
      console.log(`[DB] Creating user: ${data.email}`);
      return { id: 42, ...data };
    }
  },
  emailService: {
    sendWelcome: async (email: string, _name: string) => {
      console.log(`[EMAIL] Welcome email sent to ${email}`);
    }
  },
  config: {
    minPasswordLength: 8,
    maxUsers: 10000
  },
  logger: {
    info: (msg: string) => console.log(`[INFO] ${msg}`),
    error: (msg: string) => console.error(`[ERROR] ${msg}`)
  }
};

// 运行注册
// const result = await registerUser('test@example.com', 'Alice', 'password123')(mockRegisterEnv);
// result.match({
//   success: (v) => console.log(`Registered: ${v.userId}`),
//   failure: (e) => console.error(`Failed: ${e.message}`)
// });

console.log('ReaderEither pattern defined');
```

### 示例 9: 函数式表单验证

```typescript
// ===== 函数式验证框架 =====

// 验证器类型
type Validator<T> = (value: T) => string[];

// 组合验证器
const combineValidators = <T>(...validators: Validator<T>[]): Validator<T> =>
  (value: T) => validators.flatMap(v => v(value));

// 可选验证
const optional = <T>(validator: Validator<T>): Validator<T | undefined | null> =>
  (value) => value == null ? [] : validator(value as T);

// ===== 基础验证器 =====

const required = <T>(message: string = '此字段必填'): Validator<T | undefined | null> =>
  (value) => value == null || value === '' ? [message] : [];

const minLength = (min: number, message?: string): Validator<string> =>
  (value) => value.length < min
    ? [message || `最少 ${min} 个字符`]
    : [];

const maxLength = (max: number, message?: string): Validator<string> =>
  (value) => value.length > max
    ? [message || `最多 ${max} 个字符`]
    : [];

const pattern = (regex: RegExp, message: string): Validator<string> =>
  (value) => regex.test(value) ? [] : [message];

const emailValidator: Validator<string> =
  pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, '请输入有效邮箱');

const numberRange = (min: number, max: number, message?: string): Validator<number> =>
  (value) => (typeof value !== 'number' || value < min || value > max)
    ? [message || `必须在 ${min}-${max} 之间`]
    : : [];

const custom = <T>(fn: (value: T) => boolean, message: string): Validator<T> =>
  (value) => fn(value) ? [] : [message];

// ===== 表单验证器 =====

interface FieldConfig<T> {
  value: T;
  validators: Validator<T>;
}

interface FormDefinition<T> {
  [key: string]: FieldConfig<any>;
}

// 验证整个表单
const validateForm = <T extends Record<string, any>>(
  data: T,
  definition: FormDefinition<T>
): { valid: boolean; errors: Record<keyof T, string[]> } => {
  const errors = {} as Record<keyof T, string[]>;
  let valid = true;

  for (const [key, config] of Object.entries(definition)) {
    const fieldErrors = config.validators(data[key as keyof T]);
    errors[key as keyof T] = fieldErrors;
    if (fieldErrors.length > 0) valid = false;
  }

  return { valid, errors };
};

// ===== 使用场景：注册表单 =====

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  age: number;
  bio: string;
}

const registerFormDefinition: FormDefinition<RegisterForm> = {
  username: {
    value: '',
    validators: combineValidators(
      required('用户名必填'),
      minLength(3, '用户名至少 3 个字符'),
      maxLength(20, '用户名最多 20 个字符'),
      pattern(/^[a-zA-Z0-9_]+$/, '只能包含字母、数字和下划线')
    )
  },
  email: {
    value: '',
    validators: combineValidators(
      required('邮箱必填'),
      emailValidator
    )
  },
  password: {
    value: '',
    validators: combineValidators(
      required('密码必填'),
      minLength(8, '密码至少 8 个字符'),
      pattern(/[A-Z]/, '必须包含大写字母'),
      pattern(/[0-9]/, '必须包含数字')
    )
  },
  confirmPassword: {
    value: '',
    validators: []  // 跨字段验证单独处理
  },
  age: {
    value: 0,
    validators: combineValidators(
      numberRange(18, 120, '年龄必须在 18-120 之间')
    )
  },
  bio: {
    value: '',
    validators: optional(combineValidators(
      maxLength(500, '个人简介最多 500 个字符')
    ))
  }
};

// 跨字段验证 (组合子模式)
const confirmMatches = <T extends { password: string; confirmPassword: string }>(
  form: T
): string[] =>
  form.password === form.confirmPassword
    ? []
    : ['两次输入的密码不一致'];

// 完整验证
const fullValidation = (data: RegisterForm) => {
  const result = validateForm(data, registerFormDefinition);
  const crossFieldErrors = confirmMatches(data);

  if (crossFieldErrors.length > 0) {
    result.errors.confirmPassword = crossFieldErrors;
    result.valid = false;
  }

  return result;
};

// 测试
const testData: RegisterForm = {
  username: 'ab',           // 太短
  email: 'invalid',         // 无效邮箱
  password: 'weak',         // 太短，无大写，无数字
  confirmPassword: 'weak2', // 不匹配
  age: 15,                  // 太小
  bio: ''
};

const result = fullValidation(testData);
console.log('Valid:', result.valid);  // false
console.log('Errors:', JSON.stringify(result.errors, null, 2));

// 有效数据
const validData: RegisterForm = {
  username: 'alice_wonder',
  email: 'alice@example.com',
  password: 'SecurePass1',
  confirmPassword: 'SecurePass1',
  age: 25,
  bio: 'Hello world'
};

const validResult = fullValidation(validData);
console.log('Valid:', validResult.valid);  // true
```

### 示例 10: 函数式状态管理 (Redux 增强版)

```typescript
// ===== 函数式状态管理核心 =====

// Action 类型 ( discriminated union)
type Action =
  | { type: 'ADD_TODO'; payload: { text: string } }
  | { type: 'REMOVE_TODO'; payload: { id: number } }
  | { type: 'TOGGLE_TODO'; payload: { id: number } }
  | { type: 'SET_FILTER'; payload: 'all' | 'active' | 'completed' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: number;
}

interface State {
  todos: Todo[];
  filter: 'all' | 'active' | 'completed';
  nextId: number;
}

// ===== 纯函数 Reducer =====

const initialState: State = {
  todos: [],
  filter: 'all',
  nextId: 1
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        ...state,
        todos: [...state.todos, {
          id: state.nextId,
          text: action.payload.text,
          completed: false,
          createdAt: Date.now()
        }],
        nextId: state.nextId + 1
      };

    case 'REMOVE_TODO':
      return {
        ...state,
        todos: state.todos.filter(t => t.id !== action.payload.id)
      };

    case 'TOGGLE_TODO':
      return {
        ...state,
        todos: state.todos.map(t =>
          t.id === action.payload.id
            ? { ...t, completed: !t.completed }
            : t
        )
      };

    case 'SET_FILTER':
      return { ...state, filter: action.payload };

    default:
      return state;
  }
};

// ===== 纯函数选择器 (Selectors) =====

const getTodos = (state: State) => state.todos;
const getFilter = (state: State) => state.filter;

const getFilteredTodos = (state: State): Todo[] => {
  switch (state.filter) {
    case 'active': return state.todos.filter(t => !t.completed);
    case 'completed': return state.todos.filter(t => t.completed);
    default: return state.todos;
  }
};

const getTodoStats = (state: State) => ({
  total: state.todos.length,
  completed: state.todos.filter(t => t.completed).length,
  active: state.todos.filter(t => !t.completed).length
});

// 组合选择器
const composeSelectors = <S, T>(...selectors: ((state: S) => T)[]) =>
  (state: S): T[] => selectors.map(fn => fn(state));

// ===== Undo/Redo 包装器 (纯函数实现) =====

interface UndoableState<S> {
  past: S[];
  present: S;
  future: S[];
}

const initUndoable = <S>(present: S): UndoableState<S> => ({
  past: [],
  present,
  future: []
});

const undo = <S>(state: UndoableState<S>): UndoableState<S> => {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  const newPast = state.past.slice(0, -1);
  return {
    past: newPast,
    present: previous,
    future: [state.present, ...state.future]
  };
};

const redo = <S>(state: UndoableState<S>): UndoableState<S> => {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  const newFuture = state.future.slice(1);
  return {
    past: [...state.past, state.present],
    present: next,
    future: newFuture
  };
};

const undoableReducer = <S>(
  reducer: (state: S, action: Action) => S,
  undoableState: UndoableState<S>,
  action: Action
): UndoableState<S> => {
  if (action.type === 'UNDO') return undo(undoableState);
  if (action.type === 'REDO') return redo(undoableState);

  const newPresent = reducer(undoableState.present, action);
  return {
    past: [...undoableState.past, undoableState.present],
    present: newPresent,
    future: []
  };
};

// ===== 使用示例 =====

let undoableState = initUndoable(initialState);

// dispatch 辅助函数
const dispatch = (action: Action) => {
  undoableState = undoableReducer(reducer, undoableState, action);
  return undoableState;
};

// 操作
dispatch({ type: 'ADD_TODO', payload: { text: '学习 FP' } });
dispatch({ type: 'ADD_TODO', payload: { text: '写代码' } });
dispatch({ type: 'ADD_TODO', payload: { text: '复习 FP' } });
dispatch({ type: 'TOGGLE_TODO', payload: { id: 1 } });

console.log('Present:', getFilteredTodos(undoableState.present));
console.log('Stats:', getTodoStats(undoableState.present));
console.log('Undo steps:', undoableState.past.length);

// 撤销
dispatch({ type: 'UNDO' });
console.log('After undo:', getTodoStats(undoableState.present));

// 重做
dispatch({ type: 'REDO' });
console.log('After redo:', getTodoStats(undoableState.present));

// ===== 中间件模式 (纯函数版) =====

type Middleware<S> = (
  store: { getState: () => S; dispatch: (action: Action) => void }
) => (next: (action: Action) => void) => (action: Action) => void;

// Logger 中间件
const loggerMiddleware: Middleware<any> = store => next => action => {
  console.log('→ Dispatching:', action.type);
  console.log('  Before:', store.getState());
  next(action);
  console.log('  After:', store.getState());
};

// Validation 中间件
const validationMiddleware: Middleware<any> = _store => next => action => {
  if (action.type === 'ADD_TODO' && !action.payload.text.trim()) {
    console.warn('⚠️ Empty todo text ignored');
    return;
  }
  next(action);
};

// 组合中间件
const applyMiddleware = <S>(
  reducer: (state: S, action: Action) => S,
  initialState: S,
  middlewares: Middleware<S>[]
) => {
  let state = initialState;
  const listeners: (() => void)[] = [];

  const store = {
    getState: () => state,
    dispatch: (() => {}) as (action: Action) => void,
    subscribe: (fn: () => void) => {
      listeners.push(fn);
      return () => {
        const idx = listeners.indexOf(fn);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }
  };

  let dispatch = (action: Action) => {
    state = reducer(state, action);
    listeners.forEach(fn => fn());
  };

  // 应用中间件 (从右到左)
  const chain = middlewares.map(mw => mw(store));
  chain.reverse().forEach(mw => {
    const next = dispatch;
    dispatch = mw(next);
  });

  store.dispatch = dispatch;
  return store;
};

// 创建带中间件的 store
// const store = applyMiddleware(reducer, initialState, [
//   loggerMiddleware,
//   validationMiddleware
// ]);
// store.dispatch({ type: 'ADD_TODO', payload: { text: 'Hello' } });
```

### 示例 11: 函数式 JSON 操作 (Lens + 递归)

```typescript
// ===== JSON 路径操作 =====

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
interface JsonObject { [key: string]: JsonValue }
interface JsonArray extends Array<JsonValue> {}

// JSON Lens
type JsonPath = (string | number)[];

// 安全读取
const jsonGet = (path: JsonPath) => (obj: JsonValue): JsonValue | undefined =>
  path.reduce<JsonValue | undefined>((acc, key) => {
    if (acc == null) return undefined;
    if (typeof key === 'number' && Array.isArray(acc)) return acc[key];
    if (typeof key === 'string' && typeof acc === 'object') return (acc as JsonObject)[key];
    return undefined;
  }, obj);

// 不可变设置
const jsonSet = (path: JsonPath, value: JsonValue) => (obj: JsonValue): JsonValue => {
  if (path.length === 0) return value;

  const [key, ...rest] = path;

  if (typeof key === 'number' && Array.isArray(obj)) {
    const newArr = [...obj];
    newArr[key] = rest.length === 0 ? value : jsonSet(rest, value)(obj[key] ?? null);
    return newArr;
  }

  if (typeof key === 'string' && obj != null && typeof obj === 'object') {
    const newObj = { ...(obj as JsonObject) };
    newObj[key] = rest.length === 0 ? value : jsonSet(rest, value)(newObj[key] ?? {});
    return newObj;
  }

  return obj;
};

// 删除
const jsonDelete = (path: JsonPath) => (obj: JsonValue): JsonValue => {
  if (path.length === 0) return obj;

  const [key, ...rest] = path;

  if (typeof key === 'number' && Array.isArray(obj)) {
    const newArr = [...obj];
    if (rest.length === 0) {
      newArr.splice(key, 1);
    } else {
      newArr[key] = jsonDelete(rest)(newArr[key] ?? null);
    }
    return newArr;
  }

  if (typeof key === 'string' && obj != null && typeof obj === 'object') {
    const newObj = { ...(obj as JsonObject) };
    if (rest.length === 0) {
      delete newObj[key];
    } else {
      newObj[key] = jsonDelete(rest)(newObj[key] ?? null);
    }
    return newObj;
  }

  return obj;
};

// 更新
const jsonUpdate = (path: JsonPath, transformer: (v: JsonValue) => JsonValue) =>
  (obj: JsonValue): JsonValue => {
    const current = jsonGet(path)(obj);
    return jsonSet(path, transformer(current))(obj);
  };

// ===== 使用场景：复杂 JSON 操作 =====

const jsonData: JsonObject = {
  users: [
    { id: 1, name: 'Alice', profile: { age: 25, city: 'Beijing' } },
    { id: 2, name: 'Bob', profile: { age: 30, city: 'Shanghai' } },
    { id: 3, name: 'Charlie', profile: { age: 28, city: 'Guangzhou' } }
  ],
  metadata: {
    total: 3,
    page: 1,
    version: '1.0'
  }
};

// 读取
console.log('Alice city:', jsonGet(['users', 0, 'profile', 'city'])(jsonData));
// "Beijing"

console.log('Total:', jsonGet(['metadata', 'total'])(jsonData));
// 3

// 不可变更新
const updated = jsonSet(['users', 0, 'profile', 'city'], 'Shenzhen')(jsonData);
console.log('Updated:', (updated as JsonObject).users[0].profile.city);
// "Shenzhen"
console.log('Original:', (jsonData as JsonObject).users[0].profile.city);
// "Beijing" (不变)

// 删除字段
const deleted = jsonDelete(['metadata', 'version'])(jsonData);
console.log('Has version:', 'version' in ((deleted as JsonObject).metadata as JsonObject));
// false

// 批量更新 (给所有用户加 1 岁)
const aged = jsonUpdate(['users'], (users: JsonValue) =>
  (users as JsonObject[]).map(user => ({
    ...user,
    profile: {
      ...(user.profile as JsonObject),
      age: ((user.profile as JsonObject).age as number) + 1
    }
  }))
)(jsonData);

console.log('Aged ages:', (aged as JsonObject).users.map(u => (u as JsonObject).profile.age));
// [26, 31, 29]

// ===== JSON 查询 (函数式过滤) =====

const jsonQuery = <T extends JsonValue>(
  pred: (value: JsonValue, path: JsonPath) => boolean
) => (obj: T): { path: JsonPath; value: JsonValue }[] => {
  const results: { path: JsonPath; value: JsonValue }[] = [];

  const walk = (current: JsonValue, path: JsonPath) => {
    if (pred(current, path)) {
      results.push({ path, value: current });
    }
    if (Array.isArray(current)) {
      current.forEach((item, idx) => walk(item, [...path, idx]));
    } else if (current != null && typeof current === 'object') {
      Object.entries(current as JsonObject).forEach(([key, value]) =>
        walk(value, [...path, key])
      );
    }
  };

  walk(obj, []);
  return results;
};

// 查找所有 age 字段
const ages = jsonQuery((value, path) =>
  path[path.length - 1] === 'age' && typeof value === 'number'
)(jsonData);

console.log('All ages:', ages);
// [{ path: ['users', 0, 'profile', 'age'], value: 25 }, ...]

// 查找所有字符串值包含 'ing'
const containingIng = jsonQuery((value) =>
  typeof value === 'string' && value.includes('ing')
)(jsonData);

console.log('Strings with "ing":', containingIng);
```

### 示例 12: 函数式解析器组合子

```typescript
// ===== 解析器组合子 (Parser Combinators) =====

// Parser 类型：输入字符串 → 解析结果 + 剩余输入
type ParseResult<T> = { value: T; rest: string } | null;
type Parser<T> = (input: string) => ParseResult<T>;

// 基础解析器

// 匹配单个字符
const char = (c: string): Parser<string> =>
  (input: string) =>
    input.length > 0 && input[0] === c
      ? { value: c, rest: input.slice(1) }
      : null;

// 匹配字符串
const string = (s: string): Parser<string> =>
  (input: string) =>
    input.startsWith(s)
      ? { value: s, rest: input.slice(s.length) }
      : null;

// 匹配正则
const regex = (pattern: RegExp): Parser<string> =>
  (input: string) => {
    const match = pattern.exec(input);
    if (match && match.index === 0) {
      return { value: match[0], rest: input.slice(match[0].length) };
    }
    return null;
  };

// 组合子

// map: 转换解析结果
const pMap = <T, U>(fn: (v: T) => U) =>
  (parser: Parser<T>): Parser<U> =>
    (input: string) => {
      const result = parser(input);
      return result ? { value: fn(result.value), rest: result.rest } : null;
    };

// chain: 链式解析
const pChain = <T, U>(fn: (v: T) => Parser<U>) =>
  (parser: Parser<T>): Parser<U> =>
    (input: string) => {
      const result = parser(input);
      return result ? fn(result.value)(result.rest) : null;
    };

// or: 尝试另一个解析器
const pOr = <T>(parser1: Parser<T>, parser2: Parser<T>): Parser<T> =>
  (input: string) => parser1(input) || parser2(input);

// and: 顺序组合两个解析器
const pAnd = <T, U>(parser1: Parser<T>, parser2: Parser<U>): Parser<[T, U]> =>
  (input: string) => {
    const result1 = parser1(input);
    if (!result1) return null;
    const result2 = parser2(result1.rest);
    return result2 ? { value: [result1.value, result2.value], rest: result2.rest } : null;
  };

// many: 重复 0 次或多次
const many = <T>(parser: Parser<T>): Parser<T[]> =>
  (input: string) => {
    const results: T[] = [];
    let rest = input;
    let result = parser(rest);
    while (result) {
      results.push(result.value);
      rest = result.rest;
      result = parser(rest);
    }
    return { value: results, rest };
  };

// many1: 重复 1 次或多次
const many1 = <T>(parser: Parser<T>): Parser<T[]> =>
  (input: string) => {
    const first = parser(input);
    if (!first) return null;
    const rest = many(parser)(first.rest);
    if (!rest) return { value: [first.value], rest: first.rest };
    return { value: [first.value, ...rest.value], rest: rest.rest };
  };

// optional: 可选解析
const optional = <T>(parser: Parser<T>, defaultValue: T): Parser<T> =>
  (input: string) => parser(input) || { value: defaultValue, rest: input };

// ===== 实用解析器 =====

// 空格
const whitespace = regex(/^\s+/);
const optionalWhitespace = regex(/^\s*/);

// 标识符
const identifier = pMap(regex(/^[a-zA-Z_][a-zA-Z0-9_]*/))(s => s);

// 数字
const number = pMap(regex(/^\d+(\.\d+)?/))(s => parseFloat(s));

// 字符串字面量
const stringLiteral = pChain(char('"'))(
  () => pMap(regex(/^[^"]*/)(s => s)
)(content => pChain(char('"'))(() => pOf(content)))
);

// ===== 使用场景：解析简单表达式 =====

// 解析 "1 + 2 * 3" 这样的表达式
interface Expr = number | { type: 'binop'; op: string; left: Expr; right: Expr };

const parseNumber = number;

const parseOperator = pOr(
  pOr(char('+'), char('-')),
  pOr(char('*'), char('/'))
);

const parseExpr = pChain(parseNumber)(left =>
  pChain(optionalWhitespace)(() =>
    pChain(parseOperator)(op =>
      pChain(optionalWhitespace)(() =>
        pChain(parseExpr)(right =>
          pOf({ type: 'binop', op, left, right } as Expr)
        )
      )
    )
  )
);

// 简化：解析 "数字 运算符 数字"
const parseSimpleExpr = pChain(parseNumber)(left =>
  pChain(optionalWhitespace)(() =>
    pChain(parseOperator)(op =>
      pChain(optionalWhitespace)(() =>
        pChain(parseNumber)(right =>
          pOf({ type: 'binop', op, left, right } as Expr)
        )
      )
    )
  )
);

// 测试
const test1 = parseSimpleExpr('1 + 2');
console.log('Parse "1 + 2":', test1?.value);
// { type: 'binop', op: '+', left: 1, right: 2 }

const test2 = parseSimpleExpr('10 * 3.5');
console.log('Parse "10 * 3.5":', test2?.value);
// { type: 'binop', op: '*', left: 10, right: 3.5 }

// ===== 使用场景：解析 CSV =====

const csvCell = regex(/^[^,\n]+/);
const csvRow = pMap(many1(pAnd(csvCell, optional(char(','), ''))))(
  pairs => pairs.map(p => p[0])
);
const csvParser = pMap(many1(pAnd(csvRow, optional(regex(/^\n/), ''))))(
  pairs => pairs.map(p => p[0])
);

const csvData = 'Alice,25,Beijing\nBob,30,Shanghai\nCharlie,28,Guangzhou';
const parsed = csvParser(csvData);
console.log('CSV parsed:', parsed?.value);
// [['Alice', '25', 'Beijing'], ['Bob', '30', 'Shanghai'], ['Charlie', '28', 'Guangzhou']]

// ===== 使用场景：解析简单模板字符串 =====

// 解析 "{{name}} is {{age}} years old"
const templatePart = pOr(
  pMap(regex(/^[^{]+/))(s => ({ type: 'text', value: s })),
  pChain(string('{{'))(() =>
    pMap(regex(/^[^}]+/)(s => ({ type: 'var', name: s }))
  )(pChain(string('}}'))(() => pOf({ type: 'var', name: '' })))
);

const templateParser = pMap(many1(templatePart))(parts => parts);

const template = 'Hello {{name}}, you are {{age}} years old';
const parsedTemplate = templateParser(template);
console.log('Template parsed:', parsedTemplate?.value);
```

---

## 三、进阶概念对照表

| 概念 | v1 覆盖 | v2 覆盖 | 核心思想 |
|------|---------|---------|----------|
| 纯函数 | ✅ | ✅ | 相同输入 → 相同输出 |
| 不可变性 | ✅ | ✅ | 数据不修改，返回新数据 |
| 函数组合 | ✅ | ✅ | 小函数 → 大功能 |
| 柯里化 | ✅ | ✅ | 多参数 → 单参数链 |
| Point-Free | ❌ | ✅ | 不提及参数的函数定义 |
| Transducer | ❌ | ✅ | 单次遍历的转换管道 |
| Lens | ❌ | ✅ | 可组合的聚焦读写 |
| Reader Pattern | ❌ | ✅ | 延迟依赖注入 |
| 函数组合子 | ❌ | ✅ | I/K/B/C/S 组合子代数 |
| Functor | ✅ | ✅ | 可映射的容器 |
| Monad | ✅ | ✅ | 可链式组合的容器 |
| 递归数据结构 | ❌ | ✅ | 树/链表/流 |
| 解析器组合子 | ❌ | ✅ | 组合式解析 |

---

## 四、实战建议

### 何时使用函数式编程

```
✅ 数据处理管道 (ETL, 数据清洗)
✅ 状态管理 (Redux, 状态机)
✅ 配置/验证逻辑
✅ 需要高度可测试性的核心逻辑
✅ 复杂对象转换 (JSON, AST)
✅ 需要组合性的业务规则

❌ 简单脚本 (过度抽象)
❌ 性能极度敏感的循环 (Transducer 可缓解)
❌ 需要频繁修改的外部状态 (隔离副作用)
```

### 渐进式采用策略

```
1. 从纯函数开始 — 把计算逻辑抽成纯函数
2. 使用不可变数据 — spread 替代直接修改
3. 用高阶函数替代循环 — map/filter/reduce
4. 引入组合 — pipe/compose 构建管道
5. 需要时引入 Lens/Reader — 复杂场景
6. 核心业务用 Either/Result — 错误处理
```

---

## 五、与 v1 的关系

v1 是**基础篇**：纯函数、不可变性、组合、柯里化、Functor、Monad
v2 是**进阶篇**：Point-Free、Transducer、Lens、Reader、组合子、递归数据结构、解析器

两篇互补，覆盖函数式编程的核心概念和实战应用。

---

*专项训练完成。12 个进阶示例覆盖：Point-Free(1)、Transducer(2)、Lens(3)、Reader(4)、组合子(5)、树(6)、链表(7)、Reader+Either(8)、表单验证(9)、状态管理(10)、JSON操作(11)、解析器(12)。*
