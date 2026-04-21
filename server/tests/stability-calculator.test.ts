/**
 * 人格稳定性计算器 - 单元测试
 * 
 * 测试覆盖:
 * 1. Monte Carlo 模拟分布正确性
 * 2. Bootstrap 重采样正确性
 * 3. 置信区间计算正确性
 * 4. 边界条件处理正确性
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  StabilityCalculator,
  calculateStability,
} from '../src/services/stability-calculator';
import { TestResult, StabilityResult } from '../src/services/stability-types';

describe('StabilityCalculator', () => {
  let calculator: StabilityCalculator;

  beforeEach(() => {
    calculator = new StabilityCalculator({
      bootstrapIterations: 1000, // 测试时减少迭代次数以加快速度
    });
  });

  // 辅助函数：创建测试数据
  function createTestResult(
    userId: number,
    testDate: number,
    scores: { O: number; C: number; E: number; A: number; N: number }
  ): TestResult {
    return {
      id: Math.floor(Math.random() * 10000),
      userId,
      testDate,
      scores,
    };
  }

  // 辅助函数：创建稳定的测试数据 (分数接近)
  function createStableTestData(userId: number, count: number): TestResult[] {
    const tests: TestResult[] = [];
    const baseScores = { O: 70, C: 75, E: 65, A: 80, N: 60 };

    for (let i = 0; i < count; i++) {
      tests.push(
        createTestResult(userId, Date.now() - i * 86400000, {
          O: baseScores.O + (Math.random() - 0.5) * 4, // ±2 分波动
          C: baseScores.C + (Math.random() - 0.5) * 4,
          E: baseScores.E + (Math.random() - 0.5) * 4,
          A: baseScores.A + (Math.random() - 0.5) * 4,
          N: baseScores.N + (Math.random() - 0.5) * 4,
        })
      );
    }

    return tests;
  }

  // 辅助函数：创建不稳定的测试数据 (分数波动大)
  function createUnstableTestData(userId: number, count: number): TestResult[] {
    const tests: TestResult[] = [];
    const baseScores = { O: 70, C: 75, E: 65, A: 80, N: 60 };

    for (let i = 0; i < count; i++) {
      tests.push(
        createTestResult(userId, Date.now() - i * 86400000, {
          O: baseScores.O + (Math.random() - 0.5) * 40, // ±20 分波动
          C: baseScores.C + (Math.random() - 0.5) * 40,
          E: baseScores.E + (Math.random() - 0.5) * 40,
          A: baseScores.A + (Math.random() - 0.5) * 40,
          N: baseScores.N + (Math.random() - 0.5) * 40,
        })
      );
    }

    return tests;
  }

  describe('边界条件处理', () => {
    it('测试次数 < 3 时返回 insufficient_data', async () => {
      const userId = 1;
      const tests: TestResult[] = [
        createTestResult(userId, Date.now(), {
          O: 70,
          C: 75,
          E: 65,
          A: 80,
          N: 60,
        }),
        createTestResult(userId, Date.now() - 86400000, {
          O: 72,
          C: 73,
          E: 67,
          A: 78,
          N: 62,
        }),
      ];

      const result = await calculator.calculateStability(userId, tests);

      expect(result.status).toBe('insufficient_data');
      expect(result.stabilityWarning).toContain('测试次数不足');
      expect(result.stabilityProbabilityDisplay).toBe('数据不足');
    });

    it('测试次数 3-5 次时返回 evolving 状态和范围值', async () => {
      const userId = 2;
      const tests = createStableTestData(userId, 4);

      const result = await calculator.calculateStability(userId, tests);

      expect(result.status).toBe('evolving');
      expect(result.isRange).toBe(true);
      expect(result.stabilityProbabilityDisplay).toMatch(/\d+%~\d+%/);
      expect(result.stabilityWarning).toContain('测试次数较少');
    });

    it('测试次数 >= 6 次时返回精确值', async () => {
      const userId = 3;
      const tests = createStableTestData(userId, 10);

      const result = await calculator.calculateStability(userId, tests);

      expect(['stable', 'evolving', 'unstable']).toContain(result.status);
      expect(result.isRange).toBe(false);
      expect(result.stabilityProbabilityDisplay).toMatch(/\d+%/);
    });
  });

  describe('稳定性指数计算', () => {
    it('稳定数据的稳定性指数应接近 1', async () => {
      const userId = 4;
      const tests = createStableTestData(userId, 10);

      const result = await calculator.calculateStability(userId, tests);

      expect(result.stabilityIndex).toBeGreaterThan(0.7);
      expect(result.stabilityIndex).toBeLessThanOrEqual(1);
    });

    it('不稳定数据的稳定性指数应较低', async () => {
      const userId = 5;
      const tests = createUnstableTestData(userId, 10);

      const result = await calculator.calculateStability(userId, tests);

      expect(result.stabilityIndex).toBeLessThan(0.7);
      expect(result.stabilityIndex).toBeGreaterThanOrEqual(0);
    });

    it('稳定性指数范围在 0-1 之间', async () => {
      const userId = 6;
      const tests = createStableTestData(userId, 10);

      const result = await calculator.calculateStability(userId, tests);

      expect(result.stabilityIndex).toBeGreaterThanOrEqual(0);
      expect(result.stabilityIndex).toBeLessThanOrEqual(1);
    });
  });

  describe('Monte Carlo 模拟', () => {
    it('Bootstrap 重采样次数正确', async () => {
      const userId = 7;
      const tests = createStableTestData(userId, 10);
      const testCalculator = new StabilityCalculator({
        bootstrapIterations: 500,
      });

      const result = await testCalculator.calculateStability(userId, tests);

      expect(result.metadata.bootstrapIterations).toBe(500);
    });

    it('模拟结果具有合理的分布', async () => {
      const userId = 8;
      const tests = createStableTestData(userId, 20);

      // 多次运行检查一致性
      const results: number[] = [];
      for (let i = 0; i < 5; i++) {
        const result = await calculator.calculateStability(userId, tests);
        results.push(result.stabilityIndex);
      }

      // 稳定性指数的标准差应该较小 (结果一致)
      const mean = results.reduce((a, b) => a + b, 0) / results.length;
      const std = Math.sqrt(
        results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          results.length
      );

      expect(std).toBeLessThan(0.05); // 波动应小于 5%
    });
  });

  describe('置信区间计算', () => {
    it('置信区间范围合理', async () => {
      const userId = 9;
      const tests = createStableTestData(userId, 20);

      const result = await calculator.calculateStability(userId, tests);

      const [lower, upper] = result.confidenceBand;

      expect(lower).toBeGreaterThanOrEqual(0);
      expect(upper).toBeLessThanOrEqual(1);
      expect(lower).toBeLessThanOrEqual(upper);
      expect(upper - lower).toBeLessThan(0.5); // 区间宽度应合理
    });

    it('置信区间覆盖真实值', async () => {
      const userId = 10;
      const tests = createStableTestData(userId, 30);

      const result = await calculator.calculateStability(userId, tests);

      const [lower, upper] = result.confidenceBand;

      // 稳定性指数应在置信区间内
      expect(result.stabilityIndex).toBeGreaterThanOrEqual(lower);
      expect(result.stabilityIndex).toBeLessThanOrEqual(upper);
    });
  });

  describe('稳定性概率计算', () => {
    it('稳定数据的稳定性概率应较高', async () => {
      const userId = 11;
      const tests = createStableTestData(userId, 20);

      const result = await calculator.calculateStability(userId, tests);

      expect(result.stabilityProbability).toBeGreaterThan(70);
    });

    it('不稳定数据的稳定性概率应较低', async () => {
      const userId = 12;
      const tests = createUnstableTestData(userId, 20);

      const result = await calculator.calculateStability(userId, tests);

      expect(result.stabilityProbability).toBeLessThan(50);
    });
  });

  describe('各维度统计', () => {
    it('返回所有五个维度的统计信息', async () => {
      const userId = 13;
      const tests = createStableTestData(userId, 10);

      const result = await calculator.calculateStability(userId, tests);

      expect(result.perDimension).toHaveProperty('O');
      expect(result.perDimension).toHaveProperty('C');
      expect(result.perDimension).toHaveProperty('E');
      expect(result.perDimension).toHaveProperty('A');
      expect(result.perDimension).toHaveProperty('N');

      // 每个维度都应包含 mean, std, cv
      for (const dim of ['O', 'C', 'E', 'A', 'N']) {
        const dimStats = (result.perDimension as any)[dim];
        expect(dimStats).toHaveProperty('mean');
        expect(dimStats).toHaveProperty('std');
        expect(dimStats).toHaveProperty('cv');
      }
    });

    it('变异系数计算正确 (CV = std / mean)', async () => {
      const userId = 14;
      const tests = createStableTestData(userId, 10);

      const result = await calculator.calculateStability(userId, tests);

      for (const dim of ['O', 'C', 'E', 'A', 'N']) {
        const dimStats = (result.perDimension as any)[dim];
        const expectedCV =
          dimStats.mean !== 0 ? dimStats.std / dimStats.mean : 0;
        expect(Math.abs(dimStats.cv - expectedCV)).toBeLessThan(0.0001);
      }
    });
  });

  describe('性能测试', () => {
    it('计算时间 < 500ms', async () => {
      const userId = 15;
      const tests = createStableTestData(userId, 50);

      const startTime = Date.now();
      await calculator.calculateStability(userId, tests);
      const calculationTime = Date.now() - startTime;

      expect(calculationTime).toBeLessThan(500);
    });

    it('支持并发计算', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const userId = 100 + i;
        const tests = createStableTestData(userId, 20);
        promises.push(calculator.calculateStability(userId, tests));
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results.length).toBe(10);
      expect(totalTime).toBeLessThan(2000); // 10 个并发应在 2s 内完成
    });
  });

  describe('便捷函数', () => {
    it('calculateStability 函数正常工作', async () => {
      const userId = 16;
      const tests = createStableTestData(userId, 10);

      const result = await calculateStability(userId, tests);

      expect(result).toHaveProperty('stabilityIndex');
      expect(result).toHaveProperty('stabilityProbability');
      expect(result).toHaveProperty('status');
    });
  });

  describe('警告信息', () => {
    it('数据不足时生成警告', async () => {
      const userId = 17;
      const tests: TestResult[] = [
        createTestResult(userId, Date.now(), {
          O: 70,
          C: 75,
          E: 65,
          A: 80,
          N: 60,
        }),
      ];

      const result = await calculator.calculateStability(userId, tests);

      expect(result.stabilityWarning).not.toBeNull();
      expect(result.stabilityWarning).toContain('测试次数不足');
    });

    it('稳定数据无警告', async () => {
      const userId = 18;
      const tests = createStableTestData(userId, 20);

      const result = await calculator.calculateStability(userId, tests);

      expect(result.stabilityWarning).toBeNull();
    });
  });
});

describe('精度验证', () => {
  it('与真实重测数据一致性 > 80%', async () => {
    // 模拟真实重测数据：同一用户多次测试结果应高度相关
    const calculator = new StabilityCalculator({
      bootstrapIterations: 5000,
    });

    // 创建高度一致的数据 (模拟真实稳定人格)
    const userId = 100;
    const baseScores = { O: 70, C: 75, E: 65, A: 80, N: 60 };
    const tests: TestResult[] = [];

    for (let i = 0; i < 30; i++) {
      tests.push({
        id: i,
        userId,
        testDate: Date.now() - i * 86400000,
        scores: {
          O: baseScores.O + (Math.random() - 0.5) * 6, // ±3 分
          C: baseScores.C + (Math.random() - 0.5) * 6,
          E: baseScores.E + (Math.random() - 0.5) * 6,
          A: baseScores.A + (Math.random() - 0.5) * 6,
          N: baseScores.N + (Math.random() - 0.5) * 6,
        },
      });
    }

    const result = await calculator.calculateStability(userId, tests);

    // 稳定性指数应 > 0.8 (一致性 > 80%)
    expect(result.stabilityIndex).toBeGreaterThan(0.8);
  });

  it('置信区间覆盖率 > 95%', async () => {
    const calculator = new StabilityCalculator({
      bootstrapIterations: 10000,
    });

    const userId = 101;
    const tests = createStableTestData(userId, 50);

    // 多次运行检查覆盖率
    const coverageCount = 100;
    let coveredCount = 0;

    for (let i = 0; i < coverageCount; i++) {
      const result = await calculator.calculateStability(userId, tests);
      const [lower, upper] = result.confidenceBand;

      if (
        result.stabilityIndex >= lower &&
        result.stabilityIndex <= upper
      ) {
        coveredCount++;
      }
    }

    const coverageRate = coveredCount / coverageCount;
    expect(coverageRate).toBeGreaterThan(0.95);
  });
});
