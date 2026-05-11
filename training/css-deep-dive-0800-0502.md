# CSS 深度专项训练 v3 — 高级进阶

**日期**: 2026-05-02 08:00
**版本**: v3 (高级进阶)
**前序**: 4/25 v1 (基础体系) → 4/28 v2 (完整体系) → 5/2 v3 (高级进阶)

---

## 一、Flexbox 高级 (8 个示例)

### 示例 1: 自适应导航栏 + 汉堡菜单

```html
<nav class="nav">
  <div class="nav-brand">Logo</div>
  <button class="nav-toggle" aria-label="菜单">☰</button>
  <ul class="nav-links">
    <li><a href="#">首页</a></li>
    <li><a href="#">产品</a></li>
    <li><a href="#">关于</a></li>
    <li><a href="#" class="nav-cta">登录</a></li>
  </ul>
</nav>

<style>
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 64px;
  background: #1a1a2e;
  position: relative;
}

.nav-brand {
  font-weight: 800;
  font-size: 1.4rem;
  color: #e94560;
  flex-shrink: 0;
}

.nav-toggle {
  display: none; /* 桌面端隐藏 */
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-links a {
  color: #eee;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  transition: background 0.2s, color 0.2s;
}

.nav-links a:hover {
  background: rgba(255,255,255,0.1);
}

.nav-cta {
  background: #e94560 !important;
  color: white !important;
  font-weight: 600;
}

@media (max-width: 768px) {
  .nav-toggle { display: block; }

  .nav-links {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 64px;
    left: 0;
    right: 0;
    background: #1a1a2e;
    padding: 1rem;
    gap: 0.25rem;
    /* 默认隐藏 */
    transform: translateY(-10px);
    opacity: 0;
    pointer-events: none;
    transition: transform 0.3s, opacity 0.3s;
  }

  .nav-links.open {
    transform: translateY(0);
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
```

### 示例 2: 圣杯布局 (Holy Grail)

```html
<div class="holy-grail">
  <header class="hg-header">Header</header>
  <main class="hg-main">Main Content</main>
  <aside class="hg-sidebar-left">Left Sidebar</aside>
  <aside class="hg-sidebar-right">Right Sidebar</aside>
  <footer class="hg-footer">Footer</footer>
</div>

<style>
.holy-grail {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.hg-header, .hg-footer {
  background: #2d3436;
  color: white;
  padding: 1rem;
  text-align: center;
  flex-shrink: 0;
}

.hg-body {
  display: flex;
  flex: 1; /* 撑满剩余空间 */
}

.hg-main {
  flex: 1; /* 主内容区占满剩余空间 */
  background: #dfe6e9;
  padding: 1.5rem;
  order: 2; /* 中间 */
}

.hg-sidebar-left {
  flex: 0 0 200px; /* 固定宽度 */
  background: #74b9ff;
  padding: 1rem;
  order: 1; /* 左侧 */
}

.hg-sidebar-right {
  flex: 0 0 250px;
  background: #a29bfe;
  padding: 1rem;
  order: 3; /* 右侧 */
}

@media (max-width: 768px) {
  .hg-body {
    flex-direction: column;
  }
  .hg-sidebar-left,
  .hg-sidebar-right {
    flex: 0 0 auto;
    order: initial;
  }
}
</style>
```

### 示例 3: 弹性卡片网格 (自适应列数)

```html
<div class="card-grid">
  <div class="card">卡片 1</div>
  <div class="card">卡片 2</div>
  <div class="card">卡片 3</div>
  <div class="card">卡片 4</div>
  <div class="card">卡片 5</div>
  <div class="card">卡片 6</div>
</div>

<style>
.card-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem;
}

.card {
  /* 最小 200px, 最大 1fr, 理想 200px */
  flex: 1 1 200px;
  max-width: 400px;
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}
</style>
```

### 示例 4: 媒体对象 (Media Object)

```html
<div class="media-object">
  <img class="media-img" src="avatar.png" alt="头像">
  <div class="media-body">
    <h3 class="media-title">文章标题</h3>
    <p class="media-desc">这是文章描述内容，会自动填满剩余空间...</p>
    <div class="media-meta">
      <span>2026-05-02</span>
      <span>👍 128</span>
    </div>
  </div>
</div>

<style>
.media-object {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}

.media-img {
  flex-shrink: 0; /* 图片不压缩 */
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
}

.media-body {
  flex: 1; /* 填满剩余空间 */
  min-width: 0; /* 允许文字截断 */
}

.media-title {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.media-desc {
  margin: 0 0 0.5rem;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: #999;
}
</style>
```

### 示例 5: 表单行布局 (固定+自适应+固定)

```html
<form class="form-row">
  <label class="form-label">搜索关键词</label>
  <input class="form-input" type="text" placeholder="输入...">
  <button class="form-btn" type="submit">搜索</button>
</form>

<style>
.form-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.form-label {
  flex-shrink: 0;
  white-space: nowrap;
  font-weight: 600;
}

.form-input {
  flex: 1; /* 自适应剩余空间 */
  min-width: 0;
  padding: 0.5rem 1rem;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #e94560;
}

.form-btn {
  flex-shrink: 0;
  padding: 0.5rem 1.5rem;
  background: #e94560;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}

.form-btn:hover {
  background: #c0392b;
}
</style>
```

### 示例 6: 垂直居中万能方案

```html
<div class="center-container">
  <div class="center-content">
    <h2>垂直居中</h2>
    <p>无论内容多少都居中</p>
  </div>
</div>

<style>
/* 方案 A: Flexbox 居中 */
.center-container {
  display: flex;
  justify-content: center; /* 水平居中 */
  align-items: center;     /* 垂直居中 */
  min-height: 300px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 12px;
}

/* 方案 B: Grid 居中 (更简洁) */
.center-grid {
  display: grid;
  place-items: center; /* 等价于 align-items + justify-items */
  min-height: 300px;
}

/* 方案 C: 绝对定位 + transform */
.center-absolute {
  position: relative;
  min-height: 300px;
}
.center-absolute .center-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 方案 D: margin: auto (Flexbox 子元素) */
.center-auto {
  display: flex;
  min-height: 300px;
}
.center-auto .center-content {
  margin: auto; /* 四方向自动边距 */
}
</style>
```

### 示例 7: 等分布局

```html
<div class="equal-columns">
  <div class="col">第 1 列</div>
  <div class="col">第 2 列</div>
  <div class="col">第 3 列</div>
  <div class="col">第 4 列</div>
</div>

<style>
.equal-columns {
  display: flex;
  gap: 0; /* 用 border 代替 gap */
}

.col {
  flex: 1; /* 等分 */
  padding: 1.5rem;
  text-align: center;
  border: 1px solid #ddd;
  background: white;
}

.col:not(:last-child) {
  border-right: none; /* 避免双边框 */
}
</style>
```

### 示例 8: 粘性 Footer

```html
<body class="sticky-footer">
  <main class="content">
    <h1>页面内容</h1>
    <p>内容不足时 Footer 也在底部</p>
  </main>
  <footer class="footer">© 2026</footer>
</body>

<style>
.sticky-footer {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.content {
  flex: 1; /* 撑满剩余空间，把 Footer 推到最下 */
  padding: 2rem;
}

.footer {
  flex-shrink: 0;
  padding: 1rem;
  background: #2d3436;
  color: white;
  text-align: center;
}
</style>
```

---

## 二、CSS Grid 高级 (8 个示例)

### 示例 9: Dashboard 布局 (grid-template-areas)

```html
<div class="dashboard">
  <header class="dash-header">📊 Dashboard</header>
  <nav class="dash-nav">导航菜单</nav>
  <main class="dash-main">
    <div class="stat-card">
      <h3>用户数</h3>
      <p class="stat-num">12,847</p>
      <span class="stat-change up">↑ 12%</span>
    </div>
    <div class="stat-card">
      <h3>收入</h3>
      <p class="stat-num">¥89,234</p>
      <span class="stat-change up">↑ 8%</span>
    </div>
    <div class="stat-card">
      <h3>订单</h3>
      <p class="stat-num">3,421</p>
      <span class="stat-change down">↓ 3%</span>
    </div>
    <div class="stat-card">
      <h3>转化率</h3>
      <p class="stat-num">4.7%</p>
      <span class="stat-change up">↑ 0.5%</span>
    </div>
  </main>
  <aside class="dash-activity">
    <h3>最近活动</h3>
    <ul>
      <li>新用户注册</li>
      <li>订单 #1234 完成</li>
      <li>支付成功 ¥299</li>
    </ul>
  </aside>
  <footer class="dash-footer">© 2026 Dashboard</footer>
</div>

<style>
.dashboard {
  display: grid;
  /* 定义区域名称 */
  grid-template-areas:
    "header header header"
    "nav    main   activity"
    "footer footer footer";
  /* 列宽: 220px 自适应 280px */
  grid-template-columns: 220px 1fr 280px;
  /* 行高: 64px 自适应 48px */
  grid-template-rows: 64px 1fr 48px;
  min-height: 100vh;
  gap: 1px;
  background: #eee;
}

.dash-header  { grid-area: header;  background: #1a1a2e; color: white; display: flex; align-items: center; padding: 0 1.5rem; font-weight: 700; font-size: 1.2rem; }
.dash-nav     { grid-area: nav;     background: #16213e; color: #a8b2d1; padding: 1rem; }
.dash-main    { grid-area: main;    background: #f8f9fa; padding: 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
.dash-activity{ grid-area: activity; background: white; padding: 1rem; }
.dash-footer  { grid-area: footer;  background: #2d3436; color: white; display: flex; align-items: center; justify-content: center; }

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.stat-num {
  font-size: 2rem;
  font-weight: 800;
  margin: 0.5rem 0;
  color: #1a1a2e;
}

.stat-change {
  font-size: 0.85rem;
  font-weight: 600;
}
.stat-change.up { color: #27ae60; }
.stat-change.down { color: #e74c3c; }
</style>
```

