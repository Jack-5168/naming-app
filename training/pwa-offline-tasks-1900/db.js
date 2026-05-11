/**
 * IndexedDB 封装 — OfflineTasks 离线数据持久化层
 *
 * 提供三个对象仓库：
 * 1. tasks — 任务数据（增删改查、排序、筛选、搜索）
 * 2. categories — 分类数据
 * 3. syncQueue — 离线操作队列（待同步到服务器）
 *
 * 技术要点：
 * - Promise 封装所有异步操作
 * - 自动生成 UUID 作为主键
 * - 支持全文搜索（标题+描述模糊匹配）
 * - 支持多条件筛选（优先级/状态/分类/截止日期）
 * - 操作队列支持 FIFO 出队和状态追踪
 * - 数据导出/导入（备份恢复）
 */

class OfflineDB {
  constructor() {
    this.DB_NAME = 'OfflineTasksDB';
    this.DB_VERSION = 3;
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

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('[DB] 升级数据库到版本:', this.DB_VERSION);

        // --- tasks 对象仓库 ---
        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('status', 'status', { multiEntry: false });
          taskStore.createIndex('priority', 'priority', { multiEntry: false });
          taskStore.createIndex('category', 'category', { multiEntry: false });
          taskStore.createIndex('dueDate', 'dueDate', { multiEntry: false });
          taskStore.createIndex('order', 'order', { multiEntry: false });
          taskStore.createIndex('createdAt', 'createdAt', { multiEntry: false });
          console.log('[DB] 创建 tasks 仓库 + 7 个索引');
        }

        // --- categories 对象仓库 ---
        if (!db.objectStoreNames.contains('categories')) {
          const catStore = db.createObjectStore('categories', { keyPath: 'id' });
          catStore.createIndex('sortOrder', 'sortOrder', { multiEntry: false });
          console.log('[DB] 创建 categories 仓库 + 1 个索引');
        }

        // --- syncQueue 对象仓库 ---
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('status', 'status', { multiEntry: false });
          syncStore.createIndex('createdAt', 'createdAt', { multiEntry: false });
          console.log('[DB] 创建 syncQueue 仓库 + 2 个索引');
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('[DB] 数据库连接成功');
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[DB] 数据库打开失败:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // ============================================
  // 任务 CRUD 操作
  // ============================================

  /**
   * 创建新任务
   */
  async createTask(task) {
    await this.init();
    const newTask = {
      id: this.generateId(),
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'medium', // low | medium | high | urgent
      status: task.status || 'todo', // todo | in-progress | done | archived
      category: task.category || 'default',
      dueDate: task.dueDate || null,
      tags: task.tags || [],
      order: task.order || Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const request = store.add(newTask);
      request.onsuccess = () => resolve(newTask);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取单个任务
   */
  async getTask(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('tasks', 'readonly');
      const store = tx.objectStore('tasks');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 更新任务
   */
  async updateTask(id, updates) {
    await this.init();
    const existing = await this.getTask(id);
    if (!existing) throw new Error(`任务 ${id} 不存在`);

    const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };
    if (updates.status === 'done' && !existing.completedAt) {
      updated.completedAt = new Date().toISOString();
    }
    if (updates.status && updates.status !== 'done') {
      updated.completedAt = null;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const request = store.put(updated);
      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 删除任务
   */
  async deleteTask(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取所有任务（支持筛选和排序）
   */
  async getAllTasks({ status, priority, category, sortBy = 'order', sortOrder = 'asc' } = {}) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('tasks', 'readonly');
      const store = tx.objectStore('tasks');
      const request = store.getAll();

      request.onsuccess = () => {
        let tasks = request.result || [];

        // 筛选
        if (status) tasks = tasks.filter((t) => t.status === status);
        if (priority) tasks = tasks.filter((t) => t.priority === priority);
        if (category) tasks = tasks.filter((t) => t.category === category);

        // 排序
        tasks.sort((a, b) => {
          let va = a[sortBy] || '';
          let vb = b[sortBy] || '';
          if (typeof va === 'string') va = va.toLowerCase();
          if (typeof vb === 'string') vb = vb.toLowerCase();
          if (va < vb) return sortOrder === 'asc' ? -1 : 1;
          if (va > vb) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });

        resolve(tasks);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 搜索任务（标题+描述模糊匹配）
   */
  async searchTasks(query) {
    const allTasks = await this.getAllTasks();
    if (!query) return allTasks;
    const q = query.toLowerCase();
    return allTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)))
    );
  }

  /**
   * 获取即将到期的任务（7 天内）
   */
  async getUpcomingTasks(days = 7) {
    const allTasks = await this.getAllTasks({ status: 'todo' });
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return allTasks.filter((t) => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due >= now && due <= cutoff;
    }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }

  /**
   * 获取过期任务
   */
  async getOverdueTasks() {
    const allTasks = await this.getAllTasks({ status: 'todo' });
    const now = new Date();
    return allTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }

  /**
   * 批量更新任务顺序（拖拽排序后）
   */
  async reorderTasks(taskOrders) {
    await this.init();
    const tx = this.db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');

    const promises = taskOrders.map(({ id, order }) => {
      return new Promise((resolve, reject) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const task = getReq.result;
          if (task) {
            task.order = order;
            task.updatedAt = new Date().toISOString();
            store.put(task);
          }
          resolve();
        };
        getReq.onerror = () => reject(getReq.error);
      });
    });

    return Promise.all(promises);
  }

