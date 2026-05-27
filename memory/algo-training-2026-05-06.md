# 算法训练 2026-05-06 — 数组/字符串/哈希表

## 题目列表

### 简单题（3道）

---

**1. 两数之和（Two Sum）— LeetCode 1**

**题目：** 给定整数数组 nums 和目标值 target，找出数组中和为目标值的两个整数，返回它们的数组下标。

**输入输出：**

```
nums = [2,7,11,15], target = 9  → [0,1]
nums = [3,2,4], target = 6      → [1,2]
nums = [3,3], target = 6        → [0,1]
```

**思路：** 一次遍历，用 Map 记录「值→下标」的映射。对于每个元素 x，检查 `target - x` 是否已在 Map 中。

**代码：**

```javascript
/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}
```

**复杂度：** O(n) 时间（一次遍历，Map 查找 O(1)），O(n) 空间（Map 最多存 n 个元素）

**考点：** 哈希表查找替代暴力 O(n²) / 空间换时间 / 一次遍历技巧

---

**2. 有效的字母异位词（Valid Anagram）— LeetCode 242**

**题目：** 给定两个字符串 s 和 t，判断 t 是否是 s 的字母异位词（字符种类和数量完全相同，顺序可以不同）。

**输入输出：**

```
s = "anagram", t = "nagaram"  → true
s = "rat", t = "car"          → false
s = "a", t = "ab"             → false
```

**思路：** 先判断长度是否相同，再用一个长度为 26 的数组统计字符频次。s 中字符 +1，t 中字符 -1，最后检查是否全为 0。

**代码：**

```javascript
/**
 * @param {string} s
 * @param {string} t
 * @return {boolean}
 */
function isAnagram(s, t) {
  if (s.length !== t.length) return false;

  const count = new Array(26).fill(0);
  const base = "a".charCodeAt(0);

  for (let i = 0; i < s.length; i++) {
    count[s.charCodeAt(i) - base]++;
    count[t.charCodeAt(i) - base]--;
  }

  return count.every((c) => c === 0);
}
```

**进阶：** 如果输入包含 Unicode 字符，改用 Map 代替定长数组。

**复杂度：** O(n) 时间，O(1) 空间（26 个字母，常数级）

**考点：** 字符频次统计 / 定长数组 vs Map 的选择 / 提前剪枝

---

**3. 存在重复元素 II（Contains Duplicate II）— LeetCode 219**

**题目：** 给定整数数组 nums 和整数 k，判断是否存在两个不同下标 i 和 j，满足 `nums[i] === nums[j]` 且 `|i - j| ≤ k`。

**输入输出：**

```
nums = [1,2,3,1], k = 3        → true
nums = [1,0,1,1], k = 1        → true
nums = [1,2,3,1,2,3], k = 2    → false
```

**思路：** 滑动窗口 + Set。维护一个大小为 k 的窗口，窗口内的元素放入 Set。每次遍历到新元素时，先检查 Set 中是否已有，有则返回 true；再将新元素加入 Set，如果 Set 大小超过 k，移除最老的元素（`nums[i-k]`）。

**代码：**

```javascript
/**
 * @param {number[]} nums
 * @param {number} k
 * @return {boolean}
 */
function containsNearbyDuplicate(nums, k) {
  const window = new Set();

  for (let i = 0; i < nums.length; i++) {
    if (window.has(nums[i])) return true;
    window.add(nums[i]);

    // 窗口大小超过 k，移除最老的元素
    if (window.size > k) {
      window.delete(nums[i - k]);
    }
  }

  return false;
}
```

**复杂度：** O(n) 时间（每个元素最多加入和删除各一次），O(min(n, k)) 空间

**考点：** 滑动窗口 + Set / 维护固定大小窗口 / 边界处理

---

### 中等题（2道）

---

**4. 无重复字符的最长子串（Longest Substring Without Repeating Characters）— LeetCode 3**

**题目：** 给定字符串 s，找出其中不含有重复字符的最长子串的长度。

**输入输出：**

```
s = "abcabcbb"  → 3（"abc"）
s = "bbbbb"     → 1（"b"）
s = "pwwkew"    → 3（"wke"）
```

**思路：** 滑动窗口 + 哈希表。用 Map 记录每个字符最后一次出现的下标。右指针不断扩展窗口，当遇到重复字符时，左指针跳到 `max(left, lastPos[char] + 1)`（注意取 max，因为左指针只能前进不能后退）。

**代码：**

```javascript
/**
 * @param {string} s
 * @return {number}
 */
function lengthOfLongestSubstring(s) {
  let maxLen = 0;
  let left = 0;
  const charMap = new Map();

  for (let right = 0; right < s.length; right++) {
    const char = s[right];

    if (charMap.has(char) && charMap.get(char) >= left) {
      // 重复字符在窗口内，左指针跳到重复字符的下一位
      left = charMap.get(char) + 1;
    }

    charMap.set(char, right);
    maxLen = Math.max(maxLen, right - left + 1);
  }

  return maxLen;
}
```