### 示例 10: 自动填充响应式网格

```html
<div class="responsive-grid">
  <div class="grid-item">1</div>
  <div class="grid-item">2</div>
  <div class="grid-item">3</div>
  <div class="grid-item">4</div>
  <div class="grid-item">5</div>
  <div class="grid-item">6</div>
  <div class="grid-item">7</div>
  <div class="grid-item">8</div>
</div>

<style>
.responsive-grid {
  display: grid;
  /* 自动填充，每列最小 250px，最大 1fr */
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.grid-item {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-radius: 12px;
  padding: 2rem;
  font-size: 1.5rem;
  font-weight: 800;
  text-align: center;
  transition: transform 0.2s;
}

.grid-item:hover {
  transform: scale(1.05);
}

/* 对比: auto-fill vs auto-fit */
/* auto-fill: 即使没有内容也创建轨道 (留空) */
/* auto-fit: 没有内容时轨道折叠为 0 (拉伸填充) */
</style>
```

### 示例 11: 跨行跨列复杂网格

```html
<div class="complex-grid">
  <div class="item hero">🎯 Hero (跨 2 列)</div>
  <div class="item sidebar">📋 侧栏</div>
  <div class="item card">📦 卡片 1</div>
  <div class="item card">📦 卡片 2</div>
  <div class="item wide">🌐 宽幅内容 (跨 3 列)</div>
  <div class="item tall">📏 高卡片 (跨 2 行)</div>
  <div class="item card">📦 卡片 3</div>
  <div class="item card">📦 卡片 4</div>
</div>

<style>
.complex-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto;
  gap: 1rem;
  padding: 1rem;
}

.item {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.hero   { grid-column: span 2; background: linear-gradient(135deg, #f093fb, #f5576c); color: white; }
.sidebar { grid-row: span 2; background: linear-gradient(135deg, #4facfe, #00f2fe); color: white; }
.wide   { grid-column: span 3; background: linear-gradient(135deg, #43e97b, #38f9d7); }
.tall   { grid-row: span 2; background: linear-gradient(135deg, #fa709a, #fee140); }
</style>
```

### 示例 12: 隐式网格 + auto-flow:dense

```html
<div class="dense-grid">
  <div class="item s">小</div>
  <div class="item l">大 (2×2)</div>
  <div class="item s">小</div>
  <div class="item s">小</div>
  <div class="item w">宽 (2×1)</div>
  <div class="item s">小</div>
  <div class="item s">小</div>
  <div class="item l">大 (2×2)</div>
  <div class="item s">小</div>
  <div class="item s">小</div>
</div>

<style>
.dense-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 80px;
  grid-auto-flow: dense; /* 填充空隙 */
  gap: 0.5rem;
  padding: 1rem;
}

.item {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.item.l { grid-column: span 2; grid-row: span 2; }
.item.w { grid-column: span 2; }
</style>
```

### 示例 13: 子网格 (Subgrid) 对齐

```html
<div class="subgrid-container">
  <div class="subgrid-card">
    <h3>卡片标题 A</h3>
    <p>这是描述文本，可能有多行...</p>
    <button>操作按钮</button>
  </div>
  <div class="subgrid-card">
    <h3>短标题</h3>
    <p>短描述。</p>
    <button>操作按钮</button>
  </div>
  <div class="subgrid-card">
    <h3>这是一个非常长的卡片标题用来测试对齐效果</h3>
    <p>描述文本也比较长，用来测试子网格在不同内容高度下的对齐行为。</p>
    <button>操作按钮</button>
  </div>
</div>

<style>
.subgrid-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  padding: 1rem;
}

.subgrid-card {
  display: grid;
  /* 子网格继承父网格的行轨道 */
  grid-template-rows: subgrid;
  grid-row: span 3; /* 占 3 行 */
  gap: 0.75rem;
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.subgrid-card h3 { margin: 0; }
.subgrid-card p  { margin: 0; color: #666; }
.subgrid-card button {
  align-self: end; /* 底部对齐 */
  padding: 0.5rem 1.5rem;
  background: #e94560;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
</style>
```

### 示例 14: 重叠网格 (层叠布局)

```html
<div class="overlap-grid">
  <div class="bg-pattern"></div>
  <div class="content-card">
    <h2>层叠卡片</h2>
    <p>背景图案在底层，内容在顶层</p>
  </div>
</div>

<style>
.overlap-grid {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 300px;
  position: relative;
  border-radius: 16px;
  overflow: hidden;
}

.bg-pattern {
  grid-column: 1;
  grid-row: 1;
  background:
    repeating-conic-gradient(#667eea 0% 25%, #764ba2 0% 50%) 0 0 / 40px 40px;
  opacity: 0.3;
}

.content-card {
  grid-column: 1;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(10px);
  padding: 2rem;
  text-align: center;
}
</style>
```

### 示例 15: 瀑布流布局 (CSS Columns)

```html
<div class="masonry">
  <div class="masonry-item" style="height: 200px; background: #f093fb;">高卡片 1</div>
  <div class="masonry-item" style="height: 120px; background: #4facfe;">矮卡片 2</div>
  <div class="masonry-item" style="height: 280px; background: #43e97b;">高卡片 3</div>
  <div class="masonry-item" style="height: 160px; background: #fa709a;">中卡片 4</div>
  <div class="masonry-item" style="height: 220px; background: #fee140;">高卡片 5</div>
  <div class="masonry-item" style="height: 100px; background: #a18cd1;">矮卡片 6</div>
  <div class="masonry-item" style="height: 300px; background: #fbc2eb;">最高卡片 7</div>
  <div class="masonry-item" style="height: 140px; background: #ff9a9e;">中卡片 8</div>
</div>

<style>
.masonry {
  columns: 3;
  column-gap: 1rem;
  padding: 1rem;
}

.masonry-item {
  break-inside: avoid; /* 防止被截断 */
  margin-bottom: 1rem;
  border-radius: 12px;
  color: white;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

@media (max-width: 768px) {
  .masonry { columns: 2; }
}
@media (max-width: 480px) {
  .masonry { columns: 1; }
}
</style>
```

### 示例 16: 命名网格线 + 精确控制

```html
<div class="precise-grid">
  <header>Header</header>
  <nav>Nav</nav>
  <main>Main</main>
  <aside>Aside</aside>
  <footer>Footer</footer>
</div>

<style>
.precise-grid {
  display: grid;
  /* 命名网格线 */
  grid-template-columns:
    [page-start] 1fr
    [content-start] min(720px, 80%) [content-end]
    1fr [page-end];
  grid-template-rows:
    [row1-start] 64px [row1-end]
    [row2-start] 1fr [row2-end]
    [row3-start] 48px [row3-end];
  min-height: 100vh;
}

header  { grid-column: page; grid-row: row1; background: #1a1a2e; color: white; display: flex; align-items: center; justify-content: center; }
nav     { grid-column: content; grid-row: row2; background: #f8f9fa; display: flex; align-items: center; justify-content: center; }
main    { grid-column: content; grid-row: row2; background: white; display: flex; align-items: center; justify-content: center; }
aside   { display: none; /* 隐藏，用 content 列居中 */ }
footer  { grid-column: page; grid-row: row3; background: #2d3436; color: white; display: flex; align-items: center; justify-content: center; }
</style>
```

---

## 三、CSS 动画高级 (8 个示例)

### 示例 17: 关键帧动画集合

