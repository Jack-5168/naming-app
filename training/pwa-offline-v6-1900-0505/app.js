/**
 * WikiBase — 主应用 v6
 *
 * 第六轮迭代核心功能：
 * 1. App Shell 渲染 — 壳与内容分离
 * 2. 全文搜索 UI — 实时搜索 + 高亮
 * 3. 版本历史 UI — 时间线 + 差异对比
 * 4. 图片附件 UI — 拖拽上传 + 内联预览
 * 5. Share Target 处理 — 接收系统分享
 * 6. 安装横幅 — beforeinstallprompt 处理
 * 7. 存储监控 UI — 配额 + 各 store 用量
 * 8. 同步状态指示 — 在线/离线/同步中
 */

// ============================================================
// 全局状态
// ============================================================

const AppState = {
  currentDoc: null,
  currentView: 'welcome', // welcome | editor | reader
  searchQuery: '',
  filterTag: null,
  autoSaveTimer: null,
  deferredPrompt: null,
  isOnline: navigator.onLine,
  settings: {
    autoSave: true,
    fontSize: 16,
    theme: 'dark',
  },
};

// ============================================================
// DOM 引用
// ============================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  menuBtn: $('#menuBtn'),
  searchBtn: $('#searchBtn'),
  searchClose: $('#searchClose'),
  searchInput: $('#searchInput'),
  searchBar: $('#searchBar'),
  newDocBtn: $('#newDocBtn'),
  settingsBtn: $('#settingsBtn'),
  settingsPanel: $('#settingsPanel'),
  settingsClose: $('#settingsClose'),
  syncStatus: $('#syncStatus'),
  sidebar: $('#sidebar'),
  docList: $('#docList'),
  docCount: $('#docCount'),
  tagList: $('#tagList'),
  tagFilter: $('#tagFilter'),
  welcomePage: $('#welcomePage'),
  editorView: $('#editorView'),
  readerView: $('#readerView'),
  editor: $('#editor'),
  preview: $('#preview'),
  docTitle: $('#docTitle'),
  tagContainer: $('#tagContainer'),
  saveBtn: $('#saveBtn'),
  previewBtn: $('#previewBtn'),
  historyBtn: $('#historyBtn'),
  historyPanel: $('#historyPanel'),
  historyClose: $('#historyClose'),
  versionList: $('#versionList'),
  diffView: $('#diffView'),
  diffContent: $('#diffContent'),
  restoreBtn: $('#restoreBtn'),
  editBtn: $('#editBtn'),
  deleteBtn: $('#deleteBtn'),
  readerTitle: $('#readerTitle'),
  readerMeta: $('#readerMeta'),
  readerTags: $('#readerTags'),
  readerContent: $('#readerContent'),
  exportBtn: $('#exportBtn'),
  importBtn: $('#importBtn'),
  storageBtn: $('#storageBtn'),
  storagePanel: $('#storagePanel'),
  storageClose: $('#storageClose'),
  storageInfo: $('#storageInfo'),
  tagModal: $('#tagModal'),
  tagModalClose: $('#tagModalClose'),
  tagInput: $('#tagInput'),
  existingTags: $('#existingTags'),
  addTagBtn: $('#addTagBtn'),
  attachImgBtn: $('#attachImgBtn'),
  toast: $('#toast'),
  offlineBanner: $('#offlineBanner'),
  installBanner: $('#installBanner'),
  installBtn: $('#installBtn'),
  installDismiss: $('#installDismiss'),
  fileInput: $('#fileInput'),
  imageInput: $('#imageInput'),
  welcomeNewDoc: $('#welcomeNewDoc'),
  autoSave: $('#autoSave'),
  editorFontSize: $('#editorFontSize'),
  themeSelect: $('#themeSelect'),
  clearCacheBtn: $('#clearCacheBtn'),
  registerPushBtn: $('#registerPushBtn'),
};

// ============================================================
// 初始化
// ============================================================

