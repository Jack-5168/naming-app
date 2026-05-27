# JS 设计模式专项训练 — 2026-05-08 02:00

## 模式一：观察者模式 (Observer Pattern)

### 核心思想

定义对象间的一对多依赖，当一个对象状态变化时，所有依赖者自动收到通知。

### 适用场景

- 事件系统（DOM 事件、Node.js EventEmitter）
- 发布/订阅消息总线
- Vue/React 响应式数据绑定
- WebSocket 广播、消息队列

### 实现要点

1. 维护一个订阅者列表（推荐 Set 去重）
2. `subscribe/on` — 添加观察者，返回取消订阅函数
3. `publish/emit` — 遍历通知所有观察者
4. 异常隔离：单个观察者报错不影响其他

### 代码实现

```js
class Observer {
  constructor() {
    this.subscribers = new Set();
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn); // 返回取消函数
  }

  publish(data) {
    this.subscribers.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error("观察者回调出错:", err);
      }
    });
  }
}

// 使用
const eventBus = new Observer();
const unsub = eventBus.subscribe((data) => console.log("收到:", data));
eventBus.publish({ type: "alert", msg: "CPU > 90%" });
unsub(); // 取消订阅
```

### 进阶：多事件类型 EventBus

支持 `on`、`off`、`once`、`emit`，用 Map 管理多事件名。

---

## 模式二：策略模式 (Strategy Pattern)

### 核心思想

定义一系列算法，将它们封装成独立对象，使它们可以互相替换。算法变化不影响使用算法的客户端。

### 适用场景

- 表单验证规则切换
- 支付方式选择（微信/支付宝/银行卡）
- 排序算法切换
- 路由导航策略（hash/history/abstract）

### 实现要点

1. 策略接口：每个策略对象暴露统一方法
2. 上下文（Context）：持有策略引用，委托执行
3. 运行时可切换策略，无需修改上下文代码

### 代码实现

```js
// 策略定义
const strategies = {
  fullReduce: (amount) => {
    if (amount >= 300) return amount - 50;
    if (amount >= 200) return amount - 30;
    return amount;
  },
  discount: (amount) => amount * 0.85,
  member: (amount) => amount * 0.9,
  none: (amount) => amount,
};

// 上下文
class PriceCalculator {
  constructor() {
    this.strategy = strategies.none;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  calculate(amount) {
    return this.strategy(amount);
  }
}

// 使用
const calc = new PriceCalculator();
calc.setStrategy(strategies.fullReduce);
console.log(calc.calculate(320)); // 270

calc.setStrategy(strategies.discount);
console.log(calc.calculate(320)); // 272
```

### 进阶：策略 + 工厂

用工厂方法根据类型名返回对应策略，避免暴露策略对象。

```js
class StrategyFactory {
  static getStrategy(type) {
    const map = {
      "full-reduce": strategies.fullReduce,
      discount: strategies.discount,
      member: strategies.member,
    };
    return map[type] ?? strategies.none;
  }
}

calc.setStrategy(StrategyFactory.getStrategy("discount"));
```

---

## 两种模式对比

| 维度       | 观察者模式           | 策略模式           |
| ---------- | -------------------- | ------------------ |
| 解决的问题 | 一对多通知/联动      | 算法/行为可替换    |
| 关系       | 发布者和观察者松耦合 | 上下文和策略松耦合 |
| 运行时变化 | 动态增删订阅者       | 动态切换策略       |
| 典型代表   | EventEmitter、RxJS   | 排序策略、验证规则 |

## 今日收获

- 观察者模式：用 Set 去重 + 返回取消函数是最佳实践
- 策略模式：核心是"用组合替代条件分支"，消除 if-else/switch 地狱
- 两者结合使用场景：事件触发后根据策略决定如何处理
