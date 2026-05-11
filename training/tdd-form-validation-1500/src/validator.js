// src/validator.js — 表单验证引擎 (TDD 驱动开发)

/**
 * FormValidator — 可组合的表单验证引擎
 *
 * 核心设计原则:
 * 1. 链式 API — fluent interface
 * 2. 可组合 — rules 可复用
 * 3. 异步支持 — async validators
 * 4. 条件验证 — when()
 * 5. 字段比较 — equals()
 * 6. 嵌套对象 — nested schemas
 * 7. 自定义错误消息
 * 8. 批量验证 + 单字段验证
 */

class ValidationError extends Error {
  constructor(field, message, code) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.message = message;
    this.code = code || 'VALIDATION_ERROR';
  }
}

class FormValidator {
  constructor() {
    this._rules = {};   // { fieldName: [validatorFn, ...] }
    this._errors = {};  // { fieldName: [errorMsg, ...] }
    this._asyncRules = {}; // { fieldName: [asyncValidatorFn, ...] }
  }

  /**
   * 添加同步验证规则
   * @param {string} field - 字段名
   * @param {Function} validator - (value, fieldValueMap) => string | null
   * @returns {FormValidator}
   */
  rule(field, validator) {
    if (!this._rules[field]) this._rules[field] = [];
    this._rules[field].push(validator);
    return this;
  }

  /**
   * 添加异步验证规则
   * @param {string} field
   * @param {Function} asyncValidator - async (value, fieldValueMap) => string | null
   * @returns {FormValidator}
   */
  asyncRule(field, asyncValidator) {
    if (!this._asyncRules[field]) this._asyncRules[field] = [];
    this._asyncRules[field].push(asyncValidator);
    return this;
  }

  /**
   * 验证整个表单数据
   * @param {Object} data - 表单数据
   * @returns {Promise<{ valid: boolean, errors: Object }>}
   */
  async validate(data) {
    if (data == null) data = {};
    this._errors = {};

    // 同步验证
    for (const [field, validators] of Object.entries(this._rules)) {
      const value = data[field];
      for (const validator of validators) {
        const error = validator(value, data);
        if (error) {
          if (!this._errors[field]) this._errors[field] = [];
          this._errors[field].push(error);
          break; // 一个字段只报第一个错误
        }
      }
    }

    // 异步验证
    for (const [field, asyncValidators] of Object.entries(this._asyncRules)) {
      const value = data[field];
      for (const validator of asyncValidators) {
        const error = await validator(value, data);
        if (error) {
          if (!this._errors[field]) this._errors[field] = [];
          this._errors[field].push(error);
          break;
        }
      }
    }

    const valid = Object.keys(this._errors).length === 0;
    return { valid, errors: { ...this._errors } };
  }

  /**
   * 验证单个字段
   * @param {string} field
   * @param {*} value
   * @param {Object} allData
   * @returns {string|null}
   */
  validateField(field, value, allData = {}) {
    const validators = this._rules[field] || [];
    for (const validator of validators) {
      const error = validator(value, allData);
      if (error) return error;
    }
    return null;
  }

  /**
   * 获取错误消息
   * @param {string} field
   * @returns {string[]}
   */
  getErrors(field) {
    return this._errors[field] || [];
  }

  /**
   * 获取所有错误字段
   * @returns {string[]}
   */
  getErrorFields() {
    return Object.keys(this._errors);
  }

  /**
   * 重置验证状态
   * @returns {FormValidator}
   */
  reset() {
    this._errors = {};
    return this;
  }
}

// ========================
// 内置验证规则工厂
// ========================

