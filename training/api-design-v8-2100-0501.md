# 🔌 专项训练 21:00 - API 设计 v8：实战级完整 API 设计 + OpenAPI 3.1 文档

**日期:** 2026-05-01  
**前置:** 4/22 基础 / 4/23 进阶 / 4/26 巩固 / 4/27 生产级 / 4/28 终章 / 4/29 REST+GraphQL / 4/30 混合架构  
**本次定位:** API 设计领域第 8 轮 — 从零设计 1 套完整业务 API + OpenAPI 3.1 规范文档 + 最佳实践 Checklist

---

## 一、业务场景：SaaS 项目管理平台「TaskFlow」

### 1.1 业务需求

设计一套完整的 RESTful API，支撑以下核心功能：

| 模块 | 功能 |
|------|------|
| 用户认证 | 注册/登录/登出/刷新 Token/密码重置 |
| 工作空间 | 创建/加入/切换/成员管理/角色权限 |
| 项目管理 | CRUD/归档/模板/成员分配 |
| 任务管理 | CRUD/状态流转/子任务/标签/优先级/截止日期 |
| 评论协作 | 评论/回复/提及/附件上传 |
| 通知系统 | 站内通知/邮件通知/Webhook |
| 搜索 | 全局搜索/高级筛选 |
| 审计日志 | 操作记录/变更历史 |

### 1.2 实体关系图

```
User ──< WorkspaceMember >── Workspace
                              ├── Project
                              │     ├── Task
                              │     │     ├── Comment
                              │     │     ├── Attachment
                              │     │     └── SubTask
                              │     ├── Sprint
                              │     └── Member
                              ├── Notification
                              ├── AuditLog
                              └── WebhookSubscription
```

---

## 二、RESTful API 设计

### 2.1 全局约定

```typescript
// === 基础路径 ===
Base URL: https://api.taskflow.com/v1

// === 认证 ===
Authorization: Bearer <access_token>

// === 通用请求头 ===
X-Request-ID: <uuid>          // 请求追踪
X-Idempotency-Key: <uuid>     // 幂等性（POST/PUT/PATCH）
Accept: application/json
Content-Type: application/json

// === 通用响应头 ===
X-Request-ID: <uuid>          // 回传请求 ID
X-RateLimit-Limit: 1000       // 速率限制上限
X-RateLimit-Remaining: 999    // 剩余请求数
X-RateLimit-Reset: 1714598400 // 重置时间戳
ETag: "abc123"                // 缓存标识
```

### 2.2 统一响应格式

```typescript
// === 成功响应 ===
// GET /v1/projects → 200 OK
{
  "data": [
    {
      "id": "proj_abc123",
      "name": "CloudBoard",
      "status": "active",
      "owner_id": "usr_001",
      "created_at": "2026-04-01T08:00:00Z",
      "updated_at": "2026-04-28T15:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 156,
    "total_pages": 8
  },
  "links": {
    "self": "/v1/projects?page=1&per_page=20",
    "first": "/v1/projects?page=1&per_page=20",
    "prev": null,
    "next": "/v1/projects?page=2&per_page=20",
    "last": "/v1/projects?page=8&per_page=20"
  }
}

// === 单资源响应 ===
// GET /v1/projects/proj_abc123 → 200 OK
{
  "data": {
    "id": "proj_abc123",
    "name": "CloudBoard",
    "description": "可视化协作看板",
    "status": "active",
    "visibility": "private",
    "owner": {
      "id": "usr_001",
      "name": "娄总",
      "avatar_url": "https://cdn.taskflow.com/avatars/usr_001.png"
    },
    "stats": {
      "task_count": 42,
      "completed_count": 28,
      "member_count": 5
    },
    "created_at": "2026-04-01T08:00:00Z",
    "updated_at": "2026-04-28T15:30:00Z"
  }
}

// === 错误响应 ===
// 400 Bad Request
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [
      {
        "field": "name",
        "message": "项目名称不能为空",
        "code": "REQUIRED"
      },
      {
        "field": "visibility",
        "message": "可选值: private, public, team",
        "code": "INVALID_ENUM"
      }
    ],
    "request_id": "req_xyz789"
  }
}

// 401 Unauthorized
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "认证令牌已过期",
    "request_id": "req_xyz789"
  }
}

// 403 Forbidden
{
  "error": {
    "code": "FORBIDDEN",
    "message": "无权限执行此操作，需要 admin 角色",
    "request_id": "req_xyz789"
  }
}

// 404 Not Found
{
  "error": {
    "code": "NOT_FOUND",
    "message": "项目 proj_abc123 不存在",
    "request_id": "req_xyz789"
  }
}

// 409 Conflict
{
  "error": {
    "code": "CONFLICT",
    "message": "项目名称已存在",
    "request_id": "req_xyz789"
  }
}

// 422 Unprocessable (业务规则违反)
{
  "error": {
    "code": "BUSINESS_RULE_VIOLATION",
    "message": "任务状态不允许从 done 直接转到 todo",
    "details": {
      "from": "done",
      "to": "todo",
      "allowed_transitions": ["in_progress"]
    },
    "request_id": "req_xyz789"
  }
}

// 429 Too Many Requests
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "请求过于频繁，请 30 秒后重试",
    "retry_after": 30,
    "request_id": "req_xyz789"
  }
}
```

