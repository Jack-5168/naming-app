/**
 * LRUCache - LRU 缓存实现（带 TTL 支持）
 * TDD 实战模块 2/3
 * 支持：get/put/delete/clear、TTL 过期、容量限制、命中率统计
 */

class CacheNode {
  constructor(key, value, ttl = 0) {
    this.key = key;
    this.value = value;
    this.ttl = ttl;
    this.expiresAt = ttl > 0 ? Date.now() + ttl : 0;
    this.prev = null;
    this.next = null;
  }

  isExpired() {
    return this.expiresAt > 0 && Date.now() > this.expiresAt;
  }
}

export class LRUCache {
  constructor(capacity = 10) {
    if (capacity <= 0) {
      throw new Error('Capacity must be greater than 0');
    }
    this.capacity = capacity;
    this.size = 0;
    this.cache = new Map();
    this.head = new CacheNode(null, null); // dummy head
    this.tail = new CacheNode(null, null); // dummy tail
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 将节点移到链表头部（最新使用）
   * @private
   */
  _moveToHead(node) {
    this._removeNode(node);
    this._addToHead(node);
  }

  /**
   * 从链表中移除节点
   * @private
   */
  _removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  /**
   * 将节点添加到链表头部
   * @private
   */
  _addToHead(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  /**
   * 移除链表尾部节点（最久未使用）
   * @private
   */
  _removeTail() {
    const node = this.tail.prev;
    this._removeNode(node);
    return node;
  }

  /**
   * 获取缓存值
   * @param {string|number} key
   * @returns {*} 缓存的值，不存在或已过期返回 undefined
   */
  get(key) {
    const node = this.cache.get(key);
    if (!node) {
      this.misses++;
      return undefined;
    }

    // 检查是否过期
    if (node.isExpired()) {
      this.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    this._moveToHead(node);
    return node.value;
  }

  /**
   * 设置缓存值
   * @param {string|number} key
   * @param {*} value
   * @param {number} [ttl] - 过期时间（毫秒），0 表示永不过期
   */
  put(key, value, ttl = 0) {
    const node = this.cache.get(key);

    if (node) {
      // 更新已有节点
      node.value = value;
      node.ttl = ttl;
      node.expiresAt = ttl > 0 ? Date.now() + ttl : 0;
      this._moveToHead(node);
    } else {
      // 创建新节点
      const newNode = new CacheNode(key, value, ttl);
      this.cache.set(key, newNode);
      this._addToHead(newNode);
      this.size++;

      // 超出容量，移除最久未使用的
      if (this.size > this.capacity) {
        const tail = this._removeTail();
        this.cache.delete(tail.key);
        this.size--;
      }
    }
  }

  /**
   * 删除缓存项
   * @param {string|number} key
   * @returns {boolean} 是否成功删除
   */
  delete(key) {
    const node = this.cache.get(key);
    if (!node) return false;

    this._removeNode(node);
    this.cache.delete(key);
    this.size--;
    return true;
  }

  /**
   * 检查键是否存在（不更新访问顺序）
   * @param {string|number} key
   * @returns {boolean}
   */
  has(key) {
    const node = this.cache.get(key);
    if (!node) return false;
    if (node.isExpired()) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
    this.size = 0;
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 获取缓存统计信息
   * @returns {Object}
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.size,
      capacity: this.capacity,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * 获取所有键（按使用顺序从新到旧）
   * @returns {Array}
   */
  keys() {
    const result = [];
    let node = this.head.next;
    while (node !== this.tail) {
      result.push(node.key);
      node = node.next;
    }
    return result;
  }

  /**
   * 获取所有值（按使用顺序从新到旧）
   * @returns {Array}
   */
  values() {
    const result = [];
    let node = this.head.next;
    while (node !== this.tail) {
      result.push(node.value);
      node = node.next;
    }
    return result;
  }

  /**
   * 获取所有键值对（按使用顺序从新到旧）
   * @returns {Array<[string|number, *]>}
   */
  entries() {
    const result = [];
    let node = this.head.next;
    while (node !== this.tail) {
      result.push([node.key, node.value]);
      node = node.next;
    }
    return result;
  }

  /**
   * 支持 for...of 迭代
   */
  * [Symbol.iterator]() {
    let node = this.head.next;
    while (node !== this.tail) {
      yield [node.key, node.value];
      node = node.next;
    }
  }
}
