# 专项训练 11:00 - 状态管理

> 实现简易 Redux/Zustand，理解状态管理原理，写 10+ 状态管理示例

---

## 📚 一、状态管理核心原理

### 为什么需要状态管理？

1. **单一数据源 (Single Source of Truth)** - 所有状态集中在一处
2. **可预测性 (Predictability)** - 状态变化只能通过特定方式
3. **可追踪性 (Traceability)** - 每次变化都有记录
4. **解耦 (Decoupling)** - 组件不直接互相通信

### 核心概念

```
State (状态) → Action (动作) → Reducer (处理器) → New State (新状态)
                    ↑                                    ↓
                    └────────── Dispatch ────────────────┘
```

---

## 🔧 二、实现简易 Redux (50 行核心代码)

```javascript
// mini-redux.js

// 1. createStore - 创建状态仓库
function createStore(reducer, initialState) {
  let state = initialState;
  let listeners = [];

  // 获取当前状态
  const getState = () => state;

  // 订阅状态变化
  const subscribe = (listener) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  };

  // 分发 action，触发状态更新
  const dispatch = (action) => {
    state = reducer(state, action);
    listeners.forEach(listener => listener());
    return action;
  };

  // 初始化
  dispatch({ type: '@@INIT' });

  return { getState, dispatch, subscribe };
}

// 2. combineReducers - 组合多个 reducer
function combineReducers(reducers) {
  return (state = {}, action) => {
    return Object.keys(reducers).reduce((nextState, key) => {
      nextState[key] = reducers[key](state[key], action);
      return nextState;
    }, {});
  };
}

// 3. applyMiddleware - 中间件支持
function applyMiddleware(...middlewares) {
  return (createStoreFn) => (reducer, initialState) => {
    const store = createStoreFn(reducer, initialState);
    const chain = middlewares.map(mw => mw(store));
    const dispatch = chain.reduce((a, b) => () => a(b))(store.dispatch);
    return { ...store, dispatch };
  };
}

module.exports = { createStore, combineReducers, applyMiddleware };
```

### 使用示例

```javascript
// counter-reducer.js
const { createStore } = require('./mini-redux');

// Reducer
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

// 创建 store
const store = createStore(counterReducer);

// 订阅
store.subscribe(() => {
  console.log('当前计数:', store.getState().count);
});

// 分发 action
store.dispatch({ type: 'INCREMENT' }); // 1
store.dispatch({ type: 'INCREMENT' }); // 2
store.dispatch({ type: 'ADD', payload: 5 }); // 7
```

---

## 🎯 三、实现简易 Zustand (30 行核心代码)

```javascript
// mini-zustand.js

// 核心：create 函数
function create(createFn) {
  let state = null;
  let listeners = new Set();

  // 初始化状态
  const setState = (partial, replace) => {
    const nextState = typeof partial === 'function' 
      ? partial(state) 
      : partial;
    
    if (replace) {
      state = nextState;
    } else {
      state = { ...state, ...nextState };
    }
    
    // 通知所有订阅者
    listeners.forEach(listener => listener(state));
  };

  // 获取状态
  const getState = () => state;

  // 订阅
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  // 初始化
  const api = { setState, getState, subscribe };
  state = createFn(setState, getState, api);

  // 返回 hook 风格的函数
  return (selector = (s) => s, equalityFn) => {
    const selectedState = selector(state);
    return selectedState;
  };
}

module.exports = { create };
```

### 使用示例

```javascript
// useStore.js
const { create } = require('./mini-zustand');

// 创建 store
const useStore = create((set, get) => ({
  // 状态
  count: 0,
  name: 'Guest',
  todos: [],
  
  // Actions (直接放在 state 里的方法)
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  setName: (name) => set({ name }),
  addTodo: (text) => set((state) => ({
    todos: [...state.todos, { id: Date.now(), text, done: false }]
  })),
  toggleTodo: (id) => set((state) => ({
    todos: state.todos.map(t => 
      t.id === id ? { ...t, done: !t.done } : t
    )
  }))
}));

// 使用
const store = useStore();
console.log(store.count); // 0

store.getState().increment();
console.log(store.getState().count); // 1
```

