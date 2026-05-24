/**
 * EventEmitter 测试套件
 * TDD 实战 — 红绿黄循环
 */
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { EventEmitter } from '../src/EventEmitter.js';

describe('EventEmitter', () => {
  let emitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  // ─── on / off ───

  describe('on / off', () => {
    it('应该注册监听器并在 emit 时触发', () => {
      const handler = vi.fn();
      emitter.on('test', handler);
      emitter.emit('test');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('应该传递参数给处理函数', () => {
      const handler = vi.fn();
      emitter.on('data', handler);
      emitter.emit('data', 42, 'hello');
      expect(handler).toHaveBeenCalledWith(42, 'hello');
    });

    it('应该支持多个监听器', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      emitter.on('event', h1);
      emitter.on('event', h2);
      emitter.emit('event');
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('off 应该移除指定监听器', () => {
      const handler = vi.fn();
      emitter.on('test', handler);
      emitter.off('test', handler);
      emitter.emit('test');
      expect(handler).not.toHaveBeenCalled();
    });

    it('off 不传 handler 应该移除所有监听器', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      emitter.on('test', h1);
      emitter.on('test', h2);
      emitter.off('test');
      emitter.emit('test');
      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });

    it('on 应该返回取消订阅函数', () => {
      const handler = vi.fn();
      const unsubscribe = emitter.on('test', handler);
      unsubscribe();
      emitter.emit('test');
      expect(handler).not.toHaveBeenCalled();
    });

    it('handler 不是函数应该抛错', () => {
      expect(() => emitter.on('test', 'not-a-fn')).toThrow(TypeError);
    });
  });

  // ─── once ───

  describe('once', () => {
    it('once 监听器只应触发一次', () => {
      const handler = vi.fn();
      emitter.once('test', handler);
      emitter.emit('test');
      emitter.emit('test');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('once 应该传递参数', () => {
      const handler = vi.fn();
      emitter.once('data', handler);
      emitter.emit('data', { foo: 'bar' });
      expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('once 应该返回取消订阅函数', () => {
      const handler = vi.fn();
      const unsubscribe = emitter.once('test', handler);
      unsubscribe();
      emitter.emit('test');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─── emit ───

  describe('emit', () => {
    it('应该返回所有处理函数的返回值数组', () => {
      emitter.on('calc', () => 1);
      emitter.on('calc', () => 2);
      const results = emitter.emit('calc');
      expect(results).toEqual([1, 2]);
    });

    it('emit 不存在的事件不应报错', () => {
      expect(() => emitter.emit('nonexistent')).not.toThrow();
    });

    it('emit 返回值应包含 once 监听器的结果', () => {
      emitter.on('x', () => 'a');
      emitter.once('x', () => 'b');
      const results = emitter.emit('x');
      expect(results).toContain('a');
      expect(results).toContain('b');
    });
  });

  // ─── 中间件 ───

  describe('中间件', () => {
    it('中间件应接收事件名和参数', () => {
      const middleware = vi.fn();
      emitter.use(middleware);
      emitter.emit('test', 1, 2);
      expect(middleware).toHaveBeenCalledWith('test', [1, 2]);
    });

    it('中间件返回 false 应阻止事件传播', () => {
      const handler = vi.fn();
      emitter.use(() => false);
      emitter.on('test', handler);
      const results = emitter.emit('test');
      expect(handler).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });

    it('中间件不返回 false 应继续传播', () => {
      const handler = vi.fn();
      emitter.use(() => true);
      emitter.on('test', handler);
      emitter.emit('test');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('非函数中间件应抛错', () => {
      expect(() => emitter.use('bad')).toThrow(TypeError);
    });
  });

  // ─── 错误处理 ───

  describe('错误处理', () => {
    it('handler 抛错且无 errorHandler 时应向上抛', () => {
      emitter.on('bad', () => { throw new Error('fail'); });
      expect(() => emitter.emit('bad')).toThrow('fail');
    });

    it('handler 抛错且有 errorHandler 时应调用 errorHandler', () => {
      const errorHandler = vi.fn();
      emitter = new EventEmitter({ errorHandler });
      emitter.on('bad', () => { throw new Error('fail'); });
      emitter.emit('bad');
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error), 'bad');
    });
  });

  // ─── 辅助方法 ───

  describe('辅助方法', () => {
    it('listenerCount 应返回监听器总数', () => {
      emitter.on('a', () => {});
      emitter.on('a', () => {});
      emitter.once('a', () => {});
      expect(emitter.listenerCount('a')).toBe(3);
    });

    it('getEventCount 应返回 emit 次数', () => {
      emitter.emit('x');
      emitter.emit('x');
      emitter.emit('y');
      expect(emitter.getEventCount('x')).toBe(2);
      expect(emitter.getEventCount('y')).toBe(1);
      expect(emitter.getEventCount('z')).toBe(0);
    });

    it('eventNames 应返回所有注册过的事件名', () => {
      emitter.on('a', () => {});
      emitter.once('b', () => {});
      emitter.emit('c');
      const names = emitter.eventNames();
      expect(names).toContain('a');
      expect(names).toContain('b');
      expect(names).toContain('c');
    });

    it('removeAllListeners 无参数应清除所有事件', () => {
      emitter.on('a', () => {});
      emitter.on('b', () => {});
      emitter.removeAllListeners();
      expect(emitter.listenerCount('a')).toBe(0);
      expect(emitter.listenerCount('b')).toBe(0);
    });

    it('removeAllListeners 有参数应只清除指定事件', () => {
      emitter.on('a', () => {});
      emitter.on('b', () => {});
      emitter.removeAllListeners('a');
      expect(emitter.listenerCount('a')).toBe(0);
      expect(emitter.listenerCount('b')).toBe(1);
    });

    it('listeners 应返回某事件的所有监听器', () => {
      const h1 = () => {};
      const h2 = () => {};
      emitter.on('x', h1);
      emitter.once('x', h2);
      const list = emitter.listeners('x');
      expect(list).toContain(h1);
      expect(list).toContain(h2);
    });
  });

  // ─── 容量警告 ───

  describe('容量限制', () => {
    it('超过 maxListeners 应输出警告', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      emitter = new EventEmitter({ maxListeners: 2 });
      emitter.on('test', () => {});
      emitter.on('test', () => {});
      emitter.on('test', () => {});
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Possible memory leak'),
      );
      warnSpy.mockRestore();
    });
  });
});
