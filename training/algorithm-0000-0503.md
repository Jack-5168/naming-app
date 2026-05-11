# 专项训练 00:00 — 算法与数据结构 (2026-05-03)

**重点：** 数组 / 字符串 / 哈希表
**配置：** 3 道简单 + 2 道中等
**语言：** TypeScript

---

## 📋 题目列表（全新选题，无重复）

| # | 难度 | 题目 | 核心考点 | 对应 LC |
|---|------|------|---------|---------|
| 1 | 🟢 简单 | 有序数组的两数之和 (Two Sum II) | 双指针 | #167 |
| 2 | 🟢 简单 | 股票最大利润 (Best Time to Buy and Sell Stock) | 一次遍历 + 维护最小值 | #121 |
| 3 | 🟢 简单 | 存在重复元素 (Contains Duplicate) | 哈希表 / Set 去重 | #217 |
| 4 | 🟡 中等 | 最长连续序列 (Longest Consecutive Sequence) | 哈希集合 + 智能遍历 | #128 |
| 5 | 🟡 中等 | 除自身以外数组的乘积 (Product of Array Except Self) | 前缀积 + 后缀积 | #238 |

> 与往期不重复：04-29 覆盖了 Two Sum / 括号 / 前缀 / 3Sum / 异位词分组；05-01 覆盖了 Two Sum / 字母异位词 / 前缀 / 无重复最长子串 / 异位词分组。本次 5 题全部为新题。

---

## 🟢 简单题 1 — 有序数组的两数之和 (Two Sum II)

**LeetCode 167** | 数组 + 双指针

### 题目

给定**已排序**的整数数组 `numbers` 和目标值 `target`，找出两个和为 `target` 的数的索引（索引从 1 开始）。

```
输入: numbers = [2,7,11,15], target = 9
输出: [1,2]

输入: numbers = [2,3,4], target = 6
输出: [1,3]
```

### 思路

数组已排序 → 用**双指针**从两端向中间逼近，无需哈希表。

- `sum < target` → 左指针右移（和太小）
- `sum > target` → 右指针左移（和太大）
- `sum === target` → 找到答案

- 时间：O(n) — 双指针各遍历一次
- 空间：O(1) — 仅两个指针

### 代码

```typescript
function twoSumII(numbers: number[], target: number): number[] {
  let left = 0;
  let right = numbers.length - 1;

  while (left < right) {
    const sum = numbers[left] + numbers[right];

    if (sum === target) {
      return [left + 1, right + 1]; // 1-based
    } else if (sum < target) {
      left++;
    } else {
      right--;
    }
  }

  return []; // 题目保证有解
}
```

### 关键点

- **排序是核心前提** — 未排序数组无法用双指针
- **对比哈希表法** — 哈希表 O(n) 时间 + O(n) 空间；双指针 O(n) 时间 + O(1) 空间
- **1-based 索引** — 题目要求，别漏了 +1
- **扩展思考** — 如果数组未排序但要求 O(n) 空间，先排序 O(n log n) 再用双指针

### 自测
1. `numbers = [-1, 0], target = -1` → `[1,2]`
2. `numbers = [0,0,3,4], target = 0` → `[1,2]`

---

## 🟢 简单题 2 — 股票最大利润 (Best Time to Buy and Sell Stock)

**LeetCode 121** | 数组 + 一次遍历

### 题目

给定每天股票价格 `prices`，你只能**买入一次、卖出一次**，求最大利润。

```
输入: prices = [7,1,5,3,6,4]
输出: 5
解释: 第 2 天买入 (1)，第 5 天卖出 (6)，利润 = 5

输入: prices = [7,6,4,3,1]
输出: 0
解释: 价格持续下跌，不交易
```

### 思路

遍历时维护两个变量：
- `minPrice` — 到目前为止的最低价格（最佳买入点）
- `maxProfit` — 到目前为止的最大利润

对每一天：用当天价格减去 `minPrice` 得到"今天卖出"的利润，更新 `maxProfit`。

- 时间：O(n) — 一次遍历
- 空间：O(1) — 两个变量

### 代码

```typescript
function maxProfit(prices: number[]): number {
  let minPrice = Infinity;
  let maxProfit = 0;

  for (const price of prices) {
    if (price < minPrice) {
      minPrice = price; // 更新最低买入价
    } else if (price - minPrice > maxProfit) {
      maxProfit = price - minPrice; // 更新最大利润
    }
  }

  return maxProfit;
}
```

### 关键点

- **贪心思维** — 每天都考虑"如果今天卖出能赚多少"
- **买入必须在卖出之前** — 这是本题核心约束
- **和动态规划的关系** — 这是 DP 的空间优化版，`dp[i] = max(dp[i-1], price[i] - minPrice)`
- **扩展** — 如果允许多次交易（LeetCode 122），答案是所有上涨日期的利润之和

### 自测
1. `prices = [1,2,3,4,5]` → `4`（第 1 天买，第 5 天卖）
2. `prices = [3,3,3,3]` → `0`（价格不变）

---

