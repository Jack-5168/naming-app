# 算法与数据结构专项训练 — 数组/字符串/哈希表 (2026-05-01 00:00)

> **配置:** LeetCode 5 题 = 2 道中等 + 3 道简单
> **重点:** 数组 / 字符串 / 哈希表
> **语言:** JavaScript

---

## 📋 题目列表

| # | 难度 | 题目 | 核心考点 |
|---|------|------|----------|
| 1 | 简单 | 两数之和 (Two Sum) | 哈希表一次遍历 |
| 2 | 简单 | 有效的字母异位词 (Valid Anagram) | 字符计数哈希表 |
| 3 | 简单 | 最长公共前缀 (Longest Common Prefix) | 字符串横向扫描 |
| 4 | 中等 | 无重复字符的最长子串 (Longest Substring Without Repeating Characters) | 滑动窗口 + 哈希表 |
| 5 | 中等 | 字母异位词分组 (Group Anagrams) | 哈希表分组 + 排序/计数键 |

---

## 题 1: 两数之和 (Easy)

**题目:** 给定整数数组 `nums` 和目标值 `target`，找出和为 `target` 的两个数的索引。

**示例:**
```
输入: nums = [2,7,11,15], target = 9
输出: [0,1]
解释: nums[0] + nums[1] = 2 + 7 = 9
```

### 解法一：暴力法 (O(n²))
```javascript
function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) {
        return [i, j];
      }
    }
  }
  return [];
}
```
- 时间: O(n²) | 空间: O(1)
- 不推荐，但理解问题起点

### 解法二：哈希表一次遍历 (O(n)) ⭐
```javascript
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
- 时间: O(n) | 空间: O(n)
- **关键思路:** 遍历时查 `target - nums[i]` 是否已存在，存在则找到答案
- **一次遍历** 优于"先全部入表再查找"的两遍法

### 核心要点
1. **空间换时间:** 用 Map 存储已遍历元素，O(1) 查找
2. **边遍历边查:** 不需要两遍，查到的 complement 一定在当前元素之前
3. **返回索引:** 注意返回的是索引而非值

---

## 题 2: 有效的字母异位词 (Easy)

**题目:** 判断 `s` 是否为 `t` 的字母异位词（字符种类和数量完全相同，顺序不同）。

**示例:**
```
输入: s = "anagram", t = "nagaram"
输出: true

输入: s = "rat", t = "car"
输出: false
```

### 解法一：排序比较
```javascript
function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  return s.split('').sort().join('') === t.split('').sort().join('');
}
```
- 时间: O(n log n) | 空间: O(n)

### 解法二：字符计数哈希表 ⭐
```javascript
function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  const count = new Map();
  for (const ch of s) {
    count.set(ch, (count.get(ch) || 0) + 1);
  }
  for (const ch of t) {
    if (!count.has(ch)) return false;
    count.set(ch, count.get(ch) - 1);
    if (count.get(ch) === 0) count.delete(ch);
  }
  return count.size === 0;
}
```
- 时间: O(n) | 空间: O(k), k 为字符集大小
- **优化:** 第二遍遍历时减计数，减到 0 就删除，最后检查 map 是否为空

### 解法三：固定数组计数 (仅小写字母) ⭐⭐
```javascript
function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  const count = new Array(26).fill(0);
  for (let i = 0; i < s.length; i++) {
    count[s.charCodeAt(i) - 97]++;
    count[t.charCodeAt(i) - 97]--;
  }
  return count.every(c => c === 0);
}
```
- 时间: O(n) | 空间: O(1) — 固定 26 个元素
- **一次遍历同时加减**，比两个循环更优雅
- 适用于已知字符集的场景（小写字母、ASCII 等）

### 核心要点
1. **长度不等直接返回 false** — 快速剪枝
2. **字符计数是哈希表经典应用** — 统计频率
3. **固定数组 vs Map:** 字符集已知且小时用数组更快

---

## 题 3: 最长公共前缀 (Easy)

**题目:** 找出字符串数组中的最长公共前缀。

**示例:**
```
输入: strs = ["flower","flow","flight"]
输出: "fl"

