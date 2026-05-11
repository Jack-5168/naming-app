# 设计模式专项训练 - 02:00 (2026-04-25)

**主题:** JavaScript 设计模式 — 工厂模式 + 策略模式
**上次覆盖:** 单例模式 + 观察者模式 (4/23)
**本次覆盖:** 工厂模式 + 策略模式

---

## 一、工厂模式 (Factory Pattern)

### 1.1 概念

工厂模式封装对象的创建过程，调用者无需知道具体的类名和创建细节，只需传入参数即可获得所需对象。核心思想：**将 new 操作交给工厂统一管理**。

### 1.2 三种变体

| 变体 | 描述 | 适用场景 |
|------|------|----------|
| 简单工厂 | 一个工厂函数/方法创建多种对象 | 对象类型有限且固定 |
| 工厂方法 | 定义创建接口，子类决定实例化哪个类 | 创建逻辑需要扩展 |
| 抽象工厂 | 创建一组相关对象，不指定具体类 | 产品族（多系列） |

### 1.3 简单工厂 — 基础实现

```javascript
// 简单工厂：根据类型创建不同形状
class Circle {
  constructor(radius) {
    this.type = 'circle';
    this.radius = radius;
  }
  area() {
    return Math.PI * this.radius ** 2;
  }
  describe() {
    return `圆形 (r=${this.radius}, area=${this.area().toFixed(2)})`;
  }
}

class Rectangle {
  constructor(width, height) {
    this.type = 'rectangle';
    this.width = width;
    this.height = height;
  }
  area() {
    return this.width * this.height;
  }
  describe() {
    return `矩形 (${this.width}x${this.height}, area=${this.area().toFixed(2)})`;
  }
}

class Triangle {
  constructor(base, height) {
    this.type = 'triangle';
    this.base = base;
    this.height = height;
  }
  area() {
    return 0.5 * this.base * this.height;
  }
  describe() {
    return `三角形 (b=${this.base}, h=${this.height}, area=${this.area().toFixed(2)})`;
  }
}

// 简单工厂
class ShapeFactory {
  static create(type, ...args) {
    const creators = {
      circle:    () => new Circle(...args),
      rectangle: () => new Rectangle(...args),
      triangle:  () => new Triangle(...args),
    };
    const creator = creators[type.toLowerCase()];
    if (!creator) {
      throw new Error(`未知形状类型: ${type}`);
    }
    return creator();
  }
}

// 使用
const shapes = [
  ShapeFactory.create('circle', 5),
  ShapeFactory.create('rectangle', 4, 6),
  ShapeFactory.create('triangle', 3, 8),
];

shapes.forEach(s => console.log(s.describe()));
// 圆形 (r=5, area=78.54)
// 矩形 (4x6, area=24.00)
// 三角形 (b=3, h=8, area=12.00)
```

### 1.4 简单工厂 — 实际场景：HTTP 请求工厂

```javascript
// 不同请求配置工厂
class HttpRequest {
  constructor(config) {
    this.url = config.url;
    this.method = config.method || 'GET';
    this.headers = { 'Content-Type': 'application/json', ...config.headers };
    this.timeout = config.timeout || 5000;
    this.body = config.body || null;
  }

  async execute() {
    const options = {
      method: this.method,
      headers: this.headers,
      ...(this.body && { body: JSON.stringify(this.body) }),
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return { ok: response.ok, status: response.status, data: await response.json() };
    } catch (error) {
      clearTimeout(timer);
      return { ok: false, error: error.message };
    }
  }
}

class RequestFactory {
  // GET 请求
  static get(url, headers = {}) {
    return new HttpRequest({ url, method: 'GET', headers });
  }

  // POST 请求
  static post(url, body, headers = {}) {
    return new HttpRequest({ url, method: 'POST', body, headers });
  }

  // 文件上传
  static upload(url, formData, headers = {}) {
    return new HttpRequest({
      url,
      method: 'POST',
      body: formData,
      headers: { ...headers }, // 不设置 Content-Type，让浏览器自动设置 multipart
    });
  }

  // 带认证的请求
  static authenticated(url, method = 'GET', body = null, token = '') {
    return new HttpRequest({
      url,
      method,
      body,
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // 批量请求
  static batch(requests) {
    return Promise.all(requests.map(req => req.execute()));
  }
}

// 使用
const getUser = RequestFactory.get('https://api.example.com/users/1');
const createUser = RequestFactory.post('https://api.example.com/users', {
  name: '张三',
  email: 'zhangsan@example.com',
});
const protectedReq = RequestFactory.authenticated(
  'https://api.example.com/admin',
  'GET',
  null,
  'eyJhbGciOiJIUzI1NiJ9...'
);

console.log(getUser.method);    // GET
console.log(createUser.method); // POST
console.log(protectedReq.headers.Authorization); // Bearer eyJ...
```

