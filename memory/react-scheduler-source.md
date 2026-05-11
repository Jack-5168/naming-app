# React Scheduler 源码精读笔记

> 精读时间：2026-05-10 04:00 AM
> 源码版本：React 18+ (scheduler v0.23+)
> 核心文件：`scheduler/src/forks/Scheduler*.js`
> 前置知识：React Fiber 架构、Lane 优先级模型、requestIdleCallback

---

## 一、Scheduler 是什么？为什么需要它？

### 1.1 问题背景

在 React 15 及之前，reconciliation 是**同步递归**的——一旦开始就不能中断。这导致：
- 大型组件树更新会阻塞主线程 ≥100ms
- 用户交互（输入、点击）响应迟钝
- 动画掉帧

React 16 引入 Fiber 架构后，reconciliation 变成了**可中断的链表遍历**。但谁来决定"什么时候工作、什么时候让出"？

**答案：Scheduler。**

### 1.2 Scheduler 的职责

```
┌─────────────────────────────────────────────┐
│              Scheduler (调度器)              │
│                                              │
│  1. 接收任务（按优先级分类）                  │
│  2. 决定执行时机（立即/延迟/空闲时）           │
│  3. 时间切片（每片 ~5ms，让出给浏览器渲染）    │
│  4. 超时降级（高优先级任务超时则提升执行）      │
│  5. 任务取消/暂停/恢复                       │
└─────────────────────────────────────────────┘
         ↑ 任务注入          ↓ 执行回调
   React Fiber 层      requestAnimationFrame
                       MessageChannel / setTimeout
```

**核心设计哲学：Scheduler 不关心"任务做什么"，只关心"什么时候做"。**

---

## 二、核心数据结构

### 2.1 Task 对象

```javascript
// scheduler/src/SchedulerPriorities.js
export const ImmediatePriority = 1;
export const UserBlockingPriority = 2;
export const NormalPriority = 3;
export const LowPriority = 4;
export const IdlePriority = 5;

// scheduler/src/Scheduler.js
function createTask(priorityLevel, callback, options) {
  return {
    id: taskIdCounter++,                    // 全局递增 ID
    callback,                               // 实际要执行的函数
    priorityLevel,                          // 优先级 1-5
    startTime: startTime,                   // 任务创建时间
    expirationTime: expirationTime,         // 超时时间（优先级越高越短）
    sortIndex: expirationTime,              // 排序索引（用于堆排序）
    isQueued: false,                        // 是否已在任务队列中
  };
}
```

**关键洞察：`sortIndex = expirationTime`**——这意味着堆顶永远是**最早过期**的任务，而不是最高优先级的任务。优先级通过影响 expirationTime 间接影响排序。

### 2.2 双堆结构

Scheduler 维护**两个最小堆**：

```javascript
// 任务队列（按 expirationTime 排序的最小堆）
let taskQueue = [];
// 延迟任务队列（按 startTime 排序的最小堆）
let timerQueue = [];
```

**为什么需要两个堆？**

- `taskQueue`：已到期、等待执行的任务
- `timerQueue`：尚未到期（延迟调度）的任务

```
                    timerQueue (按 startTime 排序)
                    ┌─────────┐
    scheduleDelayed ─→│ Task B  │ startTime: t+100ms
                      │ (延迟)  │
                      └─────────┘
                         ↓ (t+100ms 到期)
                    ┌─────────┐
                    │ Task B  │ 移入 taskQueue
                    └─────────┘

                    taskQueue (按 expirationTime 排序)
                    ┌─────────┐
    workLoop ──────→│ Task A  │ expirationTime: 最早
                    │ (就绪)  │
                    └─────────┘
                      ↓ 执行
                    ┌─────────┐
                    │ Task C  │ expirationTime: 次早
                    └─────────┘
```

### 2.3 堆操作（核心算法）

