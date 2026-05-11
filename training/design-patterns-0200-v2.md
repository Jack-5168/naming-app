# 专项训练 02:00 — JavaScript 设计模式 (工厂 + 策略)

> 2026-04-29 | 重点：工厂模式 + 策略模式（2 个核心模式，含完整实现 + 实战 + 面试）
> 前置：4/29 01:00 已覆盖单例 + 观察者 → 本次覆盖工厂 + 策略，四大核心模式闭环

---

## 一、工厂模式 (Factory Pattern)

### 1.1 核心概念

**定义：** 定义一个创建对象的接口，让子类或工厂函数决定实例化哪个类。将对象的创建和使用解耦。

**本质：** 不是 `new ClassName()` 的直接调用，而是通过一个"工厂"来统一生产对象。调用方只关心接口，不关心具体实现。

### 1.2 三种工厂变体

| 变体 | 特点 | 适用场景 |
|------|------|----------|
| 简单工厂 | 一个函数根据参数返回不同对象 | 对象类型少、创建逻辑简单 |
| 工厂方法 | 父类定义接口，子类决定具体实现 | 对象族扩展、开闭原则 |
| 抽象工厂 | 创建一组相关对象，不指定具体类 | 产品族、跨平台 UI |

### 1.3 简单工厂 (Simple Factory)

```javascript
// === 场景：支付系统，支持支付宝/微信/银联 ===

class Alipay {
  pay(amount) {
    console.log(`[支付宝] 支付 ¥${amount}`);
    return { success: true, channel: 'alipay', amount };
  }
  refund(orderId, amount) {
    return { success: true, channel: 'alipay', orderId, amount };
  }
}

class WechatPay {
  pay(amount) {
    console.log(`[微信支付] 支付 ¥${amount}`);
    return { success: true, channel: 'wechat', amount };
  }
  refund(orderId, amount) {
    return { success: true, channel: 'wechat', orderId, amount };
  }
}

class UnionPay {
  pay(amount) {
    console.log(`[银联支付] 支付 ¥${amount}`);
    return { success: true, channel: 'unionpay', amount };
  }
  refund(orderId, amount) {
    return { success: true, channel: 'unionpay', orderId, amount };
  }
}

// 工厂函数 —— 核心
const PaymentFactory = {
  create(type) {
    const map = { alipay: Alipay, wechat: WechatPay, unionpay: UnionPay };
    const Cls = map[type];
    if (!Cls) throw new Error(`未知的支付方式: ${type}`);
    return new Cls();
  }
};

// 使用
const pay = PaymentFactory.create('alipay');
pay.pay(100); // [支付宝] 支付 ¥100
```

**关键洞察：**
- 调用方不需要 `import Alipay`，只和工厂交互
- 新增支付方式只需在 `map` 中注册，**调用方零修改**
- 工厂函数可以加入日志、鉴权、限流等横切逻辑

### 1.4 工厂方法 (Factory Method)

```javascript
// === 场景：跨平台 UI 组件库 ===

// 抽象产品
class Button {
  render() { throw new Error('子类必须实现 render'); }
  onClick(handler) { throw new Error('子类必须实现 onClick'); }
}

// 具体产品
class WinButton extends Button {
  render() { return '<button class="win-btn">Click</button>'; }
  onClick(handler) { /* Windows 风格事件绑定 */ }
}

class MacButton extends Button {
  render() { return '<button class="mac-btn">Click</button>'; }
  onClick(handler) { /* macOS 风格事件绑定 */ }
}

// 抽象工厂
class Dialog {
  // 工厂方法 —— 子类必须实现
  createButton() { throw new Error('子类必须实现 createButton'); }

  render() {
    const btn = this.createButton();  // 使用工厂方法
    return `
      <div class="dialog">
        <p>确认删除？</p>
        ${btn.render()}
      </div>
    `;
  }
}

// 具体工厂
class WinDialog extends Dialog {
  createButton() { return new WinButton(); }
}

class MacDialog extends Dialog {
  createButton() { return new MacButton(); }
}

// 使用
const platform = process.platform === 'darwin' ? 'mac' : 'win';
const dialog = platform === 'mac' ? new MacDialog() : new WinDialog();
console.log(dialog.render());
```

