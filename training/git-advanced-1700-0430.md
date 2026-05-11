# Git 进阶专项训练 — 分支策略 / Rebase / Cherry-pick / Hook

> 2026-04-30 17:00 | 第三轮迭代
> 覆盖：分支策略对比、Interactive Rebase、Cherry-pick 实战、Git Hooks 自动化、模拟团队协作全流程

---

## 一、Git 分支策略深度对比

### 1.1 Git Flow（Vincent Driessen, 2010）

**适用场景：** 有固定发布周期的产品（桌面软件、SDK、传统 Web 应用）

```
master ──────────────────────────────── release v2.0 ─── v2.1
  └── develop ──┬── feature/auth ─────┬── feature/pay ────┐
                ├── feature/search ───┤                   │
                └─────────────────────┴───────────────────┘
                    release/1.0 ────── hotfix/login-bug
```

**五大分支角色：**

| 分支 | 生命周期 | 用途 |
|------|----------|------|
| `master` | 永久 | 生产环境，每次 commit 对应一个 release tag |
| `develop` | 永久 | 集成开发分支，包含最新开发完成的功能 |
| `feature/*` | 短期 | 从 develop 切出，合并回 develop |
| `release/*` | 短期 | 从 develop 切出，冻结功能，仅修 bug，合并回 master + develop |
| `hotfix/*` | 短期 | 从 master 切出，紧急修复，合并回 master + develop |

**工作流模拟（5 个角色协作）：**

```bash
# === 初始化 ===
git init && git checkout -b develop

# === 角色 A：开发 feature/user-auth ===
git checkout -b feature/user-auth develop
echo 'export function login() {}' > auth.js
git add auth.js && git commit -m "feat(auth): login function"
echo 'export function register() {}' >> auth.js
git add auth.js && git commit -m "feat(auth): register function"
git checkout develop
git merge --no-ff feature/user-auth -m "Merge feature/user-auth into develop"
git branch -d feature/user-auth

# === 角色 B：开发 feature/payment ===
git checkout -b feature/payment develop
echo 'export function pay() {}' > payment.js
git add payment.js && git commit -m "feat(payment): pay function"
# 模拟冲突：A 也改了同文件
echo '// shared config' > config.js
git add config.js && git commit -m "feat(payment): shared config"

# === 角色 C：创建 release 分支 ===
git checkout -b release/1.0 develop
echo 'VERSION=1.0.0' > version.txt
git add version.txt && git commit -m "chore: bump version to 1.0.0"
# 修 bug
echo '// fix login edge case' >> auth.js
git add auth.js && git commit -m "fix(auth): handle empty password"

# 合并到 master
git checkout master
git merge --no-ff release/1.0 -m "Release v1.0.0"
git tag -a v1.0.0 -m "Version 1.0.0"
# 合并回 develop
git checkout develop
git merge --no-ff release/1.0 -m "Merge release/1.0 into develop"
git branch -d release/1.0

# === 角色 D：hotfix（生产环境发现紧急 bug）===
git checkout -b hotfix/critical-login master
echo '// CRITICAL FIX: SQL injection in login' > auth.js
git add auth.js && git commit -m "hotfix(auth): fix SQL injection vulnerability"
# 合并到 master
git checkout master
git merge --no-ff hotfix/critical-login -m "Hotfix: SQL injection"
git tag -a v1.0.1 -m "Hotfix v1.0.1"
# 合并回 develop
git checkout develop
git merge --no-ff hotfix/critical-login -m "Merge hotfix/critical-login into develop"
git branch -d hotfix/critical-login
```

**Git Flow 的优缺点：**
- ✅ 结构清晰，角色分工明确
- ✅ 适合有严格发布流程的团队
- ❌ 分支过多，流程复杂
- ❌ develop 分支容易积累大量未完成的 feature
- ❌ 不适合持续部署

### 1.2 GitHub Flow（简洁至上）

**适用场景：** 持续部署的 Web 应用、SaaS 产品

```
main ──── commit ──── commit ──── commit ──── deploy!
            └── feature/search ─── PR ─── merge ─┘
            └── feature/filter  ─── PR ─── merge ─┘
```

**核心规则（仅 3 条）：**
1. `main` 分支始终可部署
2. 每个功能从 `main` 切出命名分支
3. 通过 Pull Request 合并，需要 review + CI 通过

```bash
# GitHub Flow 极简工作流
git checkout main && git pull origin main
git checkout -b feature/add-search
# 开发...
git commit -m "feat: add search API"
git push -u origin feature/add-search
# → 创建 PR → Review → CI 通过 → Squash Merge → deploy!
```

### 1.3 GitLab Flow（发布管理 + 环境分支）

**适用场景：** 多环境部署（dev/staging/prod），需要预发布验证

```
main ────────────────────────────────────────── prod
  └── preprod ─────────────────────────── staging
        └── release/2.0 ────────────────── pre-release
              ├── feature/x ─── merge ────┘
              └── feature/y ─── merge ────┘
```

**关键概念：** Upstream 优先（Upstream First）
- 代码必须先合入上游分支，再向下游推进
- 环境分支：`preproduction` → `production`
- 支持基于发布版本（version-based）或基于环境（environment-based）

### 1.4 Forking Workflow（开源协作）

**适用场景：** 开源项目，贡献者无仓库写权限

```
Contributor Fork ── feature ── PR ──→ Official Repo ── main
         └── another ── PR ──→          └── develop
```

```bash
# 贡献者视角
git clone https://github.com/yourname/project.git
cd project
git remote add upstream https://github.com/original/project.git
git fetch upstream
git checkout -b feature/my-fix upstream/main
# 开发...
git push origin feature/my-fix
# → 在 GitHub 上创建 PR

# 保持 fork 同步
git checkout main
git pull upstream main
git push origin main
```

