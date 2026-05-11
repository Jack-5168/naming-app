# 专项训练 11:00 — 状态管理第五轮：Pinia 核心原理 + Vue 3 响应式状态模式

> 日期：2026-05-01 | 时间：11:00 | 目标：实现 Pinia 核心，理解 Vue 3 响应式状态管理模式，写 12+ 全新示例
> 前置：已掌握 Mini Redux (R1) / 进阶模式 (R2-R4) / Valtio/Signals/Jotai/状态机/事件溯源/CQRS/中间件管线/时间旅行
> 本轮重点：Pinia 架构原理 + Vue 3 reactivity 集成 + 组合式 Store + 12 个全新业务场景

---

## 一、Pinia 核心原理

### 1.1 为什么 Pinia 取代 Vuex？

```
Vuex 4 (Vue 3 版) 的问题:
  ├── 过度依赖 TypeScript 泛型，类型推导困难
  ├── Module 嵌套导致路径深 (state.moduleA.moduleB.xxx)
  ├── 必须用 commit/dispatch，模板代码多
  └── 不支持 Composition API 天然集成

Pinia 的解决方案:
  ├── 扁平 Store 架构，无嵌套
  ├── setup 语法 + Options 语法双支持
  ├── 直接修改 state (通过 Vue 3 reactive)
  ├── 完美的 TypeScript 类型推导
  └── 零依赖，~1.5KB (gzip)
```

### 1.2 Pinia 架构全景

```
┌─────────────────────────────────────────────────────┐
│                    Pinia Root                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │              createPinia()                       │ │
│  │  ┌─────────────┐  ┌──────────────────────────┐  │ │
│  │  │  StoreMap   │  │    Plugin System         │  │ │
│  │  │  (name→Store)│  │  (on/subscribe/use)      │  │ │
│  │  └──────┬──────┘  └──────────────┬───────────┘  │ │
│  │         │                        │               │ │
│  │  ┌──────▼────────────────────────▼───────────┐  │ │
│  │  │           defineStore                      │  │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌─────────┐ │  │ │
│  │  │  │  state   │  │ getters  │  │ actions │ │  │ │
│  │  │  │ (reactive)│  │ (computed)│  │ (fn)   │ │  │ │
│  │  │  └──────────┘  └──────────┘  └─────────┘ │  │ │
│  │  └───────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 1.3 Pinia 三要素

| 要素 | Vuex 对应 | Pinia 实现 | 说明 |
|------|-----------|-----------|------|
| state | state | reactive() | Vue 3 响应式对象 |
| getters | computed | computed() | 派生状态，自动缓存 |
| actions | mutations + actions | 普通函数 | 可直接修改 state |

---

## 二、手写 Mini Pinia (~120 行核心)

### 2.1 核心实现

```javascript
/**
 * MiniPinia — Pinia 核心原理实现
 * 核心：createPinia + defineStore + useStore + 插件系统
 * 
 * Pinia 本质：
 * 1. 用 Vue 3 reactive 创建响应式 state
 * 2. 用 computed 创建派生 getters
 * 3. 用普通函数作为 actions（可直接修改 state）
 * 4. 用全局 Map 缓存 store 实例（单例）
 * 5. 用插件系统扩展能力
 */

// ============ Pinia 根实例 ============

class Pinia {
  constructor() {
    this._s = new Map();  // store map: name -> store instance
    this._p = new Set();  // plugins
    this._a = new Set();  // deferred install handlers
    this._devtools = null;
  }

  // 注册插件
  use(plugin) {
    this._p.add(plugin);
    return this;
  }

  // 注册 store
  _s(id, store) {
    this._s.set(id, store);
  }

  // 获取 store
  s(id) {
    return this._s.get(id);
  }

  // 安装插件到 store
  _applyPlugins(store) {
    for (const plugin of this._p) {
      plugin(store);
    }
  }
}

function createPinia() {
  const pinia = new Pinia();
  return pinia;
}

// ============ defineStore — Setup 语法 ============

function defineStoreSetup(id, setupFn, options = {}) {
  const { getters = {}, actions = {} } = options;

  function useStore(pinia) {
    pinia = pinia || globalPinia;
    
    // 单例：已存在则返回缓存
    if (pinia.s(id)) {
      return pinia.s(id);
    }

    // 1. 调用 setup 函数，获取 state + actions
    const setupResult = setupFn();
    
    // 2. 分离 state 和 actions
    const state = {};
    const storeActions = { ...actions };
    
    for (const key of Object.keys(setupResult)) {
      const val = setupResult[key];
      // ref/reactive/computed 都是响应式引用
      if (val && typeof val === 'object' && '__v_isRef' in val) {
        state[key] = val;
      } else if (typeof val === 'function') {
        storeActions[key] = val;
      }
    }

    // 3. 创建 getters（computed 派生）
    const computedGetters = {};
    for (const [key, getter] of Object.entries(getters)) {
      computedGetters[key] = Vue.computed(() => getter(state));
    }

    // 4. 创建 store 代理
    const store = new Proxy({}, {
      get(target, prop) {
        // 内部属性
        if (prop === '$id') return id;
        if (prop === '$state') return state;
        if (prop === '$patch') return (patch) => applyPatch(state, patch);
        if (prop === '$reset') return () => resetState(state, setupFn);
        if (prop === '$subscribe') return (fn) => subscribeToState(state, fn);
        if (prop === '$onAction') return (fn) => subscribeToActions(storeActions, fn);
        if (prop === '$dispose') return () => disposeStore(store);
        
        // getters
        if (prop in computedGetters) return computedGetters[prop].value;
        
        // actions
        if (prop in storeActions) {
          const action = storeActions[prop];
          return (...args) => {
            // 执行前通知
            notifyActionStart(id, prop, args);
            const result = action.apply(store, args);
            // 执行后通知
            notifyActionEnd(id, prop);
            return result;
          };
        }
        
        // state
        if (prop in state) return state[prop].value;
        
        return target[prop];
      },
      set(target, prop, value) {
        if (prop in state) {
          state[prop].value = value;
          return true;
        }
        target[prop] = value;
        return true;
      }
    });

    // 5. 缓存 + 应用插件
    pinia._s(id, store);
    pinia._applyPlugins(store);

    return store;
  }

  return useStore;
}

// ============ defineStore — Options 语法 ============

function defineStoreOptions(id, options) {
  const { state, getters, actions } = options;

  function useStore(pinia) {
    pinia = pinia || globalPinia;
    
    if (pinia.s(id)) return pinia.s(id);

    // 1. 初始化 state
    const initialState = state ? state() : {};
    const reactiveState = Vue.reactive({ ...initialState });

    // 2. 创建 getters
    const computedGetters = {};
    if (getters) {
      for (const [key, getter] of Object.entries(getters)) {
        computedGetters[key] = Vue.computed(() => {
          // getter 接收 state 作为第一个参数
          return getter(reactiveState);
        });
      }
    }

    // 3. 绑定 actions
    const storeActions = {};
    if (actions) {
      for (const [key, action] of Object.entries(actions)) {
        storeActions[key] = function (...args) {
          // action 中的 this 指向 store
          return action.apply(store, args);
        };
      }
    }

    // 4. 创建 store
    const store = new Proxy({}, {
      get(target, prop) {
        if (prop === '$id') return id;
        if (prop === '$state') return reactiveState;
        if (prop === '$patch') return (patch) => applyPatch(reactiveState, patch);
        if (prop === '$reset') return () => {
          Object.assign(reactiveState, state ? state() : {});
        };
        if (prop === '$subscribe') return (fn) => subscribeToState(reactiveState, fn);
        if (prop === '$onAction') return (fn) => subscribeToActions(storeActions, fn);
        if (prop === '$dispose') return () => {};
        if (prop in computedGetters) return computedGetters[prop].value;
        if (prop in storeActions) return storeActions[prop];
        if (prop in reactiveState) return reactiveState[prop];
        return target[prop];
      },
      set(target, prop, value) {
        if (prop in reactiveState) {
          reactiveState[prop] = value;
          return true;
        }
        target[prop] = value;
        return true;
      }
    });

    pinia._s(id, store);
    pinia._applyPlugins(store);

    return store;
  }

  return useStore;
}

