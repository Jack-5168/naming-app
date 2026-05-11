# 专项训练：状态管理 — 实现简易 Redux/Zustand

> 日期：2026-04-28 | 时间：11:00 | 目标：理解状态管理原理，手写 10+ 示例

---

## 一、状态管理核心原理

### 1.1 什么是状态管理？

状态管理 = **数据源单一化 + 状态变更可追踪 + 视图自动同步**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Action    │────▶│   Reducer   │────▶│    State    │
│ (描述变更)   │     │ (纯函数计算) │     │ (唯一数据源) │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                     ┌─────────▼─────────┐
                                     │   Subscribers     │
                                     │  (视图自动更新)     │
                                     └───────────────────┘
```

### 1.2 三种主流模式对比

| 特性 | Redux | MobX | Zustand |
|------|-------|------|---------|
| 状态 | 不可变 (Immutable) | 可变 (Observable) | 可变 (但通过 set 控制) |
| 更新方式 | dispatch(action) → reducer | 直接修改 observable | setState(partial) / 函数 |
| 可追踪性 | 极强 (action log) | 中等 (proxy 拦截) | 强 (middleware) |
| 学习曲线 | 高 | 中 | 低 |
| 样板代码 | 多 | 少 | 极少 |
| 核心 API | createStore, dispatch, subscribe | observable, autorun, computed | create, useStore |

---

## 二、手写 Mini Redux (~80 行)

### 2.1 核心实现

```javascript
/**
 * MiniRedux — 精简版 Redux 实现
 * 核心：单一 store + reducer 纯函数 + dispatch + subscribe
 */
class MiniRedux {
  constructor(reducer, initialState) {
    this.reducer = reducer;
    this.state = initialState;
    this.listeners = new Set();
    this.isDispatching = false;
  }

  // 获取当前状态
  getState() {
    return this.state;
  }

  // 派发 action，触发 reducer 计算新状态
  dispatch(action) {
    if (typeof action !== 'object' || action === null) {
      throw new Error('Action must be a plain object');
    }
    if (typeof action.type === 'undefined') {
      throw new Error('Action must have a type property');
    }
    if (this.isDispatching) {
      throw new Error('Reducers may not dispatch actions');
    }

    try {
      this.isDispatching = true;
      // reducer 是纯函数：(state, action) => newState
      this.state = this.reducer(this.state, action);
    } finally {
      this.isDispatching = false;
    }

    // 通知所有订阅者
    for (const listener of this.listeners) {
      listener();
    }

    return action;
  }

  // 订阅状态变化
  subscribe(listener) {
    this.listeners.add(listener);

    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  // 替换 reducer (热更新用)
  replaceReducer(nextReducer) {
    this.reducer = nextReducer;
    this.dispatch({ type: '@@mini-redux/INIT' });
  }
}

// ============ 工具函数 ============

// 合并多个 reducer
function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers);
  return (state = {}, action) => {
    let hasChanged = false;
    const nextState = {};
    for (const key of reducerKeys) {
      const reducer = reducers[key];
      const previousState = state[key];
      const nextStateForKey = reducer(previousState, action);
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousState;
    }
    return hasChanged ? nextState : state;
  };
}

// applyMiddleware — 中间件工厂
function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, initialState) => {
    const store = createStore(reducer, initialState);
    let dispatch = store.dispatch;
    const midApi = {
      getState: store.getState,
      dispatch: (action) => dispatch(action),
    };
    const chain = middlewares.map((mw) => mw(midApi));
    dispatch = compose(...chain)(store.dispatch);
    return { ...store, dispatch };
  };
}

// compose — 函数组合 (从右到左)
function compose(...fns) {
  if (fns.length === 0) return (arg) => arg;
  if (fns.length === 1) return fns[0];
  return fns.reduce(
    (a, b) =>
      (...args) =>
        a(b(...args))
  );
}
```

### 2.2 使用示例

```javascript
// --- Reducer 定义 ---
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

// --- 创建 store ---
const store = new MiniRedux(counterReducer, { count: 0 });

