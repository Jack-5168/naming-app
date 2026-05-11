# SEO / 无障碍 (A11y) 专项训练

> 专项训练 20:00 | 主题：语义化 HTML / ARIA / 结构化数据 | 优化 1 个完整页面
> 2026-05-07

---

## 场景：电商产品详情页

假设你有一个典型的电商产品页面，初始版本存在大量 SEO 和 A11y 问题。任务：逐层优化。

---

## 初始页面（问题版）

```html
<!DOCTYPE html>
<html>
<head>
  <title>Product Page</title>
</head>
<body>
  <div class="header">
    <div class="logo">MyShop</div>
    <div class="nav">
      <div class="nav-item">Home</div>
      <div class="nav-item">Products</div>
      <div class="nav-item">About</div>
    </div>
    <div class="search">
      <input type="text" placeholder="Search...">
      <div class="search-btn">Go</div>
    </div>
  </div>

  <div class="breadcrumb">
    <span>Home</span> / <span>Electronics</span> / <span>Headphones</span>
  </div>

  <div class="product">
    <div class="product-gallery">
      <img src="headphones-black.jpg">
      <img src="headphones-white.jpg">
      <img src="headphones-blue.jpg">
    </div>
    <div class="product-info">
      <div class="product-title">Wireless Headphones Pro Max</div>
      <div class="price">$299.99</div>
      <div class="old-price">$399.99</div>
      <div class="rating">4.5 stars (128 reviews)</div>
      <div class="description">
        Premium wireless headphones with active noise cancellation,
        30-hour battery life, and Hi-Res audio support.
      </div>
      <div class="options">
        <div class="color-option selected">Black</div>
        <div class="color-option">White</div>
        <div class="color-option">Blue</div>
      </div>
      <div class="quantity">
        <div class="qty-btn">-</div>
        <span>1</span>
        <div class="qty-btn">+</div>
      </div>
      <div class="add-to-cart">Add to Cart</div>
      <div class="wishlist">❤️</div>
    </div>
  </div>

  <div class="reviews">
    <div class="review">
      <div class="reviewer">John D.</div>
      <div class="review-rating">★★★★★</div>
      <div class="review-text">Amazing sound quality!</div>
      <div class="review-date">2026-04-15</div>
    </div>
    <div class="review">
      <div class="reviewer">Sarah M.</div>
      <div class="review-rating">★★★★☆</div>
      <div class="review-text">Great headphones, slightly heavy.</div>
      <div class="review-date">2026-04-10</div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-links">
      <div>Privacy Policy</div>
      <div>Terms of Service</div>
      <div>Contact Us</div>
    </div>
    <div>© 2026 MyShop</div>
  </div>
</body>
</html>
```

**问题清单（共 40+ 项）：**
- 无 lang 属性
- 无 meta 描述/关键词/OG 标签
- 全部用 div 代替语义标签
- 图片无 alt 属性
- 导航不是列表/链接
- 搜索框无 label
- 按钮用 div 代替
- 无 ARIA 角色/属性
- 无结构化数据 (JSON-LD)
- 无 canonical URL
- 颜色选择器无键盘交互
- 数量选择器无键盘交互
- 评论无结构化标记
- 面包屑无结构化标记
- 评分无结构化标记
- 价格无结构化标记
- 无 skip link
- 无 main landmark
- 无 focus 管理
- 无 reduced motion 支持
- 颜色对比度未验证
- 无 viewport meta
- 无 hreflang
- 无 sitemap 声明
- 无 robots meta
- 评论日期非 machine-readable
- 评论评分非 machine-readable
- 无 BreadcrumbList 结构化数据
- 无 Product 结构化数据
- 无 Review 结构化数据
- 无 Organization 结构化数据
- 无 Offer 结构化数据
- 无 AggregateRating 结构化数据
- 无 logo 的结构化数据
- 无 SearchAction
- 无 social meta (Twitter Card)
- 无 favicon
- 无 preconnect/preload

---

