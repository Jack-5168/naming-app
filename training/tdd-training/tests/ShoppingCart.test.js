/**
 * ShoppingCart 测试套件 - TDD 实战
 *
 * 包含 25+ 测试用例，覆盖：
 * - 基础功能测试
 * - 边界条件测试
 * - 异常处理测试
 * - 折扣和优惠测试
 * - 集成测试
 */

import {
  describe, it, expect, beforeEach,
} from 'vitest';
import {
  ShoppingCart,
  calculateDiscount,
  formatPrice,
  validateItem,
} from '../src/ShoppingCart.js';

describe('ShoppingCart', () => {
  let cart;

  beforeEach(() => {
    cart = new ShoppingCart();
  });

  // ==================== 基础功能测试 ====================

  describe('初始化', () => {
    it('应该创建空购物车', () => {
      expect(cart.isEmpty()).toBe(true);
      expect(cart.getItemCount()).toBe(0);
      expect(cart.getUniqueItemCount()).toBe(0);
    });

    it('应该支持自定义税率', () => {
      const cartWithTax = new ShoppingCart({ taxRate: 0.08 });
      cartWithTax.addItem({
        id: '1', name: 'Test', price: 100, quantity: 1,
      });
      expect(cartWithTax.getTax()).toBe(8);
    });

    it('应该支持自定义运费', () => {
      const cartWithShipping = new ShoppingCart({ shippingCost: 15, freeShippingThreshold: 200 });
      cartWithShipping.addItem({
        id: '1', name: 'Test', price: 50, quantity: 1,
      });
      expect(cartWithShipping.getShipping()).toBe(15);
    });

    it('应该支持包邮阈值', () => {
      const cartWithFreeShipping = new ShoppingCart({
        shippingCost: 15,
        freeShippingThreshold: 100,
      });
      cartWithFreeShipping.addItem({
        id: '1', name: 'Test', price: 150, quantity: 1,
      });
      expect(cartWithFreeShipping.getShipping()).toBe(0);
    });
  });

  describe('添加商品', () => {
    it('应该添加单个商品', () => {
      cart.addItem({
        id: '1', name: 'Apple', price: 5, quantity: 3,
      });
      expect(cart.getItemCount()).toBe(3);
      expect(cart.getUniqueItemCount()).toBe(1);
    });

    it('应该累加相同商品的数量', () => {
      cart.addItem({
        id: '1', name: 'Apple', price: 5, quantity: 2,
      });
      cart.addItem({
        id: '1', name: 'Apple', price: 5, quantity: 3,
      });
      expect(cart.getItemCount()).toBe(5);
      expect(cart.getUniqueItemCount()).toBe(1);
    });

    it('应该添加多个不同商品', () => {
      cart.addItem({
        id: '1', name: 'Apple', price: 5, quantity: 2,
      });
      cart.addItem({
        id: '2', name: 'Banana', price: 3, quantity: 4,
      });
      expect(cart.getItemCount()).toBe(6);
      expect(cart.getUniqueItemCount()).toBe(2);
    });

    it('应该返回购物车实例支持链式调用', () => {
      const result = cart.addItem({
        id: '1', name: 'Test', price: 10, quantity: 1,
      });
      expect(result).toBe(cart);
    });

    it('应该支持商品类别', () => {
      cart.addItem({
        id: '1', name: 'Apple', price: 5, quantity: 1, category: 'fruit',
      });
      const items = cart.getItems();
      expect(items[0].category).toBe('fruit');
    });
  });

  describe('更新商品数量', () => {
    beforeEach(() => {
      cart.addItem({
        id: '1', name: 'Apple', price: 5, quantity: 5,
      });
    });

    it('应该增加商品数量', () => {
      cart.updateQuantity('1', 10);
      expect(cart.getItemCount()).toBe(10);
    });

    it('应该减少商品数量', () => {
      cart.updateQuantity('1', 2);
      expect(cart.getItemCount()).toBe(2);
    });

    it('应该移除数量为 0 的商品', () => {
      cart.updateQuantity('1', 0);
      expect(cart.getItemCount()).toBe(0);
      expect(cart.isEmpty()).toBe(true);
    });

    it('应该对不存在的商品抛出错误', () => {
      expect(() => cart.updateQuantity('999', 5)).toThrow('Item not found');
    });

    it('应该对负数数量抛出错误', () => {
      expect(() => cart.updateQuantity('1', -1)).toThrow('Quantity cannot be negative');
    });
  });

  describe('移除商品', () => {
    it('应该移除指定商品', () => {
      cart.addItem({
        id: '1', name: 'Apple', price: 5, quantity: 2,
      });
      cart.addItem({
        id: '2', name: 'Banana', price: 3, quantity: 3,
      });
      cart.removeItem('1');
      expect(cart.getItemCount()).toBe(3);
      expect(cart.getUniqueItemCount()).toBe(1);
    });

    it('应该返回是否成功移除', () => {
      cart.addItem({
        id: '1', name: 'Apple', price: 5, quantity: 1,
      });
      expect(cart.removeItem('1')).toBe(true);
      expect(cart.removeItem('1')).toBe(false);
    });
  });

  describe('清空购物车', () => {
    it('应该移除所有商品', () => {
      cart.addItem({
        id: '1', name: 'Apple', price: 5, quantity: 2,
      });
      cart.addItem({
        id: '2', name: 'Banana', price: 3, quantity: 3,
      });
      cart.clear();
      expect(cart.isEmpty()).toBe(true);
      expect(cart.getItemCount()).toBe(0);
    });

    it('应该清空已应用的优惠券', () => {
      cart.addItem({
        id: '1', name: 'Test', price: 100, quantity: 1,
      });
      cart.applyCoupon({ code: 'SAVE10', type: 'percentage', value: 10 });
      cart.clear();
      expect(cart.getDiscount()).toBe(0);
    });
  });

  // ==================== 价格计算测试 ====================

  describe('价格计算', () => {
    it('应该计算正确的小计', () => {
      cart.addItem({
        id: '1', name: 'Apple', price: 5.50, quantity: 2,
      });
      cart.addItem({
        id: '2', name: 'Banana', price: 3.25, quantity: 4,
      });
      expect(cart.getSubtotal()).toBe(24.00);
    });

    it('应该正确处理小数精度', () => {
      cart.addItem({
        id: '1', name: 'Test', price: 9.99, quantity: 3,
      });
      expect(cart.getSubtotal()).toBe(29.97);
    });

    it('应该计算正确的税费', () => {
      const cartWithTax = new ShoppingCart({ taxRate: 0.1 });
      cartWithTax.addItem({
        id: '1', name: 'Test', price: 100, quantity: 1,
      });
      expect(cartWithTax.getTax()).toBe(10);
    });

    it('应该计算正确的总价', () => {
      const cartWithTax = new ShoppingCart({
        taxRate: 0.1,
        shippingCost: 5,
        freeShippingThreshold: 200,
      });
      cartWithTax.addItem({
        id: '1', name: 'Test', price: 100, quantity: 1,
      });
      expect(cartWithTax.getTotal()).toBe(115);
    });

    it('空购物车总价应该为 0', () => {
      expect(cart.getTotal()).toBe(0);
    });
  });

  // ==================== 优惠券测试 ====================

  describe('优惠券', () => {
    beforeEach(() => {
      cart.addItem({
        id: '1', name: 'Test', price: 100, quantity: 1,
      });
    });

    it('应该应用百分比优惠券', () => {
      cart.applyCoupon({ code: 'SAVE10', type: 'percentage', value: 10 });
      expect(cart.getDiscount()).toBe(10);
    });

    it('应该应用固定金额优惠券', () => {
      cart.applyCoupon({ code: 'FLAT20', type: 'fixed', value: 20 });
      expect(cart.getDiscount()).toBe(20);
    });

    it('应该支持多个优惠券', () => {
      cart.applyCoupon({ code: 'SAVE10', type: 'percentage', value: 10 });
      cart.applyCoupon({ code: 'FLAT5', type: 'fixed', value: 5 });
      expect(cart.getDiscount()).toBe(15);
    });

    it('应该检查最低消费金额', () => {
      cart.clear();
      cart.addItem({
        id: '1', name: 'Test', price: 50, quantity: 1,
      });
      expect(() => {
        cart.applyCoupon({
          code: 'SAVE10', type: 'percentage', value: 10, minPurchase: 100,
        });
      }).toThrow('Minimum purchase');
    });

    it('应该检查优惠券过期', () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);
      expect(() => {
        cart.applyCoupon({
          code: 'EXPIRED',
          type: 'percentage',
          value: 10,
          expiryDate: expiredDate.toISOString(),
        });
      }).toThrow('expired');
    });

    it('应该防止重复应用同一优惠券', () => {
      cart.applyCoupon({ code: 'SAVE10', type: 'percentage', value: 10 });
      expect(() => {
        cart.applyCoupon({ code: 'SAVE10', type: 'percentage', value: 10 });
      }).toThrow('already applied');
    });

    it('应该对无效优惠券抛出错误', () => {
      expect(() => cart.applyCoupon({})).toThrow('Invalid coupon');
      expect(() => cart.applyCoupon(null)).toThrow('Invalid coupon');
    });
  });

  // ==================== 边界条件测试 ====================

  describe('边界条件', () => {
    it('应该限制单个商品最大数量', () => {
      const limitedCart = new ShoppingCart({ maxQuantityPerItem: 10 });
      expect(() => {
        limitedCart.addItem({
          id: '1', name: 'Test', price: 10, quantity: 11,
        });
      }).toThrow('exceeds maximum');
    });

    it('应该限制累加后的总数量', () => {
      const limitedCart = new ShoppingCart({ maxQuantityPerItem: 5 });
      limitedCart.addItem({
        id: '1', name: 'Test', price: 10, quantity: 3,
      });
      expect(() => {
        limitedCart.addItem({
          id: '1', name: 'Test', price: 10, quantity: 3,
        });
      }).toThrow('exceeds maximum');
    });

    it('应该拒绝负数价格', () => {
      expect(() => {
        cart.addItem({
          id: '1', name: 'Test', price: -10, quantity: 1,
        });
      }).toThrow('Price cannot be negative');
    });

    it('应该拒绝零或负数数量', () => {
      expect(() => {
        cart.addItem({
          id: '1', name: 'Test', price: 10, quantity: 0,
        });
      }).toThrow('Quantity must be at least 1');
    });

    it('应该拒绝无效商品数据', () => {
      expect(() => cart.addItem(null)).toThrow('Invalid item');
      expect(() => cart.addItem({})).toThrow('Invalid item');
      expect(() => cart.addItem({ id: '1' })).toThrow('Invalid item');
    });

    it('总价不应该为负数', () => {
      cart.addItem({
        id: '1', name: 'Test', price: 10, quantity: 1,
      });
      cart.applyCoupon({ code: 'BIG', type: 'fixed', value: 50 });
      expect(cart.getTotal()).toBe(0);
    });
  });

  // ==================== 库存检查测试 ====================

  describe('库存检查', () => {
    it('应该返回库存充足', () => {
      cart.addItem({
        id: '1', name: 'Apple', price: 5, quantity: 2,
      });
      const inventory = new Map([['1', 10]]);
      const result = cart.checkStock(inventory);
      expect(result.inStock).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('应该检测库存不足', () => {
      cart.addItem({
        id: '1', name: 'Apple', price: 5, quantity: 5,
      });
      const inventory = new Map([['1', 3]]);
      const result = cart.checkStock(inventory);
      expect(result.inStock).toBe(false);
      expect(result.issues.length).toBe(1);
      expect(result.issues[0].requested).toBe(5);
      expect(result.issues[0].available).toBe(3);
    });

    it('应该检测不存在的库存', () => {
      cart.addItem({
        id: '1', name: 'Apple', price: 5, quantity: 1,
      });
      const inventory = new Map();
      const result = cart.checkStock(inventory);
      expect(result.inStock).toBe(false);
    });
  });

  // ==================== 类别筛选测试 ====================

  describe('类别筛选', () => {
    it('应该按类别筛选商品', () => {
      cart.addItem({
        id: '1', name: 'Apple', price: 5, quantity: 1, category: 'fruit',
      });
      cart.addItem({
        id: '2', name: 'Banana', price: 3, quantity: 1, category: 'fruit',
      });
      cart.addItem({
        id: '3', name: 'Milk', price: 10, quantity: 1, category: 'dairy',
      });

      const fruits = cart.getItemsByCategory('fruit');
      expect(fruits.length).toBe(2);

      const dairy = cart.getItemsByCategory('dairy');
      expect(dairy.length).toBe(1);
    });

    it('应该返回空数组当类别不存在', () => {
      cart.addItem({
        id: '1', name: 'Apple', price: 5, quantity: 1, category: 'fruit',
      });
      const electronics = cart.getItemsByCategory('electronics');
      expect(electronics).toEqual([]);
    });
  });
});

