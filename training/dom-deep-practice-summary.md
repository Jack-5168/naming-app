# DOM 深度练习 — 专项训练总结

> 专项训练 07:00 | 2026-04-28 | 原生 DOM API 深度练习

---

## 📁 产出文件

`training/dom-deep-practice.html` — 包含 15 个完整可运行的示例

---

## 🎯 15 个示例清单

### 一、事件委托 (3 个)

| # | 示例 | 核心知识点 |
|---|------|-----------|
| 1 | 动态列表事件委托 | `addEventListener` 绑在父元素，`closest()` 匹配子元素，新增/删除子元素无需重新绑定 |
| 2 | 多级嵌套精确匹配 | `matches()` 精确判断目标类型，区分不同层级的事件源 |
| 3 | 键盘事件 & 快捷键 | `keydown` 事件委托，`preventDefault()` 阻止浏览器默认行为 |

**事件委托核心原则：**
- 利用事件冒泡机制，在父级统一处理
- 用 `e.target.closest(selector)` 或 `e.target.matches(selector)` 精确匹配
- 优势：内存占用少、动态元素自动生效、无需管理事件解绑

---

### 二、DOM Diff 算法 (1 个)

| # | 示例 | 核心知识点 |
|---|------|-----------|
| 4 | 虚拟 DOM Diff | key-based diff、四种操作类型 (add/remove/modify/move)、最小化 DOM 操作 |

**Diff 算法核心：**
```
1. 用 Map 建立 key → index 映射
2. 遍历旧节点 → 找出需要 remove 的
3. 遍历新节点 → 找出需要 add 的
4. 对比同 key 节点 → 找出需要 modify 的
5. 对比 index → 找出需要 move 的
```

---

### 三、性能优化 (11 个)

| # | 示例 | 核心知识点 |
|---|------|-----------|
| 5 | DocumentFragment 批量插入 | `createDocumentFragment()` 一次性插入，避免多次 reflow |
| 6 | requestAnimationFrame | 浏览器自动匹配刷新率 (60fps)，比 `setInterval` 更流畅省电 |
| 7 | IntersectionObserver 懒加载 | 元素进入视口才加载资源，替代 scroll 事件监听 |
| 8 | MutationObserver | 监听 DOM 变化 (childList/characterData/attributes)，替代 DOM3 Events |
| 9 | 虚拟滚动 | 只渲染可视区域 + buffer 的节点，10 万条数据流畅滚动 |
| 10 | 防抖 & 节流 | debounce (停止后触发) vs throttle (固定间隔触发) |
| 11 | CustomEvent 事件总线 | `EventTarget` + `CustomEvent` 实现组件间解耦通信 |
| 12 | TreeWalker | `createTreeWalker()` 高效遍历 DOM，比递归快 |
| 13 | CSS Containment | `contain: strict` 隔离渲染范围，限制 reflow/repaint |
| 14 | Read/Write Batching | 先读后写，避免 Layout Thrashing |
| 15 | 完整组件 | 事件委托 + Diff + Fragment + 生命周期 整合实战 |

---

## 🔑 关键性能优化清单

### 减少 Reflow/Repaint
1. **DocumentFragment** — 批量 DOM 操作只触发 1 次 reflow
2. **CSS Containment** — `contain: strict` 隔离渲染范围
3. **Read/Write Batching** — 先读所有 offsetWidth/height，再统一写入
4. **requestAnimationFrame** — 浏览器在下一帧统一渲染

### 减少事件监听器
5. **事件委托** — 一个监听器处理 N 个子元素
6. **防抖/节流** — 降低高频事件 (scroll/input/resize) 的触发频率
7. **IntersectionObserver** — 替代 scroll 事件做懒加载/无限滚动

### 减少 DOM 操作
8. **DOM Diff** — 只更新变化的节点
9. **虚拟滚动** — 只渲染可视区域的节点
10. **innerHTML 批量设置** — 比逐个 appendChild 快

### 监听变化
11. **MutationObserver** — 高效监听 DOM 变化
12. **CustomEvent** — 组件间解耦通信

### 遍历优化
13. **TreeWalker** — 比递归遍历快，支持过滤

---

## 📊 性能对比数据 (示例 5)

| 方式 | 操作次数 | Reflow 次数 | 典型耗时 |
|------|---------|------------|---------|
| 逐个 appendChild | 1000 次 | ~1000 次 | 15-30ms |
| DocumentFragment | 1 次 | 1 次 | 3-8ms |

**Fragment 快 3-5 倍**，数据量越大差距越明显。

---

## 🧠 面试高频考点

1. **事件冒泡 vs 捕获** — `addEventListener(type, fn, useCapture)`
2. **`e.target` vs `e.currentTarget`** — 实际触发元素 vs 绑定监听器的元素
3. **`stopPropagation()` vs `preventDefault()`** — 阻止冒泡 vs 阻止默认行为
4. **Reflow vs Repaint** — 布局变化 (尺寸/位置) vs 样式变化 (颜色/阴影)
5. **哪些操作触发 Reflow** — 修改布局属性、读取 offset/scroll 属性、window resize
6. **虚拟 DOM 的意义** — 不是比原生 DOM 快，而是提供声明式 API + 批量优化
7. **requestAnimationFrame vs setTimeout** — RAF 与屏幕刷新同步，不会丢帧

---

## 🚀 下一步建议

- 用浏览器打开 `training/dom-deep-practice.html` 逐个体验
- 在 DevTools Performance 面板录制各示例，观察 reflow/repaint 分布
- 尝试修改示例 15 的组件，添加编辑/拖拽功能
- 延伸阅读：React Fiber 架构 (已分析过)、Vue 3 响应式 (已分析过)
