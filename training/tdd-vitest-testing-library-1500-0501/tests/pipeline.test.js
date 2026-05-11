// tests/pipeline.test.js
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import {
  Pipeline,
} from '../src/pipeline.js';

describe('Pipeline', () => {
  // ── 同步管道 ──

  it('应该执行同步管道', () => {
    const result = Pipeline.create(5)
      .use((x) => x + 1)
      .use((x) => x * 2)
      .runSync();
    expect(result).toBe(12); // (5+1)*2
  });

  it('空管道应该返回初始值', () => {
    const result = Pipeline.create(42).runSync();
    expect(result).toBe(42);
  });

  it('应该支持链式调用', () => {
    const pipeline = Pipeline.create(0);
    expect(pipeline.use((x) => x + 1)).toBe(pipeline);
    expect(pipeline.useIf(true, (x) => x + 1)).toBe(pipeline);
    expect(pipeline.reset()).toBe(pipeline);
    expect(pipeline.clear()).toBe(pipeline);
  });

  // ── 异步管道 ──

  it('应该执行异步管道', async () => {
    const result = await Pipeline.create(10)
      .use(async (x) => x + 5)
      .use((x) => x * 2)
      .run();
    expect(result).toBe(30);
  });

  // ── 条件步骤 ──

  it('useIf 条件为 true 时应该执行', () => {
    const fn = vi.fn((x) => x + 100);
    const result = Pipeline.create(1)
      .useIf(true, fn)
      .runSync();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe(101);
  });

  it('useIf 条件为 false 时应该跳过', () => {
    const fn = vi.fn((x) => x + 100);
    const result = Pipeline.create(1)
      .useIf(false, fn)
      .runSync();
    expect(fn).not.toHaveBeenCalled();
    expect(result).toBe(1);
  });

  it('useIf 支持函数条件', () => {
    const fn = vi.fn((x) => x * 10);
    const result = Pipeline.create(5)
      .useIf((x) => x > 3, fn)
      .runSync();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe(50);
  });

  it('useIf 函数条件为 false 时跳过', () => {
    const fn = vi.fn((x) => x * 10);
    const result = Pipeline.create(2)
      .useIf((x) => x > 3, fn)
      .runSync();
    expect(fn).not.toHaveBeenCalled();
    expect(result).toBe(2);
  });

  // ── 非函数步骤 ──

  it('非函数步骤应该抛出 TypeError', () => {
    expect(() => Pipeline.create(1).use('not-a-fn')).toThrow(TypeError);
  });

  // ── 查询方法 ──

  it('stepCount 应该返回步骤数量', () => {
    const p = Pipeline.create(1)
      .use((x) => x + 1)
      .use((x) => x * 2);
    expect(p.stepCount()).toBe(2);
  });

  it('value 应该返回当前值', () => {
    const p = Pipeline.create(99);
    expect(p.value()).toBe(99);
  });

  // ── reset ──

  it('reset 应该重置值', () => {
    const p = Pipeline.create(10)
      .use((x) => x + 5);
    p.runSync();
    p.reset(100);
    expect(p.value()).toBe(100);
  });

  // ── clear ──

  it('clear 应该清空步骤', () => {
    const p = Pipeline.create(1)
      .use((x) => x + 1)
      .use((x) => x * 2);
    expect(p.stepCount()).toBe(2);
    p.clear();
    expect(p.stepCount()).toBe(0);
  });

  // ── 静态工厂 ──

  it('Pipeline.create 应该返回 Pipeline 实例', () => {
    const p = Pipeline.create(42);
    expect(p).toBeInstanceOf(Pipeline);
    expect(p.value()).toBe(42);
  });
});
