# Chrome DevTools 第五轮（终轮）：Web 全栈调试 / 专项场景 / 终极速查表

> 专项训练 16:00 | 2026-05-05 | 调试技能专项（第五轮 · 终轮）
> 前序：4/26 基础深度 → 4/29 全面覆盖 → 4/30 高级进阶 → 5/2 Trace+CDP → 本轮：全栈场景 + 遗漏领域 + 终极速查

---

## 目录

1. [Service Worker 与离线调试](#1-service-worker-与离线调试)
2. [WebGL / Canvas 性能调试](#2-webgl--canvas-性能调试)
3. [CSS 深度调试（布局/渲染/动画）](#3-css-深度调试布局渲染动画)
4. [WebAssembly 调试](#4-webassembly-调试)
5. [Accessibility 与 Lighthouse 深度](#5-accessibility-与-lighthouse-深度)
6. [Security 面板实战](#6-security-面板实战)
7. [Web Vitals 实时监测](#7-web-vitals-实时监测)
8. [React/Vue 专用调试工具](#8-reactvue-专用调试工具)
9. [PWA 调试与调试清单](#9-pwa-调试与调试清单)
10. [Chrome DevTools 终极速查表](#10-chrome-devtools-终极速查表)
11. [自测题](#11-自测题)
12. [附录：五轮训练总结](#12-附录五轮训练总结)

---

## 1. Service Worker 与离线调试

### 1.1 Service Worker 面板概览

Application → Service Workers 面板是调试 PWA 的核心入口：

```
Service Worker 面板关键信息：
├── Status（状态）
│   ├── Activated and running — 正常运行
│   ├── Activated and is running but has been blocked — 被阻止
│   └── Install failed — 安装失败
├── Update on reload — 每次刷新都更新 SW
├── Bypass for network — 绕过 SW 直接走网络
├── Offline — 模拟离线状态
└── Push — 模拟 push 事件
```

### 1.2 Service Worker 生命周期调试

```javascript
// 完整的 Service Worker 生命周期调试模板
// sw.js

const CACHE_NAME = 'app-v1.0.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json'
];

// === 安装阶段 ===
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching assets:', ASSETS_TO_CACHE);
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        // skipWaiting 跳过 waiting 状态，立即激活
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Cache install failed:', err);
        // 安装失败会导致 SW 不会被激活
      })
  );
});

// === 激活阶段 ===
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(
    Promise.all([
      // 清理旧缓存
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        )
      ),
      // 立即接管所有客户端
      self.clients.claim()
    ])
  );
});

// === 请求拦截 ===
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求和跨域请求
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // 策略选择
  if (request.destination === 'document') {
    // 页面：Network First
    event.respondWith(networkFirst(request));
  } else if (request.destination.match(/style|script|image/)) {
    // 静态资源：Cache First
    event.respondWith(cacheFirst(request));
  } else {
    // API：Network First with cache fallback
    event.respondWith(networkFirst(request, 5000));
  }
});

// === 策略实现 ===
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    console.log('[SW] Cache hit:', request.url);
    return cached;
  }
  console.log('[SW] Cache miss, fetching:', request.url);
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, timeout = 3000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(request, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    console.log('[SW] Network success:', request.url);
    // 更新缓存
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await caches.match(request);
    if (cached) return cached;
    // 离线回退页面
    if (request.destination === 'document') {
      return caches.match('/offline.html');
    }
    throw err;
  }
}

// === Push 通知 ===
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: '通知', body: '新消息' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: { url: data.url || '/' },
      actions: [
        { action: 'open', title: '打开' },
        { action: 'dismiss', title: '关闭' }
      ]
    })
  );
});

// === 通知点击 ===
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        const client = clients.find((c) => c.url.includes(event.notification.data.url));
        if (client) return client.focus();
        return self.clients.openWindow(event.notification.data.url);
      })
    );
  }
});
```

### 1.3 Service Worker 调试技巧

```
DevTools 中调试 Service Worker 的关键操作：

1. Application → Service Workers
   - 查看 SW 状态（activated/sleeping/stopped）
   - 点击 "push" 模拟推送
   - 点击 "sync" 模拟后台同步
   - 勾选 "Offline" 测试离线行为
   - 勾选 "Update on reload" 开发时自动更新

2. 独立 DevTools 窗口
   - 在 Service Workers 列表点击 "inspect" 链接
   - 打开 SW 专属的 DevTools 窗口
   - 可以设置断点、查看 console.log
   - ⚠️ SW 线程是事件驱动的，空闲时会被终止
   - ⚠️ 打开 inspect 会保持 SW 常驻（影响性能测试）

3. 常见问题诊断：
   ❌ SW 未注册 → 检查 register() 的 path 和 scope
   ❌ 安装失败 → 检查 cache.addAll() 中是否有 404 资源
   ❌ 不更新 → 浏览器只在 SW 文件字节变化时重新安装
   ❌ 缓存未清理 → 检查 activate 事件中的清理逻辑
   ❌ 离线页面不显示 → 检查 fetch 事件的离线回退逻辑
```

### 1.4 Background Sync 调试

```javascript
// Background Sync — 网络恢复后自动重试
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  const pending = await getPendingRequests(); // 从 IndexedDB 读取
  for (const req of pending) {
    try {
      await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body
      });
      await removePendingRequest(req.id);
      console.log('[SW] Synced:', req.url);
    } catch (err) {
      console.error('[SW] Sync failed:', req.url, err);
      // 保留在队列中，下次 sync 再试
      break; // 按顺序重试
    }
  }
}

// 前端触发同步
async function queueRequest(url, options) {
  const id = Date.now().toString();
  await saveToIndexedDB({ id, url, ...options });
  await navigator.serviceWorker.ready;
  await navigator.serviceWorker.registration.sync.register('sync-data');
  console.log('Request queued:', id);
}
```

---

## 2. WebGL / Canvas 性能调试

### 2.1 WebGL 调试模式

```
启用 WebGL 调试：
1. chrome://flags → 搜索 "WebGL"
2. 启用 "WebGL Developer Tools"
3. 重启 Chrome
4. DevTools Settings → Experiments → 勾选 "WebGL debugging"

启用后效果：
- 每个 WebGL 调用都会生成 console 错误（GL 错误时）
- 可以在 Sources 面板看到着色器源码
- Performance 面板显示 GPU 进程事件
```

### 2.2 Canvas 性能分析

```javascript
// Canvas 性能调试模板
class CanvasDebugger {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 0;
    this.drawCalls = 0;
    this.originalDrawImage = this.ctx.drawImage.bind(this.ctx);
    this.instrument();
  }

  instrument() {
    // 拦截 drawImage 调用
    this.ctx.drawImage = (...args) => {
      this.drawCalls++;
      this.originalDrawImage(...args);
    };
  }

  measureFrame() {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      console.log(
        `[Canvas] FPS: ${this.fps} | ` +
        `Draw calls: ${this.drawCalls} | ` +
        `Canvas: ${this.canvas.width}x${this.canvas.height}`
      );
      this.frameCount = 0;
      this.lastTime = now;
      this.drawCalls = 0;
    }
  }

  // 检测离屏 Canvas 泄漏
  checkOffscreenLeaks() {
    const offscreen = document.querySelectorAll('canvas');
    offscreen.forEach((c, i) => {
      if (!c.isConnected && c.width > 0) {
        console.warn(`[Canvas] Orphaned canvas #${i}: ${c.width}x${c.height}`);
      }
    });
  }
}

// 使用
const debugger = new CanvasDebugger(myCanvas);
function animate() {
  // ... 绘制逻辑
  debugger.measureFrame();
  requestAnimationFrame(animate);
}
```

### 2.3 WebGL 性能指标

```javascript
// WebGL 性能诊断工具
class WebGLProfiler {
  constructor(gl) {
    this.gl = gl;
    this.metrics = {
      drawCalls: 0,
      textureBindings: 0,
      shaderSwitches: 0,
      framebufferSwitches: 0,
      triangles: 0,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      renderer: gl.getParameter(gl.RENDERER),
      vendor: gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
      shaderPrecision: this.getShaderPrecision()
    };
    this.instrument();
  }

  getShaderPrecision() {
    const vs = this.gl.getShaderPrecisionFormat(this.gl.VERTEX_SHADER, this.gl.HIGH_FLOAT);
    const fs = this.gl.getShaderPrecisionFormat(this.gl.FRAGMENT_SHADER, this.gl.HIGH_FLOAT);
    return {
      vertex: { range: vs.range, precision: vs.precision },
      fragment: { range: fs.range, precision: fs.precision }
    };
  }

  instrument() {
    const gl = this.gl;
    const self = this;

    // 拦截关键调用
    const origDrawArrays = gl.drawArrays.bind(gl);
    gl.drawArrays = function (...args) {
      self.metrics.drawCalls++;
      self.metrics.triangles += args[2]; // count
      return origDrawArrays(...args);
    };

    const origDrawElements = gl.drawElements.bind(gl);
    gl.drawElements = function (...args) {
      self.metrics.drawCalls++;
      self.metrics.triangles += args[1]; // count
      return origDrawElements(...args);
    };

    const origBindTexture = gl.bindTexture.bind(gl);
    gl.bindTexture = function (...args) {
      self.metrics.textureBindings++;
      return origBindTexture(...args);
    };

    const origUseProgram = gl.useProgram.bind(gl);
    gl.useProgram = function (...args) {
      self.metrics.shaderSwitches++;
      return origUseProgram(...args);
    };
  }

  report() {
    console.table(this.metrics);
    return { ...this.metrics };
  }

  // 检测 WebGL 上下文丢失
  static detectContextLoss(canvas, callbacks) {
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); // 允许恢复
      console.warn('[WebGL] Context lost!');
      callbacks?.onLost?.();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      console.log('[WebGL] Context restored');
      callbacks?.onRestored?.();
    });
  }
}
```

### 2.4 常见 WebGL 性能问题

```
WebGL 性能瓶颈排查清单：

🔴 Draw Call 过多（>1000/frame）
   → 合并几何体（geometry merging）
   → 使用 Instanced Rendering（gl.drawArraysInstanced）
   → 减少材质/纹理切换

🔴 纹理过大（>2048x2048 移动端）
   → 使用 mipmap
   → 压缩纹理（ASTC/ETC2）
   → 纹理图集（texture atlas）

🔴 Shader 过于复杂
   → 减少分支（if/else 在 GPU 上昂贵）
   → 使用 lowp/mediap 精度
   → 预计算数学运算

🔴 Framebuffer 切换频繁
   → 批处理渲染到同一 FBO
   → 减少 post-processing pass

🔴 内存泄漏
   → 确保调用 gl.deleteTexture/gl.deleteBuffer
   → 检查 IndexedDB/Cache API 中的 WebGL 数据
```

---

## 3. CSS 深度调试（布局/渲染/动画）

### 3.1 布局调试

```
DevTools 布局调试工具：

1. Elements → Styles 面板
   - 盒模型可视化（Margin/Padding/Border/Content）
   - 点击盒模型图查看精确尺寸
   - 实时编辑 CSS 属性

2. 布局面板（Layout pane）
   - 查看 computed 布局属性
   - Grid 布局可视化（高亮 grid lines/cells）
   - Flex 布局可视化（显示主轴/交叉轴）

3. 渲染选项（Rendering）
   - Paint flashing — 高亮重绘区域
   - Layout shift regions — 高亮 CLS 来源
   - Layer borders — 显示合成层边界
   - Scrollable region highlights — 显示可滚动区域
```

### 3.2 CSS 动画调试

```javascript
// CSS 动画性能监控
class AnimationMonitor {
  constructor() {
    this.animations = new Map();
    this.observer = null;
    this.start();
  }

  start() {
    // 监听动画事件
    document.addEventListener('animationstart', (e) => {
      this.animations.set(e.animationName, {
        name: e.animationName,
        startTime: performance.now(),
        duration: e.animationDuration,
        element: e.target.tagName
      });
    });

    document.addEventListener('animationend', (e) => {
      const anim = this.animations.get(e.animationName);
      if (anim) {
        anim.endTime = performance.now();
        anim.actualDuration = anim.endTime - anim.startTime;
        console.log(`[Animation] ${e.animationName}:`, anim);
        this.animations.delete(e.animationName);
      }
    });

    // 使用 PerformanceObserver 监控长任务
    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn(
            `[Animation] Long task during animation: ` +
            `${entry.duration.toFixed(1)}ms`
          );
        }
      }
    });
    this.observer.observe({ entryTypes: ['longtask'] });
  }

  // 检测强制同步布局（Layout Thrashing）
  static detectLayoutThrashing() {
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    let callCount = 0;
    let lastCallTime = 0;

    window.getComputedStyle = function (...args) {
      const now = performance.now();
      if (now - lastCallTime < 16) { // 同一帧内多次调用
        callCount++;
        if (callCount > 3) {
          console.warn(
            `[Layout Thrashing] getComputedStyle called ${callCount}x ` +
            `in single frame. Caller:`,
            new Error().stack?.split('\n')[2]
          );
        }
      } else {
        callCount = 0;
      }
      lastCallTime = now;
      return originalGetComputedStyle(...args);
    };
  }
}

