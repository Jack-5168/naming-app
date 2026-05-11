# PWA / 离线优先专项训练

**日期**: 2026-04-25 | **时间**: 19:00 | **主题**: Service Worker / Cache API / IndexedDB

---

## 一、PWA 核心概念

### 1.1 什么是 PWA

Progressive Web App — 渐进式 Web 应用。用 Web 技术提供接近原生应用体验的应用。

**三大核心特征:**
- **可靠 (Reliable)**: 离线可用，不受网络影响
- **快速 (Fast)**: 快速加载，流畅交互
- **可安装 (Installable)**: 可以添加到主屏幕，像原生应用一样使用

### 1.2 PWA 技术栈

```
┌─────────────────────────────────────────┐
│              PWA 技术栈                  │
├──────────┬──────────┬───────────────────┤
│ Manifest │  Service │     IndexedDB     │
│  (安装)  │  Worker  │   (离线存储)      │
│          │ (离线/缓存)│                  │
├──────────┴──────────┴───────────────────┤
│        HTTPS + 响应式设计               │
└─────────────────────────────────────────┘
```

### 1.3 PWA 检查清单

- [x] HTTPS 环境
- [x] Web App Manifest (manifest.json)
- [x] Service Worker (注册 + 生命周期)
- [x] Cache API (静态资源缓存)
- [x] IndexedDB (离线数据)
- [x] 离线页面 (offline fallback)
- [x] 安装提示 (beforeinstallprompt)

---

## 二、Service Worker 深度解析

### 2.1 Service Worker 是什么

Service Worker 是浏览器在后台运行的脚本，独立于网页，充当网络代理。

**核心特性:**
- 拦截网络请求
- 缓存/返回资源
- 推送通知
- 后台同步
- 生命周期独立于页面

### 2.2 生命周期

```
install → activated → running → terminated
  │          │
  │          └─ skipWaiting() 可跳过等待
  └─ self.skipWaiting() 跳过等待激活
```

**三个阶段:**
1. **Install**: 缓存静态资源，失败则 SW 不激活
2. **Activate**: 清理旧缓存，接管客户端
3. **Running**: 拦截 fetch 事件，处理消息

### 2.3 注册与调试

```javascript
// 注册 Service Worker
if ('serviceWorker' in navigator) {
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'  // SW 控制范围
    });
    console.log('SW registered:', reg.scope);
    
    // 更新检测
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // 有新版本可用
          showUpdateBanner();
        }
      });
    });
  } catch (err) {
    console.error('SW registration failed:', err);
  }
}
```

### 2.4 通信机制

```javascript
// 页面 → SW: postMessage
navigator.serviceWorker.controller?.postMessage({
  type: 'CACHE_URLS',
  urls: ['/api/articles']
});

// SW → 页面: clients.matchAll + postMessage
self.clients.matchAll().then(clients => {
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_COMPLETE' });
  });
});

// SW 中接收消息
self.addEventListener('message', (event) => {
  if (event.data.type === 'CACHE_URLS') {
    caches.open('dynamic-v1').then(cache => {
      cache.addAll(event.data.urls);
    });
  }
});
```

---

## 三、Cache API 缓存策略

### 3.1 五种核心策略

| 策略 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| Cache First | 静态资源 (JS/CSS/图片) | 极快 | 可能过期 |
| Network First | API 数据 | 数据新鲜 | 离线不可用 |
| Stale While Revalidate | 不关键资源 | 快速+最终一致 | 可能短暂过期 |
| Cache Only | 永不变更资源 | 最快 | 无法更新 |
| Network Only | 实时数据 | 永远最新 | 离线不可用 |

### 3.2 Cache First (缓存优先)

```javascript
async function cacheFirst(request) {
  const cache = await caches.open('static-v1');
  const cached = await cache.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return caches.match('/offline.html');
  }
}
```

### 3.3 Network First (网络优先)

