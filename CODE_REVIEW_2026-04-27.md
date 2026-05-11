# Code Review 报告 — 2026-04-27

**Review 时间**: 2026-04-27 22:00
**Review 范围**: 当日所有代码变更

---

## 📊 变更概览

| 仓库/模块 | 变更类型 | 文件数 | 说明 |
|-----------|---------|--------|------|
| persona-lab/server | 重构 + 简化 | 20+ | 删除 JS 文件，简化为 TS-only，新增 questions 控制器 |
| persona-lab/miniapp | 功能 + 配置 | 8 | 首页增加双人合测入口，测试/结果页重构，配置优化 |
| workspace/miniapp | 配置 | 1 | API 端口 3000→3001 |
| training/tdd-todolist-1500 | 新增 | 2 | TDD 训练 TodoList 实现 + 28 测试用例 |

---

## 🔴 严重问题 (P0 — 必须修复)

### 1. 认证中间件被移除 — 安全漏洞
**文件**: `persona-lab/server/src/routes/tests.ts`

```typescript
// 之前: router.post('/sessions', authMiddleware, createSession);
// 现在: router.post('/sessions', testController.createSession);
```
**问题**: 所有测试路由不再经过 `authMiddleware`，任何人都可以创建测试会话、提交答案、获取结果。
**风险**: 未授权访问、数据篡改、API 滥用。
**建议**: 恢复 authMiddleware，至少在路由层加回认证。

### 2. 硬编码用户 ID — 安全 + 功能缺陷
**文件**: `persona-lab/server/src/controllers/tests-simple.ts`
```typescript
const userId = 1; // 临时硬编码
```
**问题**: 所有测试会话都关联到 userId=1，完全无法区分用户。
**建议**: 从 JWT token 中获取 userId（参考 `tests.ts` 中的 `req.user?.id`）。

### 3. 硬编码 MBTI 结果 — 功能缺陷
**文件**: `persona-lab/server/src/controllers/tests-simple.ts`
```typescript
const mbtiType = 'ENFP'; // 临时硬编码
const testResult = await prisma.testResult.create({
  data: { eScore: 65, nScore: 60, tScore: 55, jScore: 70, ... }
});
```
**问题**: 无论用户答什么题，结果永远是 ENFP。校准测试完全失效。
**建议**: 根据校准答案实际计算维度得分和 MBTI 类型。

### 4. 题目导入接口无权限控制
**文件**: `persona-lab/server/src/routes/questions.ts`
```typescript
router.post('/import', importQuestions); // 无 authMiddleware
```
**问题**: 任何人都可以批量导入题目到数据库，存在数据注入风险。
**建议**: 添加 authMiddleware + admin 角色检查。

---

## 🟡 重要问题 (P1 — 建议修复)

