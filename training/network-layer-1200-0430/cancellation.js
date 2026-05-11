/**
 * 请求取消管理器
 *
 * 功能：
 * - 按组件/页面分组管理请求
 * - 组件卸载时自动取消
 * - 支持单个/批量取消
 */

import axios from 'axios';

// ============ 请求取消管理器 ============

class RequestManager {
  constructor() {
    // Map<groupId, Map<requestKey, CancelTokenSource>>
    this.groups = new Map();
  }

  /**
   * 获取或创建请求组
   */
  getGroup(groupId) {
    if (!this.groups.has(groupId)) {
      this.groups.set(groupId, new Map());
    }
    return this.groups.get(groupId);
  }

  /**
   * 注册请求（在发送前调用）
   */
  register(groupId, requestKey, source) {
    const group = this.getGroup(groupId);
    group.set(requestKey, source);
  }

  /**
   * 移除已完成的请求
   */
  remove(groupId, requestKey) {
    const group = this.groups.get(groupId);
    if (group) {
      group.delete(requestKey);
      // 组为空时清理
      if (group.size === 0) {
        this.groups.delete(groupId);
      }
    }
  }

  /**
   * 取消指定组的所有请求
   */
  cancelGroup(groupId) {
    const group = this.groups.get(groupId);
    if (group) {
      group.forEach((source, key) => {
        source.cancel(`Group "${groupId}" cancelled: ${key}`);
      });
      this.groups.delete(groupId);
      console.log(`[RequestManager] Cancelled group: ${groupId}`);
    }
  }

  /**
   * 取消所有请求
   */
  cancelAll() {
    const groupIds = [...this.groups.keys()];
    groupIds.forEach((id) => this.cancelGroup(id));
    console.log('[RequestManager] Cancelled all groups');
  }

  /**
   * 创建带组管理的 CancelToken
   */
  createToken(groupId, requestKey) {
    const source = axios.CancelToken.source();
    this.register(groupId, requestKey, source);
    return source.token;
  }

  /**
   * 获取指定组的活动请求数
   */
  getActiveCount(groupId) {
    const group = this.groups.get(groupId);
    return group ? group.size : 0;
  }

  /**
   * 获取所有活动组
   */
  getActiveGroups() {
    return [...this.groups.entries()].map(([id, group]) => ({
      groupId: id,
      count: group.size,
    }));
  }
}

// 全局单例
const requestManager = new RequestManager();

// ============ Vue 3 组合式函数 ============

/*
import { onUnmounted } from 'vue';
import { requestManager } from '@/utils/cancellation';

export function useRequest(groupId) {
  const id = groupId || `component_${Date.now()}`;

  // 组件卸载时自动取消该组所有请求
  onUnmounted(() => {
    requestManager.cancelGroup(id);
  });

  function request(config) {
    const requestKey = `${config.method}:${config.url}`;
    return http({
      ...config,
      cancelToken: requestManager.createToken(id, requestKey),
    }).finally(() => {
      requestManager.remove(id, requestKey);
    });
  }

  return {
    request,
    cancelAll: () => requestManager.cancelGroup(id),
    activeCount: () => requestManager.getActiveCount(id),
  };
}
*/

// ============ React Hook ============

/*
import { useEffect, useRef, useCallback } from 'react';
import { requestManager } from '@/utils/cancellation';

export function useRequest(groupId) {
  const idRef = useRef(groupId || `component_${Date.now()}_${Math.random()}`);
  const id = idRef.current;

  // 清理：组件卸载时取消所有请求
  useEffect(() => {
    return () => {
      requestManager.cancelGroup(id);
    };
  }, [id]);

  const request = useCallback(
    (config) => {
      const requestKey = `${config.method}:${config.url}`;
      return http({
        ...config,
        cancelToken: requestManager.createToken(id, requestKey),
      }).finally(() => {
        requestManager.remove(id, requestKey);
      });
    },
    [id]
  );

  const cancelAll = useCallback(() => {
    requestManager.cancelGroup(id);
  }, [id]);

  return { request, cancelAll };
}
*/

// ============ 导出 ============

export { RequestManager, requestManager };
export default requestManager;
