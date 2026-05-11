# 📘 API 设计专项 — RESTful / GraphQL 设计原则 + 完整 API 设计

**日期**: 2026-04-25 21:00  
**主题**: RESTful/GraphQL 设计原则，设计 1 套完整 API + 文档  
**项目场景**: CloudBoard — 企业级数据分析平台（微前端架构）  
**产出**: 完整 API 设计文档 + 代码示例

---

## 目录

1. [RESTful API 设计原则](#1-restful-api-设计原则)
2. [GraphQL 设计原则](#2-graphql-设计原则)
3. [REST vs GraphQL 选型决策](#3-rest-vs-graphql-选型决策)
4. [CloudBoard 完整 API 设计](#4-cloudboard-完整-api-设计)
5. [API 安全设计](#5-api-安全设计)
6. [API 版本管理](#6-api-版本管理)
7. [API 文档规范](#7-api-文档规范)
8. [错误处理与状态码](#8-错误处理与状态码)
9. [分页、过滤、排序](#9-分页过滤排序)
10. [代码示例](#10-代码示例)

---

## 1. RESTful API 设计原则

### 1.1 核心原则

```
REST = Representational State Transfer
核心：资源（Resource）+ 统一接口（Uniform Interface）+ 无状态（Stateless）
```

| 原则 | 说明 | 示例 |
|------|------|------|
| **资源导向** | URL 表示资源，用名词 | `/users` ✅, `/getUsers` ❌ |
| **HTTP 方法语义** | GET/POST/PUT/PATCH/DELETE | `GET /users` 查询, `POST /users` 创建 |
| **无状态** | 每次请求包含全部信息 | Token 在 Header, 不依赖 Session |
| **分层系统** | 客户端不关心中间层 | CDN → API Gateway → Service |
| **可缓存** | 响应标明缓存策略 | `Cache-Control`, `ETag` |
| **统一接口** | 标准化交互方式 | 超媒体链接 (HATEOAS) |

### 1.2 URL 设计规范

```
# ✅ 正确
GET    /api/v1/users          # 获取用户列表
GET    /api/v1/users/123      # 获取单个用户
POST   /api/v1/users          # 创建用户
PUT    /api/v1/users/123      # 全量更新用户
PATCH  /api/v1/users/123      # 部分更新用户
DELETE /api/v1/users/123      # 删除用户

# 子资源
GET    /api/v1/users/123/orders        # 用户的订单
POST   /api/v1/users/123/orders        # 为用户创建订单
GET    /api/v1/users/123/orders/456    # 特定订单

# ❌ 错误
GET    /api/v1/getUsers              # 动词在 URL 中
POST   /api/v1/deleteUser/123        # 动词在 URL 中
GET    /api/v1/user_list             # 下划线（用连字符）
GET    /api/v1/Users                 # 大小写混用
```

### 1.3 URL 命名约定

```typescript
// URL 命名规则
const URL_RULES = {
  nouns: '使用复数名词',           // /users ✅, /user ❌
  kebabCase: '使用连字符',         // /user-profiles ✅, /user_profiles ❌
  lowercase: '全小写',             // /users ✅, /Users ❌
  noExtensions: '不使用文件扩展名', // /users ✅, /users.json ❌
  hierarchy: '资源层级不超过 3 层', // /users/123/orders ✅, /users/123/orders/456/items ❌
  actions: '动作用查询参数',       // /users?status=active ✅, /users/active ❌
};
```

### 1.4 HTTP 方法完整语义

```typescript
interface HttpMethodSemantics {
  GET: {
    description: '获取资源（安全 + 幂等）';
    body: '不应包含请求体';
    caching: '可缓存';
    examples: [
      'GET /products          → 200 OK + 产品列表',
      'GET /products/42       → 200 OK + 单个产品',
      'GET /products?cat=1    → 200 OK + 筛选结果',
    ];
  };
  POST: {
    description: '创建资源（不安全 + 非幂等）';
    body: '必须包含请求体';
    response: '201 Created + Location header';
    examples: [
      'POST /products         → 201 Created + 新资源',
      'POST /products/42/reviews → 201 Created + 评论',
    ];
  };
  PUT: {
    description: '全量替换资源（安全 + 幂等）';
    body: '必须包含完整资源';
    examples: [
      'PUT /products/42       → 200 OK (或 204 No Content)',
    ];
  };
  PATCH: {
    description: '部分更新资源（安全 + 非幂等）';
    body: '只包含需要更新的字段';
    examples: [
      'PATCH /products/42     → 200 OK + 更新后资源',
    ];
  };
  DELETE: {
    description: '删除资源（安全 + 幂等）';
    response: '204 No Content (或 200 OK)';
    examples: [
      'DELETE /products/42    → 204 No Content',
    ];
  };
}
```

### 1.5 幂等性（Idempotency）

```
幂等 = 多次执行相同操作，结果不变

GET     ✅ 幂等      读 100 次 = 读 1 次
PUT     ✅ 幂等      设置 name="A" 100 次 = 设置 1 次
DELETE  ✅ 幂等      删除 100 次 = 删除 1 次（后续 404）
POST    ❌ 非幂等    创建 100 次 = 100 条记录
PATCH   ⚠️ 看实现    set → 幂等, increment → 非幂等

// 解决 POST 非幂等：幂等键（Idempotency Key）
POST /api/v1/orders
Headers: { "Idempotency-Key": "uuid-v4-xxx" }
// 重复请求返回相同结果，不重复创建
```

---

## 2. GraphQL 设计原则

### 2.1 核心概念

```
GraphQL = Query（查询）+ Mutation（变更）+ Subscription（订阅）
核心：客户端决定需要什么数据，服务端精确返回
```

```graphql
# Schema 定义
type Query {
  user(id: ID!): User
  users(filter: UserFilter, pagination: PaginationInput): UserConnection!
  dashboard(id: ID!): Dashboard
  dashboards(workspaceId: ID!): [Dashboard!]!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): DeletePayload!
  createWidget(input: CreateWidgetInput!): Widget!
}

type Subscription {
  widgetUpdated(dashboardId: ID!): Widget!
  notificationCreated(userId: ID!): Notification!
}

# 类型定义
type User {
  id: ID!
  name: String!
  email: String!
  role: UserRole!
  createdAt: DateTime!
  updatedAt: DateTime!
  workspaces: [Workspace!]!
  notifications: [Notification!]!
}

enum UserRole {
  ADMIN
  EDITOR
  VIEWER
}

# 输入类型
input CreateUserInput {
  name: String!
  email: String!
  role: UserRole!
  workspaceIds: [ID!]
}

input UserFilter {
  role: UserRole
  search: String
  createdAt: DateRange
}

input PaginationInput {
  first: Int
  after: String
  last: Int
  before: String
}

# Relay 风格分页
type UserConnection {
  pageInfo: PageInfo!
  edges: [UserEdge!]!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

### 2.2 Query 示例

```graphql
# 查询用户及其工作区
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    role
    workspaces {
      id
      name
      dashboards {
        id
        title
        widgets {
          id
          type
          config
        }
      }
    }
  }
}

# 分页查询 + 过滤
query GetUsers($filter: UserFilter, $pagination: PaginationInput) {
  users(filter: $filter, pagination: $pagination) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        name
        role
        createdAt
      }
    }
  }
}

# 变量
{
  "id": "user-123",
  "filter": { "role": "ADMIN" },
  "pagination": { "first": 20, "after": "cursor-xyz" }
}
```

### 2.3 Mutation 示例

```graphql
# 创建用户
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
    name
    email
    role
    createdAt
  }
}

# 更新 Widget
mutation UpdateWidget($id: ID!, $input: UpdateWidgetInput!) {
  updateWidget(id: $id, input: $input) {
    id
    type
    config
    updatedAt
  }
}

# 批量操作（使用列表输入）
mutation BulkDeleteDashboards($ids: [ID!]!) {
  bulkDeleteDashboards(ids: $ids) {
    successCount
    failedIds
  }
}
```

### 2.4 Subscription 示例

```graphql
# 实时订阅 Widget 更新
subscription OnWidgetUpdated($dashboardId: ID!) {
  widgetUpdated(dashboardId: $dashboardId) {
    id
    type
    config
    updatedAt
  }
}

# 实时订阅通知
subscription OnNotificationCreated($userId: ID!) {
  notificationCreated(userId: $userId) {
    id
    title
    message
    read
    createdAt
  }
}
```

### 2.5 GraphQL 设计最佳实践

```typescript
const GRAPHQL_RULES = {
  schema: {
    strongTyping: '所有字段强类型，非空用 ! 标注',
    inputTypes: 'Mutation 使用 Input 类型，不直接用标量',
    connectionPattern: '列表使用 Relay Connection 模式（分页标准）',
    errorHandling: '使用统一错误包装器，不在 data 中混入错误',
    naming: '类型用 PascalCase, 字段用 camelCase, 枚举用 PascalCase',
  },
  query: {
    avoidNPlusOne: '使用 DataLoader 批量加载，避免 N+1 问题',
    complexityLimit: '设置查询复杂度限制（如 max 1000）',
    depthLimit: '设置查询深度限制（如 max 7）',
    fieldLevelAuth: '字段级权限控制，敏感字段按需暴露',
  },
  mutation: {
    singleResource: '每个 Mutation 只操作一个资源',
    inputValidation: 'Input 类型做服务端验证',
    optimisticUpdates: '客户端支持乐观更新',
  },
  performance: {
    caching: '持久查询（Persisted Queries）+ CDN 缓存',
    batching: 'DataLoader 批量 + 缓存',
    pagination: '游标分页 > 偏移分页（大数据量）',
    introspection: '生产环境关闭 introspection',
  },
};
```

---

## 3. REST vs GraphQL 选型决策

### 3.1 对比矩阵

```
┌─────────────────┬──────────────────────┬──────────────────────┐
│      维度        │       REST           │       GraphQL        │
├─────────────────┼──────────────────────┼──────────────────────┤
│ 数据获取         │ 多次请求（over/under）│ 一次请求精确数据      │
│ 缓存            │ HTTP 原生缓存         │ 需要客户端缓存策略    │
│ 版本管理         │ URL 版本化 (/v1/)    │ 向后兼容添加字段      │
│ 学习曲线         │ 低（HTTP 标准）       │ 中（Schema/查询语言） │
│ 文件上传         │ 原生支持 (multipart)  │ 需要扩展 (Apollo)     │
│ 实时数据         │ SSE / WebSocket      │ Subscription 原生    │
│ 批量操作         │ 需要多次请求          │ 单个 Mutation 支持    │
│ 工具生态         │ Swagger/OpenAPI      │ GraphQL Codegen      │
│ 缓存降级         │ CDN 层直接缓存        │ 需要智能缓存层        │
│ 移动端友好度      │ 中（可能 over-fetch） │ 高（精确数据量）      │
│ 团队熟悉度       │ 高（行业标准）        │ 中（需学习）          │
└─────────────────┴──────────────────────┴──────────────────────┘
```

### 3.2 选型决策树

```
                    ┌─────────────────┐
                    │  项目需求分析    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    移动端/H5  │    复杂数据   │    简单 CRUD │
    数据多变   │    关联深     │    结构固定   │
              │              │              │
         ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
         │GraphQL  │   │GraphQL  │   │ RESTful │
         │ ✓ 优选   │   │ ✓ 优选   │   │ ✓ 优选   │
         └─────────┘   └─────────┘   └─────────┘

    决策因素权重：
    - 数据获取效率：GraphQL +3, REST 0
    - 缓存简单性：REST +3, GraphQL 0
    - 团队熟悉度：REST +2, GraphQL -1
    - 实时需求：GraphQL +2 (Subscription)
    - 文件上传：REST +2
    - 版本管理：GraphQL +1 (向后兼容)
```

### 3.3 CloudBoard 混合方案

```
CloudBoard API 架构 = REST + GraphQL + WebSocket

┌─────────────────────────────────────────────────┐
│                  API Gateway                     │
│          (路由 + 认证 + 限流 + 日志)              │
└──────┬──────────────────────┬───────────────────┘
       │                      │
  ┌────▼──── REST ────────────┼─── GraphQL ──────┐
  │                           │                    │
  │  • 文件上传/下载           │  • 仪表盘查询      │
  │  • 简单 CRUD               │  • 复杂关联查询    │
  │  • 健康检查                │  • 动态数据聚合    │
  │  • 公开 API                │  • 灵活字段选择    │
  │  • 第三方集成              │  • 移动端优化      │
  │                           │                    │
  └───────────────────────────┴────────────────────┘
                              │
                        WebSocket (实时)
                        • Widget 实时更新
                        • 协作编辑
                        • 通知推送
```

---

## 4. CloudBoard 完整 API 设计

### 4.1 资源模型

```
CloudBoard 核心资源：

Workspace（工作区）
  ├── Dashboard（仪表盘）
  │     ├── Widget（组件）
  │     │     ├── DataSource（数据源）
  │     │     └── Config（配置）
  │     └── ShareLink（分享链接）
  ├── User（用户）
  │     ├── Role（角色）
  │     └── Permission（权限）
  └── Team（团队）
        └── Member（成员）
```

### 4.2 RESTful API 完整设计

#### 4.2.1 认证 API

```
# ==================== 认证 ====================

# 登录
POST   /api/v1/auth/login
Request:  { "email": "user@example.com", "password": "..." }
Response: { "accessToken": "jwt...", "refreshToken": "...", "expiresIn": 3600 }

# 注册
POST   /api/v1/auth/register
Request:  { "name": "张三", "email": "...", "password": "...", "workspaceName": "我的空间" }
Response: { "user": {...}, "accessToken": "...", "refreshToken": "..." }

# Token 刷新
POST   /api/v1/auth/refresh
Request:  { "refreshToken": "..." }
Response: { "accessToken": "...", "expiresIn": 3600 }

# 登出
POST   /api/v1/auth/logout
Headers: { "Authorization": "Bearer <token>" }
Response: { "success": true }

# 忘记密码
POST   /api/v1/auth/forgot-password
Request:  { "email": "user@example.com" }
Response: { "message": "重置邮件已发送" }

# 重置密码
POST   /api/v1/auth/reset-password
Request:  { "token": "...", "newPassword": "..." }
Response: { "message": "密码已重置" }

# 获取当前用户
GET    /api/v1/auth/me
Headers: { "Authorization": "Bearer <token>" }
Response: { "user": {...} }
```

#### 4.2.2 工作区 API

```
# ==================== 工作区 ====================

# 列出工作区
GET    /api/v1/workspaces
Query:   ?page=1&limit=20&sort=createdAt:desc
Response: { "data": [...], "meta": { "total": 50, "page": 1, "limit": 20 } }

# 创建工作区
POST   /api/v1/workspaces
Request:  { "name": "数据分析", "description": "...", "visibility": "private" }
Response: { "data": {...}, "status": 201 }

# 获取工作区详情
GET    /api/v1/workspaces/:id
Response: { "data": {...} }

# 更新工作区
PATCH  /api/v1/workspaces/:id
Request:  { "name": "新名称", "description": "..." }
Response: { "data": {...} }

# 删除工作区
DELETE /api/v1/workspaces/:id
Response: { "message": "工作区已删除" }

# 工作区成员列表
GET    /api/v1/workspaces/:id/members
Query:   ?role=admin&search=张
Response: { "data": [...], "meta": {...} }

# 邀请成员
POST   /api/v1/workspaces/:id/members
Request:  { "email": "new@example.com", "role": "editor" }
Response: { "data": {...}, "inviteToken": "..." }

# 更新成员角色
PATCH  /api/v1/workspaces/:id/members/:memberId
Request:  { "role": "admin" }
Response: { "data": {...} }

# 移除成员
DELETE /api/v1/workspaces/:id/members/:memberId
Response: { "message": "成员已移除" }
```

#### 4.2.3 仪表盘 API

```
# ==================== 仪表盘 ====================

# 列出仪表盘
GET    /api/v1/workspaces/:workspaceId/dashboards
Query:   ?search=销售&sort=updatedAt:desc&tag=report
Response: { "data": [...], "meta": {...} }

# 创建仪表盘
POST   /api/v1/workspaces/:workspaceId/dashboards
Request:  {
            "title": "销售数据看板",
            "description": "实时销售数据",
            "tags": ["销售", "实时"],
            "layout": { "grid": "24x12", "autoArrange": true }
          }
Response: { "data": {...}, "status": 201 }

# 获取仪表盘详情
GET    /api/v1/workspaces/:workspaceId/dashboards/:id
Query:   ?include=widgets,shares
Response: { "data": {...} }

# 更新仪表盘
PATCH  /api/v1/workspaces/:workspaceId/dashboards/:id
Request:  { "title": "新标题", "layout": {...} }
Response: { "data": {...} }

# 删除仪表盘
DELETE /api/v1/workspaces/:workspaceId/dashboards/:id
Response: { "message": "仪表盘已删除" }

# 复制仪表盘
POST   /api/v1/workspaces/:workspaceId/dashboards/:id/duplicate
Request:  { "title": "销售数据看板 (副本)" }
Response: { "data": {...}, "status": 201 }

# 仪表盘统计
GET    /api/v1/workspaces/:workspaceId/dashboards/:id/stats
Response: {
            "views": 1234,
            "widgets": 8,
            "lastAccessed": "2026-04-25T20:00:00Z",
            "collaborators": 3
          }
```

#### 4.2.4 Widget 组件 API

```
# ==================== Widget 组件 ====================

# 列出 Widget
GET    /api/v1/workspaces/:workspaceId/dashboards/:dashboardId/widgets
Query:   ?type=chart&sort=position:asc
Response: { "data": [...], "meta": {...} }

# 创建 Widget
POST   /api/v1/workspaces/:workspaceId/dashboards/:dashboardId/widgets
Request:  {
            "type": "line-chart",
            "title": "月度销售额",
            "position": { "x": 0, "y": 0, "w": 12, "h": 6 },
            "dataSource": {
              "type": "api",
              "endpoint": "/api/v1/data/sales",
              "params": { "groupBy": "month" }
            },
            "config": {
              "xAxis": "month",
              "yAxis": "amount",
              "color": "#1890ff",
              "smooth": true
            }
          }
Response: { "data": {...}, "status": 201 }

# 获取 Widget
GET    /api/v1/workspaces/:workspaceId/dashboards/:dashboardId/widgets/:id
Response: { "data": {...} }

# 更新 Widget
PATCH  /api/v1/workspaces/:workspaceId/dashboards/:dashboardId/widgets/:id
Request:  { "config": { "color": "#52c41a" }, "position": {...} }
Response: { "data": {...} }

# 删除 Widget
DELETE /api/v1/workspaces/:workspaceId/dashboards/:dashboardId/widgets/:id
Response: { "message": "Widget 已删除" }

# 批量更新 Widget 位置（拖拽布局保存）
PATCH  /api/v1/workspaces/:workspaceId/dashboards/:dashboardId/widgets/batch
Request:  [
            { "id": "w1", "position": { "x": 0, "y": 0, "w": 8, "h": 4 } },
            { "id": "w2", "position": { "x": 8, "y": 0, "w": 8, "h": 4 } }
          ]
Response: { "data": [...], "updated": 2 }

# Widget 数据查询（获取渲染数据）
GET    /api/v1/workspaces/:workspaceId/dashboards/:dashboardId/widgets/:id/data
Query:   ?timeRange=7d&refresh=true
Response: {
            "data": [
              { "month": "2026-01", "amount": 120000 },
              { "month": "2026-02", "amount": 150000 }
            ],
            "meta": { "cached": false, "refreshedAt": "..." }
          }
```

#### 4.2.5 数据源 API

```
# ==================== 数据源 ====================

# 列出数据源
GET    /api/v1/workspaces/:workspaceId/data-sources
Query:   ?type=api&status=connected
Response: { "data": [...], "meta": {...} }

# 创建数据源
POST   /api/v1/workspaces/:workspaceId/data-sources
Request:  {
            "name": "Sales API",
            "type": "api",
            "config": {
              "baseUrl": "https://api.example.com",
              "auth": { "type": "bearer", "token": "..." },
              "headers": { "X-API-Key": "..." }
            }
          }
Response: { "data": {...}, "status": 201 }

# 测试数据源连接
POST   /api/v1/workspaces/:workspaceId/data-sources/:id/test
Response: { "status": "connected", "latency": 45, "message": "连接成功" }

# 同步数据源
POST   /api/v1/workspaces/:workspaceId/data-sources/:id/sync
Response: { "jobId": "...", "status": "queued" }

# 同步状态
GET    /api/v1/workspaces/:workspaceId/data-sources/:id/sync/:jobId
Response: { "status": "completed", "recordsSynced": 1500, "errors": [] }
```

#### 4.2.6 分享 API

```
# ==================== 分享 ====================

# 创建分享链接
POST   /api/v1/workspaces/:workspaceId/dashboards/:id/shares
Request:  {
            "permission": "view",
            "expiresAt": "2026-05-25T00:00:00Z",
            "password": "optional"
          }
Response: { "shareToken": "...", "url": "/share/xxx" }

# 获取分享链接列表
GET    /api/v1/workspaces/:workspaceId/dashboards/:id/shares
Response: { "data": [...] }

# 删除分享链接
DELETE /api/v1/workspaces/:workspaceId/dashboards/:id/shares/:shareId
Response: { "message": "分享链接已删除" }

# 公开访问（无需登录）
GET    /api/v1/share/:shareToken
Response: { "dashboard": {...}, "widgets": [...] }
```

### 4.3 GraphQL Schema 完整设计

```graphql
# ==================== CloudBoard GraphQL Schema ====================

# ---- Query ----
type Query {
  # 认证
  me: User

  # 工作区
  workspace(id: ID!): Workspace
  workspaces(
    filter: WorkspaceFilter
    pagination: PaginationInput
    sort: [SortInput!]
  ): WorkspaceConnection!

  # 仪表盘
  dashboard(id: ID!): Dashboard
  dashboards(
    workspaceId: ID!
    filter: DashboardFilter
    pagination: PaginationInput
  ): DashboardConnection!

  # Widget
  widget(id: ID!): Widget
  widgetData(
    id: ID!
    timeRange: TimeRangeInput
    refresh: Boolean
  ): WidgetData!

  # 数据源
  dataSource(id: ID!): DataSource
  dataSources(workspaceId: ID!): [DataSource!]!

  # 搜索（跨资源）
  search(
    query: String!
    types: [SearchType!]
    limit: Int
  ): [SearchResult!]!
}

# ---- Mutation ----
type Mutation {
  # 认证
  login(email: String!, password: String!): AuthPayload!
  register(input: RegisterInput!): AuthPayload!
  refreshToken(refreshToken: String!): TokenPayload!
  logout: LogoutPayload!
  forgotPassword(email: String!): MessagePayload!
  resetPassword(token: String!, newPassword: String!): MessagePayload!

  # 工作区
  createWorkspace(input: CreateWorkspaceInput!): WorkspacePayload!
  updateWorkspace(id: ID!, input: UpdateWorkspaceInput!): WorkspacePayload!
  deleteWorkspace(id: ID!): DeletePayload!
  inviteMember(workspaceId: ID!, input: InviteMemberInput!): MemberPayload!
  updateMember(workspaceId: ID!, memberId: ID!, role: UserRole!): MemberPayload!
  removeMember(workspaceId: ID!, memberId: ID!): DeletePayload!

  # 仪表盘
  createDashboard(workspaceId: ID!, input: CreateDashboardInput!): DashboardPayload!
  updateDashboard(id: ID!, input: UpdateDashboardInput!): DashboardPayload!
  deleteDashboard(id: ID!): DeletePayload!
  duplicateDashboard(id: ID!, title: String!): DashboardPayload!

  # Widget
  createWidget(dashboardId: ID!, input: CreateWidgetInput!): WidgetPayload!
  updateWidget(id: ID!, input: UpdateWidgetInput!): WidgetPayload!
  deleteWidget(id: ID!): DeletePayload!
  batchUpdateWidgets(dashboardId: ID!, updates: [WidgetPositionUpdate!]!): [Widget!]!

  # 数据源
  createDataSource(workspaceId: ID!, input: CreateDataSourceInput!): DataSourcePayload!
  testDataSource(id: ID!): TestResultPayload!
  syncDataSource(id: ID!): SyncPayload!

  # 分享
  createShare(dashboardId: ID!, input: CreateShareInput!): SharePayload!
  deleteShare(dashboardId: ID!, shareId: ID!): DeletePayload!
}

# ---- Subscription ----
type Subscription {
  widgetUpdated(dashboardId: ID!): WidgetUpdateEvent!
  dashboardDeleted(workspaceId: ID!): DashboardDeleteEvent!
  notificationCreated: Notification!
  collaborationUpdate(dashboardId: ID!): CollaborationEvent!
}

# ---- Types ----

type User {
  id: ID!
  name: String!
  email: String!
  avatar: String
  role: UserRole!
  createdAt: DateTime!
  updatedAt: DateTime!
  workspaces: [WorkspaceMember!]!
}

type Workspace {
  id: ID!
  name: String!
  description: String
  visibility: WorkspaceVisibility!
  owner: User!
  memberCount: Int!
  dashboardCount: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
  members: [WorkspaceMember!]
  dashboards: [Dashboard!]
}

type WorkspaceMember {
  user: User!
  role: UserRole!
  joinedAt: DateTime!
}

type Dashboard {
  id: ID!
  title: String!
  description: String
  tags: [String!]!
  layout: DashboardLayout!
  owner: User!
  widgets: [Widget!]
  shares: [ShareLink!]
  stats: DashboardStats
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Widget {
  id: ID!
  type: WidgetType!
  title: String!
  position: WidgetPosition!
  dataSource: WidgetDataSource
  config: JSON
  dashboardId: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type WidgetData {
  data: JSON!
  meta: DataMeta!
}

type DataMeta {
  cached: Boolean!
  refreshedAt: DateTime
  recordCount: Int!
  latency: Int
}

type DataSource {
  id: ID!
  name: String!
  type: DataSourceType!
  config: JSON
  status: DataSourceStatus!
  lastSyncedAt: DateTime
  recordCount: Int
  createdAt: DateTime!
}

type ShareLink {
  id: ID!
  permission: SharePermission!
  url: String!
  expiresAt: DateTime
  createdAt: DateTime!
}

type DashboardStats {
  views: Int!
  lastAccessed: DateTime
  collaborators: Int!
}

# ---- Payload Types ----

type AuthPayload {
  user: User!
  accessToken: String!
  refreshToken: String!
  expiresIn: Int!
}

type TokenPayload {
  accessToken: String!
  expiresIn: Int!
}

type WorkspacePayload {
  data: Workspace!
}

type DashboardPayload {
  data: Dashboard!
}

type WidgetPayload {
  data: Widget!
}

type DataSourcePayload {
  data: DataSource!
}

type MemberPayload {
  data: WorkspaceMember!
}

type SharePayload {
  data: ShareLink!
}

type DeletePayload {
  success: Boolean!
  message: String!
}

type MessagePayload {
  message: String!
}

type TestResultPayload {
  status: String!
  latency: Int
  message: String!
}

type SyncPayload {
  jobId: ID!
  status: String!
}

type LogoutPayload {
  success: Boolean!
}

# ---- Input Types ----

input WorkspaceFilter {
  search: String
  visibility: WorkspaceVisibility
  tag: String
}

input DashboardFilter {
  search: String
  tag: String
  createdBy: ID
}

input PaginationInput {
  first: Int
  after: String
  last: Int
  before: String
  page: Int
  limit: Int
}

input SortInput {
  field: String!
  direction: SortDirection!
}

input CreateWorkspaceInput {
  name: String!
  description: String
  visibility: WorkspaceVisibility
}

input UpdateWorkspaceInput {
  name: String
  description: String
  visibility: WorkspaceVisibility
}

input CreateDashboardInput {
  title: String!
  description: String
  tags: [String!]
  layout: DashboardLayoutInput
}

input UpdateDashboardInput {
  title: String
  description: String
  tags: [String!]
  layout: DashboardLayoutInput
}

input CreateWidgetInput {
  type: WidgetType!
  title: String!
  position: WidgetPositionInput!
  dataSource: WidgetDataSourceInput
  config: JSON
}

input UpdateWidgetInput {
  title: String
  position: WidgetPositionInput
  dataSource: WidgetDataSourceInput
  config: JSON
}

input WidgetPositionInput {
  x: Int!
  y: Int!
  w: Int!
  h: Int!
}

input WidgetDataSourceInput {
  type: String!
  endpoint: String!
  params: JSON
}

input WidgetPositionUpdate {
  id: ID!
  position: WidgetPositionInput!
}

input CreateDataSourceInput {
  name: String!
  type: DataSourceType!
  config: JSON!
}

input InviteMemberInput {
  email: String!
  role: UserRole!
}

input CreateShareInput {
  permission: SharePermission
  expiresAt: DateTime
  password: String
}

input TimeRangeInput {
  start: DateTime!
  end: DateTime!
  granularity: TimeGranularity
}

input RegisterInput {
  name: String!
  email: String!
  password: String!
  workspaceName: String
}

# ---- Enums ----

enum UserRole {
  ADMIN
  EDITOR
  VIEWER
}

enum WorkspaceVisibility {
  PRIVATE
  TEAM
  PUBLIC
}

enum WidgetType {
  LINE_CHART
  BAR_CHART
  PIE_CHART
  TABLE
  STAT_CARD
  MAP
  TEXT
  IFRAME
}

enum DataSourceType {
  API
  DATABASE
  CSV
  GOOGLE_SHEETS
  WEBHOOK
}

enum DataSourceStatus {
  CONNECTED
  DISCONNECTED
  SYNCING
  ERROR
}

enum SharePermission {
  VIEW
  EDIT
}

enum SortDirection {
  ASC
  DESC
}

enum TimeGranularity {
  MINUTE
  HOUR
  DAY
  WEEK
  MONTH
}

enum SearchType {
  WORKSPACE
  DASHBOARD
  WIDGET
  DATA_SOURCE
}

# ---- Events (Subscription payloads) ----

type WidgetUpdateEvent {
  widgetId: ID!
  dashboardId: ID!
  type: WidgetUpdateType!
  data: Widget
  updatedAt: DateTime!
}

type DashboardDeleteEvent {
  dashboardId: ID!
  workspaceId: ID!
  deletedAt: DateTime!
}

type CollaborationEvent {
  dashboardId: ID!
  userId: ID!
  action: String!
  position: WidgetPosition
  timestamp: DateTime!
}

enum WidgetUpdateType {
  CREATED
  UPDATED
  DELETED
  MOVED
  RESIZED
}

# ---- Connection Types (Relay Style) ----

type WorkspaceConnection {
  pageInfo: PageInfo!
  edges: [WorkspaceEdge!]!
}

type WorkspaceEdge {
  node: Workspace!
  cursor: String!
}

type DashboardConnection {
  pageInfo: PageInfo!
  edges: [DashboardEdge!]!
}

type DashboardEdge {
  node: Dashboard!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
  total: Int
}

# ---- Search ----

union SearchResult = Workspace | Dashboard | Widget | DataSource

type SearchMeta {
  query: String!
  total: Int!
  took: Int!
}

# ---- Custom Scalars ----

scalar DateTime
scalar JSON
```

---

## 5. API 安全设计

### 5.1 认证与授权

```
认证流程（JWT + Refresh Token）:

1. 登录 → 获得 accessToken (15min) + refreshToken (7d)
2. 请求 → Header: Authorization: Bearer <accessToken>
3. Token 过期 → 401 → 用 refreshToken 换新的 accessToken
4. Refresh Token 过期 → 重新登录
5. 登出 → refreshToken 加入黑名单

安全机制:
├── JWT accessToken: 短期 (15min), 无状态验证
├── Refresh Token: 长期 (7d), 服务端存储可撤销
├── HTTP Only Cookie: refreshToken 存 HttpOnly Cookie
├── CSRF Token: 表单类请求需要
├── Rate Limiting: 按 IP + 用户限流
├── CORS: 白名单域名
└── Input Validation: 所有输入验证 + 净化
```

### 5.2 权限模型（RBAC + ABAC）

```typescript
// RBAC: 基于角色的访问控制
const ROLES = {
  ADMIN: {
    workspaces: ['create', 'read', 'update', 'delete'],
    dashboards: ['create', 'read', 'update', 'delete', 'share'],
    widgets: ['create', 'read', 'update', 'delete'],
    members: ['invite', 'update', 'remove'],
    dataSources: ['create', 'read', 'update', 'delete', 'sync'],
  },
  EDITOR: {
    workspaces: ['read'],
    dashboards: ['create', 'read', 'update'],
    widgets: ['create', 'read', 'update', 'delete'],
    members: [],
    dataSources: ['create', 'read', 'update', 'sync'],
  },
  VIEWER: {
    workspaces: ['read'],
    dashboards: ['read'],
    widgets: ['read'],
    members: [],
    dataSources: ['read'],
  },
};

// ABAC: 基于属性的访问控制（补充规则）
const ABAC_RULES = {
  // 只能操作自己创建的仪表盘（非 ADMIN）
  'dashboard:delete': 'resource.ownerId == user.id || user.role == ADMIN',
  // 只能查看有权限的工作区
  'workspace:read': 'user.workspaces.contains(resource.id)',
  // 分享链接过期后不可访问
  'share:view': 'resource.expiresAt > now()',
  // 敏感数据需要额外权限
  'widget:data': 'resource.config.sensitive == false || user.role == ADMIN',
};
```

### 5.3 限流策略

```typescript
const RATE_LIMITS = {
  // 全局限流
  global: {
    window: '1m',
    max: 1000,
  },
  // 认证端点（更严格）
  auth: {
    '/api/v1/auth/login': { window: '15m', max: 10 },
    '/api/v1/auth/register': { window: '1h', max: 5 },
    '/api/v1/auth/forgot-password': { window: '1h', max: 3 },
  },
  // 用户级别
  user: {
    window: '1m',
    max: 100,
  },
  // GraphQL 复杂度限流
  graphql: {
    maxComplexity: 1000,
    maxDepth: 7,
    window: '1m',
    max: 200,
  },
};

// 响应头
// X-RateLimit-Limit: 100
// X-RateLimit-Remaining: 95
// X-RateLimit-Reset: 1714060860
```

---

## 6. API 版本管理

### 6.1 版本策略

```
版本策略：URL 路径版本化（REST）+ 向后兼容（GraphQL）

REST:
  /api/v1/...  → 当前稳定版
  /api/v2/...  → 新版（并行运行，v1 保留 12 个月）
  /api/v1/...  → 废弃提示（响应头 + 文档标注）

GraphQL:
  不版本化！通过 Schema 演进：
  - 新增字段：直接添加（向后兼容）
  - 废弃字段：@deprecated 标注
  - 删除字段：废弃 6 个月后删除
  - 类型变更：新增类型，废弃旧类型

版本生命周期:
  发布 → 稳定 (12 个月) → 废弃 (6 个月) → 下线
```

### 6.2 版本响应头

```
HTTP/1.1 200 OK
Content-Type: application/json
X-API-Version: v1
X-API-Deprecated: false
X-API-Sunset: 2027-04-25T00:00:00Z
Link: </api/v2/users>; rel="successor-version"
```

---

## 7. API 文档规范

### 7.1 OpenAPI 3.0 规范（REST）

```yaml
openapi: "3.0.3"
info:
  title: CloudBoard API
  version: "1.0.0"
  description: 企业级数据分析平台 API
  contact:
    name: API Support
    email: api-support@cloudboard.io

servers:
  - url: https://api.cloudboard.io/api/v1
    description: 生产环境
  - url: https://api-staging.cloudboard.io/api/v1
    description: 测试环境

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
          minLength: 1
          maxLength: 50
        email:
          type: string
          format: email
        role:
          type: string
          enum: [ADMIN, EDITOR, VIEWER]
        createdAt:
          type: string
          format: date-time
      required: [id, name, email, role, createdAt]

    Error:
      type: object
      properties:
        code:
          type: string
          example: "VALIDATION_ERROR"
        message:
          type: string
          example: "邮箱格式不正确"
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
      required: [code, message]

    PaginationMeta:
      type: object
      properties:
        total:
          type: integer
        page:
          type: integer
        limit:
          type: integer
        totalPages:
          type: integer

  parameters:
    PageParam:
      name: page
      in: query
      schema:
        type: integer
        minimum: 1
        default: 1
    LimitParam:
      name: limit
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20
    SortParam:
      name: sort
      in: query
      schema:
        type: string
        pattern: "^[a-zA-Z]+:(asc|desc)$"

paths:
  /workspaces/{workspaceId}/dashboards:
    get:
      operationId: listDashboards
      summary: 列出仪表盘
      tags: [Dashboards]
      security:
        - bearerAuth: []
      parameters:
        - name: workspaceId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - $ref: '#/components/parameters/PageParam'
        - $ref: '#/components/parameters/LimitParam'
        - $ref: '#/components/parameters/SortParam'
        - name: search
          in: query
          schema:
            type: string
            maxLength: 100
        - name: tag
          in: query
          schema:
            type: string
      responses:
        "200":
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Dashboard'
                  meta:
                    $ref: '#/components/schemas/PaginationMeta'
        "401":
          description: 未认证
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        "403":
          description: 无权限
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    post:
      operationId: createDashboard
      summary: 创建仪表盘
      tags: [Dashboards]
      security:
        - bearerAuth: []
      parameters:
        - name: workspaceId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                title:
                  type: string
                  minLength: 1
                  maxLength: 100
                description:
                  type: string
                  maxLength: 500
                tags:
                  type: array
                  items:
                    type: string
                    maxLength: 30
                  maxItems: 10
              required: [title]
      responses:
        "201":
          description: 创建成功
          headers:
            Location:
              schema:
                type: string
              description: 新资源 URL
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Dashboard'
```

### 7.2 文档生成工具链

```
API 文档工具链:

1. 代码即文档
   - OpenAPI 注解 (tsoa / routing-controllers)
   - GraphQL Schema 即文档

2. 自动生成
   - Swagger UI → 交互式文档
   - Redoc → 美观文档
   - Stoplight → 设计 + 文档

3. 测试同步
   - Prism → Mock Server (基于 OpenAPI)
   - graphql-mock → GraphQL Mock
   - Postman Collection → API 测试

4. 变更检测
   - openapi-diff → API 变更检测
   - graphql-inspector → Schema 变更检测
   - CI 阻断不兼容变更
```

---

## 8. 错误处理与状态码

### 8.1 HTTP 状态码使用规范

```
成功:
  200 OK              → GET/PUT/PATCH 成功
  201 Created         → POST 创建成功
  204 No Content      → DELETE 成功 / PUT 无返回体
  206 Partial Content → 分片下载

客户端错误:
  400 Bad Request     → 请求格式错误 / 验证失败
  401 Unauthorized    → 未认证 / Token 无效
  403 Forbidden       → 已认证但无权限
  404 Not Found       → 资源不存在
  405 Method Not Allowed → 方法不允许
  409 Conflict        → 资源冲突（重复创建）
  422 Unprocessable   → 语义错误（验证通过但业务规则不满足）
  429 Too Many Requests → 限流

服务端错误:
  500 Internal Server Error → 未知错误
  502 Bad Gateway          → 上游服务错误
  503 Service Unavailable  → 服务不可用
  504 Gateway Timeout      → 上游超时
```

### 8.2 统一错误响应格式

```typescript
// 标准错误响应
interface ErrorResponse {
  code: string;       // 机器可读错误码
  message: string;    // 人类可读错误信息
  details?: Array<{   // 详细错误信息（可选）
    field: string;
    message: string;
  }>;
  requestId: string;  // 请求 ID（追踪用）
  timestamp: string;  // 错误时间
}

// 示例
// 400 验证错误
{
  "code": "VALIDATION_ERROR",
  "message": "请求参数验证失败",
  "details": [
    { "field": "email", "message": "邮箱格式不正确" },
    { "field": "password", "message": "密码至少 8 位" }
  ],
  "requestId": "req_abc123",
  "timestamp": "2026-04-25T21:00:00Z"
}

// 401 未认证
{
  "code": "UNAUTHORIZED",
  "message": "认证令牌无效或已过期",
  "requestId": "req_def456",
  "timestamp": "2026-04-25T21:00:00Z"
}

// 403 无权限
{
  "code": "FORBIDDEN",
  "message": "您没有权限执行此操作",
  "requestId": "req_ghi789",
  "timestamp": "2026-04-25T21:00:00Z"
}

// 404 资源不存在
{
  "code": "NOT_FOUND",
  "message": "仪表盘不存在",
  "requestId": "req_jkl012",
  "timestamp": "2026-04-25T21:00:00Z"
}

// 409 冲突
{
  "code": "CONFLICT",
  "message": "该邮箱已被注册",
  "requestId": "req_mno345",
  "timestamp": "2026-04-25T21:00:00Z"
}

// 429 限流
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "请求过于频繁，请稍后重试",
  "retryAfter": 60,
  "requestId": "req_pqr678",
  "timestamp": "2026-04-25T21:00:00Z"
}
```

### 8.3 错误码枚举

```typescript
const ERROR_CODES = {
  // 认证相关
  UNAUTHORIZED: '认证失败',
  TOKEN_EXPIRED: '令牌已过期',
  TOKEN_INVALID: '令牌无效',
  INVALID_CREDENTIALS: '邮箱或密码错误',
  ACCOUNT_DISABLED: '账号已被禁用',

  // 权限相关
  FORBIDDEN: '无权限',
  INSUFFICIENT_ROLE: '角色权限不足',

  // 资源相关
  NOT_FOUND: '资源不存在',
  CONFLICT: '资源冲突',
  ALREADY_EXISTS: '资源已存在',

  // 验证相关
  VALIDATION_ERROR: '参数验证失败',
  INVALID_FORMAT: '格式错误',
  INVALID_ENUM_VALUE: '枚举值无效',

  // 业务相关
  WORKSPACE_FULL: '工作区成员已达上限',
  DASHBOARD_LIMIT_EXCEEDED: '仪表盘数量超限',
  WIDGET_TYPE_NOT_SUPPORTED: '不支持的 Widget 类型',
  DATA_SOURCE_UNAVAILABLE: '数据源不可用',

  // 限流相关
  RATE_LIMIT_EXCEEDED: '请求过于频繁',

  // 服务端
  INTERNAL_ERROR: '服务器内部错误',
  SERVICE_UNAVAILABLE: '服务暂时不可用',
};
```

---

## 9. 分页、过滤、排序

### 9.1 分页方案对比

```
┌──────────────┬─────────────────┬──────────────────┐
│   方案        │  Offset 分页     │  Cursor 分页      │
├──────────────┼─────────────────┼──────────────────┤
│ URL 格式      │ ?page=2&limit=20 │ ?first=20&after=cursor │
│ 优点          │ 简单直观         │ 数据一致性好       │
│               │ 支持跳页         │ 性能好（大偏移）   │
│               │ 适合小数据量     │ 适合实时数据       │
│ 缺点          │ 大偏移性能差      │ 不支持跳页         │
│               │ 数据变化导致重复  │ URL 不直观         │
│ 适用场景      │ 后台管理（<1000） │ 列表/Feed/实时数据 │
│ GraphQL       │ 不推荐           │ ✅ 标准（Relay）   │
└──────────────┴─────────────────┴──────────────────┘
```

### 9.2 过滤设计

```
# 简单过滤（查询参数）
GET /api/v1/dashboards?tag=sales&status=active

# 复合过滤（嵌套参数）
GET /api/v1/dashboards?filter[tags][0]=sales&filter[tags][1]=report
                         &filter[createdBy]=user-123
                         &filter[dateRange][gte]=2026-01-01

# GraphQL 过滤（结构化输入）
query {
  dashboards(
    filter: {
      tags: ["sales", "report"]
      createdBy: "user-123"
      dateRange: { gte: "2026-01-01" }
    }
  ) { ... }
}
```

### 9.3 排序设计

```
# REST 排序
GET /api/v1/dashboards?sort=-createdAt,title   # 降序创建时间，升序标题
GET /api/v1/dashboards?sort=createdAt:desc     # 另一种风格

# GraphQL 排序
query {
  dashboards(sort: [{ field: createdAt, direction: DESC }, { field: title, direction: ASC }]) { ... }
}

# 默认排序
# REST: 服务端定义（如 createdAt:desc）
# GraphQL: Schema 定义默认值
```

---

## 10. 代码示例

### 10.1 REST API 服务端实现（Express + TypeScript）

```typescript
// ==================== REST API 实现 ====================

import express, { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

const app = express();
app.use(express.json());

// ---- 统一响应包装 ----
function successResponse(res: Response, data: any, meta?: any, status = 200) {
  return res.status(status).json({ data, meta });
}

function errorResponse(
  res: Response,
  code: string,
  message: string,
  status: number,
  details?: any[]
) {
  return res.status(status).json({
    code,
    message,
    details,
    requestId: res.locals.requestId,
    timestamp: new Date().toISOString(),
  });
}

// ---- 验证中间件 ----
function validate(request: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const results = await Promise.all(request.map((v: any) => v.run(req)));
    const errors = results.flatMap(r => r.array());
    if (errors.length > 0) {
      return errorResponse(
        res,
        'VALIDATION_ERROR',
        '请求参数验证失败',
        422,
        errors.map(e => ({ field: e.path, message: e.msg }))
      );
    }
    next();
  };
}

// ---- 认证中间件 ----
function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return errorResponse(res, 'UNAUTHORIZED', '未提供认证令牌', 401);
  }
  try {
    const user = verifyToken(token);
    res.locals.user = user;
    next();
  } catch {
    return errorResponse(res, 'TOKEN_INVALID', '令牌无效', 401);
  }
}

// ---- 权限中间件 ----
function authorize(...actions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;
    const workspaceId = req.params.workspaceId;
    const hasPermission = await checkPermission(user, workspaceId, actions);
    if (!hasPermission) {
      return errorResponse(res, 'FORBIDDEN', '无权限执行此操作', 403);
    }
    next();
  };
}

// ---- 错误处理中间件 ----
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(`[${res.locals.requestId}] ${err.stack}`);
  if (err.name === 'ValidationError') {
    return errorResponse(res, 'VALIDATION_ERROR', err.message, 400);
  }
  return errorResponse(res, 'INTERNAL_ERROR', '服务器内部错误', 500);
}

