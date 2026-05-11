# Web 性能优化 — 生产级 Toolkit + 高级模式 (2026-04-28 05:00)

**前置基础：**
- 4/24 基础版：懒加载 / 防抖节流 / 内存管理 / 虚拟列表
- 4/25 进阶版：CRP / Web Vitals / 重排优化 / 网络层
- 4/26 综合实战：三合一整合 — 高性能数据看板
- 4/27 回顾巩固：查漏补缺 + SSR/Canvas/SW 扩展

**本次重点：** 生产级性能 Toolkit（可复用库）+ 高级模式 + 性能基准测试

---

## 一、生产级性能 Toolkit — 可复用库设计

### 1.1 LazyLoader — 万能懒加载引擎

```javascript
/**
 * LazyLoader — 基于 IntersectionObserver 的万能懒加载引擎
 * 
 * 特性:
 * - 图片懒加载 (img + background-image)
 * - 组件懒加载 (动态 import)
 * - 视频懒加载 (播放时才加载源)
 * - iframe 懒加载
 * - 自定义触发条件
 * - 加载失败重试
 * - 占位符/骨架屏支持
 * - 预加载 (preload) 机制
 */
class LazyLoader {
  constructor(options = {}) {
    this.options = {
      root: options.root || null,
      rootMargin: options.rootMargin || '50px 0px',
      threshold: options.threshold || 0.01,
      preloadThreshold: options.preloadThreshold || 200, // px 提前加载
      retry: options.retry ?? 3,
      retryDelay: options.retryDelay || 1000,
      placeholder: options.placeholder || null,
      skeleton: options.skeleton || null,
      onLoad: options.onLoad || null,
      onError: options.onError || null,
      onPreload: options.onPreload || null,
    };

    this.observers = new Map(); // element → observer
    this.loadedElements = new WeakSet(); // 已加载元素
    this.failedElements = new Map(); // element → retryCount
    this.preloadObservers = new Map(); // 预加载观察者

    this._init();
  }

  _init() {
    if (!('IntersectionObserver' in window)) {
      console.warn('LazyLoader: IntersectionObserver not supported, loading all elements');
      this._fallbackLoad();
      return;
    }
  }

  _fallbackLoad() {
    document.querySelectorAll('[data-lazy]').forEach(el => this._loadElement(el));
  }

  /**
   * 观察元素 — 核心方法
   */
  observe(selectorOrElement, loadFn) {
    const elements = typeof selectorOrElement === 'string'
      ? document.querySelectorAll(selectorOrElement)
      : [selectorOrElement];

    elements.forEach(el => {
      if (this.loadedElements.has(el)) return;

      // 设置占位符
      if (this.options.skeleton && !el.dataset.skeletonApplied) {
        el.classList.add('lazy-skeleton');
        el.dataset.skeletonApplied = 'true';
      }

      // 预加载观察者 (更远的观察距离)
      const preloadObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && this.options.onPreload) {
            this.options.onPreload(el);
            preloadObserver.unobserve(el);
          }
        });
      }, {
        root: this.options.root,
        rootMargin: `${this.options.preloadThreshold}px`,
        threshold: 0,
      });

      // 正式加载观察者
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this._loadElement(el, loadFn);
            observer.unobserve(el);
            preloadObserver.unobserve(el);
          }
        });
      }, {
        root: this.options.root,
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold,
      });

      observer.observe(el);
      preloadObserver.observe(el);
      this.observers.set(el, { observer, preloadObserver, loadFn });
    });

    return this; // 链式调用
  }

  async _loadElement(el, loadFn) {
    if (this.loadedElements.has(el)) return;

    try {
      await loadFn(el);
      this.loadedElements.add(el);
      this.failedElements.delete(el);
      el.classList.remove('lazy-skeleton');
      el.classList.add('lazy-loaded');
      this.options.onLoad?.(el);
    } catch (err) {
      this._handleError(el, loadFn, err);
    }
  }

  async _handleError(el, loadFn, err) {
    const count = (this.failedElements.get(el) || 0) + 1;
    this.failedElements.set(el, count);

    if (count <= this.options.retry) {
      const delay = this.options.retryDelay * count; // 递增延迟
      console.warn(`LazyLoader: Retry ${count}/${this.options.retry} after ${delay}ms`, err);
      await new Promise(r => setTimeout(r, delay));
      this._loadElement(el, loadFn);
    } else {
      el.classList.add('lazy-error');
      this.options.onError?.(el, err);
      this.failedElements.delete(el);
    }
  }

  /**
   * 图片懒加载
   */
  observeImages(selector) {
    return this.observe(selector, async (el) => {
      const src = el.dataset.src || el.dataset.lazySrc;
      const srcset = el.dataset.srcset;

      if (!src && !srcset) return;

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (srcset) el.srcset = srcset;
          if (src) el.src = src;
          // 清除 data 属性
          el.removeAttribute('data-src');
          el.removeAttribute('data-srcset');
          resolve();
        };
        img.onerror = reject;
        if (srcset) img.srcset = srcset;
        if (src) img.src = src;
      });
    });
  }

  /**
   * 背景图片懒加载
   */
  observeBackgrounds(selector) {
    return this.observe(selector, async (el) => {
      const bg = el.dataset.lazyBg;
      if (!bg) return;
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          el.style.backgroundImage = `url(${bg})`;
          el.removeAttribute('data-lazy-bg');
          resolve();
        };
        img.onerror = reject;
        img.src = bg;
      });
    });
  }

  /**
   * 组件懒加载 (动态 import)
   */
  observeComponent(selector, importFn) {
    return this.observe(selector, async (el) => {
      const Component = await importFn();
      if (typeof Component === 'function') {
        Component(el);
      } else if (Component.default && typeof Component.default === 'function') {
        Component.default(el);
      }
    });
  }

  /**
   * 视频懒加载
   */
  observeVideos(selector) {
    return this.observe(selector, async (el) => {
      const sources = el.querySelectorAll('source[data-src]');
      sources.forEach(source => {
        source.src = source.dataset.src;
        source.removeAttribute('data-src');
      });
      if (el.dataset.poster) {
        el.poster = el.dataset.poster;
      }
      el.load();
    });
  }

  /**
   * iframe 懒加载
   */
  observeIframes(selector) {
    return this.observe(selector, async (el) => {
      const src = el.dataset.src;
      if (!src) return;
      el.src = src;
      el.removeAttribute('data-src');
    });
  }

  /**
   * 手动触发加载 (立即加载指定元素)
   */
  eagerLoad(selectorOrElement) {
    const elements = typeof selectorOrElement === 'string'
      ? document.querySelectorAll(selectorOrElement)
      : [selectorOrElement];

    elements.forEach(el => {
      const data = this.observers.get(el);
      if (data) {
        data.observer.unobserve(el);
        data.preloadObserver.unobserve(el);
        this._loadElement(el, data.loadFn);
      } else if (!this.loadedElements.has(el)) {
        // 未观察过的元素，直接加载
        const loadFn = el.dataset.lazySrc ? () => {
          el.src = el.dataset.lazySrc;
          el.removeAttribute('data-lazy-src');
        } : null;
        if (loadFn) this._loadElement(el, loadFn);
      }
    });
  }

  /**
   * 销毁 — 清理所有观察者
   */
  destroy() {
    this.observers.forEach(({ observer, preloadObserver }) => {
      observer.disconnect();
      preloadObserver.disconnect();
    });
    this.observers.clear();
    this.preloadObservers.clear();
  }
}

// === 使用示例 ===
const lazy = new LazyLoader({
  rootMargin: '100px 0px',
  preloadThreshold: 300,
  retry: 2,
  skeleton: true,
  onLoad: (el) => console.log('Loaded:', el.tagName),
  onError: (el, err) => console.error('Failed:', el, err),
});

// 图片懒加载
lazy.observeImages('.lazy-image');

// 背景图懒加载
lazy.observeBackgrounds('.lazy-bg');

// 组件懒加载
lazy.observeComponent('.lazy-chart', () => import('./ChartComponent'));

// iframe 懒加载
lazy.observeIframes('.lazy-iframe');

// 视频懒加载
lazy.observeVideos('.lazy-video');

// 手动立即加载
lazy.eagerLoad('.above-fold-image');

// CSS 骨架屏
const css = `
.lazy-skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
}
@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.lazy-loaded { animation: fade-in 0.3s ease; }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
`;
```

