# PWA 离线优先专项训练 — Service Worker / Cache API / IndexedDB

> 构建一个完全离线可用的任务管理 PWA：OfflineTasks

---

## 一、PWA 核心概念

### 1.1 什么是 PWA？

Progressive Web App（渐进式 Web 应用）= Web 技术 + 原生应用体验

**三大特征：**
- **Reliable（可靠）** — 离线可用，瞬间加载（Service Worker + Cache API）
- **Fast（快速）** — 流畅交互，60fps 动画
- **Engaging（沉浸）** — 可安装，推送通知，全屏模式

### 1.2 PWA 技术栈

| 技术 | 作用 | 浏览器支持 |
|------|------|-----------|
| **manifest.json** | 应用元数据（名称/图标/主题色） | 93%+ |
| **Service Worker** | 离线缓存/后台同步/推送通知 | 95%+ |
| **Cache API** | 请求级缓存存储 | 94%+ |
| **IndexedDB** | 客户端结构化数据存储 | 95%+ |
| **Push API** | 推送通知 | 90%+ |
| **Background Sync** | 离线操作队列，联网后自动同步 | 88%+ |
| **Web Share API** | 调用系统分享 | 85%+ |

### 1.3 PWA 安装条件

浏览器自动检测以下条件，满足后触发 `beforeinstallprompt`：

1. ✅ 有效的 `manifest.json`（name/icons/start_url/display）
2. ✅ Service Worker 已注册并激活
3. ✅ HTTPS 环境（localhost 除外）
4. ✅ `display` 为 `standalone`/`fullscreen`/`minimal-ui`

---

## 二、manifest.json — 应用清单

```json
{
  "name": "OfflineTasks — 离线任务管理器",
  "short_name": "OfflineTasks",
  "description": "完全离线可用的任务管理 PWA",
  "start_url": "./index.html",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "categories": ["productivity"],
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

### 关键字段说明

| 字段 | 必须 | 说明 |
|------|------|------|
| `name` | ✅ | 完整应用名称 |
| `short_name` | ✅ | 桌面图标名称 |
| `start_url` | ✅ | 启动 URL |
| `display` | ✅ | `standalone`（隐藏浏览器 UI） |
| `icons` | ✅ | 至少 192x192 + 512x512 |
| `theme_color` | ✅ | 任务栏/状态栏颜色 |
| `background_color` | 推荐 | 启动画面背景色 |
| `orientation` | 可选 | `any`/`portrait`/`landscape` |
| `categories` | 可选 | 应用分类 |

### HTML 中引用

```html
<link rel="manifest" href="./manifest.json">
<meta name="theme-color" content="#3b82f6">
<!-- iOS 兼容 -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="OfflineTasks">
```

---

## 三、Service Worker — 离线核心

### 3.1 生命周期

```
安装 (install) → 激活 (activate) → 运行 (running) → 终止 (terminated)
     ↓                ↓
  预缓存          清理旧缓存
  skipWaiting     clients.claim()
