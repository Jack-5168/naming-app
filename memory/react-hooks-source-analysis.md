# React Hooks 源码精读笔记

> 精读时间：2026-04-28 04:00 AM
> 源码版本：React main branch (2025+)
> 核心文件：`ReactFiberHooks.js` (~2500+ 行)
> 前置知识：React Fiber 架构（双缓冲、Fiber 节点结构、Lane 优先级）

---

## 一、Hooks 的本质——Fiber 上的链表

React Hooks 不是魔法，它只是一个**挂载在 Fiber 节点上的单向链表**。

### 1.1 Hook 数据结构

```typescript
export type Hook = {
  memoizedState: any,        // 当前渲染周期最终计算出的状态
  baseState: any,            // 基础状态（未被跳过的更新之前的状态）
  baseQueue: Update<any, any> | null,  // 基础更新队列（被跳过的更新会挂在这里）
  queue: any,                // 更新队列（包含 pending 更新链表 + dispatch 函数）
  next: Hook | null,         // 指向下一个 Hook（单向链表）
};
```

**关键洞察：Hook 链表 = 组件的状态记忆**

```
Fiber.memoizedState
  │
  ▼
[Hook0: useState] → [Hook1: useEffect] → [Hook2: useState] → [Hook3: useMemo] → null
  ↑                  ↑                      ↑                    ↑
  state: 0          create: fn             state: {}           value: 42
  queue: {...}      deps: [a, b]           queue: {...}        deps: [x]
```

**为什么用链表而不是数组？**
- 链表可以在 render 过程中增量构建（mountWorkInProgressHook 逐个追加）
- 更新时可以复用旧 Hook 结构（clone + 替换 memoizedState）
- 与 Fiber 的 child/sibling 链表风格一致

### 1.2 Update 和 UpdateQueue 数据结构

```typescript
// 单个更新
export type Update<S, A> = {
  lane: Lane,              // 优先级（Lane 位图）
  revertLane: Lane,        // 回退优先级（并发特性相关）
  action: A,               // 更新动作（setState 的参数）
  hasEagerState: boolean,  // 是否有预计算的状态（优化）
  eagerState: S | null,    // 预计算的状态
  next: Update<S, A>,      // 指向下一个 Update
  gesture: null | ScheduledGesture,
};

// 更新队列（环形链表）
export type UpdateQueue<S, A> = {
  pending: Update<S, A> | null,   // 最后一个 pending 更新（环形链表的尾部）
  lanes: Lanes,                   // 队列中所有更新的优先级合集
  dispatch: (A => mixed) | null,  // dispatch 函数（setState）
  lastRenderedReducer: ((S, A) => S) | null,  // 上次使用的 reducer
  lastRenderedState: S | null,    // 上次渲染后的状态
};
```

**环形链表设计（核心！）：**

```
queue.pending ──────────────────────────────┐
  │                                          │
  ▼                                          │
[Update A] → [Update B] → [Update C] ────────┘
  ↑                              │
  │                              │
  └──────── pending.next ────────┘

pending 指向最后一个元素
pending.next 指向第一个元素
遍历：从 pending.next 开始，到 pending 结束
```

**为什么用环形链表？**
- `enqueue` O(1)：只需修改 `pending.next` 和 `pending` 指针
- `dequeue` O(1)：从 `pending.next` 开始遍历
- 合并两个队列 O(1)：只需交换两个环的断点

---

## 二、模块级变量——Hooks 的"全局上下文"

```typescript
// 这些变量在 renderWithHooks 中设置，在组件函数执行期间保持有效
let renderLanes: Lanes = NoLanes;              // 当前渲染的优先级
let currentlyRenderingFiber: Fiber = (null: any); // 当前正在渲染的 Fiber

// Hook 遍历指针
let currentHook: Hook | null = null;           // 当前 current 树中的 Hook
let workInProgressHook: Hook | null = null;    // 当前 WIP 树中的 Hook

// 渲染阶段更新追踪
let didScheduleRenderPhaseUpdate: boolean = false;
let didScheduleRenderPhaseUpdateDuringThisPass: boolean = false;

// DEV 专用
let hookTypesDev: Array<HookType> | null = null;
let hookTypesUpdateIndexDev: number = -1;
```

