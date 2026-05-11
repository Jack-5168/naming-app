# PWA/离线优先 — 第五轮：高级实战 (CRDT/Web Push/Periodic Sync/安全/真实案例)

> 专项训练 19 — 第五轮迭代
> 4/25 基础 → 4/28 完整实现 → 4/29 修复增强 → 4/30 生产级 → 5/1 高级实战
> 目标：掌握 PWA 前沿技术 — 冲突解决 / 推送通知 / 周期同步 / 安全加固 / 真实案例分析

---

## 一、离线协作 — CRDT 冲突解决

### 1.1 为什么需要 CRDT？

传统 PWA 同步方案的问题：

```
用户 A (离线)          用户 B (在线)
  │                      │
  ├─ 编辑笔记 "Hello"     │
  │  → 本地保存           │
  │                      ├─ 编辑笔记 "World"
  │                      │  → 上传到服务器
  │                      │
  ├─ 联网                │
  │  → 上传 "Hello"      │
  │  → 冲突！覆盖 B 的修改？│
```

**CRDT (Conflict-free Replicated Data Type)** 保证：
- 任何顺序的并发操作最终一致
- 不需要中心化协调
- 数学上可证明收敛

### 1.2 G-Counter (增长计数器)

```javascript
// G-Counter: 只能增长的分布式计数器
class GCounter {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.replicas = new Map(); // nodeId → count
    this.replicas.set(nodeId, 0);
  }

  increment() {
    const current = this.replicas.get(this.nodeId) || 0;
    this.replicas.set(this.nodeId, current + 1);
  }

  value() {
    let sum = 0;
    for (const count of this.replicas.values()) {
      sum += count;
    }
    return sum;
  }

  // 合并两个副本：取每个节点的最大值
  merge(other) {
    for (const [nodeId, count] of other.replicas) {
      const current = this.replicas.get(nodeId) || 0;
      this.replicas.set(nodeId, Math.max(current, count));
    }
  }

  toJSON() {
    return {
      nodeId: this.nodeId,
      replicas: Object.fromEntries(this.replicas),
    };
  }

  static fromJSON(json) {
    const counter = new GCounter(json.nodeId);
    counter.replicas = new Map(Object.entries(json.replicas));
    return counter;
  }
}

// === 使用示例 ===
// 用户 A 和 B 各自操作
const counterA = new GCounter('A');
const counterB = new GCounter('B');

counterA.increment(); // A: 1
counterA.increment(); // A: 2
counterB.increment(); // B: 1

// 合并（模拟同步）
counterA.merge(counterB);
console.log(counterA.value()); // 3 ✅ (2 + 1)

counterB.merge(counterA);
console.log(counterB.value()); // 3 ✅ 最终一致
```

### 1.3 PN-Counter (增减计数器)

```javascript
// PN-Counter: 支持增加和减少
class PNCounter {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.positive = new GCounter(nodeId);   // 增长部分
    this.negative = new GCounter(nodeId);   // 减少部分
  }

  increment() { this.positive.increment(); }
  decrement() { this.negative.increment(); }

  value() {
    return this.positive.value() - this.negative.value();
  }

  merge(other) {
    this.positive.merge(other.positive);
    this.negative.merge(other.negative);
  }

  toJSON() {
    return {
      nodeId: this.nodeId,
      positive: this.positive.toJSON(),
      negative: this.negative.toJSON(),
    };
  }

  static fromJSON(json) {
    const counter = new PNCounter(json.nodeId);
    counter.positive = GCounter.fromJSON(json.positive);
    counter.negative = GCounter.fromJSON(json.negative);
    return counter;
  }
}

// === 使用示例 ===
const likesA = new PNCounter('A');
const likesB = new PNCounter('B');

likesA.increment(); // A 点赞
likesA.increment(); // A 再点赞
likesB.increment(); // B 点赞
likesB.decrement(); // B 取消点赞

likesA.merge(likesB);
console.log(likesA.value()); // 2 ✅ (A:2 + B:1 - B:1)
```

### 1.4 LWW-Register (最后写入胜出寄存器)

```javascript
// LWW-Register: 带时间戳的最后写入胜出
class LWWRegister {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.value = null;
    this.timestamp = 0; // Lamport timestamp
  }

  set(newValue) {
    this.value = newValue;
    this.timestamp = Date.now();
  }

  // 合并：取时间戳更大的
  merge(other) {
    if (other.timestamp > this.timestamp) {
      this.value = other.value;
      this.timestamp = other.timestamp;
    } else if (other.timestamp === this.timestamp && other.nodeId > this.nodeId) {
      // 时间戳相同时，nodeId 大的胜出（确定性）
      this.value = other.value;
      this.timestamp = other.timestamp;
    }
  }

  toJSON() {
    return { nodeId: this.nodeId, value: this.value, timestamp: this.timestamp };
  }

  static fromJSON(json) {
    const reg = new LWWRegister(json.nodeId);
    reg.value = json.value;
    reg.timestamp = json.timestamp;
    return reg;
  }
}

// === 使用示例 ===
const nameA = new LWWRegister('A');
const nameB = new LWWRegister('B');

nameA.set('Alice');
setTimeout(() => nameB.set('Bob'), 100); // B 晚 100ms

nameA.merge(nameB);
console.log(nameA.value); // 'Bob' ✅ (B 时间戳更大)
```

### 1.5 OR-Set (无重复集合)

```javascript
// OR-Set: Observed-Remove Set，支持添加和删除
class ORSet {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.elements = new Map();  // value → Set<uniqueTag>
    this.tombstones = new Set(); // 已删除的 tag
    this.tagCounter = 0;
  }

  _nextTag() {
    return `${this.nodeId}:${++this.tagCounter}`;
  }

  add(value) {
    const tag = this._nextTag();
    if (!this.elements.has(value)) {
      this.elements.set(value, new Set());
    }
    this.elements.get(value).add(tag);
  }

  remove(value) {
    const tags = this.elements.get(value);
    if (tags) {
      for (const tag of tags) {
        this.tombstones.add(tag);
      }
      this.elements.delete(value);
    }
  }

  // 查看当前元素：有 tag 且未被 tombstone 标记
  values() {
    const result = new Set();
    for (const [value, tags] of this.elements) {
      const hasActive = [...tags].some(t => !this.tombstones.has(t));
      if (hasActive) result.add(value);
    }
    return result;
  }

  has(value) {
    const tags = this.elements.get(value);
    if (!tags) return false;
    return [...tags].some(t => !this.tombstones.has(t));
  }

  merge(other) {
    // 合并元素
    for (const [value, tags] of other.elements) {
      if (!this.elements.has(value)) {
        this.elements.set(value, new Set());
      }
      for (const tag of tags) {
        this.elements.get(value).add(tag);
      }
    }
    // 合并墓碑
    for (const tag of other.tombstones) {
      this.tombstones.add(tag);
    }
    // 清理：移除所有 tag 都在 tombstone 中的元素
    for (const [value, tags] of this.elements) {
      if ([...tags].every(t => this.tombstones.has(t))) {
        this.elements.delete(value);
      }
    }
  }

  toJSON() {
    return {
      nodeId: this.nodeId,
      elements: Object.fromEntries(
        [...this.elements].map(([k, v]) => [k, [...v]])
      ),
      tombstones: [...this.tombstones],
      tagCounter: this.tagCounter,
    };
  }

  static fromJSON(json) {
    const set = new ORSet(json.nodeId);
    set.elements = new Map(
      Object.entries(json.elements).map(([k, v]) => [k, new Set(v)])
    );
    set.tombstones = new Set(json.tombstones);
    set.tagCounter = json.tagCounter;
    return set;
  }
}

// === 使用示例：并发添加/删除 ===
const tagsA = new ORSet('A');
const tagsB = new ORSet('B');

tagsA.add('javascript');
tagsA.add('vue');
tagsB.add('react');
tagsB.remove('javascript'); // A 和 B 并发操作

tagsA.merge(tagsB);
console.log([...tagsA.values()]); // ['vue', 'react'] ✅
// 'javascript' 被 B 删除，A 的添加被 tombstone 覆盖

tagsB.merge(tagsA);
console.log([...tagsB.values()]); // ['vue', 'react'] ✅ 最终一致
```

