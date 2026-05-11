# 专项训练：状态管理

> 实现简易 Redux/Zustand，理解状态管理原理
> 日期：2026-05-09
> 核心目标：手写状态管理库 + 10+ 示例，彻底理解状态管理本质

---

## 一、状态管理本质

状态管理的本质就三件事：

1. **存储** — 有一个地方放数据（state）
2. **读取** — 能拿到数据（selector/getter）
3. **更新 + 通知** — 改数据时通知所有监听者（dispatch + subscribe）

所有框架（Redux/Zustand/Pinia/Vuex）都是这三件事的不同包装。

---

## 二、从零实现 Redux

### Redux 核心概念

```
Action → Dispatcher → Reducer → State → Subscriber
```

- **Action**: 描述"发生了什么"的纯对象 `{ type, payload }`
- **Reducer**: 纯函数 `(state, action) => newState`
- **Store**: 持有 state，提供 `getState()`, `dispatch()`, `subscribe()`
- **Middleware**: dispatch 和 reducer 之间的拦截器

### 实现 1：最简 Redux Store

```js
// === 最简 Redux Store ===
function createStore(reducer, initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    getState() {
      return state;
    },

    dispatch(action) {
      state = reducer(state, action);
      listeners.forEach((listener) => listener());
      return action;
    },

    subscribe(listener) {
      listeners.add(listener);
      // 返回取消订阅函数
      return () => listeners.delete(listener);
    },
  };
}

// --- 使用 ---
const counterReducer = (state = { count: 0 }, action) => {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + 1 };
    case 'DECREMENT':
      return { count: state.count - 1 };
    case 'SET':
      return { count: action.payload };
    default:
      return state;
  }
};

const store = createStore(counterReducer, { count: 0 });

// 订阅
const unsub = store.subscribe(() => {
  console.log('count 变了:', store.getState().count);
});

store.dispatch({ type: 'INCREMENT' }); // count 变了: 1
store.dispatch({ type: 'INCREMENT' }); // count 变了: 2
store.dispatch({ type: 'SET', payload: 10 }); // count 变了: 10

unsub(); // 取消订阅
store.dispatch({ type: 'INCREMENT' }); // 无输出
```

### 实现 2：带 Middleware 的 Redux

```js
// === 带 Middleware 的 Redux ===
function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, initialState) => {
    const store = createStore(reducer, initialState);
    let dispatch = store.dispatch;

    // middleware 拿到 getState 和 dispatch 的引用
    const middlewareAPI = {
      getState: store.getState,
      dispatch: (action) => dispatch(action),
    };

    // 链式组合 middleware
    dispatch = middlewares
      .map((mw) => mw(middlewareAPI))
      .reduce((chain, mw) => mw(chain), store.dispatch);

    return { ...store, dispatch };
  };
}

// --- Logger Middleware ---
const logger = (api) => (next) => (action) => {
  console.log('📤 dispatch:', action.type);
  console.log('  before:', api.getState());
  const result = next(action);
  console.log('  after:', api.getState());
  return result;
};

// --- 异步 Action Middleware (简易 thunk) ---
const thunkMiddleware = (api) => (next) => (action) => {
  if (typeof action === 'function') {
    return action(api.dispatch, api.getState);
  }
  return next(action);
};

// --- 使用 ---
const todoReducer = (state = { todos: [] }, action) => {
  switch (action.type) {
    case 'ADD_TODO':
      return { todos: [...state.todos, action.payload] };
    case 'TOGGLE_TODO':
      return {
        todos: state.todos.map((t, i) =>
          i === action.payload ? { ...t, done: !t.done } : t
        ),
      };
    default:
      return state;
  }
};

const todoStore = applyMiddleware(logger, thunkMiddleware)(createStore)(
  todoReducer,
  { todos: [] }
);

// 同步 action
todoStore.dispatch({ type: 'ADD_TODO', payload: '学 Redux' });
todoStore.dispatch({ type: 'ADD_TODO', payload: '写示例' });
todoStore.dispatch({ type: 'TOGGLE_TODO', payload: 0 });

// 异步 action (thunk)
todoStore.dispatch((dispatch, getState) => {
  setTimeout(() => {
    dispatch({ type: 'ADD_TODO', payload: '异步加载的 todo' });
    console.log('当前 todos:', getState().todos.length);
  }, 100);
});
```

### 实现 3：combineReducers

