# TypeScript 类型体操专项训练 — 高级类型系统

**时间:** 2026-05-03 09:00  
**主题:** 泛型 / 条件类型 / 映射类型 / 模板字面量类型 / 递归类型  
**目标:** 10+ 类型挑战，覆盖 TypeScript 类型系统核心能力

---

## 一、泛型进阶 (Generics)

### 1.1 泛型约束与推断

```typescript
// 基础泛型约束
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Alice", age: 30 };
getProperty(user, "name"); // string ✅
getProperty(user, "invalid"); // Error ✅

// 泛型参数默认值
interface ApiResponse<T = unknown, E = string> {
  data: T;
  error?: E;
  status: number;
}

// 泛型条件推断
type UnwrapArray<T> = T extends (infer U)[] ? U : T;
type A = UnwrapArray<string[]>; // string
type B = UnwrapArray<number>;   // number
```

### 1.2 泛型工厂模式

```typescript
// 类型安全的工厂函数
class Builder<T extends object> {
  private partial: Partial<T> = {};

  set<K extends keyof T>(key: K, value: T[K]): this {
    this.partial[key] = value;
    return this;
  }

  build(): T {
    return this.partial as T;
  }
}

// 使用
interface User { name: string; age: number; email: string; }
const user = new Builder<User>()
  .set("name", "Alice")
  .set("age", 30)
  .set("email", "alice@example.com")
  .build();
```

### 1.3 泛型协变与逆变

```typescript
// 协变 (Covariant) — 返回值位置
type Producer<T> = () => T;
declare let animalProducer: Producer<Animal>;
declare let dogProducer: Producer<Dog>;
animalProducer = dogProducer; // ✅ Dog extends Animal

// 逆变 (Contravariant) — 参数位置
type Consumer<T> = (value: T) => void;
declare let animalConsumer: Consumer<Animal>;
declare let dogConsumer: Consumer<Dog>;
dogConsumer = animalConsumer; // ✅ Animal 可以消费 Dog

// 双向变 (Bivariant) — 函数参数在 strictFunctionTypes 关闭时
// TypeScript 默认开启 strictFunctionTypes，所以是逆变的
```

---

## 二、条件类型 (Conditional Types)

### 2.1 基础条件类型

```typescript
type IsString<T> = T extends string ? true : false;
type A = IsString<"hello">; // true
type B = IsString<42>;      // false

// 分布式条件类型 (Distributive Conditional Types)
type ToArray<T> = T extends any ? T[] : never;
type Arr = ToArray<string | number>; // string[] | number[]

// 用 [] 阻止分布式
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;
type Arr2 = ToArrayNonDist<string | number>; // (string | number)[]
```

### 2.2 类型推断 (infer)

```typescript
// 提取函数返回值
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any;
type R = ReturnType<() => string>; // string

// 提取函数参数
type Parameters<T> = T extends (...args: infer P) => any ? P : never;
type P = Parameters<(a: string, b: number) => void>; // [string, number]

// 提取 Promise 内部类型
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type U = UnwrapPromise<Promise<number>>; // number

// 提取首/尾元素
type Head<T extends any[]> = T extends [infer First, ...any[]] ? First : never;
type Tail<T extends any[]> = T extends [any, ...infer Rest] ? Rest : never;

type H = Head<[1, 2, 3]>; // 1
type T = Tail<[1, 2, 3]>; // [2, 3]
```

---

## 三、映射类型 (Mapped Types)

### 3.1 基础映射

```typescript
// Partial 实现
type MyPartial<T> = {
  [K in keyof T]?: T[K];
};

// Required 实现
type MyRequired<T> = {
  [K in keyof T]-?: T[K];
};

// Readonly 实现
type MyReadonly<T> = {
  readonly [K in keyof T]: T[K];
};

// Pick 实现
type MyPick<T, K extends keyof T> = {
  [P in K]: T[P];
};

// Record 实现
type MyRecord<K extends keyof any, T> = {
  [P in K]: T;
};
```

### 3.2 映射类型过滤

```typescript
// 只保留函数属性
type FunctionProperties<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? K : never]: T[K];
};

interface Service {
  name: string;
  start(): void;
  stop(): void;
  version: number;
}

type ServiceMethods = FunctionProperties<Service>;
// { start(): void; stop(): void; }

// 只保留字符串属性
type StringProperties<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};

// Key 重映射 (Key Remapping)
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type UserGetters = Getters<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number; }
```

---

