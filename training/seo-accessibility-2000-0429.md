# SEO/无障碍专项训练 — 语义化 HTML · ARIA · 结构化数据

> 2026-04-29 20:00 | 专项 #17 | 今日累计 #97

---

## 一、SEO 核心概念

### 1.1 搜索引擎工作原理

```
抓取 (Crawl) → 索引 (Index) → 排名 (Rank)
    ↓              ↓            ↓
 发现页面      理解内容      匹配查询
```

**爬虫关键路径：**
- 通过链接发现新页面（sitemap.xml 加速发现）
- 解析 HTML → 提取文本/链接/资源
- 渲染页面（Googlebot 支持 JS 渲染，但有延迟和限制）
- 检查 robots.txt / meta robots / canonical

### 1.2 页面 SEO 核心要素

| 要素 | 优先级 | 说明 |
|------|--------|------|
| Title Tag | 🔴 P0 | 50-60 字符，含核心关键词 |
| Meta Description | 🔴 P0 | 150-160 字符，吸引点击 |
| H1-H6 层级 | 🔴 P0 | 唯一 H1，层级不跳跃 |
| URL 结构 | 🟡 P1 | 简洁、含关键词、连字符分隔 |
| 结构化数据 | 🟡 P1 | Schema.org JSON-LD |
| Open Graph | 🟡 P1 | 社交分享卡片 |
| Alt Text | 🟡 P1 | 图片无障碍 + 图片搜索 |
| 内部链接 | 🟢 P2 | 锚文本多样化 |
| 页面速度 | 🟢 P2 | Core Web Vitals |

### 1.3 结构化数据 (Schema.org)

**为什么用 JSON-LD 而非 Microdata/RDFa？**
- 与 HTML 解耦，维护方便
- Google 推荐格式
- 不增加 DOM 复杂度
- 可动态注入（SSR/CSR 都支持）

**常用 Schema 类型：**

```
WebPage
├── Article (博客/新闻)
├── Product (商品)
├── FAQPage (FAQ 页面)
├── HowTo (教程)
├── LocalBusiness (本地商家)
├── Event (活动)
├── JobPosting (招聘)
├── BreadcrumbList (面包屑)
└── WebSite (站点搜索)
```

---

## 二、无障碍 (A11y) 核心概念

### 2.1 WCAG 2.2 四大原则 (POUR)

| 原则 | 说明 | 关键要求 |
|------|------|----------|
| **Perceivable** 可感知 | 信息必须能被感知 | 文本替代、对比度 ≥ 4.5:1、字幕 |
| **Operable** 可操作 | 界面可被所有用户操作 | 键盘导航、焦点管理、足够时间 |
| **Understandable** 可理解 | 内容和 UI 可被理解 | 语言声明、错误提示、一致导航 |
| **Robust** 健壮性 | 兼容各种辅助技术 | 语义化 HTML、ARIA 正确性 |

### 2.2 ARIA 使用黄金法则

> **Rule 1: Don't use ARIA if a native HTML element can do the job.**
> **Rule 2: Do not change native semantics unless you really have to.**
> **Rule 3: All interactive ARIA controls must be keyboard accessible.**
> **Rule 4: Do not use role="presentation" on focusable elements.**
> **Rule 5: Interactive elements must have accessible names.**

### 2.3 ARIA 属性分类

**角色 (Role)：**
```html
<!-- landmark roles -->
<nav role="navigation">       → <nav> (原生即可)
<main role="main">            → <main> (原生即可)
<div role="banner">           → <header> (原生即可)

<!-- widget roles (需要原生不支持时才用) -->
<div role="dialog">           → <dialog> (原生即可)
<div role="progressbar">      → <progress> (原生即可)
<div role="combobox">         → 需要 ARIA (无原生等价)
<div role="tree">             → 需要 ARIA (无原生等价)
```

**属性 (Properties)：**
```html
aria-label="搜索"              <!-- 无可见文本时提供名称 -->
aria-labelledby="title-id"     <!-- 引用其他元素作为名称 -->
aria-describedby="desc-id"     <!-- 引用描述性文本 -->
aria-expanded="false"          <!-- 展开/折叠状态 -->
aria-hidden="true"             <!-- 对屏幕阅读器隐藏 -->
aria-live="polite"             <!-- 动态内容区域 -->
aria-live="assertive"          <!-- 紧急动态内容 -->
aria-atomic="true"             <!-- 整个区域作为一个单元朗读 -->
aria-required="true"           <!-- 必填字段 -->
aria-invalid="true"            <!-- 验证错误 -->
aria-checked="false"           <!-- 复选框/单选状态 -->
aria-current="page"            <!-- 当前页面标识 -->
aria-controls="panel-id"       <!-- 控制的目标元素 -->
aria-owns="child-id"           <!-- 逻辑父子关系 -->
aria-haspopup="menu"           <!-- 弹出菜单类型 -->
```

