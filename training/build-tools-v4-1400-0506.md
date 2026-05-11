# 🔧 构建工具专项 v4 — 打包算法深度 + Rust 工具链 + 高级优化策略

**时间：** 2026-05-06 14:00  
**前置：** `build-tools-1400.md` (基础) + `build-tools-advanced-1400-0430.md` (进阶) + `build-tools-v3-1400-0502.md` (现代生态)  
**目标：** 深入打包算法内核、Rust 工具链原理、高级代码分割策略、增量编译算法

---

## 一、打包算法内核深度解析

### 1.1 模块解析算法 — 从入口到完整依赖图

```
模块解析的四个核心步骤：

Step 1: 入口分析 (Entry Analysis)
  ┌─────────────────────────────────────────────┐
  │ 读取 entry 配置                             │
  │ 对每个 entry 执行 resolve()                 │
  │ 生成初始 Module 对象                        │
  └─────────────────────────────────────────────┘
         ↓
Step 2: 依赖收集 (Dependency Collection)
  ┌─────────────────────────────────────────────┐
  │ 解析 AST，提取 import/require/dynamic import │
  │ 对每个依赖执行 resolve()                    │
  │ 递归处理，直到所有模块被解析                  │
  │ 去重：用 Map<resolvedPath, Module> 缓存     │
  └─────────────────────────────────────────────┘
         ↓
Step 3: 依赖图构建 (Graph Construction)
  ┌─────────────────────────────────────────────┐
  │ 节点 = Module (id, path, dependencies[])    │
  │ 边 = 依赖关系 (source → target)             │
  │ 检测循环依赖 (DFS + visited set)            │
  │ 拓扑排序 (用于确定执行顺序)                  │
  └─────────────────────────────────────────────┘
         ↓
Step 4: 代码生成 (Code Generation)
  ┌─────────────────────────────────────────────┐
  │ 按拓扑序排列模块                             │
  │ 包裹 IIFE / CommonJS / ESM wrapper          │
  │ 注入 runtime (module loader)                │
  │ 输出最终 bundle                             │
  └─────────────────────────────────────────────┘
```

### 1.2 手写 Mini Bundler — 理解打包原理

```javascript
// mini-bundler.js — 从零实现一个完整打包器
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

class MiniBundler {
  constructor(options = {}) {
    this.entry = options.entry || './src/index.js';
    this.baseDir = options.baseDir || process.cwd();
    this.modules = new Map(); // id → module info
    this.moduleIdCounter = 0;
  }

  // ========== 第一步：解析模块 ==========
  parseModule(filePath) {
    const absolutePath = path.resolve(this.baseDir, filePath);
    const source = fs.readFileSync(absolutePath, 'utf-8');
    const relativePath = path.relative(this.baseDir, absolutePath);

    // 用 acorn 解析为 AST
    const ast = acorn.parse(source, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      locations: true,
    });

    // 提取依赖
    const dependencies = [];
    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration') {
        dependencies.push({
          source: node.source.value,
          specifiers: node.specifiers.map(s => ({
            type: s.type,
            local: s.local.name,
            imported: s.type === 'ImportDefaultSpecifier'
              ? 'default'
              : s.imported?.name || s.local.name,
          })),
        });
      }
    }

    return {
      id: null, // 稍后分配
      path: relativePath,
      absolutePath,
      source,
      ast,
      dependencies,
    };
  }

  // ========== 第二步：解析模块路径 ==========
  resolveDependency(sourceFile, importSource) {
    // 处理相对路径
    if (importSource.startsWith('.') || importSource.startsWith('/')) {
      const dir = path.dirname(sourceFile);
      let resolved = path.resolve(dir, importSource);

      // 尝试扩展名
      const extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs'];
      for (const ext of extensions) {
        if (fs.existsSync(resolved + ext)) {
          return path.relative(this.baseDir, resolved + ext);
        }
      }
      // 尝试 index.js
      if (fs.existsSync(path.join(resolved, 'index.js'))) {
        return path.relative(this.baseDir, path.join(resolved, 'index.js'));
      }
      return path.relative(this.baseDir, resolved);
    }

    // 处理 node_modules
    return importSource; // 简化：实际应查找 node_modules
  }

  // ========== 第三步：构建依赖图 (BFS) ==========
  buildGraph() {
    const entryModule = this.parseModule(this.entry);
    const entryId = this.assignId(entryModule);
    const queue = [entryModule];

    while (queue.length > 0) {
      const current = queue.shift();

      for (const dep of current.dependencies) {
        const resolvedPath = this.resolveDependency(
          current.absolutePath,
          dep.source
        );

        // 跳过 node_modules (简化)
        if (!resolvedPath.startsWith('.') && !resolvedPath.startsWith('/')) {
          continue;
        }

        // 去重
        if (this.modules.has(resolvedPath)) {
          dep.resolvedId = this.modules.get(resolvedPath).id;
          continue;
        }

        const depModule = this.parseModule(resolvedPath);
        const depId = this.assignId(depModule);
        dep.resolvedId = depId;
        queue.push(depModule);
      }
    }

    return entryId;
  }

  assignId(module) {
    const id = this.moduleIdCounter++;
    module.id = id;
    this.modules.set(module.path, module);
    return id;
  }

  // ========== 第四步：转换 import 语句 ==========
  transformImports(module) {
    let source = module.source;

    // 替换 import 为 require 风格
    for (const dep of module.dependencies) {
      const importStmt = dep.source;
      const requireCall = `__require__(${dep.resolvedId})`;

      // 简化替换（实际应基于 AST）
      for (const spec of dep.specifiers) {
        if (spec.type === 'ImportDefaultSpecifier') {
          source = source.replace(
            new RegExp(`import\\s+${spec.local}\\s+from\\s+['"]${importStmt}['"]`),
            `const ${spec.local} = ${requireCall};`
          );
        } else if (spec.type === 'ImportSpecifier') {
          source = source.replace(
            new RegExp(
              `import\\s+\\{\\s*${spec.imported}(\\s+as\\s+${spec.local})?\\s*\\}\\s+from\\s+['"]${importStmt}['"]`
            ),
            `const { ${spec.imported}${spec.imported !== spec.local ? `: ${spec.local}` : ''} } = ${requireCall};`
          );
        }
      }
    }

    return source;
  }

  // ========== 第五步：生成 Bundle ==========
  generate(entryId) {
    const modules = [];

    for (const [, module] of this.modules) {
      const transformed = this.transformImports(module);
      modules.push(`
    ${module.id}: [
      function(require, module, exports) {
        ${transformed}
      },
      ${JSON.stringify(
        Object.fromEntries(
          module.dependencies.map(d => [d.source, d.resolvedId])
        )
      )}
    ]`);
    }

    return `
(function(modules) {
  // 模块缓存
  const cache = {};

  function require(id) {
    if (cache[id]) return cache[id].exports;

    const module = { exports: {}, id: id, loaded: false };
    cache[id] = module;

    const fn = modules[id][0];
    const deps = modules[id][1];

    // 递归 require 依赖
    function localRequire(name) {
      return require(deps[name]);
    }

    fn(localRequire, module, module.exports);
    module.loaded = true;
    return module.exports;
  }

  // 执行入口模块
  require(${entryId});
})({${modules.join(',\n')}});
`.trim();
  }

  // ========== 主流程 ==========
  bundle() {
    const entryId = this.buildGraph();
    return this.generate(entryId);
  }
}