**关键设计：闭包 + 模块变量 = 隐式状态传递**

这些变量不需要作为参数传递。当组件函数调用 `useState()` 时，`useState` 内部通过闭包访问这些变量。这就是为什么 Hooks 不能在条件语句中使用——模块变量的状态依赖于调用顺序。

---

## 三、renderWithHooks——Hooks 的入口

这是函数组件渲染的核心入口，在 `updateFunctionComponent` 中被调用：

```typescript
export function renderWithHooks(
  current: Fiber | null,        // current 树的 Fiber（首次渲染为 null）
  workInProgress: Fiber,        // WIP 树的 Fiber
  Component: (props, arg) => any,  // 组件函数
  props: Props,
  secondArg: SecondArg,
  nextRenderLanes: Lanes,
): any {
  // 1. 设置模块级上下文
  renderLanes = nextRenderLanes;
  currentlyRenderingFiber = workInProgress;

  // 2. 重置 WIP Fiber 的状态
  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;
  workInProgress.lanes = NoLanes;

  // 3. 选择 Dispatcher（关键！）
  ReactSharedInternals.H =
    current === null || current.memoizedState === null
      ? HooksDispatcherOnMount    // 首次挂载
      : HooksDispatcherOnUpdate;  // 更新

  // 4. 调用组件函数（Hooks 在这里被调用）
  let children = Component(props, secondArg);

  // 5. 处理 render 阶段的更新（setState 在渲染中调用）
  if (didScheduleRenderPhaseUpdateDuringThisPass) {
    children = renderWithHooksAgain(workInProgress, Component, props, secondArg);
  }

  // 6. 清理
  finishRenderingHooks(current, workInProgress, Component);

  return children;
}
```

**Dispatcher 切换机制（核心设计！）：**

```
ReactSharedInternals.H  →  全局共享的 Hooks 调度器

首次渲染：HooksDispatcherOnMount
  ├── useState → mountState
  ├── useEffect → mountEffect
  ├── useMemo → mountMemo
  └── useCallback → mountCallback

更新渲染：HooksDispatcherOnUpdate
  ├── useState → updateState
  ├── useEffect → updateEffect
  ├── useMemo → updateMemo
  └── useCallback → updateCallback

重新渲染（setState-in-render）：HooksDispatcherOnRerender
  ├── useState → rerenderState
  ├── useEffect → updateEffect
  └── ...
```

**这就是 React 如何实现"同一个 useState，不同行为"：**
不是通过参数判断，而是通过**替换全局调度器对象**。组件函数调用 `useState()` 时，实际调用的是 `ReactSharedInternals.H.useState()`，这个 `H` 在不同阶段指向不同对象。

---

## 四、Hook 链表的构建——mount vs update

### 4.1 mountWorkInProgressHook（首次挂载）

```typescript
function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  };

  if (workInProgressHook === null) {
    // 第一个 Hook → 挂载到 Fiber.memoizedState
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  } else {
    // 后续 Hook → 追加到链表尾部
    workInProgressHook = workInProgressHook.next = hook;
  }
  return workInProgressHook;
}
```

**执行过程：**

```
组件调用 useState()     → mountWorkInProgressHook() → 创建 Hook0
组件调用 useEffect()    → mountWorkInProgressHook() → 创建 Hook1，链接到 Hook0
组件调用 useState()     → mountWorkInProgressHook() → 创建 Hook2，链接到 Hook1

结果：
Fiber.memoizedState → Hook0 → Hook1 → Hook2 → null
                      ↑         ↑         ↑
                      wipHook   wipHook   wipHook (最终指向)
```

### 4.2 updateWorkInProgressHook（更新渲染）

