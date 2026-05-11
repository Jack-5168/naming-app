# Code Review Report — 2026-05-02

## 概览

今日共涉及 **2 个训练批次** 的代码变更：
- **tdd-vitest-testing-library-1500-0502**（15:00 批次）— 新增 TaskManager、debounce/throttle、query-string 三个模块
- **tdd-vitest-testing-library-1500-0501**（03:00 批次）— deep-clone、event-emitter、lru-cache、pipeline、retry 五个模块 + 完整测试
- **ts-type-challenges/index.ts**（09:00 批次）— 25 道 TypeScript 类型体操题

---

## 一、tdd-vitest-testing-library-1500-0502（新模块，无测试）

### 1. TaskManager.js — ⭐⭐⭐⭐ 良好

**优点：**
- 防御性编程到位：title 校验、priority/status 枚举校验、tags 数组拷贝
- 所有返回都做了浅拷贝 `{ ...task }`，防止外部修改内部状态
- 分页、过滤、排序、搜索功能完整，API 设计合理
- JSDoc 注释规范

**问题：**

| # | 严重度 | 类型 | 描述 |
|---|--------|------|------|
| 1 | 🔴 高 | 安全 | `addTask` / `updateTask` 未对 title 长度做上限限制，超长字符串可注入，建议限制 255 字符 |
| 2 | 🟡 中 | 性能 | `sortTasks` 中每次排序都重新创建 `priorityOrder` 对象，应提取为常量 |
| 3 | 🟡 中 | 健壮性 | `sortTasks` 对不存在字段（如 `a[field]` 为 undefined）无处理，排序结果可能不符合预期 |
| 4 | 🟡 中 | 健壮性 | `paginate` 的 `totalPages` 当 total=0 时返回 1（`Math.max(1, 0)`），语义上应为 0 |
| 5 | 🟢 低 | 规范 | `getStats` 使用 `hasOwnProperty` 应改为 `Object.hasOwn()` 或 `Object.prototype.hasOwnProperty.call()` |
| 6 | 🟢 低 | 规范 | `clear()` 重置 `nextId = 1` 可能导致 ID 重复（如果外部持有旧任务引用），建议不重置或提供 `reset()` 方法 |

### 2. debounce-throttle.js — ⭐⭐⭐ 中等

**优点：**
- 支持 leading/trailing/maxWait，功能完整
- 提供 cancel/flush 方法
- 参数校验到位

**问题：**

| # | 严重度 | 类型 | 描述 |
|---|--------|------|------|
| 7 | 🔴 高 | Bug | `debounce` 的 `invoke()` 函数将 `lastThis = lastArgs = null` 放在 `fn.apply` **之前**，导致回调收到 `undefined, undefined` 而非实际参数 |
| 8 | 🔴 高 | Bug | `debounce` 的 `trailingEdge()` 中 `fn.apply(lastThis, lastArgs)` 在清空 `lastThis = lastArgs = null` **之前**执行，但 `invoke()` 顺序相反——两处逻辑不一致 |
| 9 | 🟡 中 | 健壮性 | `debounce` 的 `maxWait` 逻辑在 `isInvoking=true` 且 `timer` 已存在时，重新计算 maxTimer 的剩余时间 `maxWait - (time - lastCallTime)`，但 `lastCallTime` 在每次调用时都更新，导致 maxWait 基准偏移 |
| 10 | 🟡 中 | 规范 | `throttle` 的 `leading` 和 `trailing` 同时为 `true` 是默认值，但 Lodash 中 throttle 默认 `leading=true, trailing=false`，行为不一致 |
| 11 | 🟢 低 | 规范 | 缺少 `throttle.flush()` 方法（debounce 有） |

### 3. query-string.js — ⭐⭐⭐⭐ 良好

**优点：**
- 支持嵌套对象、数组、类型转换，功能全面
- `stringify` 递归处理嵌套对象，设计合理
- URL 编码/解码处理正确

**问题：**