// 使用
AnimationMonitor.detectLayoutThrashing();
const monitor = new AnimationMonitor();
```

### 3.3 合成层优化

```
CSS 属性与合成层关系：

触发 GPU 合成的 CSS 属性（性能最优）：
├── transform: translate/rotate/scale — ✅ 仅合成
├── opacity — ✅ 仅合成
├── filter — ✅ 仅合成（部分）
└── will-change — ✅ 提前提升为合成层

触发重排 + 重绘的 CSS 属性（性能最差）：
├── width/height — ❌ 重排 + 重绘
├── top/left — ❌ 重排 + 重绘
├── margin/padding — ❌ 重排 + 重绘
├── font-size — ❌ 重排 + 重绘
└── display: none — ❌ 重排

仅触发重绘的 CSS 属性（中等）：
├── color — ⚠️ 仅重绘
├── background-color — ⚠️ 仅重绘
├── box-shadow — ⚠️ 仅重绘
└── border-radius — ⚠️ 仅重绘

优化策略：
1. 动画优先使用 transform + opacity
2. 使用 will-change 提前提升合成层（不要滥用）
3. 避免在动画中修改布局属性
4. 使用 CSS contain 限制重排范围
```

### 3.4 CSS Contain 深度使用

```css
/* CSS Contain — 限制浏览器重排范围 */

