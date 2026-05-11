# SEO/无障碍 专项训练 — 语义化 HTML + ARIA + 结构化数据

> 日期: 2026-04-30 | 时间: 20:00 | 第 1 轮
> 目标: 优化 1 个完整页面（电商商品详情页）的 SEO 和 A11y

---

## 一、SEO 与 A11y 的交集认知

SEO 和 Accessibility 不是两个独立领域——它们共享同一个根基：**让机器和人一样理解你的内容**。

| 维度 | SEO 关注 | A11y 关注 | 交集 |
|------|----------|-----------|------|
| 语义化 | 搜索引擎理解内容结构 | 屏幕阅读器导航 | ✅ 语义标签 |
| 图片替代 | 图片搜索索引 | 视障用户理解 | ✅ alt 文本 |
| 结构化数据 | Rich Snippets / Knowledge Graph | 辅助技术获取语义 | ✅ Schema.org |
| 页面性能 | Core Web Vitals 排名 | 低带宽/老旧设备可访问 | ✅ 性能优化 |
| 链接文本 | 锚文本权重 | 链接目的明确 | ✅ 描述性链接 |
| 表单 | 表单交互信号 | 表单可操作 | ✅ label + 错误提示 |

**核心原则：Accessible by default, optimized by design.**

---

## 二、语义化 HTML 深度实践

### 2.1 语义标签选择决策树

```
内容是什么？
├── 独立完整内容块 → <article>
│   ├── 有独立标题 → <header> + <h1-h6>
│   ├── 有作者/日期 → <footer> 或 <address>
│   └── 有标签/分类 → <footer> 内嵌 <a href="?tag=...">
├── 导航 → <nav>
│   ├── 主导航 → <nav aria-label="主导航">
│   ├── 面包屑 → <nav aria-label="面包屑"> + <ol>
│   └── 页脚链接 → <footer> 内 <nav>
├── 分区/区块 → <section>
│   ├── 有标题 → <section> + <h2>
│   └── 无标题/纯布局 → <div>（不要用 section）
├── 辅助内容 → <aside>
│   ├── 侧边栏 → <aside>
│   ├── 相关商品 → <aside aria-label="相关商品">
│   └── 术语解释 → <aside> 内嵌 <dfn>
├── 页眉/页脚 → <header> / <footer>
├── 详细内容/摘要 → <details> + <summary>
├── 时间 → <time datetime="2026-04-30">
├── 代码 → <code> / <pre>
├── 引用 → <blockquote> / <q>
├── 列表 → <ul> / <ol> / <dl>
└── 通用容器 → <div>（最后手段）
```

### 2.2 电商商品详情页 — 语义化重构

#### ❌ 反模式（Before）

```html
<!-- 无语义 div 地狱 -->
<div class="page">
  <div class="header">
    <div class="logo">ShopMax</div>
    <div class="nav">
      <div class="nav-item"><a href="/">首页</a></div>
      <div class="nav-item"><a href="/electronics">电子产品</a></div>
      <div class="nav-item"><a href="/phones">手机</a></div>
    </div>
    <div class="search">
      <input type="text" placeholder="搜索商品">
      <button>搜索</button>
    </div>
  </div>
  
  <div class="breadcrumb">
    <span><a href="/">首页</a> &gt; </span>
    <span><a href="/electronics">电子产品</a> &gt; </span>
    <span>手机</span>
  </div>
  
  <div class="product">
    <div class="product-gallery">
      <div class="main-image">
        <img src="phone.jpg">
      </div>
      <div class="thumbnails">
        <div class="thumb"><img src="phone-1.jpg"></div>
        <div class="thumb active"><img src="phone-2.jpg"></div>
        <div class="thumb"><img src="phone-3.jpg"></div>
      </div>
    </div>
    
    <div class="product-info">
      <div class="title">CloudPhone Pro Max 256GB</div>
      <div class="price">
        <span class="current">¥3,999</span>
        <span class="original">¥4,999</span>
      </div>
      <div class="rating">
        <span>★★★★☆</span>
        <span>4.5分 (2,341条评价)</span>
      </div>
      <div class="specs">
        <div><span>CPU</span> <span>骁龙8 Gen3</span></div>
        <div><span>内存</span> <span>12GB</span></div>
        <div><span>存储</span> <span>256GB</span></div>
        <div><span>屏幕</span> <span>6.7英寸 AMOLED</span></div>
      </div>
      <div class="color-select">
        <span>颜色：</span>
        <div class="color-option selected">星际黑</div>
        <div class="color-option">星空蓝</div>
        <div class="color-option">月光银</div>
      </div>
      <div class="storage-select">
        <span>存储：</span>
        <div class="storage-option">128GB</div>
        <div class="storage-option selected">256GB</div>
        <div class="storage-option">512GB</div>
      </div>
      <div class="actions">
        <button class="btn-cart">加入购物车</button>
        <button class="btn-buy">立即购买</button>
      </div>
    </div>
  </div>
  
  <div class="tabs">
    <div class="tab active">商品详情</div>
    <div class="tab">规格参数</div>
    <div class="tab">用户评价</div>
  </div>
  
  <div class="tab-content">
    <div class="detail">
      <p>CloudPhone Pro Max 采用最新骁龙8 Gen3处理器...</p>
      <img src="detail-1.jpg">
      <img src="detail-2.jpg">
    </div>
  </div>
  
  <div class="reviews">
    <div class="review">
      <div class="user">***东</div>
      <div class="stars">★★★★★</div>
      <div class="text">手机很好用，拍照清晰...</div>
      <div class="date">2026-04-28</div>
    </div>
  </div>
  
  <div class="related">
    <div class="related-title">猜你喜欢</div>
    <div class="related-list">
      <div class="related-item">
        <img src="phone2.jpg">
        <div class="name">CloudPhone Lite</div>
        <div class="price">¥2,499</div>
      </div>
    </div>
  </div>
  
  <div class="footer">
    <div class="footer-links">
      <a href="/about">关于我们</a>
      <a href="/contact">联系我们</a>
    </div>
    <div class="copyright">© 2026 ShopMax</div>
  </div>
</div>
```

**问题清单：**
1. 0 个语义标签 — 屏幕阅读器无法导航
2. 图片无 alt — 视障用户完全无法获取信息
3. 标题层级混乱 — 无 h1-h6 结构
4. 表单无 label — 键盘用户无法操作
5. 按钮无描述 — "加入购物车" 对屏幕阅读器无上下文
6. 面包屑无语义 — 不是有序列表
7. 标签页无 ARIA — 无法键盘操作
8. 评价无结构化数据 — 无法生成 Rich Snippets
9. 商品无 Schema.org — 无法生成 Product Rich Card
10. 颜色选择无 role — 不是真正的 radio 组

---

