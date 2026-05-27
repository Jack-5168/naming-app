# 专项训练 07:00 — DOM 操作深度

## 主题：原生 DOM API 深度练习（事件委托 / DOM Diff / 性能优化）

---

## 一、事件委托（Event Delegation）

### 示例 1：基础事件委托 — 动态列表操作

```js
// ❌ 反模式：给每个 li 绑定事件（内存浪费 + 新增元素无事件）
document.querySelectorAll(".list-item").forEach((item) => {
  item.addEventListener("click", handleItemClick);
});

// ✅ 事件委托：只在父元素上绑定一个监听器
const list = document.getElementById("list");
list.addEventListener("click", (e) => {
  const item = e.target.closest(".list-item");
  if (!item) return; // 忽略非目标元素点击

  const id = item.dataset.id;
  const action = e.target.dataset.action;

  if (action === "delete") {
    deleteItem(id);
  } else if (action === "edit") {
    editItem(id);
  } else {
    viewItem(id);
  }
});
```

### 示例 2：多级事件委托 — 复杂表格操作

```js
class TableDelegate {
  constructor(tableEl) {
    this.table = tableEl;
    this.handlers = new Map();
    this.bind();
  }

  bind() {
    this.table.addEventListener("click", this._delegate("click"));
    this.table.addEventListener("change", this._delegate("change"));
    this.table.addEventListener("contextmenu", this._delegate("contextmenu"));
  }

  _delegate(eventType) {
    return (e) => {
      const target = e.target;
      // 向上查找匹配的选择器
      const row = target.closest("tr");
      const cell = target.closest("td, th");
      const btn = target.closest("[data-action]");

      const context = {
        event: e,
        row: row,
        cell: cell,
        rowIndex: row ? row.rowIndex : -1,
        cellIndex: cell ? cell.cellIndex : -1,
        action: btn?.dataset.action || null,
        actionValue: btn?.dataset.value || null,
        table: this.table,
      };

      const key = `${eventType}:${btn?.dataset.action || "cell"}`;
      const handler = this.handlers.get(key);
      if (handler) handler(context);
    };
  }

  on(eventType, action, handler) {
    const key = `${eventType}:${action}`;
    this.handlers.set(key, handler);
    return this; // 链式调用
  }
}

// 使用
const table = new TableDelegate(document.getElementById("dataTable"));
table
  .on("click", "delete", (ctx) => {
    console.log(`删除第 ${ctx.rowIndex} 行`);
    ctx.row.remove();
  })
  .on("click", "edit", (ctx) => {
    console.log(`编辑第 ${ctx.rowIndex} 行第 ${ctx.cellIndex} 列`);
  })
  .on("contextmenu", "cell", (ctx) => {
    e.preventDefault();
    console.log(`右键菜单: ${ctx.rowIndex}, ${ctx.cellIndex}`);
  });
```

### 示例 3：事件委托 + 节流 — 高性能滚动列表

