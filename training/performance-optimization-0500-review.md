# Web 性能优化 — 查漏补缺 + 实战扩展 (2026-04-27 05:00)

**前置基础：**
- 4/24 基础版：懒加载 / 防抖节流 / 内存管理 / 虚拟列表 (808 行)
- 4/25 进阶版：CRP / Web Vitals / 重排优化 / 网络层
- 4/26 综合实战：三合一整合 — 高性能数据看板 (1415 行)

**本次重点：** 查漏补缺 + 三个新实战场景（SSR 性能优化、Canvas/WebGL 性能、Service Worker 缓存策略）

---

## 一、查漏补缺 — 之前可能遗漏的关键点

### 1.1 关键渲染路径 (CRP) 深度优化

```javascript
/**
 * CRP 优化 Checklist：
 * 
 * 1. CSS 阻塞渲染 → 内联关键 CSS，异步加载非关键 CSS
 * 2. JS 阻塞解析 → defer/async + 代码分割
 * 3. DOM 树构建 → 减少 DOM 节点数 (< 1500)
 * 4. 渲染树构建 → 避免 display:none 占位
 * 5. 布局 (Layout) → 避免强制同步布局
 * 6. 绘制 (Paint) → 减少绘制区域
 * 7. 合成 (Composite) → 使用 will-change / transform
 */

// === 关键 CSS 内联 ===
// HTML 头部内联关键 CSS（首屏可见区域的样式）
const criticalCSS = `
  .header { height: 60px; background: #fff; position: sticky; top: 0; }
  .hero { min-height: 100vh; display: flex; align-items: center; }
  .hero h1 { font-size: 3rem; }
`;

// 非关键 CSS 异步加载
function loadNonCriticalCSS(href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.media = 'print'; // 先标记为 print（不阻塞渲染）
  link.onload = () => link.media = 'all'; // 加载完成后切换为 all
  document.head.appendChild(link);
}

// === JS defer vs async ===
// defer: 按顺序执行，DOM 解析完成后执行（适合依赖 DOM 的脚本）
// async: 下载完成后立即执行，不保证顺序（适合独立脚本如分析）

// === 减少 DOM 节点数 ===
// ❌ 反模式：过度嵌套
// <div class="wrapper"><div class="inner"><div class="content">...</div></div></div>

// ✅ 正模式：扁平化
// <section class="content">...</section>

// === 避免强制同步布局 (Layout Thrashing) ===

// ❌ 反模式：读写交替，触发多次重排
function badLayoutUpdate() {
  for (let i = 0; i < boxes.length; i++) {
    const height = boxes[i].offsetHeight; // 读 → 强制同步布局
    boxes[i].style.height = `${height * 2}px`; // 写 → 标记需要重排
  }
}

// ✅ 正模式：读写分离
function goodLayoutUpdate() {
  // 第一步：读取所有值（批量读）
  const heights = boxes.map(box => box.offsetHeight);
  
  // 第二步：写入所有值（批量写）
  boxes.forEach((box, i) => {
    box.style.height = `${heights[i] * 2}px`;
  });
}

// ✅ 更好的方案：使用 requestAnimationFrame
function rAFLayoutUpdate() {
  requestAnimationFrame(() => {
    // rAF 回调在布局前执行，浏览器会批量处理
    boxes.forEach(box => {
      const height = box.offsetHeight;
      box.style.height = `${height * 2}px`;
    });
  });
}

// === 使用 transform 替代 top/left 避免重排 ===

// ❌ 反模式：修改 top/left 触发重排
element.style.top = `${y}px`;
element.style.left = `${x}px`;

// ✅ 正模式：使用 transform 只触发合成
element.style.transform = `translate(${x}px, ${y}px)`;

// === will-change 提示浏览器优化 ===
// 仅在动画元素上使用，不要滥用
.animated-element {
  will-change: transform, opacity;
  /* 动画结束后移除 will-change */
}

// JS 动态管理
function animateElement(el) {
  el.style.willChange = 'transform, opacity';
  el.addEventListener('animationend', () => {
    el.style.willChange = 'auto'; // 释放优化资源
  }, { once: true });
}
```

### 1.2 图片优化完整策略

```javascript
/**
 * 图片优化 Checklist：
 * 
 * 1. 格式选择：WebP > AVIF > JPEG > PNG > GIF
 * 2. 响应式图片：srcset + sizes + <picture>
 * 3. 懒加载：loading="lazy" / IntersectionObserver
 * 4. 占位图：blurhash / LQIP / 骨架屏
 * 5. 预加载：关键图片 <link rel="preload">
 * 6. 压缩：tinypng / imagemin / sharp
 * 7. CDN：图片自动压缩 + WebP 转换
 */

// === 响应式图片生成器 ===
class ResponsiveImage {
  constructor(basePath, widths = [320, 480, 768, 1024, 1440]) {
    this.basePath = basePath;
    this.widths = widths;
  }

  /**
   * 生成 <picture> 元素（支持 WebP + AVIF 降级）
   */
  createPicture(srcName, alt, options = {}) {
    const { quality = 80 } = options;
    
    const picture = document.createElement('picture');
    
    // AVIF 格式（最佳压缩）
    const avifSource = document.createElement('source');
    avifSource.type = 'image/avif';
    avifSource.srcset = this.widths
      .map(w => `${this.basePath}/avif/${srcName}-w${w}.avif ${w}w`)
      .join(', ');
    
    // WebP 格式
    const webpSource = document.createElement('source');
    webpSource.type = 'image/webp';
    webpSource.srcset = this.widths
      .map(w => `${this.basePath}/webp/${srcName}-w${w}.webp ${w}w`)
      .join(', ');
    
    // 原始 JPEG 降级
    const img = document.createElement('img');
    img.alt = alt;
    img.loading = 'lazy';
    img.decoding = 'async'; // 异步解码不阻塞
    img.srcset = this.widths
      .map(w => `${this.basePath}/jpeg/${srcName}-w${w}.jpg ${w}w`)
      .join(', ');
    img.sizes = options.sizes || '(max-width: 768px) 100vw, 50vw';
    
    picture.appendChild(avifSource);
    picture.appendChild(webpSource);
    picture.appendChild(img);
    
    return picture;
  }
}

// === 图片压缩（Node.js 服务端）===
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

async function compressImage(inputPath, outputDir, options = {}) {
  const {
    widths = [320, 480, 768, 1024, 1440],
    quality = 80,
    formats = ['webp', 'avif', 'jpeg']
  } = options;

  const metadata = await sharp(inputPath).metadata();
  const baseName = path.basename(inputPath, path.extname(inputPath));

  for (const format of formats) {
    for (const width of widths) {
      if (width > metadata.width) continue; // 不放大图片

      const outputName = `${baseName}-w${width}.${format}`;
      const outputPath = path.join(outputDir, format, outputName);

      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      let transformer = sharp(inputPath)
        .resize(width, null, { withoutEnlargement: true });

      if (format === 'webp') {
        await transformer.webp({ quality }).toFile(outputPath);
      } else if (format === 'avif') {
        await transformer.avif({ quality, effort: 9 }).toFile(outputPath);
      } else if (format === 'jpeg') {
        await transformer.jpeg({ quality, progressive: true }).toFile(outputPath);
      }
    }
  }
}

// === BlurHash 占位图 ===
/**
 * BlurHash 原理：将图片编码为极短字符串（~30 字符）
 * 解码后生成模糊预览图，用户几乎无感知
 */
class BlurHashImage {
  constructor(container) {
    this.container = container;
  }

  /**
   * 显示 BlurHash 占位图
   * @param {string} hash - BlurHash 编码字符串
   * @param {number} width - 目标宽度
   * @param {number} height - 目标高度
   */
  showPlaceholder(hash, width = 32, height = 32) {
    // 需要引入 blurhash 库
    const { decode } = require('blurhash');
    const pixels = decode(hash, width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);

    // 转换为 base64 作为占位图
    const placeholder = canvas.toDataURL('image/jpeg', 0.5);
    
    this.container.style.backgroundImage = `url(${placeholder})`;
    this.container.style.backgroundSize = 'cover';
    this.container.style.filter = 'blur(10px)';
    this.container.style.transform = 'scale(1.05)'; // 模糊边缘裁剪
  }

  /**
   * 加载真实图片并替换占位图
   */
  async loadRealImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.container.style.backgroundImage = `url(${src})`;
        this.container.style.filter = 'none';
        this.container.style.transform = 'none';
        this.container.style.transition = 'filter 0.3s ease, transform 0.3s ease';
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }
}
```

### 1.3 代码分割与 Tree Shaking 实战

```javascript
/**
 * 代码分割策略：
 * 
 * 1. 路由级分割：每个路由独立 chunk
 * 2. 组件级分割：重型组件独立 chunk
 * 3. 第三方库分割：vendor chunk 独立
 * 4. 按需导入：import() 动态加载
 * 
 * Tree Shaking 前提：
 * - ES Module (import/export)
 * - production mode
 * - sideEffects: false (package.json)
 */

// === 路由级代码分割 (React) ===
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));

function App() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Suspense>
  );
}

// === 组件级代码分割 ===
// 重型图表组件只在需要时加载
const HeavyChart = lazy(() => import('./components/HeavyChart'));

function ChartSection({ data }) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart data={data} />
    </Suspense>
  );
}

// === Webpack 代码分割配置 ===
const webpackConfig = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // 第三方库独立 chunk
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        // 公共组件独立 chunk
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
        // 图表库独立 chunk
        charts: {
          test: /[\\/]node_modules[\\/](echarts|chart\.js)[\\/]/,
          name: 'charts',
          chunks: 'all',
          priority: 20,
        },
      },
    },
  },
};

// === Vite 代码分割配置 ===
const viteConfig = {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 第三方库
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // 图表库
          charts: ['echarts'],
          // 工具库
          utils: ['lodash-es', 'date-fns'],
        },
      },
    },
  },
};
```

---

## 二、新实战场景 1：SSR 性能优化

```javascript
/**
 * SSR (服务端渲染) 性能优化
 * 
 * 核心挑战：
 * 1. TTFB (Time to First Byte) — 服务端响应时间
 * 2. 流式 HTML — 边生成边发送
 * 3. 水合 (Hydration) — 客户端激活交互
 * 4. 选择性水合 — 只水合可见区域
 */

// === 流式 SSR (Node.js) ===
const express = require('express');
const app = express();

app.get('/product/:id', async (req, res) => {
  const { id } = req.params;
  
  // 1. 先发送 HTML 头部（浏览器开始解析 CSS/JS）
  res.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Product ${id}</title>
      <link rel="stylesheet" href="/styles/critical.css">
      <link rel="preload" href="/styles/main.css" as="style">
      <link rel="stylesheet" href="/styles/main.css" media="print" onload="this.media='all'">
    </head>
    <body>
      <div id="app">
  `);

  // 2. 获取产品数据
  const product = await fetchProduct(id);

  // 3. 流式写入产品 HTML（不等评论数据）
  res.write(`
    <div class="product">
      <h1>${escapeHtml(product.name)}</h1>
      <p>${escapeHtml(product.description)}</p>
      <span class="price">¥${product.price}</span>
    </div>
  `);

  // 4. 评论数据异步获取（不阻塞首屏）
  const comments = await fetchComments(id);
  res.write(`
    <div class="comments">
      ${comments.map(c => `
        <div class="comment">
          <p>${escapeHtml(c.text)}</p>
          <small>${escapeHtml(c.author)}</small>
        </div>
      `).join('')}
    </div>
  `);

  // 5. 发送 HTML 尾部
  res.write(`
      </div>
      <script src="/js/app.js" defer></script>
    </body>
    </html>
  `);
  res.end();
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// === 选择性水合 (Partial Hydration) ===
/**
 * 核心思想：不是所有组件都需要水合
 * - 静态内容（标题/描述）→ 不需要 JS
 * - 交互内容（按钮/表单）→ 需要水合
 * - 延迟水合：可见区域先水合，其他等滚动到
 */

