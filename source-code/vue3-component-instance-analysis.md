# Vue 3 源码精读 — Component Instance 组件实例系统

**日期**: 2026-05-04 04:00
**源码文件**: `packages/runtime-core/src/component.ts` (~1000 行)
**前置知识**: Vue 3 响应式系统 (Proxy + track/trigger + Link 链表) + Scheduler 调度器

---

## 一、为什么读 component.ts？

在 Vue 3 源码体系中，`component.ts` 是 **连接响应式系统与渲染系统的桥梁**：

```
响应式系统 (@vue/reactivity)
         ↓ trigger → effect.scheduler
component.ts (组件实例 + setup + render 函数生成)
         ↓ subTree vnode
renderer.ts (vnode → DOM patch)
         ↓ Scheduler (批量更新 + 三队列)
```

之前已精读：

1. ✅ Vue 3 响应式系统 (reactive/effect/ref/dep)
2. ✅ Vue 3 Scheduler (三队列 + 微任务调度)
3. ✅ React Fiber / Hooks / Diff

**本次聚焦**: `ComponentInternalInstance` 数据结构 + `setupComponent` 完整流程 + `currentInstance` 栈管理 + `expose` 机制

---

## 二、核心数据结构 — ComponentInternalInstance

这是 Vue 3 组件的 **内部心脏**，每个组件实例都有唯一对应的 `ComponentInternalInstance`。

### 2.1 逐行拆解关键字段

```typescript
export interface ComponentInternalInstance {
  // === 身份标识 ===
  uid: number; // 全局递增 ID (let uid = 0, uid++)
  type: ConcreteComponent; // 组件定义对象 (Options API 对象 或 setup 函数)
  parent: ComponentInternalInstance | null; // 父组件实例 (树形结构)
  root: ComponentInternalInstance; // 根组件实例 (用于 provide/inject 向上查找)
  appContext: AppContext; // 应用级上下文 (全局组件/指令/配置)

  // === VNode 关系 ===
  vnode: VNode; // 父组件 vnode 树中代表自己的节点
  next: VNode | null; // 更新时：父组件传来的新 vnode (双缓冲)
  subTree: VNode; // 自己的 render 函数返回的 vnode 子树

  // === 响应式联动 (核心!) ===
  effect: ReactiveEffect; // ReactiveEffect 实例 (连接 @vue/reactivity)
  update: () => void; // 强制更新函数 (effect.run 的包装)
  job: SchedulerJob; // 调度器任务 (传给 scheduler 的 SchedulerJob)

  // === 渲染 ===
  render: InternalRenderFunction | null; // 渲染函数 (setup 返回 或 template 编译)
  ssrRender?: Function | null; // SSR 渲染函数

  // === provide/inject ===
  provides: Data; // 提供的数据 (原型链继承 parent.provides)

  // === EffectScope (自动清理) ===
  scope: EffectScope; // 响应式作用域 (组件卸载时自动 stop 所有 effect)

  // === 代理系统 ===
  proxy: ComponentPublicInstance | null; // 公开代理 (this 指向的对象)
  exposed: Record<string, any> | null; // expose() 暴露的属性
  exposeProxy: Record<string, any> | null; // 暴露属性的代理
  withProxy: ComponentPublicInstance | null; // runtime-compiled render 用的 withProxy
  ctx: Data; // 代理目标对象 (props/data/computed/methods 都挂这里)

  // === 状态 ===
  data: Data; // data() 返回的响应式对象
  props: Data; // 归一化的 props
  attrs: Data; // 未声明的 attrs (透传)
  slots: InternalSlots; // 插槽
  refs: Data; // template refs
  setupState: Data; // setup() 返回的响应式包装对象 (proxyRefs)
  setupContext: SetupContext | null; // setup 的第二个参数 { attrs, slots, emit, expose }

  // === 生命周期钩子 (缩写) ===
  isMounted: boolean; // 是否已挂载
  isUnmounted: boolean; // 是否已卸载
  bc: null; // beforeCreate
  c: null; // created
  bm: null; // beforeMount
  m: null; // mounted
  bu: null; // beforeUpdate
  u: null; // updated
  um: null; // beforeUnmount
  bum: null; // unmounted
  // ... 更多钩子
}
```

### 2.2 关键字段关系图