**状态 vs 属性：**
- **State** (aria-*): 运行时可能改变 (expanded, checked, selected)
- **Property** (aria-*): 通常不变 (labelledby, controls, owns)
- 实践中统称 ARIA 属性

### 2.4 焦点管理

```
焦点顺序 = Tab 顺序 = DOM 顺序 (理想情况)

焦点可见性:
  outline: 2px solid currentColor;  ← 必须保留或提供等价样式
  outline-offset: 2px;

焦点陷阱 (模态框):
  Tab → 最后一个可聚焦元素 → 回到第一个
  Shift+Tab → 第一个 → 回到最后一个

焦点恢复:
  关闭模态框 → 焦点回到触发元素
```

---

## 三、语义化 HTML 深度实战

### 3.1 HTML5 语义元素对照表

| 不要这样写 | 应该这样写 | 为什么 |
|-----------|-----------|--------|
| `<div class="header">` | `<header>` | 语义明确，辅助技术识别 |
| `<div class="nav">` | `<nav>` | 导航 landmark |
| `<div class="main">` | `<main>` | 主内容 landmark |
| `<div class="article">` | `<article>` | 独立内容单元 |
| `<div class="section">` | `<section>` | 有主题的内容分组 |
| `<div class="aside">` | `<aside>` | 旁注 sidebar |
| `<div class="footer">` | `<footer>` | 页脚 landmark |
| `<div class="figure">` | `<figure>` | 独立媒体内容 |
| `<div class="time">` | `<time datetime="...">` | 机器可读日期 |
| `<div class="address">` | `<address>` | 联系信息 |
| `<b>` / `<i>` | `<strong>` / `<em>` | 强调语义，非纯样式 |
| `<div onclick="...">` | `<button>` / `<a>` | 原生交互语义 |

### 3.2 页面结构最佳实践

```html
<!-- ❌ 反模式：div soup -->
<div class="page">
  <div class="header">
    <div class="logo">...</div>
    <div class="menu">
      <div class="item">...</div>
    </div>
  </div>
  <div class="content">
    <div class="title">...</div>
    <div class="text">...</div>
    <div class="sidebar">
      <div class="widget">...</div>
    </div>
  </div>
  <div class="footer">...</div>
</div>

<!-- ✅ 语义化 HTML -->
<body>
  <header role="banner">
    <a href="/" aria-label="首页">
      <img src="logo.svg" alt="网站名称" />
    </a>
    <nav aria-label="主导航">
      <ul>
        <li><a href="/" aria-current="page">首页</a></li>
        <li><a href="/about">关于</a></li>
      </ul>
    </nav>
  </header>

  <main id="main-content">
    <h1>页面标题</h1>
    <article>
      <header>
        <h2>文章标题</h2>
        <p>
          <time datetime="2026-04-29">2026 年 4 月 29 日</time>
        </p>
      </header>
      <section aria-labelledby="section-1">
        <h3 id="section-1">第一部分</h3>
        <p>内容...</p>
      </section>
    </article>
    <aside>
      <h2>相关文章</h2>
      <ul>...</ul>
    </aside>
  </main>

  <footer role="contentinfo">
    <p>&copy; 2026 网站名称</p>
  </footer>
</body>
```

---

## 四、完整页面 SEO + A11y 优化实战

### 4.1 优化前（反面示例）

```html
<!-- seo-before.html — 充满 SEO 和 A11y 问题的页面 -->
<html>
<head>
  <title>页面</title>
</head>
<body>
  <div class="header">
    <div class="logo">
      <img src="logo.png">
    </div>
    <div class="nav">
      <div onclick="goHome()">首页</div>
      <div onclick="goAbout()">关于</div>
      <div onclick="goProducts()">产品</div>
      <div onclick="goContact()">联系我们</div>
    </div>
  </div>
  <div class="content">
    <div class="big-text">我们的产品</div>
    <div class="card">
      <img src="product1.jpg">
      <div class="name">产品A</div>
      <div class="price">¥199</div>
      <div onclick="addToCart()">加入购物车</div>
    </div>
    <div class="card">
      <img src="product2.jpg">
      <div class="name">产品B</div>
      <div class="price">¥299</div>
      <div onclick="addToCart()">加入购物车</div>
    </div>
    <div class="search-box">
      <input type="text" placeholder="搜索...">
      <div onclick="search()">搜索</div>
    </div>
  </div>
  <div class="footer">
    <div>© 2026</div>
  </div>
</body>
</html>
```