```javascript
// 最小堆上浮（插入后维护堆性质）
function siftUp(heap, node, index) {
  while (true) {
    const parentIndex = (index - 1) >>> 1;  // 父节点索引
    if (parentIndex >= 0) {
      const parent = heap[parentIndex];
      if (compare(parent, node) > 0) {      // 父节点 > 子节点，交换
        heap[parentIndex] = node;
        heap[index] = parent;
        index = parentIndex;
        continue;
      }
    }
    break;
  }
}

// 最小堆下沉（删除堆顶后维护堆性质）
function siftDown(heap, node, index) {
  const length = heap.length;
  const halfLength = length >>> 1;
  while (index < halfLength) {
    const leftIndex = (index + 1) * 2 - 1;  // 左子节点
    const left = heap[leftIndex];
    const rightIndex = leftIndex + 1;       // 右子节点
    const right = heap[rightIndex];

    // 找左右子节点中较小的
    if (compare(left, node) < 0) {
      if (right !== undefined && compare(right, left) < 0) {
        heap[index] = right;
        heap[rightIndex] = node;
        index = rightIndex;
      } else {
        heap[index] = left;
        heap[leftIndex] = node;
        index = leftIndex;
      }
    } else if (right !== undefined && compare(right, node) < 0) {
      heap[index] = right;
      heap[rightIndex] = node;
      index = rightIndex;
    } else {
      break;
    }
  }
}
```

**时间复杂度：插入 O(log n)，删除堆顶 O(log n)，取堆顶 O(1)**

---

## 三、任务调度流程（逐行精读）

### 3.1 任务注入：scheduleCallback

```javascript
function unstable_scheduleCallback(priorityLevel, callback, options) {
  // ── 第 1 步：计算 startTime ──
  // options.delay 支持延迟调度（如 setTimeout 效果）
  let currentTime = getCurrentTime();
  let startTime;
  if (typeof options === 'object' && options !== null) {
    let delay = options.delay;
    startTime =
      typeof delay === 'number' && delay > 0
        ? currentTime + delay
        : currentTime;
  } else {
    startTime = currentTime;
  }

  // ── 第 2 步：计算 expirationTime ──
  // 不同优先级对应不同的超时时间
  let timeout;
  switch (priorityLevel) {
    case ImmediatePriority:
      timeout = IMMEDIATE_PRIORITY_TIMEOUT;  // -1 (立即执行，不超时)
      break;
    case UserBlockingPriority:
      timeout = USER_BLOCKING_PRIORITY_TIMEOUT;  // 250ms
      break;
    case IdlePriority:
      timeout = IDLE_PRIORITY_TIMEOUT;  // 1073741823ms (~12.4天)
      break;
    case LowPriority:
      timeout = LOW_PRIORITY_TIMEOUT;  // 10000ms (10秒)
      break;
    case NormalPriority:
    default:
      timeout = NORMAL_PRIORITY_TIMEOUT;  // 5000ms (5秒)
  }
  let expirationTime = startTime + timeout;

  // ── 第 3 步：创建 Task 对象 ──
  let newTask = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: expirationTime,
    isQueued: false,
  };

  // ── 第 4 步：根据 startTime 决定放入哪个堆 ──
  if (startTime > currentTime) {
    // 延迟任务 → 放入 timerQueue
    newTask.sortIndex = startTime;
    push(timerQueue, newTask);
    // 如果 taskQueue 为空，检查是否需要唤醒调度器
    if (peek(taskQueue) === null) {
      const timerCallback = timerTick.bind(null, newTask);
      newTask.timer = timerIDCounter++;
      timerQueueOrderingKey = timerCallback;
      setTimeout(timerCallback, startTime - currentTime);
    }
  } else {
    // 立即任务 → 放入 taskQueue
    push(taskQueue, newTask);
    // 如果当前没有在执行 workLoop，请求执行
    if (!isHostCallbackScheduled && !isPerformingWork) {
      requestHostCallback(flushWork);
    }
  }

  return newTask;
}
```

**逐行分析要点：**

| 行 | 作用 | 设计意图 |
|---|------|---------|
| `startTime = currentTime + delay` | 支持延迟调度 | 让低优先级任务可以延迟执行，给高优先级让路 |
| `timeout` 按优先级分级 | 不同优先级不同超时 | Immediate 不超时（同步执行），Idle 几乎永不过期 |
| `sortIndex = expirationTime` | 堆排序依据 | 最早过期的任务优先执行（EDF 算法） |
| `startTime > currentTime` 分支 | 延迟任务走 timerQueue | 避免未到期任务阻塞就绪任务 |
| `peek(taskQueue) === null` 时设定时器 | 唤醒机制 | 确保延迟任务到期后能被调度 |
| `!isHostCallbackScheduled` 检查 | 防重入 | 避免重复请求浏览器调度 |

### 3.2 浏览器适配层：requestHostCallback

Scheduler 需要跨环境运行（浏览器、Node.js、React Native），所以抽象了 `requestHostCallback`：

