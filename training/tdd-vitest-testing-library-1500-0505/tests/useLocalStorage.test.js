/**
 * useLocalStorage Hook 测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage, useSyncedLocalStorage } from '../src/useLocalStorage.js';

describe('useLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  // ── 基础读写 ──

  describe('基础读写', () => {
    it('初始值为 defaultValue', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
      expect(result.current[0]).toBe('default');
    });

    it('defaultValue 为函数时惰性求值', () => {
      const fn = vi.fn(() => 'lazy');
      renderHook(() => useLocalStorage('fn-key', fn));
      expect(fn).toHaveBeenCalled();
    });

    it('setValue 更新值并写入 localStorage', () => {
      const { result } = renderHook(() => useLocalStorage('k', 'init'));
      act(() => {
        result.current[1]('updated');
      });
      expect(result.current[0]).toBe('updated');
      expect(window.localStorage.getItem('k')).toBe('"updated"');
    });

    it('setValue 支持函数式更新', () => {
      const { result } = renderHook(() => useLocalStorage('counter', 0));
      act(() => {
        result.current[1]((prev) => prev + 1);
      });
      expect(result.current[0]).toBe(1);
    });

    it('JSON 对象正确序列化/反序列化', () => {
      const obj = { name: 'Alice', age: 30 };
      const { result } = renderHook(() => useLocalStorage('obj-key', null));
      act(() => {
        result.current[1](obj);
      });
      expect(result.current[0]).toEqual(obj);
    });

    it('数组正确序列化/反序列化', () => {
      const arr = [1, 2, 3];
      const { result } = renderHook(() => useLocalStorage('arr-key', []));
      act(() => {
        result.current[1](arr);
      });
      expect(result.current[0]).toEqual(arr);
    });
  });

  // ── removeValue ──

  describe('removeValue', () => {
    it('删除 localStorage 中的值', () => {
      const { result } = renderHook(() => useLocalStorage('del-key', 'init'));
      act(() => {
        result.current[1]('changed');
      });
      act(() => {
        result.current[2](); // remove
      });
      expect(result.current[0]).toBe('init');
      expect(window.localStorage.getItem('del-key')).toBe(null);
    });
  });

  // ── localStorage 异常处理 ──

  describe('localStorage 异常处理', () => {
    it('localStorage 不可读时返回 defaultValue', () => {
      const stub = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });
      const { result } = renderHook(() => useLocalStorage('err-key', 'fallback'));
      expect(result.current[0]).toBe('fallback');
      stub.mockRestore();
    });

    it('localStorage 写入失败不崩溃', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('write fail');
      });
      const { result } = renderHook(() => useLocalStorage('write-err', 'init'));
      act(() => {
        result.current[1]('new');
      });
      // 不抛异常即可
      expect(true).toBe(true);
      vi.restoreAllMocks();
    });

    it('JSON 解析失败时返回原始字符串', () => {
      window.localStorage.setItem('raw-key', 'not-json');
      const { result } = renderHook(() => useLocalStorage('raw-key', null));
      expect(result.current[0]).toBe('not-json');
    });
  });

  // ── key 变化 ──

  describe('key 变化', () => {
    it('key 变化时重新读取新 key 的值', () => {
      window.localStorage.setItem('new-key', '"stored"');
      const { result, rerender } = renderHook(
        ({ storageKey }) => useLocalStorage(storageKey, 'default'),
        { initialProps: { storageKey: 'old-key' } },
      );
      expect(result.current[0]).toBe('default');
      rerender({ storageKey: 'new-key' });
      expect(result.current[0]).toBe('stored');
    });
  });

  // ── useSyncedLocalStorage ──

  describe('useSyncedLocalStorage', () => {
    it('基础功能与 useLocalStorage 一致', () => {
      const { result } = renderHook(() => useSyncedLocalStorage('sync-key', 'init'));
      expect(result.current[0]).toBe('init');
      act(() => {
        result.current[1]('updated');
      });
      expect(result.current[0]).toBe('updated');
    });

    it('监听 storage 事件同步其他标签页的更改', () => {
      const { result } = renderHook(() => useSyncedLocalStorage('event-key', 'init'));

      // 模拟其他标签页写入
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'event-key',
          newValue: JSON.stringify('from-other-tab'),
        }));
      });

      expect(result.current[0]).toBe('from-other-tab');
    });

    it('storage 事件删除时恢复默认值', () => {
      const { result } = renderHook(() => useSyncedLocalStorage('del-event', 'default'));
      act(() => {
        result.current[1]('changed');
      });
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'del-event',
          newValue: null,
        }));
      });
      expect(result.current[0]).toBe('default');
    });
  });
});
