# TypeScript 类型体操专项训练

> 日期: 2026-04-28 09:00 | 主题: 高级类型 — 泛型 / 条件类型 / 映射类型 | 挑战数: 12+

---

## 核心概念速查

### 泛型 (Generics)
```typescript
// 泛型函数
function identity<T>(arg: T): T { return arg; }

// 泛型接口
interface Repository<T> {
  findById(id: string): T | undefined;
  findAll(): T[];
  save(item: T): void;
}

// 泛型约束
function getLength<T extends { length: number }>(arg: T): number {
  return arg.length;
}

// 多泛型参数
function zip<A, B>(a: A[], b: B[]): [A, B][] {
  return a.map((item, i) => [item, b[i]]);
}
```

### 条件类型 (Conditional Types)
```typescript
// 基本语法
type IsString<T> = T extends string ? true : false;

// 分布式条件类型 (自动分发到联合类型每个成员)
type ToArray<T> = T extends any ? T[] : never;
// ToArray<string | number> = string[] | number[]

// infer 关键字 — 从类型中提取
type ElementType<T> = T extends (infer E)[] ? E : never;
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// 排除/提取
type Exclude<T, U> = T extends U ? never : T;
type Extract<T, U> = T extends U ? T : never;
```

### 映射类型 (Mapped Types)
```typescript
// 基本语法
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

type Partial<T> = {
  [P in keyof T]?: T[P];
};

// 映射类型修饰符
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];  // 移除 readonly
};

type Required<T> = {
  [P in keyof T]-?: T[P];  // 移除可选
};

// as 键重映射 (TS 4.1+)
type CapitalizeKeys<T> = {
  [P in keyof T as Capitalize<string & P>]: T[P];
};
```

---

## 挑战 1: DeepReadonly — 深度只读

**难度:** ⭐⭐
**知识点:** 递归条件类型 + 映射类型

```typescript
// 实现 DeepReadonly<T>，递归地将对象所有属性变为 readonly
type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

// 测试
interface User {
  name: string;
  profile: {
    age: number;
    settings: {
      theme: string;
    };
  };
  hobbies: string[];
}

type ReadonlyUser = DeepReadonly<User>;
// 预期: name readonly, profile readonly, profile.age readonly, profile.settings readonly, profile.settings.theme readonly

// 边界处理: 函数类型、数组、null、undefined
type DeepReadonlyV2<T> = T extends Function | null | undefined
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonlyV2<T[K]> }
    : T;

// 测试用例
const test1: DeepReadonlyV2<User> = {
  name: "Alice",
  profile: { age: 25, settings: { theme: "dark" } },
  hobbies: ["coding"]
};
// @ts-expect-error — 所有层级都应该不可修改
test1.profile.settings.theme = "light";
```

---

## 挑战 2: DeepPartial — 深度可选

**难度:** ⭐⭐
**知识点:** 递归映射类型 + 条件类型

```typescript
// 实现 DeepPartial<T>，递归地将对象所有属性变为可选
type DeepPartial<T> = T extends Function | null | undefined
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

// 测试
interface Config {
  server: {
    host: string;
    port: number;
    ssl: {
      cert: string;
      key: string;
    };
  };
  database: {
    url: string;
    pool: { min: number; max: number };
  };
  features: string[];
}

// 只需要提供部分配置
const partialConfig: DeepPartial<Config> = {
  server: {
    port: 3000
  }
};
```

---

## 挑战 3: DeepRequired — 深度必填

**难度:** ⭐⭐⭐
**知识点:** 递归映射 + `-?` 修饰符

```typescript
// 实现 DeepRequired<T>，递归地移除所有可选标记
type DeepRequired<T> = T extends Function | null | undefined
  ? T
  : T extends object
    ? { [K in keyof T]-?: DeepRequired<NonNullable<T[K]>> }
    : T;

// 测试
interface OptionalConfig {
  name?: string;
  settings?: {
    theme?: string;
    lang?: string;
  };
}

type RequiredConfig = DeepRequired<OptionalConfig>;
// 预期: name 必填, settings 必填, settings.theme 必填, settings.lang 必填

// 使用验证
const config: RequiredConfig = {
  name: "app",
  settings: { theme: "dark", lang: "zh" }
};
// @ts-expect-error — settings.theme 缺失
const badConfig: RequiredConfig = { name: "app", settings: {} };
```

---

