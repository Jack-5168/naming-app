# PWA/离线优先 专项训练文档

> 专项 19 — Service Worker / Cache API / IndexedDB
> 目标：构建一个完全离线可用的 PWA 笔记应用

---

## 一、PWA 核心概念

### 1.1 什么是 PWA？

**Progressive Web App（渐进式 Web 应用）** 是一种利用现代 Web API 构建的应用，具备原生应用的能力：

| 特性 | 说明 |
|------|------|
| 可靠 | 离线可用，即使在弱网环境下也能快速加载 |
| 快速 | Service Worker 缓存，秒级响应 |
| 沉浸 | 全屏显示，可安装到桌面，推送通知 |
| 渐进 | 在旧浏览器中降级为普通网页 |

### 1.2 PWA 三大支柱

```
┌─────────────────────────────────────────┐
│              PWA 应用                    │
├──────────────┬──────────────┬────────────┤
│  Web App     │  Service     │  HTTPS     │
│  Manifest    │  Worker      │  (必需)    │
│              │              │            │
│  • 应用名称  │  • 离线缓存  │  • 安全    │
│  • 图标      │  • 后台同步  │  • 信任    │
│  • 主题色    │  • 推送通知  │  • 凭证    │
│  • 显示模式  │  • 消息通信  │            │
│  • 启动URL   │  • 生命周期  │            │
└──────────────┴──────────────┴────────────┘
```

### 1.3 离线优先架构

```
用户请求
  │
  ├─→ Service Worker 拦截
  │     │
  │     ├─→ 缓存命中 ──→ 立即返回（离线可用）
  │     │
  │     └─→ 缓存未命中 ──→ 网络请求
  │                            │
  │                            ├─→ 成功 ──→ 缓存 + 返回
  │                            │
  │                            └─→ 失败 ──→ 降级/离线页面
  │
  └─→ IndexedDB（数据层）
        │
        ├─→ 写入 → 本地持久化
        │
        └─→ 同步队列 → 网络恢复后批量提交
```

---

## 二、Service Worker 深度解析

### 2.1 什么是 Service Worker？

Service Worker 是浏览器在后台运行的 **独立线程脚本**，充当网络请求的代理：

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   页面/APP   │────→│  Service Worker  │────→│   网络/缓存  │
│  (主线程)    │←────│  (独立线程)      │←────│  (Cache API) │
└─────────────┘     └─────────────────┘     └─────────────┘
                          │
                    ┌─────┴─────┐
                    │ IndexedDB │
                    │ (数据层)   │
                    └───────────┘
```

**关键特性：**
- ❌ 不能直接操作 DOM
- ❌ 不能访问 localStorage/sessionStorage
- ✅ 可以拦截所有网络请求
- ✅ 支持推送通知
- ✅ 支持后台同步
- ✅ 必须 HTTPS（localhost 除外）

### 2.2 生命周期（完整状态机）

```
脚本下载
   │
   ▼
┌────────┐
│Installing│ ← install 事件触发
└───┬────┘
    │ waitUntil() 完成
    ▼
┌──────────┐
│Installed │ ← 等待激活（如果有旧版本在运行）
└───┬──────┘
    │ 旧 SW 被终止 或 skipWaiting()
    ▼
┌────────┐
│Activating│ ← activate 事件触发
└───┬────┘
    │ waitUntil() 完成
    ▼
┌────────┐     ┌─────────────────┐
│Activated │──→│  处理 fetch 事件  │
└────────┘     │  处理 sync 事件   │
               │  处理 push 事件   │
               └─────────────────┘
                    │
              空闲 20s 后终止
                    │
              下次事件时唤醒
```

**关键 API：**
```javascript
// install 阶段 — 预缓存资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('my-cache').then(cache =>
      cache.addAll(['/index.html', '/styles.css', '/app.js'])
    )
  );
});

// activate 阶段 — 清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(cleanupOldCaches());
});

