# TypeScript 类型体操专项训练 v3

> 日期: 2026-05-01 09:00 | 主题: 高级类型 — 泛型 / 条件类型 / 映射类型 (第三轮)
> 挑战数: 14 题 | 难度梯度: ⭐⭐ → ⭐⭐⭐⭐⭐

---

## 前两轮回顾

| 轮次 | 日期 | 已覆盖 |
|------|------|--------|
| v1 | 4/28 | DeepReadonly/DeepPartial/DeepRequired/PickByType/OmitByType/TupleToUnion/UnionToIntersection/Curried |
| v2 | 4/29 | MyPick/MyReadonly/TupleToUnion/MyExclude/First/DeepReadonly/TupleToNestedObject/MyParameters/MyReturnType/AppendArgument/Flatten/Chainable/Trim/Replace |

---

## 核心概念速查 (第三轮进阶)

```typescript
// === 模板字面量类型 ===
type Join<S extends string, D extends string> = /* ... */;
type ParseRoute<T extends `/${string}`> = /* ... */;

// === 递归条件类型 (深度嵌套) ===
type DeepFilter<T, U> = /* ... */;
type Path<T> = /* ... */;

// === 映射类型 + as 键重映射 ===
type RenameKeys<T, R extends Record<string, string>> = /* ... */;

// === 分布式条件类型的高级用法 ===
type Distribute<T> = /* ... */;

// === 类型级编程 (Church 编码 / 元组算术) ===
type Add<A extends number, B extends number> = /* ... */;
```

---

## Challenge 1: `StringToArray` — 字符串拆字符元组

**难度:** ⭐⭐⭐
**知识点:** 模板字面量类型 + infer + 递归

```typescript
// 将字符串拆为字符元组
type StringToArray<S extends string> = /* 你的实现 */;

// 测试
type A = StringToArray<"hello">;
// 期望: ["h", "e", "l", "l", "o"]

type B = StringToArray<"">;
// 期望: []
```

<details>
<summary>答案</summary>

```typescript
type StringToArray<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? [First, ...StringToArray<Rest>]
    : [];
```
</details>

---

## Challenge 2: `Merge<L, R>` — 合并两个对象类型

**难度:** ⭐⭐⭐
**知识点:** 映射类型 + keyof + 条件类型

```typescript
// 合并两个对象类型，同名键以 R 的类型为准
type Merge<L extends object, R extends object> = /* 你的实现 */;

// 测试
type A = { a: number; b: string };
type B = { b: boolean; c: string };

type Result = Merge<A, B>;
// 期望: { a: number; b: boolean; c: string }
```

<details>
<summary>答案</summary>

```typescript
type Merge<L extends object, R extends object> = {
  [K in keyof L | keyof R]: K extends keyof R
    ? R[K]
    : K extends keyof L
      ? L[K]
      : never;
};
```
</details>

---

## Challenge 3: `KebabToCamel` — 连字符转驼峰

**难度:** ⭐⭐⭐
**知识点:** 模板字面量 + 递归 + Capitalize

```typescript
// 将连字符命名转为驼峰命名
type KebabToCamel<S extends string> = /* 你的实现 */;

// 测试
type A = KebabToCamel<"hello-world">;
// 期望: "helloWorld"

type B = KebabToCamel<"foo-bar-baz">;
// 期望: "fooBarBaz"

type C = KebabToCamel<"already-camel-case">;
// 期望: "alreadyCamelCase"

type D = KebabToCamel<"single">;
// 期望: "single"
```

<details>
<summary>答案</summary>

```typescript
type KebabToCamel<S extends string> =
  S extends `${infer First}-${infer Char}${infer Rest}`
    ? `${First}${Uppercase<Char>}${KebabToCamel<Rest>}`
    : S;
```
</details>

---

## Challenge 4: `ObjectKeyPaths<T>` — 对象所有路径

**难度:** ⭐⭐⭐⭐
**知识点:** 递归条件类型 + 模板字面量 + 映射类型

