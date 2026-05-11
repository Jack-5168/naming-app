# Git 进阶专项训练 — 分支策略 / Rebase / Cherry-pick / Hook

> 专项训练 17:00 | 2026-04-24
> 目标：掌握 Git 高级操作，模拟真实团队协作流程

---

## 一、分支策略 (Branching Strategies)

### 1.1 Git Flow

经典的分支模型，适合有固定发布周期的项目：

```
main ──────────────────────────────────────────────── 生产环境
  └── develop ─────────────────────────────────────── 开发集成分支
        ├── feature/auth ────┐
        ├── feature/payment ─┤── feature/* 功能分支
        └── feature/search ──┘
        ├── release/v1.0 ────┐── release/* 预发布分支
        └── release/v1.1 ────┘
        └── hotfix/login-bug ┐── hotfix/* 紧急修复
        └── hotfix/pay-crash ┘
```

**分支职责：**

| 分支 | 来源 | 目标 | 生命周期 |
|------|------|------|----------|
| `main` | — | — | 永久，只接收合并 |
| `develop` | `main` | `main` | 永久，开发主干 |
| `feature/*` | `develop` | `develop` | 临时，功能完成后删除 |
| `release/*` | `develop` | `main` + `develop` | 临时，发布完成后删除 |
| `hotfix/*` | `main` | `main` + `develop` | 临时，修复完成后删除 |

**Git Flow 命令示例：**

```bash
# 初始化
git flow init -d

# 新功能开发
git flow feature start user-auth
# ... 开发 ...
git flow feature finish user-auth

# 预发布
git flow release start 1.0.0
# ... 修复小问题 ...
git flow release finish 1.0.0

# 紧急修复
git flow hotfix start login-bug
# ... 修复 ...
git flow hotfix finish login-bug
```

### 1.2 GitHub Flow（轻量级）

适合持续交付的项目，只有一个永久分支：

```
main ─────────────────────────────────────────────── 随时可部署
  └── fix/header-spacing ── PR → merge → deploy
  └── feat/search-api ───── PR → merge → deploy
  └── hotfix/pay-timeout ── PR → merge → deploy
```

**核心规则：**
1. `main` 分支永远可部署
2. 为每个新功能/修复创建描述性分支
3. 添加内容到分支并部署测试
4. 发起 Pull Request
5. 团队 Review 通过后合并
6. 立即部署

### 1.3 GitLab Flow（环境驱动）

适合有多个部署环境的项目：

```
main ───────────────────────────────────────────────
  ├── dev ────────────────────────────────────────── 开发环境
  │     └── feat/* → merge → dev
  ├── staging ────────────────────────────────────── 预发环境
  │     └── dev → merge → staging (手动触发)
  └── production ─────────────────────────────────── 生产环境
        └── staging → merge → production (手动触发)
```

### 1.4 Trunk-Based Development（主干开发）

适合高频部署的团队（每天多次部署）：

```
main ─────────────────────────────────────────────── 主干
  ├── short-lived branch (< 2天) → tiny PR → merge back
  └── feature flags 控制功能开关
```

**关键原则：**
- 分支存活时间 < 2 天
- 小步提交，频繁合并
- 使用 Feature Flag 控制未完成的特性
- 自动化测试是基础设施

### 1.5 分支命名规范

```bash
# 推荐格式：类型/描述
feature/user-auth
feature/payment-integration
fix/header-spacing
hotfix/pay-timeout
release/v1.2.0
refactor/api-client
docs/readme-update
chore/dependency-update
```

---

## 二、Rebase（变基）

### 2.1 Rebase vs Merge 的本质区别

**Merge（合并）：** 保留完整历史，产生一个 merge commit

```
A─B─C  main
    \   \
     D─E─┘── merge commit
     feature
```

**Rebase（变基）：** 重写历史，线性提交

```
A─B─C  main
      \
       D'─E'── feature (rebased)
```

### 2.2 基本 Rebase 操作

