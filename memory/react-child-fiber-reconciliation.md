# React Diff 算法（Reconciliation）源码精读笔记

> 精读时间：2026-04-30 04:00 AM
> 源码版本：React main branch (2025+)
> 核心文件：`ReactChildFiber.js` (~2250 行)
> 前置知识：Fiber 节点结构、双缓冲机制、Hooks 链表

---

## 一、ReactChildFiber 是什么——虚拟 DOM 的心脏

`ReactChildFiber.js` 是 React **Diff 算法（Reconciliation）** 的实现核心。它回答了一个根本问题：

> **给定一棵旧的 Fiber 树和一组新的 React Elements，如何用最少的 DOM 操作完成更新？**

这个文件不处理组件渲染（那是 `ReactFiberBeginWork.js` 的事），也不处理 DOM 提交（那是 `ReactFiberCommitWork.js` 的事）。它只做一件事：**比较新旧子节点，标记需要增删改的 Fiber 节点**。

### 1.1 文件结构总览

```
ReactChildFiber.js
├── 辅助函数（工具层）
│   ├── createChild()          — 从新节点创建 Fiber
│   ├── updateSlot()           — 按位置匹配新旧节点
│   ├── updateFromMap()        — 从 Map 中查找匹配
│   ├── placeChild()           — 标记 Placement（移动/插入）
│   ├── deleteChild()          — 标记 ChildDeletion
│   └── mapRemainingChildren() — 构建剩余子节点 Map
│
├── 单节点协调（快速路径）
│   ├── reconcileSingleElement()  — 协调单个 JSX 元素
│   ├── reconcileSingleTextNode() — 协调单个文本节点
│   └── reconcileSinglePortal()   — 协调单个 Portal
│
├── 多节点协调（慢速路径）
│   ├── reconcileChildrenArray()    — 协调数组子节点 ★核心
│   ├── reconcileChildrenIterator() — 协调 Iterator 子节点
│   └── reconcileChildrenIteratable() — 协调可迭代对象
│
├── 入口函数
│   ├── reconcileChildFibers()  — 有 current 树时的协调（更新）
│   └── mountChildFibers()      — 无 current 树时的挂载（首次）
│
└── 工具导出
    ├── cloneChildFibers()      — 克隆子 Fiber 链表
    └── resetChildFibers()      — 重置子 Fiber 的 lanes
```

### 1.2 关键设计：`createChildReconciler` 工厂函数

```javascript
function createChildReconciler(shouldTrackSideEffects: boolean): ChildReconciler {
  // 内部定义所有辅助函数（deleteChild, placeChild, updateSlot...）
  // 根据 shouldTrackSideEffects 决定是否标记副作用

  function reconcileChildFibers(...) { ... }
  return reconcileChildFibers;
}

// 导出两个版本
export const reconcileChildFibers = createChildReconciler(true);  // 更新时：跟踪副作用
export const mountChildFibers = createChildReconciler(false);     // 挂载时：不跟踪
```

**为什么用工厂函数？**
- `shouldTrackSideEffects` 在闭包中固定，避免每次调用都传参
- 首次挂载时不需要标记 Placement/Deletion（反正都是新建），`mountChildFibers` 跳过这些逻辑，性能更好
- 所有辅助函数共享同一个布尔值，无需参数传递

---

## 二、核心数据结构与辅助函数逐行分析

### 2.1 `deleteChild` — 标记删除

```javascript
function deleteChild(returnFiber: Fiber, childToDelete: Fiber): void {
  if (!shouldTrackSideEffects) return;  // 挂载阶段不需要
  
  const deletions = returnFiber.deletions;
  if (deletions === null) {
    returnFiber.deletions = [childToDelete];  // 首次：创建数组
    returnFiber.flags |= ChildDeletion;       // 父节点标记 ChildDeletion
  } else {
    deletions.push(childToDelete);            // 后续：追加到数组
  }
}
```

**关键洞察：**
- 删除不是立即执行的，而是**标记**（`flags |= ChildDeletion`）+ **收集**（`deletions` 数组）
- 真正的 DOM 删除发生在 Commit 阶段的 `commitDeletion()` 中
- `returnFiber.deletions` 是父节点上的数组，存储所有需要删除的子 Fiber