**关键洞察：**
- 工厂方法把"创建什么"推迟到子类
- `Dialog.render()` 不依赖具体按钮类，符合**依赖倒置原则**
- 新增平台只需加一对类（产品 + 工厂），**开闭原则**

### 1.5 抽象工厂 (Abstract Factory)

```javascript
// === 场景：主题系统（浅色/深色），每个主题包含按钮+输入框+下拉框 ===

// 产品族接口
class ThemeButton { render() {} }
class ThemeInput { render() {} }
class ThemeSelect { render() {} }

// 浅色产品
class LightButton extends ThemeButton { render() { return '<button class="light">'; } }
class LightInput extends ThemeInput { render() { return '<input class="light">'; } }
class LightSelect extends ThemeSelect { render() { return '<select class="light">'; } }

// 深色产品
class DarkButton extends ThemeButton { render() { return '<button class="dark">'; } }
class DarkInput extends ThemeInput { render() { return '<input class="dark">'; } }
class DarkSelect extends ThemeSelect { render() { return '<select class="dark">'; } }

// 抽象工厂接口
class ThemeFactory {
  createButton() { throw new Error('必须实现'); }
  createInput() { throw new Error('必须实现'); }
  createSelect() { throw new Error('必须实现'); }
}

// 具体工厂
class LightThemeFactory extends ThemeFactory {
  createButton() { return new LightButton(); }
  createInput() { return new LightInput(); }
  createSelect() { return new LightSelect(); }
}

class DarkThemeFactory extends ThemeFactory {
  createButton() { return new DarkButton(); }
  createInput() { return new DarkInput(); }
  createSelect() { return new DarkSelect(); }
}

// 使用 —— 整个应用只选一个工厂，保证主题一致性
function buildPage(factory) {
  const btn = factory.createButton();
  const inp = factory.createInput();
  const sel = factory.createSelect();
  return `${btn.render()} ${inp.render()} ${sel.render()}`;
}

const theme = 'dark';
const f = theme === 'dark' ? new DarkThemeFactory() : new LightThemeFactory();
console.log(buildPage(f)); // 全部是 dark 风格，不会混用
```

### 1.6 工厂模式在真实框架中的应用

| 框架 | 工厂模式体现 |
|------|-------------|
| React | `React.createElement()` / `React.createContext()` / `createRoot()` |
| Vue | `defineComponent()` / `createApp()` |
| Axios | `axios.create(config)` 创建实例 |
| Express | `express.Router()` 创建路由实例 |
| Redux | `createStore()` / `configureStore()` |

```javascript
// Axios 工厂 —— 最直观的工厂模式
const api = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: { 'X-API-Key': 'xxx' }
});
// api 是一个全新的 axios 实例，不影响全局 axios
```

### 1.7 简单工厂 vs 工厂方法 vs 抽象工厂

```
简单工厂：一个函数搞定，适合对象类型少
    ┌─────────────┐
    │  Factory    │
    │  create()   │ ──→ 返回具体对象
    └─────────────┘

工厂方法：父类定义接口，子类决定实现
    ┌─────────────┐       ┌─────────────┐
    │  Creator    │       │  Product    │
    │  factory()  │─────→ │  (抽象)     │
    └──────┬──────┘       └──────┬──────┘
           │                      │
    ┌──────┴──────┐       ┌──────┴──────┐
    │ Concrete    │       │ Concrete    │
    │ Creator     │       │ Product     │
    └─────────────┘       └─────────────┘

抽象工厂：创建一组相关对象
    ┌───────────────┐
    │  Abstract     │
    │  Factory      │
    │  ├─ createA() │──→ ProductA1 / ProductA2
    │  ├─ createB() │──→ ProductB1 / ProductB2
    │  └─ createC() │──→ ProductC1 / ProductC2
    └───────────────┘
```

