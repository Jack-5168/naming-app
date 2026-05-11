# 函数式编程实战 - 21:00

**时间:** 2026-04-23 21:00  
**内容:** JavaScript 函数式编程核心概念与实践  
**重点:** 纯函数 + 高阶函数 + 函数组合

---

## 一、纯函数 (Pure Functions)

### 概念
纯函数是指：
1. 相同的输入永远返回相同的输出
2. 不产生任何副作用（不修改外部状态、不进行 I/O 操作）

### 纯函数示例

```javascript
// ✅ 纯函数
function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

// ❌ 非纯函数（依赖外部状态）
let taxRate = 0.1;
function calculateTax(price) {
  return price * taxRate; // 依赖外部变量
}

// ❌ 非纯函数（产生副作用）
function logAndAdd(a, b) {
  console.log('Adding:', a, b); // 副作用：I/O
  return a + b;
}
```

### 纯函数的优势
- **可测试性**: 无需 mock 外部依赖
- **可缓存**: 相同输入可缓存结果（memoization）
- **可并行**: 无副作用，可安全并行执行
- **可推理**: 代码更易理解和维护

---

## 二、高阶函数 (Higher-Order Functions)

### 概念
高阶函数是指：
1. 接收一个或多个函数作为参数
2. 或者返回一个函数

### 经典高阶函数

```javascript
// 1. map - 映射
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log(doubled); // [2, 4, 6, 8, 10]

// 2. filter - 过滤
const evens = numbers.filter(n => n % 2 === 0);
console.log(evens); // [2, 4]

// 3. reduce - 归约
const sum = numbers.reduce((acc, n) => acc + n, 0);
console.log(sum); // 15

// 4. forEach - 遍历（注意：forEach 通常用于副作用）
numbers.forEach(n => console.log(n));
```

### 自定义高阶函数

```javascript
// 函数工厂：创建加法器
function createAdder(x) {
  return function(y) {
    return x + y;
  };
}

const add5 = createAdder(5);
console.log(add5(10)); // 15
console.log(add5(20)); // 25

// 函数工厂：创建比较器
function createComparator(key) {
  return function(a, b) {
    return a[key] - b[key];
  };
}

const users = [
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 30 },
  { name: 'Charlie', age: 20 }
];

users.sort(createComparator('age'));
console.log(users); // 按年龄排序
```

---

## 三、柯里化 (Currying)

### 概念
将接收多个参数的函数转换为接收单一参数的函数，并返回接收剩余参数的新函数。

### 实现

```javascript
// 基础柯里化
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    } else {
      return function(...moreArgs) {
        return curried.apply(this, args.concat(moreArgs));
      };
    }
  };
}

// 使用示例
function add(a, b, c) {
  return a + b + c;
}

const curriedAdd = curry(add);
console.log(curriedAdd(1)(2)(3)); // 6
console.log(curriedAdd(1, 2)(3)); // 6
console.log(curriedAdd(1)(2, 3)); // 6
console.log(curriedAdd(1, 2, 3)); // 6
```

### 柯里化实战

```javascript
// 日志记录器
function log(level) {
  return function(message) {
    return function(timestamp) {
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    };
  };
}

const errorLog = log('error');
const dbErrorLog = errorLog('Database connection failed');
dbErrorLog('2026-04-23 21:00'); // [2026-04-23 21:00] [ERROR] Database connection failed

// 路径拼接
function joinPath(separator) {
  return function(...parts) {
    return parts.join(separator);
  };
}

const unixPath = joinPath('/');
const windowsPath = joinPath('\\');

console.log(unixPath('home', 'user', 'documents')); // home/user/documents
console.log(windowsPath('C:', 'Users', 'Documents')); // C:\Users\Documents
```

---

## 四、函数组合 (Function Composition)

### 概念
将多个函数组合成一个新的函数，数据从右向左流动（或从左向右，取决于实现）。

### 实现

```javascript
// compose: 从右向左组合
function compose(...fns) {
  return function(x) {
    return fns.reduceRight((acc, fn) => fn(acc), x);
  };
}

// pipe: 从左向右组合（更易读）
function pipe(...fns) {
  return function(x) {
    return fns.reduce((acc, fn) => fn(acc), x);
  };
}

// 辅助函数
const double = x => x * 2;
const add10 = x => x + 10;
const square = x => x * x;

// 使用 compose: square(add10(double(x)))
const transform1 = compose(square, add10, double);
console.log(transform1(5)); // (5*2+10)^2 = 400

// 使用 pipe: square(add10(double(x))) - 更易读
const transform2 = pipe(double, add10, square);
console.log(transform2(5)); // 400
```

### 实战：数据处理管道

```javascript
// 数据处理函数
const trim = str => str.trim();
const toLowerCase = str => str.toLowerCase();
const removeSpecialChars = str => str.replace(/[^a-z0-9\s]/g, '');
const splitWords = str => str.split(/\s+/);
const filterShortWords = words => words.filter(word => word.length > 2);

// 组合成文本处理管道
const processText = pipe(
  trim,
  toLowerCase,
  removeSpecialChars,
  splitWords,
  filterShortWords
);

const input = "  Hello, World! This is a TEST.  ";
const result = processText(input);
console.log(result); // ['hello', 'world', 'this', 'test']
```

---

## 五、不可变性 (Immutability)

### 概念
不修改原有数据，而是创建新数据。

### 数组不可变操作