```html
<div class="animation-showcase">
  <div class="anim-spin">🔄 Spin</div>
  <div class="anim-bounce">⬆️ Bounce</div>
  <div class="anim-pulse">💓 Pulse</div>
  <div class="anim-shake">📳 Shake</div>
  <div class="anim-float">🎈 Float</div>
  <div class="anim-rotate3d">🔮 3D Rotate</div>
</div>

<style>
.animation-showcase {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 2rem;
  justify-content: center;
}

.animation-showcase > div {
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-radius: 16px;
  font-weight: 700;
  font-size: 0.85rem;
  text-align: center;
}

/* 旋转 */
.anim-spin {
  animation: spin 2s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* 弹跳 */
.anim-bounce {
  animation: bounce 1s ease-in-out infinite;
}
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-20px); }
}

/* 脉冲 */
.anim-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.1); opacity: 0.8; }
}

/* 抖动 */
.anim-shake {
  animation: shake 0.5s ease-in-out infinite;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-5px); }
  75%      { transform: translateX(5px); }
}

/* 漂浮 */
.anim-float {
  animation: float 3s ease-in-out infinite;
}
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  33%      { transform: translateY(-10px) rotate(2deg); }
  66%      { transform: translateY(5px) rotate(-2deg); }
}

/* 3D 旋转 */
.anim-rotate3d {
  animation: rotate3d 3s linear infinite;
  transform-style: preserve-3d;
}
@keyframes rotate3d {
  from { transform: rotateY(0deg) rotateX(0deg); }
  to   { transform: rotateY(360deg) rotateX(360deg); }
}
</style>
```

### 示例 18: 复杂过渡效果

```html
<div class="transition-showcase">
  <div class="card-hover">
    <div class="card-img">🖼️</div>
    <div class="card-info">
      <h3>悬停卡片</h3>
      <p>hover 查看过渡效果</p>
    </div>
    <div class="card-overlay">查看详情 →</div>
  </div>
</div>

<style>
.card-hover {
  position: relative;
  width: 300px;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  /* 多属性过渡 */
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275),
              box-shadow 0.4s ease;
}

.card-hover:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
}

.card-img {
  height: 200px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
}

.card-info {
  padding: 1.5rem;
  background: white;
  transition: background 0.3s;
}

.card-hover:hover .card-info {
  background: #f8f9fa;
}

.card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.7);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 700;
  /* 默认隐藏 */
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 0.3s, transform 0.3s;
}

.card-hover:hover .card-overlay {
  opacity: 1;
  transform: scale(1);
}
</style>
```

### 示例 19: 加载动画集合

```html
<div class="loading-showcase">
  <!-- Spinner -->
  <div class="loader spinner"></div>
  <!-- Bouncing Dots -->
  <div class="loader bouncing-dots">
    <span></span><span></span><span></span>
  </div>
  <!-- Pulse Ring -->
  <div class="loader pulse-ring"></div>
  <!-- Progress Bar -->
  <div class="loader progress-bar">
    <div class="progress-fill"></div>
  </div>
  <!-- Skeleton -->
  <div class="loader skeleton">
    <div class="skeleton-line"></div>
    <div class="skeleton-line short"></div>
    <div class="skeleton-line"></div>
  </div>
  <!-- Typing -->
  <div class="loader typing">
    <span class="typing-cursor">|</span>
  </div>
</div>

<style>
.loading-showcase {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  padding: 2rem;
  justify-content: center;
  align-items: center;
}

/* Spinner */
.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #eee;
  border-top-color: #e94560;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Bouncing Dots */
.bouncing-dots {
  display: flex;
  gap: 0.5rem;
}
.bouncing-dots span {
  width: 12px;
  height: 12px;
  background: #e94560;
  border-radius: 50%;
  animation: dotBounce 1.4s ease-in-out infinite;
}
.bouncing-dots span:nth-child(2) { animation-delay: 0.2s; }
.bouncing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes dotBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40%           { transform: scale(1); opacity: 1; }
}

/* Pulse Ring */
.pulse-ring {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #e94560;
  animation: pulseRing 1.5s ease-out infinite;
}
@keyframes pulseRing {
  0%   { transform: scale(0.5); opacity: 1; }
  100% { transform: scale(2); opacity: 0; }
}

/* Progress Bar */
.progress-bar {
  width: 200px;
  height: 8px;
  background: #eee;
  border-radius: 4px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  width: 60%;
  background: linear-gradient(90deg, #e94560, #f093fb);
  border-radius: 4px;
  animation: progress 2s ease-in-out infinite;
}
@keyframes progress {
  0%   { width: 0%; margin-left: 0; }
  50%  { width: 60%; margin-left: 20%; }
  100% { width: 0%; margin-left: 100%; }
}

/* Skeleton */
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 200px;
}
.skeleton-line {
  height: 16px;
  background: linear-gradient(90deg, #eee 25%, #ddd 50%, #eee 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}
.skeleton-line.short { width: 60%; }

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Typing */
.typing {
  font-family: monospace;
  font-size: 1.2rem;
  overflow: hidden;
  white-space: nowrap;
  border-right: 2px solid #333;
  width: 0;
  animation: typing 2s steps(12) infinite, blink 0.5s step-end infinite alternate;
}
@keyframes typing {
  0%   { width: 0; }
  50%  { width: 7ch; }
  100% { width: 0; }
}
@keyframes blink {
  50% { border-color: transparent; }
}
</style>
```

### 示例 20: 文字动画

```html
<div class="text-animations">
  <h1 class="text-gradient">渐变文字</h1>
  <h1 class="text-neon">霓虹闪烁</h1>
  <h1 class="text-typewriter">打字机效果</h1>
  <h1 class="text-glitch">Glitch 故障</h1>
  <h1 class="text-wave">波浪文字</h1>
</div>

<style>
.text-animations {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem;
  align-items: center;
}

/* 渐变文字 */
.text-gradient {
  font-size: 2.5rem;
  font-weight: 900;
  background: linear-gradient(270deg, #667eea, #764ba2, #f093fb, #667eea);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradientShift 4s ease infinite;
}
@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}

/* 霓虹闪烁 */
.text-neon {
  font-size: 2.5rem;
  font-weight: 900;
  color: #fff;
  text-shadow:
    0 0 7px #fff,
    0 0 10px #fff,
    0 0 21px #fff,
    0 0 42px #e94560,
    0 0 82px #e94560,
    0 0 92px #e94560;
  animation: neonFlicker 2s infinite alternate;
}
@keyframes neonFlicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
    text-shadow:
      0 0 7px #fff, 0 0 10px #fff, 0 0 21px #fff,
      0 0 42px #e94560, 0 0 82px #e94560, 0 0 92px #e94560;
  }
  20%, 24%, 55% {
    text-shadow: none;
  }
}

/* 打字机 */
.text-typewriter {
  font-family: monospace;
  font-size: 1.5rem;
  overflow: hidden;
  white-space: nowrap;
  border-right: 3px solid #333;
  width: 0;
  animation: typewriter 3s steps(14) infinite;
}
@keyframes typewriter {
  0%   { width: 0; }
  50%  { width: 14ch; }
  100% { width: 0; }
}

/* Glitch */
.text-glitch {
  font-size: 2.5rem;
  font-weight: 900;
  position: relative;
  color: white;
}
.text-glitch::before,
.text-glitch::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.text-glitch::before {
  color: #ff00c8;
  animation: glitch1 2s infinite;
  clip-path: inset(0 0 60% 0);
}
.text-glitch::after {
  color: #00fff7;
  animation: glitch2 2s infinite;
  clip-path: inset(40% 0 0 0);
}
@keyframes glitch1 {
  0%, 100% { transform: translate(0); }
  20%      { transform: translate(-3px, 3px); }
  40%      { transform: translate(3px, -3px); }
  60%      { transform: translate(-2px, 1px); }
}
@keyframes glitch2 {
  0%, 100% { transform: translate(0); }
  20%      { transform: translate(3px, -3px); }
  40%      { transform: translate(-3px, 3px); }
  60%      { transform: translate(2px, -1px); }
}

/* 波浪文字 */
.text-wave span {
  display: inline-block;
  animation: wave 1.5s ease-in-out infinite;
}
.text-wave span:nth-child(1)  { animation-delay: 0s; }
.text-wave span:nth-child(2)  { animation-delay: 0.1s; }
.text-wave span:nth-child(3)  { animation-delay: 0.2s; }
.text-wave span:nth-child(4)  { animation-delay: 0.3s; }
.text-wave span:nth-child(5)  { animation-delay: 0.4s; }
.text-wave span:nth-child(6)  { animation-delay: 0.5s; }
.text-wave span:nth-child(7)  { animation-delay: 0.6s; }
.text-wave span:nth-child(8)  { animation-delay: 0.7s; }

@keyframes wave {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-15px); }
}
</style>
```

### 示例 21: 3D 变换

