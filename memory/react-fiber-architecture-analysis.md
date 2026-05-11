# React Fiber 架构源码精读笔记

> 精读时间：2026-04-27 04:00 AM
> 源码版本：React main branch (2025+)
> 核心文件：`ReactFiber.js` / `ReactFiberWorkLoop.js` / `ReactChildFiber.js` / `ReactFiberBeginWork.js`

---

## 一、Fiber 是什么——React 的虚拟 DOM 单元

Fiber 是 React 16+ 引入的**工作单元（unit of work）**，本质是一个 JavaScript 对象，表示一个虚拟 DOM 节点。

### 1.1 Fiber 节点结构（ReactFiber.js）

```
FiberNode {
  // === Instance 层：组件实例信息 ===
  tag: WorkTag              // 组件类型标识（FunctionComponent=0, ClassComponent=1, HostComponent=5, HostText=6...）
  key: ReactKey             // diff 时的唯一标识
  elementType: any          // 原始类型（可能是 lazy 的 thenable）
  type: any                 // 解析后的类型（函数/类/DOM 标签名）
  stateNode: any            // 组件实例（class 组件的 this）或 DOM 节点引用

  // === Fiber 链表层：树形结构 ===
  return: Fiber | null      // 父节点（不是 parent，因为 Fiber 不是 DOM 树）
  child: Fiber | null       // 第一个子节点
  sibling: Fiber | null     // 下一个兄弟节点
  index: number             // 在兄弟中的索引位置

  // === Props/State 层 ===
  pendingProps: any         // 即将应用的 props（新值）
  memoizedProps: any        // 上次渲染时使用的 props（旧值）
  updateQueue: any          // 更新队列（setState 的 update 链表）
  memoizedState: any        // 上次渲染时计算出的 state
  dependencies: any         // 依赖的 context/hooks 链表

  // === Effects 层：副作用标记 ===
  flags: Flags              // 位掩码（Placement=0b10, Update=0b100, ChildDeletion=0b1000...）
  subtreeFlags: Flags       // 子树中包含的副作用（用于 commit 阶段快速遍历）
  deletions: Array<Fiber>   // 需要删除的子节点列表

  // === 优先级层：Lane 模型 ===
  lanes: Lanes              // 本次更新的优先级位图
  childLanes: Lanes         // 子树中所有更新的优先级合集（用于快速 bailout）

  // === 双缓冲层 ===
  alternate: Fiber | null   // 指向另一棵树的对应节点
}
```

**关键设计：单链表树**

```
传统 DOM 树：每个节点有 children[] 数组
Fiber 树：   每个节点只有 child（第一个子）+ sibling（下一个兄弟）

         Root
          │ child
          ▼
        App ── sibling ──> null
         │ child
         ▼
      Header ── sibling ──> Main ── sibling ──> Footer ── sibling ──> null
       │ child              │ child               │ child
       ▼                    ▼                     ▼
     h1 ──> null         ul ──> Li ──> Li ──> null   p ──> null
```

**为什么用单链表？**
- 内存更紧凑：3 个指针 vs 数组
- 遍历简单：while (node = node.sibling) 即可
- 方便中断/恢复：只需保存当前节点和上下文

---

## 二、双缓冲机制（Double Buffering）

React 维护**两棵 Fiber 树**：

```
current tree（当前屏幕上渲染的树）
    ↔ alternate
workInProgress tree（正在构建的新树）
```

### 2.1 createWorkInProgress（ReactFiber.js）

```javascript
export function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {
  // 1. 尝试复用 alternate（已存在的 WIP 节点）
  let workInProgress = current.alternate;
  
  if (workInProgress === null) {
    // 2. 首次创建：从 current 复制所有字段
    workInProgress = createFiber(current.tag, pendingProps, current.key, current.mode);
    workInProgress.elementType = current.elementType;
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;  // 共享实例！
    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    // 3. 复用：只重置可变字段
    workInProgress.pendingProps = pendingProps;
    workInProgress.type = current.type;
    workInProgress.flags = NoFlags;           // 清除副作用
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;
  }

  // 4. 从 current 继承不可变字段
  workInProgress.flags = current.flags & StaticMask;  // 保留静态标记
  workInProgress.childLanes = current.childLanes;
  workInProgress.lanes = current.lanes;
  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;
  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;

  return workInProgress;
}
```