---

## 📝 四、10+ 状态管理示例

### 示例 1: 计数器 (Counter)

```javascript
// 最简单的状态管理
const counterStore = create((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
  decrement: () => set((s) => ({ count: s.count - 1 })),
  reset: () => set({ count: 0 }),
  add: (n) => set((s) => ({ count: s.count + n })),
}));
```

### 示例 2: 用户认证 (Auth)

```javascript
const authStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  
  login: (credentials) => {
    // 模拟 API 调用
    const user = { id: 1, name: credentials.username };
    const token = 'fake-jwt-token';
    set({ user, token, isAuthenticated: true });
  },
  
  logout: () => set({ user: null, token: null, isAuthenticated: false }),
  
  updateUser: (data) => set((s) => ({
    user: { ...s.user, ...data }
  })),
}));
```

### 示例 3: 购物车 (Cart)

```javascript
const cartStore = create((set, get) => ({
  items: [],
  
  addItem: (product, quantity = 1) => {
    const { items } = get();
    const existing = items.find(i => i.id === product.id);
    
    if (existing) {
      set({
        items: items.map(i => 
          i.id === product.id 
            ? { ...i, quantity: i.quantity + quantity }
            : i
        )
      });
    } else {
      set({ items: [...items, { ...product, quantity }] });
    }
  },
  
  removeItem: (id) => set((s) => ({
    items: s.items.filter(i => i.id !== id)
  })),
  
  updateQuantity: (id, quantity) => set((s) => ({
    items: s.items.map(i => 
      i.id === id ? { ...i, quantity } : i
    )
  })),
  
  clearCart: () => set({ items: [] }),
  
  // 派生状态
  get totalItems() {
    return get().items.reduce((sum, i) => sum + i.quantity, 0);
  },
  
  get totalPrice() {
    return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  },
}));
```

### 示例 4: 主题切换 (Theme)

```javascript
const themeStore = create((set) => ({
  theme: 'light',
  colors: {
    light: { bg: '#ffffff', text: '#000000' },
    dark: { bg: '#1a1a1a', text: '#ffffff' },
  },
  
  toggleTheme: () => set((s) => ({
    theme: s.theme === 'light' ? 'dark' : 'light'
  })),
  
  setTheme: (theme) => set({ theme }),
  
  get currentColors() {
    const s = this.getState();
    return s.colors[s.theme];
  },
}));
```

### 示例 5: 待办事项 (Todo List)

```javascript
const todoStore = create((set, get) => ({
  todos: [],
  filter: 'all', // all | active | completed
  
  addTodo: (text) => set((s) => ({
    todos: [...s.todos, {
      id: Date.now(),
      text,
      completed: false,
      createdAt: new Date().toISOString(),
    }]
  })),
  
  toggleTodo: (id) => set((s) => ({
    todos: s.todos.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    )
  })),
  
  deleteTodo: (id) => set((s) => ({
    todos: s.todos.filter(t => t.id !== id)
  })),
  
  editTodo: (id, text) => set((s) => ({
    todos: s.todos.map(t => 
      t.id === id ? { ...t, text } : t
    )
  })),
  
  clearCompleted: () => set((s) => ({
    todos: s.todos.filter(t => !t.completed)
  })),
  
  setFilter: (filter) => set({ filter }),
  
  get filteredTodos() {
    const { todos, filter } = get();
    switch (filter) {
      case 'active': return todos.filter(t => !t.completed);
      case 'completed': return todos.filter(t => t.completed);
      default: return todos;
    }
  },
  
  get stats() {
    const { todos } = get();
    return {
      total: todos.length,
      active: todos.filter(t => !t.completed).length,
      completed: todos.filter(t => t.completed).length,
    };
  },
}));
```

### 示例 6: API 请求状态 (API Loading)

