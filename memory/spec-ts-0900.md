# TypeScript 类型体操 — 高级类型挑战

> 专项训练 09:00 | 主题：泛型 / 条件类型 / 映射类型 | 15 道挑战
> 2026-05-07

---

## 挑战 1：DeepReadonly（深只读）

将嵌套对象的所有属性变为只读。

```ts
type DeepReadonly<T> = T extends
  | string
  | number
  | boolean
  | symbol
  | null
  | undefined
  | Function
  ? T
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };

// 测试
interface User {
  name: string;
  address: {
    city: string;
    geo: { lat: number; lng: number };
  };
}
type RU = DeepReadonly<User>;
// RU["address"]["geo"]["lat"] 应为 readonly number

declare const ru: RU;
// @ts-expect-error — 只读属性不可赋值
ru.name = "x";
// @ts-expect-error — 深层只读
ru.address.city = "x";
// @ts-expect-error — 深层只读
ru.address.geo.lat = 0;
```

## 挑战 2：DeepPartial（深可选）

将嵌套对象的所有属性变为可选。

```ts
type DeepPartial<T> = T extends
  | string
  | number
  | boolean
  | symbol
  | null
  | undefined
  | Function
  ? T
  : { [K in keyof T]?: DeepPartial<T[K]> };

// 测试
interface Config {
  server: {
    host: string;
    port: number;
  };
  debug: boolean;
}
type PC = DeepPartial<Config>;
declare const pc: PC;
const c1: PC = {}; // ✅ 全部可选
const c2: PC = { server: { host: "localhost" } }; // ✅ 部分嵌套
const c3: PC = { server: { host: "localhost", port: 3000 } }; // ✅ 完整
```

## 挑战 3：TupleToUnion（元组转联合）

将元组类型转换为联合类型。

```ts
type TupleToUnion<T extends readonly unknown[]> = T[number];

// 测试
type R1 = TupleToUnion<["a", "b", "c"]>; // "a" | "b" | "c"
type R2 = TupleToUnion<[1, 2, 3]>; // 1 | 2 | 3
type R3 = TupleToUnion<[]>; // never

// 验证
const _r1: R1 = "b";
const _r2: R2 = 2;
```

## 挑战 4：TupleToObject（元组转对象）

将元组转换为以元素为键的对象类型。

```ts
type TupleToObject<T extends readonly PropertyKey[]> = {
  [K in T[number]]: K;
};

// 测试
type R1 = TupleToObject<["a", "b"]>; // { a: "a"; b: "b" }
type R2 = TupleToObject<[1, 2]>; // { 1: 1; 2: 2 }

declare const r1: R1;
const _a: "a" = r1.a;
const _b: "b" = r1.b;
```

## 挑战 5：MyPick（实现 Pick）

手动实现 Pick 工具类型。

```ts
type MyPick<T, K extends keyof T> = {
  [P in K]: T[P];
};

// 测试
interface Todo {
  title: string;
  description: string;
  completed: boolean;
}
type R1 = MyPick<Todo, "title" | "completed">;
// { title: string; completed: boolean }

declare const r1: R1;
const t: string = r1.title;
const c: boolean = r1.completed;
```

## 挑战 6：MyOmit（实现 Omit）

手动实现 Omit 工具类型（用 Exclude）。

```ts
type MyOmit<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]: T[P];
};

// 测试
type R1 = MyOmit<Todo, "description">;
// { title: string; completed: boolean }

declare const r1: R1;
const t: string = r1.title;
// @ts-expect-error — description 已被省略
r1.description;
```

## 挑战 7：First（元组首元素）

获取元组的第一个元素类型。

```ts
type First<T extends readonly unknown[]> = T extends readonly [
  infer F,
  ...unknown[],
]
  ? F
  : never;

// 测试
type R1 = First<[1, 2, 3]>; // 1
type R2 = First<["a", "b"]>; // "a"
type R3 = First<[]>; // never
type R4 = First<[only: string]>; // string

const _r1: R1 = 1;
const _r2: R2 = "a";
```

## 挑战 8：Last（元组尾元素）

获取元组的最后一个元素类型。

```ts
type Last<T extends readonly unknown[]> = T extends readonly [
  ...unknown[],
  infer L,
]
  ? L
  : never;

// 测试
type R1 = Last<[1, 2, 3]>; // 3
type R2 = Last<["a", "b", "c"]>; // "c"
type R3 = Last<[42]>; // 42

const _r1: R1 = 3;
const _r2: R2 = "c";
```

## 挑战 9：Flatten（扁平化元组）

递归扁平化嵌套元组。