```
                    ComponentInternalInstance
                    ┌─────────────────────┐
                    │  uid: 42            │
                    │  type: MyComponent  │
                    │  parent: ─────────────→ Parent Instance
                    │  root: ───────────────→ Root Instance
                    └──────┬──────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
         │  vnode   │ │  proxy  │ │  effect │
         │ (我在父树 │ │ (this)  │ │ (响应式 │
         │  中的节点)│ │ Proxy   │ │  联动)  │
         └────┬────┘ └────┬────┘ └────┬────┘
              │            │            │
         ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
         │ subTree │ │  ctx    │ │  update │
         │ (我的   │ │ (代理   │ │ (更新   │
         │  vnode  │ │  目标)  │ │  函数)  │
         │  子树)  │ └────┬────┘ └────┬────┘
         └────┬────┘      │           │
              │      ┌────┼────┐      │
         ┌────▼────┐ │    │    │ │ ┌───▼───┐
         │renderer │ │props│data│ │job ──→ Scheduler
         │patches  │ │setup│refs│ │ (三队列)
         │DOM here │ │state│... │ └───────┘
         └─────────┘ └─────┘    └──────────┘
```

---

## 三、实例创建 — createComponentInstance

```typescript
let uid = 0; // 全局自增计数器

export function createComponentInstance(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
  suspense: SuspenseBoundary | null,
): ComponentInternalInstance {
  const type = vnode.type as ConcreteComponent;

  // 继承父组件的 appContext，或从根 vnode 获取
  const appContext =
    (parent ? parent.appContext : vnode.appContext) || emptyAppContext;

  const instance: ComponentInternalInstance = {
    uid: uid++, // 全局唯一 ID
    vnode, // 关联的 vnode
    type, // 组件定义
    parent, // 父实例
    appContext, // 应用上下文
    root: null!, // 稍后设置
    next: null, // 更新时的新 vnode
    subTree: null!, // 稍后设置
    effect: null!, // 稍后设置
    update: null!, // 稍后设置
    job: null!, // 稍后设置

    // 🎯 EffectScope: detached=true 表示独立作用域，不受外部 scope 影响
    scope: new EffectScope(true /* detached */),

    render: null, // 稍后由 setup/compile 设置
    proxy: null, // 稍后由 setupStatefulComponent 设置
    exposed: null,
    exposeProxy: null,
    withProxy: null,

    // 🎯 provide/inject 核心：原型链继承
    // 子组件的 provides 继承自父组件的 provides (原型链查找)
    provides: parent ? parent.provides : Object.create(appContext.provides),

    // useId 追踪
    ids: parent ? parent.ids : ["", 0, 0],

    accessCache: null!, // 属性访问缓存 (避免 hasOwnProperty 调用)
    renderCache: [], // 渲染缓存 (内联处理器等)

    // 局部注册的组件/指令
    components: null,
    directives: null,

    // 归一化的 props/emits 选项 (预处理 Component 的 props/emits 定义)
    propsOptions: normalizePropsOptions(type, appContext),
    emitsOptions: normalizeEmitsOptions(type, appContext),

    emit: null!, // 稍后 bind
    emitted: null, // .once 事件追踪
    propsDefaults: EMPTY_OBJ, // props 默认值缓存
    inheritAttrs: type.inheritAttrs,

    // 状态 (初始为空对象)
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,
    setupState: EMPTY_OBJ,
    setupContext: null,

    // Suspense
    suspense,
    suspenseId: suspense ? suspense.pendingId : 0,
    asyncDep: null,
    asyncResolved: false,

    // 生命周期钩子 (全部初始为 null)
    isMounted: false,
    isUnmounted: false,
    isDeactivated: false,
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null,
    sp: null,
  };

  // ctx 是代理目标对象
  if (__DEV__) {
    instance.ctx = createDevRenderContext(instance);
  } else {
    instance.ctx = { _: instance }; // _ 指向 instance 自身 (内部访问)
  }

  // root 指向自己或父组件的 root
  instance.root = parent ? parent.root : instance;

  // bind emit: emit(instance, eventName, ...args)
  instance.emit = emit.bind(null, instance);

  // Custom Element 特殊处理
  if (vnode.ce) {
    vnode.ce(instance);
  }

  return instance;
}
```

### 3.1 关键设计模式

| 设计                 | 源码体现                                                                  | 目的                               |
| -------------------- | ------------------------------------------------------------------------- | ---------------------------------- |
| **原型链继承**       | `provides: parent ? parent.provides : Object.create(appContext.provides)` | provide/inject 向上查找            |
| **空对象共享**       | `ctx: EMPTY_OBJ, data: EMPTY_OBJ` 等                                      | 避免每个实例创建空对象，节省内存   |
| **延迟初始化**       | `root: null!`, `subTree: null!`                                           | 创建时无法确定，稍后同步设置       |
| **EffectScope 隔离** | `new EffectScope(true)`                                                   | 组件卸载时一键清理所有响应式副作用 |

---

## 四、currentInstance 栈管理

这是 Vue 3 实现 `getCurrentInstance()` 和 Composition API 的核心机制。

### 4.1 currentInstance 是什么？

