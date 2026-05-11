# TypeScript 类型体操专项训练 — 2026-04-29

## 今日主题：高级类型（泛型 / 条件类型 / 映射类型）

---

## Challenge 1: `MyPick<T, K>` — 手动实现 Pick

**难度:** ⭐⭐

实现一个 `MyPick<T, K>` 类型，从类型 `T` 中选取键 `K` 对应的属性，构造新类型。

```ts
interface Todo {
  title: string;
  description: string;
  completed: boolean;
}

type MyPick<T, K extends keyof T> = /* 你的实现 */;

type TodoPreview = MyPick<Todo, 'title' | 'completed'>;
// 期望: { title: string; completed: boolean }
```

<details>
<summary>答案</summary>

```ts
type MyPick<T, K extends keyof T> = {
  [P in K]: T[P];
};
```
</details>

---

## Challenge 2: `MyReadonly<T>` — 手动实现 Readonly

**难度:** ⭐⭐

实现 `MyReadonly<T>`，将 `T` 的所有属性变为只读。

```ts
type MyReadonly<T> = /* 你的实现 */;

type TodoReadonly = MyReadonly<Todo>;
// 期望: { readonly title: string; readonly description: string; readonly completed: boolean }
```

<details>
<summary>答案</summary>

```ts
type MyReadonly<T> = {
  readonly [P in keyof T]: T[P];
};
```
</details>

---

## Challenge 3: `TupleToUnion<T>` — 元组转联合

**难度:** ⭐⭐⭐

给定一个元组类型，返回其所有元素类型的联合类型。

```ts
type TupleToUnion<T extends readonly any[]> = /* 你的实现 */;

type Result = TupleToUnion<[string, number, boolean]>;
// 期望: string | number | boolean
```

<details>
<summary>答案</summary>

```ts
type TupleToUnion<T extends readonly any[]> = T[number];
```
</details>

---

## Challenge 4: `MyExclude<T, U>` — 手动实现 Exclude

**难度:** ⭐⭐⭐

从联合类型 `T` 中排除属于 `U` 的类型。

```ts
type MyExclude<T, U> = /* 你的实现 */;

type Result = MyExclude<'a' | 'b' | 'c', 'a' | 'b'>;
// 期望: 'c'
```

<details>
<summary>答案</summary>

```ts
type MyExclude<T, U> = T extends U ? never : T;
```
</details>

---

## Challenge 5: `First<T>` — 获取元组第一个元素类型

**难度:** ⭐⭐⭐

```ts
type First<T extends readonly any[]> = /* 你的实现 */;

type A = First<[3, 2, 1]>;       // 期望: 3
type B = First<[]>;              // 期望: never (或报错)
```

<details>
<summary>答案</summary>

```ts
type First<T extends readonly any[]> = T extends [infer F, ...any[]] ? F : never;
```
</details>

---

## Challenge 6: `DeepReadonly<T>` — 深度只读

**难度:** ⭐⭐⭐⭐

递归地将对象的所有嵌套属性变为只读。

```ts
type DeepReadonly<T> = /* 你的实现 */;

type X = {
  a: {
    b: {
      c: string;
    };
  };
  d: number;
};

type Y = DeepReadonly<X>;
// Y.a.b.c 应该是只读的
```

<details>
<summary>答案</summary>

```ts
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};
```
</details>

---

## Challenge 7: `TupleToNestedObject<Keys, Value>` — 元组嵌套对象

**难度:** ⭐⭐⭐⭐

给定一个键元组和一个值类型，构造嵌套对象类型。

```ts
type TupleToNestedObject<Keys extends readonly string[], Value> = /* 你的实现 */;

type Result = TupleToNestedObject<['a', 'b', 'c'], number>;
// 期望: { a: { b: { c: number } } }
```

<details>
<summary>答案</summary>

```ts
type TupleToNestedObject<Keys extends readonly string[], Value> =
  Keys extends [infer First extends string, ...infer Rest extends string[]]
    ? { [K in First]: TupleToNestedObject<Rest, Value> }
    : Value;
```
</details>

---

## Challenge 8: `MyParameters<T>` — 手动实现 Parameters

**难度:** ⭐⭐⭐

提取函数类型的参数列表为元组。

```ts
type MyParameters<T extends (...args: any) => any> = /* 你的实现 */;

type Fn = (a: string, b: number) => void;
type Params = MyParameters<Fn>;
// 期望: [string, number]
```

<details>
<summary>答案</summary>

```ts
type MyParameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never;
```
</details>

---

## Challenge 9: `MyReturnType<T>` — 手动实现 ReturnType

**难度:** ⭐⭐⭐

提取函数类型的返回值。

```ts
type MyReturnType<T extends (...args: any) => any> = /* 你的实现 */;

type Fn = () => { a: string; b: number };
type Result = MyReturnType<Fn>;
// 期望: { a: string; b: number }
```

<details>
<summary>答案</summary>

```ts
type MyReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : never;
```
</details>

