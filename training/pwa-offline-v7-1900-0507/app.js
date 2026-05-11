/**
 * MarkFlow — 主应用 v7
 *
 * 第七轮迭代核心功能（对比 v6 WikiBase）：
 * 1. Web Worker Markdown 渲染 — 不阻塞主线程
 * 2. 语音笔记 — MediaRecorder 录制 + IndexedDB 存储
 * 3. PWA 诊断面板 — SW/Cache/IDB/Worker/Install/Storage/Network 全维度诊断
 * 4. Badging API — 未同步笔记数量标记
 * 5. Navigation Preload — 加速首次加载
 * 6. Periodic Background Sync — 后台自动同步
 * 7. 游标分页 — 笔记列表无限滚动
 * 8. 复合索引查询 — pinned/starred/recent 多维度过滤
 * 9. 事务隔离 — durability: 'strict' 保证数据持久化
 * 10. 文件处理 — File Handling API 打开本地 .md 文件
 */

// ============================================================
// 全局状态
// ============================================================

const AppState = {
  currentNote: null,
  currentFilter: 'all',
  searchQuery: '',
  autoSaveTimer: null,
  deferredPrompt: null,
  isOnline: navigator.onLine,
  isInstalled: false,
  settings: {
    fontSize: 16,
    theme: 'dark',
    autoSave: true,
    saveInterval: 3000,
  },
  worker: null,
  mediaRecorder: null,
  isRecording: false,
  audioChunks: [],
  noteListCursor: null,
  noteListLoading: false,
};

// ============================================================
// DOM 引用
// ============================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================================
// 初始化
// ============================================================

async function init() {
  console.log('[MarkFlow] Initializing v7...');

  // 加载设置
  await loadSettings();

  // 初始化 Web Worker
  initWorker();

  // 注册 Service Worker
  await registerSW();

  // 绑定事件
  bindEvents();

  // 渲染笔记列表
  await renderNoteList();

  // 更新连接状态
  updateConnectionStatus();

  // 检查安装状态
  checkInstallStatus();

  // 设置 Badging
  updateBadge();

  console.log('[MarkFlow] Initialized ✓');
}

// ============================================================
// Web Worker 管理
// ============================================================

function initWorker() {
  if (window.Worker) {
    AppState.worker = new Worker('render-worker.js');
    AppState.worker.onmessage = handleWorkerMessage;
    AppState.worker.onerror = (e) => console.error('[Worker] Error:', e);
    console.log('[Worker] Markdown renderer initialized');
  } else {
    console.warn('[Worker] Web Worker not supported, falling back to main thread');
  }
}

function handleWorkerMessage(e) {
  const { type, id, html, renderTime, avgRenderTime } = e.data;

  if (type === 'rendered') {
    const preview = $('#previewContent');
    if (preview) {
      preview.innerHTML = html;
      // 代码块样式
      preview.querySelectorAll('pre code').forEach(block => {
        block.classList.add('code-block');
      });
    }
    const renderTimeEl = $('#renderTime');
    if (renderTimeEl) {
      renderTimeEl.textContent = `渲染: ${renderTime.toFixed(1)}ms (平均 ${avgRenderTime.toFixed(1)}ms)`;
    }
  }
}

function renderMarkdown(markdown) {
  if (AppState.worker) {
    AppState.worker.postMessage({ type: 'render', markdown, id: Date.now() });
  } else {
    // Fallback: 主线程渲染
    const parser = new MarkdownParser();
    const html = parser.parse(markdown);
    $('#previewContent').innerHTML = html;
  }
}

// ============================================================
// Service Worker 注册
// ============================================================

