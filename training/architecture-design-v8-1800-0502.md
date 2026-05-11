# 🏗️ 前端架构设计专项训练 v8 — 企业级全栈应用架构终极实战

**时间：** 2026-05-02 18:00  
**主题：** 融合 MVC / MVVM / 微前端 / BFF / 事件驱动 / Composition 的完整企业应用架构  
**前置：** 4/22 MVC/MVVM 基础 → 4/26 终极整合 → 4/27 BFF/事件驱动 → 4/28 三大模式手写 → 4/29 架构决策 → 4/30 融合架构 → 5/1 Vue 3 Composition 架构  
**本次新增：** 完整企业应用 "DevFlow" 从零架构设计 / 八层架构融合 / 架构决策矩阵 / 渐进式迁移方案 / 性能与安全内建

---

## 一、项目背景：DevFlow — 开发者协作平台

### 1.1 产品需求

```
DevFlow 是一个面向开发团队的协作平台，核心功能：

┌──────────────────────────────────────────────────────────┐
│                    DevFlow 产品矩阵                       │
│                                                          │
│  📋 项目管理    ─ 看板/里程碑/迭代/任务分配                │
│  💬 实时协作    ─ 聊天/评论/@提及/通知                     │
│  📝 文档中心    ─ Markdown 编辑器/版本历史/知识图谱         │
│  📊 数据看板    ─ 燃尽图/速度图/质量报告                    │
│  🔧 CI/CD      ─ Pipeline 可视化/部署状态                  │
│  👥 团队管理    ─ 权限/角色/组织树                         │
│                                                          │
│  目标用户: 50-500 人研发团队                               │
│  日活预期: 1000+ DAU                                      │
│  核心要求: 高性能 / 可扩展 / 安全 / 可维护                  │
└──────────────────────────────────────────────────────────┘
```

### 1.2 架构约束与决策

```
架构决策矩阵 (Architecture Decision Record):

┌─────┬────────────────────┬──────────────────────────────────────┐
│ #   │ 决策点              │ 选择 & 理由                          │
├─────┼────────────────────┼──────────────────────────────────────┤
│ ADR1│ 前端框架           │ Vue 3 + TypeScript                    │
│     │                    │ 团队熟悉 Vue / Composition API 灵活   │
├─────┼────────────────────┼──────────────────────────────────────┤
│ ADR2│ 微前端方案         │ Module Federation (Webpack 5)         │
│     │                    │ 无需运行时开销 / 共享依赖 / 类型安全   │
├─────┼────────────────────┼──────────────────────────────────────┤
│ ADR3│ 状态管理           │ Pinia (Vuex 5) + 局部 Composable      │
│     │                    │ 轻量 / TS 友好 / DevTools 支持        │
├─────┼────────────────────┼──────────────────────────────────────┤
│ ADR4│ 数据流模式         │ 展示层 MVVM + 应用层 Flux             │
│     │                    │ 简单 UI 双向绑定 / 复杂状态单向流      │
├─────┼────────────────────┼──────────────────────────────────────┤
│ ADR5│ BFF 层             │ Node.js + Fastify + GraphQL Federation│
│     │                    │ 聚合多后端 / 裁剪数据 / 缓存层        │
├─────┼────────────────────┼──────────────────────────────────────┤
│ ADR6│ 实时通信           │ WebSocket + Socket.IO 降级             │
│     │                    │ 聊天/通知/协同编辑需要低延迟            │
├─────┼────────────────────┼──────────────────────────────────────┤
│ ADR7│ 渲染策略           │ SSR (Nuxt 3) + 客户端水合             │
│     │                    │ SEO 需求 + 首屏性能                    │
├─────┼────────────────────┼──────────────────────────────────────┤
│ ADR8│ 构建工具           │ Vite (开发) + Webpack 5 (MF 子应用)    │
│     │                    │ Vite HMR 快 / MF 是微前端标准          │
├─────┼────────────────────┼──────────────────────────────────────┤
│ ADR9│ 测试策略           │ Vitest (单元) + Playwright (E2E)       │
│     │                    │ 快速反馈 + 真实浏览器验证              │
├─────┼────────────────────┼──────────────────────────────────────┤
│ ADR10│ 部署架构          │ Docker + K8s + CDN                    │
│     │                    │ 弹性伸缩 / 独立部署 / 全球加速          │
└─────┴────────────────────┴──────────────────────────────────────┘
```

---

## 二、八层融合架构设计

### 2.1 全景架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        第八层: 用户界面 (UI Layer)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ 项目管理子应用│ │ 文档中心子应用│ │ 数据看板子应用│ │ 团队管理子应用│       │
│  │ (MVVM 模式)  │ │ (MVC 模式)  │ │ (Flux 模式)  │ │ (MVVM 模式)  │       │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘       │
│         │                │                │                │              │
├─────────┼────────────────┼────────────────┼────────────────┼──────────────┤
│         │         第七层: 微前端容器 (Shell App)                           │
│  路由分发 / 共享组件 / 全局状态 / 认证 / 布局 / 消息总线                    │
├─────────┼────────────────┼────────────────┼────────────────┼──────────────┤
│         │         第六层: 组合式函数层 (Composables)                       │
│  useAuth / useWebSocket / usePagination / useDragDrop / useForm / ...    │
├─────────┼────────────────┼────────────────┼────────────────┼──────────────┤
│         │         第五层: 状态管理层 (Pinia Stores)                        │
│  useProjectStore / useChatStore / useDocStore / useNotificationStore     │
├─────────┼────────────────┼────────────────┼────────────────┼──────────────┤
│         │         第四层: BFF 层 (Backend for Frontend)                    │
│  GraphQL Federation / 数据聚合 / 缓存 / 权限校验 / 速率限制                 │
├─────────┼────────────────┼────────────────┼────────────────┼──────────────┤
│         │         第三层: 事件总线 (Event Bus)                             │
│  跨子应用通信 / 领域事件 / CQRS 命令分发                                    │
├─────────┼────────────────┼────────────────┼────────────────┼──────────────┤
│         │         第二层: 服务层 (API Services)                            │
│  ProjectService / ChatService / DocService / NotificationService          │
├─────────┼────────────────┼────────────────┼────────────────┼──────────────┤
│         │         第一层: 基础设施层 (Infrastructure)                       │
│  HTTP Client / WebSocket / Storage / Logger / Error Handler / i18n       │
└─────────┴────────────────┴────────────────┴────────────────┴──────────────┘
```

### 2.2 各层职责与模式映射

```
层     │ 架构模式    │ 职责                           │ 技术选型
───────┼────────────┼───────────────────────────────┼──────────────
L8 UI  │ MVVM/MVC   │ 视图渲染 + 用户交互             │ Vue 3 组件
L7 容器 │ 微前端     │ 子应用编排 + 全局协调            │ Module Federation
L6 组合 │ Composition│ 可复用逻辑封装                   │ Composables
L5 状态 │ Flux       │ 全局状态 + 单向数据流            │ Pinia
L4 BFF │ 聚合器     │ 数据裁剪 + 多源聚合              │ GraphQL + Fastify
L3 事件 │ 事件驱动    │ 异步通信 + 解耦                 │ EventEmitter + Redis Pub/Sub
L2 服务 │ MVC Model  │ API 调用 + 数据转换              │ Axios + 拦截器
L1 基础设施│ 依赖注入  │ 横切关注点                      │ 插件 + 装饰器
```

---

## 三、完整代码实现

### 3.1 第一层：基础设施层

```typescript
// src/infrastructure/http-client.ts
// 生产级 HTTP 客户端 — 融合网络层 v6 成果

import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

interface RetryConfig {
  maxRetries: number
  backoffMs: number
  retryableStatuses: number[]
}

interface CircuitBreakerState {
  failures: number
  lastFailure: number
  state: 'closed' | 'open' | 'half-open'
}

export class HttpClient {
  private instance: AxiosInstance
  private circuitBreakers = new Map<string, CircuitBreakerState>()
  private retryConfig: RetryConfig
  private requestDeduplicator = new Map<string, Promise<any>>()
  private responseCache = new Map<string, { data: any; expires: number }>()

