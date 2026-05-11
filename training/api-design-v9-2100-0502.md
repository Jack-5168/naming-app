# 🔌 专项训练 21:00 - API 设计 v9：API 演进与生产级高级模式

**日期:** 2026-05-02  
**前置:** 4/22 基础 / 4/23 进阶 / 4/26 巩固 / 4/27 生产级 / 4/28 终章 / 4/29 REST+GraphQL / 4/30 混合架构 / 5/1 v8 实战级  
**本次定位:** API 设计领域第 9 轮 — API 演进策略 + 分布式 API 高级模式 + 电商/支付领域 API + API 治理

---

## 一、API 演进策略深度解析

### 1.1 版本控制策略对比

```
┌─────────────────┬──────────────┬──────────────┬──────────────┐
│     策略        │    优点      │    缺点      │   适用场景   │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ URL 路径版本    │ 最清晰       │ URL 污染     │ 大版本不兼容 │
│ /v1/users       │ 易缓存       │ 版本膨胀     │ 多客户端     │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ Header 版本     │ URL 干净     │ 调试困难     │ 内部 API     │
│ X-API-Version   │ 灵活         │ 缓存复杂     │ 灰度发布     │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ Accept 类型     │ 标准 HTTP    │ 认知负担     │ 内容协商     │
│ Accept:         │ 语义正确     │ 文档复杂     │ 媒体类型     │
│ application     │              │              │ 版本化       │
│ /v1+json        │              │              │              │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ 无版本(向前兼容)│ 零版本管理   │ 设计约束强   │ 快速迭代     │
│ 只加不改        │ 客户端零升级 │ 技术债累积   │ SaaS 产品    │
└─────────────────┴──────────────┴──────────────┴──────────────┘
```

### 1.2 向前兼容 vs 向后兼容

```typescript
// === 向前兼容 (Forward Compatible) ===
// 服务端能处理客户端未来可能发送的新字段
// 策略: 忽略未知字段 + 字段默认值

// 客户端发送: { "name": "test", "new_field_v2": "value" }
// 服务端 v1 处理: 忽略 new_field_v2，正常处理 name ✅

// === 向后兼容 (Backward Compatible) ===
// 新服务端能处理旧客户端的请求
// 策略: 不删除字段 + 不改变字段类型 + 不改变语义

// 客户端 v1 发送: { "name": "test" }
// 服务端 v2 处理: name 仍存在，语义不变 ✅

// === 破坏性变更 (Breaking Changes) ===
// ❌ 删除请求/响应字段
// ❌ 改变字段类型 (string → number)
// ❌ 改变字段语义 (status: "active" → status: 1)
// ❌ 添加必填字段
// ❌ 改变错误码语义
// ❌ 收紧验证规则 (原来允许的现在拒绝)
// ❌ 改变分页行为 (offset → cursor)

// === 安全变更 (Safe Changes) ===
// ✅ 添加可选字段
// ✅ 添加新端点
// ✅ 添加新的枚举值
// ✅ 放宽验证规则
// ✅ 添加新的错误码
// ✅ 添加响应字段
// ✅ 性能优化 (不改变语义)
```

### 1.3 API 弃用生命周期

```typescript
// === 弃用通知机制 ===

// 1. 响应头标记
GET /v1/users → 200 OK
Deprecation: Sat, 01 Nov 2026 00:00:00 GMT
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
Link: </v2/users>; rel="successor-version"
X-API-Deprecation-Note: "此端点将于 2026-11-01 弃用，请迁移至 /v2/users"

// 2. 弃用响应体标记
{
  "data": { "id": 1, "name": "test" },
  "_meta": {
    "deprecated": true,
    "deprecation_date": "2026-11-01",
    "sunset_date": "2027-01-01",
    "migration_guide": "/docs/migration/v1-to-v2",
    "successor_url": "/v2/users/1"
  }
}

// 3. 弃用后行为 (Sunset 之后)
// 方案 A: 返回 410 Gone
// GET /v1/users → 410 Gone
{
  "error": {
    "code": "ENDPOINT_RETired",
    "message": "此端点已下线，请使用 /v2/users",
    "sunset_date": "2027-01-01"
  }
}

// 方案 B: 自动重定向 (308 Permanent Redirect)
// GET /v1/users → 308 → Location: /v2/users

// === 弃用政策模板 ===
// 阶段 1 (T-90天): 标记 deprecated，日志告警
// 阶段 2 (T-60天): 响应头 + 响应体双重警告
// 阶段 3 (T-30天): 返回 299 Warning (非标准但有效)
// 阶段 4 (T-0天): 返回 410 Gone 或 308 重定向
// 阶段 5 (T+30天): 彻底删除端点代码
```

### 1.4 渐进式迁移策略

```typescript
// === 双写模式 (Dual Write) ===
// 迁移期间同时写 v1 和 v2 数据源

class UserAPI {
  async createUser(req) {
    // 1. 写入 v1 数据源 (保持稳定)
    const v1Result = await v1DB.create(req.body);

    // 2. 异步写入 v2 数据源
    try {
      await v2DB.create(transformToV2(req.body));
    } catch (err) {
      // 记录到死信队列，不阻塞主流程
      deadLetterQueue.push({ action: 'create', data: req.body, error: err });
    }

    // 3. 返回 v1 格式响应
    return v1Result;
  }
}

// === 影子流量 (Shadow Traffic) ===
// v2 接收 v1 的实时流量但不返回结果，用于对比验证

class ShadowRouter {
  async handle(req) {
    // 1. 正常处理 v1 请求
    const primaryResponse = await v1Handler(req);

    // 2. 异步发送到 v2 (影子)
    this.shadowService.send(req, primaryResponse);

    // 3. 返回 v1 结果
    return primaryResponse;
  }
}

// === 灰度发布流量切换 ===
// 按百分比逐步切换 v1 → v2

const GRADUAL_ROLLOUT = {
  week1: { v1: 95, v2: 5 },   // 内部用户
  week2: { v1: 80, v2: 20 },  // 早期采用者
  week3: { v1: 50, v2: 50 },  // 50/50 对比
  week4: { v1: 20, v2: 80 },  // 大部分切换
  week5: { v1: 0, v2: 100 },  // 完全切换
};
```

