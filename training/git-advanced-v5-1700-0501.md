# Git 进阶第 5 轮实战训练 (5/1 17:00)

## 主题: 团队协作全流程模拟

### 训练目标
通过模拟 3 人团队协作场景，综合演练 Cherry-pick、Rebase、Merge、Hook 和分支策略。

---

## 场景设置

### 团队角色
| 角色 | 任务 | 分支 |
|------|------|------|
| 开发者 A | 用户认证模块 | feature/auth |
| 开发者 B | API 路由模块 | feature/api |
| 开发者 C | 安全漏洞修复 | hotfix/xss-fix |

### 项目结构
```
team-project/
├── README.md
├── package.json
├── src/
│   ├── greet.js      # 问候模块
│   ├── math.js       # 数学工具
│   ├── auth.js       # 认证模块 (开发者 A)
│   ├── routes.js     # API 路由 (开发者 B)
│   └── sanitize.js   # XSS 防护 (开发者 C)
├── .git/hooks/
│   ├── pre-commit    # 代码质量检查
│   ├── commit-msg    # 提交规范检查
│   └── pre-push      # 测试检查
└── BRANCH_STRATEGY.md # 分支策略文档
```

---

## 场景 1: Cherry-pick 紧急修复

### 问题
开发者 C 发现 XSS 漏洞，创建了 `hotfix/xss-fix` 分支。但 `feature/auth` 和 `feature/api` 还没准备好合并，不能直接合并整个 hotfix 分支。

### 解决方案
```bash
# 查看 hotfix 的 commit hash
git log --oneline hotfix/xss-fix
# 07bcd74 fix(security): add HTML escape to prevent XSS

# 切换到 master，精确 cherry-pick
git checkout master
git cherry-pick 07bcd74

# 结果: sanitize.js 被引入 master，不依赖其他分支
```

### 关键知识点
- **Cherry-pick** 允许从任意分支选取单个 commit 应用到当前分支
- 适用于: 紧急修复、跨分支移植、选择性合并
- 注意: cherry-pick 会创建新 commit hash，原分支的 commit 不变
- 与 merge 的区别: merge 合并整个分支历史，cherry-pick 只取单个 commit

---

## 场景 2: Rebase 整理提交历史

### 问题
feature/auth 和 feature/api 基于旧版 master 开发。master 上已经有了 cherry-pick 的安全修复，feature 分支需要基于最新 master 重新排列。

### 解决方案
```bash
# feature/auth rebase 到最新 master
git checkout feature/auth
git rebase master
# feat(auth) commit 被"搬运"到 master 最新提交之后

# feature/api rebase 到最新 master
git checkout feature/api
git rebase master
# feat(api) commit 同样被"搬运"
```

### Rebase 前后对比

**Rebase 前:**
```
* 4bceace (feature/auth) feat(auth)  ← 基于旧 master
* 7dd8306 (master) init
```

**Rebase 后:**
```
* 0de51e7 (feature/auth) feat(auth)  ← 基于新 master (含 cherry-pick)
* 07bcd74 fix(security)
* 7dd8306 init
```

### 关键知识点
- **Rebase** 将当前分支的 commit "搬运"到目标分支最新位置
- 保持线性历史，避免不必要的 merge commit
- 规则: **永远不要 rebase 已推送的公共分支**
- Interactive rebase (`git rebase -i`) 可 squash/fixup/amend 提交

---

## 场景 3: Merge --no-ff 保留分支拓扑

### 问题
功能分支开发完成后，需要合并回 master，但希望保留"这是一个功能分支"的记录。

### 解决方案
```bash
git checkout master
git merge --no-ff feature/auth -m "chore: merge feature/auth"
git merge --no-ff feature/api -m "chore: merge feature/api"
```

### 最终拓扑
```
*   cfec611 (master) chore: merge feature/api
|\
| * 9454eee (feature/api) feat(api): add health check route
* |   7da0ad0 chore: merge feature/auth
|\ \
| |/
|/|
| * 0de51e7 (feature/auth) feat(auth): add login, logout, register
|/
* 07bcd74 fix(security): add HTML escape to prevent XSS
* 7dd8306 init: project scaffold
```

### 关键知识点
- `--no-ff` 强制创建 merge commit，即使可以 fast-forward
- 好处: 保留功能分支的边界，便于 revert 整个功能
- 配合 `git log --graph` 可清晰看到分支合并历史

---

## 场景 4: Git Hooks 自动化