```javascript
const apiStore = create((set) => ({
  loading: {},
  errors: {},
  data: {},
  
  startRequest: (key) => set((s) => ({
    loading: { ...s.loading, [key]: true },
    errors: { ...s.errors, [key]: null },
  })),
  
  successRequest: (key, data) => set((s) => ({
    loading: { ...s.loading, [key]: false },
    data: { ...s.data, [key]: data },
  })),
  
  failRequest: (key, error) => set((s) => ({
    loading: { ...s.loading, [key]: false },
    errors: { ...s.errors, [key]: error },
  })),
  
  clearError: (key) => set((s) => ({
    errors: { ...s.errors, [key]: null }
  })),
  
  isLoading: (key) => this.getState().loading[key] || false,
  getError: (key) => this.getState().errors[key],
  getData: (key) => this.getState().data[key],
}));

// 使用示例
async function fetchUser(id) {
  apiStore.getState().startRequest(`user-${id}`);
  try {
    const res = await fetch(`/api/users/${id}`);
    const data = await res.json();
    apiStore.getState().successRequest(`user-${id}`, data);
  } catch (error) {
    apiStore.getState().failRequest(`user-${id}`, error.message);
  }
}
```

### 示例 7: 表单状态 (Form)

```javascript
const formStore = create((set, get) => ({
  values: {},
  errors: {},
  touched: {},
  isSubmitting: false,
  
  setFieldValue: (field, value) => set((s) => ({
    values: { ...s.values, [field]: value }
  })),
  
  setFieldError: (field, error) => set((s) => ({
    errors: { ...s.errors, [field]: error }
  })),
  
  setFieldTouched: (field) => set((s) => ({
    touched: { ...s.touched, [field]: true }
  })),
  
  setValues: (values) => set({ values }),
  
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  
  resetForm: (initialValues = {}) => set({
    values: initialValues,
    errors: {},
    touched: {},
    isSubmitting: false,
  }),
  
  validateField: (field, validator) => {
    const { values } = get();
    const error = validator(values[field], values);
    if (error) {
      get().setFieldError(field, error);
    }
    return !error;
  },
}));
```

### 示例 8: 模态框/对话框 (Modal)

```javascript
const modalStore = create((set) => ({
  modals: [], // 支持多层模态
  
  openModal: (config) => set((s) => ({
    modals: [...s.modals, { 
      id: Date.now(), 
      ...config,
      isOpen: true 
    }]
  })),
  
  closeModal: (id) => set((s) => ({
    modals: s.modals.filter(m => m.id !== id)
  })),
  
  closeAllModals: () => set({ modals: [] }),
  
  updateModal: (id, config) => set((s) => ({
    modals: s.modals.map(m => 
      m.id === id ? { ...m, ...config } : m
    )
  })),
  
  currentModal: () => {
    const modals = modalStore.getState().modals;
    return modals[modals.length - 1] || null;
  },
}));

// 使用
modalStore.getState().openModal({
  type: 'confirm',
  title: '确认删除',
  content: '确定要删除这个项目吗？',
  onConfirm: () => { /* ... */ },
  onCancel: () => { /* ... */ },
});
```

### 示例 9: 通知系统 (Notification/Toast)

```javascript
const notificationStore = create((set) => ({
  notifications: [],
  
  addNotification: (notification) => set((s) => ({
    notifications: [...s.notifications, {
      id: Date.now(),
      type: 'info', // info | success | warning | error
      duration: 3000,
      ...notification,
    }]
  })),
  
  removeNotification: (id) => set((s) => ({
    notifications: s.notifications.filter(n => n.id !== id)
  })),
  
  // 快捷方法
  info: (message) => get().addNotification({ message, type: 'info' }),
  success: (message) => get().addNotification({ message, type: 'success' }),
  warning: (message) => get().addNotification({ message, type: 'warning' }),
  error: (message) => get().addNotification({ message, type: 'error' }),
  
  clearAll: () => set({ notifications: [] }),
}));
```

### 示例 10: 游戏状态 (Game State)

