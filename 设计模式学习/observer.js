/**
 * 观察者模式 (Observer Pattern) 完整实现
 * 
 * 定义一对多的依赖关系，当主题状态变化时通知所有观察者
 */

// ============================================
// 1. 基础观察者模式
// ============================================
class Subject {
  constructor() {
    this.observers = [];
  }
  
  subscribe(observer) {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
      console.log(`[Subject] Observer subscribed (${this.observers.length} total)`);
    }
    return () => this.unsubscribe(observer);
  }
  
  unsubscribe(observer) {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
      console.log(`[Subject] Observer unsubscribed (${this.observers.length} remaining)`);
    }
  }
  
  notify(data) {
    console.log(`[Subject] Notifying ${this.observers.length} observers...`);
    this.observers.forEach((observer, index) => {
      console.log(`  -> Observer ${index + 1}`);
      observer.update(data);
    });
  }
  
  getObserverCount() {
    return this.observers.length;
  }
  
  clearObservers() {
    this.observers = [];
    console.log('[Subject] All observers cleared');
  }
}

class Observer {
  constructor(name) {
    this.name = name;
    this.receivedData = [];
  }
  
  update(data) {
    this.receivedData.push(data);
    console.log(`    [${this.name}] Received: ${data}`);
  }
  
  getReceivedCount() {
    return this.receivedData.length;
  }
  
  getLastData() {
    return this.receivedData[this.receivedData.length - 1];
  }
}

