# 🏗️ 前端架构设计专项训练 — v3 (2026-04-27 18:00)

**主题：** 架构模式深度对比 + 企业级应用架构设计实战  
**前置：** 4/22 基础版 + 4/26 终极整合版  
**本次新增：** BFF 模式、事件驱动架构、架构决策模拟器、完整应用从零设计

---

## 一、架构模式深度对比 — 不只是 MVC/MVVM

### 1.1 九种架构模式全景

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│   模式       │   数据流向    │   复杂度     │   适用规模   │   代表       │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ MVC          │ C→V 单向     │ ★★☆         │ 中小型       │ Backbone     │
│ MVVM         │ 双向绑定      │ ★★☆         │ 中大型       │ Vue          │
│ Flux         │ 单向数据流    │ ★★★         │ 大型         │ Redux        │
│ Clean Arch   │ 依赖倒置      │ ★★★★        │ 企业级       │ 自研         │
│ BFF          │ 网关聚合      │ ★★★         │ 多端         │ GraphQL/Node │
│ Event-Driven │ 事件驱动      │ ★★★★        │ 分布式       │ Kafka/WebSocket│
│ Island       │ 组件级隔离    │ ★★★         │ 内容站       │ Astro        │
│ Micro-FE     │ 多应用路由    │ ★★★★★       │ 超大型       │ qiankun/MF   │
│ Module       │ 模块化单体    │ ★★☆         │ 中小型团队   │ Vite+Monorepo│
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### 1.2 MVC vs MVVM vs Flux — 三种模式代码对比

**场景：** 一个 Todo 列表应用

#### MVC 实现

```typescript
// Model
class TodoModel {
  private todos: Todo[] = []
  private listeners: Function[] = []

  addTodo(text: string) {
    this.todos.push({ id: Date.now(), text, done: false })
    this.notify()
  }

  toggleTodo(id: number) {
    const todo = this.todos.find(t => t.id === id)
    if (todo) todo.done = !todo.done
    this.notify()
  }

  onChange(cb: Function) { this.listeners.push(cb) }
  private notify() { this.listeners.forEach(cb => cb(this.todos)) }
  getTodos() { return [...this.todos] }
}

// View
class TodoView {
  private container: HTMLElement
  private onAction: (action: string, data?: any) => void

  constructor(container: HTMLElement, onAction: Function) {
    this.container = container
    this.onAction = onAction
  }

  render(todos: Todo[]) {
    this.container.innerHTML = `
      <input id="todo-input" placeholder="添加待办" />
      <button id="add-btn">添加</button>
      <ul id="todo-list">
        ${todos.map(t => `
          <li>
            <input type="checkbox" ${t.done ? 'checked' : ''} data-id="${t.id}" />
            <span class="${t.done ? 'done' : ''}">${t.text}</span>
            <button class="delete" data-id="${t.id}">删除</button>
          </li>
        `).join('')}
      </ul>
    `

    // View 只负责渲染，事件委托给 Controller
    this.container.querySelector('#add-btn')?.addEventListener('click', () => {
      const input = this.container.querySelector('#todo-input') as HTMLInputElement
      this.onAction('add', input.value)
      input.value = ''
    })

    this.container.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', () => {
        this.onAction('delete', parseInt(btn.dataset.id!))
      })
    })
  }
}

// Controller
class TodoController {
  private model: TodoModel
  private view: TodoView

  constructor(model: TodoModel, view: TodoView) {
    this.model = model
    this.view = view
    this.model.onChange(todos => this.view.render(todos))
  }

  handleAction(action: string, data?: any) {
    switch (action) {
      case 'add': this.model.addTodo(data); break
      case 'delete': this.model.toggleTodo(data); break // 简化处理
    }
  }
}

// 使用
const model = new TodoModel()
const view = new TodoView(document.getElementById('app')!, (action, data) => controller.handleAction(action, data))
const controller = new TodoController(model, view)
```

**MVC 特点：** 三层职责清晰，但 Controller 需要手动绑定 View 事件，View 变化需要手动调用 render。

#### MVVM 实现 (Vue 3)

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

interface Todo { id: number; text: string; done: boolean }

const todos = ref<Todo[]>([])
const newTodo = ref('')
const remaining = computed(() => todos.value.filter(t => !t.done).length)

function addTodo() {
  if (!newTodo.value.trim()) return
  todos.value.push({ id: Date.now(), text: newTodo.value, done: false })
  newTodo.value = ''
}

function removeTodo(id: number) {
  todos.value = todos.value.filter(t => t.id !== id)
}

function toggleTodo(id: number) {
  const todo = todos.value.find(t => t.id === id)
  if (todo) todo.done = !todo.done
}
</script>

<template>
  <div>
    <input v-model="newTodo" @keyup.enter="addTodo" placeholder="添加待办" />
    <button @click="addTodo">添加</button>
    <p>剩余: {{ remaining }}</p>
    <ul>
      <li v-for="todo in todos" :key="todo.id">
        <input type="checkbox" :checked="todo.done" @change="toggleTodo(todo.id)" />
        <span :class="{ done: todo.done }">{{ todo.text }}</span>
        <button @click="removeTodo(todo.id)">删除</button>
      </li>
    </ul>
  </div>
</template>
```

**MVVM 特点：** 代码量减少 60%，双向绑定自动同步，但数据流向不如 MVC 直观。

#### Flux/Redux 实现

```typescript
// Actions
const ADD_TODO = 'ADD_TODO'
const TOGGLE_TODO = 'TOGGLE_TODO'
const DELETE_TODO = 'DELETE_TODO'

interface AddTodoAction { type: typeof ADD_TODO; payload: { text: string } }
interface ToggleTodoAction { type: typeof TOGGLE_TODO; payload: { id: number } }
interface DeleteTodoAction { type: typeof DELETE_TODO; payload: { id: number } }
type TodoAction = AddTodoAction | ToggleTodoAction | DeleteTodoAction

// Reducer
interface Todo { id: number; text: string; done: boolean }
interface TodoState { todos: Todo[] }

const initialState: TodoState = { todos: [] }

function todoReducer(state = initialState, action: TodoAction): TodoState {
  switch (action.type) {
    case ADD_TODO:
      return {
        ...state,
        todos: [...state.todos, { id: Date.now(), text: action.payload.text, done: false }]
      }
    case TOGGLE_TODO:
      return {
        ...state,
        todos: state.todos.map(t =>
          t.id === action.payload.id ? { ...t, done: !t.done } : t
        )
      }
    case DELETE_TODO:
      return {
        ...state,
        todos: state.todos.filter(t => t.id !== action.payload.id)
      }
    default:
      return state
  }
}

