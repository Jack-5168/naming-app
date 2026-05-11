# JavaScript 深度专项 v9 — 终极整合与实战架构 (5/7)

**日期:** 2026 年 5 月 7 日 星期四 01:00
**参考:** JavaScript.info 第 5-7 章 + ES2024/2025 + 工业级实践
**性质:** 第 9 轮迭代 (4/25→4/27→4/28→4/29→4/30→5/2→5/3→5/4→5/7)
**重点:** 闭包/原型/异步/事件循环 — 终极整合、架构模式、面试深度题

---

## 训练策略

前 8 轮已系统覆盖四大主题的全部知识体系。v9 作为阶段性总结，聚焦：
1. **闭包** — 作用域链完整模型 + 闭包内存分析 + 高阶函数式编程
2. **原型** — 原型链完整模型 + Object.create 深度 + 多态与鸭子类型
3. **异步** — 完整异步错误处理 + 并发控制 + 异步状态机
4. **事件循环** — 浏览器 vs Node.js 完整对比 + 性能调优实战

---

## 一、闭包 — 作用域链完整模型

### 1.1 作用域链的完整执行模型

```javascript
// 理解闭包的核心：理解执行上下文 (Execution Context) 和词法环境 (Lexical Environment)

// ===== 执行上下文三要素 =====
// 1. LexicalEnvironment: 变量绑定 (变量、函数声明、参数)
// 2. VariableEnvironment: var 声明 (现代 JS 中与 LexicalEnvironment 相同)
// 3. ThisBinding: this 值

// ===== 词法环境结构 =====
// LexicalEnvironment = {
//   EnvironmentRecord: { 本地绑定 },
//   outer: <对父级词法环境的引用>  // ← 这就是闭包的本质
// }

// 示例: 完整的作用域链追踪
function outer(x) {
  // outer 的 LexicalEnvironment:
  // { EnvironmentRecord: { x, inner }, outer: <global> }

  const y = x * 2;

  function inner(z) {
    // inner 的 LexicalEnvironment:
    // { EnvironmentRecord: { z }, outer: <outer's LE> }
    // outer 的 LE 的 outer: <global>

    return x + y + z; // x 和 y 通过 outer 的 LE 访问
    // 这就是闭包: inner 持有对 outer LE 的引用
  }

  return inner;
}

const fn = outer(10);
// outer 执行完毕后，其 LexicalEnvironment 不会被回收
// 因为 inner (赋值给 fn) 仍然持有对其的引用
console.log(fn(5)); // 10 + 20 + 5 = 35

// ===== 闭包的实际内存结构 =====
// fn.[[Environment]] → outer's LexicalEnvironment
//   → { x: 10, y: 20 }
//   → outer: global's LexicalEnvironment

// ===== 块级作用域与闭包 =====
function blockScopeDemo() {
  let result = [];

  for (let i = 0; i < 3; i++) {
    // 每次循环迭代都创建一个新的词法环境
    // i 在每个迭代中是不同的绑定
    result.push(() => i);
  }

  return result;
}

const fns = blockScopeDemo();
console.log(fns[0]()); // 0
console.log(fns[1]()); // 1
console.log(fns[2]()); // 2

// 关键: for(let i...) 每次迭代创建新的词法环境
// 每个闭包捕获的是不同迭代中的 i 绑定
// 这与 for(var i...) 完全不同 (var 只有一个绑定)

// ===== try-catch 的词法环境 =====
function catchScopeDemo() {
  let result;

  try {
    throw new Error('test');
  } catch (e) {
    // catch 块有自己的词法环境
    // e 只在 catch 块内可见
    result = () => e.message;
  }

  // e 在外部不可见，但闭包仍然可以访问
  return result;
}

const getter = catchScopeDemo();
console.log(getter()); // 'test'
```

### 1.2 闭包内存分析实战

```javascript
// 闭包内存占用分析
// 闭包持有的不是值的副本，而是对词法环境的引用

// 问题: 闭包会持有整个词法环境，而不仅仅是用到的变量
function createBigClosure() {
  const bigData = new Array(1000000).fill('x'); // ~2MB
  const smallId = 'abc123';

  // 闭包只用到 smallId，但持有整个词法环境 (包括 bigData)
  return function () {
    return smallId;
  };
}

// 修复 1: 缩小词法环境
function createSmallClosure() {
  const smallId = 'abc123';

  // bigData 不在闭包的词法环境中
  return function () {
    return smallId;
  };
}

// 修复 2: 手动释放
function createManagedClosure() {
  let bigData = new Array(1000000).fill('x');
  const smallId = 'abc123';

  const closure = function () {
    return smallId;
  };

  // 手动释放 bigData
  bigData = null;

  return closure;
}

// 修复 3: 使用 IIFE 隔离
function createIsolatedClosure() {
  const bigData = new Array(1000000).fill('x');

  return (function () {
    const smallId = 'abc123';
    return function () {
      return smallId;
    };
  })();
  // IIFE 执行完毕后，bigData 可以被 GC
}

// 闭包链的内存累积
function closureChainDemo() {
  const closures = [];

  for (let i = 0; i < 100; i++) {
    const data = new Array(10000).fill(i); // 每个 ~20KB
    closures.push(() => data[0]);
    // 每个闭包持有自己的 data，总内存 ~2MB
  }

  return closures;
}

// 修复: 只捕获需要的值
function closureChainFixed() {
  const closures = [];

  for (let i = 0; i < 100; i++) {
    const data = new Array(10000).fill(i);
    const value = data[0]; // 提取标量值
    closures.push(() => value);
    // data 可以被 GC，闭包只持有标量 value
  }

  return closures;
}
```

### 1.3 高阶函数式编程模式