// --- 订阅 ---
const unsubscribe = store.subscribe(() => {
  console.log('State changed:', store.getState());
});

// --- 派发 ---
store.dispatch({ type: 'INCREMENT' }); // { count: 1 }
store.dispatch({ type: 'ADD', payload: 5 }); // { count: 6 }
store.dispatch({ type: 'DECREMENT' }); // { count: 5 }

unsubscribe(); // 取消订阅
```

---

## 三、手写 Mini Zustand (~50 行)

### 3.1 核心实现

```javascript
/**
 * MiniZustand — 精简版 Zustand 实现
 * 核心：set/get API + 选择器订阅 + 轻量
 */
function createMiniZustand(createState) {
  let state;
  const listeners = new Set();

  const setState = (partial, replace) => {
    const nextState =
      typeof partial === 'function' ? partial(state) : partial;
    if (!nextState) return;
    state = replace ? nextState : { ...state, ...nextState };
    // 通知所有监听者
    for (const listener of listeners) {
      listener(state);
    }
  };

  const getState = () => state;

  const subscribe = (listener, selectorFn, equalityFn) => {
    // 支持选择器模式：只订阅关心的 slice
    const wrappedListener = (newState) => {
      const selectedSlice = selectorFn ? selectorFn(newState) : newState;
      const prevSelected = selectorFn ? selectorFn(state) : state;
      // 默认浅比较
      const isEqual = equalityFn || ((a, b) => a === b);
      if (!isEqual(prevSelected, selectedSlice)) {
        listener(selectedSlice);
      }
    };
    listeners.add(wrappedListener);
    return () => listeners.delete(wrappedListener);
  };

  const destroy = () => listeners.clear();

  // 初始化
  state = createState(setState, getState, { subscribe, destroy });

  return { getState, subscribe, setState, destroy };
}
```

### 3.2 使用示例

```javascript
// --- 创建 store ---
const useCountStore = createMiniZustand((set, get) => ({
  count: 0,
  name: 'zustand',
  // actions 直接定义在 store 上
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  setName: (name) => set({ name }),
  getCountAndName: () => `${get().count} - ${get().name}`,
}));

// --- 订阅 ---
const unsub = useCountStore.subscribe(
  (count) => console.log('Count:', count),
  (state) => state.count
);

useCountStore.getState().increment(); // Count: 1
useCountStore.getState().increment(); // Count: 2
useCountStore.getState().setName('mini');
console.log(useCountStore.getState().getCountAndName()); // "2 - mini"

unsub();
```

---

## 四、12 个状态管理示例

### 示例 1：Todo 列表 (Redux 模式)

```javascript
// --- Reducer ---
const todoInitialState = {
  todos: [],
  filter: 'all', // 'all' | 'active' | 'completed'
};

function todoReducer(state = todoInitialState, action) {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        ...state,
        todos: [
          ...state.todos,
          {
            id: Date.now(),
            text: action.payload,
            completed: false,
          },
        ],
      };
    case 'TOGGLE_TODO':
      return {
        ...state,
        todos: state.todos.map((t) =>
          t.id === action.payload ? { ...t, completed: !t.completed } : t
        ),
      };
    case 'DELETE_TODO':
      return {
        ...state,
        todos: state.todos.filter((t) => t.id !== action.payload),
      };
    case 'SET_FILTER':
      return { ...state, filter: action.payload };
    default:
      return state;
  }
}

// --- Action Creators ---
const todoActions = {
  addTodo: (text) => ({ type: 'ADD_TODO', payload: text }),
  toggleTodo: (id) => ({ type: 'TOGGLE_TODO', payload: id }),
  deleteTodo: (id) => ({ type: 'DELETE_TODO', payload: id }),
  setFilter: (filter) => ({ type: 'SET_FILTER', payload: filter }),
};

// --- 使用 ---
const todoStore = new MiniRedux(todoReducer, todoInitialState);
todoStore.subscribe(() => {
  const { todos, filter } = todoStore.getState();
  const filtered =
    filter === 'all'
      ? todos
      : todos.filter((t) =>
          filter === 'completed' ? t.completed : !t.completed
        );
  console.log(`[${filter}]`, filtered.map((t) => t.text));
});

