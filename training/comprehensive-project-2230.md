# 综合项目实践 - 22:30

**时间:** 2026-04-23 22:30  
**内容:** 全栈项目实战 - 任务管理系统  
**技术栈:** 前端 + 状态管理 + API 设计 + 架构模式

---

## 项目概述

**项目名称:** TaskFlow - 个人任务管理系统  
**目标:** 整合前期所学，完成一个完整的全栈项目  
**核心功能:**
- 任务 CRUD（创建、读取、更新、删除）
- 任务分类与标签
- 任务优先级与截止日期
- 任务完成统计
- 数据持久化（LocalStorage + 模拟 API）

---

## 一、项目架构设计

### 目录结构

```
taskflow/
├── index.html          # 主页面
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── app.js          # 应用入口
│   ├── store.js        # 状态管理
│   ├── actions.js      # 动作定义
│   ├── reducers.js     # Reducer
│   ├── api.js          # API 层
│   ├── utils.js        # 工具函数
│   └── components/     # 组件
│       ├── TaskList.js
│       ├── TaskItem.js
│       ├── TaskForm.js
│       └── Stats.js
└── README.md
```

### 架构模式：Redux + 组件化

```
┌─────────────────────────────────────────────┐
│                  View Layer                  │
│  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │ TaskList  │  │ TaskForm  │  │  Stats   │ │
│  └───────────┘  └───────────┘  └──────────┘ │
└─────────────────────────────────────────────┘
                      ↓ ↑
┌─────────────────────────────────────────────┐
│               State Management               │
│  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │  Actions  │→│ Reducers  │←│   Store  │ │
│  └───────────┘  └───────────┘  └──────────┘ │
└─────────────────────────────────────────────┘
                      ↓ ↑
┌─────────────────────────────────────────────┐
│                  API Layer                   │
│  ┌─────────────────────────────────────────┐│
│  │  taskAPI (LocalStorage / REST Mock)     ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

---

## 二、状态管理设计

### store.js - 应用状态

```javascript
// 初始状态
const initialState = {
  tasks: [],
  filters: {
    status: 'all',      // all, active, completed
    priority: 'all',    // all, high, medium, low
    search: ''
  },
  ui: {
    loading: false,
    error: null,
    modalOpen: false
  },
  stats: {
    total: 0,
    completed: 0,
    active: 0
  }
};

// Store 类
class Store {
  constructor(reducer, preloadedState) {
    this._reducer = reducer;
    this._state = preloadedState || initialState;
    this._listeners = [];
  }

  getState() {
    return this._state;
  }

  dispatch(action) {
    this._state = this._reducer(this._state, action);
    this._listeners.forEach(listener => listener());
    return action;
  }

  subscribe(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }
}

// 创建 store
const store = new Store(reducer, initialState);
```

### actions.js - 动作定义

```javascript
// 动作类型
const ActionTypes = {
  // 任务相关
  ADD_TASK: 'ADD_TASK',
  UPDATE_TASK: 'UPDATE_TASK',
  DELETE_TASK: 'DELETE_TASK',
  TOGGLE_TASK: 'TOGGLE_TASK',
  LOAD_TASKS: 'LOAD_TASKS',
  
  // 过滤相关
  SET_FILTER: 'SET_FILTER',
  CLEAR_FILTERS: 'CLEAR_FILTERS',
  
  // UI 相关
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  TOGGLE_MODAL: 'TOGGLE_MODAL',
  
  // 统计相关
  UPDATE_STATS: 'UPDATE_STATS'
};

// 动作创建器
const actions = {
  addTask: (task) => ({
    type: ActionTypes.ADD_TASK,
    payload: task
  }),
  
  updateTask: (id, updates) => ({
    type: ActionTypes.UPDATE_TASK,
    payload: { id, updates }
  }),
  
  deleteTask: (id) => ({
    type: ActionTypes.DELETE_TASK,
    payload: id
  }),
  
  toggleTask: (id) => ({
    type: ActionTypes.TOGGLE_TASK,
    payload: id
  }),
  
  setFilter: (key, value) => ({
    type: ActionTypes.SET_FILTER,
    payload: { key, value }
  }),
  
  setLoading: (loading) => ({
    type: ActionTypes.SET_LOADING,
    payload: loading
  }),
  
  setError: (error) => ({
    type: ActionTypes.SET_ERROR,
    payload: error
  }),
  
  toggleModal: () => ({
    type: ActionTypes.TOGGLE_MODAL
  })
};
```

### reducers.js - 状态更新逻辑

```javascript
// 任务 Reducer
function tasksReducer(state = [], action) {
  switch (action.type) {
    case ActionTypes.LOAD_TASKS:
      return action.payload;
    
    case ActionTypes.ADD_TASK:
      return [...state, action.payload];
    
    case ActionTypes.UPDATE_TASK:
      return state.map(task =>
        task.id === action.payload.id
          ? { ...task, ...action.payload.updates }
          : task
      );
    
    case ActionTypes.DELETE_TASK:
      return state.filter(task => task.id !== action.payload);
    
    case ActionTypes.TOGGLE_TASK:
      return state.map(task =>
        task.id === action.payload
          ? { ...task, completed: !task.completed }
          : task
      );
    
    default:
      return state;
  }
}