| # | 严重度 | 类型 | 描述 |
|---|--------|------|------|
| 12 | 🟡 中 | 健壮性 | `parse` 中 `decodeURIComponent` 对非法编码字符串（如 `%GG`）会抛出 URIError，未做 try-catch |
| 13 | 🟡 中 | 边界 | `stringify` 对 `null`/`undefined` 值只输出 key 不输出 `=value`，与常见行为（`key=null`）不一致 |
| 14 | 🟢 低 | 规范 | `parse` 中 `parseNumbers` 会把 `"0"` 转为数字 `0`，但后续如果 `key` 已存在会转数组，`[0, 1]` 中混合类型可能不符合预期 |
| 15 | 🟢 低 | 规范 | `stringify` 不支持 `Date`、`RegExp` 等特殊对象的序列化 |

### 4. vitest.config.js — ⭐⭐⭐⭐ 良好

- 覆盖率阈值 90% 合理
- 使用 v8 覆盖率提供者
- 配置了 jsdom 环境

**建议：**
- 缺少 `include` 配置，默认扫描所有 `.test.js` 文件，建议明确指定 `include: ['tests/**/*.test.js']`

### 5. package.json

- 依赖版本合理
- 缺少 `@testing-library/jest-dom` 用于更丰富的断言（如 `toBeInTheDocument`）

---

## 二、tdd-vitest-testing-library-1500-0501（含完整测试）

### 1. deep-clone.js — ⭐⭐⭐ 中等

**问题：**

| # | 严重度 | 类型 | 描述 |
|---|--------|------|------|
| 16 | 🔴 高 | 安全 | **未处理循环引用**——传入 `{ a: {} }; obj.a.b = obj` 会导致无限递归栈溢出 |
| 17 | 🟡 中 | 功能 | 不支持 `TypedArray`（如 `Uint8Array`、`Int32Array`） |
| 18 | 🟡 中 | 功能 | 不支持 `WeakMap`/`WeakSet` |
| 19 | 🟡 中 | 功能 | 不支持 `Error` 对象（Error 实例会被当作普通 object 处理，丢失 name/message/stack） |
| 20 | 🟢 低 | 规范 | 缺少 JSDoc 类型标注 |

### 2. event-emitter.js — ⭐⭐⭐⭐ 良好

**优点：**
- 测试覆盖全面（20+ 用例）
- 支持 context、once、off、offAll
- 使用 Map 存储，查找效率高

**问题：**

| # | 严重度 | 类型 | 描述 |
|---|--------|------|------|
| 21 | 🟡 中 | 健壮性 | `emit` 中监听器抛出异常会中断后续监听器的执行，建议 try-catch 包裹单个 listener |
| 22 | 🟢 低 | 规范 | `on` 返回的取消函数闭包捕获了 `event` 和 `listener`，但如果 listener 被重新赋值，取消函数仍引用旧引用——这是正确行为，但应文档化 |

### 3. lru-cache.js — ⭐⭐⭐⭐ 良好

**优点：**
- 利用 Map 的插入顺序实现 LRU，简洁高效
- 测试覆盖全面
- 构造函数参数校验到位

**问题：**

| # | 严重度 | 类型 | 描述 |
|---|--------|------|------|
| 23 | 🟢 低 | 规范 | `keys()`/`values()`/`entries()` 返回的是当前顺序的快照，但文档未说明调用后顺序可能变化 |

### 4. pipeline.js — ⭐⭐⭐⭐ 良好

**优点：**
- 支持同步/异步管道
- `useIf` 条件步骤设计合理
- 链式调用返回 `this`

**问题：**

| # | 严重度 | 类型 | 描述 |
|---|--------|------|------|
| 24 | 🟡 中 | 健壮性 | `run()` 和 `runSync()` 执行后会修改 `this._value`，再次调用 `run()` 会使用上一次的结果而非初始值，可能造成混淆 |
| 25 | 🟢 低 | 规范 | 缺少错误处理——如果某个 step 抛出异常，管道状态会被污染（`_value` 已修改但步骤未完成） |

### 5. retry.js — ⭐⭐⭐⭐ 良好

**优点：**
- 支持指数退避、固定间隔
- `onRetry` 回调设计合理
- 测试使用 fakeTimers 正确模拟异步

**问题：**