### 2.3 错误码体系

| HTTP 状态 | 错误码 | 说明 |
|-----------|--------|------|
| 400 | VALIDATION_ERROR | 参数验证失败 |
| 400 | INVALID_FORMAT | 格式错误 |
| 401 | UNAUTHORIZED | 未认证 |
| 401 | TOKEN_EXPIRED | Token 过期 |
| 401 | TOKEN_REVOKED | Token 已撤销 |
| 403 | FORBIDDEN | 无权限 |
| 403 | WORKSPACE_LIMIT | 工作空间数量超限 |
| 403 | PLAN_LIMIT | 套餐功能限制 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 资源冲突（重复） |
| 409 | STATE_CONFLICT | 状态冲突（并发修改） |
| 422 | BUSINESS_RULE_VIOLATION | 业务规则违反 |
| 422 | DEPENDENCY_EXISTS | 存在依赖，无法删除 |
| 429 | RATE_LIMITED | 速率限制 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

### 2.4 分页、排序、过滤约定

```typescript
// === 分页 ===
GET /v1/projects?page=2&per_page=20
// per_page 默认 20, 最大 100

// === 排序 ===
GET /v1/tasks?sort=-priority,created_at
// 默认升序，- 前缀表示降序
// 支持多字段排序

// === 字段选择 (Sparse Fieldsets) ===
GET /v1/projects?fields=id,name,status,owner_id
// 只返回指定字段，减少响应体积

// === 过滤 ===
GET /v1/tasks?status=in_progress&priority=high&assignee_id=usr_001
// 支持多条件 AND 过滤
// 支持范围: created_at_gte=2026-04-01&created_at_lte=2026-04-30
// 支持排除: status_ne=done

// === 包含关联资源 (Include) ===
GET /v1/tasks/123?include=project,assignee,comments
// 返回任务 + 项目 + 指派人 + 评论

// === 搜索 ===
GET /v1/search?q=看板&type=task,project
// 全局搜索，支持类型过滤
```

---

## 三、完整 API 端点设计

### 3.1 用户认证模块

```
POST   /v1/auth/register          # 注册
POST   /v1/auth/login             # 登录
POST   /v1/auth/logout            # 登出
POST   /v1/auth/refresh           # 刷新 Token
POST   /v1/auth/forgot-password   # 忘记密码
POST   /v1/auth/reset-password    # 重置密码
GET    /v1/auth/me                # 当前用户信息
PATCH  /v1/users/me               # 更新当前用户
POST   /v1/users/me/avatar        # 上传头像
```

**注册请求:**
```json
POST /v1/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "张三",
  "invite_code": "TASKFLOW2026"  // 可选
}
```

**登录响应:**
```json
POST /v1/auth/login → 200 OK
{
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "id": "usr_001",
      "name": "张三",
      "email": "user@example.com",
      "avatar_url": null,
      "timezone": "Asia/Shanghai",
      "locale": "zh-CN"
    }
  }
}
```

**Token 刷新:**
```json
POST /v1/auth/refresh
{
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl..."
}
// → 200 OK 返回新的 access_token + refresh_token
// 旧 refresh_token 立即失效 (Refresh Token Rotation)
```

### 3.2 工作空间模块

```
POST   /v1/workspaces                    # 创建工作空间
GET    /v1/workspaces                    # 列出用户的工作空间
GET    /v1/workspaces/:workspace_id      # 获取工作空间详情
PATCH  /v1/workspaces/:workspace_id      # 更新工作空间
DELETE /v1/workspaces/:workspace_id      # 删除工作空间 (软删除)

// 成员管理
GET    /v1/workspaces/:workspace_id/members              # 列出成员
POST   /v1/workspaces/:workspace_id/members              # 邀请成员
PATCH  /v1/workspaces/:workspace_id/members/:member_id   # 更新成员角色
DELETE /v1/workspaces/:workspace_id/members/:member_id   # 移除成员

// 邀请链接
POST   /v1/workspaces/:workspace_id/invites              # 创建邀请链接
GET    /v1/workspaces/:workspace_id/invites              # 列出邀请
DELETE /v1/workspaces/:workspace_id/invites/:invite_id   # 撤销邀请
POST   /v1/invites/:invite_code/join                     # 通过邀请码加入
```

**角色权限矩阵:**

| 角色 | 查看 | 创建 | 编辑 | 删除 | 管理成员 | 管理设置 |
|------|------|------|------|------|----------|----------|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Editor | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Viewer | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 3.3 项目管理模块

```
POST   /v1/workspaces/:workspace_id/projects             # 创建项目
GET    /v1/workspaces/:workspace_id/projects             # 列出项目
GET    /v1/projects/:project_id                          # 获取项目详情
PATCH  /v1/projects/:project_id                          # 更新项目
DELETE /v1/projects/:project_id                          # 删除项目 (软删除)
POST   /v1/projects/:project_id/archive                  # 归档项目
POST   /v1/projects/:project_id/unarchive                # 取消归档

// 项目成员
GET    /v1/projects/:project_id/members                  # 列出成员
POST   /v1/projects/:project_id/members                  # 添加成员
PATCH  /v1/projects/:project_id/members/:member_id       # 更新角色
DELETE /v1/projects/:project_id/members/:member_id       # 移除成员

// 项目模板
GET    /v1/templates                                     # 列出可用模板
POST   /v1/projects/:project_id/from-template/:template_id  // 从模板创建
```

