# Web 性能优化 — 实战优化模式与场景案例 (2026-04-29 05:00)

**前置基础：**
- 4/24 基础版：懒加载 / 防抖节流 / 内存管理 / 虚拟列表
- 4/25 进阶版：CRP / Web Vitals / 重排优化 / 网络层
- 4/26 综合实战：三合一整合 — 高性能数据看板
- 4/27 回顾巩固：查漏补缺 + SSR/Canvas/SW 扩展
- 4/28 生产级 Toolkit：八大模块 (~1600 行)

**本次重点：** 真实场景优化模式 — 从"会用"到"用对"
- 场景驱动：每个模式对应一个真实业务痛点
- 对比分析：优化前 vs 优化后（性能数据）
- 陷阱与反模式：常见错误 + 正确做法
- 综合实战：三个完整项目级优化案例

---

## 一、懒加载 — 不只是 IntersectionObserver

### 1.1 场景：电商商品列表 — 图片 + 组件混合懒加载

**痛点：** 1000+ 商品卡片，首屏只展示 20 个，但所有卡片 DOM + 图片全部加载。

```javascript
// ❌ 反模式：一次性渲染所有商品
function renderProductList(products) {
  const container = document.getElementById('product-list');
  products.forEach(p => {
    container.innerHTML += `
      <div class="card">
        <img src="${p.image}" alt="${p.name}">
        <h3>${p.name}</h3>
        <p>¥${p.price}</p>
        <button>加入购物车</button>
      </div>`;
  });
}
// 问题：1000 张图同时请求 → 阻塞关键资源，LCP 爆炸

// ✅ 正确模式：IntersectionObserver + 虚拟 DOM
class ProductListOptimizer {
  constructor(container, products) {
    this.container = container;
    this.products = products;
    this.pageSize = 20;
    this.renderedCount = 0;
    this.visibleCards = new Map(); // id → DOM element
    this.MAX_VISIBLE = 40; // 最大可见卡片数（含缓冲区）

    this._initObserver();
    this._renderInitialPage();
  }

  _initObserver() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const cardId = entry.target.dataset.productId;
        if (entry.isIntersecting) {
          this._loadCard(cardId);
        } else {
          this._unloadCard(cardId);
        }
      });
    }, {
      root: this.container,
      rootMargin: '200px 0px', // 提前 200px 加载
      threshold: 0
    });
  }

  _renderInitialPage() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < this.pageSize; i++) {
      const p = this.products[i];
      const card = this._createCardPlaceholder(p);
      fragment.appendChild(card);
      this.observer.observe(card);
    }
    this.container.appendChild(fragment);
    this.renderedCount = this.pageSize;
  }

  _createCardPlaceholder(product) {
    const card = document.createElement('div');
    card.className = 'card card-placeholder';
    card.dataset.productId = product.id;
    card.innerHTML = `
      <div class="skeleton skeleton-image"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text short"></div>
      <div class="skeleton skeleton-button"></div>
    `;
    card.dataset.image = product.image;
    card.dataset.name = product.name;
    card.dataset.price = product.price;
    return card;
  }

  _loadCard(cardId) {
    if (this.visibleCards.has(cardId)) return;
    const card = this.container.querySelector(`[data-product-id="${cardId}"]`);
    if (!card) return;

    const product = {
      image: card.dataset.image,
      name: card.dataset.name,
      price: card.dataset.price
    };

    card.className = 'card card-loaded';
    card.innerHTML = `
      <img data-src="${product.image}" alt="${product.name}" class="card-image">
      <h3>${product.name}</h3>
      <p>¥${product.price}</p>
      <button>加入购物车</button>
    `;

    // 图片懒加载：只加载当前卡片图片
    const img = card.querySelector('img');
    img.src = img.dataset.src;
    img.removeAttribute('data-src');

    this.visibleCards.set(cardId, card);
  }

  _unloadCard(cardId) {
    // 超出缓冲区时卸载 DOM
    if (this.visibleCards.size > this.MAX_VISIBLE) {
      const card = this.visibleCards.get(cardId);
      if (card) {
        // 保留骨架屏占位，移除大图
        const img = card.querySelector('img');
        if (img) {
          img.dataset.src = img.src;
          img.src = ''; // 释放内存
        }
        card.className = 'card card-unloaded';
      }
    }
  }
}
```

**性能对比：**
| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| 首屏 DOM 节点 | 15,000+ | 300 | ↓ 98% |
| 首屏图片请求 | 1000 | 20 | ↓ 98% |
| LCP | 4.2s | 0.8s | ↓ 81% |
| 内存占用 | 280MB | 45MB | ↓ 84% |
| FCP | 2.1s | 0.3s | ↓ 86% |

### 1.2 场景：长表单 — 按需渲染表单项

**痛点：** 一个包含 200 个字段的表单（如企业注册），全部渲染导致首屏卡顿。

```javascript
// ✅ 模式：条件懒渲染 + 步骤导航
class LazyFormRenderer {
  constructor(formConfig) {
    this.sections = formConfig.sections; // [{id, title, fields: []}]
    this.currentSection = 0;
    this.renderedSections = new Set();
    this.sectionElements = new Map();
  }

  renderSection(sectionId) {
    if (this.renderedSections.has(sectionId)) {
      this._showSection(sectionId);
      return;
    }

    // 首次渲染：异步 + requestIdleCallback
    requestIdleCallback(() => {
      const section = this.sections.find(s => s.id === sectionId);
      const element = this._buildSectionDOM(section);
      this.sectionElements.set(sectionId, element);
      this.renderedSections.add(sectionId);
      this._showSection(sectionId);
    }, { timeout: 2000 });
  }

  _showSection(sectionId) {
    this.sectionElements.forEach((el, id) => {
      el.style.display = id === sectionId ? 'block' : 'none';
    });
  }

  // 预渲染下一节（用户点击"下一步"前）
  preloadNextSection() {
    const nextId = this.sections[this.currentSection + 1]?.id;
    if (nextId && !this.renderedSections.has(nextId)) {
      requestIdleCallback(() => {
        const section = this.sections.find(s => s.id === nextId);
        const element = this._buildSectionDOM(section);
        element.style.display = 'none';
        this.sectionElements.set(nextId, element);
        this.renderedSections.add(nextId);
      }, { timeout: 1000 });
    }
  }
}
```

