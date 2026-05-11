/**
 * RetryManager 测试套件
 * TDD 实战 — 红绿黄循环
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetryManager, createRetryManager } from '../src/RetryManager.js';

describe('RetryManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // ─── 基础重试 ───

  describe('基础重试', () => {
    it('成功时不应重试', async () => {
      const manager = new RetryManager({ maxRetries: 3, baseDelay: 100 });
      const fn = vi.fn().mockResolvedValue('ok');

      const result = await manager.execute(fn);

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('失败时应按 maxRetries 重试', async () => {
      const manager = new RetryManager({ maxRetries: 2, baseDelay: 100 });
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('ok');

      const promise = manager.execute(fn);
      // 推进所有定时器让重试完成
      await vi.advanceTimersByTimeAsync(10000);
      const result = await promise;

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('超过 maxRetries 后应抛出最后错误', async () => {
      const manager = new RetryManager({ maxRetries: 2, baseDelay: 100 });
      const fn = vi.fn().mockRejectedValue(new Error('persistent fail'));

      const promise = manager.execute(fn);
      promise.catch(() => {}); // suppress unhandled rejection
      await vi.advanceTimersByTimeAsync(10000);

      expect(fn).toHaveBeenCalledTimes(3); // 1 次初始 + 2 次重试
    });

    it('fn 不是函数应抛 TypeError', async () => {
      const manager = new RetryManager();
      await expect(manager.execute('not-a-fn')).rejects.toThrow(TypeError);
    });
  });

  // ─── 指数退避 ───

  describe('指数退避', () => {
    it('延迟应随重试次数指数增长', async () => {
      const manager = new RetryManager({
        maxRetries: 3,
        baseDelay: 100,
        factor: 2,
        maxDelay: 10000,
      });

      let attempt = 0;
      const fn = vi.fn().mockImplementation(async () => {
        if (attempt < 3) {
          attempt++;
          throw new Error('fail');
        }
        return 'ok';
      });

      const promise = manager.execute(fn);

      // 推进定时器：attempt 0 delay=100, attempt 1 delay=200, attempt 2 delay=400
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBe('ok');
    });

    it('延迟不应超过 maxDelay', () => {
      const manager = new RetryManager({
        baseDelay: 1000,
        factor: 10,
        maxDelay: 5000,
      });
      // attempt=3: 1000*10^3 = 1,000,000 > maxDelay
      const delay = manager._calculateDelay(3);
      expect(delay).toBe(5000);
    });
  });

  // ─── shouldRetry 过滤 ───

  describe('shouldRetry 过滤', () => {
    it('shouldRetry 返回 false 时应停止重试', async () => {
      const manager = new RetryManager({
        maxRetries: 5,
        baseDelay: 100,
        shouldRetry: (err) => !err.message.includes('fatal'),
      });

      const fn = vi.fn().mockRejectedValue(new Error('fatal error'));

      const promise = manager.execute(fn);
      promise.catch(() => {});
      await vi.advanceTimersByTimeAsync(10000);

      await expect(promise).rejects.toThrow('fatal error');
      expect(fn).toHaveBeenCalledTimes(1); // 不重试
    });

    it('shouldRetry 根据 attempt 决策', async () => {
      const manager = new RetryManager({
        maxRetries: 5,
        baseDelay: 100,
        shouldRetry: (err, attempt) => attempt < 2,
      });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      const promise = manager.execute(fn);
      promise.catch(() => {});
      await vi.advanceTimersByTimeAsync(10000);

      await expect(promise).rejects.toThrow('fail');
      expect(fn).toHaveBeenCalledTimes(3); // 初始 + 2 次重试
    });
  });

  // ─── onRetry 回调 ───

  describe('onRetry 回调', () => {
    it('每次重试时应调用 onRetry', async () => {
      const onRetry = vi.fn();
      const manager = new RetryManager({
        maxRetries: 2,
        baseDelay: 100,
        onRetry,
      });

      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('ok');

      const promise = manager.execute(fn);
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(
        1,
        expect.any(Error),
        0,
        2
      );
      expect(onRetry).toHaveBeenNthCalledWith(
        2,
        expect.any(Error),
        1,
        2
      );
    });
  });

  // ─── jitter ───

  describe('jitter', () => {
    it('jitter=false 时延迟应确定', () => {
      const manager = new RetryManager({
        baseDelay: 100,
        factor: 2,
        jitter: false,
      });
      expect(manager._calculateDelay(0)).toBe(100);
      expect(manager._calculateDelay(1)).toBe(200);
      expect(manager._calculateDelay(2)).toBe(400);
    });

    it('jitter=true 时延迟应在 0~计算值之间', () => {
      const manager = new RetryManager({
        baseDelay: 100,
        factor: 2,
        jitter: true,
      });
      for (let i = 0; i < 10; i++) {
        const delay = manager._calculateDelay(2); // 计算值=400
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(400);
      }
    });
  });

  // ─── 配置 ───

  describe('配置', () => {
    it('getConfig 应返回当前配置', () => {
      const manager = new RetryManager({
        maxRetries: 5,
        baseDelay: 500,
        maxDelay: 10000,
        factor: 3,
        jitter: true,
      });
      const config = manager.getConfig();
      expect(config).toEqual({
        maxRetries: 5,
        baseDelay: 500,
        maxDelay: 10000,
        factor: 3,
        jitter: true,
      });
    });

    it('configure 应更新配置', () => {
      const manager = new RetryManager();
      manager.configure({ maxRetries: 10, baseDelay: 2000 });
      expect(manager.maxRetries).toBe(10);
      expect(manager.baseDelay).toBe(2000);
    });

    it('createRetryManager 应创建实例', () => {
      const manager = createRetryManager({ maxRetries: 5 });
      expect(manager).toBeInstanceOf(RetryManager);
      expect(manager.maxRetries).toBe(5);
    });
  });

  // ─── fn 接收 attempt 参数 ───

  describe('fn 参数', () => {
    it('fn 应接收 attempt 参数', async () => {
      const manager = new RetryManager({ maxRetries: 2, baseDelay: 100 });
      const attempts = [];
      const fn = vi.fn().mockImplementation(async (attempt) => {
        attempts.push(attempt);
        if (attempt < 2) throw new Error('fail');
        return 'ok';
      });

      const promise = manager.execute(fn);
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(attempts).toEqual([0, 1, 2]);
    });
  });
});
