# Vue 3 Patch 算法与虚拟 DOM Diff 源码精读笔记

> 精读时间：2026-05-05 04:00 AM
> 源码版本：Vue 3.4+ (runtime-core/src/renderer.ts ~2500+ 行)
> 前置知识：Vue 3 响应式系统、组件实例系统、Fiber 概念、React Diff 算法

---

## 一、整体架构——Patch 在 Vue 渲染管线中的位置

Vue 3 的渲染管线是一条完整的流水线：

```
模板编译 → render 函数 → vnode 树 → patch() → 真实 DOM
                                    ↑
                              核心 diff 引擎
```

```
packages/runtime-core/src/
├── renderer.ts          # ★ 核心：patch / mountElement / patchElement / mountChildren / patchChildren
├── vnode.ts             # VNode 类定义、createVNode()、isVNode()
├── component.ts         # 组件实例创建、setupComponent
├── componentRenderUtils.ts  # setCurrentRenderingInstance、handleSetupResult
├── scheduler.ts         # 调度系统（flushPreFlushCbs / queueJob / flushPostFlushCbs）
└── hmr.ts               # 热更新
```

**核心文件 `renderer.ts` 的职责：**
- `render(vnode, container)` — 渲染入口
- `patch(n1, n2, container, ...)` — 核心 diff 引擎，决定挂载/更新/卸载
- `mountElement(vnode, container, anchor)` — 首次挂载元素
- `patchElement(n1, n2, ...)` — 更新已有元素
- `mountChildren(children, ...)` — 挂载子节点列表
- `patchChildren(n1, n2, ...)` — diff 子节点列表（核心算法）

---

## 二、VNode 数据结构——Diff 的基本单位

### 2.1 VNode 接口定义

```typescript
export interface VNode {
  // === 身份标识 ===
  __v_isVNode: true
  [ReactiveFlags.SKIP]: true
  type: VNodeTypes            // 标签名('div')/组件/Fragment/Teleport/Suspense
  props: (VNodeProps & Record<string, any>) | null  // 属性/事件/refs
  key: NormalizedKey | null   // ★ diff 时的身份标识
  ref: VNodeNormalizedRef | null  // ref 绑定

  // === 位置信息 ===
  component: ComponentPublicInstance | null  // 组件实例（组件 vnode）
  suspense: SuspenseBoundary | null          // Suspense 边界
  ssContent / ssFallback: VNode | null       // SSR 内容/回退
  dirs: DirectiveBinding[] | null            // 自定义指令
  transition: TransitionHooks | null         // 过渡动画

  // === DOM 引用 ===
  el: Element | Text | undefined             // ★ 对应的真实 DOM 节点
  anchor: Node | null                        // ★ patch 时的锚点（Fragment 场景）
  target: Element | null                     // Teleport 目标容器
  targetAnchor: Node | null                  // Teleport 锚点

  // === 树结构 ===
  staticCount: number                        // 静态子节点数量（静态提升优化）
  shapeFlag: ShapeFlags                      // ★ 位标记：快速判断 vnode 类型
  patchFlag: number                          // ★ 动态标记：优化 patch 范围
  dynamicProps: string[] | null              // 动态属性名列表
  dynamicChildren: VNode[] | null            // ★ 动态子节点数组（Block Tree 核心）

  // === 优化标记 ===
  appContext: AppContext | null
  ctx: string | undefined
  // 缓存和内存优化
  ce?: ComponentOptions
}
```

**关键洞察：VNode 不是简单的"DOM 描述"，而是包含完整渲染上下文的结构体。**

### 2.2 ShapeFlags — 位标记系统

```typescript
export const enum ShapeFlags {
  ELEMENT = 1,           // 0b00000001 — 普通 HTML 元素
  FUNCTIONAL_COMPONENT = 2,  // 0b00000010 — 函数组件
  STATEFUL_COMPONENT = 4,    // 0b00000100 — 有状态组件（class/defineComponent）
  TEXT_CHILDREN = 8,         // 0b00001000 — 子节点是纯文本
  ARRAY_CHILDREN = 16,       // 0b00010000 — 子节点是数组
  SLOTS_CHILDREN = 32,       // 0b00100000 — 子节点是插槽
  TELEPORT = 64,             // 0b01000000 — Teleport
  SUSPENSE = 128,            // 0b10000000 — Suspense
  COMPONENT = 6,             // ELEMENT | FUNCTIONAL | STATEFUL — 组件类型掩码
  STATEABLE_SLOT = 256,      // 0b1_0000_0000 — 可状态化插槽
  SHOULD_KEEP_ALIVE = 512,   // 0b10_0000_0000 — keep-alive
  COMPILED_FRAGMENT = 1024,  // 0b100_0000_0000 — 编译时 Fragment
}
```

**为什么用位运算？** 因为 `patch()` 函数会被调用成千上万次，`vnode.shapeFlag & ShapeFlags.ELEMENT` 比 `vnode.type === 'div'` 快一个数量级。

```typescript
// 组合判断示例
const isComponent = vnode.shapeFlag & ShapeFlags.COMPONENT  // 6 = 2|4
const hasChildren = vnode.shapeFlag & (ShapeFlags.TEXT_CHILDREN | ShapeFlags.ARRAY_CHILDREN)
```

### 2.3 PatchFlag — 编译时优化的核心

