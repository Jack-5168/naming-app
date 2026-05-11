# Web 性能优化专项训练

**日期:** 2026 年 4 月 24 日  
**时间:** 05:00  
**主题:** 性能优化核心技术

---

## 一、懒加载 (Lazy Loading)

### 1.1 图片懒加载

```html
<!-- 方案 1: 原生 loading="lazy" (最简单) -->
<img src="placeholder.jpg" data-src="large-image.jpg" loading="lazy" alt="描述">

<!-- 方案 2: Intersection Observer API (更灵活控制) -->
<script>
class LazyImage {
  constructor() {
    this.images = document.querySelectorAll('img[data-src]');
    this.init();
  }
  
  init() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(this.observe.bind(this), {
        rootMargin: '50px 0px', // 提前 50px 开始加载
        threshold: 0.01
      });
      this.images.forEach(img => this.observer.observe(img));
    } else {
      // 降级方案：直接加载所有图片
      this.images.forEach(img => this.loadImage(img));
    }
  }
  
  observe(entries) {
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
    img.onload = () => img.classList.add('loaded');
    img.onerror = () => img.classList.add('error');
    img.src = src;
  }
}

// 使用
new LazyImage();
</script>
```

### 1.2 组件懒加载 (React)

```jsx
// 方案 1: React.lazy + Suspense
import { lazy, Suspense, useState } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));
const ChartModule = lazy(() => import('./ChartModule'));

function Dashboard() {
  const [showChart, setShowChart] = useState(false);
  
  return (
    <div>
      <Suspense fallback={<div>加载中...</div>}>
        <HeavyComponent />
      </Suspense>
      
      <button onClick={() => setShowChart(true)}>
        显示图表
      </button>
      
      {showChart && (
        <Suspense fallback={<div>图表加载中...</div>}>
          <ChartModule />
        </Suspense>
      )}
    </div>
  );
}

// 方案 2: 自定义 Hook 实现按需加载
function useLazyComponent(importFunc) {
  const [Component, setComponent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let mounted = true;
    
    importFunc()
      .then(module => {
        if (mounted) setComponent(() => module.default);
      })
      .catch(err => {
        if (mounted) setError(err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    
    return () => { mounted = false; };
  }, [importFunc]);
  
  return { Component, loading, error };
}

// 使用
function Page() {
  const { Component: Analytics, loading } = useLazyComponent(
    () => import('./Analytics')
  );
  
  if (loading) return <Spinner />;
  if (error) return <ErrorFallback />;
  
  return <Analytics />;
}
```

### 1.3 路由懒加载

```javascript
// Vue Router
const routes = [
  {
    path: '/dashboard',
    component: () => import(/* webpackChunkName: "dashboard" */ '@/views/Dashboard.vue')
  },
  {
    path: '/settings',
    component: () => import(/* webpackChunkName: "settings" */ '@/views/Settings.vue')
  }
];

// React Router
const App = () => (
  <Routes>
    <Route 
      path="/dashboard" 
      element={
        <Suspense fallback={<PageLoader />}>
          <Dashboard />
        </Suspense>
      } 
    />
  </Routes>
);
```

---

## 二、防抖与节流 (Debounce & Throttle)

### 2.1 防抖 (Debounce) - 等待操作完成后再执行

```javascript
// 基础版
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 增强版 - 支持立即执行和取消
function debounce(fn, delay, immediate = false) {
  let timer = null;
  
  const debounced = function(...args) {
    const later = () => {
      timer = null;
      if (!immediate) fn.apply(this, args);
    };
    
    const callNow = immediate && !timer;
    clearTimeout(timer);
    timer = setTimeout(later, delay);
    
    if (callNow) fn.apply(this, args);
  };
  
  debounced.cancel = function() {
    clearTimeout(timer);
    timer = null;
  };
  
  return debounced;
}

// 使用场景：搜索框
const searchInput = document.querySelector('#search');
const handleSearch = debounce((query) => {
  fetchResults(query);
}, 300);

searchInput.addEventListener('input', (e) => {
  handleSearch(e.target.value);
});

// React Hook 版本
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// 使用
function SearchComponent() {
  const [inputValue, setInputValue] = useState('');
  const debouncedValue = useDebounce(inputValue, 300);
  
  useEffect(() => {
    if (debouncedValue) {
      searchAPI(debouncedValue);
    }
  }, [debouncedValue]);
  
  return (
    <input 
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
    />
  );
}
```

