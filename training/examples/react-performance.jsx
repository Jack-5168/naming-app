/**
 * React 性能优化示例组件
 * 展示如何在 React 中应用懒加载、防抖、节流和内存管理
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';

// ==================== 自定义 Hooks ====================

/**
 * 防抖 Hook
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * 节流 Hook
 */
export function useThrottle(value, delay) {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastExecRef = useRef(0);
  const timeoutRef = useRef(null);
  
  useEffect(() => {
    const now = Date.now();
    
    if (now - lastExecRef.current >= delay) {
      setThrottledValue(value);
      lastExecRef.current = now;
    } else {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setThrottledValue(value);
        lastExecRef.current = Date.now();
      }, delay - (now - lastExecRef.current));
    }
    
    return () => clearTimeout(timeoutRef.current);
  }, [value, delay]);
  
  return throttledValue;
}

/**
 * 懒加载 Hook
 */
export function useLazyComponent(importFunc) {
  const [Component, setComponent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let mounted = true;
    
    importFunc()
      .then(module => {
        if (mounted) setComponent(() => module.default);
      })
      .catch(err => {
        if (mounted) setError(err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    
    return () => { mounted = false; };
  }, [importFunc]);
  
  return { Component, loading, error };
}

/**
 * 滚动位置 Hook (节流)
 */
export function useScrollPosition(throttleMs = 100) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const timeoutRef = useRef(null);
  
  useEffect(() => {
    const handleScroll = () => {
      if (timeoutRef.current) return;
      
      timeoutRef.current = setTimeout(() => {
        setScrollPosition(window.scrollY);
        timeoutRef.current = null;
      }, throttleMs);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // 初始化
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [throttleMs]);
  
  return scrollPosition;
}

/**
 * 窗口大小 Hook (防抖)
 */
export function useWindowSize(debounceMs = 250) {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  
  useEffect(() => {
    let timeoutId = null;
    
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight
        });
      }, debounceMs);
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [debounceMs]);
  
  return size;
}

/**
 * 资源清理 Hook
 */
export function useCleanup() {
  const cleanupsRef = useRef([]);
  
  const addCleanup = useCallback((cleanupFn) => {
    cleanupsRef.current.push(cleanupFn);
  }, []);
  
  useEffect(() => {
    return () => {
      cleanupsRef.current.forEach(fn => {
        try {
          fn();
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      });
      cleanupsRef.current = [];
    };
  }, []);
  
  return addCleanup;
}

// ==================== 优化组件示例 ====================

/**
 * 优化后的搜索框组件
 * 使用防抖避免频繁 API 调用
 */
export function SearchBox({ onSearch, placeholder = '搜索...' }) {
  const [inputValue, setInputValue] = useState('');
  const debouncedValue = useDebounce(inputValue, 300);
  
  useEffect(() => {
    if (debouncedValue) {
      onSearch(debouncedValue);
    }
  }, [debouncedValue, onSearch]);
  
  return (
    <input
      type="text"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      placeholder={placeholder}
      className="search-input"
    />
  );
}

/**
 * 优化后的滚动加载列表
 * 使用节流和 Intersection Observer
 */
export function InfiniteScrollList({ items, onLoadMore, renderItem }) {
  const [displayItems, setDisplayItems] = useState(items.slice(0, 20));
  const loadingRef = useRef(false);
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);
  
  // 设置 Intersection Observer
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !loadingRef.current) {
          loadingRef.current = true;
          onLoadMore().then((newItems) => {
            if (newItems.length > 0) {
              setDisplayItems(prev => [...prev, ...newItems]);
            }
            loadingRef.current = false;
          });
        }
      },
      { rootMargin: '100px' }
    );
    
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [onLoadMore]);
  
  return (
    <div className="infinite-list">
      {displayItems.map((item, index) => (
        <div key={item.id || index} className="list-item">
          {renderItem(item, index)}
        </div>
      ))}
      <div ref={loadMoreRef} className="load-more-trigger">
        {loadingRef.current ? '加载中...' : ''}
      </div>
    </div>
  );
}

/**
 * 优化后的图片组件
 * 支持懒加载和占位图
 */
