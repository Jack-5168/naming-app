# 🔌 专项训练 21:00 - API 设计高级实战 (v4)

**日期:** 2026-04-27  
**主题:** RESTful/GraphQL 高级设计原则 + 生产级 API + 完整文档  
**前置:** 4/22 基础版 / 4/23 进阶版 / 4/26 巩固版

---

## 一、API 设计决策框架

### 1.1 技术选型矩阵

| 维度 | REST | GraphQL | gRPC | WebSocket |
|------|------|---------|------|-----------|
| **适用场景** | 标准 CRUD / 公开 API | 复杂数据组合 / 移动端 | 内部微服务 / 高性能 | 实时通信 / 推送 |
| **缓存** | HTTP 原生缓存 ✅ | 需要自定义 ❌ | 不支持 ❌ | 不支持 ❌ |
| **版本管理** | URL 路径版本 | Schema 演进 | Protobuf 兼容 | 协议版本 |
| **学习曲线** | 低 | 中 | 高 | 中 |
| **工具链** | 成熟 (Swagger/Postman) | 成熟 (Apollo/GraphiQL) | 成熟 (protoc) | 成熟 (Socket.IO) |
| **带宽效率** | 中 (可能 over-fetch) | 高 (精确获取) | 高 (Protobuf 二进制) | 高 (双向) |
| **CDN 友好** | ✅ | ❌ | ❌ | ❌ |

### 1.2 REST vs GraphQL 混合架构

```
                    ┌─────────────┐
                    │   Client    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
        │  REST API  │ │GraphQL│ │ WebSocket │
        │  (公开端点) │ │ (聚合) │ │  (实时)   │
        └─────┬─────┘ └───┬───┘ └─────┬─────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────▼──────┐
                    │  BFF Layer  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
        ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
        │  User Svc │ │Order  │ │  Notify   │
        └───────────┘ └───────┘ └───────────┘
```

**选型策略:**
- 公开 API → REST (缓存友好、CDN 支持、简单)
- 前端聚合 → GraphQL (减少请求次数、灵活查询)
- 实时功能 → WebSocket (聊天/通知/协同)
- 内部服务 → gRPC (高性能、强类型)

---

## 二、RESTful 高级设计模式

### 2.1 幂等性设计 (Idempotency)

**问题:** 网络超时导致客户端重试，服务端可能重复处理。

```typescript
// 幂等键生成与验证
interface IdempotencyKey {
  key: string;        // 客户端生成的唯一键
  requestId: string;  // 服务端请求 ID
  method: string;     // HTTP 方法
  path: string;       // 请求路径
  statusCode: number; // 首次响应状态码
  responseBody: string; // 首次响应体 (JSON)
  createdAt: Date;
  expiresAt: Date;    // 24h 后过期
}

// Redis 存储幂等键
class IdempotencyManager {
  private redis: Redis;

  // 检查幂等键
  async check(key: string): Promise<IdempotencyKey | null> {
    const data = await this.redis.get(`idemp:${key}`);
    return data ? JSON.parse(data) : null;
  }

  // 锁定幂等键 (防止并发重复)
  async lock(key: string): Promise<boolean> {
    const acquired = await this.redis.set(
      `idemp:lock:${key}`,
      '1',
      'EX', 10,  // 10 秒锁
      'NX'       // 仅当不存在时设置
    );
    return acquired === 'OK';
  }

  // 保存首次响应
  async saveResponse(
    key: string,
    response: { statusCode: number; body: unknown }
  ): Promise<void> {
    await this.redis.set(
      `idemp:${key}`,
      JSON.stringify({
        ...response,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      }),
      'EX', 86400  // 24h TTL
    );
  }

  // 返回缓存的响应
  async getCachedResponse(key: string): Promise<{
    statusCode: number;
    body: unknown;
  } | null> {
    const data = await this.check(key);
    if (data) {
      return {
        statusCode: data.statusCode,
        body: JSON.parse(data.responseBody)
      };
    }
    return null;
  }
}

// Express 中间件
function idempotencyMiddleware(
  idempotency: IdempotencyManager
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 只对非幂等方法 (POST/PATCH) 生效
    if (!['POST', 'PATCH', 'PUT'].includes(req.method)) {
      return next();
    }

    const key = req.headers['x-idempotency-key'] as string;
    if (!key) return next();

    // 1. 检查是否已有缓存响应
    const cached = await idempotency.getCachedResponse(key);
    if (cached) {
      return res.status(cached.statusCode).json(cached.body);
    }

    // 2. 尝试锁定
    const locked = await idempotency.lock(key);
    if (!locked) {
      return res.status(409).json({
        error: {
          code: 'IDEMPOTENCY_KEY_IN_USE',
          message: '该幂等键正在处理中，请稍后重试'
        }
      });
    }

    // 3. 拦截 res.json 保存响应
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      idempotency.saveResponse(key, {
        statusCode: res.statusCode,
        body
      }).catch(console.error);
      return originalJson(body);
    };

    next();
  };
}
```

### 2.2 条件请求 (Conditional Requests)

