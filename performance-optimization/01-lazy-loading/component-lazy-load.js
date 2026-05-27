/**
 * 组件懒加载示例
 *
 * 适用于 React/Vue 等现代框架
 * 减少初始包体积，按需加载组件
 */

// ============================================
// 1. React 懒加载示例
// ============================================

// React.lazy + Suspense (React 16.6+)
/*
import React, { Suspense, lazy } from 'react';

// 懒加载组件
const HeavyComponent = lazy(() => import('./HeavyComponent'));
const ChartComponent = lazy(() => import('./ChartComponent'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
      <ChartComponent />
    </Suspense>
  );
}

// 路由懒加载
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

<Route
  path="/dashboard"
  element={
    <Suspense fallback={<PageLoader />}>
      <Dashboard />
    </Suspense>
  }
/>
*/

// ============================================
// 2. Vue 3 懒加载示例
// ============================================

// Vue 3 defineAsyncComponent
/*
import { defineAsyncComponent, Suspense } from 'vue';

const HeavyComponent = defineAsyncComponent({
  loader: () => import('./HeavyComponent.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
});

// 路由懒加载 (Vue Router)
const routes = [
  {
    path: '/dashboard',
    component: () => import('./views/Dashboard.vue')
  }
];
*/

// ============================================
// 3. 通用 JS 模块懒加载
// ============================================

/**
 * 动态导入模块
 * @param {string} modulePath - 模块路径
 * @returns {Promise} 模块对象
 */
async function loadModule(modulePath) {
  try {
    const module = await import(modulePath);
    return module;
  } catch (error) {
    console.error(`Failed to load module: ${modulePath}`, error);
    throw error;
  }
}

/**
 * 带缓存的模块加载器
 * 避免重复加载同一模块
 */
class ModuleLoader {
  constructor() {
    this.cache = new Map();
  }

  async load(modulePath) {
    // 检查缓存
    if (this.cache.has(modulePath)) {
      return this.cache.get(modulePath);
    }

    // 加载并缓存
    const module = await loadModule(modulePath);
    this.cache.set(modulePath, module);
    return module;
  }

  // 预加载多个模块
  async preload(modulePaths) {
    return Promise.all(modulePaths.map((path) => this.load(path)));
  }

  // 清除缓存
  clear(modulePath) {
    if (modulePath) {
      this.cache.delete(modulePath);
    } else {
      this.cache.clear();
    }
  }
}

// 使用示例
const loader = new ModuleLoader();

// 按需加载
async function initChart() {
  const chartModule = await loader.load('./charts.js');
  chartModule.init('#chart');
}

// 预加载（用户可能需要的模块）
async function preloadUserActions() {
  await loader.preload(['./analytics.js', './export.js', './print.js']);
}

// ============================================
// 4. 图片预加载与懒加载结合
// ============================================

/**
 * 图片加载管理器
 * 支持预加载关键图片，懒加载非关键图片
 */
class ImageLoader {
  constructor() {
    this.loaded = new Set();
    this.observer = null;
  }

  // 预加载关键图片
  preload(sources) {
    return Promise.all(
      sources.map(
        (src) => new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            this.loaded.add(src);
            resolve(img);
          };
          img.onerror = reject;
          img.src = src;
        }),
      ),
    );
  }

  // 懒加载图片
  lazyLoad(imgElement) {
    if (!('IntersectionObserver' in window)) {
      // 降级：直接加载
      imgElement.src = imgElement.dataset.src;
      return;
    }

    if (!this.observer) {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = entry.target;
              this.loadImage(img);
              this.observer.unobserve(img);
            }
          });
        },
        { rootMargin: '100px 0px' },
      );
    }

    this.observer.observe(imgElement);
  }

  loadImage(img) {
    const src = img.dataset.src;
    if (!src || this.loaded.has(src)) return;

    const tempImg = new Image();
    tempImg.onload = () => {
      img.src = src;
      img.classList.add('loaded');
      this.loaded.add(src);
    };
    tempImg.src = src;
  }

  // 销毁
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// 使用示例
const imageLoader = new ImageLoader();

// 预加载首屏关键图片
imageLoader.preload(['/images/hero.jpg', '/images/logo.png']);

// 懒加载其他图片
document.querySelectorAll('img[data-src]').forEach((img) => {
  imageLoader.lazyLoad(img);
});

// ============================================
// 5. 虚拟列表 (Virtual Scrolling)
// 只渲染可见区域的列表项
// ============================================

/**
 * 虚拟列表实现
 * 适用于长列表场景（1000+ 项）
 */
class VirtualList {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    this.itemHeight = options.itemHeight || 50;
    this.overscan = options.overscan || 5; // 额外渲染的项数
    this.items = options.items || [];

    this.container.style.overflow = 'auto';
    this.container.style.position = 'relative';

    // 创建滚动容器和可见区域
    this.spacer = document.createElement('div');
    this.spacer.style.position = 'absolute';
    this.spacer.style.top = 0;
    this.spacer.style.left = 0;
    this.spacer.style.right = 0;
    this.container.appendChild(this.spacer);

    this.viewport = document.createElement('div');
    this.viewport.style.position = 'absolute';
    this.viewport.style.top = 0;
    this.viewport.style.left = 0;
    this.viewport.style.right = 0;
    this.container.appendChild(this.viewport);

    this.updateSize();
    this.container.addEventListener('scroll', () => this.render());
  }

  updateSize() {
    const totalHeight = this.items.length * this.itemHeight;
    this.spacer.style.height = `${totalHeight}px`;
  }

  setItems(items) {
    this.items = items;
    this.updateSize();
    this.render();
  }

  render() {
    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;

    // 计算可见范围
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / this.itemHeight) - this.overscan,
    );
    const endIndex = Math.min(
      this.items.length,
      Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.overscan,
    );

    // 更新可见区域位置
    this.viewport.style.transform = `translateY(${startIndex * this.itemHeight}px)`;

    // 渲染可见项
    this.viewport.innerHTML = '';
    for (let i = startIndex; i < endIndex; i++) {
      const item = document.createElement('div');
      item.style.height = `${this.itemHeight}px`;
      item.style.borderBottom = '1px solid #eee';
      item.textContent = this.items[i];
      this.viewport.appendChild(item);
    }
  }
}

// 使用示例
const virtualList = new VirtualList('#list-container', {
  itemHeight: 50,
  items: Array.from({ length: 10000 }, (_, i) => `Item ${i + 1}`),
});

// 导出
export {
  ModuleLoader, ImageLoader, VirtualList, loadModule,
};
