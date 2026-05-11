# TypeScript 类型体操专项训练 — 高级类型挑战 v5

**时间:** 2026-05-06 09:00  
**主题:** 泛型 / 条件类型 / 映射类型 — 进阶挑战  
**前置:** 已完成 v1-v4（基础 Pick/Readonly/条件类型/映射类型/模板字面量/递归）  
**目标:** 12+ 高难度类型挑战，覆盖真实场景中的复杂类型需求

---

## Challenge 1: `DeepMutable<T>` — 深度可变（移除所有 readonly）

**难度:** ⭐⭐⭐⭐

实现一个类型，递归移除 `T` 中所有属性的 `readonly` 修饰符（包括嵌套对象和数组元素）。

```typescript
type DeepMutable<T> = /* 你的实现 */;

// 测试
type A = DeepMutable<readonly string[]>;
// 期望: string[]

type B = DeepMutable<readonly (readonly { readonly a: number })[]>;
// 期望: { a: number }[]

type C = DeepMutable<{ readonly a: { readonly b: string } }>;
// 期望: { a: { b: string } }
```

<details>
<summary>思路提示</summary>

需要处理三种情况：
1. 数组/元组 → 递归处理元素，移除 readonly 数组修饰符
2. 对象 → 递归处理属性，移除 readonly 属性修饰符
3. 原始类型 → 直接返回

注意：`readonly T[]` 和 `ReadonlyArray<T>` 是等价的，需要用 `T extends readonly any[]` 来匹配。
</details>

<details>
<summary>答案</summary>

```typescript
type DeepMutable<T> = T extends readonly any[]
  ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;
```

关键点：
- `-readonly` 移除 readonly 修饰符（与 `readonly` 相反）
- 数组和对象用同一个映射逻辑处理（数组也是 object）
- `readonly any[]` 匹配 `readonly T[]` 和 `ReadonlyArray<T>`
</details>

---

## Challenge 2: `MergeDeep<T, U>` — 深度合并类型

**难度:** ⭐⭐⭐⭐⭐

实现一个深度合并类型。当 `T` 和 `U` 的同一属性都是对象时，递归合并；否则 `U` 覆盖 `T`。

```typescript
type MergeDeep<T, U> = /* 你的实现 */;

// 测试
type A = MergeDeep<{ a: { b: number; c: string } }, { a: { b: boolean; d: number } }>;
// 期望: { a: { b: boolean; c: string; d: number } }

type B = MergeDeep<{ a: number }, { a: string }>;
// 期望: { a: string }

type C = MergeDeep<{}, { a: 1 }>;
// 期望: { a: 1 }
```

<details>
<summary>思路提示</summary>

1. 遍历 `T` 的所有键和 `U` 的所有键（`keyof T | keyof U`）
2. 如果键只在 `T` 中 → 保留 `T[K]`
3. 如果键只在 `U`` 中 → 保留 `U[K]`
4. 如果键在两者中且都是对象（非函数、非数组）→ 递归合并
5. 如果键在两者中但有一个不是对象 → `U[K]` 覆盖

判断"是对象但不是函数/数组"：`T[K] extends object && !T[K] extends Function && !T[K] extends any[]`
</details>

<details>
<summary>答案</summary>

```typescript
type IsPlainObject<T> = T extends object
  ? T extends Function
    ? false
    : T extends any[]
      ? false
      : true
  : false;

type MergeDeep<T, U> = {
  [K in keyof T | keyof U]: K extends keyof U
    ? K extends keyof T
      ? IsPlainObject<T[K]> extends true
        ? IsPlainObject<U[K]> extends true
          ? MergeDeep<T[K], U[K]>
          : U[K]
        : U[K]
      : U[K]
    : K extends keyof T
      ? T[K]
      : never;
};
```

关键点：
- `keyof T | keyof U` 覆盖所有键
- 嵌套条件类型处理四种情况：仅T/仅U/都是对象/覆盖
- `IsPlainObject` 排除函数和数组（它们也是 object）
</details>

---

## Challenge 3: `BuildArray<Length, Elem>` — 构建指定长度的元组

**难度:** ⭐⭐⭐⭐

用递归类型构建一个指定长度的元组，所有元素类型为 `Elem`。

```typescript
type BuildArray<Length extends number, Elem, Acc extends any[] = []> = 
  /* 你的实现 */;

// 测试
type A = BuildArray<3, string>;
// 期望: [string, string, string]

