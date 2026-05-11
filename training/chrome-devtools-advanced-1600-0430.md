# Chrome DevTools 高级实战：性能瓶颈诊断 / 内存泄漏追踪 / 异步调试 / 远程调试

> 专项训练 16:00 | 2026-04-30 | 调试技能专项 (第三轮)
> 前两轮：4/26 基础深度 → 4/29 全面覆盖 → 本轮：高级进阶 + 生产级实战

---

## 目录

1. [DevTools 高级架构与底层原理](#1-devtools-高级架构与底层原理)
2. [Performance 面板高级诊断](#2-performance-面板高级诊断)
3. [Memory 面板高级追踪](#3-memory-面板高级追踪)
4. [Sources 面板高级调试](#4-sources-面板高级调试)
5. [远程调试与移动端调试](#5-远程调试与移动端调试)
6. [自动化性能审计与 CI 集成](#6-自动化性能审计与-ci-集成)
7. [生产级实战演练场](#7-生产级实战演练场)
8. [调试工具链整合](#8-调试工具链整合)
9. [面试高频考点](#9-面试高频考点)
10. [自测题](#10-自测题)

---

## 1. DevTools 高级架构与底层原理

### 1.1 Chrome 多进程架构与 DevTools 的关系

```
┌──────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                            │
├─────────────┬──────────────┬──────────────┬─────────────────────┤
│  Browser    │  GPU         │  Renderer    │  Renderer           │
│  Process    │  Process     │  Process     │  Process (iframe)   │
│             │              │              │                     │
│  ┌───────┐  │  ┌───────┐  │  ┌───────┐   │  ┌───────┐          │
│  │ Tab A │  │  │ Compositing │  │ Tab B │   │  │ iframe│          │
│  │ + JS  │  │  │ Raster    │  │ + JS  │   │  │ + JS  │          │
│  │ + DOM │  │  │ Painting  │  │ + DOM │   │  │ + DOM │          │
│  └───┬───┘  │  └───────┘  │  └───┬───┘   │  └───┬───┘          │
│      │      │              │      │       │      │              │
│      └──────┴──────────────┴──────┼───────┴──────┘              │
│                                   │                              │
│                    DevTools Protocol (CDP)                        │
│                    ┌──────────────┼──────────────┐              │
│                    │  Domain: Page│ Domain: Prof │ Domain: Heap │
│                    │  Domain: Network│ Runtime  │ Inspector    │
│                    └──────────────┴──────────────┘              │
└──────────────────────────────────────────────────────────────────┘
```

**关键理解：**
- 每个 Tab 是独立的 Renderer 进程，DevTools 通过 CDP 协议与目标页面通信
- GPU 进程负责合成和光栅化，Performance 面板中的 "GPU" 轨道即来自此
- 跨域 iframe 有独立的 Renderer 进程，需要切换 Target 才能调试

### 1.2 Chrome DevTools Protocol (CDP) 核心域

```javascript
// CDP 是 DevTools 的底层协议，所有面板操作都通过 CDP 命令完成
// 可以通过 --remote-debugging-port=9222 启动 Chrome 来直接访问

// 常用 CDP 域：
const domains = {
  // 页面控制
  'Page': {
    'enable': '启用页面域事件',
    'navigate': '导航到 URL',
    'reload': '重新加载',
    'captureScreenshot': '截图',
    'printToPDF': '导出 PDF',
  },
  // JavaScript 运行时
  'Runtime': {
    'evaluate': '执行 JS 表达式',
    'callFunctionOn': '调用对象方法',
    'getProperties': '获取对象属性',
    'addBinding': '注入绑定函数',
  },
  // 性能分析
  'Profiler': {
    'enable': '启用分析器',
    'start': '开始 CPU 分析',
    'stop': '停止分析',
    'setSamplingInterval': '设置采样间隔',
  },
  // 内存分析
  'HeapProfiler': {
    'enable': '启用堆分析器',
    'startTrackingHeapObjects': '开始追踪堆对象',
    'stopTrackingHeapObjects': '停止追踪',
    'takeHeapSnapshot': '获取堆快照',
    'getHeapObjectID': '获取对象 ID',
  },
  // 网络
  'Network': {
    'enable': '启用网络监控',
    'setCacheDisabled': '禁用缓存',
    'emulateNetworkConditions': '模拟网络',
    'setRequestInterception': '请求拦截',
  },
  // DOM
  'DOM': {
    'enable': '启用 DOM 域',
    'getFlattenedDocument': '获取扁平化 DOM',
    'querySelector': 'CSS 选择器查询',
    'setAttributeValue': '设置属性',
  },
  // CSS
  'CSS': {
    'enable': '启用 CSS 域',
    'getMatchedStylesForNode': '获取匹配样式',
    'setStyleTexts': '设置样式',
    'addStyleText': '添加样式',
  },
};
```

### 1.3 DevTools 前端源码架构

```
DevTools 前端 (开源，可在 Chromium 源码中查看):
├── front_end/
│   ├── entrypoints/          # 入口点 (main/MainImpl.js)
│   ├── panels/               # 各面板实现
│   │   ├── elements/         # Elements 面板
│   │   ├── console/          # Console 面板
│   │   ├── sources/          # Sources 面板
│   │   ├── network/          # Network 面板
│   │   ├── performance/      # Performance 面板
│   │   ├── memory/           # Memory 面板
│   │   └── ...
│   ├── models/               # 数据模型
│   │   ├── sdk/              # 与 CDP 交互的 SDK
│   │   ├── trace/            # 跟踪数据处理
│   │   └── ...
│   ├── ui/                   # UI 组件
│   └── ...
```

**实际意义：** 理解 DevTools 前端架构有助于排查 DevTools 自身问题，或开发自定义 DevTools 扩展。

### 1.4 性能分析底层原理

```
Performance 面板数据采集流程：

1. DevTools 发送 CDP 命令:
   Profiler.enable()
   Page.enable()
   Network.enable()
   DOM.enable()
   ...

2. Chrome 内核开始采样：
   - V8 采样分析器 (每 1ms 采样一次调用栈)
   - 合成线程事件记录
   - 网络事件记录
   - DOM 事件记录

3. 数据组装为 Trace Event Format：
   {
     "name": "FunctionCall",
     "cat": "v8",
     "ts": 1234567890123,  // 微秒级时间戳
     "ph": "X",            // X = 完整事件 (完整持续时间)
     "dur": 1500,          // 持续时间 (微秒)
     "pid": 1234,
     "tid": 5678,
     "args": {
       "data": {
         "functionName": "render",
         "scriptName": "app.js"
       }
     }
   }

4. DevTools 前端解析 Trace 数据并渲染为可视化图表
```

---

## 2. Performance 面板高级诊断

### 2.1 火焰图深度解读：从函数调用到性能瓶颈

```javascript
// 示例：一个典型的性能问题代码
class DataGrid {
  constructor(data) {
    this.data = data;
    this.columns = [];
    this.sortState = null;
  }

  // 问题 1: 同步渲染大量数据
  render() {
    const startTime = performance.now();

    // 过滤 (O(n))
    const filtered = this.data.filter(row => row.visible);

    // 排序 (O(n log n))
    if (this.sortState) {
      filtered.sort((a, b) => {
        return a[this.sortState.field] - b[this.sortState.field];
      });
    }

    // 分页 (O(1))
    const paged = filtered.slice(
      this.sortState?.page * this.pageSize,
      (this.sortState?.page + 1) * this.pageSize
    );

    // DOM 操作 (O(n) — 每次创建 DOM 节点)
    const container = document.getElementById('grid');
    container.innerHTML = ''; // ← 问题：清空整个容器

    paged.forEach(row => {
      const tr = document.createElement('tr');
      this.columns.forEach(col => {
        const td = document.createElement('td');
        td.textContent = row[col.field];
        tr.appendChild(td);  // ← 问题：逐个 append，触发多次重排
      });
      container.appendChild(tr);
    });

    // 问题 2: 强制同步布局 (Layout Thrashing)
    paged.forEach((row, i) => {
      const tr = container.children[i];
      const height = tr.offsetHeight;  // ← 读取布局属性
      tr.style.height = `${height + 1}px`;  // ← 写入布局属性
      // 每次循环都触发 reflow！
    });

    console.log(`Render took: ${performance.now() - startTime}ms`);
  }
}

// 在火焰图中，你会看到：
// 1. 一个很长的 "FunctionCall" 条 (render 方法)
// 2. 内部嵌套：
//    - Array.prototype.filter (黄色，JS 执行)
//    - Array.prototype.sort (黄色，JS 执行)
//    - createElement (紫色，DOM 操作)
//    - appendChild (紫色，DOM 操作)
//    - get offsetHeight (红色，Layout/重排)
// 3. 底部 Summary 面板显示：
//    - Script Duration: ~180ms (远超 50ms 长任务阈值)
//    - Layout Duration: ~120ms (异常高)
//    - Recalculate Style: ~40ms
```

**火焰图解读技巧：**

```
火焰图阅读规则：
1. Y 轴 = 调用栈深度 (越往上调用越深)
2. X 轴 = 时间宽度 (越宽 = 耗时越长)
3. 颜色 = 类别 (黄色=JS, 紫色=DOM, 红色=Layout, 绿色=Paint)
4. 平顶 = 函数自身耗时 (没有更深的调用)
5. 窄尖 = 调用链深但单个函数耗时短

诊断流程：
Step 1: 找到最长的条 → 定位瓶颈函数
Step 2: 查看颜色 → 判断瓶颈类型 (JS/DOM/Layout/Paint)
Step 3: 查看调用栈 → 找到触发点
Step 4: 查看 Bottom-Up 面板 → 按自身耗时排序所有函数
Step 5: 查看 Call Tree 面板 → 按总耗时排序
```

### 2.2 长任务 (Long Task) 深度分析

```javascript
// Long Task API — 在 Performance 面板中自动标记
// 定义：执行时间 > 50ms 的任务

// 手动注册 Long Task 监听器
const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach(entry => {
    console.log('Long Task detected:');
    console.log(`  Duration: ${entry.duration}ms`);
    console.log(`  Start: ${entry.startTime}ms`);
    console.log(`  Name: ${entry.name}`);
    // entry.attribution 可以定位到具体容器 (iframe/worker)
    if (entry.attribution) {
      entry.attribution.forEach(a => {
        console.log(`  Container: ${a.containerType}`);
        console.log(`  Name: ${a.name}`);
      });
    }
  });
});
observer.observe({ entryTypes: ['longtask'] });

// 长任务常见来源：
// 1. 大数据量同步处理 (排序/过滤/格式化)
// 2. 复杂 DOM 操作 (innerHTML 大量 HTML / 逐个 appendChild)
// 3. 同步 JSON.parse/stringify 大对象
// 4. 正则表达式回溯 (ReDoS)
// 5. 同步图片处理 (Canvas)

// 优化策略：
// 策略 1: 分片处理 (Time Slicing)
function processInChunks(items, chunkSize, processFn, callback) {
  let index = 0;
  function chunk() {
    const end = Math.min(index + chunkSize, items.length);
    while (index < end) {
      processFn(items[index]);
      index++;
    }
    if (index < items.length) {
      // 使用 MessageChannel 实现高性能 setTimeout 替代
      scheduleAnimationFrame(chunk);
    } else {
      callback?.();
    }
  }
  chunk();
}

// 策略 2: Web Worker  offload 计算
// main.js
const worker = new Worker('data-processor.js');
worker.postMessage({ data: largeDataset, operation: 'sort' });
worker.onmessage = (e) => {
  console.log('Worker 完成，结果:', e.data);
  render(e.data); // 回到主线程渲染
};

// data-processor.js
self.onmessage = (e) => {
  const { data, operation } = e.data;
  let result;
  if (operation === 'sort') {
    result = [...data].sort((a, b) => a.value - b.value);
  } else if (operation === 'filter') {
    result = data.filter(item => item.active);
  }
  self.postMessage(result);
};

// 策略 3: 使用 scheduler.yield (Chrome 109+)
async function processLargeArray(items) {
  for (let i = 0; i < items.length; i++) {
    processItem(items[i]);
    // 每 100 项让出控制权，避免长任务
    if (i % 100 === 0) {
      await scheduler.yield();
    }
  }
}

// 策略 4: requestIdleCallback 处理低优先级任务
requestIdleCallback((deadline) => {
  while (deadline.timeRemaining() > 0 && tasks.length > 0) {
    tasks.shift()();
  }
}, { timeout: 2000 }); // 2 秒内必须执行
```

### 2.3 合成与光栅化分析

```
Performance 面板中的合成线程 (Compositor Thread)：

主线程 (Main Thread)          合成线程 (Compositor Thread)
┌─────────────────┐          ┌─────────────────┐
│  JS 执行         │ ──────→ │  图层合成        │
│  样式计算         │         │  滚动处理        │
│  布局 (Layout)   │         │  动画执行        │
│  绘制 (Paint)    │         │  滚动条更新      │
└─────────────────┘          └─────────────────┘
                                        │
                                   ┌────┴────┐
                                   │ GPU 进程 │
                                   │ 光栅化   │
                                   │ 渲染     │
                                   └─────────┘

合成线程相关事件：
- CompositeLayers: 图层合成
- ScrollTo: 滚动事件
- Animate: CSS 动画
- UpdateLayerTree: 图层树更新
- DrawFrame: 绘制帧

优化目标：
1. 让动画在合成线程执行 (使用 transform/opacity)
2. 避免主线程阻塞合成 (主线程忙 → 掉帧)
3. 减少图层数量 (每个图层都有内存开销)
```

**图层创建规则：**

```javascript
// 浏览器自动创建独立图层的条件：
// 1. position: fixed / sticky
// 2. will-change: transform/opacity/filter
// 3. transform: translateZ(0) / translate3d() (硬件加速 hack)
// 4. video/canvas/WebGL 元素
// 5. 动画元素 (CSS animation/transition)
// 6. mix-blend-mode 非 normal 的元素
// 7. opacity < 1 且有变换
// 8. filter 非 none 的元素

// 查看图层：Rendering 面板 → "Layer borders" 复选框
// 每个图层会有绿色边框，边框越粗 = 图层越大

// 过度创建图层的问题：
// - 内存占用增加 (每个图层需要 GPU 纹理内存)
// - 合成开销增加 (图层越多，合成越慢)
// - 移动端尤其明显

// 最佳实践：
// ✅ 只对需要动画的元素使用 will-change
// ✅ 动画结束后移除 will-change
// ✅ 使用 transform 而非 top/left 做动画
// ✅ 避免嵌套过多 will-change 元素

const animatedEl = document.getElementById('animated');
// 动画开始前
animatedEl.style.willChange = 'transform';
// 动画结束后
animatedEl.addEventListener('transitionend', () => {
  animatedEl.style.willChange = 'auto';
});
```

### 2.4 Core Web Vitals 深度分析

```javascript
// Core Web Vitals 三大指标 + INP (新增)

// === LCP (Largest Contentful Paint) ===
// 定义：视口中最大内容元素的渲染时间
// 目标：< 2.5s
// 测量：

const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lcp = entries[entries.length - 1]; // 最后一个 = 最大的
  console.log('LCP:', lcp.renderTime || lcp.loadTime);
  console.log('LCP 元素:', lcp.element);
  console.log('LCP 大小:', lcp.size, 'bytes');
  console.log('LCP URL:', lcp.url);
});
lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

// LCP 优化策略：
// 1. 优化 LCP 元素的加载优先级
//    - <link rel="preload" as="image" href="hero.jpg">
//    - img 添加 fetchpriority="high"
// 2. 使用 CDN 加速
// 3. 服务端渲染 (SSR) / 静态生成 (SSG)
// 4. 优化 CSS 阻塞 (内联关键 CSS)
// 5. 图片格式优化 (WebP/AVIF)

// === INP (Interaction to Next Paint) ===
// 定义：用户交互到下一帧渲染完成的时间
// 目标：< 200ms
// 替代了 FID，覆盖所有交互而非仅首次

const inpObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // entry.processingStart - entry.startTime = 输入延迟
    // entry.duration = 总交互时间
    // entry.processingEnd - entry.processingStart = 处理时间
    // entry.displayDuration = 渲染时间
    console.log('Interaction:');
    console.log(`  Type: ${entry.name}`); // click, keydown, etc.
    console.log(`  Duration: ${entry.duration}ms`);
    console.log(`  Processing: ${entry.processingEnd - entry.processingStart}ms`);
    console.log(`  Target: ${entry.target?.tagName}`);
  }
});
inpObserver.observe({ type: 'interaction', buffered: true });

// INP 优化策略：
// 1. 减少主线程工作 (拆分长任务)
// 2. 使用 Web Worker offload 计算
// 3. 优化事件处理函数 (减少同步工作)
// 4. 使用 requestAnimationFrame 优化渲染
// 5. 减少 DOM 操作频率

// === CLS (Cumulative Layout Shift) ===
// 定义：页面生命周期内所有意外布局偏移的分数总和
// 目标：< 0.1
// 分数 = 影响分数 × 距离分数

const clsObserver = new PerformanceObserver((list) => {
  let clsValue = 0;
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) { // 排除用户输入导致的布局偏移
      clsValue += entry.value;
      console.log('Layout Shift:', {
        value: entry.value,
        sources: entry.sources?.map(s => s.node?.nodeName),
      });
    }
  }
  console.log('Total CLS:', clsValue);
});
clsObserver.observe({ type: 'layout-shift', buffered: true });

// CLS 优化策略：
// 1. 图片/视频设置明确尺寸 (width/height 或 aspect-ratio)
// 2. 字体加载时使用 font-display: optional 或 swap
// 3. 动态内容预留空间 (骨架屏/占位符)
// 4. 避免在现有内容上方插入内容
// 5. 动画使用 transform 而非改变布局属性

// === 综合监测脚本 ===
function monitorWebVitals() {
  const metrics = { LCP: 0, INP: 0, CLS: 0, FCP: 0, TTFB: 0 };

  // LCP
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    metrics.LCP = entries[entries.length - 1]?.renderTime || 0;
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  // INP
  let interactions = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      interactions.push(entry);
    }
    // INP = 第 98 百分位的交互延迟
    interactions.sort((a, b) => b.duration - a.duration);
    const p98Index = Math.floor(interactions.length * 0.98);
    metrics.INP = interactions[p98Index]?.duration || 0;
  }).observe({ type: 'interaction', buffered: true });

  // CLS
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) metrics.CLS += entry.value;
    }
  }).observe({ type: 'layout-shift', buffered: true });

  // FCP
  new PerformanceObserver((list) => {
    metrics.FCP = list.getEntries()[0]?.startTime || 0;
  }).observe({ type: 'paint', buffered: true });

  // TTFB
  new PerformanceObserver((list) => {
    metrics.TTFB = list.getEntries()[0]?.responseStart || 0;
  }).observe({ type: 'navigation', buffered: true });

  // 定期上报
  setInterval(() => {
    console.table(metrics);
    // navigator.sendBeacon('/analytics', JSON.stringify(metrics));
  }, 5000);

  return metrics;
}
```

### 2.5 性能预算与自动化检测

```javascript
// 性能预算：为关键性能指标设定上限，超出则告警

class PerformanceBudget {
  constructor(budgets = {}) {
    this.budgets = {
      lcp: 2500,           // LCP < 2.5s
      inp: 200,            // INP < 200ms
      cls: 0.1,            // CLS < 0.1
      fcp: 1800,           // FCP < 1.8s
      ttfb: 800,           // TTFB < 800ms
      tti: 3800,           // TTI < 3.8s
      totalJs: 500000,     // JS 总体积 < 500KB
      totalCss: 100000,    // CSS 总体积 < 100KB
      totalImages: 500000, // 图片总体积 < 500KB
      requests: 50,        // 请求数 < 50
      longTasks: 0,        // 长任务数 = 0
      ...budgets,
    };
    this.violations = [];
  }

  check(name, value) {
    const budget = this.budgets[name];
    if (budget === undefined) return true;
    const passed = value <= budget;
    if (!passed) {
      this.violations.push({
        metric: name,
        value,
        budget,
        delta: value - budget,
        timestamp: Date.now(),
      });
      console.warn(`⚠️ Performance Budget 违规: ${name} = ${value} (预算: ${budget})`);
    }
    return passed;
  }

  // 从 Performance API 收集指标并检查
  async audit() {
    // 导航指标
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
      this.check('ttfb', nav.responseStart);
      this.check('domContentLoaded', nav.domContentLoadedEventEnd);
      this.check('load', nav.loadEventEnd);
    }

    // Paint 指标
    const paints = performance.getEntriesByType('paint');
    paints.forEach(p => {
      if (p.name === 'first-contentful-paint') {
        this.check('fcp', p.startTime);
      }
    });

    // 资源指标
    const resources = performance.getEntriesByType('resource');
    let totalJs = 0, totalCss = 0, totalImages = 0;
    resources.forEach(r => {
      if (r.initiatorType === 'script') totalJs += r.transferSize;
      if (r.initiatorType === 'css') totalCss += r.transferSize;
      if (r.initiatorType === 'img') totalImages += r.transferSize;
    });
    this.check('totalJs', totalJs);
    this.check('totalCss', totalCss);
    this.check('totalImages', totalImages);
    this.check('requests', resources.length);

    // 长任务
    const longTasks = performance.getEntriesByType('longtask');
    this.check('longTasks', longTasks.length);

    return {
      passed: this.violations.length === 0,
      violations: this.violations,
      budgets: this.budgets,
    };
  }

  // 生成报告
  report() {
    const passed = this.violations.length === 0;
    console.log(`\n${passed ? '✅' : '❌'} 性能预算审计结果`);
    console.log(`通过: ${Object.keys(this.budgets).length - this.violations.length}/${Object.keys(this.budgets).length}`);
    if (this.violations.length > 0) {
      console.table(this.violations.map(v => ({
        指标: v.metric,
        实际值: v.value,
        预算: v.budget,
        超出: `${((v.delta / v.budget) * 100).toFixed(1)}%`,
      })));
    }
    return passed;
  }
}

// 使用示例
const budget = new PerformanceBudget({
  lcp: 2000,  // 自定义更严格的预算
  requests: 30,
});

// 页面加载后审计
window.addEventListener('load', async () => {
  const result = await budget.audit();
  budget.report();

  // 如果违规，可以阻止部署或发送告警
  if (!result.passed) {
    // fetch('/api/alert', { method: 'POST', body: JSON.stringify(result) });
  }
});
```

---

## 3. Memory 面板高级追踪

### 3.1 Heap Snapshot 高级对比技巧

```javascript
// 内存泄漏的经典模式与 Heap Snapshot 检测方法

// === 模式 1: 意外全局变量 ===
function processData(items) {
  // ❌ 错误：忘记 var/let/const，变成全局变量
  cachedData = items.map(item => ({
    ...item,
    processed: true,
    timestamp: Date.now(),
  }));

  // ✅ 正确：使用 let/const
  const cachedData = items.map(item => ({
    ...item,
    processed: true,
    timestamp: Date.now(),
  }));
}

// Heap Snapshot 检测：
// 1. 操作前拍快照 → 操作后拍快照
// 2. 对比模式选择 "Comparison"
// 3. 查看 "(Native Objects)" 或 "Array" 新增数量
// 4. 在 Retainers 面板查看引用链
// 5. 如果引用链顶端是 "window" → 全局变量泄漏

// === 模式 2: 未清理的定时器 ===
class AutoUpdater {
  constructor(element, url) {
    this.element = element;
    this.url = url;
    // ❌ 组件销毁时未清理定时器
    this.timer = setInterval(async () => {
      const data = await fetch(url).then(r => r.json());
      this.element.textContent = JSON.stringify(data);
    }, 5000);
  }

  // ✅ 添加销毁方法
  destroy() {
    clearInterval(this.timer);
    this.element = null; // 解除 DOM引用
  }
}

// Heap Snapshot 检测：
// 1. 创建/销毁组件多次
// 2. 拍快照，筛选 "Interval" 或 "Timer"
// 3. 查看是否有已 "销毁" 组件的定时器仍在
// 4. 通过 Retainers 查看定时器持有哪些对象

// === 模式 3: 闭包引用 ===
function createHandler() {
  const largeData = new Array(1000000).fill('x'); // 1MB 数据

  return function() {
    // 闭包引用了 largeData
    // 即使 handler 不需要 largeData，它也被保留在内存中
    console.log('Handler called');
  };
}

const handler = createHandler();
document.getElementById('btn').addEventListener('click', handler);
// 即使按钮被移除，handler 仍在，largeData 也仍在

// ✅ 修复：将 largeData 移出闭包范围
function createHandler() {
  return function() {
    console.log('Handler called');
  };
}

// === 模式 4: DOM引用残留 ===
class Component {
  constructor(id) {
    this.element = document.getElementById(id);
    this.children = [];
    this.data = null;
  }

  render(data) {
    this.data = data; // 持有数据引用
    this.element.innerHTML = this.buildHTML(data);
  }

  // ❌ 销毁时未清理引用
  unmount() {
    this.element.remove();
    // this.element, this.children, this.data 仍然被 this 持有
    // 如果 this 被其他地方引用 → 内存泄漏
  }

  // ✅ 正确清理
  destroy() {
    this.element?.remove();
    this.element = null;
    this.children = null;
    this.data = null;
  }
}

// === 模式 5: 事件监听器未移除 ===
class EventManager {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  // ❌ 没有 off/remove 方法
  // ✅ 添加清理方法
  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    }
  }

  removeAll() {
    this.listeners.clear();
  }
}

// === 模式 6: Cache 无限增长 ===
class APICache {
  constructor() {
    this.cache = new Map();
    // ❌ 没有大小限制，没有过期机制
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    this.cache.set(key, value); // 无限增长！
  }

  // ✅ LRU Cache 实现
  static createLRUCache(maxSize = 100, maxAge = 5 * 60 * 1000) {
    return new class LRUCache {
      constructor() {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.maxAge = maxAge;
      }

      get(key) {
        const entry = this.cache.get(key);
        if (!entry) return undefined;
        if (Date.now() - entry.timestamp > this.maxAge) {
          this.cache.delete(key);
          return undefined;
        }
        // 移到末尾 (最近使用)
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.value;
      }

      set(key, value) {
        if (this.cache.has(key)) {
          this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
          // 删除最旧的 (Map 保持插入顺序)
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
        this.cache.set(key, { value, timestamp: Date.now() });
      }

      clear() {
        this.cache.clear();
      }

      get size() {
        return this.cache.size;
      }
    };
  }
}
```

### 3.2 Allocation Timeline 与 Allocation Sampling

```javascript
// Allocation Timeline: 实时显示内存分配，精确定位分配来源

// 使用场景：
// 1. 找到频繁分配内存的代码位置
// 2. 识别不必要的对象创建
// 3. 优化 GC 压力

// 示例：频繁创建临时对象
function processRecords(records) {
  return records.map(record => {
    // ❌ 每次循环都创建新的格式化函数
    const format = (val) => `$${val.toFixed(2)}`;
    const formatName = (name) => name.toUpperCase();

    return {
      id: record.id,
      price: format(record.price),
      name: formatName(record.name),
      timestamp: new Date().toISOString(), // 每次都创建 Date 对象
    };
  });
}

// ✅ 优化：提取不变的部分
const format = (val) => `$${val.toFixed(2)}`;
const formatName = (name) => name.toUpperCase();
const now = new Date().toISOString(); // 只创建一次

function processRecordsOptimized(records) {
  return records.map(record => ({
    id: record.id,
    price: format(record.price),
    name: formatName(record.name),
    timestamp: now,
  }));
}

// Allocation Sampling: 按采样间隔记录分配
// 在 Memory 面板选择 "Allocation sampling"
// 设置采样间隔 (默认 10KB)
// 结果按调用栈分组，显示每个位置的分配量

// 使用场景：
// - 找到内存分配的 "热点" 代码
// - 对比优化前后的分配量变化
// - 识别不必要的中间对象
```

### 3.3 内存泄漏自动化检测

```javascript
// 自动化内存泄漏检测工具

class MemoryLeakDetector {
  constructor(options = {}) {
    this.threshold = options.threshold || 10 * 1024 * 1024; // 10MB
    this.checkInterval = options.checkInterval || 5000; // 5s
    this.history = [];
    this.alertCallbacks = [];
    this.running = false;
  }

  // 获取当前内存使用 (Chrome only)
  getMemoryInfo() {
    if (performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      };
    }
    return null;
  }

  // 开始监控
  start() {
    this.running = true;
    this.intervalId = setInterval(() => {
      const info = this.getMemoryInfo();
      if (!info) return;

      this.history.push({
        time: Date.now(),
        ...info,
      });

      // 保留最近 60 个数据点
      if (this.history.length > 60) {
        this.history.shift();
      }

      // 检测趋势：如果连续 5 次增长且超过阈值
      this.detectLeak();
    }, this.checkInterval);
  }

  detectLeak() {
    if (this.history.length < 5) return;

    const recent = this.history.slice(-5);
    const isGrowing = recent.every((v, i, arr) =>
      i === 0 || v.usedJSHeapSize > arr[i - 1].usedJSHeapSize
    );

    const growth = recent[recent.length - 1].usedJSHeapSize - recent[0].usedJSHeapSize;

    if (isGrowing && growth > this.threshold) {
      const alert = {
        type: 'memory_leak_suspected',
        growth: `${(growth / 1024 / 1024).toFixed(2)}MB`,
        current: `${(recent[recent.length - 1].usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        trend: recent.map(r => `${(r.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`),
      };

      this.alertCallbacks.forEach(cb => cb(alert));
      console.error('🚨 疑似内存泄漏!', alert);
    }
  }

  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  stop() {
    this.running = false;
    clearInterval(this.intervalId);
  }

  // 生成内存趋势报告
  report() {
    if (this.history.length < 2) return '数据不足';

    const first = this.history[0];
    const last = this.history[this.history.length - 1];
    const growth = last.usedJSHeapSize - first.usedJSHeapSize;
    const growthPercent = ((growth / first.usedJSHeapSize) * 100).toFixed(1);

    return `
内存趋势报告:
  起始: ${(first.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB
  当前: ${(last.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB
  增长: ${(growth / 1024 / 1024).toFixed(2)}MB (${growthPercent}%)
  数据点: ${this.history.length}
`;
  }
}

// 使用示例
const detector = new MemoryLeakDetector({
  threshold: 5 * 1024 * 1024, // 5MB
  checkInterval: 3000,
});

detector.onAlert((alert) => {
  // 发送告警到监控系统
  // navigator.sendBeacon('/api/alert', JSON.stringify(alert));
});

detector.start();

// SPA 路由切换时主动检测
class SPAMemoryMonitor {
  constructor() {
    this.snapshots = [];
  }

  takeSnapshot(label) {
    this.snapshots.push({
      label,
      time: Date.now(),
      memory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
      } : null,
      domNodes: document.querySelectorAll('*').length,
      eventListeners: this.countEventListeners(),
    });
  }

  countEventListeners() {
    // 近似估算 (无法精确统计)
    return performance.getEntriesByType('resource').length;
  }

  compareSnapshots(label1, label2) {
    const s1 = this.snapshots.find(s => s.label === label1);
    const s2 = this.snapshots.find(s => s.label === label2);
    if (!s1 || !s2) return null;

    return {
      domGrowth: s2.domNodes - s1.domNodes,
      memoryGrowth: s2.memory?.usedJSHeapSize - s1.memory?.usedJSHeapSize,
    };
  }
}
```

### 3.4 第三方库内存泄漏检测

```javascript
// 常见第三方库的内存泄漏陷阱

// === Vue 2 组件未销毁 ===
// Vue 2 中，手动创建的实例需要手动销毁
// ❌ 泄漏：
function createToast(message) {
  const ToastComponent = Vue.extend({
    template: `<div class="toast">{{ message }}</div>`,
    data() {
      return { message };
    },
  });
  const instance = new ToastComponent().$mount();
  document.body.appendChild(instance.$el);
  // 3 秒后移除 DOM，但 Vue 实例未销毁
  setTimeout(() => {
    instance.$el.remove();
    // ❌ 缺少 instance.$destroy()
  }, 3000);
}

// ✅ 正确：
function createToastFixed(message) {
  const ToastComponent = Vue.extend({
    template: `<div class="toast">{{ message }}</div>`,
    data() {
      return { message };
    },
  });
  const instance = new ToastComponent().$mount();
  document.body.appendChild(instance.$el);
  setTimeout(() => {
    instance.$el.remove();
    instance.$destroy(); // ✅ 销毁 Vue 实例
  }, 3000);
}

// === ECharts 实例未销毁 ===
// ❌ 泄漏：
function renderChart(container, option) {
  const chart = echarts.init(container);
  chart.setOption(option);
  // 容器被移除时，chart 实例仍在内存中
}

// ✅ 正确：
function renderChartFixed(container, option) {
  const chart = echarts.init(container);
  chart.setOption(option);

  // 监听容器移除
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.removedNodes.length > 0) {
        for (const node of mutation.removedNodes) {
          if (node === container) {
            chart.dispose(); // ✅ 销毁 ECharts 实例
            observer.disconnect();
          }
        }
      }
    }
  });
  observer.observe(container.parentNode, { childList: true });
}

// === 第三方 SDK 事件监听 ===
// 很多 SDK 在 window/document 上绑定事件
// 单页应用中切换页面时需要手动清理
const sdkCleanupFns = new Map();

function loadSDK(name, initFn) {
  const cleanup = initFn();
  if (typeof cleanup === 'function') {
    sdkCleanupFns.set(name, cleanup);
  }
}

function unloadSDK(name) {
  const cleanup = sdkCleanupFns.get(name);
  if (cleanup) {
    cleanup();
    sdkCleanupFns.delete(name);
  }
}

// 路由切换时
router.beforeEach((to, from) => {
  // 清理当前页面的 SDK
  const currentSDKs = getSDKsForRoute(from.path);
  currentSDKs.forEach(name => unloadSDK(name));
  return true;
});
```

---

## 4. Sources 面板高级调试

### 4.1 异步调试：Promise / async/await / Generator

```javascript
// === async/await 调试 ===
// Sources 面板中，async 函数的 await 会显示为 "async function" 帧
// 调用栈会显示完整的异步调用链 (包括 await 前后的帧)

async function fetchUserData(userId) {
  // 在这里设置断点
  const user = await api.getUser(userId);     // ← 断点停在这里
  const posts = await api.getUserPosts(userId);
  const comments = await api.getUserComments(userId);

  return { user, posts, comments };
}

// 调试技巧：
// 1. 在 await 行设置断点 → 单步进入会进入 Promise 内部
// 2. 单步跳过 → 等待 Promise resolve 后停在下一行
// 3. 调用栈面板会显示 "async" 帧，可以看到完整的异步链

// === Promise 链调试 ===
function processWithPromises() {
  return fetch('/api/data')
    .then(response => {
      // 在 then 回调中设置断点
      return response.json();
    })
    .then(data => {
      // 每个 then 都是独立的调用帧
      return transform(data);
    })
    .catch(error => {
      // catch 也是独立的帧
      console.error(error);
    });
}

// === Generator 调试 ===
function* dataProcessor() {
  const data1 = yield fetch('/api/data1').then(r => r.json());
  // ← 断点停在这里，value 是 Promise
  const data2 = yield fetch('/api/data2').then(r => r.json());
  // ← 再次停在这里
  const data3 = yield fetch('/api/data3').then(r => r.json());

  return { data1, data2, data3 };
}

// Generator 调试技巧：
// 1. 每次 yield 都会暂停
// 2. 调用栈显示 Generator 帧
// 3. Scope 面板可以看到 yield 的值

// === 调试 Promise 内部 ===
// Chrome DevTools 可以进入 Promise 内部调试：
// 1. 在 Promise executor 中设置断点
// 2. 单步进入 (F11) 会进入 Promise 内部
// 3. 可以在 resolve/reject 处设置断点

const myPromise = new Promise((resolve, reject) => {
  // 在这里设置断点，可以调试 Promise 创建过程
  setTimeout(() => {
    resolve('done');
  }, 1000);
});

// === 黑盒脚本 (Blackbox Scripts) 在异步调试中的应用 ===
// 单步进入 async/await 时，会进入 V8 的 Promise 实现代码
// 使用黑盒脚本可以跳过这些内部代码：
// 1. 在调用栈中右键 V8 内部帧 → "Blackbox script"
// 2. 或 Settings → Blackbox 添加模式 (如 "v8\.js", "node_modules")
// 3. 之后单步进入会自动跳过黑盒化的代码
```

### 4.2 条件断点高级用法

```javascript
// === 条件断点：复杂条件 ===
class EventBus {
  emit(event, data) {
    // 条件断点：只在特定事件 + 特定数据时暂停
    // 条件: event === 'user:updated' && data.role === 'admin'
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}

// === 日志点：格式化输出 ===
// 日志点支持格式化：
// `🔍 User: ${user.name}, Action: ${action}, Time: ${new Date().toISOString()}`

// === 条件断点：性能分析 ===
// 在热点代码设置条件断点，只在特定条件下暂停
// 避免频繁暂停影响性能

function renderList(items) {
  items.forEach((item, index) => {
    // 条件断点：只在渲染第 100-200 项时暂停
    // 条件: index >= 100 && index <= 200
    renderItem(item);
  });
}

// === 条件断点：循环检测 ===
// 检测无限循环或异常循环次数
function processQueue() {
  let count = 0;
  while (queue.length > 0) {
    // 条件断点：循环超过 10000 次时暂停 (检测无限循环)
    // 条件: ++count > 10000
    const item = queue.shift();
    process(item);
  }
}
```

### 4.3 DOM 断点高级应用

```javascript
// === DOM 断点：精确追踪 DOM 变化来源 ===

// 场景 1: 追踪未知脚本修改 DOM
// 问题：页面上某个元素的 class 被意外修改，但不知道是哪段代码
// 解决：在元素上设置 "attributes modifications" 断点

const targetEl = document.getElementById('mystery-element');
// Elements 面板 → 右键 → Break on → attributes modifications
// 任何修改 class/style/attribute 的代码都会触发暂停

// 场景 2: 追踪 iframe 内容变化
// 问题：跨域 iframe 的内容在变化，但无法直接调试
// 解决：在 iframe 元素上设置 "subtree modifications" 断点
// 注意：跨域 iframe 需要切换到 iframe 的上下文

// 场景 3: 追踪动态加载的组件
// 问题：组件库动态插入 DOM，不知道插入逻辑
const container = document.getElementById('component-root');
// Elements 面板 → 右键 → Break on → subtree modifications
// 每次子节点变化都会暂停，Call Stack 显示插入来源

// 场景 4: 追踪节点移除
// 问题：元素突然消失，不知道被谁移除
const modal = document.getElementById('important-modal');
// Elements 面板 → 右键 → Break on → node removal
// 节点被 remove() 或 innerHTML 清空时会暂停
```

### 4.4 调试 Source Map 与多框架集成

```javascript
// === Source Map 配置 ===
// Sources 面板 → Settings → Navigator → 确认 Source Map 已启用

// Webpack 配置：
module.exports = {
  devtool: 'source-map', // 或 'eval-source-map' (更快但精度略低)
  // 其他配置...
};

// Vite 配置：
export default {
  build: {
    sourcemap: true, // 或 'inline'
  },
};

// === 调试压缩后的代码 ===
// 即使没有 Source Map，也可以使用 "Pretty Print" 功能：
// 1. 在 Sources 面板打开压缩文件
// 2. 点击底部的 "{}" 按钮 (Pretty Print)
// 3. 代码会被格式化，可以设置断点

// === 调试 TypeScript ===
// TS 编译后会自动生成 Source Map
// DevTools 会自动映射回 TS 源码
// 可以直接在 .ts 文件中设置断点

// === 调试 JSX/TSX ===
// React/Vue 组件编译后也可以映射回 JSX/TSX
// 在 Sources 面板中可以看到原始组件代码

// === 调试 Webpack 打包后的代码 ===
// Webpack 打包后的代码结构：
// (function(modules) {
//   // webpackBootstrap
//   function __webpack_require__(moduleId) { ... }
//   return __webpack_require__(__webpack_require__.s = 0);
// })({
//   0: function(module, exports, __webpack_require__) { ... },
//   1: function(module, exports, __webpack_require__) { ... },
// });

// Sources 面板中，Webpack 打包的代码会显示为 "(webpack)" 目录
// 展开后可以看到原始模块

// === 调试 Node.js 后端代码 ===
// 启动 Node.js 时添加 --inspect 标志：
// node --inspect=0.0.0.0:9229 server.js
//
// 然后在 Chrome 中打开 chrome://inspect
// 可以看到远程 Node.js 实例
// 点击 "inspect" 即可调试

// === 调试 Service Worker ===
// Application 面板 → Service Workers
// 可以看到 SW 状态，点击 "inspect" 打开 SW 的 DevTools
// Sources 面板中可以设置断点调试 SW 代码

// === 调试 Web Worker ===
// 1. 打开 chrome://inspect
// 2. 找到 "Other" 部分下的 Worker
// 3. 点击 "inspect" 打开 Worker 的 DevTools
// 或者：
// 在 Worker 内部添加 debugger; 语句
// 会自动打开 Worker 的 DevTools
```

### 4.5 调试工作流：从问题到修复

```javascript
// === 完整调试工作流 ===

// 场景：用户报告 "点击按钮后页面卡死"

// Step 1: 复现问题
// 1. 打开 DevTools → Performance 面板
// 2. 点击录制，操作复现问题
// 3. 停止录制，查看火焰图
// 发现：一个 2 秒的长任务，函数名为 "calculateRecommendations"

// Step 2: 定位问题代码
// 1. 在火焰图中点击 "calculateRecommendations"
// 2. 右侧显示源码位置: app.js:245
// 3. 在 Sources 面板打开 app.js，定位到 245 行

// Step 3: 设置断点调试
// 1. 在 245 行设置断点
// 2. 重新操作，触发断点
// 3. 查看 Scope 面板中的变量值
// 发现：recommendations 数组有 100000 个元素

// Step 4: 分析调用栈
// 1. 查看 Call Stack 面板
// 发现：calculateRecommendations 被 "onUserScroll" 调用
// 每次滚动都重新计算 → 性能问题

// Step 5: 修复问题
// 原始代码：
function onUserScroll() {
  const recommendations = calculateRecommendations(user, allProducts);
  renderRecommendations(recommendations);
}

// 修复后：
let recommendationsCache = null;
let lastUserId = null;

function onUserScroll() {
  // 缓存推荐结果
  if (recommendationsCache && lastUserId === user.id) {
    renderRecommendations(recommendationsCache);
    return;
  }

  // 防抖：避免频繁计算
  debouncedCalculate();
}

const debouncedCalculate = debounce(() => {
  recommendationsCache = calculateRecommendations(user, allProducts);
  lastUserId = user.id;
  renderRecommendations(recommendationsCache);
}, 300);

// Step 6: 验证修复
// 1. 重新录制 Performance
// 2. 确认长任务消失
// 3. 确认 FPS 稳定在 60

// Step 7: 添加回归检测
// 使用 PerformanceObserver 监控长任务
const longTaskObserver = new PerformanceObserver((list) => {
  list.getEntries().forEach(entry => {
    if (entry.name === 'longtask') {
      // 上报到监控系统
      reportPerformanceIssue('longtask', {
        duration: entry.duration,
        url: window.location.href,
        timestamp: Date.now(),
      });
    }
  });
});
longTaskObserver.observe({ entryTypes: ['longtask'] });
```

---

## 5. 远程调试与移动端调试

### 5.1 Android 设备远程调试

```
Android 设备远程调试配置：

1. 手机开启开发者选项 + USB 调试
2. 用 USB 连接电脑
3. Chrome 打开 chrome://usb (自动检测)
   或 chrome://inspect → 勾选 "Discover USB devices"
4. 手机上打开 Chrome，访问目标页面
5. 在 chrome://inspect 中找到设备 → 点击 "inspect"

替代方案 (无线调试)：
1. 手机和电脑在同一 WiFi
2. chrome://inspect → Port forwarding
3. 添加端口转发规则 (如 9222 → localhost:9222)
4. 手机上 Chrome 地址栏输入:
   chrome://inspect/#devices
5. 或在 adb 中设置:
   adb reverse tcp:9222 tcp:9222
```

### 5.2 iOS 设备远程调试

```
iOS Safari 远程调试配置：

1. iPhone/iPad: 设置 → Safari → 高级 → Web 检查器 (开启)
2. Mac: Safari → 偏好设置 → 高级 → 在菜单栏显示"开发"菜单
3. 用 USB 连接 iPhone 到 Mac
4. Safari 菜单栏 → 开发 → [设备名称] → [目标页面]
5. 打开 Web Inspector

注意：
- 需要 Mac (Windows 不支持 iOS 远程调试)
- iOS 16.4+ 支持无线调试 (同一 WiFi)
- 也可以使用 Chrome 打开目标页面，但调试需用 Safari
```

### 5.3 模拟器与设备模拟

```javascript
// === DevTools 设备模拟 ===
// Ctrl+Shift+M 打开设备模拟
// 可以模拟：
// - 设备型号 (iPhone, iPad, Pixel, etc.)
// - 屏幕尺寸和 DPR
// - 网络条件 (Fast 3G, Slow 3G, Offline)
// - CPU 节流 (4x slowdown, 6x slowdown)
// - 触摸事件
// - 地理位置
// - 传感器 (陀螺仪/加速计)

// === 网络条件模拟 ===
// Network 面板 → 下拉菜单选择：
// - Online: 无限制
// - Fast 3G: 1.6 Mbps down / 750 Kbps up, 150ms RTT
// - Slow 3G: 400 Kbps down / 400 Kbps up, 400ms RTT
// - Fast 4G: 9 Mbps down / 9 Mbps up, 170ms RTT
// - Offline: 无网络

// 自定义网络条件：
// Network 面板 → 下拉菜单 → "Add..."
// 设置：Download/Upload/RTT/Disable cache

// === CPU 节流 ===
// Performance 面板录制时：
// 右上角 "CPU" 下拉菜单：
// - No throttling
// - 4x slowdown
// - 6x slowdown

// 模拟低端设备性能
// 对于测试性能优化效果非常有用

// === 地理位置模拟 ===
// 按 Esc 打开 Drawer → Sensors 面板
// 可以模拟：
// - 经纬度
// - 海拔
// - 精度

// === 传感器模拟 ===
// Sensors 面板可以模拟：
// - Device Orientation (alpha/beta/gamma)
// - Accelerometer (x/y/z)
// - Gyroscope (x/y/z)
// - Magnetic Field (x/y/z)
```

### 5.4 远程调试生产环境

```javascript
// === 生产环境调试策略 ===

// 策略 1: VConsole / Eruda (移动端调试面板)
// 在移动端无法连接 DevTools 时的替代方案

// VConsole (腾讯开源)
// <script src="https://unpkg.com/vconsole@latest/dist/vconsole.min.js"></script>
// <script>new VConsole()</script>

// Eruda (更轻量)
// <script src="https://unpkg.com/eruda"></script>
// <script>eruda.init()</script>

// 策略 2: 远程日志上报
class RemoteLogger {
  constructor(options = {}) {
    this.endpoint = options.endpoint || '/api/logs';
    this.maxQueueSize = options.maxQueueSize || 100;
    this.flushInterval = options.flushInterval || 5000;
    this.queue = [];
    this.enabled = options.enabled !== false;

    if (this.enabled) {
      this.installConsoleOverride();
      this.startFlushTimer();
      this.installErrorHandlers();
    }
  }

  installConsoleOverride() {
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
    };

    const levels = ['log', 'warn', 'error', 'info'];
    levels.forEach(level => {
      console[level] = (...args) => {
        originalConsole[level].apply(console, args);
        this.queue.push({
          level,
          message: args.map(a => String(a)).join(' '),
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        });
        if (this.queue.length >= this.maxQueueSize) {
          this.flush();
        }
      };
    });
  }

  installErrorHandlers() {
    window.addEventListener('error', (event) => {
      this.queue.push({
        level: 'error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: Date.now(),
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.queue.push({
        level: 'error',
        message: `Unhandled Promise: ${event.reason}`,
        timestamp: Date.now(),
      });
    });
  }

  startFlushTimer() {
    setInterval(() => this.flush(), this.flushInterval);
  }

  async flush() {
    if (this.queue.length === 0) return;
    const logs = this.queue.splice(0, this.maxQueueSize);
    try {
      navigator.sendBeacon(this.endpoint, JSON.stringify(logs));
    } catch (e) {
      // 静默失败
    }
  }
}

// 使用：仅在特定条件下启用 (如 URL 参数)
if (new URLSearchParams(location.search).get('debug') === '1') {
  const logger = new RemoteLogger({
    endpoint: '/api/logs',
    maxQueueSize: 50,
  });
}

// 策略 3: Sentry / Bugsnag 等错误追踪服务
// 自动捕获错误 + 性能数据 + 用户行为
// 提供完整的错误上下文 (堆栈/用户/设备/网络)

// 策略 4: Replay 工具 (LogRocket/Sentry Replay)
// 录制用户操作 + 网络请求 + DOM 变化
// 可以"回放"用户遇到的问题
```

---

## 6. 自动化性能审计与 CI 集成

### 6.1 Lighthouse CI 集成

```javascript
// === Lighthouse CI (LHCI) 配置 ===
// 在 CI 流程中自动运行 Lighthouse 审计

// .lighthouserc.js
module.exports = {
  ci: {
    collect: {
      // 启动本地服务器
      startServerCommand: 'npm start',
      startServerReadyPattern: 'listening',
      startServerReadyTimeout: 60000,
      // 要审计的 URL
      url: ['http://localhost:3000', 'http://localhost:3000/about'],
      // 模拟条件
      settings: {
        formFactor: 'desktop',
        throttlingMethod: 'simulate',
      },
    },
    assert: {
      // 性能断言
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'interactive': ['error', { maxNumericValue: 3800 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'speed-index': ['error', { maxNumericValue: 3400 }],
        // 资源大小断言
        'resource-summary:document:count': ['warn', { maxNumericValue: 1 }],
        'resource-summary:script:count': ['warn', { maxNumericValue: 50 }],
        'resource-summary:stylesheet:count': ['warn', { maxNumericValue: 10 }],
        'resource-summary:image:count': ['warn', { maxNumericValue: 30 }],
      },
    },
    upload: {
      // 上传结果到 LHCI 服务器
      target: 'lhci',
      url: 'https://lhci.your-company.com',
    },
  },
};

// GitHub Actions 集成：
// .github/workflows/lighthouse.yml
/*
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm install -g @lhci/cli@0.11.x
      - run: lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
*/
```

### 6.2 Puppeteer 自动化性能测试

```javascript
// === Puppeteer 自动化性能测试 ===
// 使用 Puppeteer 编写自定义性能测试脚本

const puppeteer = require('puppeteer');

async function runPerformanceTest(url) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // 模拟移动端
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });

  // 模拟慢速网络
  const client = await page.target().createCDPSession();
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps
    uploadThroughput: (750 * 1024) / 8, // 750 Kbps
    latency: 150, // ms
  });

  // 开始性能追踪
  await page.tracing.start({
    path: 'trace.json',
    categories: [
      'devtools.timeline',
      'blink.console',
      'loading.timeline',
      'perfetto',
    ],
  });

  // 导航到页面
  const startTime = Date.now();
  await page.goto(url, { waitUntil: 'networkidle0' });
  const loadTime = Date.now() - startTime;

  // 停止追踪
  await page.tracing.stop();

  // 收集性能指标
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      const results = {};

      // Navigation Timing
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav) {
        results.fcp = nav.domContentLoadedEventEnd - nav.startTime;
        results.domReady = nav.domContentLoadedEventEnd - nav.startTime;
        results.load = nav.loadEventEnd - nav.startTime;
        results.ttfb = nav.responseStart - nav.requestStart;
      }

      // Paint Timing
      const paints = performance.getEntriesByType('paint');
      paints.forEach(p => {
        if (p.name === 'first-contentful-paint') {
          results.fcp = p.startTime;
        }
      });

      // Resource Timing
      const resources = performance.getEntriesByType('resource');
      results.resourceCount = resources.length;
      results.totalTransferSize = resources.reduce(
        (sum, r) => sum + r.transferSize,
        0
      );

      resolve(results);
    });
  });

  // LCP
  const lcp = await page.evaluate(() => {
    return new Promise((resolve) => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        resolve(entries[entries.length - 1]?.renderTime || 0);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => resolve(0), 1000);
    });
  });

  // CLS
  const cls = await page.evaluate(() => {
    return new Promise((resolve) => {
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) clsValue += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => resolve(clsValue), 1000);
    });
  });

  await browser.close();

  return {
    url,
    loadTime,
    lcp: Math.round(lcp),
    cls: cls.toFixed(3),
    ...metrics,
  };
}