// Store (简化版)
class Store<S, A> {
  private state: S
  private reducer: (state: S, action: A) => S
  private listeners: Function[] = []

  constructor(reducer: (state: S, action: A) => S, initialState: S) {
    this.reducer = reducer
    this.state = initialState
  }

  getState(): S { return this.state }

  dispatch(action: A): void {
    this.state = this.reducer(this.state, action)
    this.listeners.forEach(cb => cb())
  }

  subscribe(cb: Function): () => void {
    this.listeners.push(cb)
    return () => { this.listeners = this.listeners.filter(l => l !== cb) }
  }
}

// 使用
const store = new Store(todoReducer, initialState)

// View 订阅 store 变化
store.subscribe(() => {
  const state = store.getState()
  render(state.todos)
})

// 用户操作 → dispatch action
function handleAdd(text: string) {
  store.dispatch({ type: ADD_TODO, payload: { text } })
}

function handleToggle(id: number) {
  store.dispatch({ type: TOGGLE_TODO, payload: { id } })
}
```

**Flux 特点：** 数据流单向、可预测、可回溯 (Time Travel)，但样板代码多。

### 1.3 三种模式选型决策表

| 维度 | MVC | MVVM | Flux |
|------|-----|------|------|
| **学习曲线** | 低 | 中 | 高 |
| **代码量** | 中 | 少 | 多 |
| **数据可追溯性** | 中 | 低 | 高 |
| **团队协作** | 中 | 中 | 高 |
| **调试难度** | 低 | 高 | 低 (DevTools) |
| **适合场景** | 传统 Web、SSR | SPA、快速开发 | 复杂状态、大型企业应用 |
| **框架代表** | Backbone | Vue/Knockout | React+Redux |

---

## 二、BFF (Backend For Frontend) 模式

### 2.1 什么是 BFF

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│   Web    │    │  Mobile  │    │  Admin   │
│   App    │    │   App    │    │   App    │
└────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │
     ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│  BFF-Web │    │ BFF-Mob  │    │ BFF-Admin│
│ (Node.js)│    │ (Node.js)│    │ (Node.js)│
└────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │
     └───────────────┼───────────────┘
                     ▼
            ┌────────────────┐
            │   API Gateway   │
            │  (Kong/Nginx)   │
            └────────┬───────┘
                     ▼
            ┌────────────────┐
            │  微服务集群      │
            │  User/Order/   │
            │  Product/...   │
            └────────────────┘
```

**BFF 职责：**
1. **数据聚合** — 合并多个微服务响应
2. **格式转换** — 适配前端需要的数据结构
3. **协议转换** — gRPC → REST/GraphQL
4. **缓存** — 热点数据本地缓存
5. **限流/熔断** — 保护后端服务

### 2.2 BFF 实现示例

```typescript
// bff-web/src/aggregation.ts
// 场景：商品详情页需要合并 3 个微服务的数据

interface ProductDetail {
  product: any
  reviews: any[]
  recommendations: any[]
  inventory: any
}

class ProductBFF {
  private productService: ApiService
  private reviewService: ApiService
  private recommendService: ApiService
  private inventoryService: ApiService

  // 聚合接口 — 一次请求获取所有数据
  async getProductDetail(productId: string): Promise<ProductDetail> {
    // 并行请求多个微服务
    const [product, reviews, recommendations, inventory] = await Promise.all([
      this.productService.get(`/products/${productId}`),
      this.reviewService.get(`/reviews?productId=${productId}&limit=10`),
      this.recommendService.get(`/recommendations?productId=${productId}&limit=5`),
      this.inventoryService.get(`/inventory/${productId}`),
    ])

    // 数据聚合 + 格式转换
    return {
      product: {
        id: product.id,
        name: product.name,
        price: this.formatPrice(product.price), // 格式转换
        images: product.images?.slice(0, 5),    // 限制数量
        description: this.sanitize(product.description), // 安全处理
      },
      reviews: reviews.map(r => ({
        id: r.id,
        author: r.user?.name || '匿名用户',
        rating: r.rating,
        content: this.sanitize(r.content),
        createdAt: this.formatDate(r.createdAt),
      })),
      recommendations: recommendations.slice(0, 4),
      inventory: {
        inStock: inventory.stock > 0,
        stockLevel: inventory.stock,
        estimatedDelivery: inventory.stock > 0 ? '1-3 天' : '补货中',
      },
    }
  }

  // 缓存热点数据
  private cache = new Map<string, { data: any; expiry: number }>()

  async getProductDetailWithCache(productId: string): Promise<ProductDetail> {
    const cached = this.cache.get(productId)
    if (cached && cached.expiry > Date.now()) {
      return cached.data
    }

    const data = await this.getProductDetail(productId)
    this.cache.set(productId, { data, expiry: Date.now() + 5 * 60 * 1000 }) // 5 分钟缓存
    return data
  }

  private formatPrice(price: number): string {
    return `¥${(price / 100).toFixed(2)}`
  }

  private sanitize(text: string): string {
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  private formatDate(date: string): string {
    return new Date(date).toLocaleDateString('zh-CN')
  }
}
```

### 2.3 BFF vs 直接调用 vs GraphQL

| 维度 | 直接调用微服务 | BFF | GraphQL |
|------|---------------|-----|---------|
| **前端灵活性** | 低 (固定接口) | 中 (BFF 定义) | 高 (按需查询) |
| **后端复杂度** | 低 | 中 (多一层) | 高 (Schema 维护) |
| **性能** | 多请求 | 聚合 (少请求) | 单次查询 |
| **类型安全** | 中 | 高 | 高 (Schema 驱动) |
| **适合场景** | 单体应用 | 多端应用 | 复杂数据关系 |

---

## 三、事件驱动架构 (Event-Driven Architecture)

### 3.1 前端事件驱动模式

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  事件生产者   │────▶│  事件总线    │────▶│  事件消费者   │
│  (Publisher) │     │  (EventBus) │     │  (Subscriber)│
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                    ┌─────┴─────┐
                    │ 事件存储   │
                    │ (Event    │
                    │  Store)   │
                    └───────────┘
```

### 3.2 生产级事件总线实现

```typescript
// shared/event-bus/src/EventBus.ts

interface EventBusEvent {
  type: string
  payload: any
  metadata: {
    timestamp: number
    source: string
    traceId: string
  }
}