### 2.2 `deleteRemainingChildren` — 批量删除

```javascript
function deleteRemainingChildren(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
): null {
  if (!shouldTrackSideEffects) return null;
  
  let childToDelete = currentFirstChild;
  while (childToDelete !== null) {
    deleteChild(returnFiber, childToDelete);
    childToDelete = childToDelete.sibling;  // 沿着 sibling 链表遍历
  }
  return null;
}
```

**使用场景：**
- 新子节点比旧子节点少时，删除多余的旧节点
- key 不匹配时，删除当前匹配点之后的所有旧节点
- 单节点协调中，找到匹配后删除其余兄弟

### 2.3 `mapRemainingChildren` — 构建 Map 加速查找

```javascript
function mapRemainingChildren(
  currentFirstChild: Fiber,
): Map<string | number, Fiber> {
  const existingChildren = new Map();
  let existingChild = currentFirstChild;
  
  while (existingChild !== null) {
    if (existingChild.key === null) {
      existingChildren.set(existingChild.index, existingChild);  // 无 key → 用 index
    } else {
      existingChildren.set(existingChild.key, existingChild);    // 有 key → 用 key
    }
    existingChild = existingChild.sibling;
  }
  return existingChildren;
}
```

**为什么需要 Map？**

当新旧子节点顺序不一致时（如列表重排），仅靠位置匹配会失败。Map 让查找从 O(n) 降到 O(1)。

**关键细节：**
- 无 key 的节点用 `index` 作为 Map 的 key——这是 React 警告 "Each child in a list should have a unique key" 的根本原因
- 只有当快速路径（位置匹配）失败后，才构建 Map

### 2.4 `useFiber` — 复用旧 Fiber 创建 WorkInProgress

```javascript
function useFiber(fiber: Fiber, pendingProps: mixed): Fiber {
  const clone = createWorkInProgress(fiber, pendingProps);
  clone.index = 0;       // 重置 index（调用方会重新设置）
  clone.sibling = null;  // 重置 sibling（调用方会重新链接）
  return clone;
}
```

**`createWorkInProgress` 做了什么？**
- 如果 `fiber.alternate` 存在，复用这个 alternate 节点（双缓冲的核心）
- 如果不存在，创建新 Fiber 并设为 `fiber.alternate`
- 重置 `flags = Forked`、`childLanes = NoLanes` 等状态
- 拷贝 `type`、`elementTypes`、`mode` 等不变属性
- 设置 `pendingProps = pendingProps`（新的 props）

### 2.5 `placeChild` — 标记插入/移动（⭐核心算法）

```javascript
function placeChild(
  newFiber: Fiber,
  lastPlacedIndex: number,
  newIndex: number,
): number {
  newFiber.index = newIndex;
  
  if (!shouldTrackSideEffects) {
    newFiber.flags |= Forked;  // 仅挂载时标记 Forked
    return lastPlacedIndex;
  }
  
  const current = newFiber.alternate;
  if (current !== null) {
    // 这是一个已存在的节点（复用）
    const oldIndex = current.index;
    if (oldIndex < lastPlacedIndex) {
      // 旧位置 < 最后放置位置 → 需要移动
      newFiber.flags |= Placement;
      return lastPlacedIndex;  // lastPlacedIndex 不变
    } else {
      // 旧位置 >= 最后放置位置 → 不需要移动
      return oldIndex;         // 更新 lastPlacedIndex
    }
  } else {
    // 这是一个新节点 → 需要插入
    newFiber.flags |= Placement;
    return lastPlacedIndex;
  }
}
```

**`lastPlacedIndex` 算法——React Diff 的精华：**

这个算法用 **O(n)** 时间判断哪些节点需要移动，核心思想是 **最长递增子序列（LIS）的简化版**。

```
例子：旧顺序 [A(0), B(1), C(2), D(3)]
     新顺序 [A, C, B, D]

遍历新数组：
  A: oldIndex=0, lastPlacedIndex=0 → 0 >= 0, 不移动, lastPlacedIndex=0
  C: oldIndex=2, lastPlacedIndex=0 → 2 >= 0, 不移动, lastPlacedIndex=2
  B: oldIndex=1, lastPlacedIndex=2 → 1 < 2, 需要移动! lastPlacedIndex=2
  D: oldIndex=3, lastPlacedIndex=2 → 3 >= 2, 不移动, lastPlacedIndex=3

结果：只有 B 被标记 Placement（移动），A/C/D 不动
```