todoStore.dispatch(todoActions.addTodo('学习 Redux'));
todoStore.dispatch(todoActions.addTodo('学习 Zustand'));
todoStore.dispatch(todoActions.toggleTodo(
  todoStore.getState().todos[0].id
));
todoStore.dispatch(todoActions.setFilter('completed'));
```

### 示例 2：购物车 (Zustand 模式)

```javascript
const useCartStore = createMiniZustand((set, get) => ({
  items: [],
  // 添加商品
  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, qty: i.qty + 1 } : i
          ),
        };
      }
      return { items: [...state.items, { ...item, qty: 1 }] };
    }),
  // 减少数量
  decreaseQty: (id) =>
    set((state) => ({
      items: state.items
        .map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i))
        .filter((i) => i.qty > 0),
    })),
  // 移除商品
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    })),
  // 清空
  clearCart: () => set({ items: [] }),
  // 计算总价
  getTotal: () =>
    get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
  // 计算总数
  getItemCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
}));

// 使用
useCartStore.getState().addItem({ id: 1, name: '键盘', price: 299 });
useCartStore.getState().addItem({ id: 2, name: '鼠标', price: 149 });
useCartStore.getState().addItem({ id: 1, name: '键盘', price: 299 });
console.log('总价:', useCartStore.getState().getTotal()); // 847
console.log('总数:', useCartStore.getState().getItemCount()); // 3
```

### 示例 3：用户认证状态

```javascript
const useAuthStore = createMiniZustand((set, get) => ({
  user: null,
  token: null,
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      // 模拟 API 调用
      await new Promise((r) => setTimeout(r, 500));
      const user = { id: 1, name: username, role: 'admin' };
      const token = 'jwt_token_' + Date.now();
      set({ user, token, loading: false });
      return true;
    } catch (err) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  logout: () => set({ user: null, token: null }),

  // 检查是否已登录
  isAuthenticated: () => !!get().token,

  // 检查权限
  hasPermission: (perm) => get().user?.role === 'admin',
}));

// 使用
console.log('已登录?', useAuthStore.getState().isAuthenticated()); // false
useAuthStore.getState().login('alice', 'password123');
// 500ms 后: user = { id: 1, name: 'alice', role: 'admin' }
```

### 示例 4：主题切换 + 国际化

```javascript
const useThemeStore = createMiniZustand((set, get) => ({
  theme: 'light', // 'light' | 'dark' | 'system'
  lang: 'zh', // 'zh' | 'en' | 'ja'
  fontSize: 16,

  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),

  setTheme: (theme) => set({ theme }),
  setLang: (lang) => set({ lang }),

  // 字体大小增减
  increaseFontSize: () =>
    set((state) => ({ fontSize: Math.min(state.fontSize + 2, 24) })),
  decreaseFontSize: () =>
    set((state) => ({ fontSize: Math.max(state.fontSize - 2, 12) })),

  // 获取翻译 (简单字典)
  t: (key) => {
    const { lang } = get();
    const dict = {
      zh: { hello: '你好', world: '世界', welcome: '欢迎' },
      en: { hello: 'Hello', world: 'World', welcome: 'Welcome' },
      ja: { hello: 'こんにちは', world: '世界', welcome: 'ようこそ' },
    };
    return dict[lang]?.[key] || key;
  },

  // 获取 CSS 变量
  getCSSVars: () => {
    const { theme, fontSize } = get();
    const colors =
      theme === 'dark'
        ? { bg: '#1a1a2e', fg: '#e0e0e0', primary: '#4361ee' }
        : { bg: '#ffffff', fg: '#1a1a2e', primary: '#3a86ff' };
    return { ...colors, fontSize: `${fontSize}px` };
  },
}));

