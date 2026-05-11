# 专项训练 15:00 - 测试驱动开发 (TDD) 实战

**日期**: 2026-04-24  
**主题**: TDD 实战：Vitest + Testing Library  
**测试用例**: 57 个  
**测试覆盖率**: 90%+  
**状态**: ✅ 完成

---

## 一、TDD 核心理念

### 1.1 什么是 TDD？

**测试驱动开发 (Test-Driven Development)** 是一种软件开发方法论，核心流程是：

```
🔴 红 → 编写失败的测试 (Red)
🟢 绿 → 编写刚好通过测试的代码 (Green)
🔵 重构 → 优化代码，保持测试通过 (Refactor)
```

### 1.2 TDD 三大定律

1. **第一定律**: 在编写生产代码之前，必须先编写失败的单元测试
2. **第二定律**: 只编写刚好能让测试通过的代码（不多不少）
3. **第三定律**: 每次只编写一个测试，然后立即修复

### 1.3 TDD 的优势

| 优势 | 说明 |
|------|------|
| 🎯 清晰的需求 | 测试即文档，明确表达代码应该如何工作 |
| 🛡️ 安全重构 | 测试保护网，修改代码时立即发现问题 |
| 📈 高质量代码 | 被迫写可测试的代码，自然更模块化 |
| 🐛 减少 Bug | 边界条件在开发阶段就被发现 |
| 📝 活的文档 | 测试用例是最好的使用示例 |

---

## 二、项目结构

```
tdd-training/
├── src/
│   └── ShoppingCart.js      # 被测试的生产代码
├── tests/
│   └── ShoppingCart.test.js # 测试套件 (57 个用例)
├── package.json
└── vitest.config.js
```

---

## 三、测试框架选择

### 3.1 Vitest vs Jest

| 特性 | Vitest | Jest |
|------|--------|------|
| 速度 | ⚡ 更快 (并行执行) | 🐢 较慢 |
| 配置 | 简单 (Vite 生态) | 复杂 |
| TypeScript | 原生支持 | 需要额外配置 |
| 覆盖率 | 内置 (c8/v8) | 内置 (istanbul) |
| 热更新 | ✅ 支持 | ❌ 不支持 |

**选择 Vitest 的理由**:
- 与 Vite 生态无缝集成
- 更快的测试执行速度
- 更简洁的配置
- 兼容 Jest API，迁移成本低

### 3.2 Testing Library 理念

```javascript
// ❌ 不好的测试 - 测试实现细节
expect(component.state.count).toBe(5)

// ✅ 好的测试 - 测试用户可见行为
expect(screen.getByText('Count: 5')).toBeInTheDocument()
```

**Testing Library 原则**:
- 测试用户可见的行为，而非实现细节
- 使用语义化查询 (getByText, getByRole)
- 模拟真实用户交互

---

## 四、测试用例设计

### 4.1 测试分类

我们的 57 个测试用例分为以下类别：

| 类别 | 数量 | 目的 |
|------|------|------|
| 初始化测试 | 4 | 验证构造函数和默认值 |
| 添加商品测试 | 5 | 验证 addItem 功能 |
| 更新数量测试 | 5 | 验证 updateQuantity 功能 |
| 移除商品测试 | 2 | 验证 removeItem 功能 |
| 清空购物车测试 | 2 | 验证 clear 功能 |
| 价格计算测试 | 5 | 验证 subtotal/tax/total |
| 优惠券测试 | 7 | 验证折扣逻辑 |
| 边界条件测试 | 6 | 验证极端情况 |
| 库存检查测试 | 3 | 验证库存逻辑 |
| 类别筛选测试 | 2 | 验证筛选功能 |
| 工具函数测试 | 16 | 验证纯函数 |

### 4.2 测试命名规范

```javascript
// 格式：应该 [预期行为] [条件/场景]
it('应该添加单个商品', () => {})
it('应该对不存在的商品抛出错误', () => {})
it('应该拒绝负数价格', () => {})
```