**为什么这样是对的？**

因为 A→C→D 的旧索引是递增的（0→2→3），它们相对顺序没变，不需要移动。只有 B 从位置 1 "掉到了" 位置 2 之后，需要移动。

**这等价于求 LIS 的补集**——不需要移动的节点 = LIS，需要移动的节点 = 总节点数 - LIS 长度。

### 2.6 `placeSingleChild` — 单节点的 Placement

```javascript
function placeSingleChild(newFiber: Fiber): Fiber {
  if (shouldTrackSideEffects && newFiber.alternate === null) {
    newFiber.flags |= Placement;  // 新节点才需要插入
  }
  return newFiber;
}
```

单节点情况简单得多：如果是新节点（`alternate === null`），标记 Placement；否则不需要任何操作。

---

## 三、单节点协调——快速路径

### 3.1 `reconcileSingleElement` 逐行分析

```javascript
function reconcileSingleElement(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  element: ReactElement,
  lanes: Lanes,
): Fiber {
  const key = element.key;
  let child = currentFirstChild;
  
  // 第一步：遍历旧子节点链表，寻找 key 匹配的节点
  while (child !== null) {
    if (child.key === key) {
      // key 匹配！检查 type 是否也匹配
      const elementType = element.type;
      
      if (elementType === REACT_FRAGMENT_TYPE) {
        if (child.tag === Fragment) {
          // Fragment 匹配：复用
          deleteRemainingChildren(returnFiber, child.sibling);
          const existing = useFiber(child, element.props.children);
          existing.return = returnFiber;
          return existing;
        }
      } else {
        // 普通元素：检查 type 是否相同
        if (child.elementType === elementType
            || isCompatibleFamilyForHotReloading(child, element)
            || (typeof elementType === 'object'
                && elementType.$$typeof === REACT_LAZY_TYPE
                && resolveLazy(elementType) === child.type)) {
          
          // type 也匹配：复用这个 Fiber
          deleteRemainingChildren(returnFiber, child.sibling);  // 删除后面的旧节点
          const existing = useFiber(child, element.props);
          coerceRef(existing, element);
          existing.return = returnFiber;
          return existing;
        }
      }
      
      // key 匹配但 type 不匹配 → 后面的旧节点全部删除
      deleteRemainingChildren(returnFiber, child);
      break;
    } else {
      // key 不匹配 → 标记删除这个旧节点
      deleteChild(returnFiber, child);
    }
    child = child.sibling;
  }
  
  // 第二步：没有找到匹配的旧节点 → 创建新 Fiber
  if (element.type === REACT_FRAGMENT_TYPE) {
    const created = createFiberFromFragment(
      element.props.children, returnFiber.mode, lanes, element.key,
    );
    created.return = returnFiber;
    return created;
  } else {
    const created = createFiberFromElement(element, returnFiber.mode, lanes);
    coerceRef(created, element);
    created.return = returnFiber;
    return created;
  }
}
```

**关键洞察：**
1. **单节点协调也遍历旧链表**——因为旧节点可能有多个（上次渲染了多个子节点，这次只渲染一个）
2. **匹配逻辑：key 优先，type 次之**——key 不同直接删除旧节点，key 相同但 type 不同则复用失败
3. **找到匹配后删除后续所有旧节点**——单元素不可能对应多个旧子节点

### 3.2 `reconcileSingleTextNode`

```javascript
function reconcileSingleTextNode(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  textContent: string,
  lanes: Lanes,
): Fiber {
  // 文本节点没有 key，直接看第一个旧子节点是否是文本
  if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
    deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
    const existing = useFiber(currentFirstChild, textContent);
    existing.return = returnFiber;
    return existing;
  }
  // 不是文本 → 全部删除，创建新的
  deleteRemainingChildren(returnFiber, currentFirstChild);
  const created = createFiberFromText(textContent, returnFiber.mode, lanes);
  created.return = returnFiber;
  return created;
}
```