**核心要点：**
- `stateNode` 是共享的（class 实例 / DOM 节点），不会重新创建
- 每次 commit 后，root 的 `current` 指针切换到 WIP 树
- 旧树变成新的 alternate，等待下次复用

---

## 三、协调算法（Reconciliation）——ReactChildFiber.js

协调是 React 的**虚拟 DOM diff** 过程，核心问题是：给定新旧子节点列表，如何最小化 DOM 操作？

### 3.1 reconcileChildren（ReactFiberBeginWork.js）

```javascript
export function reconcileChildren(
  current: Fiber | null,
  workInProgress: Fiber,
  nextChildren: any,
  renderLanes: Lanes,
) {
  if (current === null) {
    // 首次挂载：直接创建，不需要 diff
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren, renderLanes);
  } else {
    // 更新：调用协调器对比新旧子节点
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,    // 旧子节点链表头
      nextChildren,     // 新子节点（可能是 JSX、数组、字符串等）
      renderLanes,
    );
  }
}
```

### 3.2 协调器入口（ReactChildFiber.js）

```javascript
// mountChildFibers 和 reconcileChildFibers 是同一个函数的两个实例
// 区别：mountChildFibers 不追踪副作用（shouldTrackSideEffects = false）

export const mountChildFibers = createChildReconciler(false);
export const reconcileChildFibers = createChildReconciler(true);
```

### 3.3 协调核心流程

```
reconcileChildFibers(returnFiber, oldFiber, newChild, lanes)
  │
  ├─ 新子节点是 null/undefined/boolean
  │   └─ deleteRemainingChildren() → 删除所有旧子节点
  │
  ├─ 新子节点是文本（string/number）
  │   └─ updateTextNode() → 复用旧文本节点或创建新节点
  │
  ├─ 新子节点是单个元素（ReactElement）
  │   └─ updateElement()
  │       ├─ type 相同 → useFiber() 复用旧节点
  │       └─ type 不同 → 创建新 Fiber
  │
  ├─ 新子节点是数组/迭代器
  │   └─ reconcileChildrenArray() ← 核心 diff 算法
  │
  └─ 新子节点是 Portal
      └─ updatePortal()
```

### 3.4 reconcileChildrenArray——O(n) diff 算法（核心）

这是 React diff 的**灵魂**，分三阶段：

```javascript
function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren, lanes) {
  let resultingFirstChild = null;
  let previousNewFiber = null;
  let oldFiber = currentFirstChild;
  let lastPlacedIndex = 0;
  let newIdx = 0;

  // ═══════════════════════════════════════════════════
  // 第一阶段：同索引位置对比（快速路径）
  // ═══════════════════════════════════════════════════
  for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
    const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx], lanes);
    
    if (newFiber === null) {
      // 无法复用 → 跳出快速路径
      if (oldFiber === null) oldFiber = nextOldFiber;
      break;
    }

    // 记录副作用
    if (shouldTrackSideEffects && oldFiber && newFiber.alternate === null) {
      deleteChild(returnFiber, oldFiber);
    }

    // 判断 Placement（插入/移动）
    lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);

    // 链接链表
    if (previousNewFiber === null) {
      resultingFirstChild = newFiber;
    } else {
      previousNewFiber.sibling = newFiber;
    }
    previousNewFiber = newFiber;
    oldFiber = oldFiber.sibling;
  }

  // ═══════════════════════════════════════════════════
  // 第二阶段：新子节点遍历完了，删除剩余旧节点
  // ═══════════════════════════════════════════════════
  if (newIdx === newChildren.length) {
    deleteRemainingChildren(returnFiber, oldFiber);
    return resultingFirstChild;
  }

  // ═══════════════════════════════════════════════════
  // 第三阶段：旧子节点遍历完了，剩余全是新增
  // ═══════════════════════════════════════════════════
  if (oldFiber === null) {
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = createChild(returnFiber, newChildren[newIdx], lanes);
      // ... 链接链表
    }
    return resultingFirstChild;
  }

  // ═══════════════════════════════════════════════════
  // 第四阶段：慢速路径——构建 Map 查找复用
  // ═══════════════════════════════════════════════════
  const existingChildren = mapRemainingChildren(oldFiber);  // key → Fiber Map

  for (; newIdx < newChildren.length; newIdx++) {
    const newFiber = updateFromMap(existingChildren, returnFiber, newIdx, newChildren[newIdx], lanes);
    if (newFiber !== null) {
      // 从 Map 中移除已复用的
      existingChildren.delete(newFiber.key ?? newIdx);
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      // ... 链接链表
    }
  }

  // Map 中剩余的 = 需要删除的
  existingChildren.forEach(child => deleteChild(returnFiber, child));
  return resultingFirstChild;
}
```