### 1.2 SmartScheduler — 智能任务调度器

```javascript
/**
 * SmartScheduler — 基于 requestIdleCallback + requestAnimationFrame 的智能调度
 * 
 * 解决长任务阻塞主线程问题
 * 优先级: 用户交互 > 动画 > 数据计算 > 后台任务
 */
class SmartScheduler {
  constructor(options = {}) {
    this.queue = {
      critical: [],   // 关键任务 (用户交互) — 立即执行
      high: [],       // 高优先级 (动画帧) — rAF
      normal: [],     // 普通任务 — rIC
      low: [],        // 低优先级 (后台) — rIC + 低优先级
    };
    this.running = false;
    this.maxFrameTime = options.maxFrameTime || 16; // ms, 一帧的时间
    this.yieldInterval = options.yieldInterval || 5; // ms, 每 N ms 让出控制权
    this.onTaskError = options.onTaskError || console.error;
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      droppedTasks: 0,
      avgWaitTime: 0,
      _waitTimes: [],
    };
  }

  /**
   * 添加任务
   * @param {Function} fn - 任务函数
   * @param {Object} options - { priority, timeout, deadline, name }
   * @returns {Promise} 任务完成时 resolve
   */
  schedule(fn, options = {}) {
    const {
      priority = 'normal',
      timeout = 5000,
      deadline = null,
      name = 'anonymous',
    } = options;

    return new Promise((resolve, reject) => {
      const task = {
        fn,
        resolve,
        reject,
        name,
        priority,
        enqueuedAt: performance.now(),
        timeout,
        deadline,
        remaining: null, // 用于分块执行
      };

      if (this.queue[priority]) {
        this.queue[priority].push(task);
      } else {
        this.queue.normal.push(task);
      }

      this.metrics.totalTasks++;
      this._startProcessing();
    });
  }

  _startProcessing() {
    if (this.running) return;
    this.running = true;
    this._process();
  }

  _process() {
    // 优先级: critical > high > normal > low
    const priorityOrder = ['critical', 'high', 'normal', 'low'];

    for (const priority of priorityOrder) {
      if (this.queue[priority].length > 0) {
        if (priority === 'critical') {
          this._processCritical();
        } else if (priority === 'high') {
          requestAnimationFrame(() => this._processByPriority('high'));
        } else {
          this._processByPriority(priority);
        }
        return;
      }
    }

    this.running = false;
  }

  _processCritical() {
    const task = this.queue.critical.shift();
    if (!task) {
      this._process();
      return;
    }
    this._execute(task);
  }

  _processByPriority(priority) {
    const scheduler = priority === 'high'
      ? (cb) => requestAnimationFrame(cb)
      : (cb) => this._requestIdleCallback(cb);

    scheduler(() => {
      if (this.queue[priority].length === 0) {
        this._process();
        return;
      }
      const task = this.queue[priority].shift();
      if (task) this._execute(task);
      this._process();
    });
  }

  _requestIdleCallback(cb) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(cb, { timeout: 2000 });
    } else {
      // fallback: setTimeout
      const start = performance.now();
      setTimeout(() => cb({
        timeRemaining: () => Math.max(0, 50 - (performance.now() - start)),
        didTimeout: false,
      }), 0);
    }
  }

  async _execute(task) {
    const startTime = performance.now();

    // 超时处理
    const timeoutId = setTimeout(() => {
      task.reject(new Error(`Task "${task.name}" timed out after ${task.timeout}ms`));
    }, task.timeout);

    try {
      const result = await task.fn();
      clearTimeout(timeoutId);

      const waitTime = startTime - task.enqueuedAt;
      this.metrics.completedTasks++;
      this.metrics._waitTimes.push(waitTime);
      this.metrics.avgWaitTime = this.metrics._waitTimes.reduce((a, b) => a + b, 0)
        / this.metrics._waitTimes.length;

      task.resolve(result);
    } catch (err) {
      clearTimeout(timeoutId);
      this.onTaskError(err, task);
      task.reject(err);
    }
  }

  /**
   * 分块执行 — 将大任务拆分为小块
   */
  chunked(items, processFn, options = {}) {
    const {
      chunkSize = 100,
      onProgress = null,
      priority = 'normal',
    } = options;

    return this.schedule(async () => {
      const results = [];
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const chunkResults = chunk.map(processFn);
        results.push(...chunkResults);
        onProgress?.({
          progress: (i + chunk.length) / items.length,
          processed: i + chunk.length,
          total: items.length,
        });
        // 每处理完一个 chunk 让出控制权
        if (i + chunkSize < items.length) {
          await new Promise(r => this._requestIdleCallback(r));
        }
      }
      return results;
    }, { priority, timeout: 60000 });
  }

  /**
   * 性能指标
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueLengths: {
        critical: this.queue.critical.length,
        high: this.queue.high.length,
        normal: this.queue.normal.length,
        low: this.queue.low.length,
      },
    };
  }
}

// === 使用示例 ===
const scheduler = new SmartScheduler();

// 关键任务 — 用户点击响应
scheduler.schedule(() => {
  document.getElementById('result').textContent = 'Computed!';
}, { priority: 'critical', name: 'update-result' });

// 高优先级 — 动画帧
scheduler.schedule(() => {
  element.style.transform = `translateX(${x}px)`;
}, { priority: 'high', name: 'animation-frame' });

// 普通任务 — 数据计算
scheduler.schedule(async () => {
  const data = await fetchData();
  return processData(data);
}, { priority: 'normal', name: 'data-processing' });

// 低优先级 — 后台日志
scheduler.schedule(() => {
  sendAnalytics('page-view');
}, { priority: 'low', name: 'analytics' });

// 分块处理大数据
const largeArray = Array.from({ length: 100000 }, (_, i) => i);
scheduler.chunked(largeArray, (item) => item * 2, {
  chunkSize: 500,
  onProgress: ({ progress }) => console.log(`${(progress * 100).toFixed(0)}%`),
}).then(results => console.log('Done:', results.length));
```

### 1.3 DebounceThrottle — 生产级防抖节流库

