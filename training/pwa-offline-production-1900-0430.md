# PWA 生产级离线优先 — 高级实战

> 专项训练 19 — 第三轮迭代（4/25 基础 → 4/28 完整实现 → 4/29 修复增强 → 4/30 生产级进阶）
> 目标：生产级 PWA 架构 — 高级缓存策略 / 增量同步 / 性能优化 / 可访问性 / 测试

---

## 一、从 Demo 到生产：差距在哪

### 1.1 常见 PWA 生产问题

| 问题 | Demo 做法 | 生产做法 |
|------|-----------|---------|
| 缓存策略 | 全局 Cache-First | 按路由/资源类型精细路由 |
| 数据同步 | 简单队列 | 冲突检测 + 版本向量 + 增量同步 |
| 离线体验 | 显示离线页面 | 渐进降级 + 骨架屏 + 操作排队 |
| 更新机制 | 手动刷新 | 静默更新 + 优雅提示 + 版本迁移 |
| 性能 | 无优化 | 首屏 < 1s + Lighthouse 95+ |
| 可访问性 | 无 | WCAG 2.1 AA + 键盘导航 + 屏幕阅读器 |
| 测试 | 无 | E2E 离线测试 + 回归检测 |
| 安全 | 无 | CSP + Subresource Integrity + 数据加密 |

### 1.2 生产级 PWA 架构全景

```
┌─────────────────────────────────────────────────────────────┐
│                    用户浏览器                               │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  UI 层   │  │  数据层      │  │  基础设施层           │ │
│  │          │  │              │  │                       │ │
│  │ • 骨架屏 │  │ • IndexedDB  │  │ • Service Worker      │ │
│  │ • 离线UI │  │   (CRUD)     │  │   (多策略路由)        │ │
│  │ • 状态   │  │ • SyncQueue  │  │ • Background Sync     │ │
│  │   指示器 │  │   (增量同步)  │  │ • Periodic Sync       │ │
│  │ • 操作   │  │ • Conflict   │  │ • Push Manager        │ │
│  │   队列   │  │   Detector   │  │ • Cache API (分层)    │ │
│  │ • 可访问 │  │ • Version    │  │ • Web Push            │ │
│  │   性层   │  │   Vector     │  │                       │ │
│  └────┬─────┘  └──────┬───────┘  └───────────┬───────────┘ │
│       │               │                      │             │
│       └───────────────┼──────────────────────┘             │
│                       │                                    │
│              ┌────────┴────────┐                           │
│              │  网络适配层     │                           │
│              │                 │                           │
│              │ • Online/Offline│                           │
│              │   检测          │                           │
│              │ • 带宽检测      │                           │
│              │ • 连接质量      │                           │
│              │ • 智能降级      │                           │
│              └────────┬────────┘                           │
│                       │                                    │
└───────────────────────┼────────────────────────────────────┘
                        │
              ┌─────────┴─────────┐
              │    服务端 API      │
              │  (REST/GraphQL)   │
              └───────────────────┘
```

---

## 二、高级缓存策略 — 分层缓存架构

### 2.1 五层缓存策略

```javascript
// 分层缓存：不同资源不同策略，精确控制
const CACHE_LAYERS = {
  // Layer 1: 关键资源 — 预缓存，永不失效
  PRECACHE:   'app-precache-v3',
  // Layer 2: 静态资源 — Cache-First + 版本更新
  STATIC:     'app-static-v3',
  // Layer 3: API 数据 — Network-First + TTL
  API:        'app-api-v3',
  // Layer 4: 媒体资源 — Cache-First + 后台更新
  MEDIA:      'app-media-v3',
  // Layer 5: 第三方资源 — Stale-While-Revalidate
  THIRD_PARTY:'app-third-party-v3',
};

const CACHE_TTL = {
  API: 5 * 60 * 1000,      // 5 分钟
  MEDIA: 24 * 60 * 60 * 1000, // 24 小时
  THIRD_PARTY: 7 * 24 * 60 * 60 * 1000, // 7 天
};
```

### 2.2 带 TTL 的 Network-First 策略

```javascript
// 生产级 Network-First：支持 TTL 过期 + 后台刷新 + 降级
async function networkFirstWithTTL(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const now = Date.now();

  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      // 添加时间戳元数据
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('X-Cache-Timestamp', String(now));
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      });
      await cache.put(request, cachedResponse);
    }
    return response;
  } catch (err) {
    // 网络失败，尝试从缓存返回
    if (cached) {
      const timestamp = cached.headers.get('X-Cache-Timestamp');
      const age = now - (timestamp ? Number(timestamp) : 0);

      if (!ttl || age < ttl) {
        // 缓存未过期，直接返回
        return cached;
      } else {
        // 缓存过期但网络失败，返回过期缓存 + 标记
        const fallback = cached.clone();
        fallback.headers.set('X-Cache-Expired', 'true');
        return fallback;
      }
    }
    // 无缓存，返回降级响应
    return new Response(JSON.stringify({
      error: 'OFFLINE_NO_CACHE',
      message: '离线且无缓存数据',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

### 2.3 智能路由 — 按请求特征选择策略

```javascript
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 非 GET 请求不拦截
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  event.respondWith(routeRequest(request, url));
});

async function routeRequest(request, url) {
  // 1. 预缓存资源（HTML 入口）
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return cacheFirst(request, CACHE_LAYERS.PRECACHE);
  }

  // 2. 静态资源（JS/CSS/字体）— 版本化预缓存
  if (/\.(js|css|woff2?)$/.test(url.pathname)) {
    return cacheFirst(request, CACHE_LAYERS.STATIC);
  }

  // 3. API 请求 — Network-First + TTL
  if (url.pathname.startsWith('/api/')) {
    return networkFirstWithTTL(request, CACHE_LAYERS.API, CACHE_TTL.API);
  }

  // 4. 图片/媒体 — Cache-First + 后台更新
  if (/\.(png|jpg|jpeg|svg|webp|gif|ico)$/.test(url.pathname)) {
    return cacheFirstWithBackgroundRefresh(request, CACHE_LAYERS.MEDIA, CACHE_TTL.MEDIA);
  }

  // 5. 第三方 CDN — Stale-While-Revalidate
  if (url.hostname !== self.location.hostname) {
    return staleWhileRevalidate(request, CACHE_LAYERS.THIRD_PARTY);
  }

  // 6. 其他 HTML — Stale-While-Revalidate
  if (request.headers.get('accept')?.includes('text/html')) {
    return staleWhileRevalidate(request, CACHE_LAYERS.API);
  }

  // 7. 默认回退
  return networkFirstWithTTL(request, CACHE_LAYERS.API, null);
}

