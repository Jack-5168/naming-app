# CSS 深度专项训练 — Flexbox / Grid / 动画 / 响应式

**日期:** 2026-04-25 08:00  
**专项:** CSS 深度 (Flexbox/Grid/动画/响应式)  
**目标:** 临摹 3 个复杂布局，写 20+ CSS 示例  
**代码量:** ~800 行

---

## 一、Flexbox 深度 — 10 个示例

### 示例 1: Flexbox 圣杯布局 (Holy Grail)

```css
/* 经典三栏布局：header + footer 全宽，中间 left-center-right */
.holy-grail {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.holy-grail__header,
.holy-grail__footer {
  flex: 0 0 auto;
  background: #1a1a2e;
  color: #fff;
  padding: 1rem;
}

.holy-grail__body {
  display: flex;
  flex: 1 1 auto; /* 填满剩余空间 */
}

.holy-grail__nav {
  flex: 0 0 200px; /* 固定宽度，不伸缩 */
  background: #16213e;
  padding: 1rem;
}

.holy-grail__main {
  flex: 1 1 auto; /* 弹性填充，优先扩大 */
  background: #0f3460;
  padding: 1rem;
  min-width: 0; /* 防止内容溢出 */
}

.holy-grail__aside {
  flex: 0 0 250px;
  background: #533483;
  padding: 1rem;
}

/* 响应式：小屏幕折叠为单列 */
@media (max-width: 768px) {
  .holy-grail__body {
    flex-direction: column;
  }
  .holy-grail__nav,
  .holy-grail__aside {
    flex: 0 0 auto;
  }
}
```

**核心知识点:**

- `flex: 0 0 200px` = `flex-grow: 0` `flex-shrink: 0` `flex-basis: 200px`（固定尺寸）
- `flex: 1 1 auto` = 弹性填充剩余空间
- `min-width: 0` 是 Flexbox 子元素内容溢出的经典修复方案
- `flex-direction: column` 实现纵向主轴

---

### 示例 2: 等分卡片行（自动换行 + 间距均等）

```css
.card-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center; /* 主轴居中 */
  align-items: stretch; /* 交叉轴等高 */
}

.card {
  flex: 1 1 280px; /* 最小 280px，最大等分 */
  max-width: 400px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  display: flex;
  flex-direction: column; /* 卡片内部纵向排列 */
}

.card__body {
  flex: 1 1 auto; /* 内容区撑满，把 footer 推到底部 */
}

.card__footer {
  flex: 0 0 auto; /* 底部固定，不伸缩 */
  padding-top: 1rem;
  border-top: 1px solid #eee;
}
```

**核心知识点:**

- `flex: 1 1 280px` 实现响应式等分，自动换行
- `gap` 替代 margin hack，间距更精准
- `align-items: stretch` 让同行卡片等高
- 卡片内部再用 flex 实现 footer 始终在底部

---

### 示例 3: 导航栏（两端对齐 + 响应式汉堡菜单）

```css
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between; /* logo 左，菜单右 */
  padding: 0 2rem;
  height: 64px;
  background: #1a1a2e;
}

.navbar__brand {
  flex: 0 0 auto;
  font-size: 1.5rem;
  font-weight: bold;
  color: #e94560;
}

.navbar__links {
  display: flex;
  gap: 2rem;
  list-style: none;
}

.navbar__links a {
  color: #eee;
  text-decoration: none;
  position: relative;
  transition: color 0.3s;
}

/* 下划线动画 */
.navbar__links a::after {
  content: "";
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 2px;
  background: #e94560;
  transition: width 0.3s ease;
}

.navbar__links a:hover::after {
  width: 100%;
}

/* 汉堡菜单按钮 */
.navbar__toggle {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
}

.navbar__toggle span {
  display: block;
  width: 25px;
  height: 3px;
  background: #fff;
  border-radius: 2px;
  transition:
    transform 0.3s,
    opacity 0.3s;
}

/* 移动端：汉堡菜单 */
@media (max-width: 768px) {
  .navbar__toggle {
    display: flex; /* 显示汉堡按钮 */
  }
  .navbar__links {
    display: none; /* 默认隐藏 */
    position: absolute;
    top: 64px;
    left: 0;
    right: 0;
    flex-direction: column;
    background: #1a1a2e;
    padding: 1rem 2rem;
    gap: 1rem;
  }
  .navbar__links.active {
    display: flex;
  }
}
```

**核心知识点:**

- `justify-content: space-between` 经典两端对齐
- `::after` 伪元素 + `width` 过渡实现下划线动画
- 汉堡菜单三横线用 `flex-direction: column` + `gap` 实现
- 移动端切换用 JS 控制 `.active` 类

---

### 示例 4: 居中神器（Flexbox 终极居中）

```css
/* 水平垂直居中 — 最简洁方案 */
.center {
  display: flex;
  justify-content: center; /* 主轴居中 */
  align-items: center; /* 交叉轴居中 */
  min-height: 100vh;
}

/* 多元素居中（网格状） */
.center-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-content: center; /* 多行时垂直居中 */
  min-height: 100vh;
  gap: 1rem;
}

/* 单元素垂直居中（不改变主轴方向） */
.vertical-center {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100vh;
}

/* 水平居中 + 垂直靠顶 */
.h-center-top {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
}
```

**核心知识点:**

- `justify-content` 控制主轴，`align-items` 控制交叉轴
- `align-content` 控制多行时的行间距分布
- `flex-direction` 改变主轴方向后，justify/align 含义互换

---

### 示例 5: 等分网格（Flexbox 模拟 Grid）

```css
.flex-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.flex-grid__item {
  flex: 0 1 calc(33.333% - 1rem); /* 3 列 */
  min-height: 150px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 8px;
}

.flex-grid--4col .flex-grid__item {
  flex: 0 1 calc(25% - 1rem); /* 4 列 */
}

.flex-grid--2col .flex-grid__item {
  flex: 0 1 calc(50% - 1rem); /* 2 列 */
}

@media (max-width: 768px) {
  .flex-grid__item {
    flex: 0 1 100%; /* 单列 */
  }
}
```

**核心知识点:**

- `calc()` 动态计算宽度，减去 gap
- `flex: 0 1` 表示不放大、可缩小、基础宽度为 calc 值
- Flexbox 模拟 Grid 的局限性：无法精确控制行列对齐

---

### 示例 6: 圣杯布局变体 — 自适应侧边栏

```css
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  flex: 0 0 250px;
  background: #16213e;
  transition:
    flex-basis 0.3s ease,
    padding 0.3s ease;
  overflow: hidden;
  padding: 1rem;
}

.sidebar--collapsed {
  flex: 0 0 60px; /* 折叠到 60px */
}

.sidebar--collapsed .sidebar__label {
  display: none; /* 隐藏文字 */
}

.main-content {
  flex: 1 1 auto;
  background: #0f3460;
  padding: 2rem;
  overflow-y: auto;
}
```

**核心知识点:**

- `flex-basis` 过渡动画实现侧边栏折叠效果
- `overflow: hidden` 防止折叠时内容溢出
- 配合 JS 切换 `.sidebar--collapsed` 类

---

### 示例 7: 聊天消息布局

```css
.chat-container {
  display: flex;
  flex-direction: column;
  max-width: 500px;
  margin: 0 auto;
  padding: 1rem;
  gap: 0.5rem;
}

.message {
  display: flex;
  gap: 0.75rem;
  max-width: 80%;
}

.message--sent {
  align-self: flex-end; /* 靠右 */
  flex-direction: row-reverse; /* 头像在右 */
}

.message--received {
  align-self: flex-start; /* 靠左 */
}

.message__bubble {
  padding: 0.75rem 1rem;
  border-radius: 16px;
  word-break: break-word; /* 长文本换行 */
}

.message--sent .message__bubble {
  background: #e94560;
  color: #fff;
  border-bottom-right-radius: 4px; /* 小三角效果 */
}

.message--received .message__bubble {
  background: #eee;
  color: #333;
  border-bottom-left-radius: 4px;
}

.message__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0; /* 头像不缩小 */
  object-fit: cover;
}
```

