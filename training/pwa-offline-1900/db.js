/**
 * IndexedDB 封装 — 离线数据持久化层
 *
 * 提供两个对象仓库：
 * 1. notes — 笔记数据（增删改查）
 * 2. syncQueue — 离线操作队列（待同步到服务器）
 *
 * 技术要点：
 * - 使用 Promise 封装所有异步操作
 * - 自动生成 UUID 作为主键
 * - 支持全文搜索（标题+内容模糊匹配）
 * - 操作队列支持 FIFO 出队
 */

class OfflineDB {
  constructor() {
    this.DB_NAME = 'OfflineNotesDB';
    this.DB_VERSION = 2;
    this.db = null;
  }

  /**
   * 初始化数据库
   * 首次打开时创建对象仓库和索引
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      // 数据库升级/初始化
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('[DB] 数据库升级，版本:', event.oldVersion, '→', event.newVersion);

        // 笔记仓库
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          notesStore.createIndex('title', 'title', { unique: false });
          notesStore.createIndex('category', 'category', { unique: false });
          console.log('[DB] 创建 notes 对象仓库');
        }

        // 同步队列仓库
        if (!db.objectStoreNames.contains('syncQueue')) {
          const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          queueStore.createIndex('status', 'status', { unique: false });
          queueStore.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('[DB] 创建 syncQueue 对象仓库');
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('[DB] 数据库连接成功');

        // 监听数据库连接中断
        this.db.onclose = () => {
          console.warn('[DB] 数据库连接关闭，正在重连...');
          this.db = null;
          this.init();
        };

        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[DB] 数据库打开失败:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * 生成唯一 ID
   */
  static _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  /**
   * 事务工具方法
   */
  _tx(storeName, mode = 'readonly') {
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  // ============================================
  // Notes 操作
  // ============================================

  /**
   * 添加笔记
   */
  async addNote(note) {
    await this.init();
    const id = this._generateId();
    const now = Date.now();

    const data = {
      id,
      title: note.title || '无标题',
      content: note.content || '',
      category: note.category || 'default',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending', // pending | synced | conflict
    };

    return new Promise((resolve, reject) => {
      const store = this._tx('notes', 'readwrite');
      const request = store.add(data);

      request.onsuccess = () => {
        console.log('[DB] 笔记已添加:', id);
        // 同时加入同步队列
        this._addToSyncQueue({ action: 'add', noteId: id, data });
        resolve(data);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 更新笔记
   */
  async updateNote(id, updates) {
    await this.init();
    const existing = await this.getNote(id);
    if (!existing) throw new Error('笔记不存在: ' + id);

    const data = {
      ...existing,
      ...updates,
      id,
      updatedAt: Date.now(),
      syncStatus: 'pending',
    };

    return new Promise((resolve, reject) => {
      const store = this._tx('notes', 'readwrite');
      const request = store.put(data);

      request.onsuccess = () => {
        console.log('[DB] 笔记已更新:', id);
        this._addToSyncQueue({ action: 'update', noteId: id, data });
        resolve(data);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 删除笔记
   */
  async deleteNote(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const store = this._tx('notes', 'readwrite');
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('[DB] 笔记已删除:', id);
        this._addToSyncQueue({ action: 'delete', noteId: id });
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取单条笔记
   */
  async getNote(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const store = this._tx('notes');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取所有笔记（按更新时间倒序）
   */
  async getAllNotes() {
    await this.init();

    return new Promise((resolve, reject) => {
      const store = this._tx('notes');
      const index = store.index('updatedAt');
      const request = index.openCursor(null, 'prev'); // 倒序
      const results = [];

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

  /**
   * 搜索笔记（标题+内容模糊匹配）
   */
  async searchNotes(query) {
    const allNotes = await this.getAllNotes();
    const lowerQuery = query.toLowerCase();

    return allNotes.filter((note) => note.title.toLowerCase().includes(lowerQuery)
      || note.content.toLowerCase().includes(lowerQuery));
  }

  /**
   * 按分类获取笔记
   */
  async getNotesByCategory(category) {
    await this.init();

    return new Promise((resolve, reject) => {
      const store = this._tx('notes');
      const index = store.index('category');
      const request = index.getAll(category);

      request.onsuccess = () => {
        const results = request.result || [];
        results.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(results);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取笔记统计信息
   */
  async getStats() {
    const allNotes = await this.getAllNotes();
    const categories = {};

    allNotes.forEach((note) => {
      categories[note.category] = (categories[note.category] || 0) + 1;
    });

    return {
      total: allNotes.length,
      categories,
      lastUpdated: allNotes[0]?.updatedAt || null,
    };
  }

  // ============================================
  // SyncQueue 操作（离线操作队列）
  // ============================================

  /**
   * 添加操作到同步队列（内部方法）
   */
  async _addToSyncQueue(operation) {
    await this.init();

    const data = {
      id: this._generateId(),
      ...operation,
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const store = this._tx('syncQueue', 'readwrite');
      const request = store.add(data);

      request.onsuccess = () => {
        console.log('[DB] 同步队列添加:', data.action, data.noteId);
        resolve(data);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取待同步操作
   */
  async getPendingSyncs() {
    await this.init();

    return new Promise((resolve, reject) => {
      const store = this._tx('syncQueue');
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => {
        const results = request.result || [];
        results.sort((a, b) => a.createdAt - b.createdAt); // FIFO
        resolve(results);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 标记同步操作为已完成
   */
  async markSynced(syncId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const store = this._tx('syncQueue', 'readwrite');
      const getRequest = store.get(syncId);

      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (!data) return resolve();

        data.status = 'synced';
        data.syncedAt = Date.now();

        const putRequest = store.put(data);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * 获取待同步数量
   */
  async getPendingCount() {
    const pending = await this.getPendingSyncs();
    return pending.length;
  }

  /**
   * 清空同步队列
   */
  async clearSyncQueue() {
    await this.init();

    return new Promise((resolve, reject) => {
      const store = this._tx('syncQueue', 'readwrite');
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[DB] 同步队列已清空');
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 导出所有数据（用于备份）
   */
  async exportAll() {
    const notes = await this.getAllNotes();
    const syncs = await this.getPendingSyncs();

    return {
      version: this.DB_VERSION,
      exportedAt: Date.now(),
      notes,
      pendingSyncs: syncs,
    };
  }

  /**
   * 导入数据（用于恢复）
   */
  async importData(data) {
    await this.init();

    if (data.notes && Array.isArray(data.notes)) {
      const store = this._tx('notes', 'readwrite');
      for (const note of data.notes) {
        store.put(note);
      }
      console.log('[DB] 导入', data.notes.length, '条笔记');
    }

    return { imported: data.notes?.length || 0 };
  }
}

// 全局实例
const db = new OfflineDB();

export default db;
