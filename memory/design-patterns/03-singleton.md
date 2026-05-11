# 单例模式 (Singleton Pattern)

## 核心思想
确保一个类只有一个实例，并提供全局访问点。适用于需要全局唯一性的场景。

## 适用场景
- 数据库连接池
- 配置管理器
- 日志服务
- 全局状态管理（Redux Store）
- 浏览器中的 `window`、`document`

## 实现方式一：闭包 + 私有变量

```javascript
// ============ 单例模式 — 闭包实现 ============

const Database = (function () {
  let instance = null;

  function Constructor() {
    if (instance) {
      throw new Error('请使用 Database.getInstance()');
    }
    this.pool = [];
    this.connected = false;
    this._connect();
  }

  Constructor.prototype._connect = function () {
    this.connected = true;
    console.log('[DB] 数据库连接已建立');
  };

  Constructor.prototype.query = function (sql) {
    if (!this.connected) throw new Error('未连接');
    console.log(`[DB] 执行: ${sql}`);
    return { rows: [] };
  };

  return {
    getInstance: function () {
      if (!instance) instance = new Constructor();
      return instance;
    }
  };
})();

// ============ 使用 ============
const db1 = Database.getInstance();
const db2 = Database.getInstance();
console.log(db1 === db2); // true
```

## 实现方式二：ES6 Class + static

```javascript
// ============ 单例模式 — ES6 Class ============

class ConfigManager {
  static #instance = null;

  #config = {};

  constructor() {
    if (ConfigManager.#instance) {
      return ConfigManager.#instance;
    }
    this._load();
    ConfigManager.#instance = this;
  }

  _load() {
    this.#config = {
      apiUrl: 'https://api.example.com',
      timeout: 5000,
      retries: 3
    };
    console.log('[Config] 配置已加载');
  }

  get(key) { return this.#config[key]; }
  set(key, value) { this.#config[key] = value; }
  getAll() { return { ...this.#config }; }
}

// ============ 使用 ============
const c1 = new ConfigManager();
const c2 = new ConfigManager();
console.log(c1 === c2); // true
c1.set('debug', true);
console.log(c2.get('debug')); // true
```

## 实现方式三：ES6 Module（最简洁）

```javascript
// ============ 单例模式 — ES6 Module ============

// logger.js
class Logger {
  constructor() { this.logs = []; }
  info(msg) { const e = `[INFO] ${new Date().toISOString()} ${msg}`; this.logs.push(e); console.log(e); }
  error(msg) { const e = `[ERROR] ${new Date().toISOString()} ${msg}`; this.logs.push(e); console.error(e); }
}

// ES6 Module 天然单例
export default new Logger();

// app.js
import logger from './logger.js';
logger.info('应用启动');
```

## 实战：HTTP 客户端单例

```javascript
// ============ 实战 — HTTP 客户端单例 ============

class HttpClient {
  static #instance = null;
  #baseURL = '';
  #headers = {};
  #interceptors = { request: [], response: [] };

  constructor() {
    if (HttpClient.#instance) return HttpClient.#instance;
    HttpClient.#instance = this;
  }

  configure({ baseURL, headers = {} }) {
    this.#baseURL = baseURL;
    this.#headers = { 'Content-Type': 'application/json', ...headers };
    return this;
  }

  onRequest(fn) { this.#interceptors.request.push(fn); return this; }
  onResponse(fn) { this.#interceptors.response.push(fn); return this; }

  async request(method, url, data = null) {
    let config = { method, url: `${this.#baseURL}${url}`, data, headers: { ...this.#headers } };
    for (const fn of this.#interceptors.request) config = await fn(config);
    console.log(`[HTTP] ${method.toUpperCase()} ${config.url}`);
    let response = { status: 200, data: { success: true } };
    for (const fn of this.#interceptors.response) response = await fn(response);
    return response;
  }

  get(url) { return this.request('GET', url); }
  post(url, data) { return this.request('POST', url, data); }
}

// ============ 使用 ============
const http = new HttpClient()
  .configure({ baseURL: 'https://api.example.com' })
  .onRequest(cfg => { cfg.headers['X-Time'] = Date.now(); return cfg; })
  .onResponse(res => { console.log(`[拦截器] ${res.status}`); return res; });

http.get('/users');
http.post('/orders', { item: 'laptop' });
```

## 要点总结
1. 全局唯一实例 + 惰性创建
2. JS 中 ES6 Module 天然单例最简洁
3. 适用：配置、连接池、日志、全局状态
4. 不适用：需要多个实例的场景（滥用会导致测试困难）
