/**
 * 示例 10: Optimistic Updates - 乐观更新
 * 理解如何在网络请求前先更新 UI，再处理回滚
 */

function createOptimisticReducer(baseReducer) {
  return (
    state = {
      data: baseReducer(undefined, { type: '@@INIT' }),
      optimistic: [],
    },
    action,
  ) => {
    const { data, optimistic } = state;

    switch (action.type) {
      case 'OPTIMISTIC_START': {
        // 保存当前状态以便回滚
        const snapshot = JSON.parse(JSON.stringify(data));
        const newData = baseReducer(data, action.updateAction);
        return {
          data: newData,
          optimistic: [
            ...optimistic,
            {
              id: action.optimisticId,
              snapshot,
              action: action.updateAction,
            },
          ],
        };
      }

      case 'OPTIMISTIC_COMMIT': {
        // 移除乐观更新记录
        const newOptimistic = optimistic.filter(
          (o) => o.id !== action.optimisticId,
        );
        return { ...state, optimistic: newOptimistic };
      }

      case 'OPTIMISTIC_ROLLBACK': {
        // 回滚到快照
        const record = optimistic.find((o) => o.id === action.optimisticId);
        if (!record) return state;

        const newOptimistic = optimistic.filter(
          (o) => o.id !== action.optimisticId,
        );
        return {
          data: record.snapshot,
          optimistic: newOptimistic,
        };
      }

      default:
        return {
          data: baseReducer(data, action),
          optimistic,
        };
    }
  };
}

// 创建 optimistic action
function createOptimisticAction(baseAction, apiCall, optimisticId) {
  return (...args) => async (dispatch) => {
    const updateAction = baseAction(...args);

    // 1. 立即更新 UI（乐观）
    dispatch({
      type: 'OPTIMISTIC_START',
      optimisticId,
      updateAction,
    });

    try {
      // 2. 执行实际 API 调用
      await apiCall(...args);

      // 3. 成功后提交
      dispatch({
        type: 'OPTIMISTIC_COMMIT',
        optimisticId,
      });
      dispatch(updateAction); // 确保状态一致
    } catch (error) {
      // 4. 失败后回滚
      dispatch({
        type: 'OPTIMISTIC_ROLLBACK',
        optimisticId,
      });
      throw error;
    }
  };
}

// ========== 使用示例 ==========
const todosReducer = (state = [], action) => {
  switch (action.type) {
    case 'ADD_TODO':
      return [
        ...state,
        {
          id: Date.now(),
          text: action.text,
          done: false,
          pending: false,
        },
      ];
    case 'DELETE_TODO':
      return state.filter((t) => t.id !== action.id);
    case 'TOGGLE_TODO':
      return state.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t));
    default:
      return state;
  }
};

const optimisticTodosReducer = createOptimisticReducer(todosReducer);

// 模拟 API
const api = {
  addTodo: (text) => new Promise((resolve, reject) => {
    setTimeout(() => {
      if (text.includes('error')) reject(new Error('Server error'));
      else resolve({ id: Date.now(), text, done: false });
    }, 500);
  }),
  deleteTodo: (id) => new Promise((resolve) => setTimeout(resolve, 300)),
};

function createStore(reducer) {
  let state = reducer();
  return {
    getState: () => state,
    dispatch: (action) => {
      if (typeof action === 'function') return action(store.dispatch, store.getState);
      state = reducer(state, action);
      return action;
    },
  };
}

const store = createStore(optimisticTodosReducer);

console.log('=== 乐观更新 ===\n');

const addTodoOptimistic = createOptimisticAction(
  (text) => ({ type: 'ADD_TODO', text }),
  api.addTodo,
);

console.log('初始状态:', store.getState().data);

// 成功的乐观更新
console.log('\n添加 "学习状态管理" (乐观更新)...');
store.dispatch(addTodoOptimistic('学习状态管理', 'opt-1'));
console.log('立即显示:', store.getState().data);

setTimeout(() => {
  console.log('500ms 后 (API 成功):', store.getState().data);
  console.log('待处理队列:', store.getState().optimistic.length);
}, 600);

// 失败的乐观更新
setTimeout(() => {
  console.log('\n添加 "会失败的任务" (乐观更新，然后回滚)...');
  store.dispatch(addTodoOptimistic('error 会失败', 'opt-2'));
  console.log('立即显示:', store.getState().data);
}, 1000);

setTimeout(() => {
  console.log('500ms 后 (API 失败，回滚):', store.getState().data);
  console.log('\n✅ 示例 10 完成：理解乐观更新和回滚机制');
}, 1600);
