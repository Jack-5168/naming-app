/**
 * 安全加固方案
 *
 * 加固内容：
 * - 速率限制（防刷）
 * - SQL 注入防护
 * - XSS 防护
 * - CSRF Token
 * - 敏感数据加密
 */

import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

// ==================== 速率限制（防刷） ====================

/**
 * 通用速率限制配置
 */
interface RateLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  max: number; // 最大请求数
  message: string; // 超出限制时的消息
  statusCode: number; // HTTP 状态码
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 分钟
  max: 100, // 100 次请求
  message: { error: "请求过于频繁，请稍后再试", code: "RATE_LIMIT_EXCEEDED" },
  statusCode: 429,
};

const STRICT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 分钟
  max: 20, // 20 次请求（敏感操作）
  message: {
    error: "操作过于频繁，请稍后再试",
    code: "STRICT_RATE_LIMIT_EXCEEDED",
  },
  statusCode: 429,
};

const API_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 1000, // 1000 次请求
  message: { error: "API 调用过于频繁", code: "API_RATE_LIMIT_EXCEEDED" },
  statusCode: 429,
};

/**
 * 创建速率限制中间件
 */
export function createRateLimiter(
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    statusCode: config.statusCode,
    standardHeaders: true, // 返回 RateLimit-* 头
    legacyHeaders: false, // 禁用 X-RateLimit-* 头
    keyGenerator: (req: Request) => {
      // 优先使用用户 ID，其次使用 IP
      return (req as any).user?.id || req.ip || "unknown";
    },
    handler: (req: Request, res: Response) => {
      res.status(config.statusCode).json(config.message);
    },
    skip: (req: Request) => {
      // 跳过健康检查和监控请求
      return req.path === "/health" || req.path === "/metrics";
    },
  });
}

/**
 * IP 黑名单管理
 */
class IPBlacklist {
  private blacklist: Set<string> = new Set();
  private temporaryBlocks: Map<string, number> = new Map(); // IP -> 过期时间

  /**
   * 添加永久黑名单
   */
  add(ip: string): void {
    this.blacklist.add(ip);
  }

  /**
   * 移除黑名单
   */
  remove(ip: string): void {
    this.blacklist.delete(ip);
    this.temporaryBlocks.delete(ip);
  }

  /**
   * 临时封禁（指定时长）
   */
  temporaryBlock(ip: string, durationMs: number): void {
    this.temporaryBlocks.set(ip, Date.now() + durationMs);
  }

  /**
   * 检查是否在黑名单中
   */
  isBlocked(ip: string): boolean {
    // 检查永久黑名单
    if (this.blacklist.has(ip)) {
      return true;
    }

    // 检查临时封禁
    const blockExpiry = this.temporaryBlocks.get(ip);
    if (blockExpiry) {
      if (Date.now() < blockExpiry) {
        return true;
      }
      // 过期清理
      this.temporaryBlocks.delete(ip);
    }

    return false;
  }

  /**
   * 清理过期的临时封禁
   */
  cleanup(): void {
    const now = Date.now();
    for (const [ip, expiry] of this.temporaryBlocks.entries()) {
      if (now >= expiry) {
        this.temporaryBlocks.delete(ip);
      }
    }
  }
}

const ipBlacklist = new IPBlacklist();

/**
 * IP 黑名单中间件
 */
export function ipBlacklistMiddleware() {
  // 定期清理（每 5 分钟）
  setInterval(() => ipBlacklist.cleanup(), 5 * 60 * 1000);

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || "unknown";

    if (ipBlacklist.isBlocked(ip)) {
      return res.status(403).json({
        error: "IP 地址已被封禁",
        code: "IP_BLACKLISTED",
      });
    }

    next();
  };
}

// ==================== SQL 注入防护 ====================

/**
 * SQL 注入检测
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
  /(--|#|\/\*)/, // SQL 注释
  /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i, // OR 1=1 攻击
  /(\b(OR|AND)\b\s+'[^']*'\s*=\s*'[^']*')/i, // OR 'a'='a' 攻击
  /(;.*(\b(SELECT|INSERT|UPDATE|DELETE)\b))/i, // 分号注入
  /(\bEXEC(\UTE)?\b\s*\()/i, // 存储过程执行
  /(\b(WAITFOR|BENCHMARK|SLEEP)\b)/i, // 时间盲注
  /(\b(LOAD_FILE|INTO\s+OUTFILE)\b)/i, // 文件操作
];

/**
 * 检测 SQL 注入
 */
