# 适配器模式 (Adapter Pattern)

## 核心思想
将一个类的接口转换成客户端期望的另一个接口，使原本因接口不兼容而无法一起工作的类可以协同工作。

## 适用场景
- 第三方 SDK 封装（不同支付/地图/短信 API 统一接口）
- 旧系统迁移（新旧 API 过渡期）
- 多数据源统一（REST/GraphQL/gRPC 统一调用）
- 浏览器 API 兼容（fetch 适配旧版 XMLHttpRequest）

## JS 原生体现
- `Array.prototype.map` → 将数组适配为映射后的新数组
- `JSON.stringify` → 将对象适配为字符串
- `Promise.then` → 将回调适配为链式调用

## 与装饰器的区别
| 维度 | 适配器 | 装饰器 |
|------|--------|--------|
| 目的 | 接口转换 | 功能增强 |
| 接口 | 改变接口 | 保持接口 |
| 关系 | "翻译官" | "化妆师" |

---

## 实现一：第三方支付 SDK 适配

```javascript
// ============ 场景：统一不同支付平台的接口 ============

// --- 支付宝 SDK（原始接口）---
class AlipaySDK {
  constructor(appId, privateKey) {
    this.appId = appId;
    this.privateKey = privateKey;
  }

  // 支付宝的支付方法名和参数格式
  tradePay(bizContent) {
    console.log(`[AlipaySDK] tradePay, appId=${this.appId}, bizContent=${JSON.stringify(bizContent)}`);
    return {
      success: true,
      tradeNo: `ALI${Date.now()}`,
      payUrl: `https://openapi.alipay.com/gateway.do?out_trade_no=${bizContent.out_trade_no}`
    };
  }

  // 支付宝的退款方法
  tradeRefund(bizContent) {
    console.log(`[AlipaySDK] tradeRefund, ${JSON.stringify(bizContent)}`);
    return { success: true, refundFee: bizContent.refund_fee };
  }
}

// --- 微信支付 SDK（原始接口）---
class WechatPaySDK {
  constructor(mchId, apiKey) {
    this.mchId = mchId;
    this.apiKey = apiKey;
  }

  // 微信的支付方法名和参数完全不同
  unifiedOrder(params) {
    console.log(`[WechatPaySDK] unifiedOrder, mchId=${this.mchId}, params=${JSON.stringify(params)}`);
    return {
      success: true,
      prepayId: `WX${Date.now()}`,
      payUrl: `weixin://wxpay/bizpayurl?sr=${Date.now()}`
    };
  }

  // 微信的退款方法
  refund(params) {
    console.log(`[WechatPaySDK] refund, ${JSON.stringify(params)}`);
    return { success: true, refundFee: params.total_fee };
  }
}

// --- 银联 SDK（原始接口）---
class UnionPaySDK {
  constructor(merId, certPath) {
    this.merId = merId;
    this.certPath = certPath;
  }

  // 银联又是另一套接口
  doOrder(orderInfo) {
    console.log(`[UnionPaySDK] doOrder, merId=${this.merId}, orderInfo=${JSON.stringify(orderInfo)}`);
    return {
      success: true,
      orderId: `UP${Date.now()}`,
      payUrl: `https://gateway.95516.com/gateway/api/frontTransReq.do?orderId=${Date.now()}`
    };
  }

  doRefund(orderId, amount) {
    console.log(`[UnionPaySDK] doRefund, orderId=${orderId}, amount=${amount}`);
    return { success: true, refundFee: amount };
  }
}

// ============ 适配器层：统一接口 ============

class PaymentAdapter {
  constructor(sdk) {
    this.sdk = sdk;
  }

  // 统一支付接口：所有适配器对外暴露相同的 pay 方法
  pay(amount, orderId, extra = {}) {
    throw new Error('子类必须实现 pay 方法');
  }

  // 统一退款接口
  refund(orderId, amount) {
    throw new Error('子类必须实现 refund 方法');
  }

  getPayUrl() {
    throw new Error('子类必须实现 getPayUrl 方法');
  }
}

// --- 支付宝适配器 ---
class AlipayAdapter extends PaymentAdapter {
  constructor(appId, privateKey) {
    super(new AlipaySDK(appId, privateKey));
  }

  pay(amount, orderId, extra = {}) {
    const bizContent = {
      out_trade_no: orderId,
      total_amount: amount,
      subject: extra.subject || '商品购买',
      body: extra.body || ''
    };
    const result = this.sdk.tradePay(bizContent);
    return {
      success: result.success,
      transactionId: result.tradeNo,
      payUrl: result.payUrl,
      channel: 'alipay'
    };
  }