## 🟢 简单题 3 — 存在重复元素 (Contains Duplicate)

**LeetCode 217** | 数组 + 哈希表 / Set

### 题目

给定整数数组，如果任何值出现**至少两次**，返回 `true`；如果每个元素都不同，返回 `false`。

```
输入: [1,2,3,1]    输出: true
输入: [1,2,3,4]    输出: false
输入: [1,1,1,3,3,4,3,2,4,2]  输出: true
```

### 思路

**方法一：Set** — 将数组转为 Set，比较长度。如果去重后长度变短，说明有重复。

**方法二：哈希表遍历** — 遍历过程中检查元素是否已存在，存在则立即返回 true（可提前退出）。

- 方法一时间：O(n) | 空间：O(n) — 需要构建完整 Set
- 方法二时间：O(n) 最好 O(1) | 空间：O(n) — 可提前退出

### 代码

```typescript
// 方法一：Set（简洁）
function containsDuplicateSet(nums: number[]): boolean {
  return new Set(nums).size !== nums.length;
}

// 方法二：哈希表遍历（可提前退出，大数据更优）
function containsDuplicate(nums: number[]): boolean {
  const seen = new Set<number>();

  for (const num of nums) {
    if (seen.has(num)) return true;
    seen.add(num);
  }

  return false;
}
```

### 关键点

- **Set vs Map** — 本题只需判断存在性，Set 足够；如果需要计数用 Map
- **提前退出** — 方法二在发现第一个重复时就返回，对"大量数据 + 早期重复"的场景性能更好
- **排序法** — 先排序再比较相邻元素，O(n log n) 时间 + O(1) 空间（如果允许修改原数组）
- **面试陷阱** — 面试官可能追问"如果内存受限不能开 O(n) 空间怎么办？" → 排序法

### 自测
1. `[1]` → `false`
2. `[1,1]` → `true`
3. `[1,2,3,4,5,1]` → `true`（方法二在最后一个元素才返回，Set 方法需要遍历全部）

---

## 🟡 中等题 1 — 最长连续序列 (Longest Consecutive Sequence)

**LeetCode 128** | 数组 + 哈希集合

### 题目

给定未排序整数数组，找出**最长连续序列**的长度。要求 **O(n) 时间复杂度**。

```
输入: [100,4,200,1,3,2]
输出: 4
解释: 最长连续序列是 [1,2,3,4]，长度为 4

输入: [0,3,7,2,5,8,4,6,0,1]
输出: 9
解释: [0,1,2,3,4,5,6,7,8]
```

### 思路

**核心难点** — O(n) 时间，不能排序（排序是 O(n log n)）。

**关键洞察** — 对于每个数字 `x`，只有当 `x-1` **不存在**时，`x` 才是一个连续序列的起点。这样每个元素最多被访问两次（一次作为候选起点，一次作为序列的一部分）。

**算法：**
1. 将所有数字放入 HashSet
2. 遍历每个数字，如果 `num-1` 不在集合中（是序列起点），则从 `num` 开始向上查找 `num+1, num+2, ...`
3. 记录最长序列长度

- 时间：O(n) — 每个元素最多被访问 2 次
- 空间：O(n) — HashSet

### 代码

```typescript
function longestConsecutive(nums: number[]): number {
  if (nums.length === 0) return 0;

  const numSet = new Set(nums);
  let maxLength = 0;

  for (const num of numSet) {
    // 只有当 num 是序列起点时才向后扩展
    if (!numSet.has(num - 1)) {
      let currentNum = num;
      let currentLength = 1;

      while (numSet.has(currentNum + 1)) {
        currentNum++;
        currentLength++;
      }

      maxLength = Math.max(maxLength, currentLength);
    }
  }

  return maxLength;
}
```

### 关键点

- **为什么是 O(n)** — 内层 while 循环只对序列起点执行，每个元素最多被访问一次作为序列成员 + 一次作为起点检查
- **去重** — `for (const num of numSet)` 遍历 Set 而非原数组，自动去重
- **起点判断** — `!numSet.has(num - 1)` 是算法的灵魂，避免了重复计算
- **边界** — 空数组返回 0

### 自测
1. `[0]` → `1`
2. `[1,2,0,1]` → `3`（去重后 [0,1,2]）
3. `[9,1,4,7,3,-1,0,5,8,-1,6]` → `7`（[-1,0,1,3,4,5,6] 不对... 应该是 [0,1] 和 [3,4,5] 和 [6,7,8,9] → 最长是 [6,7,8,9] = 4）

---

## 🟡 中等题 2 — 除自身以外数组的乘积 (Product of Array Except Self)

**LeetCode 238** | 数组 + 前缀积 / 后缀积

### 题目

给定长度为 n 的整数数组 `nums`（n > 1），返回数组 `output`，其中 `output[i]` 等于 `nums` 中除 `nums[i]` 之外其余各元素的乘积。**不能使用除法**，要求 O(n) 时间。

```
输入: [1,2,3,4]
输出: [24,12,8,6]

输入: [-1,1,0,-3,3]
输出: [0,0,9,0,0]
```

### 思路