type EventHandler = (event: EventBusEvent) => void | Promise<void>

interface EventBusOptions {
  maxListeners?: number
  enableLogging?: boolean
  enablePersistence?: boolean
}

class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map()
  private wildcards: Map<RegExp, Set<EventHandler>> = new Map()
  private eventHistory: EventBusEvent[] = []
  private options: Required<EventBusOptions>

  constructor(options: EventBusOptions = {}) {
    this.options = {
      maxListeners: 20,
      enableLogging: false,
      enablePersistence: false,
      ...options,
    }
  }

  // 发布事件
  emit(type: string, payload: any, source = 'unknown'): void {
    const event: EventBusEvent = {
      type,
      payload,
      metadata: {
        timestamp: Date.now(),
        source,
        traceId: crypto.randomUUID(),
      },
    }

    // 持久化
    if (this.options.enablePersistence) {
      this.eventHistory.push(event)
      if (this.eventHistory.length > 1000) {
        this.eventHistory = this.eventHistory.slice(-500)
      }
    }

    // 日志
    if (this.options.enableLogging) {
      console.log(`[EventBus] ${type}`, payload)
    }

    // 精确匹配
    const handlers = this.handlers.get(type)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event)
        } catch (e) {
          console.error(`[EventBus] Handler error for ${type}:`, e)
        }
      })
    }

    // 通配符匹配
    this.wildcards.forEach((handlers, pattern) => {
      if (pattern.test(type)) {
        handlers.forEach(handler => {
          try {
            handler(event)
          } catch (e) {
            console.error(`[EventBus] Wildcard handler error:`, e)
          }
        })
      }
    })
  }

  // 订阅 (精确)
  on(type: string, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    const handlers = this.handlers.get(type)!
    if (handlers.size >= this.options.maxListeners) {
      console.warn(`[EventBus] Max listeners (${this.options.maxListeners}) for ${type}`)
    }
    handlers.add(handler)
    return () => handlers.delete(handler)
  }

  // 订阅 (一次性)
  once(type: string, handler: EventHandler): () => void {
    const wrapper = (event: EventBusEvent) => {
      handler(event)
      this.off(type, wrapper)
    }
    return this.on(type, wrapper)
  }

  // 订阅 (通配符)
  onPattern(pattern: string, handler: EventHandler): () => void {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    if (!this.wildcards.has(regex)) {
      this.wildcards.set(regex, new Set())
    }
    this.wildcards.get(regex)!.add(handler)
    return () => {
      const handlers = this.wildcards.get(regex)
      handlers?.delete(handler)
    }
  }

  // 取消订阅
  off(type: string, handler: EventHandler): void {
    this.handlers.get(type)?.delete(handler)
  }

  // 获取事件历史
  getHistory(): EventBusEvent[] {
    return [...this.eventHistory]
  }

  // 清除所有监听
  clear(): void {
    this.handlers.clear()
    this.wildcards.clear()
  }
}

export { EventBus, type EventBusEvent }
```

### 3.3 微前端事件通信实战

```typescript
// shell/src/micro-fe-events.ts
// 主应用与子应用之间的事件通信

import { EventBus } from '@shared/event-bus'

const eventBus = new EventBus({
  enableLogging: true,
  enablePersistence: true,
  maxListeners: 30,
})

// 事件类型定义
export const AppEvents = {
  // 用户相关
  USER_LOGIN: 'user:login',
  USER_LOGOUT: 'user:logout',
  USER_PROFILE_UPDATE: 'user:profile:update',

  // 导航相关
  NAV_CHANGE: 'nav:change',
  NAV_MENU_CLICK: 'nav:menu:click',

  // 业务相关
  DATA_REFRESH: 'data:refresh',
  DATA_EXPORT: 'data:export',
  NOTIFICATION: 'notification:new',

  // 主题相关
  THEME_CHANGE: 'theme:change',
  LOCALE_CHANGE: 'locale:change',

  // 子应用生命周期
  SUB_APP_MOUNTED: 'subapp:mounted',
  SUB_APP_UNMOUNTED: 'subapp:unmounted',
  SUB_APP_ERROR: 'subapp:error',
} as const

// 事件发布工具
export function publishEvent(type: string, payload: any, source: string) {
  eventBus.emit(type, payload, source)
}

// 事件订阅工具
export function subscribeEvent(type: string, handler: (event: any) => void) {
  return eventBus.on(type, handler)
}

// 子应用注册事件
export function registerSubAppEvents(subAppName: string) {
  // 子应用挂载时
  eventBus.on(AppEvents.SUB_APP_MOUNTED, (event) => {
    if (event.payload.appName === subAppName) {
      console.log(`[Events] ${subAppName} 已挂载`)
      // 初始化子应用数据
      eventBus.emit(`${subAppName}:init`, { timestamp: Date.now() }, 'shell')
    }
  })

  // 子应用卸载时
  eventBus.on(AppEvents.SUB_APP_UNMOUNTED, (event) => {
    if (event.payload.appName === subAppName) {
      console.log(`[Events] ${subAppName} 已卸载`)
    }
  })
}

export { eventBus }
```

---

## 四、完整应用架构设计 — 从零开始

### 4.1 项目背景：智能客服平台 (SmartCS)

**业务需求：**
- 多渠道接入 (Web/APP/微信/钉钉)
- AI 智能客服 + 人工客服协同
- 工单管理、知识库、数据分析
- 多租户 SaaS 架构
- 实时聊天 (WebSocket)

**技术指标：**
- 支持 1000+ 并发会话
- 消息延迟 < 200ms
- 首屏加载 < 1.5s
- 可用性 99.9%

### 4.2 架构选型决策 (ADR)

```markdown
## ADR-001: 整体架构风格

**状态：** 已接受  
**上下文：** 多团队 (前端 6 人、后端 8 人)、多渠道接入、需要快速迭代  
**决策：** 微前端 (qiankun) + BFF 模式  
**理由：**
- 前端 6 人分 3 个小组，各自负责不同模块
- Web/APP 需要不同的 BFF 层做数据适配
- 微信/钉钉小程序复用 BFF 层
**权衡：** 增加运维复杂度，但团队自治收益更大
```

```markdown
## ADR-002: 前端框架选型

