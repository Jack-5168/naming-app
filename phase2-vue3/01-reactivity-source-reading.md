# Vue3 响应式系统源码精读 — 阶段二 Day 1

> 源码版本: Vue 3.5+ (main 分支, 2026)
> 核心文件: `reactive.ts` | `baseHandlers.ts` | `dep.ts` | `effect.ts` | `ref.ts`
> 重点: Proxy 代理 → 依赖收集 (track) → 触发更新 (trigger) → 双向链表调度

---

## 一、整体架构：5 个文件的职责分工

```
reactive.ts        → 入口层: reactive/readonly/shallowReactive/shallowReadonly
baseHandlers.ts    → Proxy 拦截层: get/set/deleteProperty/has/ownKeys
dep.ts             → 依赖层: Dep/Link/track/trigger/targetMap
effect.ts          → 副作用层: ReactiveEffect/run/stop/batch/调度
ref.ts             → 基础包装层: Ref/RefImpl/shallowRef/customRef/toRef
```

**数据流**: 用户调用 `reactive(obj)` → 创建 Proxy → 读属性触发 `get` → `track()` 收集依赖 → 写属性触发 `set` → `trigger()` 通知更新 → `effect.run()` 重新执行

---

## 二、reactive.ts — 入口层逐行分析

### 2.1 WeakMap 缓存池

```ts
export const reactiveMap: WeakMap<Target, any> = new WeakMap();
export const shallowReactiveMap: WeakMap<Target, any> = new WeakMap();
export const readonlyMap: WeakMap<Target, any> = new WeakMap();
export const shallowReadonlyMap: WeakMap<Target, any> = new WeakMap();
```

**逐行解读**:

- 4 个独立的 WeakMap，分别缓存 4 种响应式代理
- 使用 WeakMap 而非 Map：key（原始对象）被 GC 时自动清理，防止内存泄漏
- 同一对象多次调用 `reactive()` 返回同一个 Proxy（幂等性保证）

### 2.2 TargetType 枚举

```ts
enum TargetType {
  INVALID = 0, // 不可观察（非对象/不可扩展/标记了 SKIP）
  COMMON = 1, // 普通对象/数组 → 用 baseHandlers
  COLLECTION = 2, // Map/Set/WeakMap/WeakSet → 用 collectionHandlers
}
```

**设计意图**: 区分普通对象和集合类型，因为它们的拦截逻辑不同。例如 `map.set(key, val)` 需要特殊处理。

### 2.3 getTargetType — 判断目标是否可被代理

```ts
function getTargetType(value: Target) {
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value));
}
```

**关键判断**:

1. `ReactiveFlags.SKIP` — `markRaw()` 标记的对象跳过响应式
2. `Object.isExtensible()` — 冻结/密封的对象（`Object.freeze/seal`）不可代理
3. 只有 Object/Array/Map/Set/WeakMap/WeakSet 可被代理

### 2.4 reactive() 核心函数

```ts
export function reactive(target: object) {
  // 如果已经是 readonly proxy，直接返回
  if (isReadonly(target)) return target;
  return createReactiveObject(
    target,
    false, // isReadonly = false
    mutableHandlers, // 普通对象处理器
    mutableCollectionHandlers, // 集合对象处理器
    reactiveMap, // 缓存池
  );
}
```

**为什么 readonly 的 reactive 返回自身？**
因为 `readonly(reactive(obj))` 是合法操作，但 `reactive(readonly(obj))` 没有意义 — readonly 对象不应该被变成可变的。

### 2.5 createReactiveObject — Proxy 创建核心

```ts
function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>,
) {
  // 1. 只处理对象类型
  if (!isObject(target)) {
    if (__DEV__) warn(...)
    return target
  }
  // 2. 已经是 Proxy 且不是 readonly(reactive) 的情况，直接返回
  if (target[ReactiveFlags.RAW] && !(isReadonly && target[ReactiveFlags.IS_REACTIVE])) {
    return target
  }
  // 3. 检查目标类型是否有效
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) return target
  // 4. 缓存命中：同一对象只创建一个 Proxy
  const existingProxy = proxyMap.get(target)
  if (existingProxy) return existingProxy
  // 5. 创建 Proxy 并缓存
  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers,
  )
  proxyMap.set(target, proxy)
  return proxy
}
```

**关键设计**:

- `ReactiveFlags.RAW` 是 Proxy 上指向原始对象的符号属性
- `proxyMap.get(target)` 保证幂等性：`reactive(obj) === reactive(obj)`
- 根据类型选择 handler：普通对象用 `baseHandlers`，集合用 `collectionHandlers`

### 2.6 toRaw / markRaw / isReactive / isReadonly