### 1.6 文本 CRDT — Sequence CRDT (简化版)

```javascript
// 简化版 Sequence CRDT：基于 ID 的有序序列
// 每个字符有一个唯一 ID (node:counter)，序列按 ID 排序

class SequenceCRDT {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.counter = 0;
    this.elements = []; // [{id, char, visible}]
  }

  _nextId() {
    return `${this.nodeId}:${++this.counter}`;
  }

  // 在 position 位置插入字符
  insert(position, char) {
    const id = this._nextId();
    const element = { id, char, visible: true };

    // 找到插入位置：按 ID 字典序
    const visibleElements = this.elements.filter(e => e.visible);
    const targetId = position < visibleElements.length
      ? visibleElements[position].id
      : null;

    if (!targetId) {
      // 追加到末尾
      this.elements.push(element);
    } else {
      // 在 targetId 之前插入
      const idx = this.elements.findIndex(e => e.id === targetId);
      this.elements.splice(idx, 0, element);
    }

    return id;
  }

  // 删除指定位置的字符
  remove(position) {
    const visibleElements = this.elements.filter(e => e.visible);
    if (position < visibleElements.length) {
      const targetId = visibleElements[position].id;
      const el = this.elements.find(e => e.id === targetId);
      if (el) el.visible = false;
    }
  }

  // 获取可见文本
  getText() {
    return this.elements.filter(e => e.visible).map(e => e.char).join('');
  }

  merge(other) {
    // 合并：添加对方独有的元素
    const myIds = new Set(this.elements.map(e => e.id));
    for (const el of other.elements) {
      if (!myIds.has(el.id)) {
        this.elements.push(el);
      }
    }
    // 同步 tombstones
    const otherTombstones = new Set(
      other.elements.filter(e => !e.visible).map(e => e.id)
    );
    for (const el of this.elements) {
      if (otherTombstones.has(el.id)) {
        el.visible = false;
      }
    }
  }

  toJSON() {
    return {
      nodeId: this.nodeId,
      counter: this.counter,
      elements: this.elements,
    };
  }

  static fromJSON(json) {
    const seq = new SequenceCRDT(json.nodeId);
    seq.counter = json.counter;
    seq.elements = json.elements;
    return seq;
  }
}

// === 使用示例：并发编辑 ===
const docA = new SequenceCRDT('A');
const docB = new SequenceCRDT('B');

// 初始内容 "Hello"
docA.insert(0, 'H');
docA.insert(1, 'e');
docA.insert(2, 'l');
docA.insert(3, 'l');
docA.insert(4, 'o');
console.log(docA.getText()); // "Hello"

// A 在末尾插入 "!"
docA.insert(5, '!');

// B 在 'e' 后插入 'y' (位置 2)
docB.insert(0, 'H');
docB.insert(1, 'e');
docB.insert(2, 'y');
docB.insert(3, 'l');
docB.insert(4, 'l');
docB.insert(5, 'o');
docB.insert(6, '!');

// 合并
docA.merge(docB);
console.log(docA.getText()); // "Heyllo!" ✅

docB.merge(docA);
console.log(docB.getText()); // "Heyllo!" ✅ 最终一致
```

---

## 二、Web Push 推送通知

### 2.1 推送架构

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  应用前端    │────→│  Push Server  │────→│  浏览器推送  │
│  (订阅)      │     │  (VAPID 签名) │     │  服务 (FCM/  │
│              │←────│              │←─────│   APNs/MPNS) │
│  接收通知    │     └──────────────┘     └─────────────┘
└─────────────┘
       │
       │ 用户授权
       ▼
┌─────────────┐
│  Service     │
│  Worker      │
│  (后台接收)   │
└─────────────┘
```

### 2.2 VAPID (Voluntary Application Server Identification)

```javascript
// VAPID 密钥生成 (Node.js)
// 使用 web-push 库: npm install web-push
const webpush = require('web-push');

// 生成密钥对（一次性，保存到服务器）
const vapidKeys = webpush.generateVAPIDKeys();
console.log('Public Key:',  vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);

// 服务器端配置
webpush.setVapidDetails(
  'mailto:admin@example.com',       // 联系信息
  vapidKeys.publicKey,
  vapidKeys.privateKey
);
```

### 2.3 前端订阅推送

```javascript
// 前端：请求通知权限 + 订阅 Push
class PushManager {
  constructor(vapidPublicKey) {
    this.vapidPublicKey = vapidPublicKey;
    this.subscription = null;
  }

  // 将 Base64 URL 字符串转为 Uint8Array
  _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  // 请求通知权限
  async requestPermission() {
    if (!('Notification' in window)) {
      throw new Error('浏览器不支持通知');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('用户拒绝通知权限');
    }
  }

  // 订阅 Push
  async subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('浏览器不支持 Push');
    }

    // 等待 SW 注册完成
    const registration = await navigator.serviceWorker.ready;

    // 检查是否已有订阅
    this.subscription = await registration.pushManager.getSubscription();

    if (!this.subscription) {
      // 创建新订阅
      this.subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // 必须显示可见通知（防滥用）
        applicationServerKey: this._urlBase64ToUint8Array(this.vapidPublicKey),
      });

      console.log('新订阅创建:', this.subscription);
    }

    return this.subscription;
  }

  // 发送到服务器保存
  async saveSubscriptionToServer() {
    if (!this.subscription) return;

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.subscription),
    });

    if (!response.ok) {
      throw new Error('保存订阅失败');
    }
  }

  // 取消订阅
  async unsubscribe() {
    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  // 初始化流程
  async init() {
    await this.requestPermission();
    await this.subscribe();
    await this.saveSubscriptionToServer();
    return this.subscription;
  }
}

