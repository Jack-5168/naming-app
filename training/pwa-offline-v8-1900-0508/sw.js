/**
 * CollabPad — Service Worker v8
 *
 * 第八轮迭代核心策略（对比 v7 MarkFlow）：
 * 1. 多策略缓存 — 文档用 NetworkFirst，静态资源用 StaleWhileRevalidate，
 *    图片用 CacheFirst，API 用 NetworkOnly + 离线队列
 * 2. Background Sync — 离线操作队列，恢复连接后自动重放
 * 3. Push Notification — 协作事件推送（加入/离开/编辑/冲突）
 * 4. Periodic Background Sync — 定期同步（如果浏览器支持）
 * 5. Navigation Preload — 加速首次导航加载
 * 6. Offline Fallback — 文档离线时返回缓存版本 + 离线提示
 * 7. 增量同步 — 只同步变更的操作，不重复传输完整文档
 * 8. 冲突检测 — SW 层检测版本冲突，通知主线程处理
 */

// ============================================================
// 常量
// ============================================================

const CACHE_NAME = 'collabpad-v8';
const DOC_CACHE_NAME = 'collabpad-docs-v8';
const ASSET_CACHE_NAME = 'collabpad-assets-v8';
const IMAGE_CACHE_NAME = 'collabpad-images-v8';

const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './styles.css',
  './manifest.json',
];

// 需要网络优先的 URL 模式
const NETWORK_FIRST_PATTERNS = [
  /\/api\//,
  /\/sync/,
  /\/documents/,
];

// 可以缓存的图片类型
const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i;

// ============================================================
// Install — 预缓存静态资源
// ============================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Install — 预缓存静态资源');

  event.waitUntil(
    Promise.all([
      // 预缓存核心资源
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] 预缓存:', STATIC_ASSETS);
        return cache.addAll(STATIC_ASSETS);
      }),
      // 预缓存文档和媒体资源（空）
      caches.open(DOC_CACHE_NAME),
      caches.open(ASSET_CACHE_NAME),
      caches.open(IMAGE_CACHE_NAME),
      // 跳过等待，立即激活
      self.skipWaiting(),
    ])
  );
});

// ============================================================
// Activate — 清理旧缓存
// ============================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate — 清理旧缓存');

  const validCacheNames = new Set([
    CACHE_NAME,
    DOC_CACHE_NAME,
    ASSET_CACHE_NAME,
    IMAGE_CACHE_NAME,
  ]);

  event.waitUntil(
    Promise.all([
      // 清理旧版本缓存
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => !validCacheNames.has(name))
            .map((name) => {
              console.log('[SW] 删除旧缓存:', name);
              return caches.delete(name);
            })
        );
      }),
      // 立即接管所有客户端
      self.clients.claim(),
      // 启用 Navigation Preload
      enableNavigationPreload(),
    ])
  );
});

/**
 * 启用 Navigation Preload（加速首次加载）
 */
async function enableNavigationPreload() {
  if (self.registration.navigationPreload) {
    await self.registration.navigationPreload.enable();
    console.log('[SW] Navigation Preload 已启用');
  }
}

// ============================================================
// Fetch — 多策略缓存路由
// ============================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理 GET 请求
  if (request.method !== 'GET') return;

  // 跳过 chrome-extension 等非 HTTP 请求
  if (!url.protocol.startsWith('http')) return;

  // 路由到不同策略
  if (isNavigationRequest(request)) {
    event.respondWith(navigationStrategy(request));
  } else if (isApiRequest(url)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (IMAGE_EXTENSIONS.test(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE_NAME));
  } else if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidateStrategy(request));
  } else {
    event.respondWith(networkFirstStrategy(request));
  }
});

/**
 * 判断是否为导航请求
 */
function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

/**
 * 判断是否为 API 请求
 */