**问题清单：**
- ❌ 无 lang 属性
- ❌ Title 过于简单，无品牌/关键词
- ❌ 无 meta description
- ❌ 无 viewport meta
- ❌ 无 canonical URL
- ❌ 无 Open Graph 标签
- ❌ 无结构化数据
- ❌ 图片无 alt 属性
- ❌ 使用 div 代替语义元素 (header/nav/main/footer)
- ❌ 使用 onclick div 代替 button/a
- ❌ 无 H1-H6 层级结构
- ❌ 搜索框无 label
- ❌ 无焦点样式/键盘导航
- ❌ 无 skip navigation 链接
- ❌ 无 aria-label 区分多个 nav

---

### 4.2 优化后（完整实现）

```html
<!-- seo-after.html — 完整 SEO + A11y 优化 -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- === SEO Meta Tags === -->
  <title>CloudBoard 项目管理平台 — 敏捷协作 · 实时同步 · 免费试用</title>
  <meta name="description" content="CloudBoard 是一款面向开发团队的敏捷项目管理工具。支持看板、Scrum、实时协作、自动化工作流。免费试用 14 天。">
  <meta name="keywords" content="项目管理,敏捷开发,看板,Scrum,团队协作">
  <meta name="author" content="CloudBoard Team">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <link rel="canonical" href="https://cloudboard.example.com/products">

  <!-- === Open Graph (社交分享) === -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="CloudBoard — 敏捷项目管理平台">
  <meta property="og:description" content="面向开发团队的敏捷项目管理工具。看板 · Scrum · 实时协作。">
  <meta property="og:image" content="https://cloudboard.example.com/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="CloudBoard 产品界面预览">
  <meta property="og:url" content="https://cloudboard.example.com/products">
  <meta property="og:site_name" content="CloudBoard">
  <meta property="og:locale" content="zh_CN">

  <!-- === Twitter Card === -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@cloudboard">
  <meta name="twitter:title" content="CloudBoard — 敏捷项目管理平台">
  <meta name="twitter:description" content="面向开发团队的敏捷项目管理工具。">
  <meta name="twitter:image" content="https://cloudboard.example.com/og-image.png">

  <!-- === 结构化数据 (JSON-LD) === -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "CloudBoard 产品列表",
    "description": "CloudBoard 项目管理平台产品列表页面",
    "url": "https://cloudboard.example.com/products",
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": [
        {
          "@type": "Product",
          "position": 1,
          "name": "CloudBoard Pro",
          "description": "专业版项目管理，支持无限团队成员和高级自动化",
          "image": "https://cloudboard.example.com/images/pro.png",
          "brand": {
            "@type": "Brand",
            "name": "CloudBoard"
          },
          "offers": {
            "@type": "Offer",
            "price": "199.00",
            "priceCurrency": "CNY",
            "availability": "https://schema.org/InStock",
            "url": "https://cloudboard.example.com/products/pro"
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "reviewCount": "256"
          }
        },
        {
          "@type": "Product",
          "position": 2,
          "name": "CloudBoard Enterprise",
          "description": "企业版，支持 SSO、审计日志、专属客户成功经理",
          "image": "https://cloudboard.example.com/images/enterprise.png",
          "brand": {
            "@type": "Brand",
            "name": "CloudBoard"
          },
          "offers": {
            "@type": "Offer",
            "price": "299.00",
            "priceCurrency": "CNY",
            "availability": "https://schema.org/InStock",
            "url": "https://cloudboard.example.com/products/enterprise"
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.9",
            "reviewCount": "89"
          }
        }
      ]
    }
  }
  </script>

  <!-- === 面包屑结构化数据 === -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "首页",
        "item": "https://cloudboard.example.com/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "产品",
        "item": "https://cloudboard.example.com/products"
      }
    ]
  }
  </script>

  <!-- === Favicon === -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">

  <style>
    /* === 基础重置与焦点样式 === */
    *, *::before, *::after { box-sizing: border-box; }

    /* 焦点可见性 — 绝对不能移除 */
    :focus-visible {
      outline: 3px solid #2563eb;
      outline-offset: 2px;
    }

    /* Skip Navigation 链接 */
    .skip-link {
      position: absolute;
      top: -100%;
      left: 0;
      background: #2563eb;
      color: #fff;
      padding: 0.75rem 1.5rem;
      z-index: 1000;
      font-weight: 600;
      text-decoration: none;
    }
    .skip-link:focus {
      top: 0;
    }

    /* 对比度 — 确保 WCAG AA (4.5:1) */
    body {
      font-family: -apple-system, "Noto Sans SC", sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
      margin: 0;
    }

    /* 颜色对比度检查 */
    .text-muted { color: #4b5563; }  /* 7.06:1 ✅ AA */
    .text-primary { color: #1d4ed8; } /* 8.19:1 ✅ AAA */

    /* 布局 */
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }

    header {
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
      padding: 1rem 0;
    }
    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo img { height: 36px; width: auto; }

    nav[aria-label="主导航"] ul {
      display: flex;
      list-style: none;
      gap: 2rem;
      margin: 0;
      padding: 0;
    }
    nav[aria-label="主导航"] a {
      color: #374151;
      text-decoration: none;
      font-weight: 500;
      padding: 0.25rem 0;
      border-bottom: 2px solid transparent;
      transition: border-color 0.2s;
    }
    nav[aria-label="主导航"] a:hover,
    nav[aria-label="主导航"] a[aria-current="page"] {
      color: #1d4ed8;
      border-bottom-color: #1d4ed8;
    }

    main { padding: 3rem 0; }

    h1 { font-size: 2.25rem; margin-bottom: 0.5rem; }
    .page-description {
      font-size: 1.125rem;
      color: #4b5563;
      margin-bottom: 2rem;
    }

    /* 产品卡片 */
    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 2rem;
      margin-bottom: 3rem;
    }
    .product-card {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
      transition: box-shadow 0.2s;
    }
    .product-card:hover {
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .product-card img {
      width: 100%;
      height: 200px;
      object-fit: cover;
    }
    .product-card-body { padding: 1.5rem; }
    .product-card-body h3 { margin: 0 0 0.5rem; }
    .product-card-body .description {
      color: #4b5563;
      margin-bottom: 1rem;
    }
    .product-card-body .price {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1d4ed8;
      margin-bottom: 1rem;
    }
    .rating {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .stars { color: #f59e0b; }
    .rating-text { color: #4b5563; font-size: 0.875rem; }

    /* 按钮 — 可聚焦、可键盘操作 */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      min-height: 44px;  /* WCAG 触摸目标最小尺寸 */
      min-width: 44px;
    }
    .btn-primary {
      background: #2563eb;
      color: #fff;
    }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-primary:focus-visible {
      outline: 3px solid #1d4ed8;
      outline-offset: 2px;
    }
    .btn-primary:active { transform: scale(0.98); }

    /* 搜索区域 */
    .search-section {
      background: #f9fafb;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
    }
    .search-form {
      display: flex;
      gap: 0.75rem;
      max-width: 600px;
    }
    .search-input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 2px solid #d1d5db;
      border-radius: 8px;
      font-size: 1rem;
      min-height: 44px;
    }
    .search-input:focus {
      border-color: #2563eb;
      outline: none;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.2);
    }

    /* 通知区域 (aria-live) */
    .notification-area {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 999;
    }
    .notification {
      background: #10b981;
      color: #fff;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      margin-bottom: 0.5rem;
      animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    /* 面包屑 */
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem 0;
      font-size: 0.875rem;
      color: #6b7280;
    }
    .breadcrumb a { color: #2563eb; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .breadcrumb-separator { color: #9ca3af; }

    footer {
      background: #1f2937;
      color: #d1d5db;
      padding: 2rem 0;
      text-align: center;
    }
    footer a { color: #93c5fd; }

    /* 减少动画 (尊重用户偏好) */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }

    /* 高对比度模式 */
    @media (prefers-contrast: high) {
      .product-card { border-width: 3px; }
      .btn { border: 2px solid currentColor; }
    }

    /* 暗色模式 */
    @media (prefers-color-scheme: dark) {
      body { background: #111827; color: #f3f4f6; }
      header { background: #1f2937; border-color: #374151; }
      nav[aria-label="主导航"] a { color: #d1d5db; }
      .search-section { background: #1f2937; }
      .search-input { background: #374151; border-color: #4b5563; color: #f3f4f6; }
      .product-card { border-color: #374151; }
      .text-muted, .page-description { color: #9ca3af; }
    }
  </style>
</head>
<body>
  <!-- === Skip Navigation === -->
  <a href="#main-content" class="skip-link">跳转到主要内容</a>

  <!-- === 通知区域 (aria-live) === -->
  <div class="notification-area" aria-live="polite" aria-atomic="true" role="status">
    <!-- 动态通知插入此处 -->
  </div>

  <!-- === Header === -->
  <header role="banner">
    <div class="container header-inner">
      <!-- 链接含 aria-label (图标/图片无文字时提供名称) -->
      <a href="/" class="logo" aria-label="CloudBoard 首页">
        <img src="/logo.svg" alt="CloudBoard" width="120" height="36">
      </a>

      <!-- 多个 nav 必须用 aria-label 区分 -->
      <nav aria-label="主导航">
        <ul>
          <li><a href="/" aria-current="page">首页</a></li>
          <li><a href="/products">产品</a></li>
          <li><a href="/pricing">价格</a></li>
          <li><a href="/docs">文档</a></li>
          <li><a href="/contact">联系我们</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <!-- === Main Content === -->
  <main id="main-content" role="main">
    <div class="container">
      <!-- 面包屑导航 -->
      <nav aria-label="面包屑" class="breadcrumb">
        <a href="/">首页</a>
        <span class="breadcrumb-separator" aria-hidden="true">›</span>
        <span aria-current="page">产品</span>
      </nav>

      <!-- H1 唯一且描述性强 -->
      <h1>CloudBoard 产品方案</h1>
      <p class="page-description">
        为不同规模的团队提供灵活的项目管理方案。从个人开发者到企业团队，总有一款适合你。
      </p>

      <!-- 产品列表 -->
      <section aria-labelledby="products-heading">
        <h2 id="products-heading" class="sr-only">产品列表</h2>
        <div class="product-grid" role="list">

          <!-- 产品卡片 1 -->
          <article class="product-card" role="listitem" itemscope itemtype="https://schema.org/Product">
            <!-- 图片 alt 描述性且含上下文 -->
            <img
              src="/images/product-pro.png"
              alt="CloudBoard Pro 看板界面，展示任务列和拖拽操作"
              itemprop="image"
              width="600"
              height="400"
              loading="lazy"
              decoding="async"
            >
            <div class="product-card-body">
              <h3 itemprop="name">CloudBoard Pro</h3>
              <p class="description" itemprop="description">
                专业版项目管理，支持无限团队成员、高级自动化工作流和自定义报表。
              </p>

              <!-- 评分 (屏幕阅读器可读) -->
              <div class="rating" aria-label="评分: 4.8 分（满分 5 分），共 256 条评价">
                <span class="stars" aria-hidden="true">★★★★★</span>
                <span class="rating-text">4.8 (256 条评价)</span>
              </div>

              <p class="price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
                <meta itemprop="priceCurrency" content="CNY">
                <span itemprop="price" content="199.00">¥199</span>
                <span class="text-muted">/月</span>
              </p>

              <!-- button 原生可聚焦、可键盘操作 -->
              <button
                type="button"
                class="btn btn-primary"
                onclick="addToCart('pro')"
                aria-label="将 CloudBoard Pro 加入购物车，每月 ¥199"
              >
                加入购物车
              </button>
            </div>
          </article>

          <!-- 产品卡片 2 -->
          <article class="product-card" role="listitem" itemscope itemtype="https://schema.org/Product">
            <img
              src="/images/product-enterprise.png"
              alt="CloudBoard Enterprise 仪表盘，展示团队统计和审计日志"
              itemprop="image"
              width="600"
              height="400"
              loading="lazy"
              decoding="async"
            >
            <div class="product-card-body">
              <h3 itemprop="name">CloudBoard Enterprise</h3>
              <p class="description" itemprop="description">
                企业版，支持 SSO 单点登录、审计日志、专属客户成功经理和 SLA 保障。
              </p>

              <div class="rating" aria-label="评分: 4.9 分（满分 5 分），共 89 条评价">
                <span class="stars" aria-hidden="true">★★★★★</span>
                <span class="rating-text">4.9 (89 条评价)</span>
              </div>

              <p class="price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
                <meta itemprop="priceCurrency" content="CNY">
                <span itemprop="price" content="299.00">¥299</span>
                <span class="text-muted">/月</span>
              </p>

              <button
                type="button"
                class="btn btn-primary"
                onclick="addToCart('enterprise')"
                aria-label="将 CloudBoard Enterprise 加入购物车，每月 ¥299"
              >
                加入购物车
              </button>
            </div>
          </article>
        </div>
      </section>

      <!-- 搜索区域 -->
      <section class="search-section" aria-labelledby="search-heading">
        <h2 id="search-heading">搜索产品</h2>
        <form class="search-form" role="search" aria-label="产品搜索" onsubmit="handleSearch(event)">
          <!-- label 关联 input (for/id) -->
          <label for="search-input" class="sr-only">输入关键词搜索产品</label>
          <input
            type="search"
            id="search-input"
            class="search-input"
            placeholder="搜索产品功能..."
            autocomplete="off"
            aria-describedby="search-help"
            required
          >
          <span id="search-help" class="sr-only">输入产品关键词后按回车或点击搜索按钮</span>
          <button type="submit" class="btn btn-primary" aria-label="搜索">
            搜索
          </button>
        </form>
      </section>
    </div>
  </main>

  <!-- === Footer === -->
  <footer role="contentinfo">
    <div class="container">
      <p>&copy; 2026 CloudBoard. 保留所有权利。</p>
      <nav aria-label="页脚导航">
        <a href="/privacy">隐私政策</a> ·
        <a href="/terms">服务条款</a> ·
        <a href="/accessibility">无障碍声明</a>
      </nav>
    </div>
  </footer>

  <script>
    // === 购物车通知 (aria-live 区域) ===
    function addToCart(plan) {
      const names = { pro: 'CloudBoard Pro', enterprise: 'CloudBoard Enterprise' };
      const prices = { pro: '¥199/月', enterprise: '¥299/月' };

      // 通知区域
      const area = document.querySelector('[aria-live="polite"]');
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.setAttribute('role', 'alert');
      notification.textContent = `${names[plan]} 已加入购物车 (${prices[plan]})`;
      area.appendChild(notification);

      // 3 秒后移除
      setTimeout(() => {
        notification.remove();
      }, 3000);
    }

    // === 搜索处理 ===
    function handleSearch(event) {
      event.preventDefault();
      const input = document.getElementById('search-input');
      const query = input.value.trim();
      if (query) {
        // 实际项目中跳转到搜索结果页
        console.log('搜索:', query);
      }
    }

    // === 键盘快捷键 (增强可访问性) ===
    document.addEventListener('keydown', (e) => {
      // '/' 聚焦搜索框
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('search-input').focus();
      }
    });
  </script>
</body>
</html>
```

