# Web 性能优化技术学习与实践

> 本文档涵盖 Web 性能优化的三大核心技术：懒加载、防抖与节流、内存管理。每个技术点都包含清晰的代码示例和实际应用场景说明。

---

## 目录

1. [懒加载 (Lazy Loading)](#1-懒加载-lazy-loading)
2. [防抖与节流 (Debounce & Throttle)](#2-防抖与节流-debounce--throttle)
3. [内存管理 (Memory Management)](#3-内存管理-memory-management)

---

## 1. 懒加载 (Lazy Loading)

懒加载是一种延迟加载资源的技术，只在需要时才加载内容，可以显著减少初始页面加载时间和带宽消耗。

### 1.1 图片懒加载

#### 基础实现

```javascript
// 方案一：使用 Intersection Observer API（推荐）
class ImageLazyLoader {
  constructor(options = {}) {
    this.options = {
      rootMargin: options.rootMargin || '0px',
      threshold: options.threshold || 0.1,
      placeholder: options.placeholder || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      ...options
    };
    this.observer = null;
    this.init();
  }

  init() {
    // 检查浏览器支持
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(this.handleIntersect.bind(this), {
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold
      });
    }
  }

  handleIntersect(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        this.loadImage(img);
        this.observer.unobserve(img);
      }
    });
  }

  loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;

    // 创建新 Image 对象预加载
    const image = new Image();
    image.src = src;
    
    image.onload = () => {
      img.src = src;
      img.classList.add('loaded');
      img.removeAttribute('data-src');
    };

    image.onerror = () => {
      img.classList.add('error');
      console.warn(`Failed to load image: ${src}`);
    };
  }

  observe(container = document) {
    const images = container.querySelectorAll('img[data-src]');
    
    if (this.observer) {
      images.forEach(img => this.observer.observe(img));
    } else {
      // 降级方案：直接加载所有图片
      images.forEach(img => this.loadImage(img));
    }
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// 使用示例
const lazyLoader = new ImageLazyLoader({
  rootMargin: '50px 0px', // 提前 50px 开始加载
  threshold: 0.01
});

// 初始化观察
lazyLoader.observe(document);

// 动态添加内容后重新观察
// lazyLoader.observe(newContainer);
```

```html
<!-- HTML 使用示例 -->
<img 
  data-src="https://example.com/image-large.jpg" 
  src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
  alt="描述文字"
  loading="lazy"
/>

<!-- 响应式图片懒加载 -->
<img 
  data-src="image-small.jpg"
  data-srcset="image-small.jpg 480w, image-medium.jpg 768w, image-large.jpg 1200w"
  data-sizes="auto"
  src="placeholder.jpg"
  alt="响应式图片"
/>
```

#### 支持响应式图片的增强版本

```javascript
class ResponsiveImageLazyLoader {
  constructor(options = {}) {
    this.options = {
      rootMargin: '0px',
      threshold: 0.1,
      ...options
    };
    this.observer = new IntersectionObserver(this.handleIntersect.bind(this), this.options);
  }

  handleIntersect(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        this.loadResponsiveImage(img);
        this.observer.unobserve(img);
      }
    });
  }

  loadResponsiveImage(img) {
    const srcset = img.dataset.srcset;
    const sizes = img.dataset.sizes;
    const src = img.dataset.src;

    if (srcset) {
      img.srcset = srcset;
    }
    
    if (sizes) {
      img.sizes = sizes;
    }
    
    if (src) {
      img.src = src;
    }

    // 移除 data 属性
    img.removeAttribute('data-src');
    img.removeAttribute('data-srcset');
    img.removeAttribute('data-sizes');
    img.classList.add('loaded');
  }

  observe() {
    const images = document.querySelectorAll('img[data-src]');
    images.forEach(img => this.observer.observe(img));
  }
}
```

### 1.2 组件懒加载

#### React 组件懒加载

```javascript
// React 16.6+ 使用 React.lazy 和 Suspense
import React, { lazy, Suspense, useState } from 'react';

// 懒加载组件
const HeavyComponent = lazy(() => import('./HeavyComponent'));
const ChartComponent = lazy(() => import('./ChartComponent'));
const EditorComponent = lazy(() => import('./EditorComponent'));

// 加载占位符组件
const LoadingSpinner = () => (
  <div className="loading-spinner">
    <div className="spinner"></div>
    <p>加载中...</p>
  </div>
);

// 错误边界组件
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Component loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>组件加载失败，请刷新页面重试</div>;
    }
    return this.props.children;
  }
}

// 主应用组件
function App() {
  const [showHeavy, setShowHeavy] = useState(false);
  const [showChart, setShowChart] = useState(false);

  return (
    <div className="app">
      <button onClick={() => setShowHeavy(true)}>
        加载重型组件
      </button>
      
      <button onClick={() => setShowChart(true)}>
        加载图表组件
      </button>

      <ErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          {showHeavy && <HeavyComponent />}
          {showChart && <ChartComponent />}
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

export default App;
```

#### Vue 组件懒加载

```javascript
// Vue 3 组件懒加载
import { defineAsyncComponent, ref } from 'vue';

// 基础懒加载
const HeavyComponent = defineAsyncComponent(() => 
  import('./components/HeavyComponent.vue')
);

// 带加载选项的懒加载
const ChartComponent = defineAsyncComponent({
  // 加载函数
  loader: () => import('./components/ChartComponent.vue'),
  
  // 加载中组件
  loadingComponent: () => import('./components/LoadingSpinner.vue'),
  
  // 错误组件
  errorComponent: () => import('./components/LoadError.vue'),
  
  // 显示加载组件前的延迟（毫秒）
  delay: 200,
  
  // 超时时间（毫秒）
  timeout: 3000,
  
  // 错误时是否重试
  onError(error, retry, fail, attempts) {
    if (attempts <= 3) {
      // 延迟后重试
      retry();
    } else {
      // 超过最大重试次数，失败
      fail();
    }
  }
});

// 使用示例
export default {
  components: {
    HeavyComponent,
    ChartComponent
  },
  setup() {
    const showComponent = ref(false);
    
    const loadComponent = () => {
      showComponent.value = true;
    };
    
    return {
      showComponent,
      loadComponent
    };
  }
};
```

```vue
<!-- Vue 模板使用 -->
<template>
  <div class="app">
    <button @click="loadComponent">加载组件</button>
    
    <Suspense>
      <template #default>
        <HeavyComponent v-if="showComponent" />
      </template>
      <template #fallback>
        <LoadingSpinner />
      </template>
    </Suspense>
  </div>
</template>
```

### 1.3 路由懒加载

#### React Router 路由懒加载

```javascript
import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// 懒加载页面组件
const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// 页面加载占位符
const PageLoader = () => (
  <div className="page-loader">
    <div className="loader-animation"></div>
    <p>页面加载中...</p>
  </div>
);

// 路由配置
function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRoutes;
```

#### Vue Router 路由懒加载

```javascript
// Vue Router 4 路由配置
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import(/* webpackChunkName: "home" */ '@/views/HomeView.vue'),
    meta: {
      title: '首页',
      requiresAuth: false
    }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import(/* webpackChunkName: "about" */ '@/views/AboutView.vue'),
    meta: {
      title: '关于我们',
      requiresAuth: false
    }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import(/* webpackChunkName: "dashboard" */ '@/views/DashboardView.vue'),
    meta: {
      title: '控制台',
      requiresAuth: true
    },
    // 路由独享守卫
    beforeEnter: (to, from, next) => {
      // 权限检查
      const isAuthenticated = checkAuth();
      if (isAuthenticated) {
        next();
      } else {
        next('/login');
      }
    }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import(/* webpackChunkName: "settings" */ '@/views/SettingsView.vue'),
    meta: {
      title: '设置',
      requiresAuth: true
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import(/* webpackChunkName: "notfound" */ '@/views/NotFoundView.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  // 滚动行为
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  }
});

// 全局前置守卫
router.beforeEach((to, from, next) => {
  // 设置页面标题
  document.title = to.meta.title || '应用标题';
  
  // 检查登录状态
  if (to.meta.requiresAuth) {
    const isAuthenticated = localStorage.getItem('token');
    if (!isAuthenticated) {
      next('/login');
    } else {
      next();
    }
  } else {
    next();
  }
});

// 全局后置守卫
router.afterEach((to, from) => {
  // 页面加载完成后的操作，如统计
  console.log(`导航从 ${from.path} 到 ${to.path}`);
});

export default router;
```

#### 预加载策略

```javascript
// 智能预加载：当用户可能访问时提前加载
class RoutePrefetcher {
  constructor(router) {
    this.router = router;
    this.prefetched = new Set();
    this.setupPrefetch();
  }

  setupPrefetch() {
    // 监听鼠标悬停事件
    document.addEventListener('mouseover', (e) => {
      const link = e.target.closest('a[data-prefetch]');
      if (link && link.href) {
        this.prefetchRoute(link.href);
      }
    });

    // 监听可见性变化（当链接进入视口时预加载）
    if ('IntersectionObserver' in window) {
      this.setupIntersectionPrefetch();
    }
  }

  setupIntersectionPrefetch() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const link = entry.target;
          if (link.href) {
            this.prefetchRoute(link.href);
            observer.unobserve(link);
          }
        }
      });
    }, {
      rootMargin: '100px',
      threshold: 0
    });

    document.querySelectorAll('a[data-prefetch]').forEach(link => {
      observer.observe(link);
    });
  }

  async prefetchRoute(url) {
    const path = this.extractPath(url);
    
    // 避免重复预加载
    if (this.prefetched.has(path)) {
      return;
    }

    try {
      // 找到匹配的路由
      const route = this.router.getRoutes().find(r => r.path === path);
      if (route && route.component) {
        // 触发组件加载
        await route.component();
        this.prefetched.add(path);
        console.log(`预加载完成：${path}`);
      }
    } catch (error) {
      console.warn(`预加载失败：${path}`, error);
    }
  }

  extractPath(url) {
    const currentOrigin = window.location.origin;
    return url.replace(currentOrigin, '').split('?')[0];
  }
}

// 使用示例
// const prefetcher = new RoutePrefetcher(router);
```

---

## 2. 防抖与节流 (Debounce & Throttle)

防抖和节流是优化高频事件处理的重要技术，可以有效减少函数执行次数，提升性能。

### 2.1 防抖函数 (Debounce)

#### 基础实现

```javascript
/**
 * 防抖函数
 * @param {Function} func - 需要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @param {boolean} immediate - 是否立即执行
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait, immediate = false) {
  let timeout = null;
  let result = null;

  const debounced = function(...args) {
    const context = this;
    
    // 如果设置了立即执行且当前没有定时器
    if (immediate && !timeout) {
      result = func.apply(context, args);
    }

    // 清除之前的定时器
    clearTimeout(timeout);

    // 设置新的定时器
    timeout = setTimeout(() => {
      timeout = null;
      // 如果不是立即执行，则在等待后执行
      if (!immediate) {
        result = func.apply(context, args);
      }
    }, wait);

    return result;
  };

  // 提供取消方法
  debounced.cancel = function() {
    clearTimeout(timeout);
    timeout = null;
  };

  // 提供立即执行方法
  debounced.flush = function(...args) {
    clearTimeout(timeout);
    timeout = null;
    return func.apply(this, args);
  };

  return debounced;
}
```

#### 使用场景示例

```javascript
// 场景 1：搜索框输入联想
class SearchBox {
  constructor(inputElement, searchCallback) {
    this.input = inputElement;
    this.searchCallback = searchCallback;
    this.init();
  }

  init() {
    // 使用防抖，避免每次输入都发送请求
    this.handleInput = debounce((value) => {
      if (value.trim()) {
        this.searchCallback(value);
      }
    }, 300);

    this.input.addEventListener('input', (e) => {
      this.handleInput(e.target.value);
    });
  }
}

// 使用示例
const searchBox = new SearchBox(
  document.getElementById('search-input'),
  async (query) => {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const results = await response.json();
    displayResults(results);
  }
);

// 场景 2：窗口大小调整
function handleResize() {
  console.log('窗口大小:', window.innerWidth, window.innerHeight);
  // 重新计算布局、重绘 canvas 等
  recalculateLayout();
}

// 防抖处理 resize 事件
window.addEventListener('resize', debounce(handleResize, 250));

// 场景 3：表单自动保存
class AutoSaveForm {
  constructor(formElement, saveCallback) {
    this.form = formElement;
    this.saveCallback = saveCallback;
    this.init();
  }

  init() {
    // 用户停止输入 2 秒后自动保存
    this.autoSave = debounce(() => {
      const formData = new FormData(this.form);
      const data = Object.fromEntries(formData);
      this.saveCallback(data);
    }, 2000);

    this.form.addEventListener('input', () => {
      this.autoSave();
    });
  }
}

// 场景 4：按钮防止重复点击
function submitForm(formData) {
  console.log('提交表单数据:', formData);
  // 发送请求...
}

const submitButton = document.getElementById('submit-btn');
submitButton.addEventListener('click', debounce(() => {
  submitForm(getFormData());
}, 1000, true)); // immediate=true 确保第一次立即执行
```

#### 带时间戳的防抖版本

```javascript
/**
 * 带时间戳的防抖函数（可以获取最后一次执行的时间）
 */
function debounceWithTimestamp(func, wait) {
  let timeout = null;
  let lastInvokeTime = 0;

  const debounced = function(...args) {
    const context = this;
    const now = Date.now();

    clearTimeout(timeout);

    timeout = setTimeout(() => {
      lastInvokeTime = now;
      func.apply(context, args);
    }, wait);
  };

  // 获取最后一次执行时间
  debounced.getLastInvokeTime = () => lastInvokeTime;

  return debounced;
}
```

### 2.2 节流函数 (Throttle)

#### 基础实现（时间戳版）

```javascript
/**
 * 节流函数 - 时间戳版本
 * @param {Function} func - 需要节流的函数
 * @param {number} wait - 间隔时间（毫秒）
 * @param {Object} options - 配置选项
 * @returns {Function} 节流后的函数
 */
function throttle(func, wait, options = {}) {
  let timeout = null;
  let previous = 0;
  const { leading = true, trailing = true } = options;

  const later = function(context, args) {
    timeout = null;
    if (trailing) {
      func.apply(context, args);
    }
  };

  const throttled = function(...args) {
    const context = this;
    const now = Date.now();

    if (!previous && leading === false) {
      previous = now;
    }

    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(context, args);
    } else if (!timeout && trailing) {
      timeout = setTimeout(() => {
        previous = leading === false ? 0 : Date.now();
        timeout = null;
        func.apply(context, args);
      }, remaining);
    }
  };

  // 提供取消方法
  throttled.cancel = function() {
    clearTimeout(timeout);
    timeout = null;
    previous = 0;
  };

  return throttled;
}
```

#### 基础实现（定时器版）

```javascript
/**
 * 节流函数 - 定时器版本
 */
function throttleTimer(func, wait) {
  let timeout = null;

  const throttled = function(...args) {
    const context = this;

    if (!timeout) {
      // 立即执行
      func.apply(context, args);
      
      // 设置定时器
      timeout = setTimeout(() => {
        timeout = null;
      }, wait);
    }
  };

  throttled.cancel = function() {
    clearTimeout(timeout);
    timeout = null;
  };

  return throttled;
}
```

#### 使用场景示例

```javascript
// 场景 1：滚动加载更多
class InfiniteScroll {
  constructor(options = {}) {
    this.container = options.container || window;
    this.callback = options.callback;
    this.threshold = options.threshold || 100;
    this.loading = false;
    this.init();
  }

  init() {
    // 使用节流限制滚动事件处理频率
    this.handleScroll = throttle(() => {
      if (this.loading) return;

      const scrollTop = this.container === window 
        ? window.scrollY 
        : this.container.scrollTop;
      
      const scrollHeight = this.container === window
        ? document.documentElement.scrollHeight
        : this.container.scrollHeight;
      
      const clientHeight = this.container === window
        ? window.innerHeight
        : this.container.clientHeight;

      // 距离底部小于阈值时触发加载
      if (scrollTop + clientHeight >= scrollHeight - this.threshold) {
        this.loadMore();
      }
    }, 200);

    this.container.addEventListener('scroll', this.handleScroll);
  }

  async loadMore() {
    this.loading = true;
    try {
      await this.callback();
    } finally {
      this.loading = false;
    }
  }

  destroy() {
    this.container.removeEventListener('scroll', this.handleScroll);
    this.handleScroll.cancel();
  }
}

// 使用示例
const infiniteScroll = new InfiniteScroll({
  callback: async () => {
    const response = await fetch('/api/items?page=2');
    const items = await response.json();
    renderItems(items);
  }
});

// 场景 2：鼠标移动跟踪
function trackMousePosition(e) {
  console.log('鼠标位置:', e.clientX, e.clientY);
  // 更新自定义光标、热力图统计等
}

// 节流处理 mousemove 事件
document.addEventListener('mousemove', throttle(trackMousePosition, 100));

// 场景 3：视频播放进度上报
function reportVideoProgress(videoElement) {
  const reportProgress = throttle(() => {
    const progress = {
      currentTime: videoElement.currentTime,
      duration: videoElement.duration,
      percent: (videoElement.currentTime / videoElement.duration) * 100
    };
    
    // 发送进度到服务器
    fetch('/api/video/progress', {
      method: 'POST',
      body: JSON.stringify(progress)
    });
  }, 5000); // 每 5 秒上报一次

  videoElement.addEventListener('timeupdate', reportProgress);
}

// 场景 4：拖拽操作
function handleDrag(e) {
  const element = document.getElementById('draggable');
  element.style.left = e.clientX + 'px';
  element.style.top = e.clientY + 'px';
}

// 节流优化拖拽性能
document.addEventListener('mousemove', throttle(handleDrag, 16)); // 约 60fps
```

### 2.3 防抖与节流对比

```javascript
/**
 * 防抖 vs 节流 对比演示
 */
const comparisonDemo = {
  // 防抖：n 秒后只执行一次，适合在事件停止后执行
  debounce: {
    description: '连续触发时，只有最后一次触发会在等待时间后执行',
    useCases: [
      '搜索框输入联想',
      '表单自动保存',
      '窗口 resize 事件',
      '防止按钮重复点击'
    ],
    code: `
      // 用户连续输入 "hello"
      // h -> 等待 300ms
      // he -> 清除上一个，重新等待 300ms
      // hel -> 清除上一个，重新等待 300ms
      // hell -> 清除上一个，重新等待 300ms
      // hello -> 清除上一个，重新等待 300ms
      // [300ms 后] -> 执行搜索函数
    `
  },

  // 节流：每隔 n 秒执行一次，适合需要定期执行的场景
  throttle: {
    description: '连续触发时，每隔固定时间执行一次',
    useCases: [
      '滚动加载更多',
      '鼠标移动跟踪',
      '视频进度上报',
      '拖拽操作'
    ],
    code: `
      // 用户持续滚动页面
      // 0ms -> 立即执行
      // 100ms -> 忽略
      // 200ms -> 忽略
      // 300ms -> 执行（距离上次执行已过 300ms）
      // 400ms -> 忽略
      // 500ms -> 忽略
      // 600ms -> 执行
    `
  }
};

// 可视化对比
function visualizeDebounceVsThrottle() {
  console.table(comparisonDemo);
}
```

### 2.4 高级组合用法

```javascript
/**
 * 防抖 + 节流组合：限制最大执行频率，但在停止触发后确保最后一次执行
 */
function debounceThrottle(func, wait, maxWait) {
  let timeout = null;
  let lastCallTime = 0;
  let lastInvokeTime = 0;

  const throttled = function(...args) {
    const context = this;
    const now = Date.now();
    
    // 清除之前的定时器
    if (timeout) {
      clearTimeout(timeout);
    }

    // 检查是否达到最大等待时间
    if (maxWait && (now - lastCallTime) >= maxWait) {
      lastInvokeTime = now;
      lastCallTime = now;
      func.apply(context, args);
      return;
    }

    // 设置防抖定时器
    timeout = setTimeout(() => {
      lastInvokeTime = now;
      lastCallTime = now;
      func.apply(context, args);
    }, wait);
  };

  return throttled;
}

// 使用场景：既要限制频率，又要确保最后一次执行
const optimizedScroll = debounceThrottle(() => {
  updateScrollPosition();
}, 100, 500); // 至少 100ms 执行一次，最多等待 500ms
```

---

## 3. 内存管理 (Memory Management)

内存泄漏是 Web 应用性能问题的常见原因，会导致页面变慢甚至崩溃。

### 3.1 内存泄漏常见原因

#### 1. 全局变量

```javascript
// ❌ 错误示例：意外创建全局变量
function processData() {
  // 忘记使用 var/let/const，创建了全局变量
  largeData = new Array(1000000).fill('data');
}

// ✅ 正确示例
function processData() {
  const largeData = new Array(1000000).fill('data');
  // 使用完后及时清理
  // largeData = null; // 在函数作用域外不需要，函数结束自动回收
}

// ❌ 错误示例：过大的全局缓存
window.appCache = {
  users: [],
  posts: [],
  comments: [],
  // ... 无限增长
};

// ✅ 正确示例：使用 LRU 缓存
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    
    // 移到最新
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

const appCache = new LRUCache(1000);
```

#### 2. 定时器未清理

```javascript
// ❌ 错误示例：定时器未清理
class TimerComponent {
  start() {
    // 组件销毁时定时器仍在运行
    this.intervalId = setInterval(() => {
      this.update();
    }, 1000);
  }

  update() {
    console.log('更新...');
  }
  
  // 忘记实现销毁方法
}

// ✅ 正确示例
class TimerComponent {
  constructor() {
    this.intervalId = null;
  }

  start() {
    this.intervalId = setInterval(() => {
      this.update();
    }, 1000);
  }

  update() {
    console.log('更新...');
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

// 使用
const timer = new TimerComponent();
timer.start();
// 组件销毁时
timer.destroy();
```

#### 3. 事件监听器未移除

```javascript
// ❌ 错误示例：事件监听器未移除
class ButtonHandler {
  constructor(button) {
    this.button = button;
    this.handleClick = this.handleClick.bind(this);
    
    // 添加监听器
    this.button.addEventListener('click', this.handleClick);
    
    // 忘记在销毁时移除
  }

  handleClick(e) {
    console.log('按钮被点击');
  }
}

// ✅ 正确示例
class ButtonHandler {
  constructor(button) {
    this.button = button;
    this.handleClick = this.handleClick.bind(this);
    this.button.addEventListener('click', this.handleClick);
  }

  handleClick(e) {
    console.log('按钮被点击');
  }

  destroy() {
    this.button.removeEventListener('click', this.handleClick);
    this.button = null;
  }
}

// 使用 WeakMap 管理事件监听器
const eventListeners = new WeakMap();

function addEventWithCleanup(element, event, handler) {
  if (!eventListeners.has(element)) {
    eventListeners.set(element, []);
  }
  
  eventListeners.get(element).push({ event, handler });
  element.addEventListener(event, handler);
}

function cleanupEvents(element) {
  const listeners = eventListeners.get(element);
  if (listeners) {
    listeners.forEach(({ event, handler }) => {
      element.removeEventListener(event, handler);
    });
    eventListeners.delete(element);
  }
}
```

#### 4. 闭包引用

```javascript
// ❌ 错误示例：闭包持有大对象引用
function createHandler() {
  const largeData = new Array(1000000).fill('data');
  
  return function() {
    // 即使不使用 largeData，闭包也会持有它的引用
    console.log('处理事件');
  };
}

const handler = createHandler();
document.addEventListener('click', handler);
// largeData 永远不会被回收

// ✅ 正确示例 1：只引用需要的数据
function createHandler() {
  const largeData = new Array(1000000).fill('data');
  const neededData = largeData.slice(0, 10); // 只保留需要的部分
  
  return function() {
    console.log('处理事件', neededData);
  };
}

// ✅ 正确示例 2：及时清理
function createHandler() {
  let largeData = new Array(1000000).fill('data');
  
  const handler = function() {
    console.log('处理事件');
    // 使用后清理
    largeData = null;
  };
  
  return handler;
}
```

#### 5. DOM 引用

```javascript
// ❌ 错误示例：分离的 DOM 节点仍被引用
let elements = [];

function createElements() {
  for (let i = 0; i < 1000; i++) {
    const div = document.createElement('div');
    div.textContent = `Item ${i}`;
    document.body.appendChild(div);
    elements.push(div);
  }
}

function removeElements() {
  // 只从 DOM 移除，但数组仍持有引用
  elements.forEach(el => el.remove());
  // elements 数组仍然持有所有 div 的引用！
}

// ✅ 正确示例
let elements = [];

function createElements() {
  for (let i = 0; i < 1000; i++) {
    const div = document.createElement('div');
    div.textContent = `Item ${i}`;
    document.body.appendChild(div);
    elements.push(div);
  }
}

function removeElements() {
  elements.forEach(el => el.remove());
  elements = []; // 清空数组，释放引用
}

// 更好的方式：使用 Fragment
function createElementsOptimized() {
  const fragment = document.createDocumentFragment();
  
  for (let i = 0; i < 1000; i++) {
    const div = document.createElement('div');
    div.textContent = `Item ${i}`;
    fragment.appendChild(div);
  }
  
  document.body.appendChild(fragment);
  // fragment 不需要保存引用
}
```

#### 6. 分离的 DOM 节点（Detached DOM）

```javascript
// ❌ 错误示例：分离的 DOM 树
let cache = {};

function createDetachedTree() {
  const root = document.createElement('div');
  const child1 = document.createElement('div');
  const child2 = document.createElement('div');
  
  root.appendChild(child1);
  root.appendChild(child2);
  
  // 缓存了未连接到 DOM 的节点
  cache.tree = root;
  
  // 即使从 DOM 移除，整个树仍被缓存持有
}

// ✅ 正确示例
let cache = {};

function createDetachedTree() {
  const root = document.createElement('div');
  const child1 = document.createElement('div');
  const child2 = document.createElement('div');
  
  root.appendChild(child1);
  root.appendChild(child2);
  
  // 只缓存需要的数据，而不是 DOM 节点
  cache.data = {
    id: root.id,
    className: root.className,
    children: child1.textContent
  };
}

// 或者使用 WeakMap 缓存 DOM 节点
const domCache = new WeakMap();

function cacheDOMNode(node, data) {
  domCache.set(node, data);
  // WeakMap 会在 node 被垃圾回收时自动清理
}
```

### 3.2 如何检测内存泄漏

#### Chrome DevTools 内存分析

```javascript
/**
 * 使用 Chrome DevTools 检测内存泄漏的步骤：
 * 
 * 1. 打开 Chrome DevTools (F12)
 * 2. 切换到 Performance 面板
 * 3. 勾选 Memory 选项
 * 4. 开始录制并执行操作
 * 5. 停止录制，分析内存变化
 * 
 * 或使用 Memory 面板：
 * 1. 切换到 Memory 面板
 * 2. 选择 "Heap snapshot"
 * 3. 拍摄快照
 * 4. 执行可能泄漏的操作
 * 5. 再次拍摄快照
 * 6. 比较两个快照，查找增长的对象
 */

// 编程方式检查内存使用
function checkMemoryUsage() {
  if (performance.memory) {
    const memory = performance.memory;
    console.log('内存使用情况:', {
      已使用: `${Math.round(memory.usedJSHeapSize / 1048576)} MB`,
      总限制: `${Math.round(memory.jsHeapSizeLimit / 1048576)} MB`,
      总使用: `${Math.round(memory.totalJSHeapSize / 1048576)} MB`,
      使用率: `${Math.round(memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100)}%`
    });
  } else {
    console.log('当前浏览器不支持 performance.memory API');
  }
}

// 定期监控内存
function startMemoryMonitoring(interval = 5000) {
  const monitorId = setInterval(() => {
    checkMemoryUsage();
  }, interval);

  return () => clearInterval(monitorId);
}
```

#### 使用 Performance API 监控

```javascript
class MemoryMonitor {
  constructor(options = {}) {
    this.threshold = options.threshold || 0.8; // 80% 告警阈值
    this.interval = options.interval || 5000;
    this.callbacks = [];
    this.monitorId = null;
  }

  start() {
    if (!performance.memory) {
      console.warn('Memory API not supported');
      return;
    }

    this.monitorId = setInterval(() => {
      this.check();
    }, this.interval);
  }

  stop() {
    if (this.monitorId) {
      clearInterval(this.monitorId);
      this.monitorId = null;
    }
  }

  check() {
    const memory = performance.memory;
    const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

    if (usage > this.threshold) {
      this.notify({
        type: 'warning',
        usage,
        message: `内存使用率过高：${Math.round(usage * 100)}%`
      });
    }

    return {
      used: memory.usedJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      usage
    };
  }

  onWarning(callback) {
    this.callbacks.push(callback);
  }

  notify(data) {
    this.callbacks.forEach(cb => cb(data));
  }
}

// 使用示例
const monitor = new MemoryMonitor({
  threshold: 0.75,
  interval: 3000
});

monitor.onWarning((data) => {
  console.warn(data.message);
  // 可以触发垃圾回收提示或清理操作
});

monitor.start();
```

### 3.3 最佳实践示例

#### 1. 对象池模式

```javascript
/**
 * 对象池：重用对象，减少垃圾回收压力
 */
class ObjectPool {
  constructor(createFn, resetFn, maxSize = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
    this.available = [];
    this.inUse = new Set();
  }

  acquire() {
    let obj;
    
    if (this.available.length > 0) {
      obj = this.available.pop();
    } else {
      obj = this.createFn();
    }
    
    this.inUse.add(obj);
    return obj;
  }

  release(obj) {
    if (!this.inUse.has(obj)) {
      return;
    }
    
    this.inUse.delete(obj);
    this.resetFn(obj);
    
    if (this.available.length < this.maxSize) {
      this.available.push(obj);
    }
    // 超过最大池大小，让对象被垃圾回收
  }

  releaseAll() {
    this.inUse.forEach(obj => {
      this.resetFn(obj);
      if (this.available.length < this.maxSize) {
        this.available.push(obj);
      }
    });
    this.inUse.clear();
  }

  get stats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size
    };
  }
}

// 使用示例：DOM 元素池
const divPool = new ObjectPool(
  () => document.createElement('div'),
  (div) => {
    div.className = '';
    div.textContent = '';
    div.style.cssText = '';
    div.innerHTML = '';
  },
  50
);

function renderList(items) {
  const container = document.getElementById('list');
  container.innerHTML = '';
  
  items.forEach(item => {
    const div = divPool.acquire();
    div.textContent = item;
    div.className = 'list-item';
    container.appendChild(div);
  });
}

// 清理时归还对象池
function cleanupList() {
  const items = document.querySelectorAll('#list .list-item');
  items.forEach(div => {
    divPool.release(div);
  });
}
```

#### 2. 虚拟列表（Virtual Scrolling）

```javascript
/**
 * 虚拟列表：只渲染可见区域的 DOM 节点
 */
class VirtualList {
  constructor(options) {
    this.container = options.container;
    this.itemHeight = options.itemHeight || 50;
    this.overscan = options.overscan || 5;
    this.items = options.items || [];
    this.renderItem = options.renderItem;
    
    this.container.style.overflow = 'auto';
    this.container.style.position = 'relative';
    
    this.viewport = document.createElement('div');
    this.viewport.style.position = 'relative';
    this.container.appendChild(this.viewport);
    
    this.content = document.createElement('div');
    this.content.style.position = 'absolute';
    this.content.style.top = 0;
    this.content.style.left = 0;
    this.content.style.right = 0;
    this.viewport.appendChild(this.content);
    
    this.visibleItems = new Map();
    this.itemPool = [];
    
    this.init();
  }

  init() {
    this.updateContentHeight();
    this.container.addEventListener('scroll', this.handleScroll.bind(this));
    this.renderVisibleItems();
  }

  updateContentHeight() {
    this.content.style.height = `${this.items.length * this.itemHeight}px`;
  }

  handleScroll() {
    requestAnimationFrame(() => {
      this.renderVisibleItems();
    });
  }

  renderVisibleItems() {
    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;
    
    const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.overscan);
    const endIndex = Math.min(
      this.items.length,
      Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.overscan
    );
    
    // 移除不可见的项
    this.visibleItems.forEach((item, index) => {
      if (index < startIndex || index >= endIndex) {
        this.recycleItem(item);
        this.visibleItems.delete(index);
      }
    });
    
    // 添加可见的项
    for (let i = startIndex; i < endIndex; i++) {
      if (!this.visibleItems.has(i)) {
        const item = this.createItem(i);
        this.visibleItems.set(i, item);
      }
    }
  }

  createItem(index) {
    let item;
    
    if (this.itemPool.length > 0) {
      item = this.itemPool.pop();
    } else {
      item = document.createElement('div');
      item.style.position = 'absolute';
      item.style.left = 0;
      item.style.right = 0;
      item.style.height = `${this.itemHeight}px`;
    }
    
    item.style.top = `${index * this.itemHeight}px`;
    item.innerHTML = '';
    item.appendChild(this.renderItem(this.items[index], index));
    
    this.content.appendChild(item);
    return item;
  }

  recycleItem(item) {
    this.content.removeChild(item);
    this.itemPool.push(item);
  }

  setItems(items) {
    this.items = items;
    this.updateContentHeight();
    this.renderVisibleItems();
  }

  destroy() {
    this.container.removeEventListener('scroll', this.handleScroll);
    this.visibleItems.forEach(item => {
      this.content.removeChild(item);
    });
    this.visibleItems.clear();
    this.itemPool = [];
  }
}

// 使用示例
const virtualList = new VirtualList({
  container: document.getElementById('list-container'),
  itemHeight: 60,
  overscan: 10,
  items: Array.from({ length: 10000 }, (_, i) => `Item ${i}`),
  renderItem: (item, index) => {
    const div = document.createElement('div');
    div.textContent = item;
    div.style.padding = '10px';
    div.style.borderBottom = '1px solid #eee';
    return div;
  }
});
```

#### 3. 弱引用清理

```javascript
/**
 * 使用 WeakMap 和 WeakSet 自动管理引用
 */
class ResourceManager {
  constructor() {
    // WeakMap 会在键被垃圾回收时自动清理
    this.elementData = new WeakMap();
    this.componentState = new WeakMap();
    
    // WeakSet 用于跟踪对象是否存在
    this.activeComponents = new WeakSet();
  }

  // 为 DOM 元素关联数据
  associateData(element, data) {
    this.elementData.set(element, data);
  }

  getData(element) {
    return this.elementData.get(element);
  }

  // 注册组件
  registerComponent(component) {
    this.activeComponents.add(component);
    this.componentState.set(component, {
      createdAt: Date.now(),
      renderCount: 0
    });
  }

  // 更新组件状态
  updateComponent(component) {
    const state = this.componentState.get(component);
    if (state) {
      state.renderCount++;
    }
  }

  // 检查组件是否活跃
  isComponentActive(component) {
    return this.activeComponents.has(component);
  }

  // 清理组件（实际上不需要手动清理，WeakMap/WeakSet 会自动处理）
  unregisterComponent(component) {
    // 不需要手动删除，组件被垃圾回收时会自动清理
    // 这里只做逻辑标记
  }

  // 获取统计信息
  getStats() {
    // 注意：无法直接获取 WeakMap/WeakSet 的大小
    // 需要自己维护计数器
    return {
      message: 'WeakMap/WeakSet 无法直接获取大小，建议手动维护计数器'
    };
  }
}

// 使用示例
const resourceManager = new ResourceManager();

class MyComponent {
  constructor(element) {
    this.element = element;
    resourceManager.registerComponent(this);
    resourceManager.associateData(element, { component: this });
  }

  render() {
    resourceManager.updateComponent(this);
    // 渲染逻辑
  }

  destroy() {
    resourceManager.unregisterComponent(this);
    // 组件实例被置为 null 后，WeakMap/WeakSet 中的引用会自动清理
  }
}
```

#### 4. 请求取消与清理

```javascript
/**
 * 可取消的请求管理
 */
class RequestManager {
  constructor() {
    this.abortControllers = new Map();
  }

  async fetch(url, options = {}, requestId = url) {
    // 取消之前的同名请求
    this.cancel(requestId);

    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`请求已取消：${requestId}`);
      }
      throw error;
    } finally {
      this.abortControllers.delete(requestId);
    }
  }

  cancel(requestId) {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  cancelAll() {
    this.abortControllers.forEach((controller, requestId) => {
      controller.abort();
    });
    this.abortControllers.clear();
  }
}

// 使用示例
const requestManager = new RequestManager();

// 搜索场景
async function search(query) {
  try {
    const results = await requestManager.fetch(
      `/api/search?q=${encodeURIComponent(query)}`,
      {},
      `search-${query}`
    );
    displayResults(results);
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('搜索失败:', error);
    }
  }
}

// 组件卸载时取消所有请求
class SearchComponent {
  constructor() {
    this.input = document.getElementById('search-input');
    this.input.addEventListener('input', (e) => {
      search(e.target.value);
    });
  }

  destroy() {
    // 取消所有未完成的请求
    requestManager.cancelAll();
  }
}
```

#### 5. 图像和媒体资源清理

```javascript
/**
 * 图像资源管理器
 */
class ImageResourceManager {
  constructor() {
    this.loadedImages = new Map();
    this.observers = new Map();
  }

  // 预加载图像
  preload(src) {
    return new Promise((resolve, reject) => {
      if (this.loadedImages.has(src)) {
        resolve(this.loadedImages.get(src));
        return;
      }

      const img = new Image();
      img.onload = () => {
        this.loadedImages.set(src, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  // 使用图像
  use(src, element) {
    const img = this.loadedImages.get(src);
    if (img) {
      element.src = img.src;
    } else {
      this.preload(src).then(() => {
        element.src = src;
      });
    }
  }

  // 清理未使用的图像
  cleanup(keepRecent = 10) {
    const keys = Array.from(this.loadedImages.keys());
    if (keys.length > keepRecent) {
      // 保留最近的 keepRecent 个
      const toRemove = keys.slice(0, keys.length - keepRecent);
      toRemove.forEach(key => {
        const img = this.loadedImages.get(key);
        if (img) {
          img.src = ''; // 释放内存
          img.onload = null;
          img.onerror = null;
        }
        this.loadedImages.delete(key);
      });
    }
  }

  // 完全清理
  destroy() {
    this.loadedImages.forEach((img, src) => {
      img.src = '';
      img.onload = null;
      img.onerror = null;
    });
    this.loadedImages.clear();
    
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}

// 视频资源清理
class VideoResourceManager {
  constructor() {
    this.videos = new Set();
  }

  register(videoElement) {
    this.videos.add(videoElement);
    
    // 监听页面可见性，自动暂停不可见视频
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting && !videoElement.paused) {
          videoElement.pause();
        }
      });
    });
    
    observer.observe(videoElement);
    
    // 清理时
    videoElement.addEventListener('remove', () => {
      this.unregister(videoElement);
    });
  }

  unregister(videoElement) {
    videoElement.pause();
    videoElement.src = '';
    videoElement.load(); // 重置视频
    this.videos.delete(videoElement);
  }

  pauseAll() {
    this.videos.forEach(video => video.pause());
  }

  destroy() {
    this.pauseAll();
    this.videos.forEach(video => {
      video.src = '';
      video.load();
    });
    this.videos.clear();
  }
}
```

### 3.4 内存管理检查清单

```markdown
## 内存管理检查清单

### 开发阶段
- [ ] 所有变量都使用 var/let/const 声明
- [ ] 避免不必要的全局变量
- [ ] 定时器在组件销毁时清理
- [ ] 事件监听器在组件销毁时移除
- [ ] 闭包不持有不必要的大对象引用
- [ ] DOM 节点移除后清除引用
- [ ] 使用 WeakMap/WeakSet 管理对象关联
- [ ] 大数组/对象使用后及时清理
- [ ] 网络请求在组件卸载时取消
- [ ] 缓存设置大小限制和过期策略

### 测试阶段
- [ ] 使用 Chrome DevTools Memory 面板检测泄漏
- [ ] 拍摄堆快照对比操作前后的内存变化
- [ ] 检查 Detached DOM 节点
- [ ] 监控 performance.memory 指标
- [ ] 长时间运行测试（30 分钟以上）
- [ ] 重复执行相同操作，检查内存是否持续增长

### 生产环境
- [ ] 实现内存监控告警
- [ ] 设置合理的缓存淘汰策略
- [ ] 实现资源清理机制
- [ ] 提供手动清理接口（如"释放内存"按钮）
- [ ] 记录内存使用日志
```

---

## 总结

### 性能优化核心原则

1. **按需加载**：只在需要时加载资源（懒加载）
2. **减少执行**：限制高频函数的执行次数（防抖/节流）
3. **及时清理**：释放不再使用的资源（内存管理）

### 工具推荐

- **Chrome DevTools**: Performance、Memory、Lighthouse 面板
- **Lighthouse**: 自动化性能审计
- **Webpack Bundle Analyzer**: 分析打包体积
- **Performance API**: 编程方式监控性能

### 持续优化

性能优化是一个持续的过程，建议：
- 定期使用 Lighthouse 审计
- 监控真实用户的性能指标（RUM）
- 建立性能预算和 CI 检查
- 持续学习和应用新的优化技术

---

*文档创建时间：2026-04-23*
*适用于：Web 前端性能优化学习与参考*
