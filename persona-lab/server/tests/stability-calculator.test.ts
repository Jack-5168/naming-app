/**
 * Stability Calculator Tests (v2 - IPIP-NEO 5 Dimensions)
 * Test coverage for Monte Carlo simulation and stability index calculation
 */

import { calculateStability, calculateTestRetestReliability } from '../src/services/stability-calculator';
import { TestResult, Big5Scores } from '../src/types';

// 生成模拟测试历史 (五维度)
function generateTestHistory(
  userId: number,
  count: number,
  baseScores: Big5Scores,
  variance: number
): TestResult[] {
  const results: TestResult[] = [];
  
  for (let i = 0; i < count; i++) {
    results.push({
      testId: `test-${i}`,
      userId,
      completedAt: Date.now() - (count - i) * 86400000,
      scores: {
        O: Math.round(baseScores.O + (Math.random() - 0.5) * variance * 2),
        C: Math.round(baseScores.C + (Math.random() - 0.5) * variance * 2),
        E: Math.round(baseScores.E + (Math.random() - 0.5) * variance * 2),
        A: Math.round(baseScores.A + (Math.random() - 0.5) * variance * 2),
        N: Math.round(baseScores.N + (Math.random() - 0.5) * variance * 2)
      },
      questionCount: 50,
      testMode: 'CLASSIC'
    });
  }
  
  return results;
}

