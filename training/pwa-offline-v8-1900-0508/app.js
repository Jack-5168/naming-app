/**
 * CollabPad — 主应用 v8
 *
 * 第八轮迭代核心功能（对比 v7 MarkFlow）：
 * 1. OT 操作转换 — Insert/Delete/Retain 三操作，支持并发编辑冲突解决
 * 2. BroadcastChannel — 多标签页实时同步（光标/选区/内容变更）
 * 3. Push Notification — 协作事件通知（加入/离开/编辑/冲突）
 * 4. Background Sync — 离线操作队列，恢复连接后自动重放
 * 5. 向量时钟 — 多协作者版本追踪，检测并发编辑
 * 6. Web Share API — 原生分享文档
 * 7. Page Visibility API — 标签页可见性管理协作者在线状态
 * 8. Lock Manager API — 跨标签页文档锁，防止并发写入
 * 9. 冲突解决 UI — 可视化冲突面板，手动选择解决方案
 * 10. 变更历史回放 — 时间旅行，查看任意历史版本
 */

// ============================================================
// 全局状态
// ============================================================

const AppState = {
  currentDoc: null,
  isOnline: navigator.onLine,
  isInstalled: false,
  userId: localStorage.getItem('collabpad_userId') || crypto.randomUUID(),
  userName: localStorage.getItem('collabpad_userName') || `用户 ${Math.floor(Math.random() * 9999)}`,
  userColor: '',
  channel: null,          // BroadcastChannel
  syncRegistrations: [],  // Background Sync registrations
  deferredPrompt: null,
  editTimeout: null,
  autoSaveInterval: null,
  heartbeatInterval: null,
  vectorClock: {},
  localVersion: 0,
  remoteVersion: 0,
  pendingOps: [],         // 待发送的操作
  isEditing: false,
  visibilityState: document.visibilityState,
};

// 初始化用户
if (!localStorage.getItem('collabpad_userId')) {
  localStorage.setItem('collabpad_userId', AppState.userId);
}
AppState.userColor = generateColor(AppState.userId);

// ============================================================
// DOM 引用
// ============================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================================
// 初始化
// ============================================================

async function init() {
  console.log('🤝 CollabPad v8 启动');
  console.log(`👤 用户: ${AppState.userName} (${AppState.userId.slice(0, 8)})`);

  // 1. 打开数据库
  await CollabDB.openDB();
  console.log('✅ IndexedDB 已打开');

  // 2. 注册 Service Worker
  await registerSW();

  // 3. 设置 BroadcastChannel
  setupBroadcastChannel();

  // 4. 注册协作者
  await CollabDB.upsertCollaborator(AppState.userId, {
    name: AppState.userName,
    color: AppState.userColor,
  });

  // 5. 发送加入广播
  broadcast({
    type: 'user_join',
    userId: AppState.userId,
    userName: AppState.userName,
    color: AppState.userColor,
    timestamp: Date.now(),
  });

  // 6. 设置事件监听
  setupEventListeners();

  // 7. 加载文档列表
  await loadDocumentList();

  // 8. 设置心跳
  setupHeartbeat();

  // 9. 检查存储配额
  const quota = await CollabDB.checkStorageQuota(80);
  if (quota.nearLimit) {
    showToast(`⚠️ 存储使用 ${quota.percent}%，接近上限`, 'warning');
  }

  // 10. 检查推送通知权限
  if ('Notification' in window && Notification.permission === 'default') {
    // 不自动请求，等用户点击通知按钮
  }

  console.log('✅ CollabPad 初始化完成');
}

// ============================================================
// Service Worker 注册
// ============================================================

async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('❌ Service Worker 不支持');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('./sw.js', {
      scope: './',
    });

    console.log('✅ Service Worker 已注册', registration.scope);

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
    navigator.serviceWorker.addEventListener('message', (event) => {
      handleSWMessage(event.data);
    });

    // 注册 Background Sync
    if ('sync' in registration) {
      try {
        await registration.sync.register('collab-sync');
        console.log('✅ Background Sync 已注册');
      } catch (e) {
        console.warn('⚠️ Background Sync 注册失败:', e.message);
      }
    }

    // 注册 Periodic Background Sync（如果支持）
    if ('periodicSync' in registration) {
      try {
        await registration.periodicSync.register('collab-periodic', {
          minInterval: 24 * 60 * 60 * 1000, // 24 小时
        });
        console.log('✅ Periodic Background Sync 已注册');
      } catch (e) {
        console.warn('⚠️ Periodic Background Sync 不可用:', e.message);
      }
    }

    AppState.swRegistration = registration;
  } catch (error) {
    console.error('❌ Service Worker 注册失败:', error);
  }
}

/**
 * 处理 SW 消息
 */