// 批量测试
async function runBatchTest(urls) {
  const results = [];
  for (const url of urls) {
    console.log(`Testing: ${url}`);
    const result = await runPerformanceTest(url);
    results.push(result);
    console.table(result);
  }
  return results;
}

// 使用
// runBatchTest([
//   'https://example.com',
//   'https://example.com/products',
//   'https://example.com/about',
// ]).then(console.table);
```

### 6.3 WebPageTest API 集成

```javascript
// === WebPageTest API ===
// 使用 WebPageTest 进行真实的全球性能测试

const WEBPAGE_TEST_API = 'https://www.webpagetest.org';
const API_KEY = 'your-api-key';

async function runWebPageTest(url, options = {}) {
  const params = new URLSearchParams({
    url,
    k: API_KEY,
    location: options.location || 'Dulles:Chrome',
    connectivity: options.connectivity || 'Cable',
    runs: options.runs || 3,
    video: options.video || 1,
    lighthouse: options.lighthouse || 1,
    webp: options.webp || 1,
    pngss: options.pngss || 1,
    iView: options.iView || '1280x1024',
    f: 'json',
  });

  const response = await fetch(`${WEBPAGE_TEST_API}/runtest?${params}`);
  const data = await response.json();

  if (data.statusCode === 200) {
    const testId = data.data.testId;
    console.log(`Test started: ${testId}`);

    // 轮询等待结果
    return waitForResults(testId);
  }
}