**核心知识点:**

- `align-self` 控制单个元素的交叉轴位置
- `flex-direction: row-reverse` 反转子元素顺序
- `word-break: break-word` 防止长 URL 撑破气泡
- `flex-shrink: 0` 保护头像不被压缩

---

### 示例 8: 表单布局（标签对齐 + 响应式）

```css
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.form-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.form-row .form-group {
  flex: 1 1 200px; /* 每个表单组最小 200px */
}

.form-label {
  font-weight: 600;
  font-size: 0.875rem;
  color: #333;
}

.form-input {
  padding: 0.75rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #e94560;
  box-shadow: 0 0 0 3px rgba(233, 69, 96, 0.15);
}

/* 内联表单（水平排列） */
.form-inline {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.form-inline .form-group {
  flex: 0 0 auto;
  margin-bottom: 0;
}
```

**核心知识点:**

- 表单行内 `flex: 1 1 200px` 实现响应式等分
- `flex-wrap: wrap` 保证窄屏自动换行
- `:focus` 状态用 `box-shadow` 做 focus ring（无障碍友好）

---

### 示例 9: 图片画廊（Flexbox 不等宽布局）

```css
.gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.gallery__item {
  flex: 1 1 200px;
  max-width: 400px;
  aspect-ratio: 1 / 1; /* 正方形 */
  overflow: hidden;
  border-radius: 8px;
  position: relative;
}

.gallery__item img {
  width: 100%;
  height: 100%;
  object-fit: cover; /* 裁剪填充 */
  transition: transform 0.4s ease;
}

.gallery__item:hover img {
  transform: scale(1.1); /* 悬停放大 */
}

/* 特色大图占双倍 */
.gallery__item--featured {
  flex: 2 1 400px;
}

/* 横向长图 */
.gallery__item--wide {
  flex: 2 1 400px;
  aspect-ratio: 2 / 1;
}
```

**核心知识点:**

- `aspect-ratio` 现代 CSS 属性，轻松控制比例
- `object-fit: cover` 图片裁剪填充（类似 background-size: cover）
- `flex: 2 1 400px` 让特色项占双倍空间

---

### 示例 10: Flexbox 排序与视觉重排

```css
/* 新闻列表：置顶文章始终在最前 */
.news-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.news-item {
  order: 1; /* 默认顺序 */
  padding: 1rem;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.news-item--pinned {
  order: -1; /* 置顶 */
  border: 2px solid #e94560;
}

.news-item--breaking {
  order: -2; /* 更优先 */
  background: #fff0f0;
}

/* 响应式：改变视觉顺序 */
@media (max-width: 768px) {
  .sidebar {
    order: 2;
  } /* 移动端侧边栏移到底部 */
  .main {
    order: 1;
  } /* 主内容先显示 */
  .footer {
    order: 3;
  }
}
```

**核心知识点:**

- `order` 属性改变视觉顺序，不影响 DOM 顺序（无障碍友好）
- 负值优先级更高
- 响应式布局中用 `order` 调整阅读顺序

---

## 二、CSS Grid 深度 — 8 个示例

### 示例 11: Grid 圣杯布局（比 Flexbox 更简洁）

```css
.grid-holy-grail {
  display: grid;
  grid-template-columns: 200px 1fr 250px; /* 左 中 右 */
  grid-template-rows: auto 1fr auto; /* 头 内容 脚 */
  grid-template-areas:
    "header  header  header"
    "nav     main    aside"
    "footer  footer  footer";
  min-height: 100vh;
  gap: 0;
}

.grid-holy-grail__header {
  grid-area: header;
  background: #1a1a2e;
  color: #fff;
  padding: 1rem;
}
.grid-holy-grail__nav {
  grid-area: nav;
  background: #16213e;
  padding: 1rem;
}
.grid-holy-grail__main {
  grid-area: main;
  background: #0f3460;
  padding: 1rem;
}
.grid-holy-grail__aside {
  grid-area: aside;
  background: #533483;
  padding: 1rem;
}
.grid-holy-grail__footer {
  grid-area: footer;
  background: #1a1a2e;
  color: #fff;
  padding: 1rem;
}

@media (max-width: 768px) {
  .grid-holy-grail {
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "main"
      "nav"
      "aside"
      "footer";
  }
}
```

**核心知识点:**

- `grid-template-areas` 用 ASCII 艺术定义布局，直观可读
- `1fr` 表示剩余空间的等分份额
- 响应式只需重新定义 `grid-template-areas`

---

### 示例 12: 自动填充响应式网格

```css
.auto-grid {
  display: grid;
  /* 自动填充，最小 250px，最大 1fr 等分 */
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  padding: 2rem;
}

.auto-grid__card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 1.5rem;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.auto-grid__card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
```

**核心知识点:**

- `repeat(auto-fill, minmax(250px, 1fr))` 是 Grid 响应式最经典模式
- 无需媒体查询，自动根据容器宽度决定列数
- `auto-fill` vs `auto-fit`：`auto-fit` 会在空间有余时拉伸轨道

---

### 示例 13: 复杂仪表盘布局

```css
.dashboard {
  display: grid;
  grid-template-columns: repeat(12, 1fr); /* 12 列栅格系统 */
  grid-template-rows: auto;
  gap: 1rem;
  padding: 1rem;
}

/* 跨列布局 */
.dashboard__stat-1 {
  grid-column: span 3;
}
.dashboard__stat-2 {
  grid-column: span 3;
}
.dashboard__stat-3 {
  grid-column: span 3;
}
.dashboard__stat-4 {
  grid-column: span 3;
}

.dashboard__chart-main {
  grid-column: span 8;
  min-height: 400px;
}

.dashboard__chart-side {
  grid-column: span 4;
  min-height: 400px;
}

.dashboard__table {
  grid-column: 1 / -1; /* 从第 1 列到最后一列（全宽） */
  min-height: 300px;
}

@media (max-width: 1024px) {
  .dashboard__stat-1,
  .dashboard__stat-2,
  .dashboard__stat-3,
  .dashboard__stat-4 {
    grid-column: span 6; /* 平板：2 列 */
  }
  .dashboard__chart-main {
    grid-column: span 12;
  }
  .dashboard__chart-side {
    grid-column: span 12;
  }
}

@media (max-width: 768px) {
  .dashboard__stat-1,
  .dashboard__stat-2,
  .dashboard__stat-3,
  .dashboard__stat-4 {
    grid-column: span 12; /* 手机：1 列 */
  }
}
```

**核心知识点:**

- 12 列栅格系统是 Bootstrap 经典模式的 CSS 原生实现
- `grid-column: span N` 控制占几列
- `grid-column: 1 / -1` 表示全宽（从第一列到最后一列）
- 响应式只需调整 `grid-column: span` 值

---

### 示例 14: 杂志风格布局

```css
.magazine {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  grid-template-rows: auto;
  gap: 1rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.magazine__hero {
  grid-column: 1 / 2;
  grid-row: 1 / 3; /* 跨 2 行 */
  min-height: 400px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 12px;
  display: flex;
  align-items: flex-end;
  padding: 2rem;
  color: #fff;
}

.magazine__article {
  background: #fff;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.magazine__article--wide {
  grid-column: 2 / 4; /* 占右侧两列 */
}

.magazine__article--tall {
  grid-row: span 2;
}
```

**核心知识点:**

- `grid-column: 1 / 2` 和 `grid-row: 1 / 3` 精确控制跨列/跨行
- 非对称布局是 Grid 的强项（Flexbox 很难做到）
- 杂志/博客首页是典型应用场景

---

### 示例 15: Grid 子元素居中 + 对齐控制