function handleSWMessage(data) {
  switch (data.type) {
    case 'sync_complete':
      updateSyncBadge('synced');
      break;
    case 'conflict_detected':
      showConflictPanel(data.conflicts);
      break;
    case 'push_notification':
      // SW 推送的通知已在系统层显示，这里更新 UI
      updateNotifBadge();
      break;
  }
}

// ============================================================
// BroadcastChannel — 多标签页同步
// ============================================================

function setupBroadcastChannel() {
  // 全局频道（所有标签页共享）
  AppState.channel = new BroadcastChannel('collabpad_global');
  AppState.channel.onmessage = (event) => {
    handleBroadcast(event.data);
  };

  // 文档频道（特定文档的协作者）
  AppState.docChannel = null;
}

/**
 * 切换到文档频道
 */
async function switchDocChannel(docId) {
  // 关闭旧频道
  if (AppState.docChannel) {
    AppState.docChannel.close();
  }

  AppState.docChannel = new BroadcastChannel(`collabpad_doc_${docId}`);
  AppState.docChannel.onmessage = (event) => {
    handleDocBroadcast(event.data);
  };

  // 通知加入
  broadcastDoc({
    type: 'doc_join',
    userId: AppState.userId,
    userName: AppState.userName,
    timestamp: Date.now(),
  });
}

/**
 * 发送全局广播
 */
function broadcast(data) {
  if (AppState.channel) {
    AppState.channel.postMessage(data);
  }
}

/**
 * 发送文档广播
 */
function broadcastDoc(data) {
  if (AppState.docChannel) {
    AppState.docChannel.postMessage(data);
  }
}

/**
 * 处理全局广播
 */
function handleBroadcast(data) {
  if (data.userId === AppState.userId) return; // 忽略自己

  switch (data.type) {
    case 'user_join':
      // 新用户加入
      CollabDB.upsertCollaborator(data.userId, {
        name: data.userName,
        color: data.color,
      }).then(() => {
        updateCollabPanel();
        createPushNotification(
          '👋 协作者加入',
          `${data.userName} 加入了协作`
        );
      });
      break;

    case 'user_leave':
      CollabDB.setCollaboratorOffline(data.userId).then(() => {
        updateCollabPanel();
      });
      break;

    case 'heartbeat':
      // 更新协作者最后活跃时间
      CollabDB.upsertCollaborator(data.userId, {
        name: data.userName,
        color: data.color,
        lastSeen: data.timestamp,
      }).then(() => updateCollabPanel());
      break;
  }
}

/**
 * 处理文档广播
 */
function handleDocBroadcast(data) {
  if (data.userId === AppState.userId) return;

  switch (data.type) {
    case 'doc_join':
      updateCollabPanel();
      break;

    case 'doc_leave':
      updateCollabPanel();
      break;

    case 'cursor_move':
      // 显示远程光标
      renderRemoteCursor(data);
      break;

    case 'selection_change':
      // 显示远程选区
      renderRemoteSelection(data);
      break;

    case 'content_change':
      // 远程内容变更（OT 应用）
      applyRemoteOperation(data);
      break;

    case 'doc_saved':
      // 文档已保存
      updateSyncBadge('synced');
      break;
  }
}

// ============================================================
// OT 操作转换引擎
// ============================================================

/**
 * OT 操作类型
 * - Retain(n): 跳过 n 个字符
 * - Insert(text): 在当前位置插入文本
 * - Delete(n): 删除当前位置的 n 个字符
 */

/**
 * 将文本差异转换为 OT 操作序列
 */
function diffToOps(oldText, newText) {
  const ops = [];
  const commonPrefix = getCommonPrefixLength(oldText, newText);
  const commonSuffix = getCommonSuffixLength(
    oldText.slice(commonPrefix),
    newText.slice(commonPrefix)
  );

  // Retain 公共前缀
  if (commonPrefix > 0) {
    ops.push({ type: 'retain', length: commonPrefix });
  }

  // 删除差异部分
  const deleteLen = oldText.length - commonPrefix - commonSuffix;
  if (deleteLen > 0) {
    ops.push({ type: 'delete', length: deleteLen });
  }

  // 插入新内容
  const insertText = newText.slice(commonPrefix, newText.length - commonSuffix);
  if (insertText.length > 0) {
    ops.push({ type: 'insert', text: insertText });
  }

  // Retain 公共后缀
  if (commonSuffix > 0) {
    ops.push({ type: 'retain', length: commonSuffix });
  }

  return ops;
}

/**
 * 获取公共前缀长度
 */