async function init() {
  console.log('[WikiBase] 初始化...');

  // 加载设置
  loadSettings();

  // 初始化数据库
  try {
    await openDB();
    console.log('[WikiBase] 数据库就绪');
  } catch (err) {
    console.error('[WikiBase] 数据库初始化失败:', err);
    showToast('数据库初始化失败，请刷新页面', 'error');
    return;
  }

  // 注册 Service Worker
  await registerSW();

  // 绑定事件
  bindEvents();

  // 加载文档列表
  await refreshDocList();

  // 加载标签
  await refreshTags();

  // 监听网络状态
  setupNetworkListener();

  // 监听安装事件
  setupInstallPrompt();

  // 处理 Share Target
  handleShareTarget();

  // 自动保存
  setupAutoSave();

  // 注册 Background Sync
  registerBackgroundSync();

  console.log('[WikiBase] 初始化完成');
}

// ============================================================
// Service Worker 注册
// ============================================================

async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] 浏览器不支持 Service Worker');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('./sw.js', {
      scope: './',
    });

    console.log('[SW] 注册成功:', registration.scope);

    // 检查更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showToast('新版本可用，刷新以更新', 'info');
        }
      });
    });

    // 监听 SW 消息
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, payload } = event.data;
      if (type === 'SYNC_NOW') {
        handleSyncFromSW(payload);
      } else if (type === 'REFRESH_SEARCH_INDEX') {
        refreshDocList();
      }
    });
  } catch (err) {
    console.error('[SW] 注册失败:', err);
  }
}

// ============================================================
// Background Sync 注册
// ============================================================

async function registerBackgroundSync() {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    console.warn('[Sync] 浏览器不支持 Background Sync');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('sync-documents');
    console.log('[Sync] Background Sync 已注册');
  } catch (err) {
    console.warn('[Sync] 注册失败:', err);
  }
}

// ============================================================
// 事件绑定
// ============================================================

function bindEvents() {
  // 菜单
  DOM.menuBtn.addEventListener('click', () => {
    DOM.sidebar.classList.toggle('open');
  });

  // 搜索
  DOM.searchBtn.addEventListener('click', () => {
    DOM.searchBar.classList.toggle('hidden');
    if (!DOM.searchBar.classList.contains('hidden')) {
      DOM.searchInput.focus();
    }
  });
  DOM.searchClose.addEventListener('click', () => {
    DOM.searchBar.classList.add('hidden');
    DOM.searchInput.value = '';
    AppState.searchQuery = '';
    refreshDocList();
  });
  DOM.searchInput.addEventListener('input', debounce(async (e) => {
    AppState.searchQuery = e.target.value;
    await performSearch(e.target.value);
  }, 300));
  DOM.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      DOM.searchBar.classList.add('hidden');
      DOM.searchInput.value = '';
      AppState.searchQuery = '';
      refreshDocList();
    }
  });

  // 新建文档
  DOM.newDocBtn.addEventListener('click', createNewDoc);
  DOM.welcomeNewDoc.addEventListener('click', createNewDoc);

  // 设置
  DOM.settingsBtn.addEventListener('click', () => DOM.settingsPanel.classList.remove('hidden'));
  DOM.settingsClose.addEventListener('click', () => DOM.settingsPanel.classList.add('hidden'));

  // 编辑器操作
  DOM.saveBtn.addEventListener('click', saveCurrentDoc);
  DOM.previewBtn.addEventListener('click', togglePreview);
  DOM.historyBtn.addEventListener('click', showHistory);
  DOM.historyClose.addEventListener('click', () => DOM.historyPanel.classList.add('hidden'));
  DOM.restoreBtn.addEventListener('click', restoreVersion);

  // 阅读模式
  DOM.editBtn.addEventListener('click', () => {
    if (AppState.currentDoc) openEditor(AppState.currentDoc.id);
  });
  DOM.deleteBtn.addEventListener('click', deleteCurrentDoc);

  // 标签
  DOM.addTagBtn.addEventListener('click', () => DOM.tagModal.classList.remove('hidden'));
  DOM.tagModalClose.addEventListener('click', () => DOM.tagModal.classList.add('hidden'));
  DOM.tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      addTagToDoc(e.target.value.trim());
      e.target.value = '';
    }
  });

  // 图片
  DOM.attachImgBtn.addEventListener('click', () => DOM.imageInput.click());
  DOM.imageInput.addEventListener('change', handleImageUpload);

  // 拖拽图片到编辑器
  DOM.editor.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.editor.classList.add('drag-over');
  });
  DOM.editor.addEventListener('dragleave', () => {
    DOM.editor.classList.remove('drag-over');
  });
  DOM.editor.addEventListener('drop', async (e) => {
    e.preventDefault();
    DOM.editor.classList.remove('drag-over');
    const { files } = e.dataTransfer;
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        await insertImageAsMarkdown(file);
      }
    }
  });

  // 导出/导入
  DOM.exportBtn.addEventListener('click', ExportImport.download);
  DOM.importBtn.addEventListener('click', () => DOM.fileInput.click());
  DOM.fileInput.addEventListener('change', handleImport);

  // 存储信息
  DOM.storageBtn.addEventListener('click', showStorageInfo);
  DOM.storageClose.addEventListener('click', () => DOM.storagePanel.classList.add('hidden'));

  // 设置项
  DOM.autoSave.addEventListener('change', (e) => {
    AppState.settings.autoSave = e.target.checked;
    saveSettings();
    setupAutoSave();
  });
  DOM.editorFontSize.addEventListener('change', (e) => {
    AppState.settings.fontSize = parseInt(e.target.value);
    DOM.editor.style.fontSize = AppState.settings.fontSize + 'px';
    saveSettings();
  });
  DOM.themeSelect.addEventListener('change', (e) => {
    AppState.settings.theme = e.target.value;
    applyTheme(e.target.value);
    saveSettings();
  });
  DOM.clearCacheBtn.addEventListener('click', clearCache);
  DOM.registerPushBtn.addEventListener('click', registerPush);

  // 安装横幅
  DOM.installBtn.addEventListener('click', handleInstall);
  DOM.installDismiss.addEventListener('click', () => DOM.installBanner.classList.add('hidden'));

  // 点击模态框外部关闭
  $$('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    // Ctrl+S / Cmd+S 保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (AppState.currentView === 'editor') saveCurrentDoc();
    }
    // Ctrl+F 搜索
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      DOM.searchBar.classList.remove('hidden');
      DOM.searchInput.focus();
    }
    // Ctrl+N 新建
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      createNewDoc();
    }
    // Escape 关闭面板
    if (e.key === 'Escape') {
      $$('.modal').forEach(m => m.classList.add('hidden'));
      DOM.historyPanel.classList.add('hidden');
    }
  });
}

