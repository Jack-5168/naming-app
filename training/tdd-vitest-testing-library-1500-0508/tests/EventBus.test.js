/**
 * EventBus 测试套件
 * TDD 实战 v7 — 红绿黄循环
 * 覆盖：基础订阅、通配符、优先级、once、中间件、错误隔离、历史记录
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, createEventBus } from '../src/EventBus.js';

describe('EventBus', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // ─── 基础订阅 ───

  describe('基础订阅', () => {
    it('on 注册后 emit 应触发 handler', () => {
      const handler = vi.fn();
      bus.on('click', handler);
      bus.emit('click', { x: 1 });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ x: 1 }, expect.any(Object));
    });

    it('handler 不是函数应抛 TypeError', () => {
      expect(() => bus.on('click', 'not-a-fn')).toThrow(TypeError);
    });

    it('多次 on 同一事件应触发所有 handler', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('click', h1);
      bus.on('click', h2);
      bus.emit('click');
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('off 指定 handler 后不应再触发', () => {
      const handler = vi.fn();
      bus.on('click', handler);
      bus.off('click', handler);
      bus.emit('click');
      expect(handler).not.toHaveBeenCalled();
    });

    it('off 不传 handler 应移除该事件所有监听器', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('click', h1);
      bus.on('click', h2);
      bus.off('click');
      bus.emit('click');
      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });

    it('listenerCount 应返回正确数量', () => {
      bus.on('a', vi.fn());
      bus.on('a', vi.fn());
      bus.on('b', vi.fn());
      expect(bus.listenerCount('a')).toBe(2);
      expect(bus.listenerCount('b')).toBe(1);
      expect(bus.listenerCount()).toBe(3);
    });

    it('返回的取消函数应移除订阅', () => {
      const handler = vi.fn();
      const unsub = bus.on('click', handler);
      unsub();
      bus.emit('click');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─── 通配符 ───

  describe('通配符订阅', () => {
    it('"user.*" 应匹配 "user.created"', () => {
      const handler = vi.fn();
      bus.on('user.*', handler);
      bus.emit('user.created', { id: 1 });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('"user.*" 不应匹配 "user.profile.updated"', () => {
      const handler = vi.fn();
      bus.on('user.*', handler);
      bus.emit('user.profile.updated', {});
      expect(handler).not.toHaveBeenCalled();
    });

    it('通配符和精确匹配应同时触发', () => {
      const exact = vi.fn();
      const wild = vi.fn();
      bus.on('user.created', exact);
      bus.on('user.*', wild);
      bus.emit('user.created', {});
      expect(exact).toHaveBeenCalledTimes(1);
      expect(wild).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 优先级 ───

  describe('优先级', () => {
    it('高优先级（数值小）应先执行', () => {
      const order = [];
      bus.on('click', () => order.push('low'), { priority: 10 });
      bus.on('click', () => order.push('high'), { priority: 1 });
      bus.on('click', () => order.push('mid'), { priority: 5 });
      bus.emit('click');
      expect(order).toEqual(['high', 'mid', 'low']);
    });
  });

  // ─── once ───

  describe('once', () => {
    it('once 应只触发一次', () => {
      const handler = vi.fn();
      bus.once('click', handler);
      bus.emit('click');
      bus.emit('click');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('once 返回的取消函数应有效', () => {
      const handler = vi.fn();
      const unsub = bus.once('click', handler);
      unsub();
      bus.emit('click');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─── 中间件 ───

  describe('中间件', () => {
    it('before 中间件应修改 context', () => {
      const handler = vi.fn();
      bus.before((ctx) => ({ ...ctx, data: { ...ctx.data, injected: true } }));
      bus.on('click', handler);
      bus.emit('click', { x: 1 });
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ injected: true }),
        expect.any(Object)
      );
    });

    it('before 返回 false 应取消事件', () => {
      const handler = vi.fn();
      bus.before(() => false);
      bus.on('click', handler);
      const result = bus.emit('click');
      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('after 中间件应在 handler 后执行', () => {
      const order = [];
      bus.after(() => order.push('after'));
      bus.on('click', () => order.push('handler'));
      bus.emit('click');
      expect(order).toEqual(['handler', 'after']);
    });

    it('中间件不是函数应抛 TypeError', () => {
      expect(() => bus.before('not-fn')).toThrow(TypeError);
      expect(() => bus.after('not-fn')).toThrow(TypeError);
    });
  });

  // ─── 错误隔离 ───

  describe('错误隔离', () => {
    it('handler 抛错不应影响其他 handler', () => {
      const h1 = vi.fn(() => { throw new Error('boom'); });
      const h2 = vi.fn();
      bus.on('click', h1);
      bus.on('click', h2);
      bus.emit('click');
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('自定义 errorHandler 应捕获错误', () => {
      const errors = [];
      bus = new EventBus({ errorHandler: (err) => errors.push(err) });
      bus.on('click', () => { throw new Error('boom'); });
      bus.emit('click');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('boom');
    });
  });

  // ─── 历史记录 ───

  describe('历史记录', () => {
    it('getHistory 应记录所有事件', () => {
      bus.emit('a', 1);
      bus.emit('b', 2);
      const history = bus.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].event).toBe('a');
      expect(history[1].event).toBe('b');
    });

    it('getHistory(event) 应过滤指定事件', () => {
      bus.emit('a', 1);
      bus.emit('a', 2);
      bus.emit('b', 3);
      expect(bus.getHistory('a')).toHaveLength(2);
      expect(bus.getHistory('b')).toHaveLength(1);
    });
  });

  // ─── clear ───

  describe('clear', () => {
    it('clear 应移除所有监听器和历史', () => {
      bus.on('a', vi.fn());
      bus.emit('a');
      bus.clear();
      expect(bus.listenerCount()).toBe(0);
      expect(bus.getHistory()).toHaveLength(0);
    });
  });

  // ─── 便捷工厂 ───

  describe('createEventBus', () => {
    it('应返回 EventBus 实例', () => {
      const b = createEventBus();
      expect(b).toBeInstanceOf(EventBus);
    });
  });
});
