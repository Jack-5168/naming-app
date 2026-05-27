# DOM 操作专项训练 - 文件清单

## 📁 目录结构

```
dom-training/
├── examples.html          # 主训练文件（12 个交互式示例）
├── README.md              # 详细学习指南与理论解析
├── advanced-examples.js   # 高级工具函数库（12+ 实用函数）
└── MANIFEST.md            # 本文件（清单与索引）
```

## 📋 训练内容总览

### 基础篇（examples.html 示例 1-4）

| 示例 | 主题             | 文件位置 | 核心 API                                      |
| ---- | ---------------- | -------- | --------------------------------------------- |
| 1    | 基础 DOM 操作    | `#ex1`   | `createElement`, `appendChild`, `textContent` |
| 2    | 事件委托         | `#ex2`   | `addEventListener`, `event.target`, `dataset` |
| 3    | DOM Diff         | `#ex3`   | 虚拟 DOM 比较算法                             |
| 4    | DocumentFragment | `#ex4`   | `createDocumentFragment`                      |

### 进阶篇（examples.html 示例 5-8）

| 示例 | 主题                  | 文件位置 | 核心 API                                        |
| ---- | --------------------- | -------- | ----------------------------------------------- |
| 5    | 防抖与节流            | `#ex5`   | `setTimeout`, `clearTimeout`                    |
| 6    | 虚拟滚动              | `#ex6`   | `scrollTop`, 可见区域计算                       |
| 7    | MutationObserver      | `#ex7`   | `MutationObserver`, `observe`                   |
| 8    | requestAnimationFrame | `#ex8`   | `requestAnimationFrame`, `cancelAnimationFrame` |

### 高级篇（examples.html 示例 9-12）

| 示例 | 主题           | 文件位置 | 核心 API                                  |
| ---- | -------------- | -------- | ----------------------------------------- |
| 9    | 事件监听器管理 | `#ex9`   | `addEventListener`, `removeEventListener` |
| 10   | classList API  | `#ex10`  | `classList.add/remove/toggle`             |
| 11   | template 克隆  | `#ex11`  | `<template>`, `cloneNode`                 |
| 12   | dataset 属性   | `#ex12`  | `element.dataset`                         |

### 工具库（advanced-examples.js）

| 函数                    | 用途         | 场景                  |
| ----------------------- | ------------ | --------------------- |
| `$`, `$$`               | 安全选择器   | 替代 querySelector    |
| `createEl`              | 元素创建工厂 | 快速创建带属性的元素  |
| `DOMBatch`              | 批量更新队列 | 合并多帧操作          |
| `renderList`            | 高效列表渲染 | 带 key 追踪的列表更新 |
| `EventBus`              | 事件总线     | 组件间通信            |
| `whenVisible`           | 可见性检测   | 懒加载、动画触发      |
| `createDebouncedSearch` | 防抖搜索     | 搜索框优化            |
| `makeSortable`          | 拖拽排序     | 可排序列表            |
| `FormValidator`         | 表单验证     | 实时表单验证          |
| `InfiniteScroll`        | 无限滚动     | 分页加载              |
| `DOMPerformanceMonitor` | 性能监控     | 检测慢操作            |
| `detectMemoryLeaks`     | 内存泄漏检测 | 监听器追踪            |

## 🎯 学习目标

完成本训练后，你应该能够：

1. ✅ 熟练使用原生 DOM API 进行元素创建、修改、删除
2. ✅ 理解并应用事件委托优化事件处理
3. ✅ 理解虚拟 DOM 和 Diff 算法的基本原理
4. ✅ 使用 DocumentFragment 优化批量 DOM 操作
5. ✅ 实现防抖和节流优化高频事件
6. ✅ 实现虚拟滚动处理大数据列表
7. ✅ 使用 MutationObserver 监听 DOM 变化
8. ✅ 使用 requestAnimationFrame 创建流畅动画
9. ✅ 正确管理事件监听器避免内存泄漏
10. ✅ 使用 classList 高效操作 CSS 类
11. ✅ 使用 template 元素高效克隆结构
12. ✅ 使用 dataset 读写数据属性

## 📝 练习建议

### 第一遍：浏览体验

1. 打开 `examples.html`
2. 逐个点击按钮，观察效果
3. 阅读每个示例的说明文字

### 第二遍：代码阅读

1. 打开开发者工具（F12）
2. 查看 Sources 面板中的代码
3. 理解每个函数的实现逻辑

### 第三遍：动手修改

1. 修改示例参数（如防抖延迟、节流间隔）
2. 观察性能变化
3. 尝试添加新功能

### 第四遍：独立实现

1. 关闭示例文件
2. 尝试从零实现类似功能
3. 对照参考答案优化代码

## 🔧 开发工具推荐

- **浏览器开发者工具** - Elements, Console, Performance 面板
- **Lighthouse** - 性能审计
- **Chrome DevTools Performance** - 帧分析、重排检测
- **Memory 面板** - 堆快照、内存泄漏检测

## 📚 相关资源

- MDN DOM 文档：https://developer.mozilla.org/zh-CN/docs/Web/API/Document_Object_Model
- Web 性能最佳实践：https://web.dev/fast/
- JavaScript 事件详解：https://javascript.info/events

## ⏱️ 预计学习时间

| 阶段 | 时间     | 内容                             |
| ---- | -------- | -------------------------------- |
| 入门 | 1-2 小时 | 浏览所有示例，理解基本概念       |
| 进阶 | 3-4 小时 | 深入阅读代码，理解实现细节       |
| 实践 | 4-6 小时 | 动手修改、扩展示例               |
| 精通 | 8+ 小时  | 独立实现类似功能，应用到实际项目 |

---

**创建时间：** 2026-04-24 07:00  
**训练主题：** DOM 操作专项训练  
**难度等级：** 中级 → 高级  
**前置知识：** HTML/CSS 基础、JavaScript 基础
