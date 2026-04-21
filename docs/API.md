# Persona Lab API Documentation

**Base URL:** `http://localhost:3000/api/v1`

**Version:** 1.0.0

---

## Table of Contents

- [Authentication](#authentication)
- [Auth Module](#auth-module)
- [Test Module](#test-module)
- [Report Module](#report-module)
- [Payment Module](#payment-module)
- [Membership Module](#membership-module)
- [Growth Module](#growth-module)
- [Health Check](#health-check)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Authentication

All private endpoints require a Bearer token in the Authorization header:

```http
Authorization: Bearer <access_token>
```

### Token Lifecycle

- **Access Token:** Valid for 15 minutes
- **Refresh Token:** Valid for 7 days
- **Key Rotation:** JWT secrets rotate every 90 days

---

## Auth Module

**Base Path:** `/api/v1/auth`

### POST /auth/wechat/login

WeChat mini-program login with OAuth code.

**Access:** Public

**Request Body:**
```json
{
  "code": "wechat_login_code"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "nickname": "探索者",
      "avatar": "https://...",
      "isMember": false,
      "testCount": 0
    },
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "expiresIn": 900
  }
}
```

---

### POST /auth/refresh

Refresh access token using refresh token.

**Access:** Public

**Request Body:**
```json
{
  "refreshToken": "eyJhbG..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "expiresIn": 900
  }
}
```

---

### POST /auth/logout

Logout user and revoke all tokens.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### GET /auth/me

Get current authenticated user information.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nickname": "探索者",
    "avatar": "https://...",
    "email": "user@example.com",
    "isMember": true,
    "membershipLevel": "standard",
    "testCount": 5
  }
}
```

---

## Test Module

**Base Path:** `/api/v1/tests`

### POST /tests/sessions

Create a new test session with CAT (Computerized Adaptive Testing) algorithm.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "totalQuestions": 15,
    "minQuestions": 10,
    "estimatedTime": "5-8 minutes"
  }
}
```

---

### GET /tests/sessions/:id

Get test session details and progress.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "in_progress",
    "questionNumber": 3,
    "totalQuestions": 15,
    "progress": 20,
    "startedAt": "2024-01-01T10:00:00Z"
  }
}
```

---

### GET /tests/sessions/:id/next

Get next question using CAT algorithm.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "completed": false,
    "question": {
      "id": 42,
      "text": "在社交聚会中，你通常会？",
      "dimension": "E",
      "options": [
        { "id": 1, "text": "主动与很多人交流", "score": 5 },
        { "id": 2, "text": "只与熟悉的人交流", "score": -5 }
      ]
    },
    "questionNumber": 4,
    "totalQuestions": 15,
    "progress": 26.67
  }
}
```

---

### POST /tests/sessions/:id/answer

Submit answer for current question.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "questionId": 42,
  "optionId": 1,
  "timeSpent": 15
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "questionNumber": 4,
    "nextQuestionNumber": 5
  }
}
```

---

### POST /tests/sessions/:id/complete

Complete test session and calculate final results.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "testResultId": 123,
    "mbtiType": "ENFP",
    "dimensionScores": {
      "E": 75,
      "N": 60,
      "T": 80,
      "J": 45
    },
    "stabilityIndex": 0.85,
    "completedAt": "2024-01-01T10:08:00Z"
  }
}
```

---

### GET /tests/results/:id

Get detailed test results.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "mbtiType": "ENFP",
    "dimensionScores": {
      "E": 75,
      "N": 60,
      "T": 80,
      "J": 45
    },
    "stabilityIndex": 0.85,
    "createdAt": "2024-01-01T10:08:00Z"
  }
}
```

---

## Report Module

**Base Path:** `/api/v1/reports`

### GET /reports/sample

Get sample report for preview.

**Access:** Public

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "sample",
    "reportType": "basic",
    "title": "ENFP 人格分析报告（示例）",
    "summary": "这是报告示例，展示报告的基本结构",
    "content": {
      "sections": [
        {
          "title": "人格类型概述",
          "content": "..."
        }
      ]
    },
    "isUnlocked": true
  }
}
```

---

### POST /reports

Generate a new report based on test results.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "testResultId": 123,
  "reportType": "basic"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "reportType": "basic",
    "status": "completed",
    "generationTime": 2500,
    "isUnlocked": true
  }
}
```

---

### GET /reports

Get user's report history.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 10)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": 456,
        "reportType": "basic",
        "title": "ENFP 人格分析报告",
        "isUnlocked": true,
        "createdAt": "2024-01-01T10:10:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 10
  }
}
```

