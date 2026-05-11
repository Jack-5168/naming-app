# 🔌 专项训练 21:00 - API 设计终极版：RESTful × GraphQL 混合架构

**日期:** 2026-04-30  
**前置:** 4/22 基础 / 4/23 进阶 / 4/26 巩固 / 4/27 生产级 / 4/28 终章 / 4/29 REST+GraphQL  
**本次定位:** 阶段一 API 设计领域闭环 — 混合架构 + 完整业务 API + 生产级文档

---

## 一、API 架构选型决策框架

### 1.1 REST vs GraphQL vs gRPC 决策矩阵

```
┌─────────────────┬──────────┬────────────┬──────────┐
│ 维度            │ REST     │ GraphQL    │ gRPC     │
├─────────────────┼──────────┼────────────┼──────────┤
│ 客户端多样性     │ ★★★★★   │ ★★★★      │ ★★       │
│ 数据灵活性       │ ★★★      │ ★★★★★    │ ★★★      │
│ 性能             │ ★★★★     │ ★★★       │ ★★★★★   │
│ 开发效率         │ ★★★★     │ ★★★       │ ★★       │
│ 缓存友好         │ ★★★★★   │ ★★        │ ★★★      │
│ 实时能力         │ ★★       │ ★★★★      │ ★★★★★   │
│ 类型安全         │ ★★★      │ ★★★★★    │ ★★★★★   │
│ 学习曲线         │ ★★★★★   │ ★★★       │ ★★       │
└─────────────────┴──────────┴────────────┴──────────┘
```

### 1.2 混合架构决策树

```
                    ┌─────────────────┐
                    │  需求分析开始    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ 多端客户端？     │
                    └────┬──────┬─────┘
                         │ 是   │ 否
                    ┌────▼──┐ ┌──▼──────┐
                    │GraphQL│ │内部服务？│
                    │(BFF层)│ └──┬──┬───┘
                    └───────┘  是 │ 否
                            ┌───▼───┐ ┌─▼────────┐
                            │ gRPC  │ │ RESTful  │
                            │(内部) │ │(公开API) │
                            └───────┘ └──────────┘
```

### 1.3 现代混合架构模式

```
┌─────────────────────────────────────────────────────┐
│                    Client Layer                      │
│  Web App │ Mobile │ Desktop │ Third-Party Partner   │
└────────┬────────────┬──────────┬──────────┬─────────┘
         │            │          │          │
    ┌────▼────┐ ┌─────▼────┐ ┌──▼──┐  ┌───▼────┐
    │  BFF    │ │  BFF     │ │ API │  │ BFF    │
    │(GraphQL)│ │(GraphQL) │ │GW   │  │(REST)  │
    └────┬────┘ └────┬─────┘ └──┬──┘  └───┬────┘
         │           │          │         │
    ┌────▼───────────▼──────────▼─────────▼────┐
    │           API Gateway (Kong/Tyk)          │
    │  Auth · Rate Limit · Transform · Route    │
    └────────────────┬──────────────────────────┘
                     │
    ┌────────────────▼──────────────────────────┐
    │          Service Mesh (gRPC/REST)          │
    │  User Svc │ Order Svc │ Product Svc │ ... │
    └───────────────────────────────────────────┘
```

---

## 二、RESTful 设计原则深度（阶段一精华回顾）

### 2.1 资源建模黄金法则

```
法则 1: 资源是名词，不是动词
  ✅ /api/v1/users    ✅ /api/v1/orders
  ❌ /api/v1/getUsers ❌ /api/v1/createOrder

法则 2: 使用复数名词
  ✅ /api/v1/users    ✅ /api/v1/orders
  ❌ /api/v1/user     ❌ /api/v1/order

法则 3: 嵌套表示从属关系，不是层级深度
  ✅ /api/v1/users/123/orders       (用户的订单)
  ✅ /api/v1/orders/456/items       (订单的商品项)
  ❌ /api/v1/users/123/orders/456/items  (超过2层嵌套)

法则 4: 子资源独立存在时，提供顶级端点
  ✅ /api/v1/products              (商品独立资源)
  ✅ /api/v1/categories/1/products  (分类下的商品)

法则 5: 操作用 HTTP 方法，不在 URL 中体现
  ✅ POST /api/v1/orders/456/pay    (动作作为子资源)
  ✅ PATCH /api/v1/users/123        (部分更新)
  ❌ POST /api/v1/payOrder          (动词在URL中)
```

### 2.2 状态码精准使用

```
成功 (2xx):
  200 OK              → GET 成功 / PUT/PATCH 成功更新
  201 Created         → POST 创建成功（返回 Location header）
  202 Accepted        → 异步操作已接受，处理中
  204 No Content      → DELETE 成功 / PUT 无返回体

重定向 (3xx):
  301 Moved           → 资源永久迁移
  304 Not Modified    → 缓存命中（配合 ETag/Last-Modified）

客户端错误 (4xx):
  400 Bad Request     → 请求体格式错误 / 验证失败
  401 Unauthorized    → 未认证 / Token 过期
  403 Forbidden       → 已认证但无权限
  404 Not Found       → 资源不存在
  409 Conflict        → 资源冲突（如重复创建）
  422 Unprocessable   → 语义错误（验证通过但业务规则不满足）
  429 Too Many Requests → 速率限制

服务端错误 (5xx):
  500 Internal Error  → 未预期错误
  502 Bad Gateway     → 上游服务不可用
  503 Unavailable     → 服务维护中
  504 Gateway Timeout → 上游超时
```

### 2.3 分页策略对比

```
1. Offset-Based（偏移分页）
   GET /api/v1/users?limit=20&offset=40
   ✅ 简单、支持跳转到任意页
   ❌ 大数据量性能差、数据变化导致重复/遗漏

2. Cursor-Based（游标分页）
   GET /api/v1/users?limit=20&cursor=eyJpZCI6MTIzfQ
   ✅ 高性能、数据变化不影响
   ❌ 不能跳页、需要稳定排序

3. Keyset Pagination（键集分页）
   GET /api/v1/users?limit=20&after_id=123&sort=created_at
   ✅ 高性能、无需编码游标
   ❌ 需要唯一排序字段

4. Time-Based（时间分页）
   GET /api/v1/events?limit=50&before=2026-04-30T12:00:00Z
   ✅ 日志/事件流天然适配
   ❌ 需要时间字段

推荐: 公开 API 用 Cursor-Based，管理后台用 Offset-Based
```

### 2.4 统一错误响应格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [
      {
        "field": "email",
        "message": "邮箱格式不正确",
        "code": "INVALID_FORMAT"
      },
      {
        "field": "age",
        "message": "年龄必须在 0-150 之间",
        "code": "OUT_OF_RANGE"
      }
    ],
    "request_id": "req_8f3a2b1c9d4e",
    "timestamp": "2026-04-30T13:00:00.000Z",
    "_links": {
      "documentation": {
        "href": "https://docs.example.com/errors/VALIDATION_ERROR"
      }
    }
  }
}
```

---

## 三、GraphQL 设计原则深度

### 3.1 Schema 设计模式

```graphql
# === 1. 统一响应格式 (Envelope Pattern) ===

# ❌ 每个查询返回不同结构
type Query {
  user(id: ID!): User
  users(limit: Int, offset: Int): [User]
  userCount: Int
}

# ✅ 统一分页响应
type Query {
  users(input: UserFilterInput!): UserConnection!
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
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

# === 2. 客户端 mutation 标识 (Client Mutation ID) ===

# ✅ 每个 mutation 都有 clientMutationId 用于去重
input CreateUserInput {
  name: String!
  email: String!
  clientMutationId: String
}

type CreateUserPayload {
  user: User
  clientMutationId: String
  errors: [Error!]
}

# === 3. 接口与联合类型 ===

interface Node {
  id: ID!
}

type User implements Node {
  id: ID!
  name: String!
  email: String!
}

type Product implements Node {
  id: ID!
  title: String!
  price: Float!
}

union SearchResult = User | Product | Order

type Query {
  search(query: String!): [SearchResult!]!
  node(id: ID!): Node
}

# === 4. 指令驱动 (Directive-Driven) ===

# 服务端指令实现条件字段
type Query {
  user(id: ID!): User
}

type User {
  id: ID!
  name: String!
  email: String @includeRole(roles: [ADMIN, MANAGER])
  passwordHash: String @skipPublic
  internalNotes: String @requireScope("users:admin")
}

# === 5. 批量操作 (Batch Operations) ===

input BatchUserInput {
  users: [UserInput!]!
}

type BatchUserPayload {
  created: [User!]!
  updated: [User!]!
  failed: [BatchError!]!
}

type Mutation {
  batchCreateUsers(input: BatchUserInput!): BatchUserPayload!
}
```

### 3.2 GraphQL 性能优化

```
1. DataLoader 解决 N+1 问题
   - 批量加载 + 请求缓存
   - 每个请求生命周期内去重

2. 查询深度限制
   - 默认最大深度: 7
   - 使用 graphql-depth-limit 中间件

3. 查询复杂度分析
   - 每个字段分配复杂度权重
   - 默认最大复杂度: 1000
   - 使用 graphql-query-complexity

4. 持久化查询 (Persisted Queries)
   - 客户端发送查询哈希
   - 服务端查找预注册查询
   - 防注入 + 减少带宽

5. 订阅 (Subscriptions) 优化
   - 使用 Redis Pub/Sub 水平扩展
   - 心跳保活
   - 断线重连策略
```

### 3.3 DataLoader 实现

```javascript
// data-loader.js — 通用 DataLoader 工厂
import DataLoader from 'dataloader';

class DataLoaderRegistry {
  constructor(db) {
    this.db = db;
    this.loaders = new Map();
  }

  // 每个请求创建新的 DataLoader 实例（避免跨请求缓存）
  createLoaders() {
    return {
      userLoader: new DataLoader(async (ids) => {
        const users = await this.db.user.findMany({
          where: { id: { in: ids } }
        });
        // 保持请求顺序
        return ids.map(id => users.find(u => u.id === id) || null);
      }),

      orderLoader: new DataLoader(async (userIds) => {
        const orders = await this.db.order.findMany({
          where: { userId: { in: userIds } }
        });
        return userIds.map(uid =>
          orders.filter(o => o.userId === uid)
        );
      }),

      productLoader: new DataLoader(async (ids) => {
        const products = await this.db.product.findMany({
          where: { id: { in: ids } }
        });
        return ids.map(id => products.find(p => p.id === id) || null);
      }),

      // 批量计数
      orderCountLoader: new DataLoader(async (userIds) => {
        const counts = await this.db.order.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds } },
          _count: true
        });
        return userIds.map(uid =>
          counts.find(c => c.userId === uid)?._count || 0
        );
      })
    };
  }

  // 中间件：每个请求注入 loaders
  middleware() {
    return (req, res, next) => {
      req.loaders = this.createLoaders();
      next();
    };
  }
}