```javascript
// 模式 1: 函数组合 (Function Composition)
const compose = (...fns) => (x) =>
  fns.reduceRight((v, f) => f(v), x);

const pipe = (...fns) => (x) =>
  fns.reduce((v, f) => f(v), x);

// 使用
const add1 = (x) => x + 1;
const double = (x) => x * 2;
const toString = (x) => String(x);

const transform = pipe(add1, double, toString);
console.log(transform(5)); // "12" (5+1=6, 6*2=12, "12")

const reverseTransform = compose(toString, double, add1);
console.log(reverseTransform(5)); // "12" (从右到左)

// 模式 2: 部分应用 (Partial Application)
function partial(fn, ...presetArgs) {
  return function (...laterArgs) {
    return fn(...presetArgs, ...laterArgs);
  };
}

function partialRight(fn, ...presetArgs) {
  return function (...laterArgs) {
    return fn(...laterArgs, ...presetArgs);
  };
}

// 使用
const add = (a, b, c) => a + b + c;
const add5 = partial(add, 5);
const add5And3 = partial(add5, 3);
console.log(add5And3(2)); // 10

const divideBy = partialRight(Math.pow, 2); // x^2
console.log(divideBy(3)); // 9

// 模式 3: Curry (柯里化)
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function (...moreArgs) {
      return curried.apply(this, args.concat(moreArgs));
    };
  };
}

// 使用
const sum = curry((a, b, c) => a + b + c);
console.log(sum(1)(2)(3)); // 6
console.log(sum(1, 2)(3)); // 6
console.log(sum(1)(2, 3)); // 6

// 模式 4: 函数记忆化 (Memoization) — 通用版
function memoize(fn, keyFn = JSON.stringify) {
  const cache = new Map();
  const cacheHits = { count: 0 };
  const cacheMisses = { count: 0 };

  const memoized = function (...args) {
    const key = keyFn(args);
    if (cache.has(key)) {
      cacheHits.count++;
      // LRU: 移到末尾
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    }
    cacheMisses.count++;
    const result = fn.apply(this, args);
    cache.set(key, result);

    // LRU 淘汰
    if (cache.size > 1000) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return result;
  };

  memoized.stats = () => ({
    size: cache.size,
    hits: cacheHits.count,
    misses: cacheMisses.count,
    ratio: cacheHits.count / (cacheHits.count + cacheMisses.count || 1),
  });

  memoized.clear = () => cache.clear();

  return memoized;
}

// 模式 5: 函数节流与防抖 — 通用版
function throttle(fn, interval, options = {}) {
  let lastCall = 0;
  let timer = null;
  const { leading = true, trailing = true } = options;

  return function (...args) {
    const now = Date.now();
    const remaining = interval - (now - lastCall);

    if (leading && now - lastCall >= interval) {
      lastCall = now;
      return fn.apply(this, args);
    }

    if (trailing && timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      lastCall = leading ? now : Date.now();
      timer = null;
      fn.apply(this, args);
    }, remaining);
  };
}

function debounce(fn, delay, options = {}) {
  let timer = null;
  const { leading = false, maxWait = null } = options;
  let leadingTimer = null;
  let maxTimer = null;

  const invokeFn = (args, thisArg) => {
    timer = null;
    if (leadingTimer) {
      clearTimeout(leadingTimer);
      leadingTimer = null;
    }
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = null;
    }
    return fn.apply(thisArg, args);
  };

  const debounced = function (...args) {
    const thisArg = this;

    if (leading && !timer) {
      leadingTimer = setTimeout(() => {
        leadingTimer = null;
      }, delay);
      return invokeFn(args, thisArg);
    }

    if (maxWait && !maxTimer) {
      maxTimer = setTimeout(() => {
        if (timer) {
          invokeFn(args, thisArg);
        }
      }, maxWait);
    }

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      invokeFn(args, thisArg);
    }, delay);
  };

  debounced.cancel = () => {
    clearTimeout(timer);
    clearTimeout(leadingTimer);
    clearTimeout(maxTimer);
    timer = leadingTimer = maxTimer = null;
  };

  debounced.flush = () => {
    if (timer) {
      return invokeFn([], this);
    }
  };

  return debounced;
}

// 模式 6: 函数管道 (Pipeline) — 带错误处理
function pipeline(...fns) {
  return async function (input) {
    let value = input;
    for (const fn of fns) {
      try {
        value = await fn(value);
      } catch (error) {
        // 错误传播: 可以在管道中捕获
        if (fn._catch) {
          value = await fn._catch(error, value);
        } else {
          throw error;
        }
      }
    }
    return value;
  };
}

// 使用
const processUser = pipeline(
  (data) => validate(data),
  (data) => sanitize(data),
  (data) => transform(data),
  (data) => saveToDB(data)
);

// 添加错误处理
processUser._catch = (error, value) => {
  console.error('Pipeline error:', error);
  return { error: true, value };
};
```

### 1.4 闭包在框架中的实际应用

```javascript
// React Hooks 的闭包实现原理 (简化版)
// React 用闭包实现 state 的持久化和更新

function createReactLikeHooks() {
  const hooks = [];
  let currentIndex = 0;

  function useState(initialValue) {
    const index = currentIndex;
    currentIndex++;

    if (!hooks[index]) {
      hooks[index] = { value: initialValue, setters: [] };
    }

    const state = hooks[index];

    const setState = (newValue) => {
      const resolved = typeof newValue === 'function'
        ? newValue(state.value)
        : newValue;

      if (Object.is(state.value, resolved)) return;

      state.value = resolved;
      // 通知所有 setter (简化)
      state.setters.forEach((s) => s(state.value));
    };

    return [state.value, setState];
  }

  function useEffect(callback, deps) {
    const index = currentIndex;
    currentIndex++;

    if (!hooks[index]) {
      hooks[index] = { deps: null, cleanup: null };
    }

    const hook = hooks[index];

    const hasChanged =
      !hook.deps || !deps || deps.some((d, i) => !Object.is(d, hook.deps[i]));

    if (hasChanged) {
      if (hook.cleanup) hook.cleanup();
      hook.cleanup = callback();
      hook.deps = deps;
    }
  }

  function useMemo(factory, deps) {
    const index = currentIndex;
    currentIndex++;

    if (!hooks[index]) {
      hooks[index] = { deps: null, value: null };
    }

    const hook = hooks[index];
    const hasChanged =
      !hook.deps || !deps || deps.some((d, i) => !Object.is(d, hook.deps[i]));

    if (hasChanged) {
      hook.value = factory();
      hook.deps = deps;
    }

    return hook.value;
  }

  return { useState, useEffect, useMemo, reset: () => { currentIndex = 0; } };
}

// 使用
const { useState, useEffect, useMemo, reset } = createReactLikeHooks();

function MyComponent() {
  reset(); // 模拟 React 的渲染周期

  const [count, setCount] = useState(0);
  const [name, setName] = useState('娄总');

  useEffect(() => {
    console.log(`count 变化为: ${count}`);
    return () => console.log('清理');
  }, [count]);

  const doubled = useMemo(() => count * 2, [count]);

  return { count, setCount, name, setName, doubled };
}

const component = MyComponent();
console.log(component.count); // 0
console.log(component.doubled); // 0

// 闭包陷阱: 过时的闭包 (Stale Closure)
function staleClosureDemo() {
  const [count, setCount] = useState(0);

  // ❌ 问题: setTimeout 中的闭包捕获了旧的 count
  setTimeout(() => {
    console.log(`3秒后 count = ${count}`); // 总是 0!
  }, 3000);

  return setCount;
}

// ✅ 修复 1: 使用函数式更新
// setCount(prev => prev + 1)

// ✅ 修复 2: 使用 ref 保存最新值
// const countRef = useRef(count);
// setTimeout(() => console.log(countRef.current), 3000);
```

---

## 二、原型 — 原型链完整模型

### 2.1 原型链的完整执行模型

```javascript
// ===== 理解原型链的核心概念 =====

// 1. 每个对象都有 [[Prototype]] (内部属性)
// 2. 通过 Object.getPrototypeOf(obj) 或 obj.__proto__ 访问
// 3. 原型链终点是 null

// ===== 三种创建对象的方式与原型链 =====

// 方式 1: 对象字面量
const obj1 = { name: 'Alice' };
// obj1.[[Prototype]] → Object.prototype → null

// 方式 2: 构造函数
function Person(name) {
  this.name = name;
}
const obj2 = new Person('Bob');
// obj2.[[Prototype]] → Person.prototype → Object.prototype → null

// 方式 3: Object.create
const proto = { greet() { return `Hello, ${this.name}`; } };
const obj3 = Object.create(proto);
obj3.name = 'Charlie';
// obj3.[[Prototype]] → proto → Object.prototype → null

// ===== 属性查找的完整流程 =====
function lookupProperty(obj, prop) {
  let current = obj;

  while (current !== null) {
    // 1. 检查 own property
    if (Object.prototype.hasOwnProperty.call(current, prop)) {
      // 2. 如果是 getter，绑定到原始对象
      const descriptor = Object.getOwnPropertyDescriptor(current, prop);
      if (descriptor.get) {
        return descriptor.get.call(obj);
      }
      return descriptor.value;
    }
    // 3. 沿原型链向上
    current = Object.getPrototypeOf(current);
  }

  return undefined;
}

// ===== 原型链 vs 作用域链 =====
// 原型链: 对象属性的查找链 (运行时)
// 作用域链: 变量的查找链 (编译时/词法)

// 示例: 两者的交互
const globalVar = 'global';

const parent = {
  protoProp: 'from prototype',
  accessVars() {
    // 可以访问:
    // 1. 自己的属性: this.protoProp
    // 2. 原型链: 通过原型链查找
    // 3. 作用域链: globalVar (词法作用域)
    return { protoProp: this.protoProp, globalVar };
  },
};

const child = Object.create(parent);
child.protoProp = 'overridden';

console.log(child.accessVars());
// protoProp: 'overridden' (原型链查找，找到 own property)
// globalVar: 'global' (作用域链查找，词法作用域)
```