// fetch 阶段 — 拦截请求
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
```

### 2.3 注册与更新

```javascript
// 注册 Service Worker
if ('serviceWorker' in navigator) {
  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',           // 控制范围
  });

  // 监听更新
  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // 新版本已安装，提示用户刷新
        showUpdateBanner();
      }
    });
  });

  // 手动检查更新
  setInterval(() => registration.update(), 3600000); // 每小时
}
```

**更新机制：**
1. 浏览器访问页面时检查 `sw.js` 字节是否变化
2. 变化则触发 `install` 事件（新 SW 进入 Installed 状态）
3. 旧 SW 继续控制页面，新 SW 等待激活
4. 用户关闭所有标签页后，新 SW 激活
5. 或调用 `skipWaiting()` 立即激活

### 2.4 消息通信

```javascript
// 主线程 → SW
navigator.serviceWorker.controller.postMessage({
  type: 'CLEAR_CACHE',
  payload: { cacheName: 'old-cache' }
});

// SW 接收消息
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  if (type === 'CLEAR_CACHE') {
    caches.delete(payload.cacheName);
  }
});

// SW → 主线程
const clients = await self.clients.matchAll();
clients.forEach(client => {
  client.postMessage({ type: 'SYNC_COMPLETE', payload: { count: 5 } });
});
```

---

## 三、Cache API 详解

### 3.1 什么是 Cache API？

Cache API 是 Service Worker 的配套存储 API，专门用于缓存 HTTP 请求/响应对：

```javascript
// 基本操作
const cache = await caches.open('my-cache');

// 添加
await cache.put(request, response);
await cache.addAll(['/file1.js', '/file2.css']);

// 读取
const response = await cache.match(request);

// 删除
await cache.delete(request);

// 列出所有缓存
const cacheNames = await caches.keys();
```

### 3.2 五大缓存策略

#### 策略 1：Cache-First（缓存优先）

```
请求 → 查缓存 → 命中 → 返回缓存
                ↓ 未命中
                请求网络 → 缓存响应 → 返回
```

```javascript
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open('static-cache');
    cache.put(request, response.clone());
  }
  return response;
}
```

**适用场景：** 静态资源（CSS、JS、图片、字体）
**优点：** 速度快，完全离线可用
**缺点：** 可能返回过期内容

#### 策略 2：Network-First（网络优先）

```
请求 → 请求网络 → 成功 → 缓存响应 → 返回
                  ↓ 失败
                  查缓存 → 命中 → 返回缓存
                          ↓ 未命中
                          错误页面
```

```javascript
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open('dynamic-cache');
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('离线', { status: 503 });
  }
}
```

**适用场景：** API 数据、HTML 页面
**优点：** 优先获取最新数据
**缺点：** 离线时体验降级

#### 策略 3：Stale-While-Revalidate（缓存+后台更新）

```
请求 → 查缓存 → 命中 → 立即返回缓存
                          ↓
                          后台请求网络 → 更新缓存
                ↓ 未命中
                请求网络 → 返回
```

```javascript
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        caches.open('dynamic-cache').then(cache =>
          cache.put(request, response.clone())
        );
      }
      return response;
    });

  return cached || fetchPromise;
}
```

**适用场景：** 不要求实时性的数据（文章列表、用户资料）
**优点：** 快速响应 + 后台保持更新
**缺点：** 可能短暂显示旧数据

#### 策略 4：Network-Only（仅网络）

```javascript
// 不缓存，直接请求网络
async function networkOnly(request) {
  return fetch(request);
}
```

**适用场景：** 实时数据（股票价格、聊天消息）

#### 策略 5：Cache-Only（仅缓存）

```javascript
async function cacheOnly(request) {
  return caches.match(request);
}
```

**适用场景：** 离线页面、占位图

### 3.3 缓存版本管理

```javascript
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// activate 阶段清理旧版本
self.addEventListener('activate', (event) => {
  const validCaches = new Set([STATIC_CACHE, DYNAMIC_CACHE]);

  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => !validCaches.has(name))
          .map(name => caches.delete(name))
      )
    )
  );
});
```

### 3.4 缓存容量管理

```javascript
// 限制缓存数量（LRU 策略）
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxItems) {
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map(key => cache.delete(key)));
  }
}

