# 🔌 专项训练 21:00 - API 设计终极实战 (CloudBoard 项目协作 API)

**日期:** 2026-04-28  
**前置:** 4/22 基础版 / 4/23 进阶版 / 4/26 巩固版 / 4/27 生产级高级模式  
**本次重点:** 完整业务 API 设计 + REST + GraphQL 双模式 + OpenAPI 3.0 文档 + 生产级最佳实践

---

## 一、业务背景：CloudBoard 项目协作平台

### 1.1 核心业务实体

```
┌─────────────────────────────────────────────────────────┐
│                    CloudBoard 平台                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Organization (组织)                                     │
│  ├── Workspace (工作空间)                                │
│  │   ├── Project (项目)                                  │
│  │   │   ├── Task (任务)                                 │
│  │   │   │   ├── Comment (评论)                          │
│  │   │   │   ├── Attachment (附件)                       │
│  │   │   │   └── SubTask (子任务)                        │
│  │   │   ├── Sprint (迭代)                               │
│  │   │   ├── Board (看板)                                │
│  │   │   │   └── Column (列)                             │
│  │   │   └── Member (成员)                               │
│  │   └── Notification (通知)                             │
│  └── User (用户)                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 1.2 技术选型决策

| 接口类型 | 选择 | 理由 |
|---------|------|------|
| 公开 API | RESTful | 第三方集成、Webhook、标准 CRUD |
| 前端 API | GraphQL | 复杂数据组合、减少请求数、移动端友好 |
| 实时通信 | WebSocket | 协作编辑、通知推送 |
| 内部服务 | gRPC | 微服务间高性能通信 |

**架构:** REST (公开/第三方) + GraphQL (前端) + WebSocket (实时) 三层架构

---

## 二、RESTful API 设计 — 完整 API 规范

### 2.1 全局约定

```typescript
// ===== 基础约定 =====
// Base URL: https://api.cloudboard.com/v1
// 认证: Bearer JWT Token
// 格式: JSON
// 编码: UTF-8
// 分页: Cursor-based (游标分页)

// ===== 统一请求头 =====
interface CommonHeaders {
  'Authorization': 'Bearer <jwt_token>';
  'Content-Type': 'application/json';
  'X-Request-Id': string;      // 请求追踪 ID
  'X-Idempotency-Key'?: string; // 幂等键 (POST/PATCH)
  'If-Match'?: string;          // ETag 乐观锁
}

// ===== 统一响应格式 =====
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

interface ApiError {
  code: string;          // 机器可读错误码: "VALIDATION_ERROR"
  message: string;       // 人类可读消息: "用户名不能为空"
  details?: FieldError[]; // 字段级错误详情
  trace_id: string;      // 追踪 ID，用于排查
}

interface FieldError {
  field: string;
  message: string;
  code: string;
}

interface ResponseMeta {
  request_id: string;
  timestamp: string;     // ISO 8601
  pagination?: PaginationMeta;
  rate_limit?: RateLimitMeta;
}

interface PaginationMeta {
  next_cursor?: string;
  prev_cursor?: string;
  has_more: boolean;
  total_count?: number;
  page_size: number;
}

interface RateLimitMeta {
  limit: number;         // 每分钟最大请求数
  remaining: number;     // 剩余请求数
  reset_at: string;      // 重置时间
}
```

### 2.2 认证 API

```typescript
// ===== POST /auth/register — 用户注册 =====
// 请求体
interface RegisterRequest {
  email: string;         // 邮箱，唯一
  password: string;      // 密码，最少 8 位，含大小写+数字
  name: string;          // 显示名称，2-30 字符
  avatar_url?: string;   // 头像 URL (可选)
}

// 响应 201
interface RegisterResponse {
  user: {
    id: string;          // ulid 格式: 01HXXXXX...
    email: string;
    name: string;
    avatar_url: string | null;
    created_at: string;
  };
  tokens: {
    access_token: string;  // JWT, 15 分钟有效期
    refresh_token: string; // 随机字符串, 7 天有效期
    token_type: 'Bearer';
    expires_in: number;    // 秒数
  };
}

// ===== POST /auth/login — 用户登录 =====
interface LoginRequest {
  email: string;
  password: string;
  device_name?: string;  // 设备名称，用于多设备管理
}

// 响应 200
interface LoginResponse {
  user: UserInfo;
  tokens: TokenPair;
}

// ===== POST /auth/refresh — 刷新 Token =====
interface RefreshRequest {
  refresh_token: string;
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;  // 轮换机制，旧 refresh_token 失效
  expires_in: number;
}

// ===== POST /auth/logout — 登出 =====
// 请求体: { refresh_token: string }
// 响应 204 — 无内容，服务端撤销 refresh_token

// ===== POST /auth/forgot-password — 忘记密码 =====
interface ForgotPasswordRequest {
  email: string;
}
// 响应 200 — 无论邮箱是否存在都返回成功 (防枚举)

// ===== POST /auth/reset-password — 重置密码 =====
interface ResetPasswordRequest {
  token: string;         // 邮件中的重置 token
  password: string;
}

// ===== GET /auth/me — 获取当前用户信息 =====
// 响应 200
interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    email_verified: boolean;
    timezone: string;
    language: string;
    two_factor_enabled: boolean;
    created_at: string;
    last_login_at: string | null;
  };
}

// ===== PUT /auth/me — 更新当前用户信息 =====
interface UpdateMeRequest {
  name?: string;
  avatar_url?: string;
  timezone?: string;     // "Asia/Shanghai"
  language?: string;     // "zh-CN"
}
```

### 2.3 组织 API

```typescript
// ===== GET /organizations — 获取用户所属组织列表 =====
// Query: ?include_pending=true
// 响应 200
interface ListOrganizationsResponse {
  data: OrganizationSummary[];
  meta: ResponseMeta;
}

interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;          // URL 友好标识: "acme-corp"
  avatar_url: string | null;
  role: 'owner' | 'admin' | 'member';
  member_count: number;
  created_at: string;
}

// ===== POST /organizations — 创建组织 =====
interface CreateOrganizationRequest {
  name: string;          // 组织名称，3-50 字符
  slug?: string;         // URL 标识 (可选，自动生成)
  description?: string;  // 组织描述
}

// 响应 201
interface CreateOrganizationResponse {
  organization: Organization;
}

// ===== GET /organizations/:id — 获取组织详情 =====
// 响应 200
interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  plan: 'free' | 'pro' | 'enterprise';
  settings: {
    default_workspace_role: 'viewer' | 'editor' | 'admin';
    allow_member_create_project: boolean;
    allowed_email_domains: string[];  // 企业版：限制注册邮箱域名
  };
  stats: {
    member_count: number;
    workspace_count: number;
    project_count: number;
  };
  created_at: string;
  updated_at: string;
}

// ===== PATCH /organizations/:id — 更新组织 =====
interface UpdateOrganizationRequest {
  name?: string;
  description?: string;
  avatar_url?: string;
  settings?: Partial<Organization['settings']>;
}

// ===== DELETE /organizations/:id — 删除组织 =====
// 请求体: { confirmation: "DELETE" }  // 需要二次确认
// 响应 204

// ===== GET /organizations/:id/members — 获取成员列表 =====
// Query: ?role=admin&search=keyword&cursor=xxx&limit=20
// 响应 200
interface ListMembersResponse {
  data: OrganizationMember[];
  meta: ResponseMeta;
}

interface OrganizationMember {
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
  };
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  last_active_at: string | null;
}

// ===== POST /organizations/:id/members — 邀请成员 =====
interface InviteMemberRequest {
  email: string;
  role: 'admin' | 'member';  // owner 只能由创建者担任
  workspace_roles?: {         // 可选：指定工作空间角色
    workspace_id: string;
    role: 'viewer' | 'editor' | 'admin';
  }[];
}
// 响应 201 — 发送邀请邮件，被邀请人点击链接后加入

