# Web 性能优化 — Phase 2 进阶：Web Workers + WASM + 现代浏览器 API (2026-05-02 05:00)

**前置基础：**
- 4/24 基础版：懒加载 / 防抖节流 / 内存管理 / 虚拟列表
- 4/25 进阶版：CRP / Web Vitals / 重排优化 / 网络层
- 4/26 综合实战：三合一整合 — 高性能数据看板
- 4/27 回顾巩固：查漏补缺 + SSR/Canvas/SW 扩展
- 4/28 生产级 Toolkit：八大模块
- 4/29 实战优化模式：真实场景 + 反模式 + 性能对比
- 4/30 Phase 1 终章：性能审计框架 + 端到端优化

**Phase 1 → Phase 2 跃迁：**
Phase 1 聚焦主线程优化（懒加载/防抖/内存/渲染），Phase 2 聚焦**主线程外优化**——把计算密集任务移出主线程，用底层能力突破 JS 性能天花板。

---

## 一、Web Workers — 把计算移出主线程

### 1.1 为什么需要 Web Workers？

```
┌─────────────────────────────────────────────────────────────┐
│                     浏览器线程模型                           │
├──────────────────────┬──────────────────────────────────────┤
│  主线程 (UI Thread)   │  Worker 线程 (Background Thread)     │
│                      │                                      │
│  • DOM 操作           │  • 纯计算任务                        │
│  • CSS 样式计算       │  • 数据处理/序列化                    │
│  • Layout/Paint       │  • 图像处理                          │
│  • JS 执行            │  • 加密/解密                         │
│  • 事件处理           │  • 网络请求 (部分)                    │
│                      │  • 复杂算法                           │
│  ⚠️ 任何长任务阻塞 →   │  ✅ 不阻塞主线程                     │
│     INP/FID 恶化       │     用户交互依然流畅                  │
├──────────────────────┴──────────────────────────────────────┤
│  通信方式: postMessage() + onmessage (结构化克隆算法)         │
└─────────────────────────────────────────────────────────────┘
```

**关键指标影响：**
- INP (Interaction to Next Paint): 长任务 → INP 飙升，Worker 可降至 < 100ms
- FCP/LCP: Worker 不直接影响（DOM 在主线程），但减少主线程竞争可间接改善
- 内存: Worker 有独立内存空间，需注意通信开销

### 1.2 Worker 类型全景

```javascript
// === 1. Dedicated Worker（专用 Worker，最常用）===
// worker.js — 独立的 JS 文件
self.onmessage = function(e) {
  const result = heavyComputation(e.data);
  self.postMessage(result);
};

// 主线程
const worker = new Worker('./worker.js');
worker.postMessage({ type: 'compute', data: largeArray });
worker.onmessage = (e) => console.log('Result:', e.data);

// === 2. Shared Worker（共享 Worker，多标签页共享）===
const sharedWorker = new SharedWorker('./shared-worker.js');
sharedWorker.port.onmessage = (e) => { /* ... */ };
sharedWorker.port.postMessage('hello');

// === 3. Service Worker（离线缓存 + 推送，已在 Phase 1 覆盖）===

// === 4. Audio Worker (AudioWorklet) — 音频处理 ===
// 在 AudioContext 中注册
await audioCtx.audioWorklet.addModule('audio-processor.js');

// === 5. Worklet (PaintWorklet/LayoutWorklet) — CSS 扩展 ===
// CSS Houdini 的一部分，用于自定义 CSS 渲染

// === 6. Chrome Worker (Chrome 专用) ===
// 不在此讨论
```

### 1.3 Worker 通信优化 — 避免成为瓶颈

```javascript
// === 问题：结构化克隆的开销 ===
// 大数据量传输时，结构化克隆 (structured clone) 本身就很慢

// ❌ 反模式：大数组传输 — 克隆 + 序列化耗时
const bigArray = new Float64Array(10_000_000); // 80MB
worker.postMessage({ data: bigArray }); // 克隆 80MB → 主线程阻塞 ~50ms

// ✅ 正模式：Transferable Objects — 零拷贝转移所有权
worker.postMessage({ data: bigArray.buffer }, [bigArray.buffer]);
// 转移后，主线程的 bigArray 变为空 (byteLength === 0)
// 耗时: < 1ms（只是指针转移）

// === 完整示例：高性能 Worker 通信封装 ===
class WorkerPool {
  constructor(workerUrl, size = navigator.hardwareConcurrency || 4) {
    this.workers = [];
    this.taskQueue = [];
    this.activeTasks = new Map(); // taskId → { resolve, reject }
    this.nextTaskId = 0;

    for (let i = 0; i < size; i++) {
      const worker = new Worker(workerUrl);
      worker.onmessage = (e) => this._handleResponse(e.data);
      worker.onerror = (e) => this._handleError(e);
      this.workers.push({ worker, busy: false });
    }
  }

  postTask(data, transfer = []) {
    return new Promise((resolve, reject) => {
      const taskId = this.nextTaskId++;
      this.activeTasks.set(taskId, { resolve, reject });

      const idleWorker = this.workers.find(w => !w.busy);
      if (idleWorker) {
        idleWorker.busy = true;
        idleWorker.worker.postMessage(
          { taskId, data },
          transfer.length > 0 ? transfer : undefined
        );
      } else {
        this.taskQueue.push({ taskId, data, transfer });
      }
    });
  }

  _handleResponse(response) {
    const { taskId, result, error } = response;
    const task = this.activeTasks.get(taskId);
    if (task) {
      if (error) task.reject(new Error(error));
      else task.resolve(result);
      this.activeTasks.delete(taskId);
    }

    // 标记 worker 空闲并处理队列
    const workerEntry = this.workers.find(w => w.worker === /* need ref */ null);
    // 实际实现中需要更好的 worker 追踪
    this._processQueue();
  }

  _processQueue() {
    const idleWorker = this.workers.find(w => !w.busy);
    const nextTask = this.taskQueue.shift();
    if (idleWorker && nextTask) {
      idleWorker.busy = true;
      idleWorker.worker.postMessage(
        { taskId: nextTask.taskId, data: nextTask.data },
        nextTask.transfer.length > 0 ? nextTask.transfer : undefined
      );
    }
  }

  terminate() {
    this.workers.forEach(w => w.worker.terminate());
    this.workers = [];
  }
}
```

### 1.4 实战：图片处理 Worker

