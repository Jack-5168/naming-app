# Code Review 报告 — 2026-04-30

**Review 时间**: 2026-04-30 22:00
**Review 范围**: 当日所有代码变更

---

## 📊 变更概览

| 模块 | 变更类型 | 文件数 | 说明 |
|------|---------|--------|------|
| training/network-layer-1200-0430 | 新增训练项目 | 4 | Axios 网络层（拦截器 + Token 刷新 + 重试 + 取消管理） |
| training/tdd-event-bus-1500-0430 | 新增训练项目 | 4 | TDD 事件总线 + 30 测试用例（Vitest） |
| training/network-layer | 新增训练项目 | 5 | TypeScript 网络层（FetchClient + AxiosClient 统一接口 + 类型定义 + 10 示例） |
| training/pwa-offline-tasks-1900 | 延续项目 | 3 | PWA 离线任务管理器（app.js, db.js, sw.js — 04-28 创建） |
| functional-programming-examples.ts | 新增训练文件 | 1 | 函数式编程 15 示例（纯函数/柯里化/Monad/验证器管道等） |
| miniapp/src/services/api.ts | 未提交变更 | 1 | API 端口 3000→3001 |

---

## 🔴 严重问题 (P0 — 必须修复)

### 1. Axios CancelToken 已废弃，应迁移到 AbortController
**文件**: `training/network-layer-1200-0430/network.js` 和 `training/network-layer-1200-0430/cancellation.js`
```javascript
// network.js 第 145 行
const source = axios.CancelToken.source();
config.cancelToken = source.token;

// cancellation.js 第 70 行
const source = axios.CancelToken.source();
```
**问题**: `axios.CancelToken` 在 Axios v1.6+ 已被标记为废弃，v2.x 已完全移除。新项目应使用 `AbortController`。
**建议**: 迁移为 `AbortController` + `signal` 模式，与 `fetch-client.ts` 保持一致：
```javascript
const controller = new AbortController();
config.signal = controller.signal;
// 取消时
controller.abort('Duplicate request cancelled');
```

### 2. AxiosClient 使用 `(this as any)` 绕过类型检查
**文件**: `training/network-layer/axios-client.ts` 第 48-50、62-64 行
```typescript
for (const handler of (this as any)._customRequestErrorInterceptors || []) {
  try { return await handler(error); } catch {}
}
```
**问题**: 使用 `as any` 完全绕过 TypeScript 类型系统，隐藏了设计缺陷。错误拦截器应该通过正式属性声明。
**建议**: 声明正式属性：
```typescript
private customRequestErrorInterceptors: ((error: AxiosError) => Promise<never> | never)[] = [];
```

### 3. network-layer-1200-0430/network.js Token 刷新存在竞态条件
**文件**: `training/network-layer-1200-0430/network.js`
```javascript
let isRefreshing = false;
let refreshSubscribers = [];

function handleUnauthorized(config) {
  if (isRefreshing) {
    return new Promise((resolve) => {
      refreshSubscribers.push((token) => {
        config.headers.Authorization = `Bearer ${token}`;
        resolve(http(config));  // ← 如果 token 为 null，会携带 null token 重试
      });
    });
  }
  // ...
  .catch(() => {
    refreshSubscribers.forEach((cb) => cb(null));  // ← 通知所有排队请求使用 null token
    // ...
  });
}
```
**问题**: 当 Token 刷新失败时，`cb(null)` 会让所有排队的请求携带 `null` token 重试，这些请求会再次触发 401，形成无限循环或大量无效请求。
**建议**: Token 刷新失败时应直接 reject 所有排队请求，而非传入 null：
```javascript
.catch(() => {
  refreshSubscribers.forEach((cb) => cb(null)); // 改为 reject
  refreshSubscribers = [];
  redirectToLogin();
  return Promise.reject(new Error('Token refresh failed'));
});
```
同时在排队回调中检查 token 是否为 null。

---

## 🟡 重要问题 (P1 — 建议修复)