// ===== PATCH /organizations/:id/members/:user_id — 更新成员角色 =====
interface UpdateMemberRoleRequest {
  role: 'admin' | 'member';
}

// ===== DELETE /organizations/:id/members/:user_id — 移除成员 =====
// 响应 204
```

### 2.4 工作空间 API

```typescript
// ===== GET /organizations/:org_id/workspaces — 获取工作空间列表 =====
// 响应 200
interface ListWorkspacesResponse {
  data: Workspace[];
  meta: ResponseMeta;
}

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;        // emoji 或图标
  color: string;              // 主题色: "#4F46E5"
  organization_id: string;
  project_count: number;
  member_count: number;
  role: 'admin' | 'editor' | 'viewer';  // 当前用户角色
  created_at: string;
  updated_at: string;
}

// ===== POST /organizations/:org_id/workspaces — 创建工作空间 =====
interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

// ===== GET /workspaces/:ws_id — 获取工作空间详情 =====
// ===== PATCH /workspaces/:ws_id — 更新工作空间 =====
// ===== DELETE /workspaces/:ws_id — 删除工作空间 =====

// ===== GET /workspaces/:ws_id/projects — 获取项目列表 =====
// Query: ?archived=false&search=keyword&sort=updated_at&order=desc
// 响应 200
interface ListProjectsResponse {
  data: ProjectSummary[];
  meta: ResponseMeta;
}

interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  workspace_id: string;
  visibility: 'public' | 'private';  // public = 组织内可见
  archived: boolean;
  task_count: { total: number; done: number; overdue: number };
  lead_id: string | null;
  members: { id: string; name: string; avatar_url: string | null }[];
  updated_at: string;
}
```

### 2.5 项目 API

```typescript
// ===== POST /workspaces/:ws_id/projects — 创建项目 =====
interface CreateProjectRequest {
  name: string;
  description?: string;
  icon?: string;
  visibility?: 'public' | 'private';
  lead_id?: string;           // 项目负责人
  member_ids?: string[];      // 初始成员
  template?: string;          // 模板: "scrum" | "kanban" | "simple"
}

// ===== GET /projects/:project_id — 获取项目详情 =====
interface Project {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  workspace_id: string;
  visibility: 'public' | 'private';
  archived: boolean;
  lead: UserRef | null;
  members: UserRef[];
  settings: {
    default_view: 'board' | 'list' | 'timeline' | 'calendar';
    sprints_enabled: boolean;
    issue_types: IssueType[];
    workflow: WorkflowState[];
  };
  stats: {
    task_count: number;
    done_count: number;
    overdue_count: number;
    completion_rate: number;  // 0-100
  };
  created_at: string;
  updated_at: string;
}