## 优化 1：语义化 HTML 重构

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wireless Headphones Pro Max - Active Noise Cancelling | MyShop</title>
  <meta name="description" content="Premium wireless headphones with active noise cancellation, 30-hour battery life, and Hi-Res audio. Rated 4.5/5 stars. Free shipping on orders over $50.">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="https://www.myshop.com/products/wireless-headphones-pro-max">

  <!-- Open Graph -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="Wireless Headphones Pro Max - Active Noise Cancelling">
  <meta property="og:description" content="Premium wireless headphones with active noise cancellation, 30-hour battery life, and Hi-Res audio.">
  <meta property="og:image" content="https://www.myshop.com/images/products/headphones-pro-max-og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="https://www.myshop.com/products/wireless-headphones-pro-max">
  <meta property="og:site_name" content="MyShop">
  <meta property="product:price:amount" content="299.99">
  <meta property="product:price:currency" content="USD">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Wireless Headphones Pro Max - Active Noise Cancelling">
  <meta name="twitter:description" content="Premium wireless headphones with active noise cancellation, 30-hour battery life.">
  <meta name="twitter:image" content="https://www.myshop.com/images/products/headphones-pro-max-twitter.jpg">

  <!-- Favicon -->
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">

  <!-- Preconnect -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://cdn.myshop.com" crossorigin>

  <!-- hreflang -->
  <link rel="alternate" hreflang="en" href="https://www.myshop.com/products/wireless-headphones-pro-max">
  <link rel="alternate" hreflang="zh" href="https://www.myshop.com/zh/products/wireless-headphones-pro-max">
  <link rel="alternate" hreflang="x-default" href="https://www.myshop.com/products/wireless-headphones-pro-max">