```javascript
const original = [1, 2, 3];

// ❌ 可变操作
original.push(4); // 修改原数组

// ✅ 不可变操作
const newArray = [...original, 4]; // [1, 2, 3, 4]
const filtered = original.filter(n => n > 1); // [2, 3]
const mapped = original.map(n => n * 2); // [2, 4, 6]

// 对象不可变操作
const user = { name: 'Alice', age: 25, city: 'Shanghai' };

// ❌ 可变操作
user.age = 26;

// ✅ 不可变操作
const updatedUser = { ...user, age: 26 };
const withCountry = { ...user, country: 'China' };
const { age, ...withoutAge } = user; // 删除属性
```

### 深度不可变（使用 Immer）

```javascript
// 使用 Immer 库简化深度不可变操作
// import produce from 'immer';

const state = {
  user: {
    name: 'Alice',
    address: {
      city: 'Shanghai',
      district: 'Pudong'
    }
  }
};

// 传统方式（繁琐）
const newState = {
  ...state,
  user: {
    ...state.user,
    address: {
      ...state.user.address,
      city: 'Beijing'
    }
  }
};

// Immer 方式（简洁）
// const newState = produce(state, draft => {
//   draft.user.address.city = 'Beijing';
// });
```

---

## 六、函子与 Monad (Functor & Monad)

### Maybe 函子 - 处理 null/undefined

```javascript
class Maybe {
  constructor(value) {
    this._value = value;
  }

  static of(value) {
    return new Maybe(value);
  }

  map(fn) {
    return this._value == null ? this : Maybe.of(fn(this._value));
  }

  valueOf() {
    return this._value;
  }
}

// 使用示例
const safeDivide = (x, y) => 
  y === 0 ? Maybe.of(null) : Maybe.of(x / y);

const result1 = safeDivide(10, 2).map(x => x * 2).valueOf();
console.log(result1); // 10

const result2 = safeDivide(10, 0).map(x => x * 2).valueOf();
console.log(result2); // null (不会报错)
```

### Either 函子 - 处理错误

```javascript
class Either {
  constructor(value) {
    this._value = value;
  }

  static left(value) {
    return new Left(value);
  }

  static right(value) {
    return new Right(value);
  }
}

class Left extends Either {
  map() { return this; }
  chain() { return this; }
  getLeft() { return this._value; }
  getRight() { return null; }
  isLeft() { return true; }
  isRight() { return false; }
}

class Right extends Either {
  map(fn) { return Either.right(fn(this._value)); }
  chain(fn) { return fn(this._value); }
  getLeft() { return null; }
  getRight() { return this._value; }
  isLeft() { return false; }
  isRight() { return true; }
}

// 使用示例：安全的 JSON 解析
const safeJsonParse = (str) => {
  try {
    return Either.right(JSON.parse(str));
  } catch (e) {
    return Either.left(e.message);
  }
};

const result1 = safeJsonParse('{"name": "Alice"}');
console.log(result1.isRight()); // true
console.log(result1.getRight()); // { name: 'Alice' }

const result2 = safeJsonParse('invalid json');
console.log(result2.isLeft()); // true
console.log(result2.getLeft()); // 错误信息
```

---

## 七、实战：函数式数据处理

```javascript
// 数据：订单列表
const orders = [
  { id: 1, user: 'Alice', amount: 100, status: 'completed' },
  { id: 2, user: 'Bob', amount: 200, status: 'pending' },
  { id: 3, user: 'Charlie', amount: 150, status: 'completed' },
  { id: 4, user: 'Alice', amount: 300, status: 'completed' },
  { id: 5, user: 'Bob', amount: 50, status: 'cancelled' }
];

// 函数式数据处理管道
const processOrders = pipe(
  // 1. 过滤已完成的订单
  orders => orders.filter(o => o.status === 'completed'),
  
  // 2. 按用户分组
  orders => orders.reduce((acc, order) => {
    acc[order.user] = (acc[order.user] || 0) + order.amount;
    return acc;
  }, {}),
  
  // 3. 转换为数组并排序
  userTotals => Object.entries(userTotals)
    .map(([user, total]) => ({ user, total }))
    .sort((a, b) => b.total - a.total),
  
  // 4. 格式化输出
  sorted => sorted.map(({ user, total }) => 
    `${user}: ¥${total}`
  )
);

const report = processOrders(orders);
console.log(report);
// [
//   "Alice: ¥400",
//   "Charlie: ¥150"
// ]
```

---

## 八、总结对比

| 概念 | 核心思想 | 应用场景 |
|------|----------|----------|
| 纯函数 | 无副作用、确定性输出 | 计算逻辑、数据转换 |
| 高阶函数 | 函数作为参数/返回值 | 抽象通用逻辑 |
| 柯里化 | 多参数转单参数链式调用 | 函数工厂、配置化 |
| 函数组合 | 多个函数组合成新函数 | 数据处理管道 |
| 不可变性 | 创建新数据而非修改 | 状态管理、并发安全 |
| 函子/Monad | 封装值 + 链式操作 | 错误处理、空值处理 |

---

## 九、实践建议

1. **渐进式采用**: 不必全函数式，可在关键逻辑使用
2. **优先纯函数**: 业务逻辑尽量写成纯函数
3. **善用组合**: 用小函数组合代替大函数
4. **注意性能**: 不可变性可能带来内存开销
5. **工具库推荐**: 
   - Ramda - 函数式工具库
   - Immer - 不可变数据
   - fp-ts - TypeScript 函数式编程

---

_训练完成时间：2026-04-23 22:30_
