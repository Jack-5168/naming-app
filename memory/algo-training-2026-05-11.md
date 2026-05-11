# 算法训练 2026-05-11 — 数组/字符串/哈希表

## 题目列表

### 简单题（3道）

---

**1. 存在重复元素 II（Contains Duplicate II）— LeetCode 219**

**题目：** 给定整数数组 nums 和整数 k，判断是否存在两个不同索引 i 和 j，使得 nums[i] = nums[j]，且 |i - j| ≤ k。

**输入输出：**
```
nums = [1,2,3,1], k = 3          → true  (索引 0 和 3，值都是 1，差值 3 ≤ 3)
nums = [1,0,1,1], k = 1          → true  (索引 2 和 3，值都是 1，差值 1 ≤ 1)
nums = [1,2,3,1,2,3], k = 2      → false (相同元素的最小距离都 > 2)
```

**思路：** 滑动窗口 + 哈希表。维护一个大小为 k 的 Set 作为窗口，遍历数组时：如果当前元素已在窗口中 → 返回 true；否则加入窗口；如果窗口大小超过 k，移除最旧的元素（nums[i-k]）。本质是只关心"最近 k 个元素内是否有重复"。

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
    
    // 窗口大小超过 k 时，移除最早进入的元素
    if (window.size > k) {
      window.delete(nums[i - k]);
    }
  }
  
  return false;
}
```

**复杂度：** O(n) 时间（一次遍历，Set 操作 O(1)），O(min(n, k)) 空间（窗口最多 k 个元素）

**考点：** 滑动窗口 / Set 去重 / 距离约束

**与 LC217 的关系：** LC217 只问"有没有重复"（全局 Set），LC219 加了距离约束 |i-j| ≤ k，需要用滑动窗口限制检查范围。核心思路一致，但窗口维护是额外考点。

---

**2. 找不同（Find the Difference）— LeetCode 389**

**题目：** 给定两个字符串 s 和 t，t 由 s 的随机重排后再在随机位置添加一个字母得到。找出 t 中添加的那个字母。

**输入输出：**
```
s = "abcd", t = "abcde"    → 'e'
s = "", t = "y"            → 'y'
s = "a", t = "aa"          → 'a'
s = "ae", t = "aea"        → 'a'
```

**思路：** 三种解法，从易到优：

① **计数法**：统计 t 中每个字符出现次数，减去 s 中的次数，剩下的就是添加的字符。需要两次遍历。

② **求差法**：把两个字符串所有字符的 ASCII 码分别求和，差值就是添加字符的 ASCII 码。只需一次遍历。

③ **异或法（最优）**：将所有字符的 charCode 异或，s 中的字符和 t 中对应的字符会互相抵消（x ^ x = 0），最后剩下的就是多出来的那个字符。

**代码（异或法）：**
```javascript
/**
 * @param {string} s
 * @param {string} t
 * @return {character}
 */
function findTheDifference(s, t) {
  let result = 0;
  
  // 异或 s 中所有字符
  for (let i = 0; i < s.length; i++) {
    result ^= s.charCodeAt(i);
  }
  
  // 异或 t 中所有字符（多一个字符，不会被抵消）
  for (let i = 0; i < t.length; i++) {
    result ^= t.charCodeAt(i);
  }
  
  return String.fromCharCode(result);
}
```

**代码（求差法，同样简洁）：**
```javascript
function findTheDifference(s, t) {
  let sum = 0;
  
  for (let i = 0; i < t.length; i++) {
    sum += t.charCodeAt(i);
  }
  for (let i = 0; i < s.length; i++) {
    sum -= s.charCodeAt(i);
  }
  
  return String.fromCharCode(sum);
}
```

**复杂度：** O(n) 时间（两次遍历，n = s.length），O(1) 空间

**考点：** 位运算（异或抵消）/ 字符 ASCII 码求差 / 数学技巧

**异或为什么有效？** 异或满足交换律和结合律，x ^ x = 0，x ^ 0 = x。s 的每个字符在 t 中都有对应项，异或后全部归零，唯一多出的那个字符没有配对项，所以最后结果就是它。

---

**3. 单词规律（Word Pattern）— LeetCode 290**

**题目：** 给定一种规律 pattern 和一个字符串 str，判断 str 是否遵循相同的规律。pattern 中的每个字母和 str 中的每个非空单词之间存在着双向连接（双射）关系。

**输入输出：**
```
pattern = "abba", str = "dog cat cat dog"     → true
pattern = "abba", str = "dog cat cat fish"    → false
pattern = "aaaa", str = "dog cat cat dog"     → false
pattern = "abba", str = "dog dog dog dog"     → false
```

**思路：** 双向哈希表。需要维护两个映射：① pattern 字符 → 单词，② 单词 → pattern 字符。遍历时同时检查两个方向是否一致。单向检查不够，因为 "abba" 映射到 "dog dog dog dog" 时，a→dog 和 b→dog 在单向检查中不会冲突，但违反了双射。

**代码：**
```javascript
/**
 * @param {string} pattern
 * @param {string} s
 * @return {boolean}
 */