type B = BuildArray<0, number>;
// 期望: []

type C = BuildArray<5, boolean>;
// 期望: [boolean, boolean, boolean, boolean, boolean]
```

<details>
<summary>思路提示</summary>

用累加器模式：
1. 基线条件：`Acc['length'] extends Length` → 返回 `Acc`
2. 递归步骤：`[...Acc, Elem]` 继续递归

注意：TypeScript 递归深度有限制（约 50-100 层），所以这个类型不适合构建超长元组。
</details>

<details>
<summary>答案</summary>

```typescript
type BuildArray<Length extends number, Elem, Acc extends any[] = []> = 
  Acc['length'] extends Length
    ? Acc
    : BuildArray<Length, Elem, [...Acc, Elem]>;
```

关键点：
- 累加器 `Acc` 默认 `[]`
- `Acc['length']` 获取当前累加器长度
- `[...Acc, Elem]` 在尾部追加元素
- 尾递归风格，TS 4.5+ 对尾递归有优化
</details>

---

## Challenge 4: `StringToUnion<S>` — 字符串转字符联合

**难度:** ⭐⭐⭐

将字符串类型的每个字符提取为联合类型。

```typescript
type StringToUnion<S extends string> = /* 你的实现 */;

// 测试
type A = StringToUnion<"abc">;
// 期望: "a" | "b" | "c"

type B = StringToUnion<"">;
// 期望: never
```

<details>
<summary>思路提示</summary>

1. 用模板字面量 `infer` 逐个提取字符
2. 递归处理剩余字符串
3. 空字符串返回 `never`

思考：这和 `TupleToUnion` 有什么区别？字符串不能直接用 `S[number]`。
</details>

<details>
<summary>答案</summary>

```typescript
type StringToUnion<S extends string> = 
  S extends `${infer First}${infer Rest}`
    ? First | StringToUnion<Rest>
    : never;
```

关键点：
- `${infer First}${infer Rest}` 拆分首字符和剩余
- `First | StringToUnion<Rest>` 递归构建联合
- 空字符串不匹配模板，返回 `never`（联合的空集）
</details>

---

## Challenge 5: `Replace<S, From, To>` — 字符串替换

**难度:** ⭐⭐⭐

将字符串类型 `S` 中第一次出现的 `From` 替换为 `To`。

```typescript
type Replace<S extends string, From extends string, To extends string> = 
  /* 你的实现 */;

// 测试
type A = Replace<"hello world", "world", "typescript">;
// 期望: "hello typescript"

type B = Replace<"hello world", "foo", "bar">;
// 期望: "hello world"（没找到，原样返回）

type C = Replace<"abcabc", "abc", "x">;
// 期望: "xabc"（只替换第一次出现）
```

<details>
<summary>思路提示</summary>

1. 匹配 `S` 是否包含 `From`：`` `${infer Before}${From}${infer After}` ``
2. 如果匹配 → 拼接 `` `${Before}${To}${After}` ``
3. 如果不匹配 → 返回原字符串 `S`
</details>

<details>
<summary>答案</summary>

```typescript
type Replace<S extends string, From extends string, To extends string> = 
  S extends `${infer Before}${From}${infer After}`
    ? `${Before}${To}${After}`
    : S;
```

关键点：
- `infer` 的贪婪匹配：`Before` 会匹配到**第一次**出现的 `From` 之前的内容
- 不匹配时返回原字符串，不会报错
- 只替换第一次出现 → 要实现全局替换需要递归
</details>

---

## Challenge 6: `ReplaceAll<S, From, To>` — 全局字符串替换

**难度:** ⭐⭐⭐⭐

将字符串类型 `S` 中**所有**出现的 `From` 替换为 `To`。

```typescript
type ReplaceAll<S extends string, From extends string, To extends string> = 
  /* 你的实现 */;

// 测试
type A = ReplaceAll<"abcabcabc", "abc", "x">;
// 期望: "xxx"

type B = ReplaceAll<"hello world", "o", "0">;
// 期望: "hell0 w0rld"

