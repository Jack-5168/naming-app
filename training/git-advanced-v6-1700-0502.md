# Git 进阶第 6 轮 — 高级工作流与工程化 (5/2 17:00)

## 主题: 大型项目 Git 工程化 — Submodule/Monorepo/Subtree/GPG/Reflog 深度实战

> 前 5 轮已覆盖：分支策略、Rebase、Cherry-pick、Hook、3 人协作全流程。
> 本轮聚焦：大型项目场景下的高级工作流和工程化实践。

---

## 场景设置

### 项目背景
一家公司有 3 个仓库：
- **core-lib** — 核心库（多个项目共享）
- **web-app** — Web 前端（依赖 core-lib）
- **mobile-app** — 移动端（依赖 core-lib）

需要解决：依赖管理、发布一致性、安全签名、历史追溯。

---

## 模块 1: Git Submodule 实战

### 问题
core-lib 被 web-app 和 mobile-app 同时依赖。复制粘贴代码导致维护噩梦。

### 解决方案

```bash
# 1. 创建 core-lib 仓库
mkdir core-lib && cd core-lib
git init
cat > src/utils.js << 'EOF'
export function formatDate(d) { return d.toISOString().split('T')[0]; }
export function generateId() { return Math.random().toString(36).slice(2, 10); }
EOF
git add . && git commit -m "feat: add utility functions"
git tag v1.0.0

# 2. web-app 引入 core-lib 作为 submodule
cd ..
mkdir web-app && cd web-app
git init
git submodule add ../core-lib src/lib/core
# 生成 .gitmodules 文件

# 3. 查看 submodule 状态
git submodule status
# abc1234 src/lib/core (v1.0.0)

# 4. 克隆带 submodule 的仓库（新手常踩坑！）
# ❌ 错误: git clone ... → submodule 目录为空
# ✅ 正确:
git clone --recurse-submodules ../web-app web-app-clone
# 或:
git clone ../web-app web-app-clone
cd web-app-clone
git submodule update --init --recursive

# 5. 更新 submodule 到最新版本
cd src/lib/core
git fetch origin
git checkout v1.1.0  # 假设 core-lib 发布了新版本
cd ../../..
git add src/lib/core  # 记录 submodule 的新指针
git commit -m "chore: update core-lib to v1.1.0"
```

### .gitmodules 文件
```ini
[submodule "core-lib"]
    path = src/lib/core
    url = ../core-lib
```

### 关键知识点
- Submodule 记录的是 **commit hash**，不是分支名
- 每次更新 submodule 指针，都需要在主仓库 commit
- `--recurse-submodules` 是克隆时最常见的遗漏
- 缺点：submodule 版本更新不够透明，容易忘记更新

---

## 模块 2: Git Subtree 实战

### Submodule vs Subtree 对比

| 维度 | Submodule | Subtree |
|------|-----------|---------|
| 配置 | 需要 .gitmodules | 无需额外配置 |
| 克隆 | 需要 --recurse-submodules | 自动包含文件 |
| 更新 | 需要 submodule update | git subtree pull |
| 历史 | 分离的 | 合并到主仓库历史 |
| 适用场景 | 外部依赖、频繁更新 | 内部库、较少更新 |

### Subtree 操作

```bash
# 1. 添加 subtree
cd web-app
git subtree add --prefix=src/lib/core ../core-lib main --squash
# --squash: 将 core-lib 的多个 commit 压缩为一个

# 2. 拉取 core-lib 的更新
git subtree pull --prefix=src/lib/core ../core-lib main --squash

# 3. 向 core-lib 推送改动（如果 web-app 修改了 core-lib 的代码）
git subtree push --prefix=src/lib/core ../core-lib main

# 4. 查看 subtree 的历史
git log --oneline -- src/lib/core
```

### 关键知识点
- Subtree 将子项目的文件直接放入主仓库的指定目录
- 没有 .gitmodules，克隆时自动包含所有文件
- `--squash` 避免污染主仓库历史
- 适合：内部共享库、不想管理 submodule 指针的团队

---

## 模块 3: Monorepo 工作流

### Monorepo 项目结构
```
monorepo/
├── packages/
│   ├── core/          # 核心库
│   ├── web/           # Web 应用
│   └── mobile/        # 移动端
├── scripts/
│   ├── release.sh     # 发布脚本
│   └── lint-all.sh    # 统一 lint
├── package.json       # 根 package.json (workspaces)
└── turbo.json         # Turborepo 配置
```

### Monorepo 的核心 Git 技巧

#### 1. 按包过滤变更
```bash
# 查看 core 包最近的变更
git log --oneline -- packages/core/

# 查看哪些包有未提交的改动
git diff --name-only | cut -d/ -f2 | sort -u
# 输出: core, web

# 只提交某个包的改动
git add packages/core/
git commit -m "feat(core): add caching layer"
```

