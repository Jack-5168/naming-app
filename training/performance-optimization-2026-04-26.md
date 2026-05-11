# Web 性能优化 — 综合实战 (2026-04-26 05:00)

**前置基础：**
- 4/24 基础版：懒加载 / 防抖节流 / 内存管理 / 虚拟列表
- 4/25 进阶版：CRP / Web Vitals / 重排优化 / 网络层

**本次重点：** 将三种核心技术整合到一个真实场景——**高性能数据看板 (Performance Dashboard)**，从零到一构建，每步标注性能考量。

---

## 一、场景：高性能数据看板

### 1.1 需求分析

一个企业级数据看板，包含：
- 顶部：KPI 卡片（4 个关键指标）
- 中部：实时折线图 + 饼图（WebSocket 推送更新）
- 底部：数据表格（10,000+ 行，支持搜索/排序/分页）
- 右侧：通知面板（滚动加载历史消息）

**性能挑战：**
1. 图表库体积大（~500KB），不应阻塞首屏
2. 10,000 行表格不能一次性渲染
3. WebSocket 高频推送不能阻塞主线程
4. 搜索/排序/滚动事件需要防抖/节流
5. 长时间运行不能内存泄漏

---

## 二、懒加载实战

### 2.1 模块级懒加载 — 按需加载图表库

```javascript
/**
 * 模块懒加载管理器
 * 核心思路：首屏只加载 KPI 卡片，图表模块在用户可见时加载
 */
class ModuleLoader {
  constructor() {
    this.modules = new Map(); // 缓存已加载模块
    this.observers = new Map(); // 缓存 IntersectionObserver
  }

  /**
   * 注册一个需要懒加载的模块
   * @param {string} id - 模块唯一标识
   * @param {string} containerId - 容器 DOM id
   * @param {Function} importFn - 动态 import 函数
   * @param {Object} options - { rootMargin, threshold, placeholder }
   */
  register(id, containerId, importFn, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 显示占位符
    if (options.placeholder) {
      container.innerHTML = options.placeholder;
    }

    const observer = new IntersectionObserver(
      async (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.unobserve(entry.target);
            await this.loadModule(id, importFn, container);
          }
        }
      },
      {
        rootMargin: options.rootMargin || '200px 0px', // 提前 200px 开始加载
        threshold: options.threshold || 0.01,
      }
    );

    observer.observe(container);
    this.observers.set(id, observer);
  }

  /**
   * 加载模块并渲染
   */
  async loadModule(id, importFn, container) {
    // 检查缓存
    if (this.modules.has(id)) {
      const module = this.modules.get(id);
      module.render(container);
      return;
    }

    try {
      // 显示加载中
      container.classList.add('loading');

      const module = await importFn();
      this.modules.set(id, module);

      // 渲染
      module.render(container);
      container.classList.remove('loading');
      container.classList.add('loaded');

      console.log(`[ModuleLoader] ${id} 加载完成`);
    } catch (err) {
      console.error(`[ModuleLoader] ${id} 加载失败:`, err);
      container.classList.remove('loading');
      container.classList.add('error');
      container.innerHTML = `<div class="error-message">加载失败，<button onclick="retryLoad('${id}')">重试</button></div>`;
    }
  }

  /**
   * 预加载 — 用户鼠标悬停在标签页上时提前加载
   */
  preload(id, importFn) {
    if (this.modules.has(id)) return;
    importFn().then(module => this.modules.set(id, module));
  }

  /**
   * 清理
   */
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.modules.clear();
  }
}

// ============ 使用示例 ============

const loader = new ModuleLoader();

// 注册折线图模块（进入视口时加载）
loader.register(
  'line-chart',
  'chart-container',
  () => import('./charts/LineChart.js'),
  {
    placeholder: '<div class="skeleton">图表加载中...</div>',
    rootMargin: '300px 0px',
  }
);

// 注册饼图模块
loader.register(
  'pie-chart',
  'pie-container',
  () => import('./charts/PieChart.js'),
  { placeholder: '<div class="skeleton">饼图加载中...</div>' }
);

// 预加载 — 用户鼠标悬停在"详情"标签时
document.querySelector('[data-tab="details"]')
  .addEventListener('mouseenter', () => {
    loader.preload('detail-panel', () => import('./panels/DetailPanel.js'));
  }, { once: true });
```

### 2.2 图片懒加载 — 带占位图 + 渐进式加载