  refund(orderId, amount) {
    const result = this.sdk.tradeRefund({
      out_trade_no: orderId,
      refund_fee: amount.toString()
    });
    return { success: result.success, refundAmount: result.refundFee, channel: 'alipay' };
  }

  getPayUrl(result) { return result.payUrl; }
}

// --- 微信适配器 ---
class WechatPayAdapter extends PaymentAdapter {
  constructor(mchId, apiKey) {
    super(new WechatPaySDK(mchId, apiKey));
  }

  pay(amount, orderId, extra = {}) {
    const params = {
      body: extra.subject || '商品购买',
      out_trade_no: orderId,
      total_fee: Math.round(amount * 100), // 微信用分
      spbill_create_ip: extra.ip || '127.0.0.1',
      notify_url: extra.notifyUrl || 'https://example.com/notify',
      trade_type: 'JSAPI'
    };
    const result = this.sdk.unifiedOrder(params);
    return {
      success: result.success,
      transactionId: result.prepayId,
      payUrl: result.payUrl,
      channel: 'wechat'
    };
  }

  refund(orderId, amount) {
    const result = this.sdk.refund({
      out_trade_no: orderId,
      total_fee: Math.round(amount * 100),
      refund_fee: Math.round(amount * 100)
    });
    return { success: result.success, refundAmount: result.refundFee / 100, channel: 'wechat' };
  }

  getPayUrl(result) { return result.payUrl; }
}

// --- 银联适配器 ---
class UnionPayAdapter extends PaymentAdapter {
  constructor(merId, certPath) {
    super(new UnionPaySDK(merId, certPath));
  }

  pay(amount, orderId, extra = {}) {
    const orderInfo = {
      orderId: orderId,
      txnAmt: amount.toString(),
      currencyCode: '156',
      txnTime: new Date().toISOString().replace(/[-:]/g, '').split('.')[0],
      orderDesc: extra.subject || '商品购买'
    };
    const result = this.sdk.doOrder(orderInfo);
    return {
      success: result.success,
      transactionId: result.orderId,
      payUrl: result.payUrl,
      channel: 'unionpay'
    };
  }

  refund(orderId, amount) {
    const result = this.sdk.doRefund(orderId, amount.toString());
    return { success: result.success, refundAmount: result.refundFee, channel: 'unionpay' };
  }

  getPayUrl(result) { return result.payUrl; }
}

// ============ 使用：业务层只依赖统一接口 ============

class CheckoutService {
  constructor(paymentAdapter) {
    this.payment = paymentAdapter;
  }

  async checkout(orderId, amount, extra = {}) {
    console.log(`\n=== 结算订单 ${orderId}, 金额 ¥${amount} ===`);
    const result = this.payment.pay(amount, orderId, extra);
    if (result.success) {
      console.log(`✅ 支付成功, 渠道: ${result.channel}, 交易号: ${result.transactionId}`);
      console.log(`   支付链接: ${result.payUrl}`);
    }
    return result;
  }

  async refund(orderId, amount) {
    console.log(`\n=== 退款订单 ${orderId}, 金额 ¥${amount} ===`);
    const result = this.payment.refund(orderId, amount);
    if (result.success) {
      console.log(`✅ 退款成功, 渠道: ${result.channel}, 金额: ¥${result.refundAmount}`);
    }
    return result;
  }
}

// 测试三种支付方式
const checkout = new CheckoutService(new AlipayAdapter('app123', 'privateKey456'));
checkout.checkout('ORD-001', 99.90, { subject: '机械键盘' });

const checkout2 = new CheckoutService(new WechatPayAdapter('mch789', 'apiKey000'));
checkout2.checkout('ORD-002', 199.00, { subject: '显示器' });

const checkout3 = new CheckoutService(new UnionPayAdapter('mer001', '/cert/union.pem'));
checkout3.checkout('ORD-003', 599.00, { subject: '笔记本' });

// 退款也统一
checkout.refund('ORD-001', 99.90);
```

## 实现二：数据源适配器（REST → GraphQL 统一）

```javascript
// ============ 场景：统一 REST API 和 GraphQL 的数据获取 ============

// --- REST 数据源 ---
class RestDataSource {
  constructor(baseURL) { this.baseURL = baseURL; }

  async fetchUsers() {
    console.log(`[REST] GET ${this.baseURL}/users`);
    return [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' }
    ];
  }