// 缓存大小监控
async function getCacheSizes() {
  const sizes = {};
  for (const name of await caches.keys()) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    sizes[name] = keys.length;
  }
  return sizes;
}
```

---

## 四、IndexedDB 深度解析

### 4.1 为什么选择 IndexedDB？

| 特性 | localStorage | IndexedDB |
|------|-------------|-----------|
| 容量 | ~5MB | 大容量（通常 50%+ 磁盘空间）|
| 类型 | 仅字符串 | 任意 JS 对象 |
| 索引 | 无 | 支持多字段索引 |
| 查询 | 全量扫描 | 游标、范围查询 |
| 事务 | 无 | 完整事务支持 |
| 异步 | 同步（阻塞）| 异步（不阻塞）|
| 离线 | ✅ | ✅ |

### 4.2 IndexedDB 核心概念

```
┌─────────────────────────────────────────┐
│              IndexedDB 数据库             │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Object Store（对象仓库）           │  │
│  │  = 关系型数据库中的 Table           │  │
│  │                                   │  │
│  │  Key Path（主键路径）               │  │
│  │  ┌─────┬───────┬───────────┐      │  │
│  │  │ id  │ title │ content   │      │  │
│  │  ├─────┼───────┼───────────┤      │  │
│  │  │ 001 │ 笔记1 │ 内容...   │      │  │
│  │  │ 002 │ 笔记2 │ 内容...   │      │  │
│  │  └─────┴───────┴───────────┘      │  │
│  │                                   │  │
│  │  Index（索引）                     │  │
│  │  - titleIndex → 按标题搜索         │  │
│  │  - dateIndex  → 按日期排序         │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 4.3 完整 CRUD 示例

```javascript
// 打开数据库
const request = indexedDB.open('MyApp', 1);

request.onupgradeneeded = (event) => {
  const db = event.target.result;

  // 创建对象仓库
  const store = db.createObjectStore('notes', { keyPath: 'id' });

  // 创建索引
  store.createIndex('title', 'title', { unique: false });
  store.createIndex('updatedAt', 'updatedAt', { unique: false });
  store.createIndex('category', 'category', { unique: false });
};

request.onsuccess = (event) => {
  const db = event.target.result;

  // === 添加 ===
  const tx = db.transaction('notes', 'readwrite');
  tx.objectStore('notes').add({
    id: '001',
    title: '我的笔记',
    content: '笔记内容',
    updatedAt: Date.now(),
  });

  // === 查询 ===
  const readTx = db.transaction('notes');
  const getReq = readTx.objectStore('notes').get('001');
  getReq.onsuccess = () => console.log(getReq.result);

  // === 更新 ===
  const updateTx = db.transaction('notes', 'readwrite');
  updateTx.objectStore('notes').put({
    id: '001',
    title: '更新后的标题',
    content: '更新后的内容',
    updatedAt: Date.now(),
  });

  // === 删除 ===
  const deleteTx = db.transaction('notes', 'readwrite');
  deleteTx.objectStore('notes').delete('001');
};
```

### 4.4 游标遍历与范围查询

```javascript
// 遍历所有记录
const tx = db.transaction('notes');
const store = tx.objectStore('notes');
const request = store.openCursor();

request.onsuccess = (event) => {
  const cursor = event.target.result;
  if (cursor) {
    console.log(cursor.value);
    cursor.continue(); // 下一条
    // cursor.advance(10); // 跳 10 条
  }
};

// 范围查询（IDBKeyRange）
const range = IDBKeyRange.bound('2024-01-01', '2024-12-31');
const indexRequest = store.index('updatedAt').openCursor(range, 'prev');

// 其他范围
IDBKeyRange.lowerBound(100);        // >= 100
IDBKeyRange.upperBound(200);        // <= 200
IDBKeyRange.only('exact');          // = 'exact'
IDBKeyRange.bound(a, b, true, true); // a < x < b（开区间）
```

### 4.5 Promise 封装最佳实践

