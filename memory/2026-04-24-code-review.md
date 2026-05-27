# Code Review Report — 2026-04-24

## Overview

Reviewed files modified today across the Persona Lab project: server (Express/TypeScript), miniapp (Taro), and supporting services. Total ~120 files touched; focused on source code (not build artifacts/lock files).

---

## 🔴 CRITICAL Issues

### 1. Hardcoded Secrets in Source (payments.ts, auth.ts)

**File:** `server/src/controllers/payments.ts`

```ts
const WECHAT_PAY_MCHID = process.env.WECHAT_PAY_MCHID || "1234567890";
const WECHAT_PAY_KEY = process.env.WECHAT_PAY_KEY || "your_wechat_pay_key";
```

**Risk:** Fallback values act as defaults in production if env vars are missing. WeChat Pay key is a critical secret.
**Fix:** Fail fast on missing env vars instead of using defaults.

**File:** `server/src/security/auth.ts`

```ts
const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(64).toString("hex");
```

**Risk:** A random key generated at startup means all tokens are invalidated on every server restart. Also, in a multi-instance deployment, each instance would have a different secret.
**Fix:** Require `JWT_SECRET` and `JWT_REFRESH_SECRET` as mandatory env vars.

### 2. Encryption Middleware Decrypts with Empty IV/AuthTag

**File:** `server/src/security/encryption.ts`

```ts
item.phone = decrypt({
  encryptedData: item.phone,
  iv: "",
  authTag: "",
});
```

**Risk:** `decrypt()` uses AES-256-GCM which requires valid IV and authTag. Passing empty strings will throw or silently corrupt data. The Prisma middleware also only encrypts the `encryptedData` field (not iv/authTag) on write but tries to decrypt with empty iv/authTag on read — the write/read paths are mismatched.
**Fix:** Store iv/authTag alongside encrypted data in the DB, or use a simpler encryption scheme for field-level encryption.

### 3. SQL Injection Risk in WeChat Callback

**File:** `server/src/controllers/payments.ts`
The `parseWechatCallbackXml` function has a fallback that directly returns `xmlData` as-is. If an attacker sends JSON instead of XML, the callback proceeds with unverified data.
**Fix:** Reject non-XML content types at the middleware level.

---

## 🟡 HIGH Priority Issues

### 4. Rate Limiting Bypass in miniapp API

**File:** `miniapp/src/services/api.ts`
The miniapp uses `requiresAuth` flag but the `refreshToken` call doesn't check if the access token has expired before making requests. If the token is expired, all requests fail until the user manually re-logs in.
**Fix:** Implement automatic token refresh on 401 responses.

### 5. In-Memory Session Store for Tests

**File:** `server/src/controllers/tests.ts`

```ts
const sessionStore: Map<string, TestSession> = new Map();
const testHistoryStore: Map<string, TestHistory[]> = new Map();
```

**Risk:** All test sessions and history are lost on server restart. Not suitable for any non-dev environment.
**Fix:** Use Prisma/database for session persistence.

### 6. Duplicate PrismaClient Instances

Multiple files create their own `new PrismaClient()`:

- `server/src/security/auth.ts`
- `server/src/security/rate-limiter.ts`
- `server/src/controllers/auth.ts`
- `server/src/controllers/memberships.ts`
- `server/src/controllers/payments.ts`
- `server/src/controllers/reports.ts`
- `server/src/services/membership-benefits.ts`
- `server/src/services/push-notification.ts`
- `server/src/index.ts`

**Risk:** Each instance opens its own connection pool. With 9+ instances, this can exhaust DB connections under load.
**Fix:** Create a single shared PrismaClient in `server/src/index.ts` and export/import it.

### 7. Mock Payment Auto-Success

**File:** `server/src/services/membership-benefits.ts`

```ts
status: 'paid', // Mock: auto-success
```

**File:** `server/src/controllers/memberships.ts`

```ts
const updatedOrder = await prisma.order.update({
  data: { status: "paid", paidAt: new Date() },
});
```

**Risk:** In development, orders are auto-marked as paid without actual payment verification. If this code path is reachable in production, it's a revenue loss vulnerability.
**Fix:** Gate mock payment behind `NODE_ENV === 'development'`.

### 8. MD5 for WeChat Pay Signatures

**File:** `server/src/controllers/payments.ts`

```ts
const paySign = crypto.createHash("md5").update(signString).digest("hex");
```

**Risk:** MD5 is cryptographically broken. WeChat Pay officially supports HMAC-SHA256 (HMAC-SHA256 is the recommended algorithm).
**Fix:** Use `crypto.createHmac('sha256', key)` instead.

---

## 🟢 MEDIUM Priority Issues

### 9. Missing Input Validation in Tests Controller

**File:** `server/src/controllers/tests.ts`
The `submitAnswer` function doesn't validate that `questionId`, `dimension`, or `selectedOption` are present or valid. Malformed requests could cause silent failures.
**Fix:** Add input validation before processing.

