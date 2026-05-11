/**
 * OfflineTasks 应用主逻辑
 *
 * 功能：
 * 1. Service Worker 注册与生命周期管理
 * 2. IndexedDB 数据绑定
 * 3. UI 渲染与交互（任务 CRUD、分类管理、拖拽排序）
 * 4. 在线/离线状态检测与 UI 反馈
 * 5. PWA 安装提示
 * 6. 手动同步（Background Sync）
 * 7. 数据导出/导入
 * 8. 拖拽排序（HTML5 Drag & Drop）
 * 9. 搜索与筛选
 * 10. 通知权限请求
 */

// ============================================
// 全局状态
// ============================================
const state = {
  tasks: [],
  categories: [],
  currentFilter: { status: 'all', priority: 'all', category: 'all' },
  searchQuery: '',
  sortBy: 'order',
  sortOrder: 'asc',
  isOnline: navigator.onLine,
  editingTask: null,
  showAddModal: false,
  showCategoryModal: false,
  deferredPrompt: null,
  dragSourceId: null,
};

const db = new OfflineDB();

// ============================================
// 1. Service Worker 注册
// ============================================
async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[APP] 浏览器不支持 Service Worker');
    updateConnectionStatus(false);
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    console.log('[APP] Service Worker 注册成功:', registration.scope);

    // 监听更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showNotification('🔄 新版本可用，刷新页面更新', 'info');
        }
      });
    });

    // 监听 SW 消息
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type } = event.data || {};
      if (type === 'DATA_UPDATED') {
        console.log('[APP] SW 通知数据更新');
        loadTasks();
      }
      if (type === 'PERFORM_SYNC') {
        performSync();
      }
    });

    // 请求后台同步权限
    if ('sync' in registration) {
      try {
        await registration.sync.register('sync-tasks');
        console.log('[APP] Background Sync 已注册');
      } catch (e) {
        console.warn('[APP] Background Sync 注册失败:', e);
      }
    }
  } catch (err) {
    console.error('[APP] Service Worker 注册失败:', err);
  }
}

// ============================================
// 2. PWA 安装
// ============================================
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredPrompt = e;
  const installBtn = document.getElementById('install-btn');
  if (installBtn) installBtn.style.display = 'block';
  console.log('[APP] PWA 安装提示可用');
});

async function installPWA() {
  if (!state.deferredPrompt) return;
  state.deferredPrompt.prompt();
  const { outcome } = await state.deferredPrompt.userChoice;
  console.log('[APP] PWA 安装结果:', outcome);
  state.deferredPrompt = null;
  document.getElementById('install-btn').style.display = 'none';
}

// ============================================
// 3. 在线/离线状态
// ============================================
function updateConnectionStatus(online) {
  state.isOnline = online;
  const indicator = document.getElementById('connection-indicator');
  if (indicator) {
    indicator.className = `connection-indicator ${online ? 'online' : 'offline'}`;
    indicator.innerHTML = online
      ? '<span class="status-dot online"></span> 在线'
      : '<span class="status-dot offline"></span> 离线';
  }
  if (!online) {
    showNotification('📴 已断开网络连接，数据将本地保存', 'warning');
  } else {
    showNotification('📶 已恢复网络连接', 'success');
    performSync();
  }
}

window.addEventListener('online', () => updateConnectionStatus(true));
window.addEventListener('offline', () => updateConnectionStatus(false));

// ============================================
// 4. 数据加载
// ============================================
async function loadTasks() {
  try {
    const { status, priority, category } = state.currentFilter;
    const filters = {};
    if (status !== 'all') filters.status = status;
    if (priority !== 'all') filters.priority = priority;
    if (category !== 'all') filters.category = category;

    let tasks = await db.getAllTasks({ ...filters, sortBy: state.sortBy, sortOrder: state.sortOrder });

    // 搜索过滤
    if (state.searchQuery) {
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
          (t.description && t.description.toLowerCase().includes(state.searchQuery.toLowerCase()))
      );
    }

    state.tasks = tasks;
    renderTasks();
    renderStats();
  } catch (err) {
    console.error('[APP] 加载任务失败:', err);
  }
}

async function loadCategories() {
  try {
    state.categories = await db.getAllCategories();
    renderCategoryFilter();
  } catch (err) {
    console.error('[APP] 加载分类失败:', err);
  }
}