### 1.5 分支策略选择决策树

```
是否有固定发布周期？
├── 是 → 是否需要 hotfix 流程？
│       ├── 是 → Git Flow
│       └── 否 → GitLab Flow (version-based)
└── 否 → 是否持续部署？
        ├── 是 → GitHub Flow
        └── 否 → 是否需要多环境？
                ├── 是 → GitLab Flow (environment-based)
                └── 否 → GitHub Flow (最简单)
```

---

## 二、Rebase 深度实战

### 2.1 Merge vs Rebase 本质区别

```
# Merge 保留完整历史（有分支感）
A──B──C───E────G    main
     \     /     /
      D───F─────H      feature

# Rebase 线性历史（像串行开发）
A──B──C──D'──F'──H'  main + feature (rebase 后)
```

**核心差异：**
- `merge`：创建 merge commit，保留分支拓扑，历史真实但可能混乱
- `rebase`：重写 commit 历史，线性干净，但改变了原始 commit SHA

**黄金法则：Never rebase public branches!**
> 已经 push 到共享仓库的分支，永远不要 rebase。

### 2.2 Interactive Rebase 实战

#### 场景 1：整理本地 commit（squash + reword + fixup）

```bash
# 当前状态：feature 分支上有 6 个 commit，前 3 个需要整理
git log --oneline
# a1b2c3d feat: add user list page
# e4f5g6h fix: typo in user list
# i7j8k9l fix: another typo
# m2n3o4p feat: add user detail page
# q5r6s7t fix: detail page layout
# u8v9w0x feat: add search filter

# 对最近 6 个 commit 做 interactive rebase
git rebase -i HEAD~6
```

```
# Git 打开编辑器，显示：
pick a1b2c3d feat: add user list page
pick e4f5g6h fix: typo in user list
pick i7j8k9l fix: another typo
pick m2n3o4p feat: add user detail page
pick q5r6s7t fix: detail page layout
pick u8v9w0x feat: add search filter

# 修改为：
pick a1b2c3d feat: add user list page
fixup e4f5g6h fix: typo in user list      ← 合并到上一个，丢弃 message
fixup i7j8k9l fix: another typo           ← 合并到上一个，丢弃 message
pick m2n3o4p feat: add user detail page
fixup q5r6s7t fix: detail page layout     ← 合并到上一个
pick u8v9w0x feat: add search filter

# 结果：6 个 commit → 3 个 commit
# a1b2c3d feat: add user list page
# m2n3o4p feat: add user detail page
# u8v9w0x feat: add search filter
```

**Interactive Rebase 命令速查：**

| 命令 | 简写 | 作用 |
|------|------|------|
| `pick` | `p` | 保留该 commit |
| `reword` | `r` | 保留 commit，修改 message |
| `edit` | `e` | 暂停 rebase，可修改 commit 内容 |
| `squash` | `s` | 合并到上一个，保留 message（可编辑） |
| `fixup` | `f` | 合并到上一个，丢弃 message |
| `drop` | `d` | 删除该 commit |
| `exec` | `x` | 执行 shell 命令 |
| `break` | `b` | 暂停 rebase（可 amend） |

#### 场景 2：edit 模式 — 修改已提交的 commit 内容

```bash
# 发现第 3 个 commit 少了一个文件
git rebase -i HEAD~4
# 将第 3 行改为 edit
edit a1b2c3d feat: add user list page
pick e4f5g6h feat: add user detail page
pick i7j8k9l feat: add search filter
pick m2n3o4p feat: add pagination

# Rebase 暂停在 a1b2c3d
# 补充遗漏的文件
echo 'export { UserCard }' > UserCard.js
git add UserCard.js
git commit --amend --no-edit
# 继续 rebase
git rebase --continue
```

#### 场景 3：exec 模式 — 每个 commit 后运行测试

```bash
git rebase -i HEAD~5
# 在每个 commit 后执行测试
pick a1b2c3d feat: add auth
exec npm test
pick e4f5g6h feat: add payment
exec npm test
pick i7j8k9l feat: add search
exec npm test

# 如果某个 commit 测试失败，rebase 暂停
# 修复后：git add . && git rebase --continue
```

#### 场景 4：拆分一个 commit 为多个

```bash
# 一个 commit 做了太多事，需要拆分
git rebase -i HEAD~1
# 改为 edit
edit a1b2c3d feat: add auth + payment + search

# Rebase 暂停，撤销这个 commit 但保留改动
git reset HEAD~1
# 现在所有改动在 working directory

# 分别提交
git add auth.js && git commit -m "feat: add auth"
git add payment.js && git commit -m "feat: add payment"
git add search.js && git commit -m "feat: add search"

# 继续
git rebase --continue
```

### 2.3 Rebase 冲突解决

```bash
# 模拟冲突场景
# main 分支:
echo 'const VERSION = "2.0"' > config.js
git add config.js && git commit -m "chore: bump to v2.0"

# feature 分支 (基于 v1.0):
echo 'const VERSION = "1.1"' > config.js
git add config.js && git commit -m "chore: bump to v1.1"

# 尝试 rebase
git checkout feature
git rebase main
# CONFLICT (content): Merge conflict in config.js

# 查看冲突
cat config.js
# <<<<<<< HEAD
# const VERSION = "2.0"
# =======
# const VERSION = "1.1"
# >>>>>>> feature

# 解决冲突
echo 'const VERSION = "2.0"' > config.js
git add config.js
git rebase --continue
```

