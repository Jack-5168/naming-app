# Web 性能优化专项训练

> 2026-05-01 05:00 | 阶段二 Day 1 附加专项
> 三大核心：懒加载 / 防抖节流 / 内存管理

---

## 一、懒加载 (Lazy Loading)

### 1.1 核心思想

**按需加载，延迟初始化。** 不在页面加载时一次性加载所有资源，而是在真正需要时才加载。

```
传统加载:  [资源1][资源2][资源3][资源4][资源5] ← 首屏阻塞
懒加载:   [资源1]················[资源4]        ← 滚动到才加载
```

### 1.2 Intersection Observer API — 现代懒加载基石

```js
// ===== 1.2.1 图片懒加载 (Intersection Observer) =====
class LazyImage {
  constructor(options = {}) {
    this.rootMargin = options.rootMargin || "50px"; // 提前 50px 开始加载
    this.threshold = options.threshold || 0.01; // 1% 可见即触发
    this.placeholder = options.placeholder || "data:image/svg+xml,...";
    this.loadingCount = 0;
    this.maxConcurrent = options.maxConcurrent || 4; // 并发加载上限
    this.queue = [];

    this.observer = new IntersectionObserver(
      (entries) => this._handleIntersect(entries),
      { rootMargin: this.rootMargin, threshold: this.threshold },
    );
  }

  observe(imgEl) {
    if (!imgEl.dataset.src) return;
    imgEl.src = this.placeholder; // 占位图
    this.observer.observe(imgEl);
  }

  observeAll(selector) {
    document.querySelectorAll(selector).forEach((el) => this.observe(el));
  }

  _handleIntersect(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        this.observer.unobserve(img); // 停止观察，避免重复触发

        if (this.loadingCount >= this.maxConcurrent) {
          // 超过并发上限，加入队列
          this.queue.push(img);
          return;
        }

        this._loadImage(img);
      }
    });
  }

  _loadImage(img) {
    this.loadingCount++;
    img.classList.add("loading");

    const tempImg = new Image();
    tempImg.onload = () => {
      img.src = img.dataset.src;
      img.classList.remove("loading");
      img.classList.add("loaded");
      this.loadingCount--;
      this._flushQueue(); // 尝试处理队列
    };
    tempImg.onerror = () => {
      img.classList.remove("loading");
      img.classList.add("error");
      this.loadingCount--;
      this._flushQueue();
    };
    tempImg.src = img.dataset.src;
  }

  _flushQueue() {
    while (this.queue.length > 0 && this.loadingCount < this.maxConcurrent) {
      const img = this.queue.shift();
      this._loadImage(img);
    }
  }

  destroy() {
    this.observer.disconnect();
    this.queue = [];
  }
}

// ===== 1.2.2 使用示例 =====
const lazyImg = new LazyImage({
  rootMargin: "100px",
  maxConcurrent: 3,
});
lazyImg.observeAll("img[data-src]");

// ===== 1.2.3 组件懒加载 (Vue 3 异步组件) =====
// Vue 3 内置 lazy loading
const LazyChart = defineAsyncComponent({
  loader: () => import("./HeavyChart.vue"),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorFallback,
  delay: 200, // 延迟 200ms 才显示 loading
  timeout: 10000, // 10s 超时
  suspensible: false, // 不使用 Suspense
});

// ===== 1.2.4 路由懒加载 (Vue Router) =====
const routes = [
  // 首页同步加载
  { path: "/", component: Home },
  // 其他路由按需加载，每个 chunk 独立
  { path: "/dashboard", component: () => import("./views/Dashboard.vue") },
  { path: "/settings", component: () => import("./views/Settings.vue") },
  // 分组加载：多个路由共享同一个 chunk
  {
    path: "/admin/*",
    component: () =>
      import(/* webpackChunkName: "admin" */ "./views/Admin.vue"),
  },
];
```

### 1.3 高级懒加载模式