```typescript
export let currentInstance: ComponentInternalInstance | null = null;

export const getCurrentInstance: () => ComponentInternalInstance | null = () =>
  currentInstance || currentRenderingInstance;
```

**`currentInstance` 是一个全局变量**，指向当前正在执行 setup 的组件实例。

**为什么需要它？**

- `ref()` / `reactive()` / `computed()` / `watch()` 等 Composition API 需要知道当前属于哪个组件
- 这样组件卸载时才能自动清理这些 effect

### 4.2 setCurrentInstance — 栈式切换

```typescript
export const setCurrentInstance = (instance: ComponentInternalInstance) => {
  const prev = currentInstance; // 保存上一个实例
  internalSetCurrentInstance(instance); // 设置为当前实例
  instance.scope.on(); // 🎯 开启 EffectScope 追踪
  return (): void => {
    // 返回恢复函数
    instance.scope.off(); // 关闭 EffectScope 追踪
    internalSetCurrentInstance(prev); // 恢复上一个实例
  };
};
```

### 4.3 执行流程模拟

```
App 组件 setup 开始
  ├─ setCurrentInstance(appInstance)
  │   ├─ prev = null
  │   ├─ currentInstance = appInstance
  │   └─ appInstance.scope.on()  // 追踪后续 ref/computed/watch
  │
  ├─ const count = ref(0)        // ← ref() 内部: 如果 currentInstance 存在，注册到 scope
  ├─ const doubled = computed(...) // ← computed() 内部: 注册到 scope
  ├─ watch(count, ...)           // ← watch() 内部: 注册到 scope
  │
  ├─ 渲染子组件 <Child />
  │   ├─ 子组件 setup 开始
  │   │   ├─ setCurrentInstance(childInstance)
  │   │   │   ├─ prev = appInstance  ← 保存父实例!
  │   │   │   ├─ currentInstance = childInstance
  │   │   │   └─ childInstance.scope.on()
  │   │   │
  │   │   ├─ const name = ref('child')  // ← 注册到 childInstance.scope
  │   │   │
  │   │   ├─ reset()  // 恢复函数被调用
  │   │   │   ├─ childInstance.scope.off()
  │   │   │   └─ currentInstance = appInstance  ← 恢复父实例!
  │   │
  │   └─ 子组件渲染完成
  │
  ├─ reset()  // 恢复函数被调用
  │   ├─ appInstance.scope.off()
  │   └─ currentInstance = null
  │
  └─ App 组件渲染完成
```

### 4.4 SSR 多副本兼容

```typescript
if (__SSR__) {
  // SSR 环境下可能有多个 Vue 副本 (runtime + server-renderer)
  // 使用全局注册器确保所有副本的 currentInstance 同步
  const registerGlobalSetter = (key: string, setter: Setter) => {
    let setters: Setter[];
    if (!(setters = g[key])) setters = g[key] = [];
    setters.push(setter);
    return (v: any) => {
      if (setters.length > 1)
        setters.forEach((set) => set(v)); // 通知所有副本
      else setters[0](v);
    };
  };
  internalSetCurrentInstance = registerGlobalSetter(
    `__VUE_INSTANCE_SETTERS__`,
    (v) => (currentInstance = v),
  );
}
```

**设计亮点**: 通过 `g['__VUE_INSTANCE_SETTERS__']` 数组，解决 CDN 加载多个 Vue 副本时的状态同步问题。

---

## 五、setupComponent — 组件设置入口

```typescript
export function setupComponent(
  instance: ComponentInternalInstance,
  isSSR = false,
  optimized = false,
): Promise<void> | undefined {
  isSSR && setInSSRSetupState(isSSR);

  const { props, children } = instance.vnode;
  const isStateful = isStatefulComponent(instance);

  // 1. 初始化 props
  initProps(instance, props, isStateful, isSSR);

  // 2. 初始化 slots
  initSlots(instance, children, optimized || isSSR);

  // 3. 有状态组件 → 调用 setupStatefulComponent
  const setupResult = isStateful
    ? setupStatefulComponent(instance, isSSR)
    : undefined; // 函数式组件无 setup

  isSSR && setInSSRSetupState(false);
  return setupResult;
}
```

**调用时机**: `mountComponent` → `setupComponent(instance)` → 然后 `setupRenderEffect`

---

## 六、setupStatefulComponent — setup() 执行核心

这是整个 `component.ts` 最核心的函数。

