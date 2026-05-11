# 专项训练 07:00 — DOM 操作深度练习

**日期**: 2026-05-02  
**主题**: 原生 DOM API 深度练习 — 事件委托 / DOM Diff / 性能优化  
**示例数**: 14 个完整示例  
**难度**: ⭐⭐⭐⭐ (进阶 → 实战)

---

## 一、事件委托 (Event Delegation) — 4 个示例

### 示例 1: 通用事件委托工厂

```javascript
/**
 * 通用事件委托 — 支持多层级、选择器匹配、动态元素
 * 核心原理: 事件冒泡 + Element.matches()
 */
class EventDelegator {
  constructor(container) {
    this._container = container;
    this._handlers = new Map(); // selector -> [{event, callback, options}]
  }

  /**
   * 注册委托事件
   * @param {string} selector - CSS 选择器
   * @param {string} event - 事件名
   * @param {Function} callback - 回调 (this 指向匹配元素)
   * @param {AddEventListenerOptions} options
   */
  on(selector, event, callback, options = {}) {
    if (!this._handlers.has(selector)) {
      this._handlers.set(selector, []);
    }
    this._handlers.get(selector).push({ event, callback, options });

    // 确保容器上注册了该事件的监听器
    if (!this._container[`_delegated_${event}`]) {
      this._container.addEventListener(event, (e) => {
        this._dispatch(e);
      }, options.capture);
      this._container[`_delegated_${event}`] = true;
    }
  }

  _dispatch(event) {
    for (const [selector, handlers] of this._handlers) {
      const target = event.target.closest(selector);
      if (!target || !this._container.contains(target)) continue;

      for (const { callback, options } of handlers) {
        const syntheticEvent = new Proxy(event, {
          get: (target, prop) => {
            if (prop === 'currentTarget') return target;
            return target[prop];
          }
        });
        callback.call(target, syntheticEvent, target);
      }
    }
  }

  /** 移除所有委托或指定选择器的委托 */
  off(selector, event) {
    if (selector) {
      this._handlers.delete(selector);
    }
  }

  destroy() {
    this._handlers.clear();
  }
}

// 使用
const delegator = new EventDelegator(document.getElementById('app'));
delegator.on('.btn-delete', 'click', function(e, el) {
  console.log('删除按钮被点击:', el.dataset.id);
  this.remove(); // this 指向匹配的元素
});
delegator.on('.item', 'mouseenter', (e, el) => {
  el.classList.add('hovered');
});
```

### 示例 2: 表格行内操作 — 多层级事件委托

```javascript
/**
 * 复杂表格 — 多层级事件委托实战
 * 场景: 可编辑表格，支持行内编辑/删除/排序
 */
class DataTable {
  constructor(tableEl) {
    this.table = tableEl;
    this.data = [];
    this._initDelegation();
  }

  _initDelegation() {
    // 编辑按钮
    this.table.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit-btn');
      const deleteBtn = e.target.closest('.delete-btn');
      const sortBtn = e.target.closest('.sort-btn');

      if (editBtn) this._handleEdit(editBtn);
      else if (deleteBtn) this._handleDelete(deleteBtn);
      else if (sortBtn) this._handleSort(sortBtn);
    });

    // 双击单元格进入编辑
    this.table.addEventListener('dblclick', (e) => {
      const cell = e.target.closest('td[data-editable]');
      if (cell) this._makeCellEditable(cell);
    });

    // 输入框失焦保存
    this.table.addEventListener('blur', (e) => {
      const input = e.target.closest('.cell-input');
      if (input) this._saveCell(input);
    }, true); // 捕获阶段

    // Enter 键保存
    this.table.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('cell-input')) {
        this._saveCell(e.target);
      }
      if (e.key === 'Escape' && e.target.classList.contains('cell-input')) {
        this._cancelEdit(e.target);
      }
    });
  }

  _handleEdit(btn) {
    const row = btn.closest('tr');
    const cells = row.querySelectorAll('td[data-editable]');
    cells.forEach(cell => this._makeCellEditable(cell));
  }

  _makeCellEditable(cell) {
    if (cell.querySelector('.cell-input')) return;
    const value = cell.dataset.original ?? cell.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-input';
    input.value = value;
    cell.dataset.original = value;
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();
  }

  _saveCell(input) {
    const cell = input.closest('td');
    const newValue = input.value;
    const row = cell.closest('tr');
    const rowIndex = [...this.table.tBodies[0].children].indexOf(row);
    const colIndex = [...row.children].indexOf(cell);

    // 更新数据源
    if (this.data[rowIndex]) {
      const key = this.table.tHead.rows[0].cells[colIndex].dataset.field;
      this.data[rowIndex][key] = newValue;
    }

    cell.textContent = newValue;
  }

  _handleDelete(btn) {
    const row = btn.closest('tr');
    const index = [...this.table.tBodies[0].children].indexOf(row);
    this.data.splice(index, 1);
    row.style.transition = 'all 0.3s';
    row.style.opacity = '0';
    row.style.transform = 'translateX(100px)';
    setTimeout(() => row.remove(), 300);
  }

  _handleSort(btn) {
    const colIndex = [...btn.parentElement.children].indexOf(btn);
    const field = btn.dataset.field;
    const dir = btn.dataset.dir === 'asc' ? 'desc' : 'asc';
    btn.dataset.dir = dir;

    this.data.sort((a, b) => {
      const va = a[field], vb = b[field];
      return dir === 'asc' ? va > vb ? 1 : -1 : va < vb ? 1 : -1;
    });
    this._render();
  }

  _render() {
    const tbody = this.table.tBodies[0];
    tbody.innerHTML = this.data.map((row, i) =>
      `<tr>${Object.values(row).map(v => `<td data-editable>${v}</td>`).join('')}
       <td><button class="edit-btn">编辑</button>
           <button class="delete-btn">删除</button></td></tr>`
    ).join('');
  }

  setData(data) {
    this.data = data;
    this._render();
  }
}

// 使用
const table = new DataTable(document.querySelector('#data-table'));
table.setData([
  { name: 'Alice', age: 28, city: '北京' },
  { name: 'Bob', age: 32, city: '上海' },
  { name: 'Charlie', age: 25, city: '广州' },
]);
```

### 示例 3: 动态菜单 — 带防抖和键盘导航