### 4. PWA SW install 静默吞掉错误（延续 04-28 review #8）
**文件**: `training/pwa-offline-tasks-1900/sw.js`
```javascript
event.waitUntil(
  caches.open(STATIC_CACHE).then((cache) => {
    return cache.addAll(STATIC_ASSETS).then(...).catch((err) => {
      console.error('[SW] Install — 预缓存失败:', err);
    })
  })
);
```
**问题**: `.catch()` 吞掉错误后 install 仍会成功完成，SW 进入 activated 状态但缺少预缓存资源。离线时所有请求回退到 fallback 页面。
**建议**: 关键资源预缓存失败应让 install 失败（在 catch 中 throw），或至少标记缓存为不完整状态。

### 5. PWA generateId 可能产生重复 ID（延续 04-28 review #6）
**文件**: `training/pwa-offline-tasks-1900/db.js`
```javascript
generateId() {
  return 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}
```
**问题**: `Date.now()` 精度为毫秒，在批量导入/快速连续创建场景下可能重复。`Math.random()` 非加密安全。
**建议**: 使用 `crypto.randomUUID()`（现代浏览器均支持）或增加单调计数器。

### 6. EventBus chain 测试断言与实际设计不符
**文件**: `training/tdd-event-bus-1500-0430/tests/EventBus.test.js` 测试 18
```javascript
it('应该支持链式调用', () => {
  const returned = bus
    .on('chain', () => results.push(1))
    .on('chain', () => results.push(2));
  expect(typeof returned).toBe('function'); // ← 断言 on 返回 off 函数
});
```
**问题**: 测试名称是"链式调用"，但实际断言的是 `on()` 返回 `off` 函数。这不是链式调用——真正的链式调用应该是 `bus.on(...).on(...).on(...)` 返回 bus 自身。当前 `on()` 返回 `off` 函数，链式调用会中断。
**建议**: 如果要支持链式调用，`on()` 应返回 `this`（bus 实例）；如果设计就是返回 `off` 函数，测试名称应改为"on 应该返回取消订阅函数"。

### 7. EventBus emit 同步 emit 了 error 事件，可能导致递归
**文件**: `training/tdd-event-bus-1500-0430/src/EventBus.js`
```javascript
emit(event, ...args) {
  for (const listener of [...listeners]) {
    try {
      const result = listener.handler(...args);
      results.push(result);
    } catch (err) {
      results.push({ error: err });
      this.emit('error', err, event);  // ← 同步 emit error
    }
  }
}
```
**问题**: 如果 error 事件的 handler 也抛出异常，会再次触发 `this.emit('error', ...)`，形成无限递归。
**建议**: 使用 `setTimeout` 异步触发 error 事件，或增加递归深度保护。

### 8. functional-programming-examples.ts memoize 使用 JSON.stringify 作为缓存 key
**文件**: `functional-programming-examples.ts`
```typescript
function memoize<T extends any[], R>(fn: (...args: T) => R): (...args: T) => R {
  const cache = new Map<string, R>();
  return (...args: T): R => {
    const key = JSON.stringify(args);  // ← 问题
    // ...
  };
}
```
**问题**: 
- `JSON.stringify` 对含 `undefined`、`Function`、`Symbol` 的参数会产生不正确的 key（这些值被省略或转为 null）
- 对象属性顺序不同会产生不同 key（`{a:1,b:2}` vs `{b:2,a:1}`）
- 循环引用会抛出异常
**建议**: 对于简单场景可接受，但应添加注释说明限制。生产环境应使用更健壮的序列化或 WeakMap。

### 9. miniapp API 端口变更未同步（延续 04-28 review #12）
**文件**: `miniapp/src/services/api.ts`
```diff
-const BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
+const BASE_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
```
**问题**: 端口从 3000 改到 3001，但之前 review 中指出的页面组件中硬编码的 `localhost:3000` 仍需确认是否已同步修改。
**建议**: 全局搜索 `localhost:3000` 确认无残留硬编码。

### 10. PWA getAllTasks 全量加载后内存过滤（延续 04-28 review #5）
**文件**: `training/pwa-offline-tasks-1900/db.js`
```javascript
const request = store.getAll(); // 获取全部数据
request.onsuccess = () => {
  let tasks = request.result || [];
  if (status) tasks = tasks.filter((t) => t.status === status);
  // ...
};
```
**问题**: 已创建 status/priority/category 索引但未利用，数据量大时性能差。
**建议**: 使用 `IDBKeyRange.only(status)` + `index.openCursor()` 在数据库层过滤。