// 使用
console.log(useThemeStore.getState().t('hello')); // 你好
useThemeStore.getState().setLang('en');
console.log(useThemeStore.getState().t('hello')); // Hello
useThemeStore.getState().toggleTheme();
console.log(useThemeStore.getState().getCSSVars()); // { bg: '#1a1a2e', ... }
```

### 示例 5：表单状态管理

```javascript
const useFormStore = createMiniZustand((set, get) => ({
  values: {},
  errors: {},
  touched: {},
  isSubmitting: false,

  // 设置字段值
  setField: (name, value) =>
    set((state) => ({
      values: { ...state.values, [name]: value },
    })),

  // 标记字段为已触碰
  touchField: (name) =>
    set((state) => ({
      touched: { ...state.touched, [name]: true },
    })),

  // 设置字段错误
  setFieldError: (name, error) =>
    set((state) => ({
      errors: { ...state.errors, [name]: error },
    })),

  // 验证单个字段
  validateField: (name, rule) => {
    const value = get().values[name];
    const error = rule(value);
    get().setFieldError(name, error);
    return !error;
  },

  // 重置表单
  reset: () => set({ values: {}, errors: {}, touched: {}, isSubmitting: false }),

  // 获取有效字段
  isValid: () => Object.values(get().errors).every((e) => !e),
}));

// 使用
const form = useFormStore.getState();
form.setField('email', 'test@example.com');
form.touchField('email');
form.validateField('email', (v) =>
  !v ? '邮箱不能为空' : !v.includes('@') ? '邮箱格式不正确' : ''
);
console.log('表单有效?', form.isValid()); // true
```

### 示例 6：无限层级 Tree 状态

```javascript
const useTreeStore = createMiniZustand((set, get) => ({
  nodes: [],

  // 设置树数据
  setTree: (nodes) => set({ nodes }),

  // 切换展开/折叠
  toggleNode: (id) => {
    const toggle = (nodes) =>
      nodes.map((n) => {
        if (n.id === id) return { ...n, expanded: !n.expanded };
        if (n.children) return { ...n, children: toggle(n.children) };
        return n;
      });
    set((state) => ({ nodes: toggle(state.nodes) }));
  },

  // 级联勾选
  cascadeCheck: (id, checked) => {
    const cascade = (nodes) =>
      nodes.map((n) => {
        if (n.id === id) {
          const setAllChildren = (children) =>
            children?.map((c) => ({
              ...c,
              checked,
              children: setAllChildren(c.children),
            })) || [];
          return {
            ...n,
            checked,
            children: setAllChildren(n.children),
          };
        }
        if (n.children) {
          const updatedChildren = cascade(n.children);
          const allChecked = updatedChildren.every((c) => c.checked);
          const someChecked = updatedChildren.some((c) => c.checked);
          return {
            ...n,
            children: updatedChildren,
            checked: allChecked ? true : someChecked ? 'indeterminate' : false,
          };
        }
        return n;
      });
    set((state) => ({ nodes: cascade(state.nodes) }));
  },

  // 获取所有勾选的节点
  getCheckedIds: () => {
    const collect = (nodes) =>
      nodes.flatMap((n) => [
        ...(n.checked ? [n.id] : []),
        ...collect(n.children || []),
      ]);
    return collect(get().nodes);
  },
}));