```javascript
/**
 * 动态菜单 — 事件委托 + 键盘导航 + 防抖
 * 场景: 无限级菜单，支持键盘上下/Enter/Escape
 */
class DynamicMenu {
  constructor(container, items) {
    this.container = container;
    this.items = items;
    this.activeIndex = -1;
    this._render();
    this._bindEvents();
  }

  _render() {
    this.container.innerHTML = this.items.map((item, i) => `
      <div class="menu-item" data-index="${i}" role="menuitem" tabindex="-1">
        ${item.icon ? `<span class="icon">${item.icon}</span>` : ''}
        <span class="label">${item.label}</span>
        ${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}
      </div>
    `).join('');
  }

  _bindEvents() {
    // 点击委托
    this.container.addEventListener('click', (e) => {
      const item = e.target.closest('.menu-item');
      if (!item) return;
      const index = parseInt(item.dataset.index);
      this.items[index].action?.();
      this.container.dispatchEvent(new CustomEvent('menu-select', {
        detail: { item: this.items[index], index }
      }));
    });

    // 键盘导航
    this.container.addEventListener('keydown', (e) => {
      const len = this.items.length;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.activeIndex = (this.activeIndex + 1) % len;
          this._setActive();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.activeIndex = (this.activeIndex - 1 + len) % len;
          this._setActive();
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (this.activeIndex >= 0) {
            this.items[this.activeIndex].action?.();
          }
          break;
        case 'Escape':
          this.container.dispatchEvent(new CustomEvent('menu-close'));
          break;
      }
    });

    // 鼠标悬停防抖 — 避免快速划过时闪烁
    let hoverTimer = null;
    this.container.addEventListener('mousemove', (e) => {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        const item = e.target.closest('.menu-item');
        if (item) {
          this.activeIndex = parseInt(item.dataset.index);
          this._setActive();
        }
      }, 50);
    });
  }

  _setActive() {
    const items = this.container.querySelectorAll('.menu-item');
    items.forEach((el, i) => {
      el.classList.toggle('active', i === this.activeIndex);
      el.tabIndex = i === this.activeIndex ? 0 : -1;
    });
    // 滚动到可见区域
    if (this.activeIndex >= 0) {
      items[this.activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }
}

// 使用
const menu = new DynamicMenu(document.getElementById('menu'), [
  { icon: '📋', label: '新建文件', shortcut: '⌘N', action: () => console.log('新建') },
  { icon: '💾', label: '保存', shortcut: '⌘S', action: () => console.log('保存') },
  { icon: '🗑️', label: '删除', shortcut: 'Del', action: () => console.log('删除') },
]);
```

### 示例 4: 虚拟列表 + 事件委托（大数据量场景）

```javascript
/**
 * 虚拟列表 — 只渲染可见区域 DOM + 事件委托
 * 场景: 10 万条数据，只渲染 ~20 个 DOM 节点
 */
class VirtualList {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 40;
    this.buffer = options.buffer || 5;
    this.data = [];
    this.scrollTop = 0;
    this._renderedItems = new Map();

    this._setupContainer();
    this._bindEvents();
  }

  _setupContainer() {
    this.container.style.overflow = 'auto';
    this.container.style.position = 'relative';

    this.scroller = document.createElement('div');
    this.scroller.style.position = 'absolute';
    this.scroller.style.width = '100%';
    this.scroller.style.pointerEvents = 'none';
    this.container.appendChild(this.scroller);

    this.viewport = document.createElement('div');
    this.viewport.style.position = 'absolute';
    this.viewport.style.width = '100%';
    this.viewport.style.left = '0';
    this.container.appendChild(this.viewport);
  }

  _bindEvents() {
    // 滚动事件 — requestAnimationFrame 节流
    let ticking = false;
    this.container.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.scrollTop = this.container.scrollTop;
          this._render();
          ticking = false;
        });
        ticking = true;
      }
    });

    // 事件委托 — 列表项点击
    this.viewport.addEventListener('click', (e) => {
      const item = e.target.closest('.virtual-item');
      if (item) {
        const index = parseInt(item.dataset.index);
        this.container.dispatchEvent(new CustomEvent('item-click', {
          detail: { item: this.data[index], index }
        }));
      }
    });
  }

  setData(data) {
    this.data = data;
    this.scroller.style.height = `${data.length * this.itemHeight}px`;
    this._render();
  }

  _render() {
    const containerHeight = this.container.clientHeight;
    const startIdx = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.buffer);
    const endIdx = Math.min(
      this.data.length,
      Math.ceil((this.scrollTop + containerHeight) / this.itemHeight) + this.buffer
    );

    const visibleKeys = new Set();
    for (let i = startIdx; i < endIdx; i++) {
      visibleKeys.add(i);
    }

    // 移除不可见的 DOM
    for (const [key] of this._renderedItems) {
      if (!visibleKeys.has(key)) {
        this.viewport.removeChild(this._renderedItems.get(key));
        this._renderedItems.delete(key);
      }
    }

    // 添加/更新可见 DOM
    const fragment = document.createDocumentFragment();
    for (let i = startIdx; i < endIdx; i++) {
      let el = this._renderedItems.get(i);
      if (!el) {
        el = document.createElement('div');
        el.className = 'virtual-item';
        el.style.height = `${this.itemHeight}px`;
        el.style.lineHeight = `${this.itemHeight}px`;
        el.style.position = 'absolute';
        el.style.width = '100%';
        fragment.appendChild(el);
        this._renderedItems.set(i, el);
      }
      el.style.top = `${i * this.itemHeight}px`;
      el.dataset.index = i;
      el.textContent = this.data[i];
    }
    this.viewport.appendChild(fragment);
  }
}

// 使用 — 10 万条数据，DOM 节点始终 < 30 个
const list = new VirtualList(document.getElementById('virtual-list'), {
  itemHeight: 40,
  buffer: 3
});
list.setData(Array.from({ length: 100000 }, (_, i) => `Item ${i + 1}`));
```

---

## 二、DOM Diff 算法 — 4 个示例

### 示例 5: 简易 DOM Diff 引擎