### 1.8 工厂模式实战：事件处理器工厂

```javascript
// === 实战：根据事件类型创建对应的处理器 ===

class ClickHandler {
  handle(event) {
    console.log(`点击: ${event.target}`);
    return { type: 'click', target: event.target };
  }
}

class ScrollHandler {
  handle(event) {
    console.log(`滚动: ${event.direction}`);
    return { type: 'scroll', direction: event.direction };
  }
}

class HoverHandler {
  handle(event) {
    console.log(`悬停: ${event.target}`);
    return { type: 'hover', target: event.target };
  }
}

// 带缓存的工厂 —— 同类型只创建一次（工厂 + 单例结合）
const HandlerFactory = {
  cache: new Map(),
  create(type) {
    if (!this.cache.has(type)) {
      const map = { click: ClickHandler, scroll: ScrollHandler, hover: HoverHandler };
      const Cls = map[type];
      if (!Cls) throw new Error(`未知事件类型: ${type}`);
      this.cache.set(type, new Cls());
    }
    return this.cache.get(type);
  },
  clear() { this.cache.clear(); }
};

// 使用
const handler = HandlerFactory.create('click');
handler.handle({ target: '#submit-btn' });
```

### 1.9 面试高频问题

**Q1：简单工厂和工厂方法有什么区别？**
> 简单工厂是一个函数/类，根据参数返回对象；工厂方法是父类定义抽象方法，子类实现具体创建逻辑。简单工厂没有继承关系，工厂方法有。

**Q2：什么时候用工厂模式？**
> ① 对象创建逻辑复杂（需要多步初始化）② 对象类型在运行时才能确定 ③ 需要统一创建入口（加日志/鉴权/缓存）④ 对象族需要保持一致性（抽象工厂）

**Q3：工厂模式和直接 new 有什么区别？**
> 直接 new 耦合了具体类，工厂模式解耦。但简单工厂本质上还是 new，只是把 new 集中管理了。真正的价值在于**扩展性**和**统一入口**。

**Q4：工厂模式违反开闭原则吗？**
> 简单工厂在新增类型时需要修改工厂函数内部，确实违反。工厂方法和抽象工厂通过新增子类解决，不违反。

---

## 二、策略模式 (Strategy Pattern)

### 2.1 核心概念

**定义：** 定义一系列算法，将每个算法封装起来，使它们可以互相替换。策略模式让算法的变化独立于使用它的客户端。

**本质：** 把 `if/else` 或 `switch` 的多分支逻辑，拆成独立的策略类/函数。用**组合**替代**条件判断**。

### 2.2 为什么需要策略模式？

```javascript
// ❌ 反模式：巨大的 if/else 分支
function calculatePrice(type, amount) {
  if (type === 'vip') {
    return amount * 0.8;
  } else if (type === 'svip') {
    return amount * 0.7;
  } else if (type === 'newuser') {
    return amount * 0.9;
  } else if (type === 'employee') {
    return amount * 0.5;
  } else {
    return amount;
  }
}

// ✅ 策略模式：每个策略独立
const strategies = {
  vip: (amount) => amount * 0.8,
  svip: (amount) => amount * 0.7,
  newuser: (amount) => amount * 0.9,
  employee: (amount) => amount * 0.5,
  default: (amount) => amount,
};

function calculatePrice(type, amount) {
  const strategy = strategies[type] || strategies.default;
  return strategy(amount);
}
```

**对比：**
| 维度 | if/else | 策略模式 |
|------|---------|----------|
| 新增类型 | 修改函数内部 | 新增策略即可 |
| 可读性 | 分支多时混乱 | 每个策略清晰 |
| 测试 | 需要测整个函数 | 每个策略独立测试 |
| 复用 | 难以复用 | 策略可跨场景复用 |

