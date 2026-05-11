# 专项训练 00:00 — 算法与数据结构 (2026-04-29)

**重点：** 数组 / 字符串 / 哈希表
**配置：** 3 道简单 + 2 道中等

---

## 🟢 简单题 1 — 两数之和 (Two Sum)

**LeetCode 1** | 数组 + 哈希表

### 题目

给定整数数组 `nums` 和目标值 `target`，找出数组中两个和为 `target` 的数的索引。

```
输入: nums = [2, 7, 11, 15], target = 9
输出: [0, 1]
解释: nums[0] + nums[1] = 2 + 7 = 9
```

### 思路

遍历数组，用哈希表记录 `值 → 索引`。对每个元素 `x`，检查 `target - x` 是否已在表中。

- 时间：O(n) — 一次遍历
- 空间：O(n) — 哈希表最多存 n 个元素

### 代码

```typescript
function twoSum(nums: number[], target: number): number[] {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement)!, i];
    }
    map.set(nums[i], i);
  }
  return [];
}
```

### 关键点

- **哈希表替代暴力 O(n²)** — 用空间换时间
- **先查后存** — 避免自己加自己
- **Map vs Object** — Map 支持任意类型 key，且无原型链污染

---

## 🟢 简单题 2 — 有效括号 (Valid Parentheses)

**LeetCode 20** | 字符串 + 栈

### 题目

给定只包含 `'()[]{}'` 的字符串，判断括号是否有效匹配。

```
输入: "([)]"    输出: false
输入: "{[]}"    输出: true
```

### 思路

用栈：遇到左括号入栈，遇到右括号检查栈顶是否匹配。

- 时间：O(n) — 一次遍历
- 空间：O(n) — 栈最多存 n/2 个左括号

### 代码

```typescript
function isValid(s: string): boolean {
  const stack: string[] = [];
  const pairs: Record<string, string> = {
    ')': '(',
    ']': '[',
    '}': '{',
  };

  for (const ch of s) {
    if (ch in pairs) {
      // 右括号：弹出栈顶匹配
      if (stack.pop() !== pairs[ch]) return false;
    } else {
      // 左括号：入栈
      stack.push(ch);
    }
  }
  return stack.length === 0;
}
```

### 关键点

- **栈是括号匹配的天然数据结构**
- **提前返回** — 不匹配立刻 false，不遍历完
- **长度奇数直接 false** — 可加前置优化

---

## 🟢 简单题 3 — 最长公共前缀 (Longest Common Prefix)

**LeetCode 14** | 字符串

### 题目

找出字符串数组的最长公共前缀。

```
输入: ["flower", "flow", "flight"]
输出: "fl"

输入: ["dog", "racecar", "car"]
输出: ""
```

### 思路

**水平扫描**：以第一个字符串为基准，逐个字符对比所有字符串。

- 时间：O(S) — S 为所有字符总数
- 空间：O(1) — 只存前缀

### 代码

```typescript
function longestCommonPrefix(strs: string[]): string {
  if (strs.length === 0) return '';

  for (let i = 0; i < strs[0].length; i++) {
    const ch = strs[0][i];
    for (let j = 1; j < strs.length; j++) {
      if (i >= strs[j].length || strs[j][i] !== ch) {
        return strs[0].slice(0, i);
      }
    }
  }
  return strs[0];
}
```

### 关键点

- **逐列扫描** — 外层遍历字符位置，内层遍历字符串
- **提前返回** — 发现不匹配立刻截断
- **边界** — 空数组、单元素、长度不一致

---

## 🟡 中等题 1 — 三数之和 (3Sum)

**LeetCode 15** | 数组 + 双指针

### 题目

找出所有不重复的三元组 `[a, b, c]`，使得 `a + b + c = 0`。

```
输入: [-1, 0, 1, 2, -1, -4]
输出: [[-1, -1, 2], [-1, 0, 1]]
```

### 思路

1. **排序** — O(n log n)
2. **固定第一个数**，用**双指针**找剩余两个数
3. **去重** — 跳过相同的 a / b / c

- 时间：O(n²) — 排序 O(n log n) + 双指针 O(n²)
- 空间：O(1) — 不计输出

### 代码

