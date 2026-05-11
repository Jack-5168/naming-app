# 专项训练 05:00 — Web 性能优化

> 主题：懒加载 / 防抖节流 / 内存管理  
> 时间：2026-05-10 05:00

---

## 一、懒加载（Lazy Loading）

### 1.1 核心思想

延迟加载非关键资源，直到真正需要时才加载。减少首屏体积，提升 FCP/LCP。

### 1.2 图片懒加载

```js
// === 方案 A：IntersectionObserver（现代推荐）===
function lazyLoadImages() {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        // data-src 存放真实 URL，src 放占位图
        img.src = img.dataset.src;
        img.classList.add('loaded');
        observer.unobserve(img); // 加载后停止观察
      }
    });
  }, {
    rootMargin: '50px 0px', // 提前 50px 开始加载
    threshold: 0.01
  });

  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}

// === 方案 B：原生 loading="lazy"（最简单，但兼容性有限）===
// <img src="real.jpg" loading="lazy" alt="...">

// === 方案 C：带骨架屏 + 渐进式加载 ===
function lazyLoadWithSkeleton(container) {
  const imageObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const wrapper = entry.target;
        const img = document.createElement('img');
        img.className = 'fade-in';
        img.onload = () => {
          wrapper.classList.remove('skeleton');
          wrapper.appendChild(img);
        };
        img.src = wrapper.dataset.src;
        obs.unobserve(wrapper);
      }
    });
  }, { rootMargin: '200px' });

  container.querySelectorAll('.img-placeholder').forEach(el => {
    imageObserver.observe(el);
  });
}
```

```css
/* 骨架屏样式 */
.img-placeholder.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

img.fade-in {
  opacity: 0;
  transition: opacity 0.3s ease;
}
img.loaded, img.fade-in[src] {
  opacity: 1;
}
```

### 1.3 组件/路由懒加载

```js
// === Vue 3 路由懒加载 ===
const routes = [
  {
    path: '/dashboard',
    // 动态 import → 自动拆分为独立 chunk
    component: () => import('../views/Dashboard.vue')
  },
  {
    path: '/settings',
    // 魔法注释：强制合并到同一个 chunk
    component: () => import(/* webpackChunkName: "admin" */ '../views/Settings.vue')
  }
];

// === React 懒加载 ===
import { lazy, Suspense } from 'react';

const HeavyChart = lazy(() => import('./HeavyChart'));

function App() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <HeavyChart />
    </Suspense>
  );
}

// === 手动实现组件懒加载（IntersectionObserver + React）===
function LazyComponent({ loader, fallback, ...props }) {
  const [Component, setComponent] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        loader().then(mod => setComponent(() => mod.default));
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loader]);

  return (
    <div ref={ref}>
      {Component ? <Component {...props} /> : (fallback || null)}
    </div>
  );
}
```

### 1.4 关键性能指标

| 指标 | 说明 | 懒加载收益 |
|------|------|-----------|
| FCP (First Contentful Paint) | 首屏内容渲染时间 | ⬇️ 减少初始 HTML 体积 |
| LCP (Largest Contentful Paint) | 最大内容元素渲染 | ⬇️ 非首屏图片延迟加载 |
| TTI (Time to Interactive) | 可交互时间 | ⬇️ JS chunk 按需加载 |
| TBT (Total Blocking Time) | 总阻塞时间 | ⬇️ 减少主线程工作量 |

---

## 二、防抖（Debounce）与节流（Throttle）

### 2.1 核心区别

```
防抖 Debounce：等！你停了我才执行。
  → 适用：搜索输入、窗口 resize、表单校验

节流 Throttle：排队！每隔一段时间执行一次。
  → 适用：滚动加载、鼠标移动追踪、按钮防重复点击
```

### 2.2 防抖 — 完整实现

```js
// === 基础防抖 ===
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

// === 增强防抖（支持 leading/trailing）===
function debounceAdvanced(fn, delay, options = {}) {
  const { leading = false, trailing = true, maxWait = 0 } = options;
  let timer = null;
  let leadingCalled = false;
  let maxTimer = null;

  const debounced = function (...args) {
    const context = this;

    // leading 执行：第一次调用立即执行
    if (leading && !leadingCalled) {
      fn.apply(context, args);
      leadingCalled = true;
    }

    // 清除之前的定时器
    if (timer) clearTimeout(timer);
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = null;
    }

    // maxWait：超过最大等待时间必须执行
    if (maxWait > 0 && !leadingCalled) {
      maxTimer = setTimeout(() => {
        if (!leadingCalled) {
          fn.apply(context, args);
          leadingCalled = true;
        }
        maxTimer = null;
      }, maxWait);
    }

    // trailing 执行：延迟后执行
    if (trailing) {
      timer = setTimeout(() => {
        if (!leading) {
          fn.apply(context, args);
        }
        leadingCalled = false;
        timer = null;
      }, delay);
    }
  };

  // 取消功能
  debounced.cancel = function () {
    if (timer) clearTimeout(timer);
    if (maxTimer) clearTimeout(maxTimer);
    timer = null;
    maxTimer = null;
    leadingCalled = false;
  };

  // 立即执行
  debounced.flush = function () {
    if (timer) {
      clearTimeout(timer);
      fn.apply(this, arguments);
      timer = null;
    }
  };

  return debounced;
}

// === 使用示例 ===
const searchInput = document.getElementById('search');
const handleSearch = debounceAdvanced(
  (query) => {
    console.log('搜索:', query);
    fetch(`/api/search?q=${encodeURIComponent(query)}`);
  },
  300,
  { leading: false, trailing: true, maxWait: 1000 }
);

searchInput.addEventListener('input', (e) => {
  handleSearch(e.target.value);
});

// 需要时取消
// handleSearch.cancel();
```

### 2.3 节流 — 完整实现

```js
// === 方案 A：时间戳版 ===
function throttle(fn, interval = 300) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      fn.apply(this, args);
      lastTime = now;
    }
  };
}

// === 方案 B：定时器版（最后一次操作一定会执行）===
function throttleTimer(fn, interval = 300) {
  let timer = null;
  return function (...args) {
    if (!timer) {
      timer = setTimeout(() => {
        fn.apply(this, args);
        timer = null;
      }, interval);
    }
  };
}

// === 方案 C：综合版（leading + trailing，类似 lodash）===
function throttleAdvanced(fn, interval, options = {}) {
  const { leading = true, trailing = true } = options;
  let lastTime = 0;
  let timer = null;

  const throttled = function (...args) {
    const now = Date.now();
    const remaining = interval - (now - lastTime);

    // 首次调用且不需要 leading → 更新时间戳
    if (lastTime === 0 && !leading) {
      lastTime = now;
    }

    if (remaining <= 0 || remaining > interval) {
      // 可以执行了
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      fn.apply(this, args);
      lastTime = now;
    } else if (trailing && !timer) {
      // 等待 trailing 执行
      timer = setTimeout(() => {
        fn.apply(this, args);
        lastTime = leading ? Date.now() : 0;
        timer = null;
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastTime = 0;
  };

  return throttled;
}

// === 使用示例 ===
// 滚动加载
const handleScroll = throttleAdvanced(() => {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight;
  if (scrollTop + window.innerHeight >= docHeight - 200) {
    loadMoreItems();
  }
}, 100, { leading: true, trailing: true });

window.addEventListener('scroll', handleScroll);

// 按钮防重复点击
const submitBtn = document.getElementById('submit');
const handleSubmit = throttle(() => {
  console.log('提交表单');
  submitBtn.disabled = true;
  setTimeout(() => submitBtn.disabled = false, 2000);
}, 1000);

submitBtn.addEventListener('click', handleSubmit);
```

### 2.4 选择指南

```
输入框搜索       → debounce (用户停下来了才发请求)
窗口 resize      → debounce (等用户调完尺寸再计算)
滚动加载         → throttle (定期触发，保证体验)
按钮防重复       → throttle (固定间隔内只允许一次)
鼠标轨迹追踪     → throttle (控制采样频率)
表单实时校验     → debounce (输入停止后校验)
```

---

## 三、内存管理

### 3.1 JavaScript 内存生命周期

```
1. 分配内存：声明变量、对象、函数
2. 使用内存：读写操作
3. 释放内存：GC 回收不可达对象
```

### 3.2 常见内存泄漏模式与修复