// ============================================================
// 文档列表
// ============================================================

async function refreshDocList() {
  try {
    let docs = await DocDB.list({ sortBy: 'updatedAt', desc: true });

    // 标签过滤
    if (AppState.filterTag) {
      docs = docs.filter(d => d.tags?.includes(AppState.filterTag));
    }

    // 搜索过滤（如果没在搜索模式，用普通列表）
    if (!AppState.searchQuery) {
      renderDocList(docs);
    }

    DOM.docCount.textContent = docs.length;
  } catch (err) {
    console.error('[UI] 加载文档列表失败:', err);
  }
}

function renderDocList(docs) {
  DOM.docList.innerHTML = '';

  if (docs.length === 0) {
    DOM.docList.innerHTML = '<div class="empty-list">暂无文档</div>';
    return;
  }

  for (const doc of docs) {
    const item = document.createElement('div');
    item.className = `doc-item${AppState.currentDoc?.id === doc.id ? ' active' : ''}`;
    item.dataset.id = doc.id;

    const preview = doc.content?.slice(0, 60).replace(/\n/g, ' ') || '空文档';
    const date = formatDate(doc.updatedAt);
    const syncIcon = doc.syncStatus === 'dirty' ? '🔄' : '✅';

    item.innerHTML = `
      <div class="doc-item-title">${escapeHtml(doc.title)}</div>
      <div class="doc-item-preview">${escapeHtml(preview)}${escapeHtml(doc.content?.slice(0, 60))}</div>
      <div class="doc-item-meta">
        <span>${date}</span>
        <span class="sync-icon" title="${doc.syncStatus}">${syncIcon}</span>
      </div>
      ${doc.tags?.length ? `<div class="doc-item-tags">${doc.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    `;

    item.addEventListener('click', () => openReader(doc.id));
    DOM.docList.appendChild(item);
  }
}

// ============================================================
// 全文搜索
// ============================================================

async function performSearch(query) {
  if (!query || query.length < 1) {
    await refreshDocList();
    return;
  }

  try {
    const results = await search(query);
    renderSearchResults(results, query);
  } catch (err) {
    console.error('[Search] 搜索失败:', err);
    showToast('搜索失败', 'error');
  }
}

function renderSearchResults(results, query) {
  DOM.docList.innerHTML = '';

  if (results.length === 0) {
    DOM.docList.innerHTML = `<div class="empty-list">未找到匹配 "${escapeHtml(query)}" 的文档</div>`;
    return;
  }

  const header = document.createElement('div');
  header.className = 'search-results-header';
  header.textContent = `找到 ${results.length} 个结果`;
  DOM.docList.appendChild(header);

  for (const doc of results) {
    const item = document.createElement('div');
    item.className = 'doc-item search-result';
    item.dataset.id = doc.id;

    // 高亮匹配词
    const highlighted = highlightMatches(doc.content || '', doc._matchWords || []);
    const preview = highlighted.slice(0, 120) + '...';

    item.innerHTML = `
      <div class="doc-item-title">${highlightTitle(doc.title, doc._matchWords || [])}</div>
      <div class="doc-item-preview">${preview}</div>
      <div class="doc-item-meta">
        <span>相关度: ${doc._searchScore}</span>
        <span>${formatDate(doc.updatedAt)}</span>
      </div>
    `;

    item.addEventListener('click', () => {
      DOM.searchBar.classList.add('hidden');
      AppState.searchQuery = '';
      DOM.searchInput.value = '';
      openReader(doc.id);
    });

    DOM.docList.appendChild(item);
  }
}

function highlightMatches(text, words) {
  if (!words.length) return escapeHtml(text);
  let result = escapeHtml(text);
  for (const word of words) {
    const regex = new RegExp(`(${escapeRegex(word)})`, 'gi');
    result = result.replace(regex, '<mark>$1</mark>');
  }
  return result;
}

function highlightTitle(title, words) {
  return highlightMatches(title, words);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// 标签
// ============================================================

async function refreshTags() {
  const docs = await DocDB.list({ limit: 1000 });
  const tagCount = {};

  for (const doc of docs) {
    for (const tag of doc.tags || []) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
  }

  DOM.tagList.innerHTML = '';

  // "全部"标签
  const allTag = document.createElement('span');
  allTag.className = `tag-chip${!AppState.filterTag ? ' active' : ''}`;
  allTag.textContent = '全部';
  allTag.addEventListener('click', () => {
    AppState.filterTag = null;
    refreshTags();
    refreshDocList();
  });
  DOM.tagList.appendChild(allTag);

  for (const [tag, count] of Object.entries(tagCount).sort((a, b) => b[1] - a[1])) {
    const chip = document.createElement('span');
    chip.className = `tag-chip${AppState.filterTag === tag ? ' active' : ''}`;
    chip.innerHTML = `${escapeHtml(tag)} <small>${count}</small>`;
    chip.addEventListener('click', () => {
      AppState.filterTag = tag;
      refreshTags();
      refreshDocList();
    });
    DOM.tagList.appendChild(chip);
  }

  // 显示/隐藏标签过滤区
  DOM.tagFilter.classList.toggle('hidden', Object.keys(tagCount).length === 0);
}

function addTagToDoc(tag) {
  if (!AppState.currentDoc) return;
  if (!AppState.currentDoc.tags) AppState.currentDoc.tags = [];
  if (AppState.currentDoc.tags.includes(tag)) return;

  AppState.currentDoc.tags.push(tag);
  renderDocTags();
  DOM.tagModal.classList.add('hidden');
}

function removeTagFromDoc(tag) {
  if (!AppState.currentDoc?.tags) return;
  AppState.currentDoc.tags = AppState.currentDoc.tags.filter(t => t !== tag);
  renderDocTags();
}

function renderDocTags() {
  if (!AppState.currentDoc) return;
  DOM.tagContainer.innerHTML = '';

  for (const tag of AppState.currentDoc.tags || []) {
    const el = document.createElement('span');
    el.className = 'tag removable';
    el.innerHTML = `${escapeHtml(tag)} <button class="tag-remove" data-tag="${escapeHtml(tag)}">✕</button>`;
    el.querySelector('.tag-remove').addEventListener('click', () => removeTagFromDoc(tag));
    DOM.tagContainer.appendChild(el);
  }
}

// ============================================================
// 新建文档
// ============================================================

async function createNewDoc() {
  const doc = await DocDB.create({
    title: '未命名文档',
    content: '',
    tags: [],
  });

  AppState.currentDoc = doc;
  openEditor(doc.id);
  showToast('新文档已创建', 'success');
}

// ============================================================
// 编辑器
// ============================================================

function openEditor(docId) {
  AppState.currentView = 'editor';

  DOM.welcomePage.classList.add('hidden');
  DOM.readerView.classList.add('hidden');
  DOM.editorView.classList.remove('hidden');
  DOM.preview.classList.add('hidden');
  DOM.editor.classList.remove('hidden');

  // 加载文档
  DocDB.get(docId).then(doc => {
    if (!doc) return;
    AppState.currentDoc = doc;
    DOM.docTitle.value = doc.title;
    DOM.editor.value = doc.content;
    renderDocTags();
  });

  // 高亮侧边栏
  $$('.doc-item').forEach(el => el.classList.toggle('active', el.dataset.id === docId));
}

async function saveCurrentDoc() {
  if (!AppState.currentDoc) return;

  const title = DOM.docTitle.value.trim() || '未命名';
  const content = DOM.editor.value;

  try {
    const updated = await DocDB.update(AppState.currentDoc.id, {
      title,
      content,
      html: renderMarkdown(content),
      tags: AppState.currentDoc.tags,
    });

    AppState.currentDoc = updated;
    await refreshDocList();
    await refreshTags();
    showToast('已保存', 'success');

    // 注册 Background Sync
    if ('serviceWorker' in navigator && navigator.onLine) {
      const reg = await navigator.serviceWorker.ready;
      reg.sync.register('sync-documents').catch(() => {});
    }
  } catch (err) {
    console.error('[Save] 保存失败:', err);
    showToast('保存失败: ' + err.message, 'error');
  }
}

function togglePreview() {
  const isPreview = !DOM.preview.classList.contains('hidden');

  if (isPreview) {
    DOM.preview.classList.add('hidden');
    DOM.editor.classList.remove('hidden');
    DOM.previewBtn.textContent = '👁️';
  } else {
    DOM.editor.classList.add('hidden');
    DOM.preview.classList.remove('hidden');
    DOM.preview.innerHTML = renderMarkdown(DOM.editor.value);
    DOM.previewBtn.textContent = '✏️';
  }
}

/** Markdown 渲染 */
function renderMarkdown(text) {
  if (typeof marked !== 'undefined') {
    try {
      return marked.parse(text || '');
    } catch {
      return escapeHtml(text).replace(/\n/g, '<br>');
    }
  }
  // 降级：简单换行
  return escapeHtml(text).replace(/\n/g, '<br>');
}

// ============================================================
// 阅读模式
// ============================================================

async function openReader(docId) {
  const doc = await DocDB.get(docId);
  if (!doc) return;

  AppState.currentDoc = doc;
  AppState.currentView = 'reader';

  DOM.welcomePage.classList.add('hidden');
  DOM.editorView.classList.add('hidden');
  DOM.readerView.classList.remove('hidden');

  DOM.readerTitle.textContent = doc.title;
  DOM.readerMeta.textContent = `创建于 ${formatDate(doc.createdAt)} · 更新于 ${formatDate(doc.updatedAt)} · v${doc.version || 1}`;
  DOM.readerContent.innerHTML = doc.html || renderMarkdown(doc.content);

  // 标签
  DOM.readerTags.innerHTML = '';
  for (const tag of doc.tags || []) {
    const el = document.createElement('span');
    el.className = 'tag';
    el.textContent = tag;
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      AppState.filterTag = tag;
      refreshTags();
      refreshDocList();
    });
    DOM.readerTags.appendChild(el);
  }

  // 高亮侧边栏
  $$('.doc-item').forEach(el => el.classList.toggle('active', el.dataset.id === docId));

  // 关闭侧边栏（移动端）
  if (window.innerWidth < 768) {
    DOM.sidebar.classList.remove('open');
  }
}

// ============================================================
// 删除文档
// ============================================================

async function deleteCurrentDoc() {
  if (!AppState.currentDoc) return;
  if (!confirm(`确定删除 "${AppState.currentDoc.title}"？`)) return;

  try {
    await DocDB.delete(AppState.currentDoc.id);
    AppState.currentDoc = null;
    AppState.currentView = 'welcome';

    DOM.editorView.classList.add('hidden');
    DOM.readerView.classList.add('hidden');
    DOM.welcomePage.classList.remove('hidden');

    await refreshDocList();
    await refreshTags();
    showToast('文档已删除', 'success');
  } catch (err) {
    console.error('[Delete] 删除失败:', err);
    showToast('删除失败', 'error');
  }
}

// ============================================================
// 版本历史
// ============================================================

async function showHistory() {
  if (!AppState.currentDoc) return;

  DOM.historyPanel.classList.remove('hidden');
  DOM.diffView.classList.add('hidden');

  try {
    const versions = await DocDB.getVersions(AppState.currentDoc.id, { limit: 50 });

    DOM.versionList.innerHTML = '';

    if (versions.length === 0) {
      DOM.versionList.innerHTML = '<div class="empty-list">暂无版本历史</div>';
      return;
    }

    for (let i = 0; i < versions.length; i++) {
      const v = versions[i];
      const isLatest = i === 0;

      const item = document.createElement('div');
      item.className = `version-item${isLatest ? ' latest' : ''}`;
      item.innerHTML = `
        <div class="version-header">
          <span class="version-id">v${i + 1}</span>
          <span class="version-time">${formatDateTime(v.timestamp)}</span>
          ${isLatest ? '<span class="version-latest">当前</span>' : ''}
        </div>
        <div class="version-summary">${escapeHtml(v.changeSummary || '无变更说明')}</div>
        <div class="version-actions">
          <button class="diff-btn" data-version="${v.id}">查看差异</button>
          ${!isLatest ? `<button class="restore-btn" data-version="${v.id}">恢复</button>` : ''}
        </div>
      `;

      item.querySelector('.diff-btn')?.addEventListener('click', () => showDiff(v.id));
      item.querySelector('.restore-btn')?.addEventListener('click', () => restoreToVersion(v.id));

      DOM.versionList.appendChild(item);
    }
  } catch (err) {
    console.error('[History] 加载版本历史失败:', err);
  }
}

async function showDiff(versionId) {
  if (!AppState.currentDoc) return;

  try {
    const versions = await DocDB.getVersions(AppState.currentDoc.id);
    const current = versions[0]; // 最新版本
    const target = versions.find(v => v.id === versionId);

    if (!target) return;

    const diff = computeDiff(target.content, current.content);

    DOM.diffView.classList.remove('hidden');
    DOM.diffContent.innerHTML = diff.map(change => {
      switch (change.type) {
        case 'add':
          return `<div class="diff-line diff-add">+ ${escapeHtml(change.text)}</div>`;
        case 'delete':
          return `<div class="diff-line diff-delete">- ${escapeHtml(change.text)}</div>`;
        case 'modify':
          return `<div class="diff-line diff-delete">- ${escapeHtml(change.old)}</div>
                  <div class="diff-line diff-add">+ ${escapeHtml(change.new)}</div>`;
        default:
          return `<div class="diff-line">  ${escapeHtml(change.text || '')}</div>`;
      }
    }).join('');

    DOM.restoreBtn.dataset.version = versionId;
  } catch (err) {
    console.error('[Diff] 计算差异失败:', err);
  }
}

async function restoreVersion() {
  const versionId = parseInt(DOM.restoreBtn.dataset.version);
  if (!versionId || !AppState.currentDoc) return;

  if (!confirm('确定恢复到此版本？当前内容将被覆盖。')) return;

  try {
    await DocDB.restoreVersion(AppState.currentDoc.id, versionId);
    DOM.historyPanel.classList.add('hidden');
    openEditor(AppState.currentDoc.id);
    showToast('已恢复到此版本', 'success');
  } catch (err) {
    console.error('[Restore] 恢复失败:', err);
    showToast('恢复失败', 'error');
  }
}

async function restoreToVersion(versionId) {
  if (!AppState.currentDoc) return;
  if (!confirm('确定恢复到此版本？')) return;

  try {
    await DocDB.restoreVersion(AppState.currentDoc.id, versionId);
    DOM.historyPanel.classList.add('hidden');
    openEditor(AppState.currentDoc.id);
    showToast('已恢复', 'success');
  } catch (err) {
    showToast('恢复失败', 'error');
  }
}

// ============================================================
// 图片处理
// ============================================================

async function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  await insertImageAsMarkdown(file);
  e.target.value = '';
}

async function insertImageAsMarkdown(file) {
  try {
    const image = await ImageDB.save(file, AppState.currentDoc ? [AppState.currentDoc.id] : []);
    const markdown = `![${image.name}](img://${image.id})`;

    // 插入到编辑器光标位置
    const { editor } = DOM;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = editor.value;
    editor.value = text.slice(0, start) + markdown + '\n' + text.slice(end);
    editor.selectionStart = editor.selectionEnd = start + markdown.length + 1;
    editor.focus();

    showToast(`图片 "${image.name}" 已插入`, 'success');
  } catch (err) {
    console.error('[Image] 保存失败:', err);
    showToast('图片保存失败', 'error');
  }
}

/** 解析 img:// 协议，替换为 Blob URL */
function resolveImageRefs(html) {
  return html.replace(/img:\/\/([a-f0-9-]+)/gi, async (match, id) => {
    const url = await ImageDB.getUrl(id);
    return url || match;
  });
}

// ============================================================
// 导入/导出
// ============================================================

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await ExportImport.importAll(data);
    await refreshDocList();
    await refreshTags();
    showToast(`导入成功: ${data.documents?.length || 0} 个文档`, 'success');
  } catch (err) {
    console.error('[Import] 导入失败:', err);
    showToast('导入失败: 无效的文件格式', 'error');
  }

  e.target.value = '';
}