## 挑战 4: PickByType — 按类型筛选属性

**难度:** ⭐⭐⭐
**知识点:** 映射类型 + `as` 键重映射 + 条件类型

```typescript
// 实现 PickByType<T, U>，从 T 中筛选出值类型为 U 的属性
type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

// 测试
interface User {
  name: string;
  age: number;
  email: string;
  active: boolean;
  role: string;
  score: number;
}

type StringFields = PickByType<User, string>;
// 预期: { name: string; email: string; role: string }

type NumberFields = PickByType<User, number>;
// 预期: { age: number; score: number }

// 进阶: PickByTypeStrict — 精确匹配 (不含子类型)
type PickByTypeStrict<T, U> = {
  [K in keyof T as [T[K]] extends [U]
    ? [U] extends [T[K]]
      ? K
      : never
    : never]: T[K];
};

// 测试
interface Mixed {
  a: string;
  b: "hello";
  c: number;
  d: 42;
}

type ExactStrings = PickByTypeStrict<Mixed, string>;
// 预期: { a: string } — "hello" 是 string 的子类型，不应包含
```

---

## 挑战 5: OmitByType — 按类型排除属性

**难度:** ⭐⭐⭐
**知识点:** 映射类型 + `as` 键重映射 + 排除逻辑

```typescript
// 实现 OmitByType<T, U>，从 T 中排除值类型为 U 的属性
type OmitByType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

// 测试
interface APIResponse {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  data: Record<string, unknown>;
}

// 排除 Date 类型字段
type CleanResponse = OmitByType<APIResponse, Date>;
// 预期: { id: number; name: string; deletedAt: Date | null; data: ... }
// 注意: Date | null 不被排除 (因为 extends Date 为 false)

// 进阶: 排除 null 和 undefined
type NonNullableFields<T> = OmitByType<T, null | undefined>;
```

---

## 挑战 6: TupleToUnion — 元组转联合类型

**难度:** ⭐⭐
**知识点:** 条件类型 + infer + 递归

```typescript
// 实现 TupleToUnion<T>，将元组类型转为联合类型
type TupleToUnion<T extends readonly unknown[]> =
  T extends readonly [infer First, ...infer Rest]
    ? First | TupleToUnion<Rest>
    : never;

// 测试
type Result1 = TupleToUnion<[string, number, boolean]>;
// 预期: string | number | boolean

type Result2 = TupleToUnion<["a", "b", "c"]>;
// 预期: "a" | "b" | "c"

type Result3 = TupleToUnion<[]>;
// 预期: never

// 简化版 (利用索引访问)
type TupleToUnionSimple<T extends readonly unknown[]> = T[number];
// T[number] 直接返回元组所有元素类型的联合
```

---

## 挑战 7: UnionToIntersection — 联合转交叉

**难度:** ⭐⭐⭐⭐
**知识点:** 分布式条件类型 + infer + 函数参数逆变

```typescript
// 实现 UnionToIntersection<U>，将联合类型转为交叉类型
// 核心技巧: 利用函数参数的逆变性
type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void
    ? I
    : never;

// 测试
type Result1 = UnionToIntersection<{ a: 1 } | { b: 2 } | { c: 3 }>;
// 预期: { a: 1 } & { b: 2 } & { c: 3 }

// 原理拆解:
// 1. (U extends any ? (x: U) => void : never) 分布式展开:
//    ((x: {a:1}) => void) | ((x: {b:2}) => void) | ((x: {c:3}) => void)
// 2. 联合函数类型 extends (x: infer I) => void
//    函数参数逆变: infer I = {a:1} & {b:2} & {c:3}

// 实际应用: 合并多个事件处理器类型
type Events = {
  click: (e: MouseEvent) => void;
  keydown: (e: KeyboardEvent) => void;
  scroll: (e: Event) => void;
};

type EventUnion = Events[keyof Events];
type CombinedHandler = UnionToIntersection<EventUnion>;
// 预期: ((e: MouseEvent) => void) & ((e: KeyboardEvent) => void) & ((e: Event) => void)
```

---

## 挑战 8: Curried Function — 柯里化类型推断

**难度:** ⭐⭐⭐⭐
**知识点:** 泛型约束 + 递归条件类型 + 元组操作