// Cache-First + 后台刷新（图片优化）
async function cacheFirstWithBackgroundRefresh(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    const timestamp = cached.headers.get('X-Cache-Timestamp');
    const age = Date.now() - (timestamp ? Number(timestamp) : 0);

    // 后台刷新（不阻塞响应）
    if (!ttl || age > ttl) {
      fetch(request.clone()).then(resp => {
        if (resp.ok) cache.put(request, resp.clone());
      }).catch(() => {});
    }
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    // 图片离线回退：返回占位图
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
        <rect fill="#1e293b" width="200" height="200"/>
        <text fill="#64748b" x="50%" y="50%" text-anchor="middle" dy=".3em">
          离线
        </text>
      </svg>`,
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}
```

### 2.4 缓存健康监控

```javascript
// 缓存大小监控 + 自动清理
async function monitorCacheHealth() {
  if (!('storage' in navigator && 'estimate' in navigator.storage)) return;

  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage || 0;
  const quota = estimate.quota || 0;
  const ratio = usage / quota;

  const health = {
    usage: Math.round(usage / 1024 / 1024),      // MB
    quota: Math.round(quota / 1024 / 1024),       // MB
    ratio: (ratio * 100).toFixed(1) + '%',
    status: ratio > 0.9 ? 'CRITICAL' : ratio > 0.7 ? 'WARNING' : 'OK',
  };

  // 超过 80% 自动清理
  if (ratio > 0.8) {
    await emergencyCacheCleanup();
  }

  return health;
}

async function emergencyCacheCleanup() {
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    if (name.includes('precache')) continue; // 不碰预缓存

    const cache = await caches.open(name);
    const keys = await cache.keys();

    // 删除超过 7 天的条目
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const request of keys) {
      const response = await cache.match(request);
      const timestamp = response?.headers?.get('X-Cache-Timestamp');
      if (timestamp && Number(timestamp) < weekAgo) {
        await cache.delete(request);
      }
    }
  }
}
```

---

## 三、增量同步 — 生产级离线数据同步

### 3.1 冲突检测策略

```javascript
/**
 * 增量同步引擎 — 支持冲突检测与自动合并
 *
 * 同步流程：
 * 1. 读取本地 syncQueue（待同步操作）
 * 2. 获取服务器最新版本号
 * 3. 逐条应用本地操作
 * 4. 冲突检测（版本向量 / Last-Write-Wins / 自定义合并）
 * 5. 应用服务器增量更新
 * 6. 更新本地版本号
 */

class SyncEngine {
  constructor(db, apiBase) {
    this.db = db;
    this.apiBase = apiBase;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * 记录本地操作到同步队列
   */
  async queueOperation(operation) {
    const tx = this.db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    const entry = {
      id: crypto.randomUUID(),
      type: operation.type,      // 'create' | 'update' | 'delete'
      entity: operation.entity,  // 'task' | 'note' | 'project'
      entityId: operation.entityId,
      data: operation.data,
      timestamp: Date.now(),
      version: operation.version || 1,
      status: 'pending',
      retries: 0,
    };
    await new Promise((resolve, reject) => {
      const req = store.add(entry);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // 尝试立即同步
    this.requestSync();
  }

  /**
   * 执行增量同步
   */
  async sync() {
    if (!navigator.onLine) return { synced: 0, reason: 'offline' };

    const tx = this.db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    const pending = await this._getAllByStatus(store, 'pending');

    let synced = 0;
    let conflicts = 0;

    for (const entry of pending) {
      try {
        const result = await this._syncEntry(entry);
        if (result.conflict) {
          conflicts++;
          await this._resolveConflict(entry, result.serverData);
        } else {
          entry.status = 'synced';
          await store.put(entry);
          synced++;
        }
      } catch (err) {
        if (entry.retries < this.maxRetries) {
          entry.retries++;
          entry.status = 'pending';
          entry.nextRetryAt = Date.now() + this.retryDelay * Math.pow(2, entry.retries);
          await store.put(entry);
        } else {
          entry.status = 'failed';
          entry.error = err.message;
          await store.put(entry);
        }
      }
    }

    // 拉取服务器增量更新
    await this._pullUpdates();

    return { synced, conflicts, total: pending.length };
  }

  /**
   * 同步单条记录
   */
  async _syncEntry(entry) {
    const url = `${this.apiBase}/${entry.entity}/${entry.entityId}`;

    switch (entry.type) {
      case 'create': {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.data),
        });
        if (resp.status === 409) {
          // 冲突：服务器上已存在
          const serverData = await resp.json();
          return { conflict: true, serverData };
        }
        return { conflict: false };
      }

      case 'update': {
        const resp = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'If-Match': `"${entry.version}"`,  // 乐观锁
          },
          body: JSON.stringify(entry.data),
        });
        if (resp.status === 412) {
          // 冲突：版本不匹配
          const serverData = await resp.json();
          return { conflict: true, serverData };
        }
        return { conflict: false };
      }

      case 'delete': {
        const resp = await fetch(url, { method: 'DELETE' });
        return { conflict: resp.status === 404 };
      }
    }
  }

  /**
   * 冲突解决：Last-Write-Wins + 字段级合并
   */
  async _resolveConflict(localEntry, serverData) {
    const localTime = localEntry.timestamp;
    const serverTime = serverData.updatedAt || serverData.createdAt;

    if (localTime > serverTime) {
      // 本地更新，强制推送
      await fetch(`${this.apiBase}/${localEntry.entity}/${localEntry.entityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localEntry.data),
      });
      const tx = this.db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      localEntry.status = 'synced';
      localEntry.resolved = 'local-wins';
      await store.put(localEntry);
    } else {
      // 服务端更新，接受服务端版本
      const tx = this.db.transaction(localEntry.entity, 'readwrite');
      const store = tx.objectStore(localEntry.entity);
      const localRecord = await this._get(store, localEntry.entityId);

      // 字段级合并：非冲突字段保留本地
      const merged = this._mergeFields(localRecord, serverData);
      await store.put(merged);

      const syncTx = this.db.transaction('syncQueue', 'readwrite');
      const syncStore = syncTx.objectStore('syncQueue');
      localEntry.status = 'synced';
      localEntry.resolved = 'server-wins';
      await syncStore.put(localEntry);
    }
  }

  /**
   * 字段级合并（保留双方非冲突修改）
   */
  _mergeFields(local, server) {
    const merged = { ...server };
    // 保留本地独有的字段
    for (const key of Object.keys(local)) {
      if (!(key in server)) {
        merged[key] = local[key];
      }
    }
    return merged;
  }

  /**
   * 拉取服务器增量更新（基于版本号）
   */
  async _pullUpdates() {
    const versionState = await this._getVersionState();
    const since = versionState.lastSyncVersion || 0;

    const resp = await fetch(`${this.apiBase}/sync?since=${since}`);
    if (!resp.ok) return;

    const updates = await resp.json();
    const tx = this.db.transaction(['tasks', 'notes', 'projects'], 'readwrite');

    for (const update of updates) {
      const store = tx.objectStore(update.entity);
      if (update.deleted) {
        await store.delete(update.entityId);
      } else {
        const existing = await new Promise(r => {
          const req = store.get(update.entityId);
          req.onsuccess = () => r(req.result);
        });

        // 仅当服务器版本更新时才覆盖
        if (!existing || (update.version > (existing.version || 0))) {
          await store.put({ ...update.data, id: update.entityId, version: update.version });
        }
      }
    }

    // 更新版本号
    if (updates.length > 0) {
      versionState.lastSyncVersion = Math.max(...updates.map(u => u.version));
      await this._saveVersionState(versionState);
    }
  }

  // 辅助方法
  _getAllByStatus(store, status) {
    return new Promise((resolve, reject) => {
      const index = store.index('status');
      const req = index.getAll(status);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  _get(store, id) {
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  _getVersionState() { /* IndexedDB 读取 */ }
  _saveVersionState(state) { /* IndexedDB 写入 */ }
  requestSync() {
    if ('sync' in navigator.serviceWorker) {
      navigator.serviceWorker.ready.then(reg =>
        reg.sync.register('incremental-sync')
      );
    }
  }
}
```

### 3.2 版本向量（Version Vector）— 分布式冲突检测

```javascript
/**
 * 版本向量：追踪每个节点的数据版本
 * 用于多设备同步时的冲突检测
 *
 * 示例：
 * { nodeA: 3, nodeB: 2, nodeC: 1 }
 * 表示：nodeA 修改了 3 次，nodeB 修改了 2 次，nodeC 修改了 1 次
 */

class VersionVector {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.vector = {};
  }

  // 递增当前节点版本
  increment() {
    this.vector[this.nodeId] = (this.vector[this.nodeId] || 0) + 1;
    return this.clone();
  }

  // 比较两个版本向量
  // 返回: 'before' | 'after' | 'concurrent' | 'equal'
  compare(other) {
    const allNodes = new Set([...Object.keys(this.vector), ...Object.keys(other.vector)]);

    let hasBefore = false;
    let hasAfter = false;

    for (const node of allNodes) {
      const a = this.vector[node] || 0;
      const b = other.vector[node] || 0;

      if (a < b) hasBefore = true;
      if (a > b) hasAfter = true;
    }

    if (hasBefore && hasAfter) return 'concurrent'; // 并发修改 = 冲突
    if (hasBefore) return 'before';
    if (hasAfter) return 'after';
    return 'equal';
  }

  // 合并两个版本向量（取每个节点的最大值）
  merge(other) {
    const merged = new VersionVector(this.nodeId);
    const allNodes = new Set([...Object.keys(this.vector), ...Object.keys(other.vector)]);

    for (const node of allNodes) {
      merged.vector[node] = Math.max(
        this.vector[node] || 0,
        other.vector[node] || 0
      );
    }
    return merged;
  }

  clone() {
    const copy = new VersionVector(this.nodeId);
    copy.vector = { ...this.vector };
    return copy;
  }

  toJSON() {
    return { nodeId: this.nodeId, vector: { ...this.vector } };
  }

  static fromJSON(json) {
    const vv = new VersionVector(json.nodeId);
    vv.vector = { ...json.vector };
    return vv;
  }
}

// 使用示例
const localVV = new VersionVector('device-1');
localVV.increment(); // { device-1: 1 }
localVV.increment(); // { device-1: 2 }

const remoteVV = VersionVector.fromJSON({
  nodeId: 'device-2',
  vector: { 'device-1': 1, 'device-2': 3 }
});

const relation = localVV.compare(remoteVV);
// 'concurrent' → 需要冲突解决
// 'before' → 本地落后，需要拉取
// 'after' → 本地更新，可以推送
```

---

## 四、生产级 Service Worker — 完整实现

### 4.1 模块化 SW 架构

```javascript
// sw.js — 生产级 Service Worker 入口
// 不使用 importScripts，直接内联核心逻辑

const APP_VERSION = '3.0.0';
const CACHE_PREFIX = `offlinetasks-${APP_VERSION}`;

// ===== 缓存层定义 =====
const LAYERS = {
  PRECACHE: `${CACHE_PREFIX}-precache`,
  STATIC: `${CACHE_PREFIX}-static`,
  API: `${CACHE_PREFIX}-api`,
  MEDIA: `${CACHE_PREFIX}-media`,
  THIRD_PARTY: `${CACHE_PREFIX}-third-party`,
};

const TTL = {
  API: 5 * 60 * 1000,
  MEDIA: 24 * 60 * 60 * 1000,
  THIRD_PARTY: 7 * 24 * 60 * 60 * 1000,
};

// ===== 预缓存资源列表 =====
const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './db.js',
  './offline-fallback.html',
  './manifest.json',
];

// ===== Install — 预缓存 =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(LAYERS.PRECACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ===== Activate — 清理旧缓存 =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => !name.startsWith(CACHE_PREFIX))
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ===== Fetch — 智能路由 =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  event.respondWith(routeRequest(request, url));
});