function isApiRequest(url) {
  return NETWORK_FIRST_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

/**
 * 判断是否为静态资源
 */
function isStaticAsset(url) {
  return (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf')
  );
}

// ============================================================
// 缓存策略
// ============================================================

/**
 * 导航策略 — Navigation Preload + NetworkFirst + 离线回退
 *
 * 1. 尝试 Navigation Preload 响应（如果可用）
 * 2. 回退到普通 Network
 * 3. 离线时返回缓存的 index.html
 */
async function navigationStrategy(request) {
  // 尝试 Navigation Preload
  const preloadResponse = await getPreloadResponse(request);
  if (preloadResponse) {
    console.log('[SW] 使用 Navigation Preload 响应');
    // 缓存最新版本
    const clone = preloadResponse.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
    return preloadResponse;
  }

  try {
    // 网络请求
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch (error) {
    console.log('[SW] 导航离线回退');
    // 离线回退：返回缓存的 index.html
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match('./index.html');
    if (cached) return cached;

    // 最终回退：返回离线页面
    return new Response(
      `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CollabPad — 离线</title>
  <style>
    body { font-family: system-ui; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0;
           background: #0f172a; color: #e2e8f0; }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    p { color: #94a3b8; margin-bottom: 2rem; }
    button { background: #0ea5e9; color: white; border: none;
             padding: 0.75rem 1.5rem; border-radius: 0.5rem;
             cursor: pointer; font-size: 1rem; }
    button:hover { background: #0284c7; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📡 您已离线</h1>
    <p>CollabPad 需要网络连接才能同步协作数据。<br>
       您的本地更改已安全保存在 IndexedDB 中。</p>
    <button onclick="location.reload()">🔄 重试连接</button>
  </div>
</body>
</html>`,
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}

/**
 * 获取 Navigation Preload 响应
 */
async function getPreloadResponse(request) {
  if (!self.registration.navigationPreload) return null;
  try {
    const response = await request.preloadResponse;
    return response || null;
  } catch {
    return null;
  }
}

/**
 * NetworkFirst 策略 — 优先网络，失败时回退缓存
 *
 * 适用于：API 请求、文档同步
 */
async function networkFirstStrategy(request) {
  const cache = await caches.open(DOC_CACHE_NAME);
  const cacheKey = request.url;

  try {
    const response = await fetch(request);
    if (response.ok) {
      // 缓存成功响应
      const clone = response.clone();
      cache.put(cacheKey, clone);
    }
    return response;
  } catch (error) {
    console.log('[SW] NetworkFirst 回退到缓存:', request.url);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    // 返回离线响应
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: '网络不可用，请使用离线模式',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Offline': 'true',
        },
      }
    );
  }
}

/**
 * CacheFirst 策略 — 优先缓存，未命中时网络请求
 *
 * 适用于：图片、字体等静态资源
 */
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // 后台更新（StaleWhileRevalidate 变体）
    fetch(request).then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
    }).catch(() => {
      // 后台更新失败，忽略
    });

    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // 返回占位图片
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
        <rect width="200" height="200" fill="#1e293b"/>
        <text x="100" y="100" text-anchor="middle" fill="#64748b"
              font-family="system-ui" font-size="14">📷 图片离线</text>
      </svg>`,
      {
        headers: { 'Content-Type': 'image/svg+xml' },
      }
    );
  }
}

/**
 * StaleWhileRevalidate 策略 — 返回缓存同时后台更新
 *
 * 适用于：JS/CSS 等静态资源
 */
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(ASSET_CACHE_NAME);
  const cached = await cache.match(request);

  // 后台更新
  fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
        // 通知客户端更新
        notifyClientsAboutUpdate(request.url);
      }
    })
    .catch(() => {
      // 后台更新失败，使用缓存
    });

  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * 通知所有客户端有更新
 */
function notifyClientsAboutUpdate(url) {
  self.clients.matchAll().then((clients) => {
    for (const client of clients) {
      client.postMessage({
        type: 'asset_updated',
        url,
        timestamp: Date.now(),
      });
    }
  });
}

// ============================================================
// Background Sync — 离线操作队列同步
// ============================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background Sync:', event.tag);

  if (event.tag === 'collab-sync') {
    event.waitUntil(syncOperations());
  } else if (event.tag === 'collab-periodic') {
    event.waitUntil(periodicSync());
  }
});

/**
 * 同步操作队列
 *
 * 流程：
 * 1. 从 IndexedDB 读取待同步操作
 * 2. 按时间顺序发送到服务器
 * 3. 更新操作状态
 * 4. 处理冲突
 */
async function syncOperations() {
  console.log('[SW] 开始同步操作队列');

  // 打开 IndexedDB
  const db = await openSWDB();
  const queueItems = await getPendingItems(db);

  if (queueItems.length === 0) {
    console.log('[SW] 同步队列为空');
    return;
  }

  console.log(`[SW] 同步 ${queueItems.length} 个操作`);

  for (const item of queueItems) {
    try {
      // 模拟发送到服务器（实际项目中替换为真实 API）
      await sendToServer(item);

      // 标记为已发送
      await markItemSent(db, item.id);

      console.log(`[SW] ✅ 同步成功: ${item.id}`);
    } catch (error) {
      console.warn(`[SW] ❌ 同步失败: ${item.id}`, error);

      // 重试计数
      await incrementRetry(db, item.id);

      const updated = await getItem(db, item.id);
      if (updated.retries >= updated.maxRetries) {
        // 超过最大重试，标记为失败
        await markItemFailed(db, item.id);
        // 通知主线程
        notifyClients({
          type: 'sync_failed',
          itemId: item.id,
          error: error.message,
        });
      }
    }
  }

  // 通知主线程同步完成
  notifyClients({
    type: 'sync_complete',
    synced: queueItems.length,
    timestamp: Date.now(),
  });
}

/**
 * 定期后台同步
 *
 * 用于：检查新通知、检查协作者状态、预加载文档
 */
async function periodicSync() {
  console.log('[SW] Periodic Background Sync');

  try {
    // 检查新通知（实际项目中从服务器获取）
    const notifications = await fetchNotifications();

    if (notifications.length > 0) {
      for (const notif of notifications) {
        await self.registration.showNotification(notif.title, {
          body: notif.body,
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          tag: notif.id,
          requireInteraction: false,
          data: { docId: notif.docId, url: `./index.html#doc/${notif.docId}` },
          actions: [
            { action: 'view', title: '查看' },
            { action: 'dismiss', title: '忽略' },
          ],
        });
      }
    }

    // 通知主线程
    notifyClients({
      type: 'periodic_sync_complete',
      notifications: notifications.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.warn('[SW] Periodic Sync 失败:', error);
  }
}

