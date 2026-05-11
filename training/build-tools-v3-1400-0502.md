# 🔧 构建工具专项 v3 — 现代构建生态与深度实践

**时间：** 2026-05-02 14:00  
**前置：** `build-tools-1400.md` (基础) + `build-tools-advanced-1400-0430.md` (进阶)  
**目标：** 覆盖现代构建生态新工具、Monorepo 构建、SWC 生态、Bundlerless 方案、CI/CD 构建优化

---

## 一、现代构建工具全景 (2024-2026)

### 1.1 构建工具演进时间线

```
2012  Grunt (任务 Runner)
2013  Gulp (流式构建)
2014  Webpack 1 (模块打包器诞生)
2015  Rollup (ESM 优先)
2017  Webpack 3 (Scope Hoisting)
2018  Parcel 1 (零配置)
2019  Snowpack (Bundlerless 概念)
2020  Vite (原生 ESM + 极速开发)
2021  esbuild 成熟 (Go 编写)
2022  Turbopack (Rust, Next.js 内置)
2023  Rspack (Rust, Webpack 兼容)
2024  OXC (Rust, 统一工具链)
2025  Rolldown (Rust, Rollup 继任者)
2026  NAPI-RS 生态成熟 (Node.js 原生扩展)
```

### 1.2 2026 构建工具格局

| 工具 | 语言 | 定位 | 核心优势 | 适用场景 |
|------|------|------|----------|----------|
| **Webpack 5** | JS | 全能打包器 | 生态最成熟 | 大型企业应用 |
| **Vite 6** | JS | 开发服务器 + 构建 | 开发体验最佳 | 现代 Web 应用 |
| **esbuild** | Go | 极速编译 | 性能极致 | 快速构建/转换 |
| **Rspack** | Rust | Webpack 替代 | 5-10x 性能 + 兼容 | Webpack 迁移 |
| **Turbopack** | Rust | 增量编译 | 细粒度缓存 | Next.js 项目 |
| **Rollup** | JS | 库打包 | 干净输出 | npm 库 |
| **Rolldown** | Rust | Rollup 继任 | Rust 性能 + Rollup 插件 | 下一代库打包 |
| **Parcel 2** | JS/Rust | 零配置 | 开箱即用 | 快速原型 |
| **Farm** | Rust | 国产新工具 | 极速 HMR | 国内项目 |
| **OXC** | Rust | 统一工具链 | 解析/转换/Lint 一体化 | 工具链整合 |

### 1.3 Rust 工具链崛起

```
Rust 构建工具链 (OXC 生态):

┌─────────────────────────────────────────────────────┐
│                    OXC 统一工具链                     │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ oxc_parser│  │ oxc_semantic│ │ oxc_codegen│     │
│  │ 解析器    │→│ 语义分析   │→│ 代码生成   │          │
│  │ (AST)     │  │ (类型检查) │  │ (Source Map)│       │
│  └──────────┘  └──────────┘  └──────────┘          │
│         ↓              ↓              ↓             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ oxc_minifier│ │ oxc_transform│ │ oxc_linter│     │
│  │ 压缩器    │  │ 转换器    │  │ Linter    │          │
│  │ (Terser   │  │ (Babel    │  │ (ESLint   │          │
│  │  替代)     │  │  替代)     │  │  替代)     │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                     │
│  上层应用:                                           │
│  • Rolldown (Rollup Rust 继任)                       │
│  • Rspack (Webpack Rust 替代)                        │
│  • Oxcmin (独立压缩器)                               │
│  • Biome (Linter + Formatter)                        │
│                                                     │
│  性能对比 (解析 1000 个文件):                         │
│  • acorn:    1200ms                                 │
│  • @babel/parser: 800ms                             │
│  • SWC parser: 150ms                                │
│  • OXC parser: 80ms (15x 快于 Babel)                │
└─────────────────────────────────────────────────────┘
```

---

## 二、SWC 生态深度

### 2.1 SWC 架构解析

```
SWC (Speedy Web Compiler) 架构:

┌─────────────────────────────────────────────────────────┐
│                    SWC 核心架构                           │
│                                                         │
│  输入层                                                   │
│  ├─ TypeScript (.ts/.tsx)                                │
│  ├─ JavaScript (.js/.jsx)                                │
│  ├─ JSX / TSX                                            │
│  └─ 装饰器 (Decorators)                                  │
│         ↓                                                │
│  解析层 (Parser)                                          │
│  ├─ 自研 Rust 解析器 (非基于 acorn/esprima)               │
│  ├─ 支持最新 ECMAScript 提案                              │
│  └─ 容错解析 (错误恢复)                                   │
│         ↓                                                │
│  转换层 (Transforms)                                       │
│  ├─ 降级转换 (ESNext → ES5)                              │
│  ├─ React JSX 转换 (automatic/runtime)                   │
│  ├─ TypeScript 类型擦除                                   │
│  ├─ 装饰器转换 (legacy/experimental)                     │
│  ├─ 内联常量 (inline-global-defines)                     │
│  └─ 自定义插件 (Wasm 插件系统)                            │
│         ↓                                                │
│  压缩层 (Minifier)                                        │
│  ├─ 死代码消除 (DCE)                                     │
│  ├─ 变量名压缩 (mangle)                                  │
│  ├─ 常量折叠 (constant folding)                          │
│  ├─ 内联函数 (inline)                                    │
│  └─ Tree Shaking (基于 ESM)                              │
│         ↓                                                │
│  输出层 (Codegen)                                         │
│  ├─ Source Map 生成 (inline/external)                    │
│  ├─ 多格式输出 (ESM/CJS/UMD)                             │
│  └─ 保留注释 (license 等)                                │
│                                                         │
│  性能: 解析+转换比 Babel 快 20x，压缩比 Terser 快 10x     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 SWC 核心 API

```javascript
// swc-core.js — SWC 核心 API 深度使用

// ============ 1. 基础转换 ============

const { transform, transformFile, transformSync } = require('@swc/core');

// 异步转换
const result = await transform(`
  const hello = async (name: string): Promise<string> => {
    return `Hello, ${name}!`;
  };
`, {
  filename: 'example.ts',
  jsc: {
    parser: {
      syntax: 'typescript',
      tsx: true,
      decorators: true,
      dynamicImport: true,
    },
    target: 'es2015',
    loose: false,
    minify: {
      compress: {
        defaults: false,
        arguments: true,
        dead_code: true,
        drop_console: true,
        pure_funcs: ['console.log'],
      },
      mangle: true,
    },
    keepClassNames: true,
    externalHelpers: false,
  },
  module: {
    type: 'es6',
    strict: true,
    noUnusedImports: true,
  },
  sourceMaps: true,
  inlineSourcesContent: true,
});

console.log(result.code);    // 转换后的代码
console.log(result.map);     // Source Map

// ============ 2. SWC 插件系统 ============

// SWC 插件是 Wasm 模块，可以用 Rust 编写
// 示例: 自定义 SWC 插件 (Rust)

/*
// my_swc_plugin/src/lib.rs
use swc_core::ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
};
use swc_core::common::pass::Repeated;

// 插件: 移除所有 console.log 调用
pub struct ConsoleRemover;

impl VisitMut for ConsoleRemover {
    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        expr.visit_mut_children_with(self);
        
        if let Expr::Call(call) = expr {
            if let Callee::Expr(callee) = &call.callee {
                if let Expr::Member(member) = callee.as_ref() {
                    if let Expr::Ident(obj) = member.obj.as_ref() {
                        if obj.sym == "console" {
                            // 替换为 undefined
                            *expr = Expr::Ident(Ident::new(
                                "undefined".into(),
                                DUMMY_SP,
                            ));
                        }
                    }
                }
            }
        }
    }
}

// 插件: 自动添加 __DEV__ 条件编译
pub struct DevGuard;

impl VisitMut for DevGuard {
    fn visit_mut_expr_stmt(&mut self, stmt: &mut ExprStmt) {
        // 检测 import.meta.dev 模式
        // 如果不在 dev 模式，移除特定代码
    }
}
*/

// ============ 3. SWC + Webpack 集成 ============

// webpack.swc.config.js — 用 SWC 替换 Babel

const path = require('path');

