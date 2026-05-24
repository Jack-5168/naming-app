/**
 * WikiBase — IndexedDB 数据层 v6
 *
 * 第六轮迭代核心改进：
 * 1. 全文搜索索引 — 基于分词的离线搜索
 * 2. 版本历史 — 文档每次修改自动保存快照
 * 3. 图片附件 — base64 存储 + 引用管理
 * 4. 标签系统 — 多对多关系
 * 5. 增量同步队列 — 离线变更自动排队
 * 6. 存储空间监控 — 接近配额时预警
 * 7. 数据导出/导入 — JSON 备份
 */

// ============================================================
// 数据库 Schema
// ============================================================

const DB_NAME = 'WikiBaseDB';
const DB_VERSION = 6;

/**
 * Store 设计：
 *
 * documents:
 *   - id (keyPath): 文档 UUID
 *   - title: 标题
 *   - content: Markdown 内容
 *   - html: 渲染后的 HTML（缓存，加速显示）
 *   - tags: string[]
 *   - attachments: [{id, name, type, data, size}]
 *   - createdAt: number
 *   - updatedAt: number
 *   - syncStatus: 'synced' | 'dirty' | 'conflict'
 *   - version: number（乐观锁版本号）
 *
 * versions:
 *   - id (autoIncrement): 版本号
 *   - docId: 文档 ID
 *   - content: 该版本的 Markdown 内容
 *   - html: 该版本的 HTML
 *   - timestamp: 创建时间
 *   - changeSummary: 变更摘要
 *
 * searchIndex:
 *   - word (keyPath): 分词后的单词
 *   - docIds: Set<string> — 包含该词的文档 ID 集合
 *   - positions: { [docId]: number[] } — 在每个文档中的位置
 *
 * syncQueue:
 *   - id (autoIncrement): 队列 ID
 *   - type: 'create' | 'update' | 'delete'
 *   - docId: 文档 ID
 *   - data: 变更数据
 *   - timestamp: 入队时间
 *   - retryCount: 重试次数
 *
 * images:
 *   - id (keyPath): 图片 UUID
 *   - name: 文件名
 *   - type: MIME type
 *   - data: ArrayBuffer（原始二进制，比 base64 节省 33%）
 *   - size: 原始大小
 *   - thumbnail: ArrayBuffer（缩略图）
 *   - createdAt: 时间戳
 *   - referencedBy: string[] — 引用该图片的文档 ID
 */

let db = null;
let dbReady = null;

// ============================================================
// 初始化
// ============================================================