type C = ReplaceAll<"no match", "xyz", "abc">;
// 期望: "no match"
```

<details>
<summary>思路提示</summary>

1. 先用 `Replace` 的逻辑匹配第一个出现
2. 如果匹配到了，替换后对 `After` 部分递归调用 `ReplaceAll`
3. 如果没匹配到，返回原字符串

注意：`From` 不能为空字符串，否则会导致无限递归。
</details>

<details>
<summary>答案</summary>

```typescript
type ReplaceAll<S extends string, From extends string, To extends string> = 
  From extends ""
    ? S
    : S extends `${infer Before}${From}${infer After}`
      ? `${Before}${To}${ReplaceAll<After, From, To>}`
      : S;
```

关键点：
- 空字符串检查防止无限递归
- 递归处理 `After` 部分实现全局替换
- 模板字面量 + 递归 = 字符串操作的终极武器
</details>

---

## Challenge 7: `IndexOf<T, E>` — 元组 indexOf

**难度:** ⭐⭐⭐⭐

返回元素 `E` 在元组 `T` 中第一次出现的索引。找不到返回 `-1`。

```typescript
type IndexOf<T extends any[], E, Acc extends any[] = []> = 
  /* 你的实现 */;

// 测试
type A = IndexOf<[1, 2, 3], 2>;
// 期望: 1

type B = IndexOf<[1, 2, 3], 4>;
// 期望: -1

type C = IndexOf<["a", "b", "c"], "a">;
// 期望: 0

type D = IndexOf<[], 1>;
// 期望: -1
```

<details>
<summary>思路提示</summary>

1. 用累加器 `Acc` 记录已遍历的元素数量（通过 `Acc['length']` 获取索引）
2. 匹配 `T` 的首元素：`T extends [infer First, ...infer Rest]`
3. 如果 `First extends E && E extends First`（严格相等）→ 返回 `Acc['length']`
4. 否则递归处理 `Rest`，累加器加一
5. 空元组 → 返回 `-1`
</details>

<details>
<summary>答案</summary>

```typescript
type IndexOf<T extends any[], E, Acc extends any[] = []> = 
  T extends [infer First, ...infer Rest]
    ? [First] extends [E]
      ? [E] extends [First]
        ? Acc['length']
        : IndexOf<Rest, E, [...Acc, First]>
      : IndexOf<Rest, E, [...Acc, First]>
    : -1;
```

关键点：
- `[First] extends [E] && [E] extends [First]` 实现严格类型相等（防止 `string extends string | number` 这种单向匹配）
- 用数组包裹阻止分布式条件类型
- `Acc` 累加已遍历元素，`Acc['length']` 就是当前索引
</details>

---

## Challenge 8: `Push<T, E>` — 元组 push

**难度:** ⭐⭐⭐

向元组尾部追加一个元素。

```typescript
type Push<T extends any[], E> = /* 你的实现 */;

// 测试
type A = Push<[1, 2], 3>;
// 期望: [1, 2, 3]

type B = Push<[], "hello">;
// 期望: ["hello"]
```

<details>
<summary>思路提示</summary>

这题很简单——用元组展开语法。
</details>

<details>
<summary>答案</summary>

```typescript
type Push<T extends any[], E> = [...T, E];
```

关键点：
- 元组展开 `...T` + 新元素 = push
- TypeScript 3.0+ 支持的语法
- 看起来简单但这是很多复杂类型的基础操作
</details>

---

## Challenge 9: `Unshift<T, E>` — 元组 unshift

**难度:** ⭐⭐⭐

向元组头部插入一个元素。

```typescript
type Unshift<T extends any[], E> = /* 你的实现 */;

// 测试
type A = Unshift<[1, 2], 0>;
// 期望: [0, 1, 2]

type B = Unshift<[], "first">;
// 期望: ["first"]
```

<details>
<summary>答案</summary>

```typescript
type Unshift<T extends any[], E> = [E, ...T];
```
</details>

---

## Challenge 10: `TupleToNestedObject<K, V>` — 元组嵌套对象

**难度:** ⭐⭐⭐⭐⭐

给定键元组和值类型，构建嵌套对象。键元组的第一个元素是最外层键。

```typescript
type TupleToNestedObject<K extends string[], V> = /* 你的实现 */;

// 测试
type A = TupleToNestedObject<["a", "b", "c"], number>;
// 期望: { a: { b: { c: number } } }