### 2.3 策略模式实现（函数式）

```javascript
// === 场景：表单验证 ===

const validators = {
  // 必填
  required: (value) => value.trim() !== '' || '该项为必填',

  // 邮箱
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || '邮箱格式不正确',

  // 手机号
  phone: (value) => /^1[3-9]\d{9}$/.test(value) || '手机号格式不正确',

  // 长度范围
  length: (min, max) => (value) => {
    const len = value.length;
    return (len >= min && len <= max) || `长度应在 ${min}-${max} 之间`;
  },

  // 自定义正则
  pattern: (regex, msg) => (value) => regex.test(value) || msg,
};

// 验证器 —— 策略的组合器
class Validator {
  constructor() {
    this.rules = [];
  }

  add(field, ...ruleList) {
    this.rules.push({ field, rules: ruleList });
    return this; // 链式调用
  }

  validate(data) {
    const errors = {};
    for (const { field, rules } of this.rules) {
      const value = data[field] ?? '';
      for (const rule of rules) {
        // rule 可能是函数，也可能是 { type, args }
        const fn = typeof rule === 'function' ? rule : validators[rule.type](...rule.args);
        const result = fn(value);
        if (result !== true) {
          errors[field] = result;
          break; // 第一个错误就停
        }
      }
    }
    return errors;
  }
}

// 使用
const formValidator = new Validator()
  .add('username', validators.required, validators.length(2, 20))
  .add('email', validators.required, validators.email)
  .add('phone', validators.required, validators.phone);

const errors = formValidator.validate({
  username: 'a',
  email: 'bad-email',
  phone: '13800138000'
});
console.log(errors);
// { username: '长度应在 2-20 之间', email: '邮箱格式不正确' }
```

### 2.4 策略模式实现（类式）

```javascript
// === 场景：促销折扣计算 ===

// 策略接口
class DiscountStrategy {
  calculate(price) { throw new Error('子类必须实现'); }
  getName() { throw new Error('子类必须实现'); }
}

// 具体策略
class NoDiscount extends DiscountStrategy {
  calculate(price) { return price; }
  getName() { return '无折扣'; }
}

class PercentDiscount extends DiscountStrategy {
  constructor(percent) {
    super();
    this.percent = percent; // 0.8 = 8折
  }
  calculate(price) { return +(price * this.percent).toFixed(2); }
  getName() { return `${this.percent * 10}%折扣`; }
}

class FixedDiscount extends DiscountStrategy {
  constructor(amount) {
    super();
    this.amount = amount;
  }
  calculate(price) { return Math.max(0, price - this.amount); }
  getName() { return `立减¥${this.amount}`; }
}

class TierDiscount extends DiscountStrategy {
  constructor(tiers) {
    super();
    this.tiers = tiers; // [{ min: 100, discount: 10 }, { min: 200, discount: 30 }]
  }
  calculate(price) {
    let discount = 0;
    for (const tier of this.tiers) {
      if (price >= tier.min) discount = tier.discount;
    }
    return Math.max(0, price - discount);
  }
  getName() { return '阶梯折扣'; }
}

// 上下文 —— 使用策略
class PriceCalculator {
  constructor(strategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  calculate(price) {
    const final = this.strategy.calculate(price);
    return {
      original: price,
      final,
      saved: +(price - final).toFixed(2),
      method: this.strategy.getName()
    };
  }
}

// 使用
const calc = new PriceCalculator(new PercentDiscount(0.8));
console.log(calc.calculate(100)); // { original: 100, final: 80, saved: 20, method: '80%折扣' }

calc.setStrategy(new TierDiscount([
  { min: 100, discount: 10 },
  { min: 200, discount: 30 },
  { min: 500, discount: 100 }
]));
console.log(calc.calculate(520)); // { original: 520, final: 420, saved: 100, method: '阶梯折扣' }
```