```css
.grid-alignment {
  display: grid;
  grid-template-columns: repeat(3, 200px);
  grid-template-rows: repeat(2, 150px);
  gap: 1rem;
  /* 整个网格在容器中居中 */
  place-content: center;
  /* 每个单元格内内容居中 */
  place-items: center;
}

/* place-content = justify-content + align-content（网格整体） */
/* place-items   = justify-items + align-items（单元格内） */

.grid-item {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 8px;
  color: #fff;
  padding: 1rem;
  /* 单个元素覆盖全局对齐 */
  justify-self: start;
  align-self: end;
}
```

**核心知识点:**

- `place-content` 控制网格整体在容器中的位置
- `place-items` 控制每个单元格内内容的对齐
- `justify-self` / `align-self` 可覆盖单个元素的对齐

---

### 示例 16: 隐式网格 + 自动行高

```css
.implicit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  grid-auto-rows: minmax(100px, auto); /* 行高最小 100px，内容多时自动撑开 */
  gap: 1rem;
}

.implicit-grid__item {
  background: #fff;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* 网格线命名 — 更语义化的定位 */
.named-grid {
  display: grid;
  grid-template-columns: [sidebar-start] 250px [sidebar-end main-start] 1fr [main-end];
  grid-template-rows: [header-start] auto [header-end content-start] 1fr [content-end footer-start] auto [footer-end];
  min-height: 100vh;
}

.named-grid__sidebar {
  grid-column: sidebar-start / sidebar-end;
}
.named-grid__main {
  grid-column: main-start / main-end;
}
```

**核心知识点:**

- `grid-auto-rows` 控制隐式行（超出定义的行数）的高度
- `minmax(100px, auto)` 保证最小高度，内容多时自动撑开
- 命名网格线让定位更语义化，但日常开发中 `grid-template-areas` 更常用

---

### 示例 17: 嵌套 Grid（Grid 套 Grid）

```css
.nested-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 2rem;
}

.nested-grid__sidebar {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.nested-grid__content {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: auto 1fr auto;
  gap: 1rem;
}

.nested-grid__content > .header {
  grid-column: 1 / -1;
}

.nested-grid__content > .footer {
  grid-column: 1 / -1;
}
```

**核心知识点:**

- Grid 子元素本身可以是 Grid 容器
- 嵌套 Grid 是构建复杂页面的标准模式
- 每个 Grid 上下文独立，互不影响

---

### 示例 18: Grid 覆盖层（重叠定位）

```css
.overlay-grid {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  width: 100%;
  max-width: 600px;
  position: relative;
}

/* 所有子元素放在同一个网格单元格上 */
.overlay-grid > * {
  grid-column: 1;
  grid-row: 1;
}

.overlay-grid__image {
  width: 100%;
  border-radius: 12px;
}

.overlay-grid__badge {
  align-self: start;
  justify-self: end;
  margin: 1rem;
  background: #e94560;
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  z-index: 1;
}

.overlay-grid__caption {
  align-self: end;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: #fff;
  padding: 3rem 1.5rem 1.5rem;
  border-radius: 0 0 12px 12px;
}
```

**核心知识点:**

- 多个元素放在同一 `grid-column: 1; grid-row: 1` 实现重叠
- 比 `position: absolute` 更灵活，可配合 `place-self` 精确定位
- 图片 + 标签 + 标题的经典覆盖布局

---

## 三、CSS 动画 — 6 个示例

### 示例 19: 关键帧动画（加载动画集合）

```css
/* 旋转加载 */
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e0e0e0;
  border-top-color: #e94560;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 脉冲动画 */
.pulse {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}

/* 弹跳动画 */
.bounce {
  animation: bounce 1s ease infinite;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}

/* 打字机效果 */
.typewriter {
  overflow: hidden;
  white-space: nowrap;
  border-right: 3px solid #e94560;
  animation:
    typing 3s steps(20) forwards,
    blink 0.7s step-end infinite;
}

@keyframes typing {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

@keyframes blink {
  50% {
    border-color: transparent;
  }
}

/* 骨架屏闪烁 */
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 波浪加载 */
.wave-loader {
  display: flex;
  gap: 4px;
  align-items: center;
  height: 40px;
}

.wave-loader span {
  width: 6px;
  height: 20px;
  background: #e94560;
  border-radius: 3px;
  animation: wave 1.2s ease-in-out infinite;
}

.wave-loader span:nth-child(1) {
  animation-delay: 0s;
}
.wave-loader span:nth-child(2) {
  animation-delay: 0.1s;
}
.wave-loader span:nth-child(3) {
  animation-delay: 0.2s;
}
.wave-loader span:nth-child(4) {
  animation-delay: 0.3s;
}
.wave-loader span:nth-child(5) {
  animation-delay: 0.4s;
}

@keyframes wave {
  0%,
  100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(2);
  }
}
```

**核心知识点:**

- `animation` 简写：`name duration timing-function delay iteration-count direction fill-mode play-state`
- `steps(N)` 实现逐帧动画（打字机）
- `animation-delay` 错开多个元素的动画节奏
- `background-size: 200%` + `background-position` 实现骨架屏闪烁

---

### 示例 20: 过渡动画（交互反馈）

```css
/* 按钮过渡 */
.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  background: #e94560;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  transition:
    background 0.3s ease,
    transform 0.2s ease,
    box-shadow 0.3s ease;
}

.btn:hover {
  background: #c73e54;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(233, 69, 96, 0.4);
}

.btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(233, 69, 96, 0.3);
}

/* 卡片悬停效果 */
.card-hover {
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.3s ease;
}

.card-hover:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
}

/* 平滑高度展开（纯 CSS 方案） */
.expandable {
  max-height: 0;
  overflow: hidden;
  transition:
    max-height 0.4s ease,
    padding 0.4s ease;
}

.expandable--open {
  max-height: 500px; /* 足够大的值 */
}

/* 使用 :has() 实现纯 CSS 展开（现代浏览器） */
.expandable-trigger:has(:checked) + .expandable {
  max-height: 500px;
}
```

**核心知识点:**

- `transition` 可同时对多个属性设置不同缓动
- `cubic-bezier(0.34, 1.56, 0.64, 1)` 弹性缓动（overshoot 效果）
- `max-height` 过渡是实现纯 CSS 展开/收起的经典方案
- `:has()` 伪类让纯 CSS 交互成为可能

---

### 示例 21: 3D 变换（翻转卡片）

```css
.flip-card {
  perspective: 1000px; /* 3D 透视深度 */
  width: 300px;
  height: 200px;
}

.flip-card__inner {
  width: 100%;
  height: 100%;
  position: relative;
  transition: transform 0.6s;
  transform-style: preserve-3d; /* 保持子元素 3D 空间 */
}

.flip-card:hover .flip-card__inner {
  transform: rotateY(180deg);
}

.flip-card__front,
.flip-card__back {
  position: absolute;
  inset: 0; /* top/right/bottom/left: 0 简写 */
  backface-visibility: hidden; /* 背面不可见 */
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: bold;
}

.flip-card__front {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

.flip-card__back {
  background: linear-gradient(135deg, #e94560, #c73e54);
  color: #fff;
  transform: rotateY(180deg); /* 背面初始旋转 180° */
}
```

**核心知识点:**

- `perspective` 定义 3D 透视深度，值越小透视感越强
- `transform-style: preserve-3d` 让子元素保持在 3D 空间
- `backface-visibility: hidden` 隐藏元素背面
- `inset: 0` 是 `top: 0; right: 0; bottom: 0; left: 0;` 的现代简写

---

### 示例 22: 滚动触发动画（Intersection Observer + CSS）

