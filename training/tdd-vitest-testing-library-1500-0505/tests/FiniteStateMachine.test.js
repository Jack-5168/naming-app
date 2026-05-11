/**
 * FiniteStateMachine 测试
 */
import { describe, it, expect, vi } from 'vitest';
import { FiniteStateMachine, MemoryStateMachine } from '../src/FiniteStateMachine.js';

describe('FiniteStateMachine', () => {
  // ── 基础转换 ──

  describe('基础状态转换', () => {
    const machine = new FiniteStateMachine({
      initial: 'idle',
      states: {
        idle: {},
        running: {},
        stopped: {},
      },
      transitions: {
        start: { idle: { target: 'running' } },
        stop: { running: { target: 'stopped' }, stopped: { target: 'idle' } },
        reset: { stopped: { target: 'idle' } },
      },
    });

    it('初始状态正确', () => {
      expect(machine.getState()).toBe('idle');
      expect(machine.isIn('idle')).toBe(true);
    });

    it('start 转换 idle → running', () => {
      const result = machine.send('start');
      expect(result).toEqual({ from: 'idle', to: 'running', changed: true });
      expect(machine.getState()).toBe('running');
    });

    it('stop 转换 running → stopped', () => {
      const result = machine.send('stop');
      expect(result.changed).toBe(true);
      expect(machine.getState()).toBe('stopped');
    });

    it('无效转换应返回 changed=false', () => {
      const result = machine.send('start'); // stopped 不能 start
      expect(result.changed).toBe(false);
      expect(machine.getState()).toBe('stopped');
    });

    it('未知转换应抛出错误', () => {
      expect(() => machine.send('explode')).toThrow('Unknown transition: explode');
    });

    it('getAvailableTransitions 返回当前可用的转换', () => {
      machine.reset();
      expect(machine.getAvailableTransitions()).toContain('start');
      expect(machine.getAvailableTransitions()).not.toContain('stop');
    });

    it('getHistory 记录状态变化', () => {
      machine.reset();
      machine.send('start');
      machine.send('stop');
      expect(machine.getHistory()).toEqual(['idle', 'running', 'stopped']);
    });

    it('reset 回到初始状态', () => {
      machine.reset();
      expect(machine.getState()).toBe('idle');
      expect(machine.getHistory()).toEqual(['idle']);
    });
  });

  // ── 守卫条件 ──

  describe('守卫条件 (guard)', () => {
    const machine = new FiniteStateMachine({
      initial: 'locked',
      states: { locked: {}, unlocked: {} },
      transitions: {
        unlock: {
          locked: {
            target: 'unlocked',
            guard: (ctx) => ctx.hasKey,
          },
        },
        lock: { unlocked: { target: 'locked' } },
      },
    });

    it('守卫通过时执行转换', () => {
      const result = machine.send('unlock', { hasKey: true });
      expect(result.changed).toBe(true);
      expect(machine.getState()).toBe('unlocked');
    });

    it('守卫失败时不转换', () => {
      machine.reset();
      const result = machine.send('unlock', { hasKey: false });
      expect(result.changed).toBe(false);
      expect(result.guardFailed).toBe(true);
      expect(machine.getState()).toBe('locked');
    });
  });

  // ── 进入/退出动作 ──

  describe('进入/退出动作 (onEnter/onExit)', () => {
    const onEnter = vi.fn();
    const onExit = vi.fn();

    const machine = new FiniteStateMachine({
      initial: 'A',
      states: {
        A: { onExit },
        B: { onEnter },
      },
      transitions: {
        go: { A: { target: 'B' } },
      },
    });

    it('转换时触发 onExit 和 onEnter', () => {
      machine.send('go');
      expect(onExit).toHaveBeenCalledOnce();
      expect(onEnter).toHaveBeenCalledOnce();
    });

    it('动作接收 context 参数', () => {
      const action = vi.fn();
      const m = new FiniteStateMachine({
        initial: 'A',
        states: { A: {}, B: { onEnter: action } },
        transitions: { go: { A: { target: 'B' } } },
      });
      m.send('go', { msg: 'hello' });
      expect(action).toHaveBeenCalledWith({ msg: 'hello' });
    });
  });

  // ── 转换动作 ──

  describe('转换动作 (transition actions)', () => {
    it('转换时可以执行内联动作', () => {
      const action = vi.fn();
      const m = new FiniteStateMachine({
        initial: 'A',
        states: { A: {}, B: {} },
        transitions: {
          go: { A: { target: 'B', actions: [action] } },
        },
      });
      m.send('go', { x: 1 });
      expect(action).toHaveBeenCalledWith({ x: 1 });
    });

    it('转换动作支持字符串引用', () => {
      const action = vi.fn();
      const m = new FiniteStateMachine({
        initial: 'A',
        states: { A: {}, B: {} },
        transitions: {
          go: { A: { target: 'B', actions: ['log'] } },
        },
        actions: { log: action },
      });
      m.send('go');
      expect(action).toHaveBeenCalled();
    });
  });

  // ── 动态目标状态 ──

  describe('动态目标状态', () => {
    it('target 可以是函数', () => {
      const m = new FiniteStateMachine({
        initial: 'pending',
        states: { pending: { ok: {}, fail: {} } },
        transitions: {
          resolve: {
            pending: {
              target: (ctx) => (ctx.success ? 'ok' : 'fail'),
            },
          },
        },
      });
      m.send('resolve', { success: true });
      expect(m.getState()).toBe('ok');
    });
  });

  // ── can() 检查 ──

  describe('can()', () => {
    const m = new FiniteStateMachine({
      initial: 'off',
      states: { off: {}, on: {} },
      transitions: {
        toggle: { off: { target: 'on' }, on: { target: 'off' } },
      },
    });

    it('can 检查是否可以执行转换', () => {
      expect(m.can('toggle')).toBe(true);
      expect(m.can('nonexistent')).toBe(false);
    });
  });

  // ── MemoryStateMachine ──

  describe('MemoryStateMachine', () => {
    const m = new MemoryStateMachine({
      initial: 'A',
      states: { A: {}, B: {}, C: {} },
      transitions: {
        next: { A: { target: 'B' }, B: { target: 'C' } },
      },
    });

    it('记住上一个状态', () => {
      m.send('next'); // A → B
      expect(m.getPreviousState()).toBe('A');
      m.send('next'); // B → C
      expect(m.getPreviousState()).toBe('B');
    });

    it('goBack 回退到上一个状态', () => {
      m.reset();
      m.send('next'); // A → B
      m.send('next'); // B → C
      const result = m.goBack();
      expect(result.changed).toBe(true);
      expect(m.getState()).toBe('B');
    });

    it('无上一个状态时 goBack 不变化', () => {
      const m2 = new MemoryStateMachine({
        initial: 'X',
        states: { X: {} },
        transitions: {},
      });
      const result = m2.goBack();
      expect(result.changed).toBe(false);
    });
  });
});