```bash
# 将 feature 分支变基到 main
git checkout feature
git rebase main

# 交互式 Rebase（核心技能）
git rebase -i HEAD~3

# 编辑器中会出现：
pick abc123 feat: add user login
pick def456 fix: correct password validation
pick ghi789 refactor: extract auth helper

# 可以修改为：
pick abc123 feat: add user login
fixup def456 fix: correct password validation  # 合并到上一个
pick ghi789 refactor: extract auth helper
```

### 2.3 交互式 Rebase 命令

| 命令 | 简写 | 作用 |
|------|------|------|
| `pick` | `p` | 保留该 commit |
| `reword` | `r` | 保留 commit，修改提交信息 |
| `edit` | `e` | 暂停，可修改该 commit |
| `squash` | `s` | 合并到上一个，保留提交信息 |
| `fixup` | `f` | 合并到上一个，丢弃提交信息 |
| `drop` | `d` | 删除该 commit |
| `exec` | `x` | 执行 shell 命令 |
| `break` | `b` | 在此暂停 rebase |

### 2.4 Rebase 实战场景

**场景 1：整理杂乱的功能分支**

```bash
# 开发过程中频繁提交，现在需要整理
git log --oneline
# a1b2c3 feat: add button
# d4e5f6 fix: typo
# g7h8i9 feat: add input
# j0k1l2 fix: styling
# m3n4o5 feat: add form validation

# 交互式 rebase，整理为 3 个清晰的 commit
git rebase -i HEAD~5

# 编辑后：
pick a1b2c3 feat(ui): add button component
fixup d4e5f6 fix: typo
pick g7h8i9 feat(ui): add input component
fixup j0k1l2 fix: styling
pick m3n4o5 feat(form): add validation

# 结果：3 个清晰的 commit，每个对应一个功能模块
```

**场景 2：更新分支到最新 main**

```bash
# main 有新提交，更新 feature 分支
git checkout feature
git rebase main

# 解决冲突后继续
git add .
git rebase --continue

# 如果 rebase 出错，可以回到 rebase 前
git rebase --abort
```

**场景 3：拆分一个 commit**

```bash
# 某个 commit 包含了多个不相关的改动
git rebase -i HEAD~3

# 将目标 commit 改为 edit
edit abc123 feat: add multiple features

# 暂停后，撤销该 commit 的改动但保留文件
git reset HEAD~1

# 分别提交
git add src/button.js
git commit -m "feat(ui): add button"

git add src/input.js
git commit -m "feat(ui): add input"

# 继续 rebase
git rebase --continue
```

### 2.5 Rebase 的黄金法则

> **永远不要 rebase 已经推送到共享仓库的分支！**

```bash
# ✅ 安全：本地分支 rebase
git rebase main

# ✅ 安全：自己的远程分支 rebase（force push 前通知团队）
git rebase main
git push --force-with-lease

# ❌ 危险：rebase main/master/develop 等共享分支
git checkout main
git rebase feature  # 不要这样做！
```

### 2.6 autosquash — 自动整理 fixup/squash

```bash
# 标记需要合并的 commit
git commit --fixup abc123  # 自动标记为 fixup abc123

# rebase 时自动排列
git rebase -i --autosquash HEAD~5

# 配置自动开启
git config --global rebase.autosquash true
```

---

## 三、Cherry-pick（挑拣提交）

### 3.1 基本概念

Cherry-pick 允许你选择性地应用某个分支的特定 commit 到当前分支：

```
main:   A─B─C─D
                   \
feature:  X─Y─Z    Z' (cherry-picked)
```

### 3.2 基本用法

```bash
# 挑拣单个 commit
git cherry-pick <commit-hash>

# 挑拣多个 commit
git cherry-pick <hash1> <hash2> <hash3>

# 挑拣一个范围的 commit（不包含起始）
git cherry-pick A..B

# 挑拣包含起始的整个范围
git cherry-pick A^..B

# 只应用改动，不创建 commit（方便修改后提交）
git cherry-pick -n <commit-hash>
git cherry-pick --no-commit <commit-hash>

# 编辑提交信息
git cherry-pick -e <commit-hash>

# 解决冲突后继续
git add .
git cherry-pick --continue

# 放弃 cherry-pick
git cherry-pick --abort
```