### 5. 前端直连 localhost — 环境配置问题
**文件**: `persona-lab/miniapp/src/pages/test/test.tsx`, `result/result.tsx`
```typescript
url: `http://localhost:3000/api/v1/tests/sessions/${sid}/next`,
```
**问题**: 
- 硬编码 `localhost:3000`，与 server 端口 3001 不一致
- 小程序无法访问 localhost（真机环境）
- 绕过了 `api.ts` 中已封装的 ApiService
**建议**: 使用环境变量配置 API 地址，统一走 ApiService。

### 6. PrismaClient 实例未共享 — 性能问题
**文件**: `tests.ts`, `tests-simple.ts`, `questions.ts` 各自 `new PrismaClient()`
**问题**: 每个控制器文件创建独立 PrismaClient 实例，导致多个数据库连接池。
**建议**: 创建单例 `src/lib/prisma.ts`，所有控制器共享同一实例。

### 7. 题目选择逻辑低效 — N+1 查询
**文件**: `persona-lab/server/src/controllers/tests.ts`
```typescript
for (const dim of dimensions) {
  const questions = await prisma.question.findMany({ ... }); // 4 次独立查询
}
```
**问题**: 4 次数据库查询，应合并为一次。
**建议**: 使用 `whereIn` 或 `prisma.question.findMany({ where: { dimension: { in: dimensions } } })` 一次性查询。

### 8. 路由与控制器不匹配
**文件**: `persona-lab/server/src/routes/tests.ts`
```typescript
router.get('/sessions/:session_id/next', authMiddleware, submitAnswer); // 应该是 getNextQuestion
router.post('/sessions/:session_id/answer', authMiddleware, submitAnswer); // 正确
```
**问题**: GET next 路由错误地指向了 submitAnswer 控制器（旧代码残留）。
**建议**: 修正为 `getNextQuestion`。

---

## 🟢 代码规范问题 (P2 — 改进建议)

### 9. Vue/Pinia 依赖未使用
**文件**: `persona-lab/miniapp/package.json`
```json
"vue": "^3.5.33",
"pinia": "^3.0.4",
"@vue/runtime-core": "^3.5.33"
```
**问题**: 项目是 Taro + React 框架，引入了 Vue 相关依赖但代码中未使用。
**建议**: 移除未使用的依赖，减少打包体积。

### 10. 前端页面直接调用 API 而非使用 ApiService
**文件**: `miniapp/src/pages/test/test.tsx`, `result/result.tsx`
**问题**: 页面组件直接使用 `Taro.request()` 而非封装好的 `ApiService`，违反分层设计。
**建议**: 统一通过 `api` 实例调用，便于统一处理 token、错误、重试。

### 11. sortByPriority 可变操作
**文件**: `training/tdd-todolist-1500/src/TodoList.js`
```javascript
sortByPriority() {
  this.todos.sort(...); // 直接修改原数组
  return this.todos;
}
```
**问题**: `getAll()` 返回副本但 `sortByPriority()` 修改原数组，行为不一致。
**建议**: 返回排序后的副本，或至少在注释中明确说明是可变操作。

### 12. import 函数参数名冲突
**文件**: `training/tdd-todolist-1500/src/TodoList.js`
```javascript
import(todos) { ... }
export() { ... }
```
**问题**: `import` 是 JS 保留字，在严格模式下可能有问题。
**建议**: 重命名为 `importTodos()` / `exportTodos()`。

### 13. 路由文件中的死引用
**文件**: `persona-lab/server/src/index.ts`
```typescript
import authRoutes from './routes/auth'; // auth 路由文件已删除
```
**问题**: `server/src/routes/auth.js` 已被删除，但 `index.ts` 仍在导入。
**建议**: 移除或更新导入。

### 14. timeSpent 硬编码为 10 秒
**文件**: `miniapp/src/pages/test/test.tsx`
```typescript
timeSpent: 10, // TODO: track actual time
```
**问题**: 所有答题时间都是 10 秒，无法用于 CAT 难度评估。
**建议**: 记录实际答题时间（从题目加载到用户点击的时间差）。

### 15. tsconfig 中移除 suppressImplicitAnyIndexErrors 但未修复类型错误
**文件**: `persona-lab/server/tsconfig.json`
```json
- "suppressImplicitAnyIndexErrors": true,
```
**问题**: 移除了抑制选项但未修复潜在的 `any` 类型索引错误。
**建议**: 确保 `req.params`、`req.body` 等都有正确的类型注解。

---

## ✅ 做得好的地方

1. **TDD 训练代码质量高** — TodoList 实现 28 个测试用例，覆盖初始化、CRUD、过滤、搜索、统计、排序、批量操作、导入导出、边界条件、DOM 渲染，测试结构清晰。

2. **前端 UI 重构改进明显** — result.tsx 从 499 行减少到更简洁的结构，中文本地化完善，稳定性指数展示更直观。

3. **Schema 规范化** — Prisma schema 字段按字母排序，结构更清晰，新增 `isCalibration` 字段支持校准题目。

4. **Source Map 配置优化** — dev 环境开启 source-map，生产环境关闭，避免泄露源码。

5. **API 端口统一** — server 和 miniapp 都改为 3001，保持一致。

---

## 📋 修复优先级建议

| 优先级 | 问题 | 预计工时 |
|--------|------|---------|
| P0-1 | 恢复认证中间件 | 15min |
| P0-2 | 从 JWT 获取 userId | 15min |
| P0-3 | 实现真实 MBTI 计算 | 1h |
| P0-4 | 题目导入加权限控制 | 15min |
| P1-5 | 统一 API 地址配置 | 30min |
| P1-6 | PrismaClient 单例化 | 15min |
| P1-7 | 合并题目查询 | 10min |
| P1-8 | 修正路由映射 | 5min |
| P2-9~15 | 代码规范清理 | 1h |

---

## 📈 总结

今日变更以**简化重构**为主，删除了大量 JS 遗留文件，将 server 精简为 TS-only，miniapp 前端增加了双人合测入口和更完善的测试流程。但重构过程中引入了多个**安全回归**（认证中间件移除、硬编码用户 ID、硬编码结果），需要在合入主分支前优先修复。

TDD 训练代码（TodoList）质量优秀，测试覆盖全面，可作为团队 TDD 实践参考。

**整体评分**: ⭐⭐⭐☆☆ (3/5) — 功能方向正确，但安全回归需要立即修复
