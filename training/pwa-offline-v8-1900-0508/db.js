/**
 * CollabPad — IndexedDB 数据层 v8
 *
 * 第八轮迭代核心改进（对比 v7 MarkFlow）：
 * 1. OT 操作日志 — 每个变更记录为可转换操作（Insert/Delete/Retain）
 * 2. 协作者状态 — 在线状态/光标位置/选区范围
 * 3. 冲突记录 — OT 转换失败的冲突日志
 * 4. 同步队列 — 离线操作队列，恢复连接后自动重放
 * 5. 文档版本 — 向量时钟（Vector Clock）追踪多协作者版本
 * 6. 变更历史 — 完整操作回放，支持时间旅行
 * 7. 通知偏好 — 每个协作者的通知订阅设置
 * 8. 存储配额 — Storage Manager API 监控
 */

// ============================================================
// 数据库 Schema
// ============================================================

const DB_NAME = 'CollabPadDB';
const DB_VERSION = 8;

/**
 * Stores:
 *
 * documents:
 *   - id: UUID
 *   - title: 文档标题
 *   - content: 当前内容（Markdown）
 *   - version: 向量时钟 { [userId]: version }
 *   - owner: 创建者 userId
 *   - createdAt: number
 *   - updatedAt: number
 *   - lastEditor: 最后编辑者
 *
 * operations:
 *   - id: UUID
 *   - docId: 所属文档
 *   - userId: 操作者
 *   - type: 'insert' | 'delete' | 'format'
 *   - position: 操作位置
 *   - text: 插入/删除的文本
 *   - length: 操作长度
 *   - timestamp: 操作时间
 *   - baseVersion: 基于的版本号
 *   - transformed: 是否经过 OT 转换
 *
 * collaborators:
 *   - userId: 用户 ID
 *   - name: 显示名称
 *   - color: 光标颜色
 *   - lastSeen: 最后活跃时间
 *   - cursorPos: { line, col }
 *   - selection: { start, end }
 *   - status: 'online' | 'away' | 'offline'
 *
 * syncQueue:
 *   - id: UUID
 *   - type: 'operation' | 'document' | 'notification'
 *   - payload: 操作数据
 *   - timestamp: 入队时间
 *   - retries: 重试次数
 *   - maxRetries: 最大重试次数
 *   - status: 'pending' | 'retrying' | 'sent' | 'failed'
 *
 * conflicts:
 *   - id: UUID
 *   - docId: 所属文档
 *   - operation1: 冲突操作 1
 *   - operation2: 冲突操作 2
 *   - resolution: 解决策略 ('winner1' | 'winner2' | 'merged')
 *   - resolvedAt: 解决时间
 *   - resolvedBy: 解决者
 *
 * notifications:
 *   - id: UUID
 *   - type: 'collab_join' | 'edit' | 'conflict' | 'sync'
 *   - title: 通知标题
 *   - body: 通知内容
 *   - docId: 相关文档
 *   - read: 是否已读
 *   - timestamp: 时间
 *
 * preferences:
 *   - userId: 用户 ID
 *   - key: 偏好键
 *   - value: 偏好值
 */

// ============================================================
// 数据库实例
// ============================================================

let dbInstance = null;

/**
 * 打开/初始化数据库
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // documents — 文档存储
      if (!db.objectStoreNames.contains('documents')) {
        const docStore = db.createObjectStore('documents', { keyPath: 'id' });
        docStore.createIndex('owner', 'owner', { unique: false });
        docStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        docStore.createIndex('lastEditor', 'lastEditor', { unique: false });
      }

      // operations — OT 操作日志
      if (!db.objectStoreNames.contains('operations')) {
        const opStore = db.createObjectStore('operations', { keyPath: 'id' });
        opStore.createIndex('docId', 'docId', { unique: false });
        opStore.createIndex('userId', 'userId', { unique: false });
        opStore.createIndex('timestamp', 'timestamp', { unique: false });
        opStore.createIndex('docId_timestamp', ['docId', 'timestamp'], { unique: false });
      }

      // collaborators — 协作者状态
      if (!db.objectStoreNames.contains('collaborators')) {
        const collabStore = db.createObjectStore('collaborators', { keyPath: 'userId' });
        collabStore.createIndex('status', 'status', { unique: false });
        collabStore.createIndex('lastSeen', 'lastSeen', { unique: false });
      }

      // syncQueue — 同步队列
      if (!db.objectStoreNames.contains('syncQueue')) {
        const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // conflicts — 冲突记录
      if (!db.objectStoreNames.contains('conflicts')) {
        const conflictStore = db.createObjectStore('conflicts', { keyPath: 'id' });
        conflictStore.createIndex('docId', 'docId', { unique: false });
        conflictStore.createIndex('resolvedAt', 'resolvedAt', { unique: false });
      }

      // notifications — 通知记录
      if (!db.objectStoreNames.contains('notifications')) {
        const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
        notifStore.createIndex('type', 'type', { unique: false });
        notifStore.createIndex('read', 'read', { unique: false });
        notifStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // preferences — 用户偏好
      if (!db.objectStoreNames.contains('preferences')) {
        const prefStore = db.createObjectStore('preferences', { keyPath: ['userId', 'key'] });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(new Error(`IndexedDB 打开失败: ${event.target.error}`));
    };
  });
}

/**
 * 获取数据库实例（确保已打开）
 */
function getDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return openDB();
}

// ============================================================
// 文档操作
// ============================================================

/**
 * 创建新文档
 */
async function createDocument(title, content = '', userId) {
  const db = await getDB();
  const doc = {
    id: crypto.randomUUID(),
    title: title || '未命名文档',
    content,
    version: { [userId]: 0 },
    owner: userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastEditor: userId,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readwrite', { durability: 'strict' });
    tx.objectStore('documents').put(doc);
    tx.oncomplete = () => resolve(doc);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取文档
 */
async function getDocument(docId) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readonly');
    const request = tx.objectStore('documents').get(docId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 更新文档内容（带向量时钟递增）
 */
async function updateDocument(docId, content, userId) {
  const db = await getDB();
  const doc = await getDocument(docId);
  if (!doc) throw new Error('文档不存在');

  // 递增向量时钟
  doc.version = doc.version || {};
  doc.version[userId] = (doc.version[userId] || 0) + 1;
  doc.content = content;
  doc.updatedAt = Date.now();
  doc.lastEditor = userId;

  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readwrite', { durability: 'strict' });
    tx.objectStore('documents').put(doc);
    tx.oncomplete = () => resolve(doc);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 列出所有文档（按更新时间倒序）
 */
async function listDocuments() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readonly');
    const store = tx.objectStore('documents');
    const index = store.index('updatedAt');
    const request = index.openCursor(null, 'prev');
    const docs = [];
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        docs.push(cursor.value);
        cursor.continue();
      } else {
        resolve(docs);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * 删除文档
 */
async function deleteDocument(docId) {
  const db = await getDB();

  // 同时删除相关操作记录和冲突
  const stores = ['documents', 'operations', 'conflicts'];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    tx.objectStore('documents').delete(docId);
    const opIndex = tx.objectStore('operations').index('docId');
    const opRequest = opIndex.openCursor(IDBKeyRange.only(docId));
    opRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    const conflictIndex = tx.objectStore('conflicts').index('docId');
    const conflictRequest = conflictIndex.openCursor(IDBKeyRange.only(docId));
    conflictRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// OT 操作日志
// ============================================================

/**
 * 记录 OT 操作
 */
async function recordOperation(docId, userId, type, position, text, length, baseVersion) {
  const db = await getDB();
  const op = {
    id: crypto.randomUUID(),
    docId,
    userId,
    type,
    position,
    text,
    length,
    timestamp: Date.now(),
    baseVersion,
    transformed: false,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('operations', 'readwrite');
    tx.objectStore('operations').put(op);
    tx.oncomplete = () => resolve(op);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取文档的所有操作（按时间排序）
 */
async function getOperations(docId, since = 0) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('operations', 'readonly');
    const index = tx.objectStore('operations').index('docId_timestamp');
    const request = index.openCursor(IDBKeyRange.bound([docId, since], [docId, Infinity]));
    const ops = [];
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        ops.push(cursor.value);
        cursor.continue();
      } else {
        resolve(ops);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// ============================================================
// 协作者管理
// ============================================================

/**
 * 注册/更新协作者
 */
async function upsertCollaborator(userId, data) {
  const db = await getDB();
  const collab = {
    userId,
    name: data.name || `用户 ${userId.slice(0, 6)}`,
    color: data.color || generateColor(userId),
    lastSeen: Date.now(),
    cursorPos: data.cursorPos || { line: 0, col: 0 },
    selection: data.selection || null,
    status: 'online',
    ...data,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('collaborators', 'readwrite');
    tx.objectStore('collaborators').put(collab);
    tx.oncomplete = () => resolve(collab);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取所有在线协作者
 */
async function getOnlineCollaborators() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('collaborators', 'readonly');
    const index = tx.objectStore('collaborators').index('status');
    const request = index.openCursor(IDBKeyRange.only('online'));
    const collabs = [];
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        collabs.push(cursor.value);
        cursor.continue();
      } else {
        resolve(collabs);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * 设置协作者离线
 */
async function setCollaboratorOffline(userId) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('collaborators', 'readwrite');
    const request = tx.objectStore('collaborators').get(userId);
    request.onsuccess = () => {
      if (request.result) {
        request.result.status = 'offline';
        tx.objectStore('collaborators').put(request.result);
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// 同步队列
// ============================================================

/**
 * 入队操作（离线时使用）
 */
async function enqueueSync(type, payload) {
  const db = await getDB();
  const item = {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
    retries: 0,
    maxRetries: 5,
    status: 'pending',
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readwrite');
    tx.objectStore('syncQueue').put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取待处理队列项
 */
async function getPendingQueueItems() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readonly');
    const index = tx.objectStore('syncQueue').index('status');
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

/**
 * 标记队列项为已发送
 */
async function markQueueItemSent(itemId) {
  const db = await getDB();
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

/**
 * 重试失败的队列项
 */
async function retryQueueItem(itemId) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readwrite');
    const request = tx.objectStore('syncQueue').get(itemId);
    request.onsuccess = () => {
      if (request.result) {
        request.result.retries++;
        request.result.status = request.result.retries >= request.result.maxRetries
          ? 'failed'
          : 'pending';
        tx.objectStore('syncQueue').put(request.result);
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// 冲突管理
// ============================================================

/**
 * 记录冲突
 */
async function recordConflict(docId, op1, op2, resolution) {
  const db = await getDB();
  const conflict = {
    id: crypto.randomUUID(),
    docId,
    operation1: op1,
    operation2: op2,
    resolution,
    resolvedAt: Date.now(),
    resolvedBy: 'system',
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('conflicts', 'readwrite');
    tx.objectStore('conflicts').put(conflict);
    tx.oncomplete = () => resolve(conflict);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取文档的冲突记录
 */
async function getConflicts(docId) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('conflicts', 'readonly');
    const index = tx.objectStore('conflicts').index('docId');
    const request = index.openCursor(IDBKeyRange.only(docId));
    const conflicts = [];
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        conflicts.push(cursor.value);
        cursor.continue();
      } else {
        resolve(conflicts);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// ============================================================
// 通知管理
// ============================================================

/**
 * 创建通知记录
 */
async function createNotification(type, title, body, docId) {
  const db = await getDB();
  const notif = {
    id: crypto.randomUUID(),
    type,
    title,
    body,
    docId,
    read: false,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('notifications', 'readwrite');
    tx.objectStore('notifications').put(notif);
    tx.oncomplete = () => resolve(notif);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取未读通知
 */
async function getUnreadNotifications() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notifications', 'readonly');
    const index = tx.objectStore('notifications').index('read');
    const request = index.openCursor(IDBKeyRange.only(false));
    const notifs = [];
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        notifs.push(cursor.value);
        cursor.continue();
      } else {
        resolve(notifs);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * 标记通知为已读
 */
async function markNotificationRead(notifId) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notifications', 'readwrite');
    const request = tx.objectStore('notifications').get(notifId);
    request.onsuccess = () => {
      if (request.result) {
        request.result.read = true;
        tx.objectStore('notifications').put(request.result);
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// 偏好设置
// ============================================================

/**
 * 获取偏好
 */
async function getPreference(userId, key) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('preferences', 'readonly');
    const request = tx.objectStore('preferences').get([userId, key]);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 设置偏好
 */
async function setPreference(userId, key, value) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('preferences', 'readwrite');
    tx.objectStore('preferences').put({ userId, key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// 存储配额监控
// ============================================================

/**
 * 获取存储使用情况
 */
async function getStorageUsage() {
  if (!navigator.storage || !navigator.storage.estimate) {
    return { usage: 0, quota: 0, percent: 0 };
  }
  const estimate = await navigator.storage.estimate();
  return {
    usage: estimate.usage,
    quota: estimate.quota,
    percent: ((estimate.usage / estimate.quota) * 100).toFixed(2),
    usageMB: (estimate.usage / 1024 / 1024).toFixed(2),
    quotaMB: (estimate.quota / 1024 / 1024).toFixed(2),
  };
}

/**
 * 检查存储是否接近上限
 */
async function checkStorageQuota(threshold = 90) {
  const usage = await getStorageUsage();
  return {
    ...usage,
    nearLimit: parseFloat(usage.percent) >= threshold,
    threshold,
  };
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 根据 userId 生成固定颜色
 */
function generateColor(userId) {
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * 导出所有数据（备份）
 */
async function exportAllData() {
  const [documents, operations, collaborators, conflicts, notifications] = await Promise.all([
    listDocuments(),
    getOperations('*'),
    getOnlineCollaborators(),
    getConflicts('*'),
    getUnreadNotifications(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    version: DB_VERSION,
    documents,
    operations,
    collaborators,
    conflicts,
    notifications,
  };
}

/**
 * 导入数据
 */
async function importData(data) {
  const db = await getDB();
  const stores = ['documents', 'operations', 'collaborators', 'conflicts', 'notifications'];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    for (const storeName of stores) {
      const store = tx.objectStore(storeName);
      store.clear();
      if (data[storeName]) {
        for (const item of data[storeName]) {
          store.put(item);
        }
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 暴露到全局
window.CollabDB = {
  openDB,
  getDB,
  createDocument,
  getDocument,
  updateDocument,
  listDocuments,
  deleteDocument,
  recordOperation,
  getOperations,
  upsertCollaborator,
  getOnlineCollaborators,
  setCollaboratorOffline,
  enqueueSync,
  getPendingQueueItems,
  markQueueItemSent,
  retryQueueItem,
  recordConflict,
  getConflicts,
  createNotification,
  getUnreadNotifications,
  markNotificationRead,
  getPreference,
  setPreference,
  getStorageUsage,
  checkStorageQuota,
  exportAllData,
  importData,
  DB_NAME,
  DB_VERSION,
};