### 2.2 原型链的性能优化

```javascript
// ===== 原型链查找的性能影响 =====

// 原型链越深，属性查找越慢
// 现代引擎通过内联缓存 (Inline Cache) 优化常见情况

// 最佳实践 1: 保持原型链浅
class DeepInheritance {
  // ❌ 过深的继承链
}
class Level1 extends DeepInheritance {}
class Level2 extends Level1 {}
class Level3 extends Level2 {}
class Level4 extends Level3 {}
class Level5 extends Level4 {}
// 5 层原型链: 属性查找需要最多 5 次查找

// ✅ 组合优于继承
function composeBehaviors(...behaviors) {
  return function (Base) {
    return class extends Base {
      constructor(...args) {
        super(...args);
        behaviors.forEach((b) => Object.assign(this, b(this)));
      }
    };
  };
}

// 最佳实践 2: 方法定义在原型上，不在构造函数中
class BadClass {
  constructor() {
    // ❌ 每个实例都有独立的方法副本
    this.method = function () {
      return 'method';
    };
  }
}

class GoodClass {
  // ✅ 所有实例共享同一个方法
  method() {
    return 'method';
  }
}

// 验证
const bad1 = new BadClass();
const bad2 = new BadClass();
console.log(bad1.method === bad2.method); // false (不同函数对象)

const good1 = new GoodClass();
const good2 = new GoodClass();
console.log(good1.method === good2.method); // true (共享原型方法)

// 最佳实践 3: 避免运行时修改原型链
class DynamicProto {
  constructor() {
    this.value = 42;
  }
}

// ❌ 运行时添加方法 → 破坏内联缓存
DynamicProto.prototype.newMethod = function () {};

// ✅ 在创建实例前定义所有方法
class StaticProto {
  constructor() {
    this.value = 42;
  }
  newMethod() {} // 在创建实例前定义
}
```

### 2.3 Object.create 深度与原型模式

```javascript
// ===== Object.create 的完整用法 =====

// 用法 1: 创建无原型对象 (纯净字典)
const pureDict = Object.create(null);
pureDict.name = 'Alice';
// pureDict 没有 toString, hasOwnProperty 等方法
// 适合做字典/映射，不会有原型污染

// 用法 2: 创建带指定原型的对象
const animalProto = {
  eat() {
    return `${this.name} is eating`;
  },
  sleep() {
    return `${this.name} is sleeping`;
  },
};

const dogProto = Object.create(animalProto, {
  name: { value: 'Dog', writable: true, configurable: true },
  bark: {
    value() {
      return `${this.name} says woof!`;
    },
    writable: true,
  },
});

const myDog = Object.create(dogProto);
myDog.name = 'Buddy';
console.log(myDog.bark()); // "Buddy says woof!"
console.log(myDog.eat()); // "Buddy is eating"
console.log(Object.getPrototypeOf(myDog) === dogProto); // true

// 用法 3: 实现经典继承模式
function inherit(Child, Parent) {
  Child.prototype = Object.create(Parent.prototype, {
    constructor: {
      value: Child,
      enumerable: false,
      writable: true,
      configurable: true,
    },
  });
  Object.setPrototypeOf(Child, Parent); // 静态方法继承
}

// 用法 4: 混入模式 (Mixin)
const Serializable = {
  toJSON() {
    const obj = {};
    for (const key of Object.keys(this)) {
      obj[key] = this[key];
    }
    return obj;
  },
  toString() {
    return JSON.stringify(this.toJSON());
  },
};

const Validateable = {
  validate(rules) {
    const errors = [];
    for (const [field, rule] of Object.entries(rules)) {
      if (!rule(this[field])) {
        errors.push(`Invalid ${field}`);
      }
    }
    return errors;
  },
};

function createEntity(data) {
  const proto = Object.assign(
    Object.create(Serializable),
    Validateable,
    data
  );
  return Object.create(proto);
}

const user = createEntity({
  name: '娄总',
  age: 25,
  email: 'lou@example.com',
});

console.log(user.toString()); // JSON
console.log(user.validate({
  name: (v) => v.length > 0,
  age: (v) => v > 0 && v < 150,
})); // []

// 用法 5: 原型链调试工具
function prototypeChain(obj) {
  const chain = [];
  let current = obj;
  while (current !== null) {
    chain.push({
      type: current.constructor?.name || 'null',
      ownKeys: Object.getOwnPropertyNames(current),
      symbols: Object.getOwnPropertySymbols(current),
    });
    current = Object.getPrototypeOf(current);
  }
  return chain;
}

class A {}
class B extends A {}
const b = new B();
console.log(prototypeChain(b));
// [
//   { type: 'B', ownKeys: [], symbols: [] },
//   { type: 'A', ownKeys: [], symbols: [] },
//   { type: 'Object', ownKeys: [...], symbols: [] },
//   { type: 'null', ownKeys: [], symbols: [] }
// ]
```

### 2.4 多态与鸭子类型

```javascript
// ===== JavaScript 的多态实现 =====

// 1. 基于原型的继承多态
class Shape {
  area() {
    throw new Error('Must implement area()');
  }
  perimeter() {
    throw new Error('Must implement perimeter()');
  }
}

class Circle extends Shape {
  constructor(radius) {
    super();
    this.radius = radius;
  }
  area() {
    return Math.PI * this.radius ** 2;
  }
  perimeter() {
    return 2 * Math.PI * this.radius;
  }
}

class Rectangle extends Shape {
  constructor(width, height) {
    super();
    this.width = width;
    this.height = height;
  }
  area() {
    return this.width * this.height;
  }
  perimeter() {
    return 2 * (this.width + this.height);
  }
}

// 多态调用
function printShapeInfo(shape) {
  console.log(`Area: ${shape.area().toFixed(2)}`);
  console.log(`Perimeter: ${shape.perimeter().toFixed(2)}`);
}

printShapeInfo(new Circle(5));
printShapeInfo(new Rectangle(3, 4));

// 2. 鸭子类型 (Duck Typing)
// "如果它走起来像鸭子，叫起来像鸭子，那它就是鸭子"

function isDrawable(obj) {
  return (
    typeof obj.draw === 'function' &&
    typeof obj.getBoundingBox === 'function'
  );
}

function renderAll(items) {
  for (const item of items) {
    if (isDrawable(item)) {
      item.draw();
    }
  }
}

// 不需要继承关系，只要有相同的方法就行
const triangle = {
  draw() {
    console.log('Drawing triangle');
  },
  getBoundingBox() {
    return { x: 0, y: 0, w: 100, h: 100 };
  },
};

const svgElement = {
  draw() {
    console.log('Rendering SVG');
  },
  getBoundingBox() {
    return { x: 0, y: 0, w: 200, h: 200 };
  },
};

renderAll([triangle, svgElement]); // 都能渲染

// 3. 结构化类型检查 (Structural Typing)
function ensureArrayLike(obj) {
  if (
    obj != null &&
    typeof obj.length === 'number' &&
    obj.length >= 0 &&
    Number.isInteger(obj.length)
  ) {
    return obj;
  }
  throw new TypeError('Not array-like');
}

// 数组、字符串、NodeList、arguments 都满足
console.log(ensureArrayLike('hello').length); // 5
console.log(ensureArrayLike({ length: 3, 0: 'a', 1: 'b', 2: 'c' }).length); // 3

// 4. 协议模式 (Protocol Pattern)
// 定义接口协议，实现者按需实现

const Protocol = {
  // 定义协议
  create(name, methods) {
    return {
      name,
      methods,
      satisfies(obj) {
        return this.methods.every((m) => typeof obj[m] === 'function');
      },
    };
  },
};

// 定义 Iterable 协议
const Iterable = Protocol.create('Iterable', [
  Symbol.iterator,
]);

// 定义 AsyncIterable 协议
const AsyncIterable = Protocol.create('AsyncIterable', [
  Symbol.asyncIterator,
]);

// 检查对象是否满足协议
function checkProtocol(obj, protocol) {
  if (protocol.satisfies(obj)) {
    console.log(`${obj.constructor?.name || 'object'} satisfies ${protocol.name}`);
    return true;
  }
  console.log(`${obj.constructor?.name || 'object'} does NOT satisfy ${protocol.name}`);
  return false;
}

checkProtocol([1, 2, 3], Iterable); // true
checkProtocol('hello', Iterable); // true
checkProtocol({}, Iterable); // false
```

