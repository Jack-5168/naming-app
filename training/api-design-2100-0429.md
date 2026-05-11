# API 设计专项训练 (21:00)

> 2026-04-29 | RESTful + GraphQL 设计原则 + 完整 API 设计 + 文档

---

## 一、API 设计总论

### 1.1 什么是好的 API 设计

| 维度 | 差的 API | 好的 API |
|------|---------|---------|
| **一致性** | 每个端点命名风格不同 | 统一命名规范，可预测 |
| ** discoverability** | 需要阅读大量文档才能使用 | 自描述，HATEOAS 引导 |
| **版本管理** | 破坏性变更不通知 | 版本化策略清晰 |
| **错误处理** | 所有错误返回 200 + 错误码 | 正确使用 HTTP 状态码 |
| **性能** | N+1 查询问题 | 支持字段选择、分页、缓存 |
| **安全性** | 无认证/鉴权 | OAuth2/JWT + 权限粒度控制 |

### 1.2 API 设计原则 Checklist

- [ ] **资源导向**：URL 表示资源（名词），方法表示操作（动词）
- [ ] **无状态**：每个请求包含所有必要信息
- [ ] **一致性**：命名、分页、错误格式统一
- [ ] **向后兼容**：新增字段 OK，删除/改名需版本化
- [ ] **幂等性**：GET/PUT/DELETE 幂等，POST 非幂等
- [ ] **可发现性**：响应包含链接，引导下一步操作
- [ ] **安全性**：认证 + 鉴权 + 速率限制 + 输入验证
- [ ] **可观测性**：请求 ID、日志、监控指标

---

## 二、RESTful API 设计深度解析

### 2.1 URL 设计规范

#### 2.1.1 资源命名

```
✅ 正确
GET    /api/v1/users          # 用户列表
GET    /api/v1/users/123      # 单个用户
POST   /api/v1/users          # 创建用户
PUT    /api/v1/users/123      # 全量更新
PATCH  /api/v1/users/123      # 部分更新
DELETE /api/v1/users/123      # 删除用户

❌ 错误
GET    /api/v1/getUsers       # 动词在 URL 中
GET    /api/v1/user_list      # 下划线命名
GET    /api/v1/Users          # 大写字母
POST   /api/v1/createUser     # 动词在 URL 中
```

#### 2.1.2 嵌套资源

```
✅ 正确 — 从属关系
GET    /api/v1/users/123/posts           # 用户的文章
GET    /api/v1/users/123/posts/456       # 用户的某篇文章
POST   /api/v1/users/123/posts           # 为用户创建文章
DELETE /api/v1/users/123/posts/456       # 删除用户的文章

⚠️ 注意 — 不要超过 3 层嵌套
❌ /api/v1/users/123/posts/456/comments/789/likes  (太深)
✅ /api/v1/posts/456/comments?userId=123            (扁平化)
```

#### 2.1.3 集合 vs 单个资源

```
集合端点（复数）：/api/v1/users
单个资源端点：/api/v1/users/{id}

POST   /api/v1/users        → 201 Created (创建在集合上)
PUT    /api/v1/users/{id}    → 200 OK 或 204 No Content
PATCH  /api/v1/users/{id}    → 200 OK
DELETE /api/v1/users/{id}    → 204 No Content
```

### 2.2 HTTP 方法语义

| 方法 | 语义 | 幂等 | 请求体 | 成功状态码 |
|------|------|------|--------|-----------|
| GET | 获取资源 | ✅ | 不应有 | 200 OK |
| POST | 创建资源 | ❌ | 有 | 201 Created |
| PUT | 全量替换 | ✅ | 有 | 200/204 |
| PATCH | 部分更新 | ✅ | 有 | 200/202 |
| DELETE | 删除资源 | ✅ | 不应有 | 204 No Content |
| HEAD | 获取元信息 | ✅ | 无 | 200 OK |
| OPTIONS | 获取允许的方法 | ✅ | 无 | 200 OK |

### 2.3 HTTP 状态码完整指南

#### 2xx 成功
```
200 OK              — GET/PUT/PATCH 成功
201 Created         — POST 创建成功，Location 头包含新资源 URL
202 Accepted        — 请求已接受，但处理尚未完成（异步）
204 No Content      — DELETE 成功，无响应体
```

#### 3xx 重定向
```
301 Moved Permanently   — 资源永久迁移
304 Not Modified        — 缓存命中（If-None-Match / If-Modified-Since）
```

#### 4xx 客户端错误
```
400 Bad Request         — 请求格式错误（验证失败）
401 Unauthorized        — 未认证
403 Forbidden           — 已认证但无权限
404 Not Found           — 资源不存在
405 Method Not Allowed  — 方法不允许
409 Conflict            — 资源冲突（如重复创建）
422 Unprocessable Entity — 语义错误（验证通过但业务规则不满足）
429 Too Many Requests   — 速率限制
```

#### 5xx 服务端错误
```
500 Internal Server Error  — 通用服务端错误
502 Bad Gateway            — 上游服务错误
503 Service Unavailable    — 服务不可用（维护/过载）
```

### 2.4 请求/响应格式

#### 2.4.1 统一响应格式

```typescript
// 成功响应
interface SuccessResponse<T> {
  data: T;
  meta?: {
    requestId: string;
    timestamp: string;
    pagination?: PaginationMeta;
  };
}

// 错误响应
interface ErrorResponse {
  error: {
    code: string;        // 机器可读错误码: "USER_NOT_FOUND"
    message: string;     // 人类可读: "用户 ID 123 不存在"
    details?: Array<{    // 详细错误信息
      field: string;
      message: string;
    }>;
    requestId: string;
    timestamp: string;
  };
}

// 示例：成功
{
  "data": {
    "id": "usr_123",
    "name": "张三",
    "email": "zhangsan@example.com",
    "role": "admin",
    "createdAt": "2026-04-29T12:00:00Z"
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-04-29T12:00:01Z"
  }
}

// 示例：错误
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [
      { "field": "email", "message": "邮箱格式不正确" },
      { "field": "age", "message": "年龄必须在 0-150 之间" }
    ],
    "requestId": "req_def456",
    "timestamp": "2026-04-29T12:00:02Z"
  }
}
```

#### 2.4.2 分页设计