```typescript
function updateWorkInProgressHook(): Hook {
  let nextCurrentHook: null | Hook;
  if (currentHook === null) {
    // 第一个 Hook → 从 current Fiber 的 memoizedState 获取
    const current = currentlyRenderingFiber.alternate;
    nextCurrentHook = current !== null ? current.memoizedState : null;
  } else {
    // 后续 Hook → 从 currentHook.next 获取
    nextCurrentHook = currentHook.next;
  }

  let nextWorkInProgressHook: null | Hook;
  if (workInProgressHook === null) {
    nextWorkInProgressHook = currentlyRenderingFiber.memoizedState;
  } else {
    nextWorkInProgressHook = workInProgressHook.next;
  }

  if (nextWorkInProgressHook !== null) {
    // 已有 WIP Hook → 复用（render phase update 场景）
    workInProgressHook = nextWorkInProgressHook;
    currentHook = nextCurrentHook;
  } else {
    // 无 WIP Hook → 从 current Hook 克隆
    currentHook = nextCurrentHook;
    const newHook: Hook = {
      memoizedState: currentHook.memoizedState,
      baseState: currentHook.baseState,
      baseQueue: currentHook.baseQueue,
      queue: currentHook.queue,
      next: null,
    };

    if (workInProgressHook === null) {
      currentlyRenderingFiber.memoizedState = workInProgressHook = newHook;
    } else {
      workInProgressHook = workInProgressHook.next = newHook;
    }
  }
  return workInProgressHook;
}
```

**关键洞察：双指针遍历**

```
current 树：  [Hook0] → [Hook1] → [Hook2] → null
               ↑                          ↑
            currentHook               currentHook.next

WIP 树：      [Hook0'] → [Hook1'] → [Hook2'] → null
               ↑                          ↑
          workInProgressHook      workInProgressHook.next
```

每次调用 `updateWorkInProgressHook()`，两个指针同步前进一步。**这就是 Hooks 顺序必须一致的原因**——第 N 次调用必须对应链表中的第 N 个节点。

---

## 五、useState 源码——基于 reducer 的状态管理

### 5.1 useState 的定义

```typescript
// useState 本质上就是 useReducer 的简化版
function useState<S>(initialState: S | (() => S)): [S, Dispatch<S>] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

// mount 时
const HooksDispatcherOnMount = {
  useState: mountState,
  // ...
};

// update 时
const HooksDispatcherOnUpdate = {
  useState: updateState,
  // ...
};
```

### 5.2 mountState（首次挂载）

```typescript
function mountState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  // 1. 创建 Hook 节点
  const hook = mountWorkInProgressHook();

  // 2. 计算初始状态（支持函数式初始化）
  if (typeof initialState === 'function') {
    initialState = initialState();
  }

  // 3. 初始化 Hook 状态
  hook.memoizedState = hook.baseState = initialState;

  // 4. 创建更新队列
  const queue: UpdateQueue<S, BasicStateAction<S>> = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: (initialState: any),
  };
  hook.queue = queue;

  // 5. 创建 dispatch 函数（绑定 fiber 和 queue）
  const dispatch: Dispatch<BasicStateAction<S>> = (queue.dispatch =
    dispatchReducerAction.bind(null, currentlyRenderingFiber, queue)
  );

  // 6. 返回 [state, setState]
  return [hook.memoizedState, dispatch];
}
```

**关键设计：dispatch 绑定 Fiber + Queue**

`setState` 函数内部绑定了当前 Fiber 和当前 Hook 的 queue。这就是为什么 `setState` 能精确找到要更新的 Hook——它不需要查找，它在创建时就已经知道了。

### 5.3 updateState（更新渲染）

```typescript
function updateState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  return updateReducer(basicStateReducer, (initialState: any));
}

// basicStateReducer：最简单的 reducer，直接返回 action
function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {
  return typeof action === 'function' ? action(state) : action;
}
```

### 5.4 updateReducerImpl（核心：更新队列处理）

这是整个 Hooks 系统最复杂的部分——处理更新队列：

