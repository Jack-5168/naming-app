# TypeScript 类型体操专项训练 (2026-04-25)

> 主题：高级类型 — 泛型 / 条件类型 / 映射类型
> 挑战数：12 题（从基础到地狱难度）

---

## Challenge 1: MyPick<T, K extends keyof T>

**实现 TypeScript 内置的 `Pick<T, K>`**

```typescript
type MyPick<T, K extends keyof T> = {
  [P in K]: T[P];
};

// 测试
interface Todo {
  title: string;
  description: string;
  completed: boolean;
}

type TodoPreview = MyPick<Todo, "title" | "description">;
// { title: string; description: string; }

const preview: TodoPreview = { title: "Clean room", description: "Very dirty" };
```

**核心知识点**：映射类型 + `keyof` 操作符 + `extends` 约束

---

## Challenge 2: MyReadonly<T>

**实现 TypeScript 内置的 `Readonly<T>`**

```typescript
type MyReadonly<T> = {
  readonly [P in keyof T]: T[P];
};

// 测试
interface Todo {
  title: string;
  description: string;
}

const todo: MyReadonly<Todo> = {
  title: "Hey",
  description: "foobar",
};

// @ts-expect-error — 不能修改只读属性
todo.title = "Hello"; // Error!
```

**核心知识点**：映射类型 + `readonly` 修饰符

---

## Challenge 3: TupleToUnion<T extends readonly any[]>

**将元组转换为联合类型**

```typescript
type TupleToUnion<T extends readonly any[]> = T[number];

// 测试
type Result = TupleToUnion<["a", "b", "c"]>; // 'a' | 'b' | 'c'
type NumResult = TupleToUnion<[1, 2, 3]>; // 1 | 2 | 3
type MixedResult = TupleToUnion<[string, number, boolean]>; // string | number | boolean
```

**核心知识点**：索引访问类型 `T[number]` 提取元组所有元素类型

---

## Challenge 4: MyExclude<T, U>

**实现 TypeScript 内置的 `Exclude<T, U>` — 从联合类型中排除某些类型**

```typescript
type MyExclude<T, U> = T extends U ? never : T;

// 测试
type Result1 = MyExclude<"a" | "b" | "c", "a">; // 'b' | 'c'
type Result2 = MyExclude<"a" | "b" | "c", "a" | "b">; // 'c'
type Result3 = MyExclude<string | number | (() => void), Function>; // string | number
```

**核心知识点**：条件类型的**分发特性**（Distributive Conditional Types）

- 当 `T` 是联合类型时，`T extends U ? A : B` 会被分发为每个联合成员的独立判断
- `never` 在联合类型中会被自动消除：`'a' | never` → `'a'`

---

## Challenge 5: First<T extends readonly any[]>

**获取元组的第一个元素类型**

```typescript
type First<T extends readonly any[]> = T extends readonly [infer F, ...any[]]
  ? F
  : never;

// 测试
type Result1 = First<[1, 2, 3]>; // 1
type Result2 = First<["a", "b", "c"]>; // 'a'
type Result3 = First<[]>; // never
```

**核心知识点**：`infer` 关键字 + 模式匹配 + 剩余元素 `...any[]`

---

## Challenge 6: DeepReadonly<T>

**递归地将对象所有层级变为只读（嵌套对象也要处理）**

```typescript
type DeepReadonly<T> = T extends Primitive
  ? T
  : T extends (...args: any[]) => any
    ? T
    : { readonly [P in keyof T]: DeepReadonly<T[P]> };

type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | undefined
  | null
  | void
  | Date
  | Error
  | Function;

// 测试
interface nestedObj {
  a: {
    b: {
      c: string;
    };
  };
}

type DeepReadonlyObj = DeepReadonly<nestedObj>;

const obj: DeepReadonlyObj = {
  a: {
    b: {
      c: "hello",
    },
  },
};

// @ts-expect-error
obj.a.b.c = "world"; // Error!
```

**核心知识点**：递归条件类型 + 类型守卫（排除原始类型和函数）

---

## Challenge 7: MyParameters<T extends (...args: any) => any>

**实现 TypeScript 内置的 `Parameters<T>`**

```typescript
type MyParameters<T extends (...args: any) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : never;

// 测试
declare function foo(x: number, y: string): boolean;
type FooParams = MyParameters<typeof foo>; // [number, string]

type EmptyParams = MyParameters<() => void>; // []
```

**核心知识点**：`infer` 在函数参数位置 + 条件类型