```typescript
// 实现 Curried 类型，为函数生成柯里化签名
// curry((a: string, b: number, c: boolean) => void) 
//   → (a: string) => (b: number) => (c: boolean) => void

type Curried<T extends (...args: any[]) => any> =
  T extends (...args: infer Args) => infer R
    ? Args extends []
      ? R
      : Args extends [infer First, ...infer Rest]
        ? Rest extends []
          ? (arg: First) => R
          : (arg: First) => Curried<(...args: Rest) => R>
        : never
    : never;

// 测试
type Add = (a: number, b: number) => number;
type CurriedAdd = Curried<Add>;
// 预期: (a: number) => (b: number) => number

type Triple = (a: string, b: number, c: boolean) => string;
type CurriedTriple = Curried<Triple>;
// 预期: (a: string) => (b: number) => (c: boolean) => string

// 实际柯里化函数实现
function curry<T extends (...args: any[]) => any>(fn: T): Curried<T> {
  return (function curried(...args: any[]) {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...more: any[]) => curried(...args, ...more);
  }) as any;
}

const add = (a: number, b: number) => a + b;
const curriedAdd = curry(add);
const result = curriedAdd(1)(2); // 3
```

---

## 挑战 9: Flatten — 深度扁平化元组

**难度:** ⭐⭐⭐⭐
**知识点:** 递归条件类型 + 元组展开 + infer

```typescript
// 实现 Flatten<T>，将嵌套元组扁平化为一维元组
type Flatten<T extends readonly unknown[]> =
  T extends readonly [infer First, ...infer Rest]
    ? First extends readonly unknown[]
      ? [...Flatten<First>, ...Flatten<Rest>]
      : [First, ...Flatten<Rest>]
    : [];

// 测试
type Result1 = Flatten<[1, [2, 3], [4, [5, 6]]]>;
// 预期: [1, 2, 3, 4, 5, 6]

type Result2 = Flatten<[["a"], ["b", ["c"]], []]>;
// 预期: ["a", "b", "c"]

type Result3 = Flatten<[]>;
// 预期: []

// 进阶: ArrayFlatten — 处理数组类型 (非字面量)
type ArrayFlatten<T> = T extends readonly (infer E)[]
  ? E extends readonly unknown[]
    ? ArrayFlatten<E>
    : E
  : T;

// 测试
type R1 = ArrayFlatten<number[][]>; // number
type R2 = ArrayFlatten<string[][][]>; // string
```

---

## 挑战 10: RequiredKeys / OptionalKeys — 提取必填/可选键

**难度:** ⭐⭐⭐
**知识点:** 映射类型 + 条件类型 + keyof

```typescript
// 实现 RequiredKeys<T> — 提取必填键的联合类型
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

// 实现 OptionalKeys<T> — 提取可选键的联合类型
type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

// 原理:
// {} extends Pick<T, K> 为 true 当且仅当 K 是可选的
// 因为空对象可以赋值给 {K?: T[K]} 但不能赋值给 {K: T[K]}

// 测试
interface User {
  id: number;
  name: string;
  email?: string;
  age?: number;
  role: string;
}

type Req = RequiredKeys<User>;
// 预期: "id" | "name" | "role"

type Opt = OptionalKeys<User>;
// 预期: "email" | "age"

// 进阶: SplitKeys — 同时拆分
type SplitKeys<T> = {
  required: RequiredKeys<T>;
  optional: OptionalKeys<T>;
};

type UserSplit = SplitKeys<User>;
// 预期: { required: "id" | "name" | "role"; optional: "email" | "age" }
```

---

## 挑战 11: Merge — 智能类型合并

**难度:** ⭐⭐⭐⭐
**知识点:** 映射类型 + 键遍历 + 条件类型

```typescript
// 实现 Merge<T, U>，将 U 的属性合并到 T，U 覆盖 T 的同名属性
type Merge<T, U> = {
  [K in keyof T | keyof U]:
    K extends keyof U ? U[K]
    : K extends keyof T ? T[K]
    : never;
};

// 测试
type DefaultConfig = {
  host: string;
  port: number;
  timeout: number;
  retries: number;
};

type UserConfig = {
  port: 8080;
  timeout: 5000;
  ssl: boolean;
};

type FinalConfig = Merge<DefaultConfig, UserConfig>;
// 预期: { host: string; port: 8080; timeout: 5000; retries: number; ssl: boolean }

// 进阶: DeepMerge — 深度合并
type DeepMerge<T, U> = T extends object
  ? U extends object
    ? {
        [K in keyof T | keyof U]:
          K extends keyof U
            ? K extends keyof T
              ? T[K] extends object
                ? U[K] extends object
                  ? DeepMerge<T[K], U[K]>
                  : U[K]
                : U[K]
              : U[K]
            : K extends keyof T
              ? T[K]
              : never;
      }
    : U
  : U;

// 测试
type Base = {
  server: { host: string; port: number };
  features: { auth: boolean; logging: boolean };
};

type Override = {
  server: { port: 8080; ssl: boolean };
  features: { auth: true };
};

type Merged = DeepMerge<Base, Override>;
// 预期: { server: { host: string; port: 8080; ssl: boolean }; features: { auth: true; logging: boolean } }
```