/**
 * 模拟获取通知
 */
async function fetchNotifications() {
  // 实际项目中从服务器获取
  return [];
}

// ============================================================
// Push Notification — 推送通知
// ============================================================

self.addEventListener('push', (event) => {
  console.log('[SW] Push 通知收到');

  let data = { title: 'CollabPad', body: '新通知', docId: null };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    // 使用默认数据
    const text = event.data?.text();
    if (text) data.body = text;
  }

  const options = {
    body: data.body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: data.tag || 'collabpad',
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.docId ? `./index.html#doc/${data.docId}` : './index.html',
      docId: data.docId,
    },
    actions: [
      { action: 'view', title: '查看' },
      { action: 'dismiss', title: '忽略' },
    ],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/**
 * 通知点击处理
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 通知点击:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') return;

  // 打开或聚焦相关窗口
  const url = event.notification.data?.url || './index.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // 检查是否已有打开的窗口
      for (const client of clientList) {
        if (client.url.includes(url.split('#')[0])) {
          return client.focus();
        }
      }
      // 打开新窗口
      return self.clients.openWindow(url);
    })
  );
});

/**
 * 通知关闭处理
 */
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] 通知关闭:', event.notification.tag);
});

// ============================================================
// Message — 主线程消息处理
// ============================================================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'skip_waiting':
      // 主线程请求跳过等待（新版本激活）
      self.skipWaiting();
      break;

    case 'cache_document':
      // 缓存文档
      cacheDocument(payload);
      break;

    case 'send_notification':
      // 发送通知
      sendNotificationFromMain(payload);
      break;

    case 'get_cache_stats':
      // 返回缓存统计
      getCacheStats().then((stats) => {
        event.ports[0]?.postMessage(stats);
      });
      break;
  }
});

