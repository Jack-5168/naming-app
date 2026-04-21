/**
 * 性能对比测试：标准版 vs 优化版
 */

import { StabilityCalculator } from './src/services/stability-calculator';
import { StabilityCalculatorOptimized } from './src/services/stability-calculator-optimized';
import { TestResult } from './src/services/stability-types';

function createTestData(count: number): TestResult[] {
  const tests: TestResult[] = [];
  const baseScores = { O: 70, C: 75, E: 65, A: 80, N: 60 };
  
  for (let i = 0; i < count; i++) {
    tests.push({
      id: i,
      userId: 1,
      testDate: Date.now() - i * 86400000,
      scores: {
        O: baseScores.O + (Math.random() - 0.5) * 6,
        C: baseScores.C + (Math.random() - 0.5) * 6,
        E: baseScores.E + (Math.random() - 0.5) * 6,
        A: baseScores.A + (Math.random() - 0.5) * 6,
        N: baseScores.N + (Math.random() - 0.5) * 6,
      },
    });
  }
  
  return tests;
}

async function benchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = 10
) {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await fn();
    times.push(Date.now() - start);
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / iterations;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  console.log(`${name}:`);
  console.log(`  平均：${avg.toFixed(1)}ms`);
  console.log(`  最小：${min}ms`);
  console.log(`  最大：${max}ms`);
  console.log(`  QPS: ${(1000 / avg).toFixed(1)}`);
  console.log('');
  
  return { avg, min, max };
}

async function runPerfTest() {
  console.log('=== 性能对比测试 ===\n');
  
  const testData = createTestData(50);
  const standard = new StabilityCalculator({ bootstrapIterations: 10000 });
  const optimized = new StabilityCalculatorOptimized({ bootstrapIterations: 10000 });
  
  console.log('测试配置：50 次测试，10000 次 Bootstrap 迭代\n');
  
  // 标准版
  const standardResult = await benchmark(
    '标准版 (单次)',
    async () => {
      await standard.calculateStability(1, testData);
    }
  );
  
  // 优化版
  const optimizedResult = await benchmark(
    '优化版 (单次)',
    async () => {
      await optimized.calculateStability(1, testData);
    }
  );
  
  console.log('=== 并发测试 (10 个用户同时计算) ===\n');
  
  // 标准版并发
  const standardConcurrent = await benchmark(
    '标准版 (并发 10)',
    async () => {
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          standard.calculateStability(i + 1, testData)
        )
      );
    }
  );
  
  // 优化版并发
  const optimizedConcurrent = await benchmark(
    '优化版 (并发 10)',
    async () => {
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          optimized.calculateStability(i + 1, testData)
        )
      );
    }
  );
  
  // 性能提升
  const improvement = ((standardResult.avg - optimizedResult.avg) / standardResult.avg * 100);
  console.log('=== 性能提升 ===');
  console.log(`单次计算：${improvement.toFixed(1)}% 提升`);
  
  const concurrentImprovement = ((standardConcurrent.avg - optimizedConcurrent.avg) / standardConcurrent.avg * 100);
  console.log(`并发计算：${concurrentImprovement.toFixed(1)}% 提升`);
  
  console.log('\n✅ 性能测试完成!');
}

runPerfTest().catch(console.error);
