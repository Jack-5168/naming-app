/**
 * 深度克隆工具
 * 支持：Object, Array, Date, RegExp, Map, Set, null, undefined, 基本类型
 * 不支持：Function, Symbol, 循环引用（简化版）
 */
export function deepClone(value) {
  // 基本类型 + null + undefined
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Date
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  // RegExp
  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags);
  }

  // Map
  if (value instanceof Map) {
    const result = new Map(
      [...value].map(([key, val]) => [key, deepClone(val)]),
    );
    return result;
  }

  // Set
  if (value instanceof Set) {
    const result = new Set(
      [...value].map((val) => deepClone(val)),
    );
    return result;
  }

  // Array
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item));
  }

  // Plain Object
  const result = {};
  Object.keys(value).forEach((key) => {
    result[key] = deepClone(value[key]);
  });
  return result;
}
