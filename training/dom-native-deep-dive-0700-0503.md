# 原生 DOM API 深度练习 — 事件委托 / DOM Diff / 性能优化

> 专项训练 07:00 | 2026-05-03 | 12+ 完整示例

---

## 一、事件委托 (Event Delegation)

### 示例 1: 通用事件委托 — 动态列表

```js
/**
 * 原生事件委托：利用事件冒泡，父元素统一处理子元素事件
 * 场景：动态增删的列表项，每个 item 有删除/编辑按钮
 */
function createEventDelegatedList(containerSelector) {
  const container = document.querySelector(containerSelector);

  // 一次绑定，所有子元素事件统一处理
  container.addEventListener('click', (e) => {
    // 向上查找匹配的目标元素
    const deleteBtn = e.target.closest('.item-delete');
    const editBtn = e.target.closest('.item-edit');
    const item = e.target.closest('.list-item');

    if (deleteBtn && item) {
      const id = item.dataset.id;
      console.log(`[委托] 删除 item ${id}`);
      item.remove();
    } else if (editBtn && item) {
      const id = item.dataset.id;
      console.log(`[委托] 编辑 item ${id}`);
      // 切换编辑态
      item.classList.toggle('editing');
    } else if (item) {
      console.log(`[委托] 点击 item ${item.dataset.id}`);
    }
  });

  return {
    addItem(id, text) {
      const li = document.createElement('li');
      li.className = 'list-item';
      li.dataset.id = id;
      li.innerHTML = `<span>${text}</span>
        <button class="item-edit">编辑</button>
        <button class="item-delete">删除</button>`;
      container.appendChild(li);
    },
  };
}

// 使用
const list = createEventDelegatedList('#my-list');
list.addItem('1', '学习 DOM');
list.addItem('2', '练习事件委托');
// 即使后续动态添加的 item，事件也自动生效 —— 这就是委托的核心价值
```

**关键要点:**
- `closest()` 向上查找最近匹配祖先，比手动 `target.tagName` 判断更优雅
- 一次 `addEventListener` 替代 N 次绑定，内存占用 O(1) 而非 O(n)
- 动态添加/删除子元素无需重新绑定事件

---

### 示例 2: 事件委托 + 键盘事件 (表格操作)

```js
/**
 * 键盘事件委托：表格中每个单元格支持快捷键操作
 * 场景：数据表格，Enter 编辑，Delete 删除行，Ctrl+S 保存
 */
function createKeyboardDelegatedTable(tableSelector) {
  const table = document.querySelector(tableSelector);

  table.addEventListener('keydown', (e) => {
    const cell = e.target.closest('td, th');
    const row = e.target.closest('tr');
    if (!cell) return; // 非表格区域，忽略

    switch (e.key) {
      case 'Enter':
        if (!e.target.isContentEditable) {
          e.preventDefault();
          cell.contentEditable = true;
          cell.focus();
          console.log('[委托] Enter → 进入编辑模式');
        }
        break;

      case 'Delete':
        if (e.target === cell) {
          e.preventDefault();
          row?.remove();
          console.log('[委托] Delete → 删除行');
        }
        break;

      case 's':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          console.log('[委托] Ctrl+S → 保存数据');
          // 收集所有单元格数据
          const data = [...table.querySelectorAll('tr')].map(tr =>
            [...tr.querySelectorAll('td')].map(td => td.textContent)
          );
          console.log('表格数据:', JSON.stringify(data));
        }
        break;
    }
  });

  // 失焦时退出编辑
  table.addEventListener('blur', (e) => {
    if (e.target.isContentEditable) {
      e.target.contentEditable = false;
    }
  }, true); // 捕获阶段
}
```

**关键要点:**
- 键盘事件委托比鼠标事件更需要注意 `e.target` 判断
- `contentEditable` 配合事件委托实现原地编辑
- 捕获阶段 (`true`) 处理 blur，确保编辑态正确退出

---

### 示例 3: 多级事件委托 + 事件优先级

```js
/**
 * 多级事件委托：复杂 UI 组件的事件优先级管理
 * 场景：卡片列表 → 卡片内有按钮 → 按钮内有图标
 * 不同层级触发不同行为，且互不冲突
 */
function createMultiLevelDelegation(containerSelector) {
  const container = document.querySelector(containerSelector);

  // 事件优先级配置
  const handlers = [
    { selector: '.card-action-btn', priority: 100, handler: (e, el) => {
      console.log(`[优先级100] 卡片操作: ${el.dataset.action}`);
      e.stopPropagation(); // 阻止冒泡到卡片层
    }},
    { selector: '.card-tag', priority: 50, handler: (e, el) => {
      console.log(`[优先级50] 标签点击: ${el.textContent}`);
    }},
    { selector: '.card', priority: 10, handler: (e, el) => {
      console.log(`[优先级10] 卡片展开: ${el.dataset.title}`);
      el.classList.toggle('expanded');
    }},
  ];

  container.addEventListener('click', (e) => {
    // 按优先级排序匹配
    const matched = handlers
      .map(h => {
        const el = e.target.closest(h.selector);
        return el ? { ...h, el } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.priority - a.priority)[0]; // 取最高优先级

    if (matched) {
      matched.handler(e, matched.el);
    }
  });

  return {
    addCard(title, tags, actions) {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.title = title;
      card.innerHTML = `
        <h3>${title}</h3>
        <div class="card-tags">
          ${tags.map(t => `<span class="card-tag">${t}</span>`).join('')}
        </div>
        <div class="card-actions">
          ${actions.map(a =>
            `<button class="card-action-btn" data-action="${a}">${a}</button>`
          ).join('')}
        </div>`;
      container.appendChild(card);
    },
  };
}

// 使用
const cards = createMultiLevelDelegation('#card-container');
cards.addCard('Vue 3 源码', ['前端', '框架'], ['收藏', '分享']);
// 点击按钮 → 优先级100，stopPropagation 阻止冒泡
// 点击标签 → 优先级50，冒泡到卡片层但卡片层 selector 不匹配
// 点击卡片空白 → 优先级10，展开/折叠
```

**关键要点:**
- 优先级系统解决嵌套元素的冲突问题
- `stopPropagation()` 在需要时阻断冒泡链
- 匹配逻辑与优先级分离，易于扩展

---

## 二、DOM Diff 算法

### 示例 4: 简易 DOM Diff — 树对比