```js
// ===== 1.3.1 资源优先级懒加载 (Priority Hints) =====
class PriorityLoader {
  constructor() {
    this.highQueue = []; // 高优先级（视口内）
    this.lowQueue = []; // 低优先级（视口外）
    this.active = 0;
    this.maxActive = 3;
  }

  load(url, priority = "low") {
    const queue = priority === "high" ? this.highQueue : this.lowQueue;
    return new Promise((resolve, reject) => {
      queue.push({ url, resolve, reject });
      this._process();
    });
  }

  _process() {
    while (this.active < this.maxActive) {
      const item = this.highQueue.shift() || this.lowQueue.shift();
      if (!item) break;
      this.active++;
      this._fetch(item.url)
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this.active--;
          this._process();
        });
    }
  }

  _fetch(url) {
    return fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(r)));
  }
}

// ===== 1.3.2 预取 (Prefetch) + 懒加载组合 =====
class PrefetchLoader {
  constructor() {
    this.cache = new Map();
    this.observer = new IntersectionObserver(
      (entries) => this._handleIntersect(entries),
      { rootMargin: "200px" }, // 更远的预取距离
    );
  }

  prefetch(url) {
    if (this.cache.has(url)) return Promise.resolve(this.cache.get(url));
    return fetch(url)
      .then((r) => r.text())
      .then((text) => {
        this.cache.set(url, text);
        return text;
      });
  }

  _handleIntersect(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const url = entry.target.dataset.prefetch;
        if (url) this.prefetch(url); // 预取，不阻塞渲染
        this.observer.unobserve(entry.target);
      }
    });
  }
}

// ===== 1.3.3 虚拟滚动 (Virtual Scroll) — 极致懒加载 =====
class VirtualList {
  constructor(container, options) {
    this.container = container;
    this.itemHeight = options.itemHeight;
    this.items = options.items || [];
    this.visibleCount = Math.ceil(container.clientHeight / this.itemHeight);
    this.startIndex = 0;
    this.scrollTop = 0;

    this.contentEl = document.createElement("div");
    this.contentEl.style.position = "relative";
    container.style.overflow = "auto";
    container.innerHTML = "";
    container.appendChild(this.contentEl);

    this._bindEvents();
    this._render();
  }

  _bindEvents() {
    // 节流滚动事件
    let ticking = false;
    this.container.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.scrollTop = this.container.scrollTop;
          this._render();
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  _render() {
    this.startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const end = Math.min(
      this.startIndex + this.visibleCount + 2,
      this.items.length,
    );
    const visibleItems = this.items.slice(this.startIndex, end);

    // 总高度撑开滚动条
    this.contentEl.style.height = `${this.items.length * this.itemHeight}px`;

    // 只渲染可见区域 + 缓冲区
    this.contentEl.innerHTML = visibleItems
      .map((item, i) => {
        const idx = this.startIndex + i;
        const top = idx * this.itemHeight;
        return `<div style="position:absolute;top:${top}px;height:${this.itemHeight}px;width:100%;">${item}</div>`;
      })
      .join("");
  }

  update(items) {
    this.items = items;
    this._render();
  }
}

// 使用：10 万条数据，只渲染 ~15 个 DOM 节点
const list = new VirtualList(document.getElementById("list"), {
  itemHeight: 50,
  items: Array.from({ length: 100000 }, (_, i) => `Item ${i}`),
});
```

---

## 二、防抖与节流 (Debounce & Throttle)

### 2.1 核心区别

```
防抖 (Debounce):  事件触发后等待 N ms，期间再次触发则重置计时
                   → "等你安静下来我再执行"
                   适用：搜索框输入、窗口 resize、表单验证

节流 (Throttle):  事件触发后 N ms 内只执行一次
                   → "我按固定频率执行，不管你怎么触发"
                   适用：滚动事件、鼠标移动、按钮防重复点击
```

### 2.2 防抖 — 完整实现