async function waitForResults(testId, maxWait = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const response = await fetch(
      `${WEBPAGE_TEST_API}/test/results/${testId}?f=json`
    );
    const data = await response.json();

    if (data.statusCode === 200 && data.data?.summary) {
      return {
        loadTime: data.data.median.firstView.loadTime,
        ttfb: data.data.median.firstView.TTFB,
        fcp: data.data.median.firstView.fCP,
        lcp: data.data.median.firstView.LCP,
        cls: data.data.median.firstView.cls,
        speedIndex: data.data.median.firstView.speedIndex,
        visualComplete: data.data.median.firstView.visualComplete,
        requests: data.data.median.firstView.requests,
        bytesIn: data.data.median.firstView.bytesIn,
        score: {
          performance: data.data.median.firstView._score_speed,
          seo: data.data.median.firstView._score_seo,
          accessibility: data.data.median.firstView._score_accessibility,
        },
      };
    }

    await new Promise(r => setTimeout(r, 10000)); // 等待 10 秒
  }
  throw new Error('Test timed out');
}

// 使用
// runWebPageTest('https://example.com', {
//   location: 'Dulles:Chrome',
//   connectivity: 'Cable',
//   runs: 3,
// }).then(console.table);
```

---

## 7. 生产级实战演练场

### 7.1 实战一：电商首页性能优化全流程

```javascript
// === 场景：电商首页加载慢 (LCP 4.2s → 目标 < 2.5s) ===

