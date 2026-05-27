/**
 * 离线笔记应用 — 核心逻辑
 *
 * 功能:
 * 1. 笔记 CRUD (离线可用)
 * 2. 分类管理
 * 3. 搜索功能
 * 4. 离线同步
 * 5. 冲突解决
 * 6. UI 状态管理
 *
 * 技术栈:
 * - IndexedDB: 离线数据存储
 * - Service Worker: 离线缓存
 * - Cache API: 静态资源缓存
 * - Fetch API: 网络请求
 * - BroadcastChannel: 跨标签页通信
 */

const { NotesDatabase } = require('./04-indexeddb');
const { OfflineQueue, ConflictResolver } = require('./05-offline-queue');

// ==================== 离线笔记应用 ====================

class OfflineNotesApp {
  constructor(options = {}) {
    this.db = new NotesDatabase('offline-notes');
    this.queue = new OfflineQueue({ db: this.db });
    this.notes = [];
    this.categories = [];
    this.currentNote = null;
    this.searchQuery = '';
    this.filterCategory = null;
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;

    // API 基础 URL
    this.apiUrl = options.apiUrl || '/api';

    // 跨标签页通信
    this.channel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('offline-notes')
      : null;

    // 事件回调
    this.onNotesChange = options.onNotesChange || null;
    this.onStatusChange = options.onStatusChange || null;
    this.onSyncProgress = options.onSyncProgress || null;
  }

  // ==================== 初始化 ====================

  /**
   * 初始化应用
   */
  async init() {
    console.log('[OfflineNotes] 初始化应用...');

    // 打开数据库
    await this.db.open();
    await this.queue.init();

    // 加载数据
    await this.loadNotes();
    await this.loadCategories();

    // 监听网络状态
    this.setupNetworkListeners();

    // 设置跨标签页通信
    this.setupBroadcastChannel();

    // 定期同步
    this.startPeriodicSync();

    console.log('[OfflineNotes] 应用初始化完成');
    console.log('[OfflineNotes]', await this.db.getStats());

    return this;
  }

  // ==================== 笔记操作 ====================

  /**
   * 加载所有笔记
   */
  async loadNotes() {
    this.notes = await this.db.getAllNotes();
    this.notifyNotesChange();
    return this.notes;
  }

  /**
   * 创建笔记
   */
  async createNote(noteData) {
    const note = {
      ...noteData,
      id: this.db.generateId(),
      status: 'local',
    };

    await this.db.createNote(note);

    // 入队同步
    if (!this.isOnline) {
      await this.queue.enqueue({
        type: 'create',
        store: 'notes',
        data: note,
      });
    } else {
      // 在线时尝试同步到服务器
      await this.syncNoteToServer(note, 'POST');
    }

    // 重新加载
    await this.loadNotes();

    // 通知其他标签页
    this.broadcast({ type: 'note-created', data: note });

    return note;
  }

  /**
   * 更新笔记
   */
  async updateNote(id, updates) {
    const existing = await this.db.get('notes', id);
    if (!existing) throw new Error(`笔记不存在: ${id}`);

    const updated = {
      ...existing,
      ...updates,
      id,
      status: 'local',
      updatedAt: Date.now(),
    };

    await this.db.updateNote(id, updates);

    // 入队同步
    if (!this.isOnline) {
      await this.queue.enqueue({
        type: 'update',
        store: 'notes',
        data: updated,
      });
    } else {
      await this.syncNoteToServer(updated, 'PUT');
    }

    await this.loadNotes();
    this.broadcast({ type: 'note-updated', data: updated });

    return updated;
  }

  /**
   * 删除笔记
   */
  async deleteNote(id) {
    const note = await this.db.get('notes', id);

    await this.db.deleteNote(id);

    // 入队同步
    if (!this.isOnline && note) {
      await this.queue.enqueue({
        type: 'delete',
        store: 'notes',
        data: { id },
      });
    } else if (note) {
      await this.syncNoteToServer({ id }, 'DELETE');
    }

    await this.loadNotes();
    this.broadcast({ type: 'note-deleted', data: { id } });
  }