```js
class VirtualList {
  constructor(container, itemHeight, renderItem) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
    this.items = [];
    this.visibleRange = { start: 0, end: 0 };
    this.lastScrollTop = 0;
    this._rafId = null;
  }

  setData(items) {
    this.items = items;
    this.container.style.height = `${items.length * this.itemHeight}px`;
    this.container.style.position = "relative";
    this._render();
  }

  _render() {
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;
    const start = Math.floor(scrollTop / this.itemHeight);
    const end = Math.min(
      Math.ceil((scrollTop + containerHeight) / this.itemHeight),
      this.items.length - 1,
    );

    // 只渲染可见区域 + 缓冲区
    const buffer = 5;
    const renderStart = Math.max(0, start - buffer);
    const renderEnd = Math.min(this.items.length - 1, end + buffer);

    // DOM diff：只更新变化的部分
    this._diffRender(renderStart, renderEnd, scrollTop);
  }

  _diffRender(start, end, scrollTop) {
    const newRange = `${start}-${end}`;
    if (this.visibleRange._key === newRange) return; // 范围未变，跳过

    const oldRange = this.visibleRange;
    this.visibleRange = { start, end, _key: newRange };

    // 计算偏移
    const offsetY = start * this.itemHeight;
    this.container.style.transform = `translateY(${offsetY}px)`;

    // 只创建/更新需要的 DOM 节点
    const existingNodes = this.container.querySelectorAll(".virt-item");
    const existingMap = new Map();
    existingNodes.forEach((n) => existingMap.set(n.dataset.index, n));

    const fragment = document.createDocumentFragment();
    const neededKeys = new Set();

    for (let i = start; i <= end; i++) {
      neededKeys.add(String(i));
      let node = existingMap.get(String(i));
      if (node) {
        // 复用已有节点
        node.textContent = this.renderItem(this.items[i], i);
      } else {
        // 创建新节点
        node = document.createElement("div");
        node.className = "virt-item";
        node.dataset.index = i;
        node.style.height = `${this.itemHeight}px`;
        node.style.position = "absolute";
        node.style.top = `${(i - start) * this.itemHeight}px`;
        node.style.left = "0";
        node.style.right = "0";
        node.textContent = this.renderItem(this.items[i], i);
      }
      fragment.appendChild(node);
    }

    // 移除不再需要的节点
    existingNodes.forEach((n) => {
      if (!neededKeys.has(n.dataset.index)) n.remove();
    });

    if (existingNodes.length === 0) {
      this.container.appendChild(fragment);
    }
  }

  init() {
    // 使用 rAF 节流滚动事件
    this.container.addEventListener(
      "scroll",
      () => {
        if (this._rafId) return;
        this._rafId = requestAnimationFrame(() => {
          this._render();
          this._rafId = null;
        });
      },
      { passive: true },
    );
  }
}
```

---

## 二、DOM Diff 算法

### 示例 4：简易 DOM Diff（双端比较）

```js
/**
 * 双端比较 DOM Diff 算法
 * 对比新旧子节点数组，生成最小 patch 操作
 */
function domDiff(oldChildren, newChildren) {
  const patches = [];
  let oldStart = 0,
    oldEnd = oldChildren.length - 1;
  let newStart = 0,
    newEnd = newChildren.length - 1;

  while (oldStart <= oldEnd && newStart <= newEnd) {
    // 跳过已处理的节点
    if (oldChildren[oldStart] === null) {
      oldStart++;
      continue;
    }
    if (oldChildren[oldEnd] === null) {
      oldEnd--;
      continue;
    }
    if (newChildren[newStart] === null) {
      newStart++;
      continue;
    }
    if (newChildren[newEnd] === null) {
      newEnd--;
      continue;
    }

    const os = oldChildren[oldStart],
      ns = newChildren[newStart];
    const oe = oldChildren[oldEnd],
      ne = newChildren[newEnd];

    // 头-头匹配
    if (isSameNode(os, ns)) {
      patches.push({ type: "patch", oldIdx: oldStart, newIdx: newStart });
      oldStart++;
      newStart++;
    }
    // 尾-尾匹配
    else if (isSameNode(oe, ne)) {
      patches.push({ type: "patch", oldIdx: oldEnd, newIdx: newEnd });
      oldEnd--;
      newEnd--;
    }
    // 头-尾匹配（节点移到末尾）
    else if (isSameNode(os, ne)) {
      patches.push({ type: "move", from: oldStart, to: newEnd });
      oldStart++;
      newEnd--;
    }
    // 尾-头匹配（节点移到开头）
    else if (isSameNode(oe, ns)) {
      patches.push({ type: "move", from: oldEnd, to: newStart });
      oldEnd--;
      newStart++;
    }
    // 都不匹配，在旧数组中查找新头节点
    else {
      const idxInOld = oldChildren.findIndex(
        (n, i) => n !== null && isSameNode(n, ns),
      );
      if (idxInOld > -1) {
        patches.push({ type: "move", from: idxInOld, to: newStart });
        oldChildren[idxInOld] = null;
      } else {
        patches.push({ type: "add", idx: newStart, node: ns });
      }
      newStart++;
    }
  }

  // 处理剩余
  if (oldStart <= oldEnd) {
    for (let i = oldStart; i <= oldEnd; i++) {
      if (oldChildren[i] !== null) {
        patches.push({ type: "remove", idx: i });
      }
    }
  }
  if (newStart <= newEnd) {
    for (let i = newStart; i <= newEnd; i++) {
      patches.push({ type: "add", idx: i, node: newChildren[i] });
    }
  }

  return patches;
}

function isSameNode(a, b) {
  return a?.tag === b?.tag && a?.key === b?.key;
}

// 测试
const oldVNodes = [
  { tag: "div", key: "a" },
  { tag: "div", key: "b" },
  { tag: "div", key: "c" },
  { tag: "div", key: "d" },
];
const newVNodes = [
  { tag: "div", key: "d" },
  { tag: "div", key: "a" },
  { tag: "div", key: "e" },
  { tag: "div", key: "c" },
];

console.log(domDiff(oldVNodes, newVNodes));
// [
//   { type: 'move', from: 3, to: 0 },  // d 移到开头
//   { type: 'patch', oldIdx: 0, newIdx: 1 }, // a 位置变化但内容相同
//   { type: 'add', idx: 2, node: { tag: 'div', key: 'e' } }, // 新增 e
//   { type: 'patch', oldIdx: 2, newIdx: 3 }, // c 位置变化
//   { type: 'remove', idx: 1 } // 移除 b
// ]
```