### 1.5 工厂方法 — 可扩展实现

```javascript
// 抽象工厂方法：子类决定创建什么产品
class Dialog {
  // 工厂方法 — 子类必须实现
  createButton() {
    throw new Error('子类必须实现 createButton()');
  }
  createCheckbox() {
    throw new Error('子类必须实现 createCheckbox()');
  }

  render() {
    const button = this.createButton();
    const checkbox = this.createCheckbox();
    return {
      components: [button.render(), checkbox.render()],
      type: this.constructor.name,
    };
  }
}

// 产品接口
class Button { render() { throw new Error('必须实现 render()'); } }
class Checkbox { render() { throw new Error('必须实现 render()'); } }

// 具体产品：Windows 风格
class WindowsButton extends Button {
  render() { return '🪟 Windows Button (rectangular, blue border)'; }
}
class WindowsCheckbox extends Checkbox {
  render() { return '☐ Windows Checkbox (square, gray)'; }
}

// 具体产品：Mac 风格
class MacButton extends Button {
  render() { return '🍎 Mac Button (rounded, gradient)'; }
}
class MacCheckbox extends Checkbox {
  render() { return '☑ Mac Checkbox (rounded, blue check)'; }
}

// 具体工厂
class WindowsDialog extends Dialog {
  createButton() { return new WindowsButton(); }
  createCheckbox() { return new WindowsCheckbox(); }
}

class MacDialog extends Dialog {
  createButton() { return new MacButton(); }
  createCheckbox() { return new MacCheckbox(); }
}

// 使用 — 客户端代码无需知道具体产品类
function renderApp(dialog) {
  const result = dialog.render();
  console.log(`=== ${result.type} ===`);
  result.components.forEach(c => console.log(c));
}

renderApp(new WindowsDialog());
// === WindowsDialog ===
// 🪟 Windows Button (rectangular, blue border)
// ☐ Windows Checkbox (square, gray)

renderApp(new MacDialog());
// === MacDialog ===
// 🍎 Mac Button (rounded, gradient)
// ☑ Mac Checkbox (rounded, blue check)
```

### 1.6 抽象工厂 — 产品族

