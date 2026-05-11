# 专项训练 00:00 — 算法与数据结构 (2026-05-04)

**重点：** 数组 / 字符串 / 哈希表
**配置：** 3 道简单 + 2 道中等
**语言：** TypeScript

---

## 📋 题目列表（全新选题，无重复）

| # | 难度 | 题目 | 核心考点 | 对应 LC |
|---|------|------|---------|---------|
| 1 | 🟢 简单 | 罗马数字转整数 (Roman to Integer) | 字符串遍历 + 映射表 | #13 |
| 2 | 🟢 简单 | 验证回文串 (Valid Palindrome) | 双指针 + 字符过滤 | #125 |
| 3 | 🟢 简单 | 缺失数字 (Missing Number) | 数学求和 / 异或 | #268 |
| 4 | 🟡 中等 | 跳跃游戏 (Jump Game) | 贪心算法 | #55 |
| 5 | 🟡 中等 | 和为 K 的子数组 (Subarray Sum Equals K) | 前缀和 + 哈希表 | #560 |

> 与往期不重复：04-29 覆盖了 Two Sum / 括号 / 前缀 / 3Sum / 异位词分组；05-01 覆盖了 Two Sum / 字母异位词 / 前缀 / 无重复最长子串 / 异位词分组；05-02 覆盖了存在重复 / 多数元素 / 最长回文串 / 最长连续序列 / 字符串排列；05-03 覆盖了 Two Sum II / 股票利润 / 存在重复 / 最长连续序列 / 除自身以外乘积。本次 5 题全部为新题。

---

## 🟢 简单题 1 — 罗马数字转整数 (Roman to Integer)

**LeetCode 13** | 字符串 + 映射表

### 题目

罗马数字包含以下七种字符：`I, V, X, L, C, D, M`

```
字符          数值
I             1
V             5
X             10
L             50
C             100
D             500
M             1000
```

通常小数字在大数字右边，但也有特殊规则：`I` 在 `V` 或 `X` 左边表示 4 或 9，`X` 在 `L` 或 `C` 左边表示 40 或 90，`C` 在 `D` 或 `M` 左边表示 400 或 900。

```
输入: "III"     输出: 3
输入: "IV"      输出: 4
输入: "MCMXCIV" 输出: 1994
```

### 思路

**核心规律** — 如果当前字符的值 **小于** 右边字符的值，说明是特殊规则（减法），否则是正常规则（加法）。

从左到右遍历，比较 `values[i]` 和 `values[i+1]`：
- `values[i] < values[i+1]` → 减去 `values[i]`
- `values[i] >= values[i+1]` → 加上 `values[i]`
- 最后一个字符直接加上

- 时间：O(n) — 一次遍历
- 空间：O(1) — 映射表固定 7 个字符

### 代码

```typescript
function romanToInt(s: string): number {
  const values: Record<string, number> = {
    I: 1, V: 5, X: 10, L: 50,
    C: 100, D: 500, M: 1000
  };

  let result = 0;

  for (let i = 0; i < s.length; i++) {
    const current = values[s[i]];
    const next = values[s[i + 1]] ?? 0;

    if (current < next) {
      result -= current;  // 特殊规则：IV=4, IX=9, 等
    } else {
      result += current;  // 正常规则
    }
  }

  return result;
}
```

### 关键点

- **映射表** — 用 `Record<string, number>` 建立字符到数值的映射
- **比较相邻** — 核心判断是 `current < next`，不需要单独处理 6 种特殊情况
- **边界处理** — `s[i + 1]` 越界时用 `?? 0` 处理，最后一个字符自然走加法分支
- **为什么有效** — 罗马数字的规则保证：只有当小数字在大数字左边时才表示减法，其他情况都是加法

### 自测
1. `"IX"` → `9`（I < X，减 1，加 10）
2. `"LVIII"` → `58`（L=50, V=5, III=3）
3. `"CD"` → `400`（C < D，减 100，加 500）

---

## 🟢 简单题 2 — 验证回文串 (Valid Palindrome)

**LeetCode 125** | 字符串 + 双指针

### 题目

给定一个字符串，验证它是否是回文串。只考虑字母和数字字符，忽略大小写。空字符串定义为有效的回文串。

```
输入: "A man, a plan, a canal: Panama"
输出: true

输入: "race a car"
输出: false

输入: " "
输出: true
```

### 思路

**双指针** — 左指针从头部开始，右指针从尾部开始，向中间靠拢。