### 3.3 Cherry-pick 实战场景

**场景 1：紧急修复多个版本**

```bash
# main 分支上修复了安全漏洞
git log --oneline main
# a1b2c3 fix(security): patch XSS vulnerability  ← 这个需要应用到 v1.x

# 切换到 v1.x 分支
git checkout v1.x
git cherry-pick a1b2c3

# 同样应用到 v2.x
git checkout v2.x
git cherry-pick a1b2c3
```

**场景 2：从废弃分支提取有用改动**

```bash
# 废弃的 feature 分支中有几个有用的 commit
git log --oneline abandoned-feature
# f1e2d3 feat: good utility function      ← 有用
# a4b5c6 feat: broken implementation     ← 不要
# d7e8f9 feat: another good helper       ← 有用

git checkout develop
git cherry-pick f1e2d3 d7e8f9
```

**场景 3：跨仓库 cherry-pick**

```bash
# 添加远程仓库
git remote add upstream https://github.com/original/repo.git
git fetch upstream

# 挑拣 upstream 的某个 commit
git cherry-pick upstream/main~3
```

### 3.4 Cherry-pick vs Merge 的选择

| 场景 | 推荐 | 原因 |
|------|------|------|
| 单个 bug fix 到多个分支 | Cherry-pick | 精确控制 |
| 完整功能合并 | Merge/Rebase | 保留完整上下文 |
| 从废弃分支提取 | Cherry-pick | 只取有用的 |
| 多个相关 commit | Merge | 保持关联性 |

---

## 四、Git Hook（钩子）

### 4.1 Hook 生命周期

```
git commit 流程中的 Hook：
  pre-commit → prepare-commit-msg → commit-msg → post-commit

git push 流程中的 Hook：
  pre-push

git rebase 流程中的 Hook：
  pre-rebase → post-rewrite
```

### 4.2 Hook 目录

```bash
# 查看 hook 目录
git rev-parse --git-dir/hooks
# 通常是 .git/hooks/

# 列出所有可用 hook
ls .git/hooks/
# applypatch-msg.sample
# commit-msg.sample
# post-update.sample
# pre-applypatch.sample
# pre-commit.sample
# pre-push.sample
# pre-rebase.sample
# prepare-commit-msg.sample
# update.sample
```

### 4.3 常用 Hook 示例

#### 4.3.1 pre-commit — 提交前检查

```bash
#!/bin/sh
# .git/hooks/pre-commit
# 提交前自动运行 ESLint 和格式化

# 检查是否有冲突标记
if git diff --cached | grep -E '^[><]={7}'; then
  echo "Error: Conflict markers found in staged files"
  exit 1
fi

# 运行 lint（只检查 staged 文件）
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|vue)$')
if [ "$STAGED_FILES" != "" ]; then
  echo "$STAGED_FILES" | xargs npx eslint --quiet
  if [ $? -ne 0 ]; then
    echo "ESLint check failed. Commit aborted."
    exit 1
  fi
fi

exit 0
```

#### 4.3.2 commit-msg — 提交信息规范检查

```bash
#!/bin/sh
# .git/hooks/commit-msg
# 强制 Commitizen/Conventional Commits 格式

COMMIT_MSG=$(cat "$1")
PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+"

if ! echo "$COMMIT_MSG" | grep -qE "$PATTERN"; then
  echo "ERROR: Invalid commit message format!"
  echo ""
  echo "Expected: <type>(<scope>): <description>"
  echo "Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
  echo ""
  echo "Examples:"
  echo "  feat(auth): add login functionality"
  echo "  fix(api): handle timeout errors"
  echo "  docs: update README"
  exit 1
fi

exit 0
```

#### 4.3.3 pre-push — 推送前测试

```bash
#!/bin/sh
# .git/hooks/pre-push
# 推送到 main/develop 前运行测试

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "develop" ]; then
  echo "Running tests before pushing to $BRANCH..."
  npm test
  if [ $? -ne 0 ]; then
    echo "Tests failed! Push aborted."
    exit 1
  fi
fi

exit 0
```

#### 4.3.4 prepare-commit-msg — 自动生成提交信息

