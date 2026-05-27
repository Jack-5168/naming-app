# 工厂模式 (Factory Pattern)

## 核心思想

将对象创建逻辑封装，调用者只需传入参数即可获得对应对象。解决"创建什么"的问题。

## 三种变体

### 1. 简单工厂 (Simple Factory)

```javascript
// ============ 简单工厂 ============

class Pizza {
  constructor(type, size) {
    this.type = type;
    this.size = size;
  }
  describe() {
    return `${this.size}寸 ${this.type}披萨`;
  }
}

class Burger {
  constructor(type, spice) {
    this.type = type;
    this.spice = spice;
  }
  describe() {
    return `${this.spice} ${this.type}汉堡`;
  }
}

function createFood(type, options) {
  switch (type) {
    case "pizza":
      return new Pizza(options.type, options.size);
    case "burger":
      return new Burger(options.type, options.spice);
    default:
      throw new Error(`未知类型: ${type}`);
  }
}

// ============ 使用 ============
const pizza = createFood("pizza", { type: "Margherita", size: 12 });
const burger = createFood("burger", { type: "Cheese", spice: "辣" });
console.log(pizza.describe()); // 12寸 Margherita披萨
console.log(burger.describe()); // 辣 Cheese汉堡
```

### 2. 工厂方法 (Factory Method)

```javascript
// ============ 工厂方法 ============

class Notification {
  send(msg) {
    throw new Error("子类实现");
  }
}

class EmailNotification extends Notification {
  send(msg) {
    console.log(`[邮件] ${msg}`);
    return { channel: "email" };
  }
}

class SmsNotification extends Notification {
  send(msg) {
    console.log(`[短信] ${msg}`);
    return { channel: "sms" };
  }
}

class PushNotification extends Notification {
  send(msg) {
    console.log(`[推送] ${msg}`);
    return { channel: "push" };
  }
}

class NotificationFactory {
  create() {
    throw new Error("子类实现");
  }
  notify(msg) {
    return this.create().send(msg);
  }
}

class EmailFactory extends NotificationFactory {
  create() {
    return new EmailNotification();
  }
}
class SmsFactory extends NotificationFactory {
  create() {
    return new SmsNotification();
  }
}
class PushFactory extends NotificationFactory {
  create() {
    return new PushNotification();
  }
}

// ============ 使用 ============
[new EmailFactory(), new SmsFactory(), new PushFactory()].forEach((f) =>
  f.notify("订单已发货"),
);
```

### 3. 抽象工厂 (Abstract Factory)

```javascript
// ============ 抽象工厂 — UI 主题 ============

class Button {
  render() {
    throw new Error("子类实现");
  }
}
class Input {
  render() {
    throw new Error("子类实现");
  }
}

class LightButton extends Button {
  render() {
    return '<button class="btn-light">';
  }
}
class LightInput extends Input {
  render() {
    return '<input class="input-light">';
  }
}
class DarkButton extends Button {
  render() {
    return '<button class="btn-dark">';
  }
}
class DarkInput extends Input {
  render() {
    return '<input class="input-dark">';
  }
}

class UIFactory {
  createButton() {
    throw new Error("子类实现");
  }
  createInput() {
    throw new Error("子类实现");
  }
}

class LightThemeFactory extends UIFactory {
  createButton() {
    return new LightButton();
  }
  createInput() {
    return new LightInput();
  }
}

class DarkThemeFactory extends UIFactory {
  createButton() {
    return new DarkButton();
  }
  createInput() {
    return new DarkInput();
  }
}

function renderPage(factory) {
  return {
    button: factory.createButton().render(),
    input: factory.createInput().render(),
  };
}

console.log("浅色:", renderPage(new LightThemeFactory()));
console.log("深色:", renderPage(new DarkThemeFactory()));
```

## 实战：API 响应工厂

```javascript
// ============ 实战 — API 响应工厂 ============

class ApiResponse {
  constructor(statusCode, data, message) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }
  toJSON() {
    return {
      statusCode: this.statusCode,
      message: this.message,
      data: this.data,
      timestamp: this.timestamp,
    };
  }
}

const ResponseFactory = {
  success(data, msg = "操作成功") {
    return new ApiResponse(200, data, msg);
  },
  created(data, msg = "创建成功") {
    return new ApiResponse(201, data, msg);
  },
  badRequest(msg = "参数错误", errors = []) {
    return new ApiResponse(400, { errors }, msg);
  },
  unauthorized(msg = "未授权") {
    return new ApiResponse(401, null, msg);
  },
  notFound(msg = "不存在") {
    return new ApiResponse(404, null, msg);
  },
  serverError(msg = "服务器错误") {
    return new ApiResponse(500, null, msg);
  },
};

// ============ 使用 ============
console.log(ResponseFactory.success({ id: 1, name: "Alice" }).toJSON());
console.log(
  ResponseFactory.badRequest("邮箱格式错误", [
    { field: "email", message: "格式不对" },
  ]).toJSON(),
);
```

## 实战：事件处理器工厂（工厂 + 策略组合）

```javascript
// ============ 实战 — 事件处理器工厂（工厂 + 策略） ============

const eventHandlers = {
  "user:login": (p) => ({ action: "记录登录", ip: p.ip }),
  "user:logout": (p) => ({ action: "清除会话", sessionId: p.sessionId }),
  "order:created": (p) => ({ action: "扣库存+发邮件", orderId: p.orderId }),
  "order:cancelled": (p) => ({ action: "恢复库存+退款", orderId: p.orderId }),
  "payment:received": (p) => ({ action: "更新状态+发货", orderId: p.orderId }),
};

class EventHandlerFactory {
  static create(eventType) {
    return (
      eventHandlers[eventType] || ((p) => ({ action: "未知事件", eventType }))
    );
  }
}

class EventBus {
  emit(eventType, payload) {
    const handler = EventHandlerFactory.create(eventType);
    const result = handler(payload);
    console.log(`[事件 ${eventType}]`, result);
    return result;
  }
}

const bus = new EventBus();
bus.emit("user:login", { userId: 1, ip: "192.168.1.1" });
bus.emit("order:created", { orderId: "ORD-001", amount: 299 });
bus.emit("payment:received", { orderId: "ORD-001", method: "alipay" });
bus.emit("unknown:event", { foo: "bar" }); // 走默认
```

## 要点总结

1. **简单工厂**: 一个函数根据参数创建对象
2. **工厂方法**: 子类决定创建什么（继承）
3. **抽象工厂**: 创建一组相关产品（主题/平台切换）
4. **工厂 + 策略**: 工厂决定"创建哪个"，策略决定"怎么执行"
5. JS 原生体现: `Array.from()`, `Object.create()`, `new Date()`