```typescript
// 获取对象的所有键路径（点分隔）
type ObjectKeyPaths<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? K | `${K}.${ObjectKeyPaths<T[K]>}`
        : K;
    }[keyof T & string]
  : never;

// 测试
interface Config {
  server: {
    host: string;
    port: number;
    ssl: {
      cert: string;
    };
  };
  debug: boolean;
}

type Paths = ObjectKeyPaths<Config>;
// 期望: "server" | "server.host" | "server.port" | "server.ssl" | "server.ssl.cert" | "debug"
```

<details>
<summary>答案</summary>

```typescript
type ObjectKeyPaths<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? K | `${K}.${ObjectKeyPaths<T[K]>}`
        : K;
    }[keyof T & string]
  : never;
```
</details>

---

## Challenge 5: `GetByPath<T, Path>` — 按路径取值类型

**难度:** ⭐⭐⭐⭐
**知识点:** 模板字面量 + infer + 递归 + 索引访问

```typescript
// 根据点分隔路径获取嵌套类型
type GetByPath<T, Path extends string> = /* 你的实现 */;

// 测试
interface User {
  profile: {
    address: {
      city: string;
      zip: number;
    };
  };
  name: string;
}

type City = GetByPath<User, "profile.address.city">;
// 期望: string

type Name = GetByPath<User, "name">;
// 期望: string

type Whole = GetByPath<User, "profile">;
// 期望: { address: { city: string; zip: number } }
```

<details>
<summary>答案</summary>

```typescript
type GetByPath<T, Path extends string> =
  Path extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
      ? GetByPath<T[Key], Rest>
      : never
    : Path extends keyof T
      ? T[Path]
      : never;
```
</details>

---

## Challenge 6: `FilterNever<T>` — 过滤 never 值

**难度:** ⭐⭐⭐
**知识点:** 映射类型 + as 键重映射 + 条件类型

```typescript
// 移除对象中值为 never 的键
type FilterNever<T extends object> = /* 你的实现 */;

// 测试
interface Mixed {
  a: string;
  b: never;
  c: number;
  d: never;
  e: boolean;
}

type Result = FilterNever<Mixed>;
// 期望: { a: string; c: number; e: boolean }
```

<details>
<summary>答案</summary>

```typescript
type FilterNever<T extends object> = {
  [K in keyof T as [T[K]] extends [never] ? never : K]: T[K];
};
```
</details>

---

## Challenge 7: `Mutable<T>` — 移除 readonly 和可选

**难度:** ⭐⭐⭐
**知识点:** 映射类型修饰符 (`-readonly`, `-?`)

```typescript
// 将 T 的所有属性变为必填且可变
type Mutable<T> = /* 你的实现 */;

// 测试
interface ReadonlyConfig {
  readonly name: string;
  readonly version?: number;
  readonly settings?: {
    readonly debug: boolean;
  };
}

type Result = Mutable<ReadonlyConfig>;
// 期望: { name: string; version: number; settings: { debug: boolean } }
```

<details>
<summary>答案</summary>

```typescript
type Mutable<T> = {
  -readonly [K in keyof T]-?: T[K];
};
```
</details>

---

## Challenge 8: `PartialByKeys<T, K>` — 部分键设为可选

**难度:** ⭐⭐⭐⭐
**知识点:** 映射类型 + Pick/Omit 组合 + 键分割

```typescript
// 将 T 中指定的键 K 设为可选，其余保持不变
type PartialByKeys<T, K extends keyof T> = /* 你的实现 */;

// 测试
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

type Result = PartialByKeys<User, "name" | "email">;
// 期望: { id: number; name?: string; email?: string; age: number }
```

<details>
<summary>答案</summary>

```typescript
type PartialByKeys<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

// 注意：这会产生交叉类型。如果要保持单一对象类型：
type PartialByKeysFlat<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]: T[P];
} & {
  [P in keyof T as P extends K ? P : never]?: T[P];
};
```
</details>

---

## Challenge 9: `RequiredByKeys<T, K>` — 部分键设为必填

**难度:** ⭐⭐⭐⭐
**知识点:** 映射类型 + `-?` 修饰符 + Pick/Omit 组合