```javascript
async function networkFirst(request) {
  const cache = await caches.open('api-v1');
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    return cached || new Response(JSON.stringify({ error: 'offline' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### 3.4 Stale While Revalidate (缓存同时更新)

```javascript
async function staleWhileRevalidate(request) {
  const cache = await caches.open('dynamic-v1');
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  
  return cached || await fetchPromise;
}
```

---

## 四、IndexedDB 离线存储

### 4.1 为什么用 IndexedDB

| 特性 | localStorage | IndexedDB |
|------|-------------|-----------|
| 容量 | ~5MB | 大容量 (GB级) |
| 类型 | 仅字符串 | 任意类型 |
| 异步 | 同步(阻塞) | 异步(非阻塞) |
| 事务 | 无 | 支持事务 |
| 索引 | 无 | 支持索引 |
| SW 支持 | ❌ | ✅ |

### 4.2 IndexedDB 封装

见 `04-indexeddb.js` — 完整封装，支持:
- 自动版本管理
- CRUD 操作
- 游标遍历
- 索引查询
- 批量操作
- 离线队列

---

## 五、实战项目: 离线笔记应用

### 5.1 项目结构

```
pwa/
├── index.html          # 主页面
├── manifest.json       # PWA Manifest
├── sw.js               # Service Worker
├── 01-service-worker.js    # SW 注册与生命周期管理
├── 02-cache-strategies.js  # 五种缓存策略实现
├── 03-cache-api.js         # Cache API 高级用法
├── 04-indexeddb.js         # IndexedDB 封装
├── 05-offline-queue.js     # 离线请求队列
├── 06-offline-notes.js     # 离线笔记应用核心
├── 07-install-prompt.js    # 安装提示处理
├── 08-background-sync.js   # 后台同步
└── 2026-04-25-pwa-offline-first.md  # 本文档
```

### 5.2 核心功能

1. **离线笔记 CRUD**: 增删改查笔记，数据存储在 IndexedDB
2. **智能缓存**: 静态资源 Cache First，API 数据 Network First
3. **离线队列**: 网络断开时操作入队，恢复后自动同步
4. **后台同步**: 使用 Background Sync API 自动同步
5. **安装提示**: 引导用户添加到主屏幕
6. **离线页面**: 网络完全断开时显示离线页面

### 5.3 技术亮点

- **版本化缓存**: 缓存名带版本号，更新时自动清理旧缓存
- **请求路由**: 按 URL 模式匹配不同缓存策略
- **离线检测**: 在线/离线状态实时监听 + UI 反馈
- **冲突处理**: 乐观更新 + 服务端最终一致
- **性能优化**: 预缓存关键资源，懒加载非关键资源

---

## 六、关键代码文件说明

| 文件 | 内容 | 代码量 |
|------|------|--------|
| `01-service-worker.js` | SW 注册、版本管理、通信 | ~120 行 |
| `02-cache-strategies.js` | 五种缓存策略完整实现 | ~200 行 |
| `03-cache-api.js` | Cache API 高级操作 | ~150 行 |
| `04-indexeddb.js` | IndexedDB 完整封装 | ~250 行 |
| `05-offline-queue.js` | 离线请求队列 | ~180 行 |
| `06-offline-notes.js` | 离线笔记应用 | ~350 行 |
| `07-install-prompt.js` | 安装提示 | ~80 行 |
| `08-background-sync.js` | 后台同步 | ~100 行 |
| **总计** | | **~1430 行** |

---

## 七、PWA 最佳实践

### 7.1 缓存策略选择

```
静态资源 (JS/CSS/图片/字体) → Cache First
  ├─ 预缓存 (precaching): install 时缓存
  └─ 运行时缓存 (runtime caching): 首次访问后缓存

API 数据 (用户信息/文章内容) → Network First
  ├─ 网络可用时返回最新数据
  └─ 离线时返回缓存数据

不关键资源 (头像/非首屏图片) → Stale While Revalidate
  ├─ 立即返回缓存
  └─ 后台更新缓存

实时数据 (股票/聊天) → Network Only
  └─ 离线时显示"离线"状态
```

### 7.2 更新策略

```javascript
// 1. 更新 SW 文件 (改变文件名或内容)
// 2. 浏览器检测到新 SW → install 新 SW
// 3. 新 SW 等待旧 SW 控制的页面关闭
// 4. 所有页面关闭后 → 新 SW 激活
// 5. 下次打开页面 → 使用新 SW

// 加速更新:
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();  // 跳过等待，立即激活
  }
});
```

### 7.3 离线体验

- 显示离线/在线状态指示器
- 离线时操作入队，在线时自动同步
- 提供离线页面而非浏览器默认错误页
- 关键功能离线可用，非关键功能优雅降级

---

## 八、调试技巧

### 8.1 Chrome DevTools

```
Application → Service Workers
  - 查看 SW 状态
  - 强制更新
  - 离线模式
  - 绕过缓存

Application → Cache Storage
  - 查看所有缓存
  - 手动删除缓存

Application → IndexedDB
  - 查看所有数据库
  - 查看/编辑数据
```

### 8.2 Lighthouse PWA 检查

```
Lighthouse → PWA 检查项:
  ✓ 提供有效的 manifest
  ✓ 注册 Service Worker
  ✓ 响应 200 离线
  ✓ 内容宽度适配
  ✓ 使用 HTTPS
  ✓ 设置主题色
  ✓ 提供视觉化加载
```

---

## 九、总结

### 核心要点

1. **Service Worker** 是 PWA 的核心，充当网络代理
2. **五种缓存策略** 各有适用场景，按资源类型选择
3. **IndexedDB** 是离线存储的最佳选择，支持大容量异步操作
4. **离线队列** 确保离线操作不丢失，恢复后自动同步
5. **Background Sync** 提供可靠的后台同步能力
6. **Manifest** 让应用可安装，提供原生应用般的体验

### 离线优先设计原则

1. 离线优先，而非渐进增强
2. 缓存一切可缓存的资源
3. 乐观更新，最终一致
4. 优雅降级，离线可用
5. 状态可见，用户知情

---

*本专项产出 ~1430 行代码 + 1 份文档，覆盖 PWA 核心三件套 (Service Worker / Cache API / IndexedDB)*
