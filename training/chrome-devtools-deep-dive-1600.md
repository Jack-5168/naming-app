# Chrome DevTools 深度使用：性能分析 / 内存泄漏检测 / 断点调试

> 专项训练 16:00 | 2026-04-26
> 覆盖三大核心能力：Performance 性能分析、Memory 内存泄漏检测、Sources 断点调试

---

## 目录

1. [Chrome DevTools 架构概览](#1-chrome-devtools-架构概览)
2. [Performance 性能分析](#2-performance-性能分析)
3. [Memory 内存泄漏检测](#3-memory-内存泄漏检测)
4. [Sources 断点调试](#4-sources-断点调试)
5. [Network 网络分析进阶](#5-network-网络分析进阶)
6. [综合实战：性能优化全流程](#6-综合实战性能优化全流程)
7. [调试技巧速查表](#7-调试技巧速查表)

---

## 1. Chrome DevTools 架构概览

### 1.1 DevTools 面板矩阵

```
┌─────────────────────────────────────────────────────────────┐
│  Elements │ Console │ Sources │ Network │ Performance       │
│  Memory   │ Application │ Security │ Lighthouse │ More...   │
└─────────────────────────────────────────────────────────────┘
```

| 面板 | 核心用途 | 关键能力 |
|------|----------|----------|
| **Elements** | DOM/CSS 审查 | 实时编辑、Computed 样式、Box Model、Event Listeners |
| **Console** | JS 控制台 | 日志、REPL、$0/$1 快捷引用、inspect() |
| **Sources** | 断点调试 | 断点、调用栈、作用域、XHR 断点、DOM 断点 |
| **Network** | 网络请求 | 请求/响应详情、Waterfall、Throttling、Export HAR |
| **Performance** | 性能分析 | 火焰图、Main Thread、FPS、GPU、截图对比 |
| **Memory** | 内存分析 | Heap Snapshot、Allocation Timeline、Leak Detection |
| **Application** | 应用状态 | Storage、Service Workers、Manifest、Frames |
| **Security** | 安全审查 | 证书、混合内容、CSP 违规 |

### 1.2 快捷键速查

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+I` / `Cmd+Opt+I` | 打开 DevTools |
| `Ctrl+Shift+C` / `Cmd+Opt+C` | 元素选取模式 |
| `Ctrl+Shift+J` / `Cmd+Opt+J` | 打开 Console |
| `Ctrl+P` / `Cmd+P` | 文件搜索 (Sources) |
| `Ctrl+Shift+P` / `Cmd+Shift+P` | 命令菜单 (Command Menu) |
| `Ctrl+Shift+F` / `Cmd+Opt+F` | 全局文件搜索 |
| `F8` / `Cmd+\` | 继续/暂停 |
| `F10` / `Cmd+'` | 单步跳过 (Step Over) |
| `F11` / `Cmd+;` | 单步进入 (Step Into) |
| `Shift+F11` / `Cmd+Shift+;` | 单步退出 (Step Out) |
| `Ctrl+\` | 在当前行切换断点 |
| `Ctrl+O` | 跳转到函数/行号 |
| `Ctrl+Shift+:` | 切换黑盒脚本 (Blackbox) |

### 1.3 Command Menu 强大命令

按 `Ctrl+Shift+P` 打开命令菜单，常用命令：

- `show performance` — 打开 Performance 面板
- `show memory` — 打开 Memory 面板
- `capture screenshot` — 截图
- `show rendering` — 渲染面板 (FPS/重绘区域/布局偏移)
- `capture heap snapshot` — 捕获堆快照
- `start profiling` — 开始性能分析
- `blackbox selected script` — 黑盒化脚本（跳过第三方库）
- `set instrumentation` — 设置事件检测

---

## 2. Performance 性能分析

### 2.1 Performance 面板工作原理

```
┌──────────────────────────────────────────────────────┐
│  [Record] [Capture screenshot] [Disable JS] [Network] │
├──────────────────────────────────────────────────────┤
│  FPS │ CPU │ NET │ 截图时间线                          │
├──────────────────────────────────────────────────────┤
│  Flame Chart (火焰图) — 按时间轴展示所有线程活动       │
│  Main Thread ████████████████░░░░███████████████       │
│  Worker 1    ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │
│  Compositor  ░░░░████░░░░████░░░░████░░░░████░░       │
├──────────────────────────────────────────────────────┤
│  Summary │ 火焰图 │ 事件日志 │ 截图 │ 网络 │ 线程     │
└──────────────────────────────────────────────────────┘
```

**核心概念：**

1. **帧 (Frame)** — 60fps = 每帧 16.67ms，30fps = 每帧 33.33ms
2. **Main Thread** — 主线程负责 DOM 操作、JS 执行、样式计算、布局、绘制
3. **火焰图 (Flame Chart)** — 水平 = 时间，垂直 = 调用栈深度，宽度 = 耗时
4. **事件 (Event)** — 每个矩形代表一个事件（函数调用、布局、绘制等）

### 2.2 性能分析完整流程

#### Step 1: 准备录制

```javascript
// 录制前清理状态
// 1. 勾选 "Disable cache" 避免缓存干扰
// 2. 勾选 "Screenshot" 捕获页面截图
// 3. 选择预设配置:
//    - Default (CPU 4x slowdown) — 模拟低端设备
//    - Mobile — 移动设备模拟
//    - Desktop — 桌面设备
// 4. 可选: 勾选 "Memory" 追踪内存变化
```

#### Step 2: 执行录制

```
操作流程：
1. 点击 Record 按钮 (●)
2. 执行目标操作 (如：点击按钮、滚动页面、加载数据)
3. 等待操作完成 + 稳定 (至少 2-3 秒)
4. 点击 Stop 按钮 (■)
```

#### Step 3: 分析火焰图

```
火焰图解读规则：
┌─────────────────────────────────────┐
│  ▼ render()          120ms          │  ← 顶层函数，总耗时
│    ▼ updateDOM()     80ms          │    ← 子调用，占 67%
│      ▼ querySelector() 5ms         │      ← 具体操作
│      ▼ setAttribute() 15ms         │
│      ▼ appendChild() 60ms          │      ← 瓶颈！
│    ▼ calculateLayout() 40ms        │
│      ▼ getBoundingClientRect() 35ms │      ← 强制同步布局！
└─────────────────────────────────────┘

关键指标：
- 红色块 = 长时间任务 (Long Task, >50ms)
- 黄色块 = 中等耗时
- 绿色块 = 快速操作
- 紫色 = Layout (布局)
- 绿色 = Paint (绘制)
- 蓝色 = Script (JS 执行)
- 橙色 = GC (垃圾回收)
```

### 2.3 Performance 关键指标详解

#### 2.3.1 Summary 面板指标

```
┌──────────────────────────────────────────────┐
│  Metrics (关键指标)                            │
├──────────────────────────────────────────────┤
│  Duration:        2.3s     录制总时长         │
│  JS Heap Size:    45MB     堆内存峰值         │
│  CPU Usage:       78%      CPU 占用率         │
│  Tasks:           1,247    任务总数           │
│  Tasks Duration:  1.8s     任务总耗时         │
│  Scripts:         450ms    JS 执行总耗时      │
│  Layout:          320ms    布局总耗时          │
│  Recalculate Style: 180ms  样式重计算         │
│  Paint:           150ms    绘制总耗时          │
│  Garbage Collection: 95ms GC 耗时            │
└──────────────────────────────────────────────┘
```

#### 2.3.2 Web Vitals 在 Performance 中的体现

```
LCP (Largest Contentful Paint) — 最大内容绘制
├─ 在火焰图中找到 "Largest Contentful Paint" 事件
├─ 查看对应截图，确认渲染的内容
└─ 目标: < 2.5s

FID (First Input Delay) — 首次输入延迟
├─ 找到 "First Input" 事件
├─ 查看从输入到主线程空闲的时间
└─ 目标: < 100ms

CLS (Cumulative Layout Shift) — 累积布局偏移
├─ 找到 "Layout Shift" 事件
├─ 查看 shift sources (哪些元素移动了)
└─ 目标: < 0.1

INP (Interaction to Next Paint) — 交互到下次绘制
├─ 查看所有 "Event" 类型 (click/key/touch)
├─ 计算 input delay + processing + presentation
└─ 目标: < 200ms
```

### 2.4 常见性能问题诊断

#### 问题 1: 长任务 (Long Tasks)

```javascript
// ❌ 问题代码：长任务阻塞主线程
function processLargeDataset(data) {
  for (let i = 0; i < data.length; i++) {
    // 同步处理 100,000 条数据
    results.push(transform(data[i]));
  }
  render(results); // 一次性渲染
}

// ✅ 解决方案 1: 分块处理 (Chunking)
async function processLargeDatasetChunked(data, chunkSize = 100) {
  const results = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    results.push(...chunk.map(transform));
    // 让出主线程，允许浏览器渲染
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  render(results);
}

// ✅ 解决方案 2: 使用 requestIdleCallback
function processLargeDatasetIdle(data) {
  const results = [];
  let index = 0;
  const chunkSize = 100;

  function processChunk(deadline) {
    while (deadline.timeRemaining() > 0 && index < data.length) {
      const chunk = data.slice(index, index + chunkSize);
      results.push(...chunk.map(transform));
      index += chunkSize;
    }
    if (index < data.length) {
      requestIdleCallback(processChunk);
    } else {
      render(results);
    }
  }

  requestIdleCallback(processChunk);
}

// ✅ 解决方案 3: Web Worker
// worker.js
self.onmessage = function(e) {
  const data = e.data;
  const results = data.map(transform);
  self.postMessage(results);
};

// main.js
const worker = new Worker('worker.js');
worker.onmessage = function(e) {
  render(e.data);
};
worker.postMessage(largeDataset);
```

#### 问题 2: 强制同步布局 (Forced Reflow)

```javascript
// ❌ 问题代码：读写交替触发强制同步布局
function badLayoutThrashing() {
  for (let i = 0; i < items.length; i++) {
    // 读 — 触发 layout
    const height = items[i].offsetHeight;
    // 写 — 标记 dirty
    items[i].style.height = (height + 10) + 'px';
  }
  // 浏览器被迫在每次循环中重新计算布局
}

// ✅ 解决方案：读写分离 (Batching)
function goodLayoutBatching() {
  // Phase 1: 批量读取
  const heights = items.map(item => item.offsetHeight);

  // Phase 2: 批量写入
  items.forEach((item, i) => {
    item.style.height = (heights[i] + 10) + 'px';
  });
}

// ✅ 解决方案 2: DocumentFragment
function withDocumentFragment() {
  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const clone = item.cloneNode(true);
    clone.style.height = (item.offsetHeight + 10) + 'px';
    fragment.appendChild(clone);
  });
  container.innerHTML = '';
  container.appendChild(fragment); // 单次 DOM 操作
}
```

#### 问题 3: 不必要的重绘 (Repaint)

```css
/* ❌ 问题：每次 hover 都触发重排+重绘 */
.item:hover {
  width: 200px;
  height: 200px;
  margin: 10px;
}

/* ✅ 解决：只使用 GPU 加速的属性 */
.item {
  transform: scale(1);
  will-change: transform;
  transition: transform 0.3s ease;
}
.item:hover {
  transform: scale(1.1);
}
```

```javascript
// ❌ 问题：频繁操作 DOM 样式
function updatePositionsBad() {
  items.forEach(item => {
    item.style.left = Math.random() * 100 + 'px';
    item.style.top = Math.random() * 100 + 'px';
  });
}

// ✅ 解决：使用 CSS 变量 + transform
function updatePositionsGood() {
  container.style.setProperty('--items', JSON.stringify(
    items.map(() => ({ x: Math.random() * 100, y: Math.random() * 100 }))
  ));
  // 或使用 requestAnimationFrame 批量更新
  requestAnimationFrame(() => {
    items.forEach(item => {
      item.style.transform = `translate(${x}px, ${y}px)`;
    });
  });
}
```

#### 问题 4: 过度绘制 (Overdraw)

```javascript
// 检测过度绘制：Rendering 面板 → 勾选 "Paint Flashing"
// 绿色闪烁 = 重绘区域，频繁闪烁 = 过度绘制

// ❌ 问题：不透明元素叠加
// 背景层 + 内容层 + 遮罩层 = 3 次绘制同一区域

// ✅ 解决：
// 1. 减少层叠上下文 (contain: layout style paint)
// 2. 使用 opacity 替代 display:none (避免重排)
// 3. 移除不必要的 will-change
// 4. 合并相邻元素的背景
```

### 2.5 Performance 高级技巧

#### 2.5.1 黑盒脚本 (Blackbox Scripts)

```
用途：跳过第三方库（React/Vue/jQuery），聚焦业务代码

操作方式：
1. Sources 面板 → 右键第三方脚本 → "Blackbox script"
2. 或 Performance 面板 → 右键火焰图块 → "Blackbox script"
3. 快捷键 Ctrl+Shift+: 

效果：
- Step Into 时跳过黑盒化脚本
- 火焰图中灰显，不干扰分析
- 调用栈中隐藏黑盒帧
```

#### 2.5.2 性能标记 (Performance Marks)

```javascript
// 在代码中插入性能标记，Performance 中可见
function loadData() {
  performance.mark('load-data-start');

  fetch('/api/data')
    .then(res => res.json())
    .then(data => {
      render(data);
      performance.mark('load-data-end');
      performance.measure('load-data', 'load-data-start', 'load-data-end');

      // 查看测量结果
      const measures = performance.getEntriesByName('load-data');
      console.log(`加载耗时: ${measures[0].duration}ms`);
    });
}

// 在 Performance 面板中：
// - 黄色竖线 = mark
// - 紫色区域 = measure
// - 可直接查看业务操作的耗时
```

#### 2.5.3 Trace 导出与分享

```javascript
// 导出 trace 文件供团队分析
// Performance 面板 → 导出按钮 → .json 文件

// 通过代码导出
function exportTrace() {
  const traces = performance.getEntriesByType('measure');
  const marks = performance.getEntriesByType('mark');
  return JSON.stringify({ traces, marks }, null, 2);
}

// 使用 Lighthouse CI 自动化性能测试
// lighthouse CI --url=https://example.com --output=json
```

---

## 3. Memory 内存泄漏检测

### 3.1 JavaScript 内存模型

```
┌──────────────────────────────────────────────────┐
│  JavaScript 内存空间                              │
├──────────────────────────────────────────────────┤
│  Stack (栈) — 固定大小，LIFO                      │
│  ├── 基本类型 (number, string, boolean, null, undefined) │
│  ├── 函数调用帧 (Call Frame)                      │
│  └── 指向堆中对象的引用                           │
│                                                  │
│  Heap (堆) — 动态分配，垃圾回收                    │
│  ├── 对象 (Object, Array, Function)              │
│  ├── 闭包 (Closure)                              │
│  ├── DOM 节点引用                                 │
│  └── 事件监听器                                   │
└──────────────────────────────────────────────────┘

GC (垃圾回收) 机制：
1. 标记-清除 (Mark-and-Sweep) — 主流算法
   - 从根对象 (Root) 开始遍历
   - 标记所有可达对象
   - 清除未标记对象
2. 分代回收 (Generational GC)
   - Young Generation (新生代) — 短期对象，频繁回收
   - Old Generation (老生代) — 长期对象，较少回收
3. 增量 GC (Incremental GC) — 分片执行，减少停顿
```

### 3.2 Memory 面板三种工具

```
┌──────────────────────────────────────────────────────┐
│  Memory 面板                                         │
├──────────────────────────────────────────────────────┤
│  ○ Heap Snapshot    — 堆快照，查看对象分布            │
│  ○ Allocation Sampling — 采样分配，按函数统计         │
│  ○ Allocation Instrumentation — 精确分配，完整追踪    │
│  ○ Instrumentation Timings — 时序分析               │
└──────────────────────────────────────────────────────┘
```

#### 3.2.1 Heap Snapshot (堆快照)

```
使用场景：
- 查找 detached DOM 节点
- 查找闭包持有
- 查找意外全局变量
- 对比两次快照的差异

操作流程：
1. 打开 Memory 面板
2. 选择 "Heap Snapshot"
3. 点击 "Take snapshot" (快照 1 — 初始状态)
4. 执行目标操作 (如：打开/关闭弹窗)
5. 再次点击 "Take snapshot" (快照 2 — 操作后)
6. 选择 "Comparison" 视图，对比差异

关键列：
┌──────────┬────────┬──────────┬──────────┬──────────┐
│ Constructor │ Objects (+/-) │ Shallow Size (+/-) │ Retained Size (+/-) │
├──────────┼────────┼──────────┼──────────┼──────────┤
│ Array     │ +150   │ +6KB     │ +45KB    │
│ div       │ +50    │ +2KB     │ +120KB   │ ← detached DOM!
│ Closure   │ +30    │ +1.2KB   │ +8KB     │
└──────────┴────────┴──────────┴──────────┴──────────┘

Shallow Size: 对象自身占用的内存
Retained Size: 对象被 GC 后能释放的总内存 (包括它引用的对象)
```

#### 3.2.2 Allocation Sampling (分配采样)

```
使用场景：
- 找出分配内存最多的函数
- 定位热点分配路径
- 低开销（采样模式，不影响性能）

操作流程：
1. 选择 "Allocation Sampling"
2. 点击 Record
3. 执行目标操作
4. 停止录制
5. 查看 "Heavy (Bottom Up)" 视图

视图模式：
- Summary: 按构造函数分类汇总
- Containment: 按对象引用关系查看
- Heavy (Bottom Up): 按调用栈自底向上查看 (最常用)
- Tree (Top Down): 按调用栈自顶向下查看
```

#### 3.2.3 Allocation Instrumentation (精确分配追踪)

```
使用场景：
- 追踪每个对象的精确分配位置
- 高开销（记录所有分配），适合小范围分析

注意：
- 会显著降低页面性能
- 只追踪记录期间的分配
- 适合精确定位问题代码行
```

### 3.3 常见内存泄漏模式

#### 泄漏 1: Detached DOM 节点

```javascript
// ❌ 问题：DOM 元素从文档移除，但 JS 引用仍持有
let cachedElement;

function createList() {
  const container = document.createElement('div');
  for (let i = 0; i < 1000; i++) {
    const item = document.createElement('div');
    item.textContent = `Item ${i}`;
    container.appendChild(item);
  }
  cachedElement = container; // 持有引用
  document.body.appendChild(container);
}

function removeList() {
  // 从 DOM 移除，但 cachedElement 仍持有引用
  if (cachedElement && cachedElement.parentNode) {
    cachedElement.parentNode.removeChild(cachedElement);
  }
  // ❌ 没有清除 cachedElement 引用！
}

// ✅ 修复：清除 JS 引用
function removeListFixed() {
  if (cachedElement && cachedElement.parentNode) {
    cachedElement.parentNode.removeChild(cachedElement);
  }
  cachedElement = null; // ✅ 释放引用
}
```

**检测方式：**
```
1. Heap Snapshot → 过滤 "div" 或 "HTMLDivElement"
2. 查看 "Detached" 前缀的节点
3. 展开 "Retainers" 查看谁在持有它
4. 找到持有引用的变量/闭包
```

#### 泄漏 2: 未移除的事件监听器

```javascript
// ❌ 问题：组件销毁后监听器仍然存在
class EventLeakDemo {
  constructor() {
    this.data = new Array(10000).fill('x'.repeat(1000));
    this.element = document.createElement('div');
    this.bindEvents();
  }

  bindEvents() {
    // 监听器持有 this 引用 → this.data 无法被 GC
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('click', this.handleClick);
    setInterval(() => this.tick(), 1000); // setInterval 也持有引用
  }

  handleResize = () => { /* 使用 this.data */ };
  handleClick = () => { /* 使用 this.data */ };
  tick = () => { /* 使用 this.data */ };

  destroy() {
    // ❌ 没有移除监听器！
    this.element.remove();
  }
}

// ✅ 修复：清理所有监听器
class EventLeakFixed {
  constructor() {
    this.data = new Array(10000).fill('x'.repeat(1000));
    this.element = document.createElement('div');
    this._listeners = []; // 追踪所有监听器
    this.bindEvents();
  }

  bindEvents() {
    this._addEventListener(window, 'resize', this.handleResize);
    this._addEventListener(document, 'click', this.handleClick);
  }

  _addEventListener(target, event, handler) {
    target.addEventListener(event, handler);
    this._listeners.push({ target, event, handler });
  }

  destroy() {
    // ✅ 移除所有监听器
    this._listeners.forEach(({ target, event, handler }) => {
      target.removeEventListener(event, handler);
    });
    this._listeners = [];
    this.element.remove();
    this.data = null; // 释放大数据
  }
}
```

#### 泄漏 3: 闭包持有

```javascript
// ❌ 问题：闭包意外持有大对象
function createProcessor() {
  const largeData = new Array(100000).fill('data');

  return {
    // process 只需要 largeData[0]，但闭包持有整个 largeData
    process: function() {
      return largeData[0].toUpperCase();
    },
    // getSummary 也不需要整个 largeData
    getSummary: function() {
      return { count: largeData.length };
    }
  };
}

const processor = createProcessor();
// largeData 永远不会被 GC，即使只需要一个元素

// ✅ 修复：缩小闭包范围
function createProcessorFixed() {
  const largeData = new Array(100000).fill('data');
  const firstItem = largeData[0]; // 只提取需要的
  const count = largeData.length;

  // largeData 在这里可以被 GC（没有其他引用）
  return {
    process: function() {
      return firstItem.toUpperCase();
    },
    getSummary: function() {
      return { count };
    }
  };
}
```

#### 泄漏 4: 定时器泄漏

```javascript
// ❌ 问题：定时器持续引用对象
function setupTimer() {
  const element = document.getElementById('counter');
  let count = 0;

  setInterval(() => {
    count++;
    element.textContent = count;
    // element 和 count 永远不会被 GC
  }, 1000);
}

// ✅ 修复：保存 timer ID，适时清除
function setupTimerFixed() {
  const element = document.getElementById('counter');
  let count = 0;
  const timerId = setInterval(() => {
    count++;
    element.textContent = count;
  }, 1000);

  // 返回清理函数
  return () => clearInterval(timerId);
}

// 使用
const cleanup = setupTimerFixed();
// 组件卸载时
// cleanup();
```

#### 泄漏 5: Map/Set 缓存无限增长

```javascript
// ❌ 问题：缓存无限增长
const cache = new Map();

function fetchData(id) {
  if (cache.has(id)) {
    return cache.get(id);
  }
  const data = expensiveComputation(id);
  cache.set(id, data); // 永远不清理！
  return data;
}

// ✅ 修复 1: LRU 缓存
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map(); // Map 保持插入顺序
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    // 移到末尾（最近使用）
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最老的（Map 迭代顺序 = 插入顺序）
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

// ✅ 修复 2: WeakMap (自动 GC)
const weakCache = new WeakMap();

function fetchDataWeak(element) {
  if (weakCache.has(element)) {
    return weakCache.get(element);
  }
  const data = expensiveComputation(element);
  weakCache.set(element, data);
  // 当 element 被 GC 时，对应的缓存自动清除
  return data;
}
```

#### 泄漏 6: 全局变量泄漏

```javascript
// ❌ 问题：意外创建全局变量
function processData() {
  result = []; // ❌ 没有 var/let/const → 全局变量！
  for (let i = 0; i < 1000; i++) {
    result.push(i * 2);
  }
  return result;
}

// 检查全局泄漏
console.log(Object.keys(window).filter(k => isNaN(k)));

// ✅ 修复：使用严格模式
'use strict';
function processDataFixed() {
  const result = []; // ✅ 块级作用域
  for (let i = 0; i < 1000; i++) {
    result.push(i * 2);
  }
  return result;
}
```

### 3.4 内存泄漏检测完整流程

```
系统化检测流程：

Phase 1: 确认泄漏存在
├─ Memory 面板 → Allocation Instrumentation
├─ 录制 5 分钟正常使用
├─ 观察 "Allocated Memory" 曲线
└─ 如果曲线持续上升不回落 → 存在泄漏

Phase 2: 定位泄漏类型
├─ Heap Snapshot × 3 (操作前/操作中/操作后)
├─ 对比快照差异
├─ 过滤 "Detached" 查找 DOM 泄漏
├─ 过滤 "Closure" 查找闭包泄漏
└─ 查看 "Retainers" 找到持有者

Phase 3: 精确定位代码
├─ Allocation Sampling 找到热点函数
├─ 查看调用栈定位源码行
├─ 使用 Performance 确认 GC 行为
└─ 修复后重复 Phase 1 验证

Phase 4: 自动化监控
├─ PerformanceObserver 监控内存
├─ 设置内存阈值告警
└─ 定期生成内存报告
```

```javascript
// 内存监控工具
class MemoryMonitor {
  constructor(options = {}) {
    this.threshold = options.threshold || 50 * 1024 * 1024; // 50MB
    this.interval = options.interval || 5000; // 5s
    this.history = [];
    this.timer = null;
  }

  start() {
    this.timer = setInterval(() => {
      if (performance.memory) {
        const used = performance.memory.usedJSHeapSize;
        this.history.push({ time: Date.now(), used });

        // 保留最近 100 条记录
        if (this.history.length > 100) {
          this.history.shift();
        }

        // 检测异常增长
        if (used > this.threshold) {
          console.warn(`⚠️ 内存使用超过阈值: ${(used / 1024 / 1024).toFixed(1)}MB`);
          this.onAlert?.(used);
        }

        // 检测持续增长趋势
        this.detectTrend();
      }
    }, this.interval);
  }

  stop() {
    clearInterval(this.timer);
  }

  detectTrend() {
    if (this.history.length < 10) return;
    const recent = this.history.slice(-10);
    const increasing = recent.every((h, i) =>
      i === 0 || h.used >= recent[i - 1].used
    );
    if (increasing) {
      console.warn('⚠️ 检测到内存持续增长趋势，可能存在泄漏');
    }
  }

  getReport() {
    if (this.history.length === 0) return null;
    const uses = this.history.map(h => h.used);
    return {
      current: uses[uses.length - 1],
      min: Math.min(...uses),
      max: Math.max(...uses),
      avg: uses.reduce((a, b) => a + b, 0) / uses.length,
      samples: uses.length
    };
  }
}

// 使用
const monitor = new MemoryMonitor({ threshold: 100 * 1024 * 1024 });
monitor.onAlert = (used) => {
  // 发送告警到监控系统
  console.log('内存告警，触发 Heap Snapshot...');
};
monitor.start();
```

---

## 4. Sources 断点调试

### 4.1 断点类型全解

```
┌─────────────────────────────────────────────────────┐
│  Sources 面板 — 断点类型                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Line Breakpoint (行断点)                         │
│     └─ 点击行号左侧，蓝色图标                        │
│     └─ 快捷键: Ctrl+\                                │
│                                                     │
│  2. Conditional Breakpoint (条件断点)                │
│     └─ 右键行号 → "Add conditional breakpoint"      │
│     └─ 输入条件表达式，满足时才暂停                   │
│                                                     │
│  3. DOM Breakpoint (DOM 断点)                       │
│     └─ Elements 面板 → 右键元素                     │
│     └─ "Break on" → subtree modifications /        │
│        attributes modifications / node removal       │
│                                                     │
│  4. XHR/Fetch Breakpoint (XHR 断点)                 │
│     └─ Sources → XHR Breakpoints 面板              │
│     └─ 添加 URL 关键字匹配                          │
│     └─ 匹配到 XHR/Fetch 请求时暂停                  │
│                                                     │
│  5. Event Listener Breakpoint (事件断点)             │
│     └─ Sources → Event Listener Breakpoints        │
│     └─ 勾选事件类型 (Click/Load/Error/...)          │
│     └─ 事件触发时暂停                               │
│                                                     │
│  6. Exception Breakpoint (异常断点)                  │
│     └─ 点击 "Pause on exceptions" 按钮             │
│     └─ 可选: 暂停未捕获异常 / 所有异常              │
│                                                     │
│  7. Function Breakpoint (函数断点)                   │
│     └─ Console 中输入: debug(functionName)          │
│     └─ 函数被调用时自动暂停                         │
│                                                     │
│  8. Logpoint (日志断点)                             │
│     └─ 右键行号 → "Add logpoint"                   │
│     └─ 输入日志表达式，不暂停只输出                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.2 条件断点实战

```javascript
// 示例：在循环中找到特定迭代
for (let i = 0; i < 10000; i++) {
  processItem(items[i]); // ← 普通断点会停 10000 次！
}

// ✅ 条件断点：只在 i === 5000 时暂停
// 右键行号 → Add conditional breakpoint → 输入: i === 5000

// 更多条件断点示例：
// i > 100 && i < 200        — 范围
// item.status === 'error'   — 状态匹配
// typeof data === 'undefined' — 类型检查
// count % 100 === 0         — 每 100 次
```

### 4.3 DOM 断点实战

```html
<!-- 场景：某个元素的样式被意外修改，找不到源头 -->
<div id="header" class="header fixed">
  <nav>...</nav>
</div>
```

```
调试步骤：
1. Elements 面板 → 找到 #header 元素
2. 右键 → Break on → "Attributes modifications"
3. 触发操作（如滚动页面）
4. DevTools 自动暂停在修改样式的代码行
5. 查看调用栈找到源头
```

```javascript
// DOM 断点能捕获的代码：
document.getElementById('header').classList.add('scrolled');
document.getElementById('header').style.position = 'absolute';
headerElement.setAttribute('class', 'header scrolled');
```

### 4.4 XHR/Fetch 断点实战

```
场景：API 返回了错误数据，想查看请求发出时的上下文

配置：
1. Sources → XHR Breakpoints
2. 点击 "+" 添加匹配规则
3. 输入 URL 关键字（部分匹配即可）

示例规则：
- "/api/users"     — 匹配所有用户相关请求
- "search"         — 匹配所有搜索请求
- "graphql"        — 匹配所有 GraphQL 请求

效果：
- 请求发出时立即暂停
- 可以查看调用栈、变量状态
- 可以修改请求参数再继续
```

### 4.5 事件断点实战

```
场景：点击按钮没有反应，想知道事件是否被触发

配置：
1. Sources → Event Listener Breakpoints
2. 展开 "Mouse" → 勾选 "click"
3. 展开 "Control" → 勾选 "submit"
4. 展开 "Timer" → 勾选 "setInterval" / "setTimeout"

常用事件分组：
- Mouse: click, dblclick, mousedown, mouseup, mousemove
- Keyboard: keydown, keyup, keypress
- Control: load, unload, submit, change
- Timer: setInterval, setTimeout
- Animation: requestAnimationFrame
- Clipboard: copy, cut, paste
```

### 4.6 debug() 和 monitor() 函数

```javascript
// debug(functionName) — 函数被调用时自动暂停
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

debug(calculateTotal);
// 下次调用 calculateTotal() 时自动暂停

// monitor(functionName) — 函数被调用时输出日志（不暂停）
function validateForm(formData) {
  // 验证逻辑
}

monitor(validateForm);
// 每次调用输出: ✓ monitor function called validateForm
// 或: ✗ monitor function called validateForm (如果返回 falsy)

// monitorEvents(element, eventType) — 监控元素事件
const button = document.querySelector('#submit');
monitorEvents(button, 'click');
// 每次点击输出: Event { type: 'click', ... }

monitorEvents(window, ['resize', 'scroll']);
// 监控多个事件
```

### 4.7 黑盒脚本 (Blackbox Scripts)

```
用途：调试时跳过第三方库代码，只关注业务代码

操作：
1. Sources 面板打开业务代码文件
2. Ctrl+Shift+P → "Blackbox selected script"
3. 或右键脚本标签 → "Blackbox script"

效果：
- Step Into (F11) 时跳过黑盒脚本
- 调用栈中灰显黑盒帧
- 断点在黑盒脚本中自动禁用

推荐黑盒化的脚本：
- React/Vue/Angular 框架代码
- Lodash/Underscore 工具库
- Polyfill 代码
- Source map 中的 vendor 代码
```

### 4.8 调试实战场景

#### 场景 1: 异步代码调试

```javascript
// ❌ 问题：async/await 代码难以追踪
async function loadUserData(userId) {
  const user = await fetchUser(userId);
  const posts = await fetchPosts(user.id);
  const comments = await fetchComments(user.id);
  return { user, posts, comments };
}

// ✅ 调试技巧：
// 1. 在每一行 await 前设置断点
// 2. 使用 Call Stack 查看异步调用链
// 3. 使用 Scope 面板查看每个 await 前后的变量变化

// ✅ 调试技巧：Promise 链调试
fetchUser(userId)
  .then(user => {
    debugger; // ← 在这里暂停，检查 user
    return fetchPosts(user.id);
  })
  .then(posts => {
    debugger; // ← 检查 posts
    return fetchComments(posts[0].id);
  });
```

#### 场景 2: 事件冒泡调试

```javascript
// 场景：点击子元素，父元素的事件也被触发
document.querySelector('.parent').addEventListener('click', () => {
  console.log('Parent clicked');
});

document.querySelector('.child').addEventListener('click', () => {
  console.log('Child clicked');
});

// 调试步骤：
// 1. Sources → Event Listener Breakpoints → 勾选 "click"
// 2. 点击 .child 元素
// 3. DevTools 暂停在 .child 的监听器
// 4. 查看 Call Stack → 确认事件目标
// 5. 继续 (F8) → 暂停在 .parent 的监听器
// 6. 确认事件冒泡路径

// ✅ 修复：阻止冒泡
document.querySelector('.child').addEventListener('click', (e) => {
  e.stopPropagation(); // 阻止冒泡到父元素
  console.log('Child clicked');
});
```

#### 场景 3: 性能热点调试

```javascript
// 场景：页面卡顿，找到热点函数
// 1. Performance 面板录制
// 2. 找到耗时最长的函数（火焰图中最宽的块）
// 3. 双击火焰图块 → 自动跳转到 Sources 对应行
// 4. 在该行设置条件断点
// 5. 重新操作，观察变量状态

// 示例：找到热点函数后
function renderList(items) {
  // ← Performance 显示这里耗时 200ms
  items.forEach(item => {
    const el = document.createElement('div');
    el.innerHTML = item.html; // ← 可能是这里慢
    container.appendChild(el);
  });
}

// 在 el.innerHTML = item.html 设置条件断点:
// item.html.length > 10000
// 只在大段 HTML 时暂停
```

### 4.9 调试进阶技巧

#### 4.9.1 编辑并继续 (Edit and Continue)

```
功能：调试过程中直接修改代码，无需刷新页面

操作：
1. 在断点暂停时
2. 直接编辑源代码
3. 继续执行 (F8)
4. 修改立即生效

限制：
- 只能修改函数体，不能改变函数签名
- 不能添加/删除变量声明
- 某些结构变更需要刷新
```

#### 4.9.2 重新执行调用 (Re-execute Call)

```
功能：重新执行当前暂停的函数调用

操作：
1. 在断点暂停时
2. 右键调用栈帧 → "Re-run this call"
3. 函数从头开始执行

用途：
- 修复参数后重新测试
- 跳过前面的步骤直接到关键逻辑
```

#### 4.9.3 日志断点 (Logpoint)

```javascript
// 场景：需要观察变量变化，但不想暂停打断流程
function processOrder(order) {
  validate(order);
  calculateTotal(order); // ← 添加 Logpoint: "total=" + order.total
  applyDiscount(order);  // ← 添加 Logpoint: "discount=" + order.discount
  saveOrder(order);      // ← 添加 Logpoint: JSON.stringify(order)
}

// Logpoint 优势：
// - 不中断执行流
// - 可以输出表达式结果
// - 比 console.log 更灵活（不需要修改代码）
// - 可以随时启用/禁用
```

#### 4.9.4 工作区 (Workspace) 映射

```
功能：将 DevTools 中的文件映射到本地文件系统

操作：
1. Sources 面板 → Filesystem 标签
2. "Add folder to workspace"
3. 选择项目目录
4. DevTools 中的修改自动保存到本地文件

优势：
- 调试时修改直接保存到源码
- 配合 Live Reload 实现热更新
- 不需要手动复制粘贴修改
```

---

## 5. Network 网络分析进阶

### 5.1 Network 面板核心功能

```
┌──────────────────────────────────────────────────────┐
│  Network 面板                                         │
├──────────────────────────────────────────────────────┤
│  [Presets] [Filter] [Disable cache] [Preserve log]   │
├──────────────────────────────────────────────────────┤
│  Name │ Method │ Status │ Type │ Received │ Time     │
│  ├─ app.js    GET   200    script  45KB    120ms    │
│  ├─ style.css GET   200    stylesheet 12KB  45ms    │
│  ├─ api/data  POST  200    fetch    8KB     340ms   │
│  └─ image.png GET   304    image    0B      12ms    │
├──────────────────────────────────────────────────────┤
│  Waterfall (瀑布图) — 可视化请求时序                   │
│  Timing — 详细时间分解 (DNS/TCP/SSL/TTFB/Content)   │
└──────────────────────────────────────────────────────┘
```

### 5.2 请求时间分解

```
请求总耗时 = DNS + TCP + SSL + TTFB + Content Download

┌─────────────────────────────────────────────────────┐
│  Timing 分解                                         │
├─────────────────────────────────────────────────────┤
│  [████████] DNS Lookup     — 域名解析                │
│       [████] TCP Connect     — TCP 连接建立          │
│          [███] SSL/TLS       — 安全握手              │
│              [████████████]  TTFB    — 首字节时间    │
│                          [██████] Content Download  │
└─────────────────────────────────────────────────────┘

优化方向：
- DNS 长 → DNS 预取 (<link rel="dns-prefetch">)
- TCP 长 → 连接复用 (Keep-Alive/HTTP2)
- SSL 长 → SSL 会话复用/OCSP Stapling
- TTFB 长 → 服务端优化/CDN/缓存
- Download 长 → 压缩/优化资源大小
```

### 5.3 Throttling (网络限速)

```
用途：模拟不同网络环境

预设：
- Fast 3G — 1.6 Mbps down / 750 Kbps up, 150ms RTT
- Slow 3G — 400 Kbps down / 400 Kbps up, 800ms RTT
- Fast 4G — 9 Mbps down / 9 Mbps up, 170ms RTT
- Slow 4G — 1.6 Mbps down / 750 Kbps up, 300ms RTT
- Offline — 完全离线

自定义限速：
- Download/Upload 带宽
- RTT (Round Trip Time)
- 请求队列长度
```

### 5.4 HAR 文件分析

```javascript
// 导出 HAR 文件进行离线分析
// Network 面板 → 右键 → "Save all as HAR with content"

// HAR 文件包含：
// - 所有请求的完整信息
// - 请求/响应头
// - 请求/响应体
// - 时间线数据
// - 安全信息

// 使用在线工具分析 HAR:
// - https://www.softwareishard.com/har/viewer/
// - https://perfsonar-toolkit.github.io/
// - https://chromium.github.io/harviewer/
```

---

## 6. 综合实战：性能优化全流程

### 6.1 实战场景：电商商品列表页优化

```
目标：将 LCP 从 4.2s 优化到 2.0s 以内

Phase 1: 性能分析 (Performance 面板)
├─ 录制页面加载过程
├─ 发现 LCP 元素是商品图片
├─ Main Thread 在 0-3s 被 JS 完全阻塞
├─ 火焰图显示 React 渲染占用 2.1s
└─ 网络瀑布图显示图片在 2.5s 才开始加载

Phase 2: 内存分析 (Memory 面板)
├─ Heap Snapshot 发现 500 个 Detached div
├─ 对比快照确认是商品卡片组件泄漏
├─ Allocation Sampling 定位到 Card 组件
└─ 找到未清理的事件监听器

Phase 3: 断点调试 (Sources 面板)
├─ XHR 断点捕获 API 请求
├─ 发现重复请求同一接口 3 次
├─ 条件断点定位到 useEffect 依赖问题
└─ 事件断点发现不必要的 scroll 监听

Phase 4: 优化实施
├─ 图片懒加载 + priority="high" for LCP image
├─ React.memo + useMemo 减少不必要的渲染
├─ 移除 Detached DOM 的 JS 引用
├─ 请求去重 + 防抖搜索
├─ scroll 监听改为 rAF + passive
└─ 代码分割 (React.lazy)

Phase 5: 验证 (Performance 面板)
├─ 重新录制，对比优化前后
├─ LCP: 4.2s → 1.8s ✅
├─ FID: 320ms → 45ms ✅
├─ CLS: 0.25 → 0.03 ✅
├─ 内存稳定，无泄漏 ✅
└─ 生成优化报告
```

### 6.2 优化代码示例

```javascript
// ❌ 优化前
function ProductList({ products }) {
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState(products);

  // 每次渲染都重新过滤 — O(n) 操作
  useEffect(() => {
    const result = products.filter(p =>
      p.name.includes(search)
    );
    setFiltered(result);
  }, [search, products]);

  // 没有懒加载，所有图片同时加载
  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {filtered.map(product => (
        <div key={product.id} className="card">
          <img src={product.image} alt={product.name} />
          <h3>{product.name}</h3>
          <p>{product.description}</p>
        </div>
      ))}
    </div>
  );
}

// ✅ 优化后
const ProductCard = React.memo(function ProductCard({ product, index }) {
  const isLCP = index < 3; // 前 3 个商品是 LCP 候选

  return (
    <div className="card" style={{ contain: 'layout style paint' }}>
      <img
        src={product.image}
        alt={product.name}
        loading={isLCP ? 'eager' : 'lazy'}
        fetchpriority={isLCP ? 'high' : 'low'}
        width="300"
        height="300"
      />
      <h3>{product.name}</h3>
      <p>{product.description}</p>
    </div>
  );
});

function ProductList({ products }) {
  const [search, setSearch] = useState('');

  // useMemo 缓存过滤结果
  const filtered = useMemo(() => {
    if (!search) return products;
    const lowerSearch = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(lowerSearch)
    );
  }, [search, products]);

  // 防抖搜索
  const debouncedSetSearch = useDebounce(setSearch, 300);

  return (
    <div>
      <input
        value={search}
        onChange={e => debouncedSetSearch(e.target.value)}
      />
      {filtered.map((product, index) => (
        <ProductCard key={product.id} product={product} index={index} />
      ))}
    </div>
  );
}

// 防抖 Hook
function useDebounce(fn, delay) {
  const timerRef = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}
```

---

## 7. 调试技巧速查表

### 7.1 问题 → 工具映射

| 问题 | 推荐工具 | 关键操作 |
|------|----------|----------|
| 页面加载慢 | Performance | 录制 → 分析火焰图 → 找长任务 |
| 滚动卡顿 | Performance + Rendering | FPS 图表 → 布局闪烁 → 合成层 |
| 内存持续增长 | Memory (Heap Snapshot) | 3 次快照对比 → 找 Detached 节点 |
| 找不到事件源头 | Sources (事件断点) | 勾选事件类型 → 触发操作 → 查看调用栈 |
| API 数据错误 | Network + Sources (XHR 断点) | 设置 XHR 断点 → 查看请求上下文 |
| 样式被意外修改 | Sources (DOM 断点) | 右键元素 → Break on attributes |
| 循环中特定值 | Sources (条件断点) | 右键行号 → 输入条件 |
| 第三方库干扰 | Sources (黑盒脚本) | Ctrl+Shift+: → 黑盒化 |
| 异步流程难追踪 | Sources (断点) + Console | await 处设断点 → 查看调用栈 |
| 过度绘制 | Rendering (Paint Flashing) | 勾选 → 查看闪烁区域 |

### 7.2 Console 高级命令

```javascript
// 元素引用
$0          // 当前选中的 Elements 面板元素
$1          // 上一次选中的元素
$$('div')   // 返回所有匹配元素的数组 (querySelectorAll)
$x('//div') // XPath 选择器

// 对象分析
dir(object)     // 以树形结构显示对象属性 (类似 console.dir)
table(array)    // 以表格形式显示数组/对象
keys(object)    // 返回对象的所有键
values(object)  // 返回对象的所有值

// 性能测量
console.time('label')    // 开始计时
console.timeEnd('label') // 结束计时并输出
// 输出: label: 123.456ms

// 计数
console.count('label')   // 输出该标签被调用的次数
console.countReset('label') // 重置计数

// 分组
console.group('Group Name')
console.log('Inside group')
console.groupEnd()

// 断言
console.assert(condition, 'message')
// 条件为 false 时输出错误

// 样式化输出
console.log('%cStyled text', 'color: red; font-size: 20px; font-weight: bold')

// 追踪调用栈
console.trace() // 输出当前调用栈

// inspect 函数
inspect($0)  // 在 Elements 面板中选中指定元素
```

### 7.3 Performance API 速查

```javascript
// 性能标记
performance.mark('start-load');
performance.mark('end-load');
performance.measure('load-time', 'start-load', 'end-load');

// 获取性能条目
performance.getEntriesByType('measure'); // 所有 measure
performance.getEntriesByType('mark');    // 所有 mark
performance.getEntriesByType('resource'); // 所有资源加载
performance.getEntriesByType('navigation'); // 页面导航

// PerformanceObserver — 自动监控性能指标
// LCP
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  console.log('LCP:', lastEntry.startTime);
});
lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

// FID
const fidObserver = new PerformanceObserver((list) => {
  list.getEntries().forEach(entry => {
    console.log('FID:', entry.processingStart - entry.startTime);
  });
});
fidObserver.observe({ type: 'first-input', buffered: true });

// CLS
let clsValue = 0;
const clsObserver = new PerformanceObserver((list) => {
  list.getEntries().forEach(entry => {
    if (!entry.hadRecentInput) {
      clsValue += entry.value;
    }
  });
  console.log('CLS:', clsValue);
});
clsObserver.observe({ type: 'layout-shift', buffered: true });

// INP
const inpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  const interactionDelay = lastEntry.processingStart - lastEntry.startTime;
  console.log('INP:', interactionDelay);
});
inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 0 });
```

---

## 总结

### 三大核心能力矩阵

```
┌─────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ 能力            │ Performance      │ Memory           │ Sources          │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ 核心用途        │ 性能分析         │ 内存泄漏检测     │ 断点调试         │
│ 关键视图        │ 火焰图           │ Heap Snapshot    │ 调用栈           │
│ 诊断目标        │ 长任务/重排/重绘 │ Detached DOM     │ 条件/事件/XHR    │
│ 优化方向        │ 分块/懒加载/CSS  │ 清除引用/清理    │ 修复逻辑错误     │
│ 验证方式        │ 对比录制         │ 快照对比         │ 重新执行         │
│ 快捷键          │ Ctrl+Shift+P     │ Memory 面板      │ F8/F10/F11       │
└─────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

### 学习路径

```
入门 → 基础操作 (打开面板/设置断点/查看网络)
  ↓
进阶 → 火焰图解读/Heap Snapshot 对比/条件断点
  ↓
高级 → 黑盒脚本/性能标记/内存监控/Performance Observer
  ↓
专家 → 自定义 Performance 工具链/自动化性能测试/团队培训
```

### 关键要点

1. **Performance**: 录制 → 分析火焰图 → 定位长任务 → 优化 → 验证
2. **Memory**: 3 次快照对比 → 找 Detached → 看 Retainers → 清除引用
3. **Sources**: 善用条件断点/DOM 断点/XHR 断点 → 精准定位问题
4. **系统化**: 问题 → 工具 → 操作 → 修复 → 验证，形成闭环
5. **自动化**: Performance Observer + 内存监控 + Lighthouse CI

---

*专项训练 16:00 完成 ✅*
*覆盖: Performance 性能分析 / Memory 内存泄漏检测 / Sources 断点调试*
*产出: 完整文档 + 代码示例 + 速查表 + 实战流程*