```typescript
function threeSum(nums: number[]): number[][] {
  nums.sort((a, b) => a - b);
  const result: number[][] = [];

  for (let i = 0; i < nums.length - 2; i++) {
    // 去重：跳过相同的第一个数
    if (i > 0 && nums[i] === nums[i - 1]) continue;

    let left = i + 1;
    let right = nums.length - 1;

    while (left < right) {
      const sum = nums[i] + nums[left] + nums[right];

      if (sum === 0) {
        result.push([nums[i], nums[left], nums[right]]);

        // 去重：跳过相同的第二、第三个数
        while (left < right && nums[left] === nums[left + 1]) left++;
        while (left < right && nums[right] === nums[right - 1]) right--;

        left++;
        right--;
      } else if (sum < 0) {
        left++; // 和太小，左指针右移
      } else {
        right--; // 和太大，右指针左移
      }
    }
  }

  return result;
}
```

### 关键点

- **排序 + 双指针** — 将 O(n³) 降为 O(n²)
- **去重三处** — 第一个数、左指针、右指针各一处
- **提前剪枝** — `nums[i] > 0` 时后续不可能有和为 0 的三元组

---

## 🟡 中等题 2 — 字母异位词分组 (Group Anagrams)

**LeetCode 49** | 哈希表 + 字符串

### 题目

将字符串数组中的字母异位词分组。

```
输入: ["eat", "tea", "tan", "ate", "nat", "bat"]
输出: [["eat","tea","ate"], ["tan","nat"], ["bat"]]
```

### 思路

**排序法**：每个字符串排序后作为 key，异位词排序后相同。

**计数法**（更优）：统计每个字符出现次数，生成固定长度的签名作为 key。

- 排序法时间：O(n · k log k) — k 为字符串最大长度
- 计数法时间：O(n · k) — 避免排序

### 代码（排序法）

```typescript
function groupAnagrams(strs: string[]): string[][] {
  const map = new Map<string, string[]>();

  for (const s of strs) {
    const key = s.split('').sort().join('');
    const group = map.get(key) || [];
    group.push(s);
    map.set(key, group);
  }

  return Array.from(map.values());
}
```

### 代码（计数法 — 更优）

```typescript
function groupAnagramsCount(strs: string[]): string[][] {
  const map = new Map<string, string[]>();

  for (const s of strs) {
    const counts = new Array(26).fill(0);
    for (let i = 0; i < s.length; i++) {
      counts[s.charCodeAt(i) - 97]++; // 'a' = 97
    }
    const key = counts.join('#'); // "1#0#0#...#1#..."
    const group = map.get(key) || [];
    group.push(s);
    map.set(key, group);
  }

  return Array.from(map.values());
}
```

### 关键点

- **排序法 vs 计数法** — 短字符串计数法更快，长字符串排序法更简洁
- **签名设计** — 异位词的核心是"字符组成相同"，排序或计数都能生成唯一签名
- **Map 分组** — `get(key) || []` 是常见的分组模式

---

## 📊 题目总结

| # | 难度 | 题目 | 核心技巧 | 时间 | 空间 |
|---|------|------|---------|------|------|
| 1 | 🟢 简单 | 两数之和 | 哈希表 | O(n) | O(n) |
| 2 | 🟢 简单 | 有效括号 | 栈 | O(n) | O(n) |
| 3 | 🟢 简单 | 最长公共前缀 | 逐列扫描 | O(S) | O(1) |
| 4 | 🟡 中等 | 三数之和 | 排序 + 双指针 + 去重 | O(n²) | O(1) |
| 5 | 🟡 中等 | 字母异位词分组 | 哈希表 + 签名 | O(n·k) | O(n) |

## 🔑 核心模式速查

### 哈希表三板斧
1. **两数之和** — 边遍历边查 complement
2. **异位词** — 排序/计数生成签名作为 key
3. **分组** — `Map.get(key) || []` 模式

### 双指针模板
```
排序 → 固定一个 → left/right 向中间逼近
- 和太小 → left++
- 和太大 → right--
- 找到 → 记录 + 去重 + 双指针同时移动
```

### 栈模板
```
遍历 → 左括号入栈 → 右括号匹配栈顶 → 不匹配立即返回
```

## 🧪 自测题

1. 两数之和的进阶：如果数组已排序，如何 O(n) 解决？（双指针）
2. 有效括号扩展：如果包含 `*`（可作左/右/空），如何判断？（双计数器）
3. 三数之和的 closest 版本：找和最接近 target 的三元组？（同模板，改判断条件）
4. 字母异位词：如何判断两个字符串是否为异位词？（计数比较）
5. 综合：用哈希表实现 LRU Cache？（Map + 双向链表）