### 2.2 节流 (Throttle) - 限制执行频率

```javascript
// 时间戳版本
function throttle(fn, wait) {
  let previous = 0;
  return function(...args) {
    const now = Date.now();
    if (now - previous > wait) {
      fn.apply(this, args);
      previous = now;
    }
  };
}

// 定时器版本
function throttle(fn, wait) {
  let timer = null;
  return function(...args) {
    if (!timer) {
      timer = setTimeout(() => {
        fn.apply(this, args);
        timer = null;
      }, wait);
    }
  };
}

// 增强版 - 支持首尾执行
function throttle(fn, wait, options = {}) {
  let timer = null;
  let previous = 0;
  const { leading = true, trailing = true } = options;
  
  const throttled = function(...args) {
    const now = Date.now();
    
    if (!previous && !leading) previous = now;
    
    const remaining = wait - (now - previous);
    
    if (remaining <= 0 || remaining > wait) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      previous = now;
      fn.apply(this, args);
    } else if (!timer && trailing) {
      timer = setTimeout(() => {
        previous = leading ? Date.now() : 0;
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
  
  throttled.cancel = function() {
    clearTimeout(timer);
    timer = null;
    previous = 0;
  };
  
  return throttled;
}

// 使用场景：滚动监听
const handleScroll = throttle(() => {
  const scrollTop = window.scrollY;
  updateProgressBar(scrollTop);
  loadMoreContent(scrollTop);
}, 100);

window.addEventListener('scroll', handleScroll);

// React Hook 版本
function useThrottle(callback, delay) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef(null);
  const lastExecRef = useRef(0);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return useCallback((...args) => {
    const now = Date.now();
    
    if (now - lastExecRef.current >= delay) {
      callbackRef.current(...args);
      lastExecRef.current = now;
    } else {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
        lastExecRef.current = Date.now();
      }, delay - (now - lastExecRef.current));
    }
  }, [delay]);
}
```

### 2.3 实战对比

```javascript
// 场景：窗口 resize 事件
window.addEventListener('resize', debounce(() => {
  // 等用户停止调整窗口后再执行
  recalculateLayout();
}, 250));

// 场景：鼠标移动追踪
document.addEventListener('mousemove', throttle((e) => {
  // 限制更新频率，避免过度渲染
  updateCursorPosition(e.clientX, e.clientY);
}, 50));

// 场景：表单验证
input.addEventListener('input', debounce((e) => {
  // 用户输入完成后验证
  validateField(e.target.value);
}, 500));

// 场景：按钮点击防止重复提交
button.addEventListener('click', throttle((e) => {
  // 1 秒内只允许点击一次
  submitForm();
}, 1000, { leading: true, trailing: false }));
```

---

## 三、内存管理 (Memory Management)

### 3.1 常见内存泄漏场景

```javascript
// ❌ 泄漏 1: 未清理的定时器
function startTimer() {
  setInterval(() => {
    updateData();
  }, 1000);
}
// 组件卸载后定时器仍在运行

// ✅ 修复
let timerId = null;
function startTimer() {
  timerId = setInterval(() => {
    updateData();
  }, 1000);
}
function cleanup() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

// ❌ 泄漏 2: 未移除的事件监听器
element.addEventListener('click', handler);
// 元素移除后监听器仍在

// ✅ 修复
function init() {
  element.addEventListener('click', handler);
}
function destroy() {
  element.removeEventListener('click', handler);
}

// ❌ 泄漏 3: 闭包引用大对象
function createHandler() {
  const largeData = new Array(1000000).fill('data');
  return function() {
    console.log('clicked'); // 实际不需要 largeData，但被闭包引用
  };
}

// ✅ 修复
function createHandler() {
  return function() {
    console.log('clicked');
  };
}

// ❌ 泄漏 4: DOM 引用
let elements = [];
function storeElements() {
  elements.push(document.querySelector('.temp'));
  // 即使从 DOM 移除，数组仍持有引用
}

// ✅ 修复
function storeElements() {
  const el = document.querySelector('.temp');
  // 只存储需要的数据，不存储 DOM 引用
  const data = el.textContent;
  elements.push(data);
}
```

