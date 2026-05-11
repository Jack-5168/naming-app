# 原生 DOM API 高级进阶：Shadow DOM / Selection / Drag & Drop / 表单 / 可访问性

> 2026-05-01 07:00 | 专项训练 #119
> 主题：原生 DOM API 高级进阶，覆盖 Shadow DOM、Selection API、Drag & Drop、表单、可访问性、Clipboard 等
> 前置：4/28 基础 DOM 15 示例 / 4/30 事件委托+Diff+性能优化 13 示例

---

## 目录

1. [Shadow DOM & Web Components](#1-shadow-dom--web-components)
   - 示例 1：Shadow DOM 样式隔离
   - 示例 2：Slots 分发 & 复合组件
2. [Selection API & Range](#2-selection-api--range)
   - 示例 3：文本高亮标注工具
   - 示例 4：Range 范围操作（查找替换）
3. [Drag & Drop API](#3-drag--drop-api)
   - 示例 5：拖拽排序（Sortable List）
   - 示例 6：文件拖拽上传
4. [表单 & 输入控制](#4-表单--输入控制)
   - 示例 7：表单验证引擎（Constraint Validation API）
   - 示例 8：输入掩码 & 格式化
5. [可访问性 (a11y)](#5-可访问性-a11y)
   - 示例 9：ARIA 活区 & 键盘导航组件
   - 示例 10：Focus Trap（模态框焦点陷阱）
6. [Clipboard API & 剪贴板](#6-clipboard-api--剪贴板)
   - 示例 11：富文本剪贴板操作
7. [ResizeObserver & Container Queries](#7-resizeobserver--container-queries)
   - 示例 12：响应式图表容器

---

## 1. Shadow DOM & Web Components

### 示例 1：Shadow DOM 样式隔离

> Shadow DOM 是 Web Components 的核心，提供真正的样式和 DOM 封装，CSS 不会泄漏到外部，外部 CSS 也不会影响内部。

```js
/**
 * ShadowDOMDemo — Shadow DOM 样式隔离演示
 *
 * 关键概念：
 * - Shadow Root: 封装的 DOM 子树根节点
 * - Shadow Host: 承载 Shadow Root 的宿主元素
 * - open/closed 模式: open 允许外部访问 shadowRoot，closed 不允许
 * - CSS 封装: shadow 内样式不影响外部，外部样式不影响内部（除非用 ::part）
 * - 样式继承: 部分 CSS 属性会从 light DOM 继承到 shadow DOM（color, font-family 等）
 */

// --- 方式 1: 使用 <template> + Shadow DOM ---
function createStyledCard(host, data) {
  const shadow = host.attachShadow({ mode: 'open' });

  const template = document.createElement('template');
  template.innerHTML = `
    <style>
      /* 这些样式只影响 shadow 内部 */
      .card {
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 16px;
        font-family: inherit; /* 继承外部 font-family */
        color: var(--card-color, #333); /* CSS 自定义属性可穿透 */
        background: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      .card h3 {
        margin: 0 0 8px;
        color: var(--card-title-color, #1a73e8); /* 外部可覆盖 */
      }
      .card p {
        margin: 0;
        color: var(--card-text-color, #666);
        line-height: 1.5;
      }
      .card .meta {
        margin-top: 12px;
        font-size: 12px;
        color: #999;
      }
      /* 外部 .card 样式不会影响这里 */
    </style>
    <div class="card">
      <h3><slot name="title">默认标题</slot></h3>
      <p><slot>默认内容</slot></p>
      <div class="meta">
        <slot name="meta"></slot>
      </div>
    </div>
  `;

  shadow.appendChild(template.content.cloneNode(true));
}

// --- 方式 2: 纯 JS 构建 Shadow DOM ---
function createRatingWidget(host, options = {}) {
  const {
    maxStars = 5,
    value = 0,
    onChange = () => {}
  } = options;

  const shadow = host.attachShadow({ mode: 'open' });

  // 创建样式
  const style = document.createElement('style');
  style.textContent = `
    :host {
      display: inline-block;
      --star-color: #ffd700;
      --star-empty: #ddd;
      --star-size: 24px;
    }
    .stars {
      display: flex;
      gap: 4px;
      cursor: pointer;
    }
    .star {
      font-size: var(--star-size);
      color: var(--star-empty);
      transition: color 0.15s ease, transform 0.15s ease;
      user-select: none;
    }
    .star.filled {
      color: var(--star-color);
    }
    .star:hover {
      transform: scale(1.2);
    }
    .star:hover ~ .star {
      color: var(--star-empty); /* hover 时后面的变空 */
    }
  `;

  // 创建容器
  const container = document.createElement('div');
  container.className = 'stars';
  container.setAttribute('role', 'radiogroup');
  container.setAttribute('aria-label', '评分');

  const stars = [];
  for (let i = 0; i < maxStars; i++) {
    const star = document.createElement('span');
    star.className = 'star' + (i < value ? ' filled' : '');
    star.textContent = '★';
    star.setAttribute('role', 'radio');
    star.setAttribute('aria-checked', i < value ? 'true' : 'false');
    star.setAttribute('aria-label', `${i + 1} 星`);
    star.tabIndex = i === 0 ? 0 : -1;
    star.dataset.index = i;

    star.addEventListener('click', () => {
      const newValue = i + 1;
      stars.forEach((s, idx) => {
        s.classList.toggle('filled', idx < newValue);
        s.setAttribute('aria-checked', idx < newValue ? 'true' : 'false');
      });
      onChange(newValue);
    });

    // 键盘导航
    star.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = stars[(i + 1) % maxStars];
        next.focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        const prev = stars[(i - 1 + maxStars) % maxStars];
        next.focus();
      }
    });

    container.appendChild(star);
    stars.push(star);
  }

  shadow.appendChild(style);
  shadow.appendChild(container);

  return {
    setValue(v) {
      stars.forEach((s, idx) => {
        s.classList.toggle('filled', idx < v);
        s.setAttribute('aria-checked', idx < v ? 'true' : 'false');
      });
    },
    getValue() {
      return stars.filter(s => s.classList.contains('filled')).length;
    }
  };
}

// --- 方式 3: 自定义元素 (Custom Element) + Shadow DOM ---
class Avatar extends HTMLElement {
  static get observedAttributes() {
    return ['src', 'name', 'size', 'fallback'];
  }

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._render();
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback() {
    this._render();
  }

  _render() {
    const src = this.getAttribute('src') || '';
    const name = this.getAttribute('name') || '';
    const size = parseInt(this.getAttribute('size')) || 40;
    const fallback = this.getAttribute('fallback') || name.charAt(0).toUpperCase() || '?';

    this._shadow.innerHTML = `
      <style>
        :host {
          display: inline-block;
          width: ${size}px;
          height: ${size}px;
        }
        .avatar {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          background: #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${size * 0.4}px;
          font-weight: 600;
          color: #666;
          overflow: hidden;
        }
        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      </style>
      <div class="avatar" title="${name}">
        ${src
          ? `<img src="${src}" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
             <span style="display:none;">${fallback}</span>`
          : fallback
        }
      </div>
    `;
  }
}

// 注册自定义元素
if (!customElements.get('app-avatar')) {
  customElements.define('app-avatar', Avatar);
}

// ===== 使用示例 =====
console.log('✅ 示例 1: Shadow DOM 样式隔离');
console.log('  - 三种创建方式: template / 纯JS / Custom Element');
console.log('  - CSS 封装: shadow 内外样式互不干扰');
console.log('  - CSS 自定义属性: 可通过 --var 穿透样式');
console.log('  - ::part 选择器: 可暴露内部元素供外部样式化');
```

### 示例 2：Slots 分发 & 复合组件

> Slot 是 Shadow DOM 的内容分发机制，允许 light DOM 内容投射到 shadow DOM 的指定位置。

```js
/**
 * SlotDemo — Slot 分发机制演示
 *
 * 关键概念：
 * - 默认 slot: <slot> 无 name，接收所有未命名内容
 * - 命名 slot: <slot name="xxx"> 接收对应 slot="xxx" 的内容
 * - slot 回退内容: <slot>回退内容</slot>，无投射时显示
 * - slotchange 事件: 监听 slot 内容变化
 * - assignedElements(): 获取投射到 slot 的元素
 * - 多层嵌套: light DOM → shadow DOM → slot → 另一个 shadow DOM
 */

// --- 复合组件: Accordion（手风琴） ---
class Accordion extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._shadow.innerHTML = `
      <style>
        :host {
          display: block;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
        }
        ::slotted(accordion-item) {
          border-bottom: 1px solid #e0e0e0;
        }
        ::slotted(accordion-item:last-child) {
          border-bottom: none;
        }
      </style>
      <slot></slot>
    `;
  }

  connectedCallback() {
    // 监听 slot 变化
    const slot = this._shadow.querySelector('slot');
    slot.addEventListener('slotchange', () => {
      const items = slot.assignedElements();
      console.log(`Accordion 包含 ${items.length} 个 item`);
    });
  }
}

class AccordionItem extends HTMLElement {
  static get observedAttributes() {
    return ['open', 'title'];
  }

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._isOpen = this.hasAttribute('open');
  }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'open') {
      this._isOpen = newVal !== null;
      this._updateState();
    }
  }

  _render() {
    const title = this.getAttribute('title') || '未命名';
    this._shadow.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          cursor: pointer;
          background: #fafafa;
          user-select: none;
          transition: background 0.15s;
        }
        .header:hover {
          background: #f0f0f0;
        }
        .header:focus-visible {
          outline: 2px solid #1a73e8;
          outline-offset: -2px;
        }
        .title {
          font-weight: 500;
          color: #333;
        }
        .icon {
          transition: transform 0.25s ease;
          font-size: 12px;
          color: #999;
        }
        .icon.open {
          transform: rotate(180deg);
        }
        .content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease, padding 0.3s ease;
          padding: 0 16px;
        }
        .content.open {
          max-height: 500px;
          padding: 12px 16px;
        }
      </style>
      <div class="header" role="button" tabindex="0" aria-expanded="${this._isOpen}">
        <span class="title">${title}</span>
        <span class="icon ${this._isOpen ? 'open' : ''}">▼</span>
      </div>
      <div class="content ${this._isOpen ? 'open' : ''}">
        <slot></slot>
      </div>
    `;
  }

  _bindEvents() {
    const header = this._shadow.querySelector('.header');
    header.addEventListener('click', () => this.toggle());
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle() {
    this._isOpen = !this._isOpen;
    this._updateState();
    this.dispatchEvent(new CustomEvent('toggle', {
      detail: { open: this._isOpen },
      bubbles: true
    }));
  }

  _updateState() {
    const header = this._shadow.querySelector('.header');
    const content = this._shadow.querySelector('.content');
    const icon = this._shadow.querySelector('.icon');
    if (header) header.setAttribute('aria-expanded', this._isOpen);
    if (content) content.classList.toggle('open', this._isOpen);
    if (icon) icon.classList.toggle('open', this._isOpen);
  }

  open() {
    this.setAttribute('open', '');
  }

  close() {
    this.removeAttribute('open');
  }
}

// 注册
if (!customElements.get('x-accordion')) customElements.define('x-accordion', Accordion);
if (!customElements.get('x-accordion-item')) customElements.define('x-accordion-item', AccordionItem);

// --- 使用方式 (HTML) ---
/*
<x-accordion>
  <x-accordion-item title="什么是 Shadow DOM?" open>
    <p>Shadow DOM 是 Web Components 的核心技术之一...</p>
  </x-accordion-item>
  <x-accordion-item title="什么是 Custom Elements?">
    <p>Custom Elements 允许你定义自己的 HTML 标签...</p>
  </x-accordion-item>
  <x-accordion-item title="Slot 是什么?">
    <p>Slot 是内容分发机制，允许 light DOM 投射到 shadow DOM...</p>
  </x-accordion-item>
</x-accordion>
*/

// --- 高级: Fallback Content + Slot 监听 ---
class UserProfile extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this._shadow.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .profile {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .info { flex: 1; }
        .name { font-size: 18px; font-weight: 600; }
        .bio { color: #666; margin-top: 4px; }
        ::slotted([slot="avatar"]) {
          width: 64px;
          height: 64px;
          border-radius: 50%;
        }
      </style>
      <div class="profile">
        <slot name="avatar">
          <!-- 回退内容: 无 avatar slot 时显示 -->
          <div style="width:64px;height:64px;border-radius:50%;background:#ddd;display:flex;align-items:center;justify-content:center;font-size:24px;">👤</div>
        </slot>
        <div class="info">
          <div class="name">
            <slot name="name">匿名用户</slot>
          </div>
          <div class="bio">
            <slot name="bio">暂无简介</slot>
          </div>
        </div>
      </div>
    `;

    // 监听 slot 变化
    this._shadow.querySelectorAll('slot').forEach(slot => {
      slot.addEventListener('slotchange', () => {
        const elements = slot.assignedElements();
        console.log(`Slot "${slot.name || 'default'}" 变化:`, elements.length, '个元素');
      });
    });
  }
}

if (!customElements.get('user-profile')) customElements.define('user-profile', UserProfile);

console.log('✅ 示例 2: Slots 分发 & 复合组件');
console.log('  - 默认 slot / 命名 slot / 回退内容');
console.log('  - slotchange 事件 + assignedElements()');
console.log('  - ::slotted() 选择器: 在 shadow 内样式化 light DOM 元素');
console.log('  - 复合组件: Accordion 组合使用 shadow + slot');
```

---

## 2. Selection API & Range

### 示例 3：文本高亮标注工具

> Selection API + Range 允许操作用户选中的文本区域，实现标注、高亮、复制等功能。

```js
/**
 * TextHighlighter — 文本高亮标注工具
 *
 * 核心 API:
 * - window.getSelection(): 获取当前选区
 * - Selection.getRangeAt(0): 获取第一个 Range
 * - Range: 表示文档中的一段连续区域
 * - Range.surroundContents(): 用元素包裹选区
 * - Range.extractContents(): 提取选区内容
 * - Range.cloneRange(): 克隆 Range
 * - Selection.toString(): 获取选中文本
 */

class TextHighlighter {
  constructor(container) {
    this.container = typeof container === 'string'
      ? document.querySelector(container) : container;
    this.highlights = []; // { id, text, color, range }
    this._nextId = 1;
    this._colors = ['#ffeb3b', '#4caf50', '#2196f3', '#ff9800', '#e91e63'];
    this._colorIndex = 0;

    this._bindEvents();
  }

  _bindEvents() {
    this.container.addEventListener('mouseup', (e) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const range = selection.getRangeAt(0);
      // 确保选区完全在容器内
      if (!this.container.contains(range.commonAncestorContainer)) return;

      // 显示工具栏
      this._showToolbar(range, selection);
    });
  }

  _showToolbar(range, selection) {
    // 移除旧工具栏
    this._removeToolbar();

    const toolbar = document.createElement('div');
    toolbar.className = 'highlight-toolbar';
    toolbar.style.cssText = `
      position: absolute;
      background: #333;
      border-radius: 6px;
      padding: 4px;
      display: flex;
      gap: 4px;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;

    // 颜色按钮
    this._colors.forEach((color) => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        width: 24px; height: 24px; border: 2px solid transparent;
        border-radius: 50%; background: ${color}; cursor: pointer;
        padding: 0;
      `;
      btn.title = `高亮为 ${color}`;
      btn.addEventListener('click', () => {
        this.highlightSelection(range, color);
        this._removeToolbar();
        selection.removeAllRanges();
      });
      toolbar.appendChild(btn);
    });

    // 删除按钮
    const delBtn = document.createElement('button');
    delBtn.textContent = '✕';
    delBtn.style.cssText = `
      width: 24px; height: 24px; border: none; border-radius: 50%;
      background: #f44336; color: white; cursor: pointer; font-size: 12px;
      display: flex; align-items: center; justify-content: center;
    `;
    delBtn.addEventListener('click', () => {
      this.removeHighlightAtRange(range);
      this._removeToolbar();
      selection.removeAllRanges();
    });
    toolbar.appendChild(delBtn);

    // 定位工具栏
    const rect = range.getBoundingClientRect();
    toolbar.style.left = `${rect.left + rect.width / 2 - 60}px`;
    toolbar.style.top = `${rect.top + window.scrollY - 40}px`;

    document.body.appendChild(toolbar);
    this._toolbar = toolbar;

    // 点击其他地方关闭
    const closeHandler = (e) => {
      if (!toolbar.contains(e.target)) {
        this._removeToolbar();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
  }

  _removeToolbar() {
    if (this._toolbar) {
      this._toolbar.remove();
      this._toolbar = null;
    }
  }

  /** 高亮选中文本 */
  highlightSelection(range, color) {
    // 标准化 range（只高亮完整文本节点）
    const text = range.toString().trim();
    if (!text) return;

    const mark = document.createElement('mark');
    mark.style.backgroundColor = color;
    mark.style.borderRadius = '2px';
    mark.style.padding = '0 2px';
    mark.dataset.highlightId = this._nextId;

    try {
      range.surroundContents(mark);
      this.highlights.push({
        id: this._nextId++,
        text,
        color,
        element: mark
      });
      return true;
    } catch (e) {
      // surroundContents 失败（跨节点）→ 用更复杂的方式
      console.warn('跨节点高亮需要更复杂的实现:', e.message);
      return false;
    }
  }

  /** 移除指定位置的标注 */
  removeHighlightAtRange(range) {
    const marks = this.container.querySelectorAll('mark');
    for (const mark of marks) {
      const markRange = document.createRange();
      markRange.selectNodeContents(mark);
      if (markRange.compareBoundaryPoints(Range.START_TO_START, range) <= 0 &&
          markRange.compareBoundaryPoints(Range.END_TO_END, range) >= 0) {
        // 展开 mark 标签
        const parent = mark.parentNode;
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
        parent.normalize(); // 合并相邻文本节点
        return true;
      }
    }
    return false;
  }

  /** 清除所有标注 */
  clearAll() {
    this.highlights = [];
    const marks = this.container.querySelectorAll('mark');
    marks.forEach(mark => {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
      parent.normalize();
    });
  }

  /** 获取所有标注 */
  getHighlights() {
    return this.highlights.map(h => ({ ...h }));
  }

  destroy() {
    this._removeToolbar();
    this.clearAll();
  }
}

// --- Range 工具函数 ---
/**
 * getSelectionInfo — 获取选区详细信息
 */
function getSelectionInfo() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return null;

  const range = sel.getRangeAt(0);
  return {
    text: sel.toString(),
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    startContainer: range.startContainer.nodeName,
    endContainer: range.endContainer.nodeName,
    commonAncestor: range.commonAncestorContainer.nodeName,
    collapsed: range.collapsed,
    rect: range.getBoundingClientRect(),
  };
}

/**
 * selectText — 选中容器内指定文本
 */
function selectText(container, searchText) {
  const treeWalker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node;
  while (node = treeWalker.nextNode()) {
    const idx = node.textContent.indexOf(searchText);
    if (idx !== -1) {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + searchText.length);

      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    }
  }
  return false;
}

console.log('✅ 示例 3: 文本高亮标注工具');
console.log('  - Selection API: 获取/操作用户选区');
console.log('  - Range API: 创建/操作文本范围');
console.log('  - surroundContents: 用元素包裹选区');
console.log('  - TreeWalker + Range: 搜索并选中指定文本');
```

### 示例 4：Range 范围操作（查找替换）

> 利用 Range API 实现文档内查找替换、文本提取等高级操作。

```js
/**
 * TextEditor — 基于 Range 的文本编辑器工具
 *
 * 核心操作:
 * - Range.setStart/setEnd: 精确设置范围边界
 * - Range.compareBoundaryPoints: 比较两个 Range
 * - Range.cloneContents: 克隆范围内容
 * - Range.deleteContents: 删除范围内容
 * - Range.insertNode: 在范围插入节点
 * - Range.collapse: 折叠范围到起点或终点
 */

class TextEditor {
  constructor(container) {
    this.container = typeof container === 'string'
      ? document.querySelector(container) : container;
  }

  /**
   * findAll — 查找所有匹配文本
   * @returns {Range[]} 匹配的 Range 数组
   */
  findAll(searchText, caseSensitive = false) {
    const results = [];
    const flags = caseSensitive ? '' : 'i';
    const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

    const treeWalker = document.createTreeWalker(
      this.container,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node;
    while (node = treeWalker.nextNode()) {
      const text = node.textContent;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        results.push(range);
      }
    }

    return results;
  }

  /**
   * highlightAll — 高亮所有匹配项
   */
  highlightAll(searchText, color = '#ffeb3b', caseSensitive = false) {
    // 先清除旧高亮
    this.clearHighlights();

    const ranges = this.findAll(searchText, caseSensitive);
    ranges.forEach(range => {
      const mark = document.createElement('mark');
      mark.style.backgroundColor = color;
      try {
        range.surroundContents(mark);
      } catch (e) {
        // 跨节点情况需要更复杂处理
      }
    });

    return ranges.length;
  }

  /**
   * replaceAll — 替换所有匹配项
   */
  replaceAll(searchText, replacement, caseSensitive = false) {
    const flags = caseSensitive ? '' : 'i';
    const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g' + flags);
    let count = 0;

    const treeWalker = document.createTreeWalker(
      this.container,
      NodeFilter.SHOW_TEXT,
      null
    );

    const nodesToProcess = [];
    let node;
    while (node = treeWalker.nextNode()) {
      if (regex.test(node.textContent)) {
        nodesToProcess.push(node);
        regex.lastIndex = 0; // 重置
      }
    }

    for (const textNode of nodesToProcess) {
      const html = textNode.textContent.replace(regex, (match) => {
        count++;
        return replacement;
      });

      if (html !== textNode.textContent) {
        const frag = document.createDocumentFragment();
        // 简单替换：创建新文本节点
        const newTextNode = document.createTextNode(html);
        textNode.parentNode.replaceChild(newTextNode, textNode);
      }
    }

    return count;
  }

  /**
   * extractTextBetween — 提取两个标记之间的文本
   */
  extractTextBetween(startMarker, endMarker) {
    const results = [];
    const treeWalker = document.createTreeWalker(
      this.container,
      NodeFilter.SHOW_TEXT,
      null
    );

    const allText = this.container.textContent;
    let startIndex = 0;

    while (true) {
      const startIdx = allText.indexOf(startMarker, startIndex);
      if (startIdx === -1) break;

      const endIdx = allText.indexOf(endMarker, startIdx + startMarker.length);
      if (endIdx === -1) break;

      const range = document.createRange();
      range.setStart(this.container, 0);
      range.setEnd(this.container, 0);

      // 使用 range 定位
      const textRange = document.createRange();
      textRange.setStart(this.container, 0);
      textRange.setEnd(this.container, 0);

      // 简化：直接提取文本
      const extracted = allText.substring(startIdx + startMarker.length, endIdx);
      results.push(extracted);

      startIndex = endIdx + endMarker.length;
    }

    return results;
  }

  /** 清除高亮 */
  clearHighlights() {
    const marks = this.container.querySelectorAll('mark');
    marks.forEach(mark => {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
      parent.normalize();
    });
  }

  /** 获取纯文本 */
  getText() {
    return this.container.textContent;
  }
}

console.log('✅ 示例 4: Range 范围操作 — 查找/高亮/替换/提取');
```

---

## 3. Drag & Drop API

### 示例 5：拖拽排序（Sortable List）

> 原生 Drag & Drop API 实现列表项拖拽排序，不依赖任何库。

```js
/**
 * SortableList — 原生拖拽排序列表
 *
 * 核心事件:
 * - dragstart: 开始拖拽
 * - dragend: 结束拖拽
 * - dragover: 拖拽经过目标（需 preventDefault 允许 drop）
 * - dragenter: 进入目标
 * - dragleave: 离开目标
 * - drop: 放置
 *
 * DataTransfer:
 * - setData/getData: 存储/读取拖拽数据
 * - effectAllowed/dropEffect: 拖拽效果
 * - setDragImage: 自定义拖拽图像
 */

class SortableList {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container) : container;
    this.itemSelector = options.itemSelector || '.sortable-item';
    this.handleSelector = options.handleSelector || null; // 可选：只有 handle 可拖拽
    this.animationDuration = options.animationDuration || 150;
    this.placeholderClass = options.placeholderClass || 'sortable-placeholder';
    this.draggingClass = options.draggingClass || 'sortable-dragging';
    this.overClass = options.overClass || 'sortable-over';

    this._draggedItem = null;
    this._placeholder = null;
    this._onDragStart = this._onDragStart.bind(this);
    this._onDragEnd = this._onDragEnd.bind(this);
    this._onDragOver = this._onDragOver.bind(this);
    this._onDrop = this._onDrop.bind(this);

    this._init();
  }

  _init() {
    this.container.style.position = 'relative';
    this.container.addEventListener('dragstart', this._onDragStart);
    this.container.addEventListener('dragend', this._onDragEnd);
    this.container.addEventListener('dragover', this._onDragOver);
    this.container.addEventListener('drop', this._onDrop);
  }

  _onDragStart(e) {
    const item = e.target.closest(this.itemSelector);
    if (!item) return;

    // 如果有 handle，检查是否从 handle 开始拖拽
    if (this.handleSelector && !e.target.closest(this.handleSelector)) {
      e.preventDefault();
      return;
    }

    this._draggedItem = item;
    item.classList.add(this.draggingClass);
    item.draggable = false; // 防止拖拽过程中被再次拖拽

    // 设置拖拽数据
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.id || '');

    // 自定义拖拽图像
    const clone = item.cloneNode(true);
    clone.style.width = `${item.offsetWidth}px`;
    clone.style.opacity = '0.8';
    clone.style.transform = 'rotate(2deg)';
    clone.style.position = 'absolute';
    clone.style.top = '-9999px';
    document.body.appendChild(clone);
    e.dataTransfer.setDragImage(clone, e.offsetX, e.offsetY);
    setTimeout(() => clone.remove(), 0);

    // 创建占位符
    this._placeholder = document.createElement('div');
    this._placeholder.className = this.placeholderClass;
    this._placeholder.style.height = `${item.offsetHeight}px`;
    this._placeholder.style.borderTop = '2px dashed #1a73e8';
    this._placeholder.style.margin = '4px 0';

    // 触发自定义事件
    item.dispatchEvent(new CustomEvent('sortstart', {
      detail: { item, originalEvent: e }
    }));
  }

  _onDragEnd(e) {
    if (!this._draggedItem) return;

    this._draggedItem.classList.remove(this.draggingClass);
    this._draggedItem.draggable = true;

    // 移除占位符
    if (this._placeholder && this._placeholder.parentNode) {
      this._placeholder.remove();
    }

    // 触发自定义事件
    this._draggedItem.dispatchEvent(new CustomEvent('sortend', {
      detail: { item: this._draggedItem }
    }));

    this._draggedItem = null;
    this._placeholder = null;

    // 清除所有 over 状态
    this.container.querySelectorAll(`.${this.overClass}`).forEach(el => {
      el.classList.remove(this.overClass);
    });
  }

  _onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!this._draggedItem) return;

    const target = e.target.closest(this.itemSelector);
    if (!target || target === this._draggedItem) return;

    // 移除之前的 over 状态
    this.container.querySelectorAll(`.${this.overClass}`).forEach(el => {
      if (el !== target) el.classList.remove(this.overClass);
    });
    target.classList.add(this.overClass);

    // 判断插入位置（上半部分还是下半部分）
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    if (e.clientY < midpoint) {
      // 插入到目标之前
      if (this._placeholder.parentNode !== this.container) {
        this.container.insertBefore(this._placeholder, target);
      } else if (this._placeholder.previousSibling !== target) {
        this.container.insertBefore(this._placeholder, target);
      }
    } else {
      // 插入到目标之后
      const next = target.nextElementSibling;
      if (next) {
        this.container.insertBefore(this._placeholder, next);
      } else {
        this.container.appendChild(this._placeholder);
      }
    }
  }

  _onDrop(e) {
    e.preventDefault();
    if (!this._draggedItem || !this._placeholder) return;

    // 将拖拽项移动到占位符位置
    this.container.insertBefore(this._draggedItem, this._placeholder);

    // 触发自定义事件
    this.container.dispatchEvent(new CustomEvent('sort', {
      detail: {
        item: this._draggedItem,
        newIndex: Array.from(this.container.children)
          .filter(c => c.classList.contains(this.itemSelector.replace('.', '')))
          .indexOf(this._draggedItem)
      }
    }));
  }

  /** 获取当前排序 */
  getOrder() {
    return Array.from(this.container.children)
      .filter(c => c.matches(this.itemSelector))
      .map(c => c.dataset.id || c.textContent.trim());
  }

  /** 启用/禁用拖拽 */
  setEnabled(enabled) {
    this.container.querySelectorAll(this.itemSelector).forEach(item => {
      item.draggable = enabled;
    });
  }

  destroy() {
    this.container.removeEventListener('dragstart', this._onDragStart);
    this.container.removeEventListener('dragend', this._onDragEnd);
    this.container.removeEventListener('dragover', this._onDragOver);
    this.container.removeEventListener('drop', this._onDrop);
  }
}

// ===== 使用示例 =====
/*
<ul id="my-list" style="list-style:none;padding:0;">
  <li class="sortable-item" data-id="1" draggable="true" style="padding:12px;background:#f5f5f5;margin:4px 0;border-radius:4px;">
    📝 任务 1
  </li>
  <li class="sortable-item" data-id="2" draggable="true" style="padding:12px;background:#f5f5f5;margin:4px 0;border-radius:4px;">
    📝 任务 2
  </li>
  <li class="sortable-item" data-id="3" draggable="true" style="padding:12px;background:#f5f5f5;margin:4px 0;border-radius:4px;">
    📝 任务 3
  </li>
</ul>

<script>
  const sortable = new SortableList('#my-list');
  sortable.container.addEventListener('sort', (e) => {
    console.log('排序变化:', sortable.getOrder());
  });
</script>
*/

console.log('✅ 示例 5: 拖拽排序 — 原生 Drag & Drop API');
```

### 示例 6：文件拖拽上传

> 利用 Drag & Drop API 实现文件拖拽上传，支持拖拽预览、进度显示。

```js
/**
 * DropZone — 文件拖拽上传组件
 *
 * 核心 API:
 * - DataTransfer.files: 获取拖拽的文件列表
 * - DataTransfer.items: 获取拖拽项（支持目录）
 * - File API: 读取文件内容
 * - URL.createObjectURL: 创建文件预览 URL
 * - DragEvent: 拖拽事件
 */

class DropZone {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container) : container;
    this.accept = options.accept || '*/*';
    this.maxFiles = options.maxFiles || 10;
    this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB
    this.multiple = options.multiple !== false;

    this._files = [];
    this._onDragEnter = this._onDragEnter.bind(this);
    this._onDragOver = this._onDragOver.bind(this);
    this._onDragLeave = this._onDragLeave.bind(this);
    this._onDrop = this._onDrop.bind(this);

    this._buildUI();
    this._bindEvents();
  }

  _buildUI() {
    this.container.style.cssText = `
      border: 2px dashed #ccc;
      border-radius: 12px;
      padding: 40px;
      text-align: center;
      transition: all 0.2s;
      background: #fafafa;
      min-height: 200px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `;

    this.container.innerHTML = `
      <div class="drop-icon" style="font-size:48px;margin-bottom:16px;">📁</div>
      <div class="drop-text" style="font-size:16px;color:#666;margin-bottom:8px;">
        拖拽文件到这里，或 <label style="color:#1a73e8;cursor:pointer;text-decoration:underline;">点击选择</label>
      </div>
      <div class="drop-hint" style="font-size:12px;color:#999;">
        支持 ${this.accept}，最大 ${this.maxSize / 1024 / 1024}MB
      </div>
      <input type="file" class="file-input" style="display:none;"
        accept="${this.accept}" ${this.multiple ? 'multiple' : ''}>
      <div class="file-list" style="margin-top:20px;width:100%;"></div>
    `;

    this._fileInput = this.container.querySelector('.file-input');
    this._fileList = this.container.querySelector('.file-list');

    // 点击选择
    this.container.querySelector('label').addEventListener('click', () => {
      this._fileInput.click();
    });
    this._fileInput.addEventListener('change', () => {
      this._handleFiles(this._fileInput.files);
    });
  }

  _bindEvents() {
    this.container.addEventListener('dragenter', this._onDragEnter);
    this.container.addEventListener('dragover', this._onDragOver);
    this.container.addEventListener('dragleave', this._onDragLeave);
    this.container.addEventListener('drop', this._onDrop);

    // 阻止整个页面的默认拖拽行为
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
  }

  _onDragEnter(e) {
    e.preventDefault();
    this.container.style.borderColor = '#1a73e8';
    this.container.style.background = '#e8f0fe';
  }

  _onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  _onDragLeave(e) {
    // 只在离开容器时移除样式（不是进入子元素）
    if (!this.container.contains(e.relatedTarget)) {
      this.container.style.borderColor = '#ccc';
      this.container.style.background = '#fafafa';
    }
  }

  _onDrop(e) {
    e.preventDefault();
    this.container.style.borderColor = '#ccc';
    this.container.style.background = '#fafafa';

    const files = e.dataTransfer.files;
    if (files.length) {
      this._handleFiles(files);
    }
  }

  _handleFiles(fileList) {
    const files = Array.from(fileList);
    const validFiles = files.filter(file => {
      // 检查文件类型
      if (this.accept !== '*/*') {
        const accepted = this.accept.split(',').map(t => t.trim());
        const match = accepted.some(t => {
          if (t.endsWith('/*')) {
            return file.type.startsWith(t.slice(0, -1));
          }
          return file.type === t || file.name.endsWith(t.replace('.', '.'));
        });
        if (!match) {
          this._emit('error', { file, reason: '文件类型不支持' });
          return false;
        }
      }

      // 检查文件大小
      if (file.size > this.maxSize) {
        this._emit('error', { file, reason: `文件超过 ${this.maxSize / 1024 / 1024}MB` });
        return false;
      }

      return true;
    });

    // 检查数量限制
    if (this._files.length + validFiles.length > this.maxFiles) {
      this._emit('error', { reason: `最多上传 ${this.maxFiles} 个文件` });
      return;
    }

    this._files.push(...validFiles);
    this._renderFileList();
    this._emit('files', this._files);
  }

  _renderFileList() {
    this._fileList.innerHTML = '';
    this._files.forEach((file, index) => {
      const item = document.createElement('div');
      item.style.cssText = `
        display: flex; align-items: center; padding: 8px 12px;
        background: white; border-radius: 6px; margin-bottom: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      `;

      // 文件图标
      const icon = document.createElement('span');
      icon.style.marginRight = '12px';
      icon.style.fontSize = '20px';
      if (file.type.startsWith('image/')) icon.textContent = '🖼️';
      else if (file.type.startsWith('video/')) icon.textContent = '🎬';
      else if (file.type.startsWith('audio/')) icon.textContent = '🎵';
      else if (file.type.includes('pdf')) icon.textContent = '📄';
      else icon.textContent = '📎';

      // 文件信息
      const info = document.createElement('div');
      info.style.flex = '1';
      info.innerHTML = `
        <div style="font-size:14px;color:#333;">${file.name}</div>
        <div style="font-size:12px;color:#999;">${this._formatSize(file.size)}</div>
      `;

      // 预览按钮（图片）
      if (file.type.startsWith('image/')) {
        const previewBtn = document.createElement('button');
        previewBtn.textContent = '预览';
        previewBtn.style.cssText = 'margin-right:8px;padding:4px 8px;border:1px solid #ddd;border-radius:4px;background:white;cursor:pointer;font-size:12px;';
        previewBtn.addEventListener('click', () => {
          const url = URL.createObjectURL(file);
          const win = window.open('');
          win.document.write(`<img src="${url}" style="max-width:100%;">`);
        });
        item.appendChild(previewBtn);
      }

      // 删除按钮
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✕';
      removeBtn.style.cssText = 'border:none;background:none;cursor:pointer;color:#999;font-size:16px;padding:4px;';
      removeBtn.addEventListener('click', () => {
        this._files.splice(index, 1);
        this._renderFileList();
        this._emit('remove', file);
      });
      item.appendChild(removeBtn);

      item.insertBefore(icon, info);
      item.insertBefore(info, removeBtn);
      this._fileList.appendChild(item);
    });
  }

  _formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  _emit(event, data) {
    this.container.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  getFiles() {
    return [...this._files];
  }

  clear() {
    this._files = [];
    this._renderFileList();
  }

  destroy() {
    this.container.removeEventListener('dragenter', this._onDragEnter);
    this.container.removeEventListener('dragover', this._onDragOver);
    this.container.removeEventListener('dragleave', this._onDragLeave);
    this.container.removeEventListener('drop', this._onDrop);
  }
}

console.log('✅ 示例 6: 文件拖拽上传 — Drag & Drop + File API');
```

---

## 4. 表单 & 输入控制

### 示例 7：表单验证引擎（Constraint Validation API）

> 利用原生 Constraint Validation API 实现表单验证，无需第三方库。

```js
/**
 * FormValidator — 基于 Constraint Validation API 的验证引擎
 *
 * 核心 API:
 * - element.checkValidity(): 检查元素是否有效
 * - element.validationMessage: 获取验证错误信息
 * - element.setCustomError(msg): 设置自定义错误
 * - element.validity: ValidityState 对象
 *   - valueMissing: 必填但未填
 *   - typeMismatch: 类型不匹配
 *   - patternMismatch: 不匹配 pattern
 *   - tooLong/tooShort: 长度超限
 *   - rangeUnderflow/rangeOverflow: 数值范围
 *   - stepMismatch: step 不匹配
 *   - customError: 自定义错误
 *   - valid: 全部通过
 * - element.willValidate: 是否参与验证
 * - form.reportValidity(): 显示验证报告
 */

class FormValidator {
  constructor(form, options = {}) {
    this.form = typeof form === 'string' ? document.querySelector(form) : form;
    this.options = {
      validateOn: options.validateOn || 'blur', // 'blur' | 'input' | 'submit'
      showErrors: options.showErrors !== false,
      errorClass: options.errorClass || 'field-error',
      successClass: options.successClass || 'field-success',
      errorTemplate: options.errorTemplate || (msg => `<span class="error-msg">${msg}</span>`),
      ...options
    };

    this._rules = new Map(); // fieldName → [validators]
    this._errors = new Map(); // fieldName → error message
    this._bindEvents();
  }

  _bindEvents() {
    const fields = this.form.querySelectorAll('input, select, textarea');

    fields.forEach(field => {
      // 原生验证属性
      if (field.hasAttribute('required')) {
        this.addRule(field.name || field.id, 'required', '此字段为必填项');
      }
      if (field.pattern) {
        this.addRule(field.name || field.id, 'pattern', {
          regex: new RegExp(field.pattern),
          message: field.title || '格式不正确'
        });
      }
      if (field.type === 'email') {
        this.addRule(field.name || field.id, 'email', '请输入有效的邮箱地址');
      }
      if (field.type === 'url') {
        this.addRule(field.name || field.id, 'url', '请输入有效的 URL');
      }

      // 事件绑定
      if (this.options.validateOn === 'blur') {
        field.addEventListener('blur', () => this._validateField(field));
      } else if (this.options.validateOn === 'input') {
        field.addEventListener('input', () => this._validateField(field));
      }
    });

    this.form.addEventListener('submit', (e) => {
      if (!this.validate()) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  /** 添加验证规则 */
  addRule(fieldName, type, config) {
    if (!this._rules.has(fieldName)) {
      this._rules.set(fieldName, []);
    }

    const rule = { type, ...this._getValidator(type, config) };
    this._rules.get(fieldName).push(rule);
  }

  _getValidator(type, config) {
    const validators = {
      required: {
        test: (value) => value.trim() !== '',
        message: typeof config === 'string' ? config : '此字段为必填项'
      },
      email: {
        test: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: typeof config === 'string' ? config : '请输入有效的邮箱地址'
      },
      url: {
        test: (value) => /^https?:\/\/.+/.test(value),
        message: typeof config === 'string' ? config : '请输入有效的 URL'
      },
      pattern: {
        test: (value) => config.regex.test(value),
        message: config.message || '格式不正确'
      },
      minlength: {
        test: (value) => value.length >= config,
        message: `最少 ${config} 个字符`
      },
      maxlength: {
        test: (value) => value.length <= config,
        message: `最多 ${config} 个字符`
      },
      min: {
        test: (value) => Number(value) >= config,
        message: `最小值为 ${config}`
      },
      max: {
        test: (value) => Number(value) <= config,
        message: `最大值为 ${config}`
      },
      custom: {
        test: config.test,
        message: config.message
      },
      match: {
        test: (value, form) => {
          const target = form.querySelector(`[name="${config}"], [id="${config}"]`);
          return target && value === target.value;
        },
        message: `与 ${config} 不匹配`
      },
      phone: {
        test: (value) => /^1[3-9]\d{9}$/.test(value),
        message: '请输入有效的手机号码'
      }
    };

    return validators[type] || { test: () => true, message: '' };
  }

  /** 验证单个字段 */
  _validateField(field) {
    const fieldName = field.name || field.id;
    const rules = this._rules.get(fieldName) || [];
    const value = field.value;
    let error = null;

    for (const rule of rules) {
      if (!rule.test(value, this.form)) {
        error = rule.message;
        break;
      }
    }

    // 使用 setCustomValidity 与原生验证集成
    field.setCustomValidity(error || '');

    if (error) {
      this._errors.set(fieldName, error);
      field.classList.add(this.options.errorClass);
      field.classList.remove(this.options.successClass);
      this._showError(field, error);
    } else {
      this._errors.delete(fieldName);
      field.classList.remove(this.options.errorClass);
      if (value) field.classList.add(this.options.successClass);
      this._hideError(field);
    }

    return !error;
  }

  /** 验证整个表单 */
  validate() {
    let isValid = true;
    const fields = this.form.querySelectorAll('input, select, textarea');

    fields.forEach(field => {
      if (!this._validateField(field)) {
        isValid = false;
      }
    });

    // 聚焦第一个错误字段
    if (!isValid) {
      const firstError = this.form.querySelector(`.${this.options.errorClass}`);
      if (firstError) firstError.focus();
    }

    this.form.dispatchEvent(new CustomEvent('validate', {
      detail: { valid: isValid }
    }));

    return isValid;
  }

  _showError(field, message) {
    if (!this.options.showErrors) return;

    let errorEl = field.parentNode.querySelector(`.${this.options.errorClass}`);
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = this.options.errorClass;
      errorEl.style.cssText = 'font-size:12px;color:#d32f2f;margin-top:4px;';
      field.parentNode.appendChild(errorEl);
    }
    errorEl.innerHTML = this.options.errorTemplate(message);
    errorEl.setAttribute('role', 'alert');
  }

  _hideError(field) {
    const errorEl = field.parentNode.querySelector(`.${this.options.errorClass}`);
    if (errorEl) errorEl.remove();
  }

  /** 获取验证结果 */
  getErrors() {
    return Object.fromEntries(this._errors);
  }

  /** 重置表单 */
  reset() {
    this.form.reset();
    this._errors.clear();
    const fields = this.form.querySelectorAll('input, select, textarea');
    fields.forEach(field => {
      field.setCustomValidity('');
      field.classList.remove(this.options.errorClass, this.options.successClass);
      this._hideError(field);
    });
  }

  destroy() {
    this.form.removeEventListener('submit', this._bindEvents);
  }
}

// ===== 使用示例 =====
/*
<form id="my-form">
  <div>
    <label>邮箱:</label>
    <input type="email" name="email" required>
  </div>
  <div>
    <label>手机号:</label>
    <input type="tel" name="phone" pattern="^1[3-9]\d{9}$">
  </div>
  <div>
    <label>密码:</label>
    <input type="password" name="password" minlength="8">
  </div>
  <div>
    <label>确认密码:</label>
    <input type="password" name="confirmPassword">
  </div>
  <button type="submit">提交</button>
</form>

<script>
  const validator = new FormValidator('#my-form', { validateOn: 'blur' });
  validator.addRule('confirmPassword', 'match', 'password');
  validator.form.addEventListener('validate', (e) => {
    if (e.detail.valid) console.log('表单验证通过!');
  });
</script>
*/

console.log('✅ 示例 7: 表单验证引擎 — Constraint Validation API');
```

### 示例 8：输入掩码 & 格式化

> 实现输入掩码（Input Mask）和实时格式化，如电话号码、日期、货币等。

```js
/**
 * InputMask — 输入掩码 & 格式化器
 *
 * 核心思路：
 * - 监听 input 事件，拦截并格式化输入
 * - 使用 selectionStart/selectionEnd 维护光标位置
 * - 掩码字符: #=数字, A=字母, a=字母或数字, *=任意字符
 * - 可选字符用 [] 包裹
 */

class InputMask {
  constructor(input, options = {}) {
    this.input = typeof input === 'string' ? document.querySelector(input) : input;
    this.mask = options.mask || '';
    this.placeholder = options.placeholder || this._generatePlaceholder();
    this.reverse = options.reverse || false; // 反向填充（如货币）
    this.delimiters = options.delimiters || {}; // { position: char }
    this._onInput = this._onInput.bind(this);
    this._onFocus = this._onFocus.bind(this);
    this._onBlur = this._onBlur.bind(this);

    this._bind();
  }

  _bind() {
    this.input.addEventListener('input', this._onInput);
    this.input.addEventListener('focus', this._onFocus);
    this.input.addEventListener('blur', this._onBlur);
    this.input.addEventListener('keydown', (e) => {
      // 允许控制键
      if (e.key === 'Tab' || e.key === 'Escape') return;
    });
  }

  _onFocus() {
    if (!this.input.value) {
      this.input.value = this.placeholder;
    }
  }

  _onBlur() {
    if (this.input.value === this.placeholder) {
      this.input.value = '';
    }
  }

  _onInput(e) {
    const raw = this.input.value.replace(/[^0-9a-zA-Z]/g, '');
    const formatted = this._applyMask(raw);

    // 保存光标位置
    const cursorPos = this.input.selectionStart;
    const oldLength = this.input.value.length;

    this.input.value = formatted;

    // 恢复光标位置（考虑格式化添加的字符）
    const newLength = formatted.length;
    const diff = newLength - oldLength;
    const newCursorPos = Math.min(cursorPos + Math.max(0, diff), newLength);
    this.input.setSelectionRange(newCursorPos, newCursorPos);
  }

  _applyMask(raw) {
    if (!this.mask) return raw;

    let result = '';
    let rawIndex = 0;

    for (let i = 0; i < this.mask.length && rawIndex < raw.length; i++) {
      const maskChar = this.mask[i];
      const inputChar = raw[rawIndex];

      if (maskChar === '#') {
        if (/[0-9]/.test(inputChar)) {
          result += inputChar;
          rawIndex++;
        } else {
          break;
        }
      } else if (maskChar === 'A') {
        if (/[a-zA-Z]/.test(inputChar)) {
          result += inputChar.toUpperCase();
          rawIndex++;
        } else {
          break;
        }
      } else if (maskChar === 'a') {
        if (/[a-zA-Z0-9]/.test(inputChar)) {
          result += inputChar;
          rawIndex++;
        } else {
          break;
        }
      } else if (maskChar === '*') {
        result += inputChar;
        rawIndex++;
      } else {
        // 固定字符（如 - / ( ) 等）
        result += maskChar;
      }
    }

    return result;
  }

  _generatePlaceholder() {
    return this.mask.replace(/[#Aa*]/g, '_');
  }

  /** 获取原始值（去除格式化） */
  getRawValue() {
    return this.input.value.replace(/[^0-9a-zA-Z]/g, '');
  }

  /** 更新掩码 */
  setMask(mask) {
    this.mask = mask;
    this.placeholder = this._generatePlaceholder();
  }

  destroy() {
    this.input.removeEventListener('input', this._onInput);
    this.input.removeEventListener('focus', this._onFocus);
    this.input.removeEventListener('blur', this._onBlur);
  }
}

// --- 预设掩码 ---
const MASKS = {
  phone: '000 0000 0000',
  phoneCN: '000 0000 0000',
  date: '00/00/0000',
  time: '00:00',
  datetime: '00/00/0000 00:00',
  creditCard: '0000 0000 0000 0000',
  ip: '000.000.000.000',
  postalCode: '000000',
};

// --- 货币格式化器 ---
class CurrencyFormatter {
  constructor(input, options = {}) {
    this.input = typeof input === 'string' ? document.querySelector(input) : input;
    this.currency = options.currency || 'CNY';
    this.decimals = options.decimals || 2;
    this.prefix = options.prefix || '¥';
    this.separator = options.separator || ',';

    this._onInput = this._onInput.bind(this);
    this.input.addEventListener('input', this._onInput);
    this.input.addEventListener('focus', () => {
      if (!this.input.value) this.input.value = this.prefix + '0';
    });
    this.input.addEventListener('blur', () => {
      if (this.input.value === this.prefix + '0') this.input.value = '';
    });
  }

  _onInput() {
    let value = this.input.value.replace(/[^0-9.]/g, '');
    const parts = value.split('.');

    // 只保留一个小数点
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }

    // 限制小数位数
    if (parts.length === 2) {
      parts[1] = parts[1].slice(0, this.decimals);
      value = parts.join('.');
    }

    // 格式化整数部分（添加千分位）
    const numParts = value.split('.');
    numParts[0] = numParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, this.separator);

    this.input.value = this.prefix + numParts.join('.');
  }

  /** 获取数值 */
  getNumber() {
    const raw = this.input.value.replace(/[^0-9.]/g, '');
    return parseFloat(raw) || 0;
  }

  destroy() {
    this.input.removeEventListener('input', this._onInput);
  }
}

// --- 数字步进器 ---
class NumberStepper {
  constructor(input, options = {}) {
    this.input = typeof input === 'string' ? document.querySelector(input) : input;
    this.min = options.min ?? -Infinity;
    this.max = options.max ?? Infinity;
    this.step = options.step || 1;
    this.decimals = options.decimals || 0;

    this._onWheel = this._onWheel.bind(this);
    this._onKeydown = this._onKeydown.bind(this);

    this.input.addEventListener('wheel', this._onWheel, { passive: false });
    this.input.addEventListener('keydown', this._onKeydown);
  }

  _onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -this.step : this.step;
    this._adjust(delta);
  }

  _onKeydown(e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this._adjust(this.step);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this._adjust(-this.step);
    }
  }

  _adjust(delta) {
    let value = parseFloat(this.input.value) || 0;
    value = Math.round((value + delta) * Math.pow(10, this.decimals)) / Math.pow(10, this.decimals);
    value = Math.max(this.min, Math.min(this.max, value));
    this.input.value = value.toFixed(this.decimals);
    this.input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  destroy() {
    this.input.removeEventListener('wheel', this._onWheel);
    this.input.removeEventListener('keydown', this._onKeydown);
  }
}

console.log('✅ 示例 8: 输入掩码 & 格式化 — InputMask / CurrencyFormatter / NumberStepper');
```

---

## 5. 可访问性 (a11y)

### 示例 9：ARIA 活区 & 键盘导航组件

> ARIA (Accessible Rich Internet Applications) 让动态内容对屏幕阅读器可用。

```js
/**
 * AccessibleTabs — 可访问的 Tab 组件
 *
 * ARIA 要点:
 * - role="tablist": 容器
 * - role="tab": 标签按钮
 * - role="tabpanel": 内容面板
 * - aria-selected: 当前选中
 * - aria-controls: tab 关联 tabpanel
 * - aria-labelledby: tabpanel 关联 tab
 * - aria-live: 活区，屏幕阅读器自动朗读变化内容
 * - aria-busy: 表示内容正在加载
 * - aria-hidden: 隐藏元素（对辅助技术）
 *
 * 键盘导航 (WAI-ARIA Authoring Practices):
 * - → / ←: 切换 tab
 * - Home: 跳到第一个 tab
 * - End: 跳到最后一个 tab
 */

class AccessibleTabs {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container) : container;
    this.autorotate = options.autorotate || false;
    this.rotateInterval = options.rotateInterval || 5000;

    this._tabs = [];
    this._panels = [];
    this._currentIndex = 0;
    this._timer = null;

    this._init();
    this._bindKeyboard();
  }

  _init() {
    // 设置 tablist role
    const tabList = this.container.querySelector('[role="tablist"]') || this.container;
    tabList.setAttribute('role', 'tablist');

    // 收集 tabs
    this._tabs = Array.from(this.container.querySelectorAll('[role="tab"]'));
    this._panels = Array.from(this.container.querySelectorAll('[role="tabpanel"]'));

    this._tabs.forEach((tab, index) => {
      tab.setAttribute('tabindex', index === 0 ? '0' : '-1');
      tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      tab.setAttribute('aria-controls', this._panels[index]?.id || `panel-${index}`);
      tab.id = tab.id || `tab-${index}`;

      tab.addEventListener('click', () => this.activate(index));
    });

    this._panels.forEach((panel, index) => {
      panel.setAttribute('aria-labelledby', this._tabs[index]?.id || `tab-${index}`);
      panel.setAttribute('tabindex', '0');
      panel.hidden = index !== 0;
    });

    // 自动轮播
    if (this.autorotate) {
      this._startRotation();
    }
  }

  _bindKeyboard() {
    const tabList = this.container.querySelector('[role="tablist"]') || this.container;

    tabList.addEventListener('keydown', (e) => {
      const currentIndex = this._currentIndex;
      let newIndex = currentIndex;

      switch (e.key) {
        case 'ArrowRight':
          newIndex = (currentIndex + 1) % this._tabs.length;
          e.preventDefault();
          break;
        case 'ArrowLeft':
          newIndex = (currentIndex - 1 + this._tabs.length) % this._tabs.length;
          e.preventDefault();
          break;
        case 'Home':
          newIndex = 0;
          e.preventDefault();
          break;
        case 'End':
          newIndex = this._tabs.length - 1;
          e.preventDefault();
          break;
        default:
          return;
      }

      this.activate(newIndex);
      this._tabs[newIndex].focus();
    });
  }

  activate(index) {
    if (index === this._currentIndex) return;

    // 更新 tabs
    this._tabs[this._currentIndex].setAttribute('aria-selected', 'false');
    this._tabs[this._currentIndex].setAttribute('tabindex', '-1');
    this._tabs[index].setAttribute('aria-selected', 'true');
    this._tabs[index].setAttribute('tabindex', '0');

    // 更新 panels
    this._panels[this._currentIndex].hidden = true;
    this._panels[index].hidden = false;

    this._currentIndex = index;

    // 触发自定义事件
    this.container.dispatchEvent(new CustomEvent('tabchange', {
      detail: { index, tab: this._tabs[index] }
    }));

    // 重置轮播
    if (this.autorotate) {
      this._resetRotation();
    }
  }

  _startRotation() {
    this._timer = setInterval(() => {
      const next = (this._currentIndex + 1) % this._tabs.length;
      this.activate(next);
    }, this.rotateInterval);
  }

  _resetRotation() {
    clearInterval(this._timer);
    this._startRotation();
  }

  destroy() {
    clearInterval(this._timer);
  }
}

// --- ARIA 活区工具 ---
/**
 * LiveRegion — 创建 ARIA 活区
 * 用于向屏幕阅读器播报动态内容变化
 */
class LiveRegion {
  constructor(options = {}) {
    const {
      politeness = 'polite', // 'polite' | 'assertive' | 'off'
      atomic = true,
      relevant = 'additions text',
    } = options;

    this.el = document.createElement('div');
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', politeness);
    this.el.setAttribute('aria-atomic', atomic ? 'true' : 'false');
    this.el.setAttribute('aria-relevant', relevant);
    this.el.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';

    document.body.appendChild(this.el);
  }

  /** 播报消息 */
  announce(message, delay = 0) {
    setTimeout(() => {
      this.el.textContent = '';
      // 强制回流让屏幕阅读器重新读取
      requestAnimationFrame(() => {
        this.el.textContent = message;
      });
    }, delay);
  }

  /** 清除 */
  clear() {
    this.el.textContent = '';
  }

  destroy() {
    this.el.remove();
  }
}

// --- 使用示例 ---
/*
// 1. 可访问 Tab
<div id="tabs">
  <div role="tablist">
    <button role="tab" aria-selected="true" id="tab-1">Tab 1</button>
    <button role="tab" id="tab-2">Tab 2</button>
    <button role="tab" id="tab-3">Tab 3</button>
  </div>
  <div role="tabpanel" id="panel-1" aria-labelledby="tab-1">内容 1</div>
  <div role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden>内容 2</div>
  <div role="tabpanel" id="panel-3" aria-labelledby="tab-3" hidden>内容 3</div>
</div>
new AccessibleTabs('#tabs');

// 2. ARIA 活区
const live = new LiveRegion();
live.announce('页面已加载完成');
live.announce('操作失败，请重试', 0);
*/

console.log('✅ 示例 9: ARIA 活区 & 键盘导航 — AccessibleTabs + LiveRegion');
```

### 示例 10：Focus Trap（焦点陷阱）

> 模态框/对话框需要限制焦点在其内部，防止用户 tab 到背景内容。

```js
/**
 * FocusTrap — 焦点陷阱
 *
 * 原理：
 * 1. 记录打开前的焦点元素
 * 2. 监听 Tab/Shift+Tab 键
 * 3. 当焦点要离开容器时，循环到容器内第一个/最后一个可聚焦元素
 * 4. 关闭时恢复焦点
 *
 * 可聚焦元素:
 * - tabindex >= 0
 * - <a href>, <button>, <input>, <select>, <textarea>
 * - [contenteditable]
 */

class FocusTrap {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container) : container;
    this.options = {
      escapeDeactivates: options.escapeDeactivates !== false,
      returnFocusOnDeactivate: options.returnFocusOnDeactivate !== false,
      initialFocus: options.initialFocus || null,
      ...options
    };

    this._active = false;
    this._previouslyFocused = null;
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  /** 激活焦点陷阱 */
  activate() {
    if (this._active) return;

    // 记录当前焦点
    this._previouslyFocused = document.activeElement;
    this._active = true;

    // 隐藏容器外的元素（对辅助技术）
    this._hideOutsideElements();

    // 监听键盘
    document.addEventListener('keydown', this._onKeyDown);

    // 初始焦点
    const focusTarget = this._getInitialFocus();
    if (focusTarget) {
      focusTarget.focus();
    }

    this.container.dispatchEvent(new CustomEvent('focustrap:activate'));
  }

  /** 停用焦点陷阱 */
  deactivate() {
    if (!this._active) return;

    this._active = false;
    document.removeEventListener('keydown', this._onKeyDown);

    // 恢复容器外元素的可见性
    this._restoreOutsideElements();

    // 恢复焦点
    if (this.options.returnFocusOnDeactivate && this._previouslyFocused) {
      this._previouslyFocused.focus();
    }

    this.container.dispatchEvent(new CustomEvent('focustrap:deactivate'));
  }

  _onKeyDown(e) {
    if (e.key === 'Escape' && this.options.escapeDeactivates) {
      this.deactivate();
      return;
    }

    if (e.key !== 'Tab') return;

    e.preventDefault();

    const focusable = this._getFocusableElements();
    if (focusable.length === 0) return;

    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    const currentFocus = document.activeElement;

    if (e.shiftKey) {
      // Shift+Tab: 如果在第一个元素，跳到最后一个
      if (currentFocus === firstFocusable || !this.container.contains(currentFocus)) {
        lastFocusable.focus();
      } else {
        // 正常向前移动
        const currentIndex = focusable.indexOf(currentFocus);
        if (currentIndex > 0) {
          focusable[currentIndex - 1].focus();
        } else {
          lastFocusable.focus();
        }
      }
    } else {
      // Tab: 如果在最后一个元素，跳到第一个
      if (currentFocus === lastFocusable || !this.container.contains(currentFocus)) {
        firstFocusable.focus();
      } else {
        const currentIndex = focusable.indexOf(currentFocus);
        if (currentIndex < focusable.length - 1) {
          focusable[currentIndex + 1].focus();
        } else {
          firstFocusable.focus();
        }
      }
    }
  }

  _getFocusableElements() {
    const selector = [
      'a[href]:not([disabled])',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable]:not([disabled])'
    ].join(', ');

    return Array.from(this.container.querySelectorAll(selector))
      .filter(el => {
        // 过滤隐藏元素
        return el.offsetParent !== null &&
               getComputedStyle(el).visibility !== 'hidden';
      });
  }

  _getInitialFocus() {
    if (this.options.initialFocus) {
      const el = typeof this.options.initialFocus === 'string'
        ? this.container.querySelector(this.options.initialFocus)
        : this.options.initialFocus;
      if (el) return el;
    }

    const focusable = this._getFocusableElements();
    return focusable[0] || null;
  }

  _hideOutsideElements() {
    // 使用 aria-hidden 隐藏容器外的内容
    const bodyChildren = document.body.children;
    this._hiddenElements = [];

    for (const child of bodyChildren) {
      if (child === this.container || this.container.contains(child)) continue;
      if (child.hasAttribute('aria-hidden')) continue; // 已经隐藏的不处理

      this._hiddenElements.push({
        el: child,
        ariaHidden: child.getAttribute('aria-hidden')
      });
      child.setAttribute('aria-hidden', 'true');
    }
  }

  _restoreOutsideElements() {
    if (!this._hiddenElements) return;

    for (const { el, ariaHidden } of this._hiddenElements) {
      if (ariaHidden === null) {
        el.removeAttribute('aria-hidden');
      } else {
        el.setAttribute('aria-hidden', ariaHidden);
      }
    }
    this._hiddenElements = null;
  }

  isActive() {
    return this._active;
  }

  destroy() {
    this.deactivate();
  }
}

// --- Modal 组件（集成 FocusTrap） ---
class AccessibleModal {
  constructor(content, options = {}) {
    this.title = options.title || '对话框';
    this.closeOnOverlay = options.closeOnOverlay !== false;
    this.closeOnEscape = options.closeOnEscape !== false;

    this._buildOverlay();
    this._buildDialog(content);
    this._focusTrap = new FocusTrap(this.dialog, {
      initialFocus: options.initialFocus || 'button:not([disabled])'
    });
  }

  _buildOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.2s ease;
    `;
    document.body.appendChild(this.overlay);

    if (this.closeOnOverlay) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });
    }
  }

  _buildDialog(content) {
    this.dialog = document.createElement('div');
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-labelledby', 'modal-title');
    this.dialog.style.cssText = `
      background: white; border-radius: 12px; padding: 24px;
      max-width: 500px; width: 90%; max-height: 80vh; overflow: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      transform: scale(0.9); transition: transform 0.2s ease;
    `;

    // 标题栏
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';

    const title = document.createElement('h2');
    title.id = 'modal-title';
    title.textContent = this.title;
    title.style.margin = '0';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'border:none;background:none;font-size:20px;cursor:pointer;color:#666;padding:4px 8px;border-radius:4px;';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);

    this.dialog.appendChild(header);

    // 内容
    const body = document.createElement('div');
    body.innerHTML = content;
    this.dialog.appendChild(body);

    this.overlay.appendChild(this.dialog);
  }

  open() {
    this.overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
      this.dialog.style.transform = 'scale(1)';
    });
    this._focusTrap.activate();

    // Escape 关闭
    if (this.closeOnEscape) {
      this._escapeHandler = (e) => {
        if (e.key === 'Escape') this.close();
      };
      document.addEventListener('keydown', this._escapeHandler);
    }

    this.overlay.dispatchEvent(new CustomEvent('modal:open'));
  }

  close() {
    this.overlay.style.opacity = '0';
    this.dialog.style.transform = 'scale(0.9)';
    setTimeout(() => {
      this.overlay.style.display = 'none';
      this._focusTrap.deactivate();
    }, 200);

    if (this._escapeHandler) {
      document.removeEventListener('keydown', this._escapeHandler);
      this._escapeHandler = null;
    }

    this.overlay.dispatchEvent(new CustomEvent('modal:close'));
  }

  destroy() {
    this.close();
    setTimeout(() => {
      this.overlay.remove();
      this._focusTrap.destroy();
    }, 300);
  }
}

console.log('✅ 示例 10: Focus Trap & 可访问模态框');
```

---

## 6. Clipboard API & 剪贴板

### 示例 11：富文本剪贴板操作

> Clipboard API 提供异步、权限控制的剪贴板读写，替代 document.execCommand。

```js
/**
 * ClipboardManager — 剪贴板管理器
 *
 * 核心 API:
 * - navigator.clipboard.readText(): 读取文本
 * - navigator.clipboard.writeText(): 写入文本
 * - navigator.clipboard.read(): 读取 ClipboardItem（含富文本/图片）
 * - navigator.clipboard.write(): 写入 ClipboardItem
 * - ClipboardItem: 表示剪贴板中的一个项目
 * - Permission API: 检查剪贴板权限
 *
 * 安全要求:
 * - 需要 HTTPS 或 localhost
 * - 需要用户手势触发（click 等）
 * - 读取需要 clipboard-read 权限
 */

class ClipboardManager {
  constructor() {
    this._supported = !!navigator.clipboard;
  }

  /** 检查是否支持 */
  isSupported() {
    return this._supported;
  }

  /** 检查权限 */
  async checkPermission(name = 'clipboard-read') {
    if (!navigator.permissions) return { state: 'unknown' };
    try {
      return await navigator.permissions.query({ name });
    } catch {
      return { state: 'unknown' };
    }
  }

  /** 写入文本 */
  async writeText(text) {
    if (!this._supported) {
      return this._fallbackWriteText(text);
    }
    await navigator.clipboard.writeText(text);
    return true;
  }

  /** 读取文本 */
  async readText() {
    if (!this._supported) {
      return this._fallbackReadText();
    }
    return await navigator.clipboard.readText();
  }

  /** 写入富文本（HTML + 纯文本） */
  async writeRichText(html, plainText) {
    if (!this._supported) {
      console.warn('Clipboard API 不支持，回退到纯文本');
      return this.writeText(plainText);
    }

    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' }),
    });

    await navigator.clipboard.write([item]);
    return true;
  }

  /** 读取富文本 */
  async readRichText() {
    if (!this._supported) {
      return { html: null, text: await this.readText() };
    }

    const items = await navigator.clipboard.read();
    const result = { html: null, text: null };

    for (const item of items) {
      if (item.types.includes('text/html')) {
        const blob = item.getType('text/html');
        result.html = await (await blob).text();
      }
      if (item.types.includes('text/plain')) {
        const blob = item.getType('text/plain');
        result.text = await (await blob).text();
      }
    }

    return result;
  }

  /** 写入图片 */
  async writeImage(blob) {
    if (!this._supported) {
      console.warn('Clipboard API 不支持图片写入');
      return false;
    }

    const item = new ClipboardItem({ [blob.type]: blob });
    await navigator.clipboard.write([item]);
    return true;
  }

  /** 读取图片 */
  async readImage() {
    if (!this._supported) return null;

    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find(t => t.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        return { blob, type: imageType, url: URL.createObjectURL(blob) };
      }
    }
    return null;
  }

  /** 复制元素内容 */
  async copyElement(selector) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return false;

    // 创建 Range 选中元素内容
    const range = document.createRange();
    range.selectNodeContents(el);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    try {
      // 尝试使用 Clipboard API
      const html = el.innerHTML;
      const text = el.textContent;
      await this.writeRichText(html, text);
      return true;
    } finally {
      selection.removeAllRanges();
    }
  }

  /** 降级方案：使用 textarea + execCommand */
  _fallbackWriteText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    textarea.remove();
    return success;
  }

  _fallbackReadText() {
    console.warn('Clipboard API 不支持读取，请手动粘贴');
    return Promise.resolve(null);
  }
}