**冲突解决辅助工具：**
```bash
# 使用 VS Code 解决冲突
code config.js
# VS Code 提供 Accept Incoming / Accept Current / Accept Both / Compare 按钮

# 使用 mergetool
git mergetool
# 可选：vimdiff, meld, kdiff3, p4merge, opendiff

# 放弃 rebase
git rebase --abort
```

### 2.4 高级 Rebase 技巧

#### `--onto` 参数：选择性移植分支

```bash
# 场景：feature 分支上有 A→B→C，只想移植 B 和 C 到 main
# 当前结构：
# main:     X──Y──Z
# feature: A──B──C

# 只移植 B 和 C（排除 A）
git rebase --onto main A feature
# 结果：
# main:     X──Y──Z──B'──C'
# feature:  A──B──C (原始分支不变)
```

#### `--autosquash`：自动整理 fixup/squash

```bash
# 先标记需要 squash 的 commit
git commit --fixup <commit-hash>
# 自动生成 message: fixup! <original message>

# rebase 时自动整理
git rebase -i --autosquash HEAD~10
# Git 自动将 fixup 行移到对应 commit 下方
```

---

## 三、Cherry-pick 实战

### 3.1 基础用法

```bash
# 将特定 commit 移植到当前分支
git cherry-pick <commit-hash>

# 移植多个
git cherry-pick <hash1> <hash2> <hash3>

# 移植一个范围
git cherry-pick <hash1>..<hash3>  # 不包含 hash1
git cherry-pick <hash1>^..<hash3> # 包含 hash1

# 只应用改动，不自动 commit
git cherry-pick -n <commit-hash>  # --no-commit
```

### 3.2 实战场景

#### 场景 1：跨分支移植 hotfix

```bash
# 生产环境发现 bug，在 hotfix 分支修复
git checkout -b hotfix/payment-crash release/v1.0
echo '// fix: null pointer in payment module' > payment.js
git add payment.js && git commit -m "fix: null pointer in payment module"

# 需要将这个 fix 同时合入 develop 和 staging
git checkout develop
git cherry-pick <hotfix-commit-hash>

git checkout staging
git cherry-pick <hotfix-commit-hash>

# 最后合并到 master
git checkout master
git merge hotfix/payment-crash
```

#### 场景 2：从废弃分支抢救有用 commit

```bash
# feature/old-approach 被废弃，但其中 2 个 commit 有价值
git log --oneline feature/old-approach
# a1b2c3d feat: implement caching layer     ← 有用
# e4f5g6h feat: use old caching strategy    ← 废弃
# i7j8k9l feat: add cache invalidation      ← 有用

git checkout feature/new-approach
git cherry-pick a1b2c3d i7j8k9l
# 只移植有用的 2 个 commit，跳过废弃的
```

#### 场景 3：Cherry-pick 冲突处理

```bash
git checkout main
git cherry-pick feature-commit-hash
# CONFLICT!

# 解决冲突后
git add .
git cherry-pick --continue

# 如果想跳过这个 commit
git cherry-pick --skip

# 如果想完全放弃 cherry-pick
git cherry-pick --abort
```

### 3.3 Cherry-pick 的注意事项

```
⚠️ Cherry-pick 会创建新的 commit（新 SHA）
⚠️ 原始 commit 的 author 保留，但 committer 变为当前用户
⚠️ 不要对已经 push 的公共分支做 cherry-pick（会造成重复 commit）
✅ 适合场景：跨分支移植少量 commit、hotfix 同步、抢救有用改动
❌ 不适合场景：大量代码迁移（应该用 merge/rebase）
```

---

## 四、Git Hooks 自动化

### 4.1 Hook 生命周期总览

```
git commit 流程：
  pre-commit → prepare-commit-msg → commit-msg → post-commit

git rebase 流程：
  pre-rebase → post-rewrite

git push 流程：
  pre-push

git receive（服务端）：
  pre-receive → update → post-receive
```

**Hook 分类：**

| 类型 | 触发时机 | 位置 | 能否阻止操作 |
|------|----------|------|-------------|
| `pre-commit` | commit 前，无需 message | `.git/hooks/` | ✅ |
| `prepare-commit-msg` | message 生成后，编辑器打开前 | `.git/hooks/` | ✅ |
| `commit-msg` | commit message 确认后 | `.git/hooks/` | ✅ |
| `post-commit` | commit 完成后 | `.git/hooks/` | ❌ |
| `pre-push` | push 发送到远程前 | `.git/hooks/` | ✅ |
| `pre-rebase` | rebase 开始前 | `.git/hooks/` | ✅ |
| `post-rewrite` | rebase/amend 后 | `.git/hooks/` | ❌ |
| `pre-receive` | 服务端接收 push 前 | `hooks/` (bare repo) | ✅ |
| `update` | 服务端每个 ref 更新前 | `hooks/` (bare repo) | ✅ |
| `post-receive` | 服务端接收 push 后 | `hooks/` (bare repo) | ❌ |

### 4.2 实战 Hook 实现

#### Hook 1：pre-commit — 代码质量门禁