```css
/* 初始状态：不可见 + 偏移 */
.animate-on-scroll {
  opacity: 0;
  transform: translateY(30px);
  transition:
    opacity 0.6s ease,
    transform 0.6s ease;
}

/* 进入视口后：可见 + 归位 */
.animate-on-scroll.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* 不同方向的进入动画 */
.animate-from-left {
  opacity: 0;
  transform: translateX(-50px);
  transition:
    opacity 0.6s ease,
    transform 0.6s ease;
}
.animate-from-left.is-visible {
  opacity: 1;
  transform: translateX(0);
}

.animate-scale {
  opacity: 0;
  transform: scale(0.8);
  transition:
    opacity 0.5s ease,
    transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.animate-scale.is-visible {
  opacity: 1;
  transform: scale(1);
}

/* 交错动画（子元素依次出现） */
.stagger-container > * {
  opacity: 0;
  transform: translateY(20px);
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}

.stagger-container.is-visible > *:nth-child(1) {
  transition-delay: 0.05s;
}
.stagger-container.is-visible > *:nth-child(2) {
  transition-delay: 0.1s;
}
.stagger-container.is-visible > *:nth-child(3) {
  transition-delay: 0.15s;
}
.stagger-container.is-visible > *:nth-child(4) {
  transition-delay: 0.2s;
}
.stagger-container.is-visible > *:nth-child(5) {
  transition-delay: 0.25s;
}

.stagger-container.is-visible > * {
  opacity: 1;
  transform: translateY(0);
}
```

**核心知识点:**

- CSS 只负责动画，JS（Intersection Observer）负责触发
- `transition-delay` 实现交错动画（stagger effect）
- `cubic-bezier(0.34, 1.56, 0.64, 1)` 弹性效果让动画更生动

---

### 示例 23: CSS 自定义属性动画

```css
:root {
  --hue: 200;
  --progress: 0%;
}

/* 动态颜色变化 */
.dynamic-color {
  background: hsl(var(--hue), 70%, 60%);
  transition: background 0.3s;
}

/* 通过 JS 修改 --hue 实现颜色渐变 */
/* document.documentElement.style.setProperty('--hue', 250); */

/* 进度条动画 */
.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar__fill {
  height: 100%;
  width: var(--progress);
  background: linear-gradient(
    90deg,
    hsl(var(--hue), 70%, 60%),
    hsl(calc(var(--hue) + 40), 70%, 60%)
  );
  border-radius: 4px;
  transition:
    width 0.5s ease,
    background 0.3s;
}

/* 鼠标跟随效果 */
.mouse-follow {
  --x: 0px;
  --y: 0px;
  background: radial-gradient(
    circle at var(--x) var(--y),
    rgba(233, 69, 96, 0.3) 0%,
    transparent 50%
  );
}
```

**核心知识点:**

- CSS 自定义属性（CSS Variables）可在运行时动态修改
- `calc()` 可对自定义属性进行计算
- `hsl()` 色相环 + 自定义属性实现动态配色
- 配合 JS 可实现鼠标跟随、滚动驱动等高级效果

---

### 示例 24: 复杂组合动画（加载状态 → 成功状态）

```css
/* 按钮加载状态 */
.btn-loading {
  position: relative;
  color: transparent;
  pointer-events: none;
}

.btn-loading::after {
  content: "";
  position: absolute;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  top: 50%;
  left: 50%;
  margin: -10px 0 0 -10px;
}

/* 成功状态 */
.btn-success {
  animation: success-pop 0.5s ease forwards;
}

@keyframes success-pop {
  0% {
    transform: scale(1);
  }
  30% {
    transform: scale(1.15);
  }
  60% {
    transform: scale(0.95);
  }
  100% {
    transform: scale(1);
  }
}

/* 错误抖动 */
.btn-error {
  animation: shake 0.5s ease;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  10%,
  30%,
  50%,
  70%,
  90% {
    transform: translateX(-4px);
  }
  20%,
  40%,
  60%,
  80% {
    transform: translateX(4px);
  }
}

/* 通知滑入 */
.notification {
  animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.notification--leaving {
  animation: slideOut 0.3s ease forwards;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
```

**核心知识点:**

- `pointer-events: none` 禁用加载中的按钮点击
- `color: transparent` 隐藏文字但保留按钮尺寸
- `animation-fill-mode: forwards` 保持动画结束状态
- 抖动动画用多个关键帧实现来回震动效果

---

## 四、响应式设计 — 6 个示例

### 示例 25: 流体排版（Fluid Typography）

```css
/* CSS clamp() 实现流体字号 */
html {
  font-size: clamp(14px, 2vw + 10px, 20px);
}

h1 {
  font-size: clamp(2rem, 5vw + 1rem, 4rem);
  line-height: 1.2;
}

h2 {
  font-size: clamp(1.5rem, 3vw + 0.75rem, 2.5rem);
}

p {
  font-size: clamp(0.875rem, 1vw + 0.5rem, 1.125rem);
  line-height: 1.6;
}

/* clamp(min, preferred, max) */
/* 最小值: 14px, 最大值: 20px, 中间值: 2vw + 10px */
/* 在 320px-1200px 之间字号线性变化 */
```

**核心知识点:**

- `clamp()` 是现代 CSS 流体排版的最佳方案
- 无需媒体查询，字号随视口自动缩放
- `2vw + 10px` 中的 `vw` 单位让字号与视口宽度关联

---

### 示例 26: 容器查询（Container Queries）

```css
/* 组件响应式：基于容器而非视口 */
.card-container {
  container-type: inline-size; /* 定义容器 */
  container-name: card;
}

.card {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.card__image {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
}

/* 容器宽度 > 400px 时：横向布局 */
@container card (min-width: 400px) {
  .card {
    grid-template-columns: 200px 1fr;
    align-items: center;
  }
  .card__image {
    aspect-ratio: 1 / 1;
    width: 200px;
  }
}

/* 容器宽度 > 600px 时：更大布局 */
@container card (min-width: 600px) {
  .card {
    grid-template-columns: 300px 1fr;
    gap: 2rem;
  }
  .card__image {
    aspect-ratio: 4 / 3;
    width: 300px;
  }
}
```

**核心知识点:**

- 容器查询让组件真正可复用（不依赖视口宽度）
- `container-type: inline-size` 定义容器
- `@container` 语法与 `@media` 类似，但基于容器尺寸
- 组件库开发必备技能

---

### 示例 27: 响应式导航（移动端抽屉）

```css
/* 桌面端导航 */
.nav-desktop {
  display: flex;
  align-items: center;
  gap: 2rem;
}

/* 移动端抽屉导航 */
.nav-mobile {
  position: fixed;
  top: 0;
  right: 0;
  width: 300px;
  height: 100vh;
  background: #1a1a2e;
  transform: translateX(100%); /* 默认隐藏在右侧 */
  transition: transform 0.3s ease;
  z-index: 1000;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.nav-mobile.is-open {
  transform: translateX(0); /* 滑入 */
}

/* 遮罩层 */
.nav-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: 999;
}

.nav-overlay.is-open {
  opacity: 1;
  pointer-events: auto;
}

/* 使用 :has() 纯 CSS 控制（现代方案） */
.nav-toggle:checked ~ .nav-mobile {
  transform: translateX(0);
}

.nav-toggle:checked ~ .nav-overlay {
  opacity: 1;
  pointer-events: auto;
}
```

**核心知识点:**

- `transform: translateX(100%)` 比 `left: 100%` 性能更好（GPU 加速）
- `pointer-events: none` 让遮罩层不可点击
- `inset: 0` 是现代 CSS 的全方位定位简写

---

### 示例 28: 响应式图片

```css
/* 响应式图片基础 */
.responsive-img {
  max-width: 100%;
  height: auto;
  display: block;
}

/* srcset + sizes 的 CSS 配合 */
.responsive-img--art-direction {
  width: 100%;
  height: auto;
  object-fit: cover;
  aspect-ratio: 16 / 9;
}

@media (max-width: 768px) {
  .responsive-img--art-direction {
    aspect-ratio: 1 / 1; /* 移动端正方形裁剪 */
  }
}

/* 懒加载占位 */
.lazy-img {
  opacity: 0;
  transition: opacity 0.3s ease;
}

.lazy-img.is-loaded {
  opacity: 1;
}

/* 图片画廊响应式 */
.gallery-responsive {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.5rem;
}

@media (max-width: 480px) {
  .gallery-responsive {
    grid-template-columns: repeat(2, 1fr); /* 手机 2 列 */
    gap: 0.25rem;
  }
}
```