```html
<div class="transform3d-showcase">
  <!-- 翻转卡片 -->
  <div class="flip-card">
    <div class="flip-card-inner">
      <div class="flip-card-front">🎴 正面</div>
      <div class="flip-card-back">🎯 背面</div>
    </div>
  </div>

  <!-- 3D 立方体 -->
  <div class="cube-scene">
    <div class="cube">
      <div class="cube-face front">前</div>
      <div class="cube-face back">后</div>
      <div class="cube-face right">右</div>
      <div class="cube-face left">左</div>
      <div class="cube-face top">上</div>
      <div class="cube-face bottom">下</div>
    </div>
  </div>
</div>

<style>
.transform3d-showcase {
  display: flex;
  gap: 3rem;
  padding: 2rem;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

/* 翻转卡片 */
.flip-card {
  width: 200px;
  height: 260px;
  perspective: 1000px;
  cursor: pointer;
}

.flip-card-inner {
  width: 100%;
  height: 100%;
  position: relative;
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

.flip-card:hover .flip-card-inner {
  transform: rotateY(180deg);
}

.flip-card-front,
.flip-card-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden; /* 背面不可见 */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  border-radius: 16px;
}

.flip-card-front {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.flip-card-back {
  background: linear-gradient(135deg, #f093fb, #f5576c);
  color: white;
  transform: rotateY(180deg);
}

/* 3D 立方体 */
.cube-scene {
  width: 120px;
  height: 120px;
  perspective: 600px;
}

.cube {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  animation: cubeRotate 8s linear infinite;
}

@keyframes cubeRotate {
  from { transform: rotateX(0) rotateY(0); }
  to   { transform: rotateX(360deg) rotateY(360deg); }
}

.cube-face {
  position: absolute;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.2rem;
  color: white;
  border: 2px solid rgba(255,255,255,0.3);
}

.cube-face.front  { transform: rotateY(0deg)   translateZ(60px); background: rgba(102,126,234,0.8); }
.cube-face.back   { transform: rotateY(180deg) translateZ(60px); background: rgba(240,147,251,0.8); }
.cube-face.right  { transform: rotateY(90deg)  translateZ(60px); background: rgba(67,233,123,0.8); }
.cube-face.left   { transform: rotateY(-90deg) translateZ(60px); background: rgba(250,112,154,0.8); }
.cube-face.top    { transform: rotateX(90deg)  translateZ(60px); background: rgba(254,225,64,0.8); }
.cube-face.bottom { transform: rotateX(-90deg) translateZ(60px); background: rgba(79,172,254,0.8); }
</style>
```

### 示例 22: 交错入场动画 (Stagger)

```html
<div class="stagger-list">
  <div class="stagger-item">🚀 第 1 项</div>
  <div class="stagger-item">📦 第 2 项</div>
  <div class="stagger-item">🎯 第 3 项</div>
  <div class="stagger-item">💡 第 4 项</div>
  <div class="stagger-item">🔥 第 5 项</div>
</div>

<style>
.stagger-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 2rem;
}

.stagger-item {
  background: white;
  border-radius: 12px;
  padding: 1rem 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  font-weight: 600;
  /* 初始状态: 向下偏移 + 透明 */
  opacity: 0;
  transform: translateY(30px);
  /* 入场动画 */
  animation: staggerIn 0.5s ease forwards;
}

.stagger-item:nth-child(1) { animation-delay: 0.0s; }
.stagger-item:nth-child(2) { animation-delay: 0.1s; }
.stagger-item:nth-child(3) { animation-delay: 0.2s; }
.stagger-item:nth-child(4) { animation-delay: 0.3s; }
.stagger-item:nth-child(5) { animation-delay: 0.4s; }

@keyframes staggerIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
```

### 示例 23: CSS 变量驱动的动画

```html
<div class="variable-animation">
  <div class="orb" style="--hue: 200; --size: 80px;"></div>
  <div class="orb" style="--hue: 280; --size: 60px;"></div>
  <div class="orb" style="--hue: 340; --size: 100px;"></div>
  <div class="orb" style="--hue: 160; --size: 70px;"></div>
  <div class="orb" style="--hue: 40; --size: 90px;"></div>
</div>

<style>
.variable-animation {
  display: flex;
  gap: 1rem;
  padding: 2rem;
  justify-content: center;
  flex-wrap: wrap;
}

.orb {
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  background: hsl(var(--hue), 70%, 60%);
  animation: orbFloat 3s ease-in-out infinite;
  /* 每个 orb 的动画延迟基于 --hue */
  animation-delay: calc(var(--hue) * 0.01s);
  box-shadow: 0 0 20px hsl(var(--hue), 70%, 60%, 0.5);
}

@keyframes orbFloat {
  0%, 100% { transform: translateY(0) scale(1); }
  50%      { transform: translateY(-20px) scale(1.1); }
}
</style>
```

### 示例 24: 滚动触发动画 (Intersection Observer + CSS)

```html
<div class="scroll-animations">
  <div class="scroll-reveal" data-reveal="fade-up">
    <h2>淡入上移</h2>
    <p>滚动到此处时触发</p>
  </div>
  <div class="scroll-reveal" data-reveal="slide-left">
    <h2>从左侧滑入</h2>
    <p>带有弹性效果</p>
  </div>
  <div class="scroll-reveal" data-reveal="scale-in">
    <h2>缩放进入</h2>
    <p>从小变大出现</p>
  </div>
</div>

<style>
.scroll-reveal {
  opacity: 0;
  padding: 2rem;
  margin: 1rem 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

/* 初始状态 */
[data-reveal="fade-up"]    { transform: translateY(40px); }
[data-reveal="slide-left"]  { transform: translateX(-60px); }
[data-reveal="scale-in"]    { transform: scale(0.8); }

/* 可见状态 (JS 添加 .visible 类) */
.scroll-reveal.visible {
  opacity: 1;
  transform: translateY(0) translateX(0) scale(1);
  transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* JS 部分 (需配合使用) */
/*
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.2 });

document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
*/
</style>
```

---

## 四、响应式设计高级 (6 个示例)

### 示例 25: 现代断点系统

```css
/* 现代断点系统 (基于内容而非设备) */
:root {
  --breakpoint-xs: 320px;   /* 小手机 */
  --breakpoint-sm: 480px;   /* 手机 */
  --breakpoint-md: 768px;   /* 平板 */
  --breakpoint-lg: 1024px;  /* 笔记本 */
  --breakpoint-xl: 1280px;  /* 桌面 */
  --breakpoint-2xl: 1536px; /* 大屏 */
}

/* 使用方式 */
.container {
  width: 100%;
  margin: 0 auto;
  padding: 0 1rem;
}

@media (min-width: 480px)  { .container { max-width: 480px; } }
@media (min-width: 768px)  { .container { max-width: 720px; } }
@media (min-width: 1024px) { .container { max-width: 960px; } }
@media (min-width: 1280px) { .container { max-width: 1200px; } }
@media (min-width: 1536px) { .container { max-width: 1400px; } }
```

### 示例 26: clamp() 响应式字体

```css
/* 响应式字体 — 无需媒体查询 */
.responsive-text {
  /* 最小 1rem, 理想 4vw, 最大 2.5rem */
  font-size: clamp(1rem, 4vw, 2.5rem);
  line-height: 1.4;
}

/* 响应式间距 */
.responsive-spacing {
  padding: clamp(1rem, 3vw, 3rem);
  margin-bottom: clamp(1rem, 2vw, 2rem);
}

/* 响应式网格列 */
.responsive-auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(clamp(200px, 30vw, 300px), 1fr));
  gap: clamp(0.5rem, 2vw, 1.5rem);
}
```

### 示例 27: 容器查询 (@container)

```html
<div class="widget-container">
  <div class="widget-card">
    <img src="thumb.jpg" alt="">
    <div class="widget-info">
      <h3>组件级响应式</h3>
      <p>基于容器宽度而非视口</p>
    </div>
  </div>
</div>

<style>
.widget-container {
  container-type: inline-size;
  container-name: widget;
}

.widget-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: white;
  border-radius: 12px;
}

.widget-card img {
  width: 100%;
  height: 160px;
  object-fit: cover;
  border-radius: 8px;
}

/* 容器宽度 > 400px 时切换为横向 */
@container widget (min-width: 400px) {
  .widget-card {
    flex-direction: row;
    align-items: center;
  }
  .widget-card img {
    width: 120px;
    height: 120px;
    flex-shrink: 0;
  }
}
</style>
```

### 示例 28: 响应式侧边栏 (可折叠)

```html
<div class="responsive-layout">
  <button class="sidebar-toggle" onclick="document.body.classList.toggle('sidebar-collapsed')">
    ☰
  </button>
  <aside class="sidebar">
    <nav class="sidebar-nav">
      <a href="#" class="nav-item active">🏠 首页</a>
      <a href="#" class="nav-item">📊 数据</a>
      <a href="#" class="nav-item">⚙️ 设置</a>
    </nav>
  </aside>
  <main class="main-content">
    <h1>主内容区</h1>
    <p>侧边栏可折叠/展开</p>
  </main>
</div>

<style>
.responsive-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  background: #1a1a2e;
  color: white;
  transition: width 0.3s ease;
  flex-shrink: 0;
}

.sidebar-toggle {
  position: fixed;
  top: 1rem;
  left: 1rem;
  z-index: 100;
  background: #1a1a2e;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.5rem;
  cursor: pointer;
  font-size: 1.2rem;
}

.main-content {
  flex: 1;
  padding: 2rem;
  margin-left: 240px;
  transition: margin-left 0.3s ease;
}

/* 折叠状态 */
.sidebar-collapsed .sidebar {
  width: 0;
  overflow: hidden;
}
.sidebar-collapsed .main-content {
  margin-left: 0;
}

/* 移动端: 侧边栏覆盖 */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 50;
    width: 280px;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  .main-content {
    margin-left: 0;
  }
  .sidebar.open {
    transform: translateX(0);
  }
}
</style>
```