export function detectSQLInjection(input: string): boolean {
  if (!input || typeof input !== "string") {
    return false;
  }

  // URL 解码
  let decoded = input;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    // 忽略解码错误
  }

  // 检查 SQL 注入模式
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(decoded)) {
      return true;
    }
  }

  return false;
}

/**
 * 清理 SQL 注入字符
 */
export function sanitizeSQLInput(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // 移除危险字符
  return input
    .replace(/['"\\;]/g, "") // 移除引号、反斜杠、分号
    .replace(/--/g, "") // 移除 SQL 注释
    .replace(/\/\*/g, "") // 移除块注释开始
    .replace(/\*\//g, ""); // 移除块注释结束
}

/**
 * SQL 注入防护中间件
 */
export function sqlInjectionMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // 检查所有输入
    const inputsToCheck = [
      ...Object.values(req.query),
      ...Object.values(req.body),
      ...Object.values(req.params),
    ].filter(Boolean);

    for (const input of inputsToCheck) {
      if (typeof input === "string" && detectSQLInjection(input)) {
        const ip = req.ip || "unknown";
        console.warn(
          `[Security] SQL injection attempt detected from ${ip}:`,
          input.substring(0, 100),
        );

        // 临时封禁 IP
        ipBlacklist.temporaryBlock(ip, 30 * 60 * 1000); // 30 分钟

        return res.status(400).json({
          error: "非法输入",
          code: "SQL_INJECTION_DETECTED",
        });
      }
    }

    next();
  };
}

/**
 * 参数化查询助手
 */
export class SafeQueryBuilder {
  private query: string;
  private params: any[] = [];

  constructor(table: string) {
    this.query = `SELECT * FROM ${this.sanitizeIdentifier(table)}`;
  }

  /**
   * 添加 WHERE 条件（参数化）
   */
  where(column: string, operator: string, value: any): this {
    const safeColumn = this.sanitizeIdentifier(column);
    const safeOperator = [
      "=",
      "!=",
      "<",
      ">",
      "<=",
      ">=",
      "LIKE",
      "IN",
    ].includes(operator.toUpperCase())
      ? operator
      : "=";

    this.query += ` WHERE ${safeColumn} ${safeOperator} $${this.params.length + 1}`;
    this.params.push(value);

    return this;
  }

  /**
   * 添加 ORDER BY
   */
  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    const safeColumn = this.sanitizeIdentifier(column);
    const safeDirection = direction.toUpperCase() === "DESC" ? "DESC" : "ASC";

    this.query += ` ORDER BY ${safeColumn} ${safeDirection}`;

    return this;
  }

  /**
   * 添加 LIMIT
   */
  limit(count: number): this {
    const safeCount = Math.min(Math.max(1, count), 1000); // 限制 1-1000

    this.query += ` LIMIT $${this.params.length + 1}`;
    this.params.push(safeCount);

    return this;
  }

  /**
   * 获取查询和参数
   */
  build(): { query: string; params: any[] } {
    return {
      query: this.query,
      params: this.params,
    };
  }

  /**
   * 清理标识符（表名、列名）
   */
  private sanitizeIdentifier(identifier: string): string {
    // 只允许字母、数字、下划线
    return identifier.replace(/[^a-zA-Z0-9_]/g, "");
  }
}

// ==================== XSS 防护 ====================

