# 观察者模式 (Observer Pattern)

## 核心思想
定义对象间的一对多依赖关系。当一个对象（Subject）的状态发生变化时，所有依赖它的对象（Observer）都会收到通知并自动更新。

## 适用场景
- 事件系统 / 发布-订阅
- 数据绑定（如 Vue 的响应式系统）
- 消息推送、状态同步

## 实现代码

```javascript
// ============ 观察者模式 ============

class Subject {
  constructor() {
    this.observers = [];
  }

  // 添加观察者
  subscribe(observer) {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
      console.log(`[Subject] 新观察者已加入: ${observer.name}`);
    }
  }

  // 移除观察者
  unsubscribe(observer) {
    this.observers = this.observers.filter(o => o !== observer);
    console.log(`[Subject] 观察者已退出: ${observer.name}`);
  }

  // 通知所有观察者
  notify(data) {
    console.log(`[Subject] 广播通知, 数据:`, data);
    this.observers.forEach(observer => observer.update(data));
  }
}

class Observer {
  constructor(name, handler) {
    this.name = name;
    this.handler = handler;
  }

  update(data) {
    console.log(`[Observer ${this.name}] 收到通知`);
    this.handler(data);
  }
}

// ============ 使用示例 ============

// 创建一个消息中心（Subject）
const messageCenter = new Subject();

// 创建观察者
const logger = new Observer('Logger', (data) => {
  console.log(`  → 日志记录: ${data.message}`);
});

const analytics = new Observer('Analytics', (data) => {
  console.log(`  → 数据统计: 类型=${data.type}, 时间=${Date.now()}`);
});

const pushNotif = new Observer('PushNotification', (data) => {
  console.log(`  → 推送通知: ${data.message}`);
});

// 注册观察者
messageCenter.subscribe(logger);
messageCenter.subscribe(analytics);
messageCenter.subscribe(pushNotif);

// 发送消息，所有观察者都会收到通知
console.log('\n--- 发送一条消息 ---');
messageCenter.notify({ type: 'user_login', message: '用户 admin 登录成功' });

console.log('\n--- 移除 Logger 后发送 ---');
messageCenter.unsubscribe(logger);
messageCenter.notify({ type: 'order_create', message: '新订单 #1234' });
```

## 输出示例
```
[Subject] 新观察者已加入: Logger
[Subject] 新观察者已加入: Analytics
[Subject] 新观察者已加入: PushNotification

--- 发送一条消息 ---
[Subject] 广播通知, 数据: { type: 'user_login', message: '用户 admin 登录成功' }
[Observer Logger] 收到通知
  → 日志记录: 用户 admin 登录成功
[Observer Analytics] 收到通知
  → 数据统计: 类型=user_login, 时间=1714089600000
[Observer PushNotification] 收到通知
  → 推送通知: 用户 admin 登录成功

--- 移除 Logger 后发送 ---
[Subject] 观察者已退出: Logger
[Subject] 广播通知, 数据: { type: 'order_create', message: '新订单 #1234' }
[Observer Analytics] 收到通知
  → 数据统计: 类型=order_create, 时间=1714089600001
[Observer PushNotification] 收到通知
  → 推送通知: 新订单 #1234
```

## 要点总结
1. **松耦合**: Subject 不需要知道 Observer 的具体实现，只依赖接口
2. **动态管理**: 可以随时添加/移除观察者
3. **一对多**: 一个状态变化触发多个响应
4. **JavaScript 原生体现**: DOM 事件系统 `element.addEventListener()` 就是观察者模式