---

## 二、分布式 API 高级模式

### 2.1 幂等性设计 (Idempotency)

```typescript
// === 为什么需要幂等性？ ===
// 网络超时 → 客户端重试 → 重复请求 → 数据重复
// 解决方案: 幂等键 (Idempotency Key)

// === 幂等键机制 ===
POST /v1/orders
Headers:
  Idempotency-Key: idem_abc123xyz
  X-Request-ID: req_001
Body:
{
  "product_id": "prod_001",
  "quantity": 2,
  "payment_method": "alipay"
}

// === 服务端实现 ===
class IdempotencyMiddleware {
  async handle(req, res, next) {
    const idempotencyKey = req.headers['idempotency-key'];

    if (!idempotencyKey) {
      // 非幂等操作，直接放行
      return next();
    }

    // 检查是否已处理过
    const existing = await redis.get(`idem:${idempotencyKey}`);

    if (existing) {
      const cached = JSON.parse(existing);
      // 请求正在处理中
      if (cached.status === 'processing') {
        return res.status(409).json({
          error: {
            code: 'IDEMPOTENCY_IN_PROGRESS',
            message: '此请求正在处理中，请勿重复提交'
          }
        });
      }
      // 返回缓存的结果
      return res.status(cached.statusCode).json(cached.body);
    }

    // 标记为处理中 (TTL 10 分钟)
    await redis.setex(`idem:${idempotencyKey}`, 600, JSON.stringify({
      status: 'processing',
      startedAt: Date.now()
    }));

    // 拦截响应，缓存结果
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const cached = {
        status: 'completed',
        statusCode: res.statusCode,
        body: body,
        completedAt: Date.now()
      };
      // 缓存 24 小时
      redis.setex(`idem:${idempotencyKey}`, 86400, JSON.stringify(cached));
      return originalJson(body);
    };

    next();
  }
}

// === 幂等性保证矩阵 ===

// HTTP 方法   | 天然幂等 | 需要额外处理
// ----------- | -------- | ----------------
// GET         | ✅       | 无
// HEAD        | ✅       | 无
// PUT         | ✅       | 无 (覆盖语义)
// DELETE      | ✅       | 无 (多次删除结果相同)
// POST        | ❌       | 需要 Idempotency-Key
// PATCH       | ⚠️       | 部分操作需要 (取决于实现)
```

### 2.2 乐观锁与并发控制

```typescript
// === ETag + If-Match 机制 ===

// 1. 获取资源 (服务端返回 ETag)
GET /v1/orders/ord_001 → 200 OK
ETag: "ord_001_v5"
{
  "data": {
    "id": "ord_001",
    "status": "pending",
    "amount": 299.00,
    "version": 5
  }
}

// 2. 更新资源 (携带 ETag)
PUT /v1/orders/ord_001
If-Match: "ord_001_v5"
{
  "status": "paid",
  "amount": 299.00
}

// 3a. 成功 (版本匹配)
→ 200 OK
ETag: "ord_001_v6"

// 3b. 冲突 (版本不匹配)
→ 409 Conflict
{
  "error": {
    "code": "OPTIMISTIC_LOCK_FAILURE",
    "message": "资源已被其他请求修改",
    "current_etag": "ord_001_v6",
    "retry_with_current": true
  }
}

// === 服务端实现 ===
class OptimisticLockMiddleware {
  async handle(req, res, next) {
    const resourceId = req.params.id;
    const ifMatch = req.headers['if-match'];

    if (!ifMatch) return next();

    // 从数据库获取当前版本
    const resource = await db.getResource(resourceId);
    const currentETag = `"${resource.id}_v${resource.version}"`;

    if (ifMatch !== currentETag && ifMatch !== '*') {
      return res.status(409).json({
        error: {
          code: 'OPTIMISTIC_LOCK_FAILURE',
          message: '资源已被修改',
          current_etag: currentETag
        }
      });
    }

    next();
  }
}
```

### 2.3 API 网关模式

```typescript
// === API 网关架构 ===

// 客户端 → [API Gateway] → [后端服务]
//           ├── 认证鉴权
//           ├── 限流熔断
//           ├── 请求路由
//           ├── 协议转换
//           ├── 日志追踪
//           └── 缓存

// === 网关配置示例 (Kong / APISIX 风格) ===

const API_GATEWAY_CONFIG = {
  // 路由规则
  routes: [
    {
      name: 'user-service',
      paths: ['/v1/users', '/v1/auth'],
      upstream: 'http://user-service:8080',
      plugins: [
        { name: 'jwt', config: { secret_key: '...' } },
        { name: 'rate-limiting', config: { hour: 1000 } },
      ]
    },
    {
      name: 'order-service',
      paths: ['/v1/orders', '/v1/payments'],
      upstream: 'http://order-service:8081',
      plugins: [
        { name: 'jwt', config: { secret_key: '...' } },
        { name: 'rate-limiting', config: { hour: 500 } },
        { name: 'request-transformer', config: {
          add: { headers: ['X-Service:order'] }
        }}
      ]
    }
  ],

  // 全局插件
  global_plugins: [
    { name: 'correlation-id', config: { header_name: 'X-Request-ID' } },
    { name: 'ip-restriction', config: { allow: ['10.0.0.0/8'] } },
    { name: 'bot-detection' },
  ]
};

// === 熔断器模式 (Circuit Breaker) ===

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.threshold = options.threshold || 5;    // 失败次数阈值
    this.timeout = options.timeout || 30000;     // 熔断恢复时间 (ms)
    this.state = 'CLOSED';                       // CLOSED | OPEN | HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';  // 尝试恢复
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}
```