```typescript
// ETag 生成 (基于内容哈希)
function generateETag(data: unknown): string {
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
  return `W/"${hash}"`;  // W/ 表示弱验证
}

// ETag 中间件
function etagMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      const etag = generateETag(body);
      res.setHeader('ETag', etag);

      // 检查 If-None-Match
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch && ifNoneMatch === etag) {
        return res.status(304).end();  // Not Modified
      }

      return originalJson(body);
    };

    next();
  };
}

// Last-Modified / If-Modified-Since
function lastModifiedMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = (body: { updatedAt?: string } & unknown) => {
      if (body?.updatedAt) {
        const lastModified = new Date(body.updatedAt).toUTCString();
        res.setHeader('Last-Modified', lastModified);

        const ifModifiedSince = req.headers['if-modified-since'];
        if (ifModifiedSince && new Date(ifModifiedSince) >= new Date(body.updatedAt)) {
          return res.status(304).end();
        }
      }

      return originalJson(body);
    };

    next();
  };
}
```

### 2.3 HATEOAS (Hypermedia as the Engine of Application State)

```typescript
// Hypermedia Link 生成器
interface HypermediaLink {
  rel: string;       // 关系类型
  href: string;      // URL
  method?: string;   // 推荐 HTTP 方法
  title?: string;    // 描述
}

function addLinks<T extends { id: string }>(
  resource: T,
  selfHref: string,
  links: HypermediaLink[]
): T & { _links: HypermediaLink[] } {
  return {
    ...resource,
    _links: [
      { rel: 'self', href: selfHref, method: 'GET', title: `查看 ${resource.id} 详情` },
      ...links
    ]
  };
}

// 使用示例
// GET /api/v1/orders/ord_123
{
  "id": "ord_123",
  "status": "pending",
  "total": 299.00,
  "items": [
    { "productId": "prod_456", "quantity": 2, "price": 149.50 }
  ],
  "createdAt": "2026-04-27T12:00:00Z",
  "_links": [
    { "rel": "self", "href": "/api/v1/orders/ord_123", "method": "GET" },
    { "rel": "update", "href": "/api/v1/orders/ord_123", "method": "PATCH", "title": "更新订单" },
    { "rel": "cancel", "href": "/api/v1/orders/ord_123/cancel", "method": "POST", "title": "取消订单" },
    { "rel": "pay", "href": "/api/v1/orders/ord_123/pay", "method": "POST", "title": "支付订单" },
    { "rel": "user", "href": "/api/v1/users/usr_789", "method": "GET", "title": "下单用户" },
    { "rel": "products", "href": "/api/v1/products?ids=prod_456", "method": "GET", "title": "订单商品" }
  ]
}

// 状态机驱动的链接 (根据订单状态动态生成)
function getOrderLinks(order: Order): HypermediaLink[] {
  const base = [
    { rel: 'self', href: `/api/v1/orders/${order.id}`, method: 'GET' }
  ];

  switch (order.status) {
    case 'pending':
      return [
        ...base,
        { rel: 'pay', href: `/api/v1/orders/${order.id}/pay`, method: 'POST' },
        { rel: 'cancel', href: `/api/v1/orders/${order.id}/cancel`, method: 'POST' }
      ];
    case 'paid':
      return [
        ...base,
        { rel: 'ship', href: `/api/v1/orders/${order.id}/ship`, method: 'POST' },
        { rel: 'refund', href: `/api/v1/orders/${order.id}/refund`, method: 'POST' }
      ];
    case 'shipped':
      return [
        ...base,
        { rel: 'confirm', href: `/api/v1/orders/${order.id}/confirm`, method: 'POST' },
        { rel: 'track', href: `/api/v1/orders/${order.id}/tracking`, method: 'GET' }
      ];
    case 'completed':
      return [
        ...base,
        { rel: 'review', href: `/api/v1/reviews`, method: 'POST', title: '评价订单' }
      ];
    default:
      return base;
  }
}
```

### 2.4 批量操作 (Batch Operations)

```typescript
// 方案 1: 批量端点 (推荐)
// POST /api/v1/users/batch
{
  "operations": [
    { "method": "POST", "path": "/api/v1/users", "body": { "name": "Alice", "email": "alice@example.com" } },
    { "method": "PATCH", "path": "/api/v1/users/usr_123", "body": { "name": "Bob Updated" } },
    { "method": "DELETE", "path": "/api/v1/users/usr_456" }
  ]
}

// 响应
{
  "results": [
    { "statusCode": 201, "body": { "id": "usr_789", "name": "Alice", ... } },
    { "statusCode": 200, "body": { "id": "usr_123", "name": "Bob Updated", ... } },
    { "statusCode": 204, "body": null }
  ],
  "meta": {
    "totalOperations": 3,
    "succeeded": 3,
    "failed": 0
  }
}

// 方案 2: multipart request (Google 风格)
// POST /batch
// Content-Type: multipart/mixed; boundary=batch_boundary

// --batch_boundary
// Content-Type: application/http
// Content-Transfer-Encoding: binary
//
// POST /api/v1/users
// Content-Type: application/json
//
// {"name": "Alice", "email": "alice@example.com"}
//
// --batch_boundary
// Content-Type: application/http
// Content-Transfer-Encoding: binary
//
// GET /api/v1/users/usr_123
//
// --batch_boundary--

// 方案 3: 批量查询 (GET)
// GET /api/v1/users?ids=usr_123,usr_456,usr_789
// GET /api/v1/products?skus=SKU001,SKU002,SKU003

// 批量操作实现
class BatchController {
  async executeBatch(req: Request, res: Response) {
    const { operations, options } = req.body;
    const results: BatchResult[] = [];

    // 原子性控制
    const atomic = options?.atomic ?? false;
    let hasFailed = false;

    for (const op of operations) {
      if (atomic && hasFailed) {
        results.push({
          statusCode: 412,
          body: { error: { code: 'BATCH_ABORTED', message: '原子模式，前置操作失败' } }
        });
        continue;
      }

      try {
        // 模拟内部请求
        const result = await this.executeOperation(op);
        results.push(result);
      } catch (err) {
        hasFailed = true;
        results.push({
          statusCode: err.statusCode || 500,
          body: { error: { code: err.code || 'INTERNAL_ERROR', message: err.message } }
        });
      }
    }

    // 原子模式：有失败则回滚
    if (atomic && hasFailed) {
      await this.rollback(operations, results);
    }

    res.status(200).json({
      results,
      meta: {
        totalOperations: operations.length,
        succeeded: results.filter(r => r.statusCode < 400).length,
        failed: results.filter(r => r.statusCode >= 400).length
      }
    });
  }
}
```