```js
// ===== 2.2.1 基础防抖 =====
function debounce(fn, delay = 300, options = {}) {
  const { leading = false, trailing = true, maxWait = 0 } = options;
  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  let lastCallTime = 0;
  let invokeCount = 0;

  function invoke(args, thisArg) {
    invokeCount++;
    fn.apply(thisArg, args);
  }

  function startTimer(timerId, wait) {
    return setTimeout(timerId, wait);
  }

  function debounced(...args) {
    const now = Date.now();
    lastArgs = args;
    lastThis = this;
    lastCallTime = now;

    const shouldInvoke = shouldInvokeNow(now);

    if (shouldInvoke) {
      return leadingEdge();
    }

    // 设置/重置定时器
    if (timer !== null) {
      clearTimeout(timer);
    }

    // maxWait 机制：如果距上次执行超过 maxWait，强制执行
    let wait = delay;
    if (maxWait > 0) {
      const timeSinceLastInvoke = now - (lastCallTime - delay);
      if (timeSinceLastInvoke >= maxWait) {
        return leadingEdge();
      }
      wait = Math.min(delay, maxWait - timeSinceLastInvoke);
    }

    timer = startTimer(timerId, wait);
    return lastCallTime; // 返回最后调用时间
  }

  function timerId() {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    if (timeSinceLastCall < delay) {
      // 还没到 delay，继续等待
      timer = startTimer(timerId, delay - timeSinceLastCall);
    } else {
      // 时间到了，执行 trailing
      timer = null;
      if (trailing && lastArgs) {
        invoke(lastArgs, lastThis);
      }
      lastArgs = lastThis = null;
    }
  }

  function shouldInvokeNow(now) {
    const timeSinceLastCall = now - lastCallTime;
    return (
      (lastCallTime === 0 && leading) ||
      timeSinceLastCall >= delay ||
      (maxWait > 0 && timeSinceLastCall >= maxWait)
    );
  }

  function leadingEdge() {
    timer = startTimer(timerId, delay);
    lastCallTime = Date.now();
    if (leading) {
      return invoke(lastArgs, lastThis);
    }
    return lastCallTime;
  }

  // 取消
  debounced.cancel = function () {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastArgs = lastThis = null;
    invokeCount = 0;
  };

  // 立即执行
  debounced.flush = function () {
    if (timer !== null && lastArgs) {
      clearTimeout(timer);
      timer = null;
      return invoke(lastArgs, lastThis);
    }
  };

  // 获取调用次数
  debounced.count = () => invokeCount;

  return debounced;
}

// ===== 2.2.2 使用示例 =====

// 搜索框 — trailing 模式（默认）
const searchInput = document.getElementById("search");
const search = debounce((query) => {
  console.log("搜索:", query);
  fetch(`/api/search?q=${encodeURIComponent(query)}`)
    .then((r) => r.json())
    .then((data) => renderResults(data));
}, 500);

searchInput.addEventListener("input", (e) => search(e.target.value));

// 按钮防重复提交 — leading 模式
const submitBtn = document.getElementById("submit");
const submit = debounce(
  () => {
    console.log("提交表单");
    submitBtn.disabled = true;
    return fetch("/api/submit", { method: "POST" })
      .then((r) => r.json())
      .finally(() => {
        submitBtn.disabled = false;
        submit.cancel();
      });
  },
  2000,
  { leading: true, trailing: false },
);

submitBtn.addEventListener("click", submit);

// 窗口 resize — maxWait 保底
const handleResize = debounce(
  () => {
    console.log("窗口尺寸:", window.innerWidth, window.innerHeight);
    recalculateLayout();
  },
  250,
  { maxWait: 1000 },
); // 至少每 1s 执行一次

window.addEventListener("resize", handleResize);
```

### 2.3 节流 — 完整实现