```typescript
// 方案 A：偏移分页 (Offset-based) — 适合小数据集
GET /api/v1/users?limit=20&offset=40
Response:
{
  "data": [...],
  "meta": {
    "pagination": {
      "limit": 20,
      "offset": 40,
      "total": 156,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": true
    }
  }
}

// 方案 B：游标分页 (Cursor-based) — 适合大数据集/实时数据
GET /api/v1/users?limit=20&cursor=eyJpZCI6MTIzfQ==
Response:
{
  "data": [...],
  "meta": {
    "pagination": {
      "limit": 20,
      "nextCursor": "eyJpZCI6MTQzfQ==",
      "prevCursor": "eyJpZCI6MTAxfQ==",
      "hasNext": true,
      "hasPrev": true
    }
  }
}

// 方案 C：Link Header (RFC 5988) — 最 RESTful
// Response Headers:
// Link: <https://api.example.com/users?cursor=abc&limit=20>; rel="next",
//       <https://api.example.com/users?cursor=xyz&limit=20>; rel="prev"
```

**分页选型决策**：
- 数据量 < 10 万 → Offset 分页（简单）
- 数据量 > 10 万 / 实时数据 → Cursor 分页（稳定）
- 需要"跳页"功能 → Offset 分页
- 无限滚动 → Cursor 分页

#### 2.4.3 字段选择 (Sparse Fieldsets)

```
GET /api/v1/users?fields=id,name,email
GET /api/v1/posts?fields=title,content,author.name

// JSON:API 风格
{
  "data": [{
    "id": "1",
    "type": "users",
    "attributes": {
      "name": "张三",
      "email": "zhangsan@example.com"
    }
  }]
}
```

#### 2.4.4 排序 & 过滤

```
// 排序
GET /api/v1/users?sort=-createdAt,name    // 按创建时间降序，再按名字升序

// 过滤
GET /api/v1/users?role=admin&status=active&createdAfter=2026-01-01
GET /api/v1/products?price[gte]=100&price[lte]=500&category=electronics

// 搜索
GET /api/v1/users?search=zhang
```

### 2.5 版本管理策略

```
方案 A：URL 版本化 (最常用)
  /api/v1/users
  /api/v2/users

方案 B：Header 版本化
  Accept: application/vnd.myapi.v1+json

方案 C：查询参数
  /api/users?version=1

推荐：URL 版本化 — 最直观、最易调试
```

### 2.6 缓存策略

```
// 响应头
Cache-Control: public, max-age=300, s-maxage=3600
ETag: "abc123"
Last-Modified: Wed, 29 Apr 2026 12:00:00 GMT

// 客户端条件请求
If-None-Match: "abc123"     → 304 Not Modified
If-Modified-Since: ...      → 304 Not Modified

// 不同资源缓存策略
静态资源 (头像/图片):  Cache-Control: public, max-age=31536000
用户资料:              Cache-Control: private, max-age=60
实时数据 (股票/聊天):   Cache-Control: no-cache, no-store
```

---

## 三、GraphQL 设计深度解析

### 3.1 REST vs GraphQL 选型决策

| 维度 | REST | GraphQL |
|------|------|---------|
| **数据获取** | 固定结构，可能 over/under-fetch | 按需获取，精确数据 |
| **请求数量** | 多端点 → 多请求 | 单端点 → 一次获取关联数据 |
| **类型安全** | 需额外工具 (OpenAPI) | 内建强类型系统 |
| **缓存** | HTTP 缓存天然支持 | 需客户端实现 (Apollo/Relay) |
| **文件上传** | 原生支持 (multipart) | 需扩展 (graphql-upload) |
| **实时数据** | WebSocket/SSE 额外实现 | Subscription 原生支持 |
| **学习曲线** | 低 | 中高 |
| **适用场景** | 公开 API / 简单 CRUD / 移动端 | 复杂数据关系 / 多客户端 / 实时 |

### 3.2 Schema 设计

```graphql
# === 类型定义 ===

scalar DateTime
scalar JSON

type User {
  id: ID!
  name: String!
  email: String!
  role: UserRole!
  avatar: String
  bio: String
  posts: [Post!]!
  followers: [User!]!
  following: [User!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum UserRole {
  ADMIN
  EDITOR
  VIEWER
}

type Post {
  id: ID!
  title: String!
  content: String!
  status: PostStatus!
  author: User!
  comments: [Comment!]!
  tags: [Tag!]!
  likeCount: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

type Comment {
  id: ID!
  content: String!
  author: User!
  post: Post!
  replies: [Comment!]!
  createdAt: DateTime!
}

type Tag {
  id: ID!
  name: String!
  posts: [Post!]!
}

# === 输入类型 ===

input CreateUserInput {
  name: String!
  email: String!
  password: String!
  role: UserRole
  bio: String
}

input UpdateUserInput {
  name: String
  email: String
  avatar: String
  bio: String
}

input CreatePostInput {
  title: String!
  content: String!
  status: PostStatus
  tagIds: [ID!]
}

input PostFilterInput {
  status: PostStatus
  authorId: ID
  tagId: ID
  search: String
  dateRange: DateRangeInput
}

input DateRangeInput {
  start: DateTime!
  end: DateTime!
}

# === 分页 ===

input PaginationInput {
  first: Int = 20
  after: String
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
  totalCount: Int!
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
}

type PostEdge {
  node: Post!
  cursor: String!
}

# === 查询 (Query) ===

type Query {
  # 用户
  user(id: ID!): User
  users(filter: UserFilterInput, pagination: PaginationInput): UserConnection!
  me: User

  # 文章
  post(id: ID!): Post
  posts(filter: PostFilterInput, pagination: PaginationInput): PostConnection!
  trendingPosts(limit: Int = 10): [Post!]!

  # 标签
  tags: [Tag!]!
  tag(id: ID!): Tag
}

# === 变更 (Mutation) ===

type Mutation {
  # 认证
  login(email: String!, password: String!): AuthPayload!
  register(input: CreateUserInput!): AuthPayload!
  refreshToken(refreshToken: String!): AuthPayload!

  # 用户
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
  followUser(userId: ID!): User!
  unfollowUser(userId: ID!): User!

  # 文章
  createPost(input: CreatePostInput!): Post!
  updatePost(id: ID!, input: UpdatePostInput!): Post!
  deletePost(id: ID!): Boolean!
  publishPost(id: ID!): Post!

  # 评论
  addComment(postId: ID!, content: String!): Comment!
  deleteComment(id: ID!): Boolean!
  likePost(postId: ID!): Post!
  unlikePost(postId: ID!): Post!
}

type AuthPayload {
  accessToken: String!
  refreshToken: String!
  user: User!
}

# === 订阅 (Subscription) ===

type Subscription {
  postCreated: Post!
  postUpdated(id: ID): Post!
  commentAdded(postId: ID!): Comment!
  userFollowed(userId: ID!): User!
}
```

