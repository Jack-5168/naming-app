# 专项训练 06：函数式编程 (Functional Programming)

> 2026-05-06 06:00 AM

## 一、核心概念

### 1. 纯函数 (Pure Functions)
- **相同输入 → 相同输出**，无副作用
- 不修改外部状态，不依赖外部可变状态

### 2. 不可变性 (Immutability)
- 数据一旦创建就不能被修改
- "修改" = 创建新数据，而非原地修改

### 3. 函数组合 (Composition)
- `f ∘ g`：先执行 g，再将结果传给 f
- 小函数 → 大函数，像乐高积木

### 4. 柯里化 (Currying)
- 多参数函数 → 一系列单参数函数
- `f(a, b, c)` → `f(a)(b)(c)`
- 天然支持**部分应用 (Partial Application)**

### 5. 高阶函数 (Higher-Order Functions)
- 接受函数作为参数，或返回函数

### 6. 声明式 vs 命令式
- 命令式：描述"怎么做" (for 循环、if-else)
- 声明式：描述"做什么" (map、filter、reduce)

---

## 二、15 个函数式编程示例 (Python)

### 示例 1：纯函数 vs 非纯函数

```python
# ❌ 非纯函数：依赖外部状态 + 修改外部状态
total = 0
def add_to_total(x):
    global total
    total += x
    return total

# ✅ 纯函数：相同输入 → 相同输出，无副作用
def add(a, b):
    return a + b

assert add(2, 3) == 5
assert add(2, 3) == 5  # 可预测
```

### 示例 2：不可变数据操作

```python
# ❌ 命令式：原地修改
def add_item_mutate(lst, item):
    lst.append(item)  # 修改了原列表
    return lst

# ✅ 函数式：返回新列表
def add_item_immutable(lst, item):
    return lst + [item]  # 创建新列表

original = [1, 2, 3]
new_list = add_item_immutable(original, 4)
assert original == [1, 2, 3]  # 原数据不变
assert new_list == [1, 2, 3, 4]
```

### 示例 3：柯里化 (手动实现)

```python
def multiply(x):
    """柯里化的乘法函数"""
    def by(y):
        return x * y
    return by

double = multiply(2)
triple = multiply(3)

assert double(5) == 10
assert triple(5) == 15
assert multiply(2)(3) == 6
```

### 示例 4：柯里化 (通用装饰器)

```python
from functools import partial

def curry(func):
    """将多参数函数柯里化"""
    from functools import wraps
    @wraps(func)
    def curried(*args, **kwargs):
        if len(args) + len(kwargs) >= func.__code__.co_argcount:
            return func(*args, **kwargs)
        return lambda *a, **kw: curried(*(args + a), **{**kwargs, **kw})
    return curried

@curry
def add_three(a, b, c):
    return a + b + c

add_10 = add_three(10)
add_10_20 = add_10(20)

assert add_10_20(30) == 60
assert add_three(1)(2)(3) == 6
```

### 示例 5：函数组合 (Composition)

```python
def compose(*funcs):
    """从右到左组合函数: compose(f, g, h)(x) = f(g(h(x)))"""
    def composed(x):
        result = x
        for func in reversed(funcs):
            result = func(result)
        return result
    return composed

def double(x): return x * 2
def add_one(x): return x + 1
def to_str(x): return str(x)

# 先翻倍，再加1，最后转字符串
transform = compose(to_str, add_one, double)
assert transform(5) == "11"  # 5 → 10 → 11 → "11"
```

### 示例 6：管道 (Pipeline，从左到右组合)

```python
def pipe(*funcs):
    """从左到右管道: pipe(f, g, h)(x) = h(g(f(x)))"""
    def piped(x):
        result = x
        for func in funcs:
            result = func(result)
        return result
    return piped

# 数据清洗管道
def strip_ws(s): return s.strip()
def lower(s): return s.lower()
def remove_vowels(s): return ''.join(c for c in s if c not in 'aeiou')

clean = pipe(lambda s: s.strip(), lambda s: s.lower(), remove_vowels)
assert clean("  Hello World  ") == "hllwrld"
```

### 示例 7：map — 映射转换

```python
# 命令式
def squares_imperative(nums):
    result = []
    for n in nums:
        result.append(n ** 2)
    return result

# 函数式
def squares_functional(nums):
    return list(map(lambda x: x ** 2, nums))

assert squares_functional([1, 2, 3, 4]) == [1, 4, 9, 16]

# 组合 map + 柯里化
def map_curried(func):
    return lambda iterable: list(map(func, iterable))

double_all = map_curried(lambda x: x * 2)
assert double_all([1, 2, 3]) == [2, 4, 6]
```