| # | 严重度 | 类型 | 描述 |
|---|--------|------|------|
| 26 | 🟡 中 | 健壮性 | `calculateDelay` 中 `backoff: 'none'` 和 `backoff: 'fixed'` 行为完全相同，语义不清晰——'none' 应表示不等待（delay=0） |
| 27 | 🟢 低 | 规范 | 缺少 jitter 支持（指数退避 + 随机抖动是生产环境最佳实践，防止 thundering herd） |

---

## 三、ts-type-challenges/index.ts — ⭐⭐⭐⭐ 良好

**优点：**
- 25 道类型体操题覆盖全面：映射类型、条件类型、模板字面量类型、递归类型
- 使用 `Expect<Equal<...>>` 编译时验证模式正确
- 难度递进合理

**问题：**

| # | 严重度 | 类型 | 描述 |
|---|--------|------|------|
| 28 | 🟡 中 | 健壮性 | `DeepReadonly<T>` 对 `Function` 类型、`Array` 类型、`Map`/`Set` 等内置对象会过度递归（Function 不应被 readonly） |
| 29 | 🟡 中 | 健壮性 | `DeepPartial<T>` 同样存在对 `Array`、`Map`、`Set` 的过度递归问题 |
| 30 | 🟢 低 | 规范 | `KebabCase` 的实现不完整（注释标注"简化版"），实际测试用例缺失 |
| 31 | 🟢 低 | 规范 | `Chainable` 的 `option` 方法泛型 `V` 未约束，可能导致类型推断过于宽泛 |

---

## 四、整体评估

### 规范方面
- ✅ JSDoc 注释整体规范
- ✅ 参数校验意识较强
- ⚠️ 0502 批次 **完全没有测试文件**（tests 目录为空），这是最大问题
- ⚠️ 0501 批次有 .eslintrc.json 但 0502 批次缺少 ESLint 配置

### 性能方面
- ✅ 大部分实现时间复杂度合理
- ⚠️ `TaskManager.sortTasks` 每次创建新对象数组，大数据量下可能有性能问题
- ⚠️ `TaskManager.filterTasks` 多次遍历数组，可合并为一次 filter

### 安全方面
- 🔴 `deepClone` 循环引用未处理——生产环境使用会导致 DoS
- 🔴 `TaskManager` title 无长度限制——可注入超长字符串
- 🟡 `query-string.parse` 缺少 URIError 处理

### 测试方面
- 🔴 0502 批次 **0% 测试覆盖率**（无测试文件）
- ✅ 0501 批次测试质量较高，覆盖了正常路径和边界情况
- ⚠️ 部分边界测试缺失（如 deepClone 循环引用、EventEmitter 异常传播）

---

## 五、改进建议（优先级排序）

1. **🔴 立即修复**
   - 0502 批次补充测试文件（TaskManager、debounce-throttle、query-string）
   - `debounce` 的 `invoke()` 参数传递顺序修复
   - `deepClone` 添加循环引用检测（WeakMap 方案）

2. **🟡 本周内修复**
   - `TaskManager` title 长度限制 + `paginate` totalPages=0 边界
   - `query-string.parse` 添加 URIError try-catch
   - `EventEmitter.emit` 添加单个 listener 的 try-catch
   - `retry` 的 `backoff: 'none'` 语义修正

3. **🟢 持续改进**
   - 0502 批次添加 ESLint 配置
   - `Pipeline` 错误处理机制
   - `retry` 添加 jitter 支持
   - TypeScript 类型体操补充 `KebabCase` 完整实现

---

## 六、总结

| 维度 | 评分 | 说明 |
|------|------|------|
| 代码规范 | ⭐⭐⭐⭐ | JSDoc 规范，命名清晰，结构合理 |
| 功能完整度 | ⭐⭐⭐⭐ | 功能覆盖全面，API 设计合理 |
| 测试覆盖 | ⭐⭐ | 0501 批次良好，0502 批次零测试 |
| 安全性 | ⭐⭐⭐ | 有基本校验，但缺少循环引用/长度限制等防护 |
| 性能 | ⭐⭐⭐ | 大部分实现合理，部分可优化 |
| 健壮性 | ⭐⭐⭐ | 边界情况处理不够充分 |

**综合评分：⭐⭐⭐ (3.2/5)**

主要扣分项：0502 批次零测试覆盖率 + debounce 参数传递 bug + deepClone 循环引用缺失。