// 模拟选择性水合
class PartialHydration {
  constructor() {
    this.hydratedComponents = new Set();
    this.pendingComponents = new Map();
  }

  /**
   * 注册一个需要延迟水合的组件
   */
  register(selector, hydrateFn, options = {}) {
    const { visibleOnly = true } = options;
    const el = document.querySelector(selector);
    if (!el) return;

    if (visibleOnly) {
      // 只在可见时水合
      const observer = new IntersectionObserver(async (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.unobserve(entry.target);
            await this.hydrate(el, hydrateFn);
          }
        }
      }, { rootMargin: '200px' });

      observer.observe(el);
      this.pendingComponents.set(selector, { el, hydrateFn, observer });
    } else {
      // 空闲时水合
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => this.hydrate(el, hydrateFn));
      } else {
        setTimeout(() => this.hydrate(el, hydrateFn), 100);
      }
    }
  }

  async hydrate(el, hydrateFn) {
    if (this.hydratedComponents.has(el)) return;
    
    const startTime = performance.now();
    await hydrateFn(el);
    const duration = performance.now() - startTime;
    
    this.hydratedComponents.add(el);
    console.log(`[Hydration] ${el.className} 水合完成: ${duration.toFixed(2)}ms`);
  }

  /**
   * 强制水合所有待水合组件
   */
  async hydrateAll() {
    const promises = [];
    for (const [selector, { el, hydrateFn, observer }] of this.pendingComponents) {
      observer.disconnect();
      promises.push(this.hydrate(el, hydrateFn));
    }
    this.pendingComponents.clear();
    return Promise.all(promises);
  }
}