// 使用
const tree = useTreeStore.getState();
tree.setTree([
  {
    id: 1,
    label: '前端',
    expanded: false,
    checked: false,
    children: [
      { id: 2, label: 'React', expanded: false, checked: false, children: [] },
      { id: 3, label: 'Vue', expanded: false, checked: false, children: [] },
    ],
  },
]);
tree.toggleNode(1); // 展开
tree.cascadeCheck(2, true); // 勾选 React
console.log('已勾选:', tree.getCheckedIds()); // [2]
```

### 示例 7：Tab 切换 + 路由模拟

```javascript
const useTabStore = createMiniZustand((set, get) => ({
  tabs: [{ id: 'home', label: '首页', active: true }],
  activeTabId: 'home',
  history: ['/home'],
  historyIndex: 0,

  // 添加 tab
  addTab: (id, label) => {
    const { tabs } = get();
    if (tabs.find((t) => t.id === id)) {
      get().activateTab(id);
      return;
    }
    set((state) => ({
      tabs: [
        ...state.tabs.map((t) => ({ ...t, active: false })),
        { id, label, active: true },
      ],
      activeTabId: id,
      history: [...state.history.slice(0, state.historyIndex + 1), '/' + id],
      historyIndex: state.historyIndex + 1,
    }));
  },

  // 激活 tab
  activateTab: (id) =>
    set((state) => ({
      tabs: state.tabs.map((t) => ({ ...t, active: t.id === id })),
      activeTabId: id,
    })),

  // 关闭 tab
  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.filter((t) => t.id !== id);
    const newActive =
      id === activeTabId
        ? newTabs[Math.min(idx, newTabs.length - 1)].id
        : activeTabId;
    set({
      tabs: newTabs.map((t) => ({ ...t, active: t.id === newActive })),
      activeTabId: newActive,
    });
  },

  // 前进/后退
  goBack: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      const path = history[newIdx];
      const tabId = path.slice(1);
      set({ historyIndex: newIdx });
      get().activateTab(tabId);
    }
  },
  goForward: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      const path = history[newIdx];
      const tabId = path.slice(1);
      set({ historyIndex: newIdx });
      get().activateTab(tabId);
    }
  },
}));

// 使用
const tabs = useTabStore.getState();
tabs.addTab('docs', '文档');
tabs.addTab('playground', ' playground');
tabs.closeTab('docs');
console.log('当前激活:', tabs.activeTabId); // playground
```

### 示例 8：WebSocket 连接管理

```javascript
const useWebSocketStore = createMiniZustand((set, get) => ({
  url: '',
  status: 'disconnected', // 'connecting' | 'connected' | 'disconnected' | 'error'
  messages: [],
  ws: null,
  reconnectAttempts: 0,
  maxReconnect: 5,

  connect: (url) => {
    set({ url, status: 'connecting' });
    // 模拟 WebSocket
    const ws = {
      onmessage: null,
      onclose: null,
      onerror: null,
      send: () => {},
      close: () => {},
    };
    set({ ws: { ...ws, _simulated: true }, status: 'connected', reconnectAttempts: 0 });

    // 模拟收到消息
    setTimeout(() => {
      if (get().status === 'connected') {
        get().onMessage({ data: JSON.stringify({ type: 'ping' }) });
      }
    }, 1000);
  },

  onMessage: (event) => {
    const msg = JSON.parse(event.data);
    set((state) => ({
      messages: [
        ...state.messages,
        { id: Date.now(), ...msg, timestamp: new Date().toISOString() },
      ],
    }));
  },

  send: (data) => {
    const { ws, status } = get();
    if (status === 'connected' && ws) {
      console.log('[WS Send]', data);
    }
  },

  disconnect: () => {
    set({ status: 'disconnected', ws: null });
  },

  reconnect: () => {
    const { reconnectAttempts, maxReconnect, url } = get();
    if (reconnectAttempts < maxReconnect) {
      set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 }));
      get().connect(url);
    }
  },

  clearMessages: () => set({ messages: [] }),
}));

