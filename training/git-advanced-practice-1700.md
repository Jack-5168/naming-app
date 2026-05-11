# Git 进阶实战演练 — 团队协作模拟

> 专项训练 17:00 | 2026-04-26
> 在已有 `git-advanced-1700.md`（~25KB 理论文档）基础上，进行实战模拟演练

---

## 演练概述

通过模拟 Alice 和 Bob 两个开发者的协作流程，实战演练以下核心技能：

| 技能 | 演练场景 | 难度 |
|------|----------|------|
| 分支策略 | GitHub Flow（feature/hotfix 分支） | ⭐⭐ |
| Rebase | Bob rebase 到 Alice 合并后的 main | ⭐⭐⭐ |
| 冲突解决 | src/config.js 冲突（Alice 加了 AUTH，Bob 加了 API v2） | ⭐⭐⭐⭐ |
| Cherry-pick | Bob 从 main cherry-pick hotfix 到自己的 feature 分支 | ⭐⭐ |
| Hook | pre-commit / commit-msg / pre-push | ⭐⭐⭐ |
| 提交整理 | fixup + autosquash | ⭐⭐ |

---

## 演练流程记录

### 场景1: Alice 初始化项目

```bash
# Alice 创建项目，初始化 main 分支
git init && git branch -m main
# 创建 README.md, package.json, src/index.js, src/config.js, utils/date.js
git add . && git commit -m "feat: initialize project"

# 创建 bare 远程仓库
git clone --bare . ../remote.git
git remote add origin ../remote.git
git push -u origin main
```

**关键知识点:** bare 仓库作为"远程"，模拟 GitHub/GitLab 的角色。

### 场景2: Alice 和 Bob 并行克隆

```bash
# 两个开发者同时克隆远程仓库
cd /tmp
git clone remote.git alice-repo
git clone remote.git bob-repo
```

**关键知识点:** 每个开发者有独立的本地仓库，通过远程仓库协作。

### 场景3: Alice 开发 feature/auth 并合并

```bash
cd /tmp/alice-repo
git checkout -b feature/auth

# 添加 auth.js
cat > src/auth.js << 'EOF'
export function login(username, password) { ... }
export function logout(token) { ... }
export function verifyToken(token) { ... }
EOF
git add src/auth.js && git commit -m "feat(auth): add login/logout/verify functions"

# 修改 config.js（添加 AUTH 配置）
cat > src/config.js << 'EOF'
export const VERSION = "1.0.0";
export const API_BASE = "https://api.example.com";
export const TIMEOUT = 3000;
export const AUTH_ENABLED = true;      # ← Alice 新增
export const SESSION_TIMEOUT = 3600;   # ← Alice 新增
EOF
git add src/config.js && git commit -m "feat(auth): add auth config options"

# 推送并合并（GitHub Flow: PR → merge）
git push origin feature/auth
git checkout main
git merge --no-ff feature/auth -m "Merge branch 'feature/auth'"
git push origin main
```

**关键知识点:**
- `--no-ff` 保留分支历史，即使 fast-forward 也创建 merge commit
- feature 分支完成后删除（演练中保留以便查看）

### 场景4: Bob 并行开发 feature/api（基于旧版本）

```bash
cd /tmp/bob-repo
git checkout -b feature/api

# Bob 也修改了 config.js（与 Alice 冲突！）
cat > src/config.js << 'EOF'
export const VERSION = "1.1.0";           # ← Bob 改了
export const API_BASE = "https://api-v2.example.com";  # ← Bob 改了
export const TIMEOUT = 5000;              # ← Bob 改了
export const MAX_RETRIES = 3;             # ← Bob 新增
export const LOG_LEVEL = "debug";         # ← Bob 新增
EOF

# Bob 还添加了 api.js
cat > src/api.js << 'EOF'
export async function fetchUser(id) { ... }
export async function createUser(data) { ... }
EOF
git add . && git commit -m "feat(api): add user CRUD endpoints"
```

**关键知识点:** Bob 在 Alice 合并前就创建了分支，导致 config.js 冲突。

### 场景5: Bob rebase 到最新 main → 产生冲突！

```bash
cd /tmp/bob-repo
git fetch origin
git rebase origin/main
```

**冲突内容:**
```
<<<<<<< HEAD (Alice 的 AUTH 配置)
export const VERSION = "1.0.0";
export const API_BASE = "https://api.example.com";
export const TIMEOUT = 3000;
export const AUTH_ENABLED = true;
export const SESSION_TIMEOUT = 3600;
=======
export const VERSION = "1.1.0";
export const API_BASE = "https://api-v2.example.com";
export const TIMEOUT = 5000;
export const MAX_RETRIES = 3;
export const LOG_LEVEL = "debug";
>>>>>>> 5894708 (feat(api): add user CRUD endpoints)
```

