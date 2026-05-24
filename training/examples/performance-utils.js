/**
 * Web 性能优化工具库
 * 包含懒加载、防抖、节流、内存管理等实用函数
 */

// ==================== 防抖 (Debounce) ====================

/**
 * 防抖函数 - 等待操作完成后再执行
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟时间 (ms)
 * @param {boolean} immediate - 是否立即执行
 * @returns {Function} 防抖后的函数
 */
export function debounce(fn, delay, immediate = false) {
  let timer = null;

  const debounced = function (...args) {
    const later = () => {
      timer = null;
      if (!immediate) fn.apply(this, args);
    };

    const callNow = immediate && !timer;
    clearTimeout(timer);
    timer = setTimeout(later, delay);

    if (callNow) fn.apply(this, args);
  };

  debounced.cancel = function () {
    clearTimeout(timer);
    timer = null;
  };

  return debounced;
}

// ==================== 节流 (Throttle) ====================

/**
 * 节流函数 - 限制执行频率
 * @param {Function} fn - 要执行的函数
 * @param {number} wait - 等待时间 (ms)
 * @param {Object} options - 配置选项
 * @param {boolean} options.leading - 是否在开始时执行
 * @param {boolean} options.trailing - 是否在结束时执行
 * @returns {Function} 节流后的函数
 */
export function throttle(fn, wait, options = {}) {
  let timer = null;
  let previous = 0;
  const { leading = true, trailing = true } = options;

  const throttled = function (...args) {
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

  throttled.cancel = function () {
    clearTimeout(timer);
    timer = null;
    previous = 0;
  };

  return throttled;
}

// ==================== 懒加载 (Lazy Loading) ====================

/**
 * 图片懒加载类
 */
export class LazyImageLoader {
  constructor(options = {}) {
    this.options = {
      rootMargin: options.rootMargin || '50px 0px',
      threshold: options.threshold || 0.01,
      placeholder: options.placeholder || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      errorImage: options.errorImage || null,
      ...options,
    };

    this.observer = null;
    this.images = new Set();
  }

  init() {
    if (!('IntersectionObserver' in window)) {
      // 降级：直接加载所有图片
      document.querySelectorAll('img[data-src]').forEach((img) => {
        this.loadImage(img);
      });
      return;
    }

    this.observer = new IntersectionObserver(this.observe.bind(this), {
      rootMargin: this.options.rootMargin,
      threshold: this.options.threshold,
    });

    this.observeAll();
  }

  observeAll() {
    document.querySelectorAll('img[data-src]').forEach((img) => {
      if (!this.images.has(img)) {
        this.images.add(img);
        this.observer.observe(img);
      }
    });
  }

  observe(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        this.loadImage(img);
        this.observer.unobserve(img);
        this.images.delete(img);
      }
    });
  }

  loadImage(img) {
    const { src } = img.dataset;
    const { srcset } = img.dataset;

    img.onload = () => {
      img.classList.add('lazy-loaded');
      img.classList.remove('lazy-loading');
    };

    img.onerror = () => {
      img.classList.add('lazy-error');
      if (this.options.errorImage) {
        img.src = this.options.errorImage;
      }
    };

    img.classList.add('lazy-loading');
    img.src = src;

    if (srcset) {
      img.srcset = srcset;
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.images.clear();
  }
}

/**
 * 组件懒加载 Hook (React)
 */