```javascript
const gameStore = create((set, get) => ({
  // 游戏状态
  status: 'idle', // idle | playing | paused | gameover
  score: 0,
  level: 1,
  lives: 3,
  player: { x: 0, y: 0, direction: 'right' },
  enemies: [],
  powerups: [],
  
  // 游戏控制
  startGame: () => set({
    status: 'playing',
    score: 0,
    level: 1,
    lives: 3,
    player: { x: 50, y: 50, direction: 'right' },
    enemies: generateEnemies(1),
    powerups: generatePowerups(3),
  }),
  
  pauseGame: () => set({ status: 'paused' }),
  resumeGame: () => set({ status: 'playing' }),
  gameOver: () => set({ status: 'gameover' }),
  
  // 玩家移动
  movePlayer: (dx, dy) => set((s) => ({
    player: {
      ...s.player,
      x: s.player.x + dx,
      y: s.player.y + dy,
    }
  })),
  
  // 得分
  addScore: (points) => set((s) => {
    const newScore = s.score + points;
    const newLevel = Math.floor(newScore / 1000) + 1;
    return {
      score: newScore,
      level: newLevel > s.level ? newLevel : s.level,
    };
  }),
  
  // 受伤
  hit: () => set((s) => {
    const newLives = s.lives - 1;
    return {
      lives: newLives,
      status: newLives <= 0 ? 'gameover' : s.status,
      player: { x: 50, y: 50, direction: 'right' }, // 重生
    };
  }),
  
  // 派生状态
  get isPlaying() { return get().status === 'playing'; },
  get isPaused() { return get().status === 'paused'; },
}));
```

### 示例 11: WebSocket 连接状态

```javascript
const wsStore = create((set, get) => ({
  connected: false,
  messages: [],
  lastMessage: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  
  connect: (url) => {
    const ws = new WebSocket(url);
    
    ws.onopen = () => set({ 
      connected: true, 
      reconnectAttempts: 0 
    });
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      set((s) => ({
        messages: [...s.messages.slice(-99), data], // 保留最近 100 条
        lastMessage: data,
      }));
    };
    
    ws.onclose = () => {
      set({ connected: false });
      get().reconnect(url);
    };
    
    ws.onerror = (error) => {
      console.error('WS Error:', error);
    };
    
    return ws;
  },
  
  reconnect: (url) => {
    const { reconnectAttempts, maxReconnectAttempts } = get();
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }
    
    set((s) => ({ reconnectAttempts: s.reconnectAttempts + 1 }));
    setTimeout(() => get().connect(url), 1000 * reconnectAttempts);
  },
  
  send: (data) => {
    // 需要通过外部持有 ws 实例
    console.log('Sending:', data);
  },
  
  disconnect: () => set({ 
    connected: false, 
    messages: [], 
    lastMessage: null 
  }),
  
  clearMessages: () => set({ messages: [] }),
}));
```

### 示例 12: 文件上传队列

```javascript
const uploadStore = create((set, get) => ({
  queue: [],
  isUploading: false,
  concurrentLimit: 3,
  
  addFiles: (files) => set((s) => ({
    queue: [...s.queue, ...files.map(f => ({
      file: f,
      id: `${f.name}-${Date.now()}`,
      progress: 0,
      status: 'pending', // pending | uploading | success | error
      error: null,
    }))]
  })),
  
  removeFile: (id) => set((s) => ({
    queue: s.queue.filter(f => f.id !== id)
  })),
  
  updateProgress: (id, progress) => set((s) => ({
    queue: s.queue.map(f => 
      f.id === id ? { ...f, progress } : f
    )
  })),
  
  setStatus: (id, status, error = null) => set((s) => ({
    queue: s.queue.map(f => 
      f.id === id ? { ...f, status, error } : f
    )
  })),
  
  get pendingFiles() {
    return get().queue.filter(f => f.status === 'pending');
  },
  
  get uploadingFiles() {
    return get().queue.filter(f => f.status === 'uploading');
  },
  
  get completedFiles() {
    return get().queue.filter(f => f.status === 'success');
  },
  
  get failedFiles() {
    return get().queue.filter(f => f.status === 'error');
  },
  
  get overallProgress() {
    const { queue } = get();
    if (queue.length === 0) return 0;
    const total = queue.reduce((sum, f) => sum + f.progress, 0);
    return total / queue.length;
  },
  
  clearCompleted: () => set((s) => ({
    queue: s.queue.filter(f => f.status !== 'success')
  })),
  
  retryFailed: () => {
    const failed = get().failedFiles;
    get().setStatus(failed.map(f => f.id), 'pending');
  },
}));
```

