/**
 * 前端性能优化指南
 *
 * 优化内容：
 * - 代码分割（按需加载）
 * - 图片懒加载
 * - 组件 memo 化
 * - 防抖/节流优化
 */
import React from "react";

// ==================== 代码分割（按需加载） ====================

/**
 * 动态导入示例
 *
 * 使用方式：
 * 1. 路由级别代码分割
 * 2. 组件级别代码分割
 * 3. 功能模块代码分割
 */

// ❌ 错误示例：一次性加载所有组件
// import HeavyComponent from './HeavyComponent';
// import ChartComponent from './ChartComponent';
// import EditorComponent from './EditorComponent';

// ✅ 正确示例：动态导入
export async function loadHeavyComponent() {
  return import("../components/HeavyComponent");
}

export async function loadChartComponent() {
  return import("../components/ChartComponent");
}

export async function loadEditorComponent() {
  return import("../components/EditorComponent");
}

/**
 * 路由懒加载配置
 */
export const lazyRoutes = {
  // 测试结果页面
  testResult: () => import("../pages/TestResultPage"),

  // 会员中心页面
  membership: () => import("../pages/MembershipPage"),

  // 分享卡片页面
  shareCard: () => import("../pages/ShareCardPage"),

  // 题库页面
  questionBank: () => import("../pages/QuestionBankPage"),
};

/**
 * 预加载关键资源
 */
export function preloadCriticalResources() {
  // 预加载用户可能访问的下一个页面
  const links = document.querySelectorAll('link[rel="prefetch"]');
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (href) {
      const linkElement = document.createElement("link");
      linkElement.rel = "prefetch";
      linkElement.href = href;
      document.head.appendChild(linkElement);
    }
  });
}

// ==================== 图片懒加载 ====================

/**
 * 图片懒加载 Hook
 *
 * 使用方式：
 * const imgProps = useLazyImage({
 *   src: '/images/heavy.jpg',
 *   placeholder: '/images/placeholder.jpg',
 *   threshold: 0.1,
 * });
 */

interface LazyImageOptions {
  src: string;
  placeholder?: string;
  threshold?: number;
  rootMargin?: string;
}

interface LazyImageResult {
  src: string;
  loading: boolean;
  loaded: boolean;
  error: boolean;
  ref: React.RefObject<HTMLImageElement>;
}

export function useLazyImage(options: LazyImageOptions): LazyImageResult {
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [loading, setLoading] = React.useState(true);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [currentSrc, setCurrentSrc] = React.useState(options.placeholder || "");

  React.useEffect(() => {
    const image = imgRef.current;
    if (!image) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setLoading(true);

            const img = new Image();
            img.src = options.src;

            img.onload = () => {
              setCurrentSrc(options.src);
              setLoaded(true);
              setLoading(false);
              observer.unobserve(image);
            };

            img.onerror = () => {
              setError(true);
              setLoading(false);
              observer.unobserve(image);
            };
          }
        });
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || "50px",
      },
    );

    observer.observe(image);

    return () => {
      observer.disconnect();
    };
  }, [options.src, options.threshold, options.rootMargin]);

  return {
    src: currentSrc,
    loading,
    loaded,
    error,
    ref: imgRef,
  };
}

/**
 * 懒加载图片组件
 */
export const LazyImage: React.FC<
  LazyImageOptions & React.ImgHTMLAttributes<HTMLImageElement>
> = (props) => {
  const { src, placeholder, ...imgProps } = props;
  const { src: currentSrc, loading, ref } = useLazyImage({ src, placeholder });

  return (
    <img
      ref={ref}
      src={currentSrc}
      loading="lazy"
      {...imgProps}
      style={{
        opacity: loading ? 0.5 : 1,
        transition: "opacity 0.3s ease",
        ...props.style,
      }}
    />
  );
};

/**
 * 响应式图片加载
 */
export function getResponsiveImageSrc(
  baseUrl: string,
  width: number,
  devicePixelRatio: number = window.devicePixelRatio,
): string {
  const targetWidth = Math.ceil(width * devicePixelRatio);
  return `${baseUrl}?width=${targetWidth}`;
}

// ==================== 组件 Memo 化 ====================

/**
 * React.memo 使用示例
 *
 * 适用场景：
 * 1. 纯函数组件，props 相同则无需重新渲染
 * 2. 列表项组件
 * 3. 静态展示组件
 */

// ✅ 使用 React.memo 优化
export const MemoizedListItem = React.memo(
  ({ item, onClick }: { item: any; onClick: () => void }) => {
    return <div onClick={onClick}>{item.name}</div>;
  },
);

// ✅ 自定义比较函数
export const MemoizedComplexComponent = React.memo(
  ({ data, config }: { data: any; config: any }) => {
    return <div>{/* 复杂渲染逻辑 */}</div>;
  },
  (prevProps, nextProps) => {
    // 自定义比较逻辑
    return (
      prevProps.data.id === nextProps.data.id &&
      prevProps.config.theme === nextProps.config.theme
    );
  },
);

/**
 * useMemo 优化计算密集型操作
 */
export function useExpensiveCalculation(data: any[]) {
  return React.useMemo(() => {
    console.log("Running expensive calculation...");

    // 模拟耗时计算
    return data
      .filter((item) => item.active)
      .map((item) => ({
        ...item,
        computed: item.value * 2 + item.score,
      }))
      .sort((a, b) => b.computed - a.computed);
  }, [data]);
}

/**
 * useCallback 优化函数引用
 */