const Rules = {
  /** 必填 */
  required(message) {
    return (value) => {
      if (value === undefined || value === null || value === '') {
        return message || '此字段为必填项';
      }
      if (Array.isArray(value) && value.length === 0) {
        return message || '请至少选择一项';
      }
      return null;
    };
  },

  /** 最小长度 */
  minLength(len, message) {
    return (value) => {
      if (value === undefined || value === null || value === '') return null;
      if (typeof value !== 'string') return null;
      if (value.length < len) {
        return message || `最少需要 ${len} 个字符`;
      }
      return null;
    };
  },

  /** 最大长度 */
  maxLength(len, message) {
    return (value) => {
      if (value === undefined || value === null || value === '') return null;
      if (typeof value !== 'string') return null;
      if (value.length > len) {
        return message || `最多允许 ${len} 个字符`;
      }
      return null;
    };
  },

  /** 正则匹配 */
  pattern(regex, message) {
    return (value) => {
      if (value === undefined || value === null || value === '') return null;
      if (!regex.test(String(value))) {
        return message || `格式不正确`;
      }
      return null;
    };
  },

  /** 邮箱 */
  email(message) {
    return Rules.pattern(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message || '请输入有效的邮箱地址'
    );
  },

  /** 手机号 (中国大陆) */
  phone(message) {
    return Rules.pattern(
      /^1[3-9]\d{9}$/,
      message || '请输入有效的手机号码'
    );
  },

  /** 最小数值 */
  min(num, message) {
    return (value) => {
      if (value === undefined || value === null || value === '') return null;
      const n = Number(value);
      if (isNaN(n)) return null;
      if (n < num) {
        return message || `最小值为 ${num}`;
      }
      return null;
    };
  },

  /** 最大数值 */
  max(num, message) {
    return (value) => {
      if (value === undefined || value === null || value === '') return null;
      const n = Number(value);
      if (isNaN(n)) return null;
      if (n > num) {
        return message || `最大值为 ${num}`;
      }
      return null;
    };
  },

  /** 等于另一字段 */
  equals(field, message) {
    return (value, allData) => {
      if (value === undefined || value === null || value === '') return null;
      if (value !== allData[field]) {
        return message || `必须与 ${field} 一致`;
      }
      return null;
    };
  },

  /** 自定义验证 */
  custom(fn, message) {
    return (value, allData) => {
      const result = fn(value, allData);
      if (result === true || result === null || result === undefined) return null;
      return result || message || '验证失败';
    };
  },

  /** 条件验证 */
  when(field, condition, rules) {
    return (value, allData) => {
      if (condition(allData[field])) {
        for (const rule of rules) {
          const error = rule(value, allData);
          if (error) return error;
        }
      }
      return null;
    };
  },

  /** 长度范围 */
  lengthRange(min, max, message) {
    return (value) => {
      if (value === undefined || value === null || value === '') return null;
      if (typeof value !== 'string') return null;
      if (value.length < min || value.length > max) {
        return message || `长度需在 ${min} 到 ${max} 个字符之间`;
      }
      return null;
    };
  },

  /** 数值范围 */
  numberRange(min, max, message) {
    return (value) => {
      if (value === undefined || value === null || value === '') return null;
      const n = Number(value);
      if (isNaN(n)) return null;
      if (n < min || n > max) {
        return message || `数值需在 ${min} 到 ${max} 之间`;
      }
      return null;
    };
  },

  /** 白名单 */
  oneOf(options, message) {
    return (value) => {
      if (value === undefined || value === null || value === '') return null;
      if (!options.includes(value)) {
        return message || `只能选择: ${options.join(', ')}`;
      }
      return null;
    };
  },

  /** URL */
  url(message) {
    return Rules.pattern(
      /^https?:\/\/.+/,
      message || '请输入有效的 URL 地址'
    );
  },

  /** 强密码 (至少8位，含大小写+数字) */
  strongPassword(message) {
    return (value) => {
      if (value === undefined || value === null || value === '') return null;
      if (typeof value !== 'string') return null;
      if (value.length < 8) return message || '密码至少8位';
      if (!/[A-Z]/.test(value)) return message || '密码需包含大写字母';
      if (!/[a-z]/.test(value)) return message || '密码需包含小写字母';
      if (!/[0-9]/.test(value)) return message || '密码需包含数字';
      return null;
    };
  }
};

// ========================
// 工具函数
// ========================

/** 创建验证器实例 */
function createValidator() {
  return new FormValidator();
}

/** 快速验证 (一次性) */
async function quickValidate(schema, data) {
  const v = new FormValidator();
  for (const [field, rules] of Object.entries(schema)) {
    for (const rule of rules) {
      v.rule(field, rule);
    }
  }
  return v.validate(data);
}

module.exports = {
  FormValidator,
  ValidationError,
  Rules,
  createValidator,
  quickValidate
};