### 示例 5：基于 Key 的列表 Diff + 实际 DOM 更新

```js
class DOMPatch {
  apply(parentNode, patches) {
    const children = Array.from(parentNode.children);
    const keyToNode = new Map(
      children.map((n) => [n.dataset.key || n.textContent, n]),
    );

    // 排序 patches：先 add/move，再 remove
    const sorted = [...patches].sort((a, b) => {
      const order = { add: 0, move: 0, patch: 0, remove: 1 };
      return (order[a.type] || 0) - (order[b.type] || 0);
    });

    for (const patch of sorted) {
      switch (patch.type) {
        case "add": {
          const el = this.createElement(patch.node);
          const refNode = children[patch.idx];
          parentNode.insertBefore(el, refNode || null);
          break;
        }
        case "remove": {
          const node = children[patch.idx];
          if (node) node.remove();
          break;
        }
        case "move": {
          const node = children[patch.from];
          const refNode = children[patch.to];
          if (node && node !== refNode) {
            parentNode.insertBefore(node, refNode || null);
          }
          break;
        }
        case "patch": {
          // 内容更新（文本节点等）
          const node = children[patch.oldIdx];
          if (node && patch.node) {
            this.updateNode(node, patch.node);
          }
          break;
        }
      }
    }
  }

  createElement(vnode) {
    const el = document.createElement(vnode.tag);
    if (vnode.key) el.dataset.key = vnode.key;
    if (vnode.text) el.textContent = vnode.text;
    if (vnode.children) {
      vnode.children.forEach((child) => {
        el.appendChild(this.createElement(child));
      });
    }
    return el;
  }

  updateNode(el, vnode) {
    if (vnode.text !== undefined) el.textContent = vnode.text;
    if (vnode.attrs) {
      Object.entries(vnode.attrs).forEach(([k, v]) => {
        el.setAttribute(k, v);
      });
    }
  }
}
```

### 示例 6：批量 DOM 更新（DocumentFragment + requestAnimationFrame）

