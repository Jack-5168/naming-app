# 代码审查报告 — 2026-05-05

## 📋 审查范围

| 模块 | 文件数 | 审查重点 |
|------|--------|----------|
| miniapp (Taro 小程序) | 27 文件 | 规范、安全、性能 |
| server (Express 后端) | 40+ 文件 | 安全、性能、架构 |
| middleware/optimization | 2 文件 | 性能监控、优化 |

---

## 🔴 严重问题 (Critical)

### 1. JWT 密钥回退到随机生成 — 服务重启后所有 Token 失效
**文件**: `server/src/security/auth.ts` L17-18
```ts
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
```
**问题**: 如果环境变量未设置，每次进程启动都会生成新的密钥。这意味着：
- 服务重启后所有已签发 token 立即失效
- 多实例部署时各实例密钥不同，token 无法跨实例验证
**建议**: 必须从环境变量读取，缺少时直接 crash 并给出明确错误提示：
```ts
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
```

### 2. 微信支付密钥硬编码回退值
**文件**: `server/src/controllers/payments.ts` L22-24
```ts
const WECHAT_PAY_MCHID = process.env.WECHAT_PAY_MCHID || '1234567890';
const WECHAT_PAY_KEY = process.env.WECHAT_PAY_KEY || 'your_wechat_pay_key';
```
**问题**: 开发回退值在生产环境可能导致签名错误、资金安全问题。
**建议**: 同上，缺少配置应直接启动失败。

### 3. 加密密钥回退到随机值 — 数据不可解密
**文件**: `server/src/security/encryption.ts` L12
```ts
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
```
**问题**: 重启后旧数据无法解密，等同于数据丢失。
**建议**: 强制要求环境变量。

### 4. API 错误信息泄露内部细节
**文件**: `server/src/index.ts` L96-100
```ts
res.status(err.status || 500).json({
  error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
});
```
**问题**: 虽然生产环境做了保护，但 `err.message` 可能包含 SQL 语句、文件路径等敏感信息。且 `NODE_ENV` 可能被绕过。
**建议**: 始终返回通用错误，详细错误仅记录到日志。

---

## 🟡 重要问题 (High)

### 5. 内存中的 Rate Limit / Refresh Token 存储 — 无持久化
**文件**: `server/src/security/auth.ts` (refreshTokensStore Map)
**文件**: `server/src/security/rate-limiter.ts` (userStore/ipStore Map)
**文件**: `server/src/services/llm-report.ts` (userRateLimits/ipRateLimits Map)
**问题**: 
- 所有限流和 token 数据存储在内存 Map 中，服务重启即丢失
- 多实例部署时各实例独立计数，限流形同虚设
- 内存泄漏风险：Map 只增不减，长期运行会持续增长
**建议**: 
- 生产环境必须使用 Redis
- 内存存储应设置 TTL 自动清理机制
- 增加 Map 大小上限，防止 OOM

### 6. 设备指纹验证为空实现
**文件**: `server/src/security/auth.ts` L127-133
```ts
export async function validateDeviceFingerprint(...): Promise<{ valid: boolean; isNew: boolean }> {
  return { valid: true, isNew: false };
}
```
**问题**: 标注为 "MVP" 但已上线。设备指纹验证完全失效，攻击者可伪造任意设备登录。
**建议**: 至少实现基本的设备绑定逻辑。

### 7. 异常登录检测为空实现
**文件**: `server/src/security/auth.ts` L143-148
```ts
export async function detectAnomalousLogin(...): Promise<{ anomalous: boolean; reasons: string[] }> {
  return { anomalous: false, reasons: [] };
}
```
**问题**: 异常登录检测完全无效，无法防御异地登录、撞库攻击。

### 8. 支付回调缺少幂等性保障
**文件**: `server/src/controllers/payments.ts` — `wechatPaymentCallback`
**问题**: 
- 仅检查 `order.status === 'paid'` 判断是否重复处理
- 如果回调处理到一半（更新订单成功但激活会员失败），微信重试会导致数据不一致
- 缺少数据库事务包裹
**建议**: 使用数据库事务包裹整个回调处理逻辑。

### 9. 订单号生成使用 Math.random() — 不安全
**文件**: `server/src/controllers/payments.ts` L101-102
```ts
const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
```
**问题**: `Math.random()` 不是密码学安全的随机数，可能被预测导致订单号碰撞。
**建议**: 使用 `crypto.randomBytes()` 生成。

### 10. `as any` 类型断言大量使用
**文件**: 多个 server controller 文件
**问题**: `prisma.user.findUnique(...) as any` 绕过了 Prisma 的类型检查，容易引入运行时错误。
**建议**: 使用 Prisma 生成的类型，或定义明确的 DTO 接口。

---

## 🟢 建议改进 (Medium)

### 11. BASE_URL 端口硬编码
**文件**: `miniapp/src/services/api.ts` L3
```ts
const BASE_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
```
**问题**: 今天修改了端口从 3000 → 3001，但仍是硬编码。小程序环境中 `localhost` 无法访问。
**建议**: 使用环境变量或配置文件管理。

