# Code Review Report — 2026-05-01

## 一、今日变更概览

| 模块 | 文件 | 变更类型 |
|------|------|----------|
| miniapp | `src/services/api.ts` | 修改（BASE_URL 端口 3000→3001） |
| miniapp | `src/services/quiz-api.ts` | 新增 |
| miniapp | `src/store/quiz-store.ts` | 新增 |
| miniapp | `src/optimization/bundle-optimization.ts` | 新增 |
| training | `tdd-vitest-testing-library-1500-0501/` 5 源码 + 5 测试 | 新增 |
| training | `tdd-event-bus-1500-0430/` EventBus + 30 测试 | 新增 |
| training | `network-layer-1200-0430/` 4 文件 (network/retry/cancellation/fetch) | 新增 |
| training | `pwa-offline-tasks-1900/` 3 文件 (app/sw/db) | 新增 |

---

## 二、严重问题 (🔴 Critical)

### 1. `quiz-api.ts` — fetchQuestions 静默降级到 Mock 数据
```js
catch (error) {
  console.error('Error fetching questions:', error);
  return generateMockQuestions(); // ❌ 生产环境静默返回假数据
}
```
**影响**：API 故障时用户收到 195 条无意义题目，无法区分真实/假数据。
**建议**：区分 dev/prod 环境，生产环境应抛出错误或显示友好提示。

### 2. `quiz-api.ts` — saveAnswer 静默吞掉错误
```js
catch (error) {
  console.error('Error saving answer:', error);
  // In development, we'll just log it  ❌ 用户答题失败无感知
}
```
**影响**：用户答题丢失无反馈。
**建议**：至少通过 UI 通知用户保存失败，或实现本地 fallback。

### 3. `api.ts` — 端口硬编码变更，缺少环境变量管理
```diff
-const BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
+const BASE_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
```
**问题**：直接修改默认端口而非通过环境变量控制，可能导致其他开发者本地环境不一致。
**建议**：回退默认值，通过 `.env` 文件管理端口差异。

---

## 三、重要问题 (🟡 Important)

### 4. `bundle-optimization.ts` — 缺少 React import
```js
// ❌ 文件使用了 React.useState / React.useEffect / React.useMemo 等
// 但顶部没有 import React from 'react';
```
**影响**：运行时 `React is not defined` 错误。

### 5. `bundle-optimization.ts` — 使用已废弃的 Performance API
```js
const timing = window.performance.timing; // deprecated
const navigation = window.performance.navigation; // deprecated
```
**建议**：改用 Navigation Timing Level 2 (`performance.getEntriesByType('navigation')`)。

### 6. `bundle-optimization.ts` — createWorker 的 CSP 安全风险
```js
const blob = new Blob([`onmessage = function(e) { ... }`], ...);
return new Worker(URL.createObjectURL(blob));
```
**问题**：Blob URL 创建 Worker 在严格 CSP 策略下可能被拦截。
**建议**：使用独立 worker 文件，或评估 CSP 策略。

### 7. `event-emitter.js` — emit 中 once 监听器的竞态条件
```js
listeners.forEach((entry, index) => {
  entry.listener.apply(entry.context, args); // 如果 listener 内部触发同事件？
  if (entry.once) { toRemove.push(index); }
});
```
**问题**：listener 回调中再次 emit 同事件时，forEach 遍历的数组已被修改，可能跳过或重复触发。
**建议**：先拷贝数组 `const listenersCopy = [...listeners]` 再遍历。

### 8. `retry.js` — 指数退避计算偏保守
```js
case 'exponential':
  return baseDelay * Math.pow(2, attempt - 1); // attempt=1 → baseDelay, attempt=2 → 2×
```
**问题**：退避增长较慢。通常期望 2^attempt（即 2×, 4×, 8×）。
**建议**：改为 `baseDelay * Math.pow(2, attempt)` 或加 maxDelay 上限。

### 9. `LRUCache` — 缺少容量上限保护
```js
if (!Number.isInteger(capacity) || capacity <= 0) {
  throw new Error('Capacity must be a positive integer');
}
// capacity = 999999999 不会被拒绝 → 内存溢出风险
```
**建议**：添加合理上限，如 `capacity > 100000` 时抛出错误。

### 10. `Pipeline` — run/runSync 修改了内部 `_value`（有状态管道）
```js
async run() {
  let result = this._value;
  for (const step of this._steps) { result = await step(result); }
  this._value = result; // ← 副作用：多次 run() 累积结果
  return result;
}
```
**问题**：不符合"管道"直觉语义（应每次从初始值开始）。
**建议**：要么不修改 `_value`，要么在文档中明确说明这是有状态管道。

### 11. `EventBus` — emit 中错误处理递归风险
```js
emit(event, ...args) {
  for (const listener of [...listeners]) {
    try {
      const result = listener.handler(...args);
      results.push(result);
    } catch (err) {
      results.push({ error: err });
      this.emit('error', err, event); // ← 如果 'error' handler 也抛错？
    }
  }
}
```
**问题**：如果 'error' 事件的 handler 也抛出异常，会递归触发 error handler。
**建议**：对 error handler 加 try-catch 保护，或限制递归深度。