```javascript
// === image-processor.js (Worker 文件) ===
self.onmessage = async function(e) {
  const { imageData, operation, params } = e.data;

  let result;
  switch (operation) {
    case 'grayscale':
      result = _grayscale(imageData);
      break;
    case 'blur':
      result = _boxBlur(imageData, params.radius || 3);
      break;
    case 'resize':
      result = _resize(imageData, params.width, params.height);
      break;
    case 'histogram':
      result = _computeHistogram(imageData);
      break;
  }

  // 使用 Transferable 零拷贝返回
  self.postMessage(result, [result.buffer]);
};

function _grayscale(imageData) {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    output[i] = avg;     // R
    output[i + 1] = avg; // G
    output[i + 2] = avg; // B
    output[i + 3] = data[i + 3]; // A
  }
  return new ImageData(output, width, height);
}

function _boxBlur(imageData, radius) {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);
  const kernelSize = radius * 2 + 1;
  const kernelWeight = 1 / (kernelSize * kernelSize);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const nx = Math.min(width - 1, Math.max(0, x + kx));
          const ny = Math.min(height - 1, Math.max(0, y + ky));
          const idx = (ny * width + nx) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
        }
      }
      const idx = (y * width + x) * 4;
      output[idx] = r * kernelWeight;
      output[idx + 1] = g * kernelWeight;
      output[idx + 2] = b * kernelWeight;
      output[idx + 3] = data[idx + 3];
    }
  }
  return new ImageData(output, width, height);
}

// === 主线程使用 ===
async function processImageOnWorker(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

  const worker = new Worker('./image-processor.js');
  const result = await new Promise((resolve) => {
    worker.onmessage = (e) => resolve(e.data);
    // Transferable — 零拷贝发送
    worker.postMessage(
      { imageData, operation: 'grayscale' },
      [imageData.data.buffer]
    );
  });

  worker.terminate();
  return result; // ImageData
}
```

### 1.5 Worker 性能基准测试

```javascript
// === 对比：主线程 vs Worker 处理大数组排序 ===
async function benchmarkSort() {
  const size = 5_000_000;
  const data = Array.from({ length: size }, () => Math.random());

  // 主线程排序
  const t0 = performance.now();
  data.slice().sort((a, b) => a - b);
  const mainThreadTime = performance.now() - t0;
  console.log(`主线程排序: ${mainThreadTime.toFixed(1)}ms`);
  // 约 800-1200ms，期间 UI 完全卡死

  // Worker 排序
  const workerCode = `
    self.onmessage = (e) => {
      const t0 = performance.now();
      const sorted = e.data.sort((a, b) => a - b);
      const elapsed = performance.now() - t0;
      self.postMessage({ sorted, elapsed });
    };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const worker = new Worker(URL.createObjectURL(blob));

  const t1 = performance.now();
  const result = await new Promise((resolve) => {
    worker.onmessage = (e) => resolve(e.data);
    worker.postMessage(data.slice());
  });
  const workerTime = performance.now() - t1;
  console.log(`Worker 排序: ${result.elapsed.toFixed(1)}ms (计算) / ${(workerTime).toFixed(1)}ms (总)`);
  // 计算时间相近，但主线程不阻塞
  // 总时间多了通信开销 (~50-100ms)

  worker.terminate();

  return {
    mainThread: mainThreadTime,
    workerCalc: result.elapsed,
    workerTotal: workerTime,
    overhead: workerTime - result.elapsed
  };
}
```

---

## 二、WebAssembly (WASM) — 突破 JS 性能天花板

### 2.1 为什么需要 WASM？

```
┌─────────────────────────────────────────────────────────────┐
│                    性能对比 (相对值)                          │
├──────────────────┬──────────────────────────────────────────┤
│  技术             │  计算密集型任务性能                       │
├──────────────────┼──────────────────────────────────────────┤
│  原生 C/C++       │ ████████████████████████████████████ 100% │
│  WebAssembly      │ ████████████████████████████████░░░ 85%  │
│  优化 JS (JIT)    │ ████████████████████░░░░░░░░░░░ 50%     │
│  未优化 JS        │ ██████████░░░░░░░░░░░░░░░░░░░░░ 20%     │
├──────────────────┴──────────────────────────────────────────┤
│  WASM 适用场景: 图像处理 / 视频编码 / 加密 / 物理引擎       │
│  WASM 不适用: DOM 操作 / 简单业务逻辑 / 频繁 GC 的场景       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 WASM 基础 — 从 C 到浏览器

```javascript
// === 方式一：手动编译 WASM (Emscripten) ===
// hello.c
//   int fib(int n) {
//     if (n <= 1) return n;
//     return fib(n - 1) + fib(n - 2);
//   }
//
// 编译: emcc hello.c -O3 -o hello.wasm

// === 方式二：使用 WebAssembly.instantiate (原生 WASM) ===
async function loadWasm() {
  const response = await fetch('./fib.wasm');
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes);

  // 调用 WASM 函数
  const result = instance.exports.fib(40);
  console.log(`Fib(40) = ${result}`);
  return result;
}

// === 方式三：WAT (WebAssembly Text Format) — 手写 WASM ===
// fib.wat
// (module
//   (func $fib (param $n i32) (result i32)
//     (if (result i32) (i32.le_s (local.get $n) (i32.const 1))
//       (then (local.get $n))
//       (else
//         (i32.add
//           (call $fib (i32.sub (local.get $n) (i32.const 1)))
//           (call $fib (i32.sub (local.get $n) (i32.const 2)))
//         )
//       )
//     )
//   )
//   (export "fib" (func $fib))
// )
```

### 2.3 实战：WASM 图片滤镜