---

## 三、异步 — 完整异步错误处理与并发控制

### 3.1 异步错误处理的完整体系

```javascript
// ===== 异步错误的五种传播模式 =====

// 模式 1: Promise 链中的错误传播
async function promiseChainError() {
  try {
    const result = await fetch('/api/data')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!data.items) throw new Error('Invalid response');
        return data.items;
      });
    return result;
  } catch (error) {
    // 捕获整个链中的所有错误
    console.error('Chain error:', error.message);
    throw error; // 重新抛出或返回默认值
  }
}

// 模式 2: 错误分类处理
class AppError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = this.constructor.name;
  }
}

class NetworkError extends AppError {
  constructor(message) {
    super(message, 'NETWORK_ERROR', 503);
  }
}

class ValidationError extends AppError {
  constructor(message, field) {
    super(message, 'VALIDATION_ERROR', 400);
    this.field = field;
  }
}

class BusinessError extends AppError {
  constructor(message, code) {
    super(message, code, 422);
  }
}

// 错误处理中间件
async function handleError(fn) {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof NetworkError) {
      return { ok: false, error: '网络错误，请稍后重试' };
    }
    if (error instanceof ValidationError) {
      return { ok: false, error: `参数错误: ${error.message}` };
    }
    if (error instanceof BusinessError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: '未知错误' };
  }
}

// 使用
const result = await handleError(async () => {
  const res = await fetch('/api/users');
  if (!res.ok) throw new NetworkError('请求失败');
  const data = await res.json();
  if (!data.email) throw new ValidationError('邮箱不能为空', 'email');
  return data;
});

// 模式 3: 错误恢复 (Error Recovery)
async function withRecovery(fn, fallback, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        // 最后一次失败，使用 fallback
        console.warn(`所有重试失败，使用 fallback`);
        return typeof fallback === 'function'
          ? await fallback(error)
          : fallback;
      }

      const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
      console.warn(`第 ${attempt} 次失败，${delay}ms 后重试`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// 使用: 带 fallback 的数据获取
const userData = await withRecovery(
  () => fetch('/api/user').then((r) => r.json()),
  async (error) => {
    // fallback: 从缓存读取
    const cached = localStorage.getItem('userCache');
    if (cached) return JSON.parse(cached);
    return { name: '匿名用户' };
  },
  3
);

// 模式 4: 错误上下文 (Error Context)
function withContext(error, context) {
  error.context = context;
  error.timestamp = Date.now();
  error.stack = `${error.stack}\nContext: ${JSON.stringify(context)}`;
  return error;
}

async function processWithTrace(fn, context) {
  try {
    return await fn();
  } catch (error) {
    throw withContext(error, context);
  }
}

// 模式 5: 全局错误处理
// 浏览器
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault(); // 阻止默认控制台输出
  console.error('未处理的 Promise 拒绝:', event.reason);
  // 上报错误
  reportError(event.reason);
});

// Node.js
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  // 在生产环境中，可能需要退出进程
  // process.exit(1);
});
```

### 3.2 并发控制模式大全

```javascript
// ===== 并发控制模式 =====

// 模式 1: 并发限制 (Concurrency Limiter)
class ConcurrencyLimiter {
  constructor(maxConcurrency) {
    this.max = maxConcurrency;
    this.running = 0;
    this.queue = [];
  }

  async run(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._process();
    });
  }

  _process() {
    while (this.running < this.max && this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();
      this.running++;

      Promise.resolve()
        .then(fn)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this._process();
        });
    }
  }

  get stats() {
    return {
      running: this.running,
      queued: this.queue.length,
      max: this.max,
    };
  }
}

// 使用: 限制并发请求数
const limiter = new ConcurrencyLimiter(5);

async function fetchWithLimit(url) {
  return limiter.run(() => fetch(url).then((r) => r.json()));
}

// 模式 2: 信号量 (Semaphore)
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.waiters = [];
  }

  async acquire() {
    if (this.current < this.max) {
      this.current++;
      return;
    }

    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  release() {
    if (this.waiters.length > 0) {
      const resolve = this.waiters.shift();
      resolve();
    } else {
      this.current--;
    }
  }

  async use(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

// 使用
const sem = new Semaphore(3);

async function limitedTask(id) {
  return sem.use(async () => {
    console.log(`Task ${id} started, concurrent: ${sem.current}`);
    await new Promise((r) => setTimeout(r, 1000));
    console.log(`Task ${id} finished`);
    return id;
  });
}

// 模式 3: 异步屏障 (Async Barrier)
class AsyncBarrier {
  constructor(count) {
    this.count = count;
    this.arrived = 0;
    this.resolve = null;
    this.promise = new Promise((r) => {
      this.resolve = r;
    });
  }

  async await() {
    this.arrived++;
    if (this.arrived >= this.count) {
      this.resolve();
      // 重置以便复用
      this.arrived = 0;
      this.promise = new Promise((r) => {
        this.resolve = r;
      });
    }
    return this.promise;
  }
}

// 使用: 等待多个异步操作到达同一点
const barrier = new AsyncBarrier(3);

async function worker(id) {
  console.log(`Worker ${id} working...`);
  await new Promise((r) => setTimeout(r, Math.random() * 2000));
  console.log(`Worker ${id} arrived at barrier`);
  await barrier.await();
  console.log(`Worker ${id} passed barrier`);
}

// 模式 4: 异步锁 (Async Lock)
class AsyncLock {
  constructor() {
    this.locked = false;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      resolve();
    } else {
      this.locked = false;
    }
  }

  async use(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  get isLocked() {
    return this.locked;
  }

  get queueLength() {
    return this.queue.length;
  }
}

// 使用: 保护共享资源
const lock = new AsyncLock();
let sharedCounter = 0;

async function safeIncrement() {
  return lock.use(async () => {
    const current = sharedCounter;
    await new Promise((r) => setTimeout(r, 10)); // 模拟异步
    sharedCounter = current + 1;
    return sharedCounter;
  });
}

// 模式 5: 异步读写锁 (Async ReadWriteLock)
class AsyncReadWriteLock {
  constructor() {
    this.readers = 0;
    this.writing = false;
    this.waiters = []; // { type: 'read'|'write', resolve }
  }

  async acquireRead() {
    if (!this.writing && this.waiters.length === 0) {
      this.readers++;
      return;
    }

    return new Promise((resolve) => {
      this.waiters.push({ type: 'read', resolve });
      this._dispatch();
    });
  }

  async acquireWrite() {
    if (this.readers === 0 && !this.writing && this.waiters.length === 0) {
      this.writing = true;
      return;
    }

    return new Promise((resolve) => {
      this.waiters.push({ type: 'write', resolve });
      this._dispatch();
    });
  }

  releaseRead() {
    this.readers--;
    this._dispatch();
  }

  releaseWrite() {
    this.writing = false;
    this._dispatch();
  }

  _dispatch() {
    if (this.writing || this.readers > 0) return;

    // 尝试释放等待者
    while (this.waiters.length > 0) {
      const next = this.waiters[0];
      if (next.type === 'write') {
        this.waiters.shift();
        this.writing = true;
        next.resolve();
        return;
      }
      // 释放所有连续的读等待者
      while (
        this.waiters.length > 0 &&
        this.waiters[0].type === 'read'
      ) {
        const reader = this.waiters.shift();
        this.readers++;
        reader.resolve();
      }
      return;
    }
  }
}

// 模式 6: 异步池 (Async Pool) — 带优先级
class AsyncPool {
  constructor(maxSize, options = {}) {
    this.maxSize = maxSize;
    this.active = 0;
    this.queue = []; // { fn, priority, resolve, reject, createdAt }
    this.onAcquire = options.onAcquire || null;
    this.onRelease = options.onRelease || null;
  }

  async execute(fn, priority = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn,
        priority,
        resolve,
        reject,
        createdAt: Date.now(),
      });
      // 按优先级排序 (高优先级在前)
      this.queue.sort((a, b) => b.priority - a.priority);
      this._process();
    });
  }

  _process() {
    while (this.active < this.maxSize && this.queue.length > 0) {
      const item = this.queue.shift();
      this.active++;

      if (this.onAcquire) this.onAcquire();

      Promise.resolve()
        .then(item.fn)
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this.active--;
          if (this.onRelease) this.onRelease();
          this._process();
        });
    }
  }

  get stats() {
    const totalWait = this.queue.reduce(
      (sum, item) => sum + (Date.now() - item.createdAt),
      0
    );
    return {
      active: this.active,
      queued: this.queue.length,
      max: this.maxSize,
      avgWait:
        this.queue.length > 0
          ? (totalWait / this.queue.length).toFixed(0)
          : 0,
    };
  }
}
```