/* 布局隔离 */
.card {
  contain: layout;
  /* 内部布局变化不影响外部 */
}

/* 绘制隔离 — 超出边界的内容不绘制 */
.thumbnail {
  contain: paint;
  /* 提升滚动性能 */
}

/* 尺寸隔离 — 浏览器不需要计算内容尺寸 */
.ad-slot {
  contain: size;
  /* 需要显式指定 width/height */
  width: 300px;
  height: 250px;
}

/* 样式隔离 — 计数器/quotes 不穿透 */
.comment-section {
  contain: style;
}

/* 内容隔离 — 以上全部 */
.widget {
  contain: content;
  /* = layout + paint + style */
}

/* 严格隔离 — 最强 */
.shadow-root-like {
  contain: strict;
  /* = layout + paint + style + size */
}
```

---

## 4. WebAssembly 调试

### 4.1 Wasm 调试配置

```
Wasm 调试前提：
1. 编译时保留调试信息
   emcc -g main.c -o main.wasm  # 生成 .wasm + .wasm.map
2. 确保 .wasm.map 文件可访问
3. 与 .wasm 同目录或正确配置 sourceMappingURL

DevTools 中的 Wasm 调试：
- Sources 面板可以看到 Wasm 模块
- 可以设置断点（需要 .wasm.map）
- Call Stack 显示 C/C++ 函数名
- Scope 面板显示变量值
```

### 4.2 Wasm 性能分析

```javascript
// Wasm 性能监控
class WasmProfiler {
  constructor(wasmInstance) {
    this.instance = wasmInstance;
    this.exports = wasmInstance.exports;
    this.timings = new Map();
    this.instrument();
  }

  instrument() {
    const self = this;
    for (const [name, fn] of Object.entries(this.exports)) {
      if (typeof fn === 'function' && name !== '__indirect_function_table') {
        const original = fn.bind(this.exports);
        this.exports[name] = function (...args) {
          const start = performance.now();
          const result = original(...args);
          const duration = performance.now() - start;
          if (!self.timings.has(name)) {
            self.timings.set(name, []);
          }
          self.timings.get(name).push(duration);
          return result;
        };
      }
    }
  }

  report() {
    const stats = {};
    for (const [name, timings] of this.timings) {
      const sum = timings.reduce((a, b) => a + b, 0);
      const avg = sum / timings.length;
      const max = Math.max(...timings);
      const min = Math.min(...timings);
      stats[name] = { count: timings.length, avg: avg.toFixed(3), max, min, total: sum.toFixed(3) };
    }
    console.table(stats);
    return stats;
  }
}

// 使用
WebAssembly.instantiateStreaming(fetch('module.wasm'), importObject)
  .then((result) => {
    const profiler = new WasmProfiler(result.instance);
    // ... 运行 Wasm 代码
    profiler.report();
  });
```

### 4.3 Wasm 内存调试

```javascript
// Wasm 内存监控
class WasmMemoryMonitor {
  constructor(memory) {
    this.memory = memory;
    this.initialPages = memory.buffer.byteLength;
  }

  get info() {
    const current = this.memory.buffer.byteLength;
    const pages = current / 65536; // 1 page = 64KB
    return {
      currentBytes: current,
      currentMB: (current / 1024 / 1024).toFixed(2),
      pages: pages.toFixed(1),
      initialMB: (this.initialPages / 1024 / 1024).toFixed(2),
      growth: ((current - this.initialPages) / this.initialPages * 100).toFixed(1) + '%'
    };
  }

  snapshot() {
    const info = this.info;
    console.log(`[Wasm Memory] ${info.currentMB}MB (${info.pages} pages, +${info.growth})`);
    return info;
  }
}