```js
// ===== 2.3.1 基础节流 =====
function throttle(fn, interval = 300, options = {}) {
  const { leading = true, trailing = true } = options;
  let lastTime = 0;
  let timer = null;
  let lastArgs = null;
  let lastThis = null;

  function invoke(args, thisArg) {
    lastTime = Date.now();
    fn.apply(thisArg, args);
  }

  function throttled(...args) {
    const now = Date.now();
    lastArgs = args;
    lastThis = this;

    const remaining = interval - (now - lastTime);

    // leading: 第一次立即执行
    if (remaining <= 0 || remaining > interval) {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (leading) {
        invoke(lastArgs, lastThis);
      }
      return;
    }

    // trailing: 最后一次在 interval 结束时执行
    if (trailing && timer === null) {
      timer = setTimeout(() => {
        timer = null;
        lastTime = leading ? Date.now() : 0;
        invoke(lastArgs, lastThis);
        lastArgs = lastThis = null;
      }, remaining);
    }
  }

  throttled.cancel = function () {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastTime = 0;
    lastArgs = lastThis = null;
  };

  return throttled;
}

// ===== 2.3.2 使用示例 =====

// 滚动事件 — 无限滚动
const scrollHandler = throttle(() => {
  const scrollTop = window.scrollY;
  const windowHeight = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;

  if (scrollTop + windowHeight >= docHeight - 500) {
    loadMore(); // 距离底部 500px 加载
  }
}, 100);

window.addEventListener("scroll", scrollHandler, { passive: true });

// 鼠标跟随 — 光标轨迹
const mouseHandler = throttle((e) => {
  cursor.style.left = e.clientX + "px";
  cursor.style.top = e.clientY + "px";
}, 16); // ~60fps

document.addEventListener("mousemove", mouseHandler);

// 按钮防抖+节流组合
const clickHandler = throttle(
  debounce(
    () => {
      console.log("执行");
    },
    100,
    { leading: true },
  ),
  1000,
  { leading: true, trailing: false },
);
```

### 2.4 动画帧优化 (requestAnimationFrame)

```js
// ===== 2.4.1 rAF 节流 — 比 setTimeout 更平滑 =====
class RAFThrottle {
  constructor(fn) {
    this.fn = fn;
    this.pending = false;
    this.lastArgs = null;
  }

  execute(...args) {
    this.lastArgs = args;
    if (!this.pending) {
      this.pending = true;
      requestAnimationFrame(() => {
        this.fn.apply(this, this.lastArgs);
        this.pending = false;
      });
    }
  }
}

// 使用
const rafScroll = new RAFThrottle((scrollTop) => {
  // 更新 UI — 浏览器保证在下一帧前执行
  progressBar.style.width = `${(scrollTop / maxScroll) * 100}%`;
});
window.addEventListener("scroll", (e) => rafScroll.execute(window.scrollY));

// ===== 2.4.2 性能对比 =====
/*
  事件频率: 1000 次/秒 (mousemove)

  无优化:      1000 次回调 → 页面卡顿 ❌
  throttle:    ~33 次/秒 (300ms) → 流畅 ✅
  rAF:         ~60 次/秒 → 最流畅 ✅✅
  debounce:    取决于停止时间 → 适合输入场景
*/
```

---

## 三、内存管理 (Memory Management)

### 3.1 JavaScript 内存生命周期

```
1. 分配内存:  let obj = { a: 1 };  // JS 自动分配
2. 使用内存:  obj.a = 2;           // 读写操作
3. 释放内存:  obj = null;          // 断开引用 → GC 回收
```

### 3.2 常见内存泄漏模式