type B = TupleToNestedObject<["x"], string>;
// 期望: { x: string }
```

<details>
<summary>思路提示</summary>

1. 基线条件：元组只有一个元素 → `{ [K[0]]: V }`
2. 递归步骤：多个元素 → `{ [K[0]]: TupleToNestedObject<Rest, V> }`
3. 用 `T extends [infer Last]` 匹配单元素，`T extends [infer First, ...infer Rest]` 匹配多元素
</details>

<details>
<summary>答案</summary>

```typescript
type TupleToNestedObject<K extends string[], V> = 
  K extends [infer Last]
    ? Last extends string
      ? { [key in Last]: V }
      : {}
    : K extends [infer First, ...infer Rest]
      ? First extends string
        ? Rest extends string[]
          ? { [key in First]: TupleToNestedObject<Rest, V> }
          : {}
        : {}
      : V;
```

关键点：
- 需要 `extends string` 约束（因为 `infer` 推断出的是 `string | number | symbol`）
- 递归构建嵌套结构
- 空元组返回 `V`（防御性设计）
</details>

---

## Challenge 11: `DropFirst<T>` — 删除元组第一个元素

**难度:** ⭐⭐

```typescript
type DropFirst<T extends any[]> = /* 你的实现 */;

// 测试
type A = DropFirst<[1, 2, 3]>;
// 期望: [2, 3]

type B = DropFirst<[1]>;
// 期望: []

type C = DropFirst<[]>;
// 期望: []
```

<details>
<summary>答案</summary>

```typescript
type DropFirst<T extends any[]> = T extends [any, ...infer Rest] ? Rest : [];
```

变体（用 `...` 忽略首元素）：
```typescript
type DropFirst<T extends any[]> = T extends [_, ...infer Rest] ? Rest : [];
```
</details>

---

## Challenge 12: `Filter<T, U>` — 元组过滤

**难度:** ⭐⭐⭐⭐

从元组 `T` 中过滤出**不等于** `U` 的元素，保持原有顺序。

```typescript
type Filter<T extends any[], U> = /* 你的实现 */;

// 测试
type A = Filter<[1, 2, 3, 2], 2>;
// 期望: [1, 3]

type B = Filter<[string, number, boolean], number>;
// 期望: [string, boolean]

type C = Filter<[1, 2, 3], 4>;
// 期望: [1, 2, 3]
```

<details>
<summary>思路提示</summary>

1. 递归遍历元组
2. 如果首元素不等于 `U` → 保留并递归
3. 如果首元素等于 `U` → 跳过并递归
4. 用 `[First] extends [U] && [U] extends [First]` 判断严格相等
</details>

<details>
<summary>答案</summary>

```typescript
type Filter<T extends any[], U> = 
  T extends [infer First, ...infer Rest]
    ? [First] extends [U]
      ? [U] extends [First]
        ? Filter<Rest, U>
        : [First, ...Filter<Rest, U>]
      : [First, ...Filter<Rest, U>]
    : [];
```

关键点：
- 双向 `extends` 检查实现严格相等（`string` 和 `string | number` 会单向匹配）
- 匹配则跳过（不放入结果），不匹配则保留
- 递归拼接 `[First, ...Filter<Rest, U>]`
</details>

---

## Challenge 13: `AppendKeys<T, K>` — 为对象所有属性追加键后缀

**难度:** ⭐⭐⭐⭐

给定对象类型 `T` 和键名 `K`（字符串），为 `T` 的每个属性生成两个版本：原键和 `原键 + K` 后缀，新键的类型与原键相同。

```typescript
type AppendKeys<T extends object, K extends string> = /* 你的实现 */;

// 测试
type A = AppendKeys<{ a: number; b: string }, "_raw">;
// 期望: { a: number; b: string; a_raw: number; b_raw: string }
```

<details>
<summary>思路提示</summary>

1. 用交叉类型合并两个映射：
   - 原始映射：`{ [P in keyof T]: T[P] }`
   - 重映射：`{ [P in keyof T as `${string & P}${K}`]: T[P] }`
2. 交叉类型 `&` 合并两者

注意：`string & P` 确保 `P` 可以安全地用于模板字面量（排除 number/symbol 键）。
</details>

<details>
<summary>答案</summary>

```typescript
type AppendKeys<T extends object, K extends string> = {
  [P in keyof T]: T[P];
} & {
  [P in keyof T as `${string & P}${K}`]: T[P];
};
```

关键点：
- 交叉类型 `&` 合并两个映射类型的属性
- `as` 子句做键重映射
- `string & P` 类型交集确保键是字符串（TypeScript 要求模板字面量的插值必须是 string/number/boolean/symbol/undefined/null）
</details>

---

## Challenge 14: `IsTuple<T>` — 判断是否为元组类型

**难度:** ⭐⭐⭐⭐

判断类型 `T` 是否是元组类型（而非普通数组）。

```typescript
type IsTuple<T> = /* 你的实现 */;