---

### GET /reports/:id

Get detailed report by ID.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "reportType": "basic",
    "title": "ENFP 人格分析报告",
    "summary": "基于您的四维得分生成的基础级报告",
    "content": {
      "sections": [
        {
          "title": "人格类型概述",
          "content": "..."
        },
        {
          "title": "维度分析",
          "content": "..."
        }
      ]
    },
    "isUnlocked": true,
    "testResult": {
      "mbtiType": "ENFP",
      "dimensionScores": {
        "E": 75,
        "N": 60,
        "T": 80,
        "J": 45
      },
      "stabilityIndex": 0.85
    }
  }
}
```

---

### POST /reports/:id/unlock

Unlock premium report using membership or payment.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "isUnlocked": true,
    "unlockedAt": "2024-01-01T10:15:00Z"
  }
}
```

---

## Payment Module

**Base Path:** `/api/v1/payments`

### POST /payments/create-order

Create a payment order for membership or report unlock.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "productId": 2,
  "productType": "membership"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "orderId": 789,
    "orderNo": "ORD20240101100001",
    "amount": 990,
    "currency": "CNY",
    "paymentData": {
      "appId": "wx...",
      "timeStamp": "...",
      "nonceStr": "...",
      "package": "...",
      "signType": "RSA",
      "paySign": "..."
    }
  }
}
```

---

### POST /payments/wechat/callback

WeChat payment webhook callback.

**Access:** Public (Webhook)

**Request Body:**
```json
{
  "orderId": 789,
  "transactionId": "wx20240101100001",
  "status": "SUCCESS",
  "timestamp": "2024-01-01T10:00:00Z",
  "sign": "..."
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### GET /payments/orders

Get user's payment order history.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 10)
- `status` (optional: pending, success, failed, refunded)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": 789,
        "orderNo": "ORD20240101100001",
        "amount": 990,
        "status": "success",
        "paymentTime": "2024-01-01T10:00:00Z",
        "productInfo": {
          "name": "标准会员",
          "type": "membership"
        }
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 10
  }
}
```

---

### GET /payments/orders/:id

Get detailed order information.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "orderId": 789,
    "orderNo": "ORD20240101100001",
    "amount": 990,
    "currency": "CNY",
    "status": "success",
    "paymentTime": "2024-01-01T10:00:00Z",
    "productInfo": {
      "id": 2,
      "name": "标准会员",
      "type": "membership"
    }
  }
}
```

---

### POST /payments/refund

Process refund for an order.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "orderId": 789,
  "reason": "用户申请退款"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "refundId": "REF20240101100001",
    "amount": 990,
    "status": "processing"
  }
}
```

---

## Membership Module

**Base Path:** `/api/v1/memberships`

### GET /memberships/products

Get all available membership products.

**Access:** Public

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "单次测试解锁",
      "description": "解锁单次完整测试报告",
      "price": 29.00,
      "currency": "CNY",
      "durationDays": 0,
      "level": "basic",
      "pricePerUse": 29.00
    },
    {
      "id": 2,
      "name": "标准会员",
      "description": "30 天内无限次测试",
      "price": 99.00,
      "currency": "CNY",
      "durationDays": 30,
      "level": "standard",
      "pricePerUse": 9.90
    },
    {
      "id": 3,
      "name": "高级会员",
      "description": "90 天无限次测试 + 高级报告",
      "price": 199.00,
      "currency": "CNY",
      "durationDays": 90,
      "level": "premium",
      "pricePerUse": 6.63
    }
  ]
}
```

---

### GET /memberships/me

Get current user's membership status and benefits.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "membership": {
      "level": "standard",
      "expiresAt": "2024-02-01T10:00:00Z",
      "benefits": [
        "无限次测试",
        "基础报告",
        "双人对测"
      ]
    },
    "isActive": true,
    "daysRemaining": 30
  }
}
```

---

### POST /memberships/upgrade

Upgrade user's membership level.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "productId": 2
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "newLevel": "standard",
    "expiresAt": "2024-02-01T10:00:00Z"
  }
}
```

---

### GET /memberships/benefits

Get detailed benefits for all membership levels.

