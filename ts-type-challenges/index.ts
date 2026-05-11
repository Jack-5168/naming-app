// ============================================
// TypeScript 类型体操专项训练 - 2026-05-02
// 高级类型：泛型 / 条件类型 / 映射类型
// ============================================

// ---------- 基础工具类型 ----------
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

// ============================================
// Challenge 1: MyPick<T, K> - 手动实现 Pick
// ============================================
// 从 T 中选取 K 属性，构建新类型
type MyPick<T, K extends keyof T> = {
  [P in K]: T[P];
};

type Test1 = Expect<Equal<MyPick<{ name: string; age: number }, 'name'>, { name: string }>>;

// ============================================
// Challenge 2: MyReadonly<T> - 手动实现 Readonly
// ============================================
// 将 T 的所有属性变为只读
type MyReadonly<T> = {
  readonly [P in keyof T]: T[P];
};

type Test2 = Expect<Equal<MyReadonly<{ a: number }>, { readonly a: number }>>;

// ============================================
// Challenge 3: First<T> - 获取元组的第一个元素类型
// ============================================
type First<T extends readonly any[]> = T extends readonly [infer F, ...any[]] ? F : never;

type Test3_1 = Expect<Equal<First<[1, 2, 3]>, 1>>;
type Test3_2 = Expect<Equal<First<['a', 'b', 'c']>, 'a'>>;
// First<[]> 应该报错或返回 never（这里用 never）

// ============================================
// Challenge 4: TupleToUnion<T> - 元组转联合类型
// ============================================
type TupleToUnion<T extends readonly any[]> = T[number];

type Test4 = Expect<Equal<TupleToUnion<[1, 'a', true]>, 1 | 'a' | true>>;

// ============================================
// Challenge 5: DeepReadonly<T> - 深度只读
// ============================================
type DeepReadonly<T> = T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;

type Test5Obj = { a: { b: { c: string } } };
type Test5Result = DeepReadonly<Test5Obj>;
// Test5Result.a.b.c 应该是 string，且 a、b、c 层层只读
type Test5 = Expect<Equal<Test5Result['a']['b']['c'], string>>;

// ============================================
// Challenge 6: MyExclude<T, U> - 手动实现 Exclude
// ============================================
// 从联合类型 T 中排除 U 包含的类型
type MyExclude<T, U> = T extends U ? never : T;

type Test6 = Expect<Equal<MyExclude<'a' | 'b' | 'c', 'a' | 'b'>, 'c'>>;

// ============================================
// Challenge 7: MyParameters<T> - 手动实现 Parameters
// ============================================
// 提取函数类型的参数列表为元组
type MyParameters<T extends (...args: any[]) => any> = T extends (...args: infer P) => any ? P : never;

type Test7 = Expect<Equal<MyParameters<(a: string, b: number) => void>, [string, number]>>;

// ============================================
// Challenge 8: MyReturnType<T> - 手动实现 ReturnType
// ============================================
// 提取函数类型的返回值
type MyReturnType<T extends (...args: any[]) => any> = T extends (...args: any[]) => infer R ? R : never;

type Test8 = Expect<Equal<MyReturnType<() => string>, string>>;

// ============================================
// Challenge 9: MyOmit<T, K> - 手动实现 Omit
// ============================================
// 从 T 中移除 K 属性
type MyOmit<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]: T[P];
};

type Test9 = Expect<Equal<MyOmit<{ name: string; age: number }, 'age'>, { name: string }>>;

// ============================================
// Challenge 10: FlipObject<T> - 翻转对象的键值类型
// ============================================
// 将 { a: 'x', b: 'y' } 转为 { x: 'a', y: 'b' }
// 假设值都是 string 字面量类型
type FlipObject<T extends Record<string, string>> = {
  [K in keyof T as T[K]]: K;
};

type Test10 = Expect<Equal<FlipObject<{ a: 'x', b: 'y' }>, { x: 'a', y: 'b' }>>;

// ============================================
// Challenge 11: Chainable<T> - 链式调用类型
// ============================================
// 模拟 jQuery 风格的链式 API
type Chainable<T = {}> = {
  option<K extends string, V>(key: K, value: V): Chainable<T & Record<K, V>>;
  get(): T;
};

// 用法示例（编译时验证）：
declare const chainable: Chainable;
// const result = chainable
//   .option('name', 'TypeScript')
//   .option('version', '5.0')
//   .get();
// result.name → string, result.version → string

// ============================================
// Challenge 12: LengthOfTuple<T> - 获取元组长度
// ============================================
type LengthOfTuple<T extends readonly any[]> = T['length'];

type Test12 = Expect<Equal<LengthOfTuple<[1, 2, 3]>, 3>>;

// ============================================
// Challenge 13: AppendArgument<T, A> - 为函数追加参数
// ============================================
type AppendArgument<T extends (...args: any[]) => any, A> = T extends (...args: infer P) => infer R
  ? (...args: [...P, A]) => R
  : never;

type Test13 = Expect<Equal<AppendArgument<(a: number) => string, boolean>, (a: number, b: boolean) => string>>;