interface UserRef {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface IssueType {
  id: string;
  name: string;
  color: string;
  icon: string;
  description?: string;
}

interface WorkflowState {
  id: string;
  name: string;
  color: string;
  type: 'todo' | 'doing' | 'done';
  order: number;
}

// ===== PATCH /projects/:project_id — 更新项目 =====
// ===== DELETE /projects/:project_id — 删除项目 =====
// 请求体: { confirmation: "DELETE" }
```

### 2.6 任务 API (核心)

```typescript
// ===== GET /projects/:project_id/tasks — 获取任务列表 =====
// Query 参数 (强大的过滤+排序):
// ?status=doing&priority=high,assignee=me&tag=bug,feature
// ?created_after=2026-04-01&created_before=2026-04-30
// ?sprint=current&sort=priority&order=desc
// ?cursor=xxx&limit=50
// 响应 200
interface ListTasksResponse {
  data: Task[];
  meta: ResponseMeta & { filters_applied: TaskFilter };
}

interface TaskFilter {
  status?: string[];
  priority?: string[];
  assignee?: string[];
  creator?: string;
  tag?: string[];
  sprint?: string;
  created_after?: string;
  created_before?: string;
  search?: string;
}

interface Task {
  id: string;
  // 基本信息
  title: string;
  description: string | null;       // Markdown 格式
  description_html: string | null;  // 渲染后的 HTML
  issue_type: IssueTypeRef;
  // 状态
  status: {
    id: string;
    name: string;
    color: string;
    type: 'todo' | 'doing' | 'done';
  };
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  // 人员
  assignee: UserRef | null;
  reporter: UserRef;
  // 时间
  due_date: string | null;          // ISO 8601
  start_date: string | null;
  estimated_hours: number | null;
  logged_hours: number;             // 已记录工时
  // 关联
  project_id: string;
  sprint_id: string | null;
  parent_task_id: string | null;    // 父任务 (用于子任务)
  labels: string[];                 // 标签
  // 统计
  attachment_count: number;
  comment_count: number;
  subtask_count: { total: number; done: number };
  // 时间戳
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface IssueTypeRef {
  id: string;
  name: string;
  color: string;
  icon: string;
}

// ===== POST /projects/:project_id/tasks — 创建任务 =====
interface CreateTaskRequest {
  title: string;                    // 必填，1-200 字符
  description?: string;             // Markdown
  issue_type_id?: string;           // 默认 "task"
  status_id?: string;               // 默认工作流第一个状态
  priority?: Task['priority'];      // 默认 "medium"
  assignee_id?: string | null;
  due_date?: string | null;
  start_date?: string | null;
  estimated_hours?: number | null;
  parent_task_id?: string | null;   // 创建子任务
  sprint_id?: string | null;
  labels?: string[];
  // 批量创建支持
  _count?: number;                  // 创建 N 个相同模板任务 (仅 title 递增)
}

// ===== GET /tasks/:task_id — 获取任务详情 =====
// 响应包含完整 Task 对象 + 关联数据

// ===== PATCH /tasks/:task_id — 更新任务 =====
interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status_id?: string;
  priority?: Task['priority'];
  assignee_id?: string | null;
  due_date?: string | null;
  estimated_hours?: number | null;
  sprint_id?: string | null;
  labels?: string[];
}

// ===== DELETE /tasks/:task_id — 删除任务 =====
// 级联删除子任务、评论、附件

// ===== POST /tasks/:task_id/status — 快速切换状态 =====
// 快捷操作，不需要完整的 PATCH
interface QuickStatusChangeRequest {
  status_id: string;
  comment?: string;  // 可选：切换状态时添加评论
}

// ===== POST /tasks/:task_id/subscribe — 订阅任务 =====
// 订阅后任务变更会收到通知
// ===== DELETE /tasks/:task_id/subscribe — 取消订阅
```

### 2.7 评论 API

```typescript
// ===== GET /tasks/:task_id/comments — 获取评论列表 =====
// Query: ?cursor=xxx&limit=20&sort=created_at&order=asc
// 响应 200
interface ListCommentsResponse {
  data: Comment[];
  meta: ResponseMeta;
}

interface Comment {
  id: string;
  content: string;           // Markdown
  content_html: string;      // 渲染后 HTML
  author: UserRef;
  mentions: UserRef[];       // @提及的用户
  attachments: AttachmentRef[];
  reactions: CommentReaction[];
  edited: boolean;
  created_at: string;
  updated_at: string;
}

interface CommentReaction {
  emoji: string;
  users: UserRef[];
  count: number;
}

// ===== POST /tasks/:task_id/comments — 创建评论 =====
interface CreateCommentRequest {
  content: string;           // Markdown，支持 @提及
  attachment_ids?: string[]; // 关联附件
}

// ===== PATCH /comments/:comment_id — 编辑评论 =====
// ===== DELETE /comments/:comment_id — 删除评论 =====

// ===== POST /comments/:comment_id/reactions — 添加表情反应 =====
interface AddReactionRequest {
  emoji: string;  // "👍" "❤️" "🎉" 等
}
// ===== DELETE /comments/:comment_id/reactions — 移除表情反应
```

### 2.8 附件 API

```typescript
// ===== POST /attachments — 上传附件 =====
// Content-Type: multipart/form-data
// 请求: file (文件) + task_id (可选) + comment_id (可选)
// 响应 201
interface UploadAttachmentResponse {
  attachment: {
    id: string;
    filename: string;
    size: number;             // 字节
    mime_type: string;
    url: string;              // 临时下载 URL (预签名 URL, 1h 有效)
    thumbnail_url?: string;   // 图片缩略图
    created_at: string;
  };
}

// 限制:
// - 单文件最大 50MB (免费版) / 200MB (Pro)
// - 支持类型: 图片/视频/文档/压缩包
// - 病毒扫描 (ClamAV)

// ===== GET /attachments/:attachment_id — 获取附件信息 =====
// ===== DELETE /attachments/:attachment_id — 删除附件 =====
// ===== GET /attachments/:attachment_id/download — 下载附件 =====
// 返回文件流 + Content-Disposition 头
```

### 2.9 Sprint (迭代) API

```typescript
// ===== GET /projects/:project_id/sprints — 获取迭代列表 =====
// Query: ?status=active&cursor=xxx
// 响应 200
interface ListSprintsResponse {
  data: Sprint[];
  meta: ResponseMeta;
}

interface Sprint {
  id: string;
  name: string;               // "Sprint 24"
  goal: string | null;        // 迭代目标
  start_date: string;
  end_date: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  project_id: string;
  stats: {
    total_tasks: number;
    done_tasks: number;
    total_points: number;     // 故事点
    completed_points: number;
    burndown: BurndownData[]; // 燃尽图数据
  };
  created_at: string;
}

interface BurndownData {
  date: string;
  remaining_points: number;
  ideal_remaining: number;
}

// ===== POST /projects/:project_id/sprints — 创建迭代 =====
interface CreateSprintRequest {
  name: string;
  goal?: string;
  start_date: string;
  end_date: string;
}

// ===== POST /sprints/:sprint_id/start — 开始迭代 =====
// ===== POST /sprints/:sprint_id/complete — 完成迭代 =====
// ===== PATCH /sprints/:sprint_id — 更新迭代 =====
// ===== DELETE /sprints/:sprint_id — 删除迭代 =====
```

### 2.10 看板 API

```typescript
// ===== GET /projects/:project_id/board — 获取看板数据 =====
// 响应 200 — 一次性获取看板所有数据
interface BoardResponse {
  columns: BoardColumn[];
  swimlanes?: BoardSwimlane[];  // 泳道 (可选)
}

interface BoardColumn {
  id: string;
  name: string;
  color: string;
  workflow_type: 'todo' | 'doing' | 'done';
  order: number;
  WIP_limit?: number;          // 在制品限制
  tasks: Task[];               // 该列所有任务 (按 order 排序)
}

interface BoardSwimlane {
  id: string;
  name: string;
  type: 'assignee' | 'priority' | 'label';
  value: string;
  columns: BoardColumn[];
}

// ===== PUT /projects/:project_id/board/tasks/reorder — 拖拽排序 =====
interface ReorderTasksRequest {
  moves: {
    task_id: string;
    target_status_id: string;
    before_task_id?: string;   // 移到某个任务之前
    after_task_id?: string;    // 移到某个任务之后
  }[];
}

// ===== PUT /projects/:project_id/board/columns/reorder — 列排序 =====
interface ReorderColumnsRequest {
  column_orders: { column_id: string; order: number }[];
}
```

### 2.11 通知 API

```typescript
// ===== GET /notifications — 获取通知列表 =====
// Query: ?unread_only=true&cursor=xxx&limit=20
// 响应 200
interface ListNotificationsResponse {
  data: Notification[];
  meta: ResponseMeta & { unread_count: number };
}

interface Notification {
  id: string;
  type: 'task_assigned' | 'task_mentioned' | 'comment_added' | 
        'task_completed' | 'sprint_started' | 'member_joined';
  title: string;
  body: string;
  actor: UserRef;              // 操作者
  target: {                    // 目标资源
    type: 'task' | 'project' | 'sprint';
    id: string;
    title: string;
  };
  read: boolean;
  created_at: string;
}

// ===== POST /notifications/read-all — 全部标记已读 =====
// ===== PATCH /notifications/:id — 标记单条已读 =====
// ===== DELETE /notifications/:id — 删除通知 =====
```

### 2.12 搜索 API

```typescript
// ===== GET /search — 全局搜索 =====
// Query:
// ?q=keyword                    // 搜索关键词
// &type=task,project            // 类型过滤
// &project_id=xxx               // 限定项目
// &assignee=me                  // 限定负责人
// &status=doing                 // 限定状态
// &tag=bug                      // 限定标签
// &cursor=xxx&limit=20
// 响应 200
interface SearchResponse {
  results: SearchResult[];
  meta: ResponseMeta & {
    total_hits: number;
    query_time_ms: number;
  };
}

interface SearchResult {
  type: 'task' | 'project' | 'user';
  id: string;
  title: string;
  snippet: string;             // 匹配摘要 (高亮)
  project?: { id: string; name: string };
  _score: number;              // 相关度分数
}

// 搜索引擎: Elasticsearch / Meilisearch
// 分词: 中文 (jieba) + 英文
// 高亮: <mark> 标签包裹匹配词
```

### 2.13 Webhook API

```typescript
// ===== GET /organizations/:org_id/webhooks — 获取 Webhook 列表 =====
// ===== POST /organizations/:org_id/webhooks — 创建 Webhook =====
interface CreateWebhookRequest {
  url: string;                 // 接收 URL (必须 HTTPS)
  events: WebhookEvent[];      // 订阅事件
  secret: string;              // HMAC 密钥
  active: boolean;
  description?: string;
}

type WebhookEvent = 
  | 'task.created' | 'task.updated' | 'task.deleted'
  | 'task.status_changed' | 'task.assigned'
  | 'comment.created'
  | 'sprint.started' | 'sprint.completed'
  | 'member.joined' | 'member.removed';

// Webhook 发送格式
interface WebhookPayload {
  id: string;                  // 事件 ID (ulid)
  event: WebhookEvent;
  timestamp: string;
  organization_id: string;
  data: unknown;               // 事件数据
  signature: string;           // HMAC-SHA256 (hex)
}

// 验证签名
function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expected}`)
  );
}

// 重试策略: 1min → 5min → 15min → 1h → 4h → 12h (最多 6 次)
// 失败后自动标记 inactive
// Webhook 日志: 最近 30 天的发送记录可查询

// ===== GET /webhooks/:webhook_id/deliveries — 查看发送记录 =====
// ===== POST /webhooks/:webhook_id/redeliver — 重新发送 =====
// ===== PATCH /webhooks/:webhook_id — 更新 Webhook =====
// ===== DELETE /webhooks/:webhook_id — 删除 Webhook =====
```

---

## 三、GraphQL API 设计

### 3.1 Schema 定义

