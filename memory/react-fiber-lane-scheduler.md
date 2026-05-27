# React Fiber Lane 调度系统 源码精读笔记

> 精读时间：2026-05-06 04:00 AM
> 源码版本：React main branch (2026+)
> 核心文件：`ReactFiberLane.js` (~1100 行) + `ReactFiberWorkLoop.js` (~3000 行)
> 前置知识：Fiber 节点结构、双缓冲机制、Hooks 链表、Reconciliation 算法

---

## 一、Lane 系统是什么——React 并发渲染的"交通灯"

React 18 引入的 **Lane 模型** 是并发渲染的核心调度机制。它回答了一个根本问题：

> **当多个更新同时到来，React 如何决定谁先谁后？如何在渲染过程中被高优先级更新打断？如何在数据未就绪时优雅暂停？**

### 1.1 Lane vs Priority 的演进

| React 版本 | 调度模型               | 特点                                   |
| ---------- | ---------------------- | -------------------------------------- |
| React 15   | Stack Reconciler       | 同步渲染，不可中断                     |
| React 16   | Fiber + expirationTime | 基于时间戳的优先级，粒度粗             |
| React 17   | Lane (实验性)          | 位运算优先级，更精细                   |
| React 18+  | Lane (正式)            | 31 个 Lane 位，支持中断/恢复/纠缠/过期 |

**关键洞察：Lane 本质是一个 31-bit 整数，每个 bit 代表一个优先级通道。**

```typescript
export type Lanes = number; // 多个 Lane 的集合（位掩码）
export type Lane = number; // 单个 Lane（一个 bit）
```

### 1.2 31 个 Lane 的完整布局

```
位位置:  30    29    28    27    26    25    24    23    22    21    20
        ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
        │     │     │     │     │     │     │     │     │     │     │     │
        │ Dfd │Offsc│Idle │IdleH│Selct│Rtry4│Rtry3│Rtry2│Rtry1│     │     │
        │Lane │reen │Lane │Lane │Hydr │     │     │     │     │     │     │
        │(30) │(29) │(28) │(27) │(26) │(25) │(24) │(23) │(22) │     │     │
        └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘

位位置:  19    18    17    16    15    14    13    12    11    10     9
        ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
        │     │     │     │     │     │     │     │     │     │     │     │
        │     │     │     │     │     │     │     │     │     │     │     │
        │Trs14│Trs13│Trs12│Trs11│Trs10│Trs9 │Trs8 │Trs7 │Trs6 │Trs5 │Trs4 │
        │(19) │(18) │(17) │(16) │(15) │(14) │(13) │(12) │(11) │(10) │(9)  │
        └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘

位位置:   8     7     6     5     4     3     2     1     0
        ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
        │     │     │     │     │     │     │     │     │     │
        │Trs3 │Trs2 │Trs1 │TrsH │Gest │Deflt│Deflt│Input│Sync │
        │(8)  │(7)  │(6)  │(5)  │Lane │Lane │Hydr │Cont │Lane │
        │     │     │     │     │(4)  │(3)  │(2)  │(1)  │(0)  │
        └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
```

**位越靠右，优先级越高。** SyncLane (bit 1) 是最高的"用户更新"优先级。

---

## 二、逐行精读 ReactFiberLane.js

### 2.1 Lane 常量定义（源码第 45-90 行）

```typescript
export const TotalLanes = 31;

export const NoLanes: Lanes = 0b0000000000000000000000000000000;
export const NoLane: Lane = 0b0000000000000000000000000000000;

export const SyncHydrationLane: Lane = 0b0000000000000000000000000000001;  // bit 0
export const SyncLane: Lane =        0b0000000000000000000000000000010;  // bit 1
export const SyncLaneIndex: number = 1;

export const InputContinuousHydrationLane: Lane = 0b0000000000000000000000000000100;  // bit 2
export const InputContinuousLane: Lane =        0b0000000000000000000000000001000;  // bit 3

export const DefaultHydrationLane: Lane = 0b0000000000000000000000000010000;  // bit 4
export const DefaultLane: Lane =              0b0000000000000000000000000100000;  // bit 5

export const SyncUpdateLanes: Lane = SyncLane | InputContinuousLane | DefaultLane;

export const GestureLane: Lane = 0b0000000000000000000000001000000;  // bit 6 (React 19 新增)

const TransitionHydrationLane: Lane = 0b0000000000000000000000010000000;  // bit 7
const TransitionLanes: Lanes =        0b0000000001111111111111100000000;  // bit 7-20 (14 lanes)
const TransitionLane1: Lane =         0b0000000000000000000000100000000;  // bit 8
// ... TransitionLane2-14

const TransitionUpdateLanes = TransitionLane1 | ... | TransitionLane10;  // 10 lanes for transitions
const TransitionDeferredLanes = TransitionLane11 | ... | TransitionLane14;  // 4 lanes for deferred

const RetryLanes: Lanes = 0b0000011110000000000000000000000;  // bit 22-25 (4 lanes)
const RetryLane1: Lane =    0b0000000010000000000000000000000;  // bit 22
// ... RetryLane2-4

export const SelectiveHydrationLane: Lane = 0b0000100000000000000000000000000;  // bit 26

const NonIdleLanes: Lanes = 0b0000111111111111111111111111111;  // bit 0-26 (所有非 Idle)

export const IdleHydrationLane: Lane = 0b0001000000000000000000000000000;  // bit 27
export const IdleLane: Lane =        0b0010000000000000000000000000000;  // bit 28

export const OffscreenLane: Lane =   0b0100000000000000000000000000000;  // bit 29
export const DeferredLane: Lane =    0b1000000000000000000000000000000;  // bit 30
```

