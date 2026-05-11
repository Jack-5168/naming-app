// src/lru-cache.js
/**
 * LRU Cache (Least Recently Used)
 * 达到容量时淘汰最久未使用的项
 */
export class LRUCache {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('Capacity must be a positive integer');
    }
    this._capacity = capacity;
    this._cache = new Map();
  }

  /**
   * 获取值
   * 存在则移到末尾（最近使用），不存在返回 -1
   */
  get(key) {
    if (!this._cache.has(key)) {
      return -1;
    }

    const value = this._cache.get(key);
    // 移到末尾（最近使用）
    this._cache.delete(key);
    this._cache.set(key, value);
    return value;
  }

  /**
   * 设置值
   * 存在则更新并移到末尾，不存在则插入
   * 超出容量时淘汰最久未使用的（队首）
   */
  put(key, value) {
    if (this._cache.has(key)) {
      this._cache.delete(key);
    }

    this._cache.set(key, value);

    if (this._cache.size > this._capacity) {
      // Map 保持插入顺序，第一个是最久未使用的
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
  }

  /**
   * 检查是否存在
   */
  has(key) {
    return this._cache.has(key);
  }

  /**
   * 删除指定项
   */
  remove(key) {
    return this._cache.delete(key);
  }

  /**
   * 获取大小
   */
  size() {
    return this._cache.size;
  }

  /**
   * 获取容量
   */
  capacity() {
    return this._capacity;
  }

  /**
   * 是否为空
   */
  isEmpty() {
    return this._cache.size === 0;
  }

  /**
   * 清空缓存
   */
  clear() {
    this._cache.clear();
  }

  /**
   * 获取所有键（按最近使用顺序）
   */
  keys() {
    return Array.from(this._cache.keys());
  }

  /**
   * 获取所有值（按最近使用顺序）
   */
  values() {
    return Array.from(this._cache.values());
  }

  /**
   * 获取所有条目
   */
  entries() {
    return Array.from(this._cache.entries());
  }
}