```javascript
// 抽象工厂：创建一组相关/依赖对象（产品族）
// 场景：主题系统 — 每个主题包含颜色、字体、间距

// 抽象产品
class ColorScheme { getColors() { throw new Error('必须实现'); } }
class Typography { getFonts() { throw new Error('必须实现'); } }
class Spacing { getSpacing() { throw new Error('必须实现'); } }

// 产品族 A: Light 主题
class LightColors extends ColorScheme { getColors() { return { bg: '#FFFFFF', text: '#333333', accent: '#0066CC', border: '#E0E0E0' }; } }
class LightFonts extends Typography { getFonts() { return { heading: 'Inter, sans-serif', body: 'Roboto, sans-serif', mono: 'Fira Code, monospace' }; } }
class LightSpacing extends Spacing { getSpacing() { return { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }; } }

// 产品族 B: Dark 主题
class DarkColors extends ColorScheme { getColors() { return { bg: '#1A1A2E', text: '#E0E0E0', accent: '#E94560', border: '#16213E' }; } }
class DarkFonts extends Typography { getFonts() { return { heading: 'Outfit, sans-serif', body: 'Noto Sans, sans-serif', mono: 'JetBrains Mono, monospace' }; } }
class DarkSpacing extends Spacing { getSpacing() { return { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 }; } }

// 抽象工厂
class ThemeFactory {
  createColors() { throw new Error('必须实现'); }
  createTypography() { throw new Error('必须实现'); }
  createSpacing() { throw new Error('必须实现'); }

  // 获取完整主题配置
  getTheme() {
    return {
      colors: this.createColors().getColors(),
      fonts: this.createTypography().getFonts(),
      spacing: this.createSpacing().getSpacing(),
    };
  }
}

// 具体工厂
class LightThemeFactory extends ThemeFactory {
  createColors() { return new LightColors(); }
  createTypography() { return new LightFonts(); }
  createSpacing() { return new LightSpacing(); }
}

class DarkThemeFactory extends ThemeFactory {
  createColors() { return new DarkColors(); }
  createTypography() { return new DarkFonts(); }
  createSpacing() { return new DarkSpacing(); }
}

// 使用
function applyTheme(factory) {
  const theme = factory.getTheme();
  console.log('=== 主题配置 ===');
  console.log('颜色:', JSON.stringify(theme.colors, null, 2));
  console.log('字体:', JSON.stringify(theme.fonts, null, 2));
  console.log('间距:', JSON.stringify(theme.spacing, null, 2));
}

applyTheme(new LightThemeFactory());
applyTheme(new DarkThemeFactory());
```

### 1.7 工厂模式要点

- **简单工厂**：最常用，一个静态方法搞定，适合对象类型固定的场景
- **工厂方法**：通过继承扩展，开闭原则（对扩展开放，对修改关闭）
- **抽象工厂**：产品族场景，保证一组产品的一致性
- **JS 特有技巧**：用对象映射代替 switch/case，更优雅
- **常见陷阱**：工厂方法参数过多 → 考虑用 Builder 模式

---

## 二、策略模式 (Strategy Pattern)

### 2.1 概念

策略模式定义一系列算法，将每个算法封装起来，使它们可以互换。核心思想：**将行为抽象为策略对象，运行时动态选择**。

### 2.2 基础实现 — 促销策略

```javascript
// 策略接口：所有策略实现相同的方法
class PricingStrategy {
  calculate(price) {
    throw new Error('子类必须实现 calculate()');
  }
}

// 具体策略 A: 无折扣
class RegularPrice extends PricingStrategy {
  calculate(price) {
    return { final: price, discount: 0, label: '原价' };
  }
}

// 具体策略 B: 百分比折扣
class PercentageDiscount extends PricingStrategy {
  constructor(percent) {
    super();
    this.percent = percent;
  }
  calculate(price) {
    const discount = price * (this.percent / 100);
    return { final: +(price - discount).toFixed(2), discount: +discount.toFixed(2), label: `${this.percent}% 折扣` };
  }
}

// 具体策略 C: 满减
class TieredDiscount extends PricingStrategy {
  constructor(threshold, amount) {
    super();
    this.threshold = threshold;
    this.amount = amount;
  }
  calculate(price) {
    const discount = price >= this.threshold ? this.amount : 0;
    return { final: +(price - discount).toFixed(2), discount: +discount.toFixed(2), label: discount ? `满${this.threshold}减${this.amount}` : '无优惠' };
  }
}

// 具体策略 D: 会员价
class MemberPrice extends PricingStrategy {
  constructor(memberLevel) {
    super();
    this.levels = {
      bronze: 0.95,
      silver: 0.90,
      gold: 0.85,
      platinum: 0.80,
    };
    this.multiplier = this.levels[memberLevel] || 1;
  }
  calculate(price) {
    const discount = +(price * (1 - this.multiplier)).toFixed(2);
    return { final: +(price * this.multiplier).toFixed(2), discount, label: `会员价 (${this.multiplier * 100}%)` };
  }
}

// 上下文：价格计算器
class PriceCalculator {
  constructor(strategy) {
    this.strategy = strategy;
  }

  // 运行时切换策略
  setStrategy(strategy) {
    this.strategy = strategy;
  }

  getPrice(price) {
    return this.strategy.calculate(price);
  }
}

// 使用
const calculator = new PriceCalculator(new RegularPrice());

console.log(calculator.getPrice(100));
// { final: 100, discount: 0, label: '原价' }

calculator.setStrategy(new PercentageDiscount(20));
console.log(calculator.getPrice(100));
// { final: 80, discount: 20, label: '20% 折扣' }

calculator.setStrategy(new TieredDiscount(200, 50));
console.log(calculator.getPrice(150)); // 未满门槛
// { final: 150, discount: 0, label: '无优惠' }
console.log(calculator.getPrice(250)); // 满足门槛
// { final: 200, discount: 50, label: '满200减50' }

calculator.setStrategy(new MemberPrice('gold'));
console.log(calculator.getPrice(100));
// { final: 85, discount: 15, label: '会员价 (85%)' }
```