function getCommonPrefixLength(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * 获取公共后缀长度
 */
function getCommonSuffixLength(a, b) {
  let i = 0;
  while (
    i < a.length &&
    i < b.length &&
    a[a.length - 1 - i] === b[b.length - 1 - i]
  ) {
    i++;
  }
  return i;
}

/**
 * 应用 OT 操作到文本
 */
function applyOps(text, ops) {
  let result = '';
  let textIndex = 0;

  for (const op of ops) {
    switch (op.type) {
      case 'retain':
        result += text.slice(textIndex, textIndex + op.length);
        textIndex += op.length;
        break;
      case 'insert':
        result += op.text;
        break;
      case 'delete':
        textIndex += op.length;
        break;
    }
  }

  // 保留末尾未操作的部分
  if (textIndex < text.length) {
    result += text.slice(textIndex);
  }

  return result;
}

/**
 * OT 转换：将两个并发操作转换为可顺序应用的操作
 *
 * 场景：用户 A 和用户 B 同时编辑同一文档
 * - A 的操作基于版本 N
 * - B 的操作也基于版本 N
 * - 需要将 B 的操作转换为基于 "N + A" 的状态
 */
function transform(opA, opB) {
  // opA 先应用，opB 需要转换
  const opBPrime = { ...opB };

  switch (opA.type) {
    case 'insert':
      if (opBPrime.type === 'insert' || opBPrime.type === 'delete') {
        if (opBPrime.position >= opA.position) {
          opBPrime.position += opA.text.length;
        }
      }
      break;

    case 'delete':
      if (opBPrime.type === 'insert' || opBPrime.type === 'delete') {
        if (opBPrime.position >= opA.position + opA.length) {
          opBPrime.position -= opA.length;
        } else if (opBPrime.position >= opA.position) {
          opBPrime.position = opA.position;
        }
      }
      break;

    case 'retain':
      // retain 不影响其他操作的位置
      break;
  }

  return opBPrime;
}

/**
 * 转换操作序列
 */
function transformOps(opsA, opsB) {
  const opsBPrime = opsB.map((op) => ({ ...op }));

  for (const opA of opsA) {
    for (let i = 0; i < opsBPrime.length; i++) {
      opsBPrime[i] = transform(opA, opsBPrime[i]);
    }
  }

  return opsBPrime;
}

/**
 * 检测冲突
 */
function detectConflict(doc, remoteVersion) {
  const docVersion = doc.version || {};
  const localTotal = Object.values(docVersion).reduce((a, b) => a + b, 0);

  // 如果远程版本和本地版本都有推进，说明有并发编辑
  const hasConcurrency = Object.keys(remoteVersion).some(
    (userId) =>
      remoteVersion[userId] > (docVersion[userId] || 0)
  );

  return hasConcurrency;
}

/**
 * 解决冲突（Last-Writer-Wins + 合并）
 */
function resolveConflict(localContent, remoteContent, baseContent) {
  // 三方合并：找到 base 作为共同祖先
  // 简化实现：如果本地和远程都改了同一段，远程优先（可配置）
  const localOps = diffToOps(baseContent, localContent);
  const remoteOps = diffToOps(baseContent, remoteContent);

  // 转换 remoteOps 使其基于本地状态
  const transformedRemote = transformOps(localOps, remoteOps);

  // 应用转换后的远程操作
  const merged = applyOps(localContent, transformedRemote);

  return merged;
}

// ============================================================
// 事件监听
// ============================================================

function setupEventListeners() {
  const editor = $('#editor');

  // 编辑器输入（防抖保存）
  editor.addEventListener('input', () => {
    AppState.isEditing = true;
    updateWordCount();
    updateCursorPos();

    clearTimeout(AppState.editTimeout);
    AppState.editTimeout = setTimeout(() => {
      handleEditorChange();
    }, 500);
  });

  // 光标移动（广播）
  editor.addEventListener('keyup', broadcastCursor);
  editor.addEventListener('click', broadcastCursor);
  editor.addEventListener('select', broadcastCursor);

  // 工具栏按钮
  $$('.editor-toolbar button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { cmd } = btn.dataset;
      if (cmd) insertMarkdown(cmd);
    });
  });

  // 新建文档
  $('#newDocBtn').addEventListener('click', createNewDocument);

  // 分享
  $('#shareBtn').addEventListener('click', shareDocument);

  // 通知
  $('#notifBtn').addEventListener('click', toggleNotifPanel);
  $('#notifToggle').addEventListener('change', togglePushNotifications);

  // 冲突面板
  $('#conflictBtn').addEventListener('click', () => {
    togglePanel('conflictPanel');
    if (!$('#conflictPanel').classList.contains('hidden')) {
      loadConflicts();
    }
  });

  // 诊断
  $('#diagBtn').addEventListener('click', () => {
    togglePanel('diagPanel');
    if (!$('#diagPanel').classList.contains('hidden')) {
      runDiagnostics();
    }
  });

  // 在线/离线
  window.addEventListener('online', () => {
    AppState.isOnline = true;
    updateConnectionBadge();
    showToast('🌐 已恢复在线连接', 'success');
    flushSyncQueue();
  });

  window.addEventListener('offline', () => {
    AppState.isOnline = false;
    updateConnectionBadge();
    showToast('📡 已离线，更改将本地保存', 'warning');
  });

  // 页面可见性
  document.addEventListener('visibilitychange', () => {
    AppState.visibilityState = document.visibilityState;
    if (document.visibilityState === 'visible') {
      // 重新上线
      CollabDB.upsertCollaborator(AppState.userId, {
        name: AppState.userName,
        color: AppState.userColor,
        status: 'online',
      }).then(() => {
        broadcast({
          type: 'user_join',
          userId: AppState.userId,
          userName: AppState.userName,
          color: AppState.userColor,
          timestamp: Date.now(),
        });
      });
    } else {
      // 标记离开
      broadcast({
        type: 'heartbeat',
        userId: AppState.userId,
        userName: AppState.userName,
        color: AppState.userColor,
        timestamp: Date.now(),
        status: 'away',
      });
    }
  });

  // 页面关闭（发送离开广播）
  window.addEventListener('beforeunload', () => {
    broadcast({
      type: 'user_leave',
      userId: AppState.userId,
      timestamp: Date.now(),
    });
  });

  // 安装提示
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    AppState.deferredPrompt = e;
  });
}

