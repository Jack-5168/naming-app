/**
 * QueryString 解析器
 * 支持嵌套对象、数组、类型转换
 */

/**
 * 解析查询字符串
 * @param {string} queryString - 查询字符串 (不含 ?)
 * @param {Object} options
 * @param {boolean} options.parseNumbers - 是否解析数字
 * @param {boolean} options.parseBooleans - 是否解析布尔值
 * @param {boolean} options.parseArrays - 是否解析数组 (key[]=val1&key[]=val2)
 * @param {boolean} options.parseNested - 是否解析嵌套对象 (key[nested]=val)
 * @returns {Object}
 */
function parse(queryString, options = {}) {
  const {
    parseNumbers = true,
    parseBooleans = true,
    parseArrays = true,
    parseNested = true,
  } = options;

  if (!queryString || typeof queryString !== 'string') {
    return {};
  }

  // 移除开头的 ?
  const str = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  if (!str) return {};

  const result = {};
  const pairs = str.split('&');

  for (const pair of pairs) {
    if (!pair) continue;

    const eqIndex = pair.indexOf('=');
    let key = eqIndex === -1 ? pair : pair.slice(0, eqIndex);
    let value = eqIndex === -1 ? '' : pair.slice(eqIndex + 1);

    // URL 解码
    key = decodeURIComponent(key);
    value = decodeURIComponent(value);

    // 解析值类型
    if (parseBooleans) {
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
    }

    if (parseNumbers && typeof value === 'string') {
      if (/^-?\d+(\.\d+)?$/.test(value)) {
        value = Number(value);
      }
    }

    // 处理嵌套对象 key[nested]=value
    if (parseNested && key.includes('[') && key.includes(']')) {
      const parts = key.split(/[\[\]]/).filter(Boolean);
      let current = result;

      for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }

      const lastKey = parts[parts.length - 1];
      // 处理数组索引 key[0]=val
      if (parseArrays && /^\d+$/.test(lastKey)) {
        if (!Array.isArray(current[parts[parts.length - 2]])) {
          current[parts[parts.length - 2]] = [];
        }
        current[parts[parts.length - 2]][parseInt(lastKey, 10)] = value;
      } else {
        current[lastKey] = value;
      }
    }
    // 处理数组 key[]=val
    else if (parseArrays && key.endsWith('[]')) {
      const arrayKey = key.slice(0, -2);
      if (!result[arrayKey]) {
        result[arrayKey] = [];
      }
      result[arrayKey].push(value);
    }
    // 普通键值对
    else {
      // 如果 key 已存在，转换为数组
      if (result[key] !== undefined) {
        if (!Array.isArray(result[key])) {
          result[key] = [result[key]];
        }
        result[key].push(value);
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * 序列化对象为查询字符串
 * @param {Object} obj
 * @param {Object} options
 * @returns {string}
 */
function stringify(obj, options = {}) {
  const { encode = true } = options;

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return '';
  }

  const pairs = [];

  function processValue(key, value) {
    const encodedKey = encode ? encodeURIComponent(key) : key;

    if (value === null || value === undefined) {
      pairs.push(encodedKey);
    } else if (Array.isArray(value)) {
      value.forEach(item => {
        if (encode) {
          pairs.push(`${encodedKey}[]=${encodeURIComponent(String(item))}`);
        } else {
          pairs.push(`${encodedKey}[]=${String(item)}`);
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([subKey, subValue]) => {
        processValue(`${key}[${subKey}]`, subValue);
      });
    } else {
      if (encode) {
        pairs.push(`${encodedKey}=${encodeURIComponent(String(value))}`);
      } else {
        pairs.push(`${encodedKey}=${String(value)}`);
      }
    }
  }

  Object.entries(obj).forEach(([key, value]) => {
    processValue(key, value);
  });

  return pairs.join('&');
}

export { parse, stringify };
