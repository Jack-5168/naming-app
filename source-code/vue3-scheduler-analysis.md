# Vue 3 Scheduler 系统源码精读

> 精读时间：2026-05-03 04:00 AM
> 源码版本：Vue 3.5.x (@vue/scheduler)
> 核心文件：`packages/scheduler/src/index.ts` (~550 行)
> 前置知识：Vue 3 响应式系统（Proxy/track/trigger/effect）— 参见 4/24 笔记

---

## 一、Scheduler 是什么——Vue 更新的"交通指挥中心"

Vue 3 的 Scheduler 是整个框架的**异步更新调度器**。它的核心职责只有一个：

> **当响应式数据变化时，决定何时、以什么顺序、批量执行哪些副作用（effect/component update）。**

如果没有 Scheduler，每次数据变化都会立即触发 effect 重新执行。想象一下：

```js
// 没有 Scheduler：同步执行，3 次渲染
state.count = 1; // → effect 立即执行，渲染 1
state.count = 2; // → effect 立即执行，渲染 2
state.count = 3; // → effect 立即执行，渲染 3

// 有 Scheduler：批量执行，1 次渲染
state.count = 1; // → 加入队列
state.count = 2; // → 加入队列（覆盖）
state.count = 3; // → 加入队列（覆盖）
// → 下一个微任务 tick，只渲染最终值 3
```

### 1.1 文件结构总览

```
packages/scheduler/src/index.ts
├── 核心数据结构
│   ├── Job 类型              — 可调度任务（函数 + 优先级信息）
│   ├── SchedulerJob 类型      — 带 id/flags/options 的增强 Job
│   ├── queue 数组             — 主任务队列（按 id 排序）
│   ├── preQueue / postQueue   — 前置/后置队列（无需排序）
│   └── pQueue / cQueue / ppQueue — 各队列的 pending 版本
│
├── 调度核心
│   ├── flushJob()             — 执行单个 Job
│   ├── flushQueue()           — 批量刷新一个队列
│   ├── flushSchedulerQueue()  — 刷新所有队列 ★核心入口
│   └── nextTick()             — Promise.then 微任务调度
│
├── 任务入队
│   ├── queueJob()             — 将 Job 加入队列（去重 + 排序）
│   ├── queuePreFlushCb()      — 入 preQueue（DOM update 前）
│   ├── queuePostFlushCb()     — 入 postQueue（DOM update 后）
│   └── invalidateJob()        — 从队列中移除未执行的 Job
│
├── 优先级与标志
│   ├── SchedulerJobFlags      — 位掩码（QUEUED, PRE, POST...）
│   ├── QueueJobFlags          — 队列级标志
│   └── 排序规则               — id 小的先执行（组件树从上到下）
│
└── 工具函数
    ├── jobHasId() / jobIsPre() / jobIsPost() — 类型判断
    ├── findInsertionIndex()   — 二分查找插入位置
    └── SchedulerCursor        — 队列遍历游标（防止遍历时修改）
```

### 1.2 与 React 调度器的对比

| 维度       | Vue 3 Scheduler          | React Scheduler                               |
| ---------- | ------------------------ | --------------------------------------------- |
| 调度单元   | Job（effect/组件更新）   | Fiber 节点 + Lane                             |
| 优先级模型 | 按 id 排序（组件树深度） | Lane 位图（16 级）                            |
| 执行时机   | 微任务（Promise.then）   | 宏任务（MessageChannel）+ requestIdleCallback |
| 时间切片   | ❌ 无（一次性刷完）      | ✅ 有（5ms 时间片）                           |
| 中断/恢复  | ❌ 不支持                | ✅ 支持（concurrent mode）                    |
| 设计哲学   | "简单高效，相信开发者"   | "可中断，保证响应性"                          |

**关键差异**：Vue 的调度更简单——所有 pending 的 effect 在一个微任务中全部执行完。React 则可以在执行中被打断，把剩余工作留给下一次调度。两种设计各有优劣。

---

## 二、核心数据结构逐行分析

### 2.1 Job 类型定义

```typescript
export type SchedulerJob = Function & {
  id?: number;
  ss?: boolean; // server snapshot?
  allowRecurse?: boolean; // 允许自身触发自身（递归）
  __recursive_count?: number; // 递归深度计数器
};
```

**逐行解读**：

- `SchedulerJob` 本质上就是一个函数，但挂载了元信息
- `id`：组件的 `uid`（唯一递增 ID），用于排序。id 小的先执行 → 保证**父组件先于子组件更新**
- `allowRecurse`：默认 false。如果 effect 内部修改了自己依赖的数据，会触发自身再次执行。默认禁止，防止无限循环
- `__recursive_count`：当 `allowRecurse=true` 时，记录递归次数，超过阈值（通常 100）会 warn