**核心知识点:**

- `max-width: 100%` + `height: auto` 是响应式图片的黄金法则
- `object-fit: cover` 配合 `aspect-ratio` 实现艺术方向控制
- HTML `<picture>` + `srcset` 是服务端方案，CSS 是表现层配合

---

### 示例 29: 响应式间距系统

```css
/* 基于 CSS 自定义属性的响应式间距 */
:root {
  --space-xs: clamp(0.25rem, 0.5vw, 0.5rem);
  --space-sm: clamp(0.5rem, 1vw, 0.75rem);
  --space-md: clamp(0.75rem, 2vw, 1.5rem);
  --space-lg: clamp(1rem, 3vw, 2rem);
  --space-xl: clamp(1.5rem, 4vw, 3rem);
  --space-2xl: clamp(2rem, 5vw, 4rem);
}

/* 使用示例 */
.section {
  padding: var(--space-lg) var(--space-md);
}

.card {
  margin-bottom: var(--space-md);
  padding: var(--space-md);
  gap: var(--space-sm);
}

.hero {
  padding: var(--space-2xl) var(--space-md);
}

/* 响应式容器宽度 */
.container {
  width: min(90%, 1200px); /* 最大 1200px，窄屏占 90% */
  margin-inline: auto; /* 水平居中 */
}

/* 响应式 gap */
.flex-responsive {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}
```

**核心知识点:**

- `clamp()` 实现响应式间距，无需媒体查询
- `width: min(90%, 1200px)` 是现代容器模式
- `margin-inline: auto` 是 `margin-left/right: auto` 的逻辑属性写法

---

### 示例 30: 响应式表格

```css
/* 桌面端：标准表格 */
.responsive-table {
  width: 100%;
  border-collapse: collapse;
}

.responsive-table th,
.responsive-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.responsive-table th {
  background: #f8f9fa;
  font-weight: 600;
  position: sticky;
  top: 0;
}

/* 移动端：卡片化表格 */
@media (max-width: 768px) {
  .responsive-table thead {
    display: none; /* 隐藏表头 */
  }

  .responsive-table,
  .responsive-table tbody,
  .responsive-table tr,
  .responsive-table td {
    display: block;
    width: 100%;
  }

  .responsive-table tr {
    margin-bottom: 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 0.5rem;
  }

  .responsive-table td {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    border: none;
    border-bottom: 1px solid #f0f0f0;
  }

  .responsive-table td::before {
    content: attr(data-label); /* 用 data-label 显示列名 */
    font-weight: 600;
    color: #666;
  }

  .responsive-table td:last-child {
    border-bottom: none;
  }
}
```

**HTML 配合:**

```html
<td data-label="姓名">张三</td>
<td data-label="邮箱">zhang@example.com</td>
<td data-label="角色">管理员</td>
```

**核心知识点:**

- `display: block` 将表格行转为卡片
- `::before` + `attr()` 显示列名（移动端必备）
- `position: sticky` 表头滚动固定

---

## 五、临摹复杂布局 — 3 个实战

### 临摹 1: Notion 风格文档编辑器

```html
<!-- Notion 风格：左侧边栏 + 主编辑区 -->
<div class="notion-layout">
  <aside class="notion-sidebar">
    <div class="notion-sidebar__workspace">
      <div class="notion-sidebar__avatar">📝</div>
      <span class="notion-sidebar__name">我的空间</span>
    </div>
    <nav class="notion-sidebar__nav">
      <a class="notion-sidebar__link notion-sidebar__link--active" href="#"
        >📄 快速开始</a
      >
      <a class="notion-sidebar__link" href="#">📁 项目</a>
      <a class="notion-sidebar__link" href="#">📋 待办</a>
      <a class="notion-sidebar__link" href="#">💡 想法</a>
    </nav>
    <div class="notion-sidebar__favorites">
      <h4>收藏</h4>
      <a class="notion-sidebar__link" href="#">⭐ 重要文档</a>
    </div>
  </aside>
  <main class="notion-main">
    <header class="notion-header">
      <h1 class="notion-title">快速开始</h1>
      <div class="notion-header__actions">
        <button class="notion-btn">分享</button>
        <button class="notion-btn">⋯</button>
      </div>
    </header>
    <div class="notion-content">
      <p class="notion-text">这是一个 Notion 风格的文档编辑器布局...</p>
      <div class="notion-callout">
        <span class="notion-callout__icon">💡</span>
        <p>提示：使用 / 命令插入各种内容块</p>
      </div>
    </div>
  </main>
</div>
```

```css
.notion-layout {
  display: flex;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #fff;
  color: #37352f;
}

/* 左侧边栏 */
.notion-sidebar {
  width: 280px;
  background: #f7f7f5;
  border-right: 1px solid #e9e9e7;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex-shrink: 0;
  transition: width 0.3s ease;
  overflow: hidden;
}

.notion-sidebar--collapsed {
  width: 0;
  padding: 0;
  border: none;
}

.notion-sidebar__workspace {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.notion-sidebar__workspace:hover {
  background: #efefef;
}

.notion-sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notion-sidebar__link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 4px;
  text-decoration: none;
  color: #37352f;
  font-size: 0.875rem;
  transition: background 0.15s;
}

.notion-sidebar__link:hover {
  background: #efefef;
}

.notion-sidebar__link--active {
  background: #e8e8e6;
  font-weight: 500;
}

/* 主内容区 */
.notion-main {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.notion-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2rem 96px 0;
  border-bottom: 1px solid transparent;
}

.notion-title {
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1.2;
  margin: 0;
  color: #37352f;
}

.notion-header__actions {
  display: flex;
  gap: 0.5rem;
}

.notion-content {
  padding: 2rem 96px;
  max-width: 900px;
  flex: 1;
}

.notion-text {
  font-size: 1.125rem;
  line-height: 1.7;
  color: #37352f;
}

.notion-callout {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: #fff8e1;
  border-radius: 6px;
  border-left: 4px solid #ffc107;
  margin: 1rem 0;
}

.notion-callout__icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.notion-btn {
  padding: 0.375rem 0.75rem;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  color: #37352f;
  transition: background 0.15s;
}

.notion-btn:hover {
  background: #efefef;
}

/* 响应式 */
@media (max-width: 1024px) {
  .notion-header,
  .notion-content {
    padding-left: 48px;
    padding-right: 48px;
  }
}

@media (max-width: 768px) {
  .notion-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    z-index: 100;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  }
  .notion-sidebar--collapsed {
    transform: translateX(-100%);
  }
  .notion-header,
  .notion-content {
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }
  .notion-title {
    font-size: 1.75rem;
  }
}
```

**临摹要点:**

1. Flexbox 主布局：侧边栏 `flex-shrink: 0` + 主内容 `flex: 1`
2. 侧边栏折叠：`width` 过渡 + `overflow: hidden`
3. 主内容区 `padding: 2rem 96px` 实现 Notion 标志性宽边距
4. Callout 组件：flex 布局 + 左侧边框强调
5. 响应式：移动端侧边栏变为 fixed 抽屉

---

### 临摹 2: GitHub 代码仓库页面