```javascript
// ── 现代浏览器：使用 MessageChannel ──
// scheduler/src/forks/Scheduler.js

if (typeof MessageChannel !== 'undefined') {
  const channel = new MessageChannel();
  const port = channel.port2;
  channel.port1.onmessage = performWorkUntilDeadline;
  
  requestHostCallback = function(callback) {
    scheduledHostCallback = callback;
    port.postMessage(null);  // 微任务级别触发
  };
  
  cancelHostCallback = function() {
    scheduledHostCallback = null;
  };
} else {
  // 降级：使用 setTimeout
  requestHostCallback = function(callback) {
    scheduledHostCallback = callback;
    scheduledTimeoutId = setTimeout(performWorkUntilDeadline, 0);
  };
}
```

**为什么用 MessageChannel 而不是 setTimeout？**

| 特性 | MessageChannel | setTimeout(fn, 0) |
|------|---------------|-------------------|
| 执行时机 | 微任务之后、宏任务之前 | 下一个宏任务 |
| 延迟 | ~0-2ms | 4-10ms（浏览器最小延迟） |
| 可靠性 | 不受节流影响 | 后台标签页会被节流到 1000ms |
| 优先级 | 高于 setTimeout | 最低 |

**关键洞察：React 选择 MessageChannel 是因为它比 setTimeout 更快、更可靠，但又比 Promise.then（微任务）更可控——微任务无法让出主线程，而 Scheduler 需要精确控制时间片。**

### 3.3 核心调度循环：flushWork

```javascript
function flushWork(hasTimeRemaining, initialTime) {
  // ── 第 1 步：标记正在执行 ──
  isHostCallbackScheduled = true;
  isPerformingWork = true;
  previousPriorityLevel = currentPriorityLevel;

  try {
    // ── 第 2 步：执行 workLoop ──
    // hasTimeRemaining 由 requestAnimationFrame 传入
    // 表示当前帧是否还有剩余时间
    return workLoop(hasTimeRemaining, initialTime);
  } finally {
    // ── 第 3 步：清理状态 ──
    isPerformingWork = false;
    currentTask = null;
    currentPriorityLevel = previousPriorityLevel;
    isHostCallbackScheduled = false;

    // 如果 timerQueue 中有任务，设置下一个唤醒定时器
    if (timerQueue.length > 0) {
      advanceTimers(getCurrentTime());
    }
  }
}
```

### 3.4 工作循环：workLoop（核心中的核心）

```javascript
function workLoop(hasTimeRemaining, initialTime) {
  let currentTime = initialTime;
  // 先将 timerQueue 中已到期的任务移入 taskQueue
  advanceTimers(currentTime);
  currentTask = peek(taskQueue);

  while (currentTask !== null) {
    // ── 情况 A：任务还没到期（延迟任务）──
    if (currentTask.startTime > currentTime) {
      // 设置定时器，等任务到期后再唤醒
      const delay = currentTask.startTime - currentTime;
      if (delay > 0) {
        // 请求下一次调度
        requestHostCallback(flushWork);
        break;
      }
    }

    // ── 情况 B：任务已到期，检查是否超时 ──
    const shouldYield = shouldYieldToHost();
    // shouldYield 判断：当前帧是否还有时间
    // 默认每帧 5ms（约 120fps），hasTimeRemaining 为 false 时立即让出

    if (
      !shouldYield ||           // 还有时间，继续执行
      shouldYieldForHydration() // 或需要 hydration
    ) {
      // ── 执行任务回调 ──
      const callback = currentTask.callback;
      if (typeof callback === 'function') {
        currentTask.callback = null;
        currentIsPending = false;
        currentPriorityLevel = currentTask.priorityLevel;
        currentStartTime = currentTask.startTime;

        // 执行回调，可能有返回值（表示还有后续工作）
        const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
        const continuationCallback = callback(didUserCallbackTimeout);
        currentTime = getCurrentTime();

        // ── 处理返回值 ──
        if (typeof continuationCallback === 'function') {
          // 任务未完成，保存剩余工作
          currentTask.callback = continuationCallback;
        } else {
          // 任务完成，从队列移除
          if (currentTask === peek(taskQueue)) {
            pop(taskQueue);
          }
        }
      } else {
        // 回调已被取消
        pop(taskQueue);
      }
    } else {
      // ── 情况 C：时间片用尽，让出主线程 ──
      // 请求下一帧继续执行
      if (shouldYield) {
        requestHostCallback(flushWork);
      }
      break;
    }

    // 处理 timerQueue 中新增的到期任务
    advanceTimers(currentTime);
    currentTask = peek(taskQueue);
  }

  // 所有任务处理完毕
  if (currentTask !== null) {
    return true;  // 还有任务，通知宿主继续调度
  } else {
    return false;  // 所有任务完成
  }
}
```

