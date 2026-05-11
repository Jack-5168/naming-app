# 装饰器模式 (Decorator Pattern)

## 核心思想
动态地为对象添加额外功能，而不改变其原始结构。通过组合而非继承实现功能扩展，遵循开闭原则。

## JS 原生体现
- 函数组合（compose/pipeline）
- HOC（高阶组件）— React 装饰组件
- Middleware 中间件 — Express/Koa 洋葱模型
- ES2022 Decorator 语法（`@decorator`）— TS/Stage 3

## 与代理模式的区别
| 维度 | 装饰器模式 | 代理模式 |
|------|------------|----------|
| 目的 | 增强功能 | 控制访问 |
| 接口 | 保持相同接口 | 保持相同接口 |
| 关系 | "我有额外功能" | "我替你挡一下" |
| 组合 | 多个装饰器可叠加 | 通常一个代理 |

---

## 实现一：函数装饰器（基础）

```javascript
// ============ 函数装饰器 — 基础 ============

// 装饰器工厂：添加日志
function withLogging(fn, label = fn.name) {
  return function (...args) {
    console.log(`[LOG] ${label} 调用, 参数:`, args);
    const start = performance.now();
    const result = fn.apply(this, args);
    const duration = (performance.now() - start).toFixed(2);
    console.log(`[LOG] ${label} 返回:`, result, `耗时: ${duration}ms`);
    return result;
  };
}

// 装饰器工厂：重试
function withRetry(fn, maxRetries = 3, delay = 100) {
  return async function (...args) {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn.apply(this, args);
      } catch (err) {
        console.warn(`[Retry] ${fn.name} 第 ${i + 1} 次失败:`, err.message);
        if (i === maxRetries) throw err;
        await new Promise(r => setTimeout(r, delay * (i + 1)));
      }
    }
  };
}

// 装饰器工厂：缓存
function withCache(fn, keyFn = JSON.stringify, ttl = 60000) {
  const cache = new Map();
  return function (...args) {
    const key = keyFn(args);
    const entry = cache.get(key);
    if (entry && Date.now() - entry.time < ttl) {
      console.log(`[Cache] 命中: ${key}`);
      return entry.value;
    }
    const result = fn.apply(this, args);
    cache.set(key, { value: result, time: Date.now() });
    return result;
  };
}

// ============ 使用 ============
function fetchUser(id) {
  console.log(`[API] 请求用户 ${id}`);
  return { id, name: 'Alice', email: 'alice@example.com' };
}

// 叠加多个装饰器
const cachedFetchUser = withCache(withLogging(fetchUser, 'fetchUser'));
cachedFetchUser(1);  // [LOG] → [API] → [LOG] 返回
cachedFetchUser(1);  // [Cache] 命中（跳过 API 和 LOG）
cachedFetchUser(2);  // [LOG] → [API] → [LOG] 返回（新参数）
```

## 实现二：Koa 洋葱模型（中间件装饰）