```typescript
function setupStatefulComponent(
  instance: ComponentInternalInstance,
  isSSR: boolean,
) {
  const Component = instance.type as ComponentOptions

  // === DEV 校验 (生产环境跳过) ===
  if (__DEV__) {
    if (Component.name) validateComponentName(Component.name, ...)
    if (Component.components) { /* 校验子组件名 */ }
    if (Component.directives) { /* 校验指令名 */ }
  }

  // === 0. 创建属性访问缓存 ===
  instance.accessCache = Object.create(null)

  // === 1. 创建公开代理 (this 指向的对象) ===
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers)
  // PublicInstanceProxyHandlers 定义了 has/get/set 行为:
  // - props > setupState > data > props > ctx (优先级链)
  // - 拦截 $xxx 属性 (如 $emit, $refs, $el)

  if (__DEV__) exposePropsOnRenderContext(instance)

  // === 2. 调用 setup() ===
  const { setup } = Component

  if (setup) {
    // 🎯 暂停依赖收集 — setup 执行期间不触发 effect
    pauseTracking()

    // 创建 setupContext (只有 setup.length > 1 时才创建，即需要第二个参数)
    const setupContext = (instance.setupContext =
      setup.length > 1 ? createSetupContext(instance) : null)

    // 🎯 设置当前实例 (栈式)
    const reset = setCurrentInstance(instance)

    // 调用 setup(props, context)
    const setupResult = callWithErrorHandling(
      setup,
      instance,
      ErrorCodes.SETUP_FUNCTION,
      [
        __DEV__ ? shallowReadonly(instance.props) : instance.props,  // props (开发环境只读)
        setupContext,  // { attrs, slots, emit, expose }
      ],
    )

    const isAsyncSetup = isPromise(setupResult)  // 检测 async setup

    // 🎯 恢复依赖收集 + 恢复 currentInstance
    resetTracking()
    reset()  // ← 恢复父实例或 null

    // async setup / Suspense 标记
    if ((isAsyncSetup || instance.sp) && !isAsyncWrapper(instance)) {
      markAsyncBoundary(instance)
    }

    if (isAsyncSetup) {
      // === 异步 setup 处理 ===
      setupResult.then(unsetCurrentInstance, unsetCurrentInstance)

      if (isSSR) {
        // SSR: 返回 Promise 让 server-renderer 等待
        return setupResult.then(resolved => {
          handleSetupResult(instance, resolved, isSSR)
        }).catch(e => {
          handleError(e, instance, ErrorCodes.SETUP_FUNCTION)
        })
      } else if (__FEATURE_SUSPENSE__) {
        // CSR + Suspense: 保存 asyncDep，等待 Suspense resolve
        instance.asyncDep = setupResult
        // 等待 Suspense 重新触发 setup
      }
    } else {
      // === 同步 setup — 处理返回值 ===
      handleSetupResult(instance, setupResult, isSSR)
    }
  } else {
    // 无 setup → 直接进入 Options API 流程
    finishComponentSetup(instance, isSSR)
  }
}
```

### 6.1 逐行关键分析

| 行                                | 代码             | 为什么重要                                                   |
| --------------------------------- | ---------------- | ------------------------------------------------------------ |
| `pauseTracking()`                 | 暂停 effect 追踪 | setup 中的 `ref()` 等不应立即触发 effect，只在 render 时追踪 |
| `setup.length > 1`                | 检查参数数量     | 如果 setup 只接收 props，不创建 context 对象 (性能优化)      |
| `setCurrentInstance(instance)`    | 压栈             | 让 Composition API 知道当前组件                              |
| `shallowReadonly(instance.props)` | 浅只读           | 开发环境防止直接修改 props                                   |
| `callWithErrorHandling`           | 错误包裹         | setup 错误统一处理 (errorCaptured 钩子)                      |
| `reset()`                         | 弹栈             | 恢复父实例，保证嵌套组件正确性                               |
| `resetTracking()`                 | 恢复追踪         | setup 完成后恢复依赖收集                                     |

### 6.2 setup.length > 1 的性能优化

```typescript
// 场景 1: setup(props) — 不需要 context
const setup1 = (props) => { ... }
setup1.length // = 1 → 不创建 setupContext 对象

// 场景 2: setup(props, { emit }) — 需要 context
const setup2 = (props, { emit }) => { ... }
setup2.length // = 2 → 创建 setupContext

// Vue 源码中的优化:
const setupContext = setup.length > 1 ? createSetupContext(instance) : null
// 避免不必要的对象创建和 Proxy 包装
```

---

## 七、handleSetupResult — setup 返回值处理