```js
/**
 * 手写简易 DOM Diff 算法
 * 对比新旧虚拟 DOM 树，生成最小操作补丁
 * 核心思路：先对比节点类型，再对比属性，最后递归对比子节点
 */

// 虚拟节点定义
function h(tag, props = {}, children = []) {
  return { tag, props, children };
}

// Diff 结果类型
const PatchType = {
  REPLACE: 'REPLACE',       // 替换整个节点
  TEXT: 'TEXT',             // 文本变化
  ATTRS: 'ATTRS',           // 属性变化
  REORDER: 'REORDER',       // 子节点重排
  NOOP: 'NOOP',             // 无变化
};

function diff(oldVNode, newVNode) {
  const patches = [];

  function _diff(oldNode, newNode, index) {
    // 情况1: 节点类型不同 → 替换
    if (!oldNode || !newNode) {
      patches.push({ index, type: PatchType.REPLACE, node: newNode });
      return;
    }
    if (typeof oldNode !== typeof newNode) {
      patches.push({ index, type: PatchType.REPLACE, node: newNode });
      return;
    }

    // 情况2: 文本节点
    if (typeof oldNode === 'string') {
      if (oldNode !== newNode) {
        patches.push({ index, type: PatchType.TEXT, text: newNode });
      }
      return;
    }

    // 情况3: tag 不同 → 替换
    if (oldNode.tag !== newNode.tag) {
      patches.push({ index, type: PatchType.REPLACE, node: newNode });
      return;
    }

    // 情况4: 属性对比
    const attrPatches = diffAttrs(oldNode.props, newNode.props);
    if (Object.keys(attrPatches).length > 0) {
      patches.push({ index, type: PatchType.ATTRS, attrs: attrPatches });
    }

    // 情况5: 子节点对比 (简化版 key-based diff)
    diffChildren(oldNode.children, newNode.children, index, patches);
  }

  _diff(oldVNode, newVNode, 0);
  return patches;
}

function diffAttrs(oldAttrs, newAttrs) {
  const changes = {};
  const allKeys = new Set([...Object.keys(oldAttrs || {}), ...Object.keys(newAttrs || {})]);

  for (const key of allKeys) {
    if (oldAttrs?.[key] !== newAttrs?.[key]) {
      changes[key] = {
        old: oldAttrs?.[key],
        new: newAttrs?.[key],
      };
    }
  }
  return changes;
}

function diffChildren(oldChildren, newChildren, parentIndex, patches) {
  const oldLen = oldChildren?.length || 0;
  const newLen = newChildren?.length || 0;
  const maxLen = Math.max(oldLen, newLen);

  for (let i = 0; i < maxLen; i++) {
    const childIndex = parentIndex * 100 + i + 1; // 简化索引
    _diff(
      oldChildren?.[i],
      newChildren?.[i],
      childIndex
    );
  }
}

// 测试
const oldTree = h('ul', { id: 'list' }, [
  h('li', { key: 'a' }, ['Apple']),
  h('li', { key: 'b' }, ['Banana']),
  h('li', { key: 'c' }, ['Cherry']),
]);

const newTree = h('ul', { id: 'list', class: 'fruits' }, [
  h('li', { key: 'c' }, ['Cherry']), // 移到前面
  h('li', { key: 'a' }, ['Apple 🍎']), // 文本变了
  h('li', { key: 'd' }, ['Durian']), // 新增
]);

const patches = diff(oldTree, newTree);
console.log('Diff patches:', JSON.stringify(patches, null, 2));
// 输出:
// [
//   { index: 0, type: 'ATTRS', attrs: { class: { old: undefined, new: 'fruits' } } },
//   { index: 1, type: 'REPLACE', node: { tag: 'li', ... } }, // b → c (简化版无 key 感知)
//   ...
// ]
```

**关键要点:**
- Diff 三原则：同类型对比、不同则替换、递归子节点
- 简化版未实现 key-based 重排，真实框架会做 LCS 最长公共子序列
- patches 是"操作指令"，实际 apply 时需要遍历 DOM 执行

---

### 示例 5: 带 Key 的 DOM Diff (LCS 算法)

```js
/**
 * 带 Key 的 DOM Diff — 基于 LCS (最长公共子序列)
 * 这是 React/Vue 子节点 diff 的核心思想简化版
 */

function diffWithKey(oldChildren, newChildren) {
  const oldKeyed = new Map();
  const newKeyed = new Map();

  oldChildren.forEach((child, i) => {
    if (child?.props?.key) oldKeyed.set(child.props.key, { node: child, index: i });
  });
  newChildren.forEach((child, i) => {
    if (child?.props?.key) newKeyed.set(child.props.key, { node: child, index: i });
  });

  const operations = [];

  // 1. 找出需要删除的旧节点 (在新列表中不存在)
  for (const [key, { index }] of oldKeyed) {
    if (!newKeyed.has(key)) {
      operations.push({ type: 'REMOVE', key, oldIndex: index });
    }
  }

  // 2. 找出需要新增的节点 (在旧列表中不存在)
  for (const [key, { node, index }] of newKeyed) {
    if (!oldKeyed.has(key)) {
      operations.push({ type: 'ADD', key, node, newIndex: index });
    }
  }

  // 3. 找出需要移动的节点 (key 相同但 index 变了)
  // 使用 LCS 找出不需要移动的节点
  const oldKeys = oldChildren.map(c => c?.props?.key).filter(Boolean);
  const newKeys = newChildren.map(c => c?.props?.key).filter(Boolean);
  const lcs = longestCommonSubsequence(oldKeys, newKeys);
  const lcsSet = new Set(lcs);

  for (const [key, { index: newIndex }] of newKeyed) {
    if (!lcsSet.has(key) && oldKeyed.has(key)) {
      operations.push({
        type: 'MOVE',
        key,
        oldIndex: oldKeyed.get(key).index,
        newIndex,
      });
    }
  }

  return operations;
}

/**
 * LCS 最长公共子序列 (动态规划)
 * 找出两个序列中最长的公共子序列
 */
function longestCommonSubsequence(A, B) {
  const m = A.length, n = B.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  // 填表
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (A[i - 1] === B[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯找 LCS
  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (A[i - 1] === B[j - 1]) {
      result.unshift(A[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

// 测试
const oldList = [
  { tag: 'li', props: { key: 'a' }, children: ['Apple'] },
  { tag: 'li', props: { key: 'b' }, children: ['Banana'] },
  { tag: 'li', props: { key: 'c' }, children: ['Cherry'] },
  { tag: 'li', props: { key: 'd' }, children: ['Durian'] },
];

const newList = [
  { tag: 'li', props: { key: 'c' }, children: ['Cherry'] }, // 移到前面
  { tag: 'li', props: { key: 'a' }, children: ['Apple 🍎'] }, // 文本变
  { tag: 'li', props: { key: 'e' }, children: ['Elderberry'] }, // 新增
  { tag: 'li', props: { key: 'd' }, children: ['Durian'] },
];
// b 被删除, c 前移, a 文本变, e 新增

const ops = diffWithKey(oldList, newList);
console.log('Key-based diff operations:');
ops.forEach(op => console.log(`  ${op.type}: ${op.key}`));
// REMOVE: b
// ADD: e
// MOVE: c (3→0), a (0→1)
// LCS: ['a', 'd'] — 这两个不需要移动
```

**关键要点:**
- LCS 找出"不需要动"的节点，其余需要 MOVE
- 时间复杂度 O(m×n)，m/n 为新旧子节点数
- Vue 3 的 diff 在此基础上做了双端对比、快速路径等优化