#### ✅ 语义化重构（After）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- SEO: 标题 — 品牌在前或在后，50-60字符 -->
  <title>CloudPhone Pro Max 256GB — 骁龙8 Gen3 | ShopMax</title>
  
  <!-- SEO: 描述 — 150-160字符，含核心关键词和行动号召 -->
  <meta name="description" content="CloudPhone Pro Max 256GB，搭载骁龙8 Gen3处理器，12GB内存，6.7英寸AMOLED屏幕。限时特惠¥3,999，包邮到家，7天无理由退换。">
  
  <!-- SEO: 规范链接 — 防止重复内容 -->
  <link rel="canonical" href="https://www.shopmax.com/products/cloudphone-pro-max-256gb">
  
  <!-- SEO: Open Graph -->
  <meta property="og:title" content="CloudPhone Pro Max 256GB — 骁龙8 Gen3 ¥3,999">
  <meta property="og:description" content="CloudPhone Pro Max，骁龙8 Gen3处理器，12GB+256GB，6.7英寸AMOLED。限时特惠">
  <meta property="og:image" content="https://www.shopmax.com/images/products/cloudphone-pro-max-og.jpg">
  <meta property="og:url" content="https://www.shopmax.com/products/cloudphone-pro-max-256gb">
  <meta property="og:type" content="product">
  <meta property="product:price:amount" content="3999.00">
  <meta property="product:price:currency" content="CNY">
  
  <!-- SEO: Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="CloudPhone Pro Max 256GB — ¥3,999">
  <meta name="twitter:description" content="骁龙8 Gen3，12GB+256GB，限时特惠">
  <meta name="twitter:image" content="https://www.shopmax.com/images/products/cloudphone-pro-max-twitter.jpg">
  
  <!-- A11y: 跳过导航链接 -->
  <style>
    .skip-link {
      position: absolute;
      top: -40px;
      left: 0;
      background: #000;
      color: #fff;
      padding: 8px 16px;
      z-index: 100;
      transition: top 0.2s;
    }
    .skip-link:focus {
      top: 0;
    }
  </style>
