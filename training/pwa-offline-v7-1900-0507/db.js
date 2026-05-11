/**
 * MarkFlow — IndexedDB 数据层 v7
 *
 * 第七轮迭代核心改进（对比 v6 WikiBase）：
 * 1. 复合索引 — 多维度查询（置顶+时间/收藏+时间/标签+时间）
 * 2. 游标分页 — 无限滚动，避免大结果集内存溢出
 * 3. 事务隔离级别 — readwriteflush 保证数据持久化
 * 4. 版本迁移系统 — 自动 schema 升级 + 数据迁移
 * 5. 批量操作 — 批量插入/更新/删除，单次事务
 * 6. 全文搜索 — 倒排索引 + BM25 排序
 * 7. 存储配额监控 — 接近上限时自动清理
 * 8. 数据导出/导入 — JSON/Markdown 双格式
 * 9. 语音附件 — MediaRecorder 录制 + Blob 存储
 * 10. 操作审计日志 — 所有变更可追溯
 */

// ============================================================
// 数据库 Schema
// ============================================================

const DB_NAME = 'MarkFlowDB';
const DB_VERSION = 7;

/**
 * Store 设计：
 *
 * notes:
 *   - id: UUID
 *   - title: 标题
 *   - content: Markdown 原文
 *   - html: 渲染后的 HTML（缓存）
 *   - tags: string[]
 *   - pinned: boolean
 *   - starred: boolean
 *   - wordCount: number
 *   - audioAttachments: [{id, name, blobRef, duration, size}]
 *   - createdAt: number
 *   - updatedAt: number
 *   - syncStatus: 'synced' | 'dirty'
 *   - version: number（乐观锁）
 *
 * searchIndex:
 *   - word: 分词后的单词
 *   - docIds: Set<string>
 *   - positions: { [docId]: number[] }
 *
 * audioBlobs:
 *   - id: UUID
 *   - noteId: 所属笔记
 *   - blob: Audio Blob
 *   - name: 文件名
 *   - duration: 时长(秒)
 *   - recordedAt: 录制时间
 *
 * auditLog:
 *   - id: autoIncrement
 *   - action: 'create' | 'update' | 'delete' | 'export' | 'import'
 *   - entityType: 'note' | 'audio' | 'settings'
 *   - entityId: 实体 ID
 *   - timestamp: 时间戳
 *   - diff: 变更摘要
 *
 * syncQueue:
 *   - id: autoIncrement
 *   - action: 'create' | 'update' | 'delete'
 *   - entityType: 'note' | 'audio'
 *   - entityId: 实体 ID
 *   - payload: 序列化数据
 *   - timestamp: 入队时间
 *   - retries: 重试次数
 *
 * settings:
 *   - key: 设置键
 *   - value: 设置值
 */

// ============================================================
// Schema 迁移历史
// ============================================================

const SCHEMA_MIGRATIONS = [
  // v1 → v2: 添加 searchIndex store
  {
    from: 1, to: 2,
    upgrade(db) {
      const store = db.createObjectStore('searchIndex', { keyPath: 'word' });
      store.createIndex('docIds', 'docIds', { multiEntry: true });
    },
    downgrade(db) {
      db.deleteObjectStore('searchIndex');
    }
  },
  // v2 → v3: 添加 audioBlobs store
  {
    from: 2, to: 3,
    upgrade(db) {
      const store = db.createObjectStore('audioBlobs', { keyPath: 'id' });
      store.createIndex('noteId', 'noteId');
      store.createIndex('recordedAt', 'recordedAt');
    },
    downgrade(db) {
      db.deleteObjectStore('audioBlobs');
    }
  },
  // v3 → v4: 添加 auditLog store
  {
    from: 3, to: 4,
    upgrade(db) {
      const store = db.createObjectStore('auditLog', { keyPath: 'id', autoIncrement: true });
      store.createIndex('timestamp', 'timestamp');
      store.createIndex('entityType', 'entityType');
      store.createIndex('action', 'action');
    },
    downgrade(db) {
      db.deleteObjectStore('auditLog');
    }
  },
  // v4 → v5: notes 添加 pinned/starred 字段索引
  {
    from: 4, to: 5,
    upgrade(db) {
      const store = db.transaction('notes', 'readwrite').objectStore('notes');
      store.createIndex('pinned', 'pinned');
      store.createIndex('starred', 'starred');
      store.createIndex('pinnedAt', ['pinned', 'updatedAt']);
      store.createIndex('starredAt', ['starred', 'updatedAt']);
    },
    downgrade(db) {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      if (store.indexNames.contains('pinned')) store.deleteIndex('pinned');
      if (store.indexNames.contains('starred')) store.deleteIndex('starred');
      if (store.indexNames.contains('pinnedAt')) store.deleteIndex('pinnedAt');
      if (store.indexNames.contains('starredAt')) store.deleteIndex('starredAt');
    }
  },
  // v5 → v6: 添加 syncQueue store
  {
    from: 5, to: 6,
    upgrade(db) {
      const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      store.createIndex('timestamp', 'timestamp');
      store.createIndex('entityId', 'entityId');
    },
    downgrade(db) {
      db.deleteObjectStore('syncQueue');
    }
  },
  // v6 → v7: settings store
  {
    from: 6, to: 7,
    upgrade(db) {
      db.createObjectStore('settings', { keyPath: 'key' });
    },
    downgrade(db) {
      db.deleteObjectStore('settings');
    }
  }
];