### 2.4 事件驱动 API (Webhook + Event Stream)

```typescript
// === Webhook 订阅与管理 ===

// 1. 创建 Webhook 订阅
POST /v1/webhooks
{
  "url": "https://client-app.com/hooks/taskflow",
  "events": [
    "order.created",
    "order.paid",
    "order.shipped",
    "order.delivered",
    "order.cancelled"
  ],
  "secret": "whsec_abc123",  // 签名密钥
  "active": true
}

// 响应:
{
  "data": {
    "id": "wh_001",
    "url": "https://client-app.com/hooks/taskflow",
    "events": ["order.created", "order.paid", ...],
    "secret": "whsec_abc123",
    "created_at": "2026-05-02T21:00:00Z"
  }
}

// 2. Webhook 事件投递
POST https://client-app.com/hooks/taskflow
Content-Type: application/json
X-Webhook-Signature: sha256=abc123...
X-Webhook-ID: evt_001
X-Webhook-Timestamp: 2026-05-02T21:00:00Z
X-Webhook-Event: order.paid
X-Webhook-Retry: 0

{
  "id": "evt_001",
  "type": "order.paid",
  "timestamp": "2026-05-02T21:00:00Z",
  "data": {
    "order_id": "ord_001",
    "amount": 299.00,
    "currency": "CNY",
    "payment_method": "alipay",
    "paid_at": "2026-05-02T21:00:00Z"
  }
}

// 3. Webhook 签名验证 (客户端)
function verifyWebhook(payload, signature, secret) {
  const timestamp = headers['x-webhook-timestamp'];
  // 防重放: 超过 5 分钟的请求拒绝
  if (Date.now() - new Date(timestamp) > 300000) {
    throw new Error('Webhook timestamp too old');
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = 'sha256=' +
    crypto.createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )) {
    throw new Error('Invalid webhook signature');
  }
}

// 4. Webhook 重试策略
const WEBHOOK_RETRY_POLICY = {
  max_retries: 5,
  backoff: 'exponential',
  delays: [60, 300, 900, 3600, 14400],  // 秒: 1m, 5m, 15m, 1h, 4h
  // 累计: ~21 分钟
  dead_after: 24 * 3600,  // 24 小时后进入死信队列
  // 重试条件: 非 2xx 响应或超时
  retry_on: ['timeout', '5xx', '429']
};

// === Server-Sent Events (SSE) 实时流 ===

// 客户端连接
GET /v1/stream/events
Accept: text/event-stream
Cache-Control: no-cache
Last-Event-ID: evt_999  // 断线重连时携带

// 服务端推送
event: order.created
data: {"order_id":"ord_002","amount":199.00}
id: evt_1000
retry: 3000

event: order.paid
data: {"order_id":"ord_002","payment_method":"wechat"}
id: evt_1001
retry: 3000

// SSE 服务端实现
class EventStreamController {
  async connect(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');  // 禁用 Nginx 缓冲

    const lastEventId = req.headers['last-event-id'];

    // 断线重连: 从上次位置开始补发
    if (lastEventId) {
      const missedEvents = await db.getEventsAfter(lastEventId);
      missedEvents.forEach(evt => {
        res.write(`event: ${evt.type}\n`);
        res.write(`data: ${JSON.stringify(evt.data)}\n`);
        res.write(`id: ${evt.id}\n\n`);
      });
    }

    // 订阅 Redis Pub/Sub
    const subscriber = redis.duplicate();
    await subscriber.subscribe('api-events');

    subscriber.on('message', (channel, message) => {
      const evt = JSON.parse(message);
      res.write(`event: ${evt.type}\n`);
      res.write(`data: ${JSON.stringify(evt.data)}\n`);
      res.write(`id: ${evt.id}\n\n`);
    });

    // 心跳保活
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');  // SSE 注释作为心跳
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      subscriber.unsubscribe();
      subscriber.quit();
    });
  }
}
```

---

## 三、电商/支付领域完整 API 设计

### 3.1 业务场景

设计一套支撑电商平台的 API，涵盖：商品管理、订单流程、支付集成、库存管理、物流追踪、售后退款。

### 3.2 实体关系

```
Product ──< SKU >── Inventory
                    │
Order ──< OrderItem >── Product/SKU
  │
  ├── Payment ── PaymentTransaction
  │
  ├── Shipment ── TrackingEvent
  │
  ├── Refund ── RefundTransaction
  │
  └── Review
```

### 3.3 完整 API 端点