// 使用示例
const bundler = new MiniBundler({ entry: './src/index.js' });
const bundle = bundler.bundle();
fs.writeFileSync('./dist/bundle.js', bundle);
console.log(`✅ Bundle 完成: ${bundler.modules.size} 个模块`);
```

### 1.3 手写 Mini Bundler — 支持 CommonJS + ESM 混合

```javascript
// mini-bundler-cjs-esm.js — 混合模块系统支持

class HybridBundler extends MiniBundler {
  parseModule(filePath) {
    const absolutePath = path.resolve(this.baseDir, filePath);
    const source = fs.readFileSync(absolutePath, 'utf-8');
    const relativePath = path.relative(this.baseDir, absolutePath);

    // 检测模块类型
    const isESM = this.detectESM(source);
    const isCJS = this.detectCJS(source);

    const ast = acorn.parse(source, {
      sourceType: isESM ? 'module' : 'script',
      ecmaVersion: 'latest',
    });

    const dependencies = [];

    if (isESM) {
      // ESM: import / export
      for (const node of ast.body) {
        if (node.type === 'ImportDeclaration') {
          dependencies.push({
            type: 'esm',
            source: node.source.value,
            specifiers: this.parseImportSpecifiers(node.specifiers),
          });
        }
        if (node.type === 'ExportNamedDeclaration' && node.source) {
          dependencies.push({
            type: 'esm-reexport',
            source: node.source.value,
            specifiers: node.specifiers.map(s => ({
              type: 'ImportSpecifier',
              local: s.exported.name,
              imported: s.local.name,
            })),
          });
        }
      }
    }

    if (isCJS) {
      // CJS: require / module.exports / exports.xxx
      this.walkCJS(ast, dependencies);
    }

    return {
      id: null,
      path: relativePath,
      absolutePath,
      source,
      ast,
      dependencies,
      moduleType: isESM ? 'esm' : 'cjs',
    };
  }