// 过滤 Reducer
function filtersReducer(state = initialState.filters, action) {
  switch (action.type) {
    case ActionTypes.SET_FILTER:
      return {
        ...state,
        [action.payload.key]: action.payload.value
      };
    
    case ActionTypes.CLEAR_FILTERS:
      return initialState.filters;
    
    default:
      return state;
  }
}

// UI Reducer
function uiReducer(state = initialState.ui, action) {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case ActionTypes.SET_ERROR:
      return { ...state, error: action.payload };
    
    case ActionTypes.TOGGLE_MODAL:
      return { ...state, modalOpen: !state.modalOpen };
    
    default:
      return state;
  }
}

// 统计 Reducer
function statsReducer(state = initialState.stats, action) {
  switch (action.type) {
    case ActionTypes.UPDATE_STATS:
      return action.payload;
    
    default:
      return state;
  }
}

// 根 Reducer
function reducer(state = initialState, action) {
  return {
    tasks: tasksReducer(state.tasks, action),
    filters: filtersReducer(state.filters, action),
    ui: uiReducer(state.ui, action),
    stats: statsReducer(state.stats, action)
  };
}
```

---

## 三、API 层设计

### api.js - 数据访问层

```javascript
// LocalStorage API 实现
const STORAGE_KEY = 'taskflow_tasks';

const taskAPI = {
  // 获取所有任务
  async getAll() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },
  
  // 创建任务
  async create(task) {
    const tasks = await this.getAll();
    const newTask = {
      ...task,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      completed: false
    };
    tasks.push(newTask);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return newTask;
  },
  
  // 更新任务
  async update(id, updates) {
    const tasks = await this.getAll();
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Task not found');
    
    tasks[index] = { ...tasks[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return tasks[index];
  },
  
  // 删除任务
  async delete(id) {
    const tasks = await this.getAll();
    const filtered = tasks.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  },
  
  // 批量更新
  async bulkUpdate(updates) {
    const tasks = await this.getAll();
    const updated = tasks.map(task => {
      const update = updates.find(u => u.id === task.id);
      return update ? { ...task, ...update.updates } : task;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  }
};

// 使用示例
(async () => {
  const tasks = await taskAPI.getAll();
  const newTask = await taskAPI.create({
    title: '学习函数式编程',
    priority: 'high',
    category: 'learning',
    dueDate: '2026-04-25'
  });
  await taskAPI.update(newTask.id, { notes: '完成设计模式后继续' });
})();
```

---

## 四、组件设计

### components/TaskList.js - 任务列表组件

```javascript
class TaskList {
  constructor(store) {
    this.store = store;
    this.container = null;
  }

  mount(container) {
    this.container = container;
    this.render();
    this.unsubscribe = this.store.subscribe(() => this.render());
  }

  unmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  render() {
    const state = this.store.getState();
    const filteredTasks = this.filterTasks(state.tasks, state.filters);

    this.container.innerHTML = `
      <div class="task-list">
        ${filteredTasks.length === 0 
          ? '<div class="empty-state">暂无任务</div>'
          : filteredTasks.map(task => this.renderTask(task)).join('')
        }
      </div>
    `;

    this.bindEvents();
  }

  filterTasks(tasks, filters) {
    return tasks.filter(task => {
      // 状态过滤
      if (filters.status === 'active' && task.completed) return false;
      if (filters.status === 'completed' && !task.completed) return false;
      
      // 优先级过滤
      if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
      
      // 搜索过滤
      if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
      
      return true;
    });
  }

  renderTask(task) {
    return `
      <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
        <div class="task-checkbox">
          <input type="checkbox" ${task.completed ? 'checked' : ''} />
        </div>
        <div class="task-content">
          <h3 class="task-title">${this.escapeHtml(task.title)}</h3>
          <div class="task-meta">
            <span class="task-priority priority-${task.priority}">${task.priority}</span>
            <span class="task-category">${task.category}</span>
            ${task.dueDate ? `<span class="task-due">${task.dueDate}</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="btn-edit" aria-label="编辑任务">✏️</button>
          <button class="btn-delete" aria-label="删除任务">🗑️</button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // 切换完成状态
    this.container.querySelectorAll('.task-checkbox input').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const taskId = e.target.closest('.task-item').dataset.id;
        this.store.dispatch(actions.toggleTask(taskId));
      });
    });

    // 删除任务
    this.container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskId = e.target.closest('.task-item').dataset.id;
        if (confirm('确定删除此任务？')) {
          this.store.dispatch(actions.deleteTask(taskId));
        }
      });
    });

    // 编辑任务
    this.container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskId = e.target.closest('.task-item').dataset.id;
        this.store.dispatch(actions.toggleModal());
        // 触发编辑事件
        this.onEdit && this.onEdit(taskId);
      });
    });
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
```

### components/TaskForm.js - 任务表单组件

```javascript
class TaskForm {
  constructor(store) {
    this.store = store;
    this.container = null;
    this.editingId = null;
  }

