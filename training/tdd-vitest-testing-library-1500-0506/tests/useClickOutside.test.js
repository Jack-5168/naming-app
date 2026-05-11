/**
 * useClickOutside 测试套件
 * TDD 实战 — 红绿黄循环
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useClickOutside, useClickOutsideRef } from '../src/useClickOutside.js';

describe('useClickOutside', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('useClickOutsideRef', () => {
    it('点击外部应触发回调', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useClickOutsideRef(callback));
      const ref = result.current;

      // 挂载 ref 到 DOM
      const div = document.createElement('div');
      div.setAttribute('data-testid', 'inside');
      document.body.appendChild(div);
      ref.current = div;

      // 点击外部
      act(() => {
        const outsideDiv = document.createElement('div');
        document.body.appendChild(outsideDiv);
        outsideDiv.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('点击内部不应触发回调', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useClickOutsideRef(callback));
      const ref = result.current;

      const div = document.createElement('div');
      document.body.appendChild(div);
      ref.current = div;

      act(() => {
        div.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('点击子元素（在 ref 内部）不应触发回调', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useClickOutsideRef(callback));
      const ref = result.current;

      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);
      document.body.appendChild(parent);
      ref.current = parent;

      act(() => {
        child.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('应支持自定义事件类型', () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useClickOutsideRef(callback, { event: 'click' })
      );
      const ref = result.current;

      const div = document.createElement('div');
      document.body.appendChild(div);
      ref.current = div;

      act(() => {
        const outside = document.createElement('div');
        document.body.appendChild(outside);
        outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('excludeRef 中的元素被点击不应触发回调', () => {
      const callback = vi.fn();
      const excludeRef = { current: null };

      const { result } = renderHook(() =>
        useClickOutsideRef(callback, { excludeRef })
      );
      const ref = result.current;

      const inside = document.createElement('div');
      const excluded = document.createElement('div');
      document.body.appendChild(inside);
      document.body.appendChild(excluded);
      ref.current = inside;
      excludeRef.current = excluded;

      act(() => {
        excluded.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('ref 为 null 时点击不应报错', () => {
      const callback = vi.fn();
      renderHook(() => useClickOutsideRef(callback));

      act(() => {
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('useClickOutside（多 ref 版本）', () => {
    it('registerRef 返回的 ref 被点击不应触发回调', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useClickOutside(callback));
      const registerRef = result.current;

      const div = document.createElement('div');
      document.body.appendChild(div);

      // 注册 ref
      const refObj = { current: div };
      registerRef(refObj);

      act(() => {
        div.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('点击外部应触发回调', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useClickOutside(callback));

      act(() => {
        const outside = document.createElement('div');
        document.body.appendChild(outside);
        outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('exclude 选项应排除指定元素', () => {
      const callback = vi.fn();
      const excludeRef = { current: null };

      const { result } = renderHook(() =>
        useClickOutside(callback, { exclude: [excludeRef] })
      );
      const registerRef = result.current;

      const inside = document.createElement('div');
      const excluded = document.createElement('div');
      document.body.appendChild(inside);
      document.body.appendChild(excluded);

      registerRef({ current: inside });
      excludeRef.current = excluded;

      act(() => {
        excluded.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('应支持自定义事件类型', () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useClickOutside(callback, { event: 'mouseup' })
      );

      act(() => {
        const outside = document.createElement('div');
        document.body.appendChild(outside);
        outside.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