```javascript
/**
 * 高级图片懒加载
 * 特性：占位图 → 低清预览 → 高清图片 → 平滑过渡
 */
class ProgressiveImageLoader {
  constructor(options = {}) {
    this.defaultOptions = {
      rootMargin: '100px',
      threshold: 0.01,
      placeholderClass: 'img-placeholder',
      loadedClass: 'img-loaded',
      errorClass: 'img-error',
      blurClass: 'img-blur',
    };
    this.options = { ...this.defaultOptions, ...options };
    this.observer = null;
    this.stats = { loaded: 0, errors: 0, skipped: 0 };
  }

  init() {
    if (!('IntersectionObserver' in window)) {
      // 降级：直接加载所有图片
      document.querySelectorAll('img[data-src]').forEach(img => this.loadImage(img));
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => this.handleEntries(entries),
      {
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold,
      }
    );

    // 观察所有懒加载图片
    document.querySelectorAll('img[data-src]').forEach(img => {
      this.setupPlaceholder(img);
      this.observer.observe(img);
    });
  }

  /**
   * 设置占位图（低清模糊预览）
   */
  setupPlaceholder(img) {
    const placeholder = img.dataset.placeholder;
    if (placeholder) {
      img.src = placeholder;
      img.classList.add(this.options.blurClass);
    } else {
      img.classList.add(this.options.placeholderClass);
    }
  }

  handleEntries(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        this.observer.unobserve(img);
        this.loadImage(img);
      }
    });
  }

  loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;

    const image = new Image();

    image.onload = () => {
      img.src = src;
      img.classList.remove(this.options.blurClass, this.options.placeholderClass);
      img.classList.add(this.options.loadedClass);
      this.stats.loaded++;
    };

    image.onerror = () => {
      img.classList.remove(this.options.blurClass);
      img.classList.add(this.options.errorClass);
      this.stats.errors++;

      // 尝试加载降级图片
      const fallback = img.dataset.fallback;
      if (fallback) {
        img.src = fallback;
      }
    };

    image.src = src;
  }

  /**
   * 动态添加新图片（用于无限滚动场景）
   */
  addImage(img) {
    this.setupPlaceholder(img);
    if (this.observer) {
      this.observer.observe(img);
    } else {
      this.loadImage(img);
    }
  }

  getStats() {
    return { ...this.stats };
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// ============ 使用示例 ============

const imageLoader = new ProgressiveImageLoader({
  rootMargin: '150px',
});

// HTML 结构：
// <img data-src="/high-res.jpg" 
//      data-placeholder="/blurhash.jpg" 
//      data-fallback="/fallback.jpg" 
//      alt="产品图片">

imageLoader.init();
```

---

## 三、防抖与节流实战

### 3.1 统一的事件优化工具