```html
<!-- GitHub 仓库页面布局 -->
<div class="repo-page">
  <!-- 顶部导航 -->
  <header class="repo-header">
    <div class="repo-header__breadcrumb">
      <a href="#">username</a> / <a href="#">repo-name</a>
    </div>
    <div class="repo-header__actions">
      <button class="repo-btn">👁 Watch</button>
      <button class="repo-btn">⭐ Star</button>
      <button class="repo-btn">🍴 Fork</button>
    </div>
  </header>

  <!-- Tab 导航 -->
  <nav class="repo-tabs">
    <a class="repo-tab repo-tab--active" href="#">Code</a>
    <a class="repo-tab" href="#"
      >Issues <span class="repo-tab__badge">12</span></a
    >
    <a class="repo-tab" href="#"
      >Pull requests <span class="repo-tab__badge">3</span></a
    >
    <a class="repo-tab" href="#">Actions</a>
    <a class="repo-tab" href="#">Projects</a>
  </nav>

  <div class="repo-body">
    <!-- 文件浏览器 -->
    <div class="repo-file-browser">
      <div class="repo-file-browser__toolbar">
        <div class="repo-branch-selector"><span>main</span> ▾</div>
        <div class="repo-file-browser__search">🔍 Search file</div>
        <div class="repo-file-browser__add">
          <button class="repo-btn-sm">Add file</button>
        </div>
      </div>

      <table class="repo-file-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Name</th>
            <th>Last commit</th>
          </tr>
        </thead>
        <tbody>
          <tr class="repo-file-row">
            <td>📁</td>
            <td><a href="#">src</a></td>
            <td>Update README 2 days ago</td>
          </tr>
          <tr class="repo-file-row">
            <td>📄</td>
            <td><a href="#">package.json</a></td>
            <td>Add dependencies 3 days ago</td>
          </tr>
          <tr class="repo-file-row">
            <td>📄</td>
            <td><a href="#">README.md</a></td>
            <td>Update README 2 days ago</td>
          </tr>
        </tbody>
      </table>

      <!-- README 渲染区 -->
      <article class="repo-readme">
        <h1>Repo Name</h1>
        <p>A brief description of the project.</p>
        <div class="repo-badge-row">
          <span class="repo-badge">build ✅</span>
          <span class="repo-badge">coverage 85%</span>
          <span class="repo-badge">license MIT</span>
        </div>
        <h2>Installation</h2>
        <pre><code>npm install repo-name</code></pre>
        <h2>Usage</h2>
        <pre><code>import { something } from 'repo-name';</code></pre>
      </article>
    </div>

    <!-- 右侧边栏 -->
    <aside class="repo-sidebar">
      <div class="repo-sidebar__section">
        <h4>About</h4>
        <p>A brief description of the project goes here.</p>
      </div>
      <div class="repo-sidebar__section">
        <h4>Releases</h4>
        <a href="#">v1.0.0</a>
      </div>
      <div class="repo-sidebar__section">
        <h4>Languages</h4>
        <div class="repo-lang-bar">
          <div
            class="repo-lang-segment"
            style="width: 60%; background: #f1e05a;"
          ></div>
          <div
            class="repo-lang-segment"
            style="width: 25%; background: #3178c6;"
          ></div>
          <div
            class="repo-lang-segment"
            style="width: 15%; background: #e34c26;"
          ></div>
        </div>
        <div class="repo-lang-list">
          <span>JavaScript 60%</span>
          <span>TypeScript 25%</span>
          <span>HTML 15%</span>
        </div>
      </div>
    </aside>
  </div>
</div>
```

```css
.repo-page {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  background: #fff;
  color: #1f2328;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
}

/* 顶部导航 */
.repo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
}

.repo-header__breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 1.25rem;
  font-weight: 300;
}

.repo-header__breadcrumb a {
  color: #0969da;
  text-decoration: none;
}

.repo-header__breadcrumb a:hover {
  text-decoration: underline;
}

.repo-header__actions {
  display: flex;
  gap: 0.5rem;
}

.repo-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fafbfc;
  color: #1f2328;
  font-size: 0.875rem;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.repo-btn:hover {
  background: #f3f4f6;
  border-color: #afb8c1;
}

/* Tab 导航 */
.repo-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #d0d7de;
  margin-bottom: 16px;
}

.repo-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 8px 16px;
  color: #1f2328;
  text-decoration: none;
  font-size: 0.875rem;
  border-bottom: 2px solid transparent;
  transition: border-color 0.15s;
  border-radius: 6px 6px 0 0;
}

.repo-tab:hover {
  color: #0969da;
}

.repo-tab--active {
  border-bottom-color: #fd8c73;
  font-weight: 600;
}

.repo-tab__badge {
  background: #afb8c1;
  color: #fff;
  font-size: 0.75rem;
  padding: 0 0.5rem;
  border-radius: 10px;
  font-weight: 500;
}

/* 主体布局 */
.repo-body {
  display: flex;
  gap: 24px;
}

.repo-file-browser {
  flex: 1 1 auto;
  min-width: 0;
}

.repo-sidebar {
  flex: 0 0 296px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 文件浏览器工具栏 */
.repo-file-browser__toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
}

.repo-branch-selector {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
}

.repo-file-browser__search {
  flex: 1 1 auto;
  padding: 0.375rem 0.75rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #656d76;
  background: #fff;
}

.repo-btn-sm {
  padding: 0.25rem 0.75rem;
  border: 1px solid #1f2328;
  border-radius: 6px;
  background: #21262d;
  color: #fff;
  font-size: 0.875rem;
  cursor: pointer;
}

/* 文件表格 */
.repo-file-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #d0d7de;
  border-top: none;
  border-radius: 0 0 6px 6px;
  overflow: hidden;
}

.repo-file-row {
  border-bottom: 1px solid #d0d7de;
  transition: background 0.1s;
}

.repo-file-row:hover {
  background: #f6f8fa;
}

.repo-file-row td {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  vertical-align: middle;
}

.repo-file-row td:nth-child(1) {
  width: 40px;
  text-align: center;
}
.repo-file-row td:nth-child(3) {
  color: #656c76;
  width: 250px;
}

.repo-file-row a {
  color: #0969da;
  text-decoration: none;
}

.repo-file-row a:hover {
  text-decoration: underline;
}

/* README */
.repo-readme {
  margin-top: 16px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 2rem;
}

.repo-readme h1 {
  border-bottom: 1px solid #d0d7de;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.repo-readme h2 {
  border-bottom: 1px solid #d0d7de;
  padding-bottom: 0.5rem;
  margin-top: 1.5rem;
}

.repo-readme pre {
  background: #f6f8fa;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.875rem;
}

.repo-badge-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin: 1rem 0;
}

.repo-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #dafbe1;
  color: #1a7f37;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

/* 右侧边栏 */
.repo-sidebar__section {
  padding: 16px;
  border-bottom: 1px solid #d0d7de;
}

.repo-sidebar__section h4 {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  color: #656d76;
}

.repo-sidebar__section p {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
}

.repo-sidebar__section a {
  color: #0969da;
  text-decoration: none;
  font-size: 0.875rem;
}

/* 语言占比条 */
.repo-lang-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.repo-lang-segment {
  height: 100%;
}

.repo-lang-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #656d76;
}

/* 响应式 */
@media (max-width: 1024px) {
  .repo-sidebar {
    display: none; /* 平板隐藏侧边栏 */
  }
}

@media (max-width: 768px) {
  .repo-page {
    padding: 0 12px;
  }
  .repo-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .repo-header__actions {
    width: 100%;
    justify-content: flex-start;
  }
  .repo-tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .repo-file-browser__toolbar {
    flex-wrap: wrap;
  }
  .repo-file-browser__search {
    order: 3;
    flex-basis: 100%;
  }
  .repo-readme {
    padding: 1rem;
  }
}
```

**临摹要点:**

1. Flexbox 主布局：文件浏览器 `flex: 1` + 侧边栏 `flex: 0 0 296px`
2. Tab 导航：`border-bottom` 激活态 + `badge` 计数
3. 文件表格：hover 高亮行 + 列宽控制
4. 语言占比条：flex 子元素百分比宽度拼接
5. 响应式：平板隐藏侧边栏，移动端工具栏换行

---

### 临摹 3: 电商产品详情页（Amazon/淘宝风格）