**算法复杂度分析：**

| 场景 | 时间复杂度 | 说明 |
|------|-----------|------|
| 无变化（同索引同 type） | O(n) | 第一阶段全部命中 |
| 末尾新增 | O(n) | 第一+二阶段 |
| 开头新增 | O(n) | 第一+三阶段 |
| 中间插入 | O(n) | 第一+三阶段 |
| 顺序打乱 | O(n) | 需要 Map，但每个节点只遍历一次 |
| 大量删除 | O(n) | Map + 遍历删除 |

**placeChild 的 Placement 判断逻辑：**

```javascript
function placeChild(newFiber, lastPlacedIndex, newIndex) {
  newFiber.index = newIndex;
  const current = newFiber.alternate;
  
  if (current !== null) {
    // 复用的旧节点
    const oldIndex = current.index;
    if (oldIndex < lastPlacedIndex) {
      // 旧索引 < 上次放置位置 → 需要移动
      newFiber.flags |= Placement;
      return lastPlacedIndex;
    } else {
      // 旧索引 >= 上次放置位置 → 不需要移动
      return oldIndex;
    }
  } else {
    // 全新节点 → 需要插入
    newFiber.flags |= Placement;
    return lastPlacedIndex;
  }
}
```

**关键洞察：** `lastPlacedIndex` 是递增的。如果一个复用的旧节点索引比 `lastPlacedIndex` 小，说明它被"移到了前面"，需要 DOM move 操作。

---

## 四、Fiber 工作循环（ReactFiberWorkLoop.js）

### 4.1 整体流程

```
用户操作 / setState
  │
  ▼
scheduleUpdateOnFiber()
  │ 标记 root 有更新
  │ 调用 ensureRootIsScheduled()
  ▼
Scheduler 调度（requestIdleCallback / MessageChannel）
  │
  ▼
performWorkOnRoot()
  │
  ├─ renderRootSync()     ← 同步渲染（用户交互、flushSync）
  └─ renderRootConcurrent() ← 并发渲染（可中断、可优先级抢占）
        │
        ▼
    workLoopSync() / workLoopConcurrent()
        │ 循环：while (workInProgress !== null)
        ▼
    beginWork(current, workInProgress, renderLanes)
        │ 自上而下：从 root → leaf，为每个 Fiber 创建子 Fiber
        ▼
    completeWork(current, workInProgress, renderLanes)
        │ 自下而上：从 leaf → root，创建/更新 DOM，收集副作用
        │
        └─ 如果 workInProgress !== null → 继续下一个
        └─ 如果 workInProgress === null → render 阶段结束
              │
              ▼
          commitRoot()
              │ 三阶段 commit
              ├─ BeforeMutation（getSnapshotBeforeUpdate）
              ├─ Mutation（DOM 操作、useLayoutEffect 销毁）
              └─ Layout（DOM 操作完成、useLayoutEffect 回调、useEffect 调度）
```

### 4.2 workLoopConcurrent（可中断的工作循环）

```javascript
function workLoopConcurrent() {
  // 只要还有工作且没有中断，就继续
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(unitOfWork: Fiber) {
  const current = unitOfWork.alternate;
  let next;

  // beginWork：自上而下，处理当前节点并返回子节点
  next = beginWork(current, unitOfWork, renderLanes);

  unitOfWork.memoizedProps = unitOfWork.pendingProps;

  if (next === null) {
    // 没有子节点 → completeWork：自下而上
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next;
  }
}
```

**shouldYield() 中断条件：**
- 浏览器帧时间到了（约 5ms，vs 原来 React 15 的 50ms 全阻塞）
- 有高优先级更新到来（如用户输入）
- Suspense 等待数据

### 4.3 beginWork——每个 Fiber 类型的处理入口

