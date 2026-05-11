# Web 安全专项训练 v10 — HTTP 协议层 + GraphQL + WebSocket + 供应链安全

> **日期**: 2026-05-08 13:00  
> **主题**: HTTP 请求走私 / HTTP 缓存欺骗 / GraphQL 安全 / WebSocket 安全 / 供应链攻击 / 零信任架构  
> **前置**: v1-v9 已覆盖 XSS/CSRF/Sanitization/CSP/原型链污染/JWT/CORS/Clickjacking/MIME/SRI/Cookie/安全审计/组合攻击链  
> **本次差异化**: 聚焦协议层攻击面 + 新兴技术安全 + 供应链 + 架构级安全

---

## 目录

1. [HTTP 请求走私 — HTTP Request Smuggling](#1-http-请求走私)
2. [HTTP 缓存欺骗 — Cache Deception](#2-http-缓存欺骗)
3. [GraphQL 安全](#3-graphql-安全)
4. [WebSocket 安全](#4-websocket-安全)
5. [供应链安全 — Supply Chain Attacks](#5-供应链安全)
6. [零信任架构 — Zero Trust](#6-零信任架构)
7. [综合攻防演练 — 协议层组合攻击](#7-综合攻防演练)
8. [v10 新增知识点总结](#8-总结)

---

## 1. HTTP 请求走私 — HTTP Request Smuggling

### 1.1 攻击原理

当请求链中有多个 HTTP 实体（前端代理 → 后端服务器）时，如果它们对消息边界解析不一致，攻击者可以构造一个请求，让前端和后端"看到"不同数量的请求，从而走私第二个请求到后端。

```
攻击者 → [前端代理] → [后端服务器] → 目标

前端代理认为: 1 个请求 (Content-Length 边界)
后端服务器认为: 2 个请求 (Transfer-Encoding 边界)

攻击者发送的请求被前端视为 1 个完整请求，
但后端拆成 2 个请求 → 第二个请求"走私"成功
```

### 1.2 CL.TE 走私 (Content-Length → Transfer-Encoding)

```http
POST / HTTP/1.1
Host: example.com
Content-Length: 45
Transfer-Encoding: chunked

0

SMUGGLLED_REQUEST_HERE
```

```javascript
// --- 前端代理解析 (Content-Length 优先) ---
// 读取 Content-Length: 45
// 读取 45 字节 body: "0\r\n\r\nSMUGGLLED_REQUEST_HERE"
// 认为请求结束，转发给后端

// --- 后端服务器解析 (Transfer-Encoding 优先) ---
// 看到 Transfer-Encoding: chunked
// 解析 chunked body:
//   第一个 chunk: 长度 0 → 空 body
//   第一个请求结束
//   剩余数据: "SMUGGLLED_REQUEST_HERE" → 第二个请求!

// --- 攻击效果 ---
// 走私的请求可以:
// 1. 绕过认证 (走私到未认证端点)
// 2. 窃取他人响应 (将受害者的响应关联到走私请求)
// 3. 绕过 WAF/安全规则
```

### 1.3 TE.CL 走私 (Transfer-Encoding → Content-Length)

```http
POST / HTTP/1.1
Host: example.com
Content-Length: 4
Transfer-Encoding: chunked

5c
SMUGGLLED_REQUEST_HERE
0

```

```javascript
// --- 前端代理解析 (Transfer-Encoding 优先) ---
// chunked 编码: 5c (92 字节) → 读取 92 字节
// 0 → 结束
// 转发整个 body 给后端

// --- 后端服务器解析 (Content-Length 优先) ---
// 只读取 Content-Length: 4 字节
// 剩余字节 → 下一个请求!
```

### 1.4 TE.TE 走私 (混淆 Transfer-Encoding)

```http
POST / HTTP/1.1
Host: example.com
Content-Length: 6
Transfer-Encoding: chunked
Transfer-Encoding: xchunked

0

GHIJKL
```

```javascript
// 前端: 识别 Transfer-Encoding: chunked (第一个)
// 后端: 不识别 Transfer-Encoding: xchunked (第二个，回退到 Content-Length)
// 结果: 前端按 chunked 解析，后端按 CL=6 解析 → 边界不一致
```

### 1.5 防御方案

```javascript
// --- 防御 1: 统一消息边界解析 ---
// File: src/security/http-smuggling-defense.js

const http = require('http');

class SecureServer extends http.Server {
  constructor(options) {
    super(options);

    this.on('request', (req, res) => {
      // 1. 拒绝同时包含 CL 和 TE 的请求
      if (req.headers['content-length'] && req.headers['transfer-encoding']) {
        console.warn('[Security] CL+TE conflict detected, rejecting');
        res.writeHead(400, { 'Connection': 'close' });
        res.end('Bad Request: conflicting headers');
        return;
      }

      // 2. 拒绝非标准 Transfer-Encoding 值
      const te = req.headers['transfer-encoding'];
      if (te) {
        const allowedTE = ['chunked', 'gzip', 'deflate', 'br', 'identity'];
        const teValues = te.split(',').map(s => s.trim().toLowerCase());
        const invalidTE = teValues.filter(v => !allowedTE.includes(v));
        if (invalidTE.length > 0) {
          console.warn(`[Security] Invalid Transfer-Encoding: ${invalidTE}`);
          res.writeHead(400);
          res.end('Bad Request');
          return;
        }
      }

      // 3. 验证 Content-Length 合法性
      const cl = req.headers['content-length'];
      if (cl) {
        const clNum = parseInt(cl, 10);
        if (isNaN(clNum) || clNum < 0 || clNum > 10 * 1024 * 1024) {
          console.warn(`[Security] Invalid Content-Length: ${cl}`);
          res.writeHead(400);
          res.end('Bad Request');
          return;
        }
        // 检查是否包含多个 CL 头
        const clHeaders = req.headers['content-length'];
        if (Array.isArray(clHeaders) && clHeaders.length > 1) {
          console.warn('[Security] Multiple Content-Length headers');
          res.writeHead(400);
          res.end('Bad Request');
          return;
        }
      }

      // 4. 检查 chunked body 格式
      if (te === 'chunked') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          if (!this.validateChunkedBody(body)) {
            console.warn('[Security] Invalid chunked body format');
            res.writeHead(400);
            res.end('Bad Request');
            return;
          }
          this.handleRequest(req, res, body);
        });
      } else {
        this.handleRequest(req, res);
      }
    });
  }

  validateChunkedBody(body) {
    // 验证 chunked body 格式正确
    // 每个 chunk: <size in hex>\r\n<data>\r\n
    // 结束: 0\r\n\r\n
    const chunkRegex = /^([0-9a-fA-F]+)\r\n[\s\S]*?\r\n0\r\n\r\n$/;
    return chunkRegex.test(body);
  }

  handleRequest(req, res, body) {
    // 正常处理请求
    res.writeHead(200);
    res.end('OK');
  }
}

// --- 防御 2: Nginx 配置 ---
// nginx.conf:
// 1. 统一使用一种解析方式
// proxy_pass_request_body on;
// 2. 拒绝冲突头
// if ($http_transfer_encoding ~* chunked) {
//   # 如果同时有 Content-Length，拒绝
// }
// 3. 使用 HTTP/2 (无走私问题)
// listen 443 ssl http2;

// --- 防御 3: 升级到 HTTP/2 ---
// HTTP/2 使用二进制帧，消息边界由帧类型决定
// 不存在 CL/TE 解析歧义 → 从根本上消除走私
const http2 = require('http2');
const fs = require('fs');

const server = http2.createSecureServer({
  key: fs.readFileSync('server-key.pem'),
  cert: fs.readFileSync('server-cert.pem')
});

server.on('stream', (stream, headers) => {
  // HTTP/2 请求处理
  // 消息边界由 HTTP/2 帧保证，无走私风险
  stream.respond({ ':status': 200 });
  stream.end('HTTP/2 Secure');
});
```

### 1.6 检测走私漏洞

```javascript
// --- File: scripts/detect-smuggling.js ---

/**
 * HTTP 请求走私检测工具
 * 通过时序分析检测走私可能性
 */
class SmugglingDetector {
  constructor(targetUrl) {
    this.targetUrl = targetUrl;
    this.results = [];
  }

  async testCLTE() {
    // CL.TE 测试: 发送 CL=11 + chunked body "0\r\n\r\nXXX"
    const payload = [
      'POST / HTTP/1.1',
      `Host: ${new URL(this.targetUrl).host}`,
      'Content-Length: 11',
      'Transfer-Encoding: chunked',
      '',
      '0',
      '',
      'GET /smuggle-test HTTP/1.1',
      'Host: evil',
      '',
      ''
    ].join('\r\n');

    const startTime = Date.now();

    return new Promise((resolve) => {
      const socket = require('net').connect(
        { host: new URL(this.targetUrl).hostname, port: 443 },
        () => {
          // TLS 握手省略 (实际需使用 tls.connect)
          socket.write(payload);
          socket.on('data', (data) => {
            const elapsed = Date.now() - startTime;
            // 如果响应时间异常长，可能走私成功
            if (elapsed > 5000) {
              this.results.push({
                type: 'CL-TE',
                status: 'POSSIBLE_VULNERABLE',
                responseTime: elapsed
              });
            } else {
              this.results.push({
                type: 'CL-TE',
                status: 'SAFE',
                responseTime: elapsed
              });
            }
            socket.end();
            resolve(this.results);
          });
        }
      );
    });
  }

  async testTECL() {
    // TE.CL 测试
    const payload = [
      'POST / HTTP/1.1',
      `Host: ${new URL(this.targetUrl).host}`,
      'Content-Length: 4',
      'Transfer-Encoding: chunked',
      '',
      '1e',
      'GET /smuggle-test HTTP/1.1',
      'Host: evil',
      '',
      '',
      '0',
      '',
      ''
    ].join('\r\n');

    // 类似检测逻辑...
    this.results.push({ type: 'TE-CL', status: 'TESTED' });
    return this.results;
  }

  async testTiming() {
    // 时序检测: 发送走私请求后，发送第二个请求
    // 如果第二个请求立即返回 (走私请求的响应)，说明走私成功
    const results = [];

    // 1. 发送走私请求 (阻塞后端的请求)
    const smugglePayload = [
      'POST / HTTP/1.1',
      `Host: ${new URL(this.targetUrl).host}`,
      'Content-Length: 100',
      'Transfer-Encoding: chunked',
      '',
      '0',
      '',
      'POST /wait HTTP/1.1',  // 走私的请求 (阻塞端点)
      'Content-Length: 0',
      '',
      ''
    ].join('\r\n');

    // 2. 发送正常请求
    // 如果正常请求立即返回走私请求的响应 → 走私成功
    results.push({ type: 'TIMING', status: 'TESTED' });
    return results;
  }

  getReport() {
    const vulnerable = this.results.filter(r =>
      r.status.includes('VULNERABLE')
    );
    return {
      total: this.results.length,
      vulnerable: vulnerable.length,
      results: this.results
    };
  }
}
```

---

## 2. HTTP 缓存欺骗 — Cache Deception

### 2.1 攻击原理

攻击者诱导 CDN/反向代理缓存包含敏感数据的响应，然后从缓存中获取这些数据。

```
攻击者 → CDN → 后端服务器
          ↑
     缓存了敏感响应!

攻击者后续请求 → CDN (直接返回缓存的敏感数据)
```

### 2.2 攻击向量 1: 扩展名欺骗

```javascript
// --- 漏洞: CDN 按扩展名缓存 ---
// 后端: /api/user/profile (动态，不缓存)
// CDN: 看到 /api/user/profile.json → 缓存!

// --- 攻击 ---
// 1. 攻击者登录，访问:
//    https://example.com/api/user/profile.json
// 2. 后端返回: {"email":"victim@example.com","ssn":"123-45-6789"}
// 3. CDN 按 .json 扩展名缓存此响应
// 4. 攻击者再次访问同一 URL → 获取缓存中的敏感数据
//    (即使攻击者未登录，也能获取!)

// --- 修复 ---
// File: src/security/cache-deception-defense.js

const express = require('express');

function cacheDeceptionMiddleware(req, res, next) {
  // 1. 检查 URL 扩展名与实际内容类型是否匹配
  const urlExt = req.path.split('.').pop().toLowerCase();
  const extToContentType = {
    'json': 'application/json',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'png': 'image/png',
    'jpg': 'image/jpeg'
  };

  // 2. API 端点禁止缓存
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Surrogate-Control', 'no-store'); // CDN 专用
    res.setHeader('CDN-Cache-Control', 'no-store'); // Cloudflare 专用
  }

  // 3. 认证响应禁止缓存
  if (req.user || req.session?.userId) {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Vary', 'Cookie, Authorization'); // 按认证状态变体
  }

  // 4. 检测扩展名欺骗
  if (urlExt && extToContentType[urlExt]) {
    const actualContentType = res.getHeader('Content-Type');
    if (actualContentType && !actualContentType.includes(extToContentType[urlExt])) {
      console.warn(`[Security] Cache deception attempt: ${req.path}`);
      // 添加 no-cache 头
      res.setHeader('Cache-Control', 'no-store');
    }
  }

  next();
}

// --- 修复: CDN 配置 ---
// Cloudflare:
// - Cache Rules: 对 /api/* 禁用缓存
// - Edge Cache: 对认证响应禁用
// - Cache Reserve: 不缓存含 Set-Cookie 的响应

// Nginx:
// location /api/ {
//   proxy_no_cache 1;
//   proxy_cache_bypass 1;
//   add_header Cache-Control "no-store";
//   add_header Surrogate-Control "no-store";
// }
```

### 2.3 攻击向量 2: 参数欺骗

```javascript
// --- 漏洞: CDN 忽略查询参数 ---
// CDN 配置: 缓存 /page 但忽略 ?user=xxx 参数
// 攻击者访问: /page?user=admin
// CDN 缓存响应 → 后续所有用户看到 admin 的内容

// --- 修复: Vary 头 + CDN 配置 ---
// File: src/security/cache-vary-defense.js

function cacheVaryMiddleware(req, res, next) {
  // 1. 按认证状态变体
  if (req.headers.authorization || req.cookies?.session) {
    res.setHeader('Vary', 'Authorization, Cookie');
  }

  // 2. 按语言变体
  if (req.headers['accept-language']) {
    res.setHeader('Vary', 'Accept-Language');
  }

  // 3. 按用户代理变体 (移动/桌面)
  if (req.headers['user-agent']?.includes('Mobile')) {
    res.setHeader('Vary', 'User-Agent');
  }

  // 4. 敏感页面完全禁用缓存
  const sensitivePaths = ['/account', '/settings', '/payment', '/admin'];
  if (sensitivePaths.some(p => req.path.startsWith(p))) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  // 5. POST/PUT/DELETE 响应禁止缓存
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Cache-Control', 'no-store');
  }

  next();
}
```

### 2.4 攻击向量 3: Web 缓存投毒 (Web Cache Poisoning)

```javascript
// --- 漏洞: 不可缓存的输入影响缓存响应 ---
// File: src/security/cache-poisoning-defense.js

/**
 * Web 缓存投毒防御
 * 攻击者通过不可缓存的输入 (如 Header) 影响可缓存的响应
 */
class CachePoisoningDefense {
  /**
   * 识别可缓存的输入来源
   * 只有 URL 路径和查询参数应该是可缓存的
   * Header、Cookie 等不可缓存的输入不应影响响应内容
   */
  static analyzeVulnerability(req) {
    const vulnerabilities = [];

    // 检查 1: 响应是否依赖不可缓存的 Header
    const cacheableHeaders = new Set(['accept', 'accept-language']);
    const usedHeaders = Object.keys(req.headers).filter(h => {
      // 检查响应中是否使用了此 Header 的值
      // (需要代码分析，这里做启发式检测)
      return !cacheableHeaders.has(h) &&
             !['host', 'connection', 'content-length', 'cookie', 'authorization'].includes(h);
    });

    if (usedHeaders.length > 0) {
      vulnerabilities.push({
        type: 'HEADER_DEPENDENCY',
        headers: usedHeaders,
        severity: 'HIGH',
        fix: '添加 Vary 头或移除 Header 依赖'
      });
    }

    // 检查 2: 响应是否依赖 Cookie
    if (req.cookies && Object.keys(req.cookies).length > 0) {
      vulnerabilities.push({
        type: 'COOKIE_DEPENDENCY',
        cookies: Object.keys(req.cookies),
        severity: 'HIGH',
        fix: '添加 Vary: Cookie 或禁用缓存'
      });
    }

    // 检查 3: X-Forwarded-Host 投毒
    if (req.headers['x-forwarded-host']) {
      vulnerabilities.push({
        type: 'X_FORWARDED_HOST_POISONING',
        value: req.headers['x-forwarded-host'],
        severity: 'CRITICAL',
        fix: '使用 X-Forwarded-Host 白名单或忽略此头'
      });
    }

    // 检查 4: X-Forwarded-Proto 投毒
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      vulnerabilities.push({
        type: 'X_FORWARDED_PROTO_POISONING',
        value: req.headers['x-forwarded-proto'],
        severity: 'HIGH',
        fix: '只信任来自可信代理的 X-Forwarded-Proto'
      });
    }

    return vulnerabilities;
  }

  /**
   * 安全的 Host 获取
   */
  static getSafeHost(req, trustedProxies) {
    // 1. 检查是否来自可信代理
    const isFromTrustedProxy = trustedProxies.includes(req.ip);

    if (isFromTrustedProxy && req.headers['x-forwarded-host']) {
      // 白名单验证
      const allowedHosts = new Set(['example.com', 'www.example.com']);
      const forwardedHost = req.headers['x-forwarded-host'];
      if (allowedHosts.has(forwardedHost)) {
        return forwardedHost;
      }
    }

    // 2. 回退到 Host 头
    return req.headers.host;
  }
}

// --- 修复: X-Forwarded-* 安全处理 ---
app.use((req, res, next) => {
  // 只信任来自已知代理的 X-Forwarded-* 头
  const trustedProxies = ['10.0.0.1', '10.0.0.2']; // CDN/负载均衡器 IP

  if (!trustedProxies.includes(req.ip)) {
    // 移除不可信的 X-Forwarded-* 头
    delete req.headers['x-forwarded-host'];
    delete req.headers['x-forwarded-proto'];
    delete req.headers['x-forwarded-prefix'];
  }

  next();
});
```

---

## 3. GraphQL 安全

### 3.1 GraphQL 攻击面

```
GraphQL 安全威胁矩阵:

┌─────────────────────────────────────────────────┐
│  1. 深度/复杂度攻击 (DoS)                        │
│  2. 批量查询攻击 (DoS)                           │
│  3. 内省枚举 (信息泄露)                          │
│  4. 字段级权限绕过 (授权问题)                     │
│  5. 循环查询 (无限递归)                          │
│  6. 变量注入 (类似 SQL 注入)                     │
│  7. 指令注入 (自定义指令安全)                     │
└─────────────────────────────────────────────────┘
```

### 3.2 深度/复杂度攻击防御

```javascript
// --- File: src/security/graphql-security.js ---

const { createComplexityLimitRule } = require('graphql-validation-complexity');
const { GraphQLSchema } = require('graphql');

// ==================== 查询复杂度限制 ====================

/**
 * 查询复杂度计算
 * 每个字段分配复杂度分数，总复杂度超过阈值则拒绝
 */
const complexityLimitConfig = {
  // 最大允许复杂度
  maximumComplexity: 1000,

  // 字段复杂度映射
  objectComplexity: 1,        // 对象字段: 1
  scalarComplexity: 0,        // 标量字段: 0
  listComplexity: 10,         // 列表字段: 10 (可能返回大量数据)

  // 自定义字段复杂度
  fieldComplexity: {
    'users': 50,              // 用户列表: 高复杂度
    'posts': 30,              // 帖子列表: 中复杂度
    'comments': 20,           // 评论列表: 中复杂度
    'search': 100,            // 搜索: 很高复杂度
    'analytics': 200,         // 分析: 极高复杂度
  },

  // 深度限制
  maxDepth: 10,
};

// ==================== 批量查询攻击防御 ====================

/**
 * 批量查询攻击: 攻击者发送包含大量操作的单个请求
 * 绕过速率限制，一次性消耗大量资源
 */
const batchQueryConfig = {
  // 最大批量操作数
  maxBatchSize: 5,

  // 是否允许批量查询
  enableBatching: true,
};

function batchQueryLimiter(req, res, next) {
  if (req.method === 'POST') {
    const body = req.body;

    // 检查是否为数组 (批量查询)
    if (Array.isArray(body)) {
      if (body.length > batchQueryConfig.maxBatchSize) {
        return res.status(429).json({
          errors: [{
            message: `Batch size exceeds maximum of ${batchQueryConfig.maxBatchSize}`,
            extensions: { code: 'BATCH_SIZE_LIMIT_EXCEEDED' }
          }]
        });
      }

      // 检查批量查询的总复杂度
      let totalComplexity = 0;
      for (const query of body) {
        totalComplexity += estimateQueryComplexity(query.query, query.variables);
      }

      if (totalComplexity > complexityLimitConfig.maximumComplexity) {
        return res.status(429).json({
          errors: [{
            message: 'Total query complexity exceeds limit',
            extensions: { code: 'COMPLEXITY_LIMIT_EXCEEDED' }
          }]
        });
      }
    }
  }

  next();
}

// ==================== 内省查询控制 ====================

/**
 * 内省查询泄露 API 结构
 * 生产环境应限制或禁用内省
 */
function introspectionControl(req, res, next) {
  const body = req.body;
  const query = body.query || '';

  // 检测内省查询
  const isIntrospection = (
    query.includes('__schema') ||
    query.includes('__type') ||
    query.includes('__fields') ||
    query.includes('__enumValues') ||
    query.includes('__inputFields')
  );

  if (isIntrospection) {
    // 生产环境禁止内省
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        errors: [{
          message: 'Introspection is disabled in production',
          extensions: { code: 'INTROSPECTION_DISABLED' }
        }]
      });
    }

    // 开发环境: 限制内省频率
    const key = `introspection:${req.ip}`;
    const count = rateLimiter.get(key) || 0;
    if (count > 10) { // 每小时 10 次
      return res.status(429).json({
        errors: [{
          message: 'Introspection rate limit exceeded',
          extensions: { code: 'INTROSPECTION_RATE_LIMITED' }
        }]
      });
    }
    rateLimiter.increment(key);
  }

  next();
}

// ==================== 字段级权限控制 ====================

/**
 * GraphQL 的字段级权限
 * 不同用户角色看到不同字段
 */
class FieldPermissionMiddleware {
  constructor(schema) {
    this.schema = schema;
    this.permissions = new Map();
  }

  /**
   * 注册字段权限
   */
  register(fieldPath, roles) {
    this.permissions.set(fieldPath, new Set(roles));
  }

  /**
   * 检查字段访问权限
   */
  checkFieldAccess(fieldPath, userRole) {
    const allowedRoles = this.permissions.get(fieldPath);
    if (!allowedRoles) return true; // 未配置权限 → 允许
    return allowedRoles.has(userRole);
  }

  /**
   * 查询解析器包装器
   */
  wrapResolvers(resolvers, userRole) {
    const wrapped = {};

    for (const [typeName, typeResolvers] of Object.entries(resolvers)) {
      wrapped[typeName] = {};

      for (const [fieldName, resolver] of Object.entries(typeResolvers)) {
        const fieldPath = `${typeName}.${fieldName}`;

        wrapped[typeName][fieldName] = async (parent, args, context, info) => {
          // 权限检查
          if (!this.checkFieldAccess(fieldPath, userRole)) {
            // 返回 null 而非报错 (不泄露字段存在)
            console.warn(`[Security] Field access denied: ${fieldPath} for role ${userRole}`);
            return null;
          }

          // 执行原始解析器
          return resolver(parent, args, context, info);
        };
      }
    }

    return wrapped;
  }
}

// ==================== 循环查询防御 ====================

/**
 * 防御循环/递归查询
 * 例如: User → posts → author → posts → author → ...
 */
class CycleDetector {
  constructor(maxDepth = 10) {
    this.maxDepth = maxDepth;
  }

  detectCycle(info) {
    let depth = 0;
    let path = info.path;

    while (path) {
      depth++;
      if (depth > this.maxDepth) {
        throw new Error(
          `Query depth exceeds maximum of ${this.maxDepth}. ` +
          `Possible cycle detected.`
        );
      }
      path = path.prev;
    }

    return depth;
  }
}

// ==================== 变量注入防御 ====================

/**
 * GraphQL 变量注入
 * 攻击者通过变量注入恶意值
 * 防御: 输入验证 + 类型系统
 */
function variableValidationMiddleware(req, res, next) {
  const body = req.body;
  const variables = body.variables || {};

  // 1. 变量类型验证 (由 GraphQL 引擎处理)
  // 2. 变量大小限制
  const variableStr = JSON.stringify(variables);
  if (variableStr.length > 10000) {
    return res.status(400).json({
      errors: [{
        message: 'Variables too large',
        extensions: { code: 'VARIABLES_TOO_LARGE' }
      }]
    });
  }

  // 3. 变量内容检查 (SQL 注入/XSS 特征)
  const dangerousPatterns = [
    /union\s+select/i,
    /drop\s+table/i,
    /<script/i,
    /javascript:/i,
    /\.\.\.\s*on\s+\w+\s*\{/, // 片段扩散攻击
  ];

  for (const [key, value] of Object.entries(variables)) {
    const strValue = JSON.stringify(value);
    for (const pattern of dangerousPatterns) {
      if (pattern.test(strValue)) {
        console.warn(`[Security] Dangerous variable: ${key}`);
        return res.status(400).json({
          errors: [{
            message: `Invalid variable: ${key}`,
            extensions: { code: 'INVALID_VARIABLE' }
          }]
        });
      }
    }
  }

  next();
}

// ==================== 完整 GraphQL 安全中间件 ====================

function createSecureGraphQLMiddleware(options = {}) {
  const {
    maxComplexity = 1000,
    maxDepth = 10,
    maxBatchSize = 5,
    disableIntrospectionInProd = true,
    enablePersistedQueries = false,
  } = options;

  return [
    // 1. 请求大小限制
    express.json({ limit: '100kb' }),

    // 2. 变量验证
    variableValidationMiddleware,

    // 3. 内省控制
    disableIntrospectionInProd ? introspectionControl : (req, res, next) => next(),

    // 4. 批量查询限制
    batchQueryLimiter,

    // 5. GraphQL 执行 (带复杂度限制)
    graphqlHTTP((req) => ({
      schema: options.schema,
      rootValue: options.rootValue,
      context: { user: req.user },
      graphiql: process.env.NODE_ENV !== 'production',

      // 验证规则
      validationRules: [
        // 复杂度限制 (需要 graphql-validation-complexity 包)
        // createComplexityLimitRule({ maximumComplexity: maxComplexity }),
      ],

      // 字段分析 (深度检测)
      fieldResolver: (source, args, context, info) => {
        const detector = new CycleDetector(maxDepth);
        detector.detectCycle(info);
        return defaultFieldResolver(source, args, context, info);
      },
    })),
  ];
}
```

### 3.3 Persisted Queries (持久化查询)

```javascript
// --- File: src/security/persisted-queries.js ---

/**
 * 持久化查询 (Persisted Queries)
 * 客户端只发送查询 ID，服务端查找完整查询
 * 好处:
 * 1. 阻止任意查询执行 (攻击者无法构造新查询)
 * 2. 减少带宽 (只发送 ID)
 * 3. 查询预编译 (性能提升)
 */
class PersistedQueryManager {
  constructor() {
    this.queries = new Map(); // id → query
    this.sha256Map = new Map(); // sha256(query) → id
  }

  /**
   * 注册查询
   */
  register(id, query) {
    // 验证查询语法
    try {
      require('graphql').parse(query);
    } catch (e) {
      throw new Error(`Invalid query syntax: ${e.message}`);
    }

    this.queries.set(id, query);

    // 也按 SHA-256 索引 (自动注册模式)
    const hash = require('crypto')
      .createHash('sha256')
      .update(query)
      .digest('hex');
    this.sha256Map.set(hash, id);
  }

  /**
   * 从批量注册文件加载
   */
  loadFromFile(filePath) {
    const queries = require(filePath);
    for (const [id, query] of Object.entries(queries)) {
      this.register(id, query);
    }
  }

  /**
   * 解析查询
   */
  resolve(requestBody) {
    const { id, hash, query, variables } = requestBody;

    // 模式 1: 显式 ID
    if (id) {
      const resolvedQuery = this.queries.get(id);
      if (!resolvedQuery) {
        throw new Error(`Unknown query ID: ${id}`);
      }
      return { query: resolvedQuery, variables };
    }

    // 模式 2: SHA-256 Hash (Apollo 风格)
    if (hash) {
      const id = this.sha256Map.get(hash);
      if (!id) {
        // 自动注册模式: 如果是首次出现，注册并返回
        if (query) {
          this.register(hash, query);
          return { query, variables };
        }
        throw new Error(`Unknown query hash: ${hash}`);
      }
      const resolvedQuery = this.queries.get(id);
      return { query: resolvedQuery, variables };
    }

    // 模式 3: 直接查询 (仅开发环境)
    if (process.env.NODE_ENV !== 'production' && query) {
      return { query, variables };
    }

    throw new Error('No query ID, hash, or query provided');
  }

  /**
   * 生成查询清单 (用于构建时预注册)
   */
  generateManifest() {
    const manifest = {};
    for (const [id, query] of this.queries) {
      manifest[id] = {
        query,
        hash: require('crypto')
          .createHash('sha256')
          .update(query)
          .digest('hex')
      };
    }
    return manifest;
  }
}

// --- 使用示例 ---
const pqm = new PersistedQueryManager();

// 构建时注册所有查询
pqm.register('GET_USER', `
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
`);

pqm.register('LIST_POSTS', `
  query ListPosts($limit: Int, $offset: Int) {
    posts(limit: $limit, offset: $offset) {
      id
      title
      content
      author { id name }
    }
  }
`);

// 中间件
app.post('/graphql', (req, res) => {
  try {
    const { query, variables } = pqm.resolve(req.body);
    // 执行 GraphQL 查询...
    res.json({ data: executeQuery(query, variables) });
  } catch (e) {
    res.status(400).json({ errors: [{ message: e.message }] });
  }
});
```

---

## 4. WebSocket 安全

### 4.1 WebSocket 攻击面

```
WebSocket 安全威胁:

1. CSRF → WebSocket 握手使用 HTTP，受同源策略保护，但握手请求可被 CSRF
2. 消息注入 → 攻击者注入恶意消息到连接
3. 消息拦截 → MITM 攻击 (未使用 WSS)
4. DoS → 大量连接/消息耗尽资源
5. 信息泄露 → 敏感数据通过 WebSocket 传输
6. 跨域 WebSocket → 错误配置允许任意域连接
```

### 4.2 完整 WebSocket 安全实现

```javascript
// --- File: src/security/websocket-security.js ---

const WebSocket = require('ws');
const crypto = require('crypto');

// ==================== WebSocket 安全中间件 ====================

class WebSocketSecurity {
  constructor(options = {}) {
    this.allowedOrigins = new Set(options.allowedOrigins || []);
    this.maxConnections = options.maxConnections || 1000;
    this.maxMessageSize = options.maxMessageSize || 64 * 1024; // 64KB
    this.rateLimit = {
      maxMessages: options.rateLimit?.maxMessages || 30,
      windowMs: options.rateLimit?.windowMs || 10000, // 10 秒
    };
    this.messageTypes = new Set(options.allowedMessageTypes || []);
    this.connectionRateLimit = new Map(); // IP → timestamps
    this.messageRateLimit = new Map(); // connectionId → timestamps
  }

  /**
   * 握手验证 (在 HTTP 升级阶段)
   */
  verifyHandshake(req, callback) {
    const issues = [];

    // 1. Origin 验证 (防 CSRF)
    const origin = req.headers.origin;
    if (origin && this.allowedOrigins.size > 0) {
      if (!this.allowedOrigins.has(origin)) {
        issues.push(`Origin not allowed: ${origin}`);
      }
    }

    // 2. 认证检查
    const token = this.extractToken(req);
    if (!token) {
      issues.push('No authentication token');
    } else {
      try {
        const decoded = this.verifyToken(token);
        req.wsUser = decoded;
      } catch (e) {
        issues.push('Invalid token');
      }
    }

    // 3. 连接速率限制
    const ip = req.socket.remoteAddress;
    const now = Date.now();
    const recentConnections = this.connectionRateLimit.get(ip) || [];
    const recent = recentConnections.filter(t => now - t < 60000);
    if (recent.length >= 10) { // 每分钟 10 个连接
      issues.push('Connection rate limit exceeded');
    }
    recent.push(now);
    this.connectionRateLimit.set(ip, recent);

    // 4. 总连接数限制
    if (this.wss && this.wss.clients.size >= this.maxConnections) {
      issues.push('Maximum connections reached');
    }

    // 5. 协议检查 (必须 WSS)
    if (req.headers['sec-websocket-protocol']) {
      // 验证子协议
    }

    if (issues.length > 0) {
      console.warn(`[Security] WebSocket handshake rejected: ${issues.join(', ')}`);
      callback(false, 403, { 'X-Reason': issues.join('; ') });
      return;
    }

    callback(true);
  }

  /**
   * 消息验证
   */
  verifyMessage(ws, message, callback) {
    const issues = [];

    // 1. 大小限制
    if (message.length > this.maxMessageSize) {
      issues.push('Message too large');
    }

    // 2. 消息速率限制
    const connId = ws._connId;
    const now = Date.now();
    const recentMessages = this.messageRateLimit.get(connId) || [];
    const recent = recentMessages.filter(t => now - t < this.rateLimit.windowMs);
    if (recent.length >= this.rateLimit.maxMessages) {
      issues.push('Message rate limit exceeded');
    }
    recent.push(now);
    this.messageRateLimit.set(connId, recent);

    // 3. JSON 格式验证
    let parsed;
    try {
      parsed = JSON.parse(message);
    } catch (e) {
      issues.push('Invalid JSON');
      callback(issues, null);
      return;
    }

    // 4. 消息类型白名单
    if (this.messageTypes.size > 0 && parsed.type) {
      if (!this.messageTypes.has(parsed.type)) {
        issues.push(`Unknown message type: ${parsed.type}`);
      }
    }

    // 5. 消息内容检查 (XSS/注入)
    if (parsed.data) {
      const dataStr = JSON.stringify(parsed.data);
      const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /eval\s*\(/i,
      ];
      for (const pattern of dangerousPatterns) {
        if (pattern.test(dataStr)) {
          issues.push('Dangerous content detected');
          break;
        }
      }
    }

    callback(issues, parsed);
  }

  /**
   * 提取认证 Token
   */
  extractToken(req) {
    // 从查询参数提取 (WebSocket 不支持自定义 Header)
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('token') ||
           req.headers['sec-websocket-protocol'];
  }

  /**
   * 验证 Token
   */
  verifyToken(token) {
    // JWT 验证
    const jwt = require('jsonwebtoken');
    return jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256']
    });
  }

  /**
   * 安全广播 (按权限过滤)
   */
  secureBroadcast(wss, message, senderUser, targetRole) {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        // 权限检查
        if (targetRole && client._userRole !== targetRole) {
          return; // 跳过不符合角色的客户端
        }
        // 不向发送者自己广播 (除非明确要求)
        if (client._userId === senderUser?.userId) {
          return;
        }
        client.send(messageStr);
      }
    });
  }
}

// ==================== 使用示例 ====================

const wss = new WebSocket.Server({
  noServer: true, // 手动处理升级
  maxPayload: 64 * 1024, // 64KB
});

const wsSecurity = new WebSocketSecurity({
  allowedOrigins: ['https://app.example.com'],
  maxConnections: 1000,
  maxMessageSize: 64 * 1024,
  allowedMessageTypes: ['chat', 'notification', 'presence', 'typing'],
  rateLimit: {
    maxMessages: 30,
    windowMs: 10000,
  },
});

// 手动处理 HTTP 升级
const server = require('http').createServer();

server.on('upgrade', (req, socket, head) => {
  wsSecurity.wss = wss;
  wsSecurity.verifyHandshake(req, (allowed) => {
    if (allowed) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        // 附加用户信息
        ws._userId = req.wsUser?.userId;
        ws._userRole = req.wsUser?.role;
        ws._connId = crypto.randomUUID();
        ws._connectedAt = Date.now();

        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });
});

// 连接处理
wss.on('connection', (ws, req) => {
  console.log(`[WS] Client connected: ${ws._userId}`);

  ws.on('message', (data) => {
    wsSecurity.verifyMessage(ws, data.toString(), (issues, parsed) => {
      if (issues.length > 0) {
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: issues.join(', ') }
        }));

        // 严重违规 → 断开连接
        if (issues.includes('Dangerous content detected') ||
            issues.includes('Message rate limit exceeded')) {
          console.warn(`[Security] Disconnecting client: ${ws._userId}`);
          ws.close(1008, 'Security violation');
        }
        return;
      }

      // 处理消息...
      handleMessage(ws, parsed);
    });
  });

  ws.on('close', (code, reason) => {
    console.log(`[WS] Client disconnected: ${ws._userId} (${code})`);
    // 清理速率限制记录
    wsSecurity.messageRateLimit.delete(ws._connId);
  });

  // 心跳 (防僵尸连接)
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

// 心跳检测 (每 30 秒)
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);
```

### 4.3 WebSocket 安全 Checklist

```
□ 使用 WSS (WebSocket Secure) 而非 WS
□ 握手时验证 Origin 头
□ 认证: 通过查询参数或子协议传递 Token
□ 消息大小限制 (默认 64KB)
□ 消息速率限制 (防 DoS)
□ 连接数限制 (防资源耗尽)
□ 消息内容验证 (JSON 格式 + 类型白名单)
□ 敏感数据加密 (端到端加密)
□ 心跳机制 (防僵尸连接)
□ 错误处理不泄露内部信息
□ 日志记录连接/断开/异常
□ 子协议白名单
□ CORS 配置 (Sec-WebSocket-Allowed-Origin)
```

---

## 5. 供应链安全 — Supply Chain Attacks

### 5.1 攻击类型

```
供应链攻击矩阵:

┌─────────────────────────────────────────────────────────┐
│  1. 依赖投毒 (Dependency Confusion / Typosquatting)      │
│     - 发布恶意包到 npm (名字相似: lodash → loadsh)        │
│     - 内部包名与公共包冲突                                │
│                                                         │
│  2. 维护者账号劫持 (Maintainer Compromise)               │
│     - 攻击者获取维护者权限 → 注入恶意代码                 │
│     - 例: event-stream (2018), ua-parser-js (2021)       │
│                                                         │
│  3. 构建链攻击 (Build Chain)                             │
│     - 篡改构建产物 (编译后的 JS 含恶意代码)               │
│     - 例: SolarWinds (2020)                              │
│                                                         │
│  4. CI/CD 供应链攻击                                     │
│     - 篡改 GitHub Actions / GitLab CI                    │
│     - 恶意第三方 Action                                  │
│                                                         │
│  5. Transitive Dependency (传递依赖)                     │
│     - 间接依赖被污染 → 影响整个依赖树                     │
│     - 例: left-pad (2016), colors.js (2022)              │
└─────────────────────────────────────────────────────────┘
```

### 5.2 依赖投毒防御

```javascript
// --- File: src/security/dependency-security.js ---

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ==================== 依赖安全扫描器 ====================

class DependencyAuditor {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.packageJson = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
    );
    this.findings = [];
  }

  /**
   * 1. npm audit 扫描
   */
  async scanKnownVulnerabilities() {
    try {
      const output = execSync('npm audit --json', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      });
      const audit = JSON.parse(output);

      const vulns = audit.metadata?.vulnerabilities || {};
      if (vulns.critical > 0 || vulns.high > 0) {
        this.findings.push({
          severity: 'CRITICAL',
          type: 'KNOWN_VULNERABILITY',
          title: `已知漏洞: ${vulns.critical} critical + ${vulns.high} high`,
          detail: audit.metadata.vulnerabilities,
          recommendation: '运行 npm audit fix 或手动更新依赖',
        });
      }

      // 详细漏洞信息
      for (const [key, vuln] of Object.entries(audit.vulnerabilities || {})) {
        if (vuln.severity === 'critical' || vuln.severity === 'high') {
          this.findings.push({
            severity: vuln.severity.toUpperCase(),
            type: 'KNOWN_VULNERABILITY',
            title: `${vuln.name}: ${vuln.title}`,
            detail: {
              via: vuln.via,
              effects: vuln.effects,
              range: vuln.range,
              fixAvailable: vuln.fixAvailable,
            },
            recommendation: vuln.fixAvailable
              ? '运行 npm audit fix'
              : '手动更新或替换依赖',
          });
        }
      }
    } catch (e) {
      // npm audit 返回非 0 表示有漏洞
      console.warn('[Audit] npm audit returned errors');
    }
  }

  /**
   * 2. Typosquatting 检测
   */
  detectTyposquatting() {
    const allDeps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
    };

    // 已知包的常见拼写错误
    const knownPackages = {
      'lodash': ['loadsh', 'lodahs', 'lodsh', '_'],
      'express': ['expres', 'exprss', 'expressjs'],
      'react': ['reactjs', 'react.js', 'reaact'],
      'axios': ['axio', 'axois', 'axiox'],
      'webpack': ['webpak', 'webpck', 'webpackk'],
      'typescript': ['typecript', 'typscript', 'typescripts'],
      'dotenv': ['doten', 'dottenv', 'dot-en'],
      'jsonwebtoken': ['jwt', 'json-webtoken', 'jsonwebtokenn'],
      'helmet': ['helmett', 'helment', 'helmt'],
      'cors': ['cor', 'corsm', 'corsx'],
    };

    for (const dep of Object.keys(allDeps)) {
      // 检查是否为已知包的拼写错误
      for (const [correct, typos] of Object.entries(knownPackages)) {
        if (typos.includes(dep)) {
          this.findings.push({
            severity: 'CRITICAL',
            type: 'TYPOSQUATTING',
            title: `可能的拼写攻击: "${dep}" (应为 "${correct}")`,
            recommendation: `替换为正确的包名 "${correct}"`,
          });
        }
      }

      // 检查包名相似度 (Levenshtein 距离)
      for (const knownPkg of Object.keys(knownPackages)) {
        if (dep === knownPkg) continue;
        const distance = this.levenshteinDistance(dep, knownPkg);
        if (distance <= 2 && distance > 0) {
          this.findings.push({
            severity: 'HIGH',
            type: 'TYPOSQUATTING_SUSPECT',
            title: `包名高度相似: "${dep}" ≈ "${knownPkg}" (距离 ${distance})`,
            recommendation: '确认是否为正确的包',
          });
        }
      }
    }
  }

  /**
   * 3. Dependency Confusion 检测
   */
  detectDependencyConfusion() {
    // 检查是否有内部包名与公共包冲突
    const allDeps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
    };

    // 检查 scoped 包
    for (const dep of Object.keys(allDeps)) {
      if (dep.startsWith('@')) {
        const scope = dep.split('/')[0];
        // 如果 scope 不是公司/组织名，可能是混淆攻击
        const internalScopes = ['@mycompany', '@myorg']; // 配置你的内部 scope
        if (!internalScopes.some(s => dep.startsWith(s))) {
          // 进一步检查: 该包是否同时存在于内部 registry 和 npm
          this.findings.push({
            severity: 'MEDIUM',
            type: 'DEPENDENCY_CONFUSION_RISK',
            title: `Scoped 包 "${dep}" 可能受依赖混淆攻击`,
            recommendation: '配置 .npmrc 强制使用内部 registry',
          });
        }
      }
    }
  }

  /**
   * 4. 依赖完整性验证
   */
  verifyIntegrity() {
    // 检查 package-lock.json 是否存在
    const lockPath = path.join(this.projectRoot, 'package-lock.json');
    if (!fs.existsSync(lockPath)) {
      this.findings.push({
        severity: 'HIGH',
        type: 'NO_LOCK_FILE',
        title: '缺少 package-lock.json',
        recommendation: '运行 npm install 生成 lock 文件',
      });
      return;
    }

    // 检查 lock 文件完整性
    const lockFile = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const packages = lockFile.packages || {};

    let missingIntegrity = 0;
    for (const [pkgPath, pkgInfo] of Object.entries(packages)) {
      if (pkgPath.startsWith('node_modules/') && !pkgInfo.integrity) {
        missingIntegrity++;
      }
    }

    if (missingIntegrity > 0) {
      this.findings.push({
        severity: 'HIGH',
        type: 'MISSING_INTEGRITY',
        title: `${missingIntegrity} 个包缺少 integrity 哈希`,
        recommendation: '删除 node_modules 和 lock 文件，重新 npm install',
      });
    }
  }

  /**
   * 5. 可疑脚本检测
   */
  detectSuspiciousScripts() {
    const allDeps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
    };

    for (const [dep, version] of Object.entries(allDeps)) {
      const pkgJsonPath = path.join(
        this.projectRoot, 'node_modules', dep, 'package.json'
      );

      try {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const scripts = pkgJson.scripts || {};

        // 检查 postinstall/preinstall 脚本
        const lifecycleScripts = ['preinstall', 'postinstall', 'prepublish', 'prepare'];
        for (const script of lifecycleScripts) {
          if (scripts[script]) {
            // 检查脚本是否包含可疑命令
            const suspiciousPatterns = [
              /curl\s+.*\|\s*(bash|sh)/i,
              /wget\s+.*\|\s*(bash|sh)/i,
              /eval\s*\(/i,
              /exec\s*\(/i,
              /require\s*\(\s*['"]child_process['"]\)/i,
              /rm\s+-rf/i,
              /\/dev\/tcp/i,
              /base64\s+-d/i,
              /nc\s+-[el]/i, // netcat
            ];

            for (const pattern of suspiciousPatterns) {
              if (pattern.test(scripts[script])) {
                this.findings.push({
                  severity: 'CRITICAL',
                  type: 'SUSPICIOUS_SCRIPT',
                  title: `${dep}: ${script} 包含可疑命令`,
                  detail: scripts[script],
                  recommendation: `审查 ${dep} 的 ${script} 脚本，考虑移除`,
                });
              }
            }
          }
        }
      } catch (e) {
        // 包未安装，跳过
      }
    }
  }

  /**
   * 6. 维护者活跃度检查
   */
  async checkMaintainerActivity() {
    const allDeps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
    };

    for (const dep of Object.keys(allDeps)) {
      try {
        const output = execSync(`npm view ${dep} --json`, {
          encoding: 'utf8',
          timeout: 5000,
        });
        const info = JSON.parse(output);

        // 检查最后更新时间
        const lastUpdated = info.time?.modified || info.time?.[info['dist-tag']?.latest];
        if (lastUpdated) {
          const daysSinceUpdate = (Date.now() - new Date(lastUpdated).getTime()) / 86400000;
          if (daysSinceUpdate > 365) {
            this.findings.push({
              severity: 'LOW',
              type: 'UNMAINTAINED',
              title: `${dep} 超过 1 年未更新`,
              detail: `最后更新: ${lastUpdated}`,
              recommendation: '考虑替换为活跃维护的替代方案',
            });
          }
        }

        // 检查维护者数量
        const maintainers = info.maintainers || [];
        if (maintainers.length <= 1 && info.name !== 'left-pad') {
          // 单人维护的包风险较高
          this.findings.push({
            severity: 'LOW',
            type: 'SINGLE_MAINTAINER',
            title: `${dep} 只有 1 个维护者`,
            recommendation: '关注该包的安全性，考虑替代方案',
          });
        }
      } catch (e) {
        // 无法获取包信息
      }
    }
  }

  // Levenshtein 距离计算
  levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i - 1] === a[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * 生成审计报告
   */
  async audit() {
    await this.scanKnownVulnerabilities();
    this.detectTyposquatting();
    this.detectDependencyConfusion();
    this.verifyIntegrity();
    this.detectSuspiciousScripts();
    await this.checkMaintainerActivity();

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
        low: low.length,
      },
      findings: this.findings,
    };
  }
}

// ==================== .npmrc 安全配置 ====================

/**
 * 生成安全的 .npmrc 配置
 * 防止依赖混淆攻击
 */
function generateSecureNpmrc(options) {
  const {
    internalRegistry,
    internalScope,
    alwaysAuth = true,
  } = options;

  const lines = [
    '# 安全 npm 配置',
    `#${internalScope}:registry=${internalRegistry}`,
    alwaysAuth && `//${new URL(internalRegistry).host}/:_authToken=${internalScope}_TOKEN`,
    'strict-ssl=true',
    'engine-strict=true',
    '# 禁止自动运行脚本 (防 postinstall 攻击)',
    'ignore-scripts=false', // 注意: 设为 true 可能破坏某些包
  ].filter(Boolean);

  return lines.join('\n');
}

// ==================== CI/CD 供应链安全 ====================

/**
 * GitHub Actions 安全扫描
 */
function scanGitHubActions(repoRoot) {
  const actionsDir = path.join(repoRoot, '.github', 'workflows');
  const findings = [];

  if (!fs.existsSync(actionsDir)) return findings;

  const files = fs.readdirSync(actionsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(actionsDir, file), 'utf8');

    // 检查 1: 使用固定版本而非 branch/tag
    const actionRefs = content.match(/uses:\s*[^\s]+/g) || [];
    for (const ref of actionRefs) {
      if (!ref.includes('@') && !ref.includes('./')) {
        findings.push({
          file,
          severity: 'HIGH',
          title: `${ref} 未固定版本 (可能被篡改)`,
          fix: '使用 @vX.Y.Z 固定版本',
        });
      }
      // 检查是否使用 commit SHA (最安全)
      if (ref.includes('@') && !ref.match(/@[a-f0-9]{40}/)) {
        findings.push({
          file,
          severity: 'MEDIUM',
          title: `${ref} 使用 tag 而非 commit SHA`,
          fix: '使用完整 commit SHA (如 @a1b2c3d4...)',
        });
      }
    }

    // 检查 2: pull_request_target 权限提升
    if (content.includes('pull_request_target')) {
      findings.push({
        file,
        severity: 'HIGH',
        title: '使用 pull_request_target (可能被恶意 PR 利用)',
        fix: '确保不checkout PR 代码或不运行未信任代码',
      });
    }

    // 3: 检查是否泄露敏感信息
    if (content.includes('echo') && content.includes('SECRET')) {
      findings.push({
        file,
        severity: 'CRITICAL',
        title: '可能泄露 Secret 到日志',
        fix: '使用 ${{ secrets.XXX }} 并添加 *** 掩码',
      });
    }
  }

  return findings;
}
```

### 5.3 供应链安全 Checklist

```
□ package-lock.json 已提交到版本控制
□ integrity 哈希完整 (npm ci 而非 npm install)
□ npm audit 无 critical/high 漏洞
□ 无 typosquatting 包
□ 内部 scope 配置了独立 registry
□ .npmrc 配置了 strict-ssl
□ CI/CD 使用固定版本/commit SHA
□ 不运行未信任的第三方 Action
□ pull_request_target 谨慎使用
□ 定期更新依赖 (Dependabot/Renovate)
□ 监控维护者账号安全 (2FA)
□ 关键依赖有替代方案预案
□ 构建产物有签名/验证
□ SLSA 级别评估
```

---

## 6. 零信任架构 — Zero Trust

### 6.1 零信任原则

```
零信任核心原则:

1. 从不信任，始终验证 (Never Trust, Always Verify)
2. 最小权限访问 (Least Privilege)
3. 假设已被入侵 (Assume Breach)

传统安全模型:
  ┌─────────────────────────────┐
  │  网络边界 (防火墙)            │
  │  ┌───────────────────────┐  │
  │  │  内部网络 (可信)        │  │
  │  │  服务间无认证           │  │
  │  └───────────────────────┘  │
  └─────────────────────────────┘
  问题: 边界一旦被突破，内部完全暴露

零信任模型:
  ┌─────────────────────────────┐
  │  每个请求都验证              │
  │  ┌─────┐  ┌─────┐  ┌─────┐ │
  │  │服务A│→│服务B│→│服务C│ │
  │  └─────┘  └─────┘  └─────┘ │
  │   mTLS     mTLS    mTLS     │
  │  每个连接都需要认证+授权      │
  └─────────────────────────────┘
```

### 6.2 零信任实现

```javascript
// --- File: src/security/zero-trust.js ---

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ==================== 零信任中间件 ====================

class ZeroTrustMiddleware {
  constructor(options = {}) {
    this.serviceRegistry = new Map(); // serviceName → serviceInfo
    this.policyEngine = new PolicyEngine();
    this.auditLogger = new AuditLogger();
    this.certificateValidator = new CertificateValidator(options.caCert);
  }

  /**
   * 服务间认证中间件
   * 每个服务间请求都需要 mTLS + JWT
   */
  serviceAuth() {
    return (req, res, next) => {
      // 1. mTLS 证书验证 (由负载均衡器/Service Mesh 处理)
      // 这里假设已通过 mTLS 验证，从 Header 获取服务身份
      const serviceName = req.headers['x-service-name'];
      const serviceCert = req.headers['x-service-cert-fingerprint'];

      if (!serviceName) {
        return res.status(401).json({
          error: 'Service identity required',
          code: 'SERVICE_IDENTITY_MISSING'
        });
      }

      // 2. 验证服务身份
      const serviceInfo = this.serviceRegistry.get(serviceName);
      if (!serviceInfo) {
        this.auditLogger.log({
          event: 'UNKNOWN_SERVICE',
          serviceName,
          ip: req.ip,
          severity: 'HIGH'
        });
        return res.status(403).json({
          error: 'Unknown service',
          code: 'UNKNOWN_SERVICE'
        });
      }

      // 3. 验证证书指纹
      if (serviceInfo.certFingerprint && serviceCert !== serviceInfo.certFingerprint) {
        this.auditLogger.log({
          event: 'CERT_MISMATCH',
          serviceName,
          expected: serviceInfo.certFingerprint,
          received: serviceCert,
          severity: 'CRITICAL'
        });
        return res.status(403).json({
          error: 'Certificate mismatch',
          code: 'CERT_MISMATCH'
        });
      }

      // 4. JWT Token 验证 (服务间 Token)
      const token = req.headers['x-service-token'];
      if (!token) {
        return res.status(401).json({
          error: 'Service token required',
          code: 'SERVICE_TOKEN_MISSING'
        });
      }

      try {
        const decoded = jwt.verify(token, serviceInfo.sharedSecret, {
          algorithms: ['HS256'],
          issuer: serviceName,
          audience: req.serviceName, // 当前服务名
          maxAge: '5m',
        });

        req.serviceIdentity = {
          name: serviceName,
          roles: decoded.roles || [],
          permissions: decoded.permissions || [],
        };
      } catch (e) {
        this.auditLogger.log({
          event: 'INVALID_SERVICE_TOKEN',
          serviceName,
          error: e.message,
          severity: 'HIGH'
        });
        return res.status(401).json({
          error: 'Invalid service token',
          code: 'INVALID_SERVICE_TOKEN'
        });
      }

      next();
    };
  }

  /**
   * 细粒度授权中间件
   */
  authorize(requiredPermissions) {
    return (req, res, next) => {
      const identity = req.serviceIdentity || req.user;
      if (!identity) {
        return res.status(401).json({ error: 'Identity required' });
      }

      const hasPermission = requiredPermissions.every(perm => {
        // 检查直接权限
        if (identity.permissions?.includes(perm)) return true;
        // 检查角色权限
        if (identity.roles) {
          return identity.roles.some(role =>
            this.policyEngine.roleHasPermission(role, perm)
          );
        }
        return false;
      });

      if (!hasPermission) {
        this.auditLogger.log({
          event: 'AUTHORIZATION_DENIED',
          identity: identity.name || identity.userId,
          required: requiredPermissions,
          path: req.path,
          severity: 'MEDIUM'
        });
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: requiredPermissions
        });
      }

      next();
    };
  }

  /**
   * 请求上下文验证
   * 确保请求来自预期的上下文
   */
  validateContext(expectedContext) {
    return (req, res, next) => {
      const checks = [];

      // IP 范围验证
      if (expectedContext.allowedIps) {
        const ipAllowed = expectedContext.allowedIps.some(range => {
          return this.ipInRange(req.ip, range);
        });
        checks.push({ name: 'ip', passed: ipAllowed });
      }

      // 时间窗口验证
      if (expectedContext.timeWindow) {
        const now = new Date();
        const hour = now.getHours();
        const passed = hour >= expectedContext.timeWindow.start &&
                       hour <= expectedContext.timeWindow.end;
        checks.push({ name: 'time', passed });
      }

      // 设备指纹验证
      if (expectedContext.requireDeviceFingerprint) {
        const fingerprint = req.headers['x-device-fingerprint'];
        checks.push({
          name: 'device',
          passed: !!fingerprint && fingerprint === req.session?.deviceFingerprint
        });
      }

      // 检查是否所有条件都满足
      const allPassed = checks.every(c => c.passed);
      if (!allPassed) {
        const failed = checks.filter(c => !c.passed).map(c => c.name);
        this.auditLogger.log({
          event: 'CONTEXT_VALIDATION_FAILED',
          failed,
          ip: req.ip,
          severity: 'MEDIUM'
        });
        return res.status(403).json({
          error: 'Context validation failed',
          code: 'CONTEXT_VALIDATION_FAILED',
          failed
        });
      }

      next();
    };
  }

  ipInRange(ip, cidr) {
    // 简化的 CIDR 检查
    const [network, prefixLen] = cidr.split('/');
    const prefix = parseInt(prefixLen, 10);
    const ipNum = this.ipToNum(ip);
    const netNum = this.ipToNum(network);
    const mask = ~((1 << (32 - prefix)) - 1);
    return (ipNum & mask) === (netNum & mask);
  }

  ipToNum(ip) {
    return ip.split('.').reduce((num, octet) => (num << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  /**
   * 注册服务
   */
  registerService(serviceName, options = {}) {
    this.serviceRegistry.set(serviceName, {
      name: serviceName,
      sharedSecret: options.sharedSecret || crypto.randomBytes(64).toString('hex'),
      certFingerprint: options.certFingerprint,
      roles: options.roles || [],
      allowedIps: options.allowedIps || [],
      registeredAt: new Date().toISOString(),
    });
  }

  /**
   * 生成服务间 Token
   */
  generateServiceToken(serviceName, targetService, options = {}) {
    const serviceInfo = this.serviceRegistry.get(serviceName);
    if (!serviceInfo) throw new Error('Unknown service');

    return jwt.sign(
      {
        iss: serviceName,
        aud: targetService,
        roles: options.roles || serviceInfo.roles,
        permissions: options.permissions || [],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (options.ttl || 300), // 默认 5 分钟
      },
      serviceInfo.sharedSecret,
      { algorithm: 'HS256' }
    );
  }
}

// ==================== 策略引擎 ====================

class PolicyEngine {
  constructor() {
    this.rolePermissions = new Map();
    this.denyRules = [];
    this.allowRules = [];
  }

  /**
   * 定义角色权限
   */
  defineRole(role, permissions) {
    this.rolePermissions.set(role, new Set(permissions));
  }

  /**
   * 检查角色是否有权限
   */
  roleHasPermission(role, permission) {
    const perms = this.rolePermissions.get(role);
    return perms?.has(permission) || false;
  }

  /**
   * 添加拒绝规则 (优先级高于允许)
   */
  addDenyRule(rule) {
    this.denyRules.push(rule);
  }

  /**
   * 添加允许规则
   */
  addAllowRule(rule) {
    this.allowRules.push(rule);
  }

  /**
   * 评估策略
   */
  evaluate(request) {
    // 1. 先检查拒绝规则
    for (const rule of this.denyRules) {
      if (rule.match(request)) {
        return { allowed: false, reason: rule.reason };
      }
    }

    // 2. 检查允许规则
    for (const rule of this.allowRules) {
      if (rule.match(request)) {
        return { allowed: true };
      }
    }

    // 3. 默认拒绝
    return { allowed: false, reason: 'No matching allow rule' };
  }
}

// ==================== 审计日志 ====================

class AuditLogger {
  constructor(options = {}) {
    this.logFile = options.logFile || 'audit.log';
    this.sink = options.sink || 'console'; // console | file | syslog
  }

  log(event) {
    const entry = {
      timestamp: new Date().toISOString(),
      eventId: crypto.randomUUID(),
      ...event,
    };

    const logLine = JSON.stringify(entry);

    switch (this.sink) {
      case 'file':
        fs.appendFileSync(this.logFile, logLine + '\n');
        break;
      case 'syslog':
        // 发送到 syslog
        break;
      default:
        console.log(`[AUDIT] ${logLine}`);
    }

    // 高危事件告警
    if (event.severity === 'CRITICAL') {
      this.sendAlert(entry);
    }
  }

  sendAlert(entry) {
    // 发送到告警系统 (Slack/PagerDuty/...)
    console.error(`🚨 CRITICAL SECURITY EVENT: ${JSON.stringify(entry)}`);
  }
}

// ==================== 证书验证器 ====================

class CertificateValidator {
  constructor(caCert) {
    this.caCert = caCert;
    this.revokedCerts = new Set();
  }

  /**
   * 验证客户端证书
   */
  validateCertificate(cert) {
    // 1. 验证证书链
    // 2. 检查过期
    // 3. 检查吊销列表 (CRL/OCSP)
    if (this.revokedCerts.has(cert.fingerprint)) {
      throw new Error('Certificate revoked');
    }
    return true;
  }

  /**
   * 添加吊销证书
   */
  revokeCertificate(fingerprint) {
    this.revokedCerts.add(fingerprint);
  }
}

// ==================== 使用示例 ====================

const zt = new ZeroTrustMiddleware({
  caCert: fs.readFileSync('ca-cert.pem'),
});

// 注册服务
zt.registerService('api-gateway', { roles: ['gateway'] });
zt.registerService('user-service', { roles: ['service', 'user-read'] });
zt.registerService('payment-service', {
  roles: ['service', 'payment'],
  allowedIps: ['10.0.1.0/24'],
});

// 定义策略
zt.policyEngine.defineRole('admin', ['user:*', 'payment:*', 'system:*']);
zt.policyEngine.defineRole('service', ['user:read', 'payment:read']);
zt.policyEngine.defineRole('user-read', ['user:read']);

// 应用中间件
app.use('/api/', zt.serviceAuth());
app.use('/api/users', zt.authorize(['user:read']));
app.use('/api/payments', zt.authorize(['payment:write']));
app.use('/api/admin', zt.authorize(['system:admin']));

// 敏感操作需要额外上下文验证
app.post('/api/payments/transfer',
  zt.validateContext({
    allowedIps: ['10.0.1.0/24'],
    timeWindow: { start: 8, end: 20 },
    requireDeviceFingerprint: true,
  }),
  (req, res) => { /* ... */ }
);
```

---

## 7. 综合攻防演练 — 协议层组合攻击

### 7.1 场景: HTTP 走私 + 缓存投毒组合攻击

```
┌──────────────────────────────────────────────────────────┐
│  攻击链: 请求走私 → 缓存投毒 → 敏感数据泄露               │
│                                                          │
│  1. 攻击者发现 CDN → 后端存在 CL.TE 走私漏洞              │
│     → 走私一个请求到后端                                   │
│                                                          │
│  2. 走私的请求访问 /api/user/profile                      │
│     → 返回受害者 Alice 的个人信息                         │
│                                                          │
│  3. CDN 按 .json 扩展名缓存此响应                         │
│     → 缓存了 Alice 的敏感数据                             │
│                                                          │
│  4. 攻击者访问同一 URL                                    │
│     → 从 CDN 缓存获取 Alice 的数据                        │
│     → 邮箱/电话/地址全部泄露                              │
└──────────────────────────────────────────────────────────┘
```

### 7.2 场景: GraphQL + WebSocket 组合攻击

```
┌──────────────────────────────────────────────────────────┐
│  攻击链: GraphQL 内省 → 发现敏感字段 → WebSocket 注入     │
│                                                          │
│  1. 攻击者通过 GraphQL 内省发现 adminUser 查询            │
│     → 获取所有管理员账号信息                               │
│                                                          │
│  2. 利用 admin 账号登录 WebSocket                        │
│     → 注入恶意消息 (XSS payload)                          │
│                                                          │
│  3. 消息广播给所有在线用户                                 │
│     → 所有用户的浏览器执行 XSS                            │
│                                                          │
│  4. XSS 窃取 Session Token                               │
│     → 攻击者获得所有用户的访问权限                         │
└──────────────────────────────────────────────────────────┘
```

### 7.3 场景: 供应链 + 零信任绕过

```
┌──────────────────────────────────────────────────────────┐
│  攻击链: 依赖投毒 → 构建产物篡改 → 零信任绕过             │
│                                                          │
│  1. 攻击者劫持流行包维护者账号                             │
│     → 注入恶意 postinstall 脚本                           │
│                                                          │
│  2. CI/CD 构建时执行恶意脚本                              │
│     → 篡改构建产物 (注入后门)                             │
│                                                          │
│  3. 后门服务伪装成合法微服务                               │
│     → 注册到服务网格                                       │
│                                                          │
│  4. 后门使用合法服务证书                                  │
│     → 通过 mTLS 验证                                     │
│     → 访问所有内部服务                                    │
└──────────────────────────────────────────────────────────┘
```

### 7.4 防御对照表

```javascript
// --- 综合防御配置 ---

const defenseLayers = {
  // Layer 1: 协议安全
  protocol: {
    httpSmuggling: '统一 CL/TE 解析 + 拒绝冲突头 + 升级 HTTP/2',
    cacheDeception: 'no-store + Vary + Surrogate-Control',
    cachePoisoning: 'Vary 头 + X-Forwarded-* 白名单',
  },

  // Layer 2: API 安全
  api: {
    graphql: '复杂度限制 + 批量限制 + 内省控制 + 持久化查询',
    websocket: 'Origin 验证 + 认证 + 速率限制 + 消息验证',
  },

  // Layer 3: 供应链安全
  supplyChain: {
    audit: 'npm audit + 完整性验证 + 脚本扫描',
    prevention: 'lock 文件 + integrity + 固定版本 + Dependabot',
    ciCd: '固定 Action 版本 + SHA 验证 + 最小权限',
  },

  // Layer 4: 零信任
  zeroTrust: {
    auth: 'mTLS + JWT 服务间认证',
    authorization: 'RBAC + 细粒度权限 + 默认拒绝',
    context: 'IP + 时间 + 设备指纹多维验证',
    audit: '全量审计日志 + 高危告警',
  },

  // Layer 5: 监控与响应
  monitoring: {
    detection: '异常请求检测 + 模式匹配 + 行为分析',
    response: '自动隔离 + 告警 + 取证',
    recovery: '备份恢复 + 密钥轮换 + 服务降级',
  },
};
```

---

## 8. v10 新增知识点总结

### 与前 9 轮的差异化

| 主题 | v1-v9 | v10 (本次) |
|------|-------|-----------|
| XSS/CSRF/Sanitization/CSP | ✅ v1-v4 | ❌ 不重复 |
| 原型链污染/JWT/CORS | ✅ v7-v9 | ❌ 不重复 |
| **新: HTTP 请求走私** | ❌ | ✅ CL.TE/TE.CL/TE.TE + 检测 + 防御 |
| **新: HTTP 缓存欺骗** | ❌ | ✅ 扩展名欺骗/参数欺骗/缓存投毒 |
| **新: GraphQL 安全** | ❌ | ✅ 复杂度/批量/内省/字段权限/持久化查询 |
| **新: WebSocket 安全** | ❌ | ✅ 握手验证/消息验证/速率限制/安全广播 |
| **新: 供应链安全** | ❌ | ✅ 依赖投毒/维护者劫持/CI-CD 安全/审计 |
| **新: 零信任架构** | ❌ | ✅ mTLS/RBAC/策略引擎/审计日志 |
| **新: 组合攻击链** | ✅ v9 单链 | ✅ v10 协议层+API+供应链多维组合 |

### 核心收获

1. **HTTP 请求走私** 是协议层最危险的攻击之一 — CL/TE 解析不一致可导致请求劫持，升级 HTTP/2 是根本解决方案
2. **HTTP 缓存欺骗** 利用 CDN 缓存策略泄露敏感数据 — 认证响应必须 `no-store` + `Vary`
3. **GraphQL 安全** 不同于 REST — 需要复杂度限制、批量控制、内省管理、持久化查询
4. **WebSocket 安全** 常被忽视 — 需要 Origin 验证、认证、消息验证、速率限制
5. **供应链安全** 是近年最严重的威胁 — 依赖投毒、维护者劫持、CI/CD 攻击都需要系统性防御
6. **零信任架构** 是后边界安全时代的必然选择 — 每个请求都验证、最小权限、假设已被入侵
7. **组合攻击** 是真实攻击的常态 — 单点防御不够，需要纵深防御体系

### 防御优先级 (v10 新增)

```
P0 (必须):
  - HTTP/2 升级 (消除走私)
  - API 响应 no-store + Vary
  - GraphQL 复杂度限制 + 内省禁用
  - WebSocket Origin 验证 + 认证
  - npm audit 无 critical
  - package-lock.json + integrity
  - CI/CD Action 固定版本

P1 (重要):
  - HTTP 请求走私检测
  - 缓存投毒防御 (X-Forwarded-* 白名单)
  - GraphQL 持久化查询
  - WebSocket 消息验证 + 速率限制
  - 依赖完整性扫描 (typosquatting/脚本)
  - 服务间 mTLS + JWT
  - 细粒度 RBAC

P2 (建议):
  - HTTP 缓存欺骗检测
  - GraphQL 字段级权限
  - WebSocket 端到端加密
  - 供应链维护者监控
  - CI/CD SHA 验证
  - 零信任审计日志
  - 行为分析 + 异常检测
```

### 实战命令速查

```bash
# ==================== HTTP 走私检测 ====================
# 使用 smuggler 工具
python3 smuggler.py -u https://target.com -v

# ==================== GraphQL 安全扫描 ====================
# graphql-shield 中间件
npm i graphql-shield

# ==================== WebSocket 安全测试 ====================
# wss-attack 工具
npx wss-attack --url wss://target.com/ws --origin https://evil.com

# ==================== 供应链安全 ====================
npm audit                        # 已知漏洞
npm ls --production --depth=0   # 直接依赖清单
npx audit-ci --moderate         # CI 集成

# GitHub Actions 扫描
grep -r "uses:" .github/workflows/ | grep -v "@"  # 未固定版本

# ==================== 零信任验证 ====================
# 检查服务间通信是否加密
openssl s_client -connect service:8443 -verify_return_error

# 检查 JWT 配置
grep -r "algorithms" src/ | grep -v "HS256\|RS256"
```

---

*v10 完成 | 覆盖: HTTP 走私 / 缓存欺骗 / GraphQL 安全 / WebSocket 安全 / 供应链安全 / 零信任架构 / 组合攻击链*
*累计: v1-v10 ~600KB+ 安全专项训练*