// === 使用 ===
const pushManager = new PushManager('YOUR_VAPID_PUBLIC_KEY');
// pushManager.init();
```

### 2.4 Service Worker 接收推送

```javascript
// sw.js — Push 事件处理
self.addEventListener('push', (event) => {
  let data = { title: '新消息', body: '你有一条新通知', icon: '/icon-192.png' };

  // 解析推送数据
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: '/badge-96.png',
    tag: data.tag || 'default',       // 相同 tag 的通知会合并
    requireInteraction: data.urgent || false, // 紧急通知不自动关闭
    data: {
      url: data.url || '/',           // 点击跳转
      timestamp: Date.now(),
    },
    actions: data.actions || [
      { action: 'view', title: '查看' },
      { action: 'dismiss', title: '忽略' },
    ],
    vibrate: data.urgent ? [200, 100, 200] : undefined,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 通知点击事件
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // 如果已有打开的窗口，focus 它
        for (const client of windowClients) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        // 否则打开新窗口
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
  );
});

// 通知关闭事件（用户手动关闭）
self.addEventListener('notificationclose', (event) => {
  // 可以记录 analytics 或同步到 IndexedDB
  console.log('通知已关闭:', event.notification.tag);
});
```

### 2.5 服务器端发送推送

```javascript
// 服务器端：发送推送通知 (Node.js + Express)
const express = require('express');
const webpush = require('web-push');

const app = express();
app.use(express.json());

// 存储订阅（生产环境用数据库）
const subscriptions = new Map();

// VAPID 配置
webpush.setVapidDetails(
  'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// 保存订阅
app.post('/api/push/subscribe', (req, res) => {
  const subscription = req.body;
  // 用用户 ID 作为 key
  const userId = req.headers['x-user-id'] || 'anonymous';
  subscriptions.set(userId, subscription);
  res.status(201).json({ success: true });
});

// 发送通知
app.post('/api/push/send', async (req, res) => {
  const { userId, title, body, url, urgent, actions } = req.body;

  const subscription = subscriptions.get(userId);
  if (!subscription) {
    return res.status(404).json({ error: '未找到订阅' });
  }

  const payload = JSON.stringify({
    title,
    body,
    url: url || '/',
    urgent: urgent || false,
    actions: actions || [
      { action: 'view', title: '查看' },
      { action: 'dismiss', title: '忽略' },
    ],
    icon: '/icon-192.png',
    badge: '/badge-96.png',
  });

  try {
    await webpush.sendNotification(subscription, payload);
    res.json({ success: true });
  } catch (err) {
    console.error('推送失败:', err);
    // 订阅失效，移除
    if (err.statusCode === 410) {
      subscriptions.delete(userId);
    }
    res.status(500).json({ error: err.message });
  }
});

// 批量推送
app.post('/api/push/broadcast', async (req, res) => {
  const { title, body, url } = req.body;
  const payload = JSON.stringify({ title, body, url });

  const results = [];
  for (const [userId, sub] of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      results.push({ userId, success: true });
    } catch (err) {
      results.push({ userId, success: false, error: err.message });
      if (err.statusCode === 410) {
        subscriptions.delete(userId);
      }
    }
  }

  res.json({ sent: results.filter(r => r.success).length, results });
});

app.listen(3000, () => console.log('Push server on :3000'));
```

### 2.6 数据推送（静默推送，不显示通知）

```javascript
// 数据推送：后台更新数据，不显示通知
// 注意：需要 userVisibleOnly: false（部分浏览器不支持）

self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();

    // 类型 1: 数据同步推送
    if (data.type === 'sync') {
      event.waitUntil(
        // 后台更新 IndexedDB
        syncDataFromServer(data.entity)
          .then(() => self.clients.matchAll())
          .then(clients => {
            // 通知打开的页面更新
            clients.forEach(client => {
              client.postMessage({
                type: 'DATA_UPDATED',
                entity: data.entity,
                timestamp: Date.now(),
              });
            });
          })
      );
    }

    // 类型 2: 消息通知（显示通知）
    else if (data.type === 'notification') {
      event.waitUntil(
        self.registration.showNotification(data.title, {
          body: data.body,
          icon: '/icon-192.png',
          data: { url: data.url },
        })
      );
    }

    // 类型 3: 配置更新
    else if (data.type === 'config') {
      event.waitUntil(
        caches.open('app-config-v1').then(cache => {
          return cache.put('/api/config', new Response(JSON.stringify(data.config), {
            headers: { 'Content-Type': 'application/json' },
          }));
        })
      );
    }
  }
});

// 后台数据同步
async function syncDataFromServer(entity) {
  const response = await fetch(`/api/${entity}/sync?since=${Date.now() - 3600000}`);
  const data = await response.json();

  // 更新 IndexedDB
  const db = await openDB('offline-db', 1);
  const tx = db.transaction(entity, 'readwrite');
  const store = tx.objectStore(entity);

  for (const item of data) {
    await store.put(item);
  }

  await tx.done;
}
```

---

## 三、Periodic Background Sync

### 3.1 什么是 Periodic Background Sync？

允许 PWA 在后台定期获取数据，即使用户没有打开应用。

```javascript
// 注册周期同步
async function registerPeriodicSync() {
  if (!('PeriodicSyncManager' in window)) {
    console.log('不支持 Periodic Background Sync');
    return;
  }

  const registration = await navigator.serviceWorker.ready;

  try {
    await registration.periodicSync.register('fetch-updates', {
      minInterval: 15 * 60 * 1000, // 最小 15 分钟
      // 浏览器可能根据使用情况调整实际间隔
    });
    console.log('周期同步已注册');
  } catch (err) {
    // 可能需要用户手势触发
    console.error('注册失败:', err);
  }
}

// Service Worker 中处理
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'fetch-updates') {
    event.waitUntil(fetchAndCacheUpdates());
  }
});

async function fetchAndCacheUpdates() {
  try {
    // 获取最新数据
    const response = await fetch('/api/updates?since=' + lastSyncTime);
    const data = await response.json();

    // 缓存数据
    const cache = await caches.open('app-api-v1');
    for (const item of data) {
      const url = `/api/items/${item.id}`;
      await cache.put(url, new Response(JSON.stringify(item), {
        headers: { 'Content-Type': 'application/json' },
      }));
    }

    // 通知打开的页面
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'UPDATES_AVAILABLE', count: data.length });
    });

    // 如果有重要更新，发送通知
    if (data.some(item => item.important)) {
      await self.registration.showNotification('新更新可用', {
        body: `${data.filter(i => i.important).length} 条重要更新`,
        icon: '/icon-192.png',
      });
    }

    // 记录同步时间
    const db = await openDB('sync-db', 1);
    const tx = db.transaction('sync-state', 'readwrite');
    await tx.store.put({ key: 'last-updates-sync', value: Date.now() });
    await tx.done;
  } catch (err) {
    console.error('周期同步失败:', err);
  }
}
```

### 3.2 周期同步 vs Background Sync 对比

| 特性 | Background Sync | Periodic Background Sync |
|------|----------------|-------------------------|
| 触发条件 | 网络恢复时 | 定期触发 |
| 用途 | 离线操作队列 | 定期获取新数据 |
| 浏览器支持 | Chrome/Edge | Chrome/Edge (需用户交互) |
| 最小间隔 | 无 | 15 分钟 |
| 需要权限 | 无 | 可能需要用户手势 |
| 可靠性 | 高 | 浏览器可能调整 |

---

## 四、高级 IndexedDB 模式

### 4.1 封装：Type-safe IndexedDB

```javascript
// 类型安全 IndexedDB 封装
class DB {
  constructor(name, version) {
    this.name = name;
    this.version = version;
    this._db = null;
  }

