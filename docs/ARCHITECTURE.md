# Persona Lab Architecture

## Overview

Persona Lab is a personality assessment platform built with the Big Five (IPIP-NEO) model. It provides:

- Computerized Adaptive Testing (CAT) for efficient trait measurement
- MBTI-style type derivation from Big Five scores
- Personality growth tracking over time
- WeChat mini-program integration
- Membership and payment systems
- KOC (Key Opinion Consumer) referral marketing

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                     WeChat Mini-Program                     │
│                      (Client Layer)                        │
└─────────────────────────┬───────────────────────────────────┘
                        │ HTTPS + JWT
┌─────────────────────▼─────────────────────────────────────┐
│                    Node.js Express API                     │
│                     (Application Layer)                    │
├─────────────────────────────────────────────────────────────┤
│  Controllers  │  Services  │  Middleware  │  Security      │
└──────────────┴───────────┴─────────────┴────────────────┘
                        │
┌─────────────────────▼─────────────────────────────────────┐
│                   Business Logic Layer                     │
├─────────────────────────────────────────────────────────────┤
│  CAT Engine  │  Big5-MBTI  │  Compatibility  │  Stability   │
└─────────────────────────────────────────────────────────┘
                        │
┌─────────────────────▼─────────────────────────────────────┐
│                      Data Layer                            │
├────────────────────┬────────────────────┬───────────────┤
│    Prisma ORM       │     MySQL 8.0       │  Redis 7.0    │
│   (Type-safe DB)    │   (Persistent)     │  (Cache/Session) │
└─────────────────────┴─────────────────────┴────────────────┘
```

### Technology Stack

| Layer      | Technology | Version |
| ---------- | ---------- | ------- |
| Runtime    | Node.js    | >= 18   |
| Framework  | Express.js | ^4.x    |
| Language   | TypeScript | ^5.x    |
| Database   | MySQL      | 8.0+    |
| ORM        | Prisma     | ^5.x    |
| Cache      | Redis      | 7.0+    |
| Auth       | JWT        | -       |
| Logging    | Winston    | ^3.x    |
| Validation | Zod        | ^3.x    |
| Security   | Helmet     | ^7.x    |

## Business Logic Services

| Service              | File                        | Description                                 |
| -------------------- | --------------------------- | ------------------------------------------- |
| CAT Engine           | `cat-engine.ts`             | Item Response Theory based adaptive testing |
| Big5-MBTI            | `big5-to-mbti.ts`           | Factor score to MBTI type mapping           |
| Compatibility        | `compatibility-analyzer.ts` | Personality compatibility analysis          |
| Stability Calculator | `stability-calculator.ts`   | Longitudinal trait stability tracking       |

## Module Architecture

### 1. Authentication Module (`/api/v1/auth`)

**Components:**

- `authController.ts` - Login, logout, token refresh
- JWT middleware - Token validation
- WeChat OAuth - Mini-program authentication

**Flow:**

```
User Login → WeChat Code → Exchange for Session Key → Create JWT
```

### 2. Test Module (`/api/v1/tests`)

**Components:**

- `tests.ts` - Session management
- CAT Engine (`services/cat-engine.ts`) - Item selection
- `resultCalculator.ts` - Score computation

**CAT Algorithm:**

```
1. Start with average difficulty items
2. Estimate ability (θ) = 0
3. Select item that maximizes information at θ
4. Update θ using IRT (Item Response Theory)
5. Calculate SE (Standard Error)
6. Stop when SE < 0.3 or max items reached
```

### 3. Report Module (`/api/v1/reports`)

**Components:**

- `reports.ts` - Report generation and retrieval
- `llm-report.ts` - AI-powered personalized reports
- `big5-to-mbti.ts` - Factor to type mapping

**Big Five Dimensions:**
| Factor | Traits |
|--------|-------|
| Openness | Fantasy, Ideas, Values, Aesthetics, Actions, Feelings |
| Conscientiousness | Competence, Order, Dutifulness, Achievement, Self-Discipline |
| Extraversion | Warmth, Gregariousness, Assertiveness, Activity, Excitement, Positive Emotions |
| Agreeableness | Trust, Straightforwardness, Altruism, Compliance, Modesty |
| Neuroticism | Anxiety, Angry Hostility, Depression, Self-Consciousness, Impulsiveness, Vulnerability |

### 4. Membership Module (`/api/v1/memberships`)

**Components:**

- `memberships.ts` - Member management
- `membership-benefits.ts` - Benefit calculation

**Membership Levels:**
| Level | Price | Features |
|-------|-------|----------|
| Free | ¥0 | Basic report, 1 test/month |
| Standard | ¥29/mo | Full report, unlimited tests, history |
| Premium | ¥59/mo | + AI coaching, priority support |
| Enterprise | Custom | + White-label, custom branding |

### 5. Payment Module (`/api/v1/payments`)

**Components:**

- `payments.ts` - Payment processing
- `cost-control.ts` - WeChat Pay integration

**Flow:**

```
Create Order → WeChat Pay API → Callback → Verify → Complete
```

### 6. Growth Module (`/api/v1/growth`)

**Features:**

- Dual Test (friend comparison)
- Share Cards (social media)
- KOC Referral System

**Dual Test Flow:**

```
Inviter creates → Generates code → Invitee enters → Both take test → Comparison
```

**KOC Referral:**

```
Share link → Friend signs up → Makes payment → Commission earned → Withdraw
```

### 7. Life Events Module (`/api/v1/life-events`)

**Features:**

- Life event tracking
- Personality dimension correlation
- Impact analysis

**Life Event Types:**

- Career (职业发展)
- Relationship (人际关系)
- Health (健康状况)
- Finance (财务状况)
- Education (教育学习)
- Other (其他)

**Correlation Analysis:**

```
Record event → Link to personality result → Analyze correlation → Generate insights
```

### 8. Share Module (`/api/v1/share`)

**Features:**

- Invite codes (public validation, private creation)
- Share cards (personality, stability, dual-test)
- Share analytics

**Endpoints:**

- `GET /share/invite-code/:code` - Validate invite (public)
- `POST /share/invite-code` - Create invite (private)
- `GET /share/card/personality` - Generate personality card
- `GET /share/card/stability` - Generate stability card
- `GET /share/card/dual-test` - Generate dual-test comparison card
- `POST /share/track` - Track share analytics
- `GET /share/stats` - Get share statistics

## Data Models

### Core Entities

```prisma
model User {
  id              Int       @id @default(autoincrement())
  openid           String?   @unique
  unionid          String?
  nickname        String?
  avatarUrl       String?
  gender          Int?
  city            String?
  province        String?
  country         String?
  phone           String?
  isMember        Boolean   @default(false)
  membershipLevel String?
  membershipExpiry DateTime?
  testCount       Int       @default(0)
  createdAt       DateTime  @default(now())
  lastLoginAt     DateTime?

  testSessions    TestSession[]
  results         Result[]
  lifeEvents      LifeEvent[]
}