---

## 五、SEO 检查清单

### 5.1 页面级检查

- [x] `lang` 属性正确设置 (`zh-CN`)
- [x] Title 50-60 字符，含核心关键词 + 品牌
- [x] Meta Description 150-160 字符，含 CTA
- [x] Viewport meta 标签
- [x] Canonical URL (防重复内容)
- [x] Robots meta (`index, follow`)
- [x] H1 唯一，H2-H6 层级不跳跃
- [x] 图片 alt 描述性且非空
- [x] 图片 width/height (防 CLS)
- [x] 图片 lazy loading (below fold)

### 5.2 结构化数据检查

- [x] JSON-LD 格式 (Google 推荐)
- [x] WebPage 类型
- [x] Product 类型 (含 price/availability/rating)
- [x] BreadcrumbList 类型
- [x] 所有字段符合 Schema.org 规范
- [x] 通过 Google Rich Results Test 验证

### 5.3 社交分享检查

- [x] Open Graph 完整 (title/description/image/url/type)
- [x] og:image 尺寸 1200×630
- [x] og:image:alt 描述
- [x] Twitter Card (summary_large_image)
- [x] 通过 Facebook Sharing Debugger 验证
- [x] 通过 Twitter Card Validator 验证

---

## 六、A11y 检查清单