```typescript
export function handleSetupResult(
  instance: ComponentInternalInstance,
  setupResult: unknown,
  isSSR: boolean,
): void {
  if (isFunction(setupResult)) {
    // === 情况 1: setup 返回渲染函数 ===
    // 常见于手写 render 函数或 <script setup> 编译结果
    instance.render = setupResult as InternalRenderFunction;
  } else if (isObject(setupResult)) {
    // === 情况 2: setup 返回绑定对象 ===
    // 最常见: return { count, doubled, increment }

    // 🎯 proxyRefs: 自动解包 ref
    // setupState.count 等价于 setupResult.count.value (如果 count 是 ref)
    instance.setupState = proxyRefs(setupResult);

    if (__DEV__) {
      exposeSetupStateOnRenderContext(instance);
      instance.devtoolsRawSetupState = setupResult; // DevTools 调试
    }
  } else if (__DEV__ && setupResult !== undefined) {
    warn(`setup() should return an object...`);
  }

  // 继续后续设置 (template 编译 / Options API)
  finishComponentSetup(instance, isSSR);
}
```

### 7.1 proxyRefs — 自动解包机制

```typescript
// proxyRefs 源码 (来自 @vue/reactivity)
export function proxyRefs<T extends object>(
  objectWithRefs: T,
): ShallowUnwrapRef<T> {
  return isReactive(objectWithRefs)
    ? objectWithRefs
    : new Proxy(objectWithRefs, proxyRefsHandler);
}

const proxyRefsHandler: ProxyHandler<any> = {
  get(target, key, receiver) {
    // 如果是 ref，返回 .value；否则直接返回值
    return isRef(target[key]) ? target[key].value : target[key];
  },
  set(target, key, value, receiver) {
    const existing = target[key];
    if (isRef(existing) && !isRef(value)) {
      // 如果目标是 ref，设置 .value
      existing.value = value;
      return true;
    }
    return Reflect.set(target, key, value, receiver);
  },
};
```

**实际效果**:

```typescript
// setup 中:
const count = ref(0);
return { count };

// 模板中: {{ count }}  ← 自动解包为 count.value
// setupState.count   ← 自动解包为 0
// setupState.count = 5  ← 自动设置 count.value = 5
```

---

## 八、finishComponentSetup — 完成组件设置

```typescript
export function finishComponentSetup(
  instance: ComponentInternalInstance,
  isSSR: boolean,
  skipOptions?: boolean,
): void {
  const Component = instance.type as ComponentOptions

  // === template / render 函数归一化 ===
  if (!instance.render) {
    // 运行时编译: template → render 函数
    if (!isSSR && compile && !Component.render) {
      const template = Component.template || ...

      if (template) {
        // 调用 compile 函数 (由 runtime-dom 注册)
        Component.render = compile(template, finalCompilerOptions)
      }
    }

    // 设置 render 函数 (默认为 NOOP)
    instance.render = (Component.render || NOOP) as InternalRenderFunction

    // runtime-compiled render 的 withProxy
    if (installWithProxy) {
      installWithProxy(instance)
    }
  }

  // === Options API 兼容 ===
  if (__FEATURE_OPTIONS_API__ && !skipOptions) {
    const reset = setCurrentInstance(instance)
    pauseTracking()
    try {
      applyOptions(instance)  // 处理 data/computed/methods/watch/lifecycle
    } finally {
      resetTracking()
      reset()
    }
  }

  // DEV 警告: 缺少 template/render
  if (__DEV__ && !Component.render && instance.render === NOOP && !isSSR) {
    warn(`Component is missing template or render function: `, Component)
  }
}
```

### 8.1 render 函数的来源优先级

```
1. setup() 返回函数       → instance.render = setupResult (最高优先级)
2. Component.render       → 手写 render 函数
3. compile(Component.template) → 运行时编译 template
4. NOOP                   → 空函数 (开发环境警告)
```

### 8.2 applyOptions — Options API 桥接

当使用 Options API 时，`applyOptions` 将 `data`/`computed`/`methods`/`watch` 等选项转换为响应式状态：

```typescript
// applyOptions 内部流程 (简化):
function applyOptions(instance) {
  const options = instance.type;

  // data() → reactive(data()) → instance.data
  if (options.data) {
    const data = options.data.call(publicThis);
    instance.data = reactive(data);
  }

  // computed → effect computed → 挂载到 ctx
  if (options.computed) {
    for (const key in options.computed) {
      const getter = options.computed[key];
      const e = computed(getter.bind(publicThis));
      Object.defineProperty(ctx, key, {
        get: () => e.value,
        enumerable: true,
        configurable: true,
      });
    }
  }

  // methods → 绑定 this
  if (options.methods) {
    for (const key in options.methods) {
      ctx[key] = options.methods[key].bind(publicThis);
    }
  }

  // watch → 创建 watcher
  // lifecycle hooks → 注册到 instance.xxx 数组
}
```

---

## 九、createSetupContext — setup 第二个参数