### 3.3 GraphQL 查询示例

```graphql
# 查询用户及其文章、评论
query GetUserWithPosts($userId: ID!, $postLimit: Int) {
  user(id: $userId) {
    id
    name
    email
    role
    avatar
    bio
    followers {
      id
      name
      avatar
    }
    posts(first: $postLimit) {
      edges {
        node {
          id
          title
          status
          likeCount
          createdAt
          tags {
            id
            name
          }
          comments(first: 5) {
            edges {
              node {
                id
                content
                author {
                  id
                  name
                  avatar
                }
                createdAt
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
        totalCount
      }
    }
  }
}

# 变量
{
  "userId": "usr_123",
  "postLimit": 10
}

# 搜索文章
query SearchPosts($search: String, $tagId: ID) {
  posts(filter: { search: $search, tagId: $tagId }, pagination: { first: 20 }) {
    edges {
      node {
        id
        title
        excerpt
        author { name }
        likeCount
        createdAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

# 订阅新评论
subscription OnNewComment($postId: ID!) {
  commentAdded(postId: $postId) {
    id
    content
    author {
      name
      avatar
    }
    createdAt
  }
}
```

### 3.4 GraphQL 最佳实践

```
1. 避免 N+1 问题
   ✅ 使用 DataLoader 批量加载
   ✅ 使用 resolver 合并

2. 深度限制
   ✅ 查询深度限制 (默认 7 层)
   ✅ 查询复杂度分析

3. 速率限制
   ✅ 基于查询复杂度限制
   ✅ 基于请求数量限制

4. 错误处理
   ✅ 使用 extensions 字段传递错误码
   ✅ 部分成功场景：data + errors 并存

5. 缓存策略
   ✅ 客户端：Apollo Cache / Relay
   ✅ 服务端：Persisted Queries + CDN

6. 安全性
   ✅ 查询复杂度分析
   ✅ 深度限制
   ✅ 速率限制
   ✅ 白名单字段
```

---

## 四、完整 API 设计实战 — CloudBoard 项目管理平台

### 4.1 项目背景

CloudBoard 是一个企业级项目管理平台，核心功能：
- 工作区 (Workspace) 管理
- 项目 (Project) 管理
- 看板 (Board) 管理
- 任务 (Task) 管理
- 评论 & 附件
- 实时协作
- 团队 & 权限

### 4.2 RESTful API 完整设计

#### 4.2.1 认证 & 鉴权

```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password

// 请求头
Authorization: Bearer <access_token>
X-Request-ID: <uuid>

// Token 策略
Access Token:  JWT, 15 分钟过期
Refresh Token: Random String, 7 天过期, 存储在 Redis
```

#### 4.2.2 工作区 API

```
# 工作区 CRUD
GET    /api/v1/workspaces                  # 列出用户所属工作区
POST   /api/v1/workspaces                  # 创建工作区
GET    /api/v1/workspaces/{id}             # 获取工作区详情
PATCH  /api/v1/workspaces/{id}             # 更新工作区
DELETE /api/v1/workspaces/{id}             # 删除工作区 (需 owner)

# 工作区成员
GET    /api/v1/workspaces/{id}/members          # 列出成员
POST   /api/v1/workspaces/{id}/members          # 邀请成员
PATCH  /api/v1/workspaces/{id}/members/{uid}    # 修改成员角色
DELETE /api/v1/workspaces/{id}/members/{uid}    # 移除成员

# 工作区邀请
POST   /api/v1/workspaces/{id}/invites          # 发送邀请
GET    /api/v1/invites/{token}                  # 接受邀请
```

#### 4.2.3 项目 API

```
GET    /api/v1/workspaces/{wid}/projects
POST   /api/v1/workspaces/{wid}/projects
GET    /api/v1/workspaces/{wid}/projects/{pid}
PATCH  /api/v1/workspaces/{wid}/projects/{pid}
DELETE /api/v1/workspaces/{wid}/projects/{pid}

# 项目归档
POST   /api/v1/workspaces/{wid}/projects/{pid}/archive
POST   /api/v1/workspaces/{wid}/projects/{pid}/unarchive
```

#### 4.2.4 看板 API

```
GET    /api/v1/projects/{pid}/boards
POST   /api/v1/projects/{pid}/boards
GET    /api/v1/projects/{pid}/boards/{bid}
PATCH  /api/v1/projects/{pid}/boards/{bid}
DELETE /api/v1/projects/{pid}/boards/{bid}

# 看板列 (Column)
POST   /api/v1/boards/{bid}/columns          # 创建列
PATCH  /api/v1/boards/{bid}/columns/{cid}    # 更新列 (排序/重命名)
DELETE /api/v1/boards/{bid}/columns/{cid}    # 删除列
```

#### 4.2.5 任务 API — 核心

```
# 任务 CRUD
GET    /api/v1/boards/{bid}/tasks?sort=position&status=active
POST   /api/v1/boards/{bid}/tasks
GET    /api/v1/tasks/{tid}
PATCH  /api/v1/tasks/{tid}
DELETE /api/v1/tasks/{tid}

# 任务操作
POST   /api/v1/tasks/{tid}/move              # 移动任务到不同列/位置
POST   /api/v1/tasks/{tid}/assign            # 分配任务
POST   /api/v1/tasks/{tid}/unassign          # 取消分配
POST   /api/v1/tasks/{tid}/duplicate         # 复制任务

# 任务子资源
GET    /api/v1/tasks/{tid}/comments
POST   /api/v1/tasks/{tid}/comments
DELETE /api/v1/tasks/{tid}/comments/{cid}

GET    /api/v1/tasks/{tid}/attachments
POST   /api/v1/tasks/{tid}/attachments       # 上传附件 (multipart)
DELETE /api/v1/tasks/{tid}/attachments/{aid}

GET    /api/v1/tasks/{tid}/history           # 操作历史
```