// 测试
type A = IsTuple<[1, 2]>;
// 期望: true

type B = IsTuple<number[]>;
// 期望: false

type C = IsTuple<readonly [1, 2]>;
// 期望: true

type D = IsTuple<string>;
// 期望: false

type E = IsTuple<[]>;
// 期望: true
```

<details>
<summary>思路提示</summary>

关键区别：
- 元组类型：`number` 不在 `keyof T` 中（元组的键是具体的索引 "0", "1" 等）
- 数组类型：`number` 在 `keyof T` 中（因为 `arr[n]` 对任意 number 都有效）

但 `keyof [1,2]` 实际上包含 `number`（因为元组继承了数组方法）。换个思路：

用 `T extends readonly any[]` 判断是数组/元组，然后检查 `number extends keyof T`：
- 数组：`number extends keyof T` → true
- 元组：`number extends keyof T` → false

等等，这也不对。元组的 `keyof` 也包含 number（因为继承了 Array 的方法）。

正确思路：检查 `T` 的 `length` 是否是字面量类型。元组的 length 是具体数字，数组的 length 是 `number`。
</details>

<details>
<summary>答案</summary>

```typescript
type IsTuple<T> = 
  T extends readonly any[]
    ? number extends T['length']
      ? false
      : true
    : false;

// 测试验证
type A = IsTuple<[1, 2]>;           // true
type B = IsTuple<number[]>;         // false
type C = IsTuple<readonly [1, 2]>;  // true
type D = IsTuple<string>;           // false
type E = IsTuple<[]>;               // true
```

关键点：
- `T extends readonly any[]` 先判断是否为数组/元组
- `number extends T['length']` 是关键：
  - 数组 `number[]` 的 `length` 类型是 `number` → `number extends number` → true → 返回 false
  - 元组 `[1, 2]` 的 `length` 类型是 `2` → `number extends 2` → false → 返回 true
- `readonly [1, 2]` 的 `length` 类型是 `2` → 同样返回 true
</details>

---

## Challenge 15: `TrimLeft<S>` — 去除左侧空白字符

**难度:** ⭐⭐⭐

```typescript
type Space = ' ' | '\n' | '\t';

type TrimLeft<S extends string> = /* 你的实现 */;

// 测试
type A = TrimLeft<'  hello'>;
// 期望: "hello"

type B = TrimLeft<'  \t hello'>;
// 期望: "hello"

type C = TrimLeft<'hello'>;
// 期望: "hello"
```

<details>
<summary>答案</summary>

```typescript
type Space = ' ' | '\n' | '\t';

type TrimLeft<S extends string> = 
  S extends `${Space}${infer Rest}`
    ? TrimLeft<Rest>
    : S;
```

关键点：
- 递归匹配前导空白字符
- 不匹配时返回剩余字符串
- 模板字面量 + infer 是字符串操作的标配
</details>

---

## Challenge 16: `Trunc<T, MaxLen>` — 截断元组

**难度:** ⭐⭐⭐⭐

截断元组 `T` 到最大长度 `MaxLen`。

```typescript
type Trunc<T extends any[], MaxLen extends number, Acc extends any[] = []> = 
  /* 你的实现 */;

// 测试
type A = Trunc<[1, 2, 3, 4, 5], 3>;
// 期望: [1, 2, 3]

type B = Trunc<[1, 2], 5>;
// 期望: [1, 2]（长度不够，原样返回）

type C = Trunc<[], 3>;
// 期望: []
```

<details>
<summary>思路提示</summary>

1. 用累加器 `Acc` 收集已截断的元素
2. 当 `Acc['length'] extends MaxLen` → 返回 `Acc`
3. 否则继续从 `T` 中取元素追加到 `Acc`
4. `T` 为空时返回 `Acc`
</details>

<details>
<summary>答案</summary>

```typescript
type Trunc<T extends any[], MaxLen extends number, Acc extends any[] = []> = 
  Acc['length'] extends MaxLen
    ? Acc
    : T extends [infer First, ...infer Rest]
      ? Trunc<Rest, MaxLen, [...Acc, First]>
      : Acc;