async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Worker not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[SW] Registered:', registration.scope);

    // Navigation Preload
    if (registration.navigationPreload) {
      await registration.navigationPreload.enable();
      console.log('[SW] Navigation Preload enabled');
    }

    // Periodic Background Sync
    if ('periodicSync' in registration) {
      console.log('[SW] Periodic Sync available');
    }

    // 监听 SW 更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showToast('🔄 新版本可用，刷新以更新', 'info');
        }
      });
    });

    // 监听 SW 消息
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data.type === 'sync-complete') {
        updateSyncStatus('synced');
        showToast('✓ 同步完成', 'success');
        renderNoteList();
      }
      if (e.data.type === 'share-received') {
        handleSharedContent(e.data);
      }
    });

    AppState.swRegistration = registration;
  } catch (err) {
    console.error('[SW] Registration failed:', err);
  }
}

// ============================================================
// 事件绑定
// ============================================================

function bindEvents() {
  // 新建笔记
  $('#newNoteBtn').addEventListener('click', createNewNote);
  $('#welcomeNewBtn').addEventListener('click', createNewNote);

  // 搜索
  $('#searchBtn').addEventListener('click', toggleSearch);
  $('#searchClose').addEventListener('click', toggleSearch);
  $('#searchInput').addEventListener('input', debounce(handleSearch, 300));

  // 编辑器
  $('#noteTitle').addEventListener('input', debounce(onNoteChange, AppState.settings.saveInterval));
  $('#noteContent').addEventListener('input', debounce(onNoteChange, AppState.settings.saveInterval));

  // 工具栏
  $('#pinBtn').addEventListener('click', togglePin);
  $('#starBtn').addEventListener('click', toggleStar);
  $('#recordBtn').addEventListener('click', toggleRecording);
  $('#exportBtn').addEventListener('click', exportCurrentNote);
  $('#deleteBtn').addEventListener('click', deleteCurrentNote);

  // 侧边栏过滤
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.currentFilter = btn.dataset.filter;
      AppState.noteListCursor = null;
      renderNoteList();
    });
  });

  // 设置
  $('#settingsBtn').addEventListener('click', () => $('#settingsPanel').classList.toggle('hidden'));
  $('#settingsClose').addEventListener('click', () => $('#settingsPanel').classList.add('hidden'));
  $('#fontSizeSlider').addEventListener('input', (e) => {
    const size = e.target.value;
    $('#fontSizeValue').textContent = size + 'px';
    AppState.settings.fontSize = parseInt(size);
    $('#noteContent').style.fontSize = size + 'px';
    $('#previewContent').style.fontSize = size + 'px';
    db.setSetting('fontSize', AppState.settings.fontSize);
  });
  $('#themeSelect').addEventListener('change', (e) => {
    AppState.settings.theme = e.target.value;
    applyTheme(e.target.value);
    db.setSetting('theme', AppState.settings.theme);
  });
  $('#autoSaveToggle').addEventListener('change', (e) => {
    AppState.settings.autoSave = e.target.checked;
    db.setSetting('autoSave', AppState.settings.autoSave);
  });
  $('#saveInterval').addEventListener('change', (e) => {
    AppState.settings.saveInterval = parseInt(e.target.value);
    db.setSetting('saveInterval', AppState.settings.saveInterval);
  });
  $('#enablePeriodicSync').addEventListener('click', enablePeriodicSync);
  $('#exportAllBtn').addEventListener('click', exportAllNotes);
  $('#importBtn').addEventListener('click', importNotes);
  $('#clearCacheBtn').addEventListener('click', clearAllCaches);

  // 诊断面板
  $('#diagBtn').addEventListener('click', () => {
    $('#diagPanel').classList.toggle('hidden');
    if (!$('#diagPanel').classList.contains('hidden')) {
      runDiagnostics();
    }
  });
  $('#diagClose').addEventListener('click', () => $('#diagPanel').classList.add('hidden'));

  // 安装
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    AppState.deferredPrompt = e;
    $('#installBanner').classList.remove('hidden');
  });
  $('#installBtn').addEventListener('click', async () => {
    if (AppState.deferredPrompt) {
      AppState.deferredPrompt.prompt();
      const result = await AppState.deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        AppState.isInstalled = true;
        showToast('📲 安装成功！', 'success');
      }
      AppState.deferredPrompt = null;
      $('#installBanner').classList.add('hidden');
    }
  });
  $('#installDismiss').addEventListener('click', () => {
    $('#installBanner').classList.add('hidden');
  });

  // 连接状态
  window.addEventListener('online', () => {
    AppState.isOnline = true;
    updateConnectionStatus();
    showToast('🌐 已恢复联网', 'success');
  });
  window.addEventListener('offline', () => {
    AppState.isOnline = false;
    updateConnectionStatus();
    showToast('📡 已断开网络，离线模式', 'warning');
  });

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      createNewNote();
    }
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      toggleSearch();
    }
    if (e.key === 'Escape') {
      $('#searchBar').classList.add('hidden');
      $('#settingsPanel').classList.add('hidden');
      $('#diagPanel').classList.add('hidden');
    }
  });

  // 无限滚动
  $('#noteList').addEventListener('scroll', () => {
    const el = $('#noteList');
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50 && !AppState.noteListLoading) {
      loadMoreNotes();
    }
  });
}