**Access:** Public

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "basic": [
      "单次测试解锁",
      "基础报告"
    ],
    "standard": [
      "30 天无限次测试",
      "基础报告",
      "双人对测",
      "分享卡片"
    ],
    "premium": [
      "90 天无限次测试",
      "高级报告",
      "双人对测",
      "分享卡片",
      "KOC 推广"
    ]
  }
}
```

---

## Growth Module

**Base Path:** `/api/v1/growth`

### POST /growth/dual-test/create

Create a dual test invitation for friend comparison.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "inviteeWechat": "wx_id_or_phone"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "dualTestId": "dt_xxx",
    "inviteCode": "ABC123",
    "expiresAt": "2024-01-08T10:00:00Z"
  }
}
```

---

### POST /growth/dual-test/accept

Accept a dual test invitation.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "inviteCode": "ABC123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "dualTestId": "dt_xxx",
    "status": "accepted"
  }
}
```

---

### POST /growth/dual-test/complete

Complete dual test and generate comparison report.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "dualTestId": "dt_xxx",
    "comparisonReport": {
      "similarity": 0.75,
      "compatibleTypes": ["ENFP", "INFJ"]
    }
  }
}
```

---

### GET /growth/dual-test/:id

Get dual test session details.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "dualTestId": "dt_xxx",
    "status": "pending",
    "inviter": { "id": 1, "nickname": "探索者" },
    "invitee": null,
    "expiresAt": "2024-01-08T10:00:00Z"
  }
}
```

---

### GET /growth/share-card/personality

Generate personality share card for social media.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "cardUrl": "https://cdn.persona-lab.com/cards/xxx.png",
    "shareText": "我是 ENFP - 竞选者型人格"
  }
}
```

---

### GET /growth/share-card/stability

Generate stability index share card.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "cardUrl": "https://cdn.persona-lab.com/cards/stability_xxx.png",
    "stabilityIndex": 0.85
  }
}
```

---

### GET /growth/koc/referral-link

Get user's unique referral link.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "referralLink": "https://persona-lab.com/?ref=user123",
    "referralCode": "user123"
  }
}
```

---

### GET /growth/koc/commissions

Get commission history and balance.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "balance": 299.00,
    "currency": "CNY",
    "commissions": [
      {
        "id": 1,
        "amount": 29.00,
        "referralUserId": 456,
        "status": "completed",
        "createdAt": "2024-01-01T10:00:00Z"
      }
    ]
  }
}
```

---

### POST /growth/koc/withdraw

Request commission withdrawal.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "amount": 100.00,
  "withdrawMethod": "wechat",
  "withdrawAccount": "wx_id"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "withdrawId": "wd_xxx",
    "amount": 100.00,
    "status": "processing"
  }
}
```

---

### GET /growth/koc/dashboard

Get KOC dashboard with stats and analytics.

**Access:** Private

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalReferrals": 15,
    "totalEarnings": 435.00,
    "pendingWithdrawals": 100.00,
    "conversionRate": 0.25,
    "recentActivity": []
  }
}
```

---

## Health Check

### GET /health

Health check endpoint for monitoring.

**Access:** Public

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "uptime": 3600.5
}
```

---

## Error Handling

All errors follow a standardized format:

```json
{
  "success": false,
  "error": {
    "code": 40001,
    "message": "Error message",
    "details": "Optional details"
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Error Codes

| Code | Description |
|------|-------------|
| 40001 | Invalid request body |
| 40002 | Missing required field |
| 40101 | No token provided |
| 40102 | Invalid token |
| 40103 | Token expired |
| 40301 | Insufficient permissions |
| 40302 | Membership required |
| 40401 | Resource not found |
| 42901 | Rate limit exceeded |
| 50001 | Internal server error |

---

## Rate Limiting

### Limits

- **User Limit:** 100 requests per day
- **IP Limit:** 500 requests per hour

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704100800
```

### Rate Limit Response (429)

```json
{
  "success": false,
  "error": {
    "code": 42901,
    "message": "Rate limit exceeded",
    "retryAfter": 3600
  }
}
```

---

## Webhooks

### Payment Callback

**URL:** `/api/v1/payments/wechat/callback`

WeChat Pay sends POST requests to this endpoint when payment status changes.

**Verification:** All webhook requests include a signature that must be verified.

---

## API Versioning

Current API version: **v1**

Version is specified in the URL path: `/api/v1/...`

Future versions will follow the pattern: `/api/v2/...`

---

*Last updated: 2024-01-01*