```

**关键事件：**

| 事件 | 触发时机 | 典型用途 |
|------|---------|---------|
| `install` | SW 首次注册或版本更新 | 预缓存静态资源 |
| `activate` | SW 激活，开始控制页面 | 清理旧缓存 |
| `fetch` | 任何网络请求 | 缓存策略路由 |
| `message` | 客户端发消息 | 双向通信 |
| `sync` | Background Sync 触发 | 离线操作同步 |
| `push` | 推送通知到达 | 显示通知 |

### 3.2 注册 Service Worker

```javascript
async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('浏览器不支持 SW');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('./sw.js', {
      scope: './'
    });

    // 监听更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // 新版本可用，提示用户刷新
          showUpdateBanner();
        }
      });
    });

    // 请求后台同步
    if ('sync' in registration) {
      await registration.sync.register('sync-tasks');
    }
  } catch (err) {
    console.error('SW 注册失败:', err);
  }
}
```

### 3.3 三大缓存策略

#### 策略 1：Cache-First（缓存优先）

```javascript
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match('/offline-fallback.html');
  }
}
```

**适用：** 静态资源（JS/CSS/HTML/字体）
**特点：** 最快响应，完全离线可用

#### 策略 2：Network-First（网络优先）

```javascript
async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      trimCache(DYNAMIC_CACHE, 50);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response(JSON.stringify({ error: '离线' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

**适用：** API 数据
**特点：** 优先获取最新数据，离线时回退缓存

#### 策略 3：Stale-While-Revalidate（缓存+后台更新）

```javascript
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response.clone();
    })
    .catch(() => null);

  if (cached) {
    fetchPromise.then(fresh => {
      if (fresh) broadcastMessage({ type: 'DATA_UPDATED' });
    });
    return cached; // 立即返回缓存
  }

  return fetchPromise || caches.match('/offline-fallback.html');
}
```

**适用：** 通用资源
**特点：** 快速响应 + 后台刷新

### 3.4 Fetch 路由

```javascript
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  if (/\.(js|css|html|json|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
  } else if (/\.(png|jpg|svg|webp)$/.test(url.pathname)) {
    event.respondWith(cacheFirstWithBackgroundUpdate(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
```

### 3.5 缓存版本管理

```javascript
const APP_VERSION = 'v2';
const STATIC_CACHE = `offlinetasks-static-${APP_VERSION}`;
const DYNAMIC_CACHE = `offlinetasks-dynamic-${APP_VERSION}`;

// activate 时清理旧版本
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names.filter(n => !n.includes(APP_VERSION))
             .map(n => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});
```

### 3.6 Background Sync — 离线操作队列

```javascript
// 客户端：注册同步任务
navigator.serviceWorker.ready.then(reg => {
  return reg.sync.register('sync-tasks');
});

// Service Worker：处理同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncPendingOperations());
  }
});

async function syncPendingOperations() {
  // 从 IndexedDB 读取待同步操作
  // 逐个发送到服务器
  // 标记成功/失败
}
```

### 3.7 Push 通知

```javascript
// 客户端：请求权限 + 订阅
const permission = await Notification.requestPermission();
if (permission === 'granted') {
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });
  // 发送 subscription 到服务器
}

// Service Worker：接收推送
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: '通知', body: '新消息' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge.png',
      tag: 'unique-tag',
      requireInteraction: true,
      actions: [
        { action: 'view', title: '查看' },
        { action: 'dismiss', title: '忽略' }
      ],
      data: { url: '/target-page' }
    })
  );
});

// 通知点击
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length > 0) clients[0].focus();
      else self.clients.openWindow(event.notification.data.url);
    })
  );
});
```

### 3.8 客户端 ↔ SW 通信

```javascript
// 客户端 → SW
navigator.serviceWorker.controller.postMessage({
  type: 'CACHE_URLS',
  payload: ['/api/data', '/api/users']
});

// SW → 客户端
self.clients.matchAll().then(clients => {
  clients.forEach(client => client.postMessage({ type: 'DATA_UPDATED' }));
});

// 客户端监听
navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data.type === 'DATA_UPDATED') refreshUI();
});
```

---

## 四、Cache API — 请求级缓存

### 4.1 基本操作

```javascript
// 打开缓存
const cache = await caches.open('my-cache-v1');

// 添加（自动发起请求）
await cache.add('/index.html');
await cache.addAll(['/app.js', '/styles.css', '/icon.png']);

// 手动 put（已有 Response 对象）
const response = await fetch('/api/data');
await cache.put('/api/data', response.clone());

// 匹配
const cached = await cache.match('/index.html');

// 删除
await cache.delete('/old-resource');

// 获取所有 keys
const requests = await cache.keys();

// 删除整个缓存
await caches.delete('my-cache-v1');
```

### 4.2 缓存大小限制

```javascript
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map(key => cache.delete(key)));
  }
}
```

### 4.3 Cache API vs IndexedDB 对比

| 特性 | Cache API | IndexedDB |
|------|-----------|-----------|
| 存储内容 | Request/Response 对 | 任意结构化数据 |
| 查询能力 | 按 URL 匹配 | 索引 + 游标 + 范围查询 |
| 事务 | 无 | 完整事务支持 |
| 适用场景 | HTTP 响应缓存 | 应用数据持久化 |
| 容量 | 通常 50MB+ | 通常 2GB+ |

---

## 五、IndexedDB — 结构化数据存储

### 5.1 核心概念

```
Database (数据库)
  └── ObjectStore (对象仓库 ≈ 表)
       ├── keyPath (主键路径)
       ├── Index (索引)
       │    └── cursor (游标)
       └── Transaction (事务)
            ├── readonly
            ├── readwrite
            └── versionchange
```

### 5.2 数据库初始化

```javascript
function openDB(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 创建对象仓库
      if (!db.objectStoreNames.contains('tasks')) {
        const store = db.createObjectStore('tasks', { keyPath: 'id' });
        // 创建索引
        store.createIndex('status', 'status', { multiEntry: false });
        store.createIndex('priority', 'priority', { multiEntry: false });
        store.createIndex('dueDate', 'dueDate', { multiEntry: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

### 5.3 增删改查

```javascript
// 创建
async function addTask(db, task) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const request = store.add(task);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 读取单个
async function getTask(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readonly');
    const store = tx.objectStore('tasks');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 更新
async function updateTask(db, id, updates) {
  return new Promise(async (resolve, reject) => {
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const existing = await new Promise(r => {
      const req = store.get(id);
      req.onsuccess = () => r(req.result);
    });
    if (!existing) throw new Error('Not found');

    const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };
    const request = store.put(updated);
    request.onsuccess = () => resolve(updated);
    request.onerror = () => reject(request.error);
  });
}

// 删除
async function deleteTask(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}
```

### 5.4 索引查询（高效筛选）

```javascript
// 使用索引查询（而非全表扫描后内存筛选）
async function getTasksByStatus(db, status) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readonly');
    const store = tx.objectStore('tasks');
    const index = store.index('status'); // 使用索引
    const request = index.getAll(status);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 范围查询
async function getTasksByDateRange(db, startDate, endDate) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readonly');
    const store = tx.objectStore('tasks');
    const index = store.index('dueDate');
    const range = IDBKeyRange.bound(startDate, endDate);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 游标遍历（大数据量）
async function iterateTasks(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readonly');
    const store = tx.objectStore('tasks');
    const results = [];
    const request = store.openCursor();

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
```

### 5.5 复合索引技巧

```javascript
// 方案 1：组合键（适合简单场景）
store.createIndex('status_priority', ['status', 'priority'], { multiEntry: false });
// 查询：index.get(['todo', 'high'])

// 方案 2：复合字符串键
// 存储时：task.searchKey = `${status}__${priority}`
store.createIndex('searchKey', 'searchKey', { multiEntry: false });

// 方案 3：内存筛选（数据量小时）
// 先按主索引获取，再在内存中二次筛选
```

---

## 六、OfflineTasks 完整实现解析

### 6.1 项目结构

```
pwa-offline-tasks-1900/
├── index.html           # 入口页面（PWA meta + UI 结构）
├── styles.css           # 暗色主题 + 响应式样式
├── manifest.json        # PWA 应用清单
├── sw.js                # Service Worker（缓存策略 + 同步 + 推送）
├── db.js                # IndexedDB 封装（CRUD + 索引 + 同步队列）
├── app.js               # 应用主逻辑（UI 渲染 + 事件绑定）
└── offline-fallback.html # 离线回退页面
```

### 6.2 数据流

```
用户操作
  ↓
app.js (事件处理)
  ↓
db.js (IndexedDB CRUD)
  ↓
addToSyncQueue (离线操作入队)
  ↓
requestBackgroundSync (注册同步)
  ↓
sw.js (fetch 拦截 + sync 事件)
  ↓
联网后自动同步到服务器
```

### 6.3 离线体验保障

| 场景 | 保障机制 |
|------|---------|
| 首次加载 | Service Worker install 预缓存所有静态资源 |
| 离线浏览 | Cache-First 策略 + IndexedDB 本地数据 |
| 离线操作 | IndexedDB 写入 + syncQueue 记录操作 |
| 恢复联网 | Background Sync 自动同步 + online 事件触发 |
| 数据备份 | exportData 导出 JSON / importData 导入合并 |
| 版本更新 | SW activate 清理旧缓存 + skipWaiting 立即生效 |

---

## 七、PWA 最佳实践

### 7.1 缓存策略选择决策树

```
是什么类型的资源？
├── 静态资源 (JS/CSS/HTML/字体) → Cache-First
├── API 数据 (JSON) → Network-First
├── 图片/媒体 → Cache-First + Background Update
├── HTML 页面 → Stale-While-Revalidate
└── 其他 → Stale-While-Revalidate
```

### 7.2 性能优化

1. **预缓存关键资源** — install 阶段缓存首屏必需文件
2. **按需缓存** — 非关键资源首次访问时缓存
3. **缓存限额** — trimCache 防止无限增长
4. **版本控制** — 缓存名包含版本号，activate 时清理
5. **skipWaiting + clients.claim** — 更新立即生效

### 7.3 安全注意事项

1. **HTTPS 必需** — SW 仅在安全上下文运行
2. **CSP 配合** — 配置 `script-src 'self'` 等策略
3. **数据验证** — importData 时验证数据格式和版本
4. **XSS 防护** — 渲染时 escapeHtml 转义
5. **索引安全** — 敏感数据不创建索引

### 7.4 调试技巧

```javascript
// Chrome DevTools → Application → Service Workers
// - 查看 SW 状态
// - 强制更新
// - 离线模式模拟
// - 查看缓存内容
// - 查看 IndexedDB 数据

// 常用调试代码
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('SW 状态:', reg.active?.state);
  console.log('作用域:', reg.scope);
});

// 查看缓存
caches.keys().then(names => console.log('缓存列表:', names));
```

---

## 八、面试高频考点

### Q1: Service Worker 和 Web Worker 有什么区别？

| 特性 | Service Worker | Web Worker |
|------|---------------|------------|
| 生命周期 | 独立于页面，可被终止重启 | 跟随创建它的页面 |
| 网络拦截 | ✅ 可拦截 fetch 请求 | ❌ |
| 推送通知 | ✅ | ❌ |
| DOM 访问 | ❌ | ❌ |
| 典型用途 | 离线缓存/推送/同步 | 计算密集型任务 |

### Q2: 三种缓存策略的适用场景？

- **Cache-First**：静态资源，追求速度和离线可用
- **Network-First**：API 数据，追求数据新鲜度
- **Stale-While-Revalidate**：平衡速度和新鲜度

### Q3: IndexedDB 和 localStorage 的区别？

| 特性 | IndexedDB | localStorage |
|------|-----------|-------------|
| 数据类型 | 任意结构化数据 | 仅字符串 |
| 容量 | 2GB+ | ~5MB |
| 异步 | ✅ | ❌（同步阻塞） |
| 事务 | ✅ | ❌ |
| 索引 | ✅ | ❌ |
| 适用场景 | 大量结构化数据 | 简单配置/偏好 |

### Q4: 如何实现离线数据同步？

1. 离线时将操作记录到 syncQueue（IndexedDB）
2. 使用 Background Sync API 注册同步事件
3. 联网后 SW 触发 sync 事件
4. 按 FIFO 顺序执行队列中的操作
5. 失败时重试（指数退避），超过最大次数标记失败

### Q5: PWA 安装横幅如何触发和控制？

```javascript
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // 阻止自动弹出
  deferredPrompt = e; // 保存事件
  showInstallButton(); // 显示自定义安装按钮
});