```bash
#!/bin/sh
# .git/hooks/prepare-commit-msg
# 自动关联 Jira issue 号

BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2

# 只对 feature/ 和 fix/ 分支添加 issue 号
if echo "$BRANCH" | grep -qE "^(feature|fix)/"; then
  ISSUE=$(echo "$BRANCH" | grep -oE '[A-Z]+-[0-9]+')
  if [ -n "$ISSUE" ] && [ "$COMMIT_SOURCE" = "message" ]; then
    # 在提交信息开头添加 [ISSUE-123]
    sed -i.bak "s/^/[$ISSUE] /" "$COMMIT_MSG_FILE"
  fi
fi

exit 0
```

### 4.4 Hook 管理工具

#### Husky（推荐）

```bash
# 安装 Husky
npm install --save-dev husky

# 初始化
npx husky init

# 配置 package.json
{
  "scripts": {
    "prepare": "husky"
  }
}

# 创建 hook
npx husky add .husky/pre-commit "npm run lint"
npx husky add .husky/commit-msg "npx --no -- commitlint --edit $1"
```

#### Commitlint（提交信息规范）

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional

# commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'build', 'ci', 'chore', 'revert'
    ]],
    'type-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [1, 'always', 80],
  }
};
```

#### lint-staged（只检查 staged 文件）

```bash
npm install --save-dev lint-staged

# package.json
{
  "lint-staged": {
    "*.{js,ts,vue}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ],
    "*.css": [
      "stylelint --fix",
      "prettier --write"
    ]
  }
}

# .husky/pre-commit
npx lint-staged
```

---

## 五、模拟团队协作流程

### 5.1 场景设置

```bash
# 创建模拟项目
mkdir -p /tmp/git-team-sim && cd /tmp/git-team-sim
git init

# 模拟两个开发者
mkdir dev-alice dev-bob
```

### 5.2 完整协作流程模拟

```bash
# ═══════════════════════════════════════════
# 步骤 1: Alice 创建项目，初始化 main 分支
# ═══════════════════════════════════════════
cd /tmp/git-team-sim
git init
echo "# Team Project" > README.md
echo '{"name": "team-project", "version": "1.0.0"}' > package.json
git add .
git commit -m "feat: initialize project"

# 创建 bare 仓库作为"远程"
git clone --bare . ../remote.git
git remote add origin ../remote.git
git push -u origin main

# ═══════════════════════════════════════════
# 步骤 2: Alice 和 Bob 各自克隆
# ═══════════════════════════════════════════
cd /tmp/git-team-sim
git config user.name "Alice"
git config user.email "alice@team.com"

cd /tmp
git clone remote.git alice-repo
git clone remote.git bob-repo

# ═══════════════════════════════════════════
# 步骤 3: Alice 开发 feature/auth
# ═══════════════════════════════════════════
cd /tmp/alice-repo
git checkout -b feature/auth

echo 'export function login(user) { return true; }' > auth.js
echo 'export function logout() { return true; }' >> auth.js
git add auth.js
git commit -m "feat(auth): add login and logout functions"

echo '# Auth Module' > auth.md
git add auth.md
git commit -m "docs(auth): add auth module documentation"

# ═══════════════════════════════════════════
# 步骤 4: Bob 开发 feature/api，与 Alice 并行
# ═══════════════════════════════════════════
cd /tmp/bob-repo
git checkout -b feature/api

echo 'export async function fetchData(url) { return fetch(url); }' > api.js
git add api.js
git commit -m "feat(api): add fetch utility"

echo '# API Module' > api.md
git add api.md
git commit -m "docs(api): add api module documentation"

# ═══════════════════════════════════════════
# 步骤 5: Alice 先推送并合并她的分支
# ═══════════════════════════════════════════
cd /tmp/alice-repo
git push origin feature/auth

# 模拟 PR merge（实际中通过 GitHub/GitLab）
git checkout main
git merge --no-ff feature/auth -m "Merge pull request: feature/auth"
git push origin main