**状态：** 已接受  
**上下文：** 团队技能混合 (3 人 Vue 熟练、3 人 React 熟练)  
**决策：** Shell (React) + 子应用混合 (Vue3/React)  
**理由：**
- 尊重团队现状，不强制统一技术栈
- qiankun 天然支持多框架
- 共享 UI 组件库抹平框架差异
**权衡：** 共享依赖无法完全去重，但 Bundle 大小可控
```

```markdown
## ADR-003: 实时通信方案

**状态：** 已接受  
**上下文：** 需要支持 1000+ 并发 WebSocket 连接  
**决策：** WebSocket + Redis Pub/Sub + 粘性 Session  
**理由：**
- WebSocket 低延迟 (< 200ms)
- Redis Pub/Sub 支持多实例消息广播
- K8s sticky session 保证连接稳定
**权衡：** 需要管理 WebSocket 连接状态，但实时性最好
```

### 4.3 完整架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CDN / Edge (Cloudflare)                        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                        Nginx / API Gateway                               │
│              (SSL / 路由 / 限流 / 负载均衡)                               │
└────┬──────────────────────────┬──────────────────────────┬──────────────┘
     │                          │                          │
     ▼                          ▼                          ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  BFF-Web     │         │  BFF-Mobile  │         │  BFF-MiniApp │
│  (Node.js)   │         │  (Node.js)   │         │  (Node.js)   │
│  聚合/转换    │         │  聚合/转换    │         │  聚合/转换    │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       └────────────────────────┼────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    API Gateway         │
                    │   (Kong / Express)     │
                    └───────────┬───────────┘
                                │
       ┌────────┬────────┬──────┼──────┬────────┬────────┐
       ▼        ▼        ▼      ▼      ▼        ▼        ▼
   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
   │用户  │ │工单  │ │聊天  │ │知识  │ │数据  │ │AI    │
   │服务  │ │服务  │ │服务  │ │库    │ │分析  │ │服务  │
   └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
      │        │        │        │        │        │
   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
   │MySQL │ │Mongo │ │Redis │ │Mongo │ │Click │ │Python│
   │      │ │DB    │ │      │ │DB    │ │House │ │/LLM  │
   └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          前端层 (qiankun 微前端)                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Shell App (React)                             │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────┐ │  │
│  │  │ 工作台   │  │ 聊天中心 │  │ 工单管理 │  │ 知识库  │  │ 数据  │ │  │
│  │  │(Vue3)   │  │(React)  │  │(Vue3)   │  │(React)  │  │看板   │ │  │
│  │  │         │  │         │  │         │  │         │  │(Vue3) │ │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └───────┘ │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  共享层: @smartcs/ui-kit | @smartcs/request | @smartcs/types | @smartcs/events │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.4 前端目录结构 (Monorepo)

```
smart-cs/
├── package.json                    # Monorepo 根配置
├── turbo.json                      # Turborepo 配置
│
├── shell/                          # 主应用 (React + qiankun)
│   ├── src/
│   │   ├── apps/                   # 子应用注册
│   │   │   ├── registry.ts         # 子应用注册表
│   │   │   └── lifecycle.ts        # 生命周期钩子
│   │   ├── components/             # 共享布局组件
│   │   │   ├── Layout/             # 主布局 (侧边栏+顶栏)
│   │   │   ├── Header/             # 顶栏 (用户+通知+搜索)
│   │   │   ├── Sidebar/            # 侧边栏 (导航菜单)
│   │   │   └── Breadcrumb/         # 面包屑
│   │   ├── hooks/                  # 共享 Hooks
│   │   │   ├── useAuth.ts          # 认证状态
│   │   │   ├── usePermissions.ts   # 权限检查
│   │   │   ├── useTheme.ts         # 主题切换
│   │   │   └── useEventBus.ts      # 事件总线 Hook
│   │   ├── store/                  # 全局状态 (Zustand)
│   │   │   ├── userStore.ts
│   │   │   ├── appStore.ts
│   │   │   └── websocketStore.ts
│   │   ├── utils/                  # 工具函数
│   │   ├── styles/                 # 全局样式
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── apps/
│   ├── workspace/                  # 工作台子应用 (Vue3)
│   │   ├── src/
│   │   │   ├── api/                # API 层
│   │   │   ├── components/         # 模块组件
│   │   │   ├── composables/        # 组合式函数
│   │   │   ├── stores/             # Pinia Store
│   │   │   ├── views/              # 页面
│   │   │   └── main.ts             # qiankun 生命周期
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── chat/                       # 聊天中心子应用 (React)
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   │   ├── ChatWindow/     # 聊天窗口
│   │   │   │   ├── MessageList/    # 消息列表
│   │   │   │   ├── MessageInput/   # 消息输入
│   │   │   │   ├── ContactList/    # 联系人列表
│   │   │   │   └── AIAssistant/    # AI 助手面板
│   │   │   ├── hooks/
│   │   │   │   ├── useWebSocket.ts # WebSocket 连接管理
│   │   │   │   ├── useChat.ts      # 聊天状态管理
│   │   │   │   └── useTyping.ts    # 正在输入指示
│   │   │   ├── stores/             # Zustand Store
│   │   │   ├── pages/
│   │   │   └── main.tsx
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── ticket/                     # 工单管理子应用 (Vue3)
│   │   └── ...
│   │
│   ├── knowledge/                  # 知识库子应用 (React)
│   │   └── ...
│   │
│   └── dashboard/                  # 数据分析看板 (Vue3)
│       └── ...
│
├── packages/                       # 共享包
│   ├── ui-kit/                     # UI 组件库 (框架无关)
│   │   ├── src/
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   ├── Table/
│   │   │   ├── Message/            # 消息提示
│   │   │   └── Avatar/
│   │   └── package.json
│   │
│   ├── request/                    # HTTP 请求库
│   │   ├── src/
│   │   │   ├── client.ts           # 核心客户端
│   │   │   ├── interceptors/       # 拦截器
│   │   │   ├── retry.ts            # 重试策略
│   │   │   └── cache.ts            # 缓存策略
│   │   └── package.json
│   │
│   ├── types/                      # TypeScript 类型定义
│   │   ├── src/
│   │   │   ├── user.ts
│   │   │   ├── ticket.ts
│   │   │   ├── chat.ts
│   │   │   └── common.ts
│   │   └── package.json
│   │
│   ├── events/                     # 事件总线
│   │   ├── src/
│   │   │   ├── EventBus.ts
│   │   │   └── app-events.ts
│   │   └── package.json
│   │
│   └── utils/                      # 工具函数
│       ├── src/
│       │   ├── format.ts           # 格式化
│       │   ├── validate.ts         # 验证
│       │   └── storage.ts          # 本地存储
│       └── package.json
│
├── bff/                            # BFF 层
│   ├── bff-web/                    # Web BFF
│   ├── bff-mobile/                 # Mobile BFF
│   └── bff-miniapp/                # 小程序 BFF
│
├── deployments/                    # 部署配置
│   ├── docker/
│   ├── k8s/
│   └── nginx/
│
└── docs/                           # 文档
    ├── architecture/
    ├── adr/
    └── api/