```javascript
/**
 * DebounceThrottle — 生产级防抖/节流工具库
 * 
 * 特性:
 * - 防抖 (debounce): leading/trailing/both 模式
 * - 节流 (throttle): leading/trailing/both 模式
 * - 自动取消 (autoCancel)
 * - 参数/返回值透传
 * - 立即执行 (flush)
 * - 状态查询 (isPending/isThrottled)
 * - 批量防抖 (batchDebounce)
 * - 动画帧节流 (rAF throttle)
 */

// === 防抖 — 完整实现 ===
function createDebounce(fn, wait = 300, options = {}) {
  const {
    leading = false,    // 前缘触发
    trailing = true,    // 后缘触发 (默认)
    maxWait = null,     // 最大等待时间
    errorHandler = null, // 错误处理
  } = options;

  if (leading && !trailing) {
    // leading=true, trailing=false → 第一次立即执行
    wait = Math.max(wait, 0);
  }

  let timer = null;
  let maxTimer = null;
  let lastArgs = null;
  let lastThis = null;
  let lastCallTime = 0;
  let lastResult = undefined;
  let invokeCount = 0;

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;
    lastArgs = null;
    lastThis = null;
    invokeCount++;
    try {
      lastResult = fn.apply(thisArg, args);
      return lastResult;
    } catch (err) {
      if (errorHandler) errorHandler(err);
      else throw err;
    }
  }

  function startTimer(pendingFunc, ms) {
    return setTimeout(pendingFunc, ms);
  }

  function cancelTimer(id) {
    if (id !== null) {
      clearTimeout(id);
      id = null;
    }
  }

  function leadingEdge(time) {
    lastCallTime = time;
    timer = startTimer(timerExpired, wait);
    // maxWait 检查
    if (maxWait !== null) {
      maxTimer = startTimer(maxTimerExpired, maxWait);
    }
    return invokeFunc(time);
  }

  function remainingWait(time) {
    return wait - (time - lastCallTime);
  }

  function timerExpired() {
    const time = performance.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timer = startTimer(timerExpired, remainingWait(time));
  }

  function maxTimerExpired() {
    const time = performance.now();
    if (lastThis !== null) {
      return trailingEdge(time);
    }
    maxTimer = null;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    // 首次调用
    if (lastCallTime === 0) return true;
    // 超过等待时间
    if (timeSinceLastCall >= wait) return true;
    // maxWait 超时
    if (maxWait !== null && timeSinceLastCall >= maxWait) return true;
    return false;
  }

  function trailingEdge(time) {
    timer = null;
    if (maxTimer !== null) {
      cancelTimer(maxTimer);
      maxTimer = null;
    }
    if (trailing && lastThis !== null) {
      return invokeFunc(time);
    }
    lastArgs = null;
    lastThis = null;
    return lastResult;
  }

  function cancel() {
    if (timer !== null) cancelTimer(timer);
    if (maxTimer !== null) cancelTimer(maxTimer);
    lastCallTime = 0;
    lastArgs = null;
    lastThis = null;
    timer = null;
    maxTimer = null;
  }

  function flush() {
    if (timer === null) return lastResult;
    const time = performance.now();
    return trailingEdge(time);
  }

  function pending() {
    return timer !== null || maxTimer !== null;
  }

  function debounced(...args) {
    const time = performance.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;

    if (isInvoking) {
      if (timer === null) {
        // 首次调用
        if (leading) {
          return leadingEdge(time);
        }
        // 非 leading → 设置 timer 等 trailing
        timer = startTimer(timerExpired, wait);
        if (maxWait !== null) {
          maxTimer = startTimer(maxTimerExpired, maxWait);
        }
      } else if (maxWait !== null) {
        // 已有 timer 但有 maxWait → 重置 maxTimer
        cancelTimer(maxTimer);
        maxTimer = startTimer(maxTimerExpired, maxWait);
      }
      return lastResult;
    }

    // 不触发 → 重置 timer
    if (timer === null) {
      timer = startTimer(timerExpired, wait);
    }
    if (maxWait !== null && maxTimer === null) {
      maxTimer = startTimer(maxTimerExpired, maxWait);
    }

    return lastResult;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.pending = pending;
  debounced.getMetrics = () => ({ invokeCount, pending: pending() });

  return debounced;
}

// === 节流 — 完整实现 ===
function createThrottle(fn, wait = 300, options = {}) {
  const {
    leading = true,     // 前缘触发 (默认)
    trailing = true,    // 后缘触发 (默认)
    errorHandler = null,
  } = options;

  // throttle = debounce + maxWait === wait
  const debounced = createDebounce(fn, wait, {
    leading,
    trailing,
    maxWait: wait,
    errorHandler,
  });

  // 额外方法
  debounced.isThrottled = debounced.pending;

  return debounced;
}

// === requestAnimationFrame 节流 — 动画专用 ===
function createRAFThrottle(fn) {
  let rafId = null;
  let lastArgs = null;
  let lastThis = null;
  let isRunning = false;

  function rafCallback() {
    isRunning = true;
    fn.apply(lastThis, lastArgs);
    isRunning = false;
    rafId = null;
    lastArgs = null;
    lastThis = null;
  }

  function throttled(...args) {
    lastArgs = args;
    lastThis = this;

    if (!rafId && !isRunning) {
      rafId = requestAnimationFrame(rafCallback);
    }
  }

  throttled.cancel = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  throttled.isRunning = () => rafId !== null || isRunning;

  return throttled;
}

// === 批量防抖 — 合并多次调用为一次批量处理 ===
function createBatchDebounce(fn, wait = 100, options = {}) {
  const { maxSize = 1000 } = options;
  let batch = [];
  let timer = null;

  function flush() {
    if (batch.length === 0) return;
    const items = [...batch];
    batch = [];
    clearTimeout(timer);
    timer = null;
    fn(items);
  }

  function add(item) {
    batch.push(item);
    if (batch.length >= maxSize) {
      flush();
    } else if (!timer) {
      timer = setTimeout(flush, wait);
    }
  }

  add.flush = flush;
  add.cancel = () => {
    clearTimeout(timer);
    timer = null;
    batch = [];
  };
  add.size = () => batch.length;

  return add;
}

// === 使用示例 ===

// 搜索框防抖 (leading + trailing)
const search = createDebounce(async (query) => {
  const results = await fetch(`/api/search?q=${query}`);
  renderResults(results);
}, 300, { leading: false, trailing: true, maxWait: 2000 });

input.addEventListener('input', (e) => search(e.target.value));

// 滚动事件节流
const onScroll = createThrottle((e) => {
  updateScrollIndicator(window.scrollY);
  checkLazyLoad();
}, 100, { leading: true, trailing: true });

window.addEventListener('scroll', onScroll, { passive: true });

// 动画帧节流 (resize)
const onResize = createRAFThrottle(() => {
  recalculateLayout();
  updateCharts();
});

window.addEventListener('resize', onResize);

// 日志批量上报
const logBatch = createBatchDebounce((logs) => {
  navigator.sendBeacon('/api/logs', JSON.stringify(logs));
}, 5000, { maxSize: 500 });

function log(level, message) {
  logBatch({ level, message, timestamp: Date.now() });
}

// 取消/刷新
search.cancel();      // 取消待执行的防抖
search.flush();       // 立即执行
onScroll.cancel();    // 取消节流
logBatch.flush();     // 立即上报
```

### 1.4 MemoryGuard — 内存管理工具

