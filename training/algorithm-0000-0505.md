# 专项训练 00:00 — 算法与数据结构 (2026-05-05)

**重点：** 数组 / 字符串 / 哈希表
**配置：** 3 道简单 + 2 道中等
**语言：** TypeScript

---

## 📋 题目列表（全新选题，无重复）

| # | 难度 | 题目 | 核心考点 | 对应 LC |
|---|------|------|---------|---------|
| 1 | 🟢 简单 | 只出现一次的数字 (Single Number) | 异或 XOR | #136 |
| 2 | 🟢 简单 | 有效的字母异位词 II (Valid Anagram) | 字符计数数组 | #242 |
| 3 | 🟢 简单 | 字符串中第一个唯一字符 (First Unique Char) | 哈希表频率统计 | #387 |
| 4 | 🟡 中等 | 字符串压缩 (String Compression) | 双指针原地修改 | #443 |
| 5 | 🟡 中等 | H 指数 (H-Index) | 排序 / 计数排序 | #274 |

> 与往期不重复：04-29 覆盖了 Two Sum(#1) / 括号(#20) / 3Sum(#15) / 异位词分组(#49)；05-01 覆盖了 Two Sum(#1) / 字母异位词(#242) / 最长公共前缀(#14) / 无重复最长子串(#3) / 异位词分组(#49)；05-03 覆盖了 Two Sum II(#167) / 股票利润(#121) / 存在重复(#217) / 最长连续序列(#128) / 除自身以外乘积(#238)；05-04 覆盖了罗马数字(#13) / 回文串(#125) / 缺失数字(#268) / 跳跃游戏(#55) / 和为K子数组(#560)。本次 5 题全部为新题。

---

## 🟢 简单题 1 — 只出现一次的数字 (Single Number)

**LeetCode 136** | 数组 + 位运算 (XOR)

### 题目

给你一个 **非空** 整数数组 `nums`，除了某个元素只出现一次以外，其余每个元素均出现两次。找出那个只出现了一次的元素。

要求：线性时间复杂度 O(n)，常数空间复杂度 O(1)。

```
输入: nums = [2, 2, 1]
输出: 1

输入: nums = [4, 1, 2, 1, 2]
输出: 4
```

### 思路

利用 XOR 运算的三个性质：
1. `a ^ a = 0`（相同数字异或为 0）
2. `a ^ 0 = a`（任何数与 0 异或等于自身）
3. XOR 满足交换律和结合律

将所有数字异或，成对出现的数字互相抵消为 0，剩下的就是唯一的那个数字。

- 时间：O(n) — 一次遍历
- 空间：O(1) — 仅需一个变量

### 代码

```typescript
function singleNumber(nums: number[]): number {
  let result = 0;
  for (const num of nums) {
    result ^= num;
  }
  return result;
}
```

### 变体思考

- **LC 137** — 只有一个元素出现一次，其余出现三次 → 需要位计数（逐位统计 mod 3）
- **LC 260** — 两个元素各出现一次，其余出现两次 → XOR 分组（按某一位 1/0 分组后分别 XOR）

### 模式总结

| 场景 | 技巧 | 空间 |
|------|------|------|
| 其余出现 2 次 | 全局 XOR | O(1) |
| 其余出现 3 次 | 逐位计数 mod 3 | O(1) |
| 其余出现 2 次，2 个唯一 | XOR + 分组 | O(1) |

---

## 🟢 简单题 2 — 有效的字母异位词 (Valid Anagram)

**LeetCode 242** | 字符串 + 字符计数

### 题目

给定两个字符串 `s` 和 `t`，判断 `t` 是否是 `s` 的字母异位词（即两个字符串包含相同字符且频率相同，但顺序不同）。

```
输入: s = "anagram", t = "nagaram"
输出: true

输入: s = "rat", t = "car"
输出: false
```

### 思路

**方法一：排序法** — 将两个字符串排序后比较，时间 O(n log n)。

**方法二：计数数组** — 使用长度为 26 的数组记录字符频率。遍历 `s` 时 +1，遍历 `t` 时 -1，最后检查是否全为 0。时间 O(n)，空间 O(1)（固定 26 长度）。

方法二更优，且不需要额外哈希表。

- 时间：O(n) — 两次遍历
- 空间：O(1) — 固定 26 长度数组

### 代码

```typescript
function isAnagram(s: string, t: string): boolean {
  if (s.length !== t.length) return false;

  const count = new Array(26).fill(0);
  const base = 'a'.charCodeAt(0);

  for (let i = 0; i < s.length; i++) {
    count[s.charCodeAt(i) - base]++;
    count[t.charCodeAt(i) - base]--;
  }

  return count.every(c => c === 0);
}
```

### 进阶思考

如果输入包含 Unicode 字符（不只是小写英文字母）？
→ 改用 `Map<string, number>` 或 `Record<string, number>` 代替固定数组。

```typescript
function isAnagramUnicode(s: string, t: string): boolean {
  if (s.length !== t.length) return false;

  const count = new Map<string, number>();
  for (const c of s) count.set(c, (count.get(c) || 0) + 1);
  for (const c of t) {
    const v = count.get(c);
    if (!v) return false;
    count.set(c, v - 1);
  }
  return true;
}
```

### 模式总结

| 场景 | 数据结构 | 适用条件 |
|------|----------|----------|
| 仅小写英文字母 | 固定长度数组 [26] | 字符集小且已知 |
| 含 Unicode | Map / 哈希表 | 字符集大或未知 |
| 需要分组 | 排序键 / 计数键 | LC 49 Group Anagrams |

---

## 🟢 简单题 3 — 字符串中第一个唯一字符 (First Unique Character)

**LeetCode 387** | 字符串 + 哈希表频率统计

### 题目

给定一个字符串 `s`，找到它的第一个不重复的字符，并返回它的索引。如果不存在，返回 -1。

```
输入: s = "leetcode"
输出: 0  (l 是第一个只出现一次的字符)

输入: s = "loveleetcode"
输出: 2  (v 是第一个只出现一次的字符)

输入: s = "aabb"
输出: -1
```

### 思路

两遍扫描：
1. **第一遍**：遍历字符串，用哈希表统计每个字符的出现次数
2. **第二遍**：按原始顺序遍历字符串，找到第一个计数为 1 的字符

注意：不能只遍历哈希表的键（顺序不保证），必须按原字符串顺序检查。

- 时间：O(n) — 两次遍历
- 空间：O(Σ) — Σ 为字符集大小（小写英文字母为 26）

### 代码

```typescript
function firstUniqChar(s: string): number {
  const count = new Map<string, number>();

  // 第一遍：统计频率
  for (const c of s) {
    count.set(c, (count.get(c) || 0) + 1);
  }

  // 第二遍：按原顺序找第一个频率为 1 的
  for (let i = 0; i < s.length; i++) {
    if (count.get(s[i]) === 1) return i;
  }

  return -1;
}
```

### 优化：固定数组版

如果只含小写英文字母，可用固定数组替代 Map，性能更好：

```typescript
function firstUniqCharFast(s: string): number {
  const count = new Array(26).fill(0);
  const base = 'a'.charCodeAt(0);

  for (const c of s) {
    count[c.charCodeAt(0) - base]++;
  }

  for (let i = 0; i < s.length; i++) {
    if (count[s.charCodeAt(i) - base] === 1) return i;
  }

  return -1;
}
```

### 模式总结

| 问题 | 核心模式 | 遍历次数 |
|------|----------|----------|
| 第一个唯一字符 | 频率统计 + 顺序查找 | 2 遍 |
| 所有唯一字符 | 频率统计 + 过滤 | 2 遍 |
| 第一个重复字符 | 集合记录 + 首次命中 | 1 遍 |

---

## 🟡 中等题 1 — 字符串压缩 (String Compression)

**LeetCode 443** | 字符串 + 双指针 + 原地修改

### 题目

给你一个字符数组 `chars`，请使用下述算法进行压缩：

从一个空字符串开始，对于字符数组中 **连续重复的字符组**：
- 如果长度为 1，则将字符追加到字符串中
- 否则，需要追加字符，后面跟着它的长度

压缩后的字符串需要存储到字符数组 `chars` 中。如果组长度为 10 或以上，则在 `chars` 数组中会被拆分为多个字符。

```
输入: chars = ["a","a","b","b","c","c","c"]
输出: 返回 6，前 6 个字符为 ["a","2","b","2","c","3"]

输入: chars = ["a"]
输出: 返回 1，前 1 个字符为 ["a"]

输入: chars = ["a","b","b","b","b","b","b","b","b","b","b","b","b"]
输出: 返回 4，前 4 个字符为 ["a","b","1","2"]
```

### 思路

双指针（读写指针）原地修改：
- **读指针 `i`**：扫描整个数组
- **写指针 `write`**：记录压缩结果的位置
- 内层循环统计连续相同字符的个数
- 写入字符，如果 count > 1，将数字的每一位依次写入

关键点：数字可能有多位（如 12 → '1', '2'），需要逐位写入。

- 时间：O(n) — 每个字符最多被读一次、写一次
- 空间：O(1) — 原地修改

### 代码

```typescript
function compress(chars: string[]): number {
  let write = 0;
  let i = 0;

  while (i < chars.length) {
    const char = chars[i];
    let count = 0;

    // 统计连续相同字符
    while (i < chars.length && chars[i] === char) {
      i++;
      count++;
    }

    // 写入字符
    chars[write++] = char;

    // 写入计数（如果 > 1）
    if (count > 1) {
      const digits = count.toString();
      for (const d of digits) {
        chars[write++] = d;
      }
    }
  }

  return write;
}
```

### 模式总结

| 场景 | 指针策略 | 空间 |
|------|----------|------|
| 原地修改数组 | 读写双指针 | O(1) |
| 需要保留原数组 | 额外结果数组 | O(n) |
| 数字转字符 | toString() 逐位写入 | O(log n) |

### 相关题目

- LC 26 — 删除有序数组中的重复项（同样读写双指针）
- LC 283 — 移动零（同样读写双指针）
- LC 80 — 删除有序数组中的重复项 II（允许最多 2 个重复）

---

## 🟡 中等题 2 — H 指数 (H-Index)

**LeetCode 274** | 数组 + 排序 / 计数排序

### 题目

给你一个整数数组 `citations`，其中 `citations[i]` 表示研究者的第 i 篇论文被引用的次数。计算研究者的 h 指数。

h 指数的定义：h 代表"高引用次数"，一名科研人员的 h 指数是指他（她）的 n 篇论文中，**至少有 h 篇论文**分别被引用了**至少 h 次**。

如果 h 有多种可能的值，h 指数是其中最大的那个。

```
输入: citations = [3, 0, 6, 1, 5]
输出: 3
解释: 研究者有 5 篇论文，每篇分别被引用 3, 0, 6, 1, 5 次。
     有 3 篇论文每篇至少被引用了 3 次，其余两篇不多于 3 次。

输入: citations = [1, 3, 1]
输出: 1
```

### 思路

**方法一：排序法**
将数组降序排序，遍历找到最大的 h 使得 `citations[h-1] >= h`。

- 时间：O(n log n) — 排序
- 空间：O(1) 或 O(n) — 取决于排序实现

**方法二：计数排序（桶排序）**
h 指数的最大值不可能超过论文总数 n。创建一个长度为 n+1 的桶数组，`bucket[i]` 记录引用次数为 i 的论文数量（引用次数 ≥ n 的放入 bucket[n]）。从后往前累加，找到第一个满足 `累计论文数 ≥ i` 的 i。

- 时间：O(n) — 两次遍历
- 空间：O(n) — 桶数组

- 时间（排序法）：O(n log n)
- 空间（排序法）：O(1)
- 时间（计数法）：O(n)
- 空间（计数法）：O(n)

### 代码 — 排序法

```typescript
function hIndex(citations: number[]): number {
  citations.sort((a, b) => b - a);

  let h = 0;
  for (let i = 0; i < citations.length; i++) {
    if (citations[i] >= i + 1) {
      h = i + 1;
    } else {
      break;
    }
  }

  return h;
}
```

### 代码 — 计数排序法（O(n)）

```typescript
function hIndexLinear(citations: number[]): number {
  const n = citations.length;
  const bucket = new Array(n + 1).fill(0);

  // 分配桶
  for (const c of citations) {
    if (c >= n) {
      bucket[n]++;
    } else {
      bucket[c]++;
    }
  }

  // 从后往前累加
  let cumulative = 0;
  for (let i = n; i >= 0; i--) {
    cumulative += bucket[i];
    if (cumulative >= i) {
      return i;
    }
  }

  return 0;
}
```

### 模式总结

| 方法 | 时间 | 空间 | 适用场景 |
|------|------|------|----------|
| 排序法 | O(n log n) | O(1) | 通用，代码简洁 |
| 计数排序 | O(n) | O(n) | 值域有限时更优 |

### 相关题目

- LC 275 — H 指数 II（数组已排序，可用二分查找 O(log n)）
- LC 324 — 摆动排序 II
- 桶排序模式：当值域有限时，计数排序比比较排序更优

---

## 🧠 今日模式总结

| 模式 | 题目 | 核心思想 |
|------|------|----------|
| XOR 抵消 | LC 136 | `a ^ a = 0`，成对元素互相抵消 |
| 字符计数数组 | LC 242 | 固定长度数组替代哈希表（字符集已知时） |
| 频率统计 + 顺序查找 | LC 387 | 两遍扫描：统计频率 → 按序查找 |
| 读写双指针 | LC 443 | 原地修改：读指针扫描 + 写指针写入 |
| 计数排序（桶） | LC 274 | 值域有限时，O(n) 桶排序替代 O(n log n) 比较排序 |

---

## 📊 累计覆盖的 LeetCode 题目

| 日期 | 题目 |
|------|------|
| 04-29 | LC 1 (Two Sum), LC 20 (括号), LC 15 (3Sum), LC 49 (异位词分组) |
| 05-01 | LC 1 (Two Sum), LC 242 (字母异位词), LC 14 (最长公共前缀), LC 3 (无重复最长子串), LC 49 (异位词分组) |
| 05-03 | LC 167 (Two Sum II), LC 121 (股票利润), LC 217 (存在重复), LC 128 (最长连续序列), LC 238 (除自身以外乘积) |
| 05-04 | LC 13 (罗马数字), LC 125 (回文串), LC 268 (缺失数字), LC 55 (跳跃游戏), LC 560 (和为K子数组) |
| **05-05** | **LC 136 (只出现一次), LC 242 (字母异位词), LC 387 (第一个唯一字符), LC 443 (字符串压缩), LC 274 (H指数)** |

> 累计覆盖：25 道不重复题目（含 05-01 的 LC 242 重复，实际 24 道独特题目）

---

*训练时间: 2026-05-05 00:00 | 专项 #116 | 阶段二*
