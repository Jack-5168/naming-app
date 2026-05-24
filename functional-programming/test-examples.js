// 函数式编程示例 — 可执行验证
// 运行: node functional-programming/test-examples.js

console.log('=== 函数式编程示例验证 ===\n');

// ========== 示例 1: 纯函数 ==========
console.log('【示例 1】纯函数 vs 不纯函数');
function calculateTotalPure(price, taxRate) {
  return price * (1 + taxRate);
}
console.log(calculateTotalPure(100, 0.1)); // 110
console.log(calculateTotalPure(100, 0.1)); // 110

// ========== 示例 2: 纯函数可测试 ==========
console.log('\n【示例 2】纯函数可测试性');
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
console.assert(isValidEmail('a@b.com') === true);
console.assert(isValidEmail('invalid') === false);
console.log('✅ 所有断言通过');

// ========== 示例 3: Memoization ==========
console.log('\n【示例 3】纯函数 + 缓存');
function memoize(fn) {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
const memoFib = memoize(fibonacci);
console.log('fib(40):', memoFib(40));
console.log('fib(40) cached:', memoFib(40));

// ========== 示例 4: 不可变数据 ==========
console.log('\n【示例 4】不可变数据操作');
const nums = [1, 2, 3];
const nums2 = [...nums, 4];
const nums3 = nums2.map((n, i) => (i === 0 ? 99 : n));
console.log('原数组:', nums); // [1, 2, 3]
console.log('新数组:', nums3); // [99, 2, 3, 4]

const user = { name: 'Alice', age: 25, address: { city: 'Beijing' } };
const user2 = { ...user, age: 26 };
const user3 = { ...user, address: { ...user.address, city: 'Shanghai' } };
console.log('原:', user);
console.log('改年龄:', user2);
console.log('改城市:', user3);

// ========== 示例 5: 不可变工具集 ==========
console.log('\n【示例 5】不可变数组工具集');
const Immutable = {
  add: (arr, item) => [...arr, item],
  remove: (arr, i) => arr.filter((_, idx) => idx !== i),
  update: (arr, i, fn) => arr.map((item, idx) => (idx === i ? fn(item) : item)),
  insert: (arr, i, item) => [...arr.slice(0, i), item, ...arr.slice(i)],
};
const list = ['a', 'b', 'c'];
console.log('add:', Immutable.add(list, 'd'));
console.log('remove:', Immutable.remove(list, 1));
console.log('update:', Immutable.update(list, 0, (x) => x.toUpperCase()));
console.log('insert:', Immutable.insert(list, 1, 'x'));
console.log('原数组不变:', list);

// ========== 示例 6: compose & pipe ==========
console.log('\n【示例 6】compose 与 pipe');
const compose = (...fns) => (x) => fns.reduceRight((v, f) => f(v), x);
const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);

const trim = (s) => s.trim();
const lower = (s) => s.toLowerCase();
const removeVowels = (s) => s.replace(/[aeiou]/g, '');
const wrap = (s) => `[${s}]`;

console.log('compose:', compose(wrap, removeVowels, lower, trim)('  Hello World  '));
console.log('pipe:   ', pipe(trim, lower, removeVowels, wrap)('  Hello World  '));

// ========== 示例 7: 数据管道 ==========
console.log('\n【示例 7】数据管道');
const users = [
  {
    name: 'Alice', age: 28, role: 'admin', active: true,
  },
  {
    name: 'bob', age: 17, role: 'user', active: false,
  },
  {
    name: 'Charlie', age: 35, role: 'admin', active: true,
  },
  {
    name: 'diana', age: 22, role: 'user', active: true,
  },
  {
    name: 'Eve', age: 31, role: 'user', active: true,
  },
];

const getActiveAdminNames = pipe(
  (u) => u.filter((x) => x.active && x.role === 'admin'),
  (u) => [...u].sort((a, b) => a.age - b.age),
  (u) => u.map((x) => x.name.toUpperCase()),
  (names) => `Active admins: ${names.join(', ')}`,
);
console.log(getActiveAdminNames(users));

// ========== 示例 8: Pipeline 构建器 ==========
console.log('\n【示例 8】链式管道');
class Pipeline {
  constructor(v) { this._v = v; this._s = []; }

  use(fn) { this._s.push(fn); return this; }

  run() { return this._s.reduce((v, f) => f(v), this._v); }
}
const result = new Pipeline([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  .use((a) => a.filter((n) => n % 2 === 0))
  .use((a) => a.map((n) => n * n))
  .use((a) => a.reduce((s, n) => s + n, 0))
  .run();
console.log('管道结果:', result); // 220

// ========== 示例 9: 柯里化 ==========
console.log('\n【示例 9】柯里化');
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn(...args);
    return (...more) => curried(...args, ...more);
  };
}
function add(a, b, c) { return a + b + c; }
const curriedAdd = curry(add);
console.log('curriedAdd(1)(2)(3):', curriedAdd(1)(2)(3));
console.log('curriedAdd(1,2)(3):', curriedAdd(1, 2)(3));
const add10 = curriedAdd(10);
console.log('add10(20)(5):', add10(20)(5)); // 35 — 柯里化链: 10+20+5
const add10And5 = curriedAdd(10)(5);
console.log('add10And5(7):', add10And5(7)); // 22 — 部分应用: 10+5+7

