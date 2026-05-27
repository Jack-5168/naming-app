# DOM 操作专项训练 - 学习指南

## 📚 概述

本训练包含 **12 个示例**，覆盖原生 DOM API 的核心技术：

| 示例 | 主题                  | 核心概念                                             |
| ---- | --------------------- | ---------------------------------------------------- |
| 1    | 基础 DOM 操作         | createElement, appendChild, innerHTML vs textContent |
| 2    | 事件委托              | 事件冒泡、性能优化                                   |
| 3    | DOM Diff 算法         | 虚拟 DOM、最小化更新                                 |
| 4    | DocumentFragment      | 批量更新、减少重排                                   |
| 5    | 防抖与节流            | 高频事件优化                                         |
| 6    | 虚拟滚动              | 大数据列表渲染                                       |
| 7    | MutationObserver      | DOM 变化监听                                         |
| 8    | requestAnimationFrame | 流畅动画                                             |
| 9    | 事件监听器管理        | 避免内存泄漏                                         |
| 10   | classList API         | 高效类名操作                                         |
| 11   | template 克隆         | 高效创建重复结构                                     |
| 12   | dataset 属性          | 数据属性读写                                         |

---

## 🔍 详细解析

### 示例 1: 基础 DOM 操作

**关键知识点：**

```javascript
// ✅ 推荐：createElement + textContent (安全)
const div = document.createElement("div");
div.textContent = userInput; // 自动转义，防 XSS

// ⚠️ 谨慎：innerHTML (有 XSS 风险)
div.innerHTML = "<span>HTML 内容</span>"; // 可执行 HTML

// ❌ 避免：直接拼接 HTML 字符串
container.innerHTML += "<div>" + userInput + "</div>"; // 性能差 + XSS
```

**最佳实践：**

- 使用 `createElement` 而非 `innerHTML` 拼接
- 用户输入用 `textContent`，信任内容用 `innerHTML`
- 批量操作前先缓存容器引用

---

### 示例 2: 事件委托

**原理：** 利用事件冒泡，在父元素上监听，通过 `event.target` 识别实际触发元素

```javascript
// ❌ 低效：每个子元素都绑定监听器
items.forEach((item) => {
  item.addEventListener("click", handler); // N 个监听器
});

// ✅ 高效：只在一个父元素上绑定
parent.addEventListener("click", function (e) {
  if (e.target.matches(".item")) {
    handler(e.target); // 1 个监听器
  }
});
```

**优势：**

- 内存占用少（1 个 vs N 个监听器）
- 动态添加的元素自动生效
- 适合列表、表格等场景

---

### 示例 3: DOM Diff 算法

**核心思想：** 比较新旧虚拟 DOM 树，计算最小变更集

```javascript
// 简化版 Diff 逻辑
function diff(oldTree, newTree) {
  const patches = [];

  // 1. 检测节点类型变化
  if (oldTree.type !== newTree.type) {
    patches.push({ type: "REPLACE", node: newTree });
    return patches;
  }

  // 2. 检测属性变化
  patches.push(...diffProps(oldTree.props, newTree.props));

  // 3. 检测子节点变化 (带 key 优化)
  patches.push(...diffChildren(oldTree.children, newTree.children));

  return patches;
}
```

**Key 的作用：**

- 帮助识别节点身份（而非位置）
- 减少不必要的移动/重建
- React/Vue 等框架的核心优化

---

### 示例 4: DocumentFragment

**性能对比：**

```javascript
// ❌ 逐个添加：100 次重排
for (let i = 0; i < 100; i++) {
  container.appendChild(item); // 每次都触发重排
}

// ✅ Fragment：1 次重排
const fragment = document.createDocumentFragment();
for (let i = 0; i < 100; i++) {
  fragment.appendChild(item); // 内存中操作
}
container.appendChild(fragment); // 一次性插入
```

**性能提升：** 通常 10-100 倍（取决于元素数量）

---

### 示例 5: 防抖与节流

**防抖 (Debounce):** 等待一段时间，如果期间没有新触发才执行

```javascript
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
// 适用：搜索输入、窗口 resize
```

**节流 (Throttle):** 固定时间间隔内只执行一次

```javascript
function throttle(fn, limit) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
// 适用：滚动、鼠标移动
```

---

### 示例 6: 虚拟滚动

**问题：** 渲染 10000 个 DOM 元素会导致页面卡顿

**解决方案：** 只渲染可见区域（+ 少量缓冲）

