# 专项训练 0000 — 算法与数据结构

## 2026-05-10 00:00 | 数组/字符串/哈希表

### 简单题 ×3

#### 1. Valid Parentheses (LeetCode #20)
**题目：** 给定只包含 '(',')','{','}','[',']' 的字符串，判断括号是否有效匹配。
**示例：** "{[]}" → true, "([)]" → false
**思路：** 栈。左括号入栈，右括号匹配栈顶出栈。奇数长度直接 false。
**复杂度：** 时间 O(n)，空间 O(n)

```javascript
function isValid(s) {
  if (s.length % 2 === 1) return false;
  const pair = { ')': '(', '}': '{', ']': '[' };
  const stack = [];
  for (const ch of s) {
    if (ch in pair) { if (stack.pop() !== pair[ch]) return false; }
    else stack.push(ch);
  }
  return stack.length === 0;
}
```

#### 2. Integer to Roman (LeetCode #12)
**题目：** 将整数 1-3999 转为罗马数字。
**示例：** 3749 → "MMMDCCXLIX", 1994 → "MCMXCIV"
**思路：** 贪心。把所有符号（含特殊减法形式 CM/CD/XC/XL/IV）从大到小排列，每次取最大可能值。
**复杂度：** 时间 O(1)，空间 O(1)

```javascript
function intToRoman(num) {
  const values = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const symbols = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let result = '';
  for (let i = 0; i < values.length; i++) {
    while (num >= values[i]) { result += symbols[i]; num -= values[i]; }
  }
  return result;
}
```

#### 3. Remove Duplicates from Sorted Array (LeetCode #26)
**题目：** 有序数组原地删除重复元素，每个元素只出现一次，返回新长度。
**示例：** [1,1,2] → 2, [0,0,1,1,1,2,2,3,3,4] → 5
**思路：** 快慢双指针。slow 指向不重复部分末尾，fast 扫描新元素。
**复杂度：** 时间 O(n)，空间 O(1)

```javascript
function removeDuplicates(nums) {
  if (nums.length === 0) return 0;
  let slow = 0;
  for (let fast = 1; fast < nums.length; fast++) {
    if (nums[fast] !== nums[slow]) { slow++; nums[slow] = nums[fast]; }
  }
  return slow + 1;
}
```

### 中等题 ×2

#### 4. 3Sum (LeetCode #15)
**题目：** 找出所有和为 0 的不重复三元组。
**示例：** [-1,0,1,2,-1,-4] → [[-1,-1,2],[-1,0,1]]
**思路：** 排序 + 固定一个 + 双指针。每层循环跳过重复元素去重。
**复杂度：** 时间 O(n²)，空间 O(1)

```javascript
function threeSum(nums) {
  nums.sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < nums.length - 2; i++) {
    if (i > 0 && nums[i] === nums[i - 1]) continue;
    if (nums[i] > 0) break;
    let left = i + 1, right = nums.length - 1;
    while (left < right) {
      const sum = nums[i] + nums[left] + nums[right];
      if (sum === 0) {
        result.push([nums[i], nums[left], nums[right]]);
        while (left < right && nums[left] === nums[left + 1]) left++;
        while (left < right && nums[right] === nums[right - 1]) right--;
        left++; right--;
      } else if (sum < 0) left++;
      else right--;
    }
  }
  return result;
}
```

#### 5. Container With Most Water (LeetCode #11)
**题目：** 给定 n 条垂直线，找出两条线构成容器盛水最多。
**示例：** [1,8,6,2,5,4,8,3,7] → 49
**思路：** 双指针从两端收缩。每次移动较短的线——因为面积 = min(h1,h2) × 宽度，移动长板毫无意义。
**复杂度：** 时间 O(n)，空间 O(1)

```javascript
function maxArea(height) {
  let left = 0, right = height.length - 1, maxWater = 0;
  while (left < right) {
    const h = Math.min(height[left], height[right]);
    maxWater = Math.max(maxWater, h * (right - left));
    if (height[left] < height[right]) left++;
    else right--;
  }
  return maxWater;
}
```

### 训练总结

