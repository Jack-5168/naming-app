/**
 * TaskManager — TDD 实战：2026-04-25
 *
 * 测试驱动开发流程：
 *   🔴 Red   → 先写失败的测试
 *   🟢 Green → 写刚好通过测试的代码
 *   🔵 Refactor → 优化代码，保持测试通过
 *
 * 共 28 个测试用例，覆盖：
 *   - 任务 CRUD（创建/读取/更新/删除）
 *   - 状态机流转（pending → in_progress → done）
 *   - 优先级管理（low/medium/high/critical）
 *   - 过滤与搜索
 *   - 依赖关系
 *   - 边界条件 & 异常处理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager, TaskPriority, TaskStatus } from '../src/TaskManager.js';

// ======================== 1-4: 初始化测试 ========================

describe('TaskManager 初始化', () => {
  it('应该创建空的 TaskManager', () => {
    const tm = new TaskManager();
    expect(tm.getCount()).toBe(0);
    expect(tm.getAll()).toEqual([]);
  });

  it('应该支持传入初始任务列表', () => {
    const tasks = [
      { id: '1', title: 'Task 1', status: TaskStatus.PENDING, priority: TaskPriority.MEDIUM },
      { id: '2', title: 'Task 2', status: TaskStatus.DONE, priority: TaskPriority.HIGH },
    ];
    const tm = new TaskManager(tasks);
    expect(tm.getCount()).toBe(2);
  });

  it('应该拒绝重复 ID 的初始任务', () => {
    const tasks = [
      { id: '1', title: 'A', status: TaskStatus.PENDING, priority: TaskPriority.LOW },
      { id: '1', title: 'B', status: TaskStatus.PENDING, priority: TaskPriority.LOW },
    ];
    expect(() => new TaskManager(tasks)).toThrow('Duplicate task id');
  });

  it('应该生成唯一 ID（无 ID 时）', () => {
    const tm = new TaskManager();
    const t1 = tm.create({ title: 'A', priority: TaskPriority.LOW });
    const t2 = tm.create({ title: 'B', priority: TaskPriority.LOW });
    expect(t1.id).toBeDefined();
    expect(t2.id).toBeDefined();
    expect(t1.id).not.toBe(t2.id);
  });

  // ======================== 5-10: 创建任务测试 ========================

  describe('创建任务', () => {
    let tm;
    beforeEach(() => { tm = new TaskManager(); });

    it('应该创建最小任务（仅 title）', () => {
      const task = tm.create({ title: 'Hello' });
      expect(task.title).toBe('Hello');
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.priority).toBe(TaskPriority.MEDIUM);
      expect(task.dependencies).toEqual([]);
      expect(task.tags).toEqual([]);
    });

    it('应该设置所有可选字段', () => {
      const task = tm.create({
        title: 'Full task',
        description: 'Desc',
        priority: TaskPriority.HIGH,
        tags: ['urgent', 'bug'],
        dependencies: ['dep-1'],
      });
      expect(task.description).toBe('Desc');
      expect(task.priority).toBe(TaskPriority.HIGH);
      expect(task.tags).toEqual(['urgent', 'bug']);
      expect(task.dependencies).toEqual(['dep-1']);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('应该拒绝缺少 title 的任务', () => {
      expect(() => tm.create({})).toThrow('title is required');
      expect(() => tm.create({ title: '' })).toThrow('title is required');
      expect(() => tm.create({ title: '   ' })).toThrow('title is required');
    });

    it('应该拒绝无效优先级', () => {
      expect(() => tm.create({ title: 'X', priority: 'ultra' }))
        .toThrow('Invalid priority');
    });

    it('应该拒绝无效状态', () => {
      expect(() => tm.create({ title: 'X', status: 'flying' }))
        .toThrow('Invalid status');
    });

    it('创建后任务数应该 +1', () => {
      tm.create({ title: 'A' });
      tm.create({ title: 'B' });
      expect(tm.getCount()).toBe(2);
    });
  });

  // ======================== 11-14: 读取任务测试 ========================

  describe('读取任务', () => {
    let tm;
    beforeEach(() => {
      tm = new TaskManager();
      tm.create({ id: 'a', title: 'Alpha', priority: TaskPriority.HIGH, tags: ['web'] });
      tm.create({ id: 'b', title: 'Beta', priority: TaskPriority.LOW, tags: ['api'] });
    });

    it('应该通过 ID 获取任务', () => {
      const task = tm.getById('a');
      expect(task.title).toBe('Alpha');
    });

    it('不存在的 ID 应该返回 undefined', () => {
      expect(tm.getById('nonexistent')).toBeUndefined();
    });

    it('getAll 应该返回所有任务的副本', () => {
      const all = tm.getAll();
      expect(all.length).toBe(2);
      // 修改返回值不应影响内部状态
      all[0].title = 'HACKED';
      expect(tm.getById('a').title).toBe('Alpha');
    });

    it('应该按优先级筛选', () => {
      const high = tm.getByPriority(TaskPriority.HIGH);
      expect(high.length).toBe(1);
      expect(high[0].id).toBe('a');
    });
  });

  // ======================== 15-19: 更新任务测试 ========================

  describe('更新任务', () => {
    let tm;
    beforeEach(() => {
      tm = new TaskManager();
      tm.create({ id: '1', title: 'Original', priority: TaskPriority.LOW });
    });

    it('应该更新标题', () => {
      tm.update('1', { title: 'Updated' });
      expect(tm.getById('1').title).toBe('Updated');
    });

    it('应该更新优先级', () => {
      tm.update('1', { priority: TaskPriority.CRITICAL });
      expect(tm.getById('1').priority).toBe(TaskPriority.CRITICAL);
    });

    it('应该更新描述', () => {
      tm.update('1', { description: 'New desc' });
      expect(tm.getById('1').description).toBe('New desc');
    });

    it('应该拒绝更新不存在的任务', () => {
      expect(() => tm.update('ghost', { title: 'X' })).toThrow('not found');
    });

    it('应该更新 updatedAt 时间戳', () => {
      const before = tm.getById('1').updatedAt;
      // 模拟时间流逝
      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);
      tm.update('1', { title: 'Later' });
      expect(tm.getById('1').updatedAt.getTime()).toBeGreaterThan(before.getTime());
      vi.useRealTimers();
    });

    it('应该拒绝无效的更新字段', () => {
      expect(() => tm.update('1', { priority: 'mega' })).toThrow('Invalid priority');
      expect(() => tm.update('1', { status: 'dead' })).toThrow('Invalid status');
    });
  });

  // ======================== 20-22: 状态流转测试 ========================

  describe('状态流转', () => {
    let tm;
    beforeEach(() => {
      tm = new TaskManager();
      tm.create({ id: '1', title: 'Flow test', priority: TaskPriority.MEDIUM });
    });

    it('应该允许 pending → in_progress → done', () => {
      tm.startTask('1');
      expect(tm.getById('1').status).toBe(TaskStatus.IN_PROGRESS);
      tm.completeTask('1');
      expect(tm.getById('1').status).toBe(TaskStatus.DONE);
    });

    it('应该拒绝非法状态转换（done → in_progress）', () => {
      tm.completeTask('1');
      expect(() => tm.startTask('1')).toThrow('Cannot transition');
    });

    it('应该支持 done → pending（重新打开）', () => {
      tm.completeTask('1');
      tm.reopenTask('1');
      expect(tm.getById('1').status).toBe(TaskStatus.PENDING);
    });
  });

  // ======================== 23-25: 删除任务测试 ========================

  describe('删除任务', () => {
    let tm;
    beforeEach(() => {
      tm = new TaskManager();
      tm.create({ id: '1', title: 'A', priority: TaskPriority.LOW });
      tm.create({ id: '2', title: 'B', priority: TaskPriority.LOW });
    });

    it('应该删除指定任务', () => {
      tm.delete('1');
      expect(tm.getCount()).toBe(1);
      expect(tm.getById('1')).toBeUndefined();
    });

    it('删除不存在的任务应该返回 false', () => {
      expect(tm.delete('ghost')).toBe(false);
    });

    it('删除后其他任务不受影响', () => {
      tm.delete('1');
      expect(tm.getById('2').title).toBe('B');
    });
  });

  // ======================== 26-28: 高级功能测试 ========================

  describe('高级功能', () => {
    let tm;
    beforeEach(() => {
      tm = new TaskManager();
      tm.create({ id: '1', title: 'Backend API', priority: TaskPriority.HIGH, tags: ['backend', 'api'], status: TaskStatus.IN_PROGRESS });
      tm.create({ id: '2', title: 'Frontend UI', priority: TaskPriority.MEDIUM, tags: ['frontend'], status: TaskStatus.PENDING });
      tm.create({ id: '3', title: 'Backend Tests', priority: TaskPriority.HIGH, tags: ['backend', 'test'], status: TaskStatus.DONE });
    });

    it('应该按标签筛选', () => {
      const backend = tm.getByTag('backend');
      expect(backend.length).toBe(2);
      const api = tm.getByTag('api');
      expect(api.length).toBe(1);
      expect(api[0].id).toBe('1');
    });

    it('应该按状态筛选', () => {
      const pending = tm.getByStatus(TaskStatus.PENDING);
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe('2');
    });

    it('应该按关键词搜索', () => {
      const results = tm.search('backend');
      expect(results.length).toBe(2);
      const results2 = tm.search('frontend');
      expect(results2.length).toBe(1);
    });

    it('应该返回正确的统计信息', () => {
      const stats = tm.getStats();
      expect(stats.total).toBe(3);
      expect(stats[TaskStatus.PENDING]).toBe(1);
      expect(stats[TaskStatus.IN_PROGRESS]).toBe(1);
      expect(stats[TaskStatus.DONE]).toBe(1);
    });

    it('应该按优先级排序（critical > high > medium > low）', () => {
      tm.create({ id: '4', title: 'Critical task', priority: TaskPriority.CRITICAL, status: TaskStatus.PENDING });
      const sorted = tm.getSortedByPriority();
      expect(sorted[0].priority).toBe(TaskPriority.CRITICAL);
      expect(sorted[sorted.length - 1].priority).toBe(TaskPriority.MEDIUM);
    });

    it('搜索应该不区分大小写', () => {
      const results = tm.search('BACKEND');
      expect(results.length).toBe(2);
    });

    it('搜索应该匹配 description', () => {
      tm.create({ id: '4', title: 'Docs', description: 'Backend documentation', priority: TaskPriority.LOW, status: TaskStatus.PENDING });
      const results = tm.search('documentation');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('4');
    });

    it('更新 tags 和 dependencies 应该生效', () => {
      tm.update('1', { tags: ['new-tag'], dependencies: ['new-dep'] });
      const task = tm.getById('1');
      expect(task.tags).toEqual(['new-tag']);
      expect(task.dependencies).toEqual(['new-dep']);
    });

    it('in_progress → pending 应该允许（暂停任务）', () => {
      // task '2' is pending in beforeEach
      tm.startTask('2');
      tm.update('2', { status: TaskStatus.PENDING });
      expect(tm.getById('2').status).toBe(TaskStatus.PENDING);
    });

    it('startTask 对不存在的任务应该抛出错误', () => {
      expect(() => tm.startTask('ghost')).toThrow('Task not found');
    });
  });
});