文本节点是最简单的情况——没有 key，没有 type，只看 tag 是否为 `HostText`。

---

## 四、多节点协调（数组）——慢速路径 ★核心中的核心

### 4.1 `reconcileChildrenArray` 完整流程

这是 React Diff 算法的**主战场**，处理最常见的场景：`list.map(item => <Item />)`。

```javascript
function reconcileChildrenArray(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChildren: Array<any>,
  lanes: Lanes,
): Fiber | null {
```

**算法分为三个阶段（三路扫描）：**

#### 阶段一：从前向后逐位匹配（快速路径）

```javascript
let resultingFirstChild: Fiber | null = null;
let previousNewFiber: Fiber | null = null;
let oldFiber = currentFirstChild;
let lastPlacedIndex = 0;
let newIdx = 0;
let nextOldFiber = null;

// 同时遍历新旧链表，直到一方结束或不匹配
for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
  if (oldFiber.index > newIdx) {
    nextOldFiber = oldFiber;
    oldFiber = null;  // 旧节点索引超前，暂停旧链表
  } else {
    nextOldFiber = oldFiber.sibling;
  }
  
  const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx], lanes);
  
  if (newFiber === null) {
    // 不匹配！退出快速路径，进入慢速路径
    if (oldFiber === null) {
      oldFiber = nextOldFiber;
    }
    break;
  }
  
  // 匹配成功
  if (shouldTrackSideEffects) {
    if (oldFiber && newFiber.alternate === null) {
      deleteChild(returnFiber, oldFiber);  // 位置匹配但类型变了，删除旧节点
    }
  }
  
  lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
  
  // 链接新 Fiber 链表
  if (previousNewFiber === null) {
    resultingFirstChild = newFiber;
  } else {
    previousNewFiber.sibling = newFiber;
  }
  previousNewFiber = newFiber;
  oldFiber = nextOldFiber;
}
```

**`updateSlot` 的作用：**

```javascript
function updateSlot(returnFiber, oldFiber, newChild, lanes) {
  const key = oldFiber !== null ? oldFiber.key : null;
  
  // 文本节点：key 必须为 null
  if (typeof newChild === 'string' && newChild !== '') {
    if (key !== null) return null;  // 旧节点有 key，新节点是文本 → 不匹配
    return updateTextNode(returnFiber, oldFiber, '' + newChild, lanes);
  }
  
  // ReactElement：key 必须相等
  if (typeof newChild === 'object' && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE:
        if (newChild.key === key) {
          return updateElement(returnFiber, oldFiber, newChild, lanes);
        } else {
          return null;  // key 不匹配
        }
      // ... 其他类型
    }
  }
  
  return null;
}
```

**快速路径退出的条件：**
- `updateSlot` 返回 `null`（key 不匹配或类型不匹配）
- 旧链表遍历完
- 新数组遍历完

#### 阶段二：根据退出条件走不同分支

```javascript
// 分支 A：新数组遍历完了 → 删除剩余旧节点
if (newIdx === newChildren.length) {
  deleteRemainingChildren(returnFiber, oldFiber);
  return resultingFirstChild;
}

// 分支 B：旧链表遍历完了 → 剩余新节点全部插入
if (oldFiber === null) {
  for (; newIdx < newChildren.length; newIdx++) {
    const newFiber = createChild(returnFiber, newChildren[newIdx], lanes);
    if (newFiber === null) continue;
    lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
    // 链接...
  }
  return resultingFirstChild;
}
```

**分支 A 例子：** 旧 `[A, B, C]` → 新 `[A, B]`，C 被删除
**分支 B 例子：** 旧 `[A]` → 新 `[A, B, C]`，B 和 C 被插入

#### 分支 C：双方都没遍历完 → 进入 Map 慢速路径