---

### 示例 6: 真实 DOM Patch 应用 — 将 Diff 结果应用到页面

```js
/**
 * 将 diff patches 应用到真实 DOM
 * 模拟虚拟 DOM → 真实 DOM 的更新过程
 */

function applyPatches(root, patches, newTree) {
  // 构建索引到节点的映射
  const nodeMap = new Map();
  function indexNode(node, index) {
    nodeMap.set(index, node);
    let childIndex = index * 100 + 1;
    for (const child of (node.children || [])) {
      indexNode(child, childIndex++);
    }
  }
  indexNode(root, 0);

  // 应用补丁
  for (const patch of patches) {
    const target = nodeMap.get(patch.index);
    if (!target) continue;

    switch (patch.type) {
      case PatchType.REPLACE:
        replaceNode(target, patch.node);
        break;

      case PatchType.TEXT:
        target.textContent = patch.text;
        break;

      case PatchType.ATTRS:
        applyAttrs(target, patch.attrs);
        break;

      case PatchType.REORDER:
        reorderChildren(target, patch.moves);
        break;
    }
  }
}

function replaceNode(domNode, vNode) {
  if (typeof vNode === 'string') {
    domNode.replaceWith(document.createTextNode(vNode));
    return;
  }
  const newEl = document.createElement(vNode.tag);
  applyAttrs(newEl, vNode.props || {});
  for (const child of (vNode.children || [])) {
    if (typeof child === 'string') {
      newEl.appendChild(document.createTextNode(child));
    } else {
      newEl.appendChild(replaceNode(null, child));
    }
  }
  domNode.replaceWith(newEl);
  return newEl;
}

function applyAttrs(el, attrs) {
  for (const [key, { old: _, new: newVal }] of Object.entries(attrs)) {
    if (newVal === undefined || newVal === null) {
      el.removeAttribute(key);
    } else if (key === 'className') {
      el.className = newVal;
    } else if (key === 'style' && typeof newVal === 'object') {
      Object.assign(el.style, newVal);
    } else {
      el.setAttribute(key, newVal);
    }
  }
}

// 完整演示: vDOM → DOM → Diff → Patch
function demoPatch() {
  // 1. 初始渲染
  const container = document.createElement('div');
  const initialTree = h('div', { id: 'app' }, [
    h('h1', { class: 'title' }, ['Hello']),
    h('ul', null, [
      h('li', null, ['Item 1']),
      h('li', null, ['Item 2']),
    ]),
  ]);

  function render(vNode, parent) {
    if (typeof vNode === 'string') {
      return document.createTextNode(vNode);
    }
    const el = document.createElement(vNode.tag);
    applyAttrs(el, vNode.props);
    for (const child of vNode.children) {
      el.appendChild(render(child, el));
    }
    parent.appendChild(el);
    return el;
  }

  render(initialTree, container);
  console.log('初始 DOM:', container.innerHTML);

  // 2. 更新后的虚拟 DOM
  const updatedTree = h('div', { id: 'app' }, [
    h('h1', { class: 'title active' }, ['Hello World']), // class 和文本都变了
    h('ul', null, [
      h('li', null, ['Item 1']),
      h('li', null, ['Item 2']),
      h('li', null, ['Item 3']), // 新增
    ]),
  ]);

  // 3. Diff
  const patches = diff(initialTree, updatedTree);
  console.log('Patches:', patches.length, '个');

  // 4. Apply (简化: 直接重新渲染，真实场景会精准 patch)
  container.innerHTML = '';
  render(updatedTree, container);
  console.log('更新后 DOM:', container.innerHTML);
}
```

---

## 三、性能优化

### 示例 7: DocumentFragment — 批量插入优化

```js
/**
 * DocumentFragment 批量插入 vs 逐个插入
 * 对比: 直接 appendChild × N vs DocumentFragment 一次插入
 */

function benchmarkInsertMethods(count = 10000) {
  const results = {};

  // 方法1: 逐个 appendChild (触发 N 次重排)
  function method1() {
    const container = document.createElement('div');
    const start = performance.now();
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.textContent = `Item ${i}`;
      container.appendChild(el); // 每次都可能触发重排
    }
    results.individual = performance.now() - start;
  }

  // 方法2: DocumentFragment (只触发 1 次重排)
  function method2() {
    const container = document.createElement('div');
    const fragment = document.createDocumentFragment();
    const start = performance.now();
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.textContent = `Item ${i}`;
      fragment.appendChild(el); // fragment 不在 DOM 树中，不触发重排
    }
    container.appendChild(fragment); // 一次插入，触发 1 次重排
    results.fragment = performance.now() - start;
  }

  // 方法3: innerHTML 批量设置
  function method3() {
    const container = document.createElement('div');
    const start = performance.now();
    const html = Array.from({ length: count }, (_, i) =>
      `<div>Item ${i}</div>`
    ).join('');
    container.innerHTML = html;
    results.innerHTML = performance.now() - start;
  }

  // 方法4: 预构建 HTML 字符串 + insertAdjacentHTML
  function method4() {
    const container = document.createElement('div');
    const start = performance.now();
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `<div>Item ${i}</div>`;
    }
    container.insertAdjacentHTML('beforeend', html);
    results.insertAdjacent = performance.now() - start;
  }

  method1(); method2(); method3(); method4();

  console.log(`插入 ${count} 个元素耗时:`);
  console.log(`  逐个 appendChild:    ${results.individual.toFixed(2)}ms`);
  console.log(`  DocumentFragment:    ${results.fragment.toFixed(2)}ms`);
  console.log(`  innerHTML:           ${results.innerHTML.toFixed(2)}ms`);
  console.log(`  insertAdjacentHTML:  ${results.insertAdjacent.toFixed(2)}ms`);
  console.log(`  Fragment 相比逐个:  ${(results.individual / results.fragment).toFixed(1)}x 快`);

  return results;
}

// 通用批量插入工具
function batchAppend(parent, items, renderItem) {
  const fragment = document.createDocumentFragment();
  for (const item of items) {
    fragment.appendChild(renderItem(item));
  }
  parent.appendChild(fragment);
}

// 使用
// batchAppend(document.getElementById('list'), dataArray, item => {
//   const li = document.createElement('li');
//   li.textContent = item.name;
//   return li;
// });
```

**关键要点:**
- DocumentFragment 不在 DOM 树中，操作它不会触发重排
- innerHTML 通常最快但需注意 XSS
- 性能排序 (通常): innerHTML > insertAdjacentHTML > DocumentFragment > 逐个 append

---

### 示例 8: 防抖 + 节流 — 滚动/resize 事件优化