async function routeRequest(request, url) {
  // HTML 页面 → Stale-While-Revalidate
  if (request.headers.get('accept')?.includes('text/html')) {
    return staleWhileRevalidate(request, LAYERS.API);
  }

  // 静态资源 → Cache-First
  if (/\.(js|css|woff2?)$/.test(url.pathname)) {
    return cacheFirst(request, LAYERS.STATIC);
  }

  // API → Network-First + TTL
  if (url.pathname.startsWith('/api/')) {
    return networkFirstWithTTL(request, LAYERS.API, TTL.API);
  }

  // 图片 → Cache-First + 后台刷新
  if (/\.(png|jpg|jpeg|svg|webp|gif|ico)$/.test(url.pathname)) {
    return cacheFirstWithBackgroundRefresh(request, LAYERS.MEDIA, TTL.MEDIA);
  }

  // 第三方 → Stale-While-Revalidate
  if (url.hostname !== self.location.hostname) {
    return staleWhileRevalidate(request, LAYERS.THIRD_PARTY);
  }

  // 默认 → Network-First
  return networkFirstWithTTL(request, LAYERS.API, null);
}

// ===== 缓存策略实现 =====

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match('./offline-fallback.html');
  }
}

async function networkFirstWithTTL(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('X-Cache-Timestamp', String(Date.now()));
      await cache.put(request, new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      }));
    }
    return response;
  } catch {
    if (cached) {
      const ts = cached.headers.get('X-Cache-Timestamp');
      const age = Date.now() - (ts ? Number(ts) : 0);
      if (!ttl || age < ttl) return cached;
      // 过期但网络失败，返回过期缓存
      return cached;
    }
    return new Response(JSON.stringify({ error: 'OFFLINE' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        const headers = new Headers(response.headers);
        headers.set('X-Cache-Timestamp', String(Date.now()));
        cache.put(request, new Response(response.body, {
          status: response.status, headers,
        }));
      }
      // 通知客户端数据已更新
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'DATA_UPDATED' }));
      });
    })
    .catch(() => {});

  return cached || fetchPromise.then(() => cache.match(request))
    .then(fresh => fresh || caches.match('./offline-fallback.html'));
}