---

## 挑战 12: PromiseType — 提取 Promise 内部类型

**难度:** ⭐⭐
**知识点:** 条件类型 + infer

```typescript
// 实现 PromiseType<T>，从 Promise<T> 中提取 T
type PromiseType<T> = T extends Promise<infer U> ? U : T;

// 测试
type R1 = PromiseType<Promise<string>>; // string
type R2 = PromiseType<Promise<{ id: number; name: string }>>; // { id: number; name: string }
type R3 = PromiseType<number>; // number (非 Promise 原样返回)

// 进阶: AsyncReturnType — 异步函数返回值类型
type AsyncReturnType<T extends (...args: any[]) => Promise<any>> =
  T extends (...args: any[]) => Promise<infer R> ? R : never;

// 测试
async function fetchUser(id: number): Promise<{ id: number; name: string }> {
  return { id, name: "Alice" };
}

type User = AsyncReturnType<typeof fetchUser>;
// 预期: { id: number; name: string }
```

---

## 挑战 13: Trim / Replace / Includes — 字符串类型操作

**难度:** ⭐⭐⭐⭐
**知识点:** 模板字符串类型 + infer + 递归

```typescript
// 实现 Trim<T> — 去除首尾空格
type Trim<T extends string> =
  T extends ` ${infer Rest}` | `${infer Rest} `
    ? Trim<Rest>
    : T;

// 测试
type R1 = Trim<"  hello  ">; // "hello"
type R2 = Trim<"hello">; // "hello"
type R3 = Trim<"   ">; // ""

// 实现 Replace<S, From, To> — 替换第一个匹配
type Replace<
  S extends string,
  From extends string,
  To extends string
> = S extends `${infer Prefix}${From}${infer Rest}`
  ? `${Prefix}${To}${Rest}`
  : S;

// 测试
type R4 = Replace<"hello world", "world", "ts">; // "hello ts"
type R5 = Replace<"no match", "xyz", "abc">; // "no match"

// 实现 ReplaceAll<S, From, To> — 替换所有匹配
type ReplaceAll<
  S extends string,
  From extends string,
  To extends string
> = S extends `${infer Prefix}${From}${infer Rest}`
  ? ReplaceAll<`${Prefix}${To}${Rest}`, From, To>
  : S;

// 测试
type R6 = ReplaceAll<"a-b-c", "-", "_">; // "a_b_c"

// 实现 Includes<S, Search> — 检查是否包含子串
type Includes<S extends string, Search extends string> =
  S extends `${infer _Prefix}${Search}${infer _Rest}` ? true : false;

// 测试
type R7 = Includes<"hello world", "world">; // true
type R8 = Includes<"hello", "xyz">; // false
```

---

## 挑战 14: ParameterConstraint — 参数约束工具

**难度:** ⭐⭐⭐
**知识点:** 泛型约束 + 条件类型 + 函数类型推断

```typescript
// 实现 Parameters<T> — 提取函数参数元组 (TS 内置，手写版)
type MyParameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never;

// 实现 ReturnType<T> — 提取函数返回值 (TS 内置，手写版)
type MyReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : never;

// 实现 ThisParameterType<T> — 提取 this 类型
type MyThisParameterType<T> =
  T extends (this: infer U, ...args: any) => any ? U : unknown;

// 实现 OmitThisParameter<T> — 移除 this 参数
type MyOmitThisParameter<T> =
  T extends (this: any, ...args: infer P) => infer R
    ? (...args: P) => R
    : T;

// 测试
interface MyThis {
  name: string;
  greet(): void;
}

type GreetFn = (this: MyThis, message: string) => void;

type ThisType = MyThisParameterType<GreetFn>;
// 预期: MyThis

type CleanFn = MyOmitThisParameter<GreetFn>;
// 预期: (message: string) => void
```