  detectESM(source) {
    return /\bimport\s+['"{]/.test(source) ||
           /\bexport\s+(default|{)/.test(source) ||
           /\bimport\s*\(/.test(source);
  }

  detectCJS(source) {
    return /\brequire\s*\(/.test(source) ||
           /\bmodule\.exports\b/.test(source) ||
           /\bexports\.\w+\s*=/.test(source);
  }

  parseImportSpecifiers(specifiers) {
    return specifiers.map(s => {
      if (s.type === 'ImportDefaultSpecifier') {
        return { type: 'ImportDefaultSpecifier', local: s.local.name, imported: 'default' };
      }
      if (s.type === 'ImportNamespaceSpecifier') {
        return { type: 'ImportNamespaceSpecifier', local: s.local.name, imported: '*' };
      }
      return {
        type: 'ImportSpecifier',
        local: s.local.name,
        imported: s.imported?.name || s.local.name,
      };
    });
  }

  walkCJS(ast, dependencies) {
    // 简化：检测 require() 调用
    const walk = (node) => {
      if (!node) return;
      if (node.type === 'CallExpression' &&
          node.callee.name === 'require' &&
          node.arguments.length === 1 &&
          node.arguments[0].type === 'Literal') {
        const source = node.arguments[0].value;
        const varName = this.findRequireVarName(node);
        dependencies.push({
          type: 'cjs',
          source,
          varName,
          specifiers: [{ type: 'ImportDefaultSpecifier', local: varName, imported: 'default' }],
        });
      }
      for (const key in node) {
        if (typeof node[key] === 'object') {
          walk(node[key]);
        }
      }
    };
    walk(ast);
  }

  findRequireVarName(callNode) {
    // 向上查找 VariableDeclarator
    // 简化处理
    return '__require_result__';
  }
}
```

### 1.4 打包算法复杂度分析

```
算法复杂度对比：

┌─────────────────────────────────┬──────────┬──────────┬──────────┐
│ 操作                            │ Webpack  │ esbuild  │ Rolldown │
├─────────────────────────────────┼──────────┼──────────┼──────────┤
│ 模块解析 (AST)                  │ O(n)     │ O(n)     │ O(n)     │
│ 依赖图构建 (BFS)                │ O(V+E)   │ O(V+E)   │ O(V+E)   │
│ Tree Shaking (静态分析)         │ O(n²)    │ O(n)     │ O(n)     │
│ Scope Hoisting                  │ O(n log n)│ O(n)    │ O(n)     │
│ 代码分割 (Graph partition)      │ O(n²)    │ O(n)     │ O(n)     │
│ 总时间复杂度                    │ O(n²)    │ O(n)     │ O(n)     │
└─────────────────────────────────┴──────────┴──────────┴──────────┘

V = 模块数, E = 依赖边数, n = AST 节点数

关键洞察：
1. Webpack 的 Tree Shaking 是 O(n²) — 每个模块都要扫描所有导出
2. esbuild/Rolldown 用位图标记导出，Tree Shaking 降到 O(n)
3. 依赖图构建永远是 O(V+E) — 这是理论下界
4. Scope Hoisting 的排序可以用拓扑排序降到 O(V+E)
```

---

## 二、Rust 工具链深度原理

### 2.1 OXC 统一工具链架构

```
OXC (Oxidation Compiler) — Rust 编写的前端工具链统一平台

┌─────────────────────────────────────────────────────────────┐
│                        OXC 架构                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ oxc_parser   │→│ oxc_semantic │→│ oxc_codegen  │      │
│  │ (解析器)      │  │ (语义分析)    │  │ (代码生成)    │      │
│  │ 2-3x faster  │  │ 类型推断     │  │ 最小化输出    │      │
│  │ than acorn   │  │ 作用域分析    │  │ source map   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓              ↓              ↓                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ oxc_transform│  │ oxc_minifier │  │ oxc_linter   │      │
│  │ (转换器)      │  │ (压缩器)      │  │ (Linter)     │      │
│  │ SWC 兼容     │  │ 比 terser    │  │ 100x faster  │      │
│  │ TSX/JSX     │  │ 快 10x       │  │ ESLint 兼容  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  共享组件:                                                    │
│  ├── oxc_allocator  — bump allocator (零分配开销)            │
│  ├── oxc_span      — 源码位置追踪                            │
│  ├── oxc_syntax    — 语法语义模型                            │
│  └── oxc_mangler   — 变量名混淆                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 OXC Parser 核心设计

```rust
// oxc_parser 核心结构 (简化)

use oxc_allocator::Allocator;
use oxc_ast::ast::Program;
use oxc_span::SourceType;

pub struct Parser<'a> {
    allocator: &'a Allocator,
    source: &'a str,
    source_type: SourceType,
    current: Token,
    peeked: Option<Token>,
    errors: Vec/Error>,
}

impl<'a> Parser<'a> {
    // 解析入口
    pub fn parse(&mut self) -> Program<'a> {
        let directives = self.parse_directives();
        let body = self.parse_script_items();

        Program {
            span: self.span(),
            source_type: self.source_type,
            directives,
            body,
            hashbang: None,
        }
    }

    // 关键优化：Bump Allocator
    // 传统 JS 解析器每次 new Object() 都触发 GC
    // OXC 用 bump allocator — 一次性分配大块内存，指针移动即分配
    // 解析完成后一次性释放 — 零 GC 压力
}
```

### 2.3 Rolldown — Rust 版 Rollup

```
Rolldown 架构设计:

┌──────────────────────────────────────────────────────┐
│                   Rolldown 架构                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  输入:                                                  │
│  ├── 入口配置 (entry points)                           │
│  ├── 插件系统 (Rust plugin API)                        │
│  └── 选项 (output format, sourcemap, ...)             │
│                                                       │
│  处理管线:                                              │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 1. resolve_id   — 模块解析 (插件 hook)            │ │
│  │ 2. load         — 模块加载 (插件 hook)            │ │
│  │ 3. transform    — 代码转换 (插件 hook)            │ │
│  │ 4. build_graph  — 依赖图构建                      │ │
│  │ 5. tree_shake   — 静态分析 + 死代码消除           │ │
│  │ 6. scope_hoist  — 作用域提升                      │ │
│  │ 7. optimize     — 常量折叠/内联/死代码消除        │ │
│  │ 8. generate     — 代码生成                        │ │
│  │ 9. render_chunk — 分块渲染                        │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  输出:                                                  │
│  ├── bundle chunks (JS/CSS/Assets)                    │
│  ├── source maps                                       │
│  └── metadata (manifest, stats)                        │
│                                                       │
└──────────────────────────────────────────────────────┘

Rolldown vs Rollup 性能对比 (1000 模块项目):
┌──────────────────┬──────────┬──────────┬─────────┐
│ 阶段             │ Rollup   │ Rolldown │ 加速比  │
├──────────────────┼──────────┼──────────┼─────────┤
│ 解析              │ 420ms    │ 38ms     │ 11x     │
│ 转换              │ 850ms    │ 120ms    │ 7x      │
│ Tree Shaking     │ 680ms    │ 45ms     │ 15x     │
│ 代码生成          │ 350ms    │ 52ms     │ 6.7x    │
│ 总时间            │ 2300ms   │ 255ms    │ 9x      │
└──────────────────┴──────────┴──────────┴─────────┘
```

### 2.4 Rspack — Webpack 兼容的 Rust Bundler

```
Rspack 核心设计 — 100% Webpack 兼容:

┌──────────────────────────────────────────────────────┐
│                    Rspack 架构                        │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Webpack Plugin API (JS)                              │
│         ↓ NAPI-RS bridge                              │
│  ┌──────────────────────────────────────────────────┐ │
│  │              Rspack Core (Rust)                   │ │
│  │                                                   │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │ │
│  │  │ Resolver │→│ Loader   │→│ Parser   │       │ │
│  │  │ (Rust)   │  │ (Rust)   │  │ (Rust)   │       │ │
│  │  └──────────┘  └──────────┘  └──────────┘       │ │
│  │         ↓              ↓              ↓          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │ │
│  │  │ Generator│→│ Optimizer│→│ Emitter  │       │ │
│  │  │ (Rust)   │  │ (Rust)   │  │ (Node.js)│       │ │
│  │  └──────────┘  └──────────┘  └──────────┘       │ │
│  │                                                   │ │
│  │  增量编译引擎:                                     │ │
│  │  ├── 文件级缓存 (file graph)                      │ │
│  │  ├── 模块级缓存 (module graph)                    │ │
│  │  ├── 依赖级缓存 (dependency graph)                │ │
│  │  └── 持久化缓存 (Rspack persistent cache)         │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  性能对比 (3000 模块项目):                             │
│  ├── 首次构建: Webpack 45s → Rspack 6s (7.5x)       │
│  ├── HMR: Webpack 800ms → Rspack 80ms (10x)         │
│  └── 持久缓存: 首次 6s → 二次 1.2s (5x)              │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## 三、高级代码分割策略

### 3.1 代码分割算法深度

```
代码分割的三种核心算法:

算法 1: 基于入口的分割 (Entry-based Splitting)
  ┌─────────────────────────────────────────────┐
  │ 原理: 每个 entry 生成一个 chunk              │
  │ 适用: 多页应用 (MPA)                         │
  │ 复杂度: O(n) — n = entry 数量               │
  │                                             │
  │ 配置:                                        │
  │  entry: {                                   │
  │    app: './src/app.js',                     │
  │    admin: './src/admin.js',                 │
  │    vendor: ['./react', './react-dom']       │
  │  }                                          │
  └─────────────────────────────────────────────┘

算法 2: 基于动态 import 的分割 (Dynamic Import Splitting)
  ┌─────────────────────────────────────────────┐
  │ 原理: import() 返回 Promise，自动分割        │
  │ 适用: SPA 路由懒加载                         │
  │ 复杂度: O(n) — n = import() 调用数          │
  │                                             │
  │ 配置:                                        │
  │  optimization: {                            │
  │    splitChunks: {                           │
  │      chunks: 'all',                         │
  │      cacheGroups: {                         │
  │        vendors: {                           │
  │          test: /[\\/]node_modules[\\/]/,    │
  │          name: 'vendors',                   │
  │        },                                   │
  │        common: {                            │
  │          minChunks: 2,                      │
  │          name: 'common',                    │
  │        }                                    │
  │      }                                      │
  │    }                                        │
  │  }                                          │
  └─────────────────────────────────────────────┘

算法 3: 基于大小的分割 (Size-based Splitting)
  ┌─────────────────────────────────────────────┐
  │ 原理: 超过阈值自动分割                        │
  │ 适用: 大库自动拆分                           │
  │ 复杂度: O(n log n) — 排序 + 贪心            │
  │                                             │
  │ 配置:                                        │
  │  optimization: {                            │
  │    splitChunks: {                           │
  │      maxSize: 30000,  // 30KB               │
  │      minSize: 20000,  // 20KB               │
  │      enforceSizeThreshold: 5000,            │
  │    }                                        │
  │  }                                          │
  └─────────────────────────────────────────────┘
```

### 3.2 高级 SplitChunks 策略

```javascript
// webpack.config.js — 生产级 SplitChunks 配置

const config = {
  optimization: {
    splitChunks: {
      // 对所有 chunk 生效 (包括 async)
      chunks: 'all',

      // 最小尺寸 (字节) — 小于此值不分割
      minSize: 20000,

      // 最大尺寸 — 超过此值尝试分割
      maxSize: 200000,

      // 最小引用次数 — 被引用 < 此值不分割
      minChunks: 1,

      // 最大异步请求数 — 控制并行加载
      maxAsyncRequests: 30,

      // 最大初始请求数 — 控制首屏加载
      maxInitialRequests: 10,

      // 文件名分隔符
      automaticNameDelimiter: '~',

      // 缓存组 — 核心策略
      cacheGroups: {
        // ── 策略 1: React 生态单独打包 ──
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
          name: 'react-vendor',
          priority: 40,
          reuseExistingChunk: true,
        },

        // ── 策略 2: UI 组件库单独打包 ──
        ui: {
          test: /[\\/]node_modules[\\/](antd|@mui|element-plus)[\\/]/,
          name: 'ui-vendor',
          priority: 30,
          reuseExistingChunk: true,
        },

        // ── 策略 3: 工具库合并 ──
        utils: {
          test: /[\\/]node_modules[\\/](lodash|date-fns|axios)[\\/]/,
          name: 'utils-vendor',
          priority: 20,
          minChunks: 2,
          reuseExistingChunk: true,
        },

        // ── 策略 4: 通用模块 ──
        common: {
          minChunks: 2,
          priority: 10,
          reuseExistingChunk: true,
          // 只打包 src 下的公共模块
          test: /[\\/]src[\\/]/,
        },

        // ── 策略 5: 默认 vendor ──
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          reuseExistingChunk: true,
        },

        // ── 策略 6: 默认 common ──
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
  },
};
```

### 3.3 路由级代码分割实战

```javascript
// src/router/index.js — 路由懒加载 + 预加载

import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    // 基础懒加载
    component: () => import(/* webpackChunkName: "home" */ '../views/Home.vue'),
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    // 预取：空闲时下载
    component: () => import(/* webpackPrefetch: true */ '../views/Dashboard.vue'),
  },
  {
    path: '/settings',
    name: 'Settings',
    // 预加载：高优先级下载
    component: () => import(/* webpackPreload: true */ '../views/Settings.vue'),
  },
  {
    path: '/admin',
    name: 'Admin',
    // 组合策略：预取 + 自定义 chunk 名
    component: () => import(
      /* webpackChunkName: "admin-panel" */
      /* webpackPrefetch: true */
      '../views/Admin.vue'
    ),
    // 子路由也懒加载
    children: [
      {
        path: 'users',
        component: () => import('../views/admin/Users.vue'),
      },
      {
        path: 'logs',
        component: () => import('../views/admin/Logs.vue'),
      },
    ],
  },
];

// Vite 等价写法
// import('../views/Home.vue') 自动按文件分割
// 用 /* @vite-ignore */ 禁用自动分割
```

---

## 四、增量编译算法

### 4.1 增量编译的核心原理

```
增量编译 vs 全量编译:

全量编译:
  每次修改 → 重新解析所有模块 → 重新转换 → 重新生成
  时间: O(n) — n = 总模块数

增量编译:
  每次修改 → 只重新解析变更模块 → 只重新转换受影响模块 → 只重新生成受影响 chunk
  时间: O(k) — k = 受影响模块数 (k << n)

增量编译的三种实现策略:

策略 1: 文件级增量 (File-level Incremental)
  ┌─────────────────────────────────────────────┐
  │ 原理: 记录每个文件的 hash，只处理变更文件    │
  │ 实现:                                        │
  │  1. 首次构建: 计算每个文件 hash，存入 cache  │
  │  2. 后续构建: 对比 hash，只处理变更文件      │
  │  3. 缓存命中: 直接使用上次构建结果           │
  │ 优点: 实现简单                                │
  │ 缺点: 一个文件变更可能影响大量下游模块        │
  │ 适用: 小型项目                                 │
  └─────────────────────────────────────────────┘

策略 2: 模块级增量 (Module-level Incremental)
  ┌─────────────────────────────────────────────┐
  │ 原理: 维护模块依赖图，只重新编译受影响模块    │
  │ 实现:                                        │
  │  1. 构建模块依赖图 (DAG)                     │
  │  2. 文件变更 → 标记该模块为 dirty            │
  │  3. 沿依赖图向上传播 (反向拓扑遍历)           │
  │  4. 只重新编译 dirty 模块                    │
  │ 优点: 精确                                   │
  │ 缺点: 维护依赖图开销                          │
  │ 适用: 中大型项目                               │
  └─────────────────────────────────────────────┘

策略 3: 持久化增量 (Persistent Incremental)
  ┌─────────────────────────────────────────────┐
  │ 原理: 将编译结果持久化到磁盘，跨构建复用      │
  │ 实现:                                        │
  │  1. 首次构建: 缓存编译结果到磁盘              │
  │  2. 后续构建: 读取缓存，跳过未变更模块        │
  │  3. 缓存失效: 依赖变更/hash 变化时失效        │
  │ 优点: 冷启动也快                              │
  │ 缺点: 磁盘 I/O 开销                           │
  │ 适用: CI/CD 场景                              │
  └─────────────────────────────────────────────┘
```

### 4.2 Webpack 持久化缓存配置

```javascript
// webpack.config.js — 持久化缓存

const config = {
  cache: {
    type: 'filesystem', // 持久化到磁盘
    buildDependencies: {
      config: [__filename], // 配置文件变更时失效缓存
    },
    // 缓存目录
    cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
    // 缓存版本 — 改变后全量失效
    version: '1.0.0',
    // 压缩缓存
    compression: 'gzip',
    // 读取缓存
    profile: true,
    // 允许并发读取
    allowCollectingMemory: true,
  },

  // 模块 ID 持久化 (生产环境)
  optimization: {
    moduleIds: 'deterministic', // 稳定的模块 ID
    chunkIds: 'deterministic',  // 稳定的 chunk ID
  },
};
```

### 4.3 Vite 开发服务器 HMR 原理

```
Vite HMR (Hot Module Replacement) 原理:

┌──────────────────────────────────────────────────────────┐
│                    Vite HMR 流程                          │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  1. 文件监听 (File Watcher)                               │
│     ├── 使用 chokidar / fsevents 监听文件变更             │
│     ├── 变更事件 → 通知 Vite Dev Server                   │
│     └── 去抖: 批量处理 (100ms 窗口)                      │
│                                                           │
│  2. 模块图更新 (Module Graph Update)                      │
│     ├── 定位变更的模块                                     │
│     ├── 计算受影响的模块集合 (反向依赖遍历)                 │
│     └── 标记需要 HMR 的模块                               │
│                                                           │
│  3. HMR 边界检测 (HMR Boundary)                           │
│     ├── 从变更模块向上遍历依赖链                            │
│     ├── 找到第一个 accept() 的模块 — 这就是 HMR 边界      │
│     └── 如果没有 accept() → 全页刷新                       │
│                                                           │
│  4. 增量编译 (Incremental Compile)                        │
│     ├── 只编译变更模块 + 直接依赖                           │
│     ├── 使用 esbuild 转换 (比 Babel 快 100x)             │
│     └── 生成新的模块代码                                   │
│                                                           │
│  5. WebSocket 推送 (WebSocket Push)                       │
│     ├── Dev Server → 浏览器 (WebSocket)                   │
│     ├── 消息类型:                                          │
│     │   ├── full-reload: 全页刷新                          │
│     │   ├── vue-reload: 组件重载                           │
│     │   ├── vue-rerender: 只重新渲染                       │
│     │   └── custom: 自定义 HMR                            │
│     └── 消息内容: { type, path, timestamps }              │
│                                                           │
│  6. 客户端接收 (Client-side Accept)                       │
│     ├── 浏览器接收 WebSocket 消息                          │
│     ├── 动态 import() 新模块代码                           │
│     ├── 调用 accept(callback) 回调                        │
│     └── 更新组件/状态                                      │
│                                                           │
│  时间线 (典型 Vue 组件修改):                               │
│  ├── 文件保存 (T+0ms)                                     │
│  ├── 文件监听触发 (T+5ms)                                 │
│  ├── 增量编译 (T+10ms) — esbuild                          │
│  ├── WebSocket 推送 (T+15ms)                              │
│  ├── 客户端接收 (T+20ms)                                  │
│  ├── 动态 import (T+25ms)                                 │
│  └── 组件更新 (T+30ms)                                    │
│                                                           │
│  总延迟: ~30ms (比 Webpack HMR 快 10-20x)                 │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## 五、Bundler 对比与选型指南

### 5.1 2026 年 Bundler 全面对比

```
┌──────────────┬──────────┬──────────┬──────────┬──────────┐
│ 特性          │ Webpack  │ Vite     │ Rspack   │ Rolldown │
├──────────────┼──────────┼──────────┼──────────┼──────────┤
│ 语言          │ JS       │ JS       │ Rust     │ Rust     │
│ 首次构建       │ 慢       │ 极快*    │ 快       │ 极快     │
│ HMR           │ 慢       │ 极快     │ 快       │ 快       │
│ 生产构建       │ 中等     │ 中等     │ 快       │ 极快     │
│ 插件生态       │ ★★★★★   │ ★★★★     │ ★★★      │ ★★       │
│ Webpack 兼容  │ 原生     │ 通过插件  │ 100%     │ 部分     │
│ Tree Shaking  │ 好       │ 好       │ 好       │ 极好     │
│ 代码分割       │ 强大     │ 好       │ 强大     │ 好       │
│ 学习曲线       │ 陡峭     │ 平缓     │ 平缓     │ 平缓     │
│ 配置复杂度     │ 高       │ 低       │ 低       │ 低       │
│ 适用场景       │ 大型复杂  │ 现代 Web │ 大型迁移 │ 库打包   │
└──────────────┴──────────┴──────────┴──────────┴──────────┘

* Vite 开发服务器快是因为不需要预打包 (bundlerless dev)
```

### 5.2 选型决策树

```
选择构建工具的决策树:

                    ┌─────────────┐
                    │  项目类型？  │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
      ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
      │  应用项目  │ │  库/SDK   │ │  Monorepo │
      └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
            │              │              │
            │         ┌────▼────┐    ┌────▼────┐
            │         │ 输出格式│    │ 工具链  │
            │         └────┬────┘    └────┬────┘
            │              │         ┌────┼────┐
            │    ┌─────────┼─────────┐ │    │
            │    │ ESM only│ │ CJS+ESM│ │ 统一│ 混合
            │    └────┬────┘ └────┬───┘ │    │
            │    ┌────▼────┐ ┌────▼───┐│    │
            │    │ Rolldown│ │ Rollup ││    │
            │    └─────────┘ └────────┘│    │
            │                          │    │
      ┌─────▼─────┐              ┌─────▼────┐
      │ Vite/Rspack│              │ Turborepo│
      │ (看项目规模)│              │ + 子项目  │
      └─────┬─────┘              │ 选 Vite  │
            │                    └──────────┘
      ┌─────▼─────┐
      │ 迁移成本？ │
      └─────┬─────┘
            │
      ┌─────┼─────┐
      │           │
  ┌───▼───┐  ┌───▼────┐
  │ 有Webpack│ │ 新启动  │
  │ 项目    │  │ 项目    │
  └───┬───┘  └───┬────┘
      │           │
  ┌───▼───┐  ┌───▼────┐
  │ Rspack │  │ Vite   │
  │ (无缝  │  │ (默认)  │
  │ 迁移)  │  └────────┘
  └───────┘
```

---

## 六、实战：手写一个支持 HMR 的简易开发服务器

```javascript
// mini-dev-server.js — 从零实现带 HMR 的开发服务器

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const chokidar = require('chokidar');

class MiniDevServer {
  constructor(options = {}) {
    this.root = options.root || process.cwd();
    this.port = options.port || 3000;
    this.modules = new Map();
    this.wss = null;
    this.server = null;
  }

  start() {
    // 1. 创建 HTTP 服务器
    this.server = http.createServer((req, res) => this.handleRequest(req, res));

    // 2. 创建 WebSocket 服务器 (HMR)
    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on('connection', (ws) => {
      console.log('🔌 HMR client connected');
      ws.on('message', (msg) => {
        const data = JSON.parse(msg);
        if (data.type === 'hmr-accepted') {
          console.log(`✅ HMR accepted: ${data.path}`);
        }
      });
    });

    // 3. 启动文件监听
    this.watchFiles();

    // 4. 启动服务器
    this.server.listen(this.port, () => {
      console.log(`🚀 Mini Dev Server running at http://localhost:${this.port}`);
    });
  }

  handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${this.port}`);
    let filePath = path.join(this.root, url.pathname);

    // 默认 index.html
    if (url.pathname === '/') {
      filePath = path.join(this.root, 'index.html');
    }

    // 处理 .js 文件 — 注入 HMR client
    if (filePath.endsWith('.js') && !filePath.includes('node_modules')) {
      const source = fs.readFileSync(filePath, 'utf-8');
      const transformed = this.transformJS(source, filePath);
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(transformed);
      return;
    }

    // 处理 .vue 文件
    if (filePath.endsWith('.vue')) {
      const source = fs.readFileSync(filePath, 'utf-8');
      const transformed = this.transformVue(source, filePath);
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(transformed);
      return;
    }

    // 处理静态文件
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
    };

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(content);
    } catch (e) {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  transformJS(source, filePath) {
    // 注入 HMR runtime
    const hmrCode = `
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    console.log('[HMR] Module updated: ${filePath}');
  });
}
`;
    return source + hmrCode;
  }

  transformVue(source, filePath) {
    // 简化：提取 <template>, <script>, <style>
    const templateMatch = source.match(/<template[^>]*>([\s\S]*?)<\/template>/);
    const scriptMatch = source.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    const styleMatch = source.match(/<style[^>]*>([\s\S]*?)<\/style>/);

    const template = templateMatch ? templateMatch[1].trim() : '';
    const script = scriptMatch ? scriptMatch[1].trim() : '';
    const style = styleMatch ? styleMatch[1].trim() : '';

    // 生成 JS 模块
    return `
