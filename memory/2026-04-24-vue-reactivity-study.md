# 专项训练 04:00 - Vue 3 响应式系统源码精读

**日期**: 2026-04-24  
**模块**: Vue 3 Reactivity Package  
**重点**: 响应式系统核心原理  
**版本**: Vue 3.5.33

---

## 一、整体架构概览

Vue 3 响应式系统基于 ES6 Proxy 实现，核心文件结构：

```
packages/reactivity/src/
├── reactive.ts      # reactive/readonly/shallowReactive 等 API
├── effect.ts        # ReactiveEffect 类，effect 函数
├── dep.ts           # 依赖收集 (Dep 类，Link 类)
├── baseHandlers.ts  # Proxy 处理器 (get/set/has/deleteProperty)
├── ref.ts           # ref 相关
└── computed.ts      # computed 实现
```

**核心流程**:

```
用户创建 reactive 对象 → Proxy 拦截 → track 收集依赖 → 数据变化 → trigger 触发更新 → effect 重新执行
```

---

## 二、核心模块逐行分析

### 2.1 reactive.ts - 创建响应式代理

#### 关键数据结构

```typescript
// WeakMap 缓存，避免重复创建 Proxy
export const reactiveMap: WeakMap<Target, any> = new WeakMap<Target, any>();
export const shallowReactiveMap: WeakMap<Target, any> = new WeakMap<
  Target,
  any
>();
export const readonlyMap: WeakMap<Target, any> = new WeakMap<Target, any>();
export const shallowReadonlyMap: WeakMap<Target, any> = new WeakMap<
  Target,
  any
>();
```

**设计要点**:

- 使用 `WeakMap` 而非 `Map`：避免内存泄漏（对象被 GC 后自动清理）
- 四个缓存分别对应：reactive / shallowReactive / readonly / shallowReadonly

#### 目标类型判断

```typescript
enum TargetType {
  INVALID = 0,
  COMMON = 1, // Object, Array
  COLLECTION = 2, // Map, Set, WeakMap, WeakSet
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case "Object":
    case "Array":
      return TargetType.COMMON;
    case "Map":
    case "Set":
    case "WeakMap":
    case "WeakSet":
      return TargetType.COLLECTION;
    default:
      return TargetType.INVALID;
  }
}
```

**为什么区分类型**:

- 普通对象和数组使用 `mutableHandlers`
- 集合类型使用 `mutableCollectionHandlers`（需要特殊处理迭代器）

#### createReactiveObject - 核心工厂函数

```typescript
function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>,
) {
  // 1. 非对象直接返回
  if (!isObject(target)) {
    if (__DEV__) {
      warn(
        `value cannot be made ${isReadonly ? "readonly" : "reactive"}: ${String(target)}`,
      );
    }
    return target;
  }

  // 2. 已经是 readonly 的 reactive 对象，直接返回
  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target;
  }

  // 3. 检查是否可观察
  const targetType = getTargetType(target);
  if (targetType === TargetType.INVALID) {
    return target;
  }

  // 4. 检查是否已有对应 Proxy
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }

  // 5. 创建 Proxy
  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers,
  );
  proxyMap.set(target, proxy);
  return proxy;
}
```

**关键检查点解析**:

| 检查                        | 目的                                                  |
| --------------------------- | ----------------------------------------------------- |
| `!isObject(target)`         | 原始值无法代理，直接返回                              |
| `target[ReactiveFlags.RAW]` | 防止对 readonly 再包 reactive 导致死循环              |
| `getTargetType`             | 过滤不可扩展对象、marked raw 的对象                   |
| `proxyMap.get(target)`      | 保证同一对象只创建一个 Proxy（性能优化 + 身份一致性） |

#### ReactiveFlags - 标记常量

```typescript
// 在 constants.ts 中定义
export const enum ReactiveFlags {
  SKIP = "__v_skip", // markRaw 标记
  IS_REACTIVE = "__v_isReactive",
  IS_READONLY = "__v_isReadonly",
  IS_SHALLOW = "__v_isShallow",
  RAW = "__v_raw", // 获取原始对象
}
```

这些标记通过 `def()` 定义为不可枚举属性，在 Proxy 的 `get` 拦截中特殊处理。

---

### 2.2 effect.ts - 副作用与依赖追踪

#### ReactiveEffect 类