```js
/**
 * 高频事件优化: 防抖 (debounce) vs 节流 (throttle)
 * 场景: scroll, resize, mousemove, input 事件
 */

// 防抖: 连续触发只执行最后一次
function debounce(fn, delay, options = {}) {
  const { leading = false, trailing = true, maxWait } = options;
  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  let lastCallTime = 0;
  let invokeTime = 0;

  function invokeFunc() {
    const args = lastArgs;
    const context = lastThis;
    lastArgs = lastThis = null;
    invokeTime = Date.now();
    fn.apply(context, args);
  }

  function startTimer(timerId, wait) {
    return setTimeout(timerId, wait);
  }

  function shouldInvoke() {
    const timeSinceLastCall = Date.now() - lastCallTime;
    return (
      lastCallTime === 0 ||
      timeSinceLastCall >= delay ||
      (maxWait && timeSinceLastCall >= maxWait)
    );
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;
    lastCallTime = Date.now();
    const isImmediateCall = leading && !timer;

    if (isImmediateCall) {
      invokeFunc();
    } else if (!timer) {
      timer = startTimer(timerExpired, delay);
    }
  }

  function timerExpired() {
    const timeSinceLastCall = Date.now() - lastCallTime;
    if (timeSinceLastCall < delay) {
      timer = startTimer(timerExpired, delay - timeSinceLastCall);
    } else {
      if (trailing && lastArgs) {
        invokeFunc();
      }
      timer = null;
    }
  }

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = lastArgs = lastThis = null;
  };

  debounced.flush = () => {
    if (timer && lastArgs) {
      clearTimeout(timer);
      timer = null;
      invokeFunc();
    }
  };

  return debounced;
}

// 节流: 固定间隔内最多执行一次
function throttle(fn, interval, options = {}) {
  const { leading = true, trailing = false } = options;
  let lastTime = 0;
  let timer = null;

  function throttled(...args) {
    const now = Date.now();
    const remaining = interval - (now - lastTime);

    if (lastTime === 0 && !leading) {
      lastTime = now;
      return;
    }

    if (remaining <= 0 || remaining > interval) {
      if (timer) { clearTimeout(timer); timer = null; }
      lastTime = now;
      fn.apply(this, args);
    } else if (trailing && !timer) {
      timer = setTimeout(() => {
        lastTime = options.leading === false ? 0 : Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  }

  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastTime = 0;
  };

  return throttled;
}

// 实际场景应用
function setupOptimizedEvents() {
  // 场景1: 搜索输入 — 防抖
  const searchInput = document.getElementById('search');
  const onSearch = debounce((e) => {
    console.log('搜索:', e.target.value);
    // fetch 请求
  }, 300);
  searchInput?.addEventListener('input', onSearch);

  // 场景2: 窗口 resize — 节流
  const onResize = throttle(() => {
    console.log('窗口大小:', window.innerWidth, window.innerHeight);
    // 重新计算布局
  }, 100);
  window.addEventListener('resize', onResize);

  // 场景3: 滚动加载 — 节流 + trailing
  const onScroll = throttle(() => {
    const scrollY = window.scrollY;
    const height = document.body.scrollHeight;
    const clientH = window.innerHeight;
    if (scrollY + clientH >= height - 200) {
      console.log('触发加载更多');
      // loadMore()
    }
  }, 150, { trailing: true });
  window.addEventListener('scroll', onScroll);

  // 场景4: 鼠标移动 — 防抖 (leading)
  const onMouseMove = debounce((e) => {
    console.log('鼠标位置:', e.clientX, e.clientY);
  }, 50, { leading: true, trailing: false });
  document.addEventListener('mousemove', onMouseMove);
}
```

**关键要点:**
- 防抖 = "等你停了我再执行" (搜索、窗口 resize 后)
- 节流 = "每隔一段时间执行一次" (滚动、鼠标移动)
- leading/trailing 控制首尾执行时机
- `maxWait` 保证防抖不会无限延迟

---

### 示例 9: requestAnimationFrame — 动画与渲染优化

```js
/**
 * requestAnimationFrame (rAF) 优化动画和 DOM 操作
 * 核心: 与浏览器刷新率同步 (通常 60fps)，避免掉帧
 */

// 场景1: 平滑滚动动画
function smoothScrollTo(targetY, duration = 500) {
  const startY = window.scrollY;
  const diff = targetY - startY;
  let startTime = null;

  // easeInOutCubic 缓动函数
  const ease = (t) => t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = ease(progress);

    window.scrollTo(0, startY + diff * easedProgress);

    if (progress < 1) {
      requestAnimationFrame(step); // 下一帧继续
    }
  }

  requestAnimationFrame(step);
}

// 场景2: 高性能粒子动画
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.running = false;
    this.rafId = null;
  }

  addParticle(x, y, vx, vy, color, size) {
    this.particles.push({ x, y, vx, vy, color, size, life: 1.0 });
  }

  start() {
    this.running = true;
    const loop = (timestamp) => {
      if (!this.running) return;

      // 1. 清除画布
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // 2. 更新 + 绘制
      this.particles = this.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // 重力
        p.life -= 0.01;

        if (p.life <= 0) return false;

        this.ctx.globalAlpha = p.life;
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
        return true;
      });

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}

// 场景3: 批量 DOM 读写分离 (避免 Layout Thrashing)
function avoidLayoutThrashing() {
  const items = document.querySelectorAll('.item');

  // ❌ 错误: 读写交替，强制同步布局
  items.forEach(item => {
    const height = item.offsetHeight; // 读 → 可能触发重排
    item.style.height = `${height * 1.1}px`; // 写 → 标记重排
  });
  // 每次循环都可能触发重排 → N 次重排

  // ✅ 正确: 先读后写 (rAF 保证在渲染帧内)
  requestAnimationFrame(() => {
    // 阶段1: 全部读取
    const heights = [...items].map(item => item.offsetHeight);

    // 阶段2: 全部写入
    items.forEach((item, i) => {
      item.style.height = `${heights[i] * 1.1}px`;
    });
  });
  // 只触发 1 次重排
}

// 场景4: 长任务分片 (类似 React 时间切片)
function scheduleChunks(tasks, chunkSize = 50, onProgress) {
  let index = 0;
  const total = tasks.length;

  function processChunk() {
    const end = Math.min(index + chunkSize, total);

    while (index < end) {
      tasks[index]();
      index++;
    }

    if (onProgress) onProgress(index, total);

    if (index < total) {
      requestAnimationFrame(processChunk); // 下一帧继续
    }
  }

  requestAnimationFrame(processChunk);
}

// 使用
// scheduleChunks(
//   largeArray.map(item => () => processItem(item)),
//   100,
//   (done, total) => console.log(`进度: ${done}/${total}`)
// );
```

**关键要点:**
- rAF 在浏览器重绘前执行，保证动画流畅
- 读写分离避免 Layout Thrashing (强制同步布局)
- 长任务分片避免阻塞主线程，保持 UI 响应

---

### 示例 10: IntersectionObserver — 懒加载与可见性检测

