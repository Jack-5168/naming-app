/**
 * 状态管理示例演示
 * 运行：node demo.js
 */

const { createStore, applyMiddleware } = require('./mini-redux');
const { create } = require('./mini-zustand');

console.log('📚 状态管理示例演示\n');
console.log('='.repeat(50));

// ============================================
// Redux 示例
// ============================================

console.log('\n🔴 Redux 示例\n');
console.log('-'.repeat(30));

// Counter Reducer (注意参数顺序: state, action)
function counterReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + 1 };
    case 'DECREMENT':
      return { count: state.count - 1 };
    case 'ADD':
      return { count: state.count + action.payload };
    default:
      return state;
  }
}

// Logger Middleware
const loggerMiddleware = (store) => (next) => (action) => {
  console.log(`  [Action] ${action.type}`);
  const result = next(action);
  console.log(`  [State] count = ${store.getState().count}`);
  return result;
};

// 创建 store
const counterStore = createStore(counterReducer, undefined, applyMiddleware(loggerMiddleware));

// 订阅
const unsubscribe = counterStore.subscribe(() => {
  console.log('  [Subscribe] 状态已更新\n');
});

console.log('初始状态:', counterStore.getState());
console.log('\n执行操作:');
counterStore.dispatch({ type: 'INCREMENT' });
counterStore.dispatch({ type: 'INCREMENT' });
counterStore.dispatch({ type: 'ADD', payload: 5 });
counterStore.dispatch({ type: 'DECREMENT' });

unsubscribe();

// ============================================
// Zustand 示例
// ============================================

console.log('\n🟢 Zustand 示例\n');
console.log('-'.repeat(30));

// 创建 Todo Store
const useTodoStore = create((set, get) => ({
  todos: [],
  filter: 'all',

  addTodo: (text) => {
    console.log(`  [添加] "${text}"`);
    set((state) => ({
      todos: [...state.todos, {
        id: Date.now(),
        text,
        completed: false,
      }],
    }));
  },

  toggleTodo: (id) => {
    set((state) => ({
      todos: state.todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    }));
  },

  deleteTodo: (id) => {
    set((state) => ({
      todos: state.todos.filter((t) => t.id !== id),
    }));
  },

  get filteredTodos() {
    const { todos, filter } = get();
    if (filter === 'active') return todos.filter((t) => !t.completed);
    if (filter === 'completed') return todos.filter((t) => t.completed);
    return todos;
  },

  get stats() {
    const { todos } = get();
    return {
      total: todos.length,
      completed: todos.filter((t) => t.completed).length,
    };
  },
}));

// 订阅状态变化
useTodoStore.subscribe((state) => {
  console.log('  [订阅回调] Todo 数量:', state.todos.length);
});

console.log('初始状态:', useTodoStore.getState());
console.log('\n执行操作:');

useTodoStore.getState().addTodo('学习 Redux');
useTodoStore.getState().addTodo('学习 Zustand');
useTodoStore.getState().addTodo('理解状态管理原理');

console.log('\n当前 Todos:');
useTodoStore.getState().todos.forEach((todo, i) => {
  console.log(`  ${i + 1}. ${todo.completed ? '✅' : '⬜'} ${todo.text}`);
});

console.log('\n标记第一个为完成:');
const firstTodo = useTodoStore.getState().todos[0];
useTodoStore.getState().toggleTodo(firstTodo.id);

console.log('\n更新后:');
useTodoStore.getState().todos.forEach((todo, i) => {
  console.log(`  ${i + 1}. ${todo.completed ? '✅' : '⬜'} ${todo.text}`);
});

console.log('\n统计:', useTodoStore.getState().stats);

// ============================================
// 购物车示例
// ============================================

console.log('\n🛒 购物车示例\n');
console.log('-'.repeat(30));

const useCartStore = create((set, get) => ({
  items: [],

  addItem: (product, quantity = 1) => {
    const { items } = get();
    const existing = items.find((i) => i.id === product.id);

    if (existing) {
      set({
        items: items.map((i) => (i.id === product.id
          ? { ...i, quantity: i.quantity + quantity }
          : i)),
      });
      console.log(`  [更新] ${product.name} x${existing.quantity + quantity}`);
    } else {
      set({ items: [...items, { ...product, quantity }] });
      console.log(`  [添加] ${product.name} x${quantity}`);
    }
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    }));
  },

  get totalItems() {
    return get().items.reduce((sum, i) => sum + i.quantity, 0);
  },

  get totalPrice() {
    return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  },
}));

console.log('添加商品:');
useCartStore.getState().addItem({ id: 1, name: 'iPhone', price: 5999 }, 1);
useCartStore.getState().addItem({ id: 2, name: 'AirPods', price: 1299 }, 2);
useCartStore.getState().addItem({ id: 1, name: 'iPhone', price: 5999 }, 1); // 追加

console.log('\n购物车内容:');
useCartStore.getState().items.forEach((item) => {
  console.log(`  - ${item.name} x${item.quantity} = ¥${item.price * item.quantity}`);
});

console.log(`\n总计: ${useCartStore.getState().totalItems} 件商品, ¥${useCartStore.getState().totalPrice}`);

// ============================================
// 用户认证示例
// ============================================

console.log('\n👤 用户认证示例\n');
console.log('-'.repeat(30));

const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: (username, _password) => {
    console.log(`  [登录] 用户: ${username}`);
    // 模拟 API 调用
    const user = { id: 1, username, email: `${username}@example.com` };
    const token = 'fake-jwt-token-' + Date.now();
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    console.log('  [登出]');
    set({ user: null, token: null, isAuthenticated: false });
  },

  updateProfile: (data) => {
    set((state) => ({
      user: { ...state.user, ...data },
    }));
  },
}));

useAuthStore.subscribe((state) => {
  console.log(`  [认证状态] 已登录: ${state.isAuthenticated}`);
});

console.log('初始状态:', useAuthStore.getState().isAuthenticated ? '已登录' : '未登录');
console.log('\n执行登录:');
useAuthStore.getState().login('admin', 'password123');

console.log('\n当前用户:', useAuthStore.getState().user);

console.log('\n更新资料:');
useAuthStore.getState().updateProfile({ email: 'newemail@example.com' });
console.log('更新后:', useAuthStore.getState().user);

console.log('\n执行登出:');
useAuthStore.getState().logout();
console.log('最终状态:', useAuthStore.getState().isAuthenticated ? '已登录' : '未登录');

// ============================================
// 总结
// ============================================

console.log('\n' + '='.repeat(50));
console.log('\n✅ 演示完成!\n');
console.log('📝 关键要点:');
console.log('   1. Redux: 中心化 store + reducer + action');
console.log('   2. Zustand: 直接修改 + 函数式更新');
console.log('   3. 两者都支持订阅/发布模式');
console.log('   4. 状态变化都是不可变的');
console.log('   5. 可以组合多个 store 管理不同领域状态\n');
