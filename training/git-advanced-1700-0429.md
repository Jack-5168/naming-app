# Git 进阶专项训练 — 分支策略 / Rebase / Cherry-pick / Hook 团队协作模拟

> 专项训练 17:00 | 2026-04-29
> 目标：在已有理论文档（git-advanced-1700.md）和实践演练（git-advanced-practice-1700.md）基础上，进行更高阶的团队协作模拟

---

## 训练概述

| 模块 | 内容 | 难度 |
|------|------|------|
| 一、分支策略实战 | 三种策略对比 + 选型决策 | ⭐⭐ |
| 二、Rebase 深度实战 | 交互式 Rebase + 冲突解决 + autosquash | ⭐⭐⭐ |
| 三、Cherry-pick 实战 | 跨分支修复 + 版本回传 | ⭐⭐⭐ |
| 四、Git Hook 自动化 | pre-commit / commit-msg / pre-push 完整流水线 | ⭐⭐⭐ |
| 五、三人协作模拟 | Alice + Bob + Charlie 三角协作 | ⭐⭐⭐⭐ |
| 六、高级调试技巧 | bisect / reflog / stash / blame | ⭐⭐⭐ |

---

## 一、分支策略实战 — 选型决策

### 1.1 决策矩阵

| 维度 | Git Flow | GitHub Flow | Trunk-Based |
|------|----------|-------------|-------------|
| 团队规模 | 大团队 (10+) | 中小团队 (2-10) | 任何规模 |
| 发布频率 | 固定周期 (周/月) | 随时发布 | 每天多次 |
| 分支数量 | 多 (5+ 永久) | 少 (仅 main) | 极少 |
| 学习曲线 | 高 | 低 | 中 |
| 适用场景 | 传统软件、有 QA 周期 | SaaS、持续交付 | 高频部署、Feature Flag |

### 1.2 实际项目选型示例

**场景 A：电商平台 (Git Flow)**
```
main ──────────────────────────────────────── 生产
  └── develop ─────────────────────────────── 开发集成
        ├── feature/order-system ──────────── 订单系统
        ├── feature/payment-wechat ────────── 微信支付
        ├── feature/shipping-tracker ──────── 物流追踪
        ├── release/v2.0 ──────────────────── 预发布 (QA 测试)
        └── hotfix/pay-timeout ────────────── 紧急修复
```

**场景 B：SaaS 管理后台 (GitHub Flow)**
```
main ──────────────────────────────────────── 随时可部署
  └── feat/dashboard-charts ── PR → merge
  └── fix/user-export ──────── PR → merge
  └── refactor/api-client ──── PR → merge
```

**场景 C：高频迭代产品 (Trunk-Based)**
```
main ──────────────────────────────────────── 主干 (每天合并 10+)
  ├── short-lived branch (几小时) → tiny PR → merge
  └── Feature Flags: darkMode, newCheckout, betaSearch
```

### 1.3 分支命名规范（团队级）

```bash
# 格式：{type}/{scope}/{description}
# type: feat, fix, hotfix, release, refactor, docs, chore
# scope: 模块名 (auth, api, ui, config)
# description: 简短描述，用 - 连接

# 示例
feat/auth/login-page
fix/api/timeout-error
hotfix/pay/critical-bug
release/v2.1.0
refactor/ui/component-lib
docs/api/swagger-update
chore/deps/upgrade-vue3
```

---

## 二、Rebase 深度实战

### 2.1 交互式 Rebase 完整操作

```bash
# 查看当前提交历史
git log --oneline --graph --all
# a1b2c3 (HEAD → feature/user-profile) feat: add avatar upload
# d4e5f6 fix: avatar size validation
# g7h8i9 feat: add profile page
# h0i1j2 fix: typo in profile title
# k3l4m5 feat: add bio field
# n6o7p8 fix: bio character limit
# q9r0s1 feat: add settings page
# t2u3v4 fix: settings save button
# w5x6y7 feat: initial user module

# 目标：整理为 3 个清晰的 commit
# 1. feat(user): add profile page with avatar and bio
# 2. feat(user): add settings page
# 3. feat(user): add avatar upload functionality

git rebase -i HEAD~9
```