</head>
<body>
  <!-- Skip Link -->
  <a href="#main-content" class="skip-link">Skip to main content</a>

  <header role="banner">
    <nav aria-label="Main navigation">
      <a href="/" class="logo" aria-label="MyShop - Home">
        <img src="/logo.svg" alt="MyShop" width="120" height="40">
      </a>
      <ul class="nav-list">
        <li><a href="/">Home</a></li>
        <li><a href="/products">Products</a></li>
        <li><a href="/about">About</a></li>
      </ul>
      <form role="search" action="/search" method="get" aria-label="Search products">
        <label for="search-input" class="sr-only">Search products</label>
        <input type="search" id="search-input" name="q" placeholder="Search products..."
               autocomplete="off" aria-describedby="search-help" required>
        <span id="search-help" class="sr-only">Enter product name or keywords</span>
        <button type="submit" aria-label="Submit search">
          <svg aria-hidden="true" width="20" height="20">
            <use href="#icon-search"></use>
          </svg>
        </button>
      </form>
    </nav>
  </header>

  <!-- Breadcrumb -->
  <nav aria-label="Breadcrumb">
    <ol class="breadcrumb">
      <li><a href="/">Home</a></li>
      <li><a href="/products/electronics">Electronics</a></li>
      <li><a href="/products/headphones">Headphones</a></li>
      <li aria-current="page">Wireless Headphones Pro Max</li>
    </ol>
  </nav>

  <main id="main-content">
    <article itemscope itemtype="https://schema.org/Product">
      <!-- Product Gallery -->
      <section aria-label="Product images">
        <figure itemprop="image" itemscope itemtype="https://schema.org/ImageObject">
          <img src="headphones-black.jpg"
               alt="Wireless Headphones Pro Max in black color, front view showing ear cups and headband"
               itemprop="contentUrl"
               width="800" height="800"
               loading="eager"
               fetchpriority="high">
          <figcaption itemprop="description">Wireless Headphones Pro Max - Black</figcaption>
        </figure>
        <!-- Thumbnail gallery -->
        <div class="gallery-thumbs" role="list" aria-label="Product image thumbnails">
          <button type="button" role="listitem" aria-label="View black color"
                  aria-current="true" class="thumb active">
            <img src="headphones-black-thumb.jpg" alt="" width="80" height="80" loading="lazy">
          </button>
          <button type="button" role="listitem" aria-label="View white color">
            <img src="headphones-white-thumb.jpg" alt="" width="80" height="80" loading="lazy">
          </button>
          <button type="button" role="listitem" aria-label="View blue color">
            <img src="headphones-blue-thumb.jpg" alt="" width="80" height="80" loading="lazy">
          </button>
        </div>
      </section>

      <!-- Product Info -->
      <section aria-label="Product details">
        <h1 itemprop="name">Wireless Headphones Pro Max</h1>

        <!-- Aggregate Rating -->
        <div itemprop="aggregateRating" itemscope itemtype="https://schema.org/AggregateRating">
          <div class="rating" role="img" aria-label="Rated 4.5 out of 5 stars">
            <span class="stars" aria-hidden="true">★★★★☆</span>
            <meta itemprop="ratingValue" content="4.5">
            <meta itemprop="bestRating" content="5">
            <meta itemprop="worstRating" content="1">
            <meta itemprop="ratingCount" content="128">
          </div>
          <a href="#reviews" class="review-count">
            <span itemprop="reviewCount">128</span> reviews
          </a>
        </div>

        <!-- Price / Offer -->
        <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          <meta itemprop="url" content="https://www.myshop.com/products/wireless-headphones-pro-max">
          <meta itemprop="priceCurrency" content="USD">
          <meta itemprop="price" content="299.99">
          <meta itemprop="itemCondition" content="https://schema.org/NewCondition">
          <meta itemprop="availability" content="https://schema.org/InStock">
          <link itemprop="seller" href="https://www.myshop.com"
                href="https://schema.org/MyShop">

          <p class="price">
            <span class="current-price" aria-label="Price: $299.99">
              $<span itemprop="price">299.99</span>
            </span>
            <span class="old-price" aria-label="Original price: $399.99">
              $<del>399.99</del>
            </span>
            <span class="discount-badge" aria-label="25 percent off">Save 25%</span>
          </p>
        </div>

        <!-- Description -->
        <div itemprop="description" class="product-description">
          <p>Premium wireless headphones with <strong>active noise cancellation</strong>,
          <strong>30-hour battery life</strong>, and <strong>Hi-Res audio</strong> support.</p>
          <ul>
            <li>Active Noise Cancellation (ANC)</li>
            <li>30-hour battery life</li>
            <li>Hi-Res Audio certified</li>
            <li>Bluetooth 5.3 with multipoint</li>
            <li>Quick charge: 5 min = 3 hours playback</li>
            <li>Foldable design with carrying case</li>
          </ul>
        </div>

        <!-- Color Selector -->
        <fieldset class="color-selector">
          <legend>Color: <span id="selected-color">Black</span></legend>
          <div role="radiogroup" aria-labelledby="color-label">
            <span id="color-label" class="sr-only">Select a color</span>
            <input type="radio" name="color" id="color-black" value="black" checked
                   aria-label="Black">
            <label for="color-black" class="color-swatch black"
                   style="background-color: #1a1a1a;" aria-label="Black"></label>

            <input type="radio" name="color" id="color-white" value="white"
                   aria-label="White">
            <label for="color-white" class="color-swatch white"
                   style="background-color: #f5f5f5; border: 1px solid #ddd;"
                   aria-label="White"></label>

            <input type="radio" name="color" id="color-blue" value="blue"
                   aria-label="Navy Blue">
            <label for="color-blue" class="color-swatch blue"
                   style="background-color: #1e3a5f;" aria-label="Navy Blue"></label>
          </div>
        </fieldset>

        <!-- Quantity -->
        <div class="quantity-selector">
          <label for="quantity">Quantity:</label>
          <div class="qty-controls">
            <button type="button" aria-label="Decrease quantity" disabled>−</button>
            <input type="number" id="quantity" name="quantity" value="1" min="1" max="10"
                   aria-label="Product quantity" aria-describedby="qty-help">
            <span id="qty-help" class="sr-only">Maximum 10 items per order</span>
            <button type="button" aria-label="Increase quantity">+</button>
          </div>
        </div>

        <!-- Actions -->
        <div class="product-actions">
          <form action="/cart/add" method="post">
            <input type="hidden" name="product_id" value="wh-pro-max-001">
            <input type="hidden" name="color" value="black">
            <button type="submit" class="btn-primary" aria-label="Add Wireless Headphones Pro Max to cart">
              Add to Cart — $299.99
            </button>
          </form>
          <button type="button" class="btn-wishlist"
                  aria-label="Add to wishlist" aria-pressed="false">
            <svg aria-hidden="true" width="24" height="24">
              <use href="#icon-heart"></use>
            </svg>
          </button>
        </div>
      </section>
    </article>

    <!-- Reviews Section -->
    <section id="reviews" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading">Customer Reviews</h2>

      <article class="review" itemprop="review" itemscope itemtype="https://schema.org/Review">
        <div itemprop="author" itemscope itemtype="https://schema.org/Person">
          <p class="reviewer" itemprop="name">John D.</p>
        </div>
        <div itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">
          <span class="review-rating" role="img" aria-label="5 out of 5 stars">
            <span aria-hidden="true">★★★★★</span>
          </span>
          <meta itemprop="ratingValue" content="5">
          <meta itemprop="bestRating" content="5">
        </div>
        <p itemprop="reviewBody">Amazing sound quality!</p>
        <time itemprop="datePublished" datetime="2026-04-15">April 15, 2026</time>
      </article>

      <article class="review" itemprop="review" itemscope itemtype="https://schema.org/Review">
        <div itemprop="author" itemscope itemtype="https://schema.org/Person">
          <p class="reviewer" itemprop="name">Sarah M.</p>
        </div>
        <div itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">
          <span class="review-rating" role="img" aria-label="4 out of 5 stars">
            <span aria-hidden="true">★★★★☆</span>
          </span>
          <meta itemprop="ratingValue" content="4">
          <meta itemprop="bestRating" content="5">
        </div>
        <p itemprop="reviewBody">Great headphones, slightly heavy.</p>
        <time itemprop="datePublished" datetime="2026-04-10">April 10, 2026</time>
      </article>
    </section>
  </main>

  <footer role="contentinfo">
    <nav aria-label="Footer navigation">
      <ul>
        <li><a href="/privacy">Privacy Policy</a></li>
        <li><a href="/terms">Terms of Service</a></li>
        <li><a href="/contact">Contact Us</a></li>
      </ul>
    </nav>
    <p>© 2026 MyShop. All rights reserved.</p>
  </footer>