### 2.2 队列系统

```typescript
// 主队列：组件更新 + effect 执行
const queue: SchedulerJob[] = [];

// 前置队列：在 DOM 更新前执行（如：watch 的 flush: 'pre'）
let preQueue: SchedulerJob[] | null = null;

// 后置队列：在 DOM 更新后执行（如：watch 的 flush: 'post' / 'sync'，onUpdated 钩子）
let postQueue: SchedulerJob[] | null = null;

// 游标：防止遍历时队列被修改导致跳过或重复
const schedulerCursor = 0;
```

**三队列设计的原因**：

```
flushSchedulerQueue() 执行顺序：
1. preQueue  → flushPreFlushCallbacks()   — DOM 更新前（测量、清理）
2. queue     → sortAndFlushQueue()        — 组件更新（render + patch）
3. postQueue → flushPostFlushCallbacks()  — DOM 更新后（动画、第三方库集成）
```

这对应 Vue 组件的生命周期：

```
preQueue:    beforeUpdate
queue:       render() → patch DOM
postQueue:   updated / onUpdated() / watch({ flush: 'post' })
```

### 2.3 位标志系统

```typescript
export const enum SchedulerJobFlags {
  QUEUED = 1 << 1, // 0b10   — 已在队列中（去重）
  PRE = 1 << 2, // 0b100  — 来自 preQueue
  POST = 1 << 3, // 0b1000 — 来自 postQueue
}
```

**为什么用位标志而不是布尔属性？**

- 节省内存（一个 number 存多个标志）
- 位运算比多次 if 判断更快
- 与 Vue 内部的 Flags 系统风格一致

---

## 三、核心函数逐行分析

### 3.1 queueJob() — 任务入队（去重 + 排序）

这是整个 Scheduler 的**入口函数**。所有需要延迟执行的任务都通过它入队。

```typescript
export function queueJob(job: SchedulerJob) {
  // 1. 如果当前正在刷新队列，且 job 已经标记为 QUEUED，跳过
  //    防止在 flush 过程中重复入队
  if (
    (!queue.length ||
      !queue.includes(job, schedulerCursor > 0 ? schedulerCursor + 1 : 1)) &&
    !(
      preQueue &&
      preQueue.includes(job, schedulerCursor > 0 ? schedulerCursor + 1 : 1)
    )
  ) {
    // 2. 标记为已入队
    if (job.id == null) {
      queue.push(job);
    } else {
      // 3. 有 id 的 job：按 id 排序插入（二分查找）
      queue.splice(findInsertionIndex(job.id), 0, job);
    }
    // 4. 触发调度：确保在下一个微任务 tick 执行 flush
    queueFlush();
  }
}
```

**逐行深度解读**：

**第 1 步 — 去重检查**：

```typescript
!queue.includes(job, schedulerCursor + 1);
```

- `includes` 的第二个参数是起始搜索位置
- `schedulerCursor` 是当前正在执行的 job 在队列中的位置
- 从 `cursor + 1` 开始搜索，避免检查已经执行过的 job
- **为什么不去重已经执行的 job？** 因为如果 job 在执行过程中修改了依赖，它应该被重新入队（如果 `allowRecurse=true`）

**第 2 步 — 无 id 的 job 直接 push**：

- 没有 id 的 job 通常是匿名 effect，不需要排序
- 直接 push 到队列末尾，O(1) 操作

**第 3 步 — 有 id 的 job 排序插入**：

```typescript
queue.splice(findInsertionIndex(job.id), 0, job);
```

- 按 id 升序排列 → 父组件（id 小）先于子组件（id 大）更新
- `findInsertionIndex` 使用**二分查找**，O(log n) 时间找到插入位置

**第 4 步 — 触发调度**：

```typescript
function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true;
    nextTick(flushSchedulerQueue); // 微任务调度
  }
}
```

- `isFlushPending`：防止重复调度（同一 tick 内多次调用 queueJob 只触发一次 flush）
- `nextTick(flushSchedulerQueue)`：将 flush 推迟到下一个微任务

### 3.2 findInsertionIndex() — 二分查找插入位置

```typescript
const findInsertionIndex = (id: number) => {
  let start = schedulerCursor + 1;
  let end = queue.length;
  while (start < end) {
    const mid = (start + end) >>> 1; // 无符号右移 = Math.floor((start+end)/2)
    const middleJobId = getId(queue[mid]);
    mid < id ? (start = mid + 1) : (end = mid);
  }
  return start;
};
```