```js
// === combineReducers ===
function combineReducers(reducers) {
  return (state = {}, action) => {
    const nextState = {};
    let hasChanged = false;

    for (const key of Object.keys(reducers)) {
      const prevSlice = state[key];
      const nextSlice = reducers[key](prevSlice, action);
      nextState[key] = nextSlice;
      hasChanged = hasChanged || nextSlice !== prevSlice;
    }

    return hasChanged ? nextState : state;
  };
}

// --- 使用 ---
const countReducer = (state = 0, action) => {
  switch (action.type) {
    case 'INC': return state + 1;
    case 'DEC': return state - 1;
    default: return state;
  }
};

const userReducer = (state = { name: '', loggedIn: false }, action) => {
  switch (action.type) {
    case 'LOGIN':
      return { name: action.payload, loggedIn: true };
    case 'LOGOUT':
      return { name: '', loggedIn: false };
    default:
      return state;
  }
};

const rootReducer = combineReducers({ count: countReducer, user: userReducer });
const appStore = createStore(rootReducer, { count: 0, user: { name: '', loggedIn: false } });

appStore.subscribe(() => {
  console.log('app state:', JSON.stringify(appStore.getState()));
});

appStore.dispatch({ type: 'INC' });
appStore.dispatch({ type: 'LOGIN', payload: '娄总' });
```

---

## 三、从零实现 Zustand

### Zustand 核心概念

- 用 **hook** 形式暴露 store（`useStore()`）
- **selector** 精确订阅，避免不必要的重渲染
- 直接在 `set` 里写更新逻辑，不需要 action/reducer
- 支持中间件（persist, devtools, immer 等）

### 实现 4：最简 Zustand

```js
// === 最简 Zustand Store ===
function createZustand(createStoreFn) {
  let state;
  const listeners = new Set();

  // 初始化 store
  const setState = (partial) => {
    const nextState =
      typeof partial === 'function'
        ? { ...state, ...partial(state) }
        : { ...state, ...partial };

    if (nextState !== state) {
      state = nextState;
      listeners.forEach((listener) => listener(state));
    }
  };

  state = createStoreFn(setState, () => state);

  // hook 函数
  const useStore = (selector) => {
    const [selected, setSelected] = useState(selector(state));

    useEffect(() => {
      const listener = (newState) => {
        const nextSelected = selector(newState);
        setSelected(nextSelected);
      };
      listeners.add(listener);
      return () => listeners.delete(listener);
    }, []);

    return selected;
  };

  useStore.getState = () => state;
  useStore.setState = setState;
  useStore.subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return useStore;
};

// --- 使用 ---
const useCounterStore = createZustand((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
  dec: () => set((s) => ({ count: s.count - 1 })),
  reset: () => set({ count: 0 }),
}));

// 组件中精确订阅
const count = useCounterStore((s) => s.count); // 只订阅 count
const inc = useCounterStore((s) => s.inc); // 只订阅 inc 函数
```

### 实现 5：带 Selector 优化的 Zustand

```js
// === 带 Selector 优化的 Zustand ===
function createOptimizedStore(createStoreFn) {
  let state;
  // selector → Set<listener> 的映射
  const selectorMap = new Map();

  const setState = (partial) => {
    const nextState =
      typeof partial === 'function'
        ? { ...state, ...partial(state) }
        : { ...state, ...partial };

    if (nextState !== state) {
      const prevState = state;
      state = nextState;

      // 只通知 selector 值变化的监听者
      selectorMap.forEach((listeners, selector) => {
        const prevSelected = selector(prevState);
        const nextSelected = selector(state);
        if (prevSelected !== nextSelected) {
          listeners.forEach((listener) => listener(nextSelected));
        }
      });
    }
  };

  state = createStoreFn(setState, () => state);

  const useStore = (selector) => {
    const [selected, setSelected] = useState(selector(state));

    useEffect(() => {
      if (!selectorMap.has(selector)) {
        selectorMap.set(selector, new Set());
      }
      selectorMap.get(selector).add(setSelected);

      return () => {
        const listeners = selectorMap.get(selector);
        listeners.delete(setSelected);
        if (listeners.size === 0) selectorMap.delete(selector);
      };
    }, [selector]);

    return selected;
  };

  useStore.getState = () => state;
  useStore.setState = setState;

  return useStore;
};

// --- 使用 ---
const useTodoStore = createOptimizedStore((set, get) => ({
  todos: [],
  filter: 'all',
  addTodo: (text) =>
    set((s) => ({
      todos: [...s.todos, { id: Date.now(), text, done: false }],
    })),
  toggleTodo: (id) =>
    set((s) => ({
      todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    })),
  setFilter: (filter) => set({ filter }),
  get filteredTodos() {
    const s = get();
    if (s.filter === 'done') return s.todos.filter((t) => t.done);
    if (s.filter === 'active') return s.todos.filter((t) => !t.done);
    return s.todos;
  },
}));

// 精确订阅 — 改 filter 不会触发 todos 组件重渲染
const todos = useTodoStore((s) => s.todos);
const filter = useTodoStore((s) => s.filter);
```

