# Code Review 报告 — 2026-05-10

**审查时间**：2026-05-10 22:00  
**审查范围**：persona-lab 项目当日所有变更（71 文件，+5707 / -35624 行）  
**审查人**：OpenClaw AI Code Reviewer

---

## 📊 变更概览

| 类别       | 变更量    | 说明                                                                        |
| ---------- | --------- | --------------------------------------------------------------------------- |
| 删除旧文件 | ~35K 行   | 清理 JS 旧控制器/路由（authController.js, paymentController.js 等）         |
| 新增/修改  | ~5.7K 行  | TypeScript 重构、新组件、安全加固                                           |
| 核心模块   | 12 个文件 | auth, tests, encryption, rate-limiter, api, Paywall, Calibration, ShareCard |

---

## 🔴 严重问题 (P0)

### 1. 加密中间件：解密失败静默吞掉异常

**文件**：`server/src/security/encryption.ts` L230-250

```typescript
// 当前代码
try {
  const encryptedData = JSON.parse(item.phone);
  item.phone = decrypt(encryptedData);
} catch (error) {
  console.error("Failed to decrypt phone field:", error);
  // ❌ 问题：解密失败后 item.phone 未被恢复为原始值
  // 调用方会拿到 undefined 的 phone 字段
}
```

**风险**：数据库中旧格式（纯字符串加密数据）的用户，解密失败后 phone 变为 `undefined`，可能导致下游逻辑异常。

**修复建议**：

```typescript
try {
  const encryptedData = JSON.parse(item.phone);
  item.phone = decrypt(encryptedData);
} catch (error) {
  console.error("Failed to decrypt phone field:", error);
  // 保留原始值，避免下游拿到 undefined
  // item.phone 保持不变
}
```

### 2. 加密密钥硬编码回退

**文件**：`server/src/security/encryption.ts` L17

```typescript
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
```

**风险**：如果 `ENCRYPTION_KEY` 环境变量未设置，每次进程重启都会生成新密钥，导致**所有已加密数据永久不可解密**。

**修复建议**：

```typescript
if (!process.env.ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY environment variable is required");
}
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
```

### 3. WeChat App Secret 通过 URL 明文传输

**文件**：`server/src/controllers/auth.ts` L107

```typescript
const wechatUrl = `${WECHAT_LOGIN_URL}?appid=${WECHAT_APP_ID}&secret=${WECHAT_APP_SECRET}&js_code=${code}&grant_type=authorization_code`;
```

**风险**：虽然这是微信 API 的要求（他们就是这么设计的），但 `secret` 出现在 URL 中会被记录在服务器访问日志、代理日志等。

**建议**：确认 `WECHAT_LOGIN_URL` 使用 HTTPS（当前是 `https://api.weixin.qq.com`，✅ 已安全），并在日志中脱敏 secret。

---

## 🟡 中等问题 (P1)

### 4. CATEngine 模块级单例 — 并发问题

**文件**：`server/src/controllers/tests.ts` L17

```typescript
const catEngine = new CATEngine(); // 模块级单例
```

**风险**：如果 `CATEngine` 内部有状态（如缓存、计数器），多个请求并发调用 `selectNextQuestion` / `estimateAbility` 可能导致状态竞争。

**建议**：确认 `CATEngine` 是无状态的，或改为每个请求创建实例 / 使用连接池。

### 5. API 服务 — 错误处理不完整

**文件**：`miniapp/src/services/api.ts` L35-38

```typescript
} catch (error) {
  console.error('API request error:', error);
  throw error; // 直接抛出原始 error，调用方需要自己处理
}
```

**问题**：

- 没有区分网络错误 vs 业务错误
- 没有 token 过期自动刷新机制
- `requiresAuth: true` 但 token 不存在时静默发送无 token 请求

**建议**：

```typescript
if (requiresAuth && !token) {
  throw new Error("Authentication required but no token available");
}
```

### 6. Paywall 组件 — 支付失败无回滚

**文件**：`miniapp/src/components/Paywall.tsx` L44-67

```typescript
const res = await api.createOrder(product.id, product.level);
Taro.requestPayment({
  /* ... */
});
```

**风险**：订单创建成功后，如果用户取消支付或支付超时，订单会停留在 `pending` 状态。需要：

1. 订单有过期时间
2. 支付回调确认机制
3. 定时清理过期订单

### 7. Calibration 页面 — 600ms 自动跳转可能导致误触

**文件**：`miniapp/src/pages/calibration/calibration.tsx` L71-81

```typescript
setTimeout(() => {
  if (currentIndex < questions.length - 1) {
    setCurrentIndex(currentIndex + 1);
    setCurrentAnswer(null);
  } else {
    handleSubmit(newAnswers);
  }
}, 600);
```