// 统一入口
function defineStore(id, optionsOrSetup, rawOptions = {}) {
  if (typeof optionsOrSetup === 'function') {
    return defineStoreSetup(id, optionsOrSetup, rawOptions);
  }
  return defineStoreOptions(id, optionsOrSetup);
}

// ============ 辅助函数 ============

// $patch: 批量更新 state
function applyPatch(state, patch) {
  if (typeof patch === 'function') {
    // 函数式 patch：允许直接修改
    patch(state);
  } else {
    // 对象式 patch：合并
    Object.assign(state, patch);
  }
}

// $subscribe: 状态订阅
function subscribeToState(state, callback) {
  // Vue 3 reactive 自动追踪，这里用 watchEffect 模拟
  let oldValue = JSON.parse(JSON.stringify(state));
  
  const watchEffect = () => {
    const newValue = JSON.parse(JSON.stringify(state));
    if (oldValue !== newValue) {
      callback({
        storeId: 'unknown',
        type: 'direct',
        oldValue,
        newValue
      });
      oldValue = newValue;
    }
  };
  
  return () => {}; // unsubscribe
}

// $onAction: action 订阅
function subscribeToActions(actions, callback) {
  // 返回取消订阅函数
  return () => {};
}

// 重置 state
function resetState(state, setupFn) {
  const initial = setupFn();
  for (const key of Object.keys(state)) {
    if (key in initial) {
      state[key].value = initial[key].value;
    }
  }
}

// DevTools 通知
function notifyActionStart(storeId, actionName, args) {
  console.log(`[Pinia DevTools] 🟢 ${storeId}.${actionName}(${JSON.stringify(args)})`);
}

function notifyActionEnd(storeId, actionName) {
  console.log(`[Pinia DevTools] 🔵 ${storeId}.${actionName} ✅`);
}

// 全局 pinia 实例
let globalPinia = createPinia();

// ============ 插件示例 ============

// 插件 1: 持久化中间件
function persistPlugin(store) {
  const id = store.$id;
  const saved = localStorage.getItem(`pinia:${id}`);
  if (saved) {
    try {
      store.$patch(JSON.parse(saved));
    } catch (e) {}
  }
  store.$subscribe(() => {
    localStorage.setItem(`pinia:${id}`, JSON.stringify(store.$state));
  });
}

// 插件 2: DevTools 增强
function devtoolsPlugin(store) {
  console.log(`[Pinia DevTools] 📦 Store "${store.$id}" registered`);
  store.$onAction(({ name, args }) => {
    console.log(`[Pinia DevTools] 🎬 Action: ${name}(${args.map(a => JSON.stringify(a)).join(', ')})`);
  });
}

// 插件 3: 日志插件
function loggerPlugin(store) {
  let prevState = null;
  store.$subscribe(({ type, oldValue, newValue }) => {
    console.log(`[Pinia Logger] 📝 ${store.$id} changed (${type})`);
    console.log(`  旧: ${JSON.stringify(oldValue)}`);
    console.log(`  新: ${JSON.stringify(newValue)}`);
  });
}

// 插件 4: 错误边界
function errorBoundaryPlugin(store) {
  const originalActions = {};
  for (const key of Object.keys(store)) {
    if (typeof store[key] === 'function' && !key.startsWith('$')) {
      originalActions[key] = store[key];
      store[key] = async function (...args) {
        try {
          return await originalActions[key].apply(store, args);
        } catch (error) {
          console.error(`[Pinia Error] ${store.$id}.${key}:`, error);
          throw error;
        }
      };
    }
  }
}

// 插件 5: 热更新支持
function hmrPlugin(store) {
  if (typeof module !== 'undefined' && module.hot) {
    module.hot.accept(() => {
      console.log(`[Pinia HMR] 🔥 Hot updating store: ${store.$id}`);
    });
  }
}

// 插件 6: 状态快照（时间旅行）
function timeTravelPlugin(store) {
  const history = [];
  let currentIndex = -1;
  const MAX_HISTORY = 50;

  store.$subscribe(({ type, newValue }) => {
    // 截断未来历史
    history.length = currentIndex + 1;
    history.push(JSON.parse(JSON.stringify(newValue)));
    if (history.length > MAX_HISTORY) history.shift();
    currentIndex = history.length - 1;
  });

  store.$timeTravel = {
    canUndo: () => currentIndex > 0,
    canRedo: () => currentIndex < history.length - 1,
    undo: () => {
      if (store.$timeTravel.canUndo()) {
        currentIndex--;
        store.$patch(history[currentIndex]);
      }
    },
    redo: () => {
      if (store.$timeTravel.canRedo()) {
        currentIndex++;
        store.$patch(history[currentIndex]);
      }
    },
    history: () => [...history],
    jumpTo: (index) => {
      if (index >= 0 && index < history.length) {
        currentIndex = index;
        store.$patch(history[index]);
      }
    }
  };
}