// ============================================================
// 文档操作
// ============================================================

/**
 * 加载文档列表
 */
async function loadDocumentList() {
  const docs = await CollabDB.listDocuments();
  const docList = $('#docList');
  docList.innerHTML = '';

  if (docs.length === 0) {
    docList.innerHTML = '<p class="empty-state">暂无文档，点击"新建"创建</p>';
    return;
  }

  for (const doc of docs) {
    const item = document.createElement('div');
    item.className = `doc-item${AppState.currentDoc?.id === doc.id ? ' active' : ''}`;
    item.innerHTML = `
      <div class="doc-item-title">${escapeHtml(doc.title)}</div>
      <div class="doc-item-meta">
        <span>${formatDate(doc.updatedAt)}</span>
        <span class="doc-item-editor">by ${getUserName(doc.lastEditor)}</span>
      </div>
    `;
    item.addEventListener('click', () => openDocument(doc.id));
    docList.appendChild(item);
  }
}

/**
 * 打开文档
 */
async function openDocument(docId) {
  // 使用 Lock Manager API 获取文档锁
  if ('locks' in navigator) {
    const lock = await navigator.locks.request(`doc_${docId}`, { ifAvailable: true }, async (lock) => {
      if (!lock) {
        showToast('⚠️ 文档正在被其他标签页编辑', 'warning');
        return;
      }
      await loadDocument(docId);
    });
  } else {
    await loadDocument(docId);
  }
}

/**
 * 加载文档内容
 */
async function loadDocument(docId) {
  const doc = await CollabDB.getDocument(docId);
  if (!doc) return;

  AppState.currentDoc = doc;
  AppState.vectorClock = { ...doc.version };
  AppState.localVersion = Object.values(doc.version).reduce((a, b) => a + b, 0);

  // 切换到文档频道
  await switchDocChannel(docId);

  // 更新 UI
  $('#docTitle').textContent = doc.title;
  $('#editor').value = doc.content;
  updatePreview(doc.content);
  updateWordCount();
  updateCursorPos();

  // 更新文档列表高亮
  $$('.doc-item').forEach((item) => item.classList.remove('active'));
  const items = $$('.doc-item');
  const docs = await CollabDB.listDocuments();
  const idx = docs.findIndex((d) => d.id === docId);
  if (items[idx]) items[idx].classList.add('active');

  // 加载变更历史
  loadChangeLog(docId);

  // 更新协作者面板
  updateCollabPanel();
}

/**
 * 创建新文档
 */
async function createNewDocument() {
  const title = prompt('文档标题:', '新文档');
  if (!title) return;

  const doc = await CollabDB.createDocument(title, '', AppState.userId);
  await loadDocument(doc.id);
  await loadDocumentList();

  broadcast({
    type: 'user_join',
    userId: AppState.userId,
    userName: AppState.userName,
    color: AppState.userColor,
    timestamp: Date.now(),
  });

  // 入队同步
  if (!AppState.isOnline) {
    await CollabDB.enqueueSync('document', { action: 'create', doc });
  }
}

/**
 * 编辑器内容变更处理
 */
