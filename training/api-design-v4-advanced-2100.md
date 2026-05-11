# 🔌 专项训练 21:00 - API 设计 v4：生产级高级模式

**日期:** 2026-04-27  
**前置:** 4/22 基础版 / 4/23 进阶版 / 4/26 巩固版  
**本次重点:** 生产级高级模式 + 复杂业务 API 设计 + 完整 OpenAPI 文档

---

## 一、API 版本演进策略

### 1.1 版本控制方案对比

| 方案 | 示例 | 优点 | 缺点 |
|------|------|------|------|
| **URL Path** | `/api/v1/users` | 最直观、CDN 友好、缓存友好 | 版本膨胀、URL 冗长 |
| **Header** | `Accept: application/vnd.api.v1+json` | URL 干净 | 调试困难、缓存复杂 |
| **Query Param** | `/users?version=1` | 灵活 | 不推荐、SEO 不友好 |
| **Schema 演进** (GraphQL) | 向后兼容添加字段 | 无需版本 | 破坏性变更仍需策略 |

### 1.2 向后兼容的 Schema 演进规则

```typescript
// ✅ 安全变更（不需要新版本）
// 1. 添加可选字段
interface UserV1 {
  id: string;
  name: string;
  email: string;
}

interface UserV1_Extended {
  id: string;
  name: string;
  email: string;
  phone?: string;        // ✅ 新增可选字段
  avatar?: string;       // ✅ 新增可选字段
}

// 2. 添加新的枚举值
enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',   // ✅ 新增
  RETURNED = 'returned'    // ✅ 新增
}

// 3. 放宽验证规则
// 之前: 用户名 3-20 字符
// 现在: 用户名 2-50 字符  ✅ 放宽限制

// ❌ 破坏性变更（需要新版本）
// 1. 删除字段
// 2. 修改字段类型 (string → number)
// 3. 修改字段语义 (status: 'active' → status: true)
// 4. 移除枚举值
// 5. 修改 URL 路径
// 6. 修改 HTTP 状态码含义

// 灰度发布策略
class VersionMiddleware {
  async handle(req: Request, res: Response, next: NextFunction) {
    const version = req.path.split('/')[3]; // /api/v1/...

    // v1 路由
    if (version === 'v1') {
      return this.v1Router.handle(req, res, next);
    }

    // v2 路由
    if (version === 'v2') {
      return this.v2Router.handle(req, res, next);
    }

    // 默认使用最新版本
    return this.v2Router.handle(req, res, next);
  }
}

// Deprecation Header 通知客户端
function deprecationHeader(version: string, sunsetDate: Date) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate.toUTCString());
    res.setHeader(
      'Link',
      `<https://docs.api.com/migration/${version}-to-latest>; rel="deprecation"`
    );
    next();
  };
}
```

---

## 二、RESTful 高级模式

### 2.1 幂等性 (Idempotency)

**问题:** 网络超时导致客户端重试，服务端可能重复处理。

```typescript
// 幂等键管理
class IdempotencyManager {
  constructor(private redis: Redis) {}