### 12. `network.js` — Token 刷新失败时传 null 给排队请求
```js
.catch(() => {
  refreshSubscribers.forEach((cb) => cb(null)); // ← 排队请求带 null token 重试
  refreshSubscribers = [];
  redirectToLogin();
})
```
**问题**：刷新失败时通知排队请求传 null token，这些请求会带着 null Authorization 重试，大概率再次 401。
**建议**：刷新失败时应直接 reject 所有排队请求，而非传 null。

### 13. `fetch-layer.js` — InterceptorManager.eject 实现有 bug
```js
use(onFulfilled, onRejected) {
  this.handlers.push({ onFulfilled, onRejected });
  return () => {
    const index = this.handlers.length - 1; // ← 总是删除最后一个，而非当前注册的
    this.handlers[index] = null;
  };
}
eject(index) {
  if (this.handlers[index]) {
    this.handlers[index] = null; // ← 设为 null 而非删除，遍历时需判断
  }
}
```
**问题**：返回的移除函数总是删除最后一个 handler，而非刚注册的那个。eject 设为 null 而非删除，遍历时需判断 `handler?.onFulfilled`。
**建议**：use 返回的函数应记录注册时的 index，eject 应 splice 删除而非置 null。

---

## 四、代码规范问题 (🔵 Style)

### 14. `deep-clone.js` — Map 值克隆时未处理 key 类型
```js
for (const [key, val] of value) {
  result.set(key, deepClone(val)); // key 可能是对象，也应 deepClone
}
```
**建议**：Map 的 key 也可能是对象，考虑 `result.set(deepClone(key), deepClone(val))`。

### 15. `event-emitter.js` — 缺少事件名类型校验
```js
on(event, listener, options = {}) {
  // event 参数没有校验，传入 undefined 或 Symbol 会怎样？
```
**建议**：添加 `if (typeof event !== 'string' && typeof event !== 'symbol')` 校验。

### 16. `pwa-offline-tasks/app.js` — 内联事件处理器（XSS 风险）
```js
onclick="toggleTaskStatus('${task.id}')"
onclick="editTask('${task.id}')"
```
**问题**：如果 `task.id` 包含特殊字符（如 `'`），会破坏 HTML 结构。title 有 escapeHtml 但 id 没有。
**建议**：使用 `addEventListener` 事件委托替代内联 handler。

### 17. `network.js` — 全局 `window.$message` 隐式依赖
```js
function showToast(message) {
  if (window.$message) {
    window.$message.error(message);
  } else {
    console.error(message);
  }
}
```
**问题**：隐式依赖全局变量，难以测试和复用。
**建议**：通过配置注入 toast 函数，或使用事件总线。

### 18. `EventBus` — `_priorities` Map 声明但未使用
```js
this._priorities = new Map(); // ← 声明了但从未读写
```
**建议**：删除无用代码或实现优先级持久化。

### 19. `EventBus` — once 的 off 通过原始 handler 匹配，但 off 方法中匹配逻辑不完整
```js
off(event, handler) {
  const index = listeners.findIndex((l) =>
    l.handler === handler || l.handler._originalHandler === handler
  );
  // ← _originalHandler 只在 once 的 wrapped handler 上设置
  // 但 off 方法直接传 wrapped handler 时，l.handler === handler 会匹配
  // 传原始 handler 时走 _originalHandler 分支
  // 逻辑正确但不够清晰，建议加注释
}
```

### 20. `FetchClient` — 响应拦截器的错误处理链有问题
```js
// 先遍历所有 onFulfilled，再遍历所有 onRejected
for (const handler of this.interceptors.response.handlers) {
  if (handler?.onFulfilled) {
    responsePromise = responsePromise.then(handler.onFulfilled);
  }
}
for (const handler of this.interceptors.response.handlers) {
  if (handler?.onRejected) {
    responsePromise = responsePromise.catch(handler.onRejected);
  }
}
```
**问题**：Axios 的拦截器是成对执行的（一个拦截器的 fulfilled → rejected），这里拆成两轮遍历，语义不同。
**建议**：改为链式成对执行，或文档说明此差异。

---

## 五、测试质量评估

### 5.1 `tdd-vitest-testing-library-1500-0501/`

| 模块 | 测试数 | 覆盖率评估 | 备注 |
|------|--------|-----------|------|
| deep-clone | 12 | ⭐⭐⭐⭐ | 覆盖全面，缺少循环引用测试（文档说不支持） |
| event-emitter | 16 | ⭐⭐⭐⭐⭐ | 优秀，覆盖 on/once/off/offAll/context/查询 |
| lru-cache | 15 | ⭐⭐⭐⭐ | 覆盖 CRUD + 淘汰逻辑，缺少边界容量测试 |
| pipeline | 13 | ⭐⭐⭐⭐ | 覆盖 sync/async/条件/工厂，缺少错误传播测试 |
| retry | 8 | ⭐⭐⭐⭐ | 使用 fakeTimers 测试异步，优秀 |