```graphql
# ===== 类型定义 =====

scalar DateTime
scalar JSON
scalar Upload

# 认证
type AuthPayload {
  user: User!
  accessToken: String!
  refreshToken: String!
  expiresIn: Int!
}

input RegisterInput {
  email: String!
  password: String!
  name: String!
  avatarUrl: String
}

input LoginInput {
  email: String!
  password: String!
  deviceName: String
}

# 用户
type User {
  id: ID!
  email: String!
  name: String!
  avatarUrl: String
  timezone: String
  language: String
  tasksAssigned: [Task!] @deprecated(reason: "Use query tasks with assignee filter")
  tasksCreated: [Task!]
  createdAt: DateTime!
  updatedAt: DateTime
}

input UpdateUserInput {
  name: String
  avatarUrl: String
  timezone: String
  language: String
}

# 组织
type Organization {
  id: ID!
  name: String!
  slug: String!
  description: String
  avatarUrl: String
  plan: Plan!
  owner: User!
  members(first: Int, after: String, role: MemberRole): MemberConnection!
  workspaces(first: Int, after: String): WorkspaceConnection!
  settings: OrganizationSettings!
  stats: OrganizationStats!
  createdAt: DateTime!
  updatedAt: DateTime
}

enum Plan {
  FREE
  PRO
  ENTERPRISE
}

enum MemberRole {
  OWNER
  ADMIN
  MEMBER
}

type OrganizationSettings {
  defaultWorkspaceRole: WorkspaceRole!
  allowMemberCreateProject: Boolean!
  allowedEmailDomains: [String!]
}

type OrganizationStats {
  memberCount: Int!
  workspaceCount: Int!
  projectCount: Int!
}

input CreateOrganizationInput {
  name: String!
  slug: String
  description: String
}

input UpdateOrganizationInput {
  name: String
  description: String
  avatarUrl: String
  settings: OrganizationSettingsInput
}

input OrganizationSettingsInput {
  defaultWorkspaceRole: WorkspaceRole
  allowMemberCreateProject: Boolean
  allowedEmailDomains: [String!]
}

# 工作空间
type Workspace {
  id: ID!
  name: String!
  description: String
  icon: String
  color: String
  organization: Organization!
  projects(first: Int, after: String, archived: Boolean, search: String): ProjectConnection!
  members: [WorkspaceMember!]!
  role: WorkspaceRole!
  createdAt: DateTime!
  updatedAt: DateTime
}

enum WorkspaceRole {
  ADMIN
  EDITOR
  VIEWER
}

type WorkspaceMember {
  user: User!
  role: WorkspaceRole!
  joinedAt: DateTime!
}

input CreateWorkspaceInput {
  name: String!
  description: String
  icon: String
  color: String
}

input UpdateWorkspaceInput {
  name: String
  description: String
  icon: String
  color: String
}

# 项目
type Project {
  id: ID!
  name: String!
  description: String
  icon: String
  workspace: Workspace!
  visibility: Visibility!
  archived: Boolean!
  lead: User
  members: [User!]!
  settings: ProjectSettings!
  tasks(first: Int, after: String, filter: TaskFilter): TaskConnection!
  sprints(first: Int, after: String, status: SprintStatus): SprintConnection!
  board: Board!
  stats: ProjectStats!
  createdAt: DateTime!
  updatedAt: DateTime
}

enum Visibility {
  PUBLIC
  PRIVATE
}

type ProjectSettings {
  defaultView: ProjectView!
  sprintsEnabled: Boolean!
  issueTypes: [IssueType!]!
  workflow: [WorkflowState!]!
}

enum ProjectView {
  BOARD
  LIST
  TIMELINE
  CALENDAR
}

type IssueType {
  id: ID!
  name: String!
  color: String!
  icon: String!
  description: String
}

type WorkflowState {
  id: ID!
  name: String!
  color: String!
  type: WorkflowType!
  order: Int!
}

enum WorkflowType {
  TODO
  DOING
  DONE
}

type ProjectStats {
  taskCount: Int!
  doneCount: Int!
  overdueCount: Int!
  completionRate: Float!
}

input CreateProjectInput {
  name: String!
  description: String
  icon: String
  visibility: Visibility
  leadId: ID
  memberIds: [ID!]
  template: String
}

input UpdateProjectInput {
  name: String
  description: String
  icon: String
  visibility: Visibility
  leadId: ID
  archived: Boolean
}

# 任务
type Task {
  id: ID!
  title: String!
  description: String
  descriptionHtml: String
  issueType: IssueType!
  status: WorkflowState!
  priority: Priority!
  assignee: User
  reporter: User!
  dueDate: DateTime
  startDate: DateTime
  estimatedHours: Float
  loggedHours: Float!
  project: Project!
  sprint: Sprint
  parentTask: Task
  subtasks(first: Int, after: String): TaskConnection!
  labels: [String!]!
  comments(first: Int, after: String): CommentConnection!
  attachments: [Attachment!]!
  reactions: [TaskReaction!]!
  subscribers: [User!]!
  isSubscribed: Boolean!
  attachmentCount: Int!
  commentCount: Int!
  subtaskCount: SubtaskCount!
  createdAt: DateTime!
  updatedAt: DateTime
  completedAt: DateTime
}

enum Priority {
  URGENT
  HIGH
  MEDIUM
  LOW
  NONE
}

type SubtaskCount {
  total: Int!
  done: Int!
}

type TaskReaction {
  emoji: String!
  users: [User!]!
  count: Int!
}

input TaskFilter {
  statusIds: [ID!]
  priority: Priority
  assigneeId: ID
  reporterId: ID
  label: String
  sprintId: ID
  createdAfter: DateTime
  createdBefore: DateTime
  search: String
  parentTaskId: ID
}

input CreateTaskInput {
  title: String!
  description: String
  issueTypeId: ID
  statusId: ID
  priority: Priority
  assigneeId: ID
  dueDate: DateTime
  startDate: DateTime
  estimatedHours: Float
  parentTaskId: ID
  sprintId: ID
  labels: [String!]
}

input UpdateTaskInput {
  title: String
  description: String
  statusId: ID
  priority: Priority
  assigneeId: ID
  dueDate: DateTime
  estimatedHours: Float
  sprintId: ID
  labels: [String!]
}

# Sprint
type Sprint {
  id: ID!
  name: String!
  goal: String
  startDate: DateTime!
  endDate: DateTime!
  status: SprintStatus!
  project: Project!
  tasks(first: Int, after: String): TaskConnection!
  stats: SprintStats!
  createdAt: DateTime!
}

enum SprintStatus {
  PLANNING
  ACTIVE
  COMPLETED
  CANCELLED
}

type SprintStats {
  totalTasks: Int!
  doneTasks: Int!
  totalPoints: Float!
  completedPoints: Float!
  burndown: [BurndownPoint!]!
}

type BurndownPoint {
  date: DateTime!
  remainingPoints: Float!
  idealRemaining: Float!
}

input CreateSprintInput {
  name: String!
  goal: String
  startDate: DateTime!
  endDate: DateTime!
}

# 看板
type Board {
  columns: [BoardColumn!]!
  swimlanes: [BoardSwimlane!]
}

type BoardColumn {
  id: ID!
  name: String!
  color: String!
  workflowType: WorkflowType!
  order: Int!
  wipLimit: Int
  tasks(first: Int): TaskConnection!
}

type BoardSwimlane {
  id: ID!
  name: String!
  type: SwimlaneType!
  value: String!
  columns: [BoardColumn!]!
}

enum SwimlaneType {
  ASSIGNEE
  PRIORITY
  LABEL
}

input ReorderTasksInput {
  moves: [TaskMove!]!
}

input TaskMove {
  taskId: ID!
  targetStatusId: ID!
  beforeTaskId: ID
  afterTaskId: ID
}

# 评论
type Comment {
  id: ID!
  content: String!
  contentHtml: String!
  author: User!
  mentions: [User!]!
  attachments: [Attachment!]!
  reactions: [CommentReaction!]!
  edited: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime
}

type CommentReaction {
  emoji: String!
  users: [User!]!
  count: Int!
}

input CreateCommentInput {
  content: String!
  attachmentIds: [ID!]
}

input UpdateCommentInput {
  content: String!
}

# 附件
type Attachment {
  id: ID!
  filename: String!
  size: Int!
  mimeType: String!
  url: String!
  thumbnailUrl: String
  createdAt: DateTime!
}

input UploadAttachmentInput {
  file: Upload!
  taskId: ID
  commentId: ID
}

# 通知
type Notification {
  id: ID!
  type: NotificationType!
  title: String!
  body: String!
  actor: User!
  target: NotificationTarget!
  read: Boolean!
  createdAt: DateTime!
}

enum NotificationType {
  TASK_ASSIGNED
  TASK_MENTIONED
  COMMENT_ADDED
  TASK_COMPLETED
  SPRINT_STARTED
  MEMBER_JOINED
}

type NotificationTarget {
  type: String!
  id: ID!
  title: String!
}

# ===== 连接类型 (分页) =====

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
}

type UserEdge {
  node: User!
  cursor: String!
}

type TaskConnection {
  edges: [TaskEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type TaskEdge {
  node: Task!
  cursor: String!
}

type CommentConnection {
  edges: [CommentEdge!]!
  pageInfo: PageInfo!
}

type CommentEdge {
  node: Comment!
  cursor: String!
}

type ProjectConnection {
  edges: [ProjectEdge!]!
  pageInfo: PageInfo!
}

type ProjectEdge {
  node: Project!
  cursor: String!
}

type SprintConnection {
  edges: [SprintEdge!]!
  pageInfo: PageInfo!
}

type SprintEdge {
  node: Sprint!
  cursor: String!
}

type MemberConnection {
  edges: [MemberEdge!]!
  pageInfo: PageInfo!
}

type MemberEdge {
  node: WorkspaceMember!
  cursor: String!
}

type WorkspaceConnection {
  edges: [WorkspaceEdge!]!
  pageInfo: PageInfo!
}

type WorkspaceEdge {
  node: Workspace!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# ===== 错误类型 =====

type Error {
  code: String!
  message: String!
  field: String
}

type ValidationError {
  errors: [Error!]!
}
```

