# Vue 3 响应式系统源码精读笔记

## 一、整体架构概览

Vue 3 的响应式系统基于 **Proxy + 双向链表** 实现，核心文件：

```
packages/reactivity/src/
├── effect.ts          # 核心：ReactiveEffect 类，副作用管理
├── dep.ts             # 核心：Dep/Link 类，依赖追踪
├── baseHandlers.ts    # Proxy 拦截器（get/set/delete/has/ownKeys）
├── reactive.ts        # reactive()/readonly()/shallowReactive() 入口
├── ref.ts             # ref()/shallowRef()/customRef() 实现
├── computed.ts        # computed() 惰性求值
├── watch.ts           # watch()/watchEffect()
├── effectScope.ts     # effectScope() 批量管理
└── collectionHandlers.ts  # Map/Set/WeakMap/WeakSet 的代理
```

---

## 二、核心数据结构：Link 和 Dep

### 2.1 Link 类 — 双向链表的节点

```typescript
export class Link {
  version: number        // 依赖版本号，用于脏检查
  nextDep?: Link         // 指向 effect 的下一个 dep
  prevDep?: Link         // 指向 effect 的上一个 dep
  nextSub?: Link         // 指向 dep 的下一个 subscriber
  prevSub?: Link         // 指向 dep 的上一个 subscriber
  prevActiveLink?: Link  // 保存上次的 activeLink（嵌套追踪用）

  constructor(public sub: Subscriber, public dep: Dep) {
    this.version = dep.version
  }
}
```

**关键设计：**
- 每个 Link 同时属于 **两条双向链表**：
  1. **Dep 链表**：dep → subs → subscriber（一个属性被哪些 effect 依赖）
  2. **Sub 链表**：sub → deps → dep（一个 effect 依赖哪些属性）
- `version` 字段是脏检查的核心：effect 运行前将所有 deps 的 version 设为 -1，运行时同步为当前 dep.version，运行后清理 version=-1 的过期依赖

### 2.2 Dep 类 — 依赖收集器

```typescript
export class Dep {
  version = 0              // 每次 trigger 时递增
  activeLink?: Link        // 当前正在追踪的 link（优化：避免重复创建）
  subs?: Link              // 订阅者链表尾部
  subsHead?: Link          // 订阅者链表头部（DEV 用）
  sc: number = 0           // subscriber 计数
  map?: KeyToDepMap        // 所属的 Map（用于清理）
  key?: unknown            // 对应的属性 key
}
```

**track() 方法 — 依赖收集：**
```typescript
track(debugInfo?: DebuggerEventExtraInfo): Link | undefined {
  // 1. 没有 activeSub 或不应该追踪 → 直接返回
  if (!activeSub || !shouldTrack || activeSub === this.computed) return

  // 2. 复用 activeLink 或创建新 Link
  let link = this.activeLink
  if (link === undefined || link.sub !== activeSub) {
    link = this.activeLink = new Link(activeSub, this)
    // 将 link 加入 effect 的 deps 链表尾部
    addSub(link)
  } else if (link.version === -1) {
    // 3. 复用上次运行的 link（已存在，只需同步 version）
    link.version = this.version
    // 将 link 移到 deps 链表尾部（保持访问顺序）
  }
  return link
}
```

**trigger() 方法 — 触发更新：**
```typescript
trigger(debugInfo?: DebuggerEventExtraInfo): void {
  this.version++      // 递增版本号
  globalVersion++     // 递增全局版本号（computed 快速路径用）
  this.notify(debugInfo)
}
```

**notify() 方法 — 通知所有订阅者：**
```typescript
notify(debugInfo?: DebuggerEventExtraInfo): void {
  startBatch()  // 开始批处理
  try {
    // DEV 模式：按原始顺序调用 onTrigger 钩子
    for (let head = this.subsHead; head; head = head.nextSub) {
      if (head.sub.onTrigger && !(head.sub.flags & EffectFlags.NOTIFIED)) {
        head.sub.onTrigger(...)
      }
    }
    // 反向遍历 subs 链表，调用每个 subscriber 的 notify()
    for (let link = this.subs; link; link = link.prevSub) {
      if (link.sub.notify()) {
        // computed 的 notify() 返回 true，需要继续通知它的 dep
        ;(link.sub as ComputedRefImpl).dep.notify()
      }
    }
  } finally {
    endBatch()  // 结束批处理，执行所有 batched effects
  }
}
```

### 2.3 targetMap — 全局依赖映射