```js
// ===== 3.2.1 泄漏模式 1: 意外的全局变量 =====
function createLeak() {
  // ❌ 没有 var/let/const → 变成全局变量
  leakyData = Array.from({ length: 1000000 }, (_, i) => i);
}
createLeak();
// window.leakyData 永远存在，即使函数执行完毕

// ✅ 修复: 严格模式 + 显式声明
("use strict");
function noLeak() {
  const cleanData = Array.from({ length: 1000000 }, (_, i) => i);
  // 函数结束，cleanData 被 GC
}

// ===== 3.2.2 泄漏模式 2: 闭包持有大对象 =====
function processLargeData() {
  const largeData = new Array(1000000).fill("x"); // 大数组
  const result = largeData.filter((x) => x === "x");

  // ❌ 闭包持有了整个 largeData
  return function getFirst() {
    return result[0]; // 只需要 result，但 largeData 也被持有
  };
}

// ✅ 修复: 只保留需要的数据
function processClean() {
  const largeData = new Array(1000000).fill("x");
  const result = largeData.filter((x) => x === "x");

  // 显式释放
  largeData.length = 0;

  return function getFirst() {
    return result[0];
  };
}

// ===== 3.2.3 泄漏模式 3: 未清理的事件监听器 =====
class EventLeak {
  constructor() {
    this.data = new Array(500000).fill("leak");
    // ❌ 绑定事件但从未移除
    window.addEventListener("resize", this._onResize);
    document.addEventListener("click", this._onClick);
  }

  _onResize = () => console.log("resize");
  _onClick = () => console.log("click");

  // ✅ 必须提供清理方法
  destroy() {
    window.removeEventListener("resize", this._onResize);
    document.removeEventListener("click", this._onClick);
    this.data = null; // 释放数据
  }
}

// ===== 3.2.4 泄漏模式 4: Timer 泄漏 =====
class TimerLeak {
  constructor() {
    this.interval = null;
    this.timeout = null;
  }

  start() {
    // ❌ 未保存引用，无法清理
    setInterval(() => {
      console.log("tick");
    }, 1000);

    // ✅ 保存引用
    this.interval = setInterval(() => {
      console.log("tick");
    }, 1000);
  }

  stop() {
    // ✅ 清理
    if (this.interval) clearInterval(this.interval);
    if (this.timeout) clearTimeout(this.timeout);
    this.interval = null;
    this.timeout = null;
  }

  destroy() {
    this.stop();
  }
}

// ===== 3.2.5 泄漏模式 5: DOM 引用泄漏 =====
const leakedElements = []; // ❌ 全局缓存 DOM 引用

function cacheElements() {
  document.querySelectorAll(".item").forEach((el) => {
    leakedElements.push(el); // DOM 节点被引用，即使从页面移除也不会 GC
  });
}

// ✅ 使用 WeakMap — DOM 移除后自动释放
const elementCache = new WeakMap();

function cacheClean(el) {
  elementCache.set(el, { createdAt: Date.now(), meta: "..." });
  // el 从 DOM 移除后，WeakMap 中的条目自动被 GC
}

// ===== 3.2.6 泄漏模式 6: 未清理的 Map/Set =====
class SessionManager {
  constructor() {
    this.sessions = new Map(); // ❌ 只增不减
  }

  addSession(id, data) {
    this.sessions.set(id, data);
  }

  // ✅ 定期清理过期 session
  cleanup(maxAge = 30 * 60 * 1000) {
    // 30 分钟
    const now = Date.now();
    for (const [id, data] of this.sessions) {
      if (now - data.createdAt > maxAge) {
        this.sessions.delete(id);
      }
    }
  }
}
```

### 3.3 WeakRef & FinalizationRegistry