```javascript
// 把剩余旧节点全部放入 Map
const existingChildren = mapRemainingChildren(oldFiber);

// 遍历剩余新节点，从 Map 中查找匹配
for (; newIdx < newChildren.length; newIdx++) {
  const newFiber = updateFromMap(
    existingChildren, returnFiber, newIdx, newChildren[newIdx], lanes,
  );
  
  if (newFiber !== null) {
    // 匹配成功：从 Map 中移除（标记已消费）
    if (shouldTrackSideEffects) {
      const currentFiber = newFiber.alternate;
      if (currentFiber !== null) {
        existingChildren.delete(
          currentFiber.key === null ? newIdx : currentFiber.key,
        );
      }
    }
    
    lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
    // 链接...
  }
}

// Map 中剩余的 = 没有被消费的旧节点 = 需要删除
if (shouldTrackSideEffects) {
  existingChildren.forEach(child => deleteChild(returnFiber, child));
}

return resultingFirstChild;
```

**Map 路径例子：** 旧 `[A, B, C, D]` → 新 `[D, A, X]`
1. 快速路径：A 匹配 A（位置 0→0），lastPlacedIndex=0
2. B 不匹配 D → 退出快速路径
3. 构建 Map：`{A: fiberA, B: fiberB, C: fiberC, D: fiberD}`（假设 A 已被消费则移除）
4. 新 D → Map 中找到 D → 复用，oldIndex=3 >= lastPlacedIndex=0，不移动，lastPlacedIndex=3
5. 新 A → Map 中已无 A（快速路径已消费）→ 创建新 Fiber，标记 Placement
6. 新 X → Map 中无 X → 创建新 Fiber，标记 Placement
7. Map 剩余 {B, C, D} → D 已被消费... 等等，需要看具体逻辑

实际上快速路径只消费了位置匹配的，Map 路径重新查找。让我修正：

**修正后的例子：** 旧 `[A(0), B(1), C(2), D(3)]` → 新 `[D, A, X]`
1. 快速路径：`updateSlot` 比较 A vs D → key 不匹配 → 退出
2. 构建 Map：`{A: fiberA, B: fiberB, C: fiberC, D: fiberD}`
3. 新 D → `updateFromMap` 在 Map 中找到 D → 复用，oldIndex=3，lastPlacedIndex=0→3，不移动
4. 新 A → `updateFromMap` 在 Map 中找到 A → 复用，oldIndex=0，0 < 3 → 标记 Placement（移动）
5. 新 X → `updateFromMap` 在 Map 中找不到 → 创建新 Fiber，标记 Placement
6. Map 剩余 {B, C} → 标记 ChildDeletion

### 4.2 `updateFromMap` 逐行分析

```javascript
function updateFromMap(
  existingChildren: Map<string | number, Fiber>,
  returnFiber: Fiber,
  newIdx: number,
  newChild: any,
  lanes: Lanes,
): Fiber | null {
  // 文本节点：用 index 查找
  if (typeof newChild === 'string' && newChild !== '') {
    const matchedFiber = existingChildren.get(newIdx) || null;
    return updateTextNode(returnFiber, matchedFiber, '' + newChild, lanes);
  }
  
  if (typeof newChild === 'object' && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE: {
        // 用 key 查找（无 key 时用 index）
        const matchedFiber = existingChildren.get(
          newChild.key === null ? newIdx : newChild.key,
        ) || null;
        return updateElement(returnFiber, matchedFiber, newChild, lanes);
      }
      case REACT_PORTAL_TYPE: {
        const matchedFiber = existingChildren.get(
          newChild.key === null ? newIdx : newChild.key,
        ) || null;
        return updatePortal(returnFiber, matchedFiber, newChild, lanes);
      }
      // ...
    }
  }
  
  return null;
}
```

**与 `updateSlot` 的区别：**
- `updateSlot`：按**位置**匹配（oldFiber.index === newIdx），用于快速路径
- `updateFromMap`：按**key**匹配，用于慢速路径

---

## 五、入口函数 `reconcileChildFibers` 分发逻辑