**编辑器中的操作：**
```
pick w5x6y7 feat: initial user module
fixup t2u3v4 fix: settings save button          # → 合并到 settings
pick q9r0s1 feat: add settings page
fixup n6o7p8 fix: bio character limit            # → 合并到 bio
fixup h0i1j2 fix: typo in profile title          # → 合并到 profile
pick k3l4m5 feat: add bio field
fixup d4e5f6 fix: avatar size validation         # → 合并到 avatar
pick a1b2c3 feat: add avatar upload

# 修改为：
pick w5x6y7 feat: initial user module
fixup t2u3v4 fix: settings save button
pick q9r0s1 feat: add settings page
fixup n6o7p8 fix: bio character limit
fixup h0i1j2 fix: typo in profile title
pick k3l4m5 feat: add bio field
fixup d4e5f6 fix: avatar size validation
pick a1b2c3 feat: add avatar upload

# 保存后，reword 合并后的 commit message
```

**最终结果：**
```
# git log --oneline
a1b2c3 feat(user): add avatar upload with size validation
k3l4m5 feat(user): add profile page with bio field
q9r0s1 feat(user): add settings page with save button
w5x6y7 feat: initial user module
```

### 2.2 Rebase 冲突深度解析

**冲突场景：三方修改同一文件**

```
# Alice 在 main 上修改了 config.js
# Bob 在 feature/api 上修改了 config.js
# Charlie 在 feature/ui 上也修改了 config.js

# config.js 冲突内容：
<<<<<<< HEAD (Bob 的 rebase 目标 - Alice 的改动)
export const API_BASE = "https://api-v2.example.com";
export const TIMEOUT = 5000;
export const AUTH_ENABLED = true;
=======
export const API_BASE = "https://api.example.com";
export const TIMEOUT = 3000;
export const UI_THEME = "dark";
>>>>>>> feature/ui (Charlie 的改动)
```

**解决策略 — 整合三方改动：**
```javascript
export const API_BASE = "https://api-v2.example.com";  // Alice 的 v2
export const TIMEOUT = 5000;                            // Alice 的超时
export const AUTH_ENABLED = true;                       // Alice 的认证
export const UI_THEME = "dark";                         // Charlie 的主题
```

### 2.3 split commit — 拆分一个 commit 为多个

```bash
# 某个 commit 包含了多个不相关的改动
git log --oneline
# abc123 feat: add user module and fix config  ← 这个 commit 太杂

git rebase -i HEAD~3
# 将 abc123 改为 edit

# 暂停后，撤销该 commit 但保留文件改动
git reset HEAD~1

# 分别暂存和提交
git add src/user.js src/user.css
git commit -m "feat(user): add user profile component"

git add src/config.js
git commit -m "fix(config): update API timeout"

# 继续 rebase
git rebase --continue
```

---

## 三、Cherry-pick 实战

### 3.1 版本回传（Release Branch → Main）

```bash
# v1.x 分支上修复了一个 bug，需要回传到 main
git log --oneline v1.x
# a1b2c3 fix(security): patch SQL injection in login    ← 需要回传
# d4e5f6 fix(ui): fix button alignment
# g7h8i9 feat(v1): add export feature

# 回传到 main
git checkout main
git cherry-pick a1b2c3

# 同样回传到 v2.x
git checkout v2.x
git cherry-pick a1b2c3
```

### 3.2 跨仓库 Cherry-pick

```bash
# 从 fork 的仓库中挑拣有用的 commit
git remote add upstream https://github.com/original/project.git
git fetch upstream

# 查看 upstream 的提交
git log --oneline upstream/main | head -20

# 挑拣特定 commit
git cherry-pick upstream/main~5
git cherry-pick upstream/main~3
```

### 3.3 Cherry-pick 与 Merge 的选择决策

