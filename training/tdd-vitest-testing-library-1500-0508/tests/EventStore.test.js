/**
 * EventStore 测试套件
 * TDD 实战 v7 — 红绿黄循环
 * 覆盖：dispatch、batch、snapshot、restore、filter、diff、reset
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventStore, createEventStore } from '../src/EventStore.js';

describe('EventStore', () => {
  let store;

  beforeEach(() => {
    store = new EventStore({ count: 0, name: 'init' });
  });

  // ─── dispatch ───

  describe('dispatch', () => {
    it('应追加事件并更新状态', () => {
      const event = store.dispatch('increment', 1, (state, payload) => ({
        ...state,
        count: state.count + payload,
      }));
      expect(event.type).toBe('increment');
      expect(event.payload).toBe(1);
      expect(store.getState().count).toBe(1);
    });

    it('reducer 不是函数应抛 TypeError', () => {
      expect(() => store.dispatch('a', null, 'not-fn')).toThrow(TypeError);
    });

    it('version 应递增', () => {
      store.dispatch('a', 1, (s) => ({ ...s, v: 1 }));
      store.dispatch('b', 2, (s) => ({ ...s, v: 2 }));
      expect(store.version).toBe(2);
    });

    it('事件应有自增 id', () => {
      const e1 = store.dispatch('a', 1, (s) => s);
      const e2 = store.dispatch('b', 2, (s) => s);
      expect(e1.id).toBe(0);
      expect(e2.id).toBe(1);
    });

    it('事件应有 timestamp', () => {
      const event = store.dispatch('a', 1, (s) => s);
      expect(event.timestamp).toBeDefined();
      expect(typeof event.timestamp).toBe('number');
    });
  });

  // ─── batch ───

  describe('batch', () => {
    it('应批量追加事件', () => {
      const results = store.batch([
        { type: 'a', payload: 1, reducer: (s) => ({ ...s, count: s.count + 1 }) },
        { type: 'b', payload: 2, reducer: (s) => ({ ...s, count: s.count + 2 }) },
      ]);
      expect(results).toHaveLength(2);
      expect(store.getState().count).toBe(3);
      expect(store.version).toBe(2);
    });
  });

  // ─── snapshot ───

  describe('snapshot', () => {
    it('createSnapshot 应保存当前状态', () => {
      store.dispatch('increment', 5, (s) => ({ ...s, count: s.count + 5 }));
      const snap = store.createSnapshot('mid');
      expect(snap.name).toBe('mid');
      expect(snap.version).toBe(1);
      expect(snap.state.count).toBe(5);
    });

    it('不传 name 应自动生成', () => {
      const snap = store.createSnapshot();
      expect(snap.name).toMatch(/snapshot-\d+/);
    });

    it('getSnapshots 应返回快照列表', () => {
      store.createSnapshot('a');
      store.createSnapshot('b');
      expect(store.getSnapshots()).toHaveLength(2);
    });
  });

  // ─── restoreSnapshot ───

  describe('restoreSnapshot', () => {
    it('应恢复到快照状态', () => {
      store.dispatch('increment', 5, (s) => ({ ...s, count: s.count + 5 }));
      store.createSnapshot('saved');
      store.dispatch('increment', 10, (s) => ({ ...s, count: s.count + 10 }));
      expect(store.getState().count).toBe(15);

      store.restoreSnapshot('saved');
      expect(store.getState().count).toBe(5);
    });

    it('快照不存在应抛 Error', () => {
      expect(() => store.restoreSnapshot('missing')).toThrow('not found');
    });

    it('恢复后 version 应回退', () => {
      store.dispatch('a', 1, (s) => s);
      store.createSnapshot('v1');
      store.dispatch('b', 2, (s) => s);
      expect(store.version).toBe(2);
      store.restoreSnapshot('v1');
      expect(store.version).toBe(1);
    });
  });

  // ─── filter ───

  describe('filter', () => {
    it('filter 应按条件筛选事件', () => {
      store.dispatch('a', 1, (s) => s);
      store.dispatch('b', 2, (s) => s);
      store.dispatch('a', 3, (s) => s);
      const result = store.filter((e) => e.type === 'a');
      expect(result).toHaveLength(2);
      expect(result.every((e) => e.type === 'a')).toBe(true);
    });

    it('findByType 应按类型查找', () => {
      store.dispatch('click', { x: 1 }, (s) => s);
      store.dispatch('click', { x: 2 }, (s) => s);
      store.dispatch('scroll', {}, (s) => s);
      expect(store.findByType('click')).toHaveLength(2);
      expect(store.findByType('scroll')).toHaveLength(1);
    });
  });

  // ─── slice ───

  describe('slice', () => {
    it('应返回事件子集', () => {
      store.dispatch('a', 1, (s) => s);
      store.dispatch('b', 2, (s) => s);
      store.dispatch('c', 3, (s) => s);
      expect(store.slice(1, 3)).toHaveLength(2);
      expect(store.slice(0, 1)).toHaveLength(1);
    });
  });

  // ─── diffBetween ───

  describe('diffBetween', () => {
    it('应返回两个版本之间的事件', () => {
      store.dispatch('a', 1, (s) => s); // v1
      store.dispatch('b', 2, (s) => s); // v2
      store.dispatch('c', 3, (s) => s); // v3
      const diff = store.diffBetween(1, 3);
      expect(diff).toHaveLength(2);
      expect(diff[0].type).toBe('b');
      expect(diff[1].type).toBe('c');
    });
  });

  // ─── reset ───

  describe('reset', () => {
    it('应清空所有状态', () => {
      store.dispatch('a', 1, (s) => ({ ...s, count: 99 }));
      store.createSnapshot('snap');
      store.reset();
      expect(store.getEvents()).toHaveLength(0);
      expect(store.getSnapshots()).toHaveLength(0);
      expect(store.version).toBe(0);
      expect(store.getState().count).toBe(0);
    });
  });

  // ─── getEvents ───

  describe('getEvents', () => {
    it('应返回所有事件副本', () => {
      store.dispatch('a', 1, (s) => s);
      const events = store.getEvents();
      expect(events).toHaveLength(1);
      // 修改返回数组不应影响内部
      events.push({ fake: true });
      expect(store.getEvents()).toHaveLength(1);
    });
  });

  // ─── getState ───

  describe('getState', () => {
    it('应返回状态副本', () => {
      store.dispatch('a', 1, (s) => ({ ...s, count: 42 }));
      const state = store.getState();
      state.count = 999;
      expect(store.getState().count).toBe(42);
    });
  });

  // ─── travelTo ───

  describe('travelTo', () => {
    it('应恢复到指定版本的状态（从快照重放）', () => {
      store.dispatch('a', 1, (s) => ({ ...s, count: s.count + 1 })); // v1
      store.createSnapshot('snap');
      store.dispatch('b', 2, (s) => ({ ...s, count: s.count + 2 })); // v2
      store.dispatch('c', 3, (s) => ({ ...s, count: s.count + 3 })); // v3
      // travelTo(1) 从快照恢复，count=1
      const state = store.travelTo(1);
      expect(state.count).toBe(1);
    });

    it('无效版本应抛 Error', () => {
      store.dispatch('a', 1, (s) => s);
      expect(() => store.travelTo(-1)).toThrow('Invalid version');
      expect(() => store.travelTo(99)).toThrow('Invalid version');
    });

    it('恢复到版本 0 应返回初始状态', () => {
      store.dispatch('a', 1, (s) => ({ ...s, count: 99 }));
      const state = store.travelTo(0);
      expect(state.count).toBe(0);
    });

    it('有快照时应从快照开始重放', () => {
      store.dispatch('a', 1, (s) => ({ ...s, count: s.count + 1 })); // v1
      store.createSnapshot('snap');
      store.dispatch('b', 2, (s) => ({ ...s, count: s.count + 2 })); // v2
      const state = store.travelTo(1);
      expect(state.count).toBe(1);
    });
  });

  // ─── _getStateAtVersion ───

  describe('_getStateAtVersion', () => {
    it('无快照时返回初始状态', () => {
      store.dispatch('a', 1, (s) => ({ ...s, count: s.count + 1 }));
      const state = store._getStateAtVersion(0);
      expect(state.count).toBe(0);
    });

    it('有快照时应返回快照状态', () => {
      store.dispatch('a', 1, (s) => ({ ...s, count: s.count + 5 }));
      store.createSnapshot('snap');
      const state = store._getStateAtVersion(1);
      expect(state.count).toBe(5);
    });
  });

  // ─── 便捷工厂 ───

  describe('createEventStore', () => {
    it('应返回 EventStore 实例', () => {
      const s = createEventStore({ x: 1 });
      expect(s).toBeInstanceOf(EventStore);
      expect(s.getState().x).toBe(1);
    });
  });
});