```ts
type Flatten<T extends readonly unknown[]> = T extends readonly []
  ? []
  : T extends readonly [infer F, ...infer Rest]
    ? F extends readonly unknown[]
      ? [...Flatten<F>, ...Flatten<Rest>]
      : [F, ...Flatten<Rest>]
    : [];

// 测试
type R1 = Flatten<[[1], [2, 3]]>; // [1, 2, 3]
type R2 = Flatten<[[1, [2, 3]], [4]]>; // [1, 2, 3, 4]
type R3 = Flatten<[[]]>; // []
type R4 = Flatten<[[1], [2], [3], [[4, [5]]]]>; // [1, 2, 3, 4, 5]

declare const _r1: R1;
declare const _r2: R2;
declare const _r4: R4;
```

## 挑战 10：MyExclude（实现 Exclude）

手动实现 Exclude 工具类型。

```ts
type MyExclude<T, U> = T extends U ? never : T;

// 测试
type R1 = MyExclude<"a" | "b" | "c", "a">; // "b" | "c"
type R2 = MyExclude<1 | 2 | 3, 1 | 2>; // 3

const _r1: R1 = "b";
const _r2: R2 = 3;
```

## 挑战 11：Awaited（解包 Promise）

递归解包 Promise 类型。

```ts
type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;

// 测试
type R1 = Awaited<Promise<string>>; // string
type R2 = Awaited<Promise<Promise<number>>>; // number
type R3 = Awaited<Promise<Promise<Promise<boolean>>>>; // boolean
type R4 = Awaited<string>; // string

const _r1: R1 = "hello";
const _r2: R2 = 42;
const _r3: R3 = true;
const _r4: R4 = "not a promise";
```

## 挑战 12：If（条件类型）

实现 If 条件类型。

```ts
type If<C extends boolean, T, F> = C extends true ? T : F;

// 测试
type R1 = If<true, "a", "b">; // "a"
type R2 = If<false, "a", "b">; // "b"

const _r1: R1 = "a";
const _r2: R2 = "b";
```

## 挑战 13：Concat（元组拼接）

拼接两个元组。

```ts
type Concat<T extends readonly unknown[], U extends readonly unknown[]> = [
  ...T,
  ...U,
];

// 测试
type R1 = Concat<[1, 2], [3, 4]>; // [1, 2, 3, 4]
type R2 = Concat<[], [1]>; // [1]
type R3 = Concat<["a"], ["b", "c"]>; // ["a", "b", "c"]

declare const _r1: R1;
declare const _r2: R2;
declare const _r3: R3;
```

## 挑战 14：Push（元组追加）

向元组追加一个元素。

```ts
type Push<T extends readonly unknown[], E> = [...T, E];

// 测试
type R1 = Push<[1, 2], 3>; // [1, 2, 3]
type R2 = Push<[], "x">; // ["x"]

declare const _r1: R1;
declare const _r2: R2;
```

## 挑战 15：Includes（元组包含检查）

检查元组是否包含某个元素。

```ts
type Includes<T extends readonly unknown[], E> = T extends readonly [
  infer F,
  ...infer Rest,
]
  ? [F] extends [E]
    ? [E] extends [F]
      ? true
      : Includes<Rest, E>
    : Includes<Rest, E>
  : false;

// 测试
type R1 = Includes<[1, 2, 3], 2>; // true
type R2 = Includes<[1, 2, 3], 4>; // false
type R3 = Includes<[1, 2, "3"], "3">; // true
type R4 = Includes<[], 1>; // false
// 注意：类型精确匹配，1 !== true
type R5 = Includes<[1, 2], true>; // false

const _r1: R1 = true;
const _r2: R2 = false;
const _r3: R3 = true;
const _r4: R4 = false;
const _r5: R5 = false;
```

---

## 附加挑战：类型工具组合

### 挑战 16：RequiredKeys + OptionalKeys（提取必需/可选键）

```ts
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

// 测试
interface Foo {
  a: string;
  b?: number;
  c: boolean;
  d?: string;
}
type RK = RequiredKeys<Foo>; // "a" | "c"
type OK = OptionalKeys<Foo>; // "b" | "d"

const _rk: RK = "a";
const _ok: OK = "b";
```

### 挑战 17：Merge（对象合并）

将两个对象类型合并，后者覆盖前者同名字段。

```ts
type Merge<T, U> = {
  [K in keyof T | keyof U]: K extends keyof U
    ? U[K]
    : K extends keyof T
      ? T[K]
      : never;
};

// 测试
type A = { a: number; b: string };
type B = { b: boolean; c: string };
type M = Merge<A, B>;
// { a: number; b: boolean; c: string }

declare const m: M;
const _a: number = m.a;
const _b: boolean = m.b;
const _c: string = m.c;
```

### 挑战 18：TupleFilter（元组过滤）

过滤元组中指定类型的元素。

```ts
type TupleFilter<T extends readonly unknown[], U> = T extends readonly [
  infer F,
  ...infer Rest,
]
  ? [F] extends [U]
    ? [F, ...TupleFilter<Rest, U>]
    : TupleFilter<Rest, U>
  : [];

// 测试
type R1 = TupleFilter<[1, "a", 2, "b", 3], number>; // [1, 2, 3]
type R2 = TupleFilter<[1, "a", 2, "b", 3], string>; // ["a", "b"]
type R3 = TupleFilter<[], number>; // []

declare const _r1: R1;
declare const _r2: R2;
declare const _r3: R3;
```