```js
// === 泄漏 1：意外全局变量 ===
function badCreateUser(name) {
  // 漏了 var/let/const → 变成全局变量
  // name = name;  // ❌ 泄漏
}

function goodCreateUser(name) {
  const userName = name;  // ✅ 块级作用域
}

// === 泄漏 2：未清理的事件监听器 ===
class EventLeak {
  constructor(element) {
    this.element = element;
    // ❌ 组件销毁后监听器仍然存在
    this.element.addEventListener('click', this.handleClick);
  }
}

class EventNoLeak {
  constructor(element) {
    this.element = element;
    this.handleClick = this.handleClick.bind(this);
    this.element.addEventListener('click', this.handleClick);
  }

  // ✅ 提供清理方法
  destroy() {
    this.element.removeEventListener('click', this.handleClick);
    this.element = null;
  }
}

// === 泄漏 3：未清理的定时器 ===
class TimerLeak {
  constructor() {
    // ❌ 组件销毁后定时器仍在运行
    this.timer = setInterval(() => {
      console.log('tick');
    }, 1000);
  }
}

class TimerNoLeak {
  constructor() {
    this.timer = setInterval(() => {
      if (this.isDestroyed) return; // 防御性检查
      console.log('tick');
    }, 1000);
  }

  destroy() {
    clearInterval(this.timer);
    this.timer = null;
    this.isDestroyed = true;
  }
}

// === 泄漏 4：闭包持有大对象 ===
function processData() {
  const largeData = new Array(1000000).fill('x'); // 大数组

  return function () {
    // ❌ 闭包持有了 largeData，即使后续不需要
    return 'result';
  };
}

function processDataFixed() {
  const largeData = new Array(1000000).fill('x');
  const result = largeData.map(item => item.toUpperCase());

  // ✅ 处理完立即释放
  largeData.length = 0;

  return function () {
    return result; // 只持有需要的结果
  };
}

// === 泄漏 5：DOM 引用残留 ===
const leakedElements = [];

function badCollectElements() {
  // ❌ 即使 DOM 被移除，数组仍持有引用
  document.querySelectorAll('.item').forEach(el => {
    leakedElements.push(el);
  });
}

function goodCollectElements() {
  // ✅ 只存储需要的数据，不存储 DOM 引用
  const items = [];
  document.querySelectorAll('.item').forEach(el => {
    items.push({
      id: el.dataset.id,
      text: el.textContent
    });
  });
  return items;
}

// === 泄漏 6：Map/Cache 无限增长 ===
class UnboundedCache {
  constructor() {
    this.cache = new Map(); // ❌ 永远不清理
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    this.cache.set(key, value);
  }
}

// ✅ 方案 A：LRU Cache
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map(); // Map 保持插入顺序
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    // 访问过的移到末尾（最新）
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的（Map 迭代第一个）
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

// ✅ 方案 B：WeakMap（自动 GC）
class WeakCache {
  constructor() {
    // WeakMap 的 key 必须是对象，且是弱引用
    // 当 key 对象没有其他引用时，自动被 GC 回收
    this.cache = new WeakMap();
  }

  get(obj) {
    return this.cache.get(obj);
  }

  set(obj, value) {
    this.cache.set(obj, value);
  }
}

// === 泄漏 7：MessageChannel / Worker 未关闭 ===
class WorkerLeak {
  constructor() {
    this.worker = new Worker('heavy-worker.js');
    // ❌ 页面关闭后 Worker 仍在运行
  }
}

class WorkerNoLeak {
  constructor() {
    this.worker = new Worker('heavy-worker.js');
    // ✅ 页面卸载时关闭 Worker
    window.addEventListener('beforeunload', () => this.destroy());
  }

  destroy() {
    this.worker.terminate();
    this.worker = null;
  }
}
```

### 3.3 内存管理最佳实践

```js
// === 1. 使用 WeakRef 管理缓存（ES2021）===
class WeakRefCache {
  constructor() {
    this.cache = new Map();
  }

  set(key, value) {
    // WeakRef 不阻止 GC，对象无其他引用时会被回收
    this.cache.set(key, new WeakRef(value));
  }

  get(key) {
    const ref = this.cache.get(key);
    return ref ? ref.deref() : undefined; // deref() 返回对象或 undefined
  }

  // 定期清理已回收的条目
  cleanup() {
    for (const [key, ref] of this.cache) {
      if (!ref.deref()) {
        this.cache.delete(key);
      }
    }
  }
}

// === 2. 分片处理大数据（避免一次性加载）===
function processLargeArray(data, chunkSize = 1000) {
  return new Promise((resolve) => {
    const results = [];
    let index = 0;

    function processChunk() {
      const end = Math.min(index + chunkSize, data.length);

      for (let i = index; i < end; i++) {
        results.push(transform(data[i]));
      }

      index = end;

      if (index < data.length) {
        // ✅ 让出主线程，避免长时间阻塞
        requestAnimationFrame(processChunk);
      } else {
        resolve(results);
      }
    }

    processChunk();
  });
}

function transform(item) {
  return { ...item, processed: true };
}

// === 3. 对象池模式（减少 GC 压力）===
class ObjectPool {
  constructor(factory, resetFn, initialSize = 10) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.pool = [];

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire() {
    return this.pool.length > 0
      ? this.pool.pop()
      : this.factory();
  }

  release(obj) {
    this.resetFn(obj);
    this.pool.push(obj);
  }
}

// 使用示例：粒子系统
const particlePool = new ObjectPool(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0 }),
  (p) => { p.x = p.y = p.vx = p.vy = p.life = 0; }
);

function spawnParticle() {
  const p = particlePool.acquire();
  p.x = Math.random() * 100;
  p.y = Math.random() * 100;
  return p;
}

function killParticle(p) {
  particlePool.release(p);
}

// === 4. 虚拟列表（只渲染可见区域）===
class VirtualList {
  constructor(container, options) {
    this.container = container;
    this.itemHeight = options.itemHeight;
    this.data = options.data;
    this.visibleCount = Math.ceil(container.clientHeight / options.itemHeight);
    this.startIndex = 0;

    this.contentEl = document.createElement('div');
    this.contentEl.style.position = 'relative';
    container.style.overflow = 'auto';
    container.innerHTML = '';
    container.appendChild(this.contentEl);

    this.updateTotalHeight();
    container.addEventListener('scroll', this.onScroll.bind(this));
  }

  updateTotalHeight() {
    this.contentEl.style.height = `${this.data.length * this.itemHeight}px`;
  }

  onScroll() {
    const scrollTop = this.container.scrollTop;
    this.startIndex = Math.floor(scrollTop / this.itemHeight);
    this.render();
  }

  render() {
    const end = Math.min(
      this.startIndex + this.visibleCount + 1,
      this.data.length
    );

    this.contentEl.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (let i = this.startIndex; i < end; i++) {
      const item = document.createElement('div');
      item.style.position = 'absolute';
      item.style.top = `${i * this.itemHeight}px`;
      item.style.height = `${this.itemHeight}px`;
      item.textContent = this.data[i];
      fragment.appendChild(item);
    }

    this.contentEl.appendChild(fragment);
  }

  destroy() {
    this.container.removeEventListener('scroll', this.onScroll);
    this.container.innerHTML = '';
    this.data = null;
    this.container = null;
  }
}
```

### 3.4 内存诊断工具

```js
// === Chrome DevTools 内存面板 ===
// 1. Performance Monitor: 实时 JS Heap 大小、DOM 节点数、监听器数
// 2. Memory Snapshot: 对比两次快照找泄漏
// 3. Allocation Timeline: 记录分配时间线
// 4. Performance 面板: 查看 GC 频率和停顿

// === 代码级检测 ===
// 检查监听器数量
console.log('Event listeners:', getEventListeners(document));

// 检查 DOM 节点数
console.log('DOM nodes:', document.querySelectorAll('*').length);

// 检查缓存大小
if (performance.memory) {
  console.log('JS Heap:', {
    used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
    total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
    limit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + 'MB'
  });
}
```

---

## 四、综合优化示例：高性能列表页面

