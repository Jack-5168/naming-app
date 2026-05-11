# 专项训练 21:00 - API 设计
**日期:** 2026 年 4 月 23 日  
**主题:** RESTful/GraphQL 设计原则，设计 1 套完整 API + 文档

---

## 一、RESTful API 设计原则

### 1.1 核心原则

| 原则 | 说明 |
|------|------|
| **资源导向** | URL 代表资源 (名词)，而非动作 (动词) |
| **HTTP 动词** | GET(查), POST(创), PUT(全更), PATCH(部更), DELETE(删) |
| **无状态** | 每个请求包含所有必要信息 |
| **统一接口** | 一致的命名、格式、错误处理 |
| **层次系统** | 客户端不关心服务器架构 |
| **可缓存** | 合理利用 HTTP 缓存头 |

### 1.2 URL 设计规范

```
✅ 正确:
GET    /api/v1/users
GET    /api/v1/users/123
POST   /api/v1/users
PUT    /api/v1/users/123
PATCH  /api/v1/users/123
DELETE /api/v1/users/123
GET    /api/v1/users/123/orders

❌ 错误:
GET    /api/v1/getUsers
POST   /api/v1/createUser
GET    /api/v1/deleteUser/123
```

### 1.3 状态码规范

| 状态码 | 含义 | 使用场景 |
|--------|------|----------|
| 200 OK | 成功 | GET/PUT/PATCH 成功 |
| 201 Created | 已创建 | POST 成功创建资源 |
| 204 No Content | 无内容 | DELETE 成功 |
| 400 Bad Request | 请求错误 | 参数验证失败 |
| 401 Unauthorized | 未授权 | 未登录/Token 过期 |
| 403 Forbidden | 禁止访问 | 无权限 |
| 404 Not Found | 资源不存在 | 资源 ID 无效 |
| 409 Conflict | 冲突 | 资源已存在/版本冲突 |
| 422 Unprocessable Entity | 语义错误 | 数据验证失败 |
| 429 Too Many Requests | 请求过多 | 触发限流 |
| 500 Internal Server Error | 服务器错误 | 服务端异常 |

### 1.4 响应格式规范

```json
// 成功响应
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-04-23T21:00:00+08:00",
    "requestId": "req_abc123"
  }
}

// 分页响应
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数验证失败",
    "details": [
      { "field": "email", "message": "邮箱格式不正确" }
    ]
  }
}
```

### 1.5 查询参数规范

```
# 分页
GET /api/v1/users?page=1&pageSize=20

# 排序
GET /api/v1/users?sort=-createdAt  # 降序
GET /api/v1/users?sort=createdAt   # 升序

# 字段过滤
GET /api/v1/users?fields=id,name,email

# 条件过滤
GET /api/v1/users?status=active&role=admin

# 搜索
GET /api/v1/users?search=keyword
```

---

## 二、GraphQL API 设计原则

### 2.1 核心概念

| 概念 | 说明 |
|------|------|
| **Schema** | API 的契约，定义类型和操作 |
| **Query** | 读取操作 (类似 GET) |
| **Mutation** | 写入操作 (类似 POST/PUT/DELETE) |
| **Subscription** | 实时推送 (WebSocket) |
| **Resolver** | 字段的数据获取逻辑 |

### 2.2 Schema 设计示例

```graphql
# 类型定义
type User {
  id: ID!
  email: String!
  name: String
  avatar: String
  role: UserRole!
  createdAt: DateTime!
  updatedAt: DateTime!
  orders: [Order!]!
}

enum UserRole {
  ADMIN
  USER
  GUEST
}

# 查询操作
type Query {
  user(id: ID!): User
  users(page: Int, pageSize: Int, filter: UserFilter): UserConnection!
  me: User
}

# 变更操作
type Mutation {
  createUser(input: CreateUserInput!): UserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UserPayload!
  deleteUser(id: ID!): DeletePayload!
  login(email: String!, password: String!): AuthPayload!
}

# 订阅操作
type Subscription {
  userCreated: User!
  orderStatusChanged(orderId: ID!): Order!
}
```

### 2.3 GraphQL 最佳实践