```

关键点：
- 双退出条件：达到最大长度 / 元组耗尽
- 累加器模式是元组操作的通用模式
</details>

---

## Challenge 17: `PickByType<T, U>` — 按属性类型筛选

**难度:** ⭐⭐⭐⭐

从对象 `T` 中筛选出值类型为 `U` 的属性。

```typescript
type PickByType<T, U> = /* 你的实现 */;

// 测试
interface Model {
  name: string;
  count: number;
  read: boolean;
  age: number;
}

type A = PickByType<Model, number>;
// 期望: { count: number; age: number }

type B = PickByType<Model, string>;
// 期望: { name: string }
```

<details>
<summary>思路提示</summary>

用映射类型的 `as` 子句做键过滤：
- `[K in keyof T as T[K] extends U ? K : never]: T[K]`
</details>

<details>
<summary>答案</summary>

```typescript
type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};
```

关键点：
- `as` 子句做条件过滤
- `T[K] extends U` 匹配则保留键，否则映射为 `never`（自动移除）
- 这是映射类型 + 条件类型的经典组合
</details>

---

## Challenge 18: `GetReturnType<Fn>` — 提取函数返回类型

**难度:** ⭐⭐

```typescript
type GetReturnType<Fn> = /* 你的实现 */;

// 测试
type A = GetReturnType<() => string>;
// 期望: string

type B = GetReturnType<(a: number) => { name: string }>;
// 期望: { name: string }

type C = GetReturnType<typeof Math.max>;
// 期望: number
```

<details>
<summary>答案</summary>

```typescript
type GetReturnType<Fn> = Fn extends (...args: any[]) => infer R ? R : never;
```

这就是 TS 内置的 `ReturnType<T>` 的实现。
</details>

---

## Challenge 19: `ObjectFromPairs<Pairs>` — 键值对元组转对象

**难度:** ⭐⭐⭐⭐

将 `[key, value]` 元组数组转换为对象类型。

```typescript
type ObjectFromPairs<Pairs extends [string, any][]> = /* 你的实现 */;

// 测试
type A = ObjectFromPairs<[["a", 1], ["b", 2]]>;
// 期望: { a: 1; b: 2 }

type B = ObjectFromPairs<[]>;
// 期望: {}
```

<details>
<summary>思路提示</summary>

这题在类型层面比较困难，因为需要遍历元组并为每个元素生成属性。

思路：用递归 + 交叉类型
1. 空元组 → `{}`
2. 非空 → `{ [K in Pairs[0][0]]: Pairs[0][1] } & ObjectFromPairs<Rest>`

但 TS 不支持直接访问元组索引类型做映射。换个思路：

用 `as` 重映射遍历所有 pairs 的键。但这需要把所有 pairs 展平为联合类型。

实际上，纯类型层面做这个转换非常困难。一个实用的方式是：
1. 把所有键提取为联合：`Pairs[number][0]`
2. 然后为每个键找到对应的值类型

但这需要辅助类型来"查找"。
</details>

<details>
<summary>答案</summary>

```typescript
// 辅助类型：从 pairs 中查找指定 key 的 value 类型
type FindValue<Pairs extends [string, any][], Key extends string> =
  Pairs extends [infer First, ...infer Rest]
    ? First extends [string, any]
      ? Rest extends [string, any][]
        ? First[0] extends Key
          ? First[1]
          : FindValue<Rest, Key>
        : never
      : never
    : never;

type ObjectFromPairs<Pairs extends [string, any][]> = {
  [K in Pairs[number][0]]: FindValue<Pairs, K>;
};
```

关键点：
- `Pairs[number][0]` 提取所有键的联合
- `FindValue` 递归查找每个键对应的值
- 映射类型遍历所有键，用 `FindValue` 获取对应值
- 这是类型层面的"数据库查找"模式
</details>

---

## Challenge 20: `ChainableConditional<T>` — 链式条件类型

**难度:** ⭐⭐⭐⭐⭐

实现一个链式条件类型，支持 `.when<Condition>.then<Transform>.otherwise<Default>` 链式调用。

```typescript
// 这是一个概念挑战，展示类型层面的"条件管道"模式
type ChainableConditional<T> = /* 你的实现 */;

// 期望用法（概念性，实际 TS 不支持运行时方法调用）：
// 思路：用嵌套类型表达条件管道
type If<Condition extends boolean, Then, Else> = 
  /* 你的实现 */;