async function cacheFirstWithBackgroundRefresh(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    const ts = cached.headers.get('X-Cache-Timestamp');
    const age = Date.now() - (ts ? Number(ts) : 0);
    if (!ttl || age > ttl) {
      fetch(request.clone()).then(r => {
        if (r.ok) cache.put(request, r.clone());
      }).catch(() => {});
    }
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
        <rect fill="#1e293b" width="200" height="200"/>
        <text fill="#64748b" x="50%" y="50%" text-anchor="middle" dy=".3em">离线</text>
      </svg>`,
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

// ===== Background Sync =====
self.addEventListener('sync', (event) => {
  if (event.tag === 'incremental-sync') {
    event.waitUntil(syncPendingOperations());
  }
  if (event.tag === 'periodic-data-refresh') {
    event.waitUntil(refreshPeriodicData());
  }
});

async function syncPendingOperations() {
  // 从 IndexedDB 读取待同步操作并执行
  // 实际实现需要与主线程共享 IndexedDB
  // 这里通过 postMessage 通知主线程执行同步
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'TRIGGER_SYNC' });
  });
}

async function refreshPeriodicData() {
  // 定期后台刷新关键数据
  const urls = ['/api/tasks', '/api/notes'];
  const cache = await caches.open(LAYERS.API);

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const headers = new Headers(response.headers);
        headers.set('X-Cache-Timestamp', String(Date.now()));
        await cache.put(url, new Response(response.body, {
          status: response.status, headers,
        }));
      }
    } catch { /* 离线时静默失败 */ }
  }
}

// ===== Push 通知 =====
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: '通知', body: '新消息' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './badge.png',
      tag: data.tag || 'default',
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || [
        { action: 'view', title: '查看' },
        { action: 'dismiss', title: '忽略' },
      ],
      data: { url: data.url || './' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow(event.notification.data.url);
    })
  );
});

// ===== Message 通信 =====
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      event.waitUntil(
        caches.open(LAYERS.STATIC).then(cache => cache.addAll(payload))
      );
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then(names =>
          Promise.all(names.map(name => caches.delete(name)))
        )
      );
      break;

    case 'GET_CACHE_HEALTH':
      event.waitUntil(
        monitorCacheHealth().then(health => {
          event.source.postMessage({ type: 'CACHE_HEALTH', payload: health });
        })
      );
      break;
  }
});

// ===== 缓存健康监控 =====
async function monitorCacheHealth() {
  if (!('storage' in navigator && 'estimate' in navigator.storage)) {
    return { status: 'UNKNOWN' };
  }

  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage || 0;
  const quota = estimate.quota || 0;
  const ratio = quota > 0 ? usage / quota : 0;

  if (ratio > 0.8) await emergencyCacheCleanup();

  return {
    usageMB: Math.round(usage / 1024 / 1024),
    quotaMB: Math.round(quota / 1024 / 1024),
    ratio: (ratio * 100).toFixed(1) + '%',
    status: ratio > 0.9 ? 'CRITICAL' : ratio > 0.7 ? 'WARNING' : 'OK',
  };
}

async function emergencyCacheCleanup() {
  const names = await caches.keys();
  for (const name of names) {
    if (name.includes('precache')) continue;
    const cache = await caches.open(name);
    const keys = await cache.keys();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const req of keys) {
      const resp = await cache.match(req);
      const ts = resp?.headers?.get('X-Cache-Timestamp');
      if (ts && Number(ts) < weekAgo) await cache.delete(req);
    }
  }
}
```

---

## 五、生产级 IndexedDB 封装 — 通用数据层

### 5.1 通用 IndexedDB 类

```javascript
/**
 * ProductionDB — 生产级 IndexedDB 封装
 *
 * 特性：
 * - Promise API
 * - 事务管理
 * - 索引查询
 * - 批量操作
 * - 游标分页
 * - 数据导出/导入
 * - 版本迁移
 * - 错误恢复
 */

class ProductionDB {
  constructor(name, version, schema) {
    this.name = name;
    this.version = version;
    this.schema = schema; // { storeName: { keyPath, indexes: [] } }
    this.db = null;
    this.listeners = {};
  }

  /**
   * 打开数据库（自动升级）
   */
  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        for (const [storeName, config] of Object.entries(this.schema)) {
          let store;
          if (!db.objectStoreNames.contains(storeName)) {
            store = db.createObjectStore(storeName, {
              keyPath: config.keyPath || 'id',
              autoIncrement: config.autoIncrement || false,
            });
          } else {
            store = request.transaction.objectStore(storeName);
          }

          // 创建索引
          if (config.indexes) {
            for (const idx of config.indexes) {
              if (!store.indexNames.contains(idx.name)) {
                store.createIndex(idx.name, idx.keyPath, {
                  unique: idx.unique || false,
                  multiEntry: idx.multiEntry || false,
                });
              }
            }
          }
        }

        // 版本迁移
        if (oldVersion > 0 && this._migrations) {
          for (let v = oldVersion + 1; v <= this.version; v++) {
            if (this._migrations[v]) {
              this._migrations[v](request.transaction, db);
            }
          }
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        this._setupErrorHandling();
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 版本迁移注册
   */
  addMigration(version, migrate) {
    if (!this._migrations) this._migrations = {};
    this._migrations[version] = migrate;
  }

  /**
   * 错误处理
   */
  _setupErrorHandling() {
    this.db.onerror = (event) => {
      this._emit('error', event.target.error);
    };

    // 版本冲突
    this.db.onversionchange = () => {
      this.db.close();
      this.db = null;
      this._emit('versionchange');
    };

    // 数据库被删除
    this.db.onclose = () => {
      this.db = null;
      this._emit('close');
    };
  }

  // ===== 事件系统 =====
  on(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  off(event, handler) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(h => h !== handler);
    }
  }

  _emit(event, data) {
    (this.listeners[event] || []).forEach(h => h(data));
  }

  // ===== 基础 CRUD =====

  async add(storeName, data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

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

  async delete(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // ===== 索引查询 =====

  async getByIndex(storeName, indexName, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getRange(storeName, indexName, rangeOptions) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);

      let range;
      if (rangeOptions.lower !== undefined && rangeOptions.upper !== undefined) {
        range = IDBKeyRange.bound(rangeOptions.lower, rangeOptions.upper,
          rangeOptions.lowerOpen, rangeOptions.upperOpen);
      } else if (rangeOptions.lower !== undefined) {
        range = IDBKeyRange.lowerBound(rangeOptions.lower, rangeOptions.lowerOpen);
      } else if (rangeOptions.upper !== undefined) {
        range = IDBKeyRange.upperBound(rangeOptions.upper, rangeOptions.upperOpen);
      } else {
        range = null;
      }

      const request = range ? index.getAll(range) : index.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ===== 批量操作 =====

  async batchPut(storeName, items) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      // 批量写入（单个事务）
      for (const item of items) {
        store.put(item);
      }

      tx.oncomplete = () => resolve(items.length);
      tx.onerror = () => reject(tx.error);
    });
  }

  async batchDelete(storeName, keys) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      for (const key of keys) {
        store.delete(key);
      }

      tx.oncomplete = () => resolve(keys.length);
      tx.onerror = () => reject(tx.error);
    });
  }

  // ===== 游标分页 =====

  async cursorPaginate(storeName, options = {}) {
    const db = await this.open();
    const {
      indexName,
      direction = 'next',
      limit = 50,
      offset = 0,
      filter,
    } = options;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const source = indexName ? store.index(indexName) : store;

      const results = [];
      let skipped = 0;
      const request = source.openCursor(null, direction);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve(results);
          return;
        }

        if (skipped < offset) {
          skipped++;
          cursor.continue();
          return;
        }

        if (results.length >= limit) {
          resolve(results);
          return;
        }

        const value = cursor.value;
        if (!filter || filter(value)) {
          results.push(value);
        }
        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ===== 计数 =====

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

  // ===== 数据导出/导入 =====

  async exportData(storeNames) {
    const db = await this.open();
    const data = {};

    for (const name of storeNames) {
      const tx = db.transaction(name, 'readonly');
      const store = tx.objectStore(name);
      const request = store.getAll();
      await new Promise((resolve, reject) => {
        request.onsuccess = () => { data[name] = request.result; resolve(); };
        request.onerror = () => reject(request.error);
      });
    }

    return {
      version: this.version,
      exportedAt: new Date().toISOString(),
      stores: data,
    };
  }

  async importData(exportData, strategy = 'merge') {
    if (!exportData?.stores) throw new Error('Invalid export data');

    const db = await this.open();
    const storeNames = Object.keys(exportData.stores);
    const tx = db.transaction(storeNames, 'readwrite');

    for (const [storeName, items] of Object.entries(exportData.stores)) {
      const store = tx.objectStore(storeName);

      for (const item of items) {
        if (strategy === 'overwrite') {
          store.put(item);
        } else if (strategy === 'merge') {
          const existing = await new Promise(r => {
            const req = store.get(item.id);
            req.onsuccess = () => r(req.result);
          });

          if (!existing) {
            store.add(item);
          } else {
            // 保留较新的版本
            const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
            const importTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
            if (importTime > existingTime) {
              store.put(item);
            }
          }
        }
        // skip: 不导入已存在的
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve({ imported: true, strategy });
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 清理数据库
   */
  async clear(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 关闭数据库
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * 删除数据库
   */
  static async deleteDatabase(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }
}
```

### 5.2 Schema 定义示例

```javascript
// 数据库 Schema 定义
const DB_SCHEMA = {
  // 任务表
  tasks: {
    keyPath: 'id',
    indexes: [
      { name: 'status', keyPath: 'status' },
      { name: 'priority', keyPath: 'priority' },
      { name: 'dueDate', keyPath: 'dueDate' },
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'status_priority', keyPath: ['status', 'priority'], multiEntry: false },
      { name: 'updatedAt', keyPath: 'updatedAt' },
    ],
  },

  // 笔记表
  notes: {
    keyPath: 'id',
    indexes: [
      { name: 'taskId', keyPath: 'taskId' },
      { name: 'tag', keyPath: 'tags', multiEntry: true },
      { name: 'createdAt', keyPath: 'createdAt' },
      { name: 'updatedAt', keyPath: 'updatedAt' },
    ],
  },

  // 项目表
  projects: {
    keyPath: 'id',
    indexes: [
      { name: 'status', keyPath: 'status' },
      { name: 'archived', keyPath: 'archived' },
      { name: 'updatedAt', keyPath: 'updatedAt' },
    ],
  },

  // 同步队列
  syncQueue: {
    keyPath: 'id',
    indexes: [
      { name: 'status', keyPath: 'status' },
      { name: 'entity', keyPath: 'entity' },
      { name: 'timestamp', keyPath: 'timestamp' },
      { name: 'nextRetryAt', keyPath: 'nextRetryAt' },
    ],
  },

  // 版本状态
  versionState: {
    keyPath: 'key',
    indexes: [],
  },
};
```

---

## 六、网络适配层 — 智能降级

### 6.1 连接质量检测

```javascript
/**
 * NetworkAdapter — 网络适配层
 *
 * 功能：
 * - Online/Offline 检测
 * - 连接质量评估（网速/延迟）
 * - 智能降级策略
 * - 操作队列管理
 */

class NetworkAdapter {
  constructor() {
    this.online = navigator.onLine;
    this.connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    this.listeners = { online: [], offline: [], qualityChange: [] };
    this.operationQueue = [];

    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('online', () => {
      this.online = true;
      this._emit('online');
      this._processQueue();
    });

    window.addEventListener('offline', () => {
      this.online = false;
      this._emit('offline');
    });

    if (this.connection) {
      this.connection.addEventListener('change', () => {
        this._emit('qualityChange', this.getQuality());
      });
    }
  }

  /**
   * 获取连接质量评估
   */
  getQuality() {
    if (!this.connection) return { level: 'unknown', effectiveType: 'unknown' };

    const { effectiveType, downlink, rtt, saveData } = this.connection;
    let level;

    if (saveData) {
      level = 'economy'; // 省流模式
    } else if (effectiveType === '4g' && rtt < 100) {
      level = 'excellent';
    } else if (effectiveType === '4g') {
      level = 'good';
    } else if (effectiveType === '3g') {
      level = 'fair';
    } else {
      level = 'poor';
    }

    return { level, effectiveType, downlink, rtt, saveData };
  }

  /**
   * 根据连接质量选择策略
   */
  getStrategy() {
    const quality = this.getQuality();

    switch (quality.level) {
      case 'excellent':
        return {
          preloadImages: true,
          preloadVideos: true,
          syncInterval: 30000,     // 30s
          cacheStrategy: 'network-first',
          lazyLoadThreshold: 0,
        };
      case 'good':
        return {
          preloadImages: true,
          preloadVideos: false,
          syncInterval: 60000,
          cacheStrategy: 'stale-while-revalidate',
          lazyLoadThreshold: 0.5,
        };
      case 'fair':
        return {
          preloadImages: false,
          preloadVideos: false,
          syncInterval: 300000,    // 5min
          cacheStrategy: 'cache-first',
          lazyLoadThreshold: 1.0,
        };
      case 'poor':
      case 'economy':
        return {
          preloadImages: false,
          preloadVideos: false,
          syncInterval: 600000,    // 10min
          cacheStrategy: 'cache-first',
          lazyLoadThreshold: 1.5,
        };
      default:
        return {
          preloadImages: true,
          preloadVideos: false,
          syncInterval: 60000,
          cacheStrategy: 'stale-while-revalidate',
          lazyLoadThreshold: 0.5,
        };
    }
  }

  /**
   * 队列操作（离线时排队，在线时执行）
   */
  queueOperation(operation) {
    if (this.online) {
      return this._execute(operation);
    } else {
      this.operationQueue.push(operation);
      this._emit('queued', operation);
      return Promise.resolve({ queued: true });
    }
  }

  async _processQueue() {
    const queue = [...this.operationQueue];
    this.operationQueue = [];

    for (const operation of queue) {
      try {
        await this._execute(operation);
      } catch (err) {
        // 执行失败，重新入队
        this.operationQueue.push(operation);
      }
    }
  }

  async _execute(operation) {
    return operation.execute();
  }

  // ===== 事件系统 =====
  on(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  _emit(event, data) {
    (this.listeners[event] || []).forEach(h => h(data));
  }
}
```

---

## 七、可访问性 — WCAG 2.1 AA

### 7.1 PWA 可访问性 Checklist

```javascript
/**
 * PWA 可访问性实现
 *
 * 1. 语义化 HTML
 * 2. ARIA 属性
 * 3. 键盘导航
 * 4. 屏幕阅读器支持
 * 5. 高对比度模式
 * 6. 减少动画模式
 * 7. 焦点管理
 * 8. 离线状态通知
 */

// 离线状态广播（屏幕阅读器）
class OfflineAnnouncer {
  constructor() {
    this.el = document.createElement('div');
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.el.setAttribute('aria-atomic', 'true');
    this.el.className = 'sr-only'; // 视觉隐藏但可访问
    this.el.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;';
    document.body.appendChild(this.el);
  }

  announce(message) {
    this.el.textContent = '';
    requestAnimationFrame(() => {
      this.el.textContent = message;
    });
  }
}

// 键盘导航管理器
class KeyboardNavigator {
  constructor(container) {
    this.container = container;
    this._bind();
  }

  _bind() {
    this.container.addEventListener('keydown', (e) => {
      const focusable = this._getFocusableElements();
      const currentIndex = focusable.indexOf(document.activeElement);

      switch (e.key) {
        case 'Tab':
          // 默认行为
          break;

        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          const next = focusable[(currentIndex + 1) % focusable.length];
          next?.focus();
          break;

        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          const prev = focusable[(currentIndex - 1 + focusable.length) % focusable.length];
          prev?.focus();
          break;

        case 'Home':
          e.preventDefault();
          focusable[0]?.focus();
          break;

        case 'End':
          e.preventDefault();
          focusable[focusable.length - 1]?.focus();
          break;

        case 'Escape':
          this._emit('escape');
          break;
      }
    });
  }

  _getFocusableElements() {
    return Array.from(this.container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.disabled && el.offsetParent !== null);
  }

  on(event, handler) {
    this._listeners = this._listeners || {};
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
  }

  _emit(event) {
    (this._listeners?.[event] || []).forEach(h => h());
  }
}

// 减少动画检测
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefersHighContrast = window.matchMedia('(prefers-contrast: more)');
const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)');

// 根据偏好应用样式
function applyAccessibilityPreferences() {
  document.documentElement.classList.toggle('reduced-motion', prefersReducedMotion.matches);
  document.documentElement.classList.toggle('high-contrast', prefersHighContrast.matches);
  document.documentElement.classList.toggle('dark-mode', prefersDarkMode.matches);
}

applyAccessibilityPreferences();

prefersReducedMotion.addEventListener('change', applyAccessibilityPreferences);
prefersHighContrast.addEventListener('change', applyAccessibilityPreferences);
prefersDarkMode.addEventListener('change', applyAccessibilityPreferences);
```

### 7.2 CSS 可访问性

```css
/* 视觉隐藏（屏幕阅读器可用） */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* 焦点可见性 */
:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

:focus:not(:focus-visible) {
  outline: none;
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* 高对比度模式 */
@media (prefers-contrast: more) {
  :root {
    --color-text: #ffffff;
    --color-bg: #000000;
    --color-border: #ffffff;
    --color-primary: #00ffff;
  }

  button, a {
    text-decoration: underline;
    border: 2px solid currentColor;
  }
}

/* 暗色模式 */
@media (prefers-color-scheme: dark) {
  :root {
    --color-text: #e2e8f0;
    --color-bg: #0f172a;
    --color-surface: #1e293b;
    --color-border: #334155;
  }
}

/* 打印样式 */
@media print {
  .no-print, nav, .sync-indicator, .offline-banner {
    display: none !important;
  }

  body {
    color: #000;
    background: #fff;
  }
}
```

---

## 八、PWA 性能优化 — Core Web Vitals

### 8.1 首屏优化策略

```javascript
/**
 * PWA 首屏性能优化
 *
 * 目标：
 * - LCP (Largest Contentful Paint) < 2.5s
 * - FID (First Input Delay) < 100ms
 * - CLS (Cumulative Layout Shift) < 0.1
 * - TTFB (Time to First Byte) < 800ms
 * - 首屏可交互 < 3s
 */

// 1. 关键 CSS 内联
// 在 HTML 中直接内联首屏必需 CSS，避免额外请求

// 2. 资源预加载
// <link rel="preload" href="./app.js" as="script">
// <link rel="preconnect" href="https://api.example.com">

// 3. Service Worker 预热
// 页面加载时立即注册 SW，不等待 DOMContentLoaded
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}

// 4. 性能指标采集
class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this._observe();
  }

  _observe() {
    // LCP
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.metrics.lcp = lastEntry.startTime;
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {}

      // FID
      try {
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.metrics.fid = entry.processingStart - entry.startTime;
          }
        });
        fidObserver.observe({ type: 'first-input', buffered: true });
      } catch {}

      // CLS
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          this.metrics.cls = clsValue;
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
      } catch {}

      // TTFB
      try {
        const navObserver = new PerformanceObserver((list) => {
          const navEntry = list.getEntries()[0];
          this.metrics.ttfb = navEntry.responseStart;
          this.metrics.domContentLoaded = navEntry.domContentLoadedEventEnd;
          this.metrics.loadComplete = navEntry.loadEventEnd;
        });
        navObserver.observe({ type: 'navigation', buffered: true });
      } catch }
    }
  }

  getReport() {
    const report = { ...this.metrics };

    // 评分
    report.score = {
      lcp: report.lcp < 2500 ? 'good' : report.lcp < 4000 ? 'needs-improvement' : 'poor',
      fid: report.fid < 100 ? 'good' : report.fid < 300 ? 'needs-improvement' : 'poor',
      cls: report.cls < 0.1 ? 'good' : report.cls < 0.25 ? 'needs-improvement' : 'poor',
      ttfb: report.ttfb < 800 ? 'good' : report.ttfb < 1800 ? 'needs-improvement' : 'poor',
    };

    return report;
  }

  // 上报到服务器
  async reportToServer(endpoint) {
    const report = this.getReport();
    if ('sendBeacon' in navigator) {
      navigator.sendBeacon(endpoint, JSON.stringify(report));
    } else {
      fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(report),
        keepalive: true,
      }).catch(() => {});
    }
  }
}

// 使用
const perfMonitor = new PerformanceMonitor();

// 页面卸载时上报
window.addEventListener('beforeunload', () => {
  perfMonitor.reportToServer('/api/perf');
});
```

### 8.2 图片优化策略

```javascript
/**
 * 图片懒加载 + 占位符 + 渐进式加载
 */

// 1. IntersectionObserver 懒加载
function lazyLoadImages(container = document) {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          // 显示占位符 → 加载真实图片 → 替换
          const placeholder = img.src;
          img.src = img.dataset.src;
          img.onload = () => {
            img.classList.add('loaded');
            img.classList.remove('loading');
          };
          img.classList.add('loading');
          observer.unobserve(img);
        }
      }
    });
  }, {
    rootMargin: '50px 0px', // 提前 50px 开始加载
    threshold: 0.01,
  });

  container.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}

// 2. 响应式图片
// <picture>
//   <source media="(max-width: 640px)" srcset="thumb-320.webp" type="image/webp">
//   <source media="(max-width: 1024px)" srcset="thumb-640.webp" type="image/webp">
//   <img src="thumb-1024.jpg" alt="..." loading="lazy" width="640" height="480">
// </picture>

// 3. 占位符（模糊预览 → 清晰图片）
function createPlaceholderBlur(dataUrl) {
  return `
    <div class="image-placeholder" style="
      background-image: url('${dataUrl}');
      background-size: cover;
      background-position: center;
      filter: blur(20px);
      transform: scale(1.05);
    "></div>`;
}