**核心问题** — 不能用除法，意味着不能先算总乘积再除以每个元素（且有 0 的情况下除法会出错）。

**解法：前缀积 × 后缀积**

对每个位置 `i`：
- `output[i] = (i 左边所有元素的乘积) × (i 右边所有元素的乘积)`

**两遍遍历：**
1. 从左到右：`output[i]` 存储 `i` 左边所有元素的乘积
2. 从右到左：用一个变量 `rightProduct` 累积右边乘积，`output[i] *= rightProduct`

- 时间：O(n) — 两遍遍历
- 空间：O(1) — 输出数组不算额外空间，只用一个 `rightProduct` 变量

### 代码

```typescript
function productExceptSelf(nums: number[]): number[] {
  const n = nums.length;
  const output = new Array(n);

  // 第一遍：从左到右，output[i] = nums[0] * nums[1] * ... * nums[i-1]
  output[0] = 1;
  for (let i = 1; i < n; i++) {
    output[i] = output[i - 1] * nums[i - 1];
  }

  // 第二遍：从右到左，rightProduct = nums[i+1] * ... * nums[n-1]
  let rightProduct = 1;
  for (let i = n - 1; i >= 0; i--) {
    output[i] *= rightProduct;
    rightProduct *= nums[i];
  }

  return output;
}
```

### 关键点

- **空间 O(1) 的精髓** — 输出数组不算额外空间，这是题目约定
- **为什么不能除法** — 面试常问：有 0 时除法会出错（除以 0），且多个 0 时逻辑复杂
- **前缀积模板** — `prefix[i] = prefix[i-1] * nums[i-1]`，这是很多问题的通用模式
- **对称性** — 左半部分算前缀积，右半部分算后缀积，最后合并

### 扩展：如果允许除法

```typescript
// 有 0 的情况需要特殊处理
function productExceptSelfWithDivision(nums: number[]): number[] {
  let totalProduct = 1;
  let zeroCount = 0;

  for (const num of nums) {
    if (num === 0) zeroCount++;
    else totalProduct *= num;
  }

  return nums.map(num => {
    if (zeroCount > 1) return 0;
    if (zeroCount === 1) return num === 0 ? totalProduct : 0;
    return totalProduct / num;
  });
}
```

### 自测
1. `[1,1]` → `[1,1]`
2. `[0,0]` → `[0,0]`
3. `[1,2,3]` → `[6,3,2]`

---

## 📊 题目总结

| # | 难度 | 题目 | 核心技巧 | 时间 | 空间 |
|---|------|------|---------|------|------|
| 1 | 🟢 简单 | 有序数组两数之和 | 双指针 | O(n) | O(1) |
| 2 | 🟢 简单 | 股票最大利润 | 贪心 + 维护最小值 | O(n) | O(1) |
| 3 | 🟢 简单 | 存在重复元素 | Set 去重 / 哈希表 | O(n) | O(n) |
| 4 | 🟡 中等 | 最长连续序列 | HashSet + 起点判断 | O(n) | O(n) |
| 5 | 🟡 中等 | 除自身以外乘积 | 前缀积 + 后缀积 | O(n) | O(1) |

## 🔑 核心模式速查

### 双指针（有序数组）
```
left = 0, right = n-1
while left < right:
  计算当前值
  太小 → left++
  太大 → right--
  刚好 → 记录 + 移动
```

### 贪心一次遍历
```
维护一个"到目前为止的最优状态"
遍历每个元素，更新状态 + 更新答案
```

### 前缀积 / 前缀和
```
从左到右算前缀 → 从右到左算后缀 → 合并
output[i] = prefix[i] × suffix[i]
```

### HashSet 智能遍历
```
只从"序列起点"开始扩展
避免重复计算，保证 O(n)
```

## 🧪 自测题

1. **Two Sum II** — 如果返回所有不重复的解（不只是索引），怎么做？
2. **股票最大利润** — 如果允许**无限次**交易（LeetCode 122），答案是什么？（所有上涨区间之和）
3. **存在重复** — 如果要求返回所有重复的元素（不只是判断），怎么做？（Map 计数）
4. **最长连续序列** — 如果要求返回最长序列本身（不只是长度），怎么改？（记录起点和长度）
5. **除自身以外乘积** — 如果数组中有 0，你的解法还正确吗？（正确，不需要特殊处理）

## 📝 与往期对比

| 往期 | 本次 | 差异 |
|------|------|------|
| Two Sum (哈希表) | Two Sum II (双指针) | 有序 vs 无序，不同解法 |
| 字母异位词 (计数) | 存在重复 (Set) | 计数 vs 存在性判断 |
| 最长公共前缀 (扫描) | 股票利润 (贪心) | 字符串 vs 数组贪心 |
| 3Sum (双指针) | 最长连续序列 (HashSet) | 排序双指针 vs 哈希集合 |
| 异位词分组 (哈希) | 除自身以外乘积 (前缀积) | 哈希分组 vs 前缀后缀 |

**本次 5 题全部为全新题目，与 04-29 和 05-01 无重复。**