```js
// ===== 3.3.1 WeakRef — 弱引用，不阻止 GC =====
class Cache {
  constructor() {
    this.store = new Map();
  }

  set(key, value) {
    // 用 WeakRef 包装值，GC 可以回收
    this.store.set(key, new WeakRef(value));
  }

  get(key) {
    const ref = this.store.get(key);
    return ref ? ref.deref() : undefined; // deref() 返回实际值或 undefined
  }

  has(key) {
    const ref = this.store.get(key);
    return ref ? ref.deref() !== undefined : false;
  }

  delete(key) {
    this.store.delete(key);
  }
}

// 使用
const cache = new Cache();
let bigObj = { data: new Array(1000000).fill(1) };
cache.set("big", bigObj);
console.log(cache.has("big")); // true

bigObj = null; // 断开强引用 → GC 可以回收
// GC 后: cache.get('big') → undefined

// ===== 3.3.2 FinalizationRegistry — 对象被 GC 时的回调 =====
const registry = new FinalizationRegistry((heldValue) => {
  console.log(`对象被回收: ${heldValue}`);
  // 清理关联资源
});

function createResource(name) {
  const resource = { name, handle: Math.random() };
  registry.register(resource, name);
  return resource;
}

let res = createResource("test-resource");
res = null; // GC 后触发回调

// ===== 3.3.3 实际场景: DOM 元素清理 =====
class ComponentRegistry {
  constructor() {
    this.components = new Map();
    this.registry = new FinalizationRegistry((componentId) => {
      console.log(`组件 ${componentId} 被 GC，清理关联资源`);
      this.components.delete(componentId);
    });
  }

  register(componentId, component) {
    this.components.set(componentId, component);
    this.registry.register(component, componentId);
  }
}
```

### 3.4 内存管理最佳实践

```js
// ===== 3.4.1 资源清理模式 (RAII) =====
class ResourceManager {
  constructor() {
    this._cleanups = [];
  }

  // 注册清理函数
  onCleanup(fn) {
    this._cleanups.push(fn);
  }

  // 统一清理
  dispose() {
    this._cleanups.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error("Cleanup error:", e);
      }
    });
    this._cleanups = [];
  }
}

// 使用
function initFeature() {
  const rm = new ResourceManager();

  const timer = setInterval(() => {}, 1000);
  rm.onCleanup(() => clearInterval(timer));

  const handler = () => {};
  window.addEventListener("resize", handler);
  rm.onCleanup(() => window.removeEventListener("resize", handler));

  const observer = new IntersectionObserver(() => {});
  rm.onCleanup(() => observer.disconnect());

  // 返回 dispose 方法
  return { dispose: () => rm.dispose() };
}

// ===== 3.4.2 对象池 — 减少 GC 压力 =====
class ObjectPool {
  constructor(factory, resetFn, initialSize = 10) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.pool = [];
    this.active = new Set();

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire() {
    const obj = this.pool.pop() || this.factory();
    this.active.add(obj);
    return obj;
  }

  release(obj) {
    this.active.delete(obj);
    this.resetFn(obj);
    this.pool.push(obj);
  }

  size() {
    return { pool: this.pool.length, active: this.active.size };
  }
}

// 使用: 粒子系统
const particlePool = new ObjectPool(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, active: false }),
  (p) => {
    p.x = p.y = p.vx = p.vy = p.life = 0;
    p.active = false;
  },
  100,
);

function spawnParticle(x, y) {
  const p = particlePool.acquire();
  p.x = x;
  p.y = y;
  p.active = true;
  return p;
}

function killParticle(p) {
  particlePool.release(p);
}

// ===== 3.4.3 分块处理 — 避免长任务阻塞 =====
class ChunkProcessor {
  constructor(chunkSize = 100) {
    this.chunkSize = chunkSize;
  }

  async process(items, fn) {
    const results = [];
    for (let i = 0; i < items.length; i += this.chunkSize) {
      const chunk = items.slice(i, i + this.chunkSize);
      for (const item of chunk) {
        results.push(await fn(item));
      }
      // 让出主线程，允许浏览器渲染
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return results;
  }
}

// 使用: 处理 10 万条数据不卡顿
const processor = new ChunkProcessor(200);
processor
  .process(largeArray, async (item) => {
    return transform(item);
  })
  .then((results) => console.log("处理完成"));

// ===== 3.4.4 内存监控工具 =====
class MemoryMonitor {
  constructor() {
    this.samples = [];
  }

  sample(label) {
    if (performance.memory) {
      this.samples.push({
        label,
        time: Date.now(),
        usedJSHeap: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
        totalJSHeap: Math.round(performance.memory.totalJSHeapSize / 1048576),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576),
      });
    }
    return this.samples[this.samples.length - 1];
  }

  report() {
    if (this.samples.length < 2) return "需要至少两个采样点";
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const growth = last.usedJSHeap - first.usedJSHeap;
    return `内存变化: ${first.usedJSHeap}MB → ${last.usedJSHeap}MB (${growth > 0 ? "+" : ""}${growth}MB)`;
  }
}

// 使用
const monitor = new MemoryMonitor();
monitor.sample("before");
doSomething();
monitor.sample("after");
console.log(monitor.report());
```

