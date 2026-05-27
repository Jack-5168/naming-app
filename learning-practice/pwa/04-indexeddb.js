/**
 * IndexedDB 完整封装
 *
 * 功能:
 * 1. 自动版本管理
 * 2. CRUD 操作 (create/read/update/delete)
 * 3. 游标遍历
 * 4. 索引查询
 * 5. 批量操作
 * 6. 事务管理
 * 7. 离线队列存储
 *
 * 设计原则:
 * - Promise 化 API
 * - 类型安全 (JSDoc)
 * - 错误处理
 * - 版本迁移
 */

// ==================== IndexedDB 核心封装 ====================

/**
 * IndexedDB 数据库封装类
 */
class IndexedDB {
  /**
   * @param {string} dbName - 数据库名称
   * @param {number} version - 数据库版本
   * @param {Function} upgradeCallback - 版本升级回调
   */
  constructor(dbName, version = 1, upgradeCallback = null) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.upgradeCallback = upgradeCallback;
  }

  /**
   * 打开数据库连接
   */
  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      // 版本升级
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log(
          `[IndexedDB] 版本升级: ${event.oldVersion} → ${event.newVersion}`,
        );

        if (this.upgradeCallback) {
          this.upgradeCallback(db, event.oldVersion);
        }
      };

      // 打开成功
      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log(
          `[IndexedDB] 数据库已打开: ${this.dbName} (v${this.version})`,
        );
        resolve(this.db);
      };

      // 打开失败
      request.onerror = (event) => {
        console.error(
          `[IndexedDB] 打开失败: ${this.dbName}`,
          event.target.error,
        );
        reject(event.target.error);
      };
    });
  }

  /**
   * 关闭数据库
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log(`[IndexedDB] 数据库已关闭: ${this.dbName}`);
    }
  }

  /**
   * 删除数据库
   */
  static async deleteDB(dbName) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ==================== CRUD 操作 ====================

  /**
   * 添加单条记录
   * @param {string} storeName - 对象存储空间名
   * @param {Object} data - 要添加的数据
   * @param {string} keyPath - 主键路径 (可选)
   */
  async add(storeName, data, keyPath = 'id') {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      const request = store.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 添加或更新记录 (put)
   */
  async put(storeName, data) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 根据主键获取记录
   */
  async get(storeName, key) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);

      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 获取所有记录
   */
  async getAll(storeName, query, count) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);

      const request = query ? store.getAll(query, count) : store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 根据主键删除记录
   */
  async delete(storeName, key) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 清空对象存储空间
   */
  async clear(storeName) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 获取记录数量
   */
  async count(storeName, query) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);

      const request = query ? store.count(query) : store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ==================== 游标遍历 ====================

  /**
   * 游标遍历所有记录
   * @param {string} storeName - 对象存储空间名
   * @param {Function} callback - 每条记录的回调函数
   * @param {Object} options - 选项 (direction, query)
   */
  async cursor(storeName, callback, options = {}) {
    await this.open();
    const { direction = 'next', query = null, indexName = null } = options;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const target = indexName ? store.index(indexName) : store;

      const request = target.openCursor(query, direction);
      const results = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const result = callback(cursor.value, cursor.key);
          if (result !== false) {
            results.push(cursor.value);
            cursor.continue();
          }
        } else {
          resolve(results);
        }
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 游标遍历 (可修改)
   */
  async cursorReadWrite(storeName, callback, options = {}) {
    await this.open();
    const { direction = 'next', query = null, indexName = null } = options;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const target = indexName ? store.index(indexName) : store;

      const request = target.openCursor(query, direction);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const action = callback(cursor.value, cursor);
          if (action === 'delete') {
            cursor.delete();
          } else if (action === 'update' && cursor.value) {
            cursor.update(cursor.value);
          } else {
            cursor.continue();
          }
        } else {
          resolve();
        }
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ==================== 索引查询 ====================

  /**
   * 通过索引获取记录
   */
  async getByIndex(storeName, indexName, value) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);

      const request = index.get(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 通过索引获取多条记录
   */
  async getAllByIndex(storeName, indexName, value) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);

      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ==================== 批量操作 ====================

  /**
   * 批量添加
   */
  async addBatch(storeName, items) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      items.forEach((item) => store.add(item));

      tx.oncomplete = () => resolve(items.length);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 批量更新
   */
  async putBatch(storeName, items) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      items.forEach((item) => store.put(item));

      tx.oncomplete = () => resolve(items.length);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 批量删除
   */
  async deleteBatch(storeName, keys) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      keys.forEach((key) => store.delete(key));

      tx.oncomplete = () => resolve(keys.length);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // ==================== 事务管理 ====================

  /**
   * 执行自定义事务
   * @param {string|string[]} storeNames - 对象存储空间名
   * @param {Function} callback - 事务回调
   * @param {string} mode - 事务模式 ('readonly' | 'readwrite')
   */
  async transaction(storeNames, callback, mode = 'readonly') {
    await this.open();
    const stores = Array.isArray(storeNames) ? storeNames : [storeNames];

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(stores, mode);
      const storesMap = {};

      stores.forEach((name) => {
        storesMap[name] = tx.objectStore(name);
      });

      tx.oncomplete = () => resolve(tx);
      tx.onerror = (e) => reject(e.target.error);
      tx.onabort = (e) => reject(new Error('事务被中止'));

      callback(storesMap, tx);
    });
  }
}

