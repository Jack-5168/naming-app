/**
 * LRUCache 测试套件
 * TDD 实战 — 红绿黄循环
 */
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { LRUCache } from '../src/LRUCache.js';

describe('LRUCache', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache(3);
  });

  // ─── 基础 CRUD ───

  describe('基础 CRUD', () => {
    it('put 和 get 应该正常工作', () => {
      cache.put('a', 1);
      expect(cache.get('a')).toBe(1);
    });

    it('get 不存在的键应返回 undefined', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('put 相同 key 应更新值', () => {
      cache.put('a', 1);
      cache.put('a', 2);
      expect(cache.get('a')).toBe(2);
    });

    it('delete 应移除键并返回 true', () => {
      cache.put('a', 1);
      expect(cache.delete('a')).toBe(true);
      expect(cache.get('a')).toBeUndefined();
    });

    it('delete 不存在的键应返回 false', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('has 应检查键是否存在', () => {
      cache.put('a', 1);
      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
    });

    it('size 应反映当前缓存项数量', () => {
      cache.put('a', 1);
      cache.put('b', 2);
      expect(cache.size).toBe(2);
    });
  });

  // ─── LRU 淘汰策略 ───

  describe('LRU 淘汰策略', () => {
    it('超出容量应淘汰最久未使用的项', () => {
      cache.put('a', 1);
      cache.put('b', 2);
      cache.put('c', 3);
      cache.put('d', 4); // 淘汰 'a'
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('d')).toBe(4);
    });

    it('get 访问过的项不应被淘汰', () => {
      cache.put('a', 1);
      cache.put('b', 2);
      cache.put('c', 3);
      cache.get('a'); // 刷新 'a'
      cache.put('d', 4); // 淘汰 'b'（最久未用）
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
    });

    it('put 更新已有项应刷新其位置', () => {
      cache.put('a', 1);
      cache.put('b', 2);
      cache.put('c', 3);
      cache.put('a', 10); // 刷新 'a'
      cache.put('d', 4); // 淘汰 'b'
      expect(cache.get('a')).toBe(10);
      expect(cache.get('b')).toBeUndefined();
    });

    it('容量为 1 时每次 put 都淘汰前一项', () => {
      const small = new LRUCache(1);
      small.put('a', 1);
      small.put('b', 2);
      expect(small.get('a')).toBeUndefined();
      expect(small.get('b')).toBe(2);
    });
  });

  // ─── TTL 过期 ───

  describe('TTL 过期', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('TTL 过期后 get 应返回 undefined', () => {
      cache.put('a', 1, 1000);
      vi.advanceTimersByTime(1001);
      expect(cache.get('a')).toBeUndefined();
    });

    it('TTL 过期后 has 应返回 false', () => {
      cache.put('a', 1, 1000);
      vi.advanceTimersByTime(1001);
      expect(cache.has('a')).toBe(false);
    });

    it('TTL 过期后 delete 仍应返回 false（已自动清除）', () => {
      cache.put('a', 1, 1000);
      vi.advanceTimersByTime(1001);
      cache.get('a'); // 触发过期删除
      expect(cache.delete('a')).toBe(false);
    });

    it('TTL 为 0 应永不过期', () => {
      cache.put('a', 1, 0);
      vi.advanceTimersByTime(999999);
      expect(cache.get('a')).toBe(1);
    });

    it('更新已有项的 TTL 应生效', () => {
      cache.put('a', 1, 1000);
      cache.put('a', 2, 5000);
      vi.advanceTimersByTime(2000);
      expect(cache.get('a')).toBe(2); // 还没过期
      vi.advanceTimersByTime(4000);
      expect(cache.get('a')).toBeUndefined(); // 已过期
    });
  });

  // ─── 统计信息 ───

  describe('统计信息', () => {
    it('getStats 应返回正确的命中率', () => {
      cache.put('a', 1);
      cache.get('a'); // hit
      cache.get('a'); // hit
      cache.get('b'); // miss
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3);
    });

    it('空缓存的 hitRate 应为 0', () => {
      expect(cache.getStats().hitRate).toBe(0);
    });

    it('clear 应重置所有统计', () => {
      cache.put('a', 1);
      cache.get('a');
      cache.get('b');
      cache.clear();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });
  });

  // ─── 遍历方法 ───

  describe('遍历方法', () => {
    it('keys 应按使用顺序从新到旧返回', () => {
      cache.put('a', 1);
      cache.put('b', 2);
      cache.put('c', 3);
      cache.get('a'); // 刷新 'a' → 头部: a, c, b
      expect(cache.keys()).toEqual(['a', 'c', 'b']);
    });

    it('values 应按使用顺序从新到旧返回', () => {
      cache.put('a', 1);
      cache.put('b', 2);
      cache.put('c', 3);
      expect(cache.values()).toEqual([3, 2, 1]);
    });

    it('entries 应返回 [key, value] 对', () => {
      cache.put('a', 1);
      cache.put('b', 2);
      expect(cache.entries()).toEqual([['b', 2], ['a', 1]]);
    });

    it('应支持 for...of 迭代', () => {
      cache.put('x', 10);
      cache.put('y', 20);
      const result = [];
      for (const [k, v] of cache) {
        result.push([k, v]);
      }
      expect(result).toEqual([['y', 20], ['x', 10]]);
    });
  });

  // ─── 边界情况 ───

  describe('边界情况', () => {
    it('capacity <= 0 应抛错', () => {
      expect(() => new LRUCache(0)).toThrow('Capacity must be greater than 0');
      expect(() => new LRUCache(-1)).toThrow('Capacity must be greater than 0');
    });

    it('clear 后缓存应为空', () => {
      cache.put('a', 1);
      cache.put('b', 2);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
    });

    it('应支持各种类型的 key 和 value', () => {
      cache.put(0, 'zero');
      cache.put('', 'empty');
      cache.put('obj', { nested: true });
      expect(cache.get(0)).toBe('zero');
      expect(cache.get('')).toBe('empty');
      expect(cache.get('obj')).toEqual({ nested: true });
    });
  });
});
