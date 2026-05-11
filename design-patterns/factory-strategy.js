/**
 * 专项训练 02:00 - JavaScript 设计模式
 * 日期: 2026-05-01
 * 模式: 工厂模式 (Factory) + 策略模式 (Strategy)
 * 前置: 4/28 已学 单例模式 + 观察者模式
 */

// ============================================================
// 模式一：工厂模式 (Factory Pattern)
// ============================================================
// 核心思想：定义一个创建对象的接口，让子类/工厂函数决定实例化哪个类，
//          将对象的创建与使用解耦。
// 适用场景：需要根据条件创建不同类型的对象、框架/库中大量实例化、
//          创建逻辑复杂或需要统一初始化流程。

// --- 实现 1：简单工厂（Simple Factory） ---
// 一个工厂函数，根据参数返回不同类型的实例

class Notification {
  constructor(type, message) {
    this.type = type;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }
}

class EmailNotification extends Notification {
  constructor(message, recipient) {
    super('email', message);
    this.recipient = recipient;
  }

  send() {
    return `[邮件] 发送至 ${this.recipient}: "${this.message}"`;
  }
}

class SmsNotification extends Notification {
  constructor(message, phone) {
    super('sms', message);
    this.phone = phone;
  }

  send() {
    return `[短信] 发送至 ${this.phone}: "${this.message}"`;
  }
}

class PushNotification extends Notification {
  constructor(message, deviceId) {
    super('push', message);
    this.deviceId = deviceId;
  }

  send() {
    return `[推送] 发送至设备 ${this.deviceId}: "${this.message}"`;
  }
}

// 工厂函数
function createNotification(type, message, target) {
  const map = {
    email: () => new EmailNotification(message, target),
    sms: () => new SmsNotification(message, target),
    push: () => new PushNotification(message, target),
  };
  const creator = map[type];
  if (!creator) throw new Error(`未知的通知类型: ${type}`);
  return creator();
}

// 测试
const email = createNotification('email', '验证码 837492', 'user@example.com');
const sms = createNotification('sms', '您的订单已发货', '13800138000');
const push = createNotification('push', '新消息来了！', 'device-abc-123');

console.log(email.send());
console.log(sms.send());
console.log(push.send());

// --- 实现 2：工厂方法（Factory Method） ---
// 每个子类负责创建自己的产品，符合开闭原则

class Logger {
  log(message) {
    throw new Error('子类必须实现 log()');
  }
}

class ConsoleLogger extends Logger {
  log(message) {
    const ts = new Date().toISOString();
    console.log(`[CONSOLE ${ts}] ${message}`);
  }
}

class FileLogger extends Logger {
  constructor(filename) {
    super();
    this.filename = filename;
    this.entries = [];
  }

  log(message) {
    const entry = `[${new Date().toISOString()}] ${message}`;
    this.entries.push(entry);
    console.log(`[FILE ${this.filename}] 已写入日志`);
  }

  getEntries() {
    return this.entries;
  }
}

class DatabaseLogger extends Logger {
  constructor(connection) {
    super();
    this.connection = connection;
  }

  log(message) {
    console.log(`[DB ${this.connection}] INSERT INTO logs VALUES ('${message}')`);
  }
}

// 工厂方法：每个 Logger 子类有自己的工厂
class LoggerFactory {
  static create(type, ...args) {
    const map = {
      console: () => new ConsoleLogger(),
      file: () => new FileLogger(args[0] || 'app.log'),
      database: () => new DatabaseLogger(args[0] || 'default'),
    };
    const creator = map[type];
    if (!creator) throw new Error(`未知的日志类型: ${type}`);
    return creator();
  }
}

const consoleLogger = LoggerFactory.create('console');
const fileLogger = LoggerFactory.create('file', 'error.log');
const dbLogger = LoggerFactory.create('database', 'pg://localhost');

consoleLogger.log('应用启动');
fileLogger.log('用户登录失败');
dbLogger.log('订单创建成功');

// --- 实现 3：抽象工厂（Abstract Factory） ---
// 创建一组相关/依赖的对象，无需指定具体类

// UI 组件族 — 暗色主题
const DarkButton = { render: () => '<button class="dark">Dark Button</button>' };
const DarkInput = { render: () => '<input class="dark" placeholder="Dark Input" />' };
const DarkModal = { render: () => '<div class="modal dark">Dark Modal</div>' };