### 3.2 React 内存管理最佳实践

```jsx
// ✅ 正确清理副作用
function Component({ userId }) {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    
    fetchData(userId, { signal: controller.signal })
      .then(result => {
        if (!cancelled) setData(result);
      });
    
    // 清理函数
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [userId]);
  
  return <div>{data}</div>;
}

// ✅ 使用 WeakMap 缓存
const cache = new WeakMap();

function processData(obj) {
  if (cache.has(obj)) {
    return cache.get(obj);
  }
  const result = heavyComputation(obj);
  cache.set(obj, result);
  return result;
}
// 当 obj 被垃圾回收时，WeakMap 中的条目也会自动清理

// ✅ 虚拟列表 - 只渲染可见项
function VirtualList({ items, itemHeight, containerHeight }) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const visibleItems = items.slice(visibleStart, visibleStart + visibleCount);
  
  return (
    <div 
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={e => setScrollTop(e.target.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => (
          <div 
            key={item.id}
            style={{
              position: 'absolute',
              top: (visibleStart + index) * itemHeight,
              height: itemHeight
            }}
          >
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3.3 性能监控

```javascript
// 内存使用监控
function monitorMemory() {
  if (performance.memory) {
    const { usedJSHeapSize, totalJSHeapSize } = performance.memory;
    const usagePercent = (usedJSHeapSize / totalJSHeapSize) * 100;
    
    console.log(`内存使用：${usagePercent.toFixed(2)}%`);
    
    if (usagePercent > 80) {
      console.warn('内存使用率过高！');
    }
  }
}

// 性能指标监控
function observePerformance() {
  // LCP - 最大内容绘制
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    console.log('LCP:', lastEntry.startTime);
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  
  // FID - 首次输入延迟
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    console.log('FID:', entries[0].processingStart - entries[0].startTime);
  }).observe({ type: 'first-input', buffered: true });
  
  // CLS - 累积布局偏移
  let clsValue = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    }
    console.log('CLS:', clsValue);
  }).observe({ type: 'layout-shift', buffered: true });
}
```

---

## 四、综合优化示例

### 4.1 优化前的代码

```javascript
// ❌ 性能问题代码
class ProductList {
  constructor() {
    this.products = [];
    this.init();
  }
  
  init() {
    // 问题 1: 一次性加载所有数据
    this.loadAllProducts();
    
    // 问题 2: 滚动监听没有节流
    window.addEventListener('scroll', this.onScroll.bind(this));
    
    // 问题 3: 搜索没有防抖
    document.querySelector('#search')
      .addEventListener('input', this.onSearch.bind(this));
    
    // 问题 4: 图片没有懒加载
    this.renderProducts();
  }
  
  loadAllProducts() {
    // 加载 10000 条数据
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        this.products = data; // 10000 条
        this.renderProducts();
      });
  }
  
  onScroll() {
    // 每次滚动都触发
    this.checkLoadMore();
    this.updateStickyHeader();
    this.trackScrollDepth();
  }
  
  onSearch(e) {
    // 每次输入都搜索
    const query = e.target.value;
    this.searchProducts(query);
  }
  
  renderProducts() {
    const container = document.querySelector('#product-list');
    // 一次性渲染所有产品
    container.innerHTML = this.products.map(p => `
      <div class="product">
        <img src="${p.image}" alt="${p.name}">
        <h3>${p.name}</h3>
        <p>${p.price}</p>
      </div>
    `).join('');
  }
}
```

### 4.2 优化后的代码

```javascript
// ✅ 优化后代码
class ProductList {
  constructor() {
    this.products = [];
    this.visibleProducts = [];
    this.pageSize = 20;
    this.currentPage = 0;
    this.observer = null;
    this.searchTimer = null;
    this.scrollHandler = null;
    this.init();
  }
  