// --- 一键复制组件 ---
class CopyButton {
  constructor(button, options = {}) {
    this.button = typeof button === 'string' ? document.querySelector(button) : button;
    this.getText = options.getText || (() => this.button.dataset.copyText || '');
    this.successText = options.successText || '已复制!';
    this.successDuration = options.successDuration || 2000;
    this.clipboard = new ClipboardManager();

    this._originalText = this.button.textContent;
    this.button.addEventListener('click', () => this._copy());
  }

  async _copy() {
    const text = typeof this.getText === 'function' ? this.getText() : this.getText;

    try {
      const success = await this.clipboard.writeText(text);
      if (success) {
        this._showSuccess();
        this.button.dispatchEvent(new CustomEvent('copy:success', { detail: { text } }));
      }
    } catch (e) {
      this.button.dispatchEvent(new CustomEvent('copy:error', { detail: { error: e } }));
    }
  }

  _showSuccess() {
    this.button.textContent = this.successText;
    this.button.style.background = '#4caf50';
    this.button.style.color = 'white';

    setTimeout(() => {
      this.button.textContent = this._originalText;
      this.button.style.background = '';
      this.button.style.color = '';
    }, this.successDuration);
  }

  destroy() {
    this.button.removeEventListener('click', () => this._copy());
  }
}