// ==================== 笔记应用数据库 ====================

/**
 * 笔记应用数据库
 */
class NotesDatabase extends IndexedDB {
  constructor() {
    super('offline-notes', 1, (db, oldVersion) => {
      // 版本 1: 初始化
      if (oldVersion < 1) {
        // 笔记表
        const notesStore = db.createObjectStore('notes', {
          keyPath: 'id',
          autoIncrement: false,
        });
        notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        notesStore.createIndex('categoryId', 'categoryId', { unique: false });
        notesStore.createIndex('isPinned', 'isPinned', { unique: false });
        notesStore.createIndex('status', 'status', { unique: false });

        // 离线操作队列
        const queueStore = db.createObjectStore('offlineQueue', {
          keyPath: 'id',
          autoIncrement: true,
        });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('synced', 'synced', { unique: false });

        // 应用设置
        db.createObjectStore('settings', {
          keyPath: 'key',
        });
      }

      // 版本 2: 添加标签索引
      if (oldVersion < 2) {
        const notesStore = db.createObjectStore('notes_temp', {
          keyPath: 'id',
        });
        // 迁移逻辑...
      }
    });
  }

  // ==================== 笔记操作 ====================

  /**
   * 创建笔记
   */
  async createNote(note) {
    const now = Date.now();
    const data = {
      id: note.id || this.generateId(),
      title: note.title || '未命名笔记',
      content: note.content || '',
      categoryId: note.categoryId || null,
      tags: note.tags || [],
      isPinned: note.isPinned || false,
      status: 'local', // local | synced | conflict
      createdAt: now,
      updatedAt: now,
    };
    return this.put('notes', data);
  }

  /**
   * 更新笔记
   */
  async updateNote(id, updates) {
    const existing = await this.get('notes', id);
    if (!existing) throw new Error(`笔记不存在: ${id}`);

    const updated = {
      ...existing,
      ...updates,
      id,
      status: 'local', // 标记为本地修改，待同步
      updatedAt: Date.now(),
    };

    return this.put('notes', updated);
  }

  /**
   * 删除笔记
   */
  async deleteNote(id) {
    return this.delete('notes', id);
  }

  /**
   * 获取所有笔记 (按更新时间倒序)
   */
  async getAllNotes() {
    const notes = await this.getAll('notes');
    return notes
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((note) => ({
        ...note,
        preview: this.getPreview(note.content),
      }));
  }

  /**
   * 搜索笔记
   */
  async searchNotes(query) {
    const notes = await this.getAll('notes');
    const lowerQuery = query.toLowerCase();

    return notes.filter(
      (note) => note.title.toLowerCase().includes(lowerQuery)
        || note.content.toLowerCase().includes(lowerQuery)
        || (note.tags || []).some((tag) => tag.toLowerCase().includes(lowerQuery)),
    );
  }

  /**
   * 按分类获取笔记
   */
  async getNotesByCategory(categoryId) {
    return this.getAllByIndex('notes', 'categoryId', categoryId);
  }

  /**
   * 获取置顶笔记
   */
  async getPinnedNotes() {
    return this.getAllByIndex('notes', 'isPinned', true);
  }

  /**
   * 获取内容预览
   */
  getPreview(content, maxLength = 100) {
    if (!content) return '';
    const plain = content.replace(/<[^>]*>/g, '');
    return plain.length > maxLength
      ? plain.substring(0, maxLength) + '...'
      : plain;
  }

  // ==================== 离线队列操作 ====================

  /**
   * 添加离线操作到队列
   */
  async addToQueue(operation) {
    const item = {
      type: operation.type, // 'create' | 'update' | 'delete'
      store: operation.store || 'notes',
      data: operation.data,
      timestamp: Date.now(),
      synced: false,
      retryCount: 0,
    };
    return this.add('offlineQueue', item);
  }

  /**
   * 获取所有未同步的操作
   */
  async getPendingOperations() {
    return this.getAllByIndex('offlineQueue', 'synced', false);
  }

  /**
   * 标记操作为已同步
   */
  async markSynced(id) {
    const item = await this.get('offlineQueue', id);
    if (item) {
      item.synced = true;
      item.syncedAt = Date.now();
      return this.put('offlineQueue', item);
    }
  }

  /**
   * 删除已同步的操作
   */
  async clearSyncedOperations() {
    return this.cursorReadWrite('offlineQueue', (item, cursor) => {
      if (item.synced) return 'delete';
    });
  }

  // ==================== 设置操作 ====================

  async getSetting(key) {
    const result = await this.get('settings', key);
    return result?.value;
  }

  async setSetting(key, value) {
    return this.put('settings', { key, value });
  }

  // ==================== 工具方法 ====================

  /**
   * 生成唯一 ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 获取数据库统计
   */
  async getStats() {
    return {
      notes: await this.count('notes'),
      pendingSync: await this.count('offlineQueue', IDBKeyRange.only(false)),
      settings: await this.count('settings'),
    };
  }
}

// ==================== 导出 ====================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    IndexedDB,
    NotesDatabase,
  };
}