```javascript
// ============ Koa 洋葱模型 — 中间件装饰 ============

class KoaLike {
  constructor() { this.middlewares = []; }

  use(fn) {
    this.middlewares.push(fn);
    return this;
  }

  // 核心：compose 将中间件数组组合成嵌套调用
  compose(ctx) {
    return dispatch(0);

    function dispatch(i) {
      if (i === this.middlewares.length) return Promise.resolve();
      const fn = this.middlewares[i];
      return Promise.resolve(fn(ctx, () => dispatch(i + 1)));
    }
  }

  async listen(port) {
    const ctx = { url: '/', method: 'GET', body: null, status: 200, headers: {} };
    console.log(`\n=== 请求: ${ctx.method} ${ctx.url} ===`);
    await this.compose(ctx);
    console.log(`=== 响应: ${ctx.status} ${JSON.stringify(ctx.body)} ===\n`);
  }
}

// ============ 中间件（装饰器） ============

// 1. 日志中间件
function logger(ctx, next) {
  const start = Date.now();
  console.log(`  [Logger] → ${ctx.method} ${ctx.url}`);
  return next().then(() => {
    const ms = Date.now() - start;
    console.log(`  [Logger] ← ${ctx.status} ${ms}ms`);
  });
}

// 2. 认证中间件
function auth(ctx, next) {
  const token = ctx.headers['authorization'];
  if (!token) {
    ctx.status = 401;
    ctx.body = { error: '未授权' };
    return Promise.resolve(); // 短路，不调用 next
  }
  console.log(`  [Auth] 用户已认证`);
  ctx.user = { id: 1, role: 'admin' };
  return next();
}

// 3. 路由中间件
function router(ctx, next) {
  if (ctx.url === '/api/users') {
    ctx.body = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
    return Promise.resolve();
  }
  if (ctx.url === '/api/orders') {
    ctx.body = [{ id: 101, total: 299 }];
    return Promise.resolve();
  }
  return next();
}

// 4. 错误处理中间件
function errorHandler(ctx, next) {
  return next().catch(err => {
    console.error(`  [Error] ${err.message}`);
    ctx.status = 500;
    ctx.body = { error: '服务器内部错误' };
  });
}

// 5. 响应格式化中间件
function formatResponse(ctx, next) {
  return next().then(() => {
    if (ctx.body !== null) {
      ctx.body = {
        success: ctx.status < 400,
        data: ctx.body,
        timestamp: new Date().toISOString()
      };
    }
  });
}

// ============ 组装应用 ============
const app = new KoaLike();
app.use(errorHandler);      // 最外层（最先执行，最后结束）
app.use(logger);            // 第二层
app.use(auth);              // 第三层
app.use(router);            // 第四层
app.use(formatResponse);    // 最内层（最后执行，最先结束）

// ============ 测试 ============
// 测试 1: 正常请求
app.listen(3000);
// 模拟有 token 的请求
// ctx.headers['authorization'] = 'Bearer token123';

// 测试 2: 未认证请求（auth 中间件短路）
// 输出: Logger → Auth(401) → Logger
```

## 实现三：类装饰器（ES2022 语法风格）

```javascript
// ============ 类装饰器 — 手动实现（模拟 @decorator） ============

// 装饰器：自动绑定 this
function autobind(target) {
  const descriptor = Object.getOwnPropertyDescriptors(target.prototype);
  for (const [key, desc] of Object.entries(descriptor)) {
    if (typeof desc.value === 'function' && key !== 'constructor') {
      desc.value = desc.value.bind(target.prototype);
      Object.defineProperty(target.prototype, key, desc);
    }
  }
  return target;
}

// 装饰器：添加静态属性
function withStatic(props) {
  return function (target) {
    Object.assign(target, props);
    return target;
  };
}

// 装饰器：序列化
function serializable(target) {
  target.prototype.toJSON = function () {
    const result = {};
    for (const key of Object.keys(this)) {
      if (typeof this[key] !== 'function') {
        result[key] = this[key];
      }
    }
    return result;
  };
  return target;
}

// ============ 使用 ============
@autobind
@withStatic({ tableName: 'users' })
@serializable
class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }

  greet() { return `Hello, ${this.name}!`; }
}

// 等价于手动装饰：
// User = serializable(withStatic({ tableName: 'users' })(autobind(User)));

const user = new User('Alice', 'alice@example.com');
console.log(user.toJSON());  // { name: 'Alice', email: 'alice@example.com' }
console.log(User.tableName); // "users"
```

## 实现四：对象装饰器（经典 GoF 风格）

