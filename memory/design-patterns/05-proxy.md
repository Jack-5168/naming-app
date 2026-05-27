# 代理模式 (Proxy Pattern)

## 核心思想

为另一个对象提供一个代理（占位符），控制对这个对象的访问。在访问目标对象前后插入自定义逻辑。

## JS 原生体现

- `Proxy` — ES6 内置代理 API
- `Object.defineProperty` — Vue 2 响应式（已被 Proxy 取代）
- DOM 事件委托 — 父元素代理子元素事件

## 与观察者的区别

| 维度 | 代理模式            | 观察者模式                |
| ---- | ------------------- | ------------------------- |
| 关系 | 一对一（代理→目标） | 一对多（主题→多个观察者） |
| 目的 | 控制访问、拦截操作  | 状态变化通知              |
| 时机 | 操作发生时拦截      | 状态变化后通知            |

---

## 实现一：基础 Proxy — 属性拦截

```javascript
// ============ 基础 Proxy — get/set 拦截 ============

const user = { name: "Alice", age: 25, role: "user" };

const userProxy = new Proxy(user, {
  get(target, prop, receiver) {
    // 拦截读取：隐藏私有属性
    if (typeof prop === "string" && prop.startsWith("_")) {
      console.warn(`[Proxy] 禁止访问私有属性: ${prop}`);
      return undefined;
    }
    console.log(`[Proxy] 读取: ${prop} = ${target[prop]}`);
    return Reflect.get(target, prop, receiver);
  },

  set(target, prop, value, receiver) {
    // 拦截写入：类型校验
    if (prop === "age") {
      if (typeof value !== "number" || value < 0 || value > 150) {
        throw new TypeError(`[Proxy] age 必须是 0-150 的数字，收到: ${value}`);
      }
    }
    if (prop === "role" && !["user", "admin", "moderator"].includes(value)) {
      throw new TypeError(`[Proxy] 非法 role: ${value}`);
    }
    console.log(`[Proxy] 设置: ${prop} = ${value}`);
    return Reflect.set(target, prop, value, receiver);
  },
});

// ============ 使用 ============
console.log(userProxy.name); // [Proxy] 读取: name = Alice → "Alice"
userProxy.age = 30; // [Proxy] 设置: age = 30 → true
// userProxy.age = -5;              // ❌ TypeError
// userProxy.role = 'hacker';       // ❌ TypeError
console.log(userProxy._secret); // [Proxy] 禁止访问私有属性: _secret → undefined
```

## 实现二：响应式系统（Vue 3 核心）

```javascript
// ============ 响应式系统 — Proxy 实现 ============

// 全局依赖收集表：targetMap → key → Set<effect>
const targetMap = new WeakMap();
let activeEffect = null;

function track(target, key) {
  if (!activeEffect) return;
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = new Map();
    targetMap.set(target, depsMap);
  }
  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set();
    depsMap.set(key, dep);
  }
  dep.add(activeEffect);
}

function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const dep = depsMap.get(key);
  if (dep) {
    dep.forEach((effect) => effect());
  }
}

function reactive(target) {
  if (typeof target !== "object" || target === null) return target;

  return new Proxy(target, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver);
      track(target, key);
      // 嵌套对象也变成响应式（惰性代理）
      return typeof result === "object" && result !== null
        ? reactive(result)
        : result;
    },
    set(target, key, value, receiver) {
      const hadKey = Reflect.has(target, key);
      const oldValue = target[key];
      const result = Reflect.set(target, key, value, receiver);
      // 值真正变化时才触发
      if (hadKey && oldValue !== value) {
        trigger(target, key);
      } else if (!hadKey) {
        trigger(target, key);
      }
      return result;
    },
    deleteProperty(target, key) {
      const result = Reflect.deleteProperty(target, key);
      trigger(target, key);
      return result;
    },
  });
}

function effect(fn) {
  activeEffect = fn;
  fn(); // 执行时触发 get → track
  activeEffect = null;
}

// ============ 使用 ============
const state = reactive({ count: 0, user: { name: "Bob" } });

effect(() => {
  console.log(`[Effect] count 变化为: ${state.count}`);
});

state.count = 1; // [Effect] count 变化为: 1
state.count = 2; // [Effect] count 变化为: 2
state.user.name = "Charlie"; // 嵌套响应式也生效
```

## 实现三：缓存代理

```javascript
// ============ 缓存代理 — 计算结果缓存 ============

function createCachedProxy(computeFn, keyFn = JSON.stringify) {
  const cache = new Map();

  return new Proxy(computeFn, {
    apply(target, thisArg, args) {
      const key = keyFn(args);
      if (cache.has(key)) {
        console.log(`[Cache] 命中: ${key}`);
        return cache.get(key);
      }
      console.log(`[Cache] 未命中，计算: ${key}`);
      const result = Reflect.apply(target, thisArg, args);
      cache.set(key, result);
      return result;
    },
  });
}

// ============ 使用 ============
const fibonacci = createCachedProxy(function fib(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
});

console.log(fibonacci(10)); // [Cache] 未命中，计算 → 55
console.log(fibonacci(10)); // [Cache] 命中 → 55
console.log(fibonacci(20)); // [Cache] 未命中，计算 → 6765
```