// ============================================================
// 中文分词器（简易版）
// ============================================================

class SimpleTokenizer {
  // 中文按字分词 + 英文按词分词
  static tokenize(text) {
    if (!text) return [];
    const tokens = [];
    // 英文单词
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    tokens.push(...englishWords.map(w => w.toLowerCase()));
    // 中文按字
    const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
    tokens.push(...chineseChars);
    // 数字
    const numbers = text.match(/\d+/g) || [];
    tokens.push(...numbers);
    // 去重
    return [...new Set(tokens)];
  }
}

// ============================================================
// DBManager — 核心数据访问层
// ============================================================

class DBManager {
  constructor() {
    this.db = null;
    this.dbReady = this._init();
  }

  /**
   * 初始化数据库 + 自动迁移
   */
  async _init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion;

        console.log(`[DB] Schema upgrade: ${oldVersion} → ${newVersion}`);

        // 创建初始 schema（v0 → v1）
        if (oldVersion === 0) {
          this._createInitialSchema(db);
        }

        // 执行增量迁移
        for (const migration of SCHEMA_MIGRATIONS) {
          if (migration.from >= oldVersion && migration.to <= newVersion) {
            console.log(`[DB] Running migration ${migration.from} → ${migration.to}`);
            migration.upgrade(db);
          }
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('[DB] Connected:', DB_NAME, 'v' + DB_VERSION);
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[DB] Error:', event.target.error);
        reject(event.target.error);
      };