### 2.5 部分响应 (Partial Response / Fields Selection)

```typescript
// 字段选择中间件
function fieldSelectionMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const fields = req.query.fields as string;
    if (!fields) return next();

    const selectedFields = fields.split(',').map(f => f.trim());
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      if (Array.isArray(body)) {
        return originalJson(body.map(item => pickFields(item, selectedFields)));
      }
      return originalJson(pickFields(body, selectedFields));
    };

    next();
  };
}

function pickFields(obj: unknown, fields: string[]): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;

  const result: Record<string, unknown> = {};
  for (const field of fields) {
    // 支持嵌套字段: "user.name,posts.title"
    const parts = field.split('.');
    let current = obj as Record<string, unknown>;
    let target = result;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) {
        target[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
      target = target[parts[i]] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];
    if (current && lastPart in current) {
      target[lastPart] = current[lastPart];
    }
  }
  return result;
}

// 使用示例
// GET /api/v1/users?fields=id,name,email,role
// GET /api/v1/users?fields=id,name,profile.avatar,profile.bio
// GET /api/v1/posts?fields=id,title,author.name,author.avatar
```

### 2.6 速率限制高级策略

```typescript
interface RateLimitConfig {
  windowMs: number;      // 时间窗口 (ms)
  maxRequests: number;   // 最大请求数
  strategy: 'fixed' | 'sliding' | 'token-bucket' | 'leaky-bucket';
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  onLimitExceeded?: (req: Request, res: Response) => void;
}

// 滑动窗口算法 (比固定窗口更精确)
class SlidingWindowRateLimiter {
  private store: Map<string, number[]> = new Map();

  constructor(private config: RateLimitConfig) {}

  isAllowed(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // 获取当前窗口的请求时间戳
    let timestamps = this.store.get(key) || [];
    timestamps = timestamps.filter(t => t > windowStart);

    const remaining = Math.max(0, this.config.maxRequests - timestamps.length);
    const resetAt = timestamps.length > 0
      ? timestamps[0] + this.config.windowMs
      : now + this.config.windowMs;

    if (timestamps.length >= this.config.maxRequests) {
      return { allowed: false, remaining: 0, resetAt };
    }

    timestamps.push(now);
    this.store.set(key, timestamps);

    return { allowed: true, remaining: remaining - 1, resetAt };
  }

  // 定期清理过期数据
  cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.store.entries()) {
      const valid = timestamps.filter(t => t > now - this.config.windowMs);
      if (valid.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, valid);
      }
    }
  }
}

// Token Bucket 算法 (适合突发流量)
class TokenBucketRateLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();

  constructor(
    private capacity: number,    // 桶容量
    private refillRate: number   // 每秒填充速率
  ) {}

  isAllowed(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // 计算自上次填充以来的新增 tokens
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    return { allowed: false, remaining: 0 };
  }
}

// 分级速率限制 (不同用户等级不同限制)
const RATE_LIMITS = {
  free:    { windowMs: 60000, maxRequests: 60,  burst: 10 },   // 免费: 60/min, 突发 10
  pro:     { windowMs: 60000, maxRequests: 300, burst: 30 },   // 专业: 300/min, 突发 30
  enterprise: { windowMs: 60000, maxRequests: 1000, burst: 100 }, // 企业: 1000/min
  admin:   { windowMs: 60000, maxRequests: Infinity }           // 管理员: 无限制
};

// 速率限制中间件 (生产级)
function rateLimitMiddleware(config: RateLimitConfig) {
  const limiter = new SlidingWindowRateLimiter(config);

  // 定期清理
  setInterval(() => limiter.cleanup(), config.windowMs);

  return (req: Request, res: Response, next: NextFunction) => {
    if (config.skip?.(req)) return next();

    const key = config.keyGenerator?.(req) || req.ip || 'anonymous';
    const result = limiter.isAllowed(key);

    // 设置标准速率限制头
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000));
      config.onLimitExceeded?.(req, res);
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '请求过于频繁，请稍后重试',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000)
        }
      });
    }

    next();
  };
}
```

---

## 三、GraphQL 高级设计模式

### 3.1 DataLoader 深度优化