每一步：
1. 跳过非字母数字字符
2. 比较左右字符（转小写后）
3. 不相等 → 不是回文；相等 → 继续

- 时间：O(n) — 每个字符最多访问一次
- 空间：O(1) — 两个指针

### 代码

```typescript
function isPalindrome(s: string): boolean {
  let left = 0;
  let right = s.length - 1;

  while (left < right) {
    // 跳过非字母数字字符
    while (left < right && !isAlphanumeric(s[left])) left++;
    while (left < right && !isAlphanumeric(s[right])) right--;

    // 比较（忽略大小写）
    if (s[left].toLowerCase() !== s[right].toLowerCase()) {
      return false;
    }

    left++;
    right--;
  }

  return true;
}

function isAlphanumeric(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 48 && code <= 57) ||   // 0-9
         (code >= 97 && code <= 122) ||  // a-z
         (code >= 65 && code <= 90);     // A-Z
}
```

### 关键点

- **字符判断** — 用 `charCodeAt` 比正则更快，避免每步都创建正则对象
- **双指针收敛** — 内层 while 确保跳过无效字符后再比较
- **大小写处理** — 统一转小写再比较
- **替代方案** — 可以用 `s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()` 先过滤再比较，但需要 O(n) 额外空间创建新字符串
- **面试追问** — "如果字符串是流式输入（不能随机访问），怎么做？" → 用双端队列或栈

### 自测
1. `"0P"` → `false`（'0' vs 'p'）
2. `"a."` → `true`（只有一个有效字符）
3. `"racecar"` → `true`

---

## 🟢 简单题 3 — 缺失数字 (Missing Number)

**LeetCode 268** | 数组 + 数学 / 位运算

### 题目

给定一个包含 `0, 1, 2, ..., n` 中 `n` 个数的数组，找出 `0` 到 `n` 之间缺失的那个数字。

```
输入: [3, 0, 1]         输出: 2
输入: [0, 1]            输出: 2
输入: [9, 6, 4, 2, 3, 5, 7, 0, 1]  输出: 8
```

### 思路

**方法一：数学求和** — `0` 到 `n` 的完整和是 `n * (n + 1) / 2`，减去数组中所有元素的和，差值就是缺失的数字。

**方法二：异或** — 利用 `a ^ a = 0` 和 `a ^ 0 = a` 的性质。将 `0~n` 所有数字和数组中所有数字一起做异或，成对出现的数字抵消，剩下的就是缺失的数字。

- 时间：O(n) — 一次遍历
- 空间：O(1) — 只用一个变量

### 代码

```typescript
// 方法一：数学求和（简洁直观）
function missingNumber(nums: number[]): number {
  const n = nums.length;
  const expectedSum = n * (n + 1) / 2;
  const actualSum = nums.reduce((a, b) => a + b, 0);
  return expectedSum - actualSum;
}

// 方法二：异或（避免溢出问题）
function missingNumberXOR(nums: number[]): number {
  let result = nums.length; // 从 n 开始（因为 0~n-1 的索引 + n 本身）

  for (let i = 0; i < nums.length; i++) {
    result ^= i ^ nums[i];
  }

  return result;
}
```

### 关键点

- **求和法的隐患** — 当 n 很大时，`n * (n + 1) / 2` 可能溢出（JavaScript 中 Number 最大安全整数是 2^53-1，n > 10^8 时需注意）
- **异或法更安全** — 不会溢出，且只涉及位运算
- **异或的巧妙之处** — `result` 初始化为 `n`，然后对每个 `i` 做 `result ^= i ^ nums[i]`。最终 `0~n-1` 的索引和数组中的值成对抵消，剩下缺失的数字
- **进阶** — 如果要求 O(1) 空间且不能修改原数组，这两种方法都满足

### 自测
1. `[0]` → `1`（只有 0，缺 1）
2. `[1]` → `0`（只有 1，缺 0）
3. `[0, 1, 2]` → `3`

---

## 🟡 中等题 1 — 跳跃游戏 (Jump Game)

**LeetCode 55** | 数组 + 贪心算法

### 题目

给定一个非负整数数组，你最初位于数组的第一个位置。每个元素代表你在该位置可以跳跃的最大长度。判断你是否能到达最后一个位置。

```
输入: [2,3,1,1,4]
输出: true
解释: 跳 1 步到索引 1，再跳 3 步到末尾

输入: [3,2,1,0,4]
输出: false
解释: 无论如何都到不了末尾（索引 3 处值为 0，卡住了）
```

### 思路