```javascript
/**
 * MemoryGuard — 内存管理与泄漏检测工具
 * 
 * 特性:
 * - 自动清理定时器/监听器
 * - 内存使用监控
 * - 泄漏检测 (DOM 节点/事件监听器/闭包)
 * - WeakRef 缓存管理
 * - 资源池 (对象复用)
 * - 内存快照对比
 */
class MemoryGuard {
  constructor() {
    this.cleanups = new Map(); // id → cleanupFn
    this.listeners = new Map(); // element → [{event, handler, options}]
    this.timers = new Set();
    this.rafIds = new Set();
    this.observers = new Set();
    this._leakReport = [];
  }

  // === 事件监听器管理 ===

  /**
   * 安全添加监听器 — 自动追踪，支持批量清理
   */
  addListener(element, event, handler, options) {
    if (!element.addEventListener) return;

    const key = this._getElementKey(element);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }

    const listener = { event, handler, options };
    this.listeners.get(key).push(listener);
    element.addEventListener(event, handler, options);
  }

  /**
   * 移除指定元素的所有监听器
   */
  removeListeners(element) {
    const key = this._getElementKey(element);
    const listeners = this.listeners.get(key);
    if (!listeners) return;

    listeners.forEach(({ event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this.listeners.delete(key);
  }

  _getElementKey(el) {
    if (!el._memoryGuardId) {
      el._memoryGuardId = `mg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    return el._memoryGuardId;
  }

  // === 定时器管理 ===

  /**
   * 安全设置定时器
   */
  setTimeout(fn, delay, ...args) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn(...args);
    }, delay);
    this.timers.add(id);
    return id;
  }

  /**
   * 安全设置间隔定时器
   */
  setInterval(fn, delay, ...args) {
    const id = setInterval(fn, delay, ...args);
    this.timers.add(id);
    return id;
  }

  /**
   * 安全设置 rAF
   */
  requestAnimationFrame(fn) {
    const id = requestAnimationFrame((...args) => {
      this.rafIds.delete(id);
      fn(...args);
    });
    this.rafIds.add(id);
    return id;
  }

  /**
   * 清理所有定时器
   */
  clearAllTimers() {
    this.timers.forEach(id => clearTimeout(id));
    this.timers.forEach(id => clearInterval(id));
    this.timers.clear();
    this.rafIds.forEach(id => cancelAnimationFrame(id));
    this.rafIds.clear();
  }

  // === Observer 管理 ===

  /**
   * 安全创建 Observer (IntersectionObserver/MutationObserver/ResizeObserver)
   */
  createObserver(ObserverClass, callback) {
    const observer = new ObserverClass(callback);
    this.observers.add(observer);
    return observer;
  }

  /**
   * 断开所有 Observer
   */
  disconnectAllObservers() {
    this.observers.forEach(obs => obs.disconnect());
    this.observers.clear();
  }

  // === 注册清理函数 ===

  registerCleanup(id, cleanupFn) {
    this.cleanups.set(id, cleanupFn);
  }

  unregisterCleanup(id) {
    this.cleanups.delete(id);
  }

  // === 全局清理 ===

  cleanup() {
    // 清理监听器
    this.listeners.forEach((listeners, key) => {
      // 注意：这里无法获取原始 element，需要外部传入
    });
    this.listeners.clear();

    // 清理定时器
    this.clearAllTimers();

    // 清理 Observer
    this.disconnectAllObservers();

    // 执行注册清理函数
    this.cleanups.forEach((fn, id) => {
      try { fn(); } catch (e) { console.error(`Cleanup "${id}" failed:`, e); }
    });
    this.cleanups.clear();
  }

  // === 内存监控 ===

  /**
   * 获取当前内存使用 (Chrome DevTools 环境)
   */
  getMemoryInfo() {
    if (performance.memory) {
      return {
        usedJSHeapSize: this._formatBytes(performance.memory.usedJSHeapSize),
        totalJSHeapSize: this._formatBytes(performance.memory.totalJSHeapSize),
        jsHeapSizeLimit: this._formatBytes(performance.memory.jsHeapSizeLimit),
        usedPercent: ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(2) + '%',
      };
    }
    return { note: 'performance.memory not available (use Chrome)' };
  }

  _formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /**
   * 内存趋势监控
   */
  startMonitoring(interval = 5000) {
    const history = [];
    const monitorId = this.setInterval(() => {
      if (performance.memory) {
        history.push({
          time: Date.now(),
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
        });
        // 保留最近 120 个数据点 (10 分钟)
        if (history.length > 120) history.shift();
      }
    }, interval);

    return {
      getHistory: () => history,
      getTrend: () => {
        if (history.length < 2) return 'insufficient data';
        const first = history[0].used;
        const last = history[history.length - 1].used;
        const change = ((last - first) / first * 100).toFixed(2);
        return change > 10 ? `⚠️ Growing (+${change}%)` : change < -10 ? `📉 Shrinking (${change}%)` : `✅ Stable (${change}%)`;
      },
      stop: () => {
        clearTimeout(monitorId);
        clearInterval(monitorId);
      },
    };
  }
}

// === WeakRef 缓存管理 ===
class WeakCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 100;
    this.cleanupInterval = options.cleanupInterval || 60000;
    this._finalizers = new FinalizationRegistry((key) => {
      this.cache.delete(key);
    });

    // 定期清理
    if (this.cleanupInterval > 0) {
      this._cleanupTimer = setInterval(() => this._cleanup(), this.cleanupInterval);
    }
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    const value = entry.deref();
    if (!value) {
      this.cache.delete(key);
      return undefined;
    }
    return value;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      // 清除最旧的条目
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, new WeakRef(value));
    this._finalizers.register(value, key);
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  _cleanup() {
    // 触发 GC (开发环境)
    if (globalThis.gc) globalThis.gc();
  }

  get size() {
    return this.cache.size;
  }

  destroy() {
    if (this._cleanupTimer) clearInterval(this._cleanupTimer);
    this.cache.clear();
  }
}

// === 对象池 — 减少 GC 压力 ===
class ObjectPool {
  constructor(options = {}) {
    this.factory = options.factory;
    this.reset = options.reset;
    this.pool = [];
    this.inUse = new Set();
    this.maxSize = options.maxSize || 50;
    this.stats = { created: 0, reused: 0, discarded: 0 };
  }

  acquire() {
    let obj;
    if (this.pool.length > 0) {
      obj = this.pool.pop();
      this.stats.reused++;
    } else {
      obj = this.factory();
      this.stats.created++;
    }
    this.inUse.add(obj);
    return obj;
  }

  release(obj) {
    if (!this.inUse.has(obj)) return;
    this.inUse.delete(obj);

    if (this.pool.length < this.maxSize) {
      if (this.reset) this.reset(obj);
      this.pool.push(obj);
    } else {
      this.stats.discarded++;
    }
  }

  releaseAll(objects) {
    objects.forEach(obj => this.release(obj));
  }

  getStats() {
    return {
      ...this.stats,
      poolSize: this.pool.length,
      inUseSize: this.inUse.size,
      hitRate: this.stats.created + this.stats.reused > 0
        ? (this.stats.reused / (this.stats.created + this.stats.reused) * 100).toFixed(1) + '%'
        : '0%',
    };
  }
}

// === 使用示例 ===
const guard = new MemoryGuard();

// 组件生命周期管理
class MyComponent {
  constructor(el) {
    this.el = el;
    this.guard = new MemoryGuard();

    // 自动追踪
    this.guard.addListener(el, 'click', this.handleClick);
    this.guard.addListener(el, 'mouseover', this.handleHover);
    this.guard.addListener(window, 'resize', this.handleResize);

    // Observer 自动追踪
    this.observer = this.guard.createObserver(IntersectionObserver, (entries) => {
      entries.forEach(entry => this._onVisible(entry));
    });
    this.observer.observe(el);

    // 定时器自动追踪
    this.guard.setInterval(() => this._update(), 5000);
  }

  destroy() {
    this.guard.cleanup();
  }
}

// WeakRef 缓存
const componentCache = new WeakCache({ maxSize: 50 });
function getOrCreateComponent(id) {
  let comp = componentCache.get(id);
  if (!comp) {
    comp = new MyComponent(document.getElementById(id));
    componentCache.set(id, comp);
  }
  return comp;
}

// 对象池 — Canvas 绘图
const pathPool = new ObjectPool({
  factory: () => new Path2D(),
  reset: (path) => { /* Path2D 不可复用，直接丢弃 */ },
  maxSize: 20,
});

// 内存监控
const monitor = guard.startMonitoring(3000);
// 5 分钟后查看趋势
setTimeout(() => {
  console.log('Memory trend:', monitor.getTrend());
  console.log('Memory info:', guard.getMemoryInfo());
}, 300000);
```

---

## 二、高级模式 — 实战场景

### 2.1 虚拟滚动增强版 — 动态高度 + 双向滚动

```javascript
/**
 * VirtualScroller — 支持动态高度的虚拟滚动
 * 
 * 特性:
 * - 动态行高 (自动测量 + 缓存)
 * - 双向滚动 (上/下)
 * - 平滑滚动恢复
 * - 预渲染缓冲区
 * - 滚动位置保持
 */
class VirtualScroller {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 50;
    this.bufferSize = options.bufferSize || 5; // 缓冲区行数
    this.overscan = options.overscan || 3; // 额外渲染行数
    this.onRender = options.onRender || null;
    this.onRangeChange = options.onRangeChange || null;

    this.items = [];
    this.heights = new Map(); // index → measured height
    this.positions = []; // index → { top, height, bottom }
    this.scrollTop = 0;
    this.containerHeight = 0;
    this.totalHeight = 0;
    this.startIndex = 0;
    this.endIndex = 0;
    this.lastScrollTop = 0;
    this.isScrolling = false;
    this.scrollTimer = null;

    this._spacerTop = null;
    this._spacerBottom = null;
    this._content = null;
    this._rafId = null;