```javascript
function beginWork(current, workInProgress, renderLanes) {
  const updateLanes = workInProgress.lanes;

  // === Bailout 优化：子树没有更新 → 直接复用 ===
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;
    
    if (oldProps !== newProps || hasLegacyContextChanged()) {
      didReceiveUpdate = true;
    } else if (!includesSomeLane(renderLanes, updateLanes)) {
      // 当前优先级不够，跳过
      didReceiveUpdate = false;
      // 递归检查 childLanes
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    }
  }

  // === 根据 tag 分发到不同处理函数 ===
  workInProgress.tag
    ? switch (workInProgress.tag) {
        case FunctionComponent:
          return updateFunctionComponent(current, workInProgress, ...);
        case ClassComponent:
          return updateClassInstance(current, workInProgress, ...);
        case HostRoot:
          return updateHostRoot(current, workInProgress, ...);
        case HostComponent:
          return updateHostComponent(current, workInProgress, ...);
        case HostText:
          return updateHostText(current, workInProgress, ...);
        case Fragment:
          return updateFragment(current, workInProgress, ...);
        case SuspenseComponent:
          return updateSuspenseComponent(current, workInProgress, ...);
        case MemoComponent:
          return updateMemoComponent(current, workInProgress, ...);
        // ... 共 30+ 种 tag
      }
}
```

### 4.4 updateFunctionComponent——函数组件的渲染

```javascript
function updateFunctionComponent(current, workInProgress, Component, nextProps, renderLanes) {
  // 1. 准备读取 context
  prepareToReadContext(workInProgress, renderLanes);

  // 2. 调用函数组件，传入 props，返回 JSX（ReactElement）
  // renderWithHooks 内部会执行 hooks（useState, useEffect 等）
  const nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps,
    workInProgress.ref,
    renderLanes,
  );

  // 3. bailout 检查：如果没有更新且 hooks 也没变
  if (current !== null && !didReceiveUpdate) {
    bailoutHooks(current, workInProgress, renderLanes);
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  // 4. 标记 PerformedWork
  workInProgress.flags |= PerformedWork;

  // 5. 协调子节点（调用 reconcileChildren）
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);

  return workInProgress.child;
}
```

### 4.5 completeWork——DOM 创建/更新

```javascript
function completeWork(current, workInProgress, renderLanes) {
  const newProps = workInProgress.pendingProps;

  switch (workInProgress.tag) {
    case HostComponent: {
      // DOM 元素（div, span, input...）
      const type = workInProgress.type;
      
      if (current === null) {
        // 首次创建 DOM
        const instance = createInstance(type, newProps, rootContainerInstance);
        workInProgress.stateNode = instance;
        
        // 创建子 DOM 节点
        appendAllChildren(instance, workInProgress, false, false);
      } else {
        // 更新 DOM
        updateInstance(instance, newProps);
        updateTextInstance(...);
      }
      break;
    }

    case HostText: {
      // 文本节点
      if (current === null) {
        workInProgress.stateNode = createTextInstance(newProps);
      }
      break;
    }

    case HostRoot: {
      // 根节点
      const root = workInProgress.stateNode;
      if (root.hydrate) {
        // 尝试 hydration
      }
      break;
    }
  }

  // 向上冒泡 subtreeFlags
  if (current !== null && workInProgress.subtreeFlags !== NoFlags) {
    current.subtreeFlags |= workInProgress.subtreeFlags;
  }
}
```

---

## 五、Lane 优先级模型

React 18 引入的**优先级系统**，用位运算表示 31 种优先级：

```
Lane 位图（31 bits）：
SyncLane           = 0b0000000000000000000000000000001  (最高优先级)
InputContinuousLane = 0b0000000000000000000000000000010
DefaultLane        = 0b0000000000000000000000000000100
TransitionLane1    = 0b0000000000000000000000000010000
RetryLane1         = 0b0000000000000000000001000000000
IdleLane           = 0b0100000000000000000000000000000  (最低优先级)
OffscreenLane      = 0b1000000000000000000000000000000
```

**Lane 的工作方式：**

```
setState() 
  → requestUpdateLane() 
  → 根据调用上下文决定优先级
    ├─ 用户点击 → SyncLane（立即执行）
    ├─ startTransition → TransitionLane（低优先级，可中断）
    └─ useDeferredValue → IdleLane（空闲时执行）

scheduleUpdateOnFiber(root, fiber, lane)
  → markRootUpdated(root, lane)  // 标记 root 有待处理的 lane
  → ensureRootIsScheduled(root)  // 通知 Scheduler 调度
```