### 示例 29: 响应式图片系统

```html
<div class="responsive-images">
  <!-- srcset: 浏览器根据 DPR 选择 -->
  <img
    srcset="img-480w.jpg 480w, img-800w.jpg 800w, img-1200w.jpg 1200w"
    sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 33vw"
    src="img-800w.jpg"
    alt="响应式图片"
    loading="lazy"
    decoding="async"
  >

  <!-- picture: 艺术家方向控制 -->
  <picture>
    <source media="(max-width: 480px)" srcset="mobile.jpg">
    <source media="(max-width: 1024px)" srcset="tablet.jpg">
    <source srcset="desktop.jpg">
    <img src="desktop.jpg" alt="方向控制图片">
  </picture>

  <!-- object-fit 控制 -->
  <div class="image-container">
    <img src="photo.jpg" class="fit-cover" alt="cover">
    <img src="photo.jpg" class="fit-contain" alt="contain">
    <img src="photo.jpg" class="fit-fill" alt="fill">
  </div>
</div>

<style>
.image-container {
  display: flex;
  gap: 1rem;
}
.image-container > div {
  width: 200px;
  height: 200px;
  border: 2px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}
.image-container img {
  width: 100%;
  height: 100%;
}
.fit-cover  { object-fit: cover; }
.fit-contain { object-fit: contain; }
.fit-fill   { object-fit: fill; }
</style>
```

### 示例 30: 响应式表单

```html
<form class="responsive-form">
  <div class="form-group">
    <label>用户名</label>
    <input type="text" placeholder="输入用户名">
  </div>
  <div class="form-group">
    <label>邮箱</label>
    <input type="email" placeholder="输入邮箱">
  </div>
  <div class="form-group full-width">
    <label>简介</label>
    <textarea placeholder="介绍一下自己..."></textarea>
  </div>
  <div class="form-actions">
    <button type="button">取消</button>
    <button type="submit">提交</button>
  </div>
</form>

<style>
.responsive-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group.full-width {
  grid-column: 1 / -1; /* 跨所有列 */
}

.form-group label {
  font-weight: 600;
  font-size: 0.9rem;
}

.form-group input,
.form-group textarea {
  padding: 0.75rem 1rem;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #e94560;
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.form-actions button {
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.1s;
}

.form-actions button:active {
  transform: scale(0.95);
}

.form-actions button:first-child {
  background: #eee;
  border: none;
}

.form-actions button:last-child {
  background: #e94560;
  color: white;
  border: none;
}

@media (max-width: 600px) {
  .responsive-form {
    grid-template-columns: 1fr;
  }
  .form-actions {
    flex-direction: column;
  }
  .form-actions button {
    width: 100%;
  }
}
</style>
```

---

## 五、3 个复杂布局临摹

### 布局 1: 🐙 GitHub 代码仓库页面

```html
<div class="github-repo">
  <!-- 面包屑 -->
  <nav class="repo-breadcrumb">
    <a href="#">username</a> / <a href="#">repo-name</a>
  </nav>

  <!-- 仓库头部 -->
  <header class="repo-header">
    <h1>
      <span class="repo-type">📦</span>
      <span class="repo-name">repo-name</span>
      <span class="repo-badge">Public</span>
    </h1>
    <div class="repo-actions">
      <button class="btn">⭐ Star 2.3k</button>
      <button class="btn">🍴 Fork 456</button>
      <button class="btn">👁️ Watch</button>
    </div>
  </header>

  <!-- 标签导航 -->
  <nav class="repo-tabs">
    <a href="#" class="tab active">📁 Code</a>
    <a href="#" class="tab">🔧 Issues 23</a>
    <a href="#" class="tab">🔀 Pull requests 5</a>
    <a href="#" class="tab">⚙️ Actions</a>
    <a href="#" class="tab">📊 Projects</a>
    <a href="#" class="tab">🔒 Security</a>
    <a href="#" class="tab">📋 Settings</a>
  </nav>

  <!-- 文件列表 -->
  <div class="file-list">
    <div class="file-toolbar">
      <button class="branch-btn">🌿 main ▾</button>
      <input class="file-search" type="text" placeholder="Go to file">
      <button class="btn-primary">📥 Code ▾</button>
    </div>
    <table class="file-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Last commit</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="icon">📁</span> src</td>
          <td class="commit-msg">feat: add user auth</td>
        </tr>
        <tr>
          <td><span class="icon">📄</span> README.md</td>
          <td class="commit-msg">docs: update README</td>
        </tr>
        <tr>
          <td><span class="icon">📄</span> package.json</td>
          <td class="commit-msg">chore: bump version</td>
        </tr>
        <tr>
          <td><span class="icon">📄</span> .gitignore</td>
          <td class="commit-msg">init project</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 双栏: README + 侧边栏 -->
  <div class="repo-body">
    <div class="readme">
      <div class="readme-header">
        <h2>README.md</h2>
      </div>
      <div class="readme-content">
        <h1>Repo Name</h1>
        <p>这是一个示例仓库，展示 GitHub 风格的页面布局。</p>
        <h2>安装</h2>
        <pre><code>npm install repo-name</code></pre>
        <h2>使用</h2>
        <pre><code>import { something } from 'repo-name';</code></pre>
      </div>
    </div>
    <aside class="repo-sidebar">
      <div class="sidebar-section">
        <h3>Releases</h3>
        <p>v2.1.0 — Latest</p>
      </div>
      <div class="sidebar-section">
        <h3>Languages</h3>
        <div class="lang-bar">
          <span class="lang js" style="width: 65%">JavaScript 65%</span>
          <span class="lang css" style="width: 20%">CSS 20%</span>
          <span class="lang html" style="width: 15%">HTML 15%</span>
        </div>
      </div>
      <div class="sidebar-section">
        <h3>Topics</h3>
        <span class="topic">javascript</span>
        <span class="topic">web</span>
        <span class="topic">frontend</span>
      </div>
    </aside>
  </div>
</div>

<style>
.github-repo {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  max-width: 1280px;
  margin: 0 auto;
  padding: 1rem;
  color: #1f2328;
}

/* 面包屑 */
.repo-breadcrumb {
  padding: 0.75rem 0;
  font-size: 0.9rem;
}
.repo-breadcrumb a {
  color: #0969da;
  text-decoration: none;
}
.repo-breadcrumb a:hover { text-decoration: underline; }

/* 仓库头部 */
.repo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #d0d7de;
}
.repo-header h1 {
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.repo-name { color: #0969da; }
.repo-badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  border: 1px solid #d0d7de;
  border-radius: 2em;
  color: #656d76;
}
.repo-actions {
  display: flex;
  gap: 0.5rem;
}
.btn {
  padding: 0.4rem 0.8rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #f6f8fa;
  cursor: pointer;
  font-size: 0.85rem;
}
.btn:hover { background: #e1e4e8; }

/* 标签导航 */
.repo-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #d0d7de;
  margin: 0.5rem 0 1rem;
}
.tab {
  padding: 0.75rem 1rem;
  color: #656d76;
  text-decoration: none;
  font-size: 0.9rem;
  border-bottom: 2px solid transparent;
  transition: border-color 0.2s;
}
.tab:hover { color: #1f2328; }
.tab.active {
  color: #1f2328;
  border-bottom-color: #fd8c73;
  font-weight: 600;
}

/* 文件列表 */
.file-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
}
.branch-btn {
  padding: 0.4rem 0.8rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.85rem;
}
.file-search {
  flex: 1;
  padding: 0.4rem 0.75rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 0.85rem;
}
.file-search:focus { outline: none; border-color: #0969da; }
.btn-primary {
  padding: 0.4rem 0.8rem;
  border: 1px solid #1f883d;
  border-radius: 6px;
  background: #2da44e;
  color: white;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}

.file-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #d0d7de;
  border-top: none;
  border-radius: 0 0 6px 6px;
  overflow: hidden;
}
.file-table th {
  text-align: left;
  padding: 0.5rem 1rem;
  background: #f6f8fa;
  font-size: 0.8rem;
  color: #656d76;
  font-weight: 400;
  border-bottom: 1px solid #d0d7de;
}
.file-table td {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #d0d7de;
  font-size: 0.9rem;
}
.file-table tr:last-child td { border-bottom: none; }
.file-table tr:hover td { background: #f6f8fa; }
.icon { margin-right: 0.5rem; }
.commit-msg { color: #656d76; }

/* 双栏: README + 侧边栏 */
.repo-body {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.readme {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  overflow: hidden;
}
.readme-header {
  padding: 0.75rem 1rem;
  background: #f6f8fa;
  border-bottom: 1px solid #d0d7de;
  font-weight: 600;
}
.readme-content {
  padding: 1.5rem;
}
.readme-content h1, .readme-content h2 {
  border-bottom: 1px solid #d0d7de;
  padding-bottom: 0.5rem;
}
.readme-content pre {
  background: #f6f8fa;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
}

.repo-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.sidebar-section {
  padding: 1rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
}
.sidebar-section h3 {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
}

.lang-bar {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.lang {
  font-size: 0.8rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}
.lang.js   { background: #f1e05a33; }
.lang.css  { background: #563d7c33; }
.lang.html { background: #e44b2333; }

.topic {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  background: #ddf4ff;
  color: #0969da;
  border-radius: 2em;
  font-size: 0.8rem;
  margin: 0.15rem;
}

@media (max-width: 768px) {
  .repo-body {
    grid-template-columns: 1fr;
  }
  .repo-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .repo-tabs {
    overflow-x: auto;
  }
}
</style>
```

