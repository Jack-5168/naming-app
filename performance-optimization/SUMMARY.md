# 性能优化专项训练总结

**时间**: 2026-04-20 05:00  
**主题**: Web 性能优化技术  
**内容**: 懒加载 / 防抖节流 / 内存管理

---

## 📚 学习成果

### 1. 懒加载 (Lazy Loading)

#### 三种实现方式

| 方式 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| `loading="lazy"` | 原生支持，零 JS | 旧浏览器不支持，自定义有限 | 简单图片懒加载 |
| Intersection Observer | 性能好，API 简洁 | 需要 polyfill | 推荐方案，通用场景 |
| 滚动事件 + 节流 | 兼容性好 | 性能较差 | 需要兼容旧浏览器 |

#### 核心代码片段

```javascript
// Intersection Observer 懒加载
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      observer.unobserve(img);
    }
  });
}, { rootMargin: '50px 0px' });
```

#### 扩展应用
- 组件懒加载 (React.lazy / Vue defineAsyncComponent)
- 路由懒加载
- 虚拟列表 (Virtual Scrolling)
- 模块动态导入

---

### 2. 防抖与节流 (Debounce & Throttle)

#### 核心区别

| 技术 | 行为 | 典型场景 |
|------|------|----------|
| 防抖 | 等待事件停止后执行 | 搜索框、表单提交 |
| 节流 | 固定间隔执行一次 | 滚动、resize、鼠标移动 |

#### 防抖实现

```javascript
function debounce(fn, delay) {
  let timerId = null;
  return function(...args) {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => fn.apply(this, args), delay);
  };
}
```

#### 节流实现

```javascript
function throttle(fn, interval) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= interval) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}
```

#### 高级用法
- 带取消/立即执行的防抖
- 带头尾执行的节流
- RAF 节流 (requestAnimationFrame)

---

### 3. 内存管理 (Memory Management)

#### 常见泄漏场景

| 场景 | 原因 | 解决方案 |
|------|------|----------|
| 定时器 | 未清除 setInterval | 保存 ID，组件卸载时清除 |
| 事件监听 | 未移除监听器 | 成对添加/移除 |
| 闭包 | 引用大对象 | 只引用需要的数据 |
| DOM 节点 | 分离节点仍被引用 | 清理引用，使用 WeakMap |

#### 最佳实践工具

1. **ResourceManager** - 统一资源清理
2. **WeakMap/WeakSet** - 自动垃圾回收
3. **ObjectPool** - 对象池减少 GC
4. **MemoryMonitor** - 内存泄漏检测

#### 核心代码

```javascript
// 使用 WeakMap 避免内存泄漏
const dataStore = new WeakMap();
dataStore.set(domElement, { data: 'value' });
// DOM 移除后自动 GC
```

---

### 4. 性能监控 (Performance Monitoring)

#### Core Web Vitals

| 指标 | 含义 | 良好阈值 |
|------|------|----------|
| LCP | 最大内容绘制 | < 2.5s |
| FID | 首次输入延迟 | < 100ms |
| CLS | 累积布局偏移 | < 0.1 |
| INP | 交互到下次绘制 | < 200ms |

#### 监控维度

1. **页面加载** - DNS/TCP/TTFB/DOM 解析
2. **资源分析** - 大资源、慢资源识别
3. **运行时** - 长任务、帧率、内存
4. **性能预算** - 大小、数量、时间限制

---

## 🎯 实战建议

### 立即可以做的

1. ✅ 给所有图片添加 `loading="lazy"`
2. ✅ 搜索框输入添加防抖 (300ms)
3. ✅ resize/scroll 事件添加节流
4. ✅ 组件卸载时清理定时器和监听器

### 中期优化

1. 📦 实现路由和组件懒加载
2. 📊 接入 Core Web Vitals 监控
3. 🗑️ 使用 WeakMap 存储 DOM 关联数据
4. 📈 设置性能预算并监控

### 长期建设

1. 🔄 建立性能回归测试
2. 📱 移动端专项优化
3. 🌐 CDN 和边缘计算
4. 🔧 构建优化 (Tree Shaking, Code Splitting)

---

## 📁 文件结构

```
performance-optimization/
├── README.md                    # 总览文档
├── SUMMARY.md                   # 本文件
├── 01-lazy-loading/
│   ├── image-lazy-load.html     # 图片懒加载示例
│   └── component-lazy-load.js   # 组件懒加载
├── 02-debounce-throttle/
│   └── debounce-throttle.js     # 防抖节流实现
├── 03-memory-management/
│   └── memory-management.js     # 内存管理实践
└── 04-monitoring/
    └── performance-monitor.js   # 性能监控工具
```

---

## 🔗 参考资源

- [MDN Web Performance](https://developer.mozilla.org/en-US/docs/Web/Performance)
- [Web Vitals](https://web.dev/vitals/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)

---

_专项训练完成时间：2026-04-20 05:00_