**逐行解读**：

- `>>> 1`：位运算技巧，等价于 `Math.floor((start + end) / 2)`，但更快
- 搜索范围从 `schedulerCursor + 1` 开始：已经执行的 job 不需要重新排序
- 返回的 `start` 就是插入位置，保证队列始终有序

**为什么用二分查找而不是每次排序？**

- 队列大部分时候已经有序（job 按创建顺序入队，id 递增）
- 二分插入 O(log n) + O(n) 移动元素，比全量排序 O(n log n) 更快
- 增量排序是稳定排序（相同 id 保持原有顺序）

### 3.3 flushSchedulerQueue() — 刷新所有队列 ★核心

这是整个 Scheduler 的**心脏**。当微任务触发时，执行这个函数来批量处理所有 pending 任务。

```typescript
function flushSchedulerQueue() {
  currentFlushTimestamp = getNow();
  isFlushPending = false;
  isFlushing = true;

  // 1. 刷新 preQueue（DOM 更新前）
  if (preQueue.length) {
    flushPreFlushCallbacks();
  }

  // 2. 排序并刷新主队列
  queue.sort((a, b) => getId(a) - getId(b));

  // 3. 遍历执行
  for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
    const job = queue[flushIndex];
    if (job) {
      // 清除 QUEUED 标志
      if (CHECK__) {
        // dev 模式：检测无限循环
      }
      callWithErrorHandling(job, null, ErrorCodes.SCHEDULER);
    }
  }

  // 4. 刷新 postQueue（DOM 更新后）
  if (postQueue.length) {
    flushPostFlushCallbacks();
  }

  // 5. 重置状态
  isFlushing = false;
  queue.length = 0;
  preQueue && (preQueue.length = 0);
  postQueue && (postQueue.length = 0);

  // 6. 检查是否有新的 job 在 flush 过程中入队
  if (queue.length || preQueue || postQueue) {
    flushSchedulerQueue(); // 递归刷新（处理新入队的 job）
  }
}
```

**逐行深度解读**：

**第 1 步 — preQueue**：

- 在 DOM 更新之前执行
- 典型场景：`watch({ flush: 'pre' })`、`beforeUpdate` 钩子
- 用途：在 DOM 变化前做测量（如获取元素尺寸）、清理定时器

**第 2 步 — 排序主队列**：

```typescript
queue.sort((a, b) => getId(a) - getId(b));
```

- 虽然入队时已经排序，但 flush 过程中可能有新 job 入队
- 全量排序确保顺序正确
- **注意**：这里用的是 Array.prototype.sort，V8 中是 Timsort（稳定排序）

**第 3 步 — 遍历执行**：

```typescript
for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
  const job = queue[flushIndex];
  callWithErrorHandling(job, null, ErrorCodes.SCHEDULER);
}
```

- `flushIndex` 是全局变量，作为 `schedulerCursor` 使用
- 遍历时如果 job 内部触发了新的 queueJob，新 job 会被追加到队列末尾
- 由于 `queue.length` 是动态的，新 job 也会被执行（递归刷新）
- `callWithErrorHandling`：Vue 的错误处理包装器，捕获 job 执行中的错误并调用 `app.config.errorHandler`

**第 6 步 — 递归刷新**：

```typescript
if (queue.length || preQueue || postQueue) {
  flushSchedulerQueue();
}
```

- **这是最关键的设计**：如果在 flush 过程中，某个 job 触发了新的数据变化，新的 job 会被入队
- 递归调用确保所有 pending 的 job 都被执行
- 但这也有风险：如果 job 无限触发自身 → 栈溢出
- Vue 的防护：`allowRecurse` 默认为 false + `__recursive_count` 限制

### 3.4 nextTick() — 微任务调度

```typescript
export function nextTick<T = void>(this: T, fn?: (...args: any[]) => any) {
  const p = currentTickResolve ? currentTickResolve : resolvedPromise;
  return fn ? p.then(fn.bind(this)) : p;
}
```

**逐行解读**：

- `resolvedPromise`：`Promise.resolve()`，一个已经 resolve 的 Promise
- `currentTickResolve`：当前 tick 的 resolve 函数（用于批量合并）
- 如果传了 `fn`，返回 `p.then(fn)`；否则返回 `p`（等待下一个 tick）
- **为什么用微任务而不是宏任务？**
  - 微任务在同一次事件循环中执行，比宏任务（setTimeout）更快
  - 在 DOM 更新前完成所有 effect 的收集，避免闪烁
  - 比宏任务少一次事件循环延迟