// 检测 Wasm 内存泄漏模式
function detectWasmMemoryLeak(monitor, interval = 1000) {
  const samples = [];
  const timer = setInterval(() => {
    const info = monitor.snapshot();
    samples.push({ time: Date.now(), bytes: info.currentBytes });
    // 连续增长 5 次 → 可能泄漏
    if (samples.length >= 5) {
      const recent = samples.slice(-5);
      const increasing = recent.every((s, i) =>
        i === 0 || s.bytes >= recent[i - 1].bytes
      );
      if (increasing) {
        console.warn('[Wasm] Possible memory leak detected!');
        console.table(recent);
      }
    }
  }, interval);
  return () => clearInterval(timer);
}
```

---

## 5. Accessibility 与 Lighthouse 深度

### 5.1 Accessibility 面板

```
DevTools Accessibility 面板功能：

1. Elements → Accessibility 子面板
   - 查看每个元素的 accessibility tree 节点
   - 显示 role/name/value/properties
   - 查看 computed role（实际生效的角色）

2. Lighthouse → Accessibility 审计
   - 40+ 项可访问性检查
   - 按严重程度分类（Critical/Serious/Moderate/Minor）
   - 提供具体修复建议

3. 手动检查清单：
   ✅ 所有图片有 alt 属性
   ✅ 表单控件有 label
   ✅ 颜色对比度 ≥ 4.5:1（正文）/ ≥ 3:1（大文本）
   ✅ 键盘可操作所有交互元素
   ✅ focus 可见且有明确样式
   ✅ 使用语义化 HTML 标签
   ✅ ARIA 属性正确（不滥用）
   ✅ 视频有字幕
   ✅ 动画可暂停/关闭
   ✅ 错误消息可被屏幕阅读器读取
```

### 5.2 颜色对比度检测

```javascript
// 颜色对比度计算
class ContrastChecker {
  // 计算相对亮度
  static relativeLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  // 计算对比度
  static ratio(fg, bg) {
    const l1 = this.relativeLuminance(...fg);
    const l2 = this.relativeLuminance(...bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // 检查 WCAG 等级
  static check(fg, bg, size = 'normal') {
    const ratio = this.ratio(fg, bg);
    const aaThreshold = size === 'large' ? 3 : 4.5;
    const aaaThreshold = size === 'large' ? 4.5 : 7;
    return {
      ratio: ratio.toFixed(2),
      AA: ratio >= aaThreshold ? '✅ Pass' : '❌ Fail',
      AAA: ratio >= aaaThreshold ? '✅ Pass' : '❌ Fail'
    };
  }

  // 扫描页面所有文本元素
  static scanPage() {
    const elements = document.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, span, a, li, label, button, td, th'
    );
    const results = [];
    elements.forEach((el) => {
      const style = window.getComputedStyle(el);
      const bg = this.getBackgroundColor(el, style);
      const fg = style.color.match(/\d+/g).map(Number);
      const result = this.check(fg, bg);
      if (result.AAA === '❌ Fail') {
        results.push({
          tag: el.tagName,
          text: el.textContent.slice(0, 50),
          fg: style.color,
          bg: `rgb(${bg.join(',')})`,
          ratio: result.ratio,
          AA: result.AA,
          AAA: result.AAA
        });
      }
    });
    console.table(results);
    return results;
  }

  static getBackgroundColor(el, style) {
    let current = el;
    while (current) {
      const bg = window.getComputedStyle(current).backgroundColor;
      const rgb = bg.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
      if (bg !== 'rgba(0, 0, 0, 0)' && rgb[3] !== 0) {
        return rgb.slice(0, 3);
      }
      current = current.parentElement;
    }
    return [255, 255, 255];
  }
}

// 使用
ContrastChecker.check([0, 0, 0], [255, 255, 255]); // { ratio: "21.00", AA: "✅ Pass", AAA: "✅ Pass" }
ContrastChecker.scanPage(); // 扫描页面中对比度不足的元素
```

### 5.3 Lighthouse CI 集成

```javascript
// lighthouse-ci.config.js
// Lighthouse CI 配置 — 自动化性能审计

module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000'],
      numberOfRuns: 3,
      staticDistDir: './dist',
      puppeteerScript: './puppeteer-script.js', // 登录后审计
      settings: {
        extends: 'lighthouse:default',
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
          requestLatencyMs: 150 * 3.85,
          downloadThroughputKbps: 1638.4 * 14.37,
          uploadThroughputKbps: 750 * 3.55
        },
        formFactor: 'mobile',
        screenEmulation: {
          width: 360,
          height: 640,
          deviceScaleFactor: 3,
          disabled: false
        }
      }
    },
    assert: {
      assertions: {
        // 性能预算
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 1.0 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'interactive': ['error', { maxNumericValue: 3800 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        // 资源预算
        'byte-efficiency': ['error', { maxLength: 50 }],
        'uses-optimized-images': 'error',
        'uses-responsive-images': 'error',
        'unused-css-rules': ['error', { maxLength: 40 }],
        'unused-javascript': ['error', { maxLength: 30 }],
        // 无障碍
        'color-contrast': 'error',
        'label': 'error',
        'aria-valid-attr': 'error',
        'document-title': 'error',
        'meta-description': 'error'
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: './lighthouse-results'
    }
  }
};
```

---

## 6. Security 面板实战

### 6.1 Security 面板功能

```
Security 面板检查项：

1. 连接安全状态
   ✅ 安全（HTTPS + 有效证书）
   ⚠️ 不安全（HTTP 或证书问题）
   ❌ 危险（中间人攻击/证书错误）

2. 混合内容检测
   - 页面通过 HTTPS 加载但包含 HTTP 资源
   - 被动混合内容（图片/音频/视频）— 警告
   - 主动混合内容（脚本/样式）— 阻止

3. 证书信息
   - 颁发者
   - 有效期
   - 签名算法
   - 密钥大小

4. 安全头检查
   ✅ Content-Security-Policy (CSP)
   ✅ Strict-Transport-Security (HSTS)
   ✅ X-Content-Type-Options
   ✅ X-Frame-Options
   ✅ Referrer-Policy
   ✅ Permissions-Policy
```

### 6.2 CSP 调试

```javascript
// CSP 违规报告处理
// 服务端配置：
// Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
// 或
// Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-abc123'; report-to /csp-report

// 前端 CSP 违规收集
document.addEventListener('securitypolicyviolation', (e) => {
  console.error('[CSP Violation]', {
    directive: e.violatedDirective,
    blockedURI: e.blockedURI,
    effectiveDirective: e.effectiveDirective,
    originalPolicy: e.originalPolicy,
    sourceFile: e.sourceFile,
    lineNumber: e.lineNumber,
    columnNumber: e.columnNumber
  });

  // 上报到监控服务
  navigator.sendBeacon('/csp-report', JSON.stringify({
    type: 'csp-violation',
    directive: e.violatedDirective,
    blockedURI: e.blockedURI,
    sourceFile: e.sourceFile,
    userAgent: navigator.userAgent,
    url: location.href,
    timestamp: Date.now()
  }));
});

// CSP 测试工具
class CSPTester {
  // 测试内联脚本是否被阻止
  static testInlineScript() {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.textContent = 'window.__csp_test = true;';
      document.head.appendChild(script);
      setTimeout(() => {
        resolve(window.__csp_test === true ? 'Inline scripts ALLOWED' : 'Inline scripts BLOCKED');
      }, 100);
    });
  }

  // 测试外部脚本
  static testExternalScript(url) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => resolve(`External script from ${url} ALLOWED`);
      script.onerror = () => resolve(`External script from ${url} BLOCKED`);
      document.head.appendChild(script);
    });
  }

  // 完整 CSP 测试
  static async fullTest() {
    const results = {};
    results.inlineScript = await this.testInlineScript();
    results.externalScript = await this.testExternalScript('https://evil.com/evil.js');
    console.table(results);
    return results;
  }
}
```

---

## 7. Web Vitals 实时监测

### 7.1 Web Vitals 指标详解

```
Core Web Vitals 三大指标：