```js
class BatchDOMUpdater {
  constructor() {
    this.tasks = [];
    this._scheduled = false;
  }

  // 添加更新任务
  add(fn) {
    this.tasks.push(fn);
    this._schedule();
    return this;
  }

  // 批量更新列表数据
  updateList(container, data, keyFn, renderFn) {
    const oldChildren = Array.from(container.children);
    const oldKeys = new Map(oldChildren.map((c) => [keyFn(c), c]));

    const newKeys = new Set(data.map(keyFn));
    const fragment = document.createDocumentFragment();

    // 1. 移除不在新数据中的节点
    oldChildren.forEach((child) => {
      if (!newKeys.has(keyFn(child))) {
        child.remove();
      }
    });

    // 2. 按新顺序排列 / 创建节点
    data.forEach((item, idx) => {
      const key = keyFn(item);
      let node = oldKeys.get(key);
      if (node) {
        // 复用并更新
        renderFn(node, item, idx);
      } else {
        // 创建新节点
        node = renderFn(null, item, idx);
      }
      fragment.appendChild(node);
    });

    // 3. 一次性插入（DocumentFragment 不触发重排）
    if (oldKeys.size === 0) {
      container.appendChild(fragment);
    }

    return this;
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
    const tasks = this.tasks.splice(0);
    // 使用 DocumentFragment 批量执行
    tasks.forEach((fn) => fn());
  }
}

// 使用示例
const updater = new BatchDOMUpdater();
const list = document.getElementById("myList");

updater.updateList(
  list,
  [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
    { id: 3, name: "Charlie" },
  ],
  (item) => item.id,
  (node, item) => {
    if (!node) {
      node = document.createElement("li");
      node.dataset.id = item.id;
    }
    node.textContent = item.name;
    return node;
  },
);
```

---

## 三、性能优化

### 示例 7：避免强制同步布局（Forced Reflow）

```js
// ❌ 反模式：读写交替 → 每次写都触发强制同步布局
function badUpdate(elements) {
  elements.forEach((el) => {
    const width = el.offsetWidth; // 读
    el.style.width = width + 10 + "px"; // 写 → 触发 reflow
    const height = el.offsetHeight; // 读 → 强制同步布局！
    el.style.height = height + 10 + "px"; // 写 → 触发 reflow
  });
}

// ✅ 优化：先读后写，批量操作
function goodUpdate(elements) {
  // 阶段 1：批量读取（不会触发 reflow）
  const widths = elements.map((el) => el.offsetWidth);
  const heights = elements.map((el) => el.offsetHeight);

  // 阶段 2：批量写入（只触发一次 reflow）
  elements.forEach((el, i) => {
    el.style.width = widths[i] + 10 + "px";
    el.style.height = heights[i] + 10 + "px";
  });
}

// ✅ 更优：使用 CSS transform（不触发 reflow，只触发 composite）
function bestUpdate(elements) {
  elements.forEach((el) => {
    el.style.transform = "scale(1.05)"; // GPU 加速，只 composite
  });
}
```

### 示例 8：IntersectionObserver 懒加载 + 性能监控

```js
class LazyLoader {
  constructor(options = {}) {
    this.threshold = options.threshold || 0.1;
    this.rootMargin = options.rootMargin || "50px";
    this.placeholder = options.placeholder || this._defaultPlaceholder;
    this.loadedCount = 0;
    this.loadTimes = [];
    this.observer = new IntersectionObserver(
      (entries) => this._handleIntersect(entries),
      { threshold: this.threshold, rootMargin: this.rootMargin },
    );
  }

  observe(container) {
    const targets = container.querySelectorAll("[data-lazy]");
    targets.forEach((el) => this.observer.observe(el));
    return targets.length;
  }

  _handleIntersect(entries) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const el = entry.target;
      const startTime = performance.now();

      // 显示占位
      this.placeholder(el);

      // 加载资源
      this._loadResource(el).then(() => {
        const loadTime = performance.now() - startTime;
        this.loadTimes.push(loadTime);
        this.loadedCount++;

        // 触发 loaded 事件（供性能监控）
        el.dispatchEvent(
          new CustomEvent("lazyloaded", {
            detail: { loadTime, index: this.loadedCount },
          }),
        );
      });

      this.observer.unobserve(el);
    });
  }

  _loadResource(el) {
    const src = el.dataset.lazy;
    if (el.tagName === "IMG") {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          el.src = src;
          el.classList.add("loaded");
          resolve();
        };
        img.onerror = reject;
        img.src = src;
      });
    }
    // 通用：加载 HTML 片段
    return fetch(src)
      .then((r) => r.text())
      .then((html) => {
        el.innerHTML = html;
      });
  }

  _defaultPlaceholder(el) {
    el.classList.add("loading");
  }

  getStats() {
    const times = this.loadTimes;
    return {
      total: this.loadedCount,
      avg: times.reduce((a, b) => a + b, 0) / times.length || 0,
      max: Math.max(...times, 0),
      min: Math.min(...times, Infinity),
      p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)] || 0,
    };
  }

  destroy() {
    this.observer.disconnect();
  }
}
```