```typescript
// { target 对象 → { key → Dep } }
export const targetMap: WeakMap<object, KeyToDepMap> = new WeakMap()
```

**track() 顶层函数：**
```typescript
export function track(target: object, type: TrackOpTypes, key: unknown): void {
  if (shouldTrack && activeSub) {
    // 1. 获取或创建 target 的 depsMap
    let depsMap = targetMap.get(target)
    if (!depsMap) targetMap.set(target, (depsMap = new Map()))

    // 2. 获取或创建 key 的 Dep
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = new Dep()))
      dep.map = depsMap
      dep.key = key
    }

    // 3. 调用 Dep.track() 收集依赖
    dep.track()
  }
}
```

---

## 三、ReactiveEffect — 副作用管理

### 3.1 EffectFlags 位标志

```typescript
export enum EffectFlags {
  ACTIVE = 1 << 0,       // effect 是否活跃
  RUNNING = 1 << 1,      // effect 是否正在运行
  TRACKING = 1 << 2,     // effect 是否在追踪依赖
  NOTIFIED = 1 << 3,     // effect 是否已被通知（去重）
  DIRTY = 1 << 4,        // effect 是否需要重新计算
  ALLOW_RECURSE = 1 << 5,// 允许递归触发
  PAUSED = 1 << 6,       // effect 是否暂停
  EVALUATED = 1 << 7,    // computed 是否已求值
}
```

### 3.2 ReactiveEffect 核心方法

```typescript
export class ReactiveEffect<T = any> implements Subscriber {
  deps?: Link = undefined        // deps 链表头
  depsTail?: Link = undefined    // deps 链表尾
  flags: EffectFlags = EffectFlags.ACTIVE | EffectFlags.TRACKING
  next?: Subscriber = undefined  // 用于 batch 链表
  cleanup?: () => void = undefined
  scheduler?: EffectScheduler = undefined

  constructor(public fn: () => T) {
    // 自动加入当前 effectScope
    if (activeEffectScope && activeEffectScope.active) {
      activeEffectScope.effects.push(this)
    }
  }

  // 通知 effect 需要重新运行
  notify(): void {
    if (this.flags & EffectFlags.RUNNING && !(this.flags & EffectFlags.ALLOW_RECURSE)) {
      return  // 正在运行且不允递归 → 忽略
    }
    if (!(this.flags & EffectFlags.NOTIFIED)) {
      batch(this)  // 加入批处理队列
    }
  }

  // 运行 effect
  run(): T {
    if (!(this.flags & EffectFlags.ACTIVE)) return this.fn()

    this.flags |= EffectFlags.RUNNING
    cleanupEffect(this)           // 执行上次的 cleanup
    prepareDeps(this)             // 将所有 deps version 设为 -1

    const prevEffect = activeSub  // 保存上一个 activeSub
    const prevShouldTrack = shouldTrack
    activeSub = this              // 设置当前 activeSub
    shouldTrack = true

    try {
      return this.fn()            // 执行用户函数，触发 track
    } finally {
      cleanupDeps(this)           // 清理 version=-1 的过期依赖
      activeSub = prevEffect      // 恢复 activeSub
      shouldTrack = prevShouldTrack
      this.flags &= ~EffectFlags.RUNNING
    }
  }

  // 触发更新
  trigger(): void {
    if (this.flags & EffectFlags.PAUSED) {
      pausedQueueEffects.add(this)
    } else if (this.scheduler) {
      this.scheduler()            // 使用自定义调度器
    } else {
      this.runIfDirty()           // 脏检查后运行
    }
  }
}
```

### 3.3 prepareDeps / cleanupDeps — 依赖同步

```typescript
function prepareDeps(sub: Subscriber) {
  // 运行前：将所有旧 deps 的 version 设为 -1
  for (let link = sub.deps; link; link = link.nextDep) {
    link.version = -1
    link.prevActiveLink = link.dep.activeLink
    link.dep.activeLink = link
  }
}

function cleanupDeps(sub: Subscriber) {
  // 运行后：清理 version=-1 的过期依赖
  let head, tail = sub.depsTail
  let link = tail
  while (link) {
    const prev = link.prevDep
    if (link.version === -1) {
      // 过期依赖 → 从 dep 和 sub 的链表中移除
      removeSub(link)
      removeDep(link)
    } else {
      head = link  // 记录最后一个有效依赖作为新头
    }
    link.dep.activeLink = link.prevActiveLink
    link.prevActiveLink = undefined
    link = prev
  }
  sub.deps = head
  sub.depsTail = tail
}
```