```javascript
/**
 * 统一事件优化工具
 * 集成防抖、节流、requestAnimationFrame 三种策略
 */
class EventOptimizer {
  constructor() {
    this.timers = new Map();
    this.rafIds = new Map();
    this.lastExec = new Map();
  }

  /**
   * 防抖 — 等待操作停止后执行
   * 适用：搜索输入、窗口 resize、表单验证
   */
  debounce(fn, delay, options = {}) {
    const { leading = false, maxWait = null, key = fn.name || Symbol() } = options;
    const timerKey = `debounce:${key}`;
    const maxWaitTimerKey = `maxwait:${key}`;

    const debounced = (...args) => {
      const context = this;
      const now = Date.now();

      // leading 执行
      if (leading && !this.timers.has(timerKey)) {
        fn.apply(this, args);
      }

      // 清除旧定时器
      if (this.timers.has(timerKey)) {
        clearTimeout(this.timers.get(timerKey));
      }

      // maxWait 保证 — 即使持续触发，也会在 maxWait 后执行
      if (maxWait) {
        if (!this.lastExec.has(maxWaitTimerKey)) {
          this.lastExec.set(maxWaitTimerKey, now);
        }

        const elapsed = now - this.lastExec.get(maxWaitTimerKey);
        if (elapsed >= maxWait && !leading) {
          fn.apply(this, args);
          this.lastExec.set(maxWaitTimerKey, now);
          if (this.timers.has(timerKey)) {
            clearTimeout(this.timers.get(timerKey));
            this.timers.delete(timerKey);
          }
          return;
        }
      }

      // 设置新定时器
      const timer = setTimeout(() => {
        if (!leading) fn.apply(context, args);
        context.timers.delete(timerKey);
        context.lastExec.delete(maxWaitTimerKey);
      }, delay);

      this.timers.set(timerKey, timer);
    };

    // 取消方法
    debounced.cancel = () => {
      if (this.timers.has(timerKey)) {
        clearTimeout(this.timers.get(timerKey));
        this.timers.delete(timerKey);
      }
      this.lastExec.delete(maxWaitTimerKey);
    };

    // 立即执行
    debounced.flush = () => {
      debounced.cancel();
      fn.apply(this, []);
    };

    return debounced;
  }

  /**
   * 节流 — 限制执行频率
   * 适用：滚动监听、鼠标移动、按钮防重复点击
   */
  throttle(fn, wait, options = {}) {
    const { leading = true, trailing = true, key = fn.name || Symbol() } = options;
    const timerKey = `throttle:${key}`;

    const throttled = (...args) => {
      const now = Date.now();
      const lastExecTime = this.lastExec.get(timerKey) || 0;
      const remaining = wait - (now - lastExecTime);

      if (remaining <= 0 || remaining > wait) {
        // 可以执行
        if (leading) {
          fn.apply(this, args);
          this.lastExec.set(timerKey, now);
        }
        // 清除 trailing 定时器
        if (this.timers.has(timerKey)) {
          clearTimeout(this.timers.get(timerKey));
          this.timers.delete(timerKey);
        }
      } else if (trailing && !this.timers.has(timerKey)) {
        // 设置 trailing 定时器
        const timer = setTimeout(() => {
          if (leading) {
            fn.apply(this, args);
          } else {
            const execNow = Date.now();
            fn.apply(this, args);
            this.lastExec.set(timerKey, execNow);
          }
          this.timers.delete(timerKey);
        }, remaining);
        this.timers.set(timerKey, timer);
      }
    };

    throttled.cancel = () => {
      if (this.timers.has(timerKey)) {
        clearTimeout(this.timers.get(timerKey));
        this.timers.delete(timerKey);
      }
      this.lastExec.delete(timerKey);
    };

    return throttled;
  }

  /**
   * rAF 节流 — 与浏览器刷新率同步
   * 适用：DOM 动画、滚动位置读取、视觉更新
   * 优势：避免布局抖动，保证 60fps
   */
  rafThrottle(fn, key = fn.name || Symbol()) {
    const rafKey = `raf:${key}`;

    const rafThrottled = (...args) => {
      if (this.rafIds.has(rafKey)) return; // 已有待执行的 rAF

      const rafId = requestAnimationFrame(() => {
        fn.apply(this, args);
        this.rafIds.delete(rafKey);
      });

      this.rafIds.set(rafKey, rafId);
    };

    rafThrottled.cancel = () => {
      if (this.rafIds.has(rafKey)) {
        cancelAnimationFrame(this.rafIds.get(rafKey));
        this.rafIds.delete(rafKey);
      }
    };

    return rafThrottled;
  }

  /**
   * 全局清理
   */
  destroy() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.rafIds.forEach(id => cancelAnimationFrame(id));
    this.rafIds.clear();
    this.lastExec.clear();
  }
}

// ============ 使用示例 ============

const optimizer = new EventOptimizer();

// 1. 搜索框 — 防抖 300ms，最长等待 2s
const handleSearch = optimizer.debounce(
  (query) => fetch(`/api/search?q=${query}`).then(r => r.json()),
  300,
  { maxWait: 2000 }
);

document.querySelector('#search-input')
  .addEventListener('input', (e) => handleSearch(e.target.value));

// 2. 滚动加载 — 节流 100ms
const handleScroll = optimizer.throttle(
  () => {
    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    if (scrollTop + windowHeight >= docHeight - 300) {
      loadMoreData();
    }
  },
  100
);

window.addEventListener('scroll', handleScroll);

// 3. 滚动条进度指示 — rAF 节流（视觉更新）
const updateProgressBar = optimizer.rafThrottle(
  () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (scrollTop / docHeight) * 100;
    document.querySelector('.progress-bar').style.width = `${progress}%`;
  }
);

window.addEventListener('scroll', updateProgressBar);

// 4. 窗口 resize — 防抖 250ms
const handleResize = optimizer.debounce(
  () => recalculateLayout(),
  250
);

window.addEventListener('resize', handleResize);

// 5. 按钮防重复提交 — 节流 1s
const handleSubmit = optimizer.throttle(
  () => submitForm(),
  1000,
  { leading: true, trailing: false }
);

document.querySelector('#submit-btn')
  .addEventListener('click', handleSubmit);
```

---

## 四、内存管理实战

### 4.1 完整生命周期管理