// UI 组件族 — 亮色主题
const LightButton = { render: () => '<button class="light">Light Button</button>' };
const LightInput = { render: () => '<input class="light" placeholder="Light Input" />' };
const LightModal = { render: () => '<div class="modal light">Light Modal</div>' };

// 抽象工厂
function createUIFactory(theme) {
  const factories = {
    dark: {
      createButton: () => DarkButton,
      createInput: () => DarkInput,
      createModal: () => DarkModal,
    },
    light: {
      createButton: () => LightButton,
      createInput: () => LightInput,
      createModal: () => LightModal,
    },
  };
  return factories[theme];
}

const darkFactory = createUIFactory('dark');
const lightFactory = createUIFactory('light');

console.log('暗色主题:', darkFactory.createButton().render());
console.log('亮色主题:', lightFactory.createButton().render());


// ============================================================
// 模式二：策略模式 (Strategy Pattern)
// ============================================================
// 核心思想：定义一系列算法，将每个算法封装起来，使它们可以互换。
//          让算法的变化独立于使用算法的客户端。
// 适用场景：多种校验规则、多种支付方式、多种排序算法、
//          表单验证、折扣计算、路由策略等。

// --- 实现 1：表单验证策略 ---

const validators = {
  // 非空验证
  required(value) {
    return value !== '' && value != null ? null : '此项为必填项';
  },

  // 邮箱验证
  email(value) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(value) ? null : '请输入有效的邮箱地址';
  },

  // 手机号验证
  phone(value) {
    const re = /^1[3-9]\d{9}$/;
    return re.test(value) ? null : '请输入有效的手机号';
  },

  // 长度范围验证
  length(min, max) {
    return function (value) {
      if (value.length >= min && value.length <= max) return null;
      return `长度必须在 ${min}-${max} 之间`;
    };
  },

  // 密码强度验证
  strongPassword(value) {
    if (value.length < 8) return '密码至少 8 位';
    if (!/[A-Z]/.test(value)) return '密码需包含大写字母';
    if (!/[0-9]/.test(value)) return '密码需包含数字';
    return null;
  },
};

// 验证器引擎
class FormValidator {
  constructor() {
    this.rules = new Map(); // fieldName → [{ validator, message }]
  }

  // 为字段添加验证规则
  addRule(fieldName, validatorFn, message) {
    if (!this.rules.has(fieldName)) {
      this.rules.set(fieldName, []);
    }
    this.rules.get(fieldName).push({ validator: validatorFn, message });
    return this;
  }

  // 执行验证
  validate(data) {
    const errors = {};
    for (const [field, rules] of this.rules) {
      const value = data[field] ?? '';
      for (const { validator, message } of rules) {
        const error = typeof validator === 'function'
          ? validator(value)
          : message;
        if (error) {
          errors[field] = errors[field] || [];
          errors[field].push(error);
          break; // 一条规则失败即停止
        }
      }
    }
    return Object.keys(errors).length === 0 ? null : errors;
  }
}

// 使用
const formValidator = new FormValidator()
  .addRule('username', validators.required, '用户名不能为空')
  .addRule('username', validators.length(3, 20), null)
  .addRule('email', validators.required, null)
  .addRule('email', validators.email, null)
  .addRule('phone', validators.phone, null)
  .addRule('password', validators.strongPassword, null);

const testData = {
  username: 'ab',
  email: 'not-an-email',
  phone: '12345',
  password: 'weak',
};

const errors = formValidator.validate(testData);
console.log('验证结果:', errors);
// { username: ['长度必须在 3-20 之间'],
//   email: ['请输入有效的邮箱地址'],
//   phone: ['请输入有效的手机号'],
//   password: ['密码至少 8 位'] }

// --- 实现 2：折扣计算策略 ---

const discountStrategies = {
  // 无折扣
  none(price) {
    return { original: price, discount: 0, final: price };
  },

  // 会员折扣
  member(price, level) {
    const rates = { bronze: 0.95, silver: 0.9, gold: 0.8, platinum: 0.7 };
    const rate = rates[level] ?? 1;
    const discount = price * (1 - rate);
    return { original: price, discount, final: price * rate, level };
  },

  // 促销活动
  promotion(price, promoType) {
    switch (promoType) {
      case 'flash_sale': return { original: price, discount: price * 0.3, final: price * 0.7 };
      case 'bundle': return { original: price, discount: price * 0.15, final: price * 0.85 };
      case 'seasonal': return { original: price, discount: price * 0.2, final: price * 0.8 };
      default: return discountStrategies.none(price);
    }
  },

  // 满减策略
  threshold(price, thresholds) {
    // thresholds: [{ min, off }] 按 min 降序排列
    for (const { min, off } of thresholds) {
      if (price >= min) {
        return { original: price, discount: off, final: price - off };
      }
    }
    return discountStrategies.none(price);
  },
};

