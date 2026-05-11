/**
 * 防抖 (Debounce) 与节流 (Throttle) 实现
 *
 * 用于控制高频事件的执行频率
 * 优化搜索、滚动、resize 等场景的性能
 */

// ============================================
// 1. 防抖 (Debounce)
// 等待事件停止一段时间后再执行
// ============================================

/**
 * 基础防抖函数
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟时间 (ms)
 * @returns {Function} 防抖后的函数
 */
function debounce(fn, delay) {
  let timerId = null;

  return function (...args) {
    const context = this;

    // 清除之前的定时器
    if (timerId) {
      clearTimeout(timerId);
    }

    // 设置新的定时器
    timerId = setTimeout(() => {
      fn.apply(context, args);
      timerId = null;
    }, delay);
  };
}

/**
 * 立即执行的防抖
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟时间 (ms)
 * @param {boolean} immediate - 是否立即执行
 * @returns {Function} 防抖后的函数
 */
function debounceWithImmediate(fn, delay, immediate = false) {
  let timerId = null;

  return function (...args) {
    const context = this;
    const callNow = immediate && !timerId;

    if (timerId) {
      clearTimeout(timerId);
    }

    if (callNow) {
      fn.apply(context, args);
    }

    timerId = setTimeout(() => {
      timerId = null;
      if (!immediate) {
        fn.apply(context, args);
      }
    }, delay);
  };
}

/**
 * 带取消功能的防抖
 * @returns {Object} { debounced, cancel, flush }
 */
function createDebounce(fn, delay) {
  let timerId = null;

  const debounced = function (...args) {
    const context = this;

    if (timerId) {
      clearTimeout(timerId);
    }

    timerId = setTimeout(() => {
      fn.apply(context, args);
      timerId = null;
    }, delay);
  };

  // 取消执行
  debounced.cancel = function () {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  // 立即执行
  debounced.flush = function (...args) {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
      fn.apply(this, args);
    }
  };

  return debounced;
}

// ============================================
// 2. 节流 (Throttle)
// 固定时间间隔内只执行一次
// ============================================

/**
 * 时间戳版节流
 * @param {Function} fn - 要执行的函数
 * @param {number} interval - 间隔时间 (ms)
 * @returns {Function} 节流后的函数
 */
function throttleByTimestamp(fn, interval) {
  let lastCall = 0;

  return function (...args) {
    const context = this;
    const now = Date.now();

    if (now - lastCall >= interval) {
      lastCall = now;
      fn.apply(context, args);
    }
  };
}

/**
 * 定时器版节流
 * @param {Function} fn - 要执行的函数
 * @param {number} interval - 间隔时间 (ms)
 * @returns {Function} 节流后的函数
 */
function throttleByTimer(fn, interval) {
  let timerId = null;

  return function (...args) {
    const context = this;

    if (!timerId) {
      fn.apply(context, args);
      timerId = setTimeout(() => {
        timerId = null;
      }, interval);
    }
  };
}

/**
 * 带头尾执行的节流
 * @param {Function} fn - 要执行的函数
 * @param {number} interval - 间隔时间 (ms)
 * @param {Object} options - 配置项
 * @returns {Function} 节流后的函数
 */
function throttleWithEdges(fn, interval, options = {}) {
  const { leading = true, trailing = true } = options;
  let timerId = null;
  let lastCall = 0;
  let lastArgs = null;

  const later = () => {
    const now = Date.now();
    const remaining = interval - (now - lastCall);

    if (remaining <= 0) {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      lastCall = now;
      fn.apply(this, lastArgs);
      lastArgs = null;
    } else {
      timerId = setTimeout(later, remaining);
    }
  };

  return function (...args) {
    const now = Date.now();
    const isFirstCall = !lastCall;
    lastArgs = args;
    lastCall = now;

    if (isFirstCall && leading) {
      fn.apply(this, args);
    } else if (trailing) {
      if (!timerId) {
        timerId = setTimeout(later, interval);
      }
    }
  };
}

// ============================================
// 3. 实际应用场景
// ============================================

/**
 * 场景 1: 搜索框输入 (防抖)
 */