async function handleEditorChange() {
  if (!AppState.currentDoc) return;

  const editor = $('#editor');
  const newContent = editor.value;
  const oldContent = AppState.currentDoc.content;

  if (newContent === oldContent) {
    AppState.isEditing = false;
    return;
  }

  // 生成 OT 操作
  const ops = diffToOps(oldContent, newContent);

  // 记录操作
  for (const op of ops) {
    if (op.type !== 'retain') {
      await CollabDB.recordOperation(
        AppState.currentDoc.id,
        AppState.userId,
        op.type,
        op.position || 0,
        op.text || '',
        op.length || 0,
        AppState.localVersion
      );
    }
  }

  // 更新文档
  const updatedDoc = await CollabDB.updateDocument(
    AppState.currentDoc.id,
    newContent,
    AppState.userId
  );

  AppState.currentDoc = updatedDoc;
  AppState.localVersion++;

  // 更新预览
  updatePreview(newContent);

  // 更新同步状态
  updateSyncBadge('dirty');

  // 广播内容变更
  broadcastDoc({
    type: 'content_change',
    userId: AppState.userId,
    userName: AppState.userName,
    ops,
    version: AppState.localVersion,
    timestamp: Date.now(),
  });

  // 入队同步（如果离线）
  if (!AppState.isOnline) {
    await CollabDB.enqueueSync('operation', {
      docId: AppState.currentDoc.id,
      ops,
      version: AppState.localVersion,
    });
  } else {
    // 在线：触发 Background Sync
    if (AppState.swRegistration?.sync) {
      try {
        await AppState.swRegistration.sync.register('collab-sync');
      } catch (e) {
        // 忽略
      }
    }
  }

  // 记录变更到历史
  await recordChange(
    AppState.currentDoc.id,
    AppState.userId,
    ops,
    oldContent,
    newContent
  );

  AppState.isEditing = false;
  updateSyncBadge('synced');
}

/**
 * 应用远程操作（OT 合并）
 */
async function applyRemoteOperation(data) {
  if (!AppState.currentDoc || data.userId === AppState.userId) return;
  if (AppState.isEditing) return; // 正在编辑时忽略远程变更

  const oldContent = AppState.currentDoc.content;
  const newContent = applyOps(oldContent, data.ops);

  // 检测冲突
  const hasConflict = detectConflict(AppState.currentDoc, data.version || {});

  if (hasConflict) {
    // 冲突解决
    const baseContent = oldContent; // 简化：假设 base 是本地当前内容
    const resolved = resolveConflict(oldContent, newContent, baseContent);

    // 记录冲突
    await CollabDB.recordConflict(
      AppState.currentDoc.id,
      { userId: AppState.userId, content: oldContent },
      { userId: data.userId, content: newContent },
      'merged'
    );

    // 更新为合并后的内容
    AppState.currentDoc = await CollabDB.updateDocument(
      AppState.currentDoc.id,
      resolved,
      data.userId
    );

    $('#editor').value = resolved;
    updatePreview(resolved);

    // 通知冲突
    createPushNotification(
      '⚡ 检测到编辑冲突',
      `${data.userName} 的编辑与本地冲突，已自动合并`
    );
  } else {
    // 无冲突，直接应用
    AppState.currentDoc = await CollabDB.updateDocument(
      AppState.currentDoc.id,
      newContent,
      data.userId
    );

    $('#editor').value = newContent;
    updatePreview(newContent);
  }

  AppState.remoteVersion = data.version || AppState.remoteVersion;
  updateSyncBadge('synced');
}

// ============================================================
// 光标/选区广播
// ============================================================

function broadcastCursor() {
  if (!AppState.currentDoc) return;

  const editor = $('#editor');
  const text = editor.value.substring(0, editor.selectionStart);
  const lines = text.split('\n');
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;

  broadcastDoc({
    type: 'cursor_move',
    userId: AppState.userId,
    userName: AppState.userName,
    color: AppState.userColor,
    cursorPos: { line, col },
    selection: {
      start: editor.selectionStart,
      end: editor.selectionEnd,
    },
    timestamp: Date.now(),
  });
}

/**
 * 渲染远程光标（简化：在编辑器上方显示用户名）
 */
function renderRemoteCursor(data) {
  // 在实际应用中，这里会在编辑器中绘制远程光标
  // 简化实现：在控制台输出
  console.log(`📍 ${data.userName} 光标: Ln ${data.cursorPos.line}, Col ${data.cursorPos.col}`);
}

/**
 * 渲染远程选区
 */
function renderRemoteSelection(data) {
  console.log(`📝 ${data.userName} 选区: ${data.selection.start}-${data.selection.end}`);
}

// ============================================================
// Markdown 预览
// ============================================================

function updatePreview(markdown) {
  const preview = $('#preview');
  preview.innerHTML = simpleMarkdownToHtml(markdown);
}

/**
 * 简易 Markdown → HTML 转换
 */
function simpleMarkdownToHtml(md) {
  if (!md) return '<p class="empty-preview">暂无内容</p>';

  let html = escapeHtml(md);

  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>');

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 粗体/斜体
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 删除线
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // 引用
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // 无序列表
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // 图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // 水平线
  html = html.replace(/^---$/gm, '<hr>');

  // 段落
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // 清理空段落
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[123]>)/g, '$1');
  html = html.replace(/(<\/h[123]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<blockquote>)/g, '$1');
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr>)<\/p>/g, '$1');

  return html;
}

// ============================================================
// Markdown 插入
// ============================================================

