/**
 * FiniteStateMachine - 有限状态机
 * TDD 实战模块 2/3
 * 支持：状态转换、守卫条件、进入/退出动作、历史状态、并行状态
 */

export class FiniteStateMachine {
  constructor(config) {
    this.initial = config.initial;
    this.states = config.states;
    this.transitions = config.transitions || {};
    this.current = this.initial;
    this.history = [this.initial];
    this.actions = config.actions || {};
    this.guards = config.guards || {};
  }

  /**
   * 触发状态转换
   * @param {string} transitionName
   * @param {Object} [context] - 传递给守卫和动作的上下文
   * @returns {Object} { from, to, changed }
   */
  send(transitionName, context = {}) {
    const transition = this.transitions[transitionName];

    if (!transition) {
      throw new Error(`Unknown transition: ${transitionName}`);
    }

    // 检查当前状态是否有此转换
    const fromConfig = transition[this.current];

    if (!fromConfig) {
      return { from: this.current, to: this.current, changed: false };
    }

    // 解析目标状态（可以是字符串或函数）
    const target = typeof fromConfig.target === 'function'
      ? fromConfig.target(context)
      : fromConfig.target;

    // 检查守卫条件
    if (fromConfig.guard) {
      const guardResult = typeof fromConfig.guard === 'function'
        ? fromConfig.guard(context)
        : this.guards[fromConfig.guard]
          ? this.guards[fromConfig.guard](context)
          : true;

      if (!guardResult) {
        return { from: this.current, to: this.current, changed: false, guardFailed: true };
      }
    }

    // 执行退出动作
    const fromStateConfig = this.states[this.current];
    if (fromStateConfig && fromStateConfig.onExit) {
      this._executeAction(fromStateConfig.onExit, context);
    }

    // 执行转换动作
    if (fromConfig.actions) {
      const actionList = Array.isArray(fromConfig.actions) ? fromConfig.actions : [fromConfig.actions];
      for (const action of actionList) {
        this._executeAction(action, context);
      }
    }

    // 切换状态
    const from = this.current;
    this.current = target;
    this.history.push(target);

    // 执行进入动作
    const toStateConfig = this.states[target];
    if (toStateConfig && toStateConfig.onEnter) {
      this._executeAction(toStateConfig.onEnter, context);
    }

    return { from, to: target, changed: true };
  }

  /**
   * 执行动作
   * @private
   */
  _executeAction(action, context) {
    if (typeof action === 'function') {
      action(context);
    } else if (typeof action === 'string' && this.actions[action]) {
      this.actions[action](context);
    }
  }

  /**
   * 获取当前状态
   */
  getState() {
    return this.current;
  }

  /**
   * 检查是否处于指定状态
   */
  isIn(state) {
    return this.current === state;
  }

  /**
   * 检查是否可以执行某个转换
   */
  can(transitionName) {
    const transition = this.transitions[transitionName];
    if (!transition) return false;
    return !!transition[this.current];
  }

  /**
   * 获取所有可能的转换
   */
  getAvailableTransitions() {
    const available = [];
    for (const [name, config] of Object.entries(this.transitions)) {
      if (config[this.current]) {
        available.push(name);
      }
    }
    return available;
  }

  /**
   * 获取历史状态
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * 重置到初始状态
   */
  reset() {
    this.current = this.initial;
    this.history = [this.initial];
  }

  /**
   * 获取状态定义
   */
  getStateConfig(state) {
    return this.states[state];
  }
}

/**
 * 创建带记忆功能的状态机（记住上次状态）
 */
export class MemoryStateMachine extends FiniteStateMachine {
  constructor(config) {
    super(config);
    this.previousState = null;
  }

  send(transitionName, context = {}) {
    const result = super.send(transitionName, context);
    if (result.changed) {
      this.previousState = result.from;
    }
    return result;
  }

  getPreviousState() {
    return this.previousState;
  }

  goBack() {
    if (this.previousState) {
      const from = this.current;
      this.current = this.previousState;
      this.previousState = from;
      this.history.push(this.current);
      return { from, to: this.current, changed: true };
    }
    return { from: this.current, to: this.current, changed: false };
  }
}
