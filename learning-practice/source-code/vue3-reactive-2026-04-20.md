# 📖 Vue3 源码精读笔记

**时间：** 2026-04-20 04:50 开始  
**专项：** 源码精读  
**目标：** Vue3 响应式核心模块逐行分析

---

## 源码位置
**文件：** `@vue/reactivity/src/effect.ts`  
**模块：** 响应式系统 - 效果器 (Effect)

---

## 核心代码分析

### 1. Effect 类定义

```typescript
// Vue3 源码简化版
export class ReactiveEffect<T = any> {
  active = true           // 效果器是否激活
  deps: Dep[] = []        // 依赖收集数组
  public computed?: ComputedRefImpl<T>  // 关联的 computed
  
  constructor(
    public fn: () => T,              // 用户传入的函数
    public trigger: () => void,      // 触发函数
    public scheduler?: SchedulerFn   // 调度器（用于异步更新）
  ) {}
  
  run() {
    // 如果效果器未激活，直接执行函数
    if (!this.active) {
      return this.fn()
    }
    
    // 清理旧的依赖
    cleanupEffect(this)
    
    try {
      // 将当前效果器设置为全局变量
      trackEffect(this)
      // 执行用户函数
      return this.fn()
    } finally {
      // 恢复之前的效果器
      resetTracking()
    }
  }
  
  stop() {
    if (this.active) {
      // 清理所有依赖
      cleanupEffect(this)
      this.active = false
    }
  }
}
```

### 关键理解

#### 1.1 为什么需要 deps 数组？
```javascript
// deps 存储了这个 effect 依赖的所有响应式属性
// 当这些属性变化时，可以从 deps 中找到并触发这个 effect

// 示例：
// effect(() => {
//   console.log(obj.a + obj.b)  // 依赖 obj.a 和 obj.b
// })
// 
// ReactiveEffect.deps = [
//   dep_for_obj_a,  // obj.a 的依赖集合
//   dep_for_obj_b   // obj.b 的依赖集合
// ]
```

#### 1.2 run 方法执行流程
```
1. 检查 active 状态
2. 清理旧依赖（防止内存泄漏）
3. 将当前 effect 设为全局（用于依赖收集）
4. 执行用户函数（触发 getter，收集依赖）
5. 恢复全局状态
```

---

### 2. 依赖收集 (track)

```typescript
// 全局变量：当前正在运行的 effect
let activeEffect: ReactiveEffect | undefined

// trackEffect - 将当前 effect 添加到目标的依赖中
export function trackEffect(effect: ReactiveEffect) {
  // 获取当前正在访问的目标对象和键
  const target = getTrackingTarget()
  const key = getTrackingKey()
  
  // 获取或创建这个属性的依赖集合
  let dep = getDep(target, key)
  
  // 将当前 effect 添加到依赖集合
  dep.add(effect)
  
  // 将依赖集合添加到 effect 的 deps 数组
  effect.deps.push(dep)
}

// 使用示例
const obj = reactive({ count: 0 })

effect(() => {
  console.log(obj.count)  // 这里会触发 track
  // 1. 访问 obj.count 触发 getter
  // 2. getter 中调用 track(obj, 'count')
  // 3. track 将当前 effect 添加到 obj.count 的 dep 中
})
```

---

### 3. 触发更新 (trigger)

```typescript
// trigger - 当响应式数据变化时触发
export function triggerEffect(dep: Dep) {
  // 遍历依赖集合中的所有 effect
  dep.forEach(effect => {
    if (effect.scheduler) {
      // 有调度器则使用调度器（异步更新）
      effect.scheduler()
    } else {
      // 否则直接运行
      effect.run()
    }
  })
}

// 使用示例
obj.count++  // 触发 setter
// 1. setter 中调用 trigger(obj, 'count')
// 2. trigger 找到 obj.count 的 dep
// 3. 遍历 dep 中的所有 effect 并执行
// 4. 所有依赖 obj.count 的 effect 都会重新运行
```

---

### 4. 完整流程示例

```javascript
// ============ 简化版 Vue3 响应式实现 ============

// 全局变量
let activeEffect = null
const targetMap = new WeakMap()

// ReactiveEffect 类
class ReactiveEffect {
  constructor(fn) {
    this.fn = fn
    this.deps = []
    this.active = true
  }
  
  run() {
    if (!this.active) return this.fn()
    
    // 清理旧依赖
    this.deps.forEach(dep => dep.delete(this))
    this.deps.length = 0
    
    // 设置全局当前 effect
    activeEffect = this
    try {
      return this.fn()
    } finally {
      activeEffect = null
    }
  }
  
  stop() {
    this.active = false
  }
}

// track - 依赖收集
function track(target, key) {
  if (!activeEffect) return
  
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }
  
  let dep = depsMap.get(key)
  if (!dep) {
    dep = new Set()
    depsMap.set(key, dep)
  }
  
  dep.add(activeEffect)
  activeEffect.deps.push(dep)
}

// trigger - 触发更新
function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  
  const dep = depsMap.get(key)
  if (!dep) return
  
  dep.forEach(effect => {
    if (effect.active) {
      effect.run()
    }
  })
}

// reactive - 创建响应式对象
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key)
      return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver)
      trigger(target, key)
      return result
    }
  })
}

// effect - 创建效果器
function effect(fn) {
  const e = new ReactiveEffect(fn)
  e.run()
  return e
}

// ============ 使用示例 ============

const state = reactive({ count: 0 })

effect(() => {
  console.log(`count is: ${state.count}`)
})
// 输出：count is: 0

state.count++
// 输出：count is: 1

state.count++
// 输出：count is: 2
```

---

## 📊 源码精读总结

### 核心概念理解

| 概念 | 作用 | 关键代码 |
|------|------|---------|
| ReactiveEffect | 包装用户函数，管理依赖 | `class ReactiveEffect` |
| track | 依赖收集 | `dep.add(activeEffect)` |
| trigger | 触发更新 | `dep.forEach(effect => effect.run())` |
| activeEffect | 全局当前 effect | 用于依赖收集时关联 |
| deps | 依赖集合 | `effect.deps = []` |

### 执行流程
```
1. effect(fn) 创建 ReactiveEffect
2. 执行 effect.run()
3. run 中设置 activeEffect = this
4. 执行 fn()，访问响应式数据
5. getter 中调用 track()
6. track 将 activeEffect 添加到 dep
7. 数据变化时，setter 调用 trigger()
8. trigger 遍历 dep 中的所有 effect 并执行 run()
```

---

**学习时间：** 04:50 - 05:35 (45 分钟)  
**源码行数：** 分析约 200 行  
**笔记字数：** 约 2000 字

---

*下一专项：05:35 性能优化*