1. LCP (Largest Contentful Paint) — 最大内容绘制
   目标：≤ 2.5s
   测量：页面中最大可见元素的首次渲染时间
   优化：
   - 优化 LCP 资源（压缩图片、使用 WebP/AVIF）
   - 预加载 LCP 资源（<link rel="preload">）
   - 消除渲染阻塞资源
   - 使用 CDN

2. INP (Interaction to Next Paint) — 交互到下次绘制
   目标：≤ 200ms
   测量：用户交互到下一帧绘制的延迟（替代 FID）
   优化：
   - 减少长任务（>50ms）
   - 使用 requestIdleCallback 处理低优先级任务
   - Web Worker 处理计算密集型任务
   - 优化事件处理器

3. CLS (Cumulative Layout Shift) — 累积布局偏移
   目标：≤ 0.1
   测量：页面生命周期内所有意外布局偏移的总和
   优化：
   - 为图片/视频设置宽高比
   - 避免在内容上方插入动态内容
   - 使用 font-display: optional 避免字体闪烁
   - 为广告/嵌入内容预留空间
```

### 7.2 Web Vitals 监控实现

```javascript
// Web Vitals 完整监控
class WebVitalsMonitor {
  constructor(config = {}) {
    this.endpoint = config.endpoint || '/analytics';
    this.sampleRate = config.sampleRate || 1.0;
    this.metrics = {
      LCP: [],
      INP: [],
      CLS: 0,
      FCP: [],
      TTFB: [],
      FP: []
    };
    this.init();
  }

  init() {
    // LCP
    this.observeLCP();
    // INP (替代 FID)
    this.observeINP();
    // CLS
    this.observeCLS();
    // FCP
    this.observeFCP();
    // TTFB
    this.observeTTFB();
  }

  observeLCP() {
    if (!('PerformanceObserver' in window)) return;
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        const value = lastEntry.startTime;
        this.metrics.LCP.push(value);
        this.send('LCP', value, {
          element: lastEntry.element?.tagName,
          url: lastEntry.url
        });
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      console.warn('[WebVitals] LCP observer failed:', e);
    }
  }

  observeINP() {
    if (!('PerformanceObserver' in window)) return;
    try {
      const interactionMap = new Map();

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const interactionId = entry.interactionId || entry.name;
          const existing = interactionMap.get(interactionId);

          if (!existing || entry.duration > existing.duration) {
            interactionMap.set(interactionId, entry);
          }
        }
      });

      observer.observe({
        type: 'event',
        buffered: true,
        options: { durationThreshold: 16 }
      });

      // 定期报告 INP
      setInterval(() => {
        const interactions = [...interactionMap.values()]
          .sort((a, b) => b.duration - a.duration);
        const inp = interactions[0]?.duration ?? 0;
        this.metrics.INP.push(inp);
        this.send('INP', inp);
      }, 5000);
    } catch (e) {
      console.warn('[WebVitals] INP observer failed:', e);
    }
  }

  observeCLS() {
    if (!('PerformanceObserver' in window)) return;
    try {
      let sessionValue = 0;
      let sessionEntries = [];

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            sessionValue += entry.value;
            sessionEntries.push(entry);
          }
        }
        this.metrics.CLS = sessionValue;
        this.send('CLS', sessionValue, {
          sources: sessionEntries.length
        });
      });

      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      console.warn('[WebVitals] CLS observer failed:', e);
    }
  }

  observeFCP() {
    if (!('PerformanceObserver' in window)) return;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.FCP.push(entry.startTime);
            this.send('FCP', entry.startTime);
          }
        }
      });
      observer.observe({ type: 'paint', buffered: true });
    } catch (e) {
      console.warn('[WebVitals] FCP observer failed:', e);
    }
  }

  observeTTFB() {
    if (!('PerformanceObserver' in window)) return;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'navigation') {
            const ttfb = entry.responseStart - entry.requestStart;
            this.metrics.TTFB.push(ttfb);
            this.send('TTFB', ttfb);
          }
        }
      });
      observer.observe({ type: 'navigation', buffered: true });
    } catch (e) {
      console.warn('[WebVitals] TTFB observer failed:', e);
    }
  }

  send(name, value, extra = {}) {
    if (Math.random() > this.sampleRate) return;

    const rating = this.getRating(name, value);
    const data = {
      name,
      value: Math.round(value * 100) / 100,
      rating,
      url: location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      ...extra
    };

    // 使用 sendBeacon 确保数据发送
    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.endpoint, JSON.stringify(data));
    } else {
      fetch(this.endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
        keepalive: true
      }).catch(() => {});
    }

    console.log(`[WebVitals] ${name}: ${value.toFixed(0)}ms (${rating})`, extra);
  }

  getRating(name, value) {
    const thresholds = {
      LCP: { good: 2500, poor: 4000 },
      INP: { good: 200, poor: 500 },
      CLS: { good: 0.1, poor: 0.25 },
      FCP: { good: 1800, poor: 3000 },
      TTFB: { good: 800, poor: 1800 }
    };
    const t = thresholds[name];
    if (!t) return 'unknown';
    if (value <= t.good) return 'good';
    if (value <= t.poor) return 'needs-improvement';
    return 'poor';
  }

  // 生成报告
  report() {
    const summary = {};
    for (const [name, values] of Object.entries(this.metrics)) {
      if (Array.isArray(values) && values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        summary[name] = {
          count: values.length,
          avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(0),
          p50: sorted[Math.floor(sorted.length * 0.5)].toFixed(0),
          p75: sorted[Math.floor(sorted.length * 0.75)].toFixed(0),
          p99: sorted[Math.floor(sorted.length * 0.99)].toFixed(0),
          rating: this.getRating(name, sorted[Math.floor(sorted.length * 0.75)])
        };
      } else if (typeof values === 'number') {
        summary[name] = {
          value: values.toFixed(4),
          rating: this.getRating(name, values)
        };
      }
    }
    console.table(summary);
    return summary;
  }
}