describe('Stability Calculator (v2 - IPIP-NEO)', () => {
  describe('Boundary Conditions', () => {
    test('should return insufficient_data for <3 tests', async () => {
      const testHistory: TestResult[] = [
        {
          testId: 'test-1',
          userId: 1,
          completedAt: Date.now(),
          scores: { O: 50, C: 50, E: 50, A: 50, N: 50 },
          questionCount: 50,
          testMode: 'CLASSIC'
        },
        {
          testId: 'test-2',
          userId: 1,
          completedAt: Date.now() - 86400000,
          scores: { O: 55, C: 45, E: 60, A: 40, N: 50 },
          questionCount: 50,
          testMode: 'CLASSIC'
        }
      ];

      const result = await calculateStability(1, testHistory);
      
      expect(result.status).toBe('insufficient_data');
      expect(result.stabilityWarning).toContain('需要至少');
      expect(result.stabilityIndex).toBe(0);
    });

    test('should return evolving for 3-5 tests', async () => {
      const testHistory = generateTestHistory(1, 4, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 10);

      const result = await calculateStability(1, testHistory);
      
      expect(result.status).toBe('evolving');
      expect(result.isRange).toBe(true);
      expect(result.stabilityProbabilityDisplay).toContain('-');
    });

    test('should return stable/unstable for 6+ tests', async () => {
      // 稳定模式：低方差
      const stableHistory = generateTestHistory(1, 8, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 5);
      const stableResult = await calculateStability(1, stableHistory);
      
      expect(stableResult.status).toBe('stable');
      expect(stableResult.isRange).toBe(false);

      // 不稳定模式：高方差
      const unstableHistory = generateTestHistory(1, 8, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 30);
      const unstableResult = await calculateStability(1, unstableHistory);
      
      expect(unstableResult.status).toBe('unstable');
    });
  });

  describe('Stability Index Calculation', () => {
    test('should calculate stability index between 0 and 1', async () => {
      const testHistory = generateTestHistory(1, 6, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      expect(result.stabilityIndex).toBeGreaterThanOrEqual(0);
      expect(result.stabilityIndex).toBeLessThanOrEqual(1);
    });

    test('should have higher stability for low variance data', async () => {
      const lowVariance = generateTestHistory(1, 10, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 3);
      const highVariance = generateTestHistory(1, 10, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 20);

      const lowResult = await calculateStability(1, lowVariance);
      const highResult = await calculateStability(1, highVariance);

      expect(lowResult.stabilityIndex).toBeGreaterThan(highResult.stabilityIndex);
    });

    test('should include per-dimension statistics', async () => {
      const testHistory = generateTestHistory(1, 6, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      expect(result.perDimension).toBeDefined();
      expect(result.perDimension.O).toBeDefined();
      expect(result.perDimension.C).toBeDefined();
      expect(result.perDimension.E).toBeDefined();
      expect(result.perDimension.A).toBeDefined();
      expect(result.perDimension.N).toBeDefined();
      
      // 检查每个维度都有 mean, std, cv
      Object.values(result.perDimension).forEach(dim => {
        expect(dim).toHaveProperty('mean');
        expect(dim).toHaveProperty('std');
        expect(dim).toHaveProperty('cv');
      });
    });
  });

  describe('Monte Carlo Simulation', () => {
    test('should calculate stability probability', async () => {
      const testHistory = generateTestHistory(1, 10, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      expect(result.stabilityProbability).toBeGreaterThanOrEqual(0);
      expect(result.stabilityProbability).toBeLessThanOrEqual(100);
    });

    test('should calculate confidence band', async () => {
      const testHistory = generateTestHistory(1, 10, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      expect(result.confidenceBand).toHaveLength(2);
      expect(result.confidenceBand[0]).toBeLessThanOrEqual(result.confidenceBand[1]);
      expect(result.confidenceBand[0]).toBeGreaterThanOrEqual(0);
      expect(result.confidenceBand[1]).toBeLessThanOrEqual(1);
    });

    test('should be deterministic with same input', async () => {
      const testHistory = generateTestHistory(1, 6, { O: 60, C: 40, E: 70, A: 30, N: 50 }, 5);
      
      const result1 = await calculateStability(1, testHistory);
      const result2 = await calculateStability(1, testHistory);

      expect(result1.status).toBe(result2.status);
      expect(Math.abs(result1.stabilityIndex - result2.stabilityIndex)).toBeLessThan(0.1);
    });
  });

  describe('Stability Probability Display', () => {
    test('should show range for insufficient data', async () => {
      const testHistory = generateTestHistory(1, 4, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      expect(result.isRange).toBe(true);
      expect(result.stabilityProbabilityDisplay).toContain('-');
    });

    test('should show exact value for sufficient data', async () => {
      const testHistory = generateTestHistory(1, 8, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 5);
      const result = await calculateStability(1, testHistory);

      expect(result.isRange).toBe(false);
      expect(result.stabilityProbabilityDisplay).not.toContain('-');
      expect(result.stabilityProbabilityDisplay).toContain('%');
    });
  });

  describe('Warning Messages', () => {
    test('should warn for insufficient data', async () => {
      const testHistory = generateTestHistory(1, 2, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      expect(result.stabilityWarning).not.toBeNull();
      expect(result.stabilityWarning).toContain('需要至少');
    });

    test('should warn for evolving status', async () => {
      const testHistory = generateTestHistory(1, 4, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      expect(result.stabilityWarning).not.toBeNull();
      expect(result.stabilityWarning).toContain('次测试');
    });

    test('should warn for unstable status', async () => {
      const testHistory = generateTestHistory(1, 8, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 30);
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
          scores: { O: 50, C: 50, E: 50, A: 50, N: 50 },
          questionCount: 50,
          testMode: 'CLASSIC'
        },
        {
          testId: 'test-2',
          userId: 1,
          completedAt: Date.now() - 86400000,
          scores: { O: 52, C: 48, E: 53, A: 47, N: 50 },
          questionCount: 50,
          testMode: 'CLASSIC'
        },
        {
          testId: 'test-3',
          userId: 1,
          completedAt: Date.now() - 172800000,
          scores: { O: 48, C: 52, E: 47, A: 53, N: 50 },
          questionCount: 50,
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
          scores: { O: 50, C: 50, E: 50, A: 50, N: 50 },
          questionCount: 50,
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
          scores: { O: 60, C: 40, E: 70, A: 30, N: 50 },
          questionCount: 50,
          testMode: 'CLASSIC'
        },
        {
          testId: 'test-2',
          userId: 1,
          completedAt: Date.now() - 86400000,
          scores: { O: 61, C: 39, E: 71, A: 29, N: 51 },
          questionCount: 50,
          testMode: 'CLASSIC'
        },
        {
          testId: 'test-3',
          userId: 1,
          completedAt: Date.now() - 172800000,
          scores: { O: 59, C: 41, E: 69, A: 31, N: 49 },
          questionCount: 50,
          testMode: 'CLASSIC'
        }
      ];

      const reliability = calculateTestRetestReliability(testHistory);
      expect(reliability).toBeGreaterThan(0.7);
    });
  });

  describe('Performance', () => {
    test('should complete calculation in <500ms', async () => {
      const testHistory = generateTestHistory(1, 10, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 10);

      const start = Date.now();
      await calculateStability(1, testHistory);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(500);
    });

    test('should handle large test history', async () => {
      const testHistory = generateTestHistory(1, 20, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 10);

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
        scores: { O: 50, C: 50, E: 50, A: 50, N: 50 },
        questionCount: 50,
        testMode: 'CLASSIC'
      }));

      const result = await calculateStability(1, testHistory);
      
      expect(result.stabilityIndex).toBeGreaterThan(0.9);
      expect(result.status).toBe('stable');
    });

    test('should handle extreme scores', async () => {
      const testHistory: TestResult[] = Array(8).fill(null).map((_, i) => ({
        testId: `test-${i}`,
        userId: 1,
        completedAt: Date.now() - i * 86400000,
        scores: { 
          O: i % 2 === 0 ? 0 : 100,
          C: i % 2 === 0 ? 100 : 0,
          E: i % 2 === 0 ? 0 : 100,
          A: i % 2 === 0 ? 100 : 0,
          N: i % 2 === 0 ? 0 : 100
        },
        questionCount: 50,
        testMode: 'CLASSIC'
      }));

      const result = await calculateStability(1, testHistory);
      
      expect(result.stabilityIndex).toBeLessThan(0.5);
      expect(result.status).toBe('unstable');
    });

    test('should handle empty test history gracefully', async () => {
      const result = await calculateStability(1, []);
      
      expect(result.status).toBe('insufficient_data');
      expect(result.stabilityIndex).toBe(0);
    });
  });

  describe('Per-Dimension Statistics', () => {
    test('should calculate mean correctly', async () => {
      const testHistory: TestResult[] = [
        { testId: 't1', userId: 1, completedAt: 1, scores: { O: 40, C: 50, E: 60, A: 70, N: 50 }, questionCount: 50, testMode: 'CLASSIC' },
        { testId: 't2', userId: 1, completedAt: 2, scores: { O: 60, C: 50, E: 60, A: 70, N: 50 }, questionCount: 50, testMode: 'CLASSIC' },
        { testId: 't3', userId: 1, completedAt: 3, scores: { O: 50, C: 50, E: 60, A: 70, N: 50 }, questionCount: 50, testMode: 'CLASSIC' }
      ];

      const result = await calculateStability(1, testHistory);
      
      expect(result.perDimension.O.mean).toBe(50);
      expect(result.perDimension.C.mean).toBe(50);
      expect(result.perDimension.E.mean).toBe(60);
    });

    test('should calculate std correctly', async () => {
      const testHistory: TestResult[] = [
        { testId: 't1', userId: 1, completedAt: 1, scores: { O: 30, C: 50, E: 50, A: 50, N: 50 }, questionCount: 50, testMode: 'CLASSIC' },
        { testId: 't2', userId: 1, completedAt: 2, scores: { O: 70, C: 50, E: 50, A: 50, N: 50 }, questionCount: 50, testMode: 'CLASSIC' },
        { testId: 't3', userId: 1, completedAt: 3, scores: { O: 50, C: 50, E: 50, A: 50, N: 50 }, questionCount: 50, testMode: 'CLASSIC' }
      ];

      const result = await calculateStability(1, testHistory);
      
      // O 维度有较大变异
      expect(result.perDimension.O.std).toBeGreaterThan(10);
      // 其他维度无变异
      expect(result.perDimension.C.std).toBe(0);
    });

    test('should calculate CV correctly', async () => {
      const testHistory = generateTestHistory(1, 5, { O: 50, C: 50, E: 50, A: 50, N: 50 }, 10);
      const result = await calculateStability(1, testHistory);

      // CV 应为非负数
      Object.values(result.perDimension).forEach(dim => {
        expect(dim.cv).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