---

## 挑战 15: EventMap — 类型安全事件系统

**难度:** ⭐⭐⭐⭐⭐
**知识点:** 映射类型 + 泛型 + 条件类型 + 模板字符串 — 综合实战

```typescript
// 实现类型安全的事件系统
// 需求: 事件名和处理器参数完全类型安全

// 1. 定义事件映射
interface Events {
  "user:login": { userId: string; timestamp: number };
  "user:logout": { userId: string };
  "user:update": { userId: string; changes: Partial<{ name: string; email: string }> };
  "system:error": { code: number; message: string };
}

// 2. 实现 EventEmitter 类型
type EventEmitter<E extends Record<string, any>> = {
  on<K extends keyof E & string>(
    event: K,
    handler: (payload: E[K]) => void
  ): () => void; // 返回取消订阅函数

  once<K extends keyof E & string>(
    event: K,
    handler: (payload: E[K]) => void
  ): void;

  emit<K extends keyof E & string>(
    event: K,
    payload: E[K]
  ): void;

  off<K extends keyof E & string>(
    event: K,
    handler: (payload: E[K]) => void
  ): void;
};

// 3. 实现事件名过滤器 — 按前缀筛选
type EventsByPrefix<E, Prefix extends string> = {
  [K in keyof E & string as K extends `${Prefix}${infer _Rest}` ? K : never]: E[K];
};

// 测试
type UserEvents = EventsByPrefix<Events, "user:">;
// 预期: { "user:login": {...}; "user:logout": {...}; "user:update": {...} }

// 4. 实现事件处理器映射
type EventHandlerMap<E> = {
  [K in keyof E]?: (payload: E[K]) => void;
};

// 5. 实现提取所有事件名
type EventNames<E> = keyof E & string;

type AllEvents = EventNames<Events>;
// 预期: "user:login" | "user:logout" | "user:update" | "system:error"

// 6. 类型安全的使用示例
declare const emitter: EventEmitter<Events>;

// ✅ 正确用法
emitter.on("user:login", (payload) => {
  payload.userId; // string
  payload.timestamp; // number
});

emitter.emit("system:error", { code: 500, message: "Internal Error" });

// @ts-expect-error — 事件名不存在
emitter.on("user:delete", () => {});

// @ts-expect-error — payload 类型错误
emitter.emit("user:login", { userId: 123, timestamp: "now" });
```

---

## 挑战 16: Path — 对象路径类型推断

**难度:** ⭐⭐⭐⭐⭐
**知识点:** 递归条件类型 + 模板字符串 + 映射类型 — 终极挑战

```typescript
// 实现 Path<T> — 生成对象所有可能的路径字符串联合
// 类似 lodash 的 get 函数路径推断

type Path<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${Prefix}${K}` | Path<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : "";

// 测试
interface User {
  name: string;
  address: {
    city: string;
    zip: string;
    geo: {
      lat: number;
      lng: number;
    };
  };
  posts: Array<{ title: string }>;
}

type UserPaths = Path<User>;
// 预期包含:
// "name" | "address" | "address.city" | "address.zip" 
// | "address.geo" | "address.geo.lat" | "address.geo.lng"
// | "posts"

// 实现 PathValue<T, P> — 根据路径获取类型
type PathValue<T, P extends string> =
  P extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
      ? PathValue<T[Key], Rest>
      : never
    : P extends keyof T
      ? T[P]
      : never;

// 测试
type NameType = PathValue<User, "name">; // string
type CityType = PathValue<User, "address.city">; // string
type LatType = PathValue<User, "address.geo.lat">; // number

// 实现类型安全的 get 函数
function get<T, P extends Path<T>>(
  obj: T,
  path: P
): PathValue<T, P> {
  const keys = path.split(".") as (keyof T)[];
  let result: any = obj;
  for (const key of keys) {
    result = result?.[key];
  }
  return result;
}

// 使用
const user: User = {
  name: "Alice",
  address: {
    city: "Beijing",
    zip: "100000",
    geo: { lat: 39.9, lng: 116.4 }
  },
  posts: []
};