```typescript
export function createSetupContext(
  instance: ComponentInternalInstance,
): SetupContext {
  // expose 函数: 控制向父组件暴露什么
  const expose: SetupContext["expose"] = (exposed) => {
    instance.exposed = exposed || {};
  };

  if (__DEV__) {
    // 开发环境: 使用 getter 延迟创建 Proxy (避免 test-utils 覆盖)
    let attrsProxy: Attrs;
    let slotsProxy: Slots;
    return Object.freeze({
      get attrs() {
        return (
          attrsProxy ||
          (attrsProxy = new Proxy(instance.attrs, attrsProxyHandlers))
        );
      },
      get slots() {
        return slotsProxy || (slotsProxy = getSlotsProxy(instance));
      },
      get emit() {
        return (event: string, ...args: any[]) => instance.emit(event, ...args);
      },
      expose,
    });
  } else {
    // 生产环境: 直接创建
    return {
      attrs: new Proxy(instance.attrs, attrsProxyHandlers) as Attrs,
      slots: instance.slots,
      emit: instance.emit,
      expose,
    };
  }
}
```

### 9.1 attrsProxyHandlers — attrs 的响应式追踪

```typescript
const attrsProxyHandlers = __DEV__
  ? {
      get(target: Data, key: string) {
        markAttrsAccessed(); // 标记 attrs 被访问
        track(target, TrackOpTypes.GET, ""); // 依赖收集
        return target[key];
      },
      set() {
        warn(`attrs is readonly.`);
        return false;
      },
      deleteProperty() {
        warn(`attrs is readonly.`);
        return false;
      },
    }
  : {
      get(target: Data, key: string) {
        track(target, TrackOpTypes.GET, ""); // 生产环境只追踪
        return target[key];
      },
    };
```

**为什么 attrs 需要 Proxy？**

- attrs 可能随父组件更新而变化
- 访问 attrs 时需要触发依赖收集，这样父组件更新时子组件能正确重新渲染

---

## 十、expose 机制 — getComponentPublicInstance

```typescript
export function getComponentPublicInstance(
  instance: ComponentInternalInstance,
): ComponentPublicInstance | ComponentInternalInstance["exposed"] | null {
  if (instance.exposed) {
    // 有 expose → 返回 exposeProxy
    return (
      instance.exposeProxy ||
      (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
        get(target, key: string) {
          if (key in target) {
            return target[key]; // 暴露的属性
          } else if (key in publicPropertiesMap) {
            return publicPropertiesMap[key](instance); // $emit/$refs 等
          }
        },
        has(target, key: string) {
          return key in target || key in publicPropertiesMap;
        },
      }))
    );
  } else {
    // 无 expose → 返回完整 proxy (默认行为)
    return instance.proxy;
  }
}
```

### 10.1 expose 的完整流程

```
父组件:
  <Child ref="childRef" />
  this.$refs.childRef  → getComponentPublicInstance(childInstance)

子组件 setup:
  const internalState = ref('secret')
  const publicMethod = () => { ... }

  expose({ publicMethod })  // ← instance.exposed = { publicMethod }

结果:
  parent.$refs.childRef.publicMethod  → ✅ 可访问
  parent.$refs.childRef.internalState → ❌ undefined (未暴露)
  parent.$refs.childRef.$emit         → ✅ 可访问 (publicPropertiesMap)
```

### 10.2 markRaw + proxyRefs 组合

```typescript
// exposeProxy 创建时:
new Proxy(proxyRefs(markRaw(instance.exposed)), {...})

// markRaw: 标记对象不被响应式系统代理
// proxyRefs: 自动解包 ref

// 组合效果:
// - exposed 对象本身不被额外代理 (避免双重代理)
// - 但 exposed 中的 ref 自动解包 (与 setupState 一致)
```

---

## 十一、完整组件挂载流程

```
1. renderer 遇到组件 vnode
   │
2. mountComponent(vnode, container)
   │
3. const instance = createComponentInstance(vnode, parent, suspense)
   │  └─ 创建 ComponentInternalInstance
   │  └─ uid++, scope = new EffectScope(true)
   │  └─ provides 原型链继承
   │
4. setupComponent(instance)
   │  ├─ initProps(instance, props)     → instance.props
   │  ├─ initSlots(instance, children)  → instance.slots
   │  └─ setupStatefulComponent(instance)
   │     ├─ instance.proxy = new Proxy(ctx, handlers)
   │     ├─ pauseTracking()
   │     ├─ setCurrentInstance(instance)  → currentInstance = instance
   │     ├─ setupResult = setup(props, context)
   │     ├─ reset()                      → currentInstance = prev
   │     ├─ resetTracking()
   │     └─ handleSetupResult(instance, setupResult)
   │        ├─ setupState = proxyRefs(setupResult)
   │        └─ finishComponentSetup(instance)
   │           └─ applyOptions(instance)  // Options API
   │
5. setupRenderEffect(instance)
   │  ├─ instance.effect = new ReactiveEffect(() => {
   │  │     if (!instance.isMounted) {
   │  │       // 首次渲染
   │  │       const subTree = instance.render()
   │  │       patch(null, subTree, container)
   │  │       instance.isMounted = true
   │  │     } else {
   │  │       // 更新
   │  │       const nextTree = instance.render()
   │  │       patch(prevTree, nextTree, container)
   │  │     }
   │  │   },
   │  │   {
   │  │     scheduler: () => queueJob(instance.job)  // → Scheduler 三队列
   │  │   }
   │  │ )
   │  └─ instance.effect.run()
   │
6. 响应式数据变化
   │  └─ trigger → effect.scheduler → queueJob → nextTick → flushSchedulerQueue
   │     └─ instance.effect.run() → 重新 render → patch
```