</head>
<body>
  <!-- A11y: 跳过导航 — 键盘用户直达主内容 -->
  <a class="skip-link" href="#main-content">跳转到主要内容</a>

  <!-- 页眉：语义化 -->
  <header role="banner">
    <nav aria-label="主导航">
      <a href="/" aria-label="ShopMax 首页">
        <img src="/logo.svg" alt="ShopMax" width="120" height="40">
      </a>
      <ul>
        <li><a href="/electronics">电子产品</a></li>
        <li><a href="/phones" aria-current="page">手机</a></li>
        <li><a href="/tablets">平板</a></li>
        <li><a href="/accessories">配件</a></li>
      </ul>
    </nav>
    
    <!-- A11y: 搜索框有 label -->
    <form role="search" action="/search" method="get">
      <label for="search-input" class="sr-only">搜索商品</label>
      <input 
        type="search" 
        id="search-input"
        name="q"
        placeholder="搜索商品"
        autocomplete="off"
        aria-label="搜索商品"
      >
      <button type="submit" aria-label="执行搜索">搜索</button>
    </form>
  </header>

  <!-- A11y: 面包屑导航 — 有序列表 -->
  <nav aria-label="面包屑">
    <ol itemscope itemtype="https://schema.org/BreadcrumbList">
      <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
        <a itemprop="item" href="/">
          <span itemprop="name">首页</span>
        </a>
        <meta itemprop="position" content="1">
      </li>
      <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
        <a itemprop="item" href="/electronics">
          <span itemprop="name">电子产品</span>
        </a>
        <meta itemprop="position" content="2">
      </li>
      <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
        <a itemprop="item" href="/phones">
          <span itemprop="name">手机</span>
        </a>
        <meta itemprop="position" content="3">
      </li>
      <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem" aria-current="page">
        <span itemprop="name">CloudPhone Pro Max 256GB</span>
        <meta itemprop="position" content="4">
      </li>
    </ol>
  </nav>

  <!-- 主内容区域 -->
  <main id="main-content" role="main">
    <article itemscope itemtype="https://schema.org/Product">
      <!-- SEO: 唯一的 h1 -->
      <h1 itemprop="name">CloudPhone Pro Max 256GB</h1>
      
      <!-- 隐藏元数据供结构化数据使用 -->
      <meta itemprop="brand" content="CloudPhone">
      <meta itemprop="sku" content="CP-PRO-MAX-256">
      <meta itemprop="gtin13" content="6901234567890">
      
      <section class="product-body">
        <!-- 图片画廊 -->
        <section aria-label="商品图片">
          <!-- A11y: 主图有描述性 alt -->
          <figure>
            <img 
              id="main-image"
              src="/images/products/cloudphone-pro-max-main.webp"
              alt="CloudPhone Pro Max 正面视图，6.7英寸黑色屏幕，窄边框设计"
              itemprop="image"
              width="800"
              height="800"
              loading="eager"
              fetchpriority="high"
            >
            <figcaption itemprop="description">CloudPhone Pro Max — 6.7英寸 AMOLED 全面屏，星际黑配色</figcaption>
          </figure>
          
          <!-- 缩略图列表 -->
          <div role="list" aria-label="图片缩略图列表">
            <button 
              role="listitem"
              aria-label="查看正面图"
              aria-current="true"
              onclick="switchImage(0)"
            >
              <img src="/images/products/cloudphone-pro-max-1-thumb.webp" alt="" width="80" height="80" loading="lazy">
            </button>
            <button 
              role="listitem"
              aria-label="查看背面图"
              onclick="switchImage(1)"
            >
              <img src="/images/products/cloudphone-pro-max-2-thumb.webp" alt="" width="80" height="80" loading="lazy">
            </button>
            <button 
              role="listitem"
              aria-label="查看侧面图"
              onclick="switchImage(2)"
            >
              <img src="/images/products/cloudphone-pro-max-3-thumb.webp" alt="" width="80" height="80" loading="lazy">
            </button>
          </div>
        </section>
        
        <!-- 商品信息 -->
        <section aria-label="商品信息">
          <!-- 价格 -->
          <div class="price" aria-label="价格信息">
            <span itemprop="offers" itemscope itemtype="https://schema.org/Offer">
              <!-- SEO: 价格结构化数据 -->
              <meta itemprop="priceCurrency" content="CNY">
              <meta itemprop="price" content="3999.00">
              <meta itemprop="availability" content="https://schema.org/InStock">
              <meta itemprop="url" content="https://www.shopmax.com/products/cloudphone-pro-max-256gb">
              <meta itemprop="seller" content="ShopMax">
              
              <span class="current-price" aria-label="现价 3999元">
                ¥<span itemprop="price">3,999</span>
              </span>
              <span class="original-price" aria-label="原价4999元">
                ¥<del>4,999</del>
              </span>
              <span class="discount-badge" aria-label="省1000元，省20%">省 ¥1,000</span>
            </span>
          </div>
          
          <!-- 评分 -->
          <div class="rating" itemprop="aggregateRating" itemscope itemtype="https://schema.org/AggregateRating" role="img" aria-label="评分4.5星，共2341条评价">
            <div class="stars" aria-hidden="true">
              <!-- 用 SVG 实现可访问的星级 -->
              <svg viewBox="0 0 100 20" aria-hidden="true">
                <text x="0" y="16" fill="#FFB800" font-size="16">★★★★½</text>
              </svg>
            </div>
            <span class="rating-value">
              <span itemprop="ratingValue">4.5</span>
            </span>
            <span class="review-count">
              (<span itemprop="reviewCount">2341</span>条评价)
            </span>
          </div>
          
          <!-- 规格参数 — 定义列表 -->
          <dl class="specs" aria-label="核心规格">
            <div>
              <dt>CPU</dt>
              <dd>骁龙8 Gen3</dd>
            </div>
            <div>
              <dt>内存</dt>
              <dd>12GB LPDDR5X</dd>
            </div>
            <div>
              <dt>存储</dt>
              <dd>256GB UFS 4.0</dd>
            </div>
            <div>
              <dt>屏幕</dt>
              <dd>6.7英寸 2K AMOLED 120Hz</dd>
            </div>
            <div>
              <dt>电池</dt>
              <dd>5000mAh / 100W快充</dd>
            </div>
          </dl>
          
          <!-- 颜色选择 — 语义化 radio 组 -->
          <fieldset class="color-select">
            <legend>选择颜色</legend>
            <div role="radiogroup" aria-label="颜色选择">
              <label class="color-option selected">
                <input type="radio" name="color" value="black" checked aria-label="星际黑，已选择">
                <span class="color-swatch" style="background:#1a1a1a" aria-hidden="true"></span>
                <span>星际黑</span>
              </label>
              <label class="color-option">
                <input type="radio" name="color" value="blue" aria-label="星空蓝">
                <span class="color-swatch" style="background:#1a3a6a" aria-hidden="true"></span>
                <span>星空蓝</span>
              </label>
              <label class="color-option">
                <input type="radio" name="color" value="silver" aria-label="月光银">
                <span class="color-swatch" style="background:#c0c0c0" aria-hidden="true"></span>
                <span>月光银</span>
              </label>
            </div>
          </fieldset>
          
          <!-- 存储选择 — 语义化 radio 组 -->
          <fieldset class="storage-select">
            <legend>选择存储</legend>
            <div role="radiogroup" aria-label="存储容量选择">
              <label class="storage-option">
                <input type="radio" name="storage" value="128" aria-label="128GB，价格3499元">
                <span>128GB — ¥3,499</span>
              </label>
              <label class="storage-option selected">
                <input type="radio" name="storage" value="256" checked aria-label="256GB，价格3999元，已选择">
                <span>256GB — ¥3,999</span>
              </label>
              <label class="storage-option">
                <input type="radio" name="storage" value="512" aria-label="512GB，价格4,799元">
                <span>512GB — ¥4,799</span>
              </label>
            </div>
          </fieldset>
          
          <!-- 操作按钮 — 有描述性文本 -->
          <div class="actions">
            <button 
              type="button"
              class="btn-cart"
              aria-label="将 CloudPhone Pro Max 256GB 星际黑加入购物车"
            >
              🛒 加入购物车
            </button>
            <button 
              type="button"
              class="btn-buy"
              aria-label="立即购买 CloudPhone Pro Max 256GB 星际黑，价格3999元"
            >
              ⚡ 立即购买
            </button>
          </div>
          
          <!-- 服务保障 — details/summary -->
          <details>
            <summary>服务保障</summary>
            <ul>
              <li>✅ 全国联保，一年质保</li>
              <li>✅ 7天无理由退换</li>
              <li>✅ 包邮到家</li>
              <li>✅ 正品保证，假一赔十</li>
            </ul>
          </details>
        </section>
      </section>
      
      <!-- 标签页内容 — ARIA tabpanel -->
      <section aria-label="商品详细信息">
        <div role="tablist" aria-label="商品详情标签">
          <button role="tab" aria-selected="true" aria-controls="panel-detail" id="tab-detail" tabindex="0">
            商品详情
          </button>
          <button role="tab" aria-selected="false" aria-controls="panel-specs" id="tab-specs" tabindex="-1">
            规格参数
          </button>
          <button role="tab" aria-selected="false" aria-controls="panel-reviews" id="tab-reviews" tabindex="-1">
            用户评价 <span class="badge">2,341</span>
          </button>
        </div>
        
        <div role="tabpanel" id="panel-detail" aria-labelledby="tab-detail">
          <article itemprop="description">
            <h2>CloudPhone Pro Max — 旗舰性能，影像旗舰</h2>
            <p>CloudPhone Pro Max 搭载最新 <strong>骁龙8 Gen3</strong> 处理器，采用 4nm 工艺制程，CPU 性能提升 30%，GPU 性能提升 25%。</p>
            
            <figure>
              <img 
                src="/images/products/detail-camera.webp" 
                alt="CloudPhone Pro Max 三摄系统特写，包含5000万像素主摄、5000万超广角和1200万长焦"
                width="800"
                height="600"
                loading="lazy"
              >
              <figcaption>5000万三摄系统：主摄 + 超广角 + 长焦</figcaption>
            </figure>
            
            <h3>影像系统</h3>
            <ul>
              <li>5000万像素主摄，1/1.3英寸大底</li>
              <li>5000万像素超广角，120°视野</li>
              <li>1200万像素长焦，3倍光学变焦</li>
              <li>支持 8K 视频录制</li>
            </ul>
            
            <h3>续航充电</h3>
            <ul>
              <li>5000mAh 大电池</li>
              <li>100W 有线快充，25分钟充满</li>
              <li>50W 无线快充</li>
            </ul>
          </article>
        </div>
        
        <div role="tabpanel" id="panel-specs" aria-labelledby="tab-specs" hidden>
          <table aria-label="完整规格参数">
            <caption>CloudPhone Pro Max 完整规格参数</caption>
            <thead>
              <tr>
                <th scope="col">参数</th>
                <th scope="col">规格</th>
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row">处理器</th><td>骁龙8 Gen3 (4nm)</td></tr>
              <tr><th scope="row">内存</th><td>12GB LPDDR5X</td></tr>
              <tr><th scope="row">存储</th><td>256GB UFS 4.0</td></tr>
              <tr><th scope="row">屏幕</th><td>6.7英寸 2K AMOLED, 120Hz</td></tr>
              <tr><th scope="row">主摄</th><td>5000万像素, f/1.8</td></tr>
              <tr><th scope="row">电池</th><td>5000mAh</td></tr>
              <tr><th scope="row">充电</th><td>100W有线 + 50W无线</td></tr>
              <tr><th scope="row">系统</th><td>CloudOS 4.0 (Android 15)</td></tr>
              <tr><th scope="row">重量</th><td>205g</td></tr>
            </tbody>
          </table>
        </div>
        
        <div role="tabpanel" id="panel-reviews" aria-labelledby="tab-reviews" hidden>
          <section aria-label="用户评价">
            <h2>用户评价 <span aria-hidden="true">(2,341)</span></h2>
            
            <article class="review" itemscope itemtype="https://schema.org/Review">
              <header class="review-header">
                <span class="reviewer" itemprop="author">***东</span>
                <!-- A11y: 评分用文字描述 -->
                <div class="review-stars" role="img" aria-label="5星好评">
                  <span aria-hidden="true">★★★★★</span>
                </div>
                <time itemprop="datePublished" datetime="2026-04-28">2026-04-28</time>
                <span class="verified" aria-label="已验证购买">✅ 已验证购买</span>
              </header>
              
              <div itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">
                <meta itemprop="ratingValue" content="5">
                <meta itemprop="bestRating" content="5">
                <meta itemprop="worstRating" content="1">
              </div>
              
              <p itemprop="reviewBody">手机很好用，拍照非常清晰，特别是夜景模式。骁龙8 Gen3性能强劲，玩原神完全没问题。100W充电速度很快，早上洗漱时间就能充满。</p>
              
              <footer class="review-footer">
                <button aria-label="这条评价有帮助，当前12人认为有帮助">👍 有帮助 (12)</button>
              </footer>
            </article>
            
            <article class="review" itemscope itemtype="https://schema.org/Review">
              <header class="review-header">
                <span class="reviewer" itemprop="author">***明</span>
                <div class="review-stars" role="img" aria-label="4星好评">
                  <span aria-hidden="true">★★★★☆</span>
                </div>
                <time itemprop="datePublished" datetime="2026-04-25">2026-04-25</time>
                <span class="verified" aria-label="已验证购买">✅ 已验证购买</span>
              </header>
              
              <div itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">
                <meta itemprop="ratingValue" content="4">
                <meta itemprop="bestRating" content="5">
                <meta itemprop="worstRating" content="1">
              </div>
              
              <p itemprop="reviewBody">整体不错，屏幕显示效果很好。就是重量稍微有点重，单手操作不太方便。系统流畅度很好，没有卡顿。</p>
              
              <footer class="review-footer">
                <button aria-label="这条评价有帮助，当前8人认为有帮助">👍 有帮助 (8)</button>
              </footer>
            </article>
          </section>
        </div>
      </section>
      
      <!-- 相关商品 -->
      <aside aria-label="猜你喜欢">
        <h2>猜你喜欢</h2>
        <ul>
          <li>
            <a href="/products/cloudphone-lite">
              <img src="/images/products/cloudphone-lite.webp" alt="CloudPhone Lite 正面图，星空蓝配色" width="200" height="200" loading="lazy">
              <h3>CloudPhone Lite</h3>
              <p class="price">¥2,499</p>
            </a>
          </li>
          <li>
            <a href="/products/cloudphone-fold">
              <img src="/images/products/cloudphone-fold.webp" alt="CloudPhone Fold 展开状态，银色机身" width="200" height="200" loading="lazy">
              <h3>CloudPhone Fold</h3>
              <p class="price">¥6,999</p>
            </a>
          </li>
        </ul>
      </aside>
    </article>
  </main>

  <!-- 页脚 -->
  <footer role="contentinfo">
    <nav aria-label="页脚导航">
      <h2>关于我们</h2>
      <ul>
        <li><a href="/about">关于我们</a></li>
        <li><a href="/contact">联系我们</a></li>
        <li><a href="/careers">加入我们</a></li>
        <li><a href="/privacy">隐私政策</a></li>
        <li><a href="/terms">使用条款</a></li>
      </ul>
    </nav>
    <p class="copyright">&copy; 2026 ShopMax. 保留所有权利。</p>
  </footer>
