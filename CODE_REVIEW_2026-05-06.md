# 代码审查报告 — 2026-05-06

## 📋 审查范围

| 模块 | 文件数 | 审查重点 |
|------|--------|----------|
| training/tdd-vitest-testing-library-1500-0506 | 6 文件 | 规范、测试质量、边界覆盖 |
| training/test-state-management.js | 1 文件 | Redux/Zustand 手写实现 |
| persona-lab/server/src/ | 8 文件 | 安全、性能、架构 |
| persona-lab/miniapp/src/services/api.ts | 1 文件 | 安全、错误处理 |

---

## 🔴 严重问题 (Critical)

### 1. `stability-calculator-optimized.ts` — `calculateUserStability` 使用 `require()` 动态导入 Prisma
**文件**: `server/src/services/stability-calculator-optimized.ts` L240
```ts
const prisma = new (require('@prisma/client').PrismaClient)();
```
**问题**: 
- 在 ES Module 项目中混用 `require()`，可能导致模块解析不一致
- 每次调用都创建新的 PrismaClient 实例（连接泄漏风险），而不是复用全局单例
- 与文件顶部其他 import 风格不一致
**建议**: 统一使用 ES Module import，并复用全局 PrismaClient 实例：
```ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
```

### 2. `tests.ts` — CAT 引擎题目选择逻辑过于简单，非真正的自适应
**文件**: `server/src/controllers/tests.ts` L88-105
```ts
for (const dim of dimensions) {
  const questions = await prisma.question.findMany({
    where: { dimension: dim, isActive: true, isCalibration: false, ... },
    take: 1,
  });
  if (questions.length > 0) { nextQuestion = questions[0]; break; }
}
```
**问题**:
- 注释说使用 CAT 引擎，但实际是**按维度顺序随机取第一题**，完全没有利用 CAT 的信息量最大化策略
- `CATEngine` 被实例化但从未使用（`const catEngine = new CATEngine();` 后没有调用任何方法）
- 维度硬编码为 `['E', 'N', 'T', 'J']`，与 Big5 的 `['O', 'C', 'E', 'A', 'N']` 不一致
**建议**: 要么真正实现 IRT/CAT 算法，要么移除 CATEngine 的无意义实例化，并在注释中说明当前是简化版

### 3. `rate-limiter.ts` — 内存存储无清理机制，长期运行会内存泄漏
**文件**: `server/src/security/rate-limiter.ts` L36-42
```ts
const userStore = new Map<string, RateLimitRecord>();
const ipStore = new Map<string, RateLimitRecord>();
```
**问题**: 
- Map 中的记录只在过期时检查，但**永远不会被删除**。如果用户 A 在 Day1 访问，之后不再访问，`userStore` 中永远保留 `user:A:test` 条目
- 长期运行后 Map 会无限增长
**建议**: 添加定时清理任务，或使用 LRU Map（如 `lru-cache` 库），或切换到 Redis

---

## 🟡 重要问题 (Major)

### 4. `tests.ts` — 完成条件硬编码为 10 题，与会话 maxQuestions 不一致
**文件**: `server/src/controllers/tests.ts` L164
```ts
const shouldComplete = responseCount >= 10; // 至少 10 题
```
**问题**: 创建会话时 `maxQuestions` 设为 15，但完成判断硬编码为 10。用户答完 10 题就结束，但 UI 可能显示进度到 15。
**建议**: 使用 `session.maxQuestions` 作为完成阈值

### 5. `rate-limiter.ts` — `securityLogMiddleware` 对每个 4xx/5xx 请求都写 DB
**文件**: `server/src/security/rate-limiter.ts` L226-248
```ts
if (res.statusCode >= 400) {
  await prisma.securityLog.create({ ... });
}
```
**问题**: 
- 每个错误请求都写一条 securityLog，高并发时会产生大量 DB 写入
- 在 `res.on('finish')` 回调中做异步 DB 写入，如果写入失败不会被捕获
- 404（常见于爬虫扫描）也会产生大量日志
**建议**: 
- 只记录 5xx 或特定类型的 4xx（如 401/403）
- 使用批量写入或消息队列
- 添加 try-catch 防止 DB 写入失败影响响应

### 6. `useClickOutside.js` — `registerRef` 版本没有清理机制，refs 数组只增不减
**文件**: `training/.../src/useClickOutside.js` L35-38
```ts
const registerRef = useCallback((ref) => {
  refs.current.push(ref);
  return ref;
}, []);
```
**问题**: 
- 每次组件渲染调用 `registerRef` 都会 push 新引用，但从未移除
- 如果组件频繁 mount/unmount，refs.current 会无限增长
- 返回的 ref 对象无法被 GC（被 refs.current 持有）
**建议**: 使用 WeakRef 或在 cleanup 中移除，或改用 Set 去重

### 7. `EventEmitter.js` — `once` 的取消订阅调用的是 `off(event, handler)` 但 handler 从未存入 `_listeners`
**文件**: `training/.../src/EventEmitter.js` L58
```ts
return () => this.off(event, handler);
```
**问题**: `once` 注册的 handler 存在 `_onceListeners` 中，但 `off` 方法会同时检查 `_listeners` 和 `_onceListeners`。虽然功能上能工作（`off` 确实会查 `_onceListeners`），但语义上容易混淆。更关键的是，`once` 的 handler 在 emit 后已被 `delete(event)` 清除，此时调用 unsubscribe 是 no-op——不会报错但行为不一致。
**建议**: 为 `once` 的 unsubscribe 添加独立的清理逻辑，或在文档中明确说明