**逐行解析：**

| 行号                        | 代码                  | 作用                                                        |
| --------------------------- | --------------------- | ----------------------------------------------------------- |
| `TotalLanes = 31`           | 31 个 Lane            | JS 位运算只支持 31 位有符号整数（第 32 位是符号位）         |
| `NoLanes = 0`               | 空掩码                | 表示"没有待处理的工作"                                      |
| `SyncHydrationLane` bit 0   | 最高优先级            | 仅用于 SSR 水合，比普通 SyncLane 更高                       |
| `SyncLane` bit 1            | 同步更新              | `flushSync()`、`useState` 同步调用、事件处理器中的 setState |
| `InputContinuousLane` bit 3 | 连续输入              | `onMouseMove`、`onScroll` 等高频事件                        |
| `DefaultLane` bit 5         | 默认优先级            | 普通的 `startTransition` 之外的 setState                    |
| `TransitionLanes` bit 7-20  | 14 个 Transition Lane | `startTransition` / `useTransition` 的更新，可被打断        |
| `RetryLanes` bit 22-25      | 4 个 Retry Lane       | Suspense 数据加载完成后的重试                               |
| `IdleLane` bit 28           | 空闲优先级            | `useId` / 低优先级后台任务                                  |
| `OffscreenLane` bit 29      | 离线渲染              | `display: none` 的组件、增量水合                            |
| `DeferredLane` bit 30       | 延迟渲染              | `useDeferredValue` 的延迟值                                 |

### 2.2 核心位运算工具函数（源码第 260-320 行）

```typescript
// === 获取最高优先级 Lane ===
export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes; // 经典技巧：x & (-x) 提取最低位的 1
}
```

**逐行解析 `lanes & -lanes`：**

```
假设 lanes = 0b0000000001111111111111100000000 (TransitionLanes)

步骤 1: 取补码 -lanes
  lanes  = 0b0000000001111111111111100000000
  ~lanes = 0b1111111110000000000000011111111  (按位取反)
  -lanes = 0b1111111110000000000000100000000  (+1)

步骤 2: lanes & -lanes
  0b0000000001111111111111100000000
& 0b1111111110000000000000100000000
= 0b0000000000000000000000100000000  = TransitionLane1

结果: 提取出最低位(最高优先级)的 Lane!
```

这是计算机科学的经典技巧，时间复杂度 O(1)。

```typescript
// === 合并 Lane ===
export function mergeLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a | b; // 位或运算：合并两个 Lane 集合
}

// === 移除 Lane ===
export function removeLanes(set: Lanes, subset: Lanes | Lane): Lanes {
  return set & ~subset; // 位与非：从集合中移除指定 Lane
}

// === 子集检查 ===
export function isSubsetOfLanes(set: Lanes, subset: Lanes | Lane): boolean {
  return (set & subset) === subset; // subset 的所有 bit 都在 set 中
}

// === 交集检查 ===
export function includesSomeLane(a: Lanes | Lane, b: Lanes | Lane): boolean {
  return (a & b) !== NoLanes; // 两个集合是否有重叠
}

// === 更高优先级 ===
export function higherPriorityLane(a: Lane, b: Lane): Lane {
  // 位值越小 = 优先级越高（因为 bit 越靠右）
  return a !== NoLane && a < b ? a : b;
}
```

**关键设计：位值越小 = 优先级越高。**

这是因为 `getHighestPriorityLane` 提取的是最低位的 1，而最低位的 1 对应的数值最小。所以 `SyncLane (0b10 = 2)` 比 `DefaultLane (0b100000 = 32)` 优先级高。