#### 2. 跨包提交规范
```bash
# 同时修改了 core 和 web
git add packages/core/src/cache.js packages/web/src/api.js
git commit -m "feat: add caching layer (core + web integration)"
```

#### 3. 按包发布（模拟）
```bash
# 为 core 包打 tag
git tag -a @myorg/core@1.2.0 -m "Release @myorg/core@1.2.0"

# 为 web 包打 tag
git tag -a @myorg/web@3.0.0 -m "Release @myorg/web@3.0.0"

# 查看所有 tag
git tag --list '@myorg/*'
```

#### 4. Changeset 工作流（Changesets / Rush 风格）
```bash
# 开发者修改代码后，创建 changeset
cat > .changeset/cool-feature.md << 'EOF'
---
"@myorg/core": minor
"@myorg/web": patch
---

Added caching layer to core, integrated into web API layer.
EOF

git add .changeset/ && git commit -m "chore: add changeset for caching feature"
```

### 关键知识点
- Monorepo 用目录结构代替 submodule/subtree 管理多包
- 需要配合工具：Turborepo、Nx、Rush、Lerna
- Git 层面的重点：按路径过滤、按包打 tag、changeset 管理
- 优势：统一依赖、原子提交、重构方便
- 劣势：仓库体积大、权限粒度粗

---

## 模块 4: GPG 签名提交

### 为什么需要签名？
- 防止他人冒用你的 identity 提交代码
- CI/CD 流水线可以验证提交者身份
- 开源项目（如 Linux 内核）越来越要求签名提交

### 配置 GPG 签名

```bash
# 1. 生成 GPG 密钥
gpg --full-generate-key
# 选择: RSA and RSA, 4096 bits, 无过期

# 2. 查看密钥 ID
gpg --list-secret-keys --keyid-format=long
# sec   rsa4096/ABCDEF1234567890 2026-05-02

# 3. 导出公钥（用于 GitHub/GitLab 配置）
gpg --armor --export ABCDEF1234567890

# 4. 配置 Git 使用 GPG
git config --global user.signingkey ABCDEF1234567890
git config --global commit.gpgsign true
git config --global gpg.program gpg

# 5. 签名提交
git commit -S -m "feat: add signed commit"
# 或全局开启后自动签名: git commit -m "feat: auto signed"

# 6. 验证签名
git log --show-signature --oneline
# 输出:
# gpg: Good signature from "Developer <dev@example.com>"
# abc1234 (HEAD -> main) feat: add signed commit

# 7. 验证某个 tag
git tag -s v1.0.0 -m "Release v1.0.0"
git tag -v v1.0.0
```

### GitHub/GitLab 上的验证标记
- 签名提交会显示 ✅ **Verified** 标记
- 未签名显示未验证标记
- 可以配置分支保护规则：要求所有提交必须签名

### 关键知识点
- GPG 签名证明"这个提交确实是你做的"
- 密钥丢失 = 无法再签名，需要重新生成 + 更新所有平台
- 企业场景：通常配合 S/MIME 或企业 CA 使用
- Linux 内核要求所有提交必须 GPG 签名

---

## 模块 5: Reflog 深度实战 — 数据恢复与审计

### Reflog 是什么？
Reflog（Reference Log）记录 **本地仓库的所有 HEAD 和分支引用变更**。即使 commit 被"删除"，reflog 仍然保留。

### 实战场景

#### 场景 1: 误删分支恢复
```bash
# 误删了 feature/payment 分支
git branch -D feature/payment

# 通过 reflog 找回
git reflog
# abc1234 HEAD@{0}: branch: Deleted feature/payment
# def5678 HEAD@{1}: commit: feat(payment): add Stripe integration

# 恢复分支
git branch feature/payment def5678
```

#### 场景 2: Rebase 出错回退
```bash
# Rebase 搞乱了，想回到 rebase 前
git rebase main
# ... 一堆冲突，搞砸了

# 方法 1: abort（如果还在 rebase 过程中）
git rebase --abort

# 方法 2: reflog 找回 rebase 前的 HEAD
git reflog
# abc1234 HEAD@{0}: rebase finished: returning to refs/heads/feature
# def5678 HEAD@{1}: commit: feat: working version before rebase

git reset --hard def5678
```

#### 场景 3: Reset --hard 后恢复
```bash
# 手滑执行了 reset --hard
git reset --hard HEAD~3
# 丢失了 3 个 commit！

# 通过 reflog 找回
git reflog
# abc1234 HEAD@{0}: reset: moving to HEAD~3
# def5678 HEAD@{1}: commit: feat: important feature A
# ghi9012 HEAD@{2}: commit: feat: important feature B
# jkl3456 HEAD@{3}: commit: feat: important feature C

git reset --hard HEAD@{3}  # 回到 reset 前
```