---

## Challenge 10: `AppendArgument<Fn, A>` — 追加参数

**难度:** ⭐⭐⭐⭐

给定一个函数类型和一个参数类型，返回一个新函数类型，在末尾追加该参数。

```ts
type AppendArgument<Fn extends (...args: any) => any, A> = /* 你的实现 */;

type Fn = (a: number) => string;
type NewFn = AppendArgument<Fn, boolean>;
// 期望: (a: number, arg: boolean) => string
```

<details>
<summary>答案</summary>

```ts
type AppendArgument<Fn extends (...args: any) => any, A> =
  Fn extends (...args: infer P) => infer R
    ? (...args: [...P, A]) => R
    : never;
```
</details>

---

## Challenge 11: `DeepPartial<T>` — 深度可选

**难度:** ⭐⭐⭐⭐

递归地将所有属性变为可选。

```ts
type DeepPartial<T> = /* 你的实现 */;

type User = {
  id: number;
  profile: {
    name: string;
    settings: {
      theme: string;
    };
  };
};

type PartialUser = DeepPartial<User>;
// 所有层级都可选
```

<details>
<summary>答案</summary>

```ts
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};
```
</details>

---

## Challenge 12: `Merge<A, B>` — 合并两个对象类型

**难度:** ⭐⭐⭐⭐

合并两个对象类型，`B` 的属性覆盖 `A` 的同名属性。

```ts
type Merge<A, B> = /* 你的实现 */;

type Foo = { a: number; b: string };
type Bar = { b: number; c: boolean };
type Result = Merge<Foo, Bar>;
// 期望: { a: number; b: number; c: boolean }
```

<details>
<summary>答案</summary>

```ts
type Merge<A, B> = {
  [K in keyof A | keyof B]: K extends keyof B
    ? B[K]
    : K extends keyof A
      ? A[K]
      : never;
};
```
</details>

---

## Challenge 13: `Filter<T, U>` — 过滤联合类型

**难度:** ⭐⭐⭐⭐

保留联合类型 `T` 中属于 `U` 的部分（与 Exclude 相反）。

```ts
type Filter<T, U> = /* 你的实现 */;

type Result = Filter<string | number | (() => void), Function>;
// 期望: () => void
```

<details>
<summary>答案</summary>

```ts
type Filter<T, U> = T extends U ? T : never;
```
</details>

---

## Challenge 14: `StringToUnion<S>` — 字符串转联合

**难度:** ⭐⭐⭐⭐⭐

将字符串字面量类型的每个字符转为联合类型。

```ts
type StringToUnion<S extends string> = /* 你的实现 */;

type Result = StringToUnion<'hello'>;
// 期望: 'h' | 'e' | 'l' | 'l' | 'o'
```

<details>
<summary>答案</summary>

```ts
type StringToUnion<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? First | StringToUnion<Rest>
    : never;
```
</details>

---

## Challenge 15: `Chainable<O>` — 链式调用类型

**难度:** ⭐⭐⭐⭐⭐

实现一个链式调用的配置器类型。

```ts
type Chainable<O = {}> = {
  option<K extends string, V>(key: K, value: V): /* 你的实现 */;
  get(): /* 你的实现 */;
};

declare function config(): Chainable;

const result = config()
  .option('name', 'ts')
  .option('version', '1.0')
  .option('author', 'me')
  .get();

// 期望: { name: 'ts'; version: '1.0'; author: 'me' }
```

<details>
<summary>答案</summary>

```ts
type Chainable<O = {}> = {
  option<K extends string, V>(
    key: K,
    value: V
  ): Chainable<O & Record<K, V>>;
  get(): O;
};
```
</details>

---

## Challenge 16: `RemoveIndexSignature<T>` — 移除索引签名

**难度:** ⭐⭐⭐⭐⭐

从对象类型中移除索引签名（`[key: string]: ...`），只保留明确定义的属性。

```ts
type RemoveIndexSignature<T> = /* 你的实现 */;

type Foo = {
  [key: string]: unknown;
  name: string;
  age: number;
};

type Result = RemoveIndexSignature<Foo>;
// 期望: { name: string; age: number }
```

<details>
<summary>答案</summary>

```ts
type RemoveIndexSignature<T> = {
  [K in keyof T as string extends K
    ? never
    : number extends K
      ? never
      : symbol extends K
        ? never
        : K]: T[K];
};
```
</details>

---

## Challenge 17: `Truncate<S, Length>` — 截断字符串

**难度:** ⭐⭐⭐⭐

截断字符串字面量类型到指定长度。

```ts
type Truncate<S extends string, Length extends number> = /* 你的实现 */;

type Result1 = Truncate<'hello world', 5>;  // 期望: 'hello'
type Result2 = Truncate<'hi', 5>;           // 期望: 'hi'
```

<details>
<summary>答案</summary>

