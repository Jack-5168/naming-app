# 🔌 专项训练 21:00 - API 设计原则与实战

**日期：** 2026-04-22  
**时间：** 21:00-22:30 (90 分钟)  
**主题：** RESTful & GraphQL API 设计原则 + 完整 API 设计实战

---

## 📚 第一部分：API 设计核心原则

### 一、RESTful API 设计原则

#### 1. 资源导向 (Resource-Oriented)

```
✅ 正确：
GET    /users          # 获取用户列表
GET    /users/123      # 获取特定用户
POST   /users          # 创建用户
PUT    /users/123      # 更新用户 (全量)
PATCH  /users/123      # 更新用户 (部分)
DELETE /users/123      # 删除用户

❌ 错误：
GET    /getUsers
POST   /createUser
POST   /deleteUser/123
```

#### 2. 使用名词，避免动词

```
✅ 正确：
POST /orders/123/cancel    # 资源 + 动作子资源
POST /orders/123/refund

❌ 错误：
POST /cancelOrder/123
GET  /deleteUser/123
```

#### 3. 复数名词命名资源

```
✅ 正确：
/users
/products
/orders

❌ 错误：
/user
/product
/order
```

#### 4. 嵌套资源表达关系

```
# 获取用户的所有订单
GET /users/123/orders

# 获取订单中的某个商品
GET /orders/456/items/789

# 限制嵌套深度 (不超过 2-3 层)
GET /users/123/orders/456/items  ✅
GET /users/123/orders/456/items/789/reviews  ❌ 太深
```

#### 5. 过滤、排序、分页

```
# 过滤
GET /users?role=admin&status=active
GET /products?category=electronics&price_min=100&price_max=500

# 排序
GET /users?sort=created_at&order=desc
GET /products?sort=price,asc

# 分页 (推荐 offset-limit 或 cursor-based)
GET /users?page=1&limit=20
GET /users?cursor=abc123&limit=20

# 字段选择 (减少响应大小)
GET /users/123?fields=id,name,email
```

#### 6. HTTP 状态码规范

| 状态码 | 含义 | 使用场景 |
|--------|------|----------|
| 200 OK | 成功 | GET/PUT/PATCH 成功 |
| 201 Created | 已创建 | POST 成功创建资源 |
| 204 No Content | 无内容 | DELETE 成功，无返回体 |
| 400 Bad Request | 请求错误 | 参数验证失败 |
| 401 Unauthorized | 未授权 | 未登录/Token 失效 |
| 403 Forbidden | 禁止访问 | 无权限 |
| 404 Not Found | 资源不存在 | 资源 ID 不存在 |
| 409 Conflict | 冲突 | 资源已存在/版本冲突 |
| 422 Unprocessable Entity | 语义错误 | 验证错误 (推荐) |
| 429 Too Many Requests | 请求过多 | 限流 |
| 500 Internal Server Error | 服务器错误 | 服务端异常 |

#### 7. 版本控制

```
# URL 路径版本 (最常用)
GET /api/v1/users
GET /api/v2/users

# Header 版本
Accept: application/vnd.myapp.v1+json

# 查询参数版本 (不推荐)
GET /users?version=1
```

#### 8. 统一响应格式

```json
// 成功响应
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-04-22T13:00:00Z"
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "邮箱格式不正确",
    "details": [
      { "field": "email", "message": "必须是有效的邮箱地址" }
    ]
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-04-22T13:00:00Z"
  }
}

// 列表响应
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### 二、GraphQL API 设计原则

#### 1. Schema 设计最佳实践

```graphql
# ✅ 正确：清晰的类型定义
type User {
  id: ID!
  name: String!
  email: String!
  role: UserRole!
  posts: [Post!]!
  createdAt: DateTime!
}

enum UserRole {
  ADMIN
  MEMBER
  GUEST
}