```bash
#!/bin/bash
# .git/hooks/pre-commit
# 功能：提交前自动 lint + 格式化检查

echo "🔍 Running pre-commit checks..."

# 1. 只检查 staged 文件
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|vue|css)$' || true)

if [ -z "$STAGED_FILES" ]; then
    echo "✅ No JS/TS/Vue/CSS files to check."
    exit 0
fi

# 2. ESLint 检查
echo "📋 ESLint checking staged files..."
npx eslint --fix $STAGED_FILES
ESLINT_EXIT=$?

if [ $ESLINT_EXIT -ne 0 ]; then
    echo "❌ ESLint failed. Please fix the errors above."
    echo "💡 Run 'npx eslint --fix' to auto-fix, then git add + git commit again."
    exit 1
fi

# 3. 检查是否有 console.log（生产环境禁止）
if git diff --cached -U0 | grep -qE '^\+.*console\.(log|debug|info)'; then
    echo "⚠️  Warning: console.log found in staged changes."
    echo "    Remove console.log before committing to production."
    # 这里用 warn 而非 error，不阻止提交
fi

# 4. 检查是否有 debugger 语句
if git diff --cached -U0 | grep -qE '^\+.*debugger'; then
    echo "❌ debugger statement found in staged changes!"
    exit 1
fi

# 5. 重新 add 被 eslint --fix 修改的文件
git add $STAGED_FILES

echo "✅ All pre-commit checks passed!"
exit 0
```

#### Hook 2：commit-msg — 强制 Commit Message 规范

```bash
#!/bin/bash
# .git/hooks/commit-msg
# 功能：强制 Conventional Commits 格式 + Jira ticket 号

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# 1. Conventional Commits 格式检查
# 格式: type(scope): description
# type: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert
CONVENTIONAL_PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .{1,72}"

if ! echo "$COMMIT_MSG" | head -1 | grep -qE "$CONVENTIONAL_PATTERN"; then
    echo "❌ Commit message format error!"
    echo ""
    echo "Expected format: type(scope): description"
    echo "Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
    echo ""
    echo "Examples:"
    echo "  feat(auth): add OAuth2 login support"
    echo "  fix(payment): handle null pointer in refund flow"
    echo "  docs: update API documentation"
    echo ""
    exit 1
fi

# 2. 检查第一行长度
FIRST_LINE=$(echo "$COMMIT_MSG" | head -1)
if [ ${#FIRST_LINE} -gt 72 ]; then
    echo "❌ First line too long (${#FIRST_LINE} chars). Max 72 characters."
    exit 1
fi

# 3. 检查 body 和 header 之间有空行
if echo "$COMMIT_MSG" | tail -n +2 | head -1 | grep -qE '^.+$'; then
    echo "⚠️  Warning: Body should be separated from header by a blank line."
fi

# 4. Jira ticket 号检查（可选，从分支名提取）
BRANCH_NAME=$(git symbolic-ref --short HEAD)
JIRA_PATTERN="[A-Z]+-[0-9]+"

if echo "$BRANCH_NAME" | grep -qE "$JIRA_PATTERN"; then
    TICKET=$(echo "$BRANCH_NAME" | grep -oE "$JIRA_PATTERN" | head -1)
    if ! echo "$COMMIT_MSG" | grep -q "$TICKET"; then
        echo "⚠️  Branch contains ticket $TICKET but commit message does not."
        echo "    Consider adding [$TICKET] to your commit message."
    fi
fi

echo "✅ Commit message validation passed!"
exit 0
```

#### Hook 3：pre-push — 推送前自动化检查

```bash
#!/bin/bash
# .git/hooks/pre-push
# 功能：推送前运行测试 + 构建检查

# 从 stdin 读取推送信息
while read local_ref local_sha remote_ref remote_sha; do
    # 跳过删除分支
    if [ "$local_sha" = "0000000000000000000000000000000000000000" ]; then
        continue
    fi

    # 只检查 push 到 main/master/develop 的情况
    if echo "$remote_ref" | grep -qE "refs/heads/(main|master|develop)$"; then
        echo "🚀 Pushing to $remote_ref, running checks..."

        # 1. 运行测试套件
        echo "📋 Running test suite..."
        npm test
        if [ $? -ne 0 ]; then
            echo "❌ Tests failed! Push rejected."
            echo "💡 Fix tests or use 'git push --no-verify' to bypass (NOT recommended)."
            exit 1
        fi

        # 2. 检查构建
        echo "🔨 Running build..."
        npm run build
        if [ $? -ne 0 ]; then
            echo "❌ Build failed! Push rejected."
            exit 1
        fi

        echo "✅ All push checks passed!"
    fi
done

exit 0
```

#### Hook 4：prepare-commit-msg — 自动注入信息

```bash
#!/bin/bash
# .git/hooks/prepare-commit-msg
# 功能：自动在 commit message 中注入分支名和 ticket 号

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2
BRANCH_NAME=$(git symbolic-ref --short HEAD 2>/dev/null)

# 只在非 merge/non-squash 时注入
if [ -z "$COMMIT_SOURCE" ] && [ -n "$BRANCH_NAME" ]; then
    # 提取 Jira ticket
    JIRA_PATTERN="[A-Z]+-[0-9]+"
    if echo "$BRANCH_NAME" | grep -qE "$JIRA_PATTERN"; then
        TICKET=$(echo "$BRANCH_NAME" | grep -oE "$JIRA_PATTERN" | head -1)
        CURRENT_MSG=$(cat "$COMMIT_MSG_FILE")
        # 如果 message 中还没有 ticket 号，自动添加
        if ! echo "$CURRENT_MSG" | grep -q "$TICKET"; then
            echo "[$TICKET] $CURRENT_MSG" > "$COMMIT_MSG_FILE"
        fi
    fi

    # 添加分支信息作为注释
    echo "" >> "$COMMIT_MSG_FILE"
    echo "# Branch: $BRANCH_NAME" >> "$COMMIT_MSG_FILE"
fi

exit 0
```

#### Hook 5：pre-rebase — 保护公共分支

