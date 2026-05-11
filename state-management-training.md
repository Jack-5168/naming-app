# 状态管理专项训练

## 一、状态管理核心原理

### 为什么需要状态管理？

1. **单一数据源 (Single Source of Truth)** - 所有状态集中存储，避免数据分散
2. **可预测性 (Predictability)** - 状态变化遵循固定模式，易于调试
3. **可追溯性 (Traceability)** - 每次状态变化都有记录，支持时间旅行调试
4. **解耦 (Decoupling)** - 视图与状态分离，便于测试和维护

### 核心概念

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   View      │────▶│   Action     │────▶│   State     │
│  (UI 层)    │     │  (意图描述)   │     │  (数据层)   │
└─────────────┘     └──────────────┘     └─────────────┘
       ▲                                        │
       │                                        ▼
       └────────────────────────────────────────┘
                    (状态驱动渲染)
```

---

## 二、简易 Redux 实现

### 核心实现

```javascript
// mini-redux.js

// 创建 Store
function createStore(reducer, initialState) {
  let state = initialState;
  let listeners = [];

  // 获取当前状态
  function getState() {
    return state;
  }

  // 订阅状态变化
  function subscribe(listener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }

  // 派发 action
  function dispatch(action) {
    state = reducer(state, action);
    listeners.forEach(listener => listener());
    return action;
  }

  // 初始派发一次，确保状态初始化
  dispatch({ type: '@@INIT' });

  return { getState, dispatch, subscribe };
}

// 创建 action 的辅助函数
function createAction(type, payload) {
  return { type, payload };
}

// combineReducers 工具
function combineReducers(reducers) {
  return function combinedReducer(state = {}, action) {
    const nextState = {};
    for (const key in reducers) {
      nextState[key] = reducers[key](state[key], action);
    }
    return nextState;
  };
}

export { createStore, createAction, combineReducers };
```

---

## 三、简易 Zustand 实现

### 核心实现（基于 Proxy）

```javascript
// mini-zustand.js

function createZustand(initialState) {
  let state = { ...initialState };
  let listeners = [];

  // 使用 Proxy 拦截状态变化
  const proxy = new Proxy(state, {
    get(target, prop) {
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      // 通知所有订阅者
      listeners.forEach(listener => listener(state));
      return true;
    }
  });

  // 获取状态
  function getState() {
    return proxy;
  }

  // 订阅状态变化
  function subscribe(listener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }

  // 直接修改状态（通过 setter 触发通知）
  function setState(partial) {
    if (typeof partial === 'function') {
      partial = partial(state);
    }
    Object.assign(state, partial);
  }

  return { getState, setState, subscribe };
}

export { createZustand };
```

---

## 四、10+ 状态管理示例

### 示例 1: 计数器 (Counter)

```javascript
//  reducer
function counterReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + 1 };
    case 'DECREMENT':
      return { count: state.count - 1 };
    case 'RESET':
      return { count: 0 };
    default:
      return state;
  }
}

// 使用
const store = createStore(counterReducer);
store.dispatch({ type: 'INCREMENT' });
console.log(store.getState()); // { count: 1 }
```

### 示例 2: 待办事项 (Todo List)

```javascript
function todoReducer(state = { todos: [] }, action) {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        todos: [...state.todos, {
          id: Date.now(),
          text: action.payload,
          completed: false
        }]
      };
    case 'TOGGLE_TODO':
      return {
        todos: state.todos.map(todo =>
          todo.id === action.payload
            ? { ...todo, completed: !todo.completed }
            : todo
        )
      };
    case 'DELETE_TODO':
      return {
        todos: state.todos.filter(todo => todo.id !== action.payload)
      };
    default:
      return state;
  }
}
```

### 示例 3: 用户认证状态 (Auth State)

```javascript
const authReducer = (state = { user: null, token: null, isAuthenticated: false }, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true
      };
    case 'LOGOUT':
      return { user: null, token: null, isAuthenticated: false };
    case 'UPDATE_PROFILE':
      return { ...state, user: { ...state.user, ...action.payload } };
    default:
      return state;
  }
};
```

### 示例 4: 购物车 (Shopping Cart)

```javascript
function cartReducer(state = { items: [], total: 0 }, action) {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const existing = state.items.find(i => i.id === action.payload.id);
      if (existing) {
        return {
          items: state.items.map(i =>
            i.id === action.payload.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
          total: state.total + action.payload.price
        };
      }
      return {
        items: [...state.items, { ...action.payload, quantity: 1 }],
        total: state.total + action.payload.price
      };
    }
    case 'REMOVE_FROM_CART':
      return {
        items: state.items.filter(i => i.id !== action.payload),
        total: state.total - (state.items.find(i => i.id === action.payload)?.price || 0)
      };
    case 'CLEAR_CART':
      return { items: [], total: 0 };
    default:
      return state;
  }
}
```

### 示例 5: 主题切换 (Theme Toggle)

```javascript
// Zustand 风格
const themeStore = createZustand({
  theme: 'light',
  primaryColor: '#007bff'
});