```

### 4.5 核心模块设计

#### 4.5.1 WebSocket 连接管理

```typescript
// apps/chat/src/hooks/useWebSocket.ts
// 生产级 WebSocket 连接管理

import { useRef, useCallback, useEffect, useState } from 'react'

interface WebSocketMessage {
  type: 'message' | 'typing' | 'read' | 'system' | 'error'
  data: any
  timestamp: number
}

interface UseWebSocketOptions {
  url: string
  token: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  onMessage?: (msg: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: (code: number, reason: string) => void
}

function useWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    token,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    heartbeatInterval = 30000,
    onMessage,
    onConnect,
    onDisconnect,
  } = options

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const heartbeatTimerRef = useRef<number | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

  // 连接
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${url}?token=${token}`)

    ws.onopen = () => {
      console.log('[WebSocket] 连接成功')
      setIsConnected(true)
      reconnectAttemptsRef.current = 0
      onConnect?.()
      startHeartbeat()
    }

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        setLastMessage(message)
        onMessage?.(message)
      } catch (e) {
        console.error('[WebSocket] 消息解析失败:', e)
      }
    }

    ws.onclose = (event) => {
      console.log(`[WebSocket] 连接关闭: ${event.code} ${event.reason}`)
      setIsConnected(false)
      stopHeartbeat()
      onDisconnect?.(event.code, event.reason)
      scheduleReconnect()
    }

    ws.onerror = (error) => {
      console.error('[WebSocket] 连接错误:', error)
    }

    wsRef.current = ws
  }, [url, token])

  // 发送消息
  const send = useCallback((type: string, data: any) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] 连接未就绪，消息发送失败')
      return false
    }
    const message = JSON.stringify({ type, data, timestamp: Date.now() })
    wsRef.current.send(message)
    return true
  }, [])

  // 发送聊天消息
  const sendMessage = useCallback((content: string, replyTo?: string) => {
    return send('message', { content, replyTo })
  }, [send])

  // 发送正在输入状态
  const sendTyping = useCallback(() => {
    return send('typing', {})
  }, [send])

  // 心跳
  const startHeartbeat = useCallback(() => {
    stopHeartbeat()
    heartbeatTimerRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
      }
    }, heartbeatInterval)
  }, [heartbeatInterval])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
  }, [])

  // 重连
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('[WebSocket] 达到最大重连次数，停止重连')
      return
    }

    reconnectAttemptsRef.current++
    const delay = reconnectInterval * Math.min(2 ** (reconnectAttemptsRef.current - 1), 8)
    console.log(`[WebSocket] ${delay}ms 后第 ${reconnectAttemptsRef.current} 次重连...`)

    reconnectTimerRef.current = window.setTimeout(() => {
      connect()
    }, delay)
  }, [connect, reconnectInterval, maxReconnectAttempts])

  // 断开
  const disconnect = useCallback(() => {
    stopHeartbeat()
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close(1000, '手动断开')
      wsRef.current = null
    }
    setIsConnected(false)
  }, [])

  // 清理
  useEffect(() => {
    return () => disconnect()
  }, [disconnect])

  return {
    isConnected,
    lastMessage,
    send,
    sendMessage,
    sendTyping,
    connect,
    disconnect,
    reconnectAttempts: reconnectAttemptsRef.current,
  }
}

export { useWebSocket }
```

#### 4.5.2 聊天状态管理

```typescript
// apps/chat/src/stores/chatStore.ts
// Zustand 聊天状态管理

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Message {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  content: string
  type: 'text' | 'image' | 'file' | 'system'
  timestamp: number
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  replyTo?: string
}

interface Conversation {
  id: string
  title: string
  avatar?: string
  lastMessage?: Message
  unreadCount: number
  isAI: boolean
  status: 'online' | 'offline' | 'busy'
  participants: string[]
}

interface ChatState {
  // 状态
  conversations: Map<string, Conversation>
  messages: Map<string, Message[]>  // conversationId → messages
  activeConversationId: string | null
  typingUsers: Map<string, Set<string>>  // conversationId → user ids
  searchQuery: string

  // 操作
  setActiveConversation: (id: string) => void
  addMessage: (message: Message) => void
  updateMessageStatus: (messageId: string, status: Message['status']) => void
  removeMessage: (messageId: string) => void
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void
  setSearchQuery: (query: string) => void
  markAsRead: (conversationId: string) => void
  clearConversation: (conversationId: string) => void

  // 派生 (通过 selector)
  getActiveMessages: () => Message[]
  getUnreadCount: () => number
  getOnlineConversations: () => Conversation[]
}

const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: new Map(),
      messages: new Map(),
      activeConversationId: null,
      typingUsers: new Map(),
      searchQuery: '',

      setActiveConversation: (id) => set({ activeConversationId: id }),

      addMessage: (message) => set((state) => {
        const msgs = state.messages.get(message.conversationId) || []
        const newMessages = new Map(state.messages)
        newMessages.set(message.conversationId, [...msgs, message])

        // 更新会话最后消息
        const convos = new Map(state.conversations)
        const convo = convos.get(message.conversationId)
        if (convo) {
          convos.set(message.conversationId, {
            ...convo,
            lastMessage: message,
            unreadCount: message.senderId !== 'me' && message.conversationId !== state.activeConversationId
              ? convo.unreadCount + 1
              : convo.unreadCount,
          })
        }

        return { messages: newMessages, conversations: convos }
      }),

      updateMessageStatus: (messageId, status) => set((state) => {
        const newMessages = new Map(state.messages)
        for (const [convId, msgs] of newMessages) {
          const idx = msgs.findIndex(m => m.id === messageId)
          if (idx !== -1) {
            const updated = [...msgs]
            updated[idx] = { ...updated[idx], status }
            newMessages.set(convId, updated)
            break
          }
        }
        return { messages: newMessages }
      }),

      removeMessage: (messageId) => set((state) => {
        const newMessages = new Map(state.messages)
        for (const [convId, msgs] of newMessages) {
          const idx = msgs.findIndex(m => m.id === messageId)
          if (idx !== -1) {
            const updated = msgs.filter((_, i) => i !== idx)
            newMessages.set(convId, updated)
            break
          }
        }
        return { messages: newMessages }
      }),

      addConversation: (conversation) => set((state) => {
        const convos = new Map(state.conversations)
        convos.set(conversation.id, conversation)
        return { conversations: convos }
      }),

      updateConversation: (id, updates) => set((state) => {
        const convos = new Map(state.conversations)
        const convo = convos.get(id)
        if (convo) {
          convos.set(id, { ...convo, ...updates })
        }
        return { conversations: convos }
      }),

      setTyping: (conversationId, userId, isTyping) => set((state) => {
        const typing = new Map(state.typingUsers)
        const users = typing.get(conversationId) || new Set()
        if (isTyping) {
          users.add(userId)
        } else {
          users.delete(userId)
        }
        typing.set(conversationId, users)
        return { typingUsers: typing }
      }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      markAsRead: (conversationId) => set((state) => {
        const convos = new Map(state.conversations)
        const convo = convos.get(conversationId)
        if (convo) {
          convos.set(conversationId, { ...convo, unreadCount: 0 })
        }
        return { conversations: convos }
      }),

      clearConversation: (conversationId) => set((state) => {
        const newMessages = new Map(state.messages)
        newMessages.delete(conversationId)
        return { messages: newMessages }
      }),

      // Selectors
      getActiveMessages: () => {
        const { messages, activeConversationId } = get()
        return activeConversationId ? messages.get(activeConversationId) || [] : []
      },

      getUnreadCount: () => {
        let count = 0
        for (const convo of get().conversations.values()) {
          count += convo.unreadCount
        }
        return count
      },

      getOnlineConversations: () => {
        const result: Conversation[] = []
        for (const convo of get().conversations.values()) {
          if (convo.status === 'online') result.push(convo)
        }
        return result
      },
    }),
    {
      name: 'smartcs-chat-storage',
      partialize: (state) => ({
        // 只持久化会话列表，不持久化消息 (消息从服务器加载)
        conversations: Array.from(state.conversations.entries()),
      }),
    }
  )
)

export { useChatStore }
```