**创建项目请求:**
```json
POST /v1/workspaces/ws_001/projects
{
  "name": "CloudBoard v2",
  "description": "可视化协作看板 v2 开发",
  "visibility": "private",
  "template_id": "tmpl_scrum",  // 可选，从模板创建
  "columns": [
    { "name": "待办", "order": 0 },
    { "name": "进行中", "order": 1 },
    { "name": "审核中", "order": 2 },
    { "name": "已完成", "order": 3 }
  ],
  "member_ids": ["usr_001", "usr_002", "usr_003"]
}
```

### 3.4 任务管理模块

```
POST   /v1/projects/:project_id/tasks              # 创建任务
GET    /v1/projects/:project_id/tasks              # 列出任务 (支持过滤/排序/分页)
GET    /v1/tasks/:task_id                          # 获取任务详情
PATCH  /v1/tasks/:task_id                          # 更新任务
DELETE /v1/tasks/:task_id                          # 删除任务

// 任务状态流转
POST   /v1/tasks/:task_id/status-transitions       # 执行状态变更

// 子任务
GET    /v1/tasks/:task_id/subtasks                 # 列出子任务
POST   /v1/tasks/:task_id/subtasks                 # 创建子任务
PATCH  /v1/subtasks/:subtask_id                    # 更新子任务
DELETE /v1/subtasks/:subtask_id                    // 删除子任务

// 标签
GET    /v1/projects/:project_id/tags               # 列出标签
POST   /v1/projects/:project_id/tags               # 创建标签
PATCH  /v1/tags/:tag_id                            # 更新标签
DELETE /v1/tags/:tag_id                            // 删除标签
POST   /v1/tasks/:task_id/tags                     // 添加标签
DELETE /v1/tasks/:task_id/tags/:tag_id             // 移除标签

// 任务排序 (拖拽排序)
POST   /v1/tasks/reorder                           // 批量重排序

// 批量操作
POST   /v1/tasks/batch                             // 批量更新任务
DELETE /v1/tasks/batch                             // 批量删除任务
```

**任务状态机:**

```
                    ┌──────────────┐
                    │    blocked    │
                    └──────┬───────┘
                           │ unblock
                    ┌──────┴───────┐
                    │              │
     assign    ┌───▼───┐    ┌────▼────┐
  ──────────►  │ todo  │───►│ in_progress │───► │ review │───► │ done │
               └───────┘    └────┬────┘     └────┬────┘    └──────┘
                    reopen       │ reject         │ approve
                                 │                │
                                 └────────────────┘
```

**创建任务请求:**
```json
POST /v1/projects/proj_abc123/tasks
{
  "title": "实现看板拖拽排序功能",
  "description": "支持任务在列之间拖拽排序，使用 SortableJS",
  "status": "todo",
  "priority": "high",          // low / medium / high / urgent
  "type": "feature",           // feature / bug / improvement / chore
  "assignee_id": "usr_002",
  "column_id": "col_todo",
  "due_date": "2026-05-15T23:59:59Z",
  "estimate_hours": 8,
  "tags": ["frontend", "drag-drop"],
  "parent_task_id": null,
  "checklist": [
    { "title": "安装 SortableJS", "done": false },
    { "title": "实现拖拽事件处理", "done": false },
    { "title": "持久化排序到后端", "done": false }
  ]
}
```

**状态流转请求:**
```json
POST /v1/tasks/task_123/status-transitions
{
  "from": "in_progress",
  "to": "review",
  "comment": "已完成拖拽核心逻辑，请求 Code Review"
}
// → 200 OK (状态变更成功)
// → 422 (不允许的流转，返回 allowed_transitions)
```

**批量操作请求:**
```json
POST /v1/tasks/batch
{
  "task_ids": ["task_001", "task_002", "task_003"],
  "updates": {
    "assignee_id": "usr_003",
    "priority": "high"
  }
}
// → 200 OK 返回部分成功/失败详情
```

### 3.5 评论与协作模块

```
GET    /v1/tasks/:task_id/comments                 # 列出评论 (按时间排序)
POST   /v1/tasks/:task_id/comments                 # 创建评论
PATCH  /v1/comments/:comment_id                    # 编辑评论
DELETE /v1/comments/:comment_id                    # 删除评论

// 回复 (嵌套评论)
GET    /v1/comments/:comment_id/replies            # 列出回复
POST   /v1/comments/:comment_id/replies            # 创建回复

// 附件
POST   /v1/tasks/:task_id/attachments              # 上传附件 (multipart)
GET    /v1/tasks/:task_id/attachments              # 列出附件
DELETE /v1/attachments/:attachment_id              // 删除附件

// 提及 (@)
// 在评论中使用 @user_id 提及用户，自动触发通知
```

