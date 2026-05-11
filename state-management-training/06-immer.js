/**
 * 示例 6: Immer 集成 - 可变语法实现不可变更新
 * 理解为什么需要不可变更新以及 Immer 如何简化它
 */

// 简易 Immer 实现（核心思想：Draft + Proxy）
function produce(baseState, recipe) {
  // 深拷贝创建 draft
  const draft = JSON.parse(JSON.stringify(baseState));
  
  // 执行可变操作
  recipe(draft);
  
  // 返回新状态
  return draft;
}

// ========== 没有 Immer 的 Redux 更新（繁琐） ==========
const stateWithoutImmer = {
  user: { name: 'Alice', profile: { age: 25, city: 'Shanghai' } },
  todos: [
    { id: 1, text: '任务 1', done: false },
    { id: 2, text: '任务 2', done: true }
  ],
  settings: { theme: 'light', notifications: true }
};

// 深层嵌套更新 - 需要多层展开
const newState1 = {
  ...stateWithoutImmer,
  user: {
    ...stateWithoutImmer.user,
    profile: {
      ...stateWithoutImmer.user.profile,
      age: 26
    }
  }
};

// 数组中对象更新
const newState2 = {
  ...stateWithoutImmer,
  todos: stateWithoutImmer.todos.map(todo =>
    todo.id === 1 ? { ...todo, done: true } : todo
  )
};

// ========== 使用 Immer 的更新（简洁） ==========
const newStateWithImmer = produce(stateWithoutImmer, draft => {
  draft.user.profile.age = 26;
  draft.user.profile.city = 'Beijing';
  
  const todo = draft.todos.find(t => t.id === 1);
  if (todo) todo.done = true;
  
  draft.settings.theme = 'dark';
  draft.todos.push({ id: 3, text: '任务 3', done: false });
});

console.log('原始状态:', JSON.stringify(stateWithoutImmer, null, 2));
console.log('\n使用 Immer 更新后:', JSON.stringify(newStateWithImmer, null, 2));
console.log('\n原始状态未变:', JSON.stringify(stateWithoutImmer, null, 2));

// ========== 在 Redux Reducer 中使用 ==========
const todoReducer = (state = { todos: [] }, action) => {
  return produce(state, draft => {
    switch (action.type) {
      case 'ADD_TODO':
        draft.todos.push({
          id: Date.now(),
          text: action.text,
          done: false
        });
        break;
      case 'TOGGLE_TODO':
        const todo = draft.todos.find(t => t.id === action.id);
        if (todo) todo.done = !todo.done;
        break;
      case 'DELETE_TODO':
        draft.todos = draft.todos.filter(t => t.id !== action.id);
        break;
      case 'EDIT_TODO':
        const editTodo = draft.todos.find(t => t.id === action.id);
        if (editTodo) editTodo.text = action.text;
        break;
    }
  });
};

console.log('\nReducer 测试:');
let state = { todos: [] };
state = todoReducer(state, { type: 'ADD_TODO', text: '学习 Immer' });
state = todoReducer(state, { type: 'ADD_TODO', text: '练习 Redux' });
state = todoReducer(state, { type: 'TOGGLE_TODO', id: state.todos[0].id });
console.log(JSON.stringify(state, null, 2));

console.log('\n✅ 示例 6 完成：理解 Immer 如何简化不可变更新');