---

## Challenge 8: MyReturnType<T extends (...args: any) => any>

**实现 TypeScript 内置的 `ReturnType<T>`**

```typescript
type MyReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => infer R
  ? R
  : never;

// 测试
declare function fn1(): string;
declare function fn2(x: number): boolean;

type R1 = MyReturnType<typeof fn1>; // string
type R2 = MyReturnType<typeof fn2>; // boolean
type R3 = MyReturnType<() => { a: number }>; // { a: number }
```

**核心知识点**：`infer` 在函数返回值位置

---

## Challenge 9: Omit<T, K extends keyof any>

**实现 TypeScript 内置的 `Omit<T, K>` — 排除指定属性**

```typescript
// 方案 1: 基于 Exclude
type Omit1<T, K extends keyof any> = {
  [P in Exclude<keyof T, K>]: T[P];
};

// 方案 2: 基于条件类型分发
type Omit2<T, K extends keyof any> = {
  [P in keyof T as P extends K ? never : P]: T[P];
};

// 测试
interface Todo {
  title: string;
  description: string;
  completed: boolean;
}

type TodoWithoutDescription = Omit1<Todo, "description">;
// { title: string; completed: boolean; }
```

**核心知识点**：

- 方案 1 利用 `Exclude` 先过滤 key，再映射
- 方案 2 利用**键重映射**（Key Remapping）`as` 语法 + `never` 过滤

---

## Challenge 10: Flatten<T extends readonly any[]>

**扁平化嵌套元组类型**

```typescript
type Flatten<T extends readonly any[]> = T extends readonly [
  infer First,
  ...infer Rest,
]
  ? First extends readonly any[]
    ? [...Flatten<First>, ...Flatten<Rest>]
    : [First, ...Flatten<Rest>]
  : [];

// 测试
type Result1 = Flatten<[1, 2, [3, 4]]>; // [1, 2, 3, 4]
type Result2 = Flatten<[1, [2, [3, [4, 5]]], 6]>; // [1, 2, 3, 4, 5, 6]
type Result3 = Flatten<[]>; // []
type Result4 = Flatten<[["a", "b"], ["c", "d"]]>; // ['a', 'b', 'c', 'd']
```

**核心知识点**：递归元组解构 + 条件类型 + 元组拼接

---

## Challenge 11: DeepPartial<T>

**递归地将对象所有层级变为可选（包括嵌套对象）**

```typescript
type DeepPartial<T> = T extends Primitive
  ? T
  : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : { [P in keyof T]?: DeepPartial<T[P]> };

type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | undefined
  | null
  | void
  | Date
  | Error;

// 测试
interface Config {
  server: {
    host: string;
    port: number;
    ssl: {
      enabled: boolean;
      cert: string;
    };
  };
  database: {
    url: string;
    pool: {
      min: number;
      max: number;
    };
  };
}

type PartialConfig = DeepPartial<Config>;

const config: PartialConfig = {
  server: {
    host: "localhost",
    // port 可选
    ssl: {
      // 全部可选
    },
  },
  // database 可选
};
```

**核心知识点**：递归映射类型 + Array 特殊处理

---

## Challenge 12: RequiredKeys<T> & OptionalKeys<T>

**提取对象中必需/可选的键**

```typescript
type RequiredKeys<T> = {
  [P in keyof T]-?: P;
}[keyof T];

type OptionalKeys<T> = {
  [P in keyof T]-?: {} extends Pick<T, P> ? never : P;
}[keyof T];

// 更精确的 OptionalKeys 实现
type OptionalKeysPrecise<T> = {
  [P in keyof T]: {} extends Pick<T, P> ? P : never;
}[keyof T];

// 测试
interface Example {
  required: string;
  optional?: number;
  alsoRequired: boolean;
}

type Req = RequiredKeys<Example>; // 'required' | 'alsoRequired'
type Opt = OptionalKeysPrecise<Example>; // 'optional'
```

**核心知识点**：

- `-?` 移除可选修饰符（make required）
- `{} extends Pick<T, P>` 判断属性是否可选（空对象可以赋值给可选属性）
- 索引访问 `T[keyof T]` 提取所有值组成联合类型

---

## Challenge 13: AppendArgument<Fn, A>

**为函数类型追加一个参数**

```typescript
type AppendArgument<Fn extends (...args: any[]) => any, A> = Fn extends (
  ...args: infer P
) => infer R
  ? (...args: [...P, A]) => R
  : never;

// 测试
declare function multiply(x: number, y: number): number;
type NewFn = AppendArgument<typeof multiply, string>;
// (x: number, y: number, arg: string) => number
```