```javascript
// === 使用 AssemblyScript 编写高性能图片处理 ===
// image-filter.ts (AssemblyScript)
// export function grayscale(
//   pixels: Uint8Array,
//   width: i32,
//   height: i32
// ): Uint8Array {
//   const output = new Uint8Array(pixels.length);
//   for (let i = 0; i < pixels.length; i += 4) {
//     const avg = <u8>(
//       pixels[i] * 0.299 +
//       pixels[i + 1] * 0.587 +
//       pixels[i + 2] * 0.114
//     );
//     output[i] = avg;
//     output[i + 1] = avg;
//     output[i + 2] = avg;
//     output[i + 3] = pixels[i + 3];
//   }
//   return output;
// }

// 编译: asc image-filter.ts -O3 --out image-filter.wasm

// === 主线程调用 ===
class WasmImageProcessor {
  constructor() {
    this.instance = null;
    this.memory = null;
  }

  async init(wasmUrl) {
    const response = await fetch(wasmUrl);
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes);
    this.instance = instance;
    this.memory = instance.memory.buffer;
  }

  grayscale(imageData) {
    const { width, height, data } = imageData;

    // 在 WASM 线性内存中分配空间
    const inputPtr = this.instance.__new(data.length, 0);
    const outputPtr = this.instance.__new(data.length, 0);

    // 复制数据到 WASM 内存
    const memoryView = new Uint8Array(this.memory);
    memoryView.set(data, inputPtr);

    // 调用 WASM 函数
    this.instance.grayscale(inputPtr, outputPtr, width, height);

    // 从 WASM 内存读取结果
    const output = new Uint8ClampedArray(
      this.memory.slice(outputPtr, outputPtr + data.length)
    );

    // 释放 WASM 内存
    this.instance.__free(inputPtr);
    this.instance.__free(outputPtr);

    return new ImageData(output, width, height);
  }
}

// === 性能对比 ===
async function benchmarkGrayscale() {
  const width = 4096, height = 4096;
  const imageData = new ImageData(
    new Uint8ClampedArray(width * height * 4),
    width, height
  );
  // 填充随机数据
  for (let i = 0; i < imageData.data.length; i++) {
    imageData.data[i] = Math.random() * 255;
  }

  // JS 版本
  const t0 = performance.now();
  _jsGrayscale(imageData);
  const jsTime = performance.now() - t0;

  // WASM 版本
  const processor = new WasmImageProcessor();
  await processor.init('./image-filter.wasm');
  const t1 = performance.now();
  processor.grayscale(imageData);
  const wasmTime = performance.now() - t1;

  console.log(`JS: ${jsTime.toFixed(1)}ms, WASM: ${wasmTime.toFixed(1)}ms`);
  console.log(`加速比: ${(jsTime / wasmTime).toFixed(1)}x`);
  // 典型结果: JS ~120ms, WASM ~15ms, 加速 ~8x
}

function _jsGrayscale(imageData) {
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = avg;
    data[i + 1] = avg;
    data[i + 2] = avg;
  }
}
```

### 2.4 WASM + Worker 组合拳

```javascript
// === 架构：Worker 中运行 WASM，双重加速 ===
//
// 主线程 (UI)
//    │ postMessage (Transferable)
//    ▼
// Worker 线程 (后台计算)
//    │ WebAssembly.instantiate
//    ▼
// WASM 模块 (接近原生性能)
//
// 优势:
// 1. Worker 不阻塞主线程 → INP 优秀
// 2. WASM 计算快 → 总处理时间短
// 3. Transferable 零拷贝 → 通信开销极小

// worker-wasm.js
let wasmInstance = null;

self.onmessage = async function(e) {
  const { taskId, operation, imageData } = e.data;

  if (!wasmInstance) {
    const response = await fetch('/wasm/processor.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes);
    wasmInstance = instance;
  }

  const result = wasmInstance.process(operation, imageData);

  self.postMessage(
    { taskId, result },
    [result.buffer] // Transferable
  );
};
```

---

## 三、现代浏览器 API — 被忽视的性能利器

### 3.1 scheduler.postTask — 下一代任务调度

```javascript
// === scheduler.postTask vs requestIdleCallback vs setTimeout ===
//
// 特性对比:
// ┌────────────────┬──────────────┬────────────────┬──────────────┐
// │ 特性            │ setTimeout    │ rIC            │ postTask     │
// ├────────────────┼──────────────┼────────────────┼──────────────┤
// │ 优先级控制       │ ❌            │ ✅ idle         │ ✅ 四级      │
// │ 延迟保证         │ ✅ 最小延迟    │ ❌ 不保证       │ ✅ 可设置     │
// │ 取消能力         │ ✅ clearTimeout│ ❌            │ ✅ token     │
// │ 浏览器支持       │ ✅ 全支持      │ ⚠️ Chrome only  │ ⚠️ Chrome 115│
// │ 调度粒度         │ 粗            │ 粗             │ 细           │
// └────────────────┴──────────────┴────────────────┴──────────────┘

// === scheduler.postTask 四级优先级 ===

// 'user-blocking' — 用户阻塞任务 (最高优先级)
// 用于: 响应点击后的 UI 更新
scheduler.postTask(() => {
  updateUIAfterClick();
}, { priority: 'user-blocking' });

// 'user-visible' — 用户可见任务 (默认)
// 用于: 渲染可见内容
scheduler.postTask(() => {
  renderVisibleContent();
}, { priority: 'user-visible' });

// 'background' — 后台任务
// 用于: 预加载、数据同步
scheduler.postTask(() => {
  preloadNextPage();
}, { priority: 'background' });

// 'background' + delay — 延迟后台任务
// 用于: 日志上报、分析
scheduler.postTask(() => {
  sendAnalytics();
}, { priority: 'background', delay: 5000 });

// === 实战：用 postTask 重构渲染管线 ===
class PostTaskRenderer {
  constructor(container) {
    this.container = container;
    this.taskToken = new TaskController(); // 可取消
  }

  async render(items) {
    // 分批渲染，每批之间让出主线程
    const batchSize = 50;
    for (let i = 0; i < items.length; i += batchSize) {
      await scheduler.postTask(() => {
        const batch = items.slice(i, i + batchSize);
        this._renderBatch(batch);
      }, { priority: 'user-visible', signal: this.taskToken.signal });
    }
  }

  cancel() {
    this.taskToken.abort();
  }

  _renderBatch(items) {
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      const el = document.createElement('div');
      el.textContent = item.name;
      fragment.appendChild(el);
    });
    this.container.appendChild(fragment);
  }
}
```

### 3.2 PerformanceObserver v3 — 精准性能监控

