/**
 * DebounceScheduler 测试套件
 * TDD 实战 v7 — 红绿黄循环
 * 覆盖：基础调度、leading/trailing、优先级、flush、cancel、状态查询
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DebounceScheduler, createScheduler } from '../src/DebounceScheduler.js';

describe('DebounceScheduler', () => {
  let scheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new DebounceScheduler(100);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── 基础调度 ───

  describe('基础调度', () => {
    it('schedule 应在延迟后执行', () => {
      const fn = vi.fn();
      scheduler.schedule('a', fn);
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('fn 不是函数应抛 TypeError', () => {
      expect(() => scheduler.schedule('a', 'not-fn')).toThrow(TypeError);
    });

    it('重复 schedule 同一 key 应重置计时', () => {
      const fn = vi.fn();
      scheduler.schedule('a', fn);
      vi.advanceTimersByTime(50);
      scheduler.schedule('a', fn); // 重置
      vi.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('不同 key 应独立计时', () => {
      const fa = vi.fn();
      const fb = vi.fn();
      scheduler.schedule('a', fa, { delay: 100 });
      scheduler.schedule('b', fb, { delay: 200 });
      vi.advanceTimersByTime(100);
      expect(fa).toHaveBeenCalledTimes(1);
      expect(fb).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);
      expect(fb).toHaveBeenCalledTimes(1);
    });
  });

  // ─── leading 模式 ───

  describe('leading 模式', () => {
    it('leading=true 应立即执行第一次', () => {
      const fn = vi.fn();
      scheduler.schedule('a', fn, { leading: true, trailing: false });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('leading+trailing 应执行两次', () => {
      const fn = vi.fn();
      scheduler.schedule('a', fn, { leading: true, trailing: true, delay: 100 });
      expect(fn).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  // ─── trailing 模式 ───

  describe('trailing 模式', () => {
    it('trailing=false 不应在延迟后执行', () => {
      const fn = vi.fn();
      scheduler.schedule('a', fn, { leading: true, trailing: false });
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // ─── cancel ───

  describe('cancel', () => {
    it('cancel 应阻止执行', () => {
      const fn = vi.fn();
      scheduler.schedule('a', fn);
      scheduler.cancel('a');
      vi.advanceTimersByTime(100);
      expect(fn).not.toHaveBeenCalled();
    });

    it('返回的取消函数应有效', () => {
      const fn = vi.fn();
      const cancel = scheduler.schedule('a', fn);
      cancel();
      vi.advanceTimersByTime(100);
      expect(fn).not.toHaveBeenCalled();
    });

    it('cancelAll 应取消所有任务', () => {
      const fa = vi.fn();
      const fb = vi.fn();
      scheduler.schedule('a', fa);
      scheduler.schedule('b', fb);
      scheduler.cancelAll();
      vi.advanceTimersByTime(100);
      expect(fa).not.toHaveBeenCalled();
      expect(fb).not.toHaveBeenCalled();
    });
  });

  // ─── flush ───

  describe('flush', () => {
    it('flush 应立即执行所有 pending 任务', () => {
      const fa = vi.fn();
      const fb = vi.fn();
      scheduler.schedule('a', fa);
      scheduler.schedule('b', fb);
      scheduler.flush();
      expect(fa).toHaveBeenCalledTimes(1);
      expect(fb).toHaveBeenCalledTimes(1);
    });

    it('flush 应按优先级顺序执行', () => {
      const order = [];
      scheduler.schedule('low', () => order.push('low'), { priority: 10 });
      scheduler.schedule('high', () => order.push('high'), { priority: 1 });
      scheduler.flush();
      expect(order).toEqual(['high', 'low']);
    });
  });

  // ─── 状态查询 ───

  describe('状态查询', () => {
    it('isPending 应返回正确状态', () => {
      scheduler.schedule('a', vi.fn());
      expect(scheduler.isPending('a')).toBe(true);
      expect(scheduler.isPending('b')).toBe(false);
    });

    it('pendingCount 应返回 pending 数量', () => {
      scheduler.schedule('a', vi.fn());
      scheduler.schedule('b', vi.fn());
      expect(scheduler.pendingCount).toBe(2);
      vi.advanceTimersByTime(100);
      expect(scheduler.pendingCount).toBe(0);
    });

    it('keys 应返回所有任务 key', () => {
      scheduler.schedule('a', vi.fn());
      scheduler.schedule('b', vi.fn());
      expect(scheduler.keys).toContain('a');
      expect(scheduler.keys).toContain('b');
    });
  });

  // ─── 错误处理 ───

  describe('错误处理', () => {
    it('onError 应捕获执行错误', () => {
      const errors = [];
      scheduler = new DebounceScheduler(100, {
        onError: (err) => errors.push(err),
      });
      scheduler.schedule('a', () => { throw new Error('boom'); });
      vi.advanceTimersByTime(100);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('boom');
    });

    it('flush 时错误不应中断其他任务', () => {
      const errors = [];
      scheduler = new DebounceScheduler(100, {
        onError: (err) => errors.push(err),
      });
      scheduler.schedule('bad', () => { throw new Error('boom'); });
      const good = vi.fn();
      scheduler.schedule('good', good);
      scheduler.flush();
      expect(errors).toHaveLength(1);
      expect(good).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 便捷工厂 ───

  describe('createScheduler', () => {
    it('应返回 DebounceScheduler 实例', () => {
      const s = createScheduler(200);
      expect(s).toBeInstanceOf(DebounceScheduler);
      expect(s.defaultDelay).toBe(200);
    });
  });
});