</body>
</html>
```

---

## 优化 2：JSON-LD 结构化数据

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      "@id": "https://www.myshop.com/products/wireless-headphones-pro-max#product",
      "name": "Wireless Headphones Pro Max",
      "description": "Premium wireless headphones with active noise cancellation, 30-hour battery life, and Hi-Res audio support.",
      "brand": {
        "@type": "Brand",
        "name": "MyShop Audio"
      },
      "image": [
        "https://www.myshop.com/images/products/headphones-black.jpg",
        "https://www.myshop.com/images/products/headphones-white.jpg",
        "https://www.myshop.com/images/products/headphones-blue.jpg"
      ],
      "sku": "WH-PRO-MAX-001",
      "mpn": "WH-PM-BLK-2026",
      "gtin13": "1234567890123",
      "offers": {
        "@type": "Offer",
        "url": "https://www.myshop.com/products/wireless-headphones-pro-max",
        "priceCurrency": "USD",
        "price": "299.99",
        "priceValidUntil": "2026-12-31",
        "itemCondition": "https://schema.org/NewCondition",
        "availability": "https://schema.org/InStock",
        "seller": {
          "@type": "Organization",
          "name": "MyShop"
        },
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "shippingRate": {
            "@type": "MonetaryAmount",
            "value": "0",
            "currency": "USD"
          },
          "deliveryTime": {
            "@type": "ShippingDeliveryTime",
            "handlingTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 1, "unitCode": "DAY" },
            "transitTime": { "@type": "QuantitativeValue", "minValue": 2, "maxValue": 5, "unitCode": "DAY" }
          }
        },
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "applicableCountry": "US",
          "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
          "merchantReturnDays": 30,
          "returnMethod": "https://schema.org/ReturnByMail",
          "returnFees": "https://schema.org/FreeReturn"
        }
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.5",
        "bestRating": "5",
        "worstRating": "1",
        "ratingCount": "128",
        "reviewCount": "128"
      },
      "review": [
        {
          "@type": "Review",
          "author": { "@type": "Person", "name": "John D." },
          "datePublished": "2026-04-15",
          "reviewBody": "Amazing sound quality!",
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": "5",
            "bestRating": "5"
          }
        },
        {
          "@type": "Review",
          "author": { "@type": "Person", "name": "Sarah M." },
          "datePublished": "2026-04-10",
          "reviewBody": "Great headphones, slightly heavy.",
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": "4",
            "bestRating": "5"
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
          "name": "Home",
          "item": "https://www.myshop.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Electronics",
          "item": "https://www.myshop.com/products/electronics"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "Headphones",
          "item": "https://www.myshop.com/products/headphones"
        },
        {
          "@type": "ListItem",
          "position": 4,
          "name": "Wireless Headphones Pro Max",
          "item": "https://www.myshop.com/products/wireless-headphones-pro-max"
        }
      ]
    },
    {
      "@type": "Organization",
      "@id": "https://www.myshop.com#organization",
      "name": "MyShop",
      "url": "https://www.myshop.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.myshop.com/logo.svg",
        "width": "120",
        "height": "40"
      },
      "sameAs": [
        "https://twitter.com/myshop",
        "https://www.facebook.com/myshop",
        "https://www.instagram.com/myshop"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+1-800-555-0123",
        "contactType": "customer service",
        "availableLanguage": ["English", "Chinese"]
      }
    },
    {
      "@type": "WebSite",
      "@id": "https://www.myshop.com#website",
      "url": "https://www.myshop.com",
      "name": "MyShop",
      "publisher": { "@id": "https://www.myshop.com#organization" },
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://www.myshop.com/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
  ]
}
</script>
```