// 使用
const ws = useWebSocketStore.getState();
ws.connect('ws://localhost:8080');
setTimeout(() => {
  ws.send(JSON.stringify({ type: 'chat', content: 'Hello!' }));
  console.log('消息数:', ws.messages.length);
}, 1500);
```

### 示例 9：拖拽列表排序

```javascript
const useDragStore = createMiniZustand((set, get) => ({
  items: [
    { id: 1, text: '任务 A', order: 0 },
    { id: 2, text: '任务 B', order: 1 },
    { id: 3, text: '任务 C', order: 2 },
    { id: 4, text: '任务 D', order: 3 },
  ],
  draggedId: null,

  // 开始拖拽
  startDrag: (id) => set({ draggedId: id }),

  // 放下
  drop: (targetId) => {
    const { items, draggedId } = get();
    if (!draggedId || draggedId === targetId) {
      set({ draggedId: null });
      return;
    }
    const dragIdx = items.findIndex((i) => i.id === draggedId);
    const targetIdx = items.findIndex((i) => i.id === targetId);
    const newItems = [...items];
    const [dragged] = newItems.splice(dragIdx, 1);
    newItems.splice(targetIdx, 0, dragged);
    set({
      items: newItems.map((item, idx) => ({ ...item, order: idx })),
      draggedId: null,
    });
  },

  // 取消拖拽
  cancelDrag: () => set({ draggedId: null }),

  // 添加
  addItem: (text) =>
    set((state) => ({
      items: [
        ...state.items,
        { id: Date.now(), text, order: state.items.length },
      ],
    })),

  // 删除
  removeItem: (id) =>
    set((state) => ({
      items: state.items
        .filter((i) => i.id !== id)
        .map((item, idx) => ({ ...item, order: idx })),
    })),
}));

// 使用
const drag = useDragStore.getState();
console.log(drag.items.map((i) => i.text)); // ['A', 'B', 'C', 'D']
drag.startDrag(3); // 拖拽 C
drag.drop(1); // 放到 A 前面
console.log(drag.items.map((i) => i.text)); // ['C', 'A', 'B', 'D']
```

### 示例 10：通知/Toast 队列

```javascript
const useToastStore = createMiniZustand((set, get) => ({
  toasts: [],
  nextId: 1,

  add: (message, type = 'info', duration = 3000) => {
    const id = get().nextId;
    set((state) => ({ nextId: state.nextId + 1 }));
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }],
    }));
    // 自动移除
    setTimeout(() => get().remove(id), duration);
  },

  remove: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clear: () => set({ toasts: [] }),

  // 快捷方法
  success: (msg) => get().add(msg, 'success', 3000),
  error: (msg) => get().add(msg, 'error', 5000),
  warning: (msg) => get().add(msg, 'warning', 4000),
  info: (msg) => get().add(msg, 'info', 3000),
}));

// 使用
const toast = useToastStore.getState();
toast.success('保存成功！');
toast.error('网络错误，请重试');
toast.warning('余额不足');
console.log('当前 Toast 数:', toast.toasts.length); // 3
```

### 示例 11：全局键盘快捷键

```javascript
const useHotkeyStore = createMiniZustand((set, get) => ({
  bindings: {}, // { 'Ctrl+S': handler, 'Ctrl+Z': handler }
  enabled: true,

  // 注册快捷键
  register: (keyCombo, handler) =>
    set((state) => ({
      bindings: { ...state.bindings, [keyCombo]: handler },
    })),

  // 注销快捷键
  unregister: (keyCombo) =>
    set((state) => {
      const newBindings = { ...state.bindings };
      delete newBindings[keyCombo];
      return { bindings: newBindings };
    }),

  // 启用/禁用
  toggle: () => set((state) => ({ enabled: !state.enabled })),

  // 处理键盘事件 (在 useEffect 中绑定)
  handleKeyDown: (e) => {
    if (!get().enabled) return;
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    const combo = parts.join('+');
    const handler = get().bindings[combo];
    if (handler) {
      e.preventDefault();
      handler(e);
      return true;
    }
    return false;
  },
}));

// 使用
const hotkey = useHotkeyStore.getState();
hotkey.register('Ctrl+S', () => console.log('💾 保存！'));
hotkey.register('Ctrl+Z', () => console.log('↩️ 撤销！'));
hotkey.register('Ctrl+Shift+K', () => console.log('🔍 命令面板！'));

// 模拟键盘事件
hotkey.handleKeyDown({
  ctrlKey: true,
  shiftKey: false,
  altKey: false,
  key: 's',
  preventDefault: () => {},
}); // 💾 保存！
```

### 示例 12：状态持久化 + 时间旅行

```javascript
/**
 * 带持久化和时间旅行的 Zustand store
 */