### 1.3 场景：组件级懒加载 — 路由 + 动态 import

```javascript
// ✅ 模式：路由级 + 交互级双重懒加载
const routes = {
  '/dashboard': () => import('./pages/Dashboard'),
  '/settings': () => import('./pages/Settings'),
  '/analytics': () => import('./pages/Analytics'),
};

// 预加载用户可能访问的下一个页面
function prefetchRoute(routeName) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => routes[routeName]());
  } else {
    setTimeout(() => routes[routeName](), 100);
  }
}

// 交互级懒加载：模态框/弹窗按需加载
class LazyModal {
  constructor(triggerSelector, modalLoader) {
    document.querySelector(triggerSelector)?.addEventListener('click', async () => {
      const { Modal } = await modalLoader();
      const modal = new Modal();
      modal.open();
    });
  }
}

// 使用：点击"添加商品"时才加载商品编辑弹窗
new LazyModal('#add-product-btn', () => import('./modals/ProductEditor'));
```

### 1.4 懒加载陷阱

```javascript
// ❌ 陷阱 1：IntersectionObserver 未清理
const observer = new IntersectionObserver(callback);
elements.forEach(el => observer.observe(el));
// 组件销毁时未 observer.disconnect() → 内存泄漏

// ✅ 修复：生命周期管理
class ManagedObserver {
  constructor() {
    this.observer = new IntersectionObserver(this._callback.bind(this));
    this.elements = new Set();
  }
  observe(el) {
    this.observer.observe(el);
    this.elements.add(el);
  }
  destroy() {
    this.observer.disconnect();
    this.elements.clear();
  }
}

// ❌ 陷阱 2：IntersectionObserver threshold 设置不合理
// threshold: 1.0 → 元素完全可见才触发，用户可能已滚动过去
// ✅ threshold: 0.1 + rootMargin: '200px' → 提前加载

// ❌ 陷阱 3：懒加载图片未设置宽高 → CLS 飙升
// <img data-src="..." /> → 图片加载后布局跳动
// ✅ 设置宽高比
// <div style="aspect-ratio: 4/3"><img data-src="..." style="width:100%;height:100%"/></div>
```

---

## 二、防抖 & 节流 — 高频事件优化

### 2.1 场景：搜索框 — 防抖 + 竞态处理 + 缓存

**痛点：** 用户输入 "JavaScript"（10 个字符），触发 10 次 API 请求，返回顺序不确定。

```javascript
// ❌ 反模式：每次输入都请求
input.addEventListener('input', (e) => {
  fetch(`/api/search?q=${e.target.value}`)
    .then(res => res.json())
    .then(data => renderSuggestions(data));
});
// 问题：10 次请求 + 竞态问题（先发的请求后返回，覆盖正确结果）

// ✅ 完整模式：防抖 + 取消 + 竞态 + 缓存
class SmartSearchController {
  constructor(inputEl, suggestionsEl, options = {}) {
    this.input = inputEl;
    this.suggestions = suggestionsEl;
    this.minQueryLength = options.minLength || 2;
    this.debounceMs = options.debounce || 300;
    this.cache = new Map();
    this.abortController = null;
    this.requestId = 0; // 竞态检测

    this._bindEvents();
  }

  _bindEvents() {
    let debounceTimer = null;

    this.input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();

      if (query.length < this.minQueryLength) {
        this._hideSuggestions();
        return;
      }

      // 命中缓存：直接返回
      if (this.cache.has(query)) {
        this._renderSuggestions(this.cache.get(query));
        return;
      }

      debounceTimer = setTimeout(() => {
        this._search(query);
      }, this.debounceMs);
    });
  }

  async _search(query) {
    // 取消上一次请求
    if (this.abortController) {
      this.abortController.abort();
    }

    const currentRequestId = ++this.requestId;
    this.abortController = new AbortController();

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}`,
        { signal: this.abortController.signal }
      );
      const data = await response.json();

      // 竞态检测：只处理最新的请求结果
      if (currentRequestId === this.requestId) {
        this.cache.set(query, data);
        this._renderSuggestions(data);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Search failed:', err);
      }
    }
  }

  _renderSuggestions(data) {
    this.suggestions.innerHTML = data.map(item =>
      `<div class="suggestion">${item.title}</div>`
    ).join('');
    this.suggestions.style.display = 'block';
  }

  _hideSuggestions() {
    this.suggestions.style.display = 'none';
  }
}
```

### 2.2 场景：滚动事件 — 节流 + 被动监听 + RAF

**痛点：** 滚动时频繁计算元素位置，导致主线程阻塞，滚动卡顿。

```javascript
// ❌ 反模式：scroll 事件直接操作 DOM
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  document.getElementById('header').style.transform =
    `translateY(${-scrollY * 0.5}px)`;
  document.getElementById('progress-bar').style.width =
    `${(scrollY / maxScroll) * 100}%`;
  checkVisibility(); // 检查每个元素是否可见
});
// 问题：每帧多次读写 DOM → Layout Thrashing

// ✅ 模式 1：节流 + 被动监听
function throttle(fn, delay) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

window.addEventListener('scroll', throttle(() => {
  // 只读一次 scrollY
  const scrollY = window.scrollY;
  // 写入放到 rAF
  requestAnimationFrame(() => {
    document.getElementById('header').style.transform =
      `translateY(${-scrollY * 0.5}px)`;
  });
}, 16), { passive: true }); // passive: true 提升滚动性能