// === 使用示例 ===
const hydration = new PartialHydration();

// 评论组件 — 延迟水合（用户滚动到时才加载 JS）
hydration.register(
  '.comments-section',
  async (el) => {
    const { Comments } = await import('./components/Comments');
    Comments.mount(el);
  },
  { visibleOnly: true }
);

// 推荐组件 — 空闲时水合
hydration.register(
  '.recommendations',
  async (el) => {
    const { Recommendations } = await import('./components/Recommendations');
    Recommendations.mount(el);
  },
  { visibleOnly: false }
);

// 导航栏 — 立即水合（首屏交互）
hydration.hydrate(
  document.querySelector('.navbar'),
  async (el) => {
    const { Navbar } = await import('./components/Navbar');
    Navbar.mount(el);
  }
);
```

---

## 三、新实战场景 2：Canvas/WebGL 性能优化

```javascript
/**
 * Canvas/WebGL 性能优化
 * 
 * 核心原则：
 * 1. 减少绘制调用 (Draw Calls)
 * 2. 使用 OffscreenCanvas 在 Worker 中渲染
 * 3. 对象池复用
 * 4. 脏矩形更新 (Dirty Rectangle)
 * 5. 纹理图集 (Texture Atlas)
 */

// === 脏矩形更新 — 只重绘变化的区域 ===
class DirtyRectRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dirtyRects = [];
    this.objects = [];
  }

  /**
   * 标记一个区域需要重绘
   */
  markDirty(x, y, width, height) {
    this.dirtyRects.push({ x, y, width, height });
    this.mergeDirtyRects();
    if (!this.isAnimating) {
      this.isAnimating = true;
      requestAnimationFrame(() => this.render());
    }
  }

  /**
   * 合并重叠的脏矩形，减少绘制区域
   */
  mergeDirtyRects() {
    if (this.dirtyRects.length < 2) return;

    let merged = [this.dirtyRects[0]];
    for (let i = 1; i < this.dirtyRects.length; i++) {
      const rect = this.dirtyRects[i];
      let didMerge = false;

      for (let j = 0; j < merged.length; j++) {
        if (this.intersects(merged[j], rect)) {
          merged[j] = this.union(merged[j], rect);
          didMerge = true;
          break;
        }
      }

      if (!didMerge) {
        merged.push(rect);
      }
    }

    this.dirtyRects = merged;
  }

  intersects(a, b) {
    return !(
      b.x > a.x + a.width ||
      b.x + b.width < a.x ||
      b.y > a.y + a.height ||
      b.y + b.height < a.y
    );
  }

  union(a, b) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const width = Math.max(a.x + a.width, b.x + b.width) - x;
    const height = Math.max(a.y + a.height, b.y + b.height) - y;
    return { x, y, width, height };
  }

  /**
   * 只重绘脏矩形区域
   */
  render() {
    for (const rect of this.dirtyRects) {
      // 只清除脏区域
      this.ctx.clearRect(rect.x, rect.y, rect.width, rect.height);

      // 只绘制受影响的对象
      for (const obj of this.objects) {
        if (this.intersects(rect, obj.getBounds())) {
          obj.draw(this.ctx);
        }
      }
    }

    this.dirtyRects = [];
    this.isAnimating = false;
  }

  addObject(obj) {
    this.objects.push(obj);
  }
}