```javascript
// ============ 对象装饰器 — 咖啡点单系统 ============

// 组件接口
class Coffee {
  cost() { return 0; }
  description() { return ''; }
}

// 具体组件
class Espresso extends Coffee {
  cost() { return 30; }
  description() { return '浓缩咖啡'; }
}

class Latte extends Coffee {
  cost() { return 35; }
  description() { return '拿铁'; }
}

// 装饰器基类
class CoffeeDecorator extends Coffee {
  constructor(coffee) { super(); this.coffee = coffee; }
  cost() { return this.coffee.cost(); }
  description() { return this.coffee.description(); }
}

// 具体装饰器
class Milk extends CoffeeDecorator {
  cost() { return super.cost() + 5; }
  description() { return `${super.description()} + 牛奶`; }
}

class Sugar extends CoffeeDecorator {
  cost() { return super.cost() + 2; }
  description() { return `${super.description()} + 糖`; }
}

class WhippedCream extends CoffeeDecorator {
  cost() { return super.cost() + 8; }
  description() { return `${super.description()} + 奶油`; }
}

class Caramel extends CoffeeDecorator {
  cost() { return super.cost() + 10; }
  description() { return `${super.description()} + 焦糖`; }
}

// ============ 使用 ============
let coffee = new Latte();
console.log(`${coffee.description()} = ¥${coffee.cost()}`);
// 拿铁 = ¥35

coffee = new Milk(coffee);
console.log(`${coffee.description()} = ¥${coffee.cost()}`);
// 拿铁 + 牛奶 = ¥40

coffee = new Caramel(coffee);
coffee = new WhippedCream(coffee);
console.log(`${coffee.description()} = ¥${coffee.cost()}`);
// 拿铁 + 牛奶 + 焦糖 + 奶油 = ¥58

// 链式写法
const fancyCoffee = new WhippedCream(
  new Caramel(
    new Milk(
      new Espresso()
    )
  )
);
console.log(`${fancyCoffee.description()} = ¥${fancyCoffee.cost()}`);
// 浓缩咖啡 + 牛奶 + 焦糖 + 奶油 = ¥53
```

## 实现五：方法装饰器（属性描述符）

```javascript
// ============ 方法装饰器 — 属性描述符风格 ============

// 装饰器：防抖
function debounce(ms) {
  return function (target, propertyKey, descriptor) {
    const original = descriptor.value;
    let timer = null;
    descriptor.value = function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => original.apply(this, args), ms);
    };
    return descriptor;
  };
}

// 装饰器：节流
function throttle(ms) {
  return function (target, propertyKey, descriptor) {
    const original = descriptor.value;
    let lastCall = 0;
    descriptor.value = function (...args) {
      const now = Date.now();
      if (now - lastCall >= ms) {
        lastCall = now;
        return original.apply(this, args);
      }
    };
    return descriptor;
  };
}

// 装饰器：访问控制
function requireRole(role) {
  return function (target, propertyKey, descriptor) {
    const original = descriptor.value;
    descriptor.value = function (...args) {
      if (this.user?.role !== role) {
        throw new Error(`需要 ${role} 权限`);
      }
      return original.apply(this, args);
    };
    return descriptor;
  };
}

// ============ 使用 ============
class SearchController {
  constructor() { this.user = { role: 'admin' }; }

  @debounce(300)
  onSearchInput(query) {
    console.log(`[Search] 搜索: ${query}`);
    // 实际会发送 API 请求
  }

  @throttle(1000)
  onScroll() {
    console.log('[Scroll] 加载更多数据');
  }

  @requireRole('admin')
  deleteUser(userId) {
    console.log(`[Admin] 删除用户 ${userId}`);
  }
}

// ============ 手动应用装饰器（无 TS 编译） ============
// 手动模拟 @decorator 语法
function applyDecorators(proto, key, ...decorators) {
  const descriptor = Object.getOwnPropertyDescriptor(proto, key);
  for (const dec of decorators) {
    dec(proto, key, descriptor);
  }
}

applyDecorators(SearchController.prototype, 'onSearchInput', debounce(300));
applyDecorators(SearchController.prototype, 'onScroll', throttle(1000));
applyDecorators(SearchController.prototype, 'deleteUser', requireRole('admin'));
```

## 要点总结
1. **装饰器 vs 代理**: 装饰器增强功能（加法），代理控制访问（门卫）
2. **装饰器可叠加**: 多个装饰器组合使用，洋葱模型是经典应用
3. **Koa 中间件 = 装饰器链**: `compose` 将数组变成嵌套 Promise 链
4. **ES2022 Decorator**: `@decorator` 语法已进 Stage 3，TS 已支持
5. **核心原则**: 开闭原则 — 对扩展开放，对修改关闭
6. **函数装饰器最灵活**: `withLogging(fn)` 模式适用于任何函数