function createPersistentStore(name, defaultState, createFn) {
  const STORAGE_KEY = `store_${name}`;

  // 从 localStorage 恢复
  let savedState = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) savedState = JSON.parse(raw);
  } catch {}

  const initialState = savedState || defaultState;

  const store = createMiniZustand((set, get) => ({
    ...initialState,
    // 时间旅行
    _past: [],
    _future: [],

    // 持久化包装的 set
    persistSet: (partial, replace) => {
      const currentState = get();
      set((state) => ({
        ...(typeof partial === 'function' ? partial(state) : partial),
        _past: [...state._past, currentState],
        _future: [],
      }));
      try {
        const { _past, _future, ...rest } = get();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
      } catch {}
    },

    // 撤销
    undo: () => {
      const { _past, ...rest } = get();
      if (_past.length === 0) return;
      const previous = _past[_past.length - 1];
      set({
        ...previous,
        _past: _past.slice(0, -1),
        _future: [rest, ...(get()._future || [])],
      });
    },

    // 重做
    redo: () => {
      const { _future } = get();
      if (_future.length === 0) return;
      const next = _future[0];
      set({
        ...next,
        _past: [...get()._past, get()],
        _future: _future.slice(1),
      });
    },

    // 清除持久化
    clearStorage: () => {
      localStorage.removeItem(STORAGE_KEY);
      set({ ...defaultState, _past: [], _future: [] });
    },
  }));

  // 注入用户自定义 actions
  const customActions = createFn(store.setState, store.getState);
  Object.assign(store.getState, customActions);

  return store;
}

// 使用：带持久化的笔记应用
const useNotesStore = createPersistentStore(
  'notes',
  { notes: [], selectedId: null },
  (setState, getState) => ({
    addNote: (title) => {
      const state = getState();
      setState((s) => ({
        notes: [
          ...s.notes,
          { id: Date.now(), title, content: '', createdAt: Date.now() },
        ],
        selectedId: Date.now(),
      }));
    },
    updateNote: (id, content) => {
      setState((s) => ({
        notes: s.notes.map((n) => (n.id === id ? { ...n, content } : n)),
      }));
    },
    deleteNote: (id) => {
      setState((s) => ({
        notes: s.notes.filter((n) => n.id !== id),
        selectedId:
          s.selectedId === id ? null : s.selectedId,
      }));
    },
  })
);

// 使用
const notes = useNotesStore.getState();
notes.addNote('我的第一篇笔记');
notes.updateNote(notes.notes[0].id, '这是内容...');
notes.addNote('第二篇笔记');
console.log('笔记数:', notes.notes.length); // 2
// 撤销
notes.undo();
console.log('撤销后:', notes.notes.length); // 1
// 重做
notes.redo();
console.log('重做后:', notes.notes.length); // 2
```

---

## 五、Redux 中间件实战

### 5.1 Logger 中间件

```javascript
const logger = (store) => (next) => (action) => {
  console.group(`🔵 ${action.type}`);
  console.log('prev:', store.getState());
  console.log('action:', action);
  const result = next(action);
  console.log('next:', store.getState());
  console.groupEnd();
  return result;
};
```

### 5.2 Thunk 中间件 (异步 Action)

```javascript
const thunk = (store) => (next) => (action) => {
  if (typeof action === 'function') {
    return action(store.dispatch, store.getState);
  }
  return next(action);
};

// 使用
const asyncAdd = (amount) => (dispatch, getState) => {
  setTimeout(() => {
    console.log('异步完成，当前 count:', getState().count);
    dispatch({ type: 'ADD', payload: amount });
  }, 1000);
};

// 带中间件的 store
const enhancedStore = new MiniRedux(counterReducer, { count: 0 });
// 实际 Redux 中通过 applyMiddleware 注入
```

### 5.3 持久化中间件

```javascript
const persistMiddleware = (storageKey) => (store) => (next) => (action) => {
  const result = next(action);
  try {
    localStorage.setItem(storageKey, JSON.stringify(store.getState()));
  } catch {}
  return result;
};
```

---

## 六、状态管理最佳实践

### 6.1 何时需要全局状态？

| 场景 | 方案 |
|------|------|
| 组件内部 UI 状态 | `useState` / `useReducer` |
| 跨组件共享数据 | Zustand / Redux Toolkit |
| 服务端缓存 | React Query / SWR |
| URL 参数 | React Router / Next.js |
| 表单状态 | React Hook Form / Formik |
| 主题/国际化 | Context + Zustand |

### 6.2 状态规范化原则

```javascript
// ❌ 嵌套结构 (难更新)
{
  users: [
    { id: 1, name: 'Alice', posts: [{ id: 1, title: 'Hello' }] }
  ]
}