# ❌ 错误：模糊的类型
type User {
  id: String
  name: String
  data: JSON  # 太模糊
}
```

#### 2. Query 命名规范

```graphql
type Query {
  # 单个资源：单数名词
  user(id: ID!): User
  post(id: ID!): Post
  
  # 多个资源：复数名词 + 分页
  users(limit: Int = 20, cursor: String): UserConnection!
  posts(filter: PostFilter, sort: PostSort): [Post!]!
  
  # 搜索：search + 资源名
  searchUsers(query: String!): [User!]!
}
```

#### 3. Mutation 命名规范

```graphql
type Mutation {
  # 创建：create + 资源名
  createUser(input: CreateUserInput!): User!
  
  # 更新：update + 资源名
  updateUser(id: ID!, input: UpdateUserInput!): User!
  
  # 删除：delete + 资源名
  deleteUser(id: ID!): DeleteResult!
  
  # 动作：动词 + 资源名
  cancelOrder(id: ID!): Order!
  refundOrder(id: ID!): RefundResult!
}
```

#### 4. 输入类型设计

```graphql
# 创建输入 (所有字段可选，因为会有默认值)
input CreateUserInput {
  name: String!
  email: String!
  password: String!
  role: UserRole = MEMBER
}

# 更新输入 (所有字段可选)
input UpdateUserInput {
  name: String
  email: String
  role: UserRole
}

# 过滤输入
input PostFilter {
  status: PostStatus
  authorId: ID
  categoryId: ID
  createdAt_gte: DateTime
  createdAt_lte: DateTime
}
```

#### 5. 连接与分页 (Connection Pattern)

```graphql
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

