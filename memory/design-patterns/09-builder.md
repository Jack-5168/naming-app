# 建造者模式 (Builder Pattern)

## 核心思想

将复杂对象的**构建过程**与**表示**分离，使得同样的构建过程可以创建不同的表示。

> 一句话：用链式调用一步步"搭建"复杂对象，而不是塞一堆参数给构造函数。

## 什么时候用

- 对象有很多可选参数（构造函数参数爆炸）
- 对象需要分步骤构建（先 A 后 B 再 C）
- 同一构建流程需要产出不同变体

## 反例：构造函数地狱

```js
// ❌ 8 个参数，谁记得住顺序？
const config = new ServerConfig(
  true, // enableHttps
  443, // port
  "/etc/ssl", // sslPath
  true, // enableCors
  ["*"], // corsOrigins
  30000, // timeout
  true, // enableLogging
  "info", // logLevel
);
```

## 实现 1：基础 Builder（链式调用）

```js
class ServerConfigBuilder {
  constructor() {
    this.config = {
      enableHttps: false,
      port: 8080,
      sslPath: null,
      enableCors: false,
      corsOrigins: [],
      timeout: 10000,
      enableLogging: false,
      logLevel: "warn",
    };
  }

  enableHttps(path) {
    this.config.enableHttps = true;
    this.config.port = 443;
    this.config.sslPath = path;
    return this; // 链式调用关键
  }

  cors(origins) {
    this.config.enableCors = true;
    this.config.corsOrigins = origins;
    return this;
  }

  timeout(ms) {
    this.config.timeout = ms;
    return this;
  }

  logging(level = "info") {
    this.config.enableLogging = true;
    this.config.logLevel = level;
    return this;
  }

  build() {
    // 构建时校验
    if (this.config.enableHttps && !this.config.sslPath) {
      throw new Error("HTTPS enabled but no SSL path provided");
    }
    return Object.freeze({ ...this.config }); // 返回不可变对象
  }
}

// ✅ 清晰、可读、按需组合
const config = new ServerConfigBuilder()
  .enableHttps("/etc/ssl/cert")
  .cors(["https://example.com", "https://app.example.com"])
  .timeout(30000)
  .logging("debug")
  .build();

console.log(config);
// {
//   enableHttps: true, port: 443, sslPath: '/etc/ssl/cert',
//   enableCors: true, corsOrigins: ['https://example.com', 'https://app.example.com'],
//   timeout: 30000, enableLogging: true, logLevel: 'debug'
// }
```

## 实现 2：HTTP 请求 Builder（真实场景）

```js
class HttpRequestBuilder {
  constructor(method, url) {
    this.request = { method, url, headers: {}, params: {} };
  }

  header(key, value) {
    this.request.headers[key] = value;
    return this;
  }

  auth(token) {
    this.request.headers["Authorization"] = `Bearer ${token}`;
    return this;
  }

  query(key, value) {
    this.request.params[key] = value;
    return this;
  }

  json(body) {
    this.request.headers["Content-Type"] = "application/json";
    this.request.body = JSON.stringify(body);
    return this;
  }

  timeout(ms) {
    this.request.timeout = ms;
    return this;
  }

  retry(times) {
    this.request.retry = times;
    return this;
  }

  async send() {
    const url = new URL(this.request.url, "https://api.example.com");
    Object.entries(this.request.params).forEach(([k, v]) =>
      url.searchParams.append(k, v),
    );

    const opts = {
      method: this.request.method,
      headers: this.request.headers,
      ...(this.request.body && { body: this.request.body }),
      ...(this.request.timeout && {
        signal: AbortSignal.timeout(this.request.timeout),
      }),
    };

    let lastError;
    const attempts = (this.request.retry ?? 0) + 1;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch(url.toString(), opts);
        return res.ok
          ? await res.json()
          : { error: res.status, data: await res.text() };
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }
}

// 使用示例
const response = await new HttpRequestBuilder("GET", "/api/users")
  .auth("eyJhbGciOiJIUzI1NiJ9...")
  .query("page", 1)
  .query("limit", 20)
  .query("sort", "created_at")
  .timeout(5000)
  .retry(2)
  .send();

// POST 示例
const created = await new HttpRequestBuilder("POST", "/api/users")
  .auth("eyJhbGciOiJIUzI1NiJ9...")
  .json({ name: "Alice", email: "alice@example.com" })
  .timeout(10000)
  .send();
```