**复杂度：** O(n) 时间（左右指针各遍历一次），O(min(n, m)) 空间（m 为字符集大小）

**考点：** 滑动窗口 / 左指针不能后退的陷阱 / 字符位置记录

---

**5. 字母异位词分组（Group Anagrams）— LeetCode 49**

**题目：** 给定字符串数组 strs，将字母异位词组合在一起。字母异位词是由相同字母重新排列组成的字符串。

**输入输出：**

```
strs = ["eat","tea","tan","ate","nat","bat"]
→ [["eat","tea","ate"],["nat","tan"],["bat"]]

strs = [""]
→ [[""]]

strs = ["a"]
→ [["a"]]
```

**思路：** 字母异位词排序后字符串相同。对每个字符串排序后作为 key，原字符串作为 value 加入 Map。也可以用字符计数数组作为 key（更高效，避免排序开销）。

**方法一：排序作为 key**

```javascript
/**
 * @param {string[]} strs
 * @return {string[][]}
 */
function groupAnagrams(strs) {
  const map = new Map();

  for (const str of strs) {
    const key = str.split("").sort().join("");
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(str);
  }

  return Array.from(map.values());
}
```

**方法二：字符计数作为 key（更优）**

```javascript
function groupAnagramsOptimized(strs) {
  const map = new Map();

  for (const str of strs) {
    const count = new Array(26).fill(0);
    for (let i = 0; i < str.length; i++) {
      count[str.charCodeAt(i) - 97]++;
    }
    const key = count.join("#"); // "1#0#0#..." 作为 key
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(str);
  }

  return Array.from(map.values());
}
```

**复杂度：**

- 方法一：O(n × k log k) 时间（n 个字符串，每个排序 k log k），O(n × k) 空间
- 方法二：O(n × k) 时间（每个字符串遍历 k 个字符），O(n × k) 空间

**考点：** 哈希表分组 / 同构问题建模（排序/计数作为 canonical form）/ 时间复杂度优化

---

## 今日总结

| #   | 题目           | 难度 | 核心考点            | 时间  | 空间        |
| --- | -------------- | ---- | ------------------- | ----- | ----------- |
| 1   | 两数之和       | ⭐   | 哈希表一次遍历      | O(n)  | O(n)        |
| 2   | 有效字母异位词 | ⭐   | 字符频次统计        | O(n)  | O(1)        |
| 3   | 存在重复 II    | ⭐   | 滑动窗口 + Set      | O(n)  | O(min(n,k)) |
| 4   | 无重复最长子串 | ⭐⭐ | 滑动窗口 + Map      | O(n)  | O(min(n,m)) |
| 5   | 字母异位词分组 | ⭐⭐ | 哈希分组 + 同构建模 | O(nk) | O(nk)       |

### 知识要点

1. **哈希表核心模式：** 值→索引映射（Two Sum）、频次统计（Anagram）、滑动窗口去重（Contains Duplicate II）
2. **滑动窗口精髓：** 右指针扩展 → 检查条件 → 左指针收缩，维护窗口内合法状态
3. **字符问题通用解法：** 定长数组（26 字母）vs Map（Unicode），计数 vs 排序作为 canonical form
4. **复杂度优化思维：** 空间换时间（Map 替代暴力）、提前剪枝（长度不等直接返回）、一次遍历（Two Sum 边查边存）

### 与之前训练的关系

| 日期    | 核心考点                 | 今日对比                           |
| ------- | ------------------------ | ---------------------------------- |
| 4/28    | Set/Boyer-Moore/滑动窗口 | 滑动窗口延续，新增哈希表分组       |
| 5/2     | XOR/字符计数/频率统计    | 字符计数深化（Anagram 分组）       |
| 5/4     | 罗马数字/回文串/跳跃游戏 | 新增滑动窗口进阶（最长子串）       |
| **5/6** | **哈希表综合应用**       | **从简单查找到复杂分组的完整闭环** |

### 7 轮算法训练累计

| 轮次  | 日期    | 题目数 | 核心考点                                  |
| ----- | ------- | ------ | ----------------------------------------- |
| 1     | 4/25    | 5      | 哈希表/单调队列                           |
| 2     | 4/28    | 5      | Set/Boyer-Moore/滑动窗口                  |
| 3     | 4/29    | 5      | 哈希表/栈/双指针                          |
| 4     | 5/2     | 5      | XOR/字符计数/频率统计                     |
| 5     | 5/3     | 5      | 双指针/贪心/Set/前缀积                    |
| 6     | 5/4     | 5      | 罗马数字/回文/跳跃/前缀和                 |
| 7     | 5/5     | 5      | XOR/字符计数/频率/双指针/桶               |
| **8** | **5/6** | **5**  | **哈希表综合（查找/频次/滑动窗口/分组）** |

**累计完成：40 道算法题，8 轮训练。**