```js
/**
 * 高性能列表组件
 * 整合：懒加载 + 节流滚动 + 虚拟列表 + 对象池 + 内存管理
 */
class PerformanceList {
  constructor(container, options = {}) {
    this.container = container;
    this.pageSize = options.pageSize || 50;
    this.itemHeight = options.itemHeight || 60;
    this.bufferSize = options.bufferSize || 5;
    this.data = [];
    this.currentPage = 0;
    this.loading = false;
    this.destroyed = false;

    // 虚拟列表计算
    this.visibleCount = Math.ceil(container.clientHeight / this.itemHeight);
    this.startIndex = 0;
    this.endIndex = 0;

    // DOM 引用（组件销毁时清理）
    this.scrollEl = null;
    this.contentEl = null;
    this.placeholderEl = null;

    this._init();
  }

  _init() {
    // 创建 DOM 结构
    this.scrollEl = document.createElement('div');
    this.scrollEl.style.cssText = 'height:100%;overflow:auto;position:relative;';

    this.contentEl = document.createElement('div');
    this.contentEl.style.position = 'relative';

    this.scrollEl.appendChild(this.contentEl);
    this.container.appendChild(this.scrollEl);

    // 节流滚动（16ms ≈ 60fps）
    this._onScroll = this._throttle(this._handleScroll.bind(this), 16);
    this.scrollEl.addEventListener('scroll', this._onScroll);

    // IntersectionObserver 懒加载图片
    this._imageObserver = new IntersectionObserver(
      this._lazyLoadImages.bind(this),
      { rootMargin: '200px' }
    );

    // 初始加载
    this.loadMore();
  }

  async loadMore() {
    if (this.loading || this.destroyed) return;
    this.loading = true;

    try {
      const response = await fetch(`/api/items?page=${this.currentPage}&size=${this.pageSize}`);
      const items = await response.json();

      if (items.length === 0) {
        this._showEmpty();
        return;
      }

      // 追加数据
      const oldLength = this.data.length;
      this.data.push(...items);
      this._updateContentHeight();
      this._renderItems(oldLength);
      this.currentPage++;

      // 观察新图片
      this._observeNewImages();
    } catch (err) {
      this._showError(err.message);
    } finally {
      this.loading = false;
    }
  }

  _handleScroll() {
    if (this.destroyed) return;

    const scrollTop = this.scrollEl.scrollTop;
    this.startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
    this.endIndex = Math.min(
      this.data.length,
      Math.ceil((scrollTop + this.container.clientHeight) / this.itemHeight) + this.bufferSize
    );

    this._renderVisibleItems();

    // 触底加载
    const scrollBottom = scrollTop + this.container.clientHeight;
    const totalHeight = this.data.length * this.itemHeight;
    if (scrollBottom >= totalHeight - this.container.clientHeight * 2) {
      this.loadMore();
    }
  }

  _renderVisibleItems() {
    const fragment = document.createDocumentFragment();
    const offsetTop = this.startIndex * this.itemHeight;

    this.contentEl.style.transform = `translateY(${offsetTop}px)`;

    for (let i = this.startIndex; i < this.endIndex; i++) {
      const item = this._createItemElement(this.data[i], i);
      fragment.appendChild(item);
    }

    this.contentEl.innerHTML = '';
    this.contentEl.appendChild(fragment);
  }

  _createItemElement(item, index) {
    const el = document.createElement('div');
    el.style.cssText = `
      height: ${this.itemHeight}px;
      display: flex;
      align-items: center;
      padding: 0 16px;
      border-bottom: 1px solid #eee;
    `;

    if (item.thumbnail) {
      el.innerHTML = `
        <img data-src="${item.thumbnail}" alt="${item.title}"
             style="width:40px;height:40px;border-radius:4px;margin-right:12px;" />
        <span>${item.title}</span>
      `;
    } else {
      el.innerHTML = `<span>${item.title}</span>`;
    }

    return el;
  }

  _lazyLoadImages(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        this._imageObserver.unobserve(img);
      }
    });
  }

  _observeNewImages() {
    const images = this.contentEl.querySelectorAll('img[data-src]');
    images.forEach(img => this._imageObserver.observe(img));
  }

  _updateContentHeight() {
    this.contentEl.style.height = `${this.data.length * this.itemHeight}px`;
  }

  _throttle(fn, delay) {
    let lastTime = 0;
    return (...args) => {
      const now = Date.now();
      if (now - lastTime >= delay) {
        fn.apply(this, args);
        lastTime = now;
      }
    };
  }

  _showEmpty() {
    this.contentEl.innerHTML = '<div style="padding:40px;text-align:center;color:#999;">没有更多数据了</div>';
  }

  _showError(msg) {
    console.error('列表加载失败:', msg);
  }

  // === 完整清理（防止内存泄漏）===
  destroy() {
    this.destroyed = true;

    // 清理事件监听
    if (this.scrollEl) {
      this.scrollEl.removeEventListener('scroll', this._onScroll);
    }

    // 清理 IntersectionObserver
    if (this._imageObserver) {
      this._imageObserver.disconnect();
    }

    // 清理 DOM
    if (this.container && this.scrollEl) {
      this.container.removeChild(this.scrollEl);
    }

    // 清理引用
    this.data = null;
    this.container = null;
    this.scrollEl = null;
    this.contentEl = null;
    this._imageObserver = null;
  }
}
```

---

## 五、性能优化检查清单

```
✅ 图片懒加载（IntersectionObserver / loading="lazy"）
✅ 路由/组件懒加载（动态 import）
✅ 输入框防抖（debounce 300ms）
✅ 滚动/resize 节流（throttle 16ms）
✅ 大列表虚拟渲染（只渲染可见区域）
✅ 事件监听器清理（组件销毁时 removeEventListener）
✅ 定时器清理（clearInterval/clearTimeout）
✅ Worker 清理（页面卸载时 terminate）
✅ 缓存有界化（LRU / WeakMap / WeakRef）
✅ 大数据分片处理（requestAnimationFrame）
✅ 对象池复用（减少 GC 压力）
✅ DocumentFragment 批量 DOM 操作
✅ CSS 动画用 transform/opacity（GPU 加速）
✅ 避免布局抖动（不要交替读写 DOM 属性）
✅ 定期内存快照对比（Chrome DevTools）
```

---

## 六、性能指标速查

```
Core Web Vitals:
  LCP (Largest Contentful Paint)     ≤ 2.5s    → 懒加载、预加载关键资源
  INP (Interaction to Next Paint)    ≤ 200ms   → 防抖节流、代码分割
  CLS (Cumulative Layout Shift)      ≤ 0.1     → 固定尺寸、预加载字体

其他关键指标:
  FCP (First Contentful Paint)       ≤ 1.8s
  TTFB (Time to First Byte)          ≤ 800ms
  FID (First Input Delay)            ≤ 100ms   → 减少主线程阻塞
  TTI (Time to Interactive)          ≤ 3.8s

优化优先级:
  1. 减少资源体积（压缩、Tree Shaking、Code Splitting）
  2. 减少请求数量（合并、缓存、CDN）
  3. 延迟非关键资源（懒加载、动态 import）
  4. 优化渲染性能（虚拟列表、CSS 动画、避免重排）
  5. 管理内存（清理引用、有界缓存、对象池）
```

---

---

# 进阶篇：Web 性能优化（5/11 更新）

> 基于 5/10 基础篇（懒加载/防抖节流/内存管理），本次深入**渲染管线、Web Workers、资源提示、Bundle 优化、Service Worker、图片优化**六大进阶领域。

---

## 七、浏览器渲染管线深度优化

### 7.1 关键渲染路径（CRP）

```
HTML → DOM Tree
CSS → CSSOM Tree
DOM + CSSOM → Render Tree
Render Tree → Layout（计算几何信息）
Layout → Paint（填充像素）
Paint → Composite（合成图层）
```

**优化核心：** 减少 Render Tree 节点数 → 减少 Layout 范围 → 减少 Paint 区域 → 利用 Composite 层

```js
// === 7.1.1 避免强制同步布局（Layout Thrashing）===

// ❌ 反模式：读写交替触发多次 Layout
function badResizeElements(elements) {
  elements.forEach(el => {
    const height = el.offsetHeight; // 读 → 触发 Layout
    el.style.height = `${height + 10}px`; // 写 → 标记 Dirty
    // 下次循环读 offsetHeight 时，浏览器被迫重新 Layout
  });
}

// ✅ 正确模式：先读后写（批量）
function goodResizeElements(elements) {
  const heights = new Map();
  // 阶段 1：批量读
  elements.forEach(el => {
    heights.set(el, el.offsetHeight);
  });
  // 阶段 2：批量写
  elements.forEach(el => {
    el.style.height = `${heights.get(el) + 10}px`;
  });
}

// ✅ 更优雅：使用 read/write 工具函数
const DOM = {
  read(fn) {
    return requestAnimationFrame(() => {
      this._pendingReads.push(fn);
      if (this._pendingReads.length === 1) {
        this._flushReads();
      }
    });
  },
  write(fn) {
    this._pendingWrites.push(fn);
  },
  _pendingReads: [],
  _pendingWrites: [],
  _flushReads() {
    const reads = this._pendingReads.splice(0);
    reads.forEach(fn => fn());
    if (this._pendingWrites.length) {
      const writes = this._pendingWrites.splice(0);
      requestAnimationFrame(() => writes.forEach(fn => fn()));
    }
    // 准备下一次
    if (this._pendingReads.length) this._flushReads();
  }
};

// 使用
DOM.read(() => {
  const height = element.offsetHeight;
  DOM.write(() => {
    element.style.height = `${height + 10}px`;
  });
});
```

### 7.2 CSS Containment（CSS 隔离）

```css
/* === 限制渲染影响范围，避免全局重排/重绘 === */

/* layout containment：内部布局不影响外部 */
.card {
  contain: layout;
  /* 等价于：contain: layout style paint; */
}

/* size containment：元素尺寸不依赖内部内容 */
.sidebar {
  contain: size;
  /* 必须显式设置 width/height，否则为 0 */
  width: 300px;
  height: 600px;
}

/* paint containment：溢出内容不可见（类似 overflow:hidden 但更高效） */
.tooltip {
  contain: paint;
}

/* strict containment = layout + size + paint + style */
.heavy-widget {
  contain: strict;
}

/* 组合使用 */
.virtual-list-item {
  contain: content; /* layout + paint，最实用的组合 */
}
```

### 7.3 GPU 加速与图层合成

```css
/* === 提升为独立合成层（避免重绘，只合成）=== */

/* 方法 1：transform（推荐） */
.animated-element {
  will-change: transform;
  transform: translateZ(0); /* 触发 GPU 加速 */
}

/* 方法 2：opacity */
.fade-element {
  will-change: opacity;
}

/* 方法 3：video/canvas 自动提升 */
video, canvas {
  /* 浏览器自动创建合成层 */
}

/* ⚠️ will-change 使用警告 */
/* ❌ 不要全局使用 */
* { will-change: transform; } /* 内存爆炸 */

/* ✅ 按需使用 + 交互后移除 */
.card:hover {
  will-change: transform;
}
```

```js
// === 7.3.1 动态管理 will-change ===
class LayerManager {
  constructor() {
    this.activeElements = new Set();
  }

  // 交互前提升图层
  prepare(element, property = 'transform') {
    element.style.willChange = property;
    this.activeElements.add(element);
  }

  // 交互后降级图层（释放 GPU 内存）
  release(element) {
    element.style.willChange = 'auto';
    this.activeElements.delete(element);
  }

  // 自动释放：动画结束后
  autoRelease(element, property = 'transform') {
    this.prepare(element, property);
    element.addEventListener(
      'transitionend',
      () => this.release(element),
      { once: true }
    );
    element.addEventListener(
      'animationend',
      () => this.release(element),
      { once: true }
    );
  }
}

const layerManager = new LayerManager();

// 拖拽场景
draggable.addEventListener('mousedown', () => {
  layerManager.prepare(draggable, 'transform');
});
draggable.addEventListener('mouseup', () => {
  layerManager.autoRelease(draggable);
});
```

