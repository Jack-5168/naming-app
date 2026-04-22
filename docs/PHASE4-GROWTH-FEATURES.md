# Phase 4 增长功能设计文档

## 概述

Phase 4 专注于用户增长和病毒式传播功能，通过双人合测和分享卡片系统，实现用户自发传播和付费转化。

**核心目标：**
- 提升用户增长率（目标：月增长 30%+）
- 提高付费转化率（目标：5% → 8%）
- 建立 KOC 分销体系

---

## 功能模块

### 1. 双人合测系统 (Dual Test)

#### 1.1 功能描述

允许已完成测试的用户邀请好友进行双人合测，生成详细的兼容性分析报告。

#### 1.2 用户流程

```
1. 用户 A 完成测试 → 看到"邀请好友合测"入口
2. 用户 A 选择邀请方式（微信/链接/二维码）
3. 用户 B 收到邀请 → 点击链接完成测试
4. 系统生成兼容性报告
5. 双方查看完整报告（需付费解锁）
```

#### 1.3 核心功能

**创建邀请**
- 生成唯一邀请码（8 位大写字母）
- 生成分享链接和二维码
- 设置 7 天有效期

**邀请方式**
- 微信好友（模板消息）
- 微信链接（可复制）
- 二维码（保存到相册）
- 邮件（预留）

**兼容性分析**
- 匹配度评分（0-100 分）
- 四维度兼容性分析（E-I, N-S, T-F, J-P）
- 冲突预警（潜在矛盾点）
- 关系建议（相处之道）

#### 1.4 定价策略

- 单次合测：¥99
- 会员包含：Pro 会员每月 3 次，Enterprise 会员无限次
- 首次体验：¥9.9（限时优惠）

#### 1.5 技术实现

**后端接口**
```
POST   /api/v1/dual-test/create          # 创建合测邀请
POST   /api/v1/dual-test/accept          # 接受邀请
POST   /api/v1/dual-test/complete        # 完成合测
GET    /api/v1/dual-test/:id             # 获取合测详情
GET    /api/v1/dual-test/:id/report      # 获取完整报告
GET    /api/v1/dual-test/invite/:code    # 通过邀请码获取信息
```

**核心算法**
- 维度差异计算（0-100 分）
- 类型互动加成（互补类型 +15%）
- 冲突预警生成（差异 > 40 触发）

---

### 2. 分享卡片系统 (Share Cards)

#### 2.1 功能描述

生成精美的 MBTI 类型分享卡片，支持保存到相册和社交分享。

#### 2.2 卡片内容

**基础信息**
- 用户 MBTI 类型（如 INFJ）
- 类型名称（如"提倡者"）
- 类型描述（一句话特点）

**数据可视化**
- 四维度得分条（E, N, T, J）
- 人格稳定性指数
- 测试次数（如基于 3 次测试）

**社交元素**
- 个性化文案（如"只有 1% 的人是这个类型"）
- 金句引用（类型特色语录）
- 二维码（扫码测试）
- 品牌标识（人格探索局）

#### 2.3 卡片模板

**模板 1：标准版**
- 完整信息展示
- 适合朋友圈分享

**模板 2：简约版**
- 仅显示类型和二维码
- 适合快速分享

**模板 3：详细版**
- 包含所有维度和稳定性
- 适合深度分享

#### 2.4 分享渠道

- 微信好友
- 微信朋友圈
- QQ 好友
- 复制链接
- 保存相册

#### 2.5 技术实现

**后端接口**
```
GET    /api/v1/share/card/personality    # 生成性格卡片
GET    /api/v1/share/card/stability      # 生成稳定性卡片
GET    /api/v1/share/card/dual-test      # 生成合测邀请卡片
POST   /api/v1/share/track               # 记录分享行为
GET    /api/v1/share/stats               # 获取分享统计
```

**前端组件**
- `<ShareCard />` - 卡片渲染组件
- 支持 Canvas 生成图片
- 支持保存到相册

---

### 3. 邀请码系统 (Invite Codes)

