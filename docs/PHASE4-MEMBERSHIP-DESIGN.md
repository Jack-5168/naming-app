# Phase 4 会员系统设计文档

## 1. 概述

### 1.1 项目背景
Persona Lab 会员权益管理系统（Phase 4）旨在为用户提供多层次的会员服务体系，通过差异化的权益配置实现商业化变现。

### 1.2 设计目标
- ✅ 支持 6 档会员套餐配置
- ✅ 实现会员权益使用次数追踪
- ✅ 提供会员状态管理和自动降级
- ✅ 预留支付接口对接点（Mock 支付）
- ✅ 前后端完整的会员管理功能

### 1.3 技术栈
- **后端**: Node.js + Express + TypeScript + Prisma
- **前端**: Taro + React + TypeScript
- **数据库**: PostgreSQL (通过 Prisma ORM)

---

## 2. 会员权益配置

### 2.1 6 档会员套餐

| 档位 | 价格 | 有效期 | 基础报告 | 专业报告 | 生活事件 | 双人合测 | 优先支持 |
|------|------|--------|----------|----------|----------|----------|----------|
| **免费版** | ¥0 | 永久 | 1 次 | 0 次 | 5 次 | 0 次 | ❌ |
| **基础报告** | ¥9.9 | 永久 | 1 次 | 0 次 | 5 次 | 0 次 | ❌ |
| **专业报告** | ¥29 | 永久 | 无限 | 1 次 | 10 次 | 0 次 | ❌ |
| **月会员** | ¥49/月 | 30 天 | 无限 | 3 次/月 | 无限 | 1 次/月 | ❌ |
| **年会员** | ¥199/年 | 365 天 | 无限 | 无限 | 无限 | 3 次/年 | ✅ |
| **双人合测** | ¥99 | 永久 | 无限 | 2 次 | 无限 | 1 次 | ❌ |

### 2.2 权益类型说明

#### 基础报告 (report_basic)
- 完整人格测试报告
- 包含四维得分详情
- 基础发展建议

#### 专业报告 (report_pro)
- 职业匹配分析
- 人际关系指南
- 压力管理建议
- 学习风格分析

#### 生活事件 (life_event)
- 人格与生活事件关联分析
- 阶段性成长记录
- 关键节点建议

#### 双人合测 (dual_test)
- 邀请好友进行双人测试
- 关系匹配度分析
- 相处建议报告

#### 优先支持 (priority_support)
- 专属客服通道
- 优先问题响应
- 专属成长顾问

---

## 3. 系统架构

### 3.1 后端架构

```
server/src/
├── controllers/
│   └── memberships-v2.ts      # 会员控制器（v4.5）
├── services/
│   └── membership-benefits.ts # 会员权益服务
├── models/
│   └── membership-tier.ts     # 会员等级模型
└── middleware/
    └── auth.ts                # 认证中间件（已有）
```

### 3.2 前端架构

```
miniapp/src/
├── pages/
│   └── membership/
│       ├── membership.tsx     # 会员页面
│       └── membership.css
├── components/
│   ├── MembershipCard.tsx     # 会员卡片组件
│   ├── MembershipCard.css
│   ├── PricingTable.tsx       # 定价表组件
│   └── PricingTable.css
└── services/
    └── api.ts                 # API 服务（已有）
```

### 3.3 数据库模型

```prisma
model Membership {
  id        Int              @id @default(autoincrement())
  userId    Int              @unique
  level     MembershipLevel  @default(FREE)
  status    MembershipStatus @default(ACTIVE)
  startDate DateTime
  endDate   DateTime
  autoRenew Boolean          @default(false)
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt
  
  user User @relation(fields: [userId], references: [id])
  orders Order[]
}

enum MembershipLevel {
  FREE
  BASIC
  PRO
  PREMIUM
}

enum MembershipStatus {
  ACTIVE
  EXPIRED
  CANCELLED
}

model UsageRecord {
  id        Int      @id @default(autoincrement())
  userId    Int
  feature   String
  metadata  Json?
  consumedAt DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id])
}
```

---

## 4. API 接口设计

### 4.1 会员套餐接口