// ============================================
// Challenge 14: TrimLeft<T> - 去除左侧空白字符
// ============================================
type Whitespace = ' ' | '\t' | '\n' | '\r';
type TrimLeft<T extends string> = T extends `${Whitespace}${infer Rest}` ? TrimLeft<Rest> : T;

type Test14 = Expect<Equal<TrimLeft<'  hello'>, 'hello'>>;

// ============================================
// Challenge 15: CamelCase<T> - 驼峰命名转换
// ============================================
// 将 'hello_world_foo' 转为 'helloWorldFoo'
type CamelCase<T extends string> = T extends `${infer A}_${infer B}${infer C}`
  ? `${A}${Uppercase<B>}${CamelCase<C>}`
  : T;

type Test15 = Expect<Equal<CamelCase<'hello_world_foo'>, 'helloWorldFoo'>>;

// ============================================
// Challenge 16: UnionToIntersection<T> - 联合转交叉
// ============================================
type UnionToIntersection<U> = (U extends any ? (x: U) => any : never) extends (x: infer I) => any ? I : never;

type Test16Obj = { a: number } | { b: string };
type Test16Result = UnionToIntersection<Test16Obj>;
type Test16 = Expect<Equal<Test16Result, { a: number } & { b: string }>>;

// ============================================
// Challenge 17: IsUnion<T> - 判断是否为联合类型
// ============================================
type IsUnion<T, U = T> = T extends any ? ([U] extends [T] ? false : true) : false;

type Test17_1 = Expect<Equal<IsUnion<'a' | 'b'>, true>>;
type Test17_2 = Expect<Equal<IsUnion<'a'>, false>>;

// ============================================
// Challenge 18: Replace<T, S, R> - 字符串替换
// ============================================
type Replace<T extends string, S extends string, R extends string> = T extends `${infer Prefix}${S}${infer Suffix}`
  ? `${Prefix}${R}${Suffix}`
  : T;

type Test18 = Expect<Equal<Replace<'hello world', 'world', 'ts'>, 'hello ts'>>;

// ============================================
// Challenge 19: DeepPartial<T> - 深度可选
// ============================================
type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

type Test19Obj = { a: { b: { c: string } } };
type Test19Result = DeepPartial<Test19Obj>;
// Test19Result.a 可选, Test19Result.a?.b 可选
type Test19 = Expect<Equal<Required<Test19Result>['a'], { b?: { c?: string } }>>;

// ============================================
// Challenge 20: Merge<T, U> - 合并两个对象类型
// ============================================
// U 的属性覆盖 T 的同名属性
type Merge<T extends object, U extends object> = {
  [K in keyof T | keyof U]: K extends keyof U ? U[K] : K extends keyof T ? T[K] : never;
};

type Test20 = Expect<Equal<Merge<{ a: number; b: string }, { b: boolean; c: number }>, { a: number; b: boolean; c: number }>>;

// ============================================
// Challenge 21: KebabCase<T> - 短横线命名
// ============================================
// 将 'helloWorldFoo' 转为 'hello-world-foo'
type KebabCase<T extends string> = T extends `${infer A}${infer B}`
  ? B extends Capitalize<B>
    ? `${Uncapitalize<A>}-${Lowercase<B>}`
    : `${A}${KebabCase<B>}`
  : T;

// 简化版（处理常见场景）
type KebabCaseSimple<T extends string> = T extends `${infer A}${infer B}`
  ? B extends `${Capitalize<string>}${string}`
    ? `${Lowercase<A>}-${KebabCaseSimple<B>}`
    : `${A}${KebabCaseSimple<B>}`
  : T;

// ============================================
// Challenge 22: DropFirst<T> - 丢弃元组第一个元素
// ============================================
type DropFirst<T extends readonly any[]> = T extends readonly [any, ...infer Rest] ? Rest : [];

type Test22 = Expect<Equal<DropFirst<[1, 2, 3]>, [2, 3]>>;

// ============================================
// Challenge 23: Concat<T, U> - 拼接两个元组
// ============================================
type Concat<T extends readonly any[], U extends readonly any[]> = [...T, ...U];

type Test23 = Expect<Equal<Concat<[1, 2], [3, 4]>, [1, 2, 3, 4]>>;

// ============================================
// Challenge 24: Includes<T, V> - 元组是否包含某类型
// ============================================
type Includes<T extends readonly any[], V> = T extends readonly [infer F, ...infer Rest]
  ? Equal<F, V> extends true
    ? true
    : Includes<Rest, V>
  : false;

type Test24_1 = Expect<Equal<Includes<[1, 2, 3], 2>, true>>;
type Test24_2 = Expect<Equal<Includes<[1, 2, 3], 4>, false>>;

// ============================================
// Challenge 25: Push<T, V> - 向元组追加元素
// ============================================
type Push<T extends readonly any[], V> = [...T, V];

type Test25 = Expect<Equal<Push<[1, 2], 3>, [1, 2, 3]>>;

// ============================================
// 编译时验证 - 如果全部通过则无报错
// ============================================
// 取消注释以下行来验证所有挑战：
// 在 tsconfig strict 模式下编译，任何不匹配都会报错

export {};