// ============================================================
// 笔记操作
// ============================================================

async function createNewNote() {
  try {
    const note = await db.createNote({
      title: '',
      content: '',
      tags: [],
    });
    AppState.currentNote = note;
    showEditor(note);
    showToast('📝 新笔记已创建', 'success');
    await renderNoteList();
  } catch (err) {
    console.error('[App] Create note error:', err);
    showToast('❌ 创建失败', 'error');
  }
}

async function openNote(id) {
  try {
    const note = await db.getNote(id);
    if (note) {
      AppState.currentNote = note;
      showEditor(note);
      // 渲染 Markdown 预览
      renderMarkdown(note.content);
      // 加载语音附件
      await loadNoteAudios(note.id);
    }
  } catch (err) {
    console.error('[App] Open note error:', err);
  }
}

async function onNoteChange() {
  if (!AppState.currentNote || !AppState.settings.autoSave) return;

  const title = $('#noteTitle').value;
  const content = $('#noteContent').value;

  // 更新字数统计
  const words = content.split(/\s+/).filter(Boolean).length;
  $('#wordCount').textContent = `${words} 词`;

  // 渲染预览
  renderMarkdown(content);

  // 更新状态
  AppState.currentNote.title = title || '未命名笔记';
  AppState.currentNote.content = content;

  // 保存到 IndexedDB
  try {
    const updated = await db.updateNote(AppState.currentNote.id, {
      title: AppState.currentNote.title,
      content,
      expectedVersion: AppState.currentNote.version,
    });
    AppState.currentNote = updated;
    updateSyncStatus('dirty');
    // 刷新列表中的对应项
    refreshNoteInList(updated);
  } catch (err) {
    console.error('[App] Save error:', err);
    if (err.message.includes('Version conflict')) {
      showToast('⚠️ 版本冲突，请刷新', 'warning');
    }
  }
}

async function deleteCurrentNote() {
  if (!AppState.currentNote) return;
  if (!confirm(`确定删除「${AppState.currentNote.title}」？`)) return;

  try {
    await db.deleteNote(AppState.currentNote.id);
    AppState.currentNote = null;
    showWelcome();
    await renderNoteList();
    showToast('🗑️ 笔记已删除', 'info');
  } catch (err) {
    console.error('[App] Delete error:', err);
  }
}

async function togglePin() {
  if (!AppState.currentNote) return;
  const updated = await db.updateNote(AppState.currentNote.id, {
    pinned: !AppState.currentNote.pinned,
  });
  AppState.currentNote = updated;
  $('#pinBtn').classList.toggle('active', updated.pinned);
  await renderNoteList();
}

async function toggleStar() {
  if (!AppState.currentNote) return;
  const updated = await db.updateNote(AppState.currentNote.id, {
    starred: !AppState.currentNote.starred,
  });
  AppState.currentNote = updated;
  $('#starBtn').classList.toggle('active', updated.starred);
  await renderNoteList();
}