// 使用
const monitor = new WebVitalsMonitor({
  endpoint: '/api/web-vitals',
  sampleRate: 0.1 // 10% 采样
});

// 在控制台输入 monitor.report() 查看汇总
```

---

## 8. React/Vue 专用调试工具

### 8.1 React DevTools

```
React DevTools 核心功能：

1. Components 面板
   - 组件树可视化
   - 查看 props/state/hooks 状态
   - 编辑 props/state 实时预览
   - 搜索组件
   - Highlight updates（高亮重渲染）

2. Profiler 面板
   - 记录渲染性能
   - 按 commit 查看渲染详情
   - 识别不必要的重渲染
   - Flamegraph / Ranked 视图

React 性能优化模式：
```

```javascript
// React 性能调试工具
class ReactPerfDebugger {
  constructor() {
    this.wastedRender = new Map();
  }

  // 检测不必要的重渲染
  detectWastedRenders() {
    const root = document.querySelector('[data-reactroot], #root');
    if (!root) return;

    // 通过 React Fiber 树分析
    const fiber = this.getFiberFromNode(root);
    if (!fiber) return;

    const wasted = [];
    this.walkFiber(fiber, (node) => {
      if (node.actualDuration > 0 && node.memoizedProps === node.pendingProps) {
        wasted.push({
          name: node.type?.name || node.type,
          duration: node.actualDuration,
          memoized: node.memoizedProps,
          pending: node.pendingProps
        });
      }
    });

    if (wasted.length > 0) {
      console.warn(`[React Perf] ${wasted.length} unnecessary renders:`, wasted);
    }
    return wasted;
  }

  // 获取 Fiber 节点
  getFiberFromNode(node) {
    const key = Object.keys(node).find((k) =>
      k.startsWith('__reactFiber$') || k.startsWith('__reactFiber')
    );
    return key ? node[key] : null;
  }

  // 遍历 Fiber 树
  walkFiber(node, callback) {
    if (!node) return;
    callback(node);
    if (node.child) this.walkFiber(node.child, callback);
    if (node.sibling) this.walkFiber(node.sibling, callback);
  }

  // 监控 hooks 调用
  monitorHooks() {
    const originalConsole = console.log;
    const hookCalls = [];

    // 通过 React 内部 API 监控（仅开发环境）
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      const originalOnCommitFiberRoot = hook.onCommitFiberRoot;

      hook.onCommitFiberRoot = (rendererID, root) => {
        if (originalOnCommitFiberRoot) {
          originalOnCommitFiberRoot(rendererID, root);
        }
        // 分析 commit 性能
        const commitTime = root.current.actualDuration;
        if (commitTime > 16) {
          console.warn(`[React Perf] Slow commit: ${commitTime.toFixed(1)}ms`);
        }
      };
    }
  }
}
```

### 8.2 Vue DevTools

```
Vue DevTools 核心功能：

1. Components 面板
   - 组件树 + 层级关系
   - Props/Data/Computed/Methods 实时查看
   - 时间旅行调试（Time Travel）
   - 组件事件追踪

2. Vuex/Pinia 面板
   - State 快照
   - Mutation/Action 历史
   - 时间旅行（回滚/前进）
   - 导出/导入 State

3. Router 面板
   - 路由表
   - 当前路由信息
   - 导航守卫追踪

4. Performance 面板
   - 组件渲染追踪
   - 识别性能瓶颈
```

```javascript
// Vue 3 性能调试插件
class VuePerfPlugin {
  constructor(options = {}) {
    this.threshold = options.threshold || 16; // ms
    this.trackedComponents = new Set(options.components || []);
    this.renderTimes = new Map();
  }

  install(app) {
    // 使用 Vue 3 的 app.config.performance
    app.config.performance = true;

    // 自定义性能追踪
    const originalMount = app.mount;
    const self = this;

    app.mount = function (...args) {
      const start = performance.now();
      const result = originalMount.apply(this, args);
      const duration = performance.now() - start;
      console.log(`[Vue Perf] App mounted in ${duration.toFixed(1)}ms`);
      return result;
    };

    // 全局组件渲染追踪
    app.mixin({
      mounted() {
        this.$options.__mountTime = performance.now();
      },
      unmounted() {
        const mountTime = this.$options.__mountTime;
        if (mountTime) {
          const lifetime = performance.now() - mountTime;
          const name = this.$options.name || this.$options.__name || 'Anonymous';
          if (lifetime > 60000) { // > 1 分钟
            console.log(
              `[Vue Perf] ${name} lifetime: ${(lifetime / 1000).toFixed(1)}s`
            );
          }
        }
      }
    });
  }
}