## 四、模板字面量类型 (Template Literal Types)

```typescript
// 字符串联合类型
type Event = `on${Capitalize<"click" | "hover" | "focus">}`;
// "onClick" | "onHover" | "onFocus"

// 类型提取
type ExtractRoute<T extends string> = T extends `/${infer _}/${infer Route}` ? Route : never;
type R = ExtractRoute<"/api/users">; // "users"

// 字符串拼接
type Concat<S1 extends string, S2 extends string> = `${S1}${S2}`;
type Hello = Concat<"Hello", "World">; // "HelloWorld"

// 递归字符串处理
type ReverseString<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? `${ReverseString<Rest>}${First}`
    : "";

type Rev = ReverseString<"abc">; // "cba"
```

---

## 五、递归类型 (Recursive Types)

```typescript
// 深度 Partial
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

// 深度 Readonly
type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

// 深度只读数组
type DeepArrayReadonly<T> = T extends (infer U)[]
  ? readonly DeepArrayReadonly<U>[]
  : T;

// 计算元组长度
type Length<T extends any[]> = T["length"];

// 元组拼接
type Concat<T1 extends any[], T2 extends any[]> = [...T1, ...T2];

// 元组反转
type Reverse<T extends any[], Acc extends any[] = []> =
  T extends [infer First, ...infer Rest]
    ? Reverse<Rest, [First, ...Acc]>
    : Acc;

type RevTuple = Reverse<[1, 2, 3]>; // [3, 2, 1]
```

---

## 六、类型挑战 (12 题)

### Challenge 1: TupleToUnion — 元组转联合类型

```typescript
type TupleToUnion<T extends any[]> = T[number];

// 测试
type A = TupleToUnion<[1, 2, 3]>;       // 1 | 2 | 3
type B = TupleToUnion<["a", "b"]>;      // "a" | "b"
type C = TupleToUnion<[]>;              // never
```

### Challenge 2: Chainable — 链式调用类型

```typescript
type Chainable<R = {}> = {
  option<K extends string, V>(
    key: K,
    value: V
  ): Chainable<R & Record<K, V>>;
  get(): R;
};

// 测试
declare const config: Chainable;
const result = config
  .option("name", "Alice")
  .option("age", 30)
  .get();
// result 类型: { name: string; age: number }
```

### Challenge 3: DeepReadonly — 深度只读

```typescript
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? T[K] extends Function
      ? T[K]
      : DeepReadonly<T[K]>
    : T[K];
};

// 测试
type User = {
  name: string;
  address: {
    city: string;
    zip: string;
  };
  getInfo: () => string;
};

type ReadonlyUser = DeepReadonly<User>;
// 所有嵌套属性都变为 readonly
```

### Challenge 4: TupleNestingToObj — 元组嵌套转对象

```typescript
type TupleToObj<T extends (string | number | symbol)[]> = {
  [K in T[number]]: K;
};

// 测试
type A = TupleToObj<["a", "b", "c"]>; // { a: "a"; b: "b"; c: "c" }
```

### Challenge 5: DeepFlat — 深度扁平化元组

```typescript
type DeepFlat<T extends any[]> = T extends [infer First, ...infer Rest]
  ? First extends any[]
    ? [...DeepFlat<First>, ...DeepFlat<Rest>]
    : [First, ...DeepFlat<Rest>]
  : [];

// 测试
type A = DeepFlat<[1, [2, 3], [4, [5, 6]]]>; // [1, 2, 3, 4, 5, 6]
type B = DeepFlat<[[[[1]]]]>;                  // [1]
```

### Challenge 6: Permutation — 全排列

```typescript
type Permutation<T, K = T> =
  [T] extends [never]
    ? []
    : K extends T
      ? [K, ...Permutation<Exclude<T, K>>]
      : [];

// 测试
type A = Permutation<"A" | "B" | "C">;
// ["A", "B", "C"] | ["A", "C", "B"] | ["B", "A", "C"] | ...
```

### Challenge 7: AppendArgument — 追加参数类型

```typescript
type AppendArgument<Fn extends (...args: any[]) => any, A> =
  Fn extends (...args: infer Args) => infer Ret
    ? (...args: [...Args, A]) => Ret
    : never;

// 测试
type Fn = (a: string) => number;
type NewFn = AppendArgument<Fn, boolean>;
// (a: string, arg: boolean) => number
```

### Challenge 8: Trim — 去除首尾空格