// ============================================================
// 语音录制
// ============================================================

async function toggleRecording() {
  if (!AppState.currentNote) return;

  if (AppState.isRecording) {
    // 停止录制
    AppState.mediaRecorder.stop();
    AppState.isRecording = false;
    $('#recordBtn').textContent = '🎙️';
    $('#recordBtn').classList.remove('recording');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    AppState.mediaRecorder = new MediaRecorder(stream);
    AppState.audioChunks = [];

    AppState.mediaRecorder.ondataavailable = (e) => {
      AppState.audioChunks.push(e.data);
    };

    AppState.mediaRecorder.onstop = async () => {
      const blob = new Blob(AppState.audioChunks, { type: 'audio/webm' });
      stream.getTracks().forEach(t => t.stop());

      try {
        await db.saveAudio({
          noteId: AppState.currentNote.id,
          blob,
          name: `recording-${new Date().toLocaleTimeString()}.webm`,
          duration: 0,
        });
        showToast('🎙️ 语音已保存', 'success');
        await loadNoteAudios(AppState.currentNote.id);
      } catch (err) {
        console.error('[App] Save audio error:', err);
        showToast('❌ 保存语音失败', 'error');
      }
    };

    AppState.mediaRecorder.start();
    AppState.isRecording = true;
    $('#recordBtn').textContent = '⏹️';
    $('#recordBtn').classList.add('recording');
    showToast('🎙️ 开始录制...', 'info');
  } catch (err) {
    console.error('[App] MediaRecorder error:', err);
    showToast('❌ 无法访问麦克风', 'error');
  }
}