// Step 1: 使用 Performance 面板录制
// 发现问题：
// 1. 主线程被 JS 阻塞 1.8s (vendor.js 1.2MB)
// 2. LCP 元素是 hero 图片，加载时间 2.1s
// 3. 32 个并发请求，CSS 阻塞渲染 800ms
// 4. 布局偏移严重 (CLS 0.35)

// Step 2: 分析问题根源

// 问题 A: 超大 vendor.js
// 使用 Coverage 面板分析：
// Coverage 面板 → 开始录制 → 刷新页面
// 发现：vendor.js 只有 23% 的代码被使用

// 问题 B: Hero 图片未预加载
// Network 面板 → 筛选 "Img"
// 发现：hero.jpg 在 DOMContentLoaded 后才开始请求

// 问题 C: CSS 阻塞
// Network 面板 → 筛选 "CSS"
// 发现：5 个 CSS 文件，总计 380KB，阻塞渲染

// 问题 D: 布局偏移
// Performance 面板 → 查看 "Layout Shift" 事件
// 发现：图片无尺寸 → 加载后挤压文字 → 广告插入 → 内容下移

// Step 3: 实施优化

// 优化 A: 代码分割 + Tree Shaking
// webpack.config.js:
const config = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        common: {
          minChunks: 2,
          chunks: 'all',
          reuseExistingChunk: true,
        },
      },
    },
  },
};