#### 3.1 功能描述

通用邀请码管理，支持多种营销场景。

#### 3.2 邀请码类型

**通用邀请码**
- 任何用户可创建
- 30 天有效期
- 用于拉新奖励

**KOC 分销码**
- KOC 专属邀请码
- 15% 佣金比例
- 永久有效

**活动邀请码**
- 限时活动专用
- 可设置使用次数限制
- 可设置优惠金额

#### 3.3 使用流程

```
1. 用户创建/获取邀请码
2. 分享给好友
3. 好友使用邀请码注册/付费
4. 系统自动记录关联
5. 发放奖励/佣金
```

#### 3.4 技术实现

**后端接口**
```
POST   /api/v1/share/invite-code         # 创建邀请码
GET    /api/v1/share/invite-code/:code   # 验证邀请码
POST   /api/v1/share/invite-code/:code/use  # 使用邀请码
```

---

### 4. KOC 分销系统 (KOC Distribution)

#### 4.1 功能描述

关键意见消费者（KOC）分销体系，激励用户推广产品并获得佣金。

#### 4.2 佣金结构

**基础佣金**
- 付费会员：15% 佣金
- 双人合测：15% 佣金
- 报告解锁：10% 佣金

**阶梯奖励**
- 月推广 10 单：额外 5% 奖金
- 月推广 50 单：额外 10% 奖金
- 月推广 100 单：额外 15% 奖金

#### 4.3 提现规则

- 最低提现金额：¥50
- 提现方式：支付宝
- 到账时间：3 个工作日
- 手续费：平台承担

#### 4.4 技术实现

**后端接口**
```
GET    /api/v1/growth/koc/referral-link  # 获取推广链接
GET    /api/v1/growth/koc/commissions    # 获取佣金记录
POST   /api/v1/growth/koc/withdraw       # 申请提现
GET    /api/v1/growth/koc/dashboard      # 获取 KOC 看板
```

---

## 数据库设计

### DualTest 表

```prisma
model DualTest {
  id                  Int      @id @default(autoincrement())
  initiatorId         Int
  initiatorTestId     Int
  participantId       Int?
  participantTestId   Int?
  inviteCode          String   @unique
  invitationMethod    String   // wechat, link, qrcode, email
  inviteeEmail        String?
  inviteeWechat       String?
  status              DualTestStatus // pending, accepted, completed
  compatibilityScore  Float?
  conflictWarnings    String?  // JSON
  relationshipAdvice  String?  // JSON
  dimensionAnalysis   String?  // JSON
  createdAt           DateTime @default(now())
  acceptedAt          DateTime?
  completedAt         DateTime?
  expiresAt           DateTime
  
  initiator           User     @relation("DualTestInitiator", fields: [initiatorId], references: [id])
  participant         User?    @relation("DualTestParticipant", fields: [participantId], references: [id])
  initiatorTestResult TestResult @relation(fields: [initiatorTestId], references: [id])
  participantTestResult TestResult? @relation(fields: [participantTestId], references: [id])
}
```

### Share 表

```prisma
model Share {
  id          Int      @id @default(autoincrement())
  userId      Int
  type        ShareType // personality_card, stability_card, dual_test_invite
  channel     ShareChannel // wechat, moment, qq, link, weibo
  targetId    Int?
  sharedAt    DateTime @default(now())
  
  user        User     @relation(fields: [userId], references: [id])
}
```

### InviteCode 表

```prisma
model InviteCode {
  id          Int      @id @default(autoincrement())
  userId      Int
  code        String   @unique
  type        String   // general, referral, campaign
  metadata    String?  // JSON
  status      String   // active, used, expired
  usedBy      Int?
  createdAt   DateTime @default(now())
  usedAt      DateTime?
  expiresAt   DateTime
  
  user        User     @relation(fields: [userId], references: [id])
}
```

---

## 兼容性分析算法

### 维度兼容性计算