// CSS
// .image-placeholder { transition: opacity 0.3s; }
// .image-placeholder.loaded { opacity: 0; }
```

---

## 九、PWA 安装与更新

### 9.1 安装横幅控制

```javascript
/**
 * PWA 安装管理
 */
class InstallManager {
  constructor() {
    this.deferredPrompt = null;
    this._bind();
  }

  _bind() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this._showInstallUI();
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this._hideInstallUI();
      this._trackEvent('pwa_installed');
    });
  }

  async prompt() {
    if (!this.deferredPrompt) return { outcome: 'dismissed' };

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;

    if (outcome === 'accepted') {
      this._hideInstallUI();
    }

    return { outcome };
  }

  _showInstallUI() {
    // 显示自定义安装按钮/横幅
    const banner = document.getElementById('install-banner');
    if (banner) banner.style.display = 'flex';
  }

  _hideInstallUI() {
    const banner = document.getElementById('install-banner');
    if (banner) banner.style.display = 'none';
  }

  _trackEvent(event) {
    // gtag / analytics / 自定义埋点
    if (typeof gtag === 'function') {
      gtag('event', event);
    }
  }
}
```

### 9.2 优雅更新

```javascript
/**
 * PWA 更新管理
 */
class UpdateManager {
  constructor() {
    this.updateAvailable = false;
    this._bind();
  }