# ═══════════════════════════════════════════
# 步骤 6: Bob 推送时遇到冲突
# ═══════════════════════════════════════════
cd /tmp/bob-repo
git fetch origin
git rebase origin/main

# 如果有冲突，解决它
# git add .
# git rebase --continue

git push origin feature/api

# ═══════════════════════════════════════════
# 步骤 7: Alice 发现紧急 bug，创建 hotfix
# ═══════════════════════════════════════════
cd /tmp/alice-repo
git checkout -b hotfix/auth-timeout main

echo 'export function login(user) { return { token: "abc", expires: 3600 }; }' > auth.js
git add auth.js
git commit -m "fix(auth): add token expiration to login"

git checkout main
git merge --no-ff hotfix/auth-timeout -m "Merge pull request: hotfix/auth-timeout"
git push origin main

# ═══════════════════════════════════════════
# 步骤 8: Bob 需要 hotfix 的改动到他的分支
# ═══════════════════════════════════════════
cd /tmp/bob-repo
git fetch origin

# 找到 hotfix 的 commit hash
HOTFIX_HASH=$(cd /tmp/alice-repo && git log --oneline main | grep "fix(auth)" | head -1 | awk '{print $1}')

# 使用 cherry-pick 应用到 feature/api
git checkout feature/api
git cherry-pick $HOTFIX_HASH

# ═══════════════════════════════════════════
# 步骤 9: Bob 整理提交历史后合并
# ═══════════════════════════════════════════
cd /tmp/bob-repo
git fetch origin
git rebase -i origin/main

# 假设需要 squash 文档 commit 到功能 commit
# git rebase -i HEAD~4

git checkout main
git merge --squash feature/api
git commit -m "feat(api): add api module with cherry-picked auth fix"
git push origin main
```

### 5.3 协作中的常见问题与解决

#### 5.3.1 冲突解决策略

```bash
# 查看冲突文件
git status

# 冲突标记示例：
# <<<<<<< HEAD
# Alice 的改动
# =======
# Bob 的改动
# >>>>>>> feature/api

# 解决方式 1：手动编辑，删除冲突标记
vim conflicted-file.js

# 解决方式 2：使用 ours（保留当前分支）
git checkout --ours conflicted-file.js
git add conflicted-file.js

# 解决方式 3：使用 theirs（使用对方分支）
git checkout --theirs conflicted-file.js
git add conflicted-file.js

# 完成合并
git commit
```

#### 5.3.2 使用 git rerere 自动记住冲突解决

```bash
# 开启 rerere（reuse recorded resolution）
git config --global rerere.enabled true

# 第一次解决冲突后，git 会记住解决方案
# 下次遇到相同冲突，自动应用相同解决方案

# 查看 rerere 缓存
git rerere status

# 清除 rerere 缓存
git rerere forget <file>
```

#### 5.3.3 代码审查工作流

```bash
# Alice 推送 feature 分支
git push origin feature/auth

# Bob review Alice 的代码
git fetch origin
git checkout origin/feature/auth

# 查看改动
git diff main..feature/auth
git log main..feature/auth --oneline
git show <commit-hash>  # 查看具体改动

# 在 GitHub/GitLab 上添加 review comments

# Review 通过后，Alice 合并
git checkout main
git merge --no-ff feature/auth
git push origin main
git branch -d feature/auth
```

---

## 六、高级技巧与最佳实践

### 6.1 git bisect — 二分查找引入 bug 的 commit

```bash
# 当前版本有 bug，v1.0 是正常的
git bisect start
git bisect bad          # 当前版本有 bug
git bisect good v1.0    # v1.0 是正常的

# git 自动 checkout 到中间 commit，你测试后标记
git bisect good         # 这个版本没问题
git bisect bad          # 这个版本有 bug

# 重复直到找到第一个有 bug 的 commit
# 完成后
git bisect reset
```

### 6.2 git reflog — 找回"丢失"的 commit

```bash
# 查看所有 HEAD 移动历史
git reflog

# 找回被 reset 掉的 commit
git reset --hard HEAD@{3}  # 回到 3 次操作前

# 找回被删除的分支
git branch recovered-branch <commit-hash-from-reflog>
```

### 6.3 git stash — 临时保存工作区

```bash
# 保存当前改动
git stash

