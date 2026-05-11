# 专项训练：API 设计（RESTful + GraphQL）

> 日期：2026-04-26 | 主题：RESTful/GraphQL 设计原则 + 完整 API 设计 + 文档

---

## 一、RESTful API 设计原则

### 1.1 核心原则

| 原则 | 说明 | 反例 |
|------|------|------|
| **资源导向** | URL 表示资源而非动作 | `GET /getUser` ❌ → `GET /users/:id` ✅ |
| **HTTP 语义** | 方法对应操作语义 | 全部用 POST ❌ → GET/POST/PUT/DELETE 各司其职 ✅ |
| **无状态** | 每次请求自包含，不依赖服务端会话 | Session 依赖 ❌ → JWT/Token ✅ |
| **分层系统** | 客户端不知道是否直连服务端 | — |
| **统一接口** | 一致的命名、格式、错误处理 | 各接口格式不同 ❌ → 统一规范 ✅ |

### 1.2 URL 设计规范

```
# 资源命名
GET    /api/v1/articles              # 文章列表
GET    /api/v1/articles/:id          # 单篇文章
POST   /api/v1/articles              # 创建文章
PUT    /api/v1/articles/:id          # 全量更新
PATCH  /api/v1/articles/:id          # 部分更新
DELETE /api/v1/articles/:id          # 删除文章

# 嵌套资源
GET    /api/v1/articles/:id/comments    # 文章评论列表
POST   /api/v1/articles/:id/comments    # 添加评论
GET    /api/v1/users/:id/articles       # 用户文章列表

# 查询参数（非资源标识，用 query string）
GET /api/v1/articles?category=tech&page=1&limit=20&sort=-created_at
```

### 1.3 状态码规范

| 状态码 | 场景 |
|--------|------|
| 200 | 成功（GET/PUT/PATCH） |
| 201 | 创建成功（POST） |
| 204 | 删除成功，无响应体 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 冲突（如重复创建） |
| 422 | 验证失败（字段级错误） |
| 429 | 限流 |
| 500 | 服务器内部错误 |

### 1.4 统一响应格式

```json
// 成功响应
{
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 156
  }
}

// 错误响应
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [
      { "field": "email", "message": "邮箱格式不正确" }
    ]
  }
}
```

### 1.5 分页设计

```
# Offset-based（适合小数据集）
GET /api/v1/articles?page=2&limit=20

# Cursor-based（适合大数据集、实时数据）
GET /api/v1/articles?cursor=eyJpZCI6MTAwfQ&limit=20

# 响应中携带分页信息
{
  "meta": {
    "page": 2,
    "limit": 20,
    "total": 156,
    "hasNext": true,
    "nextCursor": "eyJpZCI6MTIwfQ"
  }
}
```

---

## 二、GraphQL 设计原则

### 2.1 何时选择 GraphQL

| 场景 | 推荐 |
|------|------|
| 前端需要灵活组合数据 | GraphQL ✅ |
| 移动端带宽敏感 | GraphQL ✅ |
| 简单 CRUD 后端 | REST ✅ |
| 强类型契约 + 自动生成文档 | GraphQL ✅ |
| 缓存需求强（CDN 层） | REST ✅ |
| 批量操作、复杂查询 | GraphQL ✅ |

### 2.2 Schema 设计原则

```graphql
# 类型命名：名词，首字母大写
type User {
  id: ID!
  username: String!
  email: String!
  articles: [Article!]!
  createdAt: DateTime!
}

# Query：读取操作
type Query {
  user(id: ID!): User
  users(filter: UserFilter, pagination: PaginationInput): UserConnection!
  article(id: ID!): Article
}

# Mutation：写操作
type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateArticle(id: ID!, input: UpdateArticleInput!): UpdateArticlePayload!
  deleteArticle(id: ID!): DeletePayload!
}

# 连接模式（Relay 风格分页）
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

# Input 类型（Mutation 参数）
input CreateUserInput {
  username: String!
  email: String!
  password: String!
}

# Payload 类型（统一返回格式）
type CreateUserPayload {
  user: User
  errors: [Error!]
}

type Error {
  field: String
  message: String!
}

# 自定义标量
scalar DateTime
```

### 2.3 GraphQL 最佳实践