**问题**：

- 600ms 对部分用户可能太快（尤其是老年用户）
- `handleSubmit` 在最后一个答案时直接调用，但此时 `answers` state 还没更新（React 批处理）
- `newAnswers` 作为参数传入是正确的，但 `answers` state 不同步

**建议**：增加到 800-1000ms，或提供"自动前进延迟"设置。

### 8. ShareCard 使用旧版 Canvas API

**文件**：`miniapp/src/components/growth/ShareCard.tsx`

```typescript
const ctx = Taro.createCanvasContext(canvasId); // 旧 API
await ctx.draw();
```

**问题**：`Taro.createCanvasContext` 已被标记为 deprecated，应使用 `Taro.createSelectorQuery().select('#canvas').node()` 新 API。

### 9. rate-limiter 中 metadata 字段类型变更 — 向后兼容

**文件**：`server/src/security/rate-limiter.ts` L146

```typescript
metadata: JSON.stringify({ /* ... */ }),
```

**变更**：之前直接传 object，现在改为 `JSON.stringify`。如果数据库 schema 中 `metadata` 是 `Json` 类型，Prisma 应该能自动处理。但显式 stringify 是更安全的做法。✅ 合理改进。

---

## 🟢 轻微问题 / 建议 (P2)

### 10. auth.ts — logger 每次调用都创建新实例

**文件**：`server/src/controllers/auth.ts` L21-34

```typescript
const logger = winston.createLogger({
  /* ... */
}); // 模块级
```

**问题**：虽然声明在模块级（只创建一次），但 `logs/` 目录可能不存在导致启动失败。

**建议**：确保 `mkdir -p logs` 在启动脚本中执行。

### 11. 魔法数字

**文件**：多处

```typescript
expires_in: 7200,        // 2 hours — 应定义为常量
refresh_expires_in: 2592000, // 30 days — 应定义为常量
timeout: 30000,          // 30s — 应定义为常量
```

**建议**：集中定义在 `config/constants.ts`。

### 12. 类型断言过多

**文件**：`server/src/controllers/tests.ts`

```typescript
const session = (await prisma.testSession.findUnique({
  /* ... */
})) as User | null;
```

**问题**：`findUnique` 返回的是 `TestSession | null`，强制断言为 `User | null` 是错误的。应该用 `include` 或单独查询。

### 13. 删除了大量 JS 文件 — 确认无引用

**变更**：删除了 `authController.js`, `paymentController.js`, `testController.js` 等 15+ 个 JS 文件。

**建议**：确保所有 `require` / `import` 引用都已更新为 `.ts` 版本，特别是 `server/src/routes/index.ts` 中的路由注册。

### 14. BASE_URL 端口变更

**文件**：`miniapp/src/services/api.ts`

```typescript
// 旧: 'http://localhost:3000/api/v1'
// 新: 'http://localhost:3001/api/v1'
```

**注意**：确认 server 实际监听在 3001 端口，否则本地开发会失败。

---

## ✅ 做得好的地方

1. **Prisma 单例模式** (`server/src/lib/prisma.ts`) — 正确避免了开发环境下多实例问题
2. **统一错误处理** (`server/src/middleware/error-handler.ts`) — AppError 类 + 错误工厂模式很规范
3. **事务保护并发** (`server/src/controllers/tests.ts` L82) — `prisma.$transaction` 防止重复创建会话
4. **移除 `(req as any).user`** (`server/src/middleware/auth.ts`) — 改用正确的类型扩展
5. **rate-limiter 改用 prisma 单例** — 避免连接泄漏
6. **加密中间件增加 try-catch** — 比之前直接崩溃要好
7. **Paywall 使用 api 服务抽象** — 不再硬编码 URL，符合关注点分离
8. **主题色统一为 #6b5bff** — 视觉一致性改进

---

## 📋 总结

| 等级       | 数量 | 优先级             |
| ---------- | ---- | ------------------ |
| 🔴 P0 严重 | 3    | 必须修复后才能上线 |
| 🟡 P1 中等 | 6    | 建议本周内修复     |
| 🟢 P2 轻微 | 5    | 可排入技术债务     |

**总体评价**：今天的代码变更质量中等偏上。最大的进步是从 JS 到 TS 的重构、统一错误处理、以及安全加固（加密/限流）。主要风险集中在加密密钥管理和错误处理的完整性上。

**建议下一步**：

1. 修复 P0-2（加密密钥必须从环境变量读取）
2. 修复 P0-1（解密失败保留原始值）
3. 补充 CATEngine 的并发安全性确认
4. 为 Paywall 添加订单状态轮询/回调确认