```javascript
class DB {
  constructor(name, version) {
    this.name = name;
    this.version = version;
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, this.version);

      req.onupgradeneeded = (e) => this.onUpgrade(e.target.result);

      req.onsuccess = (e) => {
        this.db = e.target.result;
        this.db.onclose = () => { this.db = null; this.init(); };
        resolve(this.db);
      };

      req.onerror = () => reject(req.error);
    });
  }

  async get(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName);
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName);
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, data) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
```

---

## 五、Web App Manifest

### 5.1 什么是 Manifest？

Manifest 是一个 JSON 文件，告诉浏览器如何表现 PWA：

```json
{
  "name": "OfflineNotes - 离线笔记",
  "short_name": "OfflineNotes",
  "description": "离线可用的笔记应用",
  "start_url": "./index.html",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#F8FAFC",
  "theme_color": "#4F46E5",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 5.2 关键字段说明

| 字段 | 说明 | 示例值 |
|------|------|--------|
| `name` | 完整应用名 | "OfflineNotes" |
| `short_name` | 短名（桌面图标） | "Notes" |
| `start_url` | 启动 URL | "/index.html" |
| `display` | 显示模式 | standalone / fullscreen / minimal-ui |
| `theme_color` | 主题色（任务栏/状态栏） | "#4F46E5" |
| `background_color` | 启动画面背景色 | "#F8FAFC" |
| `icons` | 应用图标（至少 192+512） | [...] |
| `categories` | 应用分类 | ["productivity"] |
| `lang` | 语言 | "zh-CN" |

### 5.3 display 模式对比

```
┌─────────────────────────────────────────────────┐
│  fullscreen    │  全屏，无浏览器 UI              │
├─────────────────────────────────────────────────┤
│  standalone    │  独立窗口，无地址栏 ← 推荐       │
├─────────────────────────────────────────────────┤
│  minimal-ui    │  独立窗口，有最小浏览器控件       │
├─────────────────────────────────────────────────┤
│  browser       │  普通浏览器标签页               │
└─────────────────────────────────────────────────┘
```

---

## 六、高级特性

### 6.1 Background Sync（后台同步）

```javascript
// 主线程：注册同步任务
navigator.serviceWorker.ready.then(reg => {
  return reg.sync.register('sync-notes');
});

// SW：处理同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncPendingOperations());
  }
});

async function syncPendingOperations() {
  const pending = await getPendingOperations();
  for (const op of pending) {
    try {
      await sendToServer(op);
      await markAsSynced(op.id);
    } catch {
      // 失败会重试，浏览器自动调度
    }
  }
}
```

### 6.2 Push Notification（推送通知）

```javascript
// 请求权限
const permission = await Notification.requestPermission();

// 订阅推送
navigator.serviceWorker.ready.then(async (reg) => {
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // 发送到服务器保存
  await saveSubscription(subscription);
});

// SW：处理推送
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge.png',
      tag: 'unique-tag',
      data: { url: data.url },
    })
  );
});

// 点击通知
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

### 6.3 Periodic Background Sync（定期后台同步）

```javascript
// 注册定期同步（需要用户交互后才能使用）
navigator.serviceWorker.ready.then(async (reg) => {
  await reg.periodicSync.register('fetch-updates', {
    minInterval: 24 * 60 * 60 * 1000, // 每天
  });
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'fetch-updates') {
    event.waitUntil(fetchAndCacheUpdates());
  }
});
```

### 6.4 离线页面

```javascript
// 预缓存离线页面
const OFFLINE_PAGE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('static-v1').then(cache =>
      cache.addAll(['/index.html', OFFLINE_PAGE])
    )
  );
});

// 导航请求失败时返回离线页面
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_PAGE))
    );
  }
});
```

---

## 七、性能优化策略

### 7.1 缓存策略选择决策树

```
请求类型？
├─ 静态资源（CSS/JS/图片）
│   └─→ Cache-First + 版本控制
│
├─ HTML 页面
│   └─→ Network-First（确保最新）
│
├─ API 数据
│   ├─ 实时性要求高 → Network-First
│   └─ 可容忍延迟 → Stale-While-Revalidate
│
└─ 用户生成内容
    └─→ IndexedDB 本地 + Background Sync
```

