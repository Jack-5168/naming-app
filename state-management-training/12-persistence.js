/**
 * 示例 12: 状态持久化 - LocalStorage + 版本迁移
 * 理解如何保存和恢复状态，处理版本升级
 */

// 持久化中间件
function createPersistMiddleware(storageKey, storage = localStorage) {
  return (store) => (next) => (action) => {
    const result = next(action);

    // 每次 action 后保存状态
    try {
      const state = store.getState();
      const serialized = JSON.stringify(state);
      storage.setItem(storageKey, serialized);
    } catch (err) {
      console.warn('保存状态失败:', err);
    }

    return result;
  };
}

// 从存储加载状态
function loadFromStorage(storageKey, storage = localStorage) {
  try {
    const serialized = storage.getItem(storageKey);
    if (serialized === null) return undefined;
    return JSON.parse(serialized);
  } catch (err) {
    console.warn('加载状态失败:', err);
    return undefined;
  }
}

// 版本迁移系统
function createMigrator(migrations) {
  return (state, fromVersion = 0) => {
    let migratedState = state;
    let currentVersion = fromVersion;

    while (currentVersion < migrations.length) {
      const migrate = migrations[currentVersion];
      if (migrate) {
        console.log(`迁移 v${currentVersion} → v${currentVersion + 1}`);
        migratedState = migrate(migratedState);
      }
      currentVersion++;
    }

    return { ...migratedState, _version: currentVersion };
  };
}

// ========== 迁移示例 ==========
const migrations = [
  // v0 → v1: 添加新字段
  (state) => ({
    ...state,
    settings: { theme: 'light', ...state.settings },
  }),

  // v1 → v2: 重命名字段
  (state) => ({
    ...state,
    userName: state.user?.name,
    user: undefined,
  }),

  // v2 → v3: 数据结构变化
  (state) => ({
    ...state,
    todos:
      state.items?.map((item) => ({
        id: item.id,
        text: item.title,
        done: item.completed,
        createdAt: Date.now(),
      })) || [],
  }),
];

const migrator = createMigrator(migrations);

// ========== 使用示例 ==========
// 模拟 localStorage
const mockStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  },
};

// 初始状态
const initialState = {
  _version: 0,
  todos: [],
  settings: {},
};

// 创建带持久化的 store
function createPersistedStore(reducer, storageKey, initialState) {
  // 尝试加载已保存的状态
  const savedState = loadFromStorage(storageKey, mockStorage);
  let preloadedState = initialState;

  if (savedState) {
    console.log('找到已保存的状态，版本:', savedState._version);
    // 执行迁移
    preloadedState = migrator(savedState, savedState._version || 0);
  }

  let state = reducer(preloadedState, { type: '@@INIT' });
  const listeners = [];

  return {
    getState: () => state,
    dispatch: (action) => {
      state = reducer(state, action);
      listeners.forEach((l) => l());

      // 持久化
      try {
        mockStorage.setItem(storageKey, JSON.stringify(state));
        console.log('💾 状态已保存');
      } catch (err) {
        console.warn('保存失败:', err);
      }

      return action;
    },
    subscribe: (listener) => {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    // 调试用
    getStorage: () => mockStorage.data,
  };
}

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        ...state,
        todos: [
          ...state.todos,
          { id: Date.now(), text: action.text, done: false },
        ],
      };
    case 'TOGGLE_TODO':
      return {
        ...state,
        todos: state.todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)),
      };
    case 'SET_THEME':
      return { ...state, settings: { ...state.settings, theme: action.theme } };
    default:
      return state;
  }
};

console.log('=== 状态持久化与版本迁移 ===\n');

// 第一次运行 - 创建一些数据
const store1 = createPersistedStore(reducer, 'my-app', initialState);
store1.dispatch({ type: 'ADD_TODO', text: '任务 1' });
store1.dispatch({ type: 'ADD_TODO', text: '任务 2' });
store1.dispatch({ type: 'SET_THEME', theme: 'dark' });

console.log('\n存储中的数据:', JSON.stringify(store1.getStorage(), null, 2));

// 模拟应用重启 - 加载已保存的状态
console.log('\n--- 模拟应用重启 ---');
const store2 = createPersistedStore(reducer, 'my-app', initialState);
console.log('恢复后的状态:', JSON.stringify(store2.getState(), null, 2));

console.log('\n✅ 示例 12 完成：理解状态持久化和版本迁移');
