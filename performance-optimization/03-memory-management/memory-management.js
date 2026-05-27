/**
 * JavaScript 内存管理最佳实践
 *
 * 防止内存泄漏，优化内存使用
 * 适用于单页应用 (SPA) 和长期运行的应用
 */

// ============================================
// 1. 常见内存泄漏场景及解决方案
// ============================================

/**
 * 场景 1: 未清理的定时器
 * ❌ 错误示例
 */
function leakyTimer() {
  const intervalId = setInterval(() => {
    console.log('This will run forever!');
  }, 1000);
  // 忘记清除 intervalId
}

/**
 * ✅ 正确示例：使用清理函数
 */
function safeTimer() {
  const intervalId = setInterval(() => {
    console.log('This can be stopped');
  }, 1000);

  // 返回清理函数
  return () => {
    clearInterval(intervalId);
  };
}

// 使用
// const cleanup = safeTimer();
// 在组件卸载时调用 cleanup()

// ============================================
// 2. 事件监听器泄漏
// ============================================

/**
 * ❌ 错误示例：未移除事件监听器
 */
class LeakyComponent {
  constructor(element) {
    this.element = element;
    this.handleClick = this.handleClick.bind(this);
    element.addEventListener('click', this.handleClick);
    // 忘记在销毁时移除
  }

  handleClick(e) {
    console.log('Clicked!', e);
  }

  // 没有 destroy 方法
}

/**
 * ✅ 正确示例：成对添加/移除
 */
class SafeComponent {
  constructor(element) {
    this.element = element;
    this.handleClick = this.handleClick.bind(this);
    this.addListeners();
  }

  addListeners() {
    this.element.addEventListener('click', this.handleClick);
    window.addEventListener('resize', this.handleResize);
  }

  removeListeners() {
    this.element.removeEventListener('click', this.handleClick);
    window.removeEventListener('resize', this.handleResize);
  }

  handleClick(e) {
    console.log('Clicked!', e);
  }

  handleResize() {
    console.log('Resized');
  }

  destroy() {
    this.removeListeners();
    // 清理其他引用
    this.element = null;
  }
}

// ============================================
// 3. 闭包导致的内存泄漏
// ============================================

/**
 * ❌ 错误示例：闭包引用大对象
 */
function leakyClosure() {
  const largeData = new Array(1000000).fill('data');

  document.getElementById('btn').addEventListener('click', () => {
    // 这个闭包会一直持有 largeData 的引用
    console.log(largeData.length);
  });
}

/**
 * ✅ 正确示例：只引用需要的数据
 */
function safeClosure() {
  const largeData = new Array(1000000).fill('data');
  const neededSize = largeData.length; // 只保存需要的值

  document.getElementById('btn').addEventListener('click', () => {
    console.log(neededSize); // 不引用整个数组
  });

  // 或者在使用后清除引用
  // largeData = null; // 在函数作用域内无法重新赋值 const
}

// ============================================
// 4. DOM 节点泄漏
// ============================================

/**
 * ❌ 错误示例：分离的 DOM 节点
 */
const leakedNodes = [];

function leakyDOM() {
  const div = document.createElement('div');
  const child = document.createElement('div');
  div.appendChild(child);

  // 只移除父节点，但保留了引用
  document.body.removeChild(div);
  leakedNodes.push(div); // 整个节点树都无法被 GC
}

/**
 * ✅ 正确示例：清理引用
 */
function safeDOM() {
  const div = document.createElement('div');
  const child = document.createElement('div');
  div.appendChild(child);

  document.body.appendChild(div);

  // 使用时...

  // 清理时
  div.remove();
  // 不保留引用，让 GC 回收
}

// ============================================
// 5. 内存管理工具类
// ============================================

/**
 * 资源管理器
 * 统一管理需要清理的资源
 */
class ResourceManager {
  constructor() {
    this.resources = new Set();
  }

  /**
   * 注册需要清理的资源
   * @param {Function} cleanup - 清理函数
   * @param {string} name - 资源名称（可选）
   */
  register(cleanup, name = 'anonymous') {
    this.resources.add({ cleanup, name });
    return () => this.unregister(cleanup);
  }

  /**
   * 注销资源
   * @param {Function} cleanup
   */
  unregister(cleanup) {
    this.resources.delete(
      Array.from(this.resources).find((r) => r.cleanup === cleanup),
    );
  }