</body>
</html>
```

---

## 三、ARIA 深度实践

### 3.1 ARIA 使用黄金规则

> **Rule 1: 如果可以用原生 HTML 元素实现，就不要用 ARIA。**
> 
> **Rule 2: 不要改变原生语义，除非绝对必要。**
> 
> **Rule 3: 所有可交互元素必须有键盘可访问性。**
> 
> **Rule 4: 不要使用 role="presentation" 或 aria-hidden="true" 在有焦点的元素上。**
> 
> **Rule 5: 所有交互元素必须有可访问名称。**

### 3.2 ARIA 属性速查表

```
┌──────────────────────────────────────────────────────────┐
│ 关系属性 (Relationship)                                   │
├──────────────────────────────────────────────────────────┤
│ aria-labelledby → 用其他元素文本作为当前元素名称            │
│   <h1 id="title">商品名</h1>                               │
│   <div aria-labelledby="title">...</div>                   │
│                                                           │
│ aria-describedby → 引用详细描述元素                          │
│   <input aria-describedby="password-hint">                 │
│   <p id="password-hint">至少8个字符，含大小写字母和数字</p>  │
│                                                           │
│ aria-controls → 标识控制的元素                              │
│   <button aria-controls="menu-panel">菜单</button>         │
│   <div id="menu-panel" role="menu">...</div>               │
│                                                           │
│ aria-owns → 强制 DOM 层级关系（谨慎使用）                   │
│   <div aria-owns="floating-menu">触发器</div>              │
│   <div id="floating-menu">浮动菜单</div>                    │
├──────────────────────────────────────────────────────────┤
│ 状态属性 (State)                                           │
├──────────────────────────────────────────────────────────┤
│ aria-expanded → true/false/undefined                       │
│   <button aria-expanded="false">折叠面板</button>          │
│                                                           │
│ aria-selected → true/false/mixed                           │
│   <option aria-selected="true">选项</option>               │
│                                                           │
│ aria-checked → true/false/mixed                            │
│   <input type="checkbox" aria-checked="mixed">             │
│                                                           │
│ aria-disabled → true/false                                 │
│   <button aria-disabled="true">不可用</button>             │
│                                                           │
│ aria-hidden → true/false                                   │
│   <div aria-hidden="true">装饰图标</div>                    │
│   ⚠️ 不要用在有焦点的元素上                                 │
│                                                           │
│ aria-current → page/step/location/date/time/true/false     │
│   <a aria-current="page">当前页</a>                        │
│                                                           │
│ aria-busy → true/false                                     │
│   <div aria-busy="true">加载中...</div>                    │
│                                                           │
│ aria-live → off/polite/assertive                           │
│   <div aria-live="polite">动态更新区域</div>               │
│   <div aria-live="assertive">紧急通知</div>                │
│                                                           │
│ aria-atomic → true/false                                   │
│   <div aria-live="polite" aria-atomic="true">             │
│     完整替换内容（不增量播报）                                │
│   </div>                                                   │
│                                                           │
│ aria-relevant → additions/removals/text/all                │
│   <div aria-live="polite" aria-relevant="additions text"> │
│     仅播报新增内容和文本变化                                  │
│   </div>                                                   │
├──────────────────────────────────────────────────────────┤
│ 属性属性 (Property)                                        │
├──────────────────────────────────────────────────────────┤
│ aria-label → 可访问名称（覆盖可见文本）                      │
│   <button aria-label="关闭对话框">✕</button>               │
│                                                           │
│ aria-label → 给无文本元素命名                               │
│   <nav aria-label="主导航">...</nav>                       │
│   <div role="listbox" aria-label="城市选择">...</div>      │
│                                                           │
│ aria-roledescription → 自定义角色描述                       │
│   <div role="grid" aria-roledescription="数据表格">        │
│                                                           │
│ aria-placeholder → 占位符文本                              │
│   <div role="textbox" aria-placeholder="输入内容">         │
│                                                           │
│ aria-valuemin / aria-valuemax / aria-valuenow             │
│   <div role="slider" aria-valuemin="0" aria-valuemax="100"│
│        aria-valuenow="50">音量</div>                       │
│                                                           │
│ aria-valuetext → 值的人类可读文本                           │
│   <div role="slider" aria-valuetext="50%">                │
│                                                           │
│ aria-required → true/false                                 │
│   <input aria-required="true">                             │
│                                                           │
│ aria-invalid → true/false                                  │
│   <input aria-invalid="true" aria-describedby="err">       │
│   <span id="err">请输入有效邮箱</span>                      │
├──────────────────────────────────────────────────────────┤
│ 重要 Role                                                 │
├──────────────────────────────────────────────────────────┤
│ 地标角色                                                   │
│   role="banner"     → <header>                            │
│   role="navigation" → <nav>                               │
│   role="main"       → <main>                              │
│   role="complementary" → <aside>                          │
│   role="contentinfo"  → <footer>                          │
│   role="form"       → <form>                              │
│   role="search"     → <form role="search">                │
│   role="region"     → <section aria-label="...">          │
│                                                           │
│ 窗口角色                                                   │
│   role="dialog"     → 对话框                               │
│   role="alertdialog" → 警告对话框                          │
│   必须配 aria-labelledby 和 aria-modal="true"              │
│                                                           │
│ 实时区域                                                   │
│   role="status"    → aria-live="polite" aria-atomic="true"│
│   role="alert"     → aria-live="assertive"                │
│   role="log"       → 日志（追加模式）                       │
│   role="marquee"   → 滚动信息（不自动更新）                 │
│   role="timer"     → 计时器                                │
│                                                           │
│ 复合组件                                                   │
│   role="tablist" / role="tab" / role="tabpanel"           │
│   role="listbox" / role="option"                          │
│   role="combobox"                                        │
│   role="menu" / role="menuitem" / role="menubar"          │
│   role="tree" / role="treeitem"                           │
│   role="grid" / role="row" / role="cell"                  │
│   role="table" / role="rowgroup" / role="row" / role="cell"│
│   role="toolbar"                                         │
│   role="tooltip"                                         │
│   role="spinbutton"                                      │
└──────────────────────────────────────────────────────────┘
```

### 3.3 可访问对话框实战

```html
<!-- 可访问模态对话框 -->
<div 
  role="dialog" 
  aria-modal="true" 
  aria-labelledby="dialog-title" 
  aria-describedby="dialog-desc"
  id="confirm-dialog"