// 优化 B: 预加载 LCP 图片
// HTML:
// <link rel="preload" as="image" href="hero.webp" fetchpriority="high">
// <img src="hero.webp" alt="Hero" fetchpriority="high" width="1200" height="600">

// 优化 C: 内联关键 CSS
// 使用 critical 提取关键 CSS:
// const critical = require('critical');
// critical.generate({
//   inline: true,
//   base: 'dist/',
//   src: 'index.html',
//   dest: 'index.html',
//   extract: false,
//   minify: true,
// });

// 优化 D: 预留空间防 CLS
// CSS:
// .hero-image {
//   aspect-ratio: 2 / 1;
//   object-fit: cover;
// }
// .ad-container {
//   min-height: 250px;
//   background: #f0f0f0;
// }

// Step 4: 验证优化效果
// 重新录制 Performance:
// - LCP: 4.2s → 1.6s ✅
// - FCP: 2.8s → 0.8s ✅
// - CLS: 0.35 → 0.02 ✅
// - TBT: 850ms → 120ms ✅
// - 请求数: 32 → 18 ✅
// - JS 体积: 1.2MB → 280KB ✅
```

### 7.2 实战二：SPA 内存泄漏排查

```javascript
// === 场景：SPA 使用 30 分钟后页面卡顿 ===

