# Chrome DevTools 深度使用：性能分析 / 内存泄漏检测 / 断点调试

> 专项训练 16:00 | 2026-04-29 | 调试技能专项

---

## 目录

1. [Chrome DevTools 架构概览](#1-chrome-devtools-架构概览)
2. [Sources 面板：断点调试深度实战](#2-sources-面板断点调试深度实战)
3. [Performance 面板：性能分析深度实战](#3-performance-面板性能分析深度实战)
4. [Memory 面板：内存泄漏检测深度实战](#4-memory-面板内存泄漏检测深度实战)
5. [Lighthouse 面板：综合性能审计](#5-lighthouse-面板综合性能审计)
6. [Application 面板：存储与资源调试](#6-application-面板存储与资源调试)
7. [Console 面板：高级调试技巧](#7-console-面板高级调试技巧)
8. [Network 面板：请求调试与优化](#8-network-面板请求调试与优化)
9. [实战演练场](#9-实战演练场)
10. [面试高频考点](#10-面试高频考点)
11. [自测题](#11-自测题)

---

## 1. Chrome DevTools 架构概览

### 1.1 DevTools 面板矩阵

```
┌─────────────────────────────────────────────────────────────┐
│  Elements  │  Console  │  Sources  │  Network  │  ...      │
├────────────┼───────────┼───────────┼───────────┼───────────┤
│  Performance│  Memory   │  Application│  Security│  Lighthouse│
├────────────┼───────────┼───────────┼───────────┼───────────┤
│  Layers    │  Rendering│  Animations│  Coverage │  Screencast│
└─────────────────────────────────────────────────────────────┘
```

### 1.2 快捷键速查

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+I` / `Cmd+Option+I` | 打开 DevTools |
| `Ctrl+Shift+J` / `Cmd+Option+J` | 直接打开 Console |
| `Ctrl+Shift+C` / `Cmd+Shift+C` | 元素选择模式 |
| `Ctrl+P` / `Cmd+P` | 快速打开文件 |
| `Ctrl+Shift+P` / `Cmd+Shift+P` | Command Menu |
| `~` (波浪号) | 切换面板 |
| `Esc` | 打开/关闭 Drawer |
| `Ctrl+Shift+M` / `Cmd+Shift+M` | 切换设备模拟 |
| `F8` / `Cmd+\` | 继续/暂停 |
| `F10` / `Cmd+'` | 单步跳过 |
| `F11` / `Cmd+;` | 单步进入 |
| `Shift+F11` / `Cmd+Shift+;` | 单步跳出 |

### 1.3 Command Menu 常用命令

```
> show console          # 显示 Console
> show performance      # 显示 Performance
> show memory           # 显示 Memory
> screenshot            # 全屏截图
> capture screenshot    # 区域截图
> network conditions    # 网络条件模拟
> rendering             # 渲染设置
> coverage              # 代码覆盖率
> animations            # 动画调试
> layers                # 图层面板
```

---

## 2. Sources 面板：断点调试深度实战

### 2.1 断点类型全解

#### 2.1.1 行断点 (Line Breakpoint)

```javascript
// 在行号上点击设置断点
function processData(data) {
  const filtered = data.filter(item => item.active);  // ← 断点设在这里
  const sorted = filtered.sort((a, b) => a.score - b.score);
  return sorted;
}

// 条件断点：右键行号 → Add conditional breakpoint
// 输入条件：item.score > 90
function processData(data) {
  const filtered = data.filter(item => item.active);
  // 只有 item.score > 90 时才会暂停
  const sorted = filtered.sort((a, b) => a.score - b.score);
  return sorted;
}

// 日志点 (Logpoint)：右键行号 → Add logpoint
// 输入：`Processing item: ${item.id}, score: ${item.score}`
// 不会暂停执行，只在 Console 输出日志
```

#### 2.1.2 异常断点 (Exception Breakpoint)

```javascript
// Sources 面板 → 打开 "Pause on exception" (⏸ 图标)
// Paused on exceptions 模式：
//   • 未捕获的异常 (Uncaught exceptions) — 推荐
//   • 所有异常 (All exceptions) — 包含已捕获的

async function fetchData() {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    // 如果 response.json() 抛出异常，"所有异常"模式会暂停
    return data;
  } catch (e) {
    // "未捕获的异常"模式不会在这里暂停（异常已被捕获）
    console.error('Fetch failed:', e);
    return null;
  }
}
```

#### 2.1.3 DOM 断点 (DOM Breakpoint)

```javascript
// Elements 面板 → 右键元素 → Break on → 选择类型

// 1. subtree modifications — 子节点变化
const list = document.getElementById('todo-list');
// 设置 DOM 断点后，任何 add/remove 子节点操作都会暂停
list.appendChild(newItem);  // ← 会暂停

// 2. attributes modifications — 属性变化
const btn = document.getElementById('submit-btn');
// 设置 DOM 断点后，任何属性变化都会暂停
btn.disabled = true;  // ← 会暂停
btn.setAttribute('data-loading', 'true');  // ← 会暂停

// 3. node removal — 节点被移除
const modal = document.getElementById('modal');
// 设置 DOM 断点后，节点被移除时会暂停
modal.remove();  // ← 会暂停
```

#### 2.1.4 XHR/Fetch 断点 (XHR Breakpoint)

```javascript
// Sources 面板 → XHR Breakpoints 区域
// 添加 URL 关键字匹配，匹配到则暂停

// 示例：断点设置在包含 "api/user" 的请求
// 以下请求会触发断点暂停：
fetch('/api/user/profile')    // ✅ 匹配
fetch('/api/user/settings')   // ✅ 匹配
fetch('/api/product/list')    // ❌ 不匹配

// XHR 也一样：
const xhr = new XMLHttpRequest();
xhr.open('GET', '/api/user/profile');
xhr.send();  // ← 会暂停
```

#### 2.1.5 事件断点 (Event Listener Breakpoint)

```javascript
// Sources 面板 → Event Listener Breakpoints
// 按类别展开，勾选特定事件

// Mouse 事件组：
//   click, dblclick, mousedown, mouseup, mousemove, mouseover, mouseout

// Keyboard 事件组：
//   keydown, keypress, keyup

// 实战场景：调试第三方库的事件绑定
// 不知道事件绑定在哪里？用事件断点！

// 示例：找到所有 click 事件的绑定位置
// 1. Sources → Event Listener Breakpoints → Mouse → click ✓
// 2. 点击页面任意元素
// 3. DevTools 会在事件处理函数执行前暂停
// 4. Call Stack 显示完整的调用链
```

#### 2.1.6 函数断点 (debug())

```javascript
// 在 Console 中使用 debug() 设置函数断点

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// Console 中输入：
debug(calculateTotal);  // 每次调用 calculateTotal 都会暂停

// 取消断点：
undebug(calculateTotal);

// 实用场景：调试不属于自己的代码（第三方库）
debug(React.createElement);  // 每次 React 创建元素时暂停
debug(document.querySelector);  // 每次 DOM 查询时暂停
```

### 2.2 调用栈 (Call Stack) 深度分析

```javascript
// 调用栈示例 — 理解执行上下文链

function fetchData() {
  return api.get('/data')  // ← 断点在这里
    .then(response => response.json())
    .then(data => process(data));
}

function process(data) {
  return data.map(transform);
}

function transform(item) {
  return { ...item, formatted: formatDate(item.date) };
}

// 当断点触发时，Call Stack 显示：
// 1. fetchData (当前执行)
// 2. Promise.then
// 3. process
// 4. transform
// 5. Array.map
// 6. (anonymous) — 全局入口

// 点击任意帧 → 查看该帧的变量状态
// 右键帧 → "Restart frame" — 重新执行该帧
```

### 2.3 黑盒脚本 (Blackbox Scripts)

```javascript
// 黑盒化第三方库，调试时自动跳过

// 设置方法：
// 1. Sources 面板 → 打开第三方脚本
// 2. 右键 → Add script to blackbox list
// 或者：Settings → Blackboxing → 添加正则表达式

// 常用黑盒规则：
/node_modules\/.*\.js$/          // 跳过所有 node_modules
/vendor\.js$/                     // 跳过 vendor 包
/\.min\.js$/                      // 跳过压缩文件

// 效果：
// - F11 (Step Into) 不会进入黑盒脚本
// - 断点自动忽略黑盒脚本
// - Call Stack 中黑盒脚本显示为灰色
```

### 2.4 断点调试实战场景

#### 场景 1：调试 React 组件渲染问题

```javascript
// 问题：组件渲染了但数据不对

function UserList({ users }) {
  // 1. 在 return 前设置断点
  const activeUsers = users.filter(u => u.active);  // ← 断点
  
  // 2. 检查 Scope 面板
  //    - Local: users, activeUsers
  //    - Closure: 父级作用域变量
  //    - Global: window 对象
  
  // 3. 使用 Watch 面板监控特定变量
  //    添加：activeUsers.length, users.length
  
  return (
    <ul>
      {activeUsers.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// 调试技巧：
// - 使用 "Step Over" (F10) 逐行执行
// - 使用 "Step Into" (F11) 进入函数内部
// - 使用 "Step Out" (Shift+F11) 跳出当前函数
// - 使用 "Deactivate breakpoints" (⏸ 图标) 临时禁用所有断点
```

#### 场景 2：调试异步代码

```javascript
// 问题：Promise 链中某个环节出错

async function loadDashboard() {
  try {
    const [users, posts, stats] = await Promise.all([
      fetchUsers(),
      fetchPosts(),
      fetchStats()
    ]);
    
    renderDashboard({ users, posts, stats });  // ← 断点
  } catch (error) {
    console.error('Dashboard load failed:', error);
    // 使用 "Pause on caught exceptions" 捕获这里
  }
}

// 调试技巧：
// 1. 打开 "Pause on exceptions"
// 2. 使用 Call Stack 追踪异步调用链
// 3. 使用 Async 选项展开完整的异步调用链
// 4. 使用 "Restart frame" 重新执行失败的 Promise
```

#### 场景 3：调试循环中的变量

```javascript
// 问题：闭包导致的循环变量问题

// ❌ 错误写法
function createButtons() {
  const buttons = [];
  for (var i = 0; i < 5; i++) {
    buttons.push({
      id: i,
      click: function() {
        console.log('Clicked button:', i);  // 总是输出 5
      }
    });
  }
  return buttons;
}

// 调试方法：
// 1. 在 console.log 行设置断点
// 2. 点击任意按钮触发断点
// 3. 查看 Scope → Closure → i 的值
// 4. 发现所有按钮共享同一个 i（值为 5）

// ✅ 修复方法
function createButtonsFixed() {
  const buttons = [];
  for (let i = 0; i < 5; i++) {  // var → let
    buttons.push({
      id: i,
      click: function() {
        console.log('Clicked button:', i);  // 正确输出 0-4
      }
    });
  }
  return buttons;
}
```

### 2.5 代码覆盖率 (Coverage)

```javascript
// Coverage 面板 — 找出未执行的代码

// 打开方式：
// Ctrl+Shift+P → Show Coverage → 点击录制按钮

// 输出示例：
// ┌──────────────────────────────┬──────────┬──────────┐
// │ URL                          │ Bytes    │ Unused   │
// ├──────────────────────────────┼──────────┼──────────┤
// │ app.js                       │ 45.2 KB  │ 12.8 KB  │
// │ vendor.js                    │ 128 KB   │ 45.1 KB  │
// │ analytics.js                 │ 8.3 KB   │ 8.3 KB   │ ← 完全未使用
// └──────────────────────────────┴──────────┴──────────┘

// Sources 面板中查看具体未执行代码：
// - 蓝色高亮：已执行
// - 红色高亮：未执行
// - 可以导出 JSON 格式报告

// 实战：优化打包体积
// 1. 运行 Coverage
// 2. 找出未使用的代码
// 3. 使用 Tree Shaking 移除
// 4. 对比优化前后的 Coverage 数据
```

---

## 3. Performance 面板：性能分析深度实战

### 3.1 Performance 面板架构

```
┌─────────────────────────────────────────────────────────┐
│  [Record] [Stop] [Clear]  [Load] [Save]                │
├─────────────────────────────────────────────────────────┤
│  Timeline (火焰图)                                       │
│  ├─ Frames (帧率)                                        │
│  ├─ Screenshots (截图)                                   │
│  ├─ Runtime (运行时事件)                                  │
│  │   ├─ JS Stack (JS 调用栈)                             │
│  │   ├─ Rendering (渲染)                                 │
│  │   ├─ Painting (绘制)                                  │
│  │   └─ Idle (空闲)                                      │
│  ├─ Main (主线程)                                        │
│  │   ├─ Tasks (任务队列)                                 │
│  │   ├─ DOM Ready                                        │
│  │   └─ Load Event                                       │
│  └─ GPU (GPU 线程)                                       │
├─────────────────────────────────────────────────────────┤
│  Bottom-Up (自底向上) │  Call Tree (调用树) │  Event Log│
└─────────────────────────────────────────────────────────┘
```

### 3.2 录制性能 Profile

```javascript
// 录制步骤：
// 1. Performance 面板 → 点击 Record (⏺)
// 2. 执行需要分析的操作（页面加载、交互等）
// 3. 点击 Stop (⏹) 停止录制
// 4. 分析生成的 Profile

// 录制选项（Settings）：
// - Screenshots: 捕获页面截图
// - Memory: 记录内存使用
// - Frames: 记录帧率数据
// - JS samples: 采样 JS 执行
// - Native memory: 记录原生内存（Chrome 92+）

// 录制时长建议：
// - 页面加载：10-30 秒
// - 交互分析：5-15 秒
// - 内存泄漏：30-60 秒（配合 Memory 面板）
```

### 3.3 Timeline 分析

#### 3.3.1 帧率分析 (FPS)

```javascript
// FPS 图表解读：
// - 绿色区域：60 FPS（流畅）
// - 黄色区域：30-60 FPS（可接受）
// - 红色区域：<30 FPS（卡顿）

// 60 FPS 目标：
// 16.67ms = 1000ms / 60fps
// 每帧预算 = 16.67ms - 浏览器开销(~2-4ms) = ~12ms

// 常见帧率问题：
// 1. 长任务 (Long Task) — 单个任务 > 50ms
//    解决：拆分为多个小任务（requestIdleCallback / MessageChannel）

// 2. 重排 (Reflow) — 频繁读写布局属性
//    解决：批量 DOM 操作，使用 transform/opacity 动画

// 3. 重绘 (Repaint) — 样式变化触发重绘
//    解决：使用 will-change，避免布局抖动

// 4. GC 停顿 — 垃圾回收导致卡顿
//    解决：对象池复用，减少临时对象创建
```

#### 3.3.2 Main 线程分析

```javascript
// Main 线程事件类型：

// 1. Program (程序执行)
//    - 顶层 JS 执行
//    - 通常很短，不值得关注

// 2. Event Dispatch (事件分发)
//    - click, scroll, resize 等事件处理
//    - 关注执行时间，>100ms 需要优化

// 3. Function Call (函数调用)
//    - 用户自定义函数
//    - 通过 Call Tree 查看调用链

// 4. Evaluate Script (脚本执行)
//    - <script> 标签执行
//    - 关注阻塞时间

// 5. Layout (布局/重排)
//    - 计算元素几何位置
//    - 频繁 Layout 是性能杀手
//    - 绿色条越长，耗时越久

// 6. Paint (绘制)
//    - 将像素填充到图层
//    - 蓝色条表示绘制区域

// 7. Composite (合成)
//    - 将图层组合到屏幕
//    - 通常很快，<1ms

// 8. GC (垃圾回收)
//    - Mark-Sweep 标记清除
//    - 频繁 GC 说明内存分配过多

// 9. Timer Fired (定时器触发)
//    - setTimeout / setInterval 回调
//    - 可能阻塞主线程

// 10. XHR Ready State Change (XHR 状态变化)
//     - XMLHttpRequest 回调
//     - 关注数据处理时间
```

#### 3.3.3 火焰图 (Flame Chart) 解读

```javascript
// 火焰图结构：
// - X 轴：时间
// - Y 轴：调用栈深度
// - 每个方块：一个函数调用
// - 方块宽度：函数执行时间
// - 方块颜色：无意义（仅区分）

// 解读规则：
// 1. 顶层方块 = 入口函数
// 2. 底层方块 = 实际执行代码
// 3. 宽方块 = 耗时函数（优化重点）
// 4. 窄而高的栈 = 深层调用（可能过度抽象）
// 5. 平铺的方块 = 并行执行（Web Worker）

// 实战：找出性能瓶颈
// 1. 找到最宽的方块（最耗时）
// 2. 点击方块查看详细信息
// 3. 查看 Call Tree 了解调用来源
// 4. 查看 Bottom-Up 了解被谁调用
// 5. 定位问题代码 → 优化 → 重新录制对比

// 示例火焰图分析：
// ┌─ main() ───────────────────────────────────┐  ← 入口
// │  ┌─ initApp() ───────────────────────────┐ │
// │  │  ┌─ fetchData() ───────────────────┐  │ │
// │  │  │  ┌─ parseJSON() ─────────────┐  │  │ │
// │  │  │  │  ┌─ transformData() ───┐  │  │  │ │
// │  │  │  │  │  计算密集型操作      │  │  │  │ │  ← 瓶颈！
// │  │  │  │  └─────────────────────┘  │  │  │ │
// │  │  │  └──────────────────────────┘  │  │ │
// │  │  └─ render() ────────────────────┘  │ │
// │  └─────────────────────────────────────┘ │
// └──────────────────────────────────────────┘
```

### 3.4 性能优化实战

#### 实战 1：优化长任务 (Long Tasks)

```javascript
// ❌ 问题代码：长任务阻塞主线程
function processLargeDataset(data) {
  // 处理 100 万条数据，耗时 200ms+
  const result = [];
  for (let i = 0; i < data.length; i++) {
    result.push(transform(data[i]));
  }
  return result;
}

// ✅ 优化方案 1：requestIdleCallback
function processLargeDatasetIdle(data) {
  const result = [];
  let index = 0;
  const CHUNK_SIZE = 1000;

  function processChunk(deadline) {
    while (
      index < data.length &&
      index % CHUNK_SIZE !== 0 &&
      deadline.timeRemaining() > 0
    ) {
      result.push(transform(data[index++]));
    }

    if (index < data.length) {
      requestIdleCallback(processChunk);
    } else {
      console.log('Processing complete');
    }
  }

  requestIdleCallback(processChunk);
  return result; // 注意：异步返回，需要回调/Promise
}

// ✅ 优化方案 2：MessageChannel (更精确的调度)
function processLargeDatasetMessageChannel(data) {
  return new Promise((resolve) => {
    const result = [];
    let index = 0;
    const CHUNK_SIZE = 5000;

    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      const start = performance.now();

      while (
        index < data.length &&
        performance.now() - start < 45  // 留 1.67ms 给浏览器
      ) {
        result.push(transform(data[index++]));
      }

      if (index < data.length) {
        channel.port2.postMessage('');
      } else {
        resolve(result);
      }
    };

    channel.port2.postMessage('');
  });
}

// ✅ 优化方案 3：Web Worker (完全脱离主线程)
// worker.js
self.onmessage = (e) => {
  const { data, CHUNK_SIZE } = e.data;
  const result = [];
  for (let i = 0; i < data.length; i++) {
    result.push(transform(data[i]));
  }
  self.postMessage(result);
};

// main.js
function processLargeDatasetWorker(data) {
  return new Promise((resolve) => {
    const worker = new Worker('worker.js');
    worker.onmessage = (e) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.postMessage({ data, CHUNK_SIZE: 10000 });
  });
}
```

#### 实战 2：优化 Layout Thrashing

```javascript
// ❌ 问题代码：读写交替导致 Layout Thrashing
function addBoxes(items) {
  const container = document.getElementById('container');

  items.forEach((item, index) => {
    const box = document.createElement('div');
    box.className = 'box';
    container.appendChild(box);

    // 读 → 写 → 读 → 写 → 触发多次 Layout
    const height = container.offsetHeight;  // 读布局
    box.style.top = height + 'px';          // 写样式（触发 Layout）

    const width = box.offsetWidth;          // 读布局
    box.style.width = width + 'px';         // 写样式（触发 Layout）
  });
}

// ✅ 优化方案 1：批量读写
function addBoxesOptimized(items) {
  const container = document.getElementById('container');

  // 批量读
  const containerHeight = container.offsetHeight;
  let currentHeight = containerHeight;

  // 批量写
  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const box = document.createElement('div');
    box.className = 'box';
    box.style.top = currentHeight + 'px';
    currentHeight += box.offsetHeight;
    fragment.appendChild(box);
  });

  container.appendChild(fragment);  // 单次写入
}

// ✅ 优化方案 2：使用 requestAnimationFrame
function addBoxesRAF(items) {
  const container = document.getElementById('container');

  requestAnimationFrame(() => {
    // 在 rAF 中读取
    const containerHeight = container.offsetHeight;

    requestAnimationFrame(() => {
      // 在下一个 rAF 中写入
      let currentHeight = containerHeight;
      const fragment = document.createDocumentFragment();

      items.forEach((item) => {
        const box = document.createElement('div');
        box.className = 'box';
        box.style.top = currentHeight + 'px';
        currentHeight += 50;  // 避免读取 box.offsetHeight
        fragment.appendChild(box);
      });

      container.appendChild(fragment);
    });
  });
}

// ✅ 优化方案 3：使用 CSS transform（不触发 Layout）
function addBoxesTransform(items) {
  const container = document.getElementById('container');
  const fragment = document.createDocumentFragment();

  items.forEach((item, index) => {
    const box = document.createElement('div');
    box.className = 'box';
    // 使用 transform 代替 top/left（不触发 Layout）
    box.style.transform = `translateY(${index * 50}px)`;
    fragment.appendChild(box);
  });

  container.appendChild(fragment);
}
```

#### 实战 3：优化动画性能

```javascript
// ❌ 问题代码：使用 top/left 做动画（触发 Layout）
function animateBox(element) {
  let pos = 0;
  const interval = setInterval(() => {
    pos += 2;
    element.style.top = pos + 'px';  // 触发 Layout + Paint
    if (pos >= 500) clearInterval(interval);
  }, 16);
}

// ✅ 优化方案 1：使用 transform（仅触发 Composite）
function animateBoxTransform(element) {
  let pos = 0;
  const interval = setInterval(() => {
    pos += 2;
    element.style.transform = `translateY(${pos}px)`;  // 仅触发 Composite
    if (pos >= 500) clearInterval(interval);
  }, 16);
}

// ✅ 优化方案 2：使用 requestAnimationFrame
function animateBoxRAF(element) {
  let pos = 0;
  function step() {
    pos += 2;
    element.style.transform = `translateY(${pos}px)`;
    if (pos < 500) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

// ✅ 优化方案 3：使用 CSS Animation（最佳性能）
// CSS:
// .box {
//   animation: slideDown 2s ease-in-out forwards;
// }
// @keyframes slideDown {
//   from { transform: translateY(0); }
//   to { transform: translateY(500px); }
// }

// ✅ 优化方案 4：使用 Web Animations API
function animateBoxWAAPI(element) {
  element.animate(
    [
      { transform: 'translateY(0)' },
      { transform: 'translateY(500px)' }
    ],
    {
      duration: 2000,
      easing: 'ease-in-out',
      fill: 'forwards'
    }
  );
}
```

### 3.5 Performance 面板高级功能

#### 3.5.1 Memory 面板中的性能分析

```javascript
// Performance 面板中勾选 Memory 选项
// 可以观察到：
// - JS Heap Size Size (JS 堆大小)
// - Documents (文档数量)
// - Frames (帧数量)
// - Nodes (DOM 节点数量)
// - Listeners (事件监听器数量)

// 内存使用模式：
// 1. 锯齿状 (Sawtooth) — 正常 GC 模式
//    内存上升 → GC 回收 → 内存下降 → 循环
//    说明：内存管理健康

// 2. 阶梯状 (Staircase) — 内存泄漏模式
//    内存逐步上升，GC 后无法回到基线
//    说明：存在内存泄漏

// 3. 持续上升 — 严重泄漏
//    内存持续增长，GC 几乎无效
//    说明：大量对象被意外引用
```

#### 3.5.2 Lighthouse 集成

```javascript
// Performance 面板 → Lighthouse 标签
// 可以生成性能报告：

// 指标说明：
// - FCP (First Contentful Paint): 首次内容绘制 < 1.8s
// - LCP (Largest Contentful Paint): 最大内容绘制 < 2.5s
// - SI (Speed Index): 速度指数 < 3.4s
// - TBT (Total Blocking Time): 总阻塞时间 < 200ms
// - CLS (Cumulative Layout Shift): 累积布局偏移 < 0.1
// - FID (First Input Delay): 首次输入延迟 < 100ms (已替换为 INP)
// - INP (Interaction to Next Paint): 交互到下次绘制 < 200ms

// 优化建议分类：
// - 机会 (Opportunities): 可优化的项目
// - 诊断 (Diagnostics): 进一步分析建议
// - 传递的审核 (Passed Audits): 已通过的项目
```

---

## 4. Memory 面板：内存泄漏检测深度实战

### 4.1 内存泄漏基础

```javascript
// 什么是内存泄漏？
// 程序不再需要的对象，仍然被引用，导致 GC 无法回收

// JavaScript 垃圾回收机制：
// 1. Mark-and-Sweep (标记-清除) — 主流
//    - 从根对象 (root) 开始遍历
//    - 标记所有可达对象
//    - 清除不可达对象

// 2. 引用计数 (Reference Counting) — 已淘汰
//    - 跟踪每个对象的引用次数
//    - 引用次数为 0 时回收
//    - 无法处理循环引用

// GC Roots (根对象)：
// - 全局对象 (window / global)
// - 当前执行栈中的局部变量
// - DOM 元素上的事件监听器
// - Closure 中的变量
```

### 4.2 Memory 面板工具

#### 4.2.1 Heap Snapshot (堆快照)

```javascript
// 使用步骤：
// 1. Memory 面板 → 选择 Heap Snapshot
// 2. 点击 Record 拍摄快照
// 3. 执行操作（如打开/关闭弹窗）
// 4. 再次拍摄快照
// 5. 使用 Comparison 模式对比差异

// 快照分析：

// Summary 视图（按类型分组）：
// ┌─────────────────────┬────────┬─────────┬────────┐
// │ Constructor         │ Objects│ Shallow │ Retained│
// ├─────────────────────┼────────┼─────────┼────────┤
// │ (array)             │ 1,234  │ 45.2 KB │ 2.1 MB │
// │ (string)            │ 5,678  │ 128 KB  │ 512 KB │
// │ (compiled code)     │ 890    │ 256 KB  │ 1.2 MB │
// │ div                 │ 456    │ 18.2 KB │ 92.1 KB│
// │ Object              │ 2,345  │ 75.0 KB │ 345 KB │
// └─────────────────────┴────────┴─────────┴────────┘

// 关键字段：
// - Objects: 对象数量
// - Shallow Size: 对象自身大小（不含引用）
// - Retained Size: 对象被 GC 后可回收的总大小

// Comparison 视图（对比两次快照）：
// - 显示新增/减少的对象
// - 按 Constructor 分组
// - Delta 列显示变化量
// - 正数 = 新增，负数 = 减少

// Detached DOM trees (分离的 DOM 树)：
// - DOM 节点已从文档中移除
// - 但 JS 中仍有引用
// - 最常见的内存泄漏类型
```

#### 4.2.2 Allocation Instrumentation (分配检测)

```javascript
// 使用步骤：
// 1. Memory 面板 → 选择 Allocation instrumentation
// 2. 设置时长（默认 10 秒）
// 3. 点击 Record
// 4. 执行操作
// 5. 停止录制

// 输出：
// - 按时间线显示内存分配
// - 每个分配显示调用栈
// - 可以按大小/构造函数过滤
// - 适合分析内存分配模式

// 实用场景：
// - 找出频繁分配的对象
// - 定位内存分配热点
// - 分析 GC 压力来源
```

#### 4.2.3 Allocation Timeline (分配时间线)

```javascript
// 使用步骤：
// 1. Memory 面板 → 选择 Allocation timeline
// 2. 点击 Record
// 3. 执行操作
// 4. 停止录制

// 输出：
// - 彩色时间线显示内存分配
// - 蓝色：活跃对象
// - 灰色：已回收对象
// - 红色：泄漏嫌疑对象

// 与 Allocation instrumentation 的区别：
// - 开销更小（采样而非全量）
// - 适合长时间监控
// - 精度略低
```

### 4.3 内存泄漏模式与检测

#### 模式 1：意外的全局变量

```javascript
// ❌ 泄漏代码
function createUser(name) {
  // 忘记 var/let/const → 变成全局变量
  user = { name: name, created: Date.now() };
  return user;
}

// 检测：
// 1. 拍摄快照 → 搜索 "user"
// 2. 查看 window 对象下的属性
// 3. 发现意外的全局变量

// ✅ 修复
function createUserFixed(name) {
  const user = { name: name, created: Date.now() };  // 使用 let/const
  return user;
}

// 预防：
// - 使用严格模式 ('use strict')
// - 使用 ESLint no-implicit-globals 规则
// - 使用 TypeScript
```

#### 模式 2：被遗忘的定时器/回调

```javascript
// ❌ 泄漏代码
function setupTimer() {
  const largeData = new Array(1000000).fill('x');

  setInterval(() => {
    console.log(largeData.length);  // largeData 永远不会被回收
  }, 1000);
}

// 问题：
// - setInterval 的回调引用了 largeData
// - 即使函数执行完毕，largeData 仍被引用
// - 定时器不取消，内存永远不释放

// 检测：
// 1. 拍摄快照 → 搜索 "Array"
// 2. 查看 Retained Size
// 3. 追踪引用链找到定时器

// ✅ 修复
function setupTimerFixed() {
  const largeData = new Array(1000000).fill('x');
  const timerId = setInterval(() => {
    console.log(largeData.length);
  }, 1000);

  // 提供清理方法
  return () => clearInterval(timerId);
}

// 使用：
const cleanup = setupTimerFixed();
// 不再需要时：
cleanup();
```

#### 模式 3：闭包引用

```javascript
// ❌ 泄漏代码
function createProcessor() {
  const largeBuffer = new ArrayBuffer(10 * 1024 * 1024); // 10MB

  return {
    process: function(data) {
      // 只使用了 largeBuffer 的一小部分
      // 但整个 largeBuffer 都被闭包引用
      return largeBuffer.slice(0, data.length);
    }
  };
}

// 检测：
// 1. 拍摄快照 → 搜索 "ArrayBuffer"
// 2. 查看 Retained Size
// 3. 发现闭包持有大对象引用

// ✅ 修复
function createProcessorFixed() {
  const largeBuffer = new ArrayBuffer(10 * 1024 * 1024);

  // 只暴露需要的部分
  const smallBuffer = largeBuffer.slice(0, 1024);

  return {
    process: function(data) {
      return smallBuffer.slice(0, data.length);
    }
  };
  // largeBuffer 在此处可以被回收（如果没有其他地方引用）
}
```

#### 模式 4：DOM 引用未清理

```javascript
// ❌ 泄漏代码
const elements = [];

function cacheElements() {
  const divs = document.querySelectorAll('div');
  divs.forEach(div => {
    elements.push(div);  // 保存 DOM 引用
  });
}

function removeElements() {
  // 从 DOM 中移除
  document.querySelectorAll('div').forEach(div => {
    div.remove();
  });
  // 但 elements 数组仍然持有引用！
  // GC 无法回收这些 DOM 节点
}

// 检测：
// 1. 拍摄快照 → 搜索 "Detached"
// 2. 查看 Detached DOM trees
// 3. 追踪引用链找到 elements 数组

// ✅ 修复
function removeElementsFixed() {
  document.querySelectorAll('div').forEach(div => {
    div.remove();
  });
  elements.length = 0;  // 清空数组，释放引用
}

// 更好的方案：使用 WeakMap
const elementCache = new WeakMap();

function cacheElementWeak(element) {
  elementCache.set(element, { data: 'some metadata' });
  // 当 element 从 DOM 移除后，WeakMap 中的条目会自动清除
}
```

#### 模式 5：事件监听器未移除

```javascript
// ❌ 泄漏代码
class Component {
  constructor(element) {
    this.element = element;
    this.data = new Array(100000).fill('data');

    // 绑定事件
    this.handleClick = this.handleClick.bind(this);
    element.addEventListener('click', this.handleClick);
  }

  handleClick(event) {
    console.log(this.data.length);
  }

  // 缺少 destroy 方法！
}

// 检测：
// 1. 拍摄快照 → 搜索事件监听器
// 2. 查看 Listeners 列
// 3. 发现已移除元素仍绑定事件

// ✅ 修复
class ComponentFixed {
  constructor(element) {
    this.element = element;
    this.data = new Array(100000).fill('data');
    this.handleClick = this.handleClick.bind(this);
    element.addEventListener('click', this.handleClick);
  }

  handleClick(event) {
    console.log(this.data.length);
  }

  destroy() {
    this.element.removeEventListener('click', this.handleClick);
    this.element = null;
    this.data = null;
  }
}

// 使用：
const component = new ComponentFixed(document.getElementById('btn'));
// 不再需要时：
component.destroy();
```

#### 模式 6：Map/Cache 无限增长

```javascript
// ❌ 泄漏代码
const userCache = new Map();

function getUser(id) {
  if (userCache.has(id)) {
    return userCache.get(id);
  }
  const user = fetchUserFromAPI(id);  // 假设的 API 调用
  userCache.set(id, user);
  return user;
}

// 问题：
// - Cache 无限增长
// - 永远不会清理
// - 内存持续上升

// ✅ 修复：LRU Cache
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;

    // 移到末尾（最近使用）
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的（第一个）
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

// 使用：
const userCacheFixed = new LRUCache(100);  // 最多缓存 100 个用户
```

### 4.4 内存泄漏检测工作流

```javascript
// 标准检测流程：

// 步骤 1：建立基线
// - 打开页面
// - 拍摄 Heap Snapshot（快照 A）
// - 记录 JS Heap Size

// 步骤 2：执行操作
// - 执行可疑操作（如打开/关闭弹窗 10 次）
// - 强制 GC（Memory 面板 → ⚡ 按钮）
// - 拍摄 Heap Snapshot（快照 B）

// 步骤 3：对比分析
// - 使用 Comparison 模式对比 A 和 B
// - 查看新增对象数量
// - 关注 Retained Size 增长

// 步骤 4：追踪引用
// - 找到可疑对象
// - 查看 Retainers（引用者）
// - 追踪引用链找到泄漏源

// 步骤 5：验证修复
// - 修复代码
// - 重复步骤 1-3
// - 确认内存不再增长

// 自动化检测脚本：
function monitorMemory() {
  if (performance.memory) {
    return {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    };
  }
  return null;
}

// 在 Console 中监控：
// setInterval(() => {
//   const mem = monitorMemory();
//   if (mem) {
//     console.log(
//       `Used: ${(mem.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
//       `Total: ${(mem.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`
//     );
//   }
// }, 1000);
```

---

## 5. Lighthouse 面板：综合性能审计

### 5.1 Lighthouse 指标详解

```javascript
// Core Web Vitals (核心 Web 指标)：

// 1. LCP (Largest Contentful Paint) — 最大内容绘制
//    目标：< 2.5s
//    测量：视口中最大内容元素的渲染时间
//    优化：
//    - 优化关键资源加载（图片、字体）
//    - 使用 CDN 加速
//    - 服务端渲染 (SSR)
//    - 预加载关键资源 (<link rel="preload">)

// 2. INP (Interaction to Next Paint) — 交互到下次绘制
//    目标：< 200ms
//    测量：用户交互到下次绘制的延迟
//    优化：
//    - 减少长任务 (Long Tasks)
//    - 使用 requestIdleCallback 拆分任务
//    - Web Worker 处理计算密集型任务
//    - 优化事件处理函数

// 3. CLS (Cumulative Layout Shift) — 累积布局偏移
//    目标：< 0.1
//    测量：页面生命周期内所有意外布局偏移的总和
//    优化：
//    - 为图片/视频设置宽高比
//    - 使用 font-display: optional
//    - 避免动态插入内容
//    - 使用 transform 代替布局属性动画

// 其他重要指标：
// - FCP (First Contentful Paint): < 1.8s
// - SI (Speed Index): < 3.4s
// - TBT (Total Blocking Time): < 200ms
// - TTFB (Time to First Byte): < 0.8s
```

### 5.2 Lighthouse 优化建议

```javascript
// Performance 优化建议分类：

// 1. 资源优化
// - 压缩图片 (WebP/AVIF 格式)
// - 延迟加载非关键图片 (loading="lazy")
// - 使用 srcset 提供多尺寸图片
// - 字体子集化 + font-display: swap

// 2. 代码优化
// - Tree Shaking 移除未使用代码
// - 代码分割 (Code Splitting)
// - 压缩 JS/CSS (Terser/CSSNano)
// - 内联关键 CSS

// 3. 网络优化
// - HTTP/2 多路复用
// - 预连接关键源 (rel="preconnect")
// - DNS 预解析 (rel="dns-prefetch")
// - 资源预加载 (rel="preload")
// - Service Worker 缓存

// 4. 渲染优化
// - 减少 DOM 节点数量
// - 避免 CSS 选择器过度复杂
// - 使用 will-change 提示浏览器
// - 避免布局抖动

// 5. 第三方脚本
// - 延迟加载非关键脚本
// - 使用 async/defer
// - 评估第三方脚本影响
// - 考虑自托管关键资源
```

---

## 6. Application 面板：存储与资源调试

### 6.1 Storage 调试

```javascript
// Application 面板 → Storage

// 1. Cookies
//    - 查看/编辑/删除 Cookie
//    - 设置 SameSite, Secure, HttpOnly
//    - 调试跨域 Cookie 问题

// 2. Local Storage / Session Storage
//    - 查看/编辑/删除键值对
//    - 监听 storage 事件
//    - 调试存储溢出问题

// 3. IndexedDB
//    - 查看数据库结构
//    - 查看/编辑数据
//    - 调试数据库版本升级

// 4. Cache Storage
//    - 查看 Service Worker 缓存
//    - 删除缓存条目
//    - 调试缓存策略

// 实战：调试 Cookie 问题
document.cookie = 'token=abc123; path=/; secure; samesite=strict';

// 在 Application 面板 → Cookies 中查看：
// - Name: token
// - Value: abc123
// - Domain: 当前域名
// - Path: /
// - Secure: ✓
// - SameSite: Strict
// - HttpOnly: ✗ (JS 可访问)

// 如果 Cookie 不生效，检查：
// 1. Domain 是否匹配
// 2. Path 是否匹配
// 3. Secure 标志（HTTP 下不发送）
// 4. SameSite 策略
// 5. 是否过期 (Expires/Max-Age)
```

### 6.2 Service Worker 调试

```javascript
// Application 面板 → Service Workers

// 功能：
// - 查看注册的 Service Worker
// - 更新/停止/取消注册
// - 模拟离线状态
// - 查看推送消息

// 调试技巧：
// 1. Update on reload — 每次刷新更新 SW
// 2. Bypass for network — 绕过 SW 直接请求网络
// 3. Offline — 模拟离线状态

// Service Worker 生命周期：
// install → waiting → activating → activated

// 常见调试场景：
// - 缓存未更新：点击 "Update" 按钮
// - 离线不工作：勾选 "Offline" 测试
// - 推送不收到：点击 "Push" 模拟推送
```

### 6.3 Manifest 调试

```javascript
// Application 面板 → Manifest

// 查看 PWA 配置：
// - name / short_name
// - start_url
// - display (fullscreen/standalone/minimal-ui/browser)
// - theme_color / background_color
// - icons (多尺寸图标)
// - orientation

// 调试 PWA 安装问题：
// 1. 检查 Manifest 是否有效
// 2. 检查 Service Worker 是否注册
// 3. 检查 HTTPS 环境
// 4. 检查图标是否齐全
```

---

## 7. Console 面板：高级调试技巧

### 7.1 Console API 高级用法

```javascript
// 基础方法：
console.log('普通日志');
console.info('信息日志');
console.warn('警告日志');
console.error('错误日志');
console.debug('调试日志');

// 格式化输出：
console.log('用户 %s 年龄 %d 岁', '张三', 25);
console.log('对象: %o', { name: '张三', age: 25 });
console.log('CSS 样式: %c 高亮文本', 'color: red; font-size: 20px;');

// 分组输出：
console.group('用户信息');
console.log('姓名: 张三');
console.log('年龄: 25');
console.groupEnd();

console.groupCollapsed('折叠的组');  // 默认折叠
console.log('点击展开查看');
console.groupEnd();

// 表格输出：
const users = [
  { name: '张三', age: 25, role: 'admin' },
  { name: '李四', age: 30, role: 'user' },
  { name: '王五', age: 28, role: 'user' }
];
console.table(users);  // 表格形式输出

// 计数：
function processItem(type) {
  console.count(type);  // 按类型计数
}
processItem('A');  // A: 1
processItem('B');  // B: 1
processItem('A');  // A: 2
console.countReset('A');  // 重置 A 的计数

// 计时：
console.time('数据处理');
// ... 处理数据 ...
console.timeEnd('数据处理');  // 数据处理: 123.456ms

// 追踪调用栈：
function foo() {
  console.trace('foo 被调用');
}
function bar() {
  foo();
}
bar();
// 输出：
// foo 被调用
//   foo @ script.js:2
//   bar @ script.js:5
//   (anonymous) @ script.js:8

// 断言：
console.assert(1 === 1, '这个不会输出');
console.assert(1 === 2, '这个会输出');  // Assertion failed: 这个会输出

// 内存信息（Chrome 专有）：
console.memory;  // { usedJSHeapSize: ..., totalJSHeapSize: ... }
```

### 7.2 Console 中的 $ 快捷方式

```javascript
// DevTools Console 内置快捷变量：

// $0 - $4: 最近 5 个 inspected 元素
// 在 Elements 面板选中元素 → Console 中用 $0 访问
// 每次选中新元素，$0 更新，旧的推到 $1, $2...

// $_: 上一个表达式的结果
1 + 2;  // 3
$_;     // 3 (上一个结果)

// $(): document.querySelector() 的简写
$('div');  // 等同于 document.querySelector('div')

// $$('selector'): document.querySelectorAll() 的简写
$$('div');  // 等同于 document.querySelectorAll('div')

// $x(xpath): XPath 查询
$x('//div[@class="container"]');

// keys(obj) / values(obj): 获取对象的键/值
const user = { name: '张三', age: 25 };
keys(user);   // ['name', 'age']
values(user); // ['张三', 25]

// copy(obj): 复制对象到剪贴板
copy({ name: '张三', age: 25 });  // 复制到剪贴板

// dir(obj): 以目录形式显示对象
dir(document.body);

// monitorEvents(element, events): 监听元素事件
monitorEvents(document.body, 'click');
// 每次点击 body 都会在 Console 输出事件对象
monitorEvents(document.body);  // 监听所有事件
unmonitorEvents(document.body);  // 停止监听
```

### 7.3 Snippets 面板

```javascript
// Sources 面板 → Snippets
// 可以保存和运行自定义脚本

// 示例 Snippet 1: 性能测试模板
(function() {
  const iterations = 1000000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    // 在这里放测试代码
  }

  const end = performance.now();
  console.log(`耗时: ${(end - start).toFixed(3)}ms`);
  console.log(`每次: ${((end - start) / iterations * 1000).toFixed(3)}μs`);
})();

// 示例 Snippet 2: 内存监控
(function() {
  const results = [];
  const interval = setInterval(() => {
    if (performance.memory) {
      results.push({
        time: Date.now(),
        used: performance.memory.usedJSHeapSize / 1024 / 1024,
        total: performance.memory.totalJSHeapSize / 1024 / 1024
      });
    }
  }, 1000);

  console.log('监控中... 运行 stopMonitoring() 停止');

  window.stopMonitoring = function() {
    clearInterval(interval);
    console.table(results);
    return results;
  };
})();

// 示例 Snippet 3: DOM 性能分析
(function() {
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      console.log(`${entry.name}: ${entry.duration.toFixed(2)}ms`);
    });
  });

  observer.observe({ entryTypes: ['measure', 'frame'] });
  console.log('DOM 性能监控已启动');
})();
```

---

## 8. Network 面板：请求调试与优化

### 8.1 Network 面板基础

```javascript
// Network 面板功能：
// - 查看所有网络请求
// - 查看请求/响应头
// - 查看请求/响应体
// - 查看 Timing 详情
// - 模拟网络条件
// - 请求拦截和修改

// 过滤选项：
// - All: 所有请求
// - XHR: XMLHttpRequest/Fetch
// - JS: JavaScript 文件
// - CSS: CSS 文件
// - Img: 图片
// - Media: 音视频
// - Font: 字体
// - Doc: 文档
// - WS: WebSocket
// - Other: 其他

// 列字段说明：
// - Name: 请求名称
// - Status: 状态码
// - Type: 资源类型
// - Initiator: 触发者
// - Size: 资源大小（传输大小）
// - Time: 请求耗时
// - Waterfall: 瀑布图
```

### 8.2 Timing 详解

```javascript
// 请求 Timing 分解：

// 1. Queuing (排队)
//    - 请求在队列中等待的时间
//    - 原因：连接数限制、优先级低
//    - 优化：HTTP/2、减少请求数

// 2. Stalled (停滞)
//    - 请求开始到发送之间的等待时间
//    - 原因：代理协商、DNS 缓存
//    - 优化：预连接、减少代理

// 3. DNS Lookup (DNS 查询)
//    - 域名解析时间
//    - 优化：dns-prefetch、减少域名数量

// 4. Initial connection (初始连接)
//    - TCP 握手 + TLS 协商
//    - 优化：HTTP/2、连接复用

// 5. SSL (SSL/TLS)
//    - TLS 握手时间
//    - 优化：TLS 1.3、会话复用

// 6. Request sent (发送请求)
//    - 发送请求数据的时间
//    - 优化：减少请求体大小

// 7. Service Worker Preparation
//    - Service Worker 启动时间
//    - 优化：优化 SW 启动逻辑

// 8. Waiting for server response (等待服务器响应)
//    - TTFB (Time to First Byte)
//    - 优化：服务端性能、CDN

// 9. Content Download (内容下载)
//    - 下载响应体的时间
//    - 优化：压缩、减少资源大小

// 10. Receiving Push (接收 Push)
//     - HTTP/2 Server Push 接收时间
```

### 8.3 网络条件模拟

```javascript
// Network 面板 → Throttling 下拉菜单

// 预设条件：
// - Online: 无限制
// - Fast 3G / Slow 3G / 2G: 模拟慢速网络
// - Offline: 离线模式

// 自定义条件：
// - Download: 下载速度 (KB/s)
// - Upload: 上传速度 (KB/s)
// - Latency: 延迟 (ms)
// - CPU throttling: CPU 限速 (4x/6x)

// 实战：测试慢速网络下的性能
// 1. 选择 "Slow 3G"
// 2. 刷新页面
// 3. 观察资源加载顺序
// 4. 优化关键路径
// 5. 对比优化前后的加载时间
```

### 8.4 请求拦截与修改

```javascript
// Network 面板 → 右键请求 → Block request URL
// 可以阻止特定请求

// 实战场景：
// 1. 测试无第三方脚本的性能
// 2. 测试广告不加载的页面
// 3. 测试 API 失败的降级逻辑

// Network 面板 → Overrides 标签
// 可以覆盖本地文件：
// 1. 添加文件夹到 Overrides
// 2. 修改文件内容
// 3. 刷新页面查看效果
// 4. 不需要重新部署！

// 实战：快速测试 CSS 修改
// 1. 将 CSS 文件保存到本地
// 2. 添加到 Overrides
// 3. 修改 CSS
// 4. 刷新页面立即生效
```

---

## 9. 实战演练场

### 演练 1：完整的性能分析流程

```javascript
// 场景：电商首页加载慢

// 步骤 1：建立基线
// - 清空缓存 (Application → Clear storage → Clear site data)
// - 禁用缓存 (Network → Disable cache)
// - 录制 Performance Profile

// 步骤 2：分析结果
// - LCP: 4.2s (目标 < 2.5s) ❌
// - TBT: 350ms (目标 < 200ms) ❌
// - CLS: 0.15 (目标 < 0.1) ❌

// 步骤 3：定位问题

// 问题 1：LCP 过大
// - 火焰图发现大量时间花在图片解码
// - 解决方案：
//   a. 使用 WebP 格式
//   b. 添加 <link rel="preload"> 预加载 LCP 图片
//   c. 使用 srcset 提供多尺寸

// 问题 2：TBT 过大
// - 火焰图发现长任务阻塞主线程
// - 解决方案：
//   a. 拆分长任务
//   b. 延迟加载非关键 JS
//   c. 使用 Web Worker

// 问题 3：CLS 过大
// - 发现图片未设置宽高导致布局偏移
// - 解决方案：
//   a. 设置图片宽高比
//   b. 使用 aspect-ratio CSS 属性
//   c. 预留骨架屏空间

// 步骤 4：实施优化
// 1. 图片优化：WebP + srcset + preload
// 2. 代码优化：Tree Shaking + 代码分割
// 3. 渲染优化：骨架屏 + 懒加载
// 4. 缓存优化：Service Worker + HTTP 缓存

// 步骤 5：验证效果
// - 重新录制 Performance Profile
// - LCP: 1.8s ✅
// - TBT: 120ms ✅
// - CLS: 0.02 ✅
```

### 演练 2：内存泄漏排查

```javascript
// 场景：SPA 应用运行一段时间后卡顿

// 步骤 1：确认泄漏
// - Memory 面板 → 录制 Allocation Timeline
// - 操作：切换页面 20 次
// - 观察：JS Heap Size 持续上升，GC 后无法回到基线

// 步骤 2：定位泄漏源
// - 拍摄两次 Heap Snapshot（切换 5 次 vs 切换 10 次）
// - Comparison 模式 → 按 Delta 排序
// - 发现 Detached div 数量持续增长

// 步骤 3：追踪引用链
// - 点击 Detached div → Retainers
// - 发现被 window.eventListeners 数组引用
// - 进一步发现是组件销毁时未移除事件监听器

// 步骤 4：修复代码
// 问题代码：
class PageComponent {
  constructor() {
    this.data = fetchData();
    document.addEventListener('scroll', this.onScroll);
    window.addEventListener('resize', this.onResize);
  }
  // 缺少 destroy 方法！
}

// 修复后：
class PageComponent {
  constructor() {
    this.data = fetchData();
    this.onScroll = this.onScroll.bind(this);
    this.onResize = this.onResize.bind(this);
    document.addEventListener('scroll', this.onScroll);
    window.addEventListener('resize', this.onResize);
  }

  destroy() {
    document.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
    this.data = null;
  }
}

// 步骤 5：验证修复
// - 重复步骤 1
// - 确认 JS Heap Size 稳定，GC 后回到基线
```

### 演练 3：断点调试复杂业务逻辑

```javascript
// 场景：购物车计算逻辑错误

// 问题代码：
function calculateCartTotal(items, coupon, shipping) {
  let subtotal = 0;

  items.forEach(item => {
    subtotal += item.price * item.quantity;
  });

  let discount = 0;
  if (coupon) {
    if (coupon.type === 'percentage') {
      discount = subtotal * (coupon.value / 100);
    } else if (coupon.type === 'fixed') {
      discount = coupon.value;
    }
  }

  // Bug: 折扣不应超过 subtotal
  const total = subtotal - discount + shipping;
  return Math.max(0, total);
}

// 调试步骤：
// 1. 在 return 行设置断点
// 2. 调用函数：
calculateCartTotal(
  [
    { price: 100, quantity: 2 },
    { price: 50, quantity: 3 }
  ],
  { type: 'percentage', value: 80 },  // 80% 折扣
  10  // 运费
);
// 3. 断点触发 → 检查变量
//    subtotal = 350
//    discount = 280 (350 * 0.8)
//    total = 350 - 280 + 10 = 80
// 4. 发现问题：80% 折扣后还要付运费，不合理
// 5. 修复：满额免运费逻辑

function calculateCartTotalFixed(items, coupon, shipping) {
  let subtotal = 0;
  items.forEach(item => {
    subtotal += item.price * item.quantity;
  });

  let discount = 0;
  if (coupon) {
    if (coupon.type === 'percentage') {
      discount = Math.min(subtotal * (coupon.value / 100), subtotal);
    } else if (coupon.type === 'fixed') {
      discount = Math.min(coupon.value, subtotal);
    }
  }

  // 满 200 免运费
  const finalShipping = subtotal >= 200 ? 0 : shipping;
  const total = subtotal - discount + finalShipping;
  return Math.max(0, total);
}
```

---

## 10. 面试高频考点

### 10.1 性能优化

```
Q1: 如何分析页面性能瓶颈？
A: Performance 面板录制 → 分析 Timeline → 查看长任务/布局/绘制 →
   火焰图定位热点函数 → Call Tree/Bottom-Up 分析调用链

Q2: 什么是 Long Task？如何优化？
A: 执行时间 > 50ms 的任务。优化：拆分任务 (requestIdleCallback/
   MessageChannel)、Web Worker、代码分割、延迟加载

Q3: 如何优化 LCP？
A: 预加载关键资源、优化图片格式 (WebP)、使用 CDN、服务端渲染、
   减少 TTFB、内联关键 CSS

Q4: 什么是 CLS？如何优化？
A: 累积布局偏移。优化：设置图片宽高、使用 aspect-ratio、
   避免动态插入内容、使用 transform 代替布局属性

Q5: 如何检测内存泄漏？
A: Memory 面板 → Heap Snapshot 对比 → 查看 Detached DOM trees →
   追踪引用链 → 定位泄漏源 → 修复后验证
```

### 10.2 调试技巧

```
Q6: 如何调试异步代码？
A: Pause on exceptions → Call Stack 展开 Async → 使用 debug() 函数
   断点 → 使用 "Restart frame" 重新执行

Q7: 什么是黑盒脚本？有什么用？
A: 将第三方库脚本加入黑盒列表，调试时自动跳过。用于聚焦自己的代码，
   避免在第三方库中断点

Q8: 如何找到事件绑定的位置？
A: Event Listener Breakpoints → 勾选对应事件 → 触发事件 →
   Call Stack 显示绑定位置

Q9: Console 中 $0 是什么？
A: 最近 inspect 的 DOM 元素。Elements 面板选中元素后，Console 中
   用 $0 访问，$1-$4 是之前 inspect 的元素

Q10: 如何监控元素的事件？
A: monitorEvents(element, events) → 在 Console 中输出所有事件 →
   unmonitorEvents(element) 停止
```

### 10.3 内存管理

```
Q11: JavaScript 垃圾回收机制？
A: Mark-and-Sweep (标记-清除)。从 GC Roots 开始遍历，标记可达对象，
   清除不可达对象。GC Roots 包括：全局对象、执行栈局部变量、
   事件监听器、闭包变量

Q12: 常见的内存泄漏模式？
A: 1) 意外全局变量  2) 未清理的定时器/回调
   3) 闭包引用大对象  4) DOM 引用未清理
   5) 事件监听器未移除  6) Cache 无限增长

Q13: WeakMap/WeakSet 的作用？
A: 弱引用，不会阻止 GC 回收。当键被 GC 回收时，对应的条目自动删除。
   适合缓存、DOM 关联数据等场景

Q14: 如何强制 GC？
A: Memory 面板 → ⚡ 按钮 (Collect garbage)。
   代码中：Chrome 启动参数 --expose-gc → globalThis.gc()
```

---

## 11. 自测题

### 选择题

```
1. 以下哪种断点会在 DOM 节点属性变化时触发？
   A. Line Breakpoint
   B. DOM Breakpoint → attributes modifications
   C. XHR Breakpoint
   D. Event Listener Breakpoint

2. Performance 面板中，火焰图的 Y 轴表示什么？
   A. 时间
   B. 调用栈深度
   C. 内存使用
   D. CPU 使用率

3. 以下哪个指标不属于 Core Web Vitals？
   A. LCP
   B. INP
   C. CLS
   D. TTFB

4. Heap Snapshot 中，Retained Size 表示什么？
   A. 对象自身大小
   B. 对象被 GC 后可回收的总大小
   C. 对象引用数量
   D. 对象创建时间

5. 以下哪种方式不会导致内存泄漏？
   A. 未移除的事件监听器
   B. 未取消的 setInterval
   C. WeakMap 缓存
   D. 闭包引用大对象

6. Console 中 $$('div') 等价于？
   A. document.querySelector('div')
   B. document.querySelectorAll('div')
   C. document.getElementById('div')
   D. document.createElement('div')

7. 优化 Layout Thrashing 的最佳实践是？
   A. 频繁读写 DOM 属性
   B. 批量读写，使用 DocumentFragment
   C. 使用 setTimeout 延迟
   D. 增加 CSS 复杂度

8. Service Worker 的哪个状态表示已激活？
   A. installing
   B. installed
   C. activating
   D. activated
```

**答案：1.B  2.B  3.D  4.B  5.C  6.B  7.B  8.D**

### 实操题

```
1. 使用 Performance 面板分析一个页面的加载性能，找出 LCP 元素并提出优化方案

2. 使用 Memory 面板检测一个 SPA 应用的内存泄漏，定位泄漏源并修复

3. 使用 Sources 面板的断点调试功能，调试一个异步数据流的问题

4. 使用 Network 面板模拟慢速网络，优化关键渲染路径

5. 使用 Console 的 monitorEvents 功能，分析一个复杂组件的事件流

6. 使用 Lighthouse 生成性能报告，针对得分低的项目提出优化方案

7. 使用 Coverage 面板分析代码覆盖率，移除未使用的 CSS/JS

8. 使用 Application 面板调试 Service Worker 缓存策略
```

---

## 附录：DevTools 设置推荐

```javascript
// Settings (F1) → 推荐配置

// Preferences:
// ✓ Enable advanced inspector features
// ✓ Show context menu in Inspect Mode
// ✓ Auto-completion in console
// ✓ Custom formatters
// ✓ Show timestamps in console timeline
// ✓ Show timestamps in console timestamps
// ✓ Log XMLHttpRequests
// ✓ Show network messages
// ✓ Show network timestamps
// ✓ Pause on caught exceptions (调试时开启)
// ✓ Show async stacks (调试异步代码)

// Experiments:
// ✓ Network panel: Waterfall column
// ✓ Performance: Memory overview
// ✓ Performance: Native memory tracing

// Dark mode: 推荐开启，减少眼睛疲劳
// Font size: 14px (可读性最佳)
// Theme: Dark (默认)
```

---

## 总结

| 技能 | 核心工具 | 关键指标 |
|------|---------|---------|
| 断点调试 | Sources 面板 | 断点类型、调用栈、黑盒脚本 |
| 性能分析 | Performance 面板 | LCP/INP/CLS/TBT、火焰图、长任务 |
| 内存检测 | Memory 面板 | Heap Snapshot、Detached DOM、引用链 |
| 综合审计 | Lighthouse | Core Web Vitals、优化建议 |
| 存储调试 | Application 面板 | Cookie/Storage/Service Worker |
| 请求调试 | Network 面板 | Timing、Throttling、拦截 |
| 高级 Console | Console 面板 | API 方法、快捷变量、Snippets |

**调试心法：**
1. **先复现，再定位** — 确保问题可稳定复现
2. **先测量，再优化** — 用数据说话，不要凭感觉
3. **先全局，后局部** — 从整体到细节逐步缩小范围
4. **先修复，再验证** — 修复后必须验证效果
5. **先预防，后治理** — 建立监控和预警机制

---

> 📊 本专项约 11,000 字，涵盖 Chrome DevTools 7 大面板的深度使用
> 🎯 核心能力：断点调试 / 性能分析 / 内存检测 / 请求调试
> 💡 实战价值：面试高频考点 + 日常开发必备技能