**核心知识点**：元组展开 + 函数类型推断 + 参数追加

---

## Challenge 14: CamelCaseToKebabCase<S>

**将驼峰命名转换为短横线命名（类型级别字符串操作）**

```typescript
type CamelToKebab<S extends string> = S extends `${infer First}${infer Rest}`
  ? First extends Uppercase<First>
    ? `-${Lowercase<First>}${CamelToKebab<Rest>}`
    : `${First}${CamelToKebab<Rest>}`
  : S;

// 测试
type Result1 = CamelToKebab<"camelCase">; // 'camel-case'
type Result2 = CamelToKebab<"myCamelCase">; // 'my-camel-case'
type Result3 = CamelToKebab<"HTML">; // '-h-t-m-l'
```

**核心知识点**：模板字符串类型 + `infer` 字符串拆分 + `Uppercase`/`Lowercase` 内置工具类型

---

## Challenge 15: K-ary Function Type

**实现一个可以表示任意数量参数的函数类型约束**

```typescript
// 获取函数最后一个参数类型
type LastParam<Fn extends (...args: any[]) => any> = Fn extends (
  ...args: infer P
) => any
  ? P extends [...any[], infer Last]
    ? Last
    : never
  : never;

// 获取函数除最后一个参数外的所有参数
type AllButLast<Fn extends (...args: any[]) => any> = Fn extends (
  ...args: infer P
) => any
  ? P extends [...infer Init, any]
    ? (...args: Init) => any
    : Fn
  : Fn;

// 测试
declare function complex(a: string, b: number, c: boolean): void;
type Last = LastParam<typeof complex>; // boolean
type Rest = AllButLast<typeof complex>; // (a: string, b: number) => any
```

**核心知识点**：元组模式匹配 + 尾部提取 + 头部提取

---

## Challenge 16: Merge<A, B>

**合并两个对象类型，B 覆盖 A 的同名属性**

```typescript
type Merge<A extends object, B extends object> = {
  [K in keyof A | keyof B]: K extends keyof B
    ? B[K]
    : K extends keyof A
      ? A[K]
      : never;
};

// 测试
type A = { name: string; age: number };
type B = { name: number; address: string };

type Merged = Merge<A, B>;
// { name: number; age: number; address: string }
```

**核心知识点**：`keyof A | keyof B` 联合键 + 条件类型判断优先级

---

## Challenge 17: Pipe Functions 类型

**实现函数组合的类型推导（类似 lodash/fp 的 pipe/flow）**

```typescript
// 单参数函数组合
type Compose<F extends (arg: any) => any, G extends (arg: any) => any> = (
  arg: Parameters<F>[0],
) => ReturnType<G>;

// 多函数 pipe（从左到右）
type Pipe<Fns extends ((arg: any) => any)[], First = Fns[0]> = First extends (
  ...args: any[]
) => infer R
  ? (arg: Parameters<First>[0]) => R
  : never;

// 更精确的链式 pipe 类型推导
type PipeTwo<
  T,
  F1 extends (arg: T) => any,
  F2 extends (arg: ReturnType<F1>) => any,
> = (arg: T) => ReturnType<F2>;

// 测试
declare function double(n: number): number;
declare function toString(n: number): string;

type DoubleToString = PipeTwo<number, typeof double, typeof toString>;
// (arg: number) => string
```

**核心知识点**：函数类型组合 + `Parameters`/`ReturnType` 配合 + 泛型约束链

---

## Challenge 18: If<C extends boolean, T, F>

**类型级别的 if-else**

```typescript
type If<C extends boolean, T, F> = C extends true ? T : F;

// 测试
type Result1 = If<true, "a", "b">; // 'a'
type Result2 = If<false, "a", 2>; // 2
```

---

## Challenge 19: LengthOfTuple<T extends readonly any[]>

**获取元组长度（类型级别）**

```typescript
type LengthOfTuple<T extends readonly any[]> = T["length"];

// 测试
type L1 = LengthOfTuple<[1, 2, 3]>; // 3
type L2 = LengthOfTuple<[]>; // 0
type L3 = LengthOfTuple<["a", "b", "c", "d"]>; // 4
```

---

## Challenge 20: Equal<X, Y>

**类型级别的相等判断（处理 never、any 等边界情况）**