### 7.4 IntersectionObserver + requestAnimationFrame 组合优化

```js
/**
 * 高性能动画控制器
 * 只在元素可见时执行 rAF 循环
 */
class VisibleAnimationController {
  constructor() {
    this.animations = new Map(); // element → animationId
    this.observer = new IntersectionObserver(
      this._onVisibilityChange.bind(this),
      { rootMargin: '100px' }
    );
  }

  register(element, onFrame) {
    this.animations.set(element, {
      onFrame,
      rafId: null,
      isVisible: false,
      running: false
    });
    this.observer.observe(element);
  }

  _onVisibilityChange(entries) {
    entries.forEach(entry => {
      const anim = this.animations.get(entry.target);
      if (!anim) return;

      anim.isVisible = entry.isIntersecting;

      if (anim.isVisible && !anim.running) {
        this._startLoop(anim);
      } else if (!anim.isVisible && anim.running) {
        this._stopLoop(anim);
      }
    });
  }

  _startLoop(anim) {
    anim.running = true;
    const loop = (time) => {
      if (!anim.isVisible) {
        anim.running = false;
        return;
      }
      anim.onFrame(time);
      anim.rafId = requestAnimationFrame(loop);
    };
    anim.rafId = requestAnimationFrame(loop);
  }

  _stopLoop(anim) {
    anim.running = false;
    if (anim.rafId) {
      cancelAnimationFrame(anim.rafId);
      anim.rafId = null;
    }
  }

  destroy() {
    this.observer.disconnect();
    this.animations.forEach(anim => this._stopLoop(anim));
    this.animations.clear();
  }
}

// 使用示例：多个滚动动画
const controller = new VisibleAnimationController();

document.querySelectorAll('.scroll-animated').forEach(el => {
  controller.register(el, (time) => {
    const progress = (time % 2000) / 2000;
    el.style.transform = `translateX(${Math.sin(progress * Math.PI * 2) * 50}px)`;
  });
});
```

---

## 八、Web Workers 多线程优化

### 8.1 Worker 类型与选择

```
Web Worker（专用线程）
  ├─ Dedicated Worker：1:1 通信，适合单次计算
  ├─ Shared Worker：多标签页共享，适合跨 tab 状态
  └─ Service Worker：代理层，适合缓存/推送

Worklet（渲染管线线程）
  ├─ AudioWorklet：音频处理
  ├─ PaintWorklet：CSS 自定义绘制
  └─ AnimationWorklet：滚动动画（实验性）

Worker Threads（Node.js）
  └─ worker_threads：Node.js 多线程
```

### 8.2 Dedicated Worker 完整实现

```js
// === worker.js（独立文件，浏览器要求）===
// 方式 1：独立文件
// worker.js
self.addEventListener('message', (e) => {
  const { type, data } = e.data;

  switch (type) {
    case 'SORT':
      // 大数据排序（主线程会卡顿 500ms+）
      const sorted = data.sort((a, b) => a.value - b.value);
      self.postMessage({ type: 'SORT_DONE', data: sorted });
      break;

    case 'IMAGE_PROCESS':
      // 图片像素处理（灰度化）
      const result = processImageGrayscale(data);
      self.postMessage({ type: 'IMAGE_DONE', data: result }, [result]); // Transferable
      break;

    case 'HASH':
      // 大量数据哈希计算
      const hashes = data.map(item => simpleHash(item));
      self.postMessage({ type: 'HASH_DONE', data: hashes });
      break;

    case 'TERMINATE':
      self.close();
      break;
  }
});

function processImageGrayscale(imageData) {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    output[i] = gray;
    output[i + 1] = gray;
    output[i + 2] = gray;
    output[i + 3] = data[i + 3];
  }

  return new ImageData(output, width, height);
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

// === 主线程使用 ===
// 方式 A：独立文件
const worker = new Worker('/workers/compute.js');
worker.postMessage({ type: 'SORT', data: largeArray });
worker.onmessage = (e) => {
  console.log('排序完成:', e.data.data.length, '条');
};

// 方式 B：Blob URL（内联 Worker，无需独立文件）
function createInlineWorker(fn) {
  const blob = new Blob(
    [`(${fn.toString()})()`],
    { type: 'application/javascript' }
  );
  return new Worker(URL.createObjectURL(blob));
}

const computeWorker = createInlineWorker(function () {
  self.addEventListener('message', (e) => {
    const { numbers } = e.data;
    // 在主线程外执行密集计算
    const result = numbers.reduce((sum, n) => sum + n * n, 0);
    self.postMessage({ result });
  });
});

computeWorker.postMessage({ numbers: new Array(10000000).fill(0).map(() => Math.random()) });
computeWorker.onmessage = (e) => {
  console.log('计算结果:', e.data.result);
  computeWorker.terminate(); // 用完即销毁
};
```

### 8.3 Worker 池（复用线程，避免频繁创建开销）

```js
/**
 * Worker 线程池
 * 复用 Worker 避免创建/销毁开销（~10ms/次）
 */
class WorkerPool {
  constructor(workerUrl, maxWorkers = navigator.hardwareConcurrency || 4) {
    this.workerUrl = workerUrl;
    this.maxWorkers = maxWorkers;
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers = 0;
  }

  // 创建 Worker
  _createWorker() {
    const worker = new Worker(this.workerUrl);
    this.workers.push(worker);
    this.activeWorkers++;

    worker.onmessage = (e) => {
      const task = this.taskQueue.shift();
      if (task) {
        task.resolve(e.data);
        this._processQueue();
      } else {
        this.activeWorkers--;
        worker.terminate();
        this.workers = this.workers.filter(w => w !== worker);
      }
    };

    worker.onerror = (err) => {
      const task = this.taskQueue.shift();
      if (task) task.reject(err);
      this.activeWorkers--;
      worker.terminate();
      this.workers = this.workers.filter(w => w !== worker);
      this._processQueue();
    };

    return worker;
  }

  // 提交任务
  submit(data, transfer = []) {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ data, resolve, reject, transfer });
      this._processQueue();
    });
  }

  // 处理队列
  _processQueue() {
    if (this.taskQueue.length === 0) return;

    // 优先使用空闲 Worker
    const idleWorker = this.workers.find(w => !w._busy);
    if (idleWorker) {
      idleWorker._busy = true;
      const task = this.taskQueue.shift();
      idleWorker.postMessage(task.data, task.transfer);
      idleWorker.onmessage = (e) => {
        idleWorker._busy = false;
        task.resolve(e.data);
        this._processQueue();
      };
      return;
    }

    // 创建新 Worker（不超过上限）
    if (this.workers.length < this.maxWorkers) {
      const worker = this._createWorker();
      worker._busy = true;
      const task = this.taskQueue.shift();
      worker.postMessage(task.data, task.transfer);
      worker.onmessage = (e) => {
        worker._busy = false;
        task.resolve(e.data);
        this._processQueue();
      };
      return;
    }

    // 池已满，等待
  }

  // 销毁池
  destroy() {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers = 0;
  }
}

// 使用示例：并行处理大文件
const pool = new WorkerPool('/workers/image-process.js', 4);

async function processImages(imageFiles) {
  const tasks = imageFiles.map(file =>
    pool.submit({ file: await file.arrayBuffer(), width: 800, height: 600 })
  );
  const results = await Promise.all(tasks);
  pool.destroy();
  return results;
}
```

### 8.4 Shared Worker（跨标签页通信）

```js
// === shared-worker.js ===
const clients = new Set();

self.onconnect = (e) => {
  const port = e.ports[0];
  clients.add(port);

  port.onmessage = (e) => {
    const { type, data, senderId } = e.data;

    switch (type) {
      case 'BROADCAST':
        // 广播给所有其他标签页
        clients.forEach(client => {
          if (client !== port) {
            client.postMessage({ type: 'BROADCAST', data, from: senderId });
          }
        });
        break;

      case 'SYNC_STATE':
        // 同步状态给新打开的标签页
        client.postMessage({ type: 'STATE_SYNC', data: globalState });
        break;
    }
  };

  port.onclose = () => {
    clients.delete(port);
  };
};

// === 主线程 ===
const sharedWorker = new SharedWorker('/workers/shared.js');
sharedWorker.port.postMessage({
  type: 'BROADCAST',
  data: { action: 'user_login', userId: '123' },
  senderId: 'tab-' + Date.now()
});

sharedWorker.port.onmessage = (e) => {
  if (e.data.type === 'BROADCAST') {
    console.log('其他标签页操作:', e.data.data);
    // 更新本地 UI 保持同步
  }
};
```

---

## 九、资源提示（Resource Hints）

### 9.1 四种资源提示对比