### 2.3 策略模式 — 表单验证

```javascript
// 验证策略接口
class ValidationStrategy {
  validate(value) {
    throw new Error('子类必须实现 validate()');
  }
}

// 具体策略
class RequiredValidator extends ValidationStrategy {
  validate(value) {
    return {
      valid: value !== null && value !== undefined && String(value).trim() !== '',
      message: '此字段为必填项',
    };
  }
}

class EmailValidator extends ValidationStrategy {
  validate(value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return {
      valid: emailRegex.test(value),
      message: '请输入有效的邮箱地址',
    };
  }
}

class MinLengthValidator extends ValidationStrategy {
  constructor(min) {
    super();
    this.min = min;
  }
  validate(value) {
    return {
      valid: String(value).length >= this.min,
      message: `最少需要 ${this.min} 个字符`,
    };
  }
}

class MaxLengthValidator extends ValidationStrategy {
  constructor(max) {
    super();
    this.max = max;
  }
  validate(value) {
    return {
      valid: String(value).length <= this.max,
      message: `最多允许 ${this.max} 个字符`,
    };
  }
}

class PatternValidator extends ValidationStrategy {
  constructor(regex, message) {
    super();
    this.regex = regex;
    this.message = message;
  }
  validate(value) {
    return {
      valid: this.regex.test(value),
      message: this.message,
    };
  }
}

// 上下文：表单验证器
class FormValidator {
  constructor() {
    this.rules = {}; // { fieldName: [strategy1, strategy2, ...] }
  }

  addRule(fieldName, ...strategies) {
    this.rules[fieldName] = strategies;
  }

  validate(data) {
    const errors = {};

    for (const [field, strategies] of Object.entries(this.rules)) {
      const value = data[field];
      for (const strategy of strategies) {
        const result = strategy.validate(value);
        if (!result.valid) {
          errors[field] = result.message;
          break; // 第一个失败即停止
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}

// 使用
const validator = new FormValidator();

validator.addRule('email', new RequiredValidator(), new EmailValidator());
validator.addRule('username', new RequiredValidator(), new MinLengthValidator(3), new MaxLengthValidator(20));
validator.addRule('password', new RequiredValidator(), new MinLengthValidator(8),
  new PatternValidator(/[A-Z]/, '密码必须包含大写字母'),
  new PatternValidator(/[0-9]/, '密码必须包含数字'),
);

// 验证通过
console.log(validator.validate({
  email: 'test@example.com',
  username: 'alice',
  password: 'MyPass123',
}));
// { valid: true, errors: {} }

// 验证失败
console.log(validator.validate({
  email: 'invalid',
  username: 'ab',
  password: 'weak',
}));
// { valid: false, errors: { email: '请输入有效的邮箱地址', username: '最少需要 3 个字符', password: '密码必须包含大写字母' } }
```

### 2.4 策略模式 — 排序策略