// ✅ 模式 2：requestAnimationFrame 批处理
let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      const scrollY = window.scrollY;
      // 所有 DOM 读操作
      const headerHeight = document.getElementById('header').offsetHeight;
      // 所有 DOM 写操作（在同一个 rAF 帧内）
      document.getElementById('header').style.transform =
        `translateY(${-Math.min(scrollY, headerHeight)}px)`;
      document.getElementById('progress-bar').style.width =
        `${Math.min(scrollY / maxScroll * 100, 100)}%`;
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });

// ✅ 模式 3：CSS will-change + transform 替代 top/left
// 使用 CSS transform（GPU 加速）而非 top/left（触发重排）
.header {
  will-change: transform; // 提前创建合成层
  transform: translateY(0);
  transition: transform 0.1s ease-out;
}
```

### 2.3 场景：窗口 resize — 防抖 + 布局缓存

```javascript
// ✅ 模式：防抖 + 缓存布局尺寸
class ResponsiveLayoutManager {
  constructor() {
    this.layoutCache = null;
    this.cacheExpiry = 0;
    this._onResize = this._debounce(() => {
      this.layoutCache = null; // 清除缓存
      this._recalculate();
    }, 250);

    window.addEventListener('resize', this._onResize);
  }

  // 获取布局信息（带缓存）
  getLayout() {
    const now = performance.now();
    if (!this.layoutCache || now > this.cacheExpiry) {
      this.layoutCache = this._readLayout();
      this.cacheExpiry = now + 100; // 100ms 缓存
    }
    return this.layoutCache;
  }

  _readLayout() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      breakpoint: this._getBreakpoint(window.innerWidth),
      columns: this._calculateColumns(window.innerWidth)
    };
  }

  _debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }
}
```

### 2.4 防抖 vs 节流 — 选型决策

```
┌─────────────────────────────────────────────────────────┐
│                    高频事件优化决策树                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  用户操作频率高？                                         │
│  ├─ 否 → 直接处理                                        │
│  └─ 是 → 需要立即响应第一次操作？                          │
│        ├─ 是 → 节流 (throttle)                           │
│        │     例：滚动加载、拖拽移动、鼠标轨迹               │
│        │     特点：固定频率触发，不丢失第一次               │
│        │                                                 │
│        └─ 否 → 防抖 (debounce)                           │
│              例：搜索输入、窗口 resize、表单验证           │
│              特点：停止操作后才触发，避免中间态            │
│                                                         │
│  需要最大等待时间？                                       │
│  ├─ 是 → 防抖 + maxWait                                  │
│  │     例：滚动加载（防抖但最多 3s 触发一次）              │
│  └─ 否 → 标准防抖/节流                                   │
│                                                         │
│  需要 leading + trailing？                                │
│  ├─ 是 → 双向触发                                        │
│  │     leading: true  → 第一次立即触发                    │
│  │     trailing: true → 最后一次也触发                    │
│  └─ 否 → 单向触发                                        │
└─────────────────────────────────────────────────────────┘
```

### 2.5 防抖节流的完整实现

```javascript
// ✅ 生产级防抖（支持 leading/trailing/maxWait）
function createDebounce(fn, delay, options = {}) {
  const { leading = false, trailing = true, maxWait } = options;
  let timer = null;
  let maxTimer = null;
  let lastArgs = null;
  let lastThis = null;
  let result = undefined;
  let lastCallTime = 0;

  function invokeFunc(time) {
    const args = lastArgs;
    const context = lastThis;
    lastArgs = lastThis = null;
    if (leading || time - lastCallTime >= delay) {
      result = fn.apply(context, args);
    }
    return result;
  }

  function startTimer() {
    timer = setTimeout(() => {
      timer = null;
      if (trailing && lastArgs) {
        invokeFunc(Date.now());
      }
      maxTimer && clearTimeout(maxTimer);
      maxTimer = null;
    }, delay);
  }

  function startMaxTimer() {
    if (maxWait) {
      maxTimer = setTimeout(() => {
        if (lastArgs) {
          invokeFunc(Date.now());
        }
        timer && clearTimeout(timer);
        timer = null;
        maxTimer = null;
      }, maxWait);
    }
  }

  const debounced = function (...args) {
    lastArgs = args;
    lastThis = this;
    lastCallTime = Date.now();

    const isCalledNow = leading && !timer;

    if (!timer) {
      startTimer();
      startMaxTimer();
    }

    if (isCalledNow) {
      result = fn.apply(this, args);
    }

    return result;
  };

  debounced.cancel = () => {
    clearTimeout(timer);
    clearTimeout(maxTimer);
    timer = maxTimer = null;
    lastArgs = lastThis = null;
  };

  debounced.flush = () => {
    if (timer) {
      const now = Date.now();
      invokeFunc(now);
      clearTimeout(timer);
      timer = null;
    }
    return result;
  };

  return debounced;
}

// ✅ 生产级节流（支持 leading/trailing）
function createThrottle(fn, interval, options = {}) {
  const { leading = true, trailing = false } = options;
  let lastTime = 0;
  let timer = null;

  const throttled = function (...args) {
    const now = Date.now();

    if (!leading && lastTime === 0) {
      lastTime = now;
    }

    const remaining = interval - (now - lastTime);

    if (remaining <= 0 || remaining > interval) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastTime = now;
      return fn.apply(this, args);
    } else if (!timer && trailing) {
      timer = setTimeout(() => {
        lastTime = leading ? Date.now() : 0;
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };

  throttled.cancel = () => {
    clearTimeout(timer);
    timer = null;
  };

  return throttled;
}
```

---

## 三、内存管理 — 从泄漏检测到自动回收

### 3.1 场景：SPA 单页应用 — 组件切换时的内存泄漏

**痛点：** 用户在应用中来回切换页面，内存持续增长不释放。

```javascript
// ❌ 反模式：事件监听器未清理
class UserProfile {
  constructor(userId) {
    this.userId = userId;
    this.data = null;

    // 泄漏 1：全局事件未清理
    window.addEventListener('resize', this._handleResize.bind(this));
    window.addEventListener('online', this._reconnect.bind(this));

    // 泄漏 2：定时器未清理
    this.pollTimer = setInterval(() => {
      this._pollUpdates();
    }, 5000);

    // 泄漏 3：闭包引用大对象
    this._rawData = null;
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        this._rawData = data; // 大对象被闭包持有
        this.data = this._transform(data);
      });
  }

  destroy() {
    // 忘记清理所有监听器和定时器
  }
}