### 示例 9：ResizeObserver 响应式布局

```js
class ResponsiveLayout {
  constructor(container, breakpoints) {
    this.container = container;
    this.breakpoints = breakpoints; // [{ max: 768, class: 'mobile' }, ...]
    this.currentBreakpoint = null;
    this._setupObserver();
  }

  _setupObserver() {
    this.observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        this._applyBreakpoint(width);
      }
    });
    this.observer.observe(this.container);
  }

  _applyBreakpoint(width) {
    const bp =
      this.breakpoints.find((b) => width <= b.max) ||
      this.breakpoints[this.breakpoints.length - 1];

    if (bp?.class && bp.class !== this.currentBreakpoint) {
      // 移除旧 breakpoint class
      if (this.currentBreakpoint) {
        this.container.classList.remove(this.currentBreakpoint);
      }
      this.container.classList.add(bp.class);
      this.currentBreakpoint = bp.class;

      // 触发自定义事件
      this.container.dispatchEvent(
        new CustomEvent("breakpointchange", {
          detail: { breakpoint: bp.class, width },
        }),
      );
    }
  }

  destroy() {
    this.observer.disconnect();
  }
}

// 使用
const layout = new ResponsiveLayout(document.getElementById("app"), [
  { max: 480, class: "xs" },
  { max: 768, class: "sm" },
  { max: 1024, class: "md" },
  { max: Infinity, class: "lg" },
]);
```

### 示例 10：高性能事件系统（事件池 + 委托 + 被动监听）

```js
class EventSystem {
  constructor(root) {
    this.root = root;
    this.handlers = new Map(); // eventType -> [{ selector, handler }]
    this._boundHandlers = new Map(); // eventType -> bound function
  }

  on(eventType, selector, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
      this._bindRoot(eventType);
    }
    this.handlers.get(eventType).push({ selector, handler });
    return this;
  }

  _bindRoot(eventType) {
    const bound = (e) => {
      const handlers = this.handlers.get(eventType) || [];
      for (const { selector, handler } of handlers) {
        const target = e.target.closest?.(selector);
        if (target) {
          handler.call(target, e, target);
          break; // 只匹配第一个
        }
      }
    };
    this._boundHandlers.set(eventType, bound);
    this.root.addEventListener(eventType, bound, { passive: true });
  }

  off(eventType, selector) {
    const handlers = this.handlers.get(eventType);
    if (!handlers) return;
    const idx = handlers.findIndex((h) => h.selector === selector);
    if (idx > -1) {
      handlers.splice(idx, 1);
      if (handlers.length === 0) {
        this.root.removeEventListener(
          eventType,
          this._boundHandlers.get(eventType),
        );
        this.handlers.delete(eventType);
        this._boundHandlers.delete(eventType);
      }
    }
  }

  destroy() {
    for (const [eventType, bound] of this._boundHandlers) {
      this.root.removeEventListener(eventType, bound);
    }
    this.handlers.clear();
    this._boundHandlers.clear();
  }
}
```

### 示例 11：MutationObserver 监听 DOM 变化