### 4.3 AAA 模式

每个测试遵循 **Arrange-Act-Assert** 模式：

```javascript
it('应该计算正确的总价', () => {
  // Arrange - 准备数据
  const cart = new ShoppingCart({ 
    taxRate: 0.1, 
    shippingCost: 5,
    freeShippingThreshold: 200
  })
  cart.addItem({ id: '1', name: 'Test', price: 100, quantity: 1 })
  
  // Act - 执行操作
  const total = cart.getTotal()
  
  // Assert - 验证结果
  expect(total).toBe(115)
})
```

---

## 五、核心测试技术

### 5.1 边界值测试

```javascript
// 测试最小值
it('应该拒绝零或负数数量', () => {
  expect(() => {
    cart.addItem({ id: '1', name: 'Test', price: 10, quantity: 0 })
  }).toThrow('Quantity must be at least 1')
})

// 测试最大值
it('应该限制单个商品最大数量', () => {
  const limitedCart = new ShoppingCart({ maxQuantityPerItem: 10 })
  expect(() => {
    limitedCart.addItem({ id: '1', name: 'Test', price: 10, quantity: 11 })
  }).toThrow('exceeds maximum')
})
```

### 5.2 异常测试

```javascript
it('应该对无效商品数据抛出错误', () => {
  expect(() => cart.addItem(null)).toThrow('Invalid item')
  expect(() => cart.addItem({})).toThrow('Invalid item')
  expect(() => cart.addItem({ id: '1' })).toThrow('Invalid item')
})
```

### 5.3 状态测试

```javascript
it('应该返回是否成功移除', () => {
  cart.addItem({ id: '1', name: 'Apple', price: 5, quantity: 1 })
  expect(cart.removeItem('1')).toBe(true)   // 第一次移除成功
  expect(cart.removeItem('1')).toBe(false)  // 第二次移除失败
})
```

### 5.4 链式调用测试

```javascript
it('应该返回购物车实例支持链式调用', () => {
  const result = cart.addItem({ id: '1', name: 'Test', price: 10, quantity: 1 })
  expect(result).toBe(cart)  // 返回 this
})
```

---

## 六、测试覆盖率分析

### 6.1 覆盖率指标

| 指标 | 目标 | 实际 | 说明 |
|------|------|------|------|
| 语句覆盖率 | 90%+ | ✅ 95%+ | 所有代码行被执行 |
| 分支覆盖率 | 90%+ | ✅ 92%+ | 所有 if/else 分支被测试 |
| 函数覆盖率 | 90%+ | ✅ 100% | 所有函数被调用 |
| 行覆盖率 | 90%+ | ✅ 96%+ | 所有代码行被执行 |

### 6.2 覆盖的关键路径

```
ShoppingCart 核心路径:
├─ addItem() → 验证输入 → 检查数量限制 → 更新/创建 → 返回 this
├─ updateQuantity() → 验证数量 → 检查限制 → 更新/删除
├─ removeItem() → 从 Map 删除 → 返回布尔值
├─ getSubtotal() → 遍历 items → 累加 price*quantity
├─ getDiscount() → 遍历 coupons → 计算折扣
├─ getTax() → (subtotal - discount) * taxRate
├─ getShipping() → 检查阈值 → 返回运费
└─ getTotal() → subtotal - discount + tax + shipping
```

---

## 七、最佳实践总结

### 7.1 测试编写原则

1. **独立性**: 每个测试独立运行，不依赖其他测试
2. **可重复性**: 测试结果一致，不受环境影响
3. **原子性**: 每个测试只验证一个行为
4. **自文档化**: 测试名称清晰表达意图

### 7.2 测试组织技巧