function wordPattern(pattern, s) {
  const words = s.split(' ');
  
  // 长度不匹配直接 false
  if (pattern.length !== words.length) return false;
  
  const charToWord = new Map();  // pattern 字符 → 单词
  const wordToChar = new Map();  // 单词 → pattern 字符
  
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    const word = words[i];
    
    // 检查正向映射
    if (charToWord.has(ch)) {
      if (charToWord.get(ch) !== word) return false;
    } else {
      charToWord.set(ch, word);
    }
    
    // 检查反向映射
    if (wordToChar.has(word)) {
      if (wordToChar.get(word) !== ch) return false;
    } else {
      wordToChar.set(word, ch);
    }
  }
  
  return true;
}
```

**复杂度：** O(n) 时间（n = pattern.length，split 需要 O(m) 其中 m = s.length），O(n) 空间（两个 Map）

**考点：** 双射（双向映射）/ 哈希表 / 长度预检

**为什么需要两个 Map？** 单 Map 只能保证"同一个 pattern 字符总是映射到同一个单词"，但不能保证"同一个单词不会被多个 pattern 字符映射"。"abba" → "dog dog dog dog" 就是反例：a→dog ✓, b→dog ✓（单向），但 a 和 b 都映射到 dog 违反了双射。

---

### 中等题（2道）

---

**4. 最长公共前缀（Longest Common Prefix）— LeetCode 14**

**题目：** 编写一个函数来查找字符串数组中的最长公共前缀。如果不存在公共前缀，返回空字符串 ""。

**输入输出：**
```
["flower","flow","flight"]        → "fl"
["dog","racecar","car"]           → ""
["interspecies","interstellar","interstate"] → "inter"
["a"]                             → "a"
["ab", "a"]                       → "a"
```

**思路：** 水平扫描。先取第一个字符串作为基准，然后逐个与后续字符串比较前缀。每次比较时，找到当前公共前缀和下一个字符串的公共部分，不断缩短。如果公共前缀缩短到空，提前返回。

**代码：**
```javascript
/**
 * @param {string[]} strs
 * @return {string}
 */
function longestCommonPrefix(strs) {
  if (strs.length === 0) return '';
  
  let prefix = strs[0];
  
  for (let i = 1; i < strs.length; i++) {
    // 当前字符串不以 prefix 开头时，不断缩短 prefix
    while (strs[i].indexOf(prefix) !== 0) {
      prefix = prefix.slice(0, -1);
      if (prefix === '') return '';
    }
  }
  
  return prefix;
}
```

**代码（逐字符比较，更高效的版本）：**
```javascript
function longestCommonPrefix(strs) {
  if (strs.length === 0) return '';
  
  const first = strs[0];
  
  for (let i = 0; i < first.length; i++) {
    const ch = first[i];
    
    for (let j = 1; j < strs.length; j++) {
      // 某个字符串在此位置字符不同，或已到达末尾
      if (i >= strs[j].length || strs[j][i] !== ch) {
        return first.slice(0, i);
      }
    }
  }
  
  return first;
}
```

**复杂度：** O(S) 时间（S = 所有字符串字符总数，最坏情况全部字符都比较），O(1) 空间（不计输入和输出）

**考点：** 水平扫描 / 逐字符比较 / 提前终止

**其他解法：**
- **垂直扫描**：按列比较（上面第二个解法），在公共前缀较短时比水平扫描更快，因为可以提前终止。
- **分治**：将数组分成两半，分别求公共前缀，再合并。T(n) = 2T(n/2) + O(m)，O(m·n)。
- **二分搜索**：对前缀长度做二分，检查该长度是否为公共前缀。O(m·log n)。
- **Trie 树**：将所有字符串插入 Trie，从根走到第一个分叉点。O(S) 建树 + O(m) 查找。

**面试场景：** 水平扫描最直观，逐字符比较最实用，Trie 树适合"多次查询不同子集"的场景。

---

**5. 搜索二维矩阵 II（Search a 2D Matrix II）— LeetCode 240**

**题目：** 编写一个高效的算法，在 m × n 矩阵中搜索一个值 target。矩阵每行的整数从左到右升序排列，每列的整数从上到下升序排列。

**输入输出：**
```
matrix = [
  [1,  4,  7, 11, 15],
  [2,  5,  8, 12, 19],
  [3,  6,  9, 16, 22],
  [10, 13, 14, 17, 24],
  [18, 21, 23, 26, 30]
]
target = 5  → true
target = 20 → false
```

**思路：** 从**右上角**（或左下角）开始搜索。右上角是关键位置——它左边的元素都比它小，下边的元素都比它大。每次比较后可以排除一行或一列：
- target < 当前值 → 当前列所有元素都 > target，排除当前列（左移）
- target > 当前值 → 当前行所有元素都 < target，排除当前行（下移）
- target = 当前值 → 找到

**代码：**
```javascript
/**
 * @param {number[][]} matrix
 * @param {number} target
 * @return {boolean}
 */