```javascript
function reconcileChildFibers(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChild: any,
  lanes: Lanes,
): Fiber | null {
  // 1. 处理未加 key 的顶层 Fragment（当作数组处理）
  const isUnkeyedTopLevelFragment =
    typeof newChild === 'object' && newChild !== null
    && newChild.type === REACT_FRAGMENT_TYPE && newChild.key === null;
  
  if (isUnkeyedTopLevelFragment) {
    newChild = newChild.props.children;
  }
  
  // 2. 对象类型分发
  if (typeof newChild === 'object' && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE:
        return placeSingleChild(
          reconcileSingleElement(returnFiber, currentFirstChild, newChild, lanes)
        );
      case REACT_PORTAL_TYPE:
        return placeSingleChild(
          reconcileSinglePortal(returnFiber, currentFirstChild, newChild, lanes)
        );
      case REACT_LAZY_TYPE:
        // Lazy 组件：解析后递归
        const result = resolveLazy(newChild);
        return reconcileChildFibers(returnFiber, currentFirstChild, result, lanes);
    }
    
    if (isArray(newChild)) {
      return reconcileChildrenArray(returnFiber, currentFirstChild, newChild, lanes);
    }
    if (getIteratorFn(newChild)) {
      return reconcileChildrenIteratable(returnFiber, currentFirstChild, newChild, lanes);
    }
    
    // Thenable（Promise）→ Suspense 支持
    if (typeof newChild.then === 'function') {
      return reconcileChildFibers(
        returnFiber, currentFirstChild, unwrapThenable(newChild), lanes,
      );
    }
    
    // Context → 读取上下文值后递归
    if (newChild.$$typeof === REACT_CONTEXT_TYPE) {
      return reconcileChildFibers(
        returnFiber, currentFirstChild,
        readContextDuringReconciliation(returnFiber, newChild, lanes), lanes,
      );
    }
    
    throwOnInvalidObjectType(returnFiber, newChild);
  }
  
  // 3. 文本节点
  if (typeof newChild === 'string' && newChild !== '' || typeof newChild === 'number') {
    return placeSingleChild(
      reconcileSingleTextNode(returnFiber, currentFirstChild, '' + newChild, lanes)
    );
  }
  
  // 4. 其余（null/undefined/boolean）→ 删除所有旧子节点
  return deleteRemainingChildren(returnFiber, currentFirstChild);
}
```

**分发策略总结：**

| newChild 类型 | 处理方式 | 使用函数 |
|---|---|---|
| 单个 JSX 元素 | 单节点协调 | `reconcileSingleElement` |
| 单个 Portal | 单节点协调 | `reconcileSinglePortal` |
| 单个文本 | 单节点协调 | `reconcileSingleTextNode` |
| 数组 | 多节点协调 | `reconcileChildrenArray` |
| Iterator | 多节点协调 | `reconcileChildrenIterator` |
| Lazy | 解析后递归 | `resolveLazy` → 递归 |
| Promise | 展开后递归 | `unwrapThenable` → 递归 |
| Context | 读取后递归 | `readContextDuringReconciliation` → 递归 |
| null/undefined | 删除旧节点 | `deleteRemainingChildren` |

---

## 六、关键设计模式与工程智慧

### 6.1 三路扫描策略

```
快速路径（位置匹配）→ 中速路径（全插入/全删除）→ 慢速路径（Map 匹配）
```

**为什么这样设计？**
- 90% 以上的更新是"末尾追加"或"末尾删除"——快速路径 O(n) 搞定
- 只有列表重排/乱序时才需要 Map——O(n) 空间换 O(n) 时间
- 避免每次更新都构建 Map

### 6.2 副作用延迟标记

```
Reconciliation 阶段：只标记 flags（Placement/Deletion/Update）
Commit 阶段：根据 flags 执行真实 DOM 操作
```

**好处：**
- Reconciliation 可以中断/恢复（Fiber 架构的核心优势）
- 批量提交 DOM 操作，减少 reflow/repaint
- 错误边界可以在 Commit 前拦截

### 6.3 双版本导出

```javascript
export const reconcileChildFibers = createChildReconciler(true);   // 更新
export const mountChildFibers = createChildReconciler(false);      // 挂载
```

挂载时不需要跟踪副作用——所有节点都是新的。跳过 `shouldTrackSideEffects` 检查，减少分支预测失败。

### 6.4 Fiber 复用（`useFiber` / `createWorkInProgress`）

不是每次更新都创建新 Fiber，而是：
1. 检查 `fiber.alternate` 是否存在
2. 存在 → 复用，更新 `pendingProps`
3. 不存在 → 创建新 Fiber，设为 `fiber.alternate`

