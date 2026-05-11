// tests/event-emitter.test.js
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import {
  EventEmitter,
} from '../src/event-emitter.js';

describe('EventEmitter', () => {
  let emitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  // ── on / emit ──

  it('应该注册监听器并触发回调', () => {
    const fn = vi.fn();
    emitter.on('data', fn);
    emitter.emit('data', 42);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(42);
  });

  it('应该支持多个参数', () => {
    const fn = vi.fn();
    emitter.on('multi', fn);
    emitter.emit('multi', 'a', 'b', { c: 1 });
    expect(fn).toHaveBeenCalledWith('a', 'b', { c: 1 });
  });

  it('应该支持多个监听器', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    emitter.on('event', fn1);
    emitter.on('event', fn2);
    emitter.emit('event');
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('非函数监听器应该抛出 TypeError', () => {
    expect(() => emitter.on('x', 'not-a-fn')).toThrow(TypeError);
    expect(() => emitter.once('x', null)).toThrow(TypeError);
  });

  // ── once ──

  it('once 监听器应该只触发一次', () => {
    const fn = vi.fn();
    emitter.once('once', fn);
    emitter.emit('once');
    emitter.emit('once');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('once 和 on 可以同时存在', () => {
    const onceFn = vi.fn();
    const onFn = vi.fn();
    emitter.once('x', onceFn);
    emitter.on('x', onFn);
    emitter.emit('x');
    emitter.emit('x');
    expect(onceFn).toHaveBeenCalledTimes(1);
    expect(onFn).toHaveBeenCalledTimes(2);
  });

  // ── off ──

  it('off 应该取消监听', () => {
    const fn = vi.fn();
    emitter.on('remove', fn);
    emitter.off('remove', fn);
    emitter.emit('remove');
    expect(fn).not.toHaveBeenCalled();
  });

  it('on 返回的函数应该取消监听', () => {
    const fn = vi.fn();
    const unsub = emitter.on('auto', fn);
    unsub();
    emitter.emit('auto');
    expect(fn).not.toHaveBeenCalled();
  });

  it('off 不存在的监听器不应该报错', () => {
    expect(() => emitter.off('nonexistent', () => {})).not.toThrow();
  });

  // ── context ──

  it('应该支持自定义执行上下文', () => {
    const obj = { value: 100 };
    const fn = vi.fn(function () { return this.value; });
    emitter.on('ctx', fn, { context: obj });
    emitter.emit('ctx');
    expect(fn).toHaveBeenCalled();
  });

  // ── offAll ──

  it('offAll 应该清除指定事件的所有监听', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    emitter.on('a', fn1);
    emitter.on('a', fn2);
    emitter.on('b', fn1);
    emitter.offAll('a');
    emitter.emit('a');
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
    // b 不受影响
    emitter.emit('b');
    expect(fn1).toHaveBeenCalledTimes(1);
  });

  it('offAll 不带参数应该清除所有事件', () => {
    const fn = vi.fn();
    emitter.on('x', fn);
    emitter.on('y', fn);
    emitter.offAll();
    emitter.emit('x');
    emitter.emit('y');
    expect(fn).not.toHaveBeenCalled();
  });

  // ── 查询方法 ──

  it('listenerCount 应该返回监听器数量', () => {
    expect(emitter.listenerCount('none')).toBe(0);
    emitter.on('count', vi.fn());
    emitter.on('count', vi.fn());
    expect(emitter.listenerCount('count')).toBe(2);
  });

  it('eventNames 应该返回所有事件名', () => {
    emitter.on('a', vi.fn());
    emitter.on('b', vi.fn());
    expect(emitter.eventNames()).toEqual(['a', 'b']);
  });

  it('listeners 应该返回监听器函数列表', () => {
    const fn = vi.fn();
    emitter.on('x', fn);
    expect(emitter.listeners('x')).toContain(fn);
    expect(emitter.listeners('none')).toEqual([]);
  });

  // ── emit 返回值 ──

  it('有监听器时 emit 返回 true', () => {
    emitter.on('y', vi.fn());
    expect(emitter.emit('y')).toBe(true);
  });

  it('无监听器时 emit 返回 false', () => {
    expect(emitter.emit('nope')).toBe(false);
  });
});
