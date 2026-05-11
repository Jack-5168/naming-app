/**
 * 示例 8: 异步状态管理 - Promise + Async/Await
 * 理解如何处理异步操作的状态（loading, success, error）
 */

// 异步 action 创建器
function createAsyncAction(type, asyncFn) {
  return (...args) => async (dispatch, getState) => {
    dispatch({ type: `${type}_PENDING` });
    try {
      const result = await asyncFn(...args);
      dispatch({ type: `${type}_FULFILLED`, payload: result });
      return result;
    } catch (error) {
      dispatch({ type: `${type}_REJECTED`, error: error.message });
      throw error;
    }
  };
}

// 处理异步状态的 reducer
function createAsyncReducer(baseState = {}) {
  return (state = { ...baseState, loading: false, error: null, data: null }, action) => {
    const type = action.type;
    
    if (type.endsWith('_PENDING')) {
      return { ...state, loading: true, error: null };
    }
    
    if (type.endsWith('_FULFILLED')) {
      return { ...state, loading: false, data: action.payload };
    }
    
    if (type.endsWith('_REJECTED')) {
      return { ...state, loading: false, error: action.error };
    }
    
    return state;
  };
}

// ========== 模拟 API ==========
const api = {
  fetchUser: id => new Promise(resolve => 
    setTimeout(() => resolve({ id, name: `User${id}`, email: `user${id}@example.com` }), 500)
  ),
  fetchPosts: userId => new Promise(resolve =>
    setTimeout(() => resolve([
      { id: 1, title: 'Post 1', userId },
      { id: 2, title: 'Post 2', userId }
    ]), 300)
  ),
  updateUser: (id, data) => new Promise(resolve =>
    setTimeout(() => resolve({ id, ...data }), 400)
  )
};

// ========== Actions ==========
const fetchUser = createAsyncAction('FETCH_USER', api.fetchUser);
const fetchPosts = createAsyncAction('FETCH_POSTS', api.fetchPosts);
const updateUser = createAsyncAction('UPDATE_USER', api.updateUser);

// ========== Reducer ==========
const userReducer = createAsyncReducer();
const postsReducer = createAsyncReducer({ posts: [] });

const rootReducer = (state = { user: {}, posts: {} }, action) => ({
  user: userReducer(state.user, action),
  posts: postsReducer(state.posts, action)
});

// ========== Store ==========
function createStore(reducer) {
  let state = reducer();
  const listeners = [];
  
  return {
    getState: () => state,
    dispatch: action => {
      if (typeof action === 'function') {
        return action(store.dispatch, store.getState);
      }
      state = reducer(state, action);
      listeners.forEach(l => l());
      return action;
    },
    subscribe: listener => {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    }
  };
}

const store = createStore(rootReducer);

// ========== 使用示例 ==========
console.log('=== 异步状态管理 ===\n');

store.subscribe(() => {
  const state = store.getState();
  console.log('状态更新:', {
    userLoading: state.user.loading,
    userError: state.user.error,
    userData: state.user.data,
    postsLoading: state.posts.loading
  });
});

// 执行异步操作
(async () => {
  await store.dispatch(fetchUser(1));
  console.log('\n用户数据已加载');
  
  await store.dispatch(fetchPosts(1));
  console.log('帖子数据已加载');
  
  await store.dispatch(updateUser(1, { name: 'Updated User' }));
  console.log('用户已更新');
  
  console.log('\n最终状态:', JSON.stringify(store.getState(), null, 2));
  console.log('\n✅ 示例 8 完成：理解异步状态管理模式 (pending/fulfilled/rejected)');
})();
