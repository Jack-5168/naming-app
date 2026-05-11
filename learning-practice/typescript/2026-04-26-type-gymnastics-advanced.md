# TypeScript 类型体操专项训练 (2026-04-26) — 进阶篇

> 主题：高级类型 — 泛型 / 条件类型 / 映射类型（Round 2 · 进阶实战）
> 挑战数：12 题（比 Round 1 更深一层，聚焦真实场景）
> 前置：已完成 2026-04-25 类型体操 Round 1（20 题）

---

## Challenge 1: DeepRequired<T>

**递归地将对象所有层级变为必需（包括嵌套对象和可选属性）**

```typescript
type DeepRequired<T> = T extends Primitive
  ? T
  : T extends (...args: any[]) => any
    ? T
    : T extends object
      ? { [P in keyof T]-?: DeepRequired<T[P]> }
      : T;

type Primitive = string | number | boolean | bigint | symbol | undefined | null | void | Date | Error;

// 测试
interface User {
  id?: number;
  profile?: {
    name?: string;
    settings?: {
      theme?: 'light' | 'dark';
    };
  };
}

type RequiredUser = DeepRequired<User>;
// id: number (必需)
// profile: { name: string; settings: { theme: 'light' | 'dark' } } (全部必需)
```

**核心知识点**：递归映射类型 + `-?` 移除可选修饰符 + 函数/原始类型守卫

---

## Challenge 2: UnionToIntersection<U>

**将联合类型转换为交叉类型**

```typescript
type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
  x: infer I,
) => void
  ? I
  : never;

// 测试
type Result1 = UnionToIntersection<{ a: number } | { b: string }>;
// { a: number } & { b: string }

type Result2 = UnionToIntersection<(() => void) | ((x: number) => void)>;
// (() => void) & ((x: number) => void)
```

**核心知识点**：
- **逆变位置的分发**：`(x: U) => void` 中 `U` 在参数位置（逆变），分发后产生 `(x: A) => void | (x: B) => void`
- 这个联合函数类型再被 `(x: infer I) => void` 匹配时，`infer` 在逆变位置会取**交集**
- 这是类型体操中最经典的"黑魔法"之一

---

## Challenge 3: TupleToNestedObject<K extends string | number | symbol, V>

**将键元组转换为嵌套对象类型**

```typescript
type TupleToNestedObject<K extends readonly (string | number | symbol)[], V> =
  K extends readonly [infer First, ...infer Rest]
    ? First extends string | number | symbol
      ? { [P in First]: Rest extends readonly any[] ? TupleToNestedObject<Rest, V> : V }
      : {}
    : V;

// 测试
type Result1 = TupleToNestedObject<['a', 'b', 'c'], number>;
// { a: { b: { c: number } } }

type Result2 = TupleToNestedObject<['x'], string>;
// { x: string }
```

**核心知识点**：递归元组 + 键约束 + 嵌套映射

---

## Challenge 4: Currying<Fn>

**推导函数柯里化后的类型（支持已知参数数量）**

```typescript
// 获取函数第一个参数
type FirstArg<Fn extends (...args: any[]) => any> = Fn extends (
  arg: infer A,
  ...rest: any[]
) => any
  ? A
  : never;

// 获取函数除第一个参数外的剩余参数
type RestArgs<Fn extends (...args: any[]) => any> = Fn extends (
  arg: any,
  ...rest: infer R
) => any
  ? R
  : [];

// 柯里化类型推导
type Curried<Fn extends (...args: any[]) => any> = RestArgs<Fn> extends []
  ? () => ReturnType<Fn>
  : (arg: FirstArg<Fn>) => Curried<(...args: RestArgs<Fn>) => ReturnType<Fn>>;

// 测试
declare function add(a: number, b: number, c: number): number;
type CurriedAdd = Curried<typeof add>;
// (a: number) => (b: number) => (c: number) => number
```

**核心知识点**：递归函数类型 + 元组头部/尾部操作 + 返回值推断

---

## Challenge 5: Chainable<Options>

**实现链式调用的类型推导（类似 jQuery/fluent API）**

