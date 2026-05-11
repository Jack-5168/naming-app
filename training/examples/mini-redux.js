/**
 * Mini Redux - 50 行核心实现
 * 理解 Redux 原理的简化版本
 */

// 1. createStore - 创建状态仓库
function createStore(reducer, initialState, enhancer) {
  // 支持 applyMiddleware
  if (typeof enhancer === 'function') {
    return enhancer(createStore)(reducer, initialState);
  }

  let state = initialState;
  let listeners = new Set();
  let isDispatching = false;

  // 获取当前状态
  function getState() {
    return state;
  }

  // 订阅状态变化
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }
    listeners.add(listener);

    // 返回取消订阅函数
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  // 分发 action，触发状态更新
  function dispatch(action) {
    if (typeof action !== 'object' || action === null || !('type' in action)) {
      throw new Error('Actions must be plain objects with a "type" property');
    }

    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions');
    }

    try {
      isDispatching = true;
      state = reducer(state, action);
    } finally {
      isDispatching = false;
    }

    // 通知所有订阅者
    listeners.forEach((listener) => listener());
    return action;
  }

  // 替换 reducer (用于热更新)
  function replaceReducer(nextReducer) {
    state = nextReducer(state, { type: '@@REPLACE' });
    listeners = new Set(listeners);
    return store;
  }

  // 初始化
  dispatch({ type: '@@INIT' });

  const store = {
    getState, dispatch, subscribe, replaceReducer,
  };

  // 支持 observable (用于 Redux DevTools)
  store['@@observable'] = function observable() {
    return this;
  };

  return store;
}

// 2. combineReducers - 组合多个 reducer
function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers);
  const finalReducers = {};

  // 验证所有 reducer 都是函数
  reducerKeys.forEach((key) => {
    if (typeof reducers[key] !== 'function') {
      throw new Error(`Reducer "${key}" must be a function`);
    }
    finalReducers[key] = reducers[key];
  });

  return function combination(state = {}, action) {
    let hasChanged = false;
    const nextState = {};

    reducerKeys.forEach((key) => {
      const reducer = finalReducers[key];
      const previousStateForKey = state[key];
      const nextStateForKey = reducer(previousStateForKey, action);

      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    });

    return hasChanged ? nextState : state;
  };
}

// 3. applyMiddleware - 中间件支持
function applyMiddleware(...middlewares) {
  return (createStoreFn) => (reducer, initialState, enhancer) => {
    const store = createStoreFn(reducer, initialState, enhancer);
    let dispatch = () => {
      throw new Error('Dispatching while constructing middleware');
    };

    // 中间件 API
    const middlewareAPI = {
      getState: store.getState,
      dispatch: (action, ...args) => dispatch(action, ...args),
    };

    // 初始化中间件链
    const chain = middlewares.map((middleware) => middleware(middlewareAPI));
    dispatch = compose(...chain)(store.dispatch);

    return { ...store, dispatch };
  };
}

// 辅助函数：从右到左组合函数
function compose(...funcs) {
  if (funcs.length === 0) return (arg) => arg;
  if (funcs.length === 1) return funcs[0];
  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}

// 4. bindActionCreators - 批量绑定 action creators
function bindActionCreators(actionCreators, dispatch) {
  if (typeof actionCreators === 'function') {
    return (...args) => dispatch(actionCreators(...args));
  }

  if (typeof actionCreators !== 'object' || actionCreators === null) {
    throw new Error('actionCreators must be a function or an object');
  }

  const boundActionCreators = {};
  Object.keys(actionCreators).forEach((key) => {
    const actionCreator = actionCreators[key];
    if (typeof actionCreator === 'function') {
      boundActionCreators[key] = (...args) => dispatch(actionCreator(...args));
    }
  });

  return boundActionCreators;
}

module.exports = {
  createStore,
  combineReducers,
  applyMiddleware,
  bindActionCreators,
  compose,
};