```javascript
/**
 * 简易 DOM Diff — 同层比较 + key 优化
 * 核心思路: 新旧 VNode 树逐层对比，生成最小操作集
 */

// VNode 定义
function h(tag, props = {}, children = []) {
  return { tag, props, children, el: null };
}

// Diff 引擎
class DOMDiff {
  /**
   * 对比新旧 VNode，更新真实 DOM
   */
  patch(parent, oldVNode, newVNode) {
    if (!oldVNode) {
      // 新增
      parent.appendChild(this._createEl(newVNode));
      return;
    }
    if (!newVNode) {
      // 删除
      parent.removeChild(oldVNode.el);
      return;
    }
    if (this._isSameVNode(oldVNode, newVNode)) {
      // 同类型 — 更新属性 + 递归 diff 子节点
      this._patchProps(oldVNode, newVNode);
      this._patchChildren(oldVNode.children, newVNode.children, oldVNode.el);
    } else {
      // 不同类型 — 替换
      const newEl = this._createEl(newVNode);
      parent.replaceChild(newEl, oldVNode.el);
    }
  }

  _isSameVNode(a, b) {
    return a.tag === b.tag && a.props?.key === b.props?.key;
  }

  _createEl(vnode) {
    if (typeof vnode === 'string' || typeof vnode === 'number') {
      vnode = { tag: '#text', props: {}, children: [String(vnode)] };
    }
    if (vnode.tag === '#text') {
      const el = document.createTextNode(vnode.children[0] || '');
      vnode.el = el;
      return el;
    }
    const el = document.createElement(vnode.tag);
    vnode.el = el;
    this._applyProps(el, vnode.props);
    for (const child of vnode.children) {
      el.appendChild(this._createEl(child));
    }
    return el;
  }

  _patchProps(oldVNode, newVNode) {
    const el = newVNode.el = oldVNode.el;
    const oldProps = oldVNode.props || {};
    const newProps = newVNode.props || {};

    // 移除旧属性
    for (const key in oldProps) {
      if (!(key in newProps)) {
        el.removeAttribute(key);
      }
    }
    // 设置新属性
    for (const key in newProps) {
      if (key === 'key') continue;
      if (newProps[key] !== oldProps[key]) {
        el.setAttribute(key, newProps[key]);
      }
    }
  }

  _patchChildren(oldChildren, newChildren, parent) {
    const oldLen = oldChildren.length;
    const newLen = newChildren.length;
    const minLen = Math.min(oldLen, newLen);

    // 有 key 的走 key-based diff
    const oldHasKey = oldChildren.some(c => c?.props?.key != null);
    const newHasKey = newChildren.some(c => c?.props?.key != null);

    if (oldHasKey && newHasKey) {
      this._patchChildrenWithKey(oldChildren, newChildren, parent);
    } else {
      // 无 key — 逐位对比
      for (let i = 0; i < minLen; i++) {
        this.patch(parent, oldChildren[i], newChildren[i]);
      }
      if (newLen > oldLen) {
        for (let i = minLen; i < newLen; i++) {
          parent.appendChild(this._createEl(newChildren[i]));
        }
      } else if (oldLen > newLen) {
        for (let i = minLen; i < oldLen; i++) {
          parent.removeChild(oldChildren[i].el);
        }
      }
    }
  }

  /**
   * Key-based diff (双端比较简化版)
   * 类似 Vue2 的 sameVnode + key 匹配策略
   */
  _patchChildrenWithKey(oldChildren, newChildren, parent) {
    let oldStart = 0, oldEnd = oldChildren.length - 1;
    let newStart = 0, newEnd = newChildren.length - 1;

    while (oldStart <= oldEnd && newStart <= newEnd) {
      // 头头对比
      if (this._isSameVNode(oldChildren[oldStart], newChildren[newStart])) {
        this.patch(parent, oldChildren[oldStart], newChildren[newStart]);
        oldStart++; newStart++;
      }
      // 尾尾对比
      else if (this._isSameVNode(oldChildren[oldEnd], newChildren[newEnd])) {
        this.patch(parent, oldChildren[oldEnd], newChildren[newEnd]);
        oldEnd--; newEnd--;
      }
      // 头尾对比
      else if (this._isSameVNode(oldChildren[oldStart], newChildren[newEnd])) {
        this.patch(parent, oldChildren[oldStart], newChildren[newEnd]);
        parent.insertBefore(newChildren[newEnd].el, oldChildren[oldStart].el.nextSibling);
        oldStart++; newEnd--;
      }
      // 尾头对比
      else if (this._isSameVNode(oldChildren[oldEnd], newChildren[newStart])) {
        this.patch(parent, oldChildren[oldEnd], newChildren[newStart]);
        parent.insertBefore(newChildren[newStart].el, oldChildren[oldStart].el);
        oldEnd--; newStart++;
      }
      else {
        // 找不到匹配 — 创建新节点
        const el = this._createEl(newChildren[newStart]);
        const oldVNode = oldChildren[oldStart];
        if (oldVNode?.el) {
          parent.insertBefore(el, oldVNode.el);
        } else {
          parent.appendChild(el);
        }
        newStart++;
      }
    }

    // 清理多余旧节点
    if (oldStart <= oldEnd) {
      for (let i = oldStart; i <= oldEnd; i++) {
        if (oldChildren[i]?.el) parent.removeChild(oldChildren[i].el);
      }
    }
    // 添加多余新节点
    if (newStart <= newEnd) {
      const anchor = newChildren[newEnd + 1]?.el || null;
      for (let i = newStart; i <= newEnd; i++) {
        parent.insertBefore(this._createEl(newChildren[i]), anchor);
      }
    }
  }
}

// 使用
const diff = new DOMDiff();

// 初始渲染
let vdom = h('ul', { id: 'list' }, [
  h('li', { key: 'a' }, ['Apple']),
  h('li', { key: 'b' }, ['Banana']),
  h('li', { key: 'c' }, ['Cherry']),
]);
diff.patch(document.getElementById('app'), null, vdom);

// 更新 — 顺序变化 + 新增 + 删除
const newVdom = h('ul', { id: 'list' }, [
  h('li', { key: 'c' }, ['Cherry 🍒']),  // 移到前面，内容变化
  h('li', { key: 'd' }, ['Durian']),      // 新增
  h('li', { key: 'b' }, ['Banana 🍌']),  // 移到后面，内容变化
]);
diff.patch(document.getElementById('app'), vdom, newVdom);
vdom = newVdom;
```

### 示例 6: DOM Diff 性能分析器

```javascript
/**
 * DOM Diff 性能分析器
 * 对比不同 diff 策略的性能差异
 */
class DiffProfiler {
  constructor() {
    this.results = [];
  }

  /**
   * 生成随机列表数据
   */
  _generateData(n, prefix = 'item') {
    return Array.from({ length: n }, (_, i) => ({
      id: `${prefix}-${i}`,
      text: `${prefix}-${Math.random().toString(36).slice(2, 8)}`
    }));
  }

  /**
   * 策略 A: 暴力全量替换 (innerHTML)
   */
  strategyInnerHTML(container, data) {
    const start = performance.now();
    container.innerHTML = data.map(item =>
      `<div data-id="${item.id}">${item.text}</div>`
    ).join('');
    return performance.now() - start;
  }

  /**
   * 策略 B: DocumentFragment 批量插入
   */
  strategyFragment(container, data) {
    const start = performance.now();
    const frag = document.createDocumentFragment();
    data.forEach(item => {
      const div = document.createElement('div');
      div.dataset.id = item.id;
      div.textContent = item.text;
      frag.appendChild(div);
    });
    container.innerHTML = '';
    container.appendChild(frag);
    return performance.now() - start;
  }

  /**
   * 策略 C: Key-based diff (最小操作)
   */
  strategyDiff(container, oldData, newData, keyFn = d => d.id) {
    const start = performance.now();
    const oldMap = new Map(oldData.map(d => [keyFn(d), d]));
    const newMap = new Map(newData.map(d => [keyFn(d), d]));
    const children = [...container.children];
    const childMap = new Map(children.map(el => [el.dataset.id, el]));

    // 删除不在新数据中的
    children.forEach(el => {
      if (!newMap.has(el.dataset.id)) el.remove();
    });

    // 更新或新增
    let prevEl = null;
    newData.forEach(item => {
      const id = keyFn(item);
      let el = childMap.get(id);
      if (el) {
        // 更新
        el.textContent = item.text;
        if (prevEl && prevEl.nextSibling !== el) {
          container.insertBefore(el, prevEl.nextSibling);
        }
      } else {
        // 新增
        el = document.createElement('div');
        el.dataset.id = id;
        el.textContent = item.text;
        if (prevEl && prevEl.nextSibling) {
          container.insertBefore(el, prevEl.nextSibling);
        } else {
          container.appendChild(el);
        }
      }
      prevEl = el;
    });

    return performance.now() - start;
  }

  /**
   * 运行基准测试
   */
  benchmark(name, size, iterations = 50) {
    console.log(`\n📊 基准测试: ${name} (${size} 项, ${iterations} 次迭代)`);
    console.log('='.repeat(60));

    const container = document.createElement('div');
    document.body.appendChild(container);

    // 初始数据
    let oldData = this._generateData(size, 'init');
    this.strategyFragment(container, oldData);

    const results = { innerHTML: [], fragment: [], diff: [] };

    for (let i = 0; i < iterations; i++) {
      // 模拟操作: 随机打乱 + 部分更新
      const newData = [...this._generateData(size, 'update')];
      // 50% 概率复用旧数据（模拟部分更新）
      if (Math.random() > 0.5) {
        newData.forEach((item, idx) => {
          if (oldData[idx] && Math.random() > 0.3) {
            item.id = oldData[idx].id;
            item.text = `updated-${Math.random().toString(36).slice(2, 6)}`;
          }
        });
      }

      results.innerHTML.push(this.strategyInnerHTML(container, newData));
      results.fragment.push(this.strategyFragment(container, newData));
      results.diff.push(this.strategyDiff(container, oldData, newData));

      oldData = newData;
    }

    // 统计
    const avg = arr => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3);
    const min = arr => Math.min(...arr).toFixed(3);
    const max = arr => Math.max(...arr).toFixed(3);

    console.log(`策略          | 平均(ms)  | 最小(ms)  | 最大(ms)`);
    console.log(`--------------|-----------|-----------|----------`);
    console.log(`innerHTML     | ${avg(results.innerHTML).padEnd(9)}| ${min(results.innerHTML).padEnd(9)}| ${max(results.innerHTML)}`);
    console.log(`Fragment      | ${avg(results.fragment).padEnd(9)}| ${min(results.fragment).padEnd(9)}| ${max(results.fragment)}`);
    console.log(`Key-Diff      | ${avg(results.diff).padEnd(9)}| ${min(results.diff).padEnd(9)}| ${max(results.diff)}`);

    container.remove();
    return results;
  }
}

// 使用
// const profiler = new DiffProfiler();
// profiler.benchmark('中等列表 (100项)', 100);
// profiler.benchmark('大列表 (1000项)', 1000);
```