    this._init();
  }

  _init() {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';

    // 创建结构
    this._spacerTop = document.createElement('div');
    this._spacerBottom = document.createElement('div');
    this._content = document.createElement('div');

    this._content.style.position = 'absolute';
    this._content.style.left = '0';
    this._content.style.right = '0';
    this._content.style.top = '0';

    this.container.appendChild(this._spacerTop);
    this.container.appendChild(this._content);
    this.container.appendChild(this._spacerBottom);

    // 滚动事件 (rAF 节流)
    this.container.addEventListener('scroll', () => {
      if (this._rafId) return;
      this._rafId = requestAnimationFrame(() => {
        this._onScroll();
        this._rafId = null;
      });
    }, { passive: true });

    // ResizeObserver
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => this._onResize());
      ro.observe(this.container);
    }
  }

  setData(items) {
    this.items = items;
    this.positions = [];
    this.heights.clear();
    this._calculatePositions();
    this._updateViewport();
  }

  _calculatePositions() {
    let top = 0;
    this.positions = this.items.map((item, index) => {
      const height = this.heights.get(index) || this.itemHeight;
      const pos = { top, height, bottom: top + height };
      top += height;
      return pos;
    });
    this.totalHeight = top;
  }

  _onScroll() {
    this.scrollTop = this.container.scrollTop;
    this.isScrolling = true;

    clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      this.isScrolling = false;
    }, 150);

    this._updateViewport();
  }

  _onResize() {
    this.containerHeight = this.container.clientHeight;
    this._updateViewport();
  }

  _updateViewport() {
    this.containerHeight = this.container.clientHeight;

    // 二分查找可见范围
    const start = this._findStartIndex(this.scrollTop);
    const end = this._findEndIndex(start);

    // 添加缓冲区
    const bufferStart = Math.max(0, start - this.bufferSize - this.overscan);
    const bufferEnd = Math.min(this.items.length - 1, end + this.bufferSize + this.overscan);

    // 范围未变化 → 只更新位置
    if (start === this.startIndex && end === this.endIndex) {
      this._updatePositions(bufferStart, bufferEnd);
      return;
    }

    this.startIndex = start;
    this.endIndex = end;

    // 更新 spacer
    const firstPos = this.positions[bufferStart];
    const lastPos = this.positions[bufferEnd];
    this._spacerTop.style.height = `${firstPos.top}px`;
    this._spacerBottom.style.height = `${this.totalHeight - lastPos.bottom}px`;

    // 渲染可见项
    this._renderItems(bufferStart, bufferEnd);
    this.onRangeChange?.({ start, end, bufferStart, bufferEnd });
  }

  _findStartIndex(scrollTop) {
    // 二分查找
    let lo = 0, hi = this.items.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const pos = this.positions[mid];
      if (pos.top <= scrollTop && pos.bottom > scrollTop) return mid;
      if (pos.top > scrollTop) hi = mid - 1;
      else lo = mid + 1;
    }
    return 0;
  }

  _findEndIndex(startIndex) {
    let index = startIndex;
    const bottom = this.scrollTop + this.containerHeight;
    while (index < this.items.length && this.positions[index].bottom < bottom) {
      index++;
    }
    return Math.min(index, this.items.length - 1);
  }

  _renderItems(start, end) {
    // 复用 DOM 节点
    const existing = this._content.children;
    const needed = end - start + 1;
    const existingCount = existing.length;

    // 移除多余的
    while (existingCount > needed) {
      this._content.removeChild(existing[existingCount - 1]);
    }

    // 更新/创建
    for (let i = start; i <= end; i++) {
      const idx = i - start;
      let el = existing[idx];

      if (!el) {
        el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.right = '0';
        this._content.appendChild(el);
      }

      const pos = this.positions[i];
      el.style.top = `${pos.top - this.positions[start].top}px`;
      el.style.height = `${pos.height}px`;
      el.style.transform = `translateY(0)`; // 触发 GPU 加速

      // 渲染内容
      this.onRender?.(el, this.items[i], i);
    }
  }

  _updatePositions(start, end) {
    const existing = this._content.children;
    for (let i = start; i <= end; i++) {
      const idx = i - start;
      const el = existing[idx];
      if (el) {
        const pos = this.positions[i];
        el.style.top = `${pos.top - this.positions[start].top}px`;
        el.style.height = `${pos.height}px`;
      }
    }
  }

  /**
   * 测量元素高度并更新布局
   */
  measureHeight(index, element) {
    const height = element.offsetHeight;
    if (this.heights.get(index) !== height) {
      this.heights.set(index, height);
      this._calculatePositions();
      this._updateViewport();
    }
  }

  /**
   * 滚动到指定索引
   */
  scrollToIndex(index, behavior = 'auto') {
    const pos = this.positions[index];
    if (!pos) return;
    this.container.scrollTo({
      top: pos.top,
      behavior,
    });
  }

  /**
   * 获取可见范围
   */
  getVisibleRange() {
    return { start: this.startIndex, end: this.endIndex };
  }

  destroy() {
    this._content.innerHTML = '';
    this.items = [];
    this.positions = [];
    this.heights.clear();
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }
}

// === 使用示例 ===
const scroller = new VirtualScroller(document.getElementById('list'), {
  itemHeight: 60,
  bufferSize: 3,
  overscan: 2,
  onRender: (el, item, index) => {
    el.innerHTML = `
      <div class="item">
        <img src="${item.avatar}" alt="" loading="lazy">
        <span>${item.name}</span>
        <span class="desc">${item.description}</span>
      </div>
    `;
    // 动态高度测量
    requestIdleCallback(() => {
      scroller.measureHeight(index, el);
    });
  },
  onRangeChange: ({ start, end }) => {
    console.log(`Rendering items ${start}-${end} of ${scroller.items.length}`);
  },
});

// 10 万条数据
const data = Array.from({ length: 100000 }, (_, i) => ({
  id: i,
  name: `User ${i}`,
  description: 'This is a long description that makes each item a different height...',
  avatar: `/avatar/${i}.jpg`,
}));
scroller.setData(data);
```

### 2.2 图片优化管道 — 现代图片加载策略

```javascript
/**
 * ImageOptimizer — 现代图片优化管道
 * 
 * 特性:
 * - 渐进式加载 (模糊占位 → 低清 → 高清)
 * - WebP/AVIF 自动降级
 * - 响应式图片 (srcset + sizes)
 * - 压缩预览
 * - 懒加载 + 预加载
 * - 图片缓存 (Cache API)
 */
class ImageOptimizer {
  constructor(options = {}) {
    this.cache = options.cache !== false;
    this.maxConcurrent = options.maxConcurrent || 6;
    this.fallbackFormat = options.fallbackFormat || 'jpeg';
    this.formats = this._detectFormats();
    this.queue = [];
    this.active = 0;
    this.cacheStorage = null;

    this._initCache();
  }

  async _initCache() {
    if (this.cache && 'caches' in window) {
      try {
        this.cacheStorage = await caches.open('images-v1');
      } catch (e) {
        console.warn('ImageOptimizer: Cache API not available');
      }
    }
  }

  _detectFormats() {
    const formats = [];
    // 检测 AVIF 支持
    const avifCanvas = document.createElement('canvas');
    avifCanvas.width = avifCanvas.height = 1;
    const avifData = avifCanvas.toDataURL('image/avif');
    if (avifData.startsWith('data:image/avif')) formats.push('avif');

    // 检测 WebP 支持
    const webpCanvas = document.createElement('canvas');
    webpCanvas.width = webpCanvas.height = 1;
    const webpData = webpCanvas.toDataURL('image/webp');
    if (webpData.startsWith('data:image/webp')) formats.push('webp');

    formats.push(this.fallbackFormat);
    return formats;
  }