// 使用
// const app = createApp(App);
// app.use(new VuePerfPlugin({ threshold: 16 }));
```

---

## 9. PWA 调试与调试清单

### 9.1 PWA 调试 Checklist

```
PWA 调试清单：

✅ Manifest.json
   - name/short_name 存在
   - icons 至少 192x192 和 512x512
   - start_url 正确
   - display: standalone/minimal-ui
   - theme_color/background_color 设置

✅ Service Worker
   - 正确注册
   - fetch 事件处理
   - 离线回退页面
   - 缓存策略合理

✅ HTTPS
   - 有效 SSL 证书
   - 无混合内容

✅ 可安装性
   - 满足 A2HS（Add to Home Screen）条件
   - 用户交互后触发安装提示

✅ 性能
   - LCP ≤ 2.5s
   - CLS ≤ 0.1
   - INP ≤ 200ms

✅ 无障碍
   - 语义化 HTML
   - 颜色对比度达标
   - 键盘可操作
```

### 9.2 PWA 安装调试

```javascript
// PWA 安装调试
class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.init();
  }

  init() {
    // 监听 beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      console.log('[PWA] Install prompt available');
      // 显示自定义安装按钮
      this.showInstallButton();
    });

    // 监听应用安装
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      this.isInstalled = true;
      this.hideInstallButton();
    });

    // 检查是否已安装
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      console.log('[PWA] Running in standalone mode');
    }
  }

  async install() {
    if (!this.deferredPrompt) {
      console.warn('[PWA] No install prompt available');
      return false;
    }
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    console.log(`[PWA] Install outcome: ${outcome}`);
    return outcome === 'accepted';
  }

  showInstallButton() {
    // 显示安装 UI
    console.log('[PWA] Show install button');
  }

  hideInstallButton() {
    // 隐藏安装 UI
    console.log('[PWA] Hide install button');
  }

  // 诊断 PWA 安装问题
  static diagnose() {
    const issues = [];

    // 检查 manifest
    const manifest = document.querySelector('link[rel="manifest"]');
    if (!manifest) {
      issues.push('❌ No manifest link found');
    } else {
      fetch(manifest.href)
        .then((r) => r.json())
        .then((m) => {
          if (!m.name) issues.push('❌ manifest: missing "name"');
          if (!m.icons || m.icons.length === 0) issues.push('❌ manifest: missing "icons"');
          if (!m.start_url) issues.push('❌ manifest: missing "start_url"');
          if (!m.display) issues.push('⚠️ manifest: missing "display"');
          console.table(issues.length ? issues : ['✅ Manifest OK']);
        });
    }

    // 检查 Service Worker
    if (!('serviceWorker' in navigator)) {
      issues.push('❌ Service Worker not supported');
    } else {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        if (regs.length === 0) {
          issues.push('❌ No Service Worker registered');
        } else {
          console.log(`✅ ${regs.length} Service Worker(s) registered`);
        }
        console.table(issues.length ? issues : ['✅ All checks passed']);
      });
    }

    // 检查 HTTPS
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      issues.push('❌ Not served over HTTPS');
    }

    return issues;
  }
}

// 使用
PWAInstaller.diagnose();
const installer = new PWAInstaller();
```

---

## 10. Chrome DevTools 终极速查表

### 10.1 快捷键速查

```
=== 通用快捷键 ===
Ctrl+Shift+I / F12     — 打开 DevTools
Ctrl+Shift+J            — 打开 Console
Ctrl+Shift+C            — 打开 Elements + 元素选择器
Ctrl+P                  — 文件搜索（模糊匹配）
Ctrl+Shift+P            — Command Menu
Ctrl+O                  — 快速打开文件
Ctrl+G                  — 跳转到行号
Ctrl+F                  — 当前文件搜索
Ctrl+Shift+F            — 跨文件搜索
Ctrl+Shift+;            — 搜索符号（函数/变量）

=== Sources 面板 ===
F8 / Ctrl+\             — 继续/暂停
F10 / Ctrl+'            — 单步跳过（Step over）
F11 / Ctrl+Shift+'      — 单步进入（Step into）
Shift+F11/Ctrl+Shift+;  — 单步退出（Step out）
Ctrl+Shift+D            — 黑盒脚本（Blackbox）
Ctrl+B                  — 设置断点（当前行）
Ctrl+Shift+B            — 搜索文件设置断点

=== Console ===
$0-$4                   — 最近选择的 DOM 元素
$_                      — 上一个表达式的结果
$$(selector)            — document.querySelectorAll
$x(xpath)              — XPath 查询
clear()                 — 清空控制台
copy(object)            — 复制到剪贴板
inspect(object)         — 在对应面板中查看
monitor(fn)             — 监控函数调用
monitorEvents(element)  — 监控元素事件

=== Performance ===
Ctrl+E                  — 录制/停止
Ctrl+1-5                — 切换视图（Summary/Waterfall/Flamechart/...）

=== Memory ===
Ctrl+E                  — 拍摄快照

=== Network ===
Ctrl+F                  — 过滤请求
Ctrl+R                  — 禁用缓存
```

### 10.2 面板功能速查

```
=== Elements ===
├── 查看/编辑 HTML 结构
├── 实时编辑 CSS
├── 盒模型可视化
├── 事件监听器查看
├── 样式来源追踪
├── 布局面板（Grid/Flex）
└── 可访问性树

=== Console ===
├── JS 执行
├── 日志（log/warn/error/info/table）
├── 分组（group/groupCollapsed）
├── 计时（time/timeEnd）
├── 性能分析（profile/profileEnd）
├── 计数（count）
└── 断言（assert）

=== Sources ===
├── 断点调试
├── 条件断点
├── DOM 断点
├── XHR 断点
├── 事件监听器断点
├── 黑盒脚本
├── 代码片段（Snippets）
├── 工作区（Workspace）
└── 源映射（Source Maps）

=== Network ===
├── 请求/响应查看
├── 性能瀑布图
├── 过滤/搜索
├── 节流模拟
├── 离线模拟
├── 请求拦截/修改
├── WebSocket 监控
└── HAR 导出

=== Performance ===
├── CPU 性能分析
├── 火焰图
├── 调用树
├── Bottom-Up
├── 帧率分析
├── 内存时间线
├── 网络时间线
└── 屏幕录制