---

## 🟢 轻微问题 / 改进建议 (P2)

### 11. network-layer-1200-0430/network.js 使用 console.log 作为日志方案
**问题**: 生产级网络层应有结构化日志（支持日志级别、日志聚合），而非散落的 `console.log`。
**建议**: 抽象 Logger 接口，支持配置日志级别和输出目标。

### 12. network-layer-1200-0430/retry.js withRetry 递归调用可能栈溢出
**文件**: `training/network-layer-1200-0430/retry.js`
```javascript
async function execute() {
  try { return await requestFn(); }
  catch (error) {
    // ...
    await sleep(waitTime);
    return execute();  // ← 递归
  }
}
```
**问题**: 虽然 maxRetries 默认 3 次不会溢出，但如果使用者传入较大值，递归深度可能成为问题。
**建议**: 改为 `for`/`while` 循环更稳健。

### 13. functional-programming-examples.ts 示例中 console.log 混入纯函数定义
**问题**: 纯函数示例文件中包含 `console.log` 调用，虽然仅用于演示，但可能给初学者造成"纯函数可以有副作用"的误解。
**建议**: 将演示代码与函数定义分离到不同区域，或添加明确注释。

### 14. AxiosClient request 方法中 duration 在 catch 中重复计算
**文件**: `training/network-layer/axios-client.ts`
```typescript
try {
  const response = await this.requestWithRetry<T>(axiosConfig);
  const duration = Date.now() - startTime;
  // ...
} catch (err) {
  const duration = Date.now() - startTime;  // ← 定义了但未使用
  // ...
}
```
**问题**: catch 块中计算了 duration 但未使用。
**建议**: 删除或用于错误日志。

### 15. PWA inline event handlers（延续 04-28 review #14）
**文件**: `training/pwa-offline-tasks-1900/app.js`
```javascript
onclick="toggleTaskStatus('${task.id}')"
onclick="editTask('${task.id}')"
```
**问题**: HTML 模板字符串中内联事件处理器，全局函数暴露，XSS 风险（虽然 escapeHtml 做了防护）。
**建议**: 使用事件委托，在父容器上统一监听 click 事件。

---

## ✅ 今日亮点

1. **TypeScript 网络层（training/network-layer/）** — 架构设计优秀。FetchClient 和 AxiosClient 通过统一接口（RequestConfig/CancellableRequest/NetworkError）实现互换，拦截器管道设计清晰，重试策略（指数退避）和取消机制完善。类型定义完整，10 个使用示例覆盖常见场景。
2. **EventBus TDD 实现** — 30 个测试用例覆盖全面，从基础订阅到通配符、优先级、异步事件、错误隔离、内存泄漏检测，TDD 红绿黄循环执行到位。事件历史追踪和 `once` 通过原始 handler 取消的设计很实用。
3. **Axios 网络层（1200-0430）** — Token 自动刷新 + 排队重试机制是生产级实现，401 处理逻辑完整（刷新中排队、刷新成功重试、刷新失败跳转登录）。
4. **函数式编程 15 示例** — 覆盖面广（纯函数→Monad→验证器管道→持久化数据结构→状态机），代码即文档，可直接作为学习参考。

---

## 📈 代码质量趋势

| 日期 | P0 | P1 | P2 | 备注 |
|------|----|----|----|------|
| 04-27 | 4 | 3 | — | persona-lab 重构遗留安全问题 |
| 04-28 | 4 | 8 | 5 | 训练项目为主，架构质量提升，PWA 细节待完善 |
| 04-30 | 3 | 7 | 5 | TypeScript 网络层质量高，Axios CancelToken 废弃需迁移，EventBus 设计小瑕疵 |

**总结**: 今日代码以训练项目为主，TypeScript 网络层和 EventBus TDD 实现质量较高。主要问题集中在：(1) Axios CancelToken 已废弃需迁移 AbortController；(2) AxiosClient 使用 `as any` 绕过类型检查；(3) Token 刷新失败时竞态处理不当。延续问题方面，PWA 的 install 静默失败、generateId 重复风险、内存过滤等仍需处理。整体趋势向好，架构设计能力持续提升。