```
决策树：

需要合并的 commit 数量？
├── 1 个 → Cherry-pick ✅
├── 2-3 个相关 commit → Cherry-pick ✅
├── 2-3 个不相关 commit → 分别 Cherry-pick ✅
├── 完整分支 (5+ commits) → Merge/Rebase ✅
└── 需要保留完整历史 → Merge ✅
```

---

## 四、Git Hook 自动化流水线

### 4.1 完整 Hook 配置

#### pre-commit — 提交前质量检查

```bash
#!/bin/sh
# .git/hooks/pre-commit
# 职责：阻止低质量代码进入仓库

# 1. 检查冲突标记
echo "🔍 Checking for conflict markers..."
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)
for file in $STAGED_FILES; do
  if [ -f "$file" ] && grep -qE '^(<<<<<<<|=======|>>>>>>>) ' "$file" 2>/dev/null; then
    echo "❌ Error: Conflict markers found in $file"
    echo "   Resolve conflicts before committing."
    exit 1
  fi
done

# 2. 检查敏感信息（硬编码密码/密钥）
echo "🔍 Checking for secrets..."
for file in $STAGED_FILES; do
  if [ -f "$file" ]; then
    if grep -qE '(password|secret|api_key|token)\s*[:=]\s*["\x27][a-zA-Z0-9]{8,}' "$file" 2>/dev/null; then
      echo "❌ Error: Possible secret found in $file"
      echo "   Use environment variables instead."
      exit 1
    fi
  fi
done

# 3. 检查文件大小（阻止大文件）
echo "🔍 Checking file sizes..."
for file in $STAGED_FILES; do
  if [ -f "$file" ]; then
    SIZE=$(wc -c < "$file")
    if [ "$SIZE" -gt 1048576 ]; then  # 1MB
      echo "❌ Error: $file is too large (${SIZE} bytes)"
      echo "   Consider using git-lfs or removing large files."
      exit 1
    fi
  fi
done

# 4. 格式化 staged 文件
echo "🔧 Formatting staged files..."
echo "$STAGED_FILES" | grep -E '\.(js|ts|vue|json|md)$' | xargs npx prettier --write 2>/dev/null

# 5. 重新暂存格式化后的文件
if [ -n "$STAGED_FILES" ]; then
  echo "$STAGED_FILES" | grep -E '\.(js|ts|vue|json|md)$' | xargs git add 2>/dev/null
fi

echo "✅ Pre-commit checks passed"
exit 0
```

#### commit-msg — 提交信息规范

```bash
#!/bin/sh
# .git/hooks/commit-msg
# 职责：强制 Conventional Commits 格式

COMMIT_MSG=$(cat "$1")

# 移除注释行（git 自动添加的）
COMMIT_MSG=$(echo "$COMMIT_MSG" | grep -v '^#')

# Conventional Commits 正则
PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z\-]+\))?: .{1,72}"

if ! echo "$COMMIT_MSG" | head -1 | grep -qE "$PATTERN"; then
  echo ""
  echo "❌ ERROR: Invalid commit message format!"
  echo ""
  echo "Expected: <type>(<scope>): <description>"
  echo ""
  echo "Types:"
  echo "  feat     — 新功能"
  echo "  fix      — 修复 bug"
  echo "  docs     — 文档变更"
  echo "  style    — 代码格式（不影响功能）"
  echo "  refactor — 重构（非新功能/非修复）"
  echo "  perf     — 性能优化"
  echo "  test     — 测试相关"
  echo "  build    — 构建系统/外部依赖"
  echo "  ci       — CI 配置"
  echo "  chore    — 其他变更"
  echo "  revert   — 回退"
  echo ""
  echo "Examples:"
  echo "  feat(auth): add OAuth2 login support"
  echo "  fix(api): handle network timeout gracefully"
  echo "  docs(readme): update installation guide"
  echo ""
  exit 1
fi

# 检查是否有 !（BREAKING CHANGE 标记）
if echo "$COMMIT_MSG" | head -1 | grep -qE '^(feat|fix)(\(.+\))?!:'; then
  echo "⚠️  WARNING: Breaking change detected!"
  echo "   Ensure this is intentional and documented."
fi

echo "✅ Commit message format valid"
exit 0
```