export default DataLoaderRegistry;
```

---

## 四、完整业务 API 设计：CloudBoard 协作平台

### 4.1 业务域建模

```
┌──────────────────────────────────────────────────────┐
│                    CloudBoard Platform                │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐       │
│  │  Organization │  │  Project   │  │  Board     │   │
│  │  (组织/团队)  │  │  (项目)    │  │  (看板)    │   │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘       │
│       │               │               │              │
│  ┌────▼─────┐    ┌────▼─────┐    ┌────▼─────┐       │
│  │  Member  │    │  Task    │    │  Column   │       │
│  │  (成员)   │    │  (任务)   │    │  (列)     │       │
│  └──────────┘    └────┬─────┘    └────┬─────┘       │
│                       │               │              │
│                  ┌────▼─────┐    ┌────▼─────┐       │
│                  │  Comment │    │  Card     │       │
│                  │  (评论)   │    │  (卡片)   │       │
│                  └──────────┘    └────┬─────┘       │
│                                      │              │
│                                 ┌────▼─────┐       │
│                                 │  Checklist│       │
│                                 │  (检查清单)│       │
│                                 └──────────┘       │
│                                                       │
│  横切关注点: Auth · Notification · ActivityLog · File  │
└──────────────────────────────────────────────────────┘
```

### 4.2 数据模型定义

```typescript
// === 核心实体 ===

interface Organization {
  id: string;              // ulid
  slug: string;            // 组织短名 (URL友好)
  name: string;
  description?: string;
  avatarUrl?: string;
  ownerId: string;         // 创建者
  plan: 'free' | 'pro' | 'enterprise';
  settings: OrgSettings;
  createdAt: Date;
  updatedAt: Date;
}

interface OrgSettings {
  defaultVisibility: 'public' | 'private';
  allowMemberInvite: boolean;
  maxProjects: number;
}

interface Member {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'pending' | 'removed';
  invitedBy: string;
  joinedAt?: Date;
  createdAt: Date;
}