  async check(key: string): Promise<{
    exists: boolean;
    statusCode?: number;
    body?: unknown;
  } | null> {
    const cached = await this.redis.get(`idem:${key}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { exists: true, statusCode: parsed.status, body: parsed.body };
    }
    return null;
  }

  async lock(key: string): Promise<boolean> {
    // SETNX + EXPIRE 原子操作
    const result = await this.redis.set(
      `idem:lock:${key}`,
      '1',
      'EX', 10,  // 10s 锁
      'NX'       // 仅不存在时设置
    );
    return result === 'OK';
  }

  async save(key: string, statusCode: number, body: unknown): Promise<void> {
    await this.redis.set(
      `idem:${key}`,
      JSON.stringify({ status: statusCode, body, ts: Date.now() }),
      'EX', 86400  // 24h 缓存
    );
  }
}

// Express 中间件
function idempotencyMiddleware(manager: IdempotencyManager) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 仅对非幂等方法生效
    if (!['POST', 'PATCH', 'PUT'].includes(req.method)) return next();

    const key = req.headers['x-idempotency-key'] as string;
    if (!key) return next();

    // 1. 检查缓存响应
    const cached = await manager.check(key);
    if (cached?.exists) {
      return res.status(cached.statusCode!).json(cached.body);
    }

    // 2. 尝试获取锁
    const locked = await manager.lock(key);
    if (!locked) {
      return res.status(409).json({
        error: { code: 'IDEMPOTENCY_KEY_IN_USE', message: '请求正在处理中' }
      });
    }

    // 3. 拦截 res.json 保存响应
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      manager.save(key, res.statusCode, body).catch(console.error);
      return originalJson(body);
    };

    next();
  };
}
```

### 2.2 条件请求 (Conditional Requests)

```typescript
// ETag 生成
function generateETag(data: unknown): string {
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
    .slice(0, 16);
  return `W/"${hash}"`;  // W/ 弱验证
}

// ETag 中间件
function etagMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      const etag = generateETag(body);
      res.setHeader('ETag', etag);

      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch === etag) {
        return res.status(304).end();  // Not Modified
      }

      return originalJson(body);
    };

    next();
  };
}

// Last-Modified 中间件
function lastModifiedMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = (body: { updatedAt?: string } & Record<string, unknown>) => {
      if (body?.updatedAt) {
        const lm = new Date(body.updatedAt).toUTCString();
        res.setHeader('Last-Modified', lm);

        const ifModifiedSince = req.headers['if-modified-since'];
        if (ifModifiedSince && new Date(ifModifiedSince) >= new Date(body.updatedAt!)) {
          return res.status(304).end();
        }
      }

      return originalJson(body);
    };

    next();
  };
}
```

### 2.3 HATEOAS (超媒体驱动)

```typescript
// 根据资源状态动态生成可用操作链接
interface HATEOASLink {
  rel: string;
  href: string;
  method?: string;
  title?: string;
}

function orderLinks(order: Order): HATEOASLink[] {
  const base = [
    { rel: 'self', href: `/api/v1/orders/${order.id}`, method: 'GET' },
    { rel: 'user', href: `/api/v1/users/${order.userId}`, method: 'GET' }
  ];

  // 状态机驱动：不同状态暴露不同操作
  switch (order.status) {
    case 'pending':
      return [
        ...base,
        { rel: 'pay', href: `/api/v1/orders/${order.id}/pay`, method: 'POST', title: '支付订单' },
        { rel: 'cancel', href: `/api/v1/orders/${order.id}/cancel`, method: 'POST', title: '取消订单' }
      ];
    case 'paid':
      return [
        ...base,
        { rel: 'ship', href: `/api/v1/orders/${order.id}/ship`, method: 'POST', title: '发货' },
        { rel: 'refund', href: `/api/v1/orders/${order.id}/refund`, method: 'POST', title: '申请退款' }
      ];
    case 'shipped':
      return [
        ...base,
        { rel: 'confirm', href: `/api/v1/orders/${order.id}/confirm`, method: 'POST', title: '确认收货' },
        { rel: 'track', href: `/api/v1/orders/${order.id}/tracking`, method: 'GET', title: '物流追踪' }
      ];
    case 'completed':
      return [
        ...base,
        { rel: 'review', href: `/api/v1/orders/${order.id}/review`, method: 'POST', title: '评价订单' }
      ];
    default:
      return base;  // cancelled/refunded 无操作
  }
}

// 响应示例
// GET /api/v1/orders/ord_123
{
  "id": "ord_123",
  "status": "pending",
  "total": 299.00,
  "items": [...],
  "_links": [
    { "rel": "self", "href": "/api/v1/orders/ord_123", "method": "GET" },
    { "rel": "pay", "href": "/api/v1/orders/ord_123/pay", "method": "POST", "title": "支付订单" },
    { "rel": "cancel", "href": "/api/v1/orders/ord_123/cancel", "method": "POST", "title": "取消订单" },
    { "rel": "user", "href": "/api/v1/users/usr_456", "method": "GET" }
  ]
}
```

### 2.4 批量操作 (Batch Operations)

```typescript
// 方案 1: 批量端点 (Stripe 风格)
// POST /api/v1/customers/batch
{
  "operations": [
    { "method": "POST", "path": "/api/v1/customers", "body": { "name": "Alice", "email": "a@x.com" } },
    { "method": "PATCH", "path": "/api/v1/customers/cus_123", "body": { "name": "Alice Updated" } },
    { "method": "DELETE", "path": "/api/v1/customers/cus_456" }
  ],
  "options": { "atomic": false }  // 非原子：部分成功也返回
}

// 响应
{
  "results": [
    { "status": 201, "body": { "id": "cus_789", "name": "Alice" } },
    { "status": 200, "body": { "id": "cus_123", "name": "Alice Updated" } },
    { "status": 204, "body": null }
  ],
  "meta": { "total": 3, "succeeded": 3, "failed": 0 }
}

// 方案 2: 批量查询 (Google 风格)
// GET /api/v1/products?ids=prod_1,prod_2,prod_3
// GET /api/v1/users?emails=a@x.com,b@x.com

// 方案 3: multipart request (Google Batch API 风格)
// POST /batch
// Content-Type: multipart/mixed; boundary=batch_123
//
// --batch_123
// Content-Type: application/http
// Content-Transfer-Encoding: binary
//
// POST /api/v1/users
// Content-Type: application/json
//
// {"name": "Alice"}
//
// --batch_123
// Content-Type: application/http
//
// GET /api/v1/users/usr_123
//
// --batch_123--
```

### 2.5 高级速率限制

```typescript
// 分级速率限制 (不同用户等级不同限制)
const RATE_LIMITS = {
  anonymous: { windowMs: 60_000, max: 20,   burst: 5 },
  free:      { windowMs: 60_000, max: 60,   burst: 10 },
  pro:       { windowMs: 60_000, max: 300,  burst: 50 },
  enterprise:{ windowMs: 60_000, max: 1000, burst: 200 },
  internal:  { windowMs: 60_000, max: Infinity }
};

// 滑动窗口算法
class SlidingWindowLimiter {
  private store = new Map<string, number[]>();

  constructor(
    private windowMs: number,
    private maxRequests: number
  ) {}

  isAllowed(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.store.get(key) || [];
    timestamps = timestamps.filter(t => t > windowStart);

    const remaining = Math.max(0, this.maxRequests - timestamps.length);
    const resetAt = timestamps[0] ? timestamps[0] + this.windowMs : now + this.windowMs;

    if (timestamps.length >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt };
    }

    timestamps.push(now);
    this.store.set(key, timestamps);

    return { allowed: true, remaining: remaining - 1, resetAt };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, ts] of this.store.entries()) {
      const valid = ts.filter(t => t > now - this.windowMs);
      if (valid.length === 0) this.store.delete(key);
      else this.store.set(key, valid);
    }
  }
}

// Token Bucket 算法 (适合突发流量)
class TokenBucketLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();

  constructor(
    private capacity: number,    // 桶容量
    private refillRate: number   // 每秒填充
  ) {}

  isAllowed(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // 补充 tokens
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

// 速率限制中间件 (生产级)
function rateLimitMiddleware(
  config: { windowMs: number; max: number; key: (req: Request) => string }
) {
  const limiter = new SlidingWindowLimiter(config.windowMs, config.max);
  setInterval(() => limiter.cleanup(), config.windowMs);

  return (req: Request, res: Response, next: NextFunction) => {
    const key = config.key(req);
    const result = limiter.isAllowed(key);

    res.setHeader('X-RateLimit-Limit', config.max);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '请求过于频繁',
          retryAfter
        }
      });
    }

    next();
  };
}
```

---

## 三、GraphQL 高级模式

### 3.1 DataLoader 深度优化

```typescript
// DataLoader: 批量加载 + 请求级缓存
// 解决 N+1 查询问题

// 每个请求创建新实例 (避免缓存污染)
function createLoaders(db: Database) {
  return {
    userLoader: new DataLoader(async (ids: readonly string[]) => {
      const users = await db.user.findMany({
        where: { id: { in: ids as string[] } }
      });
      return ids.map(id => users.find(u => u.id === id) ?? null);
    }),

    postLoader: new DataLoader(async (ids: readonly string[]) => {
      const posts = await db.post.findMany({
        where: { id: { in: ids as string[] } }
      });
      return ids.map(id => posts.find(p => p.id === id) ?? null);
    }),

    // 一对多关系也支持
    commentLoader: new DataLoader(async (postIds: readonly string[]) => {
      const comments = await db.comment.findMany({
        where: { postId: { in: postIds as string[] } }
      });
      return postIds.map(id => comments.filter(c => c.postId === id));
    }),

    // 带缓存键生成
    productLoader: new DataLoader(
      async (skus: readonly string[]) => {
        const products = await db.product.findMany({
          where: { sku: { in: skus as string[] } }
        });
        return skus.map(sku => products.find(p => p.sku === sku) ?? null);
      },
      { cacheKeyFn: (sku: string) => sku }
    )
  };
}

// Apollo Server 集成
const server = new ApolloServer({
  resolvers,
  context: () => ({
    loaders: createLoaders(db),
    db
  })
});

// Resolver 中使用
const resolvers = {
  Post: {
    author: async (post, _, { loaders }) =>
      loaders.userLoader.load(post.authorId),  // 自动批量
    comments: async (post, _, { loaders }) =>
      loaders.commentLoader.load(post.id),     // 一对多
    category: async (post, _, { loaders }) =>
      loaders.categoryLoader.load(post.categoryId)
  }
};
```

### 3.2 Federation (微服务 Schema 组合)

```graphql
# === 用户服务 ===
type User @key(fields: "id") {
  id: ID!
  email: String!
  name: String!
  avatar: String
}

# === 订单服务 (扩展 User) ===
extend type User @key(fields: "id") {
  id: ID! @external
  orderCount: Int!
  totalSpent: Float!
}

type Order @key(fields: "id") {
  id: ID!
  total: Float!
  status: OrderStatus!
  user: User!  # 引用用户服务的 User
}

# === 评论服务 (跨服务组合) ===
extend type Product @key(fields: "id") {
  id: ID! @external
  reviews: [Review!]!
  averageRating: Float!
}

type Review @key(fields: "id") {
  id: ID!
  rating: Int!
  content: String!
  product: Product!
  user: User!
}
```

### 3.3 GraphQL 安全策略

```typescript
// 1. 查询深度限制
const depthLimit = depthLimitRule(10);

// 2. 查询复杂度分析
const complexityRule = complexityAnalysis({
  maximumComplexity: 1000,
  estimators: [
    fieldExtensionsEstimator(),
    simpleEstimator({ defaultComplexity: 1 })
  ]
});

// 3. 字段级权限 (指令)
const schema = makeExecutableSchema({
  typeDefs: `
    directive @auth(requires: Role!) on FIELD_DEFINITION

    enum Role { ADMIN, USER, GUEST }

    type User {
      id: ID!
      email: String!
      ssn: String @auth(requires: ADMIN)  # 仅管理员
      orders: [Order!]! @auth(requires: USER)
    }
  `,
  resolvers
});

// 4. 内省查询限制 (生产环境)
// 可选：禁用内省或限制频率
```

---

## 四、Webhook 设计

### 4.1 Webhook 完整实现

```typescript
// Webhook 事件类型
type WebhookEvent =
  | { type: 'order.created'; data: Order }
  | { type: 'order.paid'; data: Order }
  | { type: 'order.shipped'; data: Order & { tracking: string } }
  | { type: 'user.created'; data: User }
  | { type: 'user.deleted'; data: { userId: string } };

// Webhook 签名
class WebhookSignature {
  static sign(payload: string, secret: string): string {
    const sig = crypto.createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    return `sha256=${sig}`;
  }

  static verify(payload: string, signature: string, secret: string): boolean {
    const expected = this.sign(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }
}

// Webhook 投递 (指数退避重试)
class WebhookDispatcher {
  constructor(private db: Database, private queue: BullQueue) {}

  async dispatch(event: WebhookEvent): Promise<void> {
    const subscriptions = await this.db.webhookSubscription.findMany({
      where: {
        active: true,
        events: { has: event.type },
        failureCount: { lt: 5 }
      }
    });

    for (const sub of subscriptions) {
      const delivery = await this.db.webhookDelivery.create({
        subscriptionId: sub.id,
        event,
        url: sub.url,
        status: 'pending',
        attemptCount: 0,
        maxAttempts: 5
      });

      await this.queue.add('deliver', { deliveryId: delivery.id });
    }
  }

  private async deliver(deliveryId: string, isRetry = false): Promise<void> {
    const delivery = await this.db.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { subscription: true }
    });

    const payload = JSON.stringify({
      id: delivery.id,
      type: delivery.event.type,
      timestamp: new Date().toISOString(),
      data: delivery.event.data
    });

    const sig = WebhookSignature.sign(payload, delivery.subscription.secret);
    const ts = Math.floor(Date.now() / 1000).toString();

    try {
      const res = await fetch(delivery.subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': sig,
          'X-Webhook-Timestamp': ts,
          'X-Webhook-Event': delivery.event.type,
          'X-Webhook-Id': delivery.id
        },
        body: payload,
        signal: AbortSignal.timeout(10_000)
      });

      if (res.ok) {
        delivery.status = 'success';
        delivery.subscription.failureCount = 0;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      delivery.attemptCount += 1;
      delivery.subscription.failureCount += 1;

      if (delivery.attemptCount < delivery.maxAttempts) {
        // 指数退避: 1s → 2s → 4s → 8s → 16s
        const backoff = Math.min(1000 * Math.pow(2, delivery.attemptCount), 3_600_000);
        await this.queue.add('retry', { deliveryId }, { delay: backoff });
      } else {
        delivery.status = 'failed';
        delivery.subscription.active = false;  // 超过最大重试，禁用
      }
    }

    await this.db.webhookDelivery.update({ where: { id: deliveryId }, data: delivery });
    await this.db.webhookSubscription.update({
      where: { id: delivery.subscription.id },
      data: delivery.subscription
    });
  }
}
```

### 4.2 Webhook 管理 API

```
# 创建订阅
POST /api/v1/webhooks
{
  "url": "https://myapp.com/hooks",
  "events": ["order.created", "order.paid", "order.shipped"],
  "secret": "whsec_xxx"
}

# 列出订阅
GET /api/v1/webhooks

# 查看详情
GET /api/v1/webhooks/wh_123

# 更新订阅
PATCH /api/v1/webhooks/wh_123
{ "events": ["order.created", "order.paid", "order.shipped", "order.delivered"] }

# 重新生成密钥
POST /api/v1/webhooks/wh_123/regenerate-secret

# 删除订阅
DELETE /api/v1/webhooks/wh_123

# 投递历史
GET /api/v1/webhooks/wh_123/deliveries?status=failed

# 重投
POST /api/v1/webhooks/deliveries/dlv_456/retry
```

---

## 五、完整 API 设计实战：CloudBoard 协作白板

### 5.1 业务背景

**CloudBoard** 是一个在线协作白板平台，核心功能：
- 白板 CRUD + 模板
- 元素管理 (形状/文本/图片/便签/画笔)
- 实时协作 (WebSocket + REST 回退)
- 版本历史与回滚
- 权限管理 (所有者/编辑者/查看者)
- 导出 (PNG/SVG/PDF/JSON)

### 5.2 完整 RESTful API 设计

```
# ==================== 认证 ====================
POST   /api/v1/auth/register          # 注册
POST   /api/v1/auth/login             # 登录
POST   /api/v1/auth/refresh           # 刷新 Token
POST   /api/v1/auth/logout            # 退出
POST   /api/v1/auth/forgot-password   # 忘记密码
POST   /api/v1/auth/reset-password    # 重置密码

# ==================== 用户 ====================
GET    /api/v1/users/me               # 当前用户
PATCH  /api/v1/users/me               # 更新资料
PUT    /api/v1/users/me/avatar        # 上传头像
GET    /api/v1/users/me/boards        # 我的白板
GET    /api/v1/users/me/shared        # 共享给我的白板

# ==================== 白板 ====================
GET    /api/v1/boards                 # 白板列表 (分页/搜索/过滤)
POST   /api/v1/boards                 # 创建白板
GET    /api/v1/boards/:id             # 白板详情
PATCH  /api/v1/boards/:id             # 更新白板
DELETE /api/v1/boards/:id             # 删除白板 (软删除)
POST   /api/v1/boards/:id/duplicate   # 复制白板
POST   /api/v1/boards/:id/archive     # 归档
POST   /api/v1/boards/:id/unarchive   # 取消归档

# 白板模板
GET    /api/v1/templates              # 模板列表
POST   /api/v1/boards/:id/from-template  # 从模板创建

# ==================== 元素 ====================
GET    /api/v1/boards/:id/elements              # 元素列表
POST   /api/v1/boards/:id/elements              # 创建元素
GET    /api/v1/boards/:id/elements/:elemId      # 元素详情
PATCH  /api/v1/boards/:id/elements/:elemId      # 更新元素
DELETE /api/v1/boards/:id/elements/:elemId      # 删除元素
POST   /api/v1/boards/:id/elements/batch        # 批量创建
DELETE /api/v1/boards/:id/elements/batch        # 批量删除

# 元素操作
POST   /api/v1/boards/:id/elements/:elemId/duplicate  # 复制元素
POST   /api/v1/boards/:id/elements/:elemId/group      # 编组
POST   /api/v1/boards/:id/elements/ungroup            # 取消编组
POST   /api/v1/boards/:id/elements/:elemId/bring-front # 置顶
POST   /api/v1/boards/:id/elements/:elemId/send-back   # 置底

# ==================== 协作 ====================
GET    /api/v1/boards/:id/collaborators           # 协作者列表
POST   /api/v1/boards/:id/collaborators           # 添加协作者
PATCH  /api/v1/boards/:id/collaborators/:userId   # 更新权限
DELETE /api/v1/boards/:id/collaborators/:userId   # 移除协作者
GET    /api/v1/boards/:id/presence                # 在线用户
GET    /api/v1/boards/:id/activity-log            # 操作日志

# 共享链接
POST   /api/v1/boards/:id/share-link              # 创建共享链接
GET    /api/v1/boards/:id/share-link              # 获取共享链接
DELETE /api/v1/boards/:id/share-link              # 取消共享链接
PATCH  /api/v1/boards/:id/share-link              # 更新共享权限

# ==================== 版本历史 ====================
GET    /api/v1/boards/:id/versions                # 版本列表
GET    /api/v1/boards/:id/versions/:versionId     # 版本详情
POST   /api/v1/boards/:id/versions/:versionId/rollback  # 回滚
GET    /api/v1/boards/:id/versions/:v1/diff/:v2   # 版本对比

# ==================== 导出 ====================
POST   /api/v1/boards/:id/export                  # 导出 (PNG/SVG/PDF/JSON)
GET    /api/v1/boards/:id/exports/:exportId       # 导出状态
GET    /api/v1/boards/:id/exports/:exportId/download  # 下载

# ==================== 搜索 ====================
GET    /api/v1/search/boards       # 搜索白板
GET    /api/v1/search/elements     # 搜索元素
GET    /api/v1/search/recent       # 最近访问
```

### 5.3 核心端点详细设计

#### 创建白板

```
POST /api/v1/boards
Authorization: Bearer <token>
X-Idempotency-Key: <uuid>

Request:
{
  "name": "产品需求脑暴",
  "description": "Q2 产品需求讨论",
  "template": "blank",           // blank / brainstorm / kanban / wireframe
  "background": "#f8f9fa",
  "width": 4000,
  "height": 3000
}

Response 201:
{
  "id": "brd_a1b2c3",
  "name": "产品需求脑暴",
  "description": "产品需求讨论",
  "template": "blank",
  "background": "#f8f9fa",
  "width": 4000,
  "height": 3000,
  "owner": {
    "id": "usr_123",
    "name": "张三",
    "avatar": "https://..."
  },
  "elementCount": 0,
  "status": "active",
  "createdAt": "2026-04-27T21:00:00Z",
  "updatedAt": "2026-04-27T21:00:00Z",
  "_links": [
    { "rel": "self", "href": "/api/v1/boards/brd_a1b2c3", "method": "GET" },
    { "rel": "elements", "href": "/api/v1/boards/brd_a1b2c3/elements", "method": "GET" },
    { "rel": "collaborators", "href": "/api/v1/boards/brd_a1b2c3/collaborators", "method": "GET" },
    { "rel": "versions", "href": "/api/v1/boards/brd_a1b2c3/versions", "method": "GET" },
    { "rel": "export", "href": "/api/v1/boards/brd_a1b2c3/export", "method": "POST" }
  ]
}
```

#### 创建元素

```
POST /api/v1/boards/:boardId/elements
Authorization: Bearer <token>

Request (矩形):
{
  "type": "rectangle",
  "x": 100,
  "y": 100,
  "width": 200,
  "height": 150,
  "fill": "#3b82f6",
  "stroke": "#1d4ed8",
  "strokeWidth": 2,
  "cornerRadius": 8,
  "opacity": 1,
  "locked": false,
  "visible": true,
  "zIndex": 1,
  "groupId": null,
  "customData": {}
}

Request (文本):
{
  "type": "text",
  "x": 150,
  "y": 200,
  "width": 300,
  "height": 60,
  "content": "Hello World",
  "fontSize": 24,
  "fontWeight": "bold",
  "fontFamily": "Inter",
  "textAlign": "center",
  "fill": "#1f2937"
}

Request (便签):
{
  "type": "sticky-note",
  "x": 300,
  "y": 100,
  "width": 200,
  "height": 200,
  "content": "这是一个便签",
  "color": "#fef3c7",
  "fontSize": 16
}

Request (图片):
{
  "type": "image",
  "x": 500,
  "y": 100,
  "width": 400,
  "height": 300,
  "imageUrl": "https://...",
  "alt": "产品截图"
}

Response 201:
{
  "id": "elm_x7y8z9",
  "type": "rectangle",
  "x": 100,
  "y": 100,
  "width": 200,
  "height": 150,
  "fill": "#3b82f6",
  "stroke": "#1d4ed8",
  "strokeWidth": 2,
  "cornerRadius": 8,
  "opacity": 1,
  "locked": false,
  "visible": true,
  "zIndex": 1,
  "groupId": null,
  "createdAt": "2026-04-27T21:05:00Z",
  "updatedAt": "2026-04-27T21:05:00Z",
  "createdBy": { "id": "usr_123", "name": "张三" },
  "_links": [
    { "rel": "self", "href": "/api/v1/boards/brd_a1b2c3/elements/elm_x7y8z9", "method": "GET" },
    { "rel": "update", "href": "/api/v1/boards/brd_a1b2c3/elements/elm_x7y8z9", "method": "PATCH" },
    { "rel": "delete", "href": "/api/v1/boards/brd_a1b2c3/elements/elm_x7y8z9", "method": "DELETE" },
    { "rel": "duplicate", "href": "/api/v1/boards/brd_a1b2c3/elements/elm_x7y8z9/duplicate", "method": "POST" }
  ]
}
```

#### 批量创建元素

```
POST /api/v1/boards/:boardId/elements/batch
X-Idempotency-Key: <uuid>

Request:
{
  "elements": [
    { "type": "rectangle", "x": 100, "y": 100, "width": 200, "height": 150, "fill": "#3b82f6" },
    { "type": "text", "x": 150, "y": 200, "width": 300, "height": 60, "content": "Title" },
    { "type": "sticky-note", "x": 300, "y": 100, "width": 200, "height": 200, "content": "Note" }
  ]
}

Response 201:
{
  "results": [
    { "status": 201, "element": { "id": "elm_1", ... } },
    { "status": 201, "element": { "id": "elm_2", ... } },
    { "status": 201, "element": { "id": "elm_3", ... } }
  ],
  "meta": { "total": 3, "succeeded": 3, "failed": 0 }
}
```

#### 白板列表 (分页/搜索/过滤/排序)

```
GET /api/v1/boards?page=1&limit=20&sort=-updatedAt&search=产品&status=active&shared=false

Response 200:
{
  "data": [
    {
      "id": "brd_a1b2c3",
      "name": "产品需求脑暴",
      "description": "Q2 产品需求讨论",
      "template": "brainstorm",
      "elementCount": 45,
      "collaboratorCount": 3,
      "owner": { "id": "usr_123", "name": "张三" },
      "status": "active",
      "createdAt": "2026-04-27T21:00:00Z",
      "updatedAt": "2026-04-27T21:30:00Z",
      "lastAccessedAt": "2026-04-27T21:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-04-27T21:30:00Z"
  }
}
```

#### 版本历史

```
GET /api/v1/boards/:boardId/versions?page=1&limit=20

Response 200:
{
  "data": [
    {
      "id": "ver_001",
      "version": 1,
      "snapshot": { "elements": [...], "canvas": { ... } },
      "elementCount": 45,
      "createdBy": { "id": "usr_123", "name": "张三" },
      "createdAt": "2026-04-27T21:00:00Z",
      "changeSummary": "初始创建"
    },
    {
      "id": "ver_002",
      "version": 2,
      "snapshot": { "elements": [...], "canvas": { ... } },
      "elementCount": 48,
      "createdBy": { "id": "usr_456", "name": "李四" },
      "createdAt": "2026-04-27T21:15:00Z",
      "changeSummary": "添加了 3 个便签"
    }
  ],
  "pagination": { ... }
}

# 版本回滚
POST /api/v1/boards/:boardId/versions/:versionId/rollback

Response 200:
{
  "message": "已回滚到版本 2",
  "currentVersion": 3,
  "rolledBackFrom": 2,
  "board": { ... }
}

# 版本对比
GET /api/v1/boards/:boardId/versions/ver_001/diff/ver_002

Response 200:
{
  "fromVersion": 1,
  "toVersion": 2,
  "changes": [
    { "type": "added", "element": { "id": "elm_4", "type": "sticky-note" } },
    { "type": "added", "element": { "id": "elm_5", "type": "sticky-note" } },
    { "type": "added", "element": { "id": "elm_6", "type": "sticky-note" } },
    { "type": "modified", "element": { "id": "elm_1", "changes": { "x": [100, 120] } } }
  ]
}
```

#### 导出

```
POST /api/v1/boards/:boardId/export
{
  "format": "png",          // png / svg / pdf / json
  "quality": "high",        // low / medium / high
  "scale": 2,               // 缩放比例 (1-3)
  "background": true,       // 是否包含背景
  "padding": 20,            // 内边距 (px)
  "range": {                // 导出范围 (可选，默认全部)
    "x": 0, "y": 0,
    "width": 2000, "height": 1500
  }
}

// 同步导出 (小文件)
Response 200 (PNG):
Content-Type: image/png
Content-Disposition: attachment; filename="board.png"
[二进制数据]

// 异步导出 (大文件)
Response 202:
{
  "exportId": "exp_abc123",
  "status": "processing",
  "estimatedSeconds": 5,
  "downloadUrl": "/api/v1/boards/:id/exports/exp_abc123/download"
}

// 查询导出状态
GET /api/v1/boards/:id/exports/exp_abc123
Response 200:
{
  "exportId": "exp_abc123",
  "status": "completed",     // processing / completed / failed
  "format": "png",
  "fileSize": 2048576,
  "downloadUrl": "/api/v1/boards/:id/exports/exp_abc123/download",
  "expiresAt": "2026-04-28T21:00:00Z"
}
```

### 5.4 错误响应规范

```json
// 400 - 参数验证失败
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [
      { "field": "name", "message": "白板名称不能为空" },
      { "field": "width", "message": "宽度必须在 100-10000 之间" }
    ]
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-04-27T21:00:00Z"
  }
}

// 401 - 未认证
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "请先登录",
    "details": [
      { "field": "authorization", "message": "Token 已过期，请重新登录" }
    ]
  }
}

// 403 - 无权限
{
  "error": {
    "code": "FORBIDDEN",
    "message": "您没有权限编辑此白板",
    "details": [
      { "field": "board", "message": "当前权限: viewer，需要: editor" }
    ]
  }
}

// 404 - 资源不存在
{
  "error": {
    "code": "NOT_FOUND",
    "message": "白板不存在或已被删除"
  }
}

// 409 - 冲突
{
  "error": {
    "code": "CONCURRENT_EDIT_CONFLICT",
    "message": "白板已被其他用户修改，请刷新后重试",
    "details": [
      { "field": "version", "message": "您的版本: 5，当前版本: 6" }
    ]
  }
}

// 429 - 限流
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "请求过于频繁",
    "details": [
      { "field": "rate_limit", "message": "请在 30 秒后重试" }
    ]
  },
  "meta": {
    "retryAfter": 30
  }
}

// 500 - 服务器错误
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "服务器内部错误",
    "details": [
      { "field": "server", "message": "请联系技术支持" }
    ]
  },
  "meta": {
    "requestId": "req_abc123"
  }
}
```

### 5.5 响应头规范

```
# 成功响应头
X-Request-Id: req_abc123
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 295
X-RateLimit-Reset: 2026-04-27T21:01:00Z
ETag: W/"a1b2c3d4e5f6"
Cache-Control: public, max-age=60, s-maxage=300

# 分页响应头 (Link header)
Link: <https://api.cloudboard.io/v1/boards?page=2&limit=20>; rel="next",
      <https://api.cloudboard.io/v1/boards?page=1&limit=20>; rel="prev",
      <https://api.cloudboard.io/v1/boards?page=1&limit=20>; rel="first",
      <https://api.cloudboard.io/v1/boards?page=8&limit=20>; rel="last"

# 创建响应头
Location: /api/v1/boards/brd_a1b2c3

# 版本控制
Deprecation: true
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
Link: <https://docs.api.com/migration/v1-to-v2>; rel="deprecation"
```

---

## 六、OpenAPI 3.1 文档核心 Schema

```yaml
components:
  schemas:
    # === 白板 ===
    Board:
      type: object
      properties:
        id:
          type: string
          pattern: '^brd_[a-zA-Z0-9]+$'
          example: brd_a1b2c3
        name:
          type: string
          minLength: 1
          maxLength: 100
        description:
          type: string
          maxLength: 500
          nullable: true
        template:
          type: string
          enum: [blank, brainstorm, kanban, wireframe, mindmap]
        background:
          type: string
          pattern: '^#[0-9a-fA-F]{6}$'
        width:
          type: integer
          minimum: 100
          maximum: 10000
          default: 4000
        height:
          type: integer
          minimum: 100
          maximum: 10000
          default: 3000
        elementCount:
          type: integer
        collaboratorCount:
          type: integer
        status:
          type: string
          enum: [active, archived, deleted]
        owner:
          $ref: '#/components/schemas/User'
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
        _links:
          type: array
          items:
            $ref: '#/components/schemas/HATEOASLink'

    # === 元素 ===
    Element:
      type: object
      required: [type, x, y]
      properties:
        id:
          type: string
          pattern: '^elm_[a-zA-Z0-9]+$'
        type:
          type: string
          enum: [rectangle, circle, line, text, sticky-note, image, pen, connector]
        x:
          type: number
        y:
          type: number
        width:
          type: number
        height:
          type: number
        fill:
          type: string
          pattern: '^#[0-9a-fA-F]{6}$'
        stroke:
          type: string
          pattern: '^#[0-9a-fA-F]{6}$'
        strokeWidth:
          type: number
          minimum: 0
          maximum: 20
        opacity:
          type: number
          minimum: 0
          maximum: 1
          default: 1
        locked:
          type: boolean
          default: false
        visible:
          type: boolean
          default: true
        zIndex:
          type: integer
        groupId:
          type: string
          nullable: true
        createdBy:
          $ref: '#/components/schemas/User'
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    # === 协作者 ===
    Collaborator:
      type: object
      properties:
        user:
          $ref: '#/components/schemas/User'
        role:
          type: string
          enum: [owner, editor, viewer]
        addedAt:
          type: string
          format: date-time

    # === 版本 ===
    Version:
      type: object
      properties:
        id:
          type: string
          pattern: '^ver_[a-zA-Z0-9]+$'
        version:
          type: integer
        elementCount:
          type: integer
        createdBy:
          $ref: '#/components/schemas/User'
        createdAt:
          type: string
          format: date-time
        changeSummary:
          type: string

    # === 通用 ===
    HATEOASLink:
      type: object
      properties:
        rel:
          type: string
        href:
          type: string
        method:
          type: string
        title:
          type: string

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
        meta:
          type: object
          properties:
            requestId:
              type: string
            timestamp:
              type: string
              format: date-time
            retryAfter:
              type: integer

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
```

---

## 七、API 设计检查清单 (v4 高级版)

### RESTful 检查清单

- [ ] 资源命名使用名词复数
- [ ] HTTP 方法语义正确 (GET/POST/PUT/PATCH/DELETE)
- [ ] 嵌套资源不超过 2-3 层
- [ ] 状态码使用规范 (200/201/204/400/401/403/404/409/422/429/500)
- [ ] 统一响应格式 (data/error/pagination)
- [ ] 版本控制策略 (URL Path / Header)
- [ ] 分页支持 (offset-limit + cursor-based)
- [ ] 过滤/排序/字段选择
- [ ] 幂等性支持 (X-Idempotency-Key)
- [ ] 条件请求 (ETag / Last-Modified)
- [ ] 速率限制 (分级 + 滑动窗口/Token Bucket)
- [ ] HATEOAS 超媒体链接
- [ ] 批量操作支持
- [ ] Webhook 推送 (签名 + 重试)
- [ ] 错误响应规范 (code/message/details)
- [ ] 响应头规范 (X-Request-Id/RateLimit/Link)
- [ ] Deprecation 通知
- [ ] OpenAPI 文档完整

### GraphQL 检查清单

- [ ] Schema 类型清晰、非空标记正确
- [ ] Connection 模式分页 (Relay 风格)
- [ ] Input 类型组织 Mutation 参数
- [ ] DataLoader 解决 N+1
- [ ] 查询深度限制
- [ ] 查询复杂度限制
- [ ] 字段级权限控制
- [ ] 错误处理 (Union / Payload 模式)
- [ ] Federation 微服务组合
- [ ] 内省查询管理

---

## 八、关键设计决策 (ADR)

### ADR-001: 为什么选择 REST + WebSocket 混合架构

**背景:** CloudBoard 需要实时协作 + 持久化存储

**决策:** REST 用于 CRUD 和导出，WebSocket 用于实时协作

**理由:**
- REST 提供可靠的持久化层，支持离线回退
- WebSocket 提供低延迟实时协作 (光标/元素同步)
- REST 支持 CDN 缓存和 HTTP 缓存
- 混合架构兼顾性能和可靠性

### ADR-002: 为什么使用 X-Idempotency-Key 而非 Token

**背景:** 防止网络超时导致重复操作

**决策:** 客户端生成幂等键，服务端缓存 24h

**理由:**
- 比 Token 更灵活，客户端完全控制
- 支持跨会话重试 (Token 可能过期)
- 24h 缓存平衡了安全性和存储成本

### ADR-003: 为什么版本历史用快照而非操作日志

**背景:** 需要支持版本回滚

**决策:** 每次重大变更保存完整快照

**理由:**
- 快照回滚 O(1) 复杂度
- 操作日志回滚需要重放，复杂且容易出错
- 存储成本可接受 (元素数据压缩后很小)

---

## 九、总结

### 本次 v4 新增内容 (相比 v1-v3)

| 主题 | v4 新增 |
|------|---------|
| 版本演进 | Schema 演进规则 / Deprecation 通知 / 灰度发布 |
| REST 高级模式 | 幂等性 / 条件请求 / HATEOAS / 批量操作 / 分级限流 |
| GraphQL 高级模式 | DataLoader 深度优化 / Federation / 安全策略 |
| Webhook | 完整实现 (签名/投递/重试/管理 API) |
| 业务 API | CloudBoard 协作白板完整 API 设计 (8 大模块) |
| OpenAPI | 完整 Schema 定义 |
| ADR | 3 个架构决策记录 |

### 核心原则回顾

1. **一致性** — 命名/格式/错误处理全局统一
2. **可预测性** — 客户端能推断 API 行为
3. **向后兼容** — 优先扩展而非修改
4. **安全优先** — 认证/授权/限流/签名从设计阶段考虑
5. **文档即契约** — OpenAPI 是 API 的单一真相源
6. **渐进式增强** — 基础功能 → 高级特性 → 生产级模式

---

**完成时间:** 2026-04-27 21:00  
**状态:** ✅ 完成