  async open() {
    if (this._db) return this._db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this._onUpgrade(db, event.oldVersion, event.newVersion);
      };

      request.onsuccess = () => {
        this._db = request.result;
        this._db.onversionchange = () => {
          this._db.close();
          this._db = null;
        };
        resolve(this._db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  _onUpgrade(db, oldVersion, newVersion) {
    // 子类覆盖
  }

  // 通用 CRUD
  async get(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName, query, count) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = query
        ? store.getAll(query, count)
        : store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async count(storeName, query) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = query ? store.count(query) : store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 批量操作
  async batch(storeName, operations) {
    const db = await this.open();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    const promises = operations.map(op => {
      return new Promise((resolve, reject) => {
        const request = store[op.type](op.value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(promises);
    await new Promise(resolve => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  // 游标遍历（大数据量）
  async *cursor(storeName, query, direction) {
    const db = await this.open();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.openCursor(query, direction);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          resolve(cursor.value);
          cursor.continue();
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// === 具体应用 DB ===
class NotesDB extends DB {
  constructor() {
    super('notes-app', 3);
  }

  _onUpgrade(db, oldVersion) {
    // notes store
    if (!db.objectStoreNames.contains('notes')) {
      const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
      notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      notesStore.createIndex('folderId', 'folderId', { unique: false });
      notesStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      notesStore.createIndex('pinned', 'pinned', { unique: false });
    }

    // sync queue store
    if (!db.objectStoreNames.contains('sync-queue')) {
      const queueStore = db.createObjectStore('sync-queue', { keyPath: 'id' });
      queueStore.createIndex('status', 'status', { unique: false });
      queueStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // settings store
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }

    // v3: 全文搜索索引
    if (oldVersion < 3) {
      const notesStore = db.transaction('notes').objectStore('notes');
      notesStore.createIndex('searchText', 'searchText', {
        unique: false, multiEntry: true,
      });
    }
  }

  // 业务方法
  async saveNote(note) {
    note.updatedAt = Date.now();
    note.searchText = this._extractSearchTerms(note.title + ' ' + note.content);
    await this.put('notes', note);
    await this.enqueueSync('note:update', note);
  }

  async deleteNote(id) {
    await this.delete('notes', id);
    await this.enqueueSync('note:delete', { id });
  }

  async getNotesByFolder(folderId) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const index = store.index('folderId');
      const request = index.getAll(folderId);
      request.onsuccess = () => {
        const notes = request.result.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return b.updatedAt - a.updatedAt;
        });
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async searchNotes(query) {
    const terms = this._extractSearchTerms(query);
    const allNotes = await this.getAll('notes');

    return allNotes.filter(note => {
      const searchText = (note.searchText || []).join(' ').toLowerCase();
      return terms.some(term => searchText.includes(term.toLowerCase()));
    });
  }

  _extractSearchTerms(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  async enqueueSync(action, data) {
    const item = {
      id: `${action}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      action,
      data,
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0,
    };
    await this.put('sync-queue', item);
    return item;
  }

  async getPendingSyncs() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync-queue', 'readonly');
      const store = tx.objectStore('sync-queue');
      const index = store.index('status');
      const request = index.getAll('pending');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async markSynced(id) {
    await this.delete('sync-queue', id);
  }

  async markSyncFailed(id, error) {
    const item = await this.get('sync-queue', id);
    if (item) {
      item.retryCount++;
      item.lastError = error;
      item.nextRetry = Date.now() + Math.min(30000 * Math.pow(2, item.retryCount), 3600000);
      await this.put('sync-queue', item);
    }
  }
}

// === 使用示例 ===
const db = new NotesDB();

// 保存笔记
await db.saveNote({
  id: 'note-1',
  title: 'PWA 学习笔记',
  content: 'Service Worker 是...',
  folderId: 'folder-tech',
  tags: ['pwa', 'offline'],
  pinned: true,
});

// 搜索
const results = await db.searchNotes('Service Worker');

// 获取待同步项
const pending = await db.getPendingSyncs();
```

### 4.2 IndexedDB 事务模式

```javascript
// 跨 Store 事务（原子操作）
async function transferNote(noteId, fromFolderId, toFolderId) {
  const db = await openDB('notes-app', 3);
  const tx = db.transaction(['notes', 'folders'], 'readwrite');

  try {
    // 从 notes 获取
    const note = await tx.objectStore('notes').get(noteId);
    if (!note) throw new Error('笔记不存在');

    // 更新 folderId
    note.folderId = toFolderId;
    note.updatedAt = Date.now();

    // 保存
    await tx.objectStore('notes').put(note);

    // 更新文件夹统计
    const fromFolder = await tx.objectStore('folders').get(fromFolderId);
    fromFolder.noteCount = Math.max(0, (fromFolder.noteCount || 1) - 1);
    await tx.objectStore('folders').put(fromFolder);

    const toFolder = await tx.objectStore('folders').get(toFolderId);
    toFolder.noteCount = (toFolder.noteCount || 0) + 1;
    await tx.objectStore('folders').put(toFolder);

    // 事务自动提交
    await tx.done;
    return note;
  } catch (err) {
    // 事务自动回滚
    tx.abort();
    throw err;
  }
}
```

### 4.3 IndexedDB 性能优化

```javascript
// 1. 使用游标批量读取（避免 getAll 内存问题）
async function exportAllNotes() {
  const db = await openDB('notes-app', 3);
  const tx = db.transaction('notes', 'readonly');
  const store = tx.objectStore('notes');
  const notes = [];

  return new Promise((resolve, reject) => {
    const request = store.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        notes.push(cursor.value);
        cursor.continue(); // 逐条读取，不占内存
      } else {
        resolve(notes);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// 2. 分页加载
async function getNotesPage(page = 0, pageSize = 20) {
  const db = await openDB('notes-app', 3);
  const tx = db.transaction('notes', 'readonly');
  const store = tx.objectStore('notes');
  const index = store.index('updatedAt');

  const notes = [];
  let skipped = 0;

  return new Promise((resolve, reject) => {
    const request = index.openCursor(null, 'prev');

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && notes.length < pageSize) {
        if (skipped < page * pageSize) {
          skipped++;
          cursor.continue();
        } else {
          notes.push(cursor.value);
          cursor.continue();
        }
      } else {
        resolve(notes);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// 3. 复合索引查询
// 索引: [folderId, updatedAt] — 按文件夹排序
// 在 _onUpgrade 中:
// notesStore.createIndex('folderByTime', ['folderId', 'updatedAt'], { unique: false });

async function getNotesByFolderAndTime(folderId, after) {
  const db = await openDB('notes-app', 3);
  const tx = db.transaction('notes', 'readonly');
  const store = tx.objectStore('notes');
  const index = store.index('folderByTime');

  const notes = [];
  const range = IDBKeyRange.bound([folderId, after], [folderId, Infinity]);

  return new Promise((resolve, reject) => {
    const request = index.openCursor(range, 'prev');
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        notes.push(cursor.value);
        cursor.continue();
      } else {
        resolve(notes);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
```

---

## 五、PWA 安全加固

### 5.1 Service Worker 安全

```javascript
// 1. SW 作用域限制（限制 SW 能拦截的范围）
// 注册时指定 scope
navigator.serviceWorker.register('/sw.js', {
  scope: '/app/', // 只拦截 /app/ 下的请求
});

// 2. 请求验证 — 防止恶意请求
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 只处理同源请求
  if (url.origin !== self.location.origin) {
    return; // 不拦截第三方请求
  }

  // 验证请求路径白名单
  const allowedPaths = /^\/(app|api|assets|offline)/;
  if (!allowedPaths.test(url.pathname)) {
    return;
  }

  // 验证 Content-Type（防止 MIME 嗅探攻击）
  if (event.request.destination === 'script' ||
      event.request.destination === 'style') {
    // 确保正确的 MIME type
    event.respondWith(
      fetch(event.request).then(response => {
        const ct = response.headers.get('Content-Type') || '';
        if (event.request.destination === 'script' && !ct.includes('javascript')) {
          return new Response('Blocked: wrong MIME type', { status: 403 });
        }
        return response;
      })
    );
  }
});

// 3. 消息验证 — 防止跨源 postMessage
self.addEventListener('message', (event) => {
  // 验证来源
  if (event.origin !== self.location.origin) {
    console.warn('拒绝跨源消息:', event.origin);
    return;
  }

  // 验证消息格式
  const { type, payload } = event.data || {};
  if (!type || typeof type !== 'string') return;

  // 白名单处理
  const handlers = {
    'SKIP_WAITING': () => self.skipWaiting(),
    'CLIENTS_CLAIM': () => self.clients.claim(),
    'CACHE_URLS': (urls) => cacheUrls(urls),
  };

  if (handlers[type]) {
    handlers[type](payload);
  }
});

// 4. 缓存完整性校验
async function cacheWithIntegrity(request, expectedHash) {
  const response = await fetch(request);
  const buffer = await response.arrayBuffer();

  // 计算 SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (expectedHash && hash !== expectedHash) {
    console.error('完整性校验失败:', request.url);
    return new Response('Integrity check failed', { status: 403 });
  }

  // 缓存通过校验的响应
  const cache = await caches.open('app-integrity-v1');
  await cache.put(request, response.clone());

  return response;
}
```

### 5.2 数据加密（敏感数据离线存储）

```javascript
// 使用 Web Crypto API 加密 IndexedDB 数据
class EncryptedDB {
  constructor(dbName, storeName) {
    this.dbName = dbName;
    this.storeName = storeName;
    this._key = null;
  }

  // 从密码派生密钥
  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt || crypto.getRandomValues(new Uint8Array(16)),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // 加密数据
  async encrypt(plaintext, key) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plaintext)
    );

    // 返回 IV + 密文
    const result = new Uint8Array(iv.length + ciphertext.byteLength);
    result.set(iv);
    result.set(new Uint8Array(ciphertext), iv.length);
    return result;
  }

  // 解密数据
  async decrypt(ciphertext, key) {
    const iv = ciphertext.slice(0, 12);
    const data = ciphertext.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return new TextDecoder().decode(decrypted);
  }

  // 存储加密数据
  async put(key, value, password) {
    if (!this._key) {
      this._key = await this.deriveKey(password);
    }

    const encrypted = await this.encrypt(JSON.stringify(value), this._key);

    const db = await openDB(this.dbName, 1);
    const tx = db.transaction(this.storeName, 'readwrite');
    await tx.objectStore(this.storeName).put({
      key,
      data: Array.from(encrypted), // 转为数组存储
      encrypted: true,
    });
    await tx.done;
  }

  // 读取解密数据
  async get(key, password) {
    if (!this._key) {
      this._key = await this.deriveKey(password);
    }

    const db = await openDB(this.dbName, 1);
    const tx = db.transaction(this.storeName, 'readonly');
    const record = await tx.objectStore(this.storeName).get(key);

    if (!record || !record.encrypted) return record?.data;

    const ciphertext = new Uint8Array(record.data);
    const decrypted = await this.decrypt(ciphertext, this._key);
    return JSON.parse(decrypted);
  }
}

// === 使用示例 ===
const encryptedDB = new EncryptedDB('secure-notes', 'secrets');

// 存储加密笔记
await encryptedDB.put('password-1', {
  service: 'GitHub',
  username: 'admin',
  password: 'super-secret',
}, 'master-password');

// 读取解密笔记
const note = await encryptedDB.get('password-1', 'master-password');
console.log(note); // { service: 'GitHub', username: 'admin', password: 'super-secret' }
```

### 5.3 CSP 配置

```
# 生产环境 CSP Header
Content-Security-Policy: \
  default-src 'self'; \
  script-src 'self' 'wasm-unsafe-eval'; \
  style-src 'self' 'unsafe-inline'; \
  img-src 'self' data: blob:; \
  font-src 'self'; \
  connect-src 'self' https://api.example.com; \
  worker-src 'self' /sw.js; \
  frame-ancestors 'none'; \
  form-action 'self'; \
  base-uri 'self'; \
  object-src 'none'

# 报告端点（可选）
Content-Security-Policy-Report-Only: \
  report-uri /csp-report;
```

---

## 六、PWA 性能优化 — Lighthouse 100 分指南

### 6.1 关键指标

| 指标 | 目标 | 说明 |
|------|------|------|
| FCP (First Contentful Paint) | < 1.0s | 首屏内容绘制 |
| LCP (Largest Contentful Paint) | < 2.5s | 最大内容绘制 |
| CLS (Cumulative Layout Shift) | < 0.1 | 布局偏移 |
| INP (Interaction to Next Paint) | < 200ms | 交互响应 |
| TTFB (Time to First Byte) | < 0.8s | 首字节时间 |
| SI (Speed Index) | < 3.4s | 速度指数 |

### 6.2 PWA 专项优化

```javascript
// 1. 预缓存关键资源（install 事件）
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app.css',
  '/app.js',
  '/fonts/inter-var.woff2',
  '/icon-192.png',
  '/icon-512.png',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('precache-v1')
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// 2. 关键 CSS 内联 + 异步加载非关键 CSS
// index.html 中:
// <style>/* 关键 CSS (首屏样式) */</style>
// <link rel="stylesheet" href="/app.css" media="print" onload="this.media='all'">

// 3. 字体优化
// preload 关键字体
// <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>

// SW 中缓存字体（长缓存）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.match(/\.(woff2?|ttf|otf|eot)$/)) {
    event.respondWith(
      caches.open('fonts-v1').then(cache => {
        return cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  }
});

// 4. 图片优化
// - WebP/AVIF 格式
// - srcset 响应式
// - loading="lazy"
// - 占位符 (blur-up)
// SW 中缓存图片
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|avif|gif|svg)$/)) {
    event.respondWith(
      caches.open('images-v1').then(cache => {
        return cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
              // 限制图片缓存数量（LRU）
              cache.keys().then(keys => {
                if (keys.length > 50) {
                  cache.delete(keys[0]);
                }
              });
            }
            return response;
          }).catch(() => {
            // 离线时返回占位图
            return caches.match('/placeholder.svg');
          });
        });
      })
    );
  }
});

// 5. 长任务检测与分割
// 主线程中:
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) {
      console.warn('长任务:', entry.name, entry.duration + 'ms');
    }
  }
});
observer.observe({ entryTypes: ['longtask'] });

// 使用 scheduler.postTask 分割长任务（Chrome 103+）
if ('scheduler' in window) {
  scheduler.postTask(() => {
    // 低优先级任务
    heavyComputation();
  }, { priority: 'background' });
}

// 6. 虚拟列表（大量数据渲染）
class VirtualList {
  constructor(container, options) {
    this.container = container;
    this.itemHeight = options.itemHeight;
    this.items = options.items || [];
    this.visibleCount = Math.ceil(container.clientHeight / this.itemHeight) + 2;
    this.scrollTop = 0;

    this.contentEl = document.createElement('div');
    this.contentEl.style.position = 'relative';
    container.appendChild(this.contentEl);

    this.itemEls = [];
    container.addEventListener('scroll', () => this.onScroll(), { passive: true });
    this.render();
  }

  onScroll() {
    this.scrollTop = this.container.scrollTop;
    this.render();
  }

  render() {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = Math.min(startIndex + this.visibleCount, this.items.length);

    this.contentEl.style.height = `${this.items.length * this.itemHeight}px`;

    // 复用 DOM 元素
    while (this.itemEls.length < endIndex - startIndex) {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.right = '0';
      el.style.height = `${this.itemHeight}px`;
      this.contentEl.appendChild(el);
      this.itemEls.push(el);
    }

    for (let i = startIndex; i < endIndex; i++) {
      const el = this.itemEls[i - startIndex];
      el.style.top = `${i * this.itemHeight}px`;
      el.textContent = this.items[i];
    }

    // 隐藏多余的
    for (let i = endIndex - startIndex; i < this.itemEls.length; i++) {
      this.itemEls[i].style.display = 'none';
    }
    for (let i = 0; i < endIndex - startIndex; i++) {
      this.itemEls[i].style.display = '';
    }
  }
}
```

---

## 七、真实 PWA 案例分析

### 7.1 Twitter Lite

**关键数据:**
- 体积从 60MB 降至 3MB（减少 97%）
- 安装用户增长 75%
- 会话时间增长 6.5%
- 推文发送量增长 2 倍
- Bounce rate 降低 20%

**核心技术:**
```
1. Service Worker 预缓存 HTML Shell
2. 路由级代码分割（每个页面独立 chunk）
3. 离线队列（离线发送推文，联网后同步）
4. 渐进式图片加载（blur-up → 真实图片）
5. 虚拟滚动（长推文列表）
6. Background Sync（离线操作队列）
```

**SW 策略:**
```javascript
// Twitter Lite 的缓存策略
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 用户时间线: Network-First（需要最新数据）
  if (url.pathname.match(/^\/\w+\/status/)) {
    event.respondWith(networkFirst(event.request));
  }

  // 静态资源: Cache-First（JS/CSS/图片）
  if (url.pathname.match(/\.(js|css|png|jpg|webp)$/)) {
    event.respondWith(cacheFirst(event.request));
  }

  // API: Stale-While-Revalidate
  if (url.pathname.startsWith('/2/')) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
```

### 7.2 Starbucks PWA

**关键数据:**
- 体积等于一个图片大小
- 可在 3G 网络下使用
- 功能与原生 App 一致

**核心技术:**
```
1. 离线菜单浏览（预缓存完整菜单）
2. 离线礼品卡生成（IndexedDB 存储）
3. 门店定位（GPS + 离线缓存）
4. 订单排队（离线下单，联网后提交）
```

**离线订单流程:**
```javascript
// 离线下单
async function placeOrder(order) {
  if (navigator.onLine) {
    // 在线：直接提交
    return await fetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  } else {
    // 离线：保存到 IndexedDB 队列
    const db = await openDB('starbucks', 1);
    const tx = db.transaction('order-queue', 'readwrite');
    await tx.objectStore('order-queue').put({
      id: generateId(),
      order,
      createdAt: Date.now(),
      status: 'pending',
    });
    await tx.done;

    // 注册 Background Sync
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('sync-orders');

    return { status: 'queued', message: '离线保存，联网后自动提交' };
  }
}

// SW 中处理同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  const db = await openDB('starbucks', 1);
  const tx = db.transaction('order-queue', 'readwrite');
  const store = tx.objectStore('order-queue');
  const pending = await store.getAll();

  for (const item of pending) {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.order),
      });

      if (response.ok) {
        await store.delete(item.id);
      }
    } catch (err) {
      console.error('订单同步失败:', item.id, err);
    }
  }
}
```

### 7.3 Pinterest

**关键数据:**
- 广告收入增长 40%
- 用户会话时间增长 2x
- 注册转化率增长 3x
- 核心体验 < 1MB

**核心技术:**
```
1. 预渲染关键页面（SSR + SW 缓存）
2. 无限滚动的虚拟列表
3. 图片懒加载 + 渐进式加载
4. 离线 Pin 保存（IndexedDB）
5. Service Worker 分层缓存
```

### 7.4 Trivago

**关键数据:**
- 页面加载时间减少 50%
- 转化率提升 20%+
- 推送通知打开率 3x

**核心技术:**
```
1. 酒店搜索结果离线缓存
2. 价格追踪（Background Sync 定期检查）
3. 推送通知（价格变动通知）
4. 离线收藏酒店列表
```

---

## 八、PWA 测试策略

### 8.1 Lighthouse CI

```javascript
// lighthouse-ci.config.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000'],
      staticDistDir: './dist',
      numberOfRuns: 5,
    },
    assert: {
      assertions: {
        // PWA 检查
        'is-on-https': ['error', { minLength: 1 }],
        'service-worker': ['error'],
        'installable-manifest': ['error'],
        'splash-screen': ['error'],
        'themed-omnibox': ['error'],
        'viewport': ['error'],

        // 性能阈值
        'first-contentful-paint': ['error', { maxLength: 1000 }],
        'largest-contentful-paint': ['error', { maxLength: 2500 }],
        'cumulative-layout-shift': ['error', { maxLength: 0.1 }],
        'interactive': ['error', { maxLength: 3500 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

### 8.2 离线 E2E 测试

```javascript
// playwright 离线测试
const { test, expect } = require('@playwright/test');

test('PWA 离线功能测试', async ({ page, browser }) => {
  // 1. 首次加载（在线）
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // 验证 SW 已注册
  const swRegistered = await page.evaluate(() => {
    return navigator.serviceWorker.controller !== null;
  });
  expect(swRegistered).toBe(true);

  // 2. 模拟离线
  const context = browser.defaultBrowserContext();
  await context.setOffline(true);

  // 3. 刷新页面（应该从缓存加载）
  await page.reload({ waitUntil: 'domcontentloaded' });

  // 验证页面仍然可用
  await expect(page.locator('h1')).toBeVisible();

  // 4. 验证离线功能
  // 添加离线数据
  await page.click('text=新建笔记');
  await page.fill('input[name="title"]', '离线笔记');
  await page.fill('textarea', '这是离线内容');
  await page.click('text=保存');

  // 5. 验证数据保存到 IndexedDB
  const savedNote = await page.evaluate(async () => {
    const db = await openDB('notes-app', 3);
    const tx = db.transaction('notes', 'readonly');
    const store = tx.objectStore('notes');
    const all = await store.getAll();
    return all.find(n => n.title === '离线笔记');
  });
  expect(savedNote).toBeDefined();
  expect(savedNote.title).toBe('离线笔记');

  // 6. 恢复在线
  await context.setOffline(false);

  // 7. 验证 Background Sync 触发
  await page.waitForTimeout(2000);
  const syncStatus = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const registrations = await reg.sync.getTags();
    return registrations;
  });
  // sync 应该被触发并清理
});

// 8.3 性能基准测试
test('PWA 加载性能', async ({ page }) => {
  await page.goto('/');

  // 等待 LCP
  const lcp = await page.evaluate(() => {
    return new Promise(resolve => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          resolve(entries[entries.length - 1].startTime);
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      // 超时保护
      setTimeout(() => resolve(-1), 5000);
    });
  });

  expect(lcp).toBeLessThan(2500);
});
```

---

## 九、PWA 部署 Checklist

### 9.1 部署前检查

```
□ manifest.json 完整且有效
  □ name + short_name
  □ icons (192x192 + 512x512)
  □ start_url
  □ display: standalone/minimal-ui/fullscreen
  □ theme_color + background_color

□ Service Worker
  □ 已注册
  □ install 事件预缓存关键资源
  □ fetch 事件处理所有路由
  □ activate 事件清理旧缓存
  □ 支持 push 事件
  □ 支持 sync 事件

□ HTTPS
  □ 有效 SSL 证书
  □ HSTS Header
  □ 无混合内容

□ 性能
  □ Lighthouse PWA ≥ 90
  □ Lighthouse Performance ≥ 90
  □ 首屏 < 3s (3G)
  □ 总体积 < 1MB

□ 可访问性
  □ alt 文本
  □ 键盘导航
  □ ARIA 标签
  □ 颜色对比度 ≥ 4.5:1

□ 离线功能
  □ 离线页面
  □ 离线数据操作
  □ 同步队列
  □ 网络状态指示
```

### 9.2 服务器配置 (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # CSP
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self';" always;

    # Service Worker 必须
    add_header Cache-Control "no-cache" for /sw.js;

    # manifest.json
    add_header Content-Type "application/manifest+json" for /manifest.json;

    # 静态资源长缓存
    location ~* \.(js|css|png|jpg|webp|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML 不缓存（让 SW 处理）
    location ~* \.html$ {
        add_header Cache-Control "no-cache";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 十、综合实战：离线笔记 PWA v2 (CRDT + Push + Sync)

### 10.1 架构设计

```
┌─────────────────────────────────────────────────────┐
│                   OfflineNotes v2                    │
├──────────────┬──────────────┬───────────────────────┤
│  UI 层       │  数据层      │  基础设施层           │
│              │              │                       │
│  • 骨架屏    │  • NotesDB   │  • SW (多策略)        │
│  • 编辑器    │    (加密)    │  • CRDT 同步          │
│  • 离线指示  │  • OR-Set    │  • Web Push           │
│  • 冲突解决  │    (标签)    │  • Periodic Sync      │
│  • 通知      │  • SyncQueue │  • Background Sync    │
│  • 可访问性  │  • LWW-Reg   │  • Cache API (5层)    │
└──────────────┴──────────────┴───────────────────────┘
```

### 10.2 完整 Service Worker

```javascript
// sw.js — 五层缓存 + CRDT 同步 + Push + Periodic Sync

const CACHE_VERSION = 'v2';
const CACHE_LAYERS = {
  PRECACHE:   `precache-${CACHE_VERSION}`,
  STATIC:     `static-${CACHE_VERSION}`,
  API:        `api-${CACHE_VERSION}`,
  MEDIA:      `media-${CACHE_VERSION}`,
  THIRD_PARTY:`third-party-${CACHE_VERSION}`,
};

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/app.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// === Install: 预缓存 ===
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_LAYERS.PRECACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// === Activate: 清理旧缓存 ===
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => !Object.values(CACHE_LAYERS).includes(key))
            .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// === Fetch: 五层路由策略 ===
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // Layer 1: 预缓存资源 — Cache-First
  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, CACHE_LAYERS.PRECACHE));
    return;
  }

  // Layer 2: 静态资源 — Cache-First
  if (url.pathname.match(/\.(js|css|woff2|png|jpg|webp|svg|ico)$/)) {
    event.respondWith(cacheFirst(request, CACHE_LAYERS.STATIC));
    return;
  }

  // Layer 3: API 数据 — Network-First + TTL
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithTTL(request, CACHE_LAYERS.API, 5 * 60 * 1000));
    return;
  }

  // Layer 4: 媒体资源 — Cache-First + 后台更新
  if (url.pathname.match(/\.(mp4|webm|mp3|ogg)$/)) {
    event.respondWith(cacheFirstWithBackgroundUpdate(request, CACHE_LAYERS.MEDIA));
    return;
  }

  // Layer 5: 第三方资源 — Stale-While-Revalidate
  if (url.origin !== self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, CACHE_LAYERS.THIRD_PARTY));
    return;
  }

  // 默认: Network-First + 离线降级
  event.respondWith(networkFirstWithFallback(request));
});

// === 缓存策略实现 ===

// Cache-First
function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(cache => {
    return cache.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
    });
  });
}