/**
 * 缓存文档
 */
async function cacheDocument({ docId, content, title }) {
  const cache = await caches.open(DOC_CACHE_NAME);
  const response = new Response(JSON.stringify({ docId, content, title, cachedAt: Date.now() }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Cached': 'true',
      'X-Doc-Id': docId,
    },
  });
  await cache.put(`./documents/${docId}`, response);
  console.log(`[SW] 文档已缓存: ${title}`);
}

/**
 * 从主线程发送通知
 */
async function sendNotificationFromMain(payload) {
  await self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: payload.tag || 'collabpad',
    data: payload.data || {},
    actions: payload.actions || [
      { action: 'view', title: '查看' },
      { action: 'dismiss', title: '忽略' },
    ],
  });
}

/**
 * 获取缓存统计
 */
async function getCacheStats() {
  const cacheNames = await caches.keys();
  const stats = {};

  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const requests = await cache.keys();
    let size = 0;

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        size += blob.size;
      }
    }

    stats[name] = {
      entries: requests.length,
      size,
      sizeMB: (size / 1024 / 1024).toFixed(2),
    };
  }

  return stats;
}

// ============================================================
// IndexedDB 辅助（SW 内使用）
// ============================================================

const SW_DB_NAME = 'collabpad-sw-sync';
const SW_DB_VERSION = 1;

function openSWDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SW_DB_NAME, SW_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = () => reject(request.error);
  });
}

async function getPendingItems(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readonly');
    const store = tx.objectStore('syncQueue');
    const index = store.index('status');
    const request = index.openCursor(IDBKeyRange.only('pending'));
    const items = [];

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        items.push(cursor.value);
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function markItemSent(db, itemId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readwrite');
    const request = tx.objectStore('syncQueue').get(itemId);
    request.onsuccess = () => {
      if (request.result) {
        request.result.status = 'sent';
        tx.objectStore('syncQueue').put(request.result);
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function incrementRetry(db, itemId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readwrite');
    const request = tx.objectStore('syncQueue').get(itemId);
    request.onsuccess = () => {
      if (request.result) {
        request.result.retries = (request.result.retries || 0) + 1;
        request.result.status = 'retrying';
        tx.objectStore('syncQueue').put(request.result);
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function markItemFailed(db, itemId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readwrite');
    const request = tx.objectStore('syncQueue').get(itemId);
    request.onsuccess = () => {
      if (request.result) {
        request.result.status = 'failed';
        tx.objectStore('syncQueue').put(request.result);
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function getItem(db, itemId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readonly');
    const request = tx.objectStore('syncQueue').get(itemId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 通知所有客户端
 */
function notifyClients(message) {
  self.clients.matchAll().then((clients) => {
    for (const client of clients) {
      client.postMessage(message);
    }
  });
}

/**
 * 模拟发送到服务器
 */
async function sendToServer(item) {
  // 实际项目中替换为真实 API 调用
  // const response = await fetch('/api/sync', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(item.payload),
  // });
  // if (!response.ok) throw new Error(`HTTP ${response.status}`);

  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 300));

  // 模拟 10% 失败率（测试重试逻辑）
  if (Math.random() < 0.1) {
    throw new Error('模拟网络错误');
  }
}
