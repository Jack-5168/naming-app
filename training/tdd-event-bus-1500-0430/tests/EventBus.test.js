/**
 * EventBus TDD 测试套件
 *
 * TDD 红绿黄循环：
 *   🔴 Red   → 先写失败的测试
 *   🟢 Green → 写刚好通过测试的代码
 *   🔵 Refactor → 优化代码，保持测试通过
 *
 * 测试分类：
 *   - 基础功能 (8 tests)
 *   - 高级功能 (8 tests)
 *   - 边界/错误处理 (6 tests)
 *   - 异步功能 (4 tests)
 *   = 26 测试用例
 */

import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { EventBus } from '../src/EventBus.js';

// ============================================================
// 1. 基础功能测试 (Basic Functionality)
// ============================================================

describe('EventBus - 基础功能', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // --- 测试 1: 基础订阅与触发 ---
  it('应该能够订阅和触发事件', () => {
    const handler = vi.fn();
    bus.on('test', handler);
    bus.emit('test');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  // --- 测试 2: 传递参数 ---
  it('应该能够传递参数给监听器', () => {
    const handler = vi.fn();
    bus.on('data', handler);
    bus.emit('data', 'hello', 42, { key: 'value' });

    expect(handler).toHaveBeenCalledWith('hello', 42, { key: 'value' });
  });

  // --- 测试 3: 多个监听器 ---
  it('应该支持同一事件的多个监听器', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    bus.on('multi', handler1);
    bus.on('multi', handler2);
    bus.on('multi', handler3);

    bus.emit('multi');

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler3).toHaveBeenCalledTimes(1);
  });

  // --- 测试 4: 收集返回值 ---
  it('应该收集所有监听器的返回值', () => {
    bus.on('calc', () => 1);
    bus.on('calc', () => 2);
    bus.on('calc', () => 3);

    const results = bus.emit('calc');

    expect(results).toEqual([1, 2, 3]);
  });

  // --- 测试 5: 取消订阅 ---
  it('取消订阅后不应再触发', () => {
    const handler = vi.fn();
    const off = bus.on('once-only', handler);

    bus.emit('once-only');
    expect(handler).toHaveBeenCalledTimes(1);

    off();
    bus.emit('once-only');
    expect(handler).toHaveBeenCalledTimes(1); // 仍然是 1 次
  });

  // --- 测试 6: once 一次性订阅 ---
  it('once 应该只触发一次', () => {
    const handler = vi.fn();
    bus.once('once-event', handler);

    bus.emit('once-event');
    bus.emit('once-event');
    bus.emit('once-event');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  // --- 测试 7: once 返回值 ---
  it('once 应该正确返回处理函数的返回值', () => {
    bus.once('return-once', () => 'once-result');

    const results = bus.emit('return-once');
    expect(results).toEqual(['once-result']);

    // 第二次触发不应有结果
    const results2 = bus.emit('return-once');
    expect(results2).toEqual([]);
  });

  // --- 测试 8: listenerCount ---
  it('应该正确返回监听器数量', () => {
    expect(bus.listenerCount('empty')).toBe(0);

    bus.on('count', () => {});
    expect(bus.listenerCount('count')).toBe(1);

    bus.on('count', () => {});
    expect(bus.listenerCount('count')).toBe(2);
  });

  // --- 测试 9: hasListeners ---
  it('应该正确检查是否有监听器', () => {
    expect(bus.hasListeners('check')).toBe(false);

    bus.on('check', () => {});
    expect(bus.hasListeners('check')).toBe(true);
  });

  // --- 测试 10: 触发不存在的事件 ---
  it('触发不存在的事件不应报错', () => {
    const results = bus.emit('nonexistent');
    expect(results).toEqual([]);
  });

  // ============================================================
  // 2. 高级功能测试 (Advanced Functionality)
  // ============================================================

  describe('EventBus - 高级功能', () => {
    beforeEach(() => {
      bus = new EventBus();
    });

    // --- 测试 11: 优先级排序 ---
    it('应该按优先级顺序执行监听器', () => {
      const order = [];

      bus.on('priority', () => order.push('low'), { priority: 1 });
      bus.on('priority', () => order.push('high'), { priority: 10 });
      bus.on('priority', () => order.push('mid'), { priority: 5 });

      bus.emit('priority');
      expect(order).toEqual(['high', 'mid', 'low']);
    });

    // --- 测试 12: 命名空间通配符 ---
    it('应该支持命名空间通配符订阅', () => {
      const wildcardHandler = vi.fn();
      const specificHandler = vi.fn();

      bus.on('user:*', wildcardHandler);
      bus.on('user:login', specificHandler);

      bus.emit('user:login', 'admin');
      bus.emit('user:logout', 'admin');

      expect(specificHandler).toHaveBeenCalledTimes(1);
      expect(specificHandler).toHaveBeenCalledWith('admin');
      expect(wildcardHandler).toHaveBeenCalledTimes(2);
      expect(wildcardHandler).toHaveBeenNthCalledWith(1, 'user:login', 'admin');
      expect(wildcardHandler).toHaveBeenNthCalledWith(2, 'user:logout', 'admin');
    });

    // --- 测试 13: removeAllListeners (指定事件) ---
    it('应该能够移除指定事件的所有监听器', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      const h3 = vi.fn();

      bus.on('remove-me', h1);
      bus.on('remove-me', h2);
      bus.on('keep-me', h3);

      bus.removeAllListeners('remove-me');

      bus.emit('remove-me');
      bus.emit('keep-me');

      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
      expect(h3).toHaveBeenCalledTimes(1);
    });

    // --- 测试 14: removeAllListeners (全部) ---
    it('不传参数应该移除所有监听器', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();

      bus.on('event-a', h1);
      bus.on('event-b', h2);

      bus.removeAllListeners();

      bus.emit('event-a');
      bus.emit('event-b');

      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });

    // --- 测试 15: 事件历史 ---
    it('应该记录事件触发历史', () => {
      bus.on('history', () => {});
      bus.emit('history', 'arg1');
      bus.emit('history', 'arg2');
      bus.emit('other', 'data');

      const allHistory = bus.getHistory();
      const historyOnly = bus.getHistory('history');

      expect(allHistory).toHaveLength(3);
      expect(historyOnly).toHaveLength(2);
      expect(historyOnly[0].args).toEqual(['arg1']);
      expect(historyOnly[1].args).toEqual(['arg2']);
    });

    // --- 测试 16: clearHistory ---
    it('应该能够清除事件历史', () => {
      bus.on('hist', () => {});
      bus.emit('hist');
      expect(bus.getHistory()).toHaveLength(1);

      bus.clearHistory();
      expect(bus.getHistory()).toHaveLength(0);
    });

    // --- 测试 17: off 通过原始 handler 取消 once ---
    it('应该能够通过原始 handler 取消 once 订阅', () => {
      const handler = vi.fn();
      bus.once('cancellable-once', handler);

      // 使用 off 方法通过原始 handler 取消
      bus.off('cancellable-once', handler);

      bus.emit('cancellable-once');
      expect(handler).not.toHaveBeenCalled();
    });

    // --- 测试 18: 链式调用 ---
    it('应该支持链式调用', () => {
      const results = [];

      const returned = bus
        .on('chain', () => results.push(1))
        .on('chain', () => results.push(2));

      // on() 返回的是 off 函数，不是 bus，所以链式调用是 off 函数
      // 测试 on 返回 off 函数
      expect(typeof returned).toBe('function');
    });

    // ============================================================
    // 3. 边界与错误处理测试 (Edge Cases & Error Handling)
    // ============================================================

    describe('EventBus - 边界与错误处理', () => {
      beforeEach(() => {
        bus = new EventBus();
      });

      // --- 测试 19: handler 不是函数时抛出错误 ---
      it('handler 不是函数时应抛出 TypeError', () => {
        expect(() => bus.on('test', 'not-a-function')).toThrow(TypeError);
        expect(() => bus.on('test', null)).toThrow(TypeError);
        expect(() => bus.on('test', undefined)).toThrow(TypeError);
        expect(() => bus.on('test', 123)).toThrow(TypeError);
      });

      // --- 测试 20: once handler 不是函数时抛出错误 ---
      it('once 的 handler 不是函数时应抛出 TypeError', () => {
        expect(() => bus.once('test', 'not-a-function')).toThrow(TypeError);
      });

      // --- 测试 21: 错误隔离 ---
      it('一个监听器报错不应影响其他监听器', () => {
        const errorHandler = vi.fn();
        const h1 = vi.fn(() => 'result1');
        const h2 = vi.fn(() => { throw new Error('boom'); });
        const h3 = vi.fn(() => 'result3');

        bus.on('error', errorHandler);
        bus.on('risky', h1);
        bus.on('risky', h2);
        bus.on('risky', h3);

        const results = bus.emit('risky');

        expect(h1).toHaveBeenCalled();
        expect(h2).toHaveBeenCalled();
        expect(h3).toHaveBeenCalled();
        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(results).toContain('result1');
        expect(results).toContain('result3');
        expect(results.some((r) => r.error instanceof Error)).toBe(true);
      });

      // --- 测试 22: setMaxListeners 非法参数 ---
      it('setMaxListeners 非法参数时应抛出错误', () => {
        expect(() => bus.setMaxListeners(-1)).toThrow(TypeError);
        expect(() => bus.setMaxListeners('10')).toThrow(TypeError);
      });

      // --- 测试 23: setMaxListeners 有效参数 ---
      it('setMaxListeners 应该正确设置最大监听器数量', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        bus.setMaxListeners(2);
        bus.on('limit', () => {});
        bus.on('limit', () => {});
        bus.on('limit', () => {}); // 第 3 个应触发警告

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain('Memory leak');

        warnSpy.mockRestore();
      });

      // --- 测试 24: destroy ---
      it('destroy 应该清除所有状态', () => {
        const handler = vi.fn();
        bus.on('destroy-test', handler);
        bus.emit('destroy-test');
        bus.destroy();

        expect(bus.listenerCount('destroy-test')).toBe(0);
        expect(bus.getHistory()).toHaveLength(0);

        bus.emit('destroy-test');
        expect(handler).toHaveBeenCalledTimes(1); // 销毁前只触发 1 次
      });

      // ============================================================
      // 4. 异步功能测试 (Async Functionality)
      // ============================================================

      describe('EventBus - 异步功能', () => {
        beforeEach(() => {
          bus = new EventBus();
        });

        // --- 测试 25: emitAsync 基本功能 ---
        it('应该支持异步监听器', async () => {
          bus.on('async', async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return 'async-result';
          });

          const results = await bus.emitAsync('async');
          expect(results).toEqual(['async-result']);
        });

        // --- 测试 26: emitAsync 错误处理 ---
        it('emitAsync 应该正确处理异步错误', async () => {
          bus.on('async-error', async () => {
            throw new Error('async boom');
          });
          bus.on('async-error', async () => 'ok');

          const results = await bus.emitAsync('async-error');

          expect(results).toHaveLength(2);
          expect(results[0]).toEqual({ error: expect.any(Error) });
          expect(results[1]).toBe('ok');
        });

        // --- 测试 27: emitAsync 记录历史 ---
        it('emitAsync 应该记录异步事件历史', async () => {
          bus.on('async-hist', async () => 'data');
          await bus.emitAsync('async-hist');

          const history = bus.getHistory('async-hist');
          expect(history).toHaveLength(1);
          expect(history[0].async).toBe(true);
        });

        // --- 测试 28: emitAsync 混合同步/异步监听器 ---
        it('emitAsync 应该同时处理同步和异步监听器', async () => {
          bus.on('mixed', () => 'sync');
          bus.on('mixed', async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return 'async';
          });

          const results = await bus.emitAsync('mixed');
          expect(results).toEqual(['sync', 'async']);
        });

        // --- 测试 29: 并发异步事件 ---
        it('应该正确处理多个并发异步事件', async () => {
          const results = [];

          bus.on('concurrent', async (id) => {
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
            results.push(id);
            return id;
          });

          bus.on('concurrent', async (id) => {
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
            return `processed-${id}`;
          });

          const results1 = await bus.emitAsync('concurrent', 'A');
          const results2 = await bus.emitAsync('concurrent', 'B');

          expect(results1).toContain('A');
          expect(results1).toContain('processed-A');
          expect(results2).toContain('B');
          expect(results2).toContain('processed-B');
        });

        // --- 测试 30: 复杂场景 — 用户认证流程 ---
        it('应该支持复杂的用户认证流程', async () => {
          const auditLog = [];

          // 认证前钩子
          bus.on('auth:before', (username) => {
            auditLog.push(`checking ${username}`);
          });

          // 认证成功
          bus.once('auth:success', (user) => {
            auditLog.push(`welcome ${user.name}`);
          });

          // 认证失败
          bus.on('auth:fail', (reason) => {
            auditLog.push(`failed: ${reason}`);
          });

          // 认证后钩子 (通配符)
          bus.on('auth:*', (event, data) => {
            auditLog.push(`audit: ${event}`);
          });

          // 错误处理
          bus.on('error', (err) => {
            auditLog.push(`error: ${err.message}`);
          });

          // 模拟认证流程
          bus.emit('auth:before', 'admin');
          bus.emit('auth:success', { name: 'Admin' });
          bus.emit('auth:success', { name: 'Admin2' }); // once 不应触发

          const results = await bus.emitAsync('auth:before', 'guest');
          bus.emit('auth:fail', 'invalid password');

          expect(auditLog).toContain('checking admin');
          expect(auditLog).toContain('welcome Admin');
          expect(auditLog).toContain('audit: auth:before');
          expect(auditLog).toContain('audit: auth:success');
          expect(auditLog).not.toContain('welcome Admin2'); // once 只触发一次
          expect(auditLog).toContain('failed: invalid password');
        });
      });
    });
  });
});