## 实现 3：SQL 查询 Builder（复杂场景）

```js
class QueryBuilder {
  constructor() {
    this._clauses = {
      select: ["*"],
      from: null,
      where: [],
      groupBy: [],
      having: [],
      orderBy: [],
      limit: null,
      offset: null,
    };
  }

  static create(table) {
    const qb = new QueryBuilder();
    qb._clauses.from = table;
    return qb;
  }

  select(...columns) {
    this._clauses.select = columns.length ? columns : ["*"];
    return this;
  }

  where(condition, value) {
    this._clauses.where.push({ condition, value });
    return this;
  }

  whereRaw(sql) {
    this._clauses.where.push({ raw: sql });
    return this;
  }

  groupBy(...columns) {
    this._clauses.groupBy.push(...columns);
    return this;
  }

  having(condition, value) {
    this._clauses.having.push({ condition, value });
    return this;
  }

  orderBy(column, direction = "ASC") {
    this._clauses.orderBy.push({ column, direction });
    return this;
  }

  limit(n) {
    this._clauses.limit = n;
    return this;
  }

  offset(n) {
    this._clauses.offset = n;
    return this;
  }

  toSQL() {
    const c = this._clauses;
    let sql = `SELECT ${c.select.join(", ")} FROM ${c.from}`;

    if (c.where.length) {
      const conditions = c.where.map((w) =>
        w.raw ? w.raw : `${w.condition} = ?`,
      );
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    if (c.groupBy.length) {
      sql += ` GROUP BY ${c.groupBy.join(", ")}`;
    }

    if (c.having.length) {
      const conditions = c.having.map((h) => `${h.condition} = ?`);
      sql += ` HAVING ${conditions.join(" AND ")}`;
    }

    if (c.orderBy.length) {
      sql += ` ORDER BY ${c.orderBy.map((o) => `${o.column} ${o.direction}`).join(", ")}`;
    }

    if (c.limit !== null) sql += ` LIMIT ${c.limit}`;
    if (c.offset !== null) sql += ` OFFSET ${c.offset}`;

    return sql;
  }

  getParams() {
    return this._clauses.where.filter((w) => !w.raw).map((w) => w.value);
  }
}

// 使用示例
const query = QueryBuilder.create("users")
  .select("department", "COUNT(*) as cnt", "AVG(salary) as avg_salary")
  .where("status = ?", "active")
  .where("hire_date > ?", "2024-01-01")
  .groupBy("department")
  .having("COUNT(*) > ?", 5)
  .orderBy("avg_salary", "DESC")
  .limit(10)
  .offset(0);

console.log(query.toSQL());
// SELECT department, COUNT(*) as cnt, AVG(salary) as avg_salary
// FROM users
// WHERE status = ? AND hire_date > ?
// GROUP BY department
// HAVING COUNT(*) > ?
// ORDER BY avg_salary DESC
// LIMIT 10 OFFSET 0

console.log(query.getParams());
// ['active', '2024-01-01', 5]
```

## JS 原生体现

| 原生 API                               | Builder 体现                          |
| -------------------------------------- | ------------------------------------- |
| `URLSearchParams`                      | `.append()` `.set()` 链式构建查询参数 |
| `URL` constructor + `searchParams`     | 链式构建 URL                          |
| `Array.prototype`                      | 大部分方法返回新数组，天然链式        |
| `Promise.then().catch().finally()`     | 链式处理异步流程                      |
| Lodash `_.chain()`                     | 显式 Builder 链式调用                 |
| jQuery `$(selector).addClass().show()` | DOM 操作链式调用                      |

## 与其他模式组合

```js
// Builder + Factory：工厂方法返回 Builder
class ReportBuilderFactory {
  static builder(type) {
    switch (type) {
      case "pdf":
        return new PdfReportBuilder();
      case "csv":
        return new CsvReportBuilder();
      case "json":
        return new JsonReportBuilder();
      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  }
}

// 使用
const pdfReport = ReportBuilderFactory.builder("pdf")
  .title("Q4 Revenue")
  .data(revenueData)
  .chart("bar")
  .pageSize("A4")
  .build();
```

## 关键要点

1. **链式调用**：每个方法 `return this`
2. **渐进式构建**：按需设置，不需要一次性传所有参数
3. **构建时校验**：`build()` 方法中做最终检查
4. **不可变输出**：`build()` 返回冻结对象，防止后续修改
5. **静态工厂入口**：`static create()` / `static builder()` 提供清晰入口
