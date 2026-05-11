/**
 * Memoize - 函数记忆化（缓存）工具
 * TDD 实战模块 2/3
 * 支持：自定义 key 生成、TTL 过期、LRU 淘汰、缓存统计、批量清除
 */

export function memoize(fn, options = {}) {
  if (typeof fn !== 'function') {
    throw new TypeError('fn must be a function');
  }

  const {
    maxAge = 0,           // TTL 毫秒，0 表示永不过期
    maxSize = Infinity,   // 最大缓存条目数
    keyResolver = null,   // 自定义 key 生成函数
    onEvict = null,       // 淘汰回调
  } = options;

  const cache = new Map();
  let stats = { hits: 0, misses: 0, calls: 0 };

  /**
   * 生成缓存 key
   */
  function generateKey(args) {
    if (keyResolver) return keyResolver(...args);
    return JSON.stringify(args);
  }

  /**
   * 检查条目是否过期
   */
  function isExpired(entry) {
    return maxAge > 0 && Date.now() - entry.createdAt > maxAge;
  }

  /**
   * 淘汰最旧的条目
   */
  function evictOldest() {
    if (cache.size <= maxSize) return;
    const oldestKey = cache.keys().next().value;
    const entry = cache.get(oldestKey);
    cache.delete(oldestKey);
    if (onEvict) onEvict(oldestKey, entry?.value);
  }

  /**
   * 记忆化后的函数
   */
  function memoized(...args) {
    stats.calls++;
    const key = generateKey(args);

    // 检查缓存
    if (cache.has(key)) {
      const entry = cache.get(key);

      if (isExpired(entry)) {
        cache.delete(key);
        stats.misses++;
      } else {
        // 移到最新（LRU）
        cache.delete(key);
        cache.set(key, entry);
        stats.hits++;
        return entry.value;
      }
    } else {
      stats.misses++;
    }

    // 执行原函数
    const value = fn(...args);

    // 写入缓存
    cache.set(key, { value, createdAt: Date.now() });

    // 淘汰
    if (maxSize !== Infinity) {
      evictOldest();
    }

    return value;
  }

  /**
   * 清除指定 key 的缓存
   * @param {*} key
   */
  memoized.delete = function (key) {
    return cache.delete(key);
  };

  /**
   * 清除所有缓存
   */
  memoized.clear = function () {
    cache.clear();
    stats = { hits: 0, misses: 0, calls: 0 };
  };

  /**
   * 获取缓存大小
   * @returns {number}
   */
  memoized.size = function () {
    return cache.size;
  };

  /**
   * 获取统计信息
   * @returns {Object}
   */
  memoized.stats = function () {
    return { ...stats, cacheSize: cache.size };
  };

  /**
   * 检查 key 是否在缓存中
   * @param {*} key
   * @returns {boolean}
   */
  memoized.has = function (key) {
    if (!cache.has(key)) return false;
    const entry = cache.get(key);
    if (isExpired(entry)) {
      cache.delete(key);
      return false;
    }
    return true;
  };

  return memoized;
}

/**
 * 浅比较两个值
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function shallowEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }

  return true;
}

/**
 * 创建带浅比较参数的记忆化函数
 * @param {Function} fn
 * @param {Object} options
 * @returns {Function}
 */
export function memoizeShallow(fn, options = {}) {
  return memoize(fn, {
    ...options,
    keyResolver: (...args) => {
      // 对每个参数做浅比较 key
      return args.map((arg) => {
        if (arg == null) return String(arg);
        if (typeof arg === 'object') return JSON.stringify(arg);
        return String(arg);
      }).join('|');
    },
  });
}
