# 性能优化快速参考

**创建时间:** 2026-04-24 05:00  
**核心主题:** 懒加载 | 防抖节流 | 内存管理

---

## 📋 一句话原则

| 技术 | 何时使用 | 核心思想 |
|------|---------|---------|
| **懒加载** | 图片/组件/路由 | 需要时再加载 |
| **防抖** | 搜索/输入 | 等停止后再执行 |
| **节流** | 滚动/resize | 限制执行频率 |
| **内存管理** | 定时器/监听器 | 及时清理资源 |

---

## 🚀 代码片段速查

### 防抖 (Debounce)
```javascript
// 搜索框 300ms 防抖
const search = debounce((query) => fetch(query), 300);
input.addEventListener('input', e => search(e.target.value));
```

### 节流 (Throttle)
```javascript
// 滚动 100ms 节流
const onScroll = throttle(() => updateUI(), 100);
window.addEventListener('scroll', onScroll);
```

### 图片懒加载
```html
<!-- 原生方案 -->
<img src="placeholder.jpg" data-src="real.jpg" loading="lazy">

<!-- Intersection Observer -->
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.src = entry.target.dataset.src;
      observer.unobserve(entry.target);
    }
  });
});
```

### 清理资源
```javascript
// 组件卸载时清理
useEffect(() => {
  const timer = setInterval(update, 1000);
  return () => clearInterval(timer); // 清理定时器
}, []);
```

---

## ⚡ 性能指标目标

| 指标 | 目标值 | 含义 |
|------|--------|------|
| **LCP** | < 2.5s | 最大内容绘制 |
| **FID** | < 100ms | 首次输入延迟 |
| **CLS** | < 0.1 | 累积布局偏移 |
| **内存** | < 80% | JS 堆使用率 |

---

## 🐛 常见内存泄漏

```javascript
// ❌ 忘记清理定时器
setInterval(update, 1000);

// ✅ 正确做法
const timer = setInterval(update, 1000);
return () => clearInterval(timer);

// ❌ 忘记移除事件监听
element.addEventListener('click', handler);

// ✅ 正确做法
element.addEventListener('click', handler);
return () => element.removeEventListener('click', handler);

// ❌ 闭包引用大对象
function createHandler() {
  const bigData = new Array(1000000);
  return () => console.log('click');
}

// ✅ 正确做法
function createHandler() {
  return () => console.log('click');
}
```

---

## 📦 文件结构

```
training/
├── performance-optimization-2026-04-24.md  # 完整教程
├── examples/
│   ├── performance-utils.js    # 工具函数库
│   └── react-performance.jsx   # React 组件示例
└── QUICK_REFERENCE.md          # 本文件
```

---

## 🎯 实战检查清单

### 加载优化
- [ ] 图片使用 `loading="lazy"`
- [ ] 大组件使用 `React.lazy()`
- [ ] 路由级别代码分割
- [ ] 预加载关键资源

### 交互优化
- [ ] 搜索框添加防抖 (300ms)
- [ ] 滚动事件添加节流 (100ms)
- [ ] 按钮防止重复点击
- [ ] 表单验证延迟执行

### 内存优化
- [ ] `useEffect` 返回清理函数
- [ ] 移除未使用的监听器
- [ ] 避免闭包持有大对象
- [ ] 长列表使用虚拟滚动

---

## 🔧 工具推荐

- **Chrome DevTools** - Performance / Memory 面板
- **Lighthouse** - 自动性能审计
- **WebPageTest** - 多地点性能测试
- **bundle-analyzer** - 打包体积分析

---

**下次复习:** 2026-05-01  
**实践目标:** 在现有项目中应用至少 3 项优化技术
