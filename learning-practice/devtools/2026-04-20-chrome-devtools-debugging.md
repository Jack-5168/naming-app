# 🔧 Chrome DevTools 深度调试训练

**时间：** 2026-04-20 16:00  
**专项：** 调试技能  
**目标：** 掌握 Chrome DevTools 核心调试能力  
**重点：** 性能分析 / 内存泄漏检测 / 断点调试

---

## 📑 目录

1. [DevTools 概览](#devtools-概览)
2. [性能分析 (Performance)](#性能分析-performance)
3. [内存泄漏检测 (Memory)](#内存泄漏检测-memory)
4. [断点调试 (Sources)](#断点调试-sources)
5. [网络分析 (Network)](#网络分析-network)
6. [控制台高级技巧 (Console)](#控制台高级技巧-console)
7. [实战演练](#实战演练)

---

## DevTools 概览

### 打开方式

- **Windows/Linux:** `F12` 或 `Ctrl+Shift+I`
- **Mac:** `Cmd+Option+I`
- **右键菜单:** 页面右键 → "检查"
- **快捷键:** `Ctrl+Shift+C` (元素选择器)

### 核心面板

| 面板        | 用途                       | 快捷键   |
| ----------- | -------------------------- | -------- |
| Elements    | DOM/CSS 检查与编辑         | -        |
| Console     | 日志输出/交互式执行        | `Ctrl+`` |
| Sources     | 断点调试/代码查看          | -        |
| Network     | 网络请求分析               | -        |
| Performance | 性能分析/火焰图            | -        |
| Memory      | 内存分析/泄漏检测          | -        |
| Application | 存储/Cookie/Service Worker | -        |
| Lighthouse  | 性能/可访问性审计          | -        |

---

## 性能分析 (Performance)

### 使用场景

- 页面加载慢
- 滚动卡顿
- 动画不流畅
- 交互响应延迟

### 操作步骤

#### 1. 开始录制

```
1. 打开 Performance 面板
2. 点击左上角录制按钮 (●) 或 Ctrl+E
3. 执行要分析的操作
4. 点击停止按钮
```

#### 2. 关键指标解读

```
┌─────────────────────────────────────────────────────────┐
│  Performance 分析报告结构                                │
├─────────────────────────────────────────────────────────┤
│  📊 Summary (摘要)                                       │
│    - FPS: 帧率 (目标 60fps)                             │
│    - CPU: CPU 使用率                                     │
│    - Requests: 网络请求数                                │
│                                                         │
│  🔥 Flame Chart (火焰图)                                │
│    - 横轴：时间                                          │
│    - 纵轴：调用栈                                        │
│    - 颜色：不同任务类型                                  │
│                                                         │
│  📈 Timings (时间线)                                     │
│    - Loading: 资源加载                                   │
│    - Scripting: JS 执行                                  │
│    - Rendering: 渲染                                     │
│    - Painting: 绘制                                      │
│    - System: 系统任务                                    │
│                                                         │
│  💡 Bottom-Up (自底向上)                                │
│    - 按耗时排序的函数列表                                │
│    - 找出最耗时的函数                                    │
│                                                         │
│  📊 Event Log (事件日志)                                │
│    - 详细的事件记录                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 3. 性能问题诊断

**常见性能问题：**

```javascript
// ❌ 问题 1: 长任务 (Long Task > 50ms)
function processLargeArray(arr) {
  for (let i = 0; i < arr.length; i++) {
    // 同步处理大量数据
    heavyComputation(arr[i]);
  }
}

// ✅ 优化：分块处理
async function processLargeArray(arr) {
  const chunkSize = 100;
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    chunk.forEach((item) => heavyComputation(item));
    await new Promise((resolve) => setTimeout(resolve, 0)); // 让出主线程
  }
}
```

```javascript
// ❌ 问题 2: 强制同步布局 (Forced Synchronous Layout)
function updateElements() {
  elements.forEach((el) => {
    el.style.width = "100px";
    const height = el.offsetHeight; // 强制读取，触发重排
    el.style.height = height + "px";
  });
}

// ✅ 优化：批量读写分离
function updateElements() {
  // 第一批：所有写操作
  elements.forEach((el) => {
    el.style.width = "100px";
  });
  // 第二批：所有读操作
  const heights = elements.map((el) => el.offsetHeight);
  // 第三批：所有写操作
  elements.forEach((el, i) => {
    el.style.height = heights[i] + "px";
  });
}
```

```javascript
// ❌ 问题 3: 过度重绘
function animate() {
  element.style.top = `${position}px`; // 触发重排
  element.style.left = `${position}px`; // 触发重排
  element.style.width = `${size}px`; // 触发重排
  element.style.height = `${size}px`; // 触发重排
}

// ✅ 优化：使用 transform
function animate() {
  element.style.transform = `translate(${position}px, ${position}px) scale(${size})`;
  // transform 和 opacity 触发合成层，不触发重排
}
```

#### 4. Performance 面板实战技巧

**录制特定操作：**

```
1. 点击 "Web Vitals" 启用核心性能指标
2. 勾选 "Screenshots" 查看操作截图
3. 使用 "Start recording after..." 延迟录制
4. 使用 "Reload page" 录制页面加载
```

**分析火焰图：**

```
- 红色/黄色条：长任务，需要优化
- 灰色条：系统空闲
- 悬停查看函数详情
- 双击聚焦到特定区域
- 使用 WASD 键缩放和平移
```

---

## 内存泄漏检测 (Memory)

### 使用场景

- 页面使用时间越长越卡
- 内存占用持续增长
- 单页应用切换路由后内存不释放

### Memory 面板三种模式

```
┌─────────────────────────────────────────────────────────┐
│  Memory 面板模式                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📦 Heap Snapshot (堆快照)                              │
│    - 拍摄某一时刻的内存快照                              │
│    - 对比多个快照找出泄漏                                │
│    - 最常用，最准确                                      │
│                                                         │
│  📈 Allocation Timeline (分配时间线)                     │
│    - 实时记录内存分配                                    │
│    - 查看内存随时间变化                                  │
│    - 定位内存分配热点                                    │
│                                                         │
│  🔄 Allocation Sampling (分配采样)                       │
│    - 低开销采样模式                                      │
│    - 适合长时间监控                                      │
│    - 精度较低                                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 堆快照分析步骤

#### 步骤 1: 拍摄快照

```
1. 打开 Memory 面板
2. 选择 "Heap snapshot"
3. 点击 "Take snapshot"
4. 等待快照完成
```

#### 步骤 2: 对比快照

```
1. 执行可疑操作 (如：切换路由、打开关闭模态框)
2. 拍摄第二张快照
3. 重复操作，拍摄第三张快照
4. 在快照列表中选择第三张
5. 选择 "Comparison" 视图
6. 对比第一张快照
```

#### 步骤 3: 分析结果

**快照视图说明：**

```
┌─────────────────────────────────────────────────────────┐
│  快照视图类型                                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Summary (摘要)                                         │
│    - 按构造函数分组显示对象                              │
│    - 查看每类对象的数量和大小                            │
│                                                         │
│  Comparison (对比) ⭐ 最常用                            │
│    - 对比两个快照的差异                                  │
│    - #Delta: 对象数量变化                                │
│    - Size Delta: 内存大小变化                            │
│    - 正数 = 新增，负数 = 释放                            │
│                                                         │
│  Containment (包含)                                     │
│    - 从根节点查看对象引用关系                            │
│    - 查看 DOM 树结构                                     │
│                                                         │
│  Retainers (保留者)                                     │
│    - 查看是什么保留了这个对象                            │
│    - 找出泄漏源头                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 常见内存泄漏模式

#### 1. 全局变量泄漏

```javascript
// ❌ 泄漏：全局变量持续增长
var cache = [];

function fetchData() {
  fetch("/api/data")
    .then((res) => res.json())
    .then((data) => {
      cache.push(data); // 无限增长
    });
}

// ✅ 修复：限制缓存大小或使用 WeakMap
const cache = new WeakMap(); // 或使用 LRU 缓存
```

#### 2. 定时器未清理

```javascript
// ❌ 泄漏：组件销毁后定时器仍在运行
let intervalId;

function startTimer() {
  intervalId = setInterval(() => {
    updateUI();
  }, 1000);
}

// 忘记清理
// clearInterval(intervalId);

// ✅ 修复：组件卸载时清理
class Component {
  constructor() {
    this.intervalId = null;
  }

  startTimer() {
    this.intervalId = setInterval(() => {
      this.updateUI();
    }, 1000);
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
```

#### 3. 事件监听器未移除

```javascript
// ❌ 泄漏：事件监听器累积
function setupListener() {
  window.addEventListener("scroll", handleScroll);
  // 忘记移除
}

// ✅ 修复：成对添加/移除
class ScrollHandler {
  constructor() {
    this.handleScroll = this.handleScroll.bind(this);
  }

  init() {
    window.addEventListener("scroll", this.handleScroll);
  }

  destroy() {
    window.removeEventListener("scroll", this.handleScroll);
  }

  handleScroll() {
    // 处理滚动
  }
}
```

#### 4. 闭包引用

```javascript
// ❌ 泄漏：闭包持有大对象引用
function createHandler(largeData) {
  return function () {
    console.log(largeData); // largeData 被闭包引用
  };
}

const handler = createHandler(hugeArray);
// hugeArray 无法被 GC

// ✅ 修复：及时清除引用
function createHandler(largeData) {
  let dataRef = largeData;
  return function () {
    console.log(dataRef);
    dataRef = null; // 使用后清除
  };
}
```

#### 5. DOM 引用泄漏

```javascript
// ❌ 泄漏：JS 持有已删除 DOM 的引用
let cachedElement;

function cacheElement() {
  cachedElement = document.getElementById("temp");
  cachedElement.remove(); // DOM 已删除
  // 但 JS 仍持有引用，整个子树无法 GC
}

// ✅ 修复：DOM 删除后清除引用
function cacheElement() {
  cachedElement = document.getElementById("temp");
  const data = cachedElement.dataset;
  cachedElement.remove();
  cachedElement = null; // 清除引用
}
```

### 内存分析实战技巧

**使用 Console 辅助分析：**

```javascript
// 查看全局变量数量
console.log(Object.keys(window).length);

// 查看特定对象数量
console.log(document.querySelectorAll(".item").length);

// 强制垃圾回收 (需要在 DevTools 设置中启用)
// 1. DevTools 设置 → Preferences → Console
// 2. 勾选 "Enable custom formatters"
// 3. 在 Console 输入：
window.gc(); // 需要启动 Chrome 时加 --js-flags="--expose-gc"

// 查看内存使用
console.performance.memory;
// {
//   totalJSHeapSize: 8000000,
//   usedJSHeapSize: 5000000,
//   jsHeapSizeLimit: 40000000
// }
```

---

## 断点调试 (Sources)

### 断点类型

```
┌─────────────────────────────────────────────────────────┐
│  断点类型                                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📍 行断点 (Line Breakpoint)                            │
│    - 点击行号添加                                        │
│    - 代码执行到该行时暂停                                │
│                                                         │
│  🔷 条件断点 (Conditional Breakpoint)                   │
│    - 右键行号 → "Add conditional breakpoint"            │
│    - 输入条件表达式，为 true 时暂停                       │
│    - 例：i === 100, user.id === 123                     │
│                                                         │
│  🎯 DOM 断点 (DOM Breakpoint)                           │
│    - Elements 面板右键元素                               │
│    - Break on: subtree modifications/attribute changes  │
│    - DOM 变化时暂停                                      │
│                                                         │
│  🌐 XHR/Fetch 断点                                       │
│    - Sources 面板 → XHR/fetch breakpoints               │
│    - 输入 URL 关键词                                      │
│    - 匹配的请求时暂停                                    │
│                                                         │
│  ⚠️ 异常断点 (Exception Breakpoint)                     │
│    - Sources 面板右侧 ⚠️ 按钮                            │
│    - 抛出异常时暂停                                      │
│    - 可配置：捕获未捕获的异常                            │
│                                                         │
│  📦 事件监听器断点 (Event Listener Breakpoint)          │
│    - Sources 面板 → Event Listener Breakpoints          │
│    - 选择事件类型 (click, mouseover 等)                  │
│    - 事件触发时暂停                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 调试控制面板

```
┌─────────────────────────────────────────────────────────┐
│  调试控制按钮 (或快捷键)                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ▶️ Resume (F8)                                         │
│    - 继续执行，直到下一个断点                            │
│                                                         │
│  🦶 Step Over (F9)                                      │
│    - 单步执行，不进入函数内部                            │
│                                                         │
│  ⬇️ Step Into (F10)                                     │
│    - 进入函数内部                                        │
│    - 在函数调用处使用                                    │
│                                                         │
│  ⬆️ Step Out (Shift+F10)                                │
│    - 跳出当前函数                                        │
│    - 执行完剩余代码后暂停                                │
│                                                         │
│  🔄 Step (Ctrl+;)                                       │
│    - 单步步入                                            │
│                                                         │
│  📍 Toggle Breakpoint (Ctrl+B)                          │
│    - 切换当前行断点                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 调试技巧

#### 1. 使用 Console 作为调试工具

```javascript
// 打印变量
console.log("value:", value);

// 打印对象详情
console.dir(object);

// 表格形式打印数组/对象
console.table(users);

// 分组输出
console.group("User Data");
console.log("name:", user.name);
console.log("age:", user.age);
console.groupEnd();

// 性能计时
console.time("fetchData");
await fetchData();
console.timeEnd("fetchData");

// 断言
console.assert(value > 0, "Value should be positive");

// 追踪调用栈
console.trace();

// 计数
console.count("function called");
console.countReset("function called");
```

#### 2. 使用 Sources 面板编辑代码

```
1. 在 Sources 面板找到文件
2. 直接编辑代码
3. Ctrl+S 保存
4. 刷新页面生效

注意：仅用于调试，不会保存到源文件
```

#### 3. 使用 Watch 表达式

```
1. Sources 面板右侧 "Watch" 区域
2. 点击 "+" 添加表达式
3. 实时查看表达式值
4. 例：user.name, items.length, count > 10
```

#### 4. 使用 Scope 查看作用域

```
- Local: 当前作用域变量
- Closure: 闭包中的变量
- Global: 全局变量
- 悬停变量查看详细值
- 右键变量可 "Store as global variable" (temp1, temp2...)
```

#### 5. 使用 Blackbox 跳过库代码

```
1. Sources 面板设置 → Blackboxing
2. 添加模式：node_modules/.*
3. 调试时自动跳过这些文件
4. 只在自己的代码中断点
```

### 实战调试流程

```
1. 复现问题
   - 确定问题发生的操作步骤

2. 定位代码
   - 使用 Elements 面板找到相关元素
   - 查看事件监听器
   - 定位到 Sources 中的代码

3. 设置断点
   - 在可疑代码处设置断点
   - 或使用事件监听器断点

4. 执行到断点
   - 执行操作步骤
   - 代码在断点处暂停

5. 检查状态
   - 查看 Scope 中的变量
   - 使用 Watch 跟踪表达式
   - Console 中执行表达式

6. 单步调试
   - Step Over / Step Into / Step Out
   - 观察代码执行流程

7. 修复验证
   - 在 Sources 中临时修改代码
   - 验证修复效果
   - 回到编辑器修改源文件
```

---

## 网络分析 (Network)

### 使用场景

- 页面加载慢
- API 请求失败
- 资源加载错误
- 分析请求/响应内容

### Network 面板关键功能

```
┌─────────────────────────────────────────────────────────┐
│  Network 面板功能                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📋 请求列表                                            │
│    - Name: 资源名称                                      │
│    - Status: HTTP 状态码                                 │
│    - Type: 资源类型 (XHR, JS, CSS, Img...)              │
│    - Initiator: 发起者 (解析调用栈)                      │
│    - Size: 传输大小 / 实际大小                           │
│    - Time: 耗时                                          │
│    - Waterfall: 时间线详情                               │
│                                                         │
│  🔍 过滤器                                              │
│    - All/XHR/JS/CSS/Img/Media/Font/Doc/WS/Other         │
│    - 自定义过滤：-is:running, domain:api.example.com    │
│    - 隐藏数据 URL：-data:                               │
│                                                         │
│  📊 概览统计                                            │
│    - 总请求数                                            │
│    - 总传输大小                                          │
│    - 总耗时                                              │
│    - 按类型分类统计                                      │
│                                                         │
│  🔎 请求详情 (点击单个请求)                             │
│    - Headers: 请求/响应头                                │
│    - Preview: 响应预览                                   │
│    - Response: 原始响应                                  │
│    - Timing: 详细时间分解                                │
│    - Cookies: Cookie 详情                                │
│    - Initiator: 调用栈                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Timing 详解

```
┌─────────────────────────────────────────────────────────┐
│  请求时间分解                                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Queueing                                               │
│    - 请求在队列中等待的时间                              │
│    - HTTP/2 优先级调度                                   │
│                                                         │
│  Stalled                                                │
│    - 等待代理/SSL 握手                                   │
│                                                         │
│  DNS Lookup                                             │
│    - DNS 解析时间                                        │
│                                                         │
│  Initial Connection                                     │
│    - TCP 连接时间                                        │
│                                                         │
│  SSL                                                    │
│    - SSL/TLS 握手时间                                    │
│                                                         │
│  Request Write                                          │
│    - 发送请求数据时间                                    │
│                                                         │
│  Waiting (TTFB) ⭐ 关键指标                            │
│    - Time To First Byte                                  │
│    - 等待服务器响应的时间                                │
│    - 反映后端处理速度                                    │
│                                                         │
│  Content Download                                       │
│    - 接收响应数据时间                                    │
│    - 受带宽和资源大小影响                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 网络调试技巧

**模拟慢速网络：**

```
1. Network 面板 → "No throttling" 下拉
2. 选择预设：Fast 3G, Slow 3G, Offline
3. 或自定义：Add → 设置上下行速度和延迟
```

**禁用缓存：**

```
- 勾选 "Disable cache"
- 强制每次请求都从服务器获取
- 测试缓存策略
```

**拦截和修改请求：**

```
1. Sources 面板 → Overrides
2. 选择本地文件夹
3. 授权访问
4. Network 面板右键请求 → "Save as override"
5. 修改响应内容
6. 刷新页面使用修改后的响应
```

**重放请求：**

```
1. Network 面板右键请求
2. 选择 "Replay XHR" 或 "Replay Fetch"
3. 重新发送相同请求
```

**复制请求为代码：**

```
1. Network 面板右键请求
2. Copy → "Copy as fetch" / "Copy as cURL"
3. 粘贴到 Console 或其他地方重用
```

---

## 控制台高级技巧 (Console)

### Console API 大全

```javascript
// 基础输出
console.log("普通日志");
console.info("信息");
console.warn("警告");
console.error("错误");
console.debug("调试");

// 格式化输出
console.log("用户：%s, 年龄：%d", name, age);
// %s 字符串，%d 数字，%o 对象，%O 对象详情，%c CSS 样式

// CSS 样式输出
console.log("%c 重要消息 ", "background: red; color: white; font-size: 20px");

// 对象详情
console.dir(element); // DOM 元素详情
console.dirxml(element); // XML 格式

// 表格输出
console.table([
  { name: "Alice", age: 25 },
  { name: "Bob", age: 30 },
]);

// 分组
console.group("用户信息");
console.log("name:", user.name);
console.log("email:", user.email);
console.groupEnd();

// 嵌套分组
console.group("Level 1");
console.group("Level 2");
console.log("Deep log");
console.groupEnd();
console.groupEnd();

// 计时
console.time("operation");
// ... 执行代码
console.timeEnd("operation"); // 输出：operation: 12.345ms

// 多次计时
console.time("loop");
for (let i = 0; i < 1000; i++) {}
console.timeEnd("loop");

// 计数
console.count("点击次数");
console.count("点击次数");
console.countReset("点击次数");

// 断言
console.assert(age >= 0, "年龄不能为负数");
// 只在条件为 false 时输出

// 调用栈追踪
function a() {
  b();
}
function b() {
  c();
}
function c() {
  console.trace();
}
a();
// 输出完整调用栈

// 清除控制台
console.clear();
```

### Console 实用功能

**$ 系列快捷命令：**

```javascript
// 选择元素
$("selector"); // 等同于 document.querySelector()
$$("selector"); // 等同于 document.querySelectorAll()

// 最近选中的元素
$0; // 当前在 Elements 面板选中的元素
$1; // 上一个选中的元素
($2, $3, $4); // 更早选中的元素

// 查看事件监听器
getEventListeners(element);
// 返回：{ click: [...], mouseover: [...] }

// 复制元素
copy(element); // 将元素复制到剪贴板

// 查看对象属性
keys(object); // 返回所有键
values(object); // 返回所有值

// 强制垃圾回收
window.gc(); // 需要 --expose-gc 标志

// 性能内存
console.performance.memory;
```

**条件输出：**

```javascript
// 只在开发环境输出
if (process.env.NODE_ENV === "development") {
  console.log("Debug info:", data);
}

// 只在满足条件时输出
console.log(condition ? "满足条件" : "");
```

---

## 实战演练

### 场景 1: 页面加载性能优化

**问题：** 首页加载需要 5 秒

**诊断步骤：**

```
1. 打开 Network 面板，勾选 "Disable cache"
2. 刷新页面，记录总加载时间
3. 按 Size 排序，找出最大的资源
4. 按 Time 排序，找出最慢的请求
5. 查看 Waterfall，分析瓶颈
6. 打开 Performance 面板，录制页面加载
7. 分析火焰图，找出长任务
```

**常见问题和解决方案：**

```
- 大图片 → 压缩图片，使用 WebP 格式
- 未压缩 JS/CSS → 启用 Gzip/Brotli
- 过多请求 → 合并文件，使用雪碧图
- 阻塞渲染 → 异步加载 JS，内联关键 CSS
- 长任务 → 代码分割，懒加载
```

### 场景 2: 内存泄漏排查

**问题：** 单页应用使用 10 分钟后变卡

**诊断步骤：**

```
1. 打开 Memory 面板
2. 拍摄第一张堆快照 (初始状态)
3. 执行可疑操作 (切换路由/打开关闭模态框)
4. 拍摄第二张快照
5. 重复操作 3-4 次
6. 拍摄第三张快照
7. 对比快照 1 和 3
8. 查看 Delta 为正数的对象
9. 使用 Retainers 视图找出引用链
10. 定位泄漏源头
```

### 场景 3: 异步 Bug 调试

**问题：** 数据有时加载失败，难以复现

**调试方法：**

```javascript
// 方法 1: 添加条件断点
// 在 Promise 的 then/catch 处右键 → Add conditional breakpoint
// 输入：error !== undefined

// 方法 2: 使用 async/await + try/catch
async function fetchData() {
  try {
    const response = await fetch("/api/data");
    const data = await response.json();
    console.log("成功:", data);
  } catch (error) {
    console.error("失败:", error);
    debugger; // 自动断点
    throw error;
  }
}

// 方法 3: 使用 Promise 的全局错误处理
window.addEventListener("unhandledrejection", (event) => {
  console.error("未处理的 Promise 拒绝:", event.reason);
  debugger;
});
```

### 场景 4: CSS 布局问题

**问题：** 元素位置不对，但看不出原因

**调试方法：**

```
1. Elements 面板选中元素
2. 查看 Computed 面板
   - 查看实际计算的样式
   - 查看盒模型 (margin/border/padding/content)
   - 查看继承的样式
3. 查看 Styles 面板
   - 查看应用的 CSS 规则
   - 查看被覆盖的规则 (划掉的)
   - 实时编辑样式测试
4. 使用元素选择器 (Ctrl+Shift+C)
   - 直接点击页面元素
5. 查看 Layout 面板 (新版 DevTools)
   - 查看 flexbox/grid 布局详情
   - 查看对齐和间距
```

### 场景 5: 事件处理问题

**问题：** 点击按钮没反应

**调试方法：**

```
1. Elements 面板选中按钮
2. 右侧 "Event Listeners" 面板
   - 查看绑定的所有事件
   - 展开查看监听器代码位置
   - 点击代码跳转 Sources
3. 如果没看到监听器：
   - 可能是动态绑定的
   - 使用 getEventListeners($0) 在 Console 查看
4. 设置事件监听器断点：
   - Sources → Event Listener Breakpoints
   - 勾选 Mouse → click
   - 点击按钮会暂停在事件处理函数
5. 检查事件是否被阻止：
   - 在事件处理函数中设置断点
   - 单步执行查看是否调用了 preventDefault()
   - 检查是否有事件冒泡问题
```

---

## 📊 学习总结

### 核心技能掌握

| 技能             | 掌握程度   | 关键要点                                 |
| ---------------- | ---------- | ---------------------------------------- |
| Performance 分析 | ⭐⭐⭐⭐   | 火焰图解读、长任务识别、优化建议         |
| Memory 泄漏检测  | ⭐⭐⭐⭐   | 堆快照对比、Retainers 分析、常见泄漏模式 |
| Sources 断点调试 | ⭐⭐⭐⭐⭐ | 各类断点、单步调试、Watch/Scope          |
| Network 分析     | ⭐⭐⭐⭐   | Timing 分析、过滤、模拟网络              |
| Console 高级用法 | ⭐⭐⭐⭐⭐ | 格式化输出、$命令、调试技巧              |

### 常用快捷键速查

```
F12          - 打开/关闭 DevTools
Ctrl+Shift+C - 元素选择器
Ctrl+`       - 打开/关闭 Console
Ctrl+E       - 开始/停止 Performance 录制
F8           - 继续执行
F9           - Step Over
F10          - Step Into
Shift+F10    - Step Out
Ctrl+B       - 切换断点
Ctrl+Shift+F - 全局搜索
```

### 最佳实践

1. **性能优化：** 先测量，再优化。用数据说话。
2. **内存泄漏：** 定期拍摄快照对比，早发现早修复。
3. **断点调试：** 条件断点比 console.log 更高效。
4. **网络分析：** 关注 TTFB 和水线图中的瓶颈。
5. **Console 输出：** 结构化输出，便于阅读和过滤。

---

## 🎯 课后练习

1. 找一个加载慢的页面，用 Performance 分析并给出优化建议
2. 创建一个有内存泄漏的示例，用 Memory 面板找出泄漏点
3. 调试一个异步 Bug，使用条件断点和 async/await
4. 分析一个 API 请求的完整 Timing，找出可优化的环节
5. 使用 Console 的高级功能输出结构化的调试信息

---

**训练时长：** 16:00 - 17:00 (60 分钟)  
**笔记字数：** 约 6000 字  
**代码示例：** 40+ 个

---

_下一专项：17:00 Git 进阶_