### 3.2 Query 设计

```graphql
# ===== 根 Query =====

type Query {
  # 认证
  me: User!

  # 组织
  organization(id: ID!, slug: String): Organization!
  organizations: [Organization!]!

  # 工作空间
  workspace(id: ID!): Workspace!

  # 项目
  project(id: ID!): Project!

  # 任务
  task(id: ID!): Task!
  tasks(first: Int, after: String, filter: TaskFilter): TaskConnection!

  # Sprint
  sprint(id: ID!): Sprint!

  # 通知
  notifications(first: Int, after: String, unreadOnly: Boolean): [Notification!]!
  unreadNotificationCount: Int!

  # 搜索
  search(query: String!, type: [SearchType!], first: Int): [SearchResult!]!
}

enum SearchType {
  TASK
  PROJECT
  USER
}

union SearchResult = Task | Project | User
```

### 3.3 Mutation 设计

```graphql
# ===== 根 Mutation =====

type Mutation {
  # 认证
  register(input: RegisterInput!): AuthPayload!
  login(input: LoginInput!): AuthPayload!
  refreshToken(refreshToken: String!): AuthPayload!
  logout(refreshToken: String!): Boolean!
  forgotPassword(email: String!): Boolean!
  resetPassword(token: String!, password: String!): Boolean!

  # 用户
  updateUser(input: UpdateUserInput!): User!
  changePassword(currentPassword: String!, newPassword: String!): Boolean!

  # 组织
  createOrganization(input: CreateOrganizationInput!): Organization!
  updateOrganization(id: ID!, input: UpdateOrganizationInput!): Organization!
  deleteOrganization(id: ID!, confirmation: String!): Boolean!
  inviteMember(orgId: ID!, email: String!, role: MemberRole!): Boolean!
  updateMemberRole(orgId: ID!, userId: ID!, role: MemberRole!): WorkspaceMember!
  removeMember(orgId: ID!, userId: ID!): Boolean!

  # 工作空间
  createWorkspace(orgId: ID!, input: CreateWorkspaceInput!): Workspace!
  updateWorkspace(id: ID!, input: UpdateWorkspaceInput!): Workspace!
  deleteWorkspace(id: ID!): Boolean!

  # 项目
  createProject(workspaceId: ID!, input: CreateProjectInput!): Project!
  updateProject(id: ID!, input: UpdateProjectInput!): Project!
  deleteProject(id: ID!, confirmation: String!): Boolean!
  addProjectMember(projectId: ID!, userId: ID!): Project!
  removeProjectMember(projectId: ID!, userId: ID!): Project!

  # 任务
  createTask(projectId: ID!, input: CreateTaskInput!): Task!
  updateTask(id: ID!, input: UpdateTaskInput!): Task!
  deleteTask(id: ID!): Boolean!
  quickChangeStatus(taskId: ID!, statusId: ID!, comment: String): Task!
  subscribeTask(taskId: ID!): Task!
  unsubscribeTask(taskId: ID!): Task!
  addTaskReaction(taskId: ID!, emoji: String!): Task!
  removeTaskReaction(taskId: ID!, emoji: String!): Task!
  reorderTasks(projectId: ID!, input: ReorderTasksInput!): [Task!]!

  # Sprint
  createSprint(projectId: ID!, input: CreateSprintInput!): Sprint!
  startSprint(id: ID!): Sprint!
  completeSprint(id: ID!): Sprint!
  updateSprint(id: ID!, input: CreateSprintInput!): Sprint!
  deleteSprint(id: ID!): Boolean!

  # 评论
  createComment(taskId: ID!, input: CreateCommentInput!): Comment!
  updateComment(id: ID!, input: UpdateCommentInput!): Comment!
  deleteComment(id: ID!): Boolean!
  addCommentReaction(commentId: ID!, emoji: String!): Comment!

  # 附件
  uploadAttachment(input: UploadAttachmentInput!): Attachment!
  deleteAttachment(id: ID!): Boolean!

  # 通知
  markNotificationRead(id: ID!): Notification!
  markAllNotificationsRead: Boolean!
  deleteNotification(id: ID!): Boolean!
}
```

### 3.4 Subscription (实时订阅)

```graphql
# ===== 根 Subscription =====

type Subscription {
  # 任务变更
  taskCreated(projectId: ID!): Task!
  taskUpdated(taskId: ID!): TaskUpdatedPayload!
  taskDeleted(taskId: ID!): ID!

  # 评论
  commentAdded(taskId: ID!): Comment!

  # 通知
  notificationReceived: Notification!
}

type TaskUpdatedPayload {
  task: Task!
  changes: [TaskChange!]!
}

type TaskChange {
  field: String!
  from: String
  to: String
}
```

### 3.5 前端查询示例