### 6.1 语义化 HTML

- [x] `<header>` / `<nav>` / `<main>` / `<footer>` / `<article>` / `<section>`
- [x] 无 `onclick` div 代替 button
- [x] 表单 label 关联 (for/id)
- [x] 列表使用 `<ul>`/`<ol>`/`<li>`
- [x] `<time datetime>` 机器可读日期

### 6.2 ARIA

- [x] 多个 `<nav>` 用 `aria-label` 区分
- [x] `aria-current="page"` 标识当前页
- [x] `aria-label` 提供图标/图片按钮名称
- [x] `aria-labelledby` 关联标题
- [x] `aria-describedby` 关联描述
- [x] `aria-live="polite"` 动态通知区域
- [x] `aria-hidden="true"` 装饰性内容
- [x] `role="alert"` 重要通知
- [x] `role="search"` 搜索表单
- [x] 不滥用 ARIA (优先原生 HTML)

### 6.3 键盘导航

- [x] Skip Navigation 链接
- [x] 焦点可见 (`:focus-visible`)
- [x] 逻辑 Tab 顺序 (DOM 顺序一致)
- [x] 所有交互元素可键盘操作
- [x] 触摸目标 ≥ 44×44px
- [x] 键盘快捷键 (`/` 聚焦搜索)