#### pre-push — 推送前测试

```bash
#!/bin/sh
# .git/hooks/pre-push
# 职责：保护重要分支不被破坏

read LOCAL_REF LOCAL_SHA REMOTE_REF REMOTE_SHA

BRANCH=$(echo "$REMOTE_REF" | sed 's|refs/heads/||')

# 只保护 main 和 develop 分支
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "develop" ]; then
  echo "🧪 Running test suite before pushing to $BRANCH..."
  echo "   (This may take a moment...)"

  # 运行测试
  if command -v npm &> /dev/null; then
    npm test -- --run 2>&1
    TEST_RESULT=$?
  elif command -v yarn &> /dev/null; then
    yarn test --run 2>&1
    TEST_RESULT=$?
  else
    echo "⚠️  No test runner found, skipping tests"
    TEST_RESULT=0
  fi

  if [ $TEST_RESULT -ne 0 ]; then
    echo ""
    echo "❌ Tests failed! Push to $BRANCH aborted."
    echo "   Fix failing tests before pushing."
    exit 1
  fi

  echo "✅ All tests passed"
fi

exit 0
```

### 4.2 Husky 集成（现代方案）

```bash
# 安装
npm install --save-dev husky lint-staged @commitlint/cli @commitlint/config-conventional

# 初始化
npx husky init

# package.json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{js,ts,vue,css,md,json}": [
      "prettier --write"
    ],
    "*.{js,ts,vue}": [
      "eslint --fix --quiet"
    ]
  }
}

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
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
  }
};

# .husky/pre-commit
npx lint-staged

# .husky/commit-msg
npx --no -- commitlint --edit ${1}

# .husky/pre-push
npm test -- --run
```

---

## 五、三人协作模拟（Alice + Bob + Charlie）

### 5.1 环境搭建