// ---- 仪表盘 API ----

// GET /api/v1/workspaces/:workspaceId/dashboards
app.get(
  '/api/v1/workspaces/:workspaceId/dashboards',
  authenticate,
  authorize('dashboard:read'),
  validate([
    param('workspaceId').isUUID(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().isLength({ max: 100 }),
    query('sort').optional().matches(/^[a-zA-Z]+:(asc|desc)$/),
  ]),
  async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string;
      const sort = req.query.sort as string;

      const [dashboards, total] = await Promise.all([
        db.dashboards.find({
          workspaceId,
          search,
          sort: sort ? parseSort(sort) : { createdAt: 'desc' },
          offset: (page - 1) * limit,
          limit,
        }),
        db.dashboards.count({ workspaceId, search }),
      ]);

      return successResponse(res, dashboards, {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/workspaces/:workspaceId/dashboards
app.post(
  '/api/v1/workspaces/:workspaceId/dashboards',
  authenticate,
  authorize('dashboard:create'),
  validate([
    param('workspaceId').isUUID(),
    body('title').isString().isLength({ min: 1, max: 100 }),
    body('description').optional().isString().isLength({ max: 500 }),
    body('tags').optional().isArray({ max: 10 }),
    body('tags.*').optional().isString().isLength({ max: 30 }),
  ]),
  async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.params;
      const { title, description, tags } = req.body;
      const userId = res.locals.user.id;

      const dashboard = await db.dashboards.create({
        title,
        description,
        tags: tags || [],
        workspaceId,
        ownerId: userId,
      });

      return successResponse(
        res,
        dashboard,
        undefined,
        201
      );
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/workspaces/:workspaceId/dashboards/:id
app.patch(
  '/api/v1/workspaces/:workspaceId/dashboards/:id',
  authenticate,
  authorize('dashboard:update'),
  validate([
    param('workspaceId').isUUID(),
    param('id').isUUID(),
    body('title').optional().isString().isLength({ min: 1, max: 100 }),
    body('description').optional().isString().isLength({ max: 500 }),
    body('tags').optional().isArray({ max: 10 }),
  ]),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const dashboard = await db.dashboards.update(id, {
        ...updates,
        updatedAt: new Date(),
      });

      if (!dashboard) {
        return errorResponse(res, 'NOT_FOUND', '仪表盘不存在', 404);
      }

      return successResponse(res, dashboard);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/workspaces/:workspaceId/dashboards/:id
app.delete(
  '/api/v1/workspaces/:workspaceId/dashboards/:id',
  authenticate,
  authorize('dashboard:delete'),
  validate([
    param('workspaceId').isUUID(),
    param('id').isUUID(),
  ]),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await db.dashboards.delete(id);

      if (!deleted) {
        return errorResponse(res, 'NOT_FOUND', '仪表盘不存在', 404);
      }

      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

app.use(errorHandler);
```

### 10.2 GraphQL Resolver 实现

```typescript
// ==================== GraphQL Resolver 实现 ====================

import { GraphQLResolveInfo } from 'graphql';
import { DataLoader } from './dataloader';

interface Context {
  user: User;
  loaders: {
    userLoader: DataLoader<string, User>;
    workspaceLoader: DataLoader<string, Workspace>;
    dashboardLoader: DataLoader<string, Dashboard>;
    widgetLoader: DataLoader<string, Widget>;
  };
  requestId: string;
}

const resolvers = {
  Query: {
    // 获取当前用户
    me: (_, __, { user }: Context) => user,

    // 获取工作区
    workspace: async (_, { id }: { id: string }, { loaders, user }: Context) => {
      const workspace = await loaders.workspaceLoader.load(id);
      if (!workspace) return null;
      // 权限检查
      if (!hasAccess(user, workspace, 'read')) {
        throw new ForbiddenError('无权限访问此工作区');
      }
      return workspace;
    },

    // 分页查询工作区
    workspaces: async (
      _,
      { filter, pagination, sort }: WorkspaceQueryArgs,
      { user }: Context
    ) => {
      const result = await db.workspaces.findWithPagination({
        filter: { ...filter, memberUserId: user.id },
        pagination: pagination || { first: 20 },
        sort: sort || [{ field: 'createdAt', direction: 'DESC' }],
      });
      return toConnection(result);
    },

    // 获取仪表盘
    dashboard: async (
      _,
      { id, include }: { id: string; include?: string[] },
      { loaders, user }: Context
    ) => {
      const dashboard = await loaders.dashboardLoader.load(id);
      if (!dashboard) return null;
      if (!hasAccess(user, dashboard, 'read')) {
        throw new ForbiddenError('无权限访问此仪表盘');
      }

      // 按需加载关联数据
      if (include?.includes('widgets')) {
        dashboard.widgets = await db.widgets.findByDashboard(id);
      }
      if (include?.includes('shares')) {
        dashboard.shares = await db.shares.findByDashboard(id);
      }
      return dashboard;
    },

    // Widget 数据查询
    widgetData: async (
      _,
      { id, timeRange, refresh }: WidgetDataArgs,
      { user }: Context
    ) => {
      const widget = await db.widgets.findById(id);
      if (!widget) throw new NotFoundError('Widget 不存在');
      if (!hasAccess(user, widget, 'read')) {
        throw new ForbiddenError('无权限');
      }

      // 缓存策略
      if (!refresh) {
        const cached = await cache.get(`widget-data:${id}`);
        if (cached) return cached;
      }

      // 查询数据源
      const data = await queryDataSource(widget.dataSource, timeRange);
      const result = {
        data: data.records,
        meta: {
          cached: false,
          refreshedAt: new Date().toISOString(),
          recordCount: data.records.length,
          latency: data.latency,
        },
      };

      // 缓存 5 分钟
      await cache.set(`widget-data:${id}`, result, 300);
      return result;
    },

    // 跨资源搜索
    search: async (
      _,
      { query, types, limit }: SearchArgs,
      { user }: Context
    ) => {
      const searchTypes = types || ['WORKSPACE', 'DASHBOARD', 'WIDGET'];
      const results: SearchResult[] = [];

      if (searchTypes.includes('WORKSPACE')) {
        const workspaces = await db.workspaces.search(query, user.id, limit);
        results.push(...workspaces);
      }
      if (searchTypes.includes('DASHBOARD')) {
        const dashboards = await db.dashboards.search(query, user.id, limit);
        results.push(...dashboards);
      }
      if (searchTypes.includes('WIDGET')) {
        const widgets = await db.widgets.search(query, user.id, limit);
        results.push(...widgets);
      }

      return results.slice(0, limit || 20);
    },
  },

  Mutation: {
    // 登录
    login: async (_, { email, password }: LoginArgs) => {
      const user = await db.users.findByEmail(email);
      if (!user || !await bcrypt.compare(password, user.passwordHash)) {
        throw new AuthenticationError('邮箱或密码错误');
      }
      if (user.disabled) {
        throw new ForbiddenError('账号已被禁用');
      }

      const accessToken = generateJWT(user, '15m');
      const refreshToken = generateRefreshToken(user);

      await db.refreshTokens.create({
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      return {
        user,
        accessToken,
        refreshToken,
        expiresIn: 900,
      };
    },

    // 创建仪表盘
    createDashboard: async (
      _,
      { workspaceId, input }: CreateDashboardArgs,
      { user }: Context
    ) => {
      // 权限检查
      const workspace = await db.workspaces.findById(workspaceId);
      if (!workspace) throw new NotFoundError('工作区不存在');
      if (!hasAccess(user, workspace, 'dashboard:create')) {
        throw new ForbiddenError('无权限创建工作区');
      }

      // 数量限制
      const count = await db.dashboards.countByWorkspace(workspaceId);
      if (count >= 100) {
        throw new BusinessError('仪表盘数量已达上限 (100)');
      }

      const dashboard = await db.dashboards.create({
        title: input.title,
        description: input.description,
        tags: input.tags || [],
        workspaceId,
        ownerId: user.id,
      });

      return { data: dashboard };
    },

    // 创建 Widget
    createWidget: async (
      _,
      { dashboardId, input }: CreateWidgetArgs,
      { user }: Context
    ) => {
      const dashboard = await db.dashboards.findById(dashboardId);
      if (!dashboard) throw new NotFoundError('仪表盘不存在');
      if (!hasAccess(user, dashboard, 'widget:create')) {
        throw new ForbiddenError('无权限');
      }

      // Widget 类型验证
      const validTypes = [
        'LINE_CHART', 'BAR_CHART', 'PIE_CHART', 'TABLE',
        'STAT_CARD', 'MAP', 'TEXT', 'IFRAME',
      ];
      if (!validTypes.includes(input.type)) {
        throw new ValidationError(`不支持的 Widget 类型: ${input.type}`);
      }

      const widget = await db.widgets.create({
        type: input.type,
        title: input.title,
        position: input.position,
        dataSource: input.dataSource,
        config: input.config,
        dashboardId,
      });

      // 发布订阅事件
      pubsub.publish(`WIDGET_UPDATED:${dashboardId}`, {
        widgetUpdated: {
          widgetId: widget.id,
          dashboardId,
          type: 'CREATED',
          data: widget,
          updatedAt: new Date().toISOString(),
        },
      });

      return { data: widget };
    },

    // 批量更新 Widget 位置
    batchUpdateWidgets: async (
      _,
      { dashboardId, updates }: BatchUpdateWidgetsArgs,
      { user }: Context
    ) => {
      const dashboard = await db.dashboards.findById(dashboardId);
      if (!dashboard) throw new NotFoundError('仪表盘不存在');
      if (!hasAccess(user, dashboard, 'widget:update')) {
        throw new ForbiddenError('无权限');
      }

      const results = await Promise.all(
        updates.map(({ id, position }) =>
          db.widgets.update(id, { position })
        )
      );

      // 发布事件
      pubsub.publish(`WIDGET_UPDATED:${dashboardId}`, {
        widgetUpdated: {
          widgetId: 'batch',
          dashboardId,
          type: 'MOVED',
          updatedAt: new Date().toISOString(),
        },
      });

      return results.filter(Boolean);
    },
  },

  Subscription: {
    widgetUpdated: {
      subscribe: (_, { dashboardId }: { dashboardId: string }, { user }: Context) => {
        // 权限检查
        return pubsub.asyncIterator(`WIDGET_UPDATED:${dashboardId}`);
      },
    },
    notificationCreated: {
      subscribe: (_, __, { user }: Context) => {
        return pubsub.asyncIterator(`NOTIFICATION:${user.id}`);
      },
    },
  },
};
```

### 10.3 客户端 API 封装

```typescript
// ==================== 客户端 API 封装 ====================

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// ---- REST API 客户端 ----
class CloudBoardRESTClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    // 请求拦截器
    this.client.interceptors.request.use(async (config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      config.headers['X-Request-ID'] = crypto.randomUUID();
      return config;
    });

    // 响应拦截器（自动刷新 Token）
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // 401 且未重试过 → 尝试刷新 Token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const response = await axios.post(`${baseUrl}/auth/refresh`, {
              refreshToken: this.refreshToken,
            });
            this.accessToken = response.data.accessToken;
            originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
            return this.client(originalRequest);
          } catch {
            // Refresh 也失败 → 跳转登录
            window.location.href = '/login';
            return Promise.reject(error);
          }
        }

        // 统一错误处理
        const { code, message, details } = error.response?.data || {};
        throw new ApiError(code, message, details, error.response?.status);
      }
    );
  }

  // ---- 认证 ----
  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password });
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    return data;
  }

  async logout() {
    await this.client.post('/auth/logout');
    this.accessToken = null;
    this.refreshToken = null;
  }

  // ---- 工作区 ----
  async getWorkspaces(params?: { page?: number; limit?: number; sort?: string }) {
    const { data } = await this.client.get('/workspaces', { params });
    return data;
  }

  async createWorkspace(input: CreateWorkspaceInput) {
    const { data } = await this.client.post('/workspaces', input);
    return data;
  }

  // ---- 仪表盘 ----
  async getDashboards(
    workspaceId: string,
    params?: { page?: number; limit?: number; search?: string; sort?: string }
  ) {
    const { data } = await this.client.get(
      `/workspaces/${workspaceId}/dashboards`,
      { params }
    );
    return data;
  }

  async createDashboard(workspaceId: string, input: CreateDashboardInput) {
    const { data } = await this.client.post(
      `/workspaces/${workspaceId}/dashboards`,
      input
    );
    return data;
  }

  async updateDashboard(workspaceId: string, id: string, input: Partial<UpdateDashboardInput>) {
    const { data } = await this.client.patch(
      `/workspaces/${workspaceId}/dashboards/${id}`,
      input
    );
    return data;
  }

  async deleteDashboard(workspaceId: string, id: string) {
    await this.client.delete(`/workspaces/${workspaceId}/dashboards/${id}`);
  }

  // ---- Widget ----
  async getWidgets(workspaceId: string, dashboardId: string) {
    const { data } = await this.client.get(
      `/workspaces/${workspaceId}/dashboards/${dashboardId}/widgets`
    );
    return data;
  }

  async createWidget(
    workspaceId: string,
    dashboardId: string,
    input: CreateWidgetInput
  ) {
    const { data } = await this.client.post(
      `/workspaces/${workspaceId}/dashboards/${dashboardId}/widgets`,
      input
    );
    return data;
  }

  async batchUpdateWidgets(
    workspaceId: string,
    dashboardId: string,
    updates: WidgetPositionUpdate[]
  ) {
    const { data } = await this.client.patch(
      `/workspaces/${workspaceId}/dashboards/${dashboardId}/widgets/batch`,
      updates
    );
    return data;
  }

  async getWidgetData(
    workspaceId: string,
    dashboardId: string,
    widgetId: string,
    params?: { timeRange?: string; refresh?: boolean }
  ) {
    const { data } = await this.client.get(
      `/workspaces/${workspaceId}/dashboards/${dashboardId}/widgets/${widgetId}/data`,
      { params }
    );
    return data;
  }
}