function openDB() {
  if (dbReady) return dbReady;

  dbReady = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      const { oldVersion } = event;

      console.log(`[DB] 升级: ${oldVersion} → ${DB_VERSION}`);

      // === documents store ===
      if (!database.objectStoreNames.contains('documents')) {
        const docStore = database.createObjectStore('documents', { keyPath: 'id' });
        docStore.createIndex('title', 'title', { unique: false });
        docStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        docStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        docStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        docStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // === versions store ===
      if (!database.objectStoreNames.contains('versions')) {
        const verStore = database.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
        verStore.createIndex('docId', 'docId', { unique: false });
        verStore.createIndex('timestamp', 'timestamp', { unique: false });
        // 复合索引：文档 + 时间
        verStore.createIndex('docId_timestamp', ['docId', 'timestamp'], { unique: false });
      }

      // === searchIndex store ===
      if (!database.objectStoreNames.contains('searchIndex')) {
        const searchStore = database.createObjectStore('searchIndex', { keyPath: 'word' });
        // 不需要额外索引，word 就是 key
      }

      // === syncQueue store ===
      if (!database.objectStoreNames.contains('syncQueue')) {
        const queueStore = database.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        queueStore.createIndex('type', 'type', { unique: false });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // === images store ===
      if (!database.objectStoreNames.contains('images')) {
        const imgStore = database.createObjectStore('images', { keyPath: 'id' });
        imgStore.createIndex('name', 'name', { unique: false });
        imgStore.createIndex('type', 'type', { unique: false });
        imgStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 版本迁移
      if (oldVersion < 2) {
        // v1 → v2: 添加 versions store
        if (!database.objectStoreNames.contains('versions')) {
          const verStore = database.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
          verStore.createIndex('docId', 'docId', { unique: false });
          verStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      }

      if (oldVersion < 3) {
        // v2 → v3: 添加 searchIndex store
        if (!database.objectStoreNames.contains('searchIndex')) {
          database.createObjectStore('searchIndex', { keyPath: 'word' });
        }
      }

      if (oldVersion < 4) {
        // v3 → v4: 添加 syncQueue store
        if (!database.objectStoreNames.contains('syncQueue')) {
          const queueStore = database.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          queueStore.createIndex('type', 'type', { unique: false });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      }

      if (oldVersion < 5) {
        // v4 → v5: 添加 images store
        if (!database.objectStoreNames.contains('images')) {
          const imgStore = database.createObjectStore('images', { keyPath: 'id' });
          imgStore.createIndex('name', 'name', { unique: false });
          imgStore.createIndex('type', 'type', { unique: false });
          imgStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      }

      if (oldVersion < 6) {
        // v5 → v6: 为 documents 添加新索引
        if (database.objectStoreNames.contains('documents')) {
          const docStore = request.transaction.objectStore('documents');
          if (!docStore.indexNames.contains('tags')) {
            docStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
          }
          if (!docStore.indexNames.contains('createdAt')) {
            docStore.createIndex('createdAt', 'createdAt', { unique: false });
          }
        }
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      console.log('[DB] 连接成功');
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('[DB] 连接失败:', event.target.error);
      reject(event.target.error);
    };
  });

  return dbReady;
}

// ============================================================
// 事务工具
// ============================================================

function getStore(storeName, mode = 'readonly') {
  if (!db) throw new Error('数据库未初始化');
  return db.transaction(storeName, mode).objectStore(storeName);
}

function tx(stores) {
  // 支持多 store 事务
  const storeNames = Array.isArray(stores) ? stores : [stores];
  const transaction = db.transaction(storeNames, 'readwrite');
  const result = {};
  for (const name of storeNames) {
    result[name] = transaction.objectStore(name);
  }
  return {
    transaction,
    ...result,
    complete: new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    }),
  };
}

// ============================================================
// 文档 CRUD
// ============================================================

const DocDB = {
  /** 创建文档 */
  async create(doc) {
    await openDB();
    const now = Date.now();
    const fullDoc = {
      id: crypto.randomUUID?.() || `${now}-${Math.random().toString(36).slice(2)}`,
      title: doc.title || '未命名',
      content: doc.content || '',
      html: '',
      tags: doc.tags || [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
      syncStatus: 'dirty',
      version: 1,
    };

    const stores = tx(['documents', 'versions', 'searchIndex']);

    // 保存文档
    await stores.documents.add(fullDoc);

    // 保存初始版本
    await stores.versions.add({
      docId: fullDoc.id,
      content: fullDoc.content,
      html: fullDoc.html,
      timestamp: now,
      changeSummary: '创建文档',
    });

    // 更新搜索索引
    await updateSearchIndex(stores.searchIndex, fullDoc.id, fullDoc.content);

    await stores.complete;
    return fullDoc;
  },

  /** 获取文档 */
  async get(id) {
    await openDB();
    return new Promise((resolve, reject) => {
      const store = getStore('documents');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /** 更新文档（自动保存版本历史） */
  async update(id, changes) {
    await openDB();
    const doc = await DocDB.get(id);
    if (!doc) throw new Error(`文档 ${id} 不存在`);

    const now = Date.now();
    const oldContent = doc.content;

    // 应用变更
    Object.assign(doc, changes, {
      updatedAt: now,
      syncStatus: 'dirty',
      version: (doc.version || 1) + 1,
    });

    const stores = tx(['documents', 'versions', 'searchIndex']);

    // 保存更新后的文档
    await stores.documents.put(doc);

    // 保存版本快照
    const changeSummary = computeChangeSummary(oldContent, doc.content);
    await stores.versions.add({
      docId: id,
      content: doc.content,
      html: doc.html || '',
      timestamp: now,
      changeSummary,
    });

    // 重建搜索索引
    await updateSearchIndex(stores.searchIndex, id, doc.content);

    // 加入同步队列
    await stores.syncQueue.add({
      type: 'update',
      docId: id,
      data: { title: doc.title, content: doc.content, tags: doc.tags },
      timestamp: now,
      retryCount: 0,
    });

    await stores.complete;
    return doc;
  },

  /** 删除文档（同时删除版本历史和搜索索引） */
  async delete(id) {
    await openDB();
    const doc = await DocDB.get(id);
    if (!doc) throw new Error(`文档 ${id} 不存在`);

    const stores = tx(['documents', 'versions', 'searchIndex', 'syncQueue']);

    // 删除文档
    await stores.documents.delete(id);

    // 删除所有版本
    const versionIndex = stores.versions.index('docId');
    const versionRequest = versionIndex.getAll(id);
    await new Promise(resolve => {
      versionRequest.onsuccess = () => {
        versionRequest.result.forEach(v => stores.versions.delete(v.id));
        resolve();
      };
    });

    // 清理搜索索引
    await removeFromSearchIndex(stores.searchIndex, id);

    // 加入同步队列
    await stores.syncQueue.add({
      type: 'delete',
      docId: id,
      data: null,
      timestamp: Date.now(),
      retryCount: 0,
    });

    await stores.complete;
  },

  /** 列出所有文档 */
  async list(options = {}) {
    await openDB();
    return new Promise((resolve, reject) => {
      const store = getStore('documents');
      const index = options.sortBy === 'title'
        ? store.index('title')
        : store.index('updatedAt');

      const direction = options.desc !== false ? 'prev' : 'asc';
      const request = index.openCursor(null, direction);
      const results = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          // 过滤
          let filtered = results;
          if (options.tag) {
            filtered = filtered.filter(d => d.tags?.includes(options.tag));
          }
          if (options.syncStatus) {
            filtered = filtered.filter(d => d.syncStatus === options.syncStatus);
          }
          if (options.limit) {
            filtered = filtered.slice(0, options.limit);
          }
          resolve(filtered);
          return;
        }
        results.push(cursor.value);
        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  },

  /** 获取文档版本历史 */
  async getVersions(docId, options = {}) {
    await openDB();
    return new Promise((resolve, reject) => {
      const store = getStore('versions');
      const index = store.index('docId_timestamp');
      const results = [];

      const request = index.openCursor(IDBKeyRange.bound(
        [docId, 0],
        [docId, Infinity],
        false,
        false
      ), 'prev');

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          if (options.limit) resolve(results.slice(0, options.limit));
          else resolve(results);
          return;
        }
        results.push(cursor.value);
        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  },

  /** 获取版本差异 */
  async getDiff(docId, versionA, versionB) {
    const versions = await DocDB.getVersions(docId);
    const a = versions.find(v => v.id === versionA);
    const b = versions.find(v => v.id === versionB);

    if (!a || !b) return null;

    return computeDiff(a.content, b.content);
  },

  /** 恢复指定版本 */
  async restoreVersion(docId, versionId) {
    const versions = await DocDB.getVersions(docId);
    const target = versions.find(v => v.id === versionId);
    if (!target) throw new Error(`版本 ${versionId} 不存在`);

    return DocDB.update(docId, {
      content: target.content,
      html: target.html,
    });
  },

  /** 统计信息 */
  async stats() {
    await openDB();
    return new Promise((resolve, reject) => {
      const stores = {
        documents: getStore('documents'),
        versions: getStore('versions'),
        searchIndex: getStore('searchIndex'),
        syncQueue: getStore('syncQueue'),
        images: getStore('images'),
      };

      const results = {};
      let pending = Object.keys(stores).length;

      for (const [name, store] of Object.entries(stores)) {
        const request = store.count();
        request.onsuccess = () => {
          results[name] = request.result;
          if (--pending === 0) resolve(results);
        };
        request.onerror = () => reject(request.error);
      }
    });
  },
};

// ============================================================
// 全文搜索索引
// ============================================================

/** 中文/英文分词 */
function tokenize(text) {
  if (!text) return [];

  const tokens = [];

  // 英文分词
  const englishWords = text.match(/[a-zA-Z]+(?:'[a-zA-Z]+)?/g) || [];
  tokens.push(...englishWords.map(w => w.toLowerCase()));

  // 中文分词 — 基于 N-gram（简化版，实际项目用 jieba 等）
  const chineseChars = text.match(/[\u4e00-\u9fff]+/g) || [];
  for (const sentence of chineseChars) {
    // 2-gram
    for (let i = 0; i < sentence.length - 1; i++) {
      tokens.push(sentence.slice(i, i + 2));
    }
    // 单字（提高召回率）
    if (sentence.length === 1) {
      tokens.push(sentence);
    }
  }

  // 数字
  const numbers = text.match(/\d+/g) || [];
  tokens.push(...numbers);

  // 去重
  return [...new Set(tokens)];
}

/** 更新搜索索引 */
async function updateSearchIndex(searchStore, docId, content) {
  const tokens = tokenize(content);
  const existingWords = new Set();

  // 获取该文档已有的索引词
  const cursorRequest = searchStore.openCursor();
  await new Promise(resolve => {
    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) { resolve(); return; }

      if (cursor.value.docIds && cursor.value.docIds.has(docId)) {
        existingWords.add(cursor.key);
      }
      cursor.continue();
    };
  });

  const newWords = new Set(tokens);

  // 删除不再需要的索引
  for (const word of existingWords) {
    if (!newWords.has(word)) {
      const entry = await new Promise((resolve) => {
        const req = searchStore.get(word);
        req.onsuccess = () => resolve(req.result);
      });
      if (entry) {
        entry.docIds.delete(docId);
        delete entry.positions?.[docId];
        if (entry.docIds.size === 0) {
          await searchStore.delete(word);
        } else {
          await searchStore.put(entry);
        }
      }
    }
  }

  // 添加/更新新词的索引
  for (const word of tokens) {
    let entry = await new Promise((resolve) => {
      const req = searchStore.get(word);
      req.onsuccess = () => resolve(req.result);
    });

    if (!entry) {
      entry = { word, docIds: new Set(), positions: {} };
    }

    entry.docIds.add(docId);

    // 记录位置
    if (!entry.positions[docId]) {
      entry.positions[docId] = [];
    }
    // 找到所有出现位置
    let idx = content.toLowerCase().indexOf(word.toLowerCase());
    while (idx !== -1) {
      entry.positions[docId].push(idx);
      idx = content.toLowerCase().indexOf(word.toLowerCase(), idx + 1);
    }

    await searchStore.put(entry);
  }
}

/** 从搜索索引中移除文档 */
async function removeFromSearchIndex(searchStore, docId) {
  return new Promise((resolve, reject) => {
    const cursorRequest = searchStore.openCursor();
    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) { resolve(); return; }

      const entry = cursor.value;
      if (entry.docIds && entry.docIds.has(docId)) {
        entry.docIds.delete(docId);
        delete entry.positions?.[docId];
        if (entry.docIds.size === 0) {
          cursor.delete();
        } else {
          cursor.update(entry);
        }
      }
      cursor.continue();
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
}

/** 搜索 */
async function search(query) {
  await openDB();
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const store = getStore('searchIndex');

  // 收集每个词匹配的文档
  const docScores = new Map(); // docId → { score, matchWords }

  for (const token of tokens) {
    const entry = await new Promise((resolve) => {
      const req = store.get(token);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    if (entry && entry.docIds) {
      for (const docId of entry.docIds) {
        if (!docScores.has(docId)) {
          docScores.set(docId, { score: 0, matchWords: new Set() });
        }
        const info = docScores.get(docId);
        info.score += 1;
        info.matchWords.add(token);

        // 位置加分：出现在标题附近权重更高
        const positions = entry.positions?.[docId] || [];
        if (positions.length > 0) {
          // 前 200 字符内出现 → 可能是标题
          if (positions.some(p => p < 200)) {
            info.score += 2;
          }
        }
      }
    }
  }

  // 获取匹配的文档
  const results = [];
  for (const [docId, info] of docScores) {
    const doc = await DocDB.get(docId);
    if (doc) {
      results.push({
        ...doc,
        _searchScore: info.score,
        _matchWords: [...info.matchWords],
      });
    }
  }

  // 按相关性排序
  results.sort((a, b) => b._searchScore - a._searchScore);
  return results;
}

// ============================================================
// 图片管理
// ============================================================

const ImageDB = {
  /** 保存图片 */
  async save(file, referencedBy = []) {
    await openDB();
    const id = crypto.randomUUID?.() || `img-${Date.now()}`;
    const data = await file.arrayBuffer();

    // 生成缩略图（如果是图片）
    let thumbnail = null;
    if (file.type.startsWith('image/')) {
      thumbnail = await generateThumbnail(data, file.type);
    }

    const image = {
      id,
      name: file.name,
      type: file.type,
      data,
      size: data.byteLength,
      thumbnail,
      createdAt: Date.now(),
      referencedBy,
    };

    const store = getStore('images', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.add(image);
      request.onsuccess = resolve;
      request.onerror = reject;
    });

    return image;
  },

  /** 获取图片 */
  async get(id) {
    await openDB();
    return new Promise((resolve, reject) => {
      const store = getStore('images');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /** 获取图片 URL（Blob URL） */
  async getUrl(id) {
    const image = await ImageDB.get(id);
    if (!image) return null;
    return URL.createObjectURL(new Blob([image.data], { type: image.type }));
  },

  /** 获取缩略图 URL */
  async getThumbnailUrl(id) {
    const image = await ImageDB.get(id);
    if (!image?.thumbnail) return null;
    return URL.createObjectURL(new Blob([image.thumbnail], { type: 'image/jpeg' }));
  },

  /** 添加引用 */
  async addReference(imageId, docId) {
    await openDB();
    const store = getStore('images', 'readwrite');
    const image = await new Promise((resolve, reject) => {
      const req = store.get(imageId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = reject;
    });
    if (image && !image.referencedBy.includes(docId)) {
      image.referencedBy.push(docId);
      await store.put(image);
    }
  },

  /** 删除图片（仅在无引用时） */
  async delete(id) {
    await openDB();
    const image = await ImageDB.get(id);
    if (!image) return;
    if (image.referencedBy.length > 0) {
      throw new Error(`图片仍被 ${image.referencedBy.length} 个文档引用`);
    }
    const store = getStore('images', 'readwrite');
    await store.delete(id);
  },

  /** 列出所有图片 */
  async list() {
    await openDB();
    return new Promise((resolve, reject) => {
      const store = getStore('images');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = reject;
    });
  },
};

/** 生成缩略图 */
async function generateThumbnail(data, mimeType) {
  return new Promise((resolve) => {
    try {
      const blob = new Blob([data], { type: mimeType });
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        const canvas = document.createElement('canvas');
        const MAX = 150;
        let w = img.width; let
          h = img.height;
        if (w > MAX || h > MAX) {
          const ratio = Math.min(MAX / w, MAX / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(thumbBlob => {
          if (thumbBlob) {
            thumbBlob.arrayBuffer().then(resolve).catch(() => resolve(null));
          } else resolve(null);
        }, 'image/jpeg', 0.7);
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    } catch {
      resolve(null);
    }
  });
}

// ============================================================
// 同步队列
// ============================================================

const SyncQueue = {
  /** 获取待同步项 */
  async pending() {
    await openDB();
    return new Promise((resolve, reject) => {
      const store = getStore('syncQueue');
      const index = store.index('timestamp');
      const results = [];
      const request = index.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) { resolve(results); return; }
        results.push(cursor.value);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  },

  /** 标记为已同步 */
  async markSynced(id) {
    await openDB();
    const store = getStore('syncQueue', 'readwrite');
    await store.delete(id);
  },

  /** 增加重试次数 */
  async retry(id) {
    await openDB();
    const store = getStore('syncQueue', 'readwrite');
    const item = await new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = reject;
    });
    if (item) {
      item.retryCount = (item.retryCount || 0) + 1;
      await store.put(item);
    }
  },

  /** 清空队列 */
  async clear() {
    await openDB();
    const store = getStore('syncQueue', 'readwrite');
    await store.clear();
  },
};

// ============================================================
// 存储空间监控
// ============================================================

const StorageMonitor = {
  /** 获取存储配额和使用量 */
  async getUsage() {
    if (!navigator.storage?.estimate) {
      return { quota: null, usage: null, percent: null };
    }

    const estimate = await navigator.storage.estimate();
    return {
      quota: estimate.quota,
      usage: estimate.usage,
      percent: Math.round((estimate.usage / estimate.quota) * 100),
      usageMB: (estimate.usage / 1024 / 1024).toFixed(2),
      quotaMB: (estimate.quota / 1024 / 1024).toFixed(2),
    };
  },

  /** 检查是否接近配额 */
  async isNearQuota(threshold = 80) {
    const { percent } = await StorageMonitor.getUsage();
    return percent !== null && percent >= threshold;
  },

  /** 获取各 store 大小估算 */
  async storeSizes() {
    await openDB();
    const stats = await DocDB.stats();
    const images = await ImageDB.list();

    let imageBytes = 0;
    for (const img of images) {
      imageBytes += (img.data?.byteLength || 0) + (img.thumbnail?.byteLength || 0);
    }

    return {
      documents: stats.documents,
      versions: stats.versions,
      searchEntries: stats.searchIndex,
      syncQueue: stats.syncQueue,
      images: stats.images,
      imageStorageBytes: imageBytes,
      imageStorageMB: (imageBytes / 1024 / 1024).toFixed(2),
    };
  },
};

// ============================================================
// 数据导出/导入
// ============================================================

const ExportImport = {
  /** 导出所有数据为 JSON */
  async exportAll() {
    const documents = await DocDB.list({ limit: 10000 });
    const versions = [];
    const images = await ImageDB.list();

    // 导出每个文档的版本
    for (const doc of documents) {
      const docVersions = await DocDB.getVersions(doc.id);
      versions.push(...docVersions);
    }

    // 图片转 base64（JSON 可序列化）
    const exportImages = images.map(img => ({
      ...img,
      data: arrayBufferToBase64(img.data),
      thumbnail: img.thumbnail ? arrayBufferToBase64(img.thumbnail) : null,
    }));

    return {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      documents,
      versions,
      images: exportImages,
    };
  },

  /** 从 JSON 导入 */
  async importAll(data) {
    if (!data.documents || !Array.isArray(data.documents)) {
      throw new Error('无效的数据格式');
    }

    await openDB();

    // 导入文档和版本
    const docStore = getStore('documents', 'readwrite');
    const verStore = getStore('versions', 'readwrite');
    const searchStore = getStore('searchIndex', 'readwrite');

    for (const doc of data.documents) {
      await docStore.put(doc);
      // 更新搜索索引
      await updateSearchIndex(searchStore, doc.id, doc.content);
    }

    // 导入版本
    if (data.versions) {
      for (const ver of data.versions) {
        await verStore.add(ver);
      }
    }

    // 导入图片
    if (data.images) {
      const imgStore = getStore('images', 'readwrite');
      for (const img of data.images) {
        const imageData = {
          ...img,
          data: base64ToArrayBuffer(img.data),
          thumbnail: img.thumbnail ? base64ToArrayBuffer(img.thumbnail) : null,
        };
        await imgStore.put(imageData);
      }
    }
  },

  /** 下载为文件 */
  async download() {
    const data = await ExportImport.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wikibase-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ============================================================
// 工具函数
// ============================================================

/** 计算变更摘要 */
function computeChangeSummary(oldContent, newContent) {
  if (!oldContent && newContent) return '创建文档';
  if (oldContent && !newContent) return '清空内容';

  const oldLen = oldContent.length;
  const newLen = newContent.length;
  const diff = newLen - oldLen;

  if (diff > 0) return `新增 ${diff} 字符`;
  if (diff < 0) return `删除 ${Math.abs(diff)} 字符`;
  return '内容修改';
}

/** 计算差异（简化版行级 diff） */
function computeDiff(oldText, newText) {
  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');

  const changes = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined) {
      changes.push({ type: 'add', line: i + 1, text: newLine });
    } else if (newLine === undefined) {
      changes.push({ type: 'delete', line: i + 1, text: oldLine });
    } else if (oldLine !== newLine) {
      changes.push({ type: 'modify', line: i + 1, old: oldLine, new: newLine });
    }
  }

  return changes;
}

/** ArrayBuffer ↔ Base64 转换 */
function arrayBufferToBase64(buffer) {
  if (!buffer) return null;
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 8192) {
    const chunk = bytes.subarray(i, i + 8192);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  if (!base64) return null;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ============================================================
// 导出
// ============================================================

if (typeof module !== 'undefined') {
  module.exports = {
    openDB,
    DocDB,
    ImageDB,
    SyncQueue,
    StorageMonitor,
    ExportImport,
    search,
    tokenize,
  };
}