export function useLazyComponent(importFunc) {
  const [Component, setComponent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    importFunc()
      .then((module) => {
        if (mounted) setComponent(() => module.default);
      })
      .catch((err) => {
        if (mounted) setError(err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [importFunc]);

  return { Component, loading, error };
}

// ==================== 内存管理 ====================

/**
 * 资源清理管理器
 */
export class CleanupManager {
  constructor() {
    this.cleanups = [];
  }

  add(cleanupFn) {
    this.cleanups.push(cleanupFn);
    return () => this.remove(cleanupFn);
  }

  remove(cleanupFn) {
    const index = this.cleanups.indexOf(cleanupFn);
    if (index > -1) {
      this.cleanups.splice(index, 1);
    }
  }

  cleanup() {
    this.cleanups.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    });
    this.cleanups = [];
  }
}

/**
 * 创建带清理的定时器
 */
export function createTimer(cleanupManager) {
  const timers = new Set();

  const setIntervalCustom = (fn, delay) => {
    const id = setInterval(fn, delay);
    timers.add(id);
    cleanupManager.add(() => clearInterval(id));
    return id;
  };

  const setTimeoutCustom = (fn, delay) => {
    const id = setTimeout(() => {
      fn();
      timers.delete(id);
    }, delay);
    timers.add(id);
    cleanupManager.add(() => clearTimeout(id));
    return id;
  };

  return { setInterval: setIntervalCustom, setTimeout: setTimeoutCustom };
}

/**
 * 创建带清理的事件监听器
 */
export function createEventListener(cleanupManager) {
  const listeners = new Set();

  const addEventListenerCustom = (target, event, handler, options) => {
    target.addEventListener(event, handler, options);
    const listener = {
      target, event, handler, options,
    };
    listeners.add(listener);

    cleanupManager.add(() => {
      target.removeEventListener(event, handler, options);
      listeners.delete(listener);
    });

    return () => {
      target.removeEventListener(event, handler, options);
      listeners.delete(listener);
    };
  };

  return { addEventListener: addEventListenerCustom };
}

// ==================== 性能监控 ====================

/**
 * 性能指标监控
 */
export class PerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      lcpThreshold: options.lcpThreshold || 2500,
      fidThreshold: options.fidThreshold || 100,
      clsThreshold: options.clsThreshold || 0.1,
      onReport: options.onReport || console.log,
      ...options,
    };

    this.observers = [];
    this.metrics = {};
  }

  init() {
    this.observeLCP();
    this.observeFID();
    this.observeCLS();
    this.observeMemory();
  }

  observeLCP() {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.metrics.lcp = lastEntry.startTime;

      if (this.metrics.lcp > this.options.lcpThreshold) {
        this.options.onReport('LCP', this.metrics.lcp, 'warning');
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  }

  observeFID() {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fid = entries[0].processingStart - entries[0].startTime;
      this.metrics.fid = fid;

      if (this.metrics.fid > this.options.fidThreshold) {
        this.options.onReport('FID', this.metrics.fid, 'warning');
      }
    }).observe({ type: 'first-input', buffered: true });
  }

  observeCLS() {
    let clsValue = 0;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      this.metrics.cls = clsValue;

      if (this.metrics.cls > this.options.clsThreshold) {
        this.options.onReport('CLS', this.metrics.cls, 'warning');
      }
    }).observe({ type: 'layout-shift', buffered: true });
  }

  observeMemory() {
    if (performance.memory) {
      setInterval(() => {
        const { usedJSHeapSize, totalJSHeapSize } = performance.memory;
        const usagePercent = (usedJSHeapSize / totalJSHeapSize) * 100;
        this.metrics.memory = usagePercent;

        if (usagePercent > 80) {
          this.options.onReport('Memory', usagePercent, 'critical');
        }
      }, 5000);
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }

  destroy() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

// ==================== 虚拟列表 ====================

/**
 * 虚拟列表渲染器
 */
export class VirtualList {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    this.options = {
      itemHeight: options.itemHeight || 50,
      overscan: options.overscan || 5,
      renderItem: options.renderItem,
      ...options,
    };

    this.items = [];
    this.scrollTop = 0;
    this.containerHeight = 0;
    this.virtualHeight = 0;

    this.init();
  }

  init() {
    this.container.style.overflow = 'auto';
    this.container.addEventListener('scroll', this.onScroll.bind(this));
    this.updateDimensions();
  }

  updateDimensions() {
    this.containerHeight = this.container.clientHeight;
    this.virtualHeight = this.items.length * this.options.itemHeight;
    this.render();
  }

  setItems(items) {
    this.items = items;
    this.updateDimensions();
  }

  onScroll() {
    this.scrollTop = this.container.scrollTop;
    this.render();
  }

  render() {
    const { itemHeight, overscan, renderItem } = this.options;

    const startIndex = Math.floor(this.scrollTop / itemHeight);
    const visibleCount = Math.ceil(this.containerHeight / itemHeight);

    const renderStart = Math.max(0, startIndex - overscan);
    const renderEnd = Math.min(this.items.length, startIndex + visibleCount + overscan);

    const visibleItems = this.items.slice(renderStart, renderEnd);

    this.container.innerHTML = `
      <div style="height: ${this.virtualHeight}px; position: relative;">
        ${visibleItems.map((item, index) => {
    const actualIndex = renderStart + index;
    const top = actualIndex * itemHeight;
    return `
            <div style="position: absolute; top: ${top}px; height: ${itemHeight}px; width: 100%;">
              ${renderItem(item, actualIndex)}
            </div>
          `;
  }).join('')}
      </div>
    `;
  }

  destroy() {
    this.container.removeEventListener('scroll', this.onScroll.bind(this));
  }
}

// ==================== 使用示例 ====================

/*
// 1. 防抖搜索
const searchInput = document.querySelector('#search');
const searchHandler = debounce((query) => {
  fetchResults(query);
}, 300);
searchInput.addEventListener('input', (e) => searchHandler(e.target.value));

// 2. 节流滚动
const scrollHandler = throttle(() => {
  updateProgressBar();
}, 100);
window.addEventListener('scroll', scrollHandler);

// 3. 图片懒加载
const lazyLoader = new LazyImageLoader();
lazyLoader.init();

// 4. 内存管理
const cleanup = new CleanupManager();
const timer = createTimer(cleanup);
const events = createEventListener(cleanup);

timer.setInterval(() => updateData(), 1000);
events.addEventListener(window, 'resize', handleResize);

// 清理所有资源
cleanup.cleanup();

// 5. 性能监控
const monitor = new PerformanceMonitor({
  onReport: (metric, value, level) => {
    console.log(`${metric}: ${value} (${level})`);
  }
});
monitor.init();

// 6. 虚拟列表
const virtualList = new VirtualList('#list-container', {
  itemHeight: 60,
  renderItem: (item, index) => `<div>${item.name}</div>`
});
virtualList.setItems(largeDataSet);
*/

export default {
  debounce,
  throttle,
  LazyImageLoader,
  CleanupManager,
  createTimer,
  createEventListener,
  PerformanceMonitor,
  VirtualList,
};