```typescript
// 将 T 中指定的键 K 设为必填，其余保持不变
type RequiredByKeys<T, K extends keyof T> = /* 你的实现 */;

// 测试
interface Config {
  name: string;
  host?: string;
  port?: number;
  debug?: boolean;
}

type Result = RequiredByKeys<Config, "host" | "port">;
// 期望: { name: string; host: string; port: number; debug?: boolean }
```

<details>
<summary>答案</summary>

```typescript
type RequiredByKeys<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;

// 扁平版：
type RequiredByKeysFlat<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]?: T[P];
} & {
  [P in keyof T as P extends K ? P : never]-?: T[P];
};
```
</details>

---

## Challenge 10: `TupleToEnumObject<T>` — 元组转枚举对象类型

**难度:** ⭐⭐⭐⭐
**知识点:** 模板字面量 + 映射类型 + 键重映射

```typescript
// 给定字符串元组，生成每个键映射到自身字符串字面量的对象类型
type TupleToEnumObject<T extends readonly string[]> = /* 你的实现 */;

// 测试
type Result = TupleToEnumObject<["ADD", "DELETE", "UPDATE"]>;
// 期望: { ADD: "ADD"; DELETE: "DELETE"; UPDATE: "UPDATE" }

// 实际用途：模拟 TypeScript const enum 行为
const ACTIONS = {
  ADD: "ADD" as const,
  DELETE: "DELETE" as const,
  UPDATE: "UPDATE" as const,
} satisfies TupleToEnumObject<["ADD", "DELETE", "UPDATE"]>;
```

<details>
<summary>答案</summary>

```typescript
type TupleToEnumObject<T extends readonly string[]> = {
  [K in T[number]]: K;
};
```
</details>

---

## Challenge 11: `IsTuple<T>` — 判断是否为元组类型

**难度:** ⭐⭐⭐⭐
**知识点:** 条件类型 + 数组 vs 元组区分 + readonly

```typescript
// 判断 T 是否为元组类型（非普通数组）
type IsTuple<T> = /* 你的实现 */;

// 测试
type A = IsTuple<[string, number]>;
// 期望: true

type B = IsTuple<string[]>;
// 期望: false

type C = IsTuple<readonly [string]>;
// 期望: true

type D = IsTuple<number[]>;
// 期望: false

type E = IsTuple<[]>;
// 期望: true
```

<details>
<summary>答案</summary>

```typescript
type IsTuple<T> =
  T extends readonly any[]
    ? number extends T["length"]
      ? false
      : true
    : false;

// 原理: 普通数组的 length 是 number 类型，元组的 length 是字面量数字
// number extends T["length"]: 如果 T 是 string[]，T["length"] = number，条件成立 → false
// 如果 T 是 [string, number]，T["length"] = 2，number extends 2 不成立 → true
```
</details>

---

## Challenge 12: `AppendToProperty<T, K, V>` — 给对象每个属性的值追加字段

**难度:** ⭐⭐⭐⭐
**知识点:** 映射类型 + 嵌套映射 + 索引访问

```typescript
// 将对象 T 中每个属性的值类型追加一个属性 K: V
type AppendToProperty<T extends Record<string, object>, K extends string, V> =
  /* 你的实现 */;

// 测试
type Users = {
  alice: { age: number };
  bob: { age: number };
};

type Result = AppendToProperty<Users, "role", "admin" | "user">;
// 期望: {
//   alice: { age: number; role: "admin" | "user" };
//   bob: { age: number; role: "admin" | "user" };
// }
```

<details>
<summary>答案</summary>

```typescript
type AppendToProperty<T extends Record<string, object>, K extends string, V> = {
  [P in keyof T]: T[P] & { [Q in K]: V };
};
```
</details>

---

## Challenge 13: `DeepFlat<T>` — 深度展平嵌套对象

**难度:** ⭐⭐⭐⭐⭐
**知识点:** 递归条件类型 + 模板字面量 + 映射类型