### 3.3 异步状态机

```javascript
// ===== 异步状态机 (Async State Machine) =====
// 管理异步操作的完整生命周期

class AsyncStateMachine {
  constructor(initialState = 'idle') {
    this.state = initialState;
    this.data = null;
    this.error = null;
    this.listeners = new Set();
    this.history = [{ state: initialState, timestamp: Date.now() }];
  }

  // 状态转换
  transition(newState, data = null) {
    const validTransitions = {
      idle: ['loading', 'error'],
      loading: ['success', 'error', 'idle'],
      success: ['loading', 'idle'],
      error: ['loading', 'idle'],
    };

    const allowed = validTransitions[this.state] || [];
    if (!allowed.includes(newState)) {
      throw new Error(
        `Invalid transition: ${this.state} → ${newState}`
      );
    }

    const prevState = this.state;
    this.state = newState;
    this.data = newState === 'error' ? this.error : data;
    this.error = newState === 'error' ? data : null;

    this.history.push({
      state: newState,
      prev: prevState,
      timestamp: Date.now(),
    });

    // 通知监听者
    for (const listener of this.listeners) {
      try {
        listener({
          state: this.state,
          data: this.data,
          error: this.error,
          prev: prevState,
        });
      } catch (e) {
        console.error('Listener error:', e);
      }
    }
  }

  // 便捷方法
  loading() {
    this.transition('loading');
  }

  success(data) {
    this.transition('success', data);
  }

  error(err) {
    this.transition('error', err);
  }

  idle() {
    this.transition('idle');
  }

  // 执行异步操作 (自动管理状态)
  async execute(fn) {
    this.loading();
    try {
      const result = await fn();
      this.success(result);
      return result;
    } catch (error) {
      this.error(error);
      throw error;
    }
  }

  // 监听状态变化
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // 等待特定状态
  async waitFor(state, timeout = 10000) {
    if (this.state === state) return this.data;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timeout waiting for state: ${state}`));
      }, timeout);

      const unsubscribe = this.onChange((event) => {
        if (event.state === state) {
          clearTimeout(timer);
          unsubscribe();
          resolve(event.data);
        }
        if (event.state === 'error') {
          clearTimeout(timer);
          unsubscribe();
          reject(event.error);
        }
      });
    });
  }

  // 获取快照
  get snapshot() {
    return {
      state: this.state,
      data: this.data,
      error: this.error,
      history: this.history,
    };
  }
}

// 使用: 数据加载状态机
const loadState = new AsyncStateMachine();

// 监听
loadState.onChange((event) => {
  console.log(`状态变化: ${event.prev} → ${event.state}`);
  if (event.state === 'success') {
    console.log('数据:', event.data);
  }
  if (event.state === 'error') {
    console.error('错误:', event.error.message);
  }
});

