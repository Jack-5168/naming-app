// src/pipeline.js
/**
 * 管道模式 (Pipeline)
 * 支持链式数据转换，类似 Unix pipe
 */
export class Pipeline {
  constructor(initialValue) {
    this._value = initialValue;
    this._steps = [];
  }

  /**
   * 添加处理步骤
   */
  use(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('Pipeline step must be a function');
    }
    this._steps.push(fn);
    return this;
  }

  /**
   * 条件步骤：只有条件为 true 时才执行
   */
  useIf(condition, fn) {
    if (typeof condition === 'function' ? condition(this._value) : condition) {
      return this.use(fn);
    }
    return this;
  }

  /**
   * 执行管道
   */
  async run() {
    let result = this._value;

    for (const step of this._steps) {
      result = await step(result);
    }

    this._value = result;
    return result;
  }

  /**
   * 同步执行
   */
  runSync() {
    let result = this._value;

    for (const step of this._steps) {
      result = step(result);
    }

    this._value = result;
    return result;
  }

  /**
   * 重置管道值
   */
  reset(value) {
    this._value = value !== undefined ? value : this._value;
    return this;
  }

  /**
   * 获取当前值
   */
  value() {
    return this._value;
  }

  /**
   * 获取步骤数量
   */
  stepCount() {
    return this._steps.length;
  }

  /**
   * 清空步骤
   */
  clear() {
    this._steps = [];
    return this;
  }

  /**
   * 静态工厂方法
   */
  static create(value) {
    return new Pipeline(value);
  }
}