// --- 使用示例 ---
/*
// 一键复制
<button id="copy-btn" data-copy-text="Hello World!">📋 复制</button>
new CopyButton('#copy-btn');

// 富文本复制
const clipboard = new ClipboardManager();
await clipboard.writeRichText('<b>Bold</b> text', 'Bold text');

// 复制图片
const imgBlob = await fetch('image.png').then(r => r.blob());
await clipboard.writeImage(imgBlob);
*/

console.log('✅ 示例 11: Clipboard API — 文本/富文本/图片 剪贴板操作');
```

---

## 7. ResizeObserver & Container Queries

### 示例 12：响应式图表容器

> ResizeObserver 监听元素尺寸变化，替代 window resize 事件。

```js
/**
 * ResponsiveChart — 基于 ResizeObserver 的响应式图表容器
 *
 * ResizeObserver vs window resize:
 * - ResizeObserver: 监听具体元素尺寸变化
 * - window resize: 只监听窗口尺寸变化
 * - ResizeObserver: 异步批量通知（性能更好）
 * - ResizeObserver: 支持 iframe、动态布局变化
 *
 * 核心 API:
 * - new ResizeObserver(callback): 创建观察器
 * - observer.observe(element, options): 观察元素
 * - observer.unobserve(element): 停止观察
 * - observer.disconnect(): 停止所有观察
 * - ResizeObserverEntry:
 *   - contentRect: { x, y, width, height, top, right, bottom, left }
 *   - borderBoxSize: 边框盒尺寸
 *   - contentBoxSize: 内容盒尺寸
 *   - devicePixelContentBoxSize: 设备像素尺寸
 */

