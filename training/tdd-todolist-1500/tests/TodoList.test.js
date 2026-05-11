/**
 * TodoList — TDD 测试套件 (2026-04-27 15:00)
 *
 * 测试驱动开发流程：
 *   🔴 Red   → 先写失败的测试
 *   🟢 Green → 写刚好通过测试的代码
 *   🔵 Refactor → 优化代码，保持测试通过
 *
 * 共 28 个测试用例，覆盖：
 *   - 初始化 & 添加
 *   - 切换/删除/更新
 *   - 优先级 & 标签
 *   - 过滤 & 搜索
 *   - 统计 & 排序
 *   - 批量操作 & 导入导出
 *   - 边界条件 & 异常
 *   - DOM 渲染 (Testing Library 风格)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TodoList, TodoListRenderer } from '../src/TodoList.js';

// ======================== 1-3: 初始化测试 ========================

describe('TodoList 初始化', () => {
  it('应该创建空的 TodoList', () => {
    const list = new TodoList();
    expect(list.getAll()).toEqual([]);
    expect(list.getStats()).toEqual({ total: 0, completed: 0, pending: 0, byPriority: { low: 0, normal: 0, high: 0 } });
  });

  it('应该支持自定义 maxItems', () => {
    const list = new TodoList({ maxItems: 2 });
    list.add('First');
    list.add('Second');
    expect(() => list.add('Third')).toThrow('Todo list is full');
  });

  it('应该支持 onChange 回调', () => {
    const onChange = vi.fn();
    const list = new TodoList({ onChange });
    list.add('Test');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ text: 'Test' })
    ]));
  });
});

// ======================== 4-7: 添加测试 ========================

describe('添加待办', () => {
  let list;
  beforeEach(() => { list = new TodoList(); });

  it('应该添加基本待办', () => {
    const todo = list.add('Buy milk');
    expect(todo).toMatchObject({
      id: 1,
      text: 'Buy milk',
      completed: false,
      priority: 'normal',
      tags: [],
    });
    expect(list.getAll().length).toBe(1);
  });

  it('应该支持自定义优先级和标签', () => {
    const todo = list.add('Urgent task', { priority: 'high', tags: ['work', 'urgent'] });
    expect(todo.priority).toBe('high');
    expect(todo.tags).toEqual(['work', 'urgent']);
  });

  it('应该自动 trim 文本', () => {
    const todo = list.add('  Trimmed  ');
    expect(todo.text).toBe('Trimmed');
  });

  it('应该拒绝无效文本', () => {
    expect(() => list.add('')).toThrow('Todo text is required');
    expect(() => list.add('   ')).toThrow('Todo text cannot be empty');
    expect(() => list.add(null)).toThrow('Todo text is required');
    expect(() => list.add(123)).toThrow('Todo text is required');
  });

  it('应该拒绝超长文本', () => {
    expect(() => list.add('x'.repeat(501))).toThrow('Todo text too long');
  });

  it('应该支持 onAdd 回调', () => {
    const onAdd = vi.fn();
    const list = new TodoList({ onAdd });
    const todo = list.add('Callback test');
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: todo.id }));
  });
});

// ======================== 8-10: 切换/删除/更新测试 ========================

describe('切换/删除/更新', () => {
  let list;
  beforeEach(() => {
    list = new TodoList();
    list.add('First');
    list.add('Second');
  });

  it('应该切换完成状态', () => {
    const todo = list.toggle(1);
    expect(todo.completed).toBe(true);
    expect(todo.completedAt).toBeInstanceOf(Date);

    const toggledBack = list.toggle(1);
    expect(toggledBack.completed).toBe(false);
    expect(toggledBack.completedAt).toBeNull();
  });

  it('应该删除待办', () => {
    const removed = list.remove(1);
    expect(removed.text).toBe('First');
    expect(list.getAll().length).toBe(1);
    expect(list.getAll()[0].text).toBe('Second');
  });

  it('应该更新文本', () => {
    const updated = list.updateText(1, 'Updated text');
    expect(updated.text).toBe('Updated text');
    expect(() => list.updateText(1, '')).toThrow('New text is required');
    expect(() => list.updateText(999, 'Nope')).toThrow('Todo #999 not found');
  });
});

// ======================== 11-14: 优先级 & 标签测试 ========================

describe('优先级 & 标签', () => {
  let list;
  beforeEach(() => {
    list = new TodoList();
    list.add('Task A');
    list.add('Task B');
  });

  it('应该设置优先级', () => {
    const todo = list.setPriority(1, 'high');
    expect(todo.priority).toBe('high');
    expect(() => list.setPriority(1, 'urgent')).toThrow('Invalid priority');
  });

  it('应该添加标签', () => {
    list.addTag(1, 'Work');
    list.addTag(1, 'work'); // 幂等
    const todo = list.findById(1);
    expect(todo.tags).toEqual(['work']);
  });

  it('应该移除标签', () => {
    list.addTag(1, 'work');
    list.addTag(1, 'personal');
    list.removeTag(1, 'work');
    expect(list.findById(1).tags).toEqual(['personal']);
  });

  it('应该按优先级过滤', () => {
    list.setPriority(1, 'high');
    list.setPriority(2, 'low');
    expect(list.getByPriority('high').length).toBe(1);
    expect(list.getByPriority('low').length).toBe(1);
    expect(list.getByPriority('normal').length).toBe(0);
  });
});

// ======================== 15-18: 过滤 & 搜索测试 ========================

describe('过滤 & 搜索', () => {
  let list;
  beforeEach(() => {
    list = new TodoList();
    list.add('Buy groceries', { tags: ['shopping'] });
    list.add('Write report', { tags: ['work'] });
    list.add('Clean house', { tags: ['home'] });
    list.toggle(1); // 完成第一个
  });

  it('应该获取完成列表', () => {
    expect(list.getCompleted().length).toBe(1);
    expect(list.getCompleted()[0].text).toBe('Buy groceries');
  });

  it('应该获取未完成列表', () => {
    expect(list.getPending().length).toBe(2);
  });

  it('应该按标签过滤', () => {
    expect(list.getByTag('work').length).toBe(1);
    expect(list.getByTag('WORK').length).toBe(1); // 大小写不敏感
    expect(list.getByTag('nonexistent').length).toBe(0);
  });

  it('应该搜索文本和标签', () => {
    expect(list.search('groceries').length).toBe(1);
    expect(list.search('work').length).toBe(1); // 匹配标签
    expect(list.search('report').length).toBe(1);
    expect(list.search('xyz').length).toBe(0);
  });
});

// ======================== 19-22: 统计 & 排序测试 ========================

describe('统计 & 排序', () => {
  let list;
  beforeEach(() => {
    list = new TodoList();
    list.add('Low task', { priority: 'low' });
    list.add('Normal task', { priority: 'normal' });
    list.add('High task', { priority: 'high' });
    list.toggle(1);
  });

  it('应该返回正确统计', () => {
    const stats = list.getStats();
    expect(stats).toEqual({
      total: 3,
      completed: 1,
      pending: 2,
      byPriority: { low: 1, normal: 1, high: 1 },
    });
  });

  it('应该按优先级排序', () => {
    list.sortByPriority();
    const ids = list.getAll().map(t => t.id);
    expect(ids).toEqual([3, 2, 1]); // high(3) > normal(2) > low(1)
  });

  it('findById 应该返回匹配项', () => {
    expect(list.findById(1).text).toBe('Low task');
    expect(list.findById(999)).toBeNull();
  });

  it('getAll 应该返回副本', () => {
    const all = list.getAll();
    all.push({ fake: true });
    expect(list.getAll().length).toBe(3); // 原数组不受影响
  });
});

// ======================== 23-26: 批量操作 & 导入导出测试 ========================

describe('批量操作 & 导入导出', () => {
  let list;
  beforeEach(() => {
    list = new TodoList();
    list.add('Task 1');
    list.add('Task 2');
    list.add('Task 3');
  });

  it('应该批量完成所有', () => {
    list.completeAll();
    expect(list.getStats().completed).toBe(3);
    expect(list.getStats().pending).toBe(0);
  });

  it('应该清除已完成', () => {
    list.toggle(1);
    list.toggle(2);
    const removed = list.clearCompleted();
    expect(removed).toBe(2);
    expect(list.getAll().length).toBe(1);
  });

  it('应该清空所有', () => {
    const count = list.clear();
    expect(count).toBe(3);
    expect(list.getAll()).toEqual([]);
  });

  it('应该支持导入导出', () => {
    list.add('New task');
    const exported = list.export();
    expect(exported.length).toBe(4);

    const list2 = new TodoList();
    list2.import(exported);
    expect(list2.getAll().length).toBe(4);
    expect(list2.export()).toEqual(exported);
  });
});

// ======================== 27-28: 边界条件测试 ========================

describe('边界条件', () => {
  it('空列表操作应该安全', () => {
    const list = new TodoList();
    expect(list.getCompleted()).toEqual([]);
    expect(list.getPending()).toEqual([]);
    expect(list.search('anything')).toEqual([]);
    expect(list.clearCompleted()).toBe(0);
  });

  it('id 自增不应该受删除影响', () => {
    const list = new TodoList();
    list.add('A'); // id=1
    list.add('B'); // id=2
    list.remove(1);
    list.add('C'); // id=3 (不是 1)
    expect(list.findById(3).text).toBe('C');
    expect(list.findById(1)).toBeNull();
  });
});

// ======================== DOM 渲染测试 (Testing Library 风格) ========================

describe('TodoListRenderer DOM 渲染', () => {
  let container;
  let list;
  let renderer;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    list = new TodoList();
    list.add('First task');
    list.add('Second task', { priority: 'high' });
    renderer = new TodoListRenderer(container, list);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('应该渲染标题和统计', () => {
    const { header, stats } = renderer.getElements();
    expect(header.textContent).toBe('Todo List');
    expect(stats.textContent).toContain('2 pending');
    expect(stats.textContent).toContain('0 completed');
  });

  it('应该渲染输入框和添加按钮', () => {
    const { input, addButton } = renderer.getElements();
    expect(input.placeholder).toBe('Add a todo...');
    expect(addButton.textContent).toBe('Add');
  });

  it('应该渲染待办列表项', () => {
    const { list: listEl } = renderer.getElements();
    const items = listEl.querySelectorAll('.todo-item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('.todo-text').textContent).toBe('First task');
    expect(items[1].querySelector('.todo-text').textContent).toBe('Second task');
  });

  it('应该渲染优先级标记', () => {
    const { list: listEl } = renderer.getElements();
    const badges = listEl.querySelectorAll('.priority-badge');
    expect(badges[0].textContent).toBe('normal');
    expect(badges[1].textContent).toBe('high');
  });

  it('应该渲染清除按钮', () => {
    const { clearBtn } = renderer.getElements();
    expect(clearBtn.textContent).toBe('Clear Completed');
  });

  it('应该渲染完成状态的 CSS 类', () => {
    list.toggle(1);
    renderer.render();
    const { list: ul } = renderer.getElements();
    const items = ul.querySelectorAll('.todo-item');
    expect(items[0].classList.contains('completed')).toBe(true);
    expect(items[1].classList.contains('completed')).toBe(false);
  });

  it('checkbox 应该绑定切换事件', () => {
    const { list: ul } = renderer.getElements();
    const checkbox = ul.querySelector('.todo-checkbox');
    checkbox.checked = false; // 初始为未勾选
    checkbox.dispatchEvent(new Event('change'));
    expect(list.findById(1).completed).toBe(true);
  });

  it('删除按钮应该绑定删除事件', () => {
    const { list: ul } = renderer.getElements();
    const deleteBtn = ul.querySelector('.delete-btn');
    deleteBtn.dispatchEvent(new Event('click'));
    expect(list.getAll().length).toBe(1);
  });

  it('添加按钮应该添加新待办', () => {
    const { input, addButton } = renderer.getElements();
    input.value = 'New task from UI';
    addButton.dispatchEvent(new Event('click'));
    expect(list.getAll().length).toBe(3);
    expect(list.getAll()[2].text).toBe('New task from UI');
  });

  it('Enter 键应该触发添加', () => {
    const { input } = renderer.getElements();
    input.value = 'From Enter key';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(list.getAll().length).toBe(3);
  });

  it('清除已完成按钮应该工作', () => {
    list.toggle(1);
    renderer.render();
    const { clearBtn } = renderer.getElements();
    clearBtn.dispatchEvent(new Event('click'));
    expect(list.getAll().length).toBe(1);
    expect(list.findById(1)).toBeNull();
  });
});