// 执行
async function loadData() {
  return loadState.execute(async () => {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
}

// 等待特定状态
const data = await loadState.waitFor('success', 5000);

// 使用: 表单提交状态机
const formState = new AsyncStateMachine();

async function submitForm(formData) {
  return formState.execute(async () => {
    const res = await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    if (!res.ok) throw new Error('提交失败');
    return res.json();
  });
}
```

---

## 四、事件循环 — 浏览器 vs Node.js 完整对比

### 4.1 浏览器事件循环完整模型

```javascript
// ===== 浏览器事件循环的完整流程 =====

// 1. 执行同步代码 (调用栈清空)
// 2. 执行所有微任务 (直到清空)
// 3. 检查渲染需求 (requestAnimationFrame → 布局 → 绘制)
// 4. 执行一个宏任务
// 5. 重复 2-4

// ===== 微任务队列 vs 宏任务队列 =====

// 微任务 (Microtask):
// - Promise.then/catch/finally
// - queueMicrotask()
// - MutationObserver
// - 特点: 在当前宏任务结束后、渲染前全部执行

// 宏任务 (Macrotask):
// - setTimeout/setInterval
// - requestAnimationFrame (特殊: 在微任务之后、渲染之前)
// - I/O
// - UI 事件
// - MessageChannel
// - 特点: 每次只执行一个，然后检查微任务

// ===== 完整执行顺序示例 =====

console.log('1. 同步代码开始'); // 同步

Promise.resolve().then(() => console.log('2. 微任务 1')); // 微任务

setTimeout(() => console.log('3. 宏任务 setTimeout'), 0); // 宏任务

queueMicrotask(() => console.log('4. 微任务 queueMicrotask')); // 微任务

Promise.resolve().then(() => {
  console.log('5. 微任务 2');
  queueMicrotask(() => console.log('6. 嵌套微任务')); // 微任务中添加微任务
});

console.log('7. 同步代码结束'); // 同步

// 输出:
// 1. 同步代码开始
// 7. 同步代码结束
// 2. 微任务 1
// 4. 微任务 queueMicrotask
// 5. 微任务 2
// 6. 嵌套微任务
// 3. 宏任务 setTimeout

// ===== requestAnimationFrame 的特殊位置 =====
// rAF 在微任务之后、渲染之前执行

function renderCycleDemo() {
  console.log('同步代码');

  Promise.resolve().then(() => console.log('微任务'));

  requestAnimationFrame(() => console.log('rAF (渲染前)'));

  setTimeout(() => console.log('宏任务 setTimeout'), 0);

  // 执行顺序:
  // 1. 同步代码
  // 2. 微任务
  // 3. rAF (渲染前)
  // 4. 渲染
  // 5. 宏任务 setTimeout
}

// ===== 微任务风暴 (Microtask Storm) =====
// 危险: 微任务可以无限添加微任务，阻塞渲染

function microtaskStorm() {
  let count = 0;
  function tick() {
    queueMicrotask(() => {
      count++;
      if (count < 10000) {
        tick(); // 持续添加微任务
      } else {
        console.log(`执行了 ${count} 个微任务`);
      }
    });
  }
  tick();
  // 这会导致:
  // - 浏览器 UI 完全无响应
  // - 渲染被阻塞
  // - setTimeout 回调无法执行
  // - 用户交互无响应
}

// 安全替代: 使用 setTimeout 或 requestIdleCallback
function safeYield() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function safeLoop(iterations) {
  for (let i = 0; i < iterations; i++) {
    // 每 100 次让出控制权
    if (i % 100 === 0) {
      await safeYield();
    }
    // 执行工作
  }
}
```

### 4.2 Node.js 事件循环完整模型

```javascript
// ===== Node.js 事件循环 vs 浏览器事件循环 =====

// 浏览器:
// 同步代码 → 微任务 → 渲染 → 宏任务 → 微任务 → 渲染 → ...

// Node.js:
// 同步代码 → 微任务 → timers → pending → idle → poll → check → close → 微任务 → ...

// ===== Node.js 事件循环的 6 个阶段 =====

// 1. timers: setTimeout/setInterval 回调
// 2. pending callbacks: 系统操作回调 (如 TCP 错误)
// 3. idle, prepare: 内部使用
// 4. poll: I/O 回调，最重要的阶段
// 5. check: setImmediate 回调
// 6. close callbacks: 关闭回调 (如 socket.on('close'))

// ===== 关键区别: process.nextTick =====

// process.nextTick 不在事件循环的任何阶段中
// 它在当前操作完成后、下一阶段开始前执行
// 优先级: process.nextTick > Promise.then > setImmediate

console.log('1. 同步');

process.nextTick(() => console.log('2. nextTick'));

Promise.resolve().then(() => console.log('3. Promise'));

setImmediate(() => console.log('4. setImmediate'));

setTimeout(() => console.log('5. setTimeout'), 0);

// 输出:
// 1. 同步
// 2. nextTick (最高优先级)
// 3. Promise (微任务)
// 5. setTimeout (timers 阶段)
// 4. setImmediate (check 阶段)

// ===== setTimeout vs setImmediate 的顺序 =====

// 在脚本顶层:
// setTimeout(() => {}, 0) 和 setImmediate() 的顺序不确定
// 取决于事件循环的当前阶段

// 但在 I/O 回调中，顺序是确定的:
const fs = require('fs'); // Node.js 环境

// fs.readFile 的回调在 poll 阶段执行
// 在 poll 阶段中设置 setTimeout 和 setImmediate:
// - setTimeout 在下一个 timers 阶段执行
// - setImmediate 在同一个循环的 check 阶段执行
// 所以 setImmediate 先执行

// ===== Node.js 中的微任务 =====

// Node.js 有两类微任务:
// 1. next tick queue: process.nextTick()
// 2. microtask queue: Promise.then, queueMicrotask

// 执行顺序:
// next tick queue > microtask queue

// 每个事件循环阶段之间:
// 1. 清空 next tick queue
// 2. 清空 microtask queue
// 3. 进入下一阶段

// ===== Node.js 事件循环调试 =====

// 使用 --trace-events-enabled 和 async_hooks 追踪
const asyncHooks = require('async_hooks');

const hook = asyncHooks.createHook({
  init(asyncId, type, triggerAsyncId, resource) {
    // console.log(`init: ${type} (id: ${asyncId}, trigger: ${triggerAsyncId})`);
  },
  before(asyncId) {
    // console.log(`before: ${asyncId}`);
  },
  after(asyncId) {
    // console.log(`after: ${asyncId}`);
  },
  destroy(asyncId) {
    // console.log(`destroy: ${asyncId}`);
  },
});

// hook.enable(); // 启用追踪

// ===== 性能影响 =====

// process.nextTick 过多会导致:
// - 事件循环被阻塞 (无法进入下一阶段)
// - I/O 操作被延迟
// - setTimeout 回调无法执行

// 安全使用:
function safeNextTick(fn) {
  let depth = 0;
  const maxDepth = 1000;

  function tick() {
    if (depth > maxDepth) {
      // 让出控制权
      setImmediate(tick);
      return;
    }
    depth++;
    process.nextTick(() => {
      fn();
      depth--;
    });
  }

  tick();
}
```

### 4.3 性能调优实战

```javascript
// ===== 事件循环性能调优 =====

// 工具 1: 测量事件循环延迟
class EventLoopDelay {
  constructor() {
    this.delays = [];
    this.running = false;
  }

  start(interval = 100) {
    this.running = true;
    let last = performance.now();

    const measure = () => {
      if (!this.running) return;

      const now = performance.now();
      const delay = now - last - interval;
      this.delays.push(delay);

      // 保持最近 1000 个样本
      if (this.delays.length > 1000) {
        this.delays.shift();
      }

      last = now;
      setTimeout(measure, interval);
    };

    measure();
  }

  stop() {
    this.running = false;
  }

  get stats() {
    if (this.delays.length === 0) return null;

    const sorted = [...this.delays].sort((a, b) => a - b);
    return {
      count: sorted.length,
      min: sorted[0].toFixed(2),
      max: sorted[sorted.length - 1].toFixed(2),
      avg: (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2),
      p50: sorted[Math.floor(sorted.length * 0.5)].toFixed(2),
      p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
      p99: sorted[Math.floor(sorted.length * 0.99)].toFixed(2),
    };
  }
}

// 工具 2: 长任务检测
class LongTaskDetector {
  constructor(threshold = 50) {
    this.threshold = threshold;
    this.tasks = [];
    this.observer = null;
  }

  start() {
    if (typeof PerformanceObserver !== 'undefined') {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.tasks.push({
            duration: entry.duration,
            start: entry.startTime,
            name: entry.name,
          });
        }
      });
      this.observer.observe({ entryTypes: ['longtask'] });
    }
  }

  stop() {
    this.observer?.disconnect();
  }

  get report() {
    return {
      total: this.tasks.length,
      tasks: this.tasks.map((t) => ({
        duration: `${t.duration.toFixed(1)}ms`,
        start: `${t.start.toFixed(1)}ms`,
      })),
    };
  }
}

// 工具 3: 任务分割 (Task Chunking)
function chunkTasks(tasks, chunkSize = 50, yieldInterval = 50) {
  return new Promise((resolve) => {
    let index = 0;
    const results = [];

    function processChunk() {
      const end = Math.min(index + chunkSize, tasks.length);

      for (let i = index; i < end; i++) {
        results.push(tasks[i]());
      }

      index = end;

      if (index < tasks.length) {
        // 让出控制权
        if (index % yieldInterval === 0) {
          setTimeout(processChunk, 0);
        } else {
          processChunk();
        }
      } else {
        resolve(results);
      }
    }

    processChunk();
  });
}

// 使用: 处理大量数据不阻塞 UI
async function processLargeDataset(data) {
  const tasks = data.map((item) => () => processItem(item));
  const results = await chunkTasks(tasks, 100, 100);
  return results;
}

// 工具 4: 空闲时间利用 (requestIdleCallback)
function scheduleIdleWork(fn, deadline = 50) {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(
      (idleDeadline) => {
        while (idleDeadline.timeRemaining() > 1 && fn()) {
          // 继续执行
        }
      },
      { timeout: 1000 }
    );
  } else {
    // fallback
    setTimeout(fn, 0);
  }
}

// 使用: 在空闲时间执行低优先级任务
scheduleIdleWork(() => {
  // 预加载、数据分析、缓存预热等
  preloadNextPage();
  return true; // 返回 true 继续，false 停止
});
```

---

## 五、综合实战 — 终极整合

### 5.1 完整的事件驱动微前端框架

```javascript
// ===== 微前端框架核心 (闭包 + 原型 + 异步 + 事件循环) =====

class MicroFrontendFramework {
  #apps = new Map(); // 闭包私有字段
  #eventBus = new EventBus(); // 事件总线
  #router = null;
  #loading = new Set();
  #errorHandlers = new Set();
  #scheduler = new AsyncTaskScheduler({ concurrency: 3 });

  constructor(options = {}) {
    this.#apps = new Map();
    this.#container = options.container || document.body;
    this.#errorBoundary = options.errorBoundary || this.#defaultErrorBoundary;
  }

