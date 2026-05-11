/**
 * FormValidator 测试
 * TDD 实战：先写测试，再实现
 */
import { describe, it, expect } from 'vitest';
import { validate, createValidator, validateField } from '../src/FormValidator.js';

describe('FormValidator', () => {
  // ── validate() 基础 ──

  describe('validate()', () => {
    it('空数据 + 空 schema 应返回 valid=true', () => {
      const result = validate({}, {});
      expect(result).toEqual({ valid: true, errors: {} });
    });

    it('required 规则：空值应报错', () => {
      const schema = { name: ['required'] };
      expect(validate({ name: '' }, schema).valid).toBe(false);
      expect(validate({ name: null }, schema).valid).toBe(false);
      expect(validate({ name: undefined }, schema).valid).toBe(false);
    });

    it('required 规则：有效值应通过', () => {
      const schema = { name: ['required'] };
      expect(validate({ name: 'Alice' }, schema).valid).toBe(true);
    });

    it('minLength 规则：长度不足应报错', () => {
      const schema = { password: [['minLength', 6]] };
      const result = validate({ password: 'abc' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.password).toContain('password must be at least 6 characters');
    });

    it('maxLength 规则：超长应报错', () => {
      const schema = { name: [['maxLength', 10]] };
      const result = validate({ name: 'verylongname' }, schema);
      expect(result.valid).toBe(false);
    });

    it('min/max 规则：数字范围校验', () => {
      const schema = { age: [['min', 0], ['max', 150]] };
      expect(validate({ age: -1 }, schema).valid).toBe(false);
      expect(validate({ age: 200 }, schema).valid).toBe(false);
      expect(validate({ age: 25 }, schema).valid).toBe(true);
    });

    it('pattern 规则：正则匹配', () => {
      const schema = { code: [['pattern', /^\d{6}$/]] };
      expect(validate({ code: '123456' }, schema).valid).toBe(true);
      expect(validate({ code: 'abc' }, schema).valid).toBe(false);
    });

    it('email 规则：邮箱格式校验', () => {
      const schema = { email: ['email'] };
      expect(validate({ email: 'test@example.com' }, schema).valid).toBe(true);
      expect(validate({ email: 'invalid' }, schema).valid).toBe(false);
      expect(validate({ email: '' }, schema).valid).toBe(true); // 空值不校验格式
    });

    it('自定义函数规则', () => {
      const schema = {
        age: [(value) => (value >= 18 ? true : 'Must be 18 or older')],
      };
      expect(validate({ age: 20 }, schema).valid).toBe(true);
      const result = validate({ age: 16 }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.age).toContain('Must be 18 or older');
    });

    it('多规则组合：一个字段多个规则', () => {
      const schema = {
        username: ['required', ['minLength', 3], ['maxLength', 20]],
      };
      expect(validate({ username: 'ab' }, schema).errors.username.length).toBe(1);
      // 空字符串同时触发 required + minLength
      expect(validate({ username: '' }, schema).errors.username.length).toBe(2);
      expect(validate({ username: 'alice' }, schema).valid).toBe(true);
    });

    it('多字段错误：同时返回所有字段错误', () => {
      const schema = {
        name: ['required'],
        email: ['required', 'email'],
      };
      const result = validate({ name: '', email: 'bad' }, schema);
      expect(result.valid).toBe(false);
      expect(Object.keys(result.errors)).toHaveLength(2);
    });

    it('createValidator 创建预绑定 schema 的验证器', () => {
      const schema = { email: ['required', 'email'] };
      const validateEmail = createValidator(schema);
      expect(validateEmail({ email: 'ok@test.com' }).valid).toBe(true);
      expect(validateEmail({ email: '' }).valid).toBe(false);
    });

    it('validateField 单字段验证', () => {
      const rules = ['required', ['minLength', 3]];
      // 空字符串同时触发 required + minLength
      expect(validateField('name', '', rules)).toHaveLength(2);
      expect(validateField('name', 'ab', rules)).toHaveLength(1);
      expect(validateField('name', 'alice', rules)).toHaveLength(0);
    });

    it('validateField 支持跨字段验证（allData 参数）', () => {
      const rules = [
        (value, allData) => {
          if (value !== allData.passwordConfirm) return 'Passwords do not match';
          return true;
        },
      ];
      const errors = validateField('password', '123', rules, { passwordConfirm: '456' });
      expect(errors).toContain('Passwords do not match');
    });

    it('自定义规则返回字符串作为错误消息', () => {
      const schema = {
        code: [(value) => (value === 'SECRET' ? true : 'Wrong code')],
      };
      const result = validate({ code: 'WRONG' }, schema);
      expect(result.errors.code).toContain('Wrong code');
    });

    it('自定义规则返回 true/null/undefined 视为通过', () => {
      const schema = {
        x: [() => null, () => undefined, () => true],
      };
      expect(validate({ x: 'anything' }, schema).valid).toBe(true);
    });
  });
});