### 示例 8：filter — 过滤

```python
def filter_curried(predicate):
    return lambda iterable: list(filter(predicate, iterable))

is_even = lambda x: x % 2 == 0
keep_evens = filter_curried(is_even)

assert keep_evens([1, 2, 3, 4, 5, 6]) == [2, 4, 6]

# 组合 filter + map：先过滤再转换
def is_prime(n):
    if n < 2: return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0: return False
    return True

primes_squared = compose(
    map_curried(lambda x: x ** 2),
    filter_curried(is_prime)
)(list(range(1, 20)))

assert primes_squared == [4, 9, 25, 49, 121, 169, 289, 361]
```

### 示例 9：reduce — 归约

```python
from functools import reduce

# 求和
total = reduce(lambda acc, x: acc + x, [1, 2, 3, 4, 5], 0)
assert total == 15

# 求积
product = reduce(lambda acc, x: acc * x, [1, 2, 3, 4, 5], 1)
assert product == 120

# 合并字典
def merge_dicts(acc, d):
    return {**acc, **d}

combined = reduce(merge_dicts, [{'a': 1}, {'b': 2}, {'c': 3}], {})
assert combined == {'a': 1, 'b': 2, 'c': 3}

# reduce 柯里化
def reduce_curried(func, initializer):
    return lambda iterable: reduce(func, iterable, initializer)

sum_all = reduce_curried(lambda a, b: a + b, 0)
assert sum_all([10, 20, 30]) == 60
```

### 示例 10：不可变字典操作

```python
# 使用 dict unpacking 实现不可变更新
def set_key(d, k, v):
    """返回新字典，添加/更新一个键"""
    return {**d, k: v}

def remove_key(d, k):
    """返回新字典，移除一个键"""
    return {key: val for key, val in d.items() if key != k}

def update_nested(d, keys, value):
    """深层更新（不可变）"""
    if len(keys) == 1:
        return {**d, keys[0]: value}
    return {**d, keys[0]: update_nested(d.get(keys[0], {}), keys[1:], value)}

config = {'db': {'host': 'localhost', 'port': 5432}, 'debug': True}
new_config = update_nested(config, ['db', 'port'], 3306)

assert config['db']['port'] == 5432  # 原配置不变
assert new_config['db']['port'] == 3306  # 新配置已更新
```

### 示例 11：部分应用 (Partial Application)

```python
from functools import partial

def greet(greeting, name, punctuation):
    return f"{greeting}, {name}{punctuation}"

# 固定部分参数
hello = partial(greet, "Hello")
hello_chinese = partial(greet, "你好")

assert hello("Alice", "!") == "Hello, Alice!"
assert hello_chinese("小明", "！") == "你好，小明！"

# 柯里化版本
def greet_curried(greeting):
    def inner(name):
        def innermost(punctuation):
            return f"{greeting}, {name}{punctuation}"
        return innermost
    return inner

greet_en = greet_curried("Hello")
assert greet_en("Bob")(".") == "Hello, Bob."
```

### 示例 12：Monad 概念 — Maybe/Option

```python
class Maybe:
    """Maybe Monad：安全处理可能为 None 的值"""
    def __init__(self, value):
        self.value = value

    @staticmethod
    def of(value):
        return Just(value) if value is not None else Nothing()

    def map(self, func):
        raise NotImplementedError

    def bind(self, func):
        raise NotImplementedError

class Just(Maybe):
    def __init__(self, value):
        super().__init__(value)

    def map(self, func):
        return Maybe.of(func(self.value))

    def bind(self, func):
        return func(self.value)

    def __repr__(self):
        return f"Just({self.value})"

class Nothing(Maybe):
    def __init__(self):
        super().__init__(None)

    def map(self, func):
        return self

    def bind(self, func):
        return self

    def __repr__(self):
        return "Nothing"

# 使用
def safe_divide(a, b):
    return Maybe.of(a / b) if b != 0 else Nothing()

def sqrt(x):
    return Maybe.of(x ** 0.5) if x >= 0 else Nothing()

# 链式调用：任何一步失败，整体返回 Nothing
result = Maybe.of(16).bind(sqrt).map(lambda x: x * 2)
assert result.value == 4.0

# 除以零 → Nothing
result = safe_divide(10, 0).map(lambda x: x * 2)
assert isinstance(result, Nothing)
```