```typescript
function updateReducerImpl<S, A>(
  hook: Hook,
  current: Hook,
  reducer: (S, A) => S,
): [S, Dispatch<A>] {
  const queue = hook.queue;

  // === 步骤 1：合并 pending 队列到 base 队列 ===
  let baseQueue = hook.baseQueue;
  const pendingQueue = queue.pending;

  if (pendingQueue !== null) {
    // 将环形 pending 队列拼接到 baseQueue 尾部
    if (baseQueue !== null) {
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;    // base 尾部 → pending 头部
      pendingQueue.next = baseFirst;    // pending 尾部 → base 头部
    }
    current.baseQueue = baseQueue = pendingQueue;
    queue.pending = null;  // 清空 pending
  }

  // === 步骤 2：如果没有待处理更新 → 直接返回 ===
  if (baseQueue === null) {
    hook.memoizedState = hook.baseState;
    return [hook.memoizedState, queue.dispatch];
  }

  // === 步骤 3：遍历更新队列，计算新状态 ===
  const first = baseQueue.next;
  let newState = hook.baseState;
  let newBaseState = null;
  let newBaseQueueFirst = null;
  let newBaseQueueLast = null;
  let update = first;

  do {
    // 检查优先级：这个更新是否应该被处理？
    const updateLane = removeLanes(update.lane, OffscreenLane);
    const shouldSkipUpdate = !isSubsetOfLanes(renderLanes, updateLane);

    if (shouldSkipUpdate) {
      // 跳过此更新 → 克隆到新的 baseQueue
      const clone: Update<S, A> = {
        lane: updateLane,
        revertLane: update.revertLane,
        action: update.action,
        hasEagerState: update.hasEagerState,
        eagerState: update.eagerState,
        next: null,
      };
      if (newBaseQueueLast === null) {
        newBaseQueueFirst = newBaseQueueLast = clone;
        newBaseState = newState;
      } else {
        newBaseQueueLast = newBaseQueueLast.next = clone;
      }
    } else {
      // 处理此更新
      const action = update.action;
      newState = reducer(newState, action);  // 调用 reducer

      // 如果 eagerState 匹配 → 跳过后续更新（优化）
      if (update.hasEagerState) {
        newState = update.eagerState;
      }
    }

    update = update.next;
  } while (update !== null && update !== first);

  // === 步骤 4：更新 Hook 状态 ===
  if (newBaseQueueLast === null) {
    // 所有更新都被处理了
    newBaseState = newState;
  } else {
    // 形成新的环形链表
    newBaseQueueLast.next = newBaseQueueFirst;
  }

  hook.memoizedState = newState;
  hook.baseState = newBaseState;
  hook.baseQueue = newBaseQueueLast;

  queue.lastRenderedState = newState;

  return [newState, queue.dispatch];
}
```

**更新队列处理流程图：**

```
用户调用 setState(newValue)
  │
  ▼
dispatchReducerAction(fiber, queue, action)
  │
  ├─ 1. 创建 Update 对象
  │    update = { lane, action, next: self }
  │
  ├─ 2. 将 update 加入 queue.pending（环形链表）
  │    pending = update（如果之前为空）
  │    或：update.next = pending.next; pending.next = update; pending = update
  │
  ├─ 3. Eager State 优化：预计算新状态
  │    eagerState = reducer(lastRenderedState, action)
  │    if (eagerState === lastRenderedState) → bailout，不触发渲染
  │
  └─ 4. scheduleUpdateOnFiber(fiber, lane)
       → 进入 React 调度系统
         │
         ▼
      renderWithHooks → updateReducer → updateReducerImpl
        │
        ├─ 合并 pending → baseQueue
        ├─ 遍历 baseQueue，按优先级处理每个 Update
        ├─ 跳过的更新 → 放入新的 baseQueue
        └─ 返回 [newState, dispatch]
```

---

## 六、useEffect 源码——副作用的调度

### 6.1 Effect 数据结构

```typescript
export type Effect = {
  tag: HookFlags,           // 效果标记（Passive / Layout / HasEffect 等）
  inst: EffectInstance,     // 效果实例（存储 destroy 函数）
  create: () => (() => void) | void,  // 副作用函数
  deps: Array<mixed> | void | null,   // 依赖数组
  next: Effect,             // 指向下一个 Effect（环形链表）
};

type EffectInstance = {
  destroy: void | (() => void),  // 清理函数
};
```

### 6.2 HookFlags 位标志