// 切换主题
themeStore.setState({
  theme: themeStore.getState().theme === 'light' ? 'dark' : 'light'
});

// 订阅变化
themeStore.subscribe((state) => {
  document.documentElement.setAttribute('data-theme', state.theme);
});
```

### 示例 6: 表单状态 (Form State)

```javascript
function formReducer(state = { values: {}, errors: {}, touched: {}, submitting: false }, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return {
        ...state,
        values: { ...state.values, [action.payload.field]: action.payload.value }
      };
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.payload.field]: action.payload.error }
      };
    case 'SET_TOUCHED':
      return {
        ...state,
        touched: { ...state.touched, [action.payload.field]: true }
      };
    case 'SET_SUBMITTING':
      return { ...state, submitting: action.payload };
    case 'RESET_FORM':
      return { values: {}, errors: {}, touched: {}, submitting: false };
    default:
      return state;
  }
}
```

### 示例 7: API 加载状态 (Loading State)

```javascript
function loadingReducer(state = { loading: {}, error: {}, data: {} }, action) {
  const { key } = action.payload;
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        loading: { ...state.loading, [key]: true },
        error: { ...state.error, [key]: null }
      };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading: { ...state.loading, [key]: false },
        data: { ...state.data, [key]: action.payload.data }
      };
    case 'FETCH_ERROR':
      return {
        ...state,
        loading: { ...state.loading, [key]: false },
        error: { ...state.error, [key]: action.payload.error }
      };
    default:
      return state;
  }
}

// 使用示例
dispatch({ type: 'FETCH_START', payload: { key: 'users' } });
// ... fetch data ...
dispatch({ type: 'FETCH_SUCCESS', payload: { key: 'users', data: users } });
```

### 示例 8: 模态框管理 (Modal Manager)

```javascript
function modalReducer(state = { modals: [] }, action) {
  switch (action.type) {
    case 'OPEN_MODAL':
      return {
        modals: [...state.modals, {
          id: Date.now(),
          type: action.payload.type,
          props: action.payload.props
        }]
      };
    case 'CLOSE_MODAL':
      return {
        modals: state.modals.filter(m => m.id !== action.payload)
      };
    case 'CLOSE_ALL':
      return { modals: [] };
    default:
      return state;
  }
}

