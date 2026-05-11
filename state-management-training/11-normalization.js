/**
 * 示例 11: 状态规范化 - Normalization
 * 理解如何扁平化嵌套数据，避免重复和更新问题
 */

// 规范化函数 - 将嵌套数据转为扁平结构
function normalize(array, key = 'id') {
  const byId = {};
  const allIds = [];

  array.forEach(item => {
    byId[item[key]] = { ...item };
    allIds.push(item[key]);
  });

  return { byId, allIds };
}

// 反规范化 - 从扁平结构重建嵌套数据
function denormalize(byId, allIds) {
  return allIds.map(id => byId[id]);
}

// ========== 示例数据 ==========
const nestedData = {
  posts: [
    {
      id: 1,
      title: 'Post 1',
      author: { id: 1, name: 'Alice' },
      comments: [
        { id: 1, text: 'Comment 1', author: { id: 2, name: 'Bob' } },
        { id: 2, text: 'Comment 2', author: { id: 1, name: 'Alice' } }
      ]
    },
    {
      id: 2,
      title: 'Post 2',
      author: { id: 2, name: 'Bob' },
      comments: [
        { id: 3, text: 'Comment 3', author: { id: 1, name: 'Alice' } }
      ]
    }
  ]
};

console.log('=== 原始嵌套数据 ===');
console.log(JSON.stringify(nestedData, null, 2));

// ========== 规范化 ==========
function normalizePosts(posts) {
  const result = {
    posts: { byId: {}, allIds: [] },
    users: { byId: {}, allIds: [] },
    comments: { byId: {}, allIds: [] }
  };

  posts.forEach(post => {
    // 规范化作者
    if (!result.users.byId[post.author.id]) {
      result.users.byId[post.author.id] = { ...post.author };
      result.users.allIds.push(post.author.id);
    }

    // 规范化帖子
    result.posts.byId[post.id] = {
      ...post,
      author: post.author.id,
      comments: post.comments.map(c => c.id)
    };
    result.posts.allIds.push(post.id);

    // 规范化评论
    post.comments.forEach(comment => {
      if (!result.users.byId[comment.author.id]) {
        result.users.byId[comment.author.id] = { ...comment.author };
        result.users.allIds.push(comment.author.id);
      }

      result.comments.byId[comment.id] = {
        ...comment,
        author: comment.author.id
      };
      result.comments.allIds.push(comment.id);
    });
  });

  return result;
}

const normalized = normalizePosts(nestedData.posts);

console.log('\n=== 规范化后的数据 ===');
console.log(JSON.stringify(normalized, null, 2));

// ========== Reducer 示例 ==========
const normalizedReducer = (state = normalized, action) => {
  switch (action.type) {
    case 'UPDATE_USER_NAME': {
      return {
        ...state,
        users: {
          ...state.users,
          byId: {
            ...state.users.byId,
            [action.userId]: {
              ...state.users.byId[action.userId],
              name: action.name
            }
          }
        }
      };
    }

    case 'ADD_COMMENT': {
      const newComment = {
        id: action.comment.id,
        text: action.comment.text,
        author: action.comment.authorId
      };
      return {
        ...state,
        comments: {
          byId: { ...state.comments.byId, [action.comment.id]: newComment },
          allIds: [...state.comments.allIds, action.comment.id]
        },
        posts: {
          ...state.posts,
          byId: {
            ...state.posts.byId,
            [action.postId]: {
              ...state.posts.byId[action.postId],
              comments: [...state.posts.byId[action.postId].comments, action.comment.id]
            }
          }
        }
      };
    }

    default:
      return state;
  }
};

// ========== 优势演示 ==========
console.log('\n=== 规范化优势演示 ===');

let state = normalized;

// 更新用户名字 - 只需更新一处，所有引用自动更新
state = normalizedReducer(state, { type: 'UPDATE_USER_NAME', userId: 1, name: 'Alice Updated' });
console.log('\n更新用户 1 的名字后，posts[0].author 和 comments[0].author 都会反映新名字');
console.log('Users:', state.users.byId[1]);

// 添加评论 - 只需在 comments 和 posts.comments 引用中添加
state = normalizedReducer(state, {
  type: 'ADD_COMMENT',
  postId: 1,
  comment: { id: 4, text: 'New Comment', authorId: 2 }
});
console.log('\n添加评论后:');
console.log('Comments allIds:', state.comments.allIds);
console.log('Post 1 comments:', state.posts.byId[1].comments);

console.log('\n✅ 示例 11 完成：理解状态规范化的优势');