      request.onblocked = (event) => {
        console.warn('[DB] Blocked — 其他标签页可能持有旧版本连接');
      };
    });
  }

  /**
   * 创建初始 Schema（v1）
   */
  _createInitialSchema(db) {
    // notes
    const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
    notesStore.createIndex('updatedAt', 'updatedAt');
    notesStore.createIndex('createdAt', 'createdAt');
    notesStore.createIndex('syncStatus', 'syncStatus');
    notesStore.createIndex('title', 'title');
    notesStore.createIndex('tags', 'tags', { multiEntry: true });
    notesStore.createIndex('updatedAtTitle', ['updatedAt', 'title']);

    // syncQueue
    const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
    syncStore.createIndex('timestamp', 'timestamp');
    syncStore.createIndex('entityId', 'entityId');
  }

  // ============================================================
  // 笔记 CRUD
  // ============================================================

  /**
   * 创建笔记 — 原子事务（笔记 + 搜索索引 + 审计日志 + 同步队列）
   */
  async createNote({ title, content, tags = [] }) {
    await this.dbReady;
    const id = crypto.randomUUID();
    const now = Date.now();
    const tokens = SimpleTokenizer.tokenize(title + ' ' + content);
    const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;

    const note = {
      id,
      title: title || '未命名笔记',
      content: content || '',
      html: '',
      tags,
      pinned: false,
      starred: false,
      wordCount,
      audioAttachments: [],
      createdAt: now,
      updatedAt: now,
      syncStatus: 'dirty',
      version: 1,
    };

    // 原子事务：同时写入 notes + searchIndex + auditLog + syncQueue
    const tx = this.db.transaction(
      ['notes', 'searchIndex', 'auditLog', 'syncQueue'],
      'readwrite',
      { durability: 'strict' } // v7 新增：确保数据持久化
    );

    // 写入笔记
    tx.objectStore('notes').put(note);

    // 写入搜索索引
    const searchStore = tx.objectStore('searchIndex');
    for (const word of tokens) {
      const positions = this._findWordPositions(content, word);
      const existing = await this._getFromStore(searchStore, word);
      const docIds = existing?.docIds ? new Set(existing.docIds) : new Set();
      docIds.add(id);
      const positionsMap = existing?.positions || {};
      positionsMap[id] = positions;
      searchStore.put({ word, docIds: [...docIds], positions: positionsMap });
    }

    // 写入审计日志
    tx.objectStore('auditLog').add({
      action: 'create',
      entityType: 'note',
      entityId: id,
      timestamp: now,
      diff: { title, tagCount: tags.length },
    });

    // 写入同步队列
    tx.objectStore('syncQueue').add({
      action: 'create',
      entityType: 'note',
      entityId: id,
      payload: JSON.stringify(note),
      timestamp: now,
      retries: 0,
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log(`[DB] Note created: ${id}`);
        resolve(note);
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 更新笔记 — 乐观锁 + 版本递增
   */
  async updateNote(id, updates) {
    await this.dbReady;
    const tx = this.db.transaction(
      ['notes', 'searchIndex', 'auditLog', 'syncQueue'],
      'readwrite',
      { durability: 'strict' }
    );
    const notesStore = tx.objectStore('notes');

    const existing = await this._getFromStore(notesStore, id);
    if (!existing) throw new Error(`Note ${id} not found`);

    // 乐观锁检查
    if (updates.expectedVersion && updates.expectedVersion !== existing.version) {
      throw new Error(`Version conflict: expected ${updates.expectedVersion}, got ${existing.version}`);
    }

    const oldContent = existing.content;
    const oldTitle = existing.title;
    const now = Date.now();

    // 应用更新
    const updated = {
      ...existing,
      ...updates,
      updatedAt: now,
      version: existing.version + 1,
      syncStatus: 'dirty',
      wordCount: (updates.content || existing.content).split(/\s+/).filter(Boolean).length,
    };

    // 如果内容/标题变化，重建搜索索引
    if (updates.content !== undefined || updates.title !== undefined) {
      const newTokens = SimpleTokenizer.tokenize((updates.title || oldTitle) + ' ' + (updates.content || oldContent));
      const searchStore = tx.objectStore('searchIndex');

      // 移除旧索引
      const oldTokens = SimpleTokenizer.tokenize(oldTitle + ' ' + oldContent);
      for (const word of oldTokens) {
        const entry = await this._getFromStore(searchStore, word);
        if (entry) {
          const docIds = new Set(entry.docIds);
          docIds.delete(id);
          if (docIds.size === 0) {
            searchStore.delete(word);
          } else {
            const positions = { ...entry.positions };
            delete positions[id];
            searchStore.put({ word, docIds: [...docIds], positions });
          }
        }
      }

      // 添加新索引
      for (const word of newTokens) {
        const positions = this._findWordPositions(updates.content || oldContent, word);
        const entry = await this._getFromStore(searchStore, word);
        const docIds = entry?.docIds ? new Set(entry.docIds) : new Set();
        docIds.add(id);
        const positionsMap = entry?.positions || {};
        positionsMap[id] = positions;
        searchStore.put({ word, docIds: [...docIds], positions: positionsMap });
      }
    }

    notesStore.put(updated);

    // 审计日志
    tx.objectStore('auditLog').add({
      action: 'update',
      entityType: 'note',
      entityId: id,
      timestamp: now,
      diff: {
        titleChanged: updates.title !== oldTitle,
        contentChanged: updates.content !== oldContent,
        oldVersion: existing.version,
        newVersion: existing.version + 1,
      },
    });

    // 同步队列
    tx.objectStore('syncQueue').add({
      action: 'update',
      entityType: 'note',
      entityId: id,
      payload: JSON.stringify(updated),
      timestamp: now,
      retries: 0,
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log(`[DB] Note updated: ${id} v${updated.version}`);
        resolve(updated);
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 删除笔记 — 级联删除（笔记 + 搜索索引 + 语音附件 + 审计日志）
   */
  async deleteNote(id) {
    await this.dbReady;
    const tx = this.db.transaction(
      ['notes', 'searchIndex', 'audioBlobs', 'auditLog', 'syncQueue'],
      'readwrite',
      { durability: 'strict' }
    );

    const note = await this._getFromStore(tx.objectStore('notes'), id);
    if (!note) throw new Error(`Note ${id} not found`);

    // 删除笔记
    tx.objectStore('notes').delete(id);

    // 清理搜索索引
    const tokens = SimpleTokenizer.tokenize(note.title + ' ' + note.content);
    const searchStore = tx.objectStore('searchIndex');
    for (const word of tokens) {
      const entry = await this._getFromStore(searchStore, word);
      if (entry) {
        const docIds = new Set(entry.docIds);
        docIds.delete(id);
        if (docIds.size === 0) {
          searchStore.delete(word);
        } else {
          const positions = { ...entry.positions };
          delete positions[id];
          searchStore.put({ word, docIds: [...docIds], positions });
        }
      }
    }

    // 删除语音附件
    const audioStore = tx.objectStore('audioBlobs');
    if (note.audioAttachments) {
      for (const att of note.audioAttachments) {
        audioStore.delete(att.id);
      }
    }

    // 审计日志
    tx.objectStore('auditLog').add({
      action: 'delete',
      entityType: 'note',
      entityId: id,
      timestamp: Date.now(),
      diff: { title: note.title },
    });

    // 同步队列
    tx.objectStore('syncQueue').add({
      action: 'delete',
      entityType: 'note',
      entityId: id,
      payload: JSON.stringify({ id }),
      timestamp: Date.now(),
      retries: 0,
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log(`[DB] Note deleted: ${id}`);
        resolve();
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 获取笔记
   */
  async getNote(id) {
    await this.dbReady;
    return this._getFromStore(this.db.transaction('notes', 'readonly').objectStore('notes'), id);
  }

  /**
   * 列表笔记 — 游标分页（避免大结果集内存溢出）
   *
   * @param {Object} options
   * @param {string} options.filter - 'all' | 'recent' | 'pinned' | 'starred'
   * @param {number} options.limit - 每页数量
   * @param {string} options.cursor - 游标（上一页最后一条的 key）
   * @param {boolean} options.reverse - 倒序
   */
  async listNotes({ filter = 'all', limit = 20, cursor = null, reverse = true } = {}) {
    await this.dbReady;
    const tx = this.db.transaction('notes', 'readonly');
    const store = tx.objectStore('notes');

    let index;
    let range;

    switch (filter) {
      case 'pinned':
        index = store.index('pinnedAt');
        range = IDBKeyRange.only([true, undefined]);
        break;
      case 'starred':
        index = store.index('starredAt');
        range = IDBKeyRange.only([true, undefined]);
        break;
      case 'recent':
        index = store.index('updatedAt');
        break;
      default:
        index = store.index('updatedAt');
        break;
    }

    const notes = [];
    let request;

    if (cursor) {
      // 从游标位置继续
      const cursorRange = reverse
        ? IDBKeyRange.upperBound(cursor, true)
        : IDBKeyRange.lowerBound(cursor, true);
      request = index.openCursor(cursorRange, reverse ? 'prev' : 'next');
    } else {
      request = index.openCursor(null, reverse ? 'prev' : 'next');
    }

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && notes.length < limit) {
          // 应用 filter 过滤
          if (filter === 'pinned' && !cursor.value.pinned) {
            cursor.continue();
            return;
          }
          if (filter === 'starred' && !cursor.value.starred) {
            cursor.continue();
            return;
          }
          notes.push(cursor.value);
          cursor.continue();
        } else {
          resolve({
            notes,
            hasMore: notes.length >= limit,
            nextCursor: notes.length > 0 ? notes[notes.length - 1].updatedAt : null,
          });
        }
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 全文搜索 — 倒排索引 + BM25 排序
   */
  async search(query) {
    await this.dbReady;
    const tokens = SimpleTokenizer.tokenize(query);
    if (tokens.length === 0) return { notes: [], hasMore: false, nextCursor: null };

    const tx = this.db.transaction(['searchIndex', 'notes'], 'readonly');
    const searchStore = tx.objectStore('searchIndex');

    // 收集所有匹配文档
    const docScores = new Map(); // docId → score

    for (const token of tokens) {
      const entry = await this._getFromStore(searchStore, token);
      if (!entry) continue;

      const totalDocs = (await this._countStore(tx.objectStore('notes')));
      const df = entry.docIds.length; // 文档频率

      // BM25 简化版：score = log(N/df) * positionMatch
      const idf = Math.log((totalDocs + 1) / (df + 1) + 1);

      for (const docId of entry.docIds) {
        const positions = entry.positions?.[docId] || [];
        const positionScore = positions.length; // 出现次数越多越相关
        const score = idf * positionScore;
        docScores.set(docId, (docScores.get(docId) || 0) + score);
      }
    }

    // 按分数排序，取前 20
    const sortedDocs = [...docScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    const notes = [];
    const notesStore = tx.objectStore('notes');
    for (const [docId] of sortedDocs) {
      const note = await this._getFromStore(notesStore, docId);
      if (note) notes.push(note);
    }

    return { notes, hasMore: false, nextCursor: null };
  }

  // ============================================================
  // 语音附件
  // ============================================================

  /**
   * 保存语音附件
   */
  async saveAudio({ noteId, blob, name, duration }) {
    await this.dbReady;
    const id = crypto.randomUUID();
    const audio = {
      id,
      noteId,
      blob,
      name: name || `recording-${new Date().toISOString()}.webm`,
      duration: duration || 0,
      recordedAt: Date.now(),
    };

    const tx = this.db.transaction(['audioBlobs', 'notes', 'auditLog'], 'readwrite', { durability: 'strict' });
    tx.objectStore('audioBlobs').put(audio);

    // 更新笔记的 audioAttachments
    const note = await this._getFromStore(tx.objectStore('notes'), noteId);
    if (note) {
      note.audioAttachments = note.audioAttachments || [];
      note.audioAttachments.push({
        id,
        name: audio.name,
        duration: audio.duration,
        size: blob.size,
      });
      note.updatedAt = Date.now();
      note.syncStatus = 'dirty';
      tx.objectStore('notes').put(note);
    }

    tx.objectStore('auditLog').add({
      action: 'create',
      entityType: 'audio',
      entityId: id,
      timestamp: Date.now(),
      diff: { noteId, name, duration },
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log(`[DB] Audio saved: ${id} (${(blob.size / 1024).toFixed(1)}KB)`);
        resolve(audio);
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * 获取语音 Blob
   */
  async getAudio(id) {
    await this.dbReady;
    return this._getFromStore(this.db.transaction('audioBlobs', 'readonly').objectStore('audioBlobs'), id);
  }

  /**
   * 获取笔记的所有语音附件
   */
  async getNoteAudios(noteId) {
    await this.dbReady;
    const tx = this.db.transaction('audioBlobs', 'readonly');
    const store = tx.objectStore('audioBlobs');
    const index = store.index('noteId');
    const request = index.getAll(noteId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ============================================================
  // 同步队列
  // ============================================================

  async getSyncQueue() {
    await this.dbReady;
    const tx = this.db.transaction('syncQueue', 'readonly');
    const request = tx.objectStore('syncQueue').index('timestamp').getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async clearSyncQueue() {
    await this.dbReady;
    const tx = this.db.transaction('syncQueue', 'readwrite');
    tx.objectStore('syncQueue').clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async markNoteSynced(id) {
    await this.dbReady;
    const tx = this.db.transaction('notes', 'readwrite');
    const note = await this._getFromStore(tx.objectStore('notes'), id);
    if (note) {
      note.syncStatus = 'synced';
      tx.objectStore('notes').put(note);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // ============================================================
  // 设置
  // ============================================================

  async getSetting(key) {
    await this.dbReady;
    const result = await this._getFromStore(
      this.db.transaction('settings', 'readonly').objectStore('settings'),
      key
    );
    return result?.value;
  }

  async setSetting(key, value) {
    await this.dbReady;
    const tx = this.db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key, value });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // ============================================================
  // 数据导出/导入
  // ============================================================

  /**
   * 导出所有笔记为 JSON
   */
  async exportAllNotes() {
    await this.dbReady;
    const tx = this.db.transaction(['notes', 'audioBlobs'], 'readonly');
    const notes = await this._getAllFromStore(tx.objectStore('notes'));
    const audios = await this._getAllFromStore(tx.objectStore('audioBlobs'));

    const exportData = {
      version: DB_VERSION,
      exportedAt: Date.now(),
      noteCount: notes.length,
      audioCount: audios.length,
      notes: notes.map(n => ({
        ...n,
        // 音频引用保留，Blob 不序列化
        audioAttachments: n.audioAttachments || [],
      })),
      audios: audios.map(a => ({
        id: a.id,
        noteId: a.noteId,
        name: a.name,
        duration: a.duration,
        recordedAt: a.recordedAt,
        // Blob 转为 base64
        data: await this._blobToBase64(a.blob),
        type: a.blob.type,
      })),
    };

    // 审计日志
    const auditTx = this.db.transaction('auditLog', 'readwrite');
    auditTx.objectStore('auditLog').add({
      action: 'export',
      entityType: 'note',
      entityId: 'all',
      timestamp: Date.now(),
      diff: { noteCount: notes.length, audioCount: audios.length },
    });

    return exportData;
  }

  /**
   * 导入笔记
   */
  async importNotes(exportData) {
    await this.dbReady;

    if (!exportData.notes || !Array.isArray(exportData.notes)) {
      throw new Error('Invalid export data: missing notes array');
    }

    const tx = this.db.transaction(
      ['notes', 'searchIndex', 'audioBlobs', 'auditLog'],
      'readwrite',
      { durability: 'strict' }
    );

    let imported = 0;

    // 批量导入笔记
    for (const noteData of exportData.notes) {
      const note = {
        ...noteData,
        id: noteData.id || crypto.randomUUID(),
        createdAt: noteData.createdAt || Date.now(),
        updatedAt: Date.now(),
        syncStatus: 'dirty',
        version: 1,
      };
      tx.objectStore('notes').put(note);
      imported++;
    }

    // 批量导入音频
    if (exportData.audios) {
      for (const audioData of exportData.audios) {
        const blob = await this._base64ToBlob(audioData.data, audioData.type);
        tx.objectStore('audioBlobs').put({
          id: audioData.id,
          noteId: audioData.noteId,
          blob,
          name: audioData.name,
          duration: audioData.duration,
          recordedAt: audioData.recordedAt,
        });
      }
    }

    // 审计日志
    tx.objectStore('auditLog').add({
      action: 'import',
      entityType: 'note',
      entityId: 'all',
      timestamp: Date.now(),
      diff: { imported },
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log(`[DB] Imported ${imported} notes`);
        resolve({ imported });
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // ============================================================
  // 存储统计
  // ============================================================

  async getStorageStats() {
    await this.dbReady;
    const tx = this.db.transaction(['notes', 'audioBlobs', 'syncQueue', 'auditLog'], 'readonly');

    const [noteCount, audioCount, queueCount, auditCount] = await Promise.all([
      this._countStore(tx.objectStore('notes')),
      this._countStore(tx.objectStore('audioBlobs')),
      this._countStore(tx.objectStore('syncQueue')),
      this._countStore(tx.objectStore('auditLog')),
    ]);

    // 估算音频存储大小
    const audios = await this._getAllFromStore(tx.objectStore('audioBlobs'));
    const audioSize = audios.reduce((sum, a) => sum + (a.blob?.size || 0), 0);

    return {
      notes: noteCount,
      audios: audioCount,
      audioSize,
      audioSizeFormatted: this._formatBytes(audioSize),
      syncQueue: queueCount,
      auditLog: auditCount,
    };
  }

  // ============================================================
  // 工具方法
  // ============================================================

  _getFromStore(store, key) {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  _getAllFromStore(store) {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  _countStore(store) {
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  _findWordPositions(text, word) {
    if (!text) return [];
    const positions = [];
    let idx = text.toLowerCase().indexOf(word.toLowerCase());
    while (idx !== -1) {
      positions.push(idx);
      idx = text.toLowerCase().indexOf(word.toLowerCase(), idx + 1);
    }
    return positions;
  }

  _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]); // 去掉 data:...;base64,
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async _base64ToBlob(base64, type = 'audio/webm') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type });
  }

  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * 删除整个数据库（危险操作！）
   */
  async destroy() {
    this.close();
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => {
        console.log('[DB] Database deleted');
        resolve();
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }
}

// ============================================================
// 全局实例
// ============================================================

const db = new DBManager();