console.log('✅ MiniPinia loaded — 核心 ~120 行');
```

### 2.2 Pinia vs Vuex 对比

```
┌─────────────────┬──────────────────┬──────────────────┐
│      特性        │      Vuex 4      │      Pinia       │
├─────────────────┼──────────────────┼──────────────────┤
│ state 声明       │ state: () => ({})│ state: () => ({})│
│ getters          │ getters: {}      │ getters: {}      │
│ mutations        │ ✅ 必需           │ ❌ 不需要         │
│ actions          │ actions: {}      │ actions: {}      │
│ modules          │ ✅ 嵌套模块       │ ❌ 扁平 Store     │
│ TypeScript       │ 类型推导困难      │ 完美类型推导      │
│ 包大小           │ ~22KB            │ ~1.5KB           │
│ Vue 3 集成       │ 适配层            │ 原生 reactive    │
│ Setup 语法       │ ❌               │ ✅               │
│ 插件系统         │ 基础              │ 丰富（6+ 内置）  │
│ SSR 支持         │ ✅               │ ✅               │
│ DevTools         │ ✅               │ ✅ 增强版         │
└─────────────────┴──────────────────┴──────────────────┘
```

---

## 三、12 个全新业务场景示例

### 示例 1: 用户认证 Store (Options 语法)

```javascript
// 用户认证 — Pinia Options 语法
const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null,
    refreshToken: null,
    loading: false,
    error: null
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    isAdmin: (state) => state.user?.role === 'admin',
    displayName: (state) => state.user?.name || '匿名用户',
    avatar: (state) => state.user?.avatar || '/default-avatar.png'
  },

  actions: {
    async login(credentials) {
      this.loading = true;
      this.error = null;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
        });
        const data = await res.json();
        this.user = data.user;
        this.token = data.token;
        this.refreshToken = data.refreshToken;
      } catch (e) {
        this.error = e.message;
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` }
      });
      this.$patch({
        user: null,
        token: null,
        refreshToken: null
      });
    },

    async refreshToken() {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });
      const data = await res.json();
      this.token = data.token;
      this.refreshToken = data.refreshToken;
    },

    // $reset 自动可用，无需手动实现
    clearError() {
      this.error = null;
    }
  }
});
```

### 示例 2: 购物车 Store (Setup 语法)

```javascript
// 购物车 — Pinia Setup 语法
const useCartStore = defineStore('cart', () => {
  const items = ref([]);
  const loading = ref(false);
  const coupon = ref(null);

  // Getters 用 computed
  const itemCount = computed(() => 
    items.value.reduce((sum, item) => sum + item.quantity, 0)
  );

  const subtotal = computed(() =>
    items.value.reduce((sum, item) => 
      sum + item.price * item.quantity, 0
    )
  );

  const discount = computed(() => {
    if (!coupon.value) return 0;
    if (coupon.value.type === 'percent') {
      return subtotal.value * coupon.value.value / 100;
    }
    return coupon.value.value;
  });

  const total = computed(() => Math.max(0, subtotal.value - discount.value));

  const groupedByCategory = computed(() =>
    items.value.reduce((groups, item) => {
      const cat = item.category || '其他';
      (groups[cat] = groups[cat] || []).push(item);
      return groups;
    }, {})
  );

  // Actions
  function addItem(product) {
    const existing = items.value.find(i => i.id === product.id);
    if (existing) {
      existing.quantity++;
    } else {
      items.value.push({ ...product, quantity: 1 });
    }
  }

  function removeItem(productId) {
    items.value = items.value.filter(i => i.id !== productId);
  }

  function updateQuantity(productId, quantity) {
    const item = items.value.find(i => i.id === productId);
    if (item) {
      if (quantity <= 0) {
        removeItem(productId);
      } else {
        item.quantity = quantity;
      }
    }
  }

  function clearCart() {
    items.value = [];
    coupon.value = null;
  }

  async function applyCoupon(code) {
    loading.value = true;
    try {
      const res = await fetch(`/api/coupons/${code}`);
      const data = await res.json();
      if (data.valid) {
        coupon.value = data;
      } else {
        throw new Error('无效优惠券');
      }
    } finally {
      loading.value = false;
    }
  }

  function removeCoupon() {
    coupon.value = null;
  }

  return {
    // state
    items, loading, coupon,
    // getters
    itemCount, subtotal, discount, total, groupedByCategory,
    // actions
    addItem, removeItem, updateQuantity, clearCart,
    applyCoupon, removeCoupon
  };
});
```

### 示例 3: 主题与国际化 Store

```javascript
// 主题 + 国际化 — 组合式 Store
const useThemeStore = defineStore('theme', () => {
  const darkMode = ref(false);
  const language = ref('zh-CN');
  const fontSize = ref(14);
  const sidebarCollapsed = ref(false);

  const themeClass = computed(() => darkMode.value ? 'dark' : 'light');
  
  const t = computed(() => {
    const dicts = {
      'zh-CN': { home: '首页', settings: '设置', logout: '退出' },
      'en-US': { home: 'Home', settings: 'Settings', logout: 'Logout' },
      'ja-JP': { home: 'ホーム', settings: '設定', logout: 'ログアウト' }
    };
    return (key) => dicts[language.value]?.[key] || key;
  });

  function toggleDark() {
    darkMode.value = !darkMode.value;
    document.documentElement.classList.toggle('dark', darkMode.value);
  }

  function setLang(lang) {
    language.value = lang;
    document.documentElement.lang = lang;
  }

  function setFontSize(size) {
    fontSize.value = Math.min(24, Math.max(12, size));
    document.documentElement.style.fontSize = `${fontSize.value}px`;
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  return {
    darkMode, language, fontSize, sidebarCollapsed,
    themeClass, t,
    toggleDark, setLang, setFontSize, toggleSidebar
  };
}, {
  // 持久化插件
  persist: true
});
```

### 示例 4: 路由与导航 Store

```javascript
// 路由状态管理 — 非 Vue Router 依赖
const useRouterStore = defineStore('router', () => {
  const currentRoute = ref({ path: '/', query: {}, params: {} });
  const history = ref([{ path: '/', query: {}, params: {}, timestamp: Date.now() }]);
  const forwardStack = ref([]);
  const guards = ref([]); // 全局前置守卫

  const canGoBack = computed(() => history.value.length > 1);
  const canGoForward = computed(() => forwardStack.value.length > 0);
  const routeDepth = computed(() => history.value.length);

  async function navigateTo(path, query = {}, params = {}) {
    // 执行全局守卫
    for (const guard of guards.value) {
      const result = await guard({ path, query, params });
      if (result === false) return; // 取消导航
      if (typeof result === 'string') {
        path = result; // 重定向
      }
    }

    // 保存当前路由到历史
    history.value.push({ ...currentRoute.value, timestamp: Date.now() });
    forwardStack.value = []; // 清空前进栈

    // 更新当前路由
    currentRoute.value = { path, query, params };
  }

  function goBack() {
    if (!canGoBack.value) return;
    const prev = history.value.pop();
    forwardStack.value.push({ ...currentRoute.value, timestamp: Date.now() });
    currentRoute.value = prev;
  }

  function goForward() {
    if (!canGoForward.value) return;
    const next = forwardStack.value.pop();
    history.value.push({ ...currentRoute.value, timestamp: Date.now() });
    currentRoute.value = next;
  }

  function addGuard(guard) {
    guards.value.push(guard);
  }

  function clearHistory() {
    history.value = [{ ...currentRoute.value, timestamp: Date.now() }];
    forwardStack.value = [];
  }

  return {
    currentRoute, history, forwardStack, guards,
    canGoBack, canGoForward, routeDepth,
    navigateTo, goBack, goForward, addGuard, clearHistory
  };
});
```

### 示例 5: 通知系统 Store

```javascript
// 通知系统 — 队列 + 自动销毁
const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref([]);
  const maxVisible = ref(5);
  const autoCloseDelay = ref(4000);

  const visibleNotifications = computed(() =>
    notifications.value.slice(0, maxVisible.value)
  );

  const unreadCount = computed(() =>
    notifications.value.filter(n => !n.read).length
  );

  const byType = computed(() =>
    notifications.value.reduce((groups, n) => {
      (groups[n.type] = groups[n.type] || []).push(n);
      return groups;
    }, { success: [], error: [], warning: [], info: [] })
  );

  function add(type, message, options = {}) {
    const id = Date.now() + Math.random().toString(36).slice(2);
    const notification = {
      id, type, message, read: false,
      createdAt: Date.now(),
      duration: options.duration ?? autoCloseDelay.value,
      action: options.action || null,
      persistent: options.persistent || false
    };

    notifications.value.unshift(notification);

    // 自动关闭
    if (!notification.persistent && notification.duration > 0) {
      setTimeout(() => remove(id), notification.duration);
    }

    return id;
  }

  function remove(id) {
    const idx = notifications.value.findIndex(n => n.id === id);
    if (idx !== -1) notifications.value.splice(idx, 1);
  }

  function markRead(id) {
    const n = notifications.value.find(n => n.id === id);
    if (n) n.read = true;
  }

  function clearAll() {
    notifications.value = [];
  }

  function clearByType(type) {
    notifications.value = notifications.value.filter(n => n.type !== type);
  }

  // 快捷方法
  const success = (msg, opts) => add('success', msg, opts);
  const error = (msg, opts) => add('error', msg, opts);
  const warning = (msg, opts) => add('warning', msg, opts);
  const info = (msg, opts) => add('info', msg, opts);

  return {
    notifications, visibleNotifications, unreadCount, byType,
    add, remove, markRead, clearAll, clearByType,
    success, error, warning, info
  };
});
```

### 示例 6: 表单状态管理 Store

```javascript
// 表单状态 — 验证 + 错误追踪 + 撤销
const useFormStore = defineStore('form', (formId) => {
  const fields = ref({});
  const touched = ref({});
  const errors = ref({});
  const isSubmitting = ref(false);
  const isDirty = ref(false);

  // 验证规则引擎
  const validators = {
    required: (val) => !!val || '此项为必填',
    email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) || '邮箱格式不正确',
    minLength: (min) => (val) => 
      val?.length >= min || `最少 ${min} 个字符`,
    maxLength: (max) => (val) => 
      val?.length <= max || `最多 ${max} 个字符`,
    pattern: (regex) => (val) =>
      regex.test(val) || '格式不正确',
    custom: (fn) => (val) => fn(val) || true
  };

  // 定义字段验证规则
  function defineField(name, rules) {
    fields.value[name] = { value: '', rules };
    touched.value[name] = false;
    errors.value[name] = '';
  }

  // 验证单个字段
  function validateField(name) {
    const field = fields.value[name];
    if (!field) return true;

    for (const rule of field.rules) {
      const result = typeof rule === 'function' 
        ? rule(field.value) 
        : validators[rule.type]?.(rule.param)(field.value);
      
      if (result !== true && result !== undefined) {
        errors.value[name] = result;
        return false;
      }
    }
    errors.value[name] = '';
    return true;
  }

  // 验证所有字段
  function validateAll() {
    let valid = true;
    for (const name of Object.keys(fields.value)) {
      touched.value[name] = true;
      if (!validateField(name)) valid = false;
    }
    return valid;
  }

  // 更新字段值
  function setFieldValue(name, value) {
    if (fields.value[name]) {
      fields.value[name].value = value;
      isDirty.value = true;
      if (touched.value[name]) {
        validateField(name);
      }
    }
  }

  // 标记为已触碰
  function touchField(name) {
    touched.value[name] = true;
    validateField(name);
  }

  // 重置表单
  function resetForm() {
    for (const name of Object.keys(fields.value)) {
      fields.value[name].value = '';
      touched.value[name] = false;
      errors.value[name] = '';
    }
    isDirty.value = false;
  }

  // 设置表单值（用于编辑模式）
  function setFormValues(values) {
    for (const [name, value] of Object.entries(values)) {
      if (fields.value[name]) {
        fields.value[name].value = value;
      }
    }
  }

  const isValid = computed(() =>
    Object.values(errors.value).every(e => !e)
  );

  const errorCount = computed(() =>
    Object.values(errors.value).filter(e => e).length
  );

  return {
    fields, touched, errors, isSubmitting, isDirty,
    isValid, errorCount,
    defineField, validateField, validateAll,
    setFieldValue, touchField, resetForm, setFormValues
  };
});
```

### 示例 7: WebSocket 实时状态 Store

```javascript
// WebSocket 连接管理
const useWebSocketStore = defineStore('websocket', () => {
  const status = ref('disconnected'); // disconnected/connecting/connected/error
  const messages = ref([]);
  const reconnectAttempts = ref(0);
  const maxReconnectAttempts = ref(5);
  const reconnectDelay = ref(3000);
  let ws = null;
  let heartbeatTimer = null;

  const isConnected = computed(() => status.value === 'connected');
  const isConnecting = computed(() => status.value === 'connecting');
  const lastMessage = computed(() => messages.value[messages.value.length - 1]);
  const messageCount = computed(() => messages.value.length);

  function connect(url) {
    status.value = 'connecting';
    
    ws = new WebSocket(url);

    ws.onopen = () => {
      status.value = 'connected';
      reconnectAttempts.value = 0;
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        messages.value.push({
          ...data,
          timestamp: Date.now(),
          direction: 'in'
        });
      } catch (e) {
        messages.value.push({
          type: 'raw',
          data: event.data,
          timestamp: Date.now(),
          direction: 'in'
        });
      }
    };

    ws.onclose = () => {
      status.value = 'disconnected';
      stopHeartbeat();
      attemptReconnect(url);
    };

    ws.onerror = () => {
      status.value = 'error';
    };
  }

  function send(type, payload) {
    if (ws?.readyState === WebSocket.OPEN) {
      const message = { type, payload, timestamp: Date.now() };
      ws.send(JSON.stringify(message));
      messages.value.push({ ...message, direction: 'out' });
    }
  }

  function disconnect() {
    stopHeartbeat();
    ws?.close();
    status.value = 'disconnected';
  }

  function attemptReconnect(url) {
    if (reconnectAttempts.value < maxReconnectAttempts.value) {
      reconnectAttempts.value++;
      setTimeout(() => connect(url), reconnectDelay.value * reconnectAttempts.value);
    }
  }

  function startHeartbeat() {
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 30000);
  }

  function stopHeartbeat() {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function clearMessages() {
    messages.value = [];
  }

  return {
    status, messages, reconnectAttempts,
    isConnected, isConnecting, lastMessage, messageCount,
    connect, send, disconnect, clearMessages
  };
});
```

### 示例 8: 文件上传队列 Store

```javascript
// 文件上传队列 — 并发控制 + 进度追踪
const useUploadStore = defineStore('uploads', () => {
  const queue = ref([]);
  const concurrentLimit = ref(3);
  const activeUploads = ref(0);

  const pendingCount = computed(() => queue.value.filter(u => u.status === 'pending').length);
  const uploadingCount = computed(() => queue.value.filter(u => u.status === 'uploading').length);
  const completedCount = computed(() => queue.value.filter(u => u.status === 'completed').length);
  const failedCount = computed(() => queue.value.filter(u => u.status === 'failed').length);
  const overallProgress = computed(() => {
    const total = queue.value.length;
    if (total === 0) return 100;
    const sum = queue.value.reduce((s, u) => s + (u.progress || 0), 0);
    return Math.round(sum / total);
  });

  function addToQueue(file, options = {}) {
    const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    queue.value.push({
      id,
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
      url: options.url || '/api/upload',
      headers: options.headers || {},
      error: null,
      result: null,
      createdAt: Date.now()
    });
    processQueue();
    return id;
  }

  async function processQueue() {
    while (activeUploads.value < concurrentLimit.value) {
      const pending = queue.value.find(u => u.status === 'pending');
      if (!pending) break;
      
      activeUploads.value++;
      pending.status = 'uploading';
      
      uploadFile(pending).finally(() => {
        activeUploads.value--;
        processQueue(); // 继续处理队列
      });
    }
  }

  async function uploadFile(item) {
    const formData = new FormData();
    formData.append('file', item.file);

    try {
      const xhr = new XMLHttpRequest();
      
      await new Promise((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            item.progress = Math.round((e.loaded / e.total) * 100);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            item.status = 'completed';
            item.progress = 100;
            item.result = JSON.parse(xhr.responseText);
            resolve();
          } else {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.open('POST', item.url);
        for (const [key, val] of Object.entries(item.headers)) {
          xhr.setRequestHeader(key, val);
        }
        xhr.send(formData);
      });
    } catch (error) {
      item.status = 'failed';
      item.error = error.message;
    }
  }

  function cancelUpload(id) {
    const item = queue.value.find(u => u.id === id);
    if (item && item.status === 'pending') {
      item.status = 'cancelled';
    }
  }

  function retryUpload(id) {
    const item = queue.value.find(u => u.id === id);
    if (item && item.status === 'failed') {
      item.status = 'pending';
      item.progress = 0;
      item.error = null;
      processQueue();
    }
  }

  function clearCompleted() {
    queue.value = queue.value.filter(u => u.status !== 'completed');
  }

  return {
    queue, concurrentLimit,
    pendingCount, uploadingCount, completedCount, failedCount, overallProgress,
    addToQueue, cancelUpload, retryUpload, clearCompleted
  };
});
```

### 示例 9: 搜索与过滤 Store

```javascript
// 搜索状态 — 防抖 + 历史 + 分页
const useSearchStore = defineStore('search', () => {
  const query = ref('');
  const results = ref([]);
  const loading = ref(false);
  const page = ref(1);
  const pageSize = ref(20);
  const total = ref(0);
  const filters = ref({});
  const sortBy = ref('relevance');
  const searchHistory = ref([]);
  const abortController = ref(null);

  const hasResults = computed(() => results.value.length > 0);
  const totalPages = computed(() => Math.ceil(total.value / pageSize.value));
  const hasNextPage = computed(() => page.value < totalPages.value);
  const hasPrevPage = computed(() => page.value > 1);
  const isFiltered = computed(() => Object.keys(filters.value).length > 0);

  // 防抖搜索
  let debounceTimer = null;
  function debouncedSearch(delay = 300) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => executeSearch(), delay);
  }

  async function executeSearch() {
    // 取消上一个请求
    abortController.value?.abort();
    abortController.value = new AbortController();

    loading.value = true;
    try {
      const params = new URLSearchParams({
        q: query.value,
        page: page.value,
        size: pageSize.value,
        sort: sortBy.value,
        ...filters.value
      });

      const res = await fetch(`/api/search?${params}`, {
        signal: abortController.value.signal
      });
      const data = await res.json();
      
      results.value = data.results;
      total.value = data.total;

      // 保存搜索历史
      if (query.value.trim()) {
        searchHistory.value = [
          query.value,
          ...searchHistory.value.filter(h => h !== query.value)
        ].slice(0, 10);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Search failed:', e);
      }
    } finally {
      loading.value = false;
    }
  }

  function setPage(p) {
    page.value = p;
    executeSearch();
  }

  function setFilter(key, value) {
    if (value === null || value === undefined) {
      delete filters.value[key];
    } else {
      filters.value[key] = value;
    }
    page.value = 1;
    executeSearch();
  }

  function clearFilters() {
    filters.value = {};
    page.value = 1;
    executeSearch();
  }

  function setSort(field) {
    sortBy.value = field;
    executeSearch();
  }

  function clearHistory() {
    searchHistory.value = [];
  }

  function selectHistory(term) {
    query.value = term;
    page.value = 1;
    executeSearch();
  }

  function reset() {
    query.value = '';
    results.value = [];
    page.value = 1;
    filters.value = {};
    sortBy.value = 'relevance';
  }

  return {
    query, results, loading, page, pageSize, total, filters, sortBy, searchHistory,
    hasResults, totalPages, hasNextPage, hasPrevPage, isFiltered,
    debouncedSearch, executeSearch, setPage, setFilter, clearFilters,
    setSort, clearHistory, selectHistory, reset
  };
});
```

### 示例 10: 多步骤表单 (Wizard) Store

```javascript
// 多步骤表单 — 向导模式
const useWizardStore = defineStore('wizard', () => {
  const steps = ref([
    { id: 'basic', title: '基本信息', completed: false, valid: false },
    { id: 'details', title: '详细信息', completed: false, valid: false },
    { id: 'review', title: '确认提交', completed: false, valid: false }
  ]);
  const currentStep = ref(0);
  const formData = ref({});
  const isSubmitting = ref(false);
  const submitResult = ref(null);

  const currentStepData = computed(() => steps.value[currentStep.value]);
  const isLastStep = computed(() => currentStep.value === steps.value.length - 1);
  const isFirstStep = computed(() => currentStep.value === 0);
  const progress = computed(() =>
    Math.round((steps.value.filter(s => s.completed).length / steps.value.length) * 100)
  );
  const allStepsValid = computed(() =>
    steps.value.every(s => s.valid)
  );

  function setStepData(stepId, data) {
    formData.value[stepId] = { ...formData.value[stepId], ...data };
  }

  function getStepData(stepId) {
    return formData.value[stepId] || {};
  }

  function markCurrentStepValid() {
    steps.value[currentStep.value].valid = true;
  }

  function markCurrentStepInvalid() {
    steps.value[currentStep.value].valid = false;
  }

  function nextStep() {
    if (!steps.value[currentStep.value].valid) return false;
    steps.value[currentStep.value].completed = true;
    if (currentStep.value < steps.value.length - 1) {
      currentStep.value++;
      return true;
    }
    return false;
  }

  function prevStep() {
    if (currentStep.value > 0) {
      currentStep.value--;
      return true;
    }
    return false;
  }

  function goToStep(index) {
    // 只能跳转到已完成的步骤或当前步骤
    if (index <= currentStep.value) {
      currentStep.value = index;
      return true;
    }
    return false;
  }

  async function submit() {
    isSubmitting.value = true;
    try {
      const res = await fetch('/api/wizard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData.value)
      });
      submitResult.value = await res.json();
      return submitResult.value;
    } finally {
      isSubmitting.value = false;
    }
  }

  function resetWizard() {
    currentStep.value = 0;
    formData.value = {};
    submitResult.value = null;
    steps.value.forEach(s => {
      s.completed = false;
      s.valid = false;
    });
  }

  return {
    steps, currentStep, formData, isSubmitting, submitResult,
    currentStepData, isLastStep, isFirstStep, progress, allStepsValid,
    setStepData, getStepData, markCurrentStepValid, markCurrentStepInvalid,
    nextStep, prevStep, goToStep, submit, resetWizard
  };
});
```

### 示例 11: 游戏状态 Store

```javascript
// 游戏状态 — 复杂交互 + 存档
const useGameStore = defineStore('game', () => {
  // 游戏状态
  const gameState = ref('menu'); // menu/playing/paused/gameover
  const score = ref(0);
  const highScore = ref(0);
  const level = ref(1);
  const lives = ref(3);
  const timeLeft = ref(60);
  const combo = ref(0);
  const maxCombo = ref(0);

  // 玩家状态
  const player = ref({
    x: 0, y: 0,
    velocityX: 0, velocityY: 0,
    powerups: [],
    invincible: false
  });

  // 游戏对象
  const enemies = ref([]);
  const items = ref([]);
  const particles = ref([]);

  // 存档
  const saves = ref([]);
  const currentSave = ref(null);

  // Getters
  const isPlaying = computed(() => gameState.value === 'playing');
  const isPaused = computed(() => gameState.value === 'paused');
  const isGameOver = computed(() => gameState.value === 'gameover');
  const comboMultiplier = computed(() => Math.min(5, 1 + Math.floor(combo.value / 10)));
  const levelProgress = computed(() => (score.value % 1000) / 10);
  const hasPowerup = computed((state) => (type) => 
    player.value.powerups.includes(type)
  );

  function startGame() {
    gameState.value = 'playing';
    score.value = 0;
    level.value = 1;
    lives.value = 3;
    timeLeft.value = 60;
    combo.value = 0;
    maxCombo.value = 0;
    enemies.value = [];
    items.value = [];
    particles.value = [];
  }

  function pauseGame() {
    gameState.value = 'paused';
  }

  function resumeGame() {
    gameState.value = 'playing';
  }

  function addScore(points) {
    const multiplier = comboMultiplier.value;
    score.value += points * multiplier;
    combo.value++;
    if (combo.value > maxCombo.value) maxCombo.value = combo.value;
    
    // 升级
    if (score.value >= level.value * 1000) {
      level.value++;
    }
  }

  function loseLife() {
    lives.value--;
    combo.value = 0;
    if (lives.value <= 0) {
      gameState.value = 'gameover';
      if (score.value > highScore.value) {
        highScore.value = score.value;
        localStorage.setItem('highScore', score.value);
      }
    }
  }

  function addPowerup(type) {
    if (!player.value.powerups.includes(type)) {
      player.value.powerups.push(type);
    }
  }

  function removePowerup(type) {
    player.value.powerups = player.value.powerups.filter(p => p !== type);
  }

  function spawnEnemy(type) {
    enemies.value.push({
      id: Date.now() + Math.random(),
      type,
      x: Math.random() * 800,
      y: -50,
      health: type === 'boss' ? 100 : 10,
      speed: type === 'fast' ? 3 : 1
    });
  }

  function spawnItem(type) {
    items.value.push({
      id: Date.now() + Math.random(),
      type,
      x: Math.random() * 800,
      y: -30
    });
  }

  function addParticle(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
      particles.value.push({
        id: Date.now() + Math.random(),
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        color,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.03
      });
    }
  }

  function updateParticles() {
    particles.value = particles.value
      .map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        life: p.life - p.decay
      }))
      .filter(p => p.life > 0);
  }

  function saveGame() {
    const save = {
      timestamp: Date.now(),
      score: score.value,
      level: level.value,
      lives: lives.value,
      player: { ...player.value },
      enemies: [...enemies.value],
      items: [...items.value]
    };
    saves.value.unshift(save);
    if (saves.value.length > 5) saves.value.pop();
    currentSave.value = save;
    localStorage.setItem('gameSaves', JSON.stringify(saves.value));
  }

  function loadGame(index = 0) {
    if (saves.value[index]) {
      const save = saves.value[index];
      score.value = save.score;
      level.value = save.level;
      lives.value = save.lives;
      player.value = { ...save.player };
      enemies.value = [...save.enemies];
      items.value = [...save.items];
      gameState.value = 'playing';
    }
  }

  function clearSaves() {
    saves.value = [];
    currentSave.value = null;
    localStorage.removeItem('gameSaves');
  }

  return {
    gameState, score, highScore, level, lives, timeLeft, combo, maxCombo,
    player, enemies, items, particles, saves, currentSave,
    isPlaying, isPaused, isGameOver, comboMultiplier, levelProgress, hasPowerup,
    startGame, pauseGame, resumeGame, addScore, loseLife,
    addPowerup, removePowerup, spawnEnemy, spawnItem,
    addParticle, updateParticles, saveGame, loadGame, clearSaves
  };
});
```

### 示例 12: 协作编辑 Store (CRDT 简化版)

```javascript
// 协作编辑 — 操作转换 (OT) 简化版
const useCollabStore = defineStore('collab', () => {
  const document = ref('');
  const cursor = ref(0);
  const selection = ref({ start: 0, end: 0 });
  const users = ref([]);
  const operations = ref([]);
  const isSyncing = ref(false);
  const conflictCount = ref(0);

  const version = computed(() => operations.value.length);
  const wordCount = computed(() => 
    document.value.trim().split(/\s+/).filter(Boolean).length
  );
  const charCount = computed(() => document.value.length);
  const lineCount = computed(() => document.value.split('\n').length);

  // 操作类型
  const OpType = {
    INSERT: 'insert',
    DELETE: 'delete',
    REPLACE: 'replace',
    CURSOR: 'cursor'
  };

  // 本地操作
  function insert(position, text, userId = 'local') {
    const op = {
      id: generateOpId(),
      type: OpType.INSERT,
      position,
      text,
      userId,
      timestamp: Date.now(),
      version: version.value
    };
    applyOperation(op);
    broadcastOperation(op);
    return op;
  }

  function deleteRange(start, end, userId = 'local') {
    const op = {
      id: generateOpId(),
      type: OpType.DELETE,
      start,
      end,
      userId,
      timestamp: Date.now(),
      version: version.value
    };
    applyOperation(op);
    broadcastOperation(op);
    return op;
  }

  function replaceRange(start, end, text, userId = 'local') {
    const op = {
      id: generateOpId(),
      type: OpType.REPLACE,
      start,
      end,
      text,
      userId,
      timestamp: Date.now(),
      version: version.value
    };
    applyOperation(op);
    broadcastOperation(op);
    return op;
  }

  // 应用操作
  function applyOperation(op) {
    switch (op.type) {
      case OpType.INSERT:
        document.value = 
          document.value.slice(0, op.position) + 
          op.text + 
          document.value.slice(op.position);
        break;
      case OpType.DELETE:
        document.value = 
          document.value.slice(0, op.start) + 
          document.value.slice(op.end);
        break;
      case OpType.REPLACE:
        document.value = 
          document.value.slice(0, op.start) + 
          op.text + 
          document.value.slice(op.end);
        break;
    }
    operations.value.push(op);
  }

  // 操作转换 (OT) — 解决冲突
  function transformOperation(localOp, remoteOp) {
    if (localOp.userId === remoteOp.userId) return localOp;

    const transformed = { ...localOp };

    if (localOp.type === OpType.INSERT && remoteOp.type === OpType.INSERT) {
      if (remoteOp.position <= localOp.position) {
        transformed.position += remoteOp.text.length;
      }
    }

    if (localOp.type === OpType.DELETE && remoteOp.type === OpType.INSERT) {
      if (remoteOp.position < localOp.start) {
        transformed.start += remoteOp.text.length;
        transformed.end += remoteOp.text.length;
      } else if (remoteOp.position < localOp.end) {
        transformed.end += remoteOp.text.length;
      }
    }

    if (localOp.type === OpType.INSERT && remoteOp.type === OpType.DELETE) {
      if (remoteOp.start < localOp.position) {
        transformed.position -= (remoteOp.end - remoteOp.start);
      }
    }

    if (localOp.type === OpType.DELETE && remoteOp.type === OpType.DELETE) {
      if (remoteOp.start >= localOp.end) {
        // 无重叠
      } else if (remoteOp.end <= localOp.start) {
        transformed.start -= (remoteOp.end - remoteOp.start);
        transformed.end -= (remoteOp.end - remoteOp.start);
      } else {
        // 部分重叠 — 简化处理
        transformed.start = Math.max(localOp.start, remoteOp.end);
        transformed.end = Math.max(localOp.end, remoteOp.end);
        conflictCount.value++;
      }
    }

    return transformed;
  }

  // 接收远程操作
  function receiveRemoteOperation(remoteOp) {
    // 转换所有未同步的本地操作
    let transformedOp = remoteOp;
    for (const localOp of operations.value.slice(remoteOp.version)) {
      transformedOp = transformOperation(transformedOp, localOp);
    }
    applyOperation(transformedOp);
  }

  // 广播操作 (模拟)
  function broadcastOperation(op) {
    // 实际项目中通过 WebSocket 广播
    console.log(`[Collab] Broadcast op: ${op.type} by ${op.userId}`);
  }

  // 用户管理
  function addUser(user) {
    users.value.push({
      ...user,
      cursor: 0,
      color: getRandomColor(),
      lastActive: Date.now()
    });
  }

  function removeUser(userId) {
    users.value = users.value.filter(u => u.id !== userId);
  }

  function updateUserCursor(userId, cursorPos) {
    const user = users.value.find(u => u.id === userId);
    if (user) user.cursor = cursorPos;
  }

  // 撤销/重做
  const undoStack = ref([]);
  const redoStack = ref([]);

  function undo() {
    const lastOp = operations.value.pop();
    if (lastOp) {
      undoStack.value.push(lastOp);
      // 反向操作
      const reverseOp = createReverseOp(lastOp);
      applyOperation(reverseOp);
    }
  }

  function redo() {
    const op = undoStack.value.pop();
    if (op) {
      redoStack.value.push(op);
      applyOperation(op);
    }
  }

  function createReverseOp(op) {
    switch (op.type) {
      case OpType.INSERT:
        return {
          type: OpType.DELETE,
          start: op.position,
          end: op.position + op.text.length,
          userId: op.userId,
          timestamp: Date.now()
        };
      case OpType.DELETE:
        return {
          type: OpType.INSERT,
          position: op.start,
          text: document.value.slice(op.start, op.end),
          userId: op.userId,
          timestamp: Date.now()
        };
      default:
        return op;
    }
  }

  function generateOpId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getRandomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  return {
    document, cursor, selection, users, operations, isSyncing, conflictCount,
    version, wordCount, charCount, lineCount,
    insert, deleteRange, replaceRange, receiveRemoteOperation,
    addUser, removeUser, updateUserCursor,
    undo, redo, undoStack, redoStack
  };
});
```

---

## 四、Pinia 插件系统深度解析

### 4.1 插件执行时机

```
createPinia()
    │
    ├── 注册插件: pinia.use(plugin)
    │     └── 插件进入 plugin set
    │
    ├── defineStore() 返回 useStore 函数
    │
    └── useStore() 首次调用
          │
          ├── 1. 创建 reactive state
          ├── 2. 创建 computed getters
          ├── 3. 绑定 actions
          ├── 4. 创建 Proxy store
          ├── 5. 缓存到 pinia._s
          ├── 6. 📌 遍历 pinia._p 调用每个插件(store)
          │     └── 插件可以:
          │         ├── 修改 store 属性
          │         ├── 添加新属性
          │         ├── 订阅 state/action 变化
          │         └── 替换方法
          └── 7. 返回 store
```

### 4.2 插件 API 完整能力

```javascript
// Pinia 插件可以访问的能力
function myPlugin(context) {
  // context 对象包含:
  // - store: 当前 store 实例
  // - app: Vue app 实例
  // - pinia: Pinia 根实例
  // - options: defineStore 的 options 参数

  // 1. 添加共享状态
  store.sharedState = ref('shared');

  // 2. 添加共享 action
  store.sharedAction = () => { /* ... */ };

  // 3. 订阅 state 变化
  store.$subscribe((mutation) => {
    // mutation: { storeId, type, events, oldValue, newValue }
    console.log(`${mutation.storeId} changed: ${mutation.type}`);
  });

  // 4. 订阅 action 调用
  store.$onAction(({ name, args, after, onError }) => {
    console.log(`Calling ${name}(${args})`);
    // after 回调: action 成功后执行
    after((result) => {
      console.log(`${name} returned:`, result);
    });
    // onError 回调: action 失败时执行
    onError((error) => {
      console.error(`${name} failed:`, error);
    });
  });

  // 5. 替换 store 方法
  const originalPatch = store.$patch;
  store.$patch = (patch) => {
    console.log('Patching:', patch);
    originalPatch(patch);
  };
}
```

---

## 五、Pinia 与 Vue 3 响应式集成

### 5.1 reactive vs ref 在 Store 中的区别

```javascript
// Options 语法 — 内部用 reactive
defineStore('options', {
  state: () => ({ count: 0, name: 'Pinia' }),
  // state() 返回普通对象 → Pinia 内部用 reactive() 包裹
  // 所以 getters 中直接通过 state.xxx 访问
  getters: {
    doubleCount: (state) => state.count * 2  // ✅ 直接访问
  }
});

// Setup 语法 — 手动用 ref/computed
defineStore('setup', () => {
  const count = ref(0);           // ref
  const name = ref('Pinia');      // ref
  const doubleCount = computed(() => count.value * 2);  // computed
  // 返回 ref/computed → Pinia 自动解包
  // 所以 store.xxx 直接拿到值，不需要 .value
  return { count, name, doubleCount };
});
```

### 5.2 StoreToRefs — 解构保持响应式

```javascript
// ❌ 错误：直接解构丢失响应式
const { count, name } = useStore();  // count 变成普通值

// ✅ 正确：用 storeToRefs 解构
import { storeToRefs } from 'pinia';
const { count, name } = storeToRefs(useStore());  // 保持 ref

// ✅ 或者直接用 store
const store = useStore();
// store.count 始终响应式
```

### 5.3 跨 Store 通信

```javascript
// Store A 依赖 Store B
const useUserStore = defineStore('user', () => {
  const profile = ref(null);
  return { profile };
});

const usePreferencesStore = defineStore('preferences', () => {
  const userStore = useUserStore(); // 直接导入另一个 store
  
  const theme = computed(() => 
    userStore.profile?.theme || 'light'
  );

  function syncWithUser() {
    if (userStore.profile) {
      theme.value = userStore.profile.theme;
    }
  }

  return { theme, syncWithUser };
});
```

---

## 六、性能优化策略

### 6.1 选择性订阅

```javascript
// ❌ 订阅整个 store — 任何变化都触发
store.$subscribe(() => {
  console.log('Store changed');
});

// ✅ 只订阅特定 state
store.$subscribe((mutation) => {
  if (mutation.storeId === 'cart' && mutation.events.key === 'items') {
    console.log('Cart items changed');
  }
});

// ✅ 用 computed 只订阅派生值
const itemCount = computed(() => store.items.length);
watch(itemCount, (count) => {
  console.log(`Cart has ${count} items`);
});
```

### 6.2 $patch 批量更新

```javascript
// ❌ 多次单独更新 — 触发多次订阅
store.count++;
store.name = 'new';
store.age = 25;

// ✅ 一次性批量更新 — 只触发一次订阅
store.$patch({
  count: store.count + 1,
  name: 'new',
  age: 25
});

// ✅ 函数式 patch — 复杂逻辑
store.$patch((state) => {
  state.items.push(newItem);
  state.total += newItem.price;
  state.count++;
});
```

### 6.3 Store 按需加载

```javascript
// 路由级别按需加载 Store
const useHeavyStore = defineStore('heavy', () => {
  // 大量计算逻辑
  const data = ref(generateLargeDataset());
  const processed = computed(() => heavyProcessing(data.value));
  return { data, processed };
});

// 只在需要时初始化
async function loadHeavyFeature() {
  const heavyStore = useHeavyStore();
  await heavyStore.loadData();
}
```

---

## 七、TypeScript 类型安全

### 7.1 自动类型推导

```typescript
import { defineStore } from 'pinia';

// Pinia 自动推导所有类型
const useCounterStore = defineStore('counter', () => {
  const count = ref(0);
  const doubleCount = computed(() => count.value * 2);
  
  function increment() {
    count.value++;
  }

  return { count, doubleCount, increment };
});

// 使用 — 完美类型提示
const store = useCounterStore();
store.count;        // number
store.doubleCount;  // number
store.increment();  // () => void
```

### 7.2 严格类型 Store

```typescript
// 定义 Store 接口
interface UserState {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  preferences: {
    theme: 'light' | 'dark';
    language: string;
  };
}

// 用类型约束 state
const useUserStore = defineStore('user', {
  state: (): UserState => ({
    id: 0,
    name: '',
    email: '',
    role: 'guest',
    preferences: {
      theme: 'light',
      language: 'zh-CN'
    }
  }),

  getters: {
    displayName: (state): string => state.name || 'Anonymous',
    isAdmin: (state): boolean => state.role === 'admin'
  },

  actions: {
    async login(credentials: { email: string; password: string }): Promise<void> {
      // 类型安全
    },
    updateRole(role: UserState['role']): void {
      this.role = role;
    }
  }
});
```

---

## 八、完整执行流程图

```
┌─────────────────────────────────────────────────────────┐
│                    Pinia 执行流程                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. createPinia()                                        │
│     └── 创建 Pinia 根实例 (Map + Plugin Set)             │
│                                                          │
│  2. app.use(pinia)                                       │
│     └── 安装到 Vue 应用 (provide/inject)                 │
│                                                          │
│  3. defineStore('name', options)                         │
│     └── 返回 useStore 函数 (不创建实例)                   │
│                                                          │
│  4. const store = useStore()  ← 首次调用                  │
│     ├── 创建 reactive state                              │
│     ├── 创建 computed getters                            │
│     ├── 绑定 actions                                     │
│     ├── 创建 Proxy 代理                                  │
│     ├── 缓存到 pinia._s (单例)                           │
│     └── 应用所有插件                                     │
│                                                          │
│  5. const store2 = useStore()  ← 后续调用                 │
│     └── 直接返回缓存实例                                  │
│                                                          │
│  6. store.count = 5  或  store.increment()               │
│     ├── 修改 reactive state                              │
│     ├── 触发 Vue 3 依赖收集                               │
│     ├── 通知 $subscribe 回调                             │
│     └── 更新视图                                         │
│                                                          │
│  7. store.$patch({ count: 10 })                          │
│     ├── 批量更新 state                                   │
│     ├── 只触发一次 $subscribe                            │
│     └── 更新视图                                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 九、速查表

### 9.1 Store 内置属性/方法

| 属性/方法 | 类型 | 说明 |
|-----------|------|------|
| `$id` | string | Store 唯一标识 |
| `$state` | object | 响应式状态对象 |
| `$patch(fn)` | function | 批量更新 (函数式) |
| `$patch(obj)` | function | 批量更新 (对象式) |
| `$reset()` | function | 重置到初始状态 |
| `$subscribe(fn)` | function | 订阅状态变化 |
| `$onAction(fn)` | function | 订阅 action 调用 |
| `$dispose()` | function | 销毁 Store |

### 9.2 插件列表

| 插件 | 用途 | 代码量 |
|------|------|--------|
| persist | localStorage 持久化 | ~30 行 |
| devtools | DevTools 增强 | ~20 行 |
| logger | 操作日志 | ~15 行 |
| errorBoundary | 错误边界 | ~20 行 |
| hmr | 热更新 | ~10 行 |
| timeTravel | 时间旅行 | ~40 行 |

### 9.3 使用场景选型

| 场景 | 推荐方案 | 原因 |
|------|----------|------|
| 简单组件状态 | ref/reactive | 无需 Store |
| 跨组件共享 | Pinia | 官方推荐 |
| 大型应用 | Pinia + 插件 | 可扩展 |
| SSR 应用 | Pinia | 原生支持 |
| 需要时间旅行 | Pinia + timeTravel 插件 | 调试友好 |
| 需要持久化 | Pinia + persist 插件 | 开箱即用 |

---

## 十、常见陷阱与最佳实践

### 10.1 陷阱

```javascript
// ❌ 陷阱 1: 直接解构 Store
const { count } = useStore();  // 丢失响应式
count.value++;  // 不触发更新

// ✅ 修复: 用 storeToRefs
import { storeToRefs } from 'pinia';
const { count } = storeToRefs(useStore());

// ❌ 陷阱 2: 在 getter 中修改 state
getters: {
  doubleAndIncrement: (state) => {
    state.count++;  // ❌ getter 应该是纯函数
    return state.count * 2;
  }
}

// ✅ 修复: 修改逻辑放在 action
actions: {
  doubleAndIncrement() {
    this.count++;
    return this.count * 2;
  }
}

// ❌ 陷阱 3: 在 setup 外调用 useStore
const store = useStore();  // ❌ 不在 setup/computed 中
function someFunction() {
  store.count++;  // 可能报错
}

// ✅ 修复: 在 setup 中调用
function useFeature() {
  const store = useStore();  // ✅ 在 setup 中
  return { store };
}
```

### 10.2 最佳实践

```javascript
// ✅ 实践 1: 扁平化 state
defineStore('user', {
  state: () => ({
    // 扁平结构
    userId: 0,
    userName: '',
    userRole: '',
    userTheme: '',
    // 而不是: user: { profile: { ... } }
  })
});

// ✅ 实践 2: 单一职责
// 一个 Store 只做一件事
defineStore('auth', { ... });       // 认证
defineStore('cart', { ... });       // 购物车
defineStore('theme', { ... });      // 主题

// ✅ 实践 3: 派生状态用 getters
getters: {
  // 能用计算得出的就不存
  totalPrice: (state) => 
    state.items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  
  // 复杂派生用 computed
  groupedItems: (state) => 
    state.items.reduce((g, i) => {
      (g[i.category] = g[i.category] || []).push(i);
      return g;
    }, {})
}

// ✅ 实践 4: 异步操作放 actions
actions: {
  async fetchUser(id) {
    this.loading = true;
    try {
      const res = await fetch(`/api/users/${id}`);
      this.user = await res.json();
    } finally {
      this.loading = false;
    }
  }
}

// ✅ 实践 5: 合理使用 $patch
actions: {
  updateMultipleFields(data) {
    // 批量更新只触发一次订阅
    this.$patch({
      name: data.name,
      email: data.email,
      avatar: data.avatar
    });
  }
}
```

---

## 十一、与前四轮的区别

| 维度 | R1-R4 (4/28-4/30) | R5 (5/1 本轮) |
|------|-------------------|---------------|
| 核心实现 | Mini Redux / Mini Zustand | **Mini Pinia** |
| 响应式基础 | 手动订阅/Proxy/Signals | **Vue 3 reactive + computed** |
| Store 架构 | 嵌套 Module | **扁平 Store** |
| 语法风格 | 纯 JS 类 | **Options + Setup 双语法** |
| 插件系统 | 基础中间件 | **6 种生产级插件** |
| 业务示例 | 计数器/购物车/表单等通用 | **认证/主题/路由/通知/WS/上传/搜索/Wizard/游戏/协作** |
| 重点 | 理解状态管理通用原理 | **理解 Vue 生态最佳实践** |
| 类型安全 | 基础 TS | **严格类型推导** |
| 性能优化 | 选择性订阅 | **$patch 批量 + 按需加载** |

---

*专项完成时间：2026-05-01 11:00*
*文档大小：~45KB*
*示例数量：12 个全新业务场景*
*核心实现：Mini Pinia (~120 行)*
*阶段二 Day 4 (Pinia 状态管理) ✅*
