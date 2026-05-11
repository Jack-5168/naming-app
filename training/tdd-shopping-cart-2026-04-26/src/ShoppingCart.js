/**
 * ShoppingCart — TDD 实战 (2026-04-26)
 *
 * 测试驱动开发流程：
 *   🔴 Red   → 先写失败的测试
 *   🟢 Green → 写刚好通过测试的代码
 *   🔵 Refactor → 优化代码，保持测试通过
 *
 * 目标：20+ 测试用例，覆盖率 90%+
 */

export class ShoppingCart {
  constructor(options = {}) {
    this.items = new Map();
    this.taxRate = options.taxRate ?? 0;
    this.discount = options.discount ?? 0;
    this.maxItems = options.maxItems ?? Infinity;
  }

  addItem(id, name, price, quantity = 1) {
    if (!id || typeof id !== 'string') throw new Error('Invalid item id');
    if (!name || typeof name !== 'string') throw new Error('Invalid item name');
    if (typeof price !== 'number' || price < 0) throw new Error('Invalid price');
    if (typeof quantity !== 'number' || quantity < 1) throw new Error('Invalid quantity');
    if (this.items.size >= this.maxItems && !this.items.has(id)) {
      throw new Error('Cart is full');
    }

    if (this.items.has(id)) {
      const item = this.items.get(id);
      item.quantity += quantity;
    } else {
      this.items.set(id, { id, name, price, quantity });
    }
  }

  removeItem(id) {
    return this.items.delete(id);
  }

  updateQuantity(id, quantity) {
    if (!this.items.has(id)) throw new Error('Item not found');
    if (typeof quantity !== 'number' || quantity < 1) throw new Error('Invalid quantity');
    this.items.get(id).quantity = quantity;
  }

  getItem(id) {
    const item = this.items.get(id);
    return item ? { ...item } : undefined;
  }

  getItemCount() {
    let total = 0;
    for (const item of this.items.values()) {
      total += item.quantity;
    }
    return total;
  }

  getSubtotal() {
    let sum = 0;
    for (const item of this.items.values()) {
      sum += item.price * item.quantity;
    }
    return sum;
  }

  getDiscountAmount() {
    return this.getSubtotal() * this.discount;
  }

  getTaxAmount() {
    return (this.getSubtotal() - this.getDiscountAmount()) * this.taxRate;
  }

  getTotal() {
    return this.getSubtotal() - this.getDiscountAmount() + this.getTaxAmount();
  }

  clear() {
    this.items.clear();
  }

  isEmpty() {
    return this.items.size === 0;
  }

  getUniqueCount() {
    return this.items.size;
  }

  setDiscount(rate) {
    if (typeof rate !== 'number' || rate < 0 || rate > 1) {
      throw new Error('Discount must be between 0 and 1');
    }
    this.discount = rate;
  }

  setTaxRate(rate) {
    if (typeof rate !== 'number' || rate < 0 || rate > 1) {
      throw new Error('Tax rate must be between 0 and 1');
    }
    this.taxRate = rate;
  }
}