#### GET /api/v1/memberships/tiers
获取所有会员套餐信息

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "tier": "FREE",
      "name": "免费版",
      "price": 0,
      "priceDisplay": "¥0",
      "durationDays": 0,
      "benefits": {
        "report_basic": 1,
        "report_pro": 0,
        "life_event": 5,
        "dual_test": 0,
        "priority_support": false
      },
      "features": ["1 次基础报告", "5 次生活事件"],
      "isPopular": false
    }
  ]
}
```

### 4.2 当前会员接口

#### GET /api/v1/memberships/me
获取当前用户的会员状态

**Response:**
```json
{
  "success": true,
  "data": {
    "tier": "PRO_MONTHLY",
    "tierName": "月会员",
    "status": "active",
    "startDate": "2026-04-01T00:00:00Z",
    "endDate": "2026-05-01T00:00:00Z",
    "autoRenew": false,
    "benefits": { ... },
    "usage": [
      {
        "benefit": "report_pro",
        "used": 1,
        "limit": 3,
        "remaining": 2,
        "resetDate": "2026-05-01T00:00:00Z"
      }
    ]
  }
}
```

### 4.3 升级接口

#### POST /api/v1/memberships/upgrade
升级会员套餐

**Request:**
```json
{
  "tier": "PRO_MONTHLY",
  "productId": 4
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "membership": {
      "tier": "PRO_MONTHLY",
      "status": "active",
      "endDate": "2026-05-01T00:00:00Z"
    },
    "order": {
      "orderId": 123,
      "transactionId": "TXN123456"
    }
  },
  "message": "会员升级成功"
}
```

### 4.4 权益检查接口

#### POST /api/v1/memberships/check/:benefit
检查用户是否可以使用某项权益

**Response:**
```json
{
  "success": true,
  "data": {
    "benefit": "report_pro",
    "allowed": true,
    "remaining": 2,
    "resetDate": "2026-05-01T00:00:00Z"
  }
}
```

### 4.5 权益消耗接口

#### POST /api/v1/memberships/consume/:benefit
记录权益使用

**Request:**
```json
{
  "metadata": {
    "reportId": 456,
    "testType": "full"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "benefit": "report_pro",
    "consumed": true,
    "remaining": 1,
    "resetDate": "2026-05-01T00:00:00Z"
  }
}
```

---

## 5. 核心业务逻辑

### 5.1 会员状态检查

```typescript
async function getUserMembership(userId: number) {
  const membership = await prisma.membership.findUnique({
    where: { userId },
  });

  // 检查是否过期
  if (!membership || membership.endDate < new Date()) {
    return null; // 降级为免费版
  }

  if (membership.status !== 'active') {
    return null;
  }

  return membership;
}
```

### 5.2 权益使用次数追踪

```typescript
async function checkBenefitAccess(userId: number, benefit: string) {
  const membership = await getUserMembership(userId);
  const tier = membership?.tier || 'FREE';
  
  const limit = getBenefitLimit(tier, benefit);
  
  if (limit === 'unlimited') {
    return { allowed: true, remaining: 'unlimited' };
  }

  const usage = await getBenefitUsage(userId, benefit, membership);
  const remaining = limit - usage;

  return {
    allowed: remaining > 0,
    remaining,
    resetDate: getResetDate(tier, membership),
  };
}
```

### 5.3 会员到期处理

```typescript
async function processExpiredMemberships() {
  const expiredMemberships = await prisma.membership.findMany({
    where: {
      status: 'active',
      endDate: { lt: new Date() },
    },
  });

  for (const membership of expiredMemberships) {
    await prisma.membership.update({
      where: { id: membership.id },
      data: {
        status: 'expired',
        level: 'free',
      },
    });
  }
}
```

### 5.4 周期性权益重置

- **月会员**: 每 30 天重置一次权益次数
- **年会员**: 每 365 天重置一次权益次数
- **永久套餐**: 不重置，一次性使用

---

## 6. 前端组件设计

### 6.1 会员页面 (membership.tsx)

**功能:**
- 展示 6 档会员套餐
- 显示当前会员状态
- 支持会员升级操作
- 查看权益使用情况

**UI 结构:**
```
┌─────────────────────────────┐
│       会员中心 Header        │
├─────────────────────────────┤
│   当前会员状态卡片           │
│   (MembershipCard)          │
├─────────────────────────────┤
│   会员套餐列表              │
│   - 免费版                  │
│   - 基础报告                │
│   - 专业报告 (热门)         │
│   - 月会员                  │
│   - 年会员 (热门)           │
│   - 双人合测                │
├─────────────────────────────┤
│   [查看详细对比表]          │
└─────────────────────────────┘
```

### 6.2 会员卡片组件 (MembershipCard.tsx)

**Props:**
```typescript
interface MembershipCardProps {
  tier: string;           // 会员等级
  tierName: string;       // 等级名称
  status: 'active' | 'expired' | 'none';
  endDate: string | null; // 到期时间
  usage: UsageItem[];     // 权益使用详情
}
```

**功能:**
- 渐变背景区分不同等级
- 进度条显示权益使用比例
- 自动计算重置日期
- 快捷操作按钮

### 6.3 定价表组件 (PricingTable.tsx)

**功能:**
- 表格形式对比所有套餐
- 横向滚动适配移动端
- 突出显示推荐套餐
- 一键升级入口

---

## 7. Mock 支付集成

### 7.1 支付流程

```
用户选择套餐
    ↓