// ============================================================
// 存储信息
// ============================================================

async function showStorageInfo() {
  DOM.storagePanel.classList.remove('hidden');

  try {
    const [usage, sizes] = await Promise.all([
      StorageMonitor.getUsage(),
      StorageMonitor.storeSizes(),
    ]);

    const isNearQuota = await StorageMonitor.isNearQuota(80);

    DOM.storageInfo.innerHTML = `
      <div class="storage-section">
        <h4>存储配额</h4>
        <div class="storage-bar ${isNearQuota ? 'warning' : ''}">
          <div class="storage-fill" style="width: ${usage.percent || 0}%"></div>
        </div>
        <div class="storage-details">
          <span>已用: ${usage.usageMB} MB</span>
          <span>配额: ${usage.quotaMB} MB</span>
          <span>使用率: ${usage.percent}%</span>
        </div>
      </div>

      <div class="storage-section">
        <h4>数据存储</h4>
        <table class="storage-table">
          <tr><td>文档</td><td>${sizes.documents} 个</td></tr>
          <tr><td>版本历史</td><td>${sizes.versions} 条</td></tr>
          <tr><td>搜索索引</td><td>${sizes.searchEntries} 个词条</td></tr>
          <tr><td>同步队列</td><td>${sizes.syncQueue} 项</td></tr>
          <tr><td>图片</td><td>${sizes.images} 张 (${sizes.imageStorageMB} MB)</td></tr>
        </table>
      </div>
    `;
  } catch (err) {
    DOM.storageInfo.innerHTML = '<p>获取存储信息失败</p>';
  }
}