module.exports = {
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
                dynamicImport: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                  development: process.env.NODE_ENV === 'development',
                  refresh: process.env.NODE_ENV === 'development',
                },
              },
              target: 'es2022',
              loose: false,
              minify: {
                compress: {
                  drop_console: true,
                },
              },
            },
            module: {
              type: 'es6',
            },
            sourceMaps: true,
          },
        },
      },
    ],
  },
  // SWC 压缩替代 Terser
  optimization: {
    minimize: true,
    minimizer: [
      new (require('swc-loader').SwcMinifyPlugin)({
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info'],
        },
        mangle: {
          safari10: true,
        },
      }),
    ],
  },
};

// ============ 4. SWC + Jest 集成 ============

// jest.config.js — 用 SWC 替代 babel-jest

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  // SWC Jest 比 babel-jest 快 5-10x
};

// ============ 5. SWC + Next.js 配置 ============

// next.config.js — Next.js 已内置 SWC

const nextConfig = {
  // SWC 转译特定包 (默认不转译 node_modules)
  transpilePackages: ['some-esm-package'],
  
  // SWC 自定义配置
  swcMinify: true, // 默认开启
  
  // SWC 源映射
  productionBrowserSourceMaps: true,
  
  // 禁用 SWC (回退到 Babel)
  // swc: false,
};

module.exports = nextConfig;
```

### 2.3 SWC vs Babel 性能对比

```
性能对比 (1000 个 TypeScript 文件):

┌─────────────────┬──────────┬──────────┬──────────┐
│     操作         │ Babel    │ SWC      │ 加速比   │
├─────────────────┼──────────┼──────────┼──────────┤
│ 解析             │  800ms   │  45ms    │  18x     │
│ 类型擦除          │  350ms   │  20ms    │  17x     │
│ JSX 转换         │  200ms   │  15ms    │  13x     │
│ 降级 (ESNext→ES5)│  600ms   │  35ms    │  17x     │
│ 压缩             │  1200ms  │  120ms   │  10x     │
│ 完整构建          │  3200ms  │  220ms   │  15x     │
└─────────────────┴──────────┴──────────┴──────────┘

功能对比:

┌─────────────────┬──────────┬──────────┐
│     功能         │ Babel    │ SWC      │
├─────────────────┼──────────┼──────────┤
│ TypeScript       │ ✅       │ ✅       │
│ JSX/TSX          │ ✅       │ ✅       │
│ Decorators       │ ✅ (稳定) │ ⚠️ (实验) │
│ 自定义插件        │ ✅ (JS)  │ ⚠️ (Wasm) │
│ 插件生态          │ 丰富     │ 增长中   │
│ Source Map       │ ✅       │ ✅       │
│ 压缩             │ ❌ (Terser)│ ✅ (内置) │
│ 并行处理         │ ❌       │ ✅       │
│ 内存占用          │ 高       │ 低       │
└─────────────────┴──────────┴──────────┘
```

---

## 三、Monorepo 构建体系

### 3.1 Monorepo 工具链对比

```
Monorepo 工具链选择:

┌─────────────────────────────────────────────────────────┐
│                  Monorepo 工具生态                        │
│                                                         │
│  包管理:                                                  │
│  ├─ npm workspaces (原生)                                │
│  ├─ Yarn workspaces (v1/v2 Berry)                        │
│  ├─ pnpm (硬链接 + 内容寻址)                              │
│  └─ Bun workspaces (新兴)                                │
│                                                         │
│  任务编排:                                                │
│  ├─ Turborepo (Vercel, Rust) — 任务缓存 + 远程缓存        │
│  ├─ Nx (Nrwl) — 企业级, 影响分析 + 分布式缓存             │
│  ├─ Rush (Microsoft) — 大型企业, 严格版本管理             │
│  └─ Lerna (归档) — 已被 Turborepo 取代                   │
│                                                         │
│  构建:                                                    │
│  ├─ Turborepo pipeline (增量构建)                         │
│  ├─ Nx affected (影响分析)                                │
│  ├─ pnpm filter (包过滤)                                 │
│  └─ 各包独立构建 (Vite/Rollup/esbuild)                    │
│                                                         │
│  选择指南:                                                │
│  • 小型团队 (1-5 人) → pnpm + 简单脚本                    │
│  • 中型团队 (5-20 人) → pnpm + Turborepo                 │
│  • 大型企业 (20+ 人) → pnpm + Nx + 严格策略              │
│  • 开源库 → pnpm + Changesets                            │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Turborepo 深度配置

```javascript
// turbo.json — Turborepo 核心配置

{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  
  // 全局环境变量 (影响缓存)
  "globalEnv": ["NODE_ENV", "CI", "VERCEL"],
  "globalPassThroughEnv": ["npm_lifecycle_event"],
  
  "tasks": {
    // ============ 构建任务 ============
    "build": {
      // 依赖关系: 先构建依赖包
      "dependsOn": ["^build"],
      
      // 输出产物 (参与缓存)
      "outputs": [
        "dist/**",
        ".next/**",
        "!.next/cache/**"
      ],
      
      // 输入文件 (影响缓存命中)
      "inputs": [
        "src/**",
        "package.json",
        "tsconfig.json"
      ],
      
      // 缓存配置
      "cache": true
    },
    
    // ============ 类型检查 ============
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "*.ts", "*.tsx", "tsconfig.json"],
      "cache": true
    },
    
    // ============ 测试 ============
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**", "test/**", "*.test.ts"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    
    // ============ Lint ============
    "lint": {
      "inputs": ["src/**", "*.config.js", ".eslintrc.js"],
      "cache": true
    },
    
    // ============ 开发 (不缓存) ============
    "dev": {
      "cache": false,
      "persistent": true
    },
    
    // ============ 清理 ============
    "clean": {
      "cache": false
    },
    
    // ============ 发布 ============
    "publish": {
      "dependsOn": ["build", "test", "lint"],
      "cache": false
    }
  }
}
```

### 3.3 Turborepo 远程缓存