### 3.4 isDirty — 脏检查

```typescript
function isDirty(sub: Subscriber): boolean {
  for (let link = sub.deps; link; link = link.nextDep) {
    if (
      link.dep.version !== link.version ||  // dep 版本变了
      (link.dep.computed &&                  // 或 computed 的值变了
        (refreshComputed(link.dep.computed) ||
          link.dep.version !== link.version))
    ) {
      return true
    }
  }
  return false
}
```

---

## 四、批处理机制（Batch）

Vue 3 使用 **链表 + 位标志** 实现高效批处理：

```typescript
let batchDepth = 0
let batchedSub: Subscriber | undefined
let batchedComputed: Subscriber | undefined

export function batch(sub: Subscriber, isComputed = false): void {
  sub.flags |= EffectFlags.NOTIFIED  // 标记已通知（去重）
  if (isComputed) {
    sub.next = batchedComputed       // 头插法加入 computed 链表
    batchedComputed = sub
    return
  }
  sub.next = batchedSub              // 头插法加入 effect 链表
  batchedSub = sub
}

export function startBatch(): void { batchDepth++ }

export function endBatch(): void {
  if (--batchDepth > 0) return  // 嵌套 batch，不执行

  // 1. 先清理 computed 链表的 NOTIFIED 标志
  if (batchedComputed) {
    let e = batchedComputed
    batchedComputed = undefined
    while (e) {
      const next = e.next
      e.next = undefined
      e.flags &= ~EffectFlags.NOTIFIED
      e = next
    }
  }

  // 2. 执行所有 batched effects
  while (batchedSub) {
    let e = batchedSub
    batchedSub = undefined
    while (e) {
      const next = e.next
      e.next = undefined
      e.flags &= ~EffectFlags.NOTIFIED
      if (e.flags & EffectFlags.ACTIVE) {
        ;(e as ReactiveEffect).trigger()
      }
      e = next
    }
  }
}
```

**设计亮点：**
- 使用 `NOTIFIED` 标志去重，同一 effect 在同一批中只执行一次
- 先处理 computed 再处理 effect，保证 computed 的值是最新的
- 嵌套 batch 通过 `batchDepth` 计数器实现

---

## 五、Proxy 拦截器（baseHandlers.ts）

### 5.1 get 拦截 — 读取时 track

```typescript
class BaseReactiveHandler implements ProxyHandler<Target> {
  get(target: Target, key: string | symbol, receiver: object): any {
    // 1. 处理内部标志
    if (key === ReactiveFlags.SKIP) return target[ReactiveFlags.SKIP]
    if (key === ReactiveFlags.IS_REACTIVE) return !this._isReadonly
    if (key === ReactiveFlags.IS_READONLY) return this._isReadonly
    if (key === ReactiveFlags.IS_SHALLOW) return this._isShallow
    if (key === ReactiveFlags.RAW) {
      // 返回原始对象
      return proxyMap.get(target) === receiver ? target : undefined
    }

    // 2. 数组方法拦截
    const targetIsArray = isArray(target)
    if (!this._isReadonly && targetIsArray && arrayInstrumentations[key]) {
      return arrayInstrumentations[key]
    }

    // 3. 读取实际值
    const res = Reflect.get(target, key, isRef(target) ? target : receiver)

    // 4. 跳过不需要追踪的 key
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res
    }

    // 5. 非 readonly 时 track
    if (!this._isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }

    // 6. shallow 模式直接返回
    if (this._isShallow) return res

    // 7. ref 解包
    if (isRef(res)) {
      return targetIsArray && isIntegerKey(key) ? res : res.value
    }

    // 8. 对象递归代理（深度响应式）
    if (isObject(res)) {
      return this._isReadonly ? readonly(res) : reactive(res)
    }

    return res
  }
}
```

### 5.2 set 拦截 — 写入时 trigger

```typescript
class MutableReactiveHandler extends BaseReactiveHandler {
  set(target, key, value, receiver): boolean {
    let oldValue = target[key]

    // 1. 处理 ref 赋值
    if (!this._isShallow) {
      if (!isShallow(value) && !isReadonly(value)) {
        oldValue = toRaw(oldValue)
        value = toRaw(value)
      }
      if (!isArrayWithIntegerKey && isRef(oldValue) && !isRef(value)) {
        oldValue.value = value  // ref.value = newValue
        return true
      }
    }

    // 2. 判断是 ADD 还是 SET
    const hadKey = isArrayWithIntegerKey
      ? Number(key) < target.length
      : hasOwn(target, key)

    // 3. 实际赋值
    const result = Reflect.set(target, key, value, receiver)

    // 4. 触发更新（只在原始对象上触发）
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else if (hasChanged(value, oldValue)) {
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }
    return result
  }
}
```