class ResponsiveChart {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container) : container;
    this.options = {
      type: options.type || 'bar', // 'bar' | 'line' | 'pie'
      data: options.data || [],
      colors: options.colors || ['#1a73e8', '#4caf50', '#ff9800', '#e91e63', '#9c27b0'],
      animation: options.animation !== false,
      ...options
    };

    this._resizeObserver = null;
    this._lastSize = { width: 0, height: 0 };
    this._init();
  }

  _init() {
    this.container.style.position = 'relative';
    this._createCanvas();
    this._observeResize();
    this.render();
  }

  _createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'width:100%;height:100%;display:block;';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  _observeResize() {
    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width !== this._lastSize.width || height !== this._lastSize.height) {
          this._lastSize = { width, height };
          this._resizeCanvas(width, height);
          this.render();
        }
      }
    });

    this._resizeObserver.observe(this.container);
  }

  _resizeCanvas(width, height) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx.scale(dpr, dpr);
    this.width = width;
    this.height = height;
  }

  render() {
    if (!this.width || !this.height) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    switch (this.options.type) {
      case 'bar': this._drawBar(ctx); break;
      case 'line': this._drawLine(ctx); break;
      case 'pie': this._drawPie(ctx); break;
    }
  }

  _drawBar(ctx) {
    const { data, colors } = this.options;
    if (!data.length) return;

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = this.width - padding.left - padding.right;
    const chartHeight = this.height - padding.top - padding.bottom;
    const maxVal = Math.max(...data.map(d => d.value));
    const barWidth = Math.min(chartWidth / data.length * 0.6, 60);
    const gap = chartWidth / data.length;

    // Y 轴
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(this.width - padding.right, y);
      ctx.stroke();

      // Y 轴标签
      ctx.fillStyle = '#999';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      const val = Math.round(maxVal * (1 - i / 5));
      ctx.fillText(val, padding.left - 8, y + 4);
    }

    // 柱状图
    data.forEach((item, i) => {
      const x = padding.left + gap * i + (gap - barWidth) / 2;
      const barHeight = (item.value / maxVal) * chartHeight;
      const y = padding.top + chartHeight - barHeight;

      // 柱子
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      const radius = Math.min(4, barWidth / 2);
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, y + barHeight);
      ctx.lineTo(x, y + barHeight);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.fill();

      // X 轴标签
      ctx.fillStyle = '#666';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, x + barWidth / 2, this.height - padding.bottom + 20);
    });
  }

  _drawLine(ctx) {
    const { data, colors } = this.options;
    if (!data.length) return;

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = this.width - padding.left - padding.right;
    const chartHeight = this.height - padding.top - padding.bottom;
    const maxVal = Math.max(...data.map(d => d.value));

    const points = data.map((item, i) => ({
      x: padding.left + (chartWidth / (data.length - 1 || 1)) * i,
      y: padding.top + chartHeight - (item.value / maxVal) * chartHeight,
    }));

    // 网格
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(this.width - padding.right, y);
      ctx.stroke();
    }

    // 折线
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // 数据点
    points.forEach((p, i) => {
      ctx.fillStyle = colors[0];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#666';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(data[i].label, p.x, this.height - padding.bottom + 20);
    });
  }

  _drawPie(ctx) {
    const { data, colors } = this.options;
    if (!data.length) return;

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = Math.min(this.width, this.height) / 2 - 40;

    let startAngle = -Math.PI / 2;

    data.forEach((item, i) => {
      const sliceAngle = (item.value / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;

      // 扇形
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();

      // 标签
      const midAngle = startAngle + sliceAngle / 2;
      const labelRadius = radius * 0.7;
      const lx = cx + Math.cos(midAngle) * labelRadius;
      const ly = cy + Math.sin(midAngle) * labelRadius;

      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const pct = Math.round((item.value / total) * 100);
      if (pct > 5) ctx.fillText(`${pct}%`, lx, ly);

      startAngle = endAngle;
    });

    // 图例
    const legendY = this.height - 20;
    let legendX = 20;
    data.forEach((item, i) => {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(legendX, legendY - 8, 12, 12);
      ctx.fillStyle = '#666';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, legendX + 16, legendY - 2);
      legendX += ctx.measureText(item.label).width + 32;
    });
  }

  /** 更新数据 */
  updateData(data) {
    this.options.data = data;
    this.render();
  }

  /** 切换类型 */
  setType(type) {
    this.options.type = type;
    this.render();
  }

  destroy() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    this.canvas.remove();
  }
}