```typescript
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

// 测试
type E1 = Equal<string, string>; // true
type E2 = Equal<string, number>; // false
type E3 = Equal<any, string>; // false
type E4 = Equal<never, never>; // true
type E5 = Equal<null, undefined>; // false
```

**核心知识点**：

- 使用**泛型函数**的 `extends` 比较技巧
- `(<T>() => T extends X ? 1 : 2)` 这种模式能区分 `any` 和具体类型
- `any` 会让 `T extends any` 同时走两个分支，导致类型变为 `1 | 2`

---

## 知识点总结

### 1. 泛型约束模式

```typescript
// keyof 约束
type Pick<T, K extends keyof T> = ...

// 元组约束
type First<T extends readonly any[]> = ...

// 函数约束
type Parameters<T extends (...args: any) => any> = ...
```

### 2. 条件类型分发

```typescript
// 当 T 是联合类型时自动分发
type ToArray<T> = T extends any ? T[] : never;
// ToArray<string | number> → string[] | number[]
```

### 3. infer 的 4 种用法

```typescript
// 1. 函数参数
type Params<T> = T extends (...args: infer P) => any ? P : never;

// 2. 函数返回值
type Ret<T> = T extends (...args: any) => infer R ? R : never;

// 3. 元组解构
type First<T> = T extends [infer F, ...any[]] ? F : never;

// 4. 字符串拆分
type FirstChar<S> = S extends `${infer F}${string}` ? F : never;
```

### 4. 映射类型修饰符

```typescript
// readonly: 添加/移除只读
type RO<T> = { readonly [P in keyof T]: T[P] };
type Mutable<T> = { -readonly [P in keyof T]: T[P] };

// ?: 添加/移除可选
type Opt<T> = { [P in keyof T]?: T[P] };
type Required<T> = { [P in keyof T]-?: T[P] };

// as 键重映射
type MapKeys<T> = { [P in keyof T as `get_${P}`]: () => T[P] };
```

### 5. 递归类型模式

```typescript
// 递归深度处理
type Deep<T> = T extends object ? { [P in keyof T]: Deep<T[P]> } : T;
```

### 6. 模板字符串类型

```typescript
// 字符串拼接
type Concat<S1 extends string, S2 extends string> = `${S1}${S2}`;

// 字符串匹配
type StartsA<S extends string> = S extends `a${string}` ? true : false;

// 内置工具
Uppercase<"hello">; // 'HELLO'
Lowercase<"HELLO">; // 'hello'
Capitalize<"hello">; // 'Hello'
Uncapitalize<"Hello">; // 'hello'
```

---

## 难度梯度

| 题号 | 难度       | 核心考点             |
| ---- | ---------- | -------------------- |
| 1    | ⭐         | 映射类型基础         |
| 2    | ⭐         | readonly 修饰符      |
| 3    | ⭐         | 索引访问类型         |
| 4    | ⭐⭐       | 条件类型分发         |
| 5    | ⭐⭐       | infer + 模式匹配     |
| 6    | ⭐⭐⭐     | 递归条件类型         |
| 7    | ⭐⭐       | infer 函数参数       |
| 8    | ⭐⭐       | infer 函数返回值     |
| 9    | ⭐⭐⭐     | 键重映射 as          |
| 10   | ⭐⭐⭐⭐   | 递归元组             |
| 11   | ⭐⭐⭐     | 递归映射类型         |
| 12   | ⭐⭐⭐⭐   | -? 修饰符 + 可选判断 |
| 13   | ⭐⭐⭐     | 元组展开 + 函数类型  |
| 14   | ⭐⭐⭐⭐   | 模板字符串递归       |
| 15   | ⭐⭐⭐⭐   | 元组尾部/头部提取    |
| 16   | ⭐⭐⭐     | 联合键 + 条件优先级  |
| 17   | ⭐⭐⭐⭐⭐ | 函数组合类型推导     |
| 18   | ⭐         | 条件类型基础         |
| 19   | ⭐         | 元组 length          |
| 20   | ⭐⭐⭐⭐⭐ | 类型相等判断技巧     |

---

## 实战建议

1. **从 1-4 开始**，掌握映射类型和条件类型的基本模式
2. **5-8 重点练 infer**，这是类型体操的核心武器
3. **9-12 进阶**，涉及递归和键操作
4. **13-17 挑战**，函数类型操作和字符串处理
5. **18-20 地狱**，边界情况处理

> 💡 技巧：用 VS Code 的 hover 提示实时验证类型推导结果，比编译更快。