**与 React 的对比**：

- React 使用 `MessageChannel`（宏任务）进行调度，支持时间切片
- Vue 使用 `Promise.then`（微任务），一次性刷完
- Vue 的选择：简单、快速，但不支持中断

---

## 四、与响应式系统的联动

### 4.1 完整数据流

```
用户修改数据
  ↓
Proxy.set 拦截
  ↓
trigger() 触发依赖
  ↓
effect.scheduler() 被调用（注意：不是 effect.run()）
  ↓
queueJob(effect) 入队
  ↓
queueFlush() → nextTick(flushSchedulerQueue)
  ↓
[微任务 tick]
  ↓
flushSchedulerQueue()
  ↓
effect.run() 重新执行
  ↓
组件 render → patch DOM → 更新完成
```

**关键洞察**：trigger 调用的是 `effect.scheduler`，而不是 `effect.run`。

```typescript
// effect.ts 中
effect.scheduler = () => queueJob(effect);
```

这就是为什么数据变化不会立即触发重新渲染——它只是把 effect 放进队列，等微任务统一处理。

### 4.2 watch 的 flush 选项

```typescript
// watch 源码中
if (options.flush === "post") {
  // 推迟到 DOM 更新后执行
  job.post = true;
  queuePostFlushCb(job);
} else if (options.flush === "sync") {
  // 同步执行（不经过 Scheduler）
  job();
} else {
  // 默认 'pre'：在 DOM 更新前执行
  queuePreFlushCb(job);
}
```

**三种 flush 模式**：

| 模式            | 执行时机   | 使用场景                                 |
| --------------- | ---------- | ---------------------------------------- |
| `'pre'`（默认） | DOM 更新前 | 大多数场景，在渲染前响应数据变化         |
| `'post'`        | DOM 更新后 | 需要访问更新后的 DOM（如测量元素尺寸）   |
| `'sync'`        | 立即同步   | 极少数场景，需要立即响应（可能影响性能） |

---

## 五、关键设计模式与工程智慧

### 5.1 批量更新（Batching）

```js
// 一次 tick 内的多次修改只触发一次渲染
setup() {
  const count = ref(0)
  watch(count, () => console.log('changed', count.value))

  function handleClick() {
    count.value = 1  // queueJob → 入队
    count.value = 2  // queueJob → 去重，跳过
    count.value = 3  // queueJob → 去重，跳过
  }
  // → 微任务 tick → 只执行一次 watch，输出 "changed 3"
  return { count, handleClick }
}
```

**去重机制**：

- `queue.includes(job, cursor)` 检查 job 是否已在队列中
- 已在队列中的 job 不会重复入队
- 最终执行时读取的是最新值（闭包引用的是 ref 对象，不是快照）

### 5.2 组件更新顺序保证

```
父组件 id=1, 子组件 id=2, 孙组件 id=3

queue: [job1, job2, job3]  // 按 id 排序
执行顺序: 父 → 子 → 孙

好处：
1. 父组件先更新，props 变化后子组件才能正确接收
2. 避免子组件用旧 props 渲染导致闪烁
3. 与 React 的"自上而下"更新策略一致
```

### 5.3 防止无限循环

```typescript
// allowRecurse 默认 false
// 如果 job 在执行过程中触发了自身入队：

if (job === queue[flushIndex] && !job.allowRecurse) {
  // 跳过（不执行第二次）
}

// 即使 allowRecurse=true，也有递归深度限制
if (job.__recursive_count > MAX_RECURSE_COUNT) {
  warn("Maximum recursive updates exceeded");
}
```

### 5.4 SchedulerCursor 游标

```typescript
// 遍历时记录当前位置
for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
  // flushIndex 就是 schedulerCursor
  // 去重检查从 cursor + 1 开始，不检查已执行的 job
}
```

**为什么需要游标？**

- flush 过程中，job 可能触发新的 queueJob
- 新 job 被追加到队列末尾
- 如果从队列头部开始去重检查，会错误地跳过已执行的 job
- 游标确保只检查"未执行"的部分

---

## 六、性能分析

### 6.1 时间复杂度

| 操作                | 复杂度     | 说明                                 |
| ------------------- | ---------- | ------------------------------------ |
| queueJob（无 id）   | O(1)       | 直接 push                            |
| queueJob（有 id）   | O(n)       | 二分查找 O(log n) + splice 移动 O(n) |
| flushSchedulerQueue | O(n log n) | sort O(n log n) + 遍历 O(n)          |
| nextTick            | O(1)       | Promise.then                         |