1. **始终使用连接模式分页** — 避免 offset 在大数据集下的性能问题
2. **Input/Payload 分离** — Mutation 参数和返回值都用独立类型
3. **避免 N+1 查询** — 使用 DataLoader 批量加载
4. **字段级权限** — 在 resolver 层控制，而非 schema 层
5. **深度限制** — 防止恶意嵌套查询
6. **查询复杂度分析** — 限制单次查询的计算成本

---

## 三、实战：设计一套「技术博客平台」完整 API

### 3.1 业务域分析

```
用户（User）
  ├── 文章（Article）
  │     ├── 评论（Comment）
  │     └── 标签（Tag）
  ├── 收藏（Bookmark）
  └── 关注（Follow）

核心关系：
- User 1:N Article
- Article 1:N Comment
- Article N:M Tag
- User N:M User（关注）
- User N:M Article（收藏）
```

### 3.2 RESTful API 完整设计

#### 认证模块

```
POST   /api/v1/auth/register          # 注册
POST   /api/v1/auth/login             # 登录
POST   /api/v1/auth/refresh           # 刷新 Token
POST   /api/v1/auth/logout            # 登出
POST   /api/v1/auth/forgot-password   # 忘记密码
POST   /api/v1/auth/reset-password    # 重置密码
```

#### 用户模块

```
GET    /api/v1/users/me               # 当前用户信息
PUT    /api/v1/users/me               # 更新个人信息
GET    /api/v1/users/:id              # 查看用户资料
GET    /api/v1/users                  # 用户列表（搜索）
POST   /api/v1/users/:id/avatar       # 上传头像
```

#### 文章模块

```
GET    /api/v1/articles               # 文章列表
GET    /api/v1/articles/:id           # 文章详情
POST   /api/v1/articles               # 创建文章
PUT    /api/v1/articles/:id           # 更新文章
DELETE /api/v1/articles/:id           # 删除文章
PATCH  /api/v1/articles/:id/status    # 修改状态（发布/草稿/隐藏）
GET    /api/v1/articles/:id/versions  # 版本历史
```

#### 评论模块

```
GET    /api/v1/articles/:id/comments           # 文章评论列表
POST   /api/v1/articles/:id/comments           # 发表评论
GET    /api/v1/comments/:id                    # 单条评论
PUT    /api/v1/comments/:id                    # 编辑评论
DELETE /api/v1/comments/:id                    # 删除评论
POST   /api/v1/comments/:id/replies            # 回复评论
POST   /api/v1/comments/:id/like               # 点赞/取消点赞
```

#### 标签模块

```
GET    /api/v1/tags                   # 标签列表
GET    /api/v1/tags/:id               # 标签详情
POST   /api/v1/tags                   # 创建标签（管理员）
GET    /api/v1/tags/:id/articles      # 标签下的文章
```

#### 互动模块

```
POST   /api/v1/users/:id/follow       # 关注/取关
GET    /api/v1/users/:id/followers    # 粉丝列表
GET    /api/v1/users/:id/following    # 关注列表
POST   /api/v1/articles/:id/bookmark  # 收藏/取消收藏
GET    /api/v1/bookmarks              # 我的收藏列表
POST   /api/v1/articles/:id/read      # 标记已读
```

#### 搜索模块

```
GET    /api/v1/search                 # 全局搜索
GET    /api/v1/search/suggestions     # 搜索建议
```

### 3.3 GraphQL Schema 完整设计