>
  <header>
    <h2 id="dialog-title">确认删除</h2>
    <button 
      aria-label="关闭对话框" 
      onclick="closeDialog()"
    >✕</button>
  </header>
  
  <p id="dialog-desc">
    确定要删除 <strong>CloudPhone Pro Max</strong> 吗？此操作不可撤销。
  </p>
  
  <footer>
    <button onclick="confirmDelete()" autofocus>确认删除</button>
    <button onclick="closeDialog()">取消</button>
  </footer>
</div>

<script>
// 焦点陷阱 (Focus Trap)
const dialog = document.getElementById('confirm-dialog');
let previousFocus = null;

function openDialog() {
  previousFocus = document.activeElement;
  dialog.show();
  // 聚焦到第一个可交互元素
  dialog.querySelector('[autofocus], button').focus();
  
  // 添加焦点陷阱
  document.addEventListener('keydown', trapFocus);
  // 阻止 body 滚动
  document.body.style.overflow = 'hidden';
}

function closeDialog() {
  dialog.hide();
  document.removeEventListener('keydown', trapFocus);
  document.body.style.overflow = '';
  // 恢复焦点
  if (previousFocus) previousFocus.focus();
}

function trapFocus(e) {
  if (e.key !== 'Tab') return;
  
  const focusable = dialog.querySelectorAll(
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

// ESC 关闭
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && dialog.isOpen) {
    closeDialog();
  }
});
</script>
```

### 3.4 可访问标签页 (Tabs) 完整实现

```html
<div class="tabs-container">
  <div role="tablist" aria-label="商品详情标签" id="product-tabs">
    <button role="tab" 
            aria-selected="true" 
            aria-controls="panel-detail" 
            id="tab-detail" 
            tabindex="0">
      商品详情
    </button>
    <button role="tab" 
            aria-selected="false" 
            aria-controls="panel-specs" 
            id="tab-specs" 
            tabindex="-1">
      规格参数
    </button>
    <button role="tab" 
            aria-selected="false" 
            aria-controls="panel-reviews" 
            id="tab-reviews" 
            tabindex="-1">
      用户评价
    </button>
  </div>
  
  <div role="tabpanel" id="panel-detail" aria-labelledby="tab-detail">
    <!-- 详情内容 -->
  </div>
  <div role="tabpanel" id="panel-specs" aria-labelledby="tab-specs" hidden>
    <!-- 规格内容 -->
  </div>
  <div role="tabpanel" id="panel-reviews" aria-labelledby="tab-reviews" hidden>
    <!-- 评价内容 -->
  </div>
</div>

<script>
// 可访问 Tabs 控制器
class AccessibleTabs {
  constructor(container) {
    this.container = container;
    this.tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    this.panels = Array.from(container.querySelectorAll('[role="tabpanel"]'));
    
    this.tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => this.activate(i));
      tab.addEventListener('keydown', (e) => this.handleKeydown(e, i));
    });
  }
  
  activate(index) {
    // 关闭所有
    this.tabs.forEach(t => {
      t.setAttribute('aria-selected', 'false');
      t.setAttribute('tabindex', '-1');
    });
    this.panels.forEach(p => {
      p.hidden = true;
    });
    
    // 打开目标
    this.tabs[index].setAttribute('aria-selected', 'true');
    this.tabs[index].setAttribute('tabindex', '0');
    this.tabs[index].focus();
    this.panels[index].hidden = false;
  }
  
  handleKeydown(e, currentIndex) {
    let newIndex = currentIndex;
    
    switch (e.key) {
      case 'ArrowLeft':
        newIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
        e.preventDefault();
        break;
      case 'ArrowRight':
        newIndex = (currentIndex + 1) % this.tabs.length;
        e.preventDefault();
        break;
      case 'Home':
        newIndex = 0;
        e.preventDefault();
        break;
      case 'End':
        newIndex = this.tabs.length - 1;
        e.preventDefault();
        break;
      default:
        return;
    }
    
    this.activate(newIndex);
  }
}