// ---- GraphQL 客户端 ----
class CloudBoardGraphQLClient {
  private url: string;
  private accessToken: string | null = null;

  constructor(url: string) {
    this.url = url;
  }

  private async request<T>(query: string, variables?: any): Promise<T> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    if (result.errors) {
      const error = result.errors[0];
      throw new ApiError(
        error.extensions?.code || 'GRAPHQL_ERROR',
        error.message,
        error.extensions?.details
      );
    }

    return result.data;
  }

  // ---- 查询 ----
  async getDashboard(id: string, include?: string[]) {
    return this.request<{ dashboard: Dashboard }>(`
      query GetDashboard($id: ID!, $include: [String!]) {
        dashboard(id: $id, include: $include) {
          id
          title
          description
          tags
          layout
          owner { id name email }
          widgets @include(if: $includeWidgets) {
            id
            type
            title
            position
            config
          }
          shares @include(if: $includeShares) {
            id
            permission
            url
            expiresAt
          }
          stats {
            views
            lastAccessed
            collaborators
          }
          createdAt
          updatedAt
        }
      }
    `, { id, include });
  }

  async getDashboards(workspaceId: string, filter?: any, pagination?: any) {
    return this.request<{ dashboards: DashboardConnection }>(`
      query GetDashboards($workspaceId: ID!, $filter: DashboardFilter, $pagination: PaginationInput) {
        dashboards(workspaceId: $workspaceId, filter: $filter, pagination: $pagination) {
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
            total
          }
          edges {
            node {
              id
              title
              description
              tags
              owner { id name }
              stats { views collaborators }
              createdAt
              updatedAt
            }
            cursor
          }
        }
      }
    `, { workspaceId, filter, pagination });
  }

  async getWidgetData(id: string, timeRange?: any, refresh = false) {
    return this.request<{ widgetData: WidgetData }>(`
      query GetWidgetData($id: ID!, $timeRange: TimeRangeInput, $refresh: Boolean) {
        widgetData(id: $id, timeRange: $timeRange, refresh: $refresh) {
          data
          meta {
            cached
            refreshedAt
            recordCount
            latency
          }
        }
      }
    `, { id, timeRange, refresh });
  }

  // ---- 变更 ----
  async createDashboard(workspaceId: string, input: CreateDashboardInput) {
    return this.request<{ createDashboard: { data: Dashboard } }>(`
      mutation CreateDashboard($workspaceId: ID!, $input: CreateDashboardInput!) {
        createDashboard(workspaceId: $workspaceId, input: $input) {
          data {
            id
            title
            description
            tags
            createdAt
          }
        }
      }
    `, { workspaceId, input });
  }

  async createWidget(dashboardId: string, input: CreateWidgetInput) {
    return this.request<{ createWidget: { data: Widget } }>(`
      mutation CreateWidget($dashboardId: ID!, $input: CreateWidgetInput!) {
        createWidget(dashboardId: $dashboardId, input: $input) {
          data {
            id
            type
            title
            position
            config
            createdAt
          }
        }
      }
    `, { dashboardId, input });
  }

  async batchUpdateWidgets(dashboardId: string, updates: WidgetPositionUpdate[]) {
    return this.request<{ batchUpdateWidgets: Widget[] }>(`
      mutation BatchUpdateWidgets($dashboardId: ID!, $updates: [WidgetPositionUpdate!]!) {
        batchUpdateWidgets(dashboardId: $dashboardId, updates: $updates) {
          id
          position
          updatedAt
        }
      }
    `, { dashboardId, updates });
  }

  // ---- 订阅 ----
  subscribeWidgetUpdated(
    dashboardId: string,
    onData: (event: WidgetUpdateEvent) => void
  ) {
    // 使用 WebSocket (Apollo Client / graphql-ws)
    const client = new GraphQLClient(this.url.replace('http', 'ws'));
    return client.subscribe(
      `subscription OnWidgetUpdated($dashboardId: ID!) {
        widgetUpdated(dashboardId: $dashboardId) {
          widgetId
          dashboardId
          type
          data { id type title config updatedAt }
          updatedAt
        }
      }`,
      { dashboardId },
      onData
    );
  }
}

