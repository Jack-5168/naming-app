/**
 * TaskManager - 任务管理器
 * 支持 CRUD、过滤、排序、搜索、分页
 */

class TaskManager {
  constructor() {
    this.tasks = [];
    this.nextId = 1;
  }

  /**
   * 添加任务
   * @param {Object} taskData - 任务数据
   * @param {string} taskData.title - 标题
   * @param {string} taskData.description - 描述
   * @param {string} taskData.priority - 优先级: low/medium/high
   * @param {string} taskData.status - 状态: pending/active/completed
   * @param {string[]} taskData.tags - 标签
   * @returns {Object} 创建的任务
   */
  addTask(taskData) {
    if (!taskData || !taskData.title || typeof taskData.title !== 'string') {
      throw new Error('Task title is required and must be a string');
    }

    if (taskData.title.trim().length === 0) {
      throw new Error('Task title cannot be empty');
    }

    const task = {
      id: this.nextId,
      title: taskData.title.trim(),
      description: taskData.description || '',
      priority: taskData.priority || 'medium',
      status: taskData.status || 'pending',
      tags: Array.isArray(taskData.tags) ? [...taskData.tags] : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.push(task);
    this.nextId += 1;
    return { ...task };
  }

  /**
   * 根据 ID 获取任务
   * @param {number} id
   * @returns {Object|undefined}
   */
  getTask(id) {
    const task = this.tasks.find(t => t.id === id);
    return task ? { ...task } : undefined;
  }

  /**
   * 更新任务
   * @param {number} id
   * @param {Object} updates
   * @returns {Object} 更新后的任务
   */
  updateTask(id, updates) {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error(`Task with id ${id} not found`);
    }

    const task = this.tasks[index];

    if (updates.title !== undefined) {
      if (typeof updates.title !== 'string' || updates.title.trim().length === 0) {
        throw new Error('Task title must be a non-empty string');
      }
      task.title = updates.title.trim();
    }

    if (updates.description !== undefined) {
      task.description = updates.description;
    }

    if (updates.priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high'];
      if (!validPriorities.includes(updates.priority)) {
        throw new Error(`Invalid priority: ${updates.priority}. Must be one of: ${validPriorities.join(', ')}`);
      }
      task.priority = updates.priority;
    }

    if (updates.status !== undefined) {
      const validStatuses = ['pending', 'active', 'completed'];
      if (!validStatuses.includes(updates.status)) {
        throw new Error(`Invalid status: ${updates.status}. Must be one of: ${validStatuses.join(', ')}`);
      }
      task.status = updates.status;
    }

    if (updates.tags !== undefined) {
      if (!Array.isArray(updates.tags)) {
        throw new Error('Tags must be an array');
      }
      task.tags = [...updates.tags];
    }

    task.updatedAt = new Date();
    return { ...task };
  }

  /**
   * 删除任务
   * @param {number} id
   * @returns {boolean}
   */
  deleteTask(id) {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) {
      return false;
    }
    this.tasks.splice(index, 1);
    return true;
  }

  /**
   * 获取所有任务
   * @returns {Object[]}
   */
  getAllTasks() {
    return this.tasks.map(t => ({ ...t }));
  }

  /**
   * 过滤任务
   * @param {Object} filters
   * @returns {Object[]}
   */
  filterTasks(filters = {}) {
    let result = [...this.tasks];

    if (filters.status) {
      result = result.filter(t => t.status === filters.status);
    }

    if (filters.priority) {
      result = result.filter(t => t.priority === filters.priority);
    }

    if (filters.tags && Array.isArray(filters.tags)) {
      result = result.filter(t =>
        filters.tags.some(tag => t.tags.includes(tag))
      );
    }

    if (filters.minPriority) {
      const priorityOrder = { low: 1, medium: 2, high: 3 };
      const minLevel = priorityOrder[filters.minPriority] || 0;
      result = result.filter(t => (priorityOrder[t.priority] || 0) >= minLevel);
    }

    return result.map(t => ({ ...t }));
  }

  /**
   * 排序任务
   * @param {string} field - 排序字段
   * @param {string} direction - 方向: asc/desc
   * @returns {Object[]}
   */
  sortTasks(field = 'createdAt', direction = 'desc') {
    const sorted = [...this.tasks];

    sorted.sort((a, b) => {
      let valA = a[field];
      let valB = b[field];

      if (field === 'priority') {
        const priorityOrder = { low: 1, medium: 2, high: 3 };
        valA = priorityOrder[a.priority] || 0;
        valB = priorityOrder[b.priority] || 0;
      }

      if (valA instanceof Date && valB instanceof Date) {
        valA = valA.getTime();
        valB = valB.getTime();
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted.map(t => ({ ...t }));
  }

  /**
   * 搜索任务
   * @param {string} query - 搜索关键词
   * @returns {Object[]}
   */
  searchTasks(query) {
    if (!query || typeof query !== 'string') {
      return [];
    }

    const normalizedQuery = query.toLowerCase().trim();
    if (normalizedQuery.length === 0) {
      return [];
    }

    return this.tasks
      .filter(t =>
        t.title.toLowerCase().includes(normalizedQuery) ||
        t.description.toLowerCase().includes(normalizedQuery) ||
        t.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
      )
      .map(t => ({ ...t }));
  }

  /**
   * 分页获取任务
   * @param {number} page - 页码 (从 1 开始)
   * @param {number} pageSize - 每页数量
   * @returns {Object} { items, total, page, pageSize, totalPages }
   */
  paginate(page = 1, pageSize = 10) {
    let currentPage = page;
    let currentPageSize = pageSize;
    if (currentPage < 1) currentPage = 1;
    if (currentPageSize < 1) currentPageSize = 1;

    const total = this.tasks.length;
    const totalPages = Math.ceil(total / currentPageSize);
    const startIndex = (currentPage - 1) * currentPageSize;
    const endIndex = startIndex + currentPageSize;
    const items = this.tasks.slice(startIndex, endIndex).map(t => ({ ...t }));

    return {
      items,
      total,
      page: currentPage,
      pageSize: currentPageSize,
      totalPages: Math.max(1, totalPages),
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    };
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    const total = this.tasks.length;
    const byStatus = {
      pending: 0,
      active: 0,
      completed: 0,
    };
    const byPriority = {
      low: 0,
      medium: 0,
      high: 0,
    };

    this.tasks.forEach(t => {
      if (Object.prototype.hasOwnProperty.call(byStatus, t.status)) {
        byStatus[t.status] += 1;
      }
      if (Object.prototype.hasOwnProperty.call(byPriority, t.priority)) {
        byPriority[t.priority] += 1;
      }
    });

    return {
      total,
      byStatus,
      byPriority,
      completionRate: total > 0 ? (byStatus.completed / total) * 100 : 0,
    };
  }

  /**
   * 清空所有任务
   */
  clear() {
    this.tasks = [];
    this.nextId = 1;
  }

  /**
   * 批量添加任务
   * @param {Object[]} taskDataArray
   * @returns {Object[]}
   */
  addTasks(taskDataArray) {
    if (!Array.isArray(taskDataArray)) {
      throw new Error('Expected an array of task data');
    }
    return taskDataArray.map(data => this.addTask(data));
  }
}

export default TaskManager;