// ============================================
// 2. 事件总线 (Event Bus)
// ============================================
class EventBus {
  constructor() {
    this.events = {};
  }
  
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    console.log(`[EventBus] Listener added for "${event}"`);
    return () => this.off(event, callback);
  }
  
  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
    if (this.events[event].length === 0) {
      delete this.events[event];
      console.log(`[EventBus] Event "${event}" removed`);
    }
  }
  
  emit(event, data) {
    if (!this.events[event]) {
      console.log(`[EventBus] No listeners for "${event}"`);
      return;
    }
    console.log(`[EventBus] Emitting "${event}" to ${this.events[event].length} listeners`);
    this.events[event].forEach(callback => callback(data));
  }
  
  once(event, callback) {
    const wrapper = (data) => {
      callback(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }
  
  getEventNames() {
    return Object.keys(this.events);
  }
  
  getListenerCount(event) {
    return this.events[event]?.length || 0;
  }
  
  clearAll() {
    this.events = {};
    console.log('[EventBus] All events cleared');
  }
}

// ============================================
// 3. 带优先级的观察者
// ============================================
class PrioritySubject {
  constructor() {
    this.observers = [];
  }
  
  subscribe(observer, priority = 0) {
    const entry = { observer, priority };
    this.observers.push(entry);
    this.observers.sort((a, b) => b.priority - a.priority);
    console.log(`[PrioritySubject] Observer subscribed with priority ${priority}`);
    return () => this.unsubscribe(observer);
  }
  
  unsubscribe(observer) {
    this.observers = this.observers.filter(entry => entry.observer !== observer);
    console.log('[PrioritySubject] Observer unsubscribed');
  }
  
  notify(data) {
    console.log(`\n[PrioritySubject] Notifying ${this.observers.length} observers by priority...`);
    this.observers.forEach(({ observer, priority }) => {
      console.log(`  [Priority ${priority}]`);
      observer.update(data);
    });
  }
  
  getObserverCount() {
    return this.observers.length;
  }
}

class PriorityObserver {
  constructor(name) {
    this.name = name;
  }
  
  update(data) {
    console.log(`    [${this.name}] Processed: ${data}`);
  }
}

// ============================================
// 4. 异步观察者
// ============================================
class AsyncSubject {
  constructor() {
    this.observers = [];
  }
  
  subscribe(observer) {
    this.observers.push(observer);
    console.log(`[AsyncSubject] Observer subscribed (${this.observers.length} total)`);
    return () => this.unsubscribe(observer);
  }
  
  unsubscribe(observer) {
    this.observers = this.observers.filter(obs => obs !== observer);
  }
  
  async notify(data) {
    console.log(`[AsyncSubject] Notifying ${this.observers.length} observers asynchronously...`);
    const startTime = Date.now();
    
    const results = await Promise.all(
      this.observers.map(async (observer, index) => {
        try {
          const result = await observer.update(data);
          console.log(`  [Observer ${index + 1}] Completed`);
          return { success: true, result };
        } catch (error) {
          console.error(`  [Observer ${index + 1}] Error:`, error.message);
          return { success: false, error: error.message };
        }
      })
    );
    
    const duration = Date.now() - startTime;
    console.log(`[AsyncSubject] All notifications completed in ${duration}ms`);
    return results;
  }
}

class AsyncObserver {
  constructor(name, delay = 0) {
    this.name = name;
    this.delay = delay;
  }
  
  async update(data) {
    await new Promise(resolve => setTimeout(resolve, this.delay));
    console.log(`  [${this.name}] Processed after ${this.delay}ms`);
    return { 
      observer: this.name, 
      data, 
      timestamp: Date.now(),
      delay: this.delay
    };
  }
}

// ============================================
// 5. 新闻发布系统
// ============================================
class NewsAgency {
  constructor() {
    this.channels = {};
    this.news = [];
  }
  
  registerChannel(channelName, observer) {
    if (!this.channels[channelName]) {
      this.channels[channelName] = [];
    }
    this.channels[channelName].push(observer);
    console.log(`[NewsAgency] ${observer.name} subscribed to ${channelName}`);
    return () => this.unregisterChannel(channelName, observer);
  }
  
  unregisterChannel(channelName, observer) {
    if (this.channels[channelName]) {
      this.channels[channelName] = this.channels[channelName].filter(
        obs => obs !== observer
      );
      console.log(`[NewsAgency] ${observer.name} unsubscribed from ${channelName}`);
    }
  }
  
  publishNews(category, headline, content) {
    const news = {
      id: Date.now(),
      category,
      headline,
      content,
      timestamp: new Date().toISOString()
    };
    
    this.news.push(news);
    console.log(`\n📰 BREAKING: ${headline}`);
    
    let notifiedCount = 0;
    
    // 通知订阅该类别的观察者
    if (this.channels[category]) {
      this.channels[category].forEach(observer => {
        observer.receiveNews(news);
        notifiedCount++;
      });
    }
    
    // 也通知订阅"all"的观察者
    if (this.channels['all']) {
      this.channels['all'].forEach(observer => {
        if (!this.channels[category]?.includes(observer)) {
          observer.receiveNews(news);
          notifiedCount++;
        }
      });
    }
    
    console.log(`[NewsAgency] Notified ${notifiedCount} channels`);
    return news;
  }
  
  getNewsHistory(limit = 10) {
    return this.news.slice(-limit);
  }
}

class NewsChannel {
  constructor(name, platform) {
    this.name = name;
    this.platform = platform;
    this.receivedNews = [];
  }
  
  receiveNews(news) {
    this.receivedNews.push(news);
    console.log(`  [${this.platform}] ${this.name}: "${news.headline}"`);
  }
  
  getNewsCount() {
    return this.receivedNews.length;
  }
}

// ============================================
// 6. 响应式数据绑定
// ============================================
class ReactiveData {
  constructor(initialData = {}) {
    this.data = initialData;
    this.observers = {};
    
    Object.keys(initialData).forEach(key => {
      this.observers[key] = [];
    });
  }
  
  subscribe(key, callback) {
    if (!this.observers[key]) {
      this.observers[key] = [];
    }
    this.observers[key].push(callback);
    console.log(`[ReactiveData] Subscribed to "${key}"`);
    return () => this.unsubscribe(key, callback);
  }
  
  unsubscribe(key, callback) {
    if (this.observers[key]) {
      this.observers[key] = this.observers[key].filter(cb => cb !== callback);
    }
  }
  
  get(key) {
    return this.data[key];
  }
  
  set(key, value) {
    const oldValue = this.data[key];
    this.data[key] = value;
    
    if (this.observers[key]) {
      console.log(`[ReactiveData] "${key}" changed: ${oldValue} → ${value}`);
      this.observers[key].forEach(callback => {
        callback(value, oldValue, key);
      });
    }
  }
  
  getAll() {
    return { ...this.data };
  }
}

// ============================================
// 测试代码
// ============================================
function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('观察者模式测试');
  console.log('='.repeat(60));
  
  // 测试 1: 基础观察者
  console.log('\n[测试 1] 基础观察者模式');
  const subject = new Subject();
  const obs1 = new Observer('Observer-1');
  const obs2 = new Observer('Observer-2');
  const obs3 = new Observer('Observer-3');
  
  subject.subscribe(obs1);
  subject.subscribe(obs2);
  subject.subscribe(obs3);
  
  subject.notify('Hello Observers!');
  console.log(`Observer-1 received ${obs1.getReceivedCount()} messages`);
  
  const unsubscribe = subject.subscribe(new Observer('Temporary'));
  subject.notify('Temporary active');
  unsubscribe();
  subject.notify('Temporary gone');
  
  // 测试 2: 事件总线
  console.log('\n[测试 2] 事件总线');
  const bus = new EventBus();
  
  bus.on('user:login', (user) => {
    console.log(`  Welcome, ${user.name}!`);
  });
  
  bus.on('user:logout', (user) => {
    console.log(`  Goodbye, ${user.name}!`);
  });
  
  bus.once('notification', (msg) => {
    console.log(`  One-time: ${msg}`);
  });
  
  bus.emit('user:login', { name: 'Alice' });
  bus.emit('notification', 'First');
  bus.emit('notification', 'Second'); // 不会触发
  
  // 测试 3: 优先级观察者
  console.log('\n[测试 3] 优先级观察者');
  const prioritySubject = new PrioritySubject();
  const high = new PriorityObserver('High');
  const medium = new PriorityObserver('Medium');
  const low = new PriorityObserver('Low');
  
  prioritySubject.subscribe(low, 1);
  prioritySubject.subscribe(high, 10);
  prioritySubject.subscribe(medium, 5);
  
  prioritySubject.notify('Priority test');
  
  // 测试 4: 异步观察者
  console.log('\n[测试 4] 异步观察者');
  const asyncSubject = new AsyncSubject();
  asyncSubject.subscribe(new AsyncObserver('Fast', 50));
  asyncSubject.subscribe(new AsyncObserver('Medium', 100));
  asyncSubject.subscribe(new AsyncObserver('Slow', 150));
  
  asyncSubject.notify('Async data').then(results => {
    console.log('Async results:', results.length);
  });
  
  // 测试 5: 新闻系统
  console.log('\n[测试 5] 新闻发布系统');
  const agency = new NewsAgency();
  
  const tv = new NewsChannel('CCTV', 'TV');
  const web = new NewsChannel('Sina', 'Web');
  const app = new NewsChannel('Toutiao', 'Mobile');
  
  agency.registerChannel('politics', tv);
  agency.registerChannel('politics', web);
  agency.registerChannel('technology', app);
  
  agency.publishNews('politics', 'New Policy', 'Government announces...');
  agency.publishNews('technology', 'AI Breakthrough', 'Scientists achieve...');
  
  console.log(`\nTV received ${tv.getNewsCount()} news`);
  console.log(`Web received ${web.getNewsCount()} news`);
  console.log(`App received ${app.getNewsCount()} news`);
  
  // 测试 6: 响应式数据
  console.log('\n[测试 6] 响应式数据绑定');
  const state = new ReactiveData({
    count: 0,
    user: 'Guest',
    theme: 'light'
  });
  
  state.subscribe('count', (newVal) => {
    console.log(`  UI: Count = ${newVal}`);
  });
  
  state.subscribe('user', (newVal) => {
    console.log(`  UI: User = ${newVal}`);
  });
  
  state.set('count', 1);
  state.set('count', 5);
  state.set('user', 'Alice');
  
  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60) + '\n');
}

// 导出所有类
module.exports = {
  Subject,
  Observer,
  EventBus,
  PrioritySubject,
  PriorityObserver,
  AsyncSubject,
  AsyncObserver,
  NewsAgency,
  NewsChannel,
  ReactiveData,
  runTests
};

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runTests();
}