// === OffscreenCanvas — 在 Worker 中渲染 ===
// main.js
const canvas = document.getElementById('game-canvas');
const offscreen = canvas.transferControlToOffscreen();

const worker = new Worker('render-worker.js');
worker.postMessage({ canvas: offscreen }, [offscreen]);

// render-worker.js
let ctx = null;
let isRunning = true;

self.onmessage = (e) => {
  if (e.data.canvas) {
    ctx = e.data.canvas.getContext('2d');
    this.gameLoop();
  }
};

async function gameLoop() {
  while (isRunning) {
    const startTime = performance.now();

    // 更新游戏状态
    updateGameState();

    // 渲染
    render(ctx);

    // 计算帧时间
    const frameTime = performance.now() - startTime;
    const fps = Math.round(1000 / frameTime);

    // 如果帧时间 > 16.67ms (低于 60fps)，降低渲染质量
    if (frameTime > 16.67) {
      reduceRenderQuality();
    }

    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

// === 对象池 — 复用粒子对象 ===
class ParticlePool {
  constructor(initialSize = 100) {
    this.pool = [];
    this.active = new Set();

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createParticle());
    }
  }

  createParticle() {
    return {
      x: 0, y: 0,
      vx: 0, vy: 0,
      life: 0, maxLife: 0,
      active: false,
      // 重置方法
      reset(x, y, vx, vy, life) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.life = life; this.maxLife = life;
        this.active = true;
      }
    };
  }

  /**
   * 获取一个粒子（从池中复用或创建新的）
   */
  acquire(x, y, vx, vy, life) {
    let particle;

    if (this.pool.length > 0) {
      particle = this.pool.pop();
    } else {
      particle = this.createParticle();
    }

    particle.reset(x, y, vx, vy, life);
    this.active.add(particle);
    return particle;
  }

  /**
   * 释放粒子（回到池中）
   */
  release(particle) {
    particle.active = false;
    this.active.delete(particle);
    this.pool.push(particle);
  }

  /**
   * 更新所有活跃粒子
   */
  update(dt) {
    for (const particle of this.active) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;

      if (particle.life <= 0) {
        this.release(particle);
      }
    }
  }

  /**
   * 批量绘制
   */
  draw(ctx) {
    // 批量绘制 — 减少状态切换
    ctx.fillStyle = '#ff6b6b';
    for (const p of this.active) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  getStats() {
    return {
      active: this.active.size,
      available: this.pool.length,
      total: this.active.size + this.pool.length,
    };
  }
}