  _bind() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.updateAvailable = true;
              this._showUpdateBanner();
            }
          });
        });
      });

      // 监听 SW 消息
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'DATA_UPDATED') {
          this._handleDataUpdate();
        }
      });
    }
  }

  _showUpdateBanner() {
    const banner = document.getElementById('update-banner');
    if (!banner) return;

    banner.style.display = 'flex';

    document.getElementById('update-now-btn')?.addEventListener('click', () => {
      this.updateNow();
    });

    document.getElementById('update-later-btn')?.addEventListener('click', () => {
      banner.style.display = 'none';
    });
  }

  async updateNow() {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    }
  }

  _handleDataUpdate() {
    // 后台数据更新，显示提示
    this._showToast('数据已更新', 'info');
  }

  _showToast(message, type = 'info') {
    // 显示 Toast 通知
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}
```

---

## 十、PWA 安全

### 10.1 安全 Checklist

```javascript
/**
 * PWA 安全最佳实践
 */

// 1. Content Security Policy (CSP)
// 通过 HTTP 头或 <meta> 设置：
// Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.example.com;

// 2. Subresource Integrity (SRI)
// <link rel="stylesheet" href="./styles.css"
//       integrity="sha384-xxx" crossorigin="anonymous">

// 3. 数据加密（敏感数据存储在 IndexedDB 时）
class DataEncryptor {
  async generateKey() {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(data, key) {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(JSON.stringify(data));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
  }

  async decrypt(encrypted, key) {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encrypted.iv) },
      key,
      new Uint8Array(encrypted.data)
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  }
}