  /**
   * 搜索笔记
   */
  async searchNotes(query) {
    this.searchQuery = query;
    if (!query) return this.notes;

    const results = await this.db.searchNotes(query);
    return results;
  }

  /**
   * 获取单条笔记
   */
  async getNote(id) {
    return this.db.get('notes', id);
  }

  /**
   * 置顶/取消置顶
   */
  async togglePin(id) {
    const note = await this.db.get('notes', id);
    if (!note) return;

    await this.db.updateNote(id, { isPinned: !note.isPinned });
    await this.loadNotes();
  }

  // ==================== 分类管理 ====================

  /**
   * 加载分类
   */
  async loadCategories() {
    const cached = await this.db.getSetting('categories');
    if (cached) {
      this.categories = cached;
    } else {
      this.categories = [
        {
          id: 'default',
          name: '默认分类',
          color: '#4a90d9',
          icon: '📝',
        },
        {
          id: 'work',
          name: '工作',
          color: '#e74c3c',
          icon: '💼',
        },
        {
          id: 'personal',
          name: '个人',
          color: '#27ae60',
          icon: '🏠',
        },
        {
          id: 'ideas',
          name: '灵感',
          color: '#f39c12',
          icon: '💡',
        },
      ];
      await this.db.setSetting('categories', this.categories);
    }
    return this.categories;
  }

  /**
   * 添加分类
   */
  async addCategory(category) {
    const id = this.db.generateId();
    const newCategory = { id, ...category };
    this.categories.push(newCategory);
    await this.db.setSetting('categories', this.categories);
    return newCategory;
  }

  /**
   * 按分类筛选
   */
  filterByCategory(categoryId) {
    this.filterCategory = categoryId;
    if (!categoryId) return this.notes;

    return this.notes.filter((note) => note.categoryId === categoryId);
  }

  // ==================== 同步机制 ====================

