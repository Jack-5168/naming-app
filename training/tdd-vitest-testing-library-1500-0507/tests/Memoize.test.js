/**
 * Memoize 测试套件
 * TDD 实战 — 红绿黄循环
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { memoize, memoizeShallow, shallowEqual } from '../src/Memoize.js';

describe('memoize', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // ─── 基础缓存 ───

  describe('基础缓存', () => {
    it('相同参数应返回缓存值', () => {
      const fn = vi.fn().mockReturnValue(42);
      const memoized = memoize(fn);

      expect(memoized('a')).toBe(42);
      expect(memoized('a')).toBe(42);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('不同参数应分别缓存', () => {
      const fn = vi.fn().mockImplementation((x) => x * 2);
      const memoized = memoize(fn);

      expect(memoized(2)).toBe(4);
      expect(memoized(3)).toBe(6);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('fn 不是函数应抛 TypeError', () => {
      expect(() => memoize('not-a-fn')).toThrow(TypeError);
    });
  });

  // ─── 多参数 ───

  describe('多参数', () => {
    it('多参数应正确缓存', () => {
      const fn = vi.fn().mockImplementation((a, b) => a + b);
      const memoized = memoize(fn);

      expect(memoized(1, 2)).toBe(3);
      expect(memoized(1, 2)).toBe(3);
      expect(memoized(2, 1)).toBe(3);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  // ─── TTL 过期 ───

  describe('TTL 过期', () => {
    it('超过 TTL 后应重新计算', () => {
      const fn = vi.fn().mockReturnValue('value');
      const memoized = memoize(fn, { maxAge: 1000 });

      expect(memoized('a')).toBe('value');
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1001);

      expect(memoized('a')).toBe('value');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('maxAge=0 应永不过期', () => {
      const fn = vi.fn().mockReturnValue('value');
      const memoized = memoize(fn, { maxAge: 0 });

      memoized('a');
      vi.advanceTimersByTime(999999);
      memoized('a');

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // ─── maxSize / LRU 淘汰 ───

  describe('maxSize / LRU 淘汰', () => {
    it('超过 maxSize 应淘汰最旧条目', () => {
      const fn = vi.fn().mockImplementation((x) => x);
      const memoized = memoize(fn, { maxSize: 2 });

      memoized('a');
      memoized('b');
      memoized('c'); // 淘汰 'a'

      expect(memoized.size()).toBe(2);
      memoized('a'); // 重新计算
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('访问过的条目不应被淘汰（LRU）', () => {
      const fn = vi.fn().mockImplementation((x) => x);
      const memoized = memoize(fn, { maxSize: 2 });

      memoized('a');
      memoized('b');
      memoized('a'); // 刷新 'a'
      memoized('c'); // 淘汰 'b'

      expect(memoized('b')).toBe('b'); // 重新计算
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('onEvict 应在淘汰时调用', () => {
      const evicted = [];
      const fn = vi.fn().mockImplementation((x) => x);
      const memoized = memoize(fn, {
        maxSize: 1,
        onEvict: (key, value) => evicted.push({ key, value }),
      });

      memoized('a');
      memoized('b'); // 淘汰 'a'

      expect(evicted).toEqual([{ key: '["a"]', value: 'a' }]);
    });
  });

  // ─── 统计信息 ───

  describe('统计信息', () => {
    it('stats 应返回正确的命中/未命中计数', () => {
      const fn = vi.fn().mockReturnValue(1);
      const memoized = memoize(fn);

      memoized('a'); // miss
      memoized('a'); // hit
      memoized('b'); // miss

      const stats = memoized.stats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.calls).toBe(3);
      expect(stats.cacheSize).toBe(2);
    });
  });

  // ─── 缓存操作 ───

  describe('缓存操作', () => {
    it('delete 应移除指定缓存', () => {
      const fn = vi.fn().mockReturnValue(1);
      const memoized = memoize(fn);

      memoized('a');
      memoized.delete('["a"]');
      memoized('a');

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('clear 应清除所有缓存和统计', () => {
      const fn = vi.fn().mockReturnValue(1);
      const memoized = memoize(fn);

      memoized('a');
      memoized('b');
      memoized.stats(); // 产生统计
      memoized.clear();

      const stats = memoized.stats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.calls).toBe(0);
      expect(memoized.size()).toBe(0);
    });

    it('has 应检查缓存是否存在', () => {
      const fn = vi.fn().mockReturnValue(1);
      const memoized = memoize(fn);

      expect(memoized.has('["a"]')).toBe(false);
      memoized('a');
      expect(memoized.has('["a"]')).toBe(true);
    });

    it('has 对过期条目应返回 false', () => {
      const fn = vi.fn().mockReturnValue(1);
      const memoized = memoize(fn, { maxAge: 1000 });

      memoized('a');
      vi.advanceTimersByTime(1001);
      expect(memoized.has('["a"]')).toBe(false);
    });
  });

  // ─── 自定义 keyResolver ───

  describe('自定义 keyResolver', () => {
    it('应使用自定义 key 生成函数', () => {
      const fn = vi.fn().mockReturnValue('value');
      const memoized = memoize(fn, {
        keyResolver: (obj) => obj.id,
      });

      memoized({ id: 1, name: 'a' });
      memoized({ id: 1, name: 'b' }); // 相同 key

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // ─── shallowEqual ───

  describe('shallowEqual', () => {
    it('相同引用应返回 true', () => {
      const obj = { a: 1 };
      expect(shallowEqual(obj, obj)).toBe(true);
    });

    it('相同内容的对象应返回 true', () => {
      expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    });

    it('不同内容的对象应返回 false', () => {
      expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it('不同长度的对象应返回 false', () => {
      expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it('null 值应正确处理', () => {
      expect(shallowEqual(null, null)).toBe(true);
      expect(shallowEqual(null, undefined)).toBe(false);
      expect(shallowEqual(null, {})).toBe(false);
    });

    it('相同原始类型应返回 true（=== 比较）', () => {
      expect(shallowEqual(1, 1)).toBe(true);
      expect(shallowEqual('a', 'a')).toBe(true);
    });

    it('不同原始类型应返回 false', () => {
      expect(shallowEqual(1, 2)).toBe(false);
      expect(shallowEqual('a', 'b')).toBe(false);
    });
  });

  // ─── memoizeShallow ───

  describe('memoizeShallow', () => {
    it('应使用浅比较生成 key', () => {
      const fn = vi.fn().mockReturnValue('value');
      const memoized = memoizeShallow(fn);

      memoized({ a: 1 });
      memoized({ a: 1 }); // 相同内容

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