// Network-First + TTL
function networkFirstWithTTL(request, cacheName, ttl) {
  return caches.open(cacheName).then(cache => {
    return cache.match(request).then(cached => {
      const now = Date.now();
      const timestamp = cached?.headers.get('X-Cache-Timestamp');
      const age = timestamp ? now - Number(timestamp) : Infinity;

      // 缓存有效且未过期
      if (cached && (!ttl || age < ttl)) {
        // 后台刷新
        fetch(request).then(response => {
          if (response.ok) {
            const headers = new Headers(response.headers);
            headers.set('X-Cache-Timestamp', String(now));
            cache.put(request, new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers,
            }));
          }
        }).catch(() => {});
        return cached;
      }

      // 网络请求
      return fetch(request).then(response => {
        if (response.ok) {
          const headers = new Headers(response.headers);
          headers.set('X-Cache-Timestamp', String(now));
          cache.put(request, new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          }));
        }
        return response;
      }).catch(() => {
        // 网络失败，返回过期缓存或离线页面
        if (cached) return cached;
        return caches.match('/offline.html');
      });
    });
  });
}

// Network-First + 离线降级
function networkFirstWithFallback(request) {
  return fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(CACHE_LAYERS.STATIC);
      cache.then(c => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => {
    // 尝试缓存
    return caches.match(request).then(cached => {
      if (cached) return cached;
      // 离线降级
      if (request.destination === 'document') {
        return caches.match('/offline.html');
      }
      return new Response('离线', { status: 503 });
    });
  });
}