```typescript
// DataLoader 核心：批量 + 缓存
// 解决 N+1 查询问题

// 1. 基础 DataLoader
const userLoader = new DataLoader(async (userIds: readonly string[]) => {
  const users = await db.user.findMany({
    where: { id: { in: userIds as string[] } }
  });
  // 保持输入顺序
  return userIds.map(id => users.find(u => u.id === id) || null);
});

// 2. 带缓存键生成的 DataLoader
const postLoader = new DataLoader(
  async (postIds: readonly string[]) => {
    const posts = await db.post.findMany({
      where: { id: { in: postIds as string[] } }
    });
    return postIds.map(id => posts.find(p => p.id === id) || null);
  },
  {
    cacheKeyFn: (id: string) => id,
    maxBatchSize: 100,  // 单次批量最大 100 条
    cacheMap: new Map() // 自定义缓存实现
  }
);

// 3. 请求级别的 DataLoader (每个请求新建，避免缓存污染)
function createLoaders() {
  return {
    userLoader: new DataLoader(async (ids) => {
      const users = await db.user.findMany({ where: { id: { in: ids as string[] } } });
      return ids.map(id => users.find(u => u.id === id) || null);
    }),
    postLoader: new DataLoader(async (ids) => {
      const posts = await db.post.findMany({ where: { id: { in: ids as string[] } } });
      return ids.map(id => posts.find(p => p.id === id) || null);
    }),
    commentLoader: new DataLoader(async (postIds) => {
      const comments = await db.comment.findMany({
        where: { postId: { in: postIds as string[] } }
      });
      return postIds.map(id => comments.filter(c => c.postId === id));
    }),
    categoryLoader: new DataLoader(async (ids) => {
      const categories = await db.category.findMany({ where: { id: { in: ids as string[] } } });
      return ids.map(id => categories.find(c => c.id === id) || null);
    })
  };
}

// Apollo Server 集成
const server = new ApolloServer({
  resolvers,
  context: () => ({
    loaders: createLoaders(),  // 每个请求创建新的 DataLoader 实例
    db
  })
});

// Resolver 中使用
const resolvers = {
  Post: {
    author: async (post, _, { loaders }) => {
      return loaders.userLoader.load(post.authorId);  // 自动批量
    },
    comments: async (post, _, { loaders }) => {
      return loaders.commentLoader.load(post.id);  // 一对多也支持
    },
    category: async (post, _, { loaders }) => {
      return loaders.categoryLoader.load(post.categoryId);
    }
  },
  Query: {
    posts: async (_, { filter, pagination }, { loaders, db }) => {
      const posts = await db.post.findMany({
        where: filter,
        skip: pagination?.offset,
        take: pagination?.limit
      });
      return posts;
      // 注意：这里不预加载关联数据
      // 由 Post resolver 按需通过 DataLoader 加载
    }
  }
};
```

### 3.2 Federation (微服务 Schema 组合)

```graphql
# === 用户服务 (User Service) ===
# 暴露 User 实体供其他服务引用

extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0",
        import: ["@key", "@external", "@provides", "@requires"])

type User @key(fields: "id") {
  id: ID!
  email: String!
  name: String!
  avatar: String
}

type Query {
  user(id: ID!): User
}

# === 订单服务 (Order Service) ===
# 引用 User 实体并扩展字段

extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0",
        import: ["@key", "@external", "@provides", "@requires"])

type Order @key(fields: "id") {
  id: ID!
  total: Float!
  status: OrderStatus!
  # 引用用户服务的 User 实体
  user: User!
}

# 扩展 User 实体，添加订单统计
extend type User @key(fields: "id") {
  id: ID! @external
  orderCount: Int!
  totalSpent: Float!
}

type Query {
  order(id: ID!): Order
  orders(userId: ID!, status: OrderStatus): [Order!]!
}

# === 产品评论服务 (Review Service) ===
# 跨服务数据组合

type Review @key(fields: "id") {
  id: ID!
  rating: Int!
  content: String!
  product: Product!
  user: User!
}

# 扩展 Product (来自产品服务)
extend type Product @key(fields: "id") {
  id: ID! @external
  reviews: [Review!]!
  averageRating: Float!
  reviewCount: Int!
}

# 扩展 User (来自用户服务)
extend type User @key(fields: "id") {
  id: ID! @external
  reviews: [Review!]!
}
```

### 3.3 GraphQL 安全策略

```typescript
// 1. 查询深度限制
const depthLimit = depthLimitRule(10);  // 最大深度 10 层

// 2. 查询复杂度分析
const complexityAnalysis = validationRules.complexityAnalysis({
  maximumComplexity: 1000,
  estimators: [
    // 字段复杂度估算
    fieldExtensionsEstimator(),
    // 默认复杂度
    simpleEstimator({ defaultComplexity: 1 })
  ],
  onComplete: (complexity) => {
    console.log(`Query complexity: ${complexity}`);
    if (complexity > 800) {
      // 记录高复杂度查询
      metrics.record('graphql.complexity.high', complexity);
    }
  }
});

// 3. 查询阻止 (Blocklist)
const blocklist = blockedQueriesRule([
  {
    name: 'no-mutation-with-all-args',
    description: '禁止不带过滤条件的批量更新',
    match: (operation) => {
      return operation.selectionSet?.some(
        s => s.kind === 'Field' &&
             s.name.value.startsWith('update') &&
             !s.arguments?.some(a => a.name.value === 'where')
      );
    }
  }
]);

// 4. 速率限制 (基于查询复杂度)
const graphqlRateLimit = graphqlRateLimit({
  identifyContext: (ctx) => ctx.user?.id || ctx.ip,
  window: 60000,
  max: 100,  // 每分钟最多 100 次查询
  message: (identifyContext, window) =>
    `Too many requests. ${identifyContext} limited to ${max} per ${window}ms.`
});

// 5. 权限指令
const schemaWithAuth = makeExecutableSchema({
  typeDefs: [
    `
    directive @auth(requires: Role!) on FIELD_DEFINITION
    
    enum Role {
      ADMIN
      USER
      GUEST
    }
    
    type User @auth(requires: ADMIN) {
      id: ID!
      email: String!
      ssn: String @auth(requires: ADMIN)  # 仅管理员可见
    }
    `,
    ...baseTypeDefs
  ],
  resolvers
});

// Auth 指令实现
const authDirectiveVisitor = {
  Field: (node, _key, parent, args, contextInfo) => {
    const requires = node.directives.find(d => d.name.value === 'auth')
      ?.arguments?.find(a => a.name.value === 'requires')?.value?.value;

    if (requires) {
      const originalResolve = node.resolve;
      node.resolve = (source, args, context, info) => {
        if (!context.user) {
          throw new AuthenticationError('Not authenticated');
        }
        if (context.user.role !== requires && context.user.role !== 'ADMIN') {
          throw new ForbiddenError(`Requires ${requires} role`);
        }
        return originalResolve?.(source, args, context, info);
      };
    }
  }
};
```