// ✅ 规范化结构 (易更新)
{
  users: {
    1: { id: 1, name: 'Alice', postIds: [1] }
  },
  posts: {
    1: { id: 1, title: 'Hello', authorId: 1 }
  }
}
```

### 6.3 选择器模式 (性能优化)

```javascript
// ❌ 每次任何状态变化都触发重渲染
const state = useStore();
const count = state.count;

// ✅ 只订阅关心的 slice
const count = useStore((state) => state.count);

// ✅ 带记忆化选择器
const selectTotal = (state) =>
  state.items.reduce((sum, i) => sum + i.price * i.qty, 0);
const total = useStore(selectTotal);
```

---

## 七、面试高频考点

### Q1: Redux 为什么要求 reducer 是纯函数？

**答：** 纯函数保证相同的输入产生相同的输出，这使得：
- 状态变更可预测、可重现
- 支持时间旅行调试 (撤销/重做)
- 支持 SSR (服务端渲染时状态可序列化)
- 支持热更新 (replaceReducer)

### Q2: Redux 和 Zustand 的核心区别？

**答：**
- Redux: 不可变状态 + action/reducer 模式 + 强约定，适合大型项目
- Zustand: 可变状态 + set/get 直接 API + 极简，适合中小型项目
- Redux 有 devtools 支持 (action log)，Zustand 可通过 middleware 实现
- Zustand 的选择器订阅天然优化渲染，Redux 需配合 useSelector

### Q3: 如何实现 Redux 的 undo/redo？

**答：** 维护 `_past` 和 `_future` 两个数组：
- 每次 dispatch 时，将当前状态推入 `_past`
- undo 时，从 `_past` 弹出最后一个状态，当前状态推入 `_future`
- redo 时，从 `_future` 弹出第一个状态，当前状态推入 `_past`

### Q4: 中间件的原理是什么？

**答：** 中间件本质是 **函数组合**，通过 `compose` 将多个中间件串联：
```
dispatch → middleware1 → middleware2 → ... → originalDispatch
```
每个中间件接收 `{ getState, dispatch }`，返回 `(next) => (action) => result` 的柯里化函数。

---

## 八、自测题

1. **手写一个 `createStore`，支持 `getState`/`dispatch`/`subscribe`**
2. **实现 `combineReducers`，支持多个 reducer 合并**
3. **实现 `applyMiddleware`，支持 logger + thunk 中间件**
4. **用 Zustand 模式实现一个带持久化的计数器**
5. **解释 Redux 的 action → reducer → state 数据流**

---

## 九、总结

| 核心概念 | 一句话 |
|----------|--------|
| 单一数据源 | 整个应用只有一个 state 树 |
| State 只读 | 只能通过 dispatch(action) 修改 |
| Reducer 纯函数 | `(state, action) => newState`，无副作用 |
| 订阅机制 | `subscribe(listener)` 通知视图更新 |
| 中间件 | 拦截 action，支持异步/日志/持久化 |
| 选择器 | 只订阅关心的 state slice，避免不必要的渲染 |
| 规范化 | 扁平化存储，通过 id 关联，便于更新 |

**本专项累计：**
- 2 个核心实现 (MiniRedux ~80 行 + MiniZustand ~50 行)
- 12 个完整示例 (Todo/购物车/认证/主题/表单/Tree/Tab/WebSocket/拖拽/Toast/快捷键/持久化)
- 3 个中间件 (Logger/Thunk/Persist)
- 4 道面试问答 + 5 道自测题