### 示例 7: 响应式 UI 组件 — 基于 Diff 的自动更新

```javascript
/**
 * 响应式 UI 组件 — 数据变化自动 Diff 更新 DOM
 * 类似 Vue 的响应式 + 虚拟 DOM 渲染
 */
class ReactiveComponent {
  constructor(options) {
    this.el = typeof options.el === 'string'
      ? document.querySelector(options.el)
      : options.el;
    this.data = this._makeReactive(options.data || {});
    this.render = options.render; // (data) => VNode
    this._diff = new DOMDiff();
    this._oldVNode = null;
    this._pending = false;

    // 首次渲染
    this._render();
  }

  _makeReactive(obj) {
    return new Proxy(obj, {
      set: (target, key, value) => {
        const oldValue = target[key];
        target[key] = value;
        if (oldValue !== value) {
          this._scheduleUpdate();
        }
        return true;
      }
    });
  }

  _scheduleUpdate() {
    if (this._pending) return;
    this._pending = true;
    requestAnimationFrame(() => {
      this._render();
      this._pending = false;
    });
  }

  _render() {
    const newVNode = this.render(this.data);
    this._diff.patch(this.el, this._oldVNode, newVNode);
    this._oldVNode = newVNode;
  }

  // 暴露 data 供外部修改
  setData(key, value) {
    if (typeof key === 'object') {
      Object.assign(this.data, key);
    } else {
      this.data[key] = value;
    }
  }
}

// 使用 — 计数器组件
const counter = new ReactiveComponent({
  el: '#counter-app',
  data: { count: 0, step: 1, label: '计数器' },
  render(data) {
    return h('div', { class: 'counter' }, [
      h('h2', {}, [data.label]),
      h('p', { class: 'count' }, [`当前值: ${data.count}`]),
      h('div', { class: 'controls' }, [
        h('button', { class: 'btn-dec', onclick: () => data.count -= data.step }, ['-']),
        h('span', { class: 'step' }, [`步长: ${data.step}`]),
        h('button', { class: 'btn-inc', onclick: () => data.count += data.step }, ['+']),
      ]),
    ]);
  }
});
```

### 示例 8: 列表 Diff 可视化调试器

```javascript
/**
 * 列表 Diff 可视化 — 直观展示 DOM Diff 过程
 * 在页面上渲染新旧列表对比 + 操作标记
 */
class DiffVisualizer {
  constructor(container) {
    this.container = container;
  }

  /**
   * 可视化两个列表之间的 diff 操作
   */
  visualize(oldList, newList, keyFn = String) {
    const oldKeys = oldList.map(keyFn);
    const newKeys = newList.map(keyFn);

    // 计算 diff 操作
    const ops = [];
    const oldMap = new Map(oldList.map((item, i) => [keyFn(item), i]));
    const newMap = new Map(newList.map((item, i) => [keyFn(item), i]));

    // 标记操作类型
    const maxLen = Math.max(oldKeys.length, newKeys.length);
    let oldIdx = 0, newIdx = 0;

    while (oldIdx < oldKeys.length || newIdx < newKeys.length) {
      const oldKey = oldKeys[oldIdx];
      const newKey = newKeys[newIdx];

      if (oldKey === newKey) {
        ops.push({ type: 'keep', oldIdx, newIdx, key: newKey });
        oldIdx++; newIdx++;
      } else if (newMap.has(oldKey) && newMap.get(oldKey) !== newIdx) {
        // 移动
        ops.push({ type: 'move', oldIdx, newIdx, key: oldKey });
        oldIdx++;
      } else if (!oldMap.has(newKey)) {
        // 新增
        ops.push({ type: 'add', newIdx, key: newKey, value: newList[newIdx] });
        newIdx++;
      } else {
        // 删除
        ops.push({ type: 'remove', oldIdx, key: oldKey });
        oldIdx++;
      }
    }

    // 渲染可视化
    this._renderVisualization(oldList, newList, ops, keyFn);
    return ops;
  }

  _renderVisualization(oldList, newList, ops, keyFn) {
    const colors = {
      keep: '#4ade80',  // 绿色 - 保留
      move: '#fbbf24',  // 黄色 - 移动
      add: '#60a5fa',   // 蓝色 - 新增
      remove: '#f87171' // 红色 - 删除
    };

    const icons = {
      keep: '✅',
      move: '↔️',
      add: '➕',
      remove: '➖'
    };

    this.container.innerHTML = `
      <div class="diff-visual">
        <h3>📊 Diff 操作可视化</h3>
        <div class="legend">
          <span style="color:${colors.keep}">✅ 保留</span>
          <span style="color:${colors.move}">↔️ 移动</span>
          <span style="color:${colors.add}">➕ 新增</span>
          <span style="color:${colors.remove}">➖ 删除</span>
        </div>
        <table>
          <thead>
            <tr><th>#</th><th>操作</th><th>Key</th><th>值</th></tr>
          </thead>
          <tbody>
            ${ops.map((op, i) => `
              <tr style="background:${colors[op.type]}22">
                <td>${i + 1}</td>
                <td>${icons[op.type]} ${op.type.toUpperCase()}</td>
                <td><code>${op.key}</code></td>
                <td>${op.value ?? (newList[op.newIdx] ?? oldList[op.oldIdx])}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="stats">
          <p>总操作: ${ops.length} | 
             保留: ${ops.filter(o => o.type === 'keep').length} | 
             移动: ${ops.filter(o => o.type === 'move').length} | 
             新增: ${ops.filter(o => o.type === 'add').length} | 
             删除: ${ops.filter(o => o.type === 'remove').length}
          </p>
          <p>DOM 操作数: ${ops.filter(o => o.type !== 'keep').length} (vs 全量替换 ${newList.length})</p>
        </div>
      </div>
    `;
  }
}