### 示例 13: 搜索状态 (带防抖)

```javascript
const searchStore = create((set, get) => ({
  query: '',
  results: [],
  isLoading: false,
  error: null,
  page: 1,
  totalPages: 1,
  debounceTimer: null,
  
  setQuery: (query) => {
    // 清除之前的定时器
    const { debounceTimer } = get();
    if (debounceTimer) clearTimeout(debounceTimer);
    
    set({ query });
    
    // 防抖搜索
    if (query.trim()) {
      const timer = setTimeout(() => {
        get().search(query);
      }, 300);
      
      set({ debounceTimer: timer });
    } else {
      set({ results: [], page: 1, totalPages: 1 });
    }
  },
  
  search: async (query) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/search?q=${query}&page=${get().page}`);
      const data = await res.json();
      set({ 
        results: data.results, 
        totalPages: data.totalPages,
        isLoading: false 
      });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  setPage: (page) => {
    set({ page });
    get().search(get().query);
  },
  
  clearSearch: () => set({
    query: '',
    results: [],
    isLoading: false,
    error: null,
    page: 1,
    totalPages: 1,
  }),
}));
```

### 示例 14: 多步骤表单 (Wizard)

```javascript
const wizardStore = create((set, get) => ({
  currentStep: 0,
  steps: [],
  data: {},
  errors: {},
  
  initialize: (steps) => set({ 
    steps, 
    currentStep: 0, 
    data: {}, 
    errors: {} 
  }),
  
  nextStep: () => {
    const { currentStep, steps } = get();
    if (currentStep < steps.length - 1) {
      set({ currentStep: currentStep + 1 });
      return true;
    }
    return false;
  },
  
  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 0) {
      set({ currentStep: currentStep - 1 });
      return true;
    }
    return false;
  },
  
  goToStep: (step) => {
    const { steps } = get();
    if (step >= 0 && step < steps.length) {
      set({ currentStep: step });
    }
  },
  
  setStepData: (data) => set((s) => ({
    data: { ...s.data, ...data }
  })),
  
  setStepErrors: (errors) => set((s) => ({
    errors: { ...s.errors, ...errors }
  })),
  
  clearStepErrors: () => set({ errors: {} }),
  
  reset: () => set({ 
    currentStep: 0, 
    data: {}, 
    errors: {} 
  }),
  
  // 派生状态
  get currentStepData() {
    const { steps, currentStep } = get();
    return steps[currentStep];
  },
  
  get isLastStep() {
    const { currentStep, steps } = get();
    return currentStep === steps.length - 1;
  },
  
  get isFirstStep() {
    return get().currentStep === 0;
  },
  
  get progress() {
    const { currentStep, steps } = get();
    return ((currentStep + 1) / steps.length) * 100;
  },
}));
```

### 示例 15: 协作编辑 (CRDT 简化版)

```javascript
const collabStore = create((set, get) => ({
  content: '',
  version: 0,
  collaborators: [],
  pendingChanges: [],
  isConnected: false,
  
  // 本地编辑
  edit: (position, insert, deleteCount = 0) => {
    const { content, version } = get();
    const newContent = 
      content.slice(0, position) + 
      insert + 
      content.slice(position + deleteCount);
    
    const change = {
      type: 'edit',
      position,
      insert,
      deleteCount,
      version: version + 1,
      timestamp: Date.now(),
      clientId: getClientId(),
    };
    
    set({ 
      content: newContent, 
      version: version + 1,
      pendingChanges: [...get().pendingChanges, change]
    });
    
    // 同步到服务器
    syncChange(change);
  },
  
  // 接收远程变更
  receiveChange: (change) => {
    const { version, content } = get();
    
    // 简单版本冲突处理：后来者优先
    if (change.version <= version) return;
    
    const newContent = 
      content.slice(0, change.position) + 
      change.insert + 
      content.slice(change.position + change.deleteCount);
    
    set({ 
      content: newContent, 
      version: change.version 
    });
  },
  
  // 协作者管理
  addCollaborator: (user) => set((s) => ({
    collaborators: [...s.collaborators, user]
  })),
  
  removeCollaborator: (userId) => set((s) => ({
    collaborators: s.collaborators.filter(c => c.id !== userId)
  })),
  
  updateCollaboratorCursor: (userId, position) => set((s) => ({
    collaborators: s.collaborators.map(c =>
      c.id === userId ? { ...c, cursor: position } : c
    )
  })),
  
  connect: () => set({ isConnected: true }),
  disconnect: () => set({ isConnected: false }),
  
  // 派生状态
  get hasPendingChanges() {
    return get().pendingChanges.length > 0;
  },
  
  get activeCollaborators() {
    return get().collaborators.filter(c => c.isOnline);
  },
}));
```

---

## 🧪 五、中间件示例

### Logger 中间件

```javascript
// 记录所有 action
const loggerMiddleware = (store) => (next) => (action) => {
  console.group(action.type);
  console.log('Prev state:', store.getState());
  console.log('Action:', action);
  const result = next(action);
  console.log('Next state:', store.getState());
  console.groupEnd();
  return result;
};
```

### Thunk 中间件 (支持异步 action)

```javascript
// 允许 dispatch 函数
const thunkMiddleware = (store) => (next) => (action) => {
  if (typeof action === 'function') {
    return action(store.dispatch, store.getState);
  }
  return next(action);
};