```js
/**
 * IntersectionObserver — 异步检测元素可见性
 * 替代 scroll 事件监听，性能更好 (浏览器原生优化)
 */

// 场景1: 图片懒加载
function lazyLoadImages(container, options = {}) {
  const { rootMargin = '200px', threshold = 0.01 } = options;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        // data-src 存真实 URL，src 存占位图
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        observer.unobserve(img); // 加载后停止观察
      }
    });
  }, { rootMargin, threshold });

  // 观察所有懒加载图片
  const images = container.querySelectorAll('img[data-src]');
  images.forEach(img => observer.observe(img));

  return observer;
}

// 场景2: 无限滚动 (滚动加载)
function infiniteScroll(container, loader, onLoadMore) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !loader.dataset.loading) {
        loader.dataset.loading = 'true';
        onLoadMore().finally(() => {
          loader.dataset.loading = 'false';
        });
      }
    });
  }, { rootMargin: '100px' });

  observer.observe(loader);
  return observer;
}

// 场景3: 元素进入/离开视口动画
function animateOnEnter(selector, animationClass, options = {}) {
  const { threshold = 0.2, once = true } = options;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add(animationClass);
        if (once) observer.unobserve(entry.target);
      } else if (!once) {
        entry.target.classList.remove(animationClass);
      }
    });
  }, { threshold });

  document.querySelectorAll(selector).forEach(el => observer.observe(el));
  return observer;
}

// 场景4: 广告曝光统计
function trackAdImpressions() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const adId = entry.target.dataset.adId;
        const ratio = Math.round(entry.intersectionRatio * 100);
        console.log(`[曝光] 广告 ${adId} 可见 ${ratio}%`);

        // 可见度 ≥ 50% 且持续 ≥ 1 秒才算有效曝光
        if (ratio >= 50) {
          const startTime = Date.now();
          const checkDuration = () => {
            if (entry.isIntersecting) {
              if (Date.now() - startTime >= 1000) {
                console.log(`[有效曝光] 广告 ${adId}`);
                // sendToAnalytics(adId)
                observer.unobserve(entry.target);
              } else {
                requestAnimationFrame(checkDuration);
              }
            }
          };
          requestAnimationFrame(checkDuration);
        }
      }
    });
  }, { threshold: [0, 0.25, 0.5, 0.75, 1.0] });

  document.querySelectorAll('.ad-unit').forEach(el => observer.observe(el));
}
```

**关键要点:**
- IntersectionObserver 异步执行，不阻塞主线程
- 比 scroll 事件性能好 10-100 倍 (浏览器内部优化)
- `rootMargin` 可提前触发 (预加载)
- `threshold` 控制触发精度

---

### 示例 11: 虚拟列表 (Virtual Scroller) — 大数据渲染优化

```js
/**
 * 虚拟列表: 只渲染可视区域内的 DOM 节点
 * 场景: 10 万条数据，只渲染 ~20 个可见 item
 * 核心: 计算可视范围 → 只创建可见 DOM → 滚动时动态更新
 */

class VirtualScroller {
  constructor(container, options) {
    this.container = container;
    this.itemHeight = options.itemHeight;
    this.buffer = options.buffer || 5; // 缓冲区 item 数
    this.data = options.data || [];
    this.renderItem = options.renderItem;

    this.scrollTop = 0;
    this.visibleCount = Math.ceil(container.clientHeight / this.itemHeight);

    // 总高度占位
    this.placeholder = document.createElement('div');
    this.placeholder.style.height = `${this.data.length * this.itemHeight}px`;
    this.placeholder.style.position = 'relative';
    this.container.innerHTML = '';
    this.container.appendChild(this.placeholder);

    // 实际渲染容器
    this.content = document.createElement('div');
    this.content.style.position = 'absolute';
    this.content.style.top = '0';
    this.content.style.left = '0';
    this.content.style.right = '0';
    this.placeholder.appendChild(this.content);

    this._onScroll = this._onScroll.bind(this);
    this.container.addEventListener('scroll', this._onScroll);

    this._render();
  }

  _onScroll() {
    this.scrollTop = this.container.scrollTop;
    // rAF 节流
    if (!this._rafPending) {
      this._rafPending = true;
      requestAnimationFrame(() => {
        this._render();
        this._rafPending = false;
      });
    }
  }

  _render() {
    const startIdx = Math.max(
      0,
      Math.floor(this.scrollTop / this.itemHeight) - this.buffer
    );
    const endIdx = Math.min(
      this.data.length,
      startIdx + this.visibleCount + this.buffer * 2
    );

    const offsetTop = startIdx * this.itemHeight;
    this.content.style.transform = `translateY(${offsetTop}px)`;

    // 只更新需要变化的 item
    const neededCount = endIdx - startIdx;
    const currentCount = this.content.children.length;

    // 添加或移除 DOM
    while (this.content.children.length < neededCount) {
      const idx = startIdx + this.content.children.length;
      this.content.appendChild(this.renderItem(this.data[idx], idx));
    }
    while (this.content.children.length > neededCount) {
      this.content.removeChild(this.content.lastChild);
    }

    // 更新已有 item 的内容 (复用 DOM)
    for (let i = 0; i < neededCount; i++) {
      const child = this.content.children[i];
      const dataIdx = startIdx + i;
      this.renderItem(this.data[dataIdx], dataIdx, child);
    }
  }

  updateData(data) {
    this.data = data;
    this.placeholder.style.height = `${data.length * this.itemHeight}px`;
    this._render();
  }

  destroy() {
    this.container.removeEventListener('scroll', this._onScroll);
  }
}

// 使用示例
function createVirtualListDemo() {
  // 生成 10 万条数据
  const data = Array.from({ length: 100000 }, (_, i) => ({
    id: i,
    title: `项目 ${i + 1}`,
    description: `这是第 ${i + 1} 条数据的描述`,
  }));

  const container = document.getElementById('virtual-list');
  if (!container) return;

  container.style.height = '500px';
  container.style.overflow = 'auto';

  const scroller = new VirtualScroller(container, {
    itemHeight: 50,
    buffer: 5,
    data,
    renderItem(item, index, existingEl) {
      if (existingEl) {
        // 复用: 只更新内容
        existingEl.querySelector('.title').textContent = item.title;
        existingEl.querySelector('.desc').textContent = item.description;
        return existingEl;
      }
      // 新建
      const el = document.createElement('div');
      el.style.height = '50px';
      el.style.lineHeight = '50px';
      el.style.padding = '0 16px';
      el.style.borderBottom = '1px solid #eee';
      el.innerHTML = `
        <span class="title" style="font-weight:bold">${item.title}</span>
        <span class="desc" style="color:#999;margin-left:16px">${item.description}</span>
      `;
      return el;
    },
  });

  console.log(`虚拟列表已创建: ${data.length} 条数据, 实际渲染 ~${scroller.visibleCount} 个 DOM`);
  return scroller;
}
```

**关键要点:**
- 10 万条数据 → 只渲染 ~20 个 DOM 节点
- DOM 复用: 滚动时更新内容而非重建
- rAF 节流 scroll 事件
- 缓冲区保证快速滚动时不出现白屏