// 价格计算器
class PriceCalculator {
  calculate(strategyName, price, ...args) {
    const strategy = discountStrategies[strategyName];
    if (!strategy) throw new Error(`未知的折扣策略: ${strategyName}`);
    return strategy(price, ...args);
  }
}

const calc = new PriceCalculator();
console.log('\n--- 折扣计算 ---');
console.log('会员金卡 ¥1000:', calc.calculate('member', 1000, 'gold'));
console.log('闪购 ¥500:', calc.calculate('promotion', 500, 'flash_sale'));
console.log('满减 ¥300:', calc.calculate('threshold', 300, [
  { min: 500, off: 100 },
  { min: 200, off: 50 },
  { min: 100, off: 20 },
]));

// --- 实现 3：路由策略（实战场景） ---

const routeStrategies = {
  // SPA 客户端路由
  spa(routes) {
    return {
      type: 'SPA',
      navigate(path) {
        const route = routes[path];
        return route ? `渲染组件: ${route.component}` : '404 Not Found';
      },
    };
  },

  // SSR 服务端路由
  ssr(routes) {
    return {
      type: 'SSR',
      async navigate(path) {
        const route = routes[path];
        if (!route) return '404 Not Found';
        const html = await route.render(); // 服务端渲染
        return `SSR HTML: ${html}`;
      },
    };
  },

  // 静态路由（预渲染）
  static(routes) {
    const preRendered = {};
    for (const [path, route] of Object.entries(routes)) {
      preRendered[path] = route.staticHTML;
    }
    return {
      type: 'Static',
      navigate(path) {
        return preRendered[path] ?? '404 Not Found';
      },
    };
  },
};

function createRouter(mode, routes) {
  const strategy = routeStrategies[mode];
  if (!strategy) throw new Error(`未知的路由模式: ${mode}`);
  return strategy(routes);
}

const routes = {
  '/': { component: 'Home', render: () => '<h1>Home SSR</h1>', staticHTML: '<h1>Home Static</h1>' },
  '/about': { component: 'About', render: () => '<h1>About SSR</h1>', staticHTML: '<h1>About Static</h1>' },
};

const spaRouter = createRouter('spa', routes);
const ssrRouter = createRouter('ssr', routes);
const staticRouter = createRouter('static', routes);

console.log('\n--- 路由策略 ---');
console.log(spaRouter.navigate('/'));
console.log(staticRouter.navigate('/about'));


// ============================================================
// 模式组合：工厂 + 策略 = 可插拔的支付系统
// ============================================================

// 策略：各种支付方式
const paymentStrategies = {
  alipay(amount) {
    console.log(`[支付宝] 支付 ¥${amount}，调用支付宝 SDK...`);
    return { success: true, method: 'alipay', amount };
  },
  wechat(amount) {
    console.log(`[微信] 支付 ¥${amount}，生成付款码...`);
    return { success: true, method: 'wechat', amount };
  },
  creditCard(amount, cardInfo) {
    console.log(`[信用卡] 支付 ¥${amount}，卡号 ****${cardInfo.last4}...`);
    return { success: true, method: 'creditCard', amount };
  },
};

// 工厂：创建支付处理器
function createPaymentProcessor(method) {
  const strategy = paymentStrategies[method];
  if (!strategy) throw new Error(`不支持的支付方式: ${method}`);
  return {
    pay(amount, ...args) {
      console.log(`\n[支付网关] 使用 ${method} 处理 ¥${amount}`);
      return strategy(amount, ...args);
    },
  };
}

// 使用
const alipay = createPaymentProcessor('alipay');
alipay.pay(299);

const wechat = createPaymentProcessor('wechat');
wechat.pay(129);

const card = createPaymentProcessor('creditCard');
card.pay(999, { last4: '8888' });

console.log('\n✅ 工厂模式 + 策略模式组合完成');