### 2.5 策略模式实战：排序算法切换

```javascript
// === 实战：数据表格的排序策略 ===

const sortStrategies = {
  // 数字升序
  numberAsc: (a, b) => a - b,

  // 数字降序
  numberDesc: (a, b) => b - a,

  // 字符串升序
  stringAsc: (a, b) => a.localeCompare(b, 'zh-CN'),

  // 字符串降序
  stringDesc: (a, b) => b.localeCompare(a, 'zh-CN'),

  // 日期升序
  dateAsc: (a, b) => new Date(a) - new Date(b),

  // 日期降序
  dateDesc: (a, b) => new Date(b) - new Date(a),
};

// 表格列 —— 动态切换排序策略
class TableColumn {
  constructor(key, label, defaultSort = 'stringAsc') {
    this.key = key;
    this.label = label;
    this.sortStrategy = sortStrategies[defaultSort];
    this.direction = 'asc';
  }

  toggleSort() {
    const map = {
      stringAsc: 'stringDesc', stringDesc: 'stringAsc',
      numberAsc: 'numberDesc', numberDesc: 'numberAsc',
      dateAsc: 'dateDesc', dateDesc: 'dateAsc',
    };
    this.sortStrategy = sortStrategies[map[this.sortStrategy === sortStrategies.stringAsc ? 'stringAsc' :
      this.sortStrategy === sortStrategies.numberAsc ? 'numberAsc' :
      this.sortStrategy === sortStrategies.dateAsc ? 'dateAsc' :
      this.sortStrategy === sortStrategies.stringDesc ? 'stringDesc' :
      this.sortStrategy === sortStrategies.numberDesc ? 'numberDesc' : 'dateDesc']];
    this.direction = this.direction === 'asc' ? 'desc' : 'asc';
  }

  sort(data) {
    return [...data].sort((a, b) => this.sortStrategy(a[this.key], b[this.key]));
  }
}

// 使用
const nameCol = new TableColumn('name', '姓名', 'stringAsc');
const ageCol = new TableColumn('age', '年龄', 'numberAsc');

const users = [
  { name: '张三', age: 28 },
  { name: '李四', age: 22 },
  { name: '王五', age: 35 },
];

console.log(ageCol.sort(users));
// [{ age: 22 }, { age: 28 }, { age: 35 }]
```

### 2.6 策略模式实战：请求重试策略

```javascript
// === 实战：网络请求的重试策略 ===

const retryStrategies = {
  // 固定间隔
  fixed: (attempt) => 1000,

  // 线性增长
  linear: (attempt) => 1000 * (attempt + 1),

  // 指数退避
  exponential: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000),

  // 指数退避 + 随机抖动
  exponentialJitter: (attempt) => {
    const base = Math.min(1000 * Math.pow(2, attempt), 30000);
    return base + Math.random() * 1000;
  },
};

async function fetchWithRetry(url, options = {}) {
  const { maxRetries = 3, strategy = 'exponentialJitter' } = options;
  const getDelay = retryStrategies[strategy];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = getDelay(attempt);
      console.log(`重试 ${attempt + 1}/${maxRetries}, 等待 ${Math.round(delay)}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// 使用
fetchWithRetry('/api/data', { strategy: 'exponentialJitter', maxRetries: 5 });
// 重试 1/5, 等待 ~1000ms
// 重试 2/5, 等待 ~2000ms
// 重试 3/5, 等待 ~4000ms
// ...
```

### 2.7 策略模式 vs 状态模式

| 维度 | 策略模式 | 状态模式 |
|------|----------|----------|
| 目的 | 算法可替换 | 行为随状态变化 |
| 切换时机 | 客户端主动切换 | 对象内部自动切换 |
| 策略/状态关系 | 策略之间无关联 | 状态之间可转移 |
| 典型场景 | 排序/验证/折扣 | 订单状态/游戏AI |

```javascript
// 状态模式示例（对比）
class OrderStateMachine {
  constructor() {
    this.state = 'pending';
    this.transitions = {
      pending: { pay: 'paid', cancel: 'cancelled' },
      paid: { ship: 'shipped', cancel: 'refunding' },
      shipped: { receive: 'completed' },
      refunding: { confirm: 'cancelled' },
    };
  }