```typescript
export type HookFlags = number;
// 定义在 ReactHookEffectTags.js

export const NoFlags = /*     */ 0b0000;
export const HasEffect = /*   */ 0b0001;  // 有副作用需要执行
export const Insertion = /*   */ 0b0010;  // useInsertionEffect
export const Layout = /*      */ 0b0100;  // useLayoutEffect
export const Passive = /*     */ 0b1000;  // useEffect（被动效果）
```

**HasEffect 的含义：**
- 有 HasEffect 标志 → 这个 effect 需要执行（首次挂载或依赖变化）
- 无 HasEffect 标志 → 这个 effect 不需要执行（依赖未变化）

### 6.3 mountEffect（首次挂载）

```typescript
function mountEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  return mountEffectImpl(
    PassiveEffect | PassiveStaticEffect,  // Fiber 标记
    HookPassive,                           // Effect tag
    create,
    deps,
  );
}

function mountEffectImpl(fiberFlags, hookFlags, create, deps): void {
  // 1. 创建 Hook 节点
  const hook = mountWorkInProgressHook();

  // 2. 创建 EffectInstance
  const inst: EffectInstance = {
    destroy: undefined,
  };
  hook.memoizedState = inst;

  // 3. 创建 Effect 对象
  const effect: Effect = {
    tag: hookFlags,           // HookPassive
    create,
    deps,
    inst,
    next: (null: any),
  };

  // 4. 将 effect 加入 Fiber 的 updateQueue（环形链表）
  pushEffect(hookFlags, create, inst, deps);
}

function pushEffect(tag, create, inst, deps): Effect {
  // 1. 创建 Effect 对象
  const effect: Effect = {
    tag,
    create,
    deps,
    inst,
    next: (null: any),
  };

  // 2. 获取或创建 FunctionComponentUpdateQueue
  const componentUpdateQueue = currentlyRenderingFiber.updateQueue;
  if (componentUpdateQueue === null) {
    currentlyRenderingFiber.updateQueue = createFunctionComponentUpdateQueue();
  }

  const updateQueue: FunctionComponentUpdateQueue =
    (currentlyRenderingFiber.updateQueue: any);

  // 3. 将 effect 加入环形链表
  const lastEffect = updateQueue.lastEffect;
  if (lastEffect === null) {
    updateQueue.lastEffect = effect.next = effect;  // 自环
  } else {
    const firstEffect = lastEffect.next;
    lastEffect.next = effect;
    effect.next = firstEffect;
    updateQueue.lastEffect = effect;
  }

  return effect;
}
```

**Fiber.updateQueue 中的 Effect 环形链表：**

```
Fiber.updateQueue.lastEffect
  │
  ▼
[Effect0] → [Effect1] → [Effect2]
  ↑                    │
  │                    │
  └────────────────────┘

遍历：从 lastEffect.next 开始，到 lastEffect 结束
```

### 6.4 updateEffect（更新渲染）

```typescript
function updateEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  return updateEffectImpl(PassiveEffect, HookPassive, create, deps);
}

function updateEffectImpl(fiberFlags, hookFlags, create, deps): void {
  // 1. 获取当前 Hook（从 current 树克隆）
  const hook = updateWorkInProgressHook();

  // 2. 依赖比较
  const nextDeps = deps === undefined ? null : deps;
  let destroy = undefined;

  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState;
    destroy = prevEffect.destroy;

    // 3. 如果依赖未变化 → 不需要重新执行
    if (nextDeps !== null && areHookInputsEqual(nextDeps, prevEffect.deps)) {
      // 依赖相同 → 复用旧 effect，去掉 HasEffect 标志
      pushEffect(hookFlags, create, inst, nextDeps);
      return;
    }
  }

  // 4. 依赖变化或首次 → 标记 HasEffect
  currentlyRenderingFiber.flags |= fiberFlags;

  const inst: EffectInstance = {
    destroy,  // 保留上次的 destroy 函数
  };
  hook.memoizedState = inst;

  pushEffect(HookPassive | HookHasEffect, create, inst, nextDeps);
}
```

**依赖比较函数：**