```graphql
# ✅ 使用输入类型组织参数
input CreateUserInput {
  email: String!
  password: String!
  name: String
  role: UserRole
}

input UpdateUserInput {
  name: String
  avatar: String
  role: UserRole
}

# ✅ 统一的响应类型
type UserPayload {
  success: Boolean!
  user: User
  errors: [Error!]
}

type Error {
  field: String
  message: String!
}

# ✅ 分页使用 Cursor-based
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
```

### 2.4 RESTful vs GraphQL 对比

| 维度 | RESTful | GraphQL |
|------|---------|---------|
| **数据获取** | 固定端点，可能过度/不足获取 | 客户端指定，精确获取 |
| **版本控制** | URL 版本 (/v1/, /v2/) | Schema 演进，向后兼容 |
| **请求次数** | 多资源需多次请求 | 单次请求获取多资源 |
| **缓存** | HTTP 缓存成熟 | 需额外方案 (Persisted Queries) |
| **学习曲线** | 简单直观 | 需学习 Schema/类型系统 |
| **适用场景** | 简单 CRUD, 公开 API | 复杂数据关系，多客户端 |

---

## 三、实战：电商系统 API 设计

### 3.1 系统概述

设计一个电商系统的完整 API，包含：
- 用户管理 (Users)
- 商品管理 (Products)
- 订单管理 (Orders)
- 购物车 (Cart)
- 支付 (Payments)

### 3.2 RESTful API 完整设计

#### 用户模块

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
  { "email": "user@example.com", "password": "SecurePass123!" }
Response: 200 OK
  {
    "success": true,
    "data": {
      "user": { "id": "usr_123", "email": "user@example.com" },
      "token": "eyJhbGc...",
      "refreshToken": "dGhpcyBp..."
    }
  }

# 获取当前用户
GET /api/v1/users/me
Response: 200 OK
  {
    "success": true,
    "data": {
      "id": "usr_123",
      "email": "user@example.com",
      "name": "张三",
      "avatar": "https://...",
      "role": "USER",
      "createdAt": "2026-01-01T00:00:00+08:00"
    }
  }

# 更新用户信息
PATCH /api/v1/users/me
Request:
  { "name": "新名字", "avatar": "https://..." }
Response: 200 OK

# 刷新 Token
POST /api/v1/auth/refresh
Request:
  { "refreshToken": "dGhpcyBp..." }
Response: 200 OK
```

#### 商品模块

```yaml
# 获取商品列表
GET /api/v1/products?page=1&pageSize=20&category=electronics&sort=-price
Response: 200 OK
  {
    "success": true,
    "data": [...],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 150,
      "totalPages": 8
    }
  }

# 获取商品详情
GET /api/v1/products/prod_456
Response: 200 OK
  {
    "success": true,
    "data": {
      "id": "prod_456",
      "name": "iPhone 18 Pro",
      "description": "...",
      "price": 8999.00,
      "currency": "CNY",
      "stock": 100,
      "images": ["https://...", ...],
      "category": { "id": "cat_1", "name": "手机" },
      "specs": { "color": "深空黑", "storage": "256GB" },
      "rating": 4.8,
      "reviewCount": 1234
    }
  }

# 搜索商品
GET /api/v1/products/search?q=iphone&minPrice=5000&maxPrice=10000
Response: 200 OK

# 获取商品评价
GET /api/v1/products/prod_456/reviews?page=1&pageSize=10&rating=5
Response: 200 OK
```

#### 购物车模块

```yaml
# 获取购物车
GET /api/v1/cart
Response: 200 OK
  {
    "success": true,
    "data": {
      "id": "cart_789",
      "items": [
        {
          "id": "item_1",
          "product": { "id": "prod_456", "name": "iPhone 18 Pro", "price": 8999.00 },
          "quantity": 1,
          "subtotal": 8999.00
        }
      ],
      "subtotal": 8999.00,
      "shipping": 0.00,
      "total": 8999.00,
      "itemCount": 1
    }
  }

# 添加商品到购物车
POST /api/v1/cart/items
Request:
  { "productId": "prod_456", "quantity": 2 }
Response: 201 Created

# 更新购物车商品数量
PATCH /api/v1/cart/items/item_1
Request:
  { "quantity": 3 }
Response: 200 OK