# 查询示例
query {
  users(first: 20, after: "cursor123") {
    edges {
      node {
        id
        name
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

#### 6. 错误处理

```graphql
# 方式 1：联合类型 (Union)
union UserResult = User | UserError

type UserError {
  code: String!
  message: String!
}

type Mutation {
  createUser(input: CreateUserInput!): UserResult!
}

# 方式 2：包装类型
type CreateUserPayload {
  success: Boolean!
  user: User
  errors: [Error!]!
}

type Error {
  field: String
  message: String!
}
```

#### 7. N+1 问题与 DataLoader

```graphql
# ❌ 会导致 N+1 问题
type Post {
  id: ID!
  title: String!
  author: User!  # 每个 post 都会查询一次 author
}

# ✅ 使用 DataLoader 批量加载
# 在 resolver 层实现
const userLoader = new DataLoader(async (userIds) => {
  const users = await db.user.findMany({
    where: { id: { in: userIds } }
  });
  return userIds.map(id => users.find(u => u.id === id));
});
```

---

## 🎯 第二部分：完整 API 设计实战

### 项目背景：在线学习平台 (Learning Platform)

设计一套完整的 API，支持以下核心功能：
- 用户管理 (注册、登录、个人信息)
- 课程管理 (创建、浏览、搜索)
- 学习进度追踪
- 评论与评分
- 支付与订单

---

### 方案 A：RESTful API 设计

#### 1. 用户模块 (Users)

```yaml
# 用户注册
POST /api/v1/auth/register
Request:
  {
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "张三"
  }
Response: 201 Created
  {
    "success": true,
    "data": {
      "user": { "id": "usr_123", "email": "user@example.com", "name": "张三" },
      "token": "eyJhbGc..."
    }
  }

# 用户登录
POST /api/v1/auth/login
Request:
  {
    "email": "user@example.com",
    "password": "SecurePass123!"
  }
Response: 200 OK
  {
    "success": true,
    "data": {
      "user": { "id": "usr_123", "email": "user@example.com", "name": "张三" },
      "token": "eyJhbGc..."
    }
  }

# 获取当前用户信息
GET /api/v1/users/me
Response: 200 OK
  {
    "success": true,
    "data": {
      "id": "usr_123",
      "email": "user@example.com",
      "name": "张三",
      "avatar": "https://...",
      "role": "student",
      "createdAt": "2026-01-15T08:00:00Z"
    }
  }

# 更新用户信息
PATCH /api/v1/users/me
Request:
  {
    "name": "李四",
    "avatar": "https://..."
  }
Response: 200 OK

# 修改密码
POST /api/v1/users/me/change-password
Request:
  {
    "currentPassword": "OldPass123!",
    "newPassword": "NewPass456!"
  }
Response: 204 No Content
```

#### 2. 课程模块 (Courses)

```yaml
# 获取课程列表
GET /api/v1/courses
Query Params:
  - category: string (过滤分类)
  - level: string (难度：beginner/intermediate/advanced)
  - sort: string (排序：popular/latest/rating)
  - page: number (页码，默认 1)
  - limit: number (每页数量，默认 20)
Response: 200 OK
  {
    "success": true,
    "data": [
      {
        "id": "crs_001",
        "title": "React 入门到精通",
        "description": "全面学习 React...",
        "instructor": { "id": "usr_456", "name": "王老师" },
        "thumbnail": "https://...",
        "price": 299.00,
        "rating": 4.8,
        "studentCount": 1250,
        "level": "beginner",
        "category": "frontend"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }

# 获取课程详情
GET /api/v1/courses/:courseId
Response: 200 OK
  {
    "success": true,
    "data": {
      "id": "crs_001",
      "title": "React 入门到精通",
      "description": "全面学习 React...",
      "instructor": { "id": "usr_456", "name": "王老师", "bio": "..." },
      "thumbnail": "https://...",
      "price": 299.00,
      "rating": 4.8,
      "reviewCount": 320,
      "studentCount": 1250,
      "level": "beginner",
      "category": "frontend",
      "duration": "12 小时",
      "lectures": 45,
      "syllabus": [
        {
          "section": "第一章：React 基础",
          "lectures": [
            { "id": "lec_001", "title": "什么是 React", "duration": "15:00", "free": true }
          ]
        }
      ],
      "createdAt": "2026-01-10T08:00:00Z",
      "updatedAt": "2026-04-20T10:00:00Z"
    }
  }

# 创建课程 (讲师)
POST /api/v1/courses
Request:
  {
    "title": "Vue3 实战",
    "description": "...",
    "price": 399.00,
    "level": "intermediate",
    "category": "frontend"
  }
Response: 201 Created

# 更新课程 (讲师)
PUT /api/v1/courses/:courseId
PATCH /api/v1/courses/:courseId

# 删除课程 (讲师)
DELETE /api/v1/courses/:courseId
Response: 204 No Content
```

#### 3. 学习进度模块 (Progress)

```yaml
# 获取用户学习进度
GET /api/v1/users/me/progress
Query Params:
  - status: string (enrolled/in-progress/completed)
Response: 200 OK
  {
    "success": true,
    "data": [
      {
        "course": { "id": "crs_001", "title": "React 入门到精通" },
        "enrolledAt": "2026-03-01T08:00:00Z",
        "progress": 65,
        "status": "in-progress",
        "lastAccessedAt": "2026-04-22T19:00:00Z",
        "completedLectures": 29,
        "totalLectures": 45
      }
    ]
  }

#  enroll 课程
POST /api/v1/courses/:courseId/enroll
Response: 201 Created
  {
    "success": true,
    "data": {
      "enrollment": {
        "id": "enr_789",
        "courseId": "crs_001",
        "userId": "usr_123",
        "enrolledAt": "2026-04-22T13:00:00Z"
      }
    }
  }

# 更新学习进度
POST /api/v1/courses/:courseId/progress
Request:
  {
    "lectureId": "lec_015",
    "completed": true
  }
Response: 200 OK

# 获取课程学习进度
GET /api/v1/courses/:courseId/progress
Response: 200 OK
```

#### 4. 评论与评分模块 (Reviews)

```yaml
# 获取课程评论
GET /api/v1/courses/:courseId/reviews
Query Params:
  - sort: string (latest/highest/lowest)
  - page: number
  - limit: number
Response: 200 OK
  {
    "success": true,
    "data": [
      {
        "id": "rev_001",
        "user": { "id": "usr_789", "name": "李明", "avatar": "..." },
        "rating": 5,
        "comment": "非常好的课程，讲解清晰！",
        "helpful": 25,
        "createdAt": "2026-04-15T10:00:00Z"
      }
    ],
    "pagination": { ... },
    "summary": {
      "averageRating": 4.8,
      "totalReviews": 320,
      "ratingDistribution": {
        "5": 250,
        "4": 50,
        "3": 15,
        "2": 3,
        "1": 2
      }
    }
  }

# 创建评论 (需已购买课程)
POST /api/v1/courses/:courseId/reviews
Request:
  {
    "rating": 5,
    "comment": "非常好的课程！"
  }
Response: 201 Created

# 更新自己的评论
PATCH /api/v1/reviews/:reviewId

# 删除自己的评论
DELETE /api/v1/reviews/:reviewId

# 标记评论有用
POST /api/v1/reviews/:reviewId/helpful
Response: 204 No Content
```

#### 5. 订单与支付模块 (Orders)

```yaml
# 创建订单
POST /api/v1/orders
Request:
  {
    "items": [
      { "courseId": "crs_001", "price": 299.00 }
    ],
    "couponCode": "SPRING2026"  # 可选
  }
Response: 201 Created
  {
    "success": true,
    "data": {
      "order": {
        "id": "ord_001",
        "status": "pending",
        "totalAmount": 299.00,
        "discountAmount": 0,
        "finalAmount": 299.00,
        "expiresAt": "2026-04-22T14:00:00Z"
      },
      "paymentUrl": "https://payment.gateway.com/..."
    }
  }

# 获取订单详情
GET /api/v1/orders/:orderId
Response: 200 OK

# 获取用户订单列表
GET /api/v1/users/me/orders
Query Params:
  - status: string (pending/paid/refunded)

# 取消订单 (未支付)
POST /api/v1/orders/:orderId/cancel
Response: 200 OK

# 支付回调 (服务端对服务端)
POST /api/v1/webhooks/payment
Request:
  {
    "orderId": "ord_001",
    "paymentId": "pay_xxx",
    "status": "success",
    "signature": "..."
  }

# 申请退款
POST /api/v1/orders/:orderId/refund
Request:
  {
    "reason": "课程内容与描述不符"
  }
Response: 202 Accepted
  {
    "success": true,
    "data": {
      "refund": {
        "id": "ref_001",
        "status": "processing",
        "estimatedDays": 7
      }
    }
  }
```

#### 6. 错误响应示例

```json
// 400 - 验证错误
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [
      { "field": "email", "message": "必须是有效的邮箱地址" },
      { "field": "password", "message": "密码长度至少 8 位" }
    ]
  }
}

// 401 - 未授权
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "请先登录"
  }
}

// 403 - 禁止访问
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "您没有权限执行此操作"
  }
}

// 404 - 资源不存在
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "课程不存在"
  }
}

// 409 - 冲突
{
  "success": false,
  "error": {
    "code": "ALREADY_ENROLLED",
    "message": "您已经 enroll 过该课程"
  }
}

// 429 - 限流
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "请求过于频繁，请稍后再试",
    "retryAfter": 60
  }
}
```

---

### 方案 B：GraphQL API 设计

#### 1. Schema 定义

```graphql
# 标量类型
scalar DateTime
scalar JSON

# 枚举类型
enum UserRole {
  STUDENT
  INSTRUCTOR
  ADMIN
}

enum CourseLevel {
  BEGINNER
  INTERMEDIATE
  ADVANCED
}

enum EnrollmentStatus {
  ENROLLED
  IN_PROGRESS
  COMPLETED
}

enum OrderStatus {
  PENDING
  PAID
  REFUNDED
  CANCELLED
}

# 用户类型
type User {
  id: ID!
  email: String!
  name: String!
  avatar: String
  role: UserRole!
  bio: String
  createdAt: DateTime!
  
  # 关联字段
  courses: [Course!]!        # 作为讲师的课程
  enrollments: [Enrollment!]! # 作为学生的 enrollments
  reviews: [Review!]!
  orders: [Order!]!
}

# 课程类型
type Course {
  id: ID!
  title: String!
  description: String!
  thumbnail: String
  price: Float!
  level: CourseLevel!
  category: String!
  duration: String!
  lectureCount: Int!
  rating: Float!
  reviewCount: Int!
  studentCount: Int!
  instructor: User!
  syllabus: [Section!]!
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # 关联字段
  reviews(limit: Int = 10, cursor: String): ReviewConnection!
  enrollments: [Enrollment!]!
}

type Section {
  title: String!
  lectures: [Lecture!]!
}

type Lecture {
  id: ID!
  title: String!
  description: String
  duration: String!
  videoUrl: String  # 仅对已 enroll 用户可见
  free: Boolean!
  completed: Boolean  # 当前用户是否完成
}

# 学习进度
type Enrollment {
  id: ID!
  user: User!
  course: Course!
  status: EnrollmentStatus!
  progress: Int!  # 0-100
  completedLectures: Int!
  enrolledAt: DateTime!
  lastAccessedAt: DateTime
  completedAt: DateTime
}

# 评论
type Review {
  id: ID!
  user: User!
  course: Course!
  rating: Int!
  comment: String!
  helpful: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type ReviewConnection {
  edges: [ReviewEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
  averageRating: Float!
  ratingDistribution: RatingDistribution!
}

type ReviewEdge {
  node: Review!
  cursor: String!
}

type RatingDistribution {
  five: Int!
  four: Int!
  three: Int!
  two: Int!
  one: Int!
}

# 订单
type Order {
  id: ID!
  user: User!
  items: [OrderItem!]!
  subtotal: Float!
  discount: Float!
  total: Float!
  status: OrderStatus!
  createdAt: DateTime!
  paidAt: DateTime
}

type OrderItem {
  course: Course!
  price: Float!
}

# 分页信息
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# 输入类型
input CreateUserInput {
  email: String!
  password: String!
  name: String!
}

input LoginInput {
  email: String!
  password: String!
}

input UpdateUserInput {
  name: String
  avatar: String
  bio: String
}

input CreateCourseInput {
  title: String!
  description: String!
  price: Float!
  level: CourseLevel!
  category: String!
}

input UpdateCourseInput {
  title: String
  description: String
  price: Float
  level: CourseLevel
  category: String
}

input CreateReviewInput {
  courseId: ID!
  rating: Int!
  comment: String!
}

input EnrollCourseInput {
  courseId: ID!
  couponCode: String
}

input CourseFilter {
  category: String
  level: CourseLevel
  minPrice: Float
  maxPrice: Float
  minRating: Float
}

input CourseSort {
  field: CourseSortField!
  order: SortOrder!
}

enum CourseSortField {
  CREATED_AT
  PRICE
  RATING
  STUDENT_COUNT
}

enum SortOrder {
  ASC
  DESC
}

# Query 类型
type Query {
  # 用户相关
  me: User
  user(id: ID!): User
  users(limit: Int = 20, cursor: String): UserConnection!
  
  # 课程相关
  course(id: ID!): Course
  courses(filter: CourseFilter, sort: CourseSort, limit: Int = 20, cursor: String): CourseConnection!
  searchCourses(query: String!, filter: CourseFilter): [Course!]!
  
  # 订单相关
  order(id: ID!): Order
  myOrders(status: OrderStatus): [Order!]!
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

type CourseConnection {
  edges: [CourseEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type CourseEdge {
  node: Course!
  cursor: String!
}

# Mutation 类型
type Mutation {
  # 认证
  register(input: CreateUserInput!): AuthPayload!
  login(input: LoginInput!): AuthPayload!
  logout: Boolean!
  updateProfile(input: UpdateUserInput!): User!
  changePassword(currentPassword: String!, newPassword: String!): Boolean!
  
  # 课程 (讲师)
  createCourse(input: CreateCourseInput!): Course!
  updateCourse(id: ID!, input: UpdateCourseInput!): Course!
  deleteCourse(id: ID!): Boolean!
  
  # 学习进度
  enrollCourse(input: EnrollCourseInput!): Enrollment!
  updateProgress(courseId: ID!, lectureId: ID!, completed: Boolean!): Enrollment!
  
  # 评论
  createReview(input: CreateReviewInput!): Review!
  updateReview(id: ID!, rating: Int, comment: String): Review!
  deleteReview(id: ID!): Boolean!
  markReviewHelpful(id: ID!): Review!
}

# 认证响应
type AuthPayload {
  success: Boolean!
  user: User
  token: String
  errors: [Error!]!
}

# 通用错误
type Error {
  field: String
  message: String!
  code: String!
}
```

#### 2. 查询示例

```graphql
# 获取课程列表 (带分页和过滤)
query GetCourses {
  courses(
    filter: { level: BEGINNER, minRating: 4.0 }
    sort: { field: RATING, order: DESC }
    limit: 20
  ) {
    edges {
      node {
        id
        title
        price
        rating
        studentCount
        instructor {
          id
          name
        }
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}

# 获取课程详情 (嵌套数据)
query GetCourseDetail($courseId: ID!) {
  course(id: $courseId) {
    id
    title
    description
    price
    rating
    reviewCount
    studentCount
    level
    category
    duration
    instructor {
      id
      name
      bio
    }
    syllabus {
      title
      lectures {
        id
        title
        duration
        free
      }
    }
    reviews(limit: 5) {
      edges {
        node {
          id
          rating
          comment
          user {
            name
            avatar
          }
          createdAt
        }
      }
      averageRating
      ratingDistribution {
        five
        four
        three
        two
        one
      }
    }
  }
}

# 获取当前用户的学习进度
query GetMyProgress {
  me {
    id
    name
    enrollments {
      id
      course {
        id
        title
        thumbnail
      }
      status
      progress
      completedLectures
      lastAccessedAt
    }
  }
}

# 搜索课程
query SearchCourses($query: String!) {
  searchCourses(query: $query) {
    id
    title
    description
    rating
    price
  }
}
```

#### 3. Mutation 示例

```graphql
# 用户注册
mutation Register($input: CreateUserInput!) {
  register(input: $input) {
    success
    user {
      id
      email
      name
    }
    token
    errors {
      field
      message
    }
  }
}

# 用户登录
mutation Login($input: LoginInput!) {
  login(input: $input) {
    success
    user {
      id
      email
      name
    }
    token
    errors {
      message
    }
  }
}

# Enroll 课程
mutation EnrollCourse($input: EnrollCourseInput!) {
  enrollCourse(input: $input) {
    id
    course {
      id
      title
    }
    status
    enrolledAt
  }
}

# 更新学习进度
mutation UpdateProgress($courseId: ID!, $lectureId: ID!, $completed: Boolean!) {
  updateProgress(courseId: $courseId, lectureId: $lectureId, completed: $completed) {
    id
    progress
    completedLectures
    status
  }
}

# 创建评论
mutation CreateReview($input: CreateReviewInput!) {
  createReview(input: $input) {
    id
    rating
    comment
    createdAt
  }
}

# 创建课程 (讲师)
mutation CreateCourse($input: CreateCourseInput!) {
  createCourse(input: $input) {
    id
    title
    price
    createdAt
  }
}
```

---

## 📊 第三部分：RESTful vs GraphQL 对比

| 维度 | RESTful | GraphQL |
|------|---------|---------|
| **数据获取** | 多个端点，可能过度/不足获取 | 单端点，精确获取所需字段 |
| **版本控制** | 需要 URL 版本 (/v1/, /v2/) | 通过 schema 演进，向后兼容 |
| **缓存** | HTTP 缓存成熟 (CDN, 浏览器) | 需要应用层缓存方案 |
| **学习曲线** | 简单直观 | 需要学习 schema 和查询语言 |
| **工具生态** | 成熟 (Swagger, Postman) | 发展中 (Playground, Apollo) |
| **适用场景** | 资源导向，简单 CRUD | 复杂数据关系，多客户端 |
| **N+1 问题** | 可通过 eager loading 解决 | 需要 DataLoader |
| **文件上传** | 原生支持 | 需要额外方案 |
| **实时订阅** | 需要 WebSocket | 原生支持 Subscriptions |

---

## ✅ 第四部分：API 设计检查清单

### RESTful 检查清单

- [ ] 使用名词复数命名资源
- [ ] 使用 HTTP 方法表达动作 (GET/POST/PUT/PATCH/DELETE)
- [ ] 返回合适的 HTTP 状态码
- [ ] 统一响应格式 (success/data/error)
- [ ] 实现分页、过滤、排序
- [ ] 实现版本控制
- [ ] 提供清晰的错误信息
- [ ] 实现认证授权 (JWT/OAuth)
- [ ] 实现限流保护
- [ ] 编写 API 文档 (OpenAPI/Swagger)

### GraphQL 检查清单

- [ ] Schema 设计清晰，类型明确
- [ ] 使用非空类型 (!) 表达必填字段
- [ ] 实现 Connection 模式分页
- [ ] 使用 Input 类型组织 mutation 参数
- [ ] 实现 DataLoader 解决 N+1
- [ ] 设计合理的错误处理
- [ ] 实现认证授权
- [ ] 实现查询复杂度限制
- [ ] 实现字段级权限控制
- [ ] 编写 Schema 文档

---

## 📝 总结

本次专项训练涵盖了：

1. **RESTful API 设计原则** - 资源导向、HTTP 方法、状态码、版本控制
2. **GraphQL API 设计原则** - Schema 设计、Query/Mutation 规范、分页模式
3. **完整 API 设计实战** - 在线学习平台的完整 API 设计 (双方案)
4. **对比与选型指南** - RESTful vs GraphQL 的适用场景

**关键收获：**
- API 设计的核心是**一致性**和**可预测性**
- 选择合适的 API 风格取决于业务场景和团队技术栈
- 良好的文档和错误处理是 API 可用性的关键
- 安全 (认证、授权、限流) 必须从设计阶段考虑

---

**完成时间：** 2026-04-22 21:00-22:30  
**耗时：** 90 分钟  
**状态：** ✅ 完成
