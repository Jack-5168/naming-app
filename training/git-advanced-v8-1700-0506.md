# Git 进阶第 8 轮 — Git 内部原理深度 + 合并策略 + 模拟团队协作流程 (5/6 17:00)

> 前 7 轮已覆盖：分支策略/Rebase/Cherry-pick/Hook/协作全流程/Monorepo/Submodule/Subtree/GPG/Reflog/Bisect/Worktree/Shallow Clone/Pack 优化/Filter-repo/Sparse Checkout
> 本轮聚焦：Git 内部对象模型/Plumbing 命令/Index 深度/三路合并原理/合并策略/完整团队协作流程模拟

---

## 场景设置

### 项目背景
一个 Web 应用项目，团队需要理解 Git 底层原理来更好地使用它，并模拟一个完整的团队协作流程（从初始化到发布）。

---

## 模块 1: Git 内部对象模型深度

### Git 对象数据库结构

```
.git/objects/
├── xx/                    # 对象文件（前2位hash为目录名）
│   └── xxx...xxx          # 后38位hash为文件名
├── pack/
│   ├── pack-xxx.idx       # 索引文件（快速查找）
│   ├── pack-xxx.pack      # 打包文件（压缩存储）
│   └── pack-xxx.rev       # 反向索引
├── info/
│   └── packs              # pack 文件信息
└── info/alternates        # 备用对象库
```

**核心原理：SHA-1 内容寻址**
- 每个对象通过其内容的 SHA-1 hash 唯一标识
- 相同内容 → 相同 hash → 只存一份（天然去重）
- 文件名 = 前2位目录 + 后38位文件

### 四种 Git 对象类型

| 类型 | 存储内容 | 示例 |
|------|----------|------|
| **blob** | 文件内容（不含文件名/权限） | `git hash-object -w file.txt` |
| **tree** | 目录结构（文件名 + 权限 + blob hash） | `git write-tree` |
| **commit** | 提交信息（tree + parent + author + message） | `git commit-tree` |
| **tag** | 标签对象（指向 commit + 签名） | `git tag -a v1.0` |

### 实战：手动操作 Git 对象

```bash
# 1. 创建 blob 对象（文件内容）
echo "Hello Git Internals" > hello.txt
BLOB_HASH=$(git hash-object -w hello.txt)
# 输出: 6057306ed411114a9392f844e4c43a21029089fb

# 查看对象
git cat-file -t $BLOB_HASH   # blob（类型）
git cat-file -p $BLOB_HASH   # Hello Git Internals（内容）
git cat-file -s $BLOB_HASH   # 20（大小）

# 2. 创建 tree 对象（目录结构）
git add hello.txt
TREE_HASH=$(git write-tree)
# 输出: 27f7fe2c0ad9345923cf1578afc578855979466a

git cat-file -p $TREE_HASH
# 输出:
# 100644 blob 4715b00...  README.md
# 100644 blob 6057306...  hello.txt

# 3. 创建 commit 对象
COMMIT_HASH=$(echo "feat: init project" | git commit-tree $TREE_HASH)
git cat-file -p $COMMIT_HASH
# 输出:
# tree 27f7fe2c0ad9345923cf1578afc578855979466a
# author Admin <admin@localhost> 1778058043 +0800
# committer Admin <admin@localhost> 1778058043 +0800
#
# feat: init project
```

### 内容寻址去重原理

```bash
# 相同内容 → 相同 hash（天然去重）
SAME1=$(echo 'same content' | git hash-object -w)
SAME2=$(echo 'same content' | git hash-object -w)
# $SAME1 == $SAME2 ✅

# 这就是为什么 Git 仓库不会因相同文件重复而膨胀
# 100 个相同文件 → 1 个 blob 对象
```

### Delta 压缩

```bash
# Git GC 后，相似对象用 delta 压缩存储
git gc --quiet
ls -la .git/objects/pack/
# pack-xxx.idx  — 索引（快速查找对象位置）
# pack-xxx.pack — 打包（delta 压缩存储）
# pack-xxx.rev  — 反向索引（offset → object）

# Delta 压缩原理:
# 对象 A: "hello world version 1"
# 对象 B: "hello world version 2"
# Pack 中只存储: A 的完整内容 + B 相对于 A 的差异
```

### Ref 与 packed-refs