# 保存并添加描述
git stash save "WIP: auth module half done"

# 保存包含未跟踪文件
git stash -u
git stash --include-untracked

# 查看 stash 列表
git stash list

# 应用最新的 stash
git stash pop

# 应用指定的 stash
git stash apply stash@{2}

# 删除 stash
git stash drop stash@{1}

# 从 stash 创建分支
git stash branch new-branch-name
```

### 6.4 git tag — 版本标记

```bash
# 轻量标签
git tag v1.0.0

# 附注标签（推荐）
git tag -a v1.0.0 -m "Release version 1.0.0"

# 推送标签
git push origin v1.0.0
git push origin --tags  # 推送所有标签

# 删除标签
git tag -d v1.0.0
git push origin --delete v1.0.0
```

### 6.5 git submodule — 子模块管理

```bash
# 添加子模块
git submodule add https://github.com/lib/utils.git lib/utils

# 克隆包含子模块的仓库
git clone --recurse-submodules <url>

# 或克隆后初始化子模块
git submodule update --init --recursive

# 更新子模块
git submodule update --remote --merge

# 删除子模块
git submodule deinit -f path/to/submodule
git rm -f path/to/submodule
rm -rf .git/modules/path/to/submodule
```

---

## 七、实用配置速查

### 7.1 推荐的全局配置

```bash
# 用户信息
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# 默认编辑器
git config --global core.editor "vim"

# 默认分支名
git config --global init.defaultBranch main

# 自动换行（跨平台）
git config --global core.autocrlf input  # macOS/Linux
git config --global core.autocrlf true   # Windows

# 颜色输出
git config --global color.ui auto

# 别名（大幅提升效率）
git config --global alias.s "status -sb"
git config --global alias.l "log --oneline --graph --decorate"
git config --global alias.la "log --oneline --graph --decorate --all"
git config --global alias.co "checkout"
git config --global alias.br "branch"
git config --global alias.cm "commit -m"
git config --global alias.ca "commit -am"
git config --global alias.unstage "reset HEAD --"
git config --global alias.last "log -1 HEAD"
git config --global alias.undo "reset --soft HEAD~1"
git config --global alias.wip "commit -am 'WIP'"
git config --global alias.undo-wip "!git log -1 --pretty=%B | grep -q WIP && git reset --soft HEAD~1"
git config --global alias.sync "!git fetch origin && git rebase origin/main"

# 自动整理 fixup/squash
git config --global rebase.autosquash true
git config --global rebase.autostash true

# 推送行为
git config --global push.default simple
git config --global push.autoSetupRemote true

# 合并策略
git config --global merge.ff false  # 默认 no-ff
```

### 7.2 .gitignore 最佳实践

```gitignore
# 依赖
node_modules/
vendor/

# 构建产物
dist/
build/
*.o
*.a
*.so

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# 系统
.DS_Store
Thumbs.db

# 环境变量
.env
.env.local
.env.*.local

# 日志
*.log
npm-debug.log*

# 测试覆盖率
coverage/
.nyc_output/

# 临时文件
tmp/
temp/
*.tmp
```

---

## 八、总结

### 核心要点

1. **分支策略选择**：小团队用 GitHub Flow，大团队用 Git Flow，高频部署用 Trunk-Based
2. **Rebase 原则**：只 rebase 本地/个人分支，绝不 rebase 共享分支
3. **Cherry-pick 场景**：跨分支提取单个/少量 commit，不用于完整功能合并
4. **Hook 自动化**：用 Husky + lint-staged + commitlint 构建自动化流水线
5. **协作规范**：小步提交、频繁合并、代码审查、清晰提交信息

### 提交信息规范（Conventional Commits）

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]

types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
```

### 学习资源

- [Git 官方文档](https://git-scm.com/doc)
- [Pro Git 书（免费）](https://git-scm.com/book/zh/v2)
- [Git 可视化学习](https://learngitbranching.js.org/)
- [Git Flow 参考](https://danielkummer.github.io/git-flow-cheatsheet/)