### 2.3 getNextLanes — 调度决策的核心（源码第 175-240 行）

这是整个 Lane 系统最关键的函数。它决定"下一次渲染应该处理哪些 Lane"。

```typescript
export function getNextLanes(
  root: FiberRoot,
  wipLanes: Lanes,            // 当前正在渲染的 Lane
  rootHasPendingCommit: boolean,  // 是否有待提交的树
): Lanes {
  // 第 1 步: 获取所有待处理的 Lane
  const pendingLanes = root.pendingLanes;
  if (pendingLanes === NoLanes) {
    return NoLanes;  // 没有待处理工作，直接返回
  }

  let nextLanes: Lanes = NoLanes;

  const suspendedLanes = root.suspendedLanes;  // 被 Suspense 挂起的 Lane
  const pingedLanes = root.pingedLanes;        // 被 ping 唤醒的 Lane
  const warmLanes = root.warmLanes;            // 已预热的 Lane

  // 第 2 步: 分离非 Idle 和 Idle 工作
  const nonIdlePendingLanes = pendingLanes & NonIdleLanes;
  if (nonIdlePendingLanes !== NoLanes) {
    // 有非 Idle 工作，优先处理
```

**逐行解析调度决策树：**

```
                    pendingLanes
                        │
                        ▼
              ┌─────────────────┐
              │ pendingLanes    │
              │ === NoLanes?    │──YES──→ 返回 NoLanes (无事可做)
              └────────┬────────┘
                       │ NO
                       ▼
              ┌─────────────────┐
              │ 分离 Idle/非Idle │
              │ pending &       │
              │ NonIdleLanes    │
              └────────┬────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
        有非Idle工作           只有Idle工作
            │                     │
            ▼                     ▼
    ┌───────────────┐     ┌───────────────┐
    │ 非Idle未阻塞  │     │ 未阻塞Lane    │
    │ & ~suspended  │     │ & ~suspended  │
    └───────┬───────┘     └───────┬───────┘
            │                     │
     ┌──────┴──────┐       ┌──────┴──────┐
     │ 有?         │       │ 有?         │
     └──┬──────┬───┘       └──┬──────┬───┘
        │ YES  │ NO           │ YES  │ NO
        ▼      ▼              ▼      ▼
    最高优先  检查pinged    最高优先  检查pinged
    Lane     的Lane        Lane     的Lane
             │              │
        ┌────┴────┐    ┌────┴────┐
        │ 有?     │    │ 有?     │
        └─┬───┬───┘    └─┬───┬───┘
          │YES│NO        │YES│NO
          ▼   ▼          ▼   ▼
      最高   检查预热    最高   检查预热
      pinged  (prewarm)  pinged  (prewarm)
      Lane               Lane
```

**继续解析 getNextLanes 的后半部分：**

```typescript
  if (nextLanes === NoLanes) {
    return NoLanes;  // 所有工作都被挂起，等待 ping
  }

  // 第 3 步: 检查是否需要中断当前渲染
  if (
    wipLanes !== NoLanes &&
    wipLanes !== nextLanes &&
    (wipLanes & suspendedLanes) === NoLanes  // 当前渲染没有被挂起
  ) {
    const nextLane = getHighestPriorityLane(nextLanes);
    const wipLane = getHighestPriorityLane(wipLanes);
    if (
      // 新 Lane 优先级 <= 当前渲染的 Lane
      nextLane >= wipLane ||
      // DefaultLane 不能打断 Transition
      (nextLane === DefaultLane && (wipLane & TransitionLanes) !== NoLanes)
    ) {
      return wipLanes;  // 不中断，继续当前渲染
    }
  }

  return nextLanes;  // 中断当前渲染，切换到新 Lane
}
```

**关键洞察：中断决策的两个条件**

1. **优先级比较**：`nextLane >= wipLane` → 新工作优先级不高于当前渲染，不中断
2. **DefaultLane 特殊规则**：DefaultLane 不能打断 Transition（防止频繁闪烁）

### 2.4 Lane 轮换机制（源码第 245-260 行）

```typescript
let nextTransitionUpdateLane: Lane = TransitionLane1;
let nextTransitionDeferredLane: Lane = TransitionLane11;
let nextRetryLane: Lane = RetryLane1;

export function claimNextTransitionUpdateLane(): Lane {
  // 循环分配 Transition Lane，避免所有 transition 挤在同一个 Lane
  const lane = nextTransitionUpdateLane;
  nextTransitionUpdateLane <<= 1; // 左移一位，指向下一个 Lane
  if ((nextTransitionUpdateLane & TransitionUpdateLanes) === NoLanes) {
    nextTransitionUpdateLane = TransitionLane1; // 溢出后回绕
  }
  return lane;
}
```