// 使用
// const viz = new DiffVisualizer(document.getElementById('diff-viz'));
// viz.visualize(
//   [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }, { id: 'c', name: 'Charlie' }],
//   [{ id: 'c', name: 'Charlie 🍒' }, { id: 'd', name: 'David' }, { id: 'a', name: 'Alice' }],
//   d => d.id
// );
```

---

## 三、DOM 性能优化 — 6 个示例

### 示例 9: 批量 DOM 操作优化器

```javascript
/**
 * 批量 DOM 操作优化器
 * 核心: 合并读写操作，避免 Layout Thrashing
 */
class BatchDOM {
  constructor() {
    this._reads = [];
    this._writes = [];
    this._scheduled = false;
  }

  /**
   * 安排读操作 (measure)
   */
  read(fn) {
    this._reads.push(fn);
    this._schedule();
  }

  /**
   * 安排写操作 (mutate)
   */
  write(fn) {
    this._writes.push(fn);
    this._schedule();
  }

  /**
   * 读-写对 (measure + mutate 成对执行)
   */
  readWrite(measure, mutate) {
    this._reads.push(measure);
    this._writes.push(() => {
      // 读取的值通过闭包传递
      const results = this._readResults;
      mutate(results);
    });
    this._schedule();
  }

  _schedule() {
    if (this._scheduled) return;
    this._scheduled = true;
    requestAnimationFrame(() => {
      this._flush();
    });
  }

  _flush() {
    this._scheduled = false;

    // 1. 先执行所有读操作
    this._readResults = this._reads.map(fn => fn());

    // 2. 再执行所有写操作
    this._writes.forEach(fn => fn());

    // 3. 清空队列
    this._reads = [];
    this._writes = [];
  }

  /**
   * 同步强制刷新 (紧急时使用)
   */
  flush() {
    this._flush();
  }
}

// 使用 — 避免 Layout Thrashing
const batch = new BatchDOM();

// ❌ 错误写法 — 交替读写，触发多次 reflow
// items.forEach((item, i) => {
//   item.style.height = container.clientHeight + 'px'; // 读
//   container.appendChild(item);                        // 写
// });

// ✅ 正确写法 — 批量读写
batch.read(() => container.clientHeight);
items.forEach(item => {
  batch.write(() => {
    item.style.height = batch._readResults[0] + 'px';
    container.appendChild(item);
  });
});

/**
 * 对比测试
 */
function testLayoutThrashing() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const items = Array.from({ length: 1000 }, () => document.createElement('div'));

  // 坏写法
  console.time('Bad (交替读写)');
  items.forEach(item => {
    const h = container.clientHeight; // 强制 reflow
    item.style.height = h + 'px';
    container.appendChild(item);      // 强制 reflow
  });
  console.timeEnd('Bad (交替读写)');
  container.innerHTML = '';

  // 好写法
  console.time('Good (批量读写)');
  const h = container.clientHeight;   // 一次 reflow
  items.forEach(item => {
    item.style.height = h + 'px';
    container.appendChild(item);
  });
  console.timeEnd('Good (批量读写)');

  container.remove();
}
```

### 示例 10: IntersectionObserver 懒加载 + 动画触发

```javascript
/**
 * IntersectionObserver 综合应用
 * 懒加载图片 + 滚动动画 + 无限滚动
 */
class IntersectionManager {
  constructor(options = {}) {
    this._observers = new Map();
    this._callbacks = new WeakMap();
    this._defaultOptions = {
      root: options.root || null,
      rootMargin: options.rootMargin || '50px',
      threshold: options.threshold || 0.1,
    };
  }

  /**
   * 懒加载图片
   */
  lazyLoadImages(selector = 'img[data-src]') {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.dataset.src;
          if (src) {
            // 预加载
            const preloadImg = new Image();
            preloadImg.onload = () => {
              img.src = src;
              img.classList.add('loaded');
              img.classList.remove('loading');
            };
            preloadImg.onerror = () => {
              img.classList.add('error');
            };
            preloadImg.src = src;
            img.classList.add('loading');
          }
          observer.unobserve(img);
        }
      });
    }, { ...this._defaultOptions, threshold: 0.01 });

    document.querySelectorAll(selector).forEach(img => observer.observe(img));
    return observer;
  }

  /**
   * 滚动触发动画 (IntersectionObserver + CSS animation)
   */
  animateOnScroll(selector, animationClass = 'animate-in') {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add(animationClass);
          // 可选: 动画完成后停止观察
          // observer.unobserve(entry.target);
        } else {
          entry.target.classList.remove(animationClass);
        }
      });
    }, { threshold: 0.2 });

    document.querySelectorAll(selector).forEach(el => observer.observe(el));
    return observer;
  }

  /**
   * 无限滚动 (Sentinel 模式)
   */
  infiniteScroll(sentinelEl, onLoadMore) {
    const observer = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting) {
        observer.unobserve(sentinelEl); // 防止重复触发
        try {
          await onLoadMore();
        } finally {
          observer.observe(sentinelEl); // 重新观察
        }
      }
    }, { rootMargin: '200px' });

    observer.observe(sentinelEl);
    return observer;
  }

  /**
   * 可见性追踪 (用于分析/埋点)
   */
  trackVisibility(selector, onVisible, onHidden) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          onVisible?.(entry.target, entry);
        } else {
          onHidden?.(entry.target, entry);
        }
      });
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

    document.querySelectorAll(selector).forEach(el => observer.observe(el));
    return observer;
  }

  destroy() {
    this._observers.forEach(observer => observer.disconnect());
    this._observers.clear();
  }
}

// 使用
const manager = new IntersectionManager({ rootMargin: '100px' });

// 懒加载
manager.lazyLoadImages('.lazy-img');

// 滚动动画
manager.animateOnScroll('.fade-in-item', 'fade-in');

// 无限滚动
const sentinel = document.getElementById('scroll-sentinel');
manager.infiniteScroll(sentinel, async () => {
  const newItems = await fetchMoreItems();
  renderItems(newItems);
});
```

### 示例 11: ResizeObserver 响应式布局

```javascript
/**
 * ResizeObserver 响应式组件
 * 替代 window resize 事件，精准监听元素尺寸变化
 */
class ResponsiveLayout {
  constructor() {
    this._observers = new WeakMap();
    this._handlers = new WeakMap();
  }