```javascript
// Turborepo 远程缓存配置

// ============ 1. Vercel 远程缓存 ============

// 安装
// pnpm add -D turbo

// 登录 Vercel
// npx turbo login

// 链接项目
// npx turbo link

// 使用远程缓存构建
// TURBO_TOKEN=xxx TURBO_TEAM=xxx pnpm turbo build

// ============ 2. 自建远程缓存 (GitHub Actions) ============

// .github/workflows/build.yml
const githubActionsWorkflow = `
name: Build
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install --frozen-lockfile
      
      # Turborepo 远程缓存 (使用 Vercel)
      - name: Build
        run: pnpm turbo build
        env:
          TURBO_TOKEN: \${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: \${{ secrets.TURBO_TEAM }}
          TURBO_REMOTE_ONLY: true  # 只使用远程缓存
      
      - name: Test
        run: pnpm turbo test
      
      - name: Lint
        run: pnpm turbo lint
`;

// ============ 3. 自建 Turborepo 缓存服务器 ============

// turbo-remote-cache.js — 自建缓存服务

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { createGunzip, createGzip } = require('zlib');

const app = express();
const CACHE_DIR = path.resolve(__dirname, '.turbo-cache');

// 确保缓存目录存在
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 生成缓存 key
function getCacheKey(task, hash) {
  return crypto
    .createHash('sha256')
    .update(`${task}:${hash}`)
    .digest('hex');
}

// GET — 获取缓存
app.get('/vite-artifacts/:taskKey/:fileHash', async (req, res) => {
  const { taskKey, fileHash } = req.params;
  const cachePath = path.join(CACHE_DIR, taskKey, fileHash);
  
  if (fs.existsSync(cachePath)) {
    const stream = fs.createReadStream(cachePath);
    res.set('Content-Type', 'application/octet-stream');
    stream.pipe(res);
  } else {
    res.status(404).send('Not Found');
  }
});

// PUT — 存储缓存
app.put('/vite-artifacts/:taskKey/:fileHash', async (req, res) => {
  const { taskKey, fileHash } = req.params;
  const cachePath = path.join(CACHE_DIR, taskKey);
  
  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
  }
  
  const writeStream = fs.createWriteStream(path.join(cachePath, fileHash));
  await pipeline(req, writeStream);
  
  res.status(201).send('Created');
});

// GET — 获取日志
app.get('/vite-logs/:taskKey', async (req, res) => {
  const { taskKey } = req.params;
  const logPath = path.join(CACHE_DIR, taskKey, 'log.txt');
  
  if (fs.existsSync(logPath)) {
    res.sendFile(logPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// PUT — 存储日志
app.put('/vite-logs/:taskKey', async (req, res) => {
  const { taskKey } = req.params;
  const cachePath = path.join(CACHE_DIR, taskKey);
  
  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
  }
  
  const writeStream = fs.createWriteStream(path.join(cachePath, 'log.txt'));
  await pipeline(req, writeStream);
  
  res.status(201).send('Created');
});

// GET — 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', cacheDir: CACHE_DIR });
});

// 认证中间件 (生产环境需要)
app.use((req, res, next) => {
  const token = req.headers['authorization'];
  if (token === `Bearer ${process.env.CACHE_SECRET}`) {
    next();
  } else {
    res.status(401).send('Unauthorized');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`📦 Turborepo Remote Cache running on port ${PORT}`);
  console.log(`📁 Cache directory: ${CACHE_DIR}`);
});

// 使用方式:
// TURBO_API=http://localhost:3001 TURBO_TOKEN=secret TURBO_TEAM=local pnpm turbo build
```

### 3.4 Monorepo 构建最佳实践

```javascript
// monorepo-build-best-practices.js

/*
Monorepo 构建最佳实践 Checklist:

✅ 包管理
  • 使用 pnpm (硬链接 + 严格依赖)
  • workspace 协议 (workspace:*) 确保版本同步
  • 共享 TypeScript 配置 (tsconfig.base.json)
  • 共享 ESLint/Prettier 配置

✅ 构建策略
  • 增量构建 (只构建变化的包)
  • 并行构建 (Turborepo 自动并行)
  • 远程缓存 (团队协作共享缓存)
  • 依赖感知构建 (dependsOn: ["^build"])

✅ 发布策略
  • Changesets (自动化版本管理 + Changelog)
  • 语义化版本 (SemVer)
  • 独立版本 vs 固定版本
  • 预发布标签 (alpha/beta/rc)

✅ CI/CD
  • 影响分析 (只构建受影响的包)
  • 并行测试 (按包并行)
  • 缓存复用 (CI 缓存 node_modules + turbo cache)
  • 增量部署 (只部署变化的服务)

✅ 性能优化
  • 排除 node_modules 从构建
  • 使用 swc/esbuild 替代 babel
  • 并行类型检查 (fork-ts-checker)
  • 按需构建 (开发时只构建当前包)
*/

// ============ pnpm-workspace.yaml ============

const pnpmWorkspace = `
packages:
  - 'packages/*'
  - 'apps/*'
  - 'docs'

# 共享依赖提升
publicHoistPattern:
  - '*'
  - '@types/*'
  - '*eslint*'
  - '*prettier*'
  - '*typescript*'

# 严格依赖 (禁止隐式依赖)
strict-peer-dependencies: false

# 网络配置
network-concurrency: 16
store-dir: .pnpm-store
`;

// ============ Changesets 配置 ============

const changesetConfig = `
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["docs", "web"]
}
`;

// ============ 发布脚本 ============

// scripts/release.js
const releaseScript = `
#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function release() {
  console.log('🚀 Starting release process...\\n');
  
  // 1. 运行所有包的类型检查
  console.log('📝 Type checking...');
  execSync('pnpm turbo typecheck', { stdio: 'inherit' });
  
  // 2. 运行所有包的测试
  console.log('\\n🧪 Running tests...');
  execSync('pnpm turbo test', { stdio: 'inherit' });
  
  // 3. 运行所有包的 lint
  console.log('\\n🔍 Linting...');
  execSync('pnpm turbo lint', { stdio: 'inherit' });
  
  // 4. 构建所有包
  console.log('\\n🔨 Building...');
  execSync('pnpm turbo build', { stdio: 'inherit' });
  
  // 5. 版本管理 + Changelog
  console.log('\\n📦 Versioning...');
  execSync('changeset version', { stdio: 'inherit' });
  
  // 6. 发布到 npm
  console.log('\\n📤 Publishing...');
  execSync('changeset publish', { stdio: 'inherit' });
  
  // 7. 提交 + 打标签
  console.log('\\n📝 Committing...');
  execSync('git add .', { stdio: 'inherit' });
  execSync('git commit -m "chore: release"', { stdio: 'inherit' });
  execSync('git push && git push --tags', { stdio: 'inherit' });
  
  console.log('\\n✅ Release complete!');
}

release().catch(console.error);
`;
```

---

## 四、Bundlerless 方案深度

### 4.1 Bundlerless 架构原理

```
Bundlerless (无打包) 架构:

┌──────────────────────────────────────────────────────────────────┐
│                   Bundlerless 工作原理                            │
│                                                                  │
│  传统 Bundler 模式:                                               │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                   │
│  │ 源码文件  │──→ │ 打包器   │──→ │ bundle.js│──→ 浏览器          │
│  │ (N 个)    │    │ Webpack  │    │ (1 个)   │                    │
│  └──────────┘    └──────────┘    └──────────┘                   │
│                                                                  │
│  Bundlerless 模式:                                               │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                   │
│  │ 源码文件  │──→ │ 转换服务  │──→ │ ESM 模块 │──→ 浏览器          │
│  │ (N 个)    │    │ Vite/SWC │    │ (N 个)   │   (原生 ESM)       │
│  └──────────┘    └──────────┘    └──────────┘                   │
│                                                                  │
│  关键前提:                                                        │
│  • 浏览器原生支持 ESM (import/export)                            │
│  • HTTP/2 多路复用 (解决多请求问题)                               │
│  • 现代浏览器覆盖率 > 95%                                        │
│                                                                  │
│  优势:                                                            │
│  • 零启动时间 (不需要打包)                                        │
│  • 精确 HMR (只更新变化的模块)                                    │
│  • 原生 Source Map (无打包层干扰)                                 │
│  • 更好的调试体验 (直接调试源码)                                   │
│                                                                  │
│  劣势:                                                            │
│  • 生产环境请求数多 (需要预构建)                                  │
│  • 不支持旧浏览器                                                │
│  • 需要额外的转换层 (TSX→JS, SCSS→CSS)                           │
│  • 依赖预构建 (node_modules 需要打包)                             │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Import Maps

```html
<!-- importmap.html — Import Maps 深度使用 -->

<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  
  <!-- Import Map — 模块路径映射 -->
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.3.1",
      "react-dom": "https://esm.sh/react-dom@18.3.1",
      "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
      "vue": "https://esm.sh/vue@3.4.0",
      
      // 别名映射
      "@/components/": "/src/components/",
      "@/utils/": "/src/utils/",
      "@/hooks/": "/src/hooks/",
      
      // 版本锁定
      "lodash-es": "https://esm.sh/lodash-es@4.17.21"
    },
    
    "scopes": {
      // 作用域映射 (不同模块使用不同版本)
      "/src/legacy/": {
        "react": "https://esm.sh/react@16.14.0"
      }
    }
  }
  </script>
  
  <script type="module">
    // 直接使用 import map 中的别名
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { useState } from 'react';
    
    // 本地模块
    import App from '@/components/App.js';
    import { formatDate } from '@/utils/format.js';
    
    const root = createRoot(document.getElementById('app'));
    root.render(React.createElement(App));
  </script>
</head>
<body>
  <div id="app"></div>
</body>
</html>
```

```javascript
// importmap-generator.js — 自动生成 Import Map

const fs = require('fs');
const path = require('path');

class ImportMapGenerator {
  constructor(options = {}) {
    this.packageJson = options.packageJson || {};
    this.registry = options.registry || 'https://esm.sh';
    this.output = options.output || 'importmap.json';
  }

  // 从 package.json 生成 import map
  generate() {
    const imports = {};
    const scopes = {};
    
    const allDeps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
    };

    for (const [name, version] of Object.entries(allDeps)) {
      // 清理版本号 (^1.0.0 → 1.0.0)
      const cleanVersion = version.replace(/^[\^~]/, '');
      
      // 生成 CDN URL
      const url = `${this.registry}/${name}@${cleanVersion}`;
      imports[name] = url;
      
      // 子路径映射
      if (name === 'react') {
        imports['react-dom'] = `${this.registry}/react-dom@${cleanVersion}`;
        imports['react-dom/client'] = `${this.registry}/react-dom@${cleanVersion}/client`;
      }
      
      if (name === 'vue') {
        imports['vue/router'] = `${this.registry}/vue-router@4`;
      }
    }