// ---- 错误类 ----
class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any[],
    public status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

### 10.4 测试用例

```typescript
// ==================== API 测试用例 ====================

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../app';

describe('Dashboard API', () => {
  let accessToken: string;
  let workspaceId: string;
  let dashboardId: string;

  beforeAll(async () => {
    // 登录获取 Token
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    accessToken = res.body.accessToken;

    // 创建工作区
    const wsRes = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '测试工作区', visibility: 'private' });
    workspaceId = wsRes.body.data.id;
  });

  describe('POST /api/v1/workspaces/:id/dashboards', () => {
    it('应成功创建仪表盘', async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/dashboards`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: '销售数据看板',
          description: '实时销售数据',
          tags: ['销售', '实时'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('销售数据看板');
      expect(res.body.data.tags).toContain('销售');
      expect(res.body.data.ownerId).toBeDefined();
      dashboardId = res.body.data.id;
    });

    it('标题为空时应返回 422', async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/dashboards`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: '' });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('未认证时应返回 401', async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/dashboards`)
        .send({ title: '测试' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/workspaces/:id/dashboards', () => {
    it('应返回仪表盘列表', async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/dashboards`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta.total).toBeGreaterThan(0);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
    });

    it('应支持搜索过滤', async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/dashboards`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ search: '销售' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].title).toContain('销售');
    });
  });

  describe('PATCH /api/v1/workspaces/:wid/dashboards/:did', () => {
    it('应成功更新仪表盘', async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: '更新后的标题' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('更新后的标题');
    });
  });

  describe('DELETE /api/v1/workspaces/:wid/dashboards/:did', () => {
    it('应成功删除仪表盘', async () => {
      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(204);

      // 确认删除
      const getRes = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getRes.status).toBe(404);
    });
  });
});
```

---

## 总结

### 关键要点

| 领域 | 核心原则 |
|------|----------|
| **RESTful** | 资源导向、HTTP 语义、无状态、可缓存 |
| **GraphQL** | Schema 驱动、精确查询、Relay 分页、DataLoader |
| **安全** | JWT + Refresh Token、RBAC + ABAC、限流、输入验证 |
| **版本** | URL 路径版本化 (REST)、向后兼容 (GraphQL) |
| **文档** | OpenAPI 3.0、Swagger UI、代码即文档 |
| **错误** | 统一格式、机器可读错误码、请求 ID 追踪 |
| **分页** | Offset (小数据)、Cursor (大数据/GraphQL) |
| **测试** | 集成测试覆盖、Mock Server、契约测试 |

### CloudBoard API 架构决策

```
✅ REST 用于: 文件上传、简单 CRUD、公开 API、第三方集成
✅ GraphQL 用于: 仪表盘查询、复杂关联、动态字段、移动端
✅ WebSocket 用于: 实时协作、Widget 更新、通知推送
✅ 混合方案: 根据场景选择最合适的协议
```

### 设计 Checklist

- [x] URL 使用复数名词、小写、连字符
- [x] HTTP 方法语义正确
- [x] 统一错误响应格式
- [x] JWT + Refresh Token 认证
- [x] RBAC 权限模型
- [x] 限流策略
- [x] 分页 + 过滤 + 排序
- [x] OpenAPI 文档
- [x] 版本管理策略
- [x] 集成测试覆盖
- [x] GraphQL Schema 完整
- [x] Subscription 实时支持
- [x] DataLoader 防 N+1
- [x] 查询复杂度限制

---

*文档大小: ~45KB | 代码示例: 15+ | 设计资源: 8 个核心资源*
*完成时间: 2026-04-25 21:00*