```
# === 商品模块 ===
GET    /v1/products                    # 商品列表 (分页/筛选/排序)
GET    /v1/products/:id                # 商品详情
GET    /v1/products/:id/skus           # SKU 列表
GET    /v1/skus/:sku_id                # SKU 详情 (价格/库存)
GET    /v1/categories                  # 分类树
GET    /v1/categories/:id/products     # 分类下商品
GET    /v1/brands                      # 品牌列表
GET    /v1/search                      # 全文搜索

# === 购物车模块 ===
GET    /v1/cart                        # 获取购物车
POST   /v1/cart/items                  # 加入购物车
PATCH  /v1/cart/items/:id              # 更新购物车商品数量
DELETE /v1/cart/items/:id              # 移除购物车商品
POST   /v1/cart/merge                  # 合并游客购物车到用户
POST   /v1/cart/validate               # 校验购物车 (库存/价格变动)
DELETE /v1/cart                        # 清空购物车

# === 订单模块 ===
POST   /v1/orders                      # 创建订单 (幂等)
GET    /v1/orders                      # 订单列表
GET    /v1/orders/:id                  # 订单详情
GET    /v1/orders/:id/items            # 订单商品明细
POST   /v1/orders/:id/cancel           # 取消订单
POST   /v1/orders/:id/confirm          # 确认收货
GET    /v1/orders/:id/invoice          # 获取发票
POST   /v1/orders/:id/review           # 评价订单

# === 支付模块 ===
POST   /v1/orders/:id/payments         # 创建支付 (幂等)
GET    /v1/payments/:id                # 支付状态
GET    /v1/payments/:id/transactions   # 支付流水
POST   /v1/payments/:id/refund         # 申请退款 (幂等)
GET    /v1/refunds/:id                 # 退款状态
POST   /v1/payments/callback           # 支付回调 (验签)

# === 库存模块 ===
GET    /v1/inventory/:sku_id           # 库存查询
POST   /v1/inventory/reserve           # 锁定库存 (下单)
POST   /v1/inventory/release           # 释放库存 (取消)
POST   /v1/inventory/confirm           # 确认扣减 (支付成功)
GET    /v1/inventory/warehouse/:id     # 仓库库存

# === 物流模块 ===
GET    /v1/orders/:id/shipments        # 物流信息
GET    /v1/shipments/:id/tracking      # 物流追踪
POST   /v1/shipments/:id/ship          # 发货
GET    /v1/carriers                    # 快递公司列表

# === 售后模块 ===
POST   /v1/orders/:id/returns          # 申请退货
GET    /v1/returns/:id                 # 退货详情
POST   /v1/returns/:id/approve         # 审核退货
POST   /v1/returns/:id/reject          # 拒绝退货
POST   /v1/returns/:id/receive         # 收货确认
```

### 3.4 核心流程 API 详解

#### 3.4.1 创建订单 (带幂等 + 库存锁定)

```typescript
// === 创建订单 ===
POST /v1/orders
Headers:
  Idempotency-Key: idem_order_20260502_001
  X-Request-ID: req_order_001
Body:
{
  "items": [
    {
      "sku_id": "sku_001_red_l",
      "quantity": 2,
      "price_snapshot": 99.00
    },
    {
      "sku_id": "sku_002_blue_m",
      "quantity": 1,
      "price_snapshot": 149.00
    }
  ],
  "address": {
    "receiver": "张三",
    "phone": "138****0000",
    "province": "浙江省",
    "city": "杭州市",
    "district": "西湖区",
    "detail": "某某路123号"
  },
  "coupon_code": "SUMMER50",     // 可选优惠券
  "invoice_type": "personal",     // personal | company | none
  "remark": "请尽快发货"           // 可选备注
}

// 响应: 201 Created
{
  "data": {
    "id": "ord_20260502_0001",
    "order_no": "ORD2026050221000001",
    "status": "pending_payment",
    "items": [
      {
        "id": "oi_001",
        "sku_id": "sku_001_red_l",
        "product_name": "纯棉T恤",
        "spec": "红色 / L",
        "quantity": 2,
        "unit_price": 99.00,
        "subtotal": 198.00,
        "image_url": "https://cdn.example.com/products/tshirt-red.jpg"
      },
      {
        "id": "oi_002",
        "sku_id": "sku_002_blue_m",
        "product_name": "运动裤",
        "spec": "蓝色 / M",
        "quantity": 1,
        "unit_price": 149.00,
        "subtotal": 149.00,
        "image_url": "https://cdn.example.com/products/pants-blue.jpg"
      }
    ],
    "pricing": {
      "subtotal": 347.00,
      "discount": 50.00,
      "shipping_fee": 0,
      "tax": 0,
      "total": 297.00
    },
    "coupon": {
      "code": "SUMMER50",
      "discount": 50.00,
      "name": "夏日满减50"
    },
    "address": { /* ... */ },
    "payment": {
      "method": null,
      "expires_at": "2026-05-02T23:00:00Z",  // 30 分钟超时
      "amount": 297.00
    },
    "created_at": "2026-05-02T21:00:00Z"
  }
}

// 错误响应: 库存不足
// 422 Unprocessable
{
  "error": {
    "code": "INSUFFICIENT_INVENTORY",
    "message": "部分商品库存不足",
    "details": [
      {
        "sku_id": "sku_001_red_l",
        "requested": 2,
        "available": 1
      }
    ],
    "request_id": "req_order_001"
  }
}

// 错误响应: 价格变动
// 409 Conflict
{
  "error": {
    "code": "PRICE_CHANGED",
    "message": "商品价格已变动，请重新确认",
    "details": [
      {
        "sku_id": "sku_001_red_l",
        "snapshot_price": 99.00,
        "current_price": 109.00
      }
    ],
    "request_id": "req_order_001"
  }
}
```

#### 3.4.2 创建支付 (带多支付方式)

```typescript
// === 创建支付 ===
POST /v1/orders/ord_20260502_0001/payments
Headers:
  Idempotency-Key: idem_pay_20260502_001
Body:
{
  "method": "alipay",       // alipay | wechat_pay | bank_card | balance
  "return_url": "https://shop.example.com/order/ord_20260502_0001",
  "notify_url": "https://api.shop.example.com/v1/payments/callback"
}

// 响应: 201 Created
{
  "data": {
    "id": "pay_001",
    "order_id": "ord_20260502_0001",
    "method": "alipay",
    "amount": 297.00,
    "status": "pending",
    "payment_params": {
      // 支付宝: 返回 orderString
      "alipay_order_string": "alipay_sdk=...&out_trade_no=ORD2026050221000001&..."
      // 微信: 返回 JSAPI 参数或二维码
      // "prepay_id": "wx2016...",
      // "time_stamp": "1714670400",
      // "nonce_str": "abc123",
      // "package": "prepay_id=wx2016...",
      // "sign_type": "RSA",
      // "pay_sign": "..."
      // 银行卡: 返回支付页面 URL
      // "payment_url": "https://pay.bank.com/checkout?token=..."
    },
    "expires_at": "2026-05-02T23:00:00Z",
    "created_at": "2026-05-02T21:05:00Z"
  }
}
```