# 删除购物车商品
DELETE /api/v1/cart/items/item_1
Response: 204 No Content

# 清空购物车
DELETE /api/v1/cart
Response: 204 No Content
```

#### 订单模块

```yaml
# 创建订单
POST /api/v1/orders
Request:
  {
    "shippingAddress": {
      "name": "张三",
      "phone": "13800138000",
      "province": "浙江省",
      "city": "杭州市",
      "district": "西湖区",
      "address": "某某路 123 号"
    },
    "paymentMethod": "alipay",
    "couponCode": "SAVE100"
  }
Response: 201 Created
  {
    "success": true,
    "data": {
      "id": "ord_999",
      "orderNo": "ORD202604230001",
      "status": "PENDING_PAYMENT",
      "items": [...],
      "subtotal": 8999.00,
      "shipping": 0.00,
      "discount": 100.00,
      "total": 8899.00,
      "createdAt": "2026-04-23T21:00:00+08:00"
    }
  }

# 获取订单列表
GET /api/v1/orders?page=1&status=SHIPPED
Response: 200 OK

# 获取订单详情
GET /api/v1/orders/ord_999
Response: 200 OK

# 取消订单
POST /api/v1/orders/ord_999/cancel
Request:
  { "reason": "不想要了" }
Response: 200 OK

# 确认收货
POST /api/v1/orders/ord_999/confirm
Response: 200 OK
```

#### 支付模块

```yaml
# 创建支付
POST /api/v1/payments
Request:
  {
    "orderId": "ord_999",
    "method": "alipay",
    "amount": 8899.00
  }
Response: 201 Created
  {
    "success": true,
    "data": {
      "id": "pay_111",
      "paymentUrl": "https://openapi.alipay.com/...",
      "expireAt": "2026-04-23T21:30:00+08:00"
    }
  }

# 查询支付状态
GET /api/v1/payments/pay_111
Response: 200 OK
  {
    "success": true,
    "data": {
      "id": "pay_111",
      "status": "PAID",
      "amount": 8899.00,
      "paidAt": "2026-04-23T21:05:00+08:00"
    }
  }

# 支付回调 (服务端)
POST /api/v1/payments/callback/alipay
```

### 3.3 GraphQL Schema 完整设计

```graphql
schema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}

# ==================== 类型定义 ====================

type User {
  id: ID!
  email: String!
  name: String
  avatar: String
  role: UserRole!
  phone: String
  createdAt: DateTime!
  updatedAt: DateTime!
  orders(page: Int, pageSize: Int): OrderConnection!
  reviews(page: Int, pageSize: Int): ReviewConnection!
}

enum UserRole {
  ADMIN
  USER
  GUEST
}

type Product {
  id: ID!
  name: String!
  description: String
  price: Float!
  currency: String!
  stock: Int!
  images: [String!]!
  category: Category!
  specs: JSON
  rating: Float!
  reviewCount: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
  reviews(page: Int, pageSize: Int, rating: Int): ReviewConnection!
}

type Category {
  id: ID!
  name: String!
  slug: String!
  parentId: ID
  parent: Category
  children: [Category!]!
  products(page: Int, pageSize: Int): ProductConnection!
}