```graphql
# ===== 示例 1: 看板页面 — 一次获取所有数据 =====
query GetBoard($projectId: ID!) {
  project(id: $projectId) {
    id
    name
    settings {
      defaultView
      workflow {
        id
        name
        color
        type
        order
      }
    }
    board {
      columns {
        id
        name
        color
        workflowType
        order
        wipLimit
        tasks {
          edges {
            node {
              id
              title
              priority
              issueType { name color icon }
              assignee { id name avatarUrl }
              dueDate
              attachmentCount
              commentCount
              subtaskCount { total done }
            }
            cursor
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
    sprints(status: ACTIVE) {
      edges {
        node {
          id
          name
          goal
          stats {
            totalTasks
            doneTasks
            totalPoints
            completedPoints
          }
        }
      }
    }
  }
}

# ===== 示例 2: 任务详情页 — 完整信息 =====
query GetTaskDetail($taskId: ID!) {
  task(id: $taskId) {
    id
    title
    description
    descriptionHtml
    issueType { id name color icon }
    status { id name color type }
    priority
    assignee { id name avatarUrl }
    reporter { id name avatarUrl }
    dueDate
    startDate
    estimatedHours
    loggedHours
    labels
    project { id name workspace { id name organization { id name } } }
    sprint { id name goal startDate endDate }
    parentTask { id title status { name } }
    subtasks(first: 50) {
      edges {
        node {
          id
          title
          status { id name type }
          priority
          assignee { id name avatarUrl }
          dueDate
        }
        cursor
      }
    }
    comments(first: 20, after: null) {
      edges {
        node {
          id
          contentHtml
          author { id name avatarUrl }
          mentions { id name }
          reactions { emoji users { id } count }
          edited
          createdAt
        }
        cursor
      }
      pageInfo { hasNextPage endCursor }
    }
    attachments {
      id
      filename
      size
      mimeType
      url
      thumbnailUrl
    }
    reactions { emoji users { id } count }
    isSubscribed
    createdAt
    updatedAt
    completedAt
  }
}

# ===== 示例 3: 创建任务 + 子任务 =====
mutation CreateTaskWithSubtasks($projectId: ID!, $taskInput: CreateTaskInput!, $subtaskInputs: [CreateTaskInput!]!) {
  createTask(projectId: $projectId, input: $taskInput) {
    id
    title
    subtaskCount { total done }
  }
}
# 前端循环调用 createTask 设置 parentTaskId

# ===== 示例 4: 拖拽排序 =====
mutation ReorderTasks($projectId: ID!, $input: ReorderTasksInput!) {
  reorderTasks(projectId: $projectId, input: $input) {
    id
    status { id name }
  }
}

# ===== 示例 5: 全局搜索 =====
query GlobalSearch($query: String!, $type: [SearchType!]) {
  search(query: $query, type: $type, first: 20) {
    ... on Task {
      id
      title
      project { name }
      status { name }
      priority
    }
    ... on Project {
      id
      name
      workspace { name }
    }
    ... on User {
      id
      name
      avatarUrl
    }
  }
}

# ===== 示例 6: 订阅实时更新 =====
subscription OnTaskUpdate($taskId: ID!) {
  taskUpdated(taskId: $taskId) {
    task {
      id
      title
      status { id name }
      assignee { id name }
      updatedAt
    }
    changes {
      field
      from
      to
    }
  }
}

subscription OnNotification {
  notificationReceived {
    id
    type
    title
    body
    actor { id name avatarUrl }
    read
    createdAt
  }
}
```

---

## 四、OpenAPI 3.0 文档 (RESTful)