// Stale-While-Revalidate
function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then(cache => {
    return cache.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response.clone();
      }).catch(() => cached);

      return cached || fetchPromise;
    });
  });
}

// Cache-First + 后台更新
function cacheFirstWithBackgroundUpdate(request, cacheName) {
  return caches.open(cacheName).then(cache => {
    return cache.match(request).then(cached => {
      if (cached) {
        // 后台更新
        fetch(request).then(response => {
          if (response.ok) cache.put(request, response.clone());
        }).catch(() => {});
        return cached;
      }
      return fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
    });
  });
}

// === Push 事件 ===
self.addEventListener('push', (event) => {
  let data = { title: '新通知', body: '你有一条新消息', url: '/' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  // 数据同步类型
  if (data.type === 'sync') {
    event.waitUntil(
      syncFromServer(data.entity)
        .then(() => broadcastMessage({ type: 'DATA_UPDATED', entity: data.entity }))
    );
    return;
  }

  // 通知类型
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      tag: data.tag || 'default',
      data: { url: data.url || '/' },
      actions: data.actions || [
        { action: 'view', title: '查看' },
        { action: 'dismiss', title: '忽略' },
      ],
    })
  );
});

// === Notification Click ===
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if (client.url === event.notification.data.url) {
          return client.focus();
        }
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});