**逐行分析要点：**

| 关键逻辑 | 作用 | 类比 |
|---------|------|------|
| `advanceTimers(currentTime)` | 延迟→就绪 | 快递分拣：到站的包裹移到待取区 |
| `shouldYieldToHost()` | 时间片检查 | 红绿灯：时间到就停车让行 |
| `callback(didUserCallbackTimeout)` | 执行 Fiber 工作 | 执行一个 chunk 的 reconciliation |
| `continuationCallback` | 分片续传 | 大文件上传断点续传 |
| `requestHostCallback(flushWork)` | 请求下一帧 | 预约下次执行 |

### 3.5 时间片判断：shouldYieldToHost

```javascript
// 每帧可用时间（毫秒）
const frameInterval = 5;  // 默认 5ms，留给浏览器渲染/用户交互

let frameDeadline = 0;
let needsPaint = false;

function shouldYieldToHost() {
  const currentTime = getCurrentTime();
  // 如果当前帧 deadline 已过，需要重新获取
  if (currentTime >= frameDeadline) {
    // 如果还没请求 paint，请求一帧
    if (!needsPaint) {
      needsPaint = true;
      requestAnimationFrame(performPaint);
    }
    // 当前时间已超过 deadline，必须让出
    return true;
  }
  return false;
}

function performPaint() {
  needsPaint = false;
  // 获取下一帧的开始时间
  let startTime = performance.now();
  // deadline = 当前时间 + 帧间隔
  frameDeadline = startTime + frameInterval;
}
```

**关键洞察：`frameInterval = 5ms` 是精心选择的**

- 60fps 下每帧 16.67ms
- 5ms 给 Scheduler 工作
- 剩余 11.67ms 给浏览器渲染、布局、用户交互
- 如果用户交互到来，Scheduler 会立即让出

**这就是 React 18 并发特性的核心：不是"一次性做完"，而是"做 5ms，让一下，再做 5ms"。**

---

## 四、优先级提升机制（Priority Expired Tasks）

### 4.1 问题：低优先级任务可能永远不被执行

如果持续有高优先级任务注入，低优先级任务会饿死。Scheduler 的解决方案：

```javascript
// 当任务过期时，提升其优先级
function advanceTimers(currentTime) {
  let timer = peek(timerQueue);
  while (timer !== null) {
    if (timer.callback === null) {
      // 任务被取消
      pop(timerQueue);
    } else if (timer.startTime <= currentTime) {
      // 任务到期，移入 taskQueue
      pop(timerQueue);
      timer.sortIndex = timer.expirationTime;
      push(taskQueue, timer);
      if (!isHostCallbackScheduled && !isPerformingWork) {
        requestHostCallback(flushWork);
      }
    } else {
      // timerQueue 按 startTime 排序，后面的也没到期
      return;
    }
    timer = peek(timerQueue);
  }
}
```

### 4.2 超时降级：expirationTime 的作用

```
任务创建时:
  NormalPriority → timeout = 5000ms → expirationTime = startTime + 5000
  5 秒后，shouldYieldToHost 不再检查时间片，直接执行（超时任务优先级提升）

UserBlockingPriority → timeout = 250ms
  250ms 后，同样不再让出

ImmediatePriority → timeout = -1
  立即执行，永远不让出（同步）
```

**设计哲学：超时 = 优先级提升。** 一个 Normal 任务等了 5 秒还没执行，说明系统可能太忙了，此时应该提升为"紧急"状态执行。

---

## 五、与 Fiber 的协作

### 5.1 Fiber 如何向 Scheduler 注册任务

```javascript
// ReactFiberWorkLoop.js

function scheduleUpdateOnFiber(fiber, lane, eventTime) {
  // ... 省略向上标记更新逻辑

  // 根据 lane 计算优先级
  const priorityLevel = lanesToEventPriority(lane);

  // 向 Scheduler 注册工作
  ensureRootIsScheduled(root, eventTime);
}

function ensureRootIsScheduled(root, currentTime) {
  // 计算下一个到期时间
  const expirationTime = computeExpirationForFiber(currentTime, root);

  // 选择优先级
  const newCallbackNode = scheduleCallback(
    schedulerPriorityLevel,
    performConcurrentWorkOnRoot.bind(null, root)
  );

  // 保存引用，用于取消
  root.callbackNode = newCallbackNode;
  root.callbackPriority = lane;
}
```