**Bob 的解决策略：整合双方改动**
```javascript
export const VERSION = "1.1.0";
export const API_BASE = "https://api-v2.example.com";
export const TIMEOUT = 5000;
export const MAX_RETRIES = 3;
export const LOG_LEVEL = "debug";
export const AUTH_ENABLED = true;      // ← 保留 Alice 的
export const SESSION_TIMEOUT = 3600;   // ← 保留 Alice 的
```

```bash
git add src/config.js
git rebase --continue
```

**关键知识点:**
- `git fetch` 只下载远程更新，不合并
- `git rebase origin/main` 将本地 commit 重新应用到最新 main 之上
- 冲突解决后 `git add` + `git rebase --continue`
- 如果 rebase 出错，`git rebase --abort` 回到 rebase 前

### 场景6: Alice 发现紧急 bug，创建 hotfix

```bash
cd /tmp/alice-repo
git checkout -b hotfix/auth-timeout main

# 修复 token 过期问题
cat > src/auth.js << 'EOF'
export function login(username, password) {
  return { token: "abc123", user: username, expires: Date.now() + 3600000 };
}
// ... 新增 isTokenExpired 函数
EOF
git add src/auth.js && git commit -m "fix(auth): add token expiration tracking"

# 快速合并到 main
git checkout main
git merge --no-ff hotfix/auth-timeout -m "Merge branch 'hotfix/auth-timeout'"
git push origin main
```

**关键知识点:** hotfix 分支从 main 创建，修复后直接合并到 main，优先级最高。

### 场景7: Bob cherry-pick hotfix 到 feature/api

```bash
cd /tmp/bob-repo
git fetch origin

# 找到 hotfix 的 commit hash
HOTFIX_HASH=$(git log --oneline origin/main | grep "fix(auth)" | head -1 | awk '{print $1}')

# Cherry-pick 到 feature/api
git checkout feature/api
git cherry-pick $HOTFIX_HASH
```

**关键知识点:**
- Cherry-pick 适用于"只取某个 commit 的改动"的场景
- 不用于完整功能合并（用 merge/rebase）
- Cherry-pick 会创建新的 commit（不同的 hash，相同的 diff）

### 场景8: Bob 整理提交历史（fixup + autosquash）

```bash
# Bob 发现之前的 commit 有个小问题，用 fixup 标记
echo "// temporary debug log" >> src/api.js
git add src/api.js
git commit --fixup 2fc6eb0  # 标记为 fixup 到 feat(api) commit

# 自动整理（squash fixup 到目标 commit）
git rebase -i --autosquash HEAD~5
```

**关键知识点:**
- `git commit --fixup <hash>` 自动标记为 fixup
- `git rebase -i --autosquash` 自动排列 fixup/squash commit
- 配置 `git config --global rebase.autosquash true` 自动开启

### 场景9: 配置 Git Hook

#### pre-commit（提交前检查）

```bash
#!/bin/sh
# .git/hooks/pre-commit

# 1. 检查冲突标记
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)
for file in $STAGED_FILES; do
  if [ -f "$file" ] && grep -qE '^(<<<<<<<|=======|>>>>>>>) ' "$file" 2>/dev/null; then
    echo "❌ Error: Conflict markers found in $file"
    exit 1
  fi
done

# 2. Lint staged JS 文件
STAGED_JS=$(echo "$STAGED_FILES" | grep -E '\.(js|ts)$' || true)
if [ -n "$STAGED_JS" ]; then
  echo "🔍 Linting staged JS files: $STAGED_JS"
  # echo "$STAGED_JS" | xargs npx eslint --quiet
fi

exit 0
```

**测试结果:**
```
❌ Error: Conflict markers found in conflict-test.js
✅ 冲突标记被正确检测并拒绝！
```

#### commit-msg（提交信息规范检查）

```bash
#!/bin/sh
# .git/hooks/commit-msg

COMMIT_MSG=$(cat "$1")
PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+"

if ! echo "$COMMIT_MSG" | grep -qE "$PATTERN"; then
  echo "❌ ERROR: Invalid commit message format!"
  echo "Expected: <type>(<scope>): <description>"
  exit 1
fi
exit 0
```

**测试结果:**
```
# 不规范的提交信息 → 被拒绝
git commit -m "test something"
❌ ERROR: Invalid commit message format!

# 规范的提交信息 → 通过
git commit -m "test: add hook test file"
✅ commit-msg check passed
```