---

## 十二、与之前精读的关联

### 12.1 与响应式系统的连接点

```
@vue/reactivity                    runtime-core/component.ts
─────────────────                 ─────────────────────────
ReactiveEffect ─────────────────→ instance.effect
track/trigger ──────────────────→ attrsProxyHandlers 中的 track()
EffectScope ────────────────────→ instance.scope (组件级清理)
proxyRefs ──────────────────────→ instance.setupState = proxyRefs(result)
isRef ──────────────────────────→ handleSetupResult 判断
shallowReadonly ────────────────→ setup props (DEV 只读)
```

### 12.2 与 Scheduler 的连接点

```
component.ts                       scheduler.ts
─────────────────                 ─────────────────────────
instance.job ───────────────────→ SchedulerJob
ReactiveEffect options.scheduler → queueJob(instance.job)
instance.update ─────────────────→ 触发 scheduler 的入口
```

### 12.3 三者协作完整链路

```
用户修改数据: count.value = 5
    │
    ▼
trigger (reactivity)
    │ 找到 dep 中的所有 effect
    │
    ▼
effect.scheduler (component.ts)
    │ queueJob(instance.job)
    │
    ▼
Scheduler 三队列 (scheduler.ts)
    │ preQueue / queue / postQueue
    │ 去重 + 二分排序 + 游标系统
    │
    ▼
nextTick (微任务)
    │ Promise.then
    │
    ▼
flushSchedulerQueue
    │ pre → sort → execute → post
    │
    ▼
instance.effect.run() (component.ts)
    │ instance.render() → subTree vnode
    │
    ▼
renderer patch (renderer.ts)
    │ vnode → DOM 更新
```

---

## 十三、关键设计模式总结

| 模式                 | 在 component.ts 中的体现                        | 好处                         |
| -------------------- | ----------------------------------------------- | ---------------------------- |
| **栈式上下文**       | `setCurrentInstance` 保存 prev，返回 reset 函数 | 嵌套组件不互相污染           |
| **延迟初始化**       | `root: null!` → 创建后同步设置                  | 避免循环依赖                 |
| **原型链继承**       | `provides: parent ? parent.provides : ...`      | provide/inject 天然支持      |
| **空对象共享**       | `EMPTY_OBJ` 作为默认值                          | 减少内存分配                 |
| **EffectScope 隔离** | `new EffectScope(true)` + scope.on/off          | 组件卸载一键清理             |
| **Proxy 分层**       | proxy / exposeProxy / withProxy / attrsProxy    | 不同场景不同代理行为         |
| **性能优化**         | `setup.length > 1` 才创建 context               | 减少不必要的对象创建         |
| **错误边界**         | `callWithErrorHandling` 包裹 setup              | 统一错误处理 + errorCaptured |

---

## 十四、面试高频问题

### Q1: setup() 中为什么能访问 getCurrentInstance()？

```
A: Vue 在调用 setup 前执行 setCurrentInstance(instance)，将实例设为全局 currentInstance。
   setup 中的 ref/computed/watch 等 API 内部会调用 getCurrentInstance() 获取当前组件，
   从而将 effect 注册到 instance.scope，实现组件卸载时自动清理。
   setup 执行完毕后调用 reset() 恢复父实例，保证嵌套组件正确性。
```

### Q2: proxyRefs 的作用是什么？为什么需要它？

```
A: proxyRefs 自动解包 setup 返回对象中的 ref。
   没有 proxyRefs: template 中需写 {{ count.value }}
   有 proxyRefs: template 中写 {{ count }} 即可
   这是 Vue 3 <script setup> 体验流畅的关键 — 模板中不需要 .value。
```

### Q3: expose() 和默认暴露的区别？

```
A: 默认: 父组件通过 ref 可以访问子组件的所有 public instance (props/data/computed/methods/$xxx)
   expose: 子组件主动控制暴露内容，只暴露指定属性/方法
   实现: getComponentPublicInstance 检查 instance.exposed，有则返回 exposeProxy，无则返回 proxy
```