---

## 四、Webhook 设计

### 4.1 Webhook 完整实现

```typescript
// Webhook 事件类型定义
type WebhookEvent =
  | { type: 'order.created'; data: Order }
  | { type: 'order.paid'; data: Order }
  | { type: 'order.shipped'; data: Order & { trackingNumber: string } }
  | { type: 'order.delivered'; data: Order }
  | { type: 'order.refunded'; data: Order & { refundAmount: number } }
  | { type: 'user.created'; data: User }
  | { type: 'user.deleted'; data: { userId: string } };

// Webhook 订阅模型
interface WebhookSubscription {
  id: string;
  url: string;                    // 回调 URL
  events: string[];               // 订阅的事件类型
  secret: string;                 // 签名密钥
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  // 失败重试统计
  failureCount: number;
  lastFailedAt: Date | null;
  lastFailureReason: string | null;
}

// Webhook 投递记录
interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  event: WebhookEvent;
  url: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  attemptCount: number;
  maxAttempts: number;
  requestHeaders: Record<string, string>;
  requestBody: string;
  responseStatus: number | null;
  responseBody: string | null;
  responseHeaders: Record<string, string>;
  createdAt: Date;
  completedAt: Date | null;
  nextRetryAt: Date | null;
}

// Webhook 签名生成
class WebhookSignature {
  // 生成签名
  static sign(payload: string, secret: string): string {
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    return `sha256=${signature}`;
  }

  // 验证签名
  static verify(payload: string, signature: string, secret: string): boolean {
    const expected = this.sign(payload, secret);
    // 常量时间比较 (防止时序攻击)
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }
}

// Webhook 投递器
class WebhookDispatcher {
  private queue: BullQueue;

  constructor(private db: Database) {
    // 使用 Bull 队列处理异步投递
    this.queue = new BullQueue('webhook-delivery', {
      redis: { host: 'localhost', port: 6379 }
    });

    // 处理投递任务
    this.queue.process('deliver', 10, async (job) => {
      const { deliveryId } = job.data;
      await this.deliver(deliveryId);
    });

    // 重试失败的任务
    this.queue.process('retry', 5, async (job) => {
      const { deliveryId } = job.data;
      await this.deliver(deliveryId, true);
    });
  }

  // 触发 Webhook 事件
  async dispatch(event: WebhookEvent): Promise<void> {
    // 查找所有订阅该事件的 Webhook
    const subscriptions = await this.db.webhookSubscription.findMany({
      where: {
        active: true,
        events: { has: event.type },
        OR: [
          { failureCount: { lt: 5 } },  // 失败次数 < 5
          { lastFailedAt: { lt: new Date(Date.now() - 3600000) } }  // 或上次失败 > 1h 前
        ]
      }
    });

    for (const sub of subscriptions) {
      const delivery = await this.db.webhookDelivery.create({
        subscriptionId: sub.id,
        event,
        url: sub.url,
        status: 'pending',
        attemptCount: 0,
        maxAttempts: 5,
        requestHeaders: {},
        requestBody: '',
        responseStatus: null,
        responseBody: null,
        responseHeaders: {},
        createdAt: new Date(),
        completedAt: null,
        nextRetryAt: null
      });

      // 加入队列 (延迟 0 = 立即执行)
      await this.queue.add('deliver', { deliveryId: delivery.id });
    }
  }

  // 执行投递
  private async deliver(deliveryId: string, isRetry = false): Promise<void> {
    const delivery = await this.db.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { subscription: true }
    });

    if (!delivery || delivery.status === 'cancelled') return;

    const subscription = delivery.subscription;
    const payload = JSON.stringify({
      id: delivery.id,
      type: delivery.event.type,
      timestamp: new Date().toISOString(),
      data: delivery.event.data
    });

    const signature = WebhookSignature.sign(payload, subscription.secret);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': timestamp,
      'X-Webhook-Event': delivery.event.type,
      'X-Webhook-Id': delivery.id,
      'User-Agent': 'MyApp-Webhooks/1.0'
    };

    delivery.requestHeaders = headers;
    delivery.requestBody = payload;
    delivery.attemptCount += 1;

    try {
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000)  // 10s 超时
      });

      const responseBody = await response.text();

      delivery.responseStatus = response.status;
      delivery.responseBody = responseBody;
      delivery.responseHeaders = Object.fromEntries(response.headers.entries());
      delivery.completedAt = new Date();

      if (response.status >= 200 && response.status < 300) {
        delivery.status = 'success';
        subscription.failureCount = 0;
        subscription.lastFailedAt = null;
        subscription.lastFailureReason = null;
      } else {
        throw new Error(`HTTP ${response.status}: ${responseBody}`);
      }
    } catch (err) {
      delivery.status = 'failed';
      delivery.lastFailureReason = err.message;
      subscription.failureCount += 1;
      subscription.lastFailedAt = new Date();
      subscription.lastFailureReason = err.message;

      // 指数退避重试
      if (delivery.attemptCount < delivery.maxAttempts) {
        const backoffMs = Math.min(1000 * Math.pow(2, delivery.attemptCount), 3600000);
        delivery.nextRetryAt = new Date(Date.now() + backoffMs);

        await this.queue.add(
          'retry',
          { deliveryId },
          { delay: backoffMs }
        );
      } else {
        delivery.status = 'failed';
        delivery.completedAt = new Date();
        subscription.active = false;  // 超过最大重试次数，禁用
      }
    }

    await this.db.webhookDelivery.update({
      where: { id: deliveryId },
      data: delivery
    });
    await this.db.webhookSubscription.update({
      where: { id: subscription.id },
      data: subscription
    });
  }
}
```