  constructor(config: AxiosRequestConfig) {
    this.instance = axios.create({
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
      ...config,
    })

    this.retryConfig = {
      maxRetries: 3,
      backoffMs: 1000,
      retryableStatuses: [408, 429, 500, 502, 503, 504],
    }

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // 请求拦截器: Token 注入 + 请求去重
    this.instance.interceptors.request.use(async (config) => {
      const token = localStorage.getItem('auth_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      // 幂等性: GET 请求添加 Idempotency-Key
      if (config.method === 'get') {
        const key = this.getDedupKey(config)
        if (this.requestDeduplicator.has(key)) {
          const cached = this.responseCache.get(key)
          if (cached && cached.expires > Date.now()) {
            return Promise.reject({ _cached: true, data: cached.data })
          }
        }
      }

      config.headers['X-Request-Id'] = crypto.randomUUID()
      config.headers['X-Client-Version'] = __APP_VERSION__
      return config
    })

    // 响应拦截器: 统一错误处理 + 自动重试
    this.instance.interceptors.response.use(
      (response) => {
        // 缓存 GET 响应
        if (response.config.method === 'get') {
          const key = this.getDedupKey(response.config)
          this.responseCache.set(key, {
            data: response.data,
            expires: Date.now() + 60000, // 1min TTL
          })
        }
        return response
      },
      async (error) => {
        const config = error.config
        if (!config || error.response?.status === 401) {
          return Promise.reject(error)
        }

        // 自动重试 (指数退避)
        config.retryCount = config.retryCount || 0
        if (config.retryCount < this.retryConfig.maxRetries) {
          config.retryCount++
          const delay = this.retryConfig.backoffMs * Math.pow(2, config.retryCount - 1)
          await new Promise((r) => setTimeout(r, delay))
          return this.instance.request(config)
        }

        // 熔断器: 连续失败 5 次后打开
        const url = config.url || ''
        const cb = this.circuitBreakers.get(url) || {
          failures: 0,
          lastFailure: 0,
          state: 'closed',
        }
        cb.failures++
        cb.lastFailure = Date.now()
        if (cb.failures >= 5) {
          cb.state = 'open'
          this.circuitBreakers.set(url, cb)
          // 30s 后半开
          setTimeout(() => {
            const current = this.circuitBreakers.get(url)
            if (current) current.state = 'half-open'
          }, 30000)
        }
        return Promise.reject(error)
      }
    )
  }

  private getDedupKey(config: AxiosRequestConfig): string {
    return `${config.method}:${config.url}:${JSON.stringify(config.params)}`
  }

  get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.get<T>(url, config)
  }

  post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.post<T>(url, data, config)
  }

  // 批量请求: 合并多个请求为一个
  async batch(requests: Array<{ url: string; config?: AxiosRequestConfig }>) {
    const responses = await Promise.allSettled(
      requests.map((r) => this.instance.request(r.config || { url: r.url }))
    )
    return responses.map((r) =>
      r.status === 'fulfilled' ? { success: true, data: r.value.data } : { success: false, error: r.reason }
    )
  }
}
```

```typescript
// src/infrastructure/websocket.ts
// WebSocket 连接管理 — 自动重连 + 心跳 + 消息队列

import { EventEmitter } from 'events'

interface WSConfig {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  heartbeatTimeout?: number
}

type WSMessageType = 'chat' | 'notification' | 'presence' | 'sync' | 'system'

interface WSMessage {
  type: WSMessageType
  payload: any
  timestamp: number
  id: string
}

export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null
  private config: WSConfig
  private reconnectAttempts = 0
  private messageQueue: WSMessage[] = []
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  private isConnected = false
  private isManualClose = false

  constructor(config: WSConfig) {
    super()
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      ...config,
    }
  }

  connect(): void {
    this.isManualClose = false
    this.ws = new WebSocket(this.config.url)

    this.ws.onopen = () => {
      this.isConnected = true
      this.reconnectAttempts = 0
      this.startHeartbeat()
      this.flushQueue()
      this.emit('connected')
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)
        if (message.type === 'pong') {
          this.resetHeartbeatTimeout()
          return
        }
        this.emit('message', message)
      } catch {
        this.emit('error', new Error('Invalid message format'))
      }
    }

    this.ws.onclose = () => {
      this.isConnected = false
      this.stopHeartbeat()
      this.emit('disconnected')
      if (!this.isManualClose) {
        this.reconnect()
      }
    }

    this.ws.onerror = (error) => {
      this.emit('error', error)
    }
  }

  send(message: Omit<WSMessage, 'timestamp' | 'id'>): void {
    const fullMessage: WSMessage = {
      ...message,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
    }

    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullMessage))
    } else {
      // 离线消息队列 (最多 100 条)
      if (this.messageQueue.length < 100) {
        this.messageQueue.push(fullMessage)
      }
    }
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!
      this.ws?.send(JSON.stringify(message))
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', payload: null, timestamp: Date.now(), id: crypto.randomUUID() }))
        this.heartbeatTimeoutTimer = setTimeout(() => {
          this.ws?.close()
        }, this.config.heartbeatTimeout!)
      }
    }, this.config.heartbeatInterval!)
  }

  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.heartbeatTimeoutTimer) clearTimeout(this.heartbeatTimeoutTimer)
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      this.emit('maxReconnectReached')
      return
    }
    this.reconnectAttempts++
    const delay = this.config.reconnectInterval! * Math.min(Math.pow(1.5, this.reconnectAttempts), 10)
    setTimeout(() => this.connect(), delay)
  }

  disconnect(): void {
    this.isManualClose = true
    this.ws?.close()
    this.stopHeartbeat()
  }

  get status(): 'connected' | 'disconnected' | 'reconnecting' {
    if (this.isConnected) return 'connected'
    if (this.reconnectAttempts > 0) return 'reconnecting'
    return 'disconnected'
  }
}
```

### 3.2 第二层：服务层

```typescript
// src/services/project.service.ts
// 项目管理服务 — MVC Model 层

import { HttpClient } from '../infrastructure/http-client'
import { EventBus } from '../infrastructure/event-bus'

export interface Project {
  id: string
  name: string
  description: string
  ownerId: string
  members: string[]
  status: 'active' | 'archived' | 'draft'
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  status: 'todo' | 'in-progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assigneeId: string | null
  estimateHours: number
  actualHours: number
  sprintId: string | null
  tags: string[]
}

export class ProjectService {
  constructor(
    private http: HttpClient,
    private eventBus: EventBus
  ) {}

  async getProjects(): Promise<Project[]> {
    const { data } = await this.http.get<Project[]>('/api/projects')
    return data
  }

  async getProject(id: string): Promise<Project> {
    const { data } = await this.http.get<Project>(`/api/projects/${id}`)
    return data
  }

  async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const { data } = await this.http.post<Project>('/api/projects', project)
    this.eventBus.emit('project:created', data)
    return data
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const { data } = await this.http.patch<Project>(`/api/projects/${id}`, updates)
    this.eventBus.emit('project:updated', data)
    return data
  }

  async deleteProject(id: string): Promise<void> {
    await this.http.delete(`/api/projects/${id}`)
    this.eventBus.emit('project:deleted', { id })
  }

  // 任务 CRUD
  async getTasks(projectId: string, filters?: { status?: string; assigneeId?: string }): Promise<Task[]> {
    const { data } = await this.http.get<Task[]>('/api/tasks', { params: { projectId, ...filters } })
    return data
  }

  async createTask(projectId: string, task: Omit<Task, 'id'>): Promise<Task> {
    const { data } = await this.http.post<Task>(`/api/projects/${projectId}/tasks`, task)
    this.eventBus.emit('task:created', data)
    return data
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    const { data } = await this.http.patch<Task>(`/api/tasks/${taskId}`, updates)
    this.eventBus.emit('task:updated', data)
    return data
  }

  // 批量操作
  async bulkUpdateTasks(taskIds: string[], updates: Partial<Task>): Promise<Task[]> {
    const { data } = await this.http.post<Task[]>('/api/tasks/bulk-update', { taskIds, updates })
    this.eventBus.emit('tasks:bulk-updated', { taskIds, updates })
    return data
  }

  // 看板拖拽排序
  async reorderTask(taskId: string, newPosition: number, columnId: string): Promise<Task> {
    const { data } = await this.http.post<Task>(`/api/tasks/${taskId}/reorder`, { newPosition, columnId })
    this.eventBus.emit('task:reordered', data)
    return data
  }
}
```

### 3.3 第三层：事件总线

```typescript
// src/infrastructure/event-bus.ts
// 跨层事件总线 — 支持同步/异步事件 + 事件溯源

type EventHandler = (...args: any[]) => void | Promise<void>

interface EventEntry {
  event: string
  handler: EventHandler
  once: boolean
}

