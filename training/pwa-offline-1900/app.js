/**
 * OfflineNotes 应用主逻辑
 *
 * 功能：
 * 1. Service Worker 注册与生命周期管理
 * 2. IndexedDB 数据绑定
 * 3. UI 渲染与交互
 * 4. 在线/离线状态检测
 * 5. PWA 安装提示
 * 6. 手动同步
 */

// ============================================
// 1. Service Worker 注册
// ============================================
async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[APP] 浏览器不支持 Service Worker');
    document.getElementById('sw-status').textContent = 'Service Worker: 不支持';
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('./sw.js', {
      scope: './',
    });

    console.log('[APP] Service Worker 注册成功:', registration.scope);
    document.getElementById('sw-status').textContent = 'Service Worker: 已激活 ✅';

    // 监听更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        console.log('[APP] SW 状态变化:', newWorker.state);
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // 有新版本可用，提示用户
          showNotification('📝 新版本可用！刷新以更新。', 'info');
        }
      });
    });

    // 监听来自 SW 的消息
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type } = event.data;
      if (type === 'SYNC_REQUEST') {
        console.log('[APP] 收到 SW 同步请求');
        handleSync();
      }
    });

    // 检查更新
    setInterval(() => registration.update(), 60 * 60 * 1000); // 每小时检查
  } catch (err) {
    console.error('[APP] Service Worker 注册失败:', err);
    document.getElementById('sw-status').textContent = 'Service Worker: 注册失败 ❌';
  }
}

// ============================================
// 2. 在线/离线状态检测
// ============================================
function initOnlineStatus() {
  const statusEl = document.getElementById('online-status');
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');

  function updateStatus(online) {
    if (online) {
      statusEl.className = 'status-bar online';
      statusIcon.textContent = '✅';
      statusText.textContent = '在线';
      // 恢复在线时自动同步
      handleSync();
    } else {
      statusEl.className = 'status-bar offline';
      statusIcon.textContent = '⚠️';
      statusText.textContent = '当前离线，数据将在恢复后同步';
    }
  }

  window.addEventListener('online', () => {
    console.log('[APP] 网络已恢复');
    updateStatus(true);
  });

  window.addEventListener('offline', () => {
    console.log('[APP] 网络已断开');
    updateStatus(false);
  });

  // 初始化状态
  updateStatus(navigator.onLine);
}

// ============================================
// 3. PWA 安装
// ============================================
let deferredPrompt = null;

function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('btn-install').style.display = 'inline-block';
    console.log('[APP] 安装提示已就绪');
  });

  document.getElementById('btn-install').addEventListener('click', async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[APP] 用户安装选择:', outcome);
    deferredPrompt = null;
    document.getElementById('btn-install').style.display = 'none';
  });

  window.addEventListener('appinstalled', () => {
    console.log('[APP] PWA 已安装');
    deferredPrompt = null;
  });
}

// ============================================
// 4. 笔记 CRUD 操作
// ============================================
let currentNoteId = null;

async function renderNotes(notes = null) {
  const listEl = document.getElementById('notes-list');

  if (!notes) {
    notes = await db.getAllNotes();
  }

  if (notes.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <h3>还没有笔记</h3>
        <p>点击「新建笔记」开始书写</p>
        <p class="hint">所有数据保存在本地，完全离线可用</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = notes
    .map((note) => {
      const date = new Date(note.updatedAt).toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const preview = note.content.slice(0, 100).replace(/\n/g, ' ');
      const syncIcon = note.syncStatus === 'synced' ? '✅' : '📤';

      return `
        <div class="note-card" data-id="${note.id}">
          <div class="note-card-header">
            <h3 class="note-title">${escapeHtml(note.title)}</h3>
            <span class="sync-status" title="同步状态">${syncIcon}</span>
          </div>
          <p class="note-preview">${escapeHtml(preview) || '空笔记'}</p>
          <div class="note-card-footer">
            <span class="note-date">${date}</span>
            <span class="note-category">${escapeHtml(note.category)}</span>
          </div>
        </div>
      `;
    })
    .join('');

  // 绑定点击事件
  listEl.querySelectorAll('.note-card').forEach((card) => {
    card.addEventListener('click', () => openEditor(card.dataset.id));
  });
}

async function openEditor(noteId = null) {
  const modal = document.getElementById('editor-modal');
  const titleInput = document.getElementById('note-title-input');
  const contentInput = document.getElementById('note-content-input');
  const titleEl = document.getElementById('editor-title');
  const deleteBtn = document.getElementById('btn-delete-note');
  const metaEl = document.getElementById('note-meta');

  modal.style.display = 'flex';

  if (noteId) {
    // 编辑模式
    const note = await db.getNote(noteId);
    if (!note) return;

    currentNoteId = note.id;
    titleInput.value = note.title;
    contentInput.value = note.content;
    titleEl.textContent = '编辑笔记';
    deleteBtn.style.display = 'inline-block';

    const date = new Date(note.updatedAt).toLocaleString('zh-CN');
    metaEl.textContent = `创建于 ${new Date(note.createdAt).toLocaleString('zh-CN')} · 更新于 ${date}`;
  } else {
    // 新建模式
    currentNoteId = null;
    titleInput.value = '';
    contentInput.value = '';
    titleEl.textContent = '新建笔记';
    deleteBtn.style.display = 'none';
    metaEl.textContent = '';
  }

  contentInput.focus();
}

function closeEditor() {
  document.getElementById('editor-modal').style.display = 'none';
  currentNoteId = null;
}

async function saveNote() {
  const title = document.getElementById('note-title-input').value.trim();
  const content = document.getElementById('note-content-input').value.trim();

  if (!title && !content) {
    showNotification('⚠️ 请输入标题或内容', 'warning');
    return;
  }

  try {
    if (currentNoteId) {
      await db.updateNote(currentNoteId, { title, content });
      showNotification('✅ 笔记已更新', 'success');
    } else {
      await db.addNote({ title: title || '无标题', content });
      showNotification('✅ 笔记已保存', 'success');
    }

    closeEditor();
    await renderNotes();
    updateSyncBadge();
  } catch (err) {
    console.error('[APP] 保存失败:', err);
    showNotification('❌ 保存失败: ' + err.message, 'error');
  }
}

async function deleteCurrentNote() {
  if (!currentNoteId) return;

  if (!confirm('确定删除这条笔记？')) return;

  try {
    await db.deleteNote(currentNoteId);
    showNotification('🗑️ 笔记已删除', 'success');
    closeEditor();
    await renderNotes();
    updateSyncBadge();
  } catch (err) {
    console.error('[APP] 删除失败:', err);
    showNotification('❌ 删除失败: ' + err.message, 'error');
  }
}

// ============================================
// 5. 搜索功能
// ============================================
function initSearch() {
  const input = document.getElementById('search-input');
  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const query = input.value.trim();
      if (query) {
        const results = await db.searchNotes(query);
        await renderNotes(results);
      } else {
        await renderNotes();
      }
    }, 300);
  });
}