```typescript
class ReactiveEffect {
  constructor(fn) {
    this.fn = fn; // 用户传入的副作用函数
    this.deps = void 0; // 依赖链表头
    this.depsTail = void 0; // 依赖链表尾
    this.flags = 1 | 4; // ACTIVE | TRACKING
    this.scheduler = void 0; // 调度器（用于异步更新）

    // 自动注册到当前 effectScope
    if (activeEffectScope && activeEffectScope.active) {
      activeEffectScope.effects.push(this);
    }
  }

  run() {
    if (!(this.flags & 1)) {
      // 非 ACTIVE 状态
      return this.fn();
    }

    this.flags |= 2; // 设置 RUNNING 标志
    cleanupEffect(this); // 清理上一次的 cleanup 回调
    prepareDeps(this); // 准备依赖（将所有 dep 的 version 设为 -1）

    const prevEffect = activeSub;
    const prevShouldTrack = shouldTrack;
    activeSub = this; // 设置当前活跃 effect
    shouldTrack = true;

    try {
      return this.fn(); // 执行用户函数，期间会触发 track
    } finally {
      cleanupDeps(this); // 清理未使用的依赖
      activeSub = prevEffect;
      shouldTrack = prevShouldTrack;
      this.flags &= ~2; // 清除 RUNNING 标志
    }
  }

  stop() {
    if (this.flags & 1) {
      // 移除所有依赖关系
      for (let link = this.deps; link; link = link.nextDep) {
        removeSub(link);
      }
      this.deps = this.depsTail = void 0;
      cleanupEffect(this);
      this.onStop && this.onStop();
      this.flags &= ~1; // 清除 ACTIVE 标志
    }
  }
}
```

**关键机制解析**:

1. **双向链表存储 deps**:
   - `deps` / `depsTail` 形成双向链表
   - 每个 link 连接 effect 和 dep
   - 支持 O(1) 删除任意依赖

2. **flags 位运算优化**:

   ```
   ACTIVE = 1      (0b00000001)
   RUNNING = 2     (0b00000010)
   TRACKING = 4    (0b00000100)
   NOTIFIED = 8    (0b00001000)
   DIRTY = 16      (0b00010000)
   ALLOW_RECURSE = 32
   PAUSED = 64
   EVALUATED = 128
   ```

3. **依赖清理算法** (prepareDeps + cleanupDeps):
   ```
   第一次执行: 收集所有访问的 dep → 建立 link
   第二次执行:
     1. prepareDeps: 将所有旧 dep 的 version 设为 -1
     2. 执行 fn: 访问到的 dep 会更新 version
     3. cleanupDeps: version 仍为 -1 的 dep 被移除（本次未访问）
   ```

#### Dep 类 - 依赖容器

```typescript
class Dep {
  constructor(computed) {
    this.computed = computed;
    this.version = 0; // 版本号，用于 dirty 检查
    this.activeLink = void 0; // 当前活跃 effect 的 link
    this.subs = void 0; // 订阅者链表尾（双向链表）
    this.sc = 0; // subscriber count
  }

  track(debugInfo) {
    if (!activeSub || !shouldTrack) return;

    let link = this.activeLink;
    if (link === void 0 || link.sub !== activeSub) {
      // 新 effect 订阅此 dep
      link = this.activeLink = new Link(activeSub, this);
      // 添加到 effect 的 deps 链表尾部
      if (!activeSub.deps) {
        activeSub.deps = activeSub.depsTail = link;
      } else {
        link.prevDep = activeSub.depsTail;
        activeSub.depsTail.nextDep = link;
        activeSub.depsTail = link;
      }
      addSub(link);
    }
    // ...
  }

  trigger(debugInfo) {
    this.version++; // 版本号递增
    globalVersion++;
    this.notify(debugInfo);
  }

  notify(debugInfo) {
    startBatch();
    try {
      // 通知所有订阅的 effect
      for (let link = this.subs; link; link = link.prevSub) {
        if (link.sub.notify()) {
          link.sub.dep.notify(); // computed 级联触发
        }
      }
    } finally {
      endBatch();
    }
  }
}
```

**Link 类 - 双向连接**:

```typescript
class Link {
  constructor(sub, dep) {
    this.sub = sub; // 指向 effect
    this.dep = dep; // 指向 dep
    this.version = dep.version;
    // 四个指针形成两个双向链表：
    // - nextDep/prevDep: 在 effect 的 deps 链表中
    // - nextSub/prevSub: 在 dep 的 subs 链表中
  }
}
```

**数据结构可视化**:

```
Effect A                          Dep (obj.count)
┌─────────────┐                  ┌─────────────┐
│ deps ───────┼──────────────────┤ subs        │
│ depsTail ───┤                  │ version: 5  │
└─────────────┘                  └─────────────┘
       ▲                                ▲
       │         ┌──────────┐           │
       └─────────┤  Link    ├───────────┘
                 │ sub=A    │
                 │ dep=Dep  │
                 └──────────┘
```