**设计意图：** 10 个 TransitionUpdateLanes 循环使用，确保多个 `startTransition` 调用不会全部挤在同一个 Lane 上。这允许 React 区分不同来源的 transition 更新。

### 2.5 过期机制 — 防止饥饿（源码第 340-380 行）

```typescript
function computeExpirationTime(lane: Lane, currentTime: number) {
  switch (lane) {
    case SyncLane:
    case InputContinuousLane:
    case GestureLane:
      return currentTime + syncLaneExpirationMs; // ~5s (用户交互)
    case DefaultLane:
    case TransitionLanes:
      return currentTime + transitionLaneExpirationMs; // ~5s
    case RetryLane1:
    case RetryLane2:
    case RetryLane3:
    case RetryLane4:
      return enableRetryLaneExpiration
        ? currentTime + retryLaneExpirationMs
        : NoTimestamp; // Retry 默认不过期
    case IdleLane:
    case OffscreenLane:
      return NoTimestamp; // Idle 永不过期
  }
}

export function markStarvedLanesAsExpired(
  root: FiberRoot,
  currentTime: number,
): void {
  const pendingLanes = root.pendingLanes;
  const suspendedLanes = root.suspendedLanes;
  const pingedLanes = root.pingedLanes;
  const expirationTimes = root.expirationTimes;

  let lanes = enableRetryLaneExpiration
    ? pendingLanes
    : pendingLanes & ~RetryLanes;

  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes); // 31 - clz32(lanes)
    const lane = 1 << index;

    const expirationTime = expirationTimes[index];
    if (expirationTime === NoTimestamp) {
      // 首次计算过期时间
      if (
        (lane & suspendedLanes) === NoLanes ||
        (lane & pingedLanes) !== NoLanes
      ) {
        expirationTimes[index] = computeExpirationTime(lane, currentTime);
      }
    } else if (expirationTime <= currentTime) {
      // 已过期！提升为 SyncLane 强制完成
      root.expiredLanes |= lane;
    }

    lanes &= ~lane; // 清除已处理的 bit
  }
}
```

**饥饿保护机制：**

```
Lane 创建时:
  expirationTimes[bitIndex] = NoTimestamp

首次进入调度:
  expirationTimes[bitIndex] = currentTime + 过期时长

每次调度检查:
  if (expirationTime <= currentTime):
    root.expiredLanes |= lane  → 提升为同步渲染，不可中断
```

**过期时间常量：**

- Sync/InputContinuous: ~5 秒（用户交互不能等太久）
- Transition: ~5 秒
- Retry: 默认不过期（数据加载时间不可控）
- Idle/Offscreen: 永不过期

---

## 三、逐行精读 ReactFiberWorkLoop.js — 调度执行引擎

### 3.1 全局状态机（源码第 280-350 行）

```typescript
// === 执行上下文（位掩码） ===
export const NoContext = 0b000; // 无上下文
const BatchedContext = 0b001; // 批量更新中
export const RenderContext = 0b010; // 正在 Render 阶段
export const CommitContext = 0b100; // 正在 Commit 阶段

// === 渲染退出状态 ===
const RootInProgress = 0; // 渲染中
const RootFatalErrored = 1; // 致命错误
const RootErrored = 2; // 可恢复错误
const RootSuspended = 3; // 挂起（等待数据）
const RootSuspendedWithDelay = 4; // 挂起（延迟提交）
const RootCompleted = 5; // 完成
const RootSuspendedAtTheShell = 6; // Shell 层挂起

// === 全局变量（整个 reconciler 共享） ===
let executionContext: ExecutionContext = NoContext;
let workInProgressRoot: FiberRoot | null = null; // 当前正在处理的 Root
let workInProgress: Fiber | null = null; // 当前正在处理的 Fiber
let workInProgressRootRenderLanes: Lanes = NoLanes; // 当前渲染的 Lane
```

**关键设计：全局变量 = Fiber 树的"游标"。**

`workInProgress` 是双缓冲机制中的 WIP 树游标，它沿着 Fiber 链表深度优先遍历。

### 3.2 scheduleUpdateOnFiber — 更新的入口（源码第 680-780 行）

这是 React 更新调度的**第一入口**。每次 `setState` / `dispatch` 最终都会调用这个函数。

