/**
 * 示例 2: 简易 Zustand 实现 (基于 Proxy 的响应式)
 * 理解 Zustand 的核心：直接可变状态 + 自动通知订阅者
 */

// ========== 核心实现 ==========
function createZustand(reducer) {
  const state = reducer();
  const listeners = new Set();

  // 使用 Proxy 拦截状态修改
  const proxyState = new Proxy(state, {
    set(target, prop, value) {
      target[prop] = value;
      // 状态变化时通知所有订阅者
      listeners.forEach((listener) => listener(proxyState));
      return true;
    },
  });

  return {
    getState: () => proxyState,
    setState: (partial) => {
      if (typeof partial === 'function') {
        partial(proxyState);
      } else {
        Object.assign(proxyState, partial);
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// ========== 使用示例 ==========
const useStore = createZustand(() => ({
  count: 0,
  name: 'Zustand',
  items: [],
}));

console.log('初始状态:', useStore.getState());

// 直接修改状态（Zustand 风格）
useStore.setState({ count: 1 });
console.log('设置 count=1:', useStore.getState());

// 函数式更新
useStore.setState((state) => {
  state.count += 5;
  state.name = 'Updated';
});
console.log('函数式更新后:', useStore.getState());

// 添加订阅
useStore.subscribe((state) => {
  console.log('🔔 状态变化:', JSON.stringify(state));
});

useStore.setState({ count: 10 }); // 触发订阅

console.log('\n✅ 示例 2 完成：理解 Zustand 的 Proxy 响应式原理');
