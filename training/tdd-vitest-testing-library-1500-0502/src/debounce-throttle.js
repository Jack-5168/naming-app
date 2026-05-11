/**
 * Debounce & Throttle 工具函数
 * 支持 leading/trailing、取消、立即执行
 */

/**
 * 防抖函数
 * @param {Function} fn - 要防抖的函数
 * @param {number} delay - 延迟时间 (ms)
 * @param {Object} options
 * @param {boolean} options.leading - 是否在延迟开始时执行
 * @param {boolean} options.trailing - 是否在延迟结束时执行
 * @param {boolean} options.maxWait - 最大等待时间
 * @returns {Function} 防抖后的函数
 */
function debounce(fn, delay = 300, options = {}) {
  if (typeof fn !== 'function') {
    throw new Error('First argument must be a function');
  }

  if (delay < 0) {
    throw new Error('Delay must be non-negative');
  }

  const { leading = false, trailing = true, maxWait } = options;
  let timer = null;
  let maxTimer = null;
  let lastArgs = null;
  let lastThis = null;
  let lastCallTime = 0;
  let result = undefined;

  function execute() {
    fn.apply(lastThis, lastArgs);
  }

  function invoke() {
    lastArgs = lastThis = null;
    result = fn.apply(lastThis, lastArgs);
    return result;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    return (
      lastCallTime === 0 ||
      timeSinceLastCall >= delay ||
      (maxWait !== undefined && timeSinceLastCall >= maxWait)
    );
  }

  function trailingEdge() {
    timer = null;
    if (trailing && lastArgs) {
      lastThis = lastArgs = null;
      fn.apply(lastThis, lastArgs);
    }
    lastArgs = lastThis = null;
    return result;
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      trailingEdge();
    } else {
      timer = setTimeout(timerExpired, Math.min(
        delay - (time - lastCallTime),
        maxWait !== undefined ? maxWait - (time - lastCallTime) : delay
      ));
    }
  }

  function cancel() {
    if (timer) clearTimeout(timer);
    if (maxTimer) clearTimeout(maxTimer);
    timer = maxTimer = null;
    lastCallTime = 0;
    lastArgs = lastThis = null;
  }

  function flush() {
    return timer ? trailingEdge() : result;
  }

  function debounced(...args) {
    const time = Date.now();
    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    const isInvoking = shouldInvoke(time);

    if (isInvoking) {
      if (!timer) {
        if (leading) {
          fn.apply(lastThis, lastArgs);
        }
        timer = setTimeout(timerExpired, delay);
        if (maxWait !== undefined) {
          maxTimer = setTimeout(() => {
            fn.apply(lastThis, lastArgs);
            if (timer) clearTimeout(timer);
            timer = null;
          }, maxWait);
        }
      } else if (maxWait !== undefined) {
        if (maxTimer) clearTimeout(maxTimer);
        maxTimer = setTimeout(() => {
          fn.apply(lastThis, lastArgs);
          if (timer) clearTimeout(timer);
          timer = null;
        }, maxWait - (time - lastCallTime));
      }
    } else if (!timer && trailing) {
      timer = setTimeout(timerExpired, delay - (time - lastCallTime));
    }

    return result;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  return debounced;
}

/**
 * 节流函数
 * @param {Function} fn - 要节流的函数
 * @param {number} interval - 间隔时间 (ms)
 * @param {Object} options
 * @param {boolean} options.leading - 是否在开始时执行
 * @param {boolean} options.trailing - 是否在结束时执行
 * @returns {Function} 节流后的函数
 */
function throttle(fn, interval = 300, options = {}) {
  if (typeof fn !== 'function') {
    throw new Error('First argument must be a function');
  }

  if (interval < 0) {
    throw new Error('Interval must be non-negative');
  }

  const { leading = true, trailing = true } = options;
  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  let lastCallTime = 0;
  let result = undefined;

  function invoke() {
    lastCallTime = Date.now();
    result = fn.apply(lastThis, lastArgs);
    lastArgs = lastThis = null;
    return result;
  }

  function throttled(...args) {
    const now = Date.now();
    const elapsed = now - lastCallTime;

    lastArgs = args;
    lastThis = this;

    if (lastCallTime === 0 && leading) {
      return invoke();
    }

    if (elapsed >= interval) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      return invoke();
    }

    if (trailing && !timer) {
      timer = setTimeout(() => {
        timer = null;
        invoke();
      }, interval - elapsed);
    }

    return result;
  }

  throttled.cancel = function cancel() {
    if (timer) clearTimeout(timer);
    timer = null;
    lastCallTime = 0;
    lastArgs = lastThis = null;
  };

  return throttled;
}

export { debounce, throttle };