```bash
#!/bin/bash
# 完整协作模拟脚本

set -e

# 清理旧环境
rm -rf /tmp/git-trio-sim
mkdir -p /tmp/git-trio-sim && cd /tmp/git-trio-sim

# ═══════════════════════════════════════════
# 步骤 1: Alice 初始化项目
# ═══════════════════════════════════════════
echo "=== Step 1: Alice 初始化项目 ==="
git init
git branch -m main

cat > README.md << 'EOF'
# Team Project
A collaborative project with three developers.
EOF

cat > package.json << 'EOF'
{
  "name": "team-project",
  "version": "1.0.0",
  "scripts": {
    "test": "echo \"All tests passed!\" && exit 0",
    "lint": "echo \"Linting passed!\" && exit 0"
  }
}
EOF

mkdir -p src
cat > src/index.js << 'EOF'
export function init() {
  console.log("Project initialized");
}
EOF

cat > src/config.js << 'EOF'
export const VERSION = "1.0.0";
export const API_BASE = "https://api.example.com";
export const DEBUG = false;
EOF

git add .
git commit -m "feat: initialize project structure"

# 创建 bare 远程仓库
git clone --bare . ../remote.git
git remote add origin ../remote.git
git push -u origin main

# ═══════════════════════════════════════════
# 步骤 2: 三人同时克隆
# ═══════════════════════════════════════════
echo "=== Step 2: 三人克隆仓库 ==="
cd /tmp/git-trio-sim

git clone remote.git alice-repo
git clone remote.git bob-repo
git clone remote.git charlie-repo

# ═══════════════════════════════════════════
# 步骤 3: Alice 开发 feature/auth
# ═══════════════════════════════════════════
echo "=== Step 3: Alice 开发 feature/auth ==="
cd /tmp/git-trio-sim/alice-repo
git config user.name "Alice"
git config user.email "alice@team.com"

git checkout -b feature/auth

cat > src/auth.js << 'EOF'
export function login(username, password) {
  if (!username || !password) {
    throw new Error("Username and password required");
  }
  return { token: generateToken(), user: username };
}

export function logout(token) {
  // Invalidate token
  return { success: true };
}

export function verifyToken(token) {
  return { valid: token && token.length > 10 };
}

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
EOF

cat > src/config.js << 'EOF'
export const VERSION = "1.0.0";
export const API_BASE = "https://api.example.com";
export const DEBUG = false;
export const AUTH_ENABLED = true;
export const SESSION_TIMEOUT = 3600;
EOF

git add .
git commit -m "feat(auth): add login/logout/verify functions"

# Alice 再提交一个文档 commit
cat > docs/auth.md << 'EOF'
# Auth Module

## API
- `login(username, password)` — 用户登录
- `logout(token)` — 用户登出
- `verifyToken(token)` — 验证 token
EOF

git add .
git commit -m "docs(auth): add auth module documentation"

# Alice 推送并合并
git push origin feature/auth
git checkout main
git merge --no-ff feature/auth -m "Merge branch 'feature/auth'"
git push origin main
git branch -d feature/auth

# ═══════════════════════════════════════════
# 步骤 4: Bob 开发 feature/api（基于旧版本）
# ═══════════════════════════════════════════
echo "=== Step 4: Bob 开发 feature/api ==="
cd /tmp/git-trio-sim/bob-repo
git config user.name "Bob"
git config user.email "bob@team.com"

git checkout -b feature/api

# Bob 修改 config.js（与 Alice 冲突！）
cat > src/config.js << 'EOF'
export const VERSION = "1.1.0";
export const API_BASE = "https://api-v2.example.com";
export const DEBUG = false;
export const MAX_RETRIES = 3;
export const LOG_LEVEL = "info";
EOF

cat > src/api.js << 'EOF'
export async function fetchUser(id) {
  const response = await fetch(`${API_BASE}/users/${id}`);
  return response.json();
}

export async function createUser(data) {
  const response = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function updateUser(id, data) {
  const response = await fetch(`${API_BASE}/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function deleteUser(id) {
  const response = await fetch(`${API_BASE}/users/${id}`, {
    method: "DELETE",
  });
  return response.json();
}
EOF

git add .
git commit -m "feat(api): add user CRUD operations"

# Bob 再添加一个错误处理 commit
cat > src/errors.js << 'EOF'
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function handleApiError(error) {
  if (error instanceof ApiError) {
    console.error(`API Error [${error.status}]: ${error.message}`);
    return { error: error.message, status: error.status };
  }
  console.error("Unknown error:", error);
  return { error: "Internal server error", status: 500 };
}
EOF

git add .
git commit -m "feat(api): add error handling utilities"

# ═══════════════════════════════════════════
# 步骤 5: Charlie 开发 feature/ui（也与 Alice 冲突）
# ═══════════════════════════════════════════
echo "=== Step 5: Charlie 开发 feature/ui ==="
cd /tmp/git-trio-sim/charlie-repo
git config user.name "Charlie"
git config user.email "charlie@team.com"

git checkout -b feature/ui

# Charlie 也修改 config.js（三方冲突！）
cat > src/config.js << 'EOF'
export const VERSION = "1.0.0";
export const API_BASE = "https://api.example.com";
export const DEBUG = true;
export const UI_THEME = "dark";
export const ANIMATION_ENABLED = true;
EOF

cat > src/ui.js << 'EOF'
export function render(component, container) {
  const html = typeof component === 'function' ? component() : component;
  container.innerHTML = html;
}

export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
  children.forEach(child => {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  });
  return el;
}

export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
EOF

git add .
git commit -m "feat(ui): add render utilities and debounce"

# ═══════════════════════════════════════════
# 步骤 6: Bob rebase 到最新 main → 冲突！
# ═══════════════════════════════════════════
echo "=== Step 6: Bob rebase → 冲突！==="
cd /tmp/git-trio-sim/bob-repo
git fetch origin

echo "Bob 执行: git rebase origin/main"
git rebase origin/main 2>&1 || true