#### 3.4.3 支付回调 (验签 + 幂等)

```typescript
// === 支付平台回调 ===
POST /v1/payments/callback
Content-Type: application/x-www-form-urlencoded

// 支付宝回调参数 (签名验证)
out_trade_no=ORD2026050221000001
trade_no=2026050222001234567890
trade_status=TRADE_SUCCESS
total_amount=297.00
buyer_id=2088123456789012
sign=BASE64_ENCODED_SIGNATURE
sign_type=RSA2
timestamp=2026-05-02 21:15:00

// === 服务端处理 ===
class PaymentCallbackController {
  async handle(req, res) {
    const params = req.body;

    // 1. 验证签名
    const isValid = alipay.verifySign(params);
    if (!isValid) {
      return res.status(400).send('invalid sign');
    }

    // 2. 幂等处理 (同一 trade_no 只处理一次)
    const existing = await db.getPaymentByTradeNo(params.trade_no);
    if (existing && existing.status === 'success') {
      return res.send('success');  // 支付宝要求返回 success
    }

    // 3. 更新订单状态
    await db.transaction(async (tx) => {
      // 更新支付记录
      await tx.update('payments', {
        status: 'success',
        trade_no: params.trade_no,
        paid_at: new Date(params.timestamp),
        payer_id: params.buyer_id
      }, { order_no: params.out_trade_no });

      // 更新订单状态
      await tx.update('orders', {
        status: 'paid',
        paid_at: new Date(params.timestamp)
      }, { order_no: params.out_trade_no });

      // 扣减库存 (确认扣减)
      const items = await tx.get('order_items', { order_no: params.out_trade_no });
      for (const item of items) {
        await tx.decrement('inventory', {
          sku_id: item.sku_id,
          quantity: item.quantity,
          type: 'confirmed'  // 从 reserved 转为 confirmed
        });
      }
    });

    // 4. 发送事件
    await eventBus.publish('order.paid', {
      order_no: params.out_trade_no,
      trade_no: params.trade_no,
      amount: parseFloat(params.total_amount),
      paid_at: params.timestamp
    });

    // 5. 响应支付平台 (必须返回 success)
    res.send('success');
  }
}
```

#### 3.4.4 退款流程

```typescript
// === 申请退款 ===
POST /v1/payments/pay_001/refund
Headers:
  Idempotency-Key: idem_refund_20260502_001
Body:
{
  "amount": 297.00,           // 全额退款
  // "amount": 99.00,         // 或部分退款
  "reason": "不想要了",
  "refund_method": "original"  // original (原路返回) | balance (退余额)
}

// 响应: 201 Created
{
  "data": {
    "id": "refund_001",
    "payment_id": "pay_001",
    "order_id": "ord_20260502_0001",
    "amount": 297.00,
    "status": "processing",     // processing | success | failed
    "reason": "不想要了",
    "refund_method": "original",
    "refund_params": {
      "alipay_trade_no": "2026050222001234567890",
      "refund_reason": "不想要了"
    },
    "created_at": "2026-05-02T21:30:00Z",
    "estimated_arrival": "2026-05-05T21:30:00Z"  // 预计到账时间
  }
}

// 退款状态查询
GET /v1/refunds/refund_001 → 200 OK
{
  "data": {
    "id": "refund_001",
    "status": "success",
    "amount": 297.00,
    "refunded_at": "2026-05-03T10:00:00Z",
    "transactions": [
      {
        "id": "rt_001",
        "type": "refund",
        "amount": 297.00,
        "channel": "alipay",
        "status": "success",
        "created_at": "2026-05-02T21:30:00Z"
      }
    ]
  }
}
```

### 3.5 库存状态机

```typescript
// === 库存状态流转 ===

// 库存记录结构
interface InventoryRecord {
  sku_id: string;
  warehouse_id: string;
  total: number;        // 总库存
  available: number;    // 可用库存
  reserved: number;     // 已锁定 (未支付)
  confirmed: number;    // 已扣减 (已支付)
  version: number;      // 乐观锁版本
}

// 库存操作状态机
const INVENTORY_STATE_MACHINE = {
  // 下单: available → reserved
  reserve: (record, qty) => {
    if (record.available < qty) throw new Error('库存不足');
    record.available -= qty;
    record.reserved += qty;
    record.version++;
  },

  // 支付成功: reserved → confirmed
  confirm: (record, qty) => {
    if (record.reserved < qty) throw new Error('锁定库存不足');
    record.reserved -= qty;
    record.confirmed += qty;
    record.version++;
  },

  // 取消订单: reserved → available
  release: (record, qty) => {
    if (record.reserved < qty) throw new Error('锁定库存不足');
    record.reserved -= qty;
    record.available += qty;
    record.version++;
  },

  // 退款成功: confirmed → available (退货入库后)
  return: (record, qty) => {
    if (record.confirmed < qty) throw new Error('已确认库存不足');
    record.confirmed -= qty;
    record.available += qty;
    record.version++;
  }
};

// 库存操作 API
POST /v1/inventory/reserve
Headers:
  Idempotency-Key: idem_reserve_001
Body:
{
  "sku_id": "sku_001_red_l",
  "warehouse_id": "wh_hangzhou",
  "quantity": 2
}

POST /v1/inventory/confirm
Body:
{
  "sku_id": "sku_001_red_l",
  "warehouse_id": "wh_hangzhou",
  "quantity": 2
}

POST /v1/inventory/release
Body:
{
  "sku_id": "sku_001_red_l",
  "warehouse_id": "wh_hangzhou",
  "quantity": 2,
  "reason": "order_cancelled"
}
```