### 布局 2: 🛒 电商产品详情页

```html
<div class="product-page">
  <div class="product-container">
    <!-- 左: 图片画廊 -->
    <div class="product-gallery">
      <div class="gallery-main">
        <img id="mainImage" src="product-main.jpg" alt="产品主图">
        <div class="gallery-badge">-30%</div>
      </div>
      <div class="gallery-thumbs">
        <img src="thumb1.jpg" class="thumb active" onclick="switchImg(this)">
        <img src="thumb2.jpg" class="thumb" onclick="switchImg(this)">
        <img src="thumb3.jpg" class="thumb" onclick="switchImg(this)">
        <img src="thumb4.jpg" class="thumb" onclick="switchImg(this)">
      </div>
    </div>

    <!-- 右: 产品信息 -->
    <div class="product-info">
      <nav class="product-breadcrumb">
        <a href="#">首页</a> / <a href="#">电子产品</a> / <span>无线耳机 Pro</span>
      </nav>

      <h1 class="product-title">无线耳机 Pro — 主动降噪 · 30h 续航</h1>

      <div class="product-rating">
        <span class="stars">⭐⭐⭐⭐⭐</span>
        <span class="rating-num">4.8</span>
        <span class="rating-count">(2,847 评价)</span>
      </div>

      <div class="product-price">
        <span class="price-current">¥299</span>
        <span class="price-original">¥429</span>
        <span class="price-discount">省 ¥130</span>
      </div>

      <div class="product-specs">
        <div class="spec-group">
          <label>颜色</label>
          <div class="spec-options">
            <button class="spec-btn active">⚫ 黑色</button>
            <button class="spec-btn">⚪ 白色</button>
            <button class="spec-btn">🔵 蓝色</button>
          </div>
        </div>
        <div class="spec-group">
          <label>数量</label>
          <div class="quantity-selector">
            <button class="qty-btn" onclick="changeQty(-1)">−</button>
            <input class="qty-input" type="number" value="1" min="1" max="10">
            <button class="qty-btn" onclick="changeQty(1)">+</button>
          </div>
        </div>
      </div>

      <div class="product-actions">
        <button class="btn-buy">🛒 加入购物车</button>
        <button class="btn-now">⚡ 立即购买</button>
        <button class="btn-fav">♡ 收藏</button>
      </div>

      <div class="product-features">
        <div class="feature">🚚 包邮</div>
        <div class="feature">🔄 7天退换</div>
        <div class="feature">🛡️ 正品保证</div>
        <div class="feature">⚡ 次日达</div>
      </div>
    </div>
  </div>

  <!-- 底部: 评价区域 -->
  <div class="reviews-section">
    <h2>用户评价 (2,847)</h2>
    <div class="review-summary">
      <div class="review-score">
        <span class="score-num">4.8</span>
        <span class="score-stars">⭐⭐⭐⭐⭐</span>
      </div>
      <div class="review-bars">
        <div class="bar-row"><span>5星</span><div class="bar"><div class="bar-fill" style="width: 85%"></div></div><span>85%</span></div>
        <div class="bar-row"><span>4星</span><div class="bar"><div class="bar-fill" style="width: 10%"></div></div><span>10%</span></div>
        <div class="bar-row"><span>3星</span><div class="bar"><div class="bar-fill" style="width: 3%"></div></div><span>3%</span></div>
        <div class="bar-row"><span>2星</span><div class="bar"><div class="bar-fill" style="width: 1%"></div></div><span>1%</span></div>
        <div class="bar-row"><span>1星</span><div class="bar"><div class="bar-fill" style="width: 1%"></div></div><span>1%</span></div>
      </div>
    </div>

    <div class="review-list">
      <div class="review-card">
        <div class="review-header">
          <img class="review-avatar" src="avatar1.jpg" alt="">
          <div>
            <div class="review-name">张三</div>
            <div class="review-date">2026-04-28</div>
          </div>
          <span class="review-stars">⭐⭐⭐⭐⭐</span>
        </div>
        <p class="review-text">音质非常好，降噪效果也很棒！佩戴舒适，续航时间长，强烈推荐！</p>
      </div>
      <div class="review-card">
        <div class="review-header">
          <img class="review-avatar" src="avatar2.jpg" alt="">
          <div>
            <div class="review-name">李四</div>
            <div class="review-date">2026-04-25</div>
          </div>
          <span class="review-stars">⭐⭐⭐⭐</span>
        </div>
        <p class="review-text">性价比很高，蓝牙连接稳定。唯一不足是充电口不是 Type-C。</p>
      </div>
    </div>
  </div>
</div>

<style>
.product-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.product-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

/* 图片画廊 */
.product-gallery {
  position: sticky;
  top: 1rem;
}
.gallery-main {
  position: relative;
  aspect-ratio: 1;
  background: #f8f9fa;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gallery-main img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.gallery-badge {
  position: absolute;
  top: 1rem;
  left: 1rem;
  background: #e74c3c;
  color: white;
  padding: 0.3rem 0.8rem;
  border-radius: 2em;
  font-weight: 700;
  font-size: 0.9rem;
}
.gallery-thumbs {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}
.thumb {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  object-fit: cover;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}
.thumb.active, .thumb:hover {
  border-color: #e94560;
}

/* 产品信息 */
.product-info {
  padding: 1rem 0;
}
.product-breadcrumb {
  font-size: 0.85rem;
  color: #999;
  margin-bottom: 1rem;
}
.product-breadcrumb a { color: #666; text-decoration: none; }
.product-title {
  font-size: 1.8rem;
  font-weight: 800;
  margin: 0 0 1rem;
  line-height: 1.3;
}
.product-rating {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.rating-num { font-weight: 700; font-size: 1.1rem; }
.rating-count { color: #999; font-size: 0.9rem; }

.product-price {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 1rem;
  background: #fff5f5;
  border-radius: 12px;
  margin-bottom: 1.5rem;
}
.price-current {
  font-size: 2.5rem;
  font-weight: 900;
  color: #e74c3c;
}
.price-original {
  font-size: 1.2rem;
  color: #999;
  text-decoration: line-through;
}
.price-discount {
  background: #e74c3c;
  color: white;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.product-specs {
  margin-bottom: 1.5rem;
}
.spec-group {
  margin-bottom: 1rem;
}
.spec-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
.spec-options {
  display: flex;
  gap: 0.5rem;
}
.spec-btn {
  padding: 0.5rem 1.2rem;
  border: 2px solid #ddd;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}
.spec-btn.active {
  border-color: #e94560;
  background: #fff5f5;
}
.spec-btn:hover { border-color: #e94560; }

.quantity-selector {
  display: inline-flex;
  align-items: center;
  border: 2px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}
.qty-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: #f8f9fa;
  cursor: pointer;
  font-size: 1.2rem;
}
.qty-input {
  width: 50px;
  height: 40px;
  border: none;
  text-align: center;
  font-size: 1rem;
  font-weight: 600;
}

.product-actions {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}
.btn-buy {
  flex: 1;
  padding: 1rem;
  background: #e94560;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-buy:hover { background: #c0392b; }
.btn-now {
  flex: 1;
  padding: 1rem;
  background: #ff6b35;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
}
.btn-fav {
  width: 50px;
  height: 50px;
  border: 2px solid #ddd;
  border-radius: 12px;
  background: white;
  font-size: 1.2rem;
  cursor: pointer;
}

.product-features {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}
.feature {
  text-align: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 0.85rem;
}

/* 评价区域 */
.reviews-section {
  border-top: 1px solid #eee;
  padding-top: 2rem;
}
.reviews-section h2 {
  margin-bottom: 1.5rem;
}
.review-summary {
  display: flex;
  gap: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 12px;
  margin-bottom: 1.5rem;
}
.review-score {
  text-align: center;
  min-width: 100px;
}
.score-num {
  font-size: 3rem;
  font-weight: 900;
  color: #f39c12;
}
.score-stars { font-size: 1.2rem; }
.review-bars { flex: 1; }
.bar-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
  font-size: 0.85rem;
}
.bar {
  flex: 1;
  height: 8px;
  background: #eee;
  border-radius: 4px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: #f39c12;
  border-radius: 4px;
}

.review-card {
  padding: 1.5rem;
  border: 1px solid #eee;
  border-radius: 12px;
  margin-bottom: 1rem;
}
.review-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.review-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}
.review-name { font-weight: 600; }
.review-date { font-size: 0.8rem; color: #999; }
.review-stars { margin-left: auto; }
.review-text { color: #333; line-height: 1.6; }

@media (max-width: 768px) {
  .product-container {
    grid-template-columns: 1fr;
  }
  .product-gallery { position: static; }
  .product-title { font-size: 1.4rem; }
  .price-current { font-size: 2rem; }
  .product-actions { flex-direction: column; }
  .product-features { grid-template-columns: repeat(2, 1fr); }
  .review-summary { flex-direction: column; }
}
</style>
```