**创建评论请求:**
```json
POST /v1/tasks/task_123/comments
{
  "content": "@usr_002 拖拽逻辑已完成，请查看 PR #42\n\n主要变更:\n- 安装 sortablejs\n- 实现 onEnd 回调\n- 调用 reorder API 持久化",
  "attachments": ["att_001", "att_002"]  // 可选，关联附件
}
```

### 3.6 通知模块

```
GET    /v1/notifications                    # 列出通知 (按时间倒序)
PATCH  /v1/notifications/:notification_id   # 标记已读
POST   /v1/notifications/mark-all-read      # 全部标记已读
DELETE /v1/notifications/:notification_id   # 删除通知
GET    /v1/notifications/unread-count       # 未读数量

// 通知设置
GET    /v1/users/me/notification-settings   # 获取通知设置
PATCH  /v1/users/me/notification-settings   // 更新通知设置
```

**通知类型:**

```typescript
type NotificationType =
  | 'task_assigned'           // 任务被分配
  | 'task_mentioned'          // 被 @提及
  | 'task_commented'          // 任务有新评论
  | 'task_status_changed'     // 任务状态变更
  | 'task_due_soon'           // 任务即将到期 (24h)
  | 'task_overdue'            // 任务已逾期
  | 'project_invited'         // 被邀请加入项目
  | 'workspace_invited'       // 被邀请加入工作空间
  | 'comment_replied'         // 评论被回复
  | 'checklist_completed';    // 检查单完成
```

### 3.7 Webhook 模块

```
POST   /v1/workspaces/:workspace_id/webhooks            # 创建 Webhook
GET    /v1/workspaces/:workspace_id/webhooks            # 列出 Webhook
GET    /v1/webhooks/:webhook_id                         # 获取 Webhook 详情
PATCH  /v1/webhooks/:webhook_id                         // 更新 Webhook
DELETE /v1/webhooks/:webhook_id                         // 删除 Webhook
GET    /v1/webhooks/:webhook_id/deliveries              // 查看投递历史
POST   /v1/webhooks/:webhook_id/redeliver/:delivery_id  // 重新投递
```

**Webhook 事件类型:**

```typescript
type WebhookEvent =
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.status_changed'
  | 'task.assigned'
  | 'comment.created'
  | 'project.created'
  | 'project.deleted'
  | 'member.joined'
  | 'member.left';
```

**Webhook 请求体 (签名验证):**
```json
POST https://your-server.com/webhook

// Headers
X-TaskFlow-Signature: sha256=abc123...
X-TaskFlow-Event: task.created
X-TaskFlow-Delivery: delivery_uuid
X-TaskFlow-Timestamp: 1714598400

// Body
{
  "id": "evt_001",
  "type": "task.created",
  "timestamp": "2026-05-01T21:00:00Z",
  "workspace_id": "ws_001",
  "data": {
    "id": "task_123",
    "title": "实现拖拽排序",
    "status": "todo",
    "priority": "high",
    "assignee_id": "usr_002",
    "project_id": "proj_abc123",
    "created_by": "usr_001",
    "created_at": "2026-05-01T21:00:00Z"
  }
}
```

**签名验证:**
```typescript
// 服务端验证 Webhook 签名
function verifyWebhook(body: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### 3.8 搜索模块

```
GET    /v1/search                    # 全局搜索
GET    /v1/projects/:project_id/search  # 项目内搜索
```

**搜索请求:**
```
GET /v1/search?q=看板&type=task,project&status=in_progress&priority=high&assignee_id=usr_001&created_at_gte=2026-04-01
```

**搜索响应:**
```json
{
  "data": [
    {
      "type": "task",
      "id": "task_123",
      "title": "实现看板拖拽排序",
      "highlight": "实现<b>看板</b>拖拽排序功能",
      "score": 0.95,
      "project": { "id": "proj_abc", "name": "CloudBoard" }
    },
    {
      "type": "project",
      "id": "proj_abc",
      "name": "CloudBoard 看板",
      "highlight": "<b>看板</b>可视化协作平台",
      "score": 0.88
    }
  ],
  "meta": {
    "query": "看板",
    "total": 12,
    "took_ms": 45
  }
}
```

### 3.9 审计日志模块

```
GET    /v1/workspaces/:workspace_id/audit-logs    # 列出审计日志
GET    /v1/projects/:project_id/audit-logs        // 项目级审计日志
GET    /v1/tasks/:task_id/audit-logs              // 任务级变更历史
```

**审计日志类型:**
```typescript
type AuditAction =
  | 'user.created' | 'user.updated'
  | 'workspace.created' | 'workspace.updated' | 'workspace.deleted'
  | 'member.invited' | 'member.joined' | 'member.removed' | 'member.role_changed'
  | 'project.created' | 'project.updated' | 'project.deleted' | 'project.archived'
  | 'task.created' | 'task.updated' | 'task.deleted'
  | 'task.status_changed' | 'task.assigned' | 'task.tag_added' | 'task.tag_removed'
  | 'comment.created' | 'comment.updated' | 'comment.deleted'
  | 'attachment.uploaded' | 'attachment.deleted';