#### 场景 4: 审计操作历史
```bash
# 查看最近 20 条操作
git reflog --format="%h %gd %ci %gs" -20

# 只看某个分支的 reflog
git reflog show feature/auth

# reflog 过期时间（默认 90 天）
git config --global gc.reflogExpire 90.days
```

### 关键知识点
- Reflog 是 **本地** 的，不会推送到远程
- 默认保留 90 天（未引用的条目 30 天后被 gc 清理）
- 是 Git 的"后悔药"，90% 的数据丢失可以通过 reflog 恢复
- 不能依赖 reflog 做备份 — 远程仓库才是备份

---

## 模块 6: 综合实战 — 模拟大型项目工作流

### 场景：Monorepo + Submodule + GPG + Hook

```bash
# === 第一步: 创建 monorepo 结构 ===
mkdir monorepo && cd monorepo && git init

mkdir -p packages/core/src packages/web/src
cat > packages/core/src/index.js << 'EOF'
export const VERSION = "1.0.0";
export function hello() { return "Hello from core"; }
EOF

cat > packages/web/src/index.js << 'EOF'
import { hello } from "@monorepo/core";
export function render() { return hello(); }
EOF

git add . && git commit -S -m "feat: init monorepo with core and web packages"

# === 第二步: 添加外部库作为 submodule ===
# 假设有一个共享的 UI 组件库
git submodule add ../ui-components packages/ui
# .gitmodules 自动生成

# === 第三步: 配置 Hook 流水线 ===

# pre-commit: 检查所有包的 lint
cat > .git/hooks/pre-commit << 'HOOK'
#!/bin/bash
echo "🔍 Pre-commit: 检查变更文件..."

STAGED=$(git diff --cached --name-only)

# 检查冲突标记
echo "$STAGED" | xargs grep -l '<<<<<<' 2>/dev/null && {
    echo "❌ 发现冲突标记"; exit 1
}

# 检查 console.log
echo "$STAGED" | xargs grep -l 'console\.log' 2>/dev/null && {
    echo "❌ 发现 console.log"; exit 1
}

# 按包检查
PACKAGES=$(echo "$STAGED" | cut -d/ -f1-2 | sort -u | grep '^packages/')
for pkg in $PACKAGES; do
    PKG_FILES=$(echo "$STAGED" | grep "^$pkg/")
    if [ -n "$PKG_FILES" ]; then
        echo "  ✅ $pkg 通过检查"
    fi
done

exit 0
HOOK
chmod +x .git/hooks/pre-commit

# commit-msg: 强制 changeset
cat > .git/hooks/commit-msg << 'HOOK'
#!/bin/bash
MSG=$(cat "$1")

# 允许 changeset commit 跳过包名检查
if echo "$MSG" | grep -q "^chore: add changeset"; then
    exit 0
fi

# 其他提交需要 type(scope): message 格式
if ! echo "$MSG" | grep -qE "^(feat|fix|docs|style|refactor|test|chore|perf|build|ci)(\(.+\))?: .+"; then
    echo "❌ 提交信息格式错误!"
    echo "   请使用: feat(core): 描述 或 chore: add changeset"
    exit 1
fi
exit 0
HOOK
chmod +x .git/hooks/commit-msg

# === 第四步: 模拟多开发者协作 ===

# 开发者 A: 修改 core
cd packages/core
echo "export function add(a, b) { return a + b; }" >> src/index.js
git add . && git commit -S -m "feat(core): add math utility"

# 开发者 B: 修改 web（在另一个克隆中）
cd /tmp
git clone --recurse-submodules monorepo web-dev
cd web-dev
echo "export function renderApp() { return '<h1>App</h1>'; }" >> packages/web/src/index.js
git add . && git commit -S -m "feat(web): add app renderer"

# 开发者 A 推送，开发者 B 拉取并 rebase
cd monorepo
git push origin main  # 假设配置了远程

cd /tmp/web-dev
git fetch origin
git rebase origin/main
# 如果有冲突，解决后 git add + git rebase --continue

# === 第五步: 发布流程 ===
# core 包发布 v1.1.0
git tag -s @monorepo/core@1.1.0 -m "Release core@1.1.0"

# web 包发布 v1.0.0
git tag -s @monorepo/web@1.0.0 -m "Release web@1.0.0"

# 查看发布 tag
git tag --list '@monorepo/*'
```

---

## 6 轮迭代总回顾