```ts
type Truncate<S extends string, Length extends number> =
  _TruncateHelper<S, Length, []>;

type _TruncateHelper<
  S extends string,
  Length extends number,
  Counter extends any[]
> = Counter['length'] extends Length
  ? ''
  : S extends `${infer First}${infer Rest}`
    ? `${First}${_TruncateHelper<Rest, Length, [...Counter, any]>}`
    : S;
```
</details>

---

## Challenge 18: `ObjectFromEntries<E>` — 从键值对元组构造对象

**难度:** ⭐⭐⭐⭐⭐

给定一个 `[key, value]` 元组数组，构造对应的对象类型。

```ts
type ObjectFromEntries<E extends [string, any][]> = /* 你的实现 */;

type Result = ObjectFromEntries<[
  ['name', 'ts'],
  ['age', 1],
]>;
// 期望: { name: 'ts'; age: 1 }
```

<details>
<summary>答案</summary>

```ts
type ObjectFromEntries<E extends [string, any][]> =
  E extends [infer First extends [string, any], ...infer Rest extends [string, any][]]
    ? { [K in First[0]]: First[1] } & ObjectFromEntries<Rest>
    : {};
```
</details>

---

## Challenge 19: `IsUnion<T>` — 判断是否为联合类型

**难度:** ⭐⭐⭐⭐⭐

判断一个类型是否为联合类型。

```ts
type IsUnion<T> = /* 你的实现 */;

type A = IsUnion<string | number>;  // 期望: true
type B = IsUnion<string>;           // 期望: false
type C = IsUnion<string | never>;   // 期望: false
```

<details>
<summary>答案</summary>

```ts
type IsUnion<T> = [T] extends [UnionToIntersection<T>]
  ? false
  : true;

type UnionToIntersection<U> =
  (U extends any ? (x: U) => any : never) extends (x: infer I) => any
    ? I
    : never;
```
</details>

---

## Challenge 20: `Diff<A, B>` — 对象属性差异

**难度:** ⭐⭐⭐⭐⭐

返回两个对象类型之间不同的属性（对称差集）。

```ts
type Diff<A, B> = /* 你的实现 */;

type Foo = { a: number; b: string };
type Bar = { b: number; c: boolean };
type Result = Diff<Foo, Bar>;
// 期望: { a: number; c: boolean }
```

<details>
<summary>答案</summary>

```ts
type Diff<A, B> = Omit<A & B, keyof A & keyof B>;
```
</details>

---

## 📊 训练总结

| # | 挑战 | 涉及核心概念 | 难度 |
|---|------|-------------|------|
| 1 | MyPick | 映射类型 | ⭐⭐ |
| 2 | MyReadonly | 映射类型 + readonly | ⭐⭐ |
| 3 | TupleToUnion | 索引访问 | ⭐⭐⭐ |
| 4 | MyExclude | 条件类型 + 分布式 | ⭐⭐⭐ |
| 5 | First | infer + 模式匹配 | ⭐⭐⭐ |
| 6 | DeepReadonly | 递归条件类型 | ⭐⭐⭐⭐ |
| 7 | TupleToNestedObject | 递归 + 映射 | ⭐⭐⭐⭐ |
| 8 | MyParameters | infer 函数参数 | ⭐⭐⭐ |
| 9 | MyReturnType | infer 函数返回 | ⭐⭐⭐ |
| 10 | AppendArgument | 元组展开 + infer | ⭐⭐⭐⭐ |
| 11 | DeepPartial | 递归映射类型 | ⭐⭐⭐⭐ |
| 12 | Merge | 条件类型 + 联合键 | ⭐⭐⭐⭐ |
| 13 | Filter | 条件类型（分布式） | ⭐⭐⭐⭐ |
| 14 | StringToUnion | 模板字面量 + 递归 | ⭐⭐⭐⭐⭐ |
| 15 | Chainable | 泛型累加 | ⭐⭐⭐⭐⭐ |
| 16 | RemoveIndexSignature | 映射类型过滤 (as) | ⭐⭐⭐⭐⭐ |
| 17 | Truncate | 模板字面量 + 计数器 | ⭐⭐⭐⭐ |
| 18 | ObjectFromEntries | 递归 + 交叉类型 | ⭐⭐⭐⭐⭐ |
| 19 | IsUnion | UnionToIntersection 技巧 | ⭐⭐⭐⭐⭐ |
| 20 | Diff | Omit + 交叉 + 联合 | ⭐⭐⭐⭐⭐ |

**核心知识点覆盖：**
- ✅ 映射类型（Mapped Types）：`[K in keyof T]`
- ✅ 条件类型（Conditional Types）：`T extends U ? X : Y`
- ✅ 分布式条件类型
- ✅ `infer` 关键字（参数/返回值推断）
- ✅ 模板字面量类型（Template Literal Types）
- ✅ 映射类型过滤（`as` 子句）
- ✅ 递归类型
- ✅ 泛型累加模式
- ✅ UnionToIntersection 经典技巧
- ✅ 元组操作（展开/模式匹配）