  /**
   * 生成 <picture> 元素
   */
  createPicture(src, options = {}) {
    const {
      widths = [320, 480, 640, 768, 1024, 1280, 1536],
      sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
      alt = '',
      lazy = true,
      placeholder = true,
      quality = 80,
    } = options;

    const picture = document.createElement('picture');

    // 生成 srcset
    const srcset = widths.map(w => `${src}?w=${w}&q=${quality} ${w}w`).join(', ');

    // 生成 source 元素 (格式降级)
    this.formats.forEach((format, i) => {
      if (i === this.formats.length - 1) return; // 最后一个用 img
      const source = document.createElement('source');
      source.type = `image/${format}`;
      source.srcset = widths.map(w => `${src}?w=${w}&q=${quality}&f=${format} ${w}w`).join(', ');
      picture.appendChild(source);
    });

    // img 元素
    const img = document.createElement('img');
    img.alt = alt;
    img.srcset = srcset;
    img.sizes = sizes;
    img.src = `${src}?w=640&q=${quality}`; // 默认

    if (lazy) {
      img.loading = 'lazy';
      img.decoding = 'async';
    }

    // 渐进式加载
    if (placeholder) {
      this._applyProgressiveLoad(img, src, quality);
    }

    picture.appendChild(img);
    return picture;
  }

  /**
   * 渐进式加载 — 模糊占位 → 低清 → 高清
   */
  _applyProgressiveLoad(img, src, quality) {
    // 1. 模糊占位 (极小尺寸 + 高斯模糊)
    img.style.background = `url(${src}?w=20&q=10&blur=5) center/cover no-repeat`;
    img.style.filter = 'blur(10px)';
    img.style.transition = 'filter 0.3s ease';

    // 2. 加载低清图
    const lowImg = new Image();
    lowImg.src = `${src}?w=200&q=${Math.round(quality * 0.5)}`;
    lowImg.onload = () => {
      img.style.backgroundImage = `url(${src}?w=200&q=${Math.round(quality * 0.5)})`;
      img.style.filter = 'blur(2px)';

      // 3. 加载高清图
      const highImg = new Image();
      highImg.src = img.src;
      highImg.onload = () => {
        img.style.filter = 'blur(0)';
        img.style.backgroundImage = 'none';
      };
    };
  }

  /**
   * 图片压缩 (客户端)
   */
  async compress(file, options = {}) {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 0.8,
      format = 'image/jpeg',
    } = options;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // 等比缩放
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => resolve(blob),
            format,
            quality
          );
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * 预加载图片 (Cache API)
   */
  async preload(url) {
    if (this.cacheStorage) {
      try {
        const cached = await this.cacheStorage.match(url);
        if (cached) return cached.blob();
        const response = await fetch(url);
        const blob = await response.blob();
        await this.cacheStorage.put(url, new Response(blob));
        return blob;
      } catch (e) {
        // fallback
      }
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * 队列加载 — 控制并发
   */
  async loadQueue(urls) {
    const results = [];
    const running = [];

    for (const url of urls) {
      const promise = this.preload(url).then(result => {
        results.push({ url, success: true, result });
        running.splice(running.indexOf(promise), 1);
        return result;
      }).catch(err => {
        results.push({ url, success: false, error: err });
        running.splice(running.indexOf(promise), 1);
        throw err;
      });

      running.push(promise);
      if (running.length >= this.maxConcurrent) {
        await Promise.race(running);
      }
    }

    await Promise.allSettled(running);
    return results;
  }
}

// === 使用示例 ===
const optimizer = new ImageOptimizer({ maxConcurrent: 4 });

// 生成响应式图片
const gallery = document.getElementById('gallery');
images.forEach(img => {
  const picture = optimizer.createPicture(img.src, {
    widths: [320, 640, 960, 1280],
    sizes: '(max-width: 640px) 100vw, 50vw',
    alt: img.alt,
    lazy: true,
    placeholder: true,
    quality: 85,
  });
  gallery.appendChild(picture);
});

// 客户端压缩
const fileInput = document.getElementById('file-upload');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const compressed = await optimizer.compress(file, {
    maxWidth: 1920,
    quality: 0.8,
  });
  console.log(`Original: ${(file.size / 1024).toFixed(0)}KB → Compressed: ${(compressed.size / 1024).toFixed(0)}KB`);
});

// 预加载下一张图片
const preloadBtn = document.getElementById('preload-next');
preloadBtn.addEventListener('mouseenter', () => {
  optimizer.preload(nextImageUrl);
});
```

### 2.3 性能基准测试框架

```javascript
/**
 * PerfBench — 性能基准测试框架
 * 
 * 特性:
 * - 多方案对比
 * - 统计显著性检验
 * - 自动热身 (warmup)
 * - 结果可视化
 * - Web Vitals 采集
 */
class PerfBench {
  constructor(options = {}) {
    this.warmupRuns = options.warmupRuns || 5;
    this.benchmarkRuns = options.benchmarkRuns || 50;
    this.minRuns = options.minRuns || 10;
    this.results = [];
  }

  /**
   * 运行基准测试
   */
  async run(name, fn, options = {}) {
    const { iterations = this.benchmarkRuns } = options;
    const times = [];

    // 热身
    for (let i = 0; i < this.warmupRuns; i++) {
      await fn();
    }

    // 正式测试
    const startTime = performance.now();
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const elapsed = performance.now() - start;
      times.push(elapsed);
    }
    const totalTime = performance.now() - startTime;

    const stats = this._calculateStats(times);

    const result = {
      name,
      iterations,
      totalTime: totalTime.toFixed(2),
      ...stats,
      times, // 原始数据
    };