---

## 优化 3：CSS 无障碍增强

```css
/* Skip Link */
.skip-link {
  position: absolute;
  top: -100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.75rem 1.5rem;
  background: #0066cc;
  color: #fff;
  font-weight: 600;
  text-decoration: none;
  border-radius: 0 0 8px 8px;
  z-index: 10000;
  transition: top 0.15s ease;
}

.skip-link:focus {
  top: 0;
  outline: 3px solid #ffcc00;
  outline-offset: 2px;
}

/* Screen Reader Only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Focus Styles */
*:focus-visible {
  outline: 3px solid #0066cc;
  outline-offset: 2px;
}

button:focus-visible,
a:focus-visible,
input:focus-visible {
  outline: 3px solid #0066cc;
  outline-offset: 2px;
  box-shadow: 0 0 0 6px rgba(0, 102, 204, 0.25);
}

/* High Contrast / Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

@media (prefers-contrast: high) {
  :root {
    --text-color: #000;
    --bg-color: #fff;
    --border-color: #000;
  }

  .color-swatch {
    border: 3px solid currentColor !important;
  }

  a {
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
  }
}

/* Color Swatch Selection Indicator */
input[type="radio"][name="color"]:checked + label {
  outline: 3px solid #0066cc;
  outline-offset: 2px;
  box-shadow: 0 0 0 1px #0066cc;
}

/* Breadcrumb Separator */
.breadcrumb li + li::before {
  content: "/";
  margin: 0 0.5rem;
  color: #666;
  /* Don't use content for meaningful separators — use aria-hidden */
}

/* Ensure minimum touch target size */
button,
[role="button"],
input[type="submit"],
input[type="button"] {
  min-height: 44px;
  min-width: 44px;
}

/* Print styles */
@media print {
  .skip-link,
  .product-actions,
  .gallery-thumbs,
  .color-selector,
  .quantity-selector {
    display: none !important;
  }

  .product-description {
    page-break-inside: avoid;
  }
}
```