function searchMatrix(matrix, target) {
  if (matrix.length === 0 || matrix[0].length === 0) return false;
  
  const m = matrix.length;
  const n = matrix[0].length;
  
  // 从右上角开始
  let row = 0;
  let col = n - 1;
  
  while (row < m && col >= 0) {
    const val = matrix[row][col];
    
    if (val === target) {
      return true;
    } else if (val > target) {
      col--;  // 当前值太大，排除当前列
    } else {
      row++;  // 当前值太小，排除当前行
    }
  }
  
  return false;
}
```

**复杂度：** O(m + n) 时间（每次比较排除一行或一列，最多 m+n 步），O(1) 空间

**考点：** 有序矩阵搜索 / 右上角/左下角起点 / 行列排除

**为什么不能从左上角或右下角开始？** 左上角的右边和下边都更大，无法判断往哪走；右下角的左边和上边都更小，同样无法判断。只有右上角（左小下大）或左下角（左上大右小）才有明确的搜索方向。

**与 LC74 的关系：** LC74 是"每行开头 > 上一行末尾"的严格全局有序矩阵，可以用一次二分搜索 O(log(mn))。LC240 只保证行列有序，不保证全局有序，所以不能用全局二分，但可以用行列排除法 O(m+n)。

---

## 知识点覆盖

| 知识点 | 对应题目 | 核心思路 |
|--------|----------|----------|
| 滑动窗口 + Set | 题1 存在重复 II | 维护大小为 k 的窗口，检查重复 |
| 位运算（异或） | 题2 找不同 | x^x=0 抵消，剩余即答案 |
| 双向哈希表 | 题3 单词规律 | 两个 Map 保证双射 |
| 水平扫描 | 题4 最长公共前缀 | 逐字符串缩短公共前缀 |
| 有序矩阵搜索 | 题5 搜索二维矩阵 II | 右上角起点，行列排除 |

## 与往期训练的区别

| 往期已覆盖（34题） | 本次新增 |
|---------------------|----------|
| LC217 存在重复（全局） | LC219 存在重复 II（滑动窗口+距离约束） |
| LC1 两数之和 | LC389 找不同（异或抵消） |
| LC3 无重复最长子串 | LC290 单词规律（双射映射） |
| LC14 最长公共前缀 | LC14 最长公共前缀（水平扫描+逐字符） |
| LC11 盛水容器 | LC240 搜索二维矩阵 II（行列排除） |

**本次新增算法模式：** 滑动窗口+距离约束、位运算异或抵消、双向哈希表双射、水平扫描+逐字符比较、有序矩阵行列排除

**累计覆盖：** 34 + 5 = **39 道独特 LeetCode 题目**

## 训练总结

| # | 题号 | 难度 | 核心技巧 | 时间 | 空间 |
|---|------|------|----------|------|------|
| 1 | #219 | 简单 | 滑动窗口 + Set | O(n) | O(min(n,k)) |
| 2 | #389 | 简单 | 位运算异或 / 字符求差 | O(n) | O(1) |
| 3 | #290 | 简单 | 双向哈希表（双射） | O(n) | O(n) |
| 4 | #14 | 中等 | 水平扫描 / 逐字符比较 | O(S) | O(1) |
| 5 | #240 | 中等 | 有序矩阵行列排除 | O(m+n) | O(1) |

**今日重点：**
1. **滑动窗口+距离约束** — LC219 是 LC217 的升级版，核心区别是窗口大小限制。Set 的 add/delete 操作 O(1)，比每次遍历窗口高效得多。
2. **异或抵消** — 位运算在"找唯一/找不同"类问题中是神器。LC136（只出现一次的数字）也是同样思路。记住：x^x=0, x^0=x, 交换律+结合律。
3. **双向哈希表** — 凡是涉及"双射/一一映射"的问题，必须两个方向都检查。单向 Map 只能保证函数性，不能保证单射性。
4. **公共前缀扫描** — 水平扫描最直观，逐字符比较在短前缀场景更高效。Trie 树适合多次查询。面试中逐字符比较是最稳妥的写法。
5. **有序矩阵搜索** — 右上角/左下角是唯二可选的起点。每步排除一行或一列，O(m+n) 是最优解。注意与 LC74 的全局二分区分。