// Step 1: 使用 Memory 面板定位

// 1. 拍快照 A (初始状态)
// 2. 模拟用户操作：
//    - 切换 20 次页面
//    - 打开/关闭 50 次弹窗
//    - 加载/卸载 30 次图表组件
// 3. 拍快照 B
// 4. 对比 A vs B (Comparison 模式)

// 发现：
// - Array 数量增长 5000+
// - Object 数量增长 8000+
// - Closure 数量增长 2000+

// Step 2: 深入分析

// 筛选 "Array"，按 delta 排序
// 发现：一个名为 "eventBusListeners" 的 Array 增长最多

// 查看 Retainers:
// eventBusListeners → EventBus → Router → Vue Component
// 问题：路由切换时，旧组件的事件监听器未清理

// Step 3: 定位代码

// 问题代码：
// RouterView.vue
// export default {
//   mounted() {
//     eventBus.on('data:update', this.handleDataUpdate);
//     eventBus.on('user:change', this.handleUserChange);
//   },
//   // ❌ 缺少 beforeDestroy 钩子
// };

// Step 4: 修复

// ✅ 修复：
// export default {
//   mounted() {
//     this.bindEvents();
//   },
//   beforeDestroy() {
//     this.unbindEvents();
//   },
//   methods: {
//     bindEvents() {
//       eventBus.on('data:update', this.handleDataUpdate);
//       eventBus.on('user:change', this.handleUserChange);
//     },
//     unbindEvents() {
//       eventBus.off('data:update', this.handleDataUpdate);
//       eventBus.off('user:change', this.handleUserChange);
//     },
//   },
// };