### 挑战 19：StringToUnion（字符串转联合）

将字符串字面量拆分为字符联合。

```ts
type StringToUnion<S extends string> = S extends `${infer F}${infer Rest}`
  ? F | StringToUnion<Rest>
  : never;

// 测试
type R1 = StringToUnion<"abc">; // "a" | "b" | "c"
type R2 = StringToUnion<"">; // never
type R3 = StringToUnion<"a">; // "a"

const _r1: R1 = "b";
const _r2: R2 = undefined as never;
```

### 挑战 20：Reverse（元组反转）

反转元组类型。

```ts
type Reverse<
  T extends readonly unknown[],
  Acc extends readonly unknown[] = [],
> = T extends readonly [infer F, ...infer Rest]
  ? Reverse<Rest, [F, ...Acc]>
  : Acc;

// 测试
type R1 = Reverse<[1, 2, 3]>; // [3, 2, 1]
type R2 = Reverse<["a", "b"]>; // ["b", "a"]
type R3 = Reverse<[]>; // []
type R4 = Reverse<[1]>; // [1]

declare const _r1: R1;
declare const _r2: R2;
declare const _r4: R4;
```

---

## 知识总结

### 核心模式

| 模式              | 语法                         | 用途                   |
| ----------------- | ---------------------------- | ---------------------- |
| **条件类型分发**  | `T extends U ? A : B`        | 联合类型自动分发       |
| **infer 提取**    | `T extends Promise<infer U>` | 从复杂类型中提取子类型 |
| **映射类型**      | `[K in keyof T]`             | 遍历对象键生成新类型   |
| **key remapping** | `as P extends Q ? R : S`     | 条件键重映射           |
| **递归类型**      | 类型引用自身                 | 处理嵌套结构           |
| **模板字面量**    | `` `${A}${B}` ``             | 字符串类型操作         |
| **元组展开**      | `[...T, ...U]`               | 元组拼接/操作          |
| **剩余元组**      | `[infer F, ...infer Rest]`   | 元组解构               |

### 类型体操心法

1. **infer 是瑞士军刀** — 几乎所有高级类型都依赖 infer 提取子类型
2. **递归是元组操作的灵魂** — 遍历、反转、扁平化都靠递归 + 展开
3. **条件分发是双刃剑** — `T extends U ? A : B` 对联合类型自动分发，有时需要 `[T] extends [U]` 关闭分发
4. **never 是过滤利器** — 条件类型返回 never 自然实现过滤效果
5. **映射类型 + as 子句** — TypeScript 4.1+ 的 key remapping 让映射类型从"遍历"升级为"转换"
6. **模板字面量类型** — 4.1+ 支持，可做字符串解析、类型拼接、驼峰转换等
7. **`-?` / `+?` 修饰符** — 控制映射类型的可选性，`-` 移除，`+` 添加
8. **`-readonly` / `+readonly`** — 同理控制只读性

### 常见陷阱

- **条件分发**：`string extends string | number` 会分发成两次检查；用 `[T] extends [U]` 避免
- **never 传播**：`never | string` = `string`，`never & string` = `never`
- **递归深度**：TypeScript 递归深度有限（~50层），深层嵌套可能超限
- **模板字面量性能**：复杂模板字面量组合会指数级膨胀类型
- **infer 位置**：infer 只能在 extends 右侧的 pattern 中使用，不能随意放置

---

## 编译验证

```ts
// 以上所有类型定义可通过以下命令验证：
// npx tsc --noEmit --strict spec-ts-0900.md 中的 .ts 代码块
```

实际可运行测试：

```ts
// 类型断言辅助
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

// 验证几个关键类型
type _test1 = Expect<Equal<TupleToUnion<["a", "b", "c"]>, "a" | "b" | "c">>;
type _test2 = Expect<Equal<First<[1, 2, 3]>, 1>>;
type _test3 = Expect<Equal<Last<[1, 2, 3]>, 3>>;
type _test4 = Expect<Equal<Flatten<[[1], [2, 3]]>, [1, 2, 3]>>;
type _test5 = Expect<Equal<Reverse<[1, 2, 3]>, [3, 2, 1]>>;
type _test6 = Expect<Equal<Awaited<Promise<Promise<number>>>, number>>;
type _test7 = Expect<Equal<Includes<[1, 2, 3], 2>, true>>;
type _test8 = Expect<Equal<Includes<[1, 2, 3], 4>, false>>;
type _test9 = Expect<Equal<StringToUnion<"abc">, "a" | "b" | "c">>;
type _test10 = Expect<Equal<Concat<[1, 2], [3, 4]>, [1, 2, 3, 4]>>;
```