---

## 四、GraphQL API 设计 (电商场景)

### 4.1 Schema 设计

```graphql
# === 类型定义 ===

type Product {
  id: ID!
  name: String!
  description: String
  images: [Image!]!
  category: Category!
  brand: Brand
  averageRating: Float
  reviewCount: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
  sku(id: ID): SKU
  skus: [SKU!]!
}

type SKU {
  id: ID!
  product: Product!
  specs: [SpecValue!]!        # 规格组合 (颜色/尺码)
  price: Money!
  originalPrice: Money
  inventory: InventoryStatus!
  barcode: String
  weight: Float
  images: [Image!]!
}

type InventoryStatus {
  available: Int!
  reserved: Int!
  inStock: Boolean!
  warehouse: Warehouse
}

type Money {
  amount: Float!
  currency: Currency!
}

enum Currency {
  CNY
  USD
  EUR
  JPY
}

type Order {
  id: ID!
  orderNo: String!
  status: OrderStatus!
  items: [OrderItem!]!
  pricing: OrderPricing!
  address: ShippingAddress!
  payment: Payment
  shipment: Shipment
  reviews: [Review!]
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
  REFUNDING
  REFUNDED
}

type OrderItem {
  id: ID!
  product: Product!
  sku: SKU!
  quantity: Int!
  unitPrice: Money!
  subtotal: Money!
  specText: String!
}

type OrderPricing {
  subtotal: Money!
  discount: Money!
  shippingFee: Money!
  tax: Money!
  total: Money!
}

type Payment {
  id: ID!
  method: PaymentMethod!
  amount: Money!
  status: PaymentStatus!
  transactions: [PaymentTransaction!]!
  paidAt: DateTime
  expiresAt: DateTime
}

enum PaymentMethod {
  ALIPAY
  WECHAT_PAY
  BANK_CARD
  BALANCE
}

enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCESS
  FAILED
  REFUNDING
  REFUNDED
}

type PaymentTransaction {
  id: ID!
  type: TransactionType!
  amount: Money!
  channel: String!
  referenceId: String       # 第三方交易号
  status: PaymentStatus!
  createdAt: DateTime!
}

enum TransactionType {
  PAYMENT
  REFUND
}

type Shipment {
  id: ID!
  carrier: Carrier!
  trackingNumber: String!
  status: ShipmentStatus!
  events: [TrackingEvent!]!
  shippedAt: DateTime
  deliveredAt: DateTime
}

type TrackingEvent {
  status: String!
  location: String
  description: String!
  occurredAt: DateTime!
}

# === 查询 (Query) ===

type Query {
  # 商品查询
  product(id: ID!): Product
  products(
    first: Int = 20
    after: String
    category: ID
    brand: ID
    priceMin: Float
    priceMax: Float
    sortBy: ProductSort = CREATED_DESC
    search: String
  ): ProductConnection!

  # 搜索
  search(
    query: String!
    type: SearchType = ALL
    first: Int = 20
    after: String
  ): SearchResultConnection!

  # 订单查询
  order(id: ID!): Order
  orders(
    first: Int = 20
    after: String
    status: OrderStatus
    createdAtFrom: DateTime
    createdAtTo: DateTime
  ): OrderConnection!

  # 购物车
  cart: Cart

  # 分类
  categories: [Category!]!
}

# === 变更 (Mutation) ===

type Mutation {
  # 购物车
  addToCart(input: AddToCartInput!): Cart!
  updateCartItem(input: UpdateCartItemInput!): CartItem!
  removeFromCart(input: RemoveCartItemInput!): Cart!
  clearCart: Cart!

  # 订单
  createOrder(input: CreateOrderInput!): Order!
  cancelOrder(id: ID!, reason: String): Order!

  # 支付
  createPayment(input: CreatePaymentInput!): Payment!
  # 注意: 支付回调不走 GraphQL，走 REST webhook

  # 退款
  requestRefund(input: RequestRefundInput!): PaymentTransaction!

  # 评价
  createReview(input: CreateReviewInput!): Review!
}

# === 订阅 (Subscription) ===

type Subscription {
  orderStatusChanged(orderId: ID!): Order!
  paymentStatusChanged(paymentId: ID!): Payment!
  inventoryAlert(skuId: ID!, threshold: Int = 10): InventoryStatus!
}

# === 连接类型 (Connection/Pagination) ===

type ProductConnection {
  edges: [ProductEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ProductEdge {
  node: Product!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean
  startCursor: String
  endCursor: String
}

# === 输入类型 ===

input AddToCartInput {
  skuId: ID!
  quantity: Int! = 1
}

input CreateOrderInput {
  items: [OrderItemInput!]!
  address: ShippingAddressInput!
  couponCode: String
  invoiceType: InvoiceType
  remark: String
  idempotencyKey: String!
}

input OrderItemInput {
  skuId: ID!
  quantity: Int!
}

input CreatePaymentInput {
  orderId: ID!
  method: PaymentMethod!
  idempotencyKey: String!
}

input RequestRefundInput {
  paymentId: ID!
  amount: Float!
  reason: String!
  idempotencyKey: String!
}
```

### 4.2 查询示例