---

## 优化 4：JavaScript 无障碍交互

```javascript
// Color Selector — Radio Button Pattern
document.querySelectorAll('input[name="color"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const color = e.target.value;
    const label = e.target.getAttribute('aria-label');
    document.getElementById('selected-color').textContent = label;

    // Update main image
    const mainImg = document.querySelector('figure img');
    mainImg.src = `headphones-${color}.jpg`;
    mainImg.alt = `Wireless Headphones Pro Max in ${label.toLowerCase()} color, front view`;

    // Update add to cart button text
    const addToCartBtn = document.querySelector('.btn-primary');
    addToCartBtn.setAttribute(
      'aria-label',
      `Add Wireless Headphones Pro Max in ${label} to cart`
    );

    // Update hidden form input
    document.querySelector('input[name="color"]').value = color;
  });
});

// Quantity Controls
const qtyInput = document.getElementById('quantity');
const qtyMinus = qtyInput.parentElement.querySelector('[aria-label="Decrease quantity"]');
const qtyPlus = qtyInput.parentElement.querySelector('[aria-label="Increase quantity"]');

qtyMinus.addEventListener('click', () => {
  const val = parseInt(qtyInput.value, 10);
  if (val > 1) {
    qtyInput.value = val - 1;
    qtyMinus.disabled = qtyInput.value <= 1;
    qtyPlus.disabled = false;
    announceToSR(`Quantity changed to ${qtyInput.value}`);
  }
});

qtyPlus.addEventListener('click', () => {
  const val = parseInt(qtyInput.value, 10);
  if (val < 10) {
    qtyInput.value = val + 1;
    qtyPlus.disabled = qtyInput.value >= 10;
    qtyMinus.disabled = false;
    announceToSR(`Quantity changed to ${qtyInput.value}`);
  }
});

qtyInput.addEventListener('change', () => {
  let val = parseInt(qtyInput.value, 10);
  if (isNaN(val) || val < 1) val = 1;
  if (val > 10) val = 10;
  qtyInput.value = val;
  qtyMinus.disabled = val <= 1;
  qtyPlus.disabled = val >= 10;
});

// Live Region for announcements
function announceToSR(message) {
  let region = document.getElementById('sr-announcements');
  if (!region) {
    region = document.createElement('div');
    region.id = 'sr-announcements';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.className = 'sr-only';
    document.body.appendChild(region);
  }
  region.textContent = '';
  // Small delay ensures screen readers pick up the change
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

// Wishlist Toggle
const wishlistBtn = document.querySelector('.btn-wishlist');
wishlistBtn.addEventListener('click', () => {
  const isPressed = wishlistBtn.getAttribute('aria-pressed') === 'true';
  wishlistBtn.setAttribute('aria-pressed', String(!isPressed));
  wishlistBtn.setAttribute(
    'aria-label',
    isPressed ? 'Add to wishlist' : 'Remove from wishlist'
  );
  announceToSR(isPressed ? 'Removed from wishlist' : 'Added to wishlist');
});

// Gallery Thumbnail Navigation
const thumbs = document.querySelectorAll('.gallery-thumbs button');
thumbs.forEach((thumb, index) => {
  thumb.addEventListener('click', () => {
    thumbs.forEach(t => {
      t.classList.remove('active');
      t.removeAttribute('aria-current');
    });
    thumb.classList.add('active');
    thumb.setAttribute('aria-current', 'true');
  });

  // Keyboard navigation with arrow keys
  thumb.addEventListener('keydown', (e) => {
    let nextIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % thumbs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + thumbs.length) % thumbs.length;
    }
    if (nextIndex !== undefined) {
      thumbs[nextIndex].focus();
      thumbs[nextIndex].click();
    }
  });
});
```

---

## 优化 5：性能与 SEO 最佳实践