```yaml
openapi: 3.0.3
info:
  title: CloudBoard API
  description: |
    CloudBoard 项目协作平台 REST API。
    
    ## 认证
    所有 API 请求需要在 Header 中携带 JWT Token:
    ```
    Authorization: Bearer <access_token>
    ```
    
    ## 分页
    使用游标分页 (Cursor-based Pagination):
    - `cursor`: 上一页的 endCursor
    - `limit`: 每页数量 (默认 20, 最大 100)
    
    ## 错误处理
    统一错误响应格式:
    ```json
    {
      "success": false,
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "请求参数验证失败",
        "details": [
          { "field": "title", "message": "标题不能为空", "code": "REQUIRED" }
        ],
        "trace_id": "req_abc123"
      }
    }
    ```
  version: 1.0.0
  contact:
    name: CloudBoard API Support
    url: https://cloudboard.com/api-docs
    email: api-support@cloudboard.com

servers:
  - url: https://api.cloudboard.com/v1
    description: 生产环境
  - url: https://api-staging.cloudboard.com/v1
    description: 预发布环境
  - url: http://localhost:3000/v1
    description: 本地开发

tags:
  - name: Auth
    description: 认证相关
  - name: Users
    description: 用户管理
  - name: Organizations
    description: 组织管理
  - name: Workspaces
    description: 工作空间管理
  - name: Projects
    description: 项目管理
  - name: Tasks
    description: 任务管理 (核心)
  - name: Comments
    description: 评论管理
  - name: Attachments
    description: 附件管理
  - name: Sprints
    description: 迭代管理
  - name: Boards
    description: 看板管理
  - name: Notifications
    description: 通知管理
  - name: Search
    description: 搜索
  - name: Webhooks
    description: Webhook 管理

paths:
  /auth/register:
    post:
      tags: [Auth]
      summary: 用户注册
      operationId: register
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
      responses:
        '201':
          description: 注册成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '409':
          description: 邮箱已注册
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

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
                $ref: '#/components/schemas/AuthResponse'
        '401':
          description: 邮箱或密码错误
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /auth/refresh:
    post:
      tags: [Auth]
      summary: 刷新 Token
      operationId: refreshToken
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [refresh_token]
              properties:
                refresh_token:
                  type: string
      responses:
        '200':
          description: 刷新成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenRefreshResponse'

  /auth/me:
    get:
      tags: [Users]
      summary: 获取当前用户信息
      operationId: getMe
      security:
        - bearerAuth: []
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    $ref: '#/components/schemas/User'

    put:
      tags: [Users]
      summary: 更新当前用户信息
      operationId: updateMe
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateUserRequest'
      responses:
        '200':
          description: 更新成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    $ref: '#/components/schemas/User'

  /organizations:
    get:
      tags: [Organizations]
      summary: 获取用户所属组织列表
      operationId: listOrganizations
      security:
        - bearerAuth: []
      parameters:
        - name: include_pending
          in: query
          schema:
            type: boolean
            default: false
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/OrganizationSummary'
                  meta:
                    $ref: '#/components/schemas/ResponseMeta'

    post:
      tags: [Organizations]
      summary: 创建组织
      operationId: createOrganization
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrganizationRequest'
      responses:
        '201':
          description: 创建成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    $ref: '#/components/schemas/Organization'

  /organizations/{org_id}:
    get:
      tags: [Organizations]
      summary: 获取组织详情
      operationId: getOrganization
      security:
        - bearerAuth: []
      parameters:
        - name: org_id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    $ref: '#/components/schemas/Organization'

    patch:
      tags: [Organizations]
      summary: 更新组织
      operationId: updateOrganization
      security:
        - bearerAuth: []
      parameters:
        - name: org_id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateOrganizationRequest'
      responses:
        '200':
          description: 更新成功

    delete:
      tags: [Organizations]
      summary: 删除组织
      operationId: deleteOrganization
      security:
        - bearerAuth: []
      parameters:
        - name: org_id
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
              required: [confirmation]
              properties:
                confirmation:
                  type: string
                  enum: ["DELETE"]
      responses:
        '204':
          description: 删除成功

  /organizations/{org_id}/members:
    get:
      tags: [Organizations]
      summary: 获取成员列表
      operationId: listMembers
      security:
        - bearerAuth: []
      parameters:
        - name: org_id
          in: path
          required: true
          schema:
            type: string
        - name: role
          in: query
          schema:
            type: string
            enum: [owner, admin, member]
        - name: search
          in: query
          schema:
            type: string
        - name: cursor
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/OrganizationMember'
                  meta:
                    $ref: '#/components/schemas/ResponseMeta'

    post:
      tags: [Organizations]
      summary: 邀请成员
      operationId: inviteMember
      security:
        - bearerAuth: []
      parameters:
        - name: org_id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/InviteMemberRequest'
      responses:
        '201':
          description: 邀请已发送

  /projects/{project_id}/tasks:
    get:
      tags: [Tasks]
      summary: 获取任务列表 (支持强大过滤)
      operationId: listTasks
      security:
        - bearerAuth: []
      parameters:
        - name: project_id
          in: path
          required: true
          schema:
            type: string
        - name: status
          in: query
          schema:
            type: string
          description: 状态过滤，逗号分隔
        - name: priority
          in: query
          schema:
            type: string
            enum: [urgent, high, medium, low, none]
        - name: assignee
          in: query
          schema:
            type: string
          description: 负责人 ID 或 'me'
        - name: tag
          in: query
          schema:
            type: string
          description: 标签过滤，逗号分隔
        - name: sprint
          in: query
          schema:
            type: string
          description: Sprint ID 或 'current'
        - name: created_after
          in: query
          schema:
            type: string
            format: date
        - name: created_before
          in: query
          schema:
            type: string
            format: date
        - name: sort
          in: query
          schema:
            type: string
            enum: [priority, due_date, created_at, updated_at]
            default: updated_at
        - name: order
          in: query
          schema:
            type: string
            enum: [asc, desc]
            default: desc
        - name: cursor
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
            maximum: 100
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Task'
                  meta:
                    type: object
                    properties:
                      pagination:
                        $ref: '#/components/schemas/PaginationMeta'
                      filters_applied:
                        $ref: '#/components/schemas/TaskFilter'

    post:
      tags: [Tasks]
      summary: 创建任务
      operationId: createTask
      security:
        - bearerAuth: []
      parameters:
        - name: project_id
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
                  success:
                    type: boolean
                  data:
                    $ref: '#/components/schemas/Task'

  /tasks/{task_id}:
    get:
      tags: [Tasks]
      summary: 获取任务详情
      operationId: getTask
      security:
        - bearerAuth: []
      parameters:
        - name: task_id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    $ref: '#/components/schemas/Task'

    patch:
      tags: [Tasks]
      summary: 更新任务
      operationId: updateTask
      security:
        - bearerAuth: []
      parameters:
        - name: task_id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateTaskRequest'
      responses:
        '200':
          description: 更新成功

    delete:
      tags: [Tasks]
      summary: 删除任务
      operationId: deleteTask
      security:
        - bearerAuth: []
      parameters:
        - name: task_id
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: 删除成功

  /tasks/{task_id}/status:
    post:
      tags: [Tasks]
      summary: 快速切换任务状态
      operationId: quickChangeStatus
      security:
        - bearerAuth: []
      parameters:
        - name: task_id
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
              required: [status_id]
              properties:
                status_id:
                  type: string
                comment:
                  type: string
      responses:
        '200':
          description: 状态已更新

  /search:
    get:
      tags: [Search]
      summary: 全局搜索
      operationId: search
      security:
        - bearerAuth: []
      parameters:
        - name: q
          in: query
          required: true
          schema:
            type: string
          description: 搜索关键词
        - name: type
          in: query
          schema:
            type: string
          description: 类型过滤，逗号分隔: task,project,user
        - name: project_id
          in: query
          schema:
            type: string
        - name: assignee
          in: query
          schema:
            type: string
        - name: status
          in: query
          schema:
            type: string
        - name: tag
          in: query
          schema:
            type: string
        - name: cursor
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 50
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/SearchResult'
                  meta:
                    type: object
                    properties:
                      total_hits:
                        type: integer
                      query_time_ms:
                        type: integer

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        email:
          type: string
        name:
          type: string
        avatar_url:
          type: string
          nullable: true
        timezone:
          type: string
        language:
          type: string
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
          nullable: true

    Organization:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        slug:
          type: string
        description:
          type: string
          nullable: true
        avatar_url:
          type: string
          nullable: true
        owner_id:
          type: string
        plan:
          type: string
          enum: [free, pro, enterprise]
        settings:
          type: object
        stats:
          type: object
          properties:
            member_count:
              type: integer
            workspace_count:
              type: integer
            project_count:
              type: integer
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    OrganizationSummary:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        slug:
          type: string
        avatar_url:
          type: string
          nullable: true
        role:
          type: string
          enum: [owner, admin, member]
        member_count:
          type: integer
        created_at:
          type: string
          format: date-time

    OrganizationMember:
      type: object
      properties:
        user:
          $ref: '#/components/schemas/UserRef'
        role:
          type: string
          enum: [owner, admin, member]
        joined_at:
          type: string
          format: date-time
        last_active_at:
          type: string
          format: date-time
          nullable: true

    UserRef:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        avatar_url:
          type: string
          nullable: true

    Task:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        description:
          type: string
          nullable: true
        description_html:
          type: string
          nullable: true
        issue_type:
          $ref: '#/components/schemas/IssueTypeRef'
        status:
          type: object
          properties:
            id:
              type: string
            name:
              type: string
            color:
              type: string
            type:
              type: string
              enum: [todo, doing, done]
        priority:
          type: string
          enum: [urgent, high, medium, low, none]
        assignee:
          $ref: '#/components/schemas/UserRef'
          nullable: true
        reporter:
          $ref: '#/components/schemas/UserRef'
        due_date:
          type: string
          format: date-time
          nullable: true
        start_date:
          type: string
          format: date-time
          nullable: true
        estimated_hours:
          type: number
          nullable: true
        logged_hours:
          type: number
        project_id:
          type: string
        sprint_id:
          type: string
          nullable: true
        parent_task_id:
          type: string
          nullable: true
        labels:
          type: array
          items:
            type: string
        attachment_count:
          type: integer
        comment_count:
          type: integer
        subtask_count:
          type: object
          properties:
            total:
              type: integer
            done:
              type: integer
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
        completed_at:
          type: string
          format: date-time
          nullable: true

    IssueTypeRef:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        color:
          type: string
        icon:
          type: string

    TaskFilter:
      type: object
      properties:
        status:
          type: array
          items:
            type: string
        priority:
          type: array
          items:
            type: string
        assignee:
          type: array
          items:
            type: string
        tag:
          type: array
          items:
            type: string
        sprint:
          type: string
        created_after:
          type: string
          format: date
        created_before:
          type: string
          format: date
        search:
          type: string

    SearchResult:
      type: object
      properties:
        type:
          type: string
          enum: [task, project, user]
        id:
          type: string
        title:
          type: string
        snippet:
          type: string
        project:
          type: object
          properties:
            id:
              type: string
            name:
              type: string
        _score:
          type: number

    RegisterRequest:
      type: object
      required: [email, password, name]
      properties:
        email:
          type: string
          format: email
        password:
          type: string
          minLength: 8
          pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$'
        name:
          type: string
          minLength: 2
          maxLength: 30
        avatar_url:
          type: string
          format: uri

    LoginRequest:
      type: object
      required: [email, password]
      properties:
        email:
          type: string
          format: email
        password:
          type: string
        device_name:
          type: string

    AuthResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            user:
              $ref: '#/components/schemas/User'
            tokens:
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

    TokenRefreshResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            access_token:
              type: string
            refresh_token:
              type: string
            expires_in:
              type: integer

    UpdateUserRequest:
      type: object
      properties:
        name:
          type: string
          minLength: 2
          maxLength: 30
        avatar_url:
          type: string
          format: uri
        timezone:
          type: string
        language:
          type: string

    CreateOrganizationRequest:
      type: object
      required: [name]
      properties:
        name:
          type: string
          minLength: 3
          maxLength: 50
        slug:
          type: string
          pattern: '^[a-z0-9-]+$'
        description:
          type: string
          maxLength: 500

    UpdateOrganizationRequest:
      type: object
      properties:
        name:
          type: string
          minLength: 3
          maxLength: 50
        description:
          type: string
          maxLength: 500
        avatar_url:
          type: string
          format: uri
        settings:
          type: object

    InviteMemberRequest:
      type: object
      required: [email, role]
      properties:
        email:
          type: string
          format: email
        role:
          type: string
          enum: [admin, member]
        workspace_roles:
          type: array
          items:
            type: object
            properties:
              workspace_id:
                type: string
              role:
                type: string
                enum: [viewer, editor, admin]

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
        issue_type_id:
          type: string
        status_id:
          type: string
        priority:
          type: string
          enum: [urgent, high, medium, low, none]
        assignee_id:
          type: string
          nullable: true
        due_date:
          type: string
          format: date-time
          nullable: true
        start_date:
          type: string
          format: date-time
          nullable: true
        estimated_hours:
          type: number
          nullable: true
        parent_task_id:
          type: string
          nullable: true
        sprint_id:
          type: string
          nullable: true
        labels:
          type: array
          items:
            type: string
        _count:
          type: integer
          description: 批量创建数量

    UpdateTaskRequest:
      type: object
      properties:
        title:
          type: string
          minLength: 1
          maxLength: 200
        description:
          type: string
        status_id:
          type: string
        priority:
          type: string
          enum: [urgent, high, medium, low, none]
        assignee_id:
          type: string
          nullable: true
        due_date:
          type: string
          format: date-time
          nullable: true
        estimated_hours:
          type: number
          nullable: true
        sprint_id:
          type: string
          nullable: true
        labels:
          type: array
          items:
            type: string

    ResponseMeta:
      type: object
      properties:
        request_id:
          type: string
        timestamp:
          type: string
          format: date-time
        pagination:
          $ref: '#/components/schemas/PaginationMeta'
        rate_limit:
          type: object
          properties:
            limit:
              type: integer
            remaining:
              type: integer
            reset_at:
              type: string
              format: date-time

    PaginationMeta:
      type: object
      properties:
        next_cursor:
          type: string
        prev_cursor:
          type: string
        has_more:
          type: boolean
        total_count:
          type: integer
        page_size:
          type: integer

    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
          example: false
        error:
          type: object
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
            trace_id:
              type: string
```

