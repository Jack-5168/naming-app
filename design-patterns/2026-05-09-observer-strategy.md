# 专项训练 02:00 — 设计模式学习

## 模式一：观察者模式 (Observer Pattern)

### 核心思想

定义对象间**一对多**的依赖关系。当一个对象状态改变时，所有依赖它的对象都会收到通知并自动更新。

### 适用场景

- 事件系统 / 发布订阅
- 数据绑定（如 Vue 的响应式系统）
- 消息队列、事件总线

### 实现代码

```js
// ===== 基础版：简单观察者 =====
class Observer {
  constructor() {
    this.subscribers = new Set();
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    // 返回取消订阅函数
    return () => this.subscribers.delete(fn);
  }

  unsubscribe(fn) {
    this.subscribers.delete(fn);
  }

  notify(data) {
    this.subscribers.forEach((fn) => fn(data));
  }
}

// --- 使用示例 ---
const eventBus = new Observer();

const unsub1 = eventBus.subscribe((msg) => {
  console.log(`[Logger] ${msg}`);
});

const unsub2 = eventBus.subscribe((msg) => {
  console.log(`[Alert] ⚠️ ${msg}`);
});

eventBus.notify("用户登录");
// [Logger] 用户登录
// [Alert] ⚠️ 用户登录

unsub1(); // 取消 Logger 订阅
eventBus.notify("用户登出");
// [Alert] ⚠️ 用户登出
```

```js
// ===== 进阶版：支持多事件类型 =====
class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  on(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(listener);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    this.events.get(event)?.delete(listener);
  }

  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  emit(event, ...args) {
    this.events.get(event)?.forEach((fn) => fn(...args));
  }
}

// --- 使用示例 ---
const emitter = new EventEmitter();

emitter.on("data", (val) => console.log("收到数据:", val));
emitter.once("ready", () => console.log("就绪（仅触发一次）"));

emitter.emit("data", 42); // 收到数据: 42
emitter.emit("ready"); // 就绪（仅触发一次）
emitter.emit("ready"); // 无输出
```

### 关键点

- `Set` 天然去重，避免同一监听器被重复注册
- 返回取消函数是优雅的设计，调用方无需持有引用
- `once` 通过包装函数 + 自动注销实现

---

## 模式二：策略模式 (Strategy Pattern)

### 核心思想

定义一系列算法，把它们**封装**起来，并且使它们可以互相替换。策略模式让算法独立于使用它的客户端而变化。

### 适用场景

- 表单验证规则切换
- 支付方式选择（支付宝/微信/银行卡）
- 排序算法切换、折扣计算

### 实现代码

```js
// ===== 基础版：策略对象 =====
const strategies = {
  // 普通用户：无折扣
  normal(price) {
    return price;
  },

  // VIP 用户：8 折
  vip(price) {
    return price * 0.8;
  },

  // 促销：满 300 减 50
  promotion(price) {
    return price >= 300 ? price - 50 : price;
  },

  // 清仓：5 折
  clearance(price) {
    return price * 0.5;
  },
};

function calculatePrice(type, price) {
  const strategy = strategies[type];
  if (!strategy) throw new Error(`未知的策略: ${type}`);
  return strategy(price);
}

// --- 使用示例 ---
console.log(calculatePrice("normal", 200)); // 200
console.log(calculatePrice("vip", 200)); // 160
console.log(calculatePrice("promotion", 300)); // 250
console.log(calculatePrice("clearance", 200)); // 100
```

```js
// ===== 进阶版：策略类（支持上下文） =====
class PriceCalculator {
  constructor(strategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  calculate(price) {
    return this.strategy(price);
  }
}

// 策略函数
const noDiscount = (p) => p;
const tenPercentOff = (p) => +(p * 0.9).toFixed(2);
const buy2Get1Free = (p) => {
  // 买二赠一：3 件商品付 2 件的钱
  return Math.ceil((2 / 3) * p * 100) / 100;
};

// --- 使用示例 ---
const calc = new PriceCalculator(noDiscount);
console.log(calc.calculate(100)); // 100

calc.setStrategy(tenPercentOff);
console.log(calc.calculate(100)); // 90

calc.setStrategy(buy2Get1Free);
console.log(calc.calculate(90)); // 60
```

```js
// ===== 实战：表单验证策略 =====
const validators = {
  isRequired(value) {
    return value.trim() !== "" || "此项不能为空";
  },

  isEmail(value) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(value) || "邮箱格式不正确";
  },

  isPhone(value) {
    const re = /^1[3-9]\d{9}$/;
    return re.test(value) || "手机号格式不正确";
  },

  minLength(min) {
    return (value) => value.length >= min || `最少 ${min} 个字符`;
  },
};

function validate(formData, rules) {
  const errors = {};
  for (const [field, fieldRules] of Object.entries(rules)) {
    for (const rule of fieldRules) {
      const result =
        typeof rule === "function"
          ? rule(formData[field])
          : rule(formData[field]);
      if (result !== true) {
        errors[field] = result;
        break;
      }
    }
  }
  return Object.keys(errors).length === 0 ? null : errors;
}

// --- 使用示例 ---
const form = { name: "张三", email: "bad", phone: "13800138000" };

const rules = {
  name: [validators.isRequired, validators.minLength(2)],
  email: [validators.isRequired, validators.isEmail],
  phone: [validators.isRequired, validators.isPhone],
};

console.log(validate(form, rules));
// { email: '邮箱格式不正确' }
```

### 关键点

- 策略模式的核心是**消除 if-else/switch**，用对象/函数映射替代
- 策略与上下文分离，策略可独立测试
- 高阶函数（如 `minLength`）让策略支持参数化

---

## 对比总结

| 维度        | 观察者模式                 | 策略模式            |
| ----------- | -------------------------- | ------------------- |
| 类型        | 行为型                     | 行为型              |
| 解决的问题  | 对象间松耦合通信           | 算法族可替换        |
| 核心结构    | Subject + Observer         | Context + Strategy  |
| JS 原生对应 | EventTarget / EventEmitter | 对象映射 / 函数参数 |
| 常见误区    | 过度使用导致调试困难       | 策略过多时管理复杂  |

## 学习收获

1. 观察者模式 = 发布订阅，核心是 **一对多通知**，JS 中用 Set/Map 管理监听器
2. 策略模式 = 算法封装，核心是 **消除条件分支**，用对象映射替代 switch
3. 两者都体现了**开闭原则**：对扩展开放，对修改关闭
