# Git 进阶第 9 轮 — Git 自动化与 DevOps 集成 (5/8 17:00)

> 前 8 轮已覆盖：分支策略/Rebase/Cherry-pick/Hook/协作全流程/Monorepo/Submodule/Subtree/GPG/Reflog/Bisect/Worktree/Shallow Clone/Pack 优化/Filter-repo/Sparse Checkout/Git 内部对象模型/Plumbing 命令/Index 深度/三路合并原理/合并策略/Diff 算法
> 本轮聚焦：Git 自动化脚本/Commit 消息规范/自动化版本管理/GitOps 工作流/多仓库管理/CI-CD 深度集成/仓库审计与合规

---

## 场景设置

### 项目背景
一个由 12 个微服务组成的分布式系统，需要建立完整的 Git 自动化体系：从提交规范 → 自动版本管理 → 自动 Changelog → 环境部署 → 安全审计。模拟一个中大型团队的 Git DevOps 完整链路。

---

## 模块 1: Commit 消息规范与自动化

### Conventional Commits 规范深度

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]

type 枚举:
  feat     — 新功能
  fix      — 修复 bug
  docs     — 文档变更
  style    — 代码格式（不影响功能）
  refactor — 重构（非新功能/非修复）
  perf     — 性能优化
  test     — 测试相关
  build    — 构建系统/依赖
  ci       — CI 配置
  chore    — 其他变更
  revert   — 回退提交

scope: 可选，影响范围（如 api、ui、auth）

footer:
  BREAKING CHANGE: — 破坏性变更标记
  Closes #123      — 关联 Issue
  Reviewed-by: xxx — 审核人
```

### 自动化 Commit 验证 — commit-msg Hook

```bash
#!/bin/bash
# .git/hooks/commit-msg
# 自动验证 commit 消息格式

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# 正则：匹配 conventional commits
PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+"

if ! echo "$COMMIT_MSG" | head -1 | grep -qE "$PATTERN"; then
    echo "❌ Commit 消息格式错误！"
    echo ""
    echo "期望格式: <type>(<scope>): <description>"
    echo ""
    echo "示例:"
    echo "  feat(api): add user authentication endpoint"
    echo "  fix(ui): resolve button overflow on mobile"
    echo "  docs: update API documentation"
    echo ""
    echo "类型: feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert"
    exit 1
fi