```typescript
export const enum PatchFlags {
  TEXT = 1,                // 0b00001 — 仅文本内容动态
  CLASS = 1 << 1,          // 0b00010 — class 动态
  STYLE = 1 << 2,          // 0b00100 — style 动态
  PROPS = 1 << 3,          // 0b01000 — 非 class/style 属性动态
  FULL_PROPS = 1 << 4,     // 0b10000 — key 或动态属性数量不固定
  HYDRATE_EVENTS = 1 << 5, // 0b100000 — 服务端渲染事件绑定
  STABLE_FRAGMENT = 1 << 6, // 0b1000000 — 子节点顺序稳定
  KEYED_FRAGMENT = 1 << 7,  // 0b10000000 — 有 key 的 fragment
  UNKEYED_FRAGMENT = 1 << 8, // 0b100000000 — 无 key 的 fragment
  NEED_PATCH = 1 << 9,     // 需要 patch（与前一版本比较）
  DYNAMIC_SLOTS = 1 << 10, // 动态插槽
  DEV_ROOT_FRAGMENT = 1 << 11,
  HOISTED = -1,            // 静态提升（hoistStatic）
  BAIL = -2,               // 放弃优化（回退到全量 diff）
}
```

**PatchFlag 的价值：** 编译器在编译模板时，已经知道哪些部分是静态的、哪些是动态的。运行时不需要重新计算，直接读取 PatchFlag 即可跳过不必要的 diff。

```html
<!-- 编译前 -->
<div>
  <h1>{{ title }}</h1>
  <p class="static">静态段落</p>
  <span :class="dynamicClass">{{ count }}</span>
</div>

<!-- 编译后（伪代码） -->
const _hoisted_1 = createVNode("h1", null, "静态标题", -1 /* HOISTED */)
const _hoisted_2 = createVNode("p", { class: "static" }, "静态段落", -1 /* HOISTED */)

return (openBlock(), createBlock("div", null, [
  _hoisted_1,
  _hoisted_2,
  createVNode("span", {
    class: dynamicClass
  }, toDisplayString(count), 9 /* TEXT + CLASS */, ["class"])
], 64 /* STABLE_FRAGMENT */))
```

**关键洞察：** Vue 3 的 diff 不是"全量对比"，而是"精准打击"。PatchFlag 告诉 patch 函数：**只需要比较哪些属性，只需要更新哪些子节点**。

---

## 三、patch() 函数——Diff 的核心调度器

### 3.1 patch() 完整逻辑（逐行分析）

```typescript
// renderer.ts — patch 函数（简化后约 80 行核心逻辑）
const patch: PatchFn = (
  n1,        // 旧 vnode（null = 首次挂载）
  n2,        // 新 vnode
  container, // 父容器
  anchor = null,  // 插入锚点（用于 Fragment 精确插入）
  parentComponent = null,  // 父组件实例
  parentSuspense = null,   // 父 Suspense 边界
  isSVG = false,           // 是否在 SVG 命名空间
  slotScopeIds = null,     // 插槽作用域 ID
  optimized = false        // 是否开启编译优化
) => {
  // ===== 步骤 1: 相同引用短路 =====
  if (n1 && isSameVNodeType(n1, n2)) {
    // 如果新旧 vnode 是同一类型（type + key 相同）
    // 但引用不同，说明需要更新——把旧 vnode 设为 n2 的 base
    anchor = n1.el  // 继承旧 vnode 的 DOM 锚点
    n2.el = n1.el   // 新 vnode 复用旧 DOM 节点
    n1 = n2.el = null  // 清理旧引用
  }

  // ===== 步骤 2: 卸载旧节点 =====
  if (n1 && !isSameVNodeType(n1, n2)) {
    // 类型不同：先卸载旧节点
    unmount(n1, parentComponent, parentSuspense, true)
    n1 = null  // 后续逻辑按首次挂载处理
  }

  // ===== 步骤 3: 根据新 vnode 类型分发 =====
  const { type, shapeFlag } = n2

  switch (type) {
    case Text:
      // 纯文本节点：直接创建/更新 text node
      processText(n1, n2, container, anchor)
      break
    case Comment:
      // 注释节点
      processCommentNode(n1, n2, container, anchor)
      break
    case Static:
      // 静态节点（一次性插入，后续不再 diff）
      processStaticNode(n1, n2, container, anchor)
      break
    case Fragment:
      // ★ Fragment：一组 vnode，需要 diff 子节点列表
      processFragment(n1, n2, container, anchor, parentComponent,
                      parentSuspense, isSVG, slotScopeIds, optimized)
      break
    default:
      if (shapeFlag & ShapeFlags.ELEMENT) {
        // 普通 HTML 元素
        processElement(n1, n2, container, anchor, parentComponent,
                       parentSuspense, isSVG, slotScopeIds, optimized)
      } else if (shapeFlag & ShapeFlags.COMPONENT) {
        // 组件
        processComponent(n1, n2, container, anchor, parentComponent,
                         parentSuspense, isSVG, slotScopeIds, optimized)
      } else if (shapeFlag & ShapeFlags.TELEPORT) {
        // Teleport
        type.process(n1, n2, container, anchor, parentComponent,
                     parentSuspense, isSVG, slotScopeIds, optimized, internals)
      } else if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
        // Suspense
        type.process(n1, n2, container, anchor, parentComponent,
                     parentSuspense, isSVG, slotScopeIds, optimized, internals)
      }
  }
}
```