```bash
#!/bin/bash
# .git/hooks/pre-rebase
# 功能：禁止对公共分支做 rebase

UPSTREAM=$1
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)

# 保护分支列表
PROTECTED_BRANCHES="main master develop release"

for protected in $PROTECTED_BRANCHES; do
    if [ "$BRANCH" = "$protected" ]; then
        echo "❌ Cannot rebase protected branch: $BRANCH"
        echo "💡 Create a feature branch instead:"
        echo "   git checkout -b feature/your-fix $BRANCH"
        exit 1
    fi
done

exit 0
```

### 4.3 共享 Hooks（团队级）

Git hooks 默认在 `.git/hooks/` 下，不会被版本控制。共享方案：

#### 方案 A：自定义 hooks 目录 + core.hooksPath

```bash
# 1. 在仓库根目录创建 hooks/ 目录
mkdir -p .githooks
cp .git/hooks/pre-commit .githooks/
cp .git/hooks/commit-msg .githooks/
cp .git/hooks/pre-push .githooks/

# 2. 配置 Git 使用自定义 hooks 目录
git config core.hooksPath .githooks

# 3. 将 .githooks/ 加入版本控制
git add .githooks/
git commit -m "chore: add shared git hooks"

# 4. 新 clone 的开发者需要手动配置（或写在 README 中）
git config core.hooksPath .githooks
```

#### 方案 B：使用 husky（Node.js 生态推荐）

```bash
# 安装 husky
npm install --save-dev husky
npx husky init

# 创建 hook
npx husky add .husky/pre-commit "npx lint-staged"
npx husky add .husky/commit-msg "npx --no -- commitlint --edit $1"
npx husky add .husky/pre-push "npm test"

# .husky/pre-commit 内容示例：
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx lint-staged

# lint-staged.config.js
export default {
  '*.{js,ts,vue}': ['eslint --fix', 'prettier --write'],
  '*.{css,scss}': ['stylelint --fix', 'prettier --write'],
  '*.json': ['prettier --write'],
}
```

#### 方案 C：使用 simple-git-hooks（轻量替代）

```json
// package.json
{
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged",
    "commit-msg": "npx commitlint --edit $1",
    "pre-push": "npm test"
  }
}
```

---

## 五、模拟团队协作全流程

### 5.1 场景设定

**项目：** 电商后台管理系统（CloudBoard Admin）
**团队：** 4 人（Alice/Backend, Bob/Frontend, Charlie/DevOps, Diana/Lead）
**分支策略：** Git Flow 变体（main + develop + feature + hotfix）
**工具链：** Husky + Commitlint + GitHub Actions

### 5.2 完整协作流程模拟