// ============================================================
// 设置
// ============================================================

function loadSettings() {
  try {
    const saved = localStorage.getItem('wikibase-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      Object.assign(AppState.settings, settings);

      DOM.autoSave.checked = AppState.settings.autoSave;
      DOM.editorFontSize.value = AppState.settings.fontSize;
      DOM.editor.style.fontSize = AppState.settings.fontSize + 'px';
      DOM.themeSelect.value = AppState.settings.theme;
      applyTheme(AppState.settings.theme);
    }
  } catch {
    // 使用默认设置
  }
}

function saveSettings() {
  try {
    localStorage.setItem('wikibase-settings', JSON.stringify(AppState.settings));
  } catch {
    // localStorage 不可用
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

async function clearCache() {
  if (!confirm('确定清除所有缓存？文档数据不会丢失。')) return;

  navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_CACHE' });
  showToast('缓存已清除', 'success');
}

// ============================================================
// 自动保存
// ============================================================

function setupAutoSave() {
  if (AppState.autoSaveTimer) {
    clearInterval(AppState.autoSaveTimer);
    AppState.autoSaveTimer = null;
  }

  if (AppState.settings.autoSave) {
    AppState.autoSaveTimer = setInterval(() => {
      if (AppState.currentView === 'editor' && AppState.currentDoc) {
        // 检查是否有未保存的更改
        const currentContent = DOM.editor.value;
        const currentTitle = DOM.docTitle.value;
        if (currentContent !== AppState.currentDoc.content || currentTitle !== AppState.currentDoc.title) {
          saveCurrentDoc();
        }
      }
    }, 30000); // 30 秒
  }
}

// ============================================================
// 网络状态
// ============================================================

function setupNetworkListener() {
  window.addEventListener('online', () => {
    AppState.isOnline = true;
    DOM.offlineBanner.classList.add('hidden');
    DOM.syncStatus.textContent = '🟢 在线';
    DOM.syncStatus.title = '在线';

    // 联网后触发同步
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.sync.register('sync-documents').catch(() => {});
      });
    }
  });

  window.addEventListener('offline', () => {
    AppState.isOnline = false;
    DOM.offlineBanner.classList.remove('hidden');
    DOM.syncStatus.textContent = '🔴 离线';
    DOM.syncStatus.title = '离线';
  });
}