```graphql
schema {
  query: Query
  mutation: Mutation
}

# ==================== 标量 ====================
scalar DateTime
scalar JSON

# ==================== Query ====================
type Query {
  # 用户
  me: User
  user(id: ID!): User
  users(filter: UserFilter, pagination: CursorPagination): UserConnection!

  # 文章
  article(id: ID!): Article
  articles(filter: ArticleFilter, pagination: CursorPagination): ArticleConnection!
  myArticles(filter: ArticleFilter, pagination: CursorPagination): ArticleConnection!

  # 评论
  comments(articleId: ID!, pagination: CursorPagination): CommentConnection!

  # 标签
  tags(filter: TagFilter): TagConnection!
  tag(id: ID!): Tag

  # 搜索
  search(query: String!, type: SearchType, pagination: CursorPagination): SearchResultConnection!

  # 统计
  stats: Stats
}

# ==================== Mutation ====================
type Mutation {
  # 认证
  register(input: RegisterInput!): AuthPayload!
  login(input: LoginInput!): AuthPayload!
  refreshToken(input: RefreshTokenInput!): AuthPayload!
  logout: LogoutPayload!
  forgotPassword(input: ForgotPasswordInput!): ActionPayload!
  resetPassword(input: ResetPasswordInput!): ActionPayload!

  # 用户
  updateProfile(input: UpdateProfileInput!): UserPayload!
  uploadAvatar(input: UploadAvatarInput!): UserPayload!

  # 文章
  createArticle(input: CreateArticleInput!): ArticlePayload!
  updateArticle(id: ID!, input: UpdateArticleInput!): ArticlePayload!
  deleteArticle(id: ID!): ActionPayload!
  updateArticleStatus(id: ID!, status: ArticleStatus!): ArticlePayload!

  # 评论
  createComment(input: CreateCommentInput!): CommentPayload!
  updateComment(id: ID!, input: UpdateCommentInput!): CommentPayload!
  deleteComment(id: ID!): ActionPayload!
  likeComment(id: ID!): ActionPayload!

  # 标签
  createTag(input: CreateTagInput!): TagPayload!

  # 互动
  toggleFollow(userId: ID!): ActionPayload!
  toggleBookmark(articleId: ID!): ActionPayload!
}

# ==================== 类型定义 ====================

type User {
  id: ID!
  username: String!
  displayName: String
  email: String!
  avatar: String
  bio: String
  role: UserRole!
  followersCount: Int!
  followingCount: Int!
  articlesCount: Int!
  isFollowing: Boolean
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Article {
  id: ID!
  title: String!
  slug: String!
  content: String!          # Markdown 原文
  contentHtml: String       # 渲染后的 HTML
  summary: String
  coverImage: String
  author: User!
  tags: [Tag!]!
  status: ArticleStatus!
  viewCount: Int!
  likeCount: Int!
  commentCount: Int!
  isBookmarked: Boolean
  createdAt: DateTime!
  updatedAt: DateTime!
  publishedAt: DateTime
}

type Comment {
  id: ID!
  content: String!
  author: User!
  article: Article!
  parent: Comment
  replies: [Comment!]!
  likeCount: Int!
  isLiked: Boolean
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Tag {
  id: ID!
  name: String!
  slug: String!
  description: String
  articlesCount: Int!
  createdAt: DateTime!
}

# ==================== 连接模式（分页）====================

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type ArticleConnection {
  edges: [ArticleEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ArticleEdge {
  node: Article!
  cursor: String!
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

type TagConnection {
  edges: [TagEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type TagEdge {
  node: Tag!
  cursor: String!
}

type SearchResultConnection {
  edges: [SearchResultEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type SearchResultEdge {
  node: SearchResult!
  cursor: String!
  highlight: String  # 高亮片段
}

union SearchResult = Article | User | Tag

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# ==================== 枚举 ====================

enum UserRole {
  USER
  MODERATOR
  ADMIN
}

enum ArticleStatus {
  DRAFT
  PUBLISHED
  HIDDEN
}

enum SearchType {
  ALL
  ARTICLE
  USER
  TAG
}

# ==================== Input 类型 ====================

input RegisterInput {
  username: String!
  email: String!
  password: String!
  displayName: String
}

input LoginInput {
  email: String!
  password: String!
}

input RefreshTokenInput {
  refreshToken: String!
}

input ForgotPasswordInput {
  email: String!
}

input ResetPasswordInput {
  token: String!
  newPassword: String!
}

input UpdateProfileInput {
  displayName: String
  bio: String
}

input UploadAvatarInput {
  file: String!  # Base64 或 presigned URL
}

input CreateArticleInput {
  title: String!
  content: String!
  summary: String
  coverImage: String
  tagIds: [ID!]
  status: ArticleStatus
}

input UpdateArticleInput {
  title: String
  content: String
  summary: String
  coverImage: String
  tagIds: [ID!]
  status: ArticleStatus
}

input CreateCommentInput {
  articleId: ID!
  content: String!
  parentId: ID  # 回复评论时指定
}

input UpdateCommentInput {
  content: String!
}

input CreateTagInput {
  name: String!
  description: String
}

input UserFilter {
  search: String
  role: UserRole
}

input ArticleFilter {
  search: String
  authorId: ID
  tagId: ID
  status: ArticleStatus
  dateFrom: DateTime
  dateTo: DateTime
}

input TagFilter {
  search: String
}

input CursorPagination {
  first: Int
  after: String
  last: Int
  before: String
}

# ==================== Payload 类型 ====================

type AuthPayload {
  accessToken: String
  refreshToken: String
  user: User
  errors: [Error!]
}

type UserPayload {
  user: User
  errors: [Error!]
}

type ArticlePayload {
  article: Article
  errors: [Error!]
}

type CommentPayload {
  comment: Comment
  errors: [Error!]
}

type TagPayload {
  tag: Tag
  errors: [Error!]
}

type ActionPayload {
  success: Boolean!
  errors: [Error!]
}

type LogoutPayload {
  success: Boolean!
}

type Stats {
  totalUsers: Int!
  totalArticles: Int!
  totalComments: Int!
  articlesToday: Int!
}

type Error {
  field: String
  message: String!
  code: String
}
```

