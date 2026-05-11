/**
 * ShoppingCart — TDD 测试套件 (2026-04-26)
 *
 * 测试驱动开发流程：
 *   🔴 Red   → 先写失败的测试
 *   🟢 Green → 写刚好通过测试的代码
 *   🔵 Refactor → 优化代码，保持测试通过
 *
 * 共 24 个测试用例，覆盖：
 *   - 初始化
 *   - 添加商品
 *   - 移除商品
 *   - 更新数量
 *   - 价格计算 (subtotal / discount / tax / total)
 *   - 边界条件 & 异常处理
 *   - 工具方法
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ShoppingCart } from '../src/ShoppingCart.js';

// ======================== 1-3: 初始化测试 ========================

describe('ShoppingCart 初始化', () => {
  it('应该创建空购物车', () => {
    const cart = new ShoppingCart();
    expect(cart.isEmpty()).toBe(true);
    expect(cart.getItemCount()).toBe(0);
    expect(cart.getUniqueCount()).toBe(0);
  });

  it('应该支持自定义税率', () => {
    const cart = new ShoppingCart({ taxRate: 0.1 });
    cart.addItem('1', 'Apple', 100, 1);
    expect(cart.getTaxAmount()).toBeCloseTo(10);
  });

  it('应该支持自定义折扣', () => {
    const cart = new ShoppingCart({ discount: 0.2 });
    cart.addItem('1', 'Apple', 100, 1);
    expect(cart.getDiscountAmount()).toBe(20);
  });
});

// ======================== 4-8: 添加商品测试 ========================

describe('添加商品', () => {
  let cart;
  beforeEach(() => { cart = new ShoppingCart(); });

  it('应该添加单个商品', () => {
    cart.addItem('1', 'Apple', 10, 1);
    expect(cart.getItemCount()).toBe(1);
    expect(cart.getUniqueCount()).toBe(1);
  });

  it('应该添加多个不同商品', () => {
    cart.addItem('1', 'Apple', 10, 1);
    cart.addItem('2', 'Banana', 5, 2);
    expect(cart.getItemCount()).toBe(3);
    expect(cart.getUniqueCount()).toBe(2);
  });

  it('重复添加同一商品应该累加数量', () => {
    cart.addItem('1', 'Apple', 10, 1);
    cart.addItem('1', 'Apple', 10, 3);
    const item = cart.getItem('1');
    expect(item.quantity).toBe(4);
    expect(cart.getUniqueCount()).toBe(1);
  });

  it('应该拒绝无效 id', () => {
    expect(() => cart.addItem('', 'Apple', 10)).toThrow('Invalid item id');
    expect(() => cart.addItem(123, 'Apple', 10)).toThrow('Invalid item id');
  });

  it('应该拒绝无效 name', () => {
    expect(() => cart.addItem('1', '', 10)).toThrow('Invalid item name');
    expect(() => cart.addItem('1', null, 10)).toThrow('Invalid item name');
  });

  it('应该拒绝无效 price', () => {
    expect(() => cart.addItem('1', 'Apple', -1)).toThrow('Invalid price');
    expect(() => cart.addItem('1', 'Apple', 'free')).toThrow('Invalid price');
  });

  it('应该拒绝无效 quantity', () => {
    expect(() => cart.addItem('1', 'Apple', 10, 0)).toThrow('Invalid quantity');
    expect(() => cart.addItem('1', 'Apple', 10, -1)).toThrow('Invalid quantity');
  });

  it('应该拒绝超出容量限制', () => {
    const smallCart = new ShoppingCart({ maxItems: 2 });
    smallCart.addItem('1', 'A', 1, 1);
    smallCart.addItem('2', 'B', 2, 1);
    expect(() => smallCart.addItem('3', 'C', 3, 1)).toThrow('Cart is full');
  });
});

// ======================== 9-10: 移除商品测试 ========================

describe('移除商品', () => {
  let cart;
  beforeEach(() => {
    cart = new ShoppingCart();
    cart.addItem('1', 'Apple', 10, 1);
    cart.addItem('2', 'Banana', 5, 2);
  });

  it('应该成功移除已有商品', () => {
    expect(cart.removeItem('1')).toBe(true);
    expect(cart.getUniqueCount()).toBe(1);
    expect(cart.getItem('1')).toBeUndefined();
  });

  it('移除不存在商品应该返回 false', () => {
    expect(cart.removeItem('ghost')).toBe(false);
  });
});

// ======================== 11-12: 更新数量测试 ========================

describe('更新数量', () => {
  let cart;
  beforeEach(() => {
    cart = new ShoppingCart();
    cart.addItem('1', 'Apple', 10, 1);
  });

  it('应该更新商品数量', () => {
    cart.updateQuantity('1', 5);
    expect(cart.getItem('1').quantity).toBe(5);
  });

  it('应该拒绝无效数量', () => {
    expect(() => cart.updateQuantity('1', 0)).toThrow('Invalid quantity');
    expect(() => cart.updateQuantity('ghost', 1)).toThrow('Item not found');
  });
});

// ======================== 13-17: 价格计算测试 ========================

describe('价格计算', () => {
  it('空购物车 subtotal 应为 0', () => {
    expect(new ShoppingCart().getSubtotal()).toBe(0);
  });

  it('应该正确计算 subtotal', () => {
    const cart = new ShoppingCart();
    cart.addItem('1', 'Apple', 10, 2);
    cart.addItem('2', 'Banana', 5, 3);
    expect(cart.getSubtotal()).toBe(35); // 10*2 + 5*3
  });

  it('应该正确计算 discount', () => {
    const cart = new ShoppingCart({ discount: 0.1 });
    cart.addItem('1', 'Apple', 100, 1);
    expect(cart.getDiscountAmount()).toBe(10);
  });

  it('应该正确计算 tax', () => {
    const cart = new ShoppingCart({ taxRate: 0.1 });
    cart.addItem('1', 'Apple', 100, 1);
    expect(cart.getTaxAmount()).toBe(10);
  });

  it('应该正确计算 total (含折扣和税)', () => {
    const cart = new ShoppingCart({ taxRate: 0.1, discount: 0.2 });
    cart.addItem('1', 'Apple', 100, 1);
    // subtotal=100, discount=20, taxable=80, tax=8, total=100-20+8=88
    expect(cart.getTotal()).toBe(88);
  });
});

// ======================== 18-20: 工具方法测试 ========================

describe('工具方法', () => {
  it('clear 应该清空所有商品', () => {
    const cart = new ShoppingCart();
    cart.addItem('1', 'Apple', 10, 1);
    cart.clear();
    expect(cart.isEmpty()).toBe(true);
    expect(cart.getItemCount()).toBe(0);
  });

  it('getItem 应该返回深拷贝', () => {
    const cart = new ShoppingCart();
    cart.addItem('1', 'Apple', 10, 1);
    const item = cart.getItem('1');
    item.name = 'HACKED';
    expect(cart.getItem('1').name).toBe('Apple');
  });

  it('setDiscount 应该拒绝超出范围的值', () => {
    const cart = new ShoppingCart();
    expect(() => cart.setDiscount(-0.1)).toThrow();
    expect(() => cart.setDiscount(1.1)).toThrow();
  });

  it('setDiscount 应该允许合法值', () => {
    const cart = new ShoppingCart();
    cart.setDiscount(0.15);
    cart.addItem('1', 'Apple', 100, 1);
    expect(cart.getDiscountAmount()).toBe(15);
  });

  it('setTaxRate 应该拒绝超出范围的值', () => {
    const cart = new ShoppingCart();
    expect(() => cart.setTaxRate(-0.1)).toThrow();
    expect(() => cart.setTaxRate(1.1)).toThrow();
  });

  it('setTaxRate 应该允许合法值', () => {
    const cart = new ShoppingCart();
    cart.setTaxRate(0.08);
    cart.addItem('1', 'Apple', 100, 1);
    expect(cart.getTaxAmount()).toBe(8);
  });
});

// ======================== 21-24: 边界条件测试 ========================

describe('边界条件', () => {
  it('价格为 0 的商品应该允许', () => {
    const cart = new ShoppingCart();
    cart.addItem('1', 'Free Gift', 0, 1);
    expect(cart.getSubtotal()).toBe(0);
    expect(cart.getItemCount()).toBe(1);
  });

  it('大量商品应该正确计算', () => {
    const cart = new ShoppingCart({ taxRate: 0.05 });
    for (let i = 0; i < 100; i++) {
      cart.addItem(String(i), `Item ${i}`, 1, 1);
    }
    expect(cart.getItemCount()).toBe(100);
    expect(cart.getSubtotal()).toBe(100);
    expect(cart.getTaxAmount()).toBeCloseTo(5);
  });

  it('折扣为 0 时不应影响计算', () => {
    const cart = new ShoppingCart({ discount: 0, taxRate: 0.1 });
    cart.addItem('1', 'Apple', 100, 1);
    expect(cart.getDiscountAmount()).toBe(0);
    expect(cart.getTotal()).toBe(110);
  });

  it('税率和折扣同时为 0 时 total 等于 subtotal', () => {
    const cart = new ShoppingCart();
    cart.addItem('1', 'Apple', 50, 2);
    expect(cart.getTotal()).toBe(100);
  });
});