  transition(action) {
    const next = this.transitions[this.state]?.[action];
    if (!next) throw new Error(`${this.state} 状态下不能执行 ${action}`);
    this.state = next;
    return this.state;
  }
}
```

### 2.8 策略模式在真实框架中的应用

| 框架 | 策略模式体现 |
|------|-------------|
| Lodash | `_.sortBy` 的 iteratee 策略 |
| Moment.js | 不同日期格式化的策略 |
| Webpack | loader 链（每个 loader 是一个转换策略） |
| Jest | 测试匹配器 (`toBe`/`toEqual`/`toMatch`) |
| Express | 中间件（每个中间件是一个处理策略） |

```javascript
// Webpack loader 链 —— 每个 loader 是一个转换策略
// rule: {
//   test: /\.scss$/,
//   use: ['style-loader', 'css-loader', 'sass-loader']
// }
// 数据流: SCSS → sass-loader → CSS → css-loader → JS → style-loader → DOM
// 每个 loader 独立实现，可自由组合
```

### 2.9 面试高频问题

**Q1：策略模式和 if/else 有什么区别？**
> 本质都是分支，但策略模式把每个分支封装成独立单元。优势：① 开闭原则（新增策略不改已有代码）② 可测试性（每个策略独立测试）③ 可复用（策略可跨场景使用）④ 可读性（消除长 if/else）

**Q2：策略模式有什么缺点？**
> ① 策略类数量多（但可以用函数式简化）② 客户端需要知道所有策略（可通过工厂 + 策略结合解决）③ 过度设计（如果分支很少且不变，if/else 更简单）

**Q3：函数式和类式策略各有什么优劣？**
> 函数式：简洁、适合简单逻辑、JS 原生友好。类式：可携带状态、可实现接口、适合复杂策略。JS 中优先函数式，复杂场景用类式。

**Q4：策略模式和模板方法模式的区别？**
> 策略是组合（运行时可切换），模板方法是继承（编译时确定）。策略更灵活，模板方法更结构化。

---

## 三、四大模式横向对比

| 模式 | 核心问题 | 解决方式 | 关键词 |
|------|----------|----------|--------|
| 单例 | 全局唯一 | 控制实例化 | 唯一实例、全局访问 |
| 工厂 | 对象创建 | 封装创建过程 | 解耦、统一入口 |
| 观察者 | 一对多通知 | 订阅/发布 | 事件、解耦、异步 |
| 策略 | 算法切换 | 封装算法族 | 可替换、开闭原则 |

### 组合使用示例：工厂 + 策略

```javascript
// === 实战：通知系统 —— 工厂创建通知器 + 策略决定发送方式 ===

// 策略：不同渠道的发送逻辑
const sendStrategies = {
  sms: (phone, msg) => console.log(`[短信] → ${phone}: ${msg}`),
  email: (email, msg) => console.log(`[邮件] → ${email}: ${msg}`),
  push: (token, msg) => console.log(`[推送] → ${token}: ${msg}`),
  webhook: (url, msg) => console.log(`[Webhook] → ${url}: ${msg}`),
};

// 工厂：根据通知类型创建通知器
class NotificationFactory {
  static create(type, target) {
    const send = sendStrategies[type];
    if (!send) throw new Error(`未知通知渠道: ${type}`);
    return {
      send(msg) { send(target, msg); },
      channel: type,
      target,
    };
  }

  static createMulti(targets) {
    // 组合模式：多个通知器组合
    const notifiers = targets.map(t => this.create(t.type, t.target));
    return {
      send(msg) {
        notifiers.forEach(n => n.send(msg));
      },
      channels: notifiers.map(n => n.channel),
    };
  }
}