// 4. XSS 防护
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 5. 敏感操作二次确认
// 删除/导出等操作需要用户确认

// 6. 速率限制
// 防止 API 滥用
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  canProceed() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    if (this.requests.length >= this.maxRequests) return false;
    this.requests.push(now);
    return true;
  }
}
```

---

## 十一、PWA 测试策略

### 11.1 离线测试

```javascript
/**
 * PWA 离线测试用例
 */

// 测试 1: SW 注册
async function testSWRegistration() {
  if (!('serviceWorker' in navigator)) {
    return { pass: false, reason: '浏览器不支持 SW' };
  }

  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    return {
      pass: true,
      scope: reg.scope,
      state: reg.active?.state,
    };
  } catch (err) {
    return { pass: false, reason: err.message };
  }
}

// 测试 2: 预缓存资源
async function testPrecache() {
  const cacheName = (await caches.keys()).find(n => n.includes('precache'));
  if (!cacheName) return { pass: false, reason: '无预缓存' };

  const cache = await caches.open(cacheName);
  const urls = ['./', './index.html', './app.js', './styles.css'];
  const results = {};

  for (const url of urls) {
    const match = await cache.match(url);
    results[url] = !!match;
  }

  return {
    pass: Object.values(results).every(v => v),
    results,
  };
}

// 测试 3: 离线页面加载
async function testOfflinePageLoad() {
  // 模拟离线：在 DevTools 中启用 Offline 模式
  // 然后尝试加载页面
  const response = await fetch('./index.html');
  return {
    pass: response.ok || response.type === 'opaqueredirect',
    status: response.status,
    fromCache: response.fromCache || response.headers.get('x-cache'),
  };
}