```ts
// toRaw: 从 Proxy 取出原始对象
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW];
  return raw ? toRaw(raw) : observed; // 递归展开多层代理
}

// markRaw: 标记对象永远不被代理
export function markRaw<T extends object>(value: T): Raw<T> {
  if (!hasOwn(value, ReactiveFlags.SKIP) && Object.isExtensible(value)) {
    def(value, ReactiveFlags.SKIP, true); // 在对象上打标记
  }
  return value;
}

// isReactive: 判断是否是响应式代理
export function isReactive(value: unknown): boolean {
  if (isReadonly(value)) {
    return isReactive((value as Target)[ReactiveFlags.RAW]); // readonly(reactive) 也算 reactive
  }
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE]);
}
```

**isReactive 的巧妙之处**: `readonly(reactive(obj))` 也返回 true，因为它内部仍然是 reactive 的。

---

## 三、baseHandlers.ts — Proxy 拦截层逐行分析

这是响应式的核心：所有属性访问/修改都被 Proxy 拦截。

### 3.1 不可追踪的 key

```ts
const isNonTrackableKeys = makeMap(`__proto__,__v_isRef,__isVue`);

const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .filter((key) => key !== "arguments" && key !== "caller")
    .map((key) => Symbol[key])
    .filter(isSymbol),
);
```

**为什么排除这些 key？**

- `__proto__` — 原型链操作，追踪它会无限递归
- `__v_isRef`, `__isVue` — Vue 内部标记，不需要响应式
- 内置 Symbol — 如 `Symbol.toStringTag`，追踪无意义

### 3.2 BaseReactiveHandler.get — 读取拦截

```ts
get(target, key, receiver): any {
  // === 1. 处理 Vue 内部特殊标记 ===
  if (key === ReactiveFlags.SKIP) return target[ReactiveFlags.SKIP]
  if (key === ReactiveFlags.IS_REACTIVE) return !isReadonly
  if (key === ReactiveFlags.IS_READONLY) return isReadonly
  if (key === ReactiveFlags.IS_SHALLOW) return isShallow
  if (key === ReactiveFlags.RAW) {
    // 返回原始对象（需验证 receiver 合法性）
    if (receiver === proxyMap.get(target) ||
        Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) {
      return target
    }
    return undefined
  }

  // === 2. 数组方法拦截 ===
  const targetIsArray = isArray(target)
  if (!isReadonly) {
    if (targetIsArray && (fn = arrayInstrumentations[key])) return fn
    if (key === 'hasOwnProperty') return hasOwnProperty  // 自定义 hasOwnProperty 支持 track
  }

  // === 3. 实际读取值 ===
  const res = Reflect.get(target, key, isRef(target) ? target : receiver)

  // === 4. 跳过不需要追踪的 key ===
  if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
    return res
  }

  // === 5. 依赖收集（核心！）===
  if (!isReadonly) {
    track(target, TrackOpTypes.GET, key)  // ← 通知 Dep 系统：这个属性被访问了
  }

  // === 6. shallow 模式直接返回 ===
  if (isShallow) return res

  // === 7. ref 自动解包 ===
  if (isRef(res)) {
    const value = targetIsArray && isIntegerKey(key) ? res : res.value
    return isReadonly && isObject(value) ? readonly(value) : value
  }

  // === 8. 深层响应式：嵌套对象也变成 Proxy ===
  if (isObject(res)) {
    return isReadonly ? readonly(res) : reactive(res)
  }

  return res
}
```

**逐行关键点**:

| 步骤 | 作用         | 为什么重要                                                       |
| ---- | ------------ | ---------------------------------------------------------------- |
| 1    | 内部标记识别 | `isReactive(proxy)` 等 API 的实现基础                            |
| 2    | 数组方法拦截 | `push/pop/shift/unshift` 等会改变 length，需要特殊处理           |
| 3    | Reflect.get  | 标准读取，保持 receiver 正确性                                   |
| 4    | 跳过追踪     | 避免无意义的依赖收集                                             |
| 5    | **track()**  | **核心中的核心：建立依赖关系**                                   |
| 6    | shallow 模式 | `shallowReactive` 只代理第一层                                   |
| 7    | ref 解包     | `reactive({ count: ref(0) })` → `obj.count` 返回 0 而非 Ref 对象 |
| 8    | 深度代理     | 递归代理嵌套对象，实现"深响应式"                                 |

### 3.3 MutableReactiveHandler.set — 写入拦截