**贪心策略** — 维护一个变量 `maxReach`，表示当前能到达的最远位置。遍历数组，对每个位置 `i`：

1. 如果 `i > maxReach`，说明当前位置都到不了，更不用说后面了 → 返回 `false`
2. 更新 `maxReach = max(maxReach, i + nums[i])`
3. 如果 `maxReach >= 最后一个索引` → 返回 `true`

**核心思想** — 不需要知道具体怎么跳，只需要知道"最远能到哪儿"。

- 时间：O(n) — 一次遍历
- 空间：O(1) — 一个变量

### 代码

```typescript
function canJump(nums: number[]): boolean {
  let maxReach = 0;

  for (let i = 0; i < nums.length; i++) {
    // 当前位置都到不了，直接失败
    if (i > maxReach) return false;

    // 更新最远可达位置
    maxReach = Math.max(maxReach, i + nums[i]);

    // 已经能到末尾，提前返回
    if (maxReach >= nums.length - 1) return true;
  }

  return true;
}
```

### 关键点

- **为什么贪心有效** — 我们只关心"能不能到"，不关心"怎么走"。只要某个位置可达，它就能贡献自己的跳跃能力
- **提前退出** — `maxReach >= n-1` 时可以直接返回 true，不需要遍历完
- **失败条件** — `i > maxReach` 是唯一的失败条件，说明遇到了"断崖"
- **与 DP 的区别** — DP 需要 O(n) 空间记录每个位置是否可达；贪心只需要 O(1)
- **扩展** — 如果要求最小跳跃次数（Jump Game II），需要用 BFS 或贪心的"层遍历"思路

### 自测
1. `[0]` → `true`（已经在末尾）
2. `[0, 2, 3]` → `false`（第一步就卡住）
3. `[1, 2, 0, 1]` → `true`（0→1→2→3 或 0→1→3）

---

## 🟡 中等题 2 — 和为 K 的子数组 (Subarray Sum Equals K)

**LeetCode 560** | 数组 + 前缀和 + 哈希表

### 题目

给定一个整数数组和一个整数 `k`，找到该数组中和为 `k` 的连续子数组的个数。

```
输入: nums = [1,1,1], k = 2
输出: 2
解释: [1,1]（索引 0-1）和 [1,1]（索引 1-2）

输入: nums = [1,2,3], k = 3
输出: 2
解释: [1,2] 和 [3]

输入: nums = [1,-1,0], k = 0
输出: 3
解释: [1,-1], [-1,0], [1,-1,0]
```

### 思路

**前缀和 + 哈希表** — 这是本题的核心。

定义 `prefixSum[i]` = `nums[0] + nums[1] + ... + nums[i]`

对于任意子数组 `nums[j..i]`，其和 = `prefixSum[i] - prefixSum[j-1]`

我们要找的是：`prefixSum[i] - prefixSum[j-1] = k`，即 `prefixSum[j-1] = prefixSum[i] - k`

**算法：**
1. 遍历数组，维护当前前缀和 `currentSum`
2. 用哈希表记录每个前缀和出现的次数
3. 对每个位置，检查 `currentSum - k` 在哈希表中出现了多少次，加到结果中
4. 将 `currentSum` 加入哈希表

**初始条件** — 哈希表中预存 `{0: 1}`，表示前缀和为 0 出现 1 次（对应从索引 0 开始的子数组）。

- 时间：O(n) — 一次遍历
- 空间：O(n) — 哈希表最多存 n 个不同的前缀和

### 代码

```typescript
function subarraySum(nums: number[], k: number): number {
  const prefixCount = new Map<number, number>();
  prefixCount.set(0, 1); // 前缀和为 0 出现 1 次

  let currentSum = 0;
  let count = 0;

  for (const num of nums) {
    currentSum += num;

    // 检查是否存在前缀和 = currentSum - k
    const target = currentSum - k;
    count += prefixCount.get(target) ?? 0;

    // 记录当前前缀和
    prefixCount.set(currentSum, (prefixCount.get(currentSum) ?? 0) + 1);
  }

  return count;
}
```

### 关键点