```javascript
// === 全面的 PerformanceObserver 配置 ===
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      paint: [],       // LCP, FCP
      interaction: [], // INP
      resource: [],    // 资源加载
      layoutShift: [], // CLS
      longTask: [],    // 长任务
      navigation: [],  // 导航指标
      element: [],     // 元素可见性
    };
  }

  start() {
    this._observeLCP();
    this._observeINP();
    this._observeCLS();
    this._observeLongTasks();
    this._observeResources();
    this._observeLayoutShift();
    this._observeElement();
  }

  // === Largest Contentful Paint ===
  _observeLCP() {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.metrics.paint.push({
        type: 'LCP',
        value: lastEntry.startTime,
        element: lastEntry.element?.tagName,
      });
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  }

  // === Interaction to Next Paint (INP) ===
  _observeINP() {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        this.metrics.interaction.push({
          type: 'INP',
          value: entry.duration,
          name: entry.name,
          target: entry.target?.tagName,
        });
      });
    }).observe({ type: 'interaction', buffered: true });
  }

  // === Cumulative Layout Shift ===
  _observeCLS() {
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          this.metrics.layoutShift.push({
            type: 'CLS',
            value: clsValue,
            sources: entry.sources?.map(s => s.node?.tagName).filter(Boolean),
          });
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  }

  // === Long Tasks ===
  _observeLongTasks() {
    new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        this.metrics.longTask.push({
          type: 'LongTask',
          duration: entry.duration,
          name: entry.name,
          attribution: entry.attribution?.map(a => a.name),
        });
      });
    }).observe({ type: 'longtask', buffered: true });
  }

  // === Resource Timing ===
  _observeResources() {
    new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        if (entry.duration > 1000 || entry.transferSize > 500_000) {
          this.metrics.resource.push({
            type: 'SlowResource',
            name: entry.name,
            duration: entry.duration,
            size: entry.transferSize,
            initiatorType: entry.initiatorType,
          });
        }
      });
    }).observe({ type: 'resource', buffered: true });
  }

  // === Element Timing (实验性) ===
  _observeElement() {
    if (!('ElementTiming' in window)) return;
    new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        this.metrics.element.push({
          type: 'Element',
          id: entry.id,
          startTime: entry.startTime,
        });
      });
    }).observe({ type: 'element', buffered: true });
  }

  getReport() {
    const lcp = this.metrics.paint.find(m => m.type === 'LCP');
    const inp = this.metrics.interaction[this.metrics.interaction.length - 1];
    const cls = this.metrics.layoutShift[this.metrics.layoutShift.length - 1];

    return {
      coreWebVitals: {
        LCP: lcp ? `${lcp.value.toFixed(0)}ms ${lcp.value < 2500 ? '✅' : '❌'}` : 'N/A',
        INP: inp ? `${inp.value.toFixed(0)}ms ${inp.value < 200 ? '✅' : '❌'}` : 'N/A',
        CLS: cls ? `${cls.value.toFixed(3)} ${cls.value < 0.1 ? '✅' : '❌'}` : 'N/A',
      },
      longTasks: this.metrics.longTask.length,
      slowResources: this.metrics.resource.length,
      details: this.metrics,
    };
  }
}

// 使用
const monitor = new PerformanceMonitor();
monitor.start();

// 页面 unload 时上报
window.addEventListener('beforeunload', () => {
  const report = monitor.getReport();
  navigator.sendBeacon('/api/perf', JSON.stringify(report));
});
```

### 3.3 OffscreenCanvas — 离屏渲染

```javascript
// === OffscreenCanvas 基础 ===
// 可以在 Worker 中创建和操作 Canvas，不阻塞主线程

// 方式一：从现有 Canvas 获取
const canvas = document.getElementById('myCanvas');
const offscreen = canvas.transferControlToOffscreen();
const worker = new Worker('./canvas-worker.js');
worker.postMessage({ canvas: offscreen }, [offscreen]);

// 方式二：直接创建
const offscreen2 = new OffscreenCanvas(800, 600);
const ctx = offscreen2.getContext('2d');

// === canvas-worker.js ===
self.onmessage = function(e) {
  const { canvas } = e.data;
  const ctx = canvas.getContext('2d');

  // 在 Worker 中绘制 — 不阻塞主线程
  function render() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制粒子效果
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 60%)`;
      ctx.fill();
    }

    requestAnimationFrame(render); // Worker 中也可用 rAF
  }

  render();
};