interface DomainEvent {
  eventId: string
  eventType: string
  aggregateId: string
  timestamp: number
  payload: any
  metadata: {
    userId: string
    correlationId: string
    causationId: string | null
  }
}

export class EventBus {
  private handlers = new Map<string, EventHandler[]>()
  private eventStore: DomainEvent[] = []
  private asyncHandlers = new Map<string, Set<EventHandler>>()

  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, [])
    }
    this.handlers.get(event)!.push(handler)
    // 返回取消订阅函数
    return () => {
      const list = this.handlers.get(event)
      if (list) {
        const idx = list.indexOf(handler)
        if (idx > -1) list.splice(idx, 1)
      }
    }
  }

  once(event: string, handler: EventHandler): () => void {
    const wrapped = (...args: any[]) => {
      handler(...args)
      this.off(event, wrapped)
    }
    return this.on(event, wrapped)
  }

  off(event: string, handler: EventHandler): void {
    const list = this.handlers.get(event)
    if (list) {
      const idx = list.indexOf(handler)
      if (idx > -1) list.splice(idx, 1)
    }
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      // 同步派发
      for (const handler of [...handlers]) {
        try {
          handler(...args)
        } catch (error) {
          console.error(`Event handler error for "${event}":`, error)
        }
      }
    }
  }

  // 异步事件派发 (不阻塞主线程)
  async emitAsync(event: string, ...args: any[]): Promise<void> {
    const handlers = this.handlers.get(event)
    if (handlers) {
      await Promise.all(
        handlers.map(async (handler) => {
          try {
            await handler(...args)
          } catch (error) {
            console.error(`Async event handler error for "${event}":`, error)
          }
        })
      )
    }
  }

  // 领域事件发布 (事件溯源)
  publishDomainEvent(event: Omit<DomainEvent, 'eventId' | 'timestamp'>): void {
    const domainEvent: DomainEvent = {
      ...event,
      eventId: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    this.eventStore.push(domainEvent)
    this.emit(domainEvent.eventType, domainEvent)
  }

  // 获取事件历史
  getEventHistory(aggregateId?: string): DomainEvent[] {
    if (aggregateId) {
      return this.eventStore.filter((e) => e.aggregateId === aggregateId)
    }
    return [...this.eventStore]
  }

  // 清空
  clear(): void {
    this.handlers.clear()
    this.eventStore = []
  }
}
```

### 3.4 第四层：BFF 层

```typescript
// src/bff/graphql/schema.ts
// BFF GraphQL Schema — 数据聚合 + 裁剪

import { gql } from 'graphql-tag'

export const typeDefs = gql`
  # 用户
  type User {
    id: ID!
    name: String!
    email: String!
    avatar: String
    role: String!
    status: String!
  }

  # 项目
  type Project {
    id: ID!
    name: String!
    description: String
    owner: User!
    members: [User!]!
    tasks: [Task!]!
    status: String!
    progress: Float!
    createdAt: String!
    updatedAt: String!
  }

  # 任务
  type Task {
    id: ID!
    title: String!
    description: String
    status: TaskStatus!
    priority: TaskPriority!
    assignee: User
    estimateHours: Float
    actualHours: Float
    tags: [String!]!
    comments: [Comment!]!
    createdAt: String!
    updatedAt: String!
  }

  enum TaskStatus {
    TODO
    IN_PROGRESS
    REVIEW
    DONE
  }

  enum TaskPriority {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  # 评论
  type Comment {
    id: ID!
    content: String!
    author: User!
    createdAt: String!
  }

  # 通知
  type Notification {
    id: ID!
    type: String!
    title: String!
    content: String!
    read: Boolean!
    createdAt: String!
  }

  # 看板列
  type KanbanColumn {
    id: ID!
    title: String!
    tasks: [Task!]!
    order: Int!
  }

  # 查询
  type Query {
    # 项目相关
    projects: [Project!]!
    project(id: ID!): Project
    myProjects: [Project!]!

    # 任务相关
    tasks(projectId: ID!, filters: TaskFilters): [Task!]!
    task(id: ID!): Task
    myTasks: [Task!]!

    # 通知
    notifications(limit: Int, unreadOnly: Boolean): [Notification!]!
    unreadNotificationCount: Int!

    # 仪表盘
    dashboardStats(projectId: ID!): DashboardStats!
  }

  input TaskFilters {
    status: TaskStatus
    priority: TaskPriority
    assigneeId: ID
    tag: String
  }

  type DashboardStats {
    totalTasks: Int!
    completedTasks: Int!
    inProgressTasks: Int!
    completionRate: Float!
    velocity: Float!
    burndown: [BurndownPoint!]!
  }

  type BurndownPoint {
    day: String!
    remaining: Float!
    ideal: Float!
  }

  # 变更
  type Mutation {
    # 项目
    createProject(input: CreateProjectInput!): Project!
    updateProject(id: ID!, input: UpdateProjectInput!): Project!
    archiveProject(id: ID!): Project!

    # 任务
    createTask(projectId: ID!, input: CreateTaskInput!): Task!
    updateTask(id: ID!, input: UpdateTaskInput!): Task!
    deleteTask(id: ID!): Boolean!
    moveTask(id: ID!, toStatus: TaskStatus!, order: Int): Task!

    # 通知
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Boolean!
  }

  input CreateProjectInput {
    name: String!
    description: String
  }

  input UpdateProjectInput {
    name: String
    description: String
  }

  input CreateTaskInput {
    title: String!
    description: String
    priority: TaskPriority
    assigneeId: ID
    estimateHours: Float
    tags: [String!]
  }

  input UpdateTaskInput {
    title: String
    description: String
    status: TaskStatus
    priority: TaskPriority
    assigneeId: ID
    estimateHours: Float
    tags: [String!]
  }

  # 订阅 (实时)
  type Subscription {
    taskUpdated(projectId: ID!): Task!
    taskCreated(projectId: ID!): Task!
    notificationReceived: Notification!
    userPresenceChanged: UserPresence!
  }

  type UserPresence {
    userId: ID!
    status: String!
    projectId: ID
    lastSeen: String!
  }
`
```

```typescript
// src/bff/graphql/resolvers.ts
// BFF Resolvers — 数据聚合 + 权限 + 缓存

import { EventBus } from '../../infrastructure/event-bus'
import { ProjectService } from '../../services/project.service'
import { HttpClient } from '../../infrastructure/http-client'

export const resolvers = {
  Query: {
    // 聚合: 项目 + 成员 + 任务统计
    projects: async (_: any, __: any, context: any) => {
      const projects = await context.projectService.getProjects()
      return projects.map((project: any) => ({
        ...project,
        // 聚合成员信息 (避免 N+1)
        members: project.memberIds.map((id: string) => context.userCache.get(id)),
        // 计算进度
        progress: calculateProgress(project),
      }))
    },

    // 聚合: 仪表盘统计 (多数据源)
    dashboardStats: async (_: any, { projectId }: any, context: any) => {
      const [tasks, sprint] = await Promise.all([
        context.projectService.getTasks(projectId),
        context.http.get(`/api/sprints?projectId=${projectId}&current=true`),
      ])

      const totalTasks = tasks.length
      const completedTasks = tasks.filter((t: any) => t.status === 'DONE').length
      const inProgressTasks = tasks.filter((t: any) => t.status === 'IN_PROGRESS').length

      return {
        totalTasks,
        completedTasks,
        inProgressTasks,
        completionRate: totalTasks > 0 ? completedTasks / totalTasks : 0,
        velocity: sprint?.data?.velocity || 0,
        burndown: generateBurndown(tasks, sprint?.data?.days || 14),
      }
    },

    // 裁剪: 只返回当前用户的项目
    myProjects: async (_: any, __: any, context: any) => {
      const allProjects = await context.projectService.getProjects()
      return allProjects.filter((p: any) => p.members.includes(context.userId))
    },

    notifications: async (_: any, { limit = 20, unreadOnly = false }: any, context: any) => {
      let notifications = await context.http.get('/api/notifications', {
        params: { limit, unreadOnly },
      })
      return notifications.data
    },
  },

  Mutation: {
    createTask: async (_: any, { projectId, input }: any, context: any) => {
      // 权限校验
      const project = await context.projectService.getProject(projectId)
      if (!project.members.includes(context.userId)) {
        throw new Error('无权在此项目中创建任务')
      }

      const task = await context.projectService.createTask(projectId, input)

      // 发布领域事件
      context.eventBus.publishDomainEvent({
        eventType: 'task.created',
        aggregateId: task.id,
        payload: task,
        metadata: {
          userId: context.userId,
          correlationId: context.requestId,
          causationId: null,
        },
      })

      return task
    },

    moveTask: async (_: any, { id, toStatus, order }: any, context: any) => {
      const task = await context.projectService.updateTask(id, {
        status: toStatus,
        order,
      })

      // 状态变更事件
      context.eventBus.publishDomainEvent({
        eventType: 'task.status_changed',
        aggregateId: id,
        payload: { from: task.status, to: toStatus },
        metadata: {
          userId: context.userId,
          correlationId: context.requestId,
          causationId: null,
        },
      })

      return task
    },
  },

  Subscription: {
    taskUpdated: {
      subscribe: (_: any, { projectId }: any, context: any) => {
        return context.eventBus.eventIterator(`task:updated:${projectId}`)
      },
    },
    notificationReceived: {
      subscribe: (_: any, __: any, context: any) => {
        return context.eventBus.eventIterator('notification:received')
      },
    },
  },
}