```js
class DOMWatcher {
  constructor(target, options = {}) {
    this.target = target;
    this.changes = [];
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => this._record(m));
      options.onChange?.(this.changes);
    });

    this.observer.observe(target, {
      childList: options.childList ?? true,
      attributes: options.attributes ?? true,
      characterData: options.characterData ?? false,
      subtree: options.subtree ?? true,
      attributeFilter: options.attributeFilter,
    });
  }

  _record(mutation) {
    const change = {
      type: mutation.type,
      target: mutation.target,
      timestamp: Date.now(),
    };

    if (mutation.type === "childList") {
      change.added = Array.from(mutation.addedNodes)
        .filter((n) => n.nodeType === Node.ELEMENT_NODE)
        .map((n) => ({ tag: n.tagName, class: n.className }));
      change.removed = Array.from(mutation.removedNodes)
        .filter((n) => n.nodeType === Node.ELEMENT_NODE)
        .map((n) => ({ tag: n.tagName, class: n.className }));
    }

    if (mutation.type === "attributes") {
      change.attribute = mutation.attributeName;
      change.oldValue = mutation.oldValue;
    }

    this.changes.push(change);
    // 限制历史记录
    if (this.changes.length > 1000) {
      this.changes = this.changes.slice(-500);
    }
  }

  getChanges() {
    return [...this.changes];
  }

  clear() {
    this.changes = [];
  }

  disconnect() {
    this.observer.disconnect();
  }
}

// 使用：监控特定属性变化
const watcher = new DOMWatcher(document.body, {
  attributeFilter: ["class", "style"],
  onChange: (changes) => {
    console.log(`DOM 变化: ${changes.length} 次`);
  },
});
```

### 示例 12：DOM 操作性能基准测试工具

```js
class DOMBenchmark {
  static measure(name, fn, iterations = 100) {
    const times = [];

    for (let i = 0; i < iterations; i++) {
      // 清理环境
      document.body.innerHTML = '<div id="bench"></div>';

      const start = performance.now();
      fn();
      const end = performance.now();
      times.push(end - start);
    }

    const sorted = times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;

    console.log(`\n📊 ${name} (${iterations} 次)`);
    console.log(`  平均: ${avg.toFixed(3)}ms`);
    console.log(`  P50:  ${sorted[Math.floor(iterations * 0.5)].toFixed(3)}ms`);
    console.log(
      `  P95:  ${sorted[Math.floor(iterations * 0.95)].toFixed(3)}ms`,
    );
    console.log(
      `  P99:  ${sorted[Math.floor(iterations * 0.99)].toFixed(3)}ms`,
    );
    console.log(`  最快: ${sorted[0].toFixed(3)}ms`);
    console.log(`  最慢: ${sorted[sorted.length - 1].toFixed(3)}ms`);

    return { avg, p50: sorted[Math.floor(iterations * 0.5)], times };
  }
}

// 对比测试：innerHTML vs DocumentFragment vs createElement
const testData = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  text: `Item ${i}`,
}));

document.body.innerHTML = '<div id="bench"></div>';
const bench = document.getElementById("bench");

// 方法 1：innerHTML 拼接
DOMBenchmark.measure(
  "innerHTML 拼接",
  () => {
    bench.innerHTML = testData
      .map(
        (item) => `<div class="item" data-id="${item.id}">${item.text}</div>`,
      )
      .join("");
  },
  50,
);

// 方法 2：DocumentFragment
DOMBenchmark.measure(
  "DocumentFragment",
  () => {
    const frag = document.createDocumentFragment();
    testData.forEach((item) => {
      const div = document.createElement("div");
      div.className = "item";
      div.dataset.id = item.id;
      div.textContent = item.text;
      frag.appendChild(div);
    });
    bench.appendChild(frag);
  },
  50,
);

// 方法 3：预分配数组 + innerHTML
DOMBenchmark.measure(
  "预分配 + innerHTML",
  () => {
    const html = new Array(testData.length);
    for (let i = 0; i < testData.length; i++) {
      html[i] =
        `<div class="item" data-id="${testData[i].id}">${testData[i].text}</div>`;
    }
    bench.innerHTML = html.join("");
  },
  50,
);
```

---

## 四、综合实战

### 示例 13：高性能可排序表格（整合所有技术）