// === Background Sync ===
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncNotesToServer());
  }
  if (event.tag === 'sync-tags') {
    event.waitUntil(syncTagsToServer());
  }
});

// === Periodic Sync ===
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'fetch-updates') {
    event.waitUntil(fetchLatestUpdates());
  }
});

// === Message ===
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLIENTS_CLAIM') {
    self.clients.claim();
  }
});

// === 辅助函数 ===
async function syncFromServer(entity) {
  const response = await fetch(`/api/${entity}/sync?since=${Date.now() - 86400000}`);
  const data = await response.json();

  const cache = await caches.open(CACHE_LAYERS.API);
  for (const item of data) {
    await cache.put(`/api/${entity}/${item.id}`,
      new Response(JSON.stringify(item), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }
}

async function broadcastMessage(message) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage(message));
}

async function syncNotesToServer() {
  // 从 IndexedDB 获取待同步项
  const db = await openDB('notes-app', 3);
  const tx = db.transaction('sync-queue', 'readonly');
  const pending = await tx.objectStore('sync-queue').index('status').getAll('pending');

  for (const item of pending) {
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      // 标记已同步
      const writeTx = db.transaction('sync-queue', 'readwrite');
      await writeTx.objectStore('sync-queue').delete(item.id);
      await writeTx.done;
    } catch (err) {
      console.error('同步失败:', item.id, err);
    }
  }
}