---

## 四、综合优化示例

### 4.1 高性能图片画廊

```js
// ===== 4.1.1 完整优化方案 =====
class OptimizedGallery {
  constructor(container) {
    this.container = container;
    this.images = [];
    this.lazyLoader = new LazyImage({
      rootMargin: "200px",
      maxConcurrent: 4,
    });

    // 防抖 resize
    this.handleResize = debounce(() => this.recalculate(), 200);

    // 节流滚动
    this.handleScroll = throttle(() => this.checkVisible(), 100);

    this._init();
  }

  _init() {
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("scroll", this.handleScroll);
  }

  loadImages(urls) {
    // 分块渲染，避免长任务
    const fragment = document.createDocumentFragment();
    urls.forEach((url) => {
      const img = document.createElement("img");
      img.dataset.src = url;
      img.loading = "lazy"; // 原生懒加载
      img.decoding = "async"; // 异步解码
      img.classList.add("gallery-item");
      fragment.appendChild(img);
      this.images.push(img);
    });
    this.container.appendChild(fragment);

    // 启动懒加载观察
    this.images.forEach((img) => this.lazyLoader.observe(img));
  }

  recalculate() {
    // 根据容器宽度计算列数
    const cols = Math.max(1, Math.floor(this.container.clientWidth / 300));
    this.container.style.columnCount = cols;
  }

  checkVisible() {
    // 只更新可见区域的图片
    const rect = this.container.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      // 完全不可见，暂停加载
      this.lazyLoader.observer.takeRecords();
    }
  }

  // 清理 — 防止内存泄漏
  destroy() {
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("scroll", this.handleScroll);
    this.handleResize.cancel();
    this.handleScroll.cancel();
    this.lazyLoader.destroy();
    this.images = null;
  }
}

// ===== 4.1.2 使用 =====
const gallery = new OptimizedGallery(document.getElementById("gallery"));
gallery.loadImages(imageUrls);

// 组件卸载时清理
// gallery.destroy();
```

### 4.2 高性能搜索组件

```js
class OptimizedSearch {
  constructor(inputEl, resultsEl) {
    this.input = inputEl;
    this.results = resultsEl;
    this.cache = new Map();
    this.abortController = null;

    // 防抖搜索
    this.search = debounce((query) => this._fetch(query), 300);

    // 键盘导航
    this.selectedIndex = -1;

    this._bind();
  }

  _bind() {
    this.input.addEventListener("input", (e) => {
      const query = e.target.value.trim();
      if (query.length < 2) {
        this.results.innerHTML = "";
        return;
      }

      // 命中缓存直接返回
      if (this.cache.has(query)) {
        this._render(this.cache.get(query));
        return;
      }

      this.search(query);
    });

    // 键盘导航
    this.input.addEventListener("keydown", (e) => {
      const items = this.results.querySelectorAll(".item");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
        this._highlight(items);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this._highlight(items);
      } else if (e.key === "Enter" && this.selectedIndex >= 0) {
        items[this.selectedIndex]?.click();
      }
    });
  }

  async _fetch(query) {
    // 取消上一次请求
    if (this.abortController) this.abortController.abort();
    this.abortController = new AbortController();

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: this.abortController.signal,
      });
      const data = await res.json();
      this.cache.set(query, data); // 缓存结果
      this._render(data);
    } catch (e) {
      if (e.name !== "AbortError") console.error(e);
    }
  }

  _render(items) {
    // DocumentFragment 批量 DOM 操作
    const fragment = document.createDocumentFragment();
    items.slice(0, 10).forEach((item) => {
      const div = document.createElement("div");
      div.className = "item";
      div.textContent = item.text;
      div.addEventListener("click", () => this._select(item));
      fragment.appendChild(div);
    });
    this.results.innerHTML = "";
    this.results.appendChild(fragment);
    this.selectedIndex = -1;
  }

  _highlight(items) {
    items.forEach((el, i) => {
      el.classList.toggle("active", i === this.selectedIndex);
    });
  }

  _select(item) {
    this.input.value = item.text;
    this.results.innerHTML = "";
  }

  destroy() {
    this.search.cancel();
    if (this.abortController) this.abortController.abort();
    this.cache.clear();
  }
}
```

