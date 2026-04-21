/**
 * 成本控制模块测试
 */

import {
  COST_CONTROL,
  recordUsage,
  getBudgetStatus,
  isWithinBudget,
  getModelStrategy,
  getFallbackModel,
  getMaxRetries,
  cleanupOldRecords,
  exportUsageRecords,
  costEvents
} from '../src/services/cost-control';

describe('CostControl', () => {
  beforeEach(() => {
    // 重置状态（实际测试中需要清理 usageRecords）
    jest.clearAllMocks();
  });

  describe('配置常量', () => {
    it('应该有正确的预算配置', () => {
      expect(COST_CONTROL.budget.dailyLimit).toBe(100);
      expect(COST_CONTROL.budget.monthlyLimit).toBe(2000);
      expect(COST_CONTROL.budget.alertThreshold).toBe(0.8);
    });

    it('应该有正确的模型策略', () => {
      expect(COST_CONTROL.modelStrategy.basic_report).toEqual({
        model: 'gpt-4o-mini',
        maxTokens: 1500
      });
      expect(COST_CONTROL.modelStrategy.pro_report).toEqual({
        model: 'gpt-4o-mini',
        maxTokens: 3500
      });
      expect(COST_CONTROL.modelStrategy.master_report).toEqual({
        model: 'gpt-4o-mini',
        maxTokens: 5000
      });
    });

    it('应该有正确的降级配置', () => {
      expect(COST_CONTROL.fallback.enabled).toBe(true);
      expect(COST_CONTROL.fallback.maxRetries).toBe(2);
      expect(COST_CONTROL.fallback.fallbackModel).toBe('claude-haiku');
    });
  });

  describe('getModelStrategy', () => {
    it('应该返回基础报告策略', () => {
      const strategy = getModelStrategy('basic');
      expect(strategy.model).toBe('gpt-4o-mini');
      expect(strategy.maxTokens).toBe(1500);
    });

    it('应该返回专业报告策略', () => {
      const strategy = getModelStrategy('pro');
      expect(strategy.model).toBe('gpt-4o-mini');
      expect(strategy.maxTokens).toBe(3500);
    });

    it('应该返回大师报告策略', () => {
      const strategy = getModelStrategy('master');
      expect(strategy.model).toBe('gpt-4o-mini');
      expect(strategy.maxTokens).toBe(5000);
    });

    it('未知类型应该返回默认策略', () => {
      const strategy = getModelStrategy('unknown');
      expect(strategy.model).toBe('gpt-4o-mini');
      expect(strategy.maxTokens).toBe(1500);
    });
  });

  describe('getFallbackModel', () => {
    it('应该返回降级模型', () => {
      const fallback = getFallbackModel();
      expect(fallback).toBe('claude-haiku');
    });
  });

  describe('getMaxRetries', () => {
    it('应该返回最大重试次数', () => {
      const retries = getMaxRetries();
      expect(retries).toBe(2);
    });
  });

  describe('getBudgetStatus', () => {
    it('初始状态应该为零', () => {
      const status = getBudgetStatus();
      expect(status.dailyUsed).toBe(0);
      expect(status.monthlyUsed).toBe(0);
      expect(status.dailyRemaining).toBe(100);
      expect(status.monthlyRemaining).toBe(2000);
      expect(status.dailyPercentage).toBe(0);
      expect(status.monthlyPercentage).toBe(0);
      expect(status.isAlertTriggered).toBe(false);
    });

    it('应该正确计算使用量', () => {
      // 记录一些使用
      recordUsage({
        timestamp: Date.now(),
        cost: 0.05,
        model: 'gpt-4o-mini',
        reportType: 'basic',
        userId: 'test-user'
      });

      const status = getBudgetStatus();
      expect(status.dailyUsed).toBeGreaterThan(0);
      expect(status.dailyRemaining).toBeLessThan(100);
    });
  });

  describe('isWithinBudget', () => {
    it('小额度应该在预算内', () => {
      const within = isWithinBudget(0.1);
      expect(within).toBe(true);
    });

    it('超出剩余额度应该返回 false', () => {
      // 这个测试依赖于当前预算状态
      const status = getBudgetStatus();
      const overAmount = status.dailyRemaining + 1;
      const within = isWithinBudget(overAmount);
      expect(within).toBe(false);
    });
  });

  describe('recordUsage', () => {
    it('应该触发预算告警事件', (done) => {
      const alertHandler = (data: any) => {
        expect(data.type).toBeDefined();
        expect(data.percentage).toBeDefined();
        done();
      };

      costEvents.once('budgetAlert', alertHandler);

      // 记录大量使用以触发告警
      for (let i = 0; i < 100; i++) {
        recordUsage({
          timestamp: Date.now(),
          cost: 1,
          model: 'gpt-4o-mini',
          reportType: 'basic',
          userId: 'test-user'
        });
      }
    });
  });

  describe('exportUsageRecords', () => {
    it('应该导出使用记录', () => {
      const records = exportUsageRecords();
      expect(Array.isArray(records)).toBe(true);
    });

    it('应该支持日期范围过滤', () => {
      const now = Date.now();
      const yesterday = now - 24 * 60 * 60 * 1000;
      
      const records = exportUsageRecords(yesterday, now);
      expect(Array.isArray(records)).toBe(true);
    });
  });

  describe('cleanupOldRecords', () => {
    it('应该清理 30 天前的记录', () => {
      // 这个测试主要验证函数不会抛出错误
      expect(() => cleanupOldRecords()).not.toThrow();
    });
  });
});