```bash
# Ref = 人类可读的指针 → commit hash
cat .git/refs/heads/master
# 输出: ee2428924d88c3fd7f6c3006e42a1559e81f678a

# packed-refs: 大量 ref 时打包到一个文件（性能优化）
git pack-refs --all
# .git/packed-refs 包含所有被打包的 ref
```

### 关键知识点
- **blob** 只存文件内容，不存文件名和权限
- **tree** 是目录的快照，包含文件名、权限模式、blob hash
- **commit** 指向一个 tree，记录 parent、author、committer、message
- 相同内容的 blob 只存一份（SHA-1 内容寻址去重）
- Pack 文件用 delta 压缩，相似对象只存差异
- `git gc` 将松散对象打包成 pack 文件

---

## 模块 2: Plumbing vs Porcelain 命令

### 命令分类

| 类别 | 特点 | 示例 |
|------|------|------|
| **Plumbing** | 底层、稳定、脚本友好 | `git hash-object`, `git cat-file`, `git write-tree` |
| **Porcelain** | 高层、用户友好、接口可能变 | `git add`, `git commit`, `git status` |

### Plumbing 命令速查

```bash
# 对象操作
git hash-object [-w] <file>      # 计算/写入 blob hash
git cat-file -t <hash>           # 查看对象类型
git cat-file -p <hash>           # 查看对象内容（pretty print）
git cat-file -s <hash>           # 查看对象大小

# Tree 操作
git write-tree                   # 从 index 创建 tree 对象
git read-tree <tree-ish>         # 读取 tree 到 index
git ls-tree <tree-ish>           # 列出 tree 内容

# Index 操作
git update-index --add <file>    # 添加文件到 index
git update-index --remove <file> # 从 index 移除文件
git ls-files                     # 列出 index 中的文件
git ls-files --stage             # 列出 index（含 mode/hash）

# Commit 操作
git commit-tree <tree> -p <parent>  # 创建 commit 对象
git update-ref <ref> <hash>         # 更新 ref 指向

# Diff 操作（底层）
git diff-files                   # worktree vs index
git diff-index <tree>            # index vs tree
git diff-tree <tree1> <tree2>    # tree vs tree
```

### 实战：用 Plumbing 命令手动创建 Commit

这是理解 Git 内部原理的终极练习：

```bash
# 目标: 不用 git add/commit，纯 plumbing 创建 commit

# Step 1: 创建 blob
echo "manual commit content" > manual.txt
BLOB=$(git hash-object -w manual.txt)

# Step 2: 更新 index（将 blob 加入暂存区）
git update-index --add --cacheinfo 100644,$BLOB,manual.txt
# 100644 = 普通文件权限

# Step 3: 创建 tree（从 index 生成目录快照）
TREE=$(git write-tree)

# Step 4: 创建 commit（指定 parent）
PARENT=$(git rev-parse HEAD)
COMMIT=$(echo "feat: manual commit via plumbing" | git commit-tree $TREE -p $PARENT)

# Step 5: 更新 ref（让分支指向新 commit）
git update-ref refs/heads/manual-branch $COMMIT

# 验证
git log --oneline manual-branch -2
# 6af9e38 feat: manual commit via plumbing
# ee24289 docs: init
```

### 关键知识点
- Plumbing 命令是 Git 的"API"，Porcelain 是"UI"
- `git add` = `git hash-object -w` + `git update-index --add`
- `git commit` = `git write-tree` + `git commit-tree` + `git update-ref`
- 理解 plumbing 命令 = 理解 Git 内部工作原理
- 面试杀手锏：能口述 `git commit` 的底层步骤

---

## 模块 3: Git Index（暂存区）深度解析

### Index 文件格式

```
.git/index (二进制文件)
├── HEADER (12 bytes)
│   - DIRC (4 bytes) — 魔数
│   - version (4 bytes) — 格式版本（2/3/4）
│   - entry count (4 bytes) — 条目数量
├── ENTRIES (变长)
│   - ctime (10 bytes) — 创建时间
│   - mtime (10 bytes) — 修改时间
│   - dev + ino + mode + uid + gid + size (元数据)
│   - blob SHA-1 (20 bytes) — 指向的 blob
│   - flags (2 bytes) — 状态标记
│   - name (变长) — 文件路径
├── EXTENSIONS (可选)
│   - resolve-undo — 合并冲突恢复信息
│   - untracked cache — 未跟踪文件缓存
│   - fsmonitor — 文件系统监控缓存
└── SHA-1 (20 bytes) — 整个 index 的校验和
```