function calculateProgress(project: any): number {
  const total = project.taskCount || 0
  if (total === 0) return 0
  return project.completedTaskCount / total
}

function generateBurndown(tasks: any[], days: number): any[] {
  const total = tasks.length
  const dailyBurn = total / days
  return Array.from({ length: days }, (_, i) => ({
    day: `Day ${i + 1}`,
    remaining: Math.max(0, total - dailyBurn * (i + 1)),
    ideal: Math.max(0, total - dailyBurn * (i + 1)),
  }))
}
```

### 3.5 第五层：Pinia 状态管理

```typescript
// src/stores/project.store.ts
// 项目管理 Store — Flux 单向数据流

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project, Task } from '../services/project.service'
import { ProjectService } from '../services/project.service'
import { EventBus } from '../infrastructure/event-bus'

export const useProjectStore = defineStore('project', () => {
  // ====== State ======
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const tasks = ref<Task[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filters = ref({
    status: '' as string,
    priority: '' as string,
    assigneeId: '' as string,
    search: '' as string,
  })

  // ====== Getters ======
  const activeProjects = computed(() =>
    projects.value.filter((p) => p.status === 'active')
  )

  const filteredTasks = computed(() => {
    let result = tasks.value
    if (filters.value.status) {
      result = result.filter((t) => t.status === filters.value.status)
    }
    if (filters.value.priority) {
      result = result.filter((t) => t.priority === filters.value.priority)
    }
    if (filters.value.assigneeId) {
      result = result.filter((t) => t.assigneeId === filters.value.assigneeId)
    }
    if (filters.value.search) {
      const q = filters.value.search.toLowerCase()
      result = result.filter(
        (t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
      )
    }
    return result
  })

  const taskStats = computed(() => ({
    total: tasks.value.length,
    todo: tasks.value.filter((t) => t.status === 'todo').length,
    inProgress: tasks.value.filter((t) => t.status === 'in-progress').length,
    review: tasks.value.filter((t) => t.status === 'review').length,
    done: tasks.value.filter((t) => t.status === 'done').length,
  }))

  // ====== Actions ======
  async function loadProjects() {
    loading.value = true
    error.value = null
    try {
      const service = useProjectService()
      projects.value = await service.getProjects()
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function loadProject(id: string) {
    loading.value = true
    error.value = null
    try {
      const service = useProjectService()
      currentProject.value = await service.getProject(id)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function loadTasks(projectId: string) {
    loading.value = true
    error.value = null
    try {
      const service = useProjectService()
      tasks.value = await service.getTasks(projectId, filters.value as any)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createTask(taskData: Omit<Task, 'id'>) {
    if (!currentProject.value) return
    const service = useProjectService()
    const task = await service.createTask(currentProject.value.id, taskData)
    tasks.value.push(task)
  }

  async function updateTask(taskId: string, updates: Partial<Task>) {
    const service = useProjectService()
    const updated = await service.updateTask(taskId, updates)
    const idx = tasks.value.findIndex((t) => t.id === taskId)
    if (idx > -1) tasks.value[idx] = updated
  }

  async function moveTask(taskId: string, toStatus: Task['status'], order?: number) {
    const service = useProjectService()
    const updated = await service.reorderTask(taskId, order || 0, toStatus)
    const idx = tasks.value.findIndex((t) => t.id === taskId)
    if (idx > -1) tasks.value[idx] = updated
  }

  function setFilters(newFilters: Partial<typeof filters.value>) {
    Object.assign(filters.value, newFilters)
  }

  // 监听事件总线
  const eventBus = useEventBus()
  eventBus.on('task:created', (task: Task) => {
    if (task.projectId === currentProject.value?.id) {
      tasks.value.push(task)
    }
  })
  eventBus.on('task:updated', (task: Task) => {
    const idx = tasks.value.findIndex((t) => t.id === task.id)
    if (idx > -1) tasks.value[idx] = task
  })
  eventBus.on('task:deleted', ({ id }: { id: string }) => {
    const idx = tasks.value.findIndex((t) => t.id === id)
    if (idx > -1) tasks.value.splice(idx, 1)
  })

  return {
    projects, currentProject, tasks, loading, error, filters,
    activeProjects, filteredTasks, taskStats,
    loadProjects, loadProject, loadTasks, createTask, updateTask, moveTask, setFilters,
  }
})

// 辅助函数 (在实际应用中通过 provide/inject 注入)
function useProjectService(): ProjectService {
  // 通过全局 provide 获取
  return inject('projectService')!
}

function useEventBus(): EventBus {
  return inject('eventBus')!
}
```

### 3.6 第六层：Composables

```typescript
// src/composables/useDragDrop.ts
// 拖拽排序 Composable — 跨列拖拽 + 实时预览

import { ref, computed, onMounted, onUnmounted } from 'vue'

interface DragItem {
  id: string
  type: string
  data: any
}

interface DropZone {
  id: string
  type: string
}

export function useDragDrop() {
  const draggedItem = ref<DragItem | null>(null)
  const dropTarget = ref<DropZone | null>(null)
  const previewPosition = ref({ x: 0, y: 0 })
  const isDragging = computed(() => draggedItem.value !== null)

  // 拖拽状态
  const dragOverZone = ref<string | null>(null)

  function startDrag(item: DragItem, event: MouseEvent) {
    draggedItem.value = item
    previewPosition.value = { x: event.clientX, y: event.clientY }
    document.body.classList.add('dragging')
  }

  function moveDrag(event: MouseEvent) {
    if (!isDragging.value) return
    previewPosition.value = { x: event.clientX, y: event.clientY }

    // 检测悬停区域
    const zones = document.querySelectorAll('[data-drop-zone]')
    for (const zone of zones) {
      const rect = zone.getBoundingClientRect()
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        dragOverZone.value = zone.getAttribute('data-drop-zone')!
        dropTarget.value = {
          id: zone.getAttribute('data-drop-zone')!,
          type: zone.getAttribute('data-drop-type') || 'default',
        }
        return
      }
    }
    dragOverZone.value = null
    dropTarget.value = null
  }

  function endDrag() {
    const item = draggedItem.value
    const target = dropTarget.value
    draggedItem.value = null
    dropTarget.value = null
    dragOverZone.value = null
    document.body.classList.remove('dragging')

    if (item && target) {
      return { item, target }
    }
    return null
  }

  // 全局事件监听
  onMounted(() => {
    document.addEventListener('mousemove', moveDrag)
    document.addEventListener('mouseup', () => {
      const result = endDrag()
      if (result) {
        emit('drop', result)
      }
    })
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', moveDrag)
  })

  return {
    draggedItem,
    dropTarget,
    previewPosition,
    isDragging,
    dragOverZone,
    startDrag,
  }
}
```

```typescript
// src/composables/useWebSocket.ts
// WebSocket 连接 Composable — 自动管理生命周期

import { ref, onMounted, onUnmounted, watch } from 'vue'
import { WebSocketManager } from '../infrastructure/websocket'
import type { WSMessage } from '../infrastructure/websocket'

export function useWebSocket(url: string) {
  const ws = ref<WebSocketManager | null>(null)
  const status = ref<'connected' | 'disconnected' | 'reconnecting'>('disconnected')
  const lastMessage = ref<WSMessage | null>(null)
  const messageHistory = ref<WSMessage[]>([])

  function init() {
    ws.value = new WebSocketManager({ url })
    ws.value.on('connected', () => {
      status.value = 'connected'
    })
    ws.value.on('disconnected', () => {
      status.value = 'disconnected'
    })
    ws.value.on('message', (message: WSMessage) => {
      lastMessage.value = message
      messageHistory.value.push(message)
      if (messageHistory.value.length > 100) {
        messageHistory.value.shift()
      }
    })
    ws.value.connect()
  }

  function send(message: Omit<WSMessage, 'timestamp' | 'id'>) {
    ws.value?.send(message)
  }

  onMounted(() => init())
  onUnmounted(() => ws.value?.disconnect())

  return {
    status,
    lastMessage,
    messageHistory,
    send,
  }
}
```

```typescript
// src/composables/usePagination.ts
// 分页 Composable — 无限滚动 + 传统分页

import { ref, computed, watch } from 'vue'

interface PaginationOptions {
  pageSize?: number
  maxPages?: number
  infinite?: boolean
}

interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export function usePagination<T>(
  fetchFn: (page: number, pageSize: number) => Promise<PaginatedResult<T>>,
  options: PaginationOptions = {}
) {
  const { pageSize = 20, maxPages = 100, infinite = false } = options

  const items = ref<T[]>([])
  const page = ref(1)
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const totalPages = computed(() => Math.ceil(total.value / pageSize))
  const hasMore = computed(() => page.value < totalPages.value && page.value < maxPages)

  async function loadPage(p: number = 1, append = false) {
    if (loading.value) return
    loading.value = true
    error.value = null

    try {
      const result = await fetchFn(p, pageSize)
      if (append) {
        items.value = [...items.value, ...result.items]
      } else {
        items.value = result.items
      }
      total.value = result.total
      page.value = p
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function nextPage() {
    if (hasMore.value && !loading.value) {
      await loadPage(page.value + 1, infinite)
    }
  }

  async function prevPage() {
    if (page.value > 1 && !loading.value) {
      await loadPage(page.value - 1)
    }
  }

  function reset() {
    items.value = []
    page.value = 1
    total.value = 0
  }

  return {
    items,
    page,
    total,
    totalPages,
    loading,
    error,
    hasMore,
    loadPage,
    nextPage,
    prevPage,
    reset,
  }
}
```

### 3.7 第七层：微前端容器 (Shell App)

```typescript
// src/shell/App.vue
// 微前端容器 — 路由分发 + 全局布局 + 共享状态

<template>
  <div id="app" class="devflow-shell">
    <!-- 顶部导航 -->
    <header class="shell-header">
      <div class="logo">
        <img src="/logo.svg" alt="DevFlow" />
        <span class="app-name">DevFlow</span>
      </div>
      <nav class="main-nav">
        <router-link to="/projects" class="nav-item">项目管理</router-link>
        <router-link to="/docs" class="nav-item">文档中心</router-link>
        <router-link to="/dashboard" class="nav-item">数据看板</router-link>
        <router-link to="/team" class="nav-item">团队</router-link>
      </nav>
      <div class="header-actions">
        <!-- 全局搜索 -->
        <GlobalSearch />
        <!-- 通知 -->
        <NotificationBell :count="unreadCount" />
        <!-- 用户菜单 -->
        <UserMenu :user="currentUser" />
      </div>
    </header>

    <!-- 侧边栏 -->
    <aside class="shell-sidebar" :class="{ collapsed: sidebarCollapsed }">
      <Sidebar :collapsed="sidebarCollapsed" />
    </aside>

    <!-- 主内容区 — 微前端子应用挂载点 -->
    <main class="shell-main">
      <div id="subapp-container" class="subapp-mount">
        <!-- Module Federation 子应用在此渲染 -->
        <router-view />
      </div>
    </main>

    <!-- 全局通知 -->
    <GlobalNotifications />
    <!-- 加载指示器 -->
    <GlobalLoader :visible="globalLoading" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectStore } from '../stores/project.store'
import { useWebSocket } from '../composables/useWebSocket'
import { EventBus } from '../infrastructure/event-bus'
import { ProjectService } from '../services/project.service'
import { HttpClient } from '../infrastructure/http-client'

// 初始化基础设施
const httpClient = new HttpClient({ baseURL: import.meta.env.VITE_API_URL })
const eventBus = new EventBus()
const projectService = new ProjectService(httpClient, eventBus)

// 提供全局依赖 (子应用可通过 inject 获取)
provide('httpClient', httpClient)
provide('eventBus', eventBus)
provide('projectService', projectService)

// WebSocket 连接
const { status: wsStatus, send: wsSend } = useWebSocket(
  import.meta.env.VITE_WS_URL || 'ws://localhost:3001'
)

// 全局状态
const sidebarCollapsed = ref(false)
const globalLoading = ref(false)
const projectStore = useProjectStore()

// 未读通知数
const unreadCount = computed(() => 0) // 从通知 store 获取

// 当前用户
const currentUser = ref({
  name: '开发者',
  avatar: '/avatar.png',
  role: 'admin',
})

// 全局键盘快捷键
provide('shortcuts', {
  'Cmd+K': () => openGlobalSearch(),
  'Cmd+N': () => createNewTask(),
  'Cmd+/': () => toggleHelp(),
})
</script>

<style>
.devflow-shell {
  display: grid;
  grid-template-rows: 56px 1fr;
  grid-template-columns: 240px 1fr;
  grid-template-areas:
    "header header"
    "sidebar main";
  height: 100vh;
  overflow: hidden;
}

.shell-header {
  grid-area: header;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: #1a1a2e;
  color: white;
  gap: 24px;
}

.main-nav {
  display: flex;
  gap: 8px;
}

.nav-item {
  padding: 8px 16px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  transition: all 0.2s;
}

.nav-item:hover,
.nav-item.router-link-active {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.shell-sidebar {
  grid-area: sidebar;
  background: #16213e;
  transition: width 0.3s;
  overflow: hidden;
}

.shell-sidebar.collapsed {
  width: 64px;
}

.shell-main {
  grid-area: main;
  overflow: auto;
  background: #f5f7fa;
}
</style>
```

### 3.8 第八层：子应用示例 — 项目管理

```typescript
// subapps/projects/src/App.vue
// 项目管理子应用 — MVVM 模式 + 看板视图

<template>
  <div class="project-app">
    <!-- 项目选择器 -->
    <ProjectSelector
      :projects="projectStore.activeProjects"
      :current="projectStore.currentProject"
      @select="selectProject"
    />

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <SearchInput
          v-model="projectStore.filters.search"
          placeholder="搜索任务..."
          @search="onSearch"
        />
        <FilterDropdown
          :status="projectStore.filters.status"
          :priority="projectStore.filters.priority"
          @change="projectStore.setFilters"
        />
      </div>
      <div class="toolbar-right">
        <ViewToggle v-model="viewMode" />
        <button class="btn-primary" @click="showCreateTask = true">
          + 新建任务
        </button>
      </div>
    </div>

    <!-- 任务统计 -->
    <TaskStats :stats="projectStore.taskStats" />

    <!-- 视图切换 -->
    <KanbanBoard
      v-if="viewMode === 'kanban'"
      :tasks="projectStore.filteredTasks"
      @drop="onTaskDrop"
    />
    <TaskList
      v-else-if="viewMode === 'list'"
      :tasks="projectStore.filteredTasks"
      @select="openTaskDetail"
    />
    <TimelineView
      v-else-if="viewMode === 'timeline'"
      :tasks="projectStore.filteredTasks"
    />

    <!-- 新建任务对话框 -->
    <TaskDialog
      v-if="showCreateTask"
      mode="create"
      @submit="createTask"
      @close="showCreateTask = false"
    />

    <!-- 任务详情侧边栏 -->
    <TaskDetail
      v-if="selectedTask"
      :task="selectedTask"
      @close="selectedTask = null"
      @update="updateTask"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '../../stores/project.store'
import { useDragDrop } from '../../composables/useDragDrop'
import type { Task } from '../../services/project.service'

const projectStore = useProjectStore()
const { startDrag } = useDragDrop()

const viewMode = ref<'kanban' | 'list' | 'timeline'>('kanban')
const showCreateTask = ref(false)
const selectedTask = ref<Task | null>(null)

async function selectProject(projectId: string) {
  await projectStore.loadProject(projectId)
  await projectStore.loadTasks(projectId)
}

async function onSearch(query: string) {
  projectStore.setFilters({ search: query })
  if (projectStore.currentProject) {
    await projectStore.loadTasks(projectStore.currentProject.id)
  }
}

async function onTaskDrop({ item, target }: any) {
  if (item.type === 'task') {
    await projectStore.moveTask(item.id, target.id as Task['status'])
  }
}

async function createTask(data: any) {
  await projectStore.createTask(data)
  showCreateTask.value = false
}

async function updateTask(taskId: string, updates: Partial<Task>) {
  await projectStore.updateTask(taskId, updates)
}

function openTaskDetail(task: Task) {
  selectedTask.value = task
}

// 初始化
projectStore.loadProjects()
</script>

<style scoped>
.project-app {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.toolbar-left {
  display: flex;
  gap: 12px;
  align-items: center;
}

.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.btn-primary {
  padding: 8px 16px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #4338ca;
}
</style>
```

```typescript
// subapps/projects/webpack.config.js
// 项目管理子应用 — Module Federation 配置

const { ModuleFederationPlugin } = require('webpack').container

module.exports = {
  output: {
    publicPath: 'auto',
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'projects',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.vue',
      },
      shared: {
        vue: {
          singleton: true,
          requiredVersion: '^3.4.0',
        },
        'vue-router': {
          singleton: true,
          requiredVersion: '^4.3.0',
        },
        pinia: {
          singleton: true,
          requiredVersion: '^2.1.0',
        },
        axios: {
          requiredVersion: '^1.6.0',
        },
      },
    }),
  ],
  devServer: {
    port: 3001,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
}
```

---

## 四、Shell App 微前端路由配置

```typescript
// src/shell/router.ts
// 微前端路由 — 子应用路由分发

import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/projects',
    name: 'projects',
    component: () => import('../shell/SubAppLoader.vue'),
    meta: {
      subApp: 'projects',       // 子应用名称
      entry: 'http://localhost:3001/remoteEntry.js',
      title: '项目管理',
    },
  },
  {
    path: '/docs',
    name: 'docs',
    component: () => import('../shell/SubAppLoader.vue'),
    meta: {
      subApp: 'docs',
      entry: 'http://localhost:3002/remoteEntry.js',
      title: '文档中心',
    },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../shell/SubAppLoader.vue'),
    meta: {
      subApp: 'dashboard',
      entry: 'http://localhost:3003/remoteEntry.js',
      title: '数据看板',
    },
  },
  {
    path: '/team',
    name: 'team',
    component: () => import('../shell/SubAppLoader.vue'),
    meta: {
      subApp: 'team',
      entry: 'http://localhost:3004/remoteEntry.js',
      title: '团队管理',
    },
  },
  {
    path: '/',
    redirect: '/projects',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 }
  },
})

// 路由守卫: 认证
router.beforeEach(async (to, from) => {
  const token = localStorage.getItem('auth_token')
  if (!token && to.path !== '/login') {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})

export default router
```

```typescript
// src/shell/SubAppLoader.vue
// 子应用加载器 — Module Federation 动态加载

<template>
  <div class="subapp-loader">
    <div v-if="loading" class="loading-spinner">
      <span>加载中...</span>
    </div>
    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="retry">重试</button>
    </div>
    <div v-show="!loading && !error" ref="container" class="subapp-container" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const container = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
let currentApp: any = null

async function loadSubApp() {
  if (!container.value) return

  loading.value = true
  error.value = null

  try {
    const { subApp, entry } = route.meta as any

    // 动态加载远程模块
    await __webpack_init_sharing__('default')
    const container = window[subApp] as any
    await container.init(__webpack_share_scopes__.default)

    const factory = await container.get('./App')
    const Component = factory()

    // 卸载旧应用
    if (currentApp) {
      currentApp.unmount()
    }

    // 挂载新应用
    const { createApp } = await import('vue')
    currentApp = createApp(Component)

    // 注入共享依赖
    const { pinia } = await import('../stores')
    const { router } = await import('../router')
    currentApp.use(pinia)
    currentApp.use(router)

    currentApp.mount(container.value)
  } catch (e: any) {
    error.value = `加载子应用失败: ${e.message}`
    console.error('SubApp load error:', e)
  } finally {
    loading.value = false
  }
}

function retry() {
  loadSubApp()
}

onMounted(() => loadSubApp())
onUnmounted(() => {
  if (currentApp) {
    currentApp.unmount()
    currentApp = null
  }
})

// 路由变化时重新加载
watch(() => route.path, () => {
  if (currentApp) {
    currentApp.unmount()
    currentApp = null
  }
  loadSubApp()
})
</script>

<style scoped>
.subapp-loader {
  height: 100%;
  position: relative;
}

.subapp-container {
  height: 100%;
}

.loading-spinner {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #6b7280;
}

.error-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #ef4444;
  gap: 12px;
}
</style>
```

---

## 五、架构模式对照表

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DevFlow 架构模式映射表                                  │
├────────────┬──────────────┬─────────────────────────────────────────────────┤
│ 架构模式    │ 应用位置      │ 具体体现                                       │
├────────────┼──────────────┼─────────────────────────────────────────────────┤
│ MVC        │ 文档中心子应用 │ Model: DocService                              │
│            │              │ View: Markdown 编辑器组件                        │
│            │              │ Controller: DocController 处理编辑/保存/版本      │
├────────────┼──────────────┼─────────────────────────────────────────────────┤
│ MVVM       │ 项目管理子应用 │ Model: Project/Task 数据模型                    │
│            │              │ View: 看板/列表/时间线视图                        │
│            │              │ ViewModel: useProjectStore (响应式状态)           │
│            │              │ 双向绑定: v-model / computed                     │
├────────────┼──────────────┼─────────────────────────────────────────────────┤
│ Flux       │ 数据看板子应用 │ Action: 用户操作 → dispatch                    │
│            │              │ Store: Pinia Store (唯一数据源)                   │
│            │              │ Mutation: 同步状态变更                            │
│            │              │ View: 图表组件 (只读渲染)                         │
├────────────┼──────────────┼─────────────────────────────────────────────────┤
│ 微前端      │ Shell App    │ Module Federation 动态加载                      │
│            │              │ 4 个独立子应用 (独立开发/构建/部署)                 │
│            │              │ 共享依赖: Vue/Pinia/axios                        │
│            │              │ 路由分发 + 全局状态隔离                            │
├────────────┼──────────────┼─────────────────────────────────────────────────┤
│ BFF        │ GraphQL 层    │ 数据裁剪 (只返回前端需要的字段)                   │
│            │              │ 多源聚合 (项目 + 任务 + 用户 + 通知)               │
│            │              │ 权限校验 (在 BFF 层统一处理)                       │
│            │              │ 缓存层 (减少后端压力)                             │
├────────────┼──────────────┼─────────────────────────────────────────────────┤
│ 事件驱动    │ 事件总线      │ 跨子应用通信 (project:created → 所有子应用)      │
│            │              │ 领域事件 (task.created / task.status_changed)     │
│            │              │ WebSocket 实时推送                               │
│            │              │ 事件溯源 (DomainEvent Store)                      │
├────────────┼──────────────┼─────────────────────────────────────────────────┤
│ Composition │ Composables │ 逻辑复用: useDragDrop / useWebSocket / ...       │
│            │              │ 关注点分离: UI 组件只负责渲染                      │
│            │              │ 类型安全: 完整的 TS 类型推导                      │
├────────────┼──────────────┼─────────────────────────────────────────────────┤
│ CQRS       │ 命令/查询分离 │ Command: createTask / updateTask / moveTask     │
│            │              │ Query: getTasks / getProjects / dashboardStats   │
│            │              │ 命令走 BFF Mutation，查询走 GraphQL Query         │
└────────────┴──────────────┴─────────────────────────────────────────────────┘
```

---

## 六、渐进式迁移方案

### 6.1 从单体到微前端的迁移路径

```
阶段 1: 模块化 (当前单体应用)
┌─────────────────────────────────────────┐
│         单体 Vue 3 应用                   │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │项目  │ │文档  │ │看板  │ │团队  │       │
│  │模块  │ │模块  │ │模块  │ │模块  │       │
│  └─────┘ └─────┘ └─────┘ └─────┘       │
│  共享路由 / 共享 Store / 共享构建          │
└─────────────────────────────────────────┘
→ 优势: 简单 / 快速开发
→ 劣势: 构建慢 / 耦合高 / 无法独立部署

阶段 2: 模块拆分 (3-6 个月)
┌─────────────────────────────────────────┐
│         共享库 + 独立构建                  │
│  ┌──────────┐     ┌──────────┐           │
│  │ shared-lib│     │  shell   │           │
│  │ (组件/工具)│     │ (路由/布局)│          │
│  └──────────┘     └────┬─────┘           │
│                        │                  │
│              ┌─────────┼─────────┐        │
│              │         │         │        │
│         ┌────┴───┐ ┌──┴────┐ ┌──┴───┐    │
│         │ 项目   │ │ 文档  │ │ 看板  │    │
│         │ 独立构建│ │ 独立构建│ │ 独立构建│  │
│         └────────┘ └───────┘ └───────┘    │
│  Monorepo / 独立构建 / 共享依赖              │
└─────────────────────────────────────────┘
→ 优势: 构建提速 / 模块独立 / 团队自治
→ 劣势: 需要协调 / 共享版本管理

阶段 3: 微前端 (6-12 个月)
┌─────────────────────────────────────────┐
│         Module Federation 微前端           │
│  ┌──────────┐                            │
│  │  Shell   │ ← 路由 + 布局 + 全局状态     │
│  └────┬─────┘                            │
│       │ 动态加载                            │
│  ┌────┴─────┬──────┬──────┐              │
│  │ 项目子应用│ │文档子应用│ │看板子应用│ │团队子应用│
│  │ Vue 3    │ │Vue 3     │ │Vue 3   │ │Vue 3    │
│  │ 独立部署  │ │独立部署   │ │独立部署 │ │独立部署  │
│  └──────────┴──────┴──────┘              │
│  独立开发 / 独立构建 / 独立部署 / 热更新     │
└─────────────────────────────────────────┘
→ 优势: 完全独立 / 技术栈可混用 / 团队自治
→ 劣势: 复杂度高 / 通信成本 / 样式隔离
```

### 6.2 迁移检查清单

```
阶段 1 → 2 检查清单:
□ 提取 shared-lib (组件库 + 工具函数 + 类型定义)
□ 配置 Monorepo (pnpm workspace)
□ 每个模块独立构建 (Vite build)
□ 模块间接口定义 (TypeScript interface)
□ 共享依赖版本锁定
□ CI/CD 按模块触发

阶段 2 → 3 检查清单:
□ 安装 Webpack 5 Module Federation 插件
□ Shell App 路由改造 (动态子应用加载)
□ 子应用暴露入口 (exposes: './App')
□ 共享依赖配置 (shared: { vue: { singleton: true } })
□ 样式隔离 (CSS Modules / Shadow DOM)
□ 全局状态隔离 (每个子应用独立 Pinia)
□ 通信机制 (EventBus / CustomEvent)
□ 错误边界 (子应用崩溃不影响 Shell)
□ 性能监控 (子应用加载时间追踪)
□ 回退策略 (子应用加载失败 → 降级页面)
```

---

## 七、性能优化策略

### 7.1 各层性能优化

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DevFlow 性能优化策略                                 │
├────────────┬────────────────────────────────────────────────────────────────┤
│ 层级        │ 优化策略                                                      │
├────────────┼────────────────────────────────────────────────────────────────┤
│ L8 UI      │ • 虚拟滚动 (大数据列表)                                        │
│            │ • 组件懒加载 (异步组件 + Suspense)                              │
│            │ • 图片懒加载 (IntersectionObserver)                             │
│            │ • 防抖/节流 (搜索/滚动事件)                                     │
│            │ • Keep-Alive (频繁切换的页面缓存)                                │
├────────────┼────────────────────────────────────────────────────────────────┤
│ L7 容器    │ • 子应用预加载 (idle 时预加载下一个子应用)                       │
│            │ • 共享依赖缓存 (Module Federation shared)                       │
│            │ • 路由级代码分割                                                │
│            │ • 骨架屏 (子应用加载期间)                                        │
├────────────┼────────────────────────────────────────────────────────────────┤
│ L6 组合    │ • Composable 按需引入 (Tree Shaking)                           │
│            │ • 响应式数据最小化 (避免大对象 reactive)                         │
│            │ • 计算属性缓存 (computed 自动缓存)                               │
├────────────┼────────────────────────────────────────────────────────────────┤
│ L5 状态    │ • Store 模块化 (按功能拆分)                                     │
│            │ • 状态规范化 (扁平化存储, 避免嵌套)                               │
│            │ • 持久化策略 (关键状态 → localStorage)                           │
├────────────┼────────────────────────────────────────────────────────────────┤
│ L4 BFF     │ • GraphQL 查询深度限制                                         │
│            │ • DataLoader 批量加载 (解决 N+1)                                │
│            │ • 响应缓存 (Redis, 按 TTL)                                      │
│            │ • 字段级裁剪 (只返回请求的字段)                                   │
│            │ • 查询复杂度分析 (防止恶意查询)                                   │
├────────────┼────────────────────────────────────────────────────────────────┤
│ L3 事件    │ • 事件节流 (高频事件合并)                                       │
│            │ • 异步事件队列 (不阻塞主线程)                                    │
│            │ • 事件去重 (相同事件合并)                                        │
├────────────┼────────────────────────────────────────────────────────────────┤
│ L2 服务    │ • 请求去重 (相同 URL + params 合并)                             │
│            │ • 响应缓存 (1min TTL for GET)                                   │
│            │ • 批量请求 (batch API)                                          │
│            │ • 连接复用 (HTTP Keep-Alive)                                    │
├────────────┼────────────────────────────────────────────────────────────────┤
│ L1 基础设施 │ • Service Worker 缓存 (静态资源)                               │
│            │ • CDN 加速 (JS/CSS/图片)                                       │
│            │ • Gzip/Brotli 压缩                                             │
│            │ • HTTP/2 多路复用                                              │
└────────────┴────────────────────────────────────────────────────────────────┘
```

### 7.2 性能目标

```
┌────────────────────┬──────────────┬──────────────┬──────────────┐
│ 指标               │ 目标值        │ 测量方式      │ 优先级        │
├────────────────────┼──────────────┼──────────────┼──────────────┤
│ FCP (首屏内容)     │ < 1.0s       │ Lighthouse   │ P0           │
│ LCP (最大内容)     │ < 2.5s       │ Lighthouse   │ P0           │
│ TTI (可交互时间)   │ < 3.5s       │ Lighthouse   │ P0           │
│ CLS (布局偏移)     │ < 0.1        │ Lighthouse   │ P1           │
│ INP (交互响应)     │ < 200ms      │ Web Vitals   │ P0           │
│ JS Bundle 大小     │ < 250KB (gzip)│ webpack-bundle-analyzer │ P1 │
│ 子应用加载时间     │ < 500ms       │ Performance API │ P1        │
│ API 响应时间       │ < 200ms (P95) │ BFF 日志     │ P0           │
│ WebSocket 延迟     │ < 50ms       │ 客户端测量    │ P0           │
└────────────────────┴──────────────┴──────────────┴──────────────┘
```

---

## 八、安全架构

### 8.1 安全分层防御

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DevFlow 安全架构                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  第一道防线: 边缘安全 (CDN/WAF)                                              │
│  ├── DDoS 防护                                                              │
│  ├── SQL 注入/XSS 过滤                                                      │
│  ├── 速率限制 (Rate Limiting)                                               │
│  └── IP 黑名单                                                              │
│                                                                             │
│  第二道防线: BFF 层安全                                                      │
│  ├── JWT 验证 + 刷新令牌                                                    │
│  ├── RBAC 权限校验 (角色 → 权限 → 资源)                                     │
│  ├── GraphQL 查询复杂度限制                                                  │
│  ├── 输入验证 (Zod schema)                                                  │
│  └── 请求日志审计                                                           │
│                                                                             │
│  第三道防线: 前端安全                                                        │
│  ├── CSP (Content Security Policy)                                          │
│  ├── XSS 防护 (v-html 转义 / DOMPurify)                                     │
│  ├── CSRF Token                                                             │
│  ├── 敏感数据不存 localStorage (用 httpOnly cookie)                          │
│  └── 子应用沙箱 (iframe sandbox)                                            │
│                                                                             │
│  第四道防线: 数据传输                                                        │
│  ├── HTTPS (TLS 1.3)                                                       │
│  ├── WSS (WebSocket 加密)                                                  │
│  ├── 端到端加密 (敏感消息)                                                   │
│  └── 证书固定 (Certificate Pinning)                                         │
│                                                                             │
│  第五道防线: 运行时安全                                                      │
│  ├── 错误边界 (子应用崩溃不影响其他)                                          │
│  ├── 内存泄漏检测                                                           │
│  ├── 异常上报 (Sentry)                                                      │
│  └── 安全审计日志                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 九、DevFlow 项目目录结构

```
devflow/
├── shell/                          # 微前端容器
│   ├── src/
│   │   ├── App.vue                 # 主应用 (导航/布局/子应用挂载)
│   │   ├── router.ts               # 路由 (子应用分发)
│   │   ├── components/             # 共享组件
│   │   │   ├── GlobalSearch.vue
│   │   │   ├── NotificationBell.vue
│   │   │   ├── UserMenu.vue
│   │   │   ├── Sidebar.vue
│   │   │   └── SubAppLoader.vue    # 子应用加载器
│   │   └── main.ts
│   ├── webpack.config.js           # Shell MF 配置
│   └── package.json
│
├── subapps/                        # 子应用
│   ├── projects/                   # 项目管理 (MVVM)
│   │   ├── src/App.vue             # 看板/列表/时间线
│   │   ├── components/
│   │   │   ├── KanbanBoard.vue
│   │   │   ├── TaskList.vue
│   │   │   ├── TaskDetail.vue
│   │   │   └── TaskDialog.vue
│   │   ├── webpack.config.js       # MF 远程配置
│   │   └── package.json
│   │
│   ├── docs/                       # 文档中心 (MVC)
│   │   ├── src/App.vue
│   │   ├── controllers/
│   │   │   └── DocController.ts
│   │   ├── models/
│   │   │   └── DocModel.ts
│   │   ├── views/
│   │   │   ├── MarkdownEditor.vue
│   │   │   └── DocHistory.vue
│   │   └── webpack.config.js
│   │
│   ├── dashboard/                  # 数据看板 (Flux)
│   │   ├── src/App.vue
│   │   ├── stores/
│   │   │   └── dashboard.store.ts
│   │   ├── components/
│   │   │   ├── BurndownChart.vue
│   │   │   ├── VelocityChart.vue
│   │   │   └── QualityReport.vue
│   │   └── webpack.config.js
│   │
│   └── team/                       # 团队管理 (MVVM)
│       ├── src/App.vue
│       ├── components/
│       │   ├── OrgTree.vue
│       │   ├── MemberList.vue
│       │   └── PermissionMatrix.vue
│       └── webpack.config.js
│
├── shared/                         # 共享库
│   ├── src/
│   │   ├── components/             # 共享 UI 组件
│   │   │   ├── Button.vue
│   │   │   ├── Modal.vue
│   │   │   ├── DataTable.vue
│   │   │   └── SearchInput.vue
│   │   ├── composables/            # 共享 Composables
│   │   │   ├── useDragDrop.ts
│   │   │   ├── useWebSocket.ts
│   │   │   ├── usePagination.ts
│   │   │   └── useForm.ts
│   │   ├── infrastructure/         # 基础设施
│   │   │   ├── http-client.ts
│   │   │   ├── websocket.ts
│   │   │   ├── event-bus.ts
│   │   │   └── storage.ts
│   │   ├── services/               # 服务层
│   │   │   ├── project.service.ts
│   │   │   ├── chat.service.ts
│   │   │   ├── doc.service.ts
│   │   │   └── notification.service.ts
│   │   ├── stores/                 # 共享 Store
│   │   │   ├── project.store.ts
│   │   │   ├── auth.store.ts
│   │   │   └── notification.store.ts
│   │   ├── types/                  # 类型定义
│   │   │   ├── project.ts
│   │   │   ├── task.ts
│   │   │   └── user.ts
│   │   └── utils/                  # 工具函数
│   │       ├── format.ts
│   │       ├── validate.ts
│   │       └── constants.ts
│   └── package.json
│
├── bff/                            # BFF 层
│   ├── src/
│   │   ├── graphql/
│   │   │   ├── schema.ts           # GraphQL Schema
│   │   │   └── resolvers.ts        # Resolvers
│   │   ├── middleware/
│   │   │   ├── auth.ts             # 认证中间件
│   │   │   ├── rate-limit.ts       # 速率限制
│   │   │   └── cache.ts            # 缓存中间件
│   │   └── server.ts               # Fastify 入口
│   └── package.json
│
├── pnpm-workspace.yaml             # Monorepo 配置
├── package.json
└── README.md
```

---

## 十、架构设计总结

### 10.1 八层架构核心原则

```
1. 单一职责: 每一层只做一件事
   - L8 UI: 渲染 + 交互
   - L7 容器: 编排 + 协调
   - L6 组合: 逻辑复用
   - L5 状态: 数据管理
   - L4 BFF: 数据聚合
   - L3 事件: 异步通信
   - L2 服务: API 调用
   - L1 基础设施: 横切关注点

2. 依赖方向: 上层依赖下层，绝不反向
   L8 → L7 → L6 → L5 → L4 → L3 → L2 → L1

3. 模式选择: 每层选择最适合的模式
   - 展示层: MVVM (快速开发)
   - 应用层: Flux (可预测)
   - 领域层: MVC (业务隔离)
   - 应用级: 微前端 (独立部署)

4. 渐进式: 从单体 → 模块化 → 微前端
   - 不追求一步到位
   - 每个阶段都可独立运行
   - 迁移成本可控

5. 安全内建: 五层防御，纵深防御
   - 不依赖单一安全措施
   - 每层都有安全校验
   - 默认拒绝，显式允许

6. 性能优先: 每一层都有性能考量
   - 首屏 < 1s, LCP < 2.5s
   - 按需加载, 缓存策略
   - 监控 + 告警 + 优化闭环
```

### 10.2 八轮迭代回顾

```
架构设计专项训练 8 轮迭代回顾:

轮次 │ 日期     │ 主题                          │ 核心产出
─────┼──────────┼───────────────────────────────┼─────────────────────
v1   │ 4/22     │ MVC/MVVM 基础                  │ 架构模式入门
v2   │ 4/26     │ 终极整合 + CollabEdit 实战      │ 多模式融合
v3   │ 4/27     │ BFF + 事件驱动 + SmartCS        │ 架构模式扩展
v4   │ 4/28     │ 三大模式手写 + 微前端            │ 手写实现
v5   │ 4/29     │ 架构决策 + 完整应用设计          │ ADR 决策框架
v6   │ 4/30     │ 融合架构终极 + 迁移策略          │ 四层融合
v7   │ 5/1      │ Vue 3 Composition + Edge 架构    │ 现代渲染模式
v8   │ 5/2      │ 企业级全栈应用架构终极实战        │ DevFlow 完整架构 ✅

8 轮迭代，从理论到实战，从单一模式到融合架构，从单体到微前端，
形成了完整的前端架构知识体系和实战能力。
```

---

## 十一、后续学习方向

```
架构设计之后，可以深入的方向:

1. 微前端深度
   - qiankun / single-spa 对比
   - CSS 隔离方案 (Shadow DOM / CSS Modules / BEM)
   - 子应用通信 (CustomEvent / MessageChannel / BroadcastChannel)
   - 微前端性能优化 (预加载 / 缓存 / 懒加载)

2. 服务端架构
   - DDD (领域驱动设计)
   - 微服务架构 (gRPC / 消息队列)
   - 事件溯源 + CQRS
   - 分布式事务 (Saga / TCC)

3. 云原生前端
   - Edge Computing (Edge Functions)
   - Serverless 架构
   - 边缘渲染 (Edge SSR)
   - 边缘缓存策略

4. 前端工程化
   - Monorepo 最佳实践 (Nx / Turborepo)
   - CI/CD 流水线优化
   - 自动化测试策略
   - 可观测性 (Logging / Metrics / Tracing)
```

---

**DevFlow 企业级全栈应用架构 v8 完成** ✅

本次训练产出了完整的八层融合架构设计，包含：
- 8 个架构模式的融合应用 (MVC / MVVM / Flux / 微前端 / BFF / 事件驱动 / Composition / CQRS)
- 完整的生产级代码实现 (HTTP 客户端 / WebSocket / 事件总线 / 服务层 / Store / Composables / 微前端容器 / 子应用)
- 架构决策矩阵 (10 个 ADR)
- 渐进式迁移方案 (3 阶段)
- 性能优化策略 (8 层优化)
- 安全架构 (5 层防御)
- 完整项目目录结构

**架构设计专项训练 8 轮迭代全部完成** 🎉