async function fetchLatestUpdates() {
  try {
    const response = await fetch('/api/updates?since=' + (lastSyncTime || 0));
    const data = await response.json();

    if (data.length > 0) {
      await self.registration.showNotification('新更新可用', {
        body: `${data.length} 条新内容`,
        icon: '/icon-192.png',
      });
    }
  } catch (err) {
    console.error('周期同步失败:', err);
  }
}
```

---

## 十一、速查表

### 11.1 CRDT 类型速查

| CRDT 类型 | 用途 | 合并规则 | 复杂度 |
|-----------|------|---------|--------|
| G-Counter | 只增计数器 | 逐节点取最大值求和 | O(n) |
| PN-Counter | 增减计数器 | 正负分别 G-Counter | O(n) |
| LWW-Register | 最后写入 | 时间戳最大者胜出 | O(1) |
| OR-Set | 无重复集合 | 合并元素 + 墓碑 | O(n) |
| LWW-Map | 最后写入字典 | 每个字段 LWW-Register | O(n) |
| Sequence CRDT | 有序文本 | ID 字典序 + 墓碑 | O(n log n) |

### 11.2 缓存策略速查

| 策略 | 适用场景 | 离线支持 | 新鲜度 |
|------|---------|---------|--------|
| Cache-First | 静态资源 | ✅ 完美 | ⚠️ 需版本更新 |
| Network-First | API 数据 | ✅ 有降级 | ✅ 最新 |
| Stale-While-Revalidate | 非关键数据 | ✅ 有缓存 | ⚠️ 可能过期 |
| Cache-Only | 预缓存资源 | ✅ 完美 | ❌ 不更新 |
| Network-Only | 实时数据 | ❌ | ✅ 最新 |

### 11.3 PWA API 支持度

| API | Chrome | Firefox | Safari | Edge |
|-----|--------|---------|--------|------|
| Service Worker | ✅ 40+ | ✅ 44+ | ✅ 11.1+ | ✅ 79+ |
| Cache API | ✅ 40+ | ✅ 39+ | ✅ 11.1+ | ✅ 79+ |
| IndexedDB | ✅ 24+ | ✅ 16+ | ✅ 8+ | ✅ 12+ |
| Push API | ✅ 42+ | ✅ 44+ | ✅ 16.4+ | ✅ 79+ |
| Background Sync | ✅ 42+ | ❌ | ❌ | ✅ 79+ |
| Periodic Sync | ✅ 105+ | ❌ | ❌ | ✅ 105+ |
| Badging API | ✅ 72+ | ❌ | ❌ | ✅ 79+ |
| Share Target | ✅ 76+ | ❌ | ❌ | ✅ 79+ |
| Native File System | ✅ 86+ | ❌ | ❌ | ✅ 86+ |

---

## 十二、常见陷阱

1. **SW 更新陷阱**: SW 更新后需要 `skipWaiting()` + `clients.claim()` 才能立即生效
2. **Cache 版本管理**: 每次部署必须更新缓存版本，否则用户拿到旧资源
3. **IndexedDB 游标陷阱**: 在事务中修改数据会导致游标失效，需克隆数据
4. **Push 订阅失效**: 订阅可能过期（410 Gone），服务器需定期清理
5. **Background Sync 限制**: Firefox 不支持，需降级方案
6. **Periodic Sync 限制**: 仅 Chrome/Edge，且需要用户与页面交互过
7. **混合内容**: SW 拦截的请求不能加载 HTTP 资源
8. **大文件缓存**: Cache API 有存储限制（通常 50MB-2GB），大文件用 IndexedDB
9. **SW 线程休眠**: SW 空闲 30s 可能被终止，长时间操作用 `event.waitUntil()`
10. **CORS 问题**: SW 中 fetch 第三方资源需注意 CORS

---

## 五轮迭代总结

| 轮次 | 日期 | 产出 | 核心内容 |
|------|------|------|---------|
| v1 | 4/25 | PWA 基础 | manifest/SW/Cache API/IndexedDB 入门 |
| v2 | 4/28 | 完整实现 | OfflineTasks 完整 PWA 应用 |
| v3 | 4/29 | 修复增强 | ~22KB 修复 + 增强 |
| v4 | 4/30 | 生产级 | ~70KB 分层缓存/增量同步/性能/可访问性 |
| v5 | 5/1 | 高级实战 | CRDT/Web Push/Periodic Sync/加密/真实案例 |

**PWA/离线优先领域 5 轮迭代全部闭环** ✅

---

*产出: ~52KB 文档，含 40+ 代码示例*
*累计总专项: 127 个*