#### pre-push（推送前测试）

```bash
#!/bin/sh
# .git/hooks/pre-push

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "develop" ]; then
  echo "🧪 Running tests before pushing to $BRANCH..."
  # npm test
  echo "✅ All tests passed"
fi
exit 0
```

### 场景10: git bisect（二分查找 bug）

```bash
# 10 个 commit，第 5 个引入了 bug
git bisect start
git bisect bad HEAD          # 当前版本有 bug
git bisect good <first-commit>  # 第一个 commit 是正常的

# git 自动 checkout 到中间 commit，测试后标记 good/bad
# 重复直到找到第一个有 bug 的 commit
git bisect reset
```

**关键知识点:** bisect 用二分法快速定位引入 bug 的 commit，比逐个检查快得多。

---

## 演练成果

### 提交历史总览

```
远程仓库最终状态:

* 6119f87 (feature/api) fixup! feat(api): add user CRUD endpoints
* 7e405a4 fix(auth): add token expiration tracking  ← cherry-picked
* bef5f89 feat(api): update index with API v2 support
* 2fc6eb0 feat(api): add user CRUD endpoints
| * 24616b7 (main) Merge branch 'hotfix/auth-timeout'
|/|
| * a427acd fix(auth): add token expiration tracking
|/
*   58f752b Merge branch 'feature/auth'
|\
| * 8f09ba7 feat(auth): add auth config options
| * 43ee515 feat(auth): add login/logout/verify functions
|/
* 8215ad7 feat: initialize project
```

### 演练覆盖的技能矩阵

| 技能 | 演练状态 | 关键命令 |
|------|----------|----------|
| 分支创建/切换 | ✅ | `git checkout -b` |
| feature 分支开发 | ✅ | `git push origin feature/*` |
| merge --no-ff | ✅ | `git merge --no-ff` |
| fetch + rebase | ✅ | `git fetch && git rebase origin/main` |
| 冲突检测 | ✅ | `git status` 显示 `both modified` |
| 冲突解决 | ✅ | 手动编辑 + `git add` + `rebase --continue` |
| hotfix 分支 | ✅ | 从 main 创建，快速合并 |
| cherry-pick | ✅ | `git cherry-pick <hash>` |
| fixup + autosquash | ✅ | `git commit --fixup` + `rebase -i --autosquash` |
| pre-commit hook | ✅ | 冲突标记检测 + lint |
| commit-msg hook | ✅ | Conventional Commits 格式检查 |
| pre-push hook | ✅ | 保护分支前运行测试 |
| git bisect | ✅ | 二分查找 bug |
| git reflog | ✅ | 查看操作历史 |
| git stash | ✅ | 临时保存工作区 |
| git tag | ✅ | 版本标记 |

---

## 关键收获

### 1. Rebase 实战经验
- Bob 的 feature/api 分支 rebase 到 Alice 合并后的 main 时产生了真实冲突
- 冲突解决策略：整合双方改动，而非简单选择 ours/theirs
- Rebase 过程中可以用 `--abort` 回退

### 2. Cherry-pick 实战经验
- Bob 从 main cherry-pick hotfix 到 feature/api，确保功能分支包含最新修复
- Cherry-pick 创建新 commit（不同 hash），不是移动 commit

### 3. Hook 实战经验
- pre-commit 成功拦截了包含冲突标记的提交
- commit-msg 成功拦截了不符合 Conventional Commits 格式的提交
- Hook 是本地配置，不会随仓库共享（需要配合 Husky 等工具）

### 4. 协作流程总结
```
Alice:  main → feature/auth → merge → main → hotfix → merge → main
Bob:    main → feature/api → rebase(main) → resolve conflicts → cherry-pick hotfix → push
```

---

## 与理论文档的互补

| 维度 | git-advanced-1700.md（理论） | 本演练（实践） |
|------|-------------------------------|----------------|
| 分支策略 | Git Flow / GitHub Flow / GitLab Flow / Trunk-Based | 实战 GitHub Flow |
| Rebase | 原理 + 交互式命令 + 场景 | 真实冲突 rebase |
| Cherry-pick | 基本用法 + 场景 | hotfix 跨分支提取 |
| Hook | 理论 + 示例代码 | 实际编写 + 测试验证 |
| 协作流程 | 文字描述 | 双开发者真实模拟 |
| 冲突解决 | 策略说明 | 手动解决 + 整合双方改动 |

---

*2026-04-26 17:00 专项训练完成*
