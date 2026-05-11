/**
 * 示例 3: combineReducers - 拆分 reducer 逻辑
 * 理解如何组合多个 reducer 管理不同状态片段
 */

function combineReducers(reducers) {
  return function combinedReducer(state = {}, action) {
    const newState = {};
    let hasChanged = false;

    for (const key in reducers) {
      const reducer = reducers[key];
      const previousState = state[key];
      const nextState = reducer(previousState, action);
      
      newState[key] = nextState;
      
      if (nextState !== previousState) {
        hasChanged = true;
      }
    }

    return hasChanged ? newState : state;
  };
}

// 独立的 reducer
const userReducer = (state = { name: '', age: 0 }, action = {}) => {
  switch (action.type) {
    case 'SET_NAME': return { ...state, name: action.payload };
    case 'SET_AGE': return { ...state, age: action.payload };
    default: return state;
  }
};

const todosReducer = (state = [], action = {}) => {
  switch (action.type) {
    case 'ADD_TODO': return [...state, action.payload];
    case 'REMOVE_TODO': return state.filter(t => t.id !== action.payload);
    case 'TOGGLE_TODO': return state.map(t => 
      t.id === action.payload ? { ...t, done: !t.done } : t
    );
    default: return state;
  }
};

const themeReducer = (state = 'light', action = {}) => {
  switch (action.type) {
    case 'SET_THEME': return action.payload;
    default: return state;
  }
};

// 组合 reducer
const rootReducer = combineReducers({
  user: userReducer,
  todos: todosReducer,
  theme: themeReducer
});

// 创建 store
function createStore(reducer) {
  let state = reducer();
  const listeners = [];
  
  return {
    getState: () => state,
    dispatch: action => {
      state = reducer(state, action);
      listeners.forEach(l => l());
    },
    subscribe: listener => {
      listeners.push(listener);
      return () => {
        const i = listeners.indexOf(listener);
        listeners.splice(i, 1);
      };
    }
  };
}

const store = createStore(rootReducer);

console.log('初始状态:', JSON.stringify(store.getState(), null, 2));

store.dispatch({ type: 'SET_NAME', payload: 'Alice' });
store.dispatch({ type: 'SET_AGE', payload: 25 });
store.dispatch({ type: 'ADD_TODO', payload: { id: 1, text: '学习 Redux', done: false } });
store.dispatch({ type: 'ADD_TODO', payload: { id: 2, text: '练习编码', done: false } });
store.dispatch({ type: 'TOGGLE_TODO', payload: 1 });
store.dispatch({ type: 'SET_THEME', payload: 'dark' });

console.log('\n最终状态:', JSON.stringify(store.getState(), null, 2));
console.log('\n✅ 示例 3 完成：理解 combineReducers 如何拆分和组合状态');
