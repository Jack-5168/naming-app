/**
 * useMediaQuery 测试套件
 * TDD 实战 — 红绿黄循环
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery, useMediaQueries, useMatchedMediaNames } from '../src/useMediaQuery.js';

describe('useMediaQuery', () => {
  let listeners = [];
  let mockMql;

  beforeEach(() => {
    listeners = [];
    mockMql = {
      matches: false,
      addEventListener: vi.fn((event, cb) => {
        listeners.push({ event, cb });
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn((cb) => {
        listeners.push({ event: 'change', cb });
      }),
      removeListener: vi.fn(),
    };

    globalThis.matchMedia = vi.fn().mockReturnValue(mockMql);
  });

  // ─── 基础匹配 ───

  describe('基础匹配', () => {
    it('应返回 matchMedia 的 matches 值', () => {
      mockMql.matches = true;
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
      expect(result.current).toBe(true);
    });

    it('不匹配时应返回 false', () => {
      mockMql.matches = false;
      const { result } = renderHook(() => useMediaQuery('(min-width: 1200px)'));
      expect(result.current).toBe(false);
    });

    it('matchMedia 不存在时应使用 initialValue（SSR 场景）', () => {
      const origMatchMedia = globalThis.matchMedia;
      delete globalThis.matchMedia;

      const { result } = renderHook(() =>
        useMediaQuery('(min-width: 768px)', { initialValue: true }));
      expect(result.current).toBe(true);

      globalThis.matchMedia = origMatchMedia;
    });
  });

  // ─── 变化监听 ───

  describe('变化监听', () => {
    it('媒体查询变化时应更新值', () => {
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
      expect(result.current).toBe(false);

      act(() => {
        listeners[0].cb({ matches: true });
      });

      expect(result.current).toBe(true);
    });

    it('onChange 回调应在变化时触发', () => {
      const onChange = vi.fn();
      renderHook(() =>
        useMediaQuery('(min-width: 768px)', { onChange }));

      act(() => {
        listeners[0].cb({ matches: true });
      });

      expect(onChange).toHaveBeenCalledWith(true, '(min-width: 768px)');
    });

    it('onChange 变化时应使用最新引用', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const { rerender } = renderHook(
        ({ callback }) => useMediaQuery('(min-width: 768px)', { onChange: callback }),
        { initialProps: { callback: cb1 } }
      );

      rerender({ callback: cb2 });

      act(() => {
        listeners[0].cb({ matches: true });
      });

      expect(cb2).toHaveBeenCalled();
      expect(cb1).not.toHaveBeenCalled();
    });
  });

  // ─── 兼容性 ───

  describe('兼容性', () => {
    it('应使用旧版 addListener API（无 addEventListener 时）', () => {
      delete mockMql.addEventListener;
      delete mockMql.removeEventListener;

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
      expect(mockMql.addListener).toHaveBeenCalled();
      expect(result.current).toBe(false);
    });
  });

  // ─── 清理 ───

  describe('清理', () => {
    it('卸载时应移除事件监听', () => {
      const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
      unmount();
      expect(mockMql.removeEventListener).toHaveBeenCalled();
    });

    it('旧版 API 卸载时应调用 removeListener', () => {
      delete mockMql.addEventListener;
      delete mockMql.removeEventListener;

      const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
      unmount();
      expect(mockMql.removeListener).toHaveBeenCalled();
    });
  });

  // ─── query 变化 ───

  describe('query 变化', () => {
    it('query 变化时应重新订阅', () => {
      const { rerender } = renderHook(
        ({ query }) => useMediaQuery(query),
        { initialProps: { query: '(min-width: 768px)' } }
      );

      expect(globalThis.matchMedia).toHaveBeenCalledWith('(min-width: 768px)');

      rerender({ query: '(min-width: 1024px)' });
      expect(globalThis.matchMedia).toHaveBeenCalledWith('(min-width: 1024px)');
    });
  });
});

describe('useMediaQueries', () => {
  let mockMql;

  beforeEach(() => {
    mockMql = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    globalThis.matchMedia = vi.fn().mockReturnValue(mockMql);
  });

  it('应返回所有媒体查询的匹配结果', () => {
    const { result } = renderHook(() =>
      useMediaQueries({
        mobile: '(max-width: 767px)',
        tablet: '(min-width: 768px) and (max-width: 1023px)',
        desktop: '(min-width: 1024px)',
      }));

    expect(result.current).toHaveProperty('mobile');
    expect(result.current).toHaveProperty('tablet');
    expect(result.current).toHaveProperty('desktop');
  });

  it('应调用 matchMedia 三次', () => {
    renderHook(() =>
      useMediaQueries({
        a: '(min-width: 100px)',
        b: '(min-width: 200px)',
        c: '(min-width: 300px)',
      }));

    expect(globalThis.matchMedia).toHaveBeenCalledTimes(3);
  });
});

describe('useMatchedMediaNames', () => {
  let mockMql;

  beforeEach(() => {
    mockMql = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    globalThis.matchMedia = vi.fn().mockReturnValue(mockMql);
  });

  it('应返回匹配的名称列表', () => {
    // 第一个匹配，第二个不匹配
    globalThis.matchMedia
      .mockReturnValueOnce({ ...mockMql, matches: true })
      .mockReturnValueOnce({ ...mockMql, matches: false });

    const { result } = renderHook(() =>
      useMatchedMediaNames({
        mobile: '(max-width: 767px)',
        desktop: '(min-width: 768px)',
      }));

    expect(result.current).toContain('mobile');
    expect(result.current).not.toContain('desktop');
  });

  it('没有匹配时应返回空数组', () => {
    const { result } = renderHook(() =>
      useMatchedMediaNames({
        a: '(min-width: 100px)',
        b: '(min-width: 200px)',
      }));

    expect(result.current).toEqual([]);
  });
});