---

## 四、10+ 状态管理示例

### 示例 1：计数器（Redux 风格）

```js
// === 计数器 — Redux 风格 ===
const counterStore = createStore(
  (state = { count: 0 }, action) => {
    switch (action.type) {
      case 'INC': return { count: state.count + 1 };
      case 'DEC': return { count: state.count - 1 };
      case 'ADD': return { count: state.count + action.payload };
      default: return state;
    }
  },
  { count: 0 }
);

counterStore.subscribe(() =>
  console.log('计数器:', counterStore.getState().count)
);

counterStore.dispatch({ type: 'INC' });   // 1
counterStore.dispatch({ type: 'INC' });   // 2
counterStore.dispatch({ type: 'ADD', payload: 10 }); // 12
```

### 示例 2：Todo List（Zustand 风格）

```js
// === Todo List — Zustand 风格 ===
function createTodoStore() {
  let state = { todos: [], nextId: 1 };
  const listeners = new Set();

  const set = (fn) => {
    state = { ...state, ...fn(state) };
    listeners.forEach((l) => l(state));
  };

  return {
    getState: () => state,
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
    addTodo: (text) => set((s) => ({
      todos: [...s.todos, { id: s.nextId, text, done: false }],
      nextId: s.nextId + 1,
    })),
    toggleTodo: (id) => set((s) => ({
      todos: s.todos.map((t) => t.id === id ? { ...t, done: !t.done } : t),
    })),
    removeTodo: (id) => set((s) => ({
      todos: s.todos.filter((t) => t.id !== id),
    })),
    clearCompleted: () => set((s) => ({
      todos: s.todos.filter((t) => !t.done),
    })),
  };
}

const todoStore = createTodoStore();
todoStore.subscribe((s) => console.log('Todos:', s.todos.length, '个'));

todoStore.addTodo('学 Redux');
todoStore.addTodo('学 Zustand');
todoStore.toggleTodo(1);
todoStore.removeTodo(2);
todoStore.clearCompleted();
```

### 示例 3：购物车

```js
// === 购物车 ===
const cartStore = createStore(
  (state = { items: [], coupon: null }, action) => {
    switch (action.type) {
      case 'ADD_ITEM': {
        const existing = state.items.find((i) => i.id === action.payload.id);
        return {
          ...state,
          items: existing
            ? state.items.map((i) =>
                i.id === action.payload.id ? { ...i, qty: i.qty + 1 } : i
              )
            : [...state.items, { ...action.payload, qty: 1 }],
        };
      }
      case 'REMOVE_ITEM':
        return { ...state, items: state.items.filter((i) => i.id !== action.payload) };
      case 'UPDATE_QTY':
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === action.payload.id ? { ...i, qty: action.payload.qty } : i
          ),
        };
      case 'SET_COUPON':
        return { ...state, coupon: action.payload };
      case 'CLEAR_CART':
        return { items: [], coupon: null };
      default:
        return state;
    }
  },
  { items: [], coupon: null }
);

// 选择器
const getCartTotal = (state) =>
  state.items.reduce((sum, item) => sum + item.price * item.qty, 0);

const getCartCount = (state) =>
  state.items.reduce((sum, item) => sum + item.qty, 0);

cartStore.subscribe(() => {
  const s = cartStore.getState();
  console.log(`购物车: ${getCartCount(s)} 件, 合计 ¥${getCartTotal(s)}`);
});

cartStore.dispatch({ type: 'ADD_ITEM', payload: { id: 1, name: '键盘', price: 299 } });
cartStore.dispatch({ type: 'ADD_ITEM', payload: { id: 2, name: '鼠标', price: 149 } });
cartStore.dispatch({ type: 'ADD_ITEM', payload: { id: 1, name: '键盘', price: 299 } }); // 加数量
cartStore.dispatch({ type: 'UPDATE_QTY', payload: { id: 2, qty: 3 } });
```