```html
<!-- 电商产品详情页 -->
<div class="product-page">
  <!-- 面包屑 -->
  <nav class="breadcrumb">
    <a href="#">首页</a> / <a href="#">电子产品</a> / <a href="#">手机</a> /
    <span>产品名称</span>
  </nav>

  <div class="product-body">
    <!-- 左侧：图片画廊 -->
    <div class="product-gallery">
      <div class="product-gallery__main">
        <img
          src="product-main.jpg"
          alt="产品主图"
          class="product-gallery__image"
        />
        <span class="product-gallery__badge">新品</span>
      </div>
      <div class="product-gallery__thumbs">
        <div class="product-gallery__thumb product-gallery__thumb--active">
          <img src="thumb1.jpg" alt="缩略图 1" />
        </div>
        <div class="product-gallery__thumb">
          <img src="thumb2.jpg" alt="缩略图 2" />
        </div>
        <div class="product-gallery__thumb">
          <img src="thumb3.jpg" alt="缩略图 3" />
        </div>
        <div class="product-gallery__thumb">
          <img src="thumb4.jpg" alt="缩略图 4" />
        </div>
      </div>
    </div>

    <!-- 中间：产品信息 -->
    <div class="product-info">
      <h1 class="product-info__title">产品名称 超长标题自动换行测试测试测试</h1>
      <div class="product-info__rating">
        <span class="stars">⭐⭐⭐⭐⭐</span>
        <span class="product-info__rating-text">4.8 (2,345 条评价)</span>
      </div>
      <div class="product-info__price-row">
        <span class="product-info__price">¥2,999</span>
        <span class="product-info__original-price">¥3,999</span>
        <span class="product-info__discount">-25%</span>
      </div>
      <div class="product-info__meta">
        <p><strong>品牌：</strong>BrandName</p>
        <p><strong>颜色：</strong></p>
        <div class="product-info__colors">
          <button
            class="color-swatch color-swatch--active"
            style="background: #000;"
            data-color="black"
          ></button>
          <button
            class="color-swatch"
            style="background: #fff; border: 1px solid #ddd;"
            data-color="white"
          ></button>
          <button
            class="color-swatch"
            style="background: #1a73e8;"
            data-color="blue"
          ></button>
        </div>
        <p><strong>存储：</strong></p>
        <div class="product-info__options">
          <button class="option-btn option-btn--active">128GB</button>
          <button class="option-btn">256GB</button>
          <button class="option-btn">512GB</button>
        </div>
      </div>
      <div class="product-info__actions">
        <button class="btn-primary">立即购买</button>
        <button class="btn-secondary">加入购物车</button>
        <button class="btn-icon">♡ 收藏</button>
      </div>
      <div class="product-info__features">
        <h3>产品特点</h3>
        <ul>
          <li>✅ 高性能处理器，流畅体验</li>
          <li>✅ 5000mAh 大电池，全天续航</li>
          <li>✅ 6.7 英寸 AMOLED 屏幕，120Hz 刷新率</li>
          <li>✅ 108MP 三摄系统，夜景模式</li>
        </ul>
      </div>
    </div>

    <!-- 右侧：购买面板 -->
    <aside class="product-buy-panel">
      <div class="product-buy-panel__price">
        <span class="product-buy-panel__price-label">特价</span>
        <span class="product-buy-panel__price-value">¥2,999</span>
      </div>
      <div class="product-buy-panel__shipping">
        <p>🚚 免运费</p>
        <p>📅 预计 3 月 15 日送达</p>
      </div>
      <div class="product-buy-panel__stock">
        <span class="stock-badge stock-badge--in-stock">有货</span>
      </div>
      <div class="product-buy-panel__quantity">
        <label>数量：</label>
        <div class="quantity-selector">
          <button class="quantity-btn">−</button>
          <input type="text" value="1" class="quantity-input" readonly />
          <button class="quantity-btn">+</button>
        </div>
      </div>
      <button class="product-buy-panel__btn product-buy-panel__btn--primary">
        加入购物车
      </button>
      <button class="product-buy-panel__btn product-buy-panel__btn--outline">
        立即购买
      </button>
      <div class="product-buy-panel__sellers">
        <h4>其他卖家</h4>
        <div class="seller-item">
          <span>卖家 A</span>
          <span class="seller-price">¥3,099</span>
        </div>
      </div>
    </aside>
  </div>

  <!-- 底部：详情标签 -->
  <div class="product-tabs-section">
    <nav class="product-tabs">
      <button class="product-tab product-tab--active">商品详情</button>
      <button class="product-tab">规格参数</button>
      <button class="product-tab">用户评价 (2,345)</button>
      <button class="product-tab">售后保障</button>
    </nav>
    <div class="product-tab-content">
      <div class="product-detail-images">
        <img src="detail-1.jpg" alt="详情图 1" />
        <img src="detail-2.jpg" alt="详情图 2" />
        <img src="detail-3.jpg" alt="详情图 3" />
      </div>
    </div>
  </div>
</div>
```