```graphql
# === 查询商品详情 (含 SKU + 库存) ===
query ProductDetail($id: ID!) {
  product(id: $id) {
    id
    name
    description
    images { url thumbnail }
    category { id name path }
    brand { id name logo }
    averageRating
    reviewCount
    skus {
      id
      specs { name value }
      price { amount currency }
      originalPrice { amount }
      inventory { available inStock }
      images { url }
    }
  }
}

# === 商品列表 (筛选 + 分页) ===
query ProductList($after: String, $category: ID, $priceMax: Float) {
  products(
    first: 20
    after: $after
    category: $category
    priceMax: $priceMax
    sortBy: PRICE_ASC
  ) {
    edges {
      node {
        id
        name
        images { thumbnail }
        sku {
          price { amount }
          inventory { inStock }
        }
      }
      cursor
    }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}

# === 订单详情 (含支付 + 物流) ===
query OrderDetail($id: ID!) {
  order(id: $id) {
    id
    orderNo
    status
    items {
      product { name images { thumbnail } }
      sku { specs { name value } }
      quantity
      unitPrice { amount currency }
      subtotal { amount }
    }
    pricing {
      subtotal { amount }
      discount { amount }
      total { amount }
    }
    payment {
      method
      status
      paidAt
      transactions {
        type
        amount { amount }
        channel
        referenceId
        createdAt
      }
    }
    shipment {
      carrier { name logo }
      trackingNumber
      status
      events { status description occurredAt }
    }
    createdAt
  }
}

# === 搜索 (混合类型) ===
query Search($query: String!, $type: SearchType) {
  search(query: $query, type: $type, first: 20) {
    edges {
      node {
        __typename
        ... on Product {
          id name images { thumbnail }
          sku { price { amount } inventory { inStock } }
        }
        ... on Category {
          id name productCount
        }
        ... on Brand {
          id name logo productCount
        }
      }
    }
    pageInfo { hasNextPage }
  }
}

# === 订阅订单状态变化 ===
subscription OnOrderStatusChange($orderId: ID!) {
  orderStatusChanged(orderId: $orderId) {
    id
    orderNo
    status
    updatedAt
    payment { status paidAt }
    shipment { status shippedAt }
  }
}
```

### 4.3 REST vs GraphQL 选型决策

```typescript
// === 何时用 REST，何时用 GraphQL？ ===

// REST 优势场景:
// 1. 简单 CRUD — 资源操作明确
// 2. 文件上传/下载 — 二进制流处理
// 3. 支付回调 — 第三方平台回调 (表单/签名)
// 4. 公开 API — 第三方开发者易上手
// 5. 缓存友好 — HTTP 缓存天然支持
// 6. 批量操作 — 批量创建/更新

// GraphQL 优势场景:
// 1. 复杂查询 — 多资源关联查询 (订单+支付+物流)
// 2. 移动端 — 减少请求次数，精确获取数据
// 3. 多客户端 — Web/iOS/Android 数据需求不同
// 4. 实时订阅 — WebSocket 订阅状态变化
// 5. 内部 API — 前端团队自主查询，减少后端改 API

// === 混合架构推荐 ===

// 电商 API 混合方案:
//
// REST:
//   POST /v1/payments/callback     ← 支付回调 (第三方)
//   POST /v1/orders                ← 创建订单 (幂等写入)
//   POST /v1/orders/:id/payments   ← 创建支付 (幂等写入)
//   POST /v1/webhooks              ← Webhook 管理
//   GET  /v1/carriers              ← 静态数据
//
// GraphQL:
//   query product                  ← 商品详情 (关联查询)
//   query orderDetail              ← 订单详情 (支付+物流)
//   query search                   ← 全文搜索
//   subscription orderStatus       ← 实时状态订阅
//   mutation addToCart             ← 购物车操作
```

---

## 五、API 治理与生产级 Checklist

### 5.1 API 治理框架

```
┌─────────────────────────────────────────────────────┐
│                  API 治理框架                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ 标准规范  │  │ 安全治理  │  │ 性能治理  │         │
│  │          │  │          │  │          │         │
│  │ • 命名规范│  │ • 认证    │  │ • 限流    │         │
│  │ • 版本策略│  │ • 鉴权    │  │ • 缓存    │         │
│  │ • 错误规范│  │ • 加密    │  │ • 超时    │         │
│  │ • 文档规范│  │ • 审计    │  │ • 降级    │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ 监控告警  │  │ 生命周期  │  │ 开发者体验│         │
│  │          │  │          │  │          │         │
│  │ • 指标    │  │ • 设计评审│  │ • SDK    │         │
│  │ • 日志    │  │ • 测试    │  │ • 文档    │         │
│  │ • 追踪    │  │ • 发布    │  │ • 沙箱    │         │
│  │ • 告警    │  │ • 弃用    │  │ • 社区    │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.2 API 质量 Checklist

```markdown
## API 设计 Checklist

### 命名规范
- [ ] 资源名使用复数名词 (/users, /orders)
- [ ] 路径使用 kebab-case (/user-profiles)
- [ ] 字段使用 snake_case (created_at) 或 camelCase (createdAt) 统一
- [ ] 动作使用 HTTP 方法，不在 URL 中使用动词
- [ ] 子资源使用嵌套 (/orders/:id/items)

### 响应规范
- [ ] 统一响应格式 (data/meta/error)
- [ ] 成功返回 200/201/204
- [ ] 错误返回 4xx/5xx + 错误码体系
- [ ] 列表返回分页信息
- [ ] 包含请求 ID (X-Request-ID)

### 安全
- [ ] 认证 (JWT/OAuth2/API Key)
- [ ] 鉴权 (RBAC/ABAC)
- [ ] HTTPS 强制
- [ ] CORS 配置
- [ ] 速率限制
- [ ] 输入验证 + 输出过滤
- [ ] SQL 注入防护
- [ ] XSS 防护
- [ ] CSRF 防护 (Cookie 场景)
- [ ] 敏感数据脱敏