### 示例 4：表单状态管理

```js
// === 表单状态管理 ===
function createFormStore(initialValues) {
  let state = {
    values: { ...initialValues },
    errors: {},
    touched: {},
    isSubmitting: false,
    isDirty: false,
  };
  const listeners = new Set();

  const set = (fn) => {
    state = { ...state, ...fn(state) };
    listeners.forEach((l) => l(state));
  };

  return {
    getState: () => state,
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },

    setField: (name, value) => set((s) => ({
      values: { ...s.values, [name]: value },
      isDirty: true,
    })),

    touchField: (name) => set((s) => ({
      touched: { ...s.touched, [name]: true },
    })),

    setErrors: (errors) => set(() => ({ errors })),

    validate: async (validators) => {
      const errors = {};
      for (const [field, validateFn] of Object.entries(validators)) {
        const error = validateFn(state.values[field]);
        if (error) errors[field] = error;
      }
      set(() => ({ errors }));
      return Object.keys(errors).length === 0;
    },

    submit: async (onSubmit) => {
      set(() => ({ isSubmitting: true }));
      try {
        await onSubmit(state.values);
        set(() => ({ isSubmitting: false }));
      } catch (e) {
        set(() => ({ isSubmitting: false }));
        throw e;
      }
    },

    reset: () => set(() => ({
      values: { ...initialValues },
      errors: {},
      touched: {},
      isDirty: false,
    })),
  };
}

// --- 使用 ---
const formStore = createFormStore({ username: '', email: '', age: '' });

formStore.subscribe((s) => {
  console.log('表单状态:', {
    dirty: s.isDirty,
    errors: s.errors,
    values: s.values,
  });
});

formStore.setField('username', '娄总');
formStore.touchField('username');
formStore.setField('email', 'invalid-email');

// 校验
const isValid = formStore.validate({
  username: (v) => v.length < 2 ? '用户名至少2个字符' : null,
  email: (v) => !v.includes('@') ? '邮箱格式不正确' : null,
});
```

### 示例 5：主题/国际化状态

```js
// === 主题 + 国际化 ===
const themeStore = createStore(
  (state = {
    theme: 'light',
    lang: 'zh-CN',
    fontSize: 14,
  }, action) => {
    switch (action.type) {
      case 'TOGGLE_THEME':
        return { ...state, theme: state.theme === 'light' ? 'dark' : 'light' };
      case 'SET_THEME':
        return { ...state, theme: action.payload };
      case 'SET_LANG':
        return { ...state, lang: action.payload };
      case 'SET_FONT_SIZE':
        return { ...state, fontSize: action.payload };
      default:
        return state;
    }
  },
  { theme: 'light', lang: 'zh-CN', fontSize: 14 }
);

// 带持久化的主题 store
function createPersistedStore(reducer, initialState, storageKey) {
  const saved = localStorage.getItem(storageKey);
  const initialStateWithSaved = saved ? { ...initialState, ...JSON.parse(saved) } : initialState;
  const store = createStore(reducer, initialStateWithSaved);

  store.subscribe(() => {
    localStorage.setItem(storageKey, JSON.stringify(store.getState()));
  });

  return store;
}

const persistedThemeStore = createPersistedStore(
  themeStore.dispatch, // 实际应该传 reducer
  { theme: 'light', lang: 'zh-CN', fontSize: 14 },
  'app-theme'
);
```

### 示例 6：无限滚动 + 分页状态