  /**
   * 同步到服务器
   */
  async syncToServer() {
    if (this.syncInProgress) {
      console.log('[OfflineNotes] 同步已在进行中');
      return;
    }

    if (!this.isOnline) {
      console.log('[OfflineNotes] 离线状态，跳过同步');
      return;
    }

    this.syncInProgress = true;
    console.log('[OfflineNotes] 开始同步...');

    try {
      // 1. 同步离线队列
      const pending = await this.queue.getPendingRequests();
      const total = pending.length;

      for (let i = 0; i < pending.length; i++) {
        const entry = pending[i];
        this.notifySyncProgress(i + 1, total, entry);

        try {
          await this.queue.processEntry(entry);
        } catch (err) {
          console.warn('[OfflineNotes] 同步条目失败:', err);
        }
      }

      // 2. 拉取服务器最新数据
      await this.pullFromServer();

      // 3. 清理已同步的队列
      await this.queue.cleanSynced();

      console.log('[OfflineNotes] 同步完成');
      this.notifySyncProgress(total, total, null);
    } catch (error) {
      console.error('[OfflineNotes] 同步失败:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 同步单条笔记到服务器
   */
  async syncNoteToServer(note, method) {
    try {
      const response = await fetch(`${this.apiUrl}/notes/${note.id || ''}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method !== 'DELETE' ? JSON.stringify(note) : undefined,
      });

      if (response.ok) {
        const serverNote = await response.json().catch(() => null);
        if (serverNote) {
          // 更新本地状态为已同步
          await this.db.updateNote(note.id, { status: 'synced' });
        }
      }
    } catch (error) {
      console.warn('[OfflineNotes] 同步失败，将加入离线队列:', error);
      await this.queue.enqueue({
        type: method.toLowerCase(),
        store: 'notes',
        data: note,
      });
    }
  }

  /**
   * 从服务器拉取数据
   */
  async pullFromServer() {
    try {
      const response = await fetch(
        `${this.apiUrl}/notes?since=${this.getLastSyncTime()}`,
      );
      if (!response.ok) return;

      const serverNotes = await response.json();
      const localNotes = await this.db.getAll('notes');

      // 合并数据 (处理冲突)
      for (const serverNote of serverNotes) {
        const localNote = localNotes.find((n) => n.id === serverNote.id);

        if (!localNote) {
          // 新笔记，直接添加
          await this.db.createNote(serverNote);
        } else if (localNote.status === 'local') {
          // 本地有修改，需要解决冲突
          const resolved = ConflictResolver.lastWriteWins(
            localNote,
            serverNote,
          );
          await this.db.updateNote(resolved.id, resolved);
        } else {
          // 本地未修改，使用服务器数据
          await this.db.updateNote(serverNote.id, serverNote);
        }
      }

      // 更新最后同步时间
      await this.db.setSetting('lastSyncTime', Date.now());

      // 重新加载
      await this.loadNotes();
    } catch (error) {
      console.warn('[OfflineNotes] 拉取服务器数据失败:', error);
    }
  }

  /**
   * 获取最后同步时间
   */
  async getLastSyncTime() {
    const time = await this.db.getSetting('lastSyncTime');
    return time || 0;
  }

  // ==================== 网络监听 ====================

  setupNetworkListeners() {
    window.addEventListener('online', async () => {
      console.log('[OfflineNotes] 🟢 网络已恢复');
      this.isOnline = true;
      this.notifyStatusChange(true);

      // 自动同步
      await this.syncToServer();
    });

    window.addEventListener('offline', () => {
      console.log('[OfflineNotes] 🔴 网络已断开');
      this.isOnline = false;
      this.notifyStatusChange(false);
    });
  }

  // ==================== 跨标签页通信 ====================

  setupBroadcastChannel() {
    if (!this.channel) return;

    this.channel.onmessage = async (event) => {
      const { type, data } = event.data;

      switch (type) {
        case 'note-created':
        case 'note-updated':
        case 'note-deleted':
          // 其他标签页修改了笔记，重新加载
          await this.loadNotes();
          break;

        case 'sync-complete':
          // 其他标签页完成了同步
          await this.loadNotes();
          break;
      }
    };
  }

  /**
   * 广播事件到其他标签页
   */
  broadcast(message) {
    if (this.channel) {
      this.channel.postMessage(message);
    }
  }

  // ==================== 定期同步 ====================

  startPeriodicSync(interval = 60000) {
    // 每分钟检查一次
    setInterval(async () => {
      if (this.isOnline && !this.syncInProgress) {
        const pending = await this.queue.getPendingRequests();
        if (pending.length > 0) {
          await this.syncToServer();
        }
      }
    }, interval);
  }

  // ==================== 事件通知 ====================

  notifyNotesChange() {
    if (this.onNotesChange) {
      this.onNotesChange(this.notes);
    }
  }

  notifyStatusChange(isOnline) {
    if (this.onStatusChange) {
      this.onStatusChange(isOnline);
    }
  }

  notifySyncProgress(current, total, entry) {
    if (this.onSyncProgress) {
      this.onSyncProgress({ current, total, entry });
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 获取应用统计
   */
  async getStats() {
    const dbStats = await this.db.getStats();
    const queueStatus = await this.queue.getQueueStatus();
    const lastSync = await this.db.getSetting('lastSyncTime');

    return {
      ...dbStats,
      queue: queueStatus,
      isOnline: this.isOnline,
      lastSync: lastSync ? new Date(lastSync).toLocaleString() : '从未',
      syncInProgress: this.syncInProgress,
    };
  }

  /**
   * 导出所有笔记为 JSON
   */
  async exportNotes() {
    const notes = await this.db.getAll('notes');
    return JSON.stringify(notes, null, 2);
  }

  /**
   * 导入笔记
   */
  async importNotes(json) {
    const notes = JSON.parse(json);
    for (const note of notes) {
      await this.db.createNote(note);
    }
    await this.loadNotes();
  }

  /**
   * 销毁应用
   */
  destroy() {
    if (this.channel) {
      this.channel.close();
    }
    this.db.close();
  }
}

// ==================== 导出 ====================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OfflineNotesApp };
}