```typescript
export function scheduleUpdateOnFiber(
  root: FiberRoot,
  fiber: Fiber,
  lane: Lane,
) {
  // 第 1 步: DEV 检查
  if (__DEV__) {
    if (isRunningInsertionEffect) {
      console.error('useInsertionEffect must not schedule updates.');
    }
    if (isFlushingPassiveEffects) {
      didScheduleUpdateDuringPassiveEffects = true;
    }
  }

  // 第 2 步: 检查是否正在挂起等待数据
  if (
    (root === workInProgressRoot &&
      (workInProgressSuspendedReason === SuspendedOnData ||
       workInProgressSuspendedReason === SuspendedOnAction)) ||
    root.cancelPendingCommit !== null
  ) {
    // 新更新可能解除挂起 → 中断当前渲染，从头开始
    prepareFreshStack(root, NoLanes);
    markRootSuspended(root, workInProgressRootRenderLanes, ...);
  }

  // 第 3 步: 标记 Root 有待处理更新
  markRootUpdated(root, lane);

  // 第 4 步: 判断更新来源
  if ((executionContext & RenderContext) !== NoContext && root === workInProgressRoot) {
    // 渲染阶段更新（不推荐，但 React 内部会用到）
    workInProgressRootRenderPhaseUpdatedLanes = mergeLanes(
      workInProgressRootRenderPhaseUpdatedLanes, lane
    );
  } else {
    // 正常更新（来自事件处理器、effect 等）
    if (root === workInProgressRoot) {
      // 正在渲染的树收到新更新 → 交叉更新
      workInProgressRootInterleavedUpdatedLanes = mergeLanes(
        workInProgressRootInterleavedUpdatedLanes, lane
      );
    }

    // 第 5 步: 调度 Root
    ensureRootIsScheduled(root);

    // 第 6 步: Legacy 模式同步刷新
    if (lane === SyncLane && executionContext === NoContext && legacyMode) {
      flushSyncWorkOnLegacyRootsOnly();
    }
  }
}
```

**调用链：**

```
setState/dispatch
  → enqueueUpdate (Class) / dispatchSetState (Hook)
    → scheduleUpdateOnFiber(root, fiber, lane)
      → markRootUpdated(root, lane)      // 标记 pendingLanes
      → ensureRootIsScheduled(root)       // 调度渲染任务
        → scheduleCallback(normalPriority, performConcurrentWorkOnRoot)
          → Scheduler 调度器
            → performConcurrentWorkOnRoot
              → performWorkOnRoot
                → renderRootConcurrent / renderRootSync
                  → workLoopConcurrent / workLoopSync
```

### 3.3 performWorkOnRoot — 渲染执行核心（源码第 800-950 行）

这是实际执行渲染的函数。它决定用同步还是并发模式渲染。

```typescript
export function performWorkOnRoot(
  root: FiberRoot,
  lanes: Lanes,
  forceSync: boolean,
): void {
  // 第 1 步: 安全检查
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error("Should not already be working.");
  }

  // 第 2 步: 决定是否使用时间切片
  const shouldTimeSlice =
    (!forceSync &&
      !includesBlockingLane(lanes) && // 不是阻塞性 Lane (Sync/Default/Input)
      !includesExpiredLane(root, lanes)) || // 没有过期的 Lane
    checkIfRootIsPrerendering(root, lanes); // 或者正在预渲染

  // 第 3 步: 执行渲染
  let exitStatus: RootExitStatus = shouldTimeSlice
    ? renderRootConcurrent(root, lanes) // 并发模式：可中断
    : renderRootSync(root, lanes, true); // 同步模式：不可中断

  // 第 4 步: 处理退出状态
  let renderWasConcurrent = shouldTimeSlice;

  do {
    if (exitStatus === RootInProgress) {
      // 渲染被中断（时间片用完或 Suspense）
      break;
    } else {
      // 渲染完成，检查外部存储一致性
      const finishedWork = root.current.alternate;
      if (
        renderWasConcurrent &&
        !isRenderConsistentWithExternalStores(finishedWork)
      ) {
        // 并发渲染期间外部存储被修改 → 重新同步渲染
        exitStatus = renderRootSync(root, lanes, false);
        renderWasConcurrent = false;
        continue;
      }

      // 检查错误
      if (exitStatus === RootErrored) {
        exitStatus = recoverFromConcurrentError(root, lanes, errorRetryLanes);
        if (exitStatus !== RootErrored) continue; // 重试
      }

      if (exitStatus === RootFatalErrored) {
        // 致命错误 → 放弃
        markRootSuspended(root, lanes, NoLane, true);
        break;
      }

      // 完成渲染 → 提交或等待
      finishConcurrentRender(
        root,
        exitStatus,
        finishedWork,
        lanes,
        renderEndTime,
      );
    }
    break;
  } while (true);

  // 第 5 步: 确保下次调度
  ensureRootIsScheduled(root);
}
```