// 使用
const sms = NotificationFactory.create('sms', '13800138000');
sms.send('您的验证码是 123456');

const multi = NotificationFactory.createMulti([
  { type: 'sms', target: '13800138000' },
  { type: 'email', target: 'user@example.com' },
  { type: 'push', target: 'device-token-abc' },
]);
multi.send('订单已发货');
```

---

## 四、闭卷自测题

### 题 1：工厂模式
实现一个 `LoggerFactory`，支持创建 `console`、`file`、`remote` 三种日志器。要求：
- 同类型只创建一次（工厂 + 单例）
- 新增日志类型不需要修改工厂函数核心逻辑

<details>
<summary>参考答案</summary>

```javascript
class ConsoleLogger {
  log(msg) { console.log(`[CONSOLE] ${msg}`); }
  error(msg) { console.error(`[CONSOLE] ${msg}`); }
}

class FileLogger {
  constructor(path) { this.path = path; }
  log(msg) { /* fs.appendFileSync(this.path, msg) */ }
  error(msg) { /* fs.appendFileSync(this.path, `[ERROR] ${msg}`) */ }
}

class RemoteLogger {
  constructor(url) { this.url = url; }
  async log(msg) { /* await fetch(this.url, { body: msg }) */ }
  async error(msg) { /* await fetch(this.url, { body: `[ERROR] ${msg}` }) */ }
}

const LoggerFactory = {
  registry: new Map(), // 注册表
  cache: new Map(),

  // 注册新类型（扩展点）
  register(name, Cls) {
    this.registry.set(name, Cls);
  },

  create(name, ...args) {
    const key = `${name}:${JSON.stringify(args)}`;
    if (!this.cache.has(key)) {
      const Cls = this.registry.get(name);
      if (!Cls) throw new Error(`未注册的日志器: ${name}`);
      this.cache.set(key, new Cls(...args));
    }
    return this.cache.get(key);
  }
};

// 注册内置类型
LoggerFactory.register('console', ConsoleLogger);
LoggerFactory.register('file', FileLogger);
LoggerFactory.register('remote', RemoteLogger);

// 使用
const logger = LoggerFactory.create('console');
logger.log('Hello');