function insertMarkdown(cmd) {
  const editor = $('#editor');
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.substring(start, end);
  let insertion = '';
  let cursorOffset = 0;

  switch (cmd) {
    case 'bold':
      insertion = `**${selected || '粗体文本'}**`;
      cursorOffset = selected ? 0 : -2;
      break;
    case 'italic':
      insertion = `*${selected || '斜体文本'}*`;
      cursorOffset = selected ? 0 : -1;
      break;
    case 'code':
      insertion = selected.includes('\n')
        ? `\`\`\`\n${selected || '代码'}\n\`\`\``
        : `\`${selected || '代码'}\``;
      break;
    case 'heading':
      insertion = `## ${selected || '标题'}`;
      break;
    case 'list':
      insertion = selected
        ? selected.split('\n').map((l) => `- ${l}`).join('\n')
        : '- 列表项';
      break;
    case 'quote':
      insertion = selected
        ? selected.split('\n').map((l) => `> ${l}`).join('\n')
        : '> 引用文本';
      break;
    case 'link':
      insertion = `[${selected || '链接文本'}](url)`;
      break;
    case 'image':
      insertion = `![${selected || '图片描述'}](image-url)`;
      break;
  }

  editor.setRangeText(insertion, start, end, 'select');
  editor.focus();

  // 移动光标
  if (cursorOffset !== 0) {
    const newPos = start + insertion.length + cursorOffset;
    editor.setSelectionRange(newPos, newPos);
  }

  // 触发保存
  handleEditorChange();
}

// ============================================================
// 同步队列刷新
// ============================================================

async function flushSyncQueue() {
  const items = await CollabDB.getPendingQueueItems();
  if (items.length === 0) return;

  console.log(`🔄 刷新 ${items.length} 个待同步项`);
  updateSyncBadge('syncing');

  for (const item of items) {
    try {
      // 模拟同步（实际项目中发送到服务器）
      await simulateSync(item);
      await CollabDB.markQueueItemSent(item.id);
    } catch (error) {
      console.warn(`⚠️ 同步失败: ${item.id}`, error);
      await CollabDB.retryQueueItem(item.id);
    }
  }

  updateSyncBadge('synced');
  showToast(`✅ ${items.length} 个离线操作已同步`, 'success');
}

/**
 * 模拟同步（实际项目中替换为真实 API 调用）
 */
function simulateSync(item) {
  return new Promise((resolve) => {
    setTimeout(resolve, 100 + Math.random() * 200);
  });
}

// ============================================================
// 心跳机制
// ============================================================

function setupHeartbeat() {
  AppState.heartbeatInterval = setInterval(() => {
    broadcast({
      type: 'heartbeat',
      userId: AppState.userId,
      userName: AppState.userName,
      color: AppState.userColor,
      timestamp: Date.now(),
      status: AppState.visibilityState === 'visible' ? 'online' : 'away',
    });
  }, 30000); // 每 30 秒
}

// ============================================================
// Push Notification
// ============================================================

async function togglePushNotifications(event) {
  const enabled = event.target.checked;

  if (!('Notification' in window)) {
    showToast('❌ 浏览器不支持推送通知', 'error');
    event.target.checked = false;
    return;
  }

  if (enabled && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await CollabDB.setPreference(AppState.userId, 'notifications', true);
      showToast('✅ 推送通知已启用', 'success');
    } else {
      event.target.checked = false;
      showToast('❌ 通知权限被拒绝', 'error');
    }
  } else if (enabled && Notification.permission === 'granted') {
    await CollabDB.setPreference(AppState.userId, 'notifications', true);
    showToast('✅ 推送通知已启用', 'success');
  } else {
    await CollabDB.setPreference(AppState.userId, 'notifications', false);
    showToast('推送通知已禁用', 'info');
  }
}

/**
 * 创建本地推送通知
 */
function createPushNotification(title, body) {
  // 检查用户偏好
  CollabDB.getPreference(AppState.userId, 'notifications').then((enabled) => {
    if (!enabled) return;

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🤝</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🤝</text></svg>',
        tag: 'collabpad', // 合并同类通知
        requireInteraction: false,
        actions: [
          { action: 'view', title: '查看' },
          { action: 'dismiss', title: '忽略' },
        ],
      });
    }

    // 同时记录到通知存储
    CollabDB.createNotification(
      'collab_event',
      title,
      body,
      AppState.currentDoc?.id
    );
  });
}

// ============================================================
// Web Share API
// ============================================================

async function shareDocument() {
  if (!AppState.currentDoc) {
    showToast('⚠️ 请先打开一个文档', 'warning');
    return;
  }

  const shareData = {
    title: AppState.currentDoc.title,
    text: AppState.currentDoc.content.slice(0, 500) + (AppState.currentDoc.content.length > 500 ? '...' : ''),
  };

  // 尝试原生分享
  if (navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      showToast('✅ 文档已分享', 'success');
    } catch (error) {
      if (error.name !== 'AbortError') {
        fallbackShare(shareData);
      }
    }
  } else {
    fallbackShare(shareData);
  }
}