### 5.3 trigger() 顶层函数 — 精确触发

```typescript
export function trigger(target, type, key?, newValue?, oldValue?, oldTarget?) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    globalVersion++  // 从未被追踪过，只递增全局版本
    return
  }

  startBatch()

  if (type === TriggerOpTypes.CLEAR) {
    // Map/Set 清空 → 触发所有 effect
    depsMap.forEach(run)
  } else {
    const targetIsArray = isArray(target)
    const isArrayIndex = targetIsArray && isIntegerKey(key)

    // 数组 length 变化 → 触发 length + 迭代 + 超出新长度的索引
    if (targetIsArray && key === 'length') {
      const newLength = Number(newValue)
      depsMap.forEach((dep, key) => {
        if (key === 'length' || key === ARRAY_ITERATE_KEY || 
            (!isSymbol(key) && key >= newLength)) {
          run(dep)
        }
      })
    } else {
      // 触发对应 key 的 effect
      if (key !== void 0 || depsMap.has(void 0)) {
        run(depsMap.get(key))
      }

      // 数组索引变化 → 触发迭代 effect
      if (isArrayIndex) {
        run(depsMap.get(ARRAY_ITERATE_KEY))
      }

      // ADD/DELETE → 触发迭代 effect
      switch (type) {
        case TriggerOpTypes.ADD:
          if (!targetIsArray) run(depsMap.get(ITERATE_KEY))
          else if (isArrayIndex) run(depsMap.get('length'))
          break
        case TriggerOpTypes.DELETE:
          if (!targetIsArray) run(depsMap.get(ITERATE_KEY))
          break
      }
    }
  }

  endBatch()
}
```

---

## 六、Computed — 惰性求值 + 缓存

```typescript
export class ComputedRefImpl<T = any> implements Subscriber {
  _value: any = undefined
  readonly dep: Dep = new Dep(this)  // 自己的 dep（通知下游 effect）
  deps?: Link = undefined             // 依赖的 deps 链表
  depsTail?: Link = undefined
  flags: EffectFlags = EffectFlags.DIRTY  // 初始为脏
  globalVersion: number = globalVersion - 1

  // 被上游 dep 通知
  notify(): true | void {
    this.flags |= EffectFlags.DIRTY  // 标记为脏
    if (!(this.flags & EffectFlags.NOTIFIED) && activeSub !== this) {
      batch(this, true)  // 加入 computed batch 链表
      return true  // 返回 true 让 dep.notify() 继续通知上游
    }
  }

  get value(): T {
    // 1. track 自己的 value（让下游 effect 能追踪 computed）
    const link = this.dep.track()

    // 2. 刷新 computed 值（惰性求值）
    refreshComputed(this)

    // 3. 同步 version
    if (link) link.version = this.dep.version

    return this._value
  }
}

export function refreshComputed(computed: ComputedRefImpl): undefined {
  // 1. 非脏且非 SSR → 跳过
  if (computed.flags & EffectFlags.TRACKING && !(computed.flags & EffectFlags.DIRTY)) return

  // 2. 全局版本没变 → 跳过（快速路径）
  if (computed.globalVersion === globalVersion) return
  computed.globalVersion = globalVersion

  // 3. 无依赖且已求值 → 跳过
  if (!computed.isSSR && computed.flags & EffectFlags.EVALUATED && !isDirty(computed)) return

  // 4. 重新求值
  computed.flags |= EffectFlags.RUNNING
  const prevSub = activeSub
  const prevShouldTrack = shouldTrack
  activeSub = computed
  shouldTrack = true

  try {
    prepareDeps(computed)
    const value = computed.fn(computed._value)  // 执行 getter

    // 5. 值变了 → 更新 + 递增 version
    if (dep.version === 0 || hasChanged(value, computed._value)) {
      computed.flags |= EffectFlags.EVALUATED
      computed._value = value
      dep.version++
    }
  } finally {
    activeSub = prevSub
    shouldTrack = prevShouldTrack
    cleanupDeps(computed)
    computed.flags &= ~EffectFlags.RUNNING
  }
}
```