// === 实战：视频帧处理 ===
async function processVideoFrames(videoElement) {
  const canvas = new OffscreenCanvas(
    videoElement.videoWidth,
    videoElement.videoHeight
  );
  const ctx = canvas.getContext('2d');

  const worker = new Worker('./frame-processor.js');

  videoElement.addEventListener('play', () => {
    function captureFrame() {
      if (videoElement.paused) return;
      ctx.drawImage(videoElement, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

      worker.postMessage(
        { frame, width: canvas.width, height: canvas.height },
        [frame.data.buffer] // Transferable
      );

      requestAnimationFrame(captureFrame);
    }
    captureFrame();
  });

  worker.onmessage = (e) => {
    const { processedFrame } = e.data;
    // 处理后的帧可以传回主线程显示，或直接在 Worker 中绘制到 OffscreenCanvas
  };
}
```

### 3.4 CompressionStream / DecompressionStream — 原生压缩

```javascript
// === 浏览器原生压缩 API — 无需第三方库 ===

// Gzip 压缩
async function gzipData(data) {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();

  writer.write(new TextEncoder().encode(data));
  writer.close();

  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // 合并 chunks
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// Gzip 解压
async function gunzipData(compressedData) {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  writer.write(compressedData);
  writer.close();

  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(result);
}

// === 实战：大数据压缩后存储到 IndexedDB ===
async function storeCompressed(key, data) {
  const jsonStr = JSON.stringify(data);
  const compressed = await gzipData(jsonStr);

  const db = await openDB();
  const tx = db.transaction('cache', 'readwrite');
  await tx.store.put({ key, data: compressed, compressed: true, size: jsonStr.length });
}

async function loadDecompressed(key) {
  const db = await openDB();
  const tx = db.transaction('cache', 'readonly');
  const record = await tx.store.get(key);

  if (record?.compressed) {
    return JSON.parse(await gunzipData(record.data));
  }
  return record?.data;
}

// === 性能收益 ===
// JSON 数据通常可压缩 60-80%
// 对于 10MB 的 JSON → 压缩后 2-4MB
// IndexedDB 存储空间节省显著
// 读写速度: 压缩/解压时间 < 磁盘 I/O 节省时间 (对大数据)
```

### 3.5 View Transitions API — 无闪烁页面切换

```javascript
// === View Transitions — 浏览器原生过渡动画 ===
// 替代手动 DOM diff + CSS 动画

// 简单页面切换
document.getElementById('switch-btn').addEventListener('click', async () => {
  await document.startViewTransition(() => {
    // 更新 DOM
    updateContent();
  });
});

// 自定义过渡动画
document.startViewTransition(async () => {
  await updateContent();
}).ready.then(() => {
  // 为特定元素设置过渡
  document.documentElement.animate(
    [
      { clipPath: 'circle(0% at 50% 50%)' },
      { clipPath: 'circle(100% at 50% 50%)' },
    ],
    { duration: 500, easing: 'ease-in-out' }
  );
});

// === 实战：列表项插入动画 ===
async function addListItem(item) {
  const transition = document.startViewTransition(() => {
    const list = document.getElementById('item-list');
    const el = document.createElement('div');
    el.className = 'list-item';
    el.textContent = item.name;
    el.style.viewTransitionName = `item-${item.id}`;
    list.appendChild(el);
  });

  await transition.ready;

  // 为新元素添加入场动画
  const newItem = document.querySelector(`[view-transition-name="item-${item.id}"]`);
  if (newItem) {
    newItem.animate(
      [
        { opacity: 0, transform: 'translateY(-20px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 300, easing: 'ease-out' }
    );
  }
}
```

---

## 四、高级内存管理 — WeakRef、FinalizationRegistry 与对象池

### 4.1 WeakRef & FinalizationRegistry 深度解析

```javascript
// === WeakRef — 弱引用，不阻止 GC ===
// 适用场景: 缓存、映射表 — 允许 GC 回收缓存项

class WeakCache {
  constructor() {
    this.cache = new Map(); // key → WeakRef
    this.hitCount = 0;
    this.missCount = 0;
  }

  get(key) {
    const ref = this.cache.get(key);
    if (ref) {
      const value = ref.deref(); // 尝试获取强引用
      if (value !== undefined) {
        this.hitCount++;
        return value;
      }
      // 已被 GC 回收，清理
      this.cache.delete(key);
    }
    this.missCount++;
    return undefined;
  }

  set(key, value) {
    this.cache.set(key, new WeakRef(value));
  }

  get stats() {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 ? (this.hitCount / total * 100).toFixed(1) + '%' : 'N/A',
    };
  }
}

// === FinalizationRegistry — 对象被 GC 时的回调 ===
// 注意: 回调不保证执行 (取决于 GC 时机)，不可用于关键逻辑

class ResourceTracker {
  constructor() {
    this.registry = new FinalizationRegistry((heldValue) => {
      console.log(`[GC] ${heldValue} 已被回收`);
      this.activeResources.delete(heldValue);
    });
    this.activeResources = new Set();
  }

  track(resource, name) {
    this.activeResources.add(name);
    this.registry.register(resource, name);
  }

  untrack(resource) {
    this.registry.unregister(resource);
  }

  get activeCount() {
    return this.activeResources.size;
  }
}

// === 组合使用: 带清理的智能缓存 ===
class SmartCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.map = new Map(); // key → { ref: WeakRef, cleanup: Function }
    this.registry = new FinalizationRegistry((key) => {
      // 值被 GC 后自动清理 Map 条目
      this.map.delete(key);
      console.log(`[SmartCache] 自动清理: ${key}`);
    });
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    const value = entry.ref.deref();
    if (value === undefined) {
      this.map.delete(key);
      return undefined;
    }
    return value;
  }

  set(key, value, cleanupFn = null) {
    // 超出容量时清理最旧的
    if (this.map.size >= this.maxSize) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }

    this.map.set(key, { ref: new WeakRef(value), cleanup: cleanupFn });
    this.registry.register(value, key);
  }

  clear() {
    this.map.clear();
  }
}
```

### 4.2 对象池 — 减少 GC 压力

```javascript
// === 对象池模式 — 复用对象，减少分配和 GC ===
// 适用场景: 频繁创建/销毁的对象 (事件对象、粒子、动画帧数据)

class ObjectPool {
  constructor(factory, resetFn, initialSize = 10) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.available = [];
    this.inUse = new Set();

    // 预分配
    for (let i = 0; i < initialSize; i++) {
      this.available.push(factory());
    }
  }

  acquire() {
    let obj;
    if (this.available.length > 0) {
      obj = this.available.pop();
    } else {
      obj = this.factory();
    }
    this.inUse.add(obj);
    return obj;
  }

  release(obj) {
    if (this.inUse.has(obj)) {
      this.resetFn(obj);
      this.inUse.delete(obj);
      this.available.push(obj);
    }
  }

  get stats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
    };
  }
}

// === 实战: 粒子系统对象池 ===
class ParticleSystem {
  constructor(maxParticles = 10000) {
    this.particlePool = new ObjectPool(
      () => ({
        x: 0, y: 0,
        vx: 0, vy: 0,
        life: 0, maxLife: 0,
        color: '#fff',
        size: 1,
        active: false,
      }),
      (p) => {
        p.x = p.y = p.vx = p.vy = 0;
        p.life = p.maxLife = 0;
        p.active = false;
      },
      maxParticles
    );

    this.activeParticles = [];
  }

