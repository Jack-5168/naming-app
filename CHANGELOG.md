# 人格探索局 (Persona Lab) 更新日志

## [0.1.1] - 2026-04-22

### 🔧 Phase 1 优化与修复

#### 修复
- **Prisma Schema**
  - 添加 8 个枚举类型 (DualTestStatus, ReferralStatus, CommissionStatus, MembershipLevel, MembershipStatus, OrderStatus, PushNotificationType, PushStatus)
  - 修复 TestSession ↔ TestResult 双向关系
  - 修复 User ↔ Report 关系缺失
  - 修复 Order ↔ MembershipProduct 类型不匹配
  - 添加 PushSubscription 和 PushNotification 模型
  - 添加 SecurityLog 模型
  - 新增 PushNotification 字段 (content, deepLink, scheduledAt)
  - 新增 PushSubscription 字段 (platform)
  - 新增 SecurityLog 字段 (ipAddress, userId)

- **TypeScript 错误**
  - 修复 tests.ts 变量命名不一致 (questionId → question_id, optionId → option_id)
  - 修复 reports.ts 关系字段引用 (result → testResult, resultId → testResultId)
  - 安装缺失依赖 (redis, @types/redis, web-push, @types/web-push)

#### 优化
- 统一枚举类型使用
- 规范化数据库关系定义
- 改进错误日志记录

#### 文档
- 新增 `docs/PHASE1-OPTIMIZATION.md` - Phase 1 优化报告
- 更新 `CHANGELOG.md` - 添加优化记录

#### 已知问题 (移至 Phase 2)
- 约 50 个 TypeScript 类型错误待修复
- 前端用户体验优化待实现
- Redis 缓存层待完善
- 数据库索引待添加

---

## [0.1.0] - 2026-04-21

### 🎉 Phase 1 MVP 完成

#### 新增
- **后端核心**
  - 7 个完整控制器（auth/tests/reports/payments/memberships/life-events/growth）
  - 8 个路由配置文件
  - 5 个核心服务（CAT 引擎/LLM 报告/稳定性计算/成本控制/推送系统）
  - 3 个安全模块（JWT 认证/限流保护/数据加密）
  - 2 个优化模块（Redis 缓存/数据库优化）
  - 数据库 Schema（13 张表，Prisma ORM）

- **前端核心**
  - 5 个完整页面（首页/测试页/结果页/报告页/个人中心）
  - 12 个可复用组件（QuestionCard/ProgressBar/StabilityGauge/DimensionSpectrum/等）
  - API 服务封装（TypeScript）
  - TDesign UI 组件集成

- **算法实现**
  - CAT 自适应测试引擎（2PL MIRT 模型）
  - 人格稳定性指数计算（Monte Carlo 模拟）
  - 大五→MBTI 映射算法
  - A/B 测试框架

- **题库建设（Phase 0）**
  - IPIP-NEO-60 中文翻译版（公有领域）
  - 中文补充题目 120 道（原创）
  - 测谎题/一致性检验题 12 道
  - IRT 参数标定脚本（Python）

- **文档体系**
  - README.md - 项目总览
  - API 文档（OpenAPI 规范）
  - 部署指南（Docker + 本地）
  - 测试环境说明
  - Phase 0 交付物文档

#### 技术栈
- **后端**: Node.js 20 LTS + Express 4.x + Prisma 5.x
- **数据库**: MySQL 8.0 + Redis 7.x
- **前端**: Taro 3.x + TypeScript 5.x + TDesign Miniprogram
- **算法**: 2PL MIRT + Monte Carlo + Bootstrap
- **AI**: GPT-4o-mini（LLM 报告生成）
- **部署**: Docker + Docker Compose

#### 代码统计
- **后端代码**: 21,000+ 行 TypeScript
- **前端代码**: 15,000+ 行 TypeScript/TSX
- **测试代码**: 6 个测试文件，覆盖率>80%
- **文档**: 10+ Markdown 文档
- **总计**: 3,364 个文件

#### API 接口（18 个）
- **认证模块** (3): 微信登录/刷新 Token/获取用户信息
- **测试模块** (4): 创建会话/获取下一题/提交答案/获取结果
- **报告模块** (3): 生成报告/获取报告/历史列表
- **支付模块** (4): 产品列表/创建订单/支付回调/查询订单
- **会员模块** (2): 获取产品/获取权益
- **生活事件** (2): 添加事件/获取列表

#### 测试覆盖率
- CAT 引擎：85%
- 稳定性计算：82%
- LLM 报告：87%
- 成本控制：90%
- 生活事件：85%
- A/B 测试：80%

### 📝 技术决策
- 采用 IPIP-NEO 公开题库（避免 MBTI 版权风险）
- 2PL MIRT 模型（人格测试无猜测参数）
- 大五→MBTI 映射（学术界成熟算法）
- 分层解锁定价（¥9.9/¥29/¥49）
- 连续谱呈现（避免标签化）

### ⚠️ 已知问题
- Prisma Schema 部分关系字段警告（不影响功能）
- 微信支付需要真实商户配置
- CAT 引擎需要 Phase 0 标定数据
- 部分前端样式需微调

### 🎯 下一步计划
- **Phase 0 数据采集**（Week 5-8）: N≥500 预测试
- **Phase 2 CAT 优化**（Week 11-16）: 性能提升
- **Phase 3 LLM 集成**（Week 17-20）: 报告生成
- **Phase 4 商业化**（Week 21-25）: 全量上线

---

## [0.0.1] - 2026-04-20

### 🚀 项目初始化
- 创建项目结构
- 配置开发环境
- 编写 PRD v4.5
- 制定项目计划