```typescript
function areHookInputsEqual(
  nextDeps: Array<mixed>,
  prevDeps: Array<mixed> | null,
): boolean {
  if (prevDeps === null) return false;

  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    // 使用 Object.is 比较（与 === 类似，但 NaN === NaN）
    if (is(nextDeps[i], prevDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}
```

### 6.5 useEffect 的执行时机

```
render 阶段（可中断）：
  renderWithHooks
    → updateEffect
      → pushEffect(HookPassive | HookHasEffect, ...)
        → 只是将 effect 加入 updateQueue 环形链表
        → 不执行 create 函数！

commit 阶段（同步，不可中断）：
  commitRoot
    │
    ├─ BeforeMutation
    ├─ Mutation（DOM 操作）
    └─ Layout
        │
        └─ commitPassiveEffects（异步调度）
            │
            └─ 遍历 updateQueue.lastEffect 环形链表
                │
                ├─ 有 HookHasEffect + HookPassive → 调用旧 destroy
                └─ 有 HookHasEffect + HookPassive → 调用新 create
```

**关键洞察：useEffect 是异步执行的**

`useEffect` 的 create 函数不是在渲染阶段执行的，而是在 commit 阶段之后**异步调度**的。这就是为什么 useEffect 不会阻塞浏览器绘制。

而 `useLayoutEffect` 是在 commit Layout 阶段**同步执行**的，会阻塞浏览器绘制。

---

## 七、useMemo / useCallback——记忆化

### 7.1 mountMemo

```typescript
function mountMemo<T>(
  nextCreate: () => T,
  deps: Array<mixed> | void | null,
): T {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const nextValue = nextCreate();  // 执行计算
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}
```

### 7.2 updateMemo

```typescript
function updateMemo<T>(
  nextCreate: () => T,
  deps: Array<mixed> | void | null,
): T {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;

  if (nextDeps !== null) {
    const prevDeps: Array<mixed> | null = prevState[1];
    // 依赖未变化 → 返回缓存值
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      return prevState[0];
    }
  }

  // 依赖变化 → 重新计算
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}
```

### 7.3 useCallback

```typescript
// useCallback 就是 useMemo 的包装
function useCallback<T>(
  callback: T,
  deps: Array<mixed> | void | null,
): T {
  return mountMemo(() => callback, deps);  // mount
  // 或
  return updateMemo(() => callback, deps);  // update
}
```

**关键洞察：useMemo 和 useCallback 的区别**

```typescript
useMemo(() => fn, deps)   → 缓存函数调用结果
useCallback(fn, deps)      → 缓存函数引用本身

// 等价于：
useMemo(() => expensiveComputation(), [a])  // 缓存计算结果
useCallback(() => doSomething(), [a])       // 缓存函数引用
```

---

## 八、Dispatcher 切换机制——Hooks 的"多态"

```typescript
// 三种 Dispatcher
const HooksDispatcherOnMount = {
  useState: mountState,
  useReducer: mountReducer,
  useEffect: mountEffect,
  useLayoutEffect: mountLayoutEffect,
  useMemo: mountMemo,
  useCallback: mountCallback,
  useRef: mountRef,
  useContext: readContext,
  // ...
};

const HooksDispatcherOnUpdate = {
  useState: updateState,
  useReducer: updateReducer,
  useEffect: updateEffect,
  useLayoutEffect: updateLayoutEffect,
  useMemo: updateMemo,
  useCallback: updateCallback,
  useRef: updateRef,
  useContext: readContext,
  // ...
};

const HooksDispatcherOnRerender = {
  useState: rerenderState,
  useReducer: rerenderReducer,
  useEffect: updateEffect,
  // ...
};

// 在 renderWithHooks 中切换
ReactSharedInternals.H =
  current === null || current.memoizedState === null
    ? HooksDispatcherOnMount
    : HooksDispatcherOnUpdate;
```

**ReactSharedInternals 是什么？**

```typescript
// shared/ReactSharedInternals.js
const ReactSharedInternals = {
  H: null,  // Hooks dispatcher
  // ...
};

// React 在初始化时设置
// react/src/React.js
React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactSharedInternals;
```