# 查看冲突
echo ""
echo "Bob 的冲突文件:"
git diff --name-only --diff-filter=U 2>/dev/null || echo "  src/config.js (both modified)"

# Bob 解决冲突：整合 Alice 的 AUTH 和自己的 API v2
cat > src/config.js << 'EOF'
export const VERSION = "1.1.0";
export const API_BASE = "https://api-v2.example.com";
export const DEBUG = false;
export const MAX_RETRIES = 3;
export const LOG_LEVEL = "info";
export const AUTH_ENABLED = true;
export const SESSION_TIMEOUT = 3600;
EOF

git add src/config.js
git rebase --continue 2>&1 || true

echo "Bob rebase 完成，推送 feature/api"
git push origin feature/api

# ═══════════════════════════════════════════
# 步骤 7: Charlie rebase 到最新 main → 更复杂的冲突！
# ═══════════════════════════════════════════
echo ""
echo "=== Step 7: Charlie rebase → 更复杂冲突！==="
cd /tmp/git-trio-sim/charlie-repo
git fetch origin

echo "Charlie 执行: git rebase origin/main"
git rebase origin/main 2>&1 || true

# Charlie 解决三方冲突：整合 Alice 的 AUTH + Bob 的 API v2 + 自己的 UI
cat > src/config.js << 'EOF'
export const VERSION = "1.1.0";
export const API_BASE = "https://api-v2.example.com";
export const DEBUG = true;
export const AUTH_ENABLED = true;
export const SESSION_TIMEOUT = 3600;
export const MAX_RETRIES = 3;
export const LOG_LEVEL = "info";
export const UI_THEME = "dark";
export const ANIMATION_ENABLED = true;
EOF

git add src/config.js
git rebase --continue 2>&1 || true

echo "Charlie rebase 完成，推送 feature/ui"
git push origin feature/ui

# ═══════════════════════════════════════════
# 步骤 8: Alice 发现紧急 bug，创建 hotfix
# ═══════════════════════════════════════════
echo ""
echo "=== Step 8: Alice 创建 hotfix ==="
cd /tmp/git-trio-sim/alice-repo
git pull origin main

git checkout -b hotfix/auth-token-expiry main

cat > src/auth.js << 'EOF'
export function login(username, password) {
  if (!username || !password) {
    throw new Error("Username and password required");
  }
  return {
    token: generateToken(),
    user: username,
    expires: Date.now() + 3600000,  // 1 hour
  };
}

export function logout(token) {
  return { success: true };
}

export function verifyToken(token) {
  if (!token || !token.expires) return { valid: false };
  const expired = Date.now() > token.expires;
  return { valid: !expired, expired };
}

export function isTokenExpired(token) {
  return token ? Date.now() > token.expires : true;
}

function generateToken() {
  return {
    value: Math.random().toString(36).substring(2) + Date.now().toString(36),
    expires: Date.now() + 3600000,
  };
}
EOF

git add .
git commit -m "fix(auth): add token expiration tracking"

git checkout main
git merge --no-ff hotfix/auth-token-expiry -m "Merge branch 'hotfix/auth-token-expiry'"
git push origin main
git branch -d hotfix/auth-token-expiry

# ═══════════════════════════════════════════
# 步骤 9: Bob 和 Charlie cherry-pick hotfix
# ═══════════════════════════════════════════
echo ""
echo "=== Step 9: Bob cherry-pick hotfix ==="
cd /tmp/git-trio-sim/bob-repo
git fetch origin

# 找到 hotfix commit
HOTFIX_HASH=$(git log --oneline origin/main | grep "fix(auth)" | head -1 | awk '{print $1}')
echo "Hotfix commit: $HOTFIX_HASH"

git checkout feature/api
git cherry-pick $HOTFIX_HASH 2>&1 || {
  echo "Cherry-pick 冲突，需要解决"
  # 简化处理：接受 incoming 的 auth.js
  git checkout --theirs src/auth.js 2>/dev/null || true
  git add src/auth.js 2>/dev/null || true
  git cherry-pick --continue 2>&1 || true
}