### 8. `LRUCache.js` — `isExpired()` 在 get 时删除过期项导致 size 减少，但 delete 也减少 size
**文件**: `training/.../src/LRUCache.js` L76-79
```ts
if (node.isExpired()) {
  this.delete(key);  // delete 内部会 this.size--
  this.misses++;
  return undefined;
}
```
**问题**: 这里 `delete(key)` 会正确减少 size，但如果后续代码在 get 过期项后又调用 `delete(key)`，第二次 delete 返回 false 且不会 double-decrement size。当前实现是正确的，但 `has()` 方法也有同样的过期删除逻辑，如果 `has()` 先触发删除，后续 `get()` 会 miss。这在语义上是合理的（过期即不存在），但应在文档中说明。
**建议**: 无阻塞级问题，建议在 JSDoc 中标注"过期键会被自动清理"

---

## 🟢 次要问题 (Minor)

### 9. `tests.ts` — session ID 生成使用 `Math.random()`，不适合生产环境
**文件**: `server/src/controllers/tests.ts` L48
```ts
const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
```
**建议**: 使用 `crypto.randomUUID()` 或 `uuid` 库

### 10. `api.ts` — API 基础 URL 使用 `process.env`，小程序环境不支持
**文件**: `miniapp/src/services/api.ts` L3
```ts
const BASE_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
```
**问题**: Taro 小程序运行时没有 `process.env`（编译时会被替换，但直接运行可能为 undefined）。localhost 地址在真机上也无法访问。
**建议**: 使用 `import.meta.env` 或 Taro 的环境变量机制

### 11. `memberships-v2.ts` — 管理员接口缺少认证
**文件**: `server/src/controllers/memberships-v2.ts` L210, L234
```ts
// TODO: Add admin authentication check
// if (!req.user?.isAdmin) { ... }
```
**问题**: `getExpiringMemberships` 和 `processExpired` 暴露了用户 ID 列表和批量操作能力，但管理员检查被注释掉了。
**建议**: 上线前必须启用 admin 认证

### 12. `test-state-management.js` — Redux 手写实现中 `combineReducers` 缺少初始状态处理
**文件**: `training/test-state-management.js`
**问题**: `combineReducers` 返回的 reducer 在 `state` 为 undefined 时只处理了已知的 reducer keys，如果某个子 reducer 没有提供初始状态，该 slice 会是 undefined。
**建议**: 为每个子 reducer 的 slice 提供默认值

### 13. `EventEmitter.js` — `emit` 对 once listeners 使用 `[...onceListeners]` 拷贝后执行，但拷贝后直接 `delete(event)` 而非逐个清理
**文件**: `training/.../src/EventEmitter.js` L120
```ts
this._onceListeners.delete(event);
```
**问题**: 如果 emit 过程中某个 handler 又注册了同名的 once listener，会被立即删除。这是一个边缘场景，但行为可能不符合预期。
**建议**: 改为逐个 shift 而非整批 delete

### 14. `LRUCache.js` — 迭代器遍历时如果缓存被外部修改会导致 undefined
**文件**: `training/.../src/LRUCache.js` L210-216
```ts
*[Symbol.iterator]() {
  let node = this.head.next;
  while (node !== this.tail) {
    yield [node.key, node.value];
    node = node.next;
  }
}
```
**问题**: 迭代期间如果有其他代码修改链表结构（如 put 淘汰），可能导致遍历到已删除节点或跳过节点。
**建议**: 迭代前拷贝快照，或文档标注"迭代期间不应修改缓存"

---

## ✅ 做得好的地方

1. **TDD 测试质量高**：EventEmitter、LRUCache、useClickOutside 的测试覆盖了正常路径、边界条件、错误处理，使用了 `vi.useFakeTimers()` 测试 TTL，测试结构清晰
2. **LRUCache 双向链表实现正确**：dummy head/tail 模式、O(1) 的 get/put/delete、TTL 支持，实现完整
3. **EventEmitter 中间件设计**：支持中间件链、错误处理、取消订阅函数，API 设计合理
4. **stability-calculator-optimized.ts 性能优化到位**：使用 TypedArray（Float64Array、Int32Array）、预分配数组、单次遍历计算维度统计，优化意识好
5. **rate-limiter.ts 分层限流设计**：用户级/IP 级/全局级三级限流，支持 Redis 回退，架构合理
6. **test-state-management.js**：手写 Redux createStore + combineReducers + applyMiddleware + subscribe 监听去重，是好的学习实践

---

## 📊 统计数据

| 指标 | 数量 |
|------|------|
| 审查文件数 | 16 |
| 严重问题 | 3 |
| 重要问题 | 6 |
| 次要问题 | 5 |
| 亮点 | 6 |

---

## 🔧 建议优先级

1. **P0（立即修复）**: #1 Prisma require() 动态导入 + 连接泄漏
2. **P0（立即修复）**: #11 管理员接口缺少认证（安全）
3. **P1（本周修复）**: #2 CAT 引擎未实际使用、#3 内存泄漏、#4 完成条件不一致
4. **P2（下次迭代）**: #5 日志写入优化、#6 refs 泄漏、#9 session ID 生成
5. **P3（技术债）**: #7-#8, #10, #12-#14