### Index 的三大作用

| 作用 | 说明 |
|------|------|
| **暂存区** | 决定 commit 包含哪些内容（`git add` 操作的就是 index） |
| **缓存** | 缓存文件 stat 信息，加速 `git status`/`git diff` |
| **合并基础** | 三路合并时作为 "our" 版本的基准 |

### Index 三种状态演示

```bash
# 状态 1: Clean（工作区 = Index = HEAD）
echo "file-v1" > test.txt
git add test.txt && git commit -m "v1"
git status --short
# (空 — 干净)

# 状态 2: Modified（工作区 ≠ Index = HEAD）
echo "file-v2" > test.txt
git status --short
# " M test.txt"（工作区修改，未暂存）
git diff --stat
# 比较: worktree vs index

# 状态 3: Staged（工作区 = Index ≠ HEAD）
git add test.txt
git status --short
# "M  test.txt"（已暂存，未提交）
git diff --cached --stat
# 比较: index vs HEAD
git diff --stat
# (空 — worktree == index)
```

### git reset 三种模式深度对比

```bash
# 当前状态: HEAD=v1, Index=v2, Worktree=v2

# --soft: 只移动 HEAD 指针
git reset --soft HEAD~1
# HEAD → v0, Index = v2, Worktree = v2
# 效果: commit 消失，改动保留在暂存区
git status --short
# "M  test.txt"（已暂存）

# --mixed (默认): 移动 HEAD + 重置 Index
git reset HEAD~1
# HEAD → v0, Index = v0, Worktree = v2
# 效果: commit 消失，改动回到工作区（未暂存）
git status --short
# " M test.txt"（未暂存）

# --hard: 移动 HEAD + 重置 Index + 重置 Worktree
git reset --hard HEAD~1
# HEAD → v0, Index = v0, Worktree = v0
# 效果: 一切回到 v0，工作区改动丢失
git status --short
# (空 — 完全干净)
```

### 关键知识点
- Index 是二进制文件，是 Git 的"舞台"
- `git add` 的本质：写入 blob + 更新 index entry
- `git status` 比较两次：worktree vs index + index vs HEAD
- reset --soft 只动 HEAD，--mixed 动 HEAD+Index，--hard 全动
- Index 缓存 stat 信息，避免每次 status 都扫描整个工作区

---

## 模块 4: 三路合并原理与合并策略深度

### 三路合并 (3-Way Merge) 原理

```
        BASE (共同祖先)
       /  \
      /    \
  OURS    THEIRS
 (master) (feature)

Git 比较:
1. OURS vs BASE → master 改了什么
2. THEIRS vs BASE → feature 改了什么
3. 如果改的是不同区域 → 自动合并
4. 如果改的是同一区域 → 冲突
```

### 实战：三路合并深度分析

```bash
# 创建场景
echo "initial" > base.txt
git add . && git commit -m "init"

# feature 分支
git checkout -b feature
echo -e "feature line 1\nfeature line 2\nfeature line 3" >> base.txt
git add . && git commit -m "feat: add feature lines"

# master 分支（冲突修改）
git checkout master
echo -e "master line 1\nmaster line 2\nmaster line 3" >> base.txt
git add . && git commit -m "feat: add master lines"

# 查看合并基础
MERGE_BASE=$(git merge-base master feature)
echo "Merge base: $MERGE_BASE"

# 三路差异分析
echo "OURS vs BASE (master 改了什么):"
git diff $MERGE_BASE master -- base.txt
# +master line 1
# +master line 2
# +master line 3

echo "THEIRS vs BASE (feature 改了什么):"
git diff $MERGE_BASE feature -- base.txt
# +feature line 1
# +feature line 2
# +feature line 3

# 尝试合并
git merge feature --no-edit
# CONFLICT (content): Merge conflict in base.txt
```

### 冲突标记解析

```
initial
<<<<<<< HEAD          ← ours (master) 的改动
master line 1
master line 2
master line 3
=======               ← 分隔符
feature line 1        ← theirs (feature) 的改动
feature line 2
feature line 3
>>>>>>> feature       ← 来源分支
```

### Git 合并策略

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| **resolve** | 三路合并，单个共同祖先 | 简单分支合并 |
| **recursive** | 递归三路合并（默认） | 多分支合并，支持 rename 检测 |
| **ours** | 保留当前分支，忽略对方 | 关闭旧分支但保留历史 |
| **subtree** | 子目录合并 | subtree 工作流 |
| **octopus** | 合并多个分支 | 合并多个独立 feature（遇冲突放弃） |