```html
<!-- Preload critical image -->
<link rel="preload" as="image" href="headphones-black.jpg"
      imagesrcset="headphones-black-400.jpg 400w,
                   headphones-black-800.jpg 800w,
                   headphones-black-1200.jpg 1200w"
      imagesizes="(max-width: 768px) 400px, (max-width: 1200px) 800px, 1200px">

<!-- Responsive image with srcset -->
<picture>
  <source srcset="headphones-black.webp 800w, headphones-black.webp 1200w"
          type="image/webp"
          sizes="(max-width: 768px) 400px, 800px">
  <source srcset="headphones-black.jpg 800w, headphones-black.jpg 1200w"
          type="image/jpeg"
          sizes="(max-width: 768px) 400px, 800px">
  <img src="headphones-black.jpg"
       alt="Wireless Headphones Pro Max in black color, front view showing ear cups and headband"
       width="800" height="800"
       loading="eager"
       fetchpriority="high">
</picture>

<!-- Lazy load non-critical images -->
<img src="headphones-white.jpg"
     alt="Wireless Headphones Pro Max in white color"
     width="800" height="800"
     loading="lazy"
     decoding="async">

<!-- Defer non-critical JS -->
<script src="analytics.js" defer></script>
<script src="chat-widget.js" defer></script>

<!-- Async critical JS -->
<script src="color-selector.js" async></script>
```

---

## 检查清单（Checklist）

### SEO 检查
- [x] `lang` 属性设置
- [x] `<title>` 包含关键词且 ≤60 字符
- [x] `<meta description>` ≤155 字符
- [x] `canonical` URL
- [x] Open Graph 标签完整
- [x] Twitter Card 标签
- [x] `robots` meta
- [x] `hreflang` 多语言
- [x] 结构化数据 JSON-LD（Product、BreadcrumbList、Organization、WebSite）
- [x] 图片 `width`/`height` 防止 CLS
- [x] `fetchpriority="high"` 用于首屏图片
- [x] `loading="lazy"` 用于非首屏图片
- [x] `preload` 关键资源
- [x] H1 唯一且包含关键词
- [x] 语义化 heading 层级（H1 → H2 → H3）
- [x] 内部链接使用描述性锚文本

### 无障碍检查
- [x] Skip link
- [x] 所有交互元素可用键盘操作
- [x] 焦点可见（focus-visible）
- [x] 语义化 HTML（header/nav/main/footer/article/section/figure）
- [x] ARIA 角色和属性（radiogroup、aria-label、aria-live、aria-pressed）
- [x] 图片 alt 文本描述性
- [x] 装饰性图片 `alt=""`
- [x] 颜色选择器使用 `<input type="radio">` + `<label>`
- [x] 屏幕阅读器专属文本（.sr-only）
- [x] `prefers-reduced-motion` 支持
- [x] `prefers-contrast` 支持
- [x] 触摸目标 ≥44×44px
- [x] 颜色对比度 ≥4.5:1（WCAG AA）
- [x] 表单 label 关联
- [x] 错误状态可访问
- [x] `aria-current="page"` 面包屑
- [x] `aria-pressed` 切换按钮
- [x] `aria-live` 区域动态更新
- [x] 箭头键导航缩略图

---

## 关键知识点速查

### 语义化 HTML 标签映射

| 非语义 div | 语义标签 | ARIA 补充 |
|---|---|---|
| `<div class="header">` | `<header>` | `role="banner"` |
| `<div class="nav">` | `<nav>` | `aria-label="Main navigation"` |
| `<div class="main">` | `<main>` | `id="main-content"` |
| `<div class="footer">` | `<footer>` | `role="contentinfo"` |
| `<div class="article">` | `<article>` | — |
| `<div class="section">` | `<section>` | `aria-labelledby` |
| `<div class="aside">` | `<aside>` | — |
| `<div class="search">` | `<form role="search">` | — |
| `<div class="btn">` | `<button>` | — |
| `<div class="link">` | `<a href="...">` | — |
| `<div class="img">` | `<figure>` + `<img>` | — |
| `<div class="list">` | `<ul>`/`<ol>` | — |

### ARIA 模式速查