- **为什么用 Map 而不是 Set** — 因为同一个前缀和可能出现多次（如数组中有 0 或正负抵消），需要记录出现次数
- **初始值 `{0: 1}` 的作用** — 处理"从索引 0 开始的子数组和等于 k"的情况。例如 `nums=[1,2,3], k=3`，当 `currentSum=3` 时，需要查 `3-3=0`，此时 `{0:1}` 贡献 1 个计数
- **顺序很重要** — 先查 `currentSum - k`，再把 `currentSum` 加入 Map。如果反过来，会错误地把当前位置也算进去
- **与 Two Sum 的关系** — 都是"找两个数的差等于目标值"，但 Two Sum 找的是两个元素，本题找的是两个前缀和
- **负数处理** — 数组中可以包含负数，前缀和可能减少，这完全正常，算法不受影响

### 自测
1. `nums=[1], k=0` → `0`（没有和为 0 的子数组）
2. `nums=[0,0,0], k=0` → `6`（[0]×3 + [0,0]×2 + [0,0,0]×1）
3. `nums=[1,-1,0], k=0` → `3`

---

## 📊 题目总结

| # | 难度 | 题目 | 核心技巧 | 时间 | 空间 |
|---|------|------|---------|------|------|
| 1 | 🟢 简单 | 罗马数字转整数 | 映射表 + 相邻比较 | O(n) | O(1) |
| 2 | 🟢 简单 | 验证回文串 | 双指针 + 字符过滤 | O(n) | O(1) |
| 3 | 🟢 简单 | 缺失数字 | 数学求和 / 异或 | O(n) | O(1) |
| 4 | 🟡 中等 | 跳跃游戏 | 贪心 + 最远可达 | O(n) | O(1) |
| 5 | 🟡 中等 | 和为 K 的子数组 | 前缀和 + 哈希表计数 | O(n) | O(n) |

## 🔑 核心模式速查

### 映射表（罗马数字）
```
建立 值 → 映射 的 Record/Map
遍历时查表 + 相邻比较判断加减
```

### 双指针 + 过滤（回文串）
```
left=0, right=n-1
while left < right:
  跳过无效字符
  比较
  移动指针
```

### 异或找缺失（Missing Number）
```
result = n
for i in 0..n-1:
  result ^= i ^ nums[i]
return result
// 成对抵消，剩下缺失的
```

### 贪心最远可达（Jump Game）
```
maxReach = 0
for i in 0..n-1:
  if i > maxReach → 到不了，返回 false
  maxReach = max(maxReach, i + nums[i])
  if maxReach >= n-1 → 能到，返回 true
```

### 前缀和 + 哈希表计数（Subarray Sum = K）
```
prefixCount = {0: 1}
currentSum = 0
for num in nums:
  currentSum += num
  count += prefixCount[currentSum - K]
  prefixCount[currentSum]++
```

## 🧪 自测题

1. **罗马数字** — 如果输入可能包含非法字符，怎么加校验？（遍历前检查每个字符是否在映射表中）
2. **回文串** — 如果只允许 O(1) 空间且字符串是单向链表，怎么做？（快慢指针找中点 + 反转后半段）
3. **缺失数字** — 如果数组中有重复元素且缺失多个数字，怎么找？（排序法或原地交换法）
4. **跳跃游戏** — 如果要返回到达末尾的**最小跳跃次数**（Jump Game II），怎么改？（贪心层遍历）
5. **和为 K 的子数组** — 如果要求返回具体的子数组（不只是计数），怎么改？（Map 存索引列表而非计数）

## 📝 与往期对比

| 往期 | 本次 | 差异 |
|------|------|------|
| Two Sum (哈希表找两数) | 和为 K 的子数组 (前缀和+哈希表) | 从两数到连续子数组的升级 |
| 有效括号 (栈) | 验证回文串 (双指针) | 栈 vs 双指针，不同场景 |
| 最长公共前缀 (扫描) | 罗马数字转整数 (映射表) | 字符串处理的不同思路 |
| 3Sum (双指针) | 跳跃游戏 (贪心) | 双指针 vs 贪心，新范式 |
| 股票利润 (贪心) | 缺失数字 (数学/异或) | 贪心 vs 数学技巧 |

**本次 5 题全部为全新题目，与 04-29、05-01、05-02、05-03 无重复。**

## 🆕 新增算法/模式

| 模式 | 首次出现 | 说明 |
|------|---------|------|
| 映射表 + 相邻比较 | 本题 1 | 罗马数字转整数的核心 |
| 双指针 + 字符过滤 | 本题 2 | 回文串验证的标准模板 |
| 异或找缺失 | 本题 3 | 利用 `a ^ a = 0` 的性质 |
| 贪心最远可达 | 本题 4 | 跳跃游戏系列的核心思路 |
| 前缀和 + 哈希表计数 | 本题 5 | 子数组求和问题的万能模板 |