  mount(container) {
    this.container = container;
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <form class="task-form" id="taskForm">
        <div class="form-group">
          <label for="title">任务标题 *</label>
          <input type="text" id="title" name="title" required maxlength="100" />
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="priority">优先级</label>
            <select id="priority" name="priority">
              <option value="low">低</option>
              <option value="medium" selected>中</option>
              <option value="high">高</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="category">分类</label>
            <input type="text" id="category" name="category" placeholder="如：工作、学习" />
          </div>
        </div>
        
        <div class="form-group">
          <label for="dueDate">截止日期</label>
          <input type="date" id="dueDate" name="dueDate" />
        </div>
        
        <div class="form-group">
          <label for="notes">备注</label>
          <textarea id="notes" name="notes" rows="3" maxlength="500"></textarea>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn-primary">
            ${this.editingId ? '更新任务' : '创建任务'}
          </button>
          <button type="button" class="btn-secondary" id="cancelBtn">取消</button>
        </div>
      </form>
    `;
  }

  bindEvents() {
    const form = this.container.querySelector('#taskForm');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const taskData = Object.fromEntries(formData.entries());
      
      this.store.dispatch(actions.setLoading(true));
      
      try {
        if (this.editingId) {
          await taskAPI.update(this.editingId, taskData);
          this.store.dispatch(actions.updateTask(this.editingId, taskData));
        } else {
          const newTask = await taskAPI.create(taskData);
          this.store.dispatch(actions.addTask(newTask));
        }
        
        form.reset();
        this.editingId = null;
        this.store.dispatch(actions.toggleModal());
      } catch (error) {
        this.store.dispatch(actions.setError(error.message));
      } finally {
        this.store.dispatch(actions.setLoading(false));
      }
    });

    this.container.querySelector('#cancelBtn').addEventListener('click', () => {
      this.store.dispatch(actions.toggleModal());
      this.editingId = null;
    });
  }

  setEditTask(task) {
    this.editingId = task.id;
    const form = this.container.querySelector('#taskForm');
    form.querySelector('#title').value = task.title;
    form.querySelector('#priority').value = task.priority;
    form.querySelector('#category').value = task.category || '';
    form.querySelector('#dueDate').value = task.dueDate || '';
    form.querySelector('#notes').value = task.notes || '';
  }
}
```

### components/Stats.js - 统计组件

```javascript
class Stats {
  constructor(store) {
    this.store = store;
    this.container = null;
  }

  mount(container) {
    this.container = container;
    this.render();
    this.unsubscribe = this.store.subscribe(() => this.render());
  }

  unmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  render() {
    const state = this.store.getState();
    const stats = this.calculateStats(state.tasks);

    this.container.innerHTML = `
      <div class="stats-container">
        <div class="stat-card">
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">总任务</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.active}</div>
          <div class="stat-label">进行中</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.completed}</div>
          <div class="stat-label">已完成</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.completionRate}%</div>
          <div class="stat-label">完成率</div>
        </div>
      </div>
    `;
  }

  calculateStats(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const active = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, active, completionRate };
  }
}
```

---

## 五、应用入口

### app.js - 应用初始化