// 测试
type A = If<true, "yes", "no">;
// 期望: "yes"

type B = If<false, "yes", "no">;
// 期望: "no"
```

<details>
<summary>答案</summary>

```typescript
type If<Condition extends boolean, Then, Else> = 
  Condition extends true ? Then : Else;

// 进阶：支持多条件链式判断
type ElseIf<Conditions extends [boolean, any][], Default> =
  Conditions extends [infer First, ...infer Rest]
    ? First extends [boolean, any]
      ? Rest extends [boolean, any][]
        ? First[0] extends true
          ? First[1]
          : ElseIf<Rest, Default>
        : Default
      : Default
    : Default;

// 测试
type A = ElseIf<[[false, "a"], [true, "b"], [true, "c"]], "default">;
// 期望: "b"（第一个 true 分支）

type B = ElseIf<[[false, "a"], [false, "b"]], "default">;
// 期望: "default"
```

关键点：
- `If` 是最基础的条件类型
- `ElseIf` 模拟 if-else if-else 链
- 这是类型层面实现"条件管道"的基础
</details>

---

## 综合实战：类型安全的 Event Emitter

```typescript
// 1. 定义事件映射
interface Events {
  click: { x: number; y: number };
  hover: { element: string };
  keydown: { key: string; ctrl: boolean; shift: boolean };
  disconnect: undefined;
}

// 2. 类型安全的 on/off/emit
type EventEmitter<T extends Record<string, any>> = {
  on<K extends keyof T & string>(
    event: K,
    handler: (payload: T[K]) => void
  ): () => void; // 返回取消订阅函数

  off<K extends keyof T & string>(
    event: K,
    handler: (payload: T[K]) => void
  ): void;

  emit<K extends keyof T & string>(
    event: K,
    payload: T[K]
  ): void;
};

// 3. 使用 — 完全类型安全
declare const emitter: EventEmitter<Events>;

// ✅ 正确
emitter.on("click", (payload) => {
  payload.x;  // number
  payload.y;  // number
});

emitter.emit("keydown", { key: "Enter", ctrl: true, shift: false });

emitter.on("disconnect", (payload) => {
  // payload: undefined
});

// ❌ 编译错误 — 不存在的事件
// emitter.on("scroll", () => {});

// ❌ 编译错误 — payload 类型不匹配
// emitter.emit("click", { x: 1 });  // 缺少 y

// ❌ 编译错误 — payload 类型错误
// emitter.emit("hover", { element: 123 });  // 应该是 string
```

---

## 综合实战：类型安全的 Zod-like Schema 验证器

```typescript
// 1. Schema 类型定义
interface Schema<T> {
  _type: T;
  parse(input: unknown): T;
  optional(): Schema<T | undefined>;
  nullable(): Schema<T | null>;
  array(): Schema<T[]>;
}

// 2. Schema 构建器
type SchemaBuilder = {
  string(): Schema<string>;
  number(): Schema<number>;
  boolean(): Schema<boolean>;
  object<T extends Record<string, Schema<any>>>(
    shape: T
  ): Schema<{ [K in keyof T]: T[K] extends Schema<infer V> ? V : never }>;
  array<T>(element: Schema<T>): Schema<T[]>;
  literal<V extends string | number | boolean>(value: V): Schema<V>;
  union<T extends Schema<any>[]>(options: [...T]): Schema<T[number] extends Schema<infer V> ? V : never>;
};

declare const S: SchemaBuilder;

// 3. 使用 — 自动推断类型
const UserSchema = S.object({
  name: S.string(),
  age: S.number(),
  role: S.union([S.literal("admin"), S.literal("user"), S.literal("guest")]),
  tags: S.array(S.string()),
  metadata: S.object({
    createdAt: S.string(),
    updatedAt: S.string().optional(),
  }).nullable(),
});

type User = typeof UserSchema._type;
// {
//   name: string;
//   age: number;
//   role: "admin" | "user" | "guest";
//   tags: string[];
//   metadata: { createdAt: string; updatedAt?: string } | null;
// }

// 4. parse 返回类型完全正确
const user: User = UserSchema.parse({
  name: "Alice",
  age: 30,
  role: "admin",
  tags: ["dev", "lead"],
  metadata: { createdAt: "2024-01-01" },
});
```

---

## 技巧总结：高级模式

### 1. 双向 extends 检查（严格相等）

```typescript
// 问题：string extends string | number → true（单向匹配）
// 解决：双向检查
type StrictEqual<A, B> = 
  [A] extends [B]
    ? [B] extends [A]
      ? true
      : false
    : false;