```javascript
/**
 * 可销毁的组件基类
 * 确保所有资源在组件销毁时正确释放
 */
class DisposableComponent {
  constructor() {
    this._disposables = [];
    this._isDestroyed = false;
  }

  /**
   * 注册一个需要清理的资源
   */
  registerDisposable(cleanupFn) {
    this._disposables.push(cleanupFn);
  }

  /**
   * 注册事件监听器（自动清理）
   */
  addEventListener(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this.registerDisposable(() => {
      target.removeEventListener(event, handler, options);
    });
  }

  /**
   * 注册定时器（自动清理）
   */
  setInterval(fn, delay) {
    const id = setInterval(fn, delay);
    this.registerDisposable(() => clearInterval(id));
    return id;
  }

  setTimeout(fn, delay) {
    const id = setTimeout(() => {
      fn();
      // 自动从 disposables 移除（已完成）
    }, delay);
    this.registerDisposable(() => clearTimeout(id));
    return id;
  }

  /**
   * 注册 IntersectionObserver（自动清理）
   */
  createObserver(callback, options) {
    const observer = new IntersectionObserver(callback, options);
    this.registerDisposable(() => observer.disconnect());
    return observer;
  }

  /**
   * 注册 WebSocket（自动清理）
   */
  createWebSocket(url) {
    const ws = new WebSocket(url);
    this.registerDisposable(() => {
      if (ws.readyState <= 1) {
        ws.close(1000, 'Component destroyed');
      }
    });
    return ws;
  }

  /**
   * 注册 AbortController（自动清理）
   */
  createAbortController() {
    const controller = new AbortController();
    this.registerDisposable(() => controller.abort());
    return controller;
  }

  /**
   * 销毁 — 释放所有资源
   */
  destroy() {
    if (this._isDestroyed) return;
    this._isDestroyed = true;

    // 逆序执行清理（后注册先清理）
    while (this._disposables.length > 0) {
      const cleanup = this._disposables.pop();
      try {
        cleanup();
      } catch (err) {
        console.error('[DisposableComponent] 清理失败:', err);
      }
    }

    // 调用子类自定义清理
    if (typeof this.onDispose === 'function') {
      this.onDispose();
    }
  }
}

// ============ 使用示例：数据看板组件 ============

class DashboardComponent extends DisposableComponent {
  constructor(containerId) {
    super();
    this.container = document.getElementById(containerId);
    this.ws = null;
    this.chart = null;
    this.dataCache = new Map(); // 使用 Map 而非数组，方便按 key 清理

    this.init();
  }

  async init() {
    // 1. 创建 WebSocket 连接（自动管理生命周期）
    this.ws = this.createWebSocket('wss://api.example.com/realtime');

    // 2. 注册 WebSocket 事件（自动移除）
    this.addEventListener(this.ws, 'message', (event) => {
      const data = JSON.parse(event.data);
      this.handleRealtimeData(data);
    });

    this.addEventListener(this.ws, 'close', () => {
      console.log('[Dashboard] WebSocket 已关闭');
    });

    // 3. 创建 AbortController（组件销毁时自动取消进行中的请求）
    const controller = this.createAbortController();

    // 4. 加载初始数据
    try {
      const response = await fetch('/api/dashboard/initial', {
        signal: controller.signal,
      });
      const data = await response.json();
      this.renderKPI(data.kpi);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[Dashboard] 加载失败:', err);
      }
    }

    // 5. 注册滚动监听（自动清理）
    const handleScroll = this.throttle((e) => {
      this.updateScrollIndicator();
    }, 100);
    this.addEventListener(window, 'scroll', handleScroll);

    // 6. 注册定时器（自动清理）
    this.setInterval(() => {
      this.refreshKPI();
    }, 30000); // 每 30 秒刷新 KPI

    // 7. 使用 WeakMap 缓存计算结果（不阻止 GC）
    this._computationCache = new WeakMap();
  }

  handleRealtimeData(data) {
    // 使用 WeakMap 缓存 — 数据对象被 GC 时自动清理缓存
    if (this._computationCache.has(data)) {
      return this._computationCache.get(data);
    }

    const processed = this.processData(data);
    this._computationCache.set(data, processed);

    this.updateChart(processed);
  }

  /**
   * 子类自定义清理
   */
  onDispose() {
    // 清理图表实例
    if (this.chart && typeof this.chart.destroy === 'function') {
      this.chart.destroy();
    }

    // 清空数据缓存
    this.dataCache.clear();
    this.dataCache = null;

    // 清空 WeakMap 引用（不需要手动清理，但显式置 null 更好）
    this._computationCache = null;
  }
}

// ============ 使用 ============

const dashboard = new DashboardComponent('dashboard');

// 页面切换时销毁
document.querySelector('[data-nav="settings"]')
  .addEventListener('click', () => {
    dashboard.destroy(); // 自动释放所有资源
  });
```

### 4.2 虚拟列表 — 10,000 行表格优化