// --- ResizeObserver 通用工具 ---
/**
 * ElementSizeWatcher — 元素尺寸变化监听器
 */
class ElementSizeWatcher {
  constructor() {
    this._observers = new Map(); // element → ResizeObserver
    this._callbacks = new Map(); // element → [callbacks]
  }

  /** 监听元素尺寸 */
  observe(element, callback) {
    const el = typeof element === 'string' ? document.querySelector(element) : element;

    if (!this._observers.has(el)) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          const callbacks = this._callbacks.get(el) || [];
          callbacks.forEach(cb => cb({ width, height }, entry));
        }
      });
      observer.observe(el);
      this._observers.set(el, observer);
      this._callbacks.set(el, []);
    }

    this._callbacks.get(el).push(callback);
  }

  /** 移除回调 */
  unobserve(element, callback) {
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    const callbacks = this._callbacks.get(el);
    if (callbacks) {
      const idx = callbacks.indexOf(callback);
      if (idx !== -1) callbacks.splice(idx, 1);
    }

    // 没有回调时停止观察
    if (callbacks && callbacks.length === 0) {
      this._observers.get(el)?.disconnect();
      this._observers.delete(el);
      this._callbacks.delete(el);
    }
  }

  /** 销毁 */
  destroy() {
    for (const observer of this._observers.values()) {
      observer.disconnect();
    }
    this._observers.clear();
    this._callbacks.clear();
  }
}

