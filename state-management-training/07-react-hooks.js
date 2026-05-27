/**
 * 示例 7: React Hooks 模式 - useReducer + Context
 * 理解 React 内置的状态管理方案
 */

// 模拟 React 的 useReducer
function createUseReducer() {
  let state = null;
  let dispatch = null;
  const listeners = [];

  function useReducer(reducer, initialState) {
    if (state === null) {
      state = initialState;
    }

    const newDispatch = (action) => {
      state = reducer(state, action);
      listeners.forEach((l) => l(state));
    };

    dispatch = newDispatch;
    return [state, newDispatch];
  }

  function useSelector(selector) {
    return selector(state);
  }

  function subscribe(listener) {
    listeners.push(listener);
    return () => {
      const i = listeners.indexOf(listener);
      listeners.splice(i, 1);
    };
  }

  return {
    useReducer,
    useSelector,
    subscribe,
    getDispatch: () => dispatch,
  };
}

const {
  useReducer, useSelector, subscribe, getDispatch,
} = createUseReducer();

// ========== Reducer ==========
const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ITEM':
      const existing = state.items.find((i) => i.id === action.item.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) => (i.id === action.item.id ? { ...i, qty: i.qty + 1 } : i)),
        };
      }
      return {
        ...state,
        items: [...state.items, { ...action.item, qty: 1 }],
      };
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((i) => i.id !== action.id),
      };
    case 'UPDATE_QTY':
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.id ? { ...i, qty: action.qty } : i)),
      };
    case 'CLEAR_CART':
      return { ...state, items: [] };
    default:
      return state;
  }
};

// ========== 模拟组件 ==========
const initialState = { items: [], total: 0 };
const [cartState, cartDispatch] = useReducer(cartReducer, initialState);

// Selectors
const getItemCount = (state) => state.items.length;
const getTotalPrice = (state) => state.items.reduce((sum, item) => sum + item.price * item.qty, 0);
const getCartItems = (state) => state.items;

// ========== 使用示例 ==========
console.log('=== 购物车状态管理 ===\n');

// 添加商品
cartDispatch({
  type: 'ADD_ITEM',
  item: { id: 1, name: 'iPhone', price: 5999 },
});
cartDispatch({
  type: 'ADD_ITEM',
  item: { id: 2, name: 'AirPods', price: 1299 },
});
cartDispatch({
  type: 'ADD_ITEM',
  item: { id: 3, name: 'MacBook', price: 9999 },
});

console.log('商品数量:', getItemCount(cartState));
console.log(
  '商品列表:',
  getCartItems(cartState).map((i) => `${i.name} x${i.qty}`),
);
console.log('总价:', getTotalPrice(cartState));

// 增加数量
cartDispatch({
  type: 'ADD_ITEM',
  item: { id: 1, name: 'iPhone', price: 5999 },
});
console.log('\n再添加一个 iPhone 后:');
console.log(
  '商品列表:',
  getCartItems(cartState).map((i) => `${i.name} x${i.qty}`),
);
console.log('总价:', getTotalPrice(cartState));

// 订阅更新
subscribe((state) => {
  console.log(
    '🛒 购物车更新:',
    getItemCount(state),
    '件商品，总计 ¥' + getTotalPrice(state),
  );
});

cartDispatch({ type: 'ADD_ITEM', item: { id: 4, name: 'iPad', price: 3999 } });

console.log('\n✅ 示例 7 完成：理解 useReducer 模式');