```javascript
// 排序策略
class SortStrategy {
  sort(arr) {
    throw new Error('子类必须实现 sort()');
  }
}

class BubbleSort extends SortStrategy {
  sort(arr) {
    const result = [...arr];
    const n = result.length;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - i - 1; j++) {
        if (result[j] > result[j + 1]) {
          [result[j], result[j + 1]] = [result[j + 1], result[j]];
        }
      }
    }
    return result;
  }
}

class QuickSort extends SortStrategy {
  sort(arr) {
    if (arr.length <= 1) return [...arr];
    const pivot = arr[Math.floor(arr.length / 2)];
    const left = arr.filter(v => v < pivot);
    const middle = arr.filter(v => v === pivot);
    const right = arr.filter(v => v > pivot);
    return [...this.sort(left), ...middle, ...this.sort(right)];
  }
}

class MergeSort extends SortStrategy {
  sort(arr) {
    if (arr.length <= 1) return [...arr];
    const mid = Math.floor(arr.length / 2);
    const left = this.sort(arr.slice(0, mid));
    const right = this.sort(arr.slice(mid));
    return this.merge(left, right);
  }
  merge(left, right) {
    const result = [];
    let i = 0, j = 0;
    while (i < left.length && j < right.length) {
      if (left[i] <= right[j]) result.push(left[i++]);
      else result.push(right[j++]);
    }
    return [...result, ...left.slice(i), ...right.slice(j)];
  }
}

// 上下文
class Sorter {
  constructor(strategy) {
    this.strategy = strategy;
  }
  setStrategy(strategy) { this.strategy = strategy; }
  sort(arr) { return this.strategy.sort(arr); }
}

// 使用 — 根据数据量选择策略
const data = [64, 34, 25, 12, 22, 11, 90, 1, 55, 42];

const sorter = new Sorter(new BubbleSort());
console.log('冒泡排序:', sorter.sort(data));

sorter.setStrategy(new QuickSort());
console.log('快速排序:', sorter.sort(data));

sorter.setStrategy(new MergeSort());
console.log('归并排序:', sorter.sort(data));
```

### 2.5 策略模式 — JS 函数式风格

```javascript
// JS 中策略模式最自然的写法：用函数代替类
const strategies = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => b !== 0 ? a / b : NaN,
  modulo: (a, b) => b !== 0 ? a % b : NaN,
};

function calculate(a, b, operation) {
  const fn = strategies[operation];
  if (!fn) throw new Error(`未知操作: ${operation}`);
  return fn(a, b);
}

console.log(calculate(10, 3, 'add'));      // 13
console.log(calculate(10, 3, 'multiply')); // 30
console.log(calculate(10, 3, 'modulo'));   // 1

// 动态注册策略
strategies.power = (a, b) => a ** b;
console.log(calculate(2, 10, 'power'));    // 1024
```

### 2.6 策略模式要点

- **核心优势**：消除大量 if/else 或 switch/case
- **开闭原则**：新增策略只需添加新类/函数，无需修改已有代码
- **运行时切换**：策略可以在运行时动态更换
- **JS 特色**：函数天然就是策略，不需要类也可以实现
- **与工厂模式的区别**：工厂关注"创建什么"，策略关注"怎么做"

---

## 三、工厂 + 策略组合实战