export function LazyImage({ src, alt, placeholder, className, ...props }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const imgRef = useRef(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          if (imgRef.current) {
            imgRef.current.src = src;
          }
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => observer.disconnect();
  }, [src]);
  
  return (
    <img
      ref={imgRef}
      alt={alt}
      className={`${className} ${isLoaded ? 'loaded' : ''} ${isError ? 'error' : ''}`}
      onLoad={() => setIsLoaded(true)}
      onError={() => setIsError(true)}
      {...props}
    />
  );
}

/**
 * 虚拟列表组件
 * 只渲染可见项，优化长列表性能
 */
export function VirtualList({ items, itemHeight, renderItem, containerHeight = 500 }) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(items.length, startIndex + visibleCount + 5);
  
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);
  
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);
  
  return (
    <div
      ref={containerRef}
      className="virtual-list-container"
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => {
          const actualIndex = startIndex + index;
          return (
            <div
              key={item.id || actualIndex}
              className="virtual-list-item"
              style={{
                position: 'absolute',
                top: actualIndex * itemHeight,
                height: itemHeight,
                width: '100%'
              }}
            >
              {renderItem(item, actualIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 懒加载路由组件示例
 */
export function LazyRouteExample() {
  // 懒加载组件
  const Dashboard = lazy(() => import('./Dashboard'));
  const Settings = lazy(() => import('./Settings'));
  const Analytics = lazy(() => import('./Analytics'));
  
  return (
    <Suspense fallback={<div className="loading-spinner">加载中...</div>}>
      <Dashboard />
      
      {/* 条件懒加载 */}
      <ShowMoreButton>
        <Analytics />
      </ShowMoreButton>
      
      <Settings />
    </Suspense>
  );
}

/**
 * 性能优化的表单组件
 * 使用防抖验证和节流提交
 */
export function OptimizedForm({ onSubmit }) {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 防抖验证
  const validateField = useCallback(
    debounce((name, value) => {
      const error = validateFieldSync(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }, 300),
    []
  );
  
  // 节流提交
  const handleSubmit = useCallback(
    throttle(async (e) => {
      e.preventDefault();
      if (isSubmitting) return;
      
      setIsSubmitting(true);
      try {
        await onSubmit(formData);
      } finally {
        setIsSubmitting(false);
      }
    }, 1000, { leading: true, trailing: false }),
    [formData, onSubmit, isSubmitting]
  );
  
  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        name="email"
        onChange={(e) => handleChange('email', e.target.value)}
        placeholder="邮箱"
      />
      {errors.email && <span className="error">{errors.email}</span>}
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '提交中...' : '提交'}
      </button>
    </form>
  );
}

// ==================== 性能监控组件 ====================

/**
 * 性能指标展示组件
 */
export function PerformanceMetrics() {
  const [metrics, setMetrics] = useState({
    lcp: null,
    fid: null,
    cls: null
  });
  
  useEffect(() => {
    // LCP
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      setMetrics(prev => ({ ...prev, lcp: lastEntry.startTime }));
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    
    // FID
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fid = entries[0].processingStart - entries[0].startTime;
      setMetrics(prev => ({ ...prev, fid }));
    }).observe({ type: 'first-input', buffered: true });
    
    // CLS
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      setMetrics(prev => ({ ...prev, cls: clsValue }));
    }).observe({ type: 'layout-shift', buffered: true });
  }, []);
  
  return (
    <div className="performance-metrics">
      <div>LCP: {metrics.lcp ? `${metrics.lcp.toFixed(0)}ms` : '计算中...'}</div>
      <div>FID: {metrics.fid ? `${metrics.fid.toFixed(0)}ms` : '等待交互...'}</div>
      <div>CLS: {metrics.cls ? metrics.cls.toFixed(3) : '计算中...'}</div>
    </div>
  );
}

export default {
  useDebounce,
  useThrottle,
  useLazyComponent,
  useScrollPosition,
  useWindowSize,
  useCleanup,
  SearchBox,
  InfiniteScrollList,
  LazyImage,
  VirtualList,
  PerformanceMetrics
};