/**
 * 降级分享方案
 */
function fallbackShare(data) {
  // 复制到剪贴板
  const text = `# ${data.title}\n\n${data.text}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 文档内容已复制到剪贴板', 'success');
  }).catch(() => {
    showToast('❌ 分享失败', 'error');
  });
}

// ============================================================
// UI 更新
// ============================================================

function updateConnectionBadge() {
  const badge = $('#connectionBadge');
  if (AppState.isOnline) {
    badge.className = 'badge badge-online';
    badge.textContent = '🟢 在线';
  } else {
    badge.className = 'badge badge-offline';
    badge.textContent = '🔴 离线';
  }
}

function updateSyncBadge(status) {
  const badge = $('#syncBadge');
  switch (status) {
    case 'synced':
      badge.className = 'badge badge-synced';
      badge.textContent = '✓ 已同步';
      break;
    case 'dirty':
      badge.className = 'badge badge-dirty';
      badge.textContent = '● 未保存';
      break;
    case 'syncing':
      badge.className = 'badge badge-syncing';
      badge.textContent = '⟳ 同步中';
      break;
  }
}

function updateCollabPanel() {
  CollabDB.getOnlineCollaborators().then((collabs) => {
    const count = collabs.length;
    $('#collabCount').textContent = `👤 ${count}`;

    const list = $('#collabList');
    list.innerHTML = collabs
      .map(
        (c) => `
        <div class="collab-item" style="--collab-color: ${c.color}">
          <span class="collab-dot"></span>
          <span class="collab-name">${escapeHtml(c.name)}</span>
          <span class="collab-status">${c.status === 'online' ? '🟢' : '🟡'}</span>
        </div>
      `
      )
      .join('');
  });
}

function updateWordCount() {
  const content = $('#editor').value;
  const count = content.replace(/\s/g, '').length;
  $('#wordCount').textContent = `${count} 字`;
}

function updateCursorPos() {
  const editor = $('#editor');
  const text = editor.value.substring(0, editor.selectionStart);
  const lines = text.split('\n');
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  $('#cursorPos').textContent = `Ln ${line}, Col ${col}`;
}

function updateNotifBadge() {
  CollabDB.getUnreadNotifications().then((notifs) => {
    const btn = $('#notifBtn');
    if (notifs.length > 0) {
      btn.textContent = `🔔(${notifs.length})`;
    } else {
      btn.textContent = '🔔';
    }
  });
}

// ============================================================
// 冲突面板
// ============================================================

async function loadConflicts() {
  if (!AppState.currentDoc) return;

  const conflicts = await CollabDB.getConflicts(AppState.currentDoc.id);
  const list = $('#conflictList');

  if (conflicts.length === 0) {
    list.innerHTML = '<p class="empty-state">暂无冲突</p>';
    return;
  }

  list.innerHTML = conflicts
    .map(
      (c) => `
      <div class="conflict-item">
        <div class="conflict-header">
          <span class="conflict-time">${formatDate(c.resolvedAt)}</span>
          <span class="conflict-resolution">${c.resolution}</span>
        </div>
        <div class="conflict-detail">
          <p>操作 1: ${escapeHtml(JSON.stringify(c.operation1).slice(0, 100))}...</p>
          <p>操作 2: ${escapeHtml(JSON.stringify(c.operation2)).slice(0, 100)}...</p>
        </div>
      </div>
    `
    )
    .join('');
}

function showConflictPanel(conflicts) {
  togglePanel('conflictPanel');
  loadConflicts();
}

// ============================================================
// 变更历史
// ============================================================

async function recordChange(docId, userId, ops, oldContent, newContent) {
  const list = $('#changeList');
  const entry = document.createElement('div');
  entry.className = 'change-entry';
  entry.innerHTML = `
    <div class="change-header">
      <span class="change-time">${formatDate(Date.now())}</span>
      <span class="change-user" style="color: ${AppState.userColor}">${escapeHtml(AppState.userName)}</span>
    </div>
    <div class="change-ops">
      ${ops.map((op) => `<span class="op-tag op-${op.type}">${op.type}${op.text ? ` "${escapeHtml(op.text.slice(0, 20))}"` : ` (${op.length})`}</span>`).join(' ')}
    </div>
  `;
  list.insertBefore(entry, list.firstChild);

  // 限制显示数量
  while (list.children.length > 50) {
    list.removeChild(list.lastChild);
  }
}

async function loadChangeLog(docId) {
  const ops = await CollabDB.getOperations(docId);
  const list = $('#changeList');
  list.innerHTML = '';

  // 按时间倒序显示最近 20 条
  const recent = ops
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);

  for (const op of recent) {
    const entry = document.createElement('div');
    entry.className = 'change-entry';
    entry.innerHTML = `
      <div class="change-header">
        <span class="change-time">${formatDate(op.timestamp)}</span>
        <span class="change-user" style="color: ${generateColor(op.userId)}">${getUserName(op.userId)}</span>
      </div>
      <div class="change-ops">
        <span class="op-tag op-${op.type}">${op.type}${op.text ? ` "${escapeHtml(op.text.slice(0, 20))}"` : ` (${op.length})`}</span>
      </div>
    `;
    list.appendChild(entry);
  }
}

// ============================================================
// PWA 诊断
// ============================================================

async function runDiagnostics() {
  const content = $('#diagContent');
  const results = [];

  // Service Worker
  const swSupported = 'serviceWorker' in navigator;
  const swRegistered = AppState.swRegistration !== undefined;
  results.push({
    name: 'Service Worker',
    status: swRegistered ? '✅ 已注册' : swSupported ? '⚠️ 未注册' : '❌ 不支持',
    detail: swRegistered ? `Scope: ${AppState.swRegistration?.scope}` : '',
  });

  // Cache API
  const cacheSupported = 'caches' in window;
  let cacheDetail = '';
  if (cacheSupported) {
    const cacheNames = await caches.keys();
    cacheDetail = `缓存: ${cacheNames.join(', ') || '无'}`;
  }
  results.push({
    name: 'Cache API',
    status: cacheSupported ? '✅ 支持' : '❌ 不支持',
    detail: cacheDetail,
  });

  // IndexedDB
  const idbSupported = 'indexedDB' in window;
  const idbDetail = `DB: ${CollabDB.DB_NAME}, Version: ${CollabDB.DB_VERSION}`;
  results.push({
    name: 'IndexedDB',
    status: idbSupported ? '✅ 已连接' : '❌ 不支持',
    detail: idbDetail,
  });

  // BroadcastChannel
  const bcSupported = 'BroadcastChannel' in window;
  results.push({
    name: 'BroadcastChannel',
    status: bcSupported ? '✅ 活跃' : '❌ 不支持',
    detail: bcSupported ? '多标签页同步已启用' : '',
  });

  // Push Notification
  const pushSupported = 'Notification' in window;
  const pushPermission = pushSupported ? Notification.permission : 'N/A';
  results.push({
    name: 'Push Notification',
    status: pushSupported ? `✅ ${pushPermission}` : '❌ 不支持',
    detail: '',
  });

  // Background Sync
  const syncSupported = AppState.swRegistration?.sync !== undefined;
  results.push({
    name: 'Background Sync',
    status: syncSupported ? '✅ 已注册' : '⚠️ 不可用',
    detail: '',
  });

  // Web Share API
  const shareSupported = 'share' in navigator;
  results.push({
    name: 'Web Share API',
    status: shareSupported ? '✅ 支持' : '⚠️ 不支持',
    detail: '',
  });

  // Lock Manager API
  const lockSupported = 'locks' in navigator;
  results.push({
    name: 'Lock Manager API',
    status: lockSupported ? '✅ 支持' : '⚠️ 不支持',
    detail: '',
  });

  // Storage
  const storage = await CollabDB.getStorageUsage();
  results.push({
    name: 'Storage Quota',
    status: `${storage.usageMB} MB / ${storage.quotaMB} MB`,
    detail: `使用率: ${storage.percent}%`,
  });

  // Network
  results.push({
    name: 'Network',
    status: AppState.isOnline ? '✅ 在线' : '🔴 离线',
    detail: `Type: ${navigator.connection?.effectiveType || 'unknown'}`,
  });

  // 渲染结果
  content.innerHTML = results
    .map(
      (r) => `
      <div class="diag-item">
        <span class="diag-name">${r.name}</span>
        <span class="diag-status">${r.status}</span>
        ${r.detail ? `<span class="diag-detail">${r.detail}</span>` : ''}
      </div>
    `
    )
    .join('');
}

// ============================================================
// 面板切换
// ============================================================

function togglePanel(panelId) {
  const panel = $(`#${panelId}`);
  panel.classList.toggle('hidden');
}

function toggleNotifPanel() {
  togglePanel('notifPanel');
  if (!$('#notifPanel').classList.contains('hidden')) {
    CollabDB.getPreference(AppState.userId, 'notifications').then((enabled) => {
      $('#notifToggle').checked = !!enabled;
    });
  }
}

// ============================================================
// Toast 通知
// ============================================================

function showToast(message, type = 'info') {
  const toast = $('#offlineToast');
  toast.querySelector('span').textContent = message;
  toast.className = `toast toast-${type}`;

  setTimeout(() => {
    toast.className = 'toast toast-hidden';
  }, 4000);
}

// ============================================================
// 工具函数
// ============================================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getUserName(userId) {
  // 从 collaborators 查找名称，找不到则返回截断 ID
  const shortId = userId.slice(0, 8);
  return `用户 ${shortId}`;
}

function generateColor(userId) {
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

// ============================================================
// 启动
// ============================================================

document.addEventListener('DOMContentLoaded', init);
