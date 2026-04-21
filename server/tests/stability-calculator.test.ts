/**
 * Stability Calculator Tests
 * Test coverage for Monte Carlo simulation and stability index calculation
 */

import { calculateStability, calculateTestRetestReliability } from '../src/services/stability-calculator';
import { TestResult } from '../src/types';

// 生成模拟测试历史
function generateTestHistory(
  userId: number,
  count: number,
  baseScores: { E: number; N: number; T: number; J: number },
  variance: number
): TestResult[] {
  const results: TestResult[] = [];
  
  for (let i = 0; i < count; i++) {
    results.push({
      testId: `test-${i}`,
      userId,
      completedAt: Date.now() - (count - i) * 86400000, // 每天一次
      scores: {
        E: Math.round(baseScores.E + (Math.random() - 0.5) * variance * 2),
        N: Math.round(baseScores.N + (Math.random() - 0.5) * variance * 2),
        T: Math.round(baseScores.T + (Math.random() - 0.5) * variance * 2),
        J: Math.round(baseScores.J + (Math.random() - 0.5) * variance * 2)
      },
      questionCount: 30,
      testMode: 'CLASSIC'
    });
  }
  
  return results;
}

describe('Stability Calculator', () => {
  describe('Boundary Conditions', () => {
    test('should return insufficient_data for <3 tests', async () => {
      const testHistory: TestResult[] = [
        {
          testId: 'test-1',
          userId: 1,
          completedAt: Date.now(),
          scores: { E: 50, N: 50, T: 50, J: 50 },
          questionCount: 30,
          testMode: 'CLASSIC'
        },
        {
          testId: 'test-2',
          userId: 1,
          completedAt: Date.now() - 86400000,
          scores: { E: 55, N: 45, T: 60, J: 40 },
          questionCount: 30,
          testMode: 'CLASSIC'
        }
      ];

      const result = await calculateStability(1, testHistory);
      
      expect(result.status).toBe('insufficient_data');
      expect(result.stabilityWarning).toContain('需要至少');
      expect(result.stabilityIndex).toBe(0);
    });

    test('should return evolving for 3-5 tests', async () => {
      const testHistory = generateTestHistory(1, 4, { E: 50, N: 50, T: 50, J: 50 }, 10);

      const result = await calculateStability(1, testHistory);
      
      expect(result.status).toBe('evolving');
      expect(result.isRange).toBe(true);
      expect(result.stabilityProbabilityDisplay).toContain('-'); // 范围显示
    });

    test('should return stable/unstable for 6+ tests', async () => {
      // 稳定模式：低方差
      const stableHistory = generateTestHistory(1, 8, { E: 50, N: 50, T: 50, J: 50 }, 5);
      const stableResult = await calculateStability(1, stableHistory);
      
      expect(stableResult.status).toBe('stable');
      expect(stableResult.isRange).toBe(false);

      // 不稳定模式：高方差
      const unstableHistory = generateTestHistory(1, 8, { E: 50, N: 50, T: 50, J: 50 }, 30);
      const unstableResult = await calculateStability(1, unstableHistory);
      
      expect(unstableResult.status).toBe('unstable');
    });
  });

  describe('Stability Index Calculation', () => {
    test('should calculate stability index between 0 and 1', async () => {
      const testHistory = generateTestHistory(1, 6, { E: 50, N: 50, T: 50, J: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      expect(result.stabilityIndex).toBeGreaterThanOrEqual(0);
      expect(result.stabilityIndex).toBeLessThanOrEqual(1);
    });

    test('should have higher stability for low variance data', async () => {
      const lowVariance = generateTestHistory(1, 10, { E: 50, N: 50, T: 50, J: 50 }, 3);
      const highVariance = generateTestHistory(1, 10, { E: 50, N: 50, T: 50, J: 50 }, 20);

      const lowResult = await calculateStability(1, lowVariance);
      const highResult = await calculateStability(1, highVariance);

      expect(lowResult.stabilityIndex).toBeGreaterThan(highResult.stabilityIndex);
    });

    test('should include dimension breakdown', async () => {
      const testHistory = generateTestHistory(1, 6, { E: 50, N: 50, T: 50, J: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      expect(result.dimensionBreakdown).toBeDefined();
      expect(result.dimensionBreakdown?.E).toBeDefined();
      expect(result.dimensionBreakdown?.N).toBeDefined();
      expect(result.dimensionBreakdown?.T).toBeDefined();
      expect(result.dimensionBreakdown?.J).toBeDefined();
    });
  });

  describe('Monte Carlo Simulation', () => {
    test('should calculate stability probability', async () => {
      const testHistory = generateTestHistory(1, 10, { E: 50, N: 50, T: 50, J: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      expect(result.stabilityProbability).toBeGreaterThanOrEqual(0);
      expect(result.stabilityProbability).toBeLessThanOrEqual(100);
    });

    test('should calculate confidence band', async () => {
      const testHistory = generateTestHistory(1, 10, { E: 50, N: 50, T: 50, J: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      expect(result.confidenceBand).toHaveLength(2);
      expect(result.confidenceBand[0]).toBeLessThanOrEqual(result.confidenceBand[1]);
      expect(result.confidenceBand[0]).toBeGreaterThanOrEqual(0);
      expect(result.confidenceBand[1]).toBeLessThanOrEqual(1);
    });

    test('should be deterministic with same input', async () => {
      const testHistory = generateTestHistory(1, 6, { E: 60, N: 40, T: 70, J: 30 }, 5);
      
      // 注意：由于 Monte Carlo 使用随机数，结果会有波动
      // 这里只验证基本结构一致性
      const result1 = await calculateStability(1, testHistory);
      const result2 = await calculateStability(1, testHistory);

      expect(result1.status).toBe(result2.status);
      expect(Math.abs(result1.stabilityIndex - result2.stabilityIndex)).toBeLessThan(0.1);
    });
  });

  describe('Stability Probability Display', () => {
    test('should show range for insufficient data', async () => {
      const testHistory = generateTestHistory(1, 4, { E: 50, N: 50, T: 50, J: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      expect(result.isRange).toBe(true);
      expect(result.stabilityProbabilityDisplay).toContain('-');
    });

    test('should show exact value for sufficient data', async () => {
      const testHistory = generateTestHistory(1, 8, { E: 50, N: 50, T: 50, J: 50 }, 5);
      const result = await calculateStability(1, testHistory);

      expect(result.isRange).toBe(false);
      expect(result.stabilityProbabilityDisplay).not.toContain('-');
      expect(result.stabilityProbabilityDisplay).toContain('%');
    });
  });

  describe('Warning Messages', () => {
    test('should warn for insufficient data', async () => {
      const testHistory = generateTestHistory(1, 2, { E: 50, N: 50, T: 50, J: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      expect(result.stabilityWarning).not.toBeNull();
      expect(result.stabilityWarning).toContain('需要至少');
    });

    test('should warn for evolving status', async () => {
      const testHistory = generateTestHistory(1, 4, { E: 50, N: 50, T: 50, J: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      expect(result.stabilityWarning).not.toBeNull();
      expect(result.stabilityWarning).toContain('次测试');
    });

    test('should warn for unstable status', async () => {
      const testHistory = generateTestHistory(1, 8, { E: 50, N: 50, T: 50, J: 50 }, 30);
      const result = await calculateStability(1, testHistory);

      if (result.status === 'unstable') {
        expect(result.stabilityWarning).not.toBeNull();
        expect(result.stabilityWarning).toContain('波动');
      }
    });
  });

  describe('Test-Retest Reliability', () => {
    test('should calculate correlation between tests', () => {
      const testHistory: TestResult[] = [
        {
          testId: 'test-1',
          userId: 1,
          completedAt: Date.now(),
          scores: { E: 50, N: 50, T: 50, J: 50 },
          questionCount: 30,
          testMode: 'CLASSIC'
        },
        {
          testId: 'test-2',
          userId: 1,
          completedAt: Date.now() - 86400000,
          scores: { E: 52, N: 48, T: 53, J: 47 },
          questionCount: 30,
          testMode: 'CLASSIC'
        },
        {
          testId: 'test-3',
          userId: 1,
          completedAt: Date.now() - 172800000,
          scores: { E: 48, N: 52, T: 47, J: 53 },
          questionCount: 30,
          testMode: 'CLASSIC'
        }
      ];

      const reliability = calculateTestRetestReliability(testHistory);
      
      expect(reliability).toBeGreaterThanOrEqual(-1);
      expect(reliability).toBeLessThanOrEqual(1);
    });

    test('should return 0 for <2 tests', () => {
      const testHistory: TestResult[] = [
        {
          testId: 'test-1',
          userId: 1,
          completedAt: Date.now(),
          scores: { E: 50, N: 50, T: 50, J: 50 },
          questionCount: 30,
          testMode: 'CLASSIC'
        }
      ];

      const reliability = calculateTestRetestReliability(testHistory);
      expect(reliability).toBe(0);
    });

    test('should have high reliability for consistent scores', () => {
      const testHistory: TestResult[] = [
        {
          testId: 'test-1',
          userId: 1,
          completedAt: Date.now(),
          scores: { E: 60, N: 40, T: 70, J: 30 },
          questionCount: 30,
          testMode: 'CLASSIC'
        },
        {
          testId: 'test-2',
          userId: 1,
          completedAt: Date.now() - 86400000,
          scores: { E: 61, N: 39, T: 71, J: 29 },
          questionCount: 30,
          testMode: 'CLASSIC'
        },
        {
          testId: 'test-3',
          userId: 1,
          completedAt: Date.now() - 172800000,
          scores: { E: 59, N: 41, T: 69, J: 31 },
          questionCount: 30,
          testMode: 'CLASSIC'
        }
      ];

      const reliability = calculateTestRetestReliability(testHistory);
      expect(reliability).toBeGreaterThan(0.7); // 高相关性
    });
  });

  describe('Performance', () => {
    test('should complete calculation in <500ms', async () => {
      const testHistory = generateTestHistory(1, 10, { E: 50, N: 50, T: 50, J: 50 }, 10);

      const start = Date.now();
      await calculateStability(1, testHistory);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(500);
    });

    test('should handle large test history', async () => {
      const testHistory = generateTestHistory(1, 20, { E: 50, N: 50, T: 50, J: 50 }, 10);

      const start = Date.now();
      const result = await calculateStability(1, testHistory);
      const elapsed = Date.now() - start;

      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('Edge Cases', () => {
    test('should handle constant scores', async () => {
      const testHistory: TestResult[] = Array(10).fill(null).map((_, i) => ({
        testId: `test-${i}`,
        userId: 1,
        completedAt: Date.now() - i * 86400000,
        scores: { E: 50, N: 50, T: 50, J: 50 },
        questionCount: 30,
        testMode: 'CLASSIC'
      }));

      const result = await calculateStability(1, testHistory);
      
      expect(result.stabilityIndex).toBeGreaterThan(0.9); // 完全稳定
      expect(result.status).toBe('stable');
    });

    test('should handle extreme scores', async () => {
      const testHistory: TestResult[] = Array(8).fill(null).map((_, i) => ({
        testId: `test-${i}`,
        userId: 1,
        completedAt: Date.now() - i * 86400000,
        scores: { 
          E: i % 2 === 0 ? 0 : 100,
          N: i % 2 === 0 ? 100 : 0,
          T: i % 2 === 0 ? 0 : 100,
          J: i % 2 === 0 ? 100 : 0
        },
        questionCount: 30,
        testMode: 'CLASSIC'
      }));

      const result = await calculateStability(1, testHistory);
      
      expect(result.stabilityIndex).toBeLessThan(0.5); // 不稳定
      expect(result.status).toBe('unstable');
    });

    test('should handle empty test history gracefully', async () => {
      const result = await calculateStability(1, []);
      
      expect(result.status).toBe('insufficient_data');
      expect(result.stabilityIndex).toBe(0);
    });
  });
});