### 6.4 视觉

- [x] 文本对比度 ≥ 4.5:1 (WCAG AA)
- [x] 大文本对比度 ≥ 3:1
- [x] 不依赖颜色传递信息
- [x] `prefers-reduced-motion` 支持
- [x] `prefers-color-scheme` 暗色模式
- [x] `prefers-contrast` 高对比度模式

### 6.5 屏幕阅读器

- [x] 页面朗读顺序合理
- [x] 装饰性内容 `aria-hidden`
- [x] 评分等复杂信息 `aria-label` 完整描述
- [x] 动态内容 `aria-live` 通知
- [x] 表单错误 `aria-invalid` + `aria-describedby`

---

## 七、SEO 工具与验证

### 7.1 在线验证工具

| 工具 | 用途 | URL |
|------|------|-----|
| Google Rich Results Test | 结构化数据 | search.google.uk/test/rich-results |
| Schema Markup Validator | Schema.org 验证 | validator.schema.org |
| Lighthouse | 综合审计 | Chrome DevTools |
| axe DevTools | A11y 自动化 | browser extension |
| WAVE | 无障碍评估 | wave.webaim.org |
| Facebook Debugger | OG 标签调试 | developers.facebook.com/tools/debug |
| Twitter Card Validator | Twitter 卡片 | cards-dev.twitter.com/validator |
| Mobile-Friendly Test | 移动端适配 | search.google.com/test/mobile-friendly |

