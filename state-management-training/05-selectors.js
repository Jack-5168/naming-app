/**
 * 示例 5: Selectors - 高效提取状态
 * 理解 memoization 和派生状态
 */

// 基础 selector
const getCount = (state) => state.count;
const getUser = (state) => state.user;
const getTodos = (state) => state.todos;

// 派生 selector
const getCompletedTodos = (state) => state.todos.filter((todo) => todo.done);

const getPendingTodos = (state) => state.todos.filter((todo) => !todo.done);

const getTodoCount = (state) => state.todos.length;

// ========== Memoized Selector (类似 Reselect) ==========
function createSelector(...args) {
  const selectors = args.slice(0, -1);
  const resultFunc = args[args.length - 1];

  let lastArgs = null;
  let lastResult = null;

  return function memoizedSelector(state) {
    const selectorArgs = selectors.map((sel) => sel(state));

    // 简单浅比较检查参数是否变化
    const hasChanged = !lastArgs || selectorArgs.some((arg, i) => arg !== lastArgs[i]);

    if (hasChanged) {
      lastArgs = selectorArgs;
      lastResult = resultFunc(...selectorArgs);
    }

    return lastResult;
  };
}

// 使用 createSelector
const getFilteredTodos = createSelector(
  getTodos,
  (state) => state.filter,
  (todos, filter) => {
    console.log('🔄 重新计算过滤器（状态变化了）');
    if (filter === 'all') return todos;
    if (filter === 'completed') return todos.filter((t) => t.done);
    if (filter === 'pending') return todos.filter((t) => !t.done);
    return todos;
  },
);

// ========== 使用示例 ==========
const state = {
  count: 5,
  user: { name: 'Bob', age: 30 },
  todos: [
    { id: 1, text: '任务 1', done: true },
    { id: 2, text: '任务 2', done: false },
    { id: 3, text: '任务 3', done: true },
    { id: 4, text: '任务 4', done: false },
  ],
  filter: 'all',
};

console.log('Count:', getCount(state));
console.log('User:', getUser(state));
console.log('Completed:', getCompletedTodos(state).length);
console.log('Pending:', getPendingTodos(state).length);

console.log('\n--- 测试 Memoization ---');
console.log('第一次调用 getFilteredTodos:');
getFilteredTodos(state);

console.log('第二次调用（参数未变，应返回缓存）:');
getFilteredTodos(state);

console.log('修改 filter 后调用:');
getFilteredTodos({ ...state, filter: 'completed' });

console.log('\n✅ 示例 5 完成：理解 Selectors 和 Memoization');
