// src/retry.js
/**
 * 重试机制
 * 支持固定间隔、指数退避、最大重试次数
 */
export async function retry(fn, options = {}) {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 'none', // 'none' | 'fixed' | 'exponential'
    onRetry,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        const waitTime = calculateDelay(attempt, delay, backoff);

        if (onRetry) {
          onRetry(error, attempt, maxAttempts);
        }

        await sleep(waitTime);
      }
    }
  }

  throw lastError;
}

function calculateDelay(attempt, baseDelay, strategy) {
  switch (strategy) {
    case 'exponential':
      return baseDelay * 2 ** (attempt - 1);
    case 'fixed':
      return baseDelay;
    case 'none':
    default:
      return baseDelay;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
