// ============================================================
// 函数式编程专项训练 — 15+ 示例
// 涵盖：纯函数 / 不可变性 / 组合 / 柯里化 / 高阶函数 / Functor / Monad
// ============================================================

// ─────────────────────────────────────────────
// 1. 纯函数 (Pure Function)
// 相同输入 → 相同输出，无副作用
// ─────────────────────────────────────────────
function add(a: number, b: number): number {
  return a + b;
}

// ❌ 不纯：依赖外部状态、修改外部变量
let total = 0;
function impureAdd(n: number) {
  total += n;
  return total;
}

// ✅ 纯函数版本
function pureAdd(current: number, n: number): number {
  return current + n;
}

console.log("1) 纯函数:", add(3, 4)); // 7

// ─────────────────────────────────────────────
// 2. 不可变性 (Immutability)
// 永远不修改原数据，返回新数据
// ─────────────────────────────────────────────
interface User {
  name: string;
  age: number;
  tags: string[];
}

// ❌ 可变方式
function mutateUser(user: User) {
  user.age += 1; // 修改了原对象！
}

// ✅ 不可变方式 — 使用展开运算符
function immutableUpdateAge(user: User, newAge: number): User {
  return { ...user, age: newAge };
}

function immutableAddTag(user: User, tag: string): User {
  return { ...user, tags: [...user.tags, tag] };
}

const alice: User = { name: "Alice", age: 25, tags: ["dev"] };
const alice2 = immutableUpdateAge(alice, 26);
const alice3 = immutableAddTag(alice2, "fp");
console.log("2) 不可变性:", alice.age, alice2.age, alice3.tags);
// 25, 26, ["dev", "fp"] — 原对象未被修改

// ─────────────────────────────────────────────
// 3. 柯里化 (Currying)
// 多参数函数 → 一系列单参数函数
// ─────────────────────────────────────────────
function curry(fn: (...args: any[]) => any) {
  const curried = (...args: any[]): any => {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...more: any[]) => curried(...args, ...more);
  };
  return curried;
}

// 手动柯里化示例
const multiply = (a: number) => (b: number) => (c: number) => a * b * c;
const double = multiply(2); // (b) => (c) => 2*b*c
const tripleDouble = double(3); // (c) => 6*c
console.log("3) 柯里化:", tripleDouble(5)); // 30

// 通用 curry 工具
const greet = (greeting: string, name: string, punctuation: string) =>
  `${greeting}, ${name}${punctuation}`;

const curriedGreet = curry(greet);
const sayHello = curriedGreet("Hello");
const sayHelloToAlice = sayHello("Alice");
console.log("3b) 通用柯里化:", sayHelloToAlice("!")); // "Hello, Alice!"

// ─────────────────────────────────────────────
// 4. 函数组合 (Composition)
// compose(f, g)(x) = f(g(x))
// ─────────────────────────────────────────────
function compose<A, B, C>(f: (b: B) => C, g: (a: A) => B): (a: A) => C {
  return (x: A) => f(g(x));
}

// pipe：从左到右组合，更直觉
function pipe<A extends any[], R>(...fns: Array<(...args: any[]) => any>) {
  return (value: any): R => fns.reduce((acc, fn) => fn(acc), value);
}

const toUpper = (s: string) => s.toUpperCase();
const exclaim = (s: string) => s + "!";
const repeat = (s: string) => s + s;

const shout = pipe(toUpper, exclaim, repeat);
console.log("4) 函数组合(pipe):", shout("hello")); // "HELLO!HELLO!"

// compose 从右到左
const shoutCompose = compose(exclaim, compose(toUpper, repeat));
console.log("4b) 函数组合(compose):", shoutCompose("hello")); // "HELLO!!"

// ─────────────────────────────────────────────
// 5. 高阶函数 (Higher-Order Function)
// 接受函数作为参数 或 返回函数
// ─────────────────────────────────────────────
// repeatN：返回一个调用原函数 n 次的函数
function repeatN<T>(fn: (i: number) => T, n: number) {
  return () => Array.from({ length: n }, (_, i) => fn(i));
}