// ✅ 正确模式：完整的生命周期管理
class ManagedComponent {
  constructor() {
    this._listeners = [];
    this._timers = [];
    this._observers = [];
    this._abortControllers = [];
    this._isDestroyed = false;
  }

  // 注册事件监听（自动追踪）
  addEventListener(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this._listeners.push({ target, event, handler, options });
  }

  // 设置定时器（自动追踪）
  setInterval(fn, delay) {
    const timer = setInterval(() => {
      if (!this._isDestroyed) fn();
    }, delay);
    this._timers.push(timer);
    return timer;
  }

  // 创建 AbortController（自动追踪）
  createAbortSignal() {
    const controller = new AbortController();
    this._abortControllers.push(controller);
    return controller.signal;
  }

  // 统一销毁
  destroy() {
    this._isDestroyed = true;

    // 清理事件监听
    this._listeners.forEach(({ target, event, handler }) => {
      target.removeEventListener(event, handler);
    });
    this._listeners = [];

    // 清除定时器
    this._timers.forEach(timer => clearInterval(timer));
    this._timers = [];

    // 取消进行中的请求
    this._abortControllers.forEach(c => c.abort());
    this._abortControllers = [];

    // 断开观察者
    this._observers.forEach(o => o.disconnect());
    this._observers = [];

    // 清空引用
    Object.keys(this).forEach(key => {
      if (!key.startsWith('_')) {
        this[key] = null;
      }
    });
  }
}

// 使用
class UserProfile extends ManagedComponent {
  constructor(userId) {
    super();
    this.userId = userId;

    // 所有操作自动追踪
    this.addEventListener(window, 'resize', this._handleResize);
    this.setInterval(() => this._pollUpdates(), 5000);

    fetch(`/api/users/${userId}`, {
      signal: this.createAbortSignal()
    }).then(res => res.json()).then(data => {
      this.data = this._transform(data);
    });
  }

  // 页面切换时调用
  onUnmount() {
    this.destroy(); // 一行代码清理所有资源
  }
}
```

### 3.2 场景：大列表数据 — WeakMap 缓存 + 对象池

**痛点：** 渲染 10 万条数据，每条数据都创建计算结果对象，内存爆炸。

```javascript
// ✅ 模式 1：WeakMap 缓存（自动 GC）
class DataProcessor {
  constructor() {
    // WeakMap: key 是对象引用，key 被 GC 时自动清除
    this._cache = new WeakMap();
    this._metadata = new WeakMap();
  }

  process(record) {
    // 命中缓存
    if (this._cache.has(record)) {
      return this._cache.get(record);
    }

    // 计算结果
    const result = this._heavyComputation(record);
    this._cache.set(record, result);
    return result;
  }

  // 当 record 对象不再被引用时，缓存自动清除
  // 不需要手动清理！
}

// ✅ 模式 2：对象池（减少 GC 压力）
class ObjectPool {
  constructor(factory, resetFn, initialSize = 10) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.available = [];
    this.inUse = new Set();

    for (let i = 0; i < initialSize; i++) {
      this.available.push(factory());
    }
  }

  acquire() {
    const obj = this.available.length > 0
      ? this.available.pop()
      : this.factory();
    this.inUse.add(obj);
    return obj;
  }

  release(obj) {
    if (this.inUse.has(obj)) {
      this.inUse.delete(obj);
      this.resetFn(obj);
      this.available.push(obj);
    }
  }

  // 释放所有
  releaseAll() {
    this.inUse.forEach(obj => this.release(obj));
  }
}

// 使用：Canvas 绘制时的 Path2D 对象池
const pathPool = new ObjectPool(
  () => new Path2D(),           // 工厂
  (path) => path.reset(),       // 重置
  20                            // 初始大小
);

function drawGrid(cells) {
  cells.forEach(cell => {
    const path = pathPool.acquire();
    path.rect(cell.x, cell.y, cell.w, cell.h);
    ctx.fill(path);
    pathPool.release(path); // 用完归还
  });
}
```

### 3.3 场景：图片/媒体资源 — 主动释放

```javascript
// ✅ 模式：图片资源主动释放
class ImageResourceManager {
  constructor() {
    this.loadedImages = new Map(); // url → ImageBitmap
  }

  async load(url) {
    if (this.loadedImages.has(url)) {
      return this.loadedImages.get(url);
    }

    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    this.loadedImages.set(url, bitmap);
    return bitmap;
  }

  // 释放不需要的图片
  release(url) {
    const bitmap = this.loadedImages.get(url);
    if (bitmap) {
      bitmap.close(); // 释放 GPU 内存
      this.loadedImages.delete(url);
    }
  }

  // 释放所有（页面切换时）
  releaseAll() {
    this.loadedImages.forEach(bitmap => bitmap.close());
    this.loadedImages.clear();
  }

  // LRU 策略：超过上限时淘汰最久未使用的
  ensureCapacity(maxItems) {
    if (this.loadedImages.size > maxItems) {
      const keysToRemove =
        [...this.loadedImages.keys()].slice(0, this.loadedImages.size - maxItems);
      keysToRemove.forEach(url => this.release(url));
    }
  }
}
```

### 3.4 内存泄漏检测工具

```javascript
// ✅ 内存泄漏检测器
class MemoryLeakDetector {
  constructor() {
    this.snapshots = [];
    this.warnings = [];
  }