  /**
   * 清理所有资源
   */
  cleanup() {
    this.resources.forEach((resource) => {
      try {
        resource.cleanup();
        console.log(`Cleaned up: ${resource.name}`);
      } catch (error) {
        console.error(`Error cleaning up ${resource.name}:`, error);
      }
    });
    this.resources.clear();
  }

  /**
   * 获取已注册资源数量
   */
  get count() {
    return this.resources.size;
  }
}

// 使用示例
const resourceManager = new ResourceManager();

function initFeature() {
  const intervalId = setInterval(() => {}, 1000);

  // 注册清理函数
  resourceManager.register(() => clearInterval(intervalId), 'feature-interval');

  const handler = () => {};
  window.addEventListener('scroll', handler);

  resourceManager.register(
    () => window.removeEventListener('scroll', handler),
    'scroll-listener',
  );
}

// 在应用退出时
// resourceManager.cleanup();

// ============================================
// 6. WeakMap 和 WeakSet 的应用
// ============================================

/**
 * 使用 WeakMap 存储 DOM 节点关联数据
 * 避免内存泄漏
 */
class DOMDataStore {
  constructor() {
    // WeakMap 的键会被自动垃圾回收
    this.data = new WeakMap();
  }

  set(element, value) {
    this.data.set(element, value);
  }

  get(element) {
    return this.data.get(element);
  }

  delete(element) {
    this.data.delete(element);
  }

  has(element) {
    return this.data.has(element);
  }
}

// 使用示例
const store = new DOMDataStore();

document.querySelectorAll('.item').forEach((item) => {
  store.set(item, { id: item.dataset.id, selected: false });
});

// 当 DOM 节点被移除时，关联数据会自动被 GC

/**
 * 使用 WeakSet 追踪 DOM 节点
 */
class DOMTracker {
  constructor() {
    this.trackedElements = new WeakSet();
  }

  track(element) {
    if (this.trackedElements.has(element)) {
      return false;
    }
    this.trackedElements.add(element);
    return true;
  }

  isTracked(element) {
    return this.trackedElements.has(element);
  }
}

// ============================================
// 7. 对象池模式 (减少 GC 压力)
// ============================================

/**
 * 对象池
 * 复用对象，减少创建/销毁开销
 */
class ObjectPool {
  constructor(createFn, resetFn, initialSize = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.available = [];
    this.inUse = new Set();

    // 预创建对象
    for (let i = 0; i < initialSize; i++) {
      this.available.push(createFn());
    }
  }

  acquire() {
    let obj;
    if (this.available.length > 0) {
      obj = this.available.pop();
    } else {
      obj = this.createFn();
    }
    this.inUse.add(obj);
    return obj;
  }

  release(obj) {
    if (!this.inUse.has(obj)) {
      return;
    }
    this.resetFn(obj);
    this.inUse.delete(obj);
    this.available.push(obj);
  }

  releaseAll() {
    this.inUse.forEach((obj) => {
      this.resetFn(obj);
      this.available.push(obj);
    });
    this.inUse.clear();
  }

  get stats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
    };
  }
}

// 使用示例：粒子系统
const particlePool = new ObjectPool(
  () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
  }),
  (p) => {
    p.x = p.y = p.vx = p.vy = p.life = 0;
  },
  1000,
);

function createParticle(x, y) {
  const particle = particlePool.acquire();
  particle.x = x;
  particle.y = y;
  particle.vx = (Math.random() - 0.5) * 10;
  particle.vy = (Math.random() - 0.5) * 10;
  particle.life = 100;
  return particle;
}

function updateParticle(particle) {
  particle.x += particle.vx;
  particle.y += particle.vy;
  particle.life--;

  if (particle.life <= 0) {
    particlePool.release(particle);
  }
}

// ============================================
// 8. 内存监控工具
// ============================================

/**
 * 内存监控器
 * 检测内存泄漏和异常增长
 */
class MemoryMonitor {
  constructor(options = {}) {
    this.interval = options.interval || 5000;
    this.threshold = options.threshold || 10 * 1024 * 1024; // 10MB
    this.history = [];
    this.timerId = null;
    this.onLeakDetected = options.onLeakDetected || (() => {});
  }