**关键洞察 1：patch() 是一个调度器，不是 diff 算法本身。** 它根据 vnode 类型将工作分发给 `processElement`、`processComponent`、`processFragment` 等专门的处理器。

**关键洞察 2：`isSameVNodeType(n1, n2)` 是 diff 的第一道门。** 判断标准是 `n1.type === n2.type && n1.key === n2.key`。如果类型或 key 不同，旧节点直接卸载，新节点全新挂载——不做任何 diff。

### 3.2 isSameVNodeType 实现

```typescript
const isSameVNodeType = (n1: VNode, n2: VNode): boolean => {
  return n1.type === n2.type && n1.key === n2.key
}
```

**为什么 key 这么重要？**

```html
<!-- 没有 key：Vue 只能按位置 diff，可能导致状态错乱 -->
<div v-for="item in list">
  <input v-model="item.value" />
</div>
<!-- 删除第一个 item 后，input 的值不会跟着 item 走 -->

<!-- 有 key：Vue 能正确追踪每个 item 的 DOM -->
<div v-for="item in list" :key="item.id">
  <input v-model="item.value" />
</div>
<!-- 删除第一个 item 后，对应 DOM 正确移除 -->
```

---

## 四、processElement()——元素节点的 patch

### 4.1 完整流程

```typescript
const processElement = (
  n1, n2, container, anchor, parentComponent, parentSuspense,
  isSVG, slotScopeIds, optimized
) => {
  isSVG = isSVG || n2.type === 'svg'

  if (n1 == null) {
    // ===== 首次挂载 =====
    mountElement(n2, container, anchor, parentComponent, parentSuspense,
                 isSVG, slotScopeIds, optimized)
  } else {
    // ===== 更新已有元素 =====
    patchElement(n1, n2, parentComponent, parentSuspense, isSVG,
                 slotScopeIds, optimized)
  }
}
```

### 4.2 mountElement()——首次挂载元素

```typescript
const mountElement = (
  vnode, container, anchor, parentComponent, parentSuspense,
  isSVG, slotScopeIds, optimized
) => {
  let el: Element
  let vnodeHook: VNodeHook | undefined
  const { type, props, shapeFlag, transition } = vnode

  // 1. 创建 DOM 元素
  el = vnode.el = hostCreateElement(
    vnode.type,              // 'div'
    isSVG,                   // false
    props && props.is,       // 自定义元素
    props && props.isCE      // 自定义元素
  )

  // 2. 设置 CSS 作用域属性（scoped CSS）
  if (shapeFlag & ShapeFlags.SCOPED_SLOTS) {
    setScopedId(el, vnode)
  }

  // 3. 处理 vnodeHook（beforeMount）
  if ((vnodeHook = props && props.onVnodeBeforeMount)) {
    invokeVNodeHook(vnodeHook, parentComponent, vnode)
  }

  // 4. 设置 props（属性、事件、class、style）
  if (props) {
    setFullProps(el, props, vnode)  // 详细分析见下文
  }

  // 5. 挂载子节点
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    // 子节点是纯文本 → 直接设置 textContent
    hostSetElementText(el, vnode.children as string)
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    // 子节点是数组 → 递归 patch 每个子 vnode
    mountChildren(
      vnode.children as VNodeArrayChildren,
      el,
      null,
      parentComponent,
      parentSuspense,
      isSVG,
      slotScopeIds,
      optimized || !!vnode.dynamicChildren
    )
  }

  // 6. 处理 transition（进入动画）
  if (transition) {
    transition.beforeEnter(el)
    transition.enter(el)
  }

  // 7. 插入 DOM
  hostInsert(el, container, anchor)

  // 8. 触发 mounted 钩子
  if ((vnodeHook = props && props.onVnodeMounted) || transition) {
    queuePostRenderEffect(() => {
      vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode)
      transition && transition.afterEnter(el)
    }, parentSuspense)
  }
}
```

**关键洞察：mountElement 的核心是"创建 → 设置属性 → 挂载子节点 → 插入 DOM"四步。** 其中 `mountChildren` 会递归调用 `patch`，形成深度优先的挂载树。

### 4.3 setFullProps()——属性设置

```typescript
function setFullProps(
  el: Element,
  props: VNodeProps,
  vnode: VNode
) {
  // 按优先级顺序处理：class → style → props → events
  // 这个顺序很重要，因为后面的会覆盖前面的

  // 1. class
  if (props.class != null && !isSameValue(props.class, prevProps?.class)) {
    hostPatchProp(el, 'class', prevProps?.class, props.class, isSVG)
  }

  // 2. style
  if (props.style != null && !isSameValue(props.style, prevProps?.style)) {
    hostPatchProp(el, 'style', prevProps?.style, props.style, isSVG)
  }

  // 3. 普通属性（id, name, disabled 等）和事件（onClick 等）
  if (props != null) {
    for (const key in props) {
      if (
        key === 'class' || key === 'style' ||
        isReservedProp(key)  // onVnodeXXX 等内部属性
      ) continue

      if (!prevProps || !isSameValue(props[key], prevProps[key])) {
        hostPatchProp(el, key, prevProps?.[key], props[key], isSVG, vnode)
      }
    }
  }
}
```