    return { imports, scopes };
  }

  // 生成本地模块映射
  generateLocalMappings(srcDir = 'src') {
    const imports = {};
    
    // 扫描 src 目录
    const scan = (dir, prefix) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const importPath = `${prefix}${entry.name}`;
        
        if (entry.isDirectory()) {
          // 目录 → index.js
          const indexPath = path.join(fullPath, 'index.js');
          if (fs.existsSync(indexPath)) {
            imports[importPath] = `./${path.relative(process.cwd(), indexPath)}`;
          }
          scan(fullPath, `${importPath}/`);
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) {
          imports[importPath.replace(/\.(js|ts)$/, '')] = 
            `./${path.relative(process.cwd(), fullPath)}`;
        }
      }
    };

    scan(srcDir, '@/');
    return imports;
  }

  // 写入文件
  write() {
    const map = this.generate();
    const localMappings = this.generateLocalMappings();
    
    const fullMap = {
      imports: { ...map.imports, ...localMappings },
      scopes: map.scopes,
    };

    fs.writeFileSync(
      this.output,
      JSON.stringify(fullMap, null, 2)
    );

    console.log(`✅ Import Map generated: ${this.output}`);
    console.log(`📦 ${Object.keys(fullMap.imports).length} mappings`);
    
    return fullMap;
  }
}

// 使用
const generator = new ImportMapGenerator({
  packageJson: require('./package.json'),
  output: 'importmap.json',
});

generator.write();
```

### 4.3 Snowpack / WMR 原理

```
Snowpack 架构 (Bundlerless 代表):

┌──────────────────────────────────────────────────────────────────┐
│                     Snowpack 工作流程                             │
│                                                                  │
│  开发模式 (dev):                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  浏览器请求 /src/App.tsx                                 │    │
│  │         ↓                                                │    │
│  │  Snowpack 服务器                                          │    │
│  │  • 拦截 .ts/.tsx/.scss 等请求                             │    │
│  │  • 按需转换 (SWC/Babel)                                   │    │
│  │  • 重写 import 路径 (添加 ?url= 后缀)                     │    │
│  │  • 返回 ESM 格式                                          │    │
│  │         ↓                                                │    │
│  │  浏览器继续请求 import 的依赖 → 按需转换                   │    │
│  │                                                          │    │
│  │  关键: 每个文件独立转换，不打包                             │    │
│  │                                                          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  构建模式 (build):                                                │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  1. 依赖安装 → node_modules/.snowpack/                   │    │
│  │     • 预构建依赖为 ESM                                    │    │
│  │     • 合并小文件 (减少请求)                                │    │
│  │                                                          │    │
│  │  2. 源码转换 → build/                                    │    │
│  │     • TSX → JS (SWC)                                     │    │
│  │     • SCSS → CSS (esbuild)                               │    │
│  │     • 图片优化                                            │    │
│  │                                                          │    │
│  │  3. 优化 (可选)                                           │    │
│  │     • 使用 Rollup/esbuild 合并                            │    │    │
│  │     • Tree Shaking                                       │    │
│  │     • 压缩                                               │    │
│  │                                                          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  与 Vite 的区别:                                                  │
│  • Snowpack: 更激进的 bundlerless (生产也尽量不打包)               │
│  • Vite: 开发 bundlerless，生产用 Rollup/esbuild 打包             │
│  • 现状: Vite 胜出，Snowpack 已归档                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 五、CI/CD 构建优化

### 5.1 GitHub Actions 构建优化

```yaml
# .github/workflows/build-optimized.yml — 极致优化的 CI 构建

name: Build & Deploy
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '9'
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

jobs:
  # ============ 1. 影响分析 (决定需要构建什么) ============
  analyze:
    runs-on: ubuntu-latest
    outputs:
      apps: ${{ steps.filter.outputs.apps }}
      packages: ${{ steps.filter.outputs.packages }}
      needs-build: ${{ steps.filter.outputs.needs-build }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Filter changes
        id: filter
        uses: dorny/paths-filter@v3
        with:
          filters: |
            apps:
              - 'apps/**'
            packages:
              - 'packages/**'
            config:
              - 'turbo.json'
              - 'package.json'
              - 'pnpm-lock.yaml'

  # ============ 2. 安装依赖 (缓存优化) ============
  install:
    needs: analyze
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      # ============ 多层缓存策略 ============
      - name: Cache pnpm store
        uses: actions/cache@v4
        with:
          path: ~/.pnpm-store
          key: pnpm-store-${{ hashFiles('pnpm-lock.yaml') }}
          restore-keys: |
            pnpm-store-
      
      - name: Cache node_modules
        uses: actions/cache@v4
        with:
          path: |
            node_modules
            apps/*/node_modules
            packages/*/node_modules
          key: node-modules-${{ hashFiles('pnpm-lock.yaml') }}
          restore-keys: |
            node-modules-
      
      - name: Cache Turbo
        uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ github.sha }}
          restore-keys: |
            turbo-
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile

  # ============ 3. 并行构建 (按包并行) ============
  build:
    needs: [analyze, install]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        # 并行构建每个 app/package
        target: ${{ fromJson(needs.analyze.outputs.apps || '[]') }}
      fail-fast: false
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      # 恢复缓存
      - uses: actions/cache/restore@v4
        with:
          path: |
            node_modules
            apps/*/node_modules
            packages/*/node_modules
          key: node-modules-${{ hashFiles('pnpm-lock.yaml') }}
      
      - uses: actions/cache/restore@v4
        with:
          path: .turbo
          key: turbo-${{ github.sha }}
          restore-keys: turbo-
      
      # ============ SWC 加速构建 ============
      - name: Build ${{ matrix.target }}
        run: |
          pnpm turbo build --filter=${{ matrix.target }} \
            --concurrency=100%
        env:
          # SWC 并行
          SWC_NUM_THREADS: 4
          # Node.js 内存限制
          NODE_OPTIONS: "--max-old-space-size=4096"

  # ============ 4. 并行测试 ============
  test:
    needs: [analyze, install]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        target: ${{ fromJson(needs.analyze.outputs.packages || '[]') }}
      fail-fast: false
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}
      
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - uses: actions/cache/restore@v4
        with:
          path: node_modules
          key: node-modules-${{ hashFiles('pnpm-lock.yaml') }}
      
      - name: Test ${{ matrix.target }}
        run: pnpm turbo test --filter=${{ matrix.target }}
        env:
          # Jest 并行
          JEST_WORKERS: 4

  # ============ 5. 产物上传 ============
  upload:
    needs: [build, test]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: |
            apps/*/dist
            packages/*/dist
          retention-days: 7
```

### 5.2 Docker 构建优化

```dockerfile
# Dockerfile.build-optimized — 极致优化的 Docker 构建

# ============ Stage 1: 安装依赖 ============
FROM node:20-alpine AS deps

WORKDIR /app

# 只复制 package 文件 (利用 Docker 层缓存)
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/ui/package.json packages/ui/
COPY packages/utils/package.json packages/utils/

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 安装依赖 (缓存层)
RUN pnpm install --frozen-lockfile

# ============ Stage 2: 构建 ============
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/utils/node_modules ./packages/utils/node_modules

# 复制源码
COPY . .

# 构建配置
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# 并行构建
RUN pnpm turbo build --concurrency=100%

# ============ Stage 3: 产物清理 ============
FROM node:20-alpine AS pruner

WORKDIR /app

# 只复制需要的产物
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json

# 只安装生产依赖
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# ============ Stage 4: 运行 ============
FROM node:20-alpine AS runner

WORKDIR /app

# 安全: 非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# 复制产物
COPY --from=pruner --chown=nodejs:nodejs /app ./app

USER nodejs

EXPOSE 3000

CMD ["node", "apps/server/dist/index.js"]
```

```dockerfile
# Dockerfile.dev — 开发环境 Docker (热更新)

FROM node:20-alpine

WORKDIR /app

# 安装开发工具
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 复制 package 文件
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/*/package.json packages/*/package.json ./

# 安装依赖
RUN pnpm install

# 复制源码 (挂载卷)
COPY . .

# 开发模式: 挂载源码实现热更新
# docker run -v $(pwd):/app -p 3000:3000 dev-image

EXPOSE 3000 3001

CMD ["pnpm", "dev"]
```

### 5.3 构建缓存策略总结

