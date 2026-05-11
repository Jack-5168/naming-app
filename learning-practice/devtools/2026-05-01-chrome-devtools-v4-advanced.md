# 🔧 Chrome DevTools v4 — 高级调试实战

**时间：** 2026-05-01 16:00  
**专项：** 调试技能 v4  
**目标：** 超越基础，掌握生产环境调试、自动化调试、复杂场景诊断  
**重点：** 生产调试 / 自动化 / 复杂场景 / 调试工作流

---

## 📑 目录

1. [生产环境调试](#一生产环境调试)
2. [自动化调试工作流](#二自动化调试工作流)
3. [复杂场景诊断](#三复杂场景诊断)
4. [Chrome DevTools Protocol (CDP)](#四chrome-devtools-protocol-cdp)
5. [调试模式与反模式](#五调试模式与反模式)
6. [实战案例](#六实战案例)

---

## 一、生产环境调试

### 1.1 Source Map 调试

生产代码经过压缩混淆，Source Map 是调试的桥梁。

```javascript
// === 构建配置：生成 Source Map ===

// Webpack 5
module.exports = {
  devtool: 'source-map', // 生产推荐：完整 source map
  // devtool: 'hidden-source-map', // 不引用但生成，手动上传
  // devtool: 'nosources-source-map', // 堆栈有行号但无源码（安全）
  optimization: {
    moduleIds: 'deterministic', // 稳定的模块 ID
    chunkIds: 'deterministic',  // 稳定的 chunk ID
  },
};

// Vite
export default defineConfig({
  build: {
    sourcemap: true,        // 生成 .map 文件
    // sourcemap: 'hidden',  // 不注入引用
    minify: 'terser',
    terserOptions: {
      keep_classnames: true,  // 保留类名（调试用）
      keep_fnames: true,      // 保留函数名（调试用）
    },
  },
});

// Rollup
export default {
  output: {
    sourcemap: true,
    sourcemapExcludeSources: true, // 排除源码内容
  },
};
```

```javascript
// === Source Map 类型对比 ===
// eval           — 最快，仅开发用，内联 eval 字符串
// inline-source-map — 完整 map，内联 data URL，开发用
// cheap-source-map   — 无列信息，loader 转换后源码，开发用
// cheap-module-source-map — 无列信息，loader 前源码，开发用
// source-map     — 完整 map，独立 .map 文件，生产推荐
// hidden-source-map — 生成但不注入引用，手动上传
// nosources-source-map — 有堆栈无源码，安全敏感场景
```

### 1.2 远程调试移动设备

```javascript
// === USB 远程调试 Android ===
// 1. Android 设备开启 USB 调试
// 2. Chrome 地址栏输入 chrome://inspect
// 3. 选择设备 → inspect

// === Wi-Fi 远程调试 ===
// Chrome 110+ 支持 Wi-Fi 调试
// 1. chrome://inspect → Configure → 添加 IP:端口
// 2. 设备浏览器访问同一网络

// === iOS 远程调试 ===
// 1. Safari → 偏好设置 → 高级 → 显示"开发"菜单
// 2. iOS 设备 → 设置 → Safari → 高级 → Web 检查器
// 3. Mac Safari → 开发 → 选择设备

// === 模拟移动设备 ===
// DevTools → Toggle device toolbar (Ctrl+Shift+M)
// 可模拟：网络节流、CPU 节流、设备像素比、触摸事件
```

### 1.3 生产环境日志策略

```javascript
// === 分级日志系统 ===
class ProductionLogger {
  constructor(env = 'production') {
    this.env = env;
    this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    this.currentLevel = this.getLevelForEnv(env);
    this.sessionId = crypto.randomUUID();
    this.buffer = [];
    this.maxBuffer = 100;
  }

  getLevelForEnv(env) {
    const map = { development: 0, staging: 1, production: 2 };
    return map[env] ?? 2;
  }

  log(level, message, data = {}) {
    if (this.levels[level] < this.currentLevel) return;

    const entry = {
      ts: Date.now(),
      level,
      message,
      session: this.sessionId,
      url: location.href,
      ...data,
    };

    // 生产环境：发送到日志服务
    if (this.env === 'production') {
      this.buffer.push(entry);
      if (this.buffer.length >= this.maxBuffer) {
        this.flush();
      }
      // 错误级别立即发送
      if (level === 'ERROR') this.flush();
    } else {
      console[level.toLowerCase()](message, data);
    }
  }

  flush() {
    if (this.buffer.length === 0) return;
    const entries = [...this.buffer];
    this.buffer = [];
    // 使用 sendBeacon 确保页面关闭时也能发送
    navigator.sendBeacon('/api/logs', JSON.stringify(entries));
  }

  debug(msg, data) { this.log('DEBUG', msg, data); }
  info(msg, data) { this.log('INFO', msg, data); }
  warn(msg, data) { this.log('WARN', msg, data); }
  error(msg, data) { this.log('ERROR', msg, data); }
}

const logger = new ProductionLogger(process.env.NODE_ENV);

// === 使用示例 ===
logger.info('User clicked checkout', { userId: '123', cartItems: 3 });
logger.error('API request failed', {
  url: '/api/checkout',
  status: 500,
  responseTime: 2340,
});

// === 全局错误捕获 ===
window.addEventListener('error', (event) => {
  logger.error('Uncaught error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled rejection', {
    reason: event.reason?.message || event.reason,
    stack: event.reason?.stack,
  });
});
```

### 1.4 Performance Mark 与 User Timing

```javascript
// === 自定义性能标记 ===
function markPhase(name) {
  performance.mark(`${name}-start`);
  return () => performance.mark(`${name}-end`);
}

// 标记关键阶段
const endFetch = markPhase('data-fetch');
fetch('/api/data')
  .then(r => r.json())
  .then(data => {
    endFetch();
    return data;
  });

const endRender = markPhase('render');
// ... 渲染逻辑 ...
endRender();

// === 测量阶段耗时 ===
performance.measure('fetch-duration', 'data-fetch-start', 'data-fetch-end');
performance.measure('render-duration', 'render-start', 'render-end');

// === 在 DevTools Performance 面板查看 ===
// 标记会显示为彩色竖线，measure 显示为彩色条
// 也可通过 JS 读取：
const measures = performance.getEntriesByType('measure');
measures.forEach(m => {
  console.log(`${m.name}: ${m.duration.toFixed(2)}ms`);
});

// === Core Web Vitals 手动测量 ===
// LCP (Largest Contentful Paint)
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
}).observe({ type: 'largest-contentful-paint', buffered: true });

// FID (First Input Delay)
new PerformanceObserver((list) => {
  list.getEntries().forEach(entry => {
    console.log('FID:', entry.processingStart - entry.startTime);
  });
}).observe({ type: 'first-input', buffered: true });

// CLS (Cumulative Layout Shift)
let clsValue = 0;
new PerformanceObserver((list) => {
  list.getEntries().forEach(entry => {
    if (!entry.hadRecentInput) {
      clsValue += entry.value;
    }
  });
  console.log('CLS:', clsValue);
}).observe({ type: 'layout-shift', buffered: true });
```

---

## 二、自动化调试工作流

### 2.1 Snippets 自动化脚本

```javascript
// === Snippet: 检测内存泄漏候选 ===
// 在 Console 面板粘贴运行，或保存为 Snippet
(function detectMemoryLeaks() {
  const results = {
    detachedDOM: [],
    closures: [],
    timers: [],
    eventListeners: [],
  };

  // 1. 检测分离的 DOM 节点
  const allElements = document.querySelectorAll('*');
  allElements.forEach(el => {
    if (!document.contains(el)) {
      results.detachedDOM.push({
        tag: el.tagName,
        id: el.id,
        className: el.className,
      });
    }
  });

  // 2. 检测全局变量泄漏
  const expectedGlobals = new Set([
    'window', 'document', 'navigator', 'location',
    'console', 'setTimeout', 'setInterval', 'fetch',
    'Promise', 'JSON', 'Math', 'Array', 'Object',
    'String', 'Number', 'Boolean', 'Symbol', 'Map',
    'Set', 'WeakMap', 'WeakSet', 'Proxy', 'Reflect',
    'Error', 'PerformanceObserver', 'ResizeObserver',
    'IntersectionObserver', 'MutationObserver',
    'performance', 'crypto', 'btoa', 'atob',
    'requestAnimationFrame', 'cancelAnimationFrame',
    'requestIdleCallback', 'cancelIdleCallback',
    'queueMicrotask', 'structuredClone',
    'history', 'screen', 'frames', 'parent', 'top',
    'self', 'localStorage', 'sessionStorage',
    'indexedDB', 'caches', 'Worker', 'SharedWorker',
    'Audio', 'Image', 'WebAssembly', 'Intl',
    'RegExp', 'Date', 'Float32Array', 'Float64Array',
    'Int8Array', 'Int16Array', 'Int32Array',
    'Uint8Array', 'Uint16Array', 'Uint32Array',
    'DataView', 'ArrayBuffer', 'SharedArrayBuffer',
    'Atomics', 'TextEncoder', 'TextDecoder',
    'URL', 'URLSearchParams', 'FormData', 'Headers',
    'Request', 'Response', 'WebSocket', 'EventSource',
    'BroadcastChannel', 'MessageChannel', 'MessagePort',
    'ReadableStream', 'WritableStream', 'TransformStream',
    'CompressionStream', 'DecompressionStream',
    'getComputedStyle', 'matchMedia', 'openDatabase',
    'origin', 'isSecureContext', 'crossOriginIsolated',
    'scheduler', 'webkitRequestAnimationFrame',
    'webkitCancelAnimationFrame',
  ]);

  for (const key in window) {
    if (!expectedGlobals.has(key) && !key.startsWith('_')) {
      results.closures.push({
        name: key,
        type: typeof window[key],
      });
    }
  }

  // 3. 检测活跃定时器（启发式）
  // 无法直接枚举，但可以通过 monkey patch 检测
  results.timers.push({
    note: '使用 monkey patch setTimeout/setInterval 追踪',
  });

  // 输出报告
  console.group('🔍 Memory Leak Detection Report');
  console.log('Detached DOM nodes:', results.detachedDOM.length);
  console.table(results.detachedDOM);
  console.log('Unexpected globals:', results.closures.length);
  console.table(results.closures);
  console.groupEnd();

  return results;
})();

// === Snippet: 性能基准测试 ===
function benchmark(fn, iterations = 1000, name = 'benchmark') {
  // 预热
  for (let i = 0; i < 10; i++) fn();

  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  const sorted = times.sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  console.group(`📊 ${name} (${iterations} iterations)`);
  console.log(`Average: ${avg.toFixed(3)}ms`);
  console.log(`P50: ${p50.toFixed(3)}ms`);
  console.log(`P95: ${p95.toFixed(3)}ms`);
  console.log(`P99: ${p99.toFixed(3)}ms`);
  console.log(`Min: ${min.toFixed(3)}ms`);
  console.log(`Max: ${max.toFixed(3)}ms`);
  console.groupEnd();

  return { avg, p50, p95, p99, min, max };
}

// === Snippet: 事件监听器检测 ===
(function detectEventListeners() {
  // 使用 getEventListeners (仅 DevTools 可用)
  const allElements = document.querySelectorAll('*');
  const elementsWithListeners = [];

  allElements.forEach(el => {
    try {
      // DevTools 专用 API
      const listeners = getEventListeners(el);
      const types = Object.keys(listeners);
      if (types.length > 0) {
        elementsWithListeners.push({
          element: el.outerHTML.substring(0, 100),
          listenerTypes: types,
          count: types.reduce((sum, t) => sum + listeners[t].length, 0),
        });
      }
    } catch (e) {
      // getEventListeners 仅在 DevTools Console 可用
    }
  });

  console.table(elementsWithListeners);
  return elementsWithListeners;
})();
```

### 2.2 Console API 高级用法

```javascript
// === Console 高级 API 完整指南 ===

// 1. 分组输出
console.group('📦 User Data');
console.log('Name: John');
console.groupCollapsed('📋 Addresses');
console.log('Home: 123 Main St');
console.log('Work: 456 Office Ave');
console.groupEnd();
console.groupEnd();

// 2. 表格输出
const users = [
  { id: 1, name: 'Alice', role: 'admin', score: 95 },
  { id: 2, name: 'Bob', role: 'user', score: 82 },
  { id: 3, name: 'Charlie', role: 'user', score: 78 },
];
console.table(users, ['name', 'role', 'score']);

// 3. 性能计时
console.time('array-push');
const arr = [];
for (let i = 0; i < 100000; i++) arr.push(i);
console.timeEnd('array-push');

// 4. 条件断言
const age = 15;
console.assert(age >= 18, '用户年龄必须 >= 18，当前: %d', age);

// 5. 追踪调用栈
function a() { b(); }
function b() { c(); }
function c() { console.trace('Call trace'); }
a();

// 6. 计数
function handleClick() {
  console.count('button-click');
}
handleClick(); // button-click: 1
handleClick(); // button-click: 2
console.countReset('button-click');
handleClick(); // button-click: 1

// 7. 方向（DevTools 专属）
console.dir(document.body, { depth: 2 });

// 8. 样式化输出
console.log(
  '%c⚡ Performance Alert %c| %c3.2s load time is too slow',
  'background: #ff0000; color: #fff; padding: 4px 8px; font-weight: bold;',
  'color: #666;',
  'color: #ff0000; font-weight: bold;'
);

// 9. 内存信息（Chrome 专属）
if (performance.memory) {
  console.log('Used JS Heap:', (performance.memory.usedJSHeapSize / 1048576).toFixed(2), 'MB');
  console.log('Total JS Heap:', (performance.memory.totalJSHeapSize / 1048576).toFixed(2), 'MB');
  console.log('Heap Limit:', (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2), 'MB');
}

// 10. 监控函数调用
// DevTools 专属：monitor() 和 monitorEvents()
// monitor(myFunction) — 每次调用输出参数
// monitorEvents(window, 'resize') — 监听事件
```

### 2.3 DevTools 设置优化

```javascript
// === 推荐 DevTools 设置 ===
/*
Settings → Preferences:
├─ Elements
│  ├─ ✅ Elements show inherited properties
│  ├─ ✅ Select root node when focusing frame
│  └─ ✅ Show user agent shadow DOM
│
├─ Console
│  ├─ ✅ Log XMLHttpRequests
│  ├─ ✅ Show timestamps
│  ├─ ✅ Preserve log upon navigation
│  ├─ ✅ Selected context only
│  └─ ✅ Hide network messages in console
│
├─ Sources
│  ├─ ✅ Skip pausing on caught exceptions
│  ├─ ✅ Enable custom formatters
│  └─ ✅ Pretty print in console messages
│
├─ Network
│  ├─ ✅ Disable cache (调试时)
│  └─ ✅ Show request headers / response headers
│
├─ Performance
│  ├─ ✅ Screen shots
│  ├─ ✅ Memory
│  └─ ✅ JS sample based profiling
│
└─ Experiments (⚠️ 实验性功能)
   ├─ ✅ Stack traces in console messages
   ├─ ✅ Native memory breakpoints
   └─ ✅ Custom URL to local disk file mapping
*/
```

---

## 三、复杂场景诊断

### 3.1 内存泄漏完整诊断流程

```javascript
// === 场景：SPA 路由切换内存泄漏 ===
// 症状：长时间使用后页面越来越卡，内存持续增长

// 诊断步骤：
// Step 1: 录制内存快照
// Memory 面板 → Heap Snapshot → Take snapshot
// 操作应用（路由切换）
// 再次 Take snapshot
// 对比两次快照的 Differences

// Step 2: 常见泄漏模式检测

// 模式 A: 闭包持有大对象
function createCache() {
  const largeData = new Array(1000000).fill('x'); // 大数组
  return {
    get(key) { return largeData[key]; },
    // ❌ 闭包持有 largeData，即使组件销毁也不会释放
  };
}

// ✅ 修复：使用 WeakMap
function createCacheFixed() {
  const cache = new WeakMap();
  return {
    get(key) { return cache.get(key); },
    set(key, value) { cache.set(key, value); },
    // ✅ key 是对象引用，对象 GC 时自动清理
  };
}

// 模式 B: 未清理的事件监听器
class Component {
  constructor() {
    this.data = new Array(500000);
    // ❌ 注册了监听器但 destroy 时未移除
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('click', this.handleClick);
  }

  handleResize = () => { /* ... */ };
  handleClick = () => { /* ... */ };

  // ❌ 缺少 destroy 方法
}

// ✅ 修复：完整生命周期
class ComponentFixed {
  constructor() {
    this.data = new Array(500000);
    this.boundResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.boundResize);
    this.boundClick = this.handleClick.bind(this);
    document.addEventListener('click', this.boundClick);
  }

  handleResize() { /* ... */ }
  handleClick() { /* ... */ }

  destroy() {
    window.removeEventListener('resize', this.boundResize);
    document.removeEventListener('click', this.boundClick);
    this.data = null; // 显式释放
  }
}

// 模式 C: Timer 泄漏
class DataPoller {
  constructor() {
    this.data = [];
    // ❌ setInterval 未清理
    this.timer = setInterval(() => {
      this.fetchData();
    }, 5000);
  }

  fetchData() { /* ... */ }

  // ❌ 缺少清理
}

// ✅ 修复
class DataPollerFixed {
  constructor() {
    this.data = [];
    this.timer = setInterval(() => this.fetchData(), 5000);
  }

  fetchData() { /* ... */ }

  destroy() {
    clearInterval(this.timer);
    this.data = null;
  }
}

// 模式 D: DOM 引用泄漏
class DOMLeakDemo {
  constructor() {
    this.elements = []; // ❌ 持有 DOM 引用
  }

  cacheElements() {
    document.querySelectorAll('.item').forEach(el => {
      this.elements.push(el); // 即使 DOM 移除，引用仍在
    });
  }

  // ✅ 修复：不持有 DOM 引用，或及时清理
  cacheElementsFixed() {
    this.elementIds = [];
    document.querySelectorAll('.item').forEach(el => {
      this.elementIds.push(el.id); // 只存 ID
    });
  }
}
```

### 3.2 性能瓶颈诊断矩阵

```javascript
// === 性能问题诊断决策树 ===
/*
页面慢？
├─ 首屏加载慢？
│  ├─ 网络瀑布图分析 → 大文件/多请求？
│  │  ├─ 代码分割 ✅
│  │  ├─ Tree Shaking ✅
│  │  └─ 资源压缩 ✅
│  │
│  ├─ 渲染慢？
│  │  ├─ Lighthouse LCP 指标
│  │  ├─ 关键渲染路径分析
│  │  └─ 首屏资源预加载
│  │
│  └─ 服务端慢？
│     ├─ TTFB 分析
│     └─ SSR/SSG 优化
│
├─ 交互响应慢？
│  ├─ Long Task 检测
│  │  └─ 主线程任务拆分 (requestIdleCallback / Web Worker)
│  │
│  ├─ 重排重绘频繁？
│  │  └─ 批量 DOM 操作 / requestAnimationFrame
│  │
│  └─ JS 计算密集？
│     └─ Web Worker / 算法优化
│
└─ 滚动/动画卡顿？
   ├─ FPS 低于 50？
   │  ├─ 复合层优化 (will-change / transform)
   │  └─ 避免 layout thrashing
   │
   └─ 大量 DOM 节点？
      └─ 虚拟滚动 / 按需渲染
*/

// === Long Task 检测 ===
new PerformanceObserver((list) => {
  list.getEntries().forEach(entry => {
    console.warn('⚠️ Long Task detected:', {
      duration: entry.duration.toFixed(2) + 'ms',
      startTime: entry.startTime.toFixed(2) + 'ms',
      attribution: entry.attribution?.map(a => ({
        name: a.name,
        containerType: a.containerType,
        containerSrc: a.containerSrc,
        containerId: a.containerId,
      })),
    });
  });
}).observe({ type: 'longtask', buffered: true });

// === 主线程任务拆分 ===
function processLargeDataset(data) {
  const chunkSize = 100;
  let index = 0;

  function processChunk() {
    const chunk = data.slice(index, index + chunkSize);
    chunk.forEach(item => {
      // 处理每条数据
      processItem(item);
    });

    index += chunkSize;
    if (index < data.length) {
      // 使用 scheduler.postTask (Chrome 115+) 或 requestIdleCallback
      if ('scheduler' in window) {
        scheduler.postTask(processChunk, { priority: 'background' });
      } else if ('requestIdleCallback' in window) {
        requestIdleCallback(processChunk);
      } else {
        setTimeout(processChunk, 0);
      }
    }
  }

  processChunk();
}
```

### 3.3 异步调试高级技巧

```javascript
// === Async Stack Traces ===
// Chrome DevTools 默认显示 async stack traces
// 设置 → Sources → ✅ Enable custom formatters

// 示例：追踪异步调用链
async function fetchUser(id) {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

async function loadDashboard() {
  try {
    const user = await fetchUser(123);
    // 如果 fetchUser 失败，DevTools 显示完整 async 调用栈
    const posts = await fetch(`/api/users/${user.id}/posts`);
    return { user, posts: posts.data };
  } catch (error) {
    // Async stack trace 包含:
    // loadDashboard → fetchUser → fetch → Response.json
    console.error('Dashboard load failed:', error);
    throw error;
  }
}

// === 条件断点调试异步代码 ===
// 在 Sources 面板：
// 1. 在 await 行设置断点
// 2. 右键断点 → Edit breakpoint
// 3. 输入条件：user.id === 123
// 4. 只有条件满足时才暂停

// === 日志断点 (Logpoint) ===
// 右键行号 → Add logpoint
// 输入表达式：`Fetching user ${userId}, time: ${Date.now()}`
// 不会暂停执行，只输出日志

// === Promise 调试 ===
// DevTools → Settings → Debugger → ✅ Pause on caught exceptions
// 在 Promise rejection 时暂停

// === 模拟网络条件 ===
// Network 面板 → Throttle → 选择预设或自定义
// 预设: Fast 3G, Slow 3G, Fast 4G, Offline
// 自定义: 设置 latency / download / upload
```

### 3.4 CSS 调试深度技巧

```javascript
// === CSS 调试工具 ===
/*
DevTools → Elements → Styles 面板:
├─ 盒模型可视化 (Margin / Border / Padding / Content)
├─ CSS 属性高亮 (可动画属性有动画图标)
├─ 颜色选择器 (点击颜色值)
├─ 渐变编辑器 (点击 gradient)
├─ 滤镜编辑器 (点击 filter)
└─ 阴影编辑器 (点击 box-shadow / text-shadow)

DevTools → Rendering 面板:
├─ ✅ Paint flashing — 高亮重绘区域
├─ ✅ Layout shifts — 高亮布局偏移
├─ ✅ Layer borders — 显示复合层边界
├─ ✅ Scroll performance issues — 滚动性能问题
└─ ✅ Container queries — 容器查询调试
*/

// === CSS 容器查询调试 ===
// DevTools Elements → 选中元素 → 右侧 Container 标签
// 可查看容器查询状态和断点

// === CSS 动画调试 ===
// DevTools → Sources → Animations 标签
// 可暂停/加速/减速 CSS 动画
// 可逐帧查看动画状态

// === 布局调试 ===
function debugLayout() {
  // 高亮所有布局问题
  const issues = [];

  // 检测溢出
  document.querySelectorAll('*').forEach(el => {
    const style = getComputedStyle(el);
    if (style.overflow === 'visible') {
      const rect = el.getBoundingClientRect();
      if (rect.width > window.innerWidth || rect.height > window.innerHeight) {
        issues.push({
          type: 'overflow',
          element: el.tagName,
          width: rect.width,
          height: rect.height,
        });
      }
    }

    // 检测布局偏移源
    if (el.animate) {
      const animations = el.getAnimations();
      animations.forEach(anim => {
        if (anim.effect?.getKeyframes) {
          const keys = anim.effect.getKeyframes();
          const hasLayoutProps = keys.some(k =>
            k.left || k.top || k.width || k.height ||
            k.margin || k.padding
          );
          if (hasLayoutProps) {
            issues.push({
              type: 'layout-animation',
              element: el.tagName,
              animation: anim.name,
            });
          }
        }
      });
    }
  });

  console.table(issues);
  return issues;
}
```

---

## 四、Chrome DevTools Protocol (CDP)

### 4.1 CDP 基础

```javascript
// === CDP 连接方式 ===

// 方式 1: 通过 puppeteer
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // 创建 CDP 会话
  const client = await page.createCDPSession();

  // 启用 Performance domain
  await client.send('Performance.enable');

  // 启用 Network domain
  await client.send('Network.enable');

  // 监听网络请求
  client.on('Network.requestWillBeSent', (params) => {
    console.log('Request:', params.request.url);
  });

  client.on('Network.responseReceived', (params) => {
    console.log('Response:', params.response.url, params.response.status);
  });

  // 导航页面
  await page.goto('https://example.com');

  // 获取性能指标
  const metrics = await client.send('Performance.getMetrics');
  metrics.metrics.forEach(m => {
    console.log(`${m.name}: ${m.value.toFixed(2)}`);
  });

  await browser.close();
})();

// 方式 2: 通过 WebSocket 直接连接
// 启动 Chrome: chrome --remote-debugging-port=9222
// 访问 http://localhost:9222 获取 WebSocket URL
// 连接: ws://localhost:9222/devtools/page/<pageId>
```

### 4.2 CDP 自动化调试脚本

```javascript
// === CDP 性能分析自动化 ===
async function performanceAnalysis(page) {
  const client = await page.createCDPSession();

  // 启用所需 domains
  await Promise.all([
    client.send('Performance.enable'),
    client.send('Network.enable'),
    client.send('Page.enable'),
    client.send('Runtime.enable'),
  ]);

  const results = {
    requests: [],
    responses: [],
    metrics: [],
    errors: [],
  };

  // 收集网络请求
  client.on('Network.requestWillBeSent', (params) => {
    results.requests.push({
      url: params.request.url,
      method: params.request.method,
      timestamp: params.timestamp,
    });
  });

  client.on('Network.responseReceived', (params) => {
    results.responses.push({
      url: params.response.url,
      status: params.response.status,
      mimeType: params.response.mimeType,
      encodedDataLength: params.response.encodedDataLength,
      timing: params.response.timing,
    });
  });

  // 收集控制台错误
  client.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error') {
      results.errors.push({
        text: params.args[0]?.value,
        stack: params.args[0]?.description,
      });
    }
  });

  // 导航并等待加载完成
  await page.goto('https://example.com', { waitUntil: 'networkidle0' });

  // 获取性能指标
  const perfMetrics = await client.send('Performance.getMetrics');
  results.metrics = perfMetrics.metrics.reduce((acc, m) => {
    acc[m.name] = m.value;
    return acc;
  }, {});

  // 获取 Lighthouse 指标
  const lhr = await page.evaluate(() => {
    return new Promise(resolve => {
      const entries = performance.getEntriesByType('paint');
      const result = {};
      entries.forEach(entry => {
        result[entry.name] = entry.startTime;
      });

      // LCP
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      if (lcpEntries.length > 0) {
        result.lcp = lcpEntries[lcpEntries.length - 1].startTime;
      }

      resolve(result);
    });
  });

  results.paintMetrics = lhr;

  return results;
}

// === CDP 内存分析自动化 ===
async function memoryAnalysis(page) {
  const client = await page.createCDPSession();

  await client.send('HeapProfiler.enable');

  // 拍摄堆快照
  await page.evaluate(() => {
    // 触发 GC（需要 --expose-gc 启动 Chrome）
    if (window.gc) window.gc();
  });

  // 获取堆统计
  const heapStats = await page.evaluate(() => {
    if (performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        usagePercent: (performance.memory.usedJSHeapSize /
                       performance.memory.jsHeapSizeLimit * 100).toFixed(2),
      };
    }
    return null;
  });

  return heapStats;
}

// === 完整自动化诊断流程 ===
async function fullDiagnostic(url) {
  const browser = await puppeteer.launch({
    args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
  });
  const page = await browser.newPage();

  // 设置视口
  await page.setViewport({ width: 1280, height: 720 });

  console.log('🔍 Starting diagnostic for:', url);

  // 1. 性能分析
  console.log('📊 Analyzing performance...');
  const perfResults = await performanceAnalysis(page);

  // 2. 内存分析
  console.log('🧠 Analyzing memory...');
  const memResults = await memoryAnalysis(page);

  // 3. 截图
  await page.screenshot({ path: 'diagnostic-screenshot.png', fullPage: true });

  // 4. 生成报告
  const report = {
    url,
    timestamp: new Date().toISOString(),
    performance: {
      ttfb: perfResults.metrics?.FirstContentfulPaint,
      fcp: perfResults.metrics?.FirstContentfulPaint,
      domContentLoaded: perfResults.metrics?.DomContentLoaded,
      load: perfResults.metrics?.Load,
      jsHeapUsed: memResults?.usedJSHeapSize,
      jsHeapLimit: memResults?.jsHeapSizeLimit,
    },
    network: {
      totalRequests: perfResults.requests.length,
      totalResponses: perfResults.responses.length,
      totalBytes: perfResults.responses.reduce(
        (sum, r) => sum + (r.encodedDataLength || 0), 0
      ),
      errors: perfResults.errors.length,
    },
    memory: memResults,
  };

  console.log('\n📋 Diagnostic Report:');
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
  return report;
}
```

### 4.3 DevTools 扩展开发

```javascript
// === DevTools 扩展基础 ===
// manifest.json
const manifest = {
  manifest_version: 3,
  name: 'Debug Assistant',
  version: '1.0',
  description: 'Custom DevTools panel for debugging',
  devtools_page: 'devtools.html',
  permissions: ['debugger', 'storage'],
};

// devtools.html — DevTools 面板入口
/*
<!DOCTYPE html>
<html>
<head>
  <script src="devtools.js"></script>
</head>
<body>
  <div id="panel">Debug Assistant Panel</div>
</body>
</html>
*/

// devtools.js
/*
// 创建自定义面板
chrome.devtools.panels.create('DebugAssistant', 'icon.png', 'panel.html', (panel) => {
  console.log('Panel created');

  panel.onShown.addListener((windowObject) => {
    console.log('Panel shown');
  });

  panel.onHidden.addListener(() => {
    console.log('Panel hidden');
  });
});

// 创建侧边栏
chrome.devtools.panels.elements.createSidebarPane(
  'Debug Info',
  (sidebar) => {
    sidebar.setPage('sidebar.html');
  }
);

// 评估页面表达式
chrome.devtools.inspectedWindow.eval('document.title', (result, isException) => {
  if (isException) {
    console.error(isException);
  } else {
    console.log('Page title:', result);
  }
});

// 获取资源
chrome.devtools.inspectedWindow.getResources((resources) => {
  resources.forEach(r => {
    r.getContent((content, encoding) => {
      console.log(r.name, encoding, content?.substring(0, 100));
    });
  });
});
*/

// === 使用 CDP 在扩展中调试 ===
/*
// panel.js — 自定义面板中的调试逻辑

class DebugPanel {
  constructor() {
    this.tabId = null;
    this._getTabId();
  }

  _getTabId() {
    chrome.devtools.inspectedWindow.eval(
      'chrome.devtools.inspectedWindow.tabId',
      (result) => { this.tabId = result; }
    );
  }

  // 启动调试器
  async attachDebugger() {
    return new Promise((resolve, reject) => {
      chrome.debugger.attach({ tabId: this.tabId }, '1.3', () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  }

  // 发送 CDP 命令
  async sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      chrome.debugger.sendCommand(
        { tabId: this.tabId }, method, params,
        (result) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(result);
        }
      );
    });
  }

  // 获取页面性能指标
  async getPerformanceMetrics() {
    const result = await this.sendCommand('Performance.getMetrics');
    return result.metrics;
  }

  // 监听 CDP 事件
  onEvent(callback) {
    chrome.debugger.onEvent.addListener((source, method, params) => {
      if (source.tabId === this.tabId) {
        callback(method, params);
      }
    });
  }

  // 分离调试器
  detach() {
    chrome.debugger.detach({ tabId: this.tabId });
  }
}
*/
```

---

## 五、调试模式与反模式

### 5.1 调试模式

```javascript
// === 模式 1: 二分法定位 ===
// 适用：不确定 bug 在哪段代码
// 方法：在代码中间设断点 → 判断问题在前半还是后半 → 继续二分

function complexFunction(data) {
  // 断点 1: 函数入口
  const processed = preprocess(data);

  // 断点 2: 中间位置
  const transformed = transform(processed);

  // 断点 3: 函数出口
  return finalize(transformed);
}

// === 模式 2: 状态追踪 ===
// 适用：状态管理 bug
class StateDebugger {
  constructor(initialState) {
    this.state = { ...initialState };
    this.history = [];
  }

  setState(updater) {
    const prevState = { ...this.state };
    this.state = typeof updater === 'function'
      ? updater(this.state)
      : { ...this.state, ...updater };

    this.history.push({
      timestamp: Date.now(),
      prev: prevState,
      next: { ...this.state },
      diff: this._diff(prevState, this.state),
    });

    return this.state;
  }

  _diff(prev, next) {
    const diff = {};
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    allKeys.forEach(key => {
      if (prev[key] !== next[key]) {
        diff[key] = { from: prev[key], to: next[key] };
      }
    });
    return diff;
  }

  getHistory() { return [...this.history]; }

  replay(step) {
    if (step >= 0 && step < this.history.length) {
      this.state = { ...this.history[step].next };
      return this.state;
    }
  }
}

// === 模式 3: 时间旅行调试 ===
// 适用：Redux/Vuex 等状态管理
// 工具：Redux DevTools / Vue DevTools / Zoomline

// === 模式 4: 对比调试 ===
// 适用：回归 bug，对比新旧版本行为
// 方法：
// 1. 打开两个标签页（新旧版本）
// 2. 同步操作
// 3. 对比 Console / Network / Elements 输出

// === 模式 5: 最小复现 ===
// 适用：复杂 bug
// 方法：
// 1. 复制问题页面
// 2. 逐步删除无关代码
// 3. 保留最小复现
// 4. 定位根本原因
```

### 5.2 调试反模式

```javascript
// === 反模式 1: console.log 轰炸 ===
// ❌ 错误做法
function processData(data) {
  console.log('start', data);
  console.log('step 1');
  const a = step1(data);
  console.log('after step 1', a);
  console.log('step 2');
  const b = step2(a);
  console.log('after step 2', b);
  console.log('step 3');
  const c = step3(b);
  console.log('after step 3', c);
  console.log('end', c);
  return c;
}

// ✅ 正确做法：使用断点 + 条件断点
function processDataFixed(data) {
  const a = step1(data);  // ← 断点在这里
  const b = step2(a);     // ← 断点在这里
  const c = step3(b);     // ← 断点在这里
  return c;
}

// === 反模式 2: 盲目修改 ===
// ❌ 错误做法：改一行试试，不行再改
// ✅ 正确做法：理解根因 → 假设 → 验证

// === 反模式 3: 忽略堆栈跟踪 ===
// ❌ 只看第一行错误信息
// ✅ 阅读完整堆栈，找到你的代码

// === 反模式 4: 不在 DevTools 中验证 ===
// ❌ 只看代码推理
// ✅ 在 DevTools 中实际验证假设

// === 反模式 5: 调试后不清理 ===
// ❌ 留下 console.log / debugger / 注释代码
// ✅ 调试完成后清理所有调试代码
```

---

## 六、实战案例

### 6.1 案例：电商列表页性能优化

```javascript
// === 场景：商品列表页滚动卡顿 ===

// Step 1: 使用 Performance 面板录制
// 1. Performance → 开始录制
// 2. 滚动列表
// 3. 停止录制
// 4. 分析火焰图

// Step 2: 发现问题
// - 主线程有大量 Layout 任务
// - 每个商品卡片都在触发重排
// - 图片加载导致 Layout Shift

// Step 3: 优化方案

// 优化 A: 虚拟滚动
class VirtualList {
  constructor(container, options) {
    this.container = container;
    this.itemHeight = options.itemHeight;
    this.items = options.items;
    this.visibleCount = Math.ceil(container.clientHeight / this.itemHeight);
    this.buffer = Math.ceil(this.visibleCount * 0.5);
    this.scrollTop = 0;

    this.contentEl = document.createElement('div');
    this.contentEl.style.position = 'relative';
    container.appendChild(this.contentEl);

    this.renderedItems = new Map();
    this.observer = new IntersectionObserver(
      (entries) => this._handleIntersection(entries),
      { root: container, rootMargin: '200px' }
    );

    container.addEventListener('scroll', () => this._onScroll(), { passive: true });
    this._updateTotalHeight();
  }

  _updateTotalHeight() {
    this.contentEl.style.height = `${this.items.length * this.itemHeight}px`;
  }

  _onScroll() {
    this.scrollTop = this.container.scrollTop;
    this._renderVisibleItems();
  }

  _renderVisibleItems() {
    const startIndex = Math.max(
      0,
      Math.floor(this.scrollTop / this.itemHeight) - this.buffer
    );
    const endIndex = Math.min(
      this.items.length,
      Math.ceil((this.scrollTop + this.container.clientHeight) / this.itemHeight) + this.buffer
    );

    const visibleIds = new Set();
    for (let i = startIndex; i < endIndex; i++) {
      const item = this.items[i];
      visibleIds.add(item.id);

      if (!this.renderedItems.has(item.id)) {
        this._renderItem(item, i);
      }
    }

    // 移除不可见项
    this.renderedItems.forEach((el, id) => {
      if (!visibleIds.has(id)) {
        el.remove();
        this.renderedItems.delete(id);
      }
    });
  }

  _renderItem(item, index) {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.top = `${index * this.itemHeight}px`;
    el.style.height = `${this.itemHeight}px`;
    el.style.width = '100%';
    el.innerHTML = this._renderItemHTML(item);
    this.contentEl.appendChild(el);
    this.renderedItems.set(item.id, el);
  }

  _renderItemHTML(item) {
    return `
      <div class="product-card">
        <img src="${item.image}" alt="${item.name}" loading="lazy" />
        <h3>${item.name}</h3>
        <p class="price">¥${item.price}</p>
      </div>
    `;
  }

  updateItems(items) {
    this.items = items;
    this.renderedItems.forEach(el => el.remove());
    this.renderedItems.clear();
    this._updateTotalHeight();
    this._renderVisibleItems();
  }
}

// 优化 B: 图片懒加载 + 占位
/*
<img
  src="placeholder.svg"
  data-src="actual-image.jpg"
  loading="lazy"
  width="200"
  height="200"
  class="lazy-image"
/>
*/

// 优化 C: CSS 优化减少 Layout
/*
.product-card {
  contain: content;  // 隔离布局
  will-change: transform;  // 提升为复合层
}

.product-card img {
  aspect-ratio: 1;  // 固定宽高比，防止 CLS
  object-fit: cover;
}
*/

// Step 4: 验证优化效果
// Performance 面板重新录制，对比优化前后：
// - Layout 次数: 200+ → <20
// - FPS: 25 → 58
// - LCP: 3.8s → 1.2s
// - CLS: 0.35 → 0.02
```

### 6.2 案例：内存泄漏定位

```javascript
// === 场景：SPA 使用 30 分钟后内存从 50MB 增长到 500MB ===

// Step 1: Memory 面板 → Allocation instrumentation on timeline
// 1. 选择 "Allocation instrumentation on timeline"
// 2. 开始录制
// 3. 正常使用应用（切换页面、点击按钮等）
// 4. 停止录制
// 5. 观察内存增长曲线

// Step 2: Heap Snapshot 对比
// 1. Take snapshot (初始状态)
// 2. 操作应用（打开/关闭弹窗 10 次）
// 3. Take snapshot (操作后)
// 4. 选择 "Comparison" 视图
// 5. 查看新增对象最多的类型

// Step 3: 定位泄漏源
// 发现：Modal 组件销毁后，DOM 节点仍存在

// 泄漏代码：
class ModalManager {
  constructor() {
    this.modals = []; // ❌ 持有已关闭弹窗的引用
    this.listeners = []; // ❌ 持有事件监听器引用
  }

  open(config) {
    const modal = this._createModal(config);
    this.modals.push(modal);

    const listener = () => this._handleOverlayClick(modal);
    modal.overlay.addEventListener('click', listener);
    this.listeners.push({ modal, listener }); // ❌ 关闭时未移除
  }

  close(modal) {
    modal.element.remove();
    // ❌ 未清理 this.modals 中的引用
    // ❌ 未移除事件监听器
  }

  _createModal(config) {
    return {
      element: document.createElement('div'),
      overlay: document.createElement('div'),
      config,
    };
  }
}

// ✅ 修复：
class ModalManagerFixed {
  constructor() {
    this.activeModals = new Set(); // 只持有活跃弹窗
  }

  open(config) {
    const modal = this._createModal(config);
    this.activeModals.add(modal);

    const listener = () => this._handleOverlayClick(modal);
    modal.overlay.addEventListener('click', listener);
    // 将 listener 关联到 modal，关闭时可移除
    modal._cleanupListener = listener;
  }

  close(modal) {
    modal.element.remove();
    modal.overlay.removeEventListener('click', modal._cleanupListener);
    this.activeModals.delete(modal);
    modal._cleanupListener = null;
  }
}

// Step 4: 验证修复
// 重复 Step 1-2，确认内存不再增长
```

### 6.3 案例：网络请求优化

```javascript
// === 场景：页面加载 150+ 个请求，首屏加载 8 秒 ===

// Step 1: Network 面板分析
// 1. 勾选 "Disable cache"
// 2. 刷新页面
// 3. 按瀑布图分析请求依赖关系
// 4. 识别关键路径

// Step 2: 问题清单
// - 15 个 CSS 文件（应合并）
// - 30 个小图标（应 sprite 或 SVG sprite）
// - 8 个第三方脚本阻塞渲染
// - 50 张未压缩图片
// - 重复请求（相同 URL 被请求多次）

// Step 3: 优化方案

// 优化 A: 请求合并与延迟加载
class RequestOptimizer {
  constructor() {
    this.pendingRequests = new Map();
    this.requestQueue = [];
    this.isProcessing = false;
  }

  // 请求去重：相同 URL 只发一次
  async fetch(url, options = {}) {
    if (this.pendingRequests.has(url)) {
      return this.pendingRequests.get(url);
    }

    const promise = globalThis.fetch(url, options).finally(() => {
      this.pendingRequests.delete(url);
    });
    this.pendingRequests.set(url, promise);
    return promise;
  }

  // 批量请求：合并多个小请求
  async batch(requests) {
    // 将多个 GET 请求合并为一次批量请求
    const urls = requests.map(r => r.url);
    const response = await this.fetch('/api/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });
    return response.json();
  }

  // 预加载关键资源
  preload(urls) {
    urls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      link.as = this._getType(url);
      document.head.appendChild(link);
    });
  }

  _getType(url) {
    if (url.endsWith('.js')) return 'script';
    if (url.endsWith('.css')) return 'style';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|otf)$/)) return 'font';
    return 'fetch';
  }
}

// 优化 B: 图片优化策略
/*
// 响应式图片
<picture>
  <source media="(min-width: 1200px)" srcset="large.webp" type="image/webp">
  <source media="(min-width: 768px)" srcset="medium.webp" type="image/webp">
  <img src="small.jpg" alt="..." loading="lazy" decoding="async">
</picture>

// 图标优化：SVG Sprite
<svg><use href="#icon-search"></use></svg>

// 图片压缩：WebP/AVIF + 响应式尺寸
*/

// Step 4: 验证
// Network 面板重新测试：
// 请求数: 150+ → 45
// 首屏加载: 8s → 2.1s
// 总资源大小: 4.2MB → 1.1MB
```

---

## 七、调试检查清单

### 7.1 性能调试检查清单

```markdown
## 性能调试 Checklist

### 加载性能
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1
- [ ] TTFB < 0.8s
- [ ] 关键资源预加载
- [ ] 非关键资源延迟加载
- [ ] 图片使用 WebP/AVIF
- [ ] 字体使用 font-display: swap

### 运行时性能
- [ ] FPS ≥ 55
- [ ] 无 Long Task (>50ms)
- [ ] 无强制同步布局
- [ ] DOM 操作使用 requestAnimationFrame
- [ ] 大任务使用 scheduler.postTask / Web Worker
- [ ] 列表使用虚拟滚动
- [ ] 事件监听使用 passive

### 内存管理
- [ ] 无 detached DOM 节点
- [ ] 事件监听器正确清理
- [ ] Timer 正确清理
- [ ] 无全局变量泄漏
- [ ] 大对象及时释放
- [ ] 使用 WeakMap/WeakRef 管理缓存
```

### 7.2 调试快捷键速查

```markdown
## DevTools 快捷键速查

### 通用
| 快捷键 | 功能 |
|--------|------|
| F12 / Cmd+Option+I | 打开 DevTools |
| Ctrl+Shift+M | 切换设备模拟 |
| Ctrl+Shift+P | Command Menu |
| Esc | 打开/关闭 Console |
| Ctrl+/ | 注释/取消注释 |

### Sources 面板
| 快捷键 | 功能 |
|--------|------|
| Ctrl+O | 打开文件 |
| Ctrl+Shift+O | 跳转到符号 |
| Ctrl+G | 跳转到行号 |
| Ctrl+Shift+F | 全局搜索 |
| F8 / Ctrl+\ | 继续/暂停 |
| F10 | Step over |
| F11 | Step into |
| Shift+F11 | Step out |
| Ctrl+\ | 切换断点 |
| Ctrl+Shift+\ | 禁用/启用所有断点 |

### Console
| 快捷键 | 功能 |
|--------|------|
| Ctrl+` | 切换 Console |
| Ctrl+L | 清空 Console |
| Tab | 自动补全 |
| Shift+Enter | 换行 |
| ↑/↓ | 历史命令 |

### Network
| 快捷键 | 功能 |
|--------|------|
| Ctrl+E | 清空并禁用缓存 |
| Ctrl+R | 刷新并捕获 |
| Ctrl+F | 过滤请求 |
```

---

## 八、总结

### Chrome DevTools 调试能力全景

| 能力域 | 核心工具 | 关键指标 |
|--------|----------|----------|
| 性能分析 | Performance 面板 | FPS, Long Task, 火焰图 |
| 内存分析 | Memory 面板 | Heap Snapshot, Allocation Timeline |
| 断点调试 | Sources 面板 | 条件断点, Logpoint, Async Stack |
| 网络分析 | Network 面板 | 瀑布图, TTFB, 资源大小 |
| 渲染调试 | Rendering 面板 | Paint Flashing, Layout Shifts |
| 自动化 | CDP / Puppeteer | 自动化测试, 性能监控 |
| 生产调试 | Source Map + 远程调试 | 错误追踪, 用户会话回放 |

### 调试核心原则

1. **先复现，再修复** — 没有稳定复现的 bug 不要急着修
2. **用工具，不靠猜** — DevTools 能告诉你的，不要靠推理
3. **二分法定位** — 缩小范围比盲目搜索高效 10 倍
4. **一次只改一个变量** — 同时改多处无法确定哪个有效
5. **修复后验证** — 用同样的工具验证问题确实解决
6. **预防优于调试** — 好测试 + 好日志 + 好监控 = 少调试

---

*Chrome DevTools v4 — 从基础调试到自动化诊断，掌握生产环境调试全流程*