  emit(x, y, count = 1) {
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.acquire();
      p.x = x;
      p.y = y;
      p.vx = (Math.random() - 0.5) * 4;
      p.vy = (Math.random() - 0.5) * 4 - 2;
      p.life = 0;
      p.maxLife = 60 + Math.random() * 60;
      p.color = `hsl(${Math.random() * 360}, 80%, 60%)`;
      p.size = 2 + Math.random() * 3;
      p.active = true;
      this.activeParticles.push(p);
    }
  }

  update() {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // gravity
      p.life++;

      if (p.life >= p.maxLife) {
        p.active = false;
        this.particlePool.release(p);
        this.activeParticles.splice(i, 1);
      }
    }
  }

  render(ctx) {
    for (const p of this.activeParticles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// === 对比: 有对象池 vs 无对象池的 GC 行为 ===
//
// 无对象池 (每帧创建新粒子):
// - 10000 粒子/秒 → 10000 次对象分配
// - 每 60 帧 → 600,000 次分配/分钟
// - GC 频繁触发 → 主线程卡顿
//
// 有对象池:
// - 预分配 10000 个对象
// - 复用 → 0 次新分配
// - GC 几乎不触发 → 流畅 60fps
```

### 4.3 内存泄漏检测工具

```javascript
// === 自动化内存泄漏检测 ===
class MemoryLeakDetector {
  constructor() {
    this.snapshots = [];
    this.warnings = [];
  }

  // 拍摄内存快照
  snapshot(label) {
    if (performance.memory) {
      const mem = performance.memory;
      this.snapshots.push({
        label,
        timestamp: Date.now(),
        usedJSHeapSize: mem.usedJSHeapSize,
        totalJSHeapSize: mem.totalJSHeapSize,
        jsHeapSizeLimit: mem.jsHeapSizeLimit,
      });
    }
    return this;
  }

  // 对比两次快照
  compare(label1, label2) {
    const s1 = this.snapshots.find(s => s.label === label1);
    const s2 = this.snapshots.find(s => s.label === label2);
    if (!s1 || !s2) return null;

    const diff = {
      heapGrowth: s2.usedJSHeapSize - s1.usedJSHeapSize,
      heapGrowthMB: ((s2.usedJSHeapSize - s1.usedJSHeapSize) / 1024 / 1024).toFixed(2),
      growthRate: s1.usedJSHeapSize > 0
        ? ((s2.usedJSHeapSize - s1.usedJSHeapSize) / s1.usedJSHeapSize * 100).toFixed(1) + '%'
        : 'N/A',
    };

    if (diff.heapGrowth > 10 * 1024 * 1024) { // > 10MB
      this.warnings.push({
        type: 'LargeHeapGrowth',
        label: `${label1} → ${label2}`,
        growth: diff.heapGrowthMB + 'MB',
        recommendation: '可能存在内存泄漏，检查闭包、事件监听器、DOM 引用',
      });
    }

    return diff;
  }

  // 监控 DOM 节点增长
  monitorDOMGrowth() {
    const observer = new MutationObserver((mutations) => {
      const addedNodes = mutations.reduce(
        (count, m) => count + m.addedNodes.length, 0
      );
      const removedNodes = mutations.reduce(
        (count, m) => count + m.removedNodes.length, 0
      );

      if (addedNodes - removedNodes > 100) {
        this.warnings.push({
          type: 'DOMNodeLeak',
          count: addedNodes - removedNodes,
          recommendation: 'DOM 节点持续增长，检查是否正确移除动态元素',
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
  }

  // 检测事件监听器泄漏
  detectEventListenerLeaks() {
    const elements = document.querySelectorAll('*');
    const leakCandidates = [];

    elements.forEach(el => {
      // 获取元素上的事件监听器 (非标准，但 DevTools 支持)
      const listeners = getEventListeners ? getEventListeners(el) : null;
      if (listeners) {
        const count = Object.values(listeners).reduce(
          (sum, arr) => sum + arr.length, 0
        );
        if (count > 5) {
          leakCandidates.push({
            element: el.tagName + (el.id ? '#' + el.id : ''),
            listenerCount: count,
          });
        }
      }
    });

    return leakCandidates;
  }

  getReport() {
    return {
      snapshots: this.snapshots,
      warnings: this.warnings,
      memory: performance.memory ? {
        used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) + 'MB',
        total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(1) + 'MB',
        limit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(0) + 'MB',
      } : 'N/A (非 Chromium)',
    };
  }
}

// === 使用示例 ===
const detector = new MemoryLeakDetector();

// 1. 初始快照
detector.snapshot('before-interaction');

// 2. 模拟用户操作 (如反复打开/关闭模态框)
for (let i = 0; i < 50; i++) {
  openModal();
  closeModal();
}

// 3. 操作后快照
detector.snapshot('after-interaction');

// 4. 对比
const diff = detector.compare('before-interaction', 'after-interaction');
console.log('内存增长:', diff?.heapGrowthMB + 'MB');

// 5. 生成报告
console.log(detector.getReport());
```

---

## 五、综合实战：高性能实时数据可视化

### 5.1 场景描述

构建一个实时数据看板，要求：
- 每秒接收 1000+ 数据点
- 实时渲染折线图 + 热力图
- 支持缩放/平移
- INP < 100ms，帧率稳定 60fps

### 5.2 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      架构概览                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  WebSocket ──→ DataWorker (WASM 处理)                       │
│     │              │                                        │
│     │         数据聚合 + 降采样                              │
│     │              │                                        │
│     │         Transferable 传递                             │
│     │              │                                        │
│     ▼              ▼                                        │
│  RenderWorker (OffscreenCanvas)                             │
│     │              │                                        │
│     │         离屏渲染 60fps                                │
│     │              │                                        │
│     ▼              ▼                                        │
│  主线程 (仅 UI 交互)                                         │
│  • 事件处理 (INP)                                           │
│  • 控制面板                                                  │
│  • 缩放/平移交互                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 完整实现

```javascript
// === data-processor.js (Worker + WASM) ===
// 数据聚合、降采样、统计计算

let wasmModule = null;

self.onmessage = async function(e) {
  const { type, data, config } = e.data;

  switch (type) {
    case 'init':
      // 加载 WASM 模块
      const response = await fetch(config.wasmUrl);
      const bytes = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes);
      wasmModule = instance;
      self.postMessage({ type: 'ready' });
      break;

    case 'process':
      // 数据降采样 (LTTB - Largest-Triangle-Three-Buckets)
      const downsampled = lttbDownsample(data, config.maxPoints);
      // 计算统计信息
      const stats = computeStats(downsampled);
      // 使用 Transferable 返回
      self.postMessage(
        { type: 'processed', data: downsampled, stats },
        [downsampled.buffer]
      );
      break;

    case 'heatmap':
      // 热力图数据聚合
      const heatmap = aggregateToGrid(data, config.gridSize);
      self.postMessage(
        { type: 'heatmap', data: heatmap },
        [heatmap.buffer]
      );
      break;
  }
};

// === LTTB 降采样算法 ===
function lttbDownsample(data, maxPoints) {
  const n = data.length;
  if (n <= maxPoints) return data;

  const sampled = new Float64Array(maxPoints * 2); // [x, y] pairs
  const bucketSize = (n - 2) / (maxPoints - 2);

  // 第一个点
  sampled[0] = data[0];
  sampled[1] = data[1];

  let outIndex = 2;
  for (let i = 0; i < maxPoints - 2; i++) {
    const bucketStart = Math.floor(i * bucketSize) + 1;
    const bucketEnd = Math.floor((i + 1) * bucketSize) + 1;
    const nextBucketStart = Math.floor((i + 2) * bucketSize) + 1;

    // 计算下一个桶的平均值
    let avgX = 0, avgY = 0, count = 0;
    for (let j = nextBucketStart; j < Math.min(nextBucketStart + bucketSize, n); j++) {
      avgX += data[j * 2];
      avgY += data[j * 2 + 1];
      count++;
    }
    avgX /= count;
    avgY /= count;

    // 在当前桶中找到最大三角形的点
    const prevX = sampled[outIndex - 2];
    const prevY = sampled[outIndex - 1];
    let maxArea = -1;
    let maxIndex = bucketStart;

    for (let j = bucketStart; j < bucketEnd; j++) {
      const area = Math.abs(
        (prevX - avgX) * (data[j * 2 + 1] - prevY) -
        (prevX - data[j * 2]) * (avgY - prevY)
      );
      if (area > maxArea) {
        maxArea = area;
        maxIndex = j;
      }
    }

    sampled[outIndex] = data[maxIndex * 2];
    sampled[outIndex + 1] = data[maxIndex * 2 + 1];
    outIndex += 2;
  }

  // 最后一个点
  sampled[outIndex] = data[(n - 1) * 2];
  sampled[outIndex + 1] = data[(n - 1) * 2 + 1];

  return sampled;
}

function computeStats(data) {
  let min = Infinity, max = -Infinity, sum = 0;
  for (let i = 1; i < data.length; i += 2) {
    const val = data[i];
    if (val < min) min = val;
    if (val > max) max = val;
    sum += val;
  }
  return {
    min, max, avg: sum / (data.length / 2),
    points: data.length / 2,
  };
}

function aggregateToGrid(data, gridSize) {
  const grid = new Float32Array(gridSize * gridSize);
  const cellW = 1000 / gridSize;
  const cellH = 1000 / gridSize;

  for (let i = 0; i < data.length; i += 2) {
    const gx = Math.min(gridSize - 1, Math.floor(data[i] / cellW));
    const gy = Math.min(gridSize - 1, Math.floor(data[i + 1] / cellH));
    grid[gy * gridSize + gx]++;
  }
  return grid;
}

// === renderer.js (Worker — OffscreenCanvas 渲染) ===
self.onmessage = function(e) {
  const { type, canvas, data, config } = e.data;

  if (type === 'init') {
    const ctx = canvas.getContext('2d');
    let animId;

    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制背景网格
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 绘制数据线
      if (data) {
        ctx.beginPath();
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 4;

        for (let i = 0; i < data.length; i += 2) {
          const x = (data[i] / 1000) * canvas.width;
          const y = canvas.height - (data[i + 1] / 100) * canvas.height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(render);
    }

    render();
  }
};

// === 主线程 — 协调 + UI ===
class RealtimeDashboard {
  constructor() {
    this.dataWorker = new Worker('./data-processor.js');
    this.renderWorker = null;
    this.canvas = document.getElementById('chart');
    this.offscreen = this.canvas.transferControlToOffscreen();
    this.isConnected = false;
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.fps = 0;
  }

  async init() {
    // 初始化数据 Worker
    this.dataWorker.postMessage({
      type: 'init',
      config: { wasmUrl: '/wasm/processor.wasm' }
    });

    // 等待 WASM 加载
    await new Promise((resolve) => {
      this.dataWorker.onmessage = (e) => {
        if (e.data.type === 'ready') resolve();
      };
    });

    // 初始化渲染 Worker
    this.renderWorker = new Worker('./renderer.js');
    this.renderWorker.postMessage(
      { type: 'init', canvas: this.offscreen },
      [this.offscreen]
    );

    // 启动 FPS 监控
    this._startFpsMonitor();

    console.log('Dashboard initialized ✅');
  }

  connectWebSocket(url) {
    const ws = new WebSocket(url);

    ws.onmessage = async (e) => {
      const rawData = JSON.parse(e.data);
      const points = rawData.points; // [x, y, x, y, ...]

      // 发送到数据 Worker 处理
      this.dataWorker.postMessage(
        {
          type: 'process',
          data: new Float64Array(points),
          config: { maxPoints: 500 },
        },
        [points.buffer] // Transferable
      );
    };

    this.dataWorker.onmessage = (e) => {
      if (e.data.type === 'processed') {
        // 发送到渲染 Worker
        this.renderWorker.postMessage(
          { type: 'render', data: e.data.data },
          [e.data.data.buffer]
        );
      }
    };

    this.isConnected = true;
  }

  _startFpsMonitor() {
    let frames = 0;
    const measure = () => {
      frames++;
      const now = performance.now();
      if (now - this.lastFpsTime >= 1000) {
        this.fps = frames;
        frames = 0;
        this.lastFpsTime = now;
        this._updateFpsDisplay();
      }
      requestAnimationFrame(measure);
    };
    requestAnimationFrame(measure);
  }

  _updateFpsDisplay() {
    const el = document.getElementById('fps-counter');
    if (el) {
      el.textContent = `${this.fps} FPS`;
      el.style.color = this.fps >= 55 ? '#00ff88' : this.fps >= 30 ? '#ffaa00' : '#ff4444';
    }
  }

  destroy() {
    this.dataWorker.terminate();
    this.renderWorker?.terminate();
  }
}

// === 性能数据 ===
//
// 优化前 (主线程处理):
// - 1000 点/秒 → 主线程占用 40-60%
// - INP: 200-500ms (严重卡顿)
// - 帧率: 15-25fps
// - 内存: 持续增长，每分钟泄漏 ~5MB
//
// 优化后 (Worker + WASM + Transferable):
// - 主线程占用: < 5%
// - INP: < 50ms (流畅)
// - 帧率: 稳定 60fps
// - 内存: 稳定，对象池复用，无泄漏
```

---

## 六、性能优化决策树

### 6.1 何时用什么技术？

```
问题: 页面卡顿 / INP 高
  │
  ├─ 是长任务阻塞主线程？
  │   ├─ 是 → 数据计算/图像处理 → Web Worker
  │   │       └─ 计算密集? → WASM
  │   │
  │   └─ 否 → 继续排查
  │
  ├─ 是频繁 DOM 操作？
  │   ├─ 是 → DocumentFragment / 批量更新
  │   │       └─ 大量列表项? → 虚拟滚动
  │   │
  │   └─ 否 → 继续排查
  │
  ├─ 是频繁事件触发？
  │   ├─ 是 → 防抖 / 节流
  │   │       └─ 需要精确时机? → requestAnimationFrame
  │   │
  │   └─ 否 → 继续排查
  │
  ├─ 是内存增长？
  │   ├─ 是 → 检测泄漏 (DevTools Memory)
  │   │       ├─ 闭包持有? → WeakRef
  │   │       ├─ 事件监听器? → removeEventListener
  │   │       ├─ DOM 引用? → 清除引用
  │   │       └─ 频繁创建对象? → 对象池
  │   │
  │   └─ 否 → 继续排查
  │
  └─ 是加载慢？
      ├─ 是 → 懒加载 / 代码分割
      │       └─ 图片? → 现代格式 (WebP/AVIF)
      │
      └─ 否 → 使用 PerformanceMonitor 定位
```

### 6.2 技术选型速查表

| 场景 | 推荐技术 | 备选 | 不推荐 |
|------|----------|------|--------|
| 大数据计算 | Worker + WASM | Worker | 主线程 |
| 图片处理 | Worker + OffscreenCanvas | Canvas 2D | 主线程 Canvas |
| 高频事件 | 防抖/节流 + rAF | scheduler.postTask | 直接处理 |
| 大量 DOM | 虚拟滚动 + Fragment | 分页渲染 | 一次性渲染 |
| 缓存 | WeakCache (WeakRef) | Map + LRU | 无限 Map |
| 频繁对象创建 | 对象池 | 直接 new | 无管理 |
| 数据传输 | Transferable | 序列化 | 结构化克隆 |
| 后台任务 | scheduler.postTask | rIC / setTimeout | setTimeout 0 |
| 性能监控 | PerformanceObserver | 手动 timing | 凭感觉 |

---

## 七、闭卷自测题

### 题 1：Worker 通信陷阱
```javascript
// 以下代码有什么问题？如何修复？
const worker = new Worker('worker.js');
const bigData = new Float32Array(50_000_000); // 200MB

function processData() {
  worker.postMessage({ data: bigData });
}

// 每帧调用
requestAnimationFrame(function loop() {
  processData();
  requestAnimationFrame(loop);
});
```

<details>
<summary>点击查看答案</summary>

问题：
1. 每次 postMessage 都克隆 200MB 数据 → 主线程严重阻塞
2. 没有 Transferable → 应该用 [bigData.buffer]
3. 没有检查 Worker 是否空闲 → 消息堆积
4. 没有错误处理

修复：
```javascript
const worker = new Worker('worker.js');
let isProcessing = false;

function processData() {
  if (isProcessing) return; // 跳过，等上一帧完成
  isProcessing = true;

  const bigData = new Float32Array(50_000_000);
  worker.postMessage(
    { data: bigData },
    [bigData.buffer] // Transferable 零拷贝
  );
}

worker.onmessage = () => {
  isProcessing = false; // Worker 完成，可以处理下一帧
};
```
</details>

### 题 2：WeakRef 使用场景判断
```javascript
// 以下哪些场景适合用 WeakRef？
// A. 缓存 DOM 元素引用
// B. 缓存计算结果
// C. 存储用户登录状态
// D. 事件回调映射
// E. 图片缩略图缓存

// 答案: B, E
// A: DOM 元素被移除后 WeakRef 不会自动清理 (DOM 不在 JS 堆)
// C: 登录状态不能丢失，不能用弱引用
// D: 回调被 GC 后事件无法触发
```

### 题 3：对象池 vs 直接创建
```javascript
// 场景：一个游戏每秒创建 5000 个子弹对象，每个对象生命周期 2 秒
// 问：使用对象池能减少多少次 GC 触发？

// 无对象池:
// - 每秒 5000 个对象 → 每分钟 300,000 个
// - 每个对象约 100 bytes → 每分钟 30MB 分配
// - V8 新生代 GC 阈值 ~16-32MB → 每分钟触发 1-2 次 Minor GC

// 有对象池:
// - 预分配 10,000 个对象 (2 秒 × 5000/秒)
// - 运行中 0 次新分配
// - Minor GC 触发次数: 0

// 结论: 减少 ~100% 的 Minor GC 触发
```

---

## 八、总结

### 本次训练产出

| 模块 | 内容 | 代码量 |
|------|------|--------|
| Web Workers | WorkerPool、图片处理 Worker、性能基准 | ~250 行 |
| WebAssembly | WASM 基础、AssemblyScript 图片滤镜、WASM+Worker 组合 | ~200 行 |
| 现代浏览器 API | scheduler.postTask、PerformanceObserver v3、OffscreenCanvas、CompressionStream、View Transitions | ~300 行 |
| 高级内存管理 | WeakCache、FinalizationRegistry、对象池、内存泄漏检测 | ~250 行 |
| 综合实战 | 实时数据可视化 (Worker+WASM+OffscreenCanvas) | ~200 行 |
| 决策树+自测 | 技术选型表、3 道闭卷题 | ~100 行 |

### Phase 1 → Phase 2 能力跃迁

```
Phase 1 能力:                    Phase 2 能力:
├─ 主线程优化                    ├─ 主线程外计算 (Worker)
│  ├─ 懒加载                     │  └─ WorkerPool + Transferable
│  ├─ 防抖节流                   ├─ 底层性能突破 (WASM)
│  ├─ 内存管理                   │  └─ AssemblyScript + 零拷贝
│  └─ 渲染优化                   ├─ 现代浏览器 API
├─ 网络优化                       │  ├─ scheduler.postTask
│  ├─ 资源压缩                    │  ├─ PerformanceObserver v3
│  └─ 缓存策略                    │  ├─ OffscreenCanvas
└─ 性能审计                       │  ├─ CompressionStream
   ├─ Lighthouse                 │  └─ View Transitions
   └─ Web Vitals                └─ 高级内存管理
                                    ├─ WeakRef + FinalizationRegistry
                                    ├─ 对象池
                                    └─ 自动化泄漏检测
```

### 累计性能优化训练 (6 次)

| 日期 | 主题 | 核心产出 |
|------|------|----------|
| 4/24 | 基础版 | 懒加载/防抖节流/内存管理/虚拟列表 |
| 4/25 | 进阶版 | CRP/Web Vitals/重排优化/网络层 |
| 4/26 | 综合实战 | 高性能数据看板 |
| 4/27 | 查漏补缺 | SSR/Canvas/SW 扩展 |
| 4/28 | 生产级 Toolkit | 八大模块可复用库 |
| 4/29 | 实战模式 | 真实场景 + 反模式 |
| 4/30 | Phase 1 终章 | 性能审计框架 + 端到端优化 |
| **5/02** | **Phase 2 进阶** | **Worker + WASM + 现代 API + 高级内存** |

---

_下次训练预告: Phase 2 继续 — Vite 构建优化 + Tree Shaking 深度 + 包体积分析_