const city = get(user, "address.city"); // 类型: string
const lat = get(user, "address.geo.lat"); // 类型: number
// @ts-expect-error — 路径不存在
const invalid = get(user, "address.phone");
```

---

## 挑战 17: Immutable — 不可变数据结构类型

**难度:** ⭐⭐⭐⭐
**知识点:** 映射类型 + 条件类型 + 数组/Map/Set 处理

```typescript
// 实现 Immutable<T> — 将类型变为完全不可变
// 包括: readonly 属性、只读数组、只读 Map/Set

type Immutable<T> = T extends Function | null | undefined
  ? T
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<Immutable<K>, Immutable<V>>
    : T extends Set<infer U>
      ? ReadonlySet<Immutable<U>>
      : T extends Array<infer E>
        ? ReadonlyArray<Immutable<E>>
        : T extends object
          ? { readonly [K in keyof T]: Immutable<T[K]> }
          : T;

// 测试
interface MutableState {
  users: Array<{ name: string; tags: string[] }>;
  config: Map<string, { theme: string }>;
  cache: Set<string>;
  count: number;
}

type ImmutableState = Immutable<MutableState>;

// 验证: 所有属性 readonly
// users: ReadonlyArray<Immutable<{ name: string; tags: ReadonlyArray<string> }>>
// config: ReadonlyMap<Immutable<string>, Immutable<{ theme: string }>>
// cache: ReadonlySet<Immutable<string>>

// 实际应用: 状态管理中的不可变状态
function freezeState<T>(state: T): Immutable<T> {
  return Object.freeze(state) as Immutable<T>;
}
```

---

## 挑战 18: Overload — 函数重载类型工具

**难度:** ⭐⭐⭐⭐⭐
**知识点:** 条件类型 + infer + 函数类型 — 终极挑战

```typescript
// 实现 GetOverloads<T> — 提取函数所有重载签名
// 这是一个高级技巧，利用 TypeScript 的条件类型推断行为

// 简化版: 提取最后一个重载的参数和返回值
type LastOverload<T> =
  T extends { (...args: infer A): infer R; length: infer L }
    ? (...args: A) => R
    : never;

// 更实用的: 函数参数合并工具
// 实现 MergeFunctionParams<T, U> — 合并两个函数类型的参数
type MergeFunctionParams<
  T extends (...args: any[]) => any,
  U extends (...args: any[]) => any
> = (
  ...args: [...MyParameters<T>, ...MyParameters<U>]
) => MyReturnType<T> & MyReturnType<U>;

// 测试
type Fn1 = (a: string) => { name: string };
type Fn2 = (b: number) => { age: number };
type MergedFn = MergeFunctionParams<Fn1, Fn2>;
// 预期: (a: string, b: number) => { name: string } & { age: number }

// 函数组合类型 (pipe/compose)
type Compose<
  F extends (x: any) => any,
  G extends (x: any) => any
> = G extends (x: infer GIn) => infer GOut
  ? F extends (x: GOut) => infer FOut
    ? (x: GIn) => FOut
    : never
  : never;

// 测试
type ToStr = (n: number) => string;
type ToUpper = (s: string) => Uppercase<string>;
type Composed = Compose<ToUpper, ToStr>;
// 预期: (n: number) => Uppercase<string>
```

---

## 内置工具类型手写实现

```typescript
// 手写 TS 常用内置工具类型

// 1. Partial
type MyPartial<T> = { [P in keyof T]?: T[P]; };

// 2. Required
type MyRequired<T> = { [P in keyof T]-?: T[P]; };

// 3. Readonly
type MyReadonly<T> = { readonly [P in keyof T]: T[P]; };

// 4. Record
type MyRecord<K extends keyof any, T> = { [P in K]: T; };

// 5. Pick
type MyPick<T, K extends keyof T> = { [P in K]: T[P]; };

// 6. Omit
type MyOmit<T, K extends keyof any> = MyPick<T, Exclude<keyof T, K>>;

// 7. Exclude
type MyExclude<T, U> = T extends U ? never : T;

// 8. Extract
type MyExtract<T, U> = T extends U ? T : never;

// 9. NonNullable
type MyNonNullable<T> = T extends null | undefined ? never : T;

// 10. Parameters
type MyParameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never;

// 11. ConstructorParameters
type MyConstructorParameters<T extends new (...args: any) => any> =
  T extends new (...args: infer P) => any ? P : never;

// 12. ReturnType
type MyReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : never;

// 13. InstanceType
type MyInstanceType<T extends new (...args: any) => any> =
  T extends new (...args: any) => infer R ? R : never;