export function useOptimizedCallbacks(dependencies: any[]) {
  // ✅ 使用 useCallback 避免函数重新创建
  const handleClick = React.useCallback((id: string) => {
    console.log("Clicked:", id);
  }, []);

  const handleSubmit = React.useCallback((data: any) => {
    console.log("Submitted:", data);
  }, dependencies);

  return { handleClick, handleSubmit };
}

// ==================== 防抖/节流优化 ====================

/**
 * 防抖函数（Debounce）
 *
 * 适用场景：
 * - 搜索框输入
 * - 窗口大小调整
 * - 表单自动保存
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate: boolean = false,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(this: any, ...args: Parameters<T>) {
    const context = this;
    const later = () => {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    };

    const callNow = immediate && !timeout;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);

    if (callNow) {
      func.apply(context, args);
    }
  };
}

/**
 * 节流函数（Throttle）
 *
 * 适用场景：
 * - 滚动事件
 * - 鼠标移动
 * - 按钮点击防刷
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
  trailing: boolean = true,
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(this: any, ...args: Parameters<T>) {
    const context = this;

    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;

      if (trailing) {
        timeout = setTimeout(() => {
          inThrottle = false;
          if (lastArgs) {
            func.apply(context, lastArgs);
            lastArgs = null;
          }
        }, limit);
      } else {
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    } else {
      lastArgs = args;
    }
  };
}

/**
 * 防抖 Hook
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 节流 Hook
 */
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = React.useState<T>(value);
  const lastUpdated = React.useRef<number>(Date.now());

  React.useEffect(() => {
    const now = Date.now();
    if (now - lastUpdated.current >= interval) {
      setThrottledValue(value);
      lastUpdated.current = now;
    } else {
      const timeout = setTimeout(
        () => {
          setThrottledValue(value);
          lastUpdated.current = Date.now();
        },
        interval - (now - lastUpdated.current),
      );

      return () => clearTimeout(timeout);
    }
  }, [value, interval]);

  return throttledValue;
}

/**
 * 搜索框优化示例
 */
export const OptimizedSearchBox: React.FC<{
  onSearch: (query: string) => void;
}> = ({ onSearch }) => {
  const [query, setQuery] = React.useState("");

  // 使用防抖优化搜索
  const debouncedSearch = React.useMemo(
    () => debounce((q: string) => onSearch(q), 300),
    [onSearch],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  return (
    <input
      type="text"
      value={query}
      onChange={handleChange}
      placeholder="搜索..."
    />
  );
};

/**
 * 滚动优化示例
 */
export const OptimizedScrollHandler: React.FC = () => {
  const handleScroll = React.useCallback(
    throttle(() => {
      console.log("Scroll position:", window.scrollY);
      // 处理滚动逻辑
    }, 100),
    [],
  );

  React.useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return <div>滚动优化示例</div>;
};

// ==================== 其他优化技巧 ====================

/**
 * 虚拟列表（Virtual List）
 * 只渲染可见区域的列表项
 */
export function useVirtualList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
) {
  const [scrollTop, setScrollTop] = React.useState(0);

  const startIndex = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount, items.length);

  const visibleItems = items.slice(startIndex, endIndex);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const handleScroll = React.useCallback(
    throttle((e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    }, 50),
    [],
  );

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
  };
}

/**
 * 资源预加载
 */
export function preloadResource(url: string, as: string = "script") {
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = as;
  link.href = url;
  document.head.appendChild(link);
}

/**
 * 清理副作用
 */
export function useCleanup(cleanupFn: () => void) {
  React.useEffect(() => {
    return cleanupFn;
  }, [cleanupFn]);
}

/**
 * Web Worker 优化（用于 CPU 密集型任务）
 */
export function createWorker(fn: Function) {
  const blob = new Blob(
    [
      `
    onmessage = function(e) {
      const result = (${fn.toString()})(e.data);
      postMessage(result);
    };
  `,
    ],
    { type: "application/javascript" },
  );

  return new Worker(URL.createObjectURL(blob));
}

// ==================== 性能监控 ====================

/**
 * 页面加载性能监控
 */
export function measurePageLoadPerformance() {
  if (typeof window === "undefined" || !window.performance) return;

  const timing = window.performance.timing;
  const navigation = window.performance.navigation;

  const metrics = {
    // DNS 查询时间
    dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,

    // TCP 连接时间
    tcpConnection: timing.connectEnd - timing.connectStart,

    // 请求响应时间
    requestResponse: timing.responseEnd - timing.requestStart,

    // DOM 解析时间
    domParsing: timing.domComplete - timing.domLoading,

    // 页面完全加载时间
    pageLoad: timing.loadEventEnd - timing.navigationStart,

    // 首次内容绘制（FCP）
    fcp: 0, // 需要通过 PerformanceObserver 获取

    // 最大内容绘制（LCP）
    lcp: 0, // 需要通过 PerformanceObserver 获取
  };

  console.log("[Performance] Page Load Metrics:", metrics);
  return metrics;
}

/**
 * 监控长任务
 */
export function monitorLongTasks(callback: (duration: number) => void) {
  if (typeof window === "undefined" || !PerformanceObserver) return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 50) {
        callback(entry.duration);
        console.warn("[Performance] Long task detected:", entry.duration, "ms");
      }
    }
  });

  observer.observe({ entryTypes: ["longtask"] });

  return () => observer.disconnect();
}

// ==================== 导出 ====================

export default {
  lazyRoutes,
  useLazyImage,
  LazyImage,
  useDebounce,
  useThrottle,
  debounce,
  throttle,
  useVirtualList,
  measurePageLoadPerformance,
  monitorLongTasks,
};
