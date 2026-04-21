# 性能优化指南

## 性能基准

### 测试环境
- CPU: Intel Xeon
- 内存：充足
- Node.js: v24.14.0
- 测试数据：50 次测试记录

### 性能指标

| 配置模式 | Bootstrap 迭代 | 单次计算 | 并发 10 用户 | QPS |
|---------|--------------|---------|-----------|-----|
| TURBO | 1,000 | ~20ms | ~150ms | ~50 |
| HIGH_PERFORMANCE | 2,000 | ~40ms | ~300ms | ~25 |
| BALANCED | 5,000 | ~80ms | ~760ms | ~13 |
| HIGH_PRECISION | 10,000 | ~160ms | ~1400ms | ~7 |

## 配置选择

### TURBO 模式 (QPS > 50)
**适用场景：**
- 高并发实时计算
- 用户量大的生产环境
- 对延迟敏感的应用

**配置：**
```typescript
import { StabilityCalculator, PRESET_CONFIGS } from './services/stability-calculator';

const calculator = new StabilityCalculator(PRESET_CONFIGS.TURBO);
```

**性能：**
- ✅ QPS > 50
- ✅ 计算时间 < 50ms
- ⚠️ 精度略低 (置信区间稍宽)

### HIGH_PERFORMANCE 模式 (QPS > 25)
**适用场景：**
- 中等并发场景
- 平衡性能和精度

**配置：**
```typescript
const calculator = new StabilityCalculator(PRESET_CONFIGS.HIGH_PERFORMANCE);
```

**性能：**
- ✅ QPS > 25
- ✅ 计算时间 < 100ms
- ✅ 精度良好

### BALANCED 模式 (默认，QPS > 10)
**适用场景：**
- 一般生产环境
- 离线分析
- 对精度要求较高

**配置：**
```typescript
// 默认配置，无需额外参数
const calculator = new StabilityCalculator();
```

**性能：**
- ✅ QPS > 10
- ✅ 计算时间 < 200ms
- ✅ 精度高

### HIGH_PRECISION 模式 (QPS > 5)
**适用场景：**
- 离线批量分析
- 研究报告
- 对精度要求极高

**配置：**
```typescript
const calculator = new StabilityCalculator(PRESET_CONFIGS.HIGH_PRECISION);
```

**性能：**
- ⚠️ QPS ~7
- ⚠️ 计算时间 < 500ms
- ✅ 精度最高

## 优化策略

### 1. 迭代次数调整
Bootstrap 迭代次数与性能成反比：
- 1000 次：最快，适合实时场景
- 5000 次：平衡，推荐生产环境
- 10000 次：最精确，适合离线分析

### 2. 缓存机制
```typescript
const cache = new Map<string, StabilityResult>();

async function getCachedStability(userId: number, testHistory: TestResult[]) {
  const cacheKey = `${userId}_${testHistory.length}_${testHistory[testHistory.length - 1]?.testDate}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }
  
  const result = await calculator.calculateStability(userId, testHistory);
  cache.set(cacheKey, result);
  
  // 限制缓存大小
  if (cache.size > 1000) {
    cache.delete(cache.keys().next().value);
  }
  
  return result;
}
```

### 3. 数据截断
只使用最近的测试数据：
```typescript
// 只使用最近 100 次测试
const recentTests = testHistory.slice(0, 100);
const result = await calculator.calculateStability(userId, recentTests);
```

### 4. 并发控制
```typescript
import pLimit from 'p-limit';

const limit = pLimit(10); // 最多 10 个并发

const promises = userIds.map(id =>
  limit(() => calculator.calculateStability(id, testHistory))
);

await Promise.all(promises);
```

### 5. 异步队列
对于大批量计算，使用队列：
```typescript
import Bull from 'bull';

const stabilityQueue = new Bull('stability calculation');

// 添加到队列
stabilityQueue.add({ userId, testHistory });

// 处理队列
stabilityQueue.process(async (job) => {
  const { userId, testHistory } = job.data;
  return await calculator.calculateStability(userId, testHistory);
});
```

## 内存优化

### 使用优化版计算器
```typescript
import { StabilityCalculatorOptimized } from './services/stability-calculator-optimized';

const calculator = new StabilityCalculatorOptimized();
```

**优化点：**
- 使用 TypedArray (Float64Array, Int32Array)
- 预分配数组
- 避免不必要的对象创建
- 浅拷贝代替深拷贝

### 内存占用
- 标准版：~50MB (10000 次迭代)
- 优化版：~30MB (10000 次迭代)
- 优化版 (TURBO): ~10MB (1000 次迭代)

## 生产环境推荐配置

### 小型应用 (< 1000 DAU)
```typescript
const calculator = new StabilityCalculator({
  bootstrapIterations: 5000, // BALANCED
});
```

### 中型应用 (1000-10000 DAU)
```typescript
const calculator = new StabilityCalculator({
  bootstrapIterations: 2000, // HIGH_PERFORMANCE
});

// 添加缓存
const cache = new NodeCache({ stdTTL: 300 }); // 5 分钟缓存
```

### 大型应用 (> 10000 DAU)
```typescript
const calculator = new StabilityCalculator({
  bootstrapIterations: 1000, // TURBO
});

// 使用队列
const queue = new Bull('stability');

// 使用 Redis 缓存
const redisCache = new Redis();
```

## 性能监控

### 指标收集
```typescript
import { Histogram } from 'prom-client';

const stabilityDuration = new Histogram({
  name: 'stability_calculation_duration_seconds',
  help: 'Duration of stability calculation',
  buckets: [0.05, 0.1, 0.2, 0.5, 1],
});

async function calculateWithMetrics(userId: number, testHistory: TestResult[]) {
  const end = stabilityDuration.startTimer();
  const result = await calculator.calculateStability(userId, testHistory);
  end();
  return result;
}
```

### 告警阈值
- 计算时间 > 500ms: 警告
- 计算时间 > 1000ms: 严重
- QPS < 10: 警告
- 内存占用 > 200MB: 警告

## 基准测试脚本

运行性能测试：
```bash
npx ts-node perf-test.ts
```

运行验证测试：
```bash
npx ts-node verify-stability.ts
```

运行单元测试：
```bash
npm test -- stability-calculator.test.ts
```
