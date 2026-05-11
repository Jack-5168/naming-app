// tests/retry.test.js
import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import {
  retry,
} from '../src/retry.js';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // ── 成功场景 ──

  it('函数成功时应该直接返回结果', async () => {
    const fn = vi.fn(() => 'success');
    const result = await retry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('函数第一次失败第二次成功应该返回结果', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');

    const promise = retry(fn, { maxAttempts: 3, delay: 100 });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  // ── 失败场景 ──

  it('所有尝试都失败应该抛出最后错误', async () => {
    const error = new Error('always fails');
    const fn = vi.fn(() => Promise.reject(error));

    // 先 attach rejection handler，再推进 timer
    const retryPromise = retry(fn, { maxAttempts: 3, delay: 100 });
    const assertion = expect(retryPromise).rejects.toThrow('always fails');
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  // ── onRetry 回调 ──

  it('应该调用 onRetry 回调', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockResolvedValueOnce('done');

    const promise = retry(fn, {
      maxAttempts: 3, delay: 100, onRetry,
    });
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(result).toBe('done');
  });

  // ── 指数退避 ──

  it('指数退避应该递增延迟时间', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockResolvedValueOnce('ok');

    const promise = retry(fn, {
      maxAttempts: 3, delay: 100, backoff: 'exponential',
    });

    // 第 1 次重试延迟 100ms
    await vi.advanceTimersByTimeAsync(100);
    // 第 2 次重试延迟 200ms
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;
    expect(result).toBe('ok');
  });

  // ── attempt 参数 ──

  it('应该将 attempt 编号传给函数', async () => {
    const attempts = [];
    const fn = vi.fn((attempt) => {
      attempts.push(attempt);
      if (attempt < 3) throw new Error('not yet');
      return 'done';
    });

    const promise = retry(fn, { maxAttempts: 3, delay: 50 });
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;

    expect(attempts).toEqual([1, 2, 3]);
    expect(result).toBe('done');
  });

  // ── 默认参数 ──

  it('应该使用默认 maxAttempts=3', async () => {
    const fn = vi.fn(() => Promise.reject(new Error('x')));
    const promise = retry(fn, { delay: 10 });
    // 3 次尝试之间有 2 次延迟
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(10);
    await expect(promise).rejects.toThrow('x');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