  async fetchUserById(id) {
    console.log(`[REST] GET ${this.baseURL}/users/${id}`);
    return { id, name: 'Alice', email: 'alice@example.com', role: 'admin' };
  }

  async fetchPosts(userId) {
    console.log(`[REST] GET ${this.baseURL}/users/${userId}/posts`);
    return [{ id: 101, title: 'Hello World', userId }];
  }
}

// --- GraphQL 数据源 ---
class GraphQLDataSource {
  constructor(endpoint) { this.endpoint = endpoint; }

  async query(queryString, variables = {}) {
    console.log(`[GraphQL] POST ${this.endpoint}, query: ${queryString.substring(0, 50)}...`);
    // 模拟 GraphQL 响应
    if (queryString.includes('users')) {
      return { data: { users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] } };
    }
    if (queryString.includes('user')) {
      return { data: { user: { id: variables.id, name: 'Alice', email: 'alice@example.com' } } };
    }
    if (queryString.includes('posts')) {
      return { data: { posts: [{ id: 101, title: 'Hello World' }] } };
    }
    return { data: {} };
  }
}

// ============ 适配器层 ============

class DataAdapter {
  async getUsers() { throw new Error('子类实现'); }
  async getUser(id) { throw new Error('子类实现'); }
  async getPosts(userId) { throw new Error('子类实现'); }
}

class RestDataAdapter extends DataAdapter {
  constructor(baseURL) {
    super();
    this.source = new RestDataSource(baseURL);
  }

  async getUsers() { return this.source.fetchUsers(); }
  async getUser(id) { return this.source.fetchUserById(id); }
  async getPosts(userId) { return this.source.fetchPosts(userId); }
}

class GraphQLDataAdapter extends DataAdapter {
  constructor(endpoint) {
    super();
    this.source = new GraphQLDataSource(endpoint);
  }

  async getUsers() {
    const res = await this.source.query('{ users { id name email } }');
    return res.data.users;
  }

  async getUser(id) {
    const res = await this.source.query('{ user(id: $id) { id name email role } }', { id });
    return res.data.user;
  }

  async getPosts(userId) {
    const res = await this.source.query(`{ posts(userId: ${userId}) { id title body } }`);
    return res.data.posts;
  }
}

// ============ 使用：业务层不关心底层数据源 ============

class UserService {
  constructor(adapter) { this.adapter = adapter; }

  async listUsers() { return this.adapter.getUsers(); }
  async findUser(id) { return this.adapter.getUser(id); }
  async userPosts(userId) { return this.adapter.getPosts(userId); }
}

// 切换数据源只需换适配器
const restService = new UserService(new RestDataAdapter('https://api.example.com'));
restService.listUsers();

const graphqlService = new UserService(new GraphQLDataAdapter('https://graphql.example.com'));
graphqlService.listUsers();
```

## 实现三：对象适配器（组合方式，无需继承）

```javascript
// ============ 对象适配器 — 组合方式 ============

// 旧版日志接口
class OldLogger {
  log(level, message) {
    const timestamps = { info: new Date().toISOString(), error: new Date().toISOString() };
    console.log(`[${level.toUpperCase()}] ${message} [${timestamps[level]}]`);
  }
}

// 新版期望的日志接口
class NewLogger {
  info(message) { throw new Error('子类实现'); }
  error(message) { throw new Error('子类实现'); }
  warn(message) { throw new Error('子类实现'); }
}

// 适配器：将旧版 log(level, msg) 适配为新版 info/error/warn
class LoggerAdapter extends NewLogger {
  constructor(oldLogger) {
    super();
    this.oldLogger = oldLogger;
  }

  info(message) { this.oldLogger.log('info', message); }
  error(message) { this.oldLogger.log('error', message); }
  warn(message) { this.oldLogger.log('warn', message); }
}

// ============ 使用 ============
const adapter = new LoggerAdapter(new OldLogger());
adapter.info('应用启动');
adapter.warn('内存使用率 80%');
adapter.error('数据库连接失败');
```

## 要点总结
1. **接口转换**是适配器的核心 — 不改变原有类，通过中间层转换接口
2. **对象适配器 vs 类适配器**: JS 中多用对象适配器（组合），因为 JS 单继承
3. **常见场景**: 第三方 SDK 封装、新旧 API 过渡、多数据源统一
4. **与装饰器的区别**: 适配器改变接口（翻译），装饰器保持接口（增强）
5. **JS 原生体现**: `Promise.then` 将回调适配为链式调用，`Array.from` 将类数组适配为数组