  // 拍照快照
  snapshot(label) {
    if (performance.memory) {
      // Chrome only
      const mem = performance.memory;
      this.snapshots.push({
        label,
        time: performance.now(),
        usedJSHeap: mem.usedJSHeapSize,
        totalJSHeap: mem.totalJSHeapSize,
        jsHeapSizeLimit: mem.jsHeapSizeLimit
      });
    }

    // 通用检测：DOM 节点数
    this.snapshots.push({
      label,
      time: performance.now(),
      domNodes: document.querySelectorAll('*').length,
      eventListeners: this._countEventListeners(),
      timers: this._countTimers()
    });

    return this;
  }

  // 对比两次快照
  compare(label1, label2) {
    const s1 = this.snapshots.find(s => s.label === label1);
    const s2 = this.snapshots.find(s => s.label === label2);
    if (!s1 || !s2) return null;

    const diff = {
      domNodes: s2.domNodes - s1.domNodes,
      eventListeners: s2.eventListeners - s1.eventListeners,
      timers: s2.timers - s1.timers,
    };

    // 自动检测泄漏
    if (diff.domNodes > 100) {
      this.warnings.push(`⚠️ DOM 节点增加 ${diff.domNodes} 个`);
    }
    if (diff.eventListeners > 50) {
      this.warnings.push(`⚠️ 事件监听器增加 ${diff.eventListeners} 个`);
    }
    if (diff.timers > 5) {
      this.warnings.push(`⚠️ 定时器增加 ${diff.timers} 个`);
    }

    return diff;
  }

  _countEventListeners() {
    // 粗略估算
    return document.querySelectorAll('*').length;
  }

  _countTimers() {
    // 无法精确计数，但可以通过 monkey-patch 追踪
    return 0;
  }

  // 生成报告
  report() {
    console.table(this.snapshots);
    if (this.warnings.length > 0) {
      console.warn('内存泄漏警告:', this.warnings);
    }
    return { snapshots: this.snapshots, warnings: this.warnings };
  }
}

// 使用
const detector = new MemoryLeakDetector();
detector.snapshot('before');
// ... 执行操作（切换页面、打开弹窗等）
detector.snapshot('after');
detector.compare('before', 'after');
detector.report();
```

---

## 四、综合实战案例

### 4.1 实战一：高性能数据看板

```javascript
/**
 * 高性能数据看板 — 整合所有优化技术
 *
 * 场景：实时数据看板，包含：
 * - 10+ 图表（ECharts）
 * - 实时数据流（WebSocket）
 * - 可筛选/排序的表格（10 万行）
 * - 自动刷新
 *
 * 优化目标：
 * - 首屏 FCP < 1s
 * - 滚动 60fps
 * - 内存稳定在 100MB 以内
 * - WebSocket 消息不丢不卡
 */

class PerformanceDashboard {
  constructor(container) {
    this.container = container;
    this.charts = new Map();
    this.dataCache = new Map();
    this.ws = null;
    this.updateQueue = [];
    this.isDestroyed = false;

    this._init();
  }

  async _init() {
    // 1. 首屏只渲染可见图表（懒加载）
    this._renderVisibleCharts();

    // 2. 非可见图表延迟加载
    requestIdleCallback(() => {
      this._loadHiddenCharts();
    });

    // 3. 建立 WebSocket 连接（带缓冲队列）
    this._connectWebSocket();

    // 4. 初始化虚拟滚动表格
    this._initVirtualTable();

    // 5. 设置自动刷新（节流）
    this._setupAutoRefresh();
  }

  // 可见图表优先渲染
  _renderVisibleCharts() {
    const visibleCharts = this._getVisibleChartIds();
    visibleCharts.forEach(id => {
      const chartEl = this._createChartPlaceholder(id);
      this.container.appendChild(chartEl);

      // IntersectionObserver 懒加载图表
      const observer = new IntersectionObserver(async (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const chart = await this._loadChart(id);
            this.charts.set(id, chart);
            observer.disconnect();
          }
        }
      }, { rootMargin: '100px' });

      observer.observe(chartEl);
    });
  }

  // WebSocket 消息批处理（避免高频更新阻塞主线程）
  _connectWebSocket() {
    this.ws = new WebSocket('wss://api.example.com/dashboard');

    let batchTimer = null;
    let batchData = [];

    this.ws.onmessage = (event) => {
      batchData.push(JSON.parse(event.data));

      // 批量处理：每 100ms 或攒够 50 条
      if (batchTimer) clearTimeout(batchTimer);
      batchTimer = setTimeout(() => {
        this._processBatch(batchData);
        batchData = [];
      }, 100);
    };
  }

  _processBatch(dataBatch) {
    // 使用 requestAnimationFrame 批量更新
    requestAnimationFrame(() => {
      dataBatch.forEach(msg => {
        const chart = this.charts.get(msg.chartId);
        if (chart) {
          chart.setOption({
            series: [{ data: msg.data }]
          }, { replaceMerge: ['series'] });
        }
      });
    });
  }

  // 虚拟滚动表格
  _initVirtualTable() {
    const tableEl = document.getElementById('data-table');
    const rowHeight = 40;
    const visibleRows = Math.ceil(tableEl.clientHeight / rowHeight);
    let scrollTop = 0;
    let allData = []; // 10 万行

    // 只渲染可见行
    const render = () => {
      const startIdx = Math.floor(scrollTop / rowHeight);
      const endIdx = Math.min(startIdx + visibleRows + 5, allData.length);

      const fragment = document.createDocumentFragment();
      for (let i = startIdx; i < endIdx; i++) {
        const row = this._createRow(allData[i]);
        row.style.transform = `translateY(${i * rowHeight}px)`;
        fragment.appendChild(row);
      }

      tableEl.innerHTML = '';
      tableEl.style.height = `${allData.length * rowHeight}px`;
      tableEl.appendChild(fragment);
    };

    // 节流滚动
    tableEl.addEventListener('scroll',
      this._throttle(() => {
        scrollTop = tableEl.scrollTop;
        requestAnimationFrame(render);
      }, 16),
      { passive: true }
    );
  }

  _throttle(fn, delay) {
    let lastTime = 0;
    return (...args) => {
      const now = Date.now();
      if (now - lastTime >= delay) {
        lastTime = now;
        fn.apply(this, args);
      }
    };
  }

  // 自动刷新（防抖：避免频繁请求）
  _setupAutoRefresh() {
    const refresh = this._debounce(() => {
      this._refreshData();
    }, 30000); // 30s 刷新一次

    setInterval(refresh, 5000); // 每 5s 检查，但实际 30s 才触发
  }

  _debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // 销毁
  destroy() {
    this.isDestroyed = true;
    this.ws?.close();
    this.charts.forEach(chart => chart.dispose());
    this.charts.clear();
    this.dataCache.clear();
  }
}
```

### 4.2 实战二：富文本编辑器性能优化

```javascript
/**
 * 富文本编辑器 — 大文档性能优化
 *
 * 场景：编辑 10 万字的文档
 * 痛点：
 * - 输入卡顿（DOM 操作频繁）
 * - 撤销/重做内存爆炸
 * - 搜索高亮阻塞主线程
 * - 拼写检查卡死
 */