import { defineComponent, h } from 'vue';

${style ? `
// 注入 style
const styleId = '${filePath}-style';
if (!document.getElementById(styleId)) {
  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = ${JSON.stringify(style)};
  document.head.appendChild(styleEl);
}
` : ''}

export default defineComponent({
  name: '${path.basename(filePath, '.vue')}',
  ${script ? `setup() { ${script} }` : ''}
  render() {
    return ${this.templateToRenderFn(template)};
  }
});

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // Vue HMR: 重新渲染组件
    console.log('[HMR] Vue component updated: ${filePath}');
  });
}
`.trim();
  }

  templateToRenderFn(template) {
    // 极度简化：将 HTML 模板转为 h() 调用
    // 实际实现需要完整的模板编译器
    return `h('div', null, ${JSON.stringify(template)})`;
  }

  watchFiles() {
    const watcher = chokidar.watch('**/*.{js,vue,css,html}', {
      cwd: this.root,
      ignored: /node_modules/,
    });

    watcher.on('change', (filePath) => {
      console.log(`📝 File changed: ${filePath}`);

      // 通知所有客户端
      this.wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: 'file-change',
            path: filePath,
            timestamp: Date.now(),
          }));
        }
      });
    });
  }
}

// 启动
const server = new MiniDevServer({ root: './demo', port: 3000 });
server.start();
```