type Order {
  id: ID!
  orderNo: String!
  status: OrderStatus!
  user: User!
  items: [OrderItem!]!
  shippingAddress: Address!
  paymentMethod: String!
  subtotal: Float!
  shipping: Float!
  discount: Float!
  total: Float!
  payment: Payment
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum OrderStatus {
  PENDING_PAYMENT
  PAID
  SHIPPED
  DELIVERED
  COMPLETED
  CANCELLED
  REFUNDED
}

type OrderItem {
  id: ID!
  product: Product!
  quantity: Int!
  price: Float!
  subtotal: Float!
}

type Address {
  id: ID!
  name: String!
  phone: String!
  province: String!
  city: String!
  district: String!
  address: String!
  isDefault: Boolean!
}

type Payment {
  id: ID!
  order: Order!
  method: String!
  amount: Float!
  status: PaymentStatus!
  transactionId: String
  paidAt: DateTime
  createdAt: DateTime!
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

type Review {
  id: ID!
  user: User!
  product: Product!
  rating: Int!
  content: String!
  images: [String!]
  createdAt: DateTime!
}

type Cart {
  id: ID!
  user: User!
  items: [CartItem!]!
  subtotal: Float!
  shipping: Float!
  total: Float!
  itemCount: Int!
}

type CartItem {
  id: ID!
  product: Product!
  quantity: Int!
  subtotal: Float!
}

# ==================== 连接类型 (分页) ====================

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type ProductConnection {
  edges: [ProductEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ProductEdge {
  node: Product!
  cursor: String!
}

type OrderConnection {
  edges: [OrderEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type OrderEdge {
  node: Order!
  cursor: String!
}

type ReviewConnection {
  edges: [ReviewEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ReviewEdge {
  node: Review!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

scalar DateTime
scalar JSON

# ==================== 输入类型 ====================

input RegisterInput {
  email: String!
  password: String!
  name: String
}

input LoginInput {
  email: String!
  password: String!
}

input UpdateUserInput {
  name: String
  avatar: String
  phone: String
}

input ProductFilter {
  categoryId: ID
  minPrice: Float
  maxPrice: Float
  minRating: Float
  inStock: Boolean
}

input CreateOrderInput {
  shippingAddress: AddressInput!
  paymentMethod: String!
  couponCode: String
}

input AddressInput {
  name: String!
  phone: String!
  province: String!
  city: String!
  district: String!
  address: String!
}

input CreateReviewInput {
  productId: ID!
  rating: Int!
  content: String!
  images: [String!]
}

# ==================== 响应类型 ====================

type AuthPayload {
  success: Boolean!
  user: User
  token: String
  refreshToken: String
  errors: [Error!]
}

type UserPayload {
  success: Boolean!
  user: User
  errors: [Error!]
}

type OrderPayload {
  success: Boolean!
  order: Order
  errors: [Error!]
}

type PaymentPayload {
  success: Boolean!
  payment: Payment
  paymentUrl: String
  errors: [Error!]
}

type DeletePayload {
  success: Boolean!
  errors: [Error!]
}

type Error {
  field: String
  message: String!
  code: String
}

# ==================== Query ====================

type Query {
  # 用户
  me: User
  user(id: ID!): User
  users(page: Int, pageSize: Int, filter: UserFilter): UserConnection!
  
  # 商品
  product(id: ID!): Product
  products(page: Int, pageSize: Int, filter: ProductFilter, search: String): ProductConnection!
  categories(parentId: ID): [Category!]!
  
  # 订单
  order(id: ID!): Order
  orders(page: Int, pageSize: Int, status: OrderStatus): OrderConnection!
  
  # 购物车
  cart: Cart
  
  # 支付
  payment(id: ID!): Payment
}

# ==================== Mutation ====================

type Mutation {
  # 认证
  register(input: RegisterInput!): AuthPayload!
  login(input: LoginInput!): AuthPayload!
  logout: Boolean!
  refreshToken(refreshToken: String!): AuthPayload!
  
  # 用户
  updateUser(input: UpdateUserInput!): UserPayload!
  
  # 订单
  createOrder(input: CreateOrderInput!): OrderPayload!
  cancelOrder(id: ID!, reason: String): OrderPayload!
  confirmOrder(id: ID!): OrderPayload!
  
  # 购物车
  addToCart(productId: ID!, quantity: Int!): CartPayload!
  updateCartItem(id: ID!, quantity: Int!): CartPayload!
  removeCartItem(id: ID!): Boolean!
  clearCart: Boolean!
  
  # 支付
  createPayment(orderId: ID!, method: String!): PaymentPayload!
  
  # 评价
  createReview(input: CreateReviewInput!): ReviewPayload!
}

# ==================== Subscription ====================

type Subscription {
  orderStatusChanged(orderId: ID!): Order!
  paymentReceived(userId: ID!): Payment!
  newReview(productId: ID!): Review!
}
```

### 3.4 GraphQL 查询示例

```graphql
# 获取商品列表 (精确控制返回字段)
query GetProducts {
  products(page: 1, pageSize: 10, filter: { inStock: true }) {
    edges {
      node {
        id
        name
        price
        images
        rating
        category {
          name
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}

# 获取订单详情 (嵌套数据)
query GetOrder($id: ID!) {
  order(id: $id) {
    id
    orderNo
    status
    total
    items {
      product {
        name
        images
      }
      quantity
      price
    }
    shippingAddress {
      name
      phone
      address
    }
    payment {
      status
      paidAt
    }
  }
}

# 创建订单 (Mutation)
mutation CreateOrder($input: CreateOrderInput!) {
  createOrder(input: $input) {
    success
    order {
      id
      orderNo
      total
    }
    errors {
      field
      message
    }
  }
}

# 订阅订单状态变化
subscription OrderStatusChanged($orderId: ID!) {
  orderStatusChanged(orderId: $orderId) {
    id
    status
    updatedAt
  }
}
```

---

## 四、API 文档规范

### 4.1 OpenAPI (Swagger) 示例

```yaml
openapi: 3.0.3
info:
  title: 电商系统 API
  description: 完整的电商系统 RESTful API
  version: 1.0.0
  contact:
    name: API Support
    email: api@example.com

servers:
  - url: https://api.example.com/api/v1
    description: 生产环境
  - url: https://staging-api.example.com/api/v1
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
          example: usr_123
        email:
          type: string
          format: email
        name:
          type: string
        role:
          type: string
          enum: [ADMIN, USER, GUEST]
        createdAt:
          type: string
          format: date-time
    
    Product:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        price:
          type: number
          format: float
        stock:
          type: integer
        images:
          type: array
          items:
            type: string
            format: uri
    
    Error:
      type: object
      properties:
        success:
          type: boolean
          example: false
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

paths:
  /auth/register:
    post:
      tags: [认证]
      summary: 用户注册
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
                name:
                  type: string
      responses:
        '201':
          description: 注册成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '400':
          description: 请求参数错误
        '409':
          description: 邮箱已存在
  
  /products:
    get:
      tags: [商品]
      summary: 获取商品列表
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: pageSize
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: category
          in: query
          schema:
            type: string
        - name: sort
          in: query
          schema:
            type: string
            description: 排序字段，- 表示降序
      security:
        - bearerAuth: []
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Product'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
```

### 4.2 文档要点

1. **每个端点必须有**: 描述、参数说明、请求示例、响应示例
2. **错误码文档**: 列出所有可能的错误码及含义
3. **认证说明**: 明确认证方式和 Token 获取流程
4. **限流说明**: 标注各端点的限流策略
5. **版本说明**: 明确 API 版本和废弃策略

---

## 五、安全检查清单

### 5.1 安全设计

- [ ] 所有写操作需要认证
- [ ] 敏感操作需要二次验证
- [ ] 实现 RBAC 权限控制
- [ ] 输入参数严格验证
- [ ] 防止 SQL 注入/XSS
- [ ] 实现请求限流
- [ ] 敏感数据脱敏返回
- [ ] 使用 HTTPS
- [ ] Token 设置合理过期时间
- [ ] 实现刷新 Token 机制

### 5.2 性能优化

- [ ] 实现分页，避免全量返回
- [ ] 支持字段过滤，减少数据传输
- [ ] 合理使用缓存 (ETag, Last-Modified)
- [ ] 实现请求压缩 (gzip)
- [ ] 数据库查询优化 (索引、N+1 问题)
- [ ] 异步处理耗时操作
- [ ] CDN 加速静态资源

### 5.3 可维护性

- [ ] 统一的错误处理
- [ ] 完整的日志记录
- [ ] 请求追踪 (Request ID)
- [ ] 监控告警
- [ ] API 版本管理
- [ ] 向后兼容
- [ ] 废弃通知机制

---

## 六、总结

### RESTful 适用场景
- 公开 API，需要广泛兼容
- 简单 CRUD 操作
- 需要 HTTP 缓存
- 资源结构相对固定

### GraphQL 适用场景
- 多客户端 (Web/iOS/Android)
- 复杂数据关系
- 需要精确控制返回数据
- 快速迭代，频繁变更

### 最佳实践
1. **设计先行**: 先设计 API 契约，再实现
2. **文档同步**: 代码与文档保持一致
3. **版本管理**: 提前规划版本策略
4. **测试覆盖**: 单元测试 + 集成测试
5. **监控告警**: 实时监控 API 健康状态

---

*训练完成时间：2026-04-23 21:00*