// 14. ThisParameterType
type MyThisParameterType<T> =
  T extends (this: infer U, ...args: any[]) => any ? U : unknown;

// 15. OmitThisParameter
type MyOmitThisParameter<T> =
  T extends (this: any, ...args: infer P) => infer R
    ? (...args: P) => R
    : T;

// 16. ThisType (用于对象字面量)
// 这是编译器特殊处理，无法完全手写
```

---

## 速查表: 类型体操常用模式

| 模式 | 语法 | 用途 |
|------|------|------|
| 泛型参数 | `<T>` | 参数化类型 |
| 泛型约束 | `<T extends U>` | 限制泛型范围 |
| 条件类型 | `T extends U ? A : B` | 类型分支 |
| infer | `T extends infer U ? ...` | 类型提取 |
| 映射类型 | `[K in keyof T]` | 遍历属性 |
| 键重映射 | `[K in keyof T as X]` | 过滤/转换键 |
| 模板字符串 | `` `${A}${B}` `` | 字符串类型操作 |
| 元组展开 | `[...A, ...B]` | 元组合并 |
| 分布式条件 | `T extends any ? ...` | 联合类型分发 |
| 递归类型 | `type X<T> = ... X<...>` | 深度处理 |

---

## 面试高频题

### Q1: 如何实现类型安全的 EventBus？
```typescript
// 见挑战 15 — 核心是利用映射类型将事件名映射到 payload 类型
```

### Q2: 如何实现 lodash get 的类型推断？
```typescript
// 见挑战 16 — 核心是递归路径生成 + 路径类型查找
```

### Q3: 条件类型中的分布式是什么意思？
```typescript
// 当条件类型作用于联合类型时，会自动分发到每个成员
type ToArray<T> = T extends any ? T[] : never;
// ToArray<string | number> = string[] | number[] (不是 (string | number)[])

// 阻止分布式: 用 [] 包裹
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;
// ToArrayNonDist<string | number> = (string | number)[]
```

### Q4: keyof 和 in 的区别？
```typescript
// keyof T — 获取 T 的所有键的联合类型
type Keys = keyof { a: 1; b: 2 }; // "a" | "b"

// in — 在映射类型中遍历键
type Mapped = { [K in keyof T]: T[K] }; // 遍历 T 的每个键
```

### Q5: 如何实现深度只读？
```typescript
// 见挑战 1 — 递归 + 映射类型
```

---

## 总结

### 本次训练覆盖 (18 个挑战)

| # | 挑战 | 难度 | 核心知识点 |
|---|------|------|-----------|
| 1 | DeepReadonly | ⭐⭐ | 递归条件类型 + 映射 |
| 2 | DeepPartial | ⭐⭐ | 递归映射类型 |
| 3 | DeepRequired | ⭐⭐⭐ | 递归 + -? 修饰符 |
| 4 | PickByType | ⭐⭐⭐ | as 键重映射 + 条件 |
| 5 | OmitByType | ⭐⭐⭐ | as 键重映射 + 排除 |
| 6 | TupleToUnion | ⭐⭐ | infer + 递归/索引 |
| 7 | UnionToIntersection | ⭐⭐⭐⭐ | 分布式 + 函数逆变 |
| 8 | Curried | ⭐⭐⭐⭐ | 泛型 + 递归元组 |
| 9 | Flatten | ⭐⭐⭐⭐ | 递归元组展开 |
| 10 | RequiredKeys/OptionalKeys | ⭐⭐⭐ | 映射 + 条件 |
| 11 | Merge/DeepMerge | ⭐⭐⭐⭐ | 映射 + 条件 + 递归 |
| 12 | PromiseType | ⭐⭐ | infer 提取 |
| 13 | Trim/Replace/Includes | ⭐⭐⭐⭐ | 模板字符串 + 递归 |
| 14 | ParameterConstraint | ⭐⭐⭐ | 函数类型推断 |
| 15 | EventMap | ⭐⭐⭐⭐⭐ | 综合实战 |
| 16 | Path | ⭐⭐⭐⭐⭐ | 递归路径 + 综合 |
| 17 | Immutable | ⭐⭐⭐⭐ | 映射 + 条件 + 集合 |
| 18 | Overload | ⭐⭐⭐⭐⭐ | 函数类型 + 组合 |

### 累计 TypeScript 训练
- 4/28 首次实现 (泛型/条件类型/映射类型 18 个挑战) = 基础体系 ✅
