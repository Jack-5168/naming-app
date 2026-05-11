/**
 * TodoList — TDD 实战 (2026-04-27 15:00)
 *
 * 测试驱动开发流程：
 *   🔴 Red   → 先写失败的测试
 *   🟢 Green → 写刚好通过测试的代码
 *   🔵 Refactor → 优化代码，保持测试通过
 *
 * 目标：20+ 测试用例，覆盖率 90%+
 * 技术栈：Vitest + Testing Library (DOM)
 */

// ======================== TodoList 核心引擎 ========================

export class TodoList {
  constructor(options = {}) {
    this.todos = [];
    this.nextId = 1;
    this.maxItems = options.maxItems ?? Infinity;
    this.onAdd = options.onAdd ?? null;
    this.onChange = options.onChange ?? null;
  }

  /**
   * 添加待办事项
   */
  add(text, options = {}) {
    if (!text || typeof text !== 'string') {
      throw new Error('Todo text is required');
    }
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new Error('Todo text cannot be empty');
    }
    if (trimmed.length > 500) {
      throw new Error('Todo text too long (max 500 chars)');
    }
    if (this.todos.length >= this.maxItems) {
      throw new Error('Todo list is full');
    }

    const todo = {
      id: this.nextId++,
      text: trimmed,
      completed: options.completed ?? false,
      priority: options.priority ?? 'normal', // 'low' | 'normal' | 'high'
      tags: options.tags ?? [],
      createdAt: options.createdAt ?? new Date(),
      completedAt: null,
    };

    this.todos.push(todo);

    if (this.onAdd) {
      this.onAdd(todo);
    }
    if (this.onChange) {
      this.onChange(this.todos);
    }

    return todo;
  }

  /**
   * 切换完成状态
   */
  toggle(id) {
    const todo = this.findById(id);
    if (!todo) throw new Error(`Todo #${id} not found`);

    todo.completed = !todo.completed;
    todo.completedAt = todo.completed ? new Date() : null;

    if (this.onChange) {
      this.onChange(this.todos);
    }

    return todo;
  }

  /**
   * 删除待办事项
   */
  remove(id) {
    const index = this.todos.findIndex(t => t.id === id);
    if (index === -1) throw new Error(`Todo #${id} not found`);

    const [removed] = this.todos.splice(index, 1);

    if (this.onChange) {
      this.onChange(this.todos);
    }

    return removed;
  }

  /**
   * 更新待办事项文本
   */
  updateText(id, newText) {
    if (!newText || typeof newText !== 'string') {
      throw new Error('New text is required');
    }
    const trimmed = newText.trim();
    if (trimmed.length === 0) {
      throw new Error('Text cannot be empty');
    }
    if (trimmed.length > 500) {
      throw new Error('Text too long (max 500 chars)');
    }

    const todo = this.findById(id);
    if (!todo) throw new Error(`Todo #${id} not found`);

    todo.text = trimmed;

    if (this.onChange) {
      this.onChange(this.todos);
    }

    return todo;
  }

  /**
   * 设置优先级
   */
  setPriority(id, priority) {
    const validPriorities = ['low', 'normal', 'high'];
    if (!validPriorities.includes(priority)) {
      throw new Error(`Invalid priority: ${priority}. Must be one of: ${validPriorities.join(', ')}`);
    }

    const todo = this.findById(id);
    if (!todo) throw new Error(`Todo #${id} not found`);

    todo.priority = priority;

    if (this.onChange) {
      this.onChange(this.todos);
    }

    return todo;
  }

  /**
   * 添加标签
   */
  addTag(id, tag) {
    const todo = this.findById(id);
    if (!todo) throw new Error(`Todo #${id} not found`);

    const normalized = tag.toLowerCase().trim();
    if (!normalized) throw new Error('Tag cannot be empty');
    if (todo.tags.includes(normalized)) {
      return todo; // 幂等操作
    }

    todo.tags.push(normalized);

    if (this.onChange) {
      this.onChange(this.todos);
    }

    return todo;
  }

  /**
   * 移除标签
   */
  removeTag(id, tag) {
    const todo = this.findById(id);
    if (!todo) throw new Error(`Todo #${id} not found`);

    const normalized = tag.toLowerCase().trim();
    todo.tags = todo.tags.filter(t => t !== normalized);

    if (this.onChange) {
      this.onChange(this.todos);
    }

    return todo;
  }

  /**
   * 查找单个
   */
  findById(id) {
    return this.todos.find(t => t.id === id) ?? null;
  }

  /**
   * 获取所有
   */
  getAll() {
    return [...this.todos];
  }

  /**
   * 获取完成列表
   */
  getCompleted() {
    return this.todos.filter(t => t.completed);
  }

  /**
   * 获取未完成列表
   */
  getPending() {
    return this.todos.filter(t => !t.completed);
  }

  /**
   * 按标签过滤
   */
  getByTag(tag) {
    const normalized = tag.toLowerCase().trim();
    return this.todos.filter(t => t.tags.includes(normalized));
  }

  /**
   * 按优先级过滤
   */
  getByPriority(priority) {
    const validPriorities = ['low', 'normal', 'high'];
    if (!validPriorities.includes(priority)) {
      throw new Error(`Invalid priority: ${priority}`);
    }
    return this.todos.filter(t => t.priority === priority);
  }

  /**
   * 搜索
   */
  search(query) {
    if (!query || typeof query !== 'string') {
      throw new Error('Search query is required');
    }
    const lowerQuery = query.toLowerCase().trim();
    return this.todos.filter(t =>
      t.text.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.includes(lowerQuery))
    );
  }

  /**
   * 统计
   */
  getStats() {
    const total = this.todos.length;
    const completed = this.todos.filter(t => t.completed).length;
    const pending = total - completed;
    const byPriority = {
      low: this.todos.filter(t => t.priority === 'low').length,
      normal: this.todos.filter(t => t.priority === 'normal').length,
      high: this.todos.filter(t => t.priority === 'high').length,
    };
    return { total, completed, pending, byPriority };
  }

  /**
   * 按优先级排序（high > normal > low）
   */
  sortByPriority() {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    this.todos.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    return this.todos;
  }

  /**
   * 批量完成
   */
  completeAll() {
    const now = new Date();
    let changed = false;
    for (const todo of this.todos) {
      if (!todo.completed) {
        todo.completed = true;
        todo.completedAt = now;
        changed = true;
      }
    }
    if (changed && this.onChange) {
      this.onChange(this.todos);
    }
    return this.todos;
  }

  /**
   * 清除已完成
   */
  clearCompleted() {
    const before = this.todos.length;
    this.todos = this.todos.filter(t => !t.completed);
    const removed = before - this.todos.length;

    if (removed > 0 && this.onChange) {
      this.onChange(this.todos);
    }

    return removed;
  }

  /**
   * 清空
   */
  clear() {
    const count = this.todos.length;
    this.todos = [];
    this.nextId = 1;

    if (this.onChange) {
      this.onChange(this.todos);
    }

    return count;
  }

  /**
   * 导入（用于测试/恢复）
   */
  import(todos) {
    if (!Array.isArray(todos)) throw new Error('Todos must be an array');
    for (const t of todos) {
      if (!t.id || !t.text) throw new Error('Invalid todo item');
    }
    this.todos = todos.map(t => ({ ...t }));
    this.nextId = Math.max(...this.todos.map(t => t.id), 0) + 1;

    if (this.onChange) {
      this.onChange(this.todos);
    }

    return this.todos;
  }

  /**
   * 导出
   */
  export() {
    return JSON.parse(JSON.stringify(this.todos));
  }
}