### 布局 3: 📱 社交媒体信息流

```html
<div class="social-feed">
  <!-- 左侧导航 -->
  <aside class="feed-nav">
    <div class="nav-logo">🐦 SocialApp</div>
    <nav class="nav-menu">
      <a href="#" class="nav-link active">🏠 首页</a>
      <a href="#" class="nav-link">🔍 探索</a>
      <a href="#" class="nav-link">🔔 通知</a>
      <a href="#" class="nav-link">✉️ 消息</a>
      <a href="#" class="nav-link">🔖 收藏</a>
      <a href="#" class="nav-link">👤 个人主页</a>
      <a href="#" class="nav-link">⚙️ 设置</a>
    </nav>
    <button class="post-btn">发布</button>
  </aside>

  <!-- 中间: 信息流 -->
  <main class="feed-main">
    <header class="feed-header">
      <h2>首页</h2>
      <div class="feed-tabs">
        <button class="feed-tab active">推荐</button>
        <button class="feed-tab">关注</button>
      </div>
    </header>

    <!-- 发帖框 -->
    <div class="compose-box">
      <img class="compose-avatar" src="my-avatar.jpg" alt="">
      <textarea class="compose-input" placeholder="有什么新鲜事？"></textarea>
      <div class="compose-actions">
        <div class="compose-tools">
          <button>📷 图片</button>
          <button>🎥 视频</button>
          <button>📊 投票</button>
          <button>😀 表情</button>
        </div>
        <button class="compose-submit">发布</button>
      </div>
    </div>

    <!-- 动态卡片 -->
    <div class="feed-list">
      <article class="post-card">
        <div class="post-header">
          <img class="post-avatar" src="user1.jpg" alt="">
          <div class="post-user">
            <span class="post-name">张三 <span class="verified">✓</span></span>
            <span class="post-time">2小时前</span>
          </div>
          <button class="post-more">⋯</button>
        </div>
        <p class="post-content">今天天气真好！出去跑了一圈 🏃‍♂️ 分享一组晨跑路线截图 📸</p>
        <div class="post-images">
          <img src="photo1.jpg" alt="">
          <img src="photo2.jpg" alt="">
          <img src="photo3.jpg" alt="">
        </div>
        <div class="post-stats">
          <span class="stat">💬 23</span>
          <span class="stat">🔄 156</span>
          <span class="stat">❤️ 1.2k</span>
          <span class="stat">📤 42</span>
        </div>
      </article>

      <article class="post-card">
        <div class="post-header">
          <img class="post-avatar" src="user2.jpg" alt="">
          <div class="post-user">
            <span class="post-name">李四</span>
            <span class="post-time">5小时前</span>
          </div>
          <button class="post-more">⋯</button>
        </div>
        <p class="post-content">刚完成了一个 CSS Grid 布局挑战！分享一下心得：grid-template-areas 真的是神器 🎨</p>
        <div class="post-tags">
          <span class="tag">#CSS</span>
          <span class="tag">#前端开发</span>
          <span class="tag">#WebDesign</span>
        </div>
        <div class="post-stats">
          <span class="stat">💬 89</span>
          <span class="stat">🔄 342</span>
          <span class="stat">❤️ 2.8k</span>
          <span class="stat">📤 128</span>
        </div>
      </article>

      <article class="post-card">
        <div class="post-header">
          <img class="post-avatar" src="user3.jpg" alt="">
          <div class="post-user">
            <span class="post-name">王五 <span class="verified">✓</span></span>
            <span class="post-time">昨天</span>
          </div>
          <button class="post-more">⋯</button>
        </div>
        <p class="post-content">分享一个实用的 Flexbox 技巧：用 flex: 1 1 auto 实现等分布局，比 Grid 更灵活 ✨</p>
        <div class="post-quote">
          <blockquote>
            <p>"Flexbox 适合一维布局，Grid 适合二维布局。两者结合使用效果最佳。"</p>
          </blockquote>
        </div>
        <div class="post-stats">
          <span class="stat">💬 45</span>
          <span class="stat">🔄 234</span>
          <span class="stat">❤️ 1.5k</span>
          <span class="stat">📤 67</span>
        </div>
      </article>
    </div>
  </main>

  <!-- 右侧: 趋势 -->
  <aside class="feed-sidebar">
    <div class="search-box">
      <input type="text" placeholder="🔍 搜索...">
    </div>

    <div class="trending">
      <h3>🔥 趋势话题</h3>
      <div class="trending-item">
        <span class="trending-category">科技</span>
        <span class="trending-topic">#CSSGrid</span>
        <span class="trending-posts">12.5k 帖子</span>
      </div>
      <div class="trending-item">
        <span class="trending-category">设计</span>
        <span class="trending-topic">#Flexbox</span>
        <span class="trending-posts">8.3k 帖子</span>
      </div>
      <div class="trending-item">
        <span class="trending-category">开发</span>
        <span class="trending-topic">#前端进阶</span>
        <span class="trending-posts">5.7k 帖子</span>
      </div>
      <div class="trending-item">
        <span class="trending-category">热门</span>
        <span class="trending-topic">#Web开发</span>
        <span class="trending-posts">3.2k 帖子</span>
      </div>
    </div>

    <div class="who-to-follow">
      <h3>👥 推荐关注</h3>
      <div class="follow-item">
        <img src="follow1.jpg" alt="">
        <div>
          <div class="follow-name">前端大师</div>
          <div class="follow-handle">@frontend</div>
        </div>
        <button class="follow-btn">关注</button>
      </div>
      <div class="follow-item">
        <img src="follow2.jpg" alt="">
        <div>
          <div class="follow-name">CSS 达人</div>
          <div class="follow-handle">@cssmaster</div>
        </div>
        <button class="follow-btn">关注</button>
      </div>
    </div>
  </aside>
</div>

<style>
.social-feed {
  display: grid;
  grid-template-columns: 260px 1fr 320px;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* 左侧导航 */
.feed-nav {
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 1.5rem;
  border-right: 1px solid #e1e8ed;
  display: flex;
  flex-direction: column;
}
.nav-logo {
  font-size: 1.5rem;
  font-weight: 800;
  margin-bottom: 2rem;
}
.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}
.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  color: #1f2328;
  text-decoration: none;
  font-size: 1.1rem;
  transition: background 0.2s;
}
.nav-link:hover { background: #f0f2f5; }
.nav-link.active { font-weight: 700; }
.post-btn {
  width: 100%;
  padding: 1rem;
  background: #1da1f2;
  color: white;
  border: none;
  border-radius: 50px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
}
.post-btn:hover { background: #0d8bd9; }

/* 中间信息流 */
.feed-main {
  border-right: 1px solid #e1e8ed;
}
.feed-header {
  position: sticky;
  top: 0;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(10px);
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e1e8ed;
  z-index: 10;
}
.feed-header h2 { margin: 0 0 0.5rem; }
.feed-tabs {
  display: flex;
  gap: 0;
}
.feed-tab {
  flex: 1;
  padding: 0.75rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.95rem;
  color: #657786;
  position: relative;
}
.feed-tab.active {
  font-weight: 700;
  color: #1f2328;
}
.feed-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 25%;
  right: 25%;
  height: 3px;
  background: #1da1f2;
  border-radius: 2px;
}

/* 发帖框 */
.compose-box {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e1e8ed;
}
.compose-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.compose-input {
  flex: 1;
  border: none;
  resize: none;
  font-size: 1.1rem;
  padding: 0.5rem 0;
  min-height: 60px;
  font-family: inherit;
}
.compose-input:focus { outline: none; }
.compose-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.75rem;
  border-top: 1px solid #e1e8ed;
  margin-top: 0.75rem;
}
.compose-tools {
  display: flex;
  gap: 0.5rem;
}
.compose-tools button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.3rem;
}
.compose-submit {
  padding: 0.5rem 1.5rem;
  background: #1da1f2;
  color: white;
  border: none;
  border-radius: 50px;
  font-weight: 700;
  cursor: pointer;
}

/* 动态卡片 */
.post-card {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e1e8ed;
}
.post-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.post-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}
.post-user { flex: 1; }
.post-name {
  font-weight: 700;
  display: block;
}
.verified {
  color: #1da1f2;
  font-size: 0.9rem;
}
.post-time {
  color: #657786;
  font-size: 0.85rem;
}
.post-more {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #657786;
}
.post-content {
  margin: 0 0 0.75rem;
  line-height: 1.5;
  font-size: 1rem;
}
.post-images {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  border-radius: 12px;
  overflow: hidden;
}
.post-images img {
  width: 100%;
  height: 150px;
  object-fit: cover;
}
.post-tags {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.tag {
  color: #1da1f2;
  font-size: 0.9rem;
}
.post-quote {
  border-left: 3px solid #1da1f2;
  padding-left: 1rem;
  margin-bottom: 0.75rem;
  color: #657786;
}
.post-quote blockquote {
  margin: 0;
  font-style: italic;
}
.post-stats {
  display: flex;
  gap: 1.5rem;
}
.stat {
  color: #657786;
  font-size: 0.9rem;
  cursor: pointer;
}
.stat:hover { color: #1da1f2; }

/* 右侧边栏 */
.feed-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 1rem 1.5rem;
  overflow-y: auto;
}
.search-box input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #e1e8ed;
  border-radius: 50px;
  font-size: 0.95rem;
  background: #f0f2f5;
}
.search-box input:focus {
  outline: none;
  border-color: #1da1f2;
  background: white;
}

.trending, .who-to-follow {
  margin-top: 1.5rem;
  background: #f0f2f5;
  border-radius: 16px;
  padding: 1rem;
}
.trending h3, .who-to-follow h3 {
  margin: 0 0 1rem;
  font-size: 1.2rem;
}
.trending-item {
  padding: 0.75rem 0;
  border-bottom: 1px solid #e1e8ed;
  cursor: pointer;
}
.trending-item:last-child { border-bottom: none; }
.trending-category {
  font-size: 0.8rem;
  color: #657786;
}
.trending-topic {
  display: block;
  font-weight: 700;
  margin: 0.2rem 0;
}
.trending-posts {
  font-size: 0.8rem;
  color: #657786;
}

.follow-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
}
.follow-item img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}
.follow-name { font-weight: 600; font-size: 0.9rem; }
.follow-handle { color: #657786; font-size: 0.8rem; }
.follow-btn {
  margin-left: auto;
  padding: 0.4rem 1rem;
  background: #1f2328;
  color: white;
  border: none;
  border-radius: 50px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 1024px) {
  .social-feed {
    grid-template-columns: 1fr;
  }
  .feed-nav, .feed-sidebar {
    display: none;
  }
}
</style>
```