```ts
set(target, key, value, receiver): boolean {
  let oldValue = target[key]
  const isArrayWithIntegerKey = isArray(target) && isIntegerKey(key)

  // === 1. 非 shallow 模式：处理 ref 和 raw 值 ===
  if (!this._isShallow) {
    const isOldValueReadonly = isReadonly(oldValue)
    if (!isShallow(value) && !isReadonly(value)) {
      oldValue = toRaw(oldValue)  // 取原始值比较
      value = toRaw(value)
    }
    // ref 的特殊处理：如果旧值是 ref 且新值不是，直接修改 ref.value
    if (!isArrayWithIntegerKey && isRef(oldValue) && !isRef(value)) {
      if (isOldValueReadonly) {
        if (__DEV__) warn(...)
        return true
      } else {
        oldValue.value = value  // ← 修改 ref 内部值
        return true
      }
    }
  }

  // === 2. 判断是新增还是修改 ===
  const hadKey = isArrayWithIntegerKey
    ? Number(key) < target.length
    : hasOwn(target, key)

  // === 3. 实际写入 ===
  const result = Reflect.set(target, key, value, isRef(target) ? target : receiver)

  // === 4. 触发更新（核心！）===
  if (target === toRaw(receiver)) {  // 防止原型链上的重复触发
    if (!hadKey) {
      trigger(target, TriggerOpTypes.ADD, key, value)  // 新增属性
    } else if (hasChanged(value, oldValue)) {
      trigger(target, TriggerOpTypes.SET, key, value, oldValue)  // 修改属性
    }
  }
  return result
}
```

**关键设计**:

- `hadKey` 判断：数组看索引是否 < length，对象看 `hasOwn`
- `target === toRaw(receiver)`：防止通过原型链代理重复触发
- `hasChanged`：`Object.is` 比较，`NaN === NaN` 为 true，`0 !== -0`

### 3.4 deleteProperty / has / ownKeys

```ts
deleteProperty(target, key): boolean {
  const hadKey = hasOwn(target, key)
  const oldValue = target[key]
  const result = Reflect.deleteProperty(target, key)
  if (result && hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

has(target, key): boolean {
  const result = Reflect.has(target, key)
  if (!isSymbol(key) || !builtInSymbols.has(key)) {
    track(target, TrackOpTypes.HAS, key)  // `key in obj` 也收集依赖
  }
  return result
}

ownKeys(target): (string | symbol)[] {
  // `for...in` / `Object.keys` 触发迭代依赖
  track(target, TrackOpTypes.ITERATE, isArray(target) ? 'length' : ITERATE_KEY)
  return Reflect.ownKeys(target)
}
```

**`in` 操作符也追踪**: 这保证了 `v-if="key in obj"` 这类模板表达式能正确响应属性增删。

### 3.5 4 种 Handler 导出

```ts
export const mutableHandlers = new MutableReactiveHandler();
export const readonlyHandlers = new ReadonlyReactiveHandler();
export const shallowReactiveHandlers = new MutableReactiveHandler(true);
export const shallowReadonlyHandlers = new ReadonlyReactiveHandler(true);
```

| Handler                 | 可写 | 深层代理 | 用途                |
| ----------------------- | ---- | -------- | ------------------- |
| mutableHandlers         | ✅   | ✅       | `reactive()`        |
| readonlyHandlers        | ❌   | ✅       | `readonly()`        |
| shallowReactiveHandlers | ✅   | ❌       | `shallowReactive()` |
| shallowReadonlyHandlers | ❌   | ❌       | `shallowReadonly()` |

---

## 四、dep.ts — 依赖层逐行分析（Vue 3.5 新架构）

### 4.1 Vue 3.5 的重大变化：双向链表替代 Set

**旧架构 (Vue 3.0-3.4)**: `Dep` 内部维护一个 `Set<Effect>`，每次 track 往 Set 里 add，trigger 遍历 Set 执行。

**新架构 (Vue 3.5+)**: 使用**双向链表** `Link`，Dep 和 Effect 之间形成多对多的链表关系。

**为什么换？**

1. **清理无用依赖更高效**: effect 重新运行时，旧依赖不再被访问的自动清理，链表 O(1) 删除
2. **避免重复订阅**: 同一 effect 对同一 dep 只订阅一次，链表天然去重
3. **版本控制**: 每个 Link 有 version，配合 dep.version 实现"脏检查"，避免不必要的重算

### 4.2 Link 类 — 连接 Dep 和 Subscriber 的桥梁

```ts
export class Link {
  version: number; // 版本号，用于脏检查
  nextDep?: Link; // effect 的 deps 链表（下一个依赖）
  prevDep?: Link; // effect 的 deps 链表（上一个依赖）
  nextSub?: Link; // dep 的 subs 链表（下一个订阅者）
  prevSub?: Link; // dep 的 subs 链表（上一个订阅者）
  prevActiveLink?: Link; // 保存之前的 activeLink（用于 prepareDeps/cleanupDeps）

  constructor(
    public sub: Subscriber,
    public dep: Dep,
  ) {
    this.version = dep.version; // 初始化时同步 dep 的版本号
  }
}
```

**双向链表结构**:

```
Dep.subs (tail) ←→ Link ←→ Link ←→ Link (head, subsHead)
                     ↑
                   sub.deps (tail) ←→ Link ←→ Link ←→ Link (head)
                                        ↑
                                      Effect
```

每个 Link 同时属于两条链表：

- **dep → subs 链表**: 一个属性被哪些 effect 依赖
- **sub → deps 链表**: 一个 effect 依赖了哪些属性

### 4.3 Dep 类 — 依赖容器