---

## 五、生产级最佳实践总结

### 5.1 RESTful 设计 Checklist

```
□ URL 使用名词复数 (GET /users, 不是 GET /getUser)
□ HTTP 方法语义正确 (GET 读取, POST 创建, PUT 全量更新, PATCH 部分更新, DELETE 删除)
□ 使用状态码 (200/201/204/400/401/403/404/409/422/429/500)
□ 统一响应格式 ({ success, data/error, meta })
□ 游标分页 (cursor-based, 不是 offset-based)
□ 过滤/排序/字段选择 (query params)
□ 版本控制 (/api/v1/)
□ 认证 (JWT Bearer Token)
□ 速率限制 (Rate-Limit headers)
□ 幂等性 (X-Idempotency-Key)
□ 错误响应包含 trace_id
□ CORS 配置
□ HTTPS only
□ 请求/响应日志
□ API 文档 (OpenAPI/Swagger)
```

### 5.2 GraphQL 设计 Checklist

```
□ Schema 类型完整定义 (TypeScript 类型同步)
□ 连接类型分页 (Connection/Edge/PageInfo)
□ Mutation 输入类型 (Input)
□ 错误类型统一 (Error/ValidationError)
□ 字段级权限控制 (directive @auth)
□ 查询复杂度限制 (防止深度嵌套)
□ DataLoader 解决 N+1 问题
□ 持久查询 (Persisted Queries) 防 DDoS
□ 订阅 (Subscription) 实时更新
□ 内省查询限制 (生产环境关闭)
□ 查询白名单 (生产环境)
```

### 5.3 安全 Checklist

```
□ JWT Token 短期有效 (15min) + Refresh Token 轮换
□ 密码 bcrypt 哈希 (cost factor ≥ 12)
□ SQL 注入防护 (参数化查询/ORM)
□ XSS 防护 (输入净化 + CSP)
□ CSRF 防护 (SameSite Cookie + Token)
□ 速率限制 (IP + 用户维度)
□ 请求体大小限制
□ 文件上传类型验证 + 病毒扫描
□ RBAC 权限控制 (组织/工作空间/项目三级)
□ 审计日志 (谁在什么时间做了什么)
□ 敏感数据加密存储
□ API Key 轮换机制
```

### 5.4 性能 Checklist

```
□ 数据库索引 (外键/过滤字段/排序字段)
□ 查询优化 (JOIN vs N+1, 分页 limit)
□ Redis 缓存 (热点数据, TTL)
□ CDN (静态资源, 附件缩略图)
□ 批量操作 (批量创建/更新)
□ 异步处理 (邮件/通知/文件处理)
□ GraphQL DataLoader (N+1 解决)
□ 响应压缩 (gzip/brotli)
□ 连接池 (数据库/Redis)
□ 慢查询日志 + 监控告警
```

---

## 六、API 设计面试高频题

### Q1: REST vs GraphQL 怎么选？

**答:** 不是非此即彼，而是互补。

| 场景 | 推荐 | 理由 |
|------|------|------|
| 公开 API / 第三方集成 | REST | 标准、易理解、缓存友好 |
| 前端复杂数据需求 | GraphQL | 精确获取、减少请求数 |
| 移动端 | GraphQL | 带宽敏感、网络不稳定 |
| 简单 CRUD | REST | 实现简单、工具链成熟 |
| 实时协作 | WebSocket + REST | 实时推送 + 数据持久化 |
| 微服务间通信 | gRPC | 高性能、强类型 |

**CloudBoard 实践:** REST (公开 API + Webhook) + GraphQL (前端 SPA) + WebSocket (实时协作)

### Q2: 如何设计分页？

**答:** 三种分页方式各有适用场景：

1. **Offset-based** (`?page=2&limit=20`): 简单，但大数据量性能差 (OFFSET 100000)，数据变化时会出现重复/遗漏
2. **Cursor-based** (`?cursor=xxx&limit=20`): 性能好，适合实时数据，但无法跳页
3. **Time-based** (`?after=2026-04-01`): 适合时间序列数据

**CloudBoard 选择 Cursor-based:** 任务列表数据频繁变化，Cursor 保证一致性，且不需要跳页功能。

### Q3: 如何处理 API 版本升级？

**答:** 三层策略：

1. **Schema 演进** (首选): 只添加不删除，向后兼容，不需要新版本
2. **URL 版本** (必要): `/api/v1/` → `/api/v2/`，旧版本标注 Deprecation Header
3. **灰度发布**: 新旧版本并行运行，逐步迁移流量

**关键原则:** 永远不要破坏现有客户端。

### Q4: GraphQL 的 N+1 问题怎么解决？

**答:** 使用 DataLoader 模式：

```typescript
// ❌ N+1 问题
tasks.forEach(task => {
  const assignee = await db.users.find(task.assignee_id); // N 次查询
});

// ✅ DataLoader 解决
const userLoader = new DataLoader(async (ids: string[]) => {
  const users = await db.users.findMany({ where: { id: { in: ids } } });
  return ids.map(id => users.find(u => u.id === id));
});

// 同一 tick 内批量查询
tasks.forEach(task => {
  const assignee = await userLoader.load(task.assignee_id); // 合并为 1 次查询
});
```

### Q5: 如何保证 API 的安全性？

**答:** 五层防御：

1. **认证层:** JWT + Refresh Token 轮换 + 设备管理
2. **授权层:** RBAC (组织→工作空间→项目三级权限)
3. **输入层:** 严格验证 (Zod/ Joi) + 净化 (DOMPurify)
4. **传输层:** HTTPS + CORS + CSP
5. **监控层:** 速率限制 + 审计日志 + 异常检测

---

## 七、训练总结

### 本次覆盖内容

| 模块 | 内容 | 代码量 |
|------|------|--------|
| RESTful API 完整设计 | 13 个资源模块，50+ 端点 | ~200 行接口定义 |
| GraphQL Schema | 完整类型定义 + Query/Mutation/Subscription | ~400 行 |
| GraphQL 查询示例 | 6 个典型场景 | ~150 行 |
| OpenAPI 3.0 文档 | 完整 YAML 规范 | ~500 行 |
| 最佳实践 Checklist | REST/GraphQL/安全/性能 | ~100 行 |
| 面试高频题 | 5 道深度问答 | ~300 行 |

### 累计 API 设计训练

- **4/22** 基础版 (RESTful 原则 + GraphQL 入门)
- **4/23** 进阶版 (高级模式 + 错误处理)
- **4/26** 巩固版 (完整 API 设计 + 文档)
- **4/27** 生产级高级模式 (版本演进 + 幂等性)
- **4/28** 终极实战 (CloudBoard 完整 API + REST + GraphQL + OpenAPI)

**= 5 轮迭代，完整闭环 ✅**

### 核心设计原则 (一句话总结)

> **REST 做标准，GraphQL 做灵活，WebSocket 做实时，gRPC 做性能。API 设计不是选技术，而是选最适合业务场景的组合。**