  // 注册应用
  register(name, config) {
    if (this.#apps.has(name)) {
      throw new Error(`App "${name}" already registered`);
    }

    const app = {
      name,
      config,
      state: 'inactive',
      instance: null,
      container: null,
      error: null,
      loadTime: null,
    };

    this.#apps.set(name, app);
    this.#eventBus.emit('app:registered', { name, config });

    return this;
  }

  // 加载应用 (异步 + 错误处理)
  async loadApp(name) {
    const app = this.#apps.get(name);
    if (!app) throw new Error(`App "${name}" not found`);
    if (app.state === 'active') return app.instance;
    if (this.#loading.has(name)) {
      // 等待加载完成
      return new Promise((resolve, reject) => {
        const unsub = this.#eventBus.on(`app:${name}:loaded`, ({ instance }) => {
          unsub();
          resolve(instance);
        });
        this.#eventBus.on(`app:${name}:error`, (error) => {
          unsub();
          reject(error);
        });
      });
    }

    this.#loading.add(name);
    app.state = 'loading';
    this.#eventBus.emit('app:loading', { name });

    try {
      const startTime = performance.now();

      // 使用 TaskGroup 实现结构化并发
      const group = new TaskGroup();

      // 加载模块
      const modulePromise = group.spawn(async (signal) => {
        if (app.config.module) {
          return app.config.module;
        }
        const res = await fetch(app.config.url, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return this.#evalModule(text, app.config);
      });

      // 创建容器
      const containerPromise = group.spawn(async () => {
        const container = document.createElement('div');
        container.id = `app-${name}`;
        container.className = 'micro-frontend-app';
        container.style.cssText = app.config.style || '';
        this.#container.appendChild(container);
        return container;
      });

      const [module, container] = await Promise.all([
        modulePromise,
        containerPromise,
      ]);

      // 挂载
      const instance = await this.#mount(app, module, container);

      app.state = 'active';
      app.instance = instance;
      app.container = container;
      app.loadTime = performance.now() - startTime;

      this.#loading.delete(name);
      this.#eventBus.emit('app:loaded', { name, instance, loadTime: app.loadTime });

      return instance;
    } catch (error) {
      app.state = 'error';
      app.error = error;
      this.#loading.delete(name);
      this.#eventBus.emit('app:error', { name, error });
      this.#errorHandlers.forEach((handler) => handler(error, name));
      throw error;
    }
  }

  // 卸载应用
  async unloadApp(name) {
    const app = this.#apps.get(name);
    if (!app || app.state !== 'active') return;

    try {
      await app.instance?.unmount?.();
    } catch (e) {
      console.warn(`Error unmounting ${name}:`, e);
    }

    app.container?.remove();
    app.state = 'inactive';
    app.instance = null;
    app.container = null;

    this.#eventBus.emit('app:unloaded', { name });
  }

  // 路由管理
  setRouter(router) {
    this.#router = router;

    // 监听路由变化
    window.addEventListener('popstate', () => {
      this.#handleRouteChange();
    });

    return this;
  }

  async #handleRouteChange() {
    if (!this.#router) return;

    const route = this.#router.match(window.location.pathname);
    if (!route) return;

    // 卸载不在路由中的应用
    for (const [name, app] of this.#apps) {
      if (app.state === 'active' && !route.apps.includes(name)) {
        await this.unloadApp(name);
      }
    }

    // 加载路由中的应用
    for (const appName of route.apps) {
      if (!this.#apps.get(appName)?.instance) {
        try {
          await this.loadApp(appName);
        } catch (e) {
          console.error(`Failed to load ${appName}:`, e);
        }
      }
    }
  }

  // 模块评估
  #evalModule(code, config) {
    const exports = {};
    const module = { exports };

    // 沙箱执行
    const fn = new Function(
      'exports',
      'module',
      'require',
      'console',
      'Promise',
      'fetch',
      code
    );

    fn(exports, module, this.#createRequire(config), console, Promise, fetch);

    return module.exports;
  }

  #createRequire(config) {
    return (name) => {
      // 简化的 require
      if (config.dependencies?.[name]) {
        return config.dependencies[name];
      }
      throw new Error(`Module "${name}" not found`);
    };
  }

  // 挂载
  async #mount(app, module, container) {
    const mount = module.default?.mount || module.mount;
    if (!mount) throw new Error(`App "${app.name}" has no mount function`);

    const instance = await mount(container, {
      name: app.name,
      eventBus: this.#eventBus,
      config: app.config,
    });

    return instance;
  }

  #defaultErrorBoundary(error, name) {
    console.error(`App "${name}" error:`, error);
  }

  // 错误处理
  onError(handler) {
    this.#errorHandlers.add(handler);
    return () => this.#errorHandlers.delete(handler);
  }

  // 状态查询
  getStatus() {
    const status = {};
    for (const [name, app] of this.#apps) {
      status[name] = {
        state: app.state,
        loadTime: app.loadTime,
        error: app.error?.message || null,
      };
    }
    return status;
  }

  // 批量操作
  async loadAll(appNames) {
    const group = new TaskGroup();

    for (const name of appNames) {
      group.spawn(async () => {
        try {
          await this.loadApp(name);
          return { name, status: 'ok' };
        } catch (error) {
          return { name, status: 'error', error: error.message };
        }
      });
    }

    return group.allSettled();
  }
}

// EventBus 实现 (闭包模式)
function EventBus() {
  const listeners = new Map();
  const wildcardListeners = new Set();

  return Object.freeze({
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => this.off(event, fn);
    },

    once(event, fn) {
      const wrapper = (...args) => {
        fn(...args);
        this.off(event, wrapper);
      };
      return this.on(event, wrapper);
    },

    off(event, fn) {
      const fns = listeners.get(event);
      if (fns) fns.delete(fn);
    },

    emit(event, ...args) {
      const fns = listeners.get(event);
      if (fns) {
        for (const fn of fns) {
          try {
            fn(...args);
          } catch (e) {
            console.error(`EventBus error in "${event}":`, e);
          }
        }
      }
      for (const fn of wildcardListeners) {
        try {
          fn(event, ...args);
        } catch (e) {
          console.error(`EventBus wildcard error:`, e);
        }
      }
    },

    onWildcard(fn) {
      wildcardListeners.add(fn);
      return () => wildcardListeners.delete(fn);
    },
  });
}
```

### 5.2 面试深度题

```javascript
// ===== 高频面试题深度解析 =====

// 题 1: 实现一个支持取消的 Promise
function cancellablePromise(executor) {
  let isCancelled = false;
  let cancelReason = null;

  const promise = new Promise((resolve, reject) => {
    return executor(
      (value) => {
        if (isCancelled) return;
        resolve(value);
      },
      (reason) => {
        if (isCancelled) return;
        reject(reason);
      }
    );
  });

  promise.cancel = (reason = 'Cancelled') => {
    isCancelled = true;
    cancelReason = reason;
    reject(new DOMException(reason, 'AbortError'));
  };

  return promise;
}

// 使用
const req = cancellablePromise((resolve, reject) => {
  fetch('/api/data')
    .then((r) => r.json())
    .then(resolve)
    .catch(reject);
});

setTimeout(() => req.cancel('用户取消'), 1000);

// 题 2: 实现 Promise.all 的 polyfill
Promise.allPolyfill = function (iterable) {
  return new Promise((resolve, reject) => {
    const results = [];
    let remaining = 0;
    let hasRejected = false;

    const items = Array.from(iterable);

    if (items.length === 0) {
      resolve([]);
      return;
    }

    items.forEach((item, index) => {
      remaining++;
      Promise.resolve(item)
        .then((value) => {
          if (hasRejected) return;
          results[index] = value;
          remaining--;
          if (remaining === 0) resolve(results);
        })
        .catch((error) => {
          if (hasRejected) return;
          hasRejected = true;
          reject(error);
        });
    });
  });
};

