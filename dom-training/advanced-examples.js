/**
 * DOM 操作专项训练 - 高级示例与工具函数
 * 包含更多实际场景中的 DOM 操作技巧
 */

// ==================== 工具函数库 ====================

/**
 * 1. 安全的元素选择器（带错误处理）
 */
function $(selector, context = document) {
  const el = context.querySelector(selector);
  if (!el) {
    console.warn(`Element not found: ${selector}`);
  }
  return el;
}

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/**
 * 2. 创建元素的快捷函数
 */
function createEl(tag, props = {}, children = []) {
  const el = document.createElement(tag);

  // 设置属性
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'className') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style') Object.assign(el.style, value);
    else if (key.startsWith('on')) {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') el.innerHTML = value;
    else if (key === 'text') el.textContent = value;
    else el.setAttribute(key, value);
  });

  // 添加子元素
  children.forEach((child) => {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  });

  return el;
}

// 使用示例：
// const btn = createEl('button', {
//   className: 'btn btn-primary',
//   text: '点击我',
//   dataset: { id: '123' },
//   onClick: () => console.log('clicked')
// }, ['图标', createEl('span', { text: '文字' })]);

/**
 * 3. 批量更新 DOM（批处理队列）
 */
class DOMBatch {
  constructor() {
    this.queue = [];
    this.scheduled = false;
  }

  add(fn) {
    this.queue.push(fn);
    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }

  flush() {
    const batch = this.queue;
    this.queue = [];
    this.scheduled = false;
    batch.forEach((fn) => fn());
  }
}

const domBatch = new DOMBatch();

// 使用示例：
// domBatch.add(() => el1.textContent = 'a');
// domBatch.add(() => el2.textContent = 'b');
// 两次更新会在同一帧执行

/**
 * 4. 高效的列表渲染（带 key 追踪）
 */
function renderList(container, items, renderFn, getKey = (item) => item.id) {
  const oldElements = new Map();
  $$(container.children).forEach((el) => {
    oldElements.set(el.dataset.key, el);
  });

  const newKeys = new Set();
  const fragment = document.createDocumentFragment();

  items.forEach((item, index) => {
    const key = getKey(item);
    newKeys.add(key);

    if (oldElements.has(key)) {
      // 复用现有元素
      const el = oldElements.get(key);
      renderFn(el, item, index);
      fragment.appendChild(el);
    } else {
      // 创建新元素
      const el = document.createElement('div');
      el.dataset.key = key;
      renderFn(el, item, index);
      fragment.appendChild(el);
    }
  });

  // 移除废弃元素
  oldElements.forEach((el, key) => {
    if (!newKeys.has(key)) {
      el.remove();
    }
  });

  container.innerHTML = '';
  container.appendChild(fragment);
}

/**
 * 5. 事件总线（发布订阅模式）
 */
class EventBus {
  constructor() {
    this.events = new Map();
  }

  on(event, fn) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const fns = this.events.get(event);
    if (fns) {
      const index = fns.indexOf(fn);
      if (index > -1) fns.splice(index, 1);
    }
  }

  emit(event, ...args) {
    const fns = this.events.get(event);
    if (fns) {
      fns.forEach((fn) => fn(...args));
    }
  }
}

/**
 * 6. 元素可见性检测（Intersection Observer）
 */
function whenVisible(elements, callback, options = {}) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback(entry.target, entry);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, ...options });

  elements.forEach((el) => observer.observe(el));
  return () => observer.disconnect();
}

// 使用示例：懒加载图片
// whenVisible($$('img[data-src]'), (img) => {
//   img.src = img.dataset.src;
// });

/**
 * 7. 防抖搜索输入（带取消功能）
 */
function createDebouncedSearch(inputSelector, resultSelector, searchFn, delay = 300) {
  const input = $(inputSelector);
  const result = $(resultSelector);
  let timer = null;
  let abortController = null;

  input.addEventListener('input', async (e) => {
    const query = e.target.value.trim();

    // 取消之前的请求
    if (abortController) {
      abortController.abort();
    }

    clearTimeout(timer);

    if (!query) {
      result.textContent = '';
      return;
    }

    // 防抖等待
    timer = setTimeout(async () => {
      abortController = new AbortController();
      try {
        result.textContent = '加载中...';
        const results = await searchFn(query, abortController.signal);
        result.textContent = `找到 ${results.length} 条结果`;
      } catch (err) {
        if (err.name !== 'AbortError') {
          result.textContent = '搜索失败';
        }
      }
    }, delay);
  });
}

/**
 * 8. 拖拽排序（Drag and Drop API）
 */
