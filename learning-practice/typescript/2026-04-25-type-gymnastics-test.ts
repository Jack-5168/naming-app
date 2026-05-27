// TypeScript 类型体操 — 编译验证

// Challenge 1: MyPick
type MyPick<T, K extends keyof T> = {
  [P in K]: T[P];
};
interface Todo1 {
  title: string;
  description: string;
  completed: boolean;
}
type TodoPreview = MyPick<Todo1, "title" | "description">;
const p1: TodoPreview = { title: "Clean", description: "Dirty" };

// Challenge 2: MyReadonly
type MyReadonly<T> = { readonly [P in keyof T]: T[P] };
interface Todo2 {
  title: string;
}
const p2: MyReadonly<Todo2> = { title: "Hey" };
// @ts-expect-error
p2.title = "Hello";

// Challenge 3: TupleToUnion
type TupleToUnion<T extends readonly any[]> = T[number];
type TU1 = TupleToUnion<["a", "b", "c"]>;
const tu1: TU1 = "a";
const tu2: TU1 = "b";

// Challenge 4: MyExclude
type MyExclude<T, U> = T extends U ? never : T;
type ME1 = MyExclude<"a" | "b" | "c", "a">;
const me1: ME1 = "b";

// Challenge 5: First
type First<T extends readonly any[]> = T extends readonly [infer F, ...any[]]
  ? F
  : never;
type F1 = First<[1, 2, 3]>;
type F2 = First<[]>;
const f1: F1 = 42;

// Challenge 6: DeepReadonly
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
type DeepReadonly<T> = T extends Primitive
  ? T
  : T extends (...args: any[]) => any
    ? T
    : { readonly [P in keyof T]: DeepReadonly<T[P]> };
interface Nested {
  a: { b: { c: string } };
}
type DR1 = DeepReadonly<Nested>;
const dr1: DR1 = { a: { b: { c: "hello" } } };
// @ts-expect-error
dr1.a.b.c = "world";

// Challenge 7: MyParameters
type MyParameters<T extends (...args: any) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : never;
declare function foo(x: number, y: string): boolean;
type MP1 = MyParameters<typeof foo>;
const mp1: MP1 = [1, "a"];

// Challenge 8: MyReturnType
type MyReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => infer R
  ? R
  : never;
declare function fn1(): string;
type MR1 = MyReturnType<typeof fn1>;
const mr1: MR1 = "hello";

// Challenge 9: Omit
type Omit1<T, K extends keyof any> = { [P in Exclude<keyof T, K>]: T[P] };
type Omit2<T, K extends keyof any> = {
  [P in keyof T as P extends K ? never : P]: T[P];
};
interface Todo9 {
  title: string;
  description: string;
  completed: boolean;
}
type OmitResult = Omit1<Todo9, "description">;
const or1: OmitResult = { title: "Hey", completed: false };

// Challenge 10: Flatten
type Flatten<T extends readonly any[]> = T extends readonly [
  infer First,
  ...infer Rest,
]
  ? First extends readonly any[]
    ? [...Flatten<First>, ...Flatten<Rest>]
    : [First, ...Flatten<Rest>]
  : [];
type FL1 = Flatten<[1, 2, [3, 4]]>;
type FL2 = Flatten<[1, [2, [3, [4, 5]]], 6]>;
const fl1: FL1 = [1, 2, 3, 4];
const fl2: FL2 = [1, 2, 3, 4, 5, 6];

// Challenge 11: DeepPartial
type DeepPartial<T> = T extends Primitive
  ? T
  : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : { [P in keyof T]?: DeepPartial<T[P]> };
interface Config {
  server: { host: string; port: number };
}
type DP1 = DeepPartial<Config>;
const dp1: DP1 = { server: { host: "localhost" } };

// Challenge 12: RequiredKeys & OptionalKeys
type RequiredKeys<T> = { [P in keyof T]-?: P }[keyof T];
type OptionalKeysPrecise<T> = {
  [P in keyof T]: {} extends Pick<T, P> ? P : never;
}[keyof T];
interface Ex12 {
  required: string;
  optional?: number;
}
type RK1 = RequiredKeys<Ex12>;
type OK1 = OptionalKeysPrecise<Ex12>;

// Challenge 13: AppendArgument
type AppendArgument<Fn extends (...args: any[]) => any, A> = Fn extends (
  ...args: infer P
) => infer R
  ? (...args: [...P, A]) => R
  : never;
declare function multiply(x: number, y: number): number;
type AA1 = AppendArgument<typeof multiply, string>;

// Challenge 14: CamelToKebab
type CamelToKebab<S extends string> = S extends `${infer First}${infer Rest}`
  ? First extends Uppercase<First>
    ? `-${Lowercase<First>}${CamelToKebab<Rest>}`
    : `${First}${CamelToKebab<Rest>}`
  : S;
type CK1 = CamelToKebab<"camelCase">;
const ck1: CK1 = "camel-case";

// Challenge 15: LastParam & AllButLast
type LastParam<Fn extends (...args: any[]) => any> = Fn extends (
  ...args: infer P
) => any
  ? P extends [...any[], infer Last]
    ? Last
    : never
  : never;
type AllButLast<Fn extends (...args: any[]) => any> = Fn extends (
  ...args: infer P
) => any
  ? P extends [...infer Init, any]
    ? (...args: Init) => any
    : Fn
  : Fn;
declare function complex(a: string, b: number, c: boolean): void;
type LP1 = LastParam<typeof complex>;
const lp1: LP1 = true;

// Challenge 16: Merge
type Merge<A extends object, B extends object> = {
  [K in keyof A | keyof B]: K extends keyof B
    ? B[K]
    : K extends keyof A
      ? A[K]
      : never;
};
type A16 = { name: string; age: number };
type B16 = { name: number; address: string };
type M16 = Merge<A16, B16>;
const m16: M16 = { name: 42, age: 10, address: "here" };

// Challenge 18: If
type If<C extends boolean, T, F> = C extends true ? T : F;
type IF1 = If<true, "a", "b">;
const if1: IF1 = "a";

// Challenge 19: LengthOfTuple
type LengthOfTuple<T extends readonly any[]> = T["length"];
type LT1 = LengthOfTuple<[1, 2, 3]>;

// Challenge 20: Equal
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;
type EQ1 = Equal<string, string>;
type EQ2 = Equal<string, number>;
type EQ3 = Equal<any, string>;
const eq1: EQ1 = true;
const eq2: EQ2 = false;
const eq3: EQ3 = false;

console.log("All type challenges compiled successfully! ✅");