---

## 六、关键设计模式总结

### 6.1 Fiber 链表 vs 传统 DOM 树

| 方面 | DOM 树 | Fiber 树 |
|------|--------|----------|
| 结构 | 子节点数组 children[] | child + sibling 单链表 |
| 遍历 | 递归深度优先 | 迭代 + 链表遍历（可中断） |
| 版本 | 单一版本 | 双缓冲（current + WIP） |
| 更新 | 同步阻塞 | 可中断、可优先级抢占 |
| 副作用 | 直接操作 DOM | 收集 flags，commit 阶段统一执行 |

### 6.2 协调算法 vs Vue 3 diff

| 方面 | React Fiber | Vue 3 |
|------|-------------|-------|
| 数据结构 | Fiber 链表 | VNode 数组 |
| diff 策略 | O(n) 三路：快速路径 → 删除 → Map | O(n) 双端对比 + 最长递增子序列 |
| 中断能力 | 可中断（时间切片） | 不可中断（同步） |
| 优先级 | Lane 位图（31 级） | 无内置优先级 |
| 复用策略 | alternate 双缓冲 | 直接修改 VNode |

### 6.3 副作用收集机制

```
render 阶段（纯 JS，可中断）：
  beginWork → 自上而下，创建/更新 Fiber
  completeWork → 自下而上，创建 DOM 节点，标记 flags

flags 位掩码：
  NoFlags        = 0b000000
  Placement      = 0b000010  → 插入新 DOM
  Update         = 0b000100  → 更新 DOM 属性
  ChildDeletion  = 0b001000  → 删除子 DOM
  Ref            = 0b010000  → ref 回调
  Passive        = 0b100000  → useEffect

commit 阶段（同步，不可中断）：
  BeforeMutation → getSnapshotBeforeUpdate
  Mutation       → 遍历 flags，执行 DOM 操作
  Layout         → useLayoutEffect、ref 回调
```

---

## 七、性能优化要点

1. **bailoutOnAlreadyFinishedWork**：如果子树没有更新（childLanes 为空），直接跳过整个子树
2. **双缓冲复用**：alternate 节点复用，避免 GC 压力
3. **时间切片**：workLoopConcurrent 每帧只工作约 5ms，剩余工作交给下一帧
4. **优先级抢占**：高优先级更新可以中断低优先级渲染
5. **subtreeFlags 冒泡**：commit 阶段只需遍历有副作用的节点
6. **Map 快速查找**：reconcileChildrenArray 第四阶段用 Map 替代 O(n²) 查找

---

## 八、学习收获

1. **Fiber 的本质是链表化的虚拟 DOM**：用 child+sibling 替代 children[]，使得遍历可以中断和恢复
2. **双缓冲是并发渲染的基础**：current 和 WIP 两棵树交替使用，commit 时切换指针
3. **协调算法的核心是 O(n) diff**：快速路径（同索引对比）→ 删除/新增 → Map 查找，三路降级
4. **placeChild 的 lastPlacedIndex 是移动检测的关键**：通过比较新旧索引判断是否需要 DOM move
5. **Lane 优先级模型让 React 18 实现了真正的并发**：31 级优先级用位运算实现，高效且灵活
6. **render 阶段可中断、commit 阶段同步**：这是 React 并发模型的核心保证——DOM 操作永远不会被中断

---

## 九、与 Vue 3 响应式系统的对比

| 方面 | React Fiber | Vue 3 响应式 |
|------|-------------|-------------|
| 更新触发 | 手动 setState / props 变化 | 自动 Proxy 依赖追踪 |
| 更新粒度 | 组件级（需手动 memo 优化） | 属性级（精确到每个响应式属性） |
| 渲染策略 | 全组件重新执行函数 | 只更新依赖变化的 DOM |
| 并发能力 | Fiber + Lane（可中断渲染） | 无（同步渲染） |
| 虚拟 DOM | Fiber 节点（链表） | VNode（对象） |
| diff 算法 | O(n) 三路降级 | O(n) 双端对比 + LIS |
| 内存模型 | 双缓冲（2 棵 Fiber 树） | 单棵树 + dep 双向链表 |

---

_下次计划：React Hooks 源码精读（useState/useEffect 的 Fiber 实现）_