// 初始化
new AccessibleTabs(document.getElementById('product-tabs'));
</script>
```

---

## 四、结构化数据 (Schema.org) 深度实践

### 4.1 JSON-LD 完整实现

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      "@id": "https://www.shopmax.com/products/cloudphone-pro-max-256gb#product",
      "name": "CloudPhone Pro Max 256GB",
      "description": "CloudPhone Pro Max 搭载骁龙8 Gen3处理器，12GB内存，256GB存储，6.7英寸2K AMOLED屏幕，5000万像素三摄系统。",
      "brand": {
        "@type": "Brand",
        "name": "CloudPhone"
      },
      "manufacturer": {
        "@type": "Organization",
        "name": "CloudPhone Inc."
      },
      "sku": "CP-PRO-MAX-256",
      "gtin13": "6901234567890",
      "image": [
        "https://www.shopmax.com/images/products/cloudphone-pro-max-main.webp",
        "https://www.shopmax.com/images/products/cloudphone-pro-max-back.webp",
        "https://www.shopmax.com/images/products/cloudphone-pro-max-side.webp"
      ],
      "offers": {
        "@type": "Offer",
        "url": "https://www.shopmax.com/products/cloudphone-pro-max-256gb",
        "priceCurrency": "CNY",
        "price": "3999.00",
        "priceValidUntil": "2026-05-31",
        "availability": "https://schema.org/InStock",
        "itemCondition": "https://schema.org/NewCondition",
        "seller": {
          "@type": "Organization",
          "name": "ShopMax"
        },
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "shippingRate": {
            "@type": "MonetaryAmount",
            "value": "0",
            "currency": "CNY"
          },
          "shippingDestination": {
            "@type": "DefinedRegion",
            "addressCountry": "CN"
          },
          "deliveryTime": {
            "@type": "ShippingDeliveryTime",
            "handlingTime": {
              "@type": "QuantitativeValue",
              "minValue": 0,
              "maxValue": 1,
              "unitCode": "DAY"
            },
            "transitTime": {
              "@type": "QuantitativeValue",
              "minValue": 1,
              "maxValue": 3,
              "unitCode": "DAY"
            }
          }
        },
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
          "merchantReturnDays": 7,
          "returnMethod": "https://schema.org/ReturnByMail",
          "returnFees": "https://schema.org/FreeReturn"
        }
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.5",
        "bestRating": "5",
        "worstRating": "1",
        "ratingCount": "2341",
        "reviewCount": "2341"
      },
      "review": [
        {
          "@type": "Review",
          "author": {
            "@type": "Person",
            "name": "***东"
          },
          "datePublished": "2026-04-28",
          "reviewBody": "手机很好用，拍照非常清晰，特别是夜景模式。骁龙8 Gen3性能强劲，玩原神完全没问题。",
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": "5",
            "bestRating": "5",
            "worstRating": "1"
          }
        },
        {
          "@type": "Review",
          "author": {
            "@type": "Person",
            "name": "***明"
          },
          "datePublished": "2026-04-25",
          "reviewBody": "整体不错，屏幕显示效果很好。就是重量稍微有点重，单手操作不太方便。",
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": "4",
            "bestRating": "5",
            "worstRating": "1"
          }
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "首页",
          "item": "https://www.shopmax.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "电子产品",
          "item": "https://www.shopmax.com/electronics"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "手机",
          "item": "https://www.shopmax.com/phones"
        },
        {
          "@type": "ListItem",
          "position": 4,
          "name": "CloudPhone Pro Max 256GB",
          "item": "https://www.shopmax.com/products/cloudphone-pro-max-256gb"
        }
      ]
    },
    {
      "@type": "WebSite",
      "name": "ShopMax",
      "url": "https://www.shopmax.com/",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://www.shopmax.com/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "Organization",
      "@id": "https://www.shopmax.com/#organization",
      "name": "ShopMax",
      "url": "https://www.shopmax.com/",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.shopmax.com/logo.svg",
        "width": "120",
        "height": "40"
      },
      "sameAs": [
        "https://weibo.com/shopmax",
        "https://www.douyin.com/user/shopmax",
        "https://www.xiaohongshu.com/user/shopmax"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+86-400-123-4567",
        "contactType": "customer service",
        "availableLanguage": ["Chinese", "English"]
      }
    }
  ]
}
</script>
```

### 4.2 结构化数据测试清单

```
✅ Product — 商品名称、描述、图片、品牌、SKU
✅ Offer — 价格、货币、库存状态、卖家、运费、退换货政策
✅ AggregateRating — 评分、评分数、评价数
✅ Review — 评价内容、作者、日期、评分
✅ BreadcrumbList — 面包屑层级
✅ WebSite — 站点搜索 (SiteLinks SearchBox)
✅ Organization — 品牌信息、Logo、社交链接
✅ ImageObject — 图片尺寸标注
✅ ShippingDetails — 运费和配送时间
```

---

## 五、SEO 技术优化清单

### 5.1 页面级 SEO 检查

```
┌─────────────────────────────────────────────────────────┐
│ 标题 (Title)                                             │
│ ✅ 50-60 字符                                            │
│ ✅ 含核心关键词                                          │
│ ✅ 品牌名在末尾                                          │
│ ✅ 每个页面唯一                                          │
│ ❌ 关键词堆砌                                            │
│                                                          │
│ 描述 (Meta Description)                                  │
│ ✅ 150-160 字符                                          │
│ ✅ 含行动号召 (CTA)                                      │
│ ✅ 含核心关键词                                          │
│ ✅ 每个页面唯一                                          │
│                                                          │
│ 规范链接 (Canonical)                                     │
│ ✅ 自引用 canonical                                      │
│ ✅ 参数化 URL 指向主 URL                                  │
│                                                          │
│ 标题层级 (Heading)                                       │
│ ✅ 每页唯一 h1                                           │
│ ✅ h1-h6 层级不跳过                                      │
│ ✅ h2 作为主要分区标题                                     │
│ ❌ 用标题做样式（应用 CSS）                                │
│                                                          │
│ 图片优化                                                 │
│ ✅ 描述性 alt 文本                                       │
│ ✅ WebP/AVIF 格式 + fallback                              │
│ ✅ width/height 防 CLS                                    │
│ ✅ loading="lazy" (非首屏)                                │
│ ✅ fetchpriority="high" (LCP 图片)                        │
│ ✅ srcset / sizes (响应式)                                │
│                                                          │
│ 内部链接                                                 │
│ ✅ 描述性锚文本                                          │
│ ✅ 面包屑导航                                            │
│ ✅ 相关推荐/相关文章                                      │
│ ❌ 无意义锚文本 ("点击这里")                               │
│                                                          │
│ URL 结构                                                 │
│ ✅ 语义化 URL                                            │
│ ✅ 短且可读                                              │
│ ✅ 连字符分隔 (非下划线)                                   │
│ ✅ 小写                                                  │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Core Web Vitals 优化

```
┌─────────────────────────────────────────────────────────┐
│ LCP (Largest Contentful Paint) — ≤ 2.5s                 │
│                                                          │
│ ✅ 预加载 LCP 图片: <link rel="preload" as="image">      │
│ ✅ 内联关键 CSS                                           │
│ ✅ 延迟非关键 JS                                          │
│ ✅ CDN + 图片优化                                         │
│ ✅ 服务端渲染 (SSR) / 静态生成 (SSG)                      │
│                                                          │
│ INP (Interaction to Next Paint) — ≤ 200ms               │
│                                                          │
│ ✅ 减少主线程工作                                          │
│ ✅ 使用 Web Worker 处理重计算                               │
│ ✅ 事件委托减少监听器                                      │
│ ✅ 防抖/节流高频事件                                       │
│ ✅ 虚拟列表 (大数据量)                                     │
│                                                          │
│ CLS (Cumulative Layout Shift) — ≤ 0.1                   │
│                                                          │
│ ✅ 图片设置 width/height                                   │
│ ✅ 广告/嵌入预留空间                                       │
│ ✅ 字体 font-display: swap → optional                     │
│ ✅ 避免动态插入内容推挤现有内容                              │
│ ✅ CSS contain: layout                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 六、可访问性测试清单 (WCAG 2.1 AA)