```typescript
// 将嵌套对象展平为一层，键用点分隔
type DeepFlat<T, Prefix extends string = ""> = /* 你的实现 */;

// 测试
type Nested = {
  a: {
    b: {
      c: string;
    };
    d: number;
  };
  e: boolean;
};

type Result = DeepFlat<Nested>;
// 期望: { "a.b.c": string; "a.d": number; "e": boolean }
```

<details>
<summary>答案</summary>

```typescript
type DeepFlat<
  T extends object,
  Prefix extends string = ""
> = {
  [K in keyof T & string]: T[K] extends object
    ? DeepFlatValue<T[K], Prefix extends "" ? K : `${Prefix}.${K}`>
    : Prefix extends ""
      ? { [P in K]: T[K] }
      : { [P in `${Prefix}.${K}`]: T[K] };
}[keyof T & string];

// 更简洁的写法：
type DeepFlatV2<T extends object, Prefix extends string = ""> = UnionToIntersection<
  {
    [K in keyof T & string]: T[K] extends object
      ? DeepFlatV2<T[K], Prefix extends "" ? K : `${Prefix}.${K}`>
      : { [P in Prefix extends "" ? K : `${Prefix}.${K}`]: T[K] };
  }[keyof T & string]
>;

type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void
    ? I
    : never;
```
</details>

---

## Challenge 14: `EventEmitter<T>` — 类型安全的 EventEmitter

**难度:** ⭐⭐⭐⭐⭐
**知识点:** 泛型约束 + 映射类型 + 联合类型 + 实际工程模式

```typescript
// 构建类型安全的 EventEmitter，事件名和回调参数完全类型安全
type EventEmitter<Events extends Record<string, any>> = {
  on: /* 你的实现 */;
  off: /* 你的实现 */;
  emit: /* 你的实现 */;
};

// 测试
interface MyEvents {
  click: { x: number; y: number };
  keydown: { key: string; ctrl: boolean };
  close: void;
}

declare const emitter: EventEmitter<MyEvents>;

// ✅ 正确用法
emitter.on("click", (data) => {
  // data 应该是 { x: number; y: number }
  console.log(data.x, data.y);
});

emitter.emit("keydown", { key: "Enter", ctrl: true });

emitter.emit("close"); // void 事件不需要参数

// @ts-expect-error — 事件名不存在
emitter.on("nonexistent", () => {});

// @ts-expect-error — click 事件参数类型错误
emitter.emit("click", { x: "not a number", y: 1 });

// @ts-expect-error — close 事件不需要参数
emitter.emit("close", { extra: true });
```

<details>
<summary>答案</summary>

```typescript
type EventEmitter<Events extends Record<string, any>> = {
  on<K extends keyof Events>(
    event: K,
    callback: (data: Events[K]) => void
  ): void;
  off<K extends keyof Events>(
    event: K,
    callback: (data: Events[K]) => void
  ): void;
  emit<K extends keyof Events>(
    event: K,
    ...args: Events[K] extends void ? [] : [data: Events[K]]
  ): void;
};
```
</details>

---

## 综合实战：类型级 HTTP 路由系统

**难度:** ⭐⭐⭐⭐⭐
**知识点:** 全部综合应用