```html
<!-- === preconnect：提前建立连接（DNS + TCP + TLS）=== -->
<!-- 适用于你知道一定会请求的第三方域名 -->
<link rel="preconnect" href="https://api.example.com" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com">
<!-- 节省 ~200-500ms 连接时间 -->

<!-- === dns-prefetch：仅解析 DNS（轻量级预连接）=== -->
<!-- 适用于不确定是否需要的域名 -->
<link rel="dns-prefetch" href="https://analytics.example.com">
<!-- 节省 ~20-120ms DNS 时间 -->

<!-- === prefetch：空闲时预加载未来可能需要的资源 === -->
<!-- 低优先级，不阻塞当前页面渲染 -->
<link rel="prefetch" href="/next-page.html" as="document">
<link rel="prefetch" href="/assets/heavy-chart.js" as="script">
<link rel="prefetch" href="/images/hero.webp" as="image">
<!-- ⚠️ 不要 prefetch 当前页面需要的资源（用 preload） -->

<!-- === preload：高优先级预加载当前页面必需资源 === -->
<!-- 阻塞渲染的关键资源 -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/css/critical.css" as="style">
<link rel="preload" href="/js/main.js" as="script">
<link rel="preload" href="/images/above-fold.webp" as="image" imagesrcset="/images/hero-320w.webp 320w, /images/hero-768w.webp 768w, /images/hero-1440w.webp 1440w" imagesizes="100vw">

<!-- === prerender：预渲染整个页面（最激进）=== -->
<!-- 浏览器在后台完整渲染目标页面 -->
<link rel="prerender" href="https://next-page.example.com">
<!-- ⚠️ 消耗大量带宽和 CPU，仅在确定用户会跳转时使用 -->
```

### 9.2 动态资源提示（JS 控制）

```js
/**
 * 智能资源提示管理器
 * 根据用户行为动态决定预加载策略
 */
class ResourceHintManager {
  constructor() {
    this.prefetched = new Set();
    this.preloaded = new Set();
  }

  // 预连接
  preconnect(url, crossorigin = true) {
    if (document.querySelector(`link[rel="preconnect"][href="${url}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = url;
    if (crossorigin) link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  // 预加载（高优先级，当前页面需要）
  preload(href, asType, options = {}) {
    if (this.preloaded.has(href)) return;
    this.preloaded.add(href);

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = asType;
    if (options.type) link.type = options.type;
    if (options.crossorigin) link.crossOrigin = 'anonymous';
    if (options.imagesrcset) link.imagesrcset = options.imagesrcset;
    if (options.imagesizes) link.imagesizes = options.imagesizes;
    document.head.appendChild(link);
  }

  // 预取（低优先级，未来页面可能需要）
  prefetch(href, asType) {
    if (this.prefetched.has(href)) return;
    this.prefetched.add(href);

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    link.as = asType;
    document.head.appendChild(link);
  }

  // 空闲时间预取（使用 requestIdleCallback）
  idlePrefetch(href, asType, deadline = 50) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => this.prefetch(href, asType), { timeout: deadline });
    } else {
      setTimeout(() => this.prefetch(href, asType), 1000);
    }
  }
}

const hints = new ResourceHintManager();

// 使用：用户 hover 链接时预取目标页面
document.querySelectorAll('a[data-prefetch]').forEach(link => {
  link.addEventListener('mouseenter', () => {
    hints.prefetch(link.href, 'document');
  }, { once: true });
});

// 使用：SPA 路由切换前预加载目标 chunk
router.beforeEach((to, from, next) => {
  if (to.chunkUrl) {
    hints.preload(to.chunkUrl, 'script');
  }
  next();
});
```

### 9.3 基于用户行为的智能预加载

```js
/**
 * 智能预加载引擎
 * 根据鼠标轨迹预测用户下一步操作
 */
class PredictivePreloader {
  constructor() {
    this.mouseHistory = [];
    this.predictions = new Map();
    this.threshold = 0.7; // 预测置信度阈值
    this._bindMouseTracking();
  }

  _bindMouseTracking() {
    let lastMove = 0;
    document.addEventListener('mousemove', (e) => {
      const now = Date.now();
      if (now - lastMove < 50) return; // 限流
      lastMove = now;

      this.mouseHistory.push({ x: e.clientX, y: e.clientY, time: now });
      if (this.mouseHistory.length > 20) this.mouseHistory.shift();

      this._predictAndPreload();
    });
  }

  _predictAndPreload() {
    if (this.mouseHistory.length < 5) return;

    const recent = this.mouseHistory.slice(-5);
    const dx = recent[4].x - recent[0].x;
    const dy = recent[4].y - recent[0].y;
    const speed = Math.sqrt(dx * dx + dy * dy) / (recent[4].time - recent[0].time);

    // 鼠标速度 < 2px/ms → 可能在浏览/选择
    if (speed < 2) {
      const targetX = recent[4].x + dx * 3;
      const targetY = recent[4].y + dy * 3;

      // 找到鼠标轨迹前方的可点击元素
      const target = this._findTargetAhead(targetX, targetY);
      if (target && target.href && !this.predictions.has(target.href)) {
        const confidence = this._calculateConfidence(target);
        if (confidence > this.threshold) {
          this.predictions.set(target.href, { confidence, time: Date.now() });
          // 预连接目标域名
          const url = new URL(target.href, location.href);
          hints.preconnect(`${url.protocol}//${url.host}`);
          // 空闲时 prefetch
          hints.idlePrefetch(target.href, 'document');
        }
      }
    }

    // 清理过期预测
    this.predictions.forEach((val, key) => {
      if (Date.now() - val.time > 10000) this.predictions.delete(key);
    });
  }

  _findTargetAhead(x, y) {
    // 简化的前方目标检测
    const elements = document.querySelectorAll('a[data-prefetch], a[href]');
    let closest = null;
    let minDist = Infinity;

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const dist = Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y);
      if (dist < minDist && dist < 200) {
        minDist = dist;
        closest = el;
      }
    });

    return closest;
  }

  _calculateConfidence(target) {
    let confidence = 0.5; // 基础置信度

    // 鼠标在元素附近减速 → 更可能点击
    const rect = target.getBoundingClientRect();
    const lastPos = this.mouseHistory[this.mouseHistory.length - 1];
    const dist = Math.hypot(
      lastPos.x - (rect.left + rect.width / 2),
      lastPos.y - (rect.top + rect.height / 2)
    );
    if (dist < 50) confidence += 0.3;

    // 元素在视口内
    if (rect.top < window.innerHeight && rect.bottom > 0) confidence += 0.1;

    return Math.min(confidence, 1);
  }
}

// 启动预测预加载
const preloader = new PredictivePreloader();
```

---

## 十、Bundle 优化与代码分割

### 10.1 Webpack/Vite 代码分割策略

```js
// === Webpack 分割策略 ===
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // 策略 1：vendor 分离（第三方库单独打包）
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
          priority: 10,
          // 只打包首次需要的 vendor
          enforce: true
        },
        // 策略 2：common 分离（多页面共享的代码）
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
          enforce: true
        },
        // 策略 3：大型库单独拆分
        echarts: {
          test: /[\\/]node_modules[\\/]echarts[\\/]/,
          name: 'echarts',
          chunks: 'all',
          priority: 15,
          enforce: true
        },
        // 策略 4：样式分离
        styles: {
          name: 'styles',
          test: /\.css$/,
          chunks: 'all',
          enforce: true
        }
      }
    },
    // 运行时单独提取（长期缓存）
    runtimeChunk: {
      name: 'runtime'
    }
  }
};

// === Vite 分割策略 ===
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vue 生态单独打包
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          // UI 库单独打包
          'ui-vendor': ['element-plus'],
          // 工具库单独打包
          'utils-vendor': ['lodash-es', 'dayjs'],
          // 大型可视化库按需加载
          'charts': ['echarts']
        }
      }
    },
    // 目标浏览器
    target: 'es2015',
    // CSS 代码分割
    cssCodeSplit: true,
    // 压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,      // 移除 console
        drop_debugger: true,     // 移除 debugger
        pure_funcs: ['console.log'] // 移除特定函数调用
      }
    }
  }
};
```

### 10.2 Tree Shaking 深度优化

```js
// === package.json 标记副作用 ===
// "sideEffects": false  → 所有文件无副作用，大胆删除
// "sideEffects": ["*.css"] → 只有 CSS 有副作用

// === 使用 ESM 而非 CJS ===
// ❌ CJS 无法 Tree Shaking
const lodash = require('lodash');
const result = lodash.chunk([1,2,3], 2);

// ✅ ESM 可以 Tree Shaking
import { chunk } from 'lodash-es';
const result = chunk([1,2,3], 2);

// ✅ 单文件导入（最彻底）
import chunk from 'lodash-es/chunk';
const result = chunk([1,2,3], 2);

// === 条件代码消除 ===
// Vite/Webpack 会自动消除死代码
if (import.meta.env.DEV) {
  // 生产环境这段代码会被完全移除
  console.log('开发环境调试信息');
  enableDebugTools();
}

// === 动态 import 实现路由级 Tree Shaking ===
// 只有访问路由时才加载对应代码
const routes = [
  {
    path: '/dashboard',
    component: () => import('./views/Dashboard.vue')
    // 只有访问 /dashboard 时才下载 Dashboard.vue 及其依赖
  },
  {
    path: '/settings',
    component: () => import(/* webpackChunkName: "settings" */ './views/Settings.vue')
  }
];
```

### 10.3 Bundle 分析工具

```js
// === 自定义 Bundle 分析器 ===
class BundleAnalyzer {
  constructor() {
    this.modules = new Map();
    this.duplicates = new Map();
  }