// ==================== 工具函数测试 ====================

describe('calculateDiscount', () => {
  it('应该返回 0 当没有折扣规则', () => {
    expect(calculateDiscount(100, [])).toBe(0);
    expect(calculateDiscount(100, null)).toBe(0);
  });

  it('应该应用百分比折扣', () => {
    const rules = [{ minAmount: 50, type: 'percentage', value: 10 }];
    expect(calculateDiscount(100, rules)).toBe(10);
  });

  it('应该应用固定金额折扣', () => {
    const rules = [{ minAmount: 50, type: 'fixed', value: 20 }];
    expect(calculateDiscount(100, rules)).toBe(20);
  });

  it('应该检查最低金额要求', () => {
    const rules = [{ minAmount: 100, type: 'percentage', value: 10 }];
    expect(calculateDiscount(50, rules)).toBe(0);
    expect(calculateDiscount(100, rules)).toBe(10);
  });

  it('应该选择最优折扣', () => {
    const rules = [
      { minAmount: 50, type: 'percentage', value: 10 },
      { minAmount: 50, type: 'fixed', value: 15 },
    ];
    expect(calculateDiscount(100, rules)).toBe(15);
  });
});

describe('formatPrice', () => {
  it('应该格式化 CNY 价格', () => {
    expect(formatPrice(10.5, 'CNY')).toBe('¥10.50');
  });

  it('应该格式化 USD 价格', () => {
    expect(formatPrice(10.5, 'USD')).toBe('$10.50');
  });

  it('应该格式化 EUR 价格', () => {
    expect(formatPrice(10.5, 'EUR')).toBe('€10.50');
  });

  it('应该使用默认货币', () => {
    expect(formatPrice(10.5)).toBe('¥10.50');
  });

  it('应该支持未知货币符号', () => {
    expect(formatPrice(10.5, 'GBP')).toBe('GBP10.50');
  });
});