**关键决策：同步 vs 并发**

```
shouldTimeSlice = true (并发模式):
  → renderRootConcurrent()
    → workLoopConcurrent()
      → 每处理一个 Fiber 节点检查 shouldYield()
        → 如果时间片用完 → 中断 → 返回 RootInProgress
        → 浏览器空闲时恢复 → 继续从 workInProgress 继续

shouldTimeSlice = false (同步模式):
  → renderRootSync()
    → workLoopSync()
      → 不检查 shouldYield()
      → 一口气渲染完整个树
      → 不可中断
```

### 3.4 workLoopConcurrent — 并发工作循环（核心中的核心）

```typescript
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    // 深度优先遍历 Fiber 树
    workInProgress = performUnitOfWork(workInProgress);
  }
}

function workLoopSync() {
  while (workInProgress !== null) {
    workInProgress = performUnitOfWork(workInProgress);
  }
}
```

**关键区别：**

| 特性            | workLoopConcurrent    | workLoopSync      |
| --------------- | --------------------- | ----------------- |
| `shouldYield()` | ✅ 每步检查           | ❌ 不检查         |
| 可中断          | ✅ 是                 | ❌ 否             |
| 恢复点          | `workInProgress` 保留 | 不适用            |
| 使用场景        | Transition/Idle/Retry | Sync/Default/过期 |

### 3.5 markRootUpdated / markRootSuspended — Root 状态管理

```typescript
export function markRootUpdated(root: FiberRoot, updateLane: Lane) {
  root.pendingLanes |= updateLane; // 添加新的待处理 Lane

  // 新更新可能解除挂起 → 清除挂起标记
  if (updateLane !== IdleLane) {
    root.suspendedLanes = NoLanes; // 清除所有挂起
    root.pingedLanes = NoLanes;
    root.warmLanes = NoLanes;
  }
}

export function markRootSuspended(
  root: FiberRoot,
  suspendedLanes: Lanes,
  spawnedLane: Lane,
  didAttemptEntireTree: boolean,
) {
  root.suspendedLanes |= suspendedLanes; // 标记挂起的 Lane
  root.pingedLanes &= ~suspendedLanes; // 从 pinged 中移除

  if (didAttemptEntireTree) {
    root.warmLanes |= suspendedLanes; // 标记为"已尝试过"
  }

  // 清除挂起 Lane 的过期时间（它们不再 CPU 绑定）
  const expirationTimes = root.expirationTimes;
  let lanes = suspendedLanes;
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    expirationTimes[index] = NoTimestamp;
    lanes &= ~lane;
  }
}
```

**状态转换图：**

```
         新更新到来
              │
              ▼
    ┌──────────────────┐
    │ markRootUpdated  │
    │ pendingLanes |=  │
    │   updateLane     │
    │ suspendedLanes=0 │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ getNextLanes()   │ ← 选择下一个要渲染的 Lane
    │ 决策:            │
    │ 1. 未阻塞的?     │
    │ 2. 被 ping 的?   │
    │ 3. 需要预热的?   │
    └────────┬─────────┘
             │
      ┌──────┴──────┐
      │             │
  渲染完成       渲染挂起
      │             │
      ▼             ▼
markRootFinished  markRootSuspended
pending &=        suspended |=
  remaining         suspendedLanes
```

---

## 四、Lane 优先级完整排序（从最高到最低）

```
优先级    Lane 名称              触发场景
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1      SyncHydrationLane      SSR 水合
  2      SyncLane               flushSync(), 事件处理器中的 setState
  3      InputContinuousHydr..  连续输入水合
  4      InputContinuousLane    onMouseMove, onScroll
  5      DefaultHydrationLane   默认水合
  6      DefaultLane            普通 setState (非 transition)
  7      GestureLane            startGestureTransition (React 19)
  8      TransitionHydration..  Transition 水合
  9-18   TransitionLane1-10     startTransition / useTransition
  19-22  TransitionLane11-14    useDeferredValue 的延迟任务
  23-26  RetryLane1-4           Suspense 数据加载完成后的重试
  27     SelectiveHydrationLane 选择性水合
  28     IdleHydrationLane      Idle 水合
  29     IdleLane               useId, 低优先级后台任务
  30     OffscreenLane          display:none, 增量水合
  31     DeferredLane           useDeferredValue
```

---

## 五、关键设计模式总结

### 5.1 位运算作为优先级队列

React 用 31-bit 整数代替了传统的优先级队列（堆/链表），带来以下优势：