### Q4: 为什么 setup 中要 pauseTracking / resetTracking？

```
A: setup 执行期间，ref/reactive/computed 的创建不应触发 effect。
   依赖收集应该在 render 函数执行时进行 (访问响应式数据时)。
   pauseTracking 暂停全局 tracking 标志，setup 完成后恢复。
```

### Q5: async setup 如何与 Suspense 协作？

```
A: 1. setup 返回 Promise → isAsyncSetup = true
   2. instance.asyncDep = setupResult (保存 Promise)
   3. 组件进入 pending 状态，渲染 fallback
   4. Promise resolve → Suspense 触发 re-render
   5. handleSetupResult 处理 resolve 值，继续正常流程
```

---

## 十五、手写简化版 Component Instance

```typescript
// === 简化版 Vue 3 组件实例系统 ===

let currentInstance = null;
let uid = 0;

class ComponentInstance {
  constructor(vnode, parent) {
    this.uid = uid++;
    this.vnode = vnode;
    this.type = vnode.type;
    this.parent = parent;
    this.props = {};
    this.setupState = {};
    this.render = null;
    this.proxy = null;
    this.exposed = null;
    this.scope = new Set(); // 简化: effect 集合
  }
}

// setCurrentInstance — 栈式切换
function setCurrentInstance(instance) {
  const prev = currentInstance;
  currentInstance = instance;
  return () => {
    currentInstance = prev;
  };
}

// ref — 自动注册到当前组件 scope
function ref(value) {
  const r = { value, _isRef: true };
  if (currentInstance) {
    currentInstance.scope.add(r); // 注册到组件
  }
  return r;
}

// proxyRefs — 自动解包
function proxyRefs(obj) {
  return new Proxy(obj, {
    get(target, key) {
      const val = target[key];
      return val?._isRef ? val.value : val;
    },
    set(target, key, value) {
      const existing = target[key];
      if (existing?._isRef) {
        existing.value = value;
        return true;
      }
      target[key] = value;
      return true;
    },
  });
}

// setupComponent — 简化版
function setupComponent(instance) {
  const { setup } = instance.type;
  if (!setup) return;

  const reset = setCurrentInstance(instance);
  const result = setup(instance.props, {
    emit: (event, ...args) => console.log("emit:", event, args),
    expose: (exposed) => {
      instance.exposed = exposed;
    },
  });
  reset();

  // 处理返回值
  if (typeof result === "function") {
    instance.render = result;
  } else if (typeof result === "object") {
    instance.setupState = proxyRefs(result);
  }

  // 创建代理
  instance.proxy = new Proxy(instance, {
    get(target, key) {
      // 优先级: setupState > props
      if (key in target.setupState) return target.setupState[key];
      if (key in target.props) return target.props[key];
      return target[key];
    },
  });
}

// === 测试 ===
const MyComponent = {
  props: ["name"],
  setup(props) {
    const count = ref(0);
    const double = () => count.value * 2;

    setTimeout(() => {
      count.value++;
      console.log("count:", count.value, "double:", double());
      // 模板中: count = 1 (自动解包), 不需要 .value
    }, 100);

    return { count, double };
  },
};

const vnode = { type: MyComponent };
const instance = new ComponentInstance(vnode, null);
setupComponent(instance);

console.log(instance.proxy.count); // 0 (自动解包)
```

---

## 十六、学习收获

1. **currentInstance 栈**: 全局变量 + 栈式切换 = 优雅的上下文管理
2. **EffectScope 集成**: 组件级响应式副作用的生命周期管理
3. **proxyRefs 自动解包**: 模板体验流畅的关键 (无需 .value)
4. **分层代理**: proxy / exposeProxy / withProxy / attrsProxy 各司其职
5. **setup.length 优化**: 不需要的 context 不创建 (性能细节)
6. **Options API 桥接**: applyOptions 将 Options API 转换为响应式状态
7. **expose 机制**: 控制组件公开接口，封装内部实现

---

**源码系列进度**:

1. ✅ Vue 3 响应式系统 (Proxy + track/trigger + Link 双向链表)
2. ✅ React Fiber 架构 (Fiber 节点 + 双缓冲 + Lane 模型)
3. ✅ React Hooks 源码 (Hook 链表 + UpdateQueue + 调度)
4. ✅ React Diff 算法 (ReactChildFiber 协调器)
5. ✅ Vue 3 Scheduler 系统 (批量更新 + 三队列 + 微任务调度)
6. ✅ Vue 3 Component Instance (实例创建 + setup 流程 + currentInstance 栈 + expose 机制)

**三者联动**: 响应式系统 (数据拦截) → Component Instance (组件模型) → Scheduler (更新调度) = Vue 3 响应式完整闭环