```ts
export class Dep {
  version = 0; // 版本号，每次 trigger++
  activeLink?: Link = undefined;
  subs?: Link = undefined; // 订阅者链表尾部
  subsHead?: Link; // 订阅者链表头部（DEV 用）
  map?: KeyToDepMap = undefined; // 所属的 KeyToDepMap
  key?: unknown = undefined; // 对应的 key
  sc: number = 0; // subscriber count

  constructor(public computed?: ComputedRefImpl | undefined) {}

  track(): Link | undefined {
    // 没有 activeSub 或不应追踪时跳过
    if (!activeSub || !shouldTrack || activeSub === this.computed) return;

    let link = this.activeLink;
    if (link === undefined || link.sub !== activeSub) {
      // 创建新 Link
      link = this.activeLink = new Link(activeSub, this);
      // 加入 effect 的 deps 链表尾部
      if (!activeSub.deps) {
        activeSub.deps = activeSub.depsTail = link;
      } else {
        link.prevDep = activeSub.depsTail;
        activeSub.depsTail!.nextDep = link;
        activeSub.depsTail = link;
      }
      addSub(link); // 加入 dep 的 subs 链表
    } else if (link.version === -1) {
      // 复用上一轮的 Link（版本 -1 表示上一轮用过但本轮还没访问到）
      link.version = this.version;
      // 移动到 effect 的 deps 链表尾部（保持访问顺序）
      if (link.nextDep) {
        // 链表重排...
      }
    }
    return link;
  }

  trigger(): void {
    this.version++; // 版本号递增
    globalVersion++; // 全局版本号递增（computed 快速路径用）
    this.notify(); // 通知所有订阅者
  }

  notify(): void {
    startBatch();
    try {
      // DEV: 调用 onTrigger 钩子
      // 遍历 subs 链表，通知每个 subscriber
      for (let link = this.subs; link; link = link.prevSub) {
        if (link.sub.notify()) {
          // 如果是 computed，也通知它的 dep
          (link.sub as ComputedRefImpl).dep.notify();
        }
      }
    } finally {
      endBatch(); // 批量执行 effect
    }
  }
}
```

**track 的精妙逻辑**:

1. **首次访问**: 创建新 Link，加入两条链表
2. **重复访问（同一轮）**: 复用 activeLink，版本已同步
3. **重复访问（跨轮）**: Link 版本为 -1（prepareDeps 设置的），同步版本并移动到链表尾部

### 4.4 globalVersion — computed 的快速缓存路径

```ts
export let globalVersion = 0; // 每次响应式变化 +1
```

computed 会记录自己上次计算时的 `globalVersion`。如果 `computed.globalVersion === globalVersion`，说明自上次计算后没有任何响应式数据变化，直接返回缓存值，跳过整个 dirty 检查。

### 4.5 track() 全局函数

```ts
export function track(target: object, type: TrackOpTypes, key: unknown): void {
  if (shouldTrack && activeSub) {
    // 1. 获取 target 的 depsMap（key → Dep）
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }
    // 2. 获取 key 对应的 Dep
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, (dep = new Dep()));
      dep.map = depsMap; // 反向引用，用于清理
      dep.key = key;
    }
    // 3. 调用 dep.track() 建立连接
    dep.track();
  }
}
```

**targetMap 结构**:

```
WeakMap {
  target对象 → Map {
    'count' → Dep { subs: Link→Link→... }
    'name' → Dep { subs: Link→Link→... }
    Symbol(iterate) → Dep { subs: Link→... }
  }
}
```

### 4.6 trigger() 全局函数（最复杂的部分）

```ts
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
): void {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    globalVersion++; // 即使没有追踪过，也要更新全局版本
    return;
  }

  const run = (dep: Dep | undefined) => {
    if (dep) dep.trigger();
  };

  startBatch();

  if (type === TriggerOpTypes.CLEAR) {
    // Map/Set 清空：触发所有依赖
    depsMap.forEach(run);
  } else {
    const targetIsArray = isArray(target);
    const isArrayIndex = targetIsArray && isIntegerKey(key);

    // === 数组 length 变化 ===
    if (targetIsArray && key === "length") {
      const newLength = Number(newValue);
      depsMap.forEach((dep, key) => {
        if (
          key === "length" ||
          key === ARRAY_ITERATE_KEY ||
          (!isSymbol(key) && key >= newLength)
        ) {
          run(dep); // 触发 length 依赖 + 迭代依赖 + 被删除索引的依赖
        }
      });
    } else {
      // === 普通属性变化 ===
      if (key !== void 0 || depsMap.has(void 0)) {
        run(depsMap.get(key)); // 触发该 key 的依赖
      }
      if (isArrayIndex) {
        run(depsMap.get(ARRAY_ITERATE_KEY)); // 数组索引变化触发迭代
      }

      // === 根据操作类型触发额外依赖 ===
      switch (type) {
        case TriggerOpTypes.ADD:
          if (!targetIsArray) {
            run(depsMap.get(ITERATE_KEY)); // for...in 依赖
            if (isMap(target)) run(depsMap.get(MAP_KEY_ITERATE_KEY));
          } else if (isArrayIndex) {
            run(depsMap.get("length")); // 新增索引 → length 变化
          }
          break;
        case TriggerOpTypes.DELETE:
          if (!targetIsArray) {
            run(depsMap.get(ITERATE_KEY));
            if (isMap(target)) run(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
          break;
        case TriggerOpTypes.SET:
          if (isMap(target)) run(depsMap.get(ITERATE_KEY));
          break;
      }
    }
  }
  endBatch();
}
```