```js
// === 无限滚动 + 分页状态 ===
function createInfiniteListStore(fetchFn) {
  let state = {
    items: [],
    page: 1,
    hasMore: true,
    loading: false,
    error: null,
  };
  const listeners = new Set();

  const set = (fn) => {
    state = { ...state, ...fn(state) };
    listeners.forEach((l) => l(state));
  };

  return {
    getState: () => state,
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },

    async loadMore() {
      if (state.loading || !state.hasMore) return;
      set(() => ({ loading: true, error: null }));
      try {
        const result = await fetchFn(state.page);
        set((s) => ({
          items: [...s.items, ...result.items],
          page: s.page + 1,
          hasMore: result.hasMore,
          loading: false,
        }));
      } catch (e) {
        set(() => ({ loading: false, error: e.message }));
      }
    },

    async refresh() {
      set(() => ({ page: 1, items: [], hasMore: true }));
      await this.loadMore();
    },

    reset() {
      set(() => ({
        items: [],
        page: 1,
        hasMore: true,
        loading: false,
        error: null,
      }));
    },
  };
}

// --- 模拟 API ---
const mockFetch = (page) =>
  new Promise((resolve) => {
    setTimeout(() => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: (page - 1) * 10 + i + 1,
        title: `Item ${(page - 1) * 10 + i + 1}`,
      }));
      resolve({ items, hasMore: page < 5 });
    }, 500);
  });

const listStore = createInfiniteListStore(mockFetch);
listStore.subscribe((s) =>
  console.log(`列表: ${s.items.length} 项, 加载中: ${s.loading}, 还有更多: ${s.hasMore}`)
);

listStore.loadMore(); // 加载第1页
```

### 示例 7：WebSocket 实时状态

```js
// === WebSocket 实时状态 ===
function createWebSocketStore(url) {
  let state = {
    connected: false,
    messages: [],
    typingUsers: [],
    error: null,
    reconnectAttempts: 0,
  };
  const listeners = new Set();

  const set = (fn) => {
    state = { ...state, ...fn(state) };
    listeners.forEach((l) => l(state));
  };

  let ws = null;
  const maxReconnect = 5;

  function connect() {
    ws = new WebSocket(url);

    ws.onopen = () => set(() => ({ connected: true, error: null, reconnectAttempts: 0 }));
    ws.onclose = () => {
      set((s) => ({
        connected: false,
        reconnectAttempts: s.reconnectAttempts + 1,
      }));
      if (state.reconnectAttempts < maxReconnect) {
        setTimeout(connect, 1000 * Math.pow(2, state.reconnectAttempts));
      }
    };
    ws.onerror = (e) => set(() => ({ error: e.message }));
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      set((s) => ({
        messages: [...s.messages, msg],
        typingUsers: msg.typing ? [...new Set([...s.typingUsers, msg.user])] : s.typingUsers.filter((u) => u !== msg.user),
      }));
    };
  }

  connect();

  return {
    getState: () => state,
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
    send: (data) => ws?.send(JSON.stringify(data)),
    disconnect: () => ws?.close(),
    reconnect: () => { ws?.close(); connect(); },
  };
}
```

### 示例 8：权限/路由状态

```js
// === 权限 + 路由状态 ===
const authStore = createStore(
  (state = {
    user: null,
    token: null,
    permissions: [],
    loading: false,
    error: null,
  }, action) => {
    switch (action.type) {
      case 'LOGIN_START':
        return { ...state, loading: true, error: null };
      case 'LOGIN_SUCCESS':
        return {
          ...state,
          loading: false,
          user: action.payload.user,
          token: action.payload.token,
          permissions: action.payload.permissions,
        };
      case 'LOGIN_FAIL':
        return { ...state, loading: false, error: action.payload };
      case 'LOGOUT':
        return { user: null, token: null, permissions: [], loading: false, error: null };
      case 'UPDATE_PERMISSIONS':
        return { ...state, permissions: action.payload };
      default:
        return state;
    }
  },
  { user: null, token: null, permissions: [], loading: false, error: null }
);

// 权限检查选择器
const hasPermission = (state, perm) => state.permissions.includes(perm);
const isAdmin = (state) => state.permissions.includes('admin');
const isAuthenticated = (state) => !!state.token;

// Action creators
const login = (username, password) => async (dispatch) => {
  dispatch({ type: 'LOGIN_START' });
  try {
    // 模拟 API
    const user = { id: 1, name: username };
    const token = 'jwt-token-xxx';
    const permissions = ['read', 'write', 'admin'];
    dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token, permissions } });
  } catch (e) {
    dispatch({ type: 'LOGIN_FAIL', payload: e.message });
  }
};

authStore.subscribe(() => {
  const s = authStore.getState();
  console.log('认证状态:', {
    loggedIn: isAuthenticated(s),
    user: s.user?.name,
    permissions: s.permissions,
  });
});
```

### 示例 9：多步骤表单（Wizard）