### 3.4 关键 API 请求/响应示例

#### 创建文章

```http
POST /api/v1/articles
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "深入理解 GraphQL 的 DataLoader 模式",
  "content": "# DataLoader 原理\n\n...",
  "summary": "一文搞懂 GraphQL N+1 问题的解决方案",
  "tagIds": ["tag_001", "tag_002"],
  "status": "DRAFT"
}

# 201 Created
{
  "data": {
    "id": "art_001",
    "title": "深入理解 GraphQL 的 DataLoader 模式",
    "slug": "deep-dive-graphql-dataloader",
    "status": "DRAFT",
    "author": { "id": "user_001", "username": "alice" },
    "tags": [
      { "id": "tag_001", "name": "GraphQL" },
      { "id": "tag_002", "name": "性能优化" }
    ],
    "createdAt": "2026-04-26T21:00:00Z"
  }
}
```

#### 文章列表（带分页和过滤）

```http
GET /api/v1/articles?status=PUBLISHED&tagId=tag_001&page=1&limit=10&sort=-viewCount

# 200 OK
{
  "data": [
    {
      "id": "art_001",
      "title": "深入理解 GraphQL 的 DataLoader 模式",
      "summary": "一文搞懂 GraphQL N+1 问题的解决方案",
      "author": { "id": "user_001", "username": "alice", "avatar": "..." },
      "tags": [{ "id": "tag_001", "name": "GraphQL" }],
      "viewCount": 1234,
      "commentCount": 23,
      "publishedAt": "2026-04-25T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 56,
    "hasNext": true
  }
}
```

#### GraphQL 查询示例

```graphql
# 查询文章详情（包含作者、标签、评论）
query GetArticle($id: ID!) {
  article(id: $id) {
    id
    title
    contentHtml
    author {
      id
      username
      avatar
      followersCount
      isFollowing
    }
    tags {
      id
      name
      slug
    }
    comments(first: 10, after: $cursor) {
      edges {
        node {
          id
          content
          author { username avatar }
          likeCount
          isLiked
          createdAt
        }
        cursor
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
    viewCount
    likeCount
    isBookmarked
    publishedAt
  }
}
```

```graphql
# 创建文章（Mutation）
mutation CreateArticle($input: CreateArticleInput!) {
  createArticle(input: $input) {
    article {
      id
      title
      slug
      status
      createdAt
    }
    errors {
      field
      message
      code
    }
  }
}
```

```graphql
# 搜索（Union 类型）
query Search($query: String!, $type: SearchType) {
  search(query: $query, type: $type, first: 20) {
    edges {
      node {
        ... on Article {
          id
          title
          summary
          author { username }
        }
        ... on User {
          id
          username
          displayName
        }
        ... on Tag {
          id
          name
          articlesCount
        }
      }
      highlight
    }
    pageInfo { hasNextPage }
    totalCount
  }
}
```

### 3.5 错误处理规范