  // 分析 import 图
  analyzeImportGraph(stats) {
    const graph = {};

    stats.modules.forEach(mod => {
      graph[mod.name] = {
        size: mod.size,
        gzipSize: this._gzipSize(mod.source),
        dependencies: mod.dependencies || [],
        isEntry: mod.isEntry,
        isAsync: mod.async
      };
    });

    // 查找重复模块
    this._findDuplicates(stats);

    return {
      totalSize: this._sumSizes(stats),
      gzipTotal: this._sumGzipSizes(stats),
      modules: graph,
      duplicates: Array.from(this.duplicates.entries()),
      largestModules: this._getLargest(stats, 10),
      asyncChunks: stats.modules.filter(m => m.async)
    };
  }

  // 查找重复依赖
  _findDuplicates(stats) {
    const libVersions = new Map();

    stats.modules.forEach(mod => {
      const match = mod.name.match(/node_modules[\\/](.+?)(?:[\\/]|$)/);
      if (match) {
        const lib = match[1];
        if (!libVersions.has(lib)) {
          libVersions.set(lib, []);
        }
        libVersions.get(lib).push(mod);
      }
    });

    libVersions.forEach((versions, lib) => {
      if (versions.length > 1) {
        this.duplicates.set(lib, versions);
      }
    });
  }

  _gzipSize(source) {
    // 估算 gzip 后大小（实际约 30-40%）
    return Math.round(source.length * 0.35);
  }

  _getLargest(stats, n) {
    return [...stats.modules]
      .sort((a, b) => b.size - a.size)
      .slice(0, n);
  }
}

// === 运行时 Bundle 监控 ===
// 监控实际加载的 chunk 大小
if ('PerformanceObserver' in window) {
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach(entry => {
      if (entry.entryType === 'resource') {
        const isJS = entry.name.endsWith('.js');
        const isChunk = entry.name.includes('chunk') || entry.name.includes('assets');
        if (isJS && isChunk) {
          console.log(`Chunk 加载: ${entry.name}`, {
            transferSize: entry.transferSize,
            decodedSize: entry.decodedBodySize,
            duration: Math.round(entry.duration)
          });
        }
      }
    });
  });
  observer.observe({ entryTypes: ['resource'] });
}
```

---

## 十一、Service Worker 缓存策略

### 11.1 五种缓存策略

```js
// === service-worker.js ===
const CACHE_NAME = 'app-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/critical.css',
  '/js/runtime.js',
  '/fonts/main.woff2',
  '/images/logo.svg'
];

// === 策略 1：Cache First（缓存优先）===
// 适用：静态资源（JS/CSS/图片/字体），长期不变
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('离线', { status: 503 });
  }
}

// === 策略 2：Network First（网络优先）===
// 适用：API 数据、用户内容，需要最新
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME + '-api');
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    return cached || new Response('离线', { status: 503 });
  }
}

// === 策略 3：Stale While Revalidate（ stale 时重新验证）===
// 适用：不紧急但需要更新的资源
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}

// === 策略 4：Cache Only（仅缓存）===
// 适用：离线必需资源（离线页、logo）
async function cacheOnly(request) {
  const cache = await caches.open(CACHE_NAME);
  return await cache.match(request);
}

// === 策略 5：Network Only（仅网络）===
// 适用：实时数据、登录请求
async function networkOnly(request) {
  return fetch(request);
}

// === 路由分发 ===
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 同源请求
  if (url.origin === location.origin) {
    if (request.destination === 'style') {
      event.respondWith(cacheFirst(request));
    } else if (request.destination === 'script') {
      event.respondWith(staleWhileRevalidate(request));
    } else if (request.destination === 'image') {
      event.respondWith(cacheFirst(request));
    } else if (request.destination === 'font') {
      event.respondWith(cacheFirst(request));
    } else if (url.pathname.startsWith('/api/')) {
      event.respondWith(networkFirst(request));
    } else {
      event.respondWith(staleWhileRevalidate(request));
    }
  } else {
    // 跨域 CDN 资源
    event.respondWith(cacheFirst(request));
  }
});

// === 安装：预缓存静态资源 ===
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting(); // 跳过等待，立即激活
});

// === 激活：清理旧缓存 ===
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // 立即接管所有客户端
  );
});
```

### 11.2 高级缓存策略：IndexDB + SW

```js
/**
 * 离线优先架构：Service Worker + IndexedDB
 * 支持离线写入，在线时自动同步
 */
class OfflineManager {
  constructor() {
    this.dbName = 'offline-store';
    this.dbVersion = 1;
    this.syncQueue = [];
  }

  // 初始化 IndexedDB
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // 离线写入：存入队列，在线后同步
  async queueWrite(operation) {
    const db = await this.init();
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    store.add({
      ...operation,
      timestamp: Date.now(),
      synced: false
    });
    return tx.complete;
  }

  // 在线同步：发送队列中的操作
  async sync() {
    const db = await this.init();
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    const request = store.getAll();

    request.onsuccess = async () => {
      const pending = request.result.filter(item => !item.synced);

      for (const item of pending) {
        try {
          await fetch(item.url, {
            method: item.method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.body)
          });

          // 标记已同步
          item.synced = true;
          store.put(item);
        } catch (err) {
          console.error('同步失败:', item.id, err);
          break; // 失败后停止，下次重试
        }
      }
    };
  }
}

// SW 中监听 online 事件
self.addEventListener('online', () => {
  // 通知主线程执行同步
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_REQUEST' });
    });
  });
});
```

---

## 十二、图片优化深度实践

### 12.1 现代图片格式选择

```
格式对比：
┌─────────────┬──────────┬──────────┬──────────┬──────────┐
│   特性      │  JPEG    │  WebP    │  AVIF    │  SVG     │
├─────────────┼──────────┼──────────┼──────────┼──────────┤
│ 有损压缩    │   ✅     │   ✅     │   ✅     │   ❌     │
│ 无损压缩    │   ❌     │   ✅     │   ✅     │   ✅     │
│ 透明度      │   ❌     │   ✅     │   ✅     │   ✅     │
│ 动画        │   ❌     │   ✅     │   ✅     │   ✅     │
│ 体积优势    │   基准   │  -30%    │  -50%    │  矢量    │
│ 兼容性      │  100%    │  95%+    │  85%+    │  98%+    │
└─────────────┴──────────┴──────────┴──────────┴──────────┘

推荐策略：
- 照片 → AVIF > WebP > JPEG
- 图标/图形 → SVG > WebP
- 动画 → WebP > GIF
- 透明背景 → WebP/AVIF > PNG
```

### 12.2 响应式图片完整方案

```html
<!-- === 方案 1：srcset + sizes（根据屏幕密度选择）=== -->
<img
  srcset="/images/photo-320w.webp 320w,
          /images/photo-640w.webp 640w,
          /images/photo-1024w.webp 1024w,
          /images/photo-1440w.webp 1440w"
  sizes="(max-width: 640px) 100vw,
         (max-width: 1024px) 50vw,
         33vw"
  src="/images/photo-640w.webp"
  alt="描述"
  loading="lazy"
  decoding="async"
>

<!-- === 方案 2：picture 元素（根据格式支持选择）=== -->
<picture>
  <!-- 浏览器选择第一个支持的格式 -->
  <source type="image/avif" srcset="/images/photo.avif">
  <source type="image/webp" srcset="/images/photo.webp">
  <img src="/images/photo.jpg" alt="描述" loading="lazy">
</picture>

<!-- === 方案 3：组合使用（最佳实践）=== -->
<picture>
  <source type="image/avif"
    srcset="/images/hero-320.avif 320w,
            /images/hero-768.avif 768w,
            /images/hero-1440.avif 1440w"
    sizes="100vw">
  <source type="image/webp"
    srcset="/images/hero-320.webp 320w,
            /images/hero-768.webp 768w,
            /images/hero-1440.webp 1440w"
    sizes="100vw">
  <img src="/images/hero-768.jpg"
       alt="Hero Image"
       width="1440" height="800"
       loading="eager"
       decoding="async"
       fetchpriority="high">
</picture>
```

### 12.3 图片占位符与渐进式加载

```js
/**
 * 图片渐进式加载系统
 * 低质量占位图 → 高质量图片 → WebP/AVIF
 */
class ProgressiveImageLoader {
  constructor() {
    this.observer = new IntersectionObserver(
      this._onIntersect.bind(this),
      { rootMargin: '200px' }
    );
    this.loaded = new Set();
  }

  // 注册图片
  register(imgElement, options = {}) {
    const {
      placeholder = '',    // 低质量占位图（blurhash/小图）
      webpSrc = '',        // WebP 源
      avifSrc = '',        // AVIF 源
      jpgSrc = '',         // JPEG 回退
      quality = 'medium'   // low/medium/high
    } = options;

    // 设置占位图
    if (placeholder) {
      imgElement.src = placeholder;
      imgElement.style.filter = 'blur(10px)';
      imgElement.style.transition = 'filter 0.5s ease, opacity 0.5s ease';
    }

    // 存储真实源
    imgElement.dataset.webp = webpSrc;
    imgElement.dataset.avif = avifSrc;
    imgElement.dataset.jpg = jpgSrc;
    imgElement.dataset.placeholder = placeholder;

    this.observer.observe(imgElement);
  }