// 新增类型无需修改工厂
class DatabaseLogger { /* ... */ }
LoggerFactory.register('database', DatabaseLogger);
```
</details>

### 题 2：策略模式
实现一个 `Validator`，支持组合多个验证策略。要求：
- 策略可复用
- 支持自定义错误消息
- 支持所有通过/任一通过（AND/OR）

<details>
<summary>参考答案</summary>

```javascript
const rules = {
  required: (msg = '必填') => (v) => v != null && v !== '' ? true : msg,
  minLength: (n, msg) => (v) => v.length >= n ? true : (msg || `至少 ${n} 个字符`),
  maxLength: (n, msg) => (v) => v.length <= n ? true : (msg || `最多 ${n} 个字符`),
  email: (msg = '邮箱格式错误') => (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? true : msg,
  pattern: (re, msg) => (v) => re.test(v) ? true : (msg || '格式不匹配'),
};

class FieldValidator {
  constructor(mode = 'all') { // 'all' = AND, 'any' = OR
    this.strategies = [];
    this.mode = mode;
  }

  add(strategy, msg) {
    this.strategies.push({ fn: strategy, msg });
    return this;
  }

  validate(value) {
    if (this.mode === 'all') {
      for (const { fn, msg } of this.strategies) {
        const result = fn(value);
        if (result !== true) return result;
      }
      return true;
    } else {
      const errors = [];
      for (const { fn, msg } of this.strategies) {
        const result = fn(value);
        if (result === true) return true;
        errors.push(result);
      }
      return errors[0] || '至少满足一个条件';
    }
  }
}

// 使用
const username = new FieldValidator('all')
  .add(rules.required())
  .add(rules.minLength(2))
  .add(rules.maxLength(20));

console.log(username.validate('ab')); // true
console.log(username.validate(''));   // '必填'

const phoneOrEmail = new FieldValidator('any')
  .add(rules.pattern(/^1[3-9]\d{9}$/, '手机号格式错误'))
  .add(rules.email('邮箱格式错误'));

console.log(phoneOrEmail.validate('test@example.com')); // true
```
</details>

### 题 3：综合题
实现一个 `CommandExecutor`，要求：
- 使用工厂模式创建命令对象
- 使用策略模式定义执行方式（同步/异步/队列）
- 支持命令撤销（备忘录模式）

<details>
<summary>参考答案</summary>

```javascript
// === 命令对象（工厂模式）===
class Command {
  constructor(execute, undo) {
    this.execute = execute;
    this.undo = undo;
  }
}

const CommandFactory = {
  create(type, config) {
    const cmds = {
      log: () => new Command(
        () => console.log(config.msg),
        () => console.log(`[撤销] ${config.msg}`)
      ),
      set: () => new Command(
        () => { config.target[config.key] = config.value; },
        () => { config.target[config.key] = config.oldValue; }
      ),
      push: () => new Command(
        () => config.arr.push(config.item),
        () => config.arr.pop()
      ),
    };
    const cmd = cmds[type];
    if (!cmd) throw new Error(`未知命令: ${type}`);
    return cmd();
  }
};

// === 执行策略（策略模式）===
const execStrategies = {
  sync: (commands) => {
    const history = [];
    for (const cmd of commands) {
      cmd.execute();
      history.push(cmd);
    }
    return { history, undoLast() { const cmd = history.pop(); if (cmd) cmd.undo(); } };
  },

  async: async (commands) => {
    const history = [];
    for (const cmd of commands) {
      await cmd.execute();
      history.push(cmd);
    }
    return { history, async undoLast() { const cmd = history.pop(); if (cmd) await cmd.undo(); } };
  },

  queue: (commands) => {
    const queue = [...commands];
    const history = [];
    return {
      runNext() {
        const cmd = queue.shift();
        if (cmd) { cmd.execute(); history.push(cmd); }
        return history.length;
      },
      undoLast() { const cmd = history.pop(); if (cmd) cmd.undo(); }
    };
  }
};

// === 执行器 ===
class CommandExecutor {
  constructor(strategy = 'sync') {
    this.strategy = execStrategies[strategy];
  }

  setStrategy(name) {
    this.strategy = execStrategies[name];
  }

  execute(commands) {
    return this.strategy(commands);
  }
}

// 使用
const cmds = [
  CommandFactory.create('set', { target: {}, key: 'name', value: 'Alice', oldValue: undefined }),
  CommandFactory.create('push', { arr: [], item: 1 }),
];

const executor = new CommandExecutor('sync');
const result = executor.execute(cmds);
// 执行后 undo
result.undoLast();
```
</details>

---

## 五、速查卡片

### 工厂模式速查
```
何时用：对象创建逻辑复杂 / 类型运行时确定 / 需要统一创建入口
三种变体：简单工厂(函数) → 工厂方法(继承) → 抽象工厂(产品族)
JS 原生体现：axios.create() / express.Router() / React.createElement()
陷阱：简单工厂新增类型需修改内部（用注册表解决）
```

### 策略模式速查
```
何时用：多个 if/else 分支 / 算法需要切换 / 算法需要独立测试
实现方式：函数式(简洁) vs 类式(可携带状态)
JS 原生体现：Array.sort(fn) / Webpack loader / Express 中间件
陷阱：策略过多时管理成本高（用注册表 + 工厂管理）
```

---

*本次训练完成。工厂 + 策略模式覆盖完毕。*
*累计：单例 ✅ | 工厂 ✅ | 观察者 ✅ | 策略 ✅ = 四大核心模式闭环 🎯*