---

### 2.3 baseHandlers.ts - Proxy 拦截器

#### get 拦截 - 依赖收集入口

```typescript
get(target, key, receiver) {
  // 1. 特殊标记直接返回
  if (key === "__v_skip") return target["__v_skip"]
  if (key === "__v_isReactive") return !isReadonly
  if (key === "__v_isReadonly") return isReadonly
  if (key === "__v_isShallow") return isShallow
  if (key === "__v_raw") {
    // 返回原始对象
    return target
  }

  // 2. 数组方法拦截
  if (targetIsArray && (fn = arrayInstrumentations[key])) {
    return fn
  }

  // 3. 获取属性值
  const res = Reflect.get(target, key, receiver)

  // 4. 跳过特殊符号
  if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
    return res
  }

  // 5. 【核心】依赖收集
  if (!isReadonly) {
    track(target, "get", key)
  }

  // 6. shallow 模式直接返回
  if (isShallow) {
    return res
  }

  // 7. ref 自动解包
  if (isRef(res)) {
    return targetIsArray && isIntegerKey(key) ? res : res.value
  }

  // 8. 对象递归 reactive
  if (isObject(res)) {
    return isReadonly ? readonly(res) : reactive(res)
  }

  return res
}
```

#### set 拦截 - 触发更新入口

```typescript
set(target, key, value, receiver) {
  let oldValue = target[key]
  const hadKey = isArray(target) && isIntegerKey(key)
    ? Number(key) < target.length
    : hasOwn(target, key)

  const result = Reflect.set(target, key, value, receiver)

  // 只在目标等于原始对象时触发（避免原型链上的 set）
  if (target === toRaw(receiver)) {
    if (!hadKey) {
      // 新增属性
      trigger(target, "add", key, value)
    } else if (hasChanged(value, oldValue)) {
      // 修改属性
      trigger(target, "set", key, value, oldValue)
    }
  }

  return result
}
```

---

### 2.4 track/trigger - 依赖追踪核心

#### track 函数

```typescript
const targetMap = new WeakMap(); // 全局依赖映射

function track(target, type, key) {
  if (shouldTrack && activeSub) {
    // 1. 获取 target 的 depsMap
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }

    // 2. 获取 key 对应的 dep
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, (dep = new Dep()));
    }

    // 3. 将当前 effect 订阅到 dep
    dep.track();
  }
}
```

**targetMap 结构**:

```
targetMap (WeakMap)
└─> target1 (Object)
    └─> depsMap (Map)
        ├─> "count" → Dep1
        ├─> "name"  → Dep2
        └─> ITERATE_KEY → Dep3 (用于 for...in, Object.keys 等)
```

#### trigger 函数

```typescript
function trigger(target, type, key, newValue, oldValue) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  const run = (dep) => {
    if (dep) {
      dep.trigger(); // version++ 并通知所有 subs
    }
  };

  startBatch();

  if (type === "clear") {
    depsMap.forEach(run);
  } else {
    // 触发对应 key 的 dep
    run(depsMap.get(key));

    // 数组索引变化触发 length 和迭代器依赖
    if (isArray(target) && isIntegerKey(key)) {
      run(depsMap.get(ARRAY_ITERATE_KEY));
    }

    // 根据操作类型触发额外依赖
    switch (type) {
      case "add":
        if (!isArray(target)) {
          run(depsMap.get(ITERATE_KEY));
          if (isMap(target)) {
            run(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        }
        break;
      case "delete":
        if (!isArray(target)) {
          run(depsMap.get(ITERATE_KEY));
        }
        break;
    }
  }

  endBatch();
}
```

---

## 三、关键设计模式分析

### 3.1 懒更新与批量调度

```typescript
let batchDepth = 0;
let batchedSub;

function batch(sub, isComputed = false) {
  sub.flags |= 8; // NOTIFIED
  if (isComputed) {
    sub.next = batchedComputed;
    batchedComputed = sub;
    return;
  }
  sub.next = batchedSub;
  batchedSub = sub;
}

function endBatch() {
  if (--batchDepth > 0) return;

  // 处理 computed
  if (batchedComputed) {
    let e = batchedComputed;
    batchedComputed = void 0;
    while (e) {
      const next = e.next;
      e.next = void 0;
      e.flags &= ~9;
      e = next;
    }
  }

  // 处理 effects
  let error;
  while (batchedSub) {
    let e = batchedSub;
    batchedSub = void 0;
    while (e) {
      const next = e.next;
      e.next = void 0;
      e.flags &= ~9;
      if (e.flags & 1) {
        // ACTIVE
        try {
          e.trigger();
        } catch (err) {
          if (!error) error = err;
        }
      }
      e = next;
    }
  }

  if (error) throw error;
}
```