```bash
# ============================================
# Day 1: 项目初始化 + Sprint 1 开始
# ============================================

# Charlie (DevOps): 初始化仓库 + 设置 hooks
git init cloudboard-admin
cd cloudboard-admin
echo '# CloudBoard Admin' > README.md
git add . && git commit -m "chore: init project"
git branch -M main

# 创建 develop 分支
git checkout -b develop
echo '{"name":"cloudboard-admin","version":"0.1.0"}' > package.json
git add . && git commit -m "chore: add package.json"

# 设置共享 hooks
mkdir -p .githooks
cat > .githooks/pre-commit << 'HOOKEOF'
#!/bin/bash
echo "🔍 Pre-commit: checking staged files..."
STAGED=$(git diff --cached --name-only --diff-filter=ACM)
for f in $STAGED; do
    if [[ "$f" == *.js ]] || [[ "$f" == *.vue ]]; then
        if grep -q "console\.log" "$f" 2>/dev/null; then
            echo "⚠️  $f contains console.log"
        fi
    fi
done
exit 0
HOOKEOF
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
git add .githooks/ && git commit -m "chore: add shared git hooks"

# ============================================
# Day 2: Feature 开发
# ============================================

# Alice (Backend): 开发用户认证模块
git checkout -b feature/user-auth develop
echo '
// auth.js
export class AuthService {
  constructor(api) { this.api = api; }
  
  async login(username, password) {
    const res = await this.api.post("/auth/login", { username, password });
    localStorage.setItem("token", res.data.token);
    return res.data;
  }
  
  async register(username, password, email) {
    return this.api.post("/auth/register", { username, password, email });
  }
  
  logout() {
    localStorage.removeItem("token");
  }
  
  getToken() {
    return localStorage.getItem("token");
  }
}
' > src/auth.js
git add src/auth.js && git commit -m "feat(auth): implement AuthService with login/register/logout"

echo '
// auth.test.js
import { describe, it, expect, vi } from "vitest";
import { AuthService } from "./auth.js";

describe("AuthService", () => {
  const mockApi = {
    post: vi.fn(),
  };
  const service = new AuthService(mockApi);

  it("should login and store token", async () => {
    mockApi.post.mockResolvedValue({ data: { token: "abc123" } });
    const result = await service.login("alice", "pass");
    expect(result.token).toBe("abc123");
    expect(localStorage.getItem("token")).toBe("abc123");
  });

  it("should logout and remove token", () => {
    localStorage.setItem("token", "abc123");
    service.logout();
    expect(localStorage.getItem("token")).toBeNull();
  });
});
' > src/auth.test.js
git add src/auth.test.js && git commit -m "test(auth): add AuthService unit tests"

# Bob (Frontend): 开发用户管理页面
git checkout -b feature/user-management develop
echo '
// UserList.vue
<template>
  <div class="user-list">
    <input v-model="search" placeholder="Search users..." />
    <table>
      <thead>
        <tr>
          <th @click="sort_by = 'name'">Name</th>
          <th @click="sort_by = 'email'">Email</th>
          <th @click="sort_by = 'role'">Role</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in filteredUsers" :key="user.id">
          <td>{{ user.name }}</td>
          <td>{{ user.email }}</td>
          <td>{{ user.role }}</td>
          <td>
            <button @click="editUser(user)">Edit</button>
            <button @click="deleteUser(user.id)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  users: Array,
});

const search = ref("");
const sort_by = ref("name");

const filteredUsers = computed(() => {
  return props.users
    .filter((u) =>
      u.name.toLowerCase().includes(search.value.toLowerCase())
    )
    .sort((a, b) => (a[sort_by.value] > b[sort_by.value] ? 1 : -1));
});

const emit = defineEmits(["edit", "delete"]);
const editUser = (user) => emit("edit", user);
const deleteUser = (id) => emit("delete", id);
</script>
' > src/components/UserList.vue
git add src/components/UserList.vue && git commit -m "feat(ui): add UserList component with search and sort"

# Diana (Lead): Review 并合并 Alice 的 feature
git checkout develop
git merge --no-ff feature/user-auth -m "Merge feature/user-auth into develop"
git branch -d feature/user-auth

# ============================================
# Day 3: 冲突解决 + Release
# ============================================

# Bob 需要合并 feature/user-management，但与 develop 有冲突
git checkout feature/user-management
git rebase develop
# 假设无冲突（实际项目中可能有）
git checkout develop
git merge --no-ff feature/user-management -m "Merge feature/user-management into develop"
git branch -d feature/user-management

# Charlie: 创建 release 分支
git checkout -b release/v1.0.0 develop
echo 'VERSION=1.0.0' > version.txt
echo '
# Changelog
## v1.0.0 (2026-04-30)
### Features
- User authentication (login/register/logout)
- User management page with search and sort
' > CHANGELOG.md
git add . && git commit -m "chore: prepare release v1.0.0"

# 修 release 期间发现的 bug
echo '
// auth.js - fix: handle expired token
export class AuthService {
  async request(config) {
    const token = this.getToken();
    if (token) {
      config.headers.Authorization = \`Bearer \${token}\`;
    }
    try {
      return await this.api.request(config);
    } catch (err) {
      if (err.response?.status === 401) {
        this.logout();
        window.location.href = "/login";
      }
      throw err;
    }
  }
}
' > src/auth.js
git add src/auth.js && git commit -m "fix(auth): handle 401 expired token with auto redirect"

# 合并 release 到 main + develop
git checkout main
git merge --no-ff release/v1.0.0 -m "Release v1.0.0"
git tag -a v1.0.0 -m "CloudBoard Admin v1.0.0"

git checkout develop
git merge --no-ff release/v1.0.0 -m "Merge release/v1.0.0 into develop"
git branch -d release/v1.0.0

# ============================================
# Day 4: Hotfix
# ============================================

# Diana: 生产环境发现严重 bug
git checkout -b hotfix/xss-in-search main
echo '
// UserList.vue - fix: sanitize search input
const filteredUsers = computed(() => {
  const sanitized = search.value.replace(/[<>]/g, "");
  return props.users
    .filter((u) => u.name.toLowerCase().includes(sanitized.toLowerCase()))
    .sort((a, b) => (a[sort_by.value] > b[sort_by.value] ? 1 : -1));
});
' > src/components/UserList.vue
git add src/components/UserList.vue && git commit -m "hotfix(ui): sanitize search input to prevent XSS"

# 合并到 main + develop
git checkout main
git merge --no-ff hotfix/xss-in-search -m "Hotfix: XSS in search input"
git tag -a v1.0.1 -m "Hotfix v1.0.1"

git checkout develop
git merge --no-ff hotfix/xss-in-search -m "Merge hotfix/xss-in-search into develop"
git branch -d hotfix/xss-in-search

# ============================================
# Day 5: Cherry-pick 跨分支移植
# ============================================

# Alice 在 feature/analytics 分支开发了一个有用的工具函数
git checkout -b feature/analytics develop
echo '
// utils/format.js
export function formatNumber(num) {
  return new Intl.NumberFormat("zh-CN").format(num);
}

export function formatDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatCurrency(amount, currency = "CNY") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
  }).format(amount);
}
' > src/utils/format.js
git add src/utils/format.js && git commit -m "feat(utils): add format helpers (number/date/currency)"

# Bob 在 feature/report 分支需要这个工具函数
git checkout -b feature/report develop
# Cherry-pick Alice 的 commit
FORMAT_COMMIT=$(git log --oneline feature/analytics -1 --format="%H")
git cherry-pick $FORMAT_COMMIT
# 基于 format.js 开发报表功能
echo '
// Report.vue
import { formatNumber, formatCurrency, formatDate } from "../utils/format.js";

export function generateReport(data) {
  return {
    totalRevenue: formatCurrency(data.revenue),
    totalUsers: formatNumber(data.users),
    reportDate: formatDate(new Date()),
  };
}
' > src/components/Report.vue
git add src/components/Report.vue && git commit -m "feat(report): add report generation with formatted data"

# ============================================
# Day 6: Rebase 整理历史
# ============================================

# Alice 的 feature/analytics 分支有 5 个 commit，需要整理
git checkout feature/analytics
git log --oneline
# 假设:
# a1 feat: add line chart
# b2 fix: chart color
# c3 fix: chart tooltip
# d4 feat: add bar chart
# e5 fix: bar chart data

# Interactive rebase 整理
# git rebase -i HEAD~5
# 改为:
# pick a1 feat: add line chart
# fixup b2 fix: chart color
# fixup c3 fix: chart tooltip
# pick d4 feat: add bar chart
# fixup e5 fix: bar chart data
# 结果: 5 commits → 2 clean commits

# ============================================
# 最终仓库状态
# ============================================
git log --oneline --graph --all
# * a1b2c3d (HEAD -> develop) Merge hotfix/xss-in-search into develop
# |\
# | * d4e5f6g (hotfix/xss-in-search) hotfix(ui): sanitize search input
# |/
# * g7h8i9j Merge release/v1.0.0 into develop
# |\
# | * j1k2l3m (release/v1.0.0) chore: prepare release v1.0.0
# | * n4o5p6q fix(auth): handle 401 expired token
# |/
# * r7s8t9u (tag: v1.0.1) Hotfix: XSS in search input
# * u1v2w3x (tag: v1.0.0) Release v1.0.0
# * y5z6a7b Merge feature/user-management into develop
# * c8d9e0f Merge feature/user-auth into develop
# * g1h2i3j (main) init project
```