### 5.2 performConcurrentWorkOnRoot — Fiber 与 Scheduler 的桥梁

```javascript
function performConcurrentWorkOnRoot(root) {
  // ── 第 1 步：检查是否有 pending 的 hydration ──
  const didFlushPassiveEffects = flushPassiveEffects();
  if (didFlushPassiveEffects) {
    return null;  // 让出，等下一帧
  }

  // ── 第 2 步：检查是否需要降级优先级 ──
  // 如果上次渲染被中断，检查是否超时
  const originalCallbackNode = root.callbackNode;
  const lanes = getNextLanes(root, root.pendingLanes);
  if (lanes === NoLanes) {
    return null;
  }

  // ── 第 3 步：执行 render 阶段 ──
  // 这里会调用 workLoopConcurrent，每处理一个 Fiber 节点就检查 shouldYield
  const exitStatus = renderRootConcurrent(root, lanes);

  // ── 第 4 步：根据 exitStatus 决定下一步 ──
  if (root.exitStatus !== RootIncomplete) {
    // 渲染完成或出错，进入 commit 阶段
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLanes = lanes;
    commitRoot(root);
  } else {
    // 渲染被中断（时间片用尽），返回 continuation 回调
    // Scheduler 会在下一帧继续调用这个回调
    return performConcurrentWorkOnRoot.bind(null, root);
  }
}
```

**关键洞察：`performConcurrentWorkOnRoot` 的返回值就是 Scheduler 的 `continuationCallback`**

- 返回 `null` → 任务完成，从队列移除
- 返回函数 → 任务未完成，Scheduler 在下一帧继续调用

```
Scheduler                    Fiber
  │                            │
  ├─ scheduleCallback ────────→│ 注册 performConcurrentWorkOnRoot
  │                            │
  ├─ workLoop 开始 ───────────→│ 执行 performConcurrentWorkOnRoot
  │                            │  ├─ renderRootConcurrent (5ms)
  │                            │  │   ├─ workLoopConcurrent
  │                            │  │   │   ├─ beginWork (Fiber A)
  │                            │  │   │   ├─ beginWork (Fiber B)
  │                            │  │   │   └─ shouldYield? → yes!
  │                            │  │   └─ 返回 RootIncomplete
  │                            │  └─ 返回 continuationCallback
  │←─ 收到 continuation ───────│
  │                            │
  ├─ 让出主线程（渲染/交互）    │
  │                            │
  ├─ 下一帧 ──────────────────→│ 继续 performConcurrentWorkOnRoot
  │                            │  ├─ renderRootConcurrent (继续)
  │                            │  │   ├─ beginWork (Fiber C)
  │                            │  │   └─ shouldYield? → no
  │                            │  └─ 返回 null (完成)
  │←─ 任务完成 ────────────────│
```

---

## 六、关键算法总结

### 6.1 EDF（Earliest Deadline First）调度算法

Scheduler 使用 **EDF 算法**——最早过期的任务优先执行。

```
任务列表:
  Task A: expirationTime = t+100ms  (sortIndex = t+100)
  Task B: expirationTime = t+50ms   (sortIndex = t+50)
  Task C: expirationTime = t+200ms  (sortIndex = t+200)

最小堆排序后:
  [Task B, Task A, Task C]  ← 堆顶 = Task B (最早过期)

执行顺序: B → A → C
```

**为什么不用优先级排序？**

因为优先级是"静态"的，而 expirationTime 是"动态"的。一个低优先级任务如果等了很久，它的 expirationTime 会越来越近，最终排在堆顶。这保证了**公平性**——没有任务会永远饿死。

### 6.2 时间切片算法

```javascript
// 伪代码
while (有任务 && 时间片未用完) {
  task = taskQueue.peek();
  if (task.startTime > now) {
    设置定时器等任务到期;
    break;
  }
  执行 task.callback;
  if (callback 返回函数) {
    task.callback = 返回值;  // 续传
  } else {
    taskQueue.pop();  // 完成
  }
  now = getCurrentTime();
}
if (还有任务) {
  请求下一帧;
}
```