| 操作     | 传统队列 | Lane 位运算           |
| -------- | -------- | --------------------- | ------- |
| 插入     | O(log n) | O(1) `pendingLanes    | = lane` |
| 获取最高 | O(1)     | O(1) `lanes & -lanes` |
| 合并     | O(n)     | O(1) `a \| b`         |
| 移除     | O(n)     | O(1) `set & ~subset`  |
| 检查存在 | O(n)     | O(1) `a & b !== 0`    |

### 5.2 Lane 纠缠（Entanglement）

```typescript
export function getEntangledLanes(root: FiberRoot, renderLanes: Lanes): Lanes {
  let entangledLanes = renderLanes;

  // InputContinuousLane 和 DefaultLane 纠缠
  if ((entangledLanes & InputContinuousLane) !== NoLanes) {
    entangledLanes |= entangledLanes & DefaultLane;
  }

  // 处理自定义纠缠关系
  const allEntangledLanes = root.entangledLanes;
  if (allEntangledLanes !== NoLanes) {
    const entanglements = root.entanglements;
    let lanes = entangledLanes & allEntangledLanes;
    while (lanes > 0) {
      const index = pickArbitraryLaneIndex(lanes);
      const lane = 1 << index;
      entangledLanes |= entanglements[index]; // 传递性纠缠
      lanes &= ~lane;
    }
  }

  return entangledLanes;
}
```

**纠缠的含义：** 当 Lane A 和 Lane B 纠缠时，它们必须在同一批次中渲染。这用于确保来自同一事件源的更新不会被拆分到不同的渲染批次中。

### 5.3 中断与恢复机制

```
用户点击按钮 (SyncLane)
  │
  ▼
scheduleUpdateOnFiber(root, fiber, SyncLane)
  │
  ▼
ensureRootIsScheduled(root)
  │
  ├─ 当前正在渲染 TransitionLane ──→ 中断 Transition 渲染
  │                                    workInProgress 保留在 Fiber 节点上
  │                                    Scheduler 取消低优先级任务
  │
  ├─ 调度 SyncLane 任务
  │
  ▼
performWorkOnRoot(root, SyncLane, false)
  │
  ▼
renderRootSync(root, SyncLane)  ← 不可中断
  │
  ▼
workLoopSync()  ← 一口气渲染完
  │
  ▼
commitRoot()  ← 提交 DOM
  │
  ▼
ensureRootIsScheduled(root)
  │
  └─ 发现还有 TransitionLane 的 WIP ──→ 恢复 Transition 渲染
                                           从上次中断的 workInProgress 继续
```

### 5.4 Suspense 与 Lane 的协作

```
组件 throw Promise (Suspense)
  │
  ▼
workLoopConcurrent 捕获异常
  │
  ▼
workInProgressRootExitStatus = RootSuspended
workInProgressSuspendedReason = SuspendedOnData
  │
  ▼
markRootSuspended(root, lanes, NoLane, didAttemptEntireTree)
  │
  ├─ suspendedLanes |= lanes  ← 标记挂起
  └─ 不提交，等待 Promise resolve
  │
  ▼
Promise resolve → ping 回调触发
  │
  ▼
markRootPinged(root, pingedLanes)
  │
  ├─ pingedLanes |= suspendedLanes & pingedLanes
  └─ warmLanes &= ~pingedLanes  ← 清除预热标记
  │
  ▼
ensureRootIsScheduled(root)
  │
  └─ getNextLanes 发现 pingedLanes 有值
     → 选择 pingedLanes 作为 nextLanes
     → 重新渲染 Suspense 边界内的组件
```

---

## 六、与 Vue 3 响应式系统的对比

| 维度          | React Lane                    | Vue 3 Scheduler             |
| ------------- | ----------------------------- | --------------------------- |
| 优先级模型    | 31-bit 位掩码                 | 10 个固定优先级队列         |
| 中断机制      | `shouldYield()` 每步检查      | 基于优先级队列的调度        |
| 恢复机制      | `workInProgress` 保留在 Fiber | effect 的 `version` 脏检查  |
| 并发安全      | Lane 纠缠保证原子性           | Link 双向链表保证依赖一致性 |
| 饥饿保护      | 过期时间 + 提升为 Sync        | 无显式过期机制              |
| Suspense 协作 | SuspendedReason + Ping        | watchEffect 自动重新执行    |
| 数据结构      | number (位运算)               | Set/Map/双向链表            |

**核心差异：** React Lane 是**调度层**的优先级系统（决定"谁先渲染"），Vue 3 响应式是**数据层**的依赖追踪系统（决定"谁需要更新"）。两者解决的问题不同，但都服务于"高效更新"这个目标。