function createSearchHandler(searchFn, delay = 300) {
  return debounce(async (query) => {
    if (!query.trim()) return;

    try {
      const results = await searchFn(query);
      renderResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, delay);
}

// 使用示例
/*
const searchInput = document.querySelector('#search');
const handleSearch = createSearchHandler(fetchSearchResults);
searchInput.addEventListener('input', (e) => {
  handleSearch(e.target.value);
});
*/

/**
 * 场景 2: 窗口 Resize (节流)
 */
function createResizeHandler(callback, interval = 200) {
  return throttleByTimestamp(callback, interval);
}

// 使用示例
/*
const handleResize = createResizeHandler(() => {
  // 更新布局
  updateLayout();
  // 重新计算图表
  redrawCharts();
});
window.addEventListener('resize', handleResize);
*/

/**
 * 场景 3: 滚动加载 (节流)
 */
function createScrollHandler(callback, interval = 100) {
  return throttleByTimestamp(callback, interval);
}

// 使用示例
/*
const handleScroll = createScrollHandler(() => {
  const scrollTop = window.scrollY;
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;

  // 接近底部时加载更多
  if (scrollTop + windowHeight >= documentHeight - 500) {
    loadMoreContent();
  }
}, 200);

window.addEventListener('scroll', handleScroll);
*/

/**
 * 场景 4: 按钮防重复点击 (防抖)
 */
function preventDoubleClick(button, handler, delay = 500) {
  const debouncedHandler = debounce(handler, delay);

  button.addEventListener('click', (e) => {
    debouncedHandler.call(button, e);
  });
}

// 使用示例
/*
const submitBtn = document.querySelector('#submit');
preventDoubleClick(submitBtn, async (e) => {
  e.preventDefault();
  await submitForm();
});
*/

/**
 * 场景 5: 鼠标移动追踪 (节流)
 */
function createMouseMoveHandler(callback, interval = 50) {
  return throttleByTimestamp(callback, interval);
}

// 使用示例
/*
const handleMouseMove = createMouseMoveHandler((e) => {
  // 更新鼠标位置指示器
  updateMouseIndicator(e.clientX, e.clientY);
}, 50);

document.addEventListener('mousemove', handleMouseMove);
*/

// ============================================
// 4. 高级用法：RAF 节流
// 使用 requestAnimationFrame 优化动画
// ============================================

/**
 * RAF 节流 - 每帧最多执行一次
 * @param {Function} fn - 要执行的函数
 * @returns {Function} RAF 节流后的函数
 */
function throttleWithRAF(fn) {
  let rafId = null;
  let lastArgs = null;

  return function (...args) {
    lastArgs = args;
    const context = this;

    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        fn.apply(context, lastArgs);
        rafId = null;
        lastArgs = null;
      });
    }
  };
}

// 使用示例
/*
const handleScrollRAF = throttleWithRAF(() => {
  // 平滑更新 UI
  updateScrollIndicator();
  parallaxEffect();
});

window.addEventListener('scroll', handleScrollRAF);
*/

// ============================================
// 5. 性能对比测试工具
// ============================================

/**
 * 性能测试工具
 * 对比不同函数的执行次数
 */
function performanceTest(fn, name, calls = 1000) {
  const startTime = performance.now();
  let executeCount = 0;

  const trackedFn = function (...args) {
    executeCount++;
    return fn.apply(this, args);
  };

  // 模拟高频调用
  for (let i = 0; i < calls; i++) {
    trackedFn(i);
  }

  const endTime = performance.now();

  console.log(`${name}:`);
  console.log(`  调用次数：${calls}`);
  console.log(`  实际执行：${executeCount}`);
  console.log(`  节省比例：${((1 - executeCount / calls) * 100).toFixed(2)}%`);
  console.log(`  耗时：${(endTime - startTime).toFixed(2)}ms`);

  return { calls, executeCount, saved: 1 - executeCount / calls };
}

// 测试示例
/*
const testFn = (x) => x * 2;
const debouncedFn = debounce(testFn, 100);
const throttledFn = throttleByTimestamp(testFn, 100);

performanceTest(testFn, '原始函数');
performanceTest(debouncedFn, '防抖函数');
performanceTest(throttledFn, '节流函数');
*/

// ============================================
// 导出
// ============================================

export {
  debounce,
  debounceWithImmediate,
  createDebounce,
  throttleByTimestamp,
  throttleByTimer,
  throttleWithEdges,
  throttleWithRAF,
  createSearchHandler,
  createResizeHandler,
  createScrollHandler,
  preventDoubleClick,
  createMouseMoveHandler,
  performanceTest,
};