```
┌─────────────────────────────────────────────────────────┐
│ 1. 可感知 (Perceivable)                                  │
│                                                          │
│ 1.1 文本替代                                             │
│   ✅ 所有非装饰图片有 alt                                 │
│   ✅ 装饰图片 alt=""                                     │
│   ✅ 复杂图表有长描述                                     │
│   ✅ 视频有字幕/转录                                      │
│                                                          │
│ 1.2 时间媒体                                             │
│   ✅ 视频有字幕                                           │
│   ✅ 音频有文字转录                                       │
│                                                          │
│ 1.3 可适配                                               │
│   ✅ 语义化 HTML                                          │
│   ✅ 信息不依赖颜色                                       │
│   ✅ 顺序不依赖样式                                       │
│   ✅ 支持 200% 缩放                                       │
│                                                          │
│ 1.4 可辨别                                               │
│   ✅ 对比度 ≥ 4.5:1 (文本)                               │
│   ✅ 对比度 ≥ 3:1 (大文本/图形)                           │
│   ✅ 可调整文字间距                                       │
│   ✅ 不依赖声音                                           │
│                                                          │
│ 2. 可操作 (Operable)                                     │
│                                                          │
│ 2.1 键盘可访问                                           │
│   ✅ 所有功能键盘可达                                     │
│   ✅ 无键盘陷阱                                           │
│   ✅ 快捷键可重定义/关闭                                   │
│                                                          │
│ 2.2 足够时间                                             │
│   ✅ 超时可延长/关闭                                       │
│   ✅ 自动滚动/闪烁可暂停                                   │
│                                                          │
│ 2.3 癫痫                                                 │
│   ✅ 无闪烁内容 (>3次/秒)                                  │
│                                                          │
│ 2.4 可导航                                               │
│   ✅ 跳过导航链接                                         │
│   ✅ 页面标题描述性                                       │
│   ✅ 焦点可见                                             │
│   ✅ 链接目的明确                                         │
│   ✅ 多重导航方式                                         │
│   ✅ 标题/标签描述性                                      │
│                                                          │
│ 2.5 输入方式                                             │
│   ✅ 指针手势替代                                         │
│   ✅ 疼痛/不适动作可关闭                                   │
│                                                          │
│ 3. 可理解 (Understandable)                               │
│                                                          │
│ 3.1 可读                                                 │
│   ✅ lang 属性                                            │
│   ✅ 缩写有全称                                           │
│   ✅ 非常规用语有定义                                     │
│                                                          │
│ 3.2 可预测                                               │
│   ✅ 导航一致                                             │
│   ✅ 标识一致                                             │
│   ✅ 上下文变化可预测                                      │
│   ✅ 错误可预测和纠正                                     │
│                                                          │
│ 3.3 输入辅助                                             │
│   ✅ 错误提示清晰                                         │
│   ✅ 标签描述性                                           │
│   ✅ 防错机制 (确认/撤销)                                  │
│                                                          │
│ 4. 健壮 (Robust)                                         │
│                                                          │
│ 4.1 兼容性                                               │
│   ✅ 有效 HTML                                            │
│   ✅ 名称-角色-值一致                                      │
│   ✅ 状态变化通知                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 七、性能 × A11y × SEO 三角优化

### 7.1 图片优化三位一体

```html
<!-- 三位一体图片优化 -->
<picture>
  <!-- AVIF 格式 — 最佳压缩 -->
  <source 
    type="image/avif"
    srcset="
      /images/phone-400.avif 400w,
      /images/phone-800.avif 800w,
      /images/phone-1200.avif 1200w
    "
    sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 800px"
  >
  <!-- WebP 格式 — 广泛支持 -->
  <source 
    type="image/webp"
    srcset="
      /images/phone-400.webp 400w,
      /images/phone-800.webp 800w,
      /images/phone-1200.webp 1200w
    "
    sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 800px"
  >
  <!-- JPEG fallback -->
  <img 
    src="/images/phone-800.jpg"
    alt="CloudPhone Pro Max 正面视图，6.7英寸黑色屏幕，窄边框设计"
    width="800"
    height="800"
    loading="eager"
    fetchpriority="high"
    decoding="async"
    style="aspect-ratio: 1 / 1;"
  >
</picture>

<!-- SEO: 图片 SEO 检查 -->
<!-- ✅ alt 描述性 (非 "IMG_1234.jpg") -->
<!-- ✅ width/height 防 CLS -->
<!-- ✅ srcset 响应式 -->
<!-- ✅ loading="lazy" 非首屏 -->
<!-- ✅ fetchpriority="high" LCP 图片 -->
<!-- ✅ aspect-ratio 防布局偏移 -->

<!-- A11y: 图片可访问性检查 -->
<!-- ✅ alt 描述内容而非文件 -->
<!-- ✅ 装饰图片 alt="" -->
<!-- ✅ 复杂图片用 longdesc/aria-describedby -->
<!-- ✅ 图片按钮有 aria-label -->
```

### 7.2 字体优化

```html
<!-- SEO + A11y + 性能: 字体优化 -->
<head>
  <!-- 预连接字体 CDN -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  
  <!-- 字体显示策略 -->
  <style>
    @font-face {
      font-family: 'CloudSans';
      src: url('/fonts/cloud-sans.woff2') format('woff2');
      font-display: optional; /* 首屏用系统字体，字体加载后替换 */
      font-weight: 100 900;
      font-stretch: 75% 125%;
    }
    
    /* 字体回退链 — 确保 A11y */
    body {
      font-family: 'CloudSans', -apple-system, 'Noto Sans SC', 
                   'PingFang SC', 'Microsoft YaHei', sans-serif;
    }
  </style>
</head>