```js
// === 多步骤表单 Wizard ===
function createWizardStore(steps) {
  let state = {
    currentStep: 0,
    stepData: steps.reduce((acc, step, i) => ({ ...acc, [i]: {} }), {}),
    completedSteps: new Set(),
    errors: {},
  };
  const listeners = new Set();

  const set = (fn) => {
    state = { ...state, ...fn(state) };
    listeners.forEach((l) => l(state));
  };

  return {
    getState: () => ({ ...state, completedSteps: [...state.completedSteps] }),
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },

    setStepData: (step, data) => set((s) => ({
      stepData: { ...s.stepData, [step]: { ...s.stepData[step], ...data } },
    })),

    nextStep: () => set((s) => {
      const next = Math.min(s.currentStep + 1, steps.length - 1);
      const completed = new Set(s.completedSteps);
      completed.add(s.currentStep);
      return { currentStep: next, completedSteps: completed };
    }),

    prevStep: () => set((s) => ({
      currentStep: Math.max(s.currentStep - 1, 0),
    })),

    goToStep: (step) => set(() => ({ currentStep: step })),

    setStepError: (step, error) => set((s) => ({
      errors: { ...s.errors, [step]: error },
    })),

    reset: () => set(() => ({
      currentStep: 0,
      stepData: steps.reduce((acc, step, i) => ({ ...acc, [i]: {} }), {}),
      completedSteps: new Set(),
      errors: {},
    })),

    // 获取所有步骤的数据
    getAllData: () => state.stepData,
  };
}

// --- 使用 ---
const wizard = createWizardStore([
  { name: '基本信息', fields: ['name', 'email'] },
  { name: '地址信息', fields: ['address', 'city'] },
  { name: '确认提交', fields: ['agree'] },
]);

wizard.subscribe((s) =>
  console.log(`步骤: ${s.currentStep + 1}/${steps.length}, 已完成: ${s.completedSteps.size}`)
);

wizard.setStepData(0, { name: '娄总', email: 'lou@example.com' });
wizard.nextStep();
wizard.setStepData(1, { address: '杭州市', city: '杭州' });
wizard.nextStep();
```

### 示例 10：事件总线 / 发布订阅

```js
// === 事件总线 ===
class EventBus {
  constructor() {
    this.events = new Map();
    this.history = []; // 事件历史
    this.maxHistory = 100;
  }

  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrapper = (...args) => {
      handler(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  off(event, handler) {
    this.events.get(event)?.delete(handler);
  }

  emit(event, ...args) {
    this.history.push({ event, args, time: Date.now() });
    if (this.history.length > this.maxHistory) this.history.shift();

    this.events.get(event)?.forEach((handler) => {
      try {
        handler(...args);
      } catch (e) {
        console.error(`Event "${event}" handler error:`, e);
      }
    });
  }

  removeAllListeners(event) {
    if (event) this.events.delete(event);
    else this.events.clear();
  }

  listenerCount(event) {
    return this.events.get(event)?.size || 0;
  }

  getHistory(event) {
    if (event) return this.history.filter((h) => h.event === event);
    return [...this.history];
  }
}

// --- 使用 ---
const bus = new EventBus();

// 基本订阅
const unsub = bus.on('user:login', (user) => {
  console.log('用户登录:', user.name);
});

// 一次性订阅
bus.once('app:init', () => console.log('应用初始化完成'));

// 发布
bus.emit('user:login', { name: '娄总', id: 1 });
bus.emit('app:init'); // 只触发一次
bus.emit('app:init'); // 无输出

// 事件历史
bus.emit('user:login', { name: '测试', id: 2 });
console.log('登录历史:', bus.getHistory('user:login'));
```

### 示例 11：状态机（XState 风格）