---

### 示例 12: CSS 渲染优化 — willChange / transform / contain

```js
/**
 * CSS 渲染优化: 减少重排 (Reflow) 和重绘 (Repaint)
 * 配合 JS 操作实现高性能渲染
 */

// 场景1: GPU 加速动画 (transform + opacity)
function gpuAcceleratedAnimation(element) {
  // ✅ 只触发 composite (合成)，不触发 layout/paint
  element.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
  element.style.transform = 'translateX(100px)';
  element.style.opacity = '0.5';

  // ❌ 触发 layout + paint (慢 10-100 倍)
  // element.style.left = '100px';
  // element.style.width = '200px';
  // element.style.backgroundColor = 'red';
}

// 场景2: willChange 提示浏览器预优化
function setupWillChange(element) {
  // 在动画开始前设置 (不要过早设置，浪费内存)
  element.addEventListener('mouseenter', () => {
    element.style.willChange = 'transform, opacity';
  });

  element.addEventListener('animationend', () => {
    element.style.willChange = 'auto'; // 动画结束移除
  });
}

// 场景3: CSS contain 隔离渲染区域
function applyContainOptimization(container) {
  // contain: layout paint size — 告诉浏览器该元素内部变化不影响外部
  container.style.contain = 'layout paint size';

  // 适用场景: 独立组件、卡片、列表项
  // 浏览器可以跳过外部元素的 layout/paint 计算
}

// 场景4: 批量样式操作 (使用 cssText / classList)
function batchStyleOperations(element) {
  // ❌ 多次 style 赋值 → 可能多次重排
  // element.style.width = '200px';
  // element.style.height = '100px';
  // element.style.padding = '20px';
  // element.style.margin = '10px';

  // ✅ 方式1: cssText 一次性设置
  element.style.cssText = 'width:200px;height:100px;padding:20px;margin:10px;';

  // ✅ 方式2: classList 切换预定义 class
  element.classList.add('card-expanded');

  // ✅ 方式3: 离线修改 (display:none 或 DocumentFragment)
  element.style.display = 'none';
  element.style.width = '200px';
  element.style.height = '100px';
  element.style.padding = '20px';
  element.style.display = ''; // 恢复 → 只触发 1 次重排
}

// 场景5: 性能监控 — 检测强制同步布局 (Layout Thrashing)
function detectLayoutThrashing() {
  const warnings = [];

  // 使用 PerformanceObserver 检测长任务
  if (typeof PerformanceObserver !== 'undefined') {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        if (entry.duration > 50) {
          warnings.push(`长任务: ${entry.duration.toFixed(1)}ms`);
        }
      });
    });
    observer.observe({ entryTypes: ['longtask'] });
  }

  // 手动检测: 包装可能触发重排的属性读取
  const reflowProperties = ['offsetWidth', 'offsetHeight', 'clientWidth',
    'clientHeight', 'getBoundingClientRect', 'scrollTop', 'scrollHeight'];

  let readCount = 0;
  let writeCount = 0;
  let lastOperation = '';

  const originalGetComputedStyle = window.getComputedStyle;

  return {
    trackRead(prop) {
      readCount++;
      if (lastOperation === 'write') {
        warnings.push(`Layout Thrashing: 写后读 ${prop}`);
      }
      lastOperation = 'read';
    },
    trackWrite() {
      writeCount++;
      lastOperation = 'write';
    },
    getWarnings: () => warnings,
    getStats: () => ({ reads: readCount, writes: writeCount }),
  };
}

// 场景6: 使用 CSS Grid / Flexbox 替代 JS 布局计算
function modernLayoutApproach() {
  // ❌ JS 计算位置 (每次 resize 都要重新计算)
  // items.forEach((item, i) => {
  //   item.style.left = `${(i % cols) * itemWidth}px`;
  //   item.style.top = `${Math.floor(i / cols) * itemHeight}px`;
  // });

  // ✅ CSS Grid (浏览器原生布局，自动响应 resize)
  // container.style.display = 'grid';
  // container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
  // container.style.gap = '16px';
}
```

**关键要点:**
- `transform` + `opacity` 只触发 composite (最快)
- `willChange` 提前提示 GPU 加速，但要及时清理
- `contain` 隔离渲染区域，减少全局 layout/paint
- 批量样式操作，避免读写交替

---

### 示例 13: 事件性能优化 — 被动事件 + 事件池

```js
/**
 * 事件性能优化: 被动事件 / 事件池 / 批量处理
 */

// 场景1: 被动事件 (Passive Event Listeners)
function setupPassiveListeners() {
  // touchstart/touchmove/scroll 标记 passive: true
  // 告诉浏览器不会调用 preventDefault，可立即滚动

  document.addEventListener('touchstart', (e) => {
    // 不需要 preventDefault 的事件
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    // 滚动跟随
  }, { passive: true });

  window.addEventListener('scroll', (e) => {
    // 滚动监听
  }, { passive: true });

  // ⚠️ 如果需要 preventDefault，不能用 passive
  // document.addEventListener('wheel', (e) => {
  //   e.preventDefault(); // passive 下会报错
  // }, { passive: false });
}

// 场景2: 事件池 — 复用事件处理对象
class EventPool {
  constructor(factory, maxSize = 10) {
    this.factory = factory;
    this.pool = [];
    this.maxSize = maxSize;
  }

  acquire(...args) {
    const obj = this.pool.length > 0
      ? this.pool.pop()
      : this.factory();
    obj.reset?.(...args);
    return obj;
  }

  release(obj) {
    if (this.pool.length < this.maxSize) {
      obj.cleanup?.();
      this.pool.push(obj);
    }
  }
}

// 使用: 复用鼠标事件对象
const mouseEventPool = new EventPool(
  () => ({ x: 0, y: 0, target: null, reset(x, y, target) {
    this.x = x; this.y = y; this.target = target;
  }}),
  20
);

document.addEventListener('mousemove', (e) => {
  const event = mouseEventPool.acquire(e.clientX, e.clientY, e.target);
  // 使用 event 对象...
  mouseEventPool.release(event);
});

// 场景3: 批量事件处理 — 合并同类型事件
class BatchedEventDispatcher {
  constructor() {
    this.queue = [];
    this.scheduled = false;
  }

  dispatch(type, data) {
    this.queue.push({ type, data, time: performance.now() });
    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }

  flush() {
    if (this.queue.length === 0) {
      this.scheduled = false;
      return;
    }

    // 按类型分组
    const grouped = {};
    for (const item of this.queue) {
      if (!grouped[item.type]) grouped[item.type] = [];
      grouped[item.type].push(item.data);
    }

    // 批量处理
    for (const [type, items] of Object.entries(grouped)) {
      console.log(`[批量] ${type}: ${items.length} 个事件`);
      this.handleBatch(type, items);
    }

    this.queue = [];
    this.scheduled = false;
  }

  handleBatch(type, items) {
    // 子类实现具体处理逻辑
  }
}

// 场景4: 事件节流 + 批量更新
class OptimizedResizeHandler {
  constructor() {
    this.callbacks = [];
    this.scheduled = false;
    this.lastSize = { w: 0, h: 0 };

    window.addEventListener('resize', () => {
      if (!this.scheduled) {
        this.scheduled = true;
        requestAnimationFrame(() => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          if (w !== this.lastSize.w || h !== this.lastSize.h) {
            this.lastSize = { w, h };
            this.callbacks.forEach(cb => cb(w, h));
          }
          this.scheduled = false;
        });
      }
    });
  }

  onResize(callback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }
}
```