### 12. quiz-api.ts 双 API 基地址
**文件**: `miniapp/src/services/quiz-api.ts` L3
```ts
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
```
**问题**: `api.ts` 使用 `/api/v1`，`quiz-api.ts` 使用 `/api`，两套基地址不统一。
**建议**: 统一使用 `api.ts` 中的 `BASE_URL`。

### 13. 提交失败仍标记完成
**文件**: `miniapp/src/pages/quiz/quiz.tsx` L83-85
```ts
} catch (error) {
  console.error('Failed to submit quiz:', error);
  markComplete(); // 失败也标记完成
  navigate('/quiz/results');
}
```
**问题**: API 提交失败后仍然标记 quiz 完成并跳转，用户数据可能丢失。
**建议**: 失败时应提示重试，不应静默跳过。

### 14. CAT 引擎使用 mock 题目
**文件**: `server/src/services/cat-engine.ts` L28-37
```ts
const mockQuestion: Question = {
  id: `q_${Date.now()}`,
  content: 'Sample question content',
  ...
};
```
**问题**: 自适应测试引擎返回的是硬编码 mock 题目，没有接入真实题库。
**建议**: 接入数据库题库，实现真正的 IRT 题目选择。

### 15. LLM 报告使用 mock 响应
**文件**: `server/src/services/llm-report.ts` — `callLLM` 函数
**问题**: 实际 API 调用被注释掉了，返回的是 mock 内容。生产环境需要接入真实 OpenAI API。

### 16. Prisma 客户端在每个模块重复创建
**文件**: `auth.ts`, `authController.ts`, `payments.ts`, `index.ts` 等都各自 `new PrismaClient()`
**问题**: 每个文件创建独立的 Prisma 实例，浪费连接池资源。
**建议**: 创建单例 Prisma 客户端，各模块 import 使用。

### 17. 加密中间件解密逻辑有 bug
**文件**: `server/src/security/encryption.ts` L134-150
```ts
item.phone = decrypt({
  encryptedData: item.phone,
  iv: '',
  authTag: '',
});
```
**问题**: 解密时 iv 和 authTag 传空字符串，但加密时使用的是随机 IV 和 authTag，解密必然失败。
**建议**: 加密时应将 iv 和 authTag 与数据一起存储，解密时一并读取。

### 18. securityLogMiddleware 每条请求都创建数据库写入
**文件**: `server/src/security/rate-limiter.ts` L206-232
**问题**: 所有 4xx 响应都写入 securityLog，高并发时数据库写入压力巨大。
**建议**: 使用异步批量写入或消息队列。

### 19. 缺少输入验证
**文件**: 多个 controller
**问题**: 仅做了基本的非空检查，缺少对输入格式、长度的严格验证。如 `product_id`、`payment_method` 等参数未做白名单校验。
**建议**: 使用 zod/joi 等验证库统一校验。

### 20. bundle-optimization.ts 是示例代码而非实际优化
**文件**: `miniapp/src/optimization/bundle-optimization.ts`
**问题**: 整个文件是优化指南/示例代码，包含大量注释掉的代码和演示函数。不是实际的性能优化实现。
**建议**: 要么实现为真正的优化模块，要么移到 docs 目录作为参考文档。

---

## ✅ 做得好的地方

1. **分层架构清晰**: routes → controllers → services → security，职责分明
2. **日志记录完善**: 使用 winston 结构化日志，关键操作都有日志记录
3. **成本控制系统**: LLM 报告有预算控制、降级策略、重试机制
4. **性能监控**: MetricsCollector 支持 P50/P90/P99 统计和 Prometheus 格式导出
5. **优雅关闭**: SIGTERM/SIGINT 处理，确保 Prisma 连接正确释放
6. **免责声明**: LLM 报告模板包含免责声明，符合合规要求
7. **Rate Limiting**: 多层限流（用户/IP/全局）设计合理

---

## 📊 代码质量统计

| 指标 | 状态 |
|------|------|
| 严重安全问题 | 🔴 4 项 |
| 重要问题 | 🟡 6 项 |
| 建议改进 | 🟢 10 项 |
| TypeScript 类型覆盖 | ⚠️ 大量 `as any` 绕过 |
| 测试覆盖率 | ❌ 仅有 6 个测试文件，覆盖不全 |
| 环境变量管理 | ❌ 缺少 .env.example 和启动验证 |

---

## 🎯 优先级行动项

1. **[P0]** JWT/加密密钥必须从环境变量读取，缺少时启动失败
2. **[P0]** 微信支付配置缺少时启动失败
3. **[P1]** 支付回调增加数据库事务
4. **[P1]** 订单号改用 crypto.randomBytes
5. **[P1]** 清理 `as any` 类型断言
6. **[P2]** 实现设备指纹和异常登录检测
7. **[P2]** 内存存储增加 TTL 清理
8. **[P2]** 统一 API 基地址
9. **[P3]** 接入真实题库和 LLM API
10. **[P3]** 增加输入验证中间件