// 或者使用 Vue 3 Composition API:
// import { onMounted, onUnmounted } from 'vue';
// onMounted(() => {
//   eventBus.on('data:update', handleDataUpdate);
// });
// onUnmounted(() => {
//   eventBus.off('data:update', handleDataUpdate);
// });

// Step 5: 验证修复
// 1. 重新执行相同操作
// 2. 拍快照 C
// 3. 对比 A vs C
// 4. Array/Object/Closure 数量基本不变 ✅

// Step 6: 添加自动化检测
// 在测试中集成内存检测:
// describe('Memory leak tests', () => {
//   it('should not leak memory after route changes', async () => {
//     const initial = performance.memory?.usedJSHeapSize || 0;
//     for (let i = 0; i < 20; i++) {
//       await router.push(`/page/${i % 5}`);
//       await flushPromises();
//     }
//     const final = performance.memory?.usedJSHeapSize || 0;
//     const growth = final - initial;
//     expect(growth).toBeLessThan(5 * 1024 * 1024); // < 5MB
//   });
// });
```

### 7.3 实战三：复杂业务逻辑断点调试

```javascript
// === 场景：表单验证逻辑异常，需要逐步调试 ===

// 问题：用户提交表单时，某些字段验证通过但实际应该失败

// 问题代码：
class FormValidator {
  constructor(rules) {
    this.rules = rules;
    this.errors = {};
  }

  validate(formData) {
    this.errors = {};

    for (const [field, rules] of Object.entries(this.rules)) {
      const value = this.getValueByPath(formData, field);

      for (const rule of rules) {
        if (rule.required && !value) {
          this.errors[field] = rule.message || '必填';
          break;
        }

        if (rule.pattern && !rule.pattern.test(value)) {
          this.errors[field] = rule.message || '格式错误';
          break;
        }

        if (rule.validator && typeof rule.validator === 'function') {
          // ❌ 异步验证器未正确处理
          const result = rule.validator(value, formData);
          if (result === false || (result && result.then === 'function' && false)) {
            this.errors[field] = rule.message || '验证失败';
            break;
          }
        }
      }
    }

    return Object.keys(this.errors).length === 0;
  }

  getValueByPath(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }
}

// 调试步骤：

// Step 1: 在 validate 方法入口设置断点
// Step 2: 查看 formData 和 rules 的值
// Step 3: 单步执行，观察每个字段的验证过程
// Step 4: 发现异步验证器的问题

// 修复后的代码：
class FormValidatorFixed {
  async validate(formData) {
    this.errors = {};

    for (const [field, rules] of Object.entries(this.rules)) {
      const value = this.getValueByPath(formData, field);

      for (const rule of rules) {
        if (rule.required && !value) {
          this.errors[field] = rule.message || '必填';
          break;
        }

        if (rule.pattern && !rule.pattern.test(value)) {
          this.errors[field] = rule.message || '格式错误';
          break;
        }

        if (rule.validator && typeof rule.validator === 'function') {
          // ✅ 正确处理异步验证器
          const result = await Promise.resolve(rule.validator(value, formData));
          if (result === false) {
            this.errors[field] = rule.message || '验证失败';
            break;
          }
        }
      }
    }

    return Object.keys(this.errors).length === 0;
  }
}

// 调试技巧总结：
// 1. 使用条件断点跳过不关心的迭代
// 2. 使用日志点记录关键变量而不暂停
// 3. 使用黑盒脚本跳过第三方库代码
// 4. 使用调用栈理解执行流程
// 5. 使用 Scope 面板查看闭包变量
// 6. 使用 Watch 表达式实时监控变量
```

---

## 8. 调试工具链整合

### 8.1 React DevTools

```javascript
// === React DevTools 核心功能 ===

// 1. Components 面板
// - 组件树查看
// - Props/State/Context 实时编辑
// - Highlight updates (高亮更新组件)

// 2. Profiler 面板
// - 记录渲染性能
// - 按提交 (commit) 查看渲染详情
// - Flamegraph 和 Ranked view
// - 识别不必要的渲染

// 使用 Profiler 优化 React 性能：
// 1. 打开 Profiler → 点击录制
// 2. 触发用户操作
// 3. 停止录制
// 4. 查看 Ranked view (按渲染时间排序)
// 5. 找到渲染最慢的组件
// 6. 查看 "Why did this render?" (React 18+)

// 常见优化：
// - React.memo() 避免不必要的重渲染
// - useMemo/useCallback 缓存计算结果
// - 拆分大组件为小组件
// - 使用 Suspense 延迟加载

// === Vue DevTools ===

// 1. Components 面板
// - 组件树 + Props/State/Computed
// - 时间旅行 (Time Travel)
// - 事件追踪

// 2. Timeline 面板
// - 事件时间线 (点击/HTTP/路由)
// - 性能分析
// - 状态变更追踪

// 3. Pinia/Vuex 面板
// - 状态树查看
// - 变更历史
// - 时间旅行
```

### 8.2 Redux DevTools

```javascript
// === Redux DevTools ===

// 核心功能：
// 1. State 快照查看
// 2. Action 历史追踪
// 3. 时间旅行 (Time Travel)
// 4. 差异对比 (Diff)
// 5. 导出/导入状态