### 示例 13：纯函数式递归 — 快速排序

```python
def quicksort(lst):
    """函数式快速排序（不可变）"""
    if not lst:
        return []
    pivot = lst[0]
    less = quicksort([x for x in lst[1:] if x <= pivot])
    greater = quicksort([x for x in lst[1:] if x > pivot])
    return less + [pivot] + greater

assert quicksort([3, 1, 4, 1, 5, 9, 2, 6]) == [1, 1, 2, 3, 4, 5, 6, 9]
```

### 示例 14：函数式数据转换管道

```python
# 模拟电商订单处理
orders = [
    {'id': 1, 'items': [10, 20, 30], 'status': 'paid', 'country': 'CN'},
    {'id': 2, 'items': [5, 15], 'status': 'pending', 'country': 'US'},
    {'id': 3, 'items': [100, 200, 300, 400], 'status': 'paid', 'country': 'CN'},
    {'id': 4, 'items': [50], 'status': 'paid', 'country': 'JP'},
]

# 纯函数式管道
def get_total(order):
    return {**order, 'total': sum(order['items'])}

def add_shipping(order):
    shipping = 10 if order['country'] == 'CN' else 20
    return {**order, 'shipping': shipping, 'final': order['total'] + shipping}

def is_eligible(order):
    return order['status'] == 'paid' and order['total'] >= 50

def add_discount(order):
    discount = order['final'] * 0.1 if order['final'] >= 200 else 0
    return {**order, 'discount': discount, 'payable': order['final'] - discount}

# 构建管道
process_order = pipe(
    get_total,
    add_shipping,
    add_discount,
)

# 处理所有已支付订单
processed = list(map(process_order, filter(is_eligible, orders)))

assert len(processed) == 2  # 只有 id=1 和 id=3 符合条件
assert processed[0]['id'] == 1
assert processed[0]['payable'] == 60  # 60 + 10 - 0
assert processed[1]['id'] == 3
assert processed[1]['payable'] == 990  # 1000 - 100 (10% discount)
```

### 示例 15：函数式错误处理 — Result Monad

```python
class Result:
    """Result Monad: Ok / Err"""
    def __init__(self, value=None, error=None):
        self.value = value
        self.error = error

    @staticmethod
    def ok(value):
        return Result(value=value)

    @staticmethod
    def err(error):
        return Result(error=error)

    def is_ok(self):
        return self.error is None

    def map(self, func):
        return Result.ok(func(self.value)) if self.is_ok() else self

    def bind(self, func):
        return func(self.value) if self.is_ok() else self

    def unwrap_or(self, default):
        return self.value if self.is_ok() else default

# 安全解析 JSON
import json

def parse_json(s):
    try:
        return Result.ok(json.loads(s))
    except json.JSONDecodeError as e:
        return Result.err(str(e))

def get_field(data, field):
    if field in data:
        return Result.ok(data[field])
    return Result.err(f"Field '{field}' not found")

def to_int(s):
    try:
        return Result.ok(int(s))
    except (ValueError, TypeError):
        return Result.err(f"Cannot convert '{s}' to int")

# 链式处理
result = (parse_json('{"age": "25"}')
          .bind(lambda d: get_field(d, 'age'))
          .bind(to_int))

assert result.is_ok()
assert result.value == 25

# 错误传播
result = (parse_json('invalid json')
          .bind(lambda d: get_field(d, 'age'))
          .bind(to_int))

assert result.is_ok() is False
assert result.unwrap_or(0) == 0
```

---

## 三、关键总结

| 概念 | 一句话 | 关键价值 |
|------|--------|----------|
| 纯函数 | 相同输入 → 相同输出，无副作用 | 可测试、可缓存、可并行 |
| 不可变性 | 不修改数据，创建新数据 | 无竞态、可回溯、线程安全 |
| 柯里化 | 多参函数 → 单参函数链 | 部分应用、函数工厂 |
| 组合 | f(g(h(x))) | 小函数 → 大逻辑，乐高式编程 |
| 高阶函数 | 函数是第一公民 | map/filter/reduce 是核心武器 |
| Monad | 带上下文的值 + 链式操作 | 优雅处理副作用/错误/异步 |

## 四、FP 思维转变

```
命令式思维：
  "我要遍历列表，逐个处理，存到变量里，最后返回"

函数式思维：
  "我要描述数据的变换管道：过滤 → 映射 → 归约"
```

**记住：FP 不是不用变量，而是让数据流动像水一样——从一个函数流到下一个函数，中间不被污染。**