  _onIntersect(entries) {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const img = entry.target;
      if (this.loaded.has(img)) return;
      this.loaded.add(img);

      this._loadImage(img);
      this.observer.unobserve(img);
    });
  }

  async _loadImage(img) {
    const avifSrc = img.dataset.avif;
    const webpSrc = img.dataset.webp;
    const jpgSrc = img.dataset.jpg || img.dataset.src;

    // 检测格式支持
    let src = jpgSrc;
    if (avifSrc && this._supportsAvif()) {
      src = avifSrc;
    } else if (webpSrc && this._supportsWebp()) {
      src = webpSrc;
    }

    // 预加载图片
    const preloadImg = new Image();
    preloadImg.src = src;

    await new Promise((resolve, reject) => {
      preloadImg.onload = resolve;
      preloadImg.onerror = reject;
    });

    // 切换图片（带淡入效果）
    img.src = src;
    img.style.filter = 'blur(0)';
    img.style.opacity = '1';
  }

  _supportsWebp() {
    if (this._webpSupport !== undefined) return this._webpSupport;
    const el = document.createElement('canvas');
    this._webpSupport = el.toDataURL('image/webp').startsWith('data:image/webp');
    return this._webpSupport;
  }

  _supportsAvif() {
    if (this._avifSupport !== undefined) return this._avifSupport;
    const image = new Image();
    // AVIF 特征检测（1x1 像素的 AVIF base64）
    image.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BWkYAAADzaXplcwAAAAABAAEAA+QAAAVjbm9kdQADAA==';
    this._avifSupport = false;
    image.onload = () => { this._avifSupport = image.width === 1; };
    return this._avifSupport;
  }

  destroy() {
    this.observer.disconnect();
    this.loaded.clear();
  }
}

// 使用示例
const imageLoader = new ProgressiveImageLoader();

document.querySelectorAll('.progressive-img').forEach(img => {
  imageLoader.register(img, {
    placeholder: img.dataset.placeholder, // blurhash 生成的小图
    avifSrc: img.dataset.avif,
    webpSrc: img.dataset.webp,
    jpgSrc: img.dataset.jpg
  });
});
```

### 12.4 BlurHash 占位符生成

```js
/**
 * BlurHash 解码器（简化版）
 * 将短字符串解码为模糊占位图
 */
class BlurHashDecoder {
  // 解码 BlurHash 字符串为 Canvas ImageData
  static decode(hash, width = 32, height = 32) {
    const pixels = this._decode(hash, width, height);
    const imageData = new ImageData(width, height);

    for (let i = 0; i < pixels.length; i++) {
      imageData.data[i * 4] = pixels[i][0];
      imageData.data[i * 4 + 1] = pixels[i][1];
      imageData.data[i * 4 + 2] = pixels[i][2];
      imageData.data[i * 4 + 3] = 255;
    }

    return imageData;
  }

  // 生成占位图 data URL
  static toDataURL(hash, width = 32, height = 32) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(this.decode(hash, width, height), 0, 0);
    return canvas.toDataURL();
  }

  static _decode(hash, width, height) {
    // 简化实现：实际应使用完整的 BlurHash 解码算法
    // 这里返回基于 hash 的颜色渐变
    const pixels = [];
    const maxAC = 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const r = Math.floor((hash.charCodeAt(0) / 255) * 255);
        const g = Math.floor((hash.charCodeAt(1) / 255) * 255);
        const b = Math.floor((hash.charCodeAt(2) / 255) * 255);
        pixels.push([r, g, b]);
      }
    }
    return pixels;
  }
}

// 使用：服务端生成 BlurHash → 客户端解码为占位图
// 服务端：sharp(image).blurhash() → "LEHV6nWBASH+dRjRX*%2Myd*"
// 客户端：
const placeholder = BlurHashDecoder.toDataURL('LEHV6nWBASH+dRjRX*%2Myd*', 32, 32);
imgElement.src = placeholder;
imgElement.style.filter = 'blur(20px)';
// 然后 ProgressiveImageLoader 加载真实图片
```

---

## 十三、性能监控与 RUM（Real User Monitoring）

### 13.1 PerformanceObserver 全面监控

```js
/**
 * 全维度性能监控器
 * 采集 Core Web Vitals + 自定义指标
 */
class PerformanceMonitor {
  constructor(options = {}) {
    this.reportUrl = options.reportUrl || '/api/metrics';
    this.sampleRate = options.sampleRate || 1; // 采样率
    this.metrics = {};
    this.observers = [];
    this._enabled = Math.random() < this.sampleRate;

    if (this._enabled) {
      this._init();
    }
  }

  _init() {
    this._observeLCP();
    this._observeINP();
    this._observeCLS();
    this._observeFCP();
    this._observeTTFB();
    this._observeLongTasks();
    this._observeResources();
    this._observeErrors();

    // 页面卸载时上报
    window.addEventListener('beforeunload', () => this._flush());
    // 也使用 sendBeacon（更可靠）
    window.addEventListener('pagehide', () => this._flush());
  }

  // === Largest Contentful Paint ===
  _observeLCP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.metrics.lcp = lastEntry.startTime;
      this._sendToAnalytics('LCP', lastEntry.startTime);
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    this.observers.push(observer);
  }

  // === Interaction to Next Paint (替代 FID) ===
  _observeINP() {
    const interactions = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        interactions.push({
          startTime: entry.startTime,
          duration: entry.duration,
          target: entry.target?.tagName
        });
      }
    });
    observer.observe({ type: 'interaction', buffered: true, durationThreshold: 16 });
    this.observers.push(observer);

    // 页面卸载时计算 INP
    window.addEventListener('pagehide', () => {
      if (interactions.length === 0) return;
      // INP = 最长的交互延迟（排除最长的那 5%）
      const sorted = interactions.sort((a, b) => b.duration - a.duration);
      const p95Index = Math.floor(sorted.length * 0.05);
      const inp = sorted[p95Index]?.duration || sorted[0]?.duration;
      this.metrics.inp = inp;
      this._sendToAnalytics('INP', inp);
    });
  }

  // === Cumulative Layout Shift ===
  _observeCLS() {
    let clsValue = 0;
    let clsEntries = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // 只统计无用户输入的布局偏移
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          clsEntries.push(entry);
        }
      }
    });
    observer.observe({ type: 'layout-shift', buffered: true });
    this.observers.push(observer);

    window.addEventListener('pagehide', () => {
      this.metrics.cls = clsValue;
      this._sendToAnalytics('CLS', clsValue);
    });
  }

  // === First Contentful Paint ===
  _observeFCP() {
    const observer = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0];
      this.metrics.fcp = entry.startTime;
      this._sendToAnalytics('FCP', entry.startTime);
    });
    observer.observe({ type: 'paint', buffered: true });
    this.observers.push(observer);
  }

  // === Time to First Byte ===
  _observeTTFB() {
    const observer = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0];
      this.metrics.ttfb = entry.responseStart;
      this._sendToAnalytics('TTFB', entry.responseStart);
    });
    observer.observe({ type: 'navigation', buffered: true });
    this.observers.push(observer);
  }

  // === 长任务监控（>50ms 的任务会阻塞主线程）===
  _observeLongTasks() {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        this.metrics.longTasks = (this.metrics.longTasks || 0) + 1;
        console.warn('长任务检测:', {
          duration: Math.round(entry.duration),
          attribution: entry.attribution?.[0]?.name
        });
      });
    });
    observer.observe({ type: 'longtask', buffered: true });
    this.observers.push(observer);
  }

  // === 资源加载监控 ===
  _observeResources() {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        // 只关注慢资源（>1s）
        if (entry.duration > 1000) {
          console.warn('慢资源:', {
            name: entry.name,
            duration: Math.round(entry.duration),
            size: entry.transferSize
          });
        }
      });
    });
    observer.observe({ type: 'resource', buffered: true });
    this.observers.push(observer);
  }

  // === 错误监控 ===
  _observeErrors() {
    window.addEventListener('error', (e) => {
      this.metrics.errors = (this.metrics.errors || 0) + 1;
      this._sendToAnalytics('ERROR', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno
      });
    });

    window.addEventListener('unhandledrejection', (e) => {
      this.metrics.unhandledRejections = (this.metrics.unhandledRejections || 0) + 1;
      this._sendToAnalytics('UNHANDLED_REJECTION', e.reason?.message || String(e.reason));
    });
  }

  // === 上报 ===
  _sendToAnalytics(name, value) {
    const payload = {
      name,
      value,
      timestamp: Date.now(),
      url: location.href,
      userAgent: navigator.userAgent,
      connection: navigator.connection?.effectiveType || 'unknown'
    };

    // 使用 sendBeacon（页面卸载时也能发送）
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: 'application/json'
      });
      navigator.sendBeacon(this.reportUrl, blob);
    } else {
      fetch(this.reportUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    }
  }

  // === 批量上报 ===
  _flush() {
    if (Object.keys(this.metrics).length === 0) return;

    const payload = {
      metrics: this.metrics,
      timestamp: Date.now(),
      url: location.href,
      userAgent: navigator.userAgent
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.reportUrl, JSON.stringify(payload));
    }
  }

  // === 销毁 ===
  destroy() {
    this.observers.forEach(obs => obs.disconnect());
    this.observers = [];
  }
}

// 启动监控
const monitor = new PerformanceMonitor({
  reportUrl: '/api/metrics',
  sampleRate: 0.1 // 10% 采样
});
```

### 13.2 性能基准测试工具

```js
/**
 * 性能基准测试工具
 * 对比优化前后的性能差异
 */
class PerformanceBenchmark {
  constructor(name) {
    this.name = name;
    this.results = [];
  }