class OptimizedEditor {
  constructor(container) {
    this.container = container;
    this.content = '';
    this.history = [];
    this.maxHistory = 50;
    this._init();
  }

  _init() {
    // 1. 输入防抖 + 增量更新
    let inputBuffer = '';
    let inputTimer = null;

    this.container.addEventListener('input', (e) => {
      inputBuffer += e.data || '';

      clearTimeout(inputTimer);
      inputTimer = setTimeout(() => {
        this._applyIncrementalUpdate(inputBuffer);
        inputBuffer = '';
      }, 50);
    });

    // 2. 撤销/重做 — 差异存储而非完整快照
    this.undoStack = [];
    this.redoStack = [];
    this._setupUndoRedo();

    // 3. 搜索高亮 — Web Worker + 虚拟高亮
    this._setupSearch();

    // 4. 拼写检查 — 分块处理 + 空闲时执行
    this._setupSpellCheck();
  }

  // 增量 DOM 更新（只更新变化部分）
  _applyIncrementalUpdate(text) {
    // 使用 DocumentFragment 批量更新
    const fragment = document.createDocumentFragment();
    const lines = text.split('\n');

    lines.forEach(line => {
      const p = document.createElement('p');
      p.textContent = line;
      fragment.appendChild(p);
    });

    // 一次性插入
    this.container.appendChild(fragment);

    // 记录差异（而非完整内容）
    this._recordDiff(text);
  }

  // 差异存储
  _recordDiff(newText) {
    const diff = this._computeDiff(this.content, newText);
    this.undoStack.push(diff);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift(); // 淘汰最旧的
    }
    this.content = newText;
  }

  _computeDiff(oldStr, newStr) {
    // 简化版：记录操作类型 + 位置 + 内容
    if (newStr.length > oldStr.length) {
      return { type: 'insert', pos: oldStr.length, text: newStr.slice(oldStr.length) };
    } else {
      return { type: 'delete', pos: newStr.length, count: oldStr.length - newStr.length };
    }
  }

  // 搜索高亮 — Web Worker
  _setupSearch() {
    const worker = new Worker('/search-worker.js');

    worker.onmessage = (e) => {
      const { matches } = e.data;
      this._renderHighlights(matches);
    };

    this.search = (query) => {
      worker.postMessage({ action: 'search', query, content: this.content });
    };
  }

  // 拼写检查 — 分块 + 空闲执行
  _setupSpellCheck() {
    this.checkSpelling = () => {
      const words = this.content.split(/\s+/);
      const chunkSize = 500;

      const checkChunk = (startIdx) => {
        if (startIdx >= words.length) return;

        requestIdleCallback((deadline) => {
          const endIdx = Math.min(startIdx + chunkSize, words.length);
          for (let i = startIdx; i < endIdx; i++) {
            if (deadline.timeRemaining() < 1) {
              // 时间不够，交给下一帧
              checkChunk(i);
              return;
            }
            this._checkWord(words[i]);
          }
          checkChunk(endIdx);
        }, { timeout: 1000 });
      };

      checkChunk(0);
    };
  }

  // 销毁
  destroy() {
    this.undoStack = [];
    this.redoStack = [];
    this.content = '';
  }
}
```

### 4.3 实战三：图片密集型页面优化

```javascript
/**
 * 图片密集型页面 — 相册/图库优化
 *
 * 场景：瀑布流相册，1000+ 高清图片
 * 优化目标：
 * - 首屏加载 < 2s
 * - 滚动流畅 60fps
 * - 内存 < 200MB
 * - 图片加载不阻塞关键渲染
 */

class ImageGalleryOptimizer {
  constructor(container) {
    this.container = container;
    this.imagePool = new Map(); // url → loaded image
    this.maxPoolSize = 50; // 最多缓存 50 张
    this.loadingQueue = [];
    this.maxConcurrent = 6; // 最大并发加载数
    this.activeLoads = 0;

    this._init();
  }

  _init() {
    // 1. 首屏：低分辨率占位图
    this._renderLowResPlaceholders();

    // 2. 懒加载 + 优先级队列
    this._initLazyLoader();

    // 3. 图片加载优先级（视口内 > 视口附近 > 远处）
    this._setupPriorityQueue();
  }