---

## 七、闭卷自测

### 题目 1: 手写模块解析器
实现一个函数 `parseDependencies(source: string): string[]`，从 JS 源码中提取所有 import/require 的模块路径。

```javascript
function parseDependencies(source) {
  const deps = [];

  // ESM: import ... from 'xxx'
  const esmRegex = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = esmRegex.exec(source)) !== null) {
    deps.push(match[1]);
  }

  // Dynamic import: import('xxx')
  const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicRegex.exec(source)) !== null) {
    deps.push(match[1]);
  }

  // CJS: require('xxx')
  const cjsRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = cjsRegex.exec(source)) !== null) {
    deps.push(match[1]);
  }

  return [...new Set(deps)];
}

// 测试
const code = `
import React from 'react';
import { useState } from 'react';
import App from './App';
const utils = require('./utils');
const lazy = import('./lazy');
`;
console.log(parseDependencies(code));
// ['react', './App', './utils', './lazy']
```

### 题目 2: 实现依赖图拓扑排序
给定模块依赖关系，返回正确的加载顺序。

```javascript
function topologicalSort(graph) {
  // graph = { moduleId: [dependencyIds] }
  const visited = new Set();
  const inStack = new Set();
  const result = [];

  function dfs(nodeId) {
    if (inStack.has(nodeId)) {
      throw new Error(`循环依赖检测: ${nodeId}`);
    }
    if (visited.has(nodeId)) return;

    inStack.add(nodeId);
    for (const dep of (graph[nodeId] || [])) {
      dfs(dep);
    }
    inStack.delete(nodeId);
    visited.add(nodeId);
    result.push(nodeId);
  }

  for (const nodeId of Object.keys(graph)) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }

  return result;
}

// 测试
const graph = {
  A: ['B', 'C'],
  B: ['D'],
  C: ['D'],
  D: [],
};
console.log(topologicalSort(graph));
// ['D', 'B', 'C', 'A'] — D 最先加载
```