#### 4.5.3 聊天窗口组件 (React)

```tsx
// apps/chat/src/components/ChatWindow/ChatWindow.tsx
// 聊天窗口主组件

import React, { useRef, useEffect, useCallback } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { ContactList } from './ContactList'
import { AIAssistant } from './AIAssistant'

interface ChatWindowProps {
  userId: string
  token: string
  wsUrl: string
}

export function ChatWindow({ userId, token, wsUrl }: ChatWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<number | null>(null)

  const {
    activeConversationId,
    setActiveConversation,
    addMessage,
    sendMessage: storeSendMessage,
    getActiveMessages,
    typingUsers,
    setTyping,
  } = useChatStore()

  // WebSocket 连接
  const { isConnected, sendMessage, sendTyping } = useWebSocket({
    url: wsUrl,
    token,
    onMessage: (msg) => {
      switch (msg.type) {
        case 'message':
          addMessage({
            id: msg.data.id,
            conversationId: msg.data.conversationId,
            senderId: msg.data.senderId,
            senderName: msg.data.senderName,
            content: msg.data.content,
            type: msg.data.type || 'text',
            timestamp: msg.timestamp,
            status: 'delivered',
          })
          break
        case 'typing':
          setTyping(msg.data.conversationId, msg.data.userId, true)
          // 3 秒后清除打字状态
          setTimeout(() => setTyping(msg.data.conversationId, msg.data.userId, false), 3000)
          break
        case 'read':
          // 更新消息已读状态
          break
        case 'system':
          // 系统消息 (加入/离开等)
          break
      }
    },
    onConnect: () => console.log('WebSocket 已连接'),
    onDisconnect: (code, reason) => console.warn(`WebSocket 断开: ${code} ${reason}`),
  })

  // 发送消息
  const handleSend = useCallback((content: string, replyTo?: string) => {
    const tempId = `temp-${Date.now()}`
    const activeId = useChatStore.getState().activeConversationId
    if (!activeId) return

    // 乐观更新
    addMessage({
      id: tempId,
      conversationId: activeId,
      senderId: userId,
      senderName: '我',
      content,
      type: 'text',
      timestamp: Date.now(),
      status: 'sending',
      replyTo,
    })

    // 发送到服务器
    const success = sendMessage('message', { content, replyTo, conversationId: activeId })
    if (success) {
      // 更新状态为已发送
      // (实际应用中通过服务器回执更新)
    }
  }, [userId, sendMessage, addMessage])

  // 输入时发送打字状态
  const handleTyping = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    sendTyping()
    typingTimerRef.current = window.setTimeout(() => {}, 2000) // 防抖
  }, [sendTyping])

  // 自动滚动到底部
  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [getActiveMessages().length])

  const activeMessages = getActiveMessages()
  const isTyping = activeConversationId
    ? typingUsers.get(activeConversationId)?.size ?? 0 > 0
    : false

  return (
    <div className="chat-window">
      {/* 连接状态 */}
      <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? '● 在线' : '○ 离线'}
      </div>

      <div className="chat-layout">
        {/* 左侧联系人列表 */}
        <ContactList
          onSelectConversation={setActiveConversation}
          activeId={activeConversationId}
        />

        {/* 中间聊天区域 */}
        <div className="chat-main">
          {activeConversationId ? (
            <>
              <div className="chat-messages" ref={containerRef}>
                <MessageList messages={activeMessages} />
                {isTyping && <div className="typing-indicator">对方正在输入...</div>}
              </div>
              <MessageInput
                onSend={handleSend}
                onTyping={handleTyping}
                disabled={!isConnected}
              />
            </>
          ) : (
            <div className="chat-empty">
              <p>选择一个对话开始聊天</p>
            </div>
          )}
        </div>

        {/* 右侧 AI 助手 (可选) */}
        <AIAssistant />
      </div>
    </div>
  )
}
```

### 4.6 性能优化策略

#### 4.6.1 消息列表虚拟滚动