```javascript
// 实战：支付系统 — 工厂创建支付策略，策略执行支付逻辑

// 支付策略
class PaymentStrategy {
  async pay(amount) {
    throw new Error('子类必须实现 pay()');
  }
  getFee(amount) {
    throw new Error('子类必须实现 getFee()');
  }
}

class AlipayStrategy extends PaymentStrategy {
  async pay(amount) {
    return { method: '支付宝', amount, status: 'success', transactionId: `ALIPAY_${Date.now()}` };
  }
  getFee(amount) { return +(amount * 0.006).toFixed(2); } // 0.6%
}

class WechatStrategy extends PaymentStrategy {
  async pay(amount) {
    return { method: '微信支付', amount, status: 'success', transactionId: `WECHAT_${Date.now()}` };
  }
  getFee(amount) { return +(amount * 0.0055).toFixed(2); } // 0.55%
}

class CreditCardStrategy extends PaymentStrategy {
  constructor(cardType) {
    super();
    this.cardType = cardType; // 'visa' | 'mastercard' | 'unionpay'
  }
  async pay(amount) {
    return { method: `信用卡(${this.cardType})`, amount, status: 'success', transactionId: `CARD_${Date.now()}` };
  }
  getFee(amount) {
    const rates = { visa: 0.015, mastercard: 0.015, unionpay: 0.012 };
    return +(amount * (rates[this.cardType] || 0.015)).toFixed(2);
  }
}

class CryptoStrategy extends PaymentStrategy {
  async pay(amount) {
    return { method: '加密货币', amount, status: 'pending', transactionId: `CRYPTO_${Date.now()}` };
  }
  getFee(amount) { return +(amount * 0.01).toFixed(2); } // 1%
}

// 支付工厂
class PaymentFactory {
  static create(method, options = {}) {
    const creators = {
      alipay:     () => new AlipayStrategy(),
      wechat:     () => new WechatStrategy(),
      creditcard: () => new CreditCardStrategy(options.cardType || 'visa'),
      crypto:     () => new CryptoStrategy(),
    };
    const creator = creators[method.toLowerCase()];
    if (!creator) throw new Error(`不支持的支付方式: ${method}`);
    return creator();
  }
}

// 支付上下文
class PaymentProcessor {
  constructor() {
    this.strategy = null;
  }

  setMethod(method, options = {}) {
    this.strategy = PaymentFactory.create(method, options);
    return this;
  }

  async process(amount) {
    if (!this.strategy) throw new Error('请先设置支付方式');
    const fee = this.strategy.getFee(amount);
    const result = await this.strategy.pay(amount);
    return {
      ...result,
      fee,
      total: +(amount + fee).toFixed(2),
    };
  }
}

// 使用
async function demo() {
  const processor = new PaymentProcessor();

  // 支付宝
  const alipayResult = await processor.setMethod('alipay').process(100);
  console.log('支付宝:', JSON.stringify(alipayResult));
  // { method: '支付宝', amount: 100, status: 'success', fee: 0.60, total: 100.60 }

  // 信用卡 (Visa)
  const cardResult = await processor.setMethod('creditcard', { cardType: 'visa' }).process(100);
  console.log('信用卡:', JSON.stringify(cardResult));
  // { method: '信用卡(visa)', amount: 100, status: 'success', fee: 1.50, total: 101.50 }

  // 加密货币
  const cryptoResult = await processor.setMethod('crypto').process(100);
  console.log('加密货币:', JSON.stringify(cryptoResult));
  // { method: '加密货币', amount: 100, status: 'pending', fee: 1.00, total: 101.00 }
}

demo();
```

---

## 四、总结对比

| 特性 | 工厂模式 | 策略模式 |
|------|----------|----------|
| 核心目的 | 封装对象创建 | 封装算法/行为 |
| 解决的问题 | new 操作分散、创建逻辑复杂 | 大量条件分支、行为硬编码 |
| 关键方法 | create()/createXxx() | calculate()/validate()/sort() |
| 典型应用 | 创建不同形状/请求/产品 | 促销/验证/排序/支付 |
| 优点 | 创建逻辑集中、易扩展 | 消除条件分支、运行时切换 |
| JS 特色写法 | 对象映射 + 静态方法 | 函数即策略 |
| 组合使用 | 工厂创建策略对象 | 策略执行具体行为 |

---

## 五、四种核心设计模式总览

| 模式 | 一句话 | 关键词 |
|------|--------|--------|
| 单例 | 全局唯一实例 | getInstance, 闭包, 配置管理 |
| 观察者 | 一对多通知机制 | subscribe, emit, 事件总线 |
| 工厂 | 统一创建对象 | create, 产品族, 开闭原则 |
| 策略 | 算法可互换 | setStrategy, 消除 if/else |

---

_训练完成时间：2026-04-25 02:00_