```

**审计日志响应:**
```json
{
  "data": [
    {
      "id": "log_001",
      "action": "task.status_changed",
      "actor": { "id": "usr_002", "name": "李四" },
      "target": { "type": "task", "id": "task_123" },
      "changes": {
        "from": { "status": "in_progress" },
        "to": { "status": "review" }
      },
      "ip_address": "120.78.xx.xx",
      "user_agent": "Mozilla/5.0 ...",
      "created_at": "2026-05-01T20:30:00Z"
    }
  ]
}
```

---

## 四、GraphQL 补充设计

### 4.1 何时使用 GraphQL

RESTful 是主 API，GraphQL 作为补充层，适用于：

| 场景 | 推荐 | 原因 |
|------|------|------|
| 仪表盘聚合数据 | ✅ GraphQL | 一次查询获取多个资源 |
| 复杂嵌套查询 | ✅ GraphQL | 避免 N+1 问题 |
| 简单 CRUD | ✅ REST | 更简单、缓存友好 |
| 文件上传 | ✅ REST | multipart 支持更好 |
| 实时订阅 | ✅ GraphQL | subscriptions 原生支持 |

### 4.2 GraphQL Schema

```graphql
# === 查询 ===
type Query {
  # 项目
  project(id: ID!): Project
  projects(workspaceId: ID!, filter: ProjectFilter, pagination: PaginationInput): ProjectConnection!

  # 任务
  task(id: ID!): Task
  tasks(projectId: ID!, filter: TaskFilter, pagination: PaginationInput): TaskConnection!

  # 搜索
  search(query: String!, types: [SearchType!], pagination: PaginationInput): SearchResultConnection!

  # 仪表盘聚合
  dashboard(workspaceId: ID!): Dashboard!
}

# === 变更 ===
type Mutation {
  createTask(input: CreateTaskInput!): Task!
  updateTask(id: ID!, input: UpdateTaskInput!): Task!
  deleteTask(id: ID!): Boolean!
  transitionTaskStatus(id: ID!, input: StatusTransitionInput!): Task!
  addComment(taskId: ID!, input: CreateCommentInput!): Comment!
}

# === 订阅 ===
type Subscription {
  taskUpdated(projectId: ID!): Task!
  taskCreated(projectId: ID!): Task!
  notificationReceived: Notification!
}