```typescript
// apps/chat/src/components/MessageList/virtual-scroll.ts
// 虚拟滚动 — 只渲染可视区域内的消息

interface VirtualScrollConfig {
  containerHeight: number
  itemHeight: number
  bufferSize?: number
}

class VirtualScroll {
  private config: Required<VirtualScrollConfig>
  private scrollTop: number = 0
  private renderRange: { start: number; end: number } = { start: 0, end: 0 }

  constructor(config: VirtualScrollConfig) {
    this.config = {
      bufferSize: 5,
      ...config,
    }
  }

  updateScroll(scrollTop: number, totalItems: number) {
    this.scrollTop = scrollTop
    const { itemHeight, containerHeight, bufferSize } = this.config

    const visibleStart = Math.floor(scrollTop / itemHeight)
    const visibleCount = Math.ceil(containerHeight / itemHeight)

    this.renderRange = {
      start: Math.max(0, visibleStart - bufferSize),
      end: Math.min(totalItems, visibleStart + visibleCount + bufferSize),
    }
  }

  getRenderRange() {
    return { ...this.renderRange }
  }

  getOffset() {
    return this.renderRange.start * this.config.itemHeight
  }

  getTotalHeight(totalItems: number) {
    return totalItems * this.config.itemHeight
  }
}

export { VirtualScroll }
```

#### 4.6.2 消息去重与幂等处理

```typescript
// apps/chat/src/utils/message-dedup.ts
// 消息去重 — 防止 WebSocket 重连导致消息重复

class MessageDeduplicator {
  private seenIds = new Set<string>()
  private maxCacheSize = 5000

  // 检查是否重复
  isDuplicate(messageId: string): boolean {
    return this.seenIds.has(messageId)
  }

  // 添加消息 ID
  add(messageId: string) {
    this.seenIds.add(messageId)
    // 限制缓存大小
    if (this.seenIds.size > this.maxCacheSize) {
      const arr = Array.from(this.seenIds)
      this.seenIds = new Set(arr.slice(-this.maxCacheSize / 2))
    }
  }

  // 处理消息 (去重 + 添加)
  process(messageId: string, handler: () => void): boolean {
    if (this.isDuplicate(messageId)) {
      return false
    }
    this.add(messageId)
    handler()
    return true
  }
}

export { MessageDeduplicator }
```

### 4.7 安全设计

#### 4.7.1 多层安全防护

```typescript
// packages/request/src/security.ts
// 安全中间件 — 多层防护

import DOMPurify from 'dompurify'

// 1. 输入净化
export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'code', 'br'],
    ALLOWED_ATTR: ['href', 'target'],
  })
}

// 2. 消息发送前验证
export function validateMessage(content: string): { valid: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: '消息不能为空' }
  }
  if (content.length > 5000) {
    return { valid: false, error: '消息长度不能超过 5000 字符' }
  }
  // 检查 XSS 特征
  if (/<script|javascript:|on\w+=/i.test(content)) {
    return { valid: false, error: '消息包含不安全内容' }
  }
  return { valid: true }
}

// 3. CSRF Token 管理
export class CSRFManager {
  private token: string | null = null

  async getToken(): Promise<string> {
    if (this.token) return this.token

    const response = await fetch('/api/csrf-token')
    const data = await response.json()
    this.token = data.token
    return this.token
  }

  clearToken() {
    this.token = null
  }
}

// 4. 速率限制
export class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  isAllowed(key: string): boolean {
    const now = Date.now()
    const timestamps = this.requests.get(key) || []
    const recent = timestamps.filter(t => now - t < this.windowMs)

    if (recent.length >= this.maxRequests) {
      return false
    }

    recent.push(now)
    this.requests.set(key, recent)
    return true
  }
}

// 5. 敏感数据脱敏
export function maskSensitive(data: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'creditCard']
  const result = { ...data }

  for (const key of sensitiveKeys) {
    if (result[key]) {
      const value = String(result[key])
      result[key] = value.length > 4
        ? value.slice(0, 2) + '****' + value.slice(-2)
        : '****'
    }
  }

  return result
}
```

### 4.8 监控与可观测性