  start() {
    if (this.timerId) return;

    this.timerId = setInterval(() => {
      this.check();
    }, this.interval);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  check() {
    if (performance.memory) {
      const memory = performance.memory;
      const used = memory.usedJSHeapSize;
      const limit = memory.jsHeapSizeLimit;
      const total = memory.totalJSHeapSize;

      const snapshot = {
        timestamp: Date.now(),
        used,
        limit,
        total,
        percent: (used / limit) * 100,
      };

      this.history.push(snapshot);

      // 保留最近 60 个样本
      if (this.history.length > 60) {
        this.history.shift();
      }

      // 检测内存泄漏（持续增长）
      this.detectLeak();

      console.log(
        `Memory: ${(used / 1024 / 1024).toFixed(2)}MB / ${(limit / 1024 / 1024).toFixed(2)}MB (${snapshot.percent.toFixed(1)}%)`,
      );
    }
  }

  detectLeak() {
    if (this.history.length < 10) return;

    const recent = this.history.slice(-10);
    const first = recent[0].used;
    const last = recent[recent.length - 1].used;
    const growth = last - first;

    if (growth > this.threshold) {
      this.onLeakDetected({
        growth,
        samples: recent,
      });
      console.warn('⚠️ Possible memory leak detected!', {
        growth: `${(growth / 1024 / 1024).toFixed(2)}MB`,
        samples: recent.length,
      });
    }
  }

  getReport() {
    if (this.history.length === 0) {
      return null;
    }

    const usedValues = this.history.map((h) => h.used);
    return {
      min: Math.min(...usedValues),
      max: Math.max(...usedValues),
      avg: usedValues.reduce((a, b) => a + b, 0) / usedValues.length,
      current: this.history[this.history.length - 1].used,
      samples: this.history.length,
    };
  }
}

// 使用示例
const monitor = new MemoryMonitor({
  interval: 5000,
  threshold: 5 * 1024 * 1024, // 5MB
  onLeakDetected: (info) => {
    console.error('Memory leak!', info);
    // 可以触发告警或自动清理
  },
});

// 在开发环境启动监控
if (process.env.NODE_ENV === 'development') {
  monitor.start();
}

// ============================================
// 9. React/Vue 组件内存管理
// ============================================

/**
 * React Hook: useCleanup
 * 自动清理副作用
 */
/*
import { useEffect } from 'react';

function useCleanup(cleanup) {
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
}

// 使用
function MyComponent() {
  useCleanup(() => {
    // 组件卸载时自动执行
    clearInterval(timerId);
    removeEventListener();
  });
}
*/

/**
 * Vue 3 Composition API: useCleanup
 */
/*
import { onUnmounted } from 'vue';

export function useCleanup(cleanup) {
  onUnmounted(cleanup);
}

// 使用
setup() {
  const timerId = setInterval(() => {}, 1000);

  useCleanup(() => {
    clearInterval(timerId);
  });
}
*/

// ============================================
// 10. 最佳实践清单
// ============================================

const bestPractices = {
  // 定时器
  timers: [
    '✓ 总是保存定时器 ID',
    '✓ 在组件卸载/清理时清除定时器',
    '✓ 考虑使用 setTimeout 递归代替 setInterval',
  ],

  // 事件监听
  events: [
    '✓ 成对添加/移除事件监听器',
    '✓ 使用 WeakMap 存储事件处理函数',
    '✓ 避免在循环中创建新的事件处理函数',
  ],

  // 闭包
  closures: [
    '✓ 只引用需要的数据',
    '✓ 避免闭包引用大型对象',
    '✓ 及时清理不再需要的引用',
  ],

  // DOM
  dom: [
    '✓ 移除 DOM 节点后清除引用',
    '✓ 使用 WeakMap 存储 DOM 关联数据',
    '✓ 避免全局变量存储 DOM 引用',
  ],

  // 数据结构
  data: [
    '✓ 使用 Map/Set 代替对象存储动态键值',
    '✓ 使用 WeakMap/WeakSet 存储临时关联',
    '✓ 实现对象池复用频繁创建的对象',
  ],

  // 监控
  monitoring: [
    '✓ 开发环境启用内存监控',
    '✓ 定期检查内存使用趋势',
    '✓ 使用 Chrome DevTools Memory 面板分析',
  ],
};

// 打印最佳实践
function printBestPractices() {
  console.log('=== Memory Management Best Practices ===\n');
  Object.entries(bestPractices).forEach(([category, practices]) => {
    console.log(`${category.toUpperCase()}:`);
    practices.forEach((p) => console.log(`  ${p}`));
    console.log('');
  });
}

// ============================================
// 导出
// ============================================

export {
  ResourceManager,
  DOMDataStore,
  DOMTracker,
  ObjectPool,
  MemoryMonitor,
  bestPractices,
  printBestPractices,
};