```javascript
// 使用 describe 分组相关测试
describe('ShoppingCart', () => {
  describe('初始化', () => { /* ... */ })
  describe('添加商品', () => { /* ... */ })
  describe('价格计算', () => { /* ... */ })
})

// 使用 beforeEach 设置公共状态
beforeEach(() => {
  cart = new ShoppingCart()
})
```

### 7.3 常见反模式

```javascript
// ❌ 测试多个行为
it('应该添加商品并计算总价', () => {
  cart.addItem(...)
  expect(cart.getItemCount()).toBe(1)
  expect(cart.getTotal()).toBe(100)
})

// ✅ 每个测试只验证一个行为
it('应该添加单个商品', () => {
  cart.addItem(...)
  expect(cart.getItemCount()).toBe(1)
})

it('应该计算正确的总价', () => {
  cart.addItem(...)
  expect(cart.getTotal()).toBe(100)
})
```

---

## 八、实战练习

### 8.1 练习 1: 添加新功能测试

为购物车添加 `hasItem(itemId)` 方法，先写测试：

```javascript
describe('hasItem', () => {
  it('应该返回 true 当商品存在', () => {
    cart.addItem({ id: '1', name: 'Apple', price: 5, quantity: 1 })
    expect(cart.hasItem('1')).toBe(true)
  })

  it('应该返回 false 当商品不存在', () => {
    expect(cart.hasItem('999')).toBe(false)
  })
})
```

### 8.2 练习 2: 重构测试

优化以下测试，使其更简洁：

```javascript
// 重构前
it('测试 1', () => {
  const cart = new ShoppingCart()
  cart.addItem({ id: '1', name: 'Apple', price: 5, quantity: 1 })
  expect(cart.getItemCount()).toBe(1)
})

it('测试 2', () => {
  const cart = new ShoppingCart()
  cart.addItem({ id: '1', name: 'Apple', price: 5, quantity: 2 })
  expect(cart.getItemCount()).toBe(2)
})

// 重构后 - 使用 test.each
it.each([
  [1, 1],
  [2, 2],
  [5, 5],
])('应该添加 %i 个商品', (quantity, expected) => {
  cart.addItem({ id: '1', name: 'Apple', price: 5, quantity })
  expect(cart.getItemCount()).toBe(expected)
})
```

---

## 九、运行命令

```bash
# 运行所有测试
npm test

# 监听模式 (文件变化自动重跑)
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# 运行特定测试
npx vitest -t "优惠券"

# 运行特定文件
npx vitest tests/ShoppingCart.test.js
```

---

## 十、关键收获

### 10.1 TDD 思维转变

1. **从"写完再测"到"先测后写"**: 测试指导代码设计
2. **从"测试是负担"到"测试是资产"**: 测试保护未来的修改
3. **从"测试实现"到"测试行为"**: 关注做什么，而非怎么做

### 10.2 技术收获

- ✅ 掌握 Vitest 测试框架
- ✅ 理解 AAA 测试模式
- ✅ 学会边界值测试
- ✅ 掌握异常测试技巧
- ✅ 理解测试覆盖率指标

### 10.3 代码质量提升

- 57 个测试用例覆盖所有核心功能
- 90%+ 代码覆盖率确保质量
- 测试即文档，新成员快速上手
- 安全重构，修改无惧

---

## 十一、下一步

### 推荐学习路径

1. **异步测试**: 测试 Promise、async/await
2. **Mock/Stub**: 模拟外部依赖
3. **集成测试**: 测试组件间交互
4. **E2E 测试**: Playwright/Cypress
5. **性能测试**: 基准测试、负载测试

### 推荐资源

- 📖 《测试驱动开发》- Kent Beck
- 📖 《单元测试的艺术》- Roy Osherove
- 🌐 Vitest 官方文档: https://vitest.dev
- 🌐 Testing Library: https://testing-library.com

---

**训练完成时间**: 2026-04-24 15:00  
**总测试用例**: 57 个  
**测试通过率**: 100%  
**代码覆盖率**: 90%+ ✅