// 题 3: 实现 Promise.race 的 polyfill
Promise.racePolyfill = function (iterable) {
  return new Promise((resolve, reject) => {
    for (const item of iterable) {
      Promise.resolve(item).then(resolve, reject);
    }
  });
};

// 题 4: 实现 Promise.any 的 polyfill
Promise.anyPolyfill = function (iterable) {
  return new Promise((resolve, reject) => {
    const errors = [];
    let remaining = 0;

    const items = Array.from(iterable);
    if (items.length === 0) {
      reject(new AggregateError([], 'All promises were empty'));
      return;
    }

    items.forEach((item, index) => {
      remaining++;
      Promise.resolve(item)
        .then(resolve) // 任何一个 resolve 就立即 resolve
        .catch((error) => {
          errors[index] = error;
          remaining--;
          if (remaining === 0) {
            reject(new AggregateError(errors, 'All promises were rejected'));
          }
        });
    });
  });
};

// 题 5: 实现 EventEmitter
class EventEmitter {
  #events = new Map();
  #onceEvents = new Map();

  on(event, listener) {
    if (!this.#events.has(event)) {
      this.#events.set(event, new Set());
    }
    this.#events.get(event).add(listener);
    return this;
  }

  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    wrapper._listener = listener;
    this.on(event, wrapper);
    return this;
  }

  off(event, listener) {
    const listeners = this.#events.get(event);
    if (!listeners) return this;

    // 移除原始 listener 和对应的 once wrapper
    listeners.delete(listener);
    for (const l of listeners) {
      if (l._listener === listener) {
        listeners.delete(l);
      }
    }

    return this;
  }

  emit(event, ...args) {
    const listeners = this.#events.get(event);
    if (!listeners) return false;

    // 复制一份防止在回调中修改
    const listenersCopy = new Set(listeners);
    for (const listener of listenersCopy) {
      listener(...args);
    }

    return true;
  }

  removeAllListeners(event) {
    if (event) {
      this.#events.delete(event);
    } else {
      this.#events.clear();
    }
    return this;
  }

  listenerCount(event) {
    return this.#events.get(event)?.size || 0;
  }

  eventNames() {
    return [...this.#events.keys()];
  }
}

// 题 6: 实现深拷贝 (处理循环引用)
function deepClone(obj, visited = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj;

  // 处理循环引用
  if (visited.has(obj)) return visited.get(obj);

  // 处理特殊类型
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof RegExp)
    return new RegExp(obj.source, obj.flags);
  if (obj instanceof Map) {
    const result = new Map();
    visited.set(obj, result);
    for (const [key, value] of obj) {
      result.set(key, deepClone(value, visited));
    }
    return result;
  }
  if (obj instanceof Set) {
    const result = new Set();
    visited.set(obj, value);
    for (const value of obj) {
      result.add(deepClone(value, visited));
    }
    return result;
  }
  if (obj instanceof ArrayBuffer) {
    return obj.slice(0);
  }
  if (obj instanceof DataView) {
    return new DataView(obj.buffer.slice(0));
  }

  // 处理数组和普通对象
  const result = Array.isArray(obj) ? [] : Object.create(Object.getPrototypeOf(obj));
  visited.set(obj, result);

  for (const key of Reflect.ownKeys(obj)) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
    if (descriptor.get || descriptor.set) {
      Object.defineProperty(result, key, descriptor);
    } else {
      result[key] = deepClone(obj[key], visited);
    }
  }

  return result;
}

// 题 7: 实现 new 操作符
function myNew(Constructor, ...args) {
  // 1. 创建空对象，原型指向构造函数的 prototype
  const obj = Object.create(Constructor.prototype);

  // 2. 绑定 this 并执行构造函数
  const result = Constructor.apply(obj, args);

  // 3. 如果构造函数返回对象，则返回该对象
  if (result !== null && (typeof result === 'object' || typeof result === 'function')) {
    return result;
  }

  // 4. 否则返回新对象
  return obj;
}

// 题 8: 实现 instanceof
function myInstanceof(obj, Constructor) {
  if (obj === null || typeof obj !== 'object') return false;

  let proto = Object.getPrototypeOf(obj);
  const prototype = Constructor.prototype;

  while (proto !== null) {
    if (proto === prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }

  return false;
}

// 题 9: 实现 bind
function myBind(fn, thisArg, ...boundArgs) {
  if (typeof fn !== 'function') {
    throw new TypeError('Bind must be called on a function');
  }

  const bound = function (...callArgs) {
    // 如果作为构造函数调用，this 指向新对象
    if (new.target) {
      return new fn(...boundArgs, ...callArgs);
    }
    // 否则绑定到指定 this
    return fn.apply(thisArg, [...boundArgs, ...callArgs]);
  };

  // 保持原型链
  bound.prototype = Object.create(fn.prototype);

  return bound;
}

// 题 10: 实现 call 和 apply
function myCall(fn, thisArg, ...args) {
  if (typeof fn !== 'function') {
    throw new TypeError('Call must be called on a function');
  }

  thisArg = thisArg ?? globalThis;
  const key = Symbol('call');
  thisArg[key] = fn;
  const result = thisArg[key](...args);
  delete thisArg[key];
  return result;
}

function myApply(fn, thisArg, args) {
  if (typeof fn !== 'function') {
    throw new TypeError('Apply must be called on a function');
  }

  thisArg = thisArg ?? globalThis;
  const key = Symbol('apply');
  thisArg[key] = fn;
  const result = args ? thisArg[key](...args) : thisArg[key]();
  delete thisArg[key];
  return result;
}
```

---

## 六、v9 核心要点总结

### 闭包 (Closure) — 终极理解
1. **执行上下文模型** — LexicalEnvironment + outer 引用 = 闭包本质
2. **内存分析** — 闭包持有整个词法环境，需手动释放或缩小范围
3. **高阶函数** — compose/pipe/curry/partial/memoize/throttle/debounce
4. **框架应用** — React Hooks 的闭包实现、过时闭包陷阱
5. **实战** — 事件总线、模块模式、依赖注入

### 原型 (Prototype) — 终极理解
1. **原型链模型** — [[Prototype]] → 属性查找流程 → 内联缓存
2. **性能优化** — 浅原型链、原型方法、避免运行时修改
3. **Object.create** — 纯净字典、继承实现、Mixin 模式
4. **多态** — 基于原型的继承多态、鸭子类型、协议模式
5. **调试** — prototypeChain 工具、原型链可视化

### 异步 (Async) — 终极理解
1. **错误处理** — 错误分类、错误恢复、错误上下文、全局处理
2. **并发控制** — Limiter/Semaphore/Barrier/Lock/ReadWriteLock/Pool
3. **状态机** — AsyncStateMachine 管理完整生命周期
4. **结构化并发** — TaskGroup + AbortController
5. **实战** — 带重试/超时/优先级的任务调度

### 事件循环 (Event Loop) — 终极理解
1. **浏览器模型** — 同步→微任务→渲染→宏任务循环
2. **Node.js 模型** — 6 阶段 + process.nextTick 特殊位置
3. **性能调优** — 延迟测量、长任务检测、任务分割、空闲利用
4. **微任务风暴** — 危险识别与安全替代方案
5. **对比** — 浏览器 vs Node.js 的关键差异

---

**v9 完成。** 第 9 轮迭代作为阶段性总结，覆盖：
- 闭包的作用域链完整模型 + 内存分析 + 高阶函数式编程 + 框架应用
- 原型的完整执行模型 + 性能优化 + Object.create 深度 + 多态与鸭子类型
- 异步的完整错误处理体系 + 6 种并发控制模式 + 异步状态机
- 事件循环的浏览器 vs Node.js 完整对比 + 性能调优实战 + 10 道面试深度题

**至此，JavaScript.info 第 5-7 章 (闭包/原型/异步/事件循环) 的 9 轮迭代训练全部完成。**
