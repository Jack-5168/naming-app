# 策略模式 (Strategy Pattern)

## 核心思想

定义一系列算法，将每个算法封装起来，使它们可以互相替换。策略模式让算法的变化独立于使用它的客户端。

## 适用场景

- 表单验证（不同验证规则）
- 支付方式选择（支付宝/微信/银行卡）
- 排序算法切换（快速排序/归并排序/插入排序）
- 路由导航（驾车/公交/步行）

## 实现代码

```javascript
// ============ 策略模式 ============

// --- 策略接口：所有策略类实现同一个方法 ---

// 策略 1: 支付宝支付
const AlipayStrategy = {
  name: "支付宝",
  pay(amount) {
    console.log(`[支付宝] 支付 ¥${amount}, 手续费 0.6%`);
    return { success: true, channel: "alipay", fee: amount * 0.006 };
  },
};

// 策略 2: 微信支付
const WechatStrategy = {
  name: "微信",
  pay(amount) {
    console.log(`[微信] 支付 ¥${amount}, 手续费 0.6%`);
    return { success: true, channel: "wechat", fee: amount * 0.006 };
  },
};

// 策略 3: 银行卡支付
const BankCardStrategy = {
  name: "银行卡",
  pay(amount) {
    const fee = amount > 1000 ? 0 : 2;
    console.log(
      `[银行卡] 支付 ¥${amount}, ${fee === 0 ? "免手续费" : `手续费 ¥${fee}`}`,
    );
    return { success: true, channel: "bank_card", fee };
  },
};

// --- 上下文类：维护策略引用，委托执行 ---

class PaymentContext {
  constructor() {
    this.strategy = null;
  }

  // 设置策略
  setStrategy(strategy) {
    this.strategy = strategy;
    console.log(`[Context] 切换支付方式: ${strategy.name}`);
  }

  // 执行支付（委托给策略）
  executePayment(amount) {
    if (!this.strategy) {
      throw new Error("请先选择支付方式！");
    }
    return this.strategy.pay(amount);
  }
}

// ============ 使用示例 ============

const payment = new PaymentContext();

console.log("--- 选择支付宝 ---");
payment.setStrategy(AlipayStrategy);
let result = payment.executePayment(299.0);
console.log(`  返回:`, result);

console.log("\n--- 切换为微信 ---");
payment.setStrategy(WechatStrategy);
result = payment.executePayment(150.0);
console.log(`  返回:`, result);

console.log("\n--- 切换为银行卡（大额免手续费）---");
payment.setStrategy(BankCardStrategy);
result = payment.executePayment(2000.0);
console.log(`  返回:`, result);

// ============ 进阶：策略 + 工厂 ============

class PaymentFactory {
  static strategies = {
    alipay: AlipayStrategy,
    wechat: WechatStrategy,
    bank: BankCardStrategy,
  };

  static create(type) {
    const strategy = this.strategies[type];
    if (!strategy) {
      throw new Error(`未知的支付方式: ${type}`);
    }
    return strategy;
  }
}

console.log("\n--- 工厂 + 策略 ---");
const ctx = new PaymentContext();
ctx.setStrategy(PaymentFactory.create("wechat"));
result = ctx.executePayment(99.9);
console.log(`  返回:`, result);
```

## 输出示例

```
--- 选择支付宝 ---
[Context] 切换支付方式: 支付宝
[支付宝] 支付 ¥299, 手续费 0.6%
  返回: { success: true, channel: 'alipay', fee: 1.794 }

--- 切换为微信 ---
[Context] 切换支付方式: 微信
[微信] 支付 ¥150, 手续费 0.6%
  返回: { success: true, channel: 'wechat', fee: 0.9 }

--- 切换为银行卡（大额免手续费）---
[Context] 切换支付方式: 银行卡
[银行卡] 支付 ¥2000, 免手续费
  返回: { success: true, channel: 'bank_card', fee: 0 }

--- 工厂 + 策略 ---
[Context] 切换支付方式: 微信
[微信] 支付 ¥99.9, 手续费 0.6%
  返回: { success: true, channel: 'wechat', fee: 0.5994 }
```

## 要点总结

1. **开闭原则**: 新增策略无需修改上下文代码，只需添加新策略类
2. **消除条件分支**: 替代 `if/else` 或 `switch` 选择算法
3. **运行时切换**: 可以在运行时动态更换策略
4. **JavaScript 原生体现**: `Array.prototype.sort(compareFn)` — 传入不同的比较函数就是不同的排序策略
