# 代码质量改进 - 重构指南

## 1. 重复 PrismaClient 实例化

### 当前问题
```typescript
// auth.ts, dual-test.ts, growth.ts, memberships.ts, 
// payments.ts, reports.ts, share.ts 各自有:
const prisma = new PrismaClient();
```

### 修复步骤
每个 controller 文件需要修改两处:

**Step 1: 删除本地 PrismaClient 初始化**

注释掉 `const prisma = new PrismaClient()` 或完全删除该行。

**Step 2: 添加共享导入**

在 import 区域顶部添加:
```typescript
import { prisma } from '../lib/prisma';
```

**示例 (auth.ts)**:
```diff
- import { PrismaClient } from '@prisma/client';
+ import { prisma } from '../lib/prisma';
...
- const prisma = new PrismaClient();
```

---

## 2. 重复 Winston Logger 实例化

### 已有的共享 Logger
查看 `src/lib/logger.ts`:

```typescript
// src/lib/logger.ts 已存在，但各 controller 没有使用
```

### 修复步骤

**直接导入**:
```typescript
import { logger } from '../lib/logger';
```

---

## 3. 过长 Controller 方法拆分

### reports.ts - generateReportHandler 示例

目标: 提取验证逻辑和数据准备到单独的函数。

```typescript
// 当前 ~220 行的方法拆分为:
// 1. validateGenerateReportRequest(req)
// 2. prepareReportContext(resultId)
// 3. buildReportConfig(reportType)

// 新结构:
export async function generateReportHandler(req: Request, res: Response) {
  try {
    // 提取的验证逻辑
    const validated = validateGenerateReportRequest(req);
    if (!validated.valid) {
      return res.status(400).json({ code: 400, message: validated.error });
    }

    // 提取的数据准备
    const context = await prepareReportContext(validated.resultId);
    
    // 核心业务逻辑
    const report = await generateReport(context);
    
    return res.json({ code: 200, data: report });
  } catch (error) {
    logger.error('generateReportHandler failed', { error });
    return res.status(500).json({ code: 500, message: 'Internal error' });
  }
}

function validateGenerateReportRequest(req: Request): ValidateResult {
  // 30 行提取到这里
}

function prepareReportContext(resultId: number): Promise<ReportContext> {
  // 50 行提取到这里
}
```

---

## 4. 类型定义提取

### 报告相关的接口

从 `reports.ts` 提取到 `src/types/reports.ts`:

```typescript
// src/types/reports.ts
export interface GenerateReportRequest {
  result_id: number;
  report_type: 'basic' | 'pro' | 'master';
  include_sections?: string[];
}

export interface GenerateReportResponse {
  code: number;
  data: {
    report_id: number;
    status: string;
    estimated_time_seconds: number;
    progress_url: string;
  };
}

// ... 其他接口
```

---

## 5. 配置文件提取

从 `reports.ts` 提取常量配置:

```typescript
// src/lib/report-config.ts
export const REPORT_CONFIG = {
  basic: { price: 0, pages: 3, /* ... */ },
  pro: { price: 9900, pages: 10, /* ... */ },
  master: { price: 19900, pages: 20, /* ... */ },
};

export const USER_ROLES = { /* ... */ };
export const MEMBERSHIP_TIERS = { /* ... */ };
```

---

## 📋 修改清单

| 文件 | 操作 | 优先级 | 状态 |
|------|------|--------|------|
| auth.ts | 改用 lib/prisma + lib/logger | P0 | ✅ 已完成 |
| dual-test.ts | 改用 lib/prisma | P0 | ✅ 已完成 |
| growth.ts | 改用 lib/prisma | P0 | ✅ 已完成 |
| memberships.ts | 改用 lib/prisma | P0 | ✅ 已完成 |
| payments.ts | 改用 lib/prisma | P0 | ✅ 已完成 |
| reports.ts | 改用 lib/prisma + lib/logger | P0 | ✅ 已完成 |
| share.ts | 改用 lib/prisma | P0 | ✅ 已完成 |
| src/types/reports.ts | 新建，提取接口 | P1 | 待处理 |
| src/lib/report-config.ts | 新建，提取配置 | P1 | 待处理 |

### 重构成果

✅ **已完成**: 7 个 PrismaClient 实例 → 1 个共享单例
✅ **已完成**: 2 个 Winston Logger 实例 → 1 个共享单例
⏳ **待处理**: 类型定义提取、配置常量提取

**减少代码重复**: ~50 行
**节省资源**: 7 个数据库连接池 → 1 个