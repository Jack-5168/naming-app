// tests/deep-clone.test.js
import {
  describe, it, expect,
} from 'vitest';
import {
  deepClone,
} from '../src/deep-clone.js';

describe('deepClone', () => {
  // ── 基本类型 ──

  it('应该正确克隆 null 和 undefined', () => {
    expect(deepClone(null)).toBe(null);
    expect(deepClone(undefined)).toBe(undefined);
  });

  it('应该正确克隆基本类型', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(true)).toBe(true);
    expect(deepClone(false)).toBe(false);
  });

  // ── 对象 ──

  it('应该深度克隆普通对象', () => {
    const obj = { a: 1, b: { c: 2 } };
    const clone = deepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
    expect(clone.b).not.toBe(obj.b);
  });

  it('应该克隆嵌套对象', () => {
    const obj = { a: { b: { c: { d: 1 } } } };
    const clone = deepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone.a.b.c).not.toBe(obj.a.b.c);
  });

  // ── 数组 ──

  it('应该深度克隆数组', () => {
    const arr = [1, { x: 2 }, [3, 4]];
    const clone = deepClone(arr);
    expect(clone).toEqual(arr);
    expect(clone).not.toBe(arr);
    expect(clone[1]).not.toBe(arr[1]);
    expect(clone[2]).not.toBe(arr[2]);
  });

  it('应该克隆空数组', () => {
    expect(deepClone([])).toEqual([]);
  });

  // ── Date ──

  it('应该克隆 Date 对象', () => {
    const date = new Date('2026-05-01');
    const clone = deepClone(date);
    expect(clone).toEqual(date);
    expect(clone).not.toBe(date);
    expect(clone.getTime()).toBe(date.getTime());
  });

  // ── RegExp ──

  it('应该克隆 RegExp 对象', () => {
    const regex = /hello/gi;
    const clone = deepClone(regex);
    expect(clone.source).toBe(regex.source);
    expect(clone.flags).toBe(regex.flags);
    expect(clone).not.toBe(regex);
  });

  // ── Map ──

  it('应该克隆 Map', () => {
    const map = new Map([['a', 1], ['b', { nested: true }]]);
    const clone = deepClone(map);
    expect(clone.get('a')).toBe(1);
    expect(clone.get('b')).toEqual({ nested: true });
    expect(clone.get('b')).not.toBe(map.get('b'));
    expect(clone).not.toBe(map);
  });

  // ── Set ──

  it('应该克隆 Set', () => {
    const set = new Set([1, 2, 3]);
    const clone = deepClone(set);
    expect(clone).toEqual(set);
    expect(clone).not.toBe(set);
  });

  // ── 边界 ──

  it('应该克隆空对象', () => {
    expect(deepClone({})).toEqual({});
  });

  it('应该克隆包含 Date 和 RegExp 的混合对象', () => {
    const obj = {
      date: new Date('2026-01-01'),
      regex: /test/i,
      nested: { arr: [1, 2] },
    };
    const clone = deepClone(obj);
    expect(clone.date).toEqual(obj.date);
    expect(clone.date).not.toBe(obj.date);
    expect(clone.regex.source).toBe(obj.regex.source);
    expect(clone.nested.arr).toEqual([1, 2]);
    expect(clone.nested.arr).not.toBe(obj.nested.arr);
  });
});