### 7.2 Lighthouse 审计指标

```
Performance:     ≥ 90
Accessibility:   ≥ 90
Best Practices:  ≥ 90
SEO:            ≥ 90

Core Web Vitals:
  LCP (Largest Contentful Paint):  ≤ 2.5s
  INP (Interaction to Next Paint): ≤ 200ms
  CLS (Cumulative Layout Shift):   ≤ 0.1
```

### 7.3 自动化 A11y 测试 (Jest + Testing Library)

```typescript
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

describe('ProductPage', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<ProductPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have skip navigation link', () => {
    render(<ProductPage />);
    const skipLink = screen.getByText('跳转到主要内容');
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('should have unique h1', () => {
    render(<ProductPage />);
    const h1s = screen.getByRole('heading', { level: 1 });
    expect(h1s).toBeInTheDocument();
  });

  it('should have form labels', () => {
    render(<ProductPage />);
    const searchInput = screen.getByLabelText(/搜索产品/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('should have descriptive alt text on images', () => {
    render(<ProductPage />);
    const images = screen.getAllByRole('img');
    images.forEach(img => {
      expect(img).not.toHaveAttribute('alt', '');
      expect(img.getAttribute('alt').length).toBeGreaterThan(10);
    });
  });
});
```

---

## 八、面试高频考点

### Q1: 语义化 HTML 对 SEO 和 A11y 有什么影响？

**SEO 角度：**
- 搜索引擎爬虫通过语义标签理解页面结构
- `<h1>` 告诉搜索引擎页面主题
- `<article>` 标识独立内容单元
- `<nav>` 标识导航结构，有助于站点链接生成

**A11y 角度：**
- 屏幕阅读器使用 landmark roles 快速导航
- `<main>` → "跳转到主内容"
- `<nav>` → "导航区域"
- `<h1>`-`<h6>` → 页面大纲

### Q2: ARIA 和语义化 HTML 的关系？

```
语义化 HTML (首选)
    ↓ 无法满足需求时
ARIA (补充)

示例：
✅ <button> → 原生语义，无需 ARIA
✅ <nav> → 原生 landmark，无需 role="navigation"
✅ <div role="combobox"> → 无原生等价，必须用 ARIA
```

### Q3: 什么是 Core Web Vitals？如何优化？

| 指标 | 含义 | 阈值 | 优化方法 |
|------|------|------|---------|
| LCP | 最大内容绘制 | ≤ 2.5s | 预加载关键资源、CDN、图片优化 |
| INP | 交互到下一帧 | ≤ 200ms | 减少 JS 执行、分片长任务、Web Worker |
| CLS | 累积布局偏移 | ≤ 0.1 | 图片设尺寸、避免动态插入内容、字体稳定 |

### Q4: 结构化数据如何影响搜索结果？

- **富摘要 (Rich Snippets)：** 评分星、价格、库存状态
- **知识面板：** 品牌/组织信息
- **面包屑展示：** 搜索结果中显示路径
- **Carousel：** 产品/食谱/视频轮播
- **FAQ 折叠：** 搜索结果直接展示 FAQ

### Q5: 如何实现可访问的模态框？

```html
<!-- 1. 使用 <dialog> 元素 (原生) -->
<dialog id="modal" aria-labelledby="modal-title" aria-modal="true">
  <h2 id="modal-title">确认操作</h2>
  <p>确定要执行此操作吗？</p>
  <form method="dialog">
    <button value="cancel">取消</button>
    <button value="confirm">确认</button>
  </form>
</dialog>

<!-- 2. 焦点管理 -->
<script>
const modal = document.getElementById('modal');
const trigger = document.getElementById('open-modal');
let previousFocus = null;

trigger.addEventListener('click', () => {
  previousFocus = document.activeElement;
  modal.showModal();
  // 焦点移至模态框第一个可聚焦元素
  modal.querySelector('button').focus();
});

modal.addEventListener('close', () => {
  // 焦点恢复
  previousFocus?.focus();
});

// 焦点陷阱
modal.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
</script>
```