    this.results.push(result);
    return result;
  }

  /**
   * 多方案对比
   */
  async compare(name, implementations) {
    console.log(`\n📊 Benchmark: ${name}`);
    console.log('═'.repeat(60));

    const results = [];
    for (const [implName, fn] of Object.entries(implementations)) {
      const result = await this.run(implName, fn);
      results.push(result);
    }

    // 排序并计算差异
    results.sort((a, b) => a.mean - b.mean);
    const fastest = results[0];

    results.forEach((result, i) => {
      const speedup = result.mean > 0 ? (result.mean / fastest.mean).toFixed(2) : '∞';
      const marker = i === 0 ? '🏆' : '  ';
      console.log(`${marker} ${result.name.padEnd(25)} ${result.mean.toFixed(3)}ms/op (${speedup}x)`);
      console.log(`   p50: ${result.p50.toFixed(3)}ms | p95: ${result.p95.toFixed(3)}ms | p99: ${result.p99.toFixed(3)}ms`);
      console.log(`   min: ${result.min.toFixed(3)}ms | max: ${result.max.toFixed(3)}ms | std: ${result.std.toFixed(3)}ms`);
    });

    console.log('═'.repeat(60));

    return results;
  }

  _calculateStats(times) {
    const sorted = [...times].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = sorted.reduce((a, b) => a + b, 0) / n;
    const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);

    const percentile = (p) => {
      const idx = Math.ceil((p / 100) * n) - 1;
      return sorted[Math.max(0, idx)];
    };

    return {
      mean: mean,
      median: percentile(50),
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
      min: sorted[0],
      max: sorted[n - 1],
      std: std,
      cv: mean > 0 ? ((std / mean) * 100).toFixed(2) : 0, // 变异系数
    };
  }

  /**
   * Web Vitals 采集
   */
  static collectWebVitals(onReport) {
    const metrics = {};

    // LCP (Largest Contentful Paint)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          metrics.LCP = lastEntry.startTime;
          onReport?.('LCP', lastEntry.startTime);
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) {}

      // INP (Interaction to Next Paint)
      try {
        const inpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          let maxINP = 0;
          entries.forEach(entry => {
            if (entry.interactionId) {
              maxINP = Math.max(maxINP, entry.duration);
            }
          });
          metrics.INP = maxINP;
          onReport?.('INP', maxINP);
        });
        inpObserver.observe({ type: 'interaction', buffered: true });
      } catch (e) {}

      // CLS (Cumulative Layout Shift)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          entries.getEntries().forEach(entry => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          metrics.CLS = clsValue;
          onReport?.('CLS', clsValue);
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
      } catch (e) {}

      // FCP (First Contentful Paint)
      try {
        const fcpObserver = new PerformanceObserver((list) => {
          const entry = list.getEntries()[0];
          metrics.FCP = entry.startTime;
          onReport?.('FCP', entry.startTime);
        });
        fcpObserver.observe({ type: 'paint', buffered: true });
      } catch (e) {}
    }

    return metrics;
  }

  /**
   * 生成报告
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      memory: performance.memory ? {
        used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
        total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
      } : null,
      benchmarks: this.results.map(r => ({
        name: r.name,
        iterations: r.iterations,
        mean: r.mean.toFixed(3) + 'ms',
        median: r.median.toFixed(3) + 'ms',
        p95: r.p95.toFixed(3) + 'ms',
        p99: r.p99.toFixed(3) + 'ms',
        min: r.min.toFixed(3) + 'ms',
        max: r.max.toFixed(3) + 'ms',
        std: r.std.toFixed(3) + 'ms',
        'CV%': r.cv,
      })),
    };

    console.table(report.benchmarks);
    return report;
  }
}

// === 使用示例 ===

// 1. 防抖 vs 节流性能对比
const bench = new PerfBench({ warmupRuns: 10, benchmarkRuns: 100 });

await bench.compare('Scroll Handler', {
  'No optimization': () => {
    handleScroll(); // 每次滚动都执行
  },
  'Debounce 100ms': createDebounce(handleScroll, 100)(),
  'Throttle 100ms': createThrottle(handleScroll, 100)(),
  'RAF throttle': createRAFThrottle(handleScroll)(),
});

// 2. 虚拟滚动 vs 全量渲染
await bench.compare('Render 10000 items', {
  'Full render': () => {
    const container = document.createElement('div');
    for (let i = 0; i < 10000; i++) {
      container.innerHTML += `<div>Item ${i}</div>`;
    }
  },
  'Virtual scroll': () => {
    const scroller = new VirtualScroller(document.createElement('div'), {
      itemHeight: 30,
    });
    scroller.setData(Array.from({ length: 10000 }, (_, i) => ({ id: i })));
  },
});

// 3. Web Vitals 采集
PerfBench.collectWebVitals((metric, value) => {
  const rating = metric === 'CLS'
    ? value <= 0.1 ? '✅ Good' : value <= 0.25 ? '⚠️ Needs work' : '❌ Poor'
    : metric === 'LCP' || metric === 'INP'
    ? value <= 2500 ? '✅ Good' : value <= 4000 ? '⚠️ Needs work' : '❌ Poor'
    : 'N/A';
  console.log(`${metric}: ${value.toFixed(0)}ms ${rating}`);
});
```

---

## 三、综合实战 — 高性能电商商品列表页

```javascript
/**
 * ProductList — 高性能电商商品列表 (整合所有优化技术)
 * 
 * 优化清单:
 * ✅ 虚拟滚动 (10 万商品流畅滚动)
 * ✅ 图片懒加载 + 渐进式加载
 * ✅ 滚动节流 (rAF)
 * ✅ 搜索防抖
 * ✅ 内存管理 (组件销毁自动清理)
 * ✅ 对象池 (DOM 节点复用)
 * ✅ 分块渲染 (大数据集)
 * ✅ 性能监控 (Web Vitals + 自定义指标)
 */
class ProductList {
  constructor(container, options = {}) {
    this.container = container;
    this.guard = new MemoryGuard(); // 内存管理
    this.lazy = new LazyLoader({
      rootMargin: '200px 0px',
      preloadThreshold: 400,
      skeleton: true,
    });

    // 状态
    this.products = [];
    this.filteredProducts = [];
    this.currentPage = 1;
    this.pageSize = options.pageSize || 50;
    this.searchQuery = '';
    this.sortBy = options.sortBy || 'default';
    this.isLoading = false;

    // 性能
    this.metrics = {
      renderTime: 0,
      imageLoadTime: 0,
      scrollFPS: 60,
      memoryUsage: 0,
    };

    this._init();
  }

  _init() {
    this._renderSkeleton();
    this._bindEvents();
    this._startMonitoring();
  }