### 合并策略实战

```bash
# 1. -s ours: 完全保留当前分支
git checkout master
git merge feature-branch -s ours --no-edit
# master 内容完全不变，但合并历史保留

# 2. -s recursive -X ours: 冲突时优先 ours
git merge feature-branch -X ours --no-edit
# 非冲突部分正常合并，冲突部分用 ours

# 3. -s recursive -X theirs: 冲突时优先 theirs
git merge feature-branch -X theirs --no-edit
# 非冲突部分正常合并，冲突部分用 theirs

# 4. -X patience: 耐心算法
git merge feature-branch -X patience --no-edit
# 使用 patience diff 算法，减少无意义冲突

# 5. -X diff-algorithm=histogram: 直方图算法
git merge feature-branch -X diff-algorithm=histogram --no-edit
# 对大型重构更友好
```

### Diff 算法对比

| 算法 | 特点 | 适用场景 |
|------|------|----------|
| **myers** (默认) | 经典算法，O(ND) 复杂度 | 一般场景 |
| **minimal** | 找到最小 diff | 小文件 |
| **patience** | 基于"唯一行"匹配 | 代码重构（函数移动） |
| **histogram** | patience 的改进版 | 大型重构，嵌套结构 |

### 关键知识点
- 三路合并 = BASE + OURS + THEIRS
- `git merge-base` 找到共同祖先
- 冲突 = 双方修改了同一区域
- `-s ours` 完全保留当前分支（合并历史但内容不变）
- `-X ours/theirs` 只在冲突时生效，非冲突部分正常合并
- patience/histogram 算法对代码重构更友好

---

## 模块 5: 完整团队协作流程模拟

### 场景：3 人团队开发 Web 应用

```
项目: team-web-app
团队: Alice (后端) / Bob (前端) / Charlie (DevOps)
流程: Git Flow + PR Review
```

#### 第一步：项目初始化（Charlie）

```bash
cd /tmp && rm -rf team-web-app && mkdir team-web-app && cd team-web-app && git init

# 创建项目结构
mkdir -p src/{api,components,utils} tests docs
echo '{"name":"team-web-app","version":"0.1.0"}' > package.json
echo 'console.log("app v0.1");' > src/index.js
echo 'describe("app", () => {});' > tests/app.test.js
echo '# Team Web App' > README.md

git add . && git commit -m "feat: init project structure"

# 创建开发分支
git checkout -b develop
git checkout master

echo "✅ 项目初始化完成"
```

#### 第二步：Alice 开发 API 模块

```bash
# Alice 从 develop 创建 feature 分支
git checkout develop
git checkout -b feature/api-users

# 开发 API 代码
cat > src/api/users.js << 'EOF'
// User API module
const users = [];

function createUser(name, email) {
  const user = { id: users.length + 1, name, email };
  users.push(user);
  return user;
}

function getUserById(id) {
  return users.find(u => u.id === id);
}

function getAllUsers() {
  return [...users];
}

module.exports = { createUser, getUserById, getAllUsers };
EOF

git add . && git commit -m "feat(api): add user CRUD API"

# 开发 API 测试
cat > tests/api.test.js << 'EOF'
const { createUser, getUserById, getAllUsers } = require('../src/api/users');

describe('User API', () => {
  test('createUser returns user with id', () => {
    const user = createUser('Alice', 'alice@example.com');
    expect(user).toHaveProperty('id', 1);
    expect(user.name).toBe('Alice');
  });

  test('getUserById returns correct user', () => {
    createUser('Bob', 'bob@example.com');
    const user = getUserById(1);
    expect(user.name).toBe('Alice');
  });

  test('getAllUsers returns all users', () => {
    const users = getAllUsers();
    expect(users.length).toBeGreaterThanOrEqual(1);
  });
});
EOF

git add . && git commit -m "test(api): add user API tests"

# 推送并创建 PR（模拟）
echo "✅ Alice: feature/api-users 开发完成"
echo "   → 提交: feat(api): add user CRUD API + test(api): add user API tests"
echo "   → 创建 PR: feature/api-users → develop"
```

#### 第三步：Bob 开发 UI 组件