```typescript
// === 1. 定义路由配置 ===
type RouteConfig = {
  "/api/users": {
    GET: { response: { id: number; name: string }[] };
    POST: { body: { name: string; email: string }; response: { id: number } };
  };
  "/api/users/:id": {
    GET: { params: { id: string }; response: { id: number; name: string } };
    DELETE: { params: { id: string }; response: { success: boolean } };
  };
};

// === 2. 提取路径参数 ===
type PathParams<Path extends string> =
  Path extends `${infer _Prefix}:${infer Param}/${infer Rest}`
    ? Param extends `${infer ParamName}?`
      ? { [K in ParamName]?: string } & PathParams<`/${Rest}`>
      : { [K in Param]: string } & PathParams<`/${Rest}`>
    : Path extends `${infer _Prefix}:${infer Param}`
      ? { [K in Param]: string }
      : {};

// 测试
type Params1 = PathParams<"/api/users/:id">;
// 期望: { id: string }

type Params2 = PathParams<"/api/posts/:postId/comments/:commentId">;
// 期望: { postId: string; commentId: string }

// === 3. 构建类型安全的 fetch 函数 ===
type ApiRequest<Path extends keyof RouteConfig, Method extends keyof RouteConfig[Path]> =
  RouteConfig[Path][Method] extends { body: infer B }
    ? { method: Method & string; body: B }
    : { method: Method & string };

type ApiResponse<Path extends keyof RouteConfig, Method extends keyof RouteConfig[Path]> =
  RouteConfig[Path][Method] extends { response: infer R } ? R : never;

// === 4. 类型安全的 HTTP 客户端 ===
declare function apiFetch<
  Path extends keyof RouteConfig,
  Method extends keyof RouteConfig[Path]
>(
  path: Path,
  config: ApiRequest<Path, Method>
): Promise<ApiResponse<Path, Method>>;

// 测试: 完全类型安全
async function test() {
  // ✅ GET /api/users
  const users = await apiFetch("/api/users", { method: "GET" });
  // users 类型: { id: number; name: string }[]

  // ✅ POST /api/users
  const newUser = await apiFetch("/api/users", {
    method: "POST",
    body: { name: "Alice", email: "alice@example.com" },
  });
  // newUser 类型: { id: number }

  // @ts-expect-error — 缺少 body
  await apiFetch("/api/users", { method: "POST" });

  // @ts-expect-error — 不存在的路由
  await apiFetch("/api/invalid", { method: "GET" });

  // @ts-expect-error — 不存在的方法
  await apiFetch("/api/users", { method: "PATCH" });
}
```

---

## 速查表：TypeScript 类型体操工具箱

| 操作 | 语法 | 示例 |
|------|------|------|
| 提取首字符 | `${infer A}${infer Rest}` | `"hello" → A="h", Rest="ello"` |
| 提取元组首元素 | `[infer F, ...infer R]` | `[1,2] → F=1, R=[2]` |
| 提取函数参数 | `(...args: infer P) => infer R` | `(a:number)=>void → P=[number], R=void` |
| 分布式条件 | `T extends U ? X : Y` | `string|number extends string ? → string→X, number→Y` |
| 键重映射 | `as NewKey` | `[K in keyof T as Capitalize<K & string]: T[K]` |
| 移除修饰符 | `-readonly`, `-?` | `{-readonly [K in keyof T]: T[K]}` |
| 添加修饰符 | `readonly`, `?` | `{readonly [K in keyof T]?: T[K]}` |
| 联合转交叉 | 函数参数逆变 | `(U→(x:U)=>void) extends (x:I)=>void ? I : never` |
| 数组 vs 元组 | `number extends T["length"]` | `string[] → true, [string] → false` |
| 递归终止 | 基础类型检查 | `T extends string ? T : T extends object ? ... : T` |

---

## 常见陷阱

1. **分布式条件类型不期望的分发**: 用 `[T] extends [U]` 包裹避免分发
2. **映射类型丢失索引签名**: 用 `keyof T & string` 代替 `keyof T` 过滤 symbol/number 键
3. **递归类型无限循环**: 确保有基础情况（base case）终止递归
4. **infer 在错误位置**: infer 只能在条件类型的 extends 右侧使用
5. **never 的传播**: never 在联合类型中会被丢弃，在交叉类型中会让整体变 never

---

*第三轮专项训练完成。前两轮已覆盖: Pick/Readonly/Exclude/Parameters/ReturnType/DeepReadonly/DeepPartial/DeepRequired/PickByType/OmitByType/UnionToIntersection/Curried/Flatten/Chainable/Trim/Replace/First/TupleToUnion/TupleToNestedObject/AppendArgument*

*第三轮新增: StringToArray/Merge/KebabToCamel/ObjectKeyPaths/GetByPath/FilterNever/Mutable/PartialByKeys/RequiredByKeys/TupleToEnumObject/IsTuple/AppendToProperty/DeepFlat/EventEmitter/HTTP 路由系统*