---

## 七、实战：Lane 系统如何影响日常开发

### 7.1 `setState` 的 Lane 分配

```typescript
// 用户点击事件中的 setState
function handleClick() {
  setCount((c) => c + 1); // → DiscreteEventPriority → SyncLane
}

// onMouseMove 中的 setState
function handleMove(e) {
  setPos({ x: e.clientX, y: e.clientY }); // → DefaultEventPriority → InputContinuousLane
}

// startTransition 中的 setState
function handleSearch(q) {
  startTransition(() => {
    setQuery(q); // → TransitionLane (循环分配)
  });
}

// useDeferredValue
const deferredQuery = useDeferredValue(query); // → DeferredLane
```

### 7.2 Lane 抢占的实际效果

```
时间线:
──────────────────────────────────────────────────────────────
T0: 用户输入搜索词 "React"
    → startTransition → TransitionLane3
    → 开始渲染搜索列表 (低优先级，可中断)

T1: 用户点击"提交"按钮
    → SyncLane (高优先级)
    → 中断 TransitionLane3 渲染
    → 立即渲染提交按钮的 UI 更新

T2: 提交完成
    → 恢复 TransitionLane3 渲染
    → 从上次中断的 Fiber 节点继续

T3: 搜索列表渲染完成
──────────────────────────────────────────────────────────────
```

### 7.3 过期机制的实际效果

```
场景: 用户在弱网环境下使用 Transition 加载大量数据

T0: startTransition 开始加载 1000 条数据
    → TransitionLane5, 过期时间 = T0 + 5s

T1-T4: 渲染 400 条数据后时间片用完
    → 中断，等待浏览器空闲

T5: 5 秒到期
    → markStarvedLanesAsExpired
    → TransitionLane5 被标记为 expired
    → 下次调度提升为 SyncLane
    → 不可中断地渲染剩余 600 条

T5.5: 渲染完成
```

---

## 八、源码中的精妙设计

### 8.1 `lanes & -lanes` — 提取最低位 1

这是整个 Lane 系统最核心的位运算技巧。它利用了补码的性质：

```
-x = ~x + 1

例: x = 0b01100 (12)
    ~x = 0b10011
   -x  = 0b10100 (12 的补码)
  x&-x = 0b00100 (4)  ← 提取出最低位的 1
```

这个技巧被用于：

- `getHighestPriorityLane(lanes)` — 获取最高优先级 Lane
- `pickArbitraryLane(lanes)` — 任意选择一个 Lane
- `pickArbitraryLaneIndex(lanes)` — 获取 Lane 的 bit 索引

### 8.2 `clz32` — 前导零计数

```typescript
function pickArbitraryLaneIndex(lanes: Lanes) {
  return 31 - clz32(lanes); // 31 - 前导零数量 = 最高位索引
}
```

`clz32` (Count Leading Zeros 32-bit) 是 JavaScript 内置的位运算函数，返回 32 位整数中前导零的数量。用它可以快速找到最高优先级的 Lane 索引。

### 8.3 渲染阶段更新的特殊处理

```typescript
if (
  (executionContext & RenderContext) !== NoContext &&
  root === workInProgressRoot
) {
  // 渲染阶段更新 → 合并到当前渲染的 Lane
  workInProgressRootRenderPhaseUpdatedLanes = mergeLanes(
    workInProgressRootRenderPhaseUpdatedLanes,
    lane,
  );
}
```

React 允许在渲染阶段更新状态（虽然不推荐），这些更新会被合并到当前渲染的 Lane 中，而不是触发新的渲染。这是 React 内部特性（如 selective hydration）的实现基础。

---

## 九、学习收获

1. **位运算是性能优化的终极武器** — 31-bit 整数替代优先级队列，所有操作 O(1)
2. **中断与恢复是并发的核心** — `workInProgress` 保留在 Fiber 节点上，恢复时从断点继续
3. **过期机制是饥饿保护** — 长时间等待的 Lane 被提升为 Sync，确保不会永远饿死
4. **Lane 纠缠保证原子性** — 同一事件源的更新在同一批次中渲染
5. **Suspense 与调度深度集成** — SuspendedReason + Ping 机制让异步数据加载与并发渲染无缝协作
6. **31 个 Lane 覆盖了所有场景** — 从用户交互到后台任务，从同步到延迟，从水合到重试

---

_精读完成于 2026-05-06 04:00 AM_
_下次精读方向：React Commit 阶段 (ReactFiberCommitWork.js) — DOM 变更的批量提交机制_