  /**
   * 获取任务统计
   */
  async getTaskStats() {
    const allTasks = await this.getAllTasks();
    return {
      total: allTasks.length,
      byStatus: {
        todo: allTasks.filter((t) => t.status === 'todo').length,
        'in-progress': allTasks.filter((t) => t.status === 'in-progress').length,
        done: allTasks.filter((t) => t.status === 'done').length,
        archived: allTasks.filter((t) => t.status === 'archived').length,
      },
      byPriority: {
        urgent: allTasks.filter((t) => t.priority === 'urgent').length,
        high: allTasks.filter((t) => t.priority === 'high').length,
        medium: allTasks.filter((t) => t.priority === 'medium').length,
        low: allTasks.filter((t) => t.priority === 'low').length,
      },
      byCategory: allTasks.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + 1;
        return acc;
      }, {}),
      overdue: allTasks.filter((t) => t.status === 'todo' && t.dueDate && new Date(t.dueDate) < new Date()).length,
    };
  }

  // ============================================
  // 分类 CRUD 操作
  // ============================================

  async createCategory(cat) {
    await this.init();
    const newCat = {
      id: this.generateId(),
      name: cat.name || '',
      color: cat.color || '#6b7280',
      icon: cat.icon || '📁',
      sortOrder: cat.sortOrder || 0,
      createdAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('categories', 'readwrite');
      const store = tx.objectStore('categories');
      const request = store.add(newCat);
      request.onsuccess = () => resolve(newCat);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllCategories() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('categories', 'readonly');
      const store = tx.objectStore('categories');
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result || []).sort((a, b) => a.sortOrder - b.sortOrder));
      request.onerror = () => reject(request.error);
    });
  }

  async updateCategory(id, updates) {
    await this.init();
    const existing = await new Promise((resolve, reject) => {
      const tx = this.db.transaction('categories', 'readonly');
      const store = tx.objectStore('categories');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!existing) throw new Error(`分类 ${id} 不存在`);

    const updated = { ...existing, ...updates, id };
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('categories', 'readwrite');
      const store = tx.objectStore('categories');
      const req = store.put(updated);
      req.onsuccess = () => resolve(updated);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteCategory(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('categories', 'readwrite');
      const store = tx.objectStore('categories');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // ============================================
  // 离线同步队列
  // ============================================

  async addToSyncQueue(action, data) {
    await this.init();
    const entry = {
      id: this.generateId(),
      action, // 'create' | 'update' | 'delete'
      data,
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      lastAttempt: null,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      const req = store.add(entry);
      req.onsuccess = () => resolve(entry);
      req.onerror = () => reject(req.error);
    });
  }

  async getPendingSyncs() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('syncQueue', 'readonly');
      const store = tx.objectStore('syncQueue');
      const index = store.index('status');
      const req = index.getAll('pending');
      req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      req.onerror = () => reject(req.error);
    });
  }

  async markSyncComplete(syncId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      const getReq = store.get(syncId);
      getReq.onsuccess = () => {
        const entry = getReq.result;
        if (entry) {
          entry.status = 'completed';
          entry.completedAt = new Date().toISOString();
          store.put(entry);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async markSyncFailed(syncId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      const getReq = store.get(syncId);
      getReq.onsuccess = () => {
        const entry = getReq.result;
        if (entry) {
          entry.retryCount++;
          entry.lastAttempt = new Date().toISOString();
          if (entry.retryCount >= entry.maxRetries) {
            entry.status = 'failed';
          }
          store.put(entry);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async clearCompletedSyncs() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      const index = store.index('status');
      const req = index.getAll('completed');
      req.onsuccess = () => {
        (req.result || []).forEach((entry) => store.delete(entry.id));
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ============================================
  // 数据导出/导入
  // ============================================

  async exportData() {
    const tasks = await this.getAllTasks();
    const categories = await this.getAllCategories();
    const syncQueue = await this.getPendingSyncs();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks,
      categories,
      syncQueue,
    };
  }

  /**
   * 导入数据（支持合并策略，避免覆盖现有数据）
   * @param {Object} data - 导出数据
   * @param {Object} options - 导入选项
   * @param {string} options.strategy - 'merge'（默认，跳过已存在）| 'overwrite'（覆盖）| 'skipAll'（跳过所有已存在）
   */
  async importData(data, options = {}) {
    if (!data || data.version !== 1) throw new Error('无效的数据格式');

    const strategy = options.strategy || 'merge';
    await this.init();
    const tx = this.db.transaction(['tasks', 'categories'], 'readwrite');

    const stats = { tasksAdded: 0, tasksSkipped: 0, catsAdded: 0, catsSkipped: 0 };

    // 导入分类
    if (data.categories) {
      const catStore = tx.objectStore('categories');
      const existingCats = await new Promise((resolve) => {
        const req = catStore.getAll();
        req.onsuccess = () => resolve(req.result || []);
      });
      const existingCatIds = new Set(existingCats.map((c) => c.id));

      for (const cat of data.categories) {
        if (existingCatIds.has(cat.id)) {
          if (strategy === 'overwrite') {
            catStore.put(cat);
            stats.catsAdded++;
          } else {
            stats.catsSkipped++;
          }
        } else {
          catStore.add(cat);
          stats.catsAdded++;
        }
      }
    }

    // 导入任务
    if (data.tasks) {
      const taskStore = tx.objectStore('tasks');
      const existingTasks = await new Promise((resolve) => {
        const req = taskStore.getAll();
        req.onsuccess = () => resolve(req.result || []);
      });
      const existingTaskMap = new Map(existingTasks.map((t) => [t.id, t]));

      for (const task of data.tasks) {
        if (existingTaskMap.has(task.id)) {
          if (strategy === 'overwrite') {
            // 比较 updatedAt，保留较新的版本
            const existing = existingTaskMap.get(task.id);
            const incomingTime = new Date(task.updatedAt || 0).getTime();
            const existingTime = new Date(existing.updatedAt || 0).getTime();
            if (incomingTime > existingTime) {
              taskStore.put(task);
              stats.tasksAdded++;
            } else {
              stats.tasksSkipped++;
            }
          } else {
            stats.tasksSkipped++;
          }
        } else {
          taskStore.add(task);
          stats.tasksAdded++;
        }
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(stats);
      tx.onerror = () => reject(tx.error);
    });
  }

  // ============================================
  // 初始化默认分类
  // ============================================
  async initDefaultCategories() {
    const existing = await this.getAllCategories();
    if (existing.length > 0) return;

    const defaults = [
      { name: '工作', color: '#3b82f6', icon: '💼', sortOrder: 0 },
      { name: '个人', color: '#10b981', icon: '👤', sortOrder: 1 },
      { name: '学习', color: '#f59e0b', icon: '📚', sortOrder: 2 },
      { name: '健康', color: '#ef4444', icon: '💪', sortOrder: 3 },
      { name: '购物', color: '#8b5cf6', icon: '🛒', sortOrder: 4 },
      { name: '其他', color: '#6b7280', icon: '📁', sortOrder: 5 },
    ];

    for (const cat of defaults) {
      await this.createCategory(cat);
    }
    console.log('[DB] 已初始化 6 个默认分类');
  }

  // ============================================
  // 工具方法
  // ============================================

  generateId() {
    return 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 清空所有数据（危险操作）
   */
  async clearAll() {
    await this.init();
    const tx = this.db.transaction(['tasks', 'categories', 'syncQueue'], 'readwrite');
    tx.objectStore('tasks').clear();
    tx.objectStore('categories').clear();
    tx.objectStore('syncQueue').clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
}

// 导出（兼容模块和全局）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OfflineDB;
}