| 组件 | 角色/模式 | 关键属性 |
|---|---|---|
| 导航 | `<nav aria-label="...">` | — |
| 搜索 | `<form role="search">` | `aria-label` on form |
| 单选组 | `role="radiogroup"` | `<input type="radio">` + `<label>` |
| 切换按钮 | `<button aria-pressed="false">` | — |
| 面包屑 | `<nav aria-label="Breadcrumb">` | `aria-current="page"` |
| 动态通知 | `role="status"` + `aria-live="polite"` | `aria-atomic="true"` |
| 警告 | `role="alert"` | 自动 aria-live=assertive |
| 对话框 | `role="dialog"` | `aria-modal="true"` |
| 标签页 | `role="tablist"/"tab"/"tabpanel"` | `aria-selected`, `aria-controls` |
| 手风琴 | `<details>/<summary>` | 原生替代 ARIA accordion |
| 星级评分 | `role="img"` + `aria-label="X out of 5 stars"` | 隐藏视觉星号 `aria-hidden` |

### JSON-LD 类型速查

| 类型 | 用途 | 必填字段 |
|---|---|---|
| `Product` | 商品信息 | name, image, description |
| `Offer` | 价格/库存 | price, priceCurrency, availability |
| `AggregateRating` | 综合评分 | ratingValue, ratingCount |
| `Review` | 用户评论 | author, reviewBody, reviewRating |
| `BreadcrumbList` | 面包屑导航 | itemListElement[] |
| `Organization` | 公司信息 | name, url, logo |
| `WebSite` | 网站信息 | url, name, potentialAction |
| `SearchAction` | 站内搜索 | target, query-input |

---

## 常见错误与修复

### ❌ 错误 1：用 div 做按钮
```html
<!-- 坏 -->
<div class="btn" onclick="addToCart()">Add to Cart</div>
<!-- 好 -->
<button type="button" onclick="addToCart()">Add to Cart</button>
```

### ❌ 错误 2：图片无 alt
```html
<!-- 坏 -->
<img src="product.jpg">
<!-- 好 -->
<img src="product.jpg" alt="Wireless Headphones Pro Max in black">
<!-- 装饰性图片 -->
<img src="decoration.png" alt="" role="presentation">
```

### ❌ 错误 3：缺少 label 的表单
```html
<!-- 坏 -->
<input type="email" placeholder="Email">
<!-- 好 -->
<label for="email">Email address</label>
<input type="email" id="email" placeholder="Email" required>
```

### ❌ 错误 4：颜色仅靠视觉区分
```html
<!-- 坏：仅用背景色区分，色盲用户无法识别 -->
<div class="color black"></div>
<div class="color white"></div>
<!-- 好：使用 radio + label + 边框指示 -->
<input type="radio" name="color" id="color-black" value="black">
<label for="color-black" class="color-swatch black">Black</label>
```

### ❌ 错误 5：结构化数据不完整
```json
// 坏：缺少价格货币和库存状态
{
  "@type": "Offer",
  "price": "299.99"
}
// 好
{
  "@type": "Offer",
  "priceCurrency": "USD",
  "price": "299.99",
  "availability": "https://schema.org/InStock",
  "itemCondition": "https://schema.org/NewCondition"
}
```

---

## 验证工具

1. **Google Rich Results Test** — 验证结构化数据是否生效
2. **Lighthouse** — 综合 SEO + A11y 评分
3. **WAVE** — 无障碍可视化检测
4. **axe DevTools** — 浏览器扩展，深度 A11y 审计
5. **Google Search Console** — 监控搜索表现和结构化数据错误
6. **Screen Reader** — NVDA (Win) / VoiceOver (Mac) 实际测试
7. **WebAIM Contrast Checker** — 颜色对比度验证

---

_本专项训练覆盖：语义化 HTML 5 标签、ARIA 角色/属性/状态、JSON-LD 结构化数据（Product/Offer/Review/BreadcrumbList/Organization/WebSite）、CSS 无障碍增强（skip link、focus、reduced motion、high contrast）、JS 无障碍交互（live region、键盘导航、aria-pressed）、性能优化（preload、lazy loading、srcset）。_