model TestSession {
  id              Int       @id @default(autoincrement())
  userId          Int
  status          String    // pending/active/completed
  currentItemIdx  Int       @default(0)
  abilityEstimate Float     @default(0)
  standardError   Float?
  startedAt       DateTime  @default(now())
  completedAt     DateTime?

  answers         Answer[]
  user            User      @relation(fields: [userId], references: [id])
  result          Result?
}

model Answer {
  id              Int       @id @default(autoincrement())
  sessionId       Int
  itemId          String
  score           Int

  session         TestSession @relation(fields: [sessionId], references: [id])
}

model Result {
  id              Int       @id @default(autoincrement())
  sessionId       Int       @unique
  userId          Int

  // Raw Big Five scores (0-100)
  openness        Float
  conscientiousness Float
  extraversion   Float
  agreeableness  Float
  neuroticism    Float

  // Derived MBTI type
  mbtiType       String?

  // Stability Index
  stabilityScore Float?

  // Report content
  reportText     Json?

  createdAt      DateTime   @default(now())

  session        TestSession @relation(fields: [sessionId], references: [id])
  user           User      @relation(fields: [userId], references: [id])
}

model LifeEvent {
  id              Int       @id @default(autoincrement())
  userId          Int
  resultId        Int?

  eventType       String    // career/relationship/health/etc
  title           String
  description     String?
  eventDate       DateTime
  expectedImpact  String?   // positive/negative/neutral
  actualImpactScore Int?

  createdAt      DateTime  @default(now())
  user            User     @relation(fields: [userId], references: [id])
  result          Result?  @relation(fields: [resultId], references: [id])
}
```

## Security Architecture

### Authentication

- JWT with RS256 signing
- Access token: 15 minutes
- Refresh token: 7 days (stored in HttpOnly cookie)
- Key rotation every 90 days

### Rate Limiting

| Endpoint | Limit        |
| -------- | ------------ |
| Auth     | 10/minute/IP |
| API      | 100/day/user |
| Reports  | 50/day/user  |

### Security Headers

```typescript
Helmet({
  contentSecurityPolicy: true,
  crossDomain: { policy: "master-only" },
  hsts: { maxAge: 31536000, includeSubDomains: true },
});
```

## Deployment

### Development

```bash
docker-compose up -d mysql redis
npm run dev
```

### Production (Docker)

```bash
docker-compose -f docker-compose.yml up -d --build
```

### Environment Variables

See `.env.example` for full configuration.

## Performance Considerations

### Optimization Strategies

1. **Caching**
   - Redis for session data
   - CDN for share card images
   - ETag for API responses

2. **Database**
   - Prisma connection pooling
   - Indexed queries on `userId`, `sessionId`
   - Pagination for list endpoints

3. **API**
   - Gzip compression
   - Response streaming for large reports
   - Background job for report generation

## Monitoring

### Health Checks

- `/health` - Basic liveness
- `/health/ready` - Readiness with dependencies

### Logging

- Winston with rotating files
- Error stack traces in `logs/error.log`
- JSON structured logging for production

## Future Enhancements

- [ ] GraphQL API
- [ ] Real-time WebSocket updates
- [ ] Mobile SDK
- [ ] AI Coaching Assistant
- [ ] Team/Corporate assessments
- [ ] Multi-language support