// Action creators
const openModal = (type, props) => ({ type: 'OPEN_MODAL', payload: { type, props } });
const closeModal = (id) => ({ type: 'CLOSE_MODAL', payload: id });
```

### 示例 9: 通知系统 (Notification System)

```javascript
function notificationReducer(state = { notifications: [] }, action) {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return {
        notifications: [...state.notifications, {
          id: Date.now(),
          type: action.payload.type, // 'success' | 'error' | 'warning' | 'info'
          message: action.payload.message,
          duration: action.payload.duration || 3000
        }]
      };
    case 'REMOVE_NOTIFICATION':
      return {
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };
    case 'CLEAR_ALL':
      return { notifications: [] };
    default:
      return state;
  }
}
```

### 示例 10: 搜索过滤状态 (Search & Filter)

```javascript
function searchReducer(state = {
  query: '',
  filters: {},
  sortBy: null,
  sortOrder: 'asc',
  page: 1,
  pageSize: 20
}, action) {
  switch (action.type) {
    case 'SET_QUERY':
      return { ...state, query: action.payload, page: 1 };
    case 'SET_FILTER':
      return {
        ...state,
        filters: { ...state.filters, [action.payload.key]: action.payload.value },
        page: 1
      };
    case 'CLEAR_FILTERS':
      return { ...state, filters: {}, page: 1 };
    case 'SET_SORT':
      return { ...state, sortBy: action.payload.sortBy, sortOrder: action.payload.sortOrder };
    case 'SET_PAGE':
      return { ...state, page: action.payload };
    case 'SET_PAGE_SIZE':
      return { ...state, pageSize: action.payload, page: 1 };
    default:
      return state;
  }
}
```

### 示例 11: WebSocket 连接状态 (WebSocket Connection)

```javascript
function wsReducer(state = {
  connected: false,
  messages: [],
  lastMessage: null,
  reconnectAttempts: 0
}, action) {
  switch (action.type) {
    case 'WS_CONNECTING':
      return { ...state, connected: false };
    case 'WS_CONNECTED':
      return { ...state, connected: true, reconnectAttempts: 0 };
    case 'WS_DISCONNECTED':
      return { ...state, connected: false };
    case 'WS_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        lastMessage: action.payload
      };
    case 'WS_RECONNECT':
      return { ...state, reconnectAttempts: state.reconnectAttempts + 1 };
    case 'WS_CLEAR_MESSAGES':
      return { ...state, messages: [] };
    default:
      return state;
  }
}
```

### 示例 12: 多步骤表单 (Multi-step Form)

```javascript
function wizardReducer(state = {
  currentStep: 0,
  steps: [],
  data: {},
  completed: false
}, action) {
  switch (action.type) {
    case 'SET_STEPS':
      return { ...state, steps: action.payload };
    case 'NEXT_STEP':
      return { ...state, currentStep: Math.min(state.currentStep + 1, state.steps.length - 1) };
    case 'PREV_STEP':
      return { ...state, currentStep: Math.max(state.currentStep - 1, 0) };
    case 'GOTO_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_STEP_DATA':
      return {
        ...state,
        data: { ...state.data, [state.currentStep]: action.payload }
      };
    case 'COMPLETE':
      return { ...state, completed: true };
    case 'RESET':
      return { currentStep: 0, steps: [], data: {}, completed: false };
    default:
      return state;
  }
}
```

---

## 五、完整应用示例

### 简易任务管理应用

```javascript
// 组合多个 reducer
const rootReducer = combineReducers({
  todos: todoReducer,
  auth: authReducer,
  ui: uiReducer
});

// 创建 store
const store = createStore(rootReducer, {
  todos: { todos: [] },
  auth: { user: null, token: null, isAuthenticated: false },
  ui: { theme: 'light', modals: [] }
});

// 中间件示例 - Logger
function loggerMiddleware(store) {
  return next => action => {
    console.log('Dispatching:', action);
    const result = next(action);
    console.log('Next state:', store.getState());
    return result;
  };
}

// 中间件示例 - Thunk (支持异步 action)
function thunkMiddleware(store) {
  return next => action => {
    if (typeof action === 'function') {
      return action(store.dispatch, store.getState);
    }
    return next(action);
  };
}

// 使用 thunk
const fetchTodos = () => async (dispatch, getState) => {
  dispatch({ type: 'FETCH_TODOS_START' });
  try {
    const response = await fetch('/api/todos');
    const todos = await response.json();
    dispatch({ type: 'FETCH_TODOS_SUCCESS', payload: todos });
  } catch (error) {
    dispatch({ type: 'FETCH_TODOS_ERROR', payload: error.message });
  }
};

store.dispatch(fetchTodos());
```

---

## 六、最佳实践总结

### 1. 状态设计原则
- **原子化**: 将状态拆分为最小单元
- **扁平化**: 避免深层嵌套
- **规范化**: 类似数据库的 ID 引用模式

### 2. Action 命名规范
```javascript
// 好的命名
'USER_LOGIN_REQUEST'
'USER_LOGIN_SUCCESS'
'USER_LOGIN_FAILURE'

// 避免
'LOGIN'  // 太模糊
'DO_SOMETHING'  // 不清晰
```

### 3. Reducer 纯函数原则
```javascript
// ✅ 正确 - 返回新对象
return { ...state, count: state.count + 1 };

// ❌ 错误 - 修改原状态
state.count += 1;
return state;
```

### 4. 选择 Redux vs Zustand
| 场景 | 推荐方案 |
|------|----------|
| 大型应用，需要时间旅行调试 | Redux |
| 需要严格的状态变化追踪 | Redux |
| 中小型应用，追求简洁 | Zustand |
| 快速原型开发 | Zustand |

---

## 七、扩展练习

1. 实现 Redux DevTools 集成
2. 添加状态持久化（localStorage）
3. 实现状态快照和回滚
4. 添加状态变化日志
5. 实现基于选择器的派生状态

---

**完成时间**: 2026-04-24 11:00
**训练主题**: 状态管理原理与实践