  /**
   * 监听元素尺寸变化
   */
  observe(element, callback) {
    if (!window.ResizeObserver) {
      // 降级: window resize
      window.addEventListener('resize', callback);
      return { disconnect: () => window.removeEventListener('resize', callback) };
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const { inlineSize, blockSize } = entry.borderBoxSize?.[0] || {};
        callback({
          width,
          height,
          inlineSize,
          blockSize,
          target: entry.target,
          contentBoxSize: entry.contentBoxSize,
          borderBoxSize: entry.borderBoxSize,
          devicePixelContentBoxSize: entry.devicePixelContentBoxSize,
        });
      }
    });

    observer.observe(element);
    this._observers.set(element, observer);
    this._handlers.set(element, callback);

    return {
      disconnect: () => {
        observer.unobserve(element);
        this._observers.delete(element);
        this._handlers.delete(element);
      }
    };
  }

  /**
   * 响应式卡片 — 根据宽度自动调整布局
   */
  responsiveCards(container, breakpoints = [320, 480, 768, 1024]) {
    return this.observe(container, ({ width }) => {
      const cols = breakpoints.reduce((acc, bp) => {
        return width >= bp ? acc + 1 : acc;
      }, 0);

      container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      container.style.gap = `${Math.max(8, width / 60)}px`;
    });
  }

  /**
   * 自适应文字 — 根据容器宽度调整字号
   */
  responsiveText(element, options = {}) {
    const { minSize = 12, maxSize = 24, minContainer = 200, maxContainer = 800 } = options;

    return this.observe(element.parentElement, ({ width }) => {
      const ratio = Math.min(1, Math.max(0,
        (width - minContainer) / (maxContainer - minContainer)
      ));
      const fontSize = minSize + ratio * (maxSize - minSize);
      element.style.fontSize = `${fontSize}px`;
    });
  }
}

// 使用
const layout = new ResponsiveLayout();

// 响应式卡片网格
layout.responsiveCards(document.getElementById('card-grid'));

// 自适应标题
layout.responsiveText(document.getElementById('hero-title'));
```

### 示例 12: requestIdleCallback 后台任务调度

```javascript
/**
 * requestIdleCallback 后台任务调度器
 * 利用浏览器空闲时间执行低优先级任务
 */
class IdleScheduler {
  constructor() {
    this._queue = [];
    this._processing = false;
  }

  /**
   * 添加空闲任务
   */
  add(task, options = {}) {
    this._queue.push({
      fn: task,
      timeout: options.timeout || Infinity, // 最晚执行时间
      deadline: performance.now() + (options.timeout || Infinity),
    });
    this._schedule();
  }

  _schedule() {
    if (this._processing || this._queue.length === 0) return;
    this._processing = true;

    const scheduler = window.requestIdleCallback || ((fn) => {
      const start = performance.now();
      return setTimeout(() => fn({
        timeRemaining: () => Math.max(0, 50 - (performance.now() - start)),
        didTimeout: false,
      }), 1);
    });

    scheduler((deadline) => {
      this._process(deadline);
    }, { timeout: 2000 });
  }

  _process(deadline) {
    while (this._queue.length > 0 &&
           (deadline.timeRemaining() > 0 || deadline.didTimeout)) {
      const task = this._queue.shift();

      // 检查是否超时 (必须执行)
      if (performance.now() > task.deadline && task.timeout !== Infinity) {
        // 超时了，强制执行
      }

      try {
        task.fn();
      } catch (e) {
        console.error('Idle task error:', e);
      }
    }

    if (this._queue.length > 0) {
      this._schedule();
    } else {
      this._processing = false;
    }
  }

  /**
   * 批量处理 — 分片执行大数组
   */
  processInBatches(items, processFn, options = {}) {
    return new Promise((resolve) => {
      let index = 0;
      const batchSize = options.batchSize || 100;

      const processBatch = () => {
        const end = Math.min(index + batchSize, items.length);
        for (let i = index; i < end; i++) {
          processFn(items[i], i);
        }
        index = end;
        if (index < items.length) {
          return false; // 还有更多
        }
        resolve();
        return true; // 完成
      };

      this.add(() => {
        const done = processBatch();
        if (!done) this.add(processBatch);
      });
    });
  }
}

// 使用
const scheduler = new IdleScheduler();

// 后台索引构建
scheduler.add(() => {
  buildSearchIndex(largeDataset);
}, { timeout: 5000 });

// 大数组分片处理
scheduler.processInBatches(
  Array.from({ length: 100000 }, (_, i) => i),
  (item, index) => {
    // 处理每个元素
    processedItems.push(transform(item));
  },
  { batchSize: 500 }
).then(() => console.log('全部处理完成'));
```

### 示例 13: 高性能事件系统 — 节流/防抖/动画帧

```javascript
/**
 * 高性能事件系统
 * 整合节流、防抖、rAF 节流、被动事件
 */
class PerformanceEvents {
  /**
   * 防抖 — 延迟执行，持续触发则重置计时
   */
  static debounce(fn, delay = 250, options = {}) {
    const { leading = false, trailing = true, maxWait = Infinity } = options;
    let timer = null;
    let maxTimer = null;
    let lastArgs = null;
    let lastThis = null;
    let lastCallTime = 0;

    const invoke = () => {
      fn.apply(lastThis, lastArgs);
      lastArgs = lastThis = null;
    };

    const debounced = function (...args) {
      lastArgs = args;
      lastThis = this;
      const now = performance.now();
      const remaining = delay - (now - lastCallTime);
      lastCallTime = now;

      if (leading && !timer) {
        invoke();
      }

      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (trailing) invoke();
      }, remaining);

      // maxWait — 保证最晚执行
      if (maxWait !== Infinity && !maxTimer) {
        maxTimer = setTimeout(() => {
          maxTimer = null;
          if (lastArgs) invoke();
        }, maxWait);
      }
    };

    debounced.cancel = () => {
      clearTimeout(timer);
      clearTimeout(maxTimer);
      timer = maxTimer = null;
    };

    return debounced;
  }

  /**
   * 节流 — 固定间隔执行
   */
  static throttle(fn, interval = 100, options = {}) {
    const { leading = true, trailing = true } = options;
    let lastTime = 0;
    let timer = null;

    const throttled = function (...args) {
      const now = performance.now();
      const remaining = interval - (now - lastTime);

      if (remaining <= 0 || remaining > interval) {
        if (leading) {
          fn.apply(this, args);
          lastTime = now;
        }
      } else if (trailing && !timer) {
        timer = setTimeout(() => {
          timer = null;
          fn.apply(this, args);
          lastTime = performance.now();
        }, remaining);
      }
    };

    throttled.cancel = () => {
      clearTimeout(timer);
      timer = null;
    };

    return throttled;
  }

  /**
   * rAF 节流 — 与屏幕刷新率同步
   */
  static rafThrottle(fn) {
    let rafId = null;
    let lastArgs = null;
    let lastThis = null;

    const rafCallback = () => {
      rafId = null;
      fn.apply(lastThis, lastArgs);
    };

    const throttled = function (...args) {
      lastArgs = args;
      lastThis = this;
      if (!rafId) {
        rafId = requestAnimationFrame(rafCallback);
      }
    };

    throttled.cancel = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    };

    return throttled;
  }

  /**
   * 被动事件监听 — 提升滚动性能
   */
  static addPassiveListener(element, event, handler) {
    element.addEventListener(event, handler, { passive: true });
  }

  /**
   * 组合: 滚动事件高性能处理
   */
  static onScroll(element, handler, options = {}) {
    const { throttleMs = 16 } = options; // 默认 ~60fps
    const throttledHandler = this.rafThrottle(handler);

    element.addEventListener('scroll', throttledHandler, {
      passive: true,
      capture: false
    });

    return () => element.removeEventListener('scroll', throttledHandler);
  }
}

// 使用
// 搜索输入 — 防抖
const searchInput = document.getElementById('search');
searchInput.addEventListener('input',
  PerformanceEvents.debounce((e) => {
    performSearch(e.target.value);
  }, 300)
);