```typescript
// shared/monitoring/src/monitor.ts
// 前端监控 SDK

interface Metric {
  name: string
  value: number
  tags: Record<string, string>
  timestamp: number
}

interface ErrorReport {
  message: string
  stack?: string
  url: string
  line?: number
  col?: number
  userId?: string
  timestamp: number
}

class Monitor {
  private metrics: Metric[] = []
  private errors: ErrorReport[] = []
  private endpoint: string
  private batchSize: number
  private flushInterval: number

  constructor(options: {
    endpoint: string
    batchSize?: number
    flushInterval?: number
  }) {
    this.endpoint = options.endpoint
    this.batchSize = options.batchSize || 20
    this.flushInterval = options.flushInterval || 30000
    this.initErrorTracking()
    this.initPerformanceTracking()
    this.startFlushTimer()
  }

  // 记录指标
  trackMetric(name: string, value: number, tags: Record<string, string> = {}) {
    this.metrics.push({
      name,
      value,
      tags,
      timestamp: Date.now(),
    })

    if (this.metrics.length >= this.batchSize) {
      this.flushMetrics()
    }
  }

  // 记录错误
  trackError(error: ErrorReport) {
    this.errors.push(error)
    if (this.errors.length >= this.batchSize) {
      this.flushErrors()
    }
  }

  // 初始化错误追踪
  private initErrorTracking() {
    window.onerror = (msg, url, line, col, error) => {
      this.trackError({
        message: String(msg),
        stack: error?.stack,
        url: url || '',
        line,
        col,
        timestamp: Date.now(),
      })
    }

    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        message: `Unhandled Promise: ${event.reason}`,
        url: window.location.href,
        timestamp: Date.now(),
      })
    })
  }

  // 初始化性能追踪
  private initPerformanceTracking() {
    // Web Vitals
    if ('PerformanceObserver' in window) {
      // FCP
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.trackMetric('FCP', entry.startTime, { source: 'paint' })
          }
        }
      })
      paintObserver.observe({ entryTypes: ['paint'] })

      // LCP
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        this.trackMetric('LCP', lastEntry.startTime, { source: 'paint' })
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

      // CLS
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
          }
        }
        this.trackMetric('CLS', clsValue, { source: 'layout' })
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
    }

    // API 请求耗时
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const start = performance.now()
      try {
        const response = await originalFetch(...args)
        const duration = performance.now() - start
        const url = typeof args[0] === 'string' ? args[0] : args[0].url
        this.trackMetric('api_duration', duration, { url, status: String(response.status) })
        return response
      } catch (e) {
        const duration = performance.now() - start
        const url = typeof args[0] === 'string' ? args[0] : args[0].url
        this.trackMetric('api_duration', duration, { url, status: 'error' })
        throw e
      }
    }
  }

  // 定时刷新
  private startFlushTimer() {
    setInterval(() => {
      this.flushMetrics()
      this.flushErrors()
    }, this.flushInterval)
  }

  private async flushMetrics() {
    if (this.metrics.length === 0) return
    const batch = this.metrics.splice(0, this.batchSize)
    try {
      await fetch(`${this.endpoint}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      })
    } catch (e) {
      // 失败不阻塞，数据会在下次 flush 时重试
      this.metrics.unshift(...batch)
    }
  }

  private async flushErrors() {
    if (this.errors.length === 0) return
    const batch = this.errors.splice(0, this.batchSize)
    try {
      await fetch(`${this.endpoint}/errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      })
    } catch (e) {
      this.errors.unshift(...batch)
    }
  }
}

export { Monitor }
```

---

## 五、架构决策模拟器 — 实战练习

### 5.1 场景 1: 电商平台架构选型

**背景：** 年 GMV 50 亿的电商平台，前端团队 12 人，需要支持 Web/APP/小程序/电视端。

**决策点：**

| 决策 | 你的选择 | 推荐方案 |
|------|---------|---------|
| 整体架构 | ? | 微前端 (qiankun) — 12 人分 4 组，各负责一端 |
| Shell 框架 | ? | React — 生态成熟，微前端支持好 |
| 子应用框架 | ? | 各端自选 (Web=React, 小程序=Taro, 电视=React) |
| BFF 层 | ? | 每端一个 BFF，聚合不同数据源 |
| 状态管理 | ? | 各子应用自选 (Zustand/Pinia) |
| 共享层 | ? | Monorepo + 共享 UI 组件库 + 共享类型 |
| SSR | ? | Web 端 SSR (Next.js)，其他端 CSR |
| 部署 | ? | 每端独立部署，CDN 分发 |

### 5.2 场景 2: 内部管理系统架构选型

**背景：** 公司内部运营后台，前端 3 人，后端 5 人，日活 500。

**决策点：**

| 决策 | 你的选择 | 推荐方案 |
|------|---------|---------|
| 整体架构 | ? | 模块化单体 — 3 人团队不需要微前端 |
| 框架 | ? | Vue3 + Element Plus — 快速开发 |
| 状态管理 | ? | Pinia — 轻量够用 |
| SSR | ? | 不需要 — 内部系统无 SEO 需求 |
| 部署 | ? | 单体部署，Nginx 静态资源 |
| 测试 | ? | 核心流程 E2E + 组件单元测试 |

**关键教训：** 架构复杂度应该与团队规模匹配。3 人团队做微前端 = 过度设计。

---

## 六、架构设计 Checklist (完整版)

### 6.1 需求分析阶段

- [ ] 功能性需求完整收集 (CRUD + 特殊操作)
- [ ] 非功能性需求量化 (性能/可用性/安全性)
- [ ] 约束条件明确 (时间/团队/技术栈/预算)
- [ ] 成功指标可测量 (首屏 < Xs, 可用性 > X%)

### 6.2 架构设计阶段

- [ ] 架构风格选择有依据 (不是"别人用所以我也用")
- [ ] 模块边界清晰 (单一职责)
- [ ] 数据流可追溯 (从用户操作到数据存储)
- [ ] 错误处理策略完整 (UI 层/API 层/全局)
- [ ] 安全策略覆盖 (认证/授权/输入验证/XSS/CSRF)
- [ ] 性能预算合理 (Bundle 大小/首屏时间/内存)

### 6.3 工程化阶段

- [ ] 构建工具配置合理 (Vite/Webpack)
- [ ] 代码规范统一 (ESLint/Prettier/Husky)
- [ ] 测试策略完整 (单元/集成/E2E)
- [ ] CI/CD 流水线畅通
- [ ] 监控告警到位 (错误/性能/业务)
- [ ] 文档齐全 (架构/组件/API/部署)

### 6.4 架构反模式检查

- [ ] 无上帝组件 (> 500 行)
- [ ] 无循环依赖
- [ ] 无 Prop Drilling (> 3 层)
- [ ] 无过度抽象 (YAGNI)
- [ ] 无微前端滥用 (团队 < 5 人)
- [ ] 无状态管理过度设计

---

## 七、本次训练总结

### 7.1 新增内容

| 内容 | 说明 |
|------|------|
| **9 种架构模式对比** | 新增 BFF/Event-Driven/Island/Module 模式 |
| **MVC/MVVM/Flux 代码对比** | 同一场景三种实现，直观对比 |
| **BFF 模式** | 完整实现 + 数据聚合 + 缓存 + 与 GraphQL 对比 |
| **事件驱动架构** | 生产级 EventBus + 微前端事件通信 |
| **SmartCS 完整架构** | 从零设计智能客服平台 (WebSocket/聊天/虚拟滚动) |
| **架构决策模拟器** | 两个真实场景的选型练习 |
| **安全多层防护** | 输入净化/速率限制/CSRF/敏感数据脱敏 |
| **监控 SDK** | Web Vitals + API 追踪 + 错误上报 |

### 7.2 与 CloudBoard 架构的对比

| 维度 | CloudBoard | SmartCS |
|------|-----------|---------|
| **架构风格** | 微前端 | 微前端 + BFF |
| **实时通信** | 无 | WebSocket + Redis Pub/Sub |
| **状态管理** | globalState + Pinia/Zustand | Zustand (聊天) + Pinia (其他) |
| **安全** | 四层安全模型 | 五层安全防护 |
| **性能** | 预加载 + 代码分割 | 虚拟滚动 + 消息去重 |
| **监控** | Sentry + Web Vitals | 自研 Monitor SDK |
| **复杂度** | 中高 | 高 (实时通信增加复杂度) |

### 7.3 核心收获

1. **架构没有银弹** — MVC/MVVM/Flux 各有优劣，根据场景选择
2. **BFF 是多端项目的标配** — 数据聚合 + 格式转换 + 缓存
3. **事件驱动解耦微前端** — EventBus 是子应用通信的最佳实践
4. **架构复杂度应与团队规模匹配** — 小团队不要上微前端
5. **安全是架构的一部分** — 不是事后加上去的，是设计时考虑的
6. **监控是架构的眼睛** — 没有监控的架构是在盲飞

---

*文档生成时间: 2026-04-27 18:00 (Asia/Shanghai)*  
*专项训练 18:00 - 架构设计 v3*  
*新增: BFF 模式 + 事件驱动 + 完整应用设计 + 架构决策模拟器*