```js
// === 简易状态机 ===
function createMachine(config) {
  let currentState = config.initial;
  const listeners = new Set();

  const transitions = {};
  for (const [state, transitionsMap] of Object.entries(config.states)) {
    transitions[state] = {};
    for (const [event, target] of Object.entries(transitionsMap)) {
      transitions[state][event] = typeof target === 'string' ? target : target.target;
    }
  }

  const machine = {
    get state() { return currentState; },
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },

    send: (event) => {
      const allowedTransitions = transitions[currentState];
      if (!allowedTransitions || !allowedTransitions[event]) {
        console.warn(`无效转换: ${currentState} --${event}-->`);
        return machine.state;
      }

      const previousState = currentState;
      currentState = allowedTransitions[event];

      // 执行 entry/exit actions
      const transitionConfig = config.states[previousState]?.[event];
      if (typeof transitionConfig === 'object' && transitionConfig.actions) {
        transitionConfig.actions.forEach((action) => action(machine.state, previousState));
      }

      listeners.forEach((l) => l(currentState, previousState, event));
      return currentState;
    },

    can: (event) => {
      const allowed = transitions[currentState];
      return allowed && !!allowed[event];
    },

    matches: (state) => currentState === state,
  };

  return machine;
}

// --- 使用：认证状态机 ---
const authMachine = createMachine({
  initial: 'idle',
  states: {
    idle: { LOGIN: 'loading' },
    loading: {
      SUCCESS: 'authenticated',
      FAIL: 'error',
    },
    authenticated: { LOGOUT: 'idle', REFRESH: 'loading' },
    error: { RETRY: 'loading' },
  },
});

authMachine.subscribe((newState, prevState, event) => {
  console.log(`${prevState} --${event}--> ${newState}`);
});

authMachine.send('LOGIN');      // idle --LOGIN--> loading
authMachine.send('SUCCESS');    // loading --SUCCESS--> authenticated
console.log(authMachine.matches('authenticated')); // true
authMachine.send('LOGOUT');     // authenticated --LOGOUT--> idle
authMachine.send('LOGIN');      // idle --LOGIN--> loading
authMachine.send('FAIL');       // loading --FAIL--> error
authMachine.send('RETRY');      // error --RETRY--> loading
```

### 示例 12：Undo/Redo 状态

```js
// === Undo/Redo 状态包装器 ===
function createUndoableStore(reducer, initialState) {
  const store = createStore(reducer, initialState);
  let past = [];
  let future = [];

  const originalDispatch = store.dispatch;

  store.dispatch = (action) => {
    if (action.type === '@@UNDO' || action.type === '@@REDO') {
      if (action.type === '@@UNDO' && past.length > 0) {
        const previous = past[past.length - 1];
        past = past.slice(0, -1);
        future = [store.getState(), ...future];
        // 直接替换 state
        Object.assign(store.getState(), previous);
      } else if (action.type === '@@REDO' && future.length > 0) {
        const next = future[0];
        future = future.slice(1);
        past = [...past, store.getState()];
        Object.assign(store.getState(), next);
      }
      store.subscribe; // 触发 listeners
      return action;
    }

    past = [...past, store.getState()];
    future = [];
    return originalDispatch(action);
  };

  store.canUndo = () => past.length > 0;
  store.canRedo = () => future.length > 0;
  store.undoHistory = () => [...past];
  store.redoHistory = () => [...future];

  return store;
}

// --- 使用 ---
const undoableStore = createUndoableStore(
  (state = { text: '' }, action) => {
    switch (action.type) {
      case 'TYPE': return { text: state.text + action.payload };
      case 'CLEAR': return { text: '' };
      default: return state;
    }
  },
  { text: '' }
);

undoableStore.subscribe(() =>
  console.log('文本:', undoableStore.getState().text, '| 可撤销:', undoableStore.canUndo())
);

undoableStore.dispatch({ type: 'TYPE', payload: 'H' });
undoableStore.dispatch({ type: 'TYPE', payload: 'i' });
undoableStore.dispatch({ type: 'TYPE', payload: '!' });
undoableStore.dispatch({ type: '@@UNDO' }); // 撤销 '!'
undoableStore.dispatch({ type: '@@UNDO' }); // 撤销 'i'
undoableStore.dispatch({ type: '@@REDO' }); // 重做 'i'
```

### 示例 13：缓存状态