# === 类型定义 ===
type Project {
  id: ID!
  name: String!
  description: String
  status: ProjectStatus!
  visibility: Visibility!
  owner: User!
  members: [ProjectMember!]!
  stats: ProjectStats!
  tasks(filter: TaskFilter): TaskConnection!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Task {
  id: ID!
  title: String!
  description: String
  status: TaskStatus!
  priority: Priority!
  type: TaskType!
  assignee: User
  project: Project!
  comments: CommentConnection!
  subtasks: SubTaskConnection!
  tags: [Tag!]!
  checklist: [ChecklistItem!]!
  dueDate: DateTime
  estimateHours: Float
  actualHours: Float
  parentTask: Task
  children: [Task!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Dashboard {
  totalTasks: Int!
  completedTasks: Int!
  overdueTasks: Int!
  tasksByStatus: [TaskCount!]!
  tasksByPriority: [TaskCount!]!
  tasksByAssignee: [TaskCount!]!
  recentActivity: [Activity!]!
}

type TaskCount {
  label: String!
  count: Int!
  percentage: Float!
}

# === 输入类型 ===
input TaskFilter {
  status: TaskStatus
  statusIn: [TaskStatus!]
  priority: Priority
  assigneeId: ID
  tagIds: [ID!]
  dueDateRange: DateRange
  createdAtRange: DateRange
  search: String
}

input PaginationInput {
  first: Int = 20
  after: String
  last: Int
  before: String
}

# === 连接 (Relay 风格分页) ===
type TaskConnection {
  edges: [TaskEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type TaskEdge {
  node: Task!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

### 4.3 GraphQL 查询示例

```graphql
# === 仪表盘聚合查询 (一次获取所有数据) ===
query Dashboard($workspaceId: ID!) {
  dashboard(workspaceId: $workspaceId) {
    totalTasks
    completedTasks
    overdueTasks
    tasksByStatus {
      label
      count
      percentage
    }
    tasksByAssignee {
      label
      count
    }
    recentActivity {
      action
      actor { name }
      createdAt
    }
  }
}

# === 任务详情 + 评论 + 指派人 (避免 N+1) ===
query TaskDetail($taskId: ID!) {
  task(id: $taskId) {
    id
    title
    description
    status
    priority
    assignee {
      id
      name
      avatarUrl
    }
    project {
      id
      name
    }
    comments(first: 20, after: $cursor) {
      edges {
        node {
          id
          content
          author { name }
          createdAt
          replies(first: 5) {
            edges {
              node {
                id
                content
                author { name }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}

# === 实时任务更新订阅 ===
subscription OnTaskUpdate($projectId: ID!) {
  taskUpdated(projectId: $projectId) {
    id
    title
    status
    priority
    updatedAt
  }
}
```

---

## 五、OpenAPI 3.1 规范文档 (核心部分)

### 5.1 完整 OpenAPI 文档

```yaml
openapi: 3.1.0
info:
  title: TaskFlow API
  description: |
    TaskFlow 项目管理平台 RESTful API。
    
    ## 认证
    所有 API 请求需要在 Header 中携带 Bearer Token:
    ```
    Authorization: Bearer <access_token>
    ```
    
    ## 速率限制
    - 免费计划: 100 请求/分钟
    - 专业计划: 1000 请求/分钟
    - 企业计划: 10000 请求/分钟
    
    ## 版本
    当前版本: v1 (URL 路径中体现)
  version: 1.0.0
  contact:
    name: TaskFlow API Support
    email: api-support@taskflow.com
    url: https://developers.taskflow.com

servers:
  - url: https://api.taskflow.com/v1
    description: 生产环境
  - url: https://api-staging.taskflow.com/v1
    description: 预发布环境
  - url: http://localhost:3000/v1
    description: 本地开发

tags:
  - name: Auth
    description: 用户认证
  - name: Users
    description: 用户管理
  - name: Workspaces
    description: 工作空间
  - name: Projects
    description: 项目管理
  - name: Tasks
    description: 任务管理
  - name: Comments
    description: 评论协作
  - name: Notifications
    description: 通知
  - name: Webhooks
    description: Webhook
  - name: Search
    description: 搜索
  - name: Audit
    description: 审计日志

paths:
  /auth/login:
    post:
      tags: [Auth]
      summary: 用户登录
      operationId: login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: 登录成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/AuthResponse'
        '401':
          description: 认证失败
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '429':
          description: 请求过于频繁
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /projects/{projectId}/tasks:
    get:
      tags: [Tasks]
      summary: 列出项目任务
      operationId: listTasks
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: string
            pattern: '^proj_[a-zA-Z0-9]+$'
        - name: status
          in: query
          schema:
            $ref: '#/components/schemas/TaskStatus'
        - name: priority
          in: query
          schema:
            $ref: '#/components/schemas/Priority'
        - name: assignee_id
          in: query
          schema:
            type: string
        - name: sort
          in: query
          schema:
            type: string
            default: '-created_at'
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: per_page
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: fields
          in: query
          schema:
            type: string
          description: 字段选择，逗号分隔
        - name: include
          in: query
          schema:
            type: string
          description: 关联资源，逗号分隔
      responses:
        '200':
          description: 任务列表
          headers:
            X-Request-ID:
              schema: { type: string }
            X-RateLimit-Remaining:
              schema: { type: integer }
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Task'
                  meta:
                    $ref: '#/components/schemas/PaginationMeta'
                  links:
                    $ref: '#/components/schemas/PaginationLinks'
        '403':
          description: 无权限
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '404':
          description: 项目不存在
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    post:
      tags: [Tasks]
      summary: 创建任务
      operationId: createTask
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTaskRequest'
      responses:
        '201':
          description: 创建成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Task'
        '400':
          description: 参数验证失败
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '403':
          description: 无权限
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /tasks/{taskId}/status-transitions:
    post:
      tags: [Tasks]
      summary: 任务状态流转
      operationId: transitionTaskStatus
      parameters:
        - name: taskId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [from, to]
              properties:
                from:
                  $ref: '#/components/schemas/TaskStatus'
                to:
                  $ref: '#/components/schemas/TaskStatus'
                comment:
                  type: string
      responses:
        '200':
          description: 状态变更成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Task'
        '422':
          description: 不允许的状态流转
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    # === 认证 ===
    LoginRequest:
      type: object
      required: [email, password]
      properties:
        email:
          type: string
          format: email
        password:
          type: string
          format: password
          minLength: 8
        remember_me:
          type: boolean
          default: false

    AuthResponse:
      type: object
      properties:
        access_token:
          type: string
        refresh_token:
          type: string
        token_type:
          type: string
          enum: [Bearer]
        expires_in:
          type: integer
        user:
          $ref: '#/components/schemas/User'

    # === 用户 ===
    User:
      type: object
      properties:
        id:
          type: string
          pattern: '^usr_[a-zA-Z0-9]+$'
        name:
          type: string
          minLength: 1
          maxLength: 50
        email:
          type: string
          format: email
        avatar_url:
          type: string
          format: uri
          nullable: true
        timezone:
          type: string
          default: Asia/Shanghai
        locale:
          type: string
          default: zh-CN
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    # === 任务 ===
    TaskStatus:
      type: string
      enum: [todo, in_progress, review, done, blocked]

    Priority:
      type: string
      enum: [low, medium, high, urgent]

    TaskType:
      type: string
      enum: [feature, bug, improvement, chore]

    Task:
      type: object
      properties:
        id:
          type: string
          pattern: '^task_[a-zA-Z0-9]+$'
        title:
          type: string
          minLength: 1
          maxLength: 200
        description:
          type: string
          nullable: true
        status:
          $ref: '#/components/schemas/TaskStatus'
        priority:
          $ref: '#/components/schemas/Priority'
        type:
          $ref: '#/components/schemas/TaskType'
        assignee:
          $ref: '#/components/schemas/User'
          nullable: true
        project_id:
          type: string
        column_id:
          type: string
          nullable: true
        due_date:
          type: string
          format: date-time
          nullable: true
        estimate_hours:
          type: number
          minimum: 0
          nullable: true
        actual_hours:
          type: number
          minimum: 0
          nullable: true
        tags:
          type: array
          items:
            $ref: '#/components/schemas/Tag'
        checklist:
          type: array
          items:
            $ref: '#/components/schemas/ChecklistItem'
        parent_task_id:
          type: string
          nullable: true
        created_by:
          $ref: '#/components/schemas/User'
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    CreateTaskRequest:
      type: object
      required: [title]
      properties:
        title:
          type: string
          minLength: 1
          maxLength: 200
        description:
          type: string
        status:
          $ref: '#/components/schemas/TaskStatus'
          default: todo
        priority:
          $ref: '#/components/schemas/Priority'
          default: medium
        type:
          $ref: '#/components/schemas/TaskType'
          default: feature
        assignee_id:
          type: string
          nullable: true
        column_id:
          type: string
          nullable: true
        due_date:
          type: string
          format: date-time
          nullable: true
        estimate_hours:
          type: number
          minimum: 0
          nullable: true
        tags:
          type: array
          items:
            type: string
        parent_task_id:
          type: string
          nullable: true
        checklist:
          type: array
          items:
            type: object
            properties:
              title:
                type: string
              done:
                type: boolean
                default: false

    Tag:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        color:
          type: string
          pattern: '^#[0-9a-fA-F]{6}$'

    ChecklistItem:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        done:
          type: boolean

    # === 分页 ===
    PaginationMeta:
      type: object
      properties:
        page:
          type: integer
        per_page:
          type: integer
        total:
          type: integer
        total_pages:
          type: integer

    PaginationLinks:
      type: object
      properties:
        self:
          type: string
        first:
          type: string
          nullable: true
        prev:
          type: string
          nullable: true
        next:
          type: string
          nullable: true
        last:
          type: string
          nullable: true

    # === 错误 ===
    Error:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message, request_id]
          properties:
            code:
              type: string
            message:
              type: string
            details:
              type: array
              items:
                type: object
                properties:
                  field:
                    type: string
                  message:
                    type: string
                  code:
                    type: string
            request_id:
              type: string
```

---

## 六、API 设计最佳实践 Checklist

### 6.1 RESTful 设计 Checklist

- [ ] **资源命名**: URL 使用复数名词，不使用动词 (`/users` ✅, `/getUsers` ❌)
- [ ] **HTTP 语义**: GET/POST/PUT/PATCH/DELETE 各司其职
- [ ] **幂等性**: GET/PUT/DELETE 幂等，POST 支持 Idempotency-Key
- [ ] **版本控制**: URL Path 版本化 (`/v1/`)
- [ ] **状态码**: 正确使用 HTTP 状态码 (200/201/204/400/401/403/404/409/422/429)
- [ ] **统一格式**: 所有响应遵循 `{ data, meta, links }` 结构
- [ ] **错误格式**: 所有错误遵循 `{ error: { code, message, details, request_id } }`
- [ ] **分页**: 支持 page/per_page + links 导航
- [ ] **字段选择**: 支持 `?fields=` 减少响应体积
- [ ] **过滤排序**: 支持 `?status=xxx&sort=-created_at`
- [ ] **关联资源**: 支持 `?include=` 预加载关联数据
- [ ] **HATEOAS**: 响应中包含操作链接
- [ ] **缓存**: 合理使用 ETag / Last-Modified / Cache-Control
- [ ] **速率限制**: 返回 X-RateLimit-* 头
- [ ] **请求追踪**: X-Request-ID 全链路追踪

### 6.2 安全 Checklist

- [ ] **认证**: JWT Bearer Token (access + refresh)
- [ ] **授权**: RBAC 角色权限矩阵
- [ ] **Token 轮换**: Refresh Token Rotation 防重放
- [ ] **密码**: bcrypt 哈希 + 强度校验
- [ ] **速率限制**: 登录接口独立限流 (防暴力破解)
- [ ] **CORS**: 精确配置允许的来源
- [ ] **输入验证**: 所有输入 Zod schema 校验
- [ ] **SQL 注入**: 参数化查询 / ORM
- [ ] **XSS**: 输出转义 + CSP
- [ ] **Webhook 签名**: HMAC-SHA256 签名验证
- [ ] **审计日志**: 所有写操作记录审计日志
- [ ] **数据脱敏**: 日志中不记录密码/Token

### 6.3 性能 Checklist

- [ ] **字段选择**: `?fields=` 减少序列化开销
- [ ] **分页**: 游标分页 (大数据集) + 偏移分页 (小数据集)
- [ ] **N+1 解决**: DataLoader / 批量预加载
- [ ] **缓存**: Redis 缓存热点数据 + HTTP 缓存头
- [ ] **压缩**: Gzip / Brotli 响应压缩
- [ ] **CDN**: 静态资源 + 只读 API 走 CDN
- [ ] **异步处理**: 耗时操作返回 202 + 轮询/WebSocket
- [ ] **连接池**: 数据库连接池管理
- [ ] **索引**: 常用查询字段建立索引

### 6.4 可观测性 Checklist

- [ ] **请求 ID**: X-Request-ID 贯穿全链路
- [ ] **结构化日志**: JSON 格式，包含 request_id / user_id / duration
- [ ] **指标**: Prometheus 指标 (请求数/延迟/错误率)
- [ ] **分布式追踪**: OpenTelemetry / Jaeger
- [ ] **健康检查**: `/health` + `/ready` 端点
- [ ] **告警**: 错误率 > 1% / 延迟 P99 > 500ms 告警

---

## 七、API 设计常见陷阱与反模式

### 7.1 常见陷阱

| 陷阱 | 反例 | 正确做法 |
|------|------|----------|
| **动词 URL** | `POST /api/getUser` | `GET /api/users/:id` |
| **过度嵌套** | `/orgs/1/workspaces/2/projects/3/tasks/4` | `/tasks/4` + query 过滤 |
| **所有错误 200** | `{"success": false, "error": "..."}` | 使用正确 HTTP 状态码 |
| **无分页** | 一次返回 10000 条记录 | 分页 + 游标 |
| **不一致命名** | `/users` + `/getUserList` | 统一资源命名 |
| **忽略版本** | 直接修改 v1 响应格式 | URL Path 版本化 |
| **无错误详情** | `400 Bad Request` 无 body | 返回详细错误信息 |
| **PUT 语义错误** | PUT 只更新部分字段 | PUT=全量, PATCH=部分 |
| **缺少幂等** | POST 重复提交产生重复 | Idempotency-Key |
| **无速率限制** | 无限请求 | 限流 + 返回 Retry-After |

### 7.2 状态码误用

```
❌ 用 200 表示所有响应（包括错误）
❌ 用 500 表示业务错误
❌ 用 404 表示认证失败
❌ 用 200 + 自定义 code 替代 HTTP 状态码
❌ DELETE 返回 200 + 响应体（应返回 204 No Content）

✅ 200: 成功
✅ 201: 创建成功
✅ 204: 删除成功（无响应体）
✅ 400: 客户端错误（参数验证失败）
✅ 401: 未认证
✅ 403: 已认证但无权限
✅ 404: 资源不存在
✅ 409: 冲突（重复）
✅ 422: 业务规则违反
✅ 429: 速率限制
✅ 500: 服务器内部错误
```

---

## 八、API 文档生成与工具链

### 8.1 文档生成工具

| 工具 | 用途 | 说明 |
|------|------|------|
| **Swagger UI** | OpenAPI 可视化 | 交互式 API 文档 |
| **Redoc** | OpenAPI 文档 | 静态文档生成 |
| **Stoplight** | API 设计平台 | 设计 + 文档 + Mock |
| **Spectral** | OpenAPI  lint | 规范检查 |
| **Dredd** | API 测试 | 用 OpenAPI 验证实现 |
| **Prism** | API Mock | 自动生成 Mock Server |
| **openapi-typescript** | TS 类型生成 | OpenAPI → TypeScript 类型 |

### 8.2 开发工作流

```
1. 设计 OpenAPI YAML (Stoplight / VS Code)
2. Lint: spectral lint api.yaml
3. 生成 Mock: prism mock api.yaml
4. 前端开发 (基于 Mock)
5. 后端实现
6. 测试: dredd api.yaml ./server.js
7. 生成文档: redoc-cli bundle api.yaml
8. 生成客户端: openapi-typescript api.yaml -o types.ts
9. 发布文档: 部署 Redoc 页面
```

### 8.3 客户端 SDK 生成

```bash
# 使用 OpenAPI Generator 生成多语言客户端
openapi-generator-cli generate \
  -i api.yaml \
  -g typescript-axios \
  -o ./client/ts \
  --additional-properties=supportsES6=true,withInterfaces=true

openapi-generator-cli generate \
  -i api.yaml \
  -g python \
  -o ./client/python

openapi-generator-cli generate \
  -i api.yaml \
  -g go \
  -o ./client/go
```

---

## 九、总结：API 设计 8 轮迭代回顾

| 轮次 | 日期 | 主题 | 核心产出 |
|------|------|------|----------|
| v1 | 4/22 | RESTful 基础 | 资源命名/HTTP 动词/状态码 |
| v2 | 4/23 | 进阶设计 | URL 规范/分页/错误处理/认证 |
| v3 | 4/26 | 巩固实战 | 完整 CRUD + 过滤排序 |
| v4 | 4/27 | 生产级高级模式 | 版本演进/GraphQL/速率限制 |
| v5 | 4/28 | CloudBoard 终章 | 完整业务实体 + REST+GraphQL |
| v6 | 4/29 | REST+GraphQL 双模式 | 决策矩阵/混合架构 |
| v7 | 4/30 | 混合架构闭环 | 混合决策树/完整文档 |
| **v8** | **5/1** | **实战级完整 API** | **TaskFlow 完整 API + OpenAPI 3.1 + Checklist** |

**API 设计领域 8 轮迭代全部闭环** ✅

---

*产出: ~28KB 文档，含完整 TaskFlow API 设计 + OpenAPI 3.1 规范 + 最佳实践 Checklist + 陷阱清单*