确认支付弹窗
    ↓
调用 /api/v1/memberships/upgrade
    ↓
创建订单（Mock 成功）
    ↓
更新会员状态
    ↓
发送成功通知
    ↓
刷新页面显示新状态
```

### 7.2 支付接口预留

```typescript
// TODO: 集成真实支付网关
async function processPayment(userId: number, productId: number) {
  // 当前为 Mock 实现
  // 生产环境替换为：
  // - 微信支付
  // - 支付宝
  // - 其他第三方支付
}
```

---

## 8. 安全考虑

### 8.1 权限控制
- 所有会员接口需要 JWT 认证
- 管理员接口需要 admin 权限
- 权益消耗需验证用户身份

### 8.2 数据验证
- 输入参数严格校验
- 会员等级白名单验证
- 防止越权访问

### 8.3 防刷机制
- 权益消耗频率限制
- 订单创建频率限制
- 异常行为监控

---

## 9. 性能优化

### 9.1 缓存策略
- 会员套餐配置缓存（Redis）
- 用户会员状态缓存（5 分钟）
- 权益使用次数缓存（1 分钟）

### 9.2 数据库优化
- UsageRecord 表按用户分表
- 定期清理过期记录
- 索引优化查询性能

---

## 10. 扩展性设计

### 10.1 新增会员等级
在 `membership-tier.ts` 中添加新配置即可，无需修改业务逻辑。

### 10.2 新增权益类型
在 `BenefitLimits` 接口中添加新字段，更新配置表。

### 10.3 支付渠道扩展
实现 `processPayment` 接口，支持多种支付方式。

---

## 11. 测试计划

### 11.1 单元测试
- 会员等级配置测试
- 权益计算逻辑测试
- 到期处理逻辑测试

### 11.2 集成测试
- API 接口测试
- 支付流程测试
- 前端组件测试

### 11.3 压力测试
- 并发升级测试
- 大量权益消耗测试
- 数据库性能测试

---

## 12. 部署计划

### 12.1 后端部署
1. 数据库迁移（Prisma migrate）
2. 服务器代码部署
3. 环境变量配置
4. 定时任务配置（到期处理）

### 12.2 前端部署
1. 小程序代码编译
2. 提交审核
3. 灰度发布
4. 全量发布

---

## 13. 监控与告警

### 13.1 关键指标
- 会员转化率
- 各套餐购买量
- 权益使用率
- 到期续费率

### 13.2 告警规则
- 支付失败率 > 5%
- 接口错误率 > 1%
- 会员到期处理失败

---

## 14. 总结

Phase 4 会员系统设计完整，包含：
- ✅ 6 档会员套餐配置
- ✅ 完整的权益管理逻辑
- ✅ 前后端实现
- ✅ Mock 支付集成
- ✅ 扩展性设计

下一步：
1. 集成真实支付接口
2. 完善监控告警
3. 优化用户体验
4. 数据分析与迭代

---

**文档版本**: v1.0  
**创建时间**: 2026-04-22  
**作者**: Phase 4 Development Team