输入: strs = ["dog","racecar","car"]
输出: ""
```

### 解法一：横向扫描 ⭐
```javascript
function longestCommonPrefix(strs) {
  if (strs.length === 0) return '';
  let prefix = strs[0];
  for (let i = 1; i < strs.length; i++) {
    while (strs[i].indexOf(prefix) !== 0) {
      prefix = prefix.slice(0, -1);
      if (prefix === '') return '';
    }
  }
  return prefix;
}
```
- 时间: O(S), S 为所有字符总数 | 空间: O(1)
- **思路:** 以第一个字符串为基准，逐个与后续字符串比较，不匹配就缩短前缀

### 解法二：纵向扫描
```javascript
function longestCommonPrefix(strs) {
  if (strs.length === 0) return '';
  for (let i = 0; i < strs[0].length; i++) {
    const ch = strs[0][i];
    for (let j = 1; j < strs.length; j++) {
      if (i === strs[j].length || strs[j][i] !== ch) {
        return strs[0].slice(0, i);
      }
    }
  }
  return strs[0];
}
```
- **思路:** 按列比较，同一位置的字符不同则前缀到此为止
- **提前终止:** 发现不匹配立即返回，不需要遍历完所有字符串

### 解法三：排序法
```javascript
function longestCommonPrefix(strs) {
  strs.sort();
  const first = strs[0], last = strs[strs.length - 1];
  let i = 0;
  while (i < first.length && first[i] === last[i]) i++;
  return first.slice(0, i);
}
```
- **巧妙之处:** 排序后只需比较首尾两个字符串
- 时间: O(n log n + m) — 排序占主导

### 核心要点
1. **横向扫描** 最直观，适合面试手写
2. **纵向扫描** 可以提前终止，实际性能更好
3. **排序法** 代码最简洁，但排序有额外开销
4. **边界处理:** 空数组、单个元素、完全相同、完全不同

---

## 题 4: 无重复字符的最长子串 (Medium)

**题目:** 给定字符串，找出无重复字符的最长子串长度。

**示例:**
```
输入: s = "abcabcbb"
输出: 3
解释: 无重复最长子串是 "abc"

输入: s = "bbbbb"
输出: 1
解释: 最长子串是 "b"

输入: s = "pwwkew"
输出: 3
解释: 最长子串是 "wke"（注意是子串不是子序列）
```

### 解法一：暴力法 (O(n³))
```javascript
function lengthOfLongestSubstring(s) {
  let maxLen = 0;
  for (let i = 0; i < s.length; i++) {
    for (let j = i; j < s.length; j++) {
      const sub = s.slice(i, j + 1);
      if (new Set(sub).size === sub.length) {
        maxLen = Math.max(maxLen, sub.length);
      }
    }
  }
  return maxLen;
}
```
- 时间: O(n³) | 空间: O(min(n, m))
- 仅用于理解问题

### 解法二：滑动窗口 + 哈希表 ⭐⭐
```javascript
function lengthOfLongestSubstring(s) {
  const charIndex = new Map();
  let left = 0, maxLen = 0;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (charIndex.has(ch) && charIndex.get(ch) >= left) {
      // 重复字符在当前窗口内，左指针跳到重复字符的下一位
      left = charIndex.get(ch) + 1;
    }
    charIndex.set(ch, right);
    maxLen = Math.max(maxLen, right - left + 1);
  }
  return maxLen;
}
```
- 时间: O(n) | 空间: O(min(n, m))
- **关键细节:** `charIndex.get(ch) >= left` — 确保重复字符在**当前窗口内**
- **左指针跳跃:** 不是 +1 而是跳到 `重复字符索引 + 1`，这是最优滑动窗口

### 解法三：滑动窗口 + Set
```javascript
function lengthOfLongestSubstring(s) {
  const set = new Set();
  let left = 0, maxLen = 0;
  for (let right = 0; right < s.length; right++) {
    while (set.has(s[right])) {
      set.delete(s[left]);
      left++;
    }
    set.add(s[right]);
    maxLen = Math.max(maxLen, right - left + 1);
  }
  return maxLen;
}
```
- 时间: O(n) | 空间: O(min(n, m))
- **左指针逐步移动** 而非跳跃，逻辑更清晰但略慢
- 适合字符集不大、需要展示窗口内容的场景

### 核心要点
1. **滑动窗口模板:** 右指针扩展 → 检查条件 → 左指针收缩 → 更新答案
2. **Map 存索引 vs Set 存字符:** Map 可以跳跃移动左指针，Set 需要逐步移动
3. **`>= left` 判断:** 防止使用窗口外的旧重复记录
4. **子串 vs 子序列:** 子串是连续的，子序列可以不连续

---

## 题 5: 字母异位词分组 (Medium)

**题目:** 给定字符串数组，将字母异位词组合在一起。

**示例:**
```
输入: strs = ["eat","tea","tan","ate","nat","bat"]
输出: [["bat"],["nat","tan"],["ate","eat","tea"]]
```

### 解法一：排序键 ⭐⭐
```javascript
function groupAnagrams(strs) {
  const map = new Map();
  for (const str of strs) {
    // 排序后的字符串作为键
    const key = str.split('').sort().join('');
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(str);
  }
  return Array.from(map.values());
}
```
- 时间: O(n × k log k) — n 为字符串数，k 为最大字符串长度
- 空间: O(n × k) — 存储所有字符串
- **简洁优雅:** 异位词排序后完全相同，天然分组键

### 解法二：字符计数键 ⭐⭐
```javascript
function groupAnagrams(strs) {
  const map = new Map();
  for (const str of strs) {
    // 26 个字母的计数数组作为键
    const count = new Array(26).fill(0);
    for (let i = 0; i < str.length; i++) {
      count[str.charCodeAt(i) - 97]++;
    }
    const key = count.join('#'); // "1#0#0#...#1"
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(str);
  }
  return Array.from(map.values());
}
```
- 时间: O(n × k) — 每个字符遍历一次，比排序快
- 空间: O(n × k)
- **优势:** 字符计数 O(k) 比排序 O(k log k) 快
- **键的序列化:** 用 `#` 分隔防止歧义（如 [1,11] vs [11,1]）