```

### 2. 阻止分布式条件类型

```typescript
// 分布式（默认）
type Dist<T> = T extends any ? T[] : never;
type A = Dist<string | number>; // string[] | number[]

// 非分布式
type NonDist<T> = [T] extends [any] ? T[] : never;
type B = NonDist<string | number>; // (string | number)[]
```

### 3. 累加器模式（元组操作）

```typescript
// 通用模式
type Accumulator<T, Acc = Initial> = 
  BaseCase ? Acc : RecursiveStep<T, UpdatedAcc>;

// 示例：反转元组
type Reverse<T, Acc extends any[] = []> =
  T extends [infer First, ...infer Rest]
    ? Reverse<Rest, [First, ...Acc]>
    : Acc;
```

### 4. 键重映射 + 过滤

```typescript
// 过滤 + 重命名
type RenameAndFilter<T> = {
  [K in keyof T as T[K] extends string ? `get_${K}` : never]: () => T[K];
};
```

### 5. 交叉类型合并映射

```typescript
// 合并两个映射的结果
type Combined<T> = {
  [K in keyof T]: T[K];          // 原始属性
} & {
  [K in keyof T as `${K}_raw`]: T[K];  // 衍生属性
};
```

### 6. infer 的多重使用

```typescript
// 同时推断多个部分
type ParseUrl<T> = T extends `${infer Protocol}://${infer Host}/${infer Path}`
  ? { protocol: Protocol; host: Host; path: Path }
  : never;

type P = ParseUrl<"https://example.com/api/users">;
// { protocol: "https"; host: "example.com"; path: "api/users" }
```

---

## 常见陷阱速查

| 陷阱 | 错误写法 | 正确写法 |
|------|----------|----------|
| 分布式条件 | `T extends U ? A : B` (T 是联合) | `[T] extends [U] ? A : B` |
| 严格相等 | `A extends B ? true : false` | `[A] extends [B] ? [B] extends [A] ? true : false : false` |
| 键类型 | `keyof T` (含 number/symbol) | `keyof T & string` |
| 模板插值 | `` `${numberKey}${suffix}` `` | `` `${string & numberKey}${suffix}` `` |
| 递归深度 | 无限制递归 | 控制深度或用尾递归 |
| never 行为 | 联合中的 never 被忽略 | `string | never` = `string` |

---

## 完成情况

- ✅ Challenge 1: DeepMutable — 深度可变
- ✅ Challenge 2: MergeDeep — 深度合并
- ✅ Challenge 3: BuildArray — 构建元组
- ✅ Challenge 4: StringToUnion — 字符串转联合
- ✅ Challenge 5: Replace — 单次替换
- ✅ Challenge 6: ReplaceAll — 全局替换
- ✅ Challenge 7: IndexOf — 元组 indexOf
- ✅ Challenge 8: Push — 元组 push
- ✅ Challenge 9: Unshift — 元组 unshift
- ✅ Challenge 10: TupleToNestedObject — 嵌套对象
- ✅ Challenge 11: DropFirst — 删除首元素
- ✅ Challenge 12: Filter — 元组过滤
- ✅ Challenge 13: AppendKeys — 追加键后缀
- ✅ Challenge 14: IsTuple — 判断元组
- ✅ Challenge 15: TrimLeft — 去除左侧空白
- ✅ Challenge 16: Trunc — 截断元组
- ✅ Challenge 17: PickByType — 按类型筛选
- ✅ Challenge 18: GetReturnType — 提取返回类型
- ✅ Challenge 19: ObjectFromPairs — 键值对转对象
- ✅ Challenge 20: ChainableConditional — 链式条件
- ✅ 综合实战 1: 类型安全 Event Emitter
- ✅ 综合实战 2: Zod-like Schema 验证器
- ✅ 6 种高级模式总结
- ✅ 常见陷阱速查表

**文档路径:** `training/typescript-type-gymnastics-0900-0506.md`
**总挑战数:** 20 题 + 2 个综合实战
**难度分布:** ⭐⭐ × 2, ⭐⭐⭐ × 6, ⭐⭐⭐⭐ × 9, ⭐⭐⭐⭐⭐ × 3