const rollDice3 = repeatN(() => Math.floor(Math.random() * 6) + 1, 3);
console.log("5) 高阶函数:", rollDice3()); // [3, 1, 5] 示例

// ─────────────────────────────────────────────
// 6. Map / Filter / Reduce 函数式三剑客
// ─────────────────────────────────────────────
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// 纯函数版本的 map
const pureMap = <T, U>(arr: T[], fn: (item: T) => U): U[] =>
  arr.reduce<U[]>((acc, item) => [...acc, fn(item)], []);

// 纯函数版本的 filter
const pureFilter = <T>(arr: T[], pred: (item: T) => boolean): T[] =>
  arr.reduce<T[]>((acc, item) => (pred(item) ? [...acc, item] : acc), []);

// 纯函数版本的 reduce
const pureReduce = <T, U>(arr: T[], fn: (acc: U, item: T) => U, init: U): U => {
  let acc = init;
  for (const item of arr) acc = fn(acc, item);
  return acc;
};

const squares = pureMap(numbers, (n) => n * n);
const evens = pureFilter(numbers, (n) => n % 2 === 0);
const sum = pureReduce(numbers, (a, b) => a + b, 0);

console.log("6) 三剑客:", { squares, evens, sum });
// squares: [1,4,9,16,25,36,49,64,81,100]
// evens: [2,4,6,8,10]
// sum: 55

// ─────────────────────────────────────────────
// 7. Point-Free 风格 (Tacit Programming)
// 不显式提及参数，靠组合传递数据流
// ─────────────────────────────────────────────
const getFirstLetter = (s: string) => s[0];
const join = (sep: string) => (arr: string[]) => arr.join(sep);

const initials = pipe(
  (s: string) => s.split(" "),
  (words: string[]) => words.map(getFirstLetter),
  join("."),
);

console.log("7) Point-Free:", initials("alan turing")); // "a.t"