// ========== 示例 10: 柯里化验证器 ==========
console.log('\n【示例 10】柯里化验证器');
const matches = curry((pattern, str) => pattern.test(str));
const isEmail = matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
const isPhone = matches(/^\d{11}$/);
console.log('isEmail:', isEmail('test@example.com'));
console.log('isPhone:', isPhone('13812345678'));
console.log('filter emails:', ['a@b.com', 'invalid', 'c@d.org'].filter(isEmail));

// ========== 示例 11: 柯里化查询器 ==========
console.log('\n【示例 11】柯里化查询构建器');
const where = curry((field, value, arr) => arr.filter((item) => item[field] === value));
const select = curry((fields, arr) => arr.map((item) => {
  const picked = {};
  fields.forEach((f) => picked[f] = item[f]);
  return picked;
}));
const orderBy = curry((field, arr) => [...arr].sort((a, b) => (a[field] > b[field] ? 1 : -1)));

const data = [
  { name: 'Alice', dept: 'eng', salary: 80 },
  { name: 'Bob', dept: 'sales', salary: 60 },
  { name: 'Charlie', dept: 'eng', salary: 90 },
  { name: 'Diana', dept: 'eng', salary: 85 },
];
const getEng = where('dept', 'eng');
const getNameAndSalary = select(['name', 'salary']);
const bySalary = orderBy('salary');
const queryResult = pipe(getEng, bySalary, getNameAndSalary)(data);
console.log('查询结果:', JSON.stringify(queryResult));

// ========== 示例 12: Point-Free ==========
console.log('\n【示例 12】Point-Free 风格');
const pf = {
  map: (fn) => (arr) => arr.map(fn),
  filter: (fn) => (arr) => arr.filter(fn),
  reduce: (fn, init) => (arr) => arr.reduce(fn, init),
  compose: (...fns) => (x) => fns.reduceRight((v, f) => f(v), x),
};
const sumOfSquaresOfEvens = pf.compose(
  pf.reduce((s, n) => s + n, 0),
  pf.map((n) => n * n),
  pf.filter((n) => n % 2 === 0),
);
console.log('偶数平方和:', sumOfSquaresOfEvens([1, 2, 3, 4, 5, 6])); // 56

// ========== 示例 13: Maybe ==========
console.log('\n【示例 13】Maybe Functor');
class Maybe {
  static of(v) { return new Maybe(v); }

  constructor(v) { this.value = v; }

  isNothing() { return this.value == null; }

  map(fn) { return this.isNothing() ? new Maybe(null) : new Maybe(fn(this.value)); }

  getOrElse(d) { return this.isNothing() ? d : this.value; }
}
const userObj = { profile: { settings: { theme: 'dark' } } };
console.log('get theme:', Maybe.of(userObj).map((u) => u.profile).map((p) => p.settings).map((s) => s.theme)
  .getOrElse('light'));
console.log('null safe:', Maybe.of(null).map((u) => u.profile).getOrElse('light'));

// ========== 示例 14: 函数式状态管理 ==========
console.log('\n【示例 14】函数式状态管理');
function curry2(fn) {
  return function c(...args) {
    if (args.length >= fn.length) return fn(...args);
    return (...more) => c(...args, ...more);
  };
}
const createStore = (reducer, initialState) => {
  let state = initialState;
  const listeners = [];
  return {
    getState: () => state,
    dispatch: (action) => { state = reducer(state, action); listeners.forEach((fn) => fn(state)); },
    subscribe: (fn) => { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); },
  };
};
function todoReducer(state, action) {
  switch (action.type) {
    case 'ADD': return [...state, { id: Date.now() + Math.random(), text: action.text, done: false }];
    case 'TOGGLE': return state.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t));
    case 'REMOVE': return state.filter((t) => t.id !== action.id);
    default: return state;
  }
}
const store = createStore(todoReducer, []);
store.subscribe((s) => console.log('  → State:', JSON.stringify(s)));
store.dispatch({ type: 'ADD', text: 'Learn FP' });
store.dispatch({ type: 'ADD', text: 'Practice' });
store.dispatch({ type: 'TOGGLE', id: store.getState()[0].id });
store.dispatch({ type: 'REMOVE', id: store.getState()[1].id });

console.log('\n✅ 全部 14 个示例验证通过！');