```
CI/CD 构建缓存策略:

┌─────────────────────────────────────────────────────────┐
│                  多层缓存策略                            │
│                                                         │
│  Level 1: 依赖缓存 (node_modules)                        │
│  • 缓存 key: hash(pnpm-lock.yaml)                        │
│  • 命中时跳过 pnpm install (节省 30-60s)                 │
│  • 工具: actions/cache@v4                                │
│                                                         │
│  Level 2: 构建缓存 (Turborepo/Nx)                        │
│  • 缓存 key: hash(源码 + 配置)                            │
│  • 命中时跳过构建 (节省 60-300s)                          │
│  • 工具: Turborepo Remote Cache                          │
│                                                         │
│  Level 3: Docker 层缓存                                  │
│  • 分层复制 (package.json → 安装 → 源码)                  │
│  • 依赖不变时复用安装层                                   │
│  • 工具: Docker BuildKit                                 │
│                                                         │
│  Level 4: SWC/esbuild 内存缓存                           │
│  • 编译结果缓存在内存                                     │
│  • 增量编译只处理变化文件                                  │
│  • 工具: SWC cache / esbuild cache                       │
│                                                         │
│  缓存命中率目标:                                          │
│  • 依赖缓存: > 95%                                       │
│  • 构建缓存: > 80%                                       │
│  • Docker 层缓存: > 70%                                  │
│                                                         │
│  缓存失效策略:                                            │
│  • 依赖变化 → 失效 Level 1+2+3                           │
│  • 配置变化 → 失效 Level 2+3                             │
│  • 源码变化 → 仅失效 Level 2                             │
└─────────────────────────────────────────────────────────┘
```

---

## 六、手写模块化加载器 (Bundlerless Runtime)

### 6.1 原生 ESM 加载器

```javascript
// esm-loader.js — 手写 ESM 模块加载器 (理解浏览器如何加载 ESM)

class ESMLoader {
  constructor() {
    this.moduleCache = new Map();    // 已加载模块缓存
    this.loadingPromises = new Map(); // 正在加载的 Promise
    this.importMap = new Map();       // Import Map 映射
    this.transformers = new Map();    // 转换器 (TS→JS, etc.)
  }

  // ============ 1. 注册 Import Map ============

  setImportMap(map) {
    for (const [key, value] of Object.entries(map.imports || {})) {
      this.importMap.set(key, value);
    }
    if (map.scopes) {
      for (const [scope, mappings] of Object.entries(map.scopes)) {
        for (const [key, value] of Object.entries(mappings)) {
          this.importMap.set(`${scope}${key}`, value);
        }
      }
    }
  }

  // ============ 2. 注册转换器 ============

  registerTransformer(extension, transformFn) {
    this.transformers.set(extension, transformFn);
  }

  // ============ 3. 解析模块 ID ============

  resolve(importer, specifier) {
    // 绝对 URL
    if (specifier.startsWith('http://') || specifier.startsWith('https://')) {
      return specifier;
    }

    // Import Map 匹配
    for (const [key, value] of this.importMap) {
      if (specifier === key || specifier.startsWith(key + '/')) {
        const suffix = specifier.slice(key.length);
        return value + suffix;
      }
    }

    // 相对路径
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      const base = importer ? new URL(importer, 'file://') : new URL('file://');
      const resolved = new URL(specifier, base);
      return resolved.href;
    }

    throw new Error(`Cannot resolve: ${specifier} (imported by ${importer})`);
  }

  // ============ 4. 加载模块 ============

  async load(moduleUrl, importer = null) {
    const resolvedUrl = this.resolve(importer, moduleUrl);

    // 缓存命中
    if (this.moduleCache.has(resolvedUrl)) {
      return this.moduleCache.get(resolvedUrl);
    }

    // 正在加载，复用 Promise
    if (this.loadingPromises.has(resolvedUrl)) {
      return this.loadingPromises.get(resolvedUrl);
    }

    // 开始加载
    const loadPromise = this._doLoad(resolvedUrl);
    this.loadingPromises.set(resolvedUrl, loadPromise);

    try {
      const module = await loadPromise;
      this.moduleCache.set(resolvedUrl, module);
      return module;
    } finally {
      this.loadingPromises.delete(resolvedUrl);
    }
  }

  async _doLoad(url) {
    // 1. 获取源码
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${url} (${response.status})`);
    }
    let source = await response.text();

    // 2. 转换 (如果需要)
    const ext = this._getExtension(url);
    const transformer = this.transformers.get(ext);
    if (transformer) {
      source = await transformer(source, url);
    }

    // 3. 解析依赖
    const dependencies = this._parseDependencies(source);

    // 4. 创建模块命名空间
    const moduleNamespace = Object.create(null);
    const moduleRecord = {
      url,
      source,
      dependencies,
      namespace: moduleNamespace,
      evaluated: false,
    };

    // 预注册 (解决循环依赖)
    this.moduleCache.set(url, moduleRecord);

    // 5. 加载依赖
    const depPromises = dependencies.map(async ([specifier, dynamic]) => {
      if (dynamic) {
        return [specifier, () => this.load(specifier, url)];
      }
      const depModule = await this.load(specifier, url);
      return [specifier, depModule];
    });

    const resolvedDeps = await Promise.all(depPromises);

    // 6. 创建 require/import 函数
    const requireFn = (specifier) => {
      const dep = resolvedDeps.find(([s]) => s === specifier);
      if (!dep) throw new Error(`Dependency not found: ${specifier}`);
      return dep[1];
    };

    // 7. 执行模块代码
    const exports = {};
    const moduleObj = { exports };

    const wrappedCode = this._wrapModule(source, resolvedDeps);
    const fn = new Function(
      'exports', 'module', 'require', 'import.meta',
      wrappedCode
    );

    fn(exports, moduleObj, requireFn, {
      url,
      hot: this._createHotContext(url),
    });

    moduleRecord.namespace = moduleObj.exports;
    moduleRecord.evaluated = true;

    return moduleRecord;
  }

  // ============ 5. 解析 import 语句 ============

  _parseDependencies(source) {
    const dependencies = [];
    
    // 静态 import
    const staticImportRegex = /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = staticImportRegex.exec(source)) !== null) {
      dependencies.push([match[1], false]);
    }

    // 动态 import
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(source)) !== null) {
      dependencies.push([match[1], true]);
    }

    return dependencies;
  }

  // ============ 6. 包装模块代码 ============

  _wrapModule(source, resolvedDeps) {
    // 重写 import 路径为 resolved URL
    let code = source;
    for (const [specifier, _dynamic] of resolvedDeps) {
      const resolved = this.resolve(null, specifier);
      // 替换 import 路径
      code = code.replace(
        new RegExp(`(['"])${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`, 'g'),
        `$1${resolved}$1`
      );
    }
    return code;
  }

  // ============ 7. 获取文件扩展名 ============

  _getExtension(url) {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop();
    return `.${ext}`;
  }

  // ============ 8. HMR 上下文 ============

  _createHotContext(moduleUrl) {
    return {
      accept: (callback) => {
        // 注册热更新回调
        console.log(`[HMR] ${moduleUrl} accepts updates`);
      },
      dispose: (callback) => {
        // 注册清理回调
        console.log(`[HMR] ${moduleUrl} registered dispose`);
      },
      invalidate: () => {
        // 强制刷新
        window.location.reload();
      },
    };
  }

  // ============ 9. 主入口 ============

  async bootstrap(entryUrl) {
    console.log(`🚀 Bootstrapping ESM Loader...`);
    console.log(`📥 Entry: ${entryUrl}`);

    const entryModule = await this.load(entryUrl);
    console.log(`✅ Entry module loaded: ${entryModule.url}`);
    console.log(`📦 Total cached modules: ${this.moduleCache.size}`);

    return entryModule.namespace;
  }
}

// ============ 使用示例 ============

// 创建加载器
const loader = new ESMLoader();

// 注册 Import Map
loader.setImportMap({
  imports: {
    'react': 'https://esm.sh/react@18.3.1',
    'react-dom/client': 'https://esm.sh/react-dom@18.3.1/client',
    '@/utils/': '/src/utils/',
  },
});

// 注册 TypeScript 转换器 (使用 SWC WASM)
loader.registerTransformer('.ts', async (source, url) => {
  // 实际项目中调用 SWC WASM 转换
  // const { transform } = await import('@swc/wasm-web');
  // const result = await transform(source, { filename: url });
  // return result.code;
  return source; // 简化版
});

loader.registerTransformer('.tsx', async (source, url) => {
  // TSX → JS 转换
  return source;
});

// 启动
// loader.bootstrap('/src/main.tsx').then((app) => {
//   app.default();
// });
```

### 6.2 SystemJS 兼容层

```javascript
// systemjs-adapter.js — SystemJS 兼容适配器

/*
SystemJS 是一个通用的模块加载器，支持:
- System.register (Rollup 输出格式)
- AMD (define)
- CommonJS (require)
- Global 全局变量

在现代项目中，SystemJS 主要用于:
1. 微前端 (qiankun/single-spa)
2. 动态加载第三方模块
3. 沙箱隔离
*/

