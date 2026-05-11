/**
 * 示例 1: 简易 Redux 实现 (50 行核心代码)
 * 理解 Redux 最核心的三个 API: createStore, dispatch, subscribe
 */

// ========== 核心实现 ==========
function createStore(reducer, preloadedState) {
  let state = preloadedState;
  const listeners = [];

  function getState() {
    return state;
  }

  function dispatch(action) {
    state = reducer(state, action);
    listeners.forEach(listener => listener());
    return action;
  }

  function subscribe(listener) {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      listeners.splice(index, 1);
    };
  }

  // 初始化 dispatch 一个虚拟 action 来设置初始状态
  dispatch({ type: '@@INIT' });

  return { getState, dispatch, subscribe };
}

// ========== 使用示例 ==========
const counterReducer = (state = { count: 0 }, action) => {
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
};

const store = createStore(counterReducer);

console.log('初始状态:', store.getState()); // { count: 0 }

store.dispatch({ type: 'INCREMENT' });
console.log(' +1 后:', store.getState()); // { count: 1 }

store.dispatch({ type: 'ADD', payload: 5 });
console.log(' +5 后:', store.getState()); // { count: 6 }

// 订阅状态变化
const unsubscribe = store.subscribe(() => {
  console.log('状态已更新:', store.getState());
});

store.dispatch({ type: 'DECREMENT' }); // 会触发订阅回调
unsubscribe();
store.dispatch({ type: 'DECREMENT' }); // 不会触发（已取消订阅）

console.log('\n✅ 示例 1 完成：理解了 createStore/dispatch/subscribe 的核心原理');