=== Memory ===
├── Heap Snapshot（堆快照）
├── Allocation Profiling（分配分析）
├── Allocation Timeline（分配时间线）
├── 内存泄漏检测
├── DOM 节点追踪
└── 对比分析

=== Application ===
├── Storage（Cookie/LocalStorage/SessionStorage）
├── IndexedDB
├── Cache Storage
├── Service Workers
├── Background Sync
├── Manifest
├── Frames
└── Resources

=== Lighthouse ===
├── 性能审计
├── 可访问性审计
├── 最佳实践审计
├── SEO 审计
├── PWA 审计
└── 报告生成

=== Security ===
├── 连接状态
├── 证书信息
├── 混合内容检测
└── 安全头检查
```

### 10.3 调试场景速查

```
=== 性能问题 ===
场景：页面卡顿
→ Performance 面板录制 → 查看长任务 → Flamechart 定位

场景：内存泄漏
→ Memory 面板 → Heap Snapshot → 对比快照 → 找增长对象

场景：FPS 低
→ Performance 面板 → 查看 FPS 轨道 → 主线程阻塞分析

场景：首屏慢
→ Lighthouse → Performance → 查看 Waterfall → 优化阻塞资源

=== 逻辑错误 ===
场景：函数未执行
→ Sources → 设置断点 → 检查调用栈

场景：变量值异常
→ Sources → 条件断点 → Watch 表达式

场景：异步问题
→ Console → async 调用栈 → 检查 Promise 链

场景：DOM 异常
→ Elements → DOM 断点 → 追踪修改来源

=== 网络问题 ===
场景：请求失败
→ Network → 查看状态码 → 检查 Request/Response

场景：CORS 错误
→ Network → 查看响应头 → 检查 Access-Control-*

场景：缓存问题
→ Network → 禁用缓存 → 查看 Cache-Control

=== CSS 问题 ===
场景：布局错乱
→ Elements → 盒模型 → 检查 margin/padding

场景：动画卡顿
→ Rendering → Paint flashing → 检测重绘区域

场景：字体闪烁
→ Network → 字体加载时间 → 优化 font-display

=== 兼容性问题 ===
场景：API 不支持
→ Can I Use 查询 → Polyfill 方案

场景：样式不一致
→ Elements → Computed → 对比浏览器默认样式
```

---

## 11. 自测题

### 11.1 理论题

1. Service Worker 的 `skipWaiting()` 和 `clients.claim()` 分别做什么？为什么通常一起使用？

2. WebGL 中 `drawArrays` 和 `drawElements` 的区别是什么？什么场景用哪个？

3. CSS `contain: strict` 包含哪些隔离？使用时需要注意什么？

4. INP 替代 FID 的原因是什么？INP 和 FID 的测量方式有何不同？

5. CSP 中 `nonce` 和 `hash` 的区别？各自适用场景？

6. WebAssembly 的 `.wasm.map` 文件作用是什么？没有它能否调试？

7. 合成层（Compositing Layer）和 GPU 加速的关系是什么？

8. Lighthouse 的 throttling 配置中 `cpuSlowdownMultiplier: 4` 的含义？

### 11.2 实战题

1. 一个 PWA 应用无法安装，列出你的排查步骤。

2. 页面在滚动时出现明显卡顿，描述你的诊断流程。

3. 用 DevTools 检测一个 React 应用中不必要的重渲染。

4. 用 PerformanceObserver 实现一个自定义指标监控（如：图片加载完成时间）。

5. 编写一个脚本检测页面中所有对比度不达标的文本元素。

---

## 12. 附录：五轮训练总结

### Chrome DevTools 五轮迭代回顾

| 轮次 | 日期 | 主题 | 大小 | 核心内容 |
|------|------|------|------|----------|
| v1 | 4/26 | 基础深度 | ~52KB | Performance/Memory/Sources/Network 基础 |
| v2 | 4/29 | 全面覆盖 | ~60KB | 全面板详解 + Lighthouse/Application/Console |
| v3 | 4/30 | 高级进阶 | ~76KB | 架构原理/远程调试/CI集成/生产实战 |
| v4 | 5/2 | Trace+CDP | ~51KB | Trace事件/内存碎片/条件断点/CDP自动化 |
| v5 | 5/5 | 全栈场景 | ~80KB | SW/WebGL/CSS/Wasm/A11y/PWA/速查表 |
| **合计** | | | **~319KB** | **五大核心面板 + 专项场景 + 终极速查** |

### 完整知识体系

```
Chrome DevTools 知识体系（五轮闭环）
│
├── 核心面板
│   ├── Elements — DOM/CSS/布局/可访问性
│   ├── Console — 日志/执行/调试命令
│   ├── Sources — 断点/调试/代码片段
│   ├── Network — 请求/性能/缓存
│   ├── Performance — CPU/帧率/火焰图
│   ├── Memory — 堆快照/泄漏检测
│   ├── Application — 存储/SW/缓存
│   ├── Lighthouse — 审计/报告
│   └── Security — 证书/CSP/混合内容
│
├── 专项调试
│   ├── Service Worker / PWA
│   ├── WebGL / Canvas
│   ├── CSS 布局/动画/合成层
│   ├── WebAssembly
│   ├── React / Vue 专用工具
│   └── Web Vitals 监控
│
├── 高级技术
│   ├── CDP 自动化
│   ├── 远程调试
│   ├── CI 集成
│   ├── 生产级实战
│   └── Trace 事件分析
│
└── 调试方法论
    ├── 性能问题诊断流程
    ├── 内存泄漏排查模式
    ├── 跨面板联动调试
    ├── 调试 Checklist
    └── 快捷键/速查表
```

### 闭环状态

✅ **Chrome DevTools 五轮迭代完全闭环**

- 9 个核心面板全部覆盖
- 6 个专项调试场景覆盖
- CDP 自动化 + 远程调试 + CI 集成
- 终极速查表（快捷键/面板功能/调试场景）
- 累计 ~319KB 文档 / 50+ 代码示例 / 完整知识体系

---

*Chrome DevTools 专项训练至此完成五轮迭代，从基础面板到高级调试，从前端性能到全栈场景，形成完整的调试能力体系。*