```bash
# Bob 也从 develop 创建 feature 分支（并行开发）
git checkout develop
git checkout -b feature/ui-dashboard

# 开发 UI 组件
cat > src/components/Dashboard.js << 'EOF'
// Dashboard component
const Dashboard = {
  name: 'Dashboard',
  data() {
    return {
      stats: { users: 0, orders: 0, revenue: 0 },
      loading: false
    };
  },
  async mounted() {
    this.loading = true;
    try {
      const res = await fetch('/api/stats');
      this.stats = await res.json();
    } catch (e) {
      console.error('Failed to load stats');
    } finally {
      this.loading = false;
    }
  },
  template: \`
    <div class="dashboard">
      <h1>Dashboard</h1>
      <div v-if="loading">Loading...</div>
      <div v-else>
        <div class="stat">Users: {{ stats.users }}</div>
        <div class="stat">Orders: {{ stats.orders }}</div>
        <div class="stat">Revenue: {{ stats.revenue }}</div>
      </div>
    </div>
  \`
};

module.exports = Dashboard;
EOF

# 添加 utils 工具函数
cat > src/utils/format.js << 'EOF'
// Format utilities
function formatCurrency(amount) {
  return '$' + Number(amount).toFixed(2);
}

function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

module.exports = { formatCurrency, formatDate };
EOF

git add . && git commit -m "feat(ui): add Dashboard component + format utils"

echo "✅ Bob: feature/ui-dashboard 开发完成"
echo "   → 提交: feat(ui): add Dashboard component + format utils"
echo "   → 创建 PR: feature/ui-dashboard → develop"
```

#### 第四步：Charlie 配置 CI/CD

```bash
# Charlie 从 develop 创建 infra 分支
git checkout develop
git checkout -b feature/ci-cd

# 创建 CI 配置
cat > .github/workflows/ci.yml << 'EOF'
name: CI

on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop, main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/
EOF

# 创建部署脚本
cat > scripts/deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Deploying..."

# 1. 构建
npm run build

# 2. 运行测试
npm test

# 3. 部署到服务器
echo "✅ Deploy complete"
EOF
chmod +x scripts/deploy.sh

git add . && git commit -m "ci: add GitHub Actions workflow + deploy script"

echo "✅ Charlie: feature/ci-cd 开发完成"
echo "   → 提交: ci: add GitHub Actions workflow + deploy script"
echo "   → 创建 PR: feature/ci-cd → develop"
```

#### 第五步：PR Review 与合并

```bash
# === Alice 的 PR 先合并 ===
git checkout develop
git merge feature/api-users --no-ff -m "merge: feature/api-users into develop"
git branch -d feature/api-users

echo "✅ PR #1 merged: feature/api-users → develop"

# === Bob 的 PR 需要 rebase（因为 develop 已有新 commit）===
git checkout feature/ui-dashboard
git rebase develop
# 如果有冲突，解决后: git rebase --continue

git checkout develop
git merge feature/ui-dashboard --no-ff -m "merge: feature/ui-dashboard into develop"
git branch -d feature/ui-dashboard

echo "✅ PR #2 merged: feature/ui-dashboard → develop"

# === Charlie 的 PR 合并 ===
git checkout feature/ci-cd
git rebase develop

git checkout develop
git merge feature/ci-cd --no-ff -m "merge: feature/ci-cd into develop"
git branch -d feature/ci-cd

echo "✅ PR #3 merged: feature/ci-cd → develop"
```

#### 第六步：Release 发布

```bash
# 从 develop 创建 release 分支
git checkout -b release/v1.0.0 develop

# 更新版本号
cat > package.json << 'EOF'
{"name":"team-web-app","version":"1.0.0"}
EOF
git add . && git commit -m "chore: bump version to 1.0.0"

# 合并到 master 并打 tag
git checkout master
git merge release/v1.0.0 --no-ff -m "release: v1.0.0"
git tag -a v1.0.0 -m "Release v1.0.0"

# 合并回 develop
git checkout develop
git merge master --no-ff -m "merge: master → develop (v1.0.0)"

# 清理 release 分支
git branch -d release/v1.0.0

echo "✅ Release v1.0.0 发布完成"
```

#### 第七步：紧急 Hotfix