// 滚动加载 — rAF 节流 + passive
PerformanceEvents.onScroll(window, () => {
  checkLoadMore();
});

// 窗口 resize — 防抖
window.addEventListener('resize',
  PerformanceEvents.debounce(() => {
    recalculateLayout();
  }, 200)
);
```

### 示例 14: DOM 操作性能基准测试框架

```javascript
/**
 * DOM 操作性能基准测试框架
 * 科学对比不同 DOM 操作方式的性能
 */
class DOMBenchmark {
  constructor(name, iterations = 100) {
    this.name = name;
    this.iterations = iterations;
    this.results = {};
  }

  /**
   * 添加测试用例
   */
  add(name, fn) {
    this.results[name] = { times: [], ops: [] };
    this[`_bench_${name}`] = fn;
    return this;
  }

  /**
   * 运行所有测试
   */
  async run() {
    console.log(`\n🏁 DOM 基准测试: ${this.name}`);
    console.log(`迭代次数: ${this.iterations}`);
    console.log('='.repeat(70));

    const container = document.createElement('div');
    document.body.appendChild(container);

    for (const [name] of Object.entries(this.results)) {
      const times = [];
      const fn = this[`_bench_${name}`];

      // 预热
      fn(container, 10);

      for (let i = 0; i < this.iterations; i++) {
        container.innerHTML = '';
        const start = performance.now();
        fn(container, 1);
        times.push(performance.now() - start);
      }

      this.results[name].times = times;
      this.results[name].avg = times.reduce((a, b) => a + b, 0) / times.length;
      this.results[name].min = Math.min(...times);
      this.results[name].max = Math.max(...times);
      this.results[name].p50 = this._percentile(times, 50);
      this.results[name].p95 = this._percentile(times, 95);
      this.results[name].p99 = this._percentile(times, 99);
    }

    container.remove();
    this._printResults();
    return this.results;
  }

  _percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * p / 100) - 1;
    return sorted[Math.max(0, idx)];
  }

  _printResults() {
    console.log('\n📊 结果:');
    console.log('名称              | 平均(ms) | P50    | P95    | P99    | 最快   | 最慢');
    console.log('-'.repeat(70));

    const sorted = Object.entries(this.results)
      .sort((a, b) => a[1].avg - b[1].avg);

    sorted.forEach(([name, stats], rank) => {
      const marker = rank === 0 ? '🏆' : '  ';
      console.log(
        `${marker} ${name.padEnd(18)} | ${stats.avg.toFixed(3).padEnd(8)}| ` +
        `${stats.p50.toFixed(3).padEnd(6)}| ${stats.p95.toFixed(3).padEnd(6)}| ` +
        `${stats.p99.toFixed(3).padEnd(6)}| ${stats.min.toFixed(3).padEnd(6)}| ${stats.max.toFixed(3)}`
      );
    });

    // 相对性能
    const fastest = sorted[0][1].avg;
    console.log('\n相对性能:');
    sorted.forEach(([name, stats]) => {
      const ratio = (stats.avg / fastest).toFixed(1);
      const bar = '█'.repeat(Math.round(ratio * 5));
      console.log(`  ${name}: ${ratio}x (${bar})`);
    });
  }
}

// 使用 — 对比 5 种列表渲染方式
const bench = new DOMBenchmark('列表渲染方式对比', 200);

const items = Array.from({ length: 500 }, (_, i) => ({
  id: `item-${i}`,
  text: `Item ${i}`,
  value: Math.random()
}));

bench.add('innerHTML 拼接', (container, multiplier) => {
  container.innerHTML = items.map(item =>
    `<div data-id="${item.id}">${item.text}</div>`
  ).join('');
});

bench.add('DocumentFragment', (container, multiplier) => {
  const frag = document.createDocumentFragment();
  items.forEach(item => {
    const div = document.createElement('div');
    div.dataset.id = item.id;
    div.textContent = item.text;
    frag.appendChild(div);
  });
  container.appendChild(frag);
});

bench.add('createElement + appendChild', (container, multiplier) => {
  items.forEach(item => {
    const div = document.createElement('div');
    div.dataset.id = item.id;
    div.textContent = item.text;
    container.appendChild(div);
  });
});

bench.add('模板字符串 + insertAdjacentHTML', (container, multiplier) => {
  items.forEach(item => {
    container.insertAdjacentHTML('beforeend',
      `<div data-id="${item.id}">${item.text}</div>`
    );
  });
});

bench.add('批量 setHTML (现代)', (container, multiplier) => {
  // 模拟批量操作
  const html = items.map(item =>
    `<div data-id="${item.id}">${item.text}</div>`
  ).join('');
  container.innerHTML = html;
});

// 运行
// await bench.run();
```

---

## 四、综合实战 — 完整应用

### 示例 15: 高性能数据看板 (综合所有技术)

```javascript
/**
 * 高性能数据看板 — 综合应用事件委托 + DOM Diff + 性能优化
 * 功能: 实时数据更新、虚拟列表、懒加载、响应式布局
 */
class PerformanceDashboard {
  constructor(container) {
    this.container = container;
    this.data = [];
    this.filters = new Map();
    this._diff = new DOMDiff();
    this._batch = new BatchDOM();
    this._events = new PerformanceEvents();
    this._intersection = new IntersectionManager();
    this._resize = new ResponsiveLayout();

    this._init();
  }

  _init() {
    this._render();
    this._bindEvents();
    this._setupResponsive();
  }