```javascript
// 应用入口
class App {
  constructor() {
    this.store = store;
    this.components = {};
  }

  async init() {
    // 加载初始数据
    await this.loadInitialData();
    
    // 初始化组件
    this.initComponents();
    
    // 绑定全局事件
    this.bindGlobalEvents();
    
    console.log('🚀 TaskFlow 应用已启动');
  }

  async loadInitialData() {
    this.store.dispatch(actions.setLoading(true));
    
    try {
      const tasks = await taskAPI.getAll();
      this.store.dispatch(actions.loadTasks(tasks));
      this.updateStats();
    } catch (error) {
      this.store.dispatch(actions.setError('加载任务失败'));
    } finally {
      this.store.dispatch(actions.setLoading(false));
    }
  }

  initComponents() {
    // 任务列表
    const taskListContainer = document.querySelector('#taskList');
    this.components.taskList = new TaskList(this.store);
    this.components.taskList.mount(taskListContainer);
    this.components.taskList.onEdit = (id) => {
      const task = this.store.getState().tasks.find(t => t.id === id);
      this.components.taskForm.setEditTask(task);
    };

    // 任务表单
    const taskFormContainer = document.querySelector('#taskFormModal');
    this.components.taskForm = new TaskForm(this.store);
    this.components.taskForm.mount(taskFormContainer);

    // 统计
    const statsContainer = document.querySelector('#stats');
    this.components.stats = new Stats(this.store);
    this.components.stats.mount(statsContainer);

    // 过滤器
    const filterContainer = document.querySelector('#filters');
    this.initFilters(filterContainer);
  }

  initFilters(container) {
    container.innerHTML = `
      <div class="filter-group">
        <select id="statusFilter">
          <option value="all">全部状态</option>
          <option value="active">进行中</option>
          <option value="completed">已完成</option>
        </select>
        
        <select id="priorityFilter">
          <option value="all">全部优先级</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
        
        <input type="text" id="searchFilter" placeholder="搜索任务..." />
      </div>
    `;

    container.querySelector('#statusFilter').addEventListener('change', (e) => {
      this.store.dispatch(actions.setFilter('status', e.target.value));
    });

    container.querySelector('#priorityFilter').addEventListener('change', (e) => {
      this.store.dispatch(actions.setFilter('priority', e.target.value));
    });

    container.querySelector('#searchFilter').addEventListener('input', (e) => {
      this.store.dispatch(actions.setFilter('search', e.target.value));
    });
  }

  bindGlobalEvents() {
    // 新建任务按钮
    document.querySelector('#newTaskBtn').addEventListener('click', () => {
      this.components.taskForm.editingId = null;
      this.store.dispatch(actions.toggleModal());
    });

    // 错误提示自动消失
    this.store.subscribe(() => {
      const { error } = this.store.getState().ui;
      if (error) {
        setTimeout(() => {
          this.store.dispatch(actions.setError(null));
        }, 5000);
      }
    });
  }

  updateStats() {
    const state = this.store.getState();
    const stats = this.components.stats.calculateStats(state.tasks);
    // 可以在这里触发额外的统计更新逻辑
  }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
```

---

## 六、样式设计

### css/style.css - 核心样式

```css
/* 变量定义 */
:root {
  --primary-color: #4a90d9;
  --success-color: #28a745;
  --warning-color: #ffc107;
  --danger-color: #dc3545;
  --gray-100: #f8f9fa;
  --gray-200: #e9ecef;
  --gray-700: #495057;
  --gray-900: #212529;
}

/* 统计卡片 */
.stats-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: var(--primary-color);
}

.stat-label {
  color: var(--gray-700);
  margin-top: 0.5rem;
}

/* 任务列表 */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.task-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.task-item:hover {
  transform: translateX(4px);
}

.task-item.completed {
  opacity: 0.6;
}

.task-item.completed .task-title {
  text-decoration: line-through;
}

/* 优先级标签 */
.priority-high { color: var(--danger-color); }
.priority-medium { color: var(--warning-color); }
.priority-low { color: var(--success-color); }

/* 表单样式 */
.task-form {
  max-width: 500px;
  margin: 0 auto;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--gray-200);
  border-radius: 4px;
  font-size: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

/* 响应式 */
@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .task-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .task-actions {
    width: 100%;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
}
```

---

## 七、项目总结

### 技术整合

| 技术领域 | 应用内容 |
|----------|----------|
| 架构设计 | Redux 模式 + 组件化 |
| 状态管理 | 自定义 Store + Reducers |
| API 设计 | LocalStorage + 异步操作 |
| 组件设计 | 类组件 + 挂载/卸载生命周期 |
| 函数式编程 | 纯函数、组合、不可变性 |
| 响应式 | 订阅者模式实现视图更新 |

### 核心亮点

1. **完整 Redux 架构**: 从 Store 到 Actions 到 Reducers 完整实现
2. **组件化设计**: 可复用、可测试的独立组件
3. **数据持久化**: LocalStorage 实现离线可用
4. **响应式更新**: 订阅者模式自动同步视图
5. **错误处理**: 完善的错误状态管理

### 可扩展方向

1. **后端集成**: 替换 LocalStorage 为真实 REST API
2. **用户认证**: 添加登录/注册功能
3. **协作功能**: 多用户任务共享
4. **推送通知**: 截止日期提醒
5. **数据可视化**: 任务完成趋势图表

---

_训练完成时间：2026-04-24 00:30_