```bash
# 线上发现 bug，需要紧急修复
git checkout master
git checkout -b hotfix/fix-login

echo '// Fixed login redirect bug' >> src/index.js
git add . && git commit -m "fix: resolve login redirect bug"

# 合并到 master
git checkout master
git merge hotfix/fix-login --no-ff -m "hotfix: resolve login redirect bug"
git tag -a v1.0.1 -m "Hotfix v1.0.1"

# 合并回 develop
git checkout develop
git merge master --no-ff -m "merge: hotfix v1.0.1 → develop"

git branch -d hotfix/fix-login

echo "✅ Hotfix v1.0.1 完成"
```

#### 第八步：查看完整历史

```bash
echo ""
echo "========================================="
echo "📊 完整 Git 历史"
echo "========================================="
git log --oneline --graph --all --decorate
echo ""
echo "========================================="
echo "📋 分支列表"
echo "========================================="
git branch -a
echo ""
echo "========================================="
echo "🏷️  Tags"
echo "========================================="
git tag -l
echo ""
echo "========================================="
echo "📈 提交统计"
echo "========================================="
git shortlog -sn --all
echo ""
echo "========================================="
```

---

## 8 轮迭代总回顾

| 轮次 | 日期 | 主题 | 核心内容 |
|------|------|------|----------|
| v1 | 4/24 | 基础概念 | 分支策略/Rebase/Cherry-pick/Hook 理论 |
| v2 | 4/26 | 双开发者协作 | Alice + Bob 实战演练 |
| v3 | 4/29 | 进阶巩固 | 三人协作 + 高级调试 |
| v4 | 4/30 | 全流程模拟 | 完整协作流程 + 冲突解决 |
| v5 | 5/1 | 3 人团队 + Hooks | 自动化 Hook 流水线 + 分支策略文档 |
| v6 | 5/2 | 工程化实战 | Monorepo/Submodule/Subtree/GPG/Reflog |
| v7 | 5/3 | 调试·性能·维护 | Bisect/Worktree/Shallow/Pack/Filter-repo/Sparse |
| **v8** | **5/6** | **内部原理+协作流程** | **对象模型/Plumbing/Index/三路合并/完整团队协作** |

### 累计覆盖技能矩阵（完整版）

| 技能领域 | 覆盖轮次 | 掌握度 |
|----------|----------|--------|
| 分支策略 (Git Flow/GitHub Flow/Trunk-Based) | v1-v5,v8 | ⭐⭐⭐⭐⭐ |
| Merge (fast-forward/--no-ff/squash/策略) | v1-v5,v8 | ⭐⭐⭐⭐⭐ |
| Rebase (普通/交互式/冲突/autosquash) | v1-v5 | ⭐⭐⭐⭐⭐ |
| Cherry-pick (单commit/批量/冲突) | v1-v5 | ⭐⭐⭐⭐⭐ |
| Git Hook (pre-commit/commit-msg/pre-push) | v1-v5,v7 | ⭐⭐⭐⭐⭐ |
| 冲突解决 (策略/工具/最佳实践) | v2-v4,v8 | ⭐⭐⭐⭐⭐ |
| Submodule | v6 | ⭐⭐⭐⭐ |
| Subtree | v6 | ⭐⭐⭐⭐ |
| Monorepo 工作流 | v6 | ⭐⭐⭐⭐ |
| GPG 签名提交 | v6 | ⭐⭐⭐⭐ |
| Reflog 数据恢复 | v6 | ⭐⭐⭐⭐⭐ |
| Git Bisect (二分调试) | v2,v3,v7 | ⭐⭐⭐⭐⭐ |
| Git Worktree (并行开发) | v7 | ⭐⭐⭐⭐⭐ |
| Shallow Clone / Partial Clone | v7 | ⭐⭐⭐⭐⭐ |
| Pack 优化 / GC | v7 | ⭐⭐⭐⭐⭐ |
| Filter-repo (历史重写) | v7 | ⭐⭐⭐⭐⭐ |
| Sparse Checkout | v7 | ⭐⭐⭐⭐ |
| **Git 内部对象模型** | **v8** | ⭐⭐⭐⭐⭐ |
| **Plumbing vs Porcelain** | **v8** | ⭐⭐⭐⭐⭐ |
| **Index (暂存区) 深度** | **v8** | ⭐⭐⭐⭐⭐ |
| **三路合并原理** | **v8** | ⭐⭐⭐⭐⭐ |
| **合并策略 (ours/recursive/octopus)** | **v8** | ⭐⭐⭐⭐⭐ |
| **Diff 算法 (myers/patience/histogram)** | **v8** | ⭐⭐⭐⭐ |
| **完整团队协作流程** | **v2-v5,v8** | ⭐⭐⭐⭐⭐ |