// === 使用示例：粒子系统 ===
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

const particlePool = new ParticlePool(500);
let lastTime = performance.now();

function animate(currentTime) {
  const dt = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  // 清除画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 发射新粒子
  for (let i = 0; i < 5; i++) {
    particlePool.acquire(
      canvas.width / 2, canvas.height / 2,
      (Math.random() - 0.5) * 200,
      (Math.random() - 0.5) * 200,
      2 + Math.random() * 2
    );
  }

  // 更新 + 绘制
  particlePool.update(dt);
  particlePool.draw(ctx);

  // 显示统计
  const stats = particlePool.getStats();
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.fillText(`Particles: ${stats.active} active / ${stats.available} available`, 10, 20);

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
```

---

## 四、新实战场景 3：Service Worker 缓存策略

```javascript
/**
 * Service Worker 缓存策略
 * 
 * 五种策略：
 * 1. Cache First — 先查缓存，缓存未命中再请求
 * 2. Network First — 先请求网络，失败时回退缓存
 * 3. Stale While Revalidate — 返回缓存同时更新缓存
 * 4. Cache Only — 只从缓存读取
 * 5. Network Only — 只从网络请求
 */

const CACHE_NAME = 'app-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// === 预缓存关键资源 ===
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles/critical.css',
  '/js/app.js',
  '/images/logo.svg',
  '/fonts/main.woff2',
];

// 安装阶段 — 预缓存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// 激活阶段 — 清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// === 策略 1: Cache First (静态资源) ===
function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (!response || response.status !== 200) return response;
      const responseToCache = response.clone();
      caches.open(STATIC_CACHE).then((cache) => {
        cache.put(request, responseToCache);
      });
      return response;
    });
  });
}

// === 策略 2: Network First (API 请求) ===
function networkFirst(request) {
  return fetch(request).then((response) => {
    if (!response || response.status !== 200) return response;
    const responseToCache = response.clone();
    caches.open(DYNAMIC_CACHE).then((cache) => {
      cache.put(request, responseToCache);
    });
    return response;
  }).catch(() => {
    return caches.match(request);
  });
}