### 性能
- [ ] 分页 (默认值 + 最大值限制)
- [ ] 字段选择 (fields 参数)
- [ ] 缓存策略 (ETag/Cache-Control)
- [ ] 压缩 (gzip/brotli)
- [ ] 连接池
- [ ] 超时设置
- [ ] 批量操作支持

### 可靠性
- [ ] 幂等性 (POST/PATCH)
- [ ] 重试机制 (客户端 + 服务端)
- [ ] 熔断器
- [ ] 降级策略
- [ ] 健康检查端点
- [ ] 优雅关闭

### 文档
- [ ] OpenAPI/Swagger 规范
- [ ] 请求/响应示例
- [ ] 错误码文档
- [ ] 认证说明
- [ ] 速率限制说明
- [ ] 变更日志
```

### 5.3 API 监控指标

```typescript
// === API 监控指标体系 ===

const API_METRICS = {
  // 流量指标
  traffic: {
    requests_per_second: 'RPS',
    requests_total: '累计请求数',
    active_connections: '活跃连接数',
    bandwidth_in: '入站带宽',
    bandwidth_out: '出站带宽',
  },

  // 延迟指标
  latency: {
    p50: '50% 请求延迟',
    p95: '95% 请求延迟',
    p99: '99% 请求延迟',
    p999: '99.9% 请求延迟',
    avg: '平均延迟',
  },

  // 错误指标
  errors: {
    error_rate_4xx: '4xx 错误率',
    error_rate_5xx: '5xx 错误率',
    timeout_rate: '超时率',
    circuit_breaker_trips: '熔断触发次数',
  },

  // 业务指标
  business: {
    orders_per_minute: '每分钟订单数',
    payment_success_rate: '支付成功率',
    refund_rate: '退款率',
    active_users: '活跃用户数',
  },

  // 告警规则
  alerts: [
    { condition: 'p99 > 2s', severity: 'warning', action: '排查慢查询' },
    { condition: '5xx rate > 1%', severity: 'critical', action: '立即排查' },
    { condition: 'RPS > 80% limit', severity: 'warning', action: '扩容准备' },
    { condition: 'error_rate > 5%', severity: 'critical', action: '熔断检查' },
    { condition: 'circuit_breaker OPEN', severity: 'critical', action: '依赖服务检查' },
  ]
};
```

---

## 六、API 设计原则总结 (v1-v9 精华)

### 6.1 核心原则清单

```
1. 资源导向          → URL 表示资源，HTTP 方法表示操作
2. 无状态            → 每次请求自包含，不依赖服务端状态
3. 统一接口          → 一致的命名/格式/错误处理
4. 向前兼容          → 只加不改，破坏性变更需新版本
5. 幂等安全          → 网络重试不产生副作用
6. 分层系统          → 客户端不需要知道后端架构
7. 可发现性          → HATEOAS / 链接头 / 文档
8. 最小可用          → 只返回必要字段 (fields 参数)
9. 防御性设计         → 输入验证 + 输出过滤 + 错误兜底
10. 可观测性          → 日志 + 指标 + 追踪三位一体
```

### 6.2 HTTP 状态码速查

```
2xx 成功:
  200 OK                    成功
  201 Created               创建成功
  204 No Content            成功但无返回体
  206 Partial Content       部分内容 (分片下载)

3xx 重定向:
  301 Moved Permanently     永久重定向
  302 Found                 临时重定向
  304 Not Modified          缓存命中
  308 Permanent Redirect    永久重定向 (保留方法)

4xx 客户端错误:
  400 Bad Request           请求格式错误
  401 Unauthorized          未认证
  403 Forbidden             已认证但无权限
  404 Not Found             资源不存在
  405 Method Not Allowed    方法不允许
  409 Conflict              资源冲突
  422 Unprocessable         语义错误 (业务规则)
  429 Too Many Requests     速率限制

5xx 服务端错误:
  500 Internal Server Error 内部错误
  502 Bad Gateway           网关错误
  503 Service Unavailable   服务不可用
  504 Gateway Timeout       网关超时
```

---

## 七、本次训练总结

### 完成内容

| 模块 | 内容 | 状态 |
|------|------|------|
| API 演进策略 | 版本控制/向前兼容/弃用生命周期/渐进式迁移 | ✅ |
| 分布式 API 模式 | 幂等性/乐观锁/API 网关/熔断器 | ✅ |
| 事件驱动 API | Webhook/SSE/签名验证/重试策略 | ✅ |
| 电商完整 API | 商品/订单/支付/库存/物流/售后 | ✅ |
| GraphQL 电商 Schema | 类型定义/查询/变更/订阅/混合架构 | ✅ |
| API 治理 | 治理框架/质量 Checklist/监控指标 | ✅ |

### 与 v8 的区别 (新增内容)

- **v8**: 项目管理 SaaS API + OpenAPI 3.1 文档
- **v9**: API 演进策略 + 分布式模式 + 电商支付领域 + GraphQL 混合 + API 治理

### 关键收获

1. **API 演进是必修课** — 任何生产 API 都会面临版本迁移，提前设计弃用策略
2. **幂等性是底线** — 所有写操作必须幂等，网络不可靠是分布式系统的铁律
3. **REST + GraphQL 混合是趋势** — REST 处理写入/回调，GraphQL 处理查询/订阅
4. **API 治理决定 API 寿命** — 没有治理的 API 会快速腐化
5. **电商 API 是最佳练习场景** — 涵盖幂等/并发/状态机/支付回调等全部高级模式

---

*API 设计 v9 完成。下一轮可考虑: API 安全专题 (OAuth2/OIDC/SAML)、gRPC/Protobuf 深度、或 API 性能优化专题。*