### 10. No Error Handling for Prisma Queries

Multiple controllers use `as any` type casts to bypass Prisma's type system:

```ts
const user = (await prisma.user.findUnique({
  where: { wechatOpenid: openid } as any,
})) as any;
```

**Risk:** Hides schema mismatches and makes refactoring dangerous.
**Fix:** Fix the Prisma schema or use proper typed queries.

### 11. Hardcoded MBTI Data in Report Service

**File:** `server/src/services/llm-report.ts`

```ts
const data = {
  mbtiType: 'INTJ',  // 实际应从数据库获取
  eScore: 45,
  nScore: 72,
  ...
};
```

**Risk:** All reports will be generated with INTJ data regardless of actual test results.
**Fix:** Fetch actual test result data from the database.

### 12. LLM Call is Mocked

**File:** `server/src/services/llm-report.ts`

```ts
// 模拟响应（实际使用时删除）
await new Promise((resolve) =>
  setTimeout(resolve, 2000 + Math.random() * 3000),
);
```

**Risk:** The actual OpenAI API call is commented out. Reports are fake.
**Fix:** Uncomment the real API call and ensure `OPENAI_API_KEY` is configured.

### 13. No CORS Origin Validation in Production

**File:** `server/src/index.ts`

```ts
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
  }),
);
```

**Risk:** If `ALLOWED_ORIGINS` is not set, it defaults to `*` — allowing any origin to make authenticated requests.
**Fix:** Default to a specific origin or fail on startup if not configured.

### 14. Memory Leak in Rate Limit Stores

**File:** `server/src/services/llm-report.ts` and `server/src/security/rate-limiter.ts`
In-memory Maps (`userRateLimits`, `ipRateLimits`, `userStore`, `ipStore`) grow unbounded. No cleanup mechanism.
**Fix:** Implement TTL-based eviction or use Redis with native TTL support.

### 15. Test Routes Misconfiguration

**File:** `server/src/routes/tests.ts`

```ts
router.get("/sessions/:session_id/next", authMiddleware, submitAnswer);
```

The `GET /next` endpoint uses `submitAnswer` handler instead of a dedicated "get next question" handler.
**Fix:** Create a separate `getNextQuestion` controller.

---

## 🔵 LOW Priority / Suggestions

### 16. TypeScript/JavaScript File Duplication

Many files exist in both `.ts` and `.js` variants (e.g., `auth.ts` + `auth.js`, `payments.ts` + `payments.js`). This suggests the build process outputs to the same directory as source, or both are being tracked.
**Suggestion:** Keep `.ts` in `src/`, output `.js` to a `dist/` directory, and exclude `dist/` from git.

### 17. Missing API Documentation

Routes have JSDoc comments but there's no automated API documentation (OpenAPI/Swagger). The `/api` endpoint returns a placeholder.
**Suggestion:** Add `swagger-jsdoc` or `@tsoa/cli` for auto-generated docs.

### 18. No Health Check for Dependencies

The `/health` endpoint only checks the server itself, not database connectivity or Redis.
**Suggestion:** Add Prisma health check: `await prisma.$queryRaw`SELECT 1"`.

### 19. BASE_URL Port Mismatch Fixed

**File:** `miniapp/src/services/api.ts`

```diff
-const BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
+const BASE_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
```

Port changed from 3000 to 3001. Verify the server actually runs on 3001 (index.ts defaults to 3000).
**Suggestion:** Align the default ports or use env var consistently.

### 20. Simplified A/B Testing Service

**File:** `server/src/services/ab-testing.ts`
The entire service returns empty results. Comments say "修复类型错误" (fixed type errors) but the fix was to remove all logic.
**Suggestion:** Implement proper A/B testing or remove the file until needed.

---

## Summary Statistics

| Category          | Count |
| ----------------- | ----- |
| 🔴 Critical       | 3     |
| 🟡 High           | 6     |
| 🟢 Medium         | 7     |
| 🔵 Low/Suggestion | 5     |

## Top 3 Action Items

1. **Fix hardcoded secrets** — JWT_SECRET, WeChat Pay keys must be required env vars, not fallbacks
2. **Fix encryption middleware** — write/read paths are mismatched; data will be corrupted
3. **Consolidate PrismaClient** — single instance to prevent connection pool exhaustion

## Code Quality Assessment

- **Architecture:** Well-structured with clear layer separation (routes → controllers → services → models), but several services still use in-memory stores that need database migration
- **Security:** Good foundation (JWT auth, rate limiting, AES encryption), but critical gaps in secret management and signature algorithms
- **Performance:** Rate limiters use in-memory Maps (OK for dev, bad for prod); no caching layer for frequently accessed data
- **Maintainability:** Good TypeScript usage overall, but excessive `as any` casts undermine type safety; .ts/.js duplication needs cleanup