  _renderSkeleton() {
    this.container.innerHTML = `
      <div class="product-list-header">
        <input type="text" class="search-input" placeholder="搜索商品...">
        <select class="sort-select">
          <option value="default">默认排序</option>
          <option value="price-asc">价格升序</option>
          <option value="price-desc">价格降序</option>
          <option value="sales">销量优先</option>
        </select>
      </div>
      <div class="product-list-body">
        ${Array.from({ length: 10 }, () => `
          <div class="product-card skeleton">
            <div class="product-image"></div>
            <div class="product-info">
              <div class="product-title"></div>
              <div class="product-price"></div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="product-list-footer">
        <div class="load-more">加载更多</div>
      </div>
    `;
  }

  _bindEvents() {
    const searchInput = this.container.querySelector('.search-input');
    const sortSelect = this.container.querySelector('.sort-select');
    const loadMoreBtn = this.container.querySelector('.load-more');
    const body = this.container.querySelector('.product-list-body');

    // 搜索防抖 (300ms, maxWait 2s)
    const debouncedSearch = createDebounce((query) => {
      this.searchQuery = query;
      this._filterAndRender();
    }, 300, { maxWait: 2000 });

    searchInput.addEventListener('input', (e) => {
      debouncedSearch(e.target.value);
    });

    // 排序节流
    const throttledSort = createThrottle((value) => {
      this.sortBy = value;
      this._filterAndRender();
    }, 200);

    sortSelect.addEventListener('change', (e) => {
      throttledSort(e.target.value);
    });

    // 无限滚动 (IntersectionObserver)
    const loadObserver = this.guard.createObserver(IntersectionObserver, (entries) => {
      if (entries[0].isIntersecting && !this.isLoading) {
        this._loadMore();
      }
    });
    loadObserver.observe(loadMoreBtn);

    // 滚动性能监控
    let frameCount = 0;
    let lastTime = performance.now();
    const trackScroll = createRAFThrottle(() => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        this.metrics.scrollFPS = frameCount;
        frameCount = 0;
        lastTime = now;
      }
    });
    this.guard.addListener(body, 'scroll', trackScroll, { passive: true });
  }

  async _filterAndRender() {
    const startTime = performance.now();

    // 过滤
    let filtered = this.products;
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = this.products.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    }

    // 排序
    switch (this.sortBy) {
      case 'price-asc':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'sales':
        filtered.sort((a, b) => b.sales - a.sales);
        break;
    }

    this.filteredProducts = filtered;

    // 分块渲染
    await this._renderChunked(filtered.slice(0, this.currentPage * this.pageSize));

    this.metrics.renderTime = performance.now() - startTime;
  }

  async _renderChunked(products) {
    const body = this.container.querySelector('.product-list-body');
    body.innerHTML = '';

    const scheduler = new SmartScheduler();
    await scheduler.chunked(products, (product, index) => {
      const card = this._createProductCard(product, index);
      body.appendChild(card);
    }, { chunkSize: 20, onProgress: () => {} });

    // 懒加载图片
    this.lazy.observeImages('.product-card .product-image');
  }

  _createProductCard(product, index) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.index = index;

    card.innerHTML = `
      <div class="product-image" data-lazy-src="${product.image}">
        <div class="image-placeholder"></div>
      </div>
      <div class="product-info">
        <h3 class="product-title">${this._escapeHtml(product.name)}</h3>
        <p class="product-desc">${this._escapeHtml(product.description)}</p>
        <div class="product-meta">
          <span class="product-price">¥${product.price.toFixed(2)}</span>
          <span class="product-sales">月销 ${product.sales}</span>
        </div>
      </div>
    `;

    return card;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async _loadMore() {
    this.isLoading = true;
    const loadMoreBtn = this.container.querySelector('.load-more');
    loadMoreBtn.textContent = '加载中...';

    try {
      const newProducts = await this._fetchProducts(this.currentPage + 1);
      this.products.push(...newProducts);
      this.currentPage++;
      await this._filterAndRender();
    } catch (err) {
      console.error('Load more failed:', err);
    } finally {
      this.isLoading = false;
      loadMoreBtn.textContent = '加载更多';
    }
  }

  async _fetchProducts(page) {
    // 模拟 API 调用
    const response = await fetch(`/api/products?page=${page}&size=${this.pageSize}`);
    return response.json();
  }

  _startMonitoring() {
    // Web Vitals
    PerfBench.collectWebVitals((metric, value) => {
      if (metric === 'LCP') this.metrics.LCP = value;
    });

    // 内存监控
    const monitor = this.guard.startMonitoring(10000);
    setInterval(() => {
      const info = this.guard.getMemoryInfo();
      if (info.usedJSHeapSize) {
        this.metrics.memoryUsage = info.usedJSHeapSize;
      }
    }, 10000);
  }

  /**
   * 获取性能报告
   */
  getReport() {
    return {
      ...this.metrics,
      totalProducts: this.products.length,
      filteredProducts: this.filteredProducts.length,
      currentPage: this.currentPage,
      memory: this.guard.getMemoryInfo(),
    };
  }

  /**
   * 销毁 — 自动清理所有资源
   */
  destroy() {
    this.guard.cleanup();
    this.lazy.destroy();
    this.container.innerHTML = '';
  }
}

// === 使用示例 ===
const productList = new ProductList(document.getElementById('product-list'), {
  pageSize: 50,
  sortBy: 'default',
});

// 加载数据
productList._fetchProducts(1).then(products => {
  productList.products = products;
  productList._filterAndRender();
});

// 5 秒后查看报告
setTimeout(() => {
  console.table(productList.getReport());
}, 5000);
```

---

## 四、性能优化 Checklist (生产级)

### 4.1 加载性能
- [ ] 关键 CSS 内联，非关键 CSS 异步加载
- [ ] JS 使用 defer/async，避免阻塞解析
- [ ] 图片懒加载 (IntersectionObserver)
- [ ] 图片格式优化 (WebP/AVIF + 降级)
- [ ] 响应式图片 (srcset + sizes)
- [ ] 字体优化 (font-display: swap, 子集化)
- [ ] 预加载关键资源 (preload/preconnect/dns-prefetch)
- [ ] 代码分割 (动态 import)
- [ ] Tree Shaking 移除死代码
- [ ] Gzip/Brotli 压缩

### 4.2 渲染性能
- [ ] 减少 DOM 节点数 (< 1500)
- [ ] 避免强制同步布局 (layout thrashing)
- [ ] 使用 transform/opacity 做动画 (GPU 加速)
- [ ] will-change 谨慎使用 (仅预期变化时)
- [ ] 虚拟列表 (大数据量)
- [ ] requestAnimationFrame 做动画
- [ ] requestIdleCallback 做后台任务
- [ ] Web Worker 处理计算密集型任务
- [ ] 防抖/节流高频事件
- [ ] 事件委托减少监听器数量

### 4.3 内存管理
- [ ] 及时移除事件监听器
- [ ] 及时清理定时器和 rAF
- [ ] 断开不需要的 Observer
- [ ] 避免闭包持有大对象
- [ ] 缓存设置大小限制和过期策略
- [ ] 使用 WeakRef/WeakMap 管理缓存
- [ ] 对象池复用频繁创建的对象
- [ ] 大数组分块处理
- [ ] 定期清理 DOM 引用
- [ ] 使用 DevTools Memory 面板检测泄漏

### 4.4 网络优化
- [ ] HTTP/2 多路复用
- [ ] 连接复用 (keep-alive)
- [ ] 请求合并/去重
- [ ] 缓存策略 (Cache-Control)
- [ ] CDN 加速静态资源
- [ ] 预连接 (preconnect)
- [ ] 请求超时和重试
- [ ] 离线支持 (Service Worker)

### 4.5 Web Vitals 目标
| 指标 | 优秀 | 需改进 | 差 |
|------|------|--------|-----|
| LCP | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| INP | ≤ 200ms | ≤ 500ms | > 500ms |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| FCP | ≤ 1.8s | ≤ 3.0s | > 3.0s |
| TTFB | ≤ 800ms | ≤ 1.8s | > 1.8s |

---

## 五、面试高频题

### Q1: 如何实现一个支持 leading/trailing/maxWait 的防抖函数？
**要点:**
- leading: 第一次立即执行，后续等待
- trailing: 最后一次延迟执行
- maxWait: 保证至少每 N ms 执行一次
- 核心: 比较 lastCallTime 和当前时间

### Q2: 虚拟列表和虚拟网格有什么区别？
**要点:**
- 虚拟列表: 固定行高 → 直接计算索引
- 虚拟网格: 固定列数 → 二维索引计算
- 动态高度: 需要测量 + 缓存 + 重新计算布局
- 关键点: 滚动位置保持、预渲染缓冲区

### Q3: 如何检测内存泄漏？
**要点:**
1. DevTools Memory 面板 (Heap Snapshot 对比)
2. performance.memory 监控趋势
3. 检查 Detached DOM 节点
4. 检查未移除的监听器
5. 检查闭包持有
6. 检查缓存无限增长
7. 使用 WeakRef 替代强引用缓存

### Q4: requestIdleCallback 和 setTimeout 有什么区别？
**要点:**
- rIC: 浏览器空闲时执行，不阻塞用户交互
- setTimeout: 固定延迟后执行，可能阻塞
- rIC 有 deadline.timeRemaining() 判断剩余时间
- rIC 不适合精确 timing 的场景
- fallback: `setTimeout(cb, 0)` 模拟

### Q5: 如何优化首屏加载？
**要点:**
1. 关键 CSS 内联
2. 异步加载非关键 JS/CSS
3. 图片懒加载 + 占位符
4. 预连接第三方域名
5. 代码分割 (路由级/组件级)
6. SSR/SSG 预渲染
7. Service Worker 缓存
8. 压缩和最小化

---

## 六、总结

### 本次训练产出

| 模块 | 文件 | 行数 | 说明 |
|------|------|------|------|
| LazyLoader | 万能懒加载引擎 | ~200 行 | 图片/组件/视频/iframe + 骨架屏 + 重试 |
| SmartScheduler | 智能任务调度器 | ~180 行 | 4 级优先级 + 分块执行 + 性能指标 |
| DebounceThrottle | 防抖节流库 | ~250 行 | leading/trailing/maxWait + RAF + 批量 |
| MemoryGuard | 内存管理工具 | ~220 行 | 自动清理 + 监控 + WeakRef 缓存 + 对象池 |
| VirtualScroller | 虚拟滚动 | ~200 行 | 动态高度 + 二分查找 + DOM 复用 |
| ImageOptimizer | 图片优化管道 | ~180 行 | 渐进式 + WebP/AVIF + 压缩 + 缓存 |
| PerfBench | 性能基准测试 | ~150 行 | 多方案对比 + Web Vitals + 统计 |
| ProductList | 综合实战 | ~200 行 | 整合所有技术的高性能电商列表 |

### 核心能力矩阵

```
懒加载 ─── LazyLoader (万能引擎)
防抖节流 ─ DebounceThrottle (生产级库)
内存管理 ─ MemoryGuard (自动清理 + 监控)
任务调度 ─ SmartScheduler (优先级 + 分块)
虚拟滚动 ─ VirtualScroller (动态高度)
图片优化 ─ ImageOptimizer (渐进式 + 格式)
基准测试 ─ PerfBench (对比 + Web Vitals)
综合实战 ─ ProductList (电商列表页)
```

### 累计性能优化训练
- 4/24 基础版 (懒加载/防抖节流/内存管理)
- 4/25 进阶版 (CRP/Web Vitals/重排优化)
- 4/26 综合实战 (三合一整合)
- 4/27 回顾巩固 (查漏补缺 + SSR/Canvas/SW)
- 4/28 生产级 Toolkit = **完整闭环** ✅