function handleSyncFromSW(payload) {
  if (payload?.type === 'documents') {
    // 执行实际的同步逻辑
    SyncQueue.pending().then(items => {
      if (items.length > 0 && AppState.isOnline) {
        // 模拟同步（实际项目发送到服务器）
        Promise.all(items.map(item => SyncQueue.markSynced(item.id)))
          .then(() => refreshDocList())
          .catch(() => {});
      }
    });
  }
}

// ============================================================
// 安装横幅
// ============================================================

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    AppState.deferredPrompt = e;
    DOM.installBanner.classList.remove('hidden');
  });

  window.addEventListener('appinstalled', () => {
    DOM.installBanner.classList.add('hidden');
    AppState.deferredPrompt = null;
    showToast('WikiBase 已安装', 'success');
  });
}

async function handleInstall() {
  if (!AppState.deferredPrompt) return;

  AppState.deferredPrompt.prompt();
  const { outcome } = await AppState.deferredPrompt.userChoice;
  AppState.deferredPrompt = null;

  if (outcome === 'accepted') {
    showToast('安装成功', 'success');
  }
  DOM.installBanner.classList.add('hidden');
}

// ============================================================
// Share Target 处理
// ============================================================

function handleShareTarget() {
  // 检查 URL 参数（通过 share_target 打开）
  const params = new URLSearchParams(window.location.search);
  const sharedTitle = params.get('title');
  const sharedText = params.get('text');
  const sharedUrl = params.get('url');

  if (sharedTitle || sharedText || sharedUrl) {
    let content = '';
    if (sharedTitle) content += `# ${sharedTitle}\n\n`;
    if (sharedText) content += `${sharedText}\n\n`;
    if (sharedUrl) content += `来源: ${sharedUrl}`;

    DocDB.create({
      title: sharedTitle || '分享的内容',
      content: content.trim(),
      tags: ['分享'],
    }).then(doc => {
      AppState.currentDoc = doc;
      openEditor(doc.id);
      showToast('已保存分享的内容', 'success');
    });
  }
}

// ============================================================
// Push 通知
// ============================================================

async function registerPush() {
  if (!('Notification' in window) || !('PushManager' in window)) {
    showToast('浏览器不支持推送通知', 'error');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    showToast('通知权限被拒绝', 'error');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // 实际项目需要 VAPID 公钥
    });

    console.log('[Push] 订阅成功:', subscription);
    showToast('推送通知已启用', 'success');
  } catch (err) {
    console.warn('[Push] 订阅失败（可能需要 VAPID 密钥）:', err);
    showToast('推送订阅需要服务器配置 VAPID', 'info');
  }
}

// ============================================================
// 工具函数
// ============================================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;

  return date.toLocaleDateString('zh-CN');
}

function formatDateTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function showToast(message, type = 'info') {
  DOM.toast.textContent = message;
  DOM.toast.className = `toast toast-${type}`;
  DOM.toast.classList.remove('hidden');

  setTimeout(() => {
    DOM.toast.classList.add('hidden');
  }, 3000);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ============================================================
// 启动
// ============================================================

document.addEventListener('DOMContentLoaded', init);