// ============================================
// 6. 同步功能
// ============================================
async function handleSync() {
  if (!navigator.onLine) {
    showNotification('⚠️ 当前离线，无法同步', 'warning');
    return;
  }

  const pending = await db.getPendingSyncs();
  if (pending.length === 0) {
    showNotification('✅ 已是最新状态', 'info');
    return;
  }

  console.log('[APP] 同步', pending.length, '条待同步操作');

  // 模拟同步（实际项目中这里会发送 API 请求）
  for (const item of pending) {
    // 模拟网络请求延迟
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 标记为已同步
    await db.markSynced(item.id);

    // 更新笔记同步状态
    if (item.noteId) {
      const note = await db.getNote(item.noteId);
      if (note) {
        await db.updateNote(item.noteId, { syncStatus: 'synced' });
      }
    }
  }

  console.log('[APP] 同步完成');
  showNotification(`✅ 已同步 ${pending.length} 条操作`, 'success');
  await renderNotes();
  updateSyncBadge();
}

async function updateSyncBadge() {
  const count = await db.getPendingCount();
  const queueEl = document.getElementById('sync-queue');
  const countEl = document.getElementById('sync-count');

  if (count > 0) {
    queueEl.style.display = 'flex';
    countEl.textContent = count;
  } else {
    queueEl.style.display = 'none';
  }
}

// ============================================
// 7. 通知系统
// ============================================
function showNotification(message, type = 'info') {
  // 创建通知元素
  const el = document.createElement('div');
  el.className = `notification notification-${type}`;
  el.textContent = message;

  document.body.appendChild(el);

  // 动画进入
  requestAnimationFrame(() => {
    el.classList.add('show');
  });

  // 自动消失
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ============================================
// 8. 工具函数
// ============================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// 9. 初始化
// ============================================
async function init() {
  console.log('[APP] 初始化 OfflineNotes...');

  // 初始化数据库
  await db.init();
  console.log('[APP] 数据库初始化完成');

  // 注册 Service Worker
  await registerSW();

  // 初始化在线状态检测
  initOnlineStatus();

  // 初始化 PWA 安装
  initInstallPrompt();

  // 初始化搜索
  initSearch();

  // 渲染笔记列表
  await renderNotes();

  // 更新同步徽章
  await updateSyncBadge();

  // 绑定事件
  document.getElementById('btn-new-note').addEventListener('click', () => openEditor());
  document.getElementById('btn-close-editor').addEventListener('click', closeEditor);
  document.getElementById('btn-save-note').addEventListener('click', saveNote);
  document.getElementById('btn-delete-note').addEventListener('click', deleteCurrentNote);
  document.getElementById('btn-sync').addEventListener('click', handleSync);

  // 点击模态框外部关闭
  document.getElementById('editor-modal').addEventListener('click', (e) => {
    if (e.target.id === 'editor-modal') closeEditor();
  });

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeEditor();
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      openEditor();
    }
  });

  // 定期更新同步徽章
  setInterval(updateSyncBadge, 10000);

  console.log('[APP] OfflineNotes 初始化完成 🎉');
}

// 启动
init();
