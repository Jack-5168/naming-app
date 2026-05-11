/**
 * Mini Zustand - 30 行核心实现
 * 理解 Zustand 原理的简化版本
 */

function create(createFn) {
  let state = null;
  let listeners = new Set();
  let getStateListeners = new Set();

  // 设置状态 (支持函数式和对象式)
  const setState = (partial, replace = false) => {
    const nextState = typeof partial === 'function' ? partial(state) : partial;

    if (!nextState) return;

    const previousState = state;
    state = replace
      ? typeof nextState === 'object'
        ? nextState
        : nextState()
      : ({ ...state, ...(typeof nextState === 'object' ? nextState : nextState()) });

    // 通知所有订阅者
    listeners.forEach((listener) => listener(state, previousState));
  };

  // 获取状态
  const getState = () => state;

  // 订阅状态变化
  const subscribe = (listener) => {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }
    listeners.add(listener);

    // 返回取消订阅函数
    return () => {
      listeners.delete(listener);
    };
  };

  // 订阅 getState 调用 (用于 React 集成)
  const subscribeGetState = (listener) => {
    getStateListeners.add(listener);
    return () => getStateListeners.delete(listener);
  };

  // 销毁 store
  const destroy = () => {
    listeners = new Set();
    getStateListeners = new Set();
  };

  // API 对象 (在 createFn 中可用)
  const api = {
    setState, getState, subscribe, subscribeGetState, destroy,
  };

  // 初始化状态
  state = createFn(setState, getState, api);

  // 返回 hook 风格的函数 (模拟 React hook)
  const useStore = (selector = (s) => s, _equalityFn) => {
    // 在 React 环境中会订阅变化
    // 这里简化处理，直接返回选中的状态
    const selectedState = selector(state);
    return selectedState;
  };

  // 附加 API 方法
  useStore.setState = setState;
  useStore.getState = getState;
  useStore.subscribe = subscribe;
  useStore.destroy = destroy;

  return useStore;
}

// 工具：浅比较
function shallowEqual(objA, objB) {
  if (Object.is(objA, objB)) return true;

  if (
    typeof objA !== 'object'
    || objA === null
    || typeof objB !== 'object'
    || objB === null
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
    if (!Object.is(objA[key], objB[key])) return false;
  }

  return true;
}

// 中间件：persist (持久化)
const persist = (config, options) => (set, get, api) => {
  const { name, storage = typeof localStorage !== 'undefined' ? localStorage : null } = options;

  // 从存储加载
  if (storage) {
    try {
      const savedState = storage.getItem(name);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        // 合并持久化的状态
        set(parsed);
      }
    } catch (e) {
      console.warn('Failed to load persisted state:', e);
    }
  }

  // 创建带持久化的 setState
  const persistedSet = (partial, replace) => {
    set(partial, replace);

    // 保存到存储
    if (storage) {
      try {
        const currentState = get();
        const toSave = options.partialize ? options.partialize(currentState) : currentState;
        storage.setItem(name, JSON.stringify(toSave));
      } catch (e) {
        console.warn('Failed to persist state:', e);
      }
    }
  };

  return config(persistedSet, get, api);
};

// 中间件：devtools (Redux DevTools 集成)
const devtools = (config, options) => (set, get, api) => {
  const { name = 'Zustand Store', enabled = true } = options || {};

  let devtoolsApi = null;

  // 连接 DevTools
  if (enabled && typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION__) {
    devtoolsApi = window.__REDUX_DEVTOOLS_EXTENSION__.connect({ name });

    devtoolsApi.subscribe((message) => {
      if (message.type === 'DISPATCH' && message.state) {
        if (message.payload.type === 'JUMP_TO_STATE' || message.payload.type === 'JUMP_TO_ACTION') {
          const newState = JSON.parse(message.state);
          set(newState, true);
        }
      }
    });
  }

  // 包装 setState
  const devtoolsSet = (partial, replace) => {
    const nextState = typeof partial === 'function' ? partial(get()) : partial;
    set(nextState, replace);

    // 发送状态到 DevTools
    if (devtoolsApi) {
      devtoolsApi.send({ type: 'STATE_UPDATE' }, get());
    }
  };

  return config(devtoolsSet, get, api);
};

// 中间件：immer (不可变更新简化)
const immer = (config) => (set, get, api) => {
  // 简化的 immer 风格更新
  const immerSet = (updater, replace) => {
    if (typeof updater !== 'function') {
      throw new Error('immer middleware requires a function updater');
    }

    // 创建状态的深拷贝
    const currentState = get();
    const draft = JSON.parse(JSON.stringify(currentState));

    // 执行更新
    updater(draft);

    // 设置新状态
    set(draft, replace);
  };

  return config(immerSet, get, api);
};

module.exports = {
  create,
  shallowEqual,
  persist,
  devtools,
  immer,
};