interface Project {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  leadId?: string;
  color: string;           // 项目标识色
  icon?: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Board {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  columns: Column[];       // 内嵌列定义
  defaultColumnId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Column {
  id: string;
  name: string;
  order: number;
  wipLimit?: number;       // 在制品限制
  color?: string;
  autoArchiveDays?: number; // 自动归档天数
}

interface Task {
  id: string;
  projectId: string;
  boardId?: string;
  columnId: string;
  title: string;
  description?: string;
  type: 'task' | 'bug' | 'feature' | 'docs';
  priority: 'critical' | 'high' | 'medium' | 'low';
  labels: string[];
  assigneeId?: string;
  reporterId: string;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  order: number;           // 排序权重
  attachments: Attachment[];
  checklists: Checklist[];
  subtaskIds: string[];
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  parentId?: string;       // 回复
  mentions: string[];      // @提及的用户ID
  reactions: Reaction[];
  createdAt: Date;
  updatedAt: Date;
}

interface ActivityLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

interface Notification {
  id: string;
  userId: string;
  type: 'mention' | 'assign' | 'comment' | 'due_date' | 'status_change';
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: Date;
}
```

---

### 4.3 RESTful API 完整设计

#### 4.3.1 认证与鉴权

```
认证方式: Bearer Token (JWT)
  Header: Authorization: Bearer <token>

Token 结构:
  {
    "sub": "user_id",
    "org_id": "org_123",
    "role": "admin",
    "scopes": ["projects:read", "projects:write", "tasks:read", "tasks:write"],
    "exp": 1714492800,
    "iat": 1714406400
  }

权限模型: RBAC + 资源级权限
  - owner: 组织/项目完全控制
  - admin: 管理成员 + 编辑所有资源
  - member: 编辑自己创建和分配的资源
  - viewer: 只读访问

Scope 定义:
  organizations:read    organizations:write
  projects:read         projects:write
  tasks:read            tasks:write
  comments:read         comments:write
  files:read            files:write
  analytics:read
```

#### 4.3.2 组织 API

```
# ==================== 组织管理 ====================

# 获取当前用户所有组织
GET /api/v1/organizations
  Query Params:
    - include_archived: boolean (default: false)
    - fields: string (逗号分隔: id,name,slug,member_count)
  Response: 200
  {
    "data": [
      {
        "id": "org_ulid_001",
        "slug": "acme-corp",
        "name": "Acme Corporation",
        "avatar_url": "https://cdn.example.com/orgs/001.png",
        "plan": "pro",
        "member_count": 42,
        "project_count": 8,
        "my_role": "admin",
        "_links": {
          "self": "/api/v1/organizations/org_ulid_001",
          "projects": "/api/v1/organizations/org_ulid_001/projects",
          "members": "/api/v1/organizations/org_ulid_001/members"
        }
      }
    ],
    "meta": {
      "total": 3,
      "current_org": "org_ulid_001"
    }
  }

# 创建组织
POST /api/v1/organizations
  Body:
  {
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "description": "Software development team"
  }
  Validation:
    - name: required, 2-100 chars
    - slug: required, 2-32 chars, alphanumeric + hyphens, unique
  Response: 201
  {
    "data": {
      "id": "org_ulid_001",
      "slug": "acme-corp",
      "name": "Acme Corporation",
      "plan": "free",
      "owner_id": "user_abc",
      "settings": {
        "default_visibility": "private",
        "allow_member_invite": true,
        "max_projects": 10
      },
      "created_at": "2026-04-30T13:00:00Z"
    }
  }

# 获取组织详情
GET /api/v1/organizations/{org_id}
  Response: 200
  {
    "data": {
      "id": "org_ulid_001",
      "slug": "acme-corp",
      "name": "Acme Corporation",
      "description": "Software development team",
      "avatar_url": "https://cdn.example.com/orgs/001.png",
      "plan": "pro",
      "settings": { ... },
      "stats": {
        "member_count": 42,
        "project_count": 8,
        "active_task_count": 156,
        "completed_task_count": 892
      },
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-04-30T12:00:00Z"
    }
  }

# 更新组织
PATCH /api/v1/organizations/{org_id}
  Authorization: owner 或 admin
  Body: { "name": "New Name", "description": "..." }
  Response: 200

# 删除组织
DELETE /api/v1/organizations/{org_id}
  Authorization: owner only
  Response: 204
```

#### 4.3.3 成员管理 API

```
# ==================== 成员管理 ====================

# 列出组织成员
GET /api/v1/organizations/{org_id}/members
  Query Params:
    - role: string (owner|admin|member|viewer, 过滤)
    - status: string (active|pending|removed, 过滤)
    - search: string (按名称/邮箱搜索)
    - cursor: string
    - limit: number (default: 20, max: 100)
  Response: 200
  {
    "data": [
      {
        "id": "member_001",
        "user": {
          "id": "user_abc",
          "name": "张三",
          "email": "zhangsan@example.com",
          "avatar_url": "..."
        },
        "role": "admin",
        "status": "active",
        "joined_at": "2026-01-20T10:00:00Z",
        "tasks_completed": 45,
        "tasks_in_progress": 3
      }
    ],
    "meta": {
      "total": 42,
      "page_info": {
        "has_next": true,
        "cursor": "eyJpZCI6Im1lbWJlcl8wNDIifQ=="
      }
    }
  }

# 邀请成员
POST /api/v1/organizations/{org_id}/members/invite
  Authorization: admin 或 owner
  Body:
  {
    "email": "newuser@example.com",
    "role": "member",
    "projects": ["proj_001", "proj_002"],  // 可选：直接分配到项目
    "message": "欢迎加入 Acme Corp!"
  }
  Response: 201
  {
    "data": {
      "id": "invite_001",
      "email": "newuser@example.com",
      "role": "member",
      "status": "pending",
      "invite_token": "tok_xxx",
      "expires_at": "2026-05-07T13:00:00Z",
      "projects": ["proj_001", "proj_002"]
    }
  }

# 接受邀请
POST /api/v1/invitations/{invite_token}/accept
  Response: 200

# 拒绝邀请
POST /api/v1/invitations/{invite_token}/reject
  Response: 204

# 更新成员角色
PATCH /api/v1/organizations/{org_id}/members/{member_id}
  Authorization: admin 或 owner (不能改 owner)
  Body: { "role": "admin" }
  Response: 200

# 移除成员
DELETE /api/v1/organizations/{org_id}/members/{member_id}
  Authorization: admin 或 owner
  Response: 204
```

#### 4.3.4 项目 API

```
# ==================== 项目管理 ====================

# 列出组织下的项目
GET /api/v1/organizations/{org_id}/projects
  Query Params:
    - archived: boolean (default: false)
    - lead_id: string (按负责人过滤)
    - search: string
    - sort: string (name|created_at|updated_at, default: updated_at)
    - order: string (asc|desc, default: desc)
    - cursor: string
    - limit: number
  Response: 200
  {
    "data": [
      {
        "id": "proj_001",
        "name": "CloudBoard v2.0",
        "description": "下一代协作平台",
        "visibility": "private",
        "color": "#3B82F6",
        "icon": "🚀",
        "lead": {
          "id": "user_abc",
          "name": "张三",
          "avatar_url": "..."
        },
        "member_count": 12,
        "task_stats": {
          "total": 234,
          "todo": 45,
          "in_progress": 18,
          "review": 7,
          "done": 156,
          "cancelled": 8
        },
        "progress": 0.67,
        "archived": false,
        "created_at": "2026-02-01T09:00:00Z",
        "updated_at": "2026-04-30T11:30:00Z",
        "_links": {
          "self": "/api/v1/projects/proj_001",
          "boards": "/api/v1/projects/proj_001/boards",
          "tasks": "/api/v1/projects/proj_001/tasks",
          "members": "/api/v1/projects/proj_001/members"
        }
      }
    ],
    "meta": {
      "total": 8,
      "page_info": { "has_next": false }
    }
  }

# 创建项目
POST /api/v1/organizations/{org_id}/projects
  Body:
  {
    "name": "CloudBoard v2.0",
    "description": "下一代协作平台",
    "visibility": "private",
    "color": "#3B82F6",
    "icon": "🚀",
    "lead_id": "user_abc",
    "member_ids": ["user_abc", "user_def", "user_ghi"]
  }
  Response: 201

# 获取项目详情
GET /api/v1/projects/{project_id}
  Response: 200

# 更新项目
PATCH /api/v1/projects/{project_id}
  Body: { "name": "New Name", "description": "..." }
  Response: 200

# 归档/恢复项目
PATCH /api/v1/projects/{project_id}
  Body: { "archived": true }
  Response: 200

# 删除项目
DELETE /api/v1/projects/{project_id}
  Response: 204
```

#### 4.3.5 任务 API（核心）

```
# ==================== 任务管理 ====================

# 列出项目任务（支持多维度过滤）
GET /api/v1/projects/{project_id}/tasks
  Query Params:
    # 状态过滤
    - status: string (backlog|todo|in_progress|review|done|cancelled)
    - status_in: string (逗号分隔: todo,in_progress)

    # 人员过滤
    - assignee_id: string
    - assignee_in: string (逗号分隔)
    - reporter_id: string

    # 分类过滤
    - type: string (task|bug|feature|docs)
    - type_in: string
    - priority: string (critical|high|medium|low)
    - priority_in: string
    - labels: string (逗号分隔, 匹配任意)
    - labels_all: string (逗号分隔, 匹配全部)

    # 搜索
    - search: string (标题/描述全文搜索)

    # 日期过滤
    - due_after: date
    - due_before: date
    - created_after: datetime
    - created_before: datetime
    - completed_after: datetime

    # 排序
    - sort: string (priority|due_date|created_at|updated_at|order, default: order)
    - order: string (asc|desc, default: asc for order, desc for others)

    # 分页
    - cursor: string
    - limit: number (default: 30, max: 100)

    # 字段选择 (sparse fieldsets)
    - fields: string (id,title,priority,assignee,status)

  Response: 200
  {
    "data": [
      {
        "id": "task_001",
        "project_id": "proj_001",
        "board_id": "board_001",
        "column_id": "col_todo",
        "title": "实现用户认证模块",
        "description": "支持 JWT + OAuth2 双认证...",
        "type": "feature",
        "priority": "high",
        "labels": ["auth", "backend"],
        "assignee": {
          "id": "user_abc",
          "name": "张三",
          "avatar_url": "..."
        },
        "reporter": {
          "id": "user_def",
          "name": "李四",
          "avatar_url": "..."
        },
        "due_date": "2026-05-15",
        "estimated_hours": 16,
        "status": "in_progress",
        "order": 100,
        "subtask_count": 3,
        "comment_count": 7,
        "attachment_count": 2,
        "created_at": "2026-04-20T09:00:00Z",
        "updated_at": "2026-04-30T10:00:00Z",
        "_links": {
          "self": "/api/v1/tasks/task_001",
          "board": "/api/v1/boards/board_001",
          "comments": "/api/v1/tasks/task_001/comments",
          "subtasks": "/api/v1/tasks/task_001/subtasks"
        }
      }
    ],
    "meta": {
      "total": 234,
      "filtered_count": 45,
      "page_info": {
        "has_next": true,
        "cursor": "eyJpZCI6InRhc2tfMDQ1Iiwib3JkZXIiOjEwMH0="
      },
      "aggregations": {
        "by_status": {
          "backlog": 23,
          "todo": 45,
          "in_progress": 18,
          "review": 7,
          "done": 156,
          "cancelled": 8
        },
        "by_priority": {
          "critical": 3,
          "high": 12,
          "medium": 18,
          "low": 12
        }
      }
    }
  }

# 获取任务详情
GET /api/v1/tasks/{task_id}
  Query Params:
    - include: string (逗号分隔: comments,subtasks,checklist,activity_log)
  Response: 200
  {
    "data": {
      "id": "task_001",
      "project_id": "proj_001",
      "board_id": "board_001",
      "column_id": "col_in_progress",
      "title": "实现用户认证模块",
      "description": "# 用户认证模块\n\n## 需求\n- JWT Token 签发与刷新\n- OAuth2 Google/GitHub 登录\n- 双因素认证(2FA)",
      "type": "feature",
      "priority": "high",
      "labels": ["auth", "backend"],
      "assignee": { "id": "user_abc", "name": "张三", "avatar_url": "..." },
      "reporter": { "id": "user_def", "name": "李四", "avatar_url": "..." },
      "due_date": "2026-05-15",
      "estimated_hours": 16,
      "actual_hours": 8.5,
      "status": "in_progress",
      "order": 100,
      "attachments": [
        {
          "id": "att_001",
          "filename": "auth-flow.png",
          "size": 245760,
          "mime_type": "image/png",
          "url": "https://cdn.example.com/attachments/att_001.png",
          "uploaded_by": { "id": "user_abc", "name": "张三" },
          "created_at": "2026-04-22T14:00:00Z"
        }
      ],
      "checklists": [
        {
          "id": "cl_001",
          "title": "认证流程",
          "items": [
            { "id": "item_1", "text": "JWT 签发", "checked": true, "order": 0 },
            { "id": "item_2", "text": "Token 刷新", "checked": true, "order": 1 },
            { "id": "item_3", "text": "OAuth2 集成", "checked": false, "order": 2 },
            { "id": "item_4", "text": "2FA 支持", "checked": false, "order": 3 }
          ],
          "progress": 0.5
        }
      ],
      "subtasks": [
        { "id": "sub_1", "title": "设计 JWT 数据结构", "status": "done", "priority": "high" },
        { "id": "sub_2", "title": "实现 Token 刷新逻辑", "status": "done", "priority": "high" },
        { "id": "sub_3", "title": "集成 OAuth2 Provider", "status": "todo", "priority": "medium" }
      ],
      "created_at": "2026-04-20T09:00:00Z",
      "updated_at": "2026-04-30T10:00:00Z",
      "completed_at": null
    }
  }

# 创建任务
POST /api/v1/projects/{project_id}/tasks
  Body:
  {
    "title": "实现用户认证模块",
    "description": "# 用户认证模块\n\n## 需求\n- JWT Token 签发与刷新\n- OAuth2 Google/GitHub 登录\n- 双因素认证(2FA)",
    "type": "feature",
    "priority": "high",
    "labels": ["auth", "backend"],
    "assignee_id": "user_abc",
    "board_id": "board_001",
    "column_id": "col_todo",
    "due_date": "2026-05-15",
    "estimated_hours": 16,
    "subtask_titles": [
      "设计 JWT 数据结构",
      "实现 Token 刷新逻辑",
      "集成 OAuth2 Provider"
    ]
  }
  Response: 201

# 更新任务
PATCH /api/v1/tasks/{task_id}
  Body:
  {
    "title": "新标题",
    "status": "review",
    "priority": "critical",
    "assignee_id": "user_xyz",
    "column_id": "col_review",
    "order": 50
  }
  Response: 200

# 批量更新任务
PATCH /api/v1/projects/{project_id}/tasks/batch
  Authorization: member+
  Body:
  {
    "task_ids": ["task_001", "task_002", "task_003"],
    "updates": {
      "column_id": "col_done",
      "status": "done"
    }
  }
  Response: 200
  {
    "data": {
      "updated": ["task_001", "task_002", "task_003"],
      "failed": []
    }
  }

# 删除任务
DELETE /api/v1/tasks/{task_id}
  Response: 204

# 任务排序 (拖拽排序)
PATCH /api/v1/boards/{board_id}/tasks/reorder
  Body:
  {
    "tasks": [
      { "id": "task_003", "column_id": "col_todo", "order": 0 },
      { "id": "task_001", "column_id": "col_todo", "order": 100 },
      { "id": "task_002", "column_id": "col_todo", "order": 200 }
    ]
  }
  Response: 200
```

#### 4.3.6 评论 API

```
# ==================== 评论 ====================

# 获取任务评论
GET /api/v1/tasks/{task_id}/comments
  Query Params:
    - cursor: string
    - limit: number (default: 20)
    - sort: string (created_at, default: asc)
  Response: 200
  {
    "data": [
      {
        "id": "comment_001",
        "content": "JWT 签发逻辑已完成，PR #142 请 review",
        "author": {
          "id": "user_abc",
          "name": "张三",
          "avatar_url": "..."
        },
        "mentions": ["user_def"],
        "reactions": [
          { "emoji": "👍", "users": ["user_def", "user_ghi"], "count": 2 },
          { "emoji": "🚀", "users": ["user_abc"], "count": 1 }
        ],
        "parent_id": null,
        "replies": [
          {
            "id": "comment_002",
            "content": "好的，我看一下",
            "author": { "id": "user_def", "name": "李四" },
            "mentions": [],
            "reactions": [],
            "created_at": "2026-04-30T11:00:00Z"
          }
        ],
        "created_at": "2026-04-30T10:30:00Z",
        "updated_at": "2026-04-30T10:30:00Z"
      }
    ],
    "meta": {
      "total": 7,
      "page_info": { "has_next": false }
    }
  }

# 创建评论
POST /api/v1/tasks/{task_id}/comments
  Body:
  {
    "content": "JWT 签发逻辑已完成，PR #142 请 review @李四",
    "parent_id": null  // 回复时填写父评论ID
  }
  Response: 201

# 更新评论
PATCH /api/v1/comments/{comment_id}
  Authorization: 评论作者
  Body: { "content": "更新后的内容" }
  Response: 200

# 删除评论
DELETE /api/v1/comments/{comment_id}
  Authorization: 评论作者 或 admin
  Response: 204

# 添加/移除表情反应
POST /api/v1/comments/{comment_id}/reactions
  Body: { "emoji": "👍" }
  Response: 201

DELETE /api/v1/comments/{comment_id}/reactions
  Body: { "emoji": "👍" }
  Response: 204
```

#### 4.3.7 通知 API

```
# ==================== 通知 ====================

# 获取通知列表
GET /api/v1/notifications
  Query Params:
    - unread_only: boolean (default: false)
    - type: string (mention|assign|comment|due_date|status_change)
    - cursor: string
    - limit: number (default: 20)
  Response: 200
  {
    "data": [
      {
        "id": "notif_001",
        "type": "mention",
        "title": "张三在任务中提及了你",
        "body": "JWT 签发逻辑已完成，@李四 请 review",
        "link": "/projects/proj_001/tasks/task_001",
        "read": false,
        "actor": {
          "id": "user_abc",
          "name": "张三",
          "avatar_url": "..."
        },
        "task": {
          "id": "task_001",
          "title": "实现用户认证模块"
        },
        "created_at": "2026-04-30T10:30:00Z"
      }
    ],
    "meta": {
      "unread_count": 5,
      "page_info": { "has_next": true }
    }
  }

# 标记为已读
PATCH /api/v1/notifications/{notif_id}/read
  Response: 200

# 批量标记已读
POST /api/v1/notifications/mark-read
  Body: { "notification_ids": ["notif_001", "notif_002"] }
  Response: 200

# 标记全部已读
POST /api/v1/notifications/mark-all-read
  Response: 200

# 获取未读计数
GET /api/v1/notifications/unread-count
  Response: 200
  { "data": { "count": 5 } }
```

#### 4.3.8 文件上传 API

```
# ==================== 文件上传 ====================

# 获取上传预签名 URL
POST /api/v1/upload/sign
  Body:
  {
    "filename": "design-mockup.png",
    "content_type": "image/png",
    "size": 2048000,
    "task_id": "task_001"  // 关联到任务
  }
  Response: 200
  {
    "data": {
      "upload_url": "https://s3.example.com/bucket/...",
      "file_id": "file_001",
      "expires_at": "2026-04-30T13:10:00Z",
      "headers": {
        "Content-Type": "image/png",
        "x-amz-meta-task-id": "task_001"
      }
    }
  }

# 客户端直接上传到 S3，然后确认
POST /api/v1/upload/confirm
  Body:
  {
    "file_id": "file_001",
    "etag": "\"abc123def456\""
  }
  Response: 201
  {
    "data": {
      "id": "file_001",
      "filename": "design-mockup.png",
      "size": 2048000,
      "mime_type": "image/png",
      "url": "https://cdn.example.com/files/file_001.png",
      "thumbnail_url": "https://cdn.example.com/files/file_001_thumb.png",
      "uploaded_by": { "id": "user_abc", "name": "张三" },
      "created_at": "2026-04-30T13:00:00Z"
    }
  }

# 文件限制:
#   - 免费版: 10MB/文件, 1GB 总空间
#   - Pro版: 50MB/文件, 50GB 总空间
#   - Enterprise: 100MB/文件, 无限制
#   - 允许类型: image/*, .pdf, .doc, .docx, .xls, .xlsx, .zip
```

#### 4.3.9 搜索 API

```
# ==================== 全局搜索 ====================

GET /api/v1/search
  Query Params:
    - q: string (required, 搜索关键词)
    - type: string (task|project|member, 过滤类型)
    - project_id: string (限定项目)
    - org_id: string (限定组织)
    - cursor: string
    - limit: number (default: 20)
  Response: 200
  {
    "data": [
      {
        "type": "task",
        "id": "task_001",
        "title": "实现用户认证模块",
        "highlight": "实现用户<strong>认证</strong>模块",
        "project": { "id": "proj_001", "name": "CloudBoard v2.0" },
        "status": "in_progress",
        "priority": "high",
        "score": 0.95,
        "_links": {
          "self": "/api/v1/tasks/task_001"
        }
      },
      {
        "type": "project",
        "id": "proj_002",
        "title": "认证服务迁移",
        "highlight": "<strong>认证</strong>服务迁移到微服务架构",
        "organization": { "id": "org_001", "name": "Acme Corp" },
        "score": 0.82,
        "_links": {
          "self": "/api/v1/projects/proj_002"
        }
      }
    ],
    "meta": {
      "total": 15,
      "query": "认证",
      "page_info": { "has_next": true }
    }
  }
```

#### 4.3.10 Webhook API

```
# ==================== Webhook ====================

# 创建 Webhook
POST /api/v1/organizations/{org_id}/webhooks
  Body:
  {
    "url": "https://hooks.example.com/cloudboard",
    "events": [
      "task.created",
      "task.updated",
      "task.status_changed",
      "comment.created",
      "member.joined"
    ],
    "secret": "whsec_xxx",  // 用于签名验证
    "active": true
  }
  Response: 201

# Webhook 事件格式
{
  "id": "wh_evt_001",
  "type": "task.created",
  "timestamp": "2026-04-30T13:00:00.000Z",
  "organization_id": "org_001",
  "project_id": "proj_001",
  "actor": {
    "id": "user_abc",
    "name": "张三"
  },
  "data": {
    "id": "task_001",
    "title": "实现用户认证模块",
    "type": "feature",
    "priority": "high",
    "status": "todo"
  }
}

# Webhook 签名验证
# Header: X-CloudBoard-Signature: t=1714492800,v1=abc123...
# 验证: HMAC-SHA256(secret, "t." + timestamp + "." + payload)

# 重试策略:
#   1min → 5min → 15min → 30min → 1h → 2h → 4h → 8h (最多8次)
#   连续失败 24h → 自动禁用
```

---

### 4.4 GraphQL Schema 完整设计

```graphql
# ==================== CloudBoard GraphQL Schema ====================

# --- Scalar Types ---
scalar DateTime
scalar JSON
scalar URL
scalar BigInt

# --- Node Interface (Relay Spec) ---
interface Node {
  id: ID!
}

# --- Auth ---
type AuthPayload {
  accessToken: String!
  refreshToken: String!
  expiresIn: Int!
  tokenType: String!
}

type Mutation {
  login(email: String!, password: String!): AuthPayload!
  refreshToken(refreshToken: String!): AuthPayload!
  logout: Boolean!
}

# --- Organization ---
type Organization implements Node {
  id: ID!
  slug: String!
  name: String!
  description: String
  avatarUrl: URL
  plan: Plan!
  settings: OrgSettings!
  stats: OrgStats!
  myRole: MemberRole!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type OrgSettings {
  defaultVisibility: Visibility!
  allowMemberInvite: Boolean!
  maxProjects: Int!
}

type OrgStats {
  memberCount: Int!
  projectCount: Int!
  activeTaskCount: Int!
  completedTaskCount: Int!
}

enum Plan {
  FREE
  PRO
  ENTERPRISE
}

enum Visibility {
  PUBLIC
  PRIVATE
}

type OrganizationConnection {
  edges: [OrganizationEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type OrganizationEdge {
  node: Organization!
  cursor: String!
}

# --- Member ---
type Member implements Node {
  id: ID!
  user: User!
  role: MemberRole!
  status: MemberStatus!
  joinedAt: DateTime
  tasksCompleted: Int!
  tasksInProgress: Int!
}

enum MemberRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

enum MemberStatus {
  ACTIVE
  PENDING
  REMOVED
}

type InvitePayload {
  id: ID!
  email: String!
  role: MemberRole!
  status: MemberStatus!
  inviteToken: String!
  expiresAt: DateTime!
}

# --- User ---
type User implements Node {
  id: ID!
  name: String!
  email: String!
  avatarUrl: URL
  timezone: String
  createdAt: DateTime!
}

type MePayload {
  user: User!
  organizations: [OrganizationMembership!]!
  preferences: UserPreferences!
}

type OrganizationMembership {
  organization: Organization!
  role: MemberRole!
  isCurrent: Boolean!
}

type UserPreferences {
  theme: String!
  language: String!
  timezone: String!
  emailNotifications: Boolean!
  pushNotifications: Boolean!
}

# --- Project ---
type Project implements Node {
  id: ID!
  name: String!
  description: String
  visibility: Visibility!
  color: String!
  icon: String
  lead: User
  memberCount: Int!
  taskStats: TaskStats!
  progress: Float!
  archived: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type TaskStats {
  total: Int!
  backlog: Int!
  todo: Int!
  inProgress: Int!
  review: Int!
  done: Int!
  cancelled: Int!
}

type ProjectConnection {
  edges: [ProjectEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ProjectEdge {
  node: Project!
  cursor: String!
}

# --- Board ---
type Board implements Node {
  id: ID!
  name: String!
  description: String
  project: Project!
  columns: [Column!]!
  defaultColumnId: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Column {
  id: ID!
  name: String!
  order: Int!
  wipLimit: Int
  color: String
  autoArchiveDays: Int
  taskCount: Int!
}

# --- Task ---
type Task implements Node {
  id: ID!
  title: String!
  description: String
  type: TaskType!
  priority: TaskPriority!
  labels: [String!]!
  status: TaskStatus!
  assignee: User
  reporter: User!
  dueDate: DateTime
  estimatedHours: Float
  actualHours: Float
  order: Int!
  subtaskCount: Int!
  commentCount: Int!
  attachmentCount: Int!
  project: Project!
  board: Board
  column: Column
  checklists: [Checklist!]!
  attachments: [Attachment!]!
  createdAt: DateTime!
  updatedAt: DateTime!
  completedAt: DateTime
}

enum TaskType {
  TASK
  BUG
  FEATURE
  DOCS
}

enum TaskPriority {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum TaskStatus {
  BACKLOG
  TODO
  IN_PROGRESS
  REVIEW
  DONE
  CANCELLED
}

input TaskFilterInput {
  status: TaskStatus
  statusIn: [TaskStatus!]
  assigneeId: ID
  assigneeIn: [ID!]
  reporterId: ID
  type: TaskType
  typeIn: [TaskType!]
  priority: TaskPriority
  priorityIn: [TaskPriority!]
  labels: [String!]        # 匹配任意
  labelsAll: [String!]     # 匹配全部
  search: String
  dueAfter: DateTime
  dueBefore: DateTime
  createdAfter: DateTime
  createdBefore: DateTime
  completedAfter: DateTime
  projectId: ID
}

enum TaskSortField {
  PRIORITY
  DUE_DATE
  CREATED_AT
  UPDATED_AT
  ORDER
}

type TaskConnection {
  edges: [TaskEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
  filteredCount: Int
  aggregations: TaskAggregations
}

type TaskEdge {
  node: Task!
  cursor: String!
}

type TaskAggregations {
  byStatus: JSON!
  byPriority: JSON!
  byType: JSON!
}

# --- Comment ---
type Comment implements Node {
  id: ID!
  content: String!
  author: User!
  mentions: [User!]!
  reactions: [Reaction!]!
  parent: Comment
  replies(first: Int, after: String): CommentConnection
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Reaction {
  emoji: String!
  users: [User!]!
  count: Int!
  viewerReacted: Boolean!
}

type CommentConnection {
  edges: [CommentEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type CommentEdge {
  node: Comment!
  cursor: String!
}

# --- Checklist ---
type Checklist {
  id: ID!
  title: String!
  items: [ChecklistItem!]!
  progress: Float!
}

type ChecklistItem {
  id: ID!
  text: String!
  checked: Boolean!
  order: Int!
}

# --- Attachment ---
type Attachment {
  id: ID!
  filename: String!
  size: BigInt!
  mimeType: String!
  url: URL!
  thumbnailUrl: URL
  uploadedBy: User!
  createdAt: DateTime!
}

# --- Notification ---
type Notification implements Node {
  id: ID!
  type: NotificationType!
  title: String!
  body: String!
  link: String!
  read: Boolean!
  actor: User
  task: Task
  createdAt: DateTime!
}

enum NotificationType {
  MENTION
  ASSIGN
  COMMENT
  DUE_DATE
  STATUS_CHANGE
}

type NotificationConnection {
  edges: [NotificationEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
  unreadCount: Int!
}

type NotificationEdge {
  node: Notification!
  cursor: String!
}

# --- Activity Log ---
type ActivityLog {
  id: ID!
  action: String!
  actor: User!
  metadata: JSON
  createdAt: DateTime!
}

type ActivityLogConnection {
  edges: [ActivityLogEdge!]!
  pageInfo: PageInfo!
}

type ActivityLogEdge {
  node: ActivityLog!
  cursor: String!
}

# --- Search ---
union SearchResult = Task | Project | User

type SearchResultConnection {
  edges: [SearchResultEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type SearchResultEdge {
  node: SearchResult!
  cursor: String!
  score: Float!
  highlight: String
}

# --- Upload ---
type UploadSignature {
  uploadUrl: URL!
  fileId: ID!
  expiresAt: DateTime!
  headers: JSON!
}

type File {
  id: ID!
  filename: String!
  size: BigInt!
  mimeType: String!
  url: URL!
  thumbnailUrl: URL
  uploadedBy: User!
  createdAt: DateTime!
}

# --- Error ---
type Error {
  code: String!
  message: String!
  field: String
}

# --- Pagination ---
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# --- Query ---
type Query {
  # 节点查询 (Relay)
  node(id: ID!): Node
  nodes(ids: [ID!]!): [Node]!

  # 当前用户
  me: MePayload!

  # 组织
  organizations(first: Int, after: String, includeArchived: Boolean): OrganizationConnection!
  organization(id: ID!): Organization!
  organizationBySlug(slug: String!): Organization!

  # 成员
  organizationMembers(
    orgId: ID!
    role: MemberRole
    status: MemberStatus
    search: String
    first: Int
    after: String
  ): MemberConnection!

  # 项目
  organizationProjects(
    orgId: ID!
    archived: Boolean
    leadId: ID
    search: String
    sort: ProjectSortField
    order: SortOrder
    first: Int
    after: String
  ): ProjectConnection!
  project(id: ID!): Project!

  # 看板
  projectBoards(projectId: ID!, first: Int, after: String): BoardConnection!
  board(id: ID!): Board!

  # 任务
  tasks(
    filter: TaskFilterInput!
    sort: TaskSortField
    order: SortOrder
    first: Int
    after: String
  ): TaskConnection!
  task(id: ID!): Task!

  # 评论
  taskComments(
    taskId: ID!
    first: Int
    after: String
    sort: SortOrder
  ): CommentConnection!

  # 通知
  notifications(
    unreadOnly: Boolean
    type: NotificationType
    first: Int
    after: String
  ): NotificationConnection!

  # 活动日志
  activityLogs(
    entityType: String
    entityId: ID
    first: Int
    after: String
  ): ActivityLogConnection!

  # 搜索
  search(
    query: String!
    type: SearchType
    projectId: ID
    first: Int
    after: String
  ): SearchResultConnection!
}

# --- Mutation ---
type Mutation {
  # 组织
  createOrganization(input: CreateOrganizationInput!): CreateOrganizationPayload!
  updateOrganization(id: ID!, input: UpdateOrganizationInput!): UpdateOrganizationPayload!
  deleteOrganization(id: ID!): DeletePayload!

  # 成员
  inviteMember(input: InviteMemberInput!): InvitePayload!
  updateMemberRole(orgId: ID!, memberId: ID!, role: MemberRole!): Member!
  removeMember(orgId: ID!, memberId: ID!): DeletePayload!

  # 项目
  createProject(input: CreateProjectInput!): CreateProjectPayload!
  updateProject(id: ID!, input: UpdateProjectInput!): UpdateProjectPayload!
  archiveProject(id: ID!): Project!
  deleteProject(id: ID!): DeletePayload!

  # 任务
  createTask(input: CreateTaskInput!): CreateTaskPayload!
  updateTask(id: ID!, input: UpdateTaskInput!): UpdateTaskPayload!
  batchUpdateTasks(input: BatchUpdateTasksInput!): BatchUpdatePayload!
  reorderTasks(input: ReorderTasksInput!): [Task!]!
  deleteTask(id: ID!): DeletePayload!

  # 评论
  createComment(input: CreateCommentInput!): Comment!
  updateComment(id: ID!, content: String!): Comment!
  deleteComment(id: ID!): DeletePayload!
  addReaction(commentId: ID!, emoji: String!): Comment!
  removeReaction(commentId: ID!, emoji: String!): Comment!

  # 检查清单
  updateChecklist(taskId: ID!, checklistId: ID!, items: [UpdateChecklistItemInput!]!): Checklist!

  # 通知
  markNotificationRead(id: ID!): Notification!
  markAllNotificationsRead: Boolean!

  # 上传
  createUploadSignature(input: CreateUploadSignatureInput!): UploadSignature!
  confirmUpload(fileId: ID!, etag: String!): File!
}

# --- Input Types ---
input CreateOrganizationInput {
  name: String!
  slug: String!
  description: String
  clientMutationId: String
}

type CreateOrganizationPayload {
  organization: Organization!
  clientMutationId: String
  errors: [Error!]
}

input UpdateOrganizationInput {
  name: String
  description: String
  avatarUrl: URL
  settings: UpdateOrgSettingsInput
  clientMutationId: String
}

input UpdateOrgSettingsInput {
  defaultVisibility: Visibility
  allowMemberInvite: Boolean
}

type UpdateOrganizationPayload {
  organization: Organization!
  clientMutationId: String
  errors: [Error!]
}

input InviteMemberInput {
  orgId: ID!
  email: String!
  role: MemberRole!
  projectIds: [ID!]
  message: String
  clientMutationId: String
}

input CreateProjectInput {
  orgId: ID!
  name: String!
  description: String
  visibility: Visibility
  color: String
  icon: String
  leadId: ID
  memberIds: [ID!]
  clientMutationId: String
}

type CreateProjectPayload {
  project: Project!
  clientMutationId: String
  errors: [Error!]
}

input UpdateProjectInput {
  name: String
  description: String
  visibility: Visibility
  color: String
  icon: String
  leadId: ID
  clientMutationId: String
}

type UpdateProjectPayload {
  project: Project!
  clientMutationId: String
  errors: [Error!]
}

input CreateTaskInput {
  projectId: ID!
  boardId: ID
  columnId: ID
  title: String!
  description: String
  type: TaskType
  priority: TaskPriority
  labels: [String!]
  assigneeId: ID
  dueDate: DateTime
  estimatedHours: Float
  subtaskTitles: [String!]
  clientMutationId: String
}

type CreateTaskPayload {
  task: Task!
  subtasks: [Task!]
  clientMutationId: String
  errors: [Error!]
}

input UpdateTaskInput {
  title: String
  description: String
  type: TaskType
  priority: TaskPriority
  labels: [String!]
  assigneeId: ID
  columnId: ID
  status: TaskStatus
  dueDate: DateTime
  estimatedHours: Float
  order: Int
  clientMutationId: String
}

type UpdateTaskPayload {
  task: Task!
  clientMutationId: String
  errors: [Error!]
}

input BatchUpdateTasksInput {
  taskIds: [ID!]!
  updates: BatchUpdateFields!
  clientMutationId: String
}

input BatchUpdateFields {
  columnId: ID
  status: TaskStatus
  priority: TaskPriority
  assigneeId: ID
  labels: [String!]
}

type BatchUpdatePayload {
  updated: [ID!]!
  failed: [BatchError!]!
  clientMutationId: String
}

type BatchError {
  taskId: ID!
  error: Error!
}

input ReorderTasksInput {
  boardId: ID!
  tasks: [ReorderTaskInput!]!
  clientMutationId: String
}

input ReorderTaskInput {
  id: ID!
  columnId: ID!
  order: Int!
}

input CreateCommentInput {
  taskId: ID!
  content: String!
  parentId: ID
  clientMutationId: String
}

input UpdateChecklistItemInput {
  id: ID!
  checked: Boolean!
  order: Int
}

input CreateUploadSignatureInput {
  filename: String!
  contentType: String!
  size: BigInt!
  taskId: ID
}

type DeletePayload {
  success: Boolean!
  clientMutationId: String
}

enum SortOrder {
  ASC
  DESC
}

enum ProjectSortField {
  NAME
  CREATED_AT
  UPDATED_AT
}

enum SearchType {
  TASK
  PROJECT
  USER
}

# --- Subscription (Real-time) ---
type Subscription {
  taskUpdated(projectId: ID!): TaskUpdatePayload!
  taskCreated(projectId: ID!): Task!
  taskDeleted(projectId: ID!): ID!
  commentAdded(taskId: ID!): Comment!
  notificationAdded: Notification!
  activityAdded(entityType: String, entityId: ID): ActivityLog!
}

type TaskUpdatePayload {
  taskId: ID!
  updates: JSON!
  actor: User!
  timestamp: DateTime!
}
```

---

## 五、RESTful vs GraphQL 混合使用场景

### 5.1 场景决策表

```
┌─────────────────────────────────┬──────────┬────────────┐
│ 场景                           │ 推荐     │ 原因        │
├─────────────────────────────────┼──────────┼────────────┤
│ 列表页 (项目/任务列表)          │ REST     │ 固定结构    │
│                                 │          │ 缓存友好    │
│ 详情页 (单个任务)               │ REST     │ 简单直接    │
│ 全局搜索                        │ GraphQL  │ 跨实体查询  │
│                                 │          │ 灵活筛选    │
│ 拖拽排序                        │ REST     │ 批量更新    │
│                                 │          │ 幂等操作    │
│ 实时通知                        │ GraphQL  │ 订阅支持    │
│                                 │ Sub      │ 推送模型    │
│ 文件上传                        │ REST     │ 二进制流    │
│                                 │          │ 预签名URL   │
│ Dashboard 聚合数据              │ GraphQL  │ 一次请求    │
│                                 │          │ 多源聚合    │
│ Webhook 回调                    │ REST     │ 标准格式    │
│                                 │          │ 第三方集成  │
│ 批量操作                        │ REST     │ 批量端点    │
│                                 │          │ 事务保证    │
│ 活动日志                        │ GraphQL  │ 灵活查询    │
│                                 │          │ 按需字段    │
└─────────────────────────────────┴──────────┴────────────┘
```

### 5.2 BFF 层适配示例

```typescript
// bff/dashboard-resolver.ts — GraphQL BFF 聚合层
// 一个 GraphQL 查询聚合多个 REST 端点

import { Resolver, Query } from 'type-graphql';
import { DataSource } from '../data-source';

@Resolver()
class DashboardResolver {
  @Query(() => DashboardData)
  async dashboard(
    @Arg('orgId') orgId: string,
    @Arg('projectId') projectId: string
  ): Promise<DashboardData> {
    // 并行请求多个 REST 端点
    const [project, tasks, members, activity] = await Promise.all([
      DataSource.get(`/api/v1/projects/${projectId}`),
      DataSource.get(`/api/v1/projects/${projectId}/tasks?limit=5&sort=updated_at`),
      DataSource.get(`/api/v1/organizations/${orgId}/members?limit=10`),
      DataSource.get(`/api/v1/organizations/${orgId}/activity?limit=20`)
    ]);

    // 计算聚合指标
    const taskStats = calculateTaskStats(tasks);
    const velocity = calculateVelocity(tasks);
    const burndown = calculateBurndown(tasks);

    return {
      project: project.data,
      taskStats,
      recentTasks: tasks.data,
      activeMembers: members.data.filter(m => m.status === 'active'),
      recentActivity: activity.data,
      velocity,
      burndown,
      healthScore: calculateHealthScore(project.data, taskStats, velocity)
    };
  }
}

// 客户端使用:
// query Dashboard {
//   dashboard(orgId: "org_001", projectId: "proj_001") {
//     project { name progress }
//     taskStats { total todo inProgress done }
//     velocity { avgCompletedPerSprint trend }
//     burndown { ideal actual remaining }
//     recentTasks { title priority status assignee { name } }
//     healthScore
//   }
// }
```

---

## 六、OpenAPI 3.1 文档规范

### 6.1 文档结构

```yaml
# openapi.yaml — CloudBoard API 规范 (节选)

openapi: "3.1.0"
info:
  title: CloudBoard API
  description: |
    CloudBoard 协作平台 RESTful API。

    ## 认证
    所有请求需要在 Header 中携带 JWT Token:
    ```
    Authorization: Bearer <token>
    ```

    ## 速率限制
    | 计划   | 每分钟请求 | 每小时请求 |
    |--------|-----------|-----------|
    | Free   | 60        | 1000      |
    | Pro    | 300       | 10000     |
    | Enterprise | 1000  | 50000     |

    响应 Header 包含速率限制信息:
    ```
    X-RateLimit-Limit: 300
    X-RateLimit-Remaining: 295
    X-RateLimit-Reset: 1714492860
    ```

    ## 分页
    使用 Cursor-Based 分页:
    ```
    GET /api/v1/tasks?cursor=eyJpZCI6MTIzfQ&limit=20
    ```

    ## 错误码
    | 错误码 | 说明 |
    |--------|------|
    | VALIDATION_ERROR | 请求参数验证失败 |
    | AUTH_REQUIRED | 未认证 |
    | INSUFFICIENT_PERMISSIONS | 权限不足 |
    | RATE_LIMIT_EXCEEDED | 速率限制 |
    | NOT_FOUND | 资源不存在 |
    | CONFLICT | 资源冲突 |
    | INTERNAL_ERROR | 服务器内部错误 |
  version: "1.0.0"
  contact:
    name: CloudBoard API Support
    url: https://docs.cloudboard.example.com/support
    email: api-support@cloudboard.example.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.cloudboard.example.com/api/v1
    description: Production
  - url: https://api-staging.cloudboard.example.com/api/v1
    description: Staging
  - url: http://localhost:3000/api/v1
    description: Local Development

tags:
  - name: Organizations
    description: 组织管理
  - name: Members
    description: 成员管理
  - name: Projects
    description: 项目管理
  - name: Tasks
    description: 任务管理
  - name: Comments
    description: 评论管理
  - name: Notifications
    description: 通知管理
  - name: Upload
    description: 文件上传
  - name: Search
    description: 全局搜索
  - name: Webhooks
    description: Webhook 管理

paths:
  /organizations:
    get:
      tags: [Organizations]
      summary: 获取当前用户的所有组织
      operationId: listOrganizations
      parameters:
        - name: include_archived
          in: query
          schema:
            type: boolean
            default: false
        - name: fields
          in: query
          schema:
            type: string
          description: 逗号分隔的字段列表 (sparse fieldsets)
      responses:
        '200':
          description: 成功返回组织列表
          headers:
            X-RateLimit-Limit:
              schema: { type: integer }
            X-RateLimit-Remaining:
              schema: { type: integer }
            X-RateLimit-Reset:
              schema: { type: integer }
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/OrganizationSummary'
                  meta:
                    $ref: '#/components/schemas/ListMeta'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/RateLimited'
      security:
        - bearerAuth: []

    post:
      tags: [Organizations]
      summary: 创建组织
      operationId: createOrganization
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrganizationRequest'
            examples:
              default:
                summary: 创建组织示例
                value:
                  name: "Acme Corporation"
                  slug: "acme-corp"
                  description: "Software development team"
      responses:
        '201':
          description: 创建成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Organization'
        '400':
          $ref: '#/components/responses/ValidationError'
        '409':
          $ref: '#/components/responses/Conflict'
      security:
        - bearerAuth: []

  /organizations/{org_id}:
    parameters:
      - name: org_id
        in: path
        required: true
        schema: { type: string }
        description: 组织 ID (ULID)
    get:
      tags: [Organizations]
      summary: 获取组织详情
      operationId: getOrganization
      responses:
        '200':
          description: 成功返回组织详情
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/OrganizationDetail'
        '404':
          $ref: '#/components/responses/NotFound'
      security:
        - bearerAuth: []

    patch:
      tags: [Organizations]
      summary: 更新组织
      operationId: updateOrganization
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateOrganizationRequest'
      responses:
        '200':
          description: 更新成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Organization'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
      security:
        - bearerAuth: []

    delete:
      tags: [Organizations]
      summary: 删除组织
      operationId: deleteOrganization
      responses:
        '204':
          description: 删除成功
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
      security:
        - bearerAuth: []

  /projects/{project_id}/tasks:
    parameters:
      - name: project_id
        in: path
        required: true
        schema: { type: string }
    get:
      tags: [Tasks]
      summary: 列出项目任务
      description: |
        支持多维度过滤、排序、分页。

        **过滤组合示例:**
        ```
        GET /projects/proj_001/tasks?status_in=todo,in_progress&priority=high&labels=auth,backend&sort=priority&order=desc
        ```
      operationId: listTasks
      parameters:
        - name: status
          in: query
          schema: { $ref: '#/components/schemas/TaskStatus' }
        - name: status_in
          in: query
          schema: { type: string }
          description: 逗号分隔的状态列表
        - name: assignee_id
          in: query
          schema: { type: string }
        - name: assignee_in
          in: query
          schema: { type: string }
          description: 逗号分隔的负责人ID列表
        - name: type
          in: query
          schema: { $ref: '#/components/schemas/TaskType' }
        - name: priority
          in: query
          schema: { $ref: '#/components/schemas/TaskPriority' }
        - name: labels
          in: query
          schema: { type: string }
          description: 逗号分隔的标签列表 (匹配任意)
        - name: labels_all
          in: query
          schema: { type: string }
          description: 逗号分隔的标签列表 (匹配全部)
        - name: search
          in: query
          schema: { type: string }
          description: 全文搜索 (标题/描述)
        - name: due_after
          in: query
          schema: { type: string, format: date }
        - name: due_before
          in: query
          schema: { type: string, format: date }
        - name: sort
          in: query
          schema:
            type: string
            enum: [priority, due_date, created_at, updated_at, order]
            default: order
        - name: order
          in: query
          schema:
            type: string
            enum: [asc, desc]
        - name: cursor
          in: query
          schema: { type: string }
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 30
        - name: fields
          in: query
          schema: { type: string }
          description: 逗号分隔的字段列表 (sparse fieldsets)
      responses:
        '200':
          description: 成功返回任务列表
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/TaskSummary'
                  meta:
                    $ref: '#/components/schemas/TaskListMeta'
        '404':
          $ref: '#/components/responses/NotFound'
      security:
        - bearerAuth: []

    post:
      tags: [Tasks]
      summary: 创建任务
      operationId: createTask
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTaskRequest'
            examples:
              basic:
                summary: 基本创建
                value:
                  title: "实现用户认证模块"
                  type: "feature"
                  priority: "high"
                  assignee_id: "user_abc"
              with_details:
                summary: 完整创建 (含子任务)
                value:
                  title: "实现用户认证模块"
                  description: "# 用户认证模块\n\n## 需求\n- JWT Token 签发与刷新\n- OAuth2 Google/GitHub 登录"
                  type: "feature"
                  priority: "high"
                  labels: ["auth", "backend"]
                  assignee_id: "user_abc"
                  due_date: "2026-05-15"
                  estimated_hours: 16
                  subtask_titles:
                    - "设计 JWT 数据结构"
                    - "实现 Token 刷新逻辑"
                    - "集成 OAuth2 Provider"
      responses:
        '201':
          description: 创建成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Task'
        '400':
          $ref: '#/components/responses/ValidationError'
      security:
        - bearerAuth: []

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT Token (从 /auth/login 获取)

  schemas:
    OrganizationSummary:
      type: object
      properties:
        id: { type: string, description: "组织 ID (ULID)" }
        slug: { type: string, description: "组织短名 (URL友好)" }
        name: { type: string, minLength: 2, maxLength: 100 }
        avatar_url: { type: string, format: uri }
        plan: { $ref: '#/components/schemas/Plan' }
        member_count: { type: integer }
        project_count: { type: integer }
        my_role: { $ref: '#/components/schemas/MemberRole' }
      required: [id, slug, name, plan, member_count, project_count, my_role]

    OrganizationDetail:
      allOf:
        - $ref: '#/components/schemas/OrganizationSummary'
        - type: object
          properties:
            description: { type: string, maxLength: 500 }
            settings: { $ref: '#/components/schemas/OrgSettings' }
            stats: { $ref: '#/components/schemas/OrgStats' }
            created_at: { type: string, format: date-time }
            updated_at: { type: string, format: date-time }
          required: [settings, stats, created_at, updated_at]

    OrgSettings:
      type: object
      properties:
        default_visibility: { $ref: '#/components/schemas/Visibility' }
        allow_member_invite: { type: boolean }
        max_projects: { type: integer }
      required: [default_visibility, allow_member_invite, max_projects]

    OrgStats:
      type: object
      properties:
        member_count: { type: integer }
        project_count: { type: integer }
        active_task_count: { type: integer }
        completed_task_count: { type: integer }
      required: [member_count, project_count, active_task_count, completed_task_count]

    Plan:
      type: string
      enum: [free, pro, enterprise]

    Visibility:
      type: string
      enum: [public, private]

    MemberRole:
      type: string
      enum: [owner, admin, member, viewer]

    TaskSummary:
      type: object
      properties:
        id: { type: string }
        title: { type: string, minLength: 1, maxLength: 200 }
        type: { $ref: '#/components/schemas/TaskType' }
        priority: { $ref: '#/components/schemas/TaskPriority' }
        labels: { type: array, items: { type: string } }
        status: { $ref: '#/components/schemas/TaskStatus' }
        assignee: { $ref: '#/components/schemas/UserRef' }
        reporter: { $ref: '#/components/schemas/UserRef' }
        due_date: { type: string, format: date }
        subtask_count: { type: integer }
        comment_count: { type: integer }
        created_at: { type: string, format: date-time }
        updated_at: { type: string, format: date-time }
      required: [id, title, type, priority, status, reporter, created_at, updated_at]

    Task:
      allOf:
        - $ref: '#/components/schemas/TaskSummary'
        - type: object
          properties:
            description: { type: string }
            board_id: { type: string }
            column_id: { type: string }
            estimated_hours: { type: number, minimum: 0 }
            actual_hours: { type: number, minimum: 0 }
            order: { type: integer }
            attachments: { type: array, items: { $ref: '#/components/schemas/Attachment' } }
            checklists: { type: array, items: { $ref: '#/components/schemas/Checklist' } }
            subtasks: { type: array, items: { $ref: '#/components/schemas/TaskSummary' } }
            completed_at: { type: string, format: date-time }
          required: [description, attachments, checklists, subtasks]

    TaskType:
      type: string
      enum: [task, bug, feature, docs]

    TaskPriority:
      type: string
      enum: [critical, high, medium, low]

    TaskStatus:
      type: string
      enum: [backlog, todo, in_progress, review, done, cancelled]

    UserRef:
      type: object
      properties:
        id: { type: string }
        name: { type: string }
        avatar_url: { type: string, format: uri }
      required: [id, name]

    Attachment:
      type: object
      properties:
        id: { type: string }
        filename: { type: string }
        size: { type: integer }
        mime_type: { type: string }
        url: { type: string, format: uri }
        thumbnail_url: { type: string, format: uri }
        uploaded_by: { $ref: '#/components/schemas/UserRef' }
        created_at: { type: string, format: date-time }
      required: [id, filename, size, mime_type, url, uploaded_by, created_at]

    Checklist:
      type: object
      properties:
        id: { type: string }
        title: { type: string }
        items: { type: array, items: { $ref: '#/components/schemas/ChecklistItem' } }
        progress: { type: number, minimum: 0, maximum: 1 }
      required: [id, title, items, progress]

    ChecklistItem:
      type: object
      properties:
        id: { type: string }
        text: { type: string }
        checked: { type: boolean }
        order: { type: integer }
      required: [id, text, checked, order]

    CreateOrganizationRequest:
      type: object
      properties:
        name: { type: string, minLength: 2, maxLength: 100 }
        slug:
          type: string
          pattern: '^[a-z0-9]+(-[a-z0-9]+)*$'
          minLength: 2
          maxLength: 32
          description: "仅允许小写字母、数字和连字符"
        description: { type: string, maxLength: 500 }
      required: [name, slug]

    UpdateOrganizationRequest:
      type: object
      properties:
        name: { type: string, minLength: 2, maxLength: 100 }
        description: { type: string, maxLength: 500 }
        avatar_url: { type: string, format: uri }

    CreateTaskRequest:
      type: object
      properties:
        title: { type: string, minLength: 1, maxLength: 200 }
        description: { type: string }
        type: { $ref: '#/components/schemas/TaskType' }
        priority: { $ref: '#/components/schemas/TaskPriority' }
        labels: { type: array, items: { type: string, maxLength: 30 } }
        assignee_id: { type: string }
        board_id: { type: string }
        column_id: { type: string }
        due_date: { type: string, format: date }
        estimated_hours: { type: number, minimum: 0 }
        subtask_titles:
          type: array
          items: { type: string, maxLength: 200 }
          maxItems: 50
      required: [title]

    TaskListMeta:
      type: object
      properties:
        total: { type: integer }
        filtered_count: { type: integer }
        page_info:
          type: object
          properties:
            has_next: { type: boolean }
            cursor: { type: string }
        aggregations:
          type: object
          properties:
            by_status: { type: object }
            by_priority: { type: object }
      required: [total, page_info]

    ListMeta:
      type: object
      properties:
        total: { type: integer }
        current_org: { type: string }
        page_info:
          type: object
          properties:
            has_next: { type: boolean }
            cursor: { type: string }
      required: [total]

    ErrorResponse:
      type: object
      properties:
        error:
          type: object
          properties:
            code: { type: string }
            message: { type: string }
            details:
              type: array
              items:
                type: object
                properties:
                  field: { type: string }
                  message: { type: string }
                  code: { type: string }
            request_id: { type: string }
            timestamp: { type: string, format: date-time }
          required: [code, message, request_id, timestamp]
      required: [error]

  responses:
    Unauthorized:
      description: 未认证或 Token 过期
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: "AUTH_REQUIRED"
              message: "请提供有效的认证 Token"
              request_id: "req_8f3a2b1c9d4e"
              timestamp: "2026-04-30T13:00:00.000Z"

    Forbidden:
      description: 权限不足
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: "INSUFFICIENT_PERMISSIONS"
              message: "您需要 admin 或 owner 权限才能执行此操作"
              request_id: "req_8f3a2b1c9d4e"
              timestamp: "2026-04-30T13:00:00.000Z"

    NotFound:
      description: 资源不存在
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: "NOT_FOUND"
              message: "指定的组织不存在"
              request_id: "req_8f3a2b1c9d4e"
              timestamp: "2026-04-30T13:00:00.000Z"

    ValidationError:
      description: 请求参数验证失败
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: "VALIDATION_ERROR"
              message: "请求参数验证失败"
              details:
                - field: "name"
                  message: "名称长度必须在 2-100 个字符之间"
                  code: "INVALID_LENGTH"
                - field: "slug"
                  message: "slug 只能包含小写字母、数字和连字符"
                  code: "INVALID_FORMAT"
              request_id: "req_8f3a2b1c9d4e"
              timestamp: "2026-04-30T13:00:00.000Z"

    Conflict:
      description: 资源冲突
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: "CONFLICT"
              message: "slug 'acme-corp' 已被其他组织使用"
              request_id: "req_8f3a2b1c9d4e"
              timestamp: "2026-04-30T13:00:00.000Z"

    RateLimited:
      description: 速率限制
      headers:
        Retry-After:
          schema: { type: integer }
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: "RATE_LIMIT_EXCEEDED"
              message: "请求过于频繁，请稍后重试"
              request_id: "req_8f3a2b1c9d4e"
              timestamp: "2026-04-30T13:00:00.000Z"
```

---

## 七、API 设计 Checklist（阶段一终极版）

### 7.1 RESTful Checklist

```
□ 资源命名使用复数名词
□ URL 层级不超过 2 层嵌套
□ 正确使用 HTTP 方法语义
□ 统一分页格式 (Cursor-Based)
□ 统一错误响应格式
□ 支持 Sparse Fieldsets (fields 参数)
□ 支持 Include/Expand (关联资源预加载)
□ 返回 HATEOAS 链接
□ 正确使用 HTTP 状态码
□ 幂等性保证 (PUT/DELETE)
□ 速率限制 + 响应 Header
□ ETag / Last-Modified 缓存支持
□ 请求 ID 追踪 (X-Request-ID)
□ API 版本化策略
□ 向后兼容的 Schema 演进
□ 输入验证 + 错误提示
□ 文档完整 (OpenAPI 3.x)
```

### 7.2 GraphQL Checklist

```
□ 遵循 Relay 规范 (Node interface, Connection pattern)
□ clientMutationId 支持 (mutation 去重)
□ 统一错误处理 (errors 字段)
□ DataLoader 解决 N+1
□ 查询深度限制 (max depth: 7)
□ 查询复杂度限制 (max complexity: 1000)
□ 分页使用 cursor-based (first/after)
□ 接口类型 (Node) 统一查询
□ 联合类型 (SearchResult) 跨实体
□ 指令驱动权限控制 (@includeRole)
□ 订阅支持 (实时通知)
□ 持久化查询 (生产环境)
□ 内省查询保护 (生产环境禁用)
□ 文档自动生成 (GraphQL Docs)
```

### 7.3 安全 Checklist

```
□ JWT Token 认证
□ RBAC 权限模型
□ 资源级权限控制
□ 速率限制
□ 输入验证 (长度/格式/类型)
□ SQL 注入防护 (参数化查询)
□ XSS 防护 (输出转义)
□ CORS 配置
□ CSRF 防护 (如使用 Cookie)
□ 敏感数据脱敏
□ 审计日志
□ Webhook 签名验证
□ 文件上传类型/大小限制
□ HTTPS Only
□ Token 过期 + 刷新机制
```

---

## 八、API 设计经验总结

### 8.1 7 轮迭代的核心收获

| 轮次 | 核心收获 |
|------|---------|
| 4/22 基础 | REST 资源建模、HTTP 语义、状态码 |
| 4/23 进阶 | 分页策略、错误处理、认证鉴权 |
| 4/26 巩固 | GraphQL Schema、DataLoader、性能优化 |
| 4/27 生产级 | 版本演进、OpenAPI 文档、高级模式 |
| 4/28 终章 | 批量操作、WebSocket、事件溯源 |
| 4/29 REST+GraphQL | 混合架构、BFF 层、决策框架 |
| 4/30 终极版 | 完整业务 API、OpenAPI 3.1 规范、Checklist |

### 8.2 关键设计原则

```
1. 一致性 > 灵活性
   — 命名、分页、错误格式统一，降低学习成本

2. 向后兼容是铁律
   — 可以加字段，不能删/改名，破坏性变更需版本化

3. 客户端需要什么就给什么
   — REST: fields/include 参数
   — GraphQL: 按需查询

4. 错误信息要 helpful
   — 不只是 "Bad Request"，而是 "email 格式不正确"

5. 文档即契约
   — OpenAPI/GraphQL Schema 是 API 的 truth source
   — 代码生成 (SDK/Mock) 从文档出发

6. 安全左移
   — 认证/鉴权/限流是基础设施，不是附加功能

7. 可观测性
   — 请求 ID、日志、指标、追踪，缺一不可
```

---

**阶段一 API 设计领域闭环完成 ✅**

7 轮迭代 / ~400KB 文档 / 从基础到生产级 / RESTful + GraphQL 混合架构完整覆盖
