// tests/lru-cache.test.js
import {
  describe, it, expect, beforeEach,
} from 'vitest';
import {
  LRUCache,
} from '../src/lru-cache.js';

describe('LRUCache', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache(3);
  });

  // ── 基础 CRUD ──

  it('应该 put 和 get', () => {
    cache.put('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('不存在的键应该返回 -1', () => {
    expect(cache.get('nonexistent')).toBe(-1);
  });

  it('应该更新已存在的键', () => {
    cache.put('a', 1);
    cache.put('a', 2);
    expect(cache.get('a')).toBe(2);
    expect(cache.size()).toBe(1);
  });

  // ── 容量淘汰 ──

  it('超出容量应该淘汰最久未使用的项', () => {
    cache.put('a', 1);
    cache.put('b', 2);
    cache.put('c', 3);
    cache.put('d', 4); // 淘汰 a
    expect(cache.get('a')).toBe(-1);
    expect(cache.get('d')).toBe(4);
    expect(cache.size()).toBe(3);
  });

  it('get 操作应该更新使用顺序', () => {
    cache.put('a', 1);
    cache.put('b', 2);
    cache.put('c', 3);
    cache.get('a'); // a 变成最近使用
    cache.put('d', 4); // 淘汰 b（最久未使用）
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(-1);
  });

  // ── 查询方法 ──

  it('has 应该检查键是否存在', () => {
    cache.put('x', 10);
    expect(cache.has('x')).toBe(true);
    expect(cache.has('y')).toBe(false);
  });

  it('size 应该返回当前大小', () => {
    expect(cache.size()).toBe(0);
    cache.put('a', 1);
    cache.put('b', 2);
    expect(cache.size()).toBe(2);
  });

  it('isEmpty 应该判断是否为空', () => {
    expect(cache.isEmpty()).toBe(true);
    cache.put('a', 1);
    expect(cache.isEmpty()).toBe(false);
  });

  // ── 删除和清空 ──

  it('remove 应该删除指定键', () => {
    cache.put('a', 1);
    expect(cache.remove('a')).toBe(true);
    expect(cache.get('a')).toBe(-1);
    expect(cache.remove('nonexistent')).toBe(false);
  });

  it('clear 应该清空所有项', () => {
    cache.put('a', 1);
    cache.put('b', 2);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.isEmpty()).toBe(true);
  });

  // ── 顺序查询 ──

  it('keys 应该按最近使用顺序返回', () => {
    cache.put('a', 1);
    cache.put('b', 2);
    cache.put('c', 3);
    expect(cache.keys()).toEqual(['a', 'b', 'c']);
  });

  it('values 应该按最近使用顺序返回', () => {
    cache.put('a', 1);
    cache.put('b', 2);
    cache.put('c', 3);
    expect(cache.values()).toEqual([1, 2, 3]);
  });

  it('entries 应该返回所有键值对', () => {
    cache.put('a', 1);
    cache.put('b', 2);
    expect(cache.entries()).toEqual([['a', 1], ['b', 2]]);
  });

  // ── 构造函数 ──

  it('无效容量应该抛出错误', () => {
    expect(() => new LRUCache(0)).toThrow();
    expect(() => new LRUCache(-1)).toThrow();
    expect(() => new LRUCache(1.5)).toThrow();
  });

  it('capacity 应该返回容量', () => {
    expect(cache.capacity()).toBe(3);
  });
});