function makeSortable(container, options = {}) {
  let dragEl = null;

  container.addEventListener('dragstart', (e) => {
    if (e.target.matches(options.selector || '.draggable')) {
      dragEl = e.target;
      e.target.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterEl = getDragAfterElement(container, e.clientY);
    if (dragEl) {
      if (afterEl == null) {
        container.appendChild(dragEl);
      } else {
        container.insertBefore(dragEl, afterEl);
      }
    }
  });

  container.addEventListener('dragend', () => {
    if (dragEl) {
      dragEl.classList.remove('dragging');
      dragEl = null;
      options.onSort?.($$(options.selector || '.draggable', container));
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.draggable:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * 9. 表单验证（实时反馈）
 */
class FormValidator {
  constructor(formSelector, rules = {}) {
    this.form = $(formSelector);
    this.rules = rules;
    this.errors = new Map();
    this.init();
  }

  init() {
    this.form.addEventListener('input', (e) => {
      if (e.target.name) {
        this.validateField(e.target.name);
      }
    });

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.validateAll()) {
        this.form.dispatchEvent(new CustomEvent('valid'));
      }
    });
  }

  validateField(name) {
    const field = this.form.elements[name];
    const rule = this.rules[name];
    const errorEl = this.getErrorElement(name);

    if (!rule || !field) return true;

    const value = field.value.trim();
    let error = null;

    if (rule.required && !value) {
      error = '此项必填';
    } else if (rule.minLength && value.length < rule.minLength) {
      error = `最少 ${rule.minLength} 个字符`;
    } else if (rule.maxLength && value.length > rule.maxLength) {
      error = `最多 ${rule.maxLength} 个字符`;
    } else if (rule.pattern && !rule.pattern.test(value)) {
      error = rule.message || '格式不正确';
    }

    if (error) {
      this.errors.set(name, error);
      field.classList.add('invalid');
      errorEl.textContent = error;
      return false;
    }
    this.errors.delete(name);
    field.classList.remove('invalid');
    field.classList.add('valid');
    errorEl.textContent = '';
    return true;
  }

  getErrorElement(name) {
    let errorEl = this.form.querySelector(`[data-error-for="${name}"]`);
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.dataset.errorFor = name;
      errorEl.className = 'error-message';
      this.form.elements[name].after(errorEl);
    }
    return errorEl;
  }

  validateAll() {
    let valid = true;
    Object.keys(this.rules).forEach((name) => {
      if (!this.validateField(name)) valid = false;
    });
    return valid;
  }
}

/**
 * 10. 无限滚动加载
 */
function InfiniteScroll(container, loadMoreFn, options = {}) {
  this.container = $(container);
  this.loadMoreFn = loadMoreFn;
  this.loading = false;
  this.hasMore = true;
  this.threshold = options.threshold || 200;
  this.init();
}

InfiniteScroll.prototype.init = function () {
  this.container.addEventListener('scroll', () => this.onScroll());
  this.onScroll(); // 初始检查
};

InfiniteScroll.prototype.onScroll = function () {
  if (this.loading || !this.hasMore) return;

  const { scrollTop, scrollHeight, clientHeight } = this.container;
  const remaining = scrollHeight - scrollTop - clientHeight;

  if (remaining < this.threshold) {
    this.loadMore();
  }
};

InfiniteScroll.prototype.loadMore = async function () {
  this.loading = true;
  this.showLoading();

  try {
    const items = await this.loadMoreFn();
    if (items.length === 0) {
      this.hasMore = false;
    } else {
      this.renderItems(items);
    }
  } catch (err) {
    console.error('Load failed:', err);
  } finally {
    this.loading = false;
    this.hideLoading();
  }
};

InfiniteScroll.prototype.showLoading = function () {
  let loader = this.container.querySelector('.infinite-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.className = 'infinite-loader';
    loader.textContent = '加载中...';
    this.container.appendChild(loader);
  }
  loader.style.display = 'block';
};

InfiniteScroll.prototype.hideLoading = function () {
  const loader = this.container.querySelector('.infinite-loader');
  if (loader) loader.style.display = 'none';
};

InfiniteScroll.prototype.renderItems = function (items) {
  // 子类重写此方法
  console.log('Render items:', items);
};

// ==================== 性能监控工具 ====================

/**
 * 11. DOM 操作性能监控
 */
class DOMPerformanceMonitor {
  constructor() {
    this.metrics = {
      reflows: 0,
      repaints: 0,
      longTasks: [],
    };
  }

  trackReflows() {
    // 注意：实际项目中需要使用 Performance Observer
    // 这里简化示例
    console.log('Tracking reflows...');
  }

  measureOperation(name, fn) {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    if (duration > 16) { // 超过一帧
      this.metrics.longTasks.push({ name, duration });
      console.warn(`慢操作: ${name} (${duration.toFixed(2)}ms)`);
    }

    return result;
  }

  getReport() {
    return {
      ...this.metrics,
      avgLongTask: this.metrics.longTasks.length > 0
        ? this.metrics.longTasks.reduce((a, b) => a + b.duration, 0) / this.metrics.longTasks.length
        : 0,
    };
  }
}

/**
 * 12. 内存泄漏检测
 */
function detectMemoryLeaks() {
  const listeners = new WeakMap();

  // 监控事件监听器数量
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

  EventTarget.prototype.addEventListener = function (type, fn, options) {
    if (!listeners.has(this)) {
      listeners.set(this, new Set());
    }
    listeners.get(this).add({ type, fn });
    return originalAddEventListener.call(this, type, fn, options);
  };

  EventTarget.prototype.removeEventListener = function (type, fn, options) {
    const set = listeners.get(this);
    if (set) {
      set.delete({ type, fn });
      if (set.size === 0) {
        listeners.delete(this);
      }
    }
    return originalRemoveEventListener.call(this, type, fn, options);
  };

  // 获取当前监听器统计
  return {
    getTotalListeners: () => {
      let total = 0;
      listeners.forEach((set) => { total += set.size; });
      return total;
    },
    getElementsWithListeners: () => {
      const elements = [];
      listeners.forEach((set, el) => {
        elements.push({ element: el, count: set.size });
      });
      return elements;
    },
  };
}

// ==================== 导出（可在浏览器控制台使用） ====================

if (typeof window !== 'undefined') {
  window.DOMUtils = {
    $,
    $$,
    createEl,
    DOMBatch,
    renderList,
    EventBus,
    whenVisible,
    createDebouncedSearch,
    makeSortable,
    FormValidator,
    InfiniteScroll,
    DOMPerformanceMonitor,
    detectMemoryLeaks,
  };

  console.log('✅ DOM 工具库已加载，可通过 window.DOMUtils 访问');
}