### 5.3 协作规则文档

```markdown
# CloudBoard Admin — Git 协作规范

## 分支命名
- feature/<模块名>: `feature/user-auth`, `feature/payment`
- bugfix/<问题描述>: `bugfix/login-redirect`
- hotfix/<问题描述>: `hotfix/xss-in-search`
- release/<版本号>: `release/v1.0.0`

## Commit Message 规范
```
type(scope): description

[optional body]

[optional footer]
```

- type: feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert
- scope: 模块名 (auth, ui, utils, api, config)
- description: 中文，72 字符以内，祈使句
- body: 为什么做这个改动，解决了什么问题
- footer: BREAKING CHANGE, 关联 ticket (JIRA-123)

## 提交前检查清单
- [ ] 代码通过 ESLint
- [ ] 测试全部通过 (`npm test`)
- [ ] 没有 console.log / debugger
- [ ] Commit message 符合规范
- [ ] 已 rebase 到最新 develop

## PR 规范
- [ ] PR title 与 commit message 一致
- [ ] 描述清楚做了什么、为什么做
- [ ] 关联相关 issue/ticket
- [ ] 至少 1 人 review 通过
- [ ] CI 全部通过
- [ ] 使用 Squash Merge（单个功能）或 Merge（多个 commit 有意义时）
```

---

## 六、高级技巧速查

### 6.1 Git Aliases 配置

```bash
# 高效 alias 配置
git config --global alias.lg "log --graph --oneline --decorate --all"
git config --global alias.lg2 "log --graph --oneline --decorate --all --stat"
git config --global alias.st "status -sb"
git config --global alias.co "checkout"
git config --global alias.br "branch -av"
git config --global alias.unstage "reset HEAD --"
git config --global alias.last "log -1 HEAD"
git config --global alias.undo "reset --soft HEAD~1"
git config --global alias.wip "commit -am WIP"
git config --global alias.lg3 "log --graph --oneline --decorate --all --format='%C(auto)%h %C(magenta)%an %C(yellow)%ad %C(reset)%s' --date=relative"

# 交互式 alias
git config --global alias.slog "log --oneline --since='2 weeks ago'"
git config --global alias.find "grep -n --break --heading"
git config --global alias.root "rev-parse --show-toplevel"
```

### 6.2 Git Bisect — 二分查找引入 bug 的 commit

```bash
# 已知 v1.0.0 正常，HEAD 有 bug
git bisect start
git bisect bad HEAD       # 当前版本有 bug
git bisect good v1.0.0    # v1.0.0 正常

# Git 自动 checkout 到中间 commit
# 测试后标记
git bisect good           # 这个版本正常
git bisect bad            # 这个版本有 bug

# 重复直到找到第一个 bad commit
# Git 输出:
# <commit-hash> is the first bad commit
# Commit message: feat: add search filter

# 结束 bisect
git bisect reset
```

### 6.3 Git Reflog — 后悔药

```bash
# 查看所有 HEAD 移动记录
git reflog
# a1b2c3d HEAD@{0}: commit: feat: add auth
# e4f5g6h HEAD@{1}: rebase finished: returning to refs/heads/feature
# i7j8k9l HEAD@{2}: checkout: moving from main to feature

# 恢复误删的分支
git branch recovered-branch <reflog-hash>

# 恢复误删的 commit
git cherry-pick <reflog-hash>

# 恢复误操作的 rebase
git reset --hard HEAD@{3}  # 回到 3 步之前
```

### 6.4 Git Stash 高级用法

```bash
# 基础 stash
git stash push -m "WIP: auth feature"
git stash list
git stash apply stash@{0}
git stash drop stash@{0}

# 保留 untracked 文件
git stash -u  # --include-untracked

# 保留 ignored 文件
git stash -a  # --all

# Stash 中创建分支
git stash branch feature/recovered
# 从 stash 创建新分支并应用改动

# Patch mode（选择性 stash）
git stash -p
# 交互式选择要 stash 的 hunk

# Stash diff
git stash show -p stash@{0}
```

### 6.5 Git Blame — 追踪代码来源

```bash
# 基本 blame
git blame src/auth.js

# 忽略空白变更
git blame -w src/auth.js

# 忽略指定 commit（如格式化 commit）
git blame --ignore-rev <hash> src/auth.js

# 追踪文件重命名
git blame -M src/auth.js

# 按行追踪内容移动
git blame -C src/auth.js

# 格式化输出
git blame --line-porcelain src/auth.js | grep "^author " | sort | uniq -c | sort -rn
```

### 6.6 Git Submodule 与 Subtree