```js
class SortableTable {
  constructor(container, config) {
    this.container = container;
    this.columns = config.columns;
    this.data = [];
    this.sortCol = null;
    this.sortDir = "asc";
    this._rafId = null;
    this._build();
    this._bindEvents();
  }

  _build() {
    this.container.innerHTML = "";
    this.container.className = "sortable-table";

    // 表头
    this.thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    this.columns.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col.label;
      th.dataset.col = col.key;
      if (col.sortable) th.classList.add("sortable");
      headerRow.appendChild(th);
    });
    this.thead.appendChild(headerRow);

    // 表体（使用 DocumentFragment 初始构建）
    this.tbody = document.createElement("tbody");

    // 组装
    const table = document.createElement("table");
    table.appendChild(this.thead);
    table.appendChild(this.tbody);
    this.container.appendChild(table);
  }

  _bindEvents() {
    // 事件委托：表头点击排序
    this.thead.addEventListener("click", (e) => {
      const th = e.target.closest("th.sortable");
      if (!th) return;

      const col = th.dataset.col;
      if (this.sortCol === col) {
        this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
      } else {
        this.sortCol = col;
        this.sortDir = "asc";
      }

      // 更新表头样式（批量写入）
      this.thead.querySelectorAll("th").forEach((h) => {
        h.classList.remove("asc", "desc");
        if (h.dataset.col === col) h.classList.add(this.sortDir);
      });

      this._sortAndRender();
    });

    // 事件委托：行内操作按钮
    this.tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const row = btn.closest("tr");
      const idx = row ? parseInt(row.dataset.index) : -1;

      switch (btn.dataset.action) {
        case "delete":
          this.data.splice(idx, 1);
          this._render();
          break;
        case "select":
          this._toggleSelect(row);
          break;
      }
    });
  }

  setData(data) {
    this.data = [...data];
    this._render();
  }

  _sortAndRender() {
    if (!this.sortCol) return this._render();

    const col = this.columns.find((c) => c.key === this.sortCol);
    this.data.sort((a, b) => {
      let va = a[this.sortCol],
        vb = b[this.sortCol];
      if (typeof va === "string") {
        va = va.toLowerCase();
        vb = vb.toLowerCase();
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return this.sortDir === "asc" ? cmp : -cmp;
    });
    this._render();
  }

  _render() {
    // 使用 rAF 批量更新
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(() => {
      this._renderRows();
      this._rafId = null;
    });
  }

  _renderRows() {
    const fragment = document.createDocumentFragment();

    this.data.forEach((row, idx) => {
      const tr = document.createElement("tr");
      tr.dataset.index = idx;

      this.columns.forEach((col) => {
        const td = document.createElement("td");
        td.textContent = col.format
          ? col.format(row[col.key], row)
          : row[col.key];
        tr.appendChild(td);
      });

      // 操作列
      const actions = document.createElement("td");
      actions.className = "actions";
      actions.innerHTML = `
        <button data-action="select" data-index="${idx}">选择</button>
        <button data-action="delete" data-index="${idx}">删除</button>
      `;
      tr.appendChild(actions);
      fragment.appendChild(tr);
    });

    // 一次性替换（避免多次 DOM 操作）
    this.tbody.innerHTML = "";
    this.tbody.appendChild(fragment);
  }

  _toggleSelect(row) {
    row.classList.toggle("selected");
  }
}

// 使用
const table = new SortableTable(document.getElementById("table-container"), {
  columns: [
    { key: "name", label: "姓名", sortable: true },
    { key: "age", label: "年龄", sortable: true },
    {
      key: "date",
      label: "日期",
      sortable: true,
      format: (d) => new Date(d).toLocaleDateString(),
    },
    { key: "status", label: "状态", format: (v) => (v ? "✅" : "❌") },
  ],
});

table.setData([
  { name: "Alice", age: 28, date: "2024-01-15", status: true },
  { name: "Bob", age: 32, date: "2024-03-22", status: false },
  { name: "Charlie", age: 25, date: "2024-06-01", status: true },
]);
```

### 示例 14：自定义元素（Web Components）+ Shadow DOM