**trigger 的精细控制**:

- `ADD` 操作 → 触发 `ITERATE_KEY`（for...in 需要重新遍历）
- `DELETE` 操作 → 同上
- 数组新增索引 → 额外触发 `length` 依赖
- 数组 length 缩短 → 触发被删除索引的依赖 + length 依赖

### 4.7 ITERATE_KEY / ARRAY_ITERATE_KEY / MAP_KEY_ITERATE_KEY

```ts
export const ITERATE_KEY = Symbol(); // for...in / Object.keys 的依赖 key
export const MAP_KEY_ITERATE_KEY = Symbol(); // Map.keys() 的依赖 key
export const ARRAY_ITERATE_KEY = Symbol(); // 数组遍历的依赖 key
```

**为什么需要这些特殊 key？**
`for (const key in obj)` 不访问具体属性，而是访问对象的"键集合"。Vue 用 Symbol 作为虚拟 key 来追踪这种"遍历"操作。

---

## 五、effect.ts — 副作用层逐行分析

### 5.1 EffectFlags 位运算

```ts
export enum EffectFlags {
  ACTIVE = 1 << 0, // 0b00000001 = 1   效果是否活跃
  RUNNING = 1 << 1, // 0b00000010 = 2   是否正在执行
  TRACKING = 1 << 2, // 0b00000100 = 4   是否在追踪依赖
  NOTIFIED = 1 << 3, // 0b00001000 = 8   是否已被通知（防重复入队）
  DIRTY = 1 << 4, // 0b00010000 = 16  是否脏了需要重算
  ALLOW_RECURSE = 1 << 5, // 0b00100000 = 32 允许递归
  PAUSED = 1 << 6, // 0b01000000 = 64  是否暂停
  EVALUATED = 1 << 7, // 0b10000000 = 128 是否已计算过
}
```

**位运算的优势**: 一个数字存储 8 个布尔状态，节省内存且位操作极快。

### 5.2 ReactiveEffect 类

```ts
export class ReactiveEffect<T = any> implements Subscriber {
  deps?: Link = undefined; // 依赖链表头
  depsTail?: Link = undefined; // 依赖链表尾
  flags: EffectFlags = ACTIVE | TRACKING;
  scheduler?: EffectScheduler; // 自定义调度器（watch 用）
  cleanup?: () => void; // 清理函数

  constructor(public fn: () => T) {
    if (activeEffectScope && activeEffectScope.active) {
      activeEffectScope.effects.push(this); // 注册到 EffectScope
    }
  }

  // 通知 effect 需要重新执行
  notify(): void {
    if (this.flags & RUNNING && !(flags & ALLOW_RECURSE)) return; // 防止递归
    if (!(this.flags & NOTIFIED)) {
      batch(this); // 加入批量队列
    }
  }

  // 核心：执行 effect 函数
  run(): T {
    if (!(this.flags & ACTIVE)) return this.fn(); // 已停止的 effect 直接执行

    this.flags |= RUNNING;
    cleanupEffect(this); // 执行上次的清理函数
    prepareDeps(this); // 准备依赖追踪（所有 link.version = -1）

    const prevEffect = activeSub;
    const prevShouldTrack = shouldTrack;
    activeSub = this; // ← 设置当前活跃 effect
    shouldTrack = true;

    try {
      return this.fn(); // ← 执行用户函数，期间触发 track()
    } finally {
      cleanupDeps(this); // 清理未使用的依赖（version 仍为 -1 的）
      activeSub = prevEffect; // 恢复之前的 activeSub
      shouldTrack = prevShouldTrack;
      this.flags &= ~RUNNING;
    }
  }

  stop(): void {
    if (this.flags & ACTIVE) {
      for (let link = this.deps; link; link = link.nextDep) {
        removeSub(link); // 从所有 dep 的 subs 链表中移除
      }
      this.deps = this.depsTail = undefined;
      cleanupEffect(this);
      this.onStop && this.onStop();
      this.flags &= ~ACTIVE;
    }
  }

  trigger(): void {
    if (this.flags & PAUSED) {
      pausedQueueEffects.add(this);
    } else if (this.scheduler) {
      this.scheduler(); // 有调度器走调度器（watch 的 flush 控制）
    } else {
      this.runIfDirty(); // 脏检查后执行
    }
  }
}
```

**run() 的执行流程**:

```
1. cleanupEffect → 执行上次的 cleanup 函数（watch 的清理）
2. prepareDeps → 所有已有 link.version = -1（标记为"待验证"）
3. activeSub = this → 设置全局活跃 effect
4. 执行 fn() → 期间访问响应式属性 → 触发 track() → link.version 同步为当前 dep.version
5. cleanupDeps → version 仍为 -1 的 link 说明本轮没访问到，移除
6. 恢复 activeSub（支持嵌套 effect）
```

### 5.3 prepareDeps / cleanupDeps — 依赖的精确管理

```ts
function prepareDeps(sub: Subscriber) {
  for (let link = sub.deps; link; link = link.nextDep) {
    link.version = -1; // 标记为"待验证"
    link.prevActiveLink = link.dep.activeLink; // 保存现场
    link.dep.activeLink = link; // 设置当前 activeLink
  }
}

function cleanupDeps(sub: Subscriber) {
  let tail = sub.depsTail;
  let link = tail;
  while (link) {
    const prev = link.prevDep;
    if (link.version === -1) {
      // 本轮没访问到，移除
      removeSub(link); // 从 dep.subs 移除
      removeDep(link); // 从 sub.deps 移除
    } else {
      head = link; // 保留的最后一个
    }
    link.dep.activeLink = link.prevActiveLink; // 恢复现场
    link.prevActiveLink = undefined;
    link = prev;
  }
  sub.deps = head;
  sub.depsTail = tail;
}
```

**为什么需要这个机制？**

```js
const data = reactive({ a: true, b: 1 });
effect(() => {
  console.log(data.a ? data.b : "no b"); // 第一次访问 a 和 b
});
data.a = false; // 第二次只访问 a，不再访问 b
```

第一次执行: 依赖 [a, b]
第二次执行: 只访问 a，b 的 link.version 保持 -1 → cleanupDeps 移除 b 的依赖

**结果**: effect 不再依赖 b，修改 b 不会触发这个 effect。这就是 Vue 响应式的"精确依赖"。

### 5.4 isDirty — 脏检查

```ts
function isDirty(sub: Subscriber): boolean {
  for (let link = sub.deps; link; link = link.nextDep) {
    if (link.dep.version !== link.version) {
      return true; // dep 版本更新了，说明数据变了
    }
    // computed 的特殊处理：递归检查
    if (
      link.dep.computed &&
      (refreshComputed(link.dep.computed) || link.dep.version !== link.version)
    ) {
      return true;
    }
  }
  return false;
}
```

**版本比较 = 脏检查**: 不需要重新计算就知道数据有没有变，比 Vue 2 的 `Dep.notify()` 遍历所有 watcher 高效得多。

### 5.5 batch / endBatch — 批量执行

```ts
let batchDepth = 0;
let batchedSub: Subscriber | undefined;
let batchedComputed: Subscriber | undefined;

export function batch(sub: Subscriber, isComputed = false): void {
  sub.flags |= NOTIFIED;
  if (isComputed) {
    sub.next = batchedComputed;
    batchedComputed = sub;
    return;
  }
  sub.next = batchedSub;
  batchedSub = sub;
}

export function endBatch(): void {
  if (--batchDepth > 0) return; // 嵌套 batch 不执行

  // 1. 先执行 computed（逆序）
  if (batchedComputed) {
    let e = batchedComputed;
    batchedComputed = undefined;
    while (e) {
      e.flags &= ~NOTIFIED;
      e = e.next;
    }
  }

  // 2. 再执行普通 effect（逆序）
  while (batchedSub) {
    let e = batchedSub;
    batchedSub = undefined;
    while (e) {
      const next = e.next;
      e.flags &= ~NOTIFIED;
      if (e.flags & ACTIVE) {
        (e as ReactiveEffect).trigger();
      }
      e = next;
    }
  }
}
```

**为什么逆序？** 因为链表是 tail→head 遍历，先入队的在链表尾部。逆序执行保证子组件先于父组件更新（与 Vue 2 一致）。

### 5.6 effect() 入口函数

```ts
export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions,
): ReactiveEffectRunner<T> {
  if (fn.effect instanceof ReactiveEffect) {
    fn = fn.effect.fn; // 如果传入的是 runner，提取原始 fn
  }

  const e = new ReactiveEffect(fn);
  if (options) extend(e, options); // 合并 scheduler/onStop 等选项

  try {
    e.run(); // 立即执行一次
  } catch (err) {
    e.stop();
    throw err;
  }

  const runner = e.run.bind(e) as ReactiveEffectRunner;
  runner.effect = e;
  return runner;
}
```

**这就是 `watchEffect` / `computed` / 渲染 effect 的共同基础。**

### 5.7 追踪控制

```ts
export let shouldTrack = true;
const trackStack: boolean[] = [];

export function pauseTracking(): void {
  trackStack.push(shouldTrack);
  shouldTrack = false;
}

export function enableTracking(): void {
  trackStack.push(shouldTrack);
  shouldTrack = true;
}

export function resetTracking(): void {
  const last = trackStack.pop();
  shouldTrack = last === undefined ? true : last;
}
```