```javascript
/**
 * 虚拟列表 — 只渲染可见区域的 DOM 节点
 * 10,000 行数据 → 只渲染 ~20 个 DOM 节点
 */
class VirtualList {
  constructor(container, options = {}) {
    this.container = container;
    this.items = [];
    this.itemHeight = options.itemHeight || 50;
    this.bufferSize = options.bufferSize || 5; // 上下缓冲条数
    this.visibleCount = 0;
    this.startIndex = 0;
    this.endIndex = 0;

    // DOM 元素
    this.scrollContainer = null;
    this.contentContainer = null;
    this.itemPool = []; // 元素池 — 复用 DOM 节点

    this.init();
  }

  init() {
    // 创建滚动容器
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.style.cssText = `
      overflow: auto;
      height: ${this.container.offsetHeight || 600}px;
      position: relative;
    `;

    // 创建内容容器（高度 = 总行数 × 行高）
    this.contentContainer = document.createElement('div');
    this.contentContainer.style.position = 'relative';

    this.scrollContainer.appendChild(this.contentContainer);
    this.container.innerHTML = '';
    this.container.appendChild(this.scrollContainer);

    // 滚动事件 — rAF 节流
    this.scrollContainer.addEventListener('scroll', this.rafThrottle(() => {
      this.render();
    }));
  }

  /**
   * 设置数据
   */
  setData(items) {
    this.items = items;
    this.visibleCount = Math.ceil(
      this.scrollContainer.offsetHeight / this.itemHeight
    );

    // 更新内容容器总高度
    this.contentContainer.style.height = `${items.length * this.itemHeight}px`;

    this.render();
  }

  /**
   * 渲染可见区域
   */
  render() {
    const scrollTop = this.scrollContainer.scrollTop;

    // 计算可见范围
    this.startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
    this.endIndex = Math.min(
      this.items.length - 1,
      Math.ceil((scrollTop + this.scrollContainer.offsetHeight) / this.itemHeight) + this.bufferSize
    );

    const visibleItems = this.items.slice(this.startIndex, this.endIndex + 1);

    // 复用 DOM 节点（对象池模式）
    this.updateItemPool(visibleItems);
  }

  /**
   * 更新元素池 — 复用而非创建/销毁
   */
  updateItemPool(visibleItems) {
    const needed = visibleItems.length;
    const current = this.itemPool.length;

    // 需要更多元素
    if (needed > current) {
      for (let i = current; i < needed; i++) {
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.right = '0';
        el.style.height = `${this.itemHeight}px`;
        this.contentContainer.appendChild(el);
        this.itemPool.push(el);
      }
    }
    // 元素过多 — 隐藏多余元素（不销毁，保留在池中）
    else if (needed < current) {
      for (let i = needed; i < current; i++) {
        this.itemPool[i].style.display = 'none';
      }
    }

    // 更新可见元素的位置和内容
    for (let i = 0; i < needed; i++) {
      const el = this.itemPool[i];
      const item = visibleItems[i];

      el.style.display = 'block';
      el.style.top = `${(this.startIndex + i) * this.itemHeight}px`;
      el.innerHTML = this.renderItem(item);
    }
  }

  /**
   * 渲染单行 — 子类重写
   */
  renderItem(item) {
    return `<div class="list-item">${JSON.stringify(item)}</div>`;
  }

  /**
   * rAF 节流
   */
  rafThrottle(fn) {
    let ticking = false;
    return (...args) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        fn.apply(this, args);
        ticking = false;
      });
    };
  }

  /**
   * 销毁
   */
  destroy() {
    this.items = null;
    this.itemPool.forEach(el => el.remove());
    this.itemPool = [];
    this.scrollContainer = null;
    this.contentContainer = null;
  }
}

// ============ 使用示例 ============

// 生成 10,000 条测试数据
const mockData = Array.from({ length: 10000 }, (_, i) => ({
  id: i + 1,
  name: `产品 ${i + 1}`,
  price: (Math.random() * 1000).toFixed(2),
  category: ['电子', '服装', '食品', '家居'][i % 4],
  status: ['上架', '下架', '预售'][i % 3],
}));

const list = new VirtualList(document.getElementById('table-container'), {
  itemHeight: 48,
  bufferSize: 3,
});

list.setData(mockData);
```

---

## 五、综合实战 — 三合一性能优化

### 5.1 完整的高性能数据看板