```javascript
function renderVirtualList() {
  const scrollTop = container.scrollTop;
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = startIndex + visibleCount + 2; // +2 缓冲

  // 只渲染可见项
  renderItems(items.slice(startIndex, endIndex));

  // 用 spacer 占位保持滚动高度
  container.style.height = `${items.length * itemHeight}px`;
}
```

**性能：** 从渲染 10000 个 → 渲染 10-15 个

---

### 示例 7: MutationObserver

**替代方案对比：**

```javascript
// ❌ 轮询：性能差
setInterval(() => {
  if (element.changed) handle();
}, 100);

// ✅ MutationObserver：高效监听
const observer = new MutationObserver(callback);
observer.observe(target, {
  childList: true,
  attributes: true,
  subtree: true,
});
```

**适用场景：**

- 监听第三方库修改的 DOM
- 响应式更新 UI
- 调试/日志记录

---

### 示例 8: requestAnimationFrame

**对比 setInterval：**

```javascript
// ❌ setInterval：固定间隔，可能与帧不同步
setInterval(() => {
  update(); // 可能掉帧或重复渲染
}, 16);

// ✅ requestAnimationFrame：与刷新率同步
function animate() {
  update();
  requestAnimationFrame(animate); // 约 60fps
}
```

**优势：**

- 自动匹配显示器刷新率
- 页面不可见时自动暂停（省电）
- 浏览器可优化批量更新

---

### 示例 9: 事件监听器管理

**内存泄漏风险：**

```javascript
// ❌ 忘记移除：组件销毁后监听器仍存在
element.addEventListener("click", handler);

// ✅ 成对管理
element.addEventListener("click", handler);
// ... 清理时
element.removeEventListener("click", handler);
```

**最佳实践：**

- 组件/页面卸载时清理监听器
- 使用 WeakMap 跟踪监听器
- 考虑使用 AbortController（现代方案）

```javascript
// 现代方案：AbortController
const controller = new AbortController();
element.addEventListener("click", handler, { signal: controller.signal });
// 清理
controller.abort(); // 一次性移除所有关联监听器
```

---

### 示例 10: classList API

**对比：**

```javascript
// ❌ 老式方法：字符串操作
element.className = element.className + " new-class"; // 可能重复
element.className = element.className.replace("old", "new"); // 复杂

// ✅ classList：语义清晰
element.classList.add("new-class");
element.classList.remove("old-class");
element.classList.toggle("active");
element.classList.contains("active"); // 检查
```

**优势：** 自动去重、链式调用、性能更好

---

### 示例 11: template 克隆

**优势：**

```javascript
// ❌ 字符串拼接：易出错、无语法高亮
container.innerHTML += `<div class="card"><h3>${title}</h3></div>`;

// ✅ template：HTML 解析、安全、高效
const template = document.getElementById("card-template");
const clone = template.content.cloneNode(true);
clone.querySelector("h3").textContent = title;
container.appendChild(clone);
```

**特点：**

- `<template>` 内容不渲染，直到克隆
- 支持任意 HTML 结构
- 比 innerHTML 更安全

---

### 示例 12: dataset 属性

**读写数据属性：**

```javascript
// HTML: <div data-user-id="123" data-user-name="张三">

// ✅ 读取
element.dataset.userId;     // "123"
element.dataset.userName;   // "张三"

// ✅ 写入
element.dataset.lastLogin = Date.now();

// ✅ 读取全部
{ ...element.dataset }; // { userId: "123", userName: "张三", lastLogin: "..." }
```

**注意：** 连字符转驼峰（`data-user-id` → `dataset.userId`）

---

## 🎯 性能优化总结

| 技术                  | 适用场景   | 性能提升          |
| --------------------- | ---------- | ----------------- |
| 事件委托              | 列表、表格 | 内存减少 N 倍     |
| DocumentFragment      | 批量插入   | 10-100 倍         |
| 虚拟滚动              | 大数据列表 | 渲染量减少 99%    |
| requestAnimationFrame | 动画       | 流畅度提升        |
| 防抖/节流             | 高频事件   | 执行次数减少 90%+ |
| MutationObserver      | DOM 监听   | CPU 占用降低      |

---

## 📖 扩展阅读

- [MDN DOM 文档](https://developer.mozilla.org/zh-CN/docs/Web/API/Document_Object_Model)
- [React 虚拟 DOM 原理](https://react.dev/learn/render-and-commit)
- [Vue 响应式原理](https://vuejs.org/guide/extras/reactivity-in-depth.html)
- [Web 性能优化最佳实践](https://web.dev/fast/)

---

**练习建议：**

1. 打开 `examples.html` 逐个体验
2. 打开开发者工具观察 DOM 变化
3. 使用 Performance 面板分析性能
4. 尝试修改代码，观察效果变化