### 7.2 首屏优化

```
首次访问：
  HTML → 网络请求（必须）
  CSS  → Service Worker 缓存（预缓存）
  JS   → Service Worker 缓存（预缓存）
  图片 → 懒加载

后续访问：
  全部 → 缓存命中（< 100ms）
```

### 7.3 缓存预热

```javascript
// 空闲时预缓存下一页资源
self.addEventListener('activate', () => {
  // 使用 Idle Deadline API
  self.addEventListener('message', (event) => {
    if (event.data.type === 'PREFETCH') {
      event.waitUntil(
        caches.open('prefetch').then(cache =>
          cache.addAll(event.data.urls)
        )
      );
    }
  });
});

// 主线程：空闲时触发预取
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    navigator.serviceWorker.controller.postMessage({
      type: 'PREFETCH',
      urls: ['/page2.html', '/page2.css'],
    });
  });
}
```

---

## 八、调试与测试

### 8.1 Chrome DevTools 调试

```
Application 面板：
├─ Service Workers
│   ├─ 查看状态（activated/running/stopped）
│   ├─ Update（强制更新）
│   ├─ Skip Waiting（跳过等待）
│   ├─ Unregister（注销）
│   └─ Offline（模拟离线）
│
├─ Cache Storage
│   ├─ 查看/删除缓存
│   └─ 手动添加/修改缓存条目
│
├─ IndexedDB
│   ├─ 查看数据库/对象仓库
│   ├─ 浏览/编辑/删除数据
│   └─ 执行查询
│
└─ Manifest
    ├─ 验证 Manifest 文件
    └─ 查看安装状态
```

### 8.2 Lighthouse PWA 审计

```
Lighthouse PWA 检查项：
✅ 页面在离线时显示自定义内容
✅ 页面在 HTTP 上重定向到 HTTPS
✅ 页面有有效的 manifest
✅ 页面有 service worker
✅ 地址栏颜色与 theme_color 匹配
✅ iOS 元标签已设置
✅ 当前 URL 在 SPAs 中可恢复
✅ 内容未使用不推荐 API
```

### 8.3 自动化测试

```javascript
// 测试 Service Worker 注册
describe('Service Worker', () => {
  it('should register successfully', async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    expect(registration).toBeDefined();
    expect(registration.active.state).toBe('activated');
  });

  it('should handle offline requests', async () => {
    // 模拟离线
    await page.setOfflineMode(true);
    const response = await page.goto('/');
    expect(response.status()).toBe(200);
  });
});

// 测试 IndexedDB
describe('IndexedDB', () => {
  it('should store and retrieve notes', async () => {
    const db = await initDB('TestDB', 1);
    await addNote(db, { id: '1', title: 'Test' });
    const note = await getNote(db, '1');
    expect(note.title).toBe('Test');
  });
});
```

---

## 九、本项目技术总结

### 9.1 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    OfflineNotes PWA                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐    ┌───────────┐    ┌──────────────────┐  │
│  │ index.html│──→│  app.js   │──→│  db.js (IndexedDB)│  │
│  │ + manifest│   │  (UI逻辑) │   │  • notes 仓库     │  │
│  └──────────┘   └─────┬─────┘   │  • syncQueue 仓库 │  │
│                       │         └──────────────────┘  │
│                       │                                │
│              ┌────────┴────────┐                       │
│              │  Service Worker  │                       │
│              │  (sw.js)        │                       │
│              │                 │                       │
│              │  • Cache-First  │──→ Cache API          │
│              │  • Network-First│    (static + dynamic) │
│              │  • Background   │                       │
│              │    Sync         │                       │
│              │  • Push Notify  │                       │
│              └─────────────────┘                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 9.2 核心技术点清单