```typescript
type Space = " " | "\t" | "\n" | "\r";

type TrimLeft<S extends string> = S extends `${Space}${infer Rest}` ? TrimLeft<Rest> : S;
type TrimRight<S extends string> = S extends `${infer Rest}${Space}` ? TrimRight<Rest> : S;
type Trim<S extends string> = TrimLeft<TrimRight<S>>;

// 测试
type A = Trim<"  hello  ">;  // "hello"
type B = Trim<"\thello\n">;  // "hello"
```

### Challenge 9: Capitalize — 首字母大写

```typescript
type MyCapitalize<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? `${Uppercase<First>}${Rest}`
    : S;

// 测试
type A = MyCapitalize<"hello">; // "Hello"
type B = MyCapitalize<"world">; // "World"
```

### Challenge 10: Currying — 柯里化类型

```typescript
type Curried<
  Fn extends (...args: any[]) => any,
  Args extends any[] = []
> = Fn extends (...args: [...Args, ...infer Rest]) => infer Ret
  ? Rest extends []
    ? Ret
    : <T>(arg: Rest[0]) => Curried<Fn, [...Args, T]>
  : never;

// 简化版
type SimpleCurry<Fn extends (...args: any[]) => any> =
  Fn extends (a: infer A, ...rest: infer Rest) => infer Ret
    ? Rest extends []
      ? (a: A) => Ret
      : (a: A) => SimpleCurry<(...args: Rest) => Ret>
    : Fn;

// 测试
type Add = (a: number, b: number, c: number) => number;
type CurriedAdd = SimpleCurry<Add>;
// (a: number) => (b: number) => (c: number) => number
```

### Challenge 11: PromiseAll — Promise.all 类型

```typescript
declare function promiseAll<T extends readonly unknown[]>(
  values: readonly [...{ [K in keyof T]: Promise<T[K]> | T[K] }]
): Promise<{ [K in keyof T]: Awaited<T[K]> }>;

// 测试
const result = promiseAll([
  Promise.resolve(1),
  "hello",
  Promise.resolve(true),
]);
// result: Promise<[number, string, boolean]>
```

### Challenge 12: DeepOmit — 深度删除属性

```typescript
type DeepOmit<T, K extends string> = {
  [P in keyof T as P extends K ? never : P]: T[P] extends object
    ? DeepOmit<T[P], K>
    : T[P];
};

// 测试
type User = {
  id: number;
  name: string;
  password: string;
  profile: {
    email: string;
    password: string;
    avatar: string;
  };
};

type SafeUser = DeepOmit<User, "password">;
// { id: number; name: string; profile: { email: string; avatar: string; } }
```

---

## 七、综合实战 — 类型安全的 RPC 客户端

```typescript
// 1. 定义 API 路由
interface APIRoutes {
  "/api/users/get": { input: { id: number }; output: { name: string; email: string } };
  "/api/users/list": { input: { page: number }; output: { name: string; email: string }[] };
  "/api/posts/create": { input: { title: string; content: string }; output: { id: number } };
}

// 2. 提取所有路由
type Route = keyof APIRoutes;

// 3. 输入/输出类型提取
type RouteInput<R extends Route> = APIRoutes[R]["input"];
type RouteOutput<R extends Route> = APIRoutes[R]["output"];

// 4. 类型安全的 fetch 函数
async function apiCall<R extends Route>(
  route: R,
  input: RouteInput<R>
): Promise<RouteOutput<R>> {
  const res = await fetch(route, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.json();
}

// 5. 使用 — 完全类型安全
async function test() {
  // ✅ 类型正确
  const user = await apiCall("/api/users/get", { id: 1 });
  user.name;    // string
  user.email;   // string

  // ❌ 编译错误 — 缺少 input
  // await apiCall("/api/users/get", {});

  // ❌ 编译错误 — 错误的 route
  // await apiCall("/api/invalid", {});

  // ✅ 返回类型推断正确
  const posts = await apiCall("/api/users/list", { page: 1 });
  posts[0].name; // string
}
```

---

## 八、TypeScript 内置高级类型实现