<!-- A11y: 尊重用户动画偏好 -->
<style>
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  
  /* 尊重用户高对比度偏好 */
  @media (prefers-contrast: high) {
    body {
      background: #fff !important;
      color: #000 !important;
    }
    a {
      text-decoration: underline !important;
      color: #0000EE !important;
    }
  }
  
  /* 尊重用户深色模式 */
  @media (prefers-color-scheme: dark) {
    body {
      background: #1a1a1a;
      color: #e0e0e0;
    }
  }
</style>
```

---

## 八、SEO 工具链

### 8.1 常用工具

```
┌─────────────────────────────────────────────────────────┐
│ 结构化数据测试                                            │
│   Google Rich Results Test:                              │
│     https://search.google.uk/test/rich-results           │
│   Schema.org Validator:                                  │
│     https://validator.schema.org/                        │
│                                                          │
│ SEO 审计                                                 │
│   Lighthouse (Chrome DevTools)                           │
│   Screaming Frog SEO Spider                              │
│   Ahrefs / Semrush                                       │
│   Google Search Console                                  │
│                                                          │
│ A11y 审计                                                │
│   axe DevTools (Chrome 扩展)                              │
│   WAVE (Web Accessibility Evaluation Tool)               │
│   Lighthouse Accessibility 分数                           │
│   Pa11y (CLI 自动化)                                      │
│   axe-core (集成测试)                                     │
│                                                          │
│ 手动测试                                                  │
│   纯键盘导航 (Tab/Shift+Tab/Enter/Escape)                 │
│   屏幕阅读器 (NVDA/VoiceOver/JAWS)                        │
│   200% 缩放测试                                          │
│   色盲模拟                                               │
│   纯文本浏览器 (Lynx)                                     │
└─────────────────────────────────────────────────────────┘
```

### 8.2 自动化 A11y 测试 (Playwright + axe-core)

```javascript
// accessibility.test.js — 自动化 A11y 测试
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('商品页面无 A11y 违规', async ({ page }) => {
  await page.goto('/products/cloudphone-pro-max-256gb');
  
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .exclude('*.ad-banner') // 排除广告区域
    .analyze();
  
  // 不应有严重违规
  expect(results.violations).toHaveLength(0);
  
  // 输出报告
  if (results.violations.length > 0) {
    console.table(results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length
    })));
  }
});

test('键盘导航完整覆盖', async ({ page }) => {
  await page.goto('/products/cloudphone-pro-max-256gb');
  
  // Tab 键遍历所有可交互元素
  const focusable = await page.locator(
    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ).all();
  
  for (const el of focusable) {
    await el.focus();
    const isVisible = await el.isVisible();
    if (isVisible) {
      // 焦点元素应可见
      await expect(el).toBeVisible();
    }
  }
});

test('屏幕阅读器正确朗读', async ({ page }) => {
  await page.goto('/products/cloudphone-pro-max-256gb');
  
  // 检查可访问名称
  const addToCart = page.getByRole('button', { name: /加入购物车/ });
  await expect(addToCart).toBeVisible();
  
  // 检查 aria-label
  const mainImage = page.getByRole('img', { name: /CloudPhone Pro Max 正面视图/ });
  await expect(mainImage).toBeVisible();
  
  // 检查面包屑
  const breadcrumb = page.getByRole('navigation', { name: '面包屑' });
  await expect(breadcrumb).toBeVisible();
});

test('颜色对比度达标', async ({ page }) => {
  await page.goto('/products/cloudphone-pro-max-256gb');
  
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2aa'])
    .include('body')
    .analyze();
  
  const contrastViolations = results.violations.filter(v => v.id === 'color-contrast');
  expect(contrastViolations).toHaveLength(0);
});
```

---

## 九、关键要点总结

### SEO 核心

1. **语义化 HTML 是 SEO 的根基** — 搜索引擎首先理解的是 HTML 结构
2. **结构化数据是 SEO 的加速器** — Rich Snippets 提升 CTR 20-30%
3. **Core Web Vitals 是排名信号** — LCP/INP/CLS 直接影响排名
4. **唯一 h1 + 清晰标题层级** — 帮助搜索引擎理解内容结构
5. **描述性 alt + 图片 SEO** — 图片搜索占 Google 27% 流量

### A11y 核心

1. **语义化 HTML 是 A11y 的根基** — 与 SEO 共享同一基础
2. **ARIA 是补充，不是替代** — 优先用原生元素
3. **键盘可访问是底线** — 所有功能必须键盘可达
4. **焦点管理是核心** — 对话框/标签页/模态框必须管理焦点
5. **可访问名称是必须** — 所有交互元素必须有可访问名称

### 三角关系

```
        SEO
       /   \
      /     \
   HTML ←→ A11y
  (语义化)
  
语义化 HTML 是 SEO 和 A11y 的最大交集。
做好语义化 = 同时做好 SEO 和 A11y 的 60%。
```

### 优化优先级

```
P0 (必须做):
  ✅ 语义化 HTML (h1-h6, nav, main, article, section, aside)
  ✅ 图片 alt 文本
  ✅ 表单 label
  ✅ 键盘可访问
  ✅ 结构化数据 (Product, Offer, BreadcrumbList)
  ✅ 页面标题和描述

P1 (应该做):
  ✅ ARIA 地标和角色
  ✅ Open Graph / Twitter Card
  ✅ 焦点管理 (对话框/标签页)
  ✅ 对比度 ≥ 4.5:1
  ✅ 图片性能优化 (WebP/AVIF, srcset)
  ✅ Core Web Vitals

P2 (最好做):
  ✅ 自动化 A11y 测试
  ✅ 屏幕阅读器测试
  ✅ 完整 Schema.org 标记
  ✅ 多语言支持 (hreflang)
  ✅ 减少动画偏好
  ✅ 深色模式支持
```

---

## 十、Before/After 对比

| 指标 | Before (div 地狱) | After (语义化 + ARIA + 结构化数据) |
|------|-------------------|-----------------------------------|
| 语义标签 | 0 个 | 20+ 个 (header/nav/main/article/section/aside/footer/dl/figure/figcaption/details) |
| 标题层级 | 无 h1-h6 | h1×1, h2×4, h3×2 — 清晰层级 |
| 图片 alt | 0 个 | 8 个描述性 alt |
| 表单 label | 0 个 | 搜索框 label + 颜色/存储 radio 组 fieldset/legend |
| 结构化数据 | 0 项 | Product + Offer + AggregateRating + Review + BreadcrumbList + WebSite + Organization |
| ARIA 角色 | 0 个 | tablist/tab/tabpanel, radiogroup/radio, dialog, search, list |
| 键盘导航 | 不可用 | 完整 Tab/Shift+Tab/Arrow/Home/End 支持 |
| 焦点管理 | 无 | 跳过链接 + 对话框焦点陷阱 + 标签页焦点管理 |
| OG/Twitter | 无 | 完整 Open Graph + Twitter Card |
| Lighthouse SEO | ~45 | ~98 |
| Lighthouse A11y | ~35 | ~97 |

---

*专项训练完成。语义化 HTML + ARIA + 结构化数据 = SEO 和 A11y 的终极答案。*