async function loadNoteAudios(noteId) {
  const audios = await db.getNoteAudios(noteId);
  const section = $('#audioSection');
  const list = $('#audioList');

  if (audios.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  list.innerHTML = audios.map(a => `
    <div class="audio-item">
      <span class="audio-name">🎙️ ${a.name}</span>
      <audio controls src="${URL.createObjectURL(a.blob)}"></audio>
      <button class="tool-btn" onclick="deleteAudio('${a.id}')" title="删除">🗑️</button>
    </div>
  `).join('');
}

// ============================================================
// UI 渲染
// ============================================================

function showWelcome() {
  $('#welcomeView').classList.remove('hidden');
  $('#editView').classList.add('hidden');
}

function showEditor(note) {
  $('#welcomeView').classList.add('hidden');
  $('#editView').classList.remove('hidden');
  $('#noteTitle').value = note.title;
  $('#noteContent').value = note.content;
  $('#pinBtn').classList.toggle('active', note.pinned);
  $('#starBtn').classList.toggle('active', note.starred);
  const words = note.content.split(/\s+/).filter(Boolean).length;
  $('#wordCount').textContent = `${words} 词`;
  renderMarkdown(note.content);
}

async function renderNoteList() {
  if (AppState.noteListLoading) return;
  AppState.noteListLoading = true;

  try {
    const result = await db.listNotes({
      filter: AppState.currentFilter,
      limit: 20,
      cursor: AppState.noteListCursor,
    });

    const list = $('#noteList');
    const existingItems = list.querySelectorAll('.note-item');

    if (!AppState.noteListCursor) {
      // 首次加载
      list.innerHTML = '';
    }

    result.notes.forEach(note => {
      // 避免重复
      if (existingItems.length > 0 && [...existingItems].some(el => el.dataset.id === note.id)) return;

      const el = createNoteItem(note);
      list.appendChild(el);
    });

    $('#noteCount').textContent = `${result.notes.length} 篇`;
    AppState.noteListCursor = result.nextCursor;
  } catch (err) {
    console.error('[App] Render note list error:', err);
  } finally {
    AppState.noteListLoading = false;
  }
}

function createNoteItem(note) {
  const div = document.createElement('div');
  div.className = 'note-item';
  div.dataset.id = note.id;
  if (AppState.currentNote?.id === note.id) div.classList.add('active');

  const preview = note.content?.slice(0, 80).replace(/[#*`_~]/g, '') || '空笔记';
  const date = new Date(note.updatedAt).toLocaleDateString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  div.innerHTML = `
    <div class="note-item-header">
      <span class="note-item-title">${note.title || '未命名'}</span>
      <span class="note-item-meta">${note.pinned ? '📌' : ''}${note.starred ? '⭐' : ''}</span>
    </div>
    <div class="note-item-preview">${preview}${note.content?.length > 80 ? '...' : ''}</div>
    <div class="note-item-footer">
      <span class="note-item-date">${date}</span>
      <span class="note-item-status ${note.syncStatus}">${note.syncStatus === 'synced' ? '✓' : '●'}</span>
    </div>
  `;

  div.addEventListener('click', () => openNote(note.id));
  return div;
}

function refreshNoteInList(updatedNote) {
  const item = $(`.note-item[data-id="${updatedNote.id}"]`);
  if (item) {
    const newItem = createNoteItem(updatedNote);
    item.replaceWith(newItem);
  }
}

async function loadMoreNotes() {
  if (!AppState.noteListCursor) return;
  await renderNoteList();
}

// ============================================================
// 搜索
// ============================================================

function toggleSearch() {
  $('#searchBar').classList.toggle('hidden');
  if (!$('#searchBar').classList.contains('hidden')) {
    $('#searchInput').focus();
  }
}

async function handleSearch(e) {
  const query = e.target.value.trim();
  if (!query) {
    await renderNoteList();
    return;
  }

  try {
    const result = await db.search(query);
    const list = $('#noteList');
    list.innerHTML = '';
    result.notes.forEach(note => {
      list.appendChild(createNoteItem(note));
    });
    $('#noteCount').textContent = `搜索: ${result.notes.length} 篇`;
  } catch (err) {
    console.error('[App] Search error:', err);
  }
}

// ============================================================
// 导出/导入
// ============================================================

async function exportCurrentNote() {
  if (!AppState.currentNote) return;
  const note = AppState.currentNote;
  const blob = new Blob([`# ${note.title}\n\n${note.content}`], { type: 'text/markdown' });
  downloadBlob(blob, `${note.title || 'note'}.md`);
  showToast('📤 笔记已导出', 'success');
}

async function exportAllNotes() {
  try {
    const data = await db.exportAllNotes();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `markflow-export-${Date.now()}.json`);
    showToast(`📦 已导出 ${data.noteCount} 篇笔记`, 'success');
  } catch (err) {
    console.error('[App] Export error:', err);
    showToast('❌ 导出失败', 'error');
  }
}

async function importNotes() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await db.importNotes(data);
      showToast(`📥 已导入 ${result.imported} 篇笔记`, 'success');
      await renderNoteList();
    } catch (err) {
      console.error('[App] Import error:', err);
      showToast('❌ 导入失败', 'error');
    }
  };
  input.click();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// Badging API
// ============================================================

async function updateBadge() {
  if (!('setAppBadge' in navigator)) return;

  try {
    const queue = await db.getSyncQueue();
    const dirtyCount = queue.length;
    if (dirtyCount > 0) {
      navigator.setAppBadge(dirtyCount);
    } else {
      navigator.clearAppBadge();
    }
  } catch (err) {
    console.warn('[App] Badge error:', err);
  }
}

// ============================================================
// Periodic Background Sync
// ============================================================

async function enablePeriodicSync() {
  if (!AppState.swRegistration) {
    showToast('❌ Service Worker 未注册', 'error');
    return;
  }

  if (!('periodicSync' in AppState.swRegistration)) {
    showToast('❌ 浏览器不支持 Periodic Sync', 'error');
    return;
  }

  try {
    await AppState.swRegistration.periodicSync.register('sync-notes', {
      minInterval: 24 * 60 * 60 * 1000, // 每天一次
    });
    showToast('✓ Periodic Sync 已启用', 'success');
  } catch (err) {
    console.error('[App] Periodic Sync error:', err);
    showToast('❌ 启用失败（可能需要用户手势）', 'error');
  }
}