describe('validateItem', () => {
  it('应该验证有效商品', () => {
    const result = validateItem({
      id: '1', name: 'Test', price: 10, quantity: 1,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('应该检测空商品', () => {
    const result = validateItem(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Item is required');
  });

  it('应该检测缺少 ID', () => {
    const result = validateItem({ name: 'Test', price: 10 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Item ID is required');
  });

  it('应该检测空名称', () => {
    const result = validateItem({ id: '1', name: '', price: 10 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Item name is required');
  });

  it('应该检测无效价格', () => {
    const result1 = validateItem({ id: '1', name: 'Test', price: '10' });
    expect(result1.valid).toBe(false);
    expect(result1.errors).toContain('Price must be a number');

    const result2 = validateItem({ id: '1', name: 'Test', price: -10 });
    expect(result2.valid).toBe(false);
    expect(result2.errors).toContain('Price cannot be negative');
  });

  it('应该检测无效数量', () => {
    const result1 = validateItem({
      id: '1', name: 'Test', price: 10, quantity: 1.5,
    });
    expect(result1.valid).toBe(false);
    expect(result1.errors).toContain('Quantity must be an integer');

    const result2 = validateItem({
      id: '1', name: 'Test', price: 10, quantity: 0,
    });
    expect(result2.valid).toBe(false);
    expect(result2.errors).toContain('Quantity must be at least 1');
  });
});
