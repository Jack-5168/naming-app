/**
 * useLocalStorage - React 自定义 Hook
 * TDD 实战模块 3/3
 * 支持：读写 localStorage、JSON 序列化、默认值、多实例隔离
 */
import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * 安全地读写 localStorage
 */
function storageGet(key, defaultValue) {
  try {
    const item = window.localStorage.getItem(key);
    if (item === null) {
      return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }
    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  } catch {
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function storageRemove(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * useLocalStorage Hook
 * @param {string} key - localStorage 键名
 * @param {*} defaultValue - 默认值（支持函数）
 * @returns {[*, Function, Function]} [value, setValue, removeValue]
 */
export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => storageGet(key, defaultValue));
  const keyRef = useRef(key);

  // 如果 key 变化，重新读取
  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key;
      setValue(storageGet(key, defaultValue));
    }
  }, [key, defaultValue]);

  const setStoredValue = useCallback((newValue) => {
    setValue((prev) => {
      const valueToStore = typeof newValue === 'function' ? newValue(prev) : newValue;
      storageSet(key, valueToStore);
      return valueToStore;
    });
  }, [key]);

  const removeValue = useCallback(() => {
    storageRemove(key);
    const defaultVal = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    setValue(defaultVal);
  }, [key, defaultValue]);

  return [value, setStoredValue, removeValue];
}

/**
 * 跨标签页同步的 useLocalStorage
 * 监听 storage 事件实现多标签页同步
 */
export function useSyncedLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => storageGet(key, defaultValue));
  const keyRef = useRef(key);

  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    function handleStorageChange(e) {
      if (e.key === keyRef.current && e.newValue !== null) {
        try {
          setValue(JSON.parse(e.newValue));
        } catch {
          setValue(e.newValue);
        }
      } else if (e.key === keyRef.current && e.newValue === null) {
        const defaultVal = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
        setValue(defaultVal);
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, defaultValue]);

  const setStoredValue = useCallback((newValue) => {
    setValue((prev) => {
      const valueToStore = typeof newValue === 'function' ? newValue(prev) : newValue;
      storageSet(key, valueToStore);
      return valueToStore;
    });
  }, [key]);

  const removeValue = useCallback(() => {
    storageRemove(key);
    const defaultVal = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    setValue(defaultVal);
  }, [key, defaultValue]);

  return [value, setStoredValue, removeValue];
}
