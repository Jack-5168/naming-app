# Chrome DevTools 第四轮：Trace 事件分析 / 内存碎片诊断 / 条件断点进阶 / CDP 自动化

> 专项训练 16:00 | 2026-05-02 | 调试技能专项（第四轮）
> 前序：4/26 基础深度 → 4/29 全面覆盖 → 4/30 高级进阶 → 本轮：Trace 事件 + 内存碎片 + 条件断点进阶 + CDP 自动化

---

## 目录

1. [Trace 事件深度分析（Performance 面板进阶）](#1-trace-事件深度分析performance-面板进阶)
2. [内存碎片诊断与优化（Memory 面板进阶）](#2-内存碎片诊断与优化memory-面板进阶)
3. [条件断点进阶与调试策略（Sources 面板进阶）](#3-条件断点进阶与调试策略sources-面板进阶)
4. [CDP 自动化调试（Chrome DevTools Protocol）](#4-cdp-自动化调试chrome-devtools-protocol)
5. [DevTools 实验性功能（Experiments）](#5-devtools-实验性功能experiments)
6. [跨面板联动调试实战](#6-跨面板联动调试实战)
7. [面试高频考点](#7-面试高频考点)
8. [自测题](#8-自测题)

---

## 1. Trace 事件深度分析（Performance 面板进阶）

### 1.1 Trace 事件分类体系

Performance 面板记录的每个事件都属于一个特定的 **Trace Category**，理解分类体系是深度分析的前提。

```
Trace 事件分类（部分）：
├── devtools              — DevTools 自身事件
├── blink                 — Blink 渲染引擎事件
│   ├── v8                — V8 JavaScript 引擎事件
│   ├── loading           — 资源加载事件
│   ├── network           — 网络请求事件
│   └── scheduling        — 任务调度事件
├── cc                    — Compositor 合成器事件
├── gpu                   — GPU 进程事件
├── memory                — 内存管理事件
├── net                   — Chromium 网络栈事件
├── renderer.scheduler    — 渲染器调度器事件
└── disabled-by-default   — 默认禁用的详细追踪
    ├── devtools.timeline — 时间线事件（默认启用）
    ├── v8.cpu_profiler   — V8 CPU 性能分析
    ├── devtools.timeline.frame — 帧事件
    └── latency           — 用户输入延迟追踪
```

### 1.2 Trace 事件详解 — 从火焰图到事件流

#### 1.2.1 事件流视图（Bottom-Up / Call Tree 之外）

在 Performance 面板底部，切换到 **Bottom-Up** 和 **Call Tree** 之外，还有 **Event Log** 视图：

```
Event Log 视图中的关键事件类型：

┌─────────────────────────────────────────────────────────────┐
│ 事件名称                    │ 颜色   │ 含义                  │
├─────────────────────────────┼────────┼───────────────────────┤
│ RunTask                   │ 紫色   │ 任务开始执行          │
│ Function Call             │ 蓝色   │ JS 函数调用           │
│ Evaluate Script           │ 深蓝色 │ 脚本执行              │
│ Compile Script            │ 靛蓝色 │ 脚本编译              │
│ Paint                     │ 绿色   │ 重绘（Paint）         │
│ Layout                    │ 橙色   │ 布局（Layout/Reflow） │
│ Recalculate Style         │ 黄色   │ 样式重计算            │
│ Update Layer Tree         │ 紫色   │ 图层树更新            │
│ DrawPixels                │ 灰色   │ 像素绘制              │
│ Frame                     │ 白色边框 │ 帧边界              │
│ Gesture Tap               │ 粉色   │ 用户手势              │
│ RequestAnimationFrame     │ 青色   │ rAF 回调              │
│ Timer Fired               │ 品红色 │ 定时器触发            │
│ XHR Ready State Change    │ 棕色   │ XHR 状态变化          │
│ Resource Send Request     │ 浅绿   │ 发送资源请求          │
│ Resource Receive Response │ 浅绿   │ 接收资源响应          │
│ Resource Finish           │ 浅绿   │ 资源加载完成          │
│ GC Event                  │ 红色   │ 垃圾回收              │
│ Mark Compact              │ 深红色 │ Mark-Compact 全量 GC  │
│ Incremental Marking       │ 浅红色 │ 增量标记              │
│ Schedule Idle Task        │ 灰色   │ 调度空闲任务          │
│ Run Idle Task             │ 灰色   │ 执行空闲任务          │
└─────────────────────────────────────────────────────────────┘
```

#### 1.2.2 关键 Trace 事件深度解析

**Layout 事件深度分析：**

```javascript
// Layout 触发链：Style Recalc → Layout → Paint → Composite
// 每个阶段都有对应的 Trace 事件

// 1. Recalculate Style — 样式重计算
// 触发条件：
// - DOM 结构变化（添加/删除/移动节点）
// - 样式表变化（添加/删除/修改 CSS 规则）
// - 伪类状态变化（:hover, :focus, :active）
// - class 属性变化
// - 动画关键帧更新

// 2. Layout — 布局计算
// 触发条件：
// - 几何属性变化（width, height, top, left, margin, padding）
// - 字体大小变化
// - 窗口 resize
// - 滚动（某些情况下）
// - 读取布局属性（offsetTop, getBoundingClientRect, scrollHeight）— 强制同步布局

// 3. Paint — 绘制
// 触发条件：
// - 颜色/背景变化
// - 文字内容变化
// - outline/box-shadow 变化
// - 大部分视觉变化都会触发 Paint

// 4. Update Layer Tree / Composite — 图层更新/合成
// 触发条件：
// - transform 变化（translate, rotate, scale）
// - opacity 变化
// - will-change 元素变化
// - 视频/Canvas 内容更新
```

**GC 事件深度分析：**

```javascript
// V8 垃圾回收的 Trace 事件：

// Minor GC (Scavenge) — 新生代回收
// - 频率：高（几毫秒到几十毫秒一次）
// - 耗时：短（通常 < 5ms）
// - 回收区域：Young Generation (From Space → To Space)
// - Trace 事件名：GC Event (Scavenge)

// Major GC (Mark-Sweep) — 旧生代标记清除
// - 频率：低
// - 耗时：中等（10-50ms）
// - 回收区域：Old Generation
// - Trace 事件名：GC Event (MarkSweep)

// Full GC (Mark-Compact) — 全量标记压缩
// - 频率：最低
// - 耗时：最长（50-200ms+，可能导致 Jank）
// - 回收区域：所有代
// - Trace 事件名：Mark Compact
// - 特征：火焰图中出现长条红色块，Main Thread 完全阻塞

// 增量标记 (Incremental Marking) — 分片标记
// - 将 Full GC 的 Mark 阶段拆分成多个小片段
// - 每个片段 < 5ms，插入到任务间隙执行
// - Trace 事件名：Incremental Marking
// - 优势：减少单次 GC 停顿时间

// 并发标记 (Concurrent Marking) — V8 8.0+
// - Mark 阶段在后台线程执行，不阻塞主线程
// - Trace 事件名：Concurrent Marking
// - 优势：进一步减少 GC 对主线程的影响
```

#### 1.2.3 Trace 事件关联分析 — 从孤立事件到因果链

```javascript
// 典型案例：用户点击按钮后页面卡顿的 Trace 分析

// 事件流（时间顺序）：
// 1. Gesture Tap (用户点击)
//    ↓
// 2. RunTask (任务调度)
//    ↓
// 3. Function Call → handleClick (JS 执行)
//    ↓
// 4. Function Call → updateData (JS 执行)
//    ↓
// 5. Recalculate Style (样式重计算)
//    ↓
// 6. Layout (布局计算) ← 这里耗时 45ms！
//    ↓
// 7. Paint (绘制)
//    ↓
// 8. Composite (合成)
//    ↓
// 9. Frame (帧完成)

// 问题定位：Layout 耗时 45ms > 16.67ms（一帧），导致掉帧
// 根因分析：在 Layout 事件中查看 Call Tree，发现触发了多次强制同步布局

// 强制同步布局的代码模式（反模式）：
function updateData() {
  // 反模式：读写交替导致 Layout Thrashing
  for (let i = 0; i < 100; i++) {
    const height = element.scrollHeight;  // 读 → 强制同步布局
    element.style.height = (height + 10) + 'px';  // 写 → 标记需要重新布局
  }
}

// 正确模式：读写分离
function updateData() {
  // 先读所有值
  const heights = [];
  for (let i = 0; i < 100; i++) {
    heights.push(element.scrollHeight);
  }
  // 再写所有值
  for (let i = 0; i < 100; i++) {
    element.style.height = (heights[i] + 10) + 'px';
  }
}
```

### 1.3 Performance 面板高级技巧

#### 1.3.1 Memory CPU 节流模拟

```javascript
// Performance 面板设置中的高级选项：

// 1. Memory throttling（内存节流）
// - 模拟低内存设备的行为
// - 触发更频繁的 GC
// - 用途：测试应用在低端设备上的表现

// 2. CPU throttling（CPU 节流）
// - 4x, 6x 减速模拟低端设备
// - 用途：发现高性能设备上被掩盖的性能问题

// 3. Screen capture（屏幕捕获）
// - 在性能分析过程中定期截图
// - 用途：视觉化性能问题（白屏、闪烁、布局跳动）

// 4. Screenshot (Ctrl+S)
// - 手动捕获当前帧截图
// - 用途：记录特定时刻的视觉状态
```

#### 1.3.2 自定义 Trace Categories

```javascript
// 通过 Ctrl+Shift+P 打开 Command Menu，输入：
// "show rendering" → 打开 Rendering 面板
// 或者通过 Performance 面板的设置 → Categories

// 可启用的额外 Trace Categories：

// disabled-by-default-v8.cpu_profiler
// - 提供函数级别的 CPU 采样
// - 比 Call Tree 更精确
// - 注意：会显著增加性能开销

// disabled-by-default-devtools.timeline.frame
// - 提供帧级别的详细事件
// - 包括帧开始/结束、FPS、帧耗时

// disabled-by-default-latency
// - 追踪用户输入到页面响应的时间
// - 用于分析 INP (Interaction to Next Paint)

// 启用方式（通过 CDP）：
// Runtime.evaluate({
//   expression: 'console.log("enable categories")',
// })
// 然后在 Performance 面板设置中勾选对应 categories
```

#### 1.3.3 Performance 面板的 JSON 导出与分析

```javascript
// Performance 面板可以导出为 JSON 格式（Save profile）
// 导出的 JSON 结构：

{
  "traceEvents": [
    {
      "name": "Layout",
      "cat": "devtools.timeline",
      "ph": "X",          // X = complete event, B = begin, E = end
      "ts": 1234567890,   // 时间戳（微秒）
      "dur": 45000,       // 持续时间（微秒）
      "pid": 1234,        // 进程 ID
      "tid": 5678,        // 线程 ID
      "args": {           // 事件参数
        "data": {
          "nodesLayouted": 1523,
          "documentURL": "https://example.com",
          "frame": "0x1234567890"
        }
      }
    }
  ]
}

// 分析技巧：
// 1. 使用 trace viewer (chrome://tracing) 打开 JSON 文件
// 2. 使用 Python 脚本分析 traceEvents 数组
// 3. 统计各类事件的总耗时和频率
// 4. 识别性能瓶颈的模式
```

---

## 2. 内存碎片诊断与优化（Memory 面板进阶）

### 2.1 内存碎片（Memory Fragmentation）概念

```
内存碎片 vs 内存泄漏：

┌─────────────────────────────────────────────────────────────┐
│                    内存问题分类                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  内存泄漏 (Memory Leak)                                     │
│  ─── 不再需要的对象仍然被引用，无法被 GC 回收                 │
│  ─── 特征：内存持续增长，不会下降                             │
│  ─── 工具：Heap Snapshot 对比                               │
│                                                             │
│  内存碎片 (Memory Fragmentation)                            │
│  ─── 堆内存中存在大量小块空闲空间，但无法满足大对象分配       │
│  ─── 特征：总空闲内存足够，但分配仍然失败或触发 Full GC       │
│  ─── 工具：Memory Inspector + Allocation Profiling          │
│                                                             │
│  内存膨胀 (Memory Bloat)                                    │
│  ─── 应用持有过多不必要的数据                               │
│  ─── 特征：内存使用量远超实际需要                           │
│  ─── 工具：Heap Snapshot 分析对象分布                       │
│                                                             │
│  内存抖动 (Memory Churn)                                    │
│  ─── 频繁创建和销毁大量临时对象                             │
│  ─── 特征：内存使用量锯齿状波动，GC 频繁触发                │
│  ─── 工具：Allocation Timeline / Allocation Sampling        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 V8 内存管理模型

```
V8 堆内存布局：

┌─────────────────────────────────────────────────────────────┐
│                        V8 Heap                              │
├──────────────┬──────────────────────────────────────────────┤
│ New Space    │ Old Space                                    │
│ (新生代)     │                                              │
│ ┌──────────┐ │ ┌──────────────┬──────────────────────────┐ │
│ │From Space│ │ │ Old Ptr Age  │ Old Data Age             │ │
│ │(2-8MB)   │ │ │ (指针)       │ (数据)                   │ │
│ ├──────────┤ │ │              │                          │ │
│ │To Space  │ │ │ ┌──────────┐ │ ┌──────────────────────┐ │ │
│ │(2-8MB)   │ │ │ │Lo Space  │ │ │Code Space            │ │ │
│ │(2-8MB)   │ │ │ │大对象区  │ │ │ (代码对象)           │ │ │
│ └──────────┘ │ │ └──────────┘ │ ├──────────────────────┤ │ │
│              │ │              │ │Map Space               │ │ │
│ Scavenge GC  │ │Mark-Sweep    │ │ (对象地图)             │ │ │
│ 新生代回收   │ │Mark-Compact  │ └──────────────────────┘ │ │
│              │ │旧生代回收    │                          │ │
└──────────────┴──────────────┴──────────────────────────┴──┘

// 对象晋升规则：
// 1. 新对象分配在 New Space (From Space)
// 2. Scavenge GC 后存活的对象复制到 To Space
// 3. 经过多次 Scavenge GC 仍然存活的对象晋升到 Old Space
// 4. 大对象（> New Space 一半）直接分配到 Old Space
// 5. Old Space 中的对象使用 Mark-Sweep 或 Mark-Compact 回收
```

### 2.3 内存碎片诊断方法

#### 2.3.1 Heap Snapshot 对比分析（检测泄漏）

```javascript
// 标准泄漏检测流程：

// Step 1: 拍摄初始快照（Snapshot 1）
// - 在应用初始状态拍摄
// - 记录当前对象数量和总大小

// Step 2: 执行操作（模拟用户行为）
// - 打开/关闭对话框 10 次
// - 加载/卸载页面 10 次
// - 执行特定业务流程

// Step 3: 拍摄操作后快照（Snapshot 2）
// - 在操作完成后拍摄
// - 与 Snapshot 1 对比

// Step 4: 分析 Delta
// - 查看 "Objects allocated between Snapshot 1 and 2"
// - 筛选出数量显著增加的对象类型
// - 追踪保留路径（Retainers）找到泄漏源

// 常见泄漏模式：

// 模式 1：闭包泄漏
function createHandler() {
  const largeData = new Array(1000000).fill('x');  // 大数组
  return function() {
    // 闭包引用了 largeData，即使不需要
    console.log('clicked');
  };
}
const handler = createHandler();
element.addEventListener('click', handler);
// 忘记 removeEventListener → largeData 永远不会被回收

// 模式 2：全局变量泄漏
window.cache = {};
function addToCache(key, value) {
  window.cache[key] = value;  // 无限增长
}
// 解决方案：使用 WeakMap 或 LRU Cache

// 模式 3：DOM 引用泄漏
const detachedElements = [];
function createElements() {
  for (let i = 0; i < 100; i++) {
    const div = document.createElement('div');
    div.textContent = 'test';
    detachedElements.push(div);  // 从 DOM 移除但仍然被引用
  }
}
// 解决方案：使用完毕后清空引用

// 模式 4：Timer 泄漏
function setupTimer() {
  const data = new Array(1000000);
  setInterval(() => {
    console.log(data.length);  // data 永远不会被回收
  }, 1000);
}
// 解决方案：clearInterval + 清理引用

// 模式 5：Event Listener 泄漏
class Component {
  constructor() {
    this.data = new Array(1000000);
    window.addEventListener('resize', this.onResize);
  }
  onResize() { /* ... */ }
  destroy() {
    // 忘记 removeEventListener → this 永远不会被回收
  }
}

// 模式 6：Map/Set 中的强引用
const cache = new Map();
function process(key, obj) {
  cache.set(key, obj);  // 强引用，永远不会被 GC
}
// 解决方案：使用 WeakMap（key 必须是对象）
```

#### 2.3.2 Allocation Timeline（检测内存抖动）

```javascript
// Allocation Timeline 使用流程：

// 1. Memory 面板 → Allocation Timeline
// 2. 点击 Record 开始录制
// 3. 执行操作
// 4. 停止录制

// 分析要点：

// 1. 内存分配速率
// - 陡峭的上升线 = 大量分配
// - 锯齿状波动 = 频繁 GC
// - 平稳 = 内存使用稳定

// 2. 分配热点
// - 切换到 "Allocation Profiling" 标签
// - 查看哪些函数分配了最多内存
// - 按分配量排序，找到热点函数

// 3. 内存抖动检测
// - 如果内存曲线呈现锯齿状（快速上升后骤降）
// - 说明存在频繁的创建和销毁
// - 解决方案：对象池、缓存、减少临时对象

// 内存抖动优化示例：

// 反模式：频繁创建临时对象
function renderList(items) {
  const html = items.map(item => {
    const config = { id: item.id, text: item.text };  // 每次迭代创建新对象
    return `<div data-id="${config.id}">${config.text}</div>`;
  }).join('');
  container.innerHTML = html;
}

// 优化：复用对象
const configPool = [];
function renderList(items) {
  const html = items.map(item => {
    let config = configPool.pop() || {};
    config.id = item.id;
    config.text = item.text;
    const result = `<div data-id="${config.id}">${config.text}</div>`;
    configPool.push(config);  // 回收
    return result;
  }).join('');
  container.innerHTML = html;
}
```

#### 2.3.3 Allocation Sampling（采样分析）

```javascript
// Allocation Sampling 与 Allocation Timeline 的区别：

// Allocation Timeline：
// - 记录所有分配事件
// - 精度高，但开销大
// - 适合短时间精确分析

// Allocation Sampling：
// - 定期采样（默认每 10ms）
// - 开销小，适合长时间分析
// - 适合发现长期内存问题

// 使用场景：
// 1. 长时间运行的应用（SPA、后台任务）
// 2. 需要分析内存增长趋势
// 3. 对比不同操作模式的内存影响

// 分析步骤：
// 1. Memory 面板 → Allocation Sampling
// 2. 开始录制，执行操作 30 秒以上
// 3. 停止录制
// 4. 查看 "Summary" 视图：按构造函数分组
// 5. 查看 "Heavy (Bottom-Up)" 视图：找到分配热点函数
// 6. 查看 "Tree (Top-Down)" 视图：调用链分析
```

#### 2.3.4 Memory Inspector（内存检查器）

```javascript
// Memory Inspector 是 Chrome 105+ 引入的新功能
// 通过 Ctrl+Shift+P → "Show Memory Inspector" 打开

// 功能：
// 1. 查看特定对象的内存占用
// 2. 追踪对象的引用链
// 3. 分析 DOM 节点的内存占用
// 4. 检测循环引用

// 使用示例：
// 1. 在 Console 中选择一个对象：$0
// 2. 在 Memory Inspector 中查看其内存详情
// 3. 展开 "Retainers" 查看谁在引用它
// 4. 展开 "Children" 查看它引用了谁

// 循环引用检测：
// 如果 A → B → C → A，形成循环引用
// 在现代浏览器中，GC 可以处理循环引用
// 但如果循环引用中包含 DOM 节点，可能导致泄漏

// 示例：
function createCycle() {
  const div = document.createElement('div');
  const obj = { element: div };
  div.userData = obj;  // DOM → JS → DOM 循环引用
  // 即使 div 从 DOM 树中移除，循环引用可能阻止 GC
  // 现代浏览器已优化此场景，但仍需注意
}
```

### 2.4 内存碎片优化策略

#### 2.4.1 对象池模式

```javascript
// 对象池：复用对象，减少分配和 GC 压力

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

  get stats() {
    return {
      available: this.pool.length,
      active: this.active.size,
      total: this.pool.length + this.active.size,
    };
  }
}

// 使用示例：粒子系统
const particlePool = new ObjectPool(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, active: false }),
  (p) => { p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.life = 0; p.active = false; },
  1000
);

function emitParticle(x, y) {
  const p = particlePool.acquire();
  p.x = x; p.y = y;
  p.vx = (Math.random() - 0.5) * 10;
  p.vy = (Math.random() - 0.5) * 10;
  p.life = 100;
  p.active = true;
  return p;
}
```

#### 2.4.2  TypedArray 替代普通数组

```javascript
// 对于数值型数据，TypedArray 比 Array 更节省内存

// 普通 Array：每个元素是 JS 对象引用（64 位指针 + 对象头）
const normalArray = new Array(1000000);  // ~8MB 指针 + 实际数据

// TypedArray：连续内存，无对象头开销
const typedArray = new Float64Array(1000000);  // 精确 8MB

// 内存对比（100 万个元素）：
// Array<number>：~24MB（64 位系统）
// Float64Array：8MB
// Int32Array：4MB
// Uint8Array：1MB

// 适用场景：
// - 游戏开发（顶点数据、物理模拟）
// - 图像处理（像素数据）
// - 音频处理（采样数据）
// - 科学计算（矩阵运算）
```

#### 2.4.3 结构化克隆与 Transferable Objects

```javascript
// Worker 通信中的内存优化

// 反模式：结构化克隆（深拷贝，双倍内存）
const largeBuffer = new ArrayBuffer(10 * 1024 * 1024);  // 10MB
worker.postMessage({ data: largeBuffer });  // 克隆 10MB → 主线程 10MB + Worker 10MB

// 优化：Transferable Objects（零拷贝，所有权转移）
worker.postMessage({ data: largeBuffer }, [largeBuffer]);
// 主线程失去 largeBuffer 的所有权，直接转移到 Worker
// 内存占用：仅 10MB

// 支持 Transferable 的类型：
// - ArrayBuffer
// - MessagePort
// - ImageBitmap
// - ReadableStream (Chrome 107+)
// - WritableStream (Chrome 107+)
// - TransformStream (Chrome 107+)
```

---

## 3. 条件断点进阶与调试策略（Sources 面板进阶）

### 3.1 条件断点高级用法

#### 3.1.1 基础条件断点

```javascript
// 右键行号 → "Add conditional breakpoint" → 输入条件

// 示例 1：只在特定条件下断点
function processItem(item) {
  // 条件: item.id === 'error-case'
  console.log(item);
}

// 示例 2：计数断点（调试循环）
for (let i = 0; i < 1000; i++) {
  // 条件: i === 500 或 i % 100 === 0
  processItem(items[i]);
}

// 示例 3：异常断点（在特定错误时暂停）
try {
  JSON.parse(data);
  // 条件: false（不会命中，但配合异常断点使用）
} catch (e) {
  // 勾选 "Pause on exceptions" → 所有异常都会暂停
}
```

#### 3.1.2 高级条件断点技巧

```javascript
// 技巧 1：使用条件断点实现 "Logpoint"（日志断点）
// 条件: console.log('value:', x) || false
// 效果：打印日志但不暂停执行

// 技巧 2：条件断点 + 调用栈检查
// 条件: new Error().stack.includes('specificFunction')
// 效果：只在特定调用链时断点

// 技巧 3：条件断点 + 时间戳
// 条件: Date.now() > 1683000000000
// 效果：在特定时间后断点

// 技巧 4：条件断点 + 性能计时
// 条件: (typeof window.__start === 'undefined') && (window.__start = performance.now()) || (performance.now() - window.__start > 1000 && (delete window.__start, true))
// 效果：记录函数执行时间，超过 1s 时断点

// 技巧 5：条件断点 + 类型检查
// 条件: typeof data !== 'object' || data === null
// 效果：在数据类型不符合预期时断点

// 技巧 6：条件断点 + 状态检查
// 条件: store.getState().user === null
// 效果：在特定应用状态下断点
```

#### 3.1.3 DOM 断点进阶

```javascript
// DOM 断点类型：

// 1. Subtree modifications — 子树变化
// 在 Sources 面板 → DOM Breakpoints → 右键元素 → Add breakpoint → Subtree modifications
// 用途：追踪谁修改了 DOM 结构

// 2. Attribute modifications — 属性变化
// 用途：追踪谁修改了元素属性（class, style, data-*）

// 3. Node removal — 节点移除
// 用途：追踪谁移除了元素

// 高级用法：
// - 结合条件断点：在 DOM Breakpoint 触发后，在 Console 中检查条件
// - 结合 XHR Breakpoint：追踪特定 API 调用导致的 DOM 变化
// - 结合 Event Listener Breakpoint：追踪特定事件导致的 DOM 变化
```

#### 3.1.4 XHR/Fetch 断点

```javascript
// XHR Breakpoint：在 Sources 面板 → XHR Breakpoints

// 添加 XHR 断点：
// 1. 点击 "+" 按钮
// 2. 输入 URL 片段（部分匹配）
// 3. 当请求的 URL 包含该片段的时断点

// 示例：
// - 输入 "api/users" → 所有包含 "api/users" 的请求都会断点
// - 输入 ""（空）→ 所有 XHR/Fetch 请求都会断点

// 配合条件断点：
// 在 XHR 断点触发后，在 Console 中检查：
// - this.readyState
// - this.status
// - this.responseText

// Fetch 断点（Chrome 106+）：
// Fetch 请求也会触发 XHR Breakpoint
// 可以在 Console 中检查 fetch 的参数和返回值
```

#### 3.1.5 Event Listener Breakpoint

```javascript
// Event Listener Breakpoint：在 Sources 面板 → Event Listener Breakpoints

// 分类：
// - Mouse: click, dblclick, mousedown, mouseup, mousemove, mouseover, mouseout
// - Keyboard: keydown, keyup, keypress
// - Control: resize, scroll, zoom
// - Load: load, beforeunload, unload, DOMContentLoaded
// - Animation: requestAnimationFrame, animationStart, animationEnd
// - Clipboard: copy, cut, paste
// - Touch: touchstart, touchmove, touchend
// - Pointer: pointerdown, pointermove, pointerup
// - Media: play, pause, ended, timeupdate
// - Timer: setInterval, setTimeout

// 高级用法：
// 1. 只勾选特定事件，减少干扰
// 2. 配合调用栈分析，找到事件处理函数
// 3. 配合条件断点，过滤特定目标元素
```

### 3.2 调试策略与最佳实践

#### 3.2.1 二分调试法

```javascript
// 当不确定问题出在哪里时，使用二分调试法：

// 场景：数据从 API 获取到最终渲染，中间经过多层处理
// 问题：最终显示的数据不正确

// 二分调试步骤：
// 1. 在数据处理链的中间位置设置断点
// 2. 检查数据是否正确
// 3. 如果正确 → 问题在后半段
// 4. 如果不正确 → 问题在前半段
// 5. 在问题区间继续二分，直到定位到具体代码行

// 示例：
async function loadData() {
  const response = await fetch('/api/data');  // ← 断点 1: 检查 response
  const json = await response.json();          // ← 断点 2: 检查 json
  const transformed = transform(json);         // ← 断点 3: 检查 transformed
  const validated = validate(transformed);     // ← 断点 4: 检查 validated
  render(validated);                           // ← 断点 5: 检查 rendered
}
// 通过二分法，最多 3 次就能定位到问题所在
```

#### 3.2.2 黑盒脚本（Blackbox Scripts）

```javascript
// 黑盒脚本：跳过第三方库，只调试自己的代码

// 使用方法：
// 1. Sources 面板 → 打开第三方库文件
// 2. Ctrl+Shift+P → "Blackbox selected script"
// 3. 或者右键行号 → "Blackbox script"

// 效果：
// - Step Into (F11) 不会进入黑盒脚本
// - 调用栈中黑盒脚本显示为灰色
// - 断点在黑盒脚本中仍然有效（但不会自动停入）

// 适用场景：
// - React/Vue 框架代码
// - Lodash/Underscore 工具库
// - 第三方 SDK
// - Polyfill

// 取消黑盒：
// Settings → Blackbox JavaScript → 管理黑盒列表
```

#### 3.2.3 调试异步代码

```javascript
// Async Call Stack（异步调用栈）：

// Chrome DevTools 可以追踪异步调用的完整调用链
// 在 Sources 面板 → Call Stack → 勾选 "Async"

// 示例：
async function fetchData() {
  const response = await fetch('/api/data');  // ← 在这里断点
  const data = await response.json();
  return data;
}

function handleClick() {
  fetchData();  // ← 异步调用起点
}

// 断点触发时，Call Stack 显示：
// 1. fetchData (async)
// 2. Promise.then (async)
// 3. handleClick
// 4. EventListener.handleEvent

// 如果没有 Async Call Stack，只能看到：
// 1. fetchData (async)
// 2. Promise.then (async)
// 无法追踪到 handleClick
```

#### 3.2.4 调试 Service Worker

```javascript
// Service Worker 调试：

// 1. 打开 chrome://serviceworker-internals
// 2. 找到目标 Service Worker
// 3. 点击 "inspect" 链接
// 4. 打开独立的 DevTools 窗口

// 或者：
// Application 面板 → Service Workers → 点击 "inspect"

// Service Worker 调试要点：
// - 独立的执行环境（无 DOM，无 window）
// - 全局对象是 self（不是 window）
// - 可以使用 Console、Sources、Network 面板
// - 不支持 DOM 断点、元素检查

// 常见调试场景：
// - 拦截请求（fetch 事件）
// - 缓存策略（cache API）
// - 推送通知（push 事件）
// - 后台同步（sync 事件）
```

---

## 4. CDP 自动化调试（Chrome DevTools Protocol）

### 4.1 CDP 基础

```javascript
// CDP (Chrome DevTools Protocol) 是 DevTools 的底层通信协议
// 允许程序化控制 Chrome 浏览器

// 启动 Chrome 开启远程调试：
// chrome --remote-debugging-port=9222

// 访问 http://localhost:9222 查看所有可调试的页面
// 访问 http://localhost:9222/json 获取 JSON 格式的页面列表

// CDP 命令格式：
// {
//   "id": 1,
//   "method": "Domain.methodName",
//   "params": { ... }
// }

// 响应格式：
// {
//   "id": 1,
//   "result": { ... }
// }

// 事件格式：
// {
//   "method": "Domain.eventName",
//   "params": { ... }
// }
```

### 4.2 常用 CDP 命令

#### 4.2.1 页面控制

```javascript
// 导航
{ "id": 1, "method": "Page.navigate", "params": { "url": "https://example.com" } }

// 截图
{ "id": 2, "method": "Page.captureScreenshot", "params": { "format": "png" } }

// PDF
{ "id": 3, "method": "Page.printToPDF", "params": { "printBackground": true } }

// 设置视口
{ "id": 4, "method": "Emulation.setDeviceMetricsOverride", "params": {
  "width": 375, "height": 812, "deviceScaleFactor": 3, "mobile": true
}}

// 设置 User Agent
{ "id": 5, "method": "Emulation.setUserAgentOverride", "params": {
  "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)..."
}}
```

#### 4.2.2 性能分析

```javascript
// 开始性能分析
{ "id": 10, "method": "Performance.enable" }

// 获取性能指标
{ "id": 11, "method": "Performance.getMetrics" }

// 响应示例：
// {
//   "metrics": [
//     { "name": "Timestamp", "value": 12345.678 },
//     { "name": "Documents", "value": 5 },
//     { "name": "Frames", "value": 3 },
//     { "name": "JSEventListeners", "value": 142 },
//     { "name": "Nodes", "value": 1234 },
//     { "name": "JSHeapUsedSize", "value": 8543210 },
//     { "name": "JSHeapTotalSize", "value": 12345678 },
//     { "name": "LayoutCount", "value": 456 },
//     { "name": "RecalcStyleCount", "value": 234 },
//     { "name": "LayoutDuration", "value": 1.234 },
//     { "name": "RecalcStyleDuration", "value": 0.567 },
//     { "name": "ScriptDuration", "value": 2.345 },
//     { "name": "TaskDuration", "value": 3.456 },
//     { "name": "CPUUsage", "value": 45.6 }
//   ]
// }
```

#### 4.2.3 网络拦截

```javascript
// 启用网络域
{ "id": 20, "method": "Network.enable" }

// 监听网络事件
// Network.requestWillBeSent — 请求即将发送
// Network.responseReceived — 收到响应
// Network.loadingFinished — 加载完成
// Network.loadingFailed — 加载失败

// 修改请求
{ "id": 21, "method": "Network.setExtraHTTPHeaders", "params": {
  "headers": { "X-Custom-Header": "value" }
}}

// 阻止特定请求
{ "id": 22, "method": "Network.setBlockedURLs", "params": {
  "urls": ["*://*.ads.example.com/*"]
}}

// 模拟网络条件
{ "id": 23, "method": "Network.emulateNetworkConditions", "params": {
  "offline": false,
  "latency": 100,      // 延迟（ms）
  "downloadThroughput": 1024 * 1024,  // 下载速度（bytes/sec）
  "uploadThroughput": 512 * 1024      // 上传速度（bytes/sec）
}}
// 模拟慢 3G: latency=150, download=400*1024, upload=150*1024
// 模拟离线: offline=true
```

#### 4.2.4 JavaScript 执行

```javascript
// 执行 JavaScript
{ "id": 30, "method": "Runtime.evaluate", "params": {
  "expression": "document.title",
  "returnByValue": true
}}

// 调用对象方法
{ "id": 31, "method": "Runtime.callFunctionOn", "params": {
  "objectId": "<object_id>",
  "functionDeclaration": "function() { return this.value; }",
  "returnByValue": true
}}

// 获取对象属性
{ "id": 32, "method": "Runtime.getProperties", "params": {
  "objectId": "<object_id>",
  "ownProperties": true
}}

// 注入脚本
{ "id": 33, "method": "Page.addScriptToEvaluateOnNewDocument", "params": {
  "source": "Object.defineProperty(navigator, 'webdriver', { get: () => false });"
}}
```

### 4.3 CDP 实战：自动化性能审计

```javascript
// 使用 CDP 自动化性能审计流程

// 完整流程：
// 1. 连接到 Chrome
// 2. 启用必要的域
// 3. 导航到目标页面
// 4. 等待页面加载
// 5. 开始性能分析
// 6. 执行用户操作（点击、滚动等）
// 7. 停止性能分析
// 8. 收集指标
// 9. 截图
// 10. 生成报告

// 示例代码（使用 puppeteer-core）：
const puppeteer = require('puppeteer-core');

async function auditPerformance(url) {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null
  });

  const [page] = await browser.pages();
  await page.goto(url, { waitUntil: 'networkidle0' });

  // 启用性能分析
  const client = await page.createCDPSession();
  await client.send('Performance.enable');

  // 收集指标
  const metrics = await client.send('Performance.getMetrics');

  // 截图
  const screenshot = await page.screenshot({ fullPage: true });

  // 获取 Lighthouse 指标（通过 CDP）
  await client.send('Performance.enable');
  const lcp = await page.evaluate(() => {
    return new Promise(resolve => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        resolve(entries[entries.length - 1].startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
  });

  await browser.close();

  return {
    metrics: metrics.metrics.reduce((acc, m) => {
      acc[m.name] = m.value;
      return acc;
    }, {}),
    lcp,
    screenshot
  };
}

// 批量审计
async function batchAudit(urls) {
  const results = [];
  for (const url of urls) {
    console.log(`审计: ${url}`);
    const result = await auditPerformance(url);
    results.push({ url, ...result });
  }
  return results;
}
```

### 4.4 CDP 实战：内存泄漏自动化检测

```javascript
// 使用 CDP 自动化检测内存泄漏

async function detectMemoryLeaks(page, operations) {
  const client = await page.createCDPSession();

  // 1. 拍摄初始快照
  await client.send('HeapProfiler.enable');
  await client.send('Runtime.collectGarbage');  // 强制 GC
  await new Promise(r => setTimeout(r, 1000));

  const snapshot1 = await client.send('HeapProfiler.takeHeapSnapshot');

  // 2. 执行操作
  for (const operation of operations) {
    await operation(page);
    await new Promise(r => setTimeout(r, 500));
  }

  // 3. 强制 GC 并拍摄快照
  await client.send('Runtime.collectGarbage');
  await new Promise(r => setTimeout(r, 1000));

  const snapshot2 = await client.send('HeapProfiler.takeHeapSnapshot');

  // 4. 分析差异
  // 注意：实际分析需要解析快照文件，这里简化处理
  const metrics = await client.send('Performance.getMetrics');
  const jsHeap = metrics.metrics.find(m => m.name === 'JSHeapUsedSize');

  return {
    jsHeapUsedSize: jsHeap.value,
    snapshot1,
    snapshot2,
    // 如果 JSHeapUsedSize 持续增长，可能存在内存泄漏
    leakDetected: jsHeap.value > threshold
  };
}

// 使用示例
async function testPageLeaks() {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const [page] = await browser.pages();
  await page.goto('http://localhost:3000');

  const operations = [
    async (p) => { await p.click('#open-dialog'); await p.click('#close-dialog'); },
    async (p) => { await p.click('#load-more'); },
    async (p) => { await p.click('#open-dialog'); await p.click('#close-dialog'); },
    async (p) => { await p.click('#load-more'); },
    async (p) => { await p.click('#open-dialog'); await p.click('#close-dialog'); },
  ];

  const result = await detectMemoryLeaks(page, operations);
  console.log('内存泄漏检测结果:', result);

  await browser.close();
}
```

---

## 5. DevTools 实验性功能（Experiments）

### 5.1 启用实验性功能

```
启用步骤：
1. DevTools → Settings (F1) → Experiments
2. 勾选需要的实验性功能
3. 重启 DevTools

注意：实验性功能可能不稳定，仅供探索
```

### 5.2 常用实验性功能

#### 5.2.1 Performance Panel 实验

| 实验名称 | 功能 | 适用场景 |
|----------|------|----------|
| Track loading of resources in network panel | 在 Network 面板中跟踪资源加载 | 分析资源加载时序 |
| Native Memory Breakpoints | 原生内存断点 | 检测 C++ 层面的内存问题 |
| Performance analysis: memory overview | 内存概览轨道 | 可视化内存使用趋势 |
| Performance panel: screenshot support | 截图支持 | 视觉化性能问题 |

#### 5.2.2 Sources Panel 实验

| 实验名称 | 功能 | 适用场景 |
|----------|------|----------|
| JavaScript source maps | 源码映射 | 调试压缩/编译后的代码 |
| Blackboxing | 黑盒脚本 | 跳过第三方库 |
| Conditional breakpoints | 条件断点 | 精准调试 |

#### 5.2.3 Memory Panel 实验

| 实验名称 | 功能 | 适用场景 |
|----------|------|----------|
| Memory Inspector | 内存检查器 | 分析对象内存占用 |
| Allocation profiling | 分配分析 | 检测内存分配热点 |
| Garbage collection for testing | 测试 GC | 强制 GC 测试 |

#### 5.2.4 Console 实验

| 实验名称 | 功能 | 适用场景 |
|----------|------|----------|
| Console 2.0 | 新版控制台 | 更好的日志体验 |
| Live expression | 实时表达式 | 监控变量值变化 |

### 5.3 Live Expression（实时表达式）

```javascript
// Live Expression 是 DevTools 的实验性功能
// 可以实时监控表达式的值，无需暂停执行

// 使用方法：
// 1. Sources 面板 → 点击 "Live Expression" 图标（眼睛图标）
// 2. 输入表达式
// 3. 表达式的值会实时更新

// 示例：
// - document.querySelectorAll('.item').length  → 实时监控列表项数量
// - performance.memory.usedJSHeapSize / 1024 / 1024  → 实时监控内存使用
// - window.scrollY  → 实时监控滚动位置
// - document.hidden  → 监控页面可见性

// 适用场景：
// - 监控性能指标
// - 跟踪状态变化
// - 调试动画帧率
```

---

## 6. 跨面板联动调试实战

### 6.1 场景一：性能问题诊断全流程

```
问题：页面滚动卡顿

诊断流程：

Step 1: Performance 面板录制
├── 勾选 "Screenshot" 和 "Memory"
├── 执行滚动操作
└── 分析结果：
    ├── 找到 FPS 低的帧
    ├── 查看 Main Thread 火焰图
    └── 发现 Layout 耗时过长

Step 2: Sources 面板定位代码
├── 从 Performance 的 Call Tree 找到触发 Layout 的函数
├── 在 Sources 面板中打开对应文件
├── 设置条件断点
└── 复现问题，检查调用栈

Step 3: Console 面板验证修复
├── 在 Console 中测试优化方案
├── 使用 $$() 选择元素验证
└── 使用 performance.now() 测量优化效果

Step 4: Memory 面板确认无泄漏
├── 拍摄 Heap Snapshot
├── 执行滚动操作多次
└── 对比快照，确认无内存增长

Step 5: Lighthouse 面板验证
├── 运行 Lighthouse 审计
├── 查看 INP 指标
└── 确认滚动性能达标
```

### 6.2 场景二：内存泄漏定位全流程

```
问题：SPA 应用长时间运行后内存持续增长

诊断流程：

Step 1: Memory 面板 — Allocation Timeline
├── 开始录制
├── 执行典型用户操作（导航、交互）
├── 停止录制
└── 分析：
    ├── 内存曲线是否持续增长？
    ├── 是否有频繁的 GC？
    └── 哪些函数分配了最多内存？

Step 2: Memory 面板 — Heap Snapshot 对比
├── 拍摄初始快照（Snapshot 1）
├── 执行操作 10 次
├── 拍摄操作后快照（Snapshot 2）
├── 对比 Delta
└── 找到数量显著增加的对象类型

Step 3: Memory Inspector — 追踪保留路径
├── 选择泄漏对象
├── 查看 Retainers（谁在引用它）
├── 找到根引用
└── 确定泄漏源

Step 4: Sources 面板 — 修复代码
├── 定位泄漏代码
├── 添加清理逻辑
└── 设置断点验证清理逻辑执行

Step 5: Memory 面板 — 验证修复
├── 重复 Step 1-2
├── 确认内存不再增长
└── 确认 GC 后内存回落到正常水平
```

### 6.3 场景三：网络问题诊断全流程

```
问题：API 请求慢导致页面加载时间长

诊断流程：

Step 1: Network 面板 — 分析请求
├── 刷新页面
├── 查看 Waterfall
├── 找到耗时最长的请求
└── 分析：
    ├── DNS 查询时间
    ├── TCP 连接时间
    ├── TLS 握手时间
    ├── TTFB（首字节时间）
    └── 内容下载时间

Step 2: Performance 面板 — 关联分析
├── 录制性能分析
├── 查看 Network 轨道
├── 找到请求与页面渲染的关系
└── 分析：
    ├── 请求是否阻塞了渲染？
    ├── 是否有资源竞争？
    └── 是否可以并行加载？

Step 3: Console 面板 — 检查错误
├── 查看是否有 CORS 错误
├── 查看是否有 4xx/5xx 错误
└── 查看是否有 CSP 违规

Step 4: Application 面板 — 检查缓存
├── 查看 Cache Storage
├── 查看 Service Worker 缓存策略
└── 确认缓存是否生效

Step 5: 综合优化
├── 启用 HTTP/2 多路复用
├── 优化资源加载顺序
├── 添加预加载（preload/prefetch）
└── 启用 Service Worker 缓存
```

---

## 7. 面试高频考点

### 7.1 Performance 面板

| 考点 | 说明 |
|------|------|
| 如何定位页面卡顿？ | Performance 录制 → 找长任务 → Call Tree 定位代码 |
| 什么是 Long Task？ | 执行时间 > 50ms 的任务，会导致掉帧 |
| 如何优化 Layout Thrashing？ | 读写分离、使用 requestAnimationFrame、避免强制同步布局 |
| FPS 低的原因？ | Main Thread 阻塞、大量 Layout/Paint、GC 停顿 |
| 如何分析首屏加载性能？ | Performance 录制 + Lighthouse + Waterfall 分析 |

### 7.2 Memory 面板

| 考点 | 说明 |
|------|------|
| 如何检测内存泄漏？ | Heap Snapshot 对比、Allocation Timeline 分析 |
| 常见内存泄漏模式？ | 闭包、全局变量、DOM 引用、Timer、Event Listener |
| 如何优化内存使用？ | 对象池、WeakMap、TypedArray、Transferable Objects |
| V8 垃圾回收机制？ | Scavenge（新生代）+ Mark-Sweep/Compact（旧生代） |
| 什么是内存碎片？ | 堆中存在大量小块空闲空间，无法满足大对象分配 |

### 7.3 Sources 面板

| 考点 | 说明 |
|------|------|
| 断点类型有哪些？ | 行断点、条件断点、DOM 断点、XHR 断点、Event Listener 断点 |
| 如何调试异步代码？ | Async Call Stack、断点在 await 处 |
| 黑盒脚本的作用？ | 跳过第三方库，只调试自己的代码 |
| 如何调试 Service Worker？ | chrome://serviceworker-internals 或 Application 面板 |
| 条件断点的进阶用法？ | 日志断点、调用栈检查、性能计时 |

### 7.4 CDP

| 考点 | 说明 |
|------|------|
| 什么是 CDP？ | Chrome DevTools Protocol，程序化控制 Chrome 的协议 |
| CDP 的应用场景？ | 自动化测试、性能审计、爬虫、安全测试 |
| 如何启用 CDP？ | chrome --remote-debugging-port=9222 |
| CDP 与 Puppeteer 的关系？ | Puppeteer 是 CDP 的高级封装 |
| CDP 可以做什么？ | 页面控制、性能分析、网络拦截、JS 执行、内存分析 |

---

## 8. 自测题

### 8.1 基础题

1. Performance 面板中，"Layout" 事件和 "Paint" 事件的区别是什么？
2. 什么是 Long Task？如何检测？
3. Heap Snapshot 对比分析的原理是什么？
4. 条件断点和普通断点有什么区别？
5. CDP 的全称是什么？列举 3 个常用 CDP 域。

### 8.2 进阶题

6. 如何区分内存泄漏和内存抖动？分别用什么工具检测？
7. 解释 V8 的 Scavenge GC 和 Mark-Compact GC 的区别。
8. 什么是 Layout Thrashing？如何避免？
9. 如何使用 CDP 自动化性能审计？描述完整流程。
10. 解释 Transferable Objects 的原理和使用场景。

### 8.3 实战题

11. 用户反馈页面滚动卡顿，描述你的完整诊断流程。
12. SPA 应用长时间运行后内存持续增长，如何定位和修复？
13. API 请求慢导致页面加载时间长，如何分析和优化？
14. 使用条件断点实现 "日志断点"（打印日志但不暂停执行）。
15. 使用 CDP 编写脚本，自动检测页面的内存泄漏。

---

## 附录：Chrome DevTools 训练总结

### 四轮训练回顾

| 轮次 | 日期 | 主题 | 核心内容 |
|------|------|------|----------|
| R1 | 4/26 | 基础深度 | Performance/Memory/Sources 基础使用 |
| R2 | 4/29 | 全面覆盖 | 断点调试/性能分析/内存泄漏检测/Lighthouse |
| R3 | 4/30 | 高级进阶 | 远程调试/CI 集成/生产级实战/工具链整合 |
| R4 | 5/2 | Trace 事件 + 内存碎片 + 条件断点进阶 + CDP 自动化 | Trace 事件分类/内存碎片诊断/条件断点高级用法/CDP 自动化 |

### 调试技能矩阵

```
┌─────────────────────────────────────────────────────────────┐
│                    调试技能全景图                            │
├──────────────┬──────────────────────────────────────────────┤
│ 性能调试     │ Performance 面板 / Lighthouse / Coverage     │
│              │ Trace 事件分析 / Long Task 检测              │
│              │ FPS 分析 / 渲染优化                          │
├──────────────┼──────────────────────────────────────────────┤
│ 内存调试     │ Heap Snapshot / Allocation Timeline          │
│              │ 内存泄漏检测 / 内存碎片诊断                  │
│              │ GC 分析 / 对象池优化                         │
├──────────────┼──────────────────────────────────────────────┤
│ 代码调试     │ Sources 面板 / 断点调试                      │
│              │ 条件断点 / DOM 断点 / XHR 断点              │
│              │ Async Call Stack / 黑盒脚本                  │
├──────────────┼──────────────────────────────────────────────┤
│ 网络调试     │ Network 面板 / HAR 分析                      │
│              │ 请求拦截 / 网络模拟                          │
│              │ Service Worker 调试                          │
├──────────────┼──────────────────────────────────────────────┤
│ 自动化调试   │ CDP / Puppeteer                              │
│              │ 自动化性能审计 / 内存泄漏检测                │
│              │ 批量测试 / CI 集成                           │
└──────────────┴──────────────────────────────────────────────┘
```

**Chrome DevTools 专项训练**: 4 轮迭代，全部闭环 ✅

---

*最后更新: 2026-05-02 16:00*