**用途**: 在 effect 内部读取响应式数据但不想建立依赖时使用。例如 computed 的 getter 内部某些操作不需要追踪。

---

## 六、ref.ts — 基础包装层

### 6.1 RefImpl 类 — ref 的核心实现

```ts
class RefImpl<T = any> {
  _value: T;
  private _rawValue: T;
  dep: Dep = new Dep(); // ref 有自己的 Dep（不经过 targetMap）

  public readonly [ReactiveFlags.IS_REF] = true;
  public readonly [ReactiveFlags.IS_SHALLOW]: boolean = false;

  constructor(value: T, isShallow: boolean) {
    this._rawValue = isShallow ? value : toRaw(value);
    this._value = isShallow ? value : toReactive(value); // 对象自动 reactive
    this[ReactiveFlags.IS_SHALLOW] = isShallow;
  }

  get value() {
    this.dep.track(); // ← ref 的 track 不经过 targetMap，直接用自身的 dep
    return this._value;
  }

  set value(newValue) {
    const oldValue = this._rawValue;
    const useDirectValue =
      this[IS_SHALLOW] || isShallow(newValue) || isReadonly(newValue);
    newValue = useDirectValue ? newValue : toRaw(newValue);

    if (hasChanged(newValue, oldValue)) {
      this._rawValue = newValue;
      this._value = useDirectValue ? newValue : toReactive(newValue);
      this.dep.trigger(); // ← 触发依赖
    }
  }
}
```

**ref 和 reactive 的区别**:

- `reactive`: 依赖关系存在 `targetMap → target → key → Dep`
- `ref`: 依赖关系存在 `ref.dep`（RefImpl 自己的 Dep 实例）
- ref 更简单，因为只有一个 `.value` 属性

### 6.2 ref 的自动解包

```ts
// reactive 内部: 读取到 ref 属性时自动解包
if (isRef(res)) {
  const value = targetIsArray && isIntegerKey(key) ? res : res.value;
  return value;
}

// template 中: {{ count }} 而不是 {{ count.value }}
// setup 返回: return { count } → template 自动解包
```

**数组不解包**: `reactive([ref(1), ref(2)])` → `arr[0]` 返回 Ref 对象而非 1。这是设计决策，避免数组索引访问的意外行为。

### 6.3 ObjectRefImpl — toRef 的实现

```ts
class ObjectRefImpl<T extends object, K extends keyof T> {
  public readonly [IS_REF] = true;
  public _value: T[K] = undefined!;
  private readonly _raw: T;
  private readonly _key: K;
  private readonly _shallow: boolean;

  constructor(object: T, key: K, defaultValue?: T[K]) {
    this._key = key;
    this._raw = toRaw(object);
    // 判断是否需要 shallow unwrap
    // ...
  }

  get value() {
    let val = this._object[this._key];
    if (this._shallow) val = unref(val);
    return (this._value = val === undefined ? this.defaultValue! : val);
  }

  set value(newVal) {
    this._object[this._key] = newVal; // 写回原对象
  }

  get dep(): Dep | undefined {
    return getDepFromReactive(this._raw, this._key); // 复用原对象的 dep
  }
}
```

**toRef 的精妙**: 它不创建新的 Dep，而是复用原 reactive 对象的 dep。所以 `toRef(state, 'count')` 和直接访问 `state.count` 共享同一个依赖关系。

---

## 七、完整执行流程：从 reactive 到视图更新

### 场景: `const state = reactive({ count: 0 }); state.count++`

```
═══════════════ 阶段 1: 创建响应式对象 ═══════════════
reactive({ count: 0 })
  → createReactiveObject({ count: 0 }, false, mutableHandlers, ..., reactiveMap)
  → getTargetType({ count: 0 }) → COMMON
  → reactiveMap.get({ count: 0 }) → undefined
  → new Proxy({ count: 0 }, mutableHandlers)
  → reactiveMap.set({ count: 0 }, proxy)
  → 返回 proxy

═══════════════ 阶段 2: effect 读取属性（建立依赖） ═══════════════
effect(() => console.log(state.count))
  → new ReactiveEffect(fn)
  → e.run()
    → activeSub = this (ReactiveEffect 实例)
    → 执行 fn() → console.log(state.count)
      → Proxy.get({ count: 0 }, 'count', proxy)
        → Reflect.get({ count: 0 }, 'count', proxy) → 0
        → track({ count: 0 }, GET, 'count')
          → depsMap = targetMap.get({ count: 0 }) → undefined
          → targetMap.set({ count: 0 }, new Map())
          → dep = new Dep()
          → dep.track()
            → link = new Link(activeSub, dep)
            → 加入 dep.subs 链表
            → 加入 activeSub.deps 链表

═══════════════ 阶段 3: 修改属性（触发更新） ═══════════════
state.count++
  → Proxy.set({ count: 0 }, 'count', 1, proxy)
    → oldValue = 0, hadKey = true
    → Reflect.set({ count: 0 }, 'count', 1, proxy) → true
    → hasChanged(1, 0) → true
    → trigger({ count: 0 }, SET, 'count', 1, 0)
      → depsMap = targetMap.get({ count: 0 }) → Map { 'count' → Dep }
      → startBatch()
      → run(depsMap.get('count'))
        → dep.trigger()
          → dep.version++ (0→1)
          → globalVersion++
          → dep.notify()
            → for (link = dep.subs; link; link = link.prevSub)
              → link.sub.notify()  // ReactiveEffect.notify()
                → batch(effect)  // 加入批量队列
            → endBatch()
              → 遍历 batchedSub 链表
              → effect.trigger()
                → effect.runIfDirty()
                  → isDirty(effect) → link.dep.version(1) !== link.version(0) → true
                  → effect.run()
                    → 重新执行 console.log(state.count) → 输出 1
```