```json
// 400 Bad Request — 参数错误
{
  "error": {
    "code": "INVALID_PARAMS",
    "message": "请求参数验证失败",
    "details": [
      { "field": "title", "message": "标题长度必须在 1-100 之间", "code": "MIN_LENGTH" },
      { "field": "content", "message": "内容不能为空", "code": "REQUIRED" }
    ]
  }
}

// 401 Unauthorized
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token 已过期，请重新登录"
  }
}

// 403 Forbidden
{
  "error": {
    "code": "FORBIDDEN",
    "message": "您没有权限删除他人的文章"
  }
}

// 404 Not Found
{
  "error": {
    "code": "NOT_FOUND",
    "message": "文章不存在或已被删除"
  }
}

// 409 Conflict
{
  "error": {
    "code": "DUPLICATE_USERNAME",
    "message": "用户名已被占用"
  }
}

// 429 Too Many Requests
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "请求过于频繁，请稍后重试",
    "retryAfter": 30
  }
}
```

### 3.6 安全设计

```
认证：
  ├── JWT Access Token（15 分钟有效期）
  ├── JWT Refresh Token（7 天有效期，存 Redis）
  └── 支持多设备登录

授权：
  ├── RBAC（用户/管理员/超级管理员）
  ├── 资源级权限（只能编辑自己的文章）
  └── 字段级权限（GraphQL 中敏感字段按需暴露）

防护：
  ├── CORS 白名单
  ├── Rate Limiting（API 级别 + 用户级别）
  ├── SQL 注入防护（参数化查询）
  ├── XSS 防护（内容渲染时转义）
  ├── CSRF（Cookie 模式下的防护）
  └── 请求体大小限制（文件上传单独限制）

审计：
  ├── 关键操作日志（创建/删除/权限变更）
  ├── IP 记录
  └── 异常登录告警
```

### 3.7 性能优化策略

```
REST:
  ├── 列表接口默认返回精简字段
  ├── fields 参数控制返回字段：?fields=id,title,author
  ├── ETag / Last-Modified 缓存协商
  ├── Redis 缓存热点数据（文章列表、标签）
  └── CDN 缓存静态资源

GraphQL:
  ├── DataLoader 解决 N+1
  ├── 查询复杂度限制（max depth: 10, max cost: 1000）
  ├── 持久化查询（Persisted Queries）
  ├── 响应缓存（Apollo Server Cache）
  └── 查询白名单（生产环境）

通用:
  ├── 数据库索引（slug、author_id、status、tag_id）
  ├── 读写分离
  ├── 全文搜索（Elasticsearch）
  └── 异步处理（邮件、通知、统计）
```

---

## 四、REST vs GraphQL 对比总结

| 维度 | REST | GraphQL |
|------|------|---------|
| 数据获取 | 固定端点，可能 over/under-fetch | 按需获取，精确数据 |
| 请求数量 | 可能需要多次请求 | 单次请求获取关联数据 |
| 缓存 | HTTP 缓存天然支持 | 需要客户端缓存策略 |
| 版本管理 | URL 版本化（/v1/） | Schema 演进（向后兼容） |
| 学习曲线 | 低 | 中（Schema、Resolver、DataLoader） |
| 工具链 | Postman、Swagger | GraphiQL、Apollo、GraphQL Codegen |
| 适用场景 | 简单 CRUD、公开 API | 复杂前端、多端统一后端 |
| 文件上传 | 原生支持 | 需要扩展（multipart） |
| 实时数据 | SSE / WebSocket 额外实现 | Subscription 原生支持 |

---

## 五、今日训练总结

**完成内容：**
1. ✅ RESTful API 五大核心原则梳理
2. ✅ URL 设计规范、状态码规范、统一响应格式
3. ✅ 分页策略（Offset vs Cursor）
4. ✅ GraphQL Schema 设计（类型、查询、变更、连接模式）
5. ✅ 业务域分析（技术博客平台）
6. ✅ 完整 RESTful API 端点设计（6 大模块、35+ 接口）
7. ✅ 完整 GraphQL Schema（20+ 类型、Input、Payload）
8. ✅ 请求/响应示例（创建文章、列表查询、GraphQL 查询）
9. ✅ 错误处理规范
10. ✅ 安全设计（认证、授权、防护、审计）
11. ✅ 性能优化策略
12. ✅ REST vs GraphQL 对比决策表

**关键收获：**
- REST 重在「资源」，GraphQL 重在「查询」
- 统一响应格式和错误码是 API 可用性的基石
- Cursor 分页在大数据集下优于 Offset 分页
- GraphQL 的 DataLoader 是解决 N+1 的标准答案
- 安全不是附加功能，是设计的一部分