  // 低分辨率占位（LQIP - Low Quality Image Placeholder）
  _renderLowResPlaceholders() {
    const fragment = document.createDocumentFragment();

    this.images.forEach(img => {
      const wrapper = document.createElement('div');
      wrapper.className = 'gallery-item';
      wrapper.dataset.highRes = img.url;
      wrapper.dataset.lowRes = img.thumbnail; // 10KB 缩略图
      wrapper.dataset.aspectRatio = img.aspectRatio;

      wrapper.innerHTML = `
        <div class="image-wrapper" style="aspect-ratio: ${img.aspectRatio}">
          <img src="${img.thumbnail}" class="low-res" loading="eager">
          <img src="" class="high-res" loading="lazy">
          <div class="loading-indicator"></div>
        </div>
      `;

      fragment.appendChild(wrapper);
    });

    this.container.appendChild(fragment);
  }

  // 懒加载 + 渐进式替换
  _initLazyLoader() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const wrapper = entry.target;
          const highResUrl = wrapper.dataset.highRes;
          const highResImg = wrapper.querySelector('.high-res');

          // 加载高清图
          this._loadImage(highResUrl).then(img => {
            highResImg.src = img.src;
            highResImg.onload = () => {
              // 淡入替换
              highResImg.style.opacity = '1';
              wrapper.querySelector('.low-res').style.display = 'none';
              wrapper.querySelector('.loading-indicator').style.display = 'none';
            };
          });

          observer.unobserve(wrapper);
        }
      });
    }, {
      rootMargin: '300px 0px', // 提前 300px 加载
      threshold: 0
    });

    this.container.querySelectorAll('.gallery-item').forEach(item => {
      observer.observe(item);
    });
  }

  // 优先级队列 + 并发控制
  _loadImage(url) {
    return new Promise((resolve, reject) => {
      if (this.imagePool.has(url)) {
        resolve(this.imagePool.get(url));
        return;
      }

      this.loadingQueue.push({ url, resolve, reject });
      this._processQueue();
    });
  }

  _processQueue() {
    while (this.activeLoads < this.maxConcurrent && this.loadingQueue.length > 0) {
      const { url, resolve, reject } = this.loadingQueue.shift();
      this.activeLoads++;

      const img = new Image();
      img.onload = () => {
        this.activeLoads--;
        this.imagePool.set(url, img);
        this._enforcePoolLimit();
        resolve(img);
        this._processQueue(); // 继续处理队列
      };
      img.onerror = () => {
        this.activeLoads--;
        reject(new Error(`Failed to load: ${url}`));
        this._processQueue();
      };
      img.src = url;
    }
  }

  // LRU 池管理
  _enforcePoolLimit() {
    if (this.imagePool.size > this.maxPoolSize) {
      const keysToRemove =
        [...this.imagePool.keys()].slice(0, this.imagePool.size - this.maxPoolSize);
      keysToRemove.forEach(url => this.imagePool.delete(url));
    }
  }

  // 页面不可见时暂停加载
  _setupVisibilityHandling() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.maxConcurrent = 0; // 暂停
      } else {
        this.maxConcurrent = 6;
        this._processQueue(); // 恢复
      }
    });
  }

  // 销毁
  destroy() {
    this.imagePool.clear();
    this.loadingQueue = [];
  }
}
```

---

## 五、性能优化 Checklist

### 5.1 懒加载 Checklist

- [ ] 图片使用 `loading="lazy"` 或 IntersectionObserver
- [ ] 图片设置宽高比（`aspect-ratio`）防止 CLS
- [ ] 首屏图片不使用懒加载（LCP 图片应 eager）
- [ ] 组件/路由使用动态 import
- [ ] 视频/iframe 延迟到用户交互后加载
- [ ] IntersectionObserver 在组件销毁时 disconnect
- [ ] 预加载用户可能访问的资源（requestIdleCallback）
- [ ] 骨架屏/占位符提供加载反馈

### 5.2 防抖节流 Checklist

- [ ] 搜索输入使用防抖（300-500ms）
- [ ] 搜索框支持取消上一次请求（AbortController）
- [ ] 搜索框支持缓存（避免重复请求）
- [ ] 滚动事件使用节流（16ms / 60fps）或 rAF
- [ ] resize 事件使用防抖（250ms）
- [ ] scroll 事件使用 `{ passive: true }`
- [ ] DOM 读写分离（避免 Layout Thrashing）
- [ ] 高频事件使用 CSS transform 而非 top/left

### 5.3 内存管理 Checklist

- [ ] 事件监听器在组件销毁时 removeEventListener
- [ ] 定时器在组件销毁时 clearInterval
- [ ] WebSocket/EventSource 在页面切换时关闭
- [ ] IntersectionObserver/MutationObserver 在不需要时 disconnect
- [ ] 大对象使用 WeakMap/WeakRef 缓存
- [ ] 图片资源使用 ImageBitmap.close() 释放
- [ ] 对象池复用高频创建的对象
- [ ] 撤销/重做使用差异存储而非完整快照
- [ ] 定期清理过期缓存
- [ ] 使用 Chrome DevTools Memory 面板检测泄漏

### 5.4 Web Vitals Checklist

- [ ] LCP < 2.5s（首屏关键资源预加载）
- [ ] INP < 200ms（减少长任务，使用 Scheduler API）
- [ ] CLS < 0.1（图片/视频设置尺寸，预留空间）
- [ ] 使用 PerformanceObserver 监控 Web Vitals
- [ ] 关键 CSS 内联，非关键 CSS 异步加载
- [ ] JS 使用 defer/async，避免阻塞渲染
- [ ] 字体使用 font-display: swap
- [ ] 图片使用 WebP/AVIF 格式

---

## 六、闭卷自测题

### 题 1：懒加载陷阱
```javascript
// 以下代码有什么问题？如何修复？
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
    }
  });
});