### 题目 3: 实现简易 Tree Shaking
给定模块导出列表和使用列表，移除未使用的导出。

```javascript
function treeShake(modules, usedExports) {
  // modules = { moduleId: { exports: ['foo', 'bar', 'baz'], source: '...' } }
  // usedExports = { moduleId: Set(['foo', 'bar']) }

  const result = {};

  for (const [moduleId, module] of Object.entries(modules)) {
    const used = usedExports[moduleId] || new Set();
    const allExports = module.exports;

    // 计算未使用的导出
    const unused = allExports.filter(e => !used.has(e));

    // 从源码中移除未使用的导出
    let source = module.source;
    for (const exp of unused) {
      // 移除 export function/const/let/var 声明
      const regex = new RegExp(
        `export\\s+(?:function|const|let|var|class)\\s+${exp}\\b[\\s\\S]*?(?=export\\s|\\n\\n|$)`,
        'g'
      );
      source = source.replace(regex, '');
    }

    result[moduleId] = { ...module, source, treeShaken: unused };
  }

  return result;
}
```

---

## 八、关键收获

1. **打包算法内核** — 模块解析 (AST) → 依赖收集 → 图构建 (BFS) → 拓扑排序 → 代码生成，五步理解所有 bundler
2. **手写 Mini Bundler** — 从 0 实现完整打包器，理解 require/runtime/module 机制
3. **Rust 工具链** — OXC 统一工具链 + Rolldown/Rspack 性能提升 5-15x，核心是 bump allocator + 零 GC
4. **代码分割算法** — 三种策略 (入口/动态 import/大小)，SplitChunks cacheGroups 是生产级配置核心
5. **增量编译** — 文件级/模块级/持久化三种策略，HMR 核心是 WebSocket + 模块图 + accept 边界
6. **Bundler 选型** — 新启动 → Vite，Webpack 迁移 → Rspack，库打包 → Rolldown，复杂场景 → Webpack
7. **复杂度洞察** — Webpack Tree Shaking O(n²) vs esbuild O(n)，是性能差距的核心原因
8. **HMR 原理** — 文件监听 → 模块图更新 → HMR 边界检测 → 增量编译 → WebSocket 推送 → 客户端 accept

---

*v4 完成。构建工具系列 4 轮迭代，覆盖基础配置 → 进阶架构 → 现代生态 → 算法内核。*
