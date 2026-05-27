# 算法训练 2026-05-10 — 数组/字符串/哈希表

## 题目列表

### 简单题（3道）

---

**1. 有效的括号（Valid Parentheses）— LeetCode 20**

**题目：** 给定只包含字符 '(', ')', '{', '}', '[', ']' 的字符串，判断是否有效。有效条件：左括号必须用相同类型的右括号闭合，且按正确顺序闭合。

**输入输出：**

```
"()"       → true
"()[]{}"   → true
"(]"       → false
"([)]"     → false
"{[]}"     → true
```

**思路：** 栈的经典应用。遇到左括号入栈，遇到右括号时检查栈顶是否匹配。最后栈必须为空。

**代码：**

```javascript
/**
 * @param {string} s
 * @return {boolean}
 */
function isValid(s) {
  if (s.length % 2 === 1) return false; // 奇数长度直接 false

  const pair = { ")": "(", "}": "{", "]": "[" };
  const stack = [];

  for (const ch of s) {
    if (ch in pair) {
      // 右括号
      if (stack.pop() !== pair[ch]) return false;
    } else {
      stack.push(ch); // 左括号
    }
  }

  return stack.length === 0;
}
```

**复杂度：** O(n) 时间，O(n) 空间（最坏全部左括号入栈）

**考点：** 栈 / 括号匹配 / 奇数长度剪枝

---

**2. 整数转罗马数字（Integer to Roman）— LeetCode 12**

**题目：** 将整数 1-3999 转为罗马数字。

**输入输出：**

```
3749  → "MMMDCCXLIX"
58    → "LVIII"
1994  → "MCMXCIV"
```

**思路：** 贪心法。将所有可能的罗马数字值从大到小排列（包括特殊减法形式：900/400/90/40/9/4），每次取最大可能值，直到数字为 0。

**代码：**

```javascript
/**
 * @param {number} num
 * @return {string}
 */
function intToRoman(num) {
  const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const symbols = [
    "M",
    "CM",
    "D",
    "CD",
    "C",
    "XC",
    "L",
    "XL",
    "X",
    "IX",
    "V",
    "IV",
    "I",
  ];

  let result = "";
  for (let i = 0; i < values.length; i++) {
    while (num >= values[i]) {
      result += symbols[i];
      num -= values[i];
    }
  }
  return result;
}
```

**复杂度：** O(1) 时间（最多 15 次循环，因为 num ≤ 3999），O(1) 空间

**考点：** 贪心策略 / 特殊减法形式处理 / 映射表

**与 LC13 的关系：** LC13 是罗马→整数（从左到右比较相邻），LC12 是整数→罗马（贪心取最大符号），两者互为逆运算。

---

**3. 删除有序数组中的重复项（Remove Duplicates from Sorted Array）— LeetCode 26**

**题目：** 给定非严格递增排列的数组 nums，原地删除重复元素，使每个元素只出现一次，返回新长度。不能使用额外数组空间。

**输入输出：**

```
[1,1,2]           → 2, nums = [1,2,_]
[0,0,1,1,1,2,2,3,3,4] → 5, nums = [0,1,2,3,4,_,_,_,_,_]
```

**思路：** 快慢双指针。慢指针 slow 指向不重复部分的末尾，快指针 fast 遍历整个数组。当 nums[fast] ≠ nums[slow] 时，slow++ 并赋值 nums[slow] = nums[fast]。

**代码：**

```javascript
/**
 * @param {number[]} nums
 * @return {number}
 */
function removeDuplicates(nums) {
  if (nums.length === 0) return 0;

  let slow = 0;
  for (let fast = 1; fast < nums.length; fast++) {
    if (nums[fast] !== nums[slow]) {
      slow++;
      nums[slow] = nums[fast];
    }
  }

  return slow + 1;
}
```

**复杂度：** O(n) 时间（一次遍历），O(1) 空间（原地修改）

**考点：** 快慢双指针 / 原地修改 / 有序数组去重

---

### 中等题（2道）

---

**4. 三数之和（3Sum）— LeetCode 15**

**题目：** 给定整数数组 nums，找出所有和为 0 的不重复三元组 [a, b, c]。

**输入输出：**

```
[-1,0,1,2,-1,-4] → [[-1,-1,2],[-1,0,1]]
[0,1,1]          → []
[0,0,0]          → [[0,0,0]]
```

**思路：** 排序 + 双指针。先排序，固定第一个数 nums[i]，然后用左右双指针在 i+1 到末尾找两数之和 = -nums[i]。关键：每层循环都要跳过重复元素来去重。

**代码：**