| 轮次 | 日期 | 主题 | 核心产出 |
|------|------|------|----------|
| v1 | 4/24 | 基础概念 | 分支策略/Rebase/Cherry-pick/Hook 理论 (~25KB) |
| v2 | 4/26 | 双开发者协作 | Alice + Bob 实战演练 (~12KB) |
| v3 | 4/29 | 进阶巩固 | 三人协作 + 高级调试 (~32KB) |
| v4 | 4/30 | 全流程模拟 | 完整协作流程 + 冲突解决 (~42KB) |
| v5 | 5/1 | 3 人团队 + Hooks | 自动化 Hook 流水线 + 分支策略文档 (~7KB) |
| v6 | 5/2 | 工程化实战 | Monorepo/Submodule/Subtree/GPG/Reflog (本文件) |

### 累计覆盖技能矩阵

| 技能领域 | 覆盖轮次 | 掌握度 |
|----------|----------|--------|
| 分支策略 (Git Flow/GitHub Flow/Trunk-Based) | v1,v2,v3,v4,v5 | ⭐⭐⭐⭐⭐ |
| Merge (fast-forward / --no-ff / squash) | v1,v2,v3,v4,v5 | ⭐⭐⭐⭐⭐ |
| Rebase (普通/交互式/冲突解决/autosquash) | v1,v2,v3,v4,v5 | ⭐⭐⭐⭐⭐ |
| Cherry-pick (单 commit/批量/冲突) | v1,v2,v3,v4,v5 | ⭐⭐⭐⭐⭐ |
| Git Hook (pre-commit/commit-msg/pre-push) | v1,v2,v3,v4,v5 | ⭐⭐⭐⭐⭐ |
| 冲突解决 (策略/工具/最佳实践) | v2,v3,v4 | ⭐⭐⭐⭐⭐ |
| Submodule | v6 | ⭐⭐⭐⭐ |
| Subtree | v6 | ⭐⭐⭐⭐ |
| Monorepo 工作流 | v6 | ⭐⭐⭐⭐ |
| GPG 签名提交 | v6 | ⭐⭐⭐⭐ |
| Reflog 数据恢复 | v6 | ⭐⭐⭐⭐⭐ |
| Git Bisect (二分调试) | v2,v3 | ⭐⭐⭐⭐ |
| Stash (临时保存) | v2,v3 | ⭐⭐⭐⭐ |
| Tags (annotated/signed) | v2,v6 | ⭐⭐⭐⭐ |
| Changeset 工作流 | v6 | ⭐⭐⭐⭐ |

---

## 核心收获

### 1. Submodule vs Subtree vs Monorepo 选型
- **Submodule**: 适合外部依赖、需要精确版本控制
- **Subtree**: 适合内部库、不想管理 .gitmodules
- **Monorepo**: 适合紧密耦合的多包项目、需要原子提交

### 2. GPG 签名是安全底线
- 开源项目趋势：越来越要求签名提交
- 企业场景：合规审计的必备要求
- 配置一次，终身受益

### 3. Reflog 是终极后悔药
- 90% 的"数据丢失"可以通过 reflog 恢复
- 但 reflog 是本地行为，远程仓库才是真正备份
- 养成定期 push 的习惯

### 4. Hook 是质量守门员
- pre-commit: 代码质量（lint/冲突标记/console.log）
- commit-msg: 提交规范（Conventional Commits/changeset）
- pre-push: 测试门禁（确保不推送破坏性代码）

---

*训练时间: 2026-05-02 17:00*
*训练轮次: v6*
*累计产出: ~150KB+*

---

## 实战执行结果 ✅

### 模块1: Submodule — ✅ 完成
- core-lib v1.0.0 → v1.1.0 版本升级
- web-app 通过 submodule 引入 core-lib
- `--recurse-submodules` 克隆验证成功
- `.gitmodules` 文件自动生成

### 模块2: Subtree — ⚠️ 跳过
- 当前环境未安装 `git-subtree` 插件
- 原理已在文档中说明，实际使用时 `apt install git-subtree` 即可

### 模块3: Monorepo — ✅ 完成
- 3 包 monorepo 结构创建成功
- 按包过滤变更 (`git log -- packages/core/`) 验证通过
- 跨包提交验证通过
- 按包打 tag (`@monorepo/core@1.1.0` 等) 验证通过
- 未提交变更检测验证通过

### 模块4: GPG 签名 — ✅ 完成
- 成功生成 RSA 2048 位测试密钥
- 签名提交验证通过: `Good signature from "Test Developer"`
- 签名 tag 验证通过: `Good signature` + object/type 验证
- 配置: `commit.gpgsign = true` 全局开启

### 模块5: Reflog — ✅ 完成
- **场景1**: 误删分支恢复 — 通过 reflog + commit hash 恢复
- **场景2**: reset --hard 后恢复 — 通过 reflog 找回 reset 前 HEAD
- **场景3**: rebase 出错回退 — 通过 reflog 恢复 rebase 前状态
- **场景4**: 审计操作历史 — `reflog --format` 格式化输出

### 模块6: 综合实战 — ✅ 完成
- 所有子模块独立验证通过
- 工作流可复现
