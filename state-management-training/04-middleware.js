/**
 * 示例 4: Middleware 中间件 - 处理副作用
 * 理解 Redux 中间件链式调用原理 (compose 函数)
 */

// 简易 createStore with middleware
function createStoreWithMiddleware(reducer, middlewares = []) {
  let state = reducer();
  const listeners = [];

  // compose 函数：从右到左组合多个函数
  const compose = (...fns) => {
    if (fns.length === 0) return (arg) => arg;
    if (fns.length === 1) return fns[0];
    return fns.reduce(
      (a, b) => (...args) => a(b(...args)),
    );
  };

  // 中间件签名：store => next => action => result
  const middlewareAPI = {
    getState: () => state,
    dispatch: (action) => dispatch(action),
  };

  // 应用中间件，增强 dispatch
  const chain = middlewares.map((mw) => mw(middlewareAPI));
  let dispatch = compose(...chain)((action) => {
    state = reducer(state, action);
    listeners.forEach((l) => l());
    return action;
  });

  return {
    getState: () => state,
    dispatch,
    subscribe: (listener) => {
      listeners.push(listener);
      return () => {
        const i = listeners.indexOf(listener);
        listeners.splice(i, 1);
      };
    },
  };
}

// ========== 中间件示例 ==========

// 1. Logger 中间件 - 记录所有 action
const loggerMiddleware = (store) => (next) => (action) => {
  console.log('[Logger] Dispatching:', action.type);
  console.log('[Logger] Before:', store.getState());
  const result = next(action);
  console.log('[Logger] After:', store.getState());
  return result;
};

// 2. Thunk 中间件 - 支持 dispatch 函数（处理异步）
const thunkMiddleware = (store) => (next) => (action) => {
  if (typeof action === 'function') {
    return action(store.dispatch, store.getState);
  }
  return next(action);
};

// 3. Crash Reporter 中间件 - 错误捕获
const crashReporter = (store) => (next) => (action) => {
  try {
    return next(action);
  } catch (err) {
    console.error('[CrashReporter] 错误:', err.message);
    console.error('[CrashReporter] Action:', action);
    throw err;
  }
};

// ========== 使用示例 ==========
const reducer = (state = { count: 0 }, action) => {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + 1 };
    case 'DECREMENT':
      return { count: state.count - 1 };
    default:
      return state;
  }
};

const store = createStoreWithMiddleware(reducer, [
  crashReporter,
  thunkMiddleware,
  loggerMiddleware,
]);

// 普通 action
store.dispatch({ type: 'INCREMENT' });

// Thunk action (异步)
const incrementAsync = () => (dispatch, getState) => {
  console.log('🕐 开始异步操作...');
  setTimeout(() => {
    console.log('✅ 异步完成，dispatch INCREMENT');
    dispatch({ type: 'INCREMENT' });
  }, 100);
};

store.dispatch(incrementAsync());

console.log('\n✅ 示例 4 完成：理解中间件链和 compose 函数');