/**
 * XSS 攻击模式检测
 */
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // script 标签
  /javascript:/gi, // javascript: 协议
  /on\w+\s*=/gi, // 事件处理器
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, // iframe
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, // object
  /<embed\b[^<]*>/gi, // embed
  /<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, // svg
  /expression\s*\(/gi, // CSS expression
  /url\s*\(\s*["']?\s*javascript:/gi, // CSS url javascript
];

/**
 * 检测 XSS 攻击
 */
export function detectXSS(input: string): boolean {
  if (!input || typeof input !== "string") {
    return false;
  }

  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * HTML 转义
 */
export function escapeHTML(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  const escapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };

  return input.replace(/[&<>"'/]/g, (char) => escapeMap[char]);
}

/**
 * 清理 HTML（白名单过滤）
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // 允许的标签
  const allowedTags = [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "a",
    "img",
    "ul",
    "ol",
    "li",
  ];

  // 移除不允许的标签
  let sanitized = input.replace(
    /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
    (match, tagName) => {
      if (allowedTags.includes(tagName.toLowerCase())) {
        return match;
      }
      return "";
    },
  );

  // 清理危险属性
  sanitized = sanitized.replace(/\s+(on\w+|href)\s*=\s*["'][^"']*["']/gi, "");

  return sanitized;
}

/**
 * XSS 防护中间件
 */
export function xssMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // 检查所有输入
    const inputsToCheck = [
      ...Object.values(req.query),
      ...Object.values(req.body),
    ].filter(Boolean);

    for (const input of inputsToCheck) {
      if (typeof input === "string" && detectXSS(input)) {
        const ip = req.ip || "unknown";
        console.warn(
          `[Security] XSS attempt detected from ${ip}:`,
          input.substring(0, 100),
        );

        return res.status(400).json({
          error: "非法输入",
          code: "XSS_DETECTED",
        });
      }
    }

    next();
  };
}

// ==================== CSRF Token ====================

/**
 * CSRF Token 生成与验证
 */
class CSRFProtection {
  private secret: string;
  private tokenExpiry: number;

  constructor(secret: string, expiryMs: number = 3600000) {
    this.secret = secret;
    this.tokenExpiry = expiryMs;
  }

  /**
   * 生成 CSRF Token
   */
  generateToken(sessionId: string): string {
    const timestamp = Date.now();
    const data = `${sessionId}:${timestamp}`;
    const signature = crypto
      .createHmac("sha256", this.secret)
      .update(data)
      .digest("hex");

    return Buffer.from(`${data}:${signature}`).toString("base64");
  }

  /**
   * 验证 CSRF Token
   */
  validateToken(sessionId: string, token: string): boolean {
    try {
      const decoded = Buffer.from(token, "base64").toString("utf-8");
      const [sessionPart, timestampStr, signature] = decoded.split(":");

      if (sessionPart !== sessionId) {
        return false;
      }

      const timestamp = parseInt(timestampStr, 10);
      if (Date.now() - timestamp > this.tokenExpiry) {
        return false; // Token 过期
      }

      // 验证签名
      const expectedSignature = crypto
        .createHmac("sha256", this.secret)
        .update(`${sessionPart}:${timestampStr}`)
        .digest("hex");

      return crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex"),
      );
    } catch {
      return false;
    }
  }
}

let csrfProtection: CSRFProtection | null = null;

/**
 * 初始化 CSRF 保护
 */
export function initCSRF(secret: string, expiryMs?: number) {
  csrfProtection = new CSRFProtection(secret, expiryMs);
}

/**
 * 获取 CSRF Token
 */
export function getCSRFToken(sessionId: string): string {
  if (!csrfProtection) {
    throw new Error("CSRF protection not initialized");
  }
  return csrfProtection.generateToken(sessionId);
}

/**
 * CSRF 验证中间件
 */
export function csrfMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // 跳过安全方法
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    const sessionId = (req as any).session?.id;
    const token = (req.headers["x-csrf-token"] as string) || req.body._csrf;

    if (!sessionId || !token) {
      return res.status(403).json({
        error: "CSRF token required",
        code: "CSRF_TOKEN_MISSING",
      });
    }

    if (!csrfProtection?.validateToken(sessionId, token)) {
      return res.status(403).json({
        error: "Invalid CSRF token",
        code: "CSRF_TOKEN_INVALID",
      });
    }

    next();
  };
}

// ==================== 敏感数据加密 ====================

/**
 * 加密配置
 */
const ENCRYPTION_CONFIG = {
  algorithm: "aes-256-gcm",
  keyLength: 32,
  ivLength: 16,
  authTagLength: 16,
};

/**
 * 加密类
 */
class EncryptionService {
  private key: Buffer;

  constructor(key: string) {
    // 确保 key 长度正确
    this.key = crypto.createHash("sha256").update(key).digest();
  }

