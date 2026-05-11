/**
 * 专项训练 02:00 - JavaScript 设计模式
 * 日期: 2026-04-28
 * 模式: 单例模式 (Singleton) + 观察者模式 (Observer)
 */

// ============================================================
// 模式一：单例模式 (Singleton Pattern)
// ============================================================
// 核心思想：确保一个类只有一个实例，并提供全局访问点。
// 适用场景：数据库连接池、全局配置管理器、日志记录器、缓存等。

// --- 实现 1：ES6 Class + 静态属性（推荐，现代写法） ---
class DatabaseConnection {
  constructor(url) {
    if (DatabaseConnection._instance) {
      return DatabaseConnection._instance;
    }
    this.url = url;
    this.pool = [];
    this.connectCount = 0;
    DatabaseConnection._instance = this;
    console.log(`[Singleton] 数据库连接已创建: ${url}`);
  }

  static getInstance(url) {
    if (!DatabaseConnection._instance) {
      DatabaseConnection._instance = new DatabaseConnection(url);
    }
    return DatabaseConnection._instance;
  }

  query(sql) {
    this.connectCount++;
    return `执行查询 [第${this.connectCount}次]: ${sql}`;
  }
}

// 测试单例
const db1 = DatabaseConnection.getInstance('mongodb://localhost:27017');
const db2 = DatabaseConnection.getInstance('mongodb://localhost:27017');
console.log(db1 === db2); // true — 同一个实例
console.log(db1.query('SELECT * FROM users'));
console.log(db2.query('SELECT * FROM posts'));

// --- 实现 2：模块模式（IIFE + 闭包） ---
const ConfigManager = (function () {
  let instance = null;

  function createInstance() {
    const config = {
      appName: 'MyApp',
      version: '1.0.0',
      debug: false,
      maxRetries: 3,
    };
    return {
      get(key) {
        return config[key] ?? '未知配置项';
      },
      set(key, value) {
        config[key] = value;
      },
      getAll() {
        return { ...config };
      },
    };
  }

  return {
    getInstance() {
      if (!instance) {
        instance = createInstance();
      }
      return instance;
    },
  };
})();

const cfg1 = ConfigManager.getInstance();
const cfg2 = ConfigManager.getInstance();
console.log(cfg1 === cfg2); // true
cfg1.set('debug', true);
console.log(cfg2.get('debug')); // true — 共享同一份配置


// ============================================================
// 模式二：观察者模式 (Observer Pattern)
// ============================================================
// 核心思想：定义对象间一对多的依赖关系，当一个对象状态改变时，
//          所有依赖它的对象都会收到通知并自动更新。
// 适用场景：事件系统、消息订阅、状态管理（Redux/Vuex 底层）、DOM 事件。

class EventEmitter {
  constructor() {
    this._listeners = new Map(); // event → Set<callback>
    this._onceListeners = new Map();
  }

  // 订阅事件（持续监听）
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return this; // 链式调用
  }

  // 订阅事件（只触发一次）
  once(event, callback) {
    if (!this._onceListeners.has(event)) {
      this._onceListeners.set(event, new Set());
    }
    this._onceListeners.get(event).add(callback);
    return this;
  }

  // 取消订阅
  off(event, callback) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(callback);
    }
    if (this._onceListeners.has(event)) {
      this._onceListeners.get(event).delete(callback);
    }
    return this;
  }

  // 发布事件
  emit(event, ...args) {
    // 触发普通监听器
    const callbacks = this._listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(...args));
    }
    // 触发一次性监听器（执行后清除）
    const onceCallbacks = this._onceListeners.get(event);
    if (onceCallbacks) {
      onceCallbacks.forEach((cb) => cb(...args));
      onceCallbacks.clear();
    }
    return this;
  }

  // 监听数量
  listenerCount(event) {
    const normal = this._listeners.get(event)?.size ?? 0;
    const once = this._onceListeners.get(event)?.size ?? 0;
    return normal + once;
  }
}

// --- 实际场景：电商购物车 ---
const cart = new EventEmitter();

// 观察者 1：库存模块
cart.on('item:add', (item) => {
  console.log(`[库存] 检查 "${item.name}" 库存... 充足 ✅`);
});

// 观察者 2：价格计算模块
cart.on('item:add', (item) => {
  console.log(`[价格] "${item.name}" 加入，单价 ¥${item.price}`);
});

// 观察者 3：通知模块（只触发一次）
cart.once('item:add', () => {
  console.log('[通知] 🎉 欢迎来到购物车！首次添加商品有优惠');
});

// 观察者 4：物流模块
cart.on('cart:checkout', (total) => {
  console.log(`[物流] 订单总额 ¥${total}，计算运费...`);
});

// 模拟用户操作
console.log('\n--- 用户添加商品 ---');
cart.emit('item:add', { name: '机械键盘', price: 299 });
cart.emit('item:add', { name: '无线鼠标', price: 129 });

console.log('\n--- 用户结账 ---');
cart.emit('cart:checkout', 428);

console.log(`\n当前 item:add 监听器数量: ${cart.listenerCount('item:add')}`);


// ============================================================
// 模式组合：单例 + 观察者 = 全局事件总线
// ============================================================
class EventBus {
  constructor() {
    if (EventBus._instance) return EventBus._instance;
    this._emitter = new EventEmitter();
    EventBus._instance = this;
  }

  static getInstance() {
    if (!EventBus._instance) {
      EventBus._instance = new EventBus();
    }
    return EventBus._instance;
  }

  on(event, cb) { return this._emitter.on(event, cb); }
  off(event, cb) { return this._emitter.off(event, cb); }
  emit(event, ...args) { return this._emitter.emit(event, ...args); }
}

const bus = EventBus.getInstance();
bus.on('user:login', (user) => console.log(`[总线] 用户 ${user.name} 登录成功`));
bus.emit('user:login', { name: 'Alice', role: 'admin' });