```typescript
type Chainable<Options = {}> = {
  option<K extends string, V>(
    key: K,
    value: V,
  ): Chainable<Options & Record<K, V>>;
  get(): Options;
};

// 测试
declare function getOptions(): Chainable;

const result = getOptions()
  .option('name', 'TypeScript')
  .option('version', '5.0')
  .option('author', { name: 'Anders' })
  .get();

// result 类型: { name: 'TypeScript'; version: '5.0'; author: { name: 'Anders' } }
```

**核心知识点**：
- 泛型默认参数 + 递归泛型
- `Record<K, V>` 动态构建对象类型
- 链式调用时类型逐步累积

---

## Challenge 6: Trim<S extends string>

**类型级别去除字符串首尾空白（包括空格、制表符、换行）**

```typescript
type Whitespace = ' ' | '\t' | '\n' | '\r' | '\f';

type TrimLeft<S extends string> = S extends `${Whitespace}${infer Rest}`
  ? TrimLeft<Rest>
  : S;

type TrimRight<S extends string> = S extends `${infer Rest}${Whitespace}`
  ? TrimRight<Rest>
  : S;

type Trim<S extends string> = TrimLeft<TrimRight<S>>;

// 测试
type T1 = Trim<'  hello  '>; // 'hello'
type T2 = Trim<'  \t\n hello \n\r  '>; // 'hello'
type T3 = Trim<'hello'>; // 'hello'
type T4 = Trim<'   '>; // ''
```

**核心知识点**：模板字符串类型 + 递归 + 模板字符类

---

## Challenge 7: CapitalizeKeys<T>

**将对象所有键名首字母大写**

```typescript
type CapitalizeKeys<T extends Record<string, any>> = {
  [K in keyof T as K extends string ? `${Capitalize<K>}${string}` ? Capitalize<K> : K : K]: T[K];
};

// 更简洁的实现
type CapitalizeKeys2<T extends Record<string, any>> = {
  [K in keyof T as K extends string ? Capitalize<K> : K]: T[K];
};

// 测试
interface User {
  name: string;
  age: number;
  email: string;
}

type CapitalizedUser = CapitalizeKeys2<User>;
// { Name: string; Age: number; Email: string }
```

**核心知识点**：键重映射 `as` + `Capitalize` 内置工具类型

---

## Challenge 8: GetReturnType<AsyncFn>

**从 Promise 返回值中自动解包（AsyncReturnType 的手写版）**

```typescript
// 方案 1: 简单版
type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;

type GetReturnType<Fn extends (...args: any) => any> = Awaited<ReturnType<Fn>>;

// 方案 2: 一步到位
type UnwrapPromise<Fn extends (...args: any) => any> = ReturnType<Fn> extends Promise<
  infer U
>
  ? U
  : ReturnType<Fn>;

// 测试
declare async function fetchUser(): Promise<{ id: number; name: string }>;
type User = GetReturnType<typeof fetchUser>;
// { id: number; name: string } (不是 Promise<{...}>)
```

**核心知识点**：
- `Awaited` 是 TS 4.5 内置类型，递归解包 Promise
- 递归条件类型处理嵌套 Promise（`Promise<Promise<T>>`）

---

## Challenge 9: DeepFlat<T extends readonly any[]>

**深度扁平化（支持任意嵌套深度）**

```typescript
type DeepFlat<T extends readonly any[]> = T extends readonly [infer First, ...infer Rest]
  ? First extends readonly any[]
    ? [...DeepFlat<First>, ...DeepFlat<Rest>]
    : [First, ...DeepFlat<Rest>]
  : [];

// 测试
type Result1 = DeepFlat<[1, [2, [3, [4, [5]]]]]>; // [1, 2, 3, 4, 5]
type Result2 = DeepFlat<[[[[1]]]]>; // [1]
type Result3 = DeepFlat<[1, 2, 3]>; // [1, 2, 3]
```

**核心知识点**：递归元组解构 + 条件类型 + 元组展开拼接

---

## Challenge 10: StringToUnion<S extends string>

**将字符串拆分为字符联合类型**