  init() {
    // 优化 1: 分页加载
    this.loadPage();
    
    // 优化 2: 节流滚动监听
    this.scrollHandler = this.throttle(this.onScroll.bind(this), 100);
    window.addEventListener('scroll', this.scrollHandler);
    
    // 优化 3: 防抖搜索
    document.querySelector('#search')
      .addEventListener('input', this.debounceSearch.bind(this));
    
    // 优化 4: 图片懒加载
    this.initImageLazyLoad();
    
    // 优化 5: 虚拟滚动
    this.initVirtualScroll();
  }
  
  async loadPage() {
    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;
    
    const response = await fetch(`/api/products?limit=${this.pageSize}&offset=${start}`);
    const data = await response.json();
    
    this.products.push(...data);
    this.renderVisibleProducts();
    this.currentPage++;
  }
  
  onScroll() {
    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    // 接近底部时加载下一页
    if (scrollTop + windowHeight >= documentHeight - 500) {
      this.loadMore();
    }
    
    // 更新进度指示器（节流已处理）
    this.updateScrollIndicator();
  }
  
  debounceSearch(e) {
    const query = e.target.value;
    
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchProducts(query);
    }, 300);
  }
  
  initImageLazyLoad() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          this.observer.unobserve(img);
        }
      });
    }, { rootMargin: '100px' });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
      this.observer.observe(img);
    });
  }
  
  renderVisibleProducts() {
    const container = document.querySelector('#product-list');
    const visible = this.products.slice(0, this.pageSize);
    
    container.innerHTML = visible.map(p => `
      <div class="product">
        <img data-src="${p.image}" alt="${p.name}" loading="lazy">
        <h3>${p.name}</h3>
        <p>${p.price}</p>
      </div>
    `).join('');
  }
  
  // 工具方法
  throttle(fn, wait) {
    let timer = null;
    return function(...args) {
      if (!timer) {
        timer = setTimeout(() => {
          fn.apply(this, args);
          timer = null;
        }, wait);
      }
    };
  }
  
  // 清理资源
  destroy() {
    window.removeEventListener('scroll', this.scrollHandler);
    if (this.observer) this.observer.disconnect();
    clearTimeout(this.searchTimer);
    this.products = null;
    this.visibleProducts = null;
  }
}
```

---

## 五、性能优化检查清单

### 加载优化
- [ ] 启用图片懒加载 (`loading="lazy"`)
- [ ] 使用 WebP/AVIF 格式
- [ ] 实现代码分割 (Code Splitting)
- [ ] 路由级别懒加载
- [ ] 预加载关键资源 (`<link rel="preload">`)
- [ ] 使用 CDN 加速静态资源

### 交互优化
- [ ] 搜索框添加防抖 (300ms)
- [ ] 滚动事件添加节流 (100ms)
- [ ] 按钮点击防止重复提交
- [ ] 表单验证延迟执行

### 内存优化
- [ ] 清理定时器 (`clearInterval`/`clearTimeout`)
- [ ] 移除事件监听器 (`removeEventListener`)
- [ ] 避免闭包持有大对象
- [ ] 使用 `WeakMap`/`WeakSet` 缓存
- [ ] 虚拟列表渲染长列表
- [ ] 及时释放 DOM 引用

### 监控指标
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1
- [ ] 内存使用率 < 80%

---

## 六、实战练习

### 练习 1: 实现图片懒加载组件
```javascript
// 任务：创建一个支持占位图、加载失败处理的懒加载组件
```

### 练习 2: 实现搜索防抖
```javascript
// 任务：为搜索框添加 300ms 防抖，支持取消功能
```

### 练习 3: 内存泄漏排查
```javascript
// 任务：使用 Chrome DevTools Memory 面板找出并修复内存泄漏
```

---

**训练完成时间:** 2026-04-24 05:00  
**下次训练:** 回顾并实践上述技术