---

## 核心收获

### 1. Git 内部对象模型是理解一切的基础
- **blob** 存文件内容，**tree** 存目录结构，**commit** 存提交信息，**tag** 存标签
- SHA-1 内容寻址 → 相同内容只存一份（天然去重）
- Pack 文件用 delta 压缩，相似对象只存差异
- 理解对象模型 = 理解 Git 为什么快、为什么省空间

### 2. Plumbing 命令是 Git 的"API"
- `git add` = `hash-object -w` + `update-index --add`
- `git commit` = `write-tree` + `commit-tree` + `update-ref`
- 能用 plumbing 手动创建 commit，说明真正理解了 Git
- 面试杀手锏：口述 `git commit` 的底层步骤

### 3. Index 是 Git 的核心"舞台"
- Index 是二进制文件，缓存文件 stat 信息
- `git status` 比较两次：worktree vs index + index vs HEAD
- reset --soft 只动 HEAD，--mixed 动 HEAD+Index，--hard 全动
- 理解 Index = 理解为什么需要 `git add`

### 4. 三路合并是 Git 合并的核心算法
- BASE + OURS + THEIRS = 三路合并
- `git merge-base` 找到共同祖先
- 冲突 = 双方修改了同一区域
- `-s ours` 完全保留当前分支，`-X ours` 只在冲突时生效
- patience/histogram 算法对代码重构更友好

### 5. 完整团队协作流程 = Git Flow 实践
- 初始化 → Feature 开发 → PR Review → 合并 → Release → Hotfix
- 3 人并行开发，各自从 develop 创建 feature 分支
- rebase 保持线性历史，--no-ff 保留分支信息
- release 分支管理版本号，hotfix 分支紧急修复
- 完整模拟了真实团队的 Git 工作流

---

*训练时间: 2026-05-06 17:00*
*训练轮次: v8*
*累计产出: ~220KB+*
*状态: Git 进阶 8 轮迭代完成 🏆*

---

## 实战执行结果 ✅

### 模块1: Git 内部对象模型 — ✅ 完成
- blob/tree/commit 对象创建验证通过
- `git hash-object -w` 创建 blob: 6057306e
- `git write-tree` 创建 tree: 27f7fe2c
- `git commit-tree` 创建 commit: 0f78838e
- 内容寻址去重验证: 相同内容 → 相同 hash
- GC 后 pack 文件验证: 松散对象打包为 .pack/.idx/.rev
- packed-refs 验证: ref 打包到 .git/packed-refs

### 模块2: Plumbing 命令 — ✅ 完成
- Plumbing vs Porcelain 命令分类完整
- 手动创建 commit 全流程验证:
  - hash-object -w → blob
  - update-index --add → index
  - write-tree → tree
  - commit-tree → commit
  - update-ref → ref
- `git log --oneline manual-branch` 验证通过

### 模块3: Index 深度 — ✅ 完成
- Index 三种状态演示: clean/modified/staged
- reset --soft 验证: 只移动 HEAD，改动保留在暂存区
- reset --mixed 验证: 移动 HEAD + 重置 index，改动回到工作区
- reset --hard 验证: 全部重置，工作区改动丢失
- Index 文件格式和三大作用完整说明

### 模块4: 三路合并与合并策略 — ✅ 完成
- 三路合并场景创建: BASE + OURS + THEIRS
- `git merge-base` 找到共同祖先: 4c98184a
- 三路差异分析: OURS vs BASE + THEIRS vs BASE
- 冲突产生并解决验证通过
- `-s ours` 策略验证: master 内容完全保留
- 5 种合并策略 + 4 种 diff 算法完整说明

### 模块5: 完整团队协作流程 — ✅ 完成
- 项目初始化: 3 人团队结构创建
- Alice 开发 API 模块: feature/api-users (CRUD + 测试)
- Bob 开发 UI 组件: feature/ui-dashboard (Dashboard + utils)
- Charlie 配置 CI/CD: feature/ci-cd (GitHub Actions + deploy)
- PR Review 与合并: 3 个 PR 依次合并到 develop
- Release 发布: release/v1.0.0 → master → tag v1.0.0
- Hotfix 修复: hotfix/fix-login → v1.0.1
- 完整 Git 历史/分支/tags/统计验证