echo ""
echo "=== Step 9b: Charlie cherry-pick hotfix ==="
cd /tmp/git-trio-sim/charlie-repo
git fetch origin

git checkout feature/ui
git cherry-pick $HOTFIX_HASH 2>&1 || {
  echo "Cherry-pick 冲突，需要解决"
  git checkout --theirs src/auth.js 2>/dev/null || true
  git add src/auth.js 2>/dev/null || true
  git cherry-pick --continue 2>&1 || true
}

# ═══════════════════════════════════════════
# 步骤 10: 最终合并
# ═══════════════════════════════════════════
echo ""
echo "=== Step 10: 最终合并 ==="

# Bob 合并 feature/api
cd /tmp/git-trio-sim/bob-repo
git fetch origin
git rebase origin/main 2>&1 || true
git checkout main
git merge --no-ff feature/api -m "Merge branch 'feature/api'"
git push origin main

# Charlie 合并 feature/ui
cd /tmp/git-trio-sim/charlie-repo
git fetch origin
git rebase origin/main 2>&1 || true
git checkout main
git merge --no-ff feature/ui -m "Merge branch 'feature/ui'"
git push origin main

echo ""
echo "=== 协作完成！==="
echo "最终提交历史:"
cd /tmp/git-trio-sim/alice-repo
git fetch origin
git log --oneline --graph --all origin/main
```

### 5.2 协作流程总结

```
时间线：

T0: Alice 初始化 main
T1: Alice → feature/auth → merge → main
T2: Bob → feature/api (基于 T0)     ← 与 Alice 冲突
T3: Charlie → feature/ui (基于 T0)  ← 与 Alice 冲突
T4: Bob rebase(main) → 解决冲突 → push
T5: Charlie rebase(main) → 解决冲突 → push
T6: Alice → hotfix → merge → main
T7: Bob cherry-pick hotfix → merge
T8: Charlie cherry-pick hotfix → merge

最终 main 包含：
- Alice: auth module + hotfix
- Bob: api module + error handling
- Charlie: ui utilities
```

### 5.3 冲突分析

| 冲突 | 涉及方 | 文件 | 解决策略 |
|------|--------|------|----------|
| 冲突 1 | Alice vs Bob | src/config.js | 整合双方配置 |
| 冲突 2 | Alice vs Charlie | src/config.js | 整合双方配置 |
| 冲突 3 | Bob vs Charlie (rebase) | src/config.js | 整合三方配置 |
| 冲突 4 | hotfix cherry-pick | src/auth.js | 接受 hotfix 版本 |

---

## 六、高级调试技巧

### 6.1 git bisect — 二分查找

```bash
# 场景：某个功能突然坏了，不知道哪个 commit 引入的
git bisect start
git bisect bad HEAD           # 当前版本有 bug
git bisect good v1.0.0        # v1.0.0 是正常的

# Git 自动 checkout 到中间 commit
# 你测试后标记：
git bisect good               # 这个版本正常
git bisect bad                # 这个版本有 bug

# 重复直到找到第一个有 bug 的 commit
# 100 个 commit 只需 log2(100) ≈ 7 次测试

git bisect reset
```

**自动化 bisect：**
```bash
# 用脚本自动测试
git bisect start
git bisect bad HEAD
git bisect good v1.0.0
git bisect run npm test       # 自动运行测试，0=good, 1=bad
git bisect reset
```

### 6.2 git reflog — 找回"丢失"的 commit

```bash
# 查看所有 HEAD 移动历史
git reflog
# abc123 HEAD@{0}: commit: feat: add new feature
# def456 HEAD@{1}: rebase: checkout main
# ghi789 HEAD@{2}: commit: fix: important bug
# jkl012 HEAD@{3}: reset: moving to HEAD~3

# 找回被 reset 掉的 commit
git reset --hard HEAD@{3}

# 找回被删除的分支
git branch recovered-branch abc123