**关键要点:**
- Passive listeners 消除滚动等待 (Chrome 默认对 touch/scroll 启用)
- 事件池减少 GC 压力 (高频事件场景)
- rAF 批量合并事件，减少处理次数
- resize 用 rAF 节流而非 debounce (保证最后一帧执行)

---

### 示例 14: DOM 查询优化 — querySelector vs 其他 API

```js
/**
 * DOM 查询性能对比与最佳实践
 */

function benchmarkQueryMethods(container, selector, iterations = 10000) {
  const results = {};

  // 方法1: querySelector (CSS 选择器，最灵活但最慢)
  function qsa() {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      container.querySelector(selector);
    }
    results.querySelector = performance.now() - start;
  }

  // 方法2: querySelectorAll
  function qsall() {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      container.querySelectorAll(selector);
    }
    results.querySelectorAll = performance.now() - start;
  }

  // 方法3: getElementsByClassName (HTMLCollection, 实时)
  function getByClass() {
    const className = selector.replace('.', '');
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      container.getElementsByClassName(className);
    }
    results.getElementsByClassName = performance.now() - start;
  }

  // 方法4: getElementsByTagName
  function getByTag() {
    const tag = selector.replace(/^[a-z]/i, m => m.toUpperCase());
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      container.getElementsByTagName(tag);
    }
    results.getElementsByTagName = performance.now() - start;
  }

  // 方法5: 缓存引用 (最快)
  function cached() {
    const el = container.querySelector(selector);
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      void el; // 模拟使用
    }
    results.cached = performance.now() - start;
  }

  qsa(); qsall(); getByClass(); getByTag(); cached();

  console.log(`查询 ${iterations} 次耗时:`);
  const sorted = Object.entries(results).sort((a, b) => a[1] - b[1]);
  sorted.forEach(([method, time]) => {
    const fastest = sorted[0][1];
    const ratio = (time / fastest).toFixed(1);
    console.log(`  ${method.padEnd(20)} ${time.toFixed(2).padStart(8)}ms  (${ratio}x)`);
  });

  return results;
}

// 最佳实践总结
const DOM_QUERY_GUIDELINES = {
  // 1. 缓存查询结果
  cache: `
    // ❌ 每次都查询
    document.querySelector('.btn').addEventListener('click', fn);
    document.querySelector('.btn').classList.add('active');

    // ✅ 缓存引用
    const btn = document.querySelector('.btn');
    btn.addEventListener('click', fn);
    btn.classList.add('active');
  `,

  // 2. 缩小查询范围
  scope: `
    // ❌ 全局查询
    document.querySelectorAll('.item');

    // ✅ 限定范围
    container.querySelectorAll('.item');
  `,

  // 3. 优先使用原生 API
  native: `
    // getElementsByClassName > getElementsByTagName > querySelector
    // 但 querySelector 最灵活，性能差异通常可忽略
  `,

  // 4. 避免在循环中查询
  loop: `
    // ❌
    for (let i = 0; i < 100; i++) {
      document.querySelector('.item').style.color = 'red';
    }

    // ✅
    const items = document.querySelectorAll('.item');
    items.forEach(item => item.style.color = 'red');
  `,

  // 5. NodeList vs HTMLCollection
  collection: `
    // querySelectorAll → NodeList (静态快照)
    // getElementsBy* → HTMLCollection (实时，DOM 变化时自动更新)
    // 遍历 HTMLCollection 时注意: 删除元素会改变索引
  `,
};

// HTMLCollection 实时性陷阱
function htmlCollectionTrap() {
  const list = document.getElementById('my-list');
  const items = list.getElementsByTagName('li'); // HTMLCollection (实时)

  // ❌ 错误: 删除时索引变化，跳过元素
  // for (let i = 0; i < items.length; i++) {
  //   items[i].remove(); // items.length 在变!
  // }

  // ✅ 正确1: 反向遍历
  for (let i = items.length - 1; i >= 0; i--) {
    items[i].remove();
  }

  // ✅ 正确2: 转数组
  // [...items].forEach(item => item.remove());

  // ✅ 正确3: while + firstChild
  // while (items.length > 0) items[0].remove();
}
```

**关键要点:**
- 缓存 DOM 引用 > 限定查询范围 > 选择合适 API
- HTMLCollection 是实时的，遍历时删除元素要反向或转数组
- 性能差异在大多数场景下可忽略，代码可读性优先

---

## 四、综合实战

### 示例 15: 高性能 Todo 应用 (综合所有技术)