### 4.2 Webhook 管理 API

```
# 创建 Webhook 订阅
POST /api/v1/webhooks
{
  "url": "https://myapp.com/hooks/order-updates",
  "events": ["order.created", "order.paid", "order.shipped"],
  "secret": "whsec_xxx"  // 服务端自动生成
}

# 列出所有 Webhook 订阅
GET /api/v1/webhooks?page=1&limit=20

# 查看 Webhook 详情
GET /api/v1/webhooks/wh_123

# 更新 Webhook 订阅
PATCH /api/v1/webhooks/wh_123
{
  "events": ["order.created", "order.paid", "order.shipped", "order.delivered"],
  "active": true
}

# 重新生成签名密钥
POST /api/v1/webhooks/wh_123/regenerate-secret

# 删除 Webhook 订阅
DELETE /api/v1/webhooks/wh_123

# 查看投递历史
GET /api/v1/webhooks/wh_123/deliveries?status=failed&page=1

# 查看单次投递详情
GET /api/v1/webhooks/deliveries/dlv_456

# 重投失败的 Webhook
POST /api/v1/webhooks/deliveries/dlv_456/retry

# 重投某个订阅的所有失败投递
POST /api/v1/webhooks/wh_123/retry-failed
```

---

## 五、OpenAPI 3.1 完整文档

### 5.1 API 设计: CloudBoard 协作白板平台