// === 策略 3: Stale While Revalidate (中等频率更新资源) ===
function staleWhileRevalidate(request) {
  return caches.match(request).then((cached) => {
    const fetchPromise = fetch(request).then((response) => {
      if (response && response.status === 200) {
        const responseToCache = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });
      }
      return response;
    }).catch(() => cached);

    return cached || fetchPromise;
  });
}

// === 路由分发 ===
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 静态资源 → Cache First
  if (url.pathname.match(/\.(js|css|png|jpg|svg|woff2|woff)$/)) {
    event.respondWith(cacheFirst(request));
  }
  // API 请求 → Network First
  else if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
  }
  // HTML 页面 → Stale While Revalidate
  else if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(request));
  }
  // 其他 → Network First
  else {
    event.respondWith(networkFirst(request));
  }
});

// === 缓存大小管理 ===
const MAX_DYNAMIC_CACHE_ITEMS = 50;

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    // 删除最旧的条目
    const keysToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

// === IndexedDB 缓存（大数据量）===
class IndexedDBCache {
  constructor(dbName, storeName, maxEntries = 100) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.maxEntries = maxEntries;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'key',
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async set(key, value) {
    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put({ key, value, timestamp: Date.now() });

      // 限制条目数量
      const count = store.count();
      count.onsuccess = async () => {
        if (count.result > this.maxEntries) {
          const all = store.getAll();
          all.onsuccess = () => {
            const sorted = all.result.sort((a, b) => a.timestamp - b.timestamp);
            const toRemove = sorted.slice(0, sorted.length - this.maxEntries);
            toRemove.forEach(item => store.delete(item.key));
          };
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

// === 使用示例：API 响应缓存 ===
const apiCache = new IndexedDBCache('api-cache', 'responses', 100);
apiCache.init();

async function fetchWithCache(url, options = {}) {
  const { cacheTTL = 5 * 60 * 1000 } = options; // 默认 5 分钟

  // 检查缓存
  const cached = await apiCache.get(url);
  if (cached && Date.now() - cached.timestamp < cacheTTL) {
    return cached.value;
  }

  // 请求网络
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    // 写入缓存
    await apiCache.set(url, data);
    
    return data;
  } catch (err) {
    // 网络失败，使用过期缓存
    if (cached) return cached.value;
    throw err;
  }
}
```

---

## 五、性能监控与告警

```javascript
/**
 * 性能监控体系
 * 
 * 1. Web Vitals (LCP/FID/CLS/INP)
 * 2. 自定义性能标记
 * 3. 内存监控
 * 4. 错误监控
 * 5. 上报到分析平台
 */

class PerformanceMonitor {
  constructor(options = {}) {
    this.reportUrl = options.reportUrl || '/api/perf';
    this.samples = [];
    this.isInitialized = false;
  }

  /**
   * 初始化所有监控
   */
  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.monitorWebVitals();
    this.monitorMemory();
    this.monitorErrors();
    this.monitorLongTasks();
  }

  /**
   * Web Vitals 监控
   */
  monitorWebVitals() {
    if (!('PerformanceObserver' in window)) return;

    // LCP (Largest Contentful Paint) — 目标 < 2.5s
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        this.report('lcp', {
          value: last.startTime,
          element: last.element?.tagName,
          rating: last.startTime < 2500 ? 'good' : last.startTime < 4000 ? 'needs-improvement' : 'poor',
        });
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) { /* LCP not supported */ }

    // INP (Interaction to Next Paint) — 目标 < 200ms
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          this.report('inp', {
            value: entry.duration,
            rating: entry.duration < 200 ? 'good' : entry.duration < 500 ? 'needs-improvement' : 'poor',
          });
        }
      }).observe({ type: 'interaction', buffered: true });
    } catch (e) { /* INP not supported */ }

    // CLS (Cumulative Layout Shift) — 目标 < 0.1
    let clsValue = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        this.report('cls', {
          value: clsValue,
          rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor',
        });
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (e) { /* CLS not supported */ }
  }

  /**
   * 内存监控
   */
  monitorMemory() {
    this.setInterval(() => {
      if (performance.memory) {
        const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;
        const usagePct = (usedJSHeapSize / jsHeapSizeLimit * 100).toFixed(1);
        
        this.report('memory', {
          usedMB: (usedJSHeapSize / 1024 / 1024).toFixed(1),
          totalMB: (totalJSHeapSize / 1024 / 1024).toFixed(1),
          limitMB: (jsHeapSizeLimit / 1024 / 1024).toFixed(1),
          usagePct: `${usagePct}%`,
          warning: parseFloat(usagePct) > 80,
        });
      }
    }, 30000); // 每 30 秒检查一次
  }

  /**
   * 错误监控
   */
  monitorErrors() {
    // 未捕获错误
    window.addEventListener('error', (event) => {
      this.report('error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Promise 未捕获拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.report('unhandledRejection', {
        reason: event.reason?.message || String(event.reason),
      });
    });
  }

  /**
   * 长任务监控 (> 50ms 的任务)
   */
  monitorLongTasks() {
    if (!('PerformanceObserver' in window)) return;

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.report('longTask', {
            duration: entry.duration.toFixed(2),
            startTime: entry.startTime.toFixed(2),
            name: entry.name,
          });
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch (e) { /* longtask not supported */ }
  }

  /**
   * 上报性能数据
   */
  report(metric, data) {
    const payload = {
      metric,
      ...data,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.samples.push(payload);

    // 使用 sendBeacon 上报（页面关闭时也能发送）
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(this.reportUrl, blob);
    } else {
      // 降级：fetch
      fetch(this.reportUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  }

  setInterval(fn, delay) {
    setInterval(fn, delay);
  }

  /**
   * 获取性能摘要
   */
  getSummary() {
    const vitals = this.samples.filter(s => ['lcp', 'cls', 'inp'].includes(s.metric));
    const errors = this.samples.filter(s => s.metric === 'error' || s.metric === 'unhandledRejection');
    const longTasks = this.samples.filter(s => s.metric === 'longTask');

    return {
      totalSamples: this.samples.length,
      vitals: {
        lcp: vitals.find(v => v.metric === 'lcp'),
        cls: vitals.find(v => v.metric === 'cls'),
        inp: vitals.find(v => v.metric === 'inp'),
      },
      errors: errors.length,
      longTasks: longTasks.length,
      memory: this.samples.filter(s => s.metric === 'memory').pop(),
    };
  }
}

// === 使用 ===
const monitor = new PerformanceMonitor({ reportUrl: '/api/perf' });
monitor.init();

// 页面卸载时发送摘要
window.addEventListener('beforeunload', () => {
  const summary = monitor.getSummary();
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(summary)], { type: 'application/json' });
    navigator.sendBeacon('/api/perf/summary', blob);
  }
});
```

---

## 六、性能优化速查表 (完整版)

### 6.1 优化优先级矩阵

| 优先级 | 优化项 | 预期收益 | 实施难度 |
|--------|--------|----------|----------|
| 🔴 P0 | 图片 WebP/AVIF | LCP -40% | 低 |
| 🔴 P0 | 代码分割 | 首屏 -50% | 中 |
| 🔴 P0 | 关键 CSS 内联 | FCP -30% | 低 |
| 🟠 P1 | 懒加载 | 首屏 -30% | 低 |
| 🟠 P1 | 防抖节流 | 交互 -60% | 低 |
| 🟠 P1 | Service Worker 缓存 | 二次加载 -80% | 中 |
| 🟡 P2 | 虚拟列表 | 大列表 -90% DOM | 中 |
| 🟡 P2 | 内存管理 | 长时间运行稳定 | 中 |
| 🟢 P3 | SSR/流式渲染 | TTFB -50% | 高 |
| 🟢 P3 | WebGL/Canvas 优化 | 动画 60fps | 高 |

### 6.2 Web Vitals 目标值

| 指标 | 优秀 | 需改进 | 差 | 含义 |
|------|------|--------|----|------|
| LCP | < 2.5s | 2.5-4s | > 4s | 最大内容绘制 |
| INP | < 200ms | 200-500ms | > 500ms | 交互到下次绘制 |
| CLS | < 0.1 | 0.1-0.25 | > 0.25 | 累计布局偏移 |
| FCP | < 1.8s | 1.8-3s | > 3s | 首次内容绘制 |
| TTFB | < 800ms | 800-1800ms | > 1800ms | 首字节时间 |

### 6.3 懒加载策略速查

| 场景 | 方案 | 触发条件 | 注意事项 |
|------|------|----------|----------|
| 图片 | `loading="lazy"` | 进入视口 | 设置宽高防 CLS |
| 图片 | IntersectionObserver | 进入视口前 100px | 需要占位图 |
| 路由 | `React.lazy` / `defineAsyncComponent` | 路由匹配 | 配 Suspense |
| 模块 | `import()` + IO | 容器进入视口 | 骨架屏占位 |
| 预加载 | `mouseenter` + `import()` | 鼠标悬停 | 网络好时有效 |
| 视频 | `preload="metadata"` | 用户点击播放 | 不预加载完整视频 |

### 6.4 防抖 vs 节流选择

| 场景 | 策略 | 参数 | 原因 |
|------|------|------|------|
| 搜索输入 | 防抖 | 300ms, maxWait 2s | 等用户停止输入 |
| 窗口 resize | 防抖 | 250ms | 等用户停止调整 |
| 表单验证 | 防抖 | 500ms | 等输入完成 |
| 滚动加载 | 节流 | 100ms | 持续触发但限频 |
| 鼠标移动 | rAF 节流 | — | 与刷新率同步 |
| 按钮防重复 | 节流 | 1s, leading=true | 限制点击频率 |
| 进度条更新 | rAF 节流 | — | 视觉更新同步 |

### 6.5 内存管理 Checklist

- [ ] 组件卸载时 `removeEventListener`
- [ ] 组件卸载时 `clearInterval`/`clearTimeout`
- [ ] WebSocket 连接 `ws.close()`
- [ ] fetch 请求 `AbortController.abort()`
- [ ] IntersectionObserver `observer.disconnect()`
- [ ] 图表实例 `chart.destroy()`
- [ ] 大对象引用置 `null`
- [ ] 使用 WeakMap 缓存（不阻止 GC）
- [ ] 虚拟列表只渲染可见 DOM
- [ ] 避免全局变量持有大对象
- [ ] 避免闭包捕获不需要的大对象
- [ ] 定期 `performance.memory` 检查

---

## 七、训练总结

### 性能优化完整知识体系

```
性能优化
├── 基础层 (4/24)
│   ├── 懒加载 (图片/路由/模块)
│   ├── 防抖节流 (debounce/throttle/rafThrottle)
│   ├── 内存管理 (DisposableComponent/WeakMap/虚拟列表)
│   └── 虚拟列表 (10,000 行 → 20 个 DOM)
├── 进阶层 (4/25)
│   ├── 关键渲染路径 (CRP)
│   ├── Web Vitals (LCP/FID/CLS/INP)
│   ├── 重排优化 (读写分离/transform/will-change)
│   └── 网络层优化 (连接复用/HTTP/2/压缩)
├── 综合实战 (4/26)
│   ├── 高性能数据看板 (三合一整合)
│   ├── 完整生命周期管理
│   └── 性能监控体系
└── 扩展场景 (4/27 本次)
    ├── SSR 性能优化 (流式渲染/选择性水合)
    ├── Canvas/WebGL 性能 (脏矩形/OffscreenCanvas/对象池)
    ├── Service Worker 缓存策略 (5 种策略/IndexedDB)
    ├── 图片优化完整策略 (WebP/AVIF/BlurHash/响应式)
    └── 性能监控与告警 (Web Vitals/内存/长任务/错误)
```

### 核心产出统计
- **4 轮训练**：基础 (808 行) + 进阶 + 综合实战 (1415 行) + 扩展 (本次)
- **代码示例**: 40+ 个完整示例
- **实战场景**: 数据看板 / SSR / Canvas 粒子系统 / Service Worker / 性能监控
- **速查表**: 5 张完整速查表

### 关键能力
1. **懒加载** — 从图片到模块到路由，全场景覆盖
2. **防抖节流** — 统一工具类，三种策略自动选择
3. **内存管理** — DisposableComponent 模式，零泄漏保证
4. **性能监控** — Web Vitals + 内存 + 长任务 + 错误，全链路监控
5. **扩展场景** — SSR/Canvas/SW，覆盖现代 Web 应用核心场景

---

**训练完成时间:** 2026-04-27 05:00  
**累计性能优化训练:** 4 轮 = 完整体系 ✅