  // 测试函数性能
  async test(fn, iterations = 100, label = '') {
    // 预热
    for (let i = 0; i < 10; i++) await fn();

    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }

    const result = this._calculateStats(times, label);
    this.results.push(result);
    return result;
  }

  // 对比多个函数
  async compare(tests, iterations = 100) {
    console.log(`\n📊 性能对比: ${this.name}`);
    console.log('═'.repeat(60));

    const results = [];
    for (const [label, fn] of Object.entries(tests)) {
      const result = await this.test(fn, iterations, label);
      results.push(result);
    }

    // 排序并标记最快
    results.sort((a, b) => a.avg - b.avg);
    results.forEach((r, i) => {
      const speed = i === 0 ? '🏆 最快' : `比最快慢 ${(r.avg / results[0].avg - 1).toFixed(1)}x`;
      console.log(`${i + 1}. ${r.label}: ${r.avg.toFixed(2)}ms (${speed})`);
    });

    console.log('═'.repeat(60));
    return results;
  }

  _calculateStats(times, label) {
    const sorted = [...times].sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);
    const avg = sum / times.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    return {
      label,
      avg: Math.round(avg * 100) / 100,
      p50: Math.round(p50 * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      p99: Math.round(p99 * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      iterations: times.length
    };
  }
}

// 使用示例：对比不同实现的性能
const bench = new PerformanceBenchmark('数组去重');

await bench.compare({
  'Set 去重': () => {
    const arr = Array.from({ length: 10000 }, () => Math.floor(Math.random() * 5000));
    return [...new Set(arr)];
  },
  'filter + indexOf': () => {
    const arr = Array.from({ length: 10000 }, () => Math.floor(Math.random() * 5000));
    return arr.filter((item, index) => arr.indexOf(item) === index);
  },
  'Map 去重': () => {
    const arr = Array.from({ length: 10000 }, () => Math.floor(Math.random() * 5000));
    const map = new Map();
    arr.forEach(item => map.set(item, true));
    return [...map.keys()];
  }
}, 100);

// 输出示例:
// 📊 性能对比: 数组去重
// ═══════════════════════════════════════════════════════════
// 1. Set 去重: 2.34ms (🏆 最快)
// 2. Map 去重: 4.12ms (比最快慢 0.8x)
// 3. filter + indexOf: 45.67ms (比最快慢 18.5x)
// ═══════════════════════════════════════════════════════════
```

---

## 十四、综合实战：高性能数据仪表盘

```js
/**
 * 高性能数据仪表盘
 * 整合：Web Workers + 虚拟列表 + 懒加载 + 防抖节流 + 内存管理 + 性能监控
 */
class PerformanceDashboard {
  constructor(container, options = {}) {
    this.container = container;
    this.workerPool = null;
    this.virtualList = null;
    this.monitor = null;
    this.destroyed = false;

    this._init(container, options);
  }

  async _init(container, options) {
    // 1. 启动性能监控
    this.monitor = new PerformanceMonitor({ reportUrl: '/api/metrics' });

    // 2. 创建 Worker 池（数据处理）
    this.workerPool = new WorkerPool('/workers/data-process.js', 2);

    // 3. 创建虚拟列表（大数据渲染）
    this.virtualList = new VirtualList(container, {
      itemHeight: 80,
      bufferSize: 3
    });

    // 4. 节流滚动加载
    this._onScroll = this._throttle(async () => {
      if (this.virtualList.isNearBottom()) {
        await this._loadMoreData();
      }
    }, 100);

    this.virtualList.container.addEventListener('scroll', this._onScroll);

    // 5. 防抖搜索
    this._onSearch = this._debounce(async (query) => {
      const results = await this.workerPool.submit({ type: 'SEARCH', query });
      this.virtualList.updateData(results);
    }, 300);

    // 6. 初始加载
    await this._loadMoreData();
  }

  async _loadMoreData() {
    if (this.destroyed) return;

    // 使用 Worker 并行处理数据
    const chunk1 = this.workerPool.submit({ type: 'FETCH', page: this.currentPage });
    const chunk2 = this.workerPool.submit({ type: 'AGGREGATE', page: this.currentPage });

    const [rawData, aggregated] = await Promise.all([chunk1, chunk2]);

    // 只保留需要的字段（减少内存）
    const processed = rawData.map(item => ({
      id: item.id,
      title: item.title,
      value: item.value,
      thumbnail: item.thumbnail
    }));

    this.virtualList.appendData(processed);
    this.currentPage++;
  }

  search(query) {
    this._onSearch(query);
  }

  // 节流
  _throttle(fn, delay) {
    let lastTime = 0;
    return (...args) => {
      if (Date.now() - lastTime >= delay) {
        lastTime = Date.now();
        fn.apply(this, args);
      }
    };
  }

  // 防抖
  _debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // 完整清理
  destroy() {
    this.destroyed = true;

    // 清理 Worker 池
    if (this.workerPool) this.workerPool.destroy();

    // 清理虚拟列表
    if (this.virtualList) this.virtualList.destroy();

    // 清理性能监控
    if (this.monitor) this.monitor.destroy();

    // 清理引用
    this.container = null;
  }
}
```

---

## 十五、性能优化决策树

```
页面加载慢？
├─ 首屏白屏时间长？
│  ├─ TTFB > 800ms → 服务端优化（CDN、缓存、SSR）
│  ├─ JS 体积大？ → Tree Shaking + Code Splitting
│  └─ 渲染阻塞？ → 内联关键 CSS、defer/async JS
│
├─ 首屏内容加载慢？
│  ├─ 图片多？ → WebP/AVIF + 懒加载 + srcset
│  ├─ 字体加载慢？ → preload + font-display: swap
│  └─ 第三方脚本？ → 延迟加载 / Web Worker
│
├─ 交互卡顿？
│  ├─ 输入延迟？ → 防抖 + 减少主线程任务
│  ├─ 滚动卡顿？ → 节流 + CSS contain + GPU 加速
│  └─ 动画掉帧？ → rAF + transform/opacity + will-change
│
├─ 内存增长？
│  ├─ SPA 路由切换后增长？ → 检查监听器/定时器清理
│  ├─ 列表滚动后增长？ → 虚拟列表 + 对象池
│  └─ 长时间运行增长？ → WeakMap/WeakRef + LRU Cache
│
└─ Bundle 太大？
   ├─ vendor 占比高？ → 拆分 vendor + CDN
   ├─ 重复依赖？ → dedupe + resolutions
   └─ 未使用代码？ → Tree Shaking + 动态 import
```

---

## 十六、性能优化速查表（完整版）

```
┌─────────────────────────────────────────────────────────────┐
│                    性能优化分层模型                          │
├──────────┬──────────────────────────────────────────────────┤
│  网络层   │ CDN · HTTP/2 · 连接复用 · 压缩(Brotli)         │
│          │ Service Worker · 缓存策略 · 预连接/预加载         │
├──────────┼──────────────────────────────────────────────────┤
│  资源层   │ Bundle 分割 · Tree Shaking · 代码懒加载         │
│          │ 图片格式(WebP/AVIF) · 响应式图片 · 字体优化      │
├──────────┼──────────────────────────────────────────────────┤
│  渲染层   │ 关键渲染路径 · CSS Contain · GPU 加速           │
│          │ 虚拟列表 · DocumentFragment · 读写分离           │
│          │ will-change · rAF · IntersectionObserver         │
├──────────┼──────────────────────────────────────────────────┤
│  JS 层   │ Web Workers · 防抖节流 · 分片处理               │
│          │ 对象池 · 懒加载组件 · 事件委托                   │
├──────────┼──────────────────────────────────────────────────┤
│  内存层   │ 清理监听器/定时器 · LRU Cache · WeakMap/WeakRef │
│          │ 避免闭包泄漏 · DOM 引用管理 · Worker 清理        │
├──────────┼──────────────────────────────────────────────────┤
│  监控层   │ Core Web Vitals · PerformanceObserver           │
│          │ 长任务监控 · 错误监控 · RUM 上报                 │
└──────────┴──────────────────────────────────────────────────┘

优化收益排序（从高到低）:
1. Service Worker 缓存        → TTFB ↓ 70%+
2. 图片 WebP/AVIF             → 体积 ↓ 30-50%
3. 代码分割 + Tree Shaking    → Bundle ↓ 40-60%
4. 虚拟列表                   → DOM 节点 ↓ 95%+
5. Web Workers                → 主线程阻塞 ↓ 90%+
6. 懒加载                     → 首屏体积 ↓ 30-50%
7. 防抖节流                   → 请求/计算 ↓ 70%+
8. CSS Contain                → Layout 范围 ↓ 80%+
9. 内存管理                   → 内存泄漏 → 0
10. preload/preconnect        → 资源加载 ↑ 200-500ms
```

---

**累计覆盖专项（5/11 更新）：**
- 算法与数据结构 (04-28 ~ 05-11)
- JavaScript 深度 (05-10 ~ 05-11)
- 设计模式 10 个 (观察者/策略/单例/工厂/代理/装饰器/适配器/模板方法/建造者/命令)
- 源码精读 6 个 (Vue3 响应式/Patch/Hooks/Fiber/Lane/Scheduler)
- **Web 性能优化** ← 基础篇(5/10) + 进阶篇(5/11)
  - 基础：懒加载 / 防抖节流 / 内存管理
  - 进阶：渲染管线 / Web Workers / 资源提示 / Bundle 优化 / Service Worker / 图片优化 / 性能监控