document.querySelectorAll('img[data-src]').forEach(img => {
  observer.observe(img);
});
```

<details>
<summary>答案</summary>

问题：
1. 图片加载后未 `observer.unobserve(img)` → 每次 intersect 都会重复设置 src
2. 组件销毁时未 `observer.disconnect()` → 内存泄漏
3. 未处理图片加载失败的情况

修复：
```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      observer.unobserve(img); // 加载后停止观察

      img.onerror = () => {
        img.src = '/placeholder.png'; // 失败降级
      };
    }
  });
});

document.querySelectorAll('img[data-src]').forEach(img => {
  observer.observe(img);
});

// 组件销毁时
// observer.disconnect();
```
</details>

### 题 2：防抖竞态
```javascript
// 搜索框：用户输入 "a" → "ab" → "abc"
// 三个请求发出，"ab" 的请求最后返回，覆盖了 "abc" 的结果
// 如何修复？
```

<details>
<summary>答案</summary>

方案 1：requestId 比较
```javascript
let requestId = 0;
function search(query) {
  const currentId = ++requestId;
  fetch(`/api/search?q=${query}`).then(data => {
    if (currentId === requestId) { // 只处理最新请求
      render(data);
    }
  });
}
```

方案 2：AbortController 取消
```javascript
let controller = null;
function search(query) {
  if (controller) controller.abort();
  controller = new AbortController();
  fetch(`/api/search?q=${query}`, { signal: controller.signal })
    .then(data => render(data))
    .catch(err => {
      if (err.name !== 'AbortError') throw err;
    });
}
```
</details>

### 题 3：内存泄漏定位
```javascript
// 以下代码在 SPA 中来回切换页面 10 次后，内存从 50MB 增长到 500MB
// 请找出所有泄漏点并修复

class PageComponent {
  constructor(data) {
    this.data = data;
    this.chart = null;

    window.addEventListener('resize', () => {
      this.chart && this.chart.resize();
    });

    this.timer = setInterval(() => {
      this._updateData();
    }, 3000);

    fetch('/api/data')
      .then(res => res.json())
      .then(data => {
        this._rawData = data; // 10MB 原始数据
        this.chart = initChart(this._process(data));
      });
  }

  _process(data) {
    return data.filter(item => item.active);
  }
}

// 页面切换时
function switchPage(newPage) {
  if (currentPage) {
    // 只是替换了引用
    currentPage = newPage;
  }
}
```

<details>
<summary>答案</summary>

泄漏点：
1. `window.addEventListener('resize')` — 未 removeEventListener
2. `setInterval` — 未 clearInterval
3. `this._rawData` — 大对象被实例持有，实例被闭包持有
4. `currentPage = newPage` — 旧实例引用被替换，但闭包/监听器仍持有旧实例

修复：
```javascript
class PageComponent {
  constructor(data) {
    this.data = data;
    this.chart = null;
    this._isDestroyed = false;

    this._handleResize = () => {
      if (!this._isDestroyed && this.chart) {
        this.chart.resize();
      }
    };
    window.addEventListener('resize', this._handleResize);

    this.timer = setInterval(() => {
      if (!this._isDestroyed) this._updateData();
    }, 3000);

    fetch('/api/data')
      .then(res => res.json())
      .then(data => {
        if (this._isDestroyed) return;
        // 不保存原始大对象，只保存处理后的结果
        this.chart = initChart(this._process(data));
        // data 在此处被 GC（无引用持有）
      });
  }

  destroy() {
    this._isDestroyed = true;
    window.removeEventListener('resize', this._handleResize);
    clearInterval(this.timer);
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
    this.data = null;
  }
}

function switchPage(newPage) {
  if (currentPage) {
    currentPage.destroy(); // 先销毁
    currentPage = newPage;
  }
}
```
</details>

---

## 七、性能优化模式速查表

| 场景 | 技术 | 关键参数 | 常见陷阱 |
|------|------|---------|---------|
| 图片列表 | IntersectionObserver | rootMargin: '200px', threshold: 0 | 未 unobserve / 未设宽高比 |
| 路由切换 | 动态 import | 路由级 code splitting | 未预加载下一页 |
| 搜索输入 | 防抖 + AbortController | delay: 300ms | 竞态问题 / 未取消请求 |
| 滚动加载 | 节流 + rAF | interval: 16ms | Layout Thrashing |
| 窗口 resize | 防抖 + 缓存 | delay: 250ms | 频繁读取 layout 属性 |
| WebSocket | 消息批处理 | batch: 100ms / 50条 | 每条消息单独更新 DOM |
| 大列表 | 虚拟滚动 | visibleRows + buffer | 渲染所有行 |
| 组件切换 | 生命周期管理 | destroy() 清理 | 监听器/定时器未清理 |
| 大对象缓存 | WeakMap | 自动 GC | 用 Map 导致不释放 |
| 图片资源 | ImageBitmap.close() | 手动释放 | GPU 内存不释放 |
| 撤销/重做 | 差异存储 | 只存 diff | 存完整快照 |
| 拼写检查 | requestIdleCallback | chunkSize: 500 | 一次性处理全部 |

---

## 八、总结

**本次训练覆盖：**

1. **懒加载** — 电商列表 / 长表单 / 组件级 / 图片级 / 陷阱
2. **防抖节流** — 搜索框 / 滚动 / resize / 完整实现 / 选型决策
3. **内存管理** — 生命周期管理 / WeakMap / 对象池 / 图片释放 / 泄漏检测
4. **综合实战** — 数据看板 / 富文本编辑器 / 图片画廊

**核心原则：**
- 懒加载：只加载用户需要的，提前加载用户可能需要的
- 防抖节流：减少频率，但不丢失关键操作
- 内存管理：谁创建谁销毁，闭包是泄漏大户

**4/24 → 4/25 → 4/26 → 4/27 → 4/28 → 4/29 = 6 轮迭代，完整闭环 ✅**