这是 React 内部的全局共享状态。Hooks dispatcher 通过这个对象暴露给所有 Hook 函数。组件调用 `useState()` 时，实际执行的是 `ReactSharedInternals.H.useState()`。

---

## 九、Rules of Hooks 的源码实现

### 9.1 为什么 Hooks 不能在条件语句中使用？

源码中的答案：

```typescript
// updateWorkInProgressHook 中
if (nextCurrentHook === null) {
  throw new Error('Rendered more hooks than during the previous render.');
}

// finishRenderingHooks 中
const didRenderTooFewHooks = currentHook !== null && currentHook.next !== null;
if (didRenderTooFewHooks) {
  throw new Error(
    'Rendered fewer hooks than expected. This may be caused by an accidental ' +
      'early return statement.',
  );
}
```

**根本原因：Hook 链表的索引位置 = Hook 的身份**

```
第 1 次调用 useState → 链表第 1 个节点 → 存储 count
第 2 次调用 useState → 链表第 2 个节点 → 存储 name
第 3 次调用 useEffect → 链表第 3 个节点 → 存储 effect

如果条件渲染：
  if (condition) { useState() }  // 有时是第 1 个，有时不存在
  useState()                      // 有时是第 2 个，有时是第 1 个
  → 链表索引错位 → 状态混乱
```

### 9.2 DEV 模式的 Hook 顺序检查

```typescript
// mount 时记录 Hook 名称
function mountHookTypesDev(): void {
  if (__DEV__) {
    const hookName = currentHookNameInDev;
    if (hookTypesDev === null) {
      hookTypesDev = [hookName];
    } else {
      hookTypesDev.push(hookName);
    }
  }
}

// update 时检查 Hook 顺序
function updateHookTypesDev(): void {
  if (__DEV__) {
    const hookName = currentHookNameInDev;
    hookTypesUpdateIndexDev++;
    if (hookTypesDev[hookTypesUpdateIndexDev] !== hookName) {
      warnOnHookMismatchInDev(hookName);
    }
  }
}
```

**错误提示示例：**

```
React has detected a change in the order of Hooks called by MyComponent.
This will lead to bugs and errors if not fixed.

   Previous render            Next render
   ------------------------------------------------------
   1. useState                useState
   2. useEffect               useEffect
   3. useState                useMemo      ← 顺序变了！
```

---

## 十、关键设计模式总结

### 10.1 Hook 链表 vs 对象存储

| 方面 | Hook 链表 | 对象存储（如 Vue） |
|------|-----------|-------------------|
| 身份标识 | 调用顺序（索引位置） | 变量名（key） |
| 条件渲染 | ❌ 不支持 | ✅ 支持 |
| 动态增减 | ❌ 不支持 | ✅ 支持 |
| 内存布局 | 紧凑（单向链表） | 稀疏（对象属性） |
| 遍历方式 | 顺序遍历 | 随机访问 |

### 10.2 环形链表 vs 普通链表

React 在多处使用环形链表：

| 位置 | 数据结构 | 用途 |
|------|---------|------|
| UpdateQueue | pending 环形链表 | 存储待处理的 state 更新 |
| Effect 链表 | lastEffect 环形链表 | 存储副作用 |
| Fiber 子节点 | child + sibling 单向链表 | 虚拟 DOM 树 |
| Hook 链表 | memoizedState → next 单向链表 | 组件状态 |

**环形链表的优势：**
- enqueue O(1)：`pending.next = new; new.next = first; pending = new`
- dequeue O(1)：`first = pending.next; pending.next = first.next`
- 合并 O(1)：交换两个环的断点

### 10.3 Eager State 优化

```typescript
// dispatchReducerAction 中
function dispatchReducerAction(fiber, queue, action) {
  // 预计算新状态
  const lastRenderedState = queue.lastRenderedState;
  const eagerState = lastRenderedReducer(lastRenderedState, action);
  update.hasEagerState = true;
  update.eagerState = eagerState;

  // 如果新状态和旧状态相同 → 直接 bailout
  if (is(eagerState, lastRenderedState)) {
    return;  // 不触发渲染！
  }

  // 否则正常调度
  scheduleUpdateOnFiber(fiber, lane);
}
```