**hostPatchProp 内部逻辑：**

```typescript
const hostPatchProp = (
  el, key, prevValue, nextValue,
  isSVG = false, prevVNode = null, vNode = null
) => {
  // 1. 特殊处理：class
  if (key === 'class') {
    el.className = nextValue || ''
  }
  // 2. 特殊处理：style
  else if (key === 'style') {
    if (nextValue == null) {
      el.removeAttribute('style')
    } else {
      setStyle(el, prevValue, nextValue)
    }
  }
  // 3. 特殊处理：事件（onXxx）
  else if (isOn(key)) {
    patchEvent(el, key, prevValue, nextValue)
  }
  // 4. 特殊处理：boolean attribute（disabled, checked 等）
  else if (shouldSetAsElement(el, key, nextValue, isSVG)) {
    // 直接设置 DOM property（如 input.value）
    el[key] = nextValue == null ? '' : nextValue
  }
  // 5. 普通 attribute
  else {
    if (nextValue == null || nextValue === false) {
      el.removeAttribute(key)
    } else {
      el.setAttribute(key, nextValue)
    }
  }
}
```

### 4.4 patchElement()——更新已有元素

```typescript
const patchElement = (
  n1, n2, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized
) => {
  const el = n2.el = n1.el!  // 复用旧 DOM 元素
  const oldProps = n1.props || EMPTY_OBJ
  const newProps = n2.props || EMPTY_OBJ

  // 1. 触发 beforeUpdate 钩子
  const vnodeHook = newProps.onVnodeBeforeUpdate
  if (vnodeHook) {
    invokeVNodeHook(vnodeHook, parentComponent, n2, n1)
  }

  // 2. 更新 props
  if (oldProps !== newProps) {
    patchProps(el, n2, oldProps, newProps, parentComponent, parentSuspense, isSVG)
  }

  // 3. ★ 更新子节点（核心 diff 算法）
  const areChildrenOptimized = optimized || !!n2.dynamicChildren
  if (areChildrenOptimized) {
    // 优化路径：使用 dynamicChildren 数组
    patchBlockChildren(
      n1.dynamicChildren!,
      n2.dynamicChildren!,
      el,
      parentComponent,
      parentSuspense,
      slotScopeIds
    )
  } else {
    // 全量路径：逐个比较子节点
    patchChildren(
      n1, n2, el, null, parentComponent, parentSuspense,
      isSVG, slotScopeIds, optimized
    )
  }

  // 4. 触发 updated 钩子
  queuePostRenderEffect(() => {
    invokeVNodeHook(newProps.onVnodeUpdated!, parentComponent, n2, n1)
  }, parentSuspense)
}
```

**关键洞察：patchElement 的核心是"patchProps + patchChildren"两步。** 而 patchChildren 就是 Vue 3 diff 算法的灵魂。

---

## 五、patchChildren()——子节点 diff 算法（核心！）

这是 Vue 3 最核心的 diff 逻辑。根据新旧子节点的不同类型，有 4 种处理路径：

```typescript
const patchChildren: PatchChildren = (
  n1,        // 旧 vnode
  n2,        // 新 vnode
  container, // 父容器
  anchor,    // 锚点
  parentComponent,
  parentSuspense,
  isSVG,
  slotScopeIds,
  optimized = false
) => {
  const c1 = n1 && n1.children       // 旧子节点
  const prevShapeFlag = n1 ? n1.shapeFlag : 0
  const c2 = n2.children              // 新子节点
  const { patchFlag, shapeFlag } = n2

  // ===== 路径 1: 新子节点是文本 =====
  if (patchFlag > 0) {
    if (patchFlag & PatchFlags.TEXT) {
      // 编译时确定只有文本变化 → 直接设置 textContent
      if (c1 !== c2) {
        hostSetElementText(container, c2 as string)
      }
      return
    }
  }

  // 新子节点是纯文本
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    // 旧子节点是数组 → 全部卸载
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(c1 as VNode[], parentComponent, parentSuspense)
    }
    // 新旧文本不同 → 更新
    if (c1 !== c2) {
      hostSetElementText(container, c2 as string)
    }
    return
  }

  // ===== 路径 2: 新子节点是数组 =====
  if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    // 旧子节点也是数组 → ★ 核心 diff 算法
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      patchKeyedChildren(
        c1 as VNode[],
        c2 as VNode[],
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized
      )
    } else {
      // 旧子节点是文本 → 清空后挂载新数组
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        hostSetElementText(container, '')
      }
      // 挂载新子节点
      mountChildren(
        c2 as VNodeArrayChildren,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized
      )
    }
    return
  }

  // ===== 路径 3: 新子节点为空 =====
  // 旧子节点是数组 → 全部卸载
  if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    unmountChildren(c1 as VNode[], parentComponent, parentSuspense, true)
  }
  // 旧子节点是文本 → 清空
  else if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
    hostSetElementText(container, '')
  }
}
```

**4 种路径总结：**

| 旧子节点 | 新子节点 | 操作 |
|----------|----------|------|
| 数组 | 文本 | 卸载全部旧节点 → 设置文本 |
| 文本 | 文本 | 直接比较 → 更新 |
| 任意 | 数组 | ★ patchKeyedChildren（核心 diff） |
| 任意 | 空 | 卸载全部旧节点 |

---