// 测试 4: IndexedDB 读写
async function testIndexedDB() {
  try {
    const db = await openDB('test-offline', 1, {
      upgrade(db) {
        db.createObjectStore('test', { keyPath: 'id' });
      }
    });

    const tx = db.transaction('test', 'readwrite');
    await tx.objectStore('test').add({ id: 'test-1', value: 'hello' });

    const tx2 = db.transaction('test', 'readonly');
    const result = await tx2.objectStore('test').get('test-1');

    return {
      pass: result?.value === 'hello',
      data: result,
    };
  } catch (err) {
    return { pass: false, reason: err.message };
  }
}

// 测试 5: manifest.json 有效性
async function testManifest() {
  try {
    const resp = await fetch('./manifest.json');
    const manifest = await resp.json();

    const required = ['name', 'icons', 'start_url', 'display'];
    const missing = required.filter(field => !manifest[field]);

    return {
      pass: missing.length === 0,
      missing,
      display: manifest.display,
      iconCount: manifest.icons?.length || 0,
    };
  } catch (err) {
    return { pass: false, reason: err.message };
  }
}

// 运行所有测试
async function runAllTests() {
  const tests = [
    ['SW 注册', testSWRegistration],
    ['预缓存', testPrecache],
    ['离线页面', testOfflinePageLoad],
    ['IndexedDB', testIndexedDB],
    ['Manifest', testManifest],
  ];

  const results = {};
  for (const [name, test] of tests) {
    results[name] = await test();
  }

  const passed = Object.values(results).filter(r => r.pass).length;
  results._summary = { passed, total: tests.length, rate: `${(passed / tests.length * 100).toFixed(0)}%` };

  return results;
}
```

---

## 十二、PWA Lighthouse 评分优化

### 12.1 PWA 检查项

| 检查项 | 要求 | 实现方式 |
|--------|------|---------|
| 快速响应 | 首屏 < 3s | SW 缓存 + 关键 CSS 内联 |
| 离线可用 | 离线加载页面 | SW Cache-First + 离线回退 |
| HTTPS | 安全上下文 | 部署 HTTPS |
| manifest 完整 | name/icons/start_url/display | 完整 manifest.json |
| SW 注册 | 已注册并激活 | navigator.serviceWorker.register |
| 彩色图标 | 192x192 + 512x512 | 生成 PNG 图标 |
| maskable 图标 | purpose: "any maskable" | manifest icons 配置 |
| 状态栏着色 | theme-color | manifest + meta |
| 全屏显示 | display: standalone | manifest display |
| 内容可缩放 | 不禁止缩放 | viewport 不设置 user-scalable=no |

### 12.2 Lighthouse PWA 满分配置

```json
{
  "name": "OfflineTasks — 离线任务管理器",
  "short_name": "OfflineTasks",
  "description": "完全离线可用的任务管理 PWA",
  "start_url": "./index.html?utm_source=pwa",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "categories": ["productivity"],
  "launch_handler": {
    "client_mode": ["navigate-existing", "auto"]
  },
  "icons": [
    {
      "src": "./icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "./icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "./screenshot-1.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "./screenshot-2.png",
      "sizes": "720x1280",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],
  "shortcuts": [
    {
      "name": "新建任务",
      "short_name": "新建",
      "description": "快速创建新任务",
      "url": "./index.html?action=create",
      "icons": [{ "src": "./icon-new.png", "sizes": "96x96" }]
    }
  ]
}
```

---

## 十三、总结 — 生产级 PWA 知识体系

### 13.1 技术栈全景

```
PWA 技术栈
├── 基础层
│   ├── manifest.json（应用元数据）
│   ├── HTTPS（安全上下文）
│   └── 响应式设计（移动端适配）
├── 离线层
│   ├── Service Worker（请求拦截/缓存策略）
│   ├── Cache API（请求级缓存）
│   ├── IndexedDB（结构化数据存储）
│   └── Background Sync（离线操作队列）
├── 交互层
│   ├── Push API（推送通知）
│   ├── Periodic Background Sync（定期后台同步）
│   ├── Web Share API（系统分享）
│   └── Badging API（角标）
├── 性能层
│   ├── 关键 CSS 内联
│   ├── 图片懒加载
│   ├── 代码分割
│   └── 性能监控（Core Web Vitals）
└── 质量层
    ├── 可访问性（WCAG 2.1 AA）
    ├── 安全性（CSP/SRI/加密）
    ├── 测试（离线测试/自动化）
    └── 监控（错误上报/性能指标）
```

### 13.2 三轮迭代总结

| 轮次 | 内容 | 核心产出 |
|------|------|---------|
| 4/25 基础 | PWA 概念 + manifest + SW 入门 | 理解 PWA 基本原理 |
| 4/28 完整 | OfflineTasks 离线任务管理器 | 完整可运行的 PWA |
| 4/29 修复 | P0 问题修复 + 样式 + 回退页面 | 稳定可用的 PWA |
| 4/30 生产 | 分层缓存 + 增量同步 + 可访问性 + 性能 | 生产级 PWA 架构 |

### 13.3 面试高频考点（生产级）

1. **分层缓存策略的设计原则？** 按资源类型/更新频率/重要性分层，不同层不同策略
2. **如何处理多设备数据冲突？** 版本向量 + Last-Write-Wins + 字段级合并
3. **Service Worker 更新机制？** install → waiting → activate，skipWaiting + clients.claim
4. **IndexedDB 事务的隔离级别？** 每个事务独立，readwrite 事务串行执行
5. **如何保证离线数据不丢失？** IndexedDB 持久化 + syncQueue + Background Sync
6. **PWA 性能优化关键点？** 预缓存关键资源 + 懒加载非关键资源 + 性能监控
7. **Background Sync vs Periodic Sync？** 一次性同步 vs 定期后台刷新
8. **Cache API 容量限制？** 通常 50MB+，可用 storage.estimate() 查询

---

## 十四、自测题（生产级）

### 架构设计题

1. 设计一个离线优先的协作文档编辑器，如何处理多用户并发编辑？
2. 设计一个支持断点续传的文件上传 PWA。
3. 如何在 PWA 中实现"草稿自动保存"功能？

### 性能优化题

4. 首屏 LCP 超过 3s，如何排查和优化？
5. IndexedDB 写入 10万条记录，如何优化性能？
6. Service Worker 缓存了 500MB 数据，如何管理？

### 安全题

7. 如何防止 IndexedDB 中的数据被 XSS 攻击窃取？
8. PWA 中如何安全存储用户凭证？
9. 如何防止恶意 SW 注入？

---

**PWA/离线优先 四轮迭代闭环 ✅** (4/25 → 4/28 → 4/29 → 4/30)
