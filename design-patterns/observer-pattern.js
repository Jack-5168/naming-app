/**
 * 观察者模式 (Observer Pattern)
 * 
 * 核心思想：定义对象间的一对多依赖关系，当一个对象状态改变时，
 * 所有依赖它的对象都会收到通知并自动更新。
 * 
 * 应用场景：
 * - 事件系统（DOM 事件、Node.js EventEmitter）
 * - 发布/订阅消息系统
 * - Vue/React 的响应式数据绑定
 * - 消息队列、WebSocket 广播
 */

// ============ 基础实现 ============

class Observer {
  constructor() {
    this.subscribers = new Set(); // 用 Set 去重，避免重复订阅
  }

  // 订阅：添加观察者
  subscribe(fn) {
    this.subscribers.add(fn);
    // 返回取消订阅函数，方便调用方清理
    return () => this.subscribers.delete(fn);
  }

  // 发布：通知所有观察者
  publish(data) {
    this.subscribers.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error('观察者回调执行出错:', err);
      }
    });
  }

  // 获取订阅者数量
  get subscriberCount() {
    return this.subscribers.size;
  }
}

// ============ 使用示例 ============

// 示例 1：简单的消息通知系统
const eventBus = new Observer();

const unsub1 = eventBus.subscribe((data) => {
  console.log(`[日志] 收到消息: ${data.message}`);
});

const unsub2 = eventBus.subscribe((data) => {
  if (data.type === 'alert') {
    console.log(`[告警] 严重: ${data.message}`);
  }
});

eventBus.publish({ type: 'alert', message: '服务器 CPU 使用率超过 90%' });
// [日志] 收到消息: 服务器 CPU 使用率超过 90%
// [告警] 严重: 服务器 CPU 使用率超过 90%

// 取消订阅
unsub1();
eventBus.publish({ type: 'info', message: '定时任务完成' });
// 只有告警观察者会收到（日志观察者已取消）

// ============ 进阶：支持多事件类型 ============

class EventBus {
  constructor() {
    this.subscribers = new Map(); // key: 事件名, value: Set<回调>
  }

  on(event, fn) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this.subscribers.get(event)?.delete(fn);
  }

  emit(event, data) {
    this.subscribers.get(event)?.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error(`事件 "${event}" 回调出错:`, err);
      }
    });
  }

  once(event, fn) {
    const wrapper = (...args) => {
      fn(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }
}

// 使用示例
const bus = new EventBus();

bus.on('user:login', (user) => console.log(`${user.name} 登录了`));
bus.on('user:logout', (user) => console.log(`${user.name} 退出了`));
bus.once('app:init', () => console.log('应用初始化（只触发一次）'));

bus.emit('user:login', { name: 'Alice' });
bus.emit('app:init');
bus.emit('app:init'); // 不会再触发
bus.emit('user:logout', { name: 'Alice' });