## 六、patchKeyedChildren()——带 key 的子节点 diff 算法（核心中的核心！）

这是 Vue 3 diff 算法的精华。它使用了**双端比较 + 最长递增子序列**的优化策略。

### 6.1 完整算法（逐行分析）

```typescript
const patchKeyedChildren = (
  c1: VNode[],     // 旧子节点数组
  c2: VNode[],     // 新子节点数组
  container: RendererElement,
  parentAnchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  slotScopeIds: string[] | null,
  optimized: boolean
) => {
  // === 阶段 0: 初始化索引 ===
  let i = 0              // 从头开始的索引
  const l2 = c2.length   // 新数组长度
  let e1 = c1.length - 1 // 旧数组尾部索引
  let e2 = l2 - 1        // 新数组尾部索引

  // === 阶段 1: 从头同步相同节点 ===
  // 跳过开头相同的节点（大部分情况下，列表开头不会变）
  while (i <= e1 && i <= e2) {
    const n1 = c1[i]
    const n2 = c2[i]
    if (isSameVNodeType(n1, n2)) {
      // 类型相同 → patch 更新
      patch(n1, n2, container, null, parentComponent, parentSuspense, isSVG, slotScopeIds)
    } else {
      // 类型不同 → 停止从头同步
      break
    }
    i++
  }

  // === 阶段 2: 从尾同步相同节点 ===
  // 跳过末尾相同的节点（大部分情况下，列表末尾不会变）
  while (i <= e1 && i <= e2) {
    const n1 = c1[e1]
    const n2 = c2[e2]
    if (isSameVNodeType(n1, n2)) {
      patch(n1, n2, container, null, parentComponent, parentSuspense, isSVG, slotScopeIds)
    } else {
      break
    }
    e1--
    e2--
  }

  // === 阶段 3: 处理新增/删除 ===

  // 情况 A: 旧节点全部处理完 → 新增节点
  if (i > e1) {
    // 旧数组遍历完了，新数组还有剩余 → 全部新增
    if (i <= e2) {
      const nextPos = e2 + 1
      const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor
      while (i <= e2) {
        patch(
          null,              // n1 = null（首次挂载）
          c2[i],
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized
        )
        i++
      }
    }
  }
  // 情况 B: 新节点全部处理完 → 删除多余旧节点
  else if (i > e2) {
    while (i <= e1) {
      unmount(c1[i], parentComponent, parentSuspense, true)
      i++
    }
  }

  // === 阶段 4: 乱序子序列 diff（核心！）===
  // 到达这里说明：i <= e1 && i <= e2，说明中间有乱序部分

  // 4a. 建立 key → index 映射表（仅扫描新子数组的乱序部分）
  const s1 = i  // 旧子数组起始索引
  const s2 = i  // 新子数组起始索引

  // keyToNewIndexMap: { key: newIndexInC2 }
  // 例: { 'a': 0, 'b': 1, 'c': 2 }（相对于 s2 的偏移）
  const keyToNewIndexMap: Map<string | symbol | number, number> = new Map()
  for (i = s2; i <= e2; i++) {
    const nextChild = c2[i]
    if (nextChild.key != null) {
      keyToNewIndexMap.set(nextChild.key, i)
    }
  }

  // 4b. 遍历旧子数组的乱序部分，找到可复用的节点并 patch
  let j = 0
  const toBePatched = e2 - s2 + 1  // 需要 patch 的新节点数量
  let patched = 0                  // 已 patch 的数量

  // newIndexToOldIndexMap: 新节点的索引 → 旧节点的索引（0 = 新增）
  const newIndexToOldIndexMap = new Array(toBePatched)
  for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0

  let moved = false         // 是否有节点移动
  let maxNewIndexSoFar = 0  // 用于 LIS 优化

  // 遍历旧子数组的乱序部分
  for (i = s1; i <= e1; i++) {
    const prevChild = c1[i]

    // 如果已 patch 的数量 >= 需要 patch 的数量 → 剩余旧节点全部卸载
    if (patched >= toBePatched) {
      unmount(prevChild, parentComponent, parentSuspense, true)
      continue
    }

    let newIndex: number | undefined

    // 尝试通过 key 查找
    if (prevChild.key != null) {
      newIndex = keyToNewIndexMap.get(prevChild.key)
    } else {
      // 没有 key → 线性扫描（O(n²) 退化情况）
      for (j = s2; j <= e2; j++) {
        if (
          newIndexToOldIndexMap[j - s2] === 0 &&
          isSameVNodeType(prevChild, c2[j])
        ) {
          newIndex = j
          break
        }
      }
    }

    if (newIndex === undefined) {
      // 旧节点在新数组中不存在 → 卸载
      unmount(prevChild, parentComponent, parentSuspense, true)
    } else {
      // 找到对应的新节点 → patch 更新
      newIndexToOldIndexMap[newIndex - s2] = i + 1  // +1 避免与 0（新增）冲突

      // LIS 优化：如果 newIndex 不是递增的，说明有节点移动
      if (newIndex >= maxNewIndexSoFar) {
        maxNewIndexSoFar = newIndex
      } else {
        moved = true
      }

      patch(prevChild, c2[newIndex], container, null, parentComponent,
            parentSuspense, isSVG, slotScopeIds)
      patched++
    }
  }

  // 4c. 移动和挂载（使用最长递增子序列优化）
  if (moved) {
    // ★ 计算最长递增子序列（LIS）
    // 不需要移动的节点 = LIS 中的节点
    const increasingNewIndexSequence = getSequence(newIndexToOldIndexMap)
    let s = increasingNewIndexSequence.length - 1  // LIS 尾部指针

    // 从后向前遍历新子数组的乱序部分
    for (i = toBePatched - 1; i >= 0; i--) {
      const nextIndex = s2 + i
      const nextChild = c2[nextIndex]
      const anchor = nextIndex + 1 < l2 ? c2[nextIndex + 1].el : parentAnchor

      if (newIndexToOldIndexMap[i] === 0) {
        // 新增节点 → 挂载
        patch(null, nextChild, container, anchor, parentComponent,
              parentSuspense, isSVG, slotScopeIds)
      } else if (i !== increasingNewIndexSequence[s]) {
        // 不在 LIS 中 → 需要移动
        hostInsert(nextChild.el!, container, anchor)
      } else {
        // 在 LIS 中 → 不需要移动，移动 LIS 指针
        s--
      }
    }
  } else if (patched < toBePatched) {
    // 没有移动，但有新增节点 → 从后向前挂载
    for (i = toBePatched - 1; i >= 0; i--) {
      const nextIndex = s2 + i
      const nextChild = c2[nextIndex]
      const anchor = nextIndex + 1 < l2 ? c2[nextIndex + 1].el : parentAnchor
      patch(null, nextChild, container, anchor, parentComponent,
            parentSuspense, isSVG, slotScopeIds)
    }
  }
}
```