// 使用
const fetchUser = (id) => async (dispatch, getState) => {
  dispatch({ type: 'FETCH_USER_START', payload: id });
  try {
    const res = await fetch(`/api/users/${id}`);
    const user = await res.json();
    dispatch({ type: 'FETCH_USER_SUCCESS', payload: user });
  } catch (error) {
    dispatch({ type: 'FETCH_USER_ERROR', payload: error.message });
  }
};

// 在 store 中使用
const store = createStore(
  reducer,
  applyMiddleware(thunkMiddleware, loggerMiddleware)
);

store.dispatch(fetchUser(1));
```

### Persist 中间件 (本地存储持久化)

```javascript
// 自动保存到 localStorage
const persistMiddleware = (store) => (next) => (action) => {
  const result = next(action);
  const state = store.getState();
  
  try {
    localStorage.setItem('app-state', JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to persist state:', error);
  }
  
  return result;
};

// 加载持久化的状态
function loadPersistedState() {
  try {
    const saved = localStorage.getItem('app-state');
    return saved ? JSON.parse(saved) : undefined;
  } catch {
    return undefined;
  }
}

const store = createStore(
  reducer,
  loadPersistedState(),
  applyMiddleware(persistMiddleware)
);
```

---

## 📊 六、Redux vs Zustand 对比

| 特性 | Redux | Zustand |
|------|-------|---------|
| 代码量 | 较多 (boilerplate) | 极少 |
| 学习曲线 | 陡峭 | 平缓 |
| Action 类型 | 必须定义 | 可选 |
| Reducer | 必须 | 不需要 |
| 中间件 | 内置支持 | 需要自行实现 |
| DevTools | 官方支持 | 社区支持 |
| 包大小 | ~3kb | ~1kb |
| 适用场景 | 大型应用、复杂状态流 | 中小型应用、快速开发 |

---

## ✅ 七、最佳实践

1. **保持状态扁平** - 避免深层嵌套
2. **单一职责** - 每个 store 只做一件事
3. **不可变更新** - 永远不要直接修改 state
4. **派生状态** - 能用计算得出的就不要存
5. **选择器优化** - 只订阅需要的部分
6. **避免过度设计** - 能用 props 就不用 store

---

## 🎓 总结

状态管理的核心是：
- **集中管理** - 所有状态在一处
- **单向数据流** - 状态变化可预测
- **可追踪** - 每次变化都有迹可循

Redux 和 Zustand 只是实现方式不同，核心思想一致。理解原理比记住 API 更重要！