#### 4.2.6 搜索 API

```
GET /api/v1/search?q=keyword&type=task&workspaceId=ws1
GET /api/v1/search?q=keyword&assignee=usr123&status=open&priority=high
```

#### 4.2.7 WebSocket 实时 API

```
// 连接
wss://api.cloudboard.com/ws?token=<jwt>

// 订阅频道
{ "type": "subscribe", "channel": "task:tid_123" }
{ "type": "subscribe", "channel": "board:bid_456" }

// 接收事件
{
  "type": "event",
  "channel": "task:tid_123",
  "event": "task.moved",
  "payload": {
    "taskId": "tid_123",
    "fromColumn": "col_in_progress",
    "toColumn": "col_done",
    "position": 3,
    "userId": "usr_789",
    "timestamp": "2026-04-29T21:00:00Z"
  }
}

// 事件类型
task.created
task.updated
task.moved
task.deleted
task.assigned
task.unassigned
comment.added
comment.deleted
attachment.added
```

### 4.3 完整请求/响应示例

#### 4.3.1 创建任务

```http
POST /api/v1/boards/bid_456/tasks
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Content-Type: application/json
X-Request-ID: req_abc123

{
  "title": "实现用户认证模块",
  "description": "支持 JWT 认证、刷新 Token、OAuth2 第三方登录",
  "columnId": "col_in_progress",
  "position": 0,
  "priority": "high",
  "assigneeIds": ["usr_123", "usr_456"],
  "tagIds": ["tag_backend", "tag_auth"],
  "dueDate": "2026-05-15T00:00:00Z",
  "estimateHours": 16
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/v1/tasks/tid_789

{
  "data": {
    "id": "tid_789",
    "title": "实现用户认证模块",
    "description": "支持 JWT 认证、刷新 Token、OAuth2 第三方登录",
    "columnId": "col_in_progress",
    "position": 0,
    "priority": "high",
    "status": "active",
    "assignees": [
      { "id": "usr_123", "name": "张三", "avatar": "https://..." },
      { "id": "usr_456", "name": "李四", "avatar": "https://..." }
    ],
    "tags": [
      { "id": "tag_backend", "name": "后端" },
      { "id": "tag_auth", "name": "认证" }
    ],
    "dueDate": "2026-05-15T00:00:00Z",
    "estimateHours": 16,
    "actualHours": 0,
    "commentCount": 0,
    "attachmentCount": 0,
    "createdAt": "2026-04-29T21:00:00Z",
    "updatedAt": "2026-04-29T21:00:00Z",
    "createdBy": { "id": "usr_123", "name": "张三" }
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-04-29T21:00:01Z"
  }
}
```

#### 4.3.2 移动任务

```http
POST /api/v1/tasks/tid_789/move
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Content-Type: application/json

{
  "targetColumnId": "col_done",
  "targetPosition": 2
}
```

```http
HTTP/1.1 200 OK

{
  "data": {
    "id": "tid_789",
    "title": "实现用户认证模块",
    "columnId": "col_done",
    "position": 2,
    "status": "completed",
    "updatedAt": "2026-04-29T21:05:00Z"
  },
  "meta": {
    "requestId": "req_def456",
    "timestamp": "2026-04-29T21:05:01Z"
  }
}
```

#### 4.3.3 错误响应

```http
HTTP/1.1 422 Unprocessable Entity

{
  "error": {
    "code": "TASK_MOVE_CONFLICT",
    "message": "任务已被其他用户移动，请刷新后重试",
    "details": [
      {
        "field": "position",
        "message": "目标位置已被其他操作占用"
      }
    ],
    "requestId": "req_ghi789",
    "timestamp": "2026-04-29T21:05:02Z"
  }
}
```

#### 4.3.4 列表响应 (分页)

```http
GET /api/v1/boards/bid_456/tasks?status=active&sort=-priority,position&limit=20&cursor=eyJpZCI6MTIzfQ==
```

```http
HTTP/1.1 200 OK

{
  "data": [
    {
      "id": "tid_789",
      "title": "实现用户认证模块",
      "priority": "high",
      "status": "active",
      "assignees": [{ "id": "usr_123", "name": "张三" }],
      "dueDate": "2026-05-15T00:00:00Z",
      "columnId": "col_in_progress",
      "position": 0,
      "commentCount": 3,
      "updatedAt": "2026-04-29T21:00:00Z"
    },
    {
      "id": "tid_790",
      "title": "设计数据库 schema",
      "priority": "medium",
      "status": "active",
      "assignees": [{ "id": "usr_456", "name": "李四" }],
      "dueDate": "2026-05-10T00:00:00Z",
      "columnId": "col_in_progress",
      "position": 1,
      "commentCount": 1,
      "updatedAt": "2026-04-29T20:30:00Z"
    }
  ],
  "meta": {
    "requestId": "req_jkl012",
    "timestamp": "2026-04-29T21:10:00Z",
    "pagination": {
      "limit": 20,
      "nextCursor": "eyJpZCI6MTQzfQ==",
      "prevCursor": null,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### 4.4 GraphQL Schema (CloudBoard)

```graphql
# === 核心类型 ===

type Workspace {
  id: ID!
  name: String!
  slug: String!
  description: String
  logo: String
  members: [WorkspaceMember!]!
  projects(first: Int, after: String): ProjectConnection!
  role: WorkspaceRole!          # 当前用户角色
  createdAt: DateTime!
}

enum WorkspaceRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