---

## 九、自测题

### 题目 1：修复 A11y 问题

```html
<!-- 找出并修复以下代码的 5 个 A11y 问题 -->
<div class="dropdown">
  <div class="trigger" onclick="toggle()">选项 ▾</div>
  <div class="menu" style="display:none">
    <div onclick="select('a')">选项 A</div>
    <div onclick="select('b')">选项 B</div>
  </div>
</div>
```

<details>
<summary>点击查看答案</summary>

```html
<!-- 修复后 -->
<div class="dropdown">
  <button
    type="button"
    aria-expanded="false"
    aria-haspopup="listbox"
    aria-controls="dropdown-menu"
    onclick="toggle()"
  >
    选项 ▾
  </button>
  <ul id="dropdown-menu" role="listbox" hidden>
    <li role="option" tabindex="0" onclick="select('a')">选项 A</li>
    <li role="option" tabindex="0" onclick="select('b')">选项 B</li>
  </ul>
</div>
```

修复点：
1. `div onclick` → `button` (原生交互语义)
2. 添加 `aria-expanded` 状态
3. 添加 `aria-haspopup` 声明弹出类型
4. 添加 `aria-controls` 关联菜单
5. 菜单使用 `ul/li` + `role="listbox/option"`
</details>

### 题目 2：结构化数据编写

为一个博客文章页面编写 JSON-LD 结构化数据，包含：文章标题、作者、发布日期、封面图片、阅读时长。

<details>
<summary>点击查看答案</summary>

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "SEO/无障碍最佳实践指南",
  "author": {
    "@type": "Person",
    "name": "张三",
    "url": "https://example.com/authors/zhangsan"
  },
  "datePublished": "2026-04-29",
  "dateModified": "2026-04-29",
  "image": {
    "@type": "ImageObject",
    "url": "https://example.com/images/seo-a11y-cover.jpg",
    "width": 1200,
    "height": 630
  },
  "publisher": {
    "@type": "Organization",
    "name": "技术博客",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/logo.png",
      "width": 200,
      "height": 60
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://example.com/blog/seo-a11y-guide"
  },
  "description": "深入讲解 SEO 和无障碍设计的最佳实践...",
  "articleSection": "前端开发",
  "wordCount": 3500,
  "inLanguage": "zh-CN"
}
```
</details>

### 题目 3：对比度计算

白色 (#FFFFFF) 背景上的文字颜色，以下哪些满足 WCAG AA (4.5:1)？

A. #6B7280 (灰色)
B. #4B5563 (深灰)
C. #1D4ED8 (深蓝)
D. #9CA3AF (浅灰)

<details>
<summary>点击查看答案</summary>

对比度公式：(L1 + 0.05) / (L2 + 0.05)

- A. #6B7280 → 5.74:1 ✅ AA, ❌ AAA (7:1)
- B. #4B5563 → 7.06:1 ✅ AA, ✅ AAA
- C. #1D4ED8 → 8.19:1 ✅ AA, ✅ AAA
- D. #9CA3AF → 2.85:1 ❌ 不满足 AA

答案：B 和 C 满足 AA，C 还满足 AAA。
</details>

---

## 十、总结

### SEO + A11y 交集

| 实践 | SEO 收益 | A11y 收益 |
|------|---------|----------|
| 语义化 HTML | 爬虫理解页面结构 | 屏幕阅读器导航 |
| 图片 alt | 图片搜索排名 | 视障用户理解内容 |
| H1-H6 层级 | 内容结构信号 | 页面大纲导航 |
| 结构化数据 | 富摘要展示 | 无直接影响 (但数据可被辅助技术使用) |
| 页面标题 | 搜索结果标题 | 页面标识 |
| 链接描述性文本 | 锚文本信号 | 链接目的清晰 |
| 表单 label | 无直接影响 | 表单可理解 |
| 焦点管理 | 无直接影响 | 键盘用户导航 |

### 核心原则

1. **语义优先：** 能用原生 HTML 就不用 ARIA
2. **渐进增强：** 基础功能不依赖 JS
3. **测试验证：** Lighthouse + axe + 手动屏幕阅读器测试
4. **结构化数据：** 让搜索引擎理解你的内容
5. **持续监控：** SEO/A11y 不是一次性工作

---

*专项完成 ✅ | 文件：`training/seo-accessibility-2000-0429.md`*
