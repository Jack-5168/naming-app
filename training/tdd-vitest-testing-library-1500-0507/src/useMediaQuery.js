/**
 * useMediaQuery - React 媒体查询 Hook
 * TDD 实战模块 3/3
 * 支持：单/多媒体查询、服务端渲染、变化回调
 */
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 媒体查询 Hook
 * @param {string} query - CSS 媒体查询字符串
 * @param {Object} options
 * @param {boolean} [options.initialValue] - 初始值（SSR 用）
 * @param {Function} [options.onChange] - 变化回调
 * @returns {boolean} 是否匹配
 */
export function useMediaQuery(query, options = {}) {
  const { initialValue = false, onChange = null } = options;
  const [matches, setMatches] = useState(initialValue);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    // SSR 检测
    if (typeof window === 'undefined' || typeof matchMedia !== 'function') {
      return;
    }

    const mql = matchMedia(query);

    const handler = (e) => {
      setMatches(e.matches);
      if (onChangeRef.current) {
        onChangeRef.current(e.matches, query);
      }
    };

    // 初始化
    setMatches(mql.matches);

    // 兼容新旧 API
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
    } else {
      mql.addListener(handler);
    }

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handler);
      } else {
        mql.removeListener(handler);
      }
    };
  }, [query]);

  return matches;
}

/**
 * 多媒体查询 Hook
 * @param {Object} queries - { name: query } 映射
 * @param {Object} options
 * @returns {Object} { name: boolean } 映射
 */
export function useMediaQueries(queries, options = {}) {
  const results = {};

  for (const [name, query] of Object.entries(queries)) {
    results[name] = useMediaQuery(query, options);
  }

  return results;
}

/**
 * 获取当前匹配的名称列表
 * @param {Object} queries
 * @param {Object} options
 * @returns {string[]}
 */
export function useMatchedMediaNames(queries, options = {}) {
  const queryResults = useMediaQueries(queries, options);
  return Object.entries(queryResults)
    .filter(([, matches]) => matches)
    .map(([name]) => name);
}