```js
/**
 * 高性能 Todo 应用 — 综合运用事件委托 + DOM Diff + 性能优化
 */

class HighPerformanceTodo {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    this.todos = [];
    this.nextId = 1;
    this.filter = 'all'; // all / active / completed

    this._init();
  }

  _init() {
    this.container.innerHTML = `
      <div class="todo-header">
        <input type="text" id="todo-input" placeholder="添加任务..." />
        <button id="todo-add">添加</button>
      </div>
      <div class="todo-filters">
        <button data-filter="all" class="active">全部</button>
        <button data-filter="active">进行中</button>
        <button data-filter="completed">已完成</button>
      </div>
      <ul class="todo-list"></ul>
      <div class="todo-stats"></div>
    `;

    this.listEl = this.container.querySelector('.todo-list');
    this.statsEl = this.container.querySelector('.todo-stats');
    this.inputEl = this.container.querySelector('#todo-input');

    this._setupEventDelegation();
    this._setupInput();
    this._render();
  }

  // 事件委托: 一个监听器处理所有列表操作
  _setupEventDelegation() {
    this.container.addEventListener('click', (e) => {
      const todoItem = e.target.closest('.todo-item');
      const toggleBtn = e.target.closest('.todo-toggle');
      const deleteBtn = e.target.closest('.todo-delete');
      const filterBtn = e.target.closest('[data-filter]');

      if (toggleBtn && todoItem) {
        const id = Number(todoItem.dataset.id);
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
          todo.completed = !todo.completed;
          this._smartUpdate(); // 智能更新
        }
      } else if (deleteBtn && todoItem) {
        const id = Number(todoItem.dataset.id);
        this.todos = this.todos.filter(t => t.id !== id);
        this._smartUpdate();
      } else if (filterBtn) {
        this.filter = filterBtn.dataset.filter;
        this.container.querySelectorAll('[data-filter]').forEach(b =>
          b.classList.toggle('active', b === filterBtn)
        );
        this._render();
      }
    });

    // Enter 键添加
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._addTodo();
    });

    this.container.querySelector('#todo-add').addEventListener('click', () => {
      this._addTodo();
    });
  }

  _setupInput() {
    // 防抖: 输入统计
    const onInput = debounce((e) => {
      console.log('输入中:', e.target.value);
    }, 200);
    this.inputEl.addEventListener('input', onInput);
  }

  _addTodo() {
    const text = this.inputEl.value.trim();
    if (!text) return;

    this.todos.push({ id: this.nextId++, text, completed: false });
    this.inputEl.value = '';
    this._smartUpdate();
  }

  // 智能更新: 只更新变化的部分
  _smartUpdate() {
    const filtered = this._getFiltered();
    const currentItems = this.listEl.querySelectorAll('.todo-item');
    const currentIds = new Set([...currentItems].map(el => el.dataset.id));
    const newIds = new Set(filtered.map(t => String(t.id)));

    // 新增的 item
    for (const todo of filtered) {
      if (!currentIds.has(String(todo.id))) {
        this._appendTodo(todo);
      }
    }

    // 删除的 item
    for (const el of currentItems) {
      if (!newIds.has(el.dataset.id)) {
        el.remove();
      }
    }

    // 更新的 item (状态变化)
    for (const todo of filtered) {
      const el = this.listEl.querySelector(`.todo-item[data-id="${todo.id}"]`);
      if (el) {
        const shouldBeCompleted = todo.completed ? 'completed' : '';
        if (el.className !== `todo-item ${shouldBeCompleted}`.trim()) {
          el.className = `todo-item${shouldBeCompleted ? ' ' + shouldBeCompleted : ''}`;
        }
      }
    }

    this._updateStats();
  }

  _appendTodo(todo) {
    const li = document.createElement('li');
    li.className = `todo-item${todo.completed ? ' completed' : ''}`;
    li.dataset.id = todo.id;
    li.innerHTML = `
      <button class="todo-toggle">${todo.completed ? '✓' : '○'}</button>
      <span class="todo-text">${this._escapeHtml(todo.text)}</span>
      <button class="todo-delete">✕</button>
    `;
    this.listEl.appendChild(li);
  }

  _render() {
    // 全量渲染 (首次或 filter 变化时)
    const filtered = this._getFiltered();
    const fragment = document.createDocumentFragment();

    for (const todo of filtered) {
      const li = document.createElement('li');
      li.className = `todo-item${todo.completed ? ' completed' : ''}`;
      li.dataset.id = todo.id;
      li.innerHTML = `
        <button class="todo-toggle">${todo.completed ? '✓' : '○'}</button>
        <span class="todo-text">${this._escapeHtml(todo.text)}</span>
        <button class="todo-delete">✕</button>
      `;
      fragment.appendChild(li);
    }

    this.listEl.innerHTML = '';
    this.listEl.appendChild(fragment);
    this._updateStats();
  }

  _updateStats() {
    const total = this.todos.length;
    const completed = this.todos.filter(t => t.completed).length;
    const active = total - completed;
    this.statsEl.textContent = `共 ${total} 项, 已完成 ${completed}, 进行中 ${active}`;
  }

  _getFiltered() {
    switch (this.filter) {
      case 'active': return this.todos.filter(t => !t.completed);
      case 'completed': return this.todos.filter(t => t.completed);
      default: return this.todos;
    }
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 使用
// const app = new HighPerformanceTodo('#todo-app');
```

---

## 五、速查表

### 事件委托 vs 直接绑定

| 维度 | 直接绑定 | 事件委托 |
|------|----------|----------|
| 事件监听器数 | O(n) | O(1) |
| 内存占用 | 高 | 低 |
| 动态元素 | 需重新绑定 | 自动生效 |
| 事件类型限制 | 无 | 需冒泡事件 |
| 适用场景 | 少量固定元素 | 动态列表/表格 |

### DOM 操作性能排序

| 操作 | 性能 | 说明 |
|------|------|------|
| 缓存引用 | ⭐⭐⭐⭐⭐ | 最快，避免重复查询 |
| DocumentFragment | ⭐⭐⭐⭐⭐ | 批量插入不触发重排 |
| innerHTML | ⭐⭐⭐⭐ | 快但有 XSS 风险 |
| createElement + append | ⭐⭐⭐ | 安全但慢 |
| 逐个 appendChild | ⭐⭐ | 最慢，每次可能重排 |
| 读写交替 | ⭐ | Layout Thrashing |

### 事件优化策略

| 场景 | 策略 | 工具 |
|------|------|------|
| scroll/resize | 节流 | throttle + rAF |
| input/search | 防抖 | debounce |
| 动态列表 | 事件委托 | closest() + 冒泡 |
| 图片加载 | 懒加载 | IntersectionObserver |
| 大数据列表 | 虚拟列表 | 只渲染可见区域 |
| 动画 | GPU 加速 | transform + opacity |
| 触摸事件 | 被动监听 | { passive: true } |
| 长任务 | 分片执行 | rAF + 分块 |

### CSS 渲染层级 (从快到慢)

```
Composite (合成) > Paint (重绘) > Layout (重排)

Composite: transform, opacity, filter
Paint:     color, background, border-radius
Layout:    width, height, margin, padding, top/left
```

---

## 六、面试自测题

1. **事件委托原理是什么？哪些事件不能委托？**
   - 原理: 事件冒泡 + closest() 匹配
   - 不能委托: focus, blur, mouseenter, mouseleave (不冒泡)

2. **DOM Diff 的时间复杂度？Vue 3 和 React 的 diff 策略有什么区别？**
   - 简化版 O(n), 带 key 的 LCS O(m×n)
   - React: Fiber 双缓冲 + 时间切片
   - Vue 3: 双端对比 + 快速路径 + 最长递增子序列

3. **什么是 Layout Thrashing？如何避免？**
   - 读写交替导致浏览器强制同步布局
   - 避免: 先读后写, rAF 批量, getBoundingClientRect 缓存

4. **DocumentFragment 和 innerHTML 的区别？何时用哪个？**
   - Fragment: 安全, 可操作 DOM 对象
   - innerHTML: 快, 但 XSS 风险
   - 有用户输入用 Fragment, 纯模板用 innerHTML

5. **IntersectionObserver 相比 scroll 事件的优势？**
   - 异步执行, 不阻塞主线程
   - 浏览器原生优化, 性能高 10-100x
   - 支持阈值精度控制

6. **虚拟列表的核心原理？快速滚动时如何避免白屏？**
   - 只渲染可见区域 + 缓冲区
   - 缓冲区 (buffer) 保证快速滚动时有预渲染
   - rAF 节流 scroll 事件

---

*文档生成时间: 2026-05-03 07:00 | 示例总数: 15 (事件委托 3 + DOM Diff 3 + 性能优化 6 + 综合实战 1 + 速查表 + 自测题)*