  _render() {
    const vdom = h('div', { class: 'dashboard' }, [
      // 头部统计
      h('div', { class: 'stats-bar' }, [
        h('div', { class: 'stat-card' }, [
          h('span', { class: 'stat-value' }, [this.data.length]),
          h('span', { class: 'stat-label' }, ['总记录']),
        ]),
        h('div', { class: 'stat-card' }, [
          h('span', { class: 'stat-value' }, [this.filters.size]),
          h('span', { class: 'stat-label' }, ['活跃筛选']),
        ]),
      ]),

      // 工具栏
      h('div', { class: 'toolbar' }, [
        h('input', {
          class: 'search-input',
          type: 'text',
          placeholder: '搜索...',
          'data-action': 'search'
        }),
        h('button', {
          class: 'btn btn-primary',
          'data-action': 'add'
        }, ['➕ 新增']),
        h('button', {
          class: 'btn btn-secondary',
          'data-action': 'export'
        }, ['📥 导出']),
      ]),

      // 数据表格
      h('div', { class: 'table-container' }, [
        h('table', { class: 'data-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', { 'data-sort': 'name' }, ['名称 ↕']),
              h('th', { 'data-sort': 'value' }, ['数值 ↕']),
              h('th', { 'data-sort': 'status' }, ['状态 ↕']),
              h('th', {}, ['操作']),
            ]),
          ]),
          h('tbody', { class: 'data-tbody' },
            this._getVisibleData().map(item =>
              h('tr', { 'data-id': item.id, class: `status-${item.status}` }, [
                h('td', {}, [item.name]),
                h('td', {}, [item.value.toFixed(2)]),
                h('td', {}, [
                  h('span', { class: `badge badge-${item.status}` }, [item.status])
                ]),
                h('td', { class: 'actions' }, [
                  h('button', {
                    class: 'btn-icon btn-edit',
                    'data-action': 'edit',
                    'data-id': item.id
                  }, ['✏️']),
                  h('button', {
                    class: 'btn-icon btn-delete',
                    'data-action': 'delete',
                    'data-id': item.id
                  }, ['🗑️']),
                ]),
              ])
            )
          ),
        ]),
      ]),

      // 滚动哨兵 (无限滚动)
      h('div', { id: 'scroll-sentinel', class: 'sentinel' }, []),
    ]);

    this._diff.patch(this.container, this._oldVNode, vdom);
    this._oldVNode = vdom;
  }

  _getVisibleData() {
    let data = [...this.data];

    // 应用筛选
    if (this.filters.has('search')) {
      const query = this.filters.get('search').toLowerCase();
      data = data.filter(item =>
        item.name.toLowerCase().includes(query)
      );
    }

    // 应用排序
    if (this.filters.has('sort')) {
      const { field, dir } = this.filters.get('sort');
      data.sort((a, b) => {
        const va = a[field], vb = b[field];
        return dir === 'asc' ? va > vb ? 1 : -1 : va < vb ? 1 : -1;
      });
    }

    return data;
  }

  _bindEvents() {
    // 事件委托 — 所有操作
    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      switch (action) {
        case 'add': this._handleAdd(); break;
        case 'edit': this._handleEdit(id); break;
        case 'delete': this._handleDelete(id); break;
        case 'export': this._handleExport(); break;
      }
    });

    // 排序 — 点击表头
    this.container.addEventListener('click', (e) => {
      const th = e.target.closest('[data-sort]');
      if (!th) return;

      const field = th.dataset.sort;
      const current = this.filters.get('sort');
      const dir = current?.field === field && current.dir === 'asc' ? 'desc' : 'asc';

      if (dir === 'asc' && !current) {
        this.filters.delete('sort');
      } else {
        this.filters.set('sort', { field, dir });
      }
      this._render();
    });

    // 搜索 — 防抖
    this.container.addEventListener('input',
      this._events.debounce((e) => {
        const input = e.target.closest('.search-input');
        if (!input) return;
        const value = input.value.trim();
        if (value) {
          this.filters.set('search', value);
        } else {
          this.filters.delete('search');
        }
        this._render();
      }, 300)
    );

    // 无限滚动
    this._intersection.infiniteScroll(
      this.container.querySelector('#scroll-sentinel'),
      () => this._loadMore()
    );
  }

  _setupResponsive() {
    this._resize.responsiveCards(
      this.container.querySelector('.stats-bar')
    );
  }

  // 数据操作
  _handleAdd() {
    const newItem = {
      id: `item-${Date.now()}`,
      name: `新记录 ${this.data.length + 1}`,
      value: Math.random() * 1000,
      status: ['active', 'pending', 'archived'][Math.floor(Math.random() * 3)]
    };
    this.data.push(newItem);
    this._render();
  }

  _handleDelete(id) {
    const idx = this.data.findIndex(d => d.id === id);
    if (idx >= 0) {
      this.data.splice(idx, 1);
      this._render();
    }
  }

  _handleEdit(id) {
    const item = this.data.find(d => d.id === id);
    if (item) {
      item.value = Math.random() * 1000;
      this._render();
    }
  }

  _handleExport() {
    const csv = [
      ['名称', '数值', '状态'].join(','),
      ...this.data.map(d => [d.name, d.value, d.status].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async _loadMore() {
    // 模拟异步加载
    const newItems = Array.from({ length: 50 }, (_, i) => ({
      id: `item-${Date.now()}-${i}`,
      name: `批量数据 ${this.data.length + i + 1}`,
      value: Math.random() * 1000,
      status: ['active', 'pending', 'archived'][Math.floor(Math.random() * 3)]
    }));
    this.data.push(...newItems);
    this._render();
  }

  setData(data) {
    this.data = data;
    this._render();
  }

  destroy() {
    this._intersection.destroy();
    this._diff = null;
    this._batch = null;
  }
}

// 使用
// const dashboard = new PerformanceDashboard(document.getElementById('dashboard'));
// dashboard.setData(Array.from({ length: 200 }, (_, i) => ({
//   id: `item-${i}`,
//   name: `记录 ${i + 1}`,
//   value: Math.random() * 1000,
//   status: ['active', 'pending', 'archived'][Math.floor(Math.random() * 3)]
// })));
```

---

## 五、核心知识点总结

### 事件委托核心要点

| 要点 | 说明 |
|------|------|
| 原理 | 事件冒泡 + `Element.closest()` 匹配 |
| 优势 | 减少监听器数量、自动支持动态元素、内存占用低 |
| 注意 | 不是所有事件都冒泡 (focus/blur 用 capture)、`stopPropagation` 会中断委托链 |
| 最佳实践 | 委托到最近的稳定父容器、用 `closest` 而非 `matches`、考虑 `capture` 阶段 |

### DOM Diff 核心要点

| 要点 | 说明 |
|------|------|
| 同层比较 | 只比较同一层级的节点，不跨层 |
| Key 优化 | 有 key 时走双端比较，无 key 时逐位对比 |
| 最小操作 | diff 目标是生成最少的 DOM 操作 |
| 框架对比 | Vue2 双端比较 / Vue3 最长递增子序列 / React 链表遍历 |

### 性能优化核心要点

| 技术 | 场景 | 收益 |
|------|------|------|
| DocumentFragment | 批量插入 | 减少 reflow 次数 |
| requestAnimationFrame | 动画/滚动 | 与屏幕刷新同步，避免掉帧 |
| IntersectionObserver | 懒加载/可见性 | 替代 scroll 事件，性能提升 10x+ |
| ResizeObserver | 响应式布局 | 替代 window resize，精准监听 |
| requestIdleCallback | 后台任务 | 不阻塞主线程 |
| 批量读写 | 避免 Layout Thrashing | 减少 reflow 从 N 次到 1-2 次 |
| 虚拟列表 | 大数据列表 | DOM 节点从 N 降到 ~20 |
| 事件委托 | 大量子元素事件 | 监听器从 N 降到 1 |

---

## 六、面试自测题

1. 事件委托的原理是什么？哪些事件不能委托？
2. `closest()` 和 `matches()` 的区别？
3. DOM Diff 为什么只比较同层节点？
4. Key 在 Diff 中的作用？没有 Key 会怎样？
5. 什么是 Layout Thrashing？如何避免？
6. `requestAnimationFrame` vs `setTimeout` 在动画中的区别？
7. `IntersectionObserver` 相比 scroll 事件的优势？
8. `ResizeObserver` 能监听到什么 `window.resize` 不能的？
9. `requestIdleCallback` 的超时机制如何工作？
10. 虚拟列表的核心原理是什么？如何处理滚动位置？
11. DocumentFragment 为什么比直接 appendChild 快？
12. passive 事件监听器的作用？什么时候用？
13. 防抖和节流的本质区别？各适合什么场景？
14. Vue3 的 Diff 算法相比 Vue2 有什么改进？

---

*专项训练完成 ✅ | 14 个完整示例 | 涵盖事件委托/DOM Diff/性能优化三大主题*
*下次训练建议: 结合 Vue3 虚拟 DOM 源码深入理解 Diff 算法*