// ============================================================
// 连接/同步状态
// ============================================================

function updateConnectionStatus() {
  const badge = $('#connectionBadge');
  if (AppState.isOnline) {
    badge.className = 'badge badge-online';
    badge.textContent = '🟢 在线';
  } else {
    badge.className = 'badge badge-offline';
    badge.textContent = '🔴 离线';
  }
}

function updateSyncStatus(status) {
  const badge = $('#syncBadge');
  switch (status) {
    case 'synced':
      badge.className = 'badge badge-synced';
      badge.textContent = '✓ 已同步';
      break;
    case 'dirty':
      badge.className = 'badge badge-dirty';
      badge.textContent = '● 未同步';
      break;
    case 'syncing':
      badge.className = 'badge badge-syncing';
      badge.textContent = '⟳ 同步中';
      break;
  }
}

// ============================================================
// PWA 诊断面板
// ============================================================

async function runDiagnostics() {
  // SW 状态
  const swStatus = $('#swStatus');
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    swStatus.innerHTML = `
      <div class="diag-row"><span>注册状态</span><span class="diag-ok">${reg ? '✓ 已注册' : '✗ 未注册'}</span></div>
      <div class="diag-row"><span>激活状态</span><span class="diag-ok">${reg?.active ? '✓ 已激活' : '✗ 未激活'}</span></div>
      <div class="diag-row"><span>作用域</span><span>${reg?.scope || 'N/A'}</span></div>
      <div class="diag-row"><span>Navigation Preload</span><span class="diag-ok">${reg?.navigationPreload?.state === 'enabled' ? '✓ 已启用' : '✗ 未启用'}</span></div>
    `;
  } else {
    swStatus.innerHTML = '<div class="diag-row"><span>Service Worker</span><span class="diag-error">不支持</span></div>';
  }

  // 缓存状态
  const cacheStatus = $('#cacheStatus');
  if ('caches' in window) {
    const names = await caches.keys();
    let html = `<div class="diag-row"><span>缓存数量</span><span>${names.length}</span></div>`;
    for (const name of names) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      html += `<div class="diag-row"><span>${name}</span><span>${keys.length} 项</span></div>`;
    }
    cacheStatus.innerHTML = html;
  }

  // IndexedDB 状态
  const idbStatus = $('#idbStatus');
  try {
    const stats = await db.getStorageStats();
    idbStatus.innerHTML = `
      <div class="diag-row"><span>笔记数</span><span>${stats.notes}</span></div>
      <div class="diag-row"><span>语音附件</span><span>${stats.audios} (${stats.audioSizeFormatted})</span></div>
      <div class="diag-row"><span>同步队列</span><span>${stats.syncQueue}</span></div>
      <div class="diag-row"><span>审计日志</span><span>${stats.auditLog}</span></div>
    `;
  } catch (err) {
    idbStatus.innerHTML = '<div class="diag-row"><span>错误</span><span class="diag-error">无法读取</span></div>';
  }

  // Web Worker 状态
  const workerStatus = $('#workerStatus');
  workerStatus.innerHTML = `
    <div class="diag-row"><span>Web Worker</span><span class="diag-ok">${window.Worker ? '✓ 支持' : '✗ 不支持'}</span></div>
    <div class="diag-row"><span>渲染 Worker</span><span class="diag-ok">${AppState.worker ? '✓ 运行中' : '✗ 未初始化'}</span></div>
  `;

  // 安装状态
  const installStatus = $('#installStatus');
  installStatus.innerHTML = `
    <div class="diag-row"><span>已安装</span><span class="diag-ok">${AppState.isInstalled ? '✓ 是' : '✗ 否'}</span></div>
    <div class="diag-row"><span>display</span><span>${window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'}</span></div>
    <div class="diag-row"><span>manifest</span><span class="diag-ok">${document.querySelector('link[rel="manifest"]') ? '✓ 已链接' : '✗ 未链接'}</span></div>
  `;

  // 存储配额
  const storageStatus = $('#storageStatus');
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percent = quota > 0 ? ((used / quota) * 100).toFixed(1) : 0;
    storageStatus.innerHTML = `
      <div class="diag-row"><span>已用</span><span>${_formatBytes(used)}</span></div>
      <div class="diag-row"><span>配额</span><span>${_formatBytes(quota)}</span></div>
      <div class="diag-row"><span>使用率</span><span>${percent}%</span></div>
    `;
  }

  // Network Information
  const networkStatus = $('#networkStatus');
  if ('connection' in navigator) {
    const conn = navigator.connection;
    networkStatus.innerHTML = `
      <div class="diag-row"><span>类型</span><span>${conn.effectiveType || 'unknown'}</span></div>
      <div class="diag-row"><span>下行</span><span>${conn.downlink || '?'} Mbps</span></div>
      <div class="diag-row"><span>RTT</span><span>${conn.rtt || '?'} ms</span></div>
      <div class="diag-row"><span>省流量</span><span>${conn.saveData ? '是' : '否'}</span></div>
    `;
  } else {
    networkStatus.innerHTML = '<div class="diag-row"><span>Network Information API</span><span class="diag-error">不支持</span></div>';
  }
}