```typescript
// Exclude — 从联合类型中排除
type MyExclude<T, U> = T extends U ? never : T;

// Extract — 从联合类型中提取
type MyExtract<T, U> = T extends U ? T : never;

// NonNullable — 排除 null 和 undefined
type MyNonNullable<T> = T extends null | undefined ? never : T;

// ThisParameterType — 提取 this 参数类型
type MyThisParameterType<T> = T extends (this: infer U, ...args: any[]) => any ? U : unknown;

// OmitThisParameter — 移除 this 参数
type MyOmitThisParameter<T> = unknown extends ThisParameterType<T>
  ? T
  : T extends (...args: infer A) => infer R
    ? (...args: A) => R
    : T;

// Required — 全部变为必填
type MyRequired<T> = {
  [K in keyof T]-?: T[K];
};

// Mutable — 全部变为可变
type MyMutable<T> = {
  -readonly [K in keyof T]: T[K];
};

// Record — 键值对映射
type MyRecord<K extends keyof any, T> = {
  [P in K]: T;
};

// Partial — 全部变为可选
type MyPartial<T> = {
  [K in keyof T]?: T[K];
};
```

---

## 九、类型体操技巧总结

### 核心模式

| 模式 | 语法 | 用途 |
|------|------|------|
| 条件类型 | `T extends U ? A : B` | 类型分支 |
| 分布式条件 | `T extends U ? A : B` (T 是联合) | 自动遍历联合 |
| infer | `T extends (infer U)[] ? U : T` | 类型推断提取 |
| 映射类型 | `{ [K in keyof T]: V }` | 类型转换 |
| Key 过滤 | `{ [K in keyof T as P]: V }` | 条件过滤属性 |
| Key 重映射 | `{ [K in keyof T as NewK]: V }` | 属性名转换 |
| 模板字面量 | `` `${A}${B}` `` | 字符串类型操作 |
| 递归类型 | `type F<T> = ... F<Inner<T>> ...` | 嵌套类型处理 |
| 元组展开 | `[...T1, ...T2]` | 元组拼接 |

### 常见陷阱

1. **分布式条件类型** — `T extends U ? A : B` 当 T 是联合类型时会自动分发
   - 用 `[T] extends [U]` 阻止分发
2. **never 是空联合** — 条件类型过滤所有分支后返回 never
3. **递归深度限制** — TypeScript 默认递归深度约 20-50 层
4. **infer 只能用在条件类型的 extends 右侧**
5. **映射类型的 keyof T 包含 symbol 键** — 需要 `keyof T & string` 过滤

---

## 十、面试自测题

1. **Q:** `type A = string extends string | number ? true : false` 的结果是什么？为什么？
   **A:** `true`。string 可以赋值给 string | number。

2. **Q:** 分布式条件类型和非分布式有什么区别？如何阻止分发？
   **A:** 分布式：`T extends U ? A : B` 当 T 是联合类型时，会对每个成员分别计算。非分布式：`[T] extends [U] ? A : B` 将整个联合类型作为一个整体处理。

3. **Q:** `infer` 可以在哪些位置使用？
   **A:** 只能在条件类型的 `extends` 子句中使用，用于从复杂类型中提取子类型。

4. **Q:** 如何用映射类型实现 `Partial<T>`？
   **A:** `type MyPartial<T> = { [K in keyof T]?: T[K] }`，`?` 修饰符使所有属性变为可选。

5. **Q:** `keyof T` 和 `keyof T & string` 有什么区别？
   **A:** `keyof T` 包含所有键（string | number | symbol），`keyof T & string` 只包含字符串键。

6. **Q:** 如何实现一个深度递归的 `DeepPartial<T>`？
   **A:** 
   ```typescript
   type DeepPartial<T> = T extends object
     ? { [K in keyof T]?: DeepPartial<T[K]> }
     : T;
   ```

7. **Q:** 模板字面量类型能做哪些字符串操作？
   **A:** 拼接、提取子串、大小写转换（Uppercase/Lowercase/Capitalize/Uncapitalize）、反转等。

8. **Q:** 映射类型中的 `as` 子句有什么用？
   **A:** 用于过滤和重映射键。`[K in keyof T as Filter]` 可以过滤掉不需要的键，或用 `Capitalize` 等转换键名。

---

## 完成情况

- ✅ 泛型进阶: 约束/推断/协变逆变/工厂模式
- ✅ 条件类型: 基础/分布式/infer 提取
- ✅ 映射类型: 基础/过滤/重映射
- ✅ 模板字面量类型: 字符串操作
- ✅ 递归类型: 深度处理/元组操作
- ✅ 12 个类型挑战全部完成
- ✅ 综合实战: 类型安全 RPC 客户端
- ✅ 内置高级类型实现
- ✅ 技巧总结 + 常见陷阱
- ✅ 面试自测题 8 题

**文档路径:** `training/typescript-type-gymnastics-0900-0503.md`