| # | 题号 | 难度 | 核心技巧 | 时间 | 空间 |
|---|------|------|----------|------|------|
| 1 | #20 | 简单 | 栈 / 括号匹配 | O(n) | O(n) |
| 2 | #12 | 简单 | 贪心 / 映射表 | O(1) | O(1) |
| 3 | #26 | 简单 | 快慢双指针 | O(n) | O(1) |
| 4 | #15 | 中等 | 排序 + 双指针 + 去重 | O(n²) | O(1) |
| 5 | #11 | 中等 | 双指针收缩 / 移动短板 | O(n) | O(1) |

**今日重点：** 栈是括号类问题的标准解法；贪心转罗马需包含特殊减法形式；快慢双指针是有序数组原地去重标准模式；三数之和是面试最高频中等题（排序+固定+双指针+三层去重）；盛水容器的"移动短板"贪心需要严格证明。

**累计覆盖：** 34 道独特 LeetCode 题目

---

## 2026-05-08 00:00 | 数组/字符串/哈希表

### 简单题 ×3

#### 1. Two Sum (LeetCode #1)
**题目：** 给定整数数组 nums 和目标值 target，找出和为 target 的两个数的索引。
**示例：** nums = [2,7,11,15], target = 9 → [0,1]
**思路：** 哈希表一次遍历，对每个元素检查 target - num 是否已在表中。
**复杂度：** 时间 O(n)，空间 O(n)

```python
def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
```

#### 2. Valid Anagram (LeetCode #242)
**题目：** 判断两个字符串是否为字母异位词（相同字母不同排列）。
**示例：** s = "anagram", t = "nagaram" → true
**思路：** 统计两个字符串各字符出现次数，比较是否一致。
**复杂度：** 时间 O(n)，空间 O(1)（最多 26 个字母）

```python
def isAnagram(s, t):
    if len(s) != len(t):
        return False
    return sorted(s) == sorted(t)
    # 或：from collections import Counter; return Counter(s) == Counter(t)
```

#### 3. Contains Duplicate (LeetCode #217)
**题目：** 判断数组中是否有重复元素。
**示例：** nums = [1,2,3,1] → true
**思路：** 用 set 去重后比较长度。
**复杂度：** 时间 O(n)，空间 O(n)

```python
def containsDuplicate(nums):
    return len(nums) != len(set(nums))
```

---

### 中等题 ×2

#### 4. Group Anagrams (LeetCode #49)
**题目：** 将字符串数组中的字母异位词分组。
**示例：** ["eat","tea","tan","ate","nat","bat"] → [["eat","tea","ate"],["tan","nat"],["bat"]]
**思路：** 每个字符串排序后作为 key，哈希表分组。
**复杂度：** 时间 O(n·k·log k)，空间 O(n·k)（k 为字符串最大长度）

```python
def groupAnagrams(strs):
    from collections import defaultdict
    groups = defaultdict(list)
    for s in strs:
        key = tuple(sorted(s))
        groups[key].append(s)
    return list(groups.values())
```

#### 5. Longest Substring Without Repeating Characters (LeetCode #3)
**题目：** 找不含重复字符的最长子串长度。
**示例：** "abcabcbb" → 3 ("abc")
**思路：** 滑动窗口 + 哈希表记录字符最后出现位置，遇到重复时收缩左边界。
**复杂度：** 时间 O(n)，空间 O(min(n, 字符集大小))

```python
def lengthOfLongestSubstring(s):
    last_seen = {}
    left = max_len = 0
    for right, ch in enumerate(s):
        if ch in last_seen and last_seen[ch] >= left:
            left = last_seen[ch] + 1
        last_seen[ch] = right
        max_len = max(max_len, right - left + 1)
    return max_len
```

---

### 训练总结

| # | 题号 | 难度 | 核心技巧 | 时间 | 空间 |
|---|------|------|----------|------|------|
| 1 | #1 | 简单 | 哈希表两数之和 | O(n) | O(n) |
| 2 | #242 | 简单 | 字符计数/排序 | O(n) | O(1) |
| 3 | #217 | 简单 | Set 去重 | O(n) | O(n) |
| 4 | #49 | 中等 | 排序分组 + 哈希 | O(nklogk) | O(nk) |
| 5 | #3 | 中等 | 滑动窗口 + 哈希 | O(n) | O(字符集) |

**今日重点：** 哈希表是数组/字符串问题的万能钥匙——计数、去重、分组、快速查找，核心思路都是「用空间换时间」。滑动窗口则是处理子串/子数组问题的标准范式。