---

## 六、核心知识点速查

### Flexbox vs Grid 选择指南

| 场景 | 推荐 | 原因 |
|------|------|------|
| 一维排列 (行或列) | Flexbox | 天然适合 |
| 二维布局 (行+列) | Grid | 声明式区域 |
| 内容优先 (内容决定布局) | Flexbox | 自适应强 |
| 布局优先 (布局决定内容) | Grid | 精确控制 |
| 导航栏/工具栏 | Flexbox | 简单高效 |
| Dashboard/页面骨架 | Grid | 区域清晰 |
| 卡片网格 | Flexbox 或 Grid | 都适合 |
| 等分布局 | Flexbox (flex:1) | 最简洁 |
| 跨行跨列 | Grid (span) | 原生支持 |

### CSS 动画性能优化

| 属性 | 性能 | 说明 |
|------|------|------|
| `transform` | ⚡ 最优 | GPU 加速，不触发重排 |
| `opacity` | ⚡ 最优 | GPU 加速，不触发重排 |
| `filter` | ⚡ 优 | GPU 加速 |
| `background-color` | ✅ 良 | 只触发重绘 |
| `color` | ✅ 良 | 只触发重绘 |
| `width/height` | ⚠️ 差 | 触发重排+重绘 |
| `margin/padding` | ⚠️ 差 | 触发重排+重绘 |
| `top/left` | ⚠️ 差 | 触发重排+重绘 |

### 响应式核心 API

| API | 用途 | 示例 |
|-----|------|------|
| `@media` | 视口断点 | `@media (max-width: 768px)` |
| `clamp()` | 响应式值 | `clamp(1rem, 4vw, 2.5rem)` |
| `@container` | 容器断点 | `@container (min-width: 400px)` |
| `minmax()` | 范围约束 | `minmax(250px, 1fr)` |
| `auto-fill` | 自动填充 | `repeat(auto-fill, minmax(250px, 1fr))` |
| `aspect-ratio` | 固定比例 | `aspect-ratio: 16/9` |
| `object-fit` | 图片适配 | `object-fit: cover` |
| `vw/vh` | 视口单位 | `width: 100vw` |
| `dvh/svh` | 动态视口 | `height: 100dvh` (移动端) |

### CSS 变量实战模式

```css
/* 主题系统 */
:root {
  --color-primary: #e94560;
  --color-bg: #ffffff;
  --color-text: #1f2328;
  --radius: 12px;
  --shadow: 0 2px 8px rgba(0,0,0,0.1);
  --transition: 0.3s ease;
}

[data-theme="dark"] {
  --color-primary: #ff6b81;
  --color-bg: #1a1a2e;
  --color-text: #eee;
  --shadow: 0 2px 8px rgba(0,0,0,0.3);
}

/* 使用 */
.card {
  background: var(--color-bg);
  color: var(--color-text);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  transition: all var(--transition);
}
```

---

## 七、面试自测题 (15 道)

1. Flexbox 中 `flex: 1` 的完整展开是什么？(flex-grow: 1, flex-shrink: 1, flex-basis: 0%)
2. `justify-content` 和 `align-items` 的区别？(主轴 vs 交叉轴)
3. Grid 的 `auto-fill` 和 `auto-fit` 有什么不同？(空轨道 vs 折叠)
4. `grid-template-areas` 中如何表示空单元格？(`.`)
5. `backface-visibility: hidden` 的作用？(隐藏元素背面)
6. `transform-style: preserve-3d` 和默认值 `flat` 的区别？
7. CSS 动画中 `steps(10)` 的作用？(分 10 帧，适合精灵图动画)
8. `@container` 查询和 `@media` 查询的核心区别？(容器 vs 视口)
9. `clamp(1rem, 4vw, 2.5rem)` 在不同视口下的行为？
10. 为什么 `transform` 和 `opacity` 动画性能最好？(GPU 合成层)
11. `grid-auto-flow: dense` 的作用？(填充空隙)
12. Flexbox 中如何防止子元素被压缩？(`flex-shrink: 0`)
13. `object-fit: cover` 和 `contain` 的区别？
14. CSS 中如何实现粘性 Footer？(flex: 1 + min-height: 100vh)
15. `subgrid` 解决了什么问题？(子元素对齐父网格轨道)

---

## 八、本次训练总结

### 覆盖范围

| 主题 | 示例数 | 新增内容 |
|------|--------|----------|
| Flexbox 高级 | 8 | 汉堡菜单、圣杯布局、媒体对象、粘性 Footer、万能居中 |
| CSS Grid 高级 | 8 | Dashboard、auto-fill、跨行跨列、子网格、重叠网格、命名网格线 |
| CSS 动画 | 8 | 关键帧集合、复杂过渡、加载动画、文字动画、3D 变换、交错入场、CSS 变量驱动、滚动触发 |
| 响应式设计 | 6 | 断点系统、clamp()、容器查询、侧边栏折叠、图片系统、响应式表单 |
| 复杂布局临摹 | 3 | GitHub 仓库页、电商产品详情、社交媒体信息流 |

### 与 v2 (4/28) 的差异

| 维度 | v2 | v3 |
|------|----|----|
| 示例总数 | 25 | 30 |
| 复杂布局 | 3 个 | 3 个 (更完整) |
| 新增主题 | — | 子网格、容器查询、滚动触发、Glitch 文字、3D 立方体 |
| 临摹完整度 | 基础结构 | 完整可运行 (含交互) |
| 面试自测 | 10 题 | 15 题 |
| 速查表 | 基础 | 全面 (含性能/变量/API) |

### CSS 训练累计

- 4/25 v1 (基础体系) ✅
- 4/28 v2 (完整体系) ✅
- 5/2 v3 (高级进阶) ✅ — 30 示例 + 3 复杂布局 + 15 面试自测

**CSS 深度训练**: 3 轮迭代，全部闭环 ✅

---

*最后更新: 2026-05-02 08:00 (Asia/Shanghai)*
*文件: training/css-deep-dive-0800-0502.md*