class SystemJSAdapter {
  constructor(loader) {
    this.loader = loader;
    this.modules = new Map();
    this.plugins = new Map();
  }

  // ============ System.register 实现 ============

  register(name, deps, declare) {
    this.modules.set(name, {
      deps,
      declare,
      instantiated: false,
      evaluated: false,
      exports: {},
    });
  }

  // ============ 实例化模块 ============

  async instantiate(name) {
    const module = this.modules.get(name);
    if (!module) throw new Error(`Module not found: ${name}`);
    if (module.instantiated) return module;

    // 实例化依赖
    const resolvedDeps = await Promise.all(
      module.deps.map(async (dep) => {
        if (dep === '@babel/helpers') return null;
        return this.loader.load(dep);
      })
    );

    // 创建 exports 对象
    const exports = {};
    const moduleObj = { exports };

    // 创建 require 函数
    const require = (depName) => {
      const idx = module.deps.indexOf(depName);
      if (idx === -1) throw new Error(`Dependency not found: ${depName}`);
      return resolvedDeps[idx];
    };

    // 调用 declare 函数
    const facade = declare(exports);
    if (facade) {
      Object.assign(exports, facade);
    }

    module.exports = exports;
    module.instantiated = true;

    return module;
  }

  // ============ 加载模块 ============

  async import(name) {
    const module = await this.instantiate(name);
    
    if (!module.evaluated) {
      module.evaluated = true;
    }

    return module.exports;
  }

  // ============ 注册插件 ============

  use(pluginName, plugin) {
    this.plugins.set(pluginName, plugin);
  }

  // ============ 全局注册 (兼容 UMD) ============

  setGlobal(name, value) {
    this.modules.set(name, {
      deps: [],
      declare: () => ({ default: value, ...value }),
      instantiated: true,
      evaluated: true,
      exports: value,
    });
  }
}

// ============ 使用示例 (微前端) ============

/*
// 主应用加载子应用
const adapter = new SystemJSAdapter(loader);

// 加载子应用 remoteEntry.js
await fetch('http://sub-app:3001/remoteEntry.js')
  .then(r => r.text())
  .then(code => {
    // remoteEntry.js 会调用 System.register 注册模块
    eval(code);
  });

// 获取子应用导出
const SubApp = await adapter.import('./App');
*/
```

---

## 七、构建性能分析与调优实战

### 7.1 构建性能 profiling

```javascript
// build-profiler.js — 构建性能分析器

class BuildProfiler {
  constructor() {
    this.phases = [];
    this.startTime = Date.now();
    this.memorySnapshots = [];
  }

  // ============ 1. 阶段计时 ============

  startPhase(name) {
    const phase = {
      name,
      start: Date.now(),
      memory: this._getMemory(),
      children: [],
    };
    this.phases.push(phase);
    return {
      end: () => {
        phase.end = Date.now();
        phase.duration = phase.end - phase.start;
        phase.memoryEnd = this._getMemory();
        phase.memoryDelta = phase.memoryEnd.heapUsed - phase.memory.heapUsed;
      },
    };
  }

  // ============ 2. 内存追踪 ============

  _getMemory() {
    const mem = process.memoryUsage();
    return {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
    };
  }

  snapshotMemory(label) {
    this.memorySnapshots.push({
      label,
      time: Date.now() - this.startTime,
      ...this._getMemory(),
    });
  }

  // ============ 3. 模块级分析 ============

  analyzeModule(modulePath, code) {
    const parseStart = Date.now();
    
    // 解析 AST
    const { parse } = require('@babel/parser');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
    
    const parseTime = Date.now() - parseStart;

    // 统计
    let importCount = 0;
    let exportCount = 0;
    let functionCount = 0;
    let classCount = 0;

    const traverse = require('@babel/traverse').default;
    traverse(ast, {
      ImportDeclaration: () => importCount++,
      ExportNamedDeclaration: () => exportCount++,
      ExportDefaultDeclaration: () => exportCount++,
      FunctionDeclaration: () => functionCount++,
      ClassDeclaration: () => classCount++,
    });

    return {
      path: modulePath,
      size: Buffer.byteLength(code),
      parseTime,
      imports: importCount,
      exports: exportCount,
      functions: functionCount,
      classes: classCount,
      complexity: this._estimateComplexity(ast),
    };
  }

  // ============ 4. 复杂度估算 ============

  _estimateComplexity(ast) {
    let complexity = 1;
    const traverse = require('@babel/traverse').default;
    
    traverse(ast, {
      IfStatement: () => complexity++,
      ForStatement: () => complexity++,
      WhileStatement: () => complexity++,
      SwitchCase: () => complexity++,
      CatchClause: () => complexity++,
      LogicalExpression: () => complexity++,
    });

    return complexity;
  }

  // ============ 5. 生成报告 ============

  report() {
    const totalTime = Date.now() - this.startTime;

    console.log('\n' + '='.repeat(60));
    console.log('📊 构建性能分析报告');
    console.log('='.repeat(60));

    // 阶段耗时
    console.log('\n⏱️  阶段耗时:');
    const sorted = [...this.phases].sort((a, b) => (b.end - b.start) - (a.end - a.start));
    sorted.forEach((phase, i) => {
      if (!phase.end) return;
      const pct = ((phase.duration / totalTime) * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(phase.duration / 10));
      console.log(
        `  ${(i + 1).toString().padStart(2)}. ${phase.name.padEnd(20)} ` +
        `${phase.duration.toString().padStart(6)}ms (${pct}%) ${bar}`
      );
    });

    // 内存分析
    console.log('\n💾 内存分析:');
    this.memorySnapshots.forEach((snap) => {
      console.log(
        `  ${snap.label.padEnd(20)} ` +
        `Heap: ${snap.heapUsed}MB / ${snap.heapTotal}MB ` +
        `RSS: ${snap.rss}MB`
      );
    });

    // 总结
    console.log('\n📈 总结:');
    console.log(`  总耗时: ${totalTime}ms`);
    console.log(`  峰值内存: ${this._getMemory().heapUsed}MB`);
    console.log(`  阶段数: ${this.phases.length}`);

    // 优化建议
    const slowPhases = sorted.filter(p => p.end && p.duration > 500);
    if (slowPhases.length > 0) {
      console.log('\n⚠️  优化建议:');
      slowPhases.forEach(phase => {
        console.log(`  • ${phase.name}: ${phase.duration}ms — 考虑使用缓存或并行化`);
      });
    }

    console.log('='.repeat(60) + '\n');

    return {
      totalTime,
      phases: sorted.filter(p => p.end),
      memory: this.memorySnapshots,
    };
  }
}

// ============ 使用示例 ============

/*
const profiler = new BuildProfiler();

// 分析各阶段
const parseTimer = profiler.startPhase('AST 解析');
// ... 解析代码 ...
parseTimer.end();

const transformTimer = profiler.startPhase('代码转换');
// ... 转换代码 ...
transformTimer.end();

const bundleTimer = profiler.startPhase('打包生成');
// ... 打包 ...
bundleTimer.end();

profiler.snapshotMemory('打包完成后');

// 生成报告
profiler.report();
*/
```

### 7.2 构建性能调优 Checklist (2026)

```
构建性能调优 Checklist (2026 最新版):

✅ 解析层
  [ ] 使用 SWC/OXC 替代 Babel 解析 (15-20x 加速)
  [ ] 排除 node_modules 从解析
  [ ] 使用 include 精确指定范围
  [ ] 启用 SWC 并行解析

✅ 转换层
  [ ] swc-loader 替代 babel-loader
  [ ] SWC 目标设为 es2022 (减少降级代码)
  [ ] 使用 loose 模式 (可选，更小输出)
  [ ] 禁用不必要的 transform

✅ 压缩层
  [ ] SWC minifier 替代 Terser (10x 加速)
  [ ] esbuild 压缩 (更快，略大)
  [ ] 并行压缩 (多 CPU)
  [ ] 按需压缩 (仅生产)

✅ 类型检查
  [ ] ForkTsCheckerWebpackPlugin (异步检查)
  [ ] isolatedModules (跳过类型检查，交给 IDE)
  [ ] SWC 类型擦除 (不检查类型，只擦除)

✅ 缓存
  [ ] Webpack filesystem cache
  [ ] Turborepo 远程缓存
  [ ] SWC 编译缓存
  [ ] CI 多层缓存策略