```javascript
/**
 * @param {number[]} nums
 * @return {number[][]}
 */
function threeSum(nums) {
  nums.sort((a, b) => a - b);
  const result = [];

  for (let i = 0; i < nums.length - 2; i++) {
    if (i > 0 && nums[i] === nums[i - 1]) continue; // 跳过重复的 i
    if (nums[i] > 0) break; // 最小值 > 0，不可能和为 0

    let left = i + 1,
      right = nums.length - 1;
    while (left < right) {
      const sum = nums[i] + nums[left] + nums[right];

      if (sum === 0) {
        result.push([nums[i], nums[left], nums[right]]);

        // 跳过重复的 left 和 right
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

**复杂度：** O(n²) 时间（排序 O(nlogn) + 外层循环 × 双指针 O(n²)），O(1) 空间（不计结果数组）

**考点：** 排序 + 双指针 / 三层去重（i/left/right 各一层）/ 剪枝优化（nums[i] > 0 break）

**与 LC1 Two Sum 的关系：** Two Sum 用哈希表 O(n)，3Sum 排序+双指针 O(n²)。如果 4Sum 就是 O(n³)，模式一致。

---

**5. 盛最多水的容器（Container With Most Water）— LeetCode 11**

**题目：** 给定 n 个非负整数 a1, a2, ..., an，每个代表坐标 (i, ai) 处的垂直线。找出两条线，与 x 轴构成容器，使其盛水最多。

**输入输出：**

```
[1,8,6,2,5,4,8,3,7] → 49  (选择索引 1 和 8: min(8,7) × 7 = 49)
[1,1]               → 1
```

**思路：** 双指针从两端向中间收缩。每次移动较短的那条线——因为面积 = min(height[left], height[right]) × (right - left)，宽度在减小，只有提高短板才可能增加面积。移动长板毫无意义（高度被短板限制，宽度还减小）。

**代码：**

```javascript
/**
 * @param {number[]} height
 * @return {number}
 */
function maxArea(height) {
  let left = 0,
    right = height.length - 1;
  let maxWater = 0;

  while (left < right) {
    const h = Math.min(height[left], height[right]);
    maxWater = Math.max(maxWater, h * (right - left));

    // 移动较短的线
    if (height[left] < height[right]) {
      left++;
    } else {
      right--;
    }
  }

  return maxWater;
}
```

**复杂度：** O(n) 时间（一次遍历），O(1) 空间

**考点：** 双指针收缩 / 贪心决策（移动短板）/ 面积计算

**为什么移动短板是正确的？** 假设 height[left] < height[right]。如果移动 right 到 right-1，新面积 = min(height[left], height[right-1]) × (right-left-1)。宽度减小了，高度最多还是 height[left]（被短板限制），所以面积只会变小或不变。只有移动 left 才可能找到更高的线来增加面积。

---

## 知识点覆盖

| 知识点        | 对应题目       | 核心思路                     |
| ------------- | -------------- | ---------------------------- |
| 栈 / 括号匹配 | 题1 有效括号   | 左括号入栈，右括号匹配出栈   |
| 贪心 / 映射表 | 题2 整数转罗马 | 从大到小贪心取最大符号       |
| 快慢双指针    | 题3 删除重复项 | slow 指向结果末尾，fast 遍历 |
| 排序 + 双指针 | 题4 三数之和   | 固定一个 + 双指针找另外两个  |
| 双指针收缩    | 题5 盛水容器   | 移动短板，贪心决策           |

## 与往期训练的区别

| 往期已覆盖            | 本次新增                     |
| --------------------- | ---------------------------- |
| LC1 两数之和          | LC20 有效括号（栈）          |
| LC3 无重复最长子串    | LC12 整数转罗马（贪心）      |
| LC13 罗马数字转整数   | LC26 删除重复项（快慢指针）  |
| LC14 最长公共前缀     | LC15 三数之和（排序+双指针） |
| LC21 合并两个有序链表 | LC11 盛水容器（双指针收缩）  |
| LC49 字母异位词分组   | —                            |
| LC169 多数元素        | —                            |
| LC217 存在重复        | —                            |
| LC242 字母异位词      | —                            |
| LC409 最长回文串      | —                            |
| LC55 跳跃游戏         | —                            |
| LC66 加一             | —                            |
| LC121 股票最大利润    | —                            |
| LC125 验证回文串      | —                            |
| LC128 最长连续序列    | —                            |
| LC167 有序两数之和    | —                            |
| LC238 除自身以外乘积  | —                            |
| LC268 缺失数字        | —                            |
| LC274 H指数           | —                            |
| LC387 第一个唯一字符  | —                            |
| LC443 字符串压缩      | —                            |
| LC560 和为K的子数组   | —                            |
| LC567 字符串排列      | —                            |

**本次新增算法：** 栈括号匹配、贪心映射表、快慢双指针去重、排序+双指针三数之和、双指针收缩贪心

**累计覆盖：** 34 道独特 LeetCode 题目

## 训练总结

| #   | 题号 | 难度 | 核心技巧              | 时间  | 空间 |
| --- | ---- | ---- | --------------------- | ----- | ---- |
| 1   | #20  | 简单 | 栈 / 括号匹配         | O(n)  | O(n) |
| 2   | #12  | 简单 | 贪心 / 映射表         | O(1)  | O(1) |
| 3   | #26  | 简单 | 快慢双指针            | O(n)  | O(1) |
| 4   | #15  | 中等 | 排序 + 双指针 + 去重  | O(n²) | O(1) |
| 5   | #11  | 中等 | 双指针收缩 / 移动短板 | O(n)  | O(1) |

**今日重点：**

1. **栈是括号类问题的标准解法** — 左入右出，最后判空。LC20 是栈入门第一题，后续 LC71（简化路径）、LC84（柱状图最大矩形）、LC85（最大矩形）都基于栈。
2. **贪心转罗马** — 把特殊减法形式（CM/CD/XC/XL/IV/IV）也加入映射表，贪心从大到小取，比逐位处理简洁得多。
3. **快慢双指针** — 有序数组原地去重的标准模式。slow 指向结果末尾，fast 扫描新元素。扩展到"最多保留 2 个重复"（LC80）只需加个计数器。
4. **三数之和** — 面试最高频中等题之一。核心：排序 + 固定一个 + 双指针。三层去重（i/left/right）是易错点。
5. **盛水容器** — 双指针收缩的经典。"移动短板"的贪心决策需要严格证明：移动长板面积必然不增。