  /**
   * 加密数据
   */
  encrypt(data: string): string {
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
    const cipher = crypto.createCipheriv(
      ENCRYPTION_CONFIG.algorithm,
      this.key,
      iv,
      { authTagLength: ENCRYPTION_CONFIG.authTagLength },
    );

    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    // 返回：iv:authTag:encryptedData
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  /**
   * 解密数据
   */
  decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(":");

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(
      ENCRYPTION_CONFIG.algorithm,
      this.key,
      iv,
      { authTagLength: ENCRYPTION_CONFIG.authTagLength },
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  /**
   * 哈希（不可逆）
   */
  hash(data: string, salt?: string): string {
    const saltedData = salt ? `${data}:${salt}` : data;
    return crypto.createHash("sha256").update(saltedData).digest("hex");
  }

  /**
   * 生成随机盐
   */
  generateSalt(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /**
   * 验证哈希
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    const computedHash = this.hash(data, salt);
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, "hex"),
      Buffer.from(hash, "hex"),
    );
  }
}

let encryptionService: EncryptionService | null = null;

/**
 * 初始化加密服务
 */
export function initEncryption(key: string) {
  encryptionService = new EncryptionService(key);
}

/**
 * 加密敏感数据
 */
export function encryptSensitiveData(data: string): string {
  if (!encryptionService) {
    throw new Error("Encryption service not initialized");
  }
  return encryptionService.encrypt(data);
}

/**
 * 解密敏感数据
 */
export function decryptSensitiveData(encryptedData: string): string {
  if (!encryptionService) {
    throw new Error("Encryption service not initialized");
  }
  return encryptionService.decrypt(encryptedData);
}

/**
 * 哈希密码
 */
export function hashPassword(
  password: string,
  salt?: string,
): { hash: string; salt: string } {
  if (!encryptionService) {
    initEncryption(process.env.ENCRYPTION_KEY || "default-key-change-me");
  }

  const actualSalt = salt || encryptionService!.generateSalt();
  const hash = encryptionService!.hash(password, actualSalt);

  return { hash, salt: actualSalt };
}

/**
 * 验证密码
 */
export function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): boolean {
  if (!encryptionService) {
    initEncryption(process.env.ENCRYPTION_KEY || "default-key-change-me");
  }

  return encryptionService!.verifyHash(password, hash, salt);
}

// ==================== 安全响应头 ====================

/**
 * 安全响应头中间件
 */
export function securityHeadersMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // 防止点击劫持
    res.setHeader("X-Frame-Options", "DENY");

    // 防止 MIME 类型嗅探
    res.setHeader("X-Content-Type-Options", "nosniff");

    // XSS 防护
    res.setHeader("X-XSS-Protection", "1; mode=block");

    // 严格传输安全（HSTS）
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );

    // 内容安全策略
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join("; "),
    );

    // Referrer 策略
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    // 权限策略
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=()",
    );

    next();
  };
}

// ==================== 综合安全中间件 ====================

/**
 * 应用所有安全中间件
 */
export function applySecurityMiddleware(app: any) {
  // 安全响应头
  app.use(securityHeadersMiddleware());

  // IP 黑名单
  app.use(ipBlacklistMiddleware());

  // 速率限制
  app.use("/api/", createRateLimiter(API_RATE_LIMIT));
  app.use("/api/auth/", createRateLimiter(STRICT_RATE_LIMIT));
  app.use("/api/payment/", createRateLimiter(STRICT_RATE_LIMIT));

  // SQL 注入防护
  app.use(sqlInjectionMiddleware());

  // XSS 防护
  app.use(xssMiddleware());

  // CSRF 防护（需要初始化）
  // app.use(csrfMiddleware());

  console.log("[Security] All security middleware applied");
}

// ==================== 导出 ====================

export {
  createRateLimiter,
  ipBlacklistMiddleware,
  detectSQLInjection,
  sanitizeSQLInput,
  sqlInjectionMiddleware,
  SafeQueryBuilder,
  detectXSS,
  escapeHTML,
  sanitizeHTML,
  xssMiddleware,
  initCSRF,
  getCSRFToken,
  csrfMiddleware,
  initEncryption,
  encryptSensitiveData,
  decryptSensitiveData,
  hashPassword,
  verifyPassword,
  securityHeadersMiddleware,
  applySecurityMiddleware,
  IPBlacklist,
  EncryptionService,
};

export default {
  createRateLimiter,
  applySecurityMiddleware,
  hashPassword,
  verifyPassword,
  encryptSensitiveData,
  decryptSensitiveData,
};