---

## 五、性能优化 Checklist

```
┌─────────────────────────────────────────────────┐
│              Web 性能优化 Checklist              │
├─────────────────────────────────────────────────┤
│                                                 │
│  加载优化:                                       │
│  □ 图片懒加载 (Intersection Observer)           │
│  □ 路由懒加载 (动态 import)                      │
│  □ 组件懒加载 (defineAsyncComponent)             │
│  □ 预取关键资源 (prefetch/preload)               │
│  □ 代码分割 (SplitChunks)                        │
│                                                 │
│  渲染优化:                                       │
│  □ 虚拟滚动 (大列表)                             │
│  □ requestAnimationFrame (动画)                  │
│  □ DocumentFragment (批量 DOM)                   │
│  □ CSS transform (GPU 加速)                      │
│  □ will-change (提示浏览器)                       │
│                                                 │
│  事件优化:                                       │
│  □ 防抖 (搜索/resize/表单验证)                    │
│  □ 节流 (滚动/mousemove/按钮)                    │
│  □ passive: true (滚动/触摸)                     │
│  □ 事件委托 (减少监听器)                         │
│                                                 │
│  内存优化:                                       │
│  □ 清理事件监听器                                │
│  □ 清理 Timer                                    │
│  □ 使用 WeakMap/WeakRef                          │
│  □ 对象池 (高频创建/销毁)                        │
│  □ 分块处理 (避免长任务)                         │
│  □ 避免全局变量泄漏                              │
│                                                 │
│  网络优化:                                       │
│  □ 请求取消 (AbortController)                    │
│  □ 结果缓存 (Map/WeakMap)                        │
│  □ 请求合并                                      │
│  □ 压缩传输 (gzip/brotli)                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 六、关键要点总结

| 技术                  | 适用场景           | 核心优势                       |
| --------------------- | ------------------ | ------------------------------ |
| Intersection Observer | 图片/组件懒加载    | 原生 API，性能优于 scroll 事件 |
| 虚拟滚动              | 大列表 (1000+ 项)  | DOM 节点从 N → ~20             |
| Debounce              | 搜索输入、resize   | 减少无效请求                   |
| Throttle              | 滚动、mousemove    | 保证最低执行频率               |
| requestAnimationFrame | 动画、滚动更新     | 与屏幕刷新率同步               |
| WeakMap/WeakRef       | DOM 缓存、对象缓存 | 自动 GC，不泄漏                |
| ObjectPool            | 粒子系统、高频对象 | 减少 GC 压力                   |
| ChunkProcessor        | 大数据处理         | 避免主线程阻塞                 |
| AbortController       | 搜索请求           | 取消过期请求                   |
| DocumentFragment      | 批量 DOM           | 单次重排                       |

---

_专项完成时间: 2026-05-01 05:00 | 文件: phase2-vue3/05-performance-optimization.md_