```javascript
/**
 * 高性能数据看板 — 整合懒加载 + 防抖节流 + 内存管理
 * 
 * 性能指标目标：
 * - 首屏 LCP < 1.5s（只加载 KPI，图表懒加载）
 * - 交互响应 < 16ms（rAF 节流滚动，防抖搜索）
 * - 内存稳定（DisposableComponent + WeakMap + 虚拟列表）
 * - 长时间运行无泄漏（自动清理所有资源）
 */
class PerformanceDashboard extends DisposableComponent {
  constructor(containerId) {
    super();
    this.container = document.getElementById(containerId);
    this.state = {
      kpi: null,
      chartData: [],
      tableData: [],
      searchQuery: '',
      currentPage: 1,
      pageSize: 20,
    };

    // 性能监控
    this.perfMarks = [];

    this.init();
  }

  async init() {
    this.mark('init-start');

    // ===== 1. 首屏：只渲染 KPI 卡片 =====
    this.renderSkeleton();

    // 使用 AbortController 管理 fetch 生命周期
    const controller = this.createAbortController();

    try {
      const [kpiRes, tableRes] = await Promise.all([
        fetch('/api/dashboard/kpi', { signal: controller.signal }),
        fetch(`/api/dashboard/table?page=1&limit=${this.state.pageSize}`, {
          signal: controller.signal,
        }),
      ]);

      this.state.kpi = await kpiRes.json();
      const tableData = await tableRes.json();
      this.state.tableData = tableData.data;

      this.renderKPI(this.state.kpi);
      this.renderTable(tableData);

      this.mark('initial-data-loaded');
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.renderError('数据加载失败');
      }
    }

    // ===== 2. 图表模块 — 懒加载 =====
    this.initLazyCharts();

    // ===== 3. 搜索 — 防抖 =====
    this.initSearch();

    // ===== 4. 滚动 — 节流 + rAF =====
    this.initScrollHandling();

    // ===== 5. WebSocket 实时更新 =====
    this.initWebSocket();

    // ===== 6. 性能监控 =====
    this.initPerformanceMonitoring();

    this.mark('init-complete');
    this.reportPerf();
  }

  // ---------- 懒加载图表 ----------

  initLazyCharts() {
    const chartContainer = document.getElementById('chart-area');
    if (!chartContainer) return;

    // 显示骨架屏
    chartContainer.innerHTML = `
      <div class="skeleton-chart">
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line" style="width: 70%"></div>
      </div>
    `;

    // IntersectionObserver 懒加载
    const observer = this.createObserver(
      async (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.mark('chart-load-start');
            observer.unobserve(entry.target);

            try {
              const { LineChart, PieChart } = await import('./charts/index.js');

              // 折线图
              const lineChart = new LineChart(
                document.getElementById('line-chart-canvas'),
                { data: this.state.chartData }
              );

              // 饼图
              const pieChart = new PieChart(
                document.getElementById('pie-chart-canvas'),
                { data: this.state.kpi?.categories || [] }
              );

              this.registerDisposable(() => {
                lineChart.destroy?.();
                pieChart.destroy?.();
              });

              this.mark('chart-load-complete');
            } catch (err) {
              chartContainer.innerHTML = '<div class="error">图表加载失败</div>';
            }
          }
        }
      },
      { rootMargin: '200px', threshold: 0.01 }
    );

    observer.observe(chartContainer);
  }

  // ---------- 搜索防抖 ----------

  initSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    // 防抖搜索 — 300ms 延迟，最长 2s 强制执行
    const handleSearch = this.debounce(
      async (query) => {
        this.mark('search-start');

        try {
          const controller = this.createAbortController();
          const res = await fetch(
            `/api/dashboard/table?search=${encodeURIComponent(query)}&page=1`,
            { signal: controller.signal }
          );
          const data = await res.json();
          this.state.tableData = data.data;
          this.state.searchQuery = query;
          this.renderTable(data);

          this.mark('search-complete');
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('搜索失败:', err);
          }
        }
      },
      300,
      { maxWait: 2000 }
    );

    this.addEventListener(searchInput, 'input', (e) => {
      handleSearch(e.target.value);
    });
  }

  // ---------- 滚动处理 ----------

  initScrollHandling() {
    // 滚动加载更多 — 节流 100ms
    const handleScroll = this.throttle(() => {
      const scrollTop = this.scrollContainer?.scrollTop || window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      if (scrollTop + windowHeight >= docHeight - 500) {
        this.loadMoreData();
      }
    }, 100);

    this.addEventListener(window, 'scroll', handleScroll);

    // 进度条更新 — rAF 节流
    const updateProgress = this.rafThrottle(() => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      const bar = document.querySelector('.scroll-progress');
      if (bar) bar.style.width = `${progress}%`;
    });

    this.addEventListener(window, 'scroll', updateProgress);
  }

  // ---------- WebSocket 实时更新 ----------

  initWebSocket() {
    this.ws = this.createWebSocket('wss://api.example.com/dashboard');

    this.addEventListener(this.ws, 'message', (event) => {
      const data = JSON.parse(event.data);

      // 使用 WeakMap 缓存处理结果
      if (!this._dataCache) {
        this._dataCache = new WeakMap();
      }

      if (this._dataCache.has(data)) {
        return; // 已处理过
      }

      const processed = this.processRealtimeData(data);
      this._dataCache.set(data, processed);

      // 更新图表
      this.updateChartData(processed);
    });

    // 断线重连 — 指数退避
    this.addEventListener(this.ws, 'close', () => {
      this.reconnect(1);
    });
  }

  reconnect(attempt) {
    const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 30000);

    this.setTimeout(() => {
      console.log(`[Dashboard] 重连尝试 ${attempt}, 延迟 ${delay}ms`);
      this.ws = this.createWebSocket('wss://api.example.com/dashboard');
      // 重新注册事件...
    }, delay);
  }

  // ---------- 性能监控 ----------

  mark(name) {
    const entry = { name, time: performance.now(), timestamp: Date.now() };
    this.perfMarks.push(entry);
    performance.mark(`dashboard:${name}`);
  }

  reportPerf() {
    const marks = this.perfMarks;
    if (marks.length < 2) return;

    const initTime = marks.find(m => m.name === 'init-complete')?.time || 0;
    const startTime = marks.find(m => m.name === 'init-start')?.time || 0;

    console.log('[Dashboard] 性能报告:');
    console.log(`  初始化耗时: ${(initTime - startTime).toFixed(2)}ms`);

    for (let i = 1; i < marks.length; i++) {
      const delta = marks[i].time - marks[i - 1].time;
      console.log(`  ${marks[i - 1].name} → ${marks[i].name}: ${delta.toFixed(2)}ms`);
    }
  }

  initPerformanceMonitoring() {
    // Web Vitals 监控
    if ('PerformanceObserver' in window) {
      // LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        console.log(`[Dashboard] LCP: ${last.startTime.toFixed(0)}ms`);
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      // CLS
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) clsValue += entry.value;
        }
        console.log(`[Dashboard] CLS: ${clsValue.toFixed(4)}`);
      }).observe({ type: 'layout-shift', buffered: true });
    }

    // 内存监控
    this.setInterval(() => {
      if (performance.memory) {
        const { usedJSHeapSize, totalJSHeapSize } = performance.memory;
        const pct = (usedJSHeapSize / totalJSHeapSize * 100).toFixed(1);
        if (pct > 80) {
          console.warn(`[Dashboard] ⚠️ 内存使用率 ${pct}%`);
        }
      }
    }, 10000);
  }

  // ---------- rAF 节流工具 ----------
  rafThrottle(fn) {
    let ticking = false;
    const wrapped = (...args) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        fn.apply(this, args);
        ticking = false;
      });
    };
    wrapped.cancel = () => { ticking = false; };
    return wrapped;
  }

  // ---------- 防抖工具 ----------
  debounce(fn, delay, options = {}) {
    const { maxWait = null } = options;
    let timer = null;
    let maxWaitTimer = null;
    let lastExec = 0;

    const debounced = (...args) => {
      const now = Date.now();

      if (maxWait && now - lastExec >= maxWait) {
        fn.apply(this, args);
        lastExec = now;
        if (timer) clearTimeout(timer);
        if (maxWaitTimer) clearTimeout(maxWaitTimer);
        return;
      }

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fn.apply(this, args);
        lastExec = Date.now();
        timer = null;
      }, delay);

      if (maxWait && !maxWaitTimer) {
        maxWaitTimer = setTimeout(() => {
          fn.apply(this, args);
          lastExec = Date.now();
          maxWaitTimer = null;
          if (timer) clearTimeout(timer);
        }, maxWait);
      }
    };

    debounced.cancel = () => {
      if (timer) clearTimeout(timer);
      if (maxWaitTimer) clearTimeout(maxWaitTimer);
      timer = maxWaitTimer = null;
    };

    return debounced;
  }

  // ---------- 节流工具 ----------
  throttle(fn, wait) {
    let timer = null;
    let lastExec = 0;

    const throttled = (...args) => {
      const now = Date.now();
      const remaining = wait - (now - lastExec);

      if (remaining <= 0 || remaining > wait) {
        fn.apply(this, args);
        lastExec = now;
      } else if (!timer) {
        timer = setTimeout(() => {
          fn.apply(this, args);
          lastExec = Date.now();
          timer = null;
        }, remaining);
      }
    };

    throttled.cancel = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    return throttled;
  }

  // ---------- 渲染方法 ----------

  renderSkeleton() {
    this.container.innerHTML = `
      <div class="dashboard">
        <div class="kpi-grid">
          ${[1, 2, 3, 4].map(i => `
            <div class="kpi-card skeleton">
              <div class="skeleton skeleton-line" style="width: 60%"></div>
              <div class="skeleton skeleton-value" style="width: 40%"></div>
            </div>
          `).join('')}
        </div>
        <div id="chart-area" class="chart-area">
          <div class="skeleton skeleton-chart"></div>
        </div>
        <div id="table-container" class="table-container">
          <div class="skeleton skeleton-table"></div>
        </div>
      </div>
    `;
  }

  renderKPI(kpi) {
    // 渲染 KPI 卡片...
  }

  renderTable(data) {
    // 使用虚拟列表渲染表格...
  }

  // ---------- 自定义清理 ----------
  onDispose() {
    this.perfMarks = [];
    if (this._dataCache) this._dataCache = null;
    console.log('[Dashboard] 已销毁，所有资源已释放');
  }
}

// ============ 使用 ============

const dashboard = new PerformanceDashboard('#app');

// 路由切换时自动清理
window.addEventListener('beforeunload', () => {
  dashboard.destroy();
});
```