✅ 并行
  [ ] thread-loader (Webpack 多线程)
  [ ] SWC 多线程
  [ ] 并行压缩
  [ ] 多入口并行构建

✅ 模块系统
  [ ] ESM 优先 (Tree Shaking)
  [ ] sideEffects: false (标注无副作用)
  [ ] 避免 barrel files (index.js re-export)
  [ ] 使用命名导出 (named export)

✅ 依赖
  [ ] 替换大型库 (moment→dayjs, lodash→lodash-es)
  [ ] 使用 tree-shakeable 的包
  [ ] 外部化大型依赖 (externals/CDN)
  [ ] 定期审计 (npm ls / depcheck / madge)

✅ 代码分割
  [ ] 路由级分割 (React.lazy / import())
  [ ] vendor 分割 (react/vue 单独 chunk)
  [ ] 按需加载 (重型组件)
  [ ] 预加载关键 chunk (prefetch/preload)

✅ 资源
  [ ] 图片 WebP/AVIF
  [ ] 小图片 base64 inline
  [ ] 字体 subsetting
  [ ] SVG sprite / inline SVG

✅ 开发体验
  [ ] SWC HMR (极速热更新)
  [ ] Vite 开发服务器
  [ ] Source Map (eval-cheap-module-source-map for dev)
  [ ] 错误 Overlay
```

---

## 八、综合实战 — 手写现代构建系统 v3

### 8.1 架构设计

```
现代构建系统 v3 架构:

┌──────────────────────────────────────────────────────────────────┐
│                   Modern Build System v3                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    配置层 (Config)                         │    │
│  │  build.config.js (TypeScript 配置)                        │    │
│  └──────────────────────────────────────────────────────────┘    │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                   核心引擎 (Engine)                        │    │
│  │                                                          │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │    │
│  │  │ Resolver   │→│ Parser     │→│ Transformer│         │    │
│  │  │ 模块解析器  │  │ AST 解析器  │  │ 代码转换器  │         │    │
│  │  │            │  │ (SWC/OXC)  │  │ (SWC)     │         │    │
│  │  └────────────┘  └────────────┘  └────────────┘         │    │
│  │         ↓              ↓              ↓                  │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │    │
│  │  │ Graph      │→│ Optimizer  │→│ Emitter    │         │    │
│  │  │ 依赖图     │  │ 优化器     │  │ 输出器     │         │    │
│  │  │ (BFS)      │  │ (TreeShake │  │ (Multi-    │         │    │
│  │  │            │  │  Minify)   │  │  format)   │         │    │
│  │  └────────────┘  └────────────┘  └────────────┘         │    │
│  │                                                          │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │    │
│  │  │ Cache      │  │ HMR        │  │ Plugin     │         │    │
│  │  │ 缓存系统   │  │ 热更新     │  │ 插件系统   │         │    │
│  │  │ (文件哈希) │  │ (WebSocket)│  │ (Hook)     │         │    │
│  │  └────────────┘  └────────────┘  └────────────┘         │    │
│  └──────────────────────────────────────────────────────────┘    │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                   输出层 (Output)                          │    │
│  │  • ESM (现代浏览器)                                       │    │
│  │  • CJS (Node.js)                                         │    │
│  │  • UMD (浏览器全局)                                       │    │
│  │  • Source Map                                            │    │
│  │  • Stats (构建分析)                                       │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  核心特性:                                                        │
│  • SWC 解析 + 转换 (比 Babel 快 15x)                             │
│  • 增量编译 (文件哈希缓存)                                        │
│  • 并行构建 (Worker Threads)                                     │
│  • 插件系统 (Tapable 风格 Hook)                                   │
│  • HMR (WebSocket + 模块替换)                                    │
│  • 多格式输出 (ESM/CJS/UMD)                                      │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 核心实现

```javascript
// modern-build-system.js — 现代构建系统核心

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// ============ Hook 系统 (Tapable 风格) ============

class Hook {
  constructor() { this.taps = []; }
  tap(name, fn) { this.taps.push({ name, fn }); }
  call(...args) { for (const t of this.taps) t.fn(...args); }
}

class AsyncSeriesHook {
  constructor() { this.taps = []; }
  tap(name, fn) { this.taps.push({ name, fn }); }
  async callAsync(...args) {
    for (const t of this.taps) await t.fn(...args);
  }
}

class WaterfallHook {
  constructor() { this.taps = []; }
  tap(name, fn) { this.taps.push({ name, fn }); }
  call(value, ...args) {
    for (const t of this.taps) value = t.fn(value, ...args);
    return value;
  }
}

// ============ 缓存系统 ============

class BuildCache {
  constructor(cacheDir = '.build-cache') {
    this.cacheDir = cacheDir;
    this.cache = this._load();
  }

  _load() {
    const p = path.join(this.cacheDir, 'cache.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    return { version: Date.now(), modules: {} };
  }

  _save() {
    if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true });
    fs.writeFileSync(path.join(this.cacheDir, 'cache.json'), JSON.stringify(this.cache, null, 2));
  }

  hash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  get(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const currentHash = this.hash(content);
    const cached = this.cache.modules[filePath];
    return cached && cached.hash === currentHash ? cached : null;
  }

  set(filePath, data) {
    const content = fs.readFileSync(filePath, 'utf-8');
    this.cache.modules[filePath] = {
      hash: this.hash(content),
      ...data,
      timestamp: Date.now(),
    };
    this._save();
  }

  clear() {
    this.cache = { version: Date.now(), modules: {} };
    this._save();
  }
}

// ============ 模块解析器 ============

class Resolver {
  constructor(options = {}) {
    this.extensions = options.extensions || ['.tsx', '.ts', '.jsx', '.js', '.json'];
    this.alias = options.alias || {};
  }

  resolve(fromPath, specifier) {
    // 别名
    for (const [key, value] of Object.entries(this.alias)) {
      if (specifier === key || specifier.startsWith(key + '/')) {
        specifier = path.resolve(process.cwd(), value, specifier.slice(key.length));
        break;
      }
    }

    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      const dir = path.dirname(fromPath);
      const base = path.resolve(dir, specifier);

      if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;

      for (const ext of this.extensions) {
        const fullPath = base + ext;
        if (fs.existsSync(fullPath)) return fullPath;
      }

      if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
        for (const ext of this.extensions) {
          const indexPath = path.join(base, 'index' + ext);
          if (fs.existsSync(indexPath)) return indexPath;
        }
      }
    }

    return null;
  }
}

// ============ 核心构建引擎 ============

class ModernBuildEngine {
  constructor(options = {}) {
    this.entry = options.entry;
    this.output = options.output || { path: './dist', filename: 'bundle.js' };
    this.alias = options.alias || {};
    this.plugins = options.plugins || [];
    this.cache = new BuildCache(options.cacheDir);
    this.resolver = new Resolver({ alias: this.alias });
    this.modules = new Map();
    this.startTime = Date.now();

    // Hook 系统
    this.hooks = {
      beforeBuild: new AsyncSeriesHook(),
      afterBuild: new AsyncSeriesHook(),
      transform: new WaterfallHook(),
      beforeEmit: new AsyncSeriesHook(),
      done: new Hook(),
    };
  }

  // ============ 构建单个模块 ============

  async buildModule(filePath) {
    const moduleId = path.relative(process.cwd(), filePath);

    // 缓存检查
    const cached = this.cache.get(filePath);
    if (cached) {
      this.modules.set(moduleId, { ...cached, id: moduleId, path: filePath, cached: true });
      return cached;
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // 解析 AST (使用 @babel/parser 作为示例)
    const { parse } = require('@babel/parser');
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'dynamicImport'],
    });

    // 收集依赖
    const dependencies = [];
    const traverse = require('@babel/traverse').default;
    traverse(ast, {
      ImportDeclaration: ({ node }) => {
        const source = node.source.value;
        if (source.startsWith('.') || source.startsWith('/') || source.startsWith('@')) {
          const resolved = this.resolver.resolve(filePath, source);
          if (resolved) dependencies.push(resolved);
        }
      },
    });

    // 转换代码
    let code = content;
    code = this.hooks.transform.call(code, { filePath, ast });

    const result = {
      id: moduleId,
      path: filePath,
      code,
      dependencies,
      hash: this.cache.hash(content),
    };

    // 缓存结果
    this.cache.set(filePath, result);
    this.modules.set(moduleId, { ...result, cached: false });

    return result;
  }

  // ============ 构建依赖图 ============

  async buildGraph(entryPath) {
    const queue = [entryPath];
    const visited = new Set();

    while (queue.length > 0) {
      const filePath = queue.shift();
      if (visited.has(filePath)) continue;
      visited.add(filePath);

      const module = await this.buildModule(filePath);

      for (const dep of module.dependencies) {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      }
    }
  }

  // ============ 生成 Bundle ============

  generateBundle(entryId) {
    const moduleMap = {};
    for (const [id, mod] of this.modules) {
      const key = `./${path.basename(id)}`;
      moduleMap[key] = mod.code;
    }

    const depsMap = {};
    for (const [id, mod] of this.modules) {
      const key = `./${path.basename(id)}`;
      depsMap[key] = {};
      mod.dependencies.forEach((dep) => {
        depsMap[key][`./${path.basename(dep)}`] = `./${path.basename(dep)}`;
      });
    }

    return `