这就是**双缓冲**：current 树和 workInProgress 树交替使用同一批 Fiber 对象，减少 GC 压力。

---

## 七、与 Vue 3 Diff 算法的对比

| 维度 | React | Vue 3 |
|---|---|---|
| **类型** | 全量 Diff（类型无关） | 分类型 Diff（静态标记优化） |
| **关键策略** | 三路扫描 + Map | 双端比较 + 最长递增子序列 |
| **key 要求** | 运行时检查（DEV 警告） | 编译时静态分析 |
| **静态优化** | 无（运行时完全动态） | PatchFlags（编译时标记动态部分） |
| **时间复杂度** | O(n) 平均，Map 路径 O(n) 空间 | O(n) 平均，双端 O(1) 空间 |
| **移动检测** | lastPlacedIndex（简化 LIS） | 完整 LIS 算法 |

**React 的选择哲学：**
- 不依赖编译时优化——JSX 只是 JavaScript 函数调用
- 运行时算法足够快——三路扫描覆盖绝大多数场景
- 开发者负责 key——React 不做静态分析

**Vue 的选择哲学：**
- 编译时做尽可能多的分析——template 是静态可分析的
- 运行时只做最小工作——PatchFlags 告诉 diff 哪些属性是动态的
- 双端比较减少 Map 使用——大多数列表操作是首尾增删

---

## 八、核心代码路径图

```
reconcileChildFibers (入口)
  │
  ├─ 单个元素 → reconcileSingleElement
  │   ├─ 遍历旧链表找 key 匹配
  │   ├─ 匹配 → useFiber 复用 + deleteRemainingChildren
  │   └─ 不匹配 → createFiberFromElement 新建
  │
  ├─ 文本 → reconcileSingleTextNode
  │   ├─ 旧节点是 HostText → useFiber 复用
  │   └─ 否则 → 创建新文本 Fiber
  │
  └─ 数组/迭代器 → reconcileChildrenArray / reconcileChildrenIterator
      │
      ├─ 阶段一：快速路径（位置匹配）
      │   └─ updateSlot → updateElement / updateTextNode / updateFragment
      │
      ├─ 阶段二A：新数组结束 → deleteRemainingChildren
      ├─ 阶段二B：旧链表结束 → createChild（全插入）
      │
      └─ 阶段二C：Map 慢速路径
          ├─ mapRemainingChildren（构建 Map）
          ├─ updateFromMap（按 key 查找）
          └─ 遍历 Map 剩余 → deleteChild
```

---

## 九、关键 Takeaways

1. **Diff 的本质是求新旧节点之间的"最小编辑距离"**——React 用三路扫描 + lastPlacedIndex 在 O(n) 内近似求解

2. **key 不是性能优化，而是正确性保证**——没有 key 时 React 用 index 匹配，列表重排时会导致错误的复用

3. **React 不区分组件类型做 Diff**——无论 FunctionComponent 还是 ClassComponent，Diff 只看子节点（ReactElement），不看组件实现

4. **`createChildReconciler(true/false)` 是闭包优化的典范**——`shouldTrackSideEffects` 在工厂函数中固定，避免运行时分支

5. **lastPlacedIndex 是 LIS 的简化版**——完整 LIS 需要 O(n log n)，React 用 O(n) 的贪心近似，牺牲最优解换取性能

6. **Reconciliation 不修改 DOM**——只标记 Fiber flags，真正的 DOM 操作在 Commit 阶段批量执行

7. **Fiber 复用 = 双缓冲 = 减少 GC**——`createWorkInProgress` 优先使用 `alternate`，新旧树交替使用同一批对象

---

## 十、推荐阅读顺序（深入学习）

1. `ReactFiber.js` → `createWorkInProgress`（Fiber 创建与复用）
2. `ReactFiberFlags.js` → 理解 Placement/Deletion/Update 的位运算
3. `ReactFiberCommitWork.js` → `commitPlacement` / `commitDeletion`（DOM 操作实现）
4. `ReactChildFiber.js` → `reconcileChildrenIterator`（与 Array 算法对比）
5. Vue 3 `runtime-core/src/patch.ts` → 对比 Vue 的双端 Diff 策略