```js
// === 带缓存的状态管理 ===
function createCachedStore(fetchFn, options = {}) {
  const { ttl = 5 * 60 * 1000, maxSize = 100 } = options;

  let state = {
    cache: new Map(),
    loading: new Map(),
    errors: new Map(),
  };
  const listeners = new Set();

  const set = (fn) => {
    state = fn(state);
    listeners.forEach((l) => l(state));
  };

  function isExpired(entry) {
    return Date.now() - entry.timestamp > ttl;
  }

  function evict() {
    if (state.cache.size > maxSize) {
      const keys = [...state.cache.keys()];
      for (let i = 0; i < keys.length - maxSize; i++) {
        state.cache.delete(keys[i]);
      }
    }
  }

  return {
    getState: () => state,
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },

    async get(key) {
      const entry = state.cache.get(key);
      if (entry && !isExpired(entry)) {
        return entry.data;
      }

      if (state.loading.has(key)) {
        // 等待已有的请求
        return new Promise((resolve) => {
          const check = () => {
            const e = state.cache.get(key);
            if (e) resolve(e.data);
            else setTimeout(check, 50);
          };
          check();
        });
      }

      set((s) => ({
        ...s,
        loading: new Map(s.loading).set(key, true),
      }));

      try {
        const data = await fetchFn(key);
        set((s) => {
          const cache = new Map(s.cache);
          cache.set(key, { data, timestamp: Date.now() });
          const loading = new Map(s.loading);
          loading.delete(key);
          evict();
          return { cache, loading, errors: s.errors };
        });
        return data;
      } catch (e) {
        set((s) => {
          const loading = new Map(s.loading);
          loading.delete(key);
          const errors = new Map(s.errors);
          errors.set(key, e.message);
          return { loading, errors };
        });
        throw e;
      }
    },

    invalidate(key) {
      set((s) => {
        const cache = new Map(s.cache);
        cache.delete(key);
        return { cache };
      });
    },

    clear() {
      set(() => ({
        cache: new Map(),
        loading: new Map(),
        errors: new Map(),
      }));
    },
  };
}

// --- 使用 ---
const userCache = createCachedStore(async (userId) => {
  // 模拟 API
  return new Promise((resolve) =>
    setTimeout(() => resolve({ id: userId, name: `User ${userId}` }), 200)
  );
});

userCache.subscribe((s) =>
  console.log('缓存大小:', s.cache.size, '加载中:', s.loading.size)
);

// 第一次 fetch
const user1 = await userCache.get(1);
// 第二次命中缓存
const user1Cached = await userCache.get(1);
```

---

## 五、核心原理总结

### Redux vs Zustand 对比

| 维度 | Redux | Zustand |
|------|-------|---------|
| 更新方式 | dispatch(action) → reducer | set(fn) 直接更新 |
| 不可变性 | 必须手动展开 | 直接修改（或配合 immer） |
| 中间件 | 强（thunk, saga, observable） | 弱（persist, devtools） |
| 学习曲线 | 高（action, reducer, middleware） | 低（hook 即 store） |
| 精确订阅 | 需要配合 reselect | selector 原生支持 |
| 调试 | Redux DevTools | Devtools 中间件 |

### 状态管理的核心模式

```
┌─────────────────────────────────────────┐
│              所有状态管理库               │
├─────────────────────────────────────────┤
│                                         │
│  1. Store    — 单一数据源               │
│  2. Action   — 描述变更意图             │
│  3. Reducer  — 纯函数计算新状态          │
│  4. Selector — 精确读取状态片段          │
│  5. Subscribe — 状态变化通知            │
│  6. Middleware — 拦截/增强 dispatch     │
│                                         │
└─────────────────────────────────────────┘
```

### 手写状态管理库 Checklist

- [x] createStore — 基础 store 实现
- [x] dispatch — 状态更新
- [x] subscribe — 订阅通知
- [x] getState — 获取状态
- [x] combineReducers — 拆分 reducer
- [x] middleware — 中间件链
- [x] thunk — 异步 action
- [x] selector — 精确订阅
- [x] undo/redo — 历史回溯
- [x] persist — 持久化
- [x] state machine — 状态机
- [x] event bus — 事件总线
- [x] cache — 缓存策略

---

## 六、面试常问

1. **Redux 的三大原则是什么？**
   - 单一数据源、状态只读、用纯函数修改

2. **为什么 reducer 必须是纯函数？**
   - 可预测、可测试、支持 time-travel 调试

3. **Zustand 为什么比 Redux 简单？**
   - 不需要 action type、reducer、action creator 三件套，直接 set 更新

4. **如何选择状态管理方案？**
   - 简单场景：useState + useReducer
   - 中等：Zustand / Jotai
   - 复杂：Redux Toolkit
   - 服务端状态：React Query / SWR

5. **selector 为什么能优化性能？**
   - 只在 selector 返回值变化时才触发重渲染，避免整 store 变化导致的全量更新

---

_专项训练完成 ✅ — 13 个示例，覆盖 Redux/Zustand/事件总线/状态机/缓存/撤销等核心模式_