// 集成方式：
// 1. Chrome 扩展 (推荐)
// 2. Redux DevTools Extension
// 3. remote-redux-devtools (远程调试)

// 使用示例：
// import { createStore, compose } from 'redux';
// const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
// const store = createStore(reducer, composeEnhancers(
//   applyMiddleware(thunk),
// ));

// 调试技巧：
// 1. 使用 "Trace" 功能追踪 action 来源
// 2. 使用 "Diff" 对比两次 state 变化
// 3. 使用 "Import/Export" 保存/复现问题状态
// 4. 使用 "Lock/Unlock" 暂停/恢复监听
```

### 8.3 GraphQL DevTools

```javascript
// === GraphQL 调试 ===

// 1. Apollo Client DevTools
// - 查看缓存状态
// - 查看 Query/Mutation 历史
// - 手动触发查询
// - 修改缓存数据

// 2. Chrome 网络面板中的 GraphQL
// - Network 面板筛选 "graphql"
// - 查看请求/响应
// - 查看变量和查询语句

// 3. GraphQL Playground / GraphiQL
// - 交互式查询编辑器
// - Schema 文档
// - 自动补全

// 常见调试场景：
// - N+1 查询问题 (Network 面板看请求数量)
// - 缓存问题 (Apollo DevTools 查看缓存)
// - 类型错误 (Schema 文档对照)
// - 性能问题 (使用 GraphQL Inspector)
```

---

## 9. 面试高频考点

### 9.1 性能分析

```
Q1: 如何定位页面加载慢的原因？
A:
1. Performance 面板录制，查看 Main Thread 活动
2. Network 面板查看资源加载瀑布图
3. 识别瓶颈：JS 解析/执行、CSS 阻塞、图片加载、API 请求
4. 使用 Lighthouse 获取综合评分和优化建议
5. 使用 Coverage 面板识别未使用代码

Q2: 什么是长任务？如何优化？
A:
- 长任务：执行时间 > 50ms 的主线程任务
- 优化方法：
  1. 分片处理 (Time Slicing)
  2. Web Worker offload
  3. scheduler.yield (Chrome 109+)
  4. requestIdleCallback
  5. 减少 DOM 操作频率

Q3: Core Web Vitals 是什么？如何优化？
A:
- LCP (< 2.5s): 预加载 + SSR + 图片优化
- INP (< 200ms): 减少长任务 + 优化事件处理
- CLS (< 0.1): 图片设尺寸 + 骨架屏 + 避免动态插入
- 使用 PerformanceObserver 实时监测

Q4: 如何分析火焰图？
A:
- Y 轴 = 调用栈深度
- X 轴 = 时间宽度
- 颜色 = 类别 (JS/DOM/Layout/Paint)
- 找最长的条 → 定位瓶颈 → 查看调用栈 → 找到触发点
- Bottom-Up 按自身耗时排序，Call Tree 按总耗时排序
```

### 9.2 内存泄漏

```
Q5: 常见的内存泄漏模式有哪些？
A:
1. 意外全局变量
2. 未清理的定时器/事件监听器
3. 闭包引用大对象
4. DOM引用残留
5. Cache 无限增长
6. 第三方库实例未销毁

Q6: 如何使用 Heap Snapshot 检测内存泄漏？
A:
1. 操作前拍快照 A
2. 执行操作（如切换页面 20 次）
3. 拍快照 B
4. Comparison 模式对比
5. 按 delta 排序，找到增长最多的对象类型
6. 查看 Retainers 面板，找到引用链顶端
7. 定位代码并修复

Q7: performance.memory 和 Heap Snapshot 的区别？
A:
- performance.memory: 实时内存使用概览 (Chrome only)
- Heap Snapshot: 完整的堆对象快照，可查看引用关系
- 两者配合使用：memory 监控趋势，Snapshot 定位问题
```

### 9.3 断点调试

```
Q8: 6 种断点类型的适用场景？
A:
- 行断点：通用，定位具体代码行
- 条件断点：循环/列表，只在特定条件暂停
- 异常断点：捕获未处理异常
- DOM 断点：追踪 DOM 变化来源
- XHR 断点：拦截特定请求
- 事件断点：找到事件绑定位置

Q9: 如何调试异步代码？
A:
- async/await: 调用栈显示完整异步链
- Promise: 每个 then 是独立帧
- Generator: 每次 yield 暂停
- 黑盒脚本：跳过 V8 内部代码
- Async 堆栈：DevTools 自动关联异步调用
```

---

## 10. 自测题

### 10.1 选择题

```
1. Performance 面板中，火焰图的 X 轴表示什么？
   A. 调用栈深度
   B. 时间宽度 (耗时)
   C. 内存使用量
   D. 函数调用次数
   答案: B

2. 以下哪种断点可以追踪 DOM 元素的属性变化？
   A. 行断点
   B. 条件断点
   C. DOM 断点
   D. XHR 断点
   答案: C

3. LCP 的性能目标是多少？
   A. < 1s
   B. < 2.5s
   C. < 4s
   D. < 10s
   答案: B

4. 以下哪种方式不能优化长任务？
   A. Web Worker
   B. Time Slicing
   C. scheduler.yield
   D. setTimeout(fn, 0)
   答案: D (setTimeout(fn, 0) 仍在主线程，不能解决长任务)

5. Heap Snapshot 的 Comparison 模式用于什么？
   A. 查看当前内存使用
   B. 对比两次快照的差异
   C. 导出内存数据
   D. 清除内存
   答案: B
```

### 10.2 实操题

```
实操 1: 使用 Performance 面板分析一个电商首页的性能瓶颈
- 录制 Performance
- 识别 LCP 元素
- 分析 Main Thread 活动
- 找出 3 个性能问题
- 提出优化方案

实操 2: 使用 Memory 面板检测一个 SPA 的内存泄漏
- 拍快照 A
- 切换页面 20 次
- 拍快照 B
- 对比分析
- 定位泄漏源
- 修复并验证

实操 3: 使用 Sources 面板调试一个复杂的表单验证逻辑
- 设置条件断点
- 单步执行
- 查看 Scope 变量
- 找到 bug
- 修复并验证

实操 4: 使用 Lighthouse 审计一个页面
- 运行 Lighthouse
- 分析各项评分
- 根据建议优化
- 重新运行验证

实操 5: 使用 Coverage 面板分析代码覆盖率
- 打开 Coverage
- 录制页面加载
- 识别未使用代码
- 提出优化方案 (Tree Shaking/代码分割)

实操 6: 使用 Network 面板分析资源加载
- 筛选不同类型资源
- 分析瀑布图
- 识别阻塞资源
- 提出优化方案 (预加载/内联/延迟加载)

实操 7: 使用 Application 面板调试 Service Worker
- 查看 SW 状态
- 手动触发更新
- 查看缓存内容
- 模拟离线场景

实操 8: 使用 Console 面板的高级功能
- $0/$1 引用
- monitorEvents
- profile/profileEnd
- time/timeEnd
- table 格式化输出
```

---

## 附录：调试 Checklist

```
性能分析 Checklist:
□ 使用 Performance 面板录制
□ 识别长任务 (> 50ms)
□ 分析火焰图，找到瓶颈函数
□ 检查 Layout/Paint 频率
□ 检查合成线程活动
□ 使用 Coverage 分析代码利用率
□ 测量 Core Web Vitals (LCP/INP/CLS)
□ 使用 Lighthouse 综合审计

内存泄漏 Checklist:
□ 使用 Memory 面板拍快照
□ 执行重复操作后拍对比快照
□ 使用 Comparison 模式找增长
□ 分析 Retainers 找到引用链
□ 检查全局变量
□ 检查定时器/事件监听器
□ 检查闭包引用
□ 检查 DOM引用
□ 检查 Cache 大小
□ 使用 performance.memory 监控趋势

断点调试 Checklist:
□ 使用行断点定位问题代码
□ 使用条件断点过滤无关迭代
□ 使用异常断点捕获错误
□ 使用 DOM 断点追踪 DOM 变化
□ 使用 XHR 断点拦截请求
□ 使用事件断点找到绑定位置
□ 使用黑盒脚本跳过第三方代码
□ 使用 Watch 表达式监控变量
□ 使用 Call Stack 理解执行流程
□ 使用 Scope 面板查看闭包
```

---

## 总结

第三轮 Chrome DevTools 训练聚焦于：

1. **底层原理**：Chrome 多进程架构、CDP 协议、DevTools 前端源码
2. **高级性能诊断**：火焰图深度解读、长任务优化、合成线程分析、Core Web Vitals 监测、性能预算
3. **高级内存追踪**：6 种泄漏模式深度分析、自动化泄漏检测、第三方库泄漏
4. **高级断点调试**：异步调试、条件断点高级用法、DOM 断点实战、完整调试工作流
5. **远程调试**：Android/iOS 远程调试、模拟器、生产环境调试策略
6. **自动化审计**：Lighthouse CI、Puppeteer 自动化测试、WebPageTest API
7. **生产级实战**：电商首页优化全流程、SPA 内存泄漏排查、复杂业务逻辑调试
8. **工具链整合**：React/Vue/Redux/GraphQL DevTools

三轮迭代闭环：
- 第一轮 (4/26)：基础深度 — 面板概览 + 核心功能
- 第二轮 (4/29)：全面覆盖 — 7 大面板 + 实战演练
- 第三轮 (4/30)：高级进阶 — 底层原理 + 生产级实战 + 自动化