```typescript
type StringToUnion<S extends string> = S extends `${infer First}${infer Rest}`
  ? First | StringToUnion<Rest>
  : never;

// 测试
type Result1 = StringToUnion<'abc'>; // 'a' | 'b' | 'c'
type Result2 = StringToUnion<'hello'>; // 'h' | 'e' | 'l' | 'o'
type Result3 = StringToUnion<''>; // never
```

**核心知识点**：模板字符串 `infer` 拆分 + 递归 + 联合类型构建

---

## Challenge 11: Replace<S extends string, From extends string, To extends string>

**类型级别字符串替换（只替换第一个匹配项）**

```typescript
type Replace<
  S extends string,
  From extends string,
  To extends string,
> = From extends ''
  ? S
  : S extends `${infer Before}${From}${infer After}`
    ? `${Before}${To}${After}`
    : S;

// 测试
type R1 = Replace<'hello world', 'world', 'TypeScript'>; // 'hello TypeScript'
type R2 = Replace<'hello world', 'o', '0'>; // 'hell0 world' (只替换第一个)
type R3 = Replace<'hello', 'x', 'y'>; // 'hello' (无匹配)
```

**核心知识点**：模板字符串三段匹配 + 边界处理（空字符串）

---

## Challenge 12: BuildTuple<Length, Element>

**构建指定长度的元组类型（类型级别的 "new Array(n)"）**

```typescript
type BuildTuple<Length extends number, Element = unknown, Acc extends unknown[] = []> =
  Acc['length'] extends Length ? Acc : BuildTuple<Length, Element, [...Acc, Element]>;

// 测试
type T1 = BuildTuple<3>; // [unknown, unknown, unknown]
type T2 = BuildTuple<5, string>; // [string, string, string, string, string]
type T3 = BuildTuple<0>; // []
```

**核心知识点**：
- **尾递归累加器模式**（Accumulator pattern）
- `Acc['length']` 作为递归终止条件
- 这是类型级别实现"计数"的标准模式

---

## 附加挑战（选做）

### Challenge A: ReadonlyKeys<T>

**提取对象中所有只读属性的键**

```typescript
type ReadonlyKeys<T> = {
  [P in keyof T]-?: Readonly<Pick<T, P>> extends Pick<T, P> ? P : never;
}[keyof T];

// 测试
interface Example {
  readonly id: number;
  name: string;
  readonly email: string;
}

type RO = ReadonlyKeys<Example>; // 'id' | 'email'
```

### Challenge B: Mutable<T>

**移除对象所有属性的 readonly 修饰符**

```typescript
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

// 测试
interface RO {
  readonly a: string;
  readonly b: number;
}

type M = Mutable<RO>; // { a: string; b: number }
```

### Challenge C: DropFirst<T extends readonly any[]>

**移除元组第一个元素**

```typescript
type DropFirst<T extends readonly any[]> = T extends readonly [any, ...infer Rest]
  ? Rest
  : [];

// 测试
type D1 = DropFirst<[1, 2, 3]>; // [2, 3]
type D2 = DropFirst<[string]>; // []
type D3 = DropFirst<[]>; // []
```

---

## 知识点进阶总结

### 1. 逆变位置的分发（UnionToIntersection 核心）

```typescript
// 协变位置（返回值）: 联合 → 联合
type CoVar<T> = T extends any ? () => T : never;
// CoVar<A | B> → (() => A) | (() => B)

// 逆变位置（参数）: 联合 → 交叉
type ContraVar<T> = T extends any ? (x: T) => void : never;
// ContraVar<A | B> → ((x: A) => void) | ((x: B) => void)
// 当这个联合函数被 infer 匹配时，取交集
```

### 2. 尾递归累加器模式

```typescript
// 通用模板
type TailRec<Param, Acc, Condition, Step> =
  Condition<Acc> extends true
    ? Acc
    : TailRec<Param, Step<Acc>, Condition, Step>;

// 实例: BuildTuple, Repeat, Range
```

### 3. 模板字符串类型的 3 种匹配模式