```js
class VirtualCard extends HTMLElement {
  static get observedAttributes() {
    return ["title", "status", "priority"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 16px;
          border-radius: 8px;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        :host(:hover) {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }
        .title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
        .meta { display: flex; gap: 8px; font-size: 12px; }
        .badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }
        .badge.active { background: #e6f7ee; color: #00a854; }
        .badge.inactive { background: #fff1f0; color: #f5222d; }
        .badge.high { background: #fff7e6; color: #fa8c16; }
        .badge.medium { background: #e6f7ff; color: #1890ff; }
        .badge.low { background: #f6f6f6; color: #8c8c8c; }
        .content { margin-top: 12px; }
        ::slotted(*) { color: #595959; font-size: 14px; line-height: 1.6; }
      </style>
      <div class="title">${this.getAttribute("title") || "Untitled"}</div>
      <div class="meta">
        <span class="badge ${this.getAttribute("status") || "active"}">
          ${this.getAttribute("status") || "active"}
        </span>
        <span class="badge ${this.getAttribute("priority") || "medium"}">
          ${this.getAttribute("priority") || "medium"}
        </span>
      </div>
      <div class="content">
        <slot></slot>
      </div>
    `;
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    // Shadow DOM 内更新（不影响主 DOM 树）
    this.render();
  }

  render() {
    const titleEl = this.shadowRoot.querySelector(".title");
    if (titleEl) titleEl.textContent = this.getAttribute("title") || "Untitled";
  }
}

customElements.define("virtual-card", VirtualCard);

// 使用
// <virtual-card title="任务卡片" status="active" priority="high">
//   <p>这是卡片内容，通过 slot 插入</p>
// </virtual-card>
```

---

## 五、核心知识点总结

### 事件委托三要素

1. **监听父元素**而非子元素
2. **e.target / e.target.closest()** 定位实际目标
3. **data-\* 属性**传递上下文信息

### DOM Diff 核心策略

| 策略           | 说明                        | 时间复杂度 |
| -------------- | --------------------------- | ---------- |
| 双端比较       | 头头/尾尾/头尾/尾头四路比较 | O(n)       |
| Key 映射       | 用 Map 快速定位节点         | O(n)       |
| 最长递增子序列 | Vue 3 用的优化方案          | O(n log n) |

### 性能优化清单

- ✅ **读写分离**：先读所有 DOM 属性，再批量写入
- ✅ **DocumentFragment**：批量插入不触发重排
- ✅ **requestAnimationFrame**：与浏览器刷新率同步
- ✅ **CSS transform/opacity**：只触发 composite，不触发 reflow
- ✅ **IntersectionObserver**：替代 scroll 事件做懒加载
- ✅ **ResizeObserver**：替代 window resize 做响应式
- ✅ **事件委托**：减少事件监听器数量
- ✅ **passive: true**：滚动/触摸事件不阻塞页面
- ✅ **Shadow DOM**：隔离样式，减少 CSS 选择器开销

### 反模式速查

- ❌ 在循环中读写 DOM 属性（交替触发 reflow）
- ❌ 给大量子元素分别绑定事件（内存泄漏）
- ❌ innerHTML 直接插入不可信内容（XSS）
- ❌ 同步 XHR 阻塞主线程
- ❌ 频繁操作 DOM 样式（应改 class 而非 style）
- ❌ 不在组件销毁时移除事件监听器

---

## 六、与框架的关联

### Vue 3 Patch 算法中的 DOM Diff

- 使用**最长递增子序列**优化移动操作
- Key 映射分两遍：先处理头尾相同节点，再处理中间
- 静态提升（hoistStatic）：静态节点只创建一次

### React Fiber 中的 DOM 更新

- Fiber 树 = 双缓冲 DOM 表示
- reconcileChildFibers 做 diff
- commitPhase 批量应用 DOM 变更
- 使用 `beforeMutation` / `mutation` / `layout` 三阶段

### 原生 vs 框架

| 维度     | 原生 DOM       | Vue/React      |
| -------- | -------------- | -------------- |
| 更新粒度 | 手动精确控制   | 自动批量更新   |
| 性能     | 上限高，下限低 | 稳定在中上     |
| 复杂度   | 低（简单场景） | 高（复杂场景） |
| 可维护性 | 依赖开发者纪律 | 框架保证一致性 |

---

_文件生成时间：2026-05-10 07:00_
_专项训练累计：14 个 DOM 示例（事件委托 3 + DOM Diff 3 + 性能优化 5 + 综合实战 3）_