### 解法三：质数乘积键（数学方法）
```javascript
function groupAnagrams(strs) {
  const primes = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101];
  const map = new Map();
  for (const str of strs) {
    let hash = 1;
    for (let i = 0; i < str.length; i++) {
      hash *= primes[str.charCodeAt(i) - 97];
    }
    // 注意: 长字符串可能溢出 Number.MAX_SAFE_INTEGER
    if (!map.has(hash)) map.set(hash, []);
    map.get(hash).push(str);
  }
  return Array.from(map.values());
}
```
- **理论:** 算术基本定理 — 每个合数可唯一分解为质因数乘积
- **缺陷:** 长字符串会溢出，实际不推荐
- 面试可以提，展示数学思维

### 核心要点
1. **分组键的选择:** 排序字符串 vs 字符计数 — 排序简洁，计数更快
2. **Map 分组模板:** `if (!map.has(key)) map.set(key, [])` → `map.get(key).push(item)`
3. **键的序列化:** 数组必须转字符串，用分隔符避免歧义
4. **时间复杂度对比:** 排序键 O(k log k) vs 计数键 O(k)

---

## 🧠 知识图谱：数组/字符串/哈希表

```
                    ┌─────────────┐
                    │  哈希表 Map  │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                 ▼
   ┌────────────┐  ┌──────────────┐  ┌──────────────┐
   │ 一次遍历查找│  │  字符计数     │  │  分组归类     │
   │ Two Sum    │  │ Anagram 计数 │  │ 异位词分组    │
   └─────┬──────┘  └──────┬───────┘  └──────┬───────┘
         │                │                  │
         └────────────────┼──────────────────┘
                          ▼
                   ┌─────────────┐
                   │  滑动窗口    │
                   │  无重复子串  │
                   └──────┬──────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
         ┌────────┐  ┌────────┐  ┌────────┐
         │ 横向扫描│  │ 纵向扫描│  │ 排序法  │
         │ 公共前缀│  │ 公共前缀│  │ 公共前缀│
         └────────┘  └────────┘  └────────┘
```

### 哈希表三大经典模式

| 模式 | 思路 | 代表题 | 键 | 值 |
|------|------|--------|-----|-----|
| **查找 complement** | 遍历时查 `target - x` | Two Sum | 元素值 | 索引 |
| **字符计数** | 统计字符频率 | 字母异位词 | 字符 | 出现次数 |
| **分组归类** | 按特征分组 | 异位词分组 | 排序串/计数串 | 字符串数组 |

### 滑动窗口模板

```javascript
function slidingWindow(s) {
  const window = new Map(); // 或 Set/数组
  let left = 0;
  let result = 0;
  
  for (let right = 0; right < s.length; right++) {
    // 1. 右指针扩展，加入窗口
    window.set(s[right], ...);
    
    // 2. 检查条件，收缩左指针
    while (/* 窗口不合法 */) {
      window.delete(s[left]); // 或更新计数
      left++;
    }
    
    // 3. 更新答案
    result = Math.max(result, right - left + 1);
  }
  
  return result;
}
```

### 字符串处理技巧速查

| 技巧 | 用法 | 复杂度 |
|------|------|--------|
| `str.split('').sort().join('')` | 排序字符串 | O(k log k) |
| `str.charCodeAt(i) - 97` | 字符→索引(a=0) | O(1) |
| `str.indexOf(sub) === 0` | 判断前缀 | O(m) |
| `str.slice(0, -1)` | 去掉末尾字符 | O(k) |
| `new Set(str)` | 去重字符 | O(k) |

---

## ✅ 训练总结

### 本次覆盖
- **2 道中等题:** 滑动窗口 + 哈希表分组
- **3 道简单题:** 哈希表查找 + 字符计数 + 字符串扫描
- **核心模式:** 哈希表三剑客（查找/计数/分组）+ 滑动窗口

### 关键收获
1. **哈希表是数组/字符串题的瑞士军刀** — 看到"查找""统计""分组"先想哈希表
2. **滑动窗口的精髓** — 右扩左缩，Map 存索引可以跳跃移动左指针
3. **分组键的设计** — 排序串简洁，计数串高效，质数乘积有理论价值但溢出
4. **时间复杂度意识** — 暴力 O(n²) → 哈希表 O(n) → 固定数组 O(n) 空间 O(1)

### 下次建议
- 进阶：双指针（盛最多水的容器 / 三数之和）
- 进阶：前缀和 + 哈希表（和为 K 的子数组）
- 扩展：二叉树 + DFS/BFS

---

*训练时间: 2026-05-01 00:00 | 专项 #115 | 阶段二*