### 6.2 算法图解

```
旧数组: [A, B, C, D, E]
新数组: [A, C, E, B, D]

步骤 1: 从头同步
  i=0: A === A ✓ → patch
  i=1: B !== C ✗ → 停止
  → i=1, e1=4, e2=4

步骤 2: 从尾同步
  e1=4, e2=4: E !== D ✗ → 停止
  → i=1, e1=4, e2=4

步骤 3: 都不满足（i<=e1 且 i<=e2），进入阶段 4

步骤 4a: 建立 keyToNewIndexMap
  { C: 2, E: 3, B: 1, D: 4 }  （相对于 s2=1 的绝对索引）

步骤 4b: 遍历旧子数组 [B, C, D, E]
  B: newIndex=1 → newIndexToOldIndexMap[0] = 2 (B在旧数组索引1)
  C: newIndex=2 → newIndexToOldIndexMap[1] = 3 (C在旧数组索引2)
  D: newIndex=4 → newIndexToOldIndexMap[3] = 5 (D在旧数组索引4)
  E: newIndex=3 → newIndexToOldIndexMap[2] = 4 (E在旧数组索引3)

  newIndexToOldIndexMap = [2, 3, 5, 4]
  → 不是递增的 → moved = true

步骤 4c: LIS 优化
  LIS([2, 3, 5, 4]) = [2, 3, 4]  → 索引 0, 1, 3 不需要移动
  → 只有索引 2（对应 E）需要移动

  最终操作:
  - B: 不需要移动（在 LIS 中）
  - C: 不需要移动（在 LIS 中）
  - E: 需要移动（不在 LIS 中）
  - D: 不需要移动（在 LIS 中）
```

### 6.3 最长递增子序列（LIS）算法

```typescript
// 经典的 patience sorting 算法，O(n log n)
function getSequence(arr: number[]): number[] {
  const p = arr.slice()          // 前驱数组
  const result = [0]             // LIS 结果（存储索引）
  let i, j, u, v, c
  const len = arr.length

  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      // result[0] 是当前 LIS 的最后一个元素的值
      // 如果 arrI > result 最后一个 → 直接追加
      if (arr[result[result.length - 1]] < arrI) {
        p[result[result.length - 1]] = i  // 记录前驱
        result.push(i)
        continue
      }

      // 否则在 result 中二分查找替换位置
      u = 0
      v = result.length - 1
      while (u < v) {
        c = ((u + v) / 2) | 0  // 中点
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }

      // 替换
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[result[u - 1]] = i  // 记录前驱
        }
        result[u] = i
      }
    }
  }

  // 回溯构建 LIS 索引序列
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }

  return result
}
```

**LIS 在 diff 中的作用：**
- LIS 中的节点 = 顺序正确的节点 = 不需要移动
- 非 LIS 节点 = 需要移动
- 最小化 DOM 操作次数

---

## 七、patchBlockChildren()——Block Tree 优化路径

这是 Vue 3.2+ 引入的优化，利用编译时生成的 `dynamicChildren` 数组跳过静态子节点。

```typescript
const patchBlockChildren: PatchBlockChildrenFn = (
  oldChildren,      // 旧 dynamicChildren 数组
  newChildren,      // 新 dynamicChildren 数组
  fallbackContainer,
  parentComponent,
  parentSuspense,
  isSVG,
  slotScopeIds
) => {
  for (let i = 0; i < newChildren.length; i++) {
    const oldVNode = oldChildren[i]
    const newVNode = newChildren[i]

    // 只 patch dynamicChildren 中的节点（跳过静态节点）
    const container =
      oldVNode.el &&
      (oldVNode.type === Fragment ||
       !isSameVNodeType(oldVNode, newVNode) ||
       oldVNode.shapeFlag & ShapeFlags.COMPONENT ||
       oldVNode.shapeFlag & ShapeFlags.TELEPORT)
        ? fallbackContainer  // 需要 fallback 到全容器
        : hostParent(oldVNode.el!)  // 复用父容器

    patch(
      oldVNode,
      newVNode,
      container,
      null,
      parentComponent,
      parentSuspense,
      isSVG,
      slotScopeIds,
      true  // optimized = true
    )
  }
}
```