// ─────────────────────────────────────────────
// 8. 记忆化 (Memoization)
// 缓存纯函数的计算结果
// ─────────────────────────────────────────────
function memoize<T extends any[], R>(fn: (...args: T) => R): (...args: T) => R {
  const cache = new Map<string, R>();
  return (...args: T): R => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

// 斐波那契 — 不用记忆化会指数爆炸
const fib = (n: number): number => (n <= 1 ? n : fib(n - 1) + fib(n - 2));
const memoFib = memoize(fib);

console.time("fib(40) no memo");
// fib(40); // 太慢，跳过
console.timeEnd("fib(40) no memo");

console.time("memoFib(40)");
console.log("8) 记忆化 fib(40) =", memoFib(40)); // 102334155
console.timeEnd("memoFib(40)");

// ─────────────────────────────────────────────
// 9. Functor — 可映射的容器
// ─────────────────────────────────────────────
class Box<T> {
  constructor(private value: T) {}

  // map 让 Box 成为 Functor
  map<U>(fn: (val: T) => U): Box<U> {
    return new Box(fn(this.value));
  }

  // chain / flatMap 让 Box 成为 Monad
  chain<U>(fn: (val: T) => Box<U>): Box<U> {
    return fn(this.value);
  }

  inspect(): T {
    return this.value;
  }
}

const box = new Box("hello")
  .map((s) => s.toUpperCase())
  .map((s) => s + " WORLD");

console.log("9) Functor:", box.inspect()); // "HELLO WORLD"

// ─────────────────────────────────────────────
// 10. Maybe Monad — 安全处理 null/undefined
// ─────────────────────────────────────────────
class Maybe<T> {
  private constructor(private value: T | null | undefined) {}

  static just<T>(v: T): Maybe<T> {
    return new Maybe(v);
  }

  static nothing<T>(): Maybe<T> {
    return new Maybe(null) as Maybe<T>;
  }

  static of<T>(v: T | null | undefined): Maybe<T> {
    return v == null ? (Maybe.nothing() as Maybe<T>) : Maybe.just(v);
  }

  isNothing(): boolean {
    return this.value == null;
  }

  map<U>(fn: (val: T) => U): Maybe<U> {
    return this.isNothing()
      ? Maybe.nothing<U>()
      : Maybe.of(fn(this.value as T));
  }

  chain<U>(fn: (val: T) => Maybe<U>): Maybe<U> {
    return this.isNothing() ? Maybe.nothing() : fn(this.value as T);
  }

  orElse(defaultValue: T): T {
    return this.isNothing() ? defaultValue : (this.value as T);
  }
}

interface Address {
  street?: string;
  city?: string;
}

interface Person {
  name?: string;
  address?: Address;
}

// 安全地深入嵌套对象，不会 throw
const getCity = (person: Maybe<Person>) =>
  person
    .chain((p) => Maybe.of(p.address))
    .chain((a) => Maybe.of(a.city))
    .orElse("Unknown");

const person1 = Maybe.just<Person>({
  name: "Bob",
  address: { city: "Shanghai" },
});
const person2 = Maybe.just<Person>({ name: "Charlie" }); // 无 address
const person3 = Maybe.nothing<Person>();

console.log("10) Maybe Monad:");
console.log("  Bob's city:", getCity(person1)); // "Shanghai"
console.log("  Charlie:", getCity(person2)); // "Unknown"
console.log("  Nothing:", getCity(person3)); // "Unknown"

// ─────────────────────────────────────────────
// 11. 函数管道 — 数据流式处理
// ─────────────────────────────────────────────
interface Product {
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}

const products: Product[] = [
  { name: "Laptop", price: 9999, category: "electronics", inStock: true },
  { name: "Book", price: 49, category: "books", inStock: true },
  { name: "Phone", price: 6999, category: "electronics", inStock: false },
  { name: "Notebook", price: 15, category: "books", inStock: true },
  { name: "Tablet", price: 3999, category: "electronics", inStock: true },
];

const processProducts = pipe(
  (items: Product[]) => items.filter((p) => p.inStock),
  (items: Product[]) => items.filter((p) => p.category === "electronics"),
  (items: Product[]) => items.sort((a, b) => a.price - b.price),
  (items: Product[]) => items.map((p) => `${p.name}: ¥${p.price}`),
  (items: string[]) => items.join("\n"),
);

console.log("11) 函数管道:\n" + processProducts(products));
// Laptop: ¥9999
// Tablet: ¥3999

// ─────────────────────────────────────────────
// 12. 部分应用 (Partial Application)
// 固定部分参数，生成新函数
// ─────────────────────────────────────────────
function partial(fn: (...args: any[]) => any, ...preset: any[]) {
  return (...rest: any[]): any => fn(...preset, ...rest);
}

const formatPrice = (currency: string, symbol: string, amount: number) =>
  `${currency} ${symbol}${amount.toFixed(2)}`;

const formatUSD = partial(formatPrice, "USD", "$");
const formatCNY = partial(formatPrice, "CNY", "¥");

console.log("12) 部分应用:");
console.log(" ", formatUSD(99.9)); // "USD $99.90"
console.log(" ", formatCNY(199.5)); // "CNY ¥199.50"

// ─────────────────────────────────────────────
// 13. 纯函数组合 — 验证器管道
// ─────────────────────────────────────────────
type Validator = (value: string) => string | null; // null = 通过

const required: Validator = (v) => (v.trim() ? null : "Required field");
const minLength =
  (n: number): Validator =>
  (v) =>
    v.length >= n ? null : `Min length ${n}`;
const matches =
  (regex: RegExp): Validator =>
  (v) =>
    regex.test(v) ? null : `Invalid format`;

// 组合多个验证器
const validate =
  (validators: Validator[]) =>
  (value: string): string[] =>
    validators
      .map((v) => v(value))
      .filter((msg): msg is string => msg !== null);

const validateEmail = validate([
  required,
  minLength(5),
  matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
]);

console.log("13) 验证器管道:");
console.log(" ", validateEmail("")); // ["Required field"]
console.log(" ", validateEmail("ab")); // ["Min length 5"]
console.log(" ", validateEmail("abc@def")); // ["Invalid format"]
console.log(" ", validateEmail("a@b.com")); // []

// ─────────────────────────────────────────────
// 14. 不可变数据结构 — 持久化列表 (Persistent List)
// ─────────────────────────────────────────────
type List<T> = null | { head: T; tail: List<T> };

const empty = null;
const cons = <T>(head: T, tail: List<T>): List<T> => ({ head, tail });
const head = <T>(list: List<T>): T | undefined => list?.head;
const tail = <T>(list: List<T>): List<T> => list?.tail ?? null;

const listMap = <T, U>(fn: (x: T) => U, list: List<T>): List<U> =>
  list === null ? null : cons(fn(list.head), listMap(fn, list.tail));

const listFilter = <T>(pred: (x: T) => boolean, list: List<T>): List<T> => {
  if (list === null) return null;
  return pred(list.head)
    ? cons(list.head, listFilter(pred, list.tail))
    : listFilter(pred, list.tail);
};

const listToArray = <T>(list: List<T>): T[] =>
  list === null ? [] : [list.head, ...listToArray(list.tail)];

// 构建列表: 1 -> 2 -> 3 -> 4 -> 5
const nums = cons(1, cons(2, cons(3, cons(4, cons(5, empty)))));
const doubled = listMap((n) => n * 2, nums);
const evensList = listFilter((n) => n % 2 === 0, doubled);

console.log("14) 持久化列表:");
console.log("  原始:", listToArray(nums)); // [1,2,3,4,5]
console.log("  ×2:", listToArray(doubled)); // [2,4,6,8,10]
console.log("  偶数:", listToArray(evensList)); // [2,4,6,8,10]

// ─────────────────────────────────────────────
// 15. 纯函数 — 状态机 (State Machine as Pure Function)
// 状态转移 = 纯函数：(state, action) → newState
// ─────────────────────────────────────────────
type TrafficLight = "red" | "yellow" | "green";
type LightAction = "next" | "reset";

interface LightState {
  color: TrafficLight;
  count: number;
}

const initialState: LightState = { color: "red", count: 0 };

const transition = (state: LightState, action: LightAction): LightState => {
  switch (action) {
    case "next":
      const nextColor: Record<TrafficLight, TrafficLight> = {
        red: "green",
        green: "yellow",
        yellow: "red",
      };
      return { color: nextColor[state.color], count: state.count + 1 };
    case "reset":
      return initialState;
  }
};

// 模拟状态流转
const trafficLog = ["next", "next", "next", "next", "next"].reduce(
  (state, action) => {
    const next = transition(state, action as LightAction);
    console.log(`  → ${next.color} (step ${next.count})`);
    return next;
  },
  initialState,
);

console.log("15) 纯函数状态机:");
console.log("  最终状态:", trafficLog);

// ─────────────────────────────────────────────
// 总结
// ─────────────────────────────────────────────
console.log("\n✅ 函数式编程 15 个示例全部完成！");
console.log("核心概念覆盖：");
console.log("  1.  纯函数 — 无副作用，相同输入→相同输出");
console.log("  2.  不可变性 — 永远返回新数据，不修改原数据");
console.log("  3.  柯里化 — 多参数函数链式调用");
console.log("  4.  函数组合 — compose / pipe");
console.log("  5.  高阶函数 — 函数作为参数/返回值");
console.log("  6.  Map/Filter/Reduce — 数据变换三剑客");
console.log("  7.  Point-Free — 隐式参数，数据流传递");
console.log("  8.  记忆化 — 缓存纯函数结果");
console.log("  9.  Functor — 可映射容器 (Box)");
console.log("  10. Maybe Monad — 安全处理 null");
console.log("  11. 函数管道 — 数据流式处理");
console.log("  12. 部分应用 — 固定部分参数");
console.log("  13. 验证器组合 — 纯函数管道模式");
console.log("  14. 持久化数据结构 — 不可变链表");
console.log("  15. 纯函数状态机 — (state, action) → newState");