```typescript
function calculateDimensionCompatibility(
  score1: number, // 0-100
  score2: number  // 0-100
): number {
  const difference = Math.abs(score1 - score2);
  
  if (difference <= 15) return 1.0;    // 高度兼容
  if (difference <= 30) return 0.8;    // 兼容
  if (difference <= 50) return 0.6;    // 中等
  return 0.4;                           // 挑战性
}
```

### 类型互动加成

```typescript
const complementaryPairs = [
  ['INFJ', 'ENFP'], // 黄金配对
  ['INTJ', 'ENTP'],
  ['INFP', 'ENFJ'],
  ['INTP', 'ENTJ'],
  // ... 更多配对
];

function getTypeInteractionBonus(type1: string, type2: string): number {
  // 互补类型：0.95
  // 相同类型：0.85
  // 完全相反：0.65
  // 默认：0.75
}
```

### 总体兼容性评分

```typescript
overallScore = (
  avgDimensionScore * 0.7 + 
  typeInteractionBonus * 0.3
)
```

---

## 分享统计指标

### 核心指标

- **分享率**：分享用户数 / 完成测试用户数
- **病毒系数 (K 值)**：每个用户平均邀请人数
- **转化率**：通过分享注册并付费的用户比例
- **分享渠道分布**：各渠道分享占比

### 追踪事件

```typescript
interface ShareEvent {
  userId: number;
  type: 'personality_card' | 'stability_card' | 'dual_test_invite';
  channel: 'wechat' | 'moment' | 'qq' | 'link';
  targetId?: number;
  sharedAt: Date;
}
```

---

## 安全与风控

### 防滥用机制

1. **邀请码限制**
   - 每用户每日最多创建 10 个邀请码
   - 邀请码 7-30 天有效期
   - 单邀请码最多使用 1 次

2. **分享频率限制**
   - 每用户每小时最多分享 20 次
   - 同一内容 24 小时内不重复推送

3. **佣金风控**
   - 新用户 7 天后佣金才可提现
   - 异常行为自动冻结（如自买自卖）
   - 人工审核大额提现（>¥1000）

---

## 性能优化

### 图片生成

- 使用 CDN 缓存分享卡片
- 预生成热门类型卡片
- Canvas 渲染优化（离屏渲染）

### 数据库优化

- 分享记录分表（按月）
- 兼容性结果缓存（Redis）
- 邀请码索引优化

---

## 未来扩展

### 短期（Phase 4.1）

- [ ] 批量邀请功能
- [ ] 合测报告 PDF 导出
- [ ] 分享模板市场

### 中期（Phase 4.2）

- [ ] 群组合测（3-8 人）
- [ ] 情侣专属报告
- [ ] 团队兼容性分析

### 长期（Phase 4.3）

- [ ] AI 关系顾问
- [ ] 定期关系检查
- [ ] 社交匹配推荐

---

## 成功指标

### 业务指标

| 指标 | 基线 | 目标 | 实际 |
|------|------|------|------|
| 分享率 | - | 30% | - |
| 病毒系数 K | - | 1.5 | - |
| 合测转化率 | - | 25% | - |
| KOC 参与率 | - | 5% | - |

### 技术指标

| 指标 | 目标 |
|------|------|
| API 响应时间 | < 200ms |
| 卡片生成时间 | < 1s |
| 系统可用性 | 99.9% |

---

## 附录

### A. MBTI 类型兼容性矩阵

完整 16x16 类型兼容性评分表（略）

### B. 分享文案模板

```
- 我是{type}型人格 - 只有{rarity}的人是这个类型
- 我的性格稳定性指数：{stability}%
- {name}邀请你进行 MBTI 双人合测
```

### C. 错误码定义

| 错误码 | 说明 |
|--------|------|
| 4001 | 邀请码无效 |
| 4002 | 邀请码已过期 |
| 4003 | 邀请码已使用 |
| 4004 | 无合测权限 |
| 4005 | 分享频率超限 |

---

**文档版本**: v1.0  
**创建日期**: 2026-04-22  
**最后更新**: 2026-04-22  
**负责人**: 开发团队