**关键洞察：Block Tree 的核心思想是"编译时标记动态节点，运行时只 diff 动态节点"。**

```html
<!-- 模板 -->
<div>
  <h1>静态标题</h1>
  <p>{{ dynamicText }}</p>
  <span :class="cls">静态文本</span>
</div>

<!-- 编译后 -->
const _hoisted_1 = createVNode("h1", null, "静态标题", -1)
const _hoisted_2 = createVNode("span", { class: cls }, "静态文本", 2 /* CLASS */)

return (openBlock(), createBlock("div", null, [
  _hoisted_1,  // 静态 → 不在 dynamicChildren 中
  createVNode("p", null, toDisplayString(dynamicText), 1 /* TEXT */),
  _hoisted_2
], 64 /* STABLE_FRAGMENT */))

// dynamicChildren = [p vnode, span vnode]  // 只有动态节点！
// h1 被 hoistStatic 提升到编译时，运行时不参与 diff
```

---

## 八、patchProps()——属性级 diff

```typescript
const patchProps = (
  el: Element,
  vnode: VNode,
  oldProps: Data,
  newProps: Data,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean
) => {
  if (oldProps === newProps) return  // 同一引用 → 跳过

  // 1. 遍历新属性 → 设置/更新
  for (const key in newProps) {
    if (isReservedProp(key)) continue  // 跳过内部属性

    const next = newProps[key]
    const prev = oldProps[key]

    if (next !== prev) {
      hostPatchProp(
        el, key, prev, next, isSVG,
        vnode as VNode<Node, Element>
      )
    }
  }

  // 2. 遍历旧属性 → 删除已移除的属性
  if (oldProps !== EMPTY_OBJ) {
    for (const key in oldProps) {
      if (isReservedProp(key)) continue
      if (!(key in newProps)) {
        hostPatchProp(el, key, oldProps[key], null, isSVG, vnode as VNode)
      }
    }
  }
}
```

**关键洞察：patchProps 是 O(n+m) 的，其中 n 是新属性数量，m 是旧属性数量。** 如果 PatchFlag 标记了具体的动态属性，可以进一步优化为只比较标记的属性。

---

## 九、事件处理——patchEvent

```typescript
const patchEvent = (
  el: Element & { _vei?: Record<string, Invoker | undefined> },
  rawName: string,  // 如 "onClick"
  prevValue: EventValue | null,
  nextValue: EventValue | null
) => {
  // vei = Vue Event Invoker
  const invoker = el._vei && el._vei[rawName]

  if (nextValue && invoker) {
    // 事件已绑定 → 更新 handler
    invoker.value = nextValue
  } else if (nextValue) {
    // 新事件 → 创建 invoker
    const eventName = rawName.slice(2).toLowerCase()  // "onClick" → "click"
    const invoker = createInvoker(nextValue)
    el.addEventListener(eventName, invoker)
    el._vei![rawName] = invoker
  } else if (invoker) {
    // 移除事件
    el.removeEventListener(eventName, invoker)
    el._vei![rawName] = undefined
  }
}

// Invoker 是一个包装器，支持事件处理器动态更新
const createInvoker = (initialValue: EventValue) => {
  const invoker: Invoker = (e: Event) => {
    // 支持单个 handler 或数组
    if (isArray(invoker.value)) {
      invoker.value.forEach(fn => callWithAsyncErrorHandling(fn, ...))
    } else {
      callWithAsyncErrorHandling(invoker.value, ...)
    }
  }
  invoker.value = initialValue
  return invoker
}
```

**关键洞察：Vue 的事件系统使用"事件委托 + Invoker 模式"。** 所有事件都绑定在元素上，但 handler 存储在 Invoker 对象中。更新事件时只需修改 Invoker.value，不需要重新 addEventListener/removeEventListener。

---

## 十、性能优化策略总结

### 10.1 编译时优化

| 优化 | 原理 | 效果 |
|------|------|------|
| hoistStatic | 静态节点提升到 render 函数外部 | 跳过静态节点 diff |
| patchFlag | 编译时标记动态属性类型 | 精准 patch，跳过静态属性 |
| Block Tree | dynamicChildren 只包含动态子节点 | 跳过静态子节点 diff |
| cacheHandlers | 缓存事件 handler | 避免重复创建函数 |

### 10.2 运行时优化

| 优化 | 原理 | 效果 |
|------|------|------|
| 双端比较 | 从头+从尾同步相同节点 | O(n) 处理大部分场景 |
| LIS | 最小化 DOM 移动 | 减少 reflow/repaint |
| key 机制 | 精准追踪节点身份 | 避免错误的状态复用 |
| Invoker | 事件 handler 动态更新 | 避免重复绑定/解绑 |

### 10.3 与 React Diff 的对比

