/**
 * FormValidator - Schema-based form validation
 * TDD 实战模块 1/3
 */

const VALIDATORS = {
  required(value, _field, errors, fieldName) {
    if (value === undefined || value === null || value === '') {
      errors.push(`${fieldName} is required`);
    }
  },

  minLength(value, param, errors, fieldName) {
    if (typeof value === 'string' && value.length < param) {
      errors.push(`${fieldName} must be at least ${param} characters`);
    }
  },

  maxLength(value, param, errors, fieldName) {
    if (typeof value === 'string' && value.length > param) {
      errors.push(`${fieldName} must be at most ${param} characters`);
    }
  },

  min(value, param, errors, fieldName) {
    if (typeof value === 'number' && value < param) {
      errors.push(`${fieldName} must be at least ${param}`);
    }
  },

  max(value, param, errors, fieldName) {
    if (typeof value === 'number' && value > param) {
      errors.push(`${fieldName} must be at most ${param}`);
    }
  },

  pattern(value, regex, errors, fieldName) {
    if (typeof value === 'string' && !regex.test(value)) {
      errors.push(`${fieldName} format is invalid`);
    }
  },

  email(value, _param, errors, fieldName) {
    if (value !== undefined && value !== '' && typeof value === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.push(`${fieldName} must be a valid email`);
      }
    }
  },

  custom(value, fn, errors, fieldName, allValues) {
    const result = fn(value, allValues);
    if (result !== true && result !== undefined && result !== null) {
      errors.push(typeof result === 'string' ? result : `${fieldName} validation failed`);
    }
  },
};

/**
 * Validate form data against a schema
 * @param {Object} data - Form data to validate
 * @param {Object} schema - Validation schema
 * @returns {Object} { valid: boolean, errors: Object.<string, string[]> }
 */
export function validate(data, schema) {
  const errors = {};
  let valid = true;

  for (const [fieldName, rules] of Object.entries(schema)) {
    const fieldErrors = [];
    const value = data[fieldName];

    for (const rule of rules) {
      if (typeof rule === 'string') {
        // Simple rule like 'required'
        if (VALIDATORS[rule]) {
          VALIDATORS[rule](value, null, fieldErrors, fieldName);
        }
      } else if (Array.isArray(rule)) {
        // Rule with params like ['minLength', 3]
        const [ruleName, param] = rule;
        if (VALIDATORS[ruleName]) {
          VALIDATORS[ruleName](value, param, fieldErrors, fieldName);
        }
      } else if (typeof rule === 'function') {
        // Custom validator function
        VALIDATORS.custom(value, rule, fieldErrors, fieldName, data);
      }
    }

    if (fieldErrors.length > 0) {
      errors[fieldName] = fieldErrors;
      valid = false;
    }
  }

  return { valid, errors };
}

/**
 * Create a reusable validator with a fixed schema
 * @param {Object} schema
 * @returns {Function}
 */
export function createValidator(schema) {
  return function validateWithSchema(data) {
    return validate(data, schema);
  };
}

/**
 * Validate a single field
 * @param {string} fieldName
 * @param {*} value
 * @param {Array} rules
 * @param {Object} [allData] - Full form data (for cross-field validation)
 * @returns {string[]}
 */
export function validateField(fieldName, value, rules, allData = {}) {
  const fieldErrors = [];

  for (const rule of rules) {
    if (typeof rule === 'string') {
      if (VALIDATORS[rule]) {
        VALIDATORS[rule](value, null, fieldErrors, fieldName);
      }
    } else if (Array.isArray(rule)) {
      const [ruleName, param] = rule;
      if (VALIDATORS[ruleName]) {
        VALIDATORS[ruleName](value, param, fieldErrors, fieldName);
      }
    } else if (typeof rule === 'function') {
      VALIDATORS.custom(value, rule, fieldErrors, fieldName, allData);
    }
  }

  return fieldErrors;
}