```css
.product-page {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  color: #333;
}

/* 面包屑 */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 1rem 0;
  font-size: 0.875rem;
  color: #666;
  flex-wrap: wrap;
}

.breadcrumb a {
  color: #0066cc;
  text-decoration: none;
}

.breadcrumb a:hover {
  text-decoration: underline;
}

/* 主体三栏布局 */
.product-body {
  display: flex;
  gap: 24px;
  padding: 1rem 0 2rem;
}

/* 图片画廊 */
.product-gallery {
  flex: 0 0 480px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.product-gallery__main {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #eee;
}

.product-gallery__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.product-gallery__main:hover .product-gallery__image {
  transform: scale(1.05);
}

.product-gallery__badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: #e94560;
  color: #fff;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.product-gallery__thumbs {
  display: flex;
  gap: 0.5rem;
}

.product-gallery__thumb {
  width: 80px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.2s;
}

.product-gallery__thumb--active {
  border-color: #0066cc;
}

.product-gallery__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 产品信息 */
.product-info {
  flex: 1 1 auto;
  min-width: 0;
  padding-right: 1rem;
}

.product-info__title {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.4;
  margin: 0 0 0.75rem;
}

.product-info__rating {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.product-info__rating-text {
  color: #0066cc;
  font-size: 0.875rem;
}

.product-info__price-row {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #fff5f5;
  border-radius: 8px;
}

.product-info__price {
  font-size: 2rem;
  font-weight: 700;
  color: #e94560;
}

.product-info__original-price {
  font-size: 1rem;
  color: #999;
  text-decoration: line-through;
}

.product-info__discount {
  background: #e94560;
  color: #fff;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.product-info__meta {
  margin-bottom: 1.5rem;
}

.product-info__meta p {
  margin: 0.75rem 0 0.25rem;
  font-size: 0.875rem;
  color: #666;
}

.product-info__meta strong {
  color: #333;
}

/* 颜色选择 */
.product-info__colors {
  display: flex;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.color-swatch {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition:
    border-color 0.2s,
    transform 0.2s;
}

.color-swatch:hover {
  transform: scale(1.1);
}

.color-swatch--active {
  border-color: #0066cc;
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 4px #0066cc;
}

/* 规格选择 */
.product-info__options {
  display: flex;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.option-btn {
  padding: 0.5rem 1.25rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.option-btn:hover {
  border-color: #0066cc;
  color: #0066cc;
}

.option-btn--active {
  border-color: #0066cc;
  color: #0066cc;
  background: #f0f7ff;
}

/* 操作按钮 */
.product-info__actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.btn-primary {
  flex: 1;
  padding: 0.875rem 2rem;
  background: #e94560;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.1s;
}

.btn-primary:hover {
  background: #d63a54;
}

.btn-primary:active {
  transform: scale(0.98);
}

.btn-secondary {
  flex: 1;
  padding: 0.875rem 2rem;
  background: #fff;
  color: #e94560;
  border: 2px solid #e94560;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #fff5f5;
}

.btn-icon {
  padding: 0.875rem 1.25rem;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.btn-icon:hover {
  border-color: #e94560;
  color: #e94560;
}

/* 产品特点 */
.product-info__features {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.product-info__features h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.product-info__features ul {
  margin: 0;
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.product-info__features li {
  font-size: 0.875rem;
  color: #555;
}

/* 购买面板 */
.product-buy-panel {
  flex: 0 0 300px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: fit-content;
  position: sticky;
  top: 24px;
}

.product-buy-panel__price {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.product-buy-panel__price-label {
  font-size: 0.75rem;
  color: #e94560;
  background: #fff0f0;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

.product-buy-panel__price-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #e94560;
}

.product-buy-panel__shipping p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: #555;
}

.stock-badge--in-stock {
  color: #1a7f37;
  font-weight: 600;
  font-size: 0.875rem;
}

/* 数量选择器 */
.quantity-selector {
  display: inline-flex;
  align-items: center;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
}

.quantity-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: #f8f9fa;
  cursor: pointer;
  font-size: 1.25rem;
  transition: background 0.15s;
}

.quantity-btn:hover {
  background: #eee;
}

.quantity-input {
  width: 48px;
  height: 36px;
  border: none;
  border-left: 1px solid #ddd;
  border-right: 1px solid #ddd;
  text-align: center;
  font-size: 0.875rem;
}

.product-buy-panel__btn {
  width: 100%;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.product-buy-panel__btn--primary {
  background: #e94560;
  color: #fff;
  border: none;
}

.product-buy-panel__btn--primary:hover {
  background: #d63a54;
}

.product-buy-panel__btn--outline {
  background: #fff;
  color: #e94560;
  border: 1px solid #e94560;
}

.product-buy-panel__btn--outline:hover {
  background: #fff5f5;
}

.product-buy-panel__sellers {
  border-top: 1px solid #eee;
  padding-top: 1rem;
}

.product-buy-panel__sellers h4 {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  color: #666;
}

.seller-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  font-size: 0.875rem;
}

.seller-price {
  color: #e94560;
  font-weight: 600;
}

/* 底部标签区 */
.product-tabs-section {
  margin-top: 2rem;
  border-top: 1px solid #eee;
  padding-top: 1rem;
}

.product-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid #eee;
}

.product-tab {
  padding: 0.75rem 1.5rem;
  border: none;
  background: none;
  font-size: 0.875rem;
  color: #666;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition:
    color 0.2s,
    border-color 0.2s;
}

.product-tab:hover {
  color: #333;
}

.product-tab--active {
  color: #e94560;
  border-bottom-color: #e94560;
  font-weight: 600;
}

.product-detail-images {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 1rem;
}

.product-detail-images img {
  width: 100%;
  display: block;
}

/* 响应式 */
@media (max-width: 1200px) {
  .product-buy-panel {
    flex: 0 0 260px;
  }
}

@media (max-width: 1024px) {
  .product-body {
    flex-direction: column;
  }
  .product-gallery {
    flex: 0 0 auto;
    max-width: 500px;
  }
  .product-buy-panel {
    flex: 0 0 auto;
    position: static;
    max-width: 500px;
  }
}

@media (max-width: 768px) {
  .product-page {
    padding: 0 12px;
  }
  .product-gallery {
    flex: 0 0 auto;
    width: 100%;
  }
  .product-info__title {
    font-size: 1.25rem;
  }
  .product-info__price {
    font-size: 1.5rem;
  }
  .product-info__actions {
    flex-direction: column;
  }
  .product-gallery__thumbs {
    overflow-x: auto;
  }
  .product-gallery__thumb {
    flex-shrink: 0;
  }
}
```

**临摹要点:**

1. 三栏 Flexbox 布局：画廊 `flex: 0 0 480px` + 信息 `flex: 1` + 面板 `flex: 0 0 300px`
2. 图片画廊：主图 `aspect-ratio: 1/1` + 缩略图 `object-fit: cover`
3. 购买面板 `position: sticky` 实现滚动跟随
4. 颜色选择器：`box-shadow` 双层边框实现选中态
5. 响应式：1024px 折叠为单列，768px 按钮纵向排列

---

## 六、CSS 最佳实践速查

### Flexbox vs Grid 选择指南

| 场景                     | 推荐     | 原因                         |
| ------------------------ | -------- | ---------------------------- |
| 一维布局（行或列）       | Flexbox  | 更灵活，自动换行             |
| 二维布局（行+列）        | Grid     | 精确控制行列                 |
| 内容优先（内容决定大小） | Flexbox  | `flex: 1 1 auto` 自适应      |
| 布局优先（固定网格）     | Grid     | `grid-template-columns` 精确 |
| 导航栏/工具栏            | Flexbox  | 两端对齐、间距均等           |
| 卡片网格/仪表盘          | Grid     | `auto-fill` + `minmax`       |
| 圣杯布局                 | 两者皆可 | Grid 用 areas 更直观         |
| 组件内部布局             | Flexbox  | 嵌套更自然                   |

### 动画性能优化

```css
/* ✅ 只变换 transform 和 opacity（GPU 加速） */
.good-animation {
  transition:
    transform 0.3s,
    opacity 0.3s;
}

/* ❌ 避免变换 width/height/top/left（触发重排） */
.bad-animation {
  transition:
    width 0.3s,
    top 0.3s;
}

/* ✅ 使用 will-change 提示浏览器优化 */
.will-animate {
  will-change: transform, opacity;
}

/* ✅ 使用 transform 代替 top/left */
.move-with-transform {
  transform: translateX(100px); /* 不触发重排 */
}

.move-with-position {
  left: 100px; /* 触发重排，性能差 */
}
```

### 响应式断点参考

```css
/* 移动优先（Mobile First） */
/* 基础样式 = 移动端 */

/* 平板竖屏 */
@media (min-width: 480px) {
}

/* 平板横屏 / 小笔记本 */
@media (min-width: 768px) {
}

/* 桌面 */
@media (min-width: 1024px) {
}

/* 大桌面 */
@media (min-width: 1280px) {
}

/* 超大屏 */
@media (min-width: 1536px) {
}
```

---

## 七、专项总结

### 本次产出

| 类别         | 数量          | 说明                                                  |
| ------------ | ------------- | ----------------------------------------------------- |
| Flexbox 示例 | 10 个         | 圣杯布局、卡片行、导航栏、居中、画廊、聊天、表单等    |
| Grid 示例    | 8 个          | 圣杯、自动填充、仪表盘、杂志、嵌套、覆盖层等          |
| 动画示例     | 6 个          | 关键帧、过渡、3D 翻转、滚动触发、自定义属性、组合动画 |
| 响应式示例   | 6 个          | 流体排版、容器查询、抽屉导航、响应式图片/间距/表格    |
| 复杂布局临摹 | 3 个          | Notion 编辑器、GitHub 仓库页、电商产品详情页          |
| **总计**     | **33 个示例** | 远超 20+ 目标 ✅                                      |

### 核心技能掌握

1. **Flexbox**: `flex` 简写、`justify-content`/`align-items`、`order`、`align-self`、`min-width: 0` 溢出修复
2. **CSS Grid**: `grid-template-areas`、`repeat(auto-fill, minmax())`、`span`、`1 / -1` 全宽、隐式网格、命名网格线
3. **动画**: `@keyframes`、`transition`、`transform`、`perspective`、`backface-visibility`、`cubic-bezier`、`will-change`
4. **响应式**: `clamp()` 流体排版、容器查询、`min()` 容器模式、逻辑属性、移动优先策略

### 临摹收获

1. **Notion**: 侧边栏折叠动画、宽边距设计、Callout 组件、flex 主布局
2. **GitHub**: 12 列栅格思维、Tab 导航 + badge、文件表格 hover、语言占比条、响应式隐藏侧边栏
3. **电商**: 三栏布局 + sticky 面板、颜色/规格选择器、价格展示、数量选择器、移动端折叠

---

_CSS 深度专项训练完成 ✅_
_下次建议：TypeScript 类型系统专项（高难度，需 2h）_