---

## 六、性能优化速查表

### 懒加载策略

| 场景 | 方案 | 触发时机 |
|------|------|----------|
| 图片 | `loading="lazy"` / IntersectionObserver | 进入视口前 100-200px |
| 路由组件 | `React.lazy` / `defineAsyncComponent` | 路由匹配时 |
| 重型模块 | 动态 `import()` + IntersectionObserver | 容器进入视口时 |
| 预加载 | `mouseenter` 监听 + `import()` | 用户悬停在链接上时 |

### 防抖 vs 节流选择

| 场景 | 策略 | 原因 |
|------|------|------|
| 搜索输入 | 防抖 300ms | 等用户停止输入再请求 |
| 窗口 resize | 防抖 250ms | 等用户停止调整再重排 |
| 滚动加载 | 节流 100ms | 持续触发但限制频率 |
| 鼠标追踪 | rAF 节流 | 与刷新率同步，避免抖动 |
| 按钮防重复 | 节流 1s | 限制点击频率 |
| 表单验证 | 防抖 500ms | 等输入完成再验证 |

### 内存管理清单

| 资源类型 | 泄漏原因 | 正确清理方式 |
|----------|----------|-------------|
| 定时器 | 组件卸载后仍在运行 | `clearInterval`/`clearTimeout` |
| 事件监听 | 元素移除后监听器仍在 | `removeEventListener` |
| WebSocket | 连接未关闭 | `ws.close()` |
| DOM 引用 | 数组持有已移除元素引用 | 只存储数据不存储 DOM |
| 闭包 | 持有不需要的大对象 | 减少闭包捕获范围 |
| fetch 请求 | 组件卸载后仍在进行 | `AbortController.abort()` |
| 图表实例 | 未调用 destroy | `chart.destroy()` |
| Observer | 未 disconnect | `observer.disconnect()` |

