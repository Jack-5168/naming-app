/**
 * 人格稳定性计算器 - 快速验证脚本
 * 
 * 用于演示和验证稳定性计算功能
 */

import { calculateStability } from './src/services/stability-calculator';
import { TestResult } from './src/services/stability-types';

// 辅助函数：创建测试数据
function createTestResult(
  userId: number,
  daysAgo: number,
  scores: { O: number; C: number; E: number; A: number; N: number }
): TestResult {
  return {
    id: Math.floor(Math.random() * 10000),
    userId,
    testDate: Date.now() - daysAgo * 86400000,
    scores,
  };
}

// 场景 1: 数据不足 (< 3 次)
console.log('=== 场景 1: 数据不足 ===');
async function testInsufficientData() {
  const tests: TestResult[] = [
    createTestResult(1, 7, { O: 70, C: 75, E: 65, A: 80, N: 60 }),
    createTestResult(1, 14, { O: 72, C: 73, E: 67, A: 78, N: 62 }),
  ];

  const result = await calculateStability(1, tests);
  
  console.log(`状态：${result.status}`);
  console.log(`警告：${result.stabilityWarning}`);
  console.log(`显示：${result.stabilityProbabilityDisplay}`);
  console.log('');
}

// 场景 2: 发展中 (3-5 次)
console.log('=== 场景 2: 发展中 (3-5 次测试) ===');
async function testEvolving() {
  const tests: TestResult[] = [
    createTestResult(2, 7, { O: 70, C: 75, E: 65, A: 80, N: 60 }),
    createTestResult(2, 14, { O: 72, C: 73, E: 67, A: 78, N: 62 }),
    createTestResult(2, 21, { O: 68, C: 76, E: 64, A: 81, N: 59 }),
    createTestResult(2, 28, { O: 71, C: 74, E: 66, A: 79, N: 61 }),
  ];

  const result = await calculateStability(2, tests);
  
  console.log(`状态：${result.status}`);
  console.log(`稳定性指数：${result.stabilityIndex.toFixed(3)}`);
  console.log(`稳定性概率：${result.stabilityProbabilityDisplay}`);
  console.log(`置信区间：[${result.confidenceBand[0].toFixed(3)}, ${result.confidenceBand[1].toFixed(3)}]`);
  console.log(`警告：${result.stabilityWarning}`);
  console.log('');
}

// 场景 3: 稳定人格 (10 次测试，分数接近)
console.log('=== 场景 3: 稳定人格 ===');
async function testStable() {
  const tests: TestResult[] = [];
  const baseScores = { O: 70, C: 75, E: 65, A: 80, N: 60 };
  
  for (let i = 0; i < 10; i++) {
    tests.push(createTestResult(3, i * 7, {
      O: baseScores.O + (Math.random() - 0.5) * 4, // ±2 分波动
      C: baseScores.C + (Math.random() - 0.5) * 4,
      E: baseScores.E + (Math.random() - 0.5) * 4,
      A: baseScores.A + (Math.random() - 0.5) * 4,
      N: baseScores.N + (Math.random() - 0.5) * 4,
    }));
  }

  const result = await calculateStability(3, tests);
  
  console.log(`状态：${result.status}`);
  console.log(`稳定性指数：${result.stabilityIndex.toFixed(3)}`);
  console.log(`稳定性概率：${result.stabilityProbabilityDisplay}`);
  console.log(`置信区间：[${result.confidenceBand[0].toFixed(3)}, ${result.confidenceBand[1].toFixed(3)}]`);
  console.log(`警告：${result.stabilityWarning || '无'}`);
  console.log(`计算时间：${result.metadata.calculationTime}ms`);
  
  console.log('\n各维度统计:');
  const dims = ['O', 'C', 'E', 'A', 'N'] as const;
  const dimNames = {
    O: '开放性 (Openness)',
    C: '尽责性 (Conscientiousness)',
    E: '外向性 (Extraversion)',
    A: '宜人性 (Agreeableness)',
    N: '神经质 (Neuroticism)',
  };
  
  for (const dim of dims) {
    const stats = result.perDimension[dim];
    console.log(`  ${dimNames[dim]}: 均值=${stats.mean.toFixed(1)}, 标准差=${stats.std.toFixed(2)}, CV=${stats.cv.toFixed(3)}`);
  }
  console.log('');
}

// 场景 4: 不稳定人格 (10 次测试，分数波动大)
console.log('=== 场景 4: 不稳定人格 ===');
async function testUnstable() {
  const tests: TestResult[] = [];
  const baseScores = { O: 70, C: 75, E: 65, A: 80, N: 60 };
  
  for (let i = 0; i < 10; i++) {
    tests.push(createTestResult(4, i * 7, {
      O: baseScores.O + (Math.random() - 0.5) * 40, // ±20 分波动
      C: baseScores.C + (Math.random() - 0.5) * 40,
      E: baseScores.E + (Math.random() - 0.5) * 40,
      A: baseScores.A + (Math.random() - 0.5) * 40,
      N: baseScores.N + (Math.random() - 0.5) * 40,
    }));
  }

  const result = await calculateStability(4, tests);
  
  console.log(`状态：${result.status}`);
  console.log(`稳定性指数：${result.stabilityIndex.toFixed(3)}`);
  console.log(`稳定性概率：${result.stabilityProbabilityDisplay}`);
  console.log(`置信区间：[${result.confidenceBand[0].toFixed(3)}, ${result.confidenceBand[1].toFixed(3)}]`);
  console.log(`警告：${result.stabilityWarning || '无'}`);
  console.log(`计算时间：${result.metadata.calculationTime}ms`);
  console.log('');
}

// 场景 5: 性能测试
console.log('=== 场景 5: 性能测试 ===');
async function testPerformance() {
  const tests: TestResult[] = [];
  const baseScores = { O: 70, C: 75, E: 65, A: 80, N: 60 };
  
  for (let i = 0; i < 50; i++) {
    tests.push(createTestResult(5, i, {
      O: baseScores.O + (Math.random() - 0.5) * 6,
      C: baseScores.C + (Math.random() - 0.5) * 6,
      E: baseScores.E + (Math.random() - 0.5) * 6,
      A: baseScores.A + (Math.random() - 0.5) * 6,
      N: baseScores.N + (Math.random() - 0.5) * 6,
    }));
  }

  const startTime = Date.now();
  const promises = [];
  
  // 并发测试：同时计算 10 个用户
  for (let i = 0; i < 10; i++) {
    promises.push(calculateStability(100 + i, tests));
  }
  
  await Promise.all(promises);
  const totalTime = Date.now() - startTime;
  
  console.log(`并发计算 10 个用户 (各 50 次测试): ${totalTime}ms`);
  console.log(`平均每个用户：${(totalTime / 10).toFixed(1)}ms`);
  console.log(`QPS: ${(10 / (totalTime / 1000)).toFixed(1)}`);
  console.log('');
}

// 运行所有测试
async function runAllTests() {
  try {
    await testInsufficientData();
    await testEvolving();
    await testStable();
    await testUnstable();
    await testPerformance();
    
    console.log('✅ 所有验证测试完成!');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

runAllTests();