```typescript
// 1. 前缀匹配
type StartsWithA<S> = S extends `a${string}` ? true : false;

// 2. 三段匹配（替换的核心）
type Replace<S, From, To> = S extends `${infer B}${From}${infer A}` ? `${B}${To}${A}` : S;

// 3. 逐字符拆分
type Split<S> = S extends `${infer F}${infer R}` ? [F, ...Split<R>] : [];
```

### 4. 键重映射的高级用法

```typescript
// 过滤键
type FilterKeys<T, U> = {
  [K in keyof T as K extends U ? K : never]: T[K];
};

// 转换键
type PrefixKeys<T, P extends string> = {
  [K in keyof T as `${P & string}_${K & string}`]: T[K];
};

// 组合键操作
type RenameAndFilter<T> = {
  [K in keyof T as K extends `_${string}` ? never : `get_${Capitalize<K & string>}`]: () => T[K];
};
```

### 5. 递归类型的 3 种模式

```typescript
// 模式 1: 深度遍历（DeepReadonly, DeepPartial, DeepRequired）
type Deep<T> = T extends Primitive ? T : { [P in keyof T]: Deep<T[P]> };

// 模式 2: 元组递归（Flatten, BuildTuple, Curried）
type TupleRec<T> = T extends [infer F, ...infer R] ? [Process<F>, ...TupleRec<R>] : [];

// 模式 3: 字符串递归（Trim, Replace, CamelToKebab）
type StringRec<S> = S extends `${infer F}${infer R}` ? Process<F> + StringRec<R> : '';
```

---

## 难度梯度

| 题号 | 难度 | 核心考点 | 实战价值 |
|------|------|----------|----------|
| 1 | ⭐⭐⭐ | 递归映射 + -? | 高（API 响应类型） |
| 2 | ⭐⭐⭐⭐⭐ | 逆变分发 | 极高（类型系统黑魔法） |
| 3 | ⭐⭐⭐⭐ | 递归元组 → 嵌套对象 | 中（配置路径） |
| 4 | ⭐⭐⭐⭐⭐ | 递归函数类型 | 高（函数式编程） |
| 5 | ⭐⭐⭐⭐ | 链式调用泛型累积 | 极高（fluent API） |
| 6 | ⭐⭐⭐ | 模板字符串递归 | 高（字符串处理） |
| 7 | ⭐⭐ | 键重映射 + Capitalize | 中（API 转换） |
| 8 | ⭐⭐⭐ | Awaited 递归解包 | 极高（异步开发） |
| 9 | ⭐⭐⭐⭐ | 深度元组扁平化 | 中（数据处理） |
| 10 | ⭐⭐⭐ | 字符串 → 字符联合 | 中（类型安全路由） |
| 11 | ⭐⭐⭐ | 模板字符串三段匹配 | 高（字符串操作） |
| 12 | ⭐⭐⭐⭐ | 尾递归累加器 | 极高（类型级计数） |

---

## Round 1 vs Round 2 对比

| 维度 | Round 1 (4/25) | Round 2 (4/26) |
|------|----------------|----------------|
| 题数 | 20 题 | 12 题 + 3 附加 |
| 侧重 | 基础模式 + 内置类型手写 | 进阶模式 + 真实场景 |
| 难点 | infer/映射/条件 | 逆变分发/尾递归/链式泛型 |
| 实战性 | 中等（偏教学） | 高（fluent API/柯里化/异步解包） |
| 新增模式 | — | UnionToIntersection、尾递归累加器、链式泛型累积 |

---

## 学习建议

1. **Challenge 2 (UnionToIntersection)** 是类型系统的"分水岭"——理解它意味着你真正掌握了 TS 类型系统的逆变/协变
2. **Challenge 5 (Chainable)** 是实际开发中最常用的模式之一（QueryBuilder、Express middleware 等）
3. **Challenge 12 (BuildTuple)** 的尾递归累加器是类型级编程的通用模式，值得反复练习
4. 建议用 VS Code 逐个验证，hover 看推导结果比 tsc 编译更高效

> 💡 Round 1 打基础 → Round 2 攻进阶 → 下一步：用这些类型能力重构实际项目中的类型定义