**Computed 的链式通知机制：**
```
dep A → computed B → effect C
         ↑              ↑
      脏标记         批量执行
```
1. A 变化 → 通知 B
2. B 标记脏 → 加入 computed batch → 返回 true
3. B 的 dep 继续通知 C
4. endBatch 时先清理 computed 标志，再执行 effect

---

## 七、Ref — 基本类型的响应式包装

```typescript
class RefImpl<T = any> {
  _value: T
  private _rawValue: T
  dep: Dep = new Dep()  // 每个 ref 有自己的 Dep

  get value() {
    this.dep.track()  // track 自己的 value
    return this._value
  }

  set value(newValue) {
    const oldValue = this._rawValue
    newValue = useDirectValue ? newValue : toRaw(newValue)

    if (hasChanged(newValue, oldValue)) {
      this._rawValue = newValue
      this._value = useDirectValue ? newValue : toReactive(newValue)
      this.dep.trigger()  // trigger 所有依赖
    }
  }
}
```

**Ref vs Reactive 的区别：**
| 特性 | ref | reactive |
|------|-----|----------|
| 底层实现 | 对象包装 + getter/setter | Proxy |
| 支持类型 | 任意值 | 仅对象 |
| 访问方式 | `.value` | 直接访问 |
| 替换整个值 | ✅ | ❌（会丢失响应式） |

---

## 八、关键设计模式总结

### 8.1 双向链表 vs Set 的对比

Vue 3 选择双向链表而非 Set 存储依赖的原因：

| 方面 | Set | 双向链表 |
|------|-----|----------|
| 内存占用 | 较高（每个元素是独立对象） | 较低（Link 复用） |
| 依赖清理 | 需要遍历删除 | O(1) 删除 |
| 顺序保持 | 不保证 | 保持访问顺序 |
| 版本同步 | 需要额外 Map | 内置 version 字段 |

### 8.2 版本控制机制

```
dep.version ──────→ 每次 trigger 递增
                    ↓
link.version ────→ 每次 track 同步
                    ↓
isDirty() ────────→ 比较 version 判断是否脏
```

### 8.3 批处理优化

```
trigger() 
  → startBatch() 
  → batch(effect)  // 标记 NOTIFIED，加入链表
  → endBatch() 
  → 执行所有 batched effects
```

### 8.4 惰性求值

```
computed 初始 DIRTY
  → 首次访问 value → refreshComputed → 求值 + 缓存
  → 依赖变化 → 标记 DIRTY
  → 再次访问 → 检查 isDirty → 需要则重新求值
```

---

## 九、性能优化要点

1. **activeLink 缓存**：避免重复创建 Link 对象
2. **version 版本控制**：O(1) 脏检查，无需深度比较
3. **batch 去重**：NOTIFIED 标志防止重复执行
4. **globalVersion 快速路径**：computed 无变化时跳过求值
5. **WeakMap 存储**：targetMap 使用 WeakMap 防止内存泄漏
6. **懒代理**：嵌套对象只在访问时代理，非初始化时全量代理
7. **链表清理**：cleanupDeps 及时移除过期依赖，保持链表精简

---

## 十、与 Vue 2 的对比

| 特性 | Vue 2 (Object.defineProperty) | Vue 3 (Proxy) |
|------|-------------------------------|---------------|
| 拦截能力 | 仅 get/set | get/set/delete/has/ownKeys 等 13 种 |
| 新增属性 | ❌ 需 $set | ✅ 自动拦截 |
| 删除属性 | ❌ 需 $delete | ✅ 自动拦截 |
| 数组索引 | ❌ 不支持 | ✅ 支持 |
| Map/Set | ❌ 不支持 | ✅ 支持 |
| 性能 | 初始化时递归遍历 | 懒代理，按需创建 |
| 内存 | 每个属性一个 Dep | Link 复用，更紧凑 |

---

## 十一、学习收获

1. **双向链表设计精妙**：一个 Link 同时维护 dep→sub 和 sub→dep 两条链，内存高效
2. **版本控制替代深度比较**：用 version 数字比较替代 Object.is 深度比较，性能提升显著
3. **批处理机制优雅**：链表 + 位标志实现高效去重和批量执行
4. **computed 惰性求值**：只在访问时求值，依赖变化时只标记脏，不立即重新计算
5. **Proxy 比 defineProperty 强大得多**：13 种拦截操作，支持所有对象类型