**批处理机制**:

1. `startBatch()` / `endBatch()` 可嵌套调用
2. 只有最外层 `endBatch()` 才真正执行更新
3. 避免同一轮循环中重复触发

### 3.2 Dirty 检查优化

```typescript
function isDirty(sub) {
  for (let link = sub.deps; link; link = link.nextDep) {
    // dep 版本号变化说明数据被修改
    if (link.dep.version !== link.version) {
      return true;
    }
    // computed 需要额外刷新检查
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

### 3.3 循环依赖处理

```typescript
notify() {
  if (this.flags & 2 && !(this.flags & 32)) {
    // RUNNING 且不允许递归，直接返回
    return
  }
  if (!(this.flags & 8)) {
    // 未通知过，加入批处理队列
    batch(this)
  }
}
```

- `RUNNING` 标志防止执行中再次触发
- `NOTIFIED` 标志避免重复加入队列
- `ALLOW_RECURSE` 选项允许特定场景递归

---

## 四、完整执行流程示例

### 示例代码

```javascript
const state = reactive({ count: 0 });

effect(() => {
  console.log("count:", state.count);
});

state.count++;
```

### 执行流程

```
1. 创建 reactive
   └─> createReactiveObject
       └─> new Proxy(target, mutableHandlers)
       └─> reactiveMap.set(target, proxy)

2. 创建 effect
   └─> new ReactiveEffect(fn)
   └─> effect.run()
       ├─> activeSub = effect
       ├─> 执行 fn: console.log('count:', state.count)
       │   └─> Proxy.get 拦截
       │       ├─> track(target, "get", "count")
       │       │   ├─> depsMap = targetMap.get(target)
       │       │   ├─> dep = depsMap.get("count")
       │       │   └─> dep.track() → 建立 effect ↔ dep 连接
       │       └─> 返回 0
       └─> cleanupDeps(effect)

3. 修改数据
   └─> state.count++
       └─> Proxy.set 拦截
           ├─> Reflect.set(target, "count", 1)
           └─> trigger(target, "set", "count", 1, 0)
               ├─> dep = depsMap.get("count")
               ├─> dep.trigger()
               │   ├─> dep.version++
               │   └─> dep.notify()
               │       └─> effect.notify()
               │           └─> batch(effect)
               └─> endBatch()
                   └─> effect.trigger()
                       └─> effect.run()
                           └─> 重新执行 fn，输出 "count: 1"
```

---

## 五、核心要点总结

### 5.1 数据结构

| 结构             | 用途                     | 存储位置                 |
| ---------------- | ------------------------ | ------------------------ |
| `targetMap`      | 全局依赖映射             | WeakMap<target, depsMap> |
| `depsMap`        | 对象属性到 dep 的映射    | Map<key, dep>            |
| `Dep`            | 依赖容器，存储订阅者     | subs 链表                |
| `Link`           | effect 和 dep 的双向连接 | 两个双向链表节点         |
| `ReactiveEffect` | 副作用函数包装           | deps 链表                |

### 5.2 关键优化

1. **WeakMap 缓存**: 避免内存泄漏
2. **Lazy Proxy**: 只在访问时 track，修改时 trigger
3. **双向链表**: O(1) 添加/删除依赖
4. **版本号机制**: 快速 dirty 检查
5. **批处理**: 避免重复更新
6. **位运算 flags**: 高效状态管理

### 5.3 设计亮点

1. **分离关注点**: reactive / effect / dep 各司其职
2. **惰性求值**: computed 只在需要时重新计算
3. **可组合性**: effectScope 支持组件级清理
4. **类型安全**: 完整的 TypeScript 类型定义

---

## 六、与 React 对比

| 特性     | Vue 3 Reactivity | React                 |
| -------- | ---------------- | --------------------- |
| 更新粒度 | 属性级           | 组件级                |
| 追踪方式 | 运行时 Proxy     | 编译时 + 手动依赖     |
| 状态存储 | 可变对象         | 不可变数据            |
| 依赖收集 | 自动             | 手动 (useEffect deps) |
| 更新触发 | 数据变化自动     | setState 手动         |

---

## 七、学习心得

1. **Proxy 是核心**: 理解 Proxy 的 get/set 拦截是理解 Vue 响应式的关键
2. **双向链表精妙**: effect↔dep 的双向连接支持高效清理
3. **版本号机制**: 简单的 version 比较实现 dirty 检查
4. **批处理重要**: 避免同一 tick 内重复渲染

---

**下次计划**: React 虚拟 DOM 源码分析 (Fiber 架构)