```bash
# Submodule（独立版本控制）
git submodule add https://github.com/lib/utils.git lib/utils
git submodule update --init --recursive
# 更新 submodule
git submodule update --remote lib/utils
# 提交 submodule 更新
git commit -m "chore: update utils submodule"

# Subtree（合并历史，推荐替代 submodule）
git subtree add --prefix lib/utils https://github.com/lib/utils.git main --squash
# 推送修改回上游
git subtree push --prefix lib/utils https://github.com/lib/utils.git main
# 拉取更新
git subtree pull --prefix lib/utils https://github.com/lib/utils.git main --squash
```

---

## 七、常见陷阱与最佳实践

### 7.1 陷阱清单

| 陷阱 | 后果 | 解决方案 |
|------|------|----------|
| `git push --force` 公共分支 | 团队成员历史丢失 | 永远不用 force push 公共分支 |
| Rebase 已 push 的分支 | Commit SHA 改变，协作混乱 | 只 rebase 本地未 push 的分支 |
| Merge 时不 `--no-ff` | 丢失 feature 边界信息 | 重要 merge 使用 `--no-ff` |
| 大文件提交到 Git | 仓库膨胀，clone 缓慢 | 用 `.gitignore` + Git LFS |
| 敏感信息提交 | 密码/token 泄露 | pre-commit hook 检测 + git-secrets |
| 长时间不 rebase | 冲突越来越多 | 每天 rebase 到最新 develop |
| 在 main 上直接开发 | 破坏稳定版本 | 永远从 develop 切 feature |

### 7.2 最佳实践

```
1. 小步快跑：每次 commit 只做一件事
2. 有意义的 message：future-you 会感谢现在你
3. 经常 pull/rebase：保持与上游同步
4. 用 .gitignore：不提交 node_modules/ dist/ .env
5. 用 hooks：自动化 lint/test/commit-msg 检查
6. 用 tag：每个 release 打 tag
7. 定期清理：删除已合并的远程分支
8. 保护分支：main/develop 设置 branch protection
9. Code Review：PR 必须 review 后合并
10. 备份 reflog：reflog 是你最好的朋友
```

### 7.3 .gitignore 模板

```gitignore
# Dependencies
node_modules/
.pnp/
.pnp.js

# Build
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# Testing
coverage/
.nyc_output/

# Misc
*.tsbuildinfo
.eslintcache
```

---

## 八、训练总结

### 8.1 知识图谱

```
Git 进阶
├── 分支策略
│   ├── Git Flow（固定发布）
│   ├── GitHub Flow（持续部署）
│   ├── GitLab Flow（多环境）
│   └── Forking Workflow（开源）
├── Rebase
│   ├── Merge vs Rebase 本质区别
│   ├── Interactive Rebase（squash/reword/edit/fixup/drop/exec/break）
│   ├── 冲突解决
│   ├── --onto 选择性移植
│   └── --autosquash 自动整理
├── Cherry-pick
│   ├── 单/多 commit 移植
│   ├── 范围移植
│   ├── 冲突处理
│   └── 注意事项（新 SHA）
├── Git Hooks
│   ├── 客户端：pre-commit/commit-msg/pre-push/pre-rebase
│   ├── 服务端：pre-receive/update/post-receive
│   ├── 共享方案：core.hooksPath/husky/simple-git-hooks
│   └── 实战：lint门禁/message规范/测试检查
├── 团队协作
│   ├── 分支命名规范
│   ├── Commit Message 规范
│   ├── PR 流程
│   └── 模拟全流程
└── 高级技巧
    ├── Bisect（二分查 bug）
    ├── Reflog（后悔药）
    ├── Stash 高级用法
    ├── Blame 追踪
    └── Submodule/Subtree
```

### 8.2 关键命令速查

```bash
# 分支
git branch -av                          # 查看所有分支
git checkout -b feature/x develop       # 从 develop 切 feature
git merge --no-ff feature/x             # 保留分支拓扑
git branch -d feature/x                 # 删除已合并分支

# Rebase
git rebase -i HEAD~5                    # 交互式 rebase 最近 5 个
git rebase develop                      # rebase 到最新 develop
git rebase --abort                      # 放弃 rebase
git rebase --continue                   # 解决冲突后继续

# Cherry-pick
git cherry-pick <hash>                  # 移植单个 commit
git cherry-pick <hash1> <hash2>         # 移植多个
git cherry-pick --abort                 # 放弃 cherry-pick

# Hooks
git config core.hooksPath .githooks     # 自定义 hooks 目录
chmod +x .githooks/pre-commit           # 确保可执行

# 后悔药
git reflog                              # 查看操作历史
git reset --soft HEAD~1                 # 撤销 commit 保留改动
git reset --hard HEAD~1                 # 完全撤销

# 查找
git bisect start && git bisect bad HEAD && git bisect good v1.0  # 二分查 bug
git blame -w src/file.js                # 追踪代码来源
```

### 8.3 训练产出

- **分支策略对比：** 4 种策略完整解析 + 决策树
- **Interactive Rebase：** 5 种场景（squash/edit/split/exec/冲突解决）
- **Cherry-pick：** 3 种实战场景（hotfix 移植/抢救 commit/冲突处理）
- **Git Hooks：** 5 个完整实现（pre-commit/commit-msg/pre-push/prepare-commit-msg/pre-rebase）
- **团队协作模拟：** 6 天完整流程（4 人协作，含 feature/release/hotfix/cherry-pick/rebase）
- **高级技巧：** Bisect/Reflog/Stash/Blame/Submodule/Subtree
- **最佳实践：** 陷阱清单 + 规范模板 + .gitignore 模板

---

> **训练完成。** Git 进阶知识体系覆盖完整，从分支策略到团队协作全流程，从 Rebase 到 Hooks 自动化，从基础操作到高级技巧。
