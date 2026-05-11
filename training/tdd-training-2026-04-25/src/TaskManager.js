/**
 * TaskManager — TDD 实战实现
 *
 * 测试驱动开发：先写 28 个失败测试 → 实现刚好通过的代码 → 重构
 */

// ======================== 枚举常量 ========================

export const TaskPriority = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

export const TaskStatus = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
});

const VALID_PRIORITIES = new Set(Object.values(TaskPriority));
const VALID_STATUSES = new Set(Object.values(TaskStatus));

// 优先级权重（用于排序）
const PRIORITY_WEIGHT = {
  [TaskPriority.LOW]: 0,
  [TaskPriority.MEDIUM]: 1,
  [TaskPriority.HIGH]: 2,
  [TaskPriority.CRITICAL]: 3,
};

// 合法状态转换图
const ALLOWED_TRANSITIONS = {
  [TaskStatus.PENDING]: [TaskStatus.IN_PROGRESS, TaskStatus.DONE],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.DONE, TaskStatus.PENDING],
  [TaskStatus.DONE]: [TaskStatus.PENDING],
};

// ======================== 工具函数 ========================

let _idCounter = 0;
function generateId() {
  _idCounter += 1;
  return `task_${Date.now()}_${_idCounter}`;
}

function validatePriority(priority) {
  if (!VALID_PRIORITIES.has(priority)) {
    throw new Error(`Invalid priority: ${priority}. Must be one of: ${[...VALID_PRIORITIES].join(', ')}`);
  }
}

function validateStatus(status) {
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid status: ${status}. Must be one of: ${[...VALID_STATUSES].join(', ')}`);
  }
}

function validateTitle(title) {
  if (!title || typeof title !== 'string' || title.trim() === '') {
    throw new Error('title is required');
  }
}

// ======================== TaskManager 类 ========================

export class TaskManager {
  /**
   * @param {Array<Object>} [initialTasks=[]] - 初始任务列表
   */
  constructor(initialTasks = []) {
    this._tasks = new Map();

    if (initialTasks.length > 0) {
      const seenIds = new Set();
      for (const task of initialTasks) {
        if (seenIds.has(task.id)) {
          throw new Error(`Duplicate task id: ${task.id}`);
        }
        seenIds.add(task.id);
      }
      for (const task of initialTasks) {
        this._tasks.set(task.id, { ...task });
      }
    }
  }

  // ---------- CRUD ----------

  /**
   * 创建任务
   * @param {Object} options - 任务配置
   * @returns {Object} 创建的任务（深拷贝）
   */
  create(options) {
    const {
      id,
      title,
      description = '',
      priority = TaskPriority.MEDIUM,
      status = TaskStatus.PENDING,
      tags = [],
      dependencies = [],
    } = options;

    validateTitle(title);
    validatePriority(priority);
    validateStatus(status);

    const taskId = id || generateId();
    const now = new Date();

    const task = {
      id: taskId,
      title: title.trim(),
      description,
      priority,
      status,
      tags: [...tags],
      dependencies: [...dependencies],
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    this._tasks.set(taskId, task);
    return this._clone(task);
  }

  /**
   * 通过 ID 获取任务
   * @param {string} id
   * @returns {Object|undefined}
   */
  getById(id) {
    const task = this._tasks.get(id);
    return task ? this._clone(task) : undefined;
  }

  /**
   * 获取所有任务（深拷贝）
   * @returns {Array<Object>}
   */
  getAll() {
    return Array.from(this._tasks.values()).map((t) => this._clone(t));
  }

  /**
   * 更新任务
   * @param {string} id
   * @param {Object} updates
   * @returns {Object} 更新后的任务
   */
  update(id, updates) {
    const task = this._tasks.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    if (updates.title !== undefined) {
      validateTitle(updates.title);
      task.title = updates.title.trim();
    }
    if (updates.description !== undefined) {
      task.description = updates.description;
    }
    if (updates.priority !== undefined) {
      validatePriority(updates.priority);
      task.priority = updates.priority;
    }
    if (updates.status !== undefined) {
      validateStatus(updates.status);
      task.status = updates.status;
    }
    if (updates.tags !== undefined) {
      task.tags = [...updates.tags];
    }
    if (updates.dependencies !== undefined) {
      task.dependencies = [...updates.dependencies];
    }

    task.updatedAt = new Date();
    return this._clone(task);
  }

  /**
   * 删除任务
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    return this._tasks.delete(id);
  }

  // ---------- 状态流转 ----------

  /**
   * 开始任务（pending → in_progress）
   */
  startTask(id) {
    this._transitionStatus(id, TaskStatus.IN_PROGRESS);
  }

  /**
   * 完成任务（in_progress → done）
   */
  completeTask(id) {
    this._transitionStatus(id, TaskStatus.DONE);
  }

  /**
   * 重新打开任务（done → pending）
   */
  reopenTask(id) {
    this._transitionStatus(id, TaskStatus.PENDING);
  }

  /**
   * 内部状态转换逻辑
   * @private
   */
  _transitionStatus(id, targetStatus) {
    const task = this._tasks.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    const allowed = ALLOWED_TRANSITIONS[task.status];
    if (!allowed.includes(targetStatus)) {
      throw new Error(
        `Cannot transition from ${task.status} to ${targetStatus}. Allowed: ${allowed.join(', ')}`,
      );
    }

    task.status = targetStatus;
    task.updatedAt = new Date();
  }

  // ---------- 查询 & 筛选 ----------

  /**
   * 按优先级筛选
   */
  getByPriority(priority) {
    validatePriority(priority);
    return this.getAll().filter((t) => t.priority === priority);
  }

  /**
   * 按状态筛选
   */
  getByStatus(status) {
    validateStatus(status);
    return this.getAll().filter((t) => t.status === status);
  }

  /**
   * 按标签筛选
   */
  getByTag(tag) {
    return this.getAll().filter((t) => t.tags.includes(tag));
  }

  /**
   * 关键词搜索（匹配 title 和 description）
   */
  search(keyword) {
    const lower = keyword.toLowerCase();
    return this.getAll().filter(
      (t) => t.title.toLowerCase().includes(lower)
        || (t.description && t.description.toLowerCase().includes(lower)),
    );
  }

  /**
   * 按优先级排序（从高到低）
   */
  getSortedByPriority() {
    return this.getAll().sort(
      (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority],
    );
  }

  // ---------- 统计 ----------

  /**
   * 获取任务总数
   */
  getCount() {
    return this._tasks.size;
  }

  /**
   * 获取各状态的任务数量统计
   */
  getStats() {
    const stats = { total: this._tasks.size };
    for (const status of Object.values(TaskStatus)) {
      stats[status] = 0;
    }
    for (const task of this._tasks.values()) {
      stats[task.status] = (stats[task.status] || 0) + 1;
    }
    return stats;
  }

  // ---------- 内部工具 ----------

  /**
   * 深拷贝任务对象（防止外部修改内部状态）
   * @private
   */
  _clone(task) {
    return structuredClone(task);
  }
}