```yaml
openapi: 3.1.0
info:
  title: CloudBoard API
  description: |
    CloudBoard 协作白板平台 RESTful API。
    
    支持的功能:
    - 白板 CRUD + 协作编辑
    - 元素管理 (形状/文本/图片/便签)
    - 实时协作 (WebSocket + REST 回退)
    - 版本历史与回滚
    - 权限管理
    - 导出 (PNG/SVG/PDF)
  version: 1.0.0
  contact:
    name: CloudBoard API Team
    email: api@cloudboard.io
  license:
    name: MIT

servers:
  - url: https://api.cloudboard.io/v1
    description: 生产环境
  - url: https://staging-api.cloudboard.io/v1
    description: 测试环境
  - url: http://localhost:3000/v1
    description: 本地开发

tags:
  - name: Authentication
    description: 认证相关
  - name: Boards
    description: 白板管理
  - name: Elements
    description: 白板元素
  - name: Collaboration
    description: 协作与会话
  - name: Versions
    description: 版本历史
  - name: Export
    description: 导出功能
  - name: Users
    description: 用户管理

paths:
  # ==================== 认证 ====================
  /auth/register:
    post:
      tags: [Authentication]
      summary: 用户注册
      operationId: register
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
            example:
              email: user@example.com
              password: Str0ngP@ss!
              name: 张三
      responses:
        '201':
          description: 注册成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '409':
          description: 邮箱已存在
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /auth/login:
    post:
      tags: [Authentication]
      summary: 用户登录
      operationId: login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
            example:
              email: user@example.com
              password: Str0ngP@ss!
      responses:
        '200':
          description: 登录成功
          headers:
            X-RateLimit-Limit:
              schema: { type: integer }
            X-RateLimit-Remaining:
              schema: { type: integer }
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '401':
          description: 认证失败
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /auth/refresh:
    post:
      tags: [Authentication]
      summary: 刷新 Token
      operationId: refreshToken
      security: [{ BearerAuth: [] }]
      responses:
        '200':
          description: Token 刷新成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'

  /auth/logout:
    post:
      tags: [Authentication]
      summary: 退出登录
      operationId: logout
      security: [{ BearerAuth: [] }]
      responses:
        '204':
          description: 退出成功

  # ==================== 白板 ====================
  /boards:
    get:
      tags: [Boards]
      summary: 获取用户白板列表
      operationId: listBoards
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/PageParam'
        - $ref: '#/components/parameters/LimitParam'
        - $ref: '#/components/parameters/SortParam'
        - $ref: '#/components/parameters/SearchParam'
        - name: shared
          in: query
          description: 是否只列出共享白板
          schema: { type: boolean }
        - name: archived
          in: query
          description: 是否包含已归档白板
          schema: { type: boolean }
          default: false
      responses:
        '200':
          description: 白板列表
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BoardListResponse'

    post:
      tags: [Boards]
      summary: 创建白板
      operationId: createBoard
      security: [{ BearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateBoardRequest'
            example:
              name: 产品需求讨论
              description: Q2 产品需求脑暴
              background: '#f8f9fa'
              template: blank
      responses:
        '201':
          description: 创建成功
          headers:
            Location:
              schema: { type: string }
              description: 新创建白板的 URL
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BoardResponse'

  /boards/{boardId}:
    get:
      tags: [Boards]
      summary: 获取白板详情
      operationId: getBoard
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
        - $ref: '#/components/parameters/FieldsParam'
      responses:
        '200':
          description: 白板详情
          headers:
            ETag:
              schema: { type: string }
            Cache-Control:
              schema: { type: string }
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BoardDetailResponse'
        '404':
          description: 白板不存在

    patch:
      tags: [Boards]
      summary: 更新白板
      operationId: updateBoard
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateBoardRequest'
            example:
              name: 产品需求讨论 (已更新)
              description: 更新后的描述
      responses:
        '200':
          description: 更新成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BoardResponse'

    delete:
      tags: [Boards]
      summary: 删除白板 (软删除)
      operationId: deleteBoard
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
      responses:
        '204':
          description: 删除成功

  /boards/{boardId}/duplicate:
    post:
      tags: [Boards]
      summary: 复制白板
      operationId: duplicateBoard
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                  description: 新白板名称 (可选，默认追加 "副本")
      responses:
        '201':
          description: 复制成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BoardResponse'

  /boards/{boardId}/archive:
    post:
      tags: [Boards]
      summary: 归档白板
      operationId: archiveBoard
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
      responses:
        '200':
          description: 归档成功

  /boards/{boardId}/unarchive:
    post:
      tags: [Boards]
      summary: 取消归档
      operationId: unarchiveBoard
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
      responses:
        '200':
          description: 取消归档成功

  # ==================== 元素 ====================
  /boards/{boardId}/elements:
    get:
      tags: [Elements]
      summary: 获取白板所有元素
      operationId: listElements
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
        - name: type
          in: query
          description: 按类型过滤
          schema:
            $ref: '#/components/schemas/ElementType'
        - name: layer
          in: query
          description: 按图层过滤
          schema: { type: string }
        - name: bounds
          in: query
          description: 按边界框过滤 (x1,y1,x2,y2)
          schema: { type: string }
      responses:
        '200':
          description: 元素列表
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ElementListResponse'

    post:
      tags: [Elements]
      summary: 创建元素
      operationId: createElement
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateElementRequest'
      responses:
        '201':
          description: 创建成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ElementResponse'

  /boards/{boardId}/elements/batch:
    post:
      tags: [Elements]
      summary: 批量创建元素
      operationId: batchCreateElements
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                elements:
                  type: array
                  items:
                    $ref: '#/components/schemas/CreateElementRequest'
                  maxItems: 100
      responses:
        '201':
          description: 批量创建成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BatchElementResponse'

  /boards/{boardId}/elements/{elementId}:
    get:
      tags: [Elements]
      summary: 获取元素详情
      operationId: getElement
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
        - name: elementId
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          description: 元素详情
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ElementResponse'

    patch:
      tags: [Elements]
      summary: 更新元素
      operationId: updateElement
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
        - name: elementId
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateElementRequest'
      responses:
        '200':
          description: 更新成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ElementResponse'

    delete:
      tags: [Elements]
      summary: 删除元素
      operationId: deleteElement
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
        - name: elementId
          in: path
          required: true
          schema: { type: string }
      responses:
        '204':
          description: 删除成功

  # ==================== 协作 ====================
  /boards/{boardId}/collaborators:
    get:
      tags: [Collaboration]
      summary: 获取协作者列表
      operationId: listCollaborators
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
      responses:
        '200':
          description: 协作者列表
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CollaboratorListResponse'

    post:
      tags: [Collaboration]
      summary: 添加协作者
      operationId: addCollaborator
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AddCollaboratorRequest'
      responses:
        '201':
          description: 添加成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CollaboratorResponse'

  /boards/{boardId}/collaborators/{userId}:
    delete:
      tags: [Collaboration]
      summary: 移除协作者
      operationId: removeCollaborator
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
        - name: userId
          in: path
          required: true
          schema: { type: string }
      responses:
        '204':
          description: 移除成功

    patch:
      tags: [Collaboration]
      summary: 更新协作者权限
      operationId: updateCollaborator
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
        - name: userId
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                role:
                  $ref: '#/components/schemas/CollaboratorRole'
      responses:
        '200':
          description: 更新成功

  /boards/{boardId}/presence:
    get:
      tags: [Collaboration]
      summary: 获取在线用户
      operationId: getPresence
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
      responses:
        '200':
          description: 在线用户列表
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PresenceResponse'

  # ==================== 版本历史 ====================
  /boards/{boardId}/versions:
    get:
      tags: [Versions]
      summary: 获取版本历史
      operationId: listVersions
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
        - $ref: '#/components/parameters/PageParam'
        - $ref: '#/components/parameters/LimitParam'
      responses:
        '200':
          description: 版本列表
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VersionListResponse'

  /boards/{boardId}/versions/{versionId}:
    get:
      tags: [Versions]
      summary: 获取版本详情
      operationId: getVersion
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
        - name: versionId
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          description: 版本详情
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VersionDetailResponse'

    post:
      tags: [Versions]
      summary: 回滚到指定版本
      operationId: rollbackToVersion
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
        - name: versionId
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          description: 回滚成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BoardResponse'

  # ==================== 导出 ====================
  /boards/{boardId}/export:
    post:
      tags: [Export]
      summary: 导出白板
      operationId: exportBoard
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/BoardIdParam'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ExportRequest'
      responses:
        '200':
          description: 导出成功
          content:
            image/png:
              schema:
                type: string
                format: binary
            image/svg+xml:
              schema:
                type: string
            application/pdf:
              schema:
                type: string
                format: binary
            application/json:
              schema:
                $ref: '#/components/schemas/ExportResponse'

  # ==================== 用户 ====================
  /users/me:
    get:
      tags: [Users]
      summary: 获取当前用户信息
      operationId: getMe
      security: [{ BearerAuth: [] }]
      responses:
        '200':
          description: 用户信息
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'

    patch:
      tags: [Users]
      summary: 更新当前用户信息
      operationId: updateMe
      security: [{ BearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateUserRequest'
      responses:
        '200':
          description: 更新成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'

  /users/me/avatar:
    put:
      tags: [Users]
      summary: 上传头像
      operationId: uploadAvatar
      security: [{ BearerAuth: [] }]
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                  description: 图片文件 (JPG/PNG/WebP, 最大 5MB)
      responses:
        '200':
          description: 上传成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  url:
                    type: string
                    format: uri

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT Token (从 /auth/login 获取)

  parameters:
    BoardIdParam:
      name: boardId
      in: path
      required: true
      schema: { type: string, pattern: '^brd_[a-zA-Z0-9]+$' }
      description: 白板 ID (格式: brd_xxx)

    PageParam:
      name: page
      in: query
      schema: { type: integer, minimum: 1, default: 1 }
      description: 页码 (从 1 开始)

    LimitParam:
      name: limit
      in: query
      schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
      description: 每页数量 (1-100)

    SortParam:
      name: sort
      in: query
      schema: { type: string, enum: [createdAt, updatedAt, name, elementCount] }
      description: 排序字段

    SearchParam:
      name: search
      in: query
      schema: { type: string, maxLength: 100 }
      description: 搜索关键词 (匹配名称和描述)

    FieldsParam:
      name: fields
      in: query
      schema: { type: string }
      description: 返回字段 (逗号分隔, 如: id,name,owner,elementCount)

  schemas:
    # ==================== 通用 ====================
    Error:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message]
          properties:
            code:
              type: string
              description: 错误码
              example: VALIDATION_ERROR
            message:
              type: string
              description: 错误描述
              example: 请求参数验证失败
            details:
              type: array
              items:
                type: object
                properties:
                  field:
                    type: string
                  message:
                    type: string
              description: 字段级错误详情
        meta:
          $ref: '#/components/schemas/Meta'

    Meta:
      type: object
      properties:
        requestId:
          type: string
          description: 请求 ID (用于问题追踪)
        timestamp:
          type: string
          format: date-time
        serverVersion:
          type: string

    Pagination:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        totalPages:
          type: integer
        hasNext:
          type: boolean
        hasPrev:
          type: boolean

    # ==================== 认证 ====================
    RegisterRequest:
      type: object
      required: [email, password, name]
      properties:
        email:
          type: string
          format: email
          maxLength: 255
        password:
          type: string
          minLength: 8
          maxLength: 128
          pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$'
          description: 至少 8 位，包含大小写字母和数字
        name:
          type: string
          minLength: 1
          maxLength: 50

    LoginRequest:
      type: object
      required: [email, password]
      properties:
        email:
          type: string
          format: email
        password:
          type: string

    AuthResponse:
      type: object
      properties:
        accessToken:
          type: string
          description: JWT 访问令牌 (有效期 15 分钟)
        refreshToken:
          type: string
          description: 刷新令牌 (有效期 7 天)
        tokenType:
          type: string
          enum: [Bearer]
        expiresIn:
          type: integer
          description: 访问令牌剩余有效时间 (秒)
        user:
          $ref: '#/components/schemas/UserResponse'

    # ==================== 用户 ====================
    UserResponse:
      type: object
      properties:
        id:
          type: string
          pattern: '^usr_[a-zA-Z0-9]+$'
        email:
          type: string
          format: email
        name:
          type: string
        avatar:
          type: string
          format: uri
          nullable: true
        role:
          type: string
          enum: [admin, user]
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    UpdateUserRequest:
      type: object
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 50
        avatar:
          type: string
          format: uri

    # ==================== 白板 ====================
    Board:
      type: object
      properties:
        id:
          type: string
          pattern: '^brd_[a-zA-Z0-9]+$'
        name:
          type: string
          minLength: 1
          maxLength<think>

This is the 4th iteration of API design training. Let me create a comprehensive v4 that builds on previous versions with production-level advanced patterns.
</think>

Let me check what was already covered in the 3 previous API design training sessions to make this v4 meaningfully different.