# 找回被 cherry-pick 覆盖的 commit
git reflog show feature-branch
```

### 6.3 git blame — 追溯代码来源

```bash
# 查看每行代码的最后修改者
git blame src/auth.js
# abc123 (Alice 2026-04-29 10:00:00 +0800  1) export function login(username, password) {
# def456 (Bob   2026-04-29 11:00:00 +0800  2)   if (!username || !password) {
# abc123 (Alice 2026-04-29 10:00:00 +0800  3)     throw new Error("...");

# 跟踪某行代码的完整历史
git blame -L 5,5 src/auth.js

# 忽略空白变更
git blame -w src/auth.js

# 显示 commit 的父 commit（用于追踪引入改动的原始 commit）
git blame -p src/auth.js
```

### 6.4 git stash — 高级用法

```bash
# 保存当前工作区（包含未跟踪文件）
git stash push -u -m "WIP: auth module half done"

# 查看 stash 列表
git stash list
# stash@{0}: On feature/auth: WIP: auth module half done
# stash@{1}: On main: WIP: config changes

# 从 stash 创建新分支
git stash branch urgent-fix stash@{0}

# 应用 stash 的特定文件
git stash show -p stash@{0} -- src/config.js | git apply

# 清空所有 stash
git stash clear
```

---

## 七、实战 Checklist

### 日常开发 Checklist
- [ ] 从最新 main 创建分支：`git fetch && git checkout -b feature/xxx origin/main`
- [ ] 小步提交，每个 commit 只做一件事
- [ ] 提交信息遵循 Conventional Commits
- [ ] 推送前 rebase 到最新 main
- [ ] 推送后创建 PR，请求 Code Review
- [ ] Review 通过后合并，删除分支

### 冲突解决 Checklist
- [ ] `git fetch` 获取最新远程状态
- [ ] `git rebase origin/main` 变基
- [ ] `git status` 查看冲突文件
- [ ] 手动编辑冲突文件，删除冲突标记
- [ ] `git add` 标记已解决
- [ ] `git rebase --continue` 继续
- [ ] 如果出错：`git rebase --abort` 回退

### 代码发布 Checklist
- [ ] 所有测试通过
- [ ] 提交信息规范
- [ ] 代码已 Review
- [ ] 已更新 CHANGELOG
- [ ] 已打 tag：`git tag -a v1.0.0 -m "Release v1.0.0"`
- [ ] 推送 tag：`git push origin v1.0.0`

---

## 八、总结

### 核心要点回顾

| 技能 | 关键命令 | 使用场景 |
|------|----------|----------|
| 分支策略 | 选型决策 | 根据团队规模和发布频率选择 |
| Rebase | `rebase -i` / `--autosquash` | 整理本地提交历史 |
| Cherry-pick | `cherry-pick <hash>` | 跨分支提取单个 commit |
| Hook | pre-commit / commit-msg / pre-push | 自动化质量检查 |
| 冲突解决 | rebase + 手动编辑 | 多人修改同一文件 |
| Bisect | `bisect start/good/bad` | 二分查找引入 bug 的 commit |
| Reflog | `reflog` + `reset` | 找回"丢失"的提交 |

### Git 工作流最佳实践

```
1. 每天开始：git fetch && git rebase origin/main
2. 开发中：小步提交，每个 commit 一个逻辑变更
3. 提交前：检查冲突标记、格式化代码、规范提交信息
4. 推送前：rebase 到最新 main，确保 CI 通过
5. 合并后：删除 feature 分支
6. 遇到问题：reflog 找回、bisect 定位、stash 暂存
```

### 团队协作黄金法则

1. **main 永远可部署** — 不推送未测试的代码
2. **小步快跑** — 频繁合并，减少冲突
3. **清晰的提交信息** — 让历史可读
4. **Code Review** — 至少一人 review 后合并
5. **不 rebase 共享分支** — 只 rebase 个人分支
6. **及时沟通** — 冲突时与队友协商解决方案

---

*2026-04-29 17:00 专项训练完成*