type Project {
  id: ID!
  name: String!
  description: String
  status: ProjectStatus!
  workspace: Workspace!
  boards(first: Int, after: String): BoardConnection!
  members: [ProjectMember!]!
  archivedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum ProjectStatus {
  ACTIVE
  ARCHIVED
}

type Board {
  id: ID!
  name: String!
  description: String
  project: Project!
  columns: [Column!]!
  tasks(first: Int, after: String, filter: TaskFilterInput): TaskConnection!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Column {
  id: ID!
  name: String!
  position: Int!
  color: String
  wipLimit: Int
  tasks: [Task!]!
  taskCount: Int!
}

type Task {
  id: ID!
  title: String!
  description: String
  status: TaskStatus!
  priority: TaskPriority!
  position: Int!
  column: Column!
  board: Board!
  assignees: [User!]!
  tags: [Tag!]!
  comments(first: Int, after: String): CommentConnection!
  attachments: [Attachment!]!
  history: [TaskHistory!]!
  dueDate: DateTime
  estimateHours: Float
  actualHours: Float
  createdBy: User!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum TaskStatus {
  BACKLOG
  TODO
  IN_PROGRESS
  IN_REVIEW
  DONE
  CANCELLED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

type Comment {
  id: ID!
  content: String!
  author: User!
  task: Task!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Attachment {
  id: ID!
  filename: String!
  fileSize: Int!
  mimeType: String!
  url: String!
  uploadedBy: User!
  createdAt: DateTime!
}

type TaskHistory {
  id: ID!
  action: String!
  changes: JSON
  user: User!
  createdAt: DateTime!
}

type User {
  id: ID!
  name: String!
  email: String!
  avatar: String
  role: UserRole!
  workspaces: [Workspace!]!
  tasks: [Task!]!
  createdAt: DateTime!
}

type Tag {
  id: ID!
  name: String!
  color: String!
  taskCount: Int!
}

# === 分页 ===

input CursorPagination {
  first: Int = 20
  after: String
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
  totalCount: Int!
}

type TaskConnection {
  edges: [TaskEdge!]!
  pageInfo: PageInfo!
}

type TaskEdge {
  node: Task!
  cursor: String!
}

type CommentConnection {
  edges: [CommentEdge!]!
  pageInfo: PageInfo!
}

type CommentEdge {
  node: Comment!
  cursor: String!
}

# === 过滤 ===

input TaskFilterInput {
  status: TaskStatus
  priority: TaskPriority
  assigneeId: ID
  tagId: ID
  search: String
  dueDateRange: DateRangeInput
  columnId: ID
}

input DateRangeInput {
  start: DateTime!
  end: DateTime!
}

# === 输入类型 ===

input CreateTaskInput {
  boardId: ID!
  columnId: ID!
  title: String!
  description: String
  priority: TaskPriority
  assigneeIds: [ID!]
  tagIds: [ID!]
  dueDate: DateTime
  estimateHours: Float
}

input UpdateTaskInput {
  title: String
  description: String
  priority: TaskPriority
  dueDate: DateTime
  estimateHours: Float
  assigneeIds: [ID!]
  tagIds: [ID!]
}

input MoveTaskInput {
  targetColumnId: ID!
  targetPosition: Int!
  expectedVersion: Int  # 乐观锁版本号
}

input CreateCommentInput {
  taskId: ID!
  content: String!
}

# === Query ===

type Query {
  me: User

  # 工作区
  workspaces: [Workspace!]!
  workspace(id: ID!): Workspace

  # 项目
  projects(workspaceId: ID!): [Project!]!
  project(id: ID!): Project

  # 看板
  board(id: ID!): Board

  # 任务
  task(id: ID!): Task
  myTasks(filter: TaskFilterInput, pagination: CursorPagination): TaskConnection!
  searchTasks(query: String!, workspaceId: ID!): [Task!]!
}

# === Mutation ===

type Mutation {
  # 认证
  login(email: String!, password: String!): AuthPayload!
  register(input: RegisterInput!): AuthPayload!
  refreshToken(refreshToken: String!): AuthPayload!

  # 工作区
  createWorkspace(input: CreateWorkspaceInput!): Workspace!
  updateWorkspace(id: ID!, input: UpdateWorkspaceInput!): Workspace!
  inviteMember(workspaceId: ID!, email: String!, role: WorkspaceRole!): Invitation!
  acceptInvitation(token: String!): Boolean!

  # 项目
  createProject(input: CreateProjectInput!): Project!
  updateProject(id: ID!, input: UpdateProjectInput!): Project!
  archiveProject(id: ID!): Project!

  # 看板
  createBoard(input: CreateBoardInput!): Board!
  updateBoard(id: ID!, input: UpdateBoardInput!): Board!

  # 列
  createColumn(boardId: ID!, name: String!, position: Int!): Column!
  updateColumn(id: ID!, input: UpdateColumnInput!): Column!
  deleteColumn(id: ID!, moveToColumnId: ID): Boolean!

  # 任务
  createTask(input: CreateTaskInput!): Task!
  updateTask(id: ID!, input: UpdateTaskInput!): Task!
  moveTask(id: ID!, input: MoveTaskInput!): Task!
  deleteTask(id: ID!): Boolean!
  duplicateTask(id: ID!): Task!

  # 评论
  addComment(input: CreateCommentInput!): Comment!
  deleteComment(id: ID!): Boolean!

  # 附件
  createUploadUrl(taskId: ID!, filename: String!, mimeType: String!): UploadUrl!
  deleteAttachment(id: ID!): Boolean!
}

type AuthPayload {
  accessToken: String!
  refreshToken: String!
  user: User!
}

type UploadUrl {
  url: String!
  fields: JSON
  attachmentId: ID!
}

# === Subscription ===

type Subscription {
  taskCreated(boardId: ID!): Task!
  taskUpdated(taskId: ID!): Task!
  taskMoved(taskId: ID!): TaskMovedPayload!
  taskDeleted(taskId: ID!): ID!
  commentAdded(taskId: ID!): Comment!
  taskAssigned(taskId: ID!): TaskAssignedPayload!
}

type TaskMovedPayload {
  taskId: ID!
  fromColumn: Column!
  toColumn: Column!
  position: Int!
  userId: ID!
}

type TaskAssignedPayload {
  taskId: ID!
  assignee: User!
  userId: ID!
}
```

### 4.5 GraphQL 查询示例

```graphql
# 获取看板详情 (含所有列和任务)
query GetBoard($boardId: ID!) {
  board(id: $boardId) {
    id
    name
    columns {
      id
      name
      position
      color
      wipLimit
      taskCount
    }
    tasks(first: 50) {
      edges {
        node {
          id
          title
          priority
          status
          position
          dueDate
          estimateHours
          assignees {
            id
            name
            avatar
          }
          tags {
            id
            name
            color
          }
          commentCount
          column {
            id
            name
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
        totalCount
      }
    }
  }
}

# 获取任务详情 (含评论、历史)
query GetTask($taskId: ID!) {
  task(id: $taskId) {
    id
    title
    description
    status
    priority
    dueDate
    estimateHours
    actualHours
    assignees {
      id
      name
      avatar
    }
    tags {
      id
      name
      color
    }
    column {
      id
      name
      board {
        id
        name
        project {
          id
          name
          workspace {
            id
            name
          }
        }
      }
    }
    createdBy {
      id
      name
      avatar
    }
    comments(first: 20) {
      edges {
        node {
          id
          content
          author {
            id
            name
            avatar
          }
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
    history {
      id
      action
      changes
      user {
        id
        name
      }
      createdAt
    }
    attachments {
      id
      filename
      fileSize
      mimeType
      url
      uploadedBy {
        id
        name
      }
      createdAt
    }
  }
}

# 创建任务
mutation CreateTask($input: CreateTaskInput!) {
  createTask(input: $input) {
    id
    title
    status
    column {
      id
      name
    }
    assignees {
      id
      name
    }
    createdAt
  }
}

# 移动任务 (含乐观锁)
mutation MoveTask($id: ID!, $input: MoveTaskInput!) {
  moveTask(id: $id, input: $input) {
    id
    column {
      id
      name
    }
    position
    updatedAt
  }
}

# 订阅任务更新
subscription OnTaskUpdate($taskId: ID!) {
  taskUpdated(taskId: $taskId) {
    id
    title
    status
    priority
    updatedAt
  }
}

# 订阅任务移动
subscription OnTaskMove($taskId: ID!) {
  taskMoved(taskId: $taskId) {
    taskId
    fromColumn {
      id
      name
    }
    toColumn {
      id
      name
    }
    position
    userId
  }
}
```

---

## 五、API 文档规范

### 5.1 OpenAPI 3.0 规范 (部分示例)

```yaml
openapi: 3.0.3
info:
  title: CloudBoard API
  description: 企业级项目管理平台 API
  version: 1.0.0
  contact:
    name: CloudBoard API Team
    email: api@cloudboard.com

servers:
  - url: https://api.cloudboard.com/api/v1
    description: Production
  - url: https://api-staging.cloudboard.com/api/v1
    description: Staging

tags:
  - name: Auth
    description: 认证相关
  - name: Workspaces
    description: 工作区管理
  - name: Projects
    description: 项目管理
  - name: Boards
    description: 看板管理
  - name: Tasks
    description: 任务管理
  - name: Comments
    description: 评论管理

paths:
  /tasks/{taskId}:
    get:
      tags: [Tasks]
      summary: 获取任务详情
      operationId: getTask
      parameters:
        - name: taskId
          in: path
          required: true
          schema:
            type: string
            example: tid_789
        - name: fields
          in: query
          description: 字段选择 (逗号分隔)
          required: false
          schema:
            type: string
            example: id,title,status,assignees
      responses:
        '200':
          description: 任务详情
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaskResponse'
        '404':
          description: 任务不存在
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
      security:
        - BearerAuth: []

  /boards/{boardId}/tasks:
    get:
      tags: [Tasks]
      summary: 获取看板任务列表
      operationId: listBoardTasks
      parameters:
        - name: boardId
          in: path
          required: true
          schema:
            type: string
        - name: status
          in: query
          schema:
            $ref: '#/components/schemas/TaskStatus'
        - name: priority
          in: query
          schema:
            $ref: '#/components/schemas/TaskPriority'
        - name: assigneeId
          in: query
          schema:
            type: string
        - name: sort
          in: query
          description: 排序字段 (前缀 - 表示降序)
          schema:
            type: string
            example: "-priority,position"
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: cursor
          in: query
          description: 分页游标
          schema:
            type: string
      responses:
        '200':
          description: 任务列表
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaskListResponse'

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    TaskStatus:
      type: string
      enum: [BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED]

    TaskPriority:
      type: string
      enum: [LOW, MEDIUM, HIGH, URGENT]

    TaskResponse:
      type: object
      properties:
        data:
          $ref: '#/components/schemas/Task'
        meta:
          $ref: '#/components/schemas/Meta'

    TaskListResponse:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: '#/components/schemas/TaskSummary'
        meta:
          type: object
          properties:
            pagination:
              $ref: '#/components/schemas/PaginationMeta'

    Task:
      type: object
      required: [id, title, status, priority, columnId, position]
      properties:
        id:
          type: string
          example: tid_789
        title:
          type: string
          maxLength: 200
        description:
          type: string
        status:
          $ref: '#/components/schemas/TaskStatus'
        priority:
          $ref: '#/components/schemas/TaskPriority'
        columnId:
          type: string
        position:
          type: integer
        assignees:
          type: array
          items:
            $ref: '#/components/schemas/UserSummary'
        tags:
          type: array
          items:
            $ref: '#/components/schemas/Tag'
        dueDate:
          type: string
          format: date-time
        estimateHours:
          type: number
          minimum: 0
        actualHours:
          type: number
          minimum: 0
        commentCount:
          type: integer
        attachmentCount:
          type: integer
        createdBy:
          $ref: '#/components/schemas/UserSummary'
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    TaskSummary:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        priority:
          $ref: '#/components/schemas/TaskPriority'
        status:
          $ref: '#/components/schemas/TaskStatus'
        assignees:
          type: array
          items:
            $ref: '#/components/schemas/UserSummary'
        dueDate:
          type: string
          format: date-time
        columnId:
          type: string
        position:
          type: integer
        commentCount:
          type: integer
        updatedAt:
          type: string
          format: date-time

    PaginationMeta:
      type: object
      properties:
        limit:
          type: integer
        nextCursor:
          type: string
          nullable: true
        prevCursor:
          type: string
          nullable: true
        hasNext:
          type: boolean
        hasPrev:
          type: boolean

    ErrorResponse:
      type: object
      properties:
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string
            details:
              type: array
              items:
                type: object
                properties:
                  field:
                    type: string
                  message:
                    type: string
            requestId:
              type: string
            timestamp:
              type: string
              format: date-time
```

### 5.2 API 文档 Checklist

```
✅ 每个端点包含：
  - 操作描述 (summary)
  - 请求参数 (path/query/header)
  - 请求体 schema
  - 成功响应 schema (所有 2xx)
  - 错误响应 schema (所有 4xx/5xx)
  - 认证要求
  - 示例请求/响应

✅ 全局文档：
  - 认证方式说明
  - 速率限制说明
  - 分页策略说明
  - 错误码列表
  - 版本变更记录
  - SDK 使用指南

✅ 交互文档：
  - Swagger UI / Redoc 在线预览
  - 可执行的 Try-it-out
  - Postman Collection 导出
```

---

## 六、API 安全设计

### 6.1 认证 & 鉴权

```
认证 (Authentication) — 你是谁？
  - JWT Access Token (15min)
  - Refresh Token (7d, rotation)
  - OAuth2 (GitHub/Google 第三方登录)

鉴权 (Authorization) — 你能做什么？
  - RBAC: 角色 = OWNER/ADMIN/MEMBER/VIEWER
  - 资源级权限: 工作区 → 项目 → 看板 → 任务
  - 操作级权限: 创建/读取/更新/删除/管理

权限矩阵:
  操作          | OWNER | ADMIN | MEMBER | VIEWER
  ------------|-------|-------|--------|--------
  查看工作区    | ✅    | ✅    | ✅     | ✅
  创建工作区    | ✅    | ❌    | ❌     | ❌
  邀请成员      | ✅    | ✅    | ❌     | ❌
  删除工作区    | ✅    | ❌    | ❌     | ❌
  创建任务      | ✅    | ✅    | ✅     | ❌
  编辑他人任务  | ✅    | ✅    | ❌     | ❌
  删除任务      | ✅    | ✅    | 仅自己的 | ❌
```

### 6.2 安全 Header

```
# 响应安全头
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'none'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()

# CORS
Access-Control-Allow-Origin: https://app.cloudboard.com
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, X-Request-ID
Access-Control-Max-Age: 86400
```

### 6.3 速率限制

```
# 全局限制
1000 请求/分钟 (认证用户)
100 请求/分钟 (未认证)

# 端点限制
POST /auth/login:     10 次/分钟/IP
POST /auth/register:  5 次/分钟/IP
POST /tasks:          60 次/分钟/用户
GET /search:          30 次/分钟/用户

# 响应头
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 997
X-RateLimit-Reset: 1714411260

# 超限响应
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

---

## 七、API 测试策略

### 7.1 测试金字塔

```
        /\
       /  \  E2E 测试 (5%)
      /----\
     /      \ Integration 测试 (20%)
    /--------\
   /          \ Unit 测试 (75%)
  /____________\
```

### 7.2 API 测试示例 (Vitest)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../app';
import request from 'supertest';
import { db } from '../db';

describe('Tasks API', () => {
  let authToken: string;
  let boardId: string;

  beforeAll(async () => {
    // 创建测试用户并获取 token
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    authToken = res.body.data.accessToken;

    // 创建测试看板
    const boardRes = await request(app)
      .post('/api/v1/projects/proj_1/boards')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Board' });
    boardId = boardRes.body.data.id;
  });

  afterAll(async () => {
    // 清理测试数据
    await db.task.deleteMany({ where: { boardId } });
  });

  it('POST /boards/:boardId/tasks — 创建任务', async () => {
    const res = await request(app)
      .post(`/api/v1/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: '测试任务',
        columnId: 'col_1',
        priority: 'high',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.title).toBe('测试任务');
    expect(res.body.data.priority).toBe('high');
    expect(res.body.meta).toHaveProperty('requestId');
  });

  it('POST /boards/:boardId/tasks — 缺少必填字段返回 400', async () => {
    const res = await request(app)
      .post(`/api/v1/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: '测试任务' }); // 缺少 columnId

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toContainEqual(
      expect.objectContaining({ field: 'columnId' })
    );
  });

  it('GET /tasks/:taskId — 未认证返回 401', async () => {
    const res = await request(app)
      .get('/api/v1/tasks/tid_123');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /tasks/:taskId — 无权限返回 403', async () => {
    // 用另一个用户的 token
    const otherToken = await getOtherUserToken();
    const res = await request(app)
      .get('/api/v1/tasks/tid_123')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('PATCH /tasks/:taskId — 移动任务 (乐观锁)', async () => {
    // 先获取任务
    const getRes = await request(app)
      .get('/api/v1/tasks/tid_123')
      .set('Authorization', `Bearer ${authToken}`);

    // 第一次移动
    const moveRes = await request(app)
      .post('/api/v1/tasks/tid_123/move')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        targetColumnId: 'col_done',
        targetPosition: 0,
        expectedVersion: getRes.body.data.version,
      });

    expect(moveRes.status).toBe(200);

    // 用旧版本号再次移动 → 冲突
    const conflictRes = await request(app)
      .post('/api/v1/tasks/tid_123/move')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        targetColumnId: 'col_done',
        targetPosition: 1,
        expectedVersion: getRes.body.data.version, // 旧版本号
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error.code).toBe('TASK_MOVE_CONFLICT');
  });

  it('GET /boards/:boardId/tasks — 分页', async () => {
    const res = await request(app)
      .get(`/api/v1/boards/${boardId}/tasks?limit=2`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta.pagination).toHaveProperty('nextCursor');
    expect(res.body.meta.pagination).toHaveProperty('hasNext');
  });
});
```

---

## 八、API 性能优化

### 8.1 常见性能问题 & 解决方案

```
问题 1: N+1 查询
  场景: 获取任务列表 → 每个任务查作者 → N+1 次查询
  解决: DataLoader 批量加载 / SQL JOIN / 预加载

问题 2: 响应体过大
  场景: GET /tasks 返回所有字段 (含 description/attachments)
  解决: fields 参数 / 列表端点返回摘要 / 分页

问题 3: 缺少缓存
  场景: 每次请求都查数据库
  解决: ETag / Redis 缓存 / CDN 缓存静态资源

问题 4: 无索引查询
  场景: WHERE status = 'active' AND priority = 'high' 全表扫描
  解决: 复合索引 (status, priority)

问题 5: 大事务锁表
  场景: 移动任务时锁整张 tasks 表
  解决: 行级锁 / 乐观锁 / 减少事务范围
```

### 8.2 性能指标

```
API 性能目标:
  P50 延迟: < 50ms
  P95 延迟: < 200ms
  P99 延迟: < 500ms
  可用性: 99.9%
  错误率: < 0.1%

监控指标:
  - 请求量 (QPS)
  - 延迟分布 (P50/P95/P99)
  - 错误率 (4xx/5xx)
  - 缓存命中率
  - 数据库连接池使用率
  - WebSocket 连接数
```

---

## 九、面试高频考点

### 9.1 RESTful 相关

**Q1: REST 的六个约束是什么？**
1. 客户端-服务端分离
2. 无状态
3. 可缓存
4. 统一接口
5. 分层系统
6. 按需编码 (可选)

**Q2: PUT 和 PATCH 的区别？**
- PUT: 全量替换，请求体包含完整资源
- PATCH: 部分更新，请求体只包含需要修改的字段
- 两者都应该是幂等的

**Q3: 如何实现幂等性？**
- PUT/DELETE 天然幂等
- POST 可通过幂等键 (Idempotency-Key header) 实现
- 服务端记录已处理的请求，重复请求返回相同结果

**Q4: REST 如何支持实时协作？**
- WebSocket: 双向通信，适合实时场景
- SSE (Server-Sent Events): 单向推送，适合通知
- 长轮询: 兼容性最好但延迟高

### 9.2 GraphQL 相关

**Q5: GraphQL 的 N+1 问题是什么？如何解决？**
- 问题: 嵌套 resolver 导致多次数据库查询
- 解决: DataLoader 批量加载，将多次查询合并为一次

**Q6: GraphQL 如何保证安全性？**
- 查询深度限制 (默认 7 层)
- 查询复杂度分析 (限制单次查询资源消耗)
- 速率限制 (基于复杂度或请求数)
- 持久化查询 (白名单机制)

**Q7: 什么时候选 REST 什么时候选 GraphQL？**
- REST: 公开 API、简单 CRUD、需要 HTTP 缓存、移动端 (带宽敏感)
- GraphQL: 复杂数据关系、多客户端、需要灵活查询、实时数据

### 9.3 综合题

**Q8: 设计一个支持 10万 QPS 的 API 系统**
1. CDN 缓存静态资源和可缓存 API
2. 网关层: 速率限制、认证、负载均衡
3. 应用层: 无状态、水平扩展、连接池
4. 缓存层: Redis 集群、多级缓存
5. 数据库: 读写分离、分库分表、连接池
6. 消息队列: 异步处理、削峰填谷
7. 监控: 全链路追踪、自动扩缩容

**Q9: API 版本化有哪些策略？各有什么优缺点？**
- URL 版本化: 最直观，但 URL 膨胀
- Header 版本化: URL 干净，但调试不便
- 查询参数: 简单，但不够正式
- 推荐: URL 版本化 + 弃用 Header (Deprecation + Sunset)

---

## 十、自测题

### 10.1 RESTful 设计题

**题目**: 设计一个博客平台的 API，包含：文章、评论、标签、分类、用户。

要求:
1. 写出所有端点 (方法 + URL)
2. 设计统一响应格式
3. 实现分页、搜索、过滤
4. 设计认证/鉴权方案
5. 考虑 N+1 问题并给出解决方案

<details>
<summary>参考答案要点</summary>

```
端点:
  GET    /api/v1/posts?category=tech&tag=javascript&sort=-createdAt
  POST   /api/v1/posts
  GET    /api/v1/posts/{id}
  PATCH  /api/v1/posts/{id}
  DELETE /api/v1/posts/{id}
  POST   /api/v1/posts/{id}/publish
  POST   /api/v1/posts/{id}/comments
  DELETE /api/v1/posts/{id}/comments/{cid}
  GET    /api/v1/tags
  GET    /api/v1/categories
  GET    /api/v1/users/{id}/posts

N+1 解决:
  - 文章列表 + 作者: 预加载作者信息 (SQL JOIN)
  - 文章 + 评论数: 聚合查询 / 缓存计数
  - 评论 + 作者: DataLoader 批量加载
```
</details>

### 10.2 GraphQL 设计题

**题目**: 为电商平台设计 GraphQL Schema，包含：商品、分类、购物车、订单。

要求:
1. 设计类型定义
2. 实现分页 (Cursor-based)
3. 实现搜索
4. 设计 Mutation
5. 考虑查询复杂度

<details>
<summary>参考答案要点</summary>

```graphql
type Product {
  id: ID!
  name: String!
  description: String
  price: Decimal!
  images: [String!]!
  category: Category!
  tags: [Tag!]!
  stock: Int!
  rating: Float
  reviewCount: Int!
}

type Query {
  products(first: Int, after: String, filter: ProductFilterInput): ProductConnection!
  product(id: ID!): Product
  searchProducts(query: String!, category: ID): ProductConnection!
}

type Mutation {
  addToCart(productId: ID!, quantity: Int!): CartItem!
  updateCartItem(id: ID!, quantity: Int!): CartItem!
  removeCartItem(id: ID!): Boolean!
  checkout: Order!
}

# 查询复杂度: 每个字段分配 cost
# Product.rating = 1, Product.reviews = 5 (可能 N+1)
# 总复杂度 > 1000 拒绝查询
```
</details>

---

## 十一、总结

### RESTful vs GraphQL 对比总结

| 维度 | RESTful | GraphQL |
|------|---------|---------|
| **数据获取** | 固定结构 | 按需获取 |
| **端点数量** | 多端点 | 单端点 |
| **类型系统** | 需 OpenAPI | 内建 |
| **缓存** | HTTP 原生 | 需客户端实现 |
| **实时** | WebSocket/SSE | Subscription |
| **文件上传** | 原生 | 需扩展 |
| **学习曲线** | 低 | 中 |
| **适用场景** | 公开 API / 简单 CRUD | 复杂关系 / 多客户端 |

### API 设计黄金法则

1. **资源命名用名词复数** — `/users` not `/getUsers`
2. **HTTP 方法表达操作** — GET 查、POST 创、PUT 替、PATCH 改、DELETE 删
3. **状态码语义化** — 200/201/400/401/403/404/409/422/429/500
4. **统一响应格式** — `{ data, meta }` / `{ error }`
5. **分页必做** — Cursor 分页适合大数据，Offset 分页适合小数据
6. **字段选择** — `?fields=id,name,email` 减少传输
7. **版本化** — URL 版本化 `/api/v1/`
8. **幂等性** — GET/PUT/DELETE 天然幂等，POST 用 Idempotency-Key
9. **安全** — JWT + RBAC + 速率限制 + 安全头
10. **文档** — OpenAPI 3.0 + Swagger UI + 示例 + 错误码表

---

*文件生成时间: 2026-04-29 21:00*
*专项编号: 21:00 | 累计专项: 18+*