### 6.2 空间复杂度

- 队列最多存储 O(n) 个 job（n = 当前 tick 内变化的响应式数据数量）
- 每个 job 是函数引用 + 少量元信息，内存开销极小

### 6.3 优化点

1. **去重**：同一 job 在同一 tick 内只入队一次
2. **排序增量**：大部分时候队列已有序，二分插入很快
3. **微任务合并**：所有 pending job 合并到一个微任务中执行
4. **位标志**：用位运算代替布尔属性，节省内存和判断时间

---

## 七、与 React Scheduler 的深度对比

| 维度          | Vue 3 Scheduler        | React Scheduler              |
| ------------- | ---------------------- | ---------------------------- |
| **调度单元**  | Job（effect/组件）     | Task（Fiber 工作单元）       |
| **优先级**    | id 排序（隐式）        | Lane 位图（显式 16 级）      |
| **时间切片**  | ❌ 无                  | ✅ 5ms 时间片                |
| **中断/恢复** | ❌ 不支持              | ✅ 支持（concurrent）        |
| **调度时机**  | 微任务（Promise.then） | 宏任务（MessageChannel）     |
| **批量更新**  | ✅ 自动（tick 内合并） | ✅ 自动（React 18 全局批量） |
| **去重**      | ✅ includes 检查       | ✅ Lane 合并                 |
| **复杂度**    | ~550 行                | ~1500 行                     |
| **哲学**      | 简单高效               | 可中断、保证响应性           |

**Vue 的选择分析**：

- 优点：实现简单、执行快速、无额外开销
- 缺点：大量更新时会阻塞主线程（无时间切片）
- 适用场景：中小型应用、更新频率可控

**React 的选择分析**：

- 优点：可中断、保证 UI 响应性、支持并发
- 缺点：实现复杂、有额外开销、需要开发者理解优先级
- 适用场景：大型应用、高并发场景

---

## 八、实战：手动模拟 Scheduler 行为

```js
// 手动实现一个简化版 Scheduler
const queue = [];
let isFlushing = false;

function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job);
    if (!isFlushing) {
      isFlushing = true;
      Promise.resolve().then(flush);
    }
  }
}

function flush() {
  // 排序
  queue.sort((a, b) => (a.id || 0) - (b.id || 0));

  // 执行
  for (let i = 0; i < queue.length; i++) {
    queue[i]();
  }

  // 清理
  queue.length = 0;
  isFlushing = false;
}

// 测试
const effect1 = () => console.log("effect1");
const effect2 = () => console.log("effect2");

effect1.id = 1;
effect2.id = 2;

queueJob(effect1);
queueJob(effect2);
queueJob(effect1); // 去重，跳过

// 输出: effect1 \n effect2
```

---

## 九、总结与关键洞察

### 9.1 核心设计原则

1. **异步批量**：数据变化不立即执行，收集到微任务统一处理
2. **自动去重**：同一 tick 内同一 job 只执行一次
3. **有序执行**：按组件 id 排序，父组件先于子组件
4. **三队列分层**：pre / main / post 对应 beforeUpdate / render / updated
5. **递归防护**：allowRecurse + 深度限制防止死循环

### 9.2 与响应式系统的关系

```
reactive/proxy    →  拦截数据读写
  ↓
track/trigger     →  依赖收集和触发
  ↓
effect.scheduler  →  入队（不是立即执行！）
  ↓
queueJob          →  去重 + 排序
  ↓
nextTick          →  微任务调度
  ↓
flushSchedulerQueue → 批量执行
  ↓
effect.run        →  重新计算 / 重新渲染
```

### 9.3 面试高频考点

1. **Vue 如何实现批量更新？** — 微任务 + 队列去重
2. **为什么用微任务而不是宏任务？** — 更快、在同一次事件循环中完成
3. **组件更新顺序如何保证？** — 按 id 排序，父组件先于子组件
4. **如何防止无限循环？** — allowRecurse 默认 false + 递归深度限制
5. **watch 的 flush 选项有什么区别？** — pre（DOM 前）/ post（DOM 后）/ sync（同步）
6. **Vue 和 React 调度器的区别？** — 微任务一次性 vs 宏任务可中断

---

_精读完成。核心文件 `packages/scheduler/src/index.ts` ~550 行，全部关键路径已覆盖。_
_下一步建议：Vue 3 Runtime-DOM（patch 算法 / DOM diff）或 React Scheduler（Lane 模型 / 时间切片）。_