| 技术 | 在本项目中的应用 | 关键代码位置 |
|------|-----------------|-------------|
| Service Worker 注册 | PWA 入口 | `app.js` → `registerSW()` |
| install 事件 | 预缓存静态资源 | `sw.js` → install handler |
| activate 事件 | 清理旧缓存 | `sw.js` → activate handler |
| fetch 拦截 | 根据请求类型选择策略 | `sw.js` → fetch handler |
| Cache-First | 静态资源缓存 | `sw.js` → `cacheFirst()` |
| Network-First | API/HTML 缓存 | `sw.js` → `networkFirst()` |
| Cache API | 两层缓存分离 | `sw.js` → STATIC/DYNAMIC_CACHE |
| IndexedDB 初始化 | 创建对象仓库+索引 | `db.js` → `init()` |
| IndexedDB CRUD | 笔记增删改查 | `db.js` → addNote/updateNote/deleteNote |
| IndexedDB 索引 | 按更新时间排序 | `db.js` → `getAllNotes()` |
| IndexedDB 搜索 | 全文模糊搜索 | `db.js` → `searchNotes()` |
| 同步队列 | 离线操作暂存 | `db.js` → `_addToSyncQueue()` |
| Background Sync | 网络恢复后同步 | `sw.js` → sync event |
| 消息通信 | SW ↔ 主线程 | `sw.js` → message event |
| Web App Manifest | 可安装配置 | `manifest.json` |
| 在线/离线检测 | UI 状态反馈 | `app.js` → `initOnlineStatus()` |
| PWA 安装 | 安装提示 | `app.js` → `initInstallPrompt()` |

### 9.3 代码统计

| 文件 | 行数 | 功能 |
|------|------|------|
| `sw.js` | ~200 | Service Worker 核心逻辑 |
| `db.js` | ~280 | IndexedDB 封装层 |
| `app.js` | ~300 | 应用主逻辑 |
| `styles.css` | ~280 | 样式系统 |
| `index.html` | ~80 | 页面结构 |
| `manifest.json` | ~30 | PWA 配置 |
| **总计** | **~1170 行** | **完整离线 PWA** |

---

## 十、扩展方向

### 10.1 可以进一步实现的功能

1. **冲突解决策略** — 离线编辑 vs 在线编辑的合并逻辑
2. **增量同步** — 只同步变更的数据，减少带宽
3. **加密存储** — 敏感数据在 IndexedDB 中加密
4. **Web Share API** — 离线分享笔记
5. **File System Access API** — 导出/导入笔记文件
6. **Web Locks API** — 多标签页数据一致性
7. **Content Index API** — 离线内容发现
8. **Badging API** — 未读计数显示在图标上

### 10.2 生产环境注意事项

- ✅ 强制 HTTPS
- ✅ 缓存版本管理（避免旧缓存）
- ✅ 缓存容量监控（避免超限）
- ✅ 错误边界处理（SW 崩溃不影响页面）
- ✅ 性能监控（缓存命中率）
- ✅ 渐进增强（不支持 SW 时降级）

---

## 附录：关键 API 速查

```javascript
// Service Worker
navigator.serviceWorker.register('/sw.js')
navigator.serviceWorker.getRegistration()
self.skipWaiting()
self.clients.claim()
event.waitUntil(promise)

// Cache API
caches.open(name)
cache.add(url) / cache.addAll(urls)
cache.put(request, response)
cache.match(request)
cache.delete(request)
caches.keys() / caches.delete(name)

// IndexedDB
indexedDB.open(name, version)
db.createObjectStore(name, options)
store.createIndex(name, keyPath, options)
db.transaction(storeName, mode)
store.add(data) / store.put(data)
store.get(key) / store.getAll()
store.delete(key) / store.clear()
index.openCursor(range, direction)
IDBKeyRange.bound(lower, upper)

// Online/Offline
navigator.onLine
window.addEventListener('online', handler)
window.addEventListener('offline', handler)

// Push & Sync
registration.sync.register(tag)
registration.showNotification(title, options)
registration.pushManager.subscribe(options)
```

---

*专项 19 完成 ✅ — 离线优先 PWA 完整实现*