### 6.3 任务取消

```javascript
function unstable_cancelScheduledTask(task) {
  task.callback = null;  // 标记为已取消
  // 实际移除在 workLoop 中处理（peek 时检查 callback === null）
}
```

---

## 七、React 19 的变化

### 7.1 Scheduler 的简化

React 19 对 Scheduler 做了简化：

- 移除了部分优先级级别（从 5 级简化为 3 级）
- 改进了时间片计算（更精确的 `shouldYield`）
- 与 Server Components 的集成（流式 SSR 的调度）

### 7.2 新的 `act` 测试 API

```javascript
// React 18
await act(async () => {
  // 触发更新
});

// React 19
// act 内部使用 Scheduler 的同步模式
// 确保所有微任务/宏任务都执行完毕
```

---

## 八、手写一个简化版 Scheduler

```javascript
class SimpleScheduler {
  constructor() {
    this.taskQueue = [];  // 最小堆
    this.isRunning = false;
    this.frameInterval = 5;  // ms
    this.frameDeadline = 0;
  }

  // 插入任务（简化版，不实现完整堆）
  schedule(priority, callback, delay = 0) {
    const now = performance.now();
    const task = {
      callback,
      priority,
      startTime: now + delay,
      expirationTime: now + delay + (5000 / priority),  // 优先级越高超时越短
    };
    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => a.expirationTime - b.expirationTime);

    if (!this.isRunning) {
      this.isRunning = true;
      this.requestFrame();
    }
  }

  requestFrame() {
    requestAnimationFrame(() => this.workLoop());
  }

  workLoop() {
    const now = performance.now();
    this.frameDeadline = now + this.frameInterval;

    while (this.taskQueue.length > 0 && now < this.frameDeadline) {
      const task = this.taskQueue[0];
      if (task.startTime > now) break;  // 还没到期

      this.taskQueue.shift();
      const continuation = task.callback(now >= task.expirationTime);
      if (typeof continuation === 'function') {
        this.taskQueue.push({ ...task, callback: continuation });
        this.taskQueue.sort((a, b) => a.expirationTime - b.expirationTime);
      }
    }

    if (this.taskQueue.length > 0) {
      this.requestFrame();
    } else {
      this.isRunning = false;
    }
  }
}

// 使用示例
const scheduler = new SimpleScheduler();

scheduler.schedule(1, () => {
  console.log('高优先级任务');
  return null;  // 完成
});

scheduler.schedule(3, () => {
  console.log('低优先级任务');
  return () => {
    console.log('低优先级任务 - 续传');
    return null;
  };
}, 100);  // 延迟 100ms
```

---

## 九、核心要点回顾

| 概念 | 说明 | 源码位置 |
|------|------|---------|
| **双堆结构** | taskQueue（就绪）+ timerQueue（延迟） | `Scheduler.js` |
| **EDF 算法** | 最早过期优先，非最高优先级优先 | `siftUp/siftDown` |
| **时间切片** | 每帧 5ms，让出给渲染/交互 | `shouldYieldToHost` |
| **MessageChannel** | 比 setTimeout 更快的调度触发 | `requestHostCallback` |
| **超时降级** | 任务超时 = 优先级提升 | `expirationTime` |
| **continuationCallback** | 分片续传，支持中断恢复 | `workLoop` 返回值 |
| **Fiber 桥梁** | `performConcurrentWorkOnRoot` | `ReactFiberWorkLoop.js` |

---

## 十、与 Vue 3 Scheduler 对比

| 特性 | React Scheduler | Vue 3 Scheduler |
|------|-----------------|-----------------|
| 优先级 | 5 级 | 2 级（flushPre/Post） |
| 时间切片 | 5ms/帧 | 无（依赖微任务） |
| 调度触发 | MessageChannel | Promise.then / MutationObserver |
| 任务队列 | 双堆（最小堆） | 数组去重 + 排序 |
| 超时机制 | 有（expirationTime） | 无 |
| 取消任务 | 支持 | 不支持（直接过滤） |
| 设计目标 | 并发渲染（时间切片） | 批量更新（去重合并） |

**核心差异：React Scheduler 是"时间感知"的（知道每帧还剩多少时间），Vue 3 Scheduler 是"微任务感知"的（利用微任务的批量执行特性）。**

---

*精读完成。下一个建议方向：React Compiler（React 19 自动 memo 优化）或 Vue 3 Template Compiler（模板编译为 render function）。*