## 实现四：只读代理

```javascript
// ============ 只读代理 — 深只读 ============

function readonly(target) {
  if (typeof target !== "object" || target === null) return target;

  return new Proxy(target, {
    get(target, key, receiver) {
      const val = Reflect.get(target, key, receiver);
      return typeof val === "object" && val !== null ? readonly(val) : val;
    },
    set() {
      throw new Error("[Readonly] 只读对象不能修改");
    },
    deleteProperty() {
      throw new Error("[Readonly] 只读对象不能删除属性");
    },
    defineProperty() {
      throw new Error("[Readonly] 只读对象不能定义属性");
    },
    setPrototypeOf() {
      throw new Error("[Readonly] 只读对象不能修改原型");
    },
  });
}

// ============ 使用 ============
const config = readonly({
  api: { baseURL: "https://api.example.com", timeout: 5000 },
  features: ["auth", "cache"],
});

// config.api.timeout = 10000;  // ❌ Error: 只读对象不能修改
// delete config.features[0];   // ❌ Error
console.log(config.api.baseURL); // ✅ "https://api.example.com"
```

## 实现五：函数参数校验代理

```javascript
// ============ 函数参数校验代理 ============

function validateParams(fn, validators) {
  return new Proxy(fn, {
    apply(target, thisArg, args) {
      args.forEach((arg, i) => {
        if (validators[i]) {
          const error = validators[i](arg);
          if (error) throw new TypeError(`参数 ${i} 校验失败: ${error}`);
        }
      });
      return Reflect.apply(target, thisArg, args);
    },
  });
}

// ============ 使用 ============
const createUser = validateParams(
  (name, age, email) => ({ name, age, email, id: Date.now() }),
  [
    (v) =>
      typeof v !== "string" || !v.trim() ? "name 必须是非空字符串" : null,
    (v) => (typeof v !== "number" || v < 18 ? "age 必须 ≥ 18" : null),
    (v) => (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "email 格式不正确" : null),
  ],
);

console.log(createUser("Alice", 25, "alice@example.com"));
// { name: 'Alice', age: 25, email: 'alice@example.com', id: ... }

// createUser('Bob', 16, 'bob@example.com');  // ❌ TypeError: age 必须 ≥ 18
// createUser('', 25, 'bad-email');           // ❌ TypeError: name 必须是非空字符串
```

## 实现六：DOM 事件委托代理

```javascript
// ============ DOM 事件委托代理 ============

class EventDelegate {
  constructor(container) {
    this.container = container;
    this.handlers = new Map(); // selector → Map<event, callback>
  }

  on(selector, event, callback) {
    if (!this.handlers.has(selector)) {
      this.handlers.set(selector, new Map());
    }
    this.handlers.get(selector).set(event, callback);

    // 在容器上只注册一次事件监听
    if (!this.container._delegated) {
      this.container._delegated = true;
      this.container.addEventListener("click", (e) =>
        this._dispatch(e, "click"),
      );
      this.container.addEventListener("input", (e) =>
        this._dispatch(e, "input"),
      );
    }
  }

  _dispatch(e, eventType) {
    for (const [selector, events] of this.handlers) {
      if (events.has(eventType) && e.target.matches(selector)) {
        events.get(eventType).call(e.target, e);
      }
    }
  }
}

// ============ 使用 ============
// const delegate = new EventDelegate(document.getElementById('app'));
// delegate.on('.btn-delete', 'click', (e) => console.log('删除:', e.target.dataset.id));
// delegate.on('.btn-edit', 'click', (e) => console.log('编辑:', e.target.dataset.id));
// delegate.on('input[name="search"]', 'input', (e) => console.log('搜索:', e.target.value));
// 只需在 #app 上注册 2 个事件，所有子元素事件都被代理
```

## 要点总结

1. **Proxy 是 JS 中最强大的设计模式** — 13 种拦截陷阱（get/set/has/delete/apply/construct...）
2. **Vue 3 响应式 = Proxy + track/trigger** — 比 Object.defineProperty 更高效（支持动态属性/数组索引）
3. **Reflect 与 Proxy 配对使用** — 保证默认行为不被破坏
4. **常见应用场景**: 响应式系统、参数校验、缓存、只读保护、日志/性能监控、访问控制
5. **WeakMap 存 targetMap** — 避免内存泄漏（目标对象 GC 时自动清理）