// ======================== TodoList DOM 渲染器 ========================

export class TodoListRenderer {
  constructor(container, todoList) {
    this.container = container;
    this.todoList = todoList;
    this.render();
  }

  render() {
    this.container.innerHTML = '';

    const header = this._el('h2', { textContent: 'Todo List' });
    const stats = this._el('p', { className: 'stats', textContent: this._statsText() });
    const inputRow = this._el('div', { className: 'input-row' });
    const input = this._el('input', {
      className: 'todo-input',
      type: 'text',
      placeholder: 'Add a todo...',
    });
    const addButton = this._el('button', { className: 'add-btn', textContent: 'Add' });
    inputRow.append(input, addButton);

    const list = this._el('ul', { className: 'todo-list' });
    for (const todo of this.todoList.getAll()) {
      list.appendChild(this._renderTodoItem(todo));
    }

    const footer = this._el('div', { className: 'footer' });
    const clearBtn = this._el('button', { className: 'clear-btn', textContent: 'Clear Completed' });
    footer.appendChild(clearBtn);

    this.container.append(header, stats, inputRow, list, footer);

    // 事件绑定
    addButton.addEventListener('click', () => {
      const text = input.value;
      if (text.trim()) {
        this.todoList.add(text);
        input.value = '';
        this.render();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        addButton.click();
      }
    });

    clearBtn.addEventListener('click', () => {
      this.todoList.clearCompleted();
      this.render();
    });

    // 存储引用以便测试
    this._elements = { header, stats, input, addButton, list, clearBtn, footer };
  }

  _renderTodoItem(todo) {
    const li = this._el('li', {
      className: `todo-item ${todo.completed ? 'completed' : ''} priority-${todo.priority}`,
      'data-id': String(todo.id),
    });

    const checkbox = this._el('input', {
      type: 'checkbox',
      className: 'todo-checkbox',
      checked: todo.completed,
      'data-id': String(todo.id),
    });

    const text = this._el('span', { className: 'todo-text', textContent: todo.text });

    const priorityBadge = this._el('span', {
      className: 'priority-badge',
      textContent: todo.priority,
    });

    const deleteBtn = this._el('button', {
      className: 'delete-btn',
      textContent: '✕',
      'data-id': String(todo.id),
    });

    li.append(checkbox, text, priorityBadge, deleteBtn);

    checkbox.addEventListener('change', () => {
      this.todoList.toggle(todo.id);
      this.render();
    });

    deleteBtn.addEventListener('click', () => {
      this.todoList.remove(todo.id);
      this.render();
    });

    return li;
  }

  _statsText() {
    const stats = this.todoList.getStats();
    return `${stats.pending} pending, ${stats.completed} completed`;
  }

  _el(tag, attrs = {}) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('on')) {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'textContent') {
        el.textContent = value;
      } else {
        el.setAttribute(key, value);
      }
    }
    return el;
  }

  getElements() {
    return this._elements;
  }
}