function _formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ============================================================
// 设置持久化
// ============================================================

async function loadSettings() {
  try {
    const fontSize = await db.getSetting('fontSize');
    if (fontSize) AppState.settings.fontSize = fontSize;
    const theme = await db.getSetting('theme');
    if (theme) AppState.settings.theme = theme;
    const autoSave = await db.getSetting('autoSave');
    if (autoSave !== undefined) AppState.settings.autoSave = autoSave;
    const saveInterval = await db.getSetting('saveInterval');
    if (saveInterval) AppState.settings.saveInterval = saveInterval;
  } catch (err) {
    console.warn('[App] Load settings error:', err);
  }

  // 应用设置
  $('#fontSizeSlider').value = AppState.settings.fontSize;
  $('#fontSizeValue').textContent = AppState.settings.fontSize + 'px';
  $('#themeSelect').value = AppState.settings.theme;
  $('#autoSaveToggle').checked = AppState.settings.autoSave;
  $('#saveInterval').value = AppState.settings.saveInterval;
  applyTheme(AppState.settings.theme);
}

function applyTheme(theme) {
  document.body.className = `theme-${theme}`;
}

// ============================================================
// 安装状态检查
// ============================================================

function checkInstallStatus() {
  AppState.isInstalled = window.matchMedia('(display-mode: standalone)').matches;
  // 或者通过 standalone 属性检查
  if ('standalone' in window.navigator && window.navigator.standalone) {
    AppState.isInstalled = true;
  }
}

// ============================================================
// 共享内容处理
// ============================================================

function handleSharedContent(data) {
  db.createNote({
    title: data.title || '来自分享',
    content: data.text || data.url || '',
    tags: ['shared'],
  }).then(note => {
    AppState.currentNote = note;
    showEditor(note);
    showToast('📥 已接收分享', 'success');
    renderNoteList();
  });
}

// ============================================================
// 缓存清除
// ============================================================

async function clearAllCaches() {
  if (!confirm('确定清除所有缓存？笔记数据不会丢失。')) return;
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name)));
    showToast('🗑️ 缓存已清除', 'info');
  }
}

// ============================================================
// Toast 通知
// ============================================================

function showToast(message, type = 'info') {
  const container = $('#toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================================
// 工具函数
// ============================================================

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ============================================================
// 启动
// ============================================================

init();