// ============================================
// 5. UI 渲染
// ============================================
function renderTasks() {
  const container = document.getElementById('task-list');
  if (!container) return;

  if (state.tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${state.searchQuery ? '🔍' : '✅'}</div>
        <h3>${state.searchQuery ? '没有匹配的任务' : '暂无任务'}</h3>
        <p>${state.searchQuery ? '尝试其他搜索词' : '点击 "+" 按钮添加新任务'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.tasks
    .map(
      (task) => `
    <div class="task-card ${task.status} priority-${task.priority}"
         draggable="true"
         data-id="${task.id}"
         ondragstart="onDragStart(event)"
         ondragover="onDragOver(event)"
         ondrop="onDrop(event)"
         ondragend="onDragEnd(event)">
      <div class="task-header">
        <div class="task-checkbox" onclick="toggleTaskStatus('${task.id}')">
          ${task.status === 'done' ? '☑️' : task.status === 'in-progress' ? '🔄' : '⬜'}
        </div>
        <div class="task-title-area">
          <h4 class="task-title ${task.status === 'done' ? 'completed' : ''}">${escapeHtml(task.title)}</h4>
          ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
        </div>
        <div class="task-actions">
          <button class="btn-icon" onclick="editTask('${task.id}')" title="编辑">✏️</button>
          <button class="btn-icon" onclick="deleteTask('${task.id}')" title="删除">🗑️</button>
        </div>
      </div>
      <div class="task-meta">
        <span class="priority-badge priority-${task.priority}">${getPriorityLabel(task.priority)}</span>
        <span class="status-badge status-${task.status}">${getStatusLabel(task.status)}</span>
        ${task.category ? `<span class="category-badge">${getCategoryLabel(task.category)}</span>` : ''}
        ${task.dueDate ? `<span class="due-date ${isOverdue(task) ? 'overdue' : ''}">📅 ${formatDate(task.dueDate)}</span>` : ''}
        ${task.tags && task.tags.length ? task.tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('') : ''}
      </div>
    </div>
  `
    )
    .join('');
}

function renderStats() {
  db.getTaskStats().then((stats) => {
    const statsEl = document.getElementById('task-stats');
    if (!statsEl) return;
    statsEl.innerHTML = `
      <div class="stat-card">
        <span class="stat-number">${stats.total}</span>
        <span class="stat-label">全部</span>
      </div>
      <div class="stat-card todo">
        <span class="stat-number">${stats.byStatus.todo}</span>
        <span class="stat-label">待办</span>
      </div>
      <div class="stat-card progress">
        <span class="stat-number">${stats.byStatus['in-progress']}</span>
        <span class="stat-label">进行中</span>
      </div>
      <div class="stat-card done">
        <span class="stat-number">${stats.byStatus.done}</span>
        <span class="stat-label">已完成</span>
      </div>
      ${stats.overdue > 0 ? `
      <div class="stat-card overdue">
        <span class="stat-number">${stats.overdue}</span>
        <span class="stat-label">⚠️ 已过期</span>
      </div>` : ''}
    `;
  });
}

function renderCategoryFilter() {
  const filter = document.getElementById('category-filter');
  if (!filter) return;
  filter.innerHTML = `
    <option value="all">全部分类</option>
    ${state.categories.map((c) => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join('')}
  `;
}

// ============================================
// 6. 任务操作
// ============================================
async function addTask(taskData) {
  try {
    const task = await db.createTask(taskData);
    // 加入同步队列
    await db.addToSyncQueue('create', { taskId: task.id, data: task });
    await loadTasks();
    showNotification('✅ 任务已添加', 'success');
    requestBackgroundSync();
  } catch (err) {
    console.error('[APP] 添加任务失败:', err);
    showNotification('❌ 添加失败', 'error');
  }
}

async function updateTaskData(id, updates) {
  try {
    const task = await db.updateTask(id, updates);
    await db.addToSyncQueue('update', { taskId: id, data: updates });
    await loadTasks();
    showNotification('✅ 任务已更新', 'success');
    requestBackgroundSync();
  } catch (err) {
    console.error('[APP] 更新任务失败:', err);
    showNotification('❌ 更新失败', 'error');
  }
}

async function deleteTask(id) {
  if (!confirm('确定删除此任务？')) return;
  try {
    await db.deleteTask(id);
    await db.addToSyncQueue('delete', { taskId: id });
    await loadTasks();
    showNotification('🗑️ 任务已删除', 'info');
    requestBackgroundSync();
  } catch (err) {
    console.error('[APP] 删除任务失败:', err);
  }
}

async function toggleTaskStatus(id) {
  const task = await db.getTask(id);
  if (!task) return;

  const statusFlow = { todo: 'in-progress', 'in-progress': 'done', done: 'todo' };
  const newStatus = statusFlow[task.status] || 'todo';
  await updateTaskData(id, { status: newStatus });
}

async function editTask(id) {
  const task = await db.getTask(id);
  if (!task) return;
  state.editingTask = task;
  openTaskModal(task);
}

// ============================================
// 7. 拖拽排序
// ============================================
function onDragStart(e) {
  state.dragSourceId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', state.dragSourceId);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.currentTarget;
  card.classList.add('drag-over');
}

async function onDrop(e) {
  e.preventDefault();
  const targetId = e.currentTarget.dataset.id;
  if (state.dragSourceId === targetId) return;

  const sourceIndex = state.tasks.findIndex((t) => t.id === state.dragSourceId);
  const targetIndex = state.tasks.findIndex((t) => t.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;

  // 重新排序
  const newTasks = [...state.tasks];
  const [moved] = newTasks.splice(sourceIndex, 1);
  newTasks.splice(targetIndex, 0, moved);

  // 更新 order
  const orders = newTasks.map((t, i) => ({ id: t.id, order: i * 1000 }));
  await db.reorderTasks(orders);
  await db.addToSyncQueue('reorder', { orders });
  await loadTasks();
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
  state.dragSourceId = null;
}

// ============================================
// 8. 筛选与搜索
// ============================================
function applyFilters() {
  state.currentFilter.status = document.getElementById('status-filter').value;
  state.currentFilter.priority = document.getElementById('priority-filter').value;
  state.currentFilter.category = document.getElementById('category-filter').value;
  state.searchQuery = document.getElementById('search-input').value.trim();
  loadTasks();
}

function changeSort(field) {
  if (state.sortBy === field) {
    state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortBy = field;
    state.sortOrder = 'asc';
  }
  loadTasks();
}

// ============================================
// 9. 同步
// ============================================
async function performSync() {
  if (!state.isOnline) {
    showNotification('📴 离线状态，无法同步', 'warning');
    return;
  }

  const pending = await db.getPendingSyncs();
  if (pending.length === 0) {
    showNotification('✅ 数据已是最新', 'info');
    return;
  }

  showNotification(`🔄 正在同步 ${pending.length} 个操作...`, 'info');

  for (const entry of pending) {
    try {
      // 模拟 API 同步（实际项目中替换为真实 API 调用）
      await new Promise((resolve) => setTimeout(resolve, 200));
      await db.markSyncComplete(entry.id);
    } catch {
      await db.markSyncFailed(entry.id);
    }
  }

  await db.clearCompletedSyncs();
  const remaining = await db.getPendingSyncs();
  if (remaining.length === 0) {
    showNotification('✅ 同步完成', 'success');
  } else {
    showNotification(`⚠️ ${remaining.length} 个操作同步失败`, 'warning');
  }
}

function requestBackgroundSync() {
  if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
    navigator.serviceWorker.ready.then((reg) => {
      return reg.sync.register('sync-tasks');
    });
  }
}

// ============================================
// 10. 数据导出/导入
// ============================================
async function exportData() {
  const data = await db.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `offlinetasks-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showNotification('💾 数据已导出', 'success');
}

async function importData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await db.importData(data);
    await loadTasks();
    await loadCategories();
    showNotification('📂 数据已导入', 'success');
  } catch (err) {
    console.error('[APP] 导入失败:', err);
    showNotification('❌ 导入失败：无效文件', 'error');
  }
}

// ============================================
// 11. 通知权限
// ============================================
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showNotification('🔔 浏览器不支持通知', 'warning');
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    showNotification('🔔 通知权限已开启', 'success');
    // 发送测试通知
    new Notification('OfflineTasks', {
      body: '通知已开启！你将收到任务提醒',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%233b82f6" width="100" height="100" rx="16"/><path d="M30 50l15 15 25-30" stroke="white" stroke-width="8" fill="none" stroke-linecap="round"/></svg>',
    });
  }
}

// ============================================
// 12. 模态框
// ============================================
function openTaskModal(task = null) {
  const modal = document.getElementById('task-modal');
  const form = document.getElementById('task-form');
  const title = document.getElementById('modal-title');

  if (task) {
    title.textContent = '✏️ 编辑任务';
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-title-input').value = task.title;
    document.getElementById('task-desc-input').value = task.description || '';
    document.getElementById('task-priority-input').value = task.priority;
    document.getElementById('task-status-input').value = task.status;
    document.getElementById('task-category-input').value = task.category || '';
    document.getElementById('task-due-input').value = task.dueDate ? task.dueDate.slice(0, 10) : '';
    document.getElementById('task-tags-input').value = (task.tags || []).join(', ');
  } else {
    title.textContent = '➕ 新建任务';
    form.reset();
    document.getElementById('task-id').value = '';
    document.getElementById('task-priority-input').value = 'medium';
    document.getElementById('task-status-input').value = 'todo';
  }

  modal.style.display = 'flex';
}

function closeTaskModal() {
  document.getElementById('task-modal').style.display = 'none';
  state.editingTask = null;
}

async function saveTask(e) {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const taskData = {
    title: document.getElementById('task-title-input').value.trim(),
    description: document.getElementById('task-desc-input').value.trim(),
    priority: document.getElementById('task-priority-input').value,
    status: document.getElementById('task-status-input').value,
    category: document.getElementById('task-category-input').value,
    dueDate: document.getElementById('task-due-input').value || null,
    tags: document.getElementById('task-tags-input').value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  };

  if (!taskData.title) {
    showNotification('⚠️ 任务标题不能为空', 'warning');
    return;
  }

  if (id) {
    await updateTaskData(id, taskData);
  } else {
    await addTask(taskData);
  }

  closeTaskModal();
}

// ============================================
// 13. 分类管理
// ============================================
async function openCategoryModal() {
  const modal = document.getElementById('category-modal');
  const list = document.getElementById('category-list');

  const categories = await db.getAllCategories();
  list.innerHTML = categories
    .map(
      (c) => `
    <div class="category-item" style="--cat-color: ${c.color}">
      <span class="cat-icon">${c.icon}</span>
      <span class="cat-name">${escapeHtml(c.name)}</span>
      <button class="btn-icon" onclick="deleteCategory('${c.id}')">🗑️</button>
    </div>
  `
    )
    .join('');

  modal.style.display = 'flex';
}

function closeCategoryModal() {
  document.getElementById('category-modal').style.display = 'none';
}

async function addCategory(e) {
  e.preventDefault();
  const name = document.getElementById('cat-name-input').value.trim();
  if (!name) return;

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
  const icons = ['📁', '📂', '📋', '📌', '⭐', '🔥', '💡', '🎯'];

  await db.createCategory({
    name,
    color: colors[Math.floor(Math.random() * colors.length)],
    icon: icons[Math.floor(Math.random() * icons.length)],
  });

  document.getElementById('cat-name-input').value = '';
  await loadCategories();
  openCategoryModal(); // 刷新列表
  showNotification('✅ 分类已添加', 'success');
}

async function deleteCategory(id) {
  if (!confirm('确定删除此分类？该分类下的任务将变为无分类。')) return;
  await db.deleteCategory(id);
  await loadCategories();
  openCategoryModal();
  showNotification('🗑️ 分类已删除', 'info');
}

// ============================================
// 14. 工具函数
// ============================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getPriorityLabel(priority) {
  const labels = { urgent: '🔴 紧急', high: '🟠 高', medium: '🟡 中', low: '🟢 低' };
  return labels[priority] || priority;
}

function getStatusLabel(status) {
  const labels = { todo: '待办', 'in-progress': '进行中', done: '✅ 完成', archived: '📦 归档' };
  return labels[status] || status;
}

function getCategoryLabel(categoryId) {
  const cat = state.categories.find((c) => c.id === categoryId);
  return cat ? `${cat.icon} ${cat.name}` : '';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}天前`;
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function isOverdue(task) {
  return task.status !== 'done' && task.dueDate && new Date(task.dueDate) < new Date();
}

function showNotification(message, type = 'info') {
  const container = document.getElementById('notification-container');
  if (!container) return;

  const notif = document.createElement('div');
  notif.className = `notification notification-${type}`;
  notif.textContent = message;
  container.appendChild(notif);

  setTimeout(() => {
    notif.classList.add('fade-out');
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

// ============================================
// 15. 初始化
// ============================================
async function init() {
  console.log('[APP] 初始化 OfflineTasks...');

  // 注册 Service Worker
  await registerSW();

  // 初始化数据库
  await db.init();
  await db.initDefaultCategories();

  // 加载数据
  await Promise.all([loadTasks(), loadCategories()]);

  // 设置初始连接状态
  updateConnectionStatus(navigator.onLine);

  // 绑定事件
  document.getElementById('add-task-btn').addEventListener('click', () => openTaskModal());
  document.getElementById('task-form').addEventListener('submit', saveTask);
  document.getElementById('search-input').addEventListener('input', applyFilters);
  document.getElementById('status-filter').addEventListener('change', applyFilters);
  document.getElementById('priority-filter').addEventListener('change', applyFilters);
  document.getElementById('category-filter').addEventListener('change', applyFilters);
  document.getElementById('sync-btn').addEventListener('click', performSync);
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => importData(e.target.files[0]);
    input.click();
  });
  document.getElementById('install-btn').addEventListener('click', installPWA);
  document.getElementById('notify-btn').addEventListener('click', requestNotificationPermission);
  document.getElementById('category-btn').addEventListener('click', openCategoryModal);

  // 模态框关闭
  document.getElementById('task-modal').addEventListener('click', (e) => {
    if (e.target.id === 'task-modal') closeTaskModal();
  });
  document.getElementById('category-modal').addEventListener('click', (e) => {
    if (e.target.id === 'category-modal') closeCategoryModal();
  });

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTaskModal();
      closeCategoryModal();
    }
    if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      openTaskModal();
    }
  });

  console.log('[APP] OfflineTasks 初始化完成');
}

// 启动
document.addEventListener('DOMContentLoaded', init);