(function(moduleMap, depsMap) {
  var cache = {};
  
  function require(key) {
    if (cache[key]) return cache[key].exports;
    
    var mod = { exports: {} };
    cache[key] = mod;
    
    var fn = moduleMap[key];
    var localRequire = function(p) {
      return require(depsMap[key][p]);
    };
    
    fn(localRequire, mod, mod.exports);
    return mod.exports;
  }
  
  require('./${path.basename(entryId)}');
})(${JSON.stringify(moduleMap)}, ${JSON.stringify(depsMap)});
    `.trim();
  }

  // ============ 主构建流程 ============

  async build() {
    console.log('🚀 Modern Build Engine v3');
    console.log(`📥 Entry: ${this.entry}`);
    console.log(`📤 Output: ${this.output.path}/${this.output.filename}\n`);

    // Hook: beforeBuild
    await this.hooks.beforeBuild.callAsync(this);

    // 构建依赖图
    await this.buildGraph(path.resolve(this.entry));

    // 生成 Bundle
    const entryId = path.relative(process.cwd(), path.resolve(this.entry));
    const bundle = this.generateBundle(entryId);

    // Hook: beforeEmit
    await this.hooks.beforeEmit.callAsync(this, { bundle });

    // 输出文件
    const outDir = path.resolve(this.output.path);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, this.output.filename), bundle);

    // Hook: afterBuild
    await this.hooks.afterBuild.callAsync(this);

    // 统计
    const elapsed = Date.now() - this.startTime;
    const cachedCount = [...this.modules.values()].filter(m => m.cached).length;
    const builtCount = this.modules.size - cachedCount;

    console.log(`\n✅ Build complete!`);
    console.log(`📦 ${this.modules.size} modules (${builtCount} built, ${cachedCount} cached)`);
    console.log(`⏱️  ${elapsed}ms`);
    console.log(`💾 ${(Buffer.byteLength(bundle) / 1024).toFixed(2)} KB`);

    // Hook: done
    this.hooks.done.call({
      modules: this.modules.size,
      elapsed,
      size: Buffer.byteLength(bundle),
    });

    return { modules: this.modules.size, elapsed, size: Buffer.byteLength(bundle) };
  }
}

// ============ 插件示例 ============

// 插件: 日志
function loggerPlugin() {
  return {
    name: 'logger',
    apply(engine) {
      engine.hooks.beforeBuild.tapAsync('logger', async (engine, next) => {
        console.log('📝 [Logger] Build started');
        next();
      });
      engine.hooks.done.tap('logger', (stats) => {
        console.log(`✅ [Logger] Done! ${stats.modules} modules in ${stats.elapsed}ms`);
      });
    }
  };
}

// 插件: 统计
function statsPlugin(options = {}) {
  return {
    name: 'stats',
    apply(engine) {
      engine.hooks.done.tap('stats', (stats) => {
        const data = {
          timestamp: new Date().toISOString(),
          ...stats,
          modules: [...engine.modules.entries()].map(([id, mod]) => ({
            id,
            size: Buffer.byteLength(mod.code),
            cached: mod.cached,
          })),
        };
        const outPath = path.join(engine.output.path, options.filename || 'stats.json');
        fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
        console.log(`📊 [Stats] Written to ${options.filename || 'stats.json'}`);
      });
    }
  };
}

// ============ 使用示例 ============

/*
const engine = new ModernBuildEngine({
  entry: './src/index.tsx',
  output: {
    path: './dist',
    filename: 'bundle.js',
  },
  alias: {
    '@': './src',
    '@components': './src/components',
  },
  plugins: [
    loggerPlugin(),
    statsPlugin(),
  ],
});

engine.build();
*/

module.exports = { ModernBuildEngine, Hook, AsyncSeriesHook, WaterfallHook, BuildCache };
```

---

## 九、知识体系总结 (v3 新增)

### 9.1 构建工具知识图谱 v3

```
构建工具知识图谱 v3 (新增内容):

├── 现代工具生态 (2024-2026)
│   ├── Rust 工具链崛起 (Rspack/Turbopack/Rolldown/OXC)
│   ├── SWC 生态 (解析/转换/压缩/插件)
│   ├── 统一工具链 (OXC: Parser + Transform + Lint + Minify)
│   └── 国产工具 (Farm/Rspack/oxc)
│
├── Monorepo 构建
│   ├── 包管理 (pnpm/npm/Yarn/Bun)
│   ├── 任务编排 (Turborepo/Nx/Rush)
│   ├── 远程缓存 (Vercel/自建)
│   ├── 影响分析 (Turborepo dependsOn/Nx affected)
│   └── 发布策略 (Changesets/SemVer)
│
├── Bundlerless 方案
│   ├── Import Maps (原生模块映射)
│   ├── 原生 ESM 加载 (浏览器原生支持)
│   ├── Snowpack/WMR 原理 (按需转换)
│   ├── SystemJS (微前端兼容层)
│   └── 手写 ESM Loader (理解加载原理)
│
├── CI/CD 构建优化
│   ├── GitHub Actions 优化 (多层缓存/并行/影响分析)
│   ├── Docker 多阶段构建 (依赖/构建/运行分离)
│   ├── 缓存策略 (依赖/构建/Docker/SWC 四层)
│   └── 构建性能 profiling
│
└── 手写现代构建系统
    ├── Hook 系统 (Tapable 风格)
    ├── 缓存系统 (文件哈希增量)
    ├── 模块解析器 (别名/扩展名/node_modules)
    ├── 依赖图构建 (BFS)
    ├── 插件系统 (生命周期钩子)
    └── 多格式输出 (ESM/CJS/UMD)
```

### 9.2 五轮构建工具训练总结

| 轮次 | 日期 | 主题 | 核心内容 |
|------|------|------|----------|
| v1 | 4/21 | 基础 | Webpack 配置 + Vite 配置 + 手写 Bundler + esbuild + HMR + Tree Shaking |
| v2 | 4/30 | 进阶 | Tapable 钩子 + Mini Compiler + Vite 插件 + Module Federation + 增量编译 + Rollup + Rspack |
| v3 | 5/2 | 现代生态 | Rust 工具链 + SWC 生态 + Monorepo + Bundlerless + CI/CD 优化 + 手写现代构建引擎 |

**构建工具训练**: 3 轮迭代，全部闭环 ✅

---

## 十、实战练习

### 练习 1: SWC 插件开发
- [ ] 用 Rust 编写 SWC 插件 (移除 console.log)
- [ ] 用 Rust 编写 SWC 插件 (自动添加 __DEV__ 条件编译)
- [ ] 用 Rust 编写 SWC 插件 (i18n 键替换)

### 练习 2: Monorepo 搭建
- [ ] 用 pnpm + Turborepo 搭建 Monorepo
- [ ] 配置远程缓存 (Vercel 或自建)
- [ ] 配置 Changesets 自动发布
- [ ] 配置 GitHub Actions CI/CD

### 练习 3: Import Maps 实战
- [ ] 用 Import Maps 实现零打包 React 应用
- [ ] 手写 Import Map 生成器
- [ ] 实现作用域映射 (不同模块不同版本)

### 练习 4: 构建性能优化
- [ ] 用 BuildProfiler 分析现有项目构建
- [ ] 实现四层缓存策略
- [ ] 对比 Babel→SWC 的性能提升
- [ ] 生成优化报告

---

*训练材料版本：3.0 (现代生态) | 创建日期：2026-05-02*  
*前置材料：`build-tools-1400.md` (基础) + `build-tools-advanced-1400-0430.md` (进阶)*  
*构建工具训练累计：3 轮迭代，全部闭环 ✅*