installButton.addEventListener('click', async () => {
  deferredPrompt.prompt(); // 显示安装对话框
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
});
```

---

## 九、自测题

### 基础题

1. PWA 的三个核心特征是什么？
2. manifest.json 中哪些字段是必须的？
3. Service Worker 的生命周期有哪几个阶段？
4. Cache API 和 IndexedDB 分别适合存储什么？

### 进阶题

5. 如何实现"离线编辑，联网自动同步"？
6. Service Worker 更新后如何让用户无感知地切换到新版本？
7. 如何处理 IndexedDB 数据库版本升级？
8. Background Sync 和 Periodic Background Sync 的区别？

### 实战题

9. 设计一个离线优先的笔记应用的数据流
10. 实现一个支持断点续传的文件上传 PWA

---

## 十、累计 PWA 训练

- **4/25** 基础版 — PWA 概念 + manifest + SW 入门
- **4/28** 完整实现 — OfflineTasks 离线任务管理器（首次实现）
- **4/29** 修复增强 — P0 问题修复 + styles.css + offline-fallback + 完整文档

**闭环状态：** ✅ 完整闭环

---

## 附录：本次修复的 P0 问题

| # | 问题 | 修复方案 |
|---|------|---------|
| 1 | sw.js 双 message 事件监听器覆盖 | 删除重复的空监听器 |
| 2 | push 通知 icon/badge 使用 manifest.json（错误类型） | 改为 SVG data URI |
| 3 | importData 存在数据覆盖风险 | 增加 merge/overwrite 策略 + updatedAt 比较 |
| 4 | styles.css 缺失 | 完整实现暗色主题 + 响应式样式 |
| 5 | offline-fallback.html 缺失 | 创建离线回退页面 |