---

## 八、Vue 3 vs Vue 2 响应式对比

| 维度          | Vue 2 (Object.defineProperty)              | Vue 3 (Proxy)                                     |
| ------------- | ------------------------------------------ | ------------------------------------------------- |
| 拦截能力      | 只能拦截已有属性的 get/set                 | 可拦截 13 种操作（get/set/delete/has/ownKeys 等） |
| 新增属性      | 需要 `Vue.set`                             | 自动拦截，无需特殊 API                            |
| 删除属性      | 需要 `Vue.delete`                          | 自动拦截                                          |
| 数组索引      | 不支持 `arr[0] = x`                        | 完全支持                                          |
| 数组 length   | 需要重写数组方法                           | 通过 ownKeys + length 特殊处理                    |
| Map/Set       | 不支持                                     | 完全支持（collectionHandlers）                    |
| 性能          | 初始化时递归遍历所有属性定义 getter/setter | 懒代理，访问嵌套对象时才创建 Proxy                |
| 依赖存储      | `Dep` 内部 `Set<Watcher>`                  | 双向链表 `Link`，更高效的增删                     |
| 脏检查        | 无，每次变化通知所有 watcher               | version 比较，精确判断是否需要更新                |
| computed 缓存 | 基于 `dirty` 标志                          | 基于 `globalVersion` 快速路径 + version 比较      |

---

## 九、核心设计模式总结

### 9.1 发布-订阅模式（Dep → Effect）

- Dep = Publisher, Effect = Subscriber
- 多对多关系：一个属性可被多个 effect 依赖，一个 effect 可依赖多个属性

### 9.2 双向链表（Link）

- dep.subs 链表 + sub.deps 链表
- O(1) 的增删操作
- 天然去重（同一 sub 对同一 dep 只有一个 Link）

### 9.3 版本控制（version）

- dep.version 每次 trigger++
- link.version 同步 dep.version
- 比较 version 判断是否脏了，避免不必要的重算

### 9.4 批量更新（batch）

- startBatch/endBatch 嵌套计数
- 同一 tick 内的多次变化只触发一次 effect 执行
- computed 优先于普通 effect 执行

### 9.5 精确依赖（cleanupDeps）

- prepareDeps 标记所有旧依赖为 -1
- 执行后 version 仍为 -1 的说明不再需要，移除
- 保证 effect 只依赖它实际访问的属性

---

## 十、关键文件代码量统计

| 文件            | 行数（约） | 核心职责                           |
| --------------- | ---------- | ---------------------------------- |
| reactive.ts     | ~300       | 入口 API + Proxy 创建              |
| baseHandlers.ts | ~230       | Proxy get/set/delete/has/ownKeys   |
| dep.ts          | ~300       | Dep/Link/track/trigger/targetMap   |
| effect.ts       | ~400       | ReactiveEffect/run/stop/batch/调度 |
| ref.ts          | ~450       | RefImpl/shallowRef/customRef/toRef |
| **总计**        | **~1680**  | **完整的响应式系统**               |

---

## 十一、面试高频考点

1. **Proxy 相比 defineProperty 的优势** — 13 种拦截操作 / 新增属性自动响应 / 支持 Map/Set
2. **track 和 trigger 的调用时机** — get 时 track，set/delete 时 trigger
3. **为什么需要 cleanupDeps** — 条件渲染场景下，effect 的依赖会变化
4. **双向链表相比 Set 的优势** — O(1) 删除 / 天然去重 / 版本控制
5. **ref 和 reactive 的依赖存储区别** — ref 用自身 dep，reactive 用 targetMap
6. **batch 机制如何工作** — startBatch/endBatch 嵌套计数，逆序执行
7. **computed 的缓存原理** — globalVersion 快速路径 + version 脏检查
8. **shallowReactive 和 reactive 的区别** — 只代理第一层 vs 深度代理

---

_分析完成时间: 2026-05-01 04:00_
_源码来源: https://github.com/vuejs/core (main 分支)_