### 5.2 `tdd-event-bus-1500-0430/`

| 模块 | 测试数 | 覆盖率评估 | 备注 |
|------|--------|-----------|------|
| EventBus | 30 | ⭐⭐⭐⭐⭐ | 非常全面，覆盖基础/高级/边界/异步/复杂场景 |

**测试亮点**：
- ✅ 测试命名清晰（`应该...` 格式），分组合理（基础/高级/边界/异步）
- ✅ 使用 `vi.useFakeTimers()` 精确控制 retry 时间
- ✅ EventBus 的复杂认证流程集成测试（测试 30）设计优秀
- ✅ 边界条件覆盖好（空对象、空数组、无效参数、错误隔离）
- ✅ 错误隔离测试验证了一个 handler 报错不影响其他

**测试不足**：
- ❌ `retry.js` 缺少 `backoff: 'fixed'` 策略测试
- ❌ `pipeline.js` 缺少步骤抛出异常时的错误传播测试
- ❌ `event-emitter.js` 缺少并发 emit 场景测试
- ❌ `EventBus` 缺少内存泄漏检测测试（setMaxListeners 只测了警告，没测实际限制行为）
- ❌ `FetchClient` 无测试文件
- ❌ `cancellation.js` 无测试文件

### 5.3 vitest.config.js
```js
coverage: {
  thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 }
}
```
**评估**：90% 阈值对 training 项目合理。

---

## 六、性能评估

| 模块 | 关键操作 | 复杂度 | 评估 |
|------|----------|--------|------|
| LRUCache | get/put | O(1) | ✅ 利用 Map 插入顺序 |
| LRUCache | keys/values/entries | O(n) | ✅ 可接受 |
| EventEmitter | emit | O(n) | ✅ 正常 |
| EventBus | emit | O(n + m) (n=direct, m=wildcard) | ✅ 正常 |
| EventBus | 优先级插入 | O(n) splice | ⚠️ 大量 listener 时有开销 |
| Pipeline | run/runSync | O(n) | ✅ 线性执行 |
| retry | 重试循环 | O(attempts) | ✅ 正常 |
| FetchClient | request | O(n) 拦截器 | ✅ 正常 |

---

## 七、安全评估

| 风险 | 位置 | 等级 | 说明 |
|------|------|------|------|
| 静默 Mock 数据 | `quiz-api.ts` | 🔴 高 | 生产环境无法区分真实/假数据 |
| 错误静默吞掉 | `quiz-api.ts` | 🟡 中 | 用户无感知数据丢失 |
| Token 明文存储 | `api.ts` + `network.js` | 🟡 中 | localStorage 存储 token，XSS 可窃取 |
| 内联事件处理器 | `app.js` | 🟡 中 | task.id 未转义可能导致 XSS |
| CSP 冲突 | `bundle-optimization.ts` | 🔵 低 | Blob Worker 在严格 CSP 下失败 |
| EventBus error 递归 | `EventBus.js` | 🟡 中 | error handler 抛错导致递归 |

---

## 八、总结与建议

### 今日代码整体质量：**良好** ⭐⭐⭐⭐

**优点**：
1. TDD 测试质量高，命名规范，分组清晰，EventBus 30 个测试覆盖全面
2. 工具函数（deep-clone、event-emitter、lru-cache、pipeline）实现完整，API 设计合理
3. retry 机制使用 fakeTimers 测试异步，方法论正确
4. PWA Service Worker 实现覆盖三大缓存策略（Cache-First / Network-First / Stale-While-Revalidate），架构清晰
5. 网络层 retry 实现考虑了 jitter 和 shouldRetry，生产级
6. FetchClient 从零实现拦截器系统，设计思路清晰
7. EventBus 支持命名空间、通配符、优先级、异步、错误隔离，功能丰富

**需要改进**：
1. **紧急**：`quiz-api.ts` 的静默 Mock 降级和错误吞掉必须修复（P0）
2. **紧急**：`bundle-optimization.ts` 缺少 React import，无法运行（P0）
3. **重要**：event-emitter 的 emit 竞态条件需要处理（P1）
4. **重要**：EventBus error handler 递归风险（P1）
5. **建议**：Pipeline 的有状态设计需要文档说明（P2）
6. **建议**：FetchClient InterceptorManager eject 实现有 bug（P2）
7. **建议**：补充 FetchClient 和 cancellation 的测试（P2）

### 下一步行动
- [ ] 修复 quiz-api.ts 错误处理（优先级 P0）
- [ ] 补充 bundle-optimization.ts 的 React import（优先级 P0）
- [ ] event-emitter emit 竞态条件修复（优先级 P1）
- [ ] EventBus error handler 递归保护（优先级 P1）
- [ ] retry.js 补充 fixed 策略测试（优先级 P2）
- [ ] Pipeline 文档化有状态行为（优先级 P2）
- [ ] FetchClient InterceptorManager eject 修复（优先级 P2）
- [ ] 补充 FetchClient / cancellation 测试（优先级 P2）
