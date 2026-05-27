/**
 * 示例 9: Undo/Redo - 历史状态管理
 * 理解如何实现可撤销/重做功能
 */

function createUndoableReducer(reducer) {
  const initialState = {
    past: [],
    present: reducer(undefined, { type: '@@INIT' }),
    future: [],
  };

  return (state = initialState, action = {}) => {
    const { past, present, future } = state;

    switch (action.type) {
      case 'UNDO':
        if (past.length === 0) return state;
        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);
        return {
          past: newPast,
          present: previous,
          future: [present, ...future],
        };

      case 'REDO':
        if (future.length === 0) return state;
        const next = future[0];
        const newFuture = future.slice(1);
        return {
          past: [...past, present],
          present: next,
          future: newFuture,
        };

      default:
        const newPresent = reducer(present, action);
        if (present === newPresent) return state;
        return {
          past: [...past, present],
          present: newPresent,
          future: [],
        };
    }
  };
}

// 限制历史长度
function createUndoableReducerWithLimit(reducer, limit = 10) {
  const initialState = {
    past: [],
    present: reducer(undefined, { type: '@@INIT' }),
    future: [],
  };

  return (state = initialState, action = {}) => {
    const { past, present, future } = state;

    if (action.type === 'UNDO') {
      if (past.length === 0) return state;
      return {
        past: past.slice(0, -1),
        present: past[past.length - 1],
        future: [present, ...future],
      };
    }

    if (action.type === 'REDO') {
      if (future.length === 0) return state;
      return {
        past: [...past, present],
        present: future[0],
        future: future.slice(1),
      };
    }

    const newPresent = reducer(present, action);
    if (present === newPresent) return state;

    // 限制历史长度
    const newPast = past.length >= limit ? past.slice(1) : past;

    return {
      past: [...newPast, present],
      present: newPresent,
      future: [],
    };
  };
}

// ========== 使用示例 ==========
const textReducer = (state = '', action = {}) => {
  switch (action.type) {
    case 'SET_TEXT':
      return action.text;
    case 'APPEND_TEXT':
      return state + action.text;
    case 'CLEAR':
      return '';
    default:
      return state;
  }
};

const undoableTextReducer = createUndoableReducerWithLimit(textReducer, 5);

function createStore(reducer) {
  let state = reducer();
  return {
    getState: () => state,
    dispatch: (action) => {
      state = reducer(state, action);
      return action;
    },
  };
}

const store = createStore(undoableTextReducer);

console.log('=== Undo/Redo 状态管理 ===\n');

console.log('初始:', store.getState().present);

store.dispatch({ type: 'SET_TEXT', text: 'Hello' });
console.log(
  'SET "Hello":',
  store.getState().present,
  '| 历史:',
  store.getState().past,
);

store.dispatch({ type: 'APPEND_TEXT', text: ' World' });
console.log(
  'APPEND " World":',
  store.getState().present,
  '| 历史:',
  store.getState().past,
);

store.dispatch({ type: 'APPEND_TEXT', text: '!' });
console.log(
  'APPEND "!":',
  store.getState().present,
  '| 历史:',
  store.getState().past,
);

console.log('\n--- 执行 UNDO ---');
store.dispatch({ type: 'UNDO' });
console.log(
  'UNDO 后:',
  store.getState().present,
  '| 未来:',
  store.getState().future,
);

store.dispatch({ type: 'UNDO' });
console.log('再 UNDO:', store.getState().present);

console.log('\n--- 执行 REDO ---');
store.dispatch({ type: 'REDO' });
console.log('REDO 后:', store.getState().present);

// 测试历史限制
console.log('\n--- 测试历史限制 (limit=5) ---');
const store2 = createStore(undoableTextReducer);
for (let i = 1; i <= 8; i++) {
  store2.dispatch({ type: 'SET_TEXT', text: `State ${i}` });
}
console.log('添加 8 个状态后，历史长度:', store2.getState().past.length);
console.log('历史:', store2.getState().past);

console.log('\n✅ 示例 9 完成：理解 Undo/Redo 实现原理');
