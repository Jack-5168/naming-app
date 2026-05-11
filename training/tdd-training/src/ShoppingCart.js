/**
 * ShoppingCart - TDD 实战示例模块
 *
 * 这是一个完整的购物车实现，用于演示 TDD 实践
 * 包含：商品管理、折扣计算、库存检查、促销规则等
 */

export class ShoppingCart {
  constructor(options = {}) {
    this.items = new Map();
    this.taxRate = options.taxRate || 0;
    this.shippingCost = options.shippingCost || 0;
    this.coupons = [];
    this.maxQuantityPerItem = options.maxQuantityPerItem || 99;
    this.freeShippingThreshold = options.freeShippingThreshold || 0;
  }

  // 添加商品到购物车
  addItem(item) {
    if (!item || !item.id || !item.name || typeof item.price !== 'number') {
      throw new Error('Invalid item: must have id, name, and price');
    }

    if (item.price < 0) {
      throw new Error('Price cannot be negative');
    }

    if (item.quantity < 1) {
      throw new Error('Quantity must be at least 1');
    }

    if (item.quantity > this.maxQuantityPerItem) {
      throw new Error(`Quantity exceeds maximum (${this.maxQuantityPerItem})`);
    }

    const existingItem = this.items.get(item.id);
    if (existingItem) {
      const newQuantity = existingItem.quantity + item.quantity;
      if (newQuantity > this.maxQuantityPerItem) {
        throw new Error(`Total quantity exceeds maximum (${this.maxQuantityPerItem})`);
      }
      existingItem.quantity = newQuantity;
    } else {
      this.items.set(item.id, {
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        category: item.category || 'general',
      });
    }

    return this;
  }

  // 更新商品数量
  updateQuantity(itemId, quantity) {
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }

    const item = this.items.get(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    if (quantity === 0) {
      this.removeItem(itemId);
      return this;
    }

    if (quantity > this.maxQuantityPerItem) {
      throw new Error(`Quantity exceeds maximum (${this.maxQuantityPerItem})`);
    }

    item.quantity = quantity;
    return this;
  }

  // 移除商品
  removeItem(itemId) {
    return this.items.delete(itemId);
  }

  // 清空购物车
  clear() {
    this.items.clear();
    this.coupons = [];
    return this;
  }

  // 获取商品数量
  getItemCount() {
    let count = 0;
    for (const item of this.items.values()) {
      count += item.quantity;
    }
    return count;
  }

  // 获取商品种类数
  getUniqueItemCount() {
    return this.items.size;
  }

  // 计算小计
  getSubtotal() {
    let subtotal = 0;
    for (const item of this.items.values()) {
      subtotal += item.price * item.quantity;
    }
    return Math.round(subtotal * 100) / 100;
  }

  // 应用优惠券
  applyCoupon(coupon) {
    if (!coupon || !coupon.code || !coupon.type) {
      throw new Error('Invalid coupon');
    }

    if (coupon.minPurchase && this.getSubtotal() < coupon.minPurchase) {
      throw new Error(`Minimum purchase of ${coupon.minPurchase} required`);
    }

    if (this.coupons.some((c) => c.code === coupon.code)) {
      throw new Error('Coupon already applied');
    }

    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      throw new Error('Coupon has expired');
    }

    this.coupons.push(coupon);
    return this;
  }

  // 计算折扣
  getDiscount() {
    let discount = 0;
    for (const coupon of this.coupons) {
      if (coupon.type === 'percentage') {
        discount += this.getSubtotal() * (coupon.value / 100);
      } else if (coupon.type === 'fixed') {
        discount += coupon.value;
      }
    }
    return Math.round(discount * 100) / 100;
  }

  // 计算税费
  getTax() {
    const afterDiscount = this.getSubtotal() - this.getDiscount();
    const tax = afterDiscount * this.taxRate;
    return Math.round(tax * 100) / 100;
  }

  // 计算运费
  getShipping() {
    if (this.getSubtotal() >= this.freeShippingThreshold) {
      return 0;
    }
    return this.shippingCost;
  }

  // 计算总价
  getTotal() {
    const subtotal = this.getSubtotal();
    const discount = this.getDiscount();
    const tax = this.getTax();
    const shipping = this.getShipping();

    const total = subtotal - discount + tax + shipping;
    return Math.max(0, Math.round(total * 100) / 100);
  }

  // 获取购物车所有商品
  getItems() {
    return Array.from(this.items.values());
  }

  // 检查库存
  checkStock(inventory) {
    const issues = [];
    for (const item of this.items.values()) {
      const stock = inventory.get(item.id) || 0;
      if (item.quantity > stock) {
        issues.push({
          itemId: item.id,
          name: item.name,
          requested: item.quantity,
          available: stock,
        });
      }
    }
    return {
      inStock: issues.length === 0,
      issues,
    };
  }

  // 按类别筛选商品
  getItemsByCategory(category) {
    return Array.from(this.items.values()).filter(
      (item) => item.category === category,
    );
  }

  // 检查购物车是否为空
  isEmpty() {
    return this.items.size === 0;
  }
}

/**
 * 计算订单折扣的纯函数
 */
export function calculateDiscount(subtotal, discountRules) {
  if (!discountRules || discountRules.length === 0) {
    return 0;
  }

  let discount = 0;
  for (const rule of discountRules) {
    if (subtotal >= rule.minAmount) {
      if (rule.type === 'percentage') {
        discount = Math.max(discount, subtotal * (rule.value / 100));
      } else if (rule.type === 'fixed') {
        discount = Math.max(discount, rule.value);
      }
    }
  }

  return Math.round(discount * 100) / 100;
}

/**
 * 格式化价格
 */
export function formatPrice(price, currency = 'CNY') {
  const symbols = {
    CNY: '¥',
    USD: '$',
    EUR: '€',
    JPY: '¥',
  };
  const symbol = symbols[currency] || currency;
  return `${symbol}${price.toFixed(2)}`;
}

/**
 * 验证商品数据
 */
export function validateItem(item) {
  const errors = [];

  if (!item) {
    errors.push('Item is required');
    return { valid: false, errors };
  }

  if (!item.id) {
    errors.push('Item ID is required');
  }

  if (!item.name || item.name.trim() === '') {
    errors.push('Item name is required');
  }

  if (typeof item.price !== 'number') {
    errors.push('Price must be a number');
  } else if (item.price < 0) {
    errors.push('Price cannot be negative');
  }

  if (item.quantity !== undefined) {
    if (!Number.isInteger(item.quantity)) {
      errors.push('Quantity must be an integer');
    } else if (item.quantity < 1) {
      errors.push('Quantity must be at least 1');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