| 特性 | Vue 3 | React 18 |
|------|-------|----------|
| 编译时优化 | ✅ PatchFlag + Block Tree | ❌ 纯运行时 |
| 双端比较 | ✅ | ❌ 仅从头比较 |
| LIS 优化 | ✅ | ❌ |
| 静态提升 | ✅ hoistStatic | ❌ |
| 事件委托 | ✅ Invoker 模式 | ✅ 事件池 |
| 时间复杂度 | O(n) 大部分情况 | O(n) 但常数更大 |

**关键洞察：Vue 3 的 diff 算法比 React 的更高效，因为 Vue 3 利用了编译时信息。** React 是纯运行时 diff，无法提前知道哪些节点是静态的。Vue 3 的编译器在编译阶段就标记了所有动态/静态信息，运行时可以直接利用。

---

## 十一、实战：手写一个简化版 Vue 3 Diff

```typescript
// 简化版 diff 实现（教学用）
function simpleDiff(oldChildren: VNode[], newChildren: VNode[], container: Element) {
  // 1. 从头同步
  let i = 0
  while (i < oldChildren.length && i < newChildren.length) {
    const old = oldChildren[i]
    const newV = newChildren[i]
    if (old.key === newV.key && old.type === newV.type) {
      // 相同节点 → 更新
      updateElement(old, newV)
      i++
    } else break
  }

  // 2. 从尾同步
  let e1 = oldChildren.length - 1
  let e2 = newChildren.length - 1
  while (e1 >= i && e2 >= i) {
    const old = oldChildren[e1]
    const newV = newChildren[e2]
    if (old.key === newV.key && old.type === newV.type) {
      updateElement(old, newV)
      e1--
      e2--
    } else break
  }

  // 3. 新增
  if (i > e1 && i <= e2) {
    while (i <= e2) {
      mountElement(newChildren[i], container)
      i++
    }
  }
  // 4. 删除
  else if (i > e2 && i <= e1) {
    while (i <= e1) {
      unmountElement(oldChildren[i], container)
      i++
    }
  }
  // 5. 乱序（简化版：不使用 LIS）
  else {
    const keyMap = new Map()
    for (let j = i; j <= e2; j++) {
      keyMap.set(newChildren[j].key, j)
    }

    for (let j = i; j <= e1; j++) {
      const old = oldChildren[j]
      const newIndex = keyMap.get(old.key)
      if (newIndex === undefined) {
        unmountElement(old, container)
      } else {
        updateElement(old, newChildren[newIndex])
      }
    }

    // 挂载新增
    for (let j = i; j <= e2; j++) {
      if (!oldChildren.some(c => c.key === newChildren[j].key)) {
        mountElement(newChildren[j], container)
      }
    }
  }
}
```

---

## 十二、核心知识点速查

### 12.1 VNode 关键属性

| 属性 | 作用 |
|------|------|
| `type` | 节点类型（标签名/组件/Fragment） |
| `key` | 节点身份标识（diff 核心） |
| `shapeFlag` | 位标记（快速判断节点类型） |
| `patchFlag` | 编译时标记（优化 patch 范围） |
| `dynamicChildren` | 动态子节点数组（Block Tree） |
| `el` | 对应的真实 DOM 节点 |
| `anchor` | 插入锚点（Fragment 场景） |

### 12.2 patch 流程

```
patch()
  ├── processText()      — 文本节点
  ├── processComment()   — 注释节点
  ├── processStatic()    — 静态节点
  ├── processFragment()  — Fragment（一组节点）
  ├── processElement()   — 元素节点
  │   ├── mountElement() — 首次挂载
  │   └── patchElement() — 更新
  │       ├── patchProps() — 属性 diff
  │       └── patchChildren() — 子节点 diff
  │           └── patchKeyedChildren() — ★ 核心 diff 算法
  └── processComponent() — 组件
```

### 12.3 diff 算法 4 阶段

```
阶段 1: 从头同步相同节点（O(k), k = 开头相同节点数）
阶段 2: 从尾同步相同节点（O(m), m = 末尾相同节点数）
阶段 3: 新增/删除（O(n)）
阶段 4: 乱序 diff（O(n log n), 含 LIS 优化）
```

### 12.4 关键优化

1. **PatchFlag** — 编译时标记动态属性，运行时精准 patch
2. **Block Tree** — dynamicChildren 只包含动态子节点
3. **hoistStatic** — 静态节点提升到 render 函数外部
4. **双端比较** — 从头+从尾同步，覆盖大部分场景
5. **LIS** — 最小化 DOM 移动次数
6. **Invoker** — 事件 handler 动态更新，避免重复绑定

---

## 十三、总结

Vue 3 的 patch 算法是**编译时优化 + 运行时高效 diff** 的典范：

1. **编译时**：编译器分析模板，标记 PatchFlag、生成 Block Tree、提升静态节点
2. **运行时**：patch() 根据 vnode 类型分发，patchKeyedChildren() 执行高效 diff
3. **核心算法**：双端比较 + LIS 优化，大部分场景 O(n)，最坏 O(n log n)
4. **性能优势**：比 React 纯运行时 diff 更高效，因为利用了编译时信息

**关键设计哲学：** "能编译时解决的，不在运行时解决"。这是 Vue 3 比 React 在 diff 性能上更优的根本原因。

---

*精读完成于 2026-05-05 04:00 AM*
*下次精读方向：Vue 3 Scheduler 调度系统与 React Concurrent Mode 对比*