---

## 七、关键要点总结

### 懒加载核心原则
1. **首屏只加载关键内容** — KPI 卡片、骨架屏
2. **非关键模块延迟加载** — 图表、详情面板
3. **提前预判用户意图** — hover 预加载
4. **占位体验要好** — 骨架屏 > 空白 > loading 动画

### 防抖节流核心原则
1. **防抖 = 等一等** — 适合"最终结果"场景（搜索、resize）
2. **节流 = 限制频率** — 适合"持续过程"场景（滚动、mousemove）
3. **rAF 节流 = 视觉同步** — 适合 DOM 更新、动画
4. **maxWait 是安全网** — 防抖 + maxWait 保证不会无限延迟

### 内存管理核心原则
1. **谁创建谁销毁** — DisposableComponent 模式
2. **WeakMap 缓存** — 不阻止 GC，自动清理
3. **AbortController** — 组件卸载时取消进行中的请求
4. **虚拟列表** — 10,000 行只渲染 20 个 DOM 节点
5. **定期监控内存** — `performance.memory` 检查使用率

---

**训练完成时间:** 2026-04-26 05:00  
**本次产出:** 1 个完整的高性能数据看板示例，整合懒加载 + 防抖节流 + 内存管理  
**累计性能优化训练:** 4/24 (基础) + 4/25 (进阶) + 4/26 (综合实战) = 完整体系