console.log('✅ 示例 12: ResizeObserver — 响应式图表 + 元素尺寸监听');

// ===== 完整使用示例 =====
/*
// 响应式图表
const chart = new ResponsiveChart('#chart-container', {
  type: 'bar',
  data: [
    { label: '周一', value: 120 },
    { label: '周二', value: 200 },
    { label: '周三', value: 150 },
    { label: '周四', value: 80 },
    { label: '周五', value: 190 },
  ],
});

// 元素尺寸监听
const watcher = new ElementSizeWatcher();
watcher.observe('#sidebar', ({ width }) => {
  if (width < 200) {
    // 侧边栏变窄，切换为图标模式
  }
});
*/
```

---

## 速查表

| API | 用途 | 替代方案 | 优势 |
|-----|------|----------|------|
| Shadow DOM | 样式/ DOM 封装 | CSS BEM/Scope | 真正的隔离 |
| Selection/Range | 文本选区操作 | 无 | 原生标注/高亮 |
| Drag & Drop | 拖拽交互 | 鼠标事件模拟 | 原生支持，支持文件 |
| Constraint Validation | 表单验证 | 手动验证 | 浏览器原生错误提示 |
| ARIA | 可访问性 | 无 | 屏幕阅读器支持 |
| FocusTrap | 焦点管理 | 手动 tabindex | 模态框必备 |
| Clipboard API | 剪贴板 | execCommand | 异步、安全、支持富文本 |
| ResizeObserver | 元素尺寸监听 | window resize | 精确到元素 |

## DOM 操作反模式清单 (进阶版)

- ❌ 用 CSS 类名模拟组件隔离 → ✅ 用 Shadow DOM
- ❌ 手动解析选中文本 → ✅ 用 Selection/Range API
- ❌ 用 mousedown/mousemove 模拟拖拽 → ✅ 用 Drag & Drop API
- ❌ 手动写表单验证逻辑 → ✅ 用 Constraint Validation API
- ❌ 模态框不管理焦点 → ✅ 用 FocusTrap
- ❌ 用 execCommand('copy') → ✅ 用 Clipboard API
- ❌ 用 window resize 监听元素 → ✅ 用 ResizeObserver
- ❌ 忽略可访问性 → ✅ 用 ARIA 属性 + 键盘导航

---

> **总结：** 原生 DOM API 远不止 querySelector 和 addEventListener。Shadow DOM 提供真正的组件封装，Selection/Range 实现文本标注，Drag & Drop 处理拖拽交互，Constraint Validation 简化表单验证，ARIA + FocusTrap 保障可访问性，Clipboard API 安全操作剪贴板，ResizeObserver 精确监听元素尺寸。掌握这些 API，可以不依赖任何框架实现复杂交互。