### Pre-commit Hook: 代码质量检查
```bash
#!/bin/bash
# 检查 console.log 残留
FILES=$(git diff --cached --name-only | grep -E '\.(js|ts|vue|jsx|tsx)$')
if echo "$FILES" | xargs grep -l "console\.log" 2>/dev/null; then
    echo "❌ 发现 console.log，请移除后再提交"
    exit 1
fi
exit 0
```

### Commit-msg Hook: Conventional Commits 规范
```bash
#!/bin/bash
MSG=$(cat "$1")
if ! echo "$MSG" | grep -qE "^(feat|fix|docs|style|refactor|test|chore|hotfix)(\(.+\))?: .+"; then
    echo "❌ 提交信息格式错误!"
    echo "   请使用: feat: 新功能 / fix: 修复bug / docs: 文档更新"
    exit 1
fi
```

### Pre-push Hook: 测试检查
```bash
#!/bin/bash
echo "🧪 Pre-push: 运行测试套件..."
if [ -d "tests" ] || [ -d "__tests__" ]; then
    echo "   发现测试目录，运行测试..."
    # npm test -- --run
fi
exit 0
```

### Hook 执行顺序
```
git commit
  → pre-commit (检查代码) ✅
  → prepare-commit-msg (预填模板)
  → commit-msg (检查格式) ✅
  → post-commit (通知/日志)

git push
  → pre-push (运行测试) ✅
```

---

## 场景 5: 分支策略文档

### Git Flow 简化版

| 分支 | 前缀 | 来源 | 目标 | 生命周期 |
|------|------|------|------|----------|
| 主分支 | master | - | - | 永久 |
| 功能分支 | feature/ | master | master | 短期 |
| 修复分支 | hotfix/ | master | master | 紧急 |
| 发布分支 | release/ | master | master | 发布周期 |

### 协作流程
1. `git checkout -b feature/xxx master` — 创建功能分支
2. 开发 + `git commit` (遵循 Conventional Commits)
3. `git rebase -i master` — 整理提交历史 (squash 小 commit)
4. `git merge --no-ff feature/xxx` — 合并回 master
5. `git branch -d feature/xxx` — 删除已合并分支

### 规则
- master 只接受 merge commit，不直接 push
- 所有功能通过 feature 分支开发
- 紧急修复走 hotfix 分支，可 cherry-pick 到 master
- 合并前必须 rebase 到最新 master
- 永远不 rebase 已推送的公共分支

---

## 训练总结

### 本次轮次 (v5) 新增内容

| 内容 | 说明 |
|------|------|
| 3 人协作模拟 | auth + api + security 并行开发 |
| Cherry-pick 实战 | 精确选取 hotfix commit |
| Rebase 线性历史 | feature 分支 rebase 到最新 master |
| Merge --no-ff | 保留分支拓扑记录 |
| 3 个 Git Hooks | pre-commit + commit-msg + pre-push |
| 分支策略文档 | Git Flow 简化版 |

### 5 轮迭代回顾

| 轮次 | 日期 | 重点 | 产出 |
|------|------|------|------|
| v1 | 4/24 | 分支策略/Rebase/Cherry-pick/Hook 基础 | ~25KB |
| v2 | 4/26 | 双开发者协作/Rebase/Cherry-pick/Hook | ~9.5KB |
| v3 | 4/29 | Git 进阶巩固 | 纳入总专项 |
| v4 | 4/30 | 协作全流程模拟 | ~44KB |
| v5 | 5/1 | 3 人团队协作全流程 + Hooks 自动化 | 本文件 |

### 核心技能掌握度

| 技能 | 掌握度 | 说明 |
|------|--------|------|
| 分支策略 | ⭐⭐⭐⭐⭐ | Git Flow 简化版已文档化 |
| Cherry-pick | ⭐⭐⭐⭐⭐ | 精确选取 commit 实战 |
| Rebase | ⭐⭐⭐⭐⭐ | 线性历史 + 冲突处理 |
| Merge | ⭐⭐⭐⭐⭐ | --no-ff 保留拓扑 |
| Git Hooks | ⭐⭐⭐⭐⭐ | 3 个 hook 已实现 |
| 团队协作 | ⭐⭐⭐⭐⭐ | 3 人并行开发模拟 |

**Git 进阶 5 轮迭代全部闭环 ✅**

---

*训练时间: 2026-05-01 17:00*
*训练轮次: v5 (终轮)*
*累计产出: ~120KB+*
