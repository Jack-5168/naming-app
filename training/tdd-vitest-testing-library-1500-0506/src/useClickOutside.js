/**
 * useClickOutside - React 自定义 Hook
 * TDD 实战模块 3/3
 * 支持：点击外部触发、排除元素、多引用、自定义事件
 */
import { useRef, useEffect, useCallback } from 'react';

/**
 * 点击外部触发回调
 * @param {Function} callback - 点击外部时触发的回调
 * @param {Object} options - 配置选项
 * @param {Array} [options.exclude] - 排除的 ref 数组（点击这些元素不触发）
 * @param {string} [options.event] - 监听的事件类型，默认 'mousedown'
 * @returns {Function} 返回一个 ref 设置函数
 */
export function useClickOutside(callback, options = {}) {
  const { exclude = [], event = 'mousedown' } = options;
  const callbackRef = useRef(callback);

  // 保持 callback 最新
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const refs = useRef([]);

  /**
   * 注册一个 ref
   * @param {Object|Function} ref - React ref 或 ref 设置函数
   * @returns {Object|Function} 返回原始 ref
   */
  const registerRef = useCallback((ref) => {
    refs.current.push(ref);
    return ref;
  }, []);

  /**
   * 获取 DOM 元素
   * @private
   */
  const getDOMNode = useCallback((ref) => {
    if (!ref) return null;
    if (typeof ref === 'function') return null;
    return ref.current || null;
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const { target } = e;

      // 检查是否点击在注册的 ref 内部
      const isInside = refs.current.some((ref) => {
        const node = getDOMNode(ref);
        return node && node.contains(target);
      });

      if (isInside) return;

      // 检查是否在排除列表中
      const isExcluded = exclude.some((ref) => {
        const node = getDOMNode(ref);
        return node && node.contains(target);
      });

      if (isExcluded) return;

      callbackRef.current(e);
    };

    document.addEventListener(event, handler);
    return () => {
      document.removeEventListener(event, handler);
    };
  }, [event, exclude, getDOMNode]);

  return registerRef;
}

/**
 * 简化版：直接返回 ref
 * @param {Function} callback
 * @param {Object} options
 * @returns {Object} React ref
 */
export function useClickOutsideRef(callback, options = {}) {
  const ref = useRef(null);
  const excludeRef = options.excludeRef || null;
  const event = options.event || 'mousedown';

  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = (e) => {
      const node = ref.current;
      if (!node || node.contains(e.target)) return;

      if (excludeRef && excludeRef.current && excludeRef.current.contains(e.target)) {
        return;
      }

      callbackRef.current(e);
    };

    document.addEventListener(event, handler);
    return () => {
      document.removeEventListener(event, handler);
    };
  }, [event, excludeRef]);

  return ref;
}