**这个优化避免了不必要的渲染：**
```
setState(5) → 当前 state 就是 5 → eagerState === 5 → bailout → 不渲染
```

### 10.4 优先级跳过机制

```typescript
// updateReducerImpl 中
const shouldSkipUpdate = !isSubsetOfLanes(renderLanes, updateLane);

if (shouldSkipUpdate) {
  // 克隆到新的 baseQueue，等下次高优先级渲染时处理
  const clone = { ...update, next: null };
  newBaseQueueLast.next = clone;
}
```

**这就是 React 18 并发特性的基础：**
低优先级的更新可以被跳过，等高优先级更新完成后再处理。

---

## 十一、与 Vue 3 响应式系统的对比

| 方面 | React Hooks | Vue 3 响应式 |
|------|-------------|-------------|
| 更新触发 | 手动 setState | 自动 Proxy 依赖追踪 |
| 状态存储 | Fiber 上的 Hook 链表 | Proxy 包裹的对象 |
| 依赖追踪 | 无（靠重新渲染） | 自动 track/trigger |
| 精确更新 | 无（整个组件重渲染） | 属性级精确更新 |
| 条件渲染 | ❌ Hooks 不支持 | ✅ 无限制 |
| 记忆化 | useMemo/useCallback | computed/watch（自动缓存） |
| 副作用 | useEffect（手动依赖） | watchEffect（自动依赖） |
| 更新队列 | 环形链表 + Lane 优先级 | batch + flushQueue |

---

## 十二、学习收获

1. **Hooks 的本质是 Fiber 上的链表**：不是闭包魔法，不是代理对象，就是一个简单的单向链表。每个 Hook 的身份由它在链表中的位置决定。

2. **Dispatcher 切换 = 隐式状态机**：通过替换 `ReactSharedInternals.H` 实现 mount/update/rerender 三种行为，而不是用参数判断。这是非常优雅的状态机实现。

3. **环形链表是 React 的核心数据结构**：UpdateQueue、Effect 链表都用环形链表实现 O(1) 的 enqueue/dequeue/merge。

4. **Eager State 优化是性能关键**：在 dispatch 时预计算新状态，如果相同则直接 bailout，避免不必要的渲染。

5. **useEffect 是异步执行的**：create 函数在 commit 阶段之后异步调度，不阻塞浏览器绘制。这是 React 保证 UI 流畅的关键。

6. **Rules of Hooks 的根源是链表索引**：Hook 的身份 = 调用顺序。条件渲染会破坏这个假设，导致状态错位。

7. **useState 就是 useReducer 的特例**：`basicStateReducer` 是最简单的 reducer，直接返回 action。

8. **模块级变量是隐式上下文**：`currentlyRenderingFiber`、`currentHook`、`workInProgressHook` 等变量在组件渲染期间保持有效，Hook 函数通过闭包访问它们。

---

## 十三、源码文件结构

```
packages/react-reconciler/src/
├── ReactFiberHooks.js          ← 核心：Hooks 实现（本文精读）
├── ReactFiber.js               ← Fiber 节点创建
├── ReactFiberWorkLoop.js       ← 工作循环（调度 + 渲染）
├── ReactFiberBeginWork.js      ← beginWork（分发到不同组件类型）
├── ReactFiberCompleteWork.js   ← completeWork（DOM 创建/更新）
├── ReactFiberLane.js           ← Lane 优先级模型
├── ReactFiberFlags.js          ← Fiber 副作用标记
├── ReactHookEffectTags.js      ← Effect 标记
├── ReactFiberConcurrentUpdates.js  ← 并发更新入队
└── ReactFiberNewContext.js     ← Context 读取

packages/react/src/
├── React.js                    ← React 入口（暴露 useState 等）
├── ReactHooks.js               ← 公开 API（resolveDispatcher）
└── ReactSharedInternals.js     ← 全局共享状态
```

---

_下次计划：Vue 3 Compiler 源码精读（模板编译 → render function → 优化标志）_