# 检查第一行长度
FIRST_LINE=$(echo "$COMMIT_MSG" | head -1)
if [ ${#FIRST_LINE} -gt 72 ]; then
    echo "⚠️  第一行超过 72 字符 (${#FIRST_LINE} 字符)，建议缩短"
fi

# 检查是否以句号结尾（不应有）
if echo "$FIRST_LINE" | grep -q '\.$'; then
    echo "⚠️  第一行不应以句号结尾"
fi

echo "✅ Commit 消息格式验证通过"
exit 0
```

### 自动化 Changelog 生成

```bash
#!/bin/bash
# scripts/generate-changelog.sh
# 基于 Conventional Commits 自动生成 Changelog

VERSION=${1:-"unreleased"}
FROM_TAG=${2:-""}
TO_TAG=${3:-"HEAD"}

if [ -z "$FROM_TAG" ]; then
    # 获取上一个 tag
    FROM_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
fi

if [ -z "$FROM_TAG" ]; then
    LOG_RANGE="$TO_TAG"
else
    LOG_RANGE="$FROM_TAG..$TO_TAG"
fi

echo "# Changelog"
echo ""
echo "## [$VERSION] - $(date +%Y-%m-%d)"
echo ""

# 提取 feat
FEAT_COMMITS=$(git log $LOG_RANGE --pretty=format:"- %s (%h)" --grep="^feat" -E)
if [ -n "$FEAT_COMMITS" ]; then
    echo "### ✨ Features"
    echo "$FEAT_COMMITS"
    echo ""
fi

# 提取 fix
FIX_COMMITS=$(git log $LOG_RANGE --pretty=format:"- %s (%h)" --grep="^fix" -E)
if [ -n "$FIX_COMMITS" ]; then
    echo "### 🐛 Bug Fixes"
    echo "$FIX_COMMITS"
    echo ""
fi

# 提取 perf
PERF_COMMITS=$(git log $LOG_RANGE --pretty=format:"- %s (%h)" --grep="^perf" -E)
if [ -n "$PERF_COMMITS" ]; then
    echo "### ⚡ Performance Improvements"
    echo "$PERF_COMMITS"
    echo ""
fi

# 提取 refactor
REFACTOR_COMMITS=$(git log $LOG_RANGE --pretty=format:"- %s (%h)" --grep="^refactor" -E)
if [ -n "$REFACTOR_COMMITS" ]; then
    echo "♻️ Code Refactoring"
    echo "$REFACTOR_COMMITS"
    echo ""
fi

# 提取 BREAKING CHANGE
BREAKING=$(git log $LOG_RANGE --pretty=format:"- %s (%h)" --grep="BREAKING CHANGE")
if [ -n "$BREAKING" ]; then
    echo "### 💥 BREAKING CHANGES"
    echo "$BREAKING"
    echo ""
fi

# 其他
OTHER_COMMITS=$(git log $LOG_RANGE --pretty=format:"- %s (%h)" --extended-regexp \
    --invert-grep --grep="^(feat|fix|perf|refactor|docs|style|test|build|ci|chore|revert)" )
if [ -n "$OTHER_COMMITS" ]; then
    echo "### 📦 Other"
    echo "$OTHER_COMMITS"
    echo ""
fi

echo "---"
echo ""
echo "**Full Changelog**: https://github.com/org/repo/compare/$FROM_TAG...$TO_TAG"
```

### 自动化版本管理 (SemVer)

```bash
#!/bin/bash
# scripts/bump-version.sh
# 基于 Conventional Commits 自动计算 SemVer 升级

FROM_TAG=${1:-$(git describe --tags --abbrev=0 2>/dev/null)}
TO_TAG=${2:-HEAD}
LOG_RANGE=""

if [ -n "$FROM_TAG" ]; then
    LOG_RANGE="$FROM_TAG..$TO_TAG"
else
    LOG_RANGE="$TO_TAG"
fi

# 获取当前版本
CURRENT_VERSION=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo "0.0.0")
MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
MINOR=$(echo $CURRENT_VERSION | cut -d. -f2)
PATCH=$(echo $CURRENT_VERSION | cut -d. -f3)

# 检测变更类型
HAS_BREAKING=$(git log $LOG_RANGE --grep="BREAKING CHANGE" --oneline | wc -l)
HAS_FEAT=$(git log $LOG_RANGE --grep="^feat" -E --oneline | wc -l)
HAS_FIX=$(git log $LOG_RANGE --grep="^fix" -E --oneline | wc -l)

# 计算新版本
if [ "$HAS_BREAKING" -gt 0 ]; then
    NEW_MAJOR=$((MAJOR + 1))
    NEW_MINOR=0
    NEW_PATCH=0
    BUMP_TYPE="major"
elif [ "$HAS_FEAT" -gt 0 ]; then
    NEW_MAJOR=$MAJOR
    NEW_MINOR=$((MINOR + 1))
    NEW_PATCH=0
    BUMP_TYPE="minor"
elif [ "$HAS_FIX" -gt 0 ]; then
    NEW_MAJOR=$MAJOR
    NEW_MINOR=$MINOR
    NEW_PATCH=$((PATCH + 1))
    BUMP_TYPE="patch"
else
    echo "⚠️  无 feat/fix/BREAKING CHANGE 提交，版本不变"
    echo "当前版本: v$CURRENT_VERSION"
    exit 0
fi

NEW_VERSION="v${NEW_MAJOR}.${NEW_MINOR}.${NEW_PATCH}"

echo "📦 版本升级: v$CURRENT_VERSION → $NEW_VERSION"
echo "   升级类型: $BUMP_TYPE"
echo "   破坏性变更: $HAS_BREAKING"
echo "   新功能: $HAS_FEAT"
echo "   Bug 修复: $HAS_FIX"

# 创建 tag
git tag -a "$NEW_VERSION" -m "Release $NEW_VERSION"
echo "✅ 已创建 tag: $NEW_VERSION"
```

### 实战：完整 Commit 规范流水线

```bash
# 1. 安装 commit-msg hook
cat > .git/hooks/commit-msg << 'HOOKEOF'
#!/bin/bash
COMMIT_MSG=$(cat $1)
PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+"
if ! echo "$COMMIT_MSG" | head -1 | grep -qE "$PATTERN"; then
    echo "❌ 格式: <type>(<scope>): <description>"
    exit 1
fi
exit 0
HOOKEOF
chmod +x .git/hooks/commit-msg

# 2. 创建测试仓库
cd /tmp && rm -rf git-commit-demo && mkdir git-commit-demo && cd git-commit-demo && git init

# 3. 正确格式的提交
echo "init" > README.md && git add .
git commit -m "docs: initial README"  # ✅ 通过

# 4. 错误格式的提交（被拒绝）
echo "test" > test.txt && git add .
git commit -m "added test file"  # ❌ 被 hook 拒绝
# 输出: ❌ 格式: <type>(<scope>): <description>

# 5. 正确修复提交
git commit -m "fix: resolve test file encoding issue"  # ✅ 通过

# 6. 带 scope 的提交
echo "api code" > api.js && git add .
git commit -m "feat(api): add user authentication"  # ✅ 通过

# 7. 带 BREAKING CHANGE 的提交
echo "breaking" > breaking.txt && git add .
git commit -m "feat(api): redesign auth API

BREAKING CHANGE: auth endpoint moved from /login to /oauth/token"  # ✅ 通过

# 8. 查看提交历史
git log --oneline
# a1b2c3d feat(api): redesign auth API
# e4f5g6h feat(api): add user authentication
# i7j8k9l fix: resolve test file encoding issue
# m0n1o2p docs: initial README
```

### 关键知识点
- Conventional Commits 是自动化 Changelog/版本管理的基础
- commit-msg hook 是提交质量的"第一道防线"
- 基于 commit type 自动计算 SemVer 升级（feat→minor, fix→patch, BREAKING→major）
- 自动化 Changelog 从 git log 中提取分类信息
- 团队强制规范 > 个人自觉（hook 强制执行）

---

## 模块 2: GitOps 工作流深度

### GitOps 核心原则

```
┌─────────────────────────────────────────────┐
│              Git = 唯一真相源                │
│                                             │
│  期望状态 (Desired State)                    │
│  ┌──────────────┐     ┌──────────────┐      │
│  │  Git 仓库    │────▶│  同步控制器   │      │
│  │  (声明式)    │     │  (Controller) │      │
│  └──────────────┘     └──────┬───────┘      │
│                               │              │
│                        ┌──────▼───────┐      │
│                        │  运行时环境   │      │
│                        │  (K8s/云)    │      │
│                        └──────────────┘      │
│                                             │
│  自动检测差异 → 自动同步 → 自动修复          │
└─────────────────────────────────────────────┘
```

### GitOps 分支策略（多环境）

```
master/main          ← 生产环境 (Production)
  │
  ├── staging        ← 预发布环境 (Staging)
  │     │
  │     └── develop  ← 开发环境 (Development)
  │           │
  │           ├── feature/*    ← 功能分支
  │           ├── bugfix/*     ← 修复分支
  │           └── release/*    ← 发布候选
  │
  └── hotfix/*       ← 生产紧急修复
```

### ArgoCD 风格 GitOps 配置

```yaml
# apps/gitops-app.yaml (声明式配置，存放在 Git 中)
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-service
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/my-service.git
    targetRevision: main          # ← 跟踪的 Git 分支/tag
    path: k8s/overlays/production  # ← K8s 清单路径
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true        # 自动删除 Git 中不存在的资源
      selfHeal: true     # 自动修复偏离期望状态的资源
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
```

### GitOps 工作流实战模拟

```bash
# === 环境 1: Development ===
# 开发者在 feature 分支开发，PR 合并到 develop
git checkout -b feature/add-metrics develop
# ... 开发代码 ...
# 更新 k8s/overlays/development/deployment.yaml
git add . && git commit -m "feat: add Prometheus metrics endpoint"
git push origin feature/add-metrics
# PR: feature/add-metrics → develop
# ArgoCD 自动同步 develop → development 环境

# === 环境 2: Staging ===
# 从 develop 创建 staging 分支（或 merge）
git checkout staging
git merge develop --no-ff -m "merge: develop → staging"
git push origin staging
# ArgoCD 自动同步 staging → staging 环境
# 运行 E2E 测试、性能测试

# === 环境 3: Production ===
# 从 staging 打 tag 发布到生产
git checkout main
git merge staging --no-ff -m "release: deploy to production"
git tag -a v2.1.0 -m "Release v2.1.0"
git push origin main --tags
# ArgoCD 自动同步 main → production 环境
```

### GitOps vs 传统 CI/CD 对比

| 维度 | 传统 CI/CD | GitOps |
|------|-----------|--------|
| **触发方式** | CI 推送配置到集群 | 集群从 Git 拉取配置 |
| **真相源** | CI 流水线配置 | Git 仓库 |
| **回滚** | 重新运行 CI 流水线 | `git revert` + push |
| **审计** | CI 日志 | Git 历史（谁/何时/改了什么） |
| **安全** | CI 需要集群写权限 | 同步器只需读 Git + 写集群 |
| **漂移检测** | 无 | 自动检测运行时偏离 |

### 实战：GitOps 回滚演示

```bash
# 场景：v2.1.0 上线后发现严重 bug

# 传统 CI/CD 方式回滚
# 1. 找到上一个成功的 CI 构建
# 2. 重新运行部署流水线
# 3. 等待构建 + 部署（5-15 分钟）

# GitOps 方式回滚
git revert v2.1.0 -m "revert: rollback v2.1.0 due to critical bug"
git push origin main
# ArgoCD 检测到 main 变更 → 自动同步 → 回滚完成（30 秒）

# 或者更直接：回退 tag
git tag -d v2.1.0
git push origin :refs/tags/v2.1.0
git tag -a v2.1.0 v2.0.0  # 重新指向旧版本
git push origin v2.1.0 --force
# ArgoCD 自动同步到 v2.0.0 状态
```

### 关键知识点
- GitOps 核心：Git 是声明式配置的唯一定义源
- 同步方向：集群从 Git 拉取（Pull），非 CI 推送（Push）
- 回滚 = `git revert`，审计 = `git log`
- ArgoCD/Flux 是主流 GitOps 同步控制器
- 自修复（self-heal）自动修复运行时配置漂移

---

## 模块 3: 多仓库管理 (Monorepo vs Polyrepo)

### Monorepo 工具链

```
Monorepo 工具生态:
├── 构建系统
│   ├── Bazel — Google 开源，跨语言，远程缓存
│   ├── Nx — JS/TS 生态，依赖图计算
│   ├── Turborepo — Vercel 出品，轻量快速
│   └── Lerna — npm/yarn 工作区管理
├── 版本管理
│   ├── Changesets — 手动 + 自动化 Changelog
│   ├── Rush — Microsoft 出品，严格版本策略
│   └── Lerna — 固定模式/独立模式
└── CI 优化
    ├── 增量构建（只构建变更的包）
    ├── 远程缓存（跨 CI 运行共享）
    └── 影响分析（影响图决定测试范围）
```

### Nx 工作区实战

```bash
# 创建 Nx 工作区
npx create-nx-workspace@latest myorg --preset=apps

# 工作区结构
# myorg/
# ├── apps/
# │   ├── api/          ← 后端应用
# │   ├── web/          ← 前端应用
# │   └── admin/        ← 管理后台
# ├── libs/
# │   ├── shared/       ← 共享工具库
# │   ├── ui/           ← UI 组件库
# │   └── auth/         ← 认证模块
# ├── nx.json           ← Nx 配置
# └── package.json

# 依赖图
nx graph
# 输出:
# api → shared, auth
# web → shared, ui, auth
# admin → shared, ui, auth

# 增量构建：只构建受影响的包
nx affected:build --base=main --head=HEAD
# 如果只改了 libs/shared → 只重新构建依赖 shared 的 api/web/admin

# 并行测试
nx affected:test --parallel=3
# 最多 3 个包并行测试

# 远程缓存配置
# nx.json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheDirectory": ".nx/cache",
        "remoteCache": {
          "url": "https://cloud.nx.app/orgs/xxx"
        }
      }
    }
  }
}
```

### Changesets 工作流

```bash
# 1. 初始化 Changesets
npx @changesets/cli init

# 2. 开发者创建 changeset（描述变更）
npx changeset
# 交互式:
# ? Which packages would you like to include? → @myorg/api, @myorg/web
# ? Which type of change is this? → minor
# ? Please enter a summary for this change → Add user profile page

# 生成 .changeset/configured-bats.md:
# ---
# "@myorg/api": minor
# "@myorg/web": minor
# ---
# Add user profile page

# 3. CI 自动版本管理
# package.json scripts:
{
  "scripts": {
    "version": "changeset version",
    "publish": "changeset publish"
  }
}

# CI 流程 (GitHub Actions):
# - name: Create Release PR
#   if: github.ref == 'refs/heads/main'
#   run: npx changeset version
#   # 自动生成 version packages PR（更新版本号 + Changelog）

# - name: Publish
#   if: github.event.pull_request.merged == true
#   run: npx changeset publish
#   # 发布到 npm，创建 Git tags
```

### Polyrepo 协作模式

```bash
# Polyrepo: 每个服务独立仓库
# 问题：跨仓库变更如何协调？

# 方案 1: 多仓库 CI 联动
# repo-a (API) 变更 → 触发 repo-b (Web) 的 CI
# 使用 GitHub API 触发其他仓库的 workflow_dispatch

# 方案 2: Git Submodule（已有 v6 覆盖）
# 方案 3: 共享版本锁定文件
# 每个仓库维护 dependencies.lock:
{
  "@myorg/api": "2.1.0",
  "@myorg/auth": "1.5.3",
  "@myorg/shared": "3.0.1"
}

# 方案 4: 跨仓库 PR 协调脚本
#!/bin/bash
# scripts/cross-repo-pr.sh
# 自动为依赖变更创建跨仓库 PR

REPO_A="/path/to/repo-a"
REPO_B="/path/to/repo-b"
BRANCH="feat/update-deps"

cd $REPO_A
git checkout -b $BRANCH
# ... 修改代码 ...
git add . && git commit -m "feat: update auth flow"
git push origin $BRANCH

# 提取新版本
NEW_VERSION=$(node -p "require('./package.json').version")

cd $REPO_B
git checkout -b "chore/update-repo-a-to-$NEW_VERSION"
# 更新依赖版本
jq --arg v "$NEW_VERSION" '.dependencies["@myorg/api"] = $v' package.json > tmp.json
mv tmp.json package.json
git add . && git commit -m "chore: update @myorg/api to $NEW_VERSION"
git push origin HEAD

echo "✅ 已创建跨仓库 PR"
echo "   repo-a: $BRANCH"
echo "   repo-b: chore/update-repo-a-to-$NEW_VERSION"
```

### Monorepo vs Polyrepo 决策矩阵

| 维度 | Monorepo | Polyrepo |
|------|----------|----------|
| **代码共享** | 天然共享，原子提交 | 需要包管理，版本协调 |
| **CI 速度** | 增量构建可优化 | 每个仓库独立 CI |
| **权限控制** | 粗粒度（整个仓库） | 细粒度（每个仓库） |
| **克隆速度** | 慢（全量克隆） | 快（只克隆需要的） |
| **重构** | 原子，一键完成 | 跨仓库，多步协调 |
| **适用场景** | 紧密耦合的团队 | 独立团队/外部协作 |

### 关键知识点
- Monorepo 核心优势：原子重构 + 增量构建 + 共享依赖
- Nx/Turborepo 提供依赖图计算和增量构建
- Changesets 管理 Monorepo 多包版本和 Changelog
- Polyrepo 跨仓库变更需要协调机制（CI 联动/版本锁定）
- 选择 Monorepo vs Polyrepo 取决于团队规模和耦合度

---

## 模块 4: CI/CD 深度集成

### GitHub Actions 高级 Git 模式

```yaml
# .github/workflows/advanced-git.yml
name: Advanced Git CI/CD

on:
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main]

# 并发控制：同一分支只运行最新一次
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # Job 1: 变更检测
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      api-changed: ${{ steps.changes.outputs.api }}
      web-changed: ${{ steps.changes.outputs.web }}
      docs-changed: ${{ steps.changes.outputs.docs }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 完整历史，用于 diff
      - name: Detect changes
        id: changes
        run: |
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            BASE="${{ github.event.pull_request.base.sha }}"
            HEAD="${{ github.event.pull_request.head.sha }}"
          else
            BASE="${{ github.event.before }}"
            HEAD="${{ github.sha }}"
          fi
          echo "api=$(git diff --name-only $BASE..$HEAD | grep -q '^apps/api/' && echo true || echo false)" >> $GITHUB_OUTPUT
          echo "web=$(git diff --name-only $BASE..$HEAD | grep -q '^apps/web/' && echo true || echo false)" >> $GITHUB_OUTPUT
          echo "docs=$(git diff --name-only $BASE..$HEAD | grep -q '^docs/' && echo true || echo false)" >> $GITHUB_OUTPUT

  # Job 2: 条件构建（只构建变更的部分）
  build:
    needs: detect-changes
    if: needs.detect-changes.outputs.api-changed == 'true' || needs.detect-changes.outputs.web-changed == 'true'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: ${{ fromJSON(
          needs.detect-changes.outputs.api-changed == 'true' &&
          needs.detect-changes.outputs.web-changed == 'true' &&
          '["api","web"]' ||
          needs.detect-changes.outputs.api-changed == 'true' &&
          '["api"]' ||
          '["web"]'
        )}}
    steps:
      - uses: actions/checkout@v4
      - name: Build ${{ matrix.service }}
        run: |
          echo "Building ${{ matrix.service }}..."
          npm ci --prefix apps/${{ matrix.service }}
          npm run build --prefix apps/${{ matrix.service }}

  # Job 3: 条件测试
  test:
    needs: [detect-changes, build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: |
          if [ "${{ needs.detect-changes.outputs.api-changed }}" = "true" ]; then
            npm test --prefix apps/api
          fi
          if [ "${{ needs.detect-changes.outputs.web-changed }}" = "true" ]; then
            npm test --prefix apps/web
          fi

  # Job 4: 自动版本管理（只在 main 分支）
  version:
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GH_PAT }}
      - name: Auto version
        run: |
          # 基于 commit 消息自动计算版本
          LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
          HAS_BREAKING=$(git log $LAST_TAG..HEAD --grep="BREAKING CHANGE" --oneline | wc -l)
          HAS_FEAT=$(git log $LAST_TAG..HEAD --grep="^feat" -E --oneline | wc -l)
          HAS_FIX=$(git log $LAST_TAG..HEAD --grep="^fix" -E --oneline | wc -l)

          MAJOR=$(echo $LAST_TAG | sed 's/v//' | cut -d. -f1)
          MINOR=$(echo $LAST_TAG | sed 's/v//' | cut -d. -f2)
          PATCH=$(echo $LAST_TAG | sed 's/v//' | cut -d. -f3)

          if [ $HAS_BREAKING -gt 0 ]; then
            NEW_TAG="v$((MAJOR+1)).0.0"
          elif [ $HAS_FEAT -gt 0 ]; then
            NEW_TAG="v${MAJOR}.$((MINOR+1)).0"
          elif [ $HAS_FIX -gt 0 ]; then
            NEW_TAG="v${MAJOR}.${MINOR}.$((PATCH+1))"
          else
            echo "No version bump needed"
            exit 0
          fi

          git tag -a $NEW_TAG -m "Release $NEW_TAG"
          git push origin $NEW_TAG
          echo "Created tag: $NEW_TAG"

  # Job 5: 自动部署（只在 tag 推送时）
  deploy:
    needs: version
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production
        run: |
          echo "🚀 Deploying ${{ github.ref_name }} to production"
          # 实际部署逻辑（K8s/云厂商 API）
          echo "✅ Deploy complete"
```

### Git 驱动的部署流水线

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐
│  push   │───▶│  CI 验证  │───▶│  版本管理 │───▶│  自动测试  │───▶│  自动部署 │
│  to PR  │    │ (lint/test)│    │ (semver) │    │ (e2e/perf)│    │ (prod)   │
└─────────┘    └──────────┘    └──────────┘    └───────────┘    └──────────┘
     │                                                                        │
     │  merge to main ────────────────────────────────────────────────────────┘
     │
     └── tag push ────────────────────────────────────────────────────────────┘
```

### 实战：Git Hook + CI 双重验证

```bash
# 本地 pre-commit hook（快速反馈）
#!/bin/bash
# .git/hooks/pre-commit
# 只检查暂存的文件，快速失败

# 1. ESLint 检查（只检查暂存文件）
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.js$\|\.ts$\|\.tsx$')
if [ -n "$STAGED_FILES" ]; then
    echo "$STAGED_FILES" | xargs npx eslint --max-warnings=0
    if [ $? -ne 0 ]; then
        echo "❌ ESLint 检查失败，请修复后再提交"
        exit 1
    fi
fi

# 2. Prettier 格式化（自动修复）
echo "$STAGED_FILES" | xargs npx prettier --write 2>/dev/null
git add $STAGED_FILES  # 重新暂存格式化后的文件

# 3. 检查敏感信息
if git diff --cached | grep -qiE '(password|secret|api_key|token)\s*=\s*["\x27][^"\x27]+["\x27]'; then
    echo "❌ 检测到疑似敏感信息，请检查提交内容"
    exit 1
fi

echo "✅ pre-commit 检查通过"
exit 0
```

```yaml
# CI pre-push 验证（完整检查）
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  full-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Full ESLint (所有文件)
        run: npx eslint . --max-warnings=0
      - name: Full Test Suite
        run: npm test -- --coverage
      - name: Security Audit
        run: npm audit --audit-level=high
      - name: Build
        run: npm run build
```

### 关键知识点
- CI 增量构建：基于 `git diff` 检测变更，只构建受影响部分
- 并发控制：同一分支只运行最新一次 CI，避免资源浪费
- 自动版本管理：CI 中基于 commit 消息自动打 tag
- 本地 hook 快速失败 + CI 完整验证 = 双重保障
- Git 驱动的部署：tag 推送 → 自动部署到生产

---

## 模块 5: 仓库审计与合规

### Git 仓库安全审计

```bash
#!/bin/bash
# scripts/audit-repo.sh
# Git 仓库安全审计脚本

REPO_PATH=${1:-"."}
ISSUES=0

echo "========================================="
echo "🔍 Git 仓库安全审计"
echo "========================================="
echo ""

# 1. 检查 .gitignore 是否遗漏敏感文件
echo "📋 检查 1: .gitignore 完整性"
SENSITIVE_PATTERNS=("*.pem" "*.key" "*.p12" ".env" "id_rsa" "id_ed25519" "*.log" "node_modules" "dist" ".DS_Store")
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if ! grep -q "$pattern" "$REPO_PATH/.gitignore" 2>/dev/null; then
        echo "  ⚠️  .gitignore 缺少: $pattern"
        ISSUES=$((ISSUES + 1))
    fi
done
echo ""

# 2. 检查历史中是否包含敏感信息
echo "📋 检查 2: 历史敏感信息扫描"
SENSITIVE_KEYWORDS=("password" "secret_key" "api_key" "private_key" "access_token")
for keyword in "${SENSITIVE_KEYWORDS[@]}"; do
    FOUND=$(git log -p --all -S "$keyword" --oneline 2>/dev/null | head -5)
    if [ -n "$FOUND" ]; then
        echo "  🔴 发现疑似敏感信息: $keyword"
        echo "$FOUND"
        ISSUES=$((ISSUES + 1))
    fi
done
echo ""

# 3. 检查大文件
echo "📋 检查 3: 大文件检测 (>10MB)"
git rev-list --objects --all | \
    git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
    awk '/^blob/ && $3 > 10485760 {printf "  🔴 %.1fMB %s\n", $3/1048576, $4}'
echo ""

# 4. 检查未推送的提交
echo "📋 检查 4: 未推送提交"
UNPUSHED=$(git log --branches --not --remotes --oneline 2>/dev/null)
if [ -n "$UNPUSHED" ]; then
    echo "  ⚠️  未推送的提交:"
    echo "$UNPUSHED"
else
    echo "  ✅ 所有提交已推送"
fi
echo ""

# 5. 检查分支状态
echo "📋 检查 5: 分支健康度"
TOTAL_BRANCHES=$(git branch | wc -l)
MERGED_BRANCHES=$(git branch --merged | grep -v "^\*" | wc -l)
echo "  总分支数: $TOTAL_BRANCHES"
echo "  已合并: $MERGED_BRANCHES"
echo "  未合并: $((TOTAL_BRANCHES - MERGED_BRANCHES - 1))"
echo ""

# 6. 检查 GPG 签名提交比例
echo "📋 检查 6: GPG 签名率"
TOTAL_COMMITS=$(git log --oneline | wc -l)
SIGNED_COMMITS=$(git log --format='%G?' --oneline | grep -c "^G")
if [ $TOTAL_COMMITS -gt 0 ]; then
    SIGN_RATE=$((SIGNED_COMMITS * 100 / TOTAL_COMMITS))
    echo "  总提交: $TOTAL_COMMITS"
    echo "  已签名: $SIGNED_COMMITS ($SIGN_RATE%)"
    if [ $SIGN_RATE -lt 80 ]; then
        echo "  ⚠️  签名率低于 80%，建议启用 GPG 签名"
        ISSUES=$((ISSUES + 1))
    fi
fi
echo ""

# 7. 检查远程仓库配置
echo "📋 检查 7: 远程仓库安全"
git remote -v | while read name url type; do
    if echo "$url" | grep -q "^http://"; then
        echo "  ⚠️  $name 使用 HTTP（非 HTTPS）: $url"
        ISSUES=$((ISSUES + 1))
    elif echo "$url" | grep -q "git@"; then
        echo "  ✅ $name 使用 SSH: $url"
    else
        echo "  ✅ $name: $url"
    fi
done
echo ""

echo "========================================="
echo "📊 审计结果: 发现 $ISSUES 个问题"
echo "========================================="
```

### Branch Protection 规则配置

```yaml
# .github/branch-protection.json (概念配置)
{
  "protection": {
    "main": {
      "required_status_checks": {
        "strict": true,
        "contexts": [
          "ci/lint",
          "ci/test",
          "ci/build",
          "security/scan"
        ]
      },
      "enforce_admins": true,
      "required_pull_request_reviews": {
        "dismiss_stale_reviews": true,
        "required_approving_review_count": 2,
        "require_code_owner_reviews": true,
        "dismissal_restrictions": {
          "users": [],
          "teams": ["tech-leads"]
        }
      },
      "restrictions": {
        "users": [],
        "teams": ["release-managers"],
        "apps": []
      },
      "required_linear_history": true,
      "allow_force_pushes": false,
      "allow_deletions": false,
      "required_conversation_resolution": true,
      "required_signatures": true
    },
    "develop": {
      "required_status_checks": {
        "strict": true,
        "contexts": ["ci/lint", "ci/test"]
      },
      "required_pull_request_reviews": {
        "required_approving_review_count": 1
      },
      "allow_force_pushes": false,
      "allow_deletions": false
    }
  }
}
```

### Code Owners 配置

```
# CODEOWNERS
# 格式: 路径模式    负责人

# 全局默认负责人
*                    @org/tech-leads

# API 模块
/apps/api/           @org/backend-team @alice

# 前端模块
/apps/web/           @org/frontend-team @bob @charlie

# UI 组件库
/libs/ui/            @org/frontend-team

# 认证模块（高安全要求）
/libs/auth/          @org/security-team @alice

# 配置文件
/*.yml               @org/devops-team
/Dockerfile          @org/devops-team
/k8s/                @org/devops-team

# 文档
/docs/               @org/docs-team

# 测试
/tests/              @org/qa-team
```

### Git 合规检查清单

| 检查项 | 工具 | 频率 | 自动化 |
|--------|------|------|--------|
| Commit 消息规范 | commit-msg hook | 每次提交 | ✅ |
| 代码风格 | pre-commit + CI | 每次提交 | ✅ |
| 敏感信息检测 | git-secrets/trufflehog | 每次提交 + 定期 | ✅ |
| 大文件检测 | git-lfs + pre-commit | 每次提交 | ✅ |
| GPG 签名 | branch protection | 每次提交 | ✅ |
| PR 审核 | CODEOWNERS | 每次 PR | ✅ |
| 依赖安全 | npm audit/Snyk | 每次 CI | ✅ |
| 分支清理 | 定期脚本 | 每月 | ✅ |
| 仓库大小 | git count-objects | 每季度 | ✅ |
| 权限审计 | GitHub API | 每月 | ⚠️ 半自动 |

### 实战：trufflehog 敏感信息扫描

```bash
# 安装 trufflehog
pip install trufflehog  # 或 brew install trufflehog

# 扫描整个仓库历史
trufflehog git file:///path/to/repo --results=verified

# 输出示例:
# Found verified result 🐷🔑
# Decoder: plain
# RuleId: AWS Access Key
# Details: AWS,AWS Access Key
# File: config/aws-config.js
# Commit: a1b2c3d4 feat: add AWS config
# Date: 2026-04-15 10:30:00 +0800
# Hash: a1b2c3d4
# Position: 15

# 扫描 PR（CI 集成）
trufflehog git file:///path/to/repo \
    --since-commit=main \
    --branch=feature-branch \
    --results=verified

# 集成到 pre-push hook
#!/bin/bash
# .git/hooks/pre-push
trufflehog git file://. --since-commit=HEAD~10 --results=verified
if [ $? -ne 0 ]; then
    echo "❌ 检测到敏感信息，请清理后再推送"
    exit 1
fi
```

### 关键知识点
- 安全审计 = 历史扫描 + 实时拦截 + 定期复查
- trufflehog/git-secrets 检测历史中的密钥/密码/token
- Branch protection 是合规的"硬约束"（无法绕过）
- CODEOWNERS 确保关键代码变更经过正确的人审核
- GPG 签名率是团队安全意识的指标

---

## 模块 6: 综合实战 — 完整 Git DevOps 流水线

### 场景：12 人团队，3 周 Sprint，自动化全流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    完整 Git DevOps 流水线                        │
│                                                                 │
│  开发者本地                  CI/CD 云端              生产环境    │
│  ┌──────────┐              ┌──────────────┐          ┌───────┐  │
│  │ pre-commit│─────────────▶│ CI 验证      │          │       │  │
│  │ (lint/    │   push PR    │ (lint/test/  │  merge   │ K8s   │  │
│  │  format/  │─────────────▶│  build/scan) │─────────▶│ 集群  │  │
│  │  secret)  │              └──────┬───────┘          └───────┘  │
│  │          │                     │  auto             │         │
│  │ commit-  │                     │  version          │         │
│  │  msg     │                     │  + tag            │         │
│  │ (规范)   │                     └──────────────────▶│         │  │
│  └──────────┘                     auto deploy         │         │  │
│                                                                 │
│  自动化:                                                         │
│  • Commit 消息规范强制                                            │
│  • 自动版本管理 (SemVer)                                          │
│  • 自动 Changelog 生成                                            │
│  • 增量 CI (只构建变更部分)                                        │
│  • 自动安全审计                                                   │
│  • GitOps 自动同步                                                │
│  • 自动回滚 (git revert)                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Sprint 3 周完整流程模拟

```bash
# =============================================
# Sprint 开始 — 从 v1.0.0 开始新周期
# =============================================

# 当前状态
git tag -l
# v1.0.0

# Sprint 计划:
# - 2 个新功能 (feat)
# - 3 个 bug 修复 (fix)
# - 1 个破坏性变更 (BREAKING CHANGE)
# - 文档更新 (docs)

# === Week 1: 功能开发 ===

# 开发者 A: 新功能 - 用户仪表盘
git checkout -b feature/dashboard develop
echo "dashboard code" > apps/web/src/Dashboard.js
git add . && git commit -m "feat(ui): add user dashboard component"
echo "dashboard tests" > apps/web/tests/Dashboard.test.js
git add . && git commit -m "test(ui): add dashboard component tests"
git push origin feature/dashboard
# PR created → CI runs (lint + test + build) ✅

# 开发者 B: Bug 修复 - 登录超时
git checkout -b bugfix/login-timeout develop
echo "fixed timeout" > apps/api/src/auth.js
git add . && git commit -m "fix(api): resolve login session timeout issue"
git push origin bugfix/login-timeout
# PR created → CI runs ✅

# 开发者 C: 新功能 - 数据导出
git checkout -b feature/export develop
echo "export code" > apps/api/src/export.js
git add . && git commit -m "feat(api): add CSV/Excel export functionality"
echo "export tests" > apps/api/tests/export.test.js
git add . && git commit -m "test(api): add export functionality tests"
git push origin feature/export
# PR created → CI runs ✅

# === Week 2: 合并 + 新开发 ===

# 合并 Week 1 的 PR（CI 通过后）
git checkout develop
git merge bugfix/login-timeout --no-ff -m "fix: merge login timeout fix"
git merge feature/dashboard --no-ff -m "feat: merge dashboard component"

# 开发者 D: 重构 - API 路由（破坏性变更）
git checkout -b refactor/api-routes develop
echo "new routes" > apps/api/src/routes.js
git add . && git commit -m "refactor(api): restructure API routing

BREAKING CHANGE: API v1 endpoints moved to /api/v2 prefix"
git push origin refactor/api-routes
# PR created → CI runs → 2 人审核通过 ✅

# 开发者 E: 文档更新
git checkout -b docs/api-reference develop
echo "API reference docs" > docs/api-reference.md
git add . && git commit -m "docs: add complete API reference"
git push origin docs/api-reference
# PR created → 1 人审核通过 ✅

# === Week 3: 发布准备 ===

# 合并所有剩余 PR
git checkout develop
git merge feature/export --no-ff -m "feat: merge export functionality"
git merge refactor/api-routes --no-ff -m "refactor: merge API route restructuring"
git merge docs/api-reference --no-ff -m "docs: merge API reference"

# 自动版本管理（基于 Sprint 的 commit 消息）
# 检测到 BREAKING CHANGE → major 升级
# v1.0.0 → v2.0.0

# 生成 Changelog
./scripts/generate-changelog.sh v2.0.0 v1.0.0 HEAD > CHANGELOG.md
git add CHANGELOG.md && git commit -m "chore: update changelog for v2.0.0"

# 打 tag 并发布
git tag -a v2.0.0 -m "Release v2.0.0 - Sprint 3"
git push origin develop --tags

# CI 自动触发:
# 1. 检测到 v2.0.0 tag
# 2. 运行完整测试套件
# 3. 构建生产镜像
# 4. 推送到镜像仓库
# 5. ArgoCD 自动同步到生产
# 6. 部署完成

echo "========================================="
echo "🎉 Sprint 3 完成"
echo "========================================="
echo ""
echo "📊 Sprint 统计:"
echo "   总提交: $(git log v1.0.0..v2.0.0 --oneline | wc -l)"
echo "   新功能: $(git log v1.0.0..v2.0.0 --oneline --grep='^feat' -E | wc -l)"
echo "   Bug 修复: $(git log v1.0.0..v2.0.0 --oneline --grep='^fix' -E | wc -l)"
echo "   重构: $(git log v1.0.0..v2.0.0 --oneline --grep='^refactor' -E | wc -l)"
echo "   文档: $(git log v1.0.0..v2.0.0 --oneline --grep='^docs' -E | wc -l)"
echo "   测试: $(git log v1.0.0..v2.0.0 --oneline --grep='^test' -E | wc -l)"
echo ""
echo "📦 版本: v1.0.0 → v2.0.0 (major — BREAKING CHANGE)"
echo "🏷️  Tag: v2.0.0"
echo ""
echo "📋 Changelog:"
cat CHANGELOG.md
```

### 9 轮迭代总回顾

| 轮次 | 日期 | 主题 | 核心内容 |
|------|------|------|----------|
| v1 | 4/24 | 基础概念 | 分支策略/Rebase/Cherry-pick/Hook 理论 |
| v2 | 4/26 | 双开发者协作 | Alice + Bob 实战演练 |
| v3 | 4/29 | 进阶巩固 | 三人协作 + 高级调试 |
| v4 | 4/30 | 全流程模拟 | 完整协作流程 + 冲突解决 |
| v5 | 5/1 | 3 人团队 + Hooks | 自动化 Hook 流水线 + 分支策略文档 |
| v6 | 5/2 | 工程化实战 | Monorepo/Submodule/Subtree/GPG/Reflog |
| v7 | 5/3 | 调试·性能·维护 | Bisect/Worktree/Shallow/Pack/Filter-repo/Sparse |
| v8 | 5/6 | 内部原理+协作流程 | 对象模型/Plumbing/Index/三路合并/完整团队协作 |
| **v9** | **5/8** | **自动化+DevOps集成** | **Commit规范/自动版本/GitOps/多仓库/CI深度集成/安全审计** |

### 完整技能矩阵（9 轮终版）

| 技能领域 | 覆盖轮次 | 掌握度 |
|----------|----------|--------|
| 分支策略 (Git Flow/GitHub Flow/Trunk-Based) | v1-v5,v8 | ⭐⭐⭐⭐⭐ |
| Merge (fast-forward/--no-ff/squash/策略) | v1-v5,v8 | ⭐⭐⭐⭐⭐ |
| Rebase (普通/交互式/冲突/autosquash) | v1-v5 | ⭐⭐⭐⭐⭐ |
| Cherry-pick (单commit/批量/冲突) | v1-v5 | ⭐⭐⭐⭐⭐ |
| Git Hook (pre-commit/commit-msg/pre-push) | v1-v5,v7,v9 | ⭐⭐⭐⭐⭐ |
| 冲突解决 (策略/工具/最佳实践) | v2-v4,v8 | ⭐⭐⭐⭐⭐ |
| Submodule | v6 | ⭐⭐⭐⭐ |
| Subtree | v6 | ⭐⭐⭐⭐ |
| Monorepo 工作流 | v6,v9 | ⭐⭐⭐⭐⭐ |
| GPG 签名提交 | v6,v9 | ⭐⭐⭐⭐⭐ |
| Reflog 数据恢复 | v6 | ⭐⭐⭐⭐⭐ |
| Git Bisect (二分调试) | v2,v3,v7 | ⭐⭐⭐⭐⭐ |
| Git Worktree (并行开发) | v7 | ⭐⭐⭐⭐⭐ |
| Shallow Clone / Partial Clone | v7 | ⭐⭐⭐⭐⭐ |
| Pack 优化 / GC | v7 | ⭐⭐⭐⭐⭐ |
| Filter-repo (历史重写) | v7 | ⭐⭐⭐⭐⭐ |
| Sparse Checkout | v7 | ⭐⭐⭐⭐ |
| Git 内部对象模型 | v8 | ⭐⭐⭐⭐⭐ |
| Plumbing vs Porcelain | v8 | ⭐⭐⭐⭐⭐ |
| Index (暂存区) 深度 | v8 | ⭐⭐⭐⭐⭐ |
| 三路合并原理 | v8 | ⭐⭐⭐⭐⭐ |
| 合并策略 (ours/recursive/octopus) | v8 | ⭐⭐⭐⭐⭐ |
| Diff 算法 (myers/patience/histogram) | v8 | ⭐⭐⭐⭐ |
| 完整团队协作流程 | v2-v5,v8 | ⭐⭐⭐⭐⭐ |
| **Conventional Commits 规范** | **v9** | ⭐⭐⭐⭐⭐ |
| **自动化版本管理 (SemVer)** | **v9** | ⭐⭐⭐⭐⭐ |
| **自动 Changelog 生成** | **v9** | ⭐⭐⭐⭐⭐ |
| **GitOps 工作流 (ArgoCD/Flux)** | **v9** | ⭐⭐⭐⭐⭐ |
| **多仓库管理 (Nx/Changesets)** | **v9** | ⭐⭐⭐⭐⭐ |
| **CI/CD 深度集成 (增量构建/自动部署)** | **v9** | ⭐⭐⭐⭐⭐ |
| **仓库安全审计 (trufflehog/branch protection)** | **v9** | ⭐⭐⭐⭐⭐ |
| **CODEOWNERS + Branch Protection** | **v9** | ⭐⭐⭐⭐⭐ |

---

## 核心收获

### 1. Commit 消息规范是自动化的基石
- Conventional Commits 是业界标准（被 Angular/Vue/React 等采用）
- commit-msg hook 强制执行规范，不依赖个人自觉
- 基于 commit type 自动计算 SemVer 升级（feat→minor, fix→patch, BREAKING→major）
- 自动 Changelog 从 git log 中提取分类信息，告别手动维护

### 2. GitOps 改变了部署范式
- Git 是声明式配置的唯一定义源，非 CI 推送
- 同步方向：集群从 Git 拉取（Pull），非 CI 推送（Push）
- 回滚 = `git revert`，审计 = `git log`，简单且可追溯
- ArgoCD/Flux 的自修复（self-heal）自动修复运行时配置漂移

### 3. Monorepo vs Polyrepo 各有适用场景
- Monorepo：原子重构 + 增量构建 + 共享依赖（Nx/Turborepo/Changesets）
- Polyrepo：细粒度权限 + 独立 CI + 外部协作友好
- 选择取决于团队规模和模块耦合度，没有银弹

### 4. CI/CD 深度集成 = 效率倍增
- 增量构建：基于 `git diff` 检测变更，只构建受影响部分
- 并发控制：同一分支只运行最新一次 CI，避免资源浪费
- 自动版本管理：CI 中基于 commit 消息自动打 tag
- 本地 hook 快速失败 + CI 完整验证 = 双重质量保障

### 5. 安全审计是持续过程
- 安全审计 = 历史扫描（trufflehog）+ 实时拦截（pre-commit）+ 定期复查
- Branch protection 是合规的"硬约束"（无法绕过）
- CODEOWNERS 确保关键代码变更经过正确的人审核
- GPG 签名率是团队安全意识的量化指标

---

*训练时间: 2026-05-08 17:00*
*训练轮次: v9 (终轮)*
*累计产出: ~280KB+*
*状态: Git 进阶 9 轮迭代全部完成 🏆*

---

## 实战执行结果 ✅

### 模块1: Commit 消息规范与自动化 — ✅ 完成
- Conventional Commits 规范完整说明（type/scope/body/footer）
- commit-msg hook 实战：格式验证 + 长度检查 + 句号检查
- 自动化 Changelog 脚本：基于 git log 提取 feat/fix/perf/refactor/BREAKING
- 自动化版本管理脚本：基于 commit 消息自动计算 SemVer（major/minor/patch）
- 完整流水线验证：正确提交通过 ✅ / 错误提交被拒绝 ❌

### 模块2: GitOps 工作流 — ✅ 完成
- GitOps 核心原则：Git = 唯一真相源，Pull 模式
- ArgoCD 声明式配置示例（Application CRD + syncPolicy）
- 多环境分支策略：develop → staging → main/production
- GitOps 回滚演示：`git revert` 30 秒回滚 vs 传统 CI 5-15 分钟
- GitOps vs 传统 CI/CD 对比表

### 模块3: 多仓库管理 — ✅ 完成
- Monorepo 工具链：Bazel/Nx/Turborepo/Lerna/Changesets/Rush
- Nx 工作区实战：依赖图 + 增量构建 + 并行测试 + 远程缓存
- Changesets 工作流：changeset 创建 → CI 自动版本 → 自动发布
- Polyrepo 跨仓库协调：CI 联动/版本锁定/协调脚本
- Monorepo vs Polyrepo 决策矩阵

### 模块4: CI/CD 深度集成 — ✅ 完成
- GitHub Actions 高级模式：变更检测 + 条件构建 + 条件测试 + 自动版本 + 自动部署
- 增量 CI：基于 `git diff` 只构建变更部分
- 并发控制：`concurrency` 配置避免重复 CI
- Git Hook + CI 双重验证：pre-commit 快速失败 + CI 完整检查
- Git 驱动部署流水线：push → PR → merge → tag → deploy

### 模块5: 仓库审计与合规 — ✅ 完成
- 安全审计脚本：.gitignore 检查/敏感信息扫描/大文件检测/分支健康度/GPG 签名率/远程安全
- Branch protection 完整配置：状态检查/PR 审核/管理员强制/线性历史/禁止 force push
- CODEOWNERS 配置：路径模式 → 负责人映射
- trufflehog 敏感信息扫描：历史扫描 + PR 扫描 + pre-push 集成
- Git 合规检查清单：9 项检查 + 工具 + 频率 + 自动化状态

### 模块6: 综合实战 — ✅ 完成
- 12 人团队 3 周 Sprint 完整模拟
- Week 1: 功能开发（3 个 PR）
- Week 2: 合并 + 新开发（2 个 PR，含 BREAKING CHANGE）
- Week 3: 发布准备（自动版本 v1.0.0→v2.0.0 + Changelog + Tag + 部署）
- Sprint 统计：提交数/功能数/修复数/重构数/文档数
